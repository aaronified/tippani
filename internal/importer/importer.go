// Package importer parses bulk-import files into books + annotations.
// Pure parsing only — no DB, no HTTP; the httpapi layer owns persistence,
// dedupe, and ISBN normalization. Formats: markdown (frontmatter or Readest,
// auto-detected, PLAN 5b), Bookcision JSON (PLAN 5d), and saved Hardcover
// journal pages (PLAN 5e), and the Kindle device's own My Clippings.txt
// (experimental: the format is undocumented and localised, so that parser reads
// structure rather than English and reports what it skipped).
package importer

import (
	"strconv"
	"strings"
)

// Book is the book header parsed from an import file.
type Book struct {
	Title  string
	Author string
	// The other two credits (0034). Read from Tippani's own frontmatter only —
	// no third-party importer has a source for either, which is also why they are
	// absent from the staging queue.
	Translator string
	Editor     string
	// The two languages (0047), read from Tippani's own frontmatter only, for the
	// same reason the two credits above are: no third-party importer has a source
	// for either. Language is the edition in hand, OrigLanguage what it was written
	// in — two facts, because a Bengali novel read in Bengali fills one and a
	// translation fills both differently.
	Language     string
	OrigLanguage string
	ISBN         string // as found in the file; callers normalize to ISBN-13
	ASIN         string
	Series       string  // series name, when the file carries one
	SeriesIndex  float64 // position within it (0 = unknown)
	// Shelf state, round-tripped by the Tippani export (§3f). Status is the
	// server's own vocabulary ("reading" | "paused" | "abandoned" | "completed");
	// the parser passes through whatever the file says and lets the server reject
	// anything it does not recognise.
	Status   string
	Progress int    // 0-100
	Pos      int    // "page: 128/320" — the page you are on
	PosTotal int    // …out of this many
	Reads    []Read // read history, oldest first
}

// Read is one entry of a work's read/watch history, parsed from the export's
// "reads:" line. Dates are partial by design: 'YYYY', 'YYYY-MM' or 'YYYY-MM-DD'.
type Read struct {
	StartedAt  string
	FinishedAt string
	Outcome    string // "open" | "finished" | "abandoned"
}

// Annotation is one parsed quote/note.
type Annotation struct {
	Quote string
	Note  string
	// Chapter is the chapter's NAME and ChapterNo its number (0044). A source that
	// carries one undivided string — a Kindle clipping's "Chapter 3", a hand-written
	// file's "## The Fall" — puts all of it in Chapter and leaves ChapterNo at 0.
	// Nothing guesses: see splitChapterHeading for the one shape that is split, and
	// the migration for why that restraint is the point.
	Chapter   string
	ChapterNo float64
	Location  string
	// Who says the line (0047). A novel has SPEAKERS and not a cast, so there is
	// no Actor beside this — the field a film's Dialogue carries and this one
	// deliberately does not.
	Character string
	Color     string // "" -> caller defaults to yellow
	Tags      []string
	Favorite  bool
	NotedAt   string // original date of the highlight/note, when the source carries one; "" otherwise
}

// Result groups the annotations of one book.
type Result struct {
	Book        Book
	Annotations []Annotation
}

// truthy reads a boolean binding/frontmatter value. Tippani's own export writes
// "true", but hand-edited files and other tools say "yes" or "1", so all three
// count; anything else (including "false") is off.
func truthy(val string) bool {
	return val == "true" || val == "yes" || val == "1"
}

// parseProgress reads a "progress: 40%" value. The % is optional and anything
// unparseable is 0 rather than an error — a bad percentage is not worth failing
// an import of somebody's highlights over.
func parseProgress(val string) int {
	n, err := strconv.Atoi(strings.TrimSpace(strings.TrimSuffix(strings.TrimSpace(val), "%")))
	if err != nil || n < 0 {
		return 0
	}
	if n > 100 {
		return 100
	}
	return n
}

// parseOutOf reads an "N/M" position value ("page: 128/320", "season: 2/5") into
// its two numbers. Anything unparseable yields 0, 0 — a bad position is not worth
// failing an import of somebody's highlights over, and the server treats a
// position with no total as "tracking by percent" anyway.
func parseOutOf(val string) (int, int) {
	a, b, found := strings.Cut(strings.TrimSpace(val), "/")
	if !found {
		return 0, 0
	}
	pos, err1 := strconv.Atoi(strings.TrimSpace(a))
	total, err2 := strconv.Atoi(strings.TrimSpace(b))
	if err1 != nil || err2 != nil || pos < 0 || total < 0 {
		return 0, 0
	}
	return pos, total
}

// parseCount reads a bare count binding — "5", or "S2" as people write a season —
// into a number, or nil when the value is not one. nil is "the file didn't say",
// which for a season/episode is a different fact from 0 (see Dialogue.Season).
//
// Nothing here errors: a mistyped episode is not worth failing an import of
// somebody's quotes over, and an unset locator is always a legal state.
func parseCount(val string) *int {
	v := strings.TrimPrefix(strings.ToLower(strings.TrimSpace(val)), "s")
	n, err := strconv.Atoi(strings.TrimSpace(v))
	if err != nil || n < 0 {
		return nil
	}
	return &n
}

