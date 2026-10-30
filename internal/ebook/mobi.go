package ebook

// MOBI, AZW and AZW3: the Kindle ebook, read into the same paragraphs an EPUB gives.
//
// All three are one container, a Palm database: a table of records, of which record 0
// holds the headers and the next run holds the book's text, compressed. AZW3 is KF8, the
// newer markup, in the same container. Reading it is three steps and nothing more:
//
//  1. refuse by name what cannot be read (the header says "encrypted", or the text is
//     compressed in a way this reader does not do);
//  2. join the text records, undoing the compression;
//  3. cut the markup into paragraphs with the same rules as an EPUB's.
//
// WHAT IS SUPPORTED, measured on the owner's own files (40 AZW3 from a Calibre library):
// uncompressed and PalmDOC compression, which is what Calibre and Amazon both write.
// HUFF/CDIC, the dictionary compression some older MOBI use, is detected and refused with
// that name rather than read wrongly. DRM is a header field and is refused at the header.
//
// WHAT IS NOT DONE, stated because "reads AZW3" sounds like more: no table-of-contents
// index (the INDX records) is parsed, so a chapter is the nearest heading in the text, not
// the title the contents list gives it. KFX, Amazon's newest container, is another format
// altogether and is not recognised. Nothing is rendered and nothing is written to disk.

import (
	"bytes"
	"encoding/binary"
	"errors"
	"fmt"
	"html"
	"io"
	"strconv"
	"strings"
	"unicode/utf8"
)

var (
	// ErrNotMOBI is a file that is not a readable Palm-database ebook.
	ErrNotMOBI = errors.New("ebook: not a readable MOBI or AZW file")
	// ErrUnsupported is a MOBI whose text uses a compression this reader does not do.
	ErrUnsupported = errors.New("ebook: the text uses a compression that cannot be read")
)

// The compression values of the PalmDOC header.
const (
	compNone   = 1
	compPalm   = 2
	compHuffCD = 17480
)

// IsMOBI reports whether data starts like a Palm-database ebook: the type and creator
// ("BOOKMOBI") sit at a fixed place in the first 68 bytes.
func IsMOBI(data []byte) bool {
	return len(data) >= 68 && string(data[60:68]) == "BOOKMOBI"
}

// mobiFile is the part of a MOBI that is read before any text is: where the records are
// and what record 0 says.
type mobiFile struct {
	data    []byte
	offsets []int // each record's start, plus a last entry for the end of the file
	rec0    []byte
}

func (m *mobiFile) record(i int) ([]byte, bool) {
	if i < 0 || i+1 >= len(m.offsets) {
		return nil, false
	}
	return m.data[m.offsets[i]:m.offsets[i+1]], true
}

func openMOBI(data []byte) (*mobiFile, error) {
	if !IsMOBI(data) {
		return nil, ErrNotMOBI
	}
	n := int(binary.BigEndian.Uint16(data[76:78]))
	if n < 2 || 78+8*n > len(data) {
		return nil, fmt.Errorf("%w: the record table is broken", ErrNotMOBI)
	}
	m := &mobiFile{data: data, offsets: make([]int, n+1)}
	for i := 0; i < n; i++ {
		off := int(binary.BigEndian.Uint32(data[78+8*i:]))
		if off < 78+8*n || off > len(data) || (i > 0 && off < m.offsets[i-1]) {
			return nil, fmt.Errorf("%w: record %d starts outside the file", ErrNotMOBI, i)
		}
		m.offsets[i] = off
	}
	m.offsets[n] = len(data)
	m.rec0, _ = m.record(0)
	if len(m.rec0) < 32 {
		return nil, fmt.Errorf("%w: the header record is too short", ErrNotMOBI)
	}
	return m, nil
}

// Bounds on what one file may cost to read, as for an EPUB.
const maxMOBIText = maxTotalBytes

