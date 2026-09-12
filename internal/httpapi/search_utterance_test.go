package httpapi

// Search over standalone quotes (ROADMAP §24).
//
// Everything else search touches takes its user scope from a parent join —
// `JOIN books b ON b.id = a.book_id WHERE b.user_id = ?` is simultaneously how
// the row is reached and how it is authorised, so a query that forgets the
// scope returns nothing rather than someone else's rows. An utterance has no
// parent, so each of these queries carries `WHERE u.user_id = ?` itself, and
// there are six of them: quote·occasion, speaker, note, tag, date-added, and
// the cross-column fallback. TestSearchQuotesNeverLeak walks all six.

import (
	"net/http"
	"testing"
)

func TestSearchFindsAQuoteByItsWords(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	newUtterance(t, c, bose())

	res := decode[searchResults](t, c.mustDo("GET", "/search?q=freedom", nil, http.StatusOK))
	if len(res.Quotes) != 1 {
		t.Fatalf("expected one quote, got %d", len(res.Quotes))
	}
	got := res.Quotes[0]
	if got.Quote != "Give me blood, and I will give you freedom" {
		t.Fatalf("quote: %q", got.Quote)
	}
	// A quote has no parent to borrow grouping keys from, so the fields the
	// client groups by have to come back on the row itself.
	if got.Speaker != "Subhas Chandra Bose" || got.Occasion != "Burma Radio broadcast" ||
		got.OccasionDate != "1944" || got.Place != "Burma" || got.Medium != "radio" {
		t.Fatalf("the occasion did not survive the trip: %+v", got)
	}
}

// The occasion is the title the review deck shows, and a title you cannot
// search for is the gap this feature would be judged on. It is indexed by
// migration 0026 for exactly this.
//
// THE DECOY BOOK IS THE TEST. Without it this passes even when the quote facet
// does not search the occasion at all, because a faceted pass that finds
// nothing falls through to the cross-column fallback, which matches every
// indexed column and picks the quote up anyway. That fallback only runs when
// NOTHING else matched — so a library holding one book with "Burma" in the
// title is enough to suppress it, and the quote would vanish from the results
// for every user who owns both. The decoy makes the faceted pass non-empty, so
// the quote can only arrive through its own facet.
func TestSearchFindsAQuoteByItsOccasion(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	newUtterance(t, c, bose())
	c.mustDo("POST", "/books", map[string]any{"title": "Burma Boy: a radio broadcast history"}, http.StatusCreated)

	for _, q := range []string{"Burma+Radio", "broadcast", "burma"} {
		res := decode[searchResults](t, c.mustDo("GET", "/search?q="+q, nil, http.StatusOK))
		if len(res.Books) == 0 {
			t.Fatalf("q=%q did not match the decoy, so the fallback could still be rescuing this", q)
		}
		if len(res.Quotes) != 1 {
			t.Errorf("q=%q found %d quotes by occasion", q, len(res.Quotes))
		}
	}
}

// Searching a person's name is asking about the person, so it lands in its own
// section grouped by name — the same treatment authors and actors get.
func TestSearchGroupsQuotesBySpeaker(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	newUtterance(t, c, bose())
	second := bose()
	second["quote"] = "Freedom is not given, it is taken"
	second["occasion"] = "Singapore rally"
	newUtterance(t, c, second)

	fdr := map[string]any{
		"quote":   "The only thing we have to fear is fear itself",
		"speaker": "Franklin D. Roosevelt", "occasion": "first inaugural address",
	}
	newUtterance(t, c, fdr)

	res := decode[searchResults](t, c.mustDo("GET", "/search?q=Bose", nil, http.StatusOK))
	if len(res.Speakers) != 1 {
		t.Fatalf("expected one speaker group, got %d", len(res.Speakers))
	}
	if res.Speakers[0].Name != "Subhas Chandra Bose" {
		t.Fatalf("speaker name: %q", res.Speakers[0].Name)
	}
	if len(res.Speakers[0].Quotes) != 2 {
		t.Fatalf("expected both of the speaker's quotes, got %d", len(res.Speakers[0].Quotes))
	}
}

