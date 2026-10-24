package httpapi

import (
	"net/http"
	"strconv"
	"strings"
	"testing"
)

// A standalone quote's `kind` (0053), end to end.
//
// WHAT IS AT RISK. `kind` is a fixed vocabulary on a column with a CHECK, reached
// by a full-state PUT, and it round-trips through the Markdown export and back in
// through the staging queue. Each of those is a place where a field is quietly
// dropped and the reply still says 200: the PUT clears what it does not carry, and
// the export/import pair silently loses whatever the parser has no name for. Both
// have happened in this repo before, to `translator` (0034) and to `character`
// (0047), which is why the assertions below are on the value AFTER the round trip
// rather than on the request being accepted.

func quoteWithKind(t *testing.T, c *testClient, text, kind string) int64 {
	t.Helper()
	body := map[string]any{"quote": text}
	if kind != "" {
		body["kind"] = kind
	}
	q := decode[struct{ ID int64 }](t, c.mustDo("POST", "/quotes", body, http.StatusCreated))
	return q.ID
}

type kindRow struct {
	Quote  string `json:"quote"`
	Kind   string `json:"kind"`
	Medium string `json:"medium"`
	Place  string `json:"place"`
}

// There is no GET for one quote — the board reads the list — so a single row is
// picked out of it by id, which is also the read the client actually makes.
func readQuote(t *testing.T, c *testClient, id int64) kindRow {
	t.Helper()
	list := decode[struct {
		Utterances []struct {
			ID int64 `json:"id"`
			kindRow
		} `json:"utterances"`
	}](t, c.mustDo("GET", "/quotes", nil, http.StatusOK))
	for _, q := range list.Utterances {
		if q.ID == id {
			return q.kindRow
		}
	}
	t.Fatalf("quote %d is not in the list", id)
	return kindRow{}
}

func TestQuoteKindIsStoredAndReported(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	id := quoteWithKind(t, c, "a line", "letter")
	if got := readQuote(t, c, id).Kind; got != "letter" {
		t.Fatalf("kind came back %q", got)
	}
	// On the LIST row too, because that is what the board draws its shelves from —
	// a board that had to fetch each quote singly to caption itself is the thing
	// the two-level screen exists to avoid.
	list := decode[struct {
		Utterances []kindRow `json:"utterances"`
	}](t, c.mustDo("GET", "/quotes", nil, http.StatusOK))
	if len(list.Utterances) != 1 || list.Utterances[0].Kind != "letter" {
		t.Fatalf("list row is %+v", list.Utterances)
	}
}

// A word off the list IS a 400, because a fixed vocabulary that silently accepts
// anything is free text with extra steps — and the CHECK would otherwise report it
// as a 500 from inside the transaction.
func TestQuoteKindRefusesAWordOffTheList(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	rec := c.do("POST", "/quotes", map[string]any{"quote": "x", "kind": "radio"})
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("POST with kind=radio: %d %s", rec.Code, rec.Body)
	}
	if !strings.Contains(rec.Body.String(), "speech") {
		t.Errorf("the refusal does not name the list: %s", rec.Body)
	}
}

// One field across a selection, through the bulk endpoint — and a bad word refused
// there too, before the transaction rather than inside it.
func TestQuoteKindInBulk(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	a := quoteWithKind(t, c, "one", "")
	b := quoteWithKind(t, c, "two", "")

	c.mustDo("POST", "/quotes/bulk",
		map[string]any{"ids": []int64{a, b}, "kind": "Proverb"}, http.StatusOK)
	for _, id := range []int64{a, b} {
		if got := readQuote(t, c, id).Kind; got != "proverb" {
			t.Errorf("quote %d is %q after the bulk set", id, got)
		}
	}
	// Clearing it is a legal set, not a refusal: the empty string is one of the values.
	c.mustDo("POST", "/quotes/bulk", map[string]any{"ids": []int64{a}, "kind": ""}, http.StatusOK)
	if got := readQuote(t, c, a).Kind; got != "" {
		t.Errorf("clearing left %q", got)
	}
	rec := c.do("POST", "/quotes/bulk", map[string]any{"ids": []int64{a}, "kind": "radio"})
	if rec.Code != http.StatusBadRequest {
		t.Errorf("bulk with kind=radio: %d %s", rec.Code, rec.Body)
	}
	// And it is a standalone quote's field only: an annotation has no such column.
	rec = c.do("POST", "/annotations/bulk", map[string]any{"ids": []int64{1}, "kind": "speech"})
	if rec.Code != http.StatusBadRequest {
		t.Errorf("annotations/bulk accepted a kind: %d %s", rec.Code, rec.Body)
	}
}