// ReadMOBI reads a MOBI, AZW or AZW3 into paragraphs, in reading order. Doc is the
// section of the markup a paragraph sits in (an XHTML file's start in KF8, a page break
// in the older format), which is what the context cutter will not cross. Chapter is the
// nearest heading before it.
func ReadMOBI(data []byte) ([]Paragraph, error) {
	m, err := openMOBI(data)
	if err != nil {
		return nil, err
	}
	rec0 := m.rec0
	compression := int(binary.BigEndian.Uint16(rec0[0:2]))
	textLen := int(binary.BigEndian.Uint32(rec0[4:8]))
	textRecs := int(binary.BigEndian.Uint16(rec0[8:10]))
	if enc := binary.BigEndian.Uint16(rec0[12:14]); enc != 0 {
		return nil, ErrDRM
	}
	switch compression {
	case compNone, compPalm:
	case compHuffCD:
		return nil, fmt.Errorf("%w: HUFF/CDIC", ErrUnsupported)
	default:
		return nil, fmt.Errorf("%w: type %d", ErrUnsupported, compression)
	}
	if textLen <= 0 || textLen > maxMOBIText {
		return nil, fmt.Errorf("%w: the book is too large to read", ErrNotMOBI)
	}

	hdr := mobiHeader(rec0)
	extra := hdr.extraFlags
	var text bytes.Buffer
	for i := 1; i <= textRecs; i++ {
		rec, ok := m.record(i)
		if !ok {
			break
		}
		rec = rec[:len(rec)-trailingSize(rec, extra)]
		if compression == compPalm {
			if err := palmInflate(&text, rec); err != nil {
				return nil, fmt.Errorf("%w: %v", ErrNotMOBI, err)
			}
		} else {
			text.Write(rec)
		}
		if text.Len() > maxMOBIText {
			return nil, fmt.Errorf("%w: the book is too large to read", ErrNotMOBI)
		}
	}
	raw := text.Bytes()
	if len(raw) > textLen {
		raw = raw[:textLen]
	}
	// KF8 appends its other flows (style sheets, vector art) after the markup. They are
	// text too and would read as prose, so the text is cut where the first flow ends.
	if end, ok := m.firstFlowEnd(hdr); ok && end > 0 && end < len(raw) {
		raw = raw[:end]
	}

	var markup string
	switch hdr.codepage {
	case 1252:
		markup = decodeCP1252(raw)
	default: // 65001, and anything unnamed: UTF-8, with the bad bytes made visible
		markup = strings.ToValidUTF8(string(raw), "�")
	}
	out := markupParagraphs(markup)
	if len(out) == 0 {
		return nil, ErrNoText
	}
	setPercents(out)
	return out, nil
}

// header holds the few MOBI header fields the reader needs.
type mobiHdr struct {
	codepage   int
	extraFlags uint16
	version    uint32
	fdstIndex  int
	fdstCount  int
	length     int
	exth       bool
}

// mobiHeader reads the fields it needs from record 0, each only if the header is long
// enough to hold it: the MOBI header has grown over the years and an old file is short.
func mobiHeader(rec0 []byte) mobiHdr {
	h := mobiHdr{codepage: 1252, fdstIndex: -1}
	u32 := func(off int) (uint32, bool) {
		if off+4 > len(rec0) {
			return 0, false
		}
		return binary.BigEndian.Uint32(rec0[off:]), true
	}
	if string(rec0[16:min(20, len(rec0))]) != "MOBI" {
		return h
	}
	if v, ok := u32(20); ok {
		h.length = int(v)
	}
	if v, ok := u32(28); ok {
		h.codepage = int(v)
	}
	if v, ok := u32(36); ok {
		h.version = v
	}
	if v, ok := u32(0x80); ok {
		h.exth = v&0x40 != 0
	}
	if h.length >= 228 && len(rec0) >= 0xF4 {
		h.extraFlags = binary.BigEndian.Uint16(rec0[0xF2:])
	}
	if h.version >= 8 {
		if v, ok := u32(0xC0); ok && v != 0xFFFFFFFF {
			h.fdstIndex = int(v)
		}
		if v, ok := u32(0xC4); ok {
			h.fdstCount = int(v)
		}
	}
	return h
}