func TestSearchFindsAQuoteByItsNote(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	body := bose()
	body["note"] = "the Azad Hind broadcast my grandfather remembered"
	newUtterance(t, c, body)

	res := decode[searchResults](t, c.mustDo("GET", "/search?q=grandfather", nil, http.StatusOK))
	if len(res.Notes.Quotes) != 1 {
		t.Fatalf("expected one note hit, got %d", len(res.Notes.Quotes))
	}
	// A note match is a note match, not a quote match — that is the whole point
	// of sectioning by what matched.
	if len(res.Quotes) != 0 {
		t.Fatalf("a note match leaked into the quotes section: %d", len(res.Quotes))
	}
}

func TestSearchTagFacetCountsQuotes(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	body := bose()
	body["tags"] = []string{"freedom"}
	newUtterance(t, c, body)

	res := decode[searchResults](t, c.mustDo("GET", "/search?q=freedom", nil, http.StatusOK))
	if len(res.Tags) != 1 {
		t.Fatalf("expected the tag facet, got %d", len(res.Tags))
	}
	if res.Tags[0].Count != 1 {
		t.Fatalf("the tag count did not include the quote: %d", res.Tags[0].Count)
	}
	if len(res.Tags[0].Quotes) != 1 {
		t.Fatalf("the tag facet did not carry the quote: %d", len(res.Tags[0].Quotes))
	}
}

func TestSearchDateFacetIncludesQuotes(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	u := newUtterance(t, c, bose())

	if _, err := srv.Store.DB.Exec(
		`UPDATE utterances SET created_at = '2026-07-14 09:00:00' WHERE id = ?`, u.ID); err != nil {
		t.Fatal(err)
	}
	res := decode[searchResults](t, c.mustDo("GET", "/search?q=2026-07-14", nil, http.StatusOK))
	if res.DateAdded == nil {
		t.Fatal("the day came back quiet even though a quote was saved on it")
	}
	if len(res.DateAdded.Quotes) != 1 {
		t.Fatalf("expected the quote in the date facet, got %d", len(res.DateAdded.Quotes))
	}
}

// scope=quotes must exclude the other media, and the media scopes must exclude
// quotes. A scope that silently returns everything is a filter that does nothing.
func TestSearchScopeQuotes(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	book := decode[bookDetail](t, c.mustDo("POST", "/books",
		map[string]any{"title": "Freedom at Midnight"}, http.StatusCreated))
	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book.ID, "quote": "a passage about freedom",
	}, http.StatusCreated)
	newUtterance(t, c, bose())

	all := decode[searchResults](t, c.mustDo("GET", "/search?q=freedom", nil, http.StatusOK))
	if len(all.Quotes) != 1 || len(all.Annotations) != 1 {
		t.Fatalf("scope=all should see both: %d quotes, %d annotations", len(all.Quotes), len(all.Annotations))
	}

	onlyQuotes := decode[searchResults](t, c.mustDo("GET", "/search?q=freedom&scope=quotes", nil, http.StatusOK))
	if len(onlyQuotes.Quotes) != 1 {
		t.Fatalf("scope=quotes lost the quote: %d", len(onlyQuotes.Quotes))
	}
	if len(onlyQuotes.Annotations) != 0 || len(onlyQuotes.Books) != 0 {
		t.Fatalf("scope=quotes returned library rows: %d annotations, %d books",
			len(onlyQuotes.Annotations), len(onlyQuotes.Books))
	}

	onlyBooks := decode[searchResults](t, c.mustDo("GET", "/search?q=freedom&scope=books", nil, http.StatusOK))
	if len(onlyBooks.Quotes) != 0 {
		t.Fatalf("scope=books returned standalone quotes: %d", len(onlyBooks.Quotes))
	}
}

