package httpapi

// THE ROUND'S SAME-AUTHOR ALLOWANCE, MEASURED OVER A WHOLE DECK.
//
// WHY A DECK AND NOT A RANKING. distractorScore rewards a same-author candidate
// above every other kind of similarity, so on a shelf with one well-represented
// author it wins nearly every card — and the reader meets the same four titles
// all round. That is not a closer question, it is one question. The promise in
// docs/plans/spaced-repetition-difficulty.md is a CAP on the round ("at most one
// card in three draws a same-author lure"), and a cap is only observable across
// cards. A test that asked one ranking function could not see it at all, and a
// test that asked whether the bonus was withheld would have passed the first
// attempt at this, which withheld the bonus and still let a shuffle put a
// same-author title in the options about half the time.
//
// SO THIS COUNTS OPTIONS ON A DECK FROM THE ENDPOINT, and maps title to author
// from the fixture it seeded rather than from anything the server sends — the
// option payload carries a title and a cover, not a credit, and a test that
// needed the server to volunteer the author would be testing the fix's own
// plumbing.

import (
	"fmt"
	"net/http"
	"strings"
	"testing"
)

// seedAuthoredBook is seedReviewBook with a credit, which is the whole point
// here: the shared helper posts a title alone, so every workRef it builds has an
// empty author and the same-author term in distractorScore can never fire.
func seedAuthoredBook(t *testing.T, c *testClient, title, author string, n int) []int64 {
	t.Helper()
	book := decode[bookDetail](t, c.mustDo("POST", "/books",
		map[string]any{"title": title, "author": author}, http.StatusCreated))
	ids := make([]int64, 0, n)
	for i := 0; i < n; i++ {
		a := decode[annotationRow](t, c.mustDo("POST", "/annotations", map[string]any{
			"book_id": book.ID,
			"quote": fmt.Sprintf(
				"%s passage %d: the sleeper must awaken and the spice must flow across the desert", title, i),
		}, http.StatusCreated))
		ids = append(ids, a.ID)
	}
	return ids
}

// parkItems puts a quote in the DISTRACTOR POOL but not in the deck — a long
// half-life, touched today, exactly what seedDistractorBook does for one row.
//
// IT IS THE HALF OF THE FIXTURE THAT MAKES THE MEASUREMENT MEAN ANYTHING. Without
// it the other authors' quotes come due too, so the deck is a mix of credits, and
// "did this card offer a lure by its own author" stops being one question.
func parkItems(t *testing.T, srv *Server, ids []int64) {
	t.Helper()
	for _, id := range ids {
		if _, err := srv.Store.DB.Exec(`INSERT INTO item_reviews
			(kind, item_id, stability, review_count, last_result, last_reviewed_at, last_touched_at)
			VALUES ('book', ?, 100, 1, 'got', datetime('now'), datetime('now'))`, id); err != nil {
			t.Fatal(err)
		}
	}
}

