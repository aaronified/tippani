package httpapi

import (
	"context"
	"net/http"
	"strings"
	"testing"
	"tippani/internal/metadata"
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

// A book's subtitle, publisher and extent — 0061.
//
// THE STATE THIS REPLACES. All three arrived on every lookup and none of them
// had a column: Google Books returns `subtitle`, `publisher` and `pageCount`,
// Open Library returns `subtitle`, `publisher` and `number_of_pages_median`, and
// the app parsed the first for a series guess and threw the rest away. The design
// pack's Details form names all three, so what is pinned here is that they are
// stored, that a full-state save cannot clear them by omission, and that they
// survive the round trip a library is actually rebuilt from.

type bookEdition struct {
	ID        int64  `json:"id"`
	Title     string `json:"title"`
	Subtitle  string `json:"subtitle"`
	Publisher string `json:"publisher"`
	Pages     int    `json:"pages"`
}

func TestABookKeepsItsSubtitlePublisherAndExtent(t *testing.T) {
	c := signupAdmin(t, newTestServer(t).Handler())
	made := decode[bookEdition](t, c.mustDo("POST", "/books", map[string]any{
		"title": "The Master and Margarita", "author": "Mikhail Bulgakov",
		"subtitle": "A Novel", "publisher": "Penguin Classics", "pages": 503,
	}, http.StatusCreated))
	if made.Subtitle != "A Novel" || made.Publisher != "Penguin Classics" || made.Pages != 503 {
		t.Fatalf("create: %+v", made)
	}
	got := decode[bookEdition](t, c.mustDo("GET", "/books/"+itoa(made.ID), nil, http.StatusOK))
	if got.Subtitle != "A Novel" || got.Publisher != "Penguin Classics" || got.Pages != 503 {
		t.Fatalf("fetch: %+v", got)
	}

	// FULL-STATE MEANS FULL-STATE. The update writes every column it names
	// unconditionally, so a body that omits one clears it — which is the defect
	// the languages carried for three releases (0047) and the reason this
	// assertion is here rather than left to the client's own ratchet.
	cleared := decode[bookEdition](t, c.mustDo("PUT", "/books/"+itoa(made.ID), map[string]any{
		"title": "The Master and Margarita",
	}, http.StatusOK))
	if cleared.Subtitle != "" || cleared.Publisher != "" || cleared.Pages != 0 {
		t.Fatalf("a full-state PUT that named none of them left %+v", cleared)
	}
}

func TestTheEditionFieldsRoundTripThroughTheExport(t *testing.T) {
	c := signupAdmin(t, newTestServer(t).Handler())
	made := decode[bookEdition](t, c.mustDo("POST", "/books", map[string]any{
		"title": "The Master and Margarita", "author": "Mikhail Bulgakov",
		"subtitle": "A Novel", "publisher": "Penguin Classics", "pages": 503,
	}, http.StatusCreated))
	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": made.ID, "quote": "Manuscripts don't burn",
	}, http.StatusCreated)

	md := c.mustDo("GET", "/books/"+itoa(made.ID)+"/export?format=md", nil, http.StatusOK).Body.String()
	for _, want := range []string{"subtitle: A Novel", "publisher: Penguin Classics", "page_count: 503"} {
		if !strings.Contains(md, want) {
			t.Fatalf("the export is missing %q:\n%s", want, md)
		}
	}
	// `page_count` AND NOT `pages`. The importer has bound `page`/`pages` to the
	// reading position since 0024 and still does, so a file that spelled the
	// extent `pages:` would re-import as "you are on page 503 of nothing".
	if strings.Contains(md, "\npages:") {
		t.Fatalf("the extent was written under the reading position's key:\n%s", md)
	}

	// Back in, through the staging queue, onto a second account — which is the
	// path a library is actually rebuilt by, and the one that loses a field
	// silently with a successful import and matching counts.
	c2 := signupAdmin(t, newTestServer(t).Handler())
	res := stage(t, c2, "/import/markdown", "mm.md", []byte(md))
	c2.mustFollow("POST", "/import/staged/approve", map[string]any{"batch_id": res.BatchID}, http.StatusOK)
	list := decode[struct {
		Books []bookEdition `json:"books"`
	}](t, c2.mustDo("GET", "/books", nil, http.StatusOK))
	if len(list.Books) != 1 {
		t.Fatalf("the import made %d books", len(list.Books))
	}
	back := decode[bookEdition](t, c2.mustDo("GET", "/books/"+itoa(list.Books[0].ID), nil, http.StatusOK))
	if back.Subtitle != "A Novel" || back.Publisher != "Penguin Classics" || back.Pages != 503 {
		t.Fatalf("the round trip lost something: %+v", back)
	}
}

