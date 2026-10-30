package ebook

// A pure-standard-library PDF text reader: bytes in, paragraphs out, the same shape as Read.
//
// WHAT IT READS. Text drawn with the text operators of a page's content stream, in page
// order, decoded to Unicode through each font's /ToUnicode CMap, else its /Encoding, else
// Latin-1. The structure is found by the classic xref table, a cross-reference stream
// (with object streams), or, when those are damaged, by scanning the file for "N G obj".
//
// WHAT IT DOES NOT READ, stated because "reads a PDF" sounds like more:
//   - Scanned pages. A page that is only an image has no text; the file answers ErrNoText.
//     There is no OCR.
//   - Encrypted files. They are refused by name (ErrDRM); nothing is decrypted.
//   - Composite fonts with no /ToUnicode. Their codes are glyph ids and mean nothing
//     without the font program, so those strings are dropped.
//   - Stream filters other than Flate, LZW, ASCIIHex, ASCII85 and RunLength (a JPEG or
//     CCITT content stream is not text). A page whose content uses one is skipped, and
//     the rest of the file is still read.
//   - Layout. Text is laid out by vertical movement and gaps only. There are no glyph
//     widths, so a word split across several positioned strings gets a space between
//     the pieces, and a page of several columns reads line by line across the columns.
//   - Right-to-left reordering, vertical writing and rotated pages.
//
// A PDF IS UNTRUSTED INPUT. Nothing is written to disk. Decompressed bytes, objects,
// pages, nesting and CMap entries are all capped, indirect references and the page tree
// are cycle-safe, and a panic anywhere is turned into an ErrNotPDF error.

import (
	"bytes"
	"compress/flate"
	"compress/zlib"
	"errors"
	"fmt"
	"io"
	"math"
	"sort"
	"strconv"
	"strings"
	"unicode"
	"unicode/utf16"
	"unicode/utf8"
)

var (
	// ErrNotPDF is bytes that are not a PDF, or a PDF too broken to read.
	ErrNotPDF = errors.New("ebook: not a readable PDF")

	// errTooBig is a file that costs more to read than the bounds allow. It is fatal for the
	// whole file, because the bound is on the file and not on one page.
	errTooBig = fmt.Errorf("%w: the file is too large to read", ErrNotPDF)

	errFilter = errors.New("pdf: unsupported stream filter")
)

// Bounds on what one PDF may cost to read. The byte caps are the EPUB reader's
// (maxEntryBytes per stream, maxTotalBytes per file).
const (
	maxPDFObjects  = 1 << 20
	maxPDFPages    = 20000
	maxPDFNesting  = 64 // arrays and dictionaries inside one another
	maxPDFTree     = 32 // the page tree and the outline
	maxPDFForms    = 4  // form XObjects inside one another
	maxPDFOutline  = 20000
	maxCMapEntries = 1 << 19
	maxCMapBytes   = 4 << 20
	maxFormCache   = 8 << 20
)

// ReadPDF parses the PDF in data. Paragraph.Doc is the zero-based page index and
// Paragraph.Chapter is the title of the nearest preceding bookmark that points at that
// page or an earlier one, or "" when the file has no outline. Paragraph.Percent follows
// the rule documented on Paragraph.
func ReadPDF(data []byte) (out []Paragraph, err error) {
	defer func() {
		if rec := recover(); rec != nil {
			out, err = nil, fmt.Errorf("%w: the file is malformed", ErrNotPDF)
		}
	}()
	r, err := openPDF(data)
	if err != nil {
		return nil, err
	}
	pages, texts, err := r.extract()
	if err == nil && (len(pages) == 0 || r.bad) && !r.rebuilt {
		// The xref pointed at nothing usable. Scan the file for objects and try once more.
		r.rebuild()
		if r.trailer["Encrypt"] != nil {
			return nil, ErrDRM
		}
		pages, texts, err = r.extract()
	}
	if err != nil {
		return nil, err
	}
	chapters := r.chapters(pages)
	for i, ps := range texts {
		for _, t := range ps {
			out = append(out, Paragraph{Text: t, Doc: i, Chapter: chapters[i]})
		}
	}
	if len(out) == 0 {
		return nil, fmt.Errorf("%w: the PDF has no text layer (a scan or an image-only file)", ErrNoText)
	}
	setPercents(out)
	return out, nil
}

// ReadPDFMeta reads what a PDF's /Info dictionary says about it: the title, the author
// (as Creator), the subject (as Description), the keywords (as Subjects), the year of
// the creation date and the catalog's /Lang. Everything else is left zero.
func ReadPDFMeta(data []byte) (m Meta, err error) {
	defer func() {
		if rec := recover(); rec != nil {
			m, err = Meta{}, fmt.Errorf("%w: the file is malformed", ErrNotPDF)
		}
	}()
	r, err := openPDF(data)
	if err != nil {
		return m, err
	}
	if info := r.dict(r.trailer["Info"]); info != nil {
		m.Title = r.infoText(info["Title"])
		m.Creator = r.infoText(info["Author"])
		m.Description = r.infoText(info["Subject"])
		for _, k := range strings.FieldsFunc(r.infoText(info["Keywords"]), func(c rune) bool { return c == ',' || c == ';' }) {
			if k = strings.TrimSpace(k); k != "" {
				m.Subjects = append(m.Subjects, k)
			}
		}
		date := strings.TrimPrefix(r.infoText(info["CreationDate"]), "D:")
		if len(date) >= 4 {
			if y, err := strconv.Atoi(date[:4]); err == nil && y > 0 {
				m.Year = y
			}
		}
	}
	if cat := r.dict(r.trailer["Root"]); cat != nil {
		m.Language = r.infoText(cat["Lang"])
	}
	return m, nil
}

// ---- objects and the lexer -------------------------------------------------------------

type (
	pname     string
	pstr      []byte
	pkw       string
	parr      []any
	pdict     map[string]any
	pref      struct{ n, g int }
	pdfStream struct {
		dict pdict
		raw  []byte
	}
)

type parser struct {
	b      []byte
	pos    int
	noRefs bool // a content stream has no indirect references, so "1 0 R" is not looked for
}

func isSpace(c byte) bool { return c == 0 || c == 9 || c == 10 || c == 12 || c == 13 || c == 32 }
func isDelim(c byte) bool {
	switch c {
	case '(', ')', '<', '>', '[', ']', '{', '}', '/', '%':
		return true
	}
	return false
}

func (p *parser) skip() {
	for p.pos < len(p.b) {
		c := p.b[p.pos]
		switch {
		case isSpace(c):
			p.pos++
		case c == '%':
			for p.pos < len(p.b) && p.b[p.pos] != '\n' && p.b[p.pos] != '\r' {
				p.pos++
			}
		default:
			return
		}
	}
}

func (p *parser) word() string {
	s := p.pos
	for p.pos < len(p.b) && !isSpace(p.b[p.pos]) && !isDelim(p.b[p.pos]) {
		p.pos++
	}
	return string(p.b[s:p.pos])
}

func allDigits(s string) bool {
	if s == "" {
		return false
	}
	for i := 0; i < len(s); i++ {
		if s[i] < '0' || s[i] > '9' {
			return false
		}
	}
	return true
}

// value reads the next object or keyword. ok is false at the end of the data, or where
// nesting is too deep to go on.
func (p *parser) value(depth int) (v any, ok bool) {
	p.skip()
	if p.pos >= len(p.b) {
		return nil, false
	}
	c := p.b[p.pos]
	switch {
	case c == '<' && p.pos+1 < len(p.b) && p.b[p.pos+1] == '<':
		if depth >= maxPDFNesting {
			return nil, false
		}
		p.pos += 2
		return p.dict(depth + 1), true
	case c == '<':
		return p.hexString(), true
	case c == '[':
		if depth >= maxPDFNesting {
			return nil, false
		}
		p.pos++
		return p.array(depth + 1), true
	case c == '(':
		return p.litString(), true
	case c == '/':
		p.pos++
		return p.name(), true
	case c == '>' && p.pos+1 < len(p.b) && p.b[p.pos+1] == '>':
		p.pos += 2
		return pkw(">>"), true
	case isDelim(c):
		p.pos++
		return pkw(string(c)), true
	}
	w := p.word()
	switch w {
	case "true":
		return true, true
	case "false":
		return false, true
	case "null":
		return nil, true
	}
	if c = w[0]; c >= '0' && c <= '9' || c == '+' || c == '-' || c == '.' {
		if !p.noRefs && allDigits(w) && len(w) <= 10 {
			save := p.pos
			p.skip()
			if g := p.word(); allDigits(g) && len(g) <= 5 {
				p.skip()
				if p.pos < len(p.b) && p.b[p.pos] == 'R' &&
					(p.pos+1 == len(p.b) || isSpace(p.b[p.pos+1]) || isDelim(p.b[p.pos+1])) {
					p.pos++
					n, _ := strconv.Atoi(w)
					gen, _ := strconv.Atoi(g)
					return pref{n, gen}, true
				}
			}
			p.pos = save
		}
		if f, err := strconv.ParseFloat(w, 64); err == nil && !math.IsInf(f, 0) && !math.IsNaN(f) {
			return f, true
		}
	}
	return pkw(w), true
}

