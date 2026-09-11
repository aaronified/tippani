package httpapi

import (
	"net/http"
	"strings"
	"testing"
)

// A quote's language is a fact about the LINE (0071).
//
// 0051 gave `translation` to all three kinds and 0035 gave `language` to one, on
// the argument that an annotation's language is its book's. That argument was
// wrong and this is the case that shows it: a Bengali couplet quoted inside an
// English novel is in Bengali, and the book is in English. The consequence was not
// cosmetic — the owner's words: "it is the thing that ascertains whether a
// translation will get priority over a quote text or not." So for two releases two
// kinds carried a second text with nothing able to rank it.
const bengaliCouplet = "যেখানে দেখিবে ছাই, উড়াইয়া দেখো তাই"

func TestAHighlightCarriesItsOwnLanguageNotItsBooksTest(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	// An ENGLISH book. The language on the highlight below must not come from here.
	book := decode[bookDetail](t, c.mustDo("POST", "/books", map[string]any{
		"title": "The Argumentative Indian", "language": "English",
	}, http.StatusCreated))

	a := decode[annotationRow](t, c.mustDo("POST", "/annotations", map[string]any{
		"book_id":     book.ID,
		"quote":       bengaliCouplet,
		"language":    "Bengali",
		"translation": "Where you see ash, blow on it",
	}, http.StatusCreated))
	if a.Language != "Bengali" {
		t.Fatalf("create dropped the highlight's language: got %q", a.Language)
	}

	// The read, which is the separate claim: the card cannot ORDER its two texts
	// without this, so a list that sent the pair and withheld the ranking fact
	// would make every card fetch its own quote again to find out which way round
	// to draw.
	list := decode[struct {
		Annotations []annotationRow `json:"annotations"`
	}](t, c.mustDo("GET", "/annotations?book_id="+itoa(book.ID), nil, http.StatusOK))
	if len(list.Annotations) != 1 || list.Annotations[0].Language != "Bengali" {
		t.Fatalf("list row lacks the language: %+v", list.Annotations)
	}

	// And a film's line the same way, because 0071 gave both tables the column and
	// a half-applied promotion is the failure mode that looks like success.
	film := decode[movieDetail](t, c.mustDo("POST", "/movies", map[string]any{"title": "Pather Panchali"}, http.StatusCreated))
	d := decode[dialogueRow](t, c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": film.ID, "quote": bengaliCouplet, "language": "Bengali",
	}, http.StatusCreated))
	if d.Language != "Bengali" {
		t.Fatalf("a dialogue dropped its language: got %q", d.Language)
	}
}

// A LANGUAGE IS A NAME AND NOT A SENTENCE, and the cap moved into quoteReq with
// the field so that all three kinds refuse the same thing. Before 0071 the check
// lived on the utterance kind alone, so promoting the field without promoting its
// rule would have left two kinds able to store 4KB of prose in a name column.
func TestEveryKindRefusesAnAbsurdLanguage(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	long := strings.Repeat("x", 201)
	book := decode[bookDetail](t, c.mustDo("POST", "/books", map[string]any{"title": "A book"}, http.StatusCreated))
	film := decode[movieDetail](t, c.mustDo("POST", "/movies", map[string]any{"title": "A film"}, http.StatusCreated))

	c.mustDo("POST", "/annotations", map[string]any{"book_id": book.ID, "quote": "x", "language": long}, http.StatusBadRequest)
	c.mustDo("POST", "/dialogues", map[string]any{"movie_id": film.ID, "quote": "x", "language": long}, http.StatusBadRequest)
	c.mustDo("POST", "/quotes", map[string]any{"quote": "x", "language": long}, http.StatusBadRequest)
}

