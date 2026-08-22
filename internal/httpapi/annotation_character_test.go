package httpapi

// A novel has speakers, not a cast (0047).
//
// `annotations.character` is the one field in this pass that crosses from one
// kind to another, and the reason it is worth its own file is that CROSSING IS
// THE HARD PART. A column added to one table and a facet that refuses every kind
// but the other one is a field that is storable and not findable — which is
// exactly the asymmetry quote_parity_test.go exists to catch, and exactly what
// `search_facets.go` asserted in prose until this change ("A book has no
// characters as a column").
//
// So the round trip is only half of it. The other half is that the same word
// reaches the same three places it reaches for a film line: the full-text index,
// the `character:` facet, and the autocomplete that offers the facet's values.
//
// THERE IS NO ACTOR HERE, deliberately and permanently. Nobody plays Ahab.

import (
	"net/http"
	"testing"
)

func TestABookCharacterMakesTheRoundTrip(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	book := createBook(t, c, "Moby-Dick")

	created := decode[annotationRow](t, c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book, "quote": "From hell's heart I stab at thee",
		"character": "Ahab", "chapter": "The Chase",
	}, http.StatusCreated))
	if created.Character != "Ahab" {
		t.Fatalf("character came back %q from the create", created.Character)
	}

	// The list, which is a different SELECT from the single fetch — the two drift
	// apart one column at a time, which is the failure annotation_handlers' own
	// scan-error comment is about.
	listed := decode[struct {
		Annotations []annotationRow `json:"annotations"`
	}](t, c.mustDo("GET", "/annotations?book_id="+itoa(book), nil, http.StatusOK)).Annotations
	if len(listed) != 1 || listed[0].Character != "Ahab" {
		t.Fatalf("the list did not carry the character: %+v", listed)
	}

	// Full-state PUT: a body that names the character keeps it, and a body that
	// omits it clears it. The second is the contract, not a bug — every PUT in
	// this app is full-state — and it is the trap 0034 caught on translator.
	kept := decode[annotationRow](t, c.mustDo("PUT", "/annotations/"+itoa(created.ID), map[string]any{
		"quote": "From hell's heart I stab at thee", "character": "Captain Ahab",
	}, http.StatusOK))
	if kept.Character != "Captain Ahab" {
		t.Fatalf("the PUT did not update the character: %q", kept.Character)
	}
	cleared := decode[annotationRow](t, c.mustDo("PUT", "/annotations/"+itoa(created.ID), map[string]any{
		"quote": "From hell's heart I stab at thee",
	}, http.StatusOK))
	if cleared.Character != "" {
		t.Fatalf("a full-state PUT with no character left %q behind", cleared.Character)
	}

	// And a value too long to store is refused rather than truncated, at the same
	// 128 the dialogue side uses — a line credited to two characters has to fit
	// on both sides or the facet finds one and not the other.
	long := make([]byte, 129)
	for i := range long {
		long[i] = 'x'
	}
	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book, "quote": "another passage", "character": string(long),
	}, http.StatusBadRequest)
}

// The three places the word has to reach for the field to be worth having.
func TestABookCharacterIsSearchableTheWayAFilmsIs(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	book := createBook(t, c, "Moby-Dick")
	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book, "quote": "a passage about the whale", "character": "Ahab",
	}, http.StatusCreated)
	movie := newWork(t, c, "The Whale Film", "movie")
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": movie, "quote": "a line about the whale", "character": "Starbuck",
	}, http.StatusCreated)

	// 1. The full-text index. annotations_fts was dropped and recreated with the
	//    column, so a name that is neither in the quote nor in the note has to be
	//    findable — which it can only be through the index.
	hits := searchWith(t, c, "q=Ahab")
	if len(hits.Annotations) == 0 {
		t.Fatal("searching a book character's name found no highlight; annotations_fts did not gain the column")
	}
	// And the hit CARRIES the name, so a result card can draw it. Without this the
	// field is storable, searchable and invisible at the one moment the reader is
	// looking for it — which is the same half-finished shape as an unindexed column.
	if hits.Annotations[0].Character != "Ahab" {
		t.Errorf("the annotation hit came back with character %q", hits.Annotations[0].Character)
	}

	// 2. The facet. It reaches annotations AND dialogues now, and nothing else:
	//    a book is not a character any more than it is an actor.
	byFacet := searchWith(t, c, "character=Ahab")
	if len(byFacet.Annotations) != 1 {
		t.Errorf("character=Ahab returned %d highlights, want 1", len(byFacet.Annotations))
	}
	if len(byFacet.Books) != 0 || len(byFacet.Movies) != 0 || len(byFacet.Quotes) != 0 {
		t.Errorf("character=Ahab reached a kind that has no character: books=%d movies=%d quotes=%d",
			len(byFacet.Books), len(byFacet.Movies), len(byFacet.Quotes))
	}
	// The film side still works, and the book's highlight is not in it — the two
	// columns are two columns.
	byFilm := searchWith(t, c, "character=Starbuck")
	if len(byFilm.Dialogues) != 1 || len(byFilm.Annotations) != 0 {
		t.Errorf("character=Starbuck: dialogues=%d annotations=%d, want 1 and 0",
			len(byFilm.Dialogues), len(byFilm.Annotations))
	}

	// 3. The autocomplete that offers the facet its values. A name the reader
	//    typed on a highlight yesterday and cannot find in the box today is a
	//    facet that looks broken.
	vocab := decode[struct {
		Characters []string `json:"characters"`
	}](t, c.mustDo("GET", "/search/vocabulary", nil, http.StatusOK))
	var sawBook, sawFilm bool
	for _, n := range vocab.Characters {
		switch n {
		case "Ahab":
			sawBook = true
		case "Starbuck":
			sawFilm = true
		}
	}
	if !sawBook || !sawFilm {
		t.Errorf("vocabulary characters = %v, want both a book's and a film's", vocab.Characters)
	}
}
