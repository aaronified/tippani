package httpapi

import (
	"database/sql"
	"net/http"
	"sort"
	"strings"
)

// Metadata bulk management (Calibre-inspired basics): a bulk field-correction
// endpoint, duplicate detection, and a merge. These operate on the caller's own
// books only and run in a single transaction (SQLite is a single writer, so a
// pooled per-id approach would just serialise anyway).

// inClause returns "?,?,…,?" with n placeholders for an IN (…) list.
func inClause(n int) string {
	if n <= 0 {
		return ""
	}
	return strings.Repeat("?,", n-1) + "?"
}

// ownedIDs filters ids down to rows of `table` (books|movies) owned by uid, so a
// bulk op can never touch another user's rows (foreign/unknown ids are dropped).
// table is a package constant, never client input.
func (s *Server) ownedRowIDs(table string, uid int64, ids []int64) ([]int64, error) {
	if len(ids) == 0 {
		return nil, nil
	}
	args := make([]any, 0, len(ids)+1)
	for _, id := range ids {
		args = append(args, id)
	}
	args = append(args, uid)
	rows, err := s.Store.DB.Query(
		`SELECT id FROM `+table+` WHERE id IN (`+inClause(len(ids))+`) AND user_id = ?`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []int64
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err == nil {
			out = append(out, id)
		}
	}
	return out, rows.Err()
}

// bulkSetBooks runs `UPDATE books SET <col> = ? WHERE id IN (ids) AND user_id = ?`.
// col is a package constant (author/series/series_index), never client input.
func bulkSetBooks(tx *sql.Tx, col string, val any, ids []int64, uid int64) error {
	args := make([]any, 0, len(ids)+2)
	args = append(args, val)
	for _, id := range ids {
		args = append(args, id)
	}
	args = append(args, uid)
	_, err := tx.Exec(`UPDATE books SET `+col+` = ? WHERE id IN (`+inClause(len(ids))+`) AND user_id = ?`, args...)
	return err
}

