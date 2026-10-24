package httpapi

// How much context shows: the cascade quote > work > reader > default, and the rule that
// changing a work's rule only ever CLAMPS quotes down. Through the API only; it reuses the
// prose and helpers of source_context_test.go.

import (
	"net/http"
	"strconv"
	"testing"
)

const (
	quoteFive  = "At one end of it a coloured poster was tacked to the wall."
	quoteSix   = "It depicted simply an enormous face, more than a metre wide."
	quoteSeven = "Nobody came, and the afternoon stretched out like a long road."
)

func (c *testClient) putRule(path string, before, after any, enforce string) map[string]any {
	c.t.Helper()
	return decode[map[string]any](c.t, c.mustDo("PUT", path,
		map[string]any{"before": before, "after": after, "enforce": enforce}, http.StatusOK))
}

func (c *testClient) adjust(kind string, id int64, before, after *string) {
	c.t.Helper()
	body := map[string]any{"kind": kind, "ids": []int64{id}}
	if before != nil {
		body["before"] = *before
	}
	if after != nil {
		body["after"] = *after
	}
	c.mustDo("POST", "/quotes/context-span", body, http.StatusOK)
}

func sp(s string) *string { return &s }

func TestTheCascadeResolvesQuoteOverWorkOverReaderOverDefault(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	book := c.newBook("B")
	hl := c.newHighlight(book, quoteFive) // four paragraphs before, two after
	c.putSource(sourceFields("book", book), "b.txt", []byte(prose))

	if got := c.contextOf("annotation", hl); got.Span != (window{2, 2}) || got.From != "default" {
		t.Fatalf("no rule anywhere: %+v from %s", got.Span, got.From)
	}
	c.putRule("/context-rules/global", 1, 1, "")
	if got := c.contextOf("annotation", hl); got.Span != (window{1, 1}) || got.From != "global" {
		t.Fatalf("the reader's pair: %+v from %s", got.Span, got.From)
	}
	// The work says only "before", so "after" still comes from the reader: halves are independent.
	c.putRule("/context-rules/book/"+strconv.FormatInt(book, 10), 3, nil, "")
	if got := c.contextOf("annotation", hl); got.Span != (window{3, 1}) || got.From != "work" {
		t.Fatalf("the work over the reader: %+v from %s", got.Span, got.From)
	}
	// The quote's own 0 is "nothing, deliberately", and is not the same as unset.
	c.adjust("annotation", hl, nil, sp("0"))
	if got := c.contextOf("annotation", hl); got.Span != (window{3, 0}) || got.From != "quote" || got.After != "" {
		t.Fatalf("the quote's own zero: %+v %q", got.Span, got.After)
	}
	c.adjust("annotation", hl, sp("4"), nil)
	if got := c.contextOf("annotation", hl); got.Span != (window{4, 0}) || got.From != "quote" {
		t.Fatalf("the quote over the work: %+v from %s", got.Span, got.From)
	}
	// Reset to inherited on the quote, then on the work, then on the reader.
	c.adjust("annotation", hl, sp(""), sp(""))
	c.putRule("/context-rules/book/"+strconv.FormatInt(book, 10), nil, nil, "")
	c.putRule("/context-rules/global", nil, nil, "")
	if got := c.contextOf("annotation", hl); got.Span != (window{2, 2}) || got.From != "default" {
		t.Fatalf("everything reset: %+v from %s", got.Span, got.From)
	}
	// Never beyond what is stored: a rule of fifteen shows what the file gave.
	c.putRule("/context-rules/book/"+strconv.FormatInt(book, 10), 15, 15, "")
	if got := c.contextOf("annotation", hl); got.Span != (window{4, 2}) {
		t.Fatalf("the stored ceiling holds: %+v stored %+v", got.Span, got.Stored)
	}
}

func TestEnforcingAWorkRuleOnlyEverClampsQuotesDown(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	book := c.newBook("B")
	a := c.newHighlight(book, quoteFive)   // four before
	b := c.newHighlight(book, quoteSix)    // five before
	cc := c.newHighlight(book, quoteSeven) // six before, never adjusted
	c.putSource(sourceFields("book", book), "b.txt", []byte(prose))
	c.adjust("annotation", a, sp("4"), nil)
	c.adjust("annotation", b, sp("1"), nil)
	rule := "/context-rules/book/" + strconv.FormatInt(book, 10)
	before := func() [3]int {
		return [3]int{c.contextOf("annotation", a).Span.Before, c.contextOf("annotation", b).Span.Before, c.contextOf("annotation", cc).Span.Before}
	}

	// Lowering the rule and enforcing it: the wider one comes down, the narrower stays.
	c.putRule(rule, 2, nil, "clamp")
	if got := before(); got != [3]int{2, 1, 2} {
		t.Fatalf("clamped down, the narrow one untouched: %v", got)
	}
	// Raising it with the same answer expands nothing that was adjusted.
	c.putRule(rule, 5, nil, "clamp")
	if got := before(); got != [3]int{2, 1, 5} {
		t.Fatalf("a raise never widens an adjusted quote: %v", got)
	}
	// Declining to enforce leaves adjustments where they are, even wider than the rule (the
	// four stored paragraphs are all it can show).
	c.adjust("annotation", a, sp("5"), nil)
	c.putRule(rule, 3, nil, "")
	if got := before(); got != [3]int{4, 1, 3} {
		t.Fatalf("not enforced: %v", got)
	}
	// Clearing is the explicit second option, and the only thing that lets a raise reach them.
	out := c.putRule(rule, 5, nil, "clear")
	if out["changed"].(float64) != 2 {
		t.Fatalf("two quotes had adjustments: %v", out)
	}
	if got := before(); got != [3]int{4, 5, 5} {
		t.Fatalf("all follow the rule, up to what is stored: %v", got)
	}
}

func TestAnotherReadersWorkRuleIsNotYoursToSet(t *testing.T) {
	srv := newTestServer(t)
	admin := signupAdmin(t, srv.Handler())
	book := admin.newBook("B")
	other := addUser(t, srv.Handler(), admin, "cara")
	other.mustDo("PUT", "/context-rules/book/"+strconv.FormatInt(book, 10),
		map[string]any{"before": 3}, http.StatusNotFound)
	other.mustDo("PUT", "/context-rules/book/1", map[string]any{"before": 99}, http.StatusBadRequest)
}