func (p *parser) dict(depth int) pdict {
	d := pdict{}
	for {
		k, ok := p.value(depth)
		if !ok {
			return d
		}
		switch t := k.(type) {
		case pkw:
			if t == ">>" {
				return d
			}
			if t == "endobj" || t == "stream" {
				p.pos -= len(t) // an unterminated dictionary: leave the keyword for the caller
				return d
			}
		case pname:
			v, ok := p.value(depth)
			if !ok {
				return d
			}
			if kw, isKw := v.(pkw); isKw {
				if kw == ">>" {
					return d
				}
				continue
			}
			d[string(t)] = v
		}
	}
}

func (p *parser) array(depth int) parr {
	a := parr{}
	for {
		v, ok := p.value(depth)
		if !ok {
			return a
		}
		if kw, isKw := v.(pkw); isKw {
			if kw == "]" {
				return a
			}
			if kw == "endobj" || kw == "stream" {
				p.pos -= len(kw)
				return a
			}
			continue
		}
		a = append(a, v)
	}
}

func hexVal(c byte) int {
	switch {
	case c >= '0' && c <= '9':
		return int(c - '0')
	case c >= 'a' && c <= 'f':
		return int(c-'a') + 10
	case c >= 'A' && c <= 'F':
		return int(c-'A') + 10
	}
	return -1
}

func (p *parser) name() pname {
	var b []byte
	for p.pos < len(p.b) && !isSpace(p.b[p.pos]) && !isDelim(p.b[p.pos]) {
		c := p.b[p.pos]
		if c == '#' && p.pos+2 < len(p.b) && hexVal(p.b[p.pos+1]) >= 0 && hexVal(p.b[p.pos+2]) >= 0 {
			c = byte(hexVal(p.b[p.pos+1])<<4 | hexVal(p.b[p.pos+2]))
			p.pos += 2
		}
		b = append(b, c)
		p.pos++
	}
	return pname(b)
}

func (p *parser) hexString() pstr {
	p.pos++ // <
	var b []byte
	hi := -1
	for p.pos < len(p.b) {
		c := p.b[p.pos]
		p.pos++
		if c == '>' {
			break
		}
		h := hexVal(c)
		if h < 0 {
			continue
		}
		if hi < 0 {
			hi = h
		} else {
			b = append(b, byte(hi<<4|h))
			hi = -1
		}
	}
	if hi >= 0 {
		b = append(b, byte(hi<<4))
	}
	return pstr(b)
}

func (p *parser) litString() pstr {
	p.pos++ // (
	var b []byte
	depth := 1
	for p.pos < len(p.b) {
		c := p.b[p.pos]
		p.pos++
		switch c {
		case '(':
			depth++
		case ')':
			depth--
			if depth == 0 {
				return pstr(b)
			}
		case '\\':
			if p.pos >= len(p.b) {
				return pstr(b)
			}
			e := p.b[p.pos]
			p.pos++
			switch e {
			case 'n':
				c = '\n'
			case 'r':
				c = '\r'
			case 't':
				c = '\t'
			case 'b':
				c = '\b'
			case 'f':
				c = '\f'
			case '\r':
				if p.pos < len(p.b) && p.b[p.pos] == '\n' {
					p.pos++
				}
				continue
			case '\n':
				continue
			default:
				if e >= '0' && e <= '7' {
					v := int(e - '0')
					for i := 0; i < 2 && p.pos < len(p.b) && p.b[p.pos] >= '0' && p.b[p.pos] <= '7'; i++ {
						v = v*8 + int(p.b[p.pos]-'0')
						p.pos++
					}
					c = byte(v)
				} else {
					c = e
				}
			}
		}
		b = append(b, c)
	}
	return pstr(b)
}

// ---- the file: xref, objects, streams ------------------------------------------------------

// xent is one cross-reference entry: kind 0 is free, 1 is an offset into the file, 2 is a
// position inside object stream a.
type xent struct {
	kind uint8
	a    int
}

type pdfReader struct {
	data    []byte
	xref    map[int]xent
	trailer pdict
	cache   map[int]any
	busy    map[int]bool
	stm     map[int]map[int]any
	fonts   map[int]*pdfFont
	total   int64
	over    bool // a size bound was hit
	bad     bool // an xref offset pointed at something that is not the object it names
	rebuilt bool
	dests   map[string]any
	forms   map[*pdfStream][]byte
	formMem int
	work    int64 // inflated bytes of streams that were read and dropped
	// transient is set while a page's own content is being inflated, see charge.
	transient bool
}

func newPDFReader(data []byte) *pdfReader {
	return &pdfReader{
		data: data, xref: map[int]xent{}, trailer: pdict{}, cache: map[int]any{},
		busy: map[int]bool{}, stm: map[int]map[int]any{}, fonts: map[int]*pdfFont{},
		forms: map[*pdfStream][]byte{},
	}
}

func openPDF(data []byte) (*pdfReader, error) {
	head := data
	if len(head) > 1024 {
		head = head[:1024]
	}
	i := bytes.Index(head, []byte("%PDF-"))
	if i < 0 {
		return nil, fmt.Errorf("%w: no PDF header", ErrNotPDF)
	}
	r := newPDFReader(data[i:])
	if err := r.loadXref(); err != nil || r.dict(r.trailer["Root"]) == nil {
		r.rebuild()
	}
	if r.trailer["Encrypt"] != nil {
		return nil, ErrDRM
	}
	if r.dict(r.trailer["Root"]) == nil {
		return nil, fmt.Errorf("%w: no document catalog", ErrNotPDF)
	}
	return r, nil
}

func beInt(b []byte) int {
	n := 0
	for _, c := range b {
		n = n<<8 | int(c)
	}
	return n
}

// loadXref follows startxref and the /Prev chain, newest first, so the first entry
// seen for an object is the one that counts.
func (r *pdfReader) loadXref() error {
	at := bytes.LastIndex(r.data, []byte("startxref"))
	if at < 0 {
		return errors.New("no startxref")
	}
	p := parser{b: r.data, pos: at + 9}
	v, _ := p.value(0)
	first, ok := v.(float64)
	if !ok {
		return errors.New("no startxref offset")
	}
	queue := []int{int(first)}
	seen := map[int]bool{}
	for n := 0; len(queue) > 0; n++ {
		off := queue[0]
		queue = queue[1:]
		if off < 0 || off >= len(r.data) || seen[off] || n > 4096 {
			if n == 0 {
				return errors.New("bad startxref offset")
			}
			continue
		}
		seen[off] = true
		td, err := r.readSection(off)
		if err != nil {
			return err
		}
		for _, k := range []string{"Root", "Info", "Encrypt", "ID"} {
			if _, have := r.trailer[k]; !have && td[k] != nil {
				r.trailer[k] = td[k]
			}
		}
		if x, ok := td["XRefStm"].(float64); ok {
			queue = append(queue, int(x))
		}
		if x, ok := td["Prev"].(float64); ok {
			queue = append(queue, int(x))
		}
	}
	return nil
}

