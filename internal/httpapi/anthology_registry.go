package httpapi

// THE FIELD REGISTRY (0074) — one list naming everything an anthology entry can
// show, replacing six `if`s that each knew their own answer.
//
// WHY A LIST AND NOT SIX MORE BOOLEANS. 0045's six were a fixed set with a column
// each, read by one renderer, and at that size a registry would have been more
// code saying the same thing — which is why this file did not exist until there
// was a second source to read from. It pays for itself at the work join below:
// eleven more fields, three kinds, two storage shapes and (soon) three renderers,
// and every one of those is a row here rather than an edit in four places.
//
// WHAT A ROW HAS TO SAY, and each of the four is load-bearing:
//
//   WHERE IT COMES FROM. `Col` names the 0045 column for the six that have one;
//   everything else is "" and lives in the `fields` JSON column. One lookup,
//   `anthologyFields.shows`, hides that split from every caller.
//
//   WHICH KINDS IT APPLIES TO, in 0043's `book | screen | utterance` vocabulary.
//   A standalone quote has no parent work, so every work field is empty for it —
//   and saying so here is what stops the export writing `- publisher:` on a
//   proverb. THE BULK SIDE SPEAKS A DIFFERENT VOCABULARY (`annotation |
//   dialogue | utterance`) and the mapping is written down at kindOfBulk rather
//   than assumed, which is 0043's own instruction.
//
//   ITS DEFAULT, and the existing asymmetry is preserved rather than tidied:
//   `Hidden` marks a `hide_*` column where the zero value SHOWS the thing. Only
//   four rows carry it. Everything added since is off at zero, so a default
//   export is byte for byte what it was before this file.
//
//   ITS BINDING KEY, so the reading view and the Markdown cannot diverge — 0045's
//   promise that "what you see when you read the anthology is what you get when
//   you export it", which is already tested.
//
// WHAT SURVIVES A ROUND TRIP, and most of this does not. The quotes importer's
// whole vocabulary is `internal/importer/quote_markdown.go`, and of the keys
// below it reads `speaker`, `occasion`, `work_title`, `translator` and `editor`
// and nothing else. `publisher`, `year`, `series`, `isbn`, `pages`, `subtitle`,
// `media_type`, `author`, `director` and `locator` have nowhere to land, because
// an anthology entry re-imports as a STANDALONE QUOTE and a standalone quote has
// no such columns. That is the format's own documented choice (see
// export_anthology.go's header: "A BOOK HIGHLIGHT EXPORTS AS AN ATTRIBUTED
// PASSAGE, not as a record with an ISBN"), not a defect introduced here — and
// `locator` has had exactly this shape since 0045.
//
// AND TWO OF THEM SHARE A DESTINATION. The importer aliases `translator` and
// `editor` onto the same `source_author` column, so an anthology exported with
// both switched on and re-imported keeps whichever the writer emitted last. The
// cost is one book's two secondary credits collapsing to one on a trip out and
// back; the alternative is inventing keys the importer does not know purely to
// avoid it, which trades a documented loss for an undocumented one.

import (
	"encoding/json"
	"sort"
	"strings"
)

// The three kinds an anthology entry can be are review_handlers.go's kindBook /
// kindScreen / kindUtterance — 0043 gave anthology_entries the SAME vocabulary as
// item_reviews on purpose ("a second spelling would need a mapping in the one
// place a mistake is invisible"), so this file reads those constants rather than
// declaring a second set that agrees today.

// THE BULK LAYER'S VOCABULARY IS NOT MAPPED HERE, and that is a decision rather
// than an omission. `annotation | dialogue | utterance` becomes `book | screen |
// utterance` on the path that turns a bulk selection into entries, and nothing in
// this file is on that path: the registry reads an entry that already has its kind.
// A map here would be a table with no caller — the shape this repository has
// already recorded as a defect in `attribution.js`'s `attributionOf` — and a guard
// asserting a mapping that only the guard reads proves nothing about the code that
// actually converts. It belongs with the conversion, when the conversion needs it.

// The keys the code names directly. Every other row is reached by iterating the
// registry, but these three are read by a condition rather than by a loop — the
// renderer's fixed middle needs the colour, and the heading is built from the
// source and the credit — and a bare string literal in those places is a typo
// waiting to become a switch that silently stops working.
const (
	fieldCredit = "credit"
	fieldSource = "source"
	fieldColour = "colour"
)