// ---- through the file, the queue and the approval ---------------------------
//
// THE THREE PLACES A FIELD IS LOST, per per_kind_roundtrip_test.go's reasoning:
// the export may not write the binding, the staging queue may not carry the
// column, and the approval may not copy it. Every one of them succeeds with
// matching counters, which is why this is asserted at each step and into a SECOND
// ACCOUNT — so nothing can be merely matched back onto the row it came from.
func TestAQuoteKindSurvivesItsOwnExport(t *testing.T) {
	h := newTestServer(t).Handler()
	alice := signupAdmin(t, h)

	newUtterance(t, alice, map[string]any{
		"quote": "Dear friend, the rains have come.",
		"kind":  "letter",
	})

	md := exportQuotes(t, alice, nil)
	if !strings.Contains(md, "- kind: letter") {
		t.Fatalf("the export dropped the kind:\n%s", md)
	}

	bob := addUser(t, h, alice, "bob")
	staged := stageQuotesMD(t, bob, "tippani-quotes.md", md)
	if q := oneStaged(t, bob); q.Kind != "letter" {
		t.Fatalf("the queue cannot show the kind it is about to approve: %+v", q)
	}
	approveBatch(t, bob, staged.BatchID)

	got := decode[utterancesResp](t, bob.mustDo("GET", "/quotes", nil, http.StatusOK)).Utterances
	if len(got) != 1 {
		t.Fatalf("approval wrote %d quote(s), want 1", len(got))
	}
	if got[0].Kind != "letter" {
		t.Errorf("the kind was lost on approval: %+v", got[0])
	}
}

// A FILE WRITTEN BEFORE 0053 lands where an UPGRADED DATABASE lands. The one-time
// pass reads `medium` and `category` across; so does the importer, by the same
// rule — otherwise restoring a backup and upgrading in place would give the same
// library two different answers.
func TestAnOldQuotesFileGetsItsKindReadOffTheOldKeys(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	md := "---\ntitle: Quotes\ntype: quotes\n---\n\n" +
		"> Give me blood.\n- speaker: Bose\n- medium: speech\n\n" +
		"> A stitch in time.\n- category: proverb\n\n" +
		"> Static on the wire.\n- medium: radio\n"
	staged := stageQuotesMD(t, c, "old.md", md)
	approveBatch(t, c, staged.BatchID)

	got := decode[utterancesResp](t, c.mustDo("GET", "/quotes", nil, http.StatusOK)).Utterances
	if len(got) != 3 {
		t.Fatalf("approval wrote %d quote(s), want 3: %+v", len(got), got)
	}
	kinds := map[string]string{}
	mediums := map[string]string{}
	for _, u := range got {
		kinds[u.Quote] = u.Kind
		mediums[u.Quote] = u.Medium
	}
	if kinds["Give me blood."] != "speech" {
		t.Errorf("`medium: speech` did not become a kind: %q", kinds["Give me blood."])
	}
	if kinds["A stitch in time."] != "proverb" {
		t.Errorf("`category: proverb` did not become a kind: %q", kinds["A stitch in time."])
	}
	// AND THE ONE IT MUST NOT GUESS AT. "radio" is not one of the five words, so it
	// stays unset — and the text stays on the row, which is what keeps it visible
	// as work to do rather than silently deleted.
	if kinds["Static on the wire."] != "" {
		t.Errorf("the importer guessed a kind from %q: %q", "radio", kinds["Static on the wire."])
	}
	if mediums["Static on the wire."] != "radio" {
		t.Errorf("the value it could not read was destroyed: %q", mediums["Static on the wire."])
	}
}

// A file naming a kind that does not exist is refused at the DOOR, where a mistake
// in a file is still cheap to fix — not at approval, where the CHECK would answer
// 500 three steps later. Same shape as the category's refusal.
func TestAQuoteFileWithABadKindIsRefused(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	md := "---\ntitle: Quotes\ntype: quotes\n---\n\n> x\n- kind: telegram\n"
	rec := c.importFile("/import/markdown", "bad.md", []byte(md))
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("upload with kind=telegram: %d %s", rec.Code, rec.Body)
	}
	if !strings.Contains(rec.Body.String(), "telegram") {
		t.Errorf("the refusal does not name the bad word: %s", rec.Body)
	}
}

