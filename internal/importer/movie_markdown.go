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

// LooksLikeMovieMarkdown decides whether a markdown export is a catalogue
// (movie/show) export rather than a book one, so the import endpoint can route
// it. The catalogue export carries a "director:" frontmatter key and/or
// character/actor/timestamp dialogue bindings; a book export carries author/isbn
// and loc bindings. The first decisive signal wins; ambiguous files default to
// book (the historical behaviour).
func LooksLikeMovieMarkdown(data []byte) bool {
	sc := bufio.NewScanner(bytes.NewReader(data))
	sc.Buffer(make([]byte, 64*1024), 1<<20)
	for sc.Scan() {
		line := strings.TrimSpace(strings.TrimSuffix(sc.Text(), "\r"))
		switch {
		case strings.HasPrefix(line, "director:"), strings.HasPrefix(line, "creator:"),
			strings.HasPrefix(line, "- character:"), strings.HasPrefix(line, "- actor:"),
			strings.HasPrefix(line, "- timestamp:"):
			return true
		case strings.HasPrefix(line, "author:"), strings.HasPrefix(line, "isbn:"),
			strings.HasPrefix(line, "- loc:"), strings.HasPrefix(line, "- location:"):
			return false
		}
	}
	return false
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
		switch strings.TrimSpace(key) {
		case "title":
			res.Movie.Title = val
		case "director", "creator", "created by":
			res.Movie.Director = val
		case "year":
			if n, err := strconv.Atoi(val); err == nil {
				res.Movie.Year = n
			}
		case "genres":
			res.Movie.Genres = splitCSV(val)
		case "type", "mediatype", "media_type":
			if val == "show" {
				res.Movie.MediaType = "show"
			}
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
			switch strings.TrimSpace(key) {
			case "character":
				cur.Character = val
			case "actor":
				cur.Actor = val
			case "timestamp", "time":
				cur.Timestamp = val
			case "note":
				cur.Note = val
			case "tags":
				cur.Tags = splitCSV(val)
			case "favorite":
				cur.Favorite = val == "true" || val == "yes" || val == "1"
			}
		}
	}
	flush()
	return res, nil
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
