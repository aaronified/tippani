package httpapi

import (
	"strings"
	"testing"
)

// The reader's own vocabulary, for the facet dropdown.
//
// Two things have to hold, and one of them is a leak.
//
// PER USER, WITHOUT EXCEPTION. This endpoint's whole job is to hand back a list of
// names, and a missing `WHERE user_id = ?` on any one of eight queries offers
// somebody else's authors, speakers and tags to a stranger. It would look completely
// normal on a single-user instance, which is most of them.
//
// AND THE NAMES HAVE TO BE USABLE. A credit column holds joined strings ("Gaiman &
// Pratchett"), so an unsplit vocabulary offers a pair of names as one option that
// then matches nothing — a dropdown suggesting a search with no results.

type vocabResp struct {
	Tags       []string      `json:"tags"`
	Genres     []string      `json:"genres"`
	Series     []string      `json:"series"`
	Authors    []string      `json:"authors"`
	Directors  []string      `json:"directors"`
	Actors     []string      `json:"actors"`
	Characters []string      `json:"characters"`
	Speakers   []string      `json:"speakers"`
	Languages  []string      `json:"languages"`
	Books      []vocabColour `json:"books"`
	Movies     []vocabColour `json:"movies"`
	Shelves    []string      `json:"shelves"`
	Colours    []vocabColour `json:"colours"`
}

func vocabOf(t *testing.T, c *testClient) vocabResp {
	t.Helper()
	return decode[vocabResp](t, c.mustDo("GET", "/search/vocabulary", nil, 200))
}

func has(list []string, want string) bool {
	for _, v := range list {
		if v == want {
			return true
		}
	}
	return false
}

func TestVocabularyListsWhatTheLibraryUses(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	_ = srv

	bookID := idOf(t, c.mustDo("POST", "/books", map[string]any{
		"title": "The Dispossessed", "author": "Ursula K. Le Guin",
		"series": "Hainish", "genres": []string{"science fiction"},
	}, 201).Body.Bytes())
	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": bookID, "quote": "a highlight", "tags": []string{"politics", "craft"},
	}, 201)
	movieID := idOf(t, c.mustDo("POST", "/movies", map[string]any{
		"title": "Casablanca", "director": "Michael Curtiz",
	}, 201).Body.Bytes())
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": movieID, "quote": "a film line", "actor": "Humphrey Bogart",
		"character": "Rick Blaine",
	}, 201)
	c.mustDo("POST", "/quotes", map[string]any{"quote": "a spoken line", "speaker": "Subhas Chandra Bose"}, 201)

	v := vocabOf(t, c)
	for _, tc := range []struct {
		name string
		list []string
		want string
	}{
		{"tags", v.Tags, "politics"},
		{"genres", v.Genres, "Science Fiction"},
		{"series", v.Series, "Hainish"},
		{"authors", v.Authors, "Ursula K. Le Guin"},
		{"directors", v.Directors, "Michael Curtiz"},
		{"actors", v.Actors, "Humphrey Bogart"},
		{"characters", v.Characters, "Rick Blaine"},
		{"speakers", v.Speakers, "Subhas Chandra Bose"},
	} {
		if !has(tc.list, tc.want) {
			t.Errorf("%s does not offer %q: %v", tc.name, tc.want, tc.list)
		}
	}

	// Books and films come back as id + title, because the chip shows the title
	// and the wire carries the id — a title is not unique and an id is. They were
	// left out of the grammar entirely until 1.16.0 on the reasoning that there
	// was no vocabulary of titles to offer; there is, and this is it.
	if len(v.Books) != 1 || v.Books[0].Name != "The Dispossessed" || v.Books[0].Key == "" {
		t.Errorf("books = %+v, want one id/title pair", v.Books)
	}
	if len(v.Movies) != 1 || v.Movies[0].Name != "Casablanca" || v.Movies[0].Key == "" {
		t.Errorf("movies = %+v, want one id/title pair", v.Movies)
	}
}

func TestVocabularySplitsJoinedCredits(t *testing.T) {
	// `author:Gaiman` has to be offerable and matchable for a book credited to two
	// people. Unsplit, the dropdown suggests "Gaiman & Pratchett" as one option and
	// searching it finds nothing.
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	_ = srv
	c.mustDo("POST", "/books", map[string]any{"title": "Good Omens", "author": "Gaiman & Pratchett"}, 201)

	v := vocabOf(t, c)
	if !has(v.Authors, "Gaiman") || !has(v.Authors, "Pratchett") {
		t.Fatalf("authors = %v, want both names separately", v.Authors)
	}
	if has(v.Authors, "Gaiman & Pratchett") {
		t.Errorf("the joined string is still offered: %v", v.Authors)
	}
}