// ---- and the anthology caption, which is a sweep miss ------------------------
//
// The "where" line for a standalone quote in an anthology was `place · medium`,
// built in SQL. Every quote saved after 0053 has a kind and an empty medium, so
// that half of the caption silently went blank in the release that moved the
// field — the exact shape of miss the repo's own sweep-check exists for.
//
// It cannot simply become `kind`: that column holds a MACHINE word, and this file
// has never sent English prose. So the kind rides out as its value and the screen
// renders the word — and the medium stays in the locator only while there is no
// kind to say instead, which is the same fallback the cards use.
func TestAnAnthologyCaptionsAQuoteByItsKind(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	withKind := newUtterance(t, c, map[string]any{"quote": "Dear friend", "kind": "letter", "place": "Shilaidaha"})
	oldStyle := newUtterance(t, c, map[string]any{"quote": "Static", "medium": "radio", "place": "Delhi"})

	an := newAnthology(t, c, "A gathering")
	c.mustDo("POST", "/anthologies/"+strconv.FormatInt(an.ID, 10)+"/entries", map[string]any{
		"items": []map[string]any{
			{"kind": "utterance", "item_id": withKind.ID},
			{"kind": "utterance", "item_id": oldStyle.ID},
		},
	}, http.StatusOK)

	got := decode[struct {
		Entries []struct {
			ItemID    int64  `json:"item_id"`
			Locator   string `json:"locator"`
			QuoteKind string `json:"quote_kind"`
		} `json:"entries"`
	}](t, c.mustDo("GET", "/anthologies/"+strconv.FormatInt(an.ID, 10), nil, http.StatusOK))
	if len(got.Entries) != 2 {
		t.Fatalf("gathered %d entries, want 2: %+v", len(got.Entries), got.Entries)
	}
	by := map[int64]struct {
		ItemID    int64  `json:"item_id"`
		Locator   string `json:"locator"`
		QuoteKind string `json:"quote_kind"`
	}{}
	for _, e := range got.Entries {
		by[e.ItemID] = e
	}
	// The kind travels as a machine value; the word is the screen's business.
	if e := by[withKind.ID]; e.QuoteKind != "letter" || e.Locator != "Shilaidaha" {
		t.Errorf("a quote with a kind: locator=%q quote_kind=%q, want Shilaidaha/letter", e.Locator, e.QuoteKind)
	}
	// AND THE MEDIUM IS NOT PRINTED BESIDE IT. Both would read "Shilaidaha ·
	// letter · Letter" on a row the upgrade folded.
	if e := by[withKind.ID]; strings.Contains(strings.ToLower(e.Locator), "letter") {
		t.Errorf("the medium was printed beside the kind: %q", e.Locator)
	}
	// A quote the upgrade could not read keeps its text in the locator, exactly as
	// the cards keep showing it.
	if e := by[oldStyle.ID]; e.QuoteKind != "" || e.Locator != "Delhi · radio" {
		t.Errorf("a quote with no kind: locator=%q quote_kind=%q, want 'Delhi · radio'/''", e.Locator, e.QuoteKind)
	}
}

