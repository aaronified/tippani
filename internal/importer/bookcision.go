package importer

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"strconv"
	"strings"
)

// clippingLimitPrefix marks entries truncated by the publisher/DRM clipping
// cap (PLAN 5c/5d) — never store them as quotes.
const clippingLimitPrefix = "<You have reached the clipping limit"

type bookcisionFile struct {
	Title      string          `json:"title"`
	Authors    json.RawMessage `json:"authors"` // string in real exports, array in some versions
	ASIN       string          `json:"asin"`
	Highlights []struct {
		Text       string  `json:"text"`
		IsNoteOnly bool    `json:"isNoteOnly"`
		Note       *string `json:"note"` // JSON null in real exports
		Location   struct {
			Value int64 `json:"value"`
		} `json:"location"`
	} `json:"highlights"`
}

// Bookcision parses a Bookcision JSON export (PLAN 5d, verified against a
// real export in testdata/bookcision_real.json).
func Bookcision(r io.Reader) (*Result, error) {
	var f bookcisionFile
	if err := json.NewDecoder(r).Decode(&f); err != nil {
		return nil, fmt.Errorf("bookcision: decode: %w", err)
	}
	if strings.TrimSpace(f.Title) == "" {
		return nil, errors.New("bookcision: missing title")
	}
	res := &Result{Book: Book{
		Title:  strings.TrimSpace(f.Title),
		Author: bookcisionAuthors(f.Authors),
		ASIN:   strings.TrimSpace(f.ASIN),
	}}
	for _, h := range f.Highlights {
		text := strings.TrimSpace(h.Text)
		if strings.HasPrefix(text, clippingLimitPrefix) {
			continue
		}
		var note string
		if h.Note != nil {
			note = strings.TrimSpace(*h.Note)
		}
		if text == "" && note == "" {
			continue
		}
		a := Annotation{Quote: text, Note: note}
		if h.IsNoteOnly { // the entry is a note, not a highlight
			a.Quote = ""
			if a.Note == "" {
				a.Note = text
			}
		}
		if h.Location.Value != 0 {
			a.Location = strconv.FormatInt(h.Location.Value, 10)
		}
		res.Annotations = append(res.Annotations, a)
	}
	return res, nil
}

// bookcisionAuthors decodes the version-dependent authors field: a string in
// real exports, an array in others. Anything else -> "".
func bookcisionAuthors(raw json.RawMessage) string {
	var s string
	if json.Unmarshal(raw, &s) == nil {
		return strings.TrimSpace(s)
	}
	var list []string
	if json.Unmarshal(raw, &list) == nil {
		for i, a := range list {
			list[i] = strings.TrimSpace(a)
		}
		return strings.Join(list, ", ")
	}
	return ""
}
