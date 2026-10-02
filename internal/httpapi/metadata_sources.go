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
	"errors"
	"fmt"
	"net/http"
	"slices"
	"sync"
	"time"

	"tippani/internal/metadata"
	"tippani/internal/olog"
	"tippani/internal/store"
)

// The four states a supplier's credential can be in, in the pack's own words
// (metadata.dc.html:490-495). They are not translated here: the client draws the
// legend from its own locale files and these are the enum.
const (
	srcStateSaved = "saved" // a key of this instance's own is stored
	// `builtin` AND NOT `bundled`, AND THE SPELLING IS THE WHOLE OF IT. The app
	// already had this vocabulary — `SRC_STATE_WORD` in ui.jsx, `.is-src-builtin`
	// in the stylesheet, `KEY_STATES` in the console, and the pack's own
	// `SRC_STATE` (metadata.dc.html:494) — and a fifth word for the same state
	// draws a mark with no colour rule and an accessible name with the word
	// missing out of the middle of it. A rating caught it: the Go test asserted
	// the wire and the journey world has no built-in key, so both halves passed
	// while an official build would have shown a grey mark saying "TMDB — ".
	srcStateBuiltin  = "builtin"  // running on the key built into the app
	srcStateOptional = "optional" // answers without a key; one only improves it
	srcStateNeeded   = "needed"   // cannot be asked at all until a key is stored
)

// sourceRow is one supplier as this console draws it.
type sourceRow struct {
	Source string   `json:"source"`
	Areas  []string `json:"areas"`
	State  string   `json:"state"`
	// What this supplier wrote into the reader's library: fields (a portrait
	// counts as one), and the works and people they belong to. The owner, 30
	// September: "not just the count of works and peoples, but of fields.
	// \"Fields | works\"".
	Fields int `json:"fields"`
	Works  int `json:"works"`
	People int `json:"people"`
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
	{"openlibrary", []string{faultAreaBooks, faultAreaPeople}},
	{"amazon", []string{faultAreaBooks, faultAreaPictures}},
	{"tmdb", []string{faultAreaFilms, faultAreaPeople, faultAreaPictures}},
	{"tvdb", []string{faultAreaFilms, faultAreaPictures}},
	{"imdb", []string{faultAreaFilms}},
	{"letterboxd", []string{faultAreaFilms}},
	{"igdb", []string{faultAreaGames, faultAreaPeople}},
	{"wikidata", []string{faultAreaGames}},
	{"google-images", []string{faultAreaPictures}},
	{"wikimedia", []string{faultAreaPictures}},
	{"fandom", []string{faultAreaFilms, faultAreaGames, faultAreaPictures}},
}

