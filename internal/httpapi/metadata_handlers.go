// Metadata source management (§10): settings-managed API keys, source status
// for the Settings page, and the admin cover re-fetch maintenance action.

package httpapi

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"tippani/internal/metadata"
)

// Settings-table keys (store.GetSetting/SetSetting).
const (
	settingTMDBKey        = "tmdb_key"
	settingTVDBKey        = "tvdb_key"
	settingGoogleBooksKey = "google_books_key"
	settingAmazonCookie   = "amazon_cookie" // secret: write-only, never echoed
	settingAmazonDomain   = "amazon_domain" // not secret: e.g. www.amazon.com
)


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
// order: direct programmatic key (embedders/tests, set on s.TMDB) >
// settings-table custom key > built-in app key > none. There is no environment
// slot — deployments configure the key in Settings. Returns a nil client when
// no key is available, plus the source enum for /metadata/status and
// /admin/metadata-keys.
func (s *Server) resolveTMDB() (*metadata.TMDB, string) {
	if s.TMDB.Key != "" {
		return s.TMDB, "direct"
	}
	if key, err := s.Store.GetSetting(settingTMDBKey); err == nil && key != "" {
		return &metadata.TMDB{Key: key, BaseURL: s.TMDB.BaseURL}, "custom"
	}
	if s.TMDBBuiltin != "" {
		return &metadata.TMDB{Key: s.TMDBBuiltin, BaseURL: s.TMDB.BaseURL}, "builtin"
	}
	return nil, "none"
}

// resolveTVDB picks the effective TheTVDB client: env key (TIPPANI_TVDB_API_KEY,
// the persistent client whose token is cached) > settings-table key (a fresh
// client) > nil (no built-in — TVDB is opt-in). The second return is the source
// enum for /metadata/status.
func (s *Server) resolveTVDB() (*metadata.TVDB, string) {
	base := ""
	if s.TVDB != nil {
		if s.TVDB.Key != "" {
			return s.TVDB, "env"
		}
		base = s.TVDB.BaseURL
	}
	if key, err := s.Store.GetSetting(settingTVDBKey); err == nil && key != "" {
		return &metadata.TVDB{Key: key, BaseURL: base}, "custom"
	}
	return nil, "none"
}

// handleMetadataStatus implements GET /metadata/status: which TMDB key is in
// effect, whether a Google Books key is saved, and how the last book lookup
// went — the Settings page chips (LOOKUP FAILING etc.) hang off this.
func (s *Server) handleMetadataStatus(w http.ResponseWriter, r *http.Request) {
	_, source := s.resolveTMDB()
	_, tvdbSource := s.resolveTVDB()
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
		"tvdb":         map[string]string{"source": tvdbSource},
		"google_books": map[string]bool{"key_set": gkey != ""},
		"books_lookup": lookup,
	})
}

// handleGetMetadataKeys (admin): booleans only for secrets — stored keys and
// the Amazon cookie are never echoed. The Amazon domain is not secret, so it is
// returned so the field can be pre-filled.
func (s *Server) handleGetMetadataKeys(w http.ResponseWriter, r *http.Request) {
	tkey, err1 := s.Store.GetSetting(settingTMDBKey)
	gkey, err2 := s.Store.GetSetting(settingGoogleBooksKey)
	acookie, err3 := s.Store.GetSetting(settingAmazonCookie)
	adomain, err4 := s.Store.GetSetting(settingAmazonDomain)
	vkey, err5 := s.Store.GetSetting(settingTVDBKey)
	if err1 != nil || err2 != nil || err3 != nil || err4 != nil || err5 != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	_, source := s.resolveTMDB()
	_, tvdbSource := s.resolveTVDB()
	writeJSON(w, http.StatusOK, map[string]any{
		"tmdb_key_set":         tkey != "",
		"tvdb_key_set":         vkey != "",
		"google_books_key_set": gkey != "",
		"amazon_cookie_set":    acookie != "",
		"amazon_domain":        adomain,
		"tmdb_source":          source,
		"tvdb_source":          tvdbSource,
	})
}

