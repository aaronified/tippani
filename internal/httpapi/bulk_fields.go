package httpapi

import "slices"

// ONE TABLE FOR EVERY FIELD EITHER BULK EDITOR CAN SET, and the reason it exists
// is that there are two editors and they drifted.
//
// The live one (`POST /quotes/bulk`, bulk_handlers.go) and the staged one
// (`POST /import/staged/bulk`, import_staged_bulk.go) do the same job either side
// of approval: fix a field across a selection. They were written separately, and
// `docs/plans/bulk-editors-one-field-table.md` found the consequence — **neither
// one's field list was a superset of the other's**. A reader could set a season
// before approving and not after, and a note after approving and not before.
//
// THE DRIFT HAS MOSTLY BEEN CLOSED BY HAND SINCE, one column at a time, which is
// the argument for this table rather than against it. Measured at the commit that
// introduced this file: 22 fields on both, six only live, five only staged. The
// plan was written when it was 19 and 14. Nothing stopped that drift and nothing
// but this stops the next one.
//
// WHAT EACH ENTRY CARRIES, and each column of it earns its place:
//
//   kinds    which of annotation / dialogue / utterance actually has the column.
//            These are bulkTag's kind names — see quoteFieldKinds' own note about
//            the release in which the bin called the third kind "quote" and every
//            per-kind field on the Quotes screen answered 400.
//   live     the column name on annotations / dialogues / utterances.
//   staged   the column name on staged_quotes. IT IS NOT ALWAYS THE SAME NAME —
//            `board_id` live is `board` staged — and that single exception is why
//            this is a mapping rather than a set. An implicit "same name" rule
//            would be right twenty-five times and silently wrong once.
//   notNull  whether a clear writes '' rather than NULL. The live side's own
//            comment calls this "THE MISTAKE THAT WOULD NOT BE CAUGHT BY READING
//            THE CODE": nullable("") is nil, and clearing a NOT NULL column that
//            way is a 500 raised inside the transaction, after the ownership
//            check — the most expensive place to find out.
//
// AN EMPTY `live` OR `staged` MEANS THAT SIDE CANNOT SET IT, and those are the
// gaps the later steps of the plan close. They are written out rather than
// omitted, because a field missing from this table and a field one editor lacks
// look identical from the outside, and only one of them is a defect.
type bulkField struct {
	kinds   []string
	live    string
	staged  string
	notNull bool
}

// The three kind names, spelled once, because a typo in one is the failure
// quoteFieldKinds documents.
//
// IT IS NOT `allKinds`, AND THE NAME COLLISION IS THE POINT. `anthology_registry.go`
// already has an `allKinds`, and it is a DIFFERENT VOCABULARY: kindBook / kindScreen
// / kindUtterance spell the same three concepts "book", "screen" and "utterance"
// (review_handlers.go:526-528), where bulkTag spells them "annotation", "dialogue"
// and "utterance". Two vocabularies for one concept is exactly what cost this file
// four releases of `POST /quotes/bulk` answering 400 to every per-kind field the
// Quotes screen offers — and the two lists SHARE their third word, so a mistaken
// reuse would be right about utterances and silently wrong about the other two,
// which is the hardest shape to notice. Named for its own vocabulary so the reuse
// cannot be made by reaching for the obvious word.
var bulkAllKinds = []string{"annotation", "dialogue", "utterance"}

