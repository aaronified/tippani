package httpapi

import (
	"net/http"
	"strings"
	"testing"
)

// mergeDeck — how a deck is dealt, tested directly, with lists this file builds.
//
// The deck endpoints in review_test.go reach it through a seeded library, and
// Practice's seed is random per request, so what those tests can assert about
// ORDER is loose: the rotation guard there catches its own removal about two runs
// in three. Here every input is fixed, so each rule below is asserted as the exact
// sequence it deals, and a mutation to that rule turns the sequence wrong on every
// run. The file knows the function's name and its candidate type, which is the
// declared exception: the order of a deck is what this function decides, and no
// screen shows it more directly than the cards the function returns.

// cands builds a list from "A1 B1 A2": the letter is the card's work, and the
// whole token is its id in the sequences the tests compare.
func cands(spec string) []reviewCand {
	var out []reviewCand
	for i, tok := range strings.Fields(spec) {
		out = append(out, reviewCand{card: reviewCard{ID: int64(i), Note: tok}, workKey: tok[:1]})
	}
	return out
}

func dealt(deck []reviewCand) string {
	toks := make([]string, len(deck))
	for i, c := range deck {
		toks[i] = c.card.Note
	}
	return strings.Join(toks, " ")
}

// kinds prints a deck as U (never asked) and A (already asked), telling them
// apart by the list each card came from.
func kinds(deck []reviewCand, asked []reviewCand) string {
	fromAsked := map[string]bool{}
	for _, c := range asked {
		fromAsked[c.card.Note] = true
	}
	var b strings.Builder
	for _, c := range deck {
		if fromAsked[c.card.Note] {
			b.WriteByte('A')
		} else {
			b.WriteByte('U')
		}
	}
	return b.String()
}

// The owner's ruling at 3.0.3, "Unseen get most slots": two quotes never asked,
// then one already asked. Written out as the sequence, not as a formula over the
// constant, so moving the constant is a failure here and not a new expectation.
func TestMergeDeckDealsTwoNotYetAskedToOneAsked(t *testing.T) {
	if reviewDueEvery != 3 {
		t.Fatalf("reviewDueEvery = %d; the ruling is two unseen to one asked, so every third slot", reviewDueEvery)
	}
	asked := cands("a1 b1 c1 d1")
	unseen := cands("e1 f1 g1 h1 i1 j1 k1 l1")
	deck := mergeDeck(asked, unseen, 12, reviewDueEvery, 0)
	if got := kinds(deck, asked); got != "UUAUUAUUAUUA" {
		t.Fatalf("dealt %s, want UUAUUAUUAUUA", got)
	}
}

// Two lists each rotated by work can still put one work in consecutive slots
// where they are dealt together. A slot looks a few cards down its own list for
// a work not among the last two dealt.
func TestMergeDeckKeepsOneWorkOutOfConsecutiveSlots(t *testing.T) {
	// The seam: slot three is asked, and the asked list leads with the work slot
	// one just dealt.
	asked := cands("X9 Y9")
	unseen := cands("X1 Z1 X2 Z2")
	if got := dealt(mergeDeck(asked, unseen, 4, reviewDueEvery, 0)); got != "X1 Z1 Y9 X2 Z2 X9" {
		t.Errorf("across the seam: %s, want X1 Z1 Y9 X2 Z2 X9", got)
	}
	// Inside one list, and where nothing else is left the list's own order wins.
	if got := dealt(mergeDeck(nil, cands("A1 A2 A3 B1 C1"), 5, reviewDueEvery, 0)); got != "A1 B1 C1 A2 A3" {
		t.Errorf("one list: %s, want A1 B1 C1 A2 A3", got)
	}
}

// Every card handed in comes back once: stepping past a card to reach another
// work reorders the list and must not drop or repeat one. The inputs are left
// as they were, because Daily passes the lists it fetched and reads them again.
func TestMergeDeckLosesAndRepeatsNothing(t *testing.T) {
	asked := cands("A1 A2 B1 A3 C1 A4")
	unseen := cands("A5 A6 A7 B2 A8 C2 B3 A9 A10")
	before := dealt(asked) + " | " + dealt(unseen)
	deck := mergeDeck(asked, unseen, 6, reviewDueEvery, 0)
	if len(deck) != len(asked)+len(unseen) {
		t.Fatalf("dealt %d cards from %d", len(deck), len(asked)+len(unseen))
	}
	seen := map[string]int{}
	for _, c := range deck {
		seen[c.card.Note]++
	}
	for _, c := range append(append([]reviewCand{}, asked...), unseen...) {
		if seen[c.card.Note] != 1 {
			t.Errorf("%s dealt %d times in %s", c.card.Note, seen[c.card.Note], dealt(deck))
		}
	}
	if after := dealt(asked) + " | " + dealt(unseen); after != before {
		t.Errorf("the inputs changed: %s, were %s", after, before)
	}
}

