package ebook

// Every PDF here is built in the test, from a few lines of helper, so there is no binary
// fixture and no network. The helper writes a real xref table, which is what makes the
// "damaged xref" cases honest: they start from a file that was valid.

import (
	"bytes"
	"compress/zlib"
	"errors"
	"fmt"
	"math/rand"
	"strings"
	"testing"
)

type pdfB struct {
	buf  bytes.Buffer
	offs []int
}

func newPDFB() *pdfB {
	b := &pdfB{}
	b.buf.WriteString("%PDF-1.7\n")
	return b
}

// obj appends an object. Numbers are sequential from 1, so the caller counts.
func (b *pdfB) obj(body string) int {
	b.offs = append(b.offs, b.buf.Len())
	n := len(b.offs)
	fmt.Fprintf(&b.buf, "%d 0 obj\n%s\nendobj\n", n, body)
	return n
}

func (b *pdfB) stream(dict string, data []byte) int {
	return b.obj(fmt.Sprintf("<< %s /Length %d >>\nstream\n%s\nendstream", dict, len(data), data))
}

func (b *pdfB) finish(trailer string) []byte {
	x := b.buf.Len()
	fmt.Fprintf(&b.buf, "xref\n0 %d\n0000000000 65535 f \n", len(b.offs)+1)
	for _, o := range b.offs {
		fmt.Fprintf(&b.buf, "%010d 00000 n \n", o)
	}
	fmt.Fprintf(&b.buf, "trailer\n<< /Size %d /Root 1 0 R %s >>\nstartxref\n%d\n%%%%EOF\n", len(b.offs)+1, trailer, x)
	return b.buf.Bytes()
}

type pageSpec struct {
	dict string // the content stream's own entries, such as a /Filter
	data []byte
}

// buildPDF writes a catalog (1), a page tree (2) that holds the font resources, a
// Helvetica font (3), then a page and its content stream for each spec (4, 5, 6, 7 ...).
// extra may add objects after those and return trailer entries.
func buildPDF(specs []pageSpec, extra func(b *pdfB) string) []byte {
	b := newPDFB()
	b.obj("<< /Type /Catalog /Pages 2 0 R /Lang (en) >>")
	var kids []string
	for i := range specs {
		kids = append(kids, fmt.Sprintf("%d 0 R", 4+2*i))
	}
	b.obj(fmt.Sprintf("<< /Type /Pages /Kids [%s] /Count %d /Resources << /Font << /F1 3 0 R >> >> >>",
		strings.Join(kids, " "), len(specs)))
	b.obj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>")
	for i, s := range specs {
		b.obj(fmt.Sprintf("<< /Type /Page /Parent 2 0 R /Contents %d 0 R >>", 5+2*i))
		b.stream(s.dict, s.data)
	}
	trailer := ""
	if extra != nil {
		trailer = extra(b)
	}
	return b.finish(trailer)
}

func textPDF(contents ...string) []byte {
	var specs []pageSpec
	for _, c := range contents {
		specs = append(specs, pageSpec{data: []byte(c)})
	}
	return buildPDF(specs, nil)
}

func pdfLine(y int, s string) string { return fmt.Sprintf("BT /F1 12 Tf 72 %d Td (%s) Tj ET\n", y, s) }

func pdfTexts(ps []Paragraph) []string {
	var out []string
	for _, p := range ps {
		out = append(out, p.Text)
	}
	return out
}

func pdfDeflate(b []byte) []byte {
	var out bytes.Buffer
	zw := zlib.NewWriter(&out)
	zw.Write(b)
	zw.Close()
	return out.Bytes()
}

func mustReadPDF(t *testing.T, data []byte) []Paragraph {
	t.Helper()
	ps, err := ReadPDF(data)
	if err != nil {
		t.Fatalf("ReadPDF: %v", err)
	}
	return ps
}

func TestAOnePagePDFReadsAsOneParagraph(t *testing.T) {
	ps := mustReadPDF(t, textPDF(pdfLine(700, "Hello world")))
	if len(ps) != 1 || ps[0].Text != "Hello world" || ps[0].Doc != 0 || ps[0].Chapter != "" || ps[0].Percent != 0 {
		t.Fatalf("got %+v", ps)
	}
}

