package metadata

// Wikimedia as a PICTURE source for a face and for a role.
//
// WHY IT IS A RUNG AND NOT A CATALOGUE. Wikipedia is already in this package
// twice — an author's lead image, a game character's Commons file — but only ever
// reached from an identity somebody else handed us: an article URL Open Library
// listed, a Q-id IGDB's Wikidata mapping produced. Neither exists for the two
// cases the picture ladder has to serve, which arrive as a NAME and nothing more.
//
// SO THE PROBLEM HERE IS DISAMBIGUATION, NOT FETCHING. Both fetches already work
// (WikipediaImageURL, WikidataImageURL). What is new is getting from "Hugo
// Weaving" or "V" to the right entity, and the package's own comments warn twice
// that a bare-name Wikidata search lands on namesakes and wrong works.
//
// THE SEARCH IS WIKIPEDIA'S AND NOT WIKIDATA'S, deliberately. `wbsearchentities`
// matches labels, so "V" ranks every entity labelled V — a letter, a vitamin, a
// Roman numeral, a Pynchon novel — and the character is nowhere near the top.
// Wikipedia's own search ranks ARTICLES by relevance and takes free text, so the
// work's title can be handed to it as context: "V V for Vendetta" finds the
// character's article, because that is what the words mean together. Wikipedia
// has already done the disambiguation that Wikidata would make us do by hand,
// and it did it with editors rather than with a class hierarchy we would have to
// enumerate from memory.
//
// AND THEN IT IS CHECKED, because a search engine always answers. Two rejections
// matter, and both are the same mistake in different clothes: returning the
// WORK's article for a character (which yields the poster) and returning some
// other subject that merely mentions the name. So the article title has to match
// the name word-wise, and must not be the work.

import (
	"context"
	"encoding/json"
	"net/url"
	"strings"
)

// wikipediaBase is the article/API host, overridable for tests. Empty means the
// real English Wikipedia; WikipediaImageURL derives its own host from the article
// URL it is given, so pointing this at a stub redirects both halves at once.
const defaultWikipediaBase = "https://en.wikipedia.org"

var wikipediaBase = defaultWikipediaBase

// wikipediaHost reports whether a host is one this package will fetch an article
// image from.
//
// THE TEST SEAM IS THE ONLY REASON THIS IS NOT A SUFFIX CHECK INLINE. Production
// accepts wikipedia.org and nothing else — a lead-image fetch follows a URL that
// arrived from somebody else's data, so the host it may reach is a guard and not
// a detail. A test needs a stub to be reachable too, and the honest way to have
// both is for the override to widen the guard by exactly the host it set, rather
// than for the guard to be dropped when a variable is non-empty.
func wikipediaHost(host string) bool {
	if strings.HasSuffix(host, "wikipedia.org") {
		return true
	}
	if wikipediaBase == defaultWikipediaBase {
		return false // production: wikipedia.org or nothing
	}
	u, err := url.Parse(wikipediaBase)
	return err == nil && u.Host != "" && u.Host == host
}

// wikipediaSearchTitles returns the English Wikipedia article titles that match a
// free-text query, best first, or nil.
//
// IT USED TO RETURN ONLY THE TOP HIT, and that was the bug behind "the character
// image search almost never yields any result". The reasoning was that the
// ranking is the value being bought and reading further down would be
// second-guessing it — which is right when the caller wants whatever Wikipedia
// thinks is best, and wrong when the caller has a rule the top hit can fail.
//
// A character search has exactly that rule. "Woland The Master and Margarita"
// ranks the NOVEL first, because the novel's article matches more of the query
// than the character's does — and WikimediaCharacterImages then refuses it, by
// design, because a work's lead image is its cover. The character's own article
// was the second or third result: this function asked for three, was handed
// three, and threw two away before the caller could look at them.
//
// srlimit is still 3. The fix is not more results, it is letting the caller see
// the ones already paid for.
func wikipediaSearchTitles(ctx context.Context, query string) []string {
	query = strings.TrimSpace(query)
	if query == "" {
		return nil
	}
	q := url.Values{
		"action": {"query"}, "list": {"search"}, "srsearch": {query},
		"srlimit": {"3"}, "format": {"json"}, "formatversion": {"2"},
	}
	body, status, err := httpGet(ctx, wikipediaBase+"/w/api.php?"+q.Encode(), "")
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
	out := make([]string, 0, len(r.Query.Search))
	for _, hit := range r.Query.Search {
		if t := strings.TrimSpace(hit.Title); t != "" {
			out = append(out, t)
		}
	}
	return out
}