// A FETCH THAT FOLDS LINKS INTO A RECORD KEEPS THE NAMES A READER GAVE THEM.
//
// A record's links are one free-text field, and a fetch rewrites the whole of it
// to fold in what it found — which is where a name the reader typed beside a link
// (`https://… | Their essays`) would be lost, silently and for good.
//
// WHAT IT KNOWS, declared, because a test here may not know the code: the fold by
// its name, mergeLinks, and that it takes the stored field and the fetched links
// by provider. This is the pure tier's test moved across the boundary. Until
// 3.1.0 the fold was people.jsx's mergeLinks, where the function IS the observable
// unit, and its first two cases below were the two in
// web/frontend/test/pure/link-names.test.js ("a fetch that rewrites the whole
// field"); the fold moved to the server with the People row's Fetch, and the cases
// came with it, verbatim. The SPA's rule link-fold-keeps-names.test.js holds this
// file to them by name, so the file, the test's name and both cases' strings stay.
// The same fold through the routes a reader presses — a person's Fetch and a
// person's re-verify — is driven in person_fetch_test.go and reverify_test.go.
//
// What each case guards, in a sentence a person would say: a fetch leaves the
// names on my links alone and adds the link it found; a link I never named stays
// exactly as I typed it; two links on one line with a name after them are still
// two links, and the name stays on the one it was written against; an address
// the browser takes with a bare % in it is an address here too, and keeps its
// name.
func TestMergeLinksKeepsTheReadersNames(t *testing.T) {
	const (
		imdb  = "https://www.imdb.com/name/nm0000123/"
		mine  = "https://example.org/essays"
		other = "https://example.net/talks"
		tmdb  = "https://www.themoviedb.org/person/1"
	)

	t.Run("a fetch leaves the names the reader gave alone", func(t *testing.T) {
		stored := "https://www.imdb.com/name/nm0000123/ | The other one\nhttps://example.org/essays | Their essays"
		got := mergeLinks(stored, map[string]string{"tmdb": tmdb})
		after := parseLinks(got)
		if after.labels[imdb] != "The other one" || after.labels[mine] != "Their essays" {
			t.Fatalf("the names after the fold: %q, from\n%s", after.labels, got)
		}
		if after.known["tmdb"] == "" {
			t.Fatalf("the fetched link did not land:\n%s", got)
		}
		// And where each line goes: the providers in their order, then the rest.
		want := imdb + " | The other one\n" + tmdb + "\n" + mine + " | Their essays"
		if got != want {
			t.Fatalf("the folded field:\n%s\nwant\n%s", got, want)
		}
	})

	t.Run("a link nobody has named stays unnamed rather than gaining an empty one", func(t *testing.T) {
		if got := mergeLinks("https://example.org/essays", map[string]string{}); got != mine {
			t.Fatalf("the folded field: %q, want %q", got, mine)
		}
	})

	t.Run("two addresses on one line stay two, and the name stays on the last", func(t *testing.T) {
		// The field has always split on whitespace, which is why the separator is a
		// pipe: naming something on a line of two links may not make them one.
		got := mergeLinks(mine+" "+other+" | Their talks", nil)
		if want := mine + "\n" + other + " | Their talks"; got != want {
			t.Fatalf("the folded field:\n%s\nwant\n%s", got, want)
		}
	})

	t.Run("an address with a bare % in it is still an address, and keeps its name", func(t *testing.T) {
		// A browser takes a % that begins no escape as it is; Go's own parser
		// does not, and the name on the link went with it.
		const sale = "https://example.org/sale-50%-off"
		if got, want := mergeLinks(sale+" | The sale", nil), sale+" | The sale"; got != want {
			t.Fatalf("the folded field: %q, want %q", got, want)
		}
		// And a provider's page with one is still that provider's, and wins over
		// the one fetched.
		const search = "https://www.imdb.com/find?q=100%"
		after := parseLinks(mergeLinks(search+" | My search", map[string]string{"imdb": imdb}))
		if after.known["imdb"] != search || after.labels[search] != "My search" {
			t.Fatalf("a stored IMDb page with a bare %%: known %q, names %q", after.known, after.labels)
		}
		// Something with no scheme is no address, % or not, and takes no name.
		if got := mergeLinks("50%-off | A name", nil); got != "50%-off" {
			t.Fatalf("the folded field: %q, want the token without a name", got)
		}
	})
}

