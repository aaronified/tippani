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
	for _, slug := range FandomWikiCandidates(title) {
		base := strings.Replace(fandomHostFmt, "%s", slug, 1)
		_, status, err := httpGet(ctx, base+"/api.php?action=query&meta=siteinfo&format=json", "")
		if err == nil && status == 200 {
			return slug
		}
	}
	return ""
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