// Only a game's line names the pack it came in (0071).
//
// The rule is act and quest's, applied to a third locator: a DLC names WHICH body
// of content those two sit inside, so it is meaningless on a film. Cleared rather
// than refused, which is normalizeLocator's stated decision — a line whose work
// was retargeted from a game to a film must stay editable from a form that
// correctly no longer offers the field.
func TestOnlyAGamesLineNamesThePackItCameIn(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	game := decode[movieDetail](t, c.mustDo("POST", "/movies", map[string]any{
		"title": "The Witcher 3", "media_type": "game",
	}, http.StatusCreated))
	g := decode[dialogueRow](t, c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": game.ID, "quote": "Wind's howling", "act": "Act I", "quest": "The Beast of White Orchard",
		"dlc": "Blood and Wine",
	}, http.StatusCreated))
	if g.DLC != "Blood and Wine" {
		t.Fatalf("a game's line dropped its pack: got %q", g.DLC)
	}

	film := decode[movieDetail](t, c.mustDo("POST", "/movies", map[string]any{"title": "Stalker"}, http.StatusCreated))
	f := decode[dialogueRow](t, c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": film.ID, "quote": "Let everything come true", "dlc": "Blood and Wine",
	}, http.StatusCreated))
	if f.DLC != "" {
		t.Fatalf("a film's line kept a pack it cannot have: got %q", f.DLC)
	}

	// AND THE PACK IS NOT IDENTITY. Act and quest are in the dedupe hash, so the
	// same bark in two quests is two quotes. Naming the pack on a line that already
	// exists must NOT fork a second copy — the failure recipient and occasion_circa
	// are both kept out of the hash to avoid.
	c.mustDo("PUT", "/dialogues/"+itoa(g.ID), map[string]any{
		"movie_id": game.ID, "quote": "Wind's howling", "act": "Act I", "quest": "The Beast of White Orchard",
		"dlc": "Hearts of Stone", "color": "yellow",
	}, http.StatusOK)
	after := decode[struct {
		Dialogues []dialogueRow `json:"dialogues"`
	}](t, c.mustDo("GET", "/dialogues?movie_id="+itoa(game.ID), nil, http.StatusOK))
	if len(after.Dialogues) != 1 {
		t.Fatalf("renaming the pack forked the line: %d rows", len(after.Dialogues))
	}
	if after.Dialogues[0].DLC != "Hearts of Stone" {
		t.Fatalf("the rename did not take: %q", after.Dialogues[0].DLC)
	}
}

// BOTH SURVIVE THEIR OWN EXPORT, which is the round-trip claim: a field the
// exporter writes and the parser cannot read back is data loss with a success
// message on it.
func TestLanguageAndPackSurviveTheirOwnExport(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	book := decode[bookDetail](t, c.mustDo("POST", "/books", map[string]any{"title": "A novel"}, http.StatusCreated))
	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book.ID, "quote": bengaliCouplet, "language": "Bengali",
	}, http.StatusCreated)
	game := decode[movieDetail](t, c.mustDo("POST", "/movies", map[string]any{
		"title": "The Witcher 3", "media_type": "game",
	}, http.StatusCreated))
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": game.ID, "quote": "Wind's howling", "dlc": "Blood and Wine", "language": "Polish",
	}, http.StatusCreated)

	bookMD := c.mustDo("POST", "/export/books", map[string]any{"ids": []int64{book.ID}}, http.StatusOK).Body.String()
	if !strings.Contains(bookMD, "language: Bengali") {
		t.Fatalf("the book export omits the highlight's language:\n%s", bookMD)
	}
	gameMD := c.mustDo("POST", "/export/movies", map[string]any{"ids": []int64{game.ID}}, http.StatusOK).Body.String()
	if !strings.Contains(gameMD, "dlc: Blood and Wine") {
		t.Fatalf("the game export omits the pack:\n%s", gameMD)
	}
	if !strings.Contains(gameMD, "language: Polish") {
		t.Fatalf("the game export omits the line's language:\n%s", gameMD)
	}
}

