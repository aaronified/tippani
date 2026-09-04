package httpapi

// 0063 on the wire: the six fields a credit and a local character carry, the
// work's own answer about performing versus voicing, and the name field that
// saves a record's spellings in the order the reader put them.

import (
	"net/http"
	"testing"
)

type wireCastRow struct {
	ID           int64  `json:"id"`
	Character    string `json:"character"`
	Actor        string `json:"actor"`
	Description  string `json:"description"`
	CreditNote   string `json:"credit_note"`
	CreditLang   string `json:"credit_lang"`
	Part         string `json:"part"`
	FirstAppears string `json:"first_appears"`
	AgeHere      string `json:"age_here"`
	Aliases      string `json:"aliases"`
}

type wireCast struct {
	Cast      []wireCastRow `json:"cast"`
	ActorRole string        `json:"actor_role"`
}

// EVERY ONE OF THE SIX ROUND-TRIPS. A field that validates and never stores is
// the failure this batch is most exposed to — six columns, one validator loop,
// one set-builder — and it shows on the screen as a box that forgets.
func TestTheSixCreditFieldsRoundTrip(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	m := decode[struct{ ID int64 }](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "Part 2", "media_type": "movie"}, http.StatusCreated))
	row := decode[wireCastRow](t, c.mustDo("POST", "/movies/"+itoa(m.ID)+"/cast",
		map[string]any{"character": "Harry", "actor": "Daniel Radcliffe"}, http.StatusCreated))

	sent := map[string]any{
		"character": "Harry", "actor": "Daniel Radcliffe",
		"credit_note":   "age 17 · and the epilogue at 36",
		"credit_lang":   "English",
		"part":          "Lead",
		"first_appears": "00:02:14",
		"age_here":      "17",
		"aliases":       "Harry Potter\nThe Boy Who Lived",
	}
	got := decode[wireCastRow](t, c.mustDo("PUT", "/cast/"+itoa(row.ID), sent, http.StatusOK))
	for field, want := range map[string]string{
		"credit_note":   got.CreditNote,
		"credit_lang":   got.CreditLang,
		"part":          got.Part,
		"first_appears": got.FirstAppears,
		"age_here":      got.AgeHere,
		"aliases":       got.Aliases,
	} {
		if want != sent[field].(string) {
			t.Errorf("%s came back %q, sent %q", field, want, sent[field])
		}
	}

	// AND A SAVE THAT OMITS THEM LEAVES THEM, which is the pointer contract and
	// the reason for it: five screens write this row and none has a box for every
	// field. The cast panel saves two names; it must not clear a film screen's note.
	after := decode[wireCastRow](t, c.mustDo("PUT", "/cast/"+itoa(row.ID),
		map[string]any{"character": "Harry", "actor": "Daniel Radcliffe"}, http.StatusOK))
	if after.CreditNote != "age 17 · and the epilogue at 36" || after.Part != "Lead" {
		t.Fatalf("a two-name save cleared the credit: %+v", after)
	}
	// An empty string still clears, which is how a reader deletes a note.
	cleared := decode[wireCastRow](t, c.mustDo("PUT", "/cast/"+itoa(row.ID),
		map[string]any{"character": "Harry", "actor": "Daniel Radcliffe", "credit_note": ""},
		http.StatusOK))
	if cleared.CreditNote != "" {
		t.Fatalf("an empty note did not clear: %q", cleared.CreditNote)
	}
}

// TWO CREDITS WAITING FOR A NAME, through the API this time. 0063's index change
// is what allows it; this is the request that used to answer a conflict.
func TestTwoUnnamedCreditsCanBeAddedThroughTheAPI(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	m := decode[struct{ ID int64 }](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "Part 2", "media_type": "movie"}, http.StatusCreated))

	// The flashback nobody has cast, and a dub nobody has named.
	for _, note := range []string{"Godric's Hollow flashback, age 11", "Bengali dub"} {
		got := decode[wireCastRow](t, c.mustDo("POST", "/movies/"+itoa(m.ID)+"/cast",
			map[string]any{"character": "Harry", "actor": ""}, http.StatusCreated))
		c.mustDo("PUT", "/cast/"+itoa(got.ID),
			map[string]any{"character": "Harry", "actor": "", "credit_note": note}, http.StatusOK)
	}
	list := decode[wireCast](t, c.mustDo("GET", "/movies/"+itoa(m.ID)+"/cast", nil, http.StatusOK))
	unnamed := 0
	for _, r := range list.Cast {
		if r.Actor == "" {
			unnamed++
		}
	}
	if unnamed != 2 {
		t.Fatalf("the film holds %d unnamed credits, want 2: %+v", unnamed, list.Cast)
	}
}

