package ebook

import (
	"archive/zip"
	"bytes"
	"encoding/xml"
	"fmt"
	"io"
	"regexp"
	"strings"
)

// Meta is what an EPUB says about itself, read from its package document alone: the
// zip's central directory, container.xml and the OPF. Measured on a real 1.4 MB novel
// that is about ten kilobytes and five milliseconds, so a shelf of a thousand books
// is a few seconds, and nothing else in the file is opened.
//
// It exists so a scan can identify a book by what is IN it. An ISBN or ASIN that the
// library also holds is an exact match with no fuzz at all; a title and author are a
// proposal, because the file says "Dust of Dreams: The Malazan Book of the Fallen 9"
// and the library says "Dust of Dreams".
type Meta struct {
	Title   string
	Creator string
	ISBNs   []string // digits only, 10 or 13
	ASINs   []string // B0xxxxxxxx
}

var (
	isbnDigits = regexp.MustCompile(`^(?:97[89])?\d{9}[\dXx]$`)
	asinForm   = regexp.MustCompile(`^B[0-9A-Z]{9}$`)
)

// ReadMeta reads an EPUB's title, creator and identifiers.
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
	var field string
	var scheme string
	for {
		tok, err := dec.Token()
		if err != nil {
			break
		}
		switch t := tok.(type) {
		case xml.StartElement:
			switch t.Name.Local {
			case "title", "creator", "identifier":
				field, scheme = t.Name.Local, ""
				for _, a := range t.Attr {
					if a.Name.Local == "scheme" {
						scheme = strings.ToLower(a.Value)
					}
				}
			default:
				field = ""
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
			case "identifier":
				m.addIdentifier(scheme, text)
			}
		case xml.EndElement:
			field = ""
		}
	}
	return m, nil
}

// addIdentifier files one dc:identifier as an ISBN or an ASIN when it is one. The
// scheme is a hint and the SHAPE decides: books name their identifiers every way there
// is ("urn:isbn:978…", scheme="ISBN", a bare number, "mobi-asin"), and a 13-digit
// number is an ISBN however it is labelled.
func (m *Meta) addIdentifier(scheme, raw string) {
	s := strings.TrimSpace(raw)
	low := strings.ToLower(s)
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
	_ = scheme
}
