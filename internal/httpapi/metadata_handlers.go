// Metadata source management (§10): settings-managed API keys, source status
// for the Settings page, and the admin cover re-fetch maintenance action.

package httpapi

import (
	"encoding/json"
	"errors"
	"image"
	_ "image/gif"  // register decoders: coverWidth reads stored art headers
	_ "image/jpeg" //
	_ "image/png"  //
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"tippani/internal/metadata"
	"tippani/internal/olog"
	"tippani/internal/store"
)

// lowResCoverWidth is the replace threshold for stored art: anything narrower
// almost certainly came from the thumbnail-sized provider URLs used before the
// hi-res fetch fix. Refetch re-pulls those and swaps only for a wider image.
const lowResCoverWidth = 500

// coverWidth reads the pixel width of a stored cover/poster; 0 = unknown
// (missing file, or a format DecodeConfig can't read, e.g. webp/svg).
func (s *Server) coverWidth(name string) int {
	f, err := os.Open(filepath.Join(s.coversDir(), name))
	if err != nil {
		return 0
	}
	defer f.Close()
	cfg, _, err := image.DecodeConfig(f)
	if err != nil {
		return 0
	}
	return cfg.Width
}

// Settings-table keys (store.GetSetting/SetSetting).
const (
	settingTMDBKey = "tmdb_key"
	settingTVDBKey = "tvdb_key"
	// THE OTHER HALF OF A FREE TheTVDB CREDENTIAL. A user-supported key logs in
	// only with the subscriber's PIN beside it; a project key needs none. Stored
	// write-only like every other secret — it is a number that stands for a
	// paid subscription.
	settingTVDBPIN        = "tvdb_pin"
	settingIGDBClientID   = "igdb_client_id" // not secret on its own, but stored write-only with its partner
	settingIGDBSecret     = "igdb_secret"    // secret: write-only, never echoed
	settingGoogleBooksKey = "google_books_key"
	settingAmazonCookie   = "amazon_cookie" // secret: write-only, never echoed
	settingAmazonDomain   = "amazon_domain" // not secret: e.g. www.amazon.com
	// GOOGLE'S CUSTOM SEARCH KEY AND ENGINE ID USED TO LIVE HERE. Google closed
	// that API to new customers and set it to retire on 1 January 2027, so the two
	// fields asked readers to register for something they could not get and would
	// then lose. The remaining Google path is the results-page scrape below, whose
	// opt-in is a setting rather than a credential because it needs none.
	// THE OPT-IN FOR SCRAPING GOOGLE'S IMAGE RESULTS, which is a SETTING and not
	// a credential because scraping Google needs none. Every other opt-in in this
	// block doubles as the permission — you cannot use the Amazon scrape without
	// storing the cookie that says you meant to. This one has nothing to store,
	// so the agreement has to be recorded on its own. Not a secret: it is a
	// boolean ("1"), and it is echoed.
	settingGoogleScrape = "google_image_scrape"
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

// resolveTVDB picks the effective TheTVDB client: a direct programmatic key
// (embedders/tests, set on s.TVDB) > the settings-table key (a fresh client) >
// the built-in project key > nil. Like TMDB there is no environment slot; the
// key is configured in Settings. The second return is the source enum for
// /metadata/status.
func (s *Server) resolveTVDB() (*metadata.TVDB, string) {
	base := ""
	if s.TVDB != nil {
		if s.TVDB.Key != "" {
			return s.TVDB, "direct"
		}
		base = s.TVDB.BaseURL
	}
	if key, err := s.Store.GetSetting(settingTVDBKey); err == nil && key != "" {
		pin, _ := s.Store.GetSetting(settingTVDBPIN)
		return &metadata.TVDB{Key: key, PIN: pin, BaseURL: base}, "custom"
	}
	// The built-in, which is a PROJECT key and therefore needs no PIN — see
	// defaultTVDBKey. A reader's own key wins over it above, and a reader's PIN
	// belongs to their key rather than to this one, so it is deliberately not
	// read here: half a credential is how a working supplier becomes a 401.
	if s.TVDBBuiltin != "" {
		return &metadata.TVDB{Key: s.TVDBBuiltin, BaseURL: base}, "builtin"
	}
	return nil, "none"
}

// resolveIGDB returns the games client to use, or nil when no COMPLETE pair of
// credentials is available, plus the source enum for /metadata/status.
//
// The pair is atomic on purpose. IGDB needs a Twitch client id and a client
// secret, and half a pair fails at the token exchange with Twitch's "invalid
// client" — which arrives as a lookup failure rather than as a missing key, so
// the reader is told the lookup broke when the truth is that one field is blank.
// Treating the pair as one setting turns that into the honest 503.
//
// There is no built-in fallback, unlike TMDB: the credentials are per-application
// and rate-limited to 4 req/s, so a shared key would be a shared quota.
func (s *Server) resolveIGDB() (*metadata.IGDB, string) {
	base, tokenURL := "", ""
	if s.IGDB != nil {
		if s.IGDB.ClientID != "" && s.IGDB.ClientSecret != "" {
			return s.IGDB, "direct"
		}
		base, tokenURL = s.IGDB.BaseURL, s.IGDB.TokenURL
	}
	id, err1 := s.Store.GetSetting(settingIGDBClientID)
	secret, err2 := s.Store.GetSetting(settingIGDBSecret)
	if err1 == nil && err2 == nil && id != "" && secret != "" {
		return &metadata.IGDB{ClientID: id, ClientSecret: secret, BaseURL: base, TokenURL: tokenURL}, "custom"
	}
	return nil, "none"
}

// handleMetadataStatus implements GET /metadata/status: which TMDB key is in
// effect, whether a Google Books key is saved, and how the last book lookup
// went — the Settings page chips (LOOKUP FAILING etc.) hang off this.
func (s *Server) handleMetadataStatus(w http.ResponseWriter, r *http.Request) {
	olog.Tracef("[meta] handleMetadataStatus")
	_, source := s.resolveTMDB()
	_, tvdbSource := s.resolveTVDB()
	gkey, err := s.Store.GetSetting(settingGoogleBooksKey)
	if err != nil {
		internalError(w, r, "load google books key", err)
		return
	}
	lookup := map[string]any{"ok": nil, "error": "", "checked_at": ""}
	if rec := s.booksLookup.Load(); rec != nil {
		lookup["ok"], lookup["error"], lookup["checked_at"] = rec.OK, rec.Error, rec.CheckedAt
	}
	_, igdbSource := s.resolveIGDB()
	out := map[string]any{
		"tmdb":         map[string]string{"source": source},
		"tvdb":         map[string]string{"source": tvdbSource},
		"igdb":         map[string]string{"source": igdbSource},
		"igdb_key_set": igdbSource != "none",
		"google_books": map[string]bool{"key_set": gkey != ""},
		"books_lookup": lookup,
		// Whether POST /images/search has any supplier behind it. Reported HERE
		// rather than only on the admin keys endpoint, because the pickers that
		// ask the question — a cover, a poster, a portrait — are used by every
		// reader and none of them can see a key.
		"image_search": s.imageSearchConfigured(r.Context()),
	}
	if n := s.filmSourceNotice(userID(r)); n != nil {
		out["film_source_notice"] = n
	}
	writeJSON(w, http.StatusOK, out)
}

// filmSourceNotice answers "does this reader need telling that the default film
// source moved, and is it still about anything?" — nil when either half is no.
//
// TWO FACTS, AND BOTH ARE REQUIRED. The marker in `settings` is an INSTANCE fact
// written once by the 2.2.0 one-time pass (store/onetime_2_2_0_tvdb_default.go):
// this database existed before the default moved. Without it, a library where
// somebody has deliberately pinned things to TMDB since would be nagged about a
// change they never lived through. The count is a PER-USER fact and it is what
// makes the notice self-clearing: it is the number of that reader's films and
// shows still pinned to TMDB alone, so re-verifying the last one ends the notice
// with nothing to dismiss and no dismissal to store.
//
// Scoped by user_id like every other query here, which also means one reader
// finishing their library does not silence the notice for anybody else.
//
// A FAILURE IS NOT AN ERROR FOR THE CALLER. This is one advisory line on a
// settings card; failing the whole status response over it would take the page
// with it. The read is logged and the notice omitted.
func (s *Server) filmSourceNotice(uid int64) map[string]any {
	since, err := s.Store.GetSetting(store.SettingFilmSourceNotice)
	if err != nil || since == "" {
		if err != nil {
			olog.Warnf(olog.CodeStoreOneTimePass,
				"[meta] film-source notice marker unreadable: %v", err)
		}
		return nil
	}
	var pinned int
	if err := s.Store.DB.QueryRow(
		`SELECT COUNT(*) FROM movies
		 WHERE user_id = ? AND tmdb_id IS NOT NULL AND tvdb_id IS NULL`, uid,
	).Scan(&pinned); err != nil {
		olog.Warnf(olog.CodeStoreOneTimePass,
			"[meta] film-source notice count failed: %v", err)
		return nil
	}
	if pinned == 0 {
		return nil
	}
	return map[string]any{"since": since, "tmdb_pinned": pinned}
}

// handleGetMetadataKeys (admin): booleans only for secrets — stored keys and
// the Amazon cookie are never echoed. The Amazon domain is not secret, so it is
// returned so the field can be pre-filled.
func (s *Server) handleGetMetadataKeys(w http.ResponseWriter, r *http.Request) {
	olog.Tracef("[meta] handleGetMetadataKeys")
	tkey, err1 := s.Store.GetSetting(settingTMDBKey)
	gkey, err2 := s.Store.GetSetting(settingGoogleBooksKey)
	acookie, err3 := s.Store.GetSetting(settingAmazonCookie)
	adomain, err4 := s.Store.GetSetting(settingAmazonDomain)
	vkey, err5 := s.Store.GetSetting(settingTVDBKey)
	igdbID, err6 := s.Store.GetSetting(settingIGDBClientID)
	igdbSec, err7 := s.Store.GetSetting(settingIGDBSecret)
	vpin, err10 := s.Store.GetSetting(settingTVDBPIN)
	scrape, err11 := s.Store.GetSetting(settingGoogleScrape)
	if err1 != nil || err2 != nil || err3 != nil || err4 != nil || err5 != nil || err6 != nil || err7 != nil || err10 != nil || err11 != nil {
		internalError(w, r, "load metadata keys", errors.Join(err1, err2, err3, err4, err5, err6, err7, err10, err11))
		return
	}
	_, source := s.resolveTMDB()
	_, tvdbSource := s.resolveTVDB()
	_, igdbSource := s.resolveIGDB()
	writeJSON(w, http.StatusOK, map[string]any{
		"tmdb_key_set":         tkey != "",
		"tvdb_key_set":         vkey != "",
		"tvdb_pin_set":         vpin != "",
		"google_books_key_set": gkey != "",
		"amazon_cookie_set":    acookie != "",
		"amazon_domain":        adomain,
		"tmdb_source":          source,
		"tvdb_source":          tvdbSource,
		// Reported separately rather than as one igdb_key_set, so the Settings
		// card can point at the half that is missing instead of saying the pair
		// is unset when one field is filled in.
		"igdb_client_id_set": igdbID != "",
		"igdb_secret_set":    igdbSec != "",
		"igdb_source":        igdbSource,
		// The picture sources (POST /images/search). Reported as two halves for
		// the same reason IGDB is, and as one `image_search` so a picker can ask
		// one question — "is there a picture search behind this button?" —
		// without knowing which supplier answers it.
		// WHETHER A BUILT-IN EXISTS, which is a different fact from which source is
		// winning. `tmdb_source` says "custom" the moment a reader saves a key, and
		// from that answer the card cannot tell whether clearing the field would
		// leave lookups working or leave them at 503. The Settings card needs the
		// first fact to say "a key here only REPLACES what ships with the app",
		// which is the difference between a field somebody must fill and a field
		// they may.
		"tmdb_builtin":  s.TMDBBuiltin != "",
		"tvdb_builtin":  s.TVDBBuiltin != "",
		"google_scrape": scrape == "1",
		"image_search":  true, // see imageSearchConfigured: the ladder has keyless rungs
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
		TVDBPIN        *string `json:"tvdb_pin"`
		GoogleBooksKey *string `json:"google_books_key"`
		AmazonCookie   *string `json:"amazon_cookie"`
		AmazonDomain   *string `json:"amazon_domain"`
		IGDBClientID   *string `json:"igdb_client_id"`
		IGDBSecret     *string `json:"igdb_secret"`
		// A BOOLEAN OVER THE WIRE, stored as "1"/"" so it goes through the same
		// pointer-means-omitted machinery every other field uses rather than
		// growing a second save path for one checkbox.
		GoogleScrape *bool `json:"google_scrape"`
	}
	if !decodeBody(w, r, &req) {
		return
	}
	olog.Tracef("[meta] handlePutMetadataKeys")
	set := func(key string, v *string) error {
		if v == nil {
			return nil
		}
		return s.Store.SetSetting(key, strings.TrimSpace(*v))
	}
	if req.GoogleScrape != nil {
		v := ""
		if *req.GoogleScrape {
			v = "1"
		}
		if err := s.Store.SetSetting(settingGoogleScrape, v); err != nil {
			internalError(w, r, "save google image scrape opt-in", err)
			return
		}
	}
	if err := set(settingTMDBKey, req.TMDBKey); err != nil {
		internalError(w, r, "save tmdb key", err)
		return
	}
	if err := set(settingTVDBKey, req.TVDBKey); err != nil {
		internalError(w, r, "save tvdb key", err)
		return
	}
	// Saved on its own, like the IGDB pair: a reader correcting a mistyped PIN
	// should not have to re-enter the key beside it.
	if err := set(settingTVDBPIN, req.TVDBPIN); err != nil {
		internalError(w, r, "save tvdb pin", err)
		return
	}
	if err := set(settingGoogleBooksKey, req.GoogleBooksKey); err != nil {
		internalError(w, r, "save google books key", err)
		return
	}
	if err := set(settingAmazonCookie, req.AmazonCookie); err != nil {
		internalError(w, r, "save amazon cookie", err)
		return
	}
	if err := set(settingAmazonDomain, req.AmazonDomain); err != nil {
		internalError(w, r, "save amazon domain", err)
		return
	}
	// Saved independently, matching the partial-save rule above: the id and the
	// secret arrive from two fields and are typed at different moments, so
	// requiring both in one request would make correcting a mistyped secret mean
	// re-entering the id.
	if err := set(settingIGDBClientID, req.IGDBClientID); err != nil {
		internalError(w, r, "save igdb client id", err)
		return
	}
	if err := set(settingIGDBSecret, req.IGDBSecret); err != nil {
		internalError(w, r, "save igdb secret", err)
		return
	}
	// The picture search's pair, saved independently for the same reason.
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
		// MissingOnly fills empty covers/posters only and never upgrades a stored
		// low-res image — the "no replacement" mode the mobile Metadata screen uses
		// so a quick tap can't churn art the user is happy with.
		MissingOnly bool `json:"missing_only"`
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
	olog.Tracef("[meta] handleCoversRefetch phase=%v after=%v limit=%v missing_only=%v", phase, after, req.Limit, req.MissingOnly)

	// total is the full workload at this instant (all books get a backfill
	// pass; sourced movies get a poster pass — missing or low-res). The client
	// captures it from the first response; remaining shrinks with the cursor.
	const movieWhere = `source_metadata IS NOT NULL`
	var total int
	if err := s.Store.DB.QueryRow(`SELECT (SELECT COUNT(*) FROM books) +
		(SELECT COUNT(*) FROM movies WHERE ` + movieWhere + `)`).Scan(&total); err != nil {
		internalError(w, r, "count refetch total", err)
		return
	}

	// GetSetting returns ("", nil) for an absent key, so a non-nil error here is a
	// real read failure — not a missing setting — and the refetch would otherwise
	// silently proceed as if no key/cookie were configured.
	gkey, gErr := s.Store.GetSetting(settingGoogleBooksKey)
	cookie, cErr := s.Store.GetSetting(settingAmazonCookie)
	domain, dErr := s.Store.GetSetting(settingAmazonDomain)
	for _, err := range []error{gErr, cErr, dErr} {
		if err != nil {
			olog.Warnf(olog.CodeMetaKeyRead, "[meta] provider key read failed: %v", err)
		}
	}

	type bookRow struct {
		id, uid    int64
		title      string
		author     string
		isbn, asin string
		cover      string
		cachedURL  string // cover_url captured in source_metadata at add time
		genreCount int
	}
	var books []bookRow
	rows, err := s.Store.DB.Query(`SELECT id, user_id, title, COALESCE(author,''), COALESCE(isbn,''), COALESCE(asin,''),
		COALESCE(cover_path,''), COALESCE(source_metadata,''),
		(SELECT COUNT(*) FROM book_genres bg WHERE bg.book_id = books.id)
		FROM books WHERE ? = 'books' AND id > ? ORDER BY id LIMIT ?`, phase, after, req.Limit)
	if err != nil {
		internalError(w, r, "query books", err)
		return
	}
	for rows.Next() {
		var b bookRow
		var raw string
		if err := rows.Scan(&b.id, &b.uid, &b.title, &b.author, &b.isbn, &b.asin, &b.cover, &raw, &b.genreCount); err != nil {
			olog.Warnf(olog.CodeMetaRowScan, "[meta] refetch book row scan failed: %v", err)
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
	if err := rows.Err(); err != nil {
		olog.Warnf(olog.CodeMetaRowScan, "[meta] refetch book row iteration failed: %v", err)
	}
	rows.Close() // done reading before any writes/network (SQLite single-writer)

	// skipped = a cover that needed work but couldn't be improved: no source URL
	// to try, or a re-fetch that came back no wider than what's stored. Counting
	// it (instead of silently dropping) is what tells the user "3 upgraded, 10
	// left as-is — no higher-res source" rather than an unexplained partial run.
	enriched, fetched, failed, skipped := 0, 0, 0, 0
	lastID := after
	for _, b := range books {
		lastID = b.id
		isbnN := metadata.NormalizeISBN(b.isbn)

		// Best candidate from the keyless/keyed sources.
		var cand *metadata.BookCandidate
		if isbnN != "" || b.title != "" {
			if cs, _ := s.searchBooks(ctx, isbnN, b.title, b.author, gkey); len(cs) > 0 {
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
				published_year = COALESCE(published_year, ?),
				updated_at = datetime('now')
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
				if tx, terr := s.Store.DB.Begin(); terr != nil {
					olog.Errorf(olog.CodeMetaGenrePersist, "[meta] genres not persisted: %v", terr)
				} else if serr := setGenres(tx, "book", b.uid, b.id, genres); serr != nil {
					olog.Errorf(olog.CodeMetaGenrePersist, "[meta] genres not persisted: %v", serr)
					_ = tx.Rollback()
				} else if cerr := tx.Commit(); cerr != nil {
					olog.Errorf(olog.CodeMetaGenrePersist, "[meta] genres not persisted: %v", cerr)
				}
			}
		}

		// Cover: fetch when missing, or re-fetch when the stored file is
		// low-res (the provider URLs used to be thumbnail-sized). URL order:
		// add-time URL, then candidate, then OL-by-ISBN, then Amazon-by-ASIN.
		// The cached URL was saved verbatim at add time, so push it through
		// the same hi-res upgrades the fresh builders now apply — otherwise
		// refetch keeps resurrecting old low-res thumbnails. A replacement
		// only sticks when it is actually wider than what's stored.
		oldW := 0
		if b.cover != "" {
			oldW = s.coverWidth(b.cover)
		}
		lowRes := !req.MissingOnly && b.cover != "" && oldW > 0 && oldW < lowResCoverWidth
		if b.cover == "" || lowRes {
			var urls []string
			// Amazon's ISBN-10 image CDN is keyless and serves the full-size
			// scan — the best-quality source, so try it first. A book Amazon
			// doesn't stock returns a tiny placeholder the size floor rejects,
			// so it harmlessly falls through to the next source.
			if isbnN != "" {
				urls = append(urls, metadata.AmazonCoverByISBN(isbnN))
			}
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
			switch {
			case name == "":
				if len(urls) > 0 {
					failed++ // had sources to try, all fetches failed
				} else {
					skipped++ // nothing to try (no isbn/asin/cached URL/candidate)
				}
			case lowRes && s.coverWidth(name) <= oldW:
				s.removeCoverFile(name) // no better than what's stored — keep the old one
				skipped++
			default:
				if _, uerr := s.Store.DB.Exec(`UPDATE books SET cover_path = ?, updated_at = datetime('now') WHERE id = ?`, name, b.id); uerr == nil {
					fetched++
					if b.cover != "" && b.cover != name {
						s.removeCoverFile(b.cover)
					}
				} else {
					s.removeCoverFile(name)
				}
			}
		}
	}

	// Movies: fetch the TMDB poster cached at add time (keyless to fetch) —
	// when it's missing, or stored low-res (same replace rule as books).
	// Only runs in the movies phase; the cursor advances over movie ids.
	type movieTarget struct {
		id        int64
		url       string
		oldPoster string
		oldW      int
	}
	var movies []movieTarget
	mScanned := 0 // chunk fullness = rows scanned, not posters found
	mrows, err := s.Store.DB.Query(`SELECT id, COALESCE(poster_path, ''), COALESCE(source_metadata, '') FROM movies
		WHERE `+movieWhere+` AND ? = 'movies' AND id > ? ORDER BY id LIMIT ?`, phase, after, req.Limit)
	if err == nil {
		for mrows.Next() {
			var id int64
			var poster, raw string
			if err := mrows.Scan(&id, &poster, &raw); err != nil {
				olog.Warnf(olog.CodeMetaRowScan, "[meta] refetch movie row scan failed: %v", err)
				continue
			}
			lastID = id
			mScanned++
			var meta struct {
				PosterPath string `json:"poster_path"`
			}
			_ = json.Unmarshal([]byte(raw), &meta)
			if meta.PosterPath == "" {
				continue
			}
			oldW := 0
			if poster != "" {
				oldW = s.coverWidth(poster)
			}
			if poster == "" || (!req.MissingOnly && oldW > 0 && oldW < lowResCoverWidth) {
				movies = append(movies, movieTarget{id, metadata.TMDBPosterURL(meta.PosterPath), poster, oldW})
			}
		}
		if err := mrows.Err(); err != nil {
			olog.Warnf(olog.CodeMetaRowScan, "[meta] refetch movie row iteration failed: %v", err)
		}
		mrows.Close()
	}
	for _, m := range movies {
		name, ferr := s.fetchImage(ctx, m.url, s.coversDir())
		if ferr != nil {
			failed++
			continue
		}
		if m.oldPoster != "" && s.coverWidth(name) <= m.oldW {
			s.removeCoverFile(name) // no better than what's stored
			skipped++
			continue
		}
		if _, uerr := s.Store.DB.Exec(`UPDATE movies SET poster_path = ?, updated_at = datetime('now') WHERE id = ?`, name, m.id); uerr == nil {
			fetched++
			if m.oldPoster != "" && m.oldPoster != name {
				s.removeCoverFile(m.oldPoster)
			}
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
		"fetched": fetched, "failed": failed, "enriched": enriched, "skipped": skipped,
		"next_cursor": next, "done": next == "", "total": total, "remaining": remaining,
	})
}