func (r *pdfReader) readSection(off int) (pdict, error) {
	p := parser{b: r.data, pos: off}
	p.skip()
	if bytes.HasPrefix(r.data[p.pos:], []byte("xref")) {
		p.pos += 4
		for {
			p.skip()
			if bytes.HasPrefix(r.data[p.pos:], []byte("trailer")) {
				p.pos += 7
				break
			}
			a, _ := p.value(0)
			c, _ := p.value(0)
			start, ok1 := a.(float64)
			count, ok2 := c.(float64)
			if !ok1 || !ok2 || start < 0 || count < 0 || count > maxPDFObjects {
				return nil, errors.New("bad xref subsection")
			}
			for i := 0; i < int(count); i++ {
				ov, _ := p.value(0)
				p.value(0)
				kv, _ := p.value(0)
				o, ok1 := ov.(float64)
				kw, ok2 := kv.(pkw)
				if !ok1 || !ok2 {
					return nil, errors.New("bad xref entry")
				}
				n := int(start) + i
				if _, have := r.xref[n]; have {
					continue
				}
				if len(r.xref) >= maxPDFObjects {
					return nil, errors.New("too many objects")
				}
				if kw == "n" {
					r.xref[n] = xent{1, int(o)}
				} else {
					r.xref[n] = xent{}
				}
			}
		}
		tv, _ := p.value(0)
		td, ok := tv.(pdict)
		if !ok {
			return nil, errors.New("no trailer")
		}
		return td, nil
	}
	v, err := r.parseAt(off, -1)
	if err != nil {
		return nil, err
	}
	s, ok := v.(*pdfStream)
	if !ok || r.name(s.dict["Type"]) != "XRef" {
		return nil, errors.New("not an xref stream")
	}
	data, err := r.decode(s)
	if err != nil {
		return nil, err
	}
	var w [3]int
	wa := r.arr(s.dict["W"])
	if len(wa) != 3 {
		return nil, errors.New("bad xref stream widths")
	}
	for i := range w {
		f, _ := r.num(wa[i])
		if f < 0 || f > 8 {
			return nil, errors.New("bad xref stream widths")
		}
		w[i] = int(f)
	}
	size, _ := r.num(s.dict["Size"])
	index := []int{0, int(size)}
	if ia := r.arr(s.dict["Index"]); len(ia) >= 2 {
		index = index[:0]
		for _, e := range ia {
			f, _ := r.num(e)
			index = append(index, int(f))
		}
	}
	row := w[0] + w[1] + w[2]
	if row == 0 {
		return nil, errors.New("bad xref stream widths")
	}
	pos := 0
	for k := 0; k+1 < len(index); k += 2 {
		for i := 0; i < index[k+1]; i++ {
			if pos+row > len(data) {
				break
			}
			t := 1
			if w[0] > 0 {
				t = beInt(data[pos : pos+w[0]])
			}
			f2 := beInt(data[pos+w[0] : pos+w[0]+w[1]])
			pos += row
			n := index[k] + i
			if _, have := r.xref[n]; have {
				continue
			}
			if len(r.xref) >= maxPDFObjects {
				return nil, errors.New("too many objects")
			}
			switch t {
			case 1:
				r.xref[n] = xent{1, f2}
			case 2:
				r.xref[n] = xent{2, f2}
			default:
				r.xref[n] = xent{}
			}
		}
	}
	return s.dict, nil
}

// rebuild throws the xref away and finds objects by scanning for "N G obj". Later
// definitions win, which is what an incremental update means.
func (r *pdfReader) rebuild() {
	r.rebuilt = true
	r.xref = map[int]xent{}
	r.cache = map[int]any{}
	r.stm = map[int]map[int]any{}
	r.forms = map[*pdfStream][]byte{}
	r.total, r.formMem = 0, 0 // the first pass's work is thrown away with its caches
	r.fonts = map[int]*pdfFont{}
	r.busy = map[int]bool{}
	r.bad = false
	r.trailer = pdict{}
	var streams, xrefs []int
	d := r.data
	for pos := 0; pos < len(d) && len(r.xref) < maxPDFObjects; {
		i := bytes.Index(d[pos:], []byte("obj"))
		if i < 0 {
			break
		}
		i += pos
		pos = i + 3
		if i == 0 || !isSpace(d[i-1]) || (i+3 < len(d) && (d[i+3] >= 'a' && d[i+3] <= 'z' || d[i+3] >= 'A' && d[i+3] <= 'Z')) {
			continue
		}
		j := i - 1
		for j >= 0 && isSpace(d[j]) {
			j--
		}
		ge := j + 1
		for j >= 0 && d[j] >= '0' && d[j] <= '9' {
			j--
		}
		if j+1 == ge || j < 0 || !isSpace(d[j]) {
			continue
		}
		for j >= 0 && isSpace(d[j]) {
			j--
		}
		ne := j + 1
		for j >= 0 && d[j] >= '0' && d[j] <= '9' {
			j--
		}
		if j+1 == ne || ne-(j+1) > 10 {
			continue
		}
		num, _ := strconv.Atoi(string(d[j+1 : ne]))
		r.xref[num] = xent{1, j + 1}
		end := i + 3 + 400
		if end > len(d) {
			end = len(d)
		}
		window := d[i+3 : end]
		if bytes.Contains(window, []byte("/ObjStm")) {
			streams = append(streams, num)
		}
		if bytes.Contains(window, []byte("/XRef")) {
			xrefs = append(xrefs, num)
		}
	}
	merge := func(td pdict) {
		for _, k := range []string{"Root", "Info", "Encrypt", "ID"} {
			if td[k] != nil {
				r.trailer[k] = td[k]
			}
		}
	}
	for pos := 0; ; {
		i := bytes.Index(d[pos:], []byte("trailer"))
		if i < 0 {
			break
		}
		pos += i + 7
		p := parser{b: d, pos: pos}
		if td, ok := p.value(0); ok {
			if t, isDict := td.(pdict); isDict {
				merge(t)
			}
		}
	}
	for _, n := range xrefs {
		if s, ok := r.obj(n).(*pdfStream); ok {
			merge(s.dict)
		}
	}
	if r.trailer["Encrypt"] != nil {
		return
	}
	for _, n := range streams {
		for on := range r.stmObjects(n) {
			if e, have := r.xref[on]; !have || e.kind != 1 {
				r.xref[on] = xent{2, n}
			}
		}
	}
	if r.dict(r.trailer["Root"]) == nil {
		keys := make([]int, 0, len(r.xref))
		for n := range r.xref {
			keys = append(keys, n)
		}
		sort.Sort(sort.Reverse(sort.IntSlice(keys)))
		var orphan pdict
		for _, n := range keys {
			dd := r.dict(r.obj(n))
			switch r.name(dd["Type"]) {
			case "Catalog":
				r.trailer["Root"] = pref{n, 0}
				return
			case "Pages":
				if dd["Parent"] == nil && orphan == nil {
					orphan = pdict{"Pages": pref{n, 0}}
				}
			}
		}
		if orphan != nil {
			r.cache[-1] = orphan
			r.xref[-1] = xent{1, 0}
			r.trailer["Root"] = pref{-1, 0}
		}
	}
}

// parseAt reads the indirect object at off. want is the object number it must carry, or
// -1 for any.
func (r *pdfReader) parseAt(off, want int) (any, error) {
	if off < 0 || off >= len(r.data) {
		return nil, errors.New("offset outside the file")
	}
	p := parser{b: r.data, pos: off}
	nv, _ := p.value(0)
	gv, _ := p.value(0)
	kv, _ := p.value(0)
	n, ok1 := nv.(float64)
	_, ok2 := gv.(float64)
	kw, ok3 := kv.(pkw)
	if !ok1 || !ok2 || !ok3 || kw != "obj" || (want >= 0 && int(n) != want) {
		return nil, errors.New("not the object the xref names")
	}
	v, _ := p.value(0)
	d, isDict := v.(pdict)
	if !isDict {
		if _, isKw := v.(pkw); isKw {
			return nil, nil // "N G obj endobj": an empty object
		}
		return v, nil
	}
	p.skip()
	if !bytes.HasPrefix(r.data[p.pos:], []byte("stream")) {
		return d, nil
	}
	p.pos += 6
	if p.pos < len(r.data) && r.data[p.pos] == '\r' {
		p.pos++
	}
	if p.pos < len(r.data) && r.data[p.pos] == '\n' {
		p.pos++
	}
	start := p.pos
	if l, ok := r.num(d["Length"]); ok && l >= 0 && start+int(l) <= len(r.data) {
		q := parser{b: r.data, pos: start + int(l)}
		q.skip()
		if bytes.HasPrefix(r.data[q.pos:], []byte("endstream")) {
			return &pdfStream{d, r.data[start : start+int(l)]}, nil
		}
	}
	end := len(r.data)
	if i := bytes.Index(r.data[start:], []byte("endstream")); i >= 0 {
		end = start + i
	}
	raw := r.data[start:end]
	if bytes.HasSuffix(raw, []byte("\r\n")) {
		raw = raw[:len(raw)-2]
	} else if bytes.HasSuffix(raw, []byte("\n")) || bytes.HasSuffix(raw, []byte("\r")) {
		raw = raw[:len(raw)-1]
	}
	return &pdfStream{d, raw}, nil
}

func (r *pdfReader) obj(n int) any {
	if v, ok := r.cache[n]; ok {
		return v
	}
	e, ok := r.xref[n]
	if !ok || e.kind == 0 || r.busy[n] {
		return nil
	}
	r.busy[n] = true
	var v any
	switch e.kind {
	case 1:
		var err error
		if v, err = r.parseAt(e.a, n); err != nil {
			r.bad = true
			v = nil
		}
	case 2:
		v = r.stmObjects(e.a)[n]
	}
	delete(r.busy, n)
	r.cache[n] = v
	return v
}

