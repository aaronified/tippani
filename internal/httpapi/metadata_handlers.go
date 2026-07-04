// Metadata source management (§10): settings-managed API keys, source status
// for the Settings page, and the admin cover re-fetch maintenance action.

package httpapi

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"tippani/internal/metadata"
)

// Settings-table keys (store.GetSetting/SetSetting).
const (
	settingTMDBKey        = "tmdb_key"
	settingGoogleBooksKey = "google_books_key"
)

// tmdbPosterBase rebuilds poster URLs from the poster_path cached in a
// movie's raw TMDB payload (same size the pick-time fetch uses).
const tmdbPosterBase = "https://image.tmdb.org/t/p/w342"

// lookupOutcome is the in-memory record of the most recent POST /books/lookup
// (surfaced by GET /metadata/status; a nil pointer = never tried). Not
// persisted on purpose — it describes the running process, not the library.
type lookupOutcome struct {
	OK        bool
	Error     string
	CheckedAt string // RFC3339
}

func (s *Server) recordBooksLookup(err error) {
	rec := &lookupOutcome{OK: err == nil, CheckedAt: time.Now().UTC().Format(time.RFC3339)}
	if err != nil {
		rec.Error = strings.ReplaceAll(err.Error(), "\n", "; ")
	}
	s.booksLookup.Store(rec)
}

// resolveTMDB picks the effective TMDB client per request, in the PLAN §6
// order: env var (TIPPANI_TMDB_API_KEY) > settings-table custom key >
// built-in app key > none. Returns a nil client when no key is available,
// plus the source enum for /metadata/status and /admin/metadata-keys.
func (s *Server) resolveTMDB() (*metadata.TMDB, string) {
	if s.TMDB.Key != "" {
		return s.TMDB, "env"
	}
	if key, err := s.Store.GetSetting(settingTMDBKey); err == nil && key != "" {
		return &metadata.TMDB{Key: key, BaseURL: s.TMDB.BaseURL}, "custom"
	}
	if s.TMDBBuiltin != "" {
		return &metadata.TMDB{Key: s.TMDBBuiltin, BaseURL: s.TMDB.BaseURL}, "builtin"
	}
	return nil, "none"
}

// handleMetadataStatus implements GET /metadata/status: which TMDB key is in
// effect, whether a Google Books key is saved, and how the last book lookup
// went — the Settings page chips (LOOKUP FAILING etc.) hang off this.
func (s *Server) handleMetadataStatus(w http.ResponseWriter, r *http.Request) {
	_, source := s.resolveTMDB()
	gkey, err := s.Store.GetSetting(settingGoogleBooksKey)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	lookup := map[string]any{"ok": nil, "error": "", "checked_at": ""}
	if rec := s.booksLookup.Load(); rec != nil {
		lookup["ok"], lookup["error"], lookup["checked_at"] = rec.OK, rec.Error, rec.CheckedAt
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"tmdb":         map[string]string{"source": source},
		"google_books": map[string]bool{"key_set": gkey != ""},
		"books_lookup": lookup,
	})
}

// handleGetMetadataKeys (admin): booleans only — stored keys are never echoed.
func (s *Server) handleGetMetadataKeys(w http.ResponseWriter, r *http.Request) {
	tkey, err1 := s.Store.GetSetting(settingTMDBKey)
	gkey, err2 := s.Store.GetSetting(settingGoogleBooksKey)
	if err1 != nil || err2 != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	_, source := s.resolveTMDB()
	writeJSON(w, http.StatusOK, map[string]any{
		"tmdb_key_set":         tkey != "",
		"google_books_key_set": gkey != "",
		"tmdb_source":          source,
	})
}

// handlePutMetadataKeys (admin) stores both keys; "" clears one. Takes effect
// on the next lookup — resolveTMDB reads the settings table per request.
func (s *Server) handlePutMetadataKeys(w http.ResponseWriter, r *http.Request) {
	var req struct {
		TMDBKey        string `json:"tmdb_key"`
		GoogleBooksKey string `json:"google_books_key"`
	}
	if !decodeBody(w, r, &req) {
		return
	}
	if err := s.Store.SetSetting(settingTMDBKey, strings.TrimSpace(req.TMDBKey)); err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	if err := s.Store.SetSetting(settingGoogleBooksKey, strings.TrimSpace(req.GoogleBooksKey)); err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// handleCoversRefetch implements POST /covers/refetch (admin maintenance):
// re-fetch missing covers/posters for ALL users' rows from the URL cached in
// source_metadata at pick time. Serial and best-effort per row — a dead URL
// just counts as failed; rows with no usable URL are skipped entirely.
func (s *Server) handleCoversRefetch(w http.ResponseWriter, r *http.Request) {
	type target struct {
		table, column string
		id            int64
		url           string
	}
	var targets []target

	collect := func(query string, urlOf func(raw string) string, table, column string) error {
		rows, err := s.Store.DB.Query(query)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var id int64
			var raw string
			if rows.Scan(&id, &raw) != nil {
				continue
			}
			if u := urlOf(raw); u != "" {
				targets = append(targets, target{table, column, id, u})
			}
		}
		return rows.Err()
	}

	// Books: source_metadata is the raw POST /books body -> its cover_url.
	err := collect(`SELECT id, source_metadata FROM books
		WHERE cover_path IS NULL AND source_metadata IS NOT NULL`,
		func(raw string) string {
			var meta struct {
				CoverURL string `json:"cover_url"`
			}
			_ = json.Unmarshal([]byte(raw), &meta)
			return meta.CoverURL
		}, "books", "cover_path")
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	// Movies: source_metadata is the raw TMDB details payload -> poster_path.
	err = collect(`SELECT id, source_metadata FROM movies
		WHERE poster_path IS NULL AND source_metadata IS NOT NULL`,
		func(raw string) string {
			var meta struct {
				PosterPath string `json:"poster_path"`
			}
			_ = json.Unmarshal([]byte(raw), &meta)
			if meta.PosterPath == "" {
				return ""
			}
			return tmdbPosterBase + meta.PosterPath
		}, "movies", "poster_path")
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}

	fetched, failed := 0, 0
	for _, tg := range targets {
		name, err := s.fetchImage(r.Context(), tg.url, s.coversDir())
		if err != nil {
			failed++
			continue
		}
		if _, err := s.Store.DB.Exec(
			`UPDATE `+tg.table+` SET `+tg.column+` = ? WHERE id = ?`, name, tg.id); err != nil {
			s.removeCoverFile(name)
			failed++
			continue
		}
		fetched++
	}
	writeJSON(w, http.StatusOK, map[string]int{"fetched": fetched, "failed": failed})
}
