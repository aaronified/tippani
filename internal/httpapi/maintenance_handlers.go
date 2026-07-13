package httpapi

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"

	"tippani/internal/olog"
)

// handleReindexFTS force-rebuilds every full-text search index from its content
// table (POST /admin/search/reindex, admin). Non-destructive: no library data is
// touched, only the derived search indexes — the recommended fix when search
// returns "internal error" from a corrupt index. Returns {ok, failed:[…]}; a
// non-empty `failed` means those indexes were too damaged to rebuild in place
// and a full reset is the remaining option.
func (s *Server) handleReindexFTS(w http.ResponseWriter, r *http.Request) {
	olog.Printf("[admin] search reindex requested by user %d (%s)", userID(r), username(r))
	failed := s.Store.ReindexFTS()
	// ReindexFTS may escalate to a whole-database Recover, which swaps the DB
	// handle — repoint the session store at the current one.
	s.Sessions.DB = s.Store.DB
	if failed == nil {
		failed = []string{}
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": len(failed) == 0, "failed": failed})
}

// handleResetDatabase is the factory reset behind Profile → "Reset all data"
// (POST /admin/reset, admin). It requires {"confirm":"RESET"} so a stray POST
// can't wipe everything, then deletes the database files and re-initialises an
// empty schema (see store.Reset) — every user, session, setting, preference and
// all library content is gone and the app returns to first-run onboarding. It
// also clears the orphaned cover/poster/avatar files and expires the caller's
// session cookie.
func (s *Server) handleResetDatabase(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Confirm string `json:"confirm"`
	}
	_ = json.NewDecoder(r.Body).Decode(&req)
	if req.Confirm != "RESET" {
		writeErr(w, http.StatusBadRequest, `confirmation required: send {"confirm":"RESET"}`)
		return
	}
	olog.Alertf("[admin] FACTORY RESET requested by user %d (%s) — deleting ALL data and settings", userID(r), username(r))

	if err := s.Store.Reset(); err != nil {
		internalError(w, r, "reset database", err)
		return
	}
	// The session store captured the OLD *sql.DB at construction; repoint it at
	// the fresh handle so auth works against the new database.
	s.Sessions.DB = s.Store.DB

	// Drop orphaned media (covers/posters/avatars) — the rows that referenced
	// them are gone, so a true reset clears them too. Best-effort.
	mediaDir := filepath.Join(s.DataDir, "MediaCover")
	if err := os.RemoveAll(mediaDir); err != nil {
		olog.Alertf("[reset] could not remove media dir %s: %v (orphaned image files remain)", mediaDir, err)
	} else {
		olog.Printf("[reset] cleared media directory %s", mediaDir)
	}

	// Expire the caller's cookie; their session no longer exists and the app
	// will show first-run onboarding (users table is empty).
	http.SetCookie(w, s.sessionCookie("", -1))
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}