func TestAtMostOneCardInThreeOffersALureByTheAnswersOwnAuthor(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())

	// THE SHELF THIS IS ABOUT: one author the reader keeps a lot of, and enough
	// other books that a card has somewhere else to draw from. Every due card is
	// by Le Guin, so on every one of them a same-author lure is available and the
	// only thing that can stop it is the quota.
	const own = "Ursula K. Le Guin"
	byOwn := []string{"A Wizard of Earthsea", "The Tombs of Atuan", "The Farthest Shore", "The Dispossessed"}
	title2author := map[string]string{}
	for _, ti := range byOwn {
		seedAuthoredBook(t, c, ti, own, 3)
		title2author[ti] = own
	}
	var parked []int64
	for i, other := range []string{"Dune", "Solaris", "Emma", "Kindred", "Ubik", "Roadside Picnic"} {
		a := fmt.Sprintf("Author %d", i)
		parked = append(parked, seedAuthoredBook(t, c, other, a, 1)...)
		title2author[other] = a
	}
	ageSeededItems(t, srv)
	parkItems(t, srv, parked)

	// "WHICH BOOK IS THIS FROM?" ONLY, so every option is a title and the count
	// below is reading the thing the quota governs. The largest deck the quota
	// clamp allows, so thirds are worth counting.
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{
		"srQuestions": `{"daily":["source"]}`, "srDaily": 10, "srTier": tierMedium}, http.StatusOK)

	deck := decode[reviewDeckResp](t, c.mustDo("GET", "/review/daily", nil, 200))
	if len(deck.Items) < 6 {
		t.Fatalf("deck of %d cards is too short to measure a one-in-three cap", len(deck.Items))
	}

	withLure, checked := 0, 0
	for _, card := range deck.Items {
		if card.Direction != dirSource {
			continue
		}
		mine := title2author[card.Title]
		if mine != own {
			t.Fatalf("card %q is by %q — every due card in this fixture should be %s's", card.Title, mine, own)
		}
		checked++
		for i, opt := range card.Options {
			if i == card.Answer {
				continue
			}
			if title2author[opt] == own {
				withLure++
				break
			}
		}
	}
	if checked == 0 {
		t.Fatal(`the deck served no "which book?" cards, so nothing here was measured`)
	}

	// THE CAP, WITH THE THREE WRITTEN OUT. It read `authorLurePeriod` — the
	// constant under test — so setting that constant to 1 restored the exact
	// 10-of-10 defect the change was made for and this test still passed. A guard
	// that takes its own threshold from the thing it is guarding cannot fail on the
	// promise it names, and "one card in three" is what the plan and the changelog
	// promise a reader. Ceiling division, because a deck of four may honestly carry
	// two: cards 0 and 3 both hold the allowance.
	cap := (checked + 2) / 3
	if withLure > cap {
		t.Errorf("%d of %d cards offered a wrong answer by %s — at most %d may, and a reader who meets "+
			"the same author on every card is being asked one question rather than a closer one",
			withLure, checked, own, cap)
	}
	// AND IT IS A CAP, NOT A BAN. Removing same-author lures altogether would pass
	// the assertion above and lose the closest legitimate wrong answer the library
	// has — which is the thing distractorScore exists to find.
	if withLure == 0 {
		t.Errorf("no card in a deck of %d offered a wrong answer by %s, though three of that author's "+
			"other books were on the shelf — the quota has become a ban", checked, own)
	}
}

// AND A SHELF WITH NOTHING ELSE ON IT STILL GETS ITS QUESTION.
//
// The cap demotes a same-author candidate rather than excluding it, and this is
// the case that distinguishes the two: every book here is by one author, so an
// exclusion would leave "which book?" with one option and the card would be
// dropped from a deck that dailyRemaining had already counted — the badge-says-
// due-and-deck-serves-nothing failure buildQuestion's own comment records.
func TestAOneAuthorShelfStillOffersAChoice(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	for _, ti := range []string{"A Wizard of Earthsea", "The Tombs of Atuan", "The Farthest Shore"} {
		seedAuthoredBook(t, c, ti, "Ursula K. Le Guin", 3)
	}
	ageSeededItems(t, srv)
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{
		"srQuestions": `{"daily":["source"]}`, "srDaily": 10, "srTier": tierMedium}, http.StatusOK)

	deck := decode[reviewDeckResp](t, c.mustDo("GET", "/review/daily", nil, 200))
	if len(deck.Items) == 0 {
		t.Fatal("a shelf of three books by one author served an empty deck")
	}
	for i, card := range deck.Items {
		if card.Direction != dirSource {
			continue
		}
		if len(card.Options) < 2 {
			t.Fatalf("card %d (%q) offers %d options — a one-author shelf must still be asked, "+
				"so the quota demotes rather than excludes", i, card.Title, len(card.Options))
		}
	}
}

// EASY SHOWS THE READER WHO IS IN THE LINE — AND NEVER ON A CARD THAT ASKS IT.
//
// The plan's words for the Easy tier: "Speaker and character chips visible beside
// the quote, with the face." That is what Easy buys instead of a harder question,
// and it is the half of the tier that is not a count or a width — so nothing in
// the tier's own guards could see it.
//
// THE LEAK IS THE THING TO TEST, not the presence. "Who said this?" with the
// character named above the options is the same defect hideTheAnswer exists for,
// arrived at from the other side: the server would be printing the answer itself
// rather than leaving it in the words. So each case below asks a direction and
// then asks whether the people came with it.

