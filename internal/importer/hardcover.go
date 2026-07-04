package importer

import (
	"encoding/json"
	"errors"
	"fmt"
	"html"
	"io"
	"strings"
)

// maxPageNumber bounds a parsed page position — larger values are treated as
// junk (no book has 10M pages) and drop the location rather than overflow int.
const maxPageNumber = 10_000_000

// The structs mirror just the slice of Hardcover's Inertia payload we need
// (PLAN 5e) — typed but tolerant: missing fields stay zero, variable-shaped
// ones (entry, tags) are kept raw and parsed defensively per entry.

type hardcoverContribution struct {
	Author struct {
		Name string `json:"name"`
	} `json:"author"`
	Contribution string `json:"contribution"` // null/"" = author; "Narrator" etc. filtered out
}

type hardcoverJournal struct {
	Event    string            `json:"event"`
	Entry    json.RawMessage   `json:"entry"` // string on quotes, null on other events
	Tags     []json.RawMessage `json:"tags"`
	Metadata struct {
		Position struct {
			Type  string  `json:"type"`
			Value float64 `json:"value"`
		} `json:"position"`
	} `json:"metadata"`
	Edition struct {
		ISBN13 string `json:"isbn13"`
		ISBN10 string `json:"isbn10"`
		ASIN   string `json:"asin"`
	} `json:"edition"`
}

type hardcoverPage struct {
	Props struct {
		Book struct {
			Title         string                  `json:"title"`
			Contributions []hardcoverContribution `json:"contributions"`
		} `json:"book"`
		Journals []hardcoverJournal `json:"journals"`
	} `json:"props"`
}

// HardcoverHTML parses a saved Hardcover reading-journal page (PLAN 5e):
// everything lives HTML-escaped as JSON in the data-page attribute of the
// Inertia root div, so scan between markers — no HTML parser needed.
// Quotes are journals[] entries with event "quote"; other events (progress,
// ratings, status changes) are ignored.
func HardcoverHTML(r io.Reader) (*Result, error) {
	data, err := io.ReadAll(r) // the caller caps the upload size (PLAN §5)
	if err != nil {
		return nil, fmt.Errorf("hardcover: %w", err)
	}
	_, rest, found := strings.Cut(string(data), `data-page="`)
	if !found {
		return nil, errors.New("hardcover: no data-page attribute (not a saved journal page?)")
	}
	payload, _, found := strings.Cut(rest, `"`)
	if !found {
		return nil, errors.New("hardcover: unterminated data-page attribute")
	}
	var page hardcoverPage
	if err := json.Unmarshal([]byte(html.UnescapeString(payload)), &page); err != nil {
		return nil, fmt.Errorf("hardcover: decode: %w", err)
	}
	if strings.TrimSpace(page.Props.Book.Title) == "" {
		return nil, errors.New("hardcover: missing book title")
	}
	res := &Result{Book: Book{
		Title:  strings.TrimSpace(page.Props.Book.Title),
		Author: hardcoverAuthor(page.Props.Book.Contributions),
	}}
	var isbn13, isbn10 string
	for _, j := range page.Props.Journals {
		if j.Event != "quote" {
			continue
		}
		var quote string
		if json.Unmarshal(j.Entry, &quote) != nil {
			continue // entry is not a string
		}
		if quote = strings.TrimSpace(quote); quote == "" {
			continue
		}
		a := Annotation{Quote: quote, Tags: hardcoverTags(j.Tags)}
		// Guard the JSON float before int conversion: an absurd/overflowing value
		// (e.g. 1e19) would wrap to a negative page number. Cap at a sane maximum.
		if p := j.Metadata.Position; p.Type == "pages" && p.Value >= 1 && p.Value <= maxPageNumber {
			a.Location = fmt.Sprintf("p.%d", int64(p.Value))
		}
		res.Annotations = append(res.Annotations, a)
		// Book-level isbn13/asin are often empty — the first quote entry's
		// edition wins (PLAN 5e).
		if isbn13 == "" {
			isbn13 = strings.TrimSpace(j.Edition.ISBN13)
		}
		if isbn10 == "" {
			isbn10 = strings.TrimSpace(j.Edition.ISBN10)
		}
		if res.Book.ASIN == "" {
			res.Book.ASIN = strings.TrimSpace(j.Edition.ASIN)
		}
	}
	if res.Book.ISBN = isbn13; res.Book.ISBN == "" {
		res.Book.ISBN = isbn10
	}
	return res, nil
}

// hardcoverAuthor joins the contribution-less names (that filters narrators,
// translators, …), falling back to the first name when the filter empties.
func hardcoverAuthor(cs []hardcoverContribution) string {
	var names []string
	for _, c := range cs {
		if c.Contribution == "" {
			if n := strings.TrimSpace(c.Author.Name); n != "" {
				names = append(names, n)
			}
		}
	}
	if len(names) == 0 && len(cs) > 0 {
		return strings.TrimSpace(cs[0].Author.Name)
	}
	return strings.Join(names, ", ")
}

// hardcoverTags maps an entry's tags defensively: plain strings, or objects
// carrying a "tag" or "name" string field; anything else ignored (PLAN 5e).
func hardcoverTags(raw []json.RawMessage) []string {
	var out []string
	for _, t := range raw {
		var s string
		if json.Unmarshal(t, &s) != nil {
			var obj struct {
				Tag  string `json:"tag"`
				Name string `json:"name"`
			}
			if json.Unmarshal(t, &obj) != nil {
				continue
			}
			if s = obj.Tag; s == "" {
				s = obj.Name
			}
		}
		if s = strings.TrimSpace(s); s != "" {
			out = append(out, s)
		}
	}
	return out
}