// ---- a book highlight's character, on the reads that were dropping it -------
//
// 0047 gave a highlight a character and 2.2.3 put it on the library card and in
// the shares. Two SERVER reads went on dropping it: the Shuffle/On-this-day query
// selected the literal empty string for the book branch where the screen branch
// twenty lines below selected the column, and the anthology's book branch credited
// the author alone. Both build the same card the missing name was first reported
// on, which is why "it is not showing up" was still true after the release that
// fixed it.
func TestABookHighlightCarriesItsCharacterEverywhere(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	book := decode[struct {
		ID int64 `json:"id"`
	}](t, c.mustDo("POST", "/books", map[string]any{"title": "Moby-Dick", "author": "Melville"}, http.StatusCreated))
	ann := decode[struct {
		ID int64 `json:"id"`
	}](t, c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book.ID, "quote": "Call me Ishmael", "character": "Ishmael",
	}, http.StatusCreated))

	// Shuffle answers with one random quote, and this library holds exactly one.
	shuffled := decode[struct {
		Quote struct {
			Quote     string `json:"quote"`
			Character string `json:"character"`
		} `json:"quote"`
	}](t, c.mustDo("GET", "/shuffle", nil, http.StatusOK))
	if shuffled.Quote.Quote != "Call me Ishmael" {
		t.Fatalf("shuffle returned %+v", shuffled.Quote)
	}
	if shuffled.Quote.Character != "Ishmael" {
		t.Errorf("shuffle dropped the character: %+v", shuffled.Quote)
	}

	// And the anthology, which is the one output that leaves the app as a document:
	// who says it, then who wrote it, the same shape the screen branch uses.
	an := newAnthology(t, c, "With a speaker")
	c.mustDo("POST", "/anthologies/"+strconv.FormatInt(an.ID, 10)+"/entries", map[string]any{
		"items": []map[string]any{{"kind": "book", "item_id": ann.ID}},
	}, http.StatusOK)
	got := decode[struct {
		Entries []struct {
			Credit string `json:"credit"`
		} `json:"entries"`
	}](t, c.mustDo("GET", "/anthologies/"+strconv.FormatInt(an.ID, 10), nil, http.StatusOK))
	if len(got.Entries) != 1 || got.Entries[0].Credit != "Ishmael · Melville" {
		t.Errorf("anthology credit is %+v, want 'Ishmael · Melville'", got.Entries)
	}
}

// And a highlight with no character credits the author alone, so a library that
// has never used the field reads exactly as it did.
func TestABookHighlightWithNoCharacterCreditsTheAuthorAlone(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	book := decode[struct {
		ID int64 `json:"id"`
	}](t, c.mustDo("POST", "/books", map[string]any{"title": "Moby-Dick", "author": "Melville"}, http.StatusCreated))
	ann := decode[struct {
		ID int64 `json:"id"`
	}](t, c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book.ID, "quote": "a plain line",
	}, http.StatusCreated))
	an := newAnthology(t, c, "Plain")
	c.mustDo("POST", "/anthologies/"+strconv.FormatInt(an.ID, 10)+"/entries", map[string]any{
		"items": []map[string]any{{"kind": "book", "item_id": ann.ID}},
	}, http.StatusOK)
	got := decode[struct {
		Entries []struct {
			Credit string `json:"credit"`
		} `json:"entries"`
	}](t, c.mustDo("GET", "/anthologies/"+strconv.FormatInt(an.ID, 10), nil, http.StatusOK))
	if len(got.Entries) != 1 || got.Entries[0].Credit != "Melville" {
		t.Errorf("credit is %+v, want 'Melville'", got.Entries)
	}
}

// AND THE FOURTH READ. Three passes swept the library card, the shares, Shuffle
// and the anthology; the daily deck's book branch went on selecting no character
// at all, so the quiz card — which is a quote card by any reading of the report —
// still showed none. The field's own doc comment said "screen speaker" and had
// been wrong since 0047.
func TestTheQuizCardCarriesABookHighlightsCharacter(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	// The deck's own fixtures: a real sentence (a cloze needs content words to
	// mask) and aged, because a highlight saved a moment ago is not due yet. Both
	// of those would otherwise give an empty deck, and this test would pass while
	// proving nothing.
	_, ids := seedReviewBook(t, c, "Moby-Dick", 3)
	ageSeededItems(t, srv)

	// Put a character on one of them, through the API the form uses.
	first := decode[pagedAnnotations](t, c.mustDo("GET", "/annotations", nil, http.StatusOK))
	var target annotationRow
	for _, a := range first.Annotations {
		if a.ID == ids[0] {
			target = a
		}
	}
	if target.ID == 0 {
		t.Fatalf("seeded annotation %d not found", ids[0])
	}
	c.mustDo("PUT", "/annotations/"+itoa(ids[0]), map[string]any{
		"quote": target.Quote, "character": "Ishmael", "color": target.Color,
	}, http.StatusOK)

	deck := decode[struct {
		Items []struct {
			ID        int64  `json:"id"`
			Kind      string `json:"kind"`
			Character string `json:"character"`
		} `json:"items"`
	}](t, c.mustDo("GET", "/review/daily?offset=0", nil, http.StatusOK))
	if len(deck.Items) == 0 {
		t.Fatalf("the deck is empty, so this proves nothing: %+v", deck)
	}
	var found bool
	for _, it := range deck.Items {
		if it.Kind != "book" || it.ID != ids[0] {
			continue
		}
		found = true
		if it.Character != "Ishmael" {
			t.Errorf("the quiz card dropped the character: %+v", it)
		}
	}
	if !found {
		t.Fatalf("the highlight with a character is not in the deck: %+v", deck.Items)
	}
}

