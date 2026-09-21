package metadata

// Fandom — the wikis that cover the works Wikipedia does not.
//
// WHY IT IS WORTH A RUNG AT ALL. Wikipedia writes about a character when the
// character is notable outside their story; Fandom writes about every character
// in everything, in detail, with pictures. That is the difference between a
// picture for V and a picture for the fourth-billed role in a series nobody has
// written a paper about — and the second is most of a cast list.
//
// THE HARD PART IS WHICH WIKI, and it is genuinely unreliable. Fandom is not one
// MediaWiki, it is tens of thousands of them, one per fandom, addressed by a slug
// nobody publishes a mapping for: "V for Vendetta" lives at vforvendetta, the
// Marvel wiki is marvel and not marvelcomics, Star Wars is starwars and its
// characters are also on wookieepedia. There is no first-party endpoint this
// client can rely on to turn a work's title into a slug.
//
// SO THIS GUESSES THE SLUG FROM THE TITLE AND ACCEPTS BEING WRONG. A miss costs
// one 404 and contributes nothing, exactly as a CAPTCHA from Amazon does; a hit
// is precisely right, because a wiki named after the work is a wiki about the
// work. Deliberately fragile-proof rather than robust, which is the same bargain
// PLAN records for the Amazon and Hardcover scrapes: an unreadable answer returns
// silence rather than partial garbage.
//
// IT IS AN API AND NOT A SCRAPE, at least: every Fandom wiki is a MediaWiki, so
// the same action=query&prop=pageimages call the Wikipedia rung makes works here
// unchanged. That is the one piece of this that is not a guess.

import (
	"context"
	"encoding/json"
	"net/url"
	"regexp"
	"strings"
	"unicode"
)

// fandomHostFmt is the wiki address, overridable for tests. %s is the slug.
const defaultFandomHostFmt = "https://%s.fandom.com"

var fandomHostFmt = defaultFandomHostFmt

// fandomSlug turns a work's title into the wiki slug most likely to hold it:
// lowercase, letters and digits only, no spaces. "V for Vendetta" -> vforvendetta.
//
// A LEADING ARTICLE IS DROPPED because Fandom slugs almost never carry one — the
// wiki for "The Expanse" is expanse — and keeping it turns a likely hit into a
// certain miss. Letterboxd's convention is the opposite; see LetterboxdSlug.
func fandomSlug(title string) string {
	t := strings.ToLower(strings.TrimSpace(title))
	for _, a := range []string{"the ", "a ", "an "} {
		t = strings.TrimPrefix(t, a)
	}
	var b strings.Builder
	for _, r := range t {
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			b.WriteRune(r)
		}
	}
	return b.String()
}

// romanTail matches a trailing roman numeral, which is how half of all game
// franchises number themselves.
var romanTail = regexp.MustCompile(`(?i)(i|ii|iii|iv|v|vi|vii|viii|ix|x|xi|xii|xiii)$`)

