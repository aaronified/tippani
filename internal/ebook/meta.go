package ebook

import (
	"archive/zip"
	"bytes"
	"encoding/xml"
	"fmt"
	"html"
	"io"
	"regexp"
	"strconv"
	"strings"
)

// Meta is what an EPUB says about itself, read from its package document alone: the
// zip's central directory, container.xml and the OPF. Measured on a real 1.4 MB novel
// that is about ten kilobytes and five milliseconds, so a shelf of a thousand books
// is a few seconds, and nothing else in the file is opened.
//
// IT SERVES TWO JOBS. A scan identifies a book by what is IN it (an ISBN or ASIN the
// library also holds is an exact match with no fuzz; a title and author are a
// proposal, because the file says "Dust of Dreams: The Malazan Book of the Fallen 9"
// and the library says "Dust of Dreams"). And the same facts are a supplier of book
// metadata in their own right: the file is the reader's own edition, so what it says
// about its publisher, year, series and subjects can fill gaps and can be chosen at
// any time like any other source.
type Meta struct {
	Title       string
	Creator     string
	Publisher   string
	Language    string
	Description string
	Year        int      // the first four digits of dc:date, 0 when absent
	Subjects    []string // dc:subject, in order
	Series      string
	SeriesIndex float64
	ISBNs       []string // digits only, 10 or 13
	ASINs       []string // B0xxxxxxxx
}

var (
	isbnDigits = regexp.MustCompile(`^(?:97[89])?\d{9}[\dXx]$`)
	asinForm   = regexp.MustCompile(`^B[0-9A-Z]{9}$`)
	markup     = regexp.MustCompile(`<[^>]*>`)
	yearDigits = regexp.MustCompile(`^\s*(-?\d{4})`)
)

// ReadMeta reads an EPUB's metadata.
func ReadMeta(data []byte) (Meta, error) {
	var m Meta
	zr, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return m, fmt.Errorf("%w: %v", ErrNotEPUB, err)
	}
	read := func(name string) ([]byte, error) {
		for _, f := range zr.File {
			if f.Name != name {
				continue
			}
			if f.UncompressedSize64 > 4<<20 {
				return nil, fmt.Errorf("%w: %s is too large", ErrNotEPUB, name)
			}
			rc, err := f.Open()
			if err != nil {
				return nil, fmt.Errorf("%w: %v", ErrNotEPUB, err)
			}
			defer rc.Close()
			return io.ReadAll(io.LimitReader(rc, 4<<20))
		}
		return nil, fmt.Errorf("%w: %s is missing", ErrNotEPUB, name)
	}
	container, err := read("META-INF/container.xml")
	if err != nil {
		return m, err
	}
	opfPath := rootfile(container)
	if opfPath == "" {
		return m, fmt.Errorf("%w: no package document named", ErrNotEPUB)
	}
	opf, err := read(opfPath)
	if err != nil {
		return m, err
	}

	dec := xml.NewDecoder(bytes.NewReader(opf))
	dec.Strict = false
	dec.Entity = xml.HTMLEntity
	var field, property string
	var seriesPos string
	for {
		tok, err := dec.Token()
		if err != nil {
			break
		}
		switch t := tok.(type) {
		case xml.StartElement:
			field, property = "", ""
			switch t.Name.Local {
			case "title", "creator", "identifier", "publisher", "language", "description", "date", "subject":
				field = t.Name.Local
			case "meta":
				// EPUB 2 (Calibre): <meta name="calibre:series" content="..."/>.
				name, content := "", ""
				for _, a := range t.Attr {
					switch a.Name.Local {
					case "name":
						name = a.Value
					case "content":
						content = a.Value
					case "property":
						property = a.Value
					}
				}
				switch name {
				case "calibre:series":
					m.Series = strings.TrimSpace(content)
				case "calibre:series_index":
					seriesPos = strings.TrimSpace(content)
				}
				if property == "belongs-to-collection" || property == "group-position" {
					field = "meta:" + property // EPUB 3: the value is the element's text
				}
			}
		case xml.CharData:
			text := strings.TrimSpace(string(t))
			if text == "" {
				continue
			}
			switch field {
			case "title":
				if m.Title == "" {
					m.Title = text
				}
			case "creator":
				if m.Creator == "" {
					m.Creator = text
				}
			case "publisher":
				if m.Publisher == "" {
					m.Publisher = text
				}
			case "language":
				if m.Language == "" {
					m.Language = text
				}
			case "description":
				if m.Description == "" {
					m.Description = tidyText(text)
				}
			case "date":
				if m.Year == 0 {
					if y := yearDigits.FindStringSubmatch(text); y != nil {
						m.Year, _ = strconv.Atoi(y[1])
					}
				}
			case "subject":
				m.Subjects = append(m.Subjects, text)
			case "identifier":
				m.addIdentifier(text)
			case "meta:belongs-to-collection":
				if m.Series == "" {
					m.Series = text
				}
			case "meta:group-position":
				seriesPos = text
			}
		case xml.EndElement:
			field = ""
		}
	}
	if seriesPos != "" {
		m.SeriesIndex, _ = strconv.ParseFloat(seriesPos, 64)
	}
	return m, nil
}

// tidyText turns a description that arrives as HTML into plain text: tags removed,
// whitespace collapsed. A publisher's blurb is often a fragment of markup.
func tidyText(s string) string {
	s = markup.ReplaceAllString(s, " ")
	// The markup was itself escaped inside the XML, so its entities are still entities.
	s = strings.ReplaceAll(html.UnescapeString(s), " ", " ")
	return strings.Join(strings.Fields(s), " ")
}

// addIdentifier files one dc:identifier as an ISBN or an ASIN when it is one. The
// SHAPE decides, not the label: books name their identifiers every way there is
// ("urn:isbn:978…", scheme="ISBN", a bare number, "mobi-asin"), and a 13-digit number
// is an ISBN however it is labelled.
func (m *Meta) addIdentifier(raw string) {
	low := strings.ToLower(strings.TrimSpace(raw))
	for _, p := range []string{"urn:isbn:", "isbn:", "urn:asin:", "asin:", "mobi-asin:"} {
		low = strings.TrimPrefix(low, p)
	}
	bare := strings.NewReplacer("-", "", " ", "").Replace(low)
	if isbnDigits.MatchString(bare) {
		m.ISBNs = append(m.ISBNs, strings.ToUpper(bare))
		return
	}
	if up := strings.ToUpper(bare); asinForm.MatchString(up) {
		m.ASINs = append(m.ASINs, up)
	}
}