func TestVocabularyIsOnlyEverYourOwn(t *testing.T) {
	// The leak. Eight queries, and one missing user filter offers a stranger's
	// library — invisible on a single-user instance, which is most of them.
	srv := newTestServer(t)
	h := srv.Handler()
	admin := signupAdmin(t, h)
	bob := addUser(t, h, admin, "bob")
	_ = srv

	adminBook := idOf(t, admin.mustDo("POST", "/books", map[string]any{
		"title": "Admin's Book", "author": "Ursula K. Le Guin", "series": "Hainish",
		"genres": []string{"science fiction"},
	}, 201).Body.Bytes())
	admin.mustDo("POST", "/annotations", map[string]any{
		"book_id": adminBook, "quote": "mine", "tags": []string{"secretive"},
	}, 201)
	adminMovie := idOf(t, admin.mustDo("POST", "/movies", map[string]any{
		"title": "Admin's Film", "director": "Michael Curtiz",
	}, 201).Body.Bytes())
	admin.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": adminMovie, "quote": "mine too", "actor": "Humphrey Bogart",
		"character": "Rick Blaine",
	}, 201)
	admin.mustDo("POST", "/quotes", map[string]any{"quote": "mine as well", "speaker": "Bose"}, 201)

	v := vocabOf(t, bob)
	for _, tc := range []struct {
		name string
		list []string
		leak string
	}{
		{"tags", v.Tags, "secretive"},
		{"genres", v.Genres, "Science Fiction"},
		{"series", v.Series, "Hainish"},
		{"authors", v.Authors, "Ursula K. Le Guin"},
		{"directors", v.Directors, "Michael Curtiz"},
		{"actors", v.Actors, "Humphrey Bogart"},
		{"characters", v.Characters, "Rick Blaine"},
		{"speakers", v.Speakers, "Bose"},
	} {
		if has(tc.list, tc.leak) {
			t.Errorf("%s offered bob somebody else's %q: %v", tc.name, tc.leak, tc.list)
		}
	}

	// The two id-bearing lists are the newest leak surface and the worst-shaped
	// one: a title is a whole sentence out of somebody else's library, and the id
	// beside it is directly usable as a book: facet against an endpoint that
	// would then correctly refuse it. Both must simply be empty.
	for name, pairs := range map[string][]vocabColour{"books": v.Books, "movies": v.Movies} {
		for _, p := range pairs {
			t.Errorf("%s offered bob somebody else's %q (id %s)", name, p.Name, p.Key)
		}
	}
}

func TestVocabularyColoursCarryKeyAndName(t *testing.T) {
	// 1.7.1 made the six categories user-named, so the chip reads `colour:doubt`
	// while the query has to send `blue`. A facet showing the storage word would be
	// showing the reader a word they deliberately renamed.
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	_ = srv

	c.mustDo("PUT", "/auth/me/preferences", map[string]any{"catName2": "doubt"}, 200)
	v := vocabOf(t, c)
	if len(v.Colours) != 6 {
		t.Fatalf("colours = %+v, want six slots", v.Colours)
	}
	if v.Colours[1].Key != "blue" || v.Colours[1].Name != "doubt" {
		t.Fatalf("slot 2 = %+v, want key blue named doubt", v.Colours[1])
	}
	// An unnamed slot still has to be offerable, or the facet has holes in it.
	if v.Colours[3].Name == "" {
		t.Errorf("an unnamed slot came back nameless: %+v", v.Colours[3])
	}
	// Slot order is the schema's order, which is what the client's palette follows.
	keys := make([]string, 0, 6)
	for _, c := range v.Colours {
		keys = append(keys, c.Key)
	}
	want := []string{"yellow", "blue", "pink", "orange", "green", "purple"}
	for i := range want {
		if keys[i] != want[i] {
			t.Fatalf("colour slots = %v, want %v", keys, want)
		}
	}
}

func TestVocabularyIsEmptyRatherThanNullOnAFreshAccount(t *testing.T) {
	// A client maps over these. `null` is a crash where `[]` is an empty dropdown,
	// and a fresh account is exactly when somebody first opens the search box.
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	_ = srv

	v := vocabOf(t, c)
	for name, list := range map[string][]string{
		"tags": v.Tags, "genres": v.Genres, "series": v.Series, "authors": v.Authors,
		"directors": v.Directors, "actors": v.Actors, "characters": v.Characters,
		"speakers": v.Speakers, "shelves": v.Shelves,
	} {
		if list == nil {
			t.Errorf("%s came back null rather than an empty list", name)
		}
	}
}

