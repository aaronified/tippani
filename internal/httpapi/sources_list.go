package httpapi

import (
	"net/http"
)

// handleListSources: GET /sources/all — every source file this reader has attached, one
// row each, with how many quotes it gave context to. Metadata > Source files reads this
// once instead of asking every work in turn. Read only: no bytes and no paths leave, as
// with GET /sources.
func (s *Server) handleListSources(w http.ResponseWriter, r *http.Request) {
	uid := userID(r)
	rows, err := s.Store.DB.Query(
		`SELECT `+sourceCols+` FROM work_sources WHERE user_id = ? ORDER BY subject, subject_id, subject_key, role`, uid)
	if err != nil {
		internalError(w, r, "list sources", err)
		return
	}
	type listedSource struct {
		workSourceRow
		WithContext int `json:"with_context"`
	}
	out := []listedSource{}
	for rows.Next() {
		row, _, err := scanSource(rows)
		if err != nil {
			rows.Close()
			internalError(w, r, "list sources: scan", err)
			return
		}
		out = append(out, listedSource{workSourceRow: row})
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		internalError(w, r, "list sources: rows", err)
		return
	}

	counts := map[int64]int{}
	crows, err := s.Store.DB.Query(`SELECT source_id, COUNT(*) FROM source_context WHERE user_id = ? GROUP BY source_id`, uid)
	if err != nil {
		internalError(w, r, "list sources: context", err)
		return
	}
	for crows.Next() {
		var id int64
		var n int
		if err := crows.Scan(&id, &n); err == nil {
			counts[id] = n
		}
	}
	crows.Close()

	// A mounted file is checked on disk, as GET /sources does, after the reads are closed.
	for i := range out {
		out[i].WithContext = counts[out[i].ID]
		if out[i].Origin == "mount" && out[i].State == "file" {
			out[i].State = s.mountedState(uid, out[i].ID)
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"sources": out})
}
