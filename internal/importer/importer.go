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
	// 0061, and read from Tippani's own frontmatter only for the same reason as
	// the four above: a Kindle clippings file and a Goodreads CSV have no source
	// for any of them.
	Subtitle  string
	Publisher string
	Pages     int    // the EXTENT of the work; Pos/PosTotal below are the read
	ISBN      string // as found in the file; callers normalize to ISBN-13
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
	// The work's own list of characters (0048), read from Tippani's own
	// frontmatter only — like the two credits and the two languages above, no
	// third-party importer has a source for it. A BOOK'S ENTRIES CARRY NO ACTOR:
	// a novel has speakers, not a cast, and the server clears the field rather
	// than rejecting the file (0047's rule — an import clears what a request is
	// refused).
	Cast []CastEntry
}

// Read is one entry of a work's read/watch history, parsed from the export's
// "reads:" line. Dates are partial by design: 'YYYY', 'YYYY-MM' or 'YYYY-MM-DD'.
type Read struct {
	StartedAt  string
	FinishedAt string
	Outcome    string // "open" | "finished" | "abandoned"
}

// CastEntry is one row of a work's cast as a file states it: the two names, and
// the one word that says who wrote them.
//
// ORIGIN IS ON THE WIRE BECAUSE IT IS THE HALF THAT CANNOT BE RE-DERIVED. The
// names come back either way; "this one is mine, do not let a refetch rewrite
// it" and "this one I deleted, do not let a refetch bring it back" exist nowhere
// else in the file, and an export that dropped them would hand the reader's
// library back with its provenance flattened to the provider's.
//
// The provider's own facts — person_id, image_url — are deliberately NOT here.
// They are an id inside a supplier's namespace and a URL, neither of which
// belongs in a file somebody reads or hand-edits, and the next lookup takes them
// back on every row regardless of who has touched it. What that costs is a
// portrait per row until that lookup happens.
type CastEntry struct {
	Character string
	Actor     string // always empty on a book
	// Origin is the schema's own vocabulary — "provider" | "corrected" | "reader"
	// | "removed" — passed through as written. An empty value means the file said
	// nothing, which the server reads as the provider's. Validating it here would
	// put the vocabulary in two packages.
	Origin string
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
	// What the line SAYS, for a highlight whose words are not in a language the
	// reader has (0051). Read from Tippani's own frontmatter and hand-written files
	// only: no third-party importer has a source for it, which is the same reason
	// Book's two credits and two languages are parsed and never supplied.
	//
	// NOT FOLDED INTO Note, and quote_markdown.go has said why since the quote
	// importer was written — a note is what you thought, a translation is what the
	// line says. A parser that merged them would be the loss 0051 exists to undo,
	// and it would be silent: the import would succeed and the counts would match.
	Translation string
	Tags        []string
	Favorite    bool
	NotedAt     string // original date of the highlight/note, when the source carries one; "" otherwise
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

// parseCast reads the export's "cast:" / "characters:" line back into rows —
// semicolon between entries, an em dash between a character and who plays them,
// a parenthesised word for anything that is not the provider's own:
//
//	cast: GLaDOS — Ellen McLain; Chell (reader); Cave Johnson — J.K. Simmons (removed)
//
// SHAPED AFTER parseReads DELIBERATELY, down to the separators. One frontmatter
// line rather than a YAML list because writeFrontmatter is a flat key/value
// writer with no YAML dependency (PLAN §5b), and the two lines that carry a list
// of small records should be read by the same hand-rolled split rather than by
// two.
//
// A MISSING ACTOR IS ORDINARY AND NOT A MALFORMED ENTRY: a book's characters
// never have one, and a game's voice actor is exactly the thing the reader has
// not filled in yet. So the dash is optional, and an entry with neither name is
// dropped — the same rule parseReads applies to a read with neither date.
//
// The separators are the same bet parseReads makes: an em dash cannot appear
// inside a date there, and it is vanishingly rare inside a name here. A hand
// written file may use a hyphen or an en dash instead, so all three are accepted.
// A character whose name genuinely contains one of them, or a semicolon, is the
// bounded cost of a format a person can read and edit.
func parseCast(val string) []CastEntry {
	var out []CastEntry
	for _, chunk := range strings.Split(val, ";") {
		chunk = strings.TrimSpace(chunk)
		if chunk == "" {
			continue
		}
		origin := ""
		// Read from the END, because a parenthesis is far likelier inside a
		// character's name — "The Narrator (voice)" — than after the marker.
		if i := strings.LastIndex(chunk, "("); i >= 0 && strings.HasSuffix(chunk, ")") {
			if o := castOriginWord(chunk[i+1 : len(chunk)-1]); o != "" {
				origin = o
				chunk = strings.TrimSpace(chunk[:i])
			}
		}
		character, actor := chunk, ""
		for _, dash := range []string{"—", "–", " - "} {
			if a, b, found := strings.Cut(chunk, dash); found {
				character, actor = a, b
				break
			}
		}
		character, actor = strings.TrimSpace(character), strings.TrimSpace(actor)
		if character == "" && actor == "" {
			continue
		}
		out = append(out, CastEntry{Character: character, Actor: actor, Origin: origin})
	}
	return out
}

// castOriginWord maps a marker to the schema's own `origin` vocabulary, and
// answers "" for anything it does not recognise — which is what keeps a
// parenthesis that is part of a name from being eaten as a marker.
//
// EXACTLY THE THREE WORDS THE EXPORTER WRITES, and the narrowing is the point.
// This began with five aliases on the reasoning that a hand-edited file deserves
// the same concession "colour", "creator" and "ep" get. It is not the same
// concession: those are alternative spellings of a VALUE, while this is a suffix
// stripped off the end of somebody's CHARACTER NAME. Every extra word is a name
// the round trip silently mangles — a provider-origin character literally called
// "X (deleted)" exports with no marker (castFrontmatter writes `provider` as
// nothing at all), came back as a TOMBSTONE called "X", and the credit vanished
// from the list on import. "provider" was the same trap with a quieter outcome,
// and it is not written either.
//
// So the accepted set is castFrontmatter's output and nothing more. A hand-writer
// who wants a marker can copy one out of their own export, which is where they
// would look anyway.
func castOriginWord(s string) string {
	switch strings.ToLower(strings.TrimSpace(s)) {
	case "corrected":
		return "corrected"
	case "reader":
		return "reader"
	case "removed":
		return "removed"
	}
	return ""
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
	// The title's cast (0048), from Tippani's own frontmatter only. A GAME'S
	// SECOND NAME IS THE VOICE ACTOR — the same field under a different word, and
	// the only place most games' voice credits exist at all, since Wikidata has
	// none for well over half of them (TIP-META-018).
	Cast []CastEntry
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
	Translation string // 0051; see Annotation.Translation for why it is not the note
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
