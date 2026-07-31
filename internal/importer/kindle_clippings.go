package importer

import (
	"fmt"
	"io"
	"regexp"
	"strings"
)

// Kindle's on-device "My Clippings.txt": every highlight, note and bookmark the
// device has ever recorded, appended in order, one book after another, separated
// by a line of ten equals signs.
//
// The format is undocumented and varies by device generation, firmware and — the
// part that hurts — the Kindle's UI language, which localises the whole metadata
// line. So this parser reads STRUCTURE, not English:
//
//	<title> (<author>)
//	- <metadata: kind · position · date, any language, "|"-separated>
//	<blank>
//	<the highlighted text, or the note>
//	==========
//
// Everything that decides what a record IS comes from the structure — the
// separator, the leading "- ", the "|" splits, digit runs, and whether the body
// is empty. Language keywords are only ever an ENHANCEMENT on top: they can
// promote a highlight to a note, never rescue a block the structure rejected.
// Keywords are matched on word boundaries and only in the metadata line's first
// field, because a chapter title like "NOTES ON THE CLOCK TOWER" would otherwise
// turn a highlight into a note and swallow the chapter.
//
// The result is best-effort by nature. handleImportKindleClippings surfaces what
// was skipped rather than failing the whole file, and the UI says the format is
// experimental.
var (
	// A block separator: ten '=' in the wild, but accept any run so a
	// hand-edited file still parses.
	clipSepRe = regexp.MustCompile(`^={5,}$`)
	// The last parenthesised group on the title line, which is where Kindle puts
	// the author(s). Anchored at end-of-line so a title containing brackets —
	// "Dracula (Penguin Classics) (Bram Stoker)" — takes the right one.
	clipAuthorRe = regexp.MustCompile(`^(.*)\(([^()]*)\)\s*$`)
	// A parenthesised group that is a printing detail, not a person.
	clipNotAuthorRe = regexp.MustCompile(`(?i)^\s*(\d{4}|[ivxlc]+|(unabridged|abridged|illustrated|annotated|translated|edition|ed\.|vol\.?|volume|book|part|series|#)\b.*)\s*$`)
	// A digit run, optionally a range ("610-612", "1,234").
	clipNumRe = regexp.MustCompile(`\d[\d,]*(\s*-\s*\d[\d,]*)?`)
	// A date tail: Kindle writes wildly different orders per locale, but every
	// one carries either a clock time or a four-digit year, and no position
	// field ever does.
	clipDateRe = regexp.MustCompile(`\d{1,2}:\d{2}|\b(19|20)\d{2}\b`)
)

// clipNoteWords promotes a record to a note. Deliberately short and
// conservative: a missing language just leaves the record a highlight, which is
// the safe failure — the text is still imported, only its field is less exact.
// Every entry is matched \b-delimited against the metadata line's FIRST field.
// German and French are here because their words are long enough to be
// unambiguous; the Romance "nota" is not (it is inside "notary", "annotated")
// and is therefore matched only as a whole word too.
var clipNoteWords = []string{"note", "notiz", "nota", "anotación", "anotacao", "anotação", "notatie", "メモ", "笔记", "筆記"}

// clipPosWords mark a field as a position rather than a chapter. Only used when
// the field also contains digits, so a chapter called "Page One" is safe and a
// bare "Loc" can never match a "clock".
var clipPosWords = []string{
	"page", "location", "loc.", "loc", // en
	"seite", "position", // de
	"página", "pagina", "posición", "posicion", "posição", "posicao", // es/pt/it
	"emplacement", // fr
	"位置", "页",     // ja/zh
}

// clipRecord is one parsed block, before grouping and note-merging.
type clipRecord struct {
	book  Book
	ann   Annotation
	isNote bool
	pos   string // normalised position ("p.11", "loc.610-612"), "" when absent
}

