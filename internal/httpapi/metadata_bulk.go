package httpapi

import (
	"database/sql"
	"net/http"
	"sort"
	"strings"

	"tippani/internal/metadata"
	"tippani/internal/olog"
	"tippani/internal/store"
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
		if err := rows.Scan(&id); err != nil {
			olog.Warnf(olog.CodeMetaRowScan, "[meta] owned id row scan failed: %v", err)
			continue
		}
		out = append(out, id)
	}
	return out, rows.Err()
}

// bulkSetBooks runs `UPDATE books SET <col> = ? WHERE id IN (ids) AND user_id = ?`.
// col is a package constant (author/series/series_index), never client input.
//
// A CREDIT COLUMN TAKES ITS LINK ROWS WITH IT (0056). Setting one author across
// forty books is the single largest credit write the app can make, and it is
// exactly the shape that would leave forty works' link rows describing a name
// nobody holds any more. The re-derive reads each row back rather than being
// handed the value, so it cannot disagree with what the UPDATE actually stored.
func bulkSetBooks(tx *sql.Tx, col string, val any, ids []int64, uid int64, seps metadata.CreditSeps) error {
	args := make([]any, 0, len(ids)+2)
	args = append(args, val)
	for _, id := range ids {
		args = append(args, id)
	}
	args = append(args, uid)
	if _, err := tx.Exec(`UPDATE books SET `+col+` = ?, updated_at = datetime('now') WHERE id IN (`+inClause(len(ids))+`) AND user_id = ?`, args...); err != nil {
		return err
	}
	if !bookCreditColumn[col] {
		return nil
	}
	for _, id := range ids {
		if err := store.SyncCreditsFromColumns(tx, uid, "book", id, seps); err != nil {
			return err
		}
	}
	return nil
}

