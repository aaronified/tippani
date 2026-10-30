package ebook

import (
	"bytes"
	"encoding/binary"
	"errors"
	"strings"
	"testing"
)

// mobiSpec describes a MOBI to build: only the fields the reader looks at.
type mobiSpec struct {
	html        string
	compression int
	encryption  uint16
	codepage    uint32
	version     uint32
	extraFlags  uint16
	title       string
	exth        [][2]any // type, string
	flows       []int    // KF8: the end offset of each flow; the first is the markup
	raw         []byte   // when set, used as the text instead of html
}

// palmCompressLiterals is the simplest valid PalmDOC stream: every byte is a literal,
// with a length-prefixed run for the bytes that cannot stand for themselves.
func palmCompressLiterals(b []byte) []byte {
	var out []byte
	for _, c := range b {
		if c == 0 || (c >= 0x09 && c <= 0x7F) {
			out = append(out, c)
		} else {
			out = append(out, 1, c)
		}
	}
	return out
}

func buildMOBI(t *testing.T, s mobiSpec) []byte {
	t.Helper()
	if s.compression == 0 {
		s.compression = compNone
	}
	if s.codepage == 0 {
		s.codepage = 65001
	}
	if s.version == 0 {
		s.version = 6
	}
	text := s.raw
	if text == nil {
		text = []byte(s.html)
	}
	const hdrLen = 264
	rec0 := make([]byte, 16+hdrLen)
	be := binary.BigEndian
	nrec := (len(text) + 4095) / 4096
	be.PutUint16(rec0[0:], uint16(s.compression))
	be.PutUint32(rec0[4:], uint32(len(text)))
	be.PutUint16(rec0[8:], uint16(nrec))
	be.PutUint16(rec0[10:], 4096)
	be.PutUint16(rec0[12:], s.encryption)
	copy(rec0[16:], "MOBI")
	be.PutUint32(rec0[20:], hdrLen)
	be.PutUint32(rec0[28:], s.codepage)
	be.PutUint32(rec0[36:], s.version)
	be.PutUint32(rec0[0xC0:], 0xFFFFFFFF)
	be.PutUint16(rec0[0xF2:], s.extraFlags)
	if len(s.exth) > 0 {
		be.PutUint32(rec0[0x80:], 0x40)
		var block []byte
		for _, e := range s.exth {
			v := []byte(e[1].(string))
			rec := make([]byte, 8)
			be.PutUint32(rec[0:], uint32(e[0].(int)))
			be.PutUint32(rec[4:], uint32(8+len(v)))
			block = append(append(block, rec...), v...)
		}
		head := make([]byte, 12)
		copy(head, "EXTH")
		be.PutUint32(head[4:], uint32(12+len(block)))
		be.PutUint32(head[8:], uint32(len(s.exth)))
		rec0 = append(append(rec0, head...), block...)
	}
	be.PutUint32(rec0[0x54:], uint32(len(rec0)))
	be.PutUint32(rec0[0x58:], uint32(len(s.title)))
	rec0 = append(rec0, s.title...)

	records := [][]byte{rec0}
	for i := 0; i < nrec; i++ {
		chunk := text[i*4096 : min(len(text), (i+1)*4096)]
		if s.compression == compPalm {
			chunk = palmCompressLiterals(chunk)
		}
		chunk = append([]byte{}, chunk...)
		// After the text: the multibyte-overlap byte (one byte), then one trailing entry
		// of 3 bytes whose last byte is its own size.
		if s.extraFlags&1 != 0 {
			chunk = append(chunk, 0x00)
		}
		if s.extraFlags&2 != 0 {
			chunk = append(chunk, 'x', 'y', 0x83)
		}
		records = append(records, chunk)
	}
	if len(s.flows) > 0 {
		fdst := make([]byte, 12)
		copy(fdst, "FDST")
		be.PutUint32(fdst[4:], 12)
		be.PutUint32(fdst[8:], uint32(len(s.flows)))
		start := 0
		for _, end := range s.flows {
			pair := make([]byte, 8)
			be.PutUint32(pair[0:], uint32(start))
			be.PutUint32(pair[4:], uint32(end))
			fdst = append(fdst, pair...)
			start = end
		}
		be.PutUint32(records[0][0xC0:], uint32(len(records)))
		be.PutUint32(records[0][0xC4:], uint32(len(s.flows)))
		records = append(records, fdst)
	}

	n := len(records)
	out := make([]byte, 78+8*n+2)
	copy(out, "Test Book")
	copy(out[60:], "BOOKMOBI")
	be.PutUint16(out[76:], uint16(n))
	off := len(out)
	for i, r := range records {
		be.PutUint32(out[78+8*i:], uint32(off))
		off += len(r)
	}
	for _, r := range records {
		out = append(out, r...)
	}
	return out
}