// firstFlowEnd answers where the book's markup ends, from the flow table.
func (m *mobiFile) firstFlowEnd(h mobiHdr) (int, bool) {
	if h.fdstIndex < 0 || h.fdstCount < 2 {
		return 0, false
	}
	rec, ok := m.record(h.fdstIndex)
	if !ok || len(rec) < 20 || string(rec[:4]) != "FDST" {
		return 0, false
	}
	first := int(binary.BigEndian.Uint32(rec[4:])) // where the table of (start, end) pairs begins
	if first < 12 || first+8 > len(rec) {
		return 0, false
	}
	return int(binary.BigEndian.Uint32(rec[first+4:])), true
}

// trailingSize is how many bytes at the end of a text record are not text: each set bit
// of the header's flags above the lowest names one trailing entry whose size is stored
// backwards as a variable-length number, and the lowest bit names the overlap of a
// character split across two records.
func trailingSize(rec []byte, flags uint16) int {
	n := 0
	for f := flags >> 1; f != 0; f >>= 1 {
		if f&1 == 0 {
			continue
		}
		n += trailingEntry(rec, len(rec)-n)
	}
	if flags&1 != 0 && len(rec)-n-1 >= 0 {
		n += int(rec[len(rec)-n-1]&3) + 1
	}
	if n > len(rec) {
		return 0
	}
	return n
}

// trailingEntry reads one backward variable-length size ending at rec[end-1].
func trailingEntry(rec []byte, end int) int {
	result, shift := 0, 0
	for end > 0 {
		v := rec[end-1]
		result |= int(v&0x7F) << shift
		shift += 7
		end--
		if v&0x80 != 0 || shift >= 28 {
			break
		}
	}
	return result
}

// palmInflate undoes PalmDOC compression, a byte-oriented LZ77: a literal run, a space
// joined to a character, or a copy from earlier in the same record.
func palmInflate(w *bytes.Buffer, in []byte) error {
	start := w.Len()
	for i := 0; i < len(in); {
		c := in[i]
		i++
		switch {
		case c == 0 || (c >= 0x09 && c <= 0x7F):
			w.WriteByte(c)
		case c >= 0x01 && c <= 0x08:
			if i+int(c) > len(in) {
				return io.ErrUnexpectedEOF
			}
			w.Write(in[i : i+int(c)])
			i += int(c)
		case c >= 0xC0:
			w.WriteByte(' ')
			w.WriteByte(c ^ 0x80)
		default: // 0x80-0xBF: a copy of 3-10 bytes from up to 2047 back
			if i >= len(in) {
				return io.ErrUnexpectedEOF
			}
			pair := int(c)<<8 | int(in[i])
			i++
			dist, n := (pair&0x3FFF)>>3, (pair&7)+3
			if dist == 0 || dist > w.Len()-start {
				return fmt.Errorf("a copy reaches before the record")
			}
			// Byte by byte: the source may overlap what is being written.
			for k := 0; k < n; k++ {
				b := w.Bytes()
				w.WriteByte(b[len(b)-dist])
			}
		}
	}
	return nil
}

// cp1252High maps 0x80-0x9F, where Windows-1252 differs from Latin-1.
var cp1252High = [32]rune{
	0x20AC, 0x81, 0x201A, 0x0192, 0x201E, 0x2026, 0x2020, 0x2021, 0x02C6, 0x2030, 0x0160, 0x2039, 0x0152, 0x8D, 0x017D, 0x8F,
	0x90, 0x2018, 0x2019, 0x201C, 0x201D, 0x2022, 0x2013, 0x2014, 0x02DC, 0x2122, 0x0161, 0x203A, 0x0153, 0x9D, 0x017E, 0x0178,
}

