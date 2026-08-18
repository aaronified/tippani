package importer

// Markdown import for an anthology — the fourth `type:`, and the first one whose
// file carries PROSE as well as rows.
//
// It parses what renderAnthologyExport writes, and the two are deliberately the
// same shape as the standalone-quote format with one addition: a "## " heading
// opens an ENTRY rather than naming an occasion, and the paragraphs between that
// heading and the quote under it are the reader's commentary on that entry.
//
// THE HEADING IS A DELIMITER, NOT DATA. It reads as an attribution — "Invisible
// Cities — Italo Calvino" — because that is what a reader's eye wants at the top
// of an entry, but nothing here parses it: every fact about the quote is in the
// bindings underneath, exactly as in the quotes format. Splitting a heading on an
// em dash to recover an author is the kind of parse that works on the exporter's
// own output and on nothing a human typed.
//
// So the grammar is:
//
//	frontmatter          type: anthology, and the anthology's title
//	prose                everything before the first "## " is the INTRODUCTION
//	## anything          opens an entry
//	prose                the commentary that introduces this entry
//	> the quote          the passage itself
//	- key: value         its attribution, the same bindings the quotes format uses
//
// WHAT THE ROUND TRIP LOSES, stated because it is a real loss and not an
// oversight: an entry that was a book highlight comes back as a STANDALONE quote.
// The file carries no book — an anthology is a reading document, and the work a
// passage came from appears in it as an attribution rather than as a record with
// an ISBN. The order and the prose survive intact, which is what the anthology
// itself is; the parent does not, and re-importing one into the library it came
// from is not the case this exists for.

import (
	"errors"
	"io"
	"strings"
)

// Anthology is one anthology as a file described it: its title, its introduction,
// and its entries in order. Entries are []Utterance because that is what an entry
// IS once the anthology's own two facts (its place in the order, and the
// commentary before it) are attached to it — see Utterance.Anthology.
type Anthology struct {
	Title   string
	Intro   string
	Entries []Utterance
}

// AnthologyMarkdown parses an anthology export.
//
// An empty file, a missing frontmatter block and a file with no title are all
// errors rather than an empty anthology: an upload of the wrong thing has to say
// so instead of reporting a successful import of nothing, and a nameless
// anthology cannot be resolved to a row at approval time.
func AnthologyMarkdown(r io.Reader) (Anthology, error) {
	var out Anthology
	lines, err := readLines(r)
	if err != nil {
		return out, err
	}
	first := -1
	for i, l := range lines {
		if strings.TrimSpace(l) != "" {
			first = i
			break
		}
	}
	if first < 0 {
		return out, errors.New("anthology markdown: empty file")
	}
	if strings.TrimSpace(lines[first]) != "---" {
		return out, errors.New(`anthology markdown: unrecognized format (expected "---" frontmatter)`)
	}

	// The frontmatter, which unlike the quotes format is READ rather than skipped:
	// the title lives in it, and the title is what approval resolves to a row.
	i := first + 1
	for ; ; i++ {
		if i == len(lines) {
			return out, errors.New("anthology markdown: unterminated frontmatter")
		}
		line := strings.TrimSpace(lines[i])
		if line == "---" {
			i++
			break
		}
		if key, val, found := strings.Cut(line, ":"); found {
			switch bindingKey(key) {
			case "title", "anthology":
				out.Title = strings.TrimSpace(val)
			}
		}
	}
	if out.Title == "" {
		return out, errors.New("anthology markdown: the frontmatter names no title")
	}

	var (
		cur     *Utterance // the entry being built, nil before the first "## "
		prose   []string   // paragraphs seen since the last heading or quote
		qlines  []string   // the current quote's lines
		inQuote bool
		started bool // has the first "## " been seen? before it, prose is the intro
	)

	// paragraph joins the prose buffer the way a Markdown reader would: a blank
	// line is a paragraph break and is kept as one, a wrapped line is not.
	paragraph := func() string {
		var paras []string
		var cur []string
		for _, l := range prose {
			if strings.TrimSpace(l) == "" {
				if len(cur) > 0 {
					paras = append(paras, strings.Join(cur, " "))
					cur = nil
				}
				continue
			}
			cur = append(cur, strings.TrimSpace(l))
		}
		if len(cur) > 0 {
			paras = append(paras, strings.Join(cur, " "))
		}
		prose = nil
		return strings.Join(paras, "\n\n")
	}

	// flush closes the entry being built. An entry with no quote in it is dropped
	// rather than kept as a bare piece of commentary: the anthology's own prose is
	// the intro, and a note with nothing under it would come back as an entry
	// pointing at a quote that never existed.
	flush := func() {
		if cur == nil {
			return
		}
		cur.Quote = strings.Join(strings.Fields(strings.Join(qlines, " ")), " ")
		if cur.Quote != "" {
			out.Entries = append(out.Entries, *cur)
		}
		cur, qlines, inQuote = nil, nil, false
	}

	for _, line := range lines[i:] {
		switch {
		case strings.HasPrefix(line, "## "):
			// A heading closes the previous entry and opens the next. Any prose
			// still buffered belongs to whatever came before it: the introduction
			// on the first heading, and nothing afterwards (an entry's commentary
			// is taken when its quote starts, below).
			if !started {
				out.Intro = paragraph()
				started = true
			} else {
				flush()
			}
			prose = nil
			cur = &Utterance{}

		case strings.HasPrefix(line, ">"):
			if cur == nil {
				// A quote before any heading. Tolerated rather than refused, so a
				// hand-written file that never bothers with headings still imports
				// as one entry per quote — and its prose so far is the intro.
				if !started {
					out.Intro = paragraph()
					started = true
				}
				cur = &Utterance{}
			}
			if !inQuote {
				// The prose since the heading is this entry's commentary, taken at
				// the moment the quote starts rather than at the end of the entry —
				// the bindings that follow a quote are not prose, and neither is the
				// next heading.
				cur.AnthologyNote = paragraph()
				inQuote = true
			}
			qlines = append(qlines, strings.TrimPrefix(strings.TrimPrefix(line, ">"), " "))

		case cur != nil && strings.HasPrefix(line, "- "):
			// A binding ends the quote text without ending the entry, exactly as in
			// the quotes parser: what follows is metadata, not more passage.
			inQuote = false
			applyQuoteBinding(cur, line)

		case strings.TrimSpace(line) == "":
			// A blank line ends a quote and separates paragraphs. It does NOT flush
			// the entry: the bindings under a quote are usually one blank line away
			// from it, and this parser has to keep them attached.
			if inQuote {
				inQuote = false
			}
			if cur == nil || len(qlines) == 0 {
				prose = append(prose, "")
			}

		default:
			// Ordinary prose. Buffered as the intro before the first heading and as
			// the entry's commentary after one; ignored once a quote has started,
			// because a stray line among the bindings is not commentary about
			// anything the reader can see.
			if len(qlines) == 0 {
				prose = append(prose, line)
			}
		}
	}
	// A file that never used a heading still has an introduction to take.
	if !started {
		out.Intro = paragraph()
	}
	flush()

	if len(out.Entries) == 0 {
		return out, errors.New("anthology markdown: no quotes in the file")
	}
	// The title travels on every row, because staging is per-quote and approval
	// resolves the anthology once per row it writes. Set here rather than at each
	// call site so a caller cannot stage half a file into the wrong anthology.
	for j := range out.Entries {
		out.Entries[j].Anthology = out.Title
		out.Entries[j].AnthologyIntro = out.Intro
	}
	return out, nil
}
