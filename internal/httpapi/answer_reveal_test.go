package httpapi

// EVERY OPTION IS TOLD, NOT ONLY THE RIGHT ONE. The owner, 9 October: "when an
// answer is submitted, all important details about the answer should be shown,
// along with their peers." Asked which details: "Work: cover, title, creator,
// year" and "Who: speaker or character". Asked who the peers are: "The other
// choices". So each of these decks one card of one shape and reads what every
// option carries for the reveal; the client draws it only after the grade
// (review.jsx, OptionReveal), which test/dom/quiz-runner.test.jsx holds.
//
// SETUP KNOWS POST /books (title, author, published_year), POST /movies (title,
// director, media_type, release_year), POST /annotations (book_id, quote,
// character), POST /dialogues (movie_id, quote, character, actor), PUT
// /auth/me/preferences (srTier, srQuestions) and GET /review/daily. It parks the
// other works' quotes in item_reviews and writes a film's cast into work_cast,
// as review_test.go and work_cast_test.go do. It reads each card's id,
// direction, options, answer, year, director and who, and each option's source,
// creator, year and who — the fields the details are drawn from.

import (
	"net/http"
	"testing"
)

type revealBook struct {
	title, author string
	year          int
	who, quote    string
}

// The card's own book, then three others to be wrong with. Each quote is about
// the same length and none names a person, so every shape of card can be built
// from them.
var revealBooks = []revealBook{
	{"Middlemarch", "George Eliot", 1871, "Dorothea", ""},
	{"Emma", "Jane Austen", 1815, "Knightley",
		"badly done indeed to be so careless with a friend who trusted your kindness"},
	{"Villette", "Charlotte Bronte", 1853, "Lucy Snowe",
		"the quiet hours of the night carried the storm across the sleeping town"},
	{"Jude the Obscure", "Thomas Hardy", 1895, "Sue Bridehead",
		"the city of light stood on the hill where the scholars kept their books"},
}

// seedRevealLibrary adds the four books, the card's own quote on the first, and
// parks the other three quotes so that only the first is due.
func seedRevealLibrary(t *testing.T, srv *Server, c *testClient, ownQuote string) int64 {
	t.Helper()
	var own int64
	for i, b := range revealBooks {
		book := decode[bookDetail](t, c.mustDo("POST", "/books",
			map[string]any{"title": b.title, "author": b.author, "published_year": b.year}, http.StatusCreated))
		q := b.quote
		if i == 0 {
			q = ownQuote
		}
		a := decode[annotationRow](t, c.mustDo("POST", "/annotations",
			map[string]any{"book_id": book.ID, "quote": q, "character": b.who}, http.StatusCreated))
		if i == 0 {
			own = a.ID
			continue
		}
		if _, err := srv.Store.DB.Exec(`INSERT INTO item_reviews
			(kind, item_id, stability, review_count, last_result, last_reviewed_at, last_touched_at)
			VALUES ('book', ?, 100, 1, 'got', datetime('now'), datetime('now'))`, a.ID); err != nil {
			t.Fatal(err)
		}
	}
	ageSeededItems(t, srv)
	return own
}

func revealBookOf(t *testing.T, title string) revealBook {
	t.Helper()
	for _, b := range revealBooks {
		if b.title == title {
			return b
		}
	}
	t.Fatalf("an option was revealed as %q, which is not a book in this library", title)
	return revealBook{}
}

// askedAs decks the library with one question switched on and returns the card.
// The quote is long, so "cloze" beside the question only satisfies the rule that
// a deck keeps one universal question: a long quote is never asked its words.
func askedAs(t *testing.T, c *testClient, id int64, tier, questions string) reviewCard {
	t.Helper()
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{"srTier": tier, "srQuestions": questions}, http.StatusOK)
	card, ok := dailyCard(t, c, id)
	if !ok {
		t.Fatal("the card was left out of the deck")
	}
	return card
}

