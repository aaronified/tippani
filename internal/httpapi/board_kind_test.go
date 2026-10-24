package httpapi

// Board kinds (0037) — what a board HOLDS, which is not what it is called.
//
// The rules worth a test here are the two that would each fail in silence:
//
//   - a kind survives every other edit, because a full-state PUT that forgets it
//     turns a proverb board into a plain one and nothing on screen says so;
//   - a kind is not a name, in both directions — renaming a proverb board keeps
//     it one, and calling a plain board "Proverbs" does not make it one.
//
// The second is the whole reason 0037 added a column instead of matching on the
// name, and it is the rule 0036 spent a paragraph insisting on.

import (
	"net/http"
	"strings"
	"testing"
)

func newProverbBoard(t *testing.T, c *testClient, name string, langs ...string) boardRow {
	t.Helper()
	body := map[string]any{"name": name, "kind": "proverb"}
	if langs != nil {
		body["languages"] = langs
	}
	return decode[boardRow](t, c.mustDo("POST", "/boards", body, http.StatusCreated))
}

func boardByID(t *testing.T, c *testClient, id int64) boardRow {
	t.Helper()
	for _, b := range listBoards(t, c).Boards {
		if b.ID == id {
			return b
		}
	}
	t.Fatalf("board %d is not in the list", id)
	return boardRow{}
}

// What one POST /boards makes of the kind and the languages it was sent. Every
// row is the same three lines — create, read the row back, compare — so they
// differ only in the body and the outcome.
//
// No row saves a quote, so the precondition the first row exists for holds for
// the whole run: this account has nothing 0036's seed could have made a board out
// of.
func TestBoardCreationTakesItsKindAndLanguages(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	// Nothing has been saved, so there is nothing for 0036's seed to have made.
	// Asserted here, above the table, where the account is still untouched.
	if got := listBoards(t, c); len(got.Boards) != 0 {
		t.Fatalf("a fresh account should start with no boards, got %+v", got.Boards)
	}

	cases := []struct {
		name       string
		body       map[string]any
		wantStatus int
		wantKind   string
		wantLangs  []string
	}{
		// The offer the whole feature exists for: a reader with no quotes could
		// not reach Proverbs at all after 0036, because its seed reads FROM
		// utterances. The languages come back in the order they went in.
		{
			name: "a proverb board can be made on an empty account",
			body: map[string]any{
				"name": "Proverbs", "kind": "proverb",
				"languages": []string{"Bengali", "Hindi"},
			},
			wantStatus: http.StatusCreated,
			wantKind:   "proverb",
			wantLangs:  []string{"Bengali", "Hindi"},
		},
		// A board with no kind is plain, so every client written against 1.14.0
		// and every board in an older export keeps working untouched.
		{
			name:       "a board with no kind is plain",
			body:       map[string]any{"name": "Kennedy"},
			wantStatus: http.StatusCreated,
			wantKind:   "plain",
			wantLangs:  []string{},
		},
		// The language list is tidied rather than trusted: blank entries,
		// whitespace, and the same language twice in two casings. The FIRST
		// spelling wins, so a reader's own capitalisation is what is kept rather
		// than whichever casing happened to arrive last. (Named differently from
		// the first row's board because board names are unique per reader,
		// case-insensitively.)
		{
			name: "the language list is tidied rather than trusted",
			body: map[string]any{
				"name": "Sayings", "kind": "proverb",
				"languages": []string{" Bengali ", "", "   ", "bengali", "Hindi"},
			},
			wantStatus: http.StatusCreated,
			wantKind:   "proverb",
			wantLangs:  []string{"Bengali", "Hindi"},
		},
		{
			name:       "an unknown kind is refused",
			body:       map[string]any{"name": "Songs", "kind": "song"},
			wantStatus: http.StatusBadRequest,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			sub := &testClient{t: t, h: h, cookie: c.cookie}
			rec := sub.mustDo("POST", "/boards", tc.body, tc.wantStatus)
			if tc.wantStatus != http.StatusCreated {
				return
			}
			b := decode[boardRow](t, rec)
			if b.Kind != tc.wantKind {
				t.Fatalf("kind = %q, want %q", b.Kind, tc.wantKind)
			}
			got := boardByID(t, sub, b.ID)
			if got.Kind != tc.wantKind {
				t.Fatalf("board did not come back as it went in: %+v", got)
			}
			// Languages are [] rather than null, so a client never has to check
			// for both. A length comparison alone passes on nil, so the null case
			// gets its own check.
			if got.Languages == nil {
				t.Fatal("languages came back null; it must always be an array")
			}
			if !sameStrings(got.Languages, tc.wantLangs) {
				t.Fatalf("languages = %+v, want %+v", got.Languages, tc.wantLangs)
			}
		})
	}
}