func seedCharacterBook(t *testing.T, c *testClient, title, author, character string, n int) {
	t.Helper()
	book := decode[bookDetail](t, c.mustDo("POST", "/books",
		map[string]any{"title": title, "author": author}, http.StatusCreated))
	for i := 0; i < n; i++ {
		c.mustDo("POST", "/annotations", map[string]any{
			"book_id": book.ID, "character": character,
			"quote": fmt.Sprintf(
				"%s passage %d: the sleeper must awaken and the spice must flow across the desert", title, i),
		}, http.StatusCreated)
	}
}

// easyChipDeck asks for a deck of one direction at one tier and returns it.
func easyChipDeck(t *testing.T, h http.Handler, c *testClient, tier, direction string) []reviewCard {
	t.Helper()
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{
		"srTier": tier, "srDaily": 10,
		"srQuestions": fmt.Sprintf(`{"daily":[%q]}`, direction)}, http.StatusOK)
	return decode[reviewDeckResp](t, c.mustDo("GET", "/review/daily", nil, 200)).Items
}

func TestEasyNamesTheCharacterBesideTheQuoteAndNeverOnACardThatAsksIt(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	seedCharacterBook(t, c, "Dune", "Frank Herbert", "Paul Atreides", 4)
	seedAuthoredBook(t, c, "Emma", "Jane Austen", 2)
	ageSeededItems(t, srv)

	// WHICH BOOK IS THIS FROM — the character is a hint and not the answer.
	withChips := 0
	for _, card := range easyChipDeck(t, h, c, tierEasy, dirSource) {
		if card.Title != "Dune" {
			continue
		}
		if len(card.EasyChips) == 0 {
			t.Errorf("an easy %q card for a line spoken by Paul Atreides carries no chips — the tier "+
				"promises the people beside the quote and this is where they are the help", dirSource)
			continue
		}
		if card.EasyChips[0].Name != "Paul Atreides" {
			t.Errorf("the chip names %q, want the line's own character", card.EasyChips[0].Name)
		}
		withChips++
	}
	if withChips == 0 {
		t.Fatal("no Dune card reached the deck, so nothing here was measured")
	}

	// AND MEDIUM GETS NOTHING, because the chips are what Easy buys.
	for _, card := range easyChipDeck(t, h, c, tierMedium, dirSource) {
		if len(card.EasyChips) > 0 || len(card.EasyPeople) > 0 {
			t.Errorf("a MEDIUM card carries scaffolding chips (%+v / %v) — the tier that moves no dials "+
				"must not gain one", card.EasyChips, card.EasyPeople)
		}
	}
}