// "Which book is this from?" Every cover on it now says who wrote that book and
// when, and the card itself carries its own year.
func TestEveryWorkOptionNamesItsCreatorAndYear(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	id := seedRevealLibrary(t, srv, c, longLine)
	card := askedAs(t, c, id, tierMedium, `{"daily":["source","cloze"]}`)
	if card.Direction != dirSource || len(card.Options) < 3 {
		t.Fatalf("asked %q with options %v, want which book", card.Direction, card.Options)
	}
	if card.Year != 1871 {
		t.Errorf("the card's own year = %d, want 1871", card.Year)
	}
	// AND WHO SAYS IT, as a face for the details under the words, on a card
	// that asks about the work and not the speaker.
	if len(card.Who) != 1 || card.Who[0].Name != "Dorothea" {
		t.Errorf("the card's own character is %+v, want Dorothea", card.Who)
	}
	for i, title := range card.Options {
		b, om := revealBookOf(t, title), card.OptionMeta[i]
		if om.Creator != b.author || om.Year != b.year {
			t.Errorf("option %q reveals %q, %d; want %q, %d", title, om.Creator, om.Year, b.author, b.year)
		}
	}
}

// "Which of these is from Middlemarch?" Each quote on the card names its book,
// that book's writer and year, and the character who says it.
func TestEveryQuoteOptionSaysWhoSaysIt(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	id := seedRevealLibrary(t, srv, c, longLine)
	card := askedAs(t, c, id, tierMedium, `{"daily":["quote","cloze"]}`)
	if card.Direction != dirQuote || len(card.Options) < 3 {
		t.Fatalf("asked %q with options %v, want which quote", card.Direction, card.Options)
	}
	for i, opt := range card.Options {
		om := card.OptionMeta[i]
		b := revealBookOf(t, om.Source)
		if om.Creator != b.author || om.Year != b.year {
			t.Errorf("quote %q reveals %q, %d; want %q, %d", opt, om.Creator, om.Year, b.author, b.year)
		}
		if len(om.Who) != 1 || om.Who[0].Name != b.who {
			t.Errorf("quote %q says it is spoken by %+v, want %q", opt, om.Who, b.who)
		}
	}
}

// A blank with the words offered. Each phrase says which quote it was cut from:
// the right one this card's own, the others the books they came out of.
func TestAPhraseOnAChoicesBlankSaysWhereItWasCut(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	id := seedRevealLibrary(t, srv, c, shortLine)
	card := askedAs(t, c, id, tierMedium, `{"daily":["cloze-mcq"]}`)
	if card.Direction != dirClozeMCQ || len(card.Options) < 3 {
		t.Fatalf("asked %q with options %v, want a blank with choices", card.Direction, card.Options)
	}
	if len(card.OptionMeta) != len(card.Options) {
		t.Fatalf("%d options and %d reveals", len(card.Options), len(card.OptionMeta))
	}
	for i, opt := range card.Options {
		om := card.OptionMeta[i]
		b := revealBookOf(t, om.Source)
		if (i == card.Answer) != (b.title == "Middlemarch") {
			t.Errorf("phrase %q (answer: %v) says it came from %q", opt, i == card.Answer, b.title)
		}
		if om.Creator != b.author || om.Year != b.year || len(om.Who) != 1 || om.Who[0].Name != b.who {
			t.Errorf("phrase %q reveals %q, %d, %+v; want %q, %d, %q",
				opt, om.Creator, om.Year, om.Who, b.author, b.year, b.who)
		}
	}
}

