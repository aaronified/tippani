package importer

import (
	"bufio"
	"errors"
	"fmt"
	"io"
	"regexp"
	"strconv"
	"strings"
)

// Markdown parses an uploaded markdown export, auto-detecting the shape
// (PLAN 5b): a first non-blank line of "---" is the Tippani frontmatter
// format (a); a "# " heading is a Readest "Highlights & Annotations" export
// (b); anything else is a clear error. Tolerates a UTF-8 BOM and CRLF.
func Markdown(r io.Reader) (*Result, error) {
	lines, err := readLines(r)
	if err != nil {
		return nil, err
	}
	for i, line := range lines {
		if strings.TrimSpace(line) == "" {
			continue
		}
		switch {
		case line == "---":
			return parseFrontmatter(lines[i+1:])
		case strings.HasPrefix(line, "# "):
			return parseReadest(lines[i:])
		}
		break
	}
	return nil, errors.New(`markdown: unrecognized format (expected "---" frontmatter or a "# Title" heading)`)
}

// MarkdownAll parses an export that may hold MANY books — the multi-book ".md"
// that the export endpoints produce, where each book keeps its own "---"
// frontmatter block — returning one Result per book. A single-book file (one
// frontmatter block, or a Readest "# Title" export) yields a one-element slice,
// so callers can treat every markdown import uniformly. Book boundaries are the
// frontmatter "---" delimiters; Tippani exports never emit a bare "---" in the
// body, so the open+close pairs alone locate each book.
func MarkdownAll(r io.Reader) ([]*Result, error) {
	lines, err := readLines(r)
	if err != nil {
		return nil, err
	}
	first := -1
	for i, l := range lines {
		if strings.TrimSpace(l) != "" {
			first = i
			break
		}
	}
	if first < 0 {
		return nil, errors.New("markdown: empty file")
	}
	// Readest export → a single book (no frontmatter blocks to split on).
	if strings.HasPrefix(lines[first], "# ") {
		res, err := parseReadest(lines[first:])
		if err != nil {
			return nil, err
		}
		return []*Result{res}, nil
	}
	if lines[first] != "---" {
		return nil, errors.New(`markdown: unrecognized format (expected "---" frontmatter or a "# Title" heading)`)
	}
	// Collect the opening "---" of each book. Each book contributes an open+close
	// pair and its body has no bare "---", so the opens are every other "---".
	var opens []int
	inFM := false
	for i := first; i < len(lines); i++ {
		if lines[i] != "---" {
			continue
		}
		if inFM {
			inFM = false // closing this book's frontmatter
		} else {
			opens = append(opens, i) // opening the next book
			inFM = true
		}
	}
	var out []*Result
	for k, start := range opens {
		end := len(lines)
		if k+1 < len(opens) {
			end = opens[k+1]
		}
		res, err := parseFrontmatter(lines[start+1 : end])
		if err != nil {
			return nil, fmt.Errorf("book %d: %w", k+1, err)
		}
		out = append(out, res)
	}
	return out, nil
}

// readLines slurps the upload (callers cap the size, PLAN §5), normalizing
// CRLF and stripping a UTF-8 BOM.
func readLines(r io.Reader) ([]string, error) {
	sc := bufio.NewScanner(r)
	sc.Buffer(make([]byte, 64*1024), 1<<20) // default 64 KB cap errors on long lines (PLAN 5c)
	var lines []string
	for sc.Scan() {
		lines = append(lines, strings.TrimSuffix(sc.Text(), "\r"))
	}
	if err := sc.Err(); err != nil {
		return nil, fmt.Errorf("markdown: %w", err)
	}
	if len(lines) > 0 {
		lines[0] = strings.TrimPrefix(lines[0], "\ufeff")
	}
	return lines, nil
}

