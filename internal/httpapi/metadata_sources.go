// A ROW PER SUPPLIER THE APP CAN ASK, AND A WAY TO ASK IT NOW.
//
// WHY A LIST OF KEYS IS NOT A LIST OF SOURCES. The Metadata sources console drew
// one row per CREDENTIAL FIELD — a TheTVDB key, a TheTVDB pin, an IGDB id, an IGDB
// secret — which is the shape of the form rather than the shape of the question.
// A reader on that screen is asking "who does this app ask about my books, and are
// any of them broken?", and the answer to that is a list of suppliers: what each
// one supplies, whether it can be asked at all, how much of this library came from
// it, and what it said last time. The v3 pack draws exactly that
// (metadata.dc.html:476-489, 805-821) and titles the group "Who the app can ask".
//
// THE STATE IS A FACT ABOUT THE CREDENTIAL, NOT A GUESS. `saved` and `bundled` come
// from the same resolve* functions the lookups themselves call, so a row cannot
// claim a key that a lookup would not find. `needed` is the one that is red,
// because it means a request will 503; `optional` means the supplier answers
// without one and a key only improves the answer.
//
// AND THE COUNT IS THE LIBRARY'S OWN RECORD OF IT. `work_field_source` stores which
// supplier wrote each accepted field, so "records supplied" is a fact rather than a
// tally this file keeps. It is scoped by user like every other query here: a
// supplier that filled in somebody else's shelf did not fill in yours.

package httpapi

import (
	"context"
	"net/http"
	"time"

	"tippani/internal/olog"
)

// The four states a supplier's credential can be in, in the pack's own words
// (metadata.dc.html:490-495). They are not translated here: the client draws the
// legend from its own locale files and these are the enum.
const (
	srcStateSaved    = "saved"    // a key of this instance's own is stored
	srcStateBundled  = "bundled"  // running on the key built into the app
	srcStateOptional = "optional" // answers without a key; one only improves it
	srcStateNeeded   = "needed"   // cannot be asked at all until a key is stored
)

// sourceRow is one supplier as this console draws it.
type sourceRow struct {
	Source  string   `json:"source"`
	Areas   []string `json:"areas"`
	State   string   `json:"state"`
	Records int      `json:"records"`
	// Last is what this supplier said the last time anything asked it, in this
	// process. Absent when nothing has — which is the ordinary state of a server
	// that has just started, and is why it is a pointer rather than a zero row
	// claiming a successful call that never happened.
	Last *sourceLast `json:"last,omitempty"`
}

type sourceLast struct {
	OK        bool   `json:"ok"`
	Found     int    `json:"found"`
	Error     string `json:"error,omitempty"`
	Note      string `json:"note,omitempty"`
	CheckedAt string `json:"checked_at"`
}

// THE SUPPLIERS, IN THE ORDER A READER MEETS THEM: the ones a library cannot do
// without first, then the ones that fill pictures and people in.
//
// AREAS RATHER THAN A SENTENCE EACH. The pack writes "films · people · posters"
// per row; composing it from the areas the app already names
// (`settings.metadata.area.*`, which the fault chips use) means a supplier that
// gains an area says so without a second string being written, and means this file
// holds no prose to translate.
var sourceAreas = []struct {
	slug  string
	areas []string
}{
	{"google", []string{faultAreaBooks}},
	{"openlibrary", []string{faultAreaBooks}},
	{"tmdb", []string{faultAreaFilms, faultAreaPictures}},
	{"tvdb", []string{faultAreaFilms, faultAreaPictures}},
	{"igdb", []string{faultAreaGames}},
	{"wikidata", []string{faultAreaGames}},
	{"amazon", []string{faultAreaPictures}},
	{"google-images", []string{faultAreaPictures}},
	{"wikimedia", []string{faultAreaPictures}},
	{"fandom", []string{faultAreaPictures}},
}