func decodeCP1252(b []byte) string {
	var sb strings.Builder
	sb.Grow(len(b))
	for _, c := range b {
		switch {
		case c < 0x80:
			sb.WriteByte(c)
		case c < 0xA0:
			sb.WriteRune(cp1252High[c-0x80])
		default:
			sb.WriteRune(rune(c))
		}
	}
	return sb.String()
}

// markupParagraphs cuts a book's markup into paragraphs.
//
// MOBI's markup is HTML as the 1990s wrote it (unclosed tags, unquoted attributes,
// Amazon's own `mbp:` elements), which a strict XML decoder gives up on in the middle of
// a book. So this reads tags by hand and trusts nothing about their nesting: a block
// element ends a paragraph, a heading sets the chapter, and the start of an `<html>` or a
// page break starts a new section.
func markupParagraphs(src string) []Paragraph {
	type para struct {
		text    string
		doc     int
		heading int // 1-6 for a heading's text, else 0
	}
	var paras []para
	var cur strings.Builder
	doc, level, skip := 0, 0, 0
	sawText := false
	flush := func() {
		if t := strings.Join(strings.Fields(cur.String()), " "); t != "" {
			paras = append(paras, para{t, doc, level})
			sawText = true
		}
		cur.Reset()
	}
	for i := 0; i < len(src); {
		lt := strings.IndexByte(src[i:], '<')
		if lt < 0 {
			if skip == 0 {
				cur.WriteString(html.UnescapeString(src[i:]))
			}
			break
		}
		if lt > 0 && skip == 0 {
			cur.WriteString(html.UnescapeString(src[i : i+lt]))
		}
		i += lt
		// A comment runs to its own end; any other tag to the next '>'.
		var tag string
		if strings.HasPrefix(src[i:], "<!--") {
			end := strings.Index(src[i:], "-->")
			if end < 0 {
				break
			}
			i += end + 3
			continue
		}
		gt := strings.IndexByte(src[i:], '>')
		if gt < 0 {
			break
		}
		tag = src[i+1 : i+gt]
		i += gt + 1
		closing := strings.HasPrefix(tag, "/")
		name := strings.TrimPrefix(tag, "/")
		if k := strings.IndexAny(name, " \t\r\n/"); k >= 0 {
			name = name[:k]
		}
		name = strings.ToLower(name)
		switch {
		case skipped[name]:
			if closing {
				if skip > 0 {
					skip--
				}
			} else if !strings.HasSuffix(tag, "/") {
				skip++
			}
		case skip > 0:
		case name == "html" && !closing:
			flush()
			if sawText {
				doc++
				sawText = false
			}
		case name == "mbp:pagebreak":
			flush()
			if sawText {
				doc++
				sawText = false
			}
		case name == "br" || name == "mbp:nu":
			cur.WriteByte(' ')
		case len(name) == 2 && name[0] == 'h' && name[1] >= '1' && name[1] <= '6':
			flush()
			if closing {
				level = 0
			} else {
				level = int(name[1] - '0')
			}
		case blocks[name]:
			flush()
		}
	}
	flush()

	// The chapter is the nearest heading of the book's top levels: h1 and h2 where it has
	// any, otherwise h3. A deeper heading names a part of a chapter, not a chapter.
	top := 3
	for _, p := range paras {
		if p.heading == 1 || p.heading == 2 {
			top = 2
			break
		}
	}
	out := make([]Paragraph, 0, len(paras))
	chapter := ""
	for _, p := range paras {
		if p.heading > 0 && p.heading <= top && utf8.RuneCountInString(p.text) <= 120 {
			chapter = p.text
		}
		out = append(out, Paragraph{Text: p.text, Doc: p.doc, Chapter: chapter})
	}
	return out
}

