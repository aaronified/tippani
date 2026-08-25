package httpapi

import (
	"net/http"
	"testing"
)

// A CHARACTER YOU HAVE QUOTED IS ONE OF THE WORK'S PEOPLE.
//
// THE REPORT: "book / game characters still needs to be separately set in details
// before they appear. the characters i already entered in quotes in the work are
// not populating that list. that makes it really confusing for long term use."
//
// The reason it was true is worth keeping beside the fix: 0048 gave every work a
// cast table and only two things ever wrote a row — a provider fetch and the Add
// button. A book has no cast fetch and most games have none worth the name
// (TIP-META-018), so for both the list was empty for ever while the reader typed
// character after character into a column 0047 had added for exactly this.
//
// WHAT THESE TESTS PIN. Not "adoption happens" — the interesting cases are all the
// ones where it must NOT, and every one of them is silent when broken: a tombstone
// coming back from the dead reads as a delete button that does not work, a
// duplicate reads as a second Éowyn nobody typed, and a character adopted from
// another reader's book is a per-user leak.

// castOf reads a work's list through the endpoint the panel and the capture form
// both use — which is where adoption happens, so a test that queried the table
// directly would prove nothing about what a reader sees.
func castList(t *testing.T, c *testClient, path string, id int64) []castRow {
	t.Helper()
	res := decode[struct {
		Cast []castRow `json:"cast"`
	}](t, c.mustDo("GET", "/"+path+"/"+itoa(id)+"/cast", nil, http.StatusOK))
	return res.Cast
}

func castNames(rows []castRow) []string {
	out := []string{}
	for _, r := range rows {
		out = append(out, r.Character)
	}
	return out
}

// A BOOK'S CHARACTERS ARE THE ONES ITS HIGHLIGHTS NAME. This is the whole
// complaint in one case.
func TestABooksQuotedCharactersBecomeItsCast(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	book := createBook(t, c, "The Lord of the Rings")
	if got := castList(t, c, "books", book); len(got) != 0 {
		t.Fatalf("a fresh book starts with an empty cast, got %v", castNames(got))
	}

	for _, pair := range [][2]string{
		{"All we have to decide is what to do with the time that is given us.", "Gandalf"},
		{"I am no man.", "Éowyn"},
		{"Even the smallest person can change the course of the future.", "Gandalf"},
	} {
		c.mustDo("POST", "/annotations", map[string]any{
			"book_id": book, "quote": pair[0], "character": pair[1],
		}, http.StatusCreated)
	}

	got := castNames(castList(t, c, "books", book))
	// GANDALF ONCE, not twice: two highlights, one person. The dedupe is on the
	// folded key, the same one handleAddCast calls a duplicate by.
	want := []string{"Gandalf", "Éowyn"}
	if len(got) != len(want) {
		t.Fatalf("cast = %v, want %v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("cast = %v, want %v", got, want)
		}
	}
	// ORDERED BY WHEN THEY WERE FIRST QUOTED, because billing is MAX+1 per row and
	// the quotes are read in id order. It is the order the reader met them in.

	// AND THE ROW IS THE READER'S, not a provider's — nothing has fetched anything.
	// It matters because origin is what a later refetch consults: a `reader` row
	// keeps its name when TheTVDB finally lists the same character.
	for _, r := range castList(t, c, "books", book) {
		if r.Origin != castReader {
			t.Errorf("%q adopted as origin %q, want %q", r.Character, r.Origin, castReader)
		}
		if r.Actor != "" {
			t.Errorf("%q carries an actor %q — a book's rows never do (0047)", r.Character, r.Actor)
		}
	}
}

// IT IS IDEMPOTENT, which is what makes it safe on a read. The panel and the
// capture form both call this endpoint, repeatedly, for the whole life of a work.
func TestAdoptingTheSameCharacterTwiceMakesOneRow(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	book := createBook(t, c, "Moby-Dick")
	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book, "quote": "Call me Ishmael.", "character": "Ishmael",
	}, http.StatusCreated)

	first := castList(t, c, "books", book)
	if len(first) != 1 {
		t.Fatalf("first list = %v, want one row", castNames(first))
	}
	for i := 0; i < 3; i++ {
		if got := castList(t, c, "books", book); len(got) != 1 || got[0].ID != first[0].ID {
			t.Fatalf("list %d = %v (ids differ or duplicated), want the same single row", i+2, castNames(got))
		}
	}
}