// sourceState answers what the console's legend is about, from the same resolvers
// the lookups use.
//
// THE KEYLESS SUPPLIERS ARE `optional` AND NOT `saved`, which is a deliberate
// reading of the pack's four words: Open Library, Wikimedia and the rest answer
// without any credential, so "key saved" would be a green light about a key that
// does not exist. `optional` is the honest one — nothing is stored, and nothing
// needs to be.
func (s *Server) sourceState(slug string) string {
	switch slug {
	case "tmdb":
		switch _, src := s.resolveTMDB(); src {
		case "none":
			return srcStateNeeded
		case "builtin":
			return srcStateBundled
		default:
			return srcStateSaved
		}
	case "tvdb":
		switch _, src := s.resolveTVDB(); src {
		case "none":
			return srcStateNeeded
		case "builtin":
			return srcStateBundled
		default:
			return srcStateSaved
		}
	case "igdb":
		if _, src := s.resolveIGDB(); src == "none" {
			// RED, BECAUSE A GAME LOOKUP WITH NO PAIR 503s. There is no built-in
			// fallback here as there is for films: IGDB credentials are
			// per-application and rate-limited, so a shared key would be a shared
			// quota.
			return srcStateNeeded
		}
		return srcStateSaved
	case "google":
		if key, err := s.Store.GetSetting(settingGoogleBooksKey); err == nil && key != "" {
			return srcStateSaved
		}
		// Google Books answers without a key, at a lower quota.
		return srcStateOptional
	case "amazon":
		if c, err := s.Store.GetSetting(settingAmazonCookie); err == nil && c != "" {
			return srcStateSaved
		}
		return srcStateOptional
	default:
		return srcStateOptional
	}
}

// recordsBySource counts the fields in this reader's library that each supplier
// wrote. One query rather than one per supplier: the table is keyed by user first,
// so the whole answer is a single scan of that prefix.
func (s *Server) recordsBySource(uid int64) map[string]int {
	out := map[string]int{}
	rows, err := s.Store.DB.Query(
		`SELECT source, count(*) FROM work_field_source WHERE user_id = ? GROUP BY source`, uid)
	if err != nil {
		// A COUNT IS NOT WORTH A FAILED SCREEN. Every other fact on this console
		// stands without it, so a read that fails logs and leaves the numbers at
		// zero rather than taking the status response with it — the same
		// reasoning filmSourceNotice is written under.
		olog.Tracef("[meta] records by source: %v", err)
		return out
	}
	defer rows.Close()
	for rows.Next() {
		var src string
		var n int
		if err := rows.Scan(&src, &n); err != nil {
			return out
		}
		out[src] = n
	}
	return out
}

// sourceRows composes the list the console draws.
func (s *Server) sourceRows(uid int64) []sourceRow {
	counts := s.recordsBySource(uid)
	out := make([]sourceRow, 0, len(sourceAreas))
	for _, src := range sourceAreas {
		row := sourceRow{
			Source:  src.slug,
			Areas:   src.areas,
			State:   s.sourceState(src.slug),
			Records: counts[src.slug],
		}
		// THE LAST WORD FROM THE AREA IT LEADS IN. A supplier can be recorded in
		// two areas — TheTVDB answers film lookups and picture searches — and the
		// row shows the newest of them, because what the reader is asking is "did
		// this thing answer me recently", not "how is its posters division".
		for _, area := range src.areas {
			if o := s.lookups.latest(area, src.slug); o != nil {
				if row.Last == nil || o.CheckedAt.After(mustTime(row.Last.CheckedAt)) {
					row.Last = &sourceLast{
						OK: o.OK, Found: o.Found, Error: o.Err, Note: o.Note,
						CheckedAt: o.CheckedAt.UTC().Format(time.RFC3339),
					}
				}
			}
		}
		out = append(out, row)
	}
	return out
}

func mustTime(s string) time.Time {
	t, _ := time.Parse(time.RFC3339, s)
	return t
}