// Re-verify offers the three, and applying takes only what was ticked.
//
// A FIELD THE SWEEP CANNOT SEE IS A FIELD THAT NEVER CATCHES UP. Every library
// already in use holds books with a blank publisher and no page count, and the
// only control that fills them across a shelf is this one; leaving them out of
// the diff would have shipped three columns nothing but a manual edit could fill.
func TestReverifyOffersAndAppliesTheEditionFields(t *testing.T) {
	srv := newTestServer(t)
	srv.searchBooks = func(_ context.Context, isbn, _, _, _ string) ([]metadata.BookCandidate, error) {
		return []metadata.BookCandidate{{
			Source: "google", Title: "Dune", Author: "Frank Herbert", ISBN13: isbn,
			Subtitle: "A Novel", Publisher: "Ace Books", Pages: 412,
		}}, nil
	}
	c := signupAdmin(t, srv.Handler())
	made := decode[bookEdition](t, c.mustDo("POST", "/books", map[string]any{
		"title": "Dune", "author": "Frank Herbert", "isbn": "9780441013593",
		"publisher": "Gollancz",
	}, http.StatusCreated))

	res := decode[reverifyResp](t, c.mustDo("POST", "/metadata/reverify",
		map[string]any{"book_ids": []int64{made.ID}}, http.StatusOK))
	fields := diffFields(t, res, 0)
	if !fields["subtitle"] || !fields["publisher"] || !fields["pages"] {
		t.Fatalf("the sweep did not offer all three: %v", fields)
	}

	// ONLY WHAT WAS TICKED. The reader's own "Gollancz" is left alone here — the
	// whole reason apply takes a set rather than a candidate.
	c.mustDo("POST", "/metadata/reverify/apply", map[string]any{
		"items": []map[string]any{{
			"type": "book", "id": made.ID,
			"set": map[string]any{"subtitle": "A Novel", "pages": 412},
		}},
	}, http.StatusOK)
	got := decode[bookEdition](t, c.mustDo("GET", "/books/"+itoa(made.ID), nil, http.StatusOK))
	if got.Subtitle != "A Novel" || got.Pages != 412 {
		t.Fatalf("apply did not land: %+v", got)
	}
	if got.Publisher != "Gollancz" {
		t.Fatalf("apply overwrote a field nobody ticked: %q", got.Publisher)
	}

	// AND EVERY FIELD THE GUARD ADMITS MUST ALSO BE WRITTEN. `allowed` is a
	// separate list from the writers below it, so a key can pass validation and
	// then be dropped in silence — a 200 saying "applied 1" over a column nothing
	// touched, which is the worst shape a write can fail in.
	c.mustDo("POST", "/metadata/reverify/apply", map[string]any{
		"items": []map[string]any{{
			"type": "book", "id": made.ID,
			"set": map[string]any{"publisher": "Ace Books"},
		}},
	}, http.StatusOK)
	got = decode[bookEdition](t, c.mustDo("GET", "/books/"+itoa(made.ID), nil, http.StatusOK))
	if got.Publisher != "Ace Books" {
		t.Fatalf("an admitted field was not written: %q", got.Publisher)
	}
}

