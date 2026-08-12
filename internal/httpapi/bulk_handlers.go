package httpapi

import (
	"database/sql"
	"fmt"
	"net/http"
	"strings"

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

// bulkTagReq is the shared shape for tagging/flagging/recolouring a set of quotes
// of any of the three kinds. Only the present fields act; add_tags unions (never
// detaches), favorite and color set when non-nil.
//
// Pointer-typed for the same reason every partial update in this app is: a client
// sending one field must not clear the others, and `false` and "not sent" are the
// same JSON at a bool.
type bulkTagReq struct {
	IDs      []int64  `json:"ids"`
	AddTags  []string `json:"add_tags"`
	Favorite *bool    `json:"favorite"`
	// Colour became a six-slot, user-named category in 1.7.1, which made it the
	// single most plausible reason to select forty quotes — and the bulk endpoints
	// could not set it. Validated against the same allowlist validColor uses, so a
	// colour the API accepts is a colour the CHECK constraint accepts.
	Color *string `json:"color"`
}

// quoteBulkKind describes one binnable quote kind for the bulk path: its table,
// and how ownership is established. THE TWO ARE DIFFERENT SHAPES, which is why
// this table exists rather than a triple of string swaps: an annotation and a
// dialogue are CHILD rows owned through their parent work, and a standalone quote
// carries user_id on the row itself. A helper that "parameterised" over all three
// by swapping three names would silently produce a query matching nothing — a bulk
// action that reports success and does nothing.
type quoteBulkKind struct {
	Table       string
	ParentCol   string // "" when the row is owned directly
	ParentTable string
}

var quoteBulkKinds = map[string]quoteBulkKind{
	"annotation": {Table: "annotations", ParentCol: "book_id", ParentTable: "books"},
	"dialogue":   {Table: "dialogues", ParentCol: "movie_id", ParentTable: "movies"},
	"utterance":  {Table: "utterances"},
}

// bulkTag applies a bulkTagReq to owned rows of `kind`
// (annotation|dialogue|utterance).
func (s *Server) bulkTag(w http.ResponseWriter, r *http.Request, kind string) {
	spec, ok := quoteBulkKinds[kind]
	if !ok {
		internalError(w, r, "bulk tag", fmt.Errorf("unknown kind %q", kind))
		return
	}
	table := spec.Table
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
	if req.Color != nil && !validColor(*req.Color) {
		writeErr(w, http.StatusBadRequest, "invalid color")
		return
	}
	uid := userID(r)
	// The ownership query follows the shape of the kind, not a swapped table name:
	// a child row is reached through its parent, a standalone quote is not. Both
	// directions get a test, because an ownership filter that matches nothing is a
	// bulk action that reports success and does nothing, and one that matches
	// everything is somebody else's library.
	var owned []int64
	var err error
	if spec.ParentCol == "" {
		owned, err = s.ownedRowIDs(table, uid, req.IDs)
	} else {
		owned, err = s.ownedChildIDs(table, spec.ParentCol, spec.ParentTable, uid, req.IDs)
	}
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
	if req.Color != nil {
		if err := bulkSetChild(tx, table, "color", *req.Color, owned); err != nil {
			internalError(w, r, "bulk tag: color", err)
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

// handleBulkTagQuotes is the fifth bulk endpoint, and the one that was missing:
// annotations and dialogues had one, standalone quotes did not, so a selection on
// the Quotes screen had nothing to post to.
func (s *Server) handleBulkTagQuotes(w http.ResponseWriter, r *http.Request) {
	olog.Tracef("[bulk] handleBulkTagQuotes uid=%v", userID(r))
	s.bulkTag(w, r, "utterance")
}

// handleBulkUpdateMovies mirrors handleBulkUpdateBooks for films/shows: batch
// director / series / genre correction over a selection, one transaction.
//
// NO COLOUR HERE, deliberately: a colour category is a note about a QUOTE, and a
// work has never had one. The three quote endpoints take it; these two take the
// fields a work has instead.
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
		_, err := tx.Exec(`UPDATE movies SET `+col+` = ?, updated_at = datetime('now') WHERE id IN (`+inClause(len(owned))+`) AND user_id = ?`, a...)
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

// ---- bulk delete ------------------------------------------------------------
//
// LAST, ALONE, AND UNREACHABLE BY GESTURE. It is the only path in the app that
// removes many things at once, so it is reached only by selecting, then pressing
// Delete in the selection bar, then typing what it will do. Never from the context
// menu, never from a swipe.
//
// It routes every item through the same collect-then-delete the single deletes use,
// and writes ONE bin entry for the whole selection — so the whole thing is one
// Undo, recoverable for the retention window because 1.8.0 shipped first.

// handleBulkDelete deletes a selection of one quote kind.
func (s *Server) handleBulkDelete(w http.ResponseWriter, r *http.Request, kind string) {
	var req struct {
		IDs     []int64 `json:"ids"`
		Confirm string  `json:"confirm"`
	}
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
	olog.Tracef("[bulk] handleBulkDelete kind=%s uid=%v ids=%d", kind, uid, len(req.IDs))

	spec, ok := quoteBulkKinds[kindKeyFor(kind)]
	if !ok {
		internalError(w, r, "bulk delete", fmt.Errorf("unknown kind %q", kind))
		return
	}
	var owned []int64
	var err error
	if spec.ParentCol == "" {
		owned, err = s.ownedRowIDs(spec.Table, uid, req.IDs)
	} else {
		owned, err = s.ownedChildIDs(spec.Table, spec.ParentCol, spec.ParentTable, uid, req.IDs)
	}
	if err != nil {
		internalError(w, r, "bulk delete: ownership", err)
		return
	}
	if len(owned) == 0 {
		writeErr(w, http.StatusNotFound, "no matching items")
		return
	}
	// THE COUNT IN THE PHRASE IS THE OWNED COUNT, not the requested one. Otherwise a
	// selection holding one id that is not yours would refuse every phrase a reader
	// could possibly type, with no way to find out why.
	want := bulkDeletePhrase(kind, len(owned))
	if !strings.EqualFold(strings.TrimSpace(req.Confirm), want) {
		writeErr(w, http.StatusBadRequest, "type “"+want+"” to confirm")
		return
	}

	tx, err := s.Store.DB.Begin()
	if err != nil {
		internalError(w, r, "bulk delete: begin", err)
		return
	}
	defer tx.Rollback()
	trashID, done, err := s.binSelection(tx, uid, kind, owned)
	if err != nil {
		olog.Warnf(olog.CodeTrashWrite, "[trash] could not bin a selection of %d %s: %v", len(owned), kind, err)
		internalError(w, r, "bulk delete: bin it first", err)
		return
	}
	if err := tx.Commit(); err != nil {
		internalError(w, r, "bulk delete: commit", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"deleted": done, "trash_id": trashID})
}

// kindKeyFor maps the bin's kind word to the bulk table key. The two vocabularies
// differ by one word — the bin says 'quote' for a standalone quote and the bulk
// tables say 'utterance', after the table — and this is the one place that has to
// know it.
func kindKeyFor(kind string) string {
	if kind == "quote" {
		return "utterance"
	}
	return kind
}

func (s *Server) handleBulkDeleteAnnotations(w http.ResponseWriter, r *http.Request) {
	s.handleBulkDelete(w, r, "annotation")
}
func (s *Server) handleBulkDeleteDialogues(w http.ResponseWriter, r *http.Request) {
	s.handleBulkDelete(w, r, "dialogue")
}
func (s *Server) handleBulkDeleteQuotes(w http.ResponseWriter, r *http.Request) {
	s.handleBulkDelete(w, r, "quote")
}