// ?id= on the three quote lists — one row, by id.
//
// It exists for the review card's in-card edit, which has to PUT full state and
// therefore has to read full state first. The three things worth pinning are the
// three ways a filter like this goes wrong quietly: it narrows on ALL three
// kinds (a filter that works on annotations and is ignored on dialogues returns
// the whole list, which an edit form would then fill from the wrong row), a
// stranger's id is empty rather than readable, and a filter that matches nothing
// says so instead of falling back to everything.

// Each list names its rows after its own kind rather than "items", so the tests
// read whichever key came back. Decoding a fixed key would pass trivially on a
// list it cannot see — zero rows read as zero rows matched.
type quoteListRow struct {
	ID    int64  `json:"id"`
	Quote string `json:"quote"`
}

func quoteListRows(t *testing.T, c *testClient, path string) []quoteListRow {
	t.Helper()
	body := decode[map[string][]quoteListRow](t, c.mustDo("GET", path, nil, http.StatusOK))
	if len(body) != 1 {
		t.Fatalf("GET %s returned %d top-level keys, want 1: %v", path, len(body), body)
	}
	for _, rows := range body {
		return rows
	}
	return nil
}

func TestQuoteListsNarrowToOneRowByID(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	book := createBook(t, c, "Persuasion")
	a1 := idOf(t, c.mustDo("POST", "/annotations", map[string]any{"book_id": book, "quote": "one"}, http.StatusCreated).Body.Bytes())
	c.mustDo("POST", "/annotations", map[string]any{"book_id": book, "quote": "two"}, http.StatusCreated)

	movie := idOf(t, c.mustDo("POST", "/movies", map[string]any{"title": "Casablanca"}, http.StatusCreated).Body.Bytes())
	d1 := idOf(t, c.mustDo("POST", "/dialogues", map[string]any{"movie_id": movie, "quote": "here's looking at you"}, http.StatusCreated).Body.Bytes())
	c.mustDo("POST", "/dialogues", map[string]any{"movie_id": movie, "quote": "round up the usual suspects"}, http.StatusCreated)

	u1 := idOf(t, c.mustDo("POST", "/quotes", map[string]any{"quote": "the unexamined life", "speaker": "Socrates"}, http.StatusCreated).Body.Bytes())
	c.mustDo("POST", "/quotes", map[string]any{"quote": "I know that I know nothing", "speaker": "Socrates"}, http.StatusCreated)

	for _, tc := range []struct {
		path string
		id   int64
		want string
	}{
		{"/annotations", a1, "one"},
		{"/dialogues", d1, "here's looking at you"},
		{"/quotes", u1, "the unexamined life"},
	} {
		t.Run(tc.path, func(t *testing.T) {
			// Two rows exist on every kind, so a filter that is ignored returns two.
			if all := quoteListRows(t, c, tc.path); len(all) != 2 {
				t.Fatalf("%s holds %d rows, the test needs 2", tc.path, len(all))
			}
			rows := quoteListRows(t, c, tc.path+"?id="+itoa(tc.id))
			if len(rows) != 1 {
				t.Fatalf("%s?id=%d returned %d rows, want 1 — the filter was ignored", tc.path, tc.id, len(rows))
			}
			if rows[0].ID != tc.id || rows[0].Quote != tc.want {
				t.Fatalf("%s?id=%d returned id=%d %q, want id=%d %q",
					tc.path, tc.id, rows[0].ID, rows[0].Quote, tc.id, tc.want)
			}
		})
	}
}