// mobiMeta reads the title, author and identifiers a MOBI carries about itself, from
// record 0 alone: the full name in the header and the EXTH block after it.
func mobiMeta(rec0 []byte) Meta {
	var m Meta
	h := mobiHeader(rec0)
	if len(rec0) >= 0x5C {
		off := int(binary.BigEndian.Uint32(rec0[0x54:]))
		n := int(binary.BigEndian.Uint32(rec0[0x58:]))
		if off >= 0 && n > 0 && off+n <= len(rec0) {
			m.Title = strings.TrimSpace(decodeMOBIText(rec0[off:off+n], h.codepage))
		}
	}
	if !h.exth {
		return m
	}
	start := 16 + h.length
	if start+12 > len(rec0) || string(rec0[start:start+4]) != "EXTH" {
		return m
	}
	count := int(binary.BigEndian.Uint32(rec0[start+8:]))
	pos := start + 12
	for k := 0; k < count && pos+8 <= len(rec0); k++ {
		typ := int(binary.BigEndian.Uint32(rec0[pos:]))
		size := int(binary.BigEndian.Uint32(rec0[pos+4:]))
		if size < 8 || pos+size > len(rec0) {
			break
		}
		val := strings.TrimSpace(decodeMOBIText(rec0[pos+8:pos+size], h.codepage))
		pos += size
		switch typ {
		case 100: // author
			if m.Creator == "" {
				m.Creator = val
			} else {
				m.Creator += ", " + val
			}
		case 101:
			m.Publisher = val
		case 103:
			m.Description = tidyText(val)
		case 104: // isbn
			m.addIdentifier(val)
		case 105:
			m.Subjects = append(m.Subjects, val)
		case 106: // publishing date
			if g := yearDigits.FindStringSubmatch(val); g != nil {
				m.Year, _ = strconv.Atoi(g[1])
			}
		case 113, 504: // ASIN
			m.addIdentifier(val)
		case 503: // the updated title is the one the reader sees
			if val != "" {
				m.Title = val
			}
		case 524:
			m.Language = val
		}
	}
	return m
}

func decodeMOBIText(b []byte, codepage int) string {
	if codepage == 1252 {
		return decodeCP1252(b)
	}
	return strings.ToValidUTF8(string(b), "�")
}

// ReadMOBIMeta reads a MOBI's metadata from bytes already in memory.
func ReadMOBIMeta(data []byte) (Meta, error) {
	return ReadMOBIMetaAt(bytes.NewReader(data), int64(len(data)))
}

// ReadMOBIMetaAt reads a MOBI's metadata through a ReaderAt, as ReadMetaAt does for an
// EPUB: the record table and record 0 are a few kilobytes at the front of a file that
// may be tens of megabytes, and a scan of a library touches every one.
func ReadMOBIMetaAt(ra io.ReaderAt, size int64) (Meta, error) {
	head := make([]byte, 78)
	if n, err := ra.ReadAt(head, 0); n < len(head) {
		return Meta{}, fmt.Errorf("%w: %v", ErrNotMOBI, err)
	}
	if !IsMOBI(head) {
		return Meta{}, ErrNotMOBI
	}
	n := int(binary.BigEndian.Uint16(head[76:78]))
	if n < 2 {
		return Meta{}, fmt.Errorf("%w: the record table is broken", ErrNotMOBI)
	}
	table := make([]byte, 16) // records 0 and 1 are all that is needed
	if got, err := ra.ReadAt(table, 78); got < len(table) {
		return Meta{}, fmt.Errorf("%w: %v", ErrNotMOBI, err)
	}
	r0 := int64(binary.BigEndian.Uint32(table[0:]))
	r1 := int64(binary.BigEndian.Uint32(table[8:]))
	if r0 <= 0 || r1 <= r0 || r1 > size || r1-r0 > 1<<20 {
		return Meta{}, fmt.Errorf("%w: the header record is out of bounds", ErrNotMOBI)
	}
	rec0 := make([]byte, r1-r0)
	if got, err := ra.ReadAt(rec0, r0); got < len(rec0) {
		return Meta{}, fmt.Errorf("%w: %v", ErrNotMOBI, err)
	}
	if len(rec0) < 32 {
		return Meta{}, fmt.Errorf("%w: the header record is too short", ErrNotMOBI)
	}
	return mobiMeta(rec0), nil
}
