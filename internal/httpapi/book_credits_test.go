package httpapi

import (
	"net/http"
	"strings"
	"testing"
)

// The other two people a book is by.
//
// A book carried one credit from 0001 to 0034, and for a library built around
// reading in translation that is the wrong number: the Garnett Dostoevsky and
// the Pevear Dostoevsky are different books to read and were identical books to
// this schema.
//
// Most of what follows is not really about the two columns. It is about the four
// places a new field on `books` gets silently dropped — the full-state PUT, the
// export/import round trip, the person-kind switches, and the portrait lookup's
// disambiguator — because in every one of them the failure is a successful
// request that quietly carries less than it was given.

func TestABookKeepsItsTranslatorAndEditor(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	b := decode[bookDetail](t, c.mustDo("POST", "/books", map[string]any{
		"title":      "The Brothers Karamazov",
		"author":     "Fyodor Dostoevsky",
		"translator": "Richard Pevear, Larissa Volokhonsky",
		"editor":     "Someone Else",
	}, http.StatusCreated))

	if b.Translator != "Richard Pevear, Larissa Volokhonsky" {
		t.Fatalf("create did not echo the translator: %q", b.Translator)
	}
	if b.Editor != "Someone Else" {
		t.Fatalf("create did not echo the editor: %q", b.Editor)
	}

	// And still there on a fresh read, rather than only in the echo.
	read := decode[bookDetail](t, c.mustDo("GET", "/books/"+itoa(b.ID), nil, http.StatusOK))
	if read.Translator != "Richard Pevear, Larissa Volokhonsky" || read.Editor != "Someone Else" {
		t.Fatalf("the credits did not survive a read: %+v", read)
	}
}

// THE FULL-STATE TRAP. PUT /books/:id replaces the row, so a body without these
// two clears them — and the ♥ on the detail header sends exactly such a body,
// which is why bookState() on the client had to learn them.
//
// This asserts the SERVER half: an absent field means "empty", not "unchanged".
// Written down because the other reading is the one a future patch is tempted by,
// and adopting it would make every field on the form unclearable.
func TestAnOmittedCreditIsClearedByAFullStatePut(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	b := decode[bookDetail](t, c.mustDo("POST", "/books", map[string]any{
		"title": "Crime and Punishment", "author": "Dostoevsky", "translator": "Constance Garnett",
	}, http.StatusCreated))

	after := decode[bookDetail](t, c.mustDo("PUT", "/books/"+itoa(b.ID), map[string]any{
		"title": "Crime and Punishment", "author": "Dostoevsky",
	}, http.StatusOK))
	if after.Translator != "" {
		t.Fatalf("a full-state PUT omitting the translator should have cleared it, got %q", after.Translator)
	}
}

func TestTheCreditsAreTrimmed(t *testing.T) {
	// people is UNIQUE(user_id, name) and the orphan sweep keys on a trimmed,
	// lowered name — so " Pevear" and "Pevear" being two different people is a bio
	// and a portrait that go missing.
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	b := decode[bookDetail](t, c.mustDo("POST", "/books", map[string]any{
		"title": "Anna Karenina", "translator": "  Rosemary Edmonds  ", "editor": "\tA. Editor\t",
	}, http.StatusCreated))
	if b.Translator != "Rosemary Edmonds" || b.Editor != "A. Editor" {
		t.Fatalf("credits were not trimmed: %q / %q", b.Translator, b.Editor)
	}
}

// THE LIST ROW DOES NOT CARRY THEM, and that is the requirement rather than an
// oversight: the Library board draws one credit per tile and always has. Asserted
// so that putting them there later is a decision somebody makes against a failing
// test, not a convenience nobody notices.
func TestTheLibraryListDoesNotCarryTheExtraCredits(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	c.mustDo("POST", "/books", map[string]any{
		"title": "The Idiot", "author": "Dostoevsky", "translator": "David McDuff",
	}, http.StatusCreated)

	body := c.mustDo("GET", "/books", nil, http.StatusOK).Body.String()
	if strings.Contains(body, "translator") || strings.Contains(body, "David McDuff") {
		t.Errorf("the list row carries a translator; the board has no place to draw it:\n%s", body)
	}
}