// PERFORMED OR VOICED IS THE WORK'S ANSWER, and the derivation is only the
// default. An animated film casts voices and could not say so before 0063.
func TestAWorkMayOverrideWhatItsSecondColumnIs(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	m := decode[struct{ ID int64 }](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "An Animated Film", "media_type": "movie"}, http.StatusCreated))

	// The medium's own answer first.
	before := decode[wireCast](t, c.mustDo("GET", "/movies/"+itoa(m.ID)+"/cast", nil, http.StatusOK))
	if before.ActorRole != "voice" && before.ActorRole != "actor" {
		t.Fatalf("actor_role = %q", before.ActorRole)
	}
	if before.ActorRole != "actor" {
		t.Fatalf("a film derives to actor, got %q", before.ActorRole)
	}

	c.mustDo("PUT", "/movies/"+itoa(m.ID), map[string]any{
		"title": "An Animated Film", "media_type": "movie", "cast_role": "voice",
	}, http.StatusOK)
	after := decode[wireCast](t, c.mustDo("GET", "/movies/"+itoa(m.ID)+"/cast", nil, http.StatusOK))
	if after.ActorRole != "voice" {
		t.Fatalf("the work said voice and the cast list says %q", after.ActorRole)
	}

	// Cleared, the medium answers again — the column is a preference, not a fact
	// the reader has to keep restating.
	c.mustDo("PUT", "/movies/"+itoa(m.ID), map[string]any{
		"title": "An Animated Film", "media_type": "movie", "cast_role": "",
	}, http.StatusOK)
	back := decode[wireCast](t, c.mustDo("GET", "/movies/"+itoa(m.ID)+"/cast", nil, http.StatusOK))
	if back.ActorRole != "actor" {
		t.Fatalf("cleared, the medium should answer actor, got %q", back.ActorRole)
	}

	// AND A THIRD WORD IS REFUSED rather than stored. The column is open text and
	// a typo would make a cast list draw a column with no name.
	c.mustDo("PUT", "/movies/"+itoa(m.ID), map[string]any{
		"title": "An Animated Film", "media_type": "movie", "cast_role": "sung",
	}, http.StatusBadRequest)
}

type recordNamesResp struct {
	Name    string   `json:"name"`
	Aliases []string `json:"aliases"`
}

// THE NAME FIELD IS ONE FIELD, and its first line prints. Promoting an alias is
// then a line move rather than a two-box dance that can fail halfway.
func TestTheNameFieldWritesTheNameAndTheOrderedSpellings(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	made := decode[struct{ ID int64 }](t, c.mustDo("POST", "/characters",
		map[string]any{"name": "Harry"}, http.StatusCreated))

	got := decode[recordNamesResp](t, c.mustDo("PUT", "/characters/"+itoa(made.ID)+"/names",
		map[string]any{"text": "Harry Potter\nThe Boy Who Lived\nThe Chosen One"}, http.StatusOK))
	if got.Name != "Harry Potter" {
		t.Fatalf("the first line did not become the name: %+v", got)
	}
	// THE ORDER IS THE READER'S, not alphabetical: "The Boy Who Lived" sorts after
	// "The Chosen One" and must come back first because that is where it was put.
	if len(got.Aliases) != 2 || got.Aliases[0] != "The Boy Who Lived" || got.Aliases[1] != "The Chosen One" {
		t.Fatalf("spellings came back %v", got.Aliases)
	}

	// PROMOTION IS A LINE MOVE. The same three names, reordered, and the printing
	// name follows.
	moved := decode[recordNamesResp](t, c.mustDo("PUT", "/characters/"+itoa(made.ID)+"/names",
		map[string]any{"lines": []string{"The Chosen One", "Harry Potter", "The Boy Who Lived"}},
		http.StatusOK))
	if moved.Name != "The Chosen One" || moved.Aliases[0] != "Harry Potter" {
		t.Fatalf("after the move: %+v", moved)
	}

	// A FIELD WITH NOTHING IN IT IS REFUSED as a sentence, not a 500: a record
	// with no name is a record nobody can find again.
	c.mustDo("PUT", "/characters/"+itoa(made.ID)+"/names",
		map[string]any{"text": "\n  \n"}, http.StatusConflict)

	// AND A DUPLICATE LINE IS FOLDED rather than refused — a reader who typed one
	// spelling twice made a mistake, not a request.
	folded := decode[recordNamesResp](t, c.mustDo("PUT", "/characters/"+itoa(made.ID)+"/names",
		map[string]any{"lines": []string{"Harry Potter", "Harry", "Harry"}}, http.StatusOK))
	if len(folded.Aliases) != 1 || folded.Aliases[0] != "Harry" {
		t.Fatalf("the duplicate was not folded: %+v", folded)
	}
}

