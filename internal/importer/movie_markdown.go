package importer

import (
	"bufio"
	"bytes"
	"errors"
	"fmt"
	"io"
	"strconv"
	"strings"
)

// LooksLikeMovieMarkdown is the two-way question the import endpoint used to
// ask. Kept because it reads better at the call sites that only care whether a
// file is a catalogue export; MarkdownKind is the full answer.
//
// The decisive signal is the "type:" frontmatter line, which renderMovieExport
// always writes (movie or show) and the book export never writes. That closed a
// real hole: detection used to rest entirely on OPTIONAL content — director /
// creator / collection in the frontmatter, or character / actor / timestamp on a
// line — so a film with none of them (no director recorded, no collection, its
// lines unattributed) carried nothing that said "film", and re-importing its own
// export silently produced a BOOK with annotations. The heuristics still run,
// for hand-written files and for exports written before the type line became
// unconditional.
func LooksLikeMovieMarkdown(data []byte) bool { return MarkdownKind(data) == KindMovie }

// The three markdown shapes an upload can be.
const (
	KindBook   = "book"
	KindMovie  = "movie"
	KindQuotes = "quotes" // standalone quotes: no work, no parent (§24)
	// KindAnthology is a made document rather than a collection of records: a
	// title, an introduction, and quotes in an order with the reader's commentary
	// between them (0043). Its rows go through the same staging queue as
	// KindQuotes — it IS a quotes file with prose and an order around it — and the
	// separate kind exists because the file has to be parsed by something that
	// keeps that prose rather than skipping it.
	KindAnthology = "anthology"
)

// MarkdownKind decides which of the three exports a file is, so the import
// endpoint can route it. The first decisive signal wins; a file carrying none
// defaults to a book, which is the historical behaviour and the safer guess for
// a hand-written file.
//
// A THIRD KIND MAKES THE DEFAULT DANGEROUS IN A NEW WAY. A standalone quote
// file has no author, no isbn and no locator, so under the old two-way split
// every one of them would have fallen through to "book" and re-imported as a
// book with no title. That is why `type: quotes` is written unconditionally by
// the exporter, exactly as `type:` became unconditional for the catalogue once
// the same hole was found there.
//
// Note what deliberately is NOT a signal: "- color:", which every kind has
// carried since 0021/0026, and note/tags/date/favorite, which were always
// shared. Only a binding unique to one kind can decide, and under the shared
// quote shape that set is exactly the source locator — chapter/location for a
// book, character/actor/timestamp for a film, speaker/occasion for a quote.
func MarkdownKind(data []byte) string {
	sc := bufio.NewScanner(bytes.NewReader(data))
	sc.Buffer(make([]byte, 64*1024), 1<<20)
	for sc.Scan() {
		line := strings.TrimSpace(strings.TrimSuffix(sc.Text(), "\r"))
		// The explicit type line outranks every heuristic below: it is written by
		// the exporter, which knows the answer, rather than inferred from whichever
		// optional fields happen to be filled in.
		if rest, ok := cutPrefixFold(line, "type:"); ok {
			switch strings.ToLower(strings.TrimSpace(rest)) {
			case "movie", "film", "show":
				return KindMovie
			case "book":
				return KindBook
			case "quotes", "quote":
				return KindQuotes
			case "anthology":
				return KindAnthology
			}
			continue // an unrecognised type says nothing; keep scanning
		}
		switch {
		// "collection:" is decisive: the catalogue export writes it where the book
		// export writes "series:", so it only ever appears on a film/show file.
		case strings.HasPrefix(line, "director:"), strings.HasPrefix(line, "creator:"),
			strings.HasPrefix(line, "collection:"),
			strings.HasPrefix(line, "- character:"), strings.HasPrefix(line, "- actor:"),
			strings.HasPrefix(line, "- timestamp:"), strings.HasPrefix(line, "- episode:"):
			return KindMovie
		// A quote's locator is who said it and where. "- speaker:" is unique to
		// this kind; "- occasion:" likewise. Neither appears on a book or a film.
		// An `anthology:` key names the document this file IS, so it is as decisive
		// as `type:`. Checked before the quote bindings below because an anthology
		// export carries those too — it is a quotes file with prose around it, and
		// the prose is the whole reason the two parse differently.
		case strings.HasPrefix(line, "anthology:"):
			return KindAnthology
		case strings.HasPrefix(line, "- speaker:"), strings.HasPrefix(line, "- occasion:"):
			return KindQuotes
		case strings.HasPrefix(line, "author:"), strings.HasPrefix(line, "isbn:"),
			strings.HasPrefix(line, "- loc:"), strings.HasPrefix(line, "- location:"):
			return KindBook
		}
	}
	return KindBook
}

// cutPrefixFold is strings.CutPrefix with an ASCII case-insensitive match, so a
// hand-written "Type: Show" reads the same as the exporter's "type: show".
func cutPrefixFold(s, prefix string) (rest string, ok bool) {
	if len(s) < len(prefix) || !strings.EqualFold(s[:len(prefix)], prefix) {
		return "", false
	}
	return s[len(prefix):], true
}