// stmObjects reads every object in object stream num.
func (r *pdfReader) stmObjects(num int) map[int]any {
	if m, ok := r.stm[num]; ok {
		return m
	}
	m := map[int]any{}
	r.stm[num] = m
	s, _ := r.obj(num).(*pdfStream)
	if s == nil || r.name(s.dict["Type"]) != "ObjStm" {
		return m
	}
	data, err := r.decode(s)
	if err != nil {
		return m
	}
	nf, _ := r.num(s.dict["N"])
	ff, _ := r.num(s.dict["First"])
	n, first := int(nf), int(ff)
	if n < 0 || n > maxPDFObjects || first < 0 || first > len(data) {
		return m
	}
	hp := parser{b: data[:first], noRefs: true}
	for i := 0; i < n; i++ {
		a, _ := hp.value(0)
		b, _ := hp.value(0)
		on, ok1 := a.(float64)
		of, ok2 := b.(float64)
		if !ok1 || !ok2 {
			break
		}
		if start := first + int(of); start >= 0 && start < len(data) {
			op := parser{b: data, pos: start}
			if v, ok := op.value(0); ok {
				m[int(on)] = v
			}
		}
	}
	return m
}

func (r *pdfReader) resolve(v any) any {
	for i := 0; i < 32; i++ {
		ref, ok := v.(pref)
		if !ok {
			return v
		}
		v = r.obj(ref.n)
	}
	return nil
}

func (r *pdfReader) dict(v any) pdict {
	switch t := r.resolve(v).(type) {
	case pdict:
		return t
	case *pdfStream:
		return t.dict
	}
	return nil
}

func (r *pdfReader) arr(v any) parr {
	a, _ := r.resolve(v).(parr)
	return a
}

func (r *pdfReader) name(v any) string {
	n, _ := r.resolve(v).(pname)
	return string(n)
}

func (r *pdfReader) num(v any) (float64, bool) {
	f, ok := r.resolve(v).(float64)
	return f, ok
}

func (r *pdfReader) stream(v any) *pdfStream {
	s, _ := r.resolve(v).(*pdfStream)
	return s
}

// ---- stream filters --------------------------------------------------------------------------

// charge counts n inflated bytes against the file's budget. Two budgets, because two
// different things are being bounded. What is KEPT (object streams, CMaps, xref streams,
// cached forms) is capped at maxTotalBytes. A page's content stream is inflated, read and
// dropped, so it costs time and not memory: a text book of vector pages legitimately
// inflates to several times maxTotalBytes over its whole length. Those are capped by
// work, which is maxTotalBytes plus 24 bytes per byte of the file, so a small file that
// inflates enormously (deflate cannot exceed 1032:1) is still refused. Either way one
// stream is capped at maxEntryBytes.
func (r *pdfReader) charge(n int) error {
	if r.transient {
		r.work += int64(n)
		if n > maxEntryBytes || r.work > maxTotalBytes+24*int64(len(r.data)) {
			r.over = true
			return errTooBig
		}
		return nil
	}
	r.total += int64(n)
	if n > maxEntryBytes || r.total > maxTotalBytes {
		r.over = true
		return errTooBig
	}
	return nil
}

// decodeForm is decode for a form XObject, which a page may draw hundreds of times (a
// background, a header). It is inflated and charged once; the result is kept while it is
// small enough that keeping it costs little.
func (r *pdfReader) decodeForm(s *pdfStream) ([]byte, error) {
	if b, ok := r.forms[s]; ok {
		return b, nil
	}
	b, err := r.decodeContent(s)
	if err == nil && len(b) <= maxFormCache && r.formMem+len(b) <= 4*maxFormCache {
		r.forms[s] = b
		r.formMem += len(b)
	}
	return b, err
}

func (r *pdfReader) decode(s *pdfStream) ([]byte, error) {
	var filters []string
	switch f := r.resolve(s.dict["Filter"]).(type) {
	case pname:
		filters = []string{string(f)}
	case parr:
		for _, e := range f {
			filters = append(filters, r.name(e))
		}
	}
	var parms []pdict
	switch d := r.resolve(s.dict["DecodeParms"]).(type) {
	case pdict:
		parms = []pdict{d}
	case parr:
		for _, e := range d {
			parms = append(parms, r.dict(e))
		}
	}
	data := s.raw
	if err := r.charge(len(data)); err != nil {
		return nil, err
	}
	for i, f := range filters {
		var parm pdict
		if i < len(parms) {
			parm = parms[i]
		}
		var err error
		switch f {
		case "FlateDecode", "Fl":
			if data, err = inflate(data); err == nil {
				data, err = r.predict(data, parm)
			}
		case "LZWDecode", "LZW":
			early := 1
			if e, ok := r.num(parm["EarlyChange"]); ok {
				early = int(e)
			}
			if data, err = lzwDecode(data, early); err == nil {
				data, err = r.predict(data, parm)
			}
		case "ASCIIHexDecode", "AHx":
			data = asciiHex(data)
		case "ASCII85Decode", "A85":
			data, err = ascii85(data)
		case "RunLengthDecode", "RL":
			data, err = runLength(data)
		default:
			return nil, errFilter
		}
		if err != nil {
			if err == errTooBig {
				r.over = true
			}
			return nil, err
		}
		if err := r.charge(len(data)); err != nil {
			return nil, err
		}
	}
	return data, nil
}

// inflate reads a zlib stream, or a bare deflate one when the header is wrong. A stream
// that fails partway keeps what it produced, which is how a damaged file still reads.
func inflate(data []byte) ([]byte, error) {
	var src io.Reader
	if zr, err := zlib.NewReader(bytes.NewReader(data)); err == nil {
		defer zr.Close()
		src = zr
	} else {
		src = flate.NewReader(bytes.NewReader(data))
	}
	out, err := io.ReadAll(io.LimitReader(src, maxEntryBytes+1))
	if len(out) > maxEntryBytes {
		return nil, errTooBig
	}
	if err != nil && len(out) == 0 {
		return nil, err
	}
	return out, nil
}

func asciiHex(data []byte) []byte {
	out := make([]byte, 0, len(data)/2)
	hi := -1
	for _, c := range data {
		if c == '>' {
			break
		}
		h := hexVal(c)
		if h < 0 {
			continue
		}
		if hi < 0 {
			hi = h
		} else {
			out = append(out, byte(hi<<4|h))
			hi = -1
		}
	}
	if hi >= 0 {
		out = append(out, byte(hi<<4))
	}
	return out
}

func ascii85(data []byte) ([]byte, error) {
	data = bytes.TrimSpace(data)
	data = bytes.TrimPrefix(data, []byte("<~"))
	var out []byte
	var group [5]byte
	n := 0
	flush := func(k int) {
		for i := k; i < 5; i++ {
			group[i] = 'u'
		}
		var v uint32
		for _, c := range group {
			v = v*85 + uint32(c-'!')
		}
		b := []byte{byte(v >> 24), byte(v >> 16), byte(v >> 8), byte(v)}
		out = append(out, b[:k-1]...)
	}
	for i := 0; i < len(data); i++ {
		c := data[i]
		switch {
		case isSpace(c):
		case c == '~':
			i = len(data)
		case c == 'z' && n == 0:
			out = append(out, 0, 0, 0, 0)
		case c >= '!' && c <= 'u':
			group[n] = c
			if n++; n == 5 {
				flush(5)
				n = 0
			}
		default:
			return nil, errors.New("bad ASCII85 data")
		}
		if len(out) > maxEntryBytes {
			return nil, errTooBig
		}
	}
	if n > 1 {
		flush(n)
	}
	return out, nil
}

func runLength(data []byte) ([]byte, error) {
	var out []byte
	for i := 0; i < len(data); {
		l := int(data[i])
		i++
		switch {
		case l == 128:
			return out, nil
		case l < 128:
			end := i + l + 1
			if end > len(data) {
				end = len(data)
			}
			out = append(out, data[i:end]...)
			i = end
		default:
			if i < len(data) {
				for k := 0; k < 257-l; k++ {
					out = append(out, data[i])
				}
			}
			i++
		}
		if len(out) > maxEntryBytes {
			return nil, errTooBig
		}
	}
	return out, nil
}

// lzwDecode is PDF's LZW: codes of 9 to 12 bits, most significant bit first, 256 clears
// the table and 257 ends the data. early is the /EarlyChange parameter (1 by default).
func lzwDecode(data []byte, early int) ([]byte, error) {
	var out []byte
	table := make([][]byte, 4096)
	for i := 0; i < 256; i++ {
		table[i] = []byte{byte(i)}
	}
	next, width := 258, 9
	var prev []byte
	var acc uint32
	bits := 0
	for _, b := range data {
		acc = acc<<8 | uint32(b)
		bits += 8
		for bits >= width {
			code := int(acc>>(bits-width)) & (1<<width - 1)
			bits -= width
			switch {
			case code == 256:
				next, width, prev = 258, 9, nil
				continue
			case code == 257:
				return out, nil
			}
			var entry []byte
			switch {
			case code < next && table[code] != nil:
				entry = table[code]
			case code == next && prev != nil:
				entry = append(append([]byte(nil), prev...), prev[0])
			default:
				return out, errors.New("bad LZW data")
			}
			out = append(out, entry...)
			if len(out) > maxEntryBytes {
				return nil, errTooBig
			}
			if prev != nil && next < 4096 {
				table[next] = append(append([]byte(nil), prev...), entry[0])
				next++
			}
			prev = entry
			switch n := next + early; {
			case n >= 2048:
				width = 12
			case n >= 1024:
				width = 11
			case n >= 512:
				width = 10
			}
		}
	}
	return out, nil
}

