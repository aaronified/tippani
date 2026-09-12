package httpapi

// EPUB export for an anthology — the second format, and the first file this app
// writes that another program has to OPEN rather than read.
//
// NO DEPENDENCY, WHICH IS THE ONLY REASON THIS IS PLAUSIBLE HERE. `PLAN.md`
// defends go.mod's three direct requirements by name, and an EPUB is a zip holding
// four small XML files: `archive/zip` is already imported for the library export
// and `html.EscapeString` is stdlib. The roadmap costed it as "archive/zip plus
// encoding/xml"; encoding/xml turned out to be the wrong tool for the escaping
// (see xmlText at the foot of this file) and nothing else here needs a marshaller,
// so the real cost came in under the estimate rather than over it.
//
// EPUB 2 AND NOT EPUB 3, deliberately. EPUB 3 replaces `toc.ncx` with a navigation
// document and gains nothing this file needs — no audio, no scripting, no fixed
// layout. What EPUB 2 has is readers: the point of the feature, in the roadmap's
// own words, is "a small readable book of your own quotes, to put back on the
// e-reader they came off", and the e-reader a book came off five years ago reads
// EPUB 2. Every EPUB 3 reader reads EPUB 2 as well.
//
// THE ONE THING THE FORMAT IS FUSSY ABOUT is the first zip entry: `mimetype`, with
// the exact bytes `application/epub+zip`, STORED rather than deflated, and first.
// The OCF spec makes it the signature a reader sniffs before it has unzipped
// anything, so a compressed or misplaced mimetype is "this is not an EPUB" from a
// file that is otherwise perfect. `zip.Store` and writing it before anything else
// is the whole of it, and the test asserts both.
//
// ONE XHTML FILE FOR THE WHOLE ANTHOLOGY rather than one per entry. The plan allows
// either. A file per entry buys per-entry bookmarks and costs a manifest item, a
// spine item and a navPoint each — and an anthology is read front to back, so the
// bookmark it actually wants is the one the reader's own device keeps. The navMap
// still names every entry, so the table of contents is per-entry either way.
//
// THE SAME DOCUMENT AS THE MARKDOWN, from the same registry (0074). Every decision
// about what an entry shows was made once, in anthology_registry.go, and both
// writers walk that list in that order — which is 0045's promise that what you see
// when you read the anthology is what you get when you export it, extended to a
// second format rather than reimplemented beside it.
//
// PORTRAITS ARE NOT IN THIS FILE YET. They were left out of the person join because
// Markdown could only carry them as a local path that means nothing outside this
// install; this is the renderer that can carry the bytes, and doing so is the next
// step rather than this one. Nothing here is shaped to make that hard: an image is
// a manifest item and an <img>, and the writer below already builds the manifest
// from a list.

import (
	"archive/zip"
	"bytes"
	"fmt"
	"html"
	"net/http"
	"strconv"
	"strings"

	"tippani/internal/olog"
)

// handleExportAnthologyEPUB renders one anthology as an .epub file.
func (s *Server) handleExportAnthologyEPUB(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		writeErr(w, http.StatusBadRequest, "bad anthology id")
		return
	}
	uid := userID(r)
	olog.Tracef("[export] anthology epub uid=%d id=%d", uid, id)
	var title, intro string
	var fields anthologyFields
	err := s.Store.DB.QueryRow(`SELECT title, intro, `+anthologyFieldCols+` FROM anthologies WHERE id = ? AND user_id = ?`,
		id, uid).Scan(append([]any{&title, &intro}, fields.scanTargets()...)...)
	fields.fromRow()
	if err != nil {
		// Not found and a read error are one answer, exactly as the Markdown export
		// does it: telling a caller which would confirm that somebody else's
		// anthology exists.
		writeErr(w, http.StatusNotFound, "anthology not found")
		return
	}
	entries, err := s.entriesFor(uid, id)
	if err != nil {
		internalError(w, r, "render anthology epub", err)
		return
	}
	book, err := renderAnthologyEPUB(id, title, intro, fields, entries)
	if err != nil {
		internalError(w, r, "render anthology epub", err)
		return
	}
	w.Header().Set("Content-Type", "application/epub+zip")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%q", sanitizeFilename(title)+".epub"))
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(book)
}

