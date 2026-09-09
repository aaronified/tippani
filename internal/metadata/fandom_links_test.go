package metadata

// A PASTED FANDOM ADDRESS NAMES BOTH THINGS THE GUESSWORK WAS FOR.
//
// THE OWNER'S REPORT, and the URL is theirs: "the fandom and tvdb way of character
// image needs to be rechecked. fandom has adama. there needs to be a way to tell
// tippani to look for william_adama in this link and then fetch the image from
// there. the wiki name galactica is not very straight forward here."
//
//	https://galactica.fandom.com/wiki/William_Adama
//
// `FandomWikiCandidates` derives slugs from a TITLE and cannot reach `galactica`
// from "Battlestar Galactica" by any rule — which is not a bug in the derivation,
// it is why a reader has to be able to say. One address answers both questions:
// the wiki is its host and the article is its path.

import "testing"

func TestAPastedFandomAddressNamesTheWikiAndThePage(t *testing.T) {
	// THE OWNER'S OWN LINK, first, because it is the case this exists for.
	wiki, page := FandomPageFromLinks("https://galactica.fandom.com/wiki/William_Adama")
	if wiki != "galactica" {
		t.Fatalf("wiki = %q, want galactica — the host is the wiki", wiki)
	}
	// UNDERSCORES ARE A URL'S SPACES. MediaWiki's API takes the title with spaces,
	// so a page passed through verbatim would miss every multi-word article.
	if page != "William Adama" {
		t.Fatalf("page = %q, want \"William Adama\"", page)
	}
}

func TestTheTitleCouldNeverHaveGuessedThatWiki(t *testing.T) {
	// The point of the feature, stated as a fact rather than as prose: this is
	// what the derivation offers, and `galactica` is not in it.
	for _, s := range FandomWikiCandidates("Battlestar Galactica") {
		if s == "galactica" {
			t.Fatalf("the derivation reaches galactica after all — this feature's premise is wrong")
		}
	}
}

func TestAFandomAddressIsFoundAmongOtherLinks(t *testing.T) {
	// `links` is free text holding whatever the reader added, so the Fandom one is
	// recognised by its HOST and not by being first or alone.
	links := "https://www.imdb.com/name/nm0000123/\n" +
		"https://galactica.fandom.com/wiki/William_Adama\n" +
		"https://en.wikipedia.org/wiki/Battlestar_Galactica"
	wiki, page := FandomPageFromLinks(links)
	if wiki != "galactica" || page != "William Adama" {
		t.Fatalf("got %q / %q among three links", wiki, page)
	}
}

func TestWhatIsNotAPage(t *testing.T) {
	for _, c := range []struct {
		name, in, wiki, page string
	}{
		// A WIKI WITH NO ARTICLE still tells us the wiki, which is worth more than
		// a guess from the title — so it comes back with an empty page and the
		// caller searches on the right wiki instead of the wrong one.
		{"the front page", "https://galactica.fandom.com", "galactica", ""},
		{"a category", "https://galactica.fandom.com/wiki/", "galactica", ""},
		// A LOCALISED WIKI keeps its wiki in the host; Fandom puts the language in
		// the path, so the first label is still the answer.
		{"a localised page", "https://starwars.fandom.com/de/wiki/Yoda", "starwars", "Yoda"},
		{"not fandom at all", "https://en.wikipedia.org/wiki/Yoda", "", ""},
		{"nothing", "", "", ""},
		{"not a url", "adama", "", ""},
	} {
		w, p := FandomPageFromLinks(c.in)
		if w != c.wiki || p != c.page {
			t.Errorf("%s: got %q / %q, want %q / %q", c.name, w, p, c.wiki, c.page)
		}
	}
}