// predict undoes the PNG and TIFF predictors a Flate or LZW stream can carry.
func (r *pdfReader) predict(data []byte, parm pdict) ([]byte, error) {
	pf, _ := r.num(parm["Predictor"])
	pred := int(pf)
	if pred <= 1 {
		return data, nil
	}
	get := func(k string, def int) int {
		if f, ok := r.num(parm[k]); ok && f >= 1 {
			return int(f)
		}
		return def
	}
	colors, bpc, cols := get("Colors", 1), get("BitsPerComponent", 8), get("Columns", 1)
	if colors > 64 || bpc > 16 || cols > 1<<20 {
		return nil, errors.New("bad predictor parameters")
	}
	rowLen := (colors*bpc*cols + 7) / 8
	bpp := (colors*bpc + 7) / 8
	if pred == 2 {
		if bpc != 8 {
			return data, nil
		}
		out := append([]byte(nil), data...)
		for pos := 0; pos < len(out); pos += rowLen {
			end := pos + rowLen
			if end > len(out) {
				end = len(out)
			}
			row := out[pos:end]
			for i := colors; i < len(row); i++ {
				row[i] += row[i-colors]
			}
		}
		return out, nil
	}
	out := make([]byte, 0, len(data))
	prev := make([]byte, rowLen)
	for pos := 0; pos < len(data); pos += rowLen + 1 {
		end := pos + 1 + rowLen
		if end > len(data) {
			end = len(data)
		}
		row := append([]byte(nil), data[pos+1:end]...)
		switch data[pos] {
		case 1:
			for i := bpp; i < len(row); i++ {
				row[i] += row[i-bpp]
			}
		case 2:
			for i := range row {
				row[i] += prev[i]
			}
		case 3:
			for i := range row {
				var left int
				if i >= bpp {
					left = int(row[i-bpp])
				}
				row[i] += byte((left + int(prev[i])) / 2)
			}
		case 4:
			for i := range row {
				var a, c int
				if i >= bpp {
					a, c = int(row[i-bpp]), int(prev[i-bpp])
				}
				row[i] += paeth(a, int(prev[i]), c)
			}
		}
		out = append(out, row...)
		copy(prev, row)
	}
	return out, nil
}

func paeth(a, b, c int) byte {
	p := a + b - c
	pa, pb, pc := abs(p-a), abs(p-b), abs(p-c)
	switch {
	case pa <= pb && pa <= pc:
		return byte(a)
	case pb <= pc:
		return byte(b)
	}
	return byte(c)
}

func abs(i int) int {
	if i < 0 {
		return -i
	}
	return i
}

// ---- the page tree, outline and metadata -------------------------------------------------------

type pdfPage struct {
	n    int // object number, 0 for a direct dictionary
	dict pdict
	res  pdict
}

// pageList walks /Pages in page order, passing /Resources down to pages that have none
// of their own. A node met twice is skipped, so a cyclic tree ends.
func (r *pdfReader) pageList() []pdfPage {
	var out []pdfPage
	seen := map[int]bool{}
	var walk func(v any, inherited pdict, depth int)
	walk = func(v any, inherited pdict, depth int) {
		if depth > maxPDFTree || len(out) >= maxPDFPages {
			return
		}
		n := 0
		if ref, ok := v.(pref); ok {
			if seen[ref.n] {
				return
			}
			seen[ref.n] = true
			n = ref.n
		}
		d := r.dict(v)
		if d == nil {
			return
		}
		res := inherited
		if rd := r.dict(d["Resources"]); rd != nil {
			res = rd
		}
		if kids := r.arr(d["Kids"]); kids != nil || r.name(d["Type"]) == "Pages" {
			for _, k := range kids {
				walk(k, res, depth+1)
			}
			return
		}
		out = append(out, pdfPage{n, d, res})
	}
	if cat := r.dict(r.trailer["Root"]); cat != nil {
		walk(cat["Pages"], nil, 0)
	}
	if len(out) == 0 && r.rebuilt {
		// A tree that cannot be walked: take every page object in object-number order.
		keys := make([]int, 0, len(r.xref))
		for n := range r.xref {
			keys = append(keys, n)
		}
		sort.Ints(keys)
		for _, n := range keys {
			if d := r.dict(r.obj(n)); d != nil && r.name(d["Type"]) == "Page" && len(out) < maxPDFPages {
				out = append(out, pdfPage{n, d, r.dict(d["Resources"])})
			}
		}
	}
	return out
}

func (r *pdfReader) extract() ([]pdfPage, [][]string, error) {
	pages := r.pageList()
	if r.over {
		return nil, nil, errTooBig
	}
	texts := make([][]string, len(pages))
	for i, pg := range pages {
		texts[i] = r.pageText(pg)
		if r.over {
			return nil, nil, errTooBig
		}
	}
	return pages, texts, nil
}

// infoText decodes a PDF text string: UTF-16BE or UTF-8 behind a byte-order mark, else
// PDFDocEncoding, which is Latin-1 but for a block of punctuation at 0x80.
func (r *pdfReader) infoText(v any) string {
	var b []byte
	switch t := r.resolve(v).(type) {
	case pstr:
		b = t
	case pname:
		b = []byte(t)
	default:
		return ""
	}
	switch {
	case len(b) >= 2 && b[0] == 0xFE && b[1] == 0xFF:
		return strings.TrimSpace(utf16BE(b[2:]))
	case len(b) >= 3 && b[0] == 0xEF && b[1] == 0xBB && b[2] == 0xBF:
		return strings.TrimSpace(string(b[3:]))
	}
	var sb strings.Builder
	for _, c := range b {
		if c >= 0x80 && c <= 0xA0 {
			sb.WriteRune([]rune(pdfDocHigh)[c-0x80])
		} else {
			sb.WriteRune(rune(c))
		}
	}
	return strings.TrimSpace(sb.String())
}

const pdfDocHigh = "•†‡…—–ƒ⁄‹›−‰„“”‘’‚™ﬁﬂŁŒŠŸŽıłœšž�€"

func utf16BE(b []byte) string {
	if len(b) == 1 {
		return string(rune(b[0]))
	}
	u := make([]uint16, 0, len(b)/2)
	for i := 0; i+1 < len(b); i += 2 {
		u = append(u, uint16(b[i])<<8|uint16(b[i+1]))
	}
	return string(utf16.Decode(u))
}

type outlineEntry struct {
	page  int
	title string
}

// chapters gives, for each page, the title of the last bookmark that points at it or at
// an earlier page. The slice is empty strings when the file has no usable outline.
func (r *pdfReader) chapters(pages []pdfPage) []string {
	out := make([]string, len(pages))
	cat := r.dict(r.trailer["Root"])
	root := r.dict(cat["Outlines"])
	if root == nil {
		return out
	}
	index := map[int]int{}
	for i, pg := range pages {
		if pg.n != 0 {
			index[pg.n] = i
		}
	}
	at := map[int]string{}
	count := 0
	seen := map[int]bool{}
	var visit func(first any, depth int)
	visit = func(first any, depth int) {
		for cur := first; cur != nil && depth <= maxPDFTree && count < maxPDFOutline; {
			if ref, ok := cur.(pref); ok {
				if seen[ref.n] {
					return
				}
				seen[ref.n] = true
			}
			item := r.dict(cur)
			if item == nil {
				return
			}
			count++
			dest := item["Dest"]
			if dest == nil {
				if a := r.dict(item["A"]); a != nil && r.name(a["S"]) == "GoTo" {
					dest = a["D"]
				}
			}
			if pi, ok := r.destPage(dest, index, 0); ok {
				if t := strings.Join(strings.Fields(r.infoText(item["Title"])), " "); t != "" {
					at[pi] = t
				}
			}
			visit(item["First"], depth+1)
			cur = item["Next"]
		}
	}
	visit(root["First"], 0)
	title := ""
	for i := range out {
		if t, ok := at[i]; ok {
			title = t
		}
		out[i] = title
	}
	return out
}

