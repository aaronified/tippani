// EVERY LOCATOR THE QUEUE CARRIES CAN BE CORRECTED IN THE QUEUE.
//
// THE OWNER, on this part of the backlog: "complete import review". The queue's
// own argument, written in the importer, is that "an import guesses, and the queue
// is where a wrong guess gets corrected" — and for eleven fields that argument was
// false. stagedQuoteRow carries all eleven, StagedRow prints six of them, and
// POST /import/staged/bulk could write none: the reader could see that a parser
// had put a speech's occasion in its place field, and could do nothing until after
// approving the row.
//
// THE OTHER FIVE WERE WORSE, because they were not printed either. A proverb's
// region, a letter's recipient and the three that name the text a speech reaches a
// reader through went through the whole queue unseen and landed in the library
// unread.
//
// WHY A TABLE AND NOT ELEVEN TESTS. The decode is by pointer and the write is by
// column name, so the failure mode is a misspelling on ONE field: the request
// succeeds, reports an update, and stores nothing. That is invisible to a test of
// any other field, so every field needs its own round trip and none of them needs
// its own function.

package httpapi

import (
	"net/http"
	"testing"
)

// The eleven, each with the value to send and the reader that gets it back off the
// queue. The getter is what makes this a round trip rather than an echo: it comes
// from GET /import/staged, so a field that decoded into the request and never
// reached a column fails here.
var stagedLocatorFields = []struct {
	json string
	val  string
	get  func(stagedQuoteRow) string
}{
	{"act", "Act II", func(q stagedQuoteRow) string { return q.Act }},
	{"quest", "The Wolven Storm", func(q stagedQuoteRow) string { return q.Quest }},
	{"episode_name", "Ozymandias", func(q stagedQuoteRow) string { return q.EpisodeName }},
	{"speaker", "Hannah Arendt", func(q stagedQuoteRow) string { return q.Speaker }},
	{"occasion", "the Eichmann trial", func(q stagedQuoteRow) string { return q.Occasion }},
	{"place", "Jerusalem", func(q stagedQuoteRow) string { return q.Place }},
	{"region", "Bengal", func(q stagedQuoteRow) string { return q.Region }},
	{"recipient", "Theo van Gogh", func(q stagedQuoteRow) string { return q.Recipient }},
	{"work_title", "Eichmann in Jerusalem", func(q stagedQuoteRow) string { return q.WorkTitle }},
	{"locator", "ch. 15", func(q stagedQuoteRow) string { return q.Locator }},
	{"source_author", "Plato", func(q stagedQuoteRow) string { return q.SourceAuthor }},
}

func TestAStagedRowTakesEveryLocatorItCarries(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	res := stage(t, c, "/import/markdown", "sandworm.md", []byte(stagedBookMD))
	ids := stagedIDs(queue(t, c, ""))
	if len(ids) == 0 {
		t.Fatalf("nothing staged, so nothing below proves anything")
	}
	_ = res

	for _, f := range stagedLocatorFields {
		t.Run(f.json, func(t *testing.T) {
			c.mustDo("POST", "/import/staged/bulk", map[string]any{"ids": ids, f.json: f.val}, 200)
			for _, sq := range queue(t, c, "").Quotes {
				if got := f.get(sq); got != f.val {
					t.Fatalf("%s: sent %q, queue says %q — a field the endpoint decoded and never wrote", f.json, f.val, got)
				}
			}
		})
	}
}

// AN EMPTY STRING CLEARS, and on these eleven that is the case that breaks first.
// Every one is `TEXT NOT NULL DEFAULT ''`, so writing them through nullable() —
// which is correct for chapter and location one block up — stores a NULL into a
// NOT NULL column and fails the whole transaction. The bug would be invisible
// until somebody emptied a box.
func TestClearingAStagedLocatorIsNotAConstraintViolation(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	stage(t, c, "/import/markdown", "sandworm.md", []byte(stagedBookMD))
	ids := stagedIDs(queue(t, c, ""))

	set := map[string]any{"ids": ids}
	for _, f := range stagedLocatorFields {
		set[f.json] = f.val
	}
	c.mustDo("POST", "/import/staged/bulk", set, 200)

	clear := map[string]any{"ids": ids}
	for _, f := range stagedLocatorFields {
		clear[f.json] = ""
	}
	c.mustDo("POST", "/import/staged/bulk", clear, 200)
	for _, sq := range queue(t, c, "").Quotes {
		for _, f := range stagedLocatorFields {
			if got := f.get(sq); got != "" {
				t.Fatalf("%s did not clear: %q", f.json, got)
			}
		}
	}
}

// THE LINE THIS ENDPOINT DRAWS, asserted rather than left in a comment: the queue
// corrects where a line CAME FROM and never what it SAYS. A staged row is a record
// of what the file said, so its text, its note and its translation are not writable
// here — wording is fixed after approval, on a row that is yours.
//
// The check is that the value is IGNORED, not that the request fails. The house
// bulk convention is "absent key = leave alone", and an unknown key decodes to
// nothing at all — so a reader who posts one gets a 200 and no change, which is
// what this asserts. A 400 would be a different contract, and not this one.
func TestTheQueueDoesNotRewriteWhatAFileSaid(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	stage(t, c, "/import/markdown", "sandworm.md", []byte(stagedBookMD))
	before := queue(t, c, "").Quotes
	ids := stagedIDs(queue(t, c, ""))

	c.mustDo("POST", "/import/staged/bulk", map[string]any{
		"ids":         ids,
		"quote":       "something the file never said",
		"note":        "nor this",
		"translation": "nor this either",
	}, http.StatusOK)

	after := queue(t, c, "").Quotes
	if len(after) != len(before) {
		t.Fatalf("the queue changed shape: %d then %d", len(before), len(after))
	}
	for i, sq := range after {
		if sq.Quote != before[i].Quote {
			t.Fatalf("the text was rewritten: %q -> %q", before[i].Quote, sq.Quote)
		}
		if sq.Note != before[i].Note || sq.Translation != before[i].Translation {
			t.Fatalf("note or translation was rewritten: %+v -> %+v", before[i], sq)
		}
	}
}
