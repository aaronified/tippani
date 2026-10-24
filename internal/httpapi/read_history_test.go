package httpapi

import (
	"net/http"
	"testing"
)

// Editing the read log.
//
// work_reads could only ever be written as a side effect of a status change,
// which records what is happening now and cannot record what happened before. A
// book read three times over fifteen years had one row at best, and there was no
// way to say "I finished this in 2019" about something already on the shelf —
// the log could only be as old as the account.
//
// 1.7.2 then sorted the Library by that log. A sort you cannot correct is worse
// than no sort, which is what makes this a fix rather than an addition.

func readsOf(t *testing.T, c *testClient, path string, id int64) []readRow {
	t.Helper()
	if path == "books" {
		return decode[bookDetail](t, c.mustDo("GET", "/books/"+itoa(id), nil, 200)).Reads
	}
	return decode[movieDetail](t, c.mustDo("GET", "/movies/"+itoa(id), nil, 200)).Reads
}

func TestAPastReadCanBeRecordedEditedAndRemoved(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	book := decode[bookDetail](t, c.mustDo("POST", "/books", map[string]any{
		"title": "Read Long Ago",
	}, http.StatusCreated))

	// Record a read that predates the account entirely.
	got := decode[readRow](t, c.mustDo("POST", "/books/"+itoa(book.ID)+"/reads", map[string]any{
		"started_at": "2009", "finished_at": "2009-06", "outcome": "finished",
	}, http.StatusCreated))
	if got.StartedAt != "2009" || got.FinishedAt != "2009-06" || got.Outcome != "finished" {
		t.Fatalf("created read = %+v", got)
	}
	if rs := readsOf(t, c, "books", book.ID); len(rs) != 1 || rs[0].ID != got.ID {
		t.Fatalf("reads = %+v", rs)
	}

	// Correct it. Partial dates are kept partial — "I read it in 2009" is a real
	// answer and padding it to a January morning would invent a precision that
	// was never there.
	c.mustDo("PUT", "/reads/"+itoa(got.ID), map[string]any{
		"started_at": "2009-03", "finished_at": "2009-06-14", "outcome": "abandoned",
	}, http.StatusOK)
	rs := readsOf(t, c, "books", book.ID)
	if len(rs) != 1 || rs[0].StartedAt != "2009-03" || rs[0].Outcome != "abandoned" {
		t.Fatalf("after edit: %+v", rs)
	}

	c.mustDo("DELETE", "/reads/"+itoa(got.ID), nil, http.StatusNoContent)
	if rs := readsOf(t, c, "books", book.ID); len(rs) != 0 {
		t.Fatalf("after delete: %+v", rs)
	}
}

func TestTheOpenReadIsTheShelfsToOwn(t *testing.T) {
	// The design of the whole feature. shelf.go keeps the status and the log
	// consistent through one path, and the open row IS that consistency — it
	// exists exactly while the work is in progress. Deleting it would leave a
	// book reading with nothing being read; closing it by hand would leave one
	// finished and still on the in-progress shelf.
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	book := decode[bookDetail](t, c.mustDo("POST", "/books", map[string]any{
		"title": "In Progress",
	}, http.StatusCreated))
	c.mustDo("PUT", "/books/"+itoa(book.ID)+"/status", map[string]any{
		"status": "reading", "started_at": "2026-01-02",
	}, http.StatusOK)

	rs := readsOf(t, c, "books", book.ID)
	if len(rs) != 1 || rs[0].Outcome != "open" {
		t.Fatalf("expected one open read, got %+v", rs)
	}
	open := rs[0].ID

	c.mustDo("PUT", "/reads/"+itoa(open), map[string]any{
		"started_at": "2020", "outcome": "finished",
	}, http.StatusConflict)
	c.mustDo("DELETE", "/reads/"+itoa(open), nil, http.StatusConflict)

	// Untouched, and the status control still works on it.
	if rs := readsOf(t, c, "books", book.ID); len(rs) != 1 || rs[0].Outcome != "open" || rs[0].StartedAt != "2026-01-02" {
		t.Fatalf("the open read was changed: %+v", rs)
	}
}

func TestAnOpenReadCannotBeCreatedByHandEither(t *testing.T) {
	// The same rule from the other direction: two open reads on one book would
	// be a state the status machine can neither produce nor resolve.
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	book := decode[bookDetail](t, c.mustDo("POST", "/books", map[string]any{"title": "B"}, http.StatusCreated))
	for _, outcome := range []any{"open", ""} {
		c.mustDo("POST", "/books/"+itoa(book.ID)+"/reads", map[string]any{
			"started_at": "2020", "outcome": outcome,
		}, http.StatusBadRequest)
	}
}