// epubIdentifier is the book's dc:identifier — required by the OPF, and a URN this
// install mints rather than a UUID.
//
// STABLE ACROSS RE-EXPORTS, on purpose. A reader who exports an anthology twice and
// sideloads both should get ONE book updated, not two books with the same title —
// and an e-reader decides that by identifier. A fresh UUID per export would fill a
// device with copies, which is the failure mode a reader only notices at ten.
func epubIdentifier(id int64) string {
	return "urn:tippani:anthology:" + strconv.FormatInt(id, 10)
}

// renderAnthologyEPUB writes the whole book. The entry order is the anthology's,
// which is the whole point of an anthology and the one thing a format conversion
// must not touch.
func renderAnthologyEPUB(id int64, title, intro string, f anthologyFields, entries []anthologyEntryRow) ([]byte, error) {
	uid := epubIdentifier(id)
	var buf bytes.Buffer
	z := zip.NewWriter(&buf)

	// THE MIMETYPE FIRST AND STORED. See the file header; this is the one ordering
	// constraint in the format and the only reason this function writes entries in
	// a fixed order rather than a map's.
	mt, err := z.CreateHeader(&zip.FileHeader{Name: "mimetype", Method: zip.Store})
	if err != nil {
		return nil, err
	}
	if _, err := mt.Write([]byte("application/epub+zip")); err != nil {
		return nil, err
	}

	add := func(name, body string) error {
		f, err := z.Create(name)
		if err != nil {
			return err
		}
		_, err = f.Write([]byte(body))
		return err
	}

	if err := add("META-INF/container.xml", epubContainer); err != nil {
		return nil, err
	}
	if err := add("OEBPS/style.css", epubStyle); err != nil {
		return nil, err
	}
	if err := add("OEBPS/anthology.xhtml", epubBody(title, intro, f, entries)); err != nil {
		return nil, err
	}
	if err := add("OEBPS/content.opf", epubOPF(title, uid)); err != nil {
		return nil, err
	}
	if err := add("OEBPS/toc.ncx", epubNCX(title, uid, entries, f)); err != nil {
		return nil, err
	}
	if err := z.Close(); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

// container.xml never varies: it says where the OPF is and nothing else.
const epubContainer = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>
`

// THE STYLESHEET IS SEVEN RULES AND NOT THE APP'S. An e-reader owns its own
// typeface, size, margins and theme — that is what an e-reader IS — so a book that
// ships the app's palette is a book fighting the device its reader chose. What is
// left is the structure a passage needs and nothing about colour: the quote is
// indented behind a rule, the commentary is not, and the attribution is smaller.
const epubStyle = `body { margin: 0 1em; }
h1 { font-size: 1.4em; margin: 1.2em 0 .6em; }
h2 { font-size: 1.05em; font-weight: normal; font-style: italic; margin: 1.8em 0 .4em; }
p.commentary { margin: .4em 0; }
blockquote { margin: .6em 0 .4em 0; padding-left: .9em; border-left: 3px solid #999; }
p.attribution { margin: .2em 0 0; font-size: .85em; }
p.intro { margin: .4em 0; }
`

func epubOPF(title, bookID string) string {
	return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="2.0" unique-identifier="bookid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
    <dc:title>` + xmlText(title) + `</dc:title>
    <dc:identifier id="bookid">` + xmlText(bookID) + `</dc:identifier>
    <dc:language>en</dc:language>
  </metadata>
  <manifest>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="css" href="style.css" media-type="text/css"/>
    <item id="body" href="anthology.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine toc="ncx">
    <itemref idref="body"/>
  </spine>
</package>
`
}

func epubNCX(title, bookID string, entries []anthologyEntryRow, f anthologyFields) string {
	var sb strings.Builder
	sb.WriteString(`<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head><meta name="dtb:uid" content="` + xmlText(bookID) + `"/></head>
  <docTitle><text>` + xmlText(title) + `</text></docTitle>
  <navMap>
`)
	for i, e := range entries {
		sb.WriteString(`    <navPoint id="n` + strconv.Itoa(i+1) + `" playOrder="` + strconv.Itoa(i+1) + `">` +
			`<navLabel><text>` + xmlText(anthologyHeading(e, i, f)) + `</text></navLabel>` +
			`<content src="anthology.xhtml#e` + strconv.Itoa(i+1) + `"/></navPoint>` + "\n")
	}
	sb.WriteString("  </navMap>\n</ncx>\n")
	return sb.String()
}

// epubBody is the anthology itself: the title, the introduction, then every entry
// in the anthology's own order.
//
// THE ATTRIBUTION LINE IS BUILT FROM THE REGISTRY, in registry order, so this
// format cannot drift from the Markdown or from the screen. It reads as prose —
// "Ursula K. Le Guin · Parnassus Press · 1968" — rather than as `- key: value`
// lines, because those are a machine's format and this file is read by a person on
// a device with no way to ask what a key means.
func epubBody(title, intro string, f anthologyFields, entries []anthologyEntryRow) string {
	var sb strings.Builder
	sb.WriteString(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>` + xmlText(title) + `</title><link rel="stylesheet" type="text/css" href="style.css"/></head>
<body>
<h1>` + xmlText(title) + `</h1>
`)
	if strings.TrimSpace(intro) != "" {
		// THE BLANK LINE BETWEEN PARAGRAPHS IS THE ONLY FORMATTING THIS FIELD HAS
		// (see trimProse on the server), so it becomes a paragraph each. Collapsing
		// it into one <p> would lose the reader's only structural choice.
		for _, para := range strings.Split(strings.TrimRight(intro, "\n"), "\n\n") {
			if strings.TrimSpace(para) == "" {
				continue
			}
			sb.WriteString(`<p class="intro">` + xmlText(para) + "</p>\n")
		}
	}
	for i, e := range entries {
		sb.WriteString(`<h2 id="e` + strconv.Itoa(i+1) + `">` + xmlText(anthologyHeading(e, i, f)) + "</h2>\n")
		if f.shows("commentary") && strings.TrimSpace(e.Note) != "" {
			for _, para := range strings.Split(strings.TrimRight(e.Note, "\n"), "\n\n") {
				if strings.TrimSpace(para) == "" {
					continue
				}
				sb.WriteString(`<p class="commentary">` + xmlText(para) + "</p>\n")
			}
		}
		sb.WriteString("<blockquote>")
		for _, line := range strings.Split(e.Quote, "\n") {
			sb.WriteString("<p>" + xmlText(line) + "</p>")
		}
		sb.WriteString("</blockquote>\n")
		if line := epubAttribution(e, f); line != "" {
			sb.WriteString(`<p class="attribution">` + xmlText(line) + "</p>\n")
		}
	}
	sb.WriteString("</body>\n</html>\n")
	return sb.String()
}

// epubAttribution is every switched-on field this entry has a value for, in
// registry order, joined the way every meta line in this app is.
//
// THE HEADING ALREADY CARRIES THE SOURCE AND THE CREDIT, so they are skipped here —
// printing them again under a heading made of them is the row saying one thing
// twice, which is a standing rule in this repository rather than a judgement call.
func epubAttribution(e anthologyEntryRow, f anthologyFields) string {
	parts := []string{}
	for _, fd := range anthologyRegistry {
		if fd.Key == fieldCredit || fd.Key == fieldSource || fd.Key == fieldColour || fd.Binding == "" {
			continue
		}
		if !f.shows(fd.Key) || !fd.appliesTo(e.Kind) {
			continue
		}
		if v := strings.TrimSpace(anthologyFieldValue(e, fd)); v != "" {
			parts = append(parts, v)
		}
	}
	return strings.Join(parts, " · ")
}

// xmlText escapes a value for XML text content.
//
// html.EscapeString AND NOT xml.EscapeText, which is the one that looks right. The
// xml package's escaper writes to an io.Writer and also escapes newline, carriage
// return and tab as numeric references — correct inside an ATTRIBUTE, where
// whitespace is normalised away, and wrong in prose, where it would turn every line
// break in a reader's commentary into "&#xA;" on the page. html.EscapeString covers
// & < > " and ' and nothing else, which is exactly the set XML text content needs.
func xmlText(s string) string { return html.EscapeString(s) }