func TestBytesBeforeThePDFHeaderDoNotShiftTheOffsets(t *testing.T) {
	data := append([]byte("some mail wrapper\r\n"), textPDF(pdfLine(700, "Hello"))...)
	if got := pdfTexts(mustReadPDF(t, data)); len(got) != 1 || got[0] != "Hello" {
		t.Fatalf("got %q", got)
	}
}

func TestDocIsThePageIndexAndChapterIsTheNearestPrecedingBookmark(t *testing.T) {
	b := newPDFB()
	b.obj("<< /Type /Catalog /Pages 2 0 R /Outlines 3 0 R /Dests << /ch2 [11 0 R /Fit] >> >>")
	b.obj("<< /Type /Pages /Kids [7 0 R 9 0 R 11 0 R] /Count 3 /Resources << /Font << /F1 6 0 R >> >> >>")
	b.obj("<< /Type /Outlines /First 4 0 R /Last 5 0 R /Count 2 >>")
	b.obj("<< /Title (Chapter One) /Parent 3 0 R /Next 5 0 R /Dest [7 0 R /Fit] >>")
	b.obj("<< /Title <FEFF0043006800200032> /Parent 3 0 R /Prev 4 0 R /A << /S /GoTo /D /ch2 >> >>")
	b.obj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
	for i, s := range []string{"first page", "second page", "third page"} {
		b.obj(fmt.Sprintf("<< /Type /Page /Parent 2 0 R /Contents %d 0 R >>", 8+2*i))
		b.stream("", []byte(pdfLine(700, s)))
	}
	ps := mustReadPDF(t, b.finish(""))
	want := []struct {
		text, chapter string
		doc           int
	}{{"first page", "Chapter One", 0}, {"second page", "Chapter One", 1}, {"third page", "Ch 2", 2}}
	if len(ps) != len(want) {
		t.Fatalf("got %+v", ps)
	}
	for i, w := range want {
		if ps[i].Text != w.text || ps[i].Chapter != w.chapter || ps[i].Doc != w.doc {
			t.Errorf("paragraph %d = %+v, want %+v", i, ps[i], w)
		}
	}
}

func TestPercentIsTheShareOfRunesBeforeAParagraph(t *testing.T) {
	// 10, 10 and 20 runes: 0/40, 10/40 and 20/40.
	ps := mustReadPDF(t, textPDF(
		pdfLine(700, "0123456789")+pdfLine(600, "ABCDEFGHIJ"),
		pdfLine(700, "abcdefghijklmnopqrst")))
	if len(ps) != 3 {
		t.Fatalf("got %+v", ps)
	}
	for i, want := range []int{0, 25, 50} {
		if ps[i].Percent != want {
			t.Errorf("paragraph %d starts at %d%%, want %d%%", i, ps[i].Percent, want)
		}
	}
	if ps[2].Doc != 1 {
		t.Errorf("the third paragraph is on page %d, want 1", ps[2].Doc)
	}
}

