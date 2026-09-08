package httpapi

// THE COLUMN HAS TO LEARN THE WORD, not just the two lists.
//
// The kind vocabulary lives in three places that must agree: QUOTE_KINDS in the
// client, quoteKinds in Go, and a CHECK on utterances.kind. The first two are
// edits; the third is a migration, and 0067 is the one that taught the column
// `poem`. A test over either list would pass with the migration missing and every
// save of a poem failing on a constraint error naming a column.
//
// SO THIS SAVES ONE, which is the only way to ask the CHECK anything.

import (
	"net/http"
	"strings"
	"testing"
)

func TestAPoemCanBeSavedAndAnInventedKindCannot(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	got := newUtterance(t, c, map[string]any{
		"quote": "Turning and turning in the widening gyre\nThe falcon cannot hear the falconer;",
		"speaker": "W. B. Yeats", "work_title": "The Second Coming", "kind": "poem",
	})
	if got.Kind != "poem" {
		t.Fatalf("saved a poem and it came back as %q", got.Kind)
	}
	// AND THE LINE BREAKS ARE THE TEXT, for a poem more than for anything else in
	// the library. A store that folded whitespace would make every poem prose.
	if want := "gyre\nThe falcon"; !strings.Contains(got.Quote, want) {
		t.Errorf("the stored quote is %q — a poem's line breaks are its text", got.Quote)
	}
	// The vocabulary is still a vocabulary.
	c.mustDo("POST", "/quotes", map[string]any{
		"quote": "x", "kind": "haiku"}, http.StatusBadRequest)
}