const bookHTML = `<html><head><title>A Title That Is Not The Text</title><style>p { color: red }</style></head><body>
<h1>Chapter One</h1>
<p>It was a bright cold day in April.</p>
<p>The clocks were striking thirteen.<br/>Winston slipped quickly through the glass doors.</p>
<mbp:pagebreak/>
<h1>Chapter Two</h1>
<p>Dust &amp; ash, &#8220;quoted&#8221; &mdash; and &eacute;t&eacute;.</p>
<h3>A part of the chapter</h3>
<p>Last paragraph.</p>
</body></html>`

func TestAMobiIsReadIntoParagraphsWithTheirChapterAndSection(t *testing.T) {
	ps, err := ReadMOBI(buildMOBI(t, mobiSpec{html: bookHTML}))
	if err != nil {
		t.Fatal(err)
	}
	var got []string
	for _, p := range ps {
		got = append(got, p.Chapter+"|"+p.Text)
	}
	want := []string{
		"Chapter One|Chapter One",
		"Chapter One|It was a bright cold day in April.",
		"Chapter One|The clocks were striking thirteen. Winston slipped quickly through the glass doors.",
		"Chapter Two|Chapter Two",
		"Chapter Two|Dust & ash, “quoted” — and été.",
		"Chapter Two|A part of the chapter",
		"Chapter Two|Last paragraph.",
	}
	if strings.Join(got, "\n") != strings.Join(want, "\n") {
		t.Fatalf("got:\n%s\nwant:\n%s", strings.Join(got, "\n"), strings.Join(want, "\n"))
	}
	if ps[2].Doc != 0 || ps[3].Doc != 1 {
		t.Fatalf("a page break starts a new section: %d %d", ps[2].Doc, ps[3].Doc)
	}
	all := strings.Join(got, "")
	if strings.Contains(all, "color: red") || strings.Contains(all, "Not The Text") {
		t.Fatal("the head of the document was read as text")
	}
}

func TestAMobisPlaceIsAPercentOfItsTextByTheSameRuleAsAnEpub(t *testing.T) {
	// Four paragraphs of 10, 10, 20 and 10 runes: 0%, 20%, 40%, 80% of 50.
	html := "<p>aaaaaaaaaa</p><p>bbbbbbbbbb</p><p>" + strings.Repeat("c", 20) + "</p><p>dddddddddd</p>"
	ps, err := ReadMOBI(buildMOBI(t, mobiSpec{html: html}))
	if err != nil {
		t.Fatal(err)
	}
	var pcts []int
	for _, p := range ps {
		pcts = append(pcts, p.Percent)
	}
	if len(pcts) != 4 || pcts[0] != 0 || pcts[1] != 20 || pcts[2] != 40 || pcts[3] != 80 {
		t.Fatalf("%v", pcts)
	}
}

func TestPalmDocCompressionIsUndone(t *testing.T) {
	var out bytes.Buffer
	// "abc", a copy of 3 bytes from 3 back, a space joined to 'A' (0xC1), a run of 2 raw bytes.
	if err := palmInflate(&out, []byte{'a', 'b', 'c', 0x80, 0x18, 0xC1, 0x02, 0xC3, 0xA9}); err != nil {
		t.Fatal(err)
	}
	if got := out.String(); got != "abcabc Aé" {
		t.Fatalf("%q", got)
	}
	// A copy that reaches before the start of the record is a broken file, not a panic.
	if err := palmInflate(&bytes.Buffer{}, []byte{'a', 0x80, 0x38}); err == nil {
		t.Fatal("a copy from before the record was accepted")
	}
	if err := palmInflate(&bytes.Buffer{}, []byte{0x05, 'a'}); err == nil {
		t.Fatal("a run longer than the record was accepted")
	}
}

func TestACompressedMobiWithTrailingDataReadsTheSameAsAPlainOne(t *testing.T) {
	long := strings.Repeat("<p>The same sentence, again and again, to fill several records of text.</p>\n", 300)
	plain, err := ReadMOBI(buildMOBI(t, mobiSpec{html: long}))
	if err != nil {
		t.Fatal(err)
	}
	for _, flags := range []uint16{0, 1, 2, 3} {
		got, err := ReadMOBI(buildMOBI(t, mobiSpec{html: long, compression: compPalm, extraFlags: flags}))
		if err != nil {
			t.Fatalf("flags %d: %v", flags, err)
		}
		if len(got) != len(plain) || got[len(got)-1].Text != plain[len(plain)-1].Text {
			t.Fatalf("flags %d: %d paragraphs, want %d (trailing bytes were read as text?)", flags, len(got), len(plain))
		}
		for _, p := range got {
			if strings.Contains(p.Text, "xy") {
				t.Fatalf("flags %d: trailing bytes leaked into %q", flags, p.Text)
			}
		}
	}
}

func TestAProtectedMobiIsRefusedByNameAndAnUnreadableCompressionToo(t *testing.T) {
	if _, err := ReadMOBI(buildMOBI(t, mobiSpec{html: bookHTML, encryption: 2})); !errors.Is(err, ErrDRM) {
		t.Fatalf("encryption type 2: %v", err)
	}
	_, err := ReadMOBI(buildMOBI(t, mobiSpec{html: bookHTML, compression: compHuffCD}))
	if !errors.Is(err, ErrUnsupported) || !strings.Contains(err.Error(), "HUFF/CDIC") {
		t.Fatalf("huffman compression: %v", err)
	}
}