// The pack list is the game's own, which is what makes it usable as a combobox.
//
// The same claim `GET /books/{id}/chapters` makes: a library-wide list would offer
// every pack in the catalogue while you type a locator for THIS game, which is
// wrong more often than right.
//
// AND THE ORDER IS ENTRY ORDER, NEWEST FIRST — the same sort the chapter list
// takes, and the owner's ruling on why they must agree: "which pack was I last
// taking lines from" is what a locator box is asking, and it is the same question
// on both mediums. It used to be commonest-first, which reads as no order at all.
//
// THE FIXTURE BELOW SEPARATES THE TWO, and did so before this rule arrived: Blood
// and Wine has two lines and was entered first, Hearts of Stone has one and was
// entered last. Count order leads with Blood and Wine; entry order leads with
// Hearts of Stone. No third rule produces either.
func TestAGameOffersItsOwnPacksAndNobodyElsesTest(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	witcher := decode[movieDetail](t, c.mustDo("POST", "/movies", map[string]any{
		"title": "The Witcher 3", "media_type": "game",
	}, http.StatusCreated))
	fallout := decode[movieDetail](t, c.mustDo("POST", "/movies", map[string]any{
		"title": "Fallout 4", "media_type": "game",
	}, http.StatusCreated))

	// Two lines in one pack and one in another, so the ordering claim has something
	// to order — and the one with FEWER lines is entered LAST, which is what makes
	// the fixture tell entry order from a popularity ranking. Different quests,
	// because act+quest are the dedupe identity.
	for _, q := range []struct{ quote, quest, dlc string }{
		{"Wind's howling", "The Beast", "Blood and Wine"},
		{"Evil is evil", "Lesser Evil", "Blood and Wine"},
		{"A shame", "Scenes From a Marriage", "Hearts of Stone"},
	} {
		c.mustDo("POST", "/dialogues", map[string]any{
			"movie_id": witcher.ID, "quote": q.quote, "quest": q.quest, "dlc": q.dlc,
		}, http.StatusCreated)
	}
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": fallout.ID, "quote": "War never changes", "dlc": "Far Harbor",
	}, http.StatusCreated)

	got := decode[struct {
		Packs []struct {
			Name  string `json:"name"`
			Count int    `json:"count"`
		} `json:"packs"`
	}](t, c.mustDo("GET", "/movies/"+itoa(witcher.ID)+"/packs", nil, http.StatusOK))

	// ASSERT ON THE VALUES, NOT THE COUNT. "got 2 packs" passes happily while they
	// are the wrong two, which is the entire failure mode of a pool query.
	if len(got.Packs) != 2 {
		t.Fatalf("want 2 packs, got %+v", got.Packs)
	}
	// THE PACK YOU WERE LAST TAKING LINES FROM, first — despite having the fewer
	// lines of the two, which is the assertion that separates this from the
	// commonest-first rule it replaced.
	if got.Packs[0].Name != "Hearts of Stone" || got.Packs[0].Count != 1 {
		t.Fatalf("the last pack entered should lead: %+v", got.Packs)
	}
	// And the count still travels, because it is what tells a real pack from a
	// one-off typo of one when the two sit next to each other.
	if got.Packs[1].Name != "Blood and Wine" || got.Packs[1].Count != 2 {
		t.Fatalf("second pack wrong: %+v", got.Packs)
	}
	for _, p := range got.Packs {
		if p.Name == "Far Harbor" {
			t.Fatal("another game's pack leaked into this game's list")
		}
	}

	// A FILM ANSWERS EMPTY rather than 404: its lines carry no pack because the
	// writer clears one, so there is nothing for this endpoint to be right about
	// that normalizeLocator is not already enforcing.
	film := decode[movieDetail](t, c.mustDo("POST", "/movies", map[string]any{"title": "Stalker"}, http.StatusCreated))
	none := decode[struct {
		Packs []packOption `json:"packs"`
	}](t, c.mustDo("GET", "/movies/"+itoa(film.ID)+"/packs", nil, http.StatusOK))
	if len(none.Packs) != 0 {
		t.Fatalf("a film should offer no packs: %+v", none.Packs)
	}
}
