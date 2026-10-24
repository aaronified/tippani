package httpapi

// The prune: keep the context, throw the file away.
//
// A file is scaffolding. It earns its space while quotes are still arriving, and once they stop
// it is 1.4 MB holding 50 KB of usefulness (measured: 29x smaller for an ebook, 12.8x for a
// subtitle, so the screen does not oversell it for subtitles).
//
// Context is STORED when a file is attached (source_context), so every quote that has context
// keeps it: the rows are the read path and the file never was one. What a prune gives up is the
// ability to make NEW rows, and that is one sentence, said once, before it is pressed: nothing
// new can be derived until the file is added again. It is recoverable, not reversible from
// inside the app: add the file again and everything resumes (the sha256 on the row says whether
// it is the same file, so the kept context is still true, or another edition, in which case the
// kept rows are re-derived and never merged with it).
//
// ONE PASS, IN ONE REQUEST, no goroutine. Before the bytes go, the stored file is read once more
// and every quote that has no context yet is cut, so the prune keeps as much as there is to keep.
// Then the row's path is emptied and pruned_at stamped; THE ROW STAYS, because it is the only
// record that this work ever had a source, which is what lets the panel say "re-add the file"
// and not "no source".
//
// NOTHING PRUNES ON ITS OWN. No age threshold, no size trigger, no sweep, nothing on a timer: it
// destroys something on the reader's behalf and the reader presses it. A mounted source has no
// bytes of ours, so prune is ABSENT for it (409 here), and the context was already stored.

import (
	"database/sql"
	"errors"
	"net/http"
	"os"
	"path/filepath"

	"tippani/internal/olog"
)

// pruneRow is what a prune would do to one source, said before it is pressed.
type pruneRow struct {
	ID      int64  `json:"id"`
	Subject string `json:"subject"`
	WorkID  int64  `json:"work_id"`
	Title   string `json:"title"`
	Episode string `json:"episode,omitempty"`
	Name    string `json:"name"`
	Bytes   int64  `json:"bytes"`
	// KeptBytes is what the stored context takes up: what is left of the file's usefulness.
	KeptBytes int64 `json:"kept_bytes"`
	// WithContext quotes keep their surroundings; WithoutContext ones had none to keep (not placed
	// in the file), and the prune does not invent a location.
	WithContext    int    `json:"with_context"`
	WithoutContext int    `json:"without_context"`
	LastQuoteAt    string `json:"last_quote_at"`
	State          string `json:"state"`
}

// listPrunable lists the reader's uploaded sources that still hold their bytes, biggest first
// (what the prune frees), with what each would keep. LastQuoteAt is the column that makes the
// decision: a work nobody has added to in six months is the one to prune, and that is the
// reader's judgement, not a rule the app applies.
func (s *Server) listPrunable(uid int64, only int64) ([]pruneRow, error) {
	q := `SELECT ws.id, ws.subject, ws.subject_id, ws.subject_key, ws.name, ws.bytes, ws.pruned_at,
	             COALESCE(b.title, m.title, ws.subject_key, '')
	      FROM work_sources ws
	      LEFT JOIN books  b ON ws.subject = 'book'   AND b.id = ws.subject_id
	      LEFT JOIN movies m ON ws.subject = 'screen' AND m.id = ws.subject_id
	      WHERE ws.user_id = ? AND ws.origin = 'upload' AND ws.path != ''`
	args := []any{uid}
	if only > 0 {
		q += ` AND ws.id = ?`
		args = append(args, only)
	}
	q += ` ORDER BY ws.bytes DESC, ws.id`
	rows, err := s.Store.DB.Query(q, args...)
	if err != nil {
		return nil, err
	}
	var out []pruneRow
	type meta struct{ key, pruned string }
	metas := map[int64]meta{}
	for rows.Next() {
		var p pruneRow
		var key, pruned string
		if err := rows.Scan(&p.ID, &p.Subject, &p.WorkID, &key, &p.Name, &p.Bytes, &pruned, &p.Title); err != nil {
			rows.Close()
			return nil, err
		}
		if p.Subject == sourceScreen {
			p.Episode = key
		}
		p.State = "file"
		metas[p.ID] = meta{key, pruned}
		out = append(out, p)
	}
	rows.Close()
	for i := range out {
		p := &out[i]
		if err := s.Store.DB.QueryRow(
			`SELECT count(*), COALESCE(sum(length(before) + length(body) + length(after)), 0)
			 FROM source_context WHERE source_id = ?`, p.ID).Scan(&p.WithContext, &p.KeptBytes); err != nil {
			return nil, err
		}
		quotes, err := s.quotesOfSource(uid, p.Subject, p.WorkID, metas[p.ID].key)
		if err != nil {
			return nil, err
		}
		p.WithoutContext = max(0, len(quotes)-p.WithContext)
		p.LastQuoteAt = s.lastQuoteAt(uid, p.Subject, p.WorkID)
	}
	return out, nil
}