// Somebody else's id is an empty list, not their row and not a 403. The
// ownership clause is already in every one of these queries; what this pins is
// that ?id= is an AND on top of it rather than a way round it.
func TestQuoteListByIDCannotReachAnotherAccount(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	owner := signupAdmin(t, h)
	book := createBook(t, owner, "Private")
	mine := idOf(t, owner.mustDo("POST", "/annotations",
		map[string]any{"book_id": book, "quote": "not for you"}, http.StatusCreated).Body.Bytes())

	stranger := addUser(t, h, owner, "stranger")
	if rows := quoteListRows(t, stranger, "/annotations?id="+itoa(mine)); len(rows) != 0 {
		t.Fatalf("a stranger read %d of somebody else's rows by id: %+v", len(rows), rows)
	}
}

type annList struct {
	Annotations []annotationRow `json:"annotations"`
}

// favorite on annotations: accepted on POST/PUT, echoed in
// responses, filterable on GET (PLAN §3).
func TestAnnotationFavorite(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	book := decode[bookDetail](t, c.mustDo("POST", "/books",
		map[string]any{"title": "Dune"}, http.StatusCreated))

	a1 := decode[annotationRow](t, c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book.ID, "quote": "Fear is the mind-killer.",
		"favorite": true,
	}, http.StatusCreated))
	if !a1.Favorite {
		t.Fatalf("a1: %+v", a1)
	}
	a2 := decode[annotationRow](t, c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book.ID, "quote": "The spice must flow.",
	}, http.StatusCreated))
	if a2.Favorite {
		t.Fatalf("a2: %+v", a2)
	}

	// Filters.
	favs := decode[annList](t, c.mustDo("GET", "/annotations?favorite=1", nil, 200))
	if len(favs.Annotations) != 1 || favs.Annotations[0].ID != a1.ID {
		t.Fatalf("favorite filter: %+v", favs.Annotations)
	}
	c.mustDo("GET", "/annotations?favorite=yes", nil, http.StatusBadRequest)

	// Update is full state: omitting favorite clears it.
	upd := decode[annotationRow](t, c.mustDo("PUT", "/annotations/"+itoa(a1.ID), map[string]any{
		"quote": "Fear is the mind-killer.", "color": "yellow",
	}, 200))
	if upd.Favorite {
		t.Fatalf("update: %+v", upd)
	}
}

// favorite + tags on dialogues; tag usage counts span both join
// tables (PLAN §3: one tag vocabulary spans books and movies), and detached
// tags persist in the managed vocabulary (§10 — no auto-GC).
func TestDialogueFavoriteTags(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	movie := decode[movieDetail](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "Casablanca"}, http.StatusCreated))
	book := decode[bookDetail](t, c.mustDo("POST", "/books",
		map[string]any{"title": "Dune"}, http.StatusCreated))
	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book.ID, "quote": "Fear is the mind-killer.", "tags": []string{"shared", "bookish"},
	}, http.StatusCreated)

	d1 := decode[dialogueRow](t, c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": movie.ID, "quote": "Here's looking at you, kid.",
		"tags": []string{"shared", "classic", "Classic", " "}, "favorite": true,
	}, http.StatusCreated))
	if !d1.Favorite || !sameStrings(d1.Tags, []string{"classic", "shared"}) {
		t.Fatalf("d1: %+v", d1)
	}
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": movie.ID, "quote": "Round up the usual suspects.",
	}, http.StatusCreated)

	// The shared vocabulary lists both kinds' tags; "shared" is counted once
	// per join table.
	tg := decode[tagsResp](t, c.mustDo("GET", "/tags", nil, 200))
	if !sameStrings(tagNames(tg.Tags), []string{"bookish", "classic", "shared"}) {
		t.Fatalf("tags: %+v", tg.Tags)
	}
	if sh := tg.Tags[2]; sh.Annotations != 1 || sh.Dialogues != 1 {
		t.Fatalf("shared tag usage: %+v", sh)
	}

	// Filters.
	byTag := decode[dlgList](t, c.mustDo("GET", "/dialogues?tag=classic", nil, 200))
	if len(byTag.Dialogues) != 1 || byTag.Dialogues[0].ID != d1.ID {
		t.Fatalf("tag filter: %+v", byTag.Dialogues)
	}
	favs := decode[dlgList](t, c.mustDo("GET", "/dialogues?favorite=1", nil, 200))
	if len(favs.Dialogues) != 1 || favs.Dialogues[0].ID != d1.ID {
		t.Fatalf("favorite filter: %+v", favs.Dialogues)
	}

	// Update replaces the tag set; the detached "classic" stays in the
	// vocabulary at zero usage, "shared" keeps its annotation use.
	upd := decode[dialogueRow](t, c.mustDo("PUT", "/dialogues/"+itoa(d1.ID), map[string]any{
		"quote": "Here's looking at you, kid.", "tags": []string{"farewell"},
	}, 200))
	if upd.Favorite || !sameStrings(upd.Tags, []string{"farewell"}) {
		t.Fatalf("update: %+v", upd)
	}
	tg = decode[tagsResp](t, c.mustDo("GET", "/tags", nil, 200))
	if !sameStrings(tagNames(tg.Tags), []string{"bookish", "classic", "farewell", "shared"}) {
		t.Fatalf("tags after update: %+v", tg.Tags)
	}
	if cl := tg.Tags[1]; cl.Annotations != 0 || cl.Dialogues != 0 {
		t.Fatalf("classic should be unused: %+v", cl)
	}

	// Dialogue delete drops usage, not the tag.
	c.mustDo("DELETE", "/dialogues/"+itoa(d1.ID), nil, 200)
	tg = decode[tagsResp](t, c.mustDo("GET", "/tags", nil, 200))
	if !sameStrings(tagNames(tg.Tags), []string{"bookish", "classic", "farewell", "shared"}) {
		t.Fatalf("tags after dialogue delete: %+v", tg.Tags)
	}

	// Movie delete cascades dialogues and their join rows; the vocabulary —
	// including the now-unused "movie-only" — persists.
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": movie.ID, "quote": "Play it, Sam.", "tags": []string{"movie-only"},
	}, http.StatusCreated)
	c.mustDo("DELETE", "/movies/"+itoa(movie.ID), nil, 200)
	tg = decode[tagsResp](t, c.mustDo("GET", "/tags", nil, 200))
	if !sameStrings(tagNames(tg.Tags), []string{"bookish", "classic", "farewell", "movie-only", "shared"}) {
		t.Fatalf("tags after movie delete: %+v", tg.Tags)
	}
	for _, tag := range tg.Tags {
		if tag.Dialogues != 0 {
			t.Fatalf("dialogue usage should be gone: %+v", tag)
		}
	}
}

