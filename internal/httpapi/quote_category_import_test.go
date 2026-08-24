package httpapi

// The category, the language and the translation through the Markdown round trip
// and the staging queue (0035).
//
// THE ROUND TRIP IS THE LOAD-BEARING TEST, for the reason import_quotes_test.go
// records: an exporter and an importer that disagree do not fail, they lose the
// field quietly and the user finds out months later. 0034 supplied the proof —
// `translator` was nearly dropped on the way into the staging queue, and the
// import would have reported success with matching counts.
//
// So there are three separate assertions about the same three fields, because
// there are three separate places they can be lost: the file, the queue, and the
// approval.

import (
	"net/http"
	"strings"
	"testing"
)

type stagedQuotesListResp struct {
	Quotes []stagedQuoteRow `json:"quotes"`
}

func TestTheCategoryRoundTripsThroughMarkdown(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	newUtterance(t, c, proverb()) // Bengali, with an English translation
	speech := bose()
	speech["category"] = "speech"
	newUtterance(t, c, speech)

	md := exportQuotes(t, c, nil)
	// The file has to SAY so, or the parser has nothing to read. Asserted on the
	// text rather than only on the row that comes back, so a failure says which
	// side of the trip broke.
	for _, want := range []string{
		"- category: proverb",
		"- language: Bengali",
		"- translation: The thief's mother has the loudest voice",
		"- category: speech",
	} {
		if !strings.Contains(md, want) {
			t.Errorf("the export is missing %q:\n%s", want, md)
		}
	}

	// A second account imports it, so this is a real trip rather than a no-op
	// against rows that already exist.
	bob := addUser(t, h, c, "bob")
	staged := stageQuotesMD(t, bob, "tippani-quotes.md", md)
	approveBatch(t, bob, staged.BatchID)

	got := decode[utterancesResp](t, bob.mustDo("GET", "/quotes", nil, http.StatusOK))
	if len(got.Utterances) != 2 {
		t.Fatalf("expected two quotes back, got %d", len(got.Utterances))
	}
	byQuote := map[string]utteranceRow{}
	for _, u := range got.Utterances {
		byQuote[u.Quote] = u
	}
	p, ok := byQuote["চোরের মায়ের বড় গলা"]
	if !ok {
		t.Fatalf("the proverb did not survive: %+v", got.Utterances)
	}
	if p.Category != "proverb" {
		t.Fatalf("the category was lost on the way back in: %+v", p)
	}
	if p.Language != "Bengali" {
		t.Fatalf("the language was lost: %+v", p)
	}
	if p.Translation != "The thief's mother has the loudest voice" {
		t.Fatalf("the translation was lost: %q", p.Translation)
	}
	if s := byQuote["Give me blood, and I will give you freedom"]; s.Category != "speech" {
		t.Fatalf("the speech came back as %q", s.Category)
	}
}

// 'other' is left out of the file for the same reason yellow is: a library of
// ordinary quotes exports exactly as it did before the boards existed, so an
// export diffs clean against an older file. It still comes back as 'other',
// because that is the default on both sides.
func TestAnOtherIsNotWrittenToTheFile(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	newUtterance(t, c, bose()) // no category -> other

	md := exportQuotes(t, c, nil)
	if strings.Contains(md, "- category:") {
		t.Fatalf("the residual bucket should not be written out:\n%s", md)
	}

	bob := addUser(t, h, c, "bob")
	staged := stageQuotesMD(t, bob, "q.md", md)
	approveBatch(t, bob, staged.BatchID)
	got := decode[utterancesResp](t, bob.mustDo("GET", "/quotes", nil, http.StatusOK))
	if len(got.Utterances) != 1 || got.Utterances[0].Category != "other" {
		t.Fatalf("a file with no category must import as other: %+v", got.Utterances)
	}
}