// KindleClippings parses a Kindle "My Clippings.txt" into one Result per book,
// in first-appearance order. Bookmarks and bodiless records are skipped; the
// counts come back via the returned stats so the caller can tell the user what
// was dropped rather than silently losing it.
func KindleClippings(r io.Reader) ([]*Result, ClippingStats, error) {
	var stats ClippingStats
	lines, err := clipLines(r)
	if err != nil {
		return nil, stats, err
	}
	if len(lines) == 0 {
		return nil, stats, fmt.Errorf("kindle clippings: the file is empty")
	}

	var recs []clipRecord
	for _, block := range clipBlocks(lines) {
		rec, ok := parseClipBlock(block, &stats)
		if !ok {
			continue
		}
		recs = append(recs, rec)
	}
	if len(recs) == 0 {
		if stats.Bookmarks > 0 && stats.Malformed == 0 {
			return nil, stats, fmt.Errorf("kindle clippings: only bookmarks in this file — they carry no text to import")
		}
		return nil, stats, fmt.Errorf("kindle clippings: no highlights or notes found — is this My Clippings.txt?")
	}
	return groupClippings(recs, &stats), stats, nil
}

// ClippingStats reports what the parse threw away, so the import result can say
// so out loud instead of quietly returning fewer quotes than the file held.
type ClippingStats struct {
	Bookmarks   int // no body: a bookmark, or a selection Kindle recorded empty
	Malformed   int // a block that isn't shaped like a record at all
	NotesMerged int // notes folded onto the highlight they annotate
	Duplicates  int // Kindle re-appends a whole record when a highlight is edited
}

// clipLines reads the file into lines, stripping the UTF-8 BOM Kindle writes and
// the CR of CRLF endings. Deliberately not markdown.go's readLines: that wraps
// its errors "markdown: …", which would surface to the user on the wrong import.
func clipLines(r io.Reader) ([]string, error) {
	data, err := io.ReadAll(r) // the caller caps the upload size
	if err != nil {
		return nil, fmt.Errorf("kindle clippings: %w", err)
	}
	text := strings.TrimPrefix(string(data), "\ufeff")
	text = strings.ReplaceAll(text, "\r\n", "\n")
	text = strings.ReplaceAll(text, "\r", "\n")
	if strings.TrimSpace(text) == "" {
		return nil, nil
	}
	return strings.Split(text, "\n"), nil
}

// clipBlocks splits on separator lines and drops each block's surrounding blank
// lines. A file with no trailing separator still yields its last block, and a
// leading separator (or a doubled one) yields nothing rather than a phantom.
func clipBlocks(lines []string) [][]string {
	var out [][]string
	var cur []string
	flush := func() {
		for len(cur) > 0 && strings.TrimSpace(cur[0]) == "" {
			cur = cur[1:]
		}
		for len(cur) > 0 && strings.TrimSpace(cur[len(cur)-1]) == "" {
			cur = cur[:len(cur)-1]
		}
		if len(cur) > 0 {
			out = append(out, cur)
		}
		cur = nil
	}
	for _, ln := range lines {
		if clipSepRe.MatchString(strings.TrimSpace(ln)) {
			flush()
			continue
		}
		cur = append(cur, ln)
	}
	flush()
	return out
}

