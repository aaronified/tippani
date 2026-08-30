package metadata

// Fandom as a RECORD source, not only a picture one.
//
// fandom_images.go already asks a work's own wiki for a character's picture. The
// same wiki has an article about the WORK, and that article's opening paragraph
// is a description written by people who care about the thing — which is a
// different and often better answer than a distributor's one-line synopsis,
// especially for the long tail: a series nobody filed properly, a game, an
// animated show with thirty years of continuity.
//
// WHAT IT CAN AND CANNOT SAY. An extract and a page image, and that is all. No
// director, no year, no genres, no cast — a wiki article is prose, and inventing
// structure out of it by parsing an infobox would be reading markup that changes
// per wiki, which is exactly the discipline the rest of this package refuses.
// Offering two fields honestly is worth more than offering six unreliably, and
// the per-field picker is built for precisely that: a supplier contributes where
// it is good and is absent everywhere else.
//
// THE WIKI IS THE SAME GUESS, from the same function, and wrong the same way —
// see fandom_images.go for why the slug cannot be resolved properly and what a
// miss costs.

import (
	"context"
	"encoding/json"
	"net/url"
	"strconv"
	"strings"
)

// FandomWorkDetails asks a work's own wiki for its article summary and image.
// Silent on every miss: no wiki, no article, nothing to say.
func FandomWorkDetails(ctx context.Context, title, wiki string) (*MovieDetails, error) {
	title, slug := strings.TrimSpace(title), strings.TrimSpace(wiki)
	if title == "" || slug == "" {
		return nil, nil
	}
	q := url.Values{
		"action": {"query"}, "prop": {"extracts|pageimages"},
		// EXPLAINTEXT AND EXINTRO: the lead section as plain text. Without the
		// first it returns HTML, and without the second it returns the entire
		// article — which for a well-loved work is tens of kilobytes of plot
		// summary nobody asked for.
		"explaintext": {"1"}, "exintro": {"1"},
		"piprop": {"original"},
		"titles": {title}, "format": {"json"}, "formatversion": {"2"}, "redirects": {"1"},
	}
	base := strings.Replace(fandomHostFmt, "%s", slug, 1)
	body, status, err := httpGet(ctx, base+"/api.php?"+q.Encode(), "")
	if err != nil || status != 200 {
		return nil, nil
	}
	var r struct {
		Query struct {
			Pages []struct {
				Title    string `json:"title"`
				Missing  bool   `json:"missing"`
				Extract  string `json:"extract"`
				Original struct {
					Source string `json:"source"`
				} `json:"original"`
			} `json:"pages"`
		} `json:"query"`
	}
	if json.Unmarshal(body, &r) != nil || len(r.Query.Pages) == 0 {
		return nil, nil
	}
	p := r.Query.Pages[0]
	overview := strings.TrimSpace(p.Extract)
	poster := strings.TrimSpace(p.Original.Source)
	// A PAGE THAT EXISTS AND SAYS NOTHING IS STILL NOTHING. MediaWiki answers 200
	// with `missing:true` for an absent article, and an existing stub can have an
	// empty extract and no image — neither is a record.
	if p.Missing || (overview == "" && poster == "") {
		return nil, nil
	}
	d := &MovieDetails{
		Source:    "fandom",
		SourceID:  slug,
		Title:     strings.TrimSpace(p.Title),
		Overview:  overview,
		PosterURL: poster,
	}
	d.PosterThumbURL = poster
	if d.Title == "" {
		d.Title = title
	}
	// THE CHARACTERS, WHICH FOR A GAME IS OFTEN THE ONLY LIST THAT EXISTS. TheTVDB
	// has no games at all and Wikipedia writes about a character only when the
	// character is notable outside their own story, so a game's cast has had no
	// structured source anywhere. A wiki has one, and it is a CATEGORY rather than
	// an infobox — a MediaWiki primitive that works identically on every wiki,
	// where infobox markup is per-wiki and would be the kind of scraping the rest
	// of this package refuses.
	d.Cast = fandomCharacters(ctx, slug)
	return d, nil
}

// fandomCharacterCategories are the category names wikis actually use, best
// first. More than one because there is no convention: a category is a MediaWiki
// primitive but its NAME is a wiki's own choice.
var fandomCharacterCategories = []string{"Characters", "Character", "Playable characters"}

// fandomCharacters lists a wiki's characters, each with the picture from their
// own page.
//
// TWO REQUESTS, NOT ONE PER CHARACTER. `categorymembers` names them and a single
// `pageimages` call takes up to fifty titles at once, so a full cast costs two
// round trips rather than twenty. That bound is why this can run inside an
// ordinary details fetch at all.
//
// NO ACTOR NAMES, and that is the honest shape. A wiki's character page is about
// the CHARACTER; who voices them lives in an infobox whose markup differs per
// wiki. So these are cast rows with a character and no actor, which the merge
// tolerates — and which is the right way round for a game, where the character is
// the thing anybody quotes and the voice actor is the footnote.
func fandomCharacters(ctx context.Context, slug string) []CastMember {
	base := strings.Replace(fandomHostFmt, "%s", slug, 1)
	var names []string
	for _, cat := range fandomCharacterCategories {
		q := url.Values{
			"action": {"query"}, "list": {"categorymembers"},
			"cmtitle": {"Category:" + cat}, "cmlimit": {strconv.Itoa(maxCast)},
			"cmtype": {"page"}, "format": {"json"}, "formatversion": {"2"},
		}
		body, status, err := httpGet(ctx, base+"/api.php?"+q.Encode(), "")
		if err != nil || status != 200 {
			continue
		}
		var r struct {
			Query struct {
				CategoryMembers []struct {
					Title string `json:"title"`
				} `json:"categorymembers"`
			} `json:"query"`
		}
		if json.Unmarshal(body, &r) != nil {
			continue
		}
		for _, m := range r.Query.CategoryMembers {
			if n := strings.TrimSpace(m.Title); n != "" {
				names = append(names, n)
			}
		}
		if len(names) > 0 {
			break // the first category that has anybody in it is this wiki's
		}
	}
	if len(names) == 0 {
		return nil
	}
	images := fandomPageImages(ctx, base, names)
	out := make([]CastMember, 0, len(names))
	for _, n := range names {
		out = append(out, CastMember{Character: n, CharacterImageURL: images[n]})
	}
	return out
}

// fandomPageImages fetches the page image for many titles in ONE call —
// MediaWiki takes up to fifty pipe-separated titles, and maxCast is twenty.
func fandomPageImages(ctx context.Context, base string, titles []string) map[string]string {
	q := url.Values{
		"action": {"query"}, "prop": {"pageimages"}, "piprop": {"original"},
		"pilimit": {"max"},
		"titles":  {strings.Join(titles, "|")},
		"format":  {"json"}, "formatversion": {"2"}, "redirects": {"1"},
	}
	body, status, err := httpGet(ctx, base+"/api.php?"+q.Encode(), "")
	if err != nil || status != 200 {
		return nil
	}
	var r struct {
		Query struct {
			Pages []struct {
				Title    string `json:"title"`
				Original struct {
					Source string `json:"source"`
				} `json:"original"`
			} `json:"pages"`
		} `json:"query"`
	}
	if json.Unmarshal(body, &r) != nil {
		return nil
	}
	out := map[string]string{}
	for _, p := range r.Query.Pages {
		if src := strings.TrimSpace(p.Original.Source); src != "" {
			out[strings.TrimSpace(p.Title)] = src
		}
	}
	return out
}