var bulkFields = map[string]bulkField{
	// ── on every kind ────────────────────────────────────────────────────────
	"note": {kinds: bulkAllKinds, live: "note"},
	// 0071. The most obviously bulk-settable thing in the app: forty highlights
	// out of one Bengali book is one value on forty rows.
	"language": {kinds: bulkAllKinds, live: "language", staged: "language", notNull: true},

	// ── a book highlight's locators ──────────────────────────────────────────
	"chapter": {kinds: []string{"annotation"}, live: "chapter", staged: "chapter"},
	// The one field written through nullableMeasure rather than as text, which is
	// why the live side keeps a separate line for it in both places.
	"chapter_no": {kinds: []string{"annotation"}, live: "chapter_no", staged: "chapter_no"},
	"location":   {kinds: []string{"annotation"}, live: "location", staged: "location"},

	// 0047: a book character is a character. The word and the column are the same
	// on both sides, which is what lets one facet and one autocomplete serve them.
	"character": {kinds: []string{"annotation", "dialogue"}, live: "character", staged: "character", notNull: true},

	// ── a film or show line's locators ───────────────────────────────────────
	"actor":     {kinds: []string{"dialogue"}, live: "actor", staged: "actor"},
	"timestamp": {kinds: []string{"dialogue"}, live: "timestamp", staged: "timestamp"},
	// 0070. `timestamp_end` belongs in notNull and `timestamp` beside it does not:
	// the new column is NOT NULL DEFAULT '' while the old one predates that rule
	// and is nullable. The pair look alike and clear differently, which is exactly
	// the mistake the notNull column exists to stop.
	"timestamp_end": {kinds: []string{"dialogue"}, live: "timestamp_end", staged: "timestamp_end", notNull: true},
	"act":           {kinds: []string{"dialogue"}, live: "act", staged: "act", notNull: true},
	"quest":         {kinds: []string{"dialogue"}, live: "quest", staged: "quest", notNull: true},
	"episode_name":  {kinds: []string{"dialogue"}, live: "episode_name", staged: "episode_name", notNull: true},
	"dlc":           {kinds: []string{"dialogue"}, live: "dlc", staged: "dlc", notNull: true},

	// ── a standalone quote's attribution ─────────────────────────────────────
	//
	// FOUR OF THESE HAVE BEEN NOT NULL SINCE 0026, and clearing any of them in
	// bulk was a 500 for as long as the fields existed — which nobody found,
	// because a kind-name bug answered 400 first and the 400 never let the request
	// reach the UPDATE.
	"speaker":       {kinds: []string{"utterance"}, live: "speaker", staged: "speaker", notNull: true},
	"occasion":      {kinds: []string{"utterance"}, live: "occasion", staged: "occasion", notNull: true},
	"place":         {kinds: []string{"utterance"}, live: "place", staged: "place", notNull: true},
	"medium":        {kinds: []string{"utterance"}, live: "medium", notNull: true},
	// NOT NULL since 0053, and this line was missing its flag for one commit.
	// The extraction that built this table used a regex wanting one space after
	// the colon; the literal it read spelled this entry "kind":   true. Clearing
	// a quote's kind in bulk became a 500 — the exact failure the flag exists to
	// prevent — and TestQuoteKindInBulk caught it.
	"kind":          {kinds: []string{"utterance"}, live: "kind", notNull: true},
	"region":        {kinds: []string{"utterance"}, live: "region", staged: "region", notNull: true},
	"recipient":     {kinds: []string{"utterance"}, live: "recipient", staged: "recipient", notNull: true},
	"work_title":    {kinds: []string{"utterance"}, live: "work_title", staged: "work_title", notNull: true},
	"locator":       {kinds: []string{"utterance"}, live: "locator", staged: "locator", notNull: true},
	"source_author": {kinds: []string{"utterance"}, live: "source_author", staged: "source_author", notNull: true},

	// THE DATE AND ITS TICK, added together because they are one fact split in
	// two: the date, and whether it is an estimate. 0047 made the flag an INTEGER
	// NOT NULL DEFAULT 0, so it is written through boolToInt and never through
	// nullable() — which is why it carries no `notNull`, and why the schema walk
	// asks only about TEXT columns.
	"occasion_date":  {kinds: []string{"utterance"}, live: "occasion_date", staged: "occasion_date", notNull: true},
	"occasion_circa": {kinds: []string{"utterance"}, live: "occasion_circa", staged: "occasion_circa"},
}

// quoteFieldKinds names, per optional field, the kinds that actually have the
// column — DERIVED from the table above rather than written beside it.
//
// IT USED TO BE A LITERAL, and this is the third table in this file's history to
// be folded into one: the applicability check and the write loop each carried
// their own, and a field present in the first and missing from the second is
// accepted, reported as updated, and silently dropped.
//
// Only fields the LIVE endpoint can set appear here, because that is the only
// question this map is asked — `unsupportedQuoteField` uses it to refuse a field
// for a kind that has no column for it. A staged-only field is not "unsupported
// for this kind"; it is not this endpoint's field at all.
var quoteFieldKinds = func() map[string][]string {
	m := make(map[string][]string, len(bulkFields))
	for name, f := range bulkFields {
		if f.live != "" {
			m[name] = f.kinds
		}
	}
	return m
}()

// notNullQuoteCols are the bulk-settable columns declared NOT NULL with an
// empty-string default, so a clear has to write the empty string rather than a
// NULL — derived, for the same reason as above.
var notNullQuoteCols = func() map[string]bool {
	m := make(map[string]bool, len(bulkFields))
	for _, f := range bulkFields {
		if f.notNull {
			if f.live != "" {
				m[f.live] = true
			}
			if f.staged != "" {
				m[f.staged] = true
			}
		}
	}
	return m
}()

// bulkFieldTakesKind answers the one question both endpoints ask of the table.
// A field neither side declares is not applicable to anything, which is the safe
// answer: an unknown field name must be refused, never quietly accepted.
func bulkFieldTakesKind(name, kind string) bool {
	f, ok := bulkFields[name]
	return ok && slices.Contains(f.kinds, kind)
}
