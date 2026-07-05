package importer

import (
	"errors"
	"fmt"
	"io"
	"regexp"
	"strings"
)

// A saved Kindle "Notes & Highlights" page (read.amazon.com/notebook) is the
// same source Bookcision scrapes, so we parse the saved HTML directly (regex,
// like goodreads.go / imdb.go). The page is one book at a time: the selected
// book's title/author sit in the kp-notebook-metadata header, and each highlight
// is a row carrying a colour class (kp-notebook-highlight-<colour>, matching our
// four), an "…Location: N / Page: N" header, the highlight text (span#highlight),
// and an optional note (span#note). Note-only entries (no span#highlight) are
// skipped in this pass.
var (
	anTitle     = regexp.MustCompile(`(?s)id="annotationBookTitle"[^>]*>(.*?)</`)
	anTitleH3   = regexp.MustCompile(`(?s)<h3[^>]*kp-notebook-metadata[^>]*>(.*?)</h3>`)
	anAuthor    = regexp.MustCompile(`(?s)<p[^>]*kp-notebook-metadata[^>]*>(.*?)</p>`)
	anAsinA     = regexp.MustCompile(`id="kp-notebook-annotations-asin"[^>]*value="([^"]+)"`)
	anAsinB     = regexp.MustCompile(`value="([^"]+)"[^>]*id="kp-notebook-annotations-asin"`)
	anHeader    = regexp.MustCompile(`(?s)id="annotationHighlightHeader"[^>]*>(.*?)</span>`)
	anColor     = regexp.MustCompile(`kp-notebook-highlight-(yellow|blue|pink|orange)`)
	anHighlight = regexp.MustCompile(`(?s)id="highlight"[^>]*>(.*?)</span>`)
	anNote      = regexp.MustCompile(`(?s)id="note"[^>]*>(.*?)</span>`)
	anLocation  = regexp.MustCompile(`(?i)(?:Location|Page):\s*([\d,]+)`)
	anByPrefix  = regexp.MustCompile(`(?i)^by:?\s+`)
)

// AmazonNotebook parses a saved read.amazon.com/notebook page into one book's
// annotations (PLAN §5). Colour comes from the row's highlight-colour class,
// location/page from the row header.
func AmazonNotebook(r io.Reader) (*Result, error) {
	data, err := io.ReadAll(r) // caller caps the upload size (PLAN §5)
	if err != nil {
		return nil, fmt.Errorf("kindle notebook: %w", err)
	}
	doc := string(data)

	res := &Result{}
	if m := anTitle.FindStringSubmatch(doc); m != nil {
		res.Book.Title = cleanHTMLText(m[1])
	}
	if res.Book.Title == "" {
		if m := anTitleH3.FindStringSubmatch(doc); m != nil {
			res.Book.Title = cleanHTMLText(m[1])
		}
	}
	if res.Book.Title == "" {
		return nil, errors.New("kindle notebook: no book title found (not a saved read.amazon.com/notebook page?)")
	}
	if m := anAuthor.FindStringSubmatch(doc); m != nil {
		res.Book.Author = anByPrefix.ReplaceAllString(cleanHTMLText(m[1]), "")
	}
	if m := anAsinA.FindStringSubmatch(doc); m != nil {
		res.Book.ASIN = strings.TrimSpace(m[1])
	} else if m := anAsinB.FindStringSubmatch(doc); m != nil {
		res.Book.ASIN = strings.TrimSpace(m[1])
	}

	hl := anHighlight.FindAllStringSubmatchIndex(doc, -1)
	for i, m := range hl {
		text := cleanHTMLText(doc[m[2]:m[3]])
		if text == "" {
			continue
		}
		// Scope colour + header to this row: between the previous highlight and
		// this one (nearest-preceding wins); the note is the first one after this
		// highlight, before the next.
		blockStart := 0
		if i > 0 {
			blockStart = hl[i-1][1]
		}
		blockEnd := len(doc)
		if i+1 < len(hl) {
			blockEnd = hl[i+1][0]
		}
		color := "yellow"
		if cm := anColor.FindAllStringSubmatch(doc[blockStart:m[0]], -1); len(cm) > 0 {
			color = cm[len(cm)-1][1]
		}
		location := ""
		if hm := anHeader.FindAllStringSubmatch(doc[blockStart:m[0]], -1); len(hm) > 0 {
			if lm := anLocation.FindStringSubmatch(cleanHTMLText(hm[len(hm)-1][1])); lm != nil {
				location = strings.ReplaceAll(lm[1], ",", "")
			}
		}
		note := ""
		if nm := anNote.FindStringSubmatch(doc[m[1]:blockEnd]); nm != nil {
			note = cleanHTMLText(nm[1])
		}
		res.Annotations = append(res.Annotations, Annotation{
			Quote: text, Note: note, Color: color, Location: location,
		})
	}
	if len(res.Annotations) == 0 {
		return nil, errors.New("kindle notebook: no highlights parsed")
	}
	return res, nil
}