func TestACrossReferenceStreamWithAnObjectStreamIsRead(t *testing.T) {
	var buf bytes.Buffer
	buf.WriteString("%PDF-1.5\n")
	objs := []string{
		"<< /Type /Catalog /Pages 2 0 R >>",
		"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
		"<< /Type /Page /Parent 2 0 R /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
		"<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman /Encoding /WinAnsiEncoding >>",
	}
	nums := []int{1, 2, 3, 5}
	var header, body strings.Builder
	for i, o := range objs {
		fmt.Fprintf(&header, "%d %d ", nums[i], body.Len())
		body.WriteString(o + " ")
	}
	stm := pdfDeflate([]byte(header.String() + body.String()))
	content := []byte(pdfLine(700, "From an object stream"))

	off4 := buf.Len()
	fmt.Fprintf(&buf, "4 0 obj\n<< /Length %d >>\nstream\n%s\nendstream\nendobj\n", len(content), content)
	off6 := buf.Len()
	fmt.Fprintf(&buf, "6 0 obj\n<< /Type /ObjStm /N 4 /First %d /Filter /FlateDecode /Length %d >>\nstream\n", header.Len(), len(stm))
	buf.Write(stm)
	buf.WriteString("\nendstream\nendobj\n")
	off7 := buf.Len()

	row := func(t int, f2 int, f3 int) []byte {
		return []byte{byte(t), byte(f2 >> 24), byte(f2 >> 16), byte(f2 >> 8), byte(f2), byte(f3 >> 8), byte(f3)}
	}
	rows := [][]byte{
		row(0, 0, 0xFFFF), row(2, 6, 0), row(2, 6, 1), row(2, 6, 2), row(1, off4, 0),
		row(2, 6, 3), row(1, off6, 0), row(1, off7, 0),
	}
	// PNG "Up" predictor, as real writers use for xref streams.
	var raw []byte
	prev := make([]byte, 7)
	for _, r := range rows {
		raw = append(raw, 2)
		for i := range r {
			raw = append(raw, r[i]-prev[i])
		}
		prev = r
	}
	xs := pdfDeflate(raw)
	fmt.Fprintf(&buf, "7 0 obj\n<< /Type /XRef /Size 8 /W [1 4 2] /Root 1 0 R /Filter /FlateDecode "+
		"/DecodeParms << /Predictor 12 /Columns 7 >> /Length %d >>\nstream\n", len(xs))
	buf.Write(xs)
	fmt.Fprintf(&buf, "\nendstream\nendobj\nstartxref\n%d\n%%%%EOF\n", off7)

	ps := mustReadPDF(t, buf.Bytes())
	if len(ps) != 1 || ps[0].Text != "From an object stream" {
		t.Fatalf("got %+v", ps)
	}
}

func TestAFlateCompressedContentStreamIsRead(t *testing.T) {
	data := buildPDF([]pageSpec{{dict: "/Filter /FlateDecode", data: pdfDeflate([]byte(pdfLine(700, "Squeezed")))}}, nil)
	if got := pdfTexts(mustReadPDF(t, data)); len(got) != 1 || got[0] != "Squeezed" {
		t.Fatalf("got %q", got)
	}
}

func TestASCIIHexASCII85AndLZWContentStreamsAreRead(t *testing.T) {
	content := []byte(pdfLine(700, "Filtered"))
	hex := []byte(fmt.Sprintf("%X>", content))
	data := buildPDF([]pageSpec{
		{dict: "/Filter /ASCIIHexDecode", data: hex},
		{dict: "/Filter /ASCII85Decode", data: ascii85Encode(content)},
		{dict: "/Filter /LZWDecode", data: lzwEncode(content)},
		{dict: "/Filter [/ASCIIHexDecode /FlateDecode]", data: []byte(fmt.Sprintf("%X>", pdfDeflate(content)))},
	}, nil)
	ps := mustReadPDF(t, data)
	if len(ps) != 4 {
		t.Fatalf("got %+v", ps)
	}
	for i, p := range ps {
		if p.Text != "Filtered" || p.Doc != i {
			t.Errorf("page %d = %+v", i, p)
		}
	}
}

func TestLZWDecodesTheExampleInThePDFSpecification(t *testing.T) {
	got, err := lzwDecode([]byte{0x80, 0x0B, 0x60, 0x50, 0x22, 0x0C, 0x0C, 0x85, 0x01}, 1)
	want := []byte{45, 45, 45, 45, 45, 65, 45, 45, 45, 66}
	if err != nil || !bytes.Equal(got, want) {
		t.Fatalf("got %v, %v", got, err)
	}
}

func TestLongLZWDataRoundTripsAcrossTheCodeWidthChanges(t *testing.T) {
	var in []byte
	rng := rand.New(rand.NewSource(1))
	for len(in) < 20000 {
		in = append(in, "BT (abc) Tj ET "[rng.Intn(15)], byte('a'+rng.Intn(6)))
	}
	got, err := lzwDecode(lzwEncode(in), 1)
	if err != nil || !bytes.Equal(got, in) {
		t.Fatalf("round trip failed: %v (%d bytes back, %d sent)", err, len(got), len(in))
	}
}