// FandomWikiCandidates is the truncation ladder: the slugs to try, best first.
//
// THE WIKI IS NAMED FOR THE FRANCHISE, NOT THE INSTALMENT, and that is the whole
// reason this exists. Measured over nine real titles the plain title-derived slug
// found six wikis; all three misses were a numbered or subtitled entry whose wiki
// carries the franchise name — witcher3wildhunt against `witcher`, masseffect3
// against `masseffect`, elderscrollsvskyrim against `elderscrolls`. Games and
// long-running series are overwhelmingly that shape, and they are also the works
// with no other source of character art at all.
//
// So: the full slug, then the part before the subtitle, then that with a trailing
// instalment number or roman numeral removed. Deduped and ordered most specific
// first, because a wiki dedicated to one instalment is a better answer than the
// franchise's when both exist.
// AND THE LADDER COULD NOT REACH A SERIES AT ALL, WHICH IS THE OWNER'S REPORT.
// "I do not ever see shit from fandom about characters. The search is broken. It
// cannot gather character names either. Even for very obvious ones, like
// itkovian."
//
// Itkovian is in Malazan Book of the Fallen, whose wiki is `malazan`. Every
// candidate above is derived from the VOLUME — "Memories of Ice" gives
// `memoriesofice` and nothing else, since there is no subtitle to cut and no
// numeral to drop — so no probe ever went near the wiki that holds him. The
// paragraph above had the diagnosis exactly right ("the wiki is named for the
// franchise, not the instalment") and then only ever fed it the instalment.
//
// A BOOK KNOWS ITS SERIES, so the series is an input now. Its ladder runs after
// the title's, because a wiki dedicated to one volume is a better answer than the
// franchise's when both exist — and then the series is shortened a WORD at a time,
// because that is the shape franchise wikis take: `malazan` out of "Malazan Book
// of the Fallen", `witcher` out of "The Witcher Saga". Trimming has to happen on
// the TITLE and not on the slug: a slug is letters and digits with the spaces
// already gone, so there is nothing left in it to cut on.
//
// CAPPED AT EIGHT, and the cap is the point rather than tidiness. Each candidate
// is one existence probe, and this runs once per work — `FandomResolveWiki`'s
// answer is stored by its caller — so eight is eight requests in the life of a
// work. Uncapped, a long series name would spend a dozen on the vanishingly
// unlikely middles ("malazanbookofthe"), which is latency charged to the reader
// for guesses nobody would make.
func FandomWikiCandidatesFor(title, series string) []string {
	out := FandomWikiCandidates(title)
	seen := map[string]bool{}
	for _, s := range out {
		seen[s] = true
	}
	add := func(v string) {
		if v != "" && !seen[v] && len(out) < maxFandomWikiCandidates {
			seen[v] = true
			out = append(out, v)
		}
	}
	words := strings.Fields(strings.TrimSpace(series))
	// THE WHOLE SERIES NAME, THEN THE SHORTEST FORMS, THEN THE MIDDLES — and the
	// order is load-bearing rather than cosmetic, because the cap decides what
	// never gets probed.
	//
	// WRITTEN LONGEST-FIRST IT WAS WRONG, and its own test said so: a six-word
	// series filled all eight slots with "…ofmanyseparate", "…ofmany", "…of" and
	// dropped the first word entirely — the one candidate the whole change exists
	// to reach. Specificity is the right instinct for TITLES, where a wiki about
	// one volume beats the franchise's; it is exactly backwards inside a series
	// name, where the franchise wiki is named for the FIRST word or two and every
	// middle is a string nobody would ever register.
	//
	// So: the full name (it might be the wiki), then one word, two, three… and the
	// long middles last, where the cap can cut them without costing anything.
	add(fandomSlug(series))
	for n := 1; n < len(words); n++ {
		add(fandomSlug(strings.Join(words[:n], " ")))
	}
	return out
}

// maxFandomWikiCandidates caps the probes one work will ever spend finding its
// wiki. See FandomWikiCandidatesFor.
const maxFandomWikiCandidates = 8

func FandomWikiCandidates(title string) []string {
	title = strings.TrimSpace(title)
	if title == "" {
		return nil
	}
	var out []string
	seen := map[string]bool{}
	add := func(s string) {
		if s != "" && !seen[s] {
			seen[s] = true
			out = append(out, s)
		}
	}
	add(fandomSlug(title))
	// Before the subtitle: "The Witcher 3: Wild Hunt" -> "The Witcher 3".
	base := title
	if i := strings.IndexAny(base, ":—–-"); i > 0 {
		base = strings.TrimSpace(base[:i])
	}
	add(fandomSlug(base))
	// And without the instalment: "The Witcher 3" -> "The Witcher".
	trimmed := strings.TrimRight(fandomSlug(base), "0123456789")
	add(trimmed)
	add(romanTail.ReplaceAllString(trimmed, ""))
	return out
}

// FandomResolveWiki returns the first candidate wiki that answers, or "".
//
// ONE HEAD-SHAPED PROBE PER CANDIDATE, and at most four. The result is meant to
// be STORED by the caller — see migration 0055 — so this runs once per work and
// every later lookup is a single request. A work that resolves to nothing is left
// unresolved rather than remembered as such: a wiki that did not exist last month
// may exist now, and being wrong costs one 404.
func FandomResolveWiki(ctx context.Context, title string) string {
	return FandomResolveWikiFor(ctx, title, "")
}

