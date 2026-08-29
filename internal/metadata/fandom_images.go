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
// certain miss.
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

// FandomCharacterImages asks the work's own wiki for a character's page image.
// Empty on every failure — no wiki, no page, no image — because each of those is
// the ordinary case rather than a fault.
func FandomCharacterImages(ctx context.Context, character, workTitle string) []ImageHit {
	character, workTitle = strings.TrimSpace(character), strings.TrimSpace(workTitle)
	slug := fandomSlug(workTitle)
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
		return nil
	}
	return []ImageHit{{URL: src, Source: "fandom"}}
}