// anthologyField is one thing an anthology entry can show.
type anthologyField struct {
	// Key is the name on the wire, in the `fields` column, and in the client's own
	// switch list. One spelling everywhere.
	Key string
	// Col is the 0045 column backing this field, or "" for one that lives in the
	// `fields` JSON. Only six rows have one and no seventh ever will — that is what
	// 0074 is for.
	Col string
	// Hidden marks a `hide_*` column: the zero value SHOWS the thing. The four that
	// carry it are the four that were already on screen when 0045 landed.
	Hidden bool
	// Kinds are the entry kinds this field can ever have a value for. A field is
	// simply absent from an entry of another kind — not empty, not blank: absent.
	Kinds []string
	// Binding is the Markdown key it exports under. Never "" — a field that is
	// shown and not written would break 0045's promise that the screen and the
	// file are one document.
	Binding string
	// Label is the locale key the switch is drawn with. The six 0045 fields keep
	// their own prose ("Who said it"), because they name parts of the DOCUMENT;
	// everything since names a field of the WORK and takes common.field.*, which
	// already carries every one of them.
	Label string
}

// allKinds is the three, for a field that applies to an entry however it was filed.
var allKinds = []string{kindBook, kindScreen, kindUtterance}

// workKinds is the two that HAVE a parent work. A standalone quote has none, which
// is why every row below reading from the work names this and not allKinds.
var workKinds = []string{kindBook, kindScreen}

// anthologyRegistry is the list, in reading order — the order the switches are
// drawn in and the order the bindings are written in, so a reader comparing the
// screen with the file is comparing two renderings of one sequence.
//
// THE SIX COME FIRST because they are what an entry has always shown, and a
// reader who has never opened this list should find it unchanged at the top.
var anthologyRegistry = []anthologyField{
	{Key: "credit", Col: "hide_credit", Hidden: true, Kinds: allKinds, Binding: "speaker", Label: "anthologies.form.fields.credit.label"},
	{Key: "source", Col: "hide_source", Hidden: true, Kinds: allKinds, Binding: "occasion", Label: "anthologies.form.fields.source.label"},
	{Key: "locator", Col: "show_locator", Kinds: allKinds, Binding: "locator", Label: "anthologies.form.fields.locator.label"},
	{Key: "date", Col: "show_date", Kinds: allKinds, Binding: "date", Label: "anthologies.form.fields.date.label"},
	{Key: "commentary", Col: "hide_commentary", Hidden: true, Kinds: allKinds, Binding: "", Label: "anthologies.form.fields.commentary.label"},
	{Key: "colour", Col: "hide_colour", Hidden: true, Kinds: allKinds, Binding: "color", Label: "anthologies.form.fields.colour.label"},

	// THE WORK JOIN. Everything below reads the book or the film the entry came out
	// of, which the row has always carried the id of and never looked at.
	//
	// AUTHOR AND DIRECTOR ARE TWO ROWS AND NOT ONE. They are the same idea — who
	// made the thing — and a single switch would have to be labelled with one of
	// the two words, so an anthology of films would offer "Author" and one of books
	// "Director". A field that means different things per kind gets a row per kind;
	// a mixed anthology turns on both and each entry shows the one it has.
	{Key: "author", Kinds: []string{kindBook}, Binding: "author", Label: "common.field.author.label"},
	{Key: "director", Kinds: []string{kindScreen}, Binding: "director", Label: "common.field.director.label"},
	{Key: "translator", Kinds: []string{kindBook}, Binding: "translator", Label: "common.field.translator.label"},
	{Key: "editor", Kinds: []string{kindBook}, Binding: "editor", Label: "common.field.editor.label"},
	{Key: "publisher", Kinds: workKinds, Binding: "publisher", Label: "common.field.publisher.label"},
	{Key: "year", Kinds: workKinds, Binding: "year", Label: "common.field.year.label"},
	{Key: "series", Kinds: workKinds, Binding: "series", Label: "common.field.series.label"},
	{Key: "subtitle", Kinds: []string{kindBook}, Binding: "subtitle", Label: "common.field.subtitle.label"},
	{Key: "isbn", Kinds: []string{kindBook}, Binding: "isbn", Label: "common.field.isbn.label"},
	{Key: "pages", Kinds: []string{kindBook}, Binding: "pages", Label: "common.field.pages.label"},
	{Key: "media_type", Kinds: []string{kindScreen}, Binding: "media_type", Label: "common.field.media-type.label"},
}