// A SPELLING ANOTHER RECORD HOLDS IS REFUSED BEFORE ANYTHING IS WRITTEN, so a
// field with one bad line changes nothing rather than applying the good lines.
func TestTheNameFieldRefusesASpellingSomebodyElseHolds(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	a := decode[struct{ ID int64 }](t, c.mustDo("POST", "/characters",
		map[string]any{"name": "Harry"}, http.StatusCreated))
	b := decode[struct{ ID int64 }](t, c.mustDo("POST", "/characters",
		map[string]any{"name": "Ron"}, http.StatusCreated))
	c.mustDo("PUT", "/characters/"+itoa(b.ID)+"/names",
		map[string]any{"lines": []string{"Ron", "Ronald Weasley"}}, http.StatusOK)

	c.mustDo("PUT", "/characters/"+itoa(a.ID)+"/names",
		map[string]any{"lines": []string{"Harry", "Ronald Weasley"}}, http.StatusConflict)

	// Nothing moved: Harry kept his name and gained no spelling.
	still := decode[recordNamesResp](t, c.mustDo("GET", "/characters/"+itoa(a.ID), nil, http.StatusOK))
	if still.Name != "Harry" || len(still.Aliases) != 0 {
		t.Fatalf("the refused save wrote something: %+v", still)
	}
}

// A CHARACTER'S IN-WORLD BIRTHDAY ROUND-TRIPS. A person has had one since the
// table existed; a character's had nowhere to go.
func TestACharacterCanCarryABirthday(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	made := decode[struct{ ID int64 }](t, c.mustDo("POST", "/characters",
		map[string]any{"name": "Harry"}, http.StatusCreated))
	got := decode[struct {
		Born string `json:"born"`
	}](t, c.mustDo("PUT", "/characters/"+itoa(made.ID),
		map[string]any{"born": "31 July 1980"}, http.StatusOK))
	if got.Born != "31 July 1980" {
		t.Fatalf("born came back %q", got.Born)
	}
}

// A BOOK'S CHARACTER STILL REVIVES ITS TOMBSTONE, which 0063's index change
// nearly cost every book in the library.
//
// THE TRAP, recorded because it is not obvious: on a book every character has an
// EMPTY actor_key — a novel has speakers, not a cast — so relaxing "an unnamed
// credit cannot be taken" without excepting tombstones stops the revival path for
// every book character there is. cast_description_test.go caught it; this states
// the rule directly rather than as a side effect of a description round-trip, and
// asserts the count, which that test does not.
func TestABookCharacterRevivesRatherThanDuplicating(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	b := decode[struct{ ID int64 }](t, c.mustDo("POST", "/books",
		map[string]any{"title": "The Master and Margarita"}, http.StatusCreated))
	base := "/books/" + itoa(b.ID) + "/cast"
	// A quote naming the character is what makes the delete a tombstone rather
	// than an outright removal — see handleDeleteCast.
	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": b.ID, "quote": "A cat the size of a hog", "character": "Behemoth",
	}, http.StatusCreated)

	first := decode[wireCastRow](t, c.mustDo("POST", base,
		map[string]any{"character": "Behemoth"}, http.StatusCreated))
	c.mustDo("PUT", "/cast/"+itoa(first.ID),
		map[string]any{"character": "Behemoth", "part": "A cat"}, http.StatusOK)
	c.mustDo("DELETE", "/cast/"+itoa(first.ID), nil, http.StatusNoContent)

	back := decode[wireCastRow](t, c.mustDo("POST", base,
		map[string]any{"character": "Behemoth"}, http.StatusCreated))
	if back.ID != first.ID {
		t.Fatalf("a second row was made instead of reviving: %d then %d", first.ID, back.ID)
	}
	if back.Part != "A cat" {
		t.Fatalf("reviving lost what the row carried: %+v", back)
	}
	list := decode[wireCast](t, c.mustDo("GET", base, nil, http.StatusOK))
	if len(list.Cast) != 1 {
		t.Fatalf("the book holds %d cast rows, want 1: %+v", len(list.Cast), list.Cast)
	}
}

