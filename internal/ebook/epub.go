// Package ebook reads an EPUB into paragraphs, in reading order, each tagged with the
// chapter (spine document) it came from.
//
// It is the ebook half of "what the file says" (internal/subs is the subtitle half):
// a pure function from bytes to text, with no database, no HTTP and no dependency
// beyond the standard library. The matcher and the extractor that use it are in
// internal/srcmatch.
//
// WHAT IT DOES NOT DO, stated because "reads an ebook" sounds like more: it renders
// nothing, paginates nothing and keeps no position. The plan's line is that the app
// never renders a source file as a document — what leaves is extracted spans of text.
//
// DRM IS REFUSED BY NAME at the header. An EPUB whose content is encrypted with
// anything other than the font-obfuscation schemes (which protect a typeface, not
// the words) cannot be read, and a file that parses to gibberish is a worse answer
// than saying so.
//
// A ZIP IS UNTRUSTED INPUT. Entries are read into memory by name, never written to
// disk, and every read is bounded, so a small file that inflates to gigabytes
// answers an error rather than exhausting the box.
package ebook

import (
	"archive/zip"
	"bytes"
	"encoding/xml"
	"errors"
	"fmt"
	"io"
	"net/url"
	"path"
	"strings"
	"unicode/utf8"
)

// Paragraph is one block of the book's text. Doc is the index of the spine document
// it came from, which is what the extractor will not cross: a chapter start has
// nothing before it in the chapter.
type Paragraph struct {
	Text string
	Doc  int
	// Chapter is the title the book's own table of contents gives the spine document
	// this paragraph sits in (EPUB 3 nav, or EPUB 2 NCX), or the nearest titled one
	// before it when a chapter is split across files. Empty when the book names none.
	Chapter string
	// Percent is how far into the book's text the paragraph STARTS, 0 to 99.
	//
	// THE EXTRACTION RULE IS PART OF THE CONTRACT. Position is counted in runes of the
	// paragraph texts exactly as Read yields them (inline markup stripped, whitespace
	// collapsed to single spaces, script/style/head/title/nav dropped, a <br> a space),
	// laid end to end with NO separator between paragraphs, in spine order. Percent is
	// floor(100 * runes before this paragraph / total runes). Changing any of that
	// renumbers every location this app ever proposed, which is why a golden test pins
	// it. It is a percent of THIS file's text: not a page, not a Kindle location, and
	// not comparable to either.
	Percent int
}

var (
	// ErrNotEPUB is a zip that is not an EPUB, or an EPUB too broken to read.
	ErrNotEPUB = errors.New("ebook: not a readable EPUB")
	// ErrDRM is an EPUB whose text is encrypted. Refused by name.
	ErrDRM = errors.New("ebook: the file is DRM-protected and cannot be read")
	// ErrNoText is an EPUB that read cleanly and held no text at all.
	ErrNoText = errors.New("ebook: no text found")
)

// Bounds on what one file may cost to read.
const (
	maxEntryBytes = 24 << 20  // one entry, uncompressed
	maxTotalBytes = 128 << 20 // everything read from one file
	maxEntries    = 20000
)

// fontObfuscation are the two encryption algorithms that protect an embedded
// typeface and nothing else. Their presence is not DRM.
var fontObfuscation = map[string]bool{
	"http://www.idpf.org/2008/embedding": true,
	"http://ns.adobe.com/pdf/enc#RC":     true,
}

// Read parses the EPUB in data.
func Read(data []byte) ([]Paragraph, error) {
	zr, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrNotEPUB, err)
	}
	if len(zr.File) > maxEntries {
		return nil, fmt.Errorf("%w: too many entries", ErrNotEPUB)
	}
	files := map[string]*zip.File{}
	for _, f := range zr.File {
		files[f.Name] = f
	}
	var total int64
	read := func(name string) ([]byte, error) {
		f, ok := files[name]
		if !ok {
			return nil, fmt.Errorf("%w: %s is missing", ErrNotEPUB, name)
		}
		if f.UncompressedSize64 > maxEntryBytes {
			return nil, fmt.Errorf("%w: %s is too large", ErrNotEPUB, name)
		}
		rc, err := f.Open()
		if err != nil {
			return nil, fmt.Errorf("%w: %v", ErrNotEPUB, err)
		}
		defer rc.Close()
		// Bounded by what is actually inflated, not by what the header claims.
		b, err := io.ReadAll(io.LimitReader(rc, maxEntryBytes+1))
		if err != nil {
			return nil, fmt.Errorf("%w: %v", ErrNotEPUB, err)
		}
		if len(b) > maxEntryBytes {
			return nil, fmt.Errorf("%w: %s is too large", ErrNotEPUB, name)
		}
		total += int64(len(b))
		if total > maxTotalBytes {
			return nil, fmt.Errorf("%w: the book is too large to read", ErrNotEPUB)
		}
		return b, nil
	}

	if _, ok := files["META-INF/encryption.xml"]; ok {
		if b, err := read("META-INF/encryption.xml"); err == nil && encryptsText(b) {
			return nil, ErrDRM
		}
	}
	if _, ok := files["META-INF/rights.xml"]; ok {
		return nil, ErrDRM // Adobe ADEPT's licence file
	}

	container, err := read("META-INF/container.xml")
	if err != nil {
		return nil, err
	}
	opfPath := rootfile(container)
	if opfPath == "" {
		return nil, fmt.Errorf("%w: no package document named", ErrNotEPUB)
	}
	opf, err := read(opfPath)
	if err != nil {
		return nil, err
	}
	hrefs, err := spine(opf)
	if err != nil {
		return nil, err
	}
	dir := path.Dir(opfPath)

	titles := tocTitles(opf, dir, read)
	var out []Paragraph
	chapter := ""
	for doc, href := range hrefs {
		name := href
		if dir != "." {
			name = path.Join(dir, href)
		}
		if t, ok := titles[name]; ok {
			chapter = t
		}
		b, err := read(name)
		if err != nil {
			// A spine item the zip lacks is a broken book, but one missing chapter
			// should not cost the other fifty-one.
			continue
		}
		for _, p := range paragraphs(b) {
			out = append(out, Paragraph{Text: p, Doc: doc, Chapter: chapter})
		}
	}
	if len(out) == 0 {
		return nil, ErrNoText
	}
	setPercents(out)
	return out, nil
}