// AND NOT ON THE TWO DIRECTIONS THE PEOPLE WOULD ANSWER.
//
// dirSpeaker asks who said it. dirQuote shows the work and asks which of four
// quotes came from it, so the people belong to one option and naming them points
// at it. Driven over the endpoint at Easy, which is the only tier that offers
// them at all.
//
// A TRAP FOR THE NEXT TEST AUTHOR, met while writing this one: asking for
// `{"daily":["speaker"]}` silently gets you the DEFAULTS. Rule 3 in
// review_questions.go falls the whole list back when it contains no UNIVERSAL
// direction, because `speaker` needs a recorded speaker and `author` needs a
// book — a reader who enabled only those would leave a third of the library with
// nothing to be asked. So each request below pairs the direction under test with
// `source`, and the loop filters on what the card actually IS.
func TestEasyWithholdsItsChipsFromTheCardsTheyWouldAnswer(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	// FILMS, because dirSpeaker is a screen/utterance direction: attachSpeaker
	// refuses a book card outright, so a book fixture cannot reach this case.
	// Three of them, so there are three actors and a two-option easy card can
	// always be built.
	films := []struct{ title, character, actor string }{
		{"Casablanca", "Rick Blaine", "Humphrey Bogart"},
		{"Chinatown", "Jake Gittes", "Jack Nicholson"},
		{"The Third Man", "Harry Lime", "Orson Welles"},
	}
	for _, f := range films {
		m := decode[movieDetail](t, c.mustDo("POST", "/movies",
			map[string]any{"title": f.title}, http.StatusCreated))
		for j := 0; j < 3; j++ {
			c.mustDo("POST", "/dialogues", map[string]any{
				"movie_id": m.ID, "character": f.character, "actor": f.actor,
				"quote": fmt.Sprintf("%s line %d: the sleeper must awaken and the spice must flow across the desert",
					f.title, j),
			}, http.StatusCreated)
		}
	}
	ageSeededItems(t, srv)

	for _, dir := range []string{dirSpeaker, dirQuote} {
		c.mustDo("PUT", "/auth/me/preferences", map[string]any{
			"srTier": tierEasy, "srDaily": 10,
			"srQuestions": fmt.Sprintf(`{"daily":[%q,%q]}`, dir, dirSource)}, http.StatusOK)
		deck := decode[reviewDeckResp](t, c.mustDo("GET", "/review/daily", nil, 200))
		asked, sawSource := 0, 0
		for _, card := range deck.Items {
			switch card.Direction {
			case dir:
				asked++
				if len(card.EasyChips) > 0 || len(card.EasyPeople) > 0 {
					t.Errorf("an easy %q card carries the line's own people (%+v / %v) — that is the answer, "+
						"or points straight at it, printed above the options", dir, card.EasyChips, card.EasyPeople)
				}
			case dirSource:
				sawSource++
				// THE CONTROL, in the same deck: a "which film?" card at the same
				// tier over the same rows DOES carry them, so a green run above
				// cannot be the chips being switched off everywhere.
				if len(card.EasyChips) == 0 {
					t.Errorf("the %q card beside it carries no chips either — this deck is not showing "+
						"the tier's scaffolding at all, so the withholding above proves nothing", dirSource)
				}
			}
		}
		if asked == 0 {
			t.Errorf("no %q card reached the deck, so that case was not measured", dir)
		}
		if sawSource == 0 {
			t.Errorf("no %q card reached the deck, so the control above did not run", dirSource)
		}
	}
}

// AND A STANDALONE QUOTE'S SPEAKER IS A PERSON, NOT A CHARACTER.
//
// The two go down different paths on purpose — a speech's speaker has no cast row
// and no picture under the cover root, so it is a person chip and not a character
// chip, which is the same split SourceLines already makes. Without this case the
// EasyPeople half of the payload would be code nothing ever asked for.
//
// AND THE SPEAKER IS DROPPED WHEN IT IS ALSO THE TITLE. A speech with no occasion
// is titled by whoever gave it, so a "which source?" card would print the same
// name as a chip and as its own answer.
func TestEasyNamesTheSpeakerOfAStandaloneQuote(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	seedReviewQuotes(t, c, "Subhas Chandra Bose", "the Burma radio broadcast, on the sleeper and the spice", 3)
	seedReviewQuotes(t, c, "Sojourner Truth", "the Akron convention, on the sleeper and the spice", 3)
	// NO OCCASION, so utteranceAttribution titles this one by its speaker.
	titledByItsSpeaker := newUtterance(t, c, map[string]any{
		"quote":   "the sleeper must awaken and the spice must flow across the desert, he said",
		"speaker": "Frederick Douglass",
	})
	ageSeededItems(t, srv)
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{
		"srTier": tierEasy, "srDaily": 10, "srQuestions": `{"daily":["source"]}`}, http.StatusOK)

	deck := decode[reviewDeckResp](t, c.mustDo("GET", "/review/daily", nil, 200))
	named := 0
	for _, card := range deck.Items {
		if card.Kind != kindUtterance || card.Direction != dirSource {
			continue
		}
		if card.ID == titledByItsSpeaker.ID {
			if len(card.EasyPeople) > 0 {
				t.Errorf("a speech titled by its own speaker carries %v as a chip — the chip and the "+
					"card's own answer are the same name", card.EasyPeople)
			}
			continue
		}
		if len(card.EasyPeople) != 1 || card.EasyPeople[0] != card.Speaker {
			t.Errorf("card %d says speaker %q and offers %v — an easy card names who said it",
				card.ID, card.Speaker, card.EasyPeople)
			continue
		}
		if len(card.EasyChips) > 0 {
			t.Errorf("a speech carries character chips (%+v) — a speaker is a person and has no cast row",
				card.EasyChips)
		}
		named++
	}
	if named == 0 {
		t.Fatal("no standalone-quote source card reached the deck, so nothing here was measured")
	}
}