func TestAToUnicodeCMapDecodesBengaliCyrillicDevanagariCJKAndSurrogatePairs(t *testing.T) {
	cmap := `/CIDInit /ProcSet findresource begin 12 dict begin begincmap
1 begincodespacerange <0000> <FFFF> endcodespacerange
3 beginbfchar <0001> <09AC> <0002> <09BE> <0003> <0982> endbfchar
1 beginbfchar <0004> <09B2> endbfchar
1 beginbfrange <0010> <0015> [<041F> <0440> <0438> <0432> <0435> <0442>] endbfrange
1 beginbfrange <0020> <0022> <0905> endbfrange
2 beginbfchar <0040> <4E2D> <0041> <6587> endbfchar
1 beginbfchar <0050> <D83DDE00> endbfchar
endcmap end end`
	b := newPDFB()
	b.obj("<< /Type /Catalog /Pages 2 0 R >>")
	b.obj("<< /Type /Pages /Kids [4 0 R] /Count 1 /Resources << /Font << /F1 3 0 R >> >> >>")
	b.obj("<< /Type /Font /Subtype /Type0 /BaseFont /X /Encoding /Identity-H " +
		"/DescendantFonts [<< /Type /Font /Subtype /CIDFontType2 >>] /ToUnicode 6 0 R >>")
	b.obj("<< /Type /Page /Parent 2 0 R /Contents 5 0 R >>")
	var c strings.Builder
	c.WriteString("BT /F1 12 Tf 72 700 Td <00010002000300040002> Tj ET\n")
	for i, h := range []string{"<001000110012001300140015>", "<002000210022>", "<00400041>", "<0050>"} {
		fmt.Fprintf(&c, "BT /F1 12 Tf 72 %d Td %s Tj ET\n", 650-50*i, h)
	}
	b.stream("", []byte(c.String()))
	b.stream("", []byte(cmap))
	got := pdfTexts(mustReadPDF(t, b.finish("")))
	want := []string{"বাংলা", "Привет", "अआइ", "中文", "\U0001F600"}
	if strings.Join(got, "|") != strings.Join(want, "|") {
		t.Fatalf("got %q, want %q", got, want)
	}
}

func TestEncodingsAndGlyphNamesDecodeOneByteFonts(t *testing.T) {
	b := newPDFB()
	b.obj("<< /Type /Catalog /Pages 2 0 R >>")
	b.obj("<< /Type /Pages /Kids [6 0 R] /Count 1 /Resources << /Font << /A 3 0 R /M 4 0 R /N 5 0 R >> >> >>")
	b.obj("<< /Type /Font /Subtype /Type1 /Encoding << /BaseEncoding /WinAnsiEncoding /Differences [65 /eacute /uni0985 /f_i] >> >>")
	b.obj("<< /Type /Font /Subtype /Type1 /Encoding /MacRomanEncoding >>")
	b.obj("<< /Type /Font /Subtype /Type1 >>")
	b.obj("<< /Type /Page /Parent 2 0 R /Contents 7 0 R >>")
	b.stream("", []byte("BT /A 12 Tf 72 700 Td (ABC\\200) Tj ET\nBT /M 12 Tf 72 600 Td (\\216) Tj ET\nBT /N 12 Tf 72 500 Td (\\351) Tj ET\n"))
	got := pdfTexts(mustReadPDF(t, b.finish("")))
	want := []string{"éঅfi€", "é", "é"}
	if strings.Join(got, "|") != strings.Join(want, "|") {
		t.Fatalf("got %q, want %q", got, want)
	}
}

func TestLinesJoinWithASpaceAndAGapStartsANewParagraph(t *testing.T) {
	got := pdfTexts(mustReadPDF(t, textPDF(pdfLine(700, "one two")+pdfLine(686, "three four")+pdfLine(640, "next paragraph"))))
	if len(got) != 2 || got[0] != "one two three four" || got[1] != "next paragraph" {
		t.Fatalf("got %q", got)
	}
}