// A book's two languages (0047).
//
// The oddest gap this pass closes: a standalone quote has carried a language
// since 1.14, the board it sits on carries a whole LIST of them, and the book of
// a translated novel could not say which language it was read in. Two columns and
// not one plus a flag, because "read in English, written in Bengali" is the
// ordinary case in this library and neither value follows from the other.
//
// DETAIL ONLY. The list row deliberately does not carry them — the same call
// translator and editor made — so the assertion is that GET /books/:id has them
// and that GET /books is unchanged.

func TestABookCarriesItsTwoLanguages(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	created := decode[bookDetail](t, c.mustDo("POST", "/books", map[string]any{
		"title": "Gora", "author": "Rabindranath Tagore",
		"language": "English", "orig_language": "Bengali",
	}, http.StatusCreated))
	if created.Language != "English" || created.OrigLanguage != "Bengali" {
		t.Fatalf("create: language=%q orig_language=%q", created.Language, created.OrigLanguage)
	}

	// The single fetch, which is a different SELECT from the create response's
	// reload only in the sense that it is the same one — asserted anyway, because
	// the create path reloads through fetchBook and a future one might not.
	fetched := decode[bookDetail](t, c.mustDo("GET", "/books/"+itoa(created.ID), nil, http.StatusOK))
	if fetched.Language != "English" || fetched.OrigLanguage != "Bengali" {
		t.Fatalf("fetch: language=%q orig_language=%q", fetched.Language, fetched.OrigLanguage)
	}

	// Full-state PUT: changed, then cleared.
	updated := decode[bookDetail](t, c.mustDo("PUT", "/books/"+itoa(created.ID), map[string]any{
		"title": "Gora", "author": "Rabindranath Tagore",
		"language": "Bengali", "orig_language": "Bengali",
	}, http.StatusOK))
	if updated.Language != "Bengali" {
		t.Fatalf("the PUT did not update the language: %q", updated.Language)
	}
	cleared := decode[bookDetail](t, c.mustDo("PUT", "/books/"+itoa(created.ID), map[string]any{
		"title": "Gora",
	}, http.StatusOK))
	if cleared.Language != "" || cleared.OrigLanguage != "" {
		t.Fatalf("a full-state PUT with no languages left %q/%q behind", cleared.Language, cleared.OrigLanguage)
	}
}

func TestALanguageTooLongToStoreIsRefused(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	long := make([]byte, 101)
	for i := range long {
		long[i] = 'x'
	}
	c.mustDo("POST", "/books",
		map[string]any{"title": "A", "language": string(long)}, http.StatusBadRequest)
	c.mustDo("POST", "/books",
		map[string]any{"title": "B", "orig_language": string(long)}, http.StatusBadRequest)
}

// A BOOK'S TWO SUPPLIER IDS, on the owner's instruction: "ol id: add them back".
//
// THE STATE THIS REPLACES. `google_id` and `openlibrary_id` have existed since
// 0001 and were written by exactly one path — adopting a looked-up candidate,
// which sets whichever one matches `source`. No response carried either of them
// and no request could set one, so the Ids strip could not draw an OL pill for a
// book that had an id, and a reader who had the key in their hand had nowhere to
// type it. The gap was recorded as an audit rather than a bug because making the
// columns full-state would have let every other client of PUT /books/:id clear
// them by omission.
//
// WHAT IS PINNED. That the GET returns both; that a PUT can set and clear each;
// that OMITTING them leaves them alone — the pointer contract that makes the
// change safe, and the one assertion that fails if somebody later folds these two
// columns into the main SET; and that adopting a candidate still wins over a
// stale id carried in the same body, which is the order the merge screen needs.

type bookIDs struct {
	ID            int64  `json:"id"`
	Title         string `json:"title"`
	GoogleID      string `json:"google_id"`
	OpenLibraryID string `json:"openlibrary_id"`
}