func (r *pdfReader) destPage(dest any, index map[int]int, depth int) (int, bool) {
	if depth > 3 {
		return 0, false
	}
	switch t := r.resolve(dest).(type) {
	case parr:
		if len(t) > 0 {
			if ref, ok := t[0].(pref); ok {
				i, found := index[ref.n]
				return i, found
			}
		}
	case pname:
		return r.destPage(r.namedDest(string(t)), index, depth+1)
	case pstr:
		return r.destPage(r.namedDest(string(t)), index, depth+1)
	case pdict:
		return r.destPage(t["D"], index, depth+1)
	}
	return 0, false
}

// namedDest finds a named destination in the catalog's /Dests dictionary or its /Names
// /Dests name tree, which is flattened once.
func (r *pdfReader) namedDest(name string) any {
	if r.dests == nil {
		r.dests = map[string]any{}
		cat := r.dict(r.trailer["Root"])
		for k, v := range r.dict(cat["Dests"]) {
			r.dests[k] = v
		}
		seen := 0
		var walk func(node any, depth int)
		walk = func(node any, depth int) {
			d := r.dict(node)
			if d == nil || depth > maxPDFTree || seen > maxPDFOutline {
				return
			}
			seen++
			names := r.arr(d["Names"])
			for i := 0; i+1 < len(names); i += 2 {
				if k, ok := r.resolve(names[i]).(pstr); ok {
					r.dests[string(k)] = names[i+1]
				}
			}
			for _, k := range r.arr(d["Kids"]) {
				walk(k, depth+1)
			}
		}
		walk(r.dict(cat["Names"])["Dests"], 0)
	}
	return r.dests[name]
}

// ---- fonts -------------------------------------------------------------------------------------

type pdfFont struct {
	n    int               // bytes per character code, 1 or 2
	uni  map[uint32]string // from /ToUnicode
	enc  [256]string       // from /Encoding, for one-byte fonts
	ucs2 bool              // a composite font whose codes are UCS-2 itself
}

var latin1Font = func() *pdfFont {
	f := &pdfFont{n: 1}
	for i := range f.enc {
		f.enc[i] = string(rune(i))
	}
	return f
}()

func (f *pdfFont) decode(b []byte) string {
	var sb strings.Builder
	if f.n == 2 {
		for i := 0; i+1 < len(b); i += 2 {
			code := uint32(b[i])<<8 | uint32(b[i+1])
			if s, ok := f.uni[code]; ok {
				sb.WriteString(s)
			} else if f.ucs2 {
				sb.WriteRune(rune(code))
			}
		}
		return sb.String()
	}
	for _, c := range b {
		if s, ok := f.uni[uint32(c)]; ok {
			sb.WriteString(s)
		} else {
			sb.WriteString(f.enc[c])
		}
	}
	return sb.String()
}

func (r *pdfReader) fontFor(res pdict, name string) *pdfFont {
	v := r.dict(res["Font"])[name]
	if ref, ok := v.(pref); ok {
		if f, ok := r.fonts[ref.n]; ok {
			return f
		}
		f := r.buildFont(r.dict(v))
		r.fonts[ref.n] = f
		return f
	}
	return r.buildFont(r.dict(v))
}

func (r *pdfReader) buildFont(fd pdict) *pdfFont {
	if fd == nil {
		return latin1Font
	}
	f := &pdfFont{n: 1, enc: latin1Font.enc}
	composite := r.name(fd["Subtype"]) == "Type0"
	if composite {
		f.n = 2
	}
	encV := r.resolve(fd["Encoding"])
	if en, ok := encV.(pname); ok && composite {
		low := strings.ToLower(string(en))
		f.ucs2 = strings.Contains(low, "ucs2") || strings.Contains(low, "utf16")
	}
	if ts := r.stream(fd["ToUnicode"]); ts != nil {
		if data, err := r.decode(ts); err == nil {
			cm := parseCMap(data)
			f.uni = cm.m
			switch {
			case composite && cm.width > 0:
				f.n = cm.width
			case !composite && cm.width == 2:
				f.n = 2
			}
		}
	}
	if f.n > 2 {
		f.n = 2
	}
	switch e := encV.(type) {
	case pname:
		f.enc = baseEncoding(string(e))
	case pdict:
		if be := r.name(e["BaseEncoding"]); be != "" {
			f.enc = baseEncoding(be)
		}
		code := 0
		for _, el := range r.arr(e["Differences"]) {
			switch t := r.resolve(el).(type) {
			case float64:
				code = int(t)
			case pname:
				if s := glyphString(string(t)); s != "" && code >= 0 && code < 256 {
					f.enc[code] = s
				}
				code++
			}
		}
	}
	return f
}

// ---- CMaps -------------------------------------------------------------------------------------

type cmap struct {
	m     map[uint32]string
	width int // bytes per code from the first codespace range, 0 when none is given
}

func decodeTarget(b []byte, add int) string {
	if len(b) == 1 {
		return string(rune(int(b[0]) + add))
	}
	if len(b) < 2 {
		return ""
	}
	u := make([]uint16, 0, len(b)/2)
	for i := 0; i+1 < len(b); i += 2 {
		u = append(u, uint16(b[i])<<8|uint16(b[i+1]))
	}
	u[len(u)-1] += uint16(add)
	return string(utf16.Decode(u))
}

// parseCMap reads the bfchar, bfrange and codespacerange sections of a ToUnicode CMap.
// Targets are UTF-16BE, surrogate pairs included. It stops at maxCMapEntries.
func parseCMap(data []byte) cmap {
	if len(data) > maxCMapBytes {
		data = data[:maxCMapBytes]
	}
	cm := cmap{m: map[uint32]string{}}
	p := parser{b: data, noRefs: true}
	var items []any
	for {
		v, ok := p.value(0)
		if !ok {
			return cm
		}
		kw, isKw := v.(pkw)
		if !isKw {
			items = append(items, v)
			continue
		}
		switch kw {
		case "beginbfchar", "beginbfrange", "begincodespacerange":
			items = items[:0]
		case "endcodespacerange":
			if len(items) >= 1 && cm.width == 0 {
				if lo, ok := items[0].(pstr); ok {
					cm.width = len(lo)
				}
			}
		case "endbfchar":
			for i := 0; i+1 < len(items) && len(cm.m) < maxCMapEntries; i += 2 {
				src, ok1 := items[i].(pstr)
				dst, ok2 := items[i+1].(pstr)
				if ok1 && ok2 {
					cm.m[uint32(beInt(src))] = decodeTarget(dst, 0)
				}
			}
		case "endbfrange":
			for i := 0; i+2 < len(items) && len(cm.m) < maxCMapEntries; i += 3 {
				lo, ok1 := items[i].(pstr)
				hi, ok2 := items[i+1].(pstr)
				if !ok1 || !ok2 {
					continue
				}
				l, h := uint32(beInt(lo)), uint32(beInt(hi))
				if h < l || h-l > 0xFFFF {
					continue
				}
				switch dst := items[i+2].(type) {
				case pstr:
					for k := uint32(0); k <= h-l && len(cm.m) < maxCMapEntries; k++ {
						cm.m[l+k] = decodeTarget(dst, int(k))
					}
				case parr:
					for k := uint32(0); k <= h-l && int(k) < len(dst); k++ {
						if t, ok := dst[k].(pstr); ok {
							cm.m[l+k] = decodeTarget(t, 0)
						}
					}
				}
			}
		}
		if strings.HasPrefix(string(kw), "end") {
			items = items[:0]
		}
	}
}

// ---- encodings and glyph names -----------------------------------------------------------------

const (
	winAnsiHigh = "€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008dŽ\u008f" +
		"\u0090‘’“”•–—˜™š›œ\u009džŸ"
	macRomanHigh = "ÄÅÇÉÑÖÜáàâäãåçéèêëíìîïñóòôöõúùûü†°¢£§•¶ß®©™´¨≠ÆØ∞±≤≥¥µ∂∑∏π∫ªºΩæø" +
		"¿¡¬√ƒ≈∆«»… ÀÃÕŒœ–—“”‘’÷◊ÿŸ⁄€‹›ﬁﬂ‡·‚„‰ÂÊÁËÈÍÎÏÌÓÔÒÚÛÙıˆ˜¯˘˙˚¸˝˛ˇ"
	latinNames = "space exclamdown cent sterling currency yen brokenbar section dieresis copyright ordfeminine " +
		"guillemotleft logicalnot sfthyphen registered macron degree plusminus twosuperior threesuperior acute mu " +
		"paragraph periodcentered cedilla onesuperior ordmasculine guillemotright onequarter onehalf threequarters " +
		"questiondown Agrave Aacute Acircumflex Atilde Adieresis Aring AE Ccedilla Egrave Eacute Ecircumflex " +
		"Edieresis Igrave Iacute Icircumflex Idieresis Eth Ntilde Ograve Oacute Ocircumflex Otilde Odieresis " +
		"multiply Oslash Ugrave Uacute Ucircumflex Udieresis Yacute Thorn germandbls agrave aacute acircumflex " +
		"atilde adieresis aring ae ccedilla egrave eacute ecircumflex edieresis igrave iacute icircumflex idieresis " +
		"eth ntilde ograve oacute ocircumflex otilde odieresis divide oslash ugrave uacute ucircumflex udieresis " +
		"yacute thorn ydieresis"
	asciiNames = "space exclam quotedbl numbersign dollar percent ampersand quotesingle parenleft parenright " +
		"asterisk plus comma hyphen period slash zero one two three four five six seven eight nine colon " +
		"semicolon less equal greater question at"
)

