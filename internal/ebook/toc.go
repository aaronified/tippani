package ebook

// A book's own names for its chapters: the EPUB 3 navigation document or the EPUB 2
// NCX, whichever the package declares. Only the TITLE of a spine document is read from
// them, because that is all a proposed location needs ("Chapter Three", not a page).
// Publisher page lists (EPUB 3 page-list, NCX pageList) are deliberately not read here:
// no page number is offered by this package, and none is invented.

import (
	"bytes"
	"encoding/xml"
	"io"
	"net/url"
	"path"
	"strings"
)

// tocFile finds the table of contents the package names: the manifest item whose
// properties include "nav" (EPUB 3), else the NCX the spine points at or the manifest
// types as one. The href is relative to the package document.
func tocFile(opf []byte) (href string, nav bool) {
	dec := xml.NewDecoder(bytes.NewReader(opf))
	manifest := map[string]string{}
	var navHref, ncxHref, spineToc string
	for {
		tok, err := dec.Token()
		if err != nil {
			break
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
			manifest[attr("id")] = attr("href")
			for _, p := range strings.Fields(attr("properties")) {
				if p == "nav" && navHref == "" {
					navHref = attr("href")
				}
			}
			if attr("media-type") == "application/x-dtbncx+xml" && ncxHref == "" {
				ncxHref = attr("href")
			}
		case "spine":
			spineToc = attr("toc")
		}
	}
	if navHref != "" {
		return navHref, true
	}
	if h, ok := manifest[spineToc]; ok && spineToc != "" {
		return h, false
	}
	return ncxHref, false
}

// tocTitles maps a spine document's path inside the zip to the first title the table of
// contents gives it. A fragment ("ch1.xhtml#s2") names a place in a document, so the
// document keeps the FIRST entry that points into it, in the contents' own order.
func tocTitles(opf []byte, dir string, read func(string) ([]byte, error)) map[string]string {
	href, isNav := tocFile(opf)
	out := map[string]string{}
	if href == "" {
		return out
	}
	if u, err := url.PathUnescape(href); err == nil {
		href = u
	}
	full := href
	if dir != "." {
		full = path.Join(dir, href)
	}
	b, err := read(full)
	if err != nil {
		return out // no readable contents is a book with no chapter names, not a broken one
	}
	var entries []tocEntry
	if isNav {
		entries = navEntries(b)
	} else {
		entries = ncxEntries(b)
	}
	base := path.Dir(full)
	for _, e := range entries {
		src := e.src
		if i := strings.IndexByte(src, '#'); i >= 0 {
			src = src[:i]
		}
		if u, err := url.PathUnescape(src); err == nil {
			src = u
		}
		title := strings.Join(strings.Fields(e.title), " ")
		if src == "" || title == "" {
			continue
		}
		name := path.Join(base, src)
		if _, seen := out[name]; !seen {
			out[name] = title
		}
	}
	return out
}

type tocEntry struct{ src, title string }

func lenientDecoder(b []byte) *xml.Decoder {
	dec := xml.NewDecoder(bytes.NewReader(b))
	dec.Strict = false
	dec.Entity = xml.HTMLEntity
	dec.CharsetReader = func(_ string, in io.Reader) (io.Reader, error) { return in, nil }
	return dec
}

// navEntries reads the links of the <nav epub:type="toc"> of an EPUB 3 navigation document.
func navEntries(b []byte) []tocEntry {
	dec := lenientDecoder(b)
	var out []tocEntry
	inToc, navDepth := false, 0
	var cur *tocEntry
	for {
		tok, err := dec.Token()
		if err != nil {
			break
		}
		switch t := tok.(type) {
		case xml.StartElement:
			switch strings.ToLower(t.Name.Local) {
			case "nav":
				navDepth++
				for _, a := range t.Attr {
					if a.Name.Local == "type" && strings.Contains(a.Value, "toc") {
						inToc = true
					}
				}
			case "a":
				if inToc {
					cur = &tocEntry{}
					for _, a := range t.Attr {
						if a.Name.Local == "href" {
							cur.src = a.Value
						}
					}
				}
			}
		case xml.EndElement:
			switch strings.ToLower(t.Name.Local) {
			case "nav":
				if navDepth > 0 {
					navDepth--
				}
				if navDepth == 0 {
					inToc = false
				}
			case "a":
				if cur != nil {
					out = append(out, *cur)
					cur = nil
				}
			}
		case xml.CharData:
			if cur != nil {
				cur.title += string(t) + " "
			}
		}
	}
	return out
}

// ncxEntries reads an EPUB 2 NCX: each navPoint has a navLabel/text and a content src,
// the label first, so an entry is complete when its content element is reached.
func ncxEntries(b []byte) []tocEntry {
	dec := lenientDecoder(b)
	type point struct{ label string }
	var stack []*point
	inLabel, inText := false, false
	var out []tocEntry
	for {
		tok, err := dec.Token()
		if err != nil {
			break
		}
		switch t := tok.(type) {
		case xml.StartElement:
			switch t.Name.Local {
			case "navPoint":
				stack = append(stack, &point{})
			case "navLabel":
				inLabel = true
			case "text":
				inText = inLabel
			case "content":
				if n := len(stack); n > 0 && stack[n-1].label != "" {
					for _, a := range t.Attr {
						if a.Name.Local == "src" {
							out = append(out, tocEntry{src: a.Value, title: stack[n-1].label})
						}
					}
				}
			}
		case xml.EndElement:
			switch t.Name.Local {
			case "navPoint":
				if n := len(stack); n > 0 {
					stack = stack[:n-1]
				}
			case "navLabel":
				inLabel = false
			case "text":
				inText = false
			}
		case xml.CharData:
			if n := len(stack); inText && n > 0 {
				stack[n-1].label += string(t)
			}
		}
	}
	return out
}