// bookCreditColumn names the columns bulkSetBooks has to re-derive after. A set
// rather than a string compare, so adding a fourth credit column is one line
// here and not a condition somebody has to remember to widen.
var bookCreditColumn = map[string]bool{"author": true, "translator": true, "editor": true}

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
		if err := rows.Scan(&n); err != nil {
			olog.Warnf(olog.CodeMetaRowScan, "[meta] genre name row scan failed: %v", err)
			continue
		}
		names = append(names, n)
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
		// 0033. true = quiz me on these books' highlights, false = stop. A property
		// of the BOOK, so a highlight added to it tomorrow inherits the answer —
		// which is what somebody excluding a reference manual meant.
		Review *bool `json:"review"`
		// The rest of the record (1.16.0). Everything a book HAS, except the one
		// thing that names it.
		//
		// THE TITLE IS NOT HERE AND CANNOT BE. Every other field can sensibly hold
		// the same value across a selection — five books by one author, one series,
		// one year. A title cannot: setting it over a selection does not correct
		// five records, it destroys four of them and leaves five rows that are
		// indistinguishable afterwards. The same reasoning keeps a quote's own
		// words out of the quote endpoints.
		//
		// THE SUPPLIER IDS ARE NOT HERE EITHER, and for a harder reason than
		// taste: isbn is UNIQUE per user, and google_id/asin name ONE edition. A
		// bulk set of any of them either fails on the constraint or points five
		// books at one record, which is a worse lie than a wrong author because
		// every later re-sync then rewrites all five from it.
		Translator    *string  `json:"translator"`
		Editor        *string  `json:"editor"`
		PublishedYear *int     `json:"published_year"`
		PublishedCirca *bool   `json:"published_circa"`
		Description   *string  `json:"description"`
		Favorite      *bool    `json:"favorite"`
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
	// Read once for the whole batch rather than per book: it is one account's
	// setting, and bulk edit is the path where "per row" would mean forty
	// identical preference loads.
	seps := s.creditSeps(uid)
	olog.Tracef("[meta] handleBulkUpdateBooks uid=%v ids=%d", uid, len(req.IDs))
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
		if err := bulkSetBooks(tx, "author", nullable(strings.TrimSpace(*req.Author)), owned, uid, seps); err != nil {
			internalError(w, r, "bulk books: author", err)
			return
		}
	}
	if req.Series != nil {
		if err := bulkSetBooks(tx, "series", nullable(strings.TrimSpace(*req.Series)), owned, uid, seps); err != nil {
			internalError(w, r, "bulk books: series", err)
			return
		}
	}
	if req.SeriesIndex != nil {
		if err := bulkSetBooks(tx, "series_index", nullableFloat(*req.SeriesIndex), owned, uid, seps); err != nil {
			internalError(w, r, "bulk books: series_index", err)
			return
		}
	}
	for _, f := range []struct {
		col string
		val any
		set bool
	}{
		{"translator", nullableFromPtr(req.Translator), req.Translator != nil},
		{"editor", nullableFromPtr(req.Editor), req.Editor != nil},
		{"description", nullableFromPtr(req.Description), req.Description != nil},
		{"published_year", intFromPtr(req.PublishedYear), req.PublishedYear != nil},
		{"published_circa", boolIntFromPtr(req.PublishedCirca), req.PublishedCirca != nil},
		{"favorite", boolIntFromPtr(req.Favorite), req.Favorite != nil},
	} {
		if !f.set {
			continue
		}
		if err := bulkSetBooks(tx, f.col, f.val, owned, uid, seps); err != nil {
			internalError(w, r, "bulk books: "+f.col, err)
			return
		}
	}
	if req.Review != nil {
		// The body says what the reader wants; the column stores its negative.
		//
		// The book's column is kept and now seeds the highlights added to it
		// LATER; the deck reads the highlight's own flag, so taking today's
		// highlights out of the quiz is a write across them rather than a term in
		// a query. See cascadeWorkReview.
		val := boolToInt(!*req.Review)
		if err := bulkSetBooks(tx, "review_excluded", val, owned, uid, seps); err != nil {
			internalError(w, r, "bulk books: review", err)
			return
		}
		if err := cascadeWorkReview(tx, "annotations", "book_id", val, owned); err != nil {
			internalError(w, r, "bulk books: review cascade", err)
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
	s.gcOrphanPeople(uid, "author") // bulk author edits can orphan old names
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
	olog.Tracef("[meta] handleBookDuplicates uid=%v", uid)
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
			olog.Warnf(olog.CodeMetaRowScan, "[meta] duplicates book row scan failed: %v", err)
			continue
		}
		b.Title = title
		key := normalizeTitle(title)
		if key == "" {
			continue
		}
		groups[key] = append(groups[key], b)
	}
	if err := rows.Err(); err != nil {
		olog.Warnf(olog.CodeMetaRowScan, "[meta] duplicates book row iteration failed: %v", err)
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
	olog.Tracef("[meta] handleMergeBooks uid=%v into=%v from=%d", uid, req.Into, len(req.From))
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

	// A merge INTO an excluded book is another path that puts a quote under a work,
	// so it owes the same debt every create path owes (see workExclusion): the flag
	// that gates the deck is the quote's own, so arriving under a book marked "not
	// for quizzing" has to write it. Otherwise merging two editions quietly refills
	// the deck from a book the reader took out of it.
	//
	// ONE-WAY, and only one way. Excluding propagates; including does not. A quote
	// carries its own answer — somebody may have put a single line back in the quiz
	// inside a manual they otherwise skip — and a merge is not the moment to erase
	// that. Written on the SOURCE rows before they move, because that is exactly the
	// set that is moving: the target's own quotes are none of this operation's
	// business, and the ones that collide are deleted with the source anyway.
	if intoExcluded, err := workExclusion(tx, "books", req.Into); err != nil {
		internalError(w, r, "merge: read the target's quiz opt-out", err)
		return
	} else if intoExcluded == 1 {
		srcArgs := make([]any, 0, len(from))
		for _, id := range from {
			srcArgs = append(srcArgs, id)
		}
		if _, err := tx.Exec(
			`UPDATE annotations SET review_excluded = 1, updated_at = datetime('now')
			 WHERE book_id IN (`+inClause(len(from))+`)`, srcArgs...); err != nil {
			internalError(w, r, "merge: carry the quiz opt-out", err)
			return
		}
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

	// The characters, BEFORE the delete: 0048's trigger reaps a work's cast the
	// moment the work goes, and a book's list is entirely the reader's — nothing
	// seeds it, so every row lost here is one somebody typed. carryWorkCast is
	// where the merge rule for it is argued.
	if err := carryWorkCast(tx, uid, "book", req.Into, from); err != nil {
		internalError(w, r, "merge: carry the characters", err)
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
	s.gcOrphanPeople(uid, "author") // merged-away books may drop an author
	writeJSON(w, http.StatusOK, map[string]any{"into": req.Into, "merged": len(from)})
}

// handleMergeMovies: POST /movies/merge {into, from[]} — the Catalogue's half of
// the merge that books have had since duplicates became findable.
//
// IT MIRRORS handleMergeBooks DELIBERATELY, statement for statement, rather than
// being generalised into one function over a table name. Two things stopped
// that: the genre join table and the child table differ per side, and the orphan
// sweep at the end names a person KIND — and getting a shared version subtly
// wrong here would silently delete the wrong rows in a transaction that is over
// before anybody sees a screen. The duplication is three statements; the shared
// version would need four parameters and a comment explaining each.
//
// THE ORPHAN SWEEP NAMES TWO KINDS, and that is the one line that is not a
// mirror. movies.director holds a film's director, a show's creator AND a game's
// studio (0040), split by media_type — so merging away a game can orphan a
// studio row that sweeping only 'director' would leave behind for ever.
//
// THE CAST CARRY IS THE ONE STATEMENT THAT IS SHARED rather than mirrored, and
// carryWorkCast says why: work_cast is a single table addressed by (kind,
// work_id), so there is no per-side table name or person kind in it to get wrong
// — the two things that stopped the rest of this being generalised.
func (s *Server) handleMergeMovies(w http.ResponseWriter, r *http.Request) {
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
	olog.Tracef("[meta] handleMergeMovies uid=%v into=%v from=%d", uid, req.Into, len(req.From))
	all := append([]int64{req.Into}, req.From...)
	owned, err := s.ownedRowIDs("movies", uid, all)
	if err != nil {
		internalError(w, r, "merge: ownership", err)
		return
	}
	ownedSet := map[int64]bool{}
	for _, id := range owned {
		ownedSet[id] = true
	}
	if !ownedSet[req.Into] {
		writeErr(w, http.StatusNotFound, "target title not found")
		return
	}
	from := []int64{}
	for _, id := range req.From {
		if id != req.Into && ownedSet[id] {
			from = append(from, id)
		}
	}
	if len(from) == 0 {
		writeErr(w, http.StatusBadRequest, "no distinct source titles to merge")
		return
	}

	tx, err := s.Store.DB.Begin()
	if err != nil {
		internalError(w, r, "merge: begin", err)
		return
	}
	defer tx.Rollback()

	genreSet := map[string]bool{}
	union := []string{}
	for _, id := range append([]int64{req.Into}, from...) {
		g, err := genresOf(tx, "movie", id)
		if err != nil {
			internalError(w, r, "merge: read genres", err)
			return
		}
		for _, n := range g {
			if !genreSet[strings.ToLower(n)] {
				genreSet[strings.ToLower(n)] = true
				union = append(union, n)
			}
		}
	}

	// The same debt the book merge owes, for the same reason and with the same
	// one-way rule — see the comment there.
	if intoExcluded, err := workExclusion(tx, "movies", req.Into); err != nil {
		internalError(w, r, "merge: read the target's quiz opt-out", err)
		return
	} else if intoExcluded == 1 {
		srcArgs := make([]any, 0, len(from))
		for _, id := range from {
			srcArgs = append(srcArgs, id)
		}
		if _, err := tx.Exec(
			`UPDATE dialogues SET review_excluded = 1, updated_at = datetime('now')
			 WHERE movie_id IN (`+inClause(len(from))+`)`, srcArgs...); err != nil {
			internalError(w, r, "merge: carry the quiz opt-out", err)
			return
		}
	}

	// Re-point the lines; OR IGNORE skips one that would collide with a line
	// already on the target (it stays on the source and goes with it).
	fromArgs := make([]any, 0, len(from)+1)
	fromArgs = append(fromArgs, req.Into)
	for _, id := range from {
		fromArgs = append(fromArgs, id)
	}
	if _, err := tx.Exec(
		`UPDATE OR IGNORE dialogues SET movie_id = ? WHERE movie_id IN (`+inClause(len(from))+`)`, fromArgs...); err != nil {
		internalError(w, r, "merge: move dialogues", err)
		return
	}

	// The cast, BEFORE the delete, for the reason carryWorkCast argues at length:
	// 0048's trigger reaps a work's cast with the work, so without this a merged-
	// away duplicate takes its voice actors, its corrections and its tombstones
	// with it — and for a game that list is the only place any of them exist.
	if err := carryWorkCast(tx, uid, "movie", req.Into, from); err != nil {
		internalError(w, r, "merge: carry the cast", err)
		return
	}

	delArgs := make([]any, 0, len(from)+1)
	for _, id := range from {
		delArgs = append(delArgs, id)
	}
	delArgs = append(delArgs, uid)
	if _, err := tx.Exec(
		`DELETE FROM movies WHERE id IN (`+inClause(len(from))+`) AND user_id = ?`, delArgs...); err != nil {
		internalError(w, r, "merge: delete sources", err)
		return
	}

	if err := setGenres(tx, "movie", uid, req.Into, union); err != nil {
		internalError(w, r, "merge: set genres", err)
		return
	}
	if err := tx.Commit(); err != nil {
		internalError(w, r, "merge: commit", err)
		return
	}
	// Both kinds — see the header. A merged-away game can orphan a studio.
	s.gcOrphanPeople(uid, "director")
	s.gcOrphanPeople(uid, "studio")
	writeJSON(w, http.StatusOK, map[string]any{"into": req.Into, "merged": len(from)})
}