func TestAHyphenAtALineEndIsJoinedOnlyBeforeALowerCaseLetter(t *testing.T) {
	got := pdfTexts(mustReadPDF(t, textPDF(pdfLine(700, "An inter-")+pdfLine(686, "national agreement is well-")+pdfLine(672, "Known here"))))
	if len(got) != 1 || got[0] != "An international agreement is well- Known here" {
		t.Fatalf("got %q", got)
	}
}

func TestATJKerningBelowMinusTwoHundredIsASpace(t *testing.T) {
	got := pdfTexts(mustReadPDF(t, textPDF("BT /F1 12 Tf 72 700 Td [(Wo) -20 (rd) -300 (two)] TJ ET\n")))
	if len(got) != 1 || got[0] != "Word two" {
		t.Fatalf("got %q", got)
	}
}

func TestTheLineOperatorsMoveToTheNextLine(t *testing.T) {
	got := pdfTexts(mustReadPDF(t, textPDF("BT /F1 12 Tf 14 TL 72 700 Td (first) Tj T* (second) Tj (third) ' ET\n")))
	if len(got) != 1 || got[0] != "first second third" {
		t.Fatalf("got %q", got)
	}
}

func TestTheNewestDefinitionOfAnObjectWinsAfterAnIncrementalUpdate(t *testing.T) {
	base := textPDF(pdfLine(700, "old text"))
	prev := bytes.LastIndex(base, []byte("startxref"))
	var oldOff int
	fmt.Sscanf(string(base[prev+len("startxref"):]), "%d", &oldOff)
	content := pdfLine(700, "new text")
	var up bytes.Buffer
	up.Write(base)
	off := up.Len()
	fmt.Fprintf(&up, "5 0 obj\n<< /Length %d >>\nstream\n%s\nendstream\nendobj\n", len(content), content)
	x := up.Len()
	fmt.Fprintf(&up, "xref\n5 1\n%010d 00000 n \ntrailer\n<< /Size 6 /Root 1 0 R /Prev %d >>\nstartxref\n%d\n%%%%EOF\n", off, oldOff, x)
	if got := pdfTexts(mustReadPDF(t, up.Bytes())); len(got) != 1 || got[0] != "new text" {
		t.Fatalf("got %q", got)
	}
}

func TestADamagedXrefFallsBackToScanningForObjects(t *testing.T) {
	good := textPDF(pdfLine(700, "first"), pdfLine(700, "second"))
	for name, bad := range map[string][]byte{
		"wrong startxref":    bytes.Replace(good, []byte("startxref\n"), []byte("startxref\n99"), 1),
		"table keyword lost": bytes.Replace(good, []byte("xref\n0 "), []byte("xxxx\n0 "), 1),
		"tail cut off":       good[:len(good)-60],
	} {
		got := pdfTexts(mustReadPDF(t, bad))
		if len(got) != 2 || got[0] != "first" || got[1] != "second" {
			t.Errorf("%s: got %q", name, got)
		}
	}
}

func TestAPageTreeThatLoopsBackOnItselfStillEnds(t *testing.T) {
	b := newPDFB()
	b.obj("<< /Type /Catalog /Pages 2 0 R >>")
	b.obj("<< /Type /Pages /Kids [2 0 R 3 0 R] /Count 1 /Resources << /Font << /F1 4 0 R >> >> >>")
	b.obj("<< /Type /Page /Parent 2 0 R /Contents 5 0 R >>")
	b.obj("<< /Type /Font /Subtype /Type1 >>")
	b.stream("", []byte(pdfLine(700, "survived")))
	if got := pdfTexts(mustReadPDF(t, b.finish(""))); len(got) != 1 || got[0] != "survived" {
		t.Fatalf("got %q", got)
	}
}

func TestAPageWithAnUnsupportedFilterIsSkippedAndTheRestIsRead(t *testing.T) {
	data := buildPDF([]pageSpec{
		{dict: "/Filter /DCTDecode", data: []byte("\xff\xd8\xff\xe0 not text")},
		{data: []byte(pdfLine(700, "kept"))},
	}, nil)
	ps := mustReadPDF(t, data)
	if len(ps) != 1 || ps[0].Text != "kept" || ps[0].Doc != 1 {
		t.Fatalf("got %+v", ps)
	}
}

