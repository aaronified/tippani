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
	// SUPERSEDED BY Kind (0053) and still read: `medium` is on every row already
	// stored and the export still writes it, so a backup taken before 0053 has to
	// restore.
	Medium string
	// 0053. What kind of thing the quote is, from a fixed list. The FILE KEY IS
	// `kind`, which until now was an alias for `category` — a change of meaning
	// worth stating: the three values they share (proverb, speech, other) land in
	// the same place either way, because `category` was superseded by the board a
	// quote sits on (0036) and no longer decides anything, while `letter` and
	// `essay` were previously REFUSED by importCategory. So every file that used to
	// import still imports, and two values that used to be errors now work.
	Kind     string
	Color    string // "" -> caller defaults to yellow
	Tags     []string
	Favorite bool
	NotedAt  string // when YOU saved it, as the file's `date` binding said
	// 0035. Which board the quote belongs on, the language it is in, and what it
	// says. Category "" -> caller defaults to 'other', matching the column: a file
	// written before the three boards existed named no category, and every line in
	// it goes on meaning exactly what it meant.
	Category    string
	Language    string
	Translation string
	// 0047 — what a proverb, a letter and an essay carry. Every one of them is
	// optional and empty means "the file did not say", which the caller turns into
	// the column default, exactly as the fields above do.
	//
	// OccasionCirca is the only bool of the five and the only one that is not free
	// text: it says the occasion date is approximate. It rides here rather than on
	// OccasionDate because the two are separate columns — a reader can tick it
	// before typing a year, and the server does not mind (utteranceReq.OccasionCirca).
	Region        string
	Recipient     string
	WorkTitle     string
	Locator       string
	OccasionCirca bool
	// 0043. Which anthology this quote belongs to and the commentary that
	// introduces it there — both empty for every file that is not an anthology
	// export, which is why they can ride on this struct rather than needing a
	// parallel one. The title is resolved to a row by NAME at approval time, the
	// way an imported board name is.
	Anthology     string
	AnthologyNote string
	// The anthology's INTRODUCTION, carried on every entry of the same file. One
	// fact per file rather than per quote, and it rides here because the staging
	// queue is per quote; approval writes it only when it creates the anthology.
	AnthologyIntro string
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
			inQuote = false
			applyQuoteBinding(cur, line)
		}
		// anything else is ignored
	}
	flush()
	return out, nil
}

// applyQuoteBinding reads one "- key: value" line onto a quote.
//
// LIFTED OUT SO TWO PARSERS CANNOT DRIFT. The anthology format (0043) is the
// quotes format with prose and headings around it, and its bindings are the same
// bindings — so the aliases, the last-key-wins rule and the speaker/occasion
// distinction have to be one piece of code. Two copies would diverge on the first
// alias somebody added to only one, and the symptom is a field that imports from
// a quotes file and silently does not from an anthology.
//
// A line with no colon is ignored rather than refused: a hand-written file uses
// "- " for an ordinary list too.
func applyQuoteBinding(cur *Utterance, line string) {
	key, val, found := strings.Cut(strings.TrimPrefix(line, "- "), ":")
	if !found {
		return
	}
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
	// 0035. `type` is accepted as an alias because a hand-written file is as
	// likely to reach for it, and it cannot collide here: `type` lives in the
	// frontmatter, which this loop never sees.
	//
	// `kind` USED TO BE THE THIRD ALIAS and is now its own field — see
	// Utterance.Kind for why that is safe.
	case "category", "type":
		cur.Category = strings.ToLower(val)
	// 0053, and the key the export writes.
	case "kind":
		cur.Kind = strings.ToLower(val)
	case "language", "lang":
		cur.Language = val
	// 0047. Region pairs with language; `to` is what a letter is addressed with,
	// and is the alias a hand-written file is likeliest to reach for.
	case "region":
		cur.Region = val
	case "recipient", "to":
		cur.Recipient = val
	// The essay's source title. `essay` is accepted because that is the LABEL the
	// interface puts on this column for that kind, and `work` because a
	// hand-written file has no reason to know the column is named generically.
	case "work_title", "work title", "work", "essay":
		cur.WorkTitle = val
	// THE ESSAY'S LOCATOR, AND WHY THE FILE KEY IS `page` AND NOT `locator`.
	//
	// `locator` is already taken, by the anthology export (export_anthology.go),
	// which writes it for a JOINED DISPLAY STRING — "7 · The Fall · p. 288", built
	// in SQL from whichever kind the entry happens to be. This function is SHARED by
	// the quotes parser and the anthology parser (read the header), so a `locator`
	// case here would pour that whole display string into utterances.locator on
	// every anthology re-import: a page field reading "7 · The Fall · p. 288".
	//
	// `page` is the spec's own label for the column ("Page — page, section, or
	// paragraph"), it is what the quotes export writes, and it collides with
	// nothing: the BOOK parser's `page` is a different parser reading a different
	// file. `section` rides along as the alias for the other half of the label.
	//
	// Deliberately NOT a case: "locator". Leave it that way.
	case "page", "section":
		cur.Locator = val
	// Approximate — "around 1890". truthy() takes true/yes/1, like favorite, so a
	// hand-written file can say it however it likes; the exporter writes `true`.
	case "circa":
		cur.OccasionCirca = truthy(val)
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