func TestReadHistoryIsPerUser(t *testing.T) {
	// work_reads carries its own user_id and has NO foreign key to books or
	// movies — 0024 says SQLite could not express it across the two tables — so
	// nothing but this check stops a read being hung on somebody else's shelf.
	h := newTestServer(t).Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")

	hers := decode[bookDetail](t, alice.mustDo("POST", "/books", map[string]any{"title": "Hers"}, http.StatusCreated))
	// Bob cannot attach a read to Alice's book, and must not learn it exists.
	bob.mustDo("POST", "/books/"+itoa(hers.ID)+"/reads", map[string]any{
		"started_at": "2020", "outcome": "finished",
	}, http.StatusNotFound)

	mine := decode[readRow](t, alice.mustDo("POST", "/books/"+itoa(hers.ID)+"/reads", map[string]any{
		"started_at": "2020", "outcome": "finished",
	}, http.StatusCreated))
	// And cannot touch the row once it exists. 404, never 403: a 403 would
	// confirm the id is real.
	bob.mustDo("PUT", "/reads/"+itoa(mine.ID), map[string]any{
		"started_at": "1999", "outcome": "finished",
	}, http.StatusNotFound)
	bob.mustDo("DELETE", "/reads/"+itoa(mine.ID), nil, http.StatusNotFound)

	if rs := readsOf(t, alice, "books", hers.ID); len(rs) != 1 || rs[0].StartedAt != "2020" {
		t.Fatalf("alice's read was changed: %+v", rs)
	}
}

// THE DECLARATION, AS THE SERVER KEEPS IT.
//
// It decides which of a quote's two texts a card puts in the big type, so what is
// worth pinning is the round trip: what a reader typed comes back as one stable
// blob whatever order or case they typed it in, and a blob the server cannot read
// means "no declaration" rather than "I read nothing" — because the second reading
// would reorder every card in the library for a preference nobody expressed.

func TestTheDeclarationFoldsDedupesAndSorts(t *testing.T) {
	cases := []struct {
		name, in, want string
		ok             bool
	}{
		{"nothing declared stays nothing", "", "", true},
		{"one language", `["Bengali"]`, `["bengali"]`, true},
		// FOLDED, because the language box is free text and both spellings arrive —
		// language_marks.go folds its keys the same way and for the same reason.
		{"case folds", `["Bengali","bengali","BENGALI"]`, `["bengali"]`, true},
		{"whitespace folds", `["  French  "]`, `["french"]`, true},
		// SORTED, so adding a language and removing it again produces the same
		// bytes and a diff of two accounts' preferences means something.
		{"sorted", `["urdu","bengali","french"]`, `["bengali","french","urdu"]`, true},
		{"an empty array is a withdrawal", `[]`, "", true},
		{"a blank entry is not a language", `["  "]`, "", false},
		{"not an array", `{"bengali":true}`, "", false},
		{"not JSON", `bengali`, "", false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, ok := normalizeReadLanguages(tc.in)
			if ok != tc.ok {
				t.Fatalf("normalizeReadLanguages(%q) ok=%v, want %v (got %q)", tc.in, ok, tc.ok, got)
			}
			if got != tc.want {
				t.Errorf("normalizeReadLanguages(%q) = %q, want %q", tc.in, got, tc.want)
			}
		})
	}
}

// AND AN UNREADABLE BLOB READS AS NO DECLARATION, not as "I read nothing".
//
// THE DIRECTION IS THE WHOLE POINT. An empty set makes canReadLanguage true for
// everything, so a corrupt preference leaves every card exactly as it was. The
// opposite failure — every translated quote in the library suddenly leading with
// its translation — is what a "safe" default of "declares nothing, so reads
// nothing" would produce, from a blob the reader never saw.
func TestACorruptDeclarationChangesNoCard(t *testing.T) {
	if got, ok := normalizeReadLanguages(`{"not":"a list"}`); ok || got != "" {
		t.Fatalf("a bad blob normalised to %q ok=%v", got, ok)
	}
	set := readLanguageSet("")
	for _, lang := range []string{"bengali", "German", "", "klingon"} {
		if !canReadLanguage(set, lang) {
			t.Errorf("with nothing declared, %q reads as unreadable — every translated quote in the "+
				"library would lead with its translation", lang)
		}
	}
}

func TestWhatTheReaderDeclaredIsWhatTheyCanRead(t *testing.T) {
	blob, ok := normalizeReadLanguages(`["Bengali","English"]`)
	if !ok {
		t.Fatal("the fixture did not normalise")
	}
	set := readLanguageSet(blob)
	for _, lang := range []string{"bengali", "Bengali", "  english  "} {
		if !canReadLanguage(set, lang) {
			t.Errorf("%q was declared and reads as unreadable", lang)
		}
	}
	for _, lang := range []string{"german", "French"} {
		if canReadLanguage(set, lang) {
			t.Errorf("%q was not declared and reads as readable", lang)
		}
	}
	// AND A QUOTE WITH NO LANGUAGE IS NOT A FOREIGN QUOTE — the commonest row in
	// any library, and the one a stricter reading would flip.
	if !canReadLanguage(set, "") {
		t.Error("a quote with no language reads as unreadable")
	}
}