func TestFormXObjectTextIsRead(t *testing.T) {
	b := newPDFB()
	b.obj("<< /Type /Catalog /Pages 2 0 R >>")
	b.obj("<< /Type /Pages /Kids [3 0 R] /Count 1 >>")
	b.obj("<< /Type /Page /Parent 2 0 R /Contents 4 0 R /Resources << /XObject << /Fm 5 0 R >> >> >>")
	b.stream("", []byte("q 1 0 0 1 0 0 cm /Fm Do Q"))
	b.stream("/Type /XObject /Subtype /Form /BBox [0 0 600 800] /Resources << /Font << /F1 6 0 R >> >>", []byte(pdfLine(700, "in a form")))
	b.obj("<< /Type /Font /Subtype /Type1 >>")
	if got := pdfTexts(mustReadPDF(t, b.finish(""))); len(got) != 1 || got[0] != "in a form" {
		t.Fatalf("got %q", got)
	}
}

func TestAnEncryptedPDFIsRefusedByName(t *testing.T) {
	data := buildPDF([]pageSpec{{data: []byte(pdfLine(700, "secret"))}}, func(b *pdfB) string {
		b.obj("<< /Filter /Standard /V 2 /R 3 /O (x) /U (y) /P -4 >>")
		return "/Encrypt 6 0 R"
	})
	if _, err := ReadPDF(data); !errors.Is(err, ErrDRM) {
		t.Fatalf("ReadPDF error = %v, want ErrDRM", err)
	}
	if _, err := ReadPDFMeta(data); !errors.Is(err, ErrDRM) {
		t.Fatalf("ReadPDFMeta error = %v, want ErrDRM", err)
	}
}

func TestAnImageOnlyPDFSaysItHasNoTextLayer(t *testing.T) {
	data := textPDF("q 600 0 0 800 0 0 cm /Im0 Do Q\n", "")
	_, err := ReadPDF(data)
	if !errors.Is(err, ErrNoText) || !strings.Contains(err.Error(), "no text layer") {
		t.Fatalf("error = %v, want ErrNoText naming the text layer", err)
	}
}

func TestSomethingThatIsNotAPDFIsRefusedAndNeverPanics(t *testing.T) {
	junk := make([]byte, 2000)
	rand.New(rand.NewSource(7)).Read(junk)
	for name, data := range map[string][]byte{
		"nil":             nil,
		"words":           []byte("hello world"),
		"header only":     []byte("%PDF-1.4\n"),
		"junk":            junk,
		"junk after head": append([]byte("%PDF-1.4\n"), junk...),
		"zip":             []byte("PK\x03\x04 not a pdf"),
	} {
		if _, err := ReadPDF(data); !errors.Is(err, ErrNotPDF) {
			t.Errorf("%s: ReadPDF error = %v, want ErrNotPDF", name, err)
		}
		if _, err := ReadPDFMeta(data); !errors.Is(err, ErrNotPDF) {
			t.Errorf("%s: ReadPDFMeta error = %v, want ErrNotPDF", name, err)
		}
	}
}

func TestATruncatedPDFNeverPanics(t *testing.T) {
	whole := buildPDF([]pageSpec{
		{dict: "/Filter /FlateDecode", data: pdfDeflate([]byte(pdfLine(700, "a page of text")))},
		{data: []byte(pdfLine(700, "another"))},
	}, nil)
	for n := 0; n < len(whole); n += 5 {
		ReadPDF(whole[:n])
		ReadPDFMeta(whole[:n])
	}
}