// lastQuoteAt is when a quote was last added to the work, "" for none.
func (s *Server) lastQuoteAt(uid int64, subject string, workID int64) string {
	var at sql.NullString
	switch subject {
	case sourceBook:
		_ = s.Store.DB.QueryRow(`SELECT max(created_at) FROM annotations WHERE book_id = ?`, workID).Scan(&at)
	case sourceScreen:
		_ = s.Store.DB.QueryRow(`SELECT max(created_at) FROM dialogues WHERE movie_id = ?`, workID).Scan(&at)
	}
	return at.String
}

// handleSourceStack: GET /sources/stack — every attached file the reader could prune, biggest first.
func (s *Server) handleSourceStack(w http.ResponseWriter, r *http.Request) {
	list, err := s.listPrunable(userID(r), 0)
	if err != nil {
		internalError(w, r, "source stack", err)
		return
	}
	if list == nil {
		list = []pruneRow{}
	}
	var total int64
	for _, p := range list {
		total += p.Bytes - p.KeptBytes
	}
	writeJSON(w, http.StatusOK, map[string]any{"sources": list, "frees": max(total, 0)})
}

// handlePruneSource: GET /sources/{id}/prune previews, POST /sources/{id}/prune does it.
func (s *Server) handlePruneSource(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		writeErr(w, http.StatusBadRequest, "invalid source id")
		return
	}
	uid := userID(r)
	var origin, path, pruned string
	var src sourceKey
	err := s.Store.DB.QueryRow(
		`SELECT id, subject, subject_id, subject_key, format, path, origin, pruned_at FROM work_sources WHERE id = ? AND user_id = ?`,
		id, uid).Scan(&src.id, &src.subject, &src.subjectID, &src.key, &src.format, &path, &origin, &pruned)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		writeErr(w, http.StatusNotFound, "source not found")
		return
	case err != nil:
		internalError(w, r, "prune source", err)
		return
	}
	if origin != "upload" {
		// Absent, not disabled: a mounted file's bytes are the operator's, on their disk, and the
		// context was stored when it was attached, so there is nothing of ours to remove.
		writeErr(w, http.StatusConflict, "a mounted file has nothing to prune: its bytes are not ours")
		return
	}
	if path == "" || pruned != "" {
		writeErr(w, http.StatusConflict, "this file has already been pruned")
		return
	}
	if r.Method == http.MethodGet {
		list, err := s.listPrunable(uid, id)
		if err != nil || len(list) != 1 {
			internalError(w, r, "prune preview", errors.New("could not read the preview"))
			return
		}
		writeJSON(w, http.StatusOK, list[0])
		return
	}

	// Cut context for any quote that has none yet while the file is still here, so the prune
	// keeps as much as there is to keep. A file that can no longer be read still prunes: its
	// bytes were already unusable.
	src.path = path
	if data, err := s.readSourceFile(path); err == nil {
		if _, err := s.extractContext(uid, src, data); err != nil {
			olog.Printf("[sources] prune %d: final context pass: %v", id, err)
		}
	}
	// The row first, then the bytes: a row that says pruned over a file that is still there is
	// untidy and the orphan sweep finds it; a file gone over a row that still names it is a work
	// that says it has a file and cannot read it.
	if _, err := s.Store.DB.Exec(
		`UPDATE work_sources SET path = '', pruned_at = datetime('now') WHERE id = ? AND user_id = ?`, id, uid); err != nil {
		internalError(w, r, "prune source: write", err)
		return
	}
	if sourceFile.MatchString(path) {
		_ = os.Remove(filepath.Join(s.sourcesDir(), path))
	}
	list, _ := s.contextCount(id)
	writeJSON(w, http.StatusOK, map[string]any{"pruned": true, "kept": list})
}

func (s *Server) contextCount(sourceID int64) (int, error) {
	var n int
	err := s.Store.DB.QueryRow(`SELECT count(*) FROM source_context WHERE source_id = ?`, sourceID).Scan(&n)
	return n, err
}
