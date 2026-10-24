package ebook

import (
	"archive/zip"
	"bytes"
	"errors"
	"strings"
	"testing"
)

// A book is built in the test rather than read from a fixture, so every trap is
// visible in the file that tests it. The shapes are the ones a real EPUB has: the
// package document in a subfolder, hrefs relative to it, HTML entities in XHTML.

type entry struct{ name, body string }

func epubOf(t *testing.T, entries ...entry) []byte {
	t.Helper()
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	for _, e := range entries {
		w, err := zw.Create(e.name)
		if err != nil {
			t.Fatal(err)
		}
		_, _ = w.Write([]byte(e.body))
	}
	if err := zw.Close(); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

const container = `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
 <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`

const opf = `<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
 <manifest>
  <item id="c2" href="text/ch%202.xhtml" media-type="application/xhtml+xml"/>
  <item id="c1" href="text/ch1.xhtml" media-type="application/xhtml+xml"/>
  <item id="gone" href="text/missing.xhtml" media-type="application/xhtml+xml"/>
  <item id="css" href="style.css" media-type="text/css"/>
 </manifest>
 <spine><itemref idref="c1"/><itemref idref="gone"/><itemref idref="c2"/></spine>
</package>`

const ch1 = `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Chapter One</title><style>p{color:red}</style></head>
<body><h1>One</h1>
<p>It was a bright cold day in April,&nbsp;and the <i>clocks</i> were <b>striking</b> thirteen.</p>
<div><p>Second paragraph&mdash;with a dash.<br/>And a break.</p></div>
<script>var x = "not reading text";</script></body></html>`

const ch2 = `<html xmlns="http://www.w3.org/1999/xhtml"><body><h1>Two</h1><p>Chapter two opens here.</p></body></html>`

func goodBook(t *testing.T, extra ...entry) []byte {
	es := []entry{
		{"mimetype", "application/epub+zip"},
		{"META-INF/container.xml", container},
		{"OEBPS/content.opf", opf},
		{"OEBPS/text/ch1.xhtml", ch1},
		{"OEBPS/text/ch 2.xhtml", ch2},
	}
	return epubOf(t, append(es, extra...)...)
}

func texts(ps []Paragraph) []string {
	out := make([]string, len(ps))
	for i, p := range ps {
		out[i] = p.Text
	}
	return out
}

func TestParagraphsComeOutInSpineOrderWithTheirChapter(t *testing.T) {
	ps, err := Read(goodBook(t))
	if err != nil {
		t.Fatal(err)
	}
	want := []string{
		"One",
		"It was a bright cold day in April, and the clocks were striking thirteen.",
		"Second paragraph—with a dash. And a break.",
		"Two",
		"Chapter two opens here.",
	}
	got := texts(ps)
	if len(got) != len(want) {
		t.Fatalf("got %q", got)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("paragraph %d: %q, want %q", i, got[i], want[i])
		}
	}
	// The manifest listed c2 first; the SPINE says c1 is first, and the spine wins.
	// The missing middle document keeps its index, so chapter two is Doc 2, not 1.
	if ps[0].Doc != 0 || ps[len(ps)-1].Doc != 2 {
		t.Fatalf("docs: %+v", ps)
	}
}

func TestScriptStyleAndTitleAreNotReadingText(t *testing.T) {
	ps, err := Read(goodBook(t))
	if err != nil {
		t.Fatal(err)
	}
	for _, p := range ps {
		if strings.Contains(p.Text, "not reading text") || strings.Contains(p.Text, "color:red") || p.Text == "Chapter One" {
			t.Fatalf("leaked: %q", p.Text)
		}
	}
}

func TestAnEncryptedBookIsRefusedByNameButFontObfuscationIsNot(t *testing.T) {
	drm := `<encryption xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><EncryptedData xmlns="http://www.w3.org/2001/04/xmlenc#">
	<EncryptionMethod Algorithm="http://www.w3.org/2001/04/xmlenc#aes128-cbc"/></EncryptedData></encryption>`
	if _, err := Read(goodBook(t, entry{"META-INF/encryption.xml", drm})); !errors.Is(err, ErrDRM) {
		t.Fatalf("err = %v", err)
	}
	fonts := `<encryption xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><EncryptedData xmlns="http://www.w3.org/2001/04/xmlenc#">
	<EncryptionMethod Algorithm="http://www.idpf.org/2008/embedding"/></EncryptedData></encryption>`
	if _, err := Read(goodBook(t, entry{"META-INF/encryption.xml", fonts})); err != nil {
		t.Fatalf("an obfuscated font is not DRM: %v", err)
	}
	if _, err := Read(goodBook(t, entry{"META-INF/rights.xml", "<rights/>"})); !errors.Is(err, ErrDRM) {
		t.Fatalf("an ADEPT licence is DRM: %v", err)
	}
}

func TestSomethingThatIsNotABookIsRefusedAndNeverPanics(t *testing.T) {
	for name, data := range map[string][]byte{
		"not a zip":         []byte("hello"),
		"empty":             nil,
		"a zip with no opf": epubOf(t, entry{"a.txt", "x"}),
		"a broken package":  epubOf(t, entry{"META-INF/container.xml", container}, entry{"OEBPS/content.opf", "<package><manifest>"}),
	} {
		if _, err := Read(data); !errors.Is(err, ErrNotEPUB) {
			t.Errorf("%s: err = %v", name, err)
		}
	}
}