// AND A CHIP MAY NOT NAME WHAT THE CARD MASKED OUT — AT ANY DIRECTION.
//
// THIS IS THE BUG THE TWO TESTS ABOVE COULD NOT SEE. They ask about `speaker` and
// `quote`, the two directions whose ANSWER is a person, and their fixtures never
// put a character's name inside a quote — so the case that shipped was invisible
// to both. A fill-in-the-blank card's answer is a person whenever the phrase it
// hid is a name: a line whose one content word is the character came back as a
// blank with that character on a chip beside it. The reader reads the answer off
// the card, types it, is graded right, and the half-life climbs on a card they
// never recalled.
//
// SO THE FIXTURE PUTS THE NAME IN THE WORDS and asks every direction Easy can
// serve. The assertion is not "no chips on cloze" — it is the rule itself, which
// is what makes it hold for a direction nobody has written yet: whatever the card
// took out of its words, no chip puts back.
func TestNoEasyChipNamesWhatTheCardMaskedOut(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	// THE CHIP IS A FULL NAME AND THE LINE CARRIES ONLY HALF OF IT, which is the
	// shape the first version of this test could not reach: it set the character to
	// "Chani" and put exactly "Chani" in the words, so only string EQUALITY was
	// measured and a chip that merely contains the masked word walked straight
	// through. "Paul Atreides" is never in these lines; "Paul" is, and is the only
	// content word in them, so clozeSpan has nothing else to hide.
	book := decode[bookDetail](t, c.mustDo("POST", "/books",
		map[string]any{"title": "Dune", "author": "Frank Herbert"}, http.StatusCreated))
	for i := 0; i < 4; i++ {
		c.mustDo("POST", "/annotations", map[string]any{
			"book_id": book.ID, "character": "Paul Atreides",
			"quote": fmt.Sprintf("and then it was as if Paul had been there for them %d", i),
		}, http.StatusCreated)
	}
	// AND A SECOND SHAPE ON ITS OWN ROWS: a joint credit where only one half is in
	// the words. clozeNormalise drops the ampersand, so this is two words and one
	// of them is maskable.
	pair := decode[bookDetail](t, c.mustDo("POST", "/books",
		map[string]any{"title": "Good Omens", "author": "Gaiman & Pratchett"}, http.StatusCreated))
	for i := 0; i < 3; i++ {
		c.mustDo("POST", "/annotations", map[string]any{
			"book_id": pair.ID, "character": "Aziraphale & Crowley",
			"quote": fmt.Sprintf("it was as if Crowley had been there for them %d", i),
		}, http.StatusCreated)
	}
	// Enough other books that a multiple-choice card can form.
	for i, ti := range []string{"Emma", "Solaris", "Kindred", "Ubik"} {
		seedAuthoredBook(t, c, ti, fmt.Sprintf("Author %d", i), 2)
	}
	ageSeededItems(t, srv)

	// EVERY DIRECTION EASY CAN SERVE, one deck each. `cloze` is in the list because
	// tierDirections never empties a repertoire: a reader who allows only the typed
	// blank keeps it at Easy, which is how the worst version of this is reached.
	//
	// AND EACH IS ASKED FOR THE WAY THAT ACTUALLY REACHES IT, which cost this test
	// a run to work out. A universal direction is requested ALONE — pairing `cloze`
	// with `source` lets tierDirections drop the cloze and keep the source, so the
	// deck was all recognition cards and the case under test never appeared. The
	// two "who?" directions are not universal (review_questions.go, rule 3) and a
	// list naming only those falls back to the defaults, so they are paired.
	seen := map[string]bool{}
	for _, dir := range []string{dirCloze, dirClozeMCQ, dirSource, dirQuote, dirAuthor, dirSpeaker} {
		ask := fmt.Sprintf(`{"daily":[%q]}`, dir)
		if dir == dirAuthor || dir == dirSpeaker {
			ask = fmt.Sprintf(`{"daily":[%q,%q]}`, dir, dirSource)
		}
		c.mustDo("PUT", "/auth/me/preferences", map[string]any{
			"srTier": tierEasy, "srDaily": 10, "srQuestions": ask}, http.StatusOK)
		deck := decode[reviewDeckResp](t, c.mustDo("GET", "/review/daily", nil, 200))
		for _, card := range deck.Items {
			if card.Title != "Dune" && card.Title != "Good Omens" {
				continue
			}
			seen[card.Direction] = true
			// PER WORD, because that is the property: no WORD of a chip may be one
			// the card removed. Asking whether the whole name is present would pass
			// a chip whose name the words never carried in full, which is most of
			// them and the case the fix is about.
			full, err := srv.itemText(card.Kind, card.ID)
			if err != nil {
				t.Fatal(err)
			}
			raw := fieldSet(clozeNormalise(full))
			shown := fieldSet(clozeNormalise(card.Quote + " " + card.Note))
			names := append([]string(nil), card.EasyPeople...)
			for _, ch := range card.EasyChips {
				names = append(names, ch.Name)
			}
			for _, name := range names {
				for _, w := range strings.Fields(clozeNormalise(name)) {
					if raw[w] && !shown[w] {
						t.Errorf("a %q card at easy shows %q on a chip while %q is missing from its own "+
							"words (%q) — the card took that word out and the chip put it back, which "+
							"on a typed blank is the answer printed beside the question",
							card.Direction, name, w, card.Quote)
					}
				}
			}
		}
	}
	// AND THE DIRECTION THIS WAS WRITTEN FOR WAS ACTUALLY SERVED. Without this the
	// whole loop can pass over a deck that never produced a masked card, which is
	// how the first version of it measured nothing at all.
	if !seen[dirCloze] {
		t.Fatal("no typed blank reached the deck, so the case this test exists for was not measured")
	}
}