func TestADecompressionBombIsAnErrorNotMemoryExhaustion(t *testing.T) {
	zeros := make([]byte, 1<<20)
	var packed bytes.Buffer
	zw, _ := zlib.NewWriterLevel(&packed, zlib.BestCompression)
	for i := 0; i < maxEntryBytes>>20+6; i++ { // more than one stream may hold
		zw.Write(zeros)
	}
	zw.Close()
	if packed.Len() > 1<<20 {
		t.Fatalf("the bomb is %d bytes, not small", packed.Len())
	}
	_, err := ReadPDF(buildPDF([]pageSpec{{dict: "/Filter /FlateDecode", data: packed.Bytes()}}, nil))
	if !errors.Is(err, ErrNotPDF) {
		t.Fatalf("one oversized stream: error = %v, want ErrNotPDF", err)
	}

	// Each of these is under the per-stream cap; together they pass the per-file one.
	var one bytes.Buffer
	zw, _ = zlib.NewWriterLevel(&one, zlib.BestCompression)
	for i := 0; i < 20; i++ {
		zw.Write(zeros)
	}
	zw.Close()
	b := newPDFB()
	b.obj("<< /Type /Catalog /Pages 2 0 R >>")
	b.obj("<< /Type /Pages /Kids [3 0 R] /Count 1 >>")
	b.obj("<< /Type /Page /Parent 2 0 R /Contents [4 0 R 5 0 R 6 0 R 7 0 R 8 0 R 9 0 R 10 0 R] /Resources << /Font << /F1 11 0 R >> >> >>")
	for i := 0; i < 7; i++ {
		b.stream("/Filter /FlateDecode", one.Bytes())
	}
	b.obj("<< /Type /Font /Subtype /Type1 >>")
	if _, err := ReadPDF(b.finish("")); !errors.Is(err, ErrNotPDF) {
		t.Fatalf("many large streams: error = %v, want ErrNotPDF", err)
	}
}

func TestReadPDFMetaGivesWhatTheInfoDictionaryHolds(t *testing.T) {
	data := buildPDF([]pageSpec{{data: []byte(pdfLine(700, "x"))}}, func(b *pdfB) string {
		b.obj("<< /Title <FEFF09AC09BE098209B209BE> /Author (Steven Erikson) /Subject (A novel) " +
			"/Keywords (fantasy, war; epic) /CreationDate (D:20090203120000Z) /Producer (a converter) >>")
		return "/Info 6 0 R"
	})
	m, err := ReadPDFMeta(data)
	if err != nil {
		t.Fatal(err)
	}
	if m.Title != "বাংলা" || m.Creator != "Steven Erikson" || m.Description != "A novel" || m.Year != 2009 || m.Language != "en" {
		t.Errorf("got %+v", m)
	}
	if strings.Join(m.Subjects, "|") != "fantasy|war|epic" {
		t.Errorf("subjects = %q", m.Subjects)
	}
	if m.Publisher != "" || m.Series != "" || len(m.ISBNs) != 0 {
		t.Errorf("fields a PDF cannot give were filled: %+v", m)
	}
}

func TestReadPDFMetaOfAPDFWithNoInfoIsEmptyNotAnError(t *testing.T) {
	m, err := ReadPDFMeta(textPDF(pdfLine(700, "x")))
	if err != nil || m.Title != "" || m.Creator != "" {
		t.Fatalf("got %+v, %v", m, err)
	}
}

// ascii85Encode is the encoder the reader's decoder is tested against.
func ascii85Encode(b []byte) []byte {
	var out []byte
	for i := 0; i < len(b); i += 4 {
		var g [4]byte
		n := copy(g[:], b[i:])
		v := uint32(g[0])<<24 | uint32(g[1])<<16 | uint32(g[2])<<8 | uint32(g[3])
		var d [5]byte
		for k := 4; k >= 0; k-- {
			d[k] = byte(v%85) + '!'
			v /= 85
		}
		out = append(out, d[:n+1]...)
	}
	return append(out, '~', '>')
}

