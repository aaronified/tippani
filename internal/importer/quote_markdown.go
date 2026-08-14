package importer

// Markdown import for standalone quotes (ROADMAP §24) — the third `type:`.
//
// It parses what renderQuotesExport writes, and the two are the same shape as
// the book format with one substitution: the "## " heading is the OCCASION
// rather than the chapter, and the bindings under a quote say who said it
// rather than which page it was on.
//
// There is exactly ONE frontmatter block for the whole file, not one per work,
// because this kind has no work. That is the difference that matters for the
// parser: MarkdownAll and MovieMarkdownAll split a file into per-work chunks on
// each "---" pair and parse each separately, whereas here the frontmatter is a
// three-line preamble and everything after it is one flat list.

import (
	"errors"
	"io"
	"strings"
)

// Utterance is one standalone quote as a file described it. The zero value of
// every optional field means "the file did not say", which the caller turns
// into the column default — the same contract Annotation and Dialogue keep.
type Utterance struct {
	Quote string
	Note  string
	// The occasion. Speaker and Occasion are what make a quote reviewable at
	// all; a row with neither is a proverb, which is legal and stays out of the
	// review deck.
	Speaker      string
	Occasion     string
	OccasionDate string // partial: YYYY | YYYY-MM | YYYY-MM-DD, validated server-side
	Place        string
	Medium       string
	Color        string // "" -> caller defaults to yellow
	Tags         []string
	Favorite     bool
	NotedAt      string // when YOU saved it, as the file's `date` binding said
	// 0035. Which board the quote belongs on, the language it is in, and what it
	// says. Category "" -> caller defaults to 'other', matching the column: a file
	// written before the three boards existed named no category, and every line in
	// it goes on meaning exactly what it meant.
	Category    string
	Language    string
	Translation string
}

// QuoteMarkdownAll parses a standalone-quote export. It returns a flat list
// rather than one result per work, because there is no work to group by — the
// occasion is a property of each quote, not a parent that owns it.
//
// An empty file is an error, not an empty list, so an upload of the wrong thing
// says so instead of reporting a successful import of nothing.
func QuoteMarkdownAll(r io.Reader) ([]Utterance, error) {
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
		return nil, errors.New("quote markdown: empty file")
	}
	if strings.TrimSpace(lines[first]) != "---" {
		return nil, errors.New(`quote markdown: unrecognized format (expected "---" frontmatter)`)
	}

	// Skip the preamble. Its only key is `type`, which MarkdownKind has already
	// read to route the file here, so nothing in it is needed again — but the
	// closing "---" has to be found or the body would be parsed as frontmatter.
	i := first + 1
	for ; ; i++ {
		if i == len(lines) {
			return nil, errors.New("quote markdown: unterminated frontmatter")
		}
		if strings.TrimSpace(lines[i]) == "---" {
			i++
			break
		}
	}

	var (
		out      []Utterance
		occasion string
		cur      *Utterance
		qlines   []string
		inQuote  bool
	)
	flush := func() {
		if cur == nil {
			return
		}
		cur.Quote = strings.Join(strings.Fields(strings.Join(qlines, " ")), " ")
		if cur.Quote != "" { // empty quotes dropped, as in every other parser
			out = append(out, *cur)
		}
		cur, qlines, inQuote = nil, nil, false
	}

	for _, line := range lines[i:] {
		switch {
		case strings.HasPrefix(line, ">"):
			if !inQuote { // fresh quote, or metadata ended the previous one
				flush()
				cur = &Utterance{Occasion: occasion}
				inQuote = true
			}
			qlines = append(qlines, strings.TrimPrefix(strings.TrimPrefix(line, ">"), " "))
		case strings.TrimSpace(line) == "": // blank line ends the quote
			flush()
		case strings.HasPrefix(line, "## "):
			flush()
			occasion = strings.TrimSpace(line[3:])
		case cur != nil && strings.HasPrefix(line, "- "):
			key, val, found := strings.Cut(line[2:], ":")
			if !found {
				continue
			}
			inQuote = false
			val = strings.TrimSpace(val)
			switch bindingKey(key) { // repeated key: last wins
			case "speaker", "said by", "by":
				cur.Speaker = val
			case "occasion":
				// A binding beats the heading, so a hand-written file that names
				// the occasion per quote instead of using "## " still works.
				cur.Occasion = val
			case "occasion_date", "occasion date", "said", "when":
				cur.OccasionDate = val
			case "place", "where":
				cur.Place = val
			case "medium", "via":
				cur.Medium = val
			case "note":
				cur.Note = val
			case "color", "colour":
				cur.Color = val
			// 0035. `kind` and `type` are accepted as aliases because a
			// hand-written file is as likely to reach for either, and neither can
			// collide here: `type` lives in the frontmatter, which this loop never
			// sees.
			case "category", "kind", "type":
				cur.Category = strings.ToLower(val)
			case "language", "lang":
				cur.Language = val
			// The English half of a line not in English. NOT folded into `note`:
			// a note is what you thought, a translation is what the line says.
			case "translation", "translated", "english":
				cur.Translation = val
			// `date` is when YOU saved it, matching the book export. When it was
			// SAID is occasion_date above — the two are different facts, and a
			// parser that folded them together would date a 1944 speech to the
			// afternoon somebody typed it in.
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
	return out, nil
}