// THE ROUND TRIP — the test this feature actually needed.
//
// Export writes the frontmatter, the parser reads it, STAGING carries it, and
// approval writes it back. A gap at any one of those four points loses the field
// with a successful import and matching counts to say nothing happened. The
// reasoning that nearly shipped — "no importer has a source for a translator, so
// staged_works does not need the column" — was wrong for exactly this reason:
// Tippani's own export IS an importer's source, and every import is staged.
func TestATranslatorSurvivesTheMarkdownRoundTrip(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	b := decode[bookDetail](t, c.mustDo("POST", "/books", map[string]any{
		"title": "War and Peace", "author": "Leo Tolstoy",
		"translator": "Anthony Briggs", "editor": "An Editor",
	}, http.StatusCreated))
	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": b.ID, "quote": "All happy families are alike.",
	}, http.StatusCreated)

	md := c.mustDo("GET", "/books/"+itoa(b.ID)+"/export", nil, http.StatusOK).Body.String()
	if !strings.Contains(md, "translator: Anthony Briggs") {
		t.Fatalf("the export dropped the translator:\n%s", md)
	}
	if !strings.Contains(md, "editor: An Editor") {
		t.Fatalf("the export dropped the editor:\n%s", md)
	}

	// Back in as a SECOND account, so nothing can be merely matched to the row it
	// came from. Import → staging → approve is the whole path.
	other := addUser(t, h, c, "second")
	if rec := other.importApprove("/import/markdown", "lib.md", []byte(md)); rec.Code != http.StatusOK {
		t.Fatalf("import: %d %s", rec.Code, rec.Body)
	}
	list := decode[struct {
		Books []bookDetail `json:"books"`
	}](t, other.mustDo("GET", "/books", nil, http.StatusOK))
	if len(list.Books) != 1 {
		t.Fatalf("expected one imported book, got %d", len(list.Books))
	}
	got := decode[bookDetail](t, other.mustDo("GET", "/books/"+itoa(list.Books[0].ID), nil, http.StatusOK))
	if got.Translator != "Anthony Briggs" {
		t.Fatalf("the round trip lost the translator: %q", got.Translator)
	}
	if got.Editor != "An Editor" {
		t.Fatalf("the round trip lost the editor: %q", got.Editor)
	}
}

// A book with neither credit exports exactly as it did before 0034 —
// writeFrontmatter drops an empty value, so no existing file gains two blank keys.
func TestABookWithNeitherCreditExportsUnchanged(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	b := decode[bookDetail](t, c.mustDo("POST", "/books",
		map[string]any{"title": "Emma", "author": "Jane Austen"}, http.StatusCreated))

	md := c.mustDo("GET", "/books/"+itoa(b.ID)+"/export", nil, http.StatusOK).Body.String()
	if strings.Contains(md, "translator:") || strings.Contains(md, "editor:") {
		t.Fatalf("an empty credit was written to the frontmatter:\n%s", md)
	}
}

// ---- the people system ----------------------------------------------------

// The two new kinds are wired to BOOKS rather than inheriting somebody else's
// query. people_gc_test.go covers the switches as units; this covers the endpoint,
// which is where a wrong answer is actually seen.
func TestNamesForABookRoleListThatRoleAndNotTheAuthors(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	c.mustDo("POST", "/books", map[string]any{
		"title": "The Master and Margarita", "author": "Mikhail Bulgakov",
		"translator": "Michael Glenny", "editor": "Ed Itor",
	}, http.StatusCreated)

	names := func(kind string) []string {
		got := decode[struct {
			People []struct {
				Name string `json:"name"`
			} `json:"people"`
		}](t, c.mustDo("GET", "/people/names?kind="+kind, nil, http.StatusOK))
		out := []string{}
		for _, n := range got.People {
			out = append(out, n.Name)
		}
		return out
	}

	// THE BUG THIS EXISTS FOR: the query was `q := <books.author>` followed by a
	// switch overriding it for the other kinds, so a kind with no case answered
	// with every book AUTHOR — tallied, named as translators, and offered for
	// renaming.
	if got := names("translator"); len(got) != 1 || got[0] != "Michael Glenny" {
		t.Fatalf("translator names should be the translators, got %v", got)
	}
	if got := names("editor"); len(got) != 1 || got[0] != "Ed Itor" {
		t.Fatalf("editor names should be the editors, got %v", got)
	}
	if got := names("author"); len(got) != 1 || got[0] != "Mikhail Bulgakov" {
		t.Fatalf("author names changed: %v", got)
	}
}