// articleURL builds the article address WikipediaImageURL expects from a title.
func articleURL(title string) string {
	if strings.TrimSpace(title) == "" {
		return ""
	}
	return wikipediaBase + "/wiki/" + url.PathEscape(strings.ReplaceAll(title, " ", "_"))
}

// WikimediaPortraitImages returns the lead photograph Wikimedia holds for a
// person, in the order the identity is most trustworthy: an article URL the
// reader's own record already carries, then a Q-id, and only then a search by
// name.
//
// THE STORED LINK IS WHY THIS TIER IS WORTH HAVING FOR AUTHORS AT ALL. A person
// resolved through Open Library already carries `links["wikipedia"]`, so the
// exact article is known and no search happens — the namesake problem simply does
// not arise for them. The search is the floor, not the method.
func WikimediaPortraitImages(ctx context.Context, name, wikiURL, qid string) []ImageHit {
	var out []ImageHit
	seen := map[string]bool{}
	add := func(u string) {
		u = strings.TrimSpace(u)
		if u == "" || seen[u] {
			return
		}
		seen[u] = true
		// Both upload.wikimedia.org and commons.wikimedia.org are already allowed
		// <img> hosts, so the strip draws the real picture and Thumb stays empty.
		out = append(out, ImageHit{URL: u, Source: "wikimedia"})
	}
	if u := strings.TrimSpace(wikiURL); u != "" {
		add(WikipediaImageURL(ctx, u))
	}
	if q := strings.TrimSpace(qid); q != "" {
		add(WikidataImageURL(ctx, q))
	}
	if len(out) == 0 && strings.TrimSpace(name) != "" {
		// A PERSON'S NAME IS ITS OWN SEARCH and needs no extra context: unlike a
		// role, an actor's article is titled with their name, so a title that does
		// not contain the name is a different subject and is refused.
		// The candidates, not just the first: a name whose top hit is a
		// disambiguation page or a namesake used to end the search, when the
		// person asked for was the result underneath.
		for _, title := range wikipediaSearchTitles(ctx, name) {
			_, qual := splitTitleQualifier(title)
			if !nameMatchesTitle(name, title) || !portraitQualifierFits(qual) {
				continue
			}
			if img := WikipediaImageURL(ctx, articleURL(title)); img != "" {
				add(img)
				break
			}
		}
	}
	return out
}

// WikimediaCharacterImages returns the lead picture of a ROLE's own article.
//
// THE WORK IS THE CONTEXT AND ALSO THE THING TO REFUSE. "V for Vendetta" makes
// the search find V; it also makes the search perfectly capable of returning the
// FILM, whose lead image is the poster — a confident wrong answer of exactly the
// kind this ladder exists to stop offering. So an article titled as the work is
// rejected outright, and what remains has to name the character.
func WikimediaCharacterImages(ctx context.Context, character, workTitle string) []ImageHit {
	character = strings.TrimSpace(character)
	if character == "" {
		return nil
	}
	// TWO QUERIES, AND THE SECOND IS WHY THIS FINDS ANYTHING AT ALL.
	//
	// The work is the context that makes the search find the right Woland, so it
	// goes first. It is also what makes the search rank the NOVEL above the
	// character — the novel's article matches more of the query — which the gates
	// below then refuse, correctly, because a work's lead image is its cover. With
	// one query and one candidate that refusal WAS the answer: no image, ever, for
	// any character whose work has an article of its own. Which is all of them.
	//
	// So: the qualified query for its ranking, then the bare name for the case
	// where every one of the qualified query's results was about the work. Both
	// walk their candidates, and the first that survives the gates and has a
	// picture wins.
	queries := []string{character}
	if w := strings.TrimSpace(workTitle); w != "" {
		queries = []string{character + " " + w, character}
	}
	tried := map[string]bool{}
	for _, query := range queries {
		for _, title := range wikipediaSearchTitles(ctx, query) {
			if tried[title] {
				continue
			}
			tried[title] = true
			_, qual := splitTitleQualifier(title)
			if isTheWorkItself(title, workTitle) ||
				!nameMatchesTitle(character, title) || !characterQualifierFits(qual, workTitle) {
				continue
			}
			if img := WikipediaImageURL(ctx, articleURL(title)); img != "" {
				return []ImageHit{{URL: img, Source: "wikimedia"}}
			}
		}
	}
	return nil
}