// genresOf reads the current genre names of one book/movie inside a tx.
func genresOf(tx *sql.Tx, kind string, ownerID int64) ([]string, error) {
	rows, err := tx.Query(
		`SELECT g.name FROM `+kind+`_genres j JOIN genres g ON g.id = j.genre_id WHERE j.`+kind+`_id = ?`, ownerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var names []string
	for rows.Next() {
		var n string
		if err := rows.Scan(&n); err == nil {
			names = append(names, n)
		}
	}
	return names, rows.Err()
}

// handleBulkUpdateBooks applies one or more field corrections to a set of books
// at once — the Metadata console's bulk replace/correction (e.g. rename an
// author across many books, set a series on a selection, add a genre). Only the
// fields present in the request are touched; the rest are left as-is (a targeted
// patch, not the full-state PUT the single-book editor uses). One transaction, so
// a mid-batch failure rolls back cleanly.
func (s *Server) handleBulkUpdateBooks(w http.ResponseWriter, r *http.Request) {
	var req struct {
		IDs         []int64  `json:"ids"`
		Author      *string  `json:"author"`       // set author (nil = leave; "" = clear)
		Series      *string  `json:"series"`       // set series (nil = leave; "" = clear)
		SeriesIndex *float64 `json:"series_index"` // set reading/watch-order index
		AddGenres   []string `json:"add_genres"`   // union these genres into each book
	}
	if !decodeBody(w, r, &req) {
		return
	}
	if len(req.IDs) == 0 {
		writeErr(w, http.StatusBadRequest, "no books selected")
		return
	}
	if len(req.IDs) > 2000 {
		writeErr(w, http.StatusBadRequest, "too many books (max 2000)")
		return
	}
	uid := userID(r)
	owned, err := s.ownedRowIDs("books", uid, req.IDs)
	if err != nil {
		internalError(w, r, "bulk books: ownership", err)
		return
	}
	if len(owned) == 0 {
		writeErr(w, http.StatusNotFound, "no matching books")
		return
	}

	tx, err := s.Store.DB.Begin()
	if err != nil {
		internalError(w, r, "bulk books: begin", err)
		return
	}
	defer tx.Rollback()

	if req.Author != nil {
		if err := bulkSetBooks(tx, "author", nullable(strings.TrimSpace(*req.Author)), owned, uid); err != nil {
			internalError(w, r, "bulk books: author", err)
			return
		}
	}
	if req.Series != nil {
		if err := bulkSetBooks(tx, "series", nullable(strings.TrimSpace(*req.Series)), owned, uid); err != nil {
			internalError(w, r, "bulk books: series", err)
			return
		}
	}
	if req.SeriesIndex != nil {
		if err := bulkSetBooks(tx, "series_index", nullableFloat(*req.SeriesIndex), owned, uid); err != nil {
			internalError(w, r, "bulk books: series_index", err)
			return
		}
	}
	if add := cleanNames(req.AddGenres); len(add) > 0 {
		// Union per book (existing + added), then setGenres replaces the join set
		// and recomputes genre_text for FTS. Personal libraries are small, so the
		// per-book loop is fine.
		for _, id := range owned {
			cur, err := genresOf(tx, "book", id)
			if err != nil {
				internalError(w, r, "bulk books: read genres", err)
				return
			}
			if err := setGenres(tx, "book", uid, id, append(cur, add...)); err != nil {
				internalError(w, r, "bulk books: set genres", err)
				return
			}
		}
	}

	if err := tx.Commit(); err != nil {
		internalError(w, r, "bulk books: commit", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]int{"updated": len(owned)})
}

// ---- duplicate detection + merge ----

type dupBook struct {
	ID              int64  `json:"id"`
	Title           string `json:"title"`
	Author          string `json:"author"`
	Year            int    `json:"year"`
	HasCover        bool   `json:"has_cover"`
	AnnotationCount int    `json:"annotation_count"`
}

// handleBookDuplicates groups the user's books by fuzzy title (normalizeTitle:
// subtitle dropped, punctuation stripped, case-folded — same rule the importer
// uses) and returns every group with more than one book, so the console can
// offer a merge. Detection only; merging is an explicit POST /books/merge.
func (s *Server) handleBookDuplicates(w http.ResponseWriter, r *http.Request) {
	uid := userID(r)
	rows, err := s.Store.DB.Query(`
		SELECT b.id, b.title, COALESCE(b.author, ''), COALESCE(b.published_year, 0),
		       b.cover_path IS NOT NULL,
		       (SELECT count(*) FROM annotations a WHERE a.book_id = b.id)
		FROM books b WHERE b.user_id = ? ORDER BY b.id`, uid)
	if err != nil {
		internalError(w, r, "duplicates: query", err)
		return
	}
	defer rows.Close()
	groups := map[string][]dupBook{}
	for rows.Next() {
		var b dupBook
		var title string
		if err := rows.Scan(&b.ID, &title, &b.Author, &b.Year, &b.HasCover, &b.AnnotationCount); err != nil {
			continue
		}
		b.Title = title
		key := normalizeTitle(title)
		if key == "" {
			continue
		}
		groups[key] = append(groups[key], b)
	}

	out := [][]dupBook{}
	keys := make([]string, 0, len(groups))
	for k, g := range groups {
		if len(g) > 1 {
			keys = append(keys, k)
		}
	}
	sort.Strings(keys) // stable order for the UI
	for _, k := range keys {
		out = append(out, groups[k])
	}
	writeJSON(w, http.StatusOK, map[string]any{"groups": out})
}

// handleMergeBooks folds one or more books ("from") into a target ("into"): their
// annotations re-point to the target, their genres union in, and the emptied
// source books are deleted. Annotations that would collide with the target on
// (book_id, dedupe_hash) are dropped (UPDATE OR IGNORE leaves them on the source,
// which is then deleted) so a quote already on the target isn't duplicated.
func (s *Server) handleMergeBooks(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Into int64   `json:"into"`
		From []int64 `json:"from"`
	}
	if !decodeBody(w, r, &req) {
		return
	}
	if req.Into <= 0 || len(req.From) == 0 {
		writeErr(w, http.StatusBadRequest, "into and from are required")
		return
	}
	uid := userID(r)
	// Verify every id (target + sources) is the caller's, and the target isn't
	// also a source.
	all := append([]int64{req.Into}, req.From...)
	owned, err := s.ownedRowIDs("books", uid, all)
	if err != nil {
		internalError(w, r, "merge: ownership", err)
		return
	}
	ownedSet := map[int64]bool{}
	for _, id := range owned {
		ownedSet[id] = true
	}
	if !ownedSet[req.Into] {
		writeErr(w, http.StatusNotFound, "target book not found")
		return
	}
	from := []int64{}
	for _, id := range req.From {
		if id != req.Into && ownedSet[id] {
			from = append(from, id)
		}
	}
	if len(from) == 0 {
		writeErr(w, http.StatusBadRequest, "no distinct source books to merge")
		return
	}

	tx, err := s.Store.DB.Begin()
	if err != nil {
		internalError(w, r, "merge: begin", err)
		return
	}
	defer tx.Rollback()

	// Collect the union of genres (target + sources) before deleting the sources.
	genreSet := map[string]bool{}
	union := []string{}
	addGenres := func(names []string) {
		for _, n := range names {
			if !genreSet[strings.ToLower(n)] {
				genreSet[strings.ToLower(n)] = true
				union = append(union, n)
			}
		}
	}
	for _, id := range append([]int64{req.Into}, from...) {
		g, err := genresOf(tx, "book", id)
		if err != nil {
			internalError(w, r, "merge: read genres", err)
			return
		}
		addGenres(g)
	}

	// Re-point annotations; OR IGNORE skips ones that would duplicate a quote
	// already on the target (they stay on the source and are removed with it).
	fromArgs := make([]any, 0, len(from)+1)
	fromArgs = append(fromArgs, req.Into)
	for _, id := range from {
		fromArgs = append(fromArgs, id)
	}
	if _, err := tx.Exec(
		`UPDATE OR IGNORE annotations SET book_id = ? WHERE book_id IN (`+inClause(len(from))+`)`, fromArgs...); err != nil {
		internalError(w, r, "merge: move annotations", err)
		return
	}

	// Delete the source books (cascades any leftover collided annotations + their
	// book_genres). Scoped by user_id as a belt-and-braces guard.
	delArgs := make([]any, 0, len(from)+1)
	for _, id := range from {
		delArgs = append(delArgs, id)
	}
	delArgs = append(delArgs, uid)
	if _, err := tx.Exec(
		`DELETE FROM books WHERE id IN (`+inClause(len(from))+`) AND user_id = ?`, delArgs...); err != nil {
		internalError(w, r, "merge: delete sources", err)
		return
	}

	// Re-apply the unioned genres to the target (also GCs now-orphaned genres).
	if err := setGenres(tx, "book", uid, req.Into, union); err != nil {
		internalError(w, r, "merge: set genres", err)
		return
	}

	if err := tx.Commit(); err != nil {
		internalError(w, r, "merge: commit", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"into": req.Into, "merged": len(from)})
}
