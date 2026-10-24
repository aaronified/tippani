// Package subs reads a subtitle or lyrics track into timed cues.
//
// It is the first half of "what the file says": a pure function from bytes to
// lines with start and end times, with no database, no HTTP and no dependency
// (docs/plans/locators-from-files.md: "all hand-rollable"). The matcher that finds
// a quote in the cues, and the extractor that takes the lines around it, are in
// internal/srcmatch.
//
// FOUR FORMATS, ONE SHAPE. SRT and VTT are blocks of a time range and text; ASS is
// a table whose column order the file declares; LRC is one time per line, with the
// end of a line being the start of the next. Every parser answers []Cue in time
// order, and none of them reads a filename.
//
// WHAT IT STRIPS, and why that is its job and not the matcher's: markup that is
// presentation and no speech. HTML-ish tags in SRT/VTT (<i>, <font ...>), ASS
// override blocks ({\an8}, {\pos(1,2)}) and hard line breaks (\N, \n) are removed
// or turned into a space, so the cue text is what was said. Everything else is left
// alone — punctuation, a "NAME:" prefix, accents — because deciding what counts as
// the same words is the matcher's fold, applied to both sides.
package subs

import (
	"bytes"
	"errors"
	"regexp"
	"sort"
	"strconv"
	"strings"
)

// Cue is one line of the track: what was said, and when. Times are milliseconds
// from the start of the track. Index is the cue's place in time order, from zero.
type Cue struct {
	Index int
	Start int64
	End   int64
	Text  string
}

// Formats Parse accepts, which are importer.SourceFormat's words.
const (
	SRT = "srt"
	VTT = "vtt"
	ASS = "ass"
	LRC = "lrc"
)

// ErrNoCues is what a file that parsed as the right format but held no usable line
// answers, so the caller can say "that file is empty" rather than treat it as a
// broken one.
var ErrNoCues = errors.New("subs: no cues found")

// Parse reads data as the given format. Cues are returned in start order with
// empty ones dropped, because a cue with no words has nothing to match.
func Parse(format string, data []byte) ([]Cue, error) {
	text := string(bytes.TrimPrefix(data, []byte("\xef\xbb\xbf")))
	text = strings.ReplaceAll(strings.ReplaceAll(text, "\r\n", "\n"), "\r", "\n")
	var cues []Cue
	switch format {
	case SRT:
		cues = parseBlocks(text)
	case VTT:
		cues = parseBlocks(text)
	case ASS:
		cues = parseASS(text)
	case LRC:
		cues = parseLRC(text)
	default:
		return nil, errors.New("subs: unknown format " + format)
	}
	out := cues[:0]
	for _, c := range cues {
		c.Text = tidy(c.Text)
		if c.Text != "" {
			out = append(out, c)
		}
	}
	sort.SliceStable(out, func(i, j int) bool { return out[i].Start < out[j].Start })
	for i := range out {
		out[i].Index = i
	}
	if len(out) == 0 {
		return nil, ErrNoCues
	}
	return out, nil
}

var (
	// <i>, </i>, <font color="...">, <c.yellow>, <v Speaker> — presentation.
	tagRe = regexp.MustCompile(`</?[a-zA-Z][^>]*>`)
	// {\an8}, {\pos(10,20)}, {\i1} — ASS override blocks. A brace pair with no
	// backslash inside is somebody's own parenthetical and is kept.
	overrideRe = regexp.MustCompile(`\{[^}]*\\[^}]*\}`)
	// One clock: [hh:]mm:ss[,.]frac, with the fraction of any length.
	clockRe = regexp.MustCompile(`^(?:(\d+):)?(\d{1,2}):(\d{2})(?:[.,](\d+))?$`)
)

// tidy turns cue text into what was said: markup out, line breaks to a space, runs
// of whitespace collapsed.
func tidy(s string) string {
	s = overrideRe.ReplaceAllString(s, "")
	s = strings.NewReplacer(`\N`, " ", `\n`, " ", `\h`, " ", "\n", " ").Replace(s)
	s = tagRe.ReplaceAllString(s, "")
	return strings.Join(strings.Fields(s), " ")
}

// clock reads one timestamp into milliseconds. The fraction is read as a decimal
// fraction of a second whatever its width, so ASS's two digits (centiseconds) and
// SRT's three (milliseconds) are both right.
func clock(s string) (int64, bool) {
	m := clockRe.FindStringSubmatch(strings.TrimSpace(s))
	if m == nil {
		return 0, false
	}
	h, _ := strconv.ParseInt(orZero(m[1]), 10, 64)
	mi, _ := strconv.ParseInt(m[2], 10, 64)
	se, _ := strconv.ParseInt(m[3], 10, 64)
	ms := int64(0)
	if f := m[4]; f != "" {
		if len(f) > 3 {
			f = f[:3]
		}
		for len(f) < 3 {
			f += "0"
		}
		ms, _ = strconv.ParseInt(f, 10, 64)
	}
	return ((h*60+mi)*60+se)*1000 + ms, true
}

