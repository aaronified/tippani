package httpapi

// A WORK'S AND A BOARD'S OWN ANSWER TO "WHICH TEXT LEADS" (0073).
//
// THE OWNER'S SPEC, whose first sentence had nowhere to live until this column:
// "There will be per work control over whether the cards are to show 1)
// translations above quotations, 2) quotations above translation, 3) no
// translation, 4) no quotations. same control will be there in metadata section
// on per language basis. the work controls will supercede the metadata controls."
//
// THE LADDER WAS BUILT AT BOTH ENDS AND JOINED TO NEITHER. `resolveTextOrder`
// has composed scope -> language -> master since it was written, with tests, and
// NO CALLER SUPPLIED A SCOPE because there was no column to read. Two of the four
// sentences worked and the one that says the work wins was a parameter nobody
// could fill.
//
// WHAT IS WORTH A TEST HERE is not that a string round-trips. It is the three
// ways this would fail in silence:
//
//   - a full-state PUT that forgets the column clears the reader's choice, and
//     nothing on screen says so — the same failure `board_kind_test.go` exists
//     for, and the trap `edit-parity.test.js` was written after;
//   - a plain board skipping validation, because boardReq.normalise RETURNS EARLY
//     for every kind that is not a proverb;
//   - a re-sync from a supplier wiping it, because a supplier has no opinion
//     about how a reader wants their cards to read and must not express one.

import (
	"net/http"
	"testing"
)

// Every container the column exists on, driven through its own endpoint. A table
// rather than three tests, because the whole claim is that the five containers
// behave THE SAME — three near-identical test bodies would be the duplication
// this column's validator was deliberately written as one function to avoid.
type scopeCase struct {
	name string
	// create returns the id; read returns what the server says text_order is;
	// put sends a full-state update carrying `order` (or "" to send the field
	// empty, which is what clearing the control does).
	create func(t *testing.T, c *testClient) int64
	read   func(t *testing.T, c *testClient, id int64) string
	put    func(t *testing.T, c *testClient, id int64, order string, want int)
	// WHAT A SUCCESSFUL PUT ANSWERS, per endpoint, because they do not agree: a
	// book and a film hand the saved row back (200) and a board answers 204. The
	// first cut of this table assumed one status for all three and failed against
	// correct code, which is a test reporting its own assumption as a defect.
	ok int
}

func scopeCases() []scopeCase {
	return []scopeCase{
		{
			name:   "a book",
			create: func(t *testing.T, c *testClient) int64 { return createBook(t, c, "The Dispossessed") },
			read: func(t *testing.T, c *testClient, id int64) string {
				return decode[bookDetail](t, c.mustDo("GET", "/books/"+itoa(id), nil, http.StatusOK)).TextOrder
			},
			put: func(t *testing.T, c *testClient, id int64, order string, want int) {
				c.mustDo("PUT", "/books/"+itoa(id),
					map[string]any{"title": "The Dispossessed", "text_order": order}, want)
			},
			ok: http.StatusOK,
		},
		{
			name: "a film",
			create: func(t *testing.T, c *testClient) int64 {
				return newMovie(t, c, map[string]any{"title": "V for Vendetta"}).ID
			},
			read: func(t *testing.T, c *testClient, id int64) string {
				return movieByID(t, c, id).TextOrder
			},
			put: func(t *testing.T, c *testClient, id int64, order string, want int) {
				c.mustDo("PUT", "/movies/"+itoa(id),
					map[string]any{"title": "V for Vendetta", "text_order": order}, want)
			},
			ok: http.StatusOK,
		},
		{
			// A PLAIN BOARD AND NOT A PROVERB ONE, deliberately: `normalise`
			// returns early for every kind that is not a proverb, so a validation
			// check written after that branch would cover the rare board and let
			// the common one store anything at all.
			name: "a plain board",
			create: func(t *testing.T, c *testClient) int64 {
				return decode[boardRow](t, c.mustDo("POST", "/boards",
					map[string]any{"name": "Others"}, http.StatusCreated)).ID
			},
			read: func(t *testing.T, c *testClient, id int64) string {
				return boardByID(t, c, id).TextOrder
			},
			put: func(t *testing.T, c *testClient, id int64, order string, want int) {
				c.mustDo("PUT", "/boards/"+itoa(id),
					map[string]any{"name": "Others", "text_order": order}, want)
			},
			ok: http.StatusNoContent,
		},
	}
}

func TestAContainerKeepsItsOwnTextOrder(t *testing.T) {
	for _, tc := range scopeCases() {
		t.Run(tc.name, func(t *testing.T) {
			h := newTestServer(t).Handler()
			c := signupAdmin(t, h)
			id := tc.create(t, c)

			// NOTHING IS THE DEFAULT, and it is '' rather than "quote-first":
			// inherit is the absence of a value, so a container with no opinion
			// lets the language and then the master decide. A server answering
			// "quote-first" here would pin every work to the default and the
			// reader's own slider would stop reaching their cards.
			if got := tc.read(t, c, id); got != "" {
				t.Fatalf("a new container should have no opinion, got %q", got)
			}

			tc.put(t, c, id, "trans-first", tc.ok)
			if got := tc.read(t, c, id); got != "trans-first" {
				t.Fatalf("text_order did not survive the save: %q", got)
			}

			// AND CLEARING IT PUTS IT BACK TO INHERIT rather than to the default
			// state. Those are the same bytes on the wire and different meanings
			// on the card: one falls through to the language, the other stops the
			// ladder at the work.
			tc.put(t, c, id, "", tc.ok)
			if got := tc.read(t, c, id); got != "" {
				t.Fatalf("clearing text_order left %q", got)
			}
		})
	}
}

// A STATE THIS SERVER HAS NEVER HEARD OF IS A 400, not a silent drop — the rule
// normalizeTextOrder already follows for the reader's own blob, and for the same
// reason: storing it would put a card into a state the reader cannot reach the
// control for, and cannot clear.
func TestAnInventedTextOrderIsRefused(t *testing.T) {
	for _, tc := range scopeCases() {
		t.Run(tc.name, func(t *testing.T) {
			h := newTestServer(t).Handler()
			c := signupAdmin(t, h)
			id := tc.create(t, c)
			tc.put(t, c, id, "quote-sideways", http.StatusBadRequest)
			if got := tc.read(t, c, id); got != "" {
				t.Fatalf("a refused state was stored anyway: %q", got)
			}
		})
	}
}

// WHITESPACE IS CLEARING IT, not a state. A client sending " " means the same
// thing as a client sending "" — and if it were stored raw, `validTextOrder`
// would never match it again and no control could clear it.
func TestABlankTextOrderClearsRatherThanStores(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	id := createBook(t, c, "The Dispossessed")
	c.mustDo("PUT", "/books/"+itoa(id),
		map[string]any{"title": "The Dispossessed", "text_order": "quote-only"}, http.StatusOK)
	c.mustDo("PUT", "/books/"+itoa(id),
		map[string]any{"title": "The Dispossessed", "text_order": "   "}, http.StatusOK)
	if got := decode[bookDetail](t, c.mustDo("GET", "/books/"+itoa(id), nil, http.StatusOK)).TextOrder; got != "" {
		t.Fatalf("a blank text_order was stored as %q", got)
	}
}
