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
	"strings"
)

// FandomWorkDetails asks a work's own wiki for its article summary and image.
// Silent on every miss: no wiki, no article, nothing to say.
func FandomWorkDetails(ctx context.Context, title string) (*MovieDetails, error) {
	title = strings.TrimSpace(title)
	slug := fandomSlug(title)
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
	return d, nil
}
