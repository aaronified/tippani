package httpapi

import (
	"database/sql"
	"net/http"

	"tippani/internal/olog"
)

// Bulk actions over a selection from the search results (and reusable elsewhere):
// tag a set of annotations/dialogues, or field-correct a set of movies. Books
// already have handleBulkUpdateBooks (metadata_bulk.go); these mirror it. Every
// op is user-scoped and runs in one transaction.

// ownedChildIDs filters ids to rows of `table` (annotations|dialogues) whose
// parent (books|movies) belongs to uid. parentCol is book_id / movie_id and
// parentTable is books / movies — all package constants, never client input.
func (s *Server) ownedChildIDs(table, parentCol, parentTable string, uid int64, ids []int64) ([]int64, error) {
	if len(ids) == 0 {
		return nil, nil
	}
	args := make([]any, 0, len(ids)+1)
	for _, id := range ids {
		args = append(args, id)
	}
	args = append(args, uid)
	rows, err := s.Store.DB.Query(
		`SELECT id FROM `+table+` WHERE id IN (`+inClause(len(ids))+`)
		 AND `+parentCol+` IN (SELECT id FROM `+parentTable+` WHERE user_id = ?)`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []int64
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			olog.Warnf(olog.CodeBulkRowScan, "[bulk] ownedChildIDs row scan failed: %v", err)
			continue
		}
		out = append(out, id)
	}
	if err := rows.Err(); err != nil {
		olog.Warnf(olog.CodeBulkRowScan, "[bulk] ownedChildIDs row iteration failed: %v", err)
		return out, err
	}
	return out, nil
}

// bulkTagReq is the shared shape for tagging/flagging a set of annotations or
// dialogues at once. Only the present fields act; add_tags unions (never
// detaches), favorite sets when non-nil.
type bulkTagReq struct {
	IDs      []int64  `json:"ids"`
	AddTags  []string `json:"add_tags"`
	Favorite *bool    `json:"favorite"`
}

// bulkTag applies a bulkTagReq to owned rows of `kind` (annotation|dialogue).
func (s *Server) bulkTag(w http.ResponseWriter, r *http.Request, kind string) {
	table, parentCol, parentTable := "annotations", "book_id", "books"
	if kind == "dialogue" {
		table, parentCol, parentTable = "dialogues", "movie_id", "movies"
	}
	var req bulkTagReq
	if !decodeBody(w, r, &req) {
		return
	}
	if len(req.IDs) == 0 {
		writeErr(w, http.StatusBadRequest, "nothing selected")
		return
	}
	if len(req.IDs) > 5000 {
		writeErr(w, http.StatusBadRequest, "too many items (max 5000)")
		return
	}
	uid := userID(r)
	owned, err := s.ownedChildIDs(table, parentCol, parentTable, uid, req.IDs)
	if err != nil {
		internalError(w, r, "bulk tag: ownership", err)
		return
	}
	if len(owned) == 0 {
		writeErr(w, http.StatusNotFound, "no matching items")
		return
	}
	addTagsList := cleanNames(req.AddTags)

	tx, err := s.Store.DB.Begin()
	if err != nil {
		internalError(w, r, "bulk tag: begin", err)
		return
	}
	defer tx.Rollback()

	for _, id := range owned {
		if len(addTagsList) > 0 {
			if err := addTags(tx, kind, uid, id, addTagsList); err != nil {
				internalError(w, r, "bulk tag: add tags", err)
				return
			}
		}
	}
	if req.Favorite != nil {
		if err := bulkSetChild(tx, table, "favorite", boolToInt(*req.Favorite), owned); err != nil {
			internalError(w, r, "bulk tag: favorite", err)
			return
		}
	}
	if err := tx.Commit(); err != nil {
		internalError(w, r, "bulk tag: commit", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]int{"updated": len(owned)})
}

