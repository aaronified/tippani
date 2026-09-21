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

import (
	"slices"
	"testing"
)

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

// THE OWNER'S OWN CASE, AND IT IS WHY THE SERIES BECAME AN INPUT. "I do not ever
// see shit from fandom about characters… Even for very obvious ones, like
// itkovian." Itkovian is in Malazan Book of the Fallen, whose wiki is `malazan`,
// and every candidate the ladder used to produce came off the VOLUME — so no
// probe ever went near it.
//
// THE MUTATION: delete the word-shortening loop in FandomWikiCandidatesFor (keep
// only the whole series name) and the malazan case goes red — `malazan` is the
// FIRST word of a five-word series, which is exactly the candidate that loop
// exists to reach.
func TestTheWikiCanBeNamedForTheSeriesRatherThanTheVolume(t *testing.T) {
	for _, c := range []struct {
		title, series, want string
	}{
		// The case that was reported. Nothing in "Memories of Ice" reaches
		// `malazan`; only the series does, and only once it is cut to one word.
		{"Memories of Ice", "Malazan Book of the Fallen", "malazan"},
		// A leading article is dropped by the slug, so the first word of "The
		// Witcher Saga" is `witcher` — the wiki that actually exists.
		{"Blood of Elves", "The Witcher Saga", "witcher"},
		// A one-word series needs no shortening and must still be offered.
		{"The Fellowship of the Ring", "Discworld", "discworld"},
	} {
		got := FandomWikiCandidatesFor(c.title, c.series)
		if !slices.Contains(got, c.want) {
			t.Errorf("FandomWikiCandidatesFor(%q, %q) never offers %q; got %v", c.title, c.series, c.want, got)
		}
		// THE VOLUME STILL COMES FIRST. A wiki dedicated to one book is a better
		// answer than the franchise's when both exist, so a series candidate that
		// pushed ahead of the title's would make the specific answer unreachable.
		if len(got) == 0 || got[0] != fandomSlug(c.title) {
			t.Errorf("FandomWikiCandidatesFor(%q, %q) should lead with the volume's own slug; got %v", c.title, c.series, got)
		}
	}
}

// AND THE PROBES ARE CAPPED, because each one is a request. A long series name
// must not turn one work's first character lookup into a dozen round trips.
func TestTheWikiLadderIsCapped(t *testing.T) {
	got := FandomWikiCandidatesFor(
		"Some Very Long Instalment Title: With A Subtitle",
		"An Extremely Long Running Series Of Many Separate Words Indeed",
	)
	if len(got) > maxFandomWikiCandidates {
		t.Errorf("the ladder offers %d candidates, past the cap of %d: %v", len(got), maxFandomWikiCandidates, got)
	}
	// AND THE FIRST WORD SURVIVES THE CAP, which is the one the cap could most
	// easily have cut — it is the LAST candidate the shortening loop produces. A
	// cap that dropped it would leave the franchise wiki unreachable for exactly
	// the long series names that need it most.
	if !slices.Contains(got, "extremely") {
		t.Errorf("the cap dropped the franchise candidate; got %v", got)
	}
}

// THE HOST FILTER ON THE CROSS-WIKI SEARCH, which is the half of that rung that
// can be checked without reaching the network.
//
// WHY IT MATTERS MORE THAN IT LOOKS: whatever comes back becomes a HOST this app
// then probes and stores on the work. A search index that answered with an advert,
// a redirect or some other wiki farm would have the app talking to it. So the
// filter is a whitelist by shape — a single third-level name under fandom.com —
// and everything else is "" , which is exactly what the caller did before the rung
// existed.
//
// THE MUTATION: drop the `.fandom.com` suffix check and the single-label
// `intranet` case starts returning a host. It has to be that row and not one of
// the dotted ones — those are refused by the dot guard as well, so the first
// mutation run here went green and proved the check untested rather than
// unnecessary.
func TestOnlyAFandomWikiComesOutOfTheSearch(t *testing.T) {
	for _, c := range []struct{ in, want string }{
		{"https://malazan.fandom.com/wiki/Itkovian", "malazan"},
		{"http://galactica.fandom.com/", "galactica"},
		// The index itself is not a work's wiki.
		{"https://community.fandom.com/wiki/Something", ""},
		// Anything that is not Fandom, however much it looks like it.
		{"https://evil.example/wiki/Thing", ""},
		{"https://fandom.com.evil.example/x", ""},
		{"https://notfandom.com/x", ""},
		// A SINGLE-LABEL HOST, AND IT IS THE ONE CASE THE SUFFIX CHECK ALONE
		// CATCHES. Everything else above is also refused by the dot guard below it
		// — `evil.example` and `fandom.com.evil.example` both keep a dot after the
		// suffix trim — so without this row the suffix check could be deleted and
		// this test would still pass. It was: the mutation was run, nothing went
		// red, and the claim in the header was false until this line existed.
		{"https://intranet/wiki/Thing", ""},
		// A deeper subdomain is not a slug this app addresses.
		{"https://a.b.fandom.com/x", ""},
		{"", ""},
		{"not a url at all", ""},
	} {
		if got := fandomHostSlug(c.in); got != c.want {
			t.Errorf("fandomHostSlug(%q) = %q, want %q", c.in, got, c.want)
		}
	}
}
