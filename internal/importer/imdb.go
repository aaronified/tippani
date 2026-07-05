package importer

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"regexp"
	"strconv"
	"strings"
)

// An IMDb quotes page (imdb.com/title/ttNN/quotes) is React-rendered — the data
// lives in the embedded __NEXT_DATA__ JSON, not the DOM. We pull the fields we
// need straight out of that blob with regexes (no HTML/JSON-DOM dependency,
// matching goodreads.go / hardcover.go) and JSON-decode each captured string to
// unescape it. Each TitleQuote node is one exchange, kept as a single dialogue
// (one dialogue per exchange): a single-speaker exchange fills Character and
// drops the labels; a multi-speaker one keeps "Speaker: line" labels in the
// quote. Bracketed stage directions ([first lines], [voiceover] …) stay inline.
var (
	imdbTitle     = regexp.MustCompile(`"titleText":\{"text":"((?:[^"\\]|\\.)*)","__typename":"TitleText"\}`)
	imdbYear      = regexp.MustCompile(`"releaseYear":\{"year":(\d+)`)
	imdbID        = regexp.MustCompile(`"data":\{"title":\{"id":"(tt\d+)"`)
	imdbIsSeries  = regexp.MustCompile(`"titleType":\{[^}]*?"isSeries":(true|false)`)
	imdbQuoteNode = regexp.MustCompile(`(?s)"__typename":"TitleQuote".*?"plainText":"((?:[^"\\]|\\.)*)"`)
)

// IMDbQuotes parses a saved IMDb quotes page into one film/show's dialogues.
func IMDbQuotes(r io.Reader) (*MovieResult, error) {
	data, err := io.ReadAll(r) // caller caps the upload size (PLAN §5)
	if err != nil {
		return nil, fmt.Errorf("imdb: %w", err)
	}
	doc := string(data)

	res := &MovieResult{}
	res.Movie.Title = jsonUnquote(firstGroup(imdbTitle, doc))
	if res.Movie.Title == "" {
		return nil, errors.New("imdb: no title found (not a saved IMDb quotes page?)")
	}
	if m := imdbYear.FindStringSubmatch(doc); m != nil {
		res.Movie.Year, _ = strconv.Atoi(m[1])
	}
	if m := imdbID.FindStringSubmatch(doc); m != nil {
		res.Movie.IMDbID = m[1]
	}
	res.Movie.MediaType = "movie"
	if m := imdbIsSeries.FindStringSubmatch(doc); m != nil && m[1] == "true" {
		res.Movie.MediaType = "show"
	}

	seen := map[string]bool{} // collapse the odd repeated quote within one page
	for _, m := range imdbQuoteNode.FindAllStringSubmatch(doc, -1) {
		d, ok := parseExchange(jsonUnquote(m[1]))
		if !ok {
			continue
		}
		key := strings.ToLower(strings.Join(strings.Fields(d.Quote), " "))
		if seen[key] {
			continue
		}
		seen[key] = true
		res.Dialogues = append(res.Dialogues, d)
	}
	if len(res.Dialogues) == 0 {
		return nil, errors.New("imdb: no quotes parsed")
	}
	return res, nil
}

// parseExchange turns one quote block's plainText ("\n* Speaker: line\n* …")
// into a single dialogue (see the package note on granularity).
func parseExchange(s string) (Dialogue, bool) {
	type line struct{ speaker, text string }
	var lines []line
	var speakers []string
	seen := map[string]bool{}
	for _, raw := range strings.Split(s, "\n") {
		t := strings.TrimSpace(strings.TrimPrefix(strings.TrimSpace(raw), "*"))
		if t == "" {
			continue
		}
		sp, txt := splitSpeaker(t)
		lines = append(lines, line{sp, txt})
		if sp != "" && !seen[strings.ToLower(sp)] {
			seen[strings.ToLower(sp)] = true
			speakers = append(speakers, sp)
		}
	}
	if len(lines) == 0 {
		return Dialogue{}, false
	}
	single := len(speakers) == 1
	var b strings.Builder
	for i, ln := range lines {
		if i > 0 {
			b.WriteByte('\n')
		}
		if single || ln.speaker == "" {
			b.WriteString(ln.text)
		} else {
			b.WriteString(ln.speaker + ": " + ln.text)
		}
	}
	quote := strings.TrimSpace(b.String())
	if quote == "" {
		return Dialogue{}, false
	}
	d := Dialogue{Quote: quote}
	if single {
		d.Character = speakers[0]
	}
	return d, true
}

// splitSpeaker splits "Name: dialogue" on the first colon-space. The name must
// be a plausible speaker label — non-empty, not a bracketed stage direction,
// and short — else the whole line is treated as un-attributed text.
func splitSpeaker(s string) (speaker, text string) {
	i := strings.Index(s, ": ")
	if i <= 0 {
		return "", s
	}
	name := s[:i]
	if strings.HasPrefix(name, "[") || len([]rune(name)) > 60 {
		return "", s
	}
	return name, strings.TrimSpace(s[i+2:])
}

func firstGroup(re *regexp.Regexp, s string) string {
	if m := re.FindStringSubmatch(s); m != nil {
		return m[1]
	}
	return ""
}

// jsonUnquote decodes a captured JSON string body (the bytes between the quotes)
// by re-wrapping and unmarshalling it, turning \n, \uXXXX and \" into text.
func jsonUnquote(s string) string {
	if s == "" {
		return ""
	}
	var out string
	if err := json.Unmarshal([]byte(`"`+s+`"`), &out); err != nil {
		return s
	}
	return out
}