// THE LANGUAGES THE LIBRARY IS IN, which is the list Settings' readable-languages
// chips are drawn from.
//
// WHAT THIS IS FOR, rather than what it returns: those chips used to be the ten
// starter languages plus every language the reader had given a MARK to. A quote
// typed as "Sanskrit" was in neither set, so there was no chip to press, so
// Sanskrit could not be declared readable, so that quote led with its translation
// for good — the exact opposite of what the reader wants from a line they can
// read. The fix is this facet, and the assertion below is on a language that is
// NOT a starter and has NO mark, because a starter would pass with the facet
// deleted.
func TestVocabularyOffersALanguageThatIsNeitherAStarterNorMarked(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	_ = srv

	c.mustDo("POST", "/quotes", map[string]any{
		"quote": "सत्यमेव जयते", "language": "Sanskrit", "translation": "Truth alone triumphs",
	}, 201)

	v := vocabOf(t, c)
	if !has(v.Languages, "Sanskrit") {
		t.Errorf("languages does not offer %q: %v", "Sanskrit", v.Languages)
	}
	// NOT SPLIT, unlike every other name-shaped facet here. A language is one name;
	// splitting on the credit separators would offer "Old" and "English" as two
	// languages nothing is stored under.
	c.mustDo("POST", "/quotes", map[string]any{
		"quote": "Hwæt!", "language": "Old English",
	}, 201)
	v = vocabOf(t, c)
	if !has(v.Languages, "Old English") {
		t.Errorf("languages lost the space in %q: %v", "Old English", v.Languages)
	}
	if has(v.Languages, "English") {
		t.Errorf("languages split a language name: %v", v.Languages)
	}
}

// And a language is nobody else's, on the endpoint whose whole hazard is a missing
// user_id — the same property TestVocabularyIsOnlyEverYourOwn holds for the other
// eight lists, extended to the ninth rather than assumed of it.
func TestVocabularyLanguagesAreOnlyEverYourOwn(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	admin := signupAdmin(t, h)
	bob := addUser(t, h, admin, "bob")
	admin.mustDo("POST", "/quotes", map[string]any{
		"quote": "সত্যের জয়", "language": "Bengali",
	}, 201)

	v := vocabOf(t, bob)
	if has(v.Languages, "Bengali") {
		t.Errorf("a stranger was offered the owner's languages: %v", v.Languages)
	}
}

// ONE LANGUAGE, ONE ROW, WHICHEVER WAY IT WAS TYPED.
//
// A language is free text on the quote, so a reader who typed "bengali" one day
// and "Bengali" the next has one language stored two ways. The list came back with
// both, and it is the list the language combobox offers FIRST and the list a
// board's chip row is drawn from — so the reader was asked to choose between two
// spellings of their own language, in a picker whose whole job is to stop them
// having to type it again.
//
// The two halves below are the same library in the two possible orders, and they
// are here together because either one alone passes for the wrong reason: a fold
// that always kept the capitalised spelling would satisfy the first and fail the
// second, and one that always kept the lowercase spelling the other way round.
// What is actually promised is the spelling written FIRST — validateBoard's rule,
// "bengali typed second should not win over Bengali", read the other way too.
func TestVocabularyOffersALanguageOnceWhateverItsCasing(t *testing.T) {
	for _, tc := range []struct{ name, first, second string }{
		{"capitalised first", "Bengali", "bengali"},
		{"lowercase first", "bengali", "Bengali"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			srv := newTestServer(t)
			c := signupAdmin(t, srv.Handler())
			c.mustDo("POST", "/quotes", map[string]any{
				"quote": "সত্যের জয়", "language": tc.first,
			}, 201)
			c.mustDo("POST", "/quotes", map[string]any{
				"quote": "কথার কথা", "language": tc.second,
			}, 201)

			v := vocabOf(t, c)
			n := 0
			for _, l := range v.Languages {
				if strings.EqualFold(l, "bengali") {
					n++
				}
			}
			if n != 1 {
				t.Errorf("one language spelled two ways came back %d times: %v", n, v.Languages)
			}
			if !has(v.Languages, tc.first) {
				t.Errorf("the spelling written first (%q) is not the one offered: %v", tc.first, v.Languages)
			}
		})
	}
}

// AND NOTHING ELSE IS FOLDED, which is the half of the rule that is easy to lose.
//
// `speaker:` and `tag:` match a stored value, and there is no NOCASE collation
// anywhere in the schema — so "Gandhi" and "gandhi" are two values finding two
// different sets of quotes. Folding them would offer one chip that looks like the
// whole library and returns half of it. A language has no facet to match against
// yet (#153) and an app-wide canonical form already (normalizeLanguageMarks folds
// its key, validateBoard folds before deduping, languages.jsx keys its mark table
// by the lowercased name), which is the entire difference.
func TestVocabularyDoesNotFoldTheCreditFacets(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	c.mustDo("POST", "/quotes", map[string]any{"quote": "the first line", "speaker": "Gandhi"}, 201)
	c.mustDo("POST", "/quotes", map[string]any{"quote": "the second line", "speaker": "gandhi"}, 201)

	v := vocabOf(t, c)
	if !has(v.Speakers, "Gandhi") || !has(v.Speakers, "gandhi") {
		t.Errorf("a speaker facet folded two stored values into one option: %v", v.Speakers)
	}
}