// AND A FILM'S UNNAMED CREDITS ARE STILL SEVERAL, so the two rules coexist
// rather than one having quietly replaced the other.
func TestAFilmKeepsSeveralUnnamedCreditsWhileABookRevives(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	m := decode[struct{ ID int64 }](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "Part 2", "media_type": "movie"}, http.StatusCreated))
	base := "/movies/" + itoa(m.ID) + "/cast"
	a := decode[wireCastRow](t, c.mustDo("POST", base,
		map[string]any{"character": "Harry", "actor": ""}, http.StatusCreated))
	d := decode[wireCastRow](t, c.mustDo("POST", base,
		map[string]any{"character": "Harry", "actor": ""}, http.StatusCreated))
	if a.ID == d.ID {
		t.Fatal("the second unnamed credit revived the first instead of being its own row")
	}
}

// AND ON THE WAY IN, NOT ONLY ON THE WAY THROUGH — which the case above does not
// check, and its own header says why that matters: "six columns, one validator
// loop, one set-builder". There are TWO set-builders. It POSTs `{character,
// actor}` and asserts the six survive a PUT, so the add path was free to accept
// all six, validate all six and store none, and did.
//
// WHAT IT COST. "Add a dubbing credit" on the character sheet sends `credit_lang`
// and nothing else makes a credit a dub — `creditsFor` on the client splits on
// exactly that field — so a language typed into it was validated, answered 201,
// dropped, and the row came back filed under the original cast. A write that
// succeeds while the screen denies it, with nothing anywhere reporting a fault.
func TestTheSixCreditFieldsSurviveTheADDPathToo(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	m := decode[struct{ ID int64 }](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "Part 2", "media_type": "movie"}, http.StatusCreated))

	// Every one of the six, on the POST itself.
	row := decode[wireCastRow](t, c.mustDo("POST", "/movies/"+itoa(m.ID)+"/cast", map[string]any{
		"character":     "Harry",
		"actor":         "Rajesh Kava",
		"credit_note":   "the Hindi dub, all releases",
		"credit_lang":   "Hindi",
		"part":          "Lead",
		"first_appears": "00:02:14",
		"age_here":      "17",
		"aliases":       "Harry Potter",
	}, http.StatusCreated))

	for field, got := range map[string]string{
		"credit_note":   row.CreditNote,
		"credit_lang":   row.CreditLang,
		"part":          row.Part,
		"first_appears": row.FirstAppears,
		"age_here":      row.AgeHere,
		"aliases":       row.Aliases,
	} {
		if got == "" {
			t.Errorf("POST /movies/{id}/cast accepted %s and stored nothing", field)
		}
	}
	// THE LANGUAGE IS THE ONE THAT DECIDES A SCREEN, so it is asserted by value
	// rather than by emptiness: a dub filed under the original cast is what the
	// reader actually sees when this is wrong.
	if row.CreditLang != "Hindi" {
		t.Errorf("credit_lang = %q, want %q — a dub whose language is gone is not a dub", row.CreditLang, "Hindi")
	}

	// AND ON THE REVIVE BRANCH, the other way a POST creates a visible credit.
	// Re-adding a dub somebody removed is exactly when a language is lost twice.
	c.mustDo("DELETE", "/cast/"+itoa(row.ID), nil, http.StatusNoContent)
	again := decode[wireCastRow](t, c.mustDo("POST", "/movies/"+itoa(m.ID)+"/cast", map[string]any{
		"character": "Harry", "actor": "Rajesh Kava", "credit_lang": "Bengali",
	}, http.StatusCreated))
	if again.CreditLang != "Bengali" {
		t.Errorf("reviving a tombstoned credit dropped its language: %q", again.CreditLang)
	}
}