func TestABookWithNoTextSaysSo(t *testing.T) {
	empty := `<html xmlns="http://www.w3.org/1999/xhtml"><body><img src="a.png"/></body></html>`
	b := epubOf(t,
		entry{"META-INF/container.xml", container},
		entry{"OEBPS/content.opf", `<package xmlns="http://www.idpf.org/2007/opf"><manifest><item id="a" href="a.xhtml"/></manifest><spine><itemref idref="a"/></spine></package>`},
		entry{"OEBPS/a.xhtml", empty})
	if _, err := Read(b); !errors.Is(err, ErrNoText) {
		t.Fatalf("err = %v", err)
	}
}

// A small file that inflates to a huge one answers an error and does not exhaust
// memory: the bound is on what is inflated, not on what the header claims.
func TestAnEntryThatInflatesPastTheBoundIsRefused(t *testing.T) {
	huge := strings.Repeat("a", maxEntryBytes+10)
	b := epubOf(t,
		entry{"META-INF/container.xml", container},
		entry{"OEBPS/content.opf", opf},
		entry{"OEBPS/text/ch1.xhtml", "<p>" + huge + "</p>"})
	if _, err := Read(b); err == nil || !errors.Is(err, ErrNotEPUB) && !errors.Is(err, ErrNoText) {
		// The oversized chapter is skipped like any unreadable spine item, which
		// leaves no text; either refusal is an acceptable, bounded answer.
		t.Fatalf("err = %v", err)
	}
}

func TestMetaReadsTitleCreatorAndIdentifiersFromThePackageAlone(t *testing.T) {
	// The real novel's metadata shape: a long subtitle'd title, a creator, an ISBN and an
	// ASIN each labelled differently, and a calibre uuid that is neither.
	pkg := `<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf" version="2.0">
 <metadata>
  <dc:title>Dust of Dreams: The Malazan Book of the Fallen 9</dc:title>
  <dc:creator opf:role="aut">Steven Erikson</dc:creator>
  <dc:identifier opf:scheme="ISBN">9781409091530</dc:identifier>
  <dc:identifier opf:scheme="MOBI-ASIN">B003QXMYUC</dc:identifier>
  <dc:identifier opf:scheme="calibre">3f2b9c1e-0000-4000-8000-123456789abc</dc:identifier>
  <dc:identifier>urn:isbn:978-1-4090-9153-0</dc:identifier>
 </metadata>
 <manifest/><spine/>
</package>`
	b := epubOf(t, entry{"META-INF/container.xml", container}, entry{"OEBPS/content.opf", pkg})
	m, err := ReadMeta(b)
	if err != nil {
		t.Fatal(err)
	}
	if m.Title != "Dust of Dreams: The Malazan Book of the Fallen 9" || m.Creator != "Steven Erikson" {
		t.Fatalf("%+v", m)
	}
	if len(m.ISBNs) != 2 || m.ISBNs[0] != "9781409091530" || m.ISBNs[1] != "9781409091530" {
		t.Fatalf("ISBNs: %+v", m.ISBNs)
	}
	if len(m.ASINs) != 1 || m.ASINs[0] != "B003QXMYUC" {
		t.Fatalf("ASINs: %+v", m.ASINs)
	}
	if _, err := ReadMeta([]byte("not a zip")); !errors.Is(err, ErrNotEPUB) {
		t.Fatalf("err = %v", err)
	}
}

func TestMetaAlsoReadsThePublisherYearSeriesSubjectsAndPlainTextDescription(t *testing.T) {
	pkg := `<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf" xmlns:dc="http://purl.org/dc/elements/1.1/" version="2.0">
 <metadata>
  <dc:title>Dust of Dreams</dc:title>
  <dc:publisher>Bantam Press</dc:publisher>
  <dc:language>en</dc:language>
  <dc:date>2009-09-22T00:00:00+00:00</dc:date>
  <dc:subject>Fantasy</dc:subject>
  <dc:subject>Epic</dc:subject>
  <dc:description>&lt;p&gt;The &lt;b&gt;ninth&lt;/b&gt; book&amp;nbsp;of the series.&lt;/p&gt;</dc:description>
  <meta name="calibre:series" content="The Malazan Book of the Fallen"/>
  <meta name="calibre:series_index" content="9.0"/>
 </metadata>
 <manifest/><spine/>
</package>`
	m, err := ReadMeta(epubOf(t, entry{"META-INF/container.xml", container}, entry{"OEBPS/content.opf", pkg}))
	if err != nil {
		t.Fatal(err)
	}
	if m.Publisher != "Bantam Press" || m.Language != "en" || m.Year != 2009 {
		t.Fatalf("%+v", m)
	}
	if len(m.Subjects) != 2 || m.Subjects[0] != "Fantasy" || m.Subjects[1] != "Epic" {
		t.Fatalf("subjects %+v", m.Subjects)
	}
	if m.Description != "The ninth book of the series." {
		t.Fatalf("a description arrives as markup and must be text: %q", m.Description)
	}
	if m.Series != "The Malazan Book of the Fallen" || m.SeriesIndex != 9 {
		t.Fatalf("series %q #%v", m.Series, m.SeriesIndex)
	}
}

func TestMetaReadsAnEPUB3Collection(t *testing.T) {
	pkg := `<package xmlns="http://www.idpf.org/2007/opf" xmlns:dc="http://purl.org/dc/elements/1.1/" version="3.0"><metadata>
  <dc:title>Book Three</dc:title>
  <meta property="belongs-to-collection" id="c1">Discworld</meta>
  <meta refines="#c1" property="group-position">3</meta>
 </metadata><manifest/><spine/></package>`
	m, err := ReadMeta(epubOf(t, entry{"META-INF/container.xml", container}, entry{"OEBPS/content.opf", pkg}))
	if err != nil || m.Series != "Discworld" || m.SeriesIndex != 3 {
		t.Fatalf("%+v %v", m, err)
	}
}