func TestRenamingATranslatorRewritesTheTranslatorColumn(t *testing.T) {
	// personCreditSQL's blast radius is why this is worth its own test:
	// metadata.ReplaceCredit matches a name as a COMPONENT inside a joined credit,
	// so an arm that inherited the books.author statements would rewrite the AUTHOR
	// line of every book credited to anyone of that name, in place, with no undo.
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	b := decode[bookDetail](t, c.mustDo("POST", "/books", map[string]any{
		"title": "Zorba the Greek", "author": "Nikos Kazantzakis", "translator": "Carl Wildman",
	}, http.StatusCreated))

	c.mustDo("POST", "/people/rename", map[string]any{
		"kind": "translator", "from": "Carl Wildman", "to": "C. Wildman",
	}, http.StatusOK)

	after := decode[bookDetail](t, c.mustDo("GET", "/books/"+itoa(b.ID), nil, http.StatusOK))
	if after.Translator != "C. Wildman" {
		t.Fatalf("the rename did not reach books.translator: %q", after.Translator)
	}
	if after.Author != "Nikos Kazantzakis" {
		t.Fatalf("the rename touched the AUTHOR line: %q", after.Author)
	}
}

func TestAPersonCanBeAnAuthorAndATranslatorAtOnce(t *testing.T) {
	// Since 0027 the row IS the person and the roles are a set beside it, so one
	// human who both writes and translates is one row with two roles rather than
	// two rows with two portraits.
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	c.mustDo("POST", "/books", map[string]any{"title": "Own Work", "author": "Ann Goldstein"}, http.StatusCreated)
	c.mustDo("POST", "/books", map[string]any{
		"title": "My Brilliant Friend", "author": "Elena Ferrante", "translator": "Ann Goldstein",
	}, http.StatusCreated)

	// Saved once under each role. The point is not that two saves happen — it is
	// that they land on ONE row: before 0027 this was two people with two bios and
	// two portraits, and enriching one left the other blank.
	for _, kind := range []string{"translator", "author"} {
		c.mustDo("PUT", "/people", map[string]any{
			"kind": kind, "name": "Ann Goldstein", "bio": "Translator and editor.",
		}, http.StatusOK)
	}

	seen := map[string]bool{}
	for _, kind := range []string{"author", "translator"} {
		got := decode[struct {
			People []personRow `json:"people"`
		}](t, c.mustDo("GET", "/people?kind="+kind, nil, http.StatusOK))
		found := false
		for _, p := range got.People {
			if p.Name == "Ann Goldstein" {
				found = true
				if p.Bio != "Translator and editor." {
					t.Errorf("%s: the bio did not follow the person across roles: %q", kind, p.Bio)
				}
			}
		}
		if !found {
			t.Errorf("Ann Goldstein is not listed as a %s", kind)
		}
		seen[kind] = found
	}
	if !seen["author"] || !seen["translator"] {
		t.Fatalf("one person, two roles: %v", seen)
	}
	// And exactly one row underneath, not two.
	var rows int
	if err := srv.Store.DB.QueryRow(
		`SELECT count(*) FROM people WHERE name = 'Ann Goldstein'`).Scan(&rows); err != nil {
		t.Fatal(err)
	}
	if rows != 1 {
		t.Fatalf("expected one people row playing two roles, got %d", rows)
	}
}

func TestAnUnknownPersonKindIsStillRefused(t *testing.T) {
	// The guard is a list, and a list that has now grown twice is one somebody
	// will eventually widen by accident.
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	c.mustDo("GET", "/people?kind=illustrator", nil, http.StatusBadRequest)
	c.mustDo("PUT", "/people", map[string]any{"kind": "illustrator", "name": "Somebody"}, http.StatusBadRequest)
}