// GENRES IS NOT IN THAT LIST AND THE REASON IS THE COLUMN, not the idea. Both
// works tables carry `genre_text`, which is space-joined for FTS — "Fiction
// Fantasy", not "Fiction, Fantasy" — so printing it in a document made to be read
// would put a search index on the page. The readable form is a join through
// book_genres/movie_genres, which is a second join and belongs with the person and
// cast joins rather than smuggled in beside eleven that need none.

// appliesTo says whether a field can have a value for an entry of this kind.
func (f anthologyField) appliesTo(kind string) bool {
	for _, k := range f.Kinds {
		if k == kind {
			return true
		}
	}
	return false
}

// fromWork says whether this field is read off the joined work rather than off the
// entry row. It is derived from the row rather than stated on it: a field with no
// 0045 column that is not one of the six IS a work field, and a second boolean
// saying so is a second thing to keep true.
func (f anthologyField) fromWork() bool { return f.Col == "" }

// anthologyFieldByKey is the lookup, built once. A key that is not here is ignored
// wherever it turns up — a stored `fields` array outliving a retired field must
// not be able to make a read fail.
var anthologyFieldByKey = func() map[string]anthologyField {
	m := make(map[string]anthologyField, len(anthologyRegistry))
	for _, f := range anthologyRegistry {
		m[f.Key] = f
	}
	return m
}()

// encodeExtraFields renders the on-keys as the canonical value of the `fields`
// column: a SORTED JSON array, and "" when nothing extra is on.
//
// SORTED SO THE COLUMN IS DIFFABLE. Two anthologies showing the same things store
// the same bytes, and a value that changes means something actually changed —
// which is what makes a stored set worth reading in a backup or a log.
//
// "" AND NOT "[]" for the empty case, because "" is the column default and a row
// nobody has configured must be indistinguishable from a row written before 0074.
func encodeExtraFields(on map[string]bool) string {
	keys := make([]string, 0, len(on))
	for k, v := range on {
		// An unknown key is dropped rather than stored: the registry is the
		// vocabulary, and a client inventing a name must not get it persisted.
		if f, ok := anthologyFieldByKey[k]; v && ok && f.fromWork() {
			keys = append(keys, k)
		}
	}
	if len(keys) == 0 {
		return ""
	}
	sort.Strings(keys)
	b, err := json.Marshal(keys)
	if err != nil {
		// json.Marshal of []string cannot fail; the branch exists so a future
		// change to the shape cannot silently store a half-value.
		return ""
	}
	return string(b)
}

// decodeExtraFields reads that column back. A value it cannot parse is treated as
// nothing on — the same answer as an untouched row — because a malformed flag set
// must degrade to the documented default rather than to an error on a read path
// that has no way to report one.
func decodeExtraFields(s string) map[string]bool {
	on := map[string]bool{}
	if strings.TrimSpace(s) == "" {
		return on
	}
	var keys []string
	if err := json.Unmarshal([]byte(s), &keys); err != nil {
		return on
	}
	for _, k := range keys {
		if _, ok := anthologyFieldByKey[k]; ok {
			on[k] = true
		}
	}
	return on
}

// anthologyFieldValue is what this entry has to say for this field.
//
// THE FOUR 0045 FIELDS ARE NAMED AND EVERYTHING ELSE READS THE WORK MAP, which is
// the whole shape of the split: the six that predate the registry live in columns
// on the entry row, and every field since comes off the joined work under its own
// registry key. A field with no case and no work value answers "" and
// `writeBinding` drops it, so a kind that cannot have a field never prints one.
func anthologyFieldValue(e anthologyEntryRow, f anthologyField) string {
	if f.fromWork() {
		return e.Work[f.Key]
	}
	switch f.Key {
	case fieldCredit:
		return e.Credit
	case fieldSource:
		return e.Source
	case "locator":
		return e.Locator
	case "date":
		return e.Date
	case fieldColour:
		return e.Color
	}
	// The commentary is the entry's own prose and is written above the quote rather
	// than as a binding, which is why its registry row carries no binding key and
	// why there is nothing to return for it here.
	return ""
}