// bulkSetChild runs `UPDATE <table> SET <col> = ?, updated_at = now WHERE id IN (ids)`.
// col is a package constant.
func bulkSetChild(tx *sql.Tx, table, col string, val any, ids []int64) error {
	args := make([]any, 0, len(ids)+1)
	args = append(args, val)
	for _, id := range ids {
		args = append(args, id)
	}
	_, err := tx.Exec(
		`UPDATE `+table+` SET `+col+` = ?, updated_at = datetime('now') WHERE id IN (`+inClause(len(ids))+`)`, args...)
	return err
}

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}

func (s *Server) handleBulkTagAnnotations(w http.ResponseWriter, r *http.Request) {
	olog.Tracef("[bulk] handleBulkTagAnnotations uid=%v", userID(r))
	s.bulkTag(w, r, "annotation")
}
func (s *Server) handleBulkTagDialogues(w http.ResponseWriter, r *http.Request) {
	olog.Tracef("[bulk] handleBulkTagDialogues uid=%v", userID(r))
	s.bulkTag(w, r, "dialogue")
}

// handleBulkUpdateMovies mirrors handleBulkUpdateBooks for films/shows: batch
// director / series / genre correction over a selection, one transaction.
func (s *Server) handleBulkUpdateMovies(w http.ResponseWriter, r *http.Request) {
	var req struct {
		IDs         []int64  `json:"ids"`
		Director    *string  `json:"director"`
		Series      *string  `json:"series"`
		SeriesIndex *float64 `json:"series_index"`
		AddGenres   []string `json:"add_genres"`
	}
	if !decodeBody(w, r, &req) {
		return
	}
	if len(req.IDs) == 0 {
		writeErr(w, http.StatusBadRequest, "no titles selected")
		return
	}
	if len(req.IDs) > 2000 {
		writeErr(w, http.StatusBadRequest, "too many titles (max 2000)")
		return
	}
	uid := userID(r)
	olog.Tracef("[bulk] handleBulkUpdateMovies uid=%v ids=%d", uid, len(req.IDs))
	owned, err := s.ownedRowIDs("movies", uid, req.IDs)
	if err != nil {
		internalError(w, r, "bulk movies: ownership", err)
		return
	}
	if len(owned) == 0 {
		writeErr(w, http.StatusNotFound, "no matching titles")
		return
	}
	tx, err := s.Store.DB.Begin()
	if err != nil {
		internalError(w, r, "bulk movies: begin", err)
		return
	}
	defer tx.Rollback()
	set := func(col string, val any) error {
		a := make([]any, 0, len(owned)+2)
		a = append(a, val)
		for _, id := range owned {
			a = append(a, id)
		}
		a = append(a, uid)
		_, err := tx.Exec(`UPDATE movies SET `+col+` = ? WHERE id IN (`+inClause(len(owned))+`) AND user_id = ?`, a...)
		return err
	}
	if req.Director != nil {
		if err := set("director", nullable(*req.Director)); err != nil {
			internalError(w, r, "bulk movies: director", err)
			return
		}
	}
	if req.Series != nil {
		if err := set("series", nullable(*req.Series)); err != nil {
			internalError(w, r, "bulk movies: series", err)
			return
		}
	}
	if req.SeriesIndex != nil {
		if err := set("series_index", nullableFloat(*req.SeriesIndex)); err != nil {
			internalError(w, r, "bulk movies: series_index", err)
			return
		}
	}
	if add := cleanNames(req.AddGenres); len(add) > 0 {
		for _, id := range owned {
			cur, err := genresOf(tx, "movie", id)
			if err != nil {
				internalError(w, r, "bulk movies: read genres", err)
				return
			}
			if err := setGenres(tx, "movie", uid, id, append(cur, add...)); err != nil {
				internalError(w, r, "bulk movies: set genres", err)
				return
			}
		}
	}
	if err := tx.Commit(); err != nil {
		internalError(w, r, "bulk movies: commit", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]int{"updated": len(owned)})
}