// ── TESTING A SOURCE ─────────────────────────────────────────────────────────
//
// WHAT A TEST IS, AND WHAT IT DELIBERATELY IS NOT. It asks the supplier the same
// question the app asks it in ordinary use — a title search through the same
// client, recorded through the same `recordLookup` — with a subject famous enough
// that "nothing found" is an answer about the supplier rather than about the
// subject. It is NOT a bespoke health protocol: a second way of asking is a second
// thing that can disagree with the first, and then a green Test over a broken
// lookup is worse than no Test at all.
//
// ONLY THE SUPPLIERS A READER CAN CONFIGURE. The picture ladder's rungs are
// scrapes of other people's sites; asking them a synthetic question on a button
// press is how an install earns a rate limit, and they already report themselves
// through the registry every time they are actually used. So a Test covers the
// keyed suppliers, and the rest of the list keeps saying what it last said.
var testableSources = []string{"google", "tmdb", "tvdb", "igdb"}

// THE SUBJECTS, AND WHY THESE. Each is old enough to be in every catalogue that
// claims to hold its medium, and distinctive enough that a match is unambiguous.
// A supplier answering nothing to these has something wrong with it.
const (
	probeBook = "Dune"
	probeFilm = "Metropolis"
	probeGame = "Tetris"
)

// testSource asks one supplier, records the outcome where every other lookup
// records it, and says what happened.
func (s *Server) testSource(ctx context.Context, uid int64, slug string) sourceRow {
	switch slug {
	case "google":
		gkey, _ := s.Store.GetSetting(settingGoogleBooksKey)
		// THE SAME SEAM EVERY BOOK LOOKUP GOES THROUGH, not metadata.SearchBooks
		// directly. A Test that reached past the seam would be a second way of
		// asking, and the whole argument above is that there must not be one.
		cands, err := s.searchBooks(ctx, "", probeBook, "", gkey)
		s.recordBooksLookup(len(cands), err)
	case "tmdb":
		client, _ := s.resolveTMDB()
		if client == nil {
			break
		}
		cands, err := client.Search(ctx, probeFilm, 0)
		s.recordLookup(faultAreaFilms, "tmdb", len(cands), "", err)
	case "tvdb":
		client, _ := s.resolveTVDB()
		if client == nil {
			break
		}
		cands, err := client.Search(ctx, probeFilm, 0, "movie")
		s.recordLookup(faultAreaFilms, "tvdb", len(cands), "", err)
	case "igdb":
		client, _ := s.resolveIGDB()
		if client == nil {
			break
		}
		cands, err := client.Search(ctx, probeGame, 0)
		s.recordLookup(faultAreaGames, "igdb", len(cands), "", err)
	}
	for _, row := range s.sourceRows(uid) {
		if row.Source == slug {
			return row
		}
	}
	return sourceRow{Source: slug}
}

// handleMetadataTest — POST /admin/metadata/test.
//
// ADMIN, BECAUSE IT SPENDS THE INSTANCE'S QUOTA. Every other thing on this console
// is a read; this one makes real requests to somebody else's API on a press, and
// the person who owns the keys is the person who should be able to.
//
// A NAMED SOURCE OR ALL OF THEM, which is the pack's two controls — "Test TMDB" on
// the row and "Test every source" above the list — and one handler, because they
// are one act at two widths.
func (s *Server) handleMetadataTest(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Source string `json:"source"`
	}
	if r.ContentLength > 0 && !decodeBody(w, r, &req) {
		return
	}
	want := testableSources
	if req.Source != "" {
		found := false
		for _, slug := range testableSources {
			if slug == req.Source {
				found = true
			}
		}
		if !found {
			// NAMED RATHER THAN IGNORED. Silently testing nothing and returning a
			// row would be a green light about a supplier nobody asked.
			writeErr(w, http.StatusBadRequest, "that is not a source this server can test")
			return
		}
		want = []string{req.Source}
	}
	uid := userID(r)
	rows := make([]sourceRow, 0, len(want))
	for _, slug := range want {
		rows = append(rows, s.testSource(r.Context(), uid, slug))
	}
	writeJSON(w, http.StatusOK, map[string]any{"sources": rows})
}