// THE SPELLING ALREADY ON THE LIST WINS. A cast row spelled "Éowyn" and a line
// typed "  éowyn " are one character, and adopting the second would give the
// reader two rows for a name they can see is already there.
//
// FOLDED BY store.CastKey, which drops case and collapses whitespace and does NOT
// strip accents — so "Eowyn" and "Éowyn" stay two people, which is right: an
// accent is a spelling and not a decoration, and a fold that flattened it would
// merge names that are genuinely different in a dozen languages.
func TestAQuotedCharacterAlreadyOnTheListIsNotAddedAgain(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	book := createBook(t, c, "The Return of the King")
	c.mustDo("POST", "/books/"+itoa(book)+"/cast", map[string]any{"character": "Éowyn"}, http.StatusCreated)
	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book, "quote": "I am no man.", "character": "  éowyn ",
	}, http.StatusCreated)

	got := castNames(castList(t, c, "books", book))
	if len(got) != 1 || got[0] != "Éowyn" {
		t.Fatalf("cast = %v, want the one row spelled as it was typed on the list", got)
	}
}

// A TOMBSTONE STAYS DEAD, and this is the case that is most obviously wrong when
// it breaks: deleting a character you have also quoted would undelete it on the
// next read, for ever, and the delete button would look broken rather than
// declined. The existing-keys query reads EVERY origin for this reason.
func TestADeletedCharacterIsNotReadoptedFromItsOwnQuotes(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	book := createBook(t, c, "Dune")
	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book, "quote": "Fear is the mind-killer.", "character": "Paul Atreides",
	}, http.StatusCreated)

	rows := castList(t, c, "books", book)
	if len(rows) != 1 {
		t.Fatalf("expected the character to be adopted first, got %v", castNames(rows))
	}
	c.mustDo("DELETE", "/cast/"+itoa(rows[0].ID), nil, http.StatusNoContent)

	if got := castNames(castList(t, c, "books", book)); len(got) != 0 {
		t.Fatalf("cast = %v after a delete — the tombstone was ignored and the row came back", got)
	}
}

// A FILM LINE NAMES WHO PLAYED THEM, and the actor rides along — but only when the
// pairing is unambiguous. Inventing one would put the wrong face on a character
// permanently, which no later fetch would correct because the row would be the
// reader's.
func TestAFilmLineCarriesItsActorOnlyWhenThePairingIsCertain(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	film := createFilm(t, c, "Heat", "Michael Mann")
	// One to one: the actor is carried.
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": film, "quote": "Don't let yourself get attached to anything.",
		"character": "Neil McCauley", "actor": "Robert De Niro",
	}, http.StatusCreated)
	// Two characters, one actor: nothing is guessed.
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": film, "quote": "A guy told me one time.",
		"character": "Vincent Hanna, Nate", "actor": "Al Pacino",
	}, http.StatusCreated)

	by := map[string]string{}
	for _, r := range castList(t, c, "movies", film) {
		by[r.Character] = r.Actor
	}
	if by["Neil McCauley"] != "Robert De Niro" {
		t.Errorf("McCauley's actor = %q, want the one the line named", by["Neil McCauley"])
	}
	if _, ok := by["Vincent Hanna"]; !ok {
		t.Fatalf("a multi-character line was not split into its characters: %v", by)
	}
	if by["Vincent Hanna"] != "" || by["Nate"] != "" {
		t.Errorf("an ambiguous pairing was guessed at: Hanna=%q Nate=%q", by["Vincent Hanna"], by["Nate"])
	}
}

// PER-USER, like every other row in this app. Two readers can hold books with the
// same id — they will, since ids are per table — and one reader's quoted character
// must never appear on the other's list.
func TestAdoptionIsPerReader(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	admin := signupAdmin(t, h)
	other := addUser(t, h, admin, "other")

	mine := createBook(t, admin, "The Hobbit")
	admin.mustDo("POST", "/annotations", map[string]any{
		"book_id": mine, "quote": "In a hole in the ground there lived a hobbit.", "character": "Bilbo",
	}, http.StatusCreated)
	if got := castNames(castList(t, admin, "books", mine)); len(got) != 1 {
		t.Fatalf("owner's cast = %v, want Bilbo", got)
	}
	// Another reader's book is a 404 — never a 403, and never somebody else's cast.
	other.mustDo("GET", "/books/"+itoa(mine)+"/cast", nil, http.StatusNotFound)
}