// parseFrontmatter handles PLAN 5b(a): "---"-delimited frontmatter
// (title/author/isbn — hand-rolled, no YAML dep), "## " headings as
// chapters, ">" blockquotes as quotes, and "- key: value" lines binding
// metadata to the quote above. Every binding is optional; key aliases
// tolerate files from other tools. lines starts after the opening "---".
func parseFrontmatter(lines []string) (*Result, error) {
	res := &Result{}
	i := 0
	for ; ; i++ {
		if i == len(lines) {
			return nil, errors.New("markdown: unterminated frontmatter")
		}
		line := lines[i]
		if line == "---" {
			i++
			break
		}
		key, val, found := strings.Cut(line, ":")
		if !found {
			continue
		}
		val = strings.TrimSpace(val)
		switch bindingKey(key) {
		case "title":
			res.Book.Title = val
		case "author":
			res.Book.Author = val
		case "translator":
			res.Book.Translator = val
		case "editor":
			res.Book.Editor = val
		case "isbn":
			res.Book.ISBN = val
		case "series":
			res.Book.Series, res.Book.SeriesIndex = parseSeriesValue(val)
		case "status":
			res.Book.Status = strings.ToLower(val)
		case "progress":
			res.Book.Progress = parseProgress(val)
		case "page", "pages":
			res.Book.Pos, res.Book.PosTotal = parseOutOf(val)
		case "reads":
			res.Book.Reads = parseReads(val)
		} // unknown keys ignored
	}
	if res.Book.Title == "" {
		return nil, errors.New("markdown: missing title in frontmatter")
	}

	var (
		chapter string
		cur     *Annotation // open quote accepting "- key: value" bindings
		qlines  []string    // its ">" lines, joined + collapsed on flush
		inQuote bool        // still accepting ">" continuation lines
	)
	flush := func() {
		if cur == nil {
			return
		}
		cur.Quote = strings.Join(strings.Fields(strings.Join(qlines, " ")), " ")
		if cur.Quote != "" { // empty quotes dropped
			res.Annotations = append(res.Annotations, *cur)
		}
		cur, qlines, inQuote = nil, nil, false
	}

	for _, line := range lines[i:] {
		switch {
		case strings.HasPrefix(line, ">"):
			if !inQuote { // fresh quote, or metadata ended the previous one
				flush()
				no, name := splitChapterHeading(chapter)
				cur = &Annotation{Chapter: name, ChapterNo: no}
				inQuote = true
			}
			qlines = append(qlines, strings.TrimPrefix(strings.TrimPrefix(line, ">"), " "))
		case strings.TrimSpace(line) == "": // blank line ends the quote
			flush()
		case strings.HasPrefix(line, "## "):
			flush()
			chapter = strings.TrimSpace(line[3:])
		case cur != nil && strings.HasPrefix(line, "- "):
			key, val, found := strings.Cut(line[2:], ":")
			if !found {
				continue
			}
			inQuote = false
			val = strings.TrimSpace(val)
			switch bindingKey(key) { // repeated key: last wins
			case "note":
				cur.Note = val
			case "color", "colour":
				cur.Color = val
			case "loc", "location", "page":
				cur.Location = val
			case "date", "added", "noted":
				cur.NotedAt = val
			case "tags":
				cur.Tags = nil
				for _, t := range strings.Split(val, ",") {
					if t = strings.TrimSpace(t); t != "" {
						cur.Tags = append(cur.Tags, t)
					}
				}
			case "favorite":
				cur.Favorite = truthy(val)
			}
		}
		// anything else is ignored
	}
	flush()
	return res, nil
}

// readestPage pulls N out of the trailing "*[Page: N](readest://…) · Time: …*"
// line; the deep link and timestamp are discarded (PLAN 5b(b)).
var readestPage = regexp.MustCompile(`\[Page:\s*(\d+)\]`)

// parseReadest handles PLAN 5b(b), the Readest "Highlights & Annotations"
// export: "# " heading = title, "**Author**: name" = author, "### " headings
// = chapters, consecutive ">" lines = one quote, and the italic page line
// binds a location to the quote above. "##" section headers, "---" rules and
// other "**…**" lines are ignored. The format carries no notes/colors/tags.
// lines starts at the "# Title" heading.
func parseReadest(lines []string) (*Result, error) {
	res := &Result{}
	var (
		chapter string
		qlines  []string
		lastIdx = -1 // flushed quote still awaiting its page line
	)
	flush := func() {
		if qlines == nil {
			return
		}
		q := strings.Join(strings.Fields(strings.Join(qlines, " ")), " ")
		qlines = nil
		if q == "" {
			return
		}
		no, name := splitChapterHeading(chapter)
		res.Annotations = append(res.Annotations, Annotation{Quote: q, Chapter: name, ChapterNo: no})
		lastIdx = len(res.Annotations) - 1
	}
	for _, line := range lines {
		if strings.HasPrefix(line, ">") {
			qlines = append(qlines, strings.TrimPrefix(strings.TrimPrefix(line, ">"), " "))
			continue
		}
		flush()
		switch {
		case strings.HasPrefix(line, "### "):
			chapter = strings.TrimSpace(line[4:])
		case strings.HasPrefix(line, "# ") && res.Book.Title == "":
			res.Book.Title = strings.TrimSpace(line[2:])
		case strings.HasPrefix(line, "**Author**:"):
			res.Book.Author = strings.TrimSpace(line[len("**Author**:"):])
		default:
			if m := readestPage.FindStringSubmatch(line); m != nil && lastIdx >= 0 {
				if res.Annotations[lastIdx].Location == "" {
					res.Annotations[lastIdx].Location = "p." + m[1]
				}
				lastIdx = -1 // one page line per quote
			}
		}
	}
	flush()
	if res.Book.Title == "" { // unreachable via Markdown()'s detection; kept for direct callers
		return nil, errors.New("markdown: missing title heading")
	}
	return res, nil
}