// lzwEncode is PDF's LZW with the default early change, the encoder the reader's decoder
// is tested against.
func lzwEncode(in []byte) []byte {
	var out []byte
	var acc uint32
	nb := 0
	width, next := 9, 258
	put := func(code int) {
		acc = acc<<uint(width) | uint32(code)
		nb += width
		for nb >= 8 {
			out = append(out, byte(acc>>uint(nb-8)))
			nb -= 8
		}
		acc &= 1<<uint(nb) - 1
	}
	bump := func() {
		switch {
		case next >= 2048:
			width = 12
		case next >= 1024:
			width = 11
		case next >= 512:
			width = 10
		}
	}
	table := map[string]int{}
	code := func(s string) int {
		if len(s) == 1 {
			return int(s[0])
		}
		return table[s]
	}
	put(256)
	cur := ""
	for _, c := range in {
		s := cur + string([]byte{c})
		if _, ok := table[s]; ok || len(s) == 1 {
			cur = s
			continue
		}
		put(code(cur))
		table[s] = next
		next++
		bump()
		cur = s[len(s)-1:]
		if next == 4094 { // before the table fills: clear and start over
			put(256)
			table, next, width = map[string]int{}, 258, 9
		}
	}
	if cur != "" {
		put(code(cur))
		next++
		bump()
	}
	put(257)
	if nb > 0 {
		out = append(out, byte(acc<<uint(8-nb)))
	}
	return out
}

func TestStreamsThatAreNotTextAreNeverInflated(t *testing.T) {
	// 60 MiB of zeros, a few dozen KiB packed: over every cap if it were ever inflated.
	zeros := make([]byte, 1<<20)
	var packed bytes.Buffer
	zw, _ := zlib.NewWriterLevel(&packed, zlib.BestCompression)
	for i := 0; i < 60; i++ {
		zw.Write(zeros)
	}
	zw.Close()
	big := packed.Bytes()

	b := newPDFB()
	b.obj("<< /Type /Catalog /Pages 2 0 R >>")
	b.obj("<< /Type /Pages /Kids [4 0 R 8 0 R] /Count 2 >>")
	// The font carries a huge embedded font program, and the page a huge image.
	b.obj("<< /Type /Font /Subtype /TrueType /BaseFont /X /Encoding /WinAnsiEncoding /FontDescriptor 6 0 R >>")
	b.obj("<< /Type /Page /Parent 2 0 R /Contents 5 0 R /Resources << /Font << /F1 3 0 R >> /XObject << /Im0 7 0 R >> >> >>")
	b.stream("", []byte("q 100 0 0 100 0 0 cm /Im0 Do Q\n"+pdfLine(700, "small but real")))
	b.obj("<< /Type /FontDescriptor /FontName /X /FontFile2 9 0 R >>")
	b.stream("/Type /XObject /Subtype /Image /Width 8192 /Height 8192 /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode", big)
	// A second page with no font and a content stream that is a bomb: it cannot show
	// text, so it is skipped without being inflated.
	b.obj("<< /Type /Page /Parent 2 0 R /Contents 10 0 R /Resources << >> >>")
	b.stream("/Filter /FlateDecode /Length1 100", big)
	b.stream("/Filter /FlateDecode", big)
	ps, err := ReadPDF(b.finish(""))
	if err != nil || len(ps) != 1 || ps[0].Text != "small but real" {
		t.Fatalf("got %+v, %v", ps, err)
	}
}

func TestAPageThatDrawsAFormManyTimesInflatesItOnce(t *testing.T) {
	var c strings.Builder
	for i := 0; i < 50; i++ {
		c.WriteString("/Fm Do\n")
	}
	form := []byte(pdfLine(700, "x") + strings.Repeat("% padding to make the form large\n", 1<<17))
	b := newPDFB()
	b.obj("<< /Type /Catalog /Pages 2 0 R >>")
	b.obj("<< /Type /Pages /Kids [3 0 R] /Count 1 >>")
	b.obj("<< /Type /Page /Parent 2 0 R /Contents 4 0 R /Resources << /XObject << /Fm 5 0 R >> >> >>")
	b.stream("", []byte(c.String()))
	b.stream("/Type /XObject /Subtype /Form /Resources << /Font << /F1 6 0 R >> >>", form)
	b.obj("<< /Type /Font /Subtype /Type1 >>")
	ps, err := ReadPDF(b.finish(""))
	if err != nil || len(ps) == 0 {
		t.Fatalf("got %+v, %v", ps, err)
	}
}