// setPercents fills each paragraph's Percent by the rule documented on Paragraph.Percent.
// Every reader in this package (EPUB, MOBI, PDF) uses it, so a location means the same
// thing whichever file it came from.
func setPercents(out []Paragraph) {
	runes := 0
	for _, p := range out {
		runes += utf8.RuneCountInString(p.Text)
	}
	before := 0
	for i := range out {
		out[i].Percent = before * 100 / runes
		before += utf8.RuneCountInString(out[i].Text)
	}
}

// encryptsText reports whether encryption.xml names any algorithm other than font
// obfuscation.
func encryptsText(b []byte) bool {
	dec := xml.NewDecoder(bytes.NewReader(b))
	for {
		tok, err := dec.Token()
		if err != nil {
			return false
		}
		if se, ok := tok.(xml.StartElement); ok && se.Name.Local == "EncryptionMethod" {
			for _, a := range se.Attr {
				if a.Name.Local == "Algorithm" && !fontObfuscation[a.Value] {
					return true
				}
			}
		}
	}
}

// rootfile answers the path of the package document, from container.xml.
func rootfile(b []byte) string {
	dec := xml.NewDecoder(bytes.NewReader(b))
	for {
		tok, err := dec.Token()
		if err != nil {
			return ""
		}
		if se, ok := tok.(xml.StartElement); ok && se.Name.Local == "rootfile" {
			for _, a := range se.Attr {
				if a.Name.Local == "full-path" {
					return a.Value
				}
			}
		}
	}
}

// spine answers the spine's documents as hrefs relative to the package document, in
// reading order: the manifest maps ids to hrefs and the spine lists ids.
func spine(opf []byte) ([]string, error) {
	dec := xml.NewDecoder(bytes.NewReader(opf))
	manifest := map[string]string{}
	var order []string
	for {
		tok, err := dec.Token()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("%w: package document: %v", ErrNotEPUB, err)
		}
		se, ok := tok.(xml.StartElement)
		if !ok {
			continue
		}
		attr := func(name string) string {
			for _, a := range se.Attr {
				if a.Name.Local == name {
					return a.Value
				}
			}
			return ""
		}
		switch se.Name.Local {
		case "item":
			if id := attr("id"); id != "" {
				manifest[id] = attr("href")
			}
		case "itemref":
			order = append(order, attr("idref"))
		}
	}
	var hrefs []string
	for _, id := range order {
		h, ok := manifest[id]
		if !ok || h == "" {
			continue
		}
		if dec, err := url.PathUnescape(h); err == nil {
			h = dec
		}
		// A fragment names a place in a document, not a document.
		if i := strings.IndexByte(h, '#'); i >= 0 {
			h = h[:i]
		}
		hrefs = append(hrefs, h)
	}
	if len(hrefs) == 0 {
		return nil, fmt.Errorf("%w: the spine lists no documents", ErrNotEPUB)
	}
	return hrefs, nil
}

// blocks are the elements that start and end a paragraph. Inline markup (i, b, span,
// a, em) runs on within one; a <br> is a break inside a paragraph and reads as a space.
var blocks = map[string]bool{
	"p": true, "div": true, "li": true, "blockquote": true, "tr": true, "section": true,
	"h1": true, "h2": true, "h3": true, "h4": true, "h5": true, "h6": true,
	"pre": true, "figcaption": true, "dt": true, "dd": true, "caption": true,
}

// skipped elements hold no reading text.
var skipped = map[string]bool{"script": true, "style": true, "head": true, "title": true, "nav": true}

// paragraphs turns one XHTML document into its blocks of text. XHTML is not always
// well-formed XML in the wild and uses HTML's entities (&nbsp;, &mdash;), so the
// decoder is non-strict and knows them.
func paragraphs(doc []byte) []string {
	dec := xml.NewDecoder(bytes.NewReader(doc))
	dec.Strict = false
	dec.Entity = xml.HTMLEntity
	dec.CharsetReader = func(_ string, in io.Reader) (io.Reader, error) { return in, nil }

	var out []string
	var cur strings.Builder
	flush := func() {
		if t := strings.Join(strings.Fields(cur.String()), " "); t != "" {
			out = append(out, t)
		}
		cur.Reset()
	}
	skip := 0
	for {
		tok, err := dec.Token()
		if err != nil {
			break
		}
		switch t := tok.(type) {
		case xml.StartElement:
			name := strings.ToLower(t.Name.Local)
			switch {
			case skipped[name]:
				skip++
			case skip > 0:
			case blocks[name]:
				flush()
			case name == "br":
				cur.WriteByte(' ')
			}
		case xml.EndElement:
			name := strings.ToLower(t.Name.Local)
			switch {
			case skipped[name]:
				if skip > 0 {
					skip--
				}
			case skip > 0:
			case blocks[name]:
				flush()
			}
		case xml.CharData:
			if skip == 0 {
				cur.Write(t)
			}
		}
	}
	flush()
	return out
}