// favorite parsed from a markdown binding survives the import
// (PLAN §5b: markdown/bookcision paths persist the field).
func TestImportMarkdownFavorite(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	md := "---\ntitle: T\n---\n\n> plain quote\n\n> starred quote\n- favorite: yes\n"
	res := decode[importResult](t, c.importApprove("/import/markdown", "t.md", []byte(md)))
	if res.Added != 2 {
		t.Fatalf("import: %+v", res)
	}
	favs := decode[annList](t, c.mustDo("GET", "/annotations?favorite=1", nil, 200))
	if len(favs.Annotations) != 1 || favs.Annotations[0].Quote != "starred quote" {
		t.Fatalf("favorite after import: %+v", favs.Annotations)
	}
}

// A QUOTE SAYS WHO SPOKE IT, on the wire.
//
// `speaker_cast_id` has been a column since 0056 and no handler ever serialised
// it, so the link was correct in the database and invisible everywhere — the app
// could answer "which lines is this character's" from the character's own page and
// could not put a name on the line itself. These pin the half that was missing.
//
// WHAT IS WORTH PINNING HERE, as opposed to what merely works:
//
//   THE CHIP IS NOT THE CHARACTER TEXT. `character` says who is NAMED on the line
//   and is split on the reader's separators; `speaker_cast` says who SPOKE it and
//   is one row or none. A line naming two people has both fields and they disagree
//   on purpose.
//
//   A TOMBSTONE IS NOT A DELETE. 0048 keeps a removed provider row so a refetch
//   recognises and skips it, which means the foreign key's ON DELETE SET NULL
//   never fires for one — a quote written before the removal keeps a live-looking
//   id pointing at a row the reader deleted. Every reader of this column has to
//   guard `origin <> 'removed'`, and this is the case that says so.
//
//   ANOTHER READER'S CAST ROW IS NOT VISIBLE. The lookup restates `user_id`
//   although the id arrives off a row already scoped to the caller; the failure it
//   prevents is silent and would print somebody else's name on your quote.