// parseSeasonEpisode reads the combined shapes people actually write by hand —
// "S2E5", "s02e05", "2x05" — into both numbers. ok is false when the value holds
// no separator, which is the exporter's own one-number-per-key form.
func parseSeasonEpisode(val string) (season, episode int, ok bool) {
	v := strings.TrimPrefix(strings.ToLower(strings.TrimSpace(val)), "s")
	for _, sep := range []string{"e", "x", "×"} {
		a, b, found := strings.Cut(v, sep)
		if !found {
			continue
		}
		s, err1 := strconv.Atoi(strings.TrimSpace(a))
		e, err2 := strconv.Atoi(strings.TrimSpace(strings.TrimPrefix(strings.TrimSpace(b), "p")))
		if err1 != nil || err2 != nil || s < 0 || e < 0 {
			return 0, 0, false
		}
		return s, e, true
	}
	return 0, 0, false
}

// applyEpisodeBinding folds one "season:" or "episode:" binding into a dialogue.
// Either key may carry the combined "S2E5" form, in which case it sets both —
// that is how people write it, and a hand-written file that says it once on one
// line should not need to say it twice.
func applyEpisodeBinding(d *Dialogue, key, val string) {
	if s, e, ok := parseSeasonEpisode(val); ok {
		d.Season, d.Episode = &s, &e
		return
	}
	n := parseCount(val)
	if n == nil {
		return
	}
	if key == "season" {
		d.Season = n
	} else {
		d.Episode = n
	}
}

// parseReads reads the export's "reads:" line back into rows — semicolon between
// reads, an em dash between a read's two dates, "(abandoned)" marking the ones
// that were given up on:
//
//	2019-03-04 — 2019-04-01; 2021 — 2021-02 (abandoned); 2026-07 —
//
// A missing finish date means the read is still open. Hand-written files may use
// a plain hyphen or an en dash instead, so all three separators are accepted.
// Entries with neither date are dropped: an empty read is not history.
func parseReads(val string) []Read {
	var out []Read
	for _, chunk := range strings.Split(val, ";") {
		chunk = strings.TrimSpace(chunk)
		if chunk == "" {
			continue
		}
		outcome := ""
		if i := strings.Index(strings.ToLower(chunk), "(abandoned)"); i >= 0 {
			outcome = "abandoned"
			chunk = strings.TrimSpace(chunk[:i] + chunk[i+len("(abandoned)"):])
		}
		start, finish := chunk, ""
		for _, dash := range []string{"—", "–", " - "} {
			if a, b, found := strings.Cut(chunk, dash); found {
				start, finish = a, b
				break
			}
		}
		start, finish = strings.TrimSpace(start), strings.TrimSpace(finish)
		if start == "" && finish == "" {
			continue
		}
		if outcome == "" {
			if finish == "" {
				outcome = "open"
			} else {
				outcome = "finished"
			}
		}
		out = append(out, Read{StartedAt: start, FinishedAt: finish, Outcome: outcome})
	}
	return out
}

// ---- movie/show quote imports (IMDb) ----

// MovieHeader is the film/show parsed from a quotes import file. Director and
// Genres come from the Tippani catalogue export (renderMovieExport); the IMDb
// importer leaves them empty.
type MovieHeader struct {
	Title     string
	Year      int
	IMDbID    string // as found in the file (ttNNNNN); informational
	MediaType string // "movie" | "show" | "game"
	Director  string
	// Publisher is a game's, and it is here so an export round-trips (0042).
	// `director` alone could not: re-importing a catalogue export written before
	// the split would have nowhere to put the second credit and would silently
	// drop it, which is how an export stops being a backup.
	Publisher   string
	Genres      []string
	Series      string  // collection / franchise name, when the file carries one
	SeriesIndex float64 // position within it (0 = unknown)
	Status      string  // as Book.Status, with "watching" as this side's in-progress word
	Progress    int     // 0-100
	Pos         int     // "episode: 4/10" — the episode within the current season
	PosTotal    int     // …out of this many in that season
	Season      int     // "season: 2/5"
	SeasonTotal int     // …out of this many
	Reads       []Read  // watch history, oldest first
}

// Dialogue is one parsed quote/exchange. Character is set only when the whole
// exchange is a single speaker (PLAN: one dialogue per exchange). The remaining
// fields are populated by the catalogue-export importer (round-trip).
type Dialogue struct {
	Quote     string
	Character string
	Actor     string
	Timestamp string
	// Shows only: which episode the line is from. Pointers because nil ("the file
	// didn't say") and 0 are different facts — season 0 is where a series keeps
	// its specials, so it has to survive a round trip as a number.
	Season  *int
	Episode *int
	// The episode's NAME, and a game's two locators (0047). Plain strings, not
	// pointers: empty is unset here because "Act 0" is not a thing anyone writes
	// and a quest has a name rather than an index — the argument gameRef makes at
	// the API. Which of them survives depends on the destination's media type, and
	// writeMovieDialogues is where that gate lives; a parser only reports what the
	// file said.
	EpisodeName string
	Act         string
	Quest       string
	Note        string
	Color       string // "" = the importer leaves it to the server default (yellow)
	Tags        []string
	Favorite    bool
	NotedAt     string // as for Annotation. No file format carries a date for a
	// dialogue yet, so no parser sets this; it exists so that retargeting staged
	// book highlights (which do carry Kindle dates) onto a film keeps them
	// instead of silently dropping the field on the way across.
}

// MovieResult groups the dialogues of one film/show (mirrors Result for books).
type MovieResult struct {
	Movie     MovieHeader
	Dialogues []Dialogue
}
