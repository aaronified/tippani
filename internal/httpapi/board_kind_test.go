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

// The rule 0036 insists on, tested in both directions, because a future reader of
// this code will be tempted by exactly one of them.
func TestAKindIsNotAName(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	// Renaming a proverb board keeps it one. The name is the reader's; the kind
	// is what the board holds.
	b := newProverbBoard(t, c, "Proverbs", "Bengali")
	c.mustDo("PUT", "/boards/"+itoa(b.ID), map[string]any{
		"name": "Grandmother", "kind": "proverb", "languages": []string{"Bengali"},
	}, http.StatusNoContent)
	if got := boardByID(t, c, b.ID); got.Kind != "proverb" || got.Name != "Grandmother" {
		t.Fatalf("a renamed proverb board stopped being one: %+v", got)
	}

	// And calling a plain board "Proverbs" does not make it one. This is the
	// case a name-matching implementation would get wrong, and the reader would
	// have no way to see why their board behaved oddly.
	p := newBoard(t, c, "Proverbs")
	if got := boardByID(t, c, p.ID); got.Kind != "proverb" && got.Kind != "plain" {
		t.Fatalf("unexpected kind %q", got.Kind)
	} else if got.Kind == "proverb" {
		t.Fatal("a board called Proverbs was treated as a proverb board by its NAME")
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