// THE QUEUE IS THE PLACE 0034 NEARLY LOST A FIELD. staged_quotes is a separate
// table read by two separate queries, so a column the queue does not carry is a
// field that survives the export, survives the parse, and is dropped on the way
// in — with a successful import and matching counts saying nothing happened.
func TestTheStagingQueueHoldsTheCategory(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	md := "---\ntype: quotes\n---\n\n> চোরের মায়ের বড় গলা\n" +
		"- category: proverb\n- language: Bengali\n- translation: The thief's mother has the loudest voice\n"
	stageQuotesMD(t, c, "q.md", md)

	listed := decode[stagedQuotesListResp](t, c.mustDo("GET", "/import/staged", nil, http.StatusOK))
	if len(listed.Quotes) != 1 {
		t.Fatalf("expected one staged quote, got %d", len(listed.Quotes))
	}
	q := listed.Quotes[0]
	if q.Category != "proverb" || q.Language != "Bengali" || q.Translation == "" {
		t.Fatalf("the queue cannot show what it is about to approve: %+v", q)
	}
}

// A file naming a category that does not exist is a mistake in the FILE, and the
// queue is where a mistake in the file is still cheap to fix. Refusing at
// staging turns it into a 400 that names the bad word; letting it through would
// make it a 500 from 0035's CHECK at approval, after the user has already
// committed to the import.
func TestAFileWithAnUnknownCategoryIsRefused(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	md := "---\ntype: quotes\n---\n\n> Still waters run deep\n- category: aphorism\n"
	rec := c.importFile("/import/markdown", "q.md", []byte(md))
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("got %d, want 400 — %s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), "aphorism") {
		t.Fatalf("the error should name the word the file used: %s", rec.Body.String())
	}

	// And nothing was queued, so the user is not left with a half-staged batch to
	// discard by hand.
	listed := decode[stagedQuotesListResp](t, c.mustDo("GET", "/import/staged", nil, http.StatusOK))
	if len(listed.Quotes) != 0 {
		t.Fatalf("a refused file must stage nothing, got %d", len(listed.Quotes))
	}
}

// A quotes file is hand-written as often as it is exported, so the parser takes
// the obvious alternative KEYS (`lang`, `english`) and does not care about the
// case of the VALUE.
//
// The key itself is still case-sensitive, and deliberately not changed here:
// every binding in every parser in this package matches its key exactly, so
// folding case for `category` alone would make this one key behave unlike the
// eight beside it. Worth doing across the board one day; not as a side effect of
// adding a category.
//
// `kind` WAS A THIRD ALIAS FOR `category` AND IS NOW ITS OWN FIELD (0053), which
// is why this test reads both columns. The three values they share land in the
// same place either way — the board a quote sits on decides its shelf (0036), and
// `category` has decided nothing since — and `letter` and `essay` used to be
// REFUSED outright by importCategory, so nothing that imported before imports
// differently now, and two values that used to be errors have started working.
func TestAHandWrittenCategoryIsForgiving(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	md := "---\ntype: quotes\n---\n\n" +
		"> Least said, soonest mended\n- category: Proverb\n- lang: English\n\n" +
		"> अब पछताए होत क्या\n- kind: PROVERB\n- language: Hindi\n- english: What good is regret now\n"
	staged := stageQuotesMD(t, c, "q.md", md)
	approveBatch(t, c, staged.BatchID)

	all := decode[utterancesResp](t, c.mustDo("GET", "/quotes", nil, http.StatusOK))
	if len(all.Utterances) != 2 {
		t.Fatalf("both quotes should have imported: %+v", all.Utterances)
	}
	byQuote := map[string]utteranceRow{}
	for _, u := range all.Utterances {
		byQuote[u.Quote] = u
	}
	// EITHER KEY, EITHER CASE, produces the kind — `category: Proverb` through the
	// importer's fallback and `kind: PROVERB` directly.
	for q, u := range byQuote {
		if u.Kind != "proverb" {
			t.Fatalf("%q came back with kind %q, want proverb", q, u.Kind)
		}
	}
	// And the `category:` key still writes the column it names, case-folded, so the
	// filter that reads it goes on answering.
	filtered := decode[utterancesResp](t, c.mustDo("GET", "/quotes?category=proverb", nil, http.StatusOK))
	if len(filtered.Utterances) != 1 || filtered.Utterances[0].Category != "proverb" {
		t.Fatalf("`category: Proverb` did not fold into the category column: %+v", filtered.Utterances)
	}
	if e := byQuote["Least said, soonest mended"]; e.Language != "English" {
		t.Fatalf("`lang` should be read as the language: %+v", e)
	}
	if hi := byQuote["अब पछताए होत क्या"]; hi.Translation != "What good is regret now" {
		t.Fatalf("`english` should be read as the translation: %+v", hi)
	}
}
