package importer

import (
	"errors"
	"fmt"
	"html"
	"io"
	"regexp"
	"strings"
)

// A saved Goodreads quotes page (goodreads.com/work/quotes/…) is plain markup,
// so scan it with regexes — no HTML-parser dependency, matching the rest of the
// importer. Each quote is a .quoteText block (curly-quoted text, then an author
// span and a book-title link) followed by a .quoteFooter carrying tag links.
var (
	grQuoteText = regexp.MustCompile(`(?s)class="quoteText">(.*?)</div>`)
	grLdquo     = regexp.MustCompile(`(?s)&ldquo;(.*?)&rdquo;`)
	grAuthor    = regexp.MustCompile(`(?s)<span class="authorOrTitle">\s*(.*?)\s*</span>`)
	grTitle     = regexp.MustCompile(`(?s)<a class="authorOrTitle"[^>]*>(.*?)</a>`)
	grTag       = regexp.MustCompile(`/quotes/tag/[^"]*">([^<]+)</a>`)
	grAnyTag    = regexp.MustCompile(`<[^>]+>`)
	grBr        = regexp.MustCompile(`(?i)<br\s*/?>`)
)

// Goodreads parses a saved Goodreads quotes page into one book's annotations.
// A book's quotes page is single-book (all attributions match); the first
// quote's title/author name the book. Goodreads quote tags become annotation
// tags. Quote text is the only field Goodreads exposes — no chapter/location.
func Goodreads(r io.Reader) (*Result, error) {
	data, err := io.ReadAll(r) // the caller caps the upload size (PLAN §5)
	if err != nil {
		return nil, fmt.Errorf("goodreads: %w", err)
	}
	doc := string(data)
	locs := grQuoteText.FindAllStringSubmatchIndex(doc, -1)
	if len(locs) == 0 {
		return nil, errors.New("goodreads: no quotes found (not a saved Goodreads quotes page?)")
	}

	res := &Result{}
	for i, loc := range locs {
		inner := doc[loc[2]:loc[3]] // capture group 1 = the .quoteText contents

		var quote string
		if m := grLdquo.FindStringSubmatch(inner); m != nil {
			quote = cleanHTMLText(m[1])
		} else {
			// No curly quotes — take everything before the attribution dash.
			quote = cleanHTMLText(strings.SplitN(inner, "&#8213;", 2)[0])
		}
		if quote == "" {
			continue
		}

		var author, title string
		if m := grAuthor.FindStringSubmatch(inner); m != nil {
			author = strings.TrimRight(cleanHTMLText(m[1]), ", ")
		}
		if m := grTitle.FindStringSubmatch(inner); m != nil {
			title = cleanHTMLText(m[1])
		}

		// Tags live in the .quoteFooter after this quote — scan the slice up to
		// the next quote so each quote gets only its own tags.
		regionEnd := len(doc)
		if i+1 < len(locs) {
			regionEnd = locs[i+1][0]
		}
		var tags []string
		for _, tm := range grTag.FindAllStringSubmatch(doc[loc[1]:regionEnd], -1) {
			if t := cleanHTMLText(tm[1]); t != "" {
				tags = append(tags, t)
			}
		}

		res.Annotations = append(res.Annotations, Annotation{Quote: quote, Tags: tags})
		if res.Book.Title == "" {
			res.Book.Title = title
		}
		if res.Book.Author == "" {
			res.Book.Author = author
		}
	}

	if strings.TrimSpace(res.Book.Title) == "" {
		return nil, errors.New("goodreads: no book title found")
	}
	if len(res.Annotations) == 0 {
		return nil, errors.New("goodreads: no quotes parsed")
	}
	return res, nil
}

// cleanHTMLText strips tags (turning <br> into newlines), unescapes entities,
// and collapses runs of blank space while preserving intentional line breaks.
func cleanHTMLText(s string) string {
	s = grBr.ReplaceAllString(s, "\n")
	s = grAnyTag.ReplaceAllString(s, "")
	s = html.UnescapeString(s)
	// Collapse spaces/tabs per line, then trim; keep newlines.
	lines := strings.Split(s, "\n")
	for i, ln := range lines {
		lines[i] = strings.Join(strings.Fields(ln), " ")
	}
	out := strings.Join(lines, "\n")
	return strings.Trim(out, " \n")
}