// Six queries, each carrying its own user scope. This is the test that fails if
// any one of them is written without it.
func TestSearchQuotesNeverLeak(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")

	body := bose()
	body["note"] = "a note about the grandfather who heard it"
	body["tags"] = []string{"freedom"}
	mine := newUtterance(t, alice, body)
	if _, err := srv.Store.DB.Exec(
		`UPDATE utterances SET created_at = '2026-07-14 09:00:00' WHERE id = ?`, mine.ID); err != nil {
		t.Fatal(err)
	}

	// Bob owns a quote of his own, so the FTS index is not simply empty for him
	// — a leak has to be hidden by the scope, not by there being nothing to find.
	newUtterance(t, bob, map[string]any{"quote": "something else entirely", "speaker": "Someone Else"})

	for _, q := range []struct{ name, url string }{
		{"quote", "/search?q=freedom"},
		{"occasion", "/search?q=Burma"},
		{"speaker", "/search?q=Bose"},
		{"note", "/search?q=grandfather"},
		{"date added", "/search?q=2026-07-14"},
		// A query spanning columns takes the cross-column fallback instead of the
		// faceted pass, and that query needs its own scope too.
		{"cross-column", "/search?q=blood+Bose"},
	} {
		res := decode[searchResults](t, bob.mustDo("GET", q.url, nil, http.StatusOK))
		if len(res.Quotes) != 0 {
			t.Errorf("%s search leaked %d of another account's quotes", q.name, len(res.Quotes))
		}
		if len(res.Notes.Quotes) != 0 {
			t.Errorf("%s search leaked %d quotes through notes", q.name, len(res.Notes.Quotes))
		}
		for _, sp := range res.Speakers {
			if len(sp.Quotes) != 0 {
				t.Errorf("%s search leaked %d quotes through the speaker facet", q.name, len(sp.Quotes))
			}
		}
		for _, tag := range res.Tags {
			if tag.Count != 0 || len(tag.Quotes) != 0 {
				t.Errorf("%s search leaked the tag facet: count=%d quotes=%d", q.name, tag.Count, len(tag.Quotes))
			}
		}
		if res.DateAdded != nil && len(res.DateAdded.Quotes) != 0 {
			t.Errorf("%s search leaked %d quotes through the date facet", q.name, len(res.DateAdded.Quotes))
		}
	}

	// And the owner still finds their own.
	res := decode[searchResults](t, alice.mustDo("GET", "/search?q=freedom", nil, http.StatusOK))
	if len(res.Quotes) != 1 {
		t.Fatalf("the owner lost their quote: %d", len(res.Quotes))
	}
}

// The typo-correction vocabulary is harvested per scope, so a kind missing from
// that list means its words can never be the correction — "freedomm" would keep
// finding nothing however many quotes contain the word.
func TestSearchCorrectsATypoAgainstQuoteVocabulary(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	newUtterance(t, c, bose())

	res := decode[searchResults](t, c.mustDo("GET", "/search?q=freedomm&scope=quotes", nil, http.StatusOK))
	if res.Corrected == "" {
		t.Fatal("a typo over a quote-only library was not corrected")
	}
	if len(res.Quotes) != 1 {
		t.Fatalf("the corrected pass found %d quotes", len(res.Quotes))
	}
}

// ---- the face a search hit is drawn in ---------------------------------------
//
// A SEARCH HIT IS THE QUOTE, and it reads in the face the reader set for its
// language like every other quote surface. The client asks each hit for its
// `language` (SearchPage.jsx); the field existed on a standalone quote's hit and
// on neither of the other two, so `languageClass(h.language)` was permanently ”
// on book and film results — the class was there, the face never arrived, and a
// CHANGELOG entry said search was covered.
//
// THIS IS THE HALF NO FRONTEND TEST CAN SEE. A vitest case renders a hit it built
// itself, so it proves the class is applied and can say nothing about whether the
// server ever sends the field to put in it.
func TestASearchHitCarriesItsQuotesLanguage(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())

	book := decode[bookDetail](t, c.mustDo("POST", "/books",
		map[string]any{"title": "Die Räuber", "author": "Friedrich Schiller"}, http.StatusCreated))
	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book.ID, "quote": "Mir ekelt vor diesem tintenklecksenden Saeculum",
		"language": "German",
	}, http.StatusCreated)

	movie := decode[movieDetail](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "Nosferatu"}, http.StatusCreated))
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": movie.ID, "quote": "Mir ekelt vor dem Morgen", "language": "German",
	}, http.StatusCreated)

	res := decode[struct {
		Annotations []struct {
			Language string `json:"language"`
		} `json:"annotations"`
		Dialogues []struct {
			Language string `json:"language"`
		} `json:"dialogues"`
	}](t, c.mustDo("GET", "/search?q=ekelt", nil, http.StatusOK))

	// NEITHER LIST MAY BE EMPTY, or the assertions below are true of nothing —
	// the shape this file's other cases already guard against.
	if len(res.Annotations) != 1 || len(res.Dialogues) != 1 {
		t.Fatalf("the search found %d highlights and %d lines, want one of each",
			len(res.Annotations), len(res.Dialogues))
	}
	if res.Annotations[0].Language != "German" {
		t.Errorf("a book hit lost its language: %q", res.Annotations[0].Language)
	}
	if res.Dialogues[0].Language != "German" {
		t.Errorf("a film hit lost its language: %q", res.Dialogues[0].Language)
	}
}