// standardHigh is StandardEncoding above ASCII, plus its two differences inside ASCII.
var standardHigh = map[int]rune{
	0x27: 0x2019, 0x60: 0x2018,
	0xA1: 0xA1, 0xA2: 0xA2, 0xA3: 0xA3, 0xA4: 0x2044, 0xA5: 0xA5, 0xA6: 0x192, 0xA7: 0xA7, 0xA8: 0xA4,
	0xA9: 0x27, 0xAA: 0x201C, 0xAB: 0xAB, 0xAC: 0x2039, 0xAD: 0x203A, 0xAE: 0xFB01, 0xAF: 0xFB02,
	0xB1: 0x2013, 0xB2: 0x2020, 0xB3: 0x2021, 0xB4: 0xB7, 0xB6: 0xB6, 0xB7: 0x2022, 0xB8: 0x201A,
	0xB9: 0x201E, 0xBA: 0x201D, 0xBB: 0xBB, 0xBC: 0x2026, 0xBD: 0x2030, 0xBF: 0xBF,
	0xC1: 0x60, 0xC2: 0xB4, 0xC3: 0x2C6, 0xC4: 0x2DC, 0xC5: 0xAF, 0xC6: 0x2D8, 0xC7: 0x2D9, 0xC8: 0xA8,
	0xCA: 0x2DA, 0xCB: 0xB8, 0xCD: 0x2DD, 0xCE: 0x2DB, 0xCF: 0x2C7, 0xD0: 0x2014,
	0xE1: 0xC6, 0xE3: 0xAA, 0xE8: 0x141, 0xE9: 0xD8, 0xEA: 0x152, 0xEB: 0xBA,
	0xF1: 0xE6, 0xF5: 0x131, 0xF8: 0x142, 0xF9: 0xF8, 0xFA: 0x153, 0xFB: 0xDF,
}

func baseEncoding(name string) [256]string {
	var t [256]string
	for i := range t {
		t[i] = string(rune(i))
	}
	switch name {
	case "WinAnsiEncoding":
		for i, c := range []rune(winAnsiHigh) {
			t[0x80+i] = string(c)
		}
	case "MacRomanEncoding":
		for i, c := range []rune(macRomanHigh) {
			t[0x80+i] = string(c)
		}
	case "StandardEncoding":
		for i := 0x80; i < 256; i++ {
			t[i] = ""
		}
		for i, c := range standardHigh {
			t[i] = string(c)
		}
	}
	return t
}

var glyphTable = func() map[string]rune {
	m := map[string]rune{}
	for i, n := range strings.Fields(asciiNames) {
		m[n] = rune(0x20 + i)
	}
	for c := 'A'; c <= 'Z'; c++ {
		m[string(c)] = c
	}
	for c := 'a'; c <= 'z'; c++ {
		m[string(c)] = c
	}
	for i, n := range strings.Fields("bracketleft backslash bracketright asciicircum underscore grave") {
		m[n] = rune(0x5B + i)
	}
	for i, n := range strings.Fields("braceleft bar braceright asciitilde") {
		m[n] = rune(0x7B + i)
	}
	for i, n := range strings.Fields(latinNames) {
		if _, taken := m[n]; !taken { // "space" is U+0020, not the no-break space at 0xA0
			m[n] = rune(0xA0 + i)
		}
	}
	for n, c := range map[string]rune{
		"quoteright": 0x2019, "quoteleft": 0x2018, "quotedblleft": 0x201C, "quotedblright": 0x201D,
		"quotesinglbase": 0x201A, "quotedblbase": 0x201E, "endash": 0x2013, "emdash": 0x2014, "bullet": 0x2022,
		"ellipsis": 0x2026, "dagger": 0x2020, "daggerdbl": 0x2021, "perthousand": 0x2030, "guilsinglleft": 0x2039,
		"guilsinglright": 0x203A, "Euro": 0x20AC, "trademark": 0x2122, "OE": 0x152, "oe": 0x153, "Scaron": 0x160,
		"scaron": 0x161, "Zcaron": 0x17D, "zcaron": 0x17E, "Ydieresis": 0x178, "florin": 0x192, "circumflex": 0x2C6,
		"tilde": 0x2DC, "fraction": 0x2044, "dotlessi": 0x131, "Lslash": 0x141, "lslash": 0x142, "minus": 0x2212,
		"nbspace": 0xA0, "nonbreakingspace": 0xA0, "ring": 0x2DA, "caron": 0x2C7, "breve": 0x2D8, "dotaccent": 0x2D9,
		"hungarumlaut": 0x2DD, "ogonek": 0x2DB, "fi": 0xFB01, "fl": 0xFB02, "ff": 0xFB00, "ffi": 0xFB03,
		"ffl": 0xFB04, "multiply": 0xD7, "Omega": 0x3A9, "pi": 0x3C0, "mu": 0xB5,
	} {
		m[n] = c
	}
	return m
}()

func hexRunes(s string) (string, bool) {
	var sb strings.Builder
	for len(s) > 0 {
		n := 4
		if len(s) < 4 {
			return "", false
		}
		v, err := strconv.ParseUint(s[:n], 16, 32)
		if err != nil {
			return "", false
		}
		sb.WriteRune(rune(v))
		s = s[n:]
	}
	return sb.String(), true
}

// glyphString maps a glyph name to text: the table, a "uniXXXX" or "uXXXX" form, a
// ligature written as parts joined by underscores, and a name with a ".suffix". An
// unknown name gives "".
func glyphString(name string) string {
	if i := strings.IndexByte(name, '.'); i > 0 {
		name = name[:i]
	}
	if c, ok := glyphTable[name]; ok {
		return string(c)
	}
	if strings.Contains(name, "_") {
		var sb strings.Builder
		for _, part := range strings.Split(name, "_") {
			sb.WriteString(glyphString(part))
		}
		return sb.String()
	}
	if strings.HasPrefix(name, "uni") && len(name) >= 7 && (len(name)-3)%4 == 0 {
		if s, ok := hexRunes(name[3:]); ok {
			return s
		}
	}
	if strings.HasPrefix(name, "u") && len(name) >= 5 && len(name) <= 7 {
		if v, err := strconv.ParseUint(name[1:], 16, 32); err == nil && v <= unicode.MaxRune {
			return string(rune(v))
		}
	}
	return ""
}

// ---- content streams ---------------------------------------------------------------------------

type matrix [6]float64

// mul applies m first and then n, the PDF convention for row vectors.
func (m matrix) mul(n matrix) matrix {
	return matrix{
		m[0]*n[0] + m[1]*n[2], m[0]*n[1] + m[1]*n[3],
		m[2]*n[0] + m[3]*n[2], m[2]*n[1] + m[3]*n[3],
		m[4]*n[0] + m[5]*n[2] + n[4], m[4]*n[1] + m[5]*n[3] + n[5],
	}
}

var identity = matrix{1, 0, 0, 1, 0, 0}

// pdfText turns the text-showing operators of one page into paragraphs.
//
// THE LAYOUT RULES, all of them. Only the vertical position and the font size are used.
//   - A string at nearly the same height as the one before (within 0.3 of the size) is
//     the same line. If the text position was moved since, with Td, Tm or the like, a
//     space goes between the two; a string that simply continues the last one does not
//     get one. A TJ number below -200 is a space.
//   - A string at another height is a new line. The smallest line step seen on the page
//     is the line pitch (before one is known, 1.6 times the font size separates a
//     paragraph from a line). A step above 1.5 times the pitch ends the paragraph; any
//     other step joins the lines with a space.
//   - Joining lines drops a hyphen at the end of the first line when, and only when,
//     the character before it is a letter and the next line starts with a lower-case
//     letter.
type pdfText struct {
	r     *pdfReader
	paras []string
	cur   []byte

	have, brk, moved bool
	lastY, pitch     float64

	ctm    matrix
	stack  []matrix
	tm, lm matrix
	font   *pdfFont
	size   float64
	lead   float64
}

// decodeContent inflates a stream that is read once and dropped.
func (r *pdfReader) decodeContent(s *pdfStream) ([]byte, error) {
	r.transient = true
	defer func() { r.transient = false }()
	return r.decode(s)
}