// THE TRAP, for the fourth time. 0034 caught it on translator, 0035 on category,
// 0036 on board_id: a writer that was complete on the day it was written becomes
// lossy the moment a column is added beside it. Hiding a board is the one PUT
// that sends every field without the reader having typed any of them.
func TestAFullStatePutCarriesTheKindAndItsLanguages(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	b := newProverbBoard(t, c, "Proverbs", "Bengali")

	// Exactly what the Hide menu item sends: the board's own fields back, plus
	// the one thing that changed.
	c.mustDo("PUT", "/boards/"+itoa(b.ID), map[string]any{
		"name": b.Name, "description": b.Description, "color": b.Color,
		"image_path": b.ImagePath, "hidden": true,
		"kind": b.Kind, "languages": b.Languages,
	}, http.StatusNoContent)

	got := boardByID(t, c, b.ID)
	if !got.Hidden {
		t.Fatal("the board did not hide")
	}
	if got.Kind != "proverb" {
		t.Fatalf("hiding a proverb board made it %q", got.Kind)
	}
	if len(got.Languages) != 1 || got.Languages[0] != "Bengali" {
		t.Fatalf("hiding a board lost its languages: %+v", got.Languages)
	}
}

// Languages belong to a proverb board and are dropped from any other rather than
// refused: switching the kind back is a change of mind, not an error, and a list
// left sitting invisibly in the row would reappear later for no reason.
func TestLanguagesAreDroppedFromAPlainBoard(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	b := newProverbBoard(t, c, "Proverbs", "Bengali", "Hindi")

	c.mustDo("PUT", "/boards/"+itoa(b.ID), map[string]any{
		"name": "Proverbs", "kind": "plain", "languages": []string{"Bengali", "Hindi"},
	}, http.StatusNoContent)

	if got := boardByID(t, c, b.ID); len(got.Languages) != 0 {
		t.Fatalf("a plain board kept its languages: %+v", got.Languages)
	}
}

// EVERY KIND THE APP OFFERS CAN BE CREATED, which for three releases was not
// true and was not tested.
//
// `boardKindSpeech` has been defined and accepted by this handler since 1.15.0
// and the Quotes page has POSTed it from its **Speeches** starter since the same
// release — while 0037's CHECK still refused it. So pressing that starter
// answered 500 (`insert board`), and nothing anywhere said so. This test is the
// one that would have.
//
// 'letter' and 'essay' arrive with 0047 and are covered by the same table for the
// same reason: five values validated in one Go list is one place to forget a
// value, and the chain of `!=` it replaced was that place.
func TestEveryBoardKindTheAppOffersCanBeCreated(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	// WRITTEN OUT, not read from boardKinds. Looping over the vocabulary would make
	// this test a tautology — shrink the list and the loop shrinks with it — which
	// is exactly the shape of the bug it exists to catch, where Go's idea of the set
	// and the schema's disagreed and no assertion named a value.
	want := []string{"plain", "proverb", "speech", "letter", "essay"}
	if !sameStrings(boardKinds, want) {
		t.Fatalf("boardKinds = %v, want %v — if a kind was added on purpose, add it here too "+
			"(and to the Quotes screen, and to both locale files)", boardKinds, want)
	}

	for _, kind := range want {
		b := decode[boardRow](t, c.mustDo("POST", "/boards",
			map[string]any{"name": "board of " + kind, "kind": kind}, http.StatusCreated))
		if b.Kind != kind {
			t.Errorf("posted kind %q, got %q back", kind, b.Kind)
		}
		// Read back through the list, so a kind the INSERT accepted and the SELECT
		// could not render is still a failure.
		if got := boardByID(t, c, b.ID); got.Kind != kind {
			t.Errorf("board of %q came back as %q", kind, got.Kind)
		}
	}

	// The list is the whole constraint now that the CHECK is gone, so the refusal
	// has to come from Go — and it has to NAME the five, because an error that says
	// only "invalid kind" is one a client author cannot act on.
	rec := c.do("POST", "/boards", map[string]any{"name": "Songs", "kind": "lyrics"})
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("an unknown kind answered %d, want 400: %s", rec.Code, rec.Body)
	}
	msg := decode[struct {
		Error string `json:"error"`
	}](t, rec).Error
	for _, kind := range want {
		if !strings.Contains(msg, kind) {
			t.Errorf("the refusal %q does not name %q", msg, kind)
		}
	}
}