// MERGING ONE TAG INTO ANOTHER, AND THE COLLISION THAT MAKES IT HARD.
//
// A near-duplicate pair — "translation" and "on translation" — is a pair a reader
// has used interchangeably, so some quotes carry one, some the other, and SOME
// CARRY BOTH. Both join tables are PRIMARY KEY (quote, tag), so the obvious
// implementation (`UPDATE annotation_tags SET tag_id = keep WHERE tag_id = drop`)
// aborts the whole transaction on the first quote that already has both — and the
// merge does nothing while looking, from the client, like a 500 on a good request.
//
// So the case below MAKES that quote deliberately. Without it a merge written the
// naive way passes every assertion here.

type tagMergeResp struct {
	Tag   tagRow `json:"tag"`
	Moved int    `json:"moved"`
}

func TestMergingATagKeepsEveryQuoteThatCarriedEitherOne(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	book := decode[bookDetail](t, c.mustDo("POST", "/books",
		map[string]any{"title": "Dune"}, http.StatusCreated))
	movie := decode[movieDetail](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "Casablanca"}, http.StatusCreated))

	// One quote under each name, and ONE UNDER BOTH — the row that collides.
	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book.ID, "quote": "only the loser's name", "tags": []string{"on translation"},
	}, http.StatusCreated)
	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book.ID, "quote": "only the survivor's name", "tags": []string{"translation"},
	}, http.StatusCreated)
	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book.ID, "quote": "both names at once", "tags": []string{"translation", "on translation"},
	}, http.StatusCreated)
	// A FILM LINE TOO, because the tag joins are two tables and a merge that only
	// learned one would leave every dialogue pointing at a tag that is gone.
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": movie.ID, "quote": "here's looking at you", "tags": []string{"on translation"},
	}, http.StatusCreated)

	before := decode[tagsResp](t, c.mustDo("GET", "/tags", nil, http.StatusOK))
	var keep, drop int64
	for _, tg := range before.Tags {
		switch tg.Name {
		case "translation":
			keep = tg.ID
		case "on translation":
			drop = tg.ID
		}
	}
	if keep == 0 || drop == 0 {
		t.Fatalf("both tags should exist before the merge: %v", tagNames(before.Tags))
	}

	got := decode[tagMergeResp](t, c.mustDo("POST", "/tags/merge",
		map[string]any{"keep_id": keep, "drop_ids": []int64{drop}}, http.StatusOK))

	// THE SURVIVOR CARRIES EVERY QUOTE EITHER NAME CARRIED, counted once. Three
	// annotations mentioned one or the other; one film line did. A merge that
	// dropped the collision row would report three.
	if got.Tag.Annotations != 3 || got.Tag.Dialogues != 1 {
		t.Fatalf("the survivor lost quotes in the merge: %+v", got.Tag)
	}
	// AND `moved` IS WHAT GAINED THE TAG, not what was touched: the quote that
	// already carried both gains nothing, so two of the three, plus the line.
	if got.Moved != 2 {
		t.Fatalf("moved should count the quotes that gained the tag, got %d", got.Moved)
	}
	after := decode[tagsResp](t, c.mustDo("GET", "/tags", nil, http.StatusOK))
	for _, tg := range after.Tags {
		if tg.Name == "on translation" {
			t.Fatalf("the merged-away tag is still in the vocabulary")
		}
	}
}

// ANOTHER ACCOUNT'S TAG IS NOT THERE, which for this endpoint means two separate
// things and the second is the dangerous one: a merge INTO somebody else's tag
// must not quietly delete your own on the way.
func TestMergingTagsCannotReachAnotherAccount(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	owner := signupAdmin(t, h)
	other := addUser(t, h, owner, "intruder")

	book := decode[bookDetail](t, owner.mustDo("POST", "/books",
		map[string]any{"title": "Dune"}, http.StatusCreated))
	owner.mustDo("POST", "/annotations", map[string]any{
		"book_id": book.ID, "quote": "mine", "tags": []string{"keepme", "dropme"},
	}, http.StatusCreated)
	mine := decode[tagsResp](t, owner.mustDo("GET", "/tags", nil, http.StatusOK))
	var keep, drop int64
	for _, tg := range mine.Tags {
		switch tg.Name {
		case "keepme":
			keep = tg.ID
		case "dropme":
			drop = tg.ID
		}
	}

	// Merging MY tag into a stranger's is a 404 — and the interesting half is
	// that `dropme` has to survive it. A loop that checked only the losers would
	// have deleted it before discovering the survivor was not there.
	other.mustDo("POST", "/tags/merge",
		map[string]any{"keep_id": keep, "drop_ids": []int64{drop}}, http.StatusNotFound)
	still := decode[tagsResp](t, owner.mustDo("GET", "/tags", nil, http.StatusOK))
	found := 0
	for _, tg := range still.Tags {
		if tg.Name == "keepme" || tg.Name == "dropme" {
			found++
		}
	}
	if found != 2 {
		t.Fatalf("a stranger's merge removed one of my tags: %v", tagNames(still.Tags))
	}
}