func orZero(s string) string {
	if s == "" {
		return "0"
	}
	return s
}

// parseBlocks reads SRT and VTT, which are the same idea: blank-line-separated
// blocks, one of whose lines is "start --> end" and whose following lines are the
// text. A leading index line (SRT) and cue identifiers or settings after the end
// time (VTT) are skipped; a VTT NOTE/STYLE/REGION block has no arrow and falls out.
func parseBlocks(text string) []Cue {
	var cues []Cue
	for _, block := range strings.Split(text, "\n\n") {
		lines := strings.Split(strings.Trim(block, "\n"), "\n")
		at := -1
		for i, ln := range lines {
			if strings.Contains(ln, "-->") {
				at = i
				break
			}
		}
		if at < 0 {
			continue
		}
		arrow := strings.SplitN(lines[at], "-->", 2)
		start, ok1 := clock(arrow[0])
		// The end may be followed by VTT cue settings ("align:start position:0%").
		endField := strings.Fields(arrow[1])
		if len(endField) == 0 {
			continue
		}
		end, ok2 := clock(endField[0])
		if !ok1 || !ok2 {
			continue
		}
		cues = append(cues, Cue{Start: start, End: end, Text: strings.Join(lines[at+1:], "\n")})
	}
	return cues
}

// parseASS reads the [Events] table. The Format line names the columns, and Text is
// by definition the last, so a comma inside the speech is not a column break: the
// line is split into at most len(columns) fields.
func parseASS(text string) []Cue {
	var cues []Cue
	inEvents := false
	var cols []string
	for _, raw := range strings.Split(text, "\n") {
		line := strings.TrimSpace(raw)
		if strings.HasPrefix(line, "[") {
			inEvents = strings.EqualFold(line, "[Events]")
			continue
		}
		if !inEvents {
			continue
		}
		switch {
		case strings.HasPrefix(strings.ToLower(line), "format:"):
			cols = nil
			for _, c := range strings.Split(line[len("format:"):], ",") {
				cols = append(cols, strings.ToLower(strings.TrimSpace(c)))
			}
		case strings.HasPrefix(strings.ToLower(line), "dialogue:"):
			if len(cols) == 0 {
				continue
			}
			fields := strings.SplitN(line[len("dialogue:"):], ",", len(cols))
			if len(fields) < len(cols) {
				continue
			}
			get := func(name string) string {
				for i, c := range cols {
					if c == name {
						return strings.TrimSpace(fields[i])
					}
				}
				return ""
			}
			start, ok1 := clock(get("start"))
			end, ok2 := clock(get("end"))
			if !ok1 || !ok2 {
				continue
			}
			cues = append(cues, Cue{Start: start, End: end, Text: fields[len(fields)-1]})
		}
	}
	return cues
}

// lrcLine is one lyric line, possibly with several leading time tags
// ("[00:12.00][01:30.00]the chorus") — each tag is a cue.
var lrcLine = regexp.MustCompile(`^((?:\[\d{1,3}:\d{2}(?:[.:]\d{1,3})?\])+)(.*)$`)
var lrcTag = regexp.MustCompile(`\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]`)

// parseLRC reads lyrics. An LRC line carries a start only, so each cue ends where
// the next begins; the last gets a few seconds. Metadata tags ([ti:...], [ar:...])
// have no time and fall out on their own.
func parseLRC(text string) []Cue {
	var cues []Cue
	for _, raw := range strings.Split(text, "\n") {
		m := lrcLine.FindStringSubmatch(strings.TrimSpace(raw))
		if m == nil {
			continue
		}
		for _, tag := range lrcTag.FindAllStringSubmatch(m[1], -1) {
			mi, _ := strconv.ParseInt(tag[1], 10, 64)
			se, _ := strconv.ParseInt(tag[2], 10, 64)
			ms := int64(0)
			if f := tag[3]; f != "" {
				for len(f) < 3 {
					f += "0"
				}
				ms, _ = strconv.ParseInt(f[:3], 10, 64)
			}
			cues = append(cues, Cue{Start: (mi*60+se)*1000 + ms, Text: m[2]})
		}
	}
	sort.SliceStable(cues, func(i, j int) bool { return cues[i].Start < cues[j].Start })
	for i := range cues {
		if i+1 < len(cues) {
			cues[i].End = cues[i+1].Start
		} else {
			cues[i].End = cues[i].Start + 4000
		}
	}
	return cues
}