// AND AN ANTHOLOGY ENTRY CARRIES ONE TOO, for the same reason and on the surface
// that is most obviously a page of quotes.
func TestAnAnthologyEntryCarriesItsQuotesLanguage(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())

	book := decode[bookDetail](t, c.mustDo("POST", "/books",
		map[string]any{"title": "Die Räuber"}, http.StatusCreated))
	ann := decode[annotationRow](t, c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book.ID, "quote": "ein Satz", "language": "German",
	}, http.StatusCreated))
	a := newAnthology(t, c, "Deutsch")
	addEntries(t, c, a.ID, []map[string]any{{"kind": "book", "item_id": ann.ID}})

	got := getAnthology(t, c, a.ID)
	if len(got.Entries) != 1 {
		t.Fatalf("want one entry, got %d", len(got.Entries))
	}
	if got.Entries[0].Language != "German" {
		t.Errorf("the anthology entry lost its language: %q", got.Entries[0].Language)
	}
}

// AND IT CARRIES THE THREE FIELDS ITS ATTRIBUTION IS COMPOSED FROM.
//
// The results list draws a quote's credit with `utteranceMeta`, the same
// function the board's card uses — and that composes the kind's PHRASE rather
// than joining whatever is non-empty: "Letter to Carl Seelig", not "Letter" and
// an occasion holding the recipient by hand. The phrase reads `recipient`,
// `work_title` and `locator`, so a hit without them draws the kind's bare word
// where the board draws the fact, and one quote has two pictures on two screens.
//
// `region` is deliberately NOT here and this case says so: the owner's
// correction made a proverb's attribution `{language} proverb`, so no shape
// consumes region and shipping it would be a column with no reader.
func TestASearchHitCarriesWhatItsAttributionIsMadeOf(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())

	newUtterance(t, c, map[string]any{
		"quote": "unforgivable to waste one's life", "kind": "letter",
		"speaker": "Albert Einstein", "recipient": "Carl Seelig", "occasion": "after the prize",
	})
	newUtterance(t, c, map[string]any{
		"quote": "unforgivable to leave a page unnumbered", "kind": "essay",
		"work_title": "Why Socialism?", "locator": "p. 3",
	})

	res := decode[struct {
		Quotes []struct {
			Kind      string `json:"kind"`
			Recipient string `json:"recipient"`
			WorkTitle string `json:"work_title"`
			Locator   string `json:"locator"`
		} `json:"quotes"`
	}](t, c.mustDo("GET", "/search?q=unforgivable&scope=quotes", nil, http.StatusOK))

	if len(res.Quotes) != 2 {
		t.Fatalf("the search found %d quotes, want 2 — the assertions below would be true of nothing", len(res.Quotes))
	}
	byKind := map[string]struct{ Kind, Recipient, WorkTitle, Locator string }{}
	for _, q := range res.Quotes {
		byKind[q.Kind] = struct{ Kind, Recipient, WorkTitle, Locator string }{q.Kind, q.Recipient, q.WorkTitle, q.Locator}
	}
	if got := byKind["letter"].Recipient; got != "Carl Seelig" {
		t.Errorf("a letter hit's recipient = %q, want %q — without it the row reads \"Letter\"", got, "Carl Seelig")
	}
	if got := byKind["essay"].WorkTitle; got != "Why Socialism?" {
		t.Errorf("an essay hit's work_title = %q, want %q", got, "Why Socialism?")
	}
	if got := byKind["essay"].Locator; got != "p. 3" {
		t.Errorf("an essay hit's locator = %q, want %q", got, "p. 3")
	}
}