// splitTitleQualifier cuts a Wikipedia title into its subject and its
// parenthesised disambiguator: "V (V for Vendetta)" -> "V", "V for Vendetta".
// The qualifier is the part that is NOT the subject's name, and it is the only
// evidence in the title about which subject this is.
func splitTitleQualifier(title string) (main, qual string) {
	title = strings.TrimSpace(title)
	i := strings.LastIndex(title, "(")
	if i <= 0 || !strings.HasSuffix(title, ")") {
		return title, ""
	}
	return strings.TrimSpace(title[:i]), strings.TrimSpace(title[i+1 : len(title)-1])
}

// nameMatchesTitle reports whether an article's subject is plausibly the thing
// asked for: EVERY word of the name has to appear as a word in the title.
//
// THE DIRECTION MATTERS AND THE SYMMETRIC VERSION WAS WRONG. Allowing the
// shorter name to be a subset of the longer one — which is right for matching a
// typed role against a cast list, where "Smith" means "Agent Smith" — answers
// "Anna Kavan" with the article "Kavan (disambiguation)", because "Kavan" is a
// subset of her name. A search result is not a cast list: it is a guess, and the
// burden is on the guess to account for every word it was given.
func nameMatchesTitle(name, title string) bool {
	main, _ := splitTitleQualifier(title)
	nameWords, titleWords := splitRoleWords(name), splitRoleWords(main)
	if len(nameWords) == 0 || len(titleWords) == 0 {
		return false
	}
	have := make(map[string]bool, len(titleWords))
	for _, w := range titleWords {
		have[w] = true
	}
	for _, w := range nameWords {
		if !have[w] {
			return false
		}
	}
	return true
}

// characterQualifierFits judges the parenthesised half of a title for a ROLE.
//
// A BARE NAME IS AMBIGUOUS AND WIKIPEDIA SAYS SO IN THE TITLE. "Trinity" names
// the character in The Matrix, a nuclear test, a doctrine and a college, and
// Wikipedia distinguishes them exactly where this looks: "Trinity (nuclear
// test)". The subject half matches the name in every one of those cases, so
// without reading the qualifier the rung offers a photograph of an atomic bomb
// as a picture of a character — a real result from a real search, which is what
// makes it worth a function.
//
// So a qualifier has to earn the match: it names the work, or it says outright
// that the subject is a character. No qualifier at all is fine — an unambiguous
// role like "Evey Hammond" needs none.
func characterQualifierFits(qual, workTitle string) bool {
	if qual == "" {
		return true
	}
	q := foldRole(qual)
	if strings.Contains(q, "character") || strings.Contains(q, "fictional") {
		return true
	}
	have := make(map[string]bool)
	for _, w := range splitRoleWords(q) {
		have[w] = true
	}
	for _, w := range splitRoleWords(workTitle) {
		// Short words carry no evidence — "the", "of", "a" appear in half of all
		// titles and would make any qualifier fit any work.
		if len(w) > 3 && have[w] {
			return true
		}
	}
	return false
}

// portraitQualifierFits is the same judgement for a PERSON, and it is looser on
// purpose: "John Smith (actor)", "(author)", "(politician)" are all ordinary
// article titles for a real person and none of them names a work. The one that
// is never a person is a disambiguation PAGE, which has no portrait on it and
// whose lead image, if any, belongs to somebody else entirely.
func portraitQualifierFits(qual string) bool {
	return !strings.Contains(foldRole(qual), "disambiguation")
}

// isTheWorkItself catches the search returning the film rather than the role in
// it, which is the one wrong answer that looks most like a right one.
func isTheWorkItself(title, workTitle string) bool {
	w := strings.TrimSpace(workTitle)
	if w == "" {
		return false
	}
	main, _ := splitTitleQualifier(title)
	return foldRole(main) == foldRole(w)
}
