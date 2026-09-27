// Metadata source management (§10): settings-managed API keys, source status
// for the Settings page, and the admin cover re-fetch maintenance action.

package httpapi

import (
	"cmp"
	"context"
	"encoding/json"
	"errors"
	"fmt"
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

	"tippani/internal/jobs"
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

// ONE CALL WRITES BOTH STORES, which is what keeps `books_lookup` and the fault
// list from drifting: the older payload key survives because a card and a dozen
// fixtures read its shape, but it is not a second SOURCE of the fact.
//
// `found` IS NEW AND IS WHY THE SIGNATURE CHANGED. The old boolean could say a
// books lookup failed and could not say it worked and returned nothing, which is
// precisely the state the owner is looking at on the picture ladder. `books_lookup`
// keeps the two-state shape it always had; the registry gets the third.
func (s *Server) recordBooksLookup(cands []metadata.BookCandidate, err error) {
	rec := &lookupOutcome{OK: err == nil, CheckedAt: time.Now().UTC().Format(time.RFC3339)}
	if err != nil {
		rec.Error = strings.ReplaceAll(err.Error(), "\n", "; ")
	}
	s.booksLookup.Store(rec)
	// EACH SUPPLIER GETS ITS OWN ANSWER, because the search asks two of them.
	// `SearchBooks` queries Google Books AND Open Library and hands back one list
	// — so recording the total under "google" told the fault list that Open
	// Library had never been asked, in an app that asks it on every book lookup.
	// Open Library's row on the sources console read "nothing has asked it yet"
	// for ever, including immediately after a Test that had just asked it.
	//
	// COUNTED BY THE IDS AND NOT BY `Source`, and this is the correction to the
	// first attempt at the fix. An ISBN search MERGES the two providers' answers
	// into one record — they are half-describing the same book, so a reader should
	// not have to pick a row and inherit its gaps — and the merged record keeps
	// ONE `Source`, the Google one. Counting by that field therefore recorded Open
	// Library as having answered and found NOTHING on the commonest path in the
	// app, and three of those in a row is `emptyRunFault`: a working supplier on
	// the fault list, which is worse than the silence it replaced. `GoogleID` and
	// `OpenLibraryID` survive the merge precisely because a merged candidate has
	// two identities, so they are what says who had a hand in it.
	//
	// WHAT THE NUMBER MEANS, EXACTLY: how many of the candidates the reader was
	// offered this supplier contributed to. Not how many rows it returned — the
	// list is merged and then cut to `maxBookCandidates` — and the difference is
	// deliberate, because what the fault list is for is "did this supplier put
	// anything in front of me", not "how big was its raw reply".
	//
	// AN ERROR BELONGS TO BOTH, because the error this search returns is the pair
	// of them failing — `SearchBooks` composes "google books: …; open library: …"
	// — and there is no way here to say which half died. Recording it against one
	// would exonerate the other on no evidence.
	//
	// "google" AND NOT "google-books", because `vocab.source.google.label` already
	// reads "Google Books" — the app named this supplier once and the fault list
	// has no business naming it a second time in a slightly different way.
	google, openLibrary := 0, 0
	for _, c := range cands {
		if c.GoogleID != "" || c.Source == "google" {
			google++
		}
		if c.OpenLibraryID != "" || c.Source == "openlibrary" {
			openLibrary++
		}
	}
	s.recordLookup(faultAreaBooks, "google", google, "", err)
	s.recordLookup(faultAreaBooks, "openlibrary", openLibrary, "", err)
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

// providerKeys is what a pass over many works asks every supplier with: the
// Google Books key and the Amazon cookie for books, the TMDB and TheTVDB clients
// for films. Read once per pass, not once per work.
type providerKeys struct {
	googleBooks, amazonCookie, amazonDomain string
	tmdb                                    *metadata.TMDB
	tvdb                                    *metadata.TVDB
}

// providerKeys reads them. It was the same ten lines in the fill, the covers pass
// and the re-verify, and the jobs that replace their client loops need it too, so
// it is one function before it would have been five copies.
//
// A READ THAT FAILS IS NOT A KEY THAT IS MISSING, and the two must not look alike
// in the log: GetSetting answers ("", nil) for an absent setting, so an error is
// a real read failure, logged here as it always was. The pass goes on with what
// was read, as it always did — a supplier asked without a key still answers, only
// with a smaller quota. The error is returned as well, for a caller with a log of
// its own to say why its lookups ran keyless; a handler has nobody to tell.
func (s *Server) providerKeys() (providerKeys, error) {
	var k providerKeys
	var errs []error
	for _, f := range []struct {
		key string
		to  *string
	}{
		{settingGoogleBooksKey, &k.googleBooks},
		{settingAmazonCookie, &k.amazonCookie},
		{settingAmazonDomain, &k.amazonDomain},
	} {
		v, err := s.Store.GetSetting(f.key)
		if err != nil {
			olog.Warnf(olog.CodeMetaKeyRead, "[meta] provider key read failed: %v", err)
			errs = append(errs, err)
		}
		*f.to = v
	}
	k.tmdb, _ = s.resolveTMDB()
	k.tvdb, _ = s.resolveTVDB()
	return k, errors.Join(errs...)
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
		// EVERY SOURCE THAT IS ACTUALLY BROKEN, and nothing about the ones that
		// are not. The card's own rule is that silence is the healthy state, so an
		// empty list is the ordinary answer and is not decoration to be filled.
		//
		// COMPUTED HERE RATHER THAN IN THE CLIENT because the thing that makes a
		// zero into a fault is a RUN, and a run is only visible to whatever saw
		// every attempt. A client sees one page load.
		"faults": s.lookups.faults(),
		// EVERY SUPPLIER THE APP CAN ASK, broken or not — which is the opposite
		// list to `faults` above and is why both are here. Faults answer "what
		// should I do something about"; this answers "who does this app ask, and
		// how much of my library came from each" — the question the console's own
		// heading asks. See metadata_sources.go.
		"sources": s.sourceRows(userID(r)),
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

// coversMovieWhere is which of a reader's films the covers pass walks: the ones a
// source was pinned for, since only those have a poster to fetch again.
const coversMovieWhere = `user_id = ? AND source_metadata IS NOT NULL`

// coversWorkload is how many works a covers pass over uid's library walks: every
// book, and every film with a source. The chunked route reports it as its total,
// and the covers job is queued with it as its item count, so the two agree.
func (s *Server) coversWorkload(uid int64) (int, error) {
	var total int
	err := s.Store.DB.QueryRow(`SELECT (SELECT COUNT(*) FROM books WHERE user_id = ?) +
		(SELECT COUNT(*) FROM movies WHERE `+coversMovieWhere+`)`, uid, uid).Scan(&total)
	return total, err
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
	uid := userID(r)
	// A failed read is logged by providerKeys, rather than the refetch silently
	// proceeding as if no key or cookie were configured; it goes on with what was
	// read. It asks no film supplier: a poster is fetched from the address cached
	// when the film was added.
	keys, _ := s.providerKeys()
	c, err := s.coversRefetchChunk(r.Context(), uid, req.Cursor, req.Limit, req.MissingOnly, keys)
	if err != nil {
		if ref, ok := asRefusal(err); ok {
			writeErr(w, ref.status, ref.msg)
			return
		}
		internalError(w, r, "covers refetch", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"fetched": c.fetched, "failed": c.failed, "enriched": c.enriched, "skipped": c.skipped,
		"next_cursor": c.next, "done": c.next == "", "total": c.total, "remaining": c.remaining,
	})
	// The LAST chunk of a run is the only one that knows the run is over; the
	// per-chunk counts are the client's to sum, so the message names the run's
	// size rather than a total this request never saw.
	if c.next == "" && c.total >= notifyFetchMin {
		s.notifyAfter(w, r, uid, "fetch", coversDoneTitle, coversDoneMessage(c.total))
	}
}

// What a covers pass that walked at least notifyFetchMin works says when it ends,
// whether the chunked route or the covers job walked it.
const coversDoneTitle = "Metadata fetch finished"

func coversDoneMessage(total int) string {
	return "Covers and details checked for " + countOf(total, "work", "works") + "."
}

// runCovers is the covers job: the pass the chunked route walks, one work at a
// time, so a Stop lands after the work in hand; a line in the job's log for each
// work it walked. It tells the phone when it reaches the end, as the route's last
// chunk does, and not when it is stopped, which the route's never-sent last chunk
// did not either.
func runCovers(s *Server, ctx context.Context, j *jobs.Job) error {
	var p struct {
		MissingOnly bool `json:"missing_only"`
	}
	if err := j.Params(&p); err != nil {
		return err
	}
	uid := j.Owner().UserID
	keys, err := s.providerKeys()
	if err != nil {
		j.Log(jobs.LevelWarn, "a saved supplier key could not be read, so the lookups ask without it: %v", err)
	}
	var sum coversChunk
	cursor, reached := "", false
	for !j.Stopping() {
		c, err := s.coversRefetchChunk(ctx, uid, cursor, 1, p.MissingOnly, keys)
		if err != nil {
			// What it did before the failure is still what it did.
			_ = j.SetResult(coversCounts(sum))
			return err
		}
		sum.fetched, sum.enriched, sum.failed, sum.skipped = sum.fetched+c.fetched, sum.enriched+c.enriched,
			sum.failed+c.failed, sum.skipped+c.skipped
		sum.total = c.total
		for _, row := range c.rows {
			level := jobs.LevelInfo
			if row.warn {
				level = jobs.LevelWarn
			}
			j.Log(level, "%s — %s", itemName(row.kind, row.id, row.title), row.what)
		}
		j.Progress(c.total-c.remaining, c.total)
		if c.next == "" {
			reached = true
			break
		}
		cursor = c.next
	}
	if err := j.SetResult(coversCounts(sum)); err != nil {
		return err
	}
	if reached && sum.total >= notifyFetchMin {
		s.notify(ctx, uid, "fetch", coversDoneTitle, coversDoneMessage(sum.total))
	}
	return nil
}

// coversCounts is a covers job's result, which is its counts.
func coversCounts(c coversChunk) map[string]any {
	return map[string]any{"fetched": c.fetched, "enriched": c.enriched, "failed": c.failed, "skipped": c.skipped}
}

// coversChunk is one stretch of a covers pass: what it did, and where the next
// stretch starts ("" when the pass is over).
type coversChunk struct {
	fetched, enriched, failed, skipped int
	next                               string
	// total is the whole pass's workload at this instant; remaining is how much
	// of it the stretches after this one will still see.
	total, remaining int
	// rows is what happened to each work the stretch walked, in the order walked:
	// the covers job's log, a line a work. The route answers only the counters.
	rows []coversRow
}

// coversRow is one work a covers pass walked, and what the pass did to it, in
// the words its log line uses.
type coversRow struct {
	kind  string // book | movie
	id    int64
	title string
	what  string
	warn  bool // something it tried failed, as opposed to there being nothing to do
}

// coversRefetchChunk walks up to limit of uid's works after cursor, as
// POST /covers/refetch describes, and fills what each is missing. The chunked
// route calls it once per request; the covers job calls it one work at a time,
// so a Stop lands after the work in hand. An unreadable cursor is a *refusal.
func (s *Server) coversRefetchChunk(ctx context.Context, uid int64, cursor string, limit int, missingOnly bool, keys providerKeys) (coversChunk, error) {
	var c coversChunk
	phase, after := "books", int64(0)
	if cur := strings.TrimSpace(cursor); cur != "" {
		p, aStr, ok := strings.Cut(cur, ":")
		a, perr := strconv.ParseInt(aStr, 10, 64)
		if !ok || perr != nil || (p != "books" && p != "movies") {
			return c, badParams("invalid cursor")
		}
		phase, after = p, a
	}
	olog.Tracef("[meta] covers refetch phase=%v after=%v limit=%v missing_only=%v", phase, after, limit, missingOnly)

	// total is the full workload at this instant (all books get a backfill
	// pass; sourced movies get a poster pass — missing or low-res). The client
	// captures it from the first response; remaining shrinks with the cursor.
	// THE CALLER'S OWN LIBRARY ONLY. The route is admin-gated, and that gate once
	// read as licence to walk every account's shelf; an admin never touches
	// another reader's rows, so every query below is scoped like any other.
	const movieWhere = coversMovieWhere
	total, err := s.coversWorkload(uid)
	if err != nil {
		return c, fmt.Errorf("count refetch total: %w", err)
	}
	c.total = total
	gkey, cookie, domain := keys.googleBooks, keys.amazonCookie, keys.amazonDomain

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
		FROM books WHERE user_id = ? AND ? = 'books' AND id > ? ORDER BY id LIMIT ?`, uid, phase, after, limit)
	if err != nil {
		return c, fmt.Errorf("query books: %w", err)
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
		row := coversRow{kind: "book", id: b.id, title: b.title}
		var did []string

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
			// 0061's three join the fill-empty backfill on the same terms as the
			// three above, in the NULLIF/zero spelling their NOT NULL DEFAULT
			// columns need — `COALESCE('', x)` is `''`, which would report an
			// enrichment while donating nothing (see enrichStagedQuote).
			res, uerr := s.Store.DB.Exec(`UPDATE books SET
				author = COALESCE(author, ?),
				description = COALESCE(description, ?),
				published_year = COALESCE(published_year, ?),
				subtitle = COALESCE(NULLIF(subtitle, ''), ?),
				publisher = COALESCE(NULLIF(publisher, ''), ?),
				pages = COALESCE(NULLIF(pages, 0), ?),
				updated_at = datetime('now')
				WHERE id = ? AND (author IS NULL OR description IS NULL OR published_year IS NULL
				                  OR (subtitle = '' AND ? <> '') OR (publisher = '' AND ? <> '')
				                  OR (pages = 0 AND ? <> 0))`,
				nullable(cand.Author), nullable(cand.Description), nullableInt(cand.PublishedYear),
				cand.Subtitle, cand.Publisher, cand.Pages,
				b.id, cand.Subtitle, cand.Publisher, cand.Pages)
			if uerr == nil {
				if n, _ := res.RowsAffected(); n > 0 {
					enriched++
					did = append(did, "details filled")
					// 0056: an author that was NULL may now hold a name, so the
					// link rows follow it. In its own transaction because this
					// sweep writes outside one — and best-effort, because a
					// backfill that walks the whole library must not abort over
					// one row: the columns are correct either way, and
					// SyncAllCredits repairs a straggler.
					if tx, terr := s.Store.DB.Begin(); terr == nil {
						if cerr := store.SyncCreditsFromColumns(tx, b.uid, "book", b.id, s.creditSeps(tx, b.uid)); cerr != nil {
							tx.Rollback()
							olog.Warnf(olog.CodeMetaRowScan, "[meta] backfill: credits not linked for book %d: %v", b.id, cerr)
						} else if cerr := tx.Commit(); cerr != nil {
							olog.Warnf(olog.CodeMetaRowScan, "[meta] backfill: credit link commit failed for book %d: %v", b.id, cerr)
						}
					}
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
				} else {
					did = append(did, "genres added")
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
		lowRes := !missingOnly && b.cover != "" && oldW > 0 && oldW < lowResCoverWidth
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
					did = append(did, fmt.Sprintf("no cover could be fetched (%s tried)", countOf(len(urls), "place", "places")))
					row.warn = true
				} else {
					skipped++ // nothing to try (no isbn/asin/cached URL/candidate)
					did = append(did, "no cover to look for: no ISBN, ASIN or address kept from its supplier")
				}
			case lowRes && s.coverWidth(name) <= oldW:
				s.removeCoverFile(name) // no better than what's stored — keep the old one
				skipped++
				did = append(did, "kept its cover: nothing larger was found")
			default:
				if _, uerr := s.Store.DB.Exec(`UPDATE books SET cover_path = ?, updated_at = datetime('now') WHERE id = ?`, name, b.id); uerr == nil {
					fetched++
					if lowRes {
						did = append(did, "a larger cover fetched")
					} else {
						did = append(did, "cover fetched")
					}
					if b.cover != "" && b.cover != name {
						s.removeCoverFile(b.cover)
					}
				} else {
					s.removeCoverFile(name)
					did = append(did, "the cover it fetched could not be saved")
					row.warn = true
				}
			}
		}
		row.what = cmp.Or(strings.Join(did, ", "), "nothing missing")
		c.rows = append(c.rows, row)
	}

	// Movies: fetch the TMDB poster cached at add time (keyless to fetch) —
	// when it's missing, or stored low-res (same replace rule as books).
	// Only runs in the movies phase; the cursor advances over movie ids. Every
	// film the stretch scanned is a target, in order, with the poster to fetch
	// ("" when it needs none) or what the pass has to say about it.
	type movieTarget struct {
		row       coversRow
		url       string
		oldPoster string
		oldW      int
	}
	var movies []movieTarget
	mScanned := 0 // chunk fullness = rows scanned, not posters found
	mrows, err := s.Store.DB.Query(`SELECT id, title, COALESCE(poster_path, ''), COALESCE(source_metadata, '') FROM movies
		WHERE `+movieWhere+` AND ? = 'movies' AND id > ? ORDER BY id LIMIT ?`, uid, phase, after, limit)
	if err == nil {
		for mrows.Next() {
			var id int64
			var title, poster, raw string
			if err := mrows.Scan(&id, &title, &poster, &raw); err != nil {
				olog.Warnf(olog.CodeMetaRowScan, "[meta] refetch movie row scan failed: %v", err)
				continue
			}
			lastID = id
			mScanned++
			m := movieTarget{row: coversRow{kind: "movie", id: id, title: title, what: "nothing missing"}}
			var meta struct {
				PosterPath string `json:"poster_path"`
			}
			_ = json.Unmarshal([]byte(raw), &meta)
			oldW := 0
			if poster != "" {
				oldW = s.coverWidth(poster)
			}
			switch {
			case meta.PosterPath == "":
				m.row.what = "no poster to fetch: its supplier gave none when it was added"
			case poster == "" || (!missingOnly && oldW > 0 && oldW < lowResCoverWidth):
				m.url, m.oldPoster, m.oldW = metadata.TMDBPosterURL(meta.PosterPath), poster, oldW
			}
			movies = append(movies, m)
		}
		if err := mrows.Err(); err != nil {
			olog.Warnf(olog.CodeMetaRowScan, "[meta] refetch movie row iteration failed: %v", err)
		}
		mrows.Close()
	}
	for _, m := range movies {
		c.rows = append(c.rows, m.row)
		if m.url == "" {
			continue
		}
		row := &c.rows[len(c.rows)-1]
		name, ferr := s.fetchImage(ctx, m.url, s.coversDir())
		if ferr != nil {
			failed++
			row.what, row.warn = "no poster could be fetched", true
			continue
		}
		if m.oldPoster != "" && s.coverWidth(name) <= m.oldW {
			s.removeCoverFile(name) // no better than what's stored
			skipped++
			row.what = "kept its poster: nothing larger was found"
			continue
		}
		if _, uerr := s.Store.DB.Exec(`UPDATE movies SET poster_path = ?, updated_at = datetime('now') WHERE id = ?`, name, m.row.id); uerr == nil {
			fetched++
			row.what = "poster fetched"
			if m.oldPoster != "" {
				row.what = "a larger poster fetched"
			}
			if m.oldPoster != "" && m.oldPoster != name {
				s.removeCoverFile(m.oldPoster)
			}
		} else {
			s.removeCoverFile(name)
			failed++
			row.what, row.warn = "the poster it fetched could not be saved", true
		}
	}

	// Next cursor: advance within the phase while chunks come back full; a
	// short books chunk hands over to movies, a short movies chunk finishes.
	next := ""
	switch phase {
	case "books":
		if len(books) == limit {
			next = "books:" + strconv.FormatInt(lastID, 10)
		} else {
			next = "movies:0"
		}
	case "movies":
		if mScanned == limit {
			next = "movies:" + strconv.FormatInt(lastID, 10)
		}
	}

	// remaining = rows the NEXT calls will still see; drives the progress bar.
	remaining := 0
	switch {
	case next == "":
		// done
	case strings.HasPrefix(next, "books:"):
		if s.Store.DB.QueryRow(`SELECT (SELECT COUNT(*) FROM books WHERE user_id = ? AND id > ?) +
			(SELECT COUNT(*) FROM movies WHERE `+movieWhere+`)`, uid, lastID, uid).Scan(&remaining) != nil {
			remaining = 0
		}
	default: // movies:N
		// FROM THE CURSOR, NOT FROM THE LAST ROW. A stretch that ends the books
		// hands over as movies:0, and its last row was a BOOK: counting the films
		// after that book's id counted only the films numbered above it, so a pass
		// that had walked every book reported films done before it reached one —
		// the bar full while the posters were still to come. The two tables number
		// their rows apart, so a book's id says nothing about a film's.
		filmsAfter := lastID
		if phase == "books" {
			filmsAfter = 0
		}
		if s.Store.DB.QueryRow(`SELECT COUNT(*) FROM movies WHERE `+movieWhere+` AND id > ?`,
			uid, filmsAfter).Scan(&remaining) != nil {
			remaining = 0
		}
	}

	c.fetched, c.enriched, c.failed, c.skipped = fetched, enriched, failed, skipped
	c.next, c.remaining = next, remaining
	return c, nil
}