// parseClipBlock turns one block into a record. Returns false for anything not
// shaped like a record, and for bookmarks — both are counted, never guessed at.
func parseClipBlock(block []string, stats *ClippingStats) (clipRecord, bool) {
	var rec clipRecord
	// A record is at minimum a title line and a metadata line. Anything shorter
	// is a truncated head (a USB yank mid-copy) or hand-edited debris.
	if len(block) < 2 || !strings.HasPrefix(strings.TrimSpace(block[1]), "-") {
		stats.Malformed++
		return rec, false
	}
	rec.book.Title, rec.book.Author = splitClipTitle(block[0])
	if rec.book.Title == "" {
		stats.Malformed++
		return rec, false
	}

	body := strings.TrimSpace(strings.Join(block[2:], "\n"))
	if body == "" {
		// A bookmark, or a selection the device recorded with no text. Either
		// way there is nothing to import — and nothing to guess.
		stats.Bookmarks++
		return rec, false
	}

	meta := strings.TrimSpace(strings.TrimLeft(strings.TrimSpace(block[1]), "-"))
	fields := strings.Split(meta, "|")
	for i := range fields {
		fields[i] = strings.TrimSpace(fields[i])
	}

	rec.isNote = len(fields) > 0 && hasClipWord(fields[0], clipNoteWords)
	rec.pos, rec.ann.Chapter, rec.ann.NotedAt = readClipFields(fields)
	rec.ann.Location = rec.pos
	if rec.isNote {
		rec.ann.Note = body
	} else {
		rec.ann.Quote = body
	}
	return rec, true
}

// readClipFields walks the metadata line's "|"-separated fields and classifies
// each by shape, not by language: a field carrying a clock time or a four-digit
// year is the "added on" date; a field carrying digits next to a position word
// (or nothing but digits) is the position; whatever is left is the chapter or
// section name, which is what the user's own sample puts there.
func readClipFields(fields []string) (pos, chapter, noted string) {
	for i, f := range fields {
		if f == "" {
			continue
		}
		low := strings.ToLower(f)
		if clipDateRe.MatchString(f) {
			if noted == "" {
				noted = f
			}
			continue
		}
		num := clipNumRe.FindString(f)
		if num != "" && (hasClipWord(low, clipPosWords) || strings.TrimSpace(clipNumRe.ReplaceAllString(f, "")) == "") {
			if p := formatClipPos(low, num); pos == "" {
				pos = p
			}
			continue
		}
		// Field 0 also carries the kind ("Your Highlight on…"), so it is never a
		// chapter on its own; every later unclassified field is.
		if i > 0 && chapter == "" {
			chapter = f
		}
	}
	return pos, chapter, noted
}

// formatClipPos renders a position the way the rest of the app writes one: a
// page as "p.N", anything else as the bare number, so the Library's "P.<loc>"
// label reads correctly either way.
func formatClipPos(lowField, num string) string {
	num = strings.ReplaceAll(strings.ReplaceAll(num, " ", ""), ",", "")
	if hasClipWord(lowField, []string{"page", "seite", "página", "pagina", "página", "页"}) {
		return "p." + num
	}
	return num
}

// hasClipWord reports whether any needle appears in s on word boundaries. The
// boundary check is what makes the short entries safe: "loc" must not match
// "clock", "nota" must not match "notary", "page" must not match "pageant".
func hasClipWord(s string, words []string) bool {
	low := strings.ToLower(s)
	for _, w := range words {
		for i := 0; ; {
			j := strings.Index(low[i:], w)
			if j < 0 {
				break
			}
			at := i + j
			if clipBoundary(low, at, at+len(w)) {
				return true
			}
			i = at + 1
			if i >= len(low) {
				break
			}
		}
	}
	return false
}

// clipBoundary reports whether low[start:end] is delimited by non-letters. CJK
// needles carry no boundaries of their own, so they always pass.
func clipBoundary(low string, start, end int) bool {
	isWord := func(b byte) bool {
		return b >= 'a' && b <= 'z' || b >= '0' && b <= '9' || b >= 0x80
	}
	if start > 0 && isWord(low[start-1]) && low[start] < 0x80 {
		return false
	}
	if end < len(low) && isWord(low[end]) && low[end-1] < 0x80 {
		return false
	}
	return true
}