// AND THE RULE DOES NOT THROW AWAY THE CHIPS IT SHOULD KEEP.
//
// The obvious wrong fix for the leak above is to stop sending chips on any card
// that masks anything, which is every cloze card in the deck — and that would
// quietly delete the feature for the tier it was built for while every test about
// the leak went green. A line that NAMES one character and hides a different word
// still gets its chip.
func TestAMaskedLineStillNamesTheCharacterItDidNotHide(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	book := decode[bookDetail](t, c.mustDo("POST", "/books",
		map[string]any{"title": "Dune", "author": "Frank Herbert"}, http.StatusCreated))
	// THE CHARACTER IS NOT IN THE WORDS AT ALL, which is the ordinary case: the
	// name is a column on the row and the quote is what was said.
	for i := 0; i < 4; i++ {
		c.mustDo("POST", "/annotations", map[string]any{
			"book_id": book.ID, "character": "Paul Atreides",
			"quote": fmt.Sprintf("the sleeper must awaken and the spice must flow across the desert %d", i),
		}, http.StatusCreated)
	}
	for i, ti := range []string{"Emma", "Solaris", "Kindred", "Ubik"} {
		seedAuthoredBook(t, c, ti, fmt.Sprintf("Author %d", i), 2)
	}
	ageSeededItems(t, srv)
	// CLOZE ALONE, so tierDirections' never-empty rule keeps it at Easy. Asking for
	// it beside `source` lets Easy drop the blank and keep the recognition card,
	// and then nothing is masked.
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{
		"srTier": tierEasy, "srDaily": 10,
		"srQuestions": `{"daily":["cloze"]}`}, http.StatusOK)

	deck := decode[reviewDeckResp](t, c.mustDo("GET", "/review/daily", nil, 200))
	named, masked := 0, 0
	for _, card := range deck.Items {
		if card.Title != "Dune" {
			continue
		}
		if strings.Contains(card.Quote, clozeBlank) {
			masked++
		}
		for _, ch := range card.EasyChips {
			if ch.Name == "Paul Atreides" {
				named++
			}
		}
	}
	if masked == 0 {
		t.Fatal("no Dune card hid anything, so this measured nothing about a masked line")
	}
	if named == 0 {
		t.Errorf("%d masked cards and not one of them named Paul Atreides — the leak rule is dropping "+
			"chips for names the card never took out, which deletes the tier's own feature", masked)
	}
}