// speakerOf reads one book quote back through the list endpoint the board uses.
// Through the endpoint rather than the table, because the whole defect being fixed
// was a column that was right and a payload that was silent.
func speakerOf(t *testing.T, c *testClient, bookID int64) *quoteSpeakerCast {
	t.Helper()
	res := decode[struct {
		Annotations []annotationRow `json:"annotations"`
	}](t, c.mustDo("GET", "/annotations?book_id="+itoa(bookID), nil, http.StatusOK))
	if len(res.Annotations) != 1 {
		t.Fatalf("want exactly one annotation, got %d", len(res.Annotations))
	}
	return res.Annotations[0].SpeakerCast
}

func dialogueSpeakerOf(t *testing.T, c *testClient, movieID int64) *quoteSpeakerCast {
	t.Helper()
	res := decode[struct {
		Dialogues []dialogueRow `json:"dialogues"`
	}](t, c.mustDo("GET", "/dialogues?movie_id="+itoa(movieID), nil, http.StatusOK))
	if len(res.Dialogues) != 1 {
		t.Fatalf("want exactly one dialogue, got %d", len(res.Dialogues))
	}
	return res.Dialogues[0].SpeakerCast
}

func TestABookQuoteCarriesTheCastRowItNames(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	book := createBook(t, c, "The Master and Margarita")
	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book, "quote": "Manuscripts don't burn.", "character": "Woland",
	}, http.StatusCreated)

	// Reading the cast is what adopts the quoted name into a row AND links the
	// quote to it — see cast_from_quotes.go. A reader reaches this by opening the
	// People panel; the 3.1.0 one-time pass is what covers everybody else.
	castList(t, c, "books", book)

	sp := speakerOf(t, c, book)
	if sp == nil {
		t.Fatal("the quote carries no speaker_cast, so no chip can be drawn")
	}
	if sp.Name != "Woland" {
		t.Errorf("speaker name = %q, want %q", sp.Name, "Woland")
	}
	if sp.CastID == 0 {
		t.Error("speaker carries no cast_id, so the character panel cannot be opened on this billing")
	}
	// THE RECORD IS THE DESTINATION. Without it the client draws no chip, because
	// there is no page to open — so a payload with a cast id and no character id is
	// the shape that silently produces nothing on screen.
	if sp.CharacterID == 0 {
		t.Error("speaker carries no character_id, so the chip would open nothing")
	}
}

// A FILM LINE, the other half, and it is a separate case rather than a table
// because the two live in two structs whose parity is itself under test.
func TestAFilmLineCarriesTheCastRowItNames(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	movie := newMovie(t, c, map[string]any{"title": "Stalker"}).ID
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": movie, "quote": "Let everything that's been planned come true.",
		"character": "the Stalker", "actor": "Aleksandr Kaydanovskiy",
	}, http.StatusCreated)
	castList(t, c, "movies", movie)

	sp := dialogueSpeakerOf(t, c, movie)
	if sp == nil {
		t.Fatal("the line carries no speaker_cast")
	}
	if sp.Name != "the Stalker" {
		t.Errorf("speaker name = %q, want %q", sp.Name, "the Stalker")
	}
	if sp.CharacterID == 0 {
		t.Error("speaker carries no character_id")
	}
}

// A REMOVED ROW IS STILL IN THE TABLE. This is the guard that is easiest to drop
// and hardest to notice: the row survives as a tombstone so a refetch skips it, so
// the foreign key never nulls the quote's link, so a lookup without the guard
// happily resolves a speaker the reader deleted.
func TestADeletedCastRowStopsBeingASpeaker(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	movie := newMovie(t, c, map[string]any{"title": "Solaris"}).ID
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": movie, "quote": "We don't want other worlds. We want a mirror.",
		"character": "Snaut",
	}, http.StatusCreated)
	rows := castList(t, c, "movies", movie)
	if len(rows) != 1 {
		t.Fatalf("want one cast row, got %d", len(rows))
	}
	if sp := dialogueSpeakerOf(t, c, movie); sp == nil {
		t.Fatal("no speaker before the removal, so this case would prove nothing")
	}

	c.mustDo("DELETE", "/cast/"+itoa(rows[0].ID), nil, http.StatusNoContent)

	if sp := dialogueSpeakerOf(t, c, movie); sp != nil {
		t.Errorf("a deleted cast row is still being drawn as the speaker: %+v", *sp)
	}
}
