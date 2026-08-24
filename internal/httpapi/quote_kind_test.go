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

// An omitted kind is empty and not a 400: a client that has never heard of 0053 is
// not claiming the quote is an 'other', it is saying nothing.
func TestQuoteKindMayBeOmitted(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	id := quoteWithKind(t, c, "a line", "")
	if got := readQuote(t, c, id).Kind; got != "" {
		t.Fatalf("an omitted kind became %q", got)
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

// Case and padding fold, so "Speech" is the same answer as "speech" — the same
// rule the importer and the bulk editor follow.
func TestQuoteKindFoldsCaseAndPadding(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	id := quoteWithKind(t, c, "a line", "  Speech ")
	if got := readQuote(t, c, id).Kind; got != "speech" {
		t.Fatalf("kind came back %q", got)
	}
}

// THE SILENT-LOSS CASE. Every PUT here is full-state, so a client that sends no
// kind is CLEARING it — which is correct and is exactly why the client's
// utteranceState has to carry it. Asserted from both directions so the contract is
// written down rather than assumed.
func TestQuoteKindIsFullState(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	id := quoteWithKind(t, c, "a line", "essay")
	path := "/quotes/" + strconv.FormatInt(id, 10)

	c.mustDo("PUT", path, map[string]any{"quote": "a line", "kind": "essay", "place": "Dhaka"}, http.StatusOK)
	if got := readQuote(t, c, id); got.Kind != "essay" || got.Place != "Dhaka" {
		t.Fatalf("after a carrying PUT: %+v", got)
	}
	// And a PUT that drops it empties it. Not a bug — the shape of the endpoint —
	// but the reason the client must send it on every colour change.
	c.mustDo("PUT", path, map[string]any{"quote": "a line", "place": "Dhaka"}, http.StatusOK)
	if got := readQuote(t, c, id).Kind; got != "" {
		t.Fatalf("a full-state PUT without a kind left %q behind", got)
	}
}

// The old free-text column is still accepted and still stored: it is on every row
// a pre-0053 library holds, the export writes it, and the importer reads it back,
// so refusing it would make a backup taken yesterday fail to restore today.
func TestQuoteMediumStillRoundTrips(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	q := decode[struct{ ID int64 }](t, c.mustDo("POST", "/quotes",
		map[string]any{"quote": "a line", "medium": "radio"}, http.StatusCreated))
	got := readQuote(t, c, q.ID)
	if got.Medium != "radio" {
		t.Fatalf("medium came back %q", got.Medium)
	}
	if got.Kind != "" {
		t.Errorf("the server guessed a kind from a medium it could not read: %q", got.Kind)
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

// A quote with no kind writes no binding, so a shelf exported before 0053 diffs
// clean against a fresh export — the same rule the default colour, the residual
// category and 0047's five already follow.
func TestAQuoteWithNoKindWritesNoBinding(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	newUtterance(t, c, map[string]any{"quote": "plain", "speaker": "somebody"})
	if md := exportQuotes(t, c, nil); strings.Contains(md, "- kind:") {
		t.Fatalf("an unset kind was written anyway:\n%s", md)
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