// "Who said this?" Every actor on the card says who they play in the film, and
// the film's own line now carries its director and year.
func TestAnActorOptionSaysWhoTheyPlay(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	film := decode[struct {
		ID int64 `json:"id"`
	}](t, c.mustDo("POST", "/movies", map[string]any{
		"title": "Heat", "director": "Michael Mann", "media_type": "movie", "release_year": 1995,
	}, http.StatusCreated))
	plays := map[string]string{
		"Robert De Niro": "Neil McCauley", "Al Pacino": "Vincent Hanna",
		"Val Kilmer": "Chris Shiherlis", "Jon Voight": "Nate",
	}
	seedProviderCast(t, srv, 1, "movie", film.ID,
		[2]string{"Neil McCauley", "Robert De Niro"}, [2]string{"Vincent Hanna", "Al Pacino"},
		[2]string{"Chris Shiherlis", "Val Kilmer"}, [2]string{"Nate", "Jon Voight"})
	line := decode[dialogueRow](t, c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": film.ID, "quote": longLine, "character": "Vincent Hanna", "actor": "Al Pacino",
	}, http.StatusCreated))
	ageSeededItems(t, srv)

	c.mustDo("PUT", "/auth/me/preferences", map[string]any{
		"srTier": tierHard, "srQuestions": `{"daily":["speaker","cloze"]}`}, http.StatusOK)
	var card reviewCard
	for _, it := range decode[reviewDeckResp](t, c.mustDo("GET", "/review/daily", nil, 200)).Items {
		if it.Kind == kindScreen && it.ID == line.ID {
			card = it
		}
	}
	if card.Direction != dirSpeaker || len(card.Options) < 3 {
		t.Fatalf("asked %q with options %v, want who said it", card.Direction, card.Options)
	}
	if card.Director != "Michael Mann" || card.Year != 1995 {
		t.Errorf("the card's line = %q, %d; want Michael Mann, 1995", card.Director, card.Year)
	}
	if len(card.Who) != 1 || card.Who[0].Name != "Vincent Hanna" {
		t.Errorf("the card's own character is %+v, want Vincent Hanna", card.Who)
	}
	for i, actor := range card.Options {
		om := card.OptionMeta[i]
		if om.Source != "Heat" || om.Creator != "Michael Mann" || om.Year != 1995 {
			t.Errorf("%s reveals %q, %q, %d; want Heat, Michael Mann, 1995", actor, om.Source, om.Creator, om.Year)
		}
		if len(om.Who) != 1 || om.Who[0].Name != plays[actor] {
			t.Errorf("%s is revealed as playing %+v, want %q", actor, om.Who, plays[actor])
		}
	}
}

// "Which of these is from Heat?" Each film line on the card says who says it.
func TestAFilmLineOptionSaysWhoSaysIt(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	films := []struct{ title, who string }{
		{"Heat", "Vincent Hanna"}, {"Casablanca", "Rick Blaine"},
		{"Chinatown", "Jake Gittes"}, {"Vertigo", "Scottie Ferguson"},
	}
	says := map[string]string{}
	var own int64
	for i, f := range films {
		film := decode[struct {
			ID int64 `json:"id"`
		}](t, c.mustDo("POST", "/movies", map[string]any{"title": f.title, "media_type": "movie"}, http.StatusCreated))
		says[f.title] = f.who
		line := decode[dialogueRow](t, c.mustDo("POST", "/dialogues", map[string]any{
			"movie_id": film.ID, "quote": longLine + " in " + f.title, "character": f.who,
		}, http.StatusCreated))
		if i == 0 {
			own = line.ID
		}
	}
	ageSeededItems(t, srv)
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{
		"srTier": tierMedium, "srQuestions": `{"daily":["quote","cloze"]}`}, http.StatusOK)
	var card reviewCard
	for _, it := range decode[reviewDeckResp](t, c.mustDo("GET", "/review/daily", nil, 200)).Items {
		if it.Kind == kindScreen && it.ID == own {
			card = it
		}
	}
	if card.Direction != dirQuote || len(card.Options) < 3 {
		t.Fatalf("asked %q with options %v, want which quote", card.Direction, card.Options)
	}
	for i, opt := range card.Options {
		om := card.OptionMeta[i]
		if len(om.Who) != 1 || om.Who[0].Name != says[om.Source] {
			t.Errorf("the line %q from %q says it is spoken by %+v, want %q", opt, om.Source, om.Who, says[om.Source])
		}
	}
}