func TestOnlyTheMarkupFlowOfAnAzw3IsReadNotItsStyleSheets(t *testing.T) {
	markup := "<html><body><p>The only prose.</p></body></html>"
	text := markup + "body { margin: 0; } .calibre1 { color: red }"
	ps, err := ReadMOBI(buildMOBI(t, mobiSpec{raw: []byte(text), version: 8, flows: []int{len(markup), len(text)}}))
	if err != nil {
		t.Fatal(err)
	}
	if len(ps) != 1 || ps[0].Text != "The only prose." {
		t.Fatalf("%+v", ps)
	}
}

func TestEachHtmlOfAnAzw3IsASectionAndSloppyMarkupLosesNothing(t *testing.T) {
	// Unclosed tags, an unquoted attribute, a stray '<' and a comment: the markup of an
	// older file. The second file must still be read after the first one's mess.
	html := `<html><body><p class=x>One <b>bold<p>Two <img src=a.jpg> 3 < 4 <!-- a > comment --> done</body></html>` +
		`<html><body><p>Three.</p></body></html>`
	ps, err := ReadMOBI(buildMOBI(t, mobiSpec{html: html, version: 8}))
	if err != nil {
		t.Fatal(err)
	}
	last := ps[len(ps)-1]
	if last.Text != "Three." || last.Doc != 1 {
		t.Fatalf("%+v", ps)
	}
	if len(ps) < 3 || !strings.HasPrefix(ps[0].Text, "One") || !strings.HasPrefix(ps[1].Text, "Two") {
		t.Fatalf("%+v", ps)
	}
}

func TestAWindows1252MobiIsDecoded(t *testing.T) {
	raw := []byte("<p>caf\xe9 \x93quoted\x94 \x97 \x80</p>")
	ps, err := ReadMOBI(buildMOBI(t, mobiSpec{raw: raw, codepage: 1252}))
	if err != nil {
		t.Fatal(err)
	}
	if ps[0].Text != "café “quoted” — €" {
		t.Fatalf("%q", ps[0].Text)
	}
}

func TestAMobiWithNoTextSaysSo(t *testing.T) {
	_, err := ReadMOBI(buildMOBI(t, mobiSpec{html: "<html><head><title>x</title></head><body></body></html>"}))
	if !errors.Is(err, ErrNoText) {
		t.Fatalf("%v", err)
	}
}

func TestBytesThatAreNotAMobiAreRefusedNotRead(t *testing.T) {
	for name, data := range map[string][]byte{
		"empty":     nil,
		"text":      []byte(strings.Repeat("not a book ", 50)),
		"truncated": buildMOBI(t, mobiSpec{html: bookHTML})[:90],
	} {
		if _, err := ReadMOBI(data); !errors.Is(err, ErrNotMOBI) {
			t.Errorf("%s: %v", name, err)
		}
	}
}

func TestAMobiTellsItsTitleAuthorAndIdentifiersFromItsHeaderAlone(t *testing.T) {
	data := buildMOBI(t, mobiSpec{html: bookHTML, title: "Header Title", exth: [][2]any{
		{100, "George Orwell"}, {100, "A. Co-author"}, {101, "Secker"}, {104, "978-0-14-103614-4"},
		{113, "B000FC0PBC"}, {106, "1949-06-08"}, {105, "Dystopia"}, {524, "en"}, {503, "Nineteen Eighty-Four"},
	}})
	whole, err := ReadMOBIMeta(data)
	if err != nil {
		t.Fatal(err)
	}
	// Through a ReaderAt, as a scan reads it: only the front of the file is touched.
	front, err := ReadMOBIMetaAt(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		t.Fatal(err)
	}
	for _, m := range []Meta{whole, front} {
		if m.Title != "Nineteen Eighty-Four" || m.Creator != "George Orwell, A. Co-author" || m.Publisher != "Secker" ||
			m.Year != 1949 || m.Language != "en" || len(m.ISBNs) != 1 || m.ISBNs[0] != "9780141036144" ||
			len(m.ASINs) != 1 || m.ASINs[0] != "B000FC0PBC" || len(m.Subjects) != 1 {
			t.Fatalf("%+v", m)
		}
	}
	// Without an updated-title record the header's own name is the title.
	m, _ := ReadMOBIMeta(buildMOBI(t, mobiSpec{html: bookHTML, title: "Header Title"}))
	if m.Title != "Header Title" {
		t.Fatalf("%+v", m)
	}
}

func TestAMobiIsRecognisedByItsBytesNotItsName(t *testing.T) {
	if !IsMOBI(buildMOBI(t, mobiSpec{html: bookHTML})) || IsMOBI([]byte("PK\x03\x04")) || IsMOBI(nil) {
		t.Fatal("IsMOBI")
	}
}