// FandomResolveWikiFor is the same probe over the series-aware ladder, with the
// cross-wiki search behind it. See FandomWikiCandidatesFor for why a series is the
// input that was missing.
func FandomResolveWikiFor(ctx context.Context, title, series string) string {
	for _, slug := range FandomWikiCandidatesFor(title, series) {
		base := strings.Replace(fandomHostFmt, "%s", slug, 1)
		_, status, err := httpGet(ctx, base+"/api.php?action=query&meta=siteinfo&format=json", "")
		if err == nil && status == 200 {
			return slug
		}
	}
	// AND WHEN EVERY GUESS MISSES, ASK RATHER THAN GIVE UP. Every candidate above
	// is a HOST spelled out of a title, so the whole ladder fails for any wiki whose
	// name is not derivable from the work — `galactica` for Battlestar Galactica is
	// the standing example, and the series ladder does not reach it either, because
	// the series is not called that. Fandom's own index knows; nothing ever asked.
	//
	// LAST, NOT FIRST, and the order is the point. A derived host that answers is
	// CERTAIN: that wiki exists and is named for this work. A search result is a
	// ranking, and the top hit for a common title can easily be another franchise.
	// So the search runs only where the certain answers have all missed, which is
	// also where it costs nothing — those requests have already happened.
	return fandomSearchWiki(ctx, strings.TrimSpace(series), strings.TrimSpace(title))
}

// fandomSearchWiki asks Fandom's cross-wiki index which wiki a work lives on and
// returns the host of the best answer.
//
// THIS RUNG IS UNPROVEN AGAINST THE LIVE ENDPOINT, AND THAT IS SAID HERE RATHER
// THAN LEFT TO BE DISCOVERED. Every outbound request from the container this was
// written in comes back 403, so the parsing and the refusals below are checked
// against recorded shapes and the endpoint itself is not. It is built to fail
// CLOSED for exactly that reason: an error, any status but 200, a body it cannot
// read, and any host that is not a plain `*.fandom.com` all return "" — which is
// precisely what the caller did before this existed. A wrong guess here costs one
// request and can never produce a wrong wiki.
//
// THE SERIES IS ASKED FIRST where there is one, because the index is a list of
// WIKIS and a wiki is named for the franchise rather than the instalment.
func fandomSearchWiki(ctx context.Context, terms ...string) string {
	for _, term := range terms {
		if term == "" {
			continue
		}
		q := url.Values{"query": {term}, "limit": {"1"}}
		body, status, err := httpGet(ctx, fandomSearchBase+"/api/v1/SearchSuggestions/List?"+q.Encode(), "")
		if err != nil || status != 200 {
			continue
		}
		var r struct {
			Items []struct {
				URL string `json:"url"`
			} `json:"items"`
		}
		if json.Unmarshal(body, &r) != nil || len(r.Items) == 0 {
			continue
		}
		if slug := fandomHostSlug(r.Items[0].URL); slug != "" {
			return slug
		}
	}
	return ""
}

// fandomSearchBase is the cross-wiki index, overridable for tests.
var fandomSearchBase = "https://community.fandom.com"

// fandomHostSlug takes the wiki out of a fandom.com address and refuses anything
// else.
//
// WHATEVER THIS RETURNS BECOMES A HOST THE APP THEN TALKS TO and stores on the
// work, so it is a whitelist by SHAPE — one third-level name under fandom.com —
// rather than a blacklist of things that look wrong. `fandom.com.evil.example` is
// why: it contains the string and is not Fandom.
func fandomHostSlug(raw string) string {
	u, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || u.Host == "" {
		return ""
	}
	host := strings.ToLower(u.Host)
	const suffix = ".fandom.com"
	if !strings.HasSuffix(host, suffix) {
		return ""
	}
	slug := strings.TrimSuffix(host, suffix)
	// `community.fandom.com` is the index itself rather than a work's wiki, and a
	// slug with a dot left in it is a deeper subdomain than this app addresses.
	if slug == "" || slug == "community" || strings.Contains(slug, ".") {
		return ""
	}
	return slug
}