// MovieMarkdownAll parses a catalogue export (renderMovieExport shape) that may
// hold many titles — each its own "---" frontmatter block — returning one
// MovieResult per title. Mirrors MarkdownAll (books) for the round-trip; the
// body carries character/actor/timestamp/note/tags/favorite bindings.
func MovieMarkdownAll(r io.Reader) ([]*MovieResult, error) {
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
		return nil, errors.New("movie markdown: empty file")
	}
	if lines[first] != "---" {
		return nil, errors.New(`movie markdown: unrecognized format (expected "---" frontmatter)`)
	}
	var opens []int
	inFM := false
	for i := first; i < len(lines); i++ {
		if lines[i] != "---" {
			continue
		}
		if inFM {
			inFM = false
		} else {
			opens = append(opens, i)
			inFM = true
		}
	}
	var out []*MovieResult
	for k, start := range opens {
		end := len(lines)
		if k+1 < len(opens) {
			end = opens[k+1]
		}
		res, err := parseMovieFrontmatter(lines[start+1 : end])
		if err != nil {
			return nil, fmt.Errorf("title %d: %w", k+1, err)
		}
		out = append(out, res)
	}
	return out, nil
}

// parseMovieFrontmatter mirrors parseFrontmatter for the catalogue export:
// title/director/year/genres frontmatter, then ">" blockquotes as dialogue with
// "- key: value" bindings. lines starts after the opening "---".
func parseMovieFrontmatter(lines []string) (*MovieResult, error) {
	res := &MovieResult{Movie: MovieHeader{MediaType: "movie"}}
	i := 0
	for ; ; i++ {
		if i == len(lines) {
			return nil, errors.New("movie markdown: unterminated frontmatter")
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
			res.Movie.Title = val
		case "director", "creator", "created by":
			res.Movie.Director = val
		case "publisher", "published by":
			res.Movie.Publisher = val
		case "year":
			if n, err := strconv.Atoi(val); err == nil {
				res.Movie.Year = n
			}
		case "genres":
			res.Movie.Genres = splitCSV(val)
		case "collection", "series", "franchise":
			res.Movie.Series, res.Movie.SeriesIndex = parseSeriesValue(val)
		case "type", "mediatype", "media_type":
			// Only the two known values are honoured; anything else leaves
			// MediaType empty so the server applies its own default.
			switch strings.ToLower(val) {
			case "show":
				res.Movie.MediaType = "show"
			case "movie", "film":
				res.Movie.MediaType = "movie"
			}
		case "status":
			res.Movie.Status = strings.ToLower(val)
		case "progress":
			res.Movie.Progress = parseProgress(val)
		case "episode", "episodes":
			res.Movie.Pos, res.Movie.PosTotal = parseOutOf(val)
		case "season", "seasons":
			res.Movie.Season, res.Movie.SeasonTotal = parseOutOf(val)
		case "reads":
			res.Movie.Reads = parseReads(val)
		} // unknown keys ignored
	}
	if res.Movie.Title == "" {
		return nil, errors.New("movie markdown: missing title in frontmatter")
	}

	var (
		cur     *Dialogue
		qlines  []string
		inQuote bool
	)
	flush := func() {
		if cur == nil {
			return
		}
		cur.Quote = strings.Join(strings.Fields(strings.Join(qlines, " ")), " ")
		if cur.Quote != "" {
			res.Dialogues = append(res.Dialogues, *cur)
		}
		cur, qlines, inQuote = nil, nil, false
	}
	for _, line := range lines[i:] {
		switch {
		case strings.HasPrefix(line, ">"):
			if !inQuote {
				flush()
				cur = &Dialogue{}
				inQuote = true
			}
			qlines = append(qlines, strings.TrimPrefix(strings.TrimPrefix(line, ">"), " "))
		case strings.TrimSpace(line) == "":
			flush()
		case cur != nil && strings.HasPrefix(line, "- "):
			key, val, found := strings.Cut(line[2:], ":")
			if !found {
				continue
			}
			inQuote = false
			val = strings.TrimSpace(val)
			switch bindingKey(key) {
			case "character":
				cur.Character = val
			case "actor":
				cur.Actor = val
			case "timestamp", "time":
				cur.Timestamp = val
			case "season", "episode", "ep":
				// Shows only; the server drops these for a film. Either key accepts
				// the combined "S2E5" people write by hand.
				applyEpisodeBinding(cur, strings.TrimSpace(key), val)
			case "note":
				cur.Note = val
			case "color", "colour":
				cur.Color = val
			case "tags":
				cur.Tags = splitCSV(val)
			case "favorite":
				cur.Favorite = truthy(val)
			}
		}
	}
	flush()
	return res, nil
}

// parseSeriesValue splits the export's "Name #1.5" back into its name and
// position — the inverse of seriesFrontmatter in the export renderer. A value
// with no "#" is all name, and a "#" whose tail isn't a number stays part of
// the name (a title like "Book #1: The Beginning" survives).
func parseSeriesValue(val string) (string, float64) {
	val = strings.TrimSpace(val)
	i := strings.LastIndex(val, "#")
	if i < 0 {
		return val, 0
	}
	n, err := strconv.ParseFloat(strings.TrimSpace(val[i+1:]), 64)
	if err != nil {
		return val, 0
	}
	return strings.TrimSpace(val[:i]), n
}

// splitCSV trims a "a, b, c" list into a slice, dropping blanks.
func splitCSV(val string) []string {
	var out []string
	for _, t := range strings.Split(val, ",") {
		if t = strings.TrimSpace(t); t != "" {
			out = append(out, t)
		}
	}
	return out
}