// handlePutMetadataKeys (admin) stores the secrets and the Amazon domain. A
// field is only written when present in the body so a partial save (e.g. just
// the Amazon cookie) never clears the others; a present-but-empty string
// clears that one. Secrets take effect on the next lookup.
func (s *Server) handlePutMetadataKeys(w http.ResponseWriter, r *http.Request) {
	// Pointers distinguish "field omitted" (leave as-is) from "" (clear).
	var req struct {
		TMDBKey        *string `json:"tmdb_key"`
		TVDBKey        *string `json:"tvdb_key"`
		GoogleBooksKey *string `json:"google_books_key"`
		AmazonCookie   *string `json:"amazon_cookie"`
		AmazonDomain   *string `json:"amazon_domain"`
	}
	if !decodeBody(w, r, &req) {
		return
	}
	set := func(key string, v *string) error {
		if v == nil {
			return nil
		}
		return s.Store.SetSetting(key, strings.TrimSpace(*v))
	}
	if err := set(settingTMDBKey, req.TMDBKey); err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	if err := set(settingTVDBKey, req.TVDBKey); err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	if err := set(settingGoogleBooksKey, req.GoogleBooksKey); err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	if err := set(settingAmazonCookie, req.AmazonCookie); err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	if err := set(settingAmazonDomain, req.AmazonDomain); err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// handleCoversRefetch implements POST /covers/refetch (admin): for every book
// (and movie) it re-derives whatever is still missing from the latest available
// identifiers and fills empty fields only — never overwriting the user's data.
//
// Books are looked up by ISBN (reliable) and, with an Amazon cookie, by ASIN;
// empty author/description/year/genres are backfilled, and a missing cover is
// pulled from the candidate, Open Library (by ISBN), or Amazon (by ASIN) — every
// path is keyless. A title-only book skips metadata backfill (a bare title match
// is too loose to trust) but still tries a candidate cover. Movies reuse the
// TMDB poster cached at add time. Serial + best-effort across ALL users.
//
// The work is CHUNKED so the client can render real progress: each call
// processes up to `limit` rows starting after `cursor` and returns
// {next_cursor, done, total, remaining} alongside the counters. An empty body
// (or empty cursor) starts from the top; the client loops until done. Chunks
// also keep each HTTP request short, so proxy timeouts and tab navigation
// can no longer silently abort a long run.
func (s *Server) handleCoversRefetch(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	var req struct {
		Cursor string `json:"cursor"`
		Limit  int    `json:"limit"`
	}
	r.Body = http.MaxBytesReader(w, r.Body, 4<<10)
	_ = json.NewDecoder(r.Body).Decode(&req) // absent/empty body = defaults
	if req.Limit <= 0 || req.Limit > 100 {
		req.Limit = 20
	}
	phase, after := "books", int64(0)
	if c := strings.TrimSpace(req.Cursor); c != "" {
		p, aStr, ok := strings.Cut(c, ":")
		a, perr := strconv.ParseInt(aStr, 10, 64)
		if !ok || perr != nil || (p != "books" && p != "movies") {
			writeErr(w, http.StatusBadRequest, "invalid cursor")
			return
		}
		phase, after = p, a
	}

	// total is the full workload at this instant (all books get a backfill
	// pass; only poster-less sourced movies need work). The client captures it
	// from the first response; remaining shrinks as the cursor advances.
	const movieWhere = `poster_path IS NULL AND source_metadata IS NOT NULL`
	var total int
	if err := s.Store.DB.QueryRow(`SELECT (SELECT COUNT(*) FROM books) +
		(SELECT COUNT(*) FROM movies WHERE ` + movieWhere + `)`).Scan(&total); err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}

	gkey, _ := s.Store.GetSetting(settingGoogleBooksKey)
	cookie, _ := s.Store.GetSetting(settingAmazonCookie)
	domain, _ := s.Store.GetSetting(settingAmazonDomain)

	type bookRow struct {
		id, uid    int64
		title      string
		isbn, asin string
		cover      string
		cachedURL  string // cover_url captured in source_metadata at add time
		genreCount int
	}
	var books []bookRow
	rows, err := s.Store.DB.Query(`SELECT id, user_id, title, COALESCE(isbn,''), COALESCE(asin,''),
		COALESCE(cover_path,''), COALESCE(source_metadata,''),
		(SELECT COUNT(*) FROM book_genres bg WHERE bg.book_id = books.id)
		FROM books WHERE ? = 'books' AND id > ? ORDER BY id LIMIT ?`, phase, after, req.Limit)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	for rows.Next() {
		var b bookRow
		var raw string
		if rows.Scan(&b.id, &b.uid, &b.title, &b.isbn, &b.asin, &b.cover, &raw, &b.genreCount) != nil {
			continue
		}
		if raw != "" {
			var meta struct {
				CoverURL string `json:"cover_url"`
			}
			_ = json.Unmarshal([]byte(raw), &meta)
			b.cachedURL = meta.CoverURL
		}
		books = append(books, b)
	}
	rows.Close() // done reading before any writes/network (SQLite single-writer)

	enriched, fetched, failed := 0, 0, 0
	lastID := after
	for _, b := range books {
		lastID = b.id
		isbnN := metadata.NormalizeISBN(b.isbn)

		// Best candidate from the keyless/keyed sources.
		var cand *metadata.BookCandidate
		if isbnN != "" || b.title != "" {
			if cs, _ := s.searchBooks(ctx, isbnN, b.title, gkey); len(cs) > 0 {
				cand = &cs[0]
			}
		}
		if cand == nil && b.asin != "" && cookie != "" {
			if a, aerr := metadata.FetchAmazonBook(ctx, b.asin, cookie, domain); aerr == nil {
				cand = a
			}
		}

		// Metadata backfill (fill-empty), only when the identity is trustworthy.
		if cand != nil && (isbnN != "" || b.asin != "") {
			res, uerr := s.Store.DB.Exec(`UPDATE books SET
				author = COALESCE(author, ?),
				description = COALESCE(description, ?),
				published_year = COALESCE(published_year, ?)
				WHERE id = ? AND (author IS NULL OR description IS NULL OR published_year IS NULL)`,
				nullable(cand.Author), nullable(cand.Description), nullableInt(cand.PublishedYear), b.id)
			if uerr == nil {
				if n, _ := res.RowsAffected(); n > 0 {
					enriched++
				}
			}
			if b.genreCount == 0 && len(cand.Genres) > 0 {
				// Cap fetched genres at 5 per item — suppliers can return a long
				// tail of low-signal tags, and manual entry (which doesn't come
				// through here) is left untouched.
				genres := cand.Genres
				if len(genres) > 5 {
					genres = genres[:5]
				}
				if tx, terr := s.Store.DB.Begin(); terr == nil {
					if setGenres(tx, "book", b.uid, b.id, genres) == nil {
						_ = tx.Commit()
					} else {
						_ = tx.Rollback()
					}
				}
			}
		}

		// Cover, if still missing: add-time URL, then candidate, then OL-by-ISBN,
		// then Amazon-by-ASIN. The cached URL was saved verbatim at add time, so
		// push it through the same hi-res upgrades the fresh builders now apply —
		// otherwise refetch keeps resurrecting old low-res thumbnails.
		if b.cover == "" {
			var urls []string
			if b.cachedURL != "" {
				urls = append(urls, metadata.AmazonFullSizeImage(metadata.GoogleHiResCover(b.cachedURL)))
			}
			if cand != nil {
				urls = append(urls, cand.CoverURL)
			}
			if isbnN != "" {
				urls = append(urls, "https://covers.openlibrary.org/b/isbn/"+isbnN+"-L.jpg?default=false")
			}
			if b.asin != "" {
				urls = append(urls, metadata.AmazonCoverURL(b.asin))
			}
			name := ""
			for _, u := range urls {
				if u == "" {
					continue
				}
				if n, ferr := s.fetchImage(ctx, u, s.coversDir()); ferr == nil {
					name = n
					break
				}
			}
			if name != "" {
				if _, uerr := s.Store.DB.Exec(`UPDATE books SET cover_path = ? WHERE id = ?`, name, b.id); uerr == nil {
					fetched++
				} else {
					s.removeCoverFile(name)
				}
			} else if len(urls) > 0 {
				failed++
			}
		}
	}

	// Movies: fetch the TMDB poster cached at add time (keyless to fetch).
	// Only runs in the movies phase; the cursor advances over movie ids.
	type movieTarget struct {
		id  int64
		url string
	}
	var movies []movieTarget
	mScanned := 0 // chunk fullness = rows scanned, not posters found
	mrows, err := s.Store.DB.Query(`SELECT id, COALESCE(source_metadata, '') FROM movies
		WHERE `+movieWhere+` AND ? = 'movies' AND id > ? ORDER BY id LIMIT ?`, phase, after, req.Limit)
	if err == nil {
		for mrows.Next() {
			var id int64
			var raw string
			if mrows.Scan(&id, &raw) != nil {
				continue
			}
			lastID = id
			mScanned++
			var meta struct {
				PosterPath string `json:"poster_path"`
			}
			_ = json.Unmarshal([]byte(raw), &meta)
			if meta.PosterPath != "" {
				movies = append(movies, movieTarget{id, metadata.TMDBPosterURL(meta.PosterPath)})
			}
		}
		mrows.Close()
	}
	for _, m := range movies {
		name, ferr := s.fetchImage(ctx, m.url, s.coversDir())
		if ferr != nil {
			failed++
			continue
		}
		if _, uerr := s.Store.DB.Exec(`UPDATE movies SET poster_path = ? WHERE id = ?`, name, m.id); uerr == nil {
			fetched++
		} else {
			s.removeCoverFile(name)
			failed++
		}
	}

	// Next cursor: advance within the phase while chunks come back full; a
	// short books chunk hands over to movies, a short movies chunk finishes.
	next := ""
	switch phase {
	case "books":
		if len(books) == req.Limit {
			next = "books:" + strconv.FormatInt(lastID, 10)
		} else {
			next = "movies:0"
		}
	case "movies":
		if mScanned == req.Limit {
			next = "movies:" + strconv.FormatInt(lastID, 10)
		}
	}

	// remaining = rows the NEXT calls will still see; drives the progress bar.
	remaining := 0
	switch {
	case next == "":
		// done
	case strings.HasPrefix(next, "books:"):
		if s.Store.DB.QueryRow(`SELECT (SELECT COUNT(*) FROM books WHERE id > ?) +
			(SELECT COUNT(*) FROM movies WHERE `+movieWhere+`)`, lastID).Scan(&remaining) != nil {
			remaining = 0
		}
	default: // movies:N
		if s.Store.DB.QueryRow(`SELECT COUNT(*) FROM movies WHERE `+movieWhere+` AND id > ?`,
			lastID).Scan(&remaining) != nil {
			remaining = 0
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"fetched": fetched, "failed": failed, "enriched": enriched,
		"next_cursor": next, "done": next == "", "total": total, "remaining": remaining,
	})
}