// FandomCharacterImages asks the work's own wiki for a character's page image.
// Empty on every failure — no wiki, no page, no image — because each of those is
// the ordinary case rather than a fault.
func FandomCharacterImages(ctx context.Context, character, wiki string) []ImageHit {
	character, slug := strings.TrimSpace(character), strings.TrimSpace(wiki)
	if character == "" || slug == "" {
		return nil
	}
	q := url.Values{
		"action": {"query"}, "prop": {"pageimages"}, "piprop": {"original"},
		"titles": {character}, "format": {"json"}, "formatversion": {"2"}, "redirects": {"1"},
	}
	base := strings.Replace(fandomHostFmt, "%s", slug, 1)
	body, status, err := httpGet(ctx, base+"/api.php?"+q.Encode(), "")
	if err != nil || status != 200 {
		return nil
	}
	var r struct {
		Query struct {
			Pages []struct {
				Missing  bool `json:"missing"`
				Original struct {
					Source string `json:"source"`
				} `json:"original"`
			} `json:"pages"`
		} `json:"query"`
	}
	if json.Unmarshal(body, &r) != nil || len(r.Query.Pages) == 0 {
		return nil
	}
	p := r.Query.Pages[0]
	src := strings.TrimSpace(p.Original.Source)
	if p.Missing || src == "" {
		// THE EXACT TITLE MISSED, AND THAT WAS THE END OF IT — the third reason
		// a character image search "almost never yields any result". This asks
		// the wiki for `titles=<the name as stored>`, which finds an article only
		// when the two agree exactly: a reader's "Agent Smith" against an article
		// called "Smith (The Matrix)", a "Prince Myshkin" against "Lev Nikolayevich
		// Myshkin", and every character billed by a nickname, all missed.
		//
		// Wikipedia's rung has always searched (list=search). Fandom runs the same
		// MediaWiki API and was the one asked to guess the title. So: the exact
		// title first, because when it hits it is the right article by definition,
		// then the search.
		return fandomSearchCharacter(ctx, character, slug)
	}
	return []ImageHit{{URL: src, Source: "fandom"}}
}

// fandomSearchCharacter is the rung under the exact title: ask the wiki to find
// the article, then read its lead image.
//
// NO NAME GATE, unlike the Wikipedia rung, and the difference is the corpus. A
// Fandom wiki is about ONE work: everything on it is a subject of that story, so
// a search for a character cannot come back with a nuclear test or a
// disambiguation page the way an encyclopaedia can. What it can come back with is
// the wrong character, which is why only the top hit is taken here — the ranking
// within a single work's wiki is the whole of the evidence available, and reading
// further down would be offering a second guess as though it were an answer.
func fandomSearchCharacter(ctx context.Context, character, slug string) []ImageHit {
	q := url.Values{
		"action": {"query"}, "list": {"search"}, "srsearch": {character},
		"srlimit": {"1"}, "srnamespace": {"0"}, "format": {"json"}, "formatversion": {"2"},
	}
	base := strings.Replace(fandomHostFmt, "%s", slug, 1)
	body, status, err := httpGet(ctx, base+"/api.php?"+q.Encode(), "")
	if err != nil || status != 200 {
		return nil
	}
	var r struct {
		Query struct {
			Search []struct {
				Title string `json:"title"`
			} `json:"search"`
		} `json:"query"`
	}
	if json.Unmarshal(body, &r) != nil || len(r.Query.Search) == 0 {
		return nil
	}
	title := strings.TrimSpace(r.Query.Search[0].Title)
	if title == "" || strings.EqualFold(title, character) {
		// Equal to what we already asked for by title, and that missed — so there
		// is nothing new to fetch and a second identical request is waste.
		return nil
	}
	return fandomLeadImage(ctx, title, slug)
}

