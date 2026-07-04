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
		switch strings.TrimSpace(key) {
		case "title":
			res.Book.Title = val
		case "author":
			res.Book.Author = val
		case "isbn":
			res.Book.ISBN = val
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
				cur = &Annotation{Chapter: chapter}
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
			switch strings.TrimSpace(key) { // repeated key: last wins
			case "note":
				cur.Note = val
			case "color", "colour":
				cur.Color = val
			case "loc", "location", "page":
				cur.Location = val
			case "tags":
				cur.Tags = nil
				for _, t := range strings.Split(val, ",") {
					if t = strings.TrimSpace(t); t != "" {
						cur.Tags = append(cur.Tags, t)
					}
				}
			case "favorite":
				cur.Favorite = val == "true" || val == "yes" || val == "1"
			case "rating": // out-of-range or non-numeric -> line ignored
				if n, err := strconv.Atoi(val); err == nil && n >= 0 && n <= 5 {
					cur.Rating = n
				}
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
		res.Annotations = append(res.Annotations, Annotation{Quote: q, Chapter: chapter})
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
