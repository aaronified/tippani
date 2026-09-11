package importer

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"strings"
	"time"
)

// ReadestFormat is the marker Readest writes at the top of an annotations
// export. It is the whole reason this format needs no heuristic: the exporter
// says what the file is, which is the rule MarkdownKind was rewritten to obey
// after a film with no director re-imported its own export as a book.
const ReadestFormat = "readest-annotations"

// readestFile is the JSON export's shape. Only the fields Tippani can store are
// named: `hash`, `metaHash`, `cfi`, `xpointer0/1` and `location` address a file
// on the reader's own device rather than a work, so they are read by nobody and
// deliberately absent here.
type readestFile struct {
	Format string `json:"$format"`
	Book   struct {
		Title  string `json:"title"`
		Author string `json:"author"`
	} `json:"book"`
	Annotations []struct {
		Text      string `json:"text"`
		Note      string `json:"note"`
		Style     string `json:"style"`
		Color     string `json:"color"`
		CreatedAt int64  `json:"createdAt"` // ms since the epoch
	} `json:"annotations"`
	// [read, total] in the reader's own units — characters, not pages. parseOutOf
	// is the same shape for a frontmatter "page: 128/320".
	Progress []int `json:"progress"`
}

// ReadestStats reports what a Readest import could not carry, on the
// My Clippings precedent: a parser that quietly returns less than the file held
// is worse than one that says so.
type ReadestStats struct {
	// Highlights whose colour Tippani has no slot for. They import in slot 1,
	// which the app defines as "nobody chose a colour" rather than as yellow —
	// see the mapping note on readestColor.
	ColorUnmapped int
	// Readest's underline styles. Tippani stores a colour per quote and no
	// style, so the distinction is dropped; counting it is what keeps that
	// honest.
	StyleDropped int
}

// ReadestJSON parses Readest's own annotations export.
//
// IT IS NOT A SUPERSET OF THE MARKDOWN EXPORT AND THE MARKDOWN IS NOT A SUPERSET
// OF IT, which is why both sources stay. The JSON carries the highlight's
// colour, its real creation time and the book's reading progress; the markdown
// carries the chapter name and the page number, and this file has neither. A
// reader who imports both gets the union, because approval fills empty columns
// only.
func ReadestJSON(r io.Reader) (*Result, ReadestStats, error) {
	var stats ReadestStats
	data, err := io.ReadAll(r) // the caller caps the upload size (PLAN §5)
	if err != nil {
		return nil, stats, fmt.Errorf("readest: %w", err)
	}
	var f readestFile
	if err := json.Unmarshal(trimBOM(data), &f); err != nil {
		return nil, stats, fmt.Errorf("readest: decode: %w", err)
	}
	// The marker is checked rather than assumed: this parser is reachable from the
	// override, where the reader has asserted a format the sniffer disagreed with,
	// and a Bookcision file decodes into the struct above with every field empty.
	if f.Format != ReadestFormat {
		return nil, stats, errors.New(`readest: not a Readest annotations export (no "$format": "` + ReadestFormat + `")`)
	}
	if strings.TrimSpace(f.Book.Title) == "" {
		return nil, stats, errors.New("readest: missing book title")
	}
	res := &Result{Book: Book{
		Title:  strings.TrimSpace(f.Book.Title),
		Author: strings.TrimSpace(f.Book.Author),
	}}
	if len(f.Progress) == 2 && f.Progress[0] > 0 && f.Progress[1] > 0 {
		res.Book.Pos, res.Book.PosTotal = f.Progress[0], f.Progress[1]
	}
	for _, a := range f.Annotations {
		text := strings.TrimSpace(a.Text)
		note := strings.TrimSpace(a.Note)
		if text == "" && note == "" {
			continue
		}
		color, mapped := readestColor(a.Color)
		if !mapped {
			stats.ColorUnmapped++
		}
		if s := strings.TrimSpace(strings.ToLower(a.Style)); s != "" && s != "highlight" {
			stats.StyleDropped++
		}
		res.Annotations = append(res.Annotations, Annotation{
			Quote:   text,
			Note:    note,
			Color:   color,
			NotedAt: readestTime(a.CreatedAt),
		})
	}
	if len(res.Annotations) == 0 {
		return nil, stats, errors.New("readest: no annotations in file")
	}
	return res, stats, nil
}

// readestColor maps Readest's palette onto Tippani's six slots, and reports
// whether it could.
//
// THREE OF THEM MATCH BY NAME AND THE REST GO TO SLOT 1 RATHER THAN TO THE
// NEAREST HUE. Readest's `red` is closest to slot 3 (pink, #D98CA6) by colour —
// but a slot carries a MEANING here, not a hue: the six are nameable and a reader
// may have renamed them, so filing somebody's red highlights under whatever
// "pink" means in their library asserts a category they never chose. Slot 1 is
// the one slot theme.js defines as "no choice was made" (it cannot be named or
// hidden, and the server refuses both), so it is where an unanswerable colour
// belongs. The count goes back to the reader on the result row.
func readestColor(c string) (string, bool) {
	switch strings.TrimSpace(strings.ToLower(c)) {
	case "yellow":
		return "yellow", true
	case "green":
		return "green", true
	case "violet", "purple":
		return "purple", true
	case "":
		// The file said nothing, so nothing was lost: "" already means the server's
		// default. Not counted as unmapped.
		return "", true
	}
	return "", false
}

// readestTime renders the export's millisecond epoch as RFC 3339 in UTC.
//
// noted_at is free text — the My Clippings parser passes the device's own
// localised sentence through untouched — so this could have been anything. A
// machine-readable instant is the right shape for a machine-readable source, and
// UTC because the file records no zone. Zero means the file carried no time.
func readestTime(ms int64) string {
	if ms <= 0 {
		return ""
	}
	return time.UnixMilli(ms).UTC().Format(time.RFC3339)
}