// everySourceHasARow is the contract sourceAreas has to keep, and it is checked
// rather than remembered.
//
// A SUPPLIER WITH NO ROW IS A SUPPLIER WHOSE RECORDS ARE COUNTED INTO NOTHING.
// `knownBookSource` and `knownMovieSource` in reverify_handlers.go are the two
// whitelists that decide what may be written into `work_field_source` — which is
// exactly the column this console counts — so a slug they accept and this list
// omits is a supplier that filled in part of somebody's library and appears
// nowhere on the screen that lists suppliers. A rating found four of them.
//
// TWO EXCLUSIONS, AND NEITHER IS SOMETHING THIS APP CAN ASK.
//
// `manual` is the reader themselves — `vocab.source.manual.label` reads "You" —
// and a row offering to test whether you can be asked would be a joke the screen
// makes once.
//
// `hardcover` ARRIVES THROUGH AN IMPORT AND IS NEVER QUERIED. It lives in
// `internal/importer`, not `internal/metadata`: a Hardcover export can attribute a
// field, which is why `knownBookSource` accepts it, but nothing in this app can
// ask Hardcover anything. A row under a heading reading "Who the app can ask"
// would be an invitation to configure something that does not exist, and it would
// have drawn its own slug in lower case besides, because there is no
// `vocab.source.hardcover.label` — the app has never had to name it on a screen.
// Its records are visible where they belong: on the work whose field it filled.
var sourceRowExempt = map[string]bool{"manual": true, "hardcover": true}

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
			return srcStateBuiltin
		default:
			return srcStateSaved
		}
	case "tvdb":
		switch _, src := s.resolveTVDB(); src {
		case "none":
			return srcStateNeeded
		case "builtin":
			return srcStateBuiltin
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

// supplied is what one supplier wrote into a reader's library.
type supplied struct{ fields, works, people int }

// suppliedBySource counts, per supplier, the fields it wrote into this reader's
// library and the works and people those fields belong to. ONLY LIVE WORKS: the
// provenance table outlives a work that was binned or purged, and a count of
// what the library holds must not include what it no longer does.
func (s *Server) suppliedBySource(uid int64) map[string]supplied {
	out := map[string]supplied{}
	// A COUNT IS NOT WORTH A FAILED SCREEN: a read that fails logs and leaves the
	// numbers at zero rather than taking the status response with it.
	rows, err := s.Store.DB.Query(`
		SELECT f.source, count(*), count(DISTINCT f.kind || ':' || f.work_id)
		  FROM work_field_source f
		 WHERE f.user_id = ? AND CASE f.kind
		       WHEN 'book' THEN EXISTS (SELECT 1 FROM books b WHERE b.id = f.work_id AND b.user_id = f.user_id)
		       ELSE EXISTS (SELECT 1 FROM movies m WHERE m.id = f.work_id AND m.user_id = f.user_id) END
		 GROUP BY f.source`, uid)
	if err != nil {
		olog.Tracef("[meta] supplied by source: %v", err)
		return out
	}
	for rows.Next() {
		var src string
		var got supplied
		if rows.Scan(&src, &got.fields, &got.works) == nil {
			out[src] = got
		}
	}
	rows.Close()
	// A PERSON COUNTS FOR EVERY SUPPLIER THAT WROTE ANY OF IT, which is the
	// definition the owner chose ("a work or person counts for a source when that
	// source wrote any of its fields, pictures or links"): its portrait
	// (image_source, 0081), its identity and the facts that came with it
	// (`source`, which only a fetch or a re-verify writes), and each fetched link
	// (link_sources). A portrait is also one field.
	prow, err := s.Store.DB.Query(`SELECT source, image_source, image_path <> '', link_sources FROM people WHERE user_id = ?`, uid)
	if err != nil {
		olog.Tracef("[meta] supplied by source, people: %v", err)
		return out
	}
	gave := func(src string) bool { return src != "" && src != store.SourceManual }
	for prow.Next() {
		var src, img, links string
		var hasImage bool
		if prow.Scan(&src, &img, &hasImage, &links) != nil {
			continue
		}
		by := map[string]bool{}
		if gave(src) {
			by[src] = true
		}
		if gave(img) && hasImage {
			by[img] = true
			got := out[img]
			got.fields++
			out[img] = got
		}
		for _, from := range readLinkSources(links) {
			if gave(from) {
				by[from] = true
			}
		}
		for from := range by {
			got := out[from]
			got.people++
			out[from] = got
		}
	}
	prow.Close()
	// A CHARACTER'S PICTURE IS A FIELD its supplier wrote, on the character's own
	// record or on one cast row. A character is not a person, so it adds to no
	// people count.
	crow, err := s.Store.DB.Query(`
		SELECT image_source, count(*) FROM characters
		 WHERE user_id = ? AND image_source NOT IN ('', 'manual') AND image_path <> '' GROUP BY image_source
		UNION ALL
		SELECT character_image_source, count(*) FROM work_cast
		 WHERE user_id = ? AND character_image_source NOT IN ('', 'manual') AND character_image_path <> ''
		   AND origin <> 'removed'
		 GROUP BY character_image_source`, uid, uid)
	if err != nil {
		olog.Tracef("[meta] supplied by source, characters: %v", err)
		return out
	}
	defer crow.Close()
	for crow.Next() {
		var src string
		var n int
		if crow.Scan(&src, &n) == nil {
			got := out[src]
			got.fields += n
			out[src] = got
		}
	}
	return out
}

// sourceRows composes the list the console draws.
func (s *Server) sourceRows(uid int64) []sourceRow {
	counts := s.suppliedBySource(uid)
	out := make([]sourceRow, 0, len(sourceAreas))
	for _, src := range sourceAreas {
		row := sourceRow{
			Source: src.slug,
			Areas:  src.areas,
			State:  s.sourceState(src.slug),
			Fields: counts[src.slug].fields,
			Works:  counts[src.slug].works,
			People: counts[src.slug].people,
		}
		// THE LAST WORD FROM THE AREA IT LEADS IN. A supplier can be recorded in
		// two areas — TheTVDB answers film lookups and picture searches — and the
		// row shows the newest of them, because what the reader is asking is "did
		// this thing answer me recently", not "how is its posters division".
		// COMPARED AS TIMES AND NOT AS THE STRINGS THEY ARE SENT AS. RFC3339 is
		// truncated to the second, so two outcomes in the same second compared
		// equal and the older one won — which on a "Test every source" press,
		// where the calls land milliseconds apart, is the wrong answer arriving
		// silently.
		var newest time.Time
		for _, area := range src.areas {
			o := s.lookups.latest(area, src.slug)
			if o == nil || (row.Last != nil && !o.CheckedAt.After(newest)) {
				continue
			}
			newest = o.CheckedAt
			row.Last = &sourceLast{
				OK: o.OK, Found: o.Found, Error: o.Err, Note: o.Note,
				CheckedAt: o.CheckedAt.UTC().Format(time.RFC3339),
			}
		}
		out = append(out, row)
	}
	return out
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
// EVERY SUPPLIER ON THE LIST, and it used to be the four that take a key. The
// owner, looking at the rest with no Test beside them: "why can i not test all the
// metadata sources?" The reason given here was that the picture rungs are scrapes,
// and a synthetic question on a press is how an install earns a rate limit. A press
// is one person asking one question, which is what every lookup already is, so the
// argument held for a timer and never for a button. A scrape is still asked only
// the way the app asks it: Google's image results only once the instance has said
// yes to reading them, Amazon's product page only with the cookie that consents to
// it (without one, the keyless cover address is what the app uses, so that is what
// is asked).
var testableSources = []string{
	"google", "openlibrary", "amazon", "tmdb", "tvdb", "imdb", "letterboxd",
	"igdb", "wikidata", "google-images", "wikimedia", "fandom",
}

// THE SUBJECTS, AND WHY THESE. Each is old enough to be in every catalogue that
// claims to hold its medium, and distinctive enough that a match is unambiguous.
// A supplier answering nothing to these has something wrong with it.
//
// Dune's is the Ace paperback, whose ISBN-10 is also its Amazon ASIN; Metropolis's
// IMDb id is the 1927 film's; Fritz Lang made it; Harry Potter's wiki is the one
// Fandom is best known for.
const (
	probeBook      = "Dune"
	probeISBN      = "9780441013593"
	probeASIN      = "0441013597"
	probeFilm      = "Metropolis"
	probeIMDb      = "tt0017136"
	probeGame      = "Tetris"
	probePerson    = "Fritz Lang"
	probeCharacter = "Harry Potter"
	probeWiki      = "harrypotter"
)

// testedWith names the probe that answers for a supplier with no probe of its own.
//
// ONE BOOK SEARCH ASKS BOTH BOOK SUPPLIERS, and each is recorded with its own
// answer (recordBooksLookup says how). Test all ran it twice, once per row, which
// spent Google's quota twice and recorded each supplier twice for one press.
var testedWith = map[string]string{"openlibrary": "google"}

// testDeadline bounds a whole press. The server's write timeout is 60 seconds
// (cmd/tippani), each outbound call may take 10, and a slow rung makes several —
// asked one after another, twelve suppliers could run past the timeout and the
// reply be cut off with none of their answers in it. So they are asked together,
// and a supplier still quiet at the deadline is recorded as quiet. A variable
// only so a test can shorten it.
var testDeadline = 30 * time.Second

// quietBy names a failure the deadline caused as that, rather than as whichever
// transport error the cancelled call happened to surface.
func quietBy(ctx context.Context, err error) error {
	if err != nil && errors.Is(ctx.Err(), context.DeadlineExceeded) {
		return fmt.Errorf("no answer within %s", testDeadline)
	}
	return err
}

// testSource asks one supplier and records the outcome where every other lookup
// records it. False means it could not be asked at all — no key — which is NOT
// the same as a supplier that was asked and did not answer.
//
// A RATING FOUND THIS SILENT. It used to fall through, record nothing, and hand
// back a row with no `last` on it: pressing Test on a keyless TMDB said absolutely
// nothing, which is the one thing a button must never do. The screen disables the
// press for a row in that state, and this is the other half of the same fact, for
// the race where a key is cleared between the render and the press.
func (s *Server) testSource(ctx context.Context, slug string) bool {
	record := func(area string, found int, note string, err error) {
		s.recordLookup(area, slug, found, note, quietBy(ctx, err))
	}
	// reached is for the five rungs that report nothing on failure: when one
	// found nothing, whether its host answered is what separates "found nothing"
	// from "could not be asked" (metadata.Reachable says why).
	reached := func(area string, found int, note, wiki string) {
		var err error
		if found == 0 {
			err = metadata.Reachable(ctx, slug, wiki)
		}
		record(area, found, note, err)
	}
	switch slug {
	case "google":
		gkey, _ := s.Store.GetSetting(settingGoogleBooksKey)
		// THE SAME SEAM EVERY BOOK LOOKUP GOES THROUGH, not metadata.SearchBooks
		// directly. A Test that reached past the seam would be a second way of
		// asking, and the whole argument above is that there must not be one.
		cands, err := s.searchBooks(ctx, "", probeBook, "", gkey)
		s.recordBooksLookup(ctx, cands, quietBy(ctx, err))
	case "amazon":
		if cookie, _ := s.Store.GetSetting(settingAmazonCookie); cookie != "" {
			domain, _ := s.Store.GetSetting(settingAmazonDomain)
			a, err := metadata.FetchAmazonBook(ctx, probeASIN, cookie, domain)
			found := 0
			if err == nil && a != nil {
				found = 1
			}
			record(faultAreaBooks, found, "", err)
			break
		}
		found := 0
		for _, u := range amazonCoverURLs(probeISBN, "") {
			if metadata.ImageIsReal(ctx, u) {
				found++
			}
		}
		reached(faultAreaPictures, found, "", "")
	case "tmdb":
		client, _ := s.resolveTMDB()
		if client == nil {
			return false
		}
		cands, err := client.Search(ctx, probeFilm, 0)
		record(faultAreaFilms, len(cands), "", err)
	case "tvdb":
		client, _ := s.resolveTVDB()
		if client == nil {
			return false
		}
		cands, err := client.Search(ctx, probeFilm, 0, "movie")
		record(faultAreaFilms, len(cands), "", err)
	case "imdb":
		_, cast, err := metadata.IMDbCast(ctx, probeIMDb)
		record(faultAreaFilms, len(cast), "", err)
	case "letterboxd":
		// A PAGE IT CANNOT READ IS NOTHING RATHER THAN AN ERROR (LetterboxdDetails
		// says why), so the host is asked when it found nothing.
		det, err := metadata.LetterboxdDetails(ctx, probeFilm)
		found := 0
		if det != nil {
			found = 1
		}
		if err != nil {
			record(faultAreaFilms, found, "", err)
			break
		}
		reached(faultAreaFilms, found, "", "")
	case "igdb":
		client, _ := s.resolveIGDB()
		if client == nil {
			return false
		}
		cands, err := client.Search(ctx, probeGame, 0)
		record(faultAreaGames, len(cands), "", err)
	case "wikidata":
		cands, err := metadata.SearchGamesWikidata(ctx, probeGame, 0)
		record(faultAreaGames, len(cands), "", err)
	case "google-images", "wikimedia", "fandom":
		// THE PICTURE LADDER'S OWN RUNG, built as a picture search builds it, so
		// the opt-in that keeps Google's rung absent keeps its Test from running.
		var tier *imageTier
		switch slug {
		case "google-images":
			tier = s.googleScrapeTier(probeFilm + " 1927 film poster")
		case "wikimedia":
			tier = s.wikimediaPortraitTier(personPin{}, probePerson)
		case "fandom":
			tier = &imageTier{name: "fandom", run: func(ctx context.Context) []metadata.ImageHit {
				return metadata.FandomCharacterImages(ctx, probeCharacter, probeWiki)
			}}
		}
		if tier == nil {
			return false
		}
		hits := tier.run(ctx)
		note := ""
		if tier.note != nil {
			note = *tier.note
		}
		reached(faultAreaPictures, len(hits), note, probeWiki)
	}
	return true
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
	probeOf := func(slug string) string {
		if p, ok := testedWith[slug]; ok {
			return p
		}
		return slug
	}
	var probes []string
	for _, slug := range want {
		if p := probeOf(slug); !slices.Contains(probes, p) {
			probes = append(probes, p)
		}
	}
	// ALL AT ONCE, AND ALL BACK BEFORE THE REPLY: every goroutine here is joined
	// before this handler returns, so none outlives the press that started it.
	ctx, cancel := context.WithTimeout(r.Context(), testDeadline)
	defer cancel()
	asked := make([]bool, len(probes))
	var wg sync.WaitGroup
	for i, p := range probes {
		wg.Go(func() { asked[i] = s.testSource(ctx, p) })
	}
	wg.Wait()

	all := s.sourceRows(userID(r))
	rows := make([]sourceRow, 0, len(want))
	for _, slug := range want {
		if !asked[slices.Index(probes, probeOf(slug))] {
			// SKIPPED, NOT FAILED, when several were asked: "test everything"
			// over an instance with one key is a useful press, and calling the
			// keyless ones broken would be the card crying wolf about the
			// ordinary state of a new install.
			continue
		}
		for _, row := range all {
			if row.Source == slug {
				rows = append(rows, row)
			}
		}
	}
	if len(rows) == 0 {
		// NAMED RATHER THAN ANSWERED WITH SILENCE. One source asked for by name,
		// with no key behind it (or, for Google's image results, not switched on),
		// gets a reason — the screen disables that press, so reaching here means
		// the setting went away between the render and the press and the reader
		// deserves to be told which.
		writeErr(w, http.StatusConflict, "that source is not set up on this server, so it cannot be asked")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"sources": rows})
}
