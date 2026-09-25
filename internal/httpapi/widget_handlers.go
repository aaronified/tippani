package httpapi

// A dashboard widget: four numbers behind a read-only key.
//
// Shaped for gethomepage's Custom API widget, which fetches a URL with headers
// of your choosing and maps JSON fields onto up to four blocks — so the answer
// is a flat object of exactly the four things asked for:
//
//	works     books + films/shows/games on the shelves
//	quotes    every quote the app holds, all three kinds
//	forgot    quotes whose dot reads probably-forgotten right now — a lapse on
//	          the last answer, or overdue on the forgetting curve (recallStatus)
//	mastered  quotes that have reached the schedule's top rung and were not
//	          missed since: the same place "start new lines at Mastered" puts a
//	          line (Settings → Review), so the word means one thing in the app
//
// THE KEY IS NOT A DEVICE TOKEN. A device token opens the whole API; a key
// pasted into somebody's dashboard YAML should open four numbers and nothing
// else, so it is its own credential, checked only here.

import (
	"database/sql"
	"errors"
	"net/http"
	"strings"

	"tippani/internal/auth"
)

const widgetKeyPrefix = "tpw_"

func widgetKeyFrom(r *http.Request) string {
	if t, _ := bearerToken(r); t != "" {
		return t
	}
	if k := r.Header.Get("X-API-Key"); k != "" {
		return k
	}
	return r.URL.Query().Get("key")
}

func (s *Server) handleWidget(w http.ResponseWriter, r *http.Request) {
	key := strings.TrimSpace(widgetKeyFrom(r))
	if !strings.HasPrefix(key, widgetKeyPrefix) {
		writeErr(w, http.StatusUnauthorized, "a widget key is required")
		return
	}
	var uid int64
	err := s.Store.DB.QueryRow(`SELECT user_id FROM widget_keys WHERE key_hash = ?`, auth.HashToken(key)).Scan(&uid)
	if errors.Is(err, sql.ErrNoRows) {
		writeErr(w, http.StatusUnauthorized, "unknown widget key")
		return
	}
	if err != nil {
		internalError(w, r, "widget key", err)
		return
	}
	counts, err := s.widgetCounts(uid)
	if err != nil {
		internalError(w, r, "widget counts", err)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusOK, counts)
}

type widgetCounts struct {
	Works    int `json:"works"`
	Quotes   int `json:"quotes"`
	Forgot   int `json:"forgot"`
	Mastered int `json:"mastered"`
}

func (s *Server) widgetCounts(uid int64) (widgetCounts, error) {
	var c widgetCounts
	if err := s.Store.DB.QueryRow(`
		SELECT
		  (SELECT count(*) FROM books WHERE user_id = ?) + (SELECT count(*) FROM movies WHERE user_id = ?),
		  (SELECT count(*) FROM annotations a JOIN books b ON b.id = a.book_id WHERE b.user_id = ?)
		+ (SELECT count(*) FROM dialogues d JOIN movies m ON m.id = d.movie_id WHERE m.user_id = ?)
		+ (SELECT count(*) FROM utterances WHERE user_id = ?)`,
		uid, uid, uid, uid, uid).Scan(&c.Works, &c.Quotes); err != nil {
		return c, err
	}
	states, err := s.reviewStates(uid, allMedia())
	if err != nil {
		return c, err
	}
	c.Forgot = states.ProbablyForgotten
	pf, err := s.loadPrefs(uid)
	if err != nil {
		return c, err
	}
	// One ownership arm per kind, as the Stats page's half-life query does:
	// item_reviews is polymorphic and carries no user_id of its own.
	var arms []string
	args := []any{reviewCeilingFor(pf)}
	for _, rs := range sourcesFor(allMedia()) {
		arms = append(arms, `(r.kind = '`+rs.kind+`' AND r.item_id IN
			(SELECT x.id FROM `+rs.from()+` WHERE `+rs.ownerCol()+` = ?))`)
		args = append(args, uid)
	}
	err = s.Store.DB.QueryRow(`SELECT count(*) FROM item_reviews r
		WHERE r.stability >= ? AND COALESCE(r.last_result, '') <> 'forgot'
		AND (`+strings.Join(arms, " OR ")+`)`, args...).Scan(&c.Mastered)
	return c, err
}

func (s *Server) handleWidgetKeyStatus(w http.ResponseWriter, r *http.Request) {
	var created string
	err := s.Store.DB.QueryRow(`SELECT created_at FROM widget_keys WHERE user_id = ?`, userID(r)).Scan(&created)
	if errors.Is(err, sql.ErrNoRows) {
		writeJSON(w, http.StatusOK, map[string]any{"exists": false})
		return
	}
	if err != nil {
		internalError(w, r, "widget key status", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"exists": true, "created_at": created})
}

// handleWidgetKeyCreate issues a key, replacing any earlier one. The raw key is
// in this response and nowhere else, ever: only its hash is stored.
func (s *Server) handleWidgetKeyCreate(w http.ResponseWriter, r *http.Request) {
	tok, _, err := auth.NewToken()
	if err != nil {
		internalError(w, r, "widget key", err)
		return
	}
	key := widgetKeyPrefix + tok
	if _, err := s.Store.DB.Exec(`INSERT INTO widget_keys (user_id, key_hash) VALUES (?, ?)
		ON CONFLICT(user_id) DO UPDATE SET key_hash = excluded.key_hash, created_at = datetime('now')`,
		userID(r), auth.HashToken(key)); err != nil {
		internalError(w, r, "widget key", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"key": key})
}

func (s *Server) handleWidgetKeyDelete(w http.ResponseWriter, r *http.Request) {
	if _, err := s.Store.DB.Exec(`DELETE FROM widget_keys WHERE user_id = ?`, userID(r)); err != nil {
		internalError(w, r, "widget key", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}