// fandomLeadImage reads one article's lead image, by exact title.
func fandomLeadImage(ctx context.Context, title, slug string) []ImageHit {
	q := url.Values{
		"action": {"query"}, "prop": {"pageimages"}, "piprop": {"original"},
		"titles": {title}, "format": {"json"}, "formatversion": {"2"}, "redirects": {"1"},
	}
	base := strings.Replace(fandomHostFmt, "%s", slug, 1)
	body, status, err := httpGet(ctx, base+"/api.php?"+q.Encode(), "")
	if err != nil || status != 200 {
		return nil
	}
	var r struct {
		Query struct {
			Pages []struct {
				Missing  bool `json:"missing"`
				Original struct {
					Source string `json:"source"`
				} `json:"original"`
			} `json:"pages"`
		} `json:"query"`
	}
	if json.Unmarshal(body, &r) != nil || len(r.Query.Pages) == 0 {
		return nil
	}
	p := r.Query.Pages[0]
	src := strings.TrimSpace(p.Original.Source)
	if p.Missing || src == "" {
		return nil
	}
	return []ImageHit{{URL: src, Source: "fandom"}}
}

// FandomPageFromLinks pulls a Fandom article out of a record's stored links: the
// wiki from the host, the page from the path.
//
// THIS IS THE ONE THING IN THIS FILE THAT IS NOT A GUESS. Everything above
// derives a slug from a title and accepts being wrong — which is the right bargain
// and is also why `galactica` was unreachable for Battlestar Galactica, and
// `wookieepedia` for Star Wars. A reader who pastes
// `https://galactica.fandom.com/wiki/William_Adama` has answered both questions at
// once, and the owner asked for exactly that: "there needs to be a way to tell
// tippani to look for william_adama in this link and then fetch the image from
// there. the wiki name galactica is not very straight forward here."
//
// THE LINKS FIELD IS FREE TEXT, space- or newline-separated, holding whatever the
// reader has added — so this recognises a Fandom address by its HOST rather than
// by position, the same way wikipediaLinkOf does one package over.
//
// A BARE WIKI ADDRESS IS NOT A PAGE. `https://galactica.fandom.com` names the wiki
// and no article, so the wiki is returned with an empty page and the caller falls
// back to searching — which is strictly better than the title-derived slug it
// would otherwise have guessed.
func FandomPageFromLinks(links string) (wiki, page string) {
	for _, tok := range strings.Fields(strings.ReplaceAll(links, "\n", " ")) {
		u, err := url.Parse(tok)
		if err != nil || u.Hostname() == "" {
			continue
		}
		host := strings.ToLower(u.Hostname())
		if !strings.HasSuffix(host, ".fandom.com") {
			continue
		}
		w := strings.TrimSuffix(host, ".fandom.com")
		// `www.` and a language prefix are not the wiki. Fandom serves
		// `starwars.fandom.com` and localised wikis at `starwars.fandom.com/de`,
		// so the language lives in the PATH and the host's first label is the wiki.
		if i := strings.Index(w, "."); i >= 0 {
			w = w[:i]
		}
		if w == "" || w == "www" {
			continue
		}
		// /wiki/<Article>, which is MediaWiki's own shape. Anything else on a
		// fandom host — a category, a search, the front page — names no article.
		//
		// THE SEGMENT IS FOUND, NOT INDEXED, because a localised wiki puts its
		// language FIRST: `starwars.fandom.com/de/wiki/Yoda`. Reading position 0
		// found `de` and reported no article on every non-English page.
		parts := strings.Split(strings.Trim(u.EscapedPath(), "/"), "/")
		for i, seg := range parts {
			if seg != "wiki" || i+1 >= len(parts) {
				continue
			}
			a, err := url.PathUnescape(parts[i+1])
			if err != nil || strings.TrimSpace(a) == "" {
				break
			}
			// MediaWiki titles use underscores in a URL and spaces in the API.
			return w, strings.ReplaceAll(a, "_", " ")
		}
		wiki, page = w, ""
	}
	return wiki, page
}

// FandomLeadImageAt reads one named article's lead image on one named wiki — the
// exact page a reader pointed at, with no searching and no ranking.
func FandomLeadImageAt(ctx context.Context, title, wiki string) []ImageHit {
	title, wiki = strings.TrimSpace(title), strings.TrimSpace(wiki)
	if title == "" || wiki == "" {
		return nil
	}
	return fandomLeadImage(ctx, title, wiki)
}