func TestABooksSupplierIDsAreServedAndSettable(t *testing.T) {
	c := signupAdmin(t, newTestServer(t).Handler())
	made := decode[bookIDs](t, c.mustDo("POST", "/books", map[string]any{
		"title": "The Master and Margarita", "author": "Mikhail Bulgakov",
	}, http.StatusCreated))

	// A READER TYPES THE KEY IN. Both at once, because the strip's editor saves
	// the whole strip.
	saved := decode[bookIDs](t, c.mustDo("PUT", "/books/"+itoa(made.ID), map[string]any{
		"title": "The Master and Margarita", "author": "Mikhail Bulgakov",
		"openlibrary_id": "/works/OL82563W", "google_id": "ftPPDwAAQBAJ",
	}, http.StatusOK))
	if saved.OpenLibraryID != "/works/OL82563W" || saved.GoogleID != "ftPPDwAAQBAJ" {
		t.Fatalf("the PUT stored neither id: %+v", saved)
	}
	// And the GET returns them, which is the half the strip reads.
	got := decode[bookIDs](t, c.mustDo("GET", "/books/"+itoa(made.ID), nil, http.StatusOK))
	if got.OpenLibraryID != "/works/OL82563W" || got.GoogleID != "ftPPDwAAQBAJ" {
		t.Fatalf("the GET does not carry them: %+v", got)
	}
}

func TestOmittingASupplierIDLeavesItAlone(t *testing.T) {
	c := signupAdmin(t, newTestServer(t).Handler())
	made := decode[bookIDs](t, c.mustDo("POST", "/books", map[string]any{
		"title": "Dead Souls", "openlibrary_id": "/works/OL1W", "google_id": "vol1",
	}, http.StatusCreated))

	// THE POINTER CONTRACT, and the reason these two columns are not in the main
	// SET. A body that says nothing about an id must leave it standing: every
	// other writer of this record — the bulk editor, an import approval, the
	// metadata console — names its own columns and has never heard of these, and a
	// supplier id is not a field a reader retypes each save. It is what a re-sync
	// pulls from.
	after := decode[bookIDs](t, c.mustDo("PUT", "/books/"+itoa(made.ID), map[string]any{
		"title": "Dead Souls", "author": "Nikolai Gogol",
	}, http.StatusOK))
	if after.OpenLibraryID != "/works/OL1W" || after.GoogleID != "vol1" {
		t.Fatalf("a PUT that named neither id wiped one: %+v", after)
	}

	// A PRESENT EMPTY STRING IS THE CLEAR, which is how the strip's editor empties
	// a field — the same distinction `movieReq`'s supplier ids draw.
	cleared := decode[bookIDs](t, c.mustDo("PUT", "/books/"+itoa(made.ID), map[string]any{
		"title": "Dead Souls", "author": "Nikolai Gogol", "openlibrary_id": "",
	}, http.StatusOK))
	if cleared.OpenLibraryID != "" {
		t.Fatalf("an explicit empty string did not clear the OL id: %+v", cleared)
	}
	if cleared.GoogleID != "vol1" {
		t.Fatalf("clearing one id cleared the other: %+v", cleared)
	}
}

func TestAdoptingACandidateBeatsAStaleIDInTheSameBody(t *testing.T) {
	c := signupAdmin(t, newTestServer(t).Handler())
	made := decode[bookIDs](t, c.mustDo("POST", "/books", map[string]any{
		"title": "Dead Souls", "openlibrary_id": "/works/OLstaleW",
	}, http.StatusCreated))

	// The merge screen assembles its body from the record AND the candidate, so
	// the stale id rides along with the adoption. `source`/`source_id` name what
	// the reader actually picked, so they are applied last.
	after := decode[bookIDs](t, c.mustDo("PUT", "/books/"+itoa(made.ID), map[string]any{
		"title": "Dead Souls", "openlibrary_id": "/works/OLstaleW",
		"source": "openlibrary", "source_id": "/works/OLfreshW",
	}, http.StatusOK))
	if after.OpenLibraryID != "/works/OLfreshW" {
		t.Fatalf("the adopted candidate lost to the stale id in the same body: %+v", after)
	}
}