// splitClipTitle pulls the author out of "Title (Author)". The author is the
// LAST parenthesised group, so a title that contains brackets of its own keeps
// them. A group that reads as a printing detail rather than a person — a year,
// "(Unabridged)", "(Book 3)" — is left on the title.
//
// The author string is kept VERBATIM. Kindle writes both "(Marshall, Michael)"
// and "(Margaret Hunt, Wilhelm Grimm, Jacob Grimm)" and the two are
// indistinguishable without guessing; re-ordering the first would mangle the
// second, and splitting on " and " / " y " would turn José Ortega y Gasset into
// two people. Whatever the file says is what the book gets.
func splitClipTitle(line string) (title, author string) {
	t := strings.TrimSpace(line)
	m := clipAuthorRe.FindStringSubmatch(t)
	if m == nil {
		return t, ""
	}
	inner := strings.TrimSpace(m[2])
	head := strings.TrimSpace(m[1])
	if inner == "" || head == "" || clipNotAuthorRe.MatchString(inner) {
		return t, ""
	}
	return head, inner
}

// groupClippings folds records into one Result per book (first-appearance
// order), merges each note onto the highlight it annotates, and drops the
// near-duplicates Kindle leaves behind when a highlight is extended.
func groupClippings(recs []clipRecord, stats *ClippingStats) []*Result {
	var order []string
	byKey := map[string]*Result{}
	for _, rec := range recs {
		key := strings.ToLower(rec.book.Title) + "\x00" + strings.ToLower(rec.book.Author)
		res := byKey[key]
		if res == nil {
			res = &Result{Book: rec.book}
			byKey[key] = res
			order = append(order, key)
		}
		if rec.isNote && mergeClipNote(res, rec, stats) {
			continue
		}
		if !rec.isNote && dropClipDuplicate(res, rec, stats) {
			continue
		}
		res.Annotations = append(res.Annotations, rec.ann)
	}
	out := make([]*Result, 0, len(order))
	for _, k := range order {
		// A book whose every record was a bookmark would otherwise be created
		// empty — a phantom row in the library with nothing in it.
		if res := byKey[k]; len(res.Annotations) > 0 {
			out = append(out, res)
		}
	}
	return out
}

// mergeClipNote folds a note onto the highlight it annotates. Kindle emits the
// note as its own record immediately after the highlight, at the same position —
// so the merge requires BOTH: the previous annotation of the same book, and a
// non-empty position they agree on. Without a position to key on (the format
// carries none on some devices) the note stays a note-only annotation rather
// than being attached to whatever happened to come before it.
func mergeClipNote(res *Result, rec clipRecord, stats *ClippingStats) bool {
	if rec.pos == "" || len(res.Annotations) == 0 {
		return false
	}
	prev := &res.Annotations[len(res.Annotations)-1]
	if prev.Quote == "" || prev.Note != "" || prev.Location != rec.pos {
		return false
	}
	prev.Note = rec.ann.Note
	stats.NotesMerged++
	return true
}

// dropClipDuplicate handles Kindle's habit of appending the WHOLE record again
// when a highlight is edited or extended in place: the file ends up with two
// records at the same position, one a prefix of the other. Keep the longer.
func dropClipDuplicate(res *Result, rec clipRecord, stats *ClippingStats) bool {
	nq := clipNorm(rec.ann.Quote)
	for i := range res.Annotations {
		a := &res.Annotations[i]
		if a.Quote == "" {
			continue
		}
		na := clipNorm(a.Quote)
		same := na == nq ||
			(a.Location != "" && a.Location == rec.ann.Location &&
				(strings.HasPrefix(na, nq) || strings.HasPrefix(nq, na)))
		if !same {
			continue
		}
		stats.Duplicates++
		if len(rec.ann.Quote) > len(a.Quote) {
			// The later, longer record wins — but keep any note already merged
			// onto the one being replaced.
			note := a.Note
			a.Quote = rec.ann.Quote
			if a.Note == "" {
				a.Note = note
			}
		}
		return true
	}
	return false
}

// clipNorm folds a quote for duplicate comparison: case and whitespace only. It
// deliberately does NOT reach for the store's typographic fold — importer stays
// dependency-free — and the comparison is only ever used within one book.
func clipNorm(s string) string {
	return strings.Join(strings.Fields(strings.ToLower(s)), " ")
}