// bindingKey normalises a "- key: value" key for matching.
//
// KEYS WERE CASE-SENSITIVE IN EVERY PARSER, and each of them accepts a file a person
// may have typed by hand. `- Speaker: Bose` silently did nothing: the line parsed,
// the key did not match any case, and the value was dropped without a warning — a
// quote that imported successfully and simply lost its speaker.
//
// Lowercasing here rather than at each of the eight switches, so the three formats
// cannot drift apart on what a key IS. Values are untouched: a key is a keyword and a
// value is content, and folding "Bose" would be a different and much worse bug.
func bindingKey(k string) string {
	return strings.ToLower(strings.TrimSpace(k))
}

// splitChapterHeading recovers a chapter number from a "## " heading, and is the
// other half of the export's chapterHeading.
//
// IT SPLITS EXACTLY ONE SHAPE: a number, then " · ", then the rest — which is what
// this app writes and nothing else does. Everything else is a name, whole and
// untouched. That restraint is the point, and it is the same argument the anthology
// importer makes about not parsing an em dash out of a heading: a parse tuned to the
// exporter's own output will mangle what a person typed. "## 3. The Fall", "## 1984",
// "## Chapter 7" and "## 3:16" all stay names, exactly as they were before 0044.
//
// The one cost: a chapter whose name is only a number — "## 1984" is a name, but
// "## 1984 · Winston" would split into number 1984. Rare, visible in the form
// afterwards, and fixable in one edit; the alternative is a heading that cannot
// round-trip a number at all.
func splitChapterHeading(h string) (float64, string) {
	num, rest, found := strings.Cut(h, " · ")
	if !found {
		// A HEADING THAT IS NOTHING BUT A SMALL NUMBER is a chapter number: it is what
		// the export writes for a numbered chapter with no name, which is most of
		// them, and losing it would make the commonest shape the one that cannot come
		// home. `chapterNoCeiling` is what stops that from swallowing a NAME that
		// happens to be numeric — "## 1984", "## 2001" — because no book has a
		// thousandth chapter and every year-shaped title is above it. A bound is a
		// blunt instrument and it is the only signal the string carries; it is stated
		// here rather than discovered later.
		//
		// One deliberate consequence: an older file whose chapter was the text "3"
		// re-imports as the NUMBER 3 with no name. That is the same fact in the right
		// field, and it is the only place anything about this feature moves existing
		// data — a re-export and re-import fills in numbers the migration refused to
		// guess at, because here the heading really is unambiguous.
		if n, err := strconv.ParseFloat(strings.TrimSpace(h), 64); err == nil && n > 0 && n < chapterNoCeiling {
			return n, ""
		}
		return 0, h
	}
	n, err := strconv.ParseFloat(strings.TrimSpace(num), 64)
	if err != nil || n <= 0 {
		return 0, h
	}
	return n, strings.TrimSpace(rest)
}

// chapterNoCeiling separates a chapter number from a name that merely looks like
// one.
//
// TIGHTER THAN THE BOUND THE API REFUSES (chapterNoProblem allows up to 10,000),
// and the two are doing different jobs: that one rejects input a person typed into
// the wrong box, this one resolves a string that is genuinely ambiguous with no
// person to ask. Guessing conservatively is right here and would be wrong there —
// anything this declines to read as a number is still kept, whole, as the name.
const chapterNoCeiling = 1000