// canShowText is false for a page whose resources name no font and no form XObject: its
// content cannot draw text, so it is not inflated at all. A scanned page, or one with
// its letters traced as vector paths, is skipped here at no cost.
func (r *pdfReader) canShowText(res pdict) bool {
	if len(r.dict(res["Font"])) > 0 {
		return true
	}
	for _, x := range r.dict(res["XObject"]) {
		if r.name(r.dict(x)["Subtype"]) == "Form" {
			return true
		}
	}
	return false
}

func (r *pdfReader) pageText(pg pdfPage) []string {
	if !r.canShowText(pg.res) {
		return nil
	}
	var data []byte
	switch c := r.resolve(pg.dict["Contents"]).(type) {
	case *pdfStream:
		b, err := r.decodeContent(c)
		if err != nil {
			return nil
		}
		data = b
	case parr:
		for _, el := range c {
			s := r.stream(el)
			if s == nil {
				continue
			}
			b, err := r.decodeContent(s)
			if err != nil {
				return nil // one unreadable piece makes the page unreadable
			}
			data = append(data, b...)
			data = append(data, '\n')
		}
	}
	if len(data) == 0 {
		return nil
	}
	e := &pdfText{r: r, ctm: identity, tm: identity, lm: identity}
	e.run(data, pg.res, 0)
	e.flush()
	return e.paras
}

func nums(args []any, k int) ([]float64, bool) {
	if len(args) < k {
		return nil, false
	}
	out := make([]float64, k)
	for i := 0; i < k; i++ {
		f, ok := args[len(args)-k+i].(float64)
		if !ok {
			return nil, false
		}
		out[i] = f
	}
	return out, true
}

func (e *pdfText) move(tx, ty float64) {
	e.lm = matrix{1, 0, 0, 1, tx, ty}.mul(e.lm)
	e.tm = e.lm
	e.moved = true
}

func (e *pdfText) run(data []byte, res pdict, depth int) {
	p := parser{b: data, noRefs: true}
	var args []any
	for {
		v, ok := p.value(0)
		if !ok {
			return
		}
		kw, isKw := v.(pkw)
		if !isKw {
			if args = append(args, v); len(args) > 128 {
				args = args[1:]
			}
			continue
		}
		switch kw {
		case "q":
			if len(e.stack) < 256 {
				e.stack = append(e.stack, e.ctm)
			}
		case "Q":
			if n := len(e.stack); n > 0 {
				e.ctm, e.stack = e.stack[n-1], e.stack[:n-1]
			}
		case "cm":
			if f, ok := nums(args, 6); ok {
				e.ctm = matrix{f[0], f[1], f[2], f[3], f[4], f[5]}.mul(e.ctm)
			}
		case "BT":
			e.tm, e.lm, e.moved = identity, identity, true
		case "Tf":
			if len(args) >= 2 {
				if n, ok := args[len(args)-2].(pname); ok {
					e.font = e.r.fontFor(res, string(n))
				}
				if s, ok := args[len(args)-1].(float64); ok {
					e.size = s
				}
			}
		case "TL":
			if f, ok := nums(args, 1); ok {
				e.lead = f[0]
			}
		case "Td":
			if f, ok := nums(args, 2); ok {
				e.move(f[0], f[1])
			}
		case "TD":
			if f, ok := nums(args, 2); ok {
				e.lead = -f[1]
				e.move(f[0], f[1])
			}
		case "Tm":
			if f, ok := nums(args, 6); ok {
				e.tm = matrix{f[0], f[1], f[2], f[3], f[4], f[5]}
				e.lm, e.moved = e.tm, true
			}
		case "T*":
			e.move(0, -e.lead)
		case "Tj", "'", "\"":
			if kw != "Tj" {
				e.move(0, -e.lead)
			}
			if len(args) > 0 {
				if s, ok := args[len(args)-1].(pstr); ok {
					e.show(s)
				}
			}
		case "TJ":
			if len(args) > 0 {
				if a, ok := args[len(args)-1].(parr); ok {
					for _, el := range a {
						switch t := el.(type) {
						case pstr:
							e.show(t)
						case float64:
							if t < -200 {
								e.space()
							}
						}
					}
				}
			}
		case "Do":
			e.form(args, res, depth)
		case "ID":
			// Inline image data is binary: skip to the EI that ends it.
			p.pos++
			for p.pos < len(data) {
				i := bytes.Index(data[p.pos:], []byte("EI"))
				if i < 0 {
					p.pos = len(data)
					break
				}
				at := p.pos + i
				p.pos = at + 2
				if at > 0 && isSpace(data[at-1]) && (at+2 >= len(data) || isSpace(data[at+2])) {
					break
				}
			}
		}
		args = args[:0]
		if e.r.over {
			return
		}
	}
}

// form runs a form XObject's own content stream, inside the current graphics state.
func (e *pdfText) form(args []any, res pdict, depth int) {
	if depth >= maxPDFForms || len(args) == 0 {
		return
	}
	n, ok := args[len(args)-1].(pname)
	if !ok {
		return
	}
	s := e.r.stream(e.r.dict(res["XObject"])[string(n)])
	if s == nil || e.r.name(s.dict["Subtype"]) != "Form" {
		return
	}
	data, err := e.r.decodeForm(s)
	if err != nil {
		return
	}
	saved, savedStack := e.ctm, e.stack
	if m := e.r.arr(s.dict["Matrix"]); len(m) == 6 {
		var f matrix
		for i := range f {
			f[i], _ = e.r.num(m[i])
		}
		e.ctm = f.mul(e.ctm)
	}
	fres := e.r.dict(s.dict["Resources"])
	if fres == nil {
		fres = res
	}
	e.run(data, fres, depth+1)
	e.ctm, e.stack = saved, savedStack
}

func (e *pdfText) lastRune() rune {
	r, _ := utf8.DecodeLastRune(e.cur)
	if len(e.cur) == 0 {
		return 0
	}
	return r
}

func (e *pdfText) space() {
	if len(e.cur) > 0 && e.lastRune() != ' ' {
		e.cur = append(e.cur, ' ')
	}
}

func (e *pdfText) flush() {
	if t := tidyPDFText(string(e.cur)); t != "" {
		e.paras = append(e.paras, t)
	}
	e.cur, e.have, e.brk = e.cur[:0], false, false // the line pitch carries over
}

func isHyphen(c rune) bool { return c == '-' || c == 0xAD || c == 0x2010 }

func (e *pdfText) show(b []byte) {
	f := e.font
	if f == nil {
		f = latin1Font
	}
	s := f.decode(b)
	if s == "" {
		return
	}
	trm := e.tm.mul(e.ctm)
	y := trm[5]
	size := math.Abs(e.size) * math.Hypot(trm[2], trm[3])
	if size == 0 {
		size = math.Abs(e.size)
	}
	if size == 0 {
		size = 10
	}
	spaced := false
	if !e.have {
		e.have = true
	} else if dy := math.Abs(y - e.lastY); dy > 0.3*size {
		para := false
		switch {
		case e.pitch == 0:
			if dy > 1.6*size {
				para = true
			} else {
				e.pitch = dy
			}
		default:
			if dy < e.pitch {
				e.pitch = dy
			}
			para = dy > 1.5*e.pitch
		}
		if para {
			e.flush()
			e.have = true
		} else {
			e.brk = true
		}
	} else if e.moved {
		spaced = true
	}
	e.lastY, e.moved = y, false
	first, _ := utf8.DecodeRuneInString(s)
	switch {
	case e.brk:
		e.brk = false
		last := e.lastRune()
		if isHyphen(last) {
			rest := e.cur[:len(e.cur)-utf8.RuneLen(last)]
			if before, _ := utf8.DecodeLastRune(rest); unicode.IsLetter(before) && unicode.IsLower(first) {
				e.cur = rest
				break
			}
		}
		if last != ' ' && first != ' ' && len(e.cur) > 0 {
			e.cur = append(e.cur, ' ')
		}
	case spaced:
		if len(e.cur) > 0 && e.lastRune() != ' ' && first != ' ' {
			e.cur = append(e.cur, ' ')
		}
	}
	e.cur = append(e.cur, s...)
}

// tidyPDFText makes a paragraph's text plain: control characters and runs of whitespace
// become one space, a soft hyphen inside a word goes, and the f-ligatures are spelled
// out so a search for "office" finds it.
func tidyPDFText(s string) string {
	var sb strings.Builder
	for _, c := range s {
		switch {
		case c == 0xAD || c == 0xFFFD:
		case c >= 0xFB00 && c <= 0xFB04:
			sb.WriteString([]string{"ff", "fi", "fl", "ffi", "ffl"}[c-0xFB00])
		case unicode.IsControl(c):
			sb.WriteByte(' ')
		default:
			sb.WriteRune(c)
		}
	}
	return strings.Join(strings.Fields(sb.String()), " ")
}
