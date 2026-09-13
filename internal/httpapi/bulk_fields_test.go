package httpapi

// The bulk field editor, and the two ways it was wrong.
//
// 1. THE LIVE BUG. `quoteFieldKinds` spelled the standalone-quote kind "quote"
//    while bulkTag is called with "utterance" (quoteBulkKinds' spelling, and the
//    one the bin table one line down does NOT use). The result: `POST
//    /quotes/bulk` answered 400 — "speaker does not apply to this kind" — to
//    every per-kind field the Quotes screen offers, for a kind that has all four
//    columns. Two vocabularies for one concept, and the mismatch was invisible
//    because "does not apply to this kind" is a legitimate answer for some other
//    kind. Nothing tested it, and BULK_QUOTE_FIELDS on the client happily offers
//    speaker, occasion, place and medium.
//
// 2. THE NEW COLUMNS. 0047's are NOT NULL with an empty-string default, and every
//    other field in this file is written through nullable() — which maps "" to
//    nil. Clearing one of them over a selection would therefore be a NOT NULL
//    violation surfacing as a 500, inside the transaction and after the ownership
//    check.
//
// Both are silent failures of the kind bulk_handlers' own header is about: a
// success that did nothing looks exactly like a success that did something.

import (
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
	"testing"
)

// The drift guard. Two tables name kinds; walking them against each other is
// cheaper than remembering that they must agree, which is what four releases of
// disagreement demonstrates.
func TestEveryBulkFieldKindIsAKindBulkTagKnows(t *testing.T) {
	for field, kinds := range quoteFieldKinds {
		for _, kind := range kinds {
			if _, ok := quoteBulkKinds[kind]; !ok {
				t.Errorf("quoteFieldKinds[%q] names kind %q, which bulkTag has never heard of "+
					"(quoteBulkKinds has %v) — every field on that kind would answer 400",
					field, kind, kindNames())
			}
		}
	}
	// And in the other direction: a request field with no entry in the table is
	// refused for EVERY kind, which is a field nobody can set.
	for field := range bulkQuoteFieldPtrs(&bulkTagReq{}) {
		if len(quoteFieldKinds[field]) == 0 {
			t.Errorf("%q is settable on the request and applies to no kind", field)
		}
	}
	// chapter_no is written outside the pointer table (it goes through
	// nullableMeasure, not nullable), so it is checked on its own rather than
	// left to look like an omission.
	if len(quoteFieldKinds["chapter_no"]) == 0 {
		t.Error("chapter_no applies to no kind")
	}
}

func kindNames() []string {
	out := make([]string, 0, len(quoteBulkKinds))
	for k := range quoteBulkKinds {
		out = append(out, k)
	}
	slices.Sort(out)
	return out
}

// Every field, on every kind that has it, over a real selection — set, then
// cleared. The clear is the half that catches the NOT NULL trap.
func TestEveryBulkFieldSetsAndClearsOnItsOwnKind(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	book := createBook(t, c, "Moby-Dick")
	game := newWork(t, c, "Disco Elysium", "game")
	annID := idOf(t, c.mustDo("POST", "/annotations",
		map[string]any{"book_id": book, "quote": "a highlight"}, http.StatusCreated).Body.Bytes())
	dlgID := idOf(t, c.mustDo("POST", "/dialogues",
		map[string]any{"movie_id": game, "quote": "a game line"}, http.StatusCreated).Body.Bytes())
	quoteID := newUtterance(t, c, map[string]any{"quote": "a standalone quote"}).ID

	for _, tc := range []struct {
		kind, path, table string
		id                int64
		fields            []string
	}{
		{"annotation", "/annotations/bulk", "annotations", annID,
			[]string{"note", "translation", "chapter", "location", "character"}},
		{"dialogue", "/dialogues/bulk", "dialogues", dlgID,
			[]string{"note", "translation", "character", "actor", "timestamp", "act", "quest", "episode_name"}},
		{"utterance", "/quotes/bulk", "utterances", quoteID,
			[]string{"note", "translation", "speaker", "occasion", "place", "medium",
				"region", "recipient", "work_title", "locator"}},
	} {
		for _, field := range tc.fields {
			t.Run(tc.kind+"/"+field, func(t *testing.T) {
				// The table says this kind has the column, so a 400 here is the
				// two-vocabularies bug and a 500 is the NOT NULL one.
				if !slices.Contains(quoteFieldKinds[field], tc.kind) {
					t.Fatalf("quoteFieldKinds says %s has no %s", tc.kind, field)
				}
				c.mustDo("POST", tc.path,
					map[string]any{"ids": []int64{tc.id}, field: "set by bulk"}, http.StatusOK)
				var got any
				if err := srv.Store.DB.QueryRow(
					`SELECT `+field+` FROM `+tc.table+` WHERE id = ?`, tc.id).Scan(&got); err != nil {
					t.Fatal(err)
				}
				if s, _ := got.(string); s != "set by bulk" {
					t.Fatalf("%s.%s = %v after the bulk set", tc.table, field, got)
				}
				// THE CLEAR. "" through nullable() is nil, which a NOT NULL column
				// refuses — a 500 from inside the transaction.
				c.mustDo("POST", tc.path,
					map[string]any{"ids": []int64{tc.id}, field: ""}, http.StatusOK)
				if err := srv.Store.DB.QueryRow(
					`SELECT COALESCE(`+field+`, '') FROM `+tc.table+` WHERE id = ?`, tc.id).Scan(&got); err != nil {
					t.Fatal(err)
				}
				if s, _ := got.(string); s != "" {
					t.Fatalf("%s.%s = %v after the bulk clear", tc.table, field, got)
				}
			})
		}
	}
}

// A field the kind has no column for is still a 400 and not a silent drop — the
// rule the widening must not have loosened. A game's act on a shelf of standalone
// quotes is a request the caller has got wrong, and answering 200 to it reports a
// narrowing that never happened.
//
// THIS WALKS THE TABLE RATHER THAN A LIST OF SEVEN PAIRS, and the change is not
// tidiness. The seven were hand-picked, so a field added to `bulkFields` and
// missed by `unsupportedQuoteField` was tested by nothing. `occasion_date` shipped
// that way in this session's working tree: written by an `if` beside the shared
// loop, it never reached the applicability check, so a date sent to
// /annotations/bulk got past the 400 and failed as `no such column:
// annotations.occasion_date` INSIDE the transaction — a 500 after the ownership
// check, which is the exact failure this file's other guards exist to stop.
//
// THE BODY IS CHECKED, NOT ONLY THE STATUS, because four other 400s are reachable
// on this endpoint (an unknown colour, an unknown kind, a malformed chapter
// number, a malformed date) and any of them would make a broken applicability
// check look tested. Every value below is therefore valid ON ITS OWN TERMS: the
// only thing wrong with the request is the kind it is sent to.
func TestABulkFieldTheKindHasNoColumnForIsStillRefused(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	book := createBook(t, c, "Moby-Dick")
	game := newWork(t, c, "Disco Elysium", "game")
	rows := map[string]struct {
		path string
		id   int64
	}{
		"annotation": {"/annotations/bulk", idOf(t, c.mustDo("POST", "/annotations",
			map[string]any{"book_id": book, "quote": "a highlight"}, http.StatusCreated).Body.Bytes())},
		"dialogue": {"/dialogues/bulk", idOf(t, c.mustDo("POST", "/dialogues",
			map[string]any{"movie_id": game, "quote": "a game line"}, http.StatusCreated).Body.Bytes())},
		"utterance": {"/quotes/bulk", newUtterance(t, c, map[string]any{"quote": "a standalone quote"}).ID},
	}
	for kind := range quoteBulkKinds {
		if _, ok := rows[kind]; !ok {
			t.Fatalf("bulkTag knows kind %q and this case has no row of it to send", kind)
		}
	}

	// A value each field accepts, so the refusal can only be about the kind. The
	// default is a plain string; these are the ones with a shape of their own.
	values := map[string]any{
		"occasion_circa": true,
		"chapter_no":     "7",
		"kind":           "speech",  // one of quoteKinds, so 0053's check passes
		"occasion_date":  "1952",    // a shape normalizeHistoricalDate accepts
		"language":       "bn",
	}

	tried := 0
	for name, f := range bulkFields {
		if f.live == "" {
			continue // staged-only: this endpoint has no opinion on it
		}
		for kind, row := range rows {
			if slices.Contains(f.kinds, kind) {
				continue
			}
			tried++
			var val any = "x"
			if v, ok := values[name]; ok {
				val = v
			}
			rec := c.do("POST", row.path, map[string]any{"ids": []int64{row.id}, name: val})
			if rec.Code != http.StatusBadRequest {
				t.Errorf("%s on a %s: %d %s — the table says this kind has no such column, "+
					"so it must be a 400 here and not a failure inside the transaction",
					name, kind, rec.Code, strings.TrimSpace(rec.Body.String()))
				continue
			}
			if want := name + " does not apply to this kind"; !strings.Contains(rec.Body.String(), want) {
				t.Errorf("%s on a %s answered 400 with %s — wanted %q, so this 400 is "+
					"some other check passing for the wrong reason",
					name, kind, strings.TrimSpace(rec.Body.String()), want)
			}
		}
	}
	// A walk that finds nothing passes silently, which is how an extraction bug
	// reads as a clean run. Measured at 45 pairs over the table as it stands; the
	// floor is 40 so adding a field cannot quietly drop the walk to nothing.
	if tried < 40 {
		t.Fatalf("only %d field/kind pairs exercised; the walk is broken", tried)
	}
}

// A book character can be corrected by find-and-replace, which is the other bulk
// tool and the one that reaches the words. A misspelt name on four hundred
// highlights is the single commonest post-import complaint, and it is the one
// case where "replace" beats "set": setting a character over a selection makes
// four hundred rows agree, replacing one spelling with another leaves four
// hundred different names four hundred different names.
func TestFindAndReplaceReachesABookCharacter(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	book := createBook(t, c, "Moby-Dick")
	id := idOf(t, c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book, "quote": "a passage", "character": "Ahaab",
	}, http.StatusCreated).Body.Bytes())

	c.mustDo("POST", "/replace/apply", map[string]any{
		"kind": "annotation", "ids": []int64{id}, "field": "character",
		"find": "Ahaab", "replace": "Ahab",
	}, http.StatusOK)

	got := decode[struct {
		Annotations []annotationRow `json:"annotations"`
	}](t, c.mustDo("GET", "/annotations?id="+itoa(id), nil, http.StatusOK)).Annotations
	if len(got) != 1 || got[0].Character != "Ahab" {
		t.Fatalf("the replace did not reach the character: %+v", got)
	}
}

// TestEveryQuotePersonKindIsAKindBulkTagKnows — the third table in the same
// vocabulary, walked against the one that resolves a kind to a table.
//
// quotePersonKind translates bulkTag's word for a quote kind into store's, so a
// bulk edit of `actor` or `speaker` can re-point the row at a person (0059). It
// is looked up as quotePersonKind[kind] where `kind` came from quoteBulkKinds,
// so a spelling that drifts from that table is not an error — it is a miss, and
// a miss means a bulk edit over five thousand rows quietly writes the name and
// leaves every one of them pointing at whoever they used to.
//
// This is the guard bulk_handlers.go's own comment promises, and it is the same
// check as the one above because it is the same class of bug: two tables in one
// file naming one concept differently, where the wrong answer is silence.
func TestEveryQuotePersonKindIsAKindBulkTagKnows(t *testing.T) {
	if len(quotePersonKind) == 0 {
		t.Fatal("quotePersonKind is empty — this test is measuring nothing")
	}
	for kind, qk := range quotePersonKind {
		if _, ok := quoteBulkKinds[kind]; !ok {
			t.Errorf("quotePersonKind names kind %q, which bulkTag has never heard of "+
				"(quoteBulkKinds has %v) — a bulk edit of that kind would never re-link", kind, kindNames())
		}
		if qk == "" {
			t.Errorf("quotePersonKind[%q] maps to the empty store kind", kind)
		}
	}
	// AND IN THE OTHER DIRECTION, which is the half that actually caught
	// something worth catching. Every kind that has a person-bearing FIELD must
	// have an entry here, or the field is settable in bulk and never re-linked.
	for _, field := range []string{"actor", "speaker"} {
		for _, kind := range quoteFieldKinds[field] {
			if _, ok := quotePersonKind[kind]; !ok {
				t.Errorf("%q is bulk-settable on kind %q and that kind has no quotePersonKind entry — "+
					"the column moves and the link does not", field, kind)
			}
		}
	}
}

// TestEveryCharacterBearingKindHasACastLink — the fourth table, walked the same
// way, and it is a DIFFERENT set from the one above on purpose.
//
// A book highlight has a speaker and no performer; a standalone quote has a
// speaker and no work for a cast to belong to. So quoteCastKind holds annotation
// and dialogue where quotePersonKind holds dialogue and utterance, and a reader of
// either table who assumed they were the same list would wire the wrong half.
//
// THE FAILURE IT GUARDS IS THE SAME SILENCE. quoteCastKind[kind] is a lookup that
// MISSES rather than errors, so a spelling that drifts means a bulk edit of five
// thousand characters writes every name and leaves every speaker_cast_id pointing
// at whoever the line used to name.
func TestEveryCharacterBearingKindHasACastLink(t *testing.T) {
	if len(quoteCastKind) == 0 {
		t.Fatal("quoteCastKind is empty — this test is measuring nothing")
	}
	for kind, wk := range quoteCastKind {
		if _, ok := quoteBulkKinds[kind]; !ok {
			t.Errorf("quoteCastKind names kind %q, which bulkTag has never heard of "+
				"(quoteBulkKinds has %v)", kind, kindNames())
		}
		if wk != "book" && wk != "movie" {
			t.Errorf("quoteCastKind[%q] maps to %q, which is not a work_cast kind", kind, wk)
		}
	}
	// And the other direction: every kind whose `character` is bulk-settable must
	// have an entry, or the column moves and the link does not.
	for _, kind := range quoteFieldKinds["character"] {
		if _, ok := quoteCastKind[kind]; !ok {
			t.Errorf("character is bulk-settable on kind %q and that kind has no quoteCastKind entry", kind)
		}
	}
}

// TestEveryReplaceKindIsAKindTheTablesKnow — the same walk for find-and-replace,
// and the one whose absence shipped a 500.
//
// replaceFields said "quote" while quoteBulkKinds said "utterance", so
// `kind: "quote"` passed validation, took a zero-value spec with Table == "",
// and died on `SELECT ... FROM  WHERE ...`. Four of the eleven fields this
// endpoint offers could not run at all. The keys now speak the tables'
// vocabulary and replaceKind translates the reader's word once; this is what
// stops a third spelling arriving quietly.
func TestEveryReplaceKindIsAKindTheTablesKnow(t *testing.T) {
	if len(replaceFields) == 0 {
		t.Fatal("replaceFields is empty — this test is measuring nothing")
	}
	for kind, fields := range replaceFields {
		spec, ok := quoteBulkKinds[kind]
		if !ok {
			t.Errorf("replaceFields names kind %q, which quoteBulkKinds has never heard of "+
				"(it has %v) — every replace on that kind answers 500", kind, kindNames())
			continue
		}
		if spec.Table == "" {
			t.Errorf("replaceFields[%q] resolves to a spec with no table", kind)
		}
		if len(fields) == 0 {
			t.Errorf("replaceFields[%q] offers no fields", kind)
		}
	}
	// EVERY WIRE WORD THE API DOCUMENTS REACHES A TABLE. The error string is the
	// contract a client reads, so the kinds it names are the kinds that must work
	// — and "quote" is the one that did not.
	for wire := range replaceWireKinds {
		fields, ok := replaceFields[replaceKind(wire)]
		if !ok || len(fields) == 0 {
			t.Errorf("the API says kind may be %q and nothing answers to it", wire)
		}
	}
	// AND NOTHING ELSE DOES. Re-keying replaceFields to the tables' vocabulary
	// would otherwise have made `kind: "utterance"` start working, which is a
	// widened API arriving as a side effect of an internal rename.
	for _, wire := range []string{"utterance", "book", "movie", ""} {
		if replaceKind(wire) != "" {
			t.Errorf("%q is not a documented kind and replace accepts it", wire)
		}
	}
}

// THE PANEL AND THE ENDPOINT MUST OFFER THE SAME SET, and this is the guard that
// says so — because the way they came apart was silent in the direction nothing
// checks. `quoteFieldKinds` above gained language and dlc with 0071, timestamp_end
// and source_author with 0070, and the endpoint accepted all four from the day the
// migration landed. BULK_QUOTE_FIELDS was never touched, so no screen offered any
// of them, and the CHANGELOG went out promising that a Bengali book's forty
// highlights were "one value on forty rows".
//
// A missing field is not an error anywhere: the endpoint answers a request nobody
// makes, and the panel draws a list that is merely shorter than it should be. Only
// walking the two tables against each other finds it. The four fields 0047 added —
// region, recipient, work_title, locator — had been missing the same way for four
// releases, which is what this test's neighbour above means by "cheaper than
// remembering that they must agree".
//
// The JSX is read rather than mirrored, for the reason bulk_handlers' own header
// gives about its two literals: a copy of the list here would be a third table to
// keep in step.
func TestEveryBulkSettableColumnIsOfferedByThePanel(t *testing.T) {
	// The one deliberate absence, and it is documented on both sides. 0053 replaced
	// the free-text `medium` with `kind`; the endpoint still accepts the old column
	// because a pre-0053 backup restores through it, but no form draws a box for it,
	// and a bulk editor is the wrong place to reintroduce one.
	deliberate := map[string]string{
		"medium": "0053 retired it; no form draws it and a bulk editor must not reintroduce one",
	}
	// `season` and `episode` USED TO BE NAMED HERE and no longer need to be. They
	// are staged-only entries in the shared table now, so they never reach
	// `quoteFieldKinds` (which is the live view of it) and this walk never asks
	// about them. The reason they carried was also false — see bulk_fields.go.

	src, err := os.ReadFile(filepath.Join("..", "..", "web", "frontend", "src", "bulkOps.jsx"))
	if err != nil {
		t.Fatal(err)
	}
	block := string(src)
	start := strings.Index(block, "export const BULK_QUOTE_FIELDS = [")
	if start < 0 {
		t.Fatal("BULK_QUOTE_FIELDS not found in bulkOps.jsx — did it move or get renamed?")
	}
	end := strings.Index(block[start:], "\n]")
	if end < 0 {
		t.Fatal("BULK_QUOTE_FIELDS is not terminated by a line starting \"]\"")
	}
	block = block[start : start+end]
	offered := map[string]bool{}
	for _, m := range regexp.MustCompile(`key:\s*'([a-z_]+)'`).FindAllStringSubmatch(block, -1) {
		offered[m[1]] = true
	}
	// A COMPANION COLUMN IS OFFERED TOO, and it has to be, because it is drawn
	// rather than listed. `occasion_circa` is the tick inside the date control —
	// PartialDateField has drawn the two together since the owner ruled that a flag
	// about a field belongs with the field — so the panel has one row and sends two
	// columns. Without this the endpoint's column would read as unoffered and the
	// only ways to green would be a second row nobody can pick usefully, or an
	// entry in `deliberate` claiming an absence that is not one.
	for _, m := range regexp.MustCompile(`circaKey:\s*'([a-z_]+)'`).FindAllStringSubmatch(block, -1) {
		offered[m[1]] = true
	}
	// A walk that finds nothing makes a guard green while it checks nothing.
	if len(offered) < 10 {
		t.Fatalf("only %d keys parsed out of BULK_QUOTE_FIELDS; the extraction is broken", len(offered))
	}
	for field := range quoteFieldKinds {
		if _, ok := deliberate[field]; ok {
			if offered[field] {
				t.Errorf("%q is offered by the panel but this test calls it a deliberate absence (%s)",
					field, deliberate[field])
			}
			continue
		}
		if !offered[field] {
			t.Errorf("the endpoint accepts %q in bulk and no screen offers it — add it to "+
				"BULK_QUOTE_FIELDS, or name it in `deliberate` above with the reason", field)
		}
	}
	for field := range offered {
		if _, ok := quoteFieldKinds[field]; !ok {
			t.Errorf("the panel offers %q and the endpoint refuses it: every press would be a 400", field)
		}
	}
	// AND AN EXEMPTION FOR A FIELD THE ENDPOINT NO LONGER TAKES IS DEAD TEXT. The
	// walk above only consults `deliberate` for fields in `quoteFieldKinds`, so an
	// entry naming anything else is never read and never fails — it just sits
	// there asserting a reason nobody checks. `season` and `episode` sat here that
	// way, with a reason that had stopped being true. The staged-write exemptions
	// next door have carried this check since they were written; this list did not.
	for field, why := range deliberate {
		if _, ok := quoteFieldKinds[field]; !ok {
			t.Errorf("%q is named here as a deliberate absence (%s) and the endpoint does not take "+
				"it at all — remove the entry rather than leaving a reason nothing reads", field, why)
		}
	}
}

// ── the shared table, walked against the schema it claims to describe ────────
//
// `bulk_fields.go` names each bulk-settable field once, with its column on the
// live tables and its column on `staged_quotes`. A table is only worth having if
// something checks it against the database; otherwise it is a third literal to
// fall out of step, which is what this file's header is already about.
//
// THESE WALK THE MIGRATIONS, not a hand-written list of columns. A list would be
// a fourth copy.

// stagedQuoteColumns reads the columns `staged_quotes` actually has, by replaying
// its CREATE TABLE and every ALTER TABLE ... ADD COLUMN across the migrations.
func stagedQuoteColumns(t *testing.T) map[string]bool {
	t.Helper()
	dir := filepath.Join("..", "store", "migrations")
	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatal(err)
	}
	cols := map[string]bool{}
	create := regexp.MustCompile(`(?is)CREATE TABLE\s+(?:IF NOT EXISTS\s+)?staged_quotes\s*\((.*?)\n\);`)
	add := regexp.MustCompile(`(?i)ALTER TABLE\s+staged_quotes\s+ADD COLUMN\s+([a-z_]+)`)
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".sql") {
			continue
		}
		b, err := os.ReadFile(filepath.Join(dir, e.Name()))
		if err != nil {
			t.Fatal(err)
		}
		src := string(b)
		if m := create.FindStringSubmatch(src); m != nil {
			for _, line := range strings.Split(m[1], "\n") {
				line = strings.TrimSpace(line)
				if line == "" || strings.HasPrefix(line, "--") {
					continue
				}
				name := strings.Fields(line)[0]
				// Skip table-level constraints, which start with a keyword rather
				// than a column name.
				switch strings.ToUpper(name) {
				case "PRIMARY", "FOREIGN", "UNIQUE", "CHECK", "CONSTRAINT":
					continue
				}
				cols[strings.Trim(name, ",")] = true
			}
		}
		for _, m := range add.FindAllStringSubmatch(src, -1) {
			cols[m[1]] = true
		}
	}
	// A walk that finds nothing makes every case below green while checking
	// nothing — the failure mode the panel walk above already guards against.
	if len(cols) < 30 {
		t.Fatalf("only %d staged_quotes columns parsed out of the migrations; the extraction is broken", len(cols))
	}
	return cols
}

// EVERY COLUMN THE TABLE NAMES MUST EXIST. A field whose `staged` column is a
// typo is accepted by the endpoint, reported as updated, and lost in the UPDATE
// — the "success that did nothing" this file's header opens on.
func TestEveryBulkFieldColumnExistsOnTheTableItNames(t *testing.T) {
	staged := stagedQuoteColumns(t)
	for name, f := range bulkFields {
		if f.staged != "" && !staged[f.staged] {
			t.Errorf("bulkFields[%q].staged = %q, and staged_quotes has no such column", name, f.staged)
		}
		// The live column is checked by the round-trip cases above, which set and
		// clear each field against a real row; a wrong name fails there with a SQL
		// error rather than silently. Named here so its absence does not read as
		// an omission.
		if f.live == "" && f.staged == "" {
			t.Errorf("bulkFields[%q] names no column on either side — it is settable nowhere", name)
		}
		if len(f.kinds) == 0 {
			t.Errorf("bulkFields[%q] applies to no kind", name)
		}
	}
}

// AND EVERY KIND NAME IS bulkTag's. The same walk TestEveryBulkFieldKindIsAKind-
// BulkTagKnows does for the derived map, done for the table it now derives from —
// because the derivation drops any field with no live column, so a staged-only
// field's kinds would otherwise reach no guard at all.
func TestEveryBulkFieldKindInTheSharedTableIsAKindBulkTagKnows(t *testing.T) {
	for name, f := range bulkFields {
		for _, kind := range f.kinds {
			if _, ok := quoteBulkKinds[kind]; !ok {
				t.Errorf("bulkFields[%q] names kind %q, which bulkTag has never heard of (it knows %v)",
					name, kind, kindNames())
			}
		}
	}
}

// THE GAPS ARE WRITTEN DOWN, SO CLOSING ONE IS A DELIBERATE EDIT. This is the
// plan's whole point stated as a test: the two editors drifted because nothing
// said which fields each lacked. It is a ratchet in one direction — a gap may be
// closed, and a new one may not be opened — and it is exact rather than a count,
// so the failure names the field.
func TestTheGapsBetweenTheTwoEditorsAreTheOnesOnRecord(t *testing.T) {
	// Measured at the commit that introduced the shared table. Each is a field one
	// editor can set and the other cannot, with the reason it is still open.
	//
	// TWO OF THESE HAD THE WRONG REASON, and a wrong reason on a ratchet is worse
	// than none: it tells the next reader the gap is waiting to be closed when the
	// endpoint has already refused to close it. `note` was recorded here as "parity
	// says it should" while import_staged_bulk.go says the opposite in as many
	// words — that it "corrects where a line CAME FROM, never what it SAYS", and
	// names `quote`, `note` and `translation` as the three it will not touch. The
	// reason written beside the code that enforces it is the one that stands.
	liveOnly := map[string]string{
		"note": "the queue does not edit a row's TEXT — import_staged_bulk.go names " +
			"quote, note and translation as the three it will not touch",
		"translation": "the same rule: a staged row records what the file said, and " +
			"wording is fixed after approval on a row that is yours",
		"medium": "0053 retired it — deliberate on both sides",
		"kind":   "not yet wired to the staged endpoint",
	}
	// AND THE OTHER DIRECTION, which this ratchet did not have and the plan named
	// explicitly: "Neither list contains the other, so 'make staging match the live
	// editor' would silently drop season, episode, remove_tags, retarget and
	// formula — which is the same mistake in the other direction." A gap recorded
	// one way round is half a ratchet.
	stagedOnly := map[string]string{
		"season": "the queue bulk-sets it; a Quotes selection can span works and episodes, " +
			"so the same verb there would renumber lines from different episodes alike",
		"episode": "the same argument",
	}
	for name, f := range bulkFields {
		gap := f.live != "" && f.staged == ""
		why, onRecord := liveOnly[name]
		if gap && !onRecord {
			t.Errorf("bulkFields[%q] is live-only and not on the record — either give it a staged "+
				"column or name it here with the reason", name)
		}
		if !gap && onRecord {
			t.Errorf("bulkFields[%q] is named as a live-only gap (%s) but it has a staged column now "+
				"— remove it from the list rather than leaving a stale reason", name, why)
		}

		back := f.staged != "" && f.live == ""
		whyBack, backOnRecord := stagedOnly[name]
		if back && !backOnRecord {
			t.Errorf("bulkFields[%q] is staged-only and not on the record — either give it a live "+
				"column or name it here with the reason", name)
		}
		if !back && backOnRecord {
			t.Errorf("bulkFields[%q] is named as a staged-only gap (%s) but it has a live column now "+
				"— remove it from the list rather than leaving a stale reason", name, whyBack)
		}
	}
}

// ── the staged endpoint, against the table and against itself ───────────────
//
// THE LIVE SIDE'S WORST BUG WAS TWO LISTS. `bulkQuoteFieldPtrs`' header records
// it: the applicability check and the write loop each carried their own literal,
// and "a field present in the first and missing from the second is accepted,
// reported as updated and silently dropped."
//
// THE STAGED SIDE HAS FOUR LISTS. `validate()` checks lengths over one, a second
// covers the numbers, the write path is a hand-written chain of ifs, and a
// table-driven loop follows it. Nothing walks any of them against another, so the
// same defect is available here and would look the same from outside: a 200, a
// count of rows updated, and a field unchanged.
//
// WHAT THIS DOES NOT DO, and the narrowing is deliberate. The plan's step 3 says
// the staged endpoint's "fourteen hand-written pointers become the shared path".
// That count was taken at 619eb05 and the struct now has thirty; more to the
// point, the chain is hand-written for fields that genuinely differ — `location`
// and `timestamp` write an `_orig` snapshot beside themselves, `chapter_no` goes
// through nullableMeasure, `season` and `episode` through nullableCount, and the
// whole block runs before tags, formula and retarget in an order PLAN.md fixes.
// Folding those into a field table means encoding four write strategies and an
// ordering into the registry, which buys less than it risks. The DEFECT is that
// nothing checks the lists against each other; that is what is closed here.

// stagedBulkSource is the endpoint's source, read once.
func stagedBulkSource(t *testing.T) string {
	t.Helper()
	b, err := os.ReadFile(filepath.Join("import_staged_bulk.go"))
	if err != nil {
		t.Fatal(err)
	}
	return string(b)
}

// EVERY FIELD THE ENDPOINT VALIDATES IS A FIELD IT WRITES. The failure this
// catches is the live side's, in the staged side's shape: a length check on a
// column the UPDATE never touches accepts the value, answers 200 and drops it.
func TestEveryValidatedStagedFieldIsAlsoWritten(t *testing.T) {
	src := stagedBulkSource(t)

	// The names `validate()` checks, from its own literal.
	vStart := strings.Index(src, "func (req *stagedBulkReq) validate() string {")
	if vStart < 0 {
		t.Fatal("stagedBulkReq.validate not found — did it move or get renamed?")
	}
	vEnd := strings.Index(src[vStart:], "\n}\n")
	validated := map[string]bool{}
	for _, m := range regexp.MustCompile(`\{&req\.[A-Za-z]+,\s*"([a-z_]+)"\}`).
		FindAllStringSubmatch(src[vStart:vStart+vEnd], -1) {
		validated[m[1]] = true
	}
	if len(validated) < 15 {
		t.Fatalf("only %d validated field names parsed; the extraction is broken", len(validated))
	}

	// The columns the endpoint writes, from both write paths: the hand-written
	// `set("col", …)` chain and the table-driven `{"col", req.Field}` loop.
	written := map[string]bool{}
	for _, m := range regexp.MustCompile(`set\("([a-z_]+)"`).FindAllStringSubmatch(src, -1) {
		written[m[1]] = true
	}
	for _, m := range regexp.MustCompile(`\{"([a-z_]+)",\s*req\.[A-Za-z]+\}`).FindAllStringSubmatch(src, -1) {
		written[m[1]] = true
	}
	if len(written) < 20 {
		t.Fatalf("only %d written columns parsed; the extraction is broken", len(written))
	}

	for name := range validated {
		if !written[name] {
			t.Errorf("the staged endpoint validates %q and never writes it — a value that passes "+
				"the length check, answers 200 and is silently dropped", name)
		}
	}
}

// AND EVERY COLUMN IT WRITES IS IN THE SHARED TABLE, which is what makes that
// table authoritative rather than decorative. A staged field with no entry is a
// field the two editors can drift on again, invisibly, because the ratchet in
// TestTheGapsBetweenTheTwoEditorsAreTheOnesOnRecord only sees what the table
// names.
func TestEveryStagedColumnWrittenIsInTheSharedTable(t *testing.T) {
	src := stagedBulkSource(t)

	// Not field assignments: the tag set operations, the two transforms, and the
	// `_orig` snapshots, which are written BESIDE a field rather than being one.
	// Named with reasons rather than skipped silently.
	notAField := map[string]string{
		"color":          "a chip, not a text field — set by both editors through their own path",
		"favorite":       "a flag, likewise",
		"tags":           "a set operation",
		"location_orig":  "a snapshot written beside `location`, so the formula can re-base from it",
		"timestamp_orig": "a snapshot written beside `timestamp`, likewise",
		"book_id":        "retarget moves a row between works; it is not a field edit",
		"movie_id":       "likewise",
	}

	written := map[string]bool{}
	for _, m := range regexp.MustCompile(`set\("([a-z_]+)"`).FindAllStringSubmatch(src, -1) {
		written[m[1]] = true
	}
	for _, m := range regexp.MustCompile(`\{"([a-z_]+)",\s*req\.[A-Za-z]+\}`).FindAllStringSubmatch(src, -1) {
		written[m[1]] = true
	}

	staged := map[string]bool{}
	for _, f := range bulkFields {
		if f.staged != "" {
			staged[f.staged] = true
		}
	}
	for col := range written {
		if staged[col] {
			continue
		}
		if _, ok := notAField[col]; ok {
			continue
		}
		t.Errorf("the staged endpoint writes %q and the shared table does not name it — either give "+
			"it an entry or say here why it is not a field", col)
	}
	// A reason that stops being true is the failure the gap ratchet exists for, so
	// the exemptions get the same treatment.
	for col, why := range notAField {
		if staged[col] {
			t.Errorf("%q is exempted here (%s) and the shared table names it now — remove the "+
				"exemption rather than leaving a stale reason", col, why)
		}
	}
}

// AND THE STAGED PANEL GETS THE GUARD THE LIVE ONE HAS HAD, which is the last
// piece of this drift with nothing watching it.
//
// TestEveryBulkSettableColumnIsOfferedByThePanel walks the LIVE endpoint against
// `BULK_QUOTE_FIELDS`. Nothing walked the staged endpoint against its own panel:
// `WRITABLE_FIELDS` (StagingPage.jsx) was read by no Go file at all, so a column
// the queue accepts and its bulk panel never offers was invisible in exactly the
// direction the live side's guard exists to cover — the endpoint answers a request
// nobody makes, and the panel draws a list that is merely shorter than it should
// be.
//
// THERE IS ALREADY ONE SUCH COLUMN, which is how this got written. `occasion_date`
// and `occasion_circa` are accepted, validated and written by the staged endpoint,
// and the bulk panel drops them — `FIELDS` there is `WRITABLE_FIELDS` minus
// `when`. That was argued in a comment and checked by nothing.
//
// THE PLAN WANTED ONE PANEL FOR BOTH SCREENS AND THAT IS NOT WHAT SHIPPED. The two
// controls do different jobs: the staged panel sets MANY fields at once over a
// mixed-kind selection, so it is a checkbox grid; the live one sets ONE field
// carefully with the right control for it — a date picker, a language combobox, a
// kind chooser — and an overwrite warning. Merging them loses the multi-field pass
// on one side or the rich controls on the other. The drift the plan was written
// about is closed by the shared table and these two guards instead.
func TestEveryStagedBulkColumnIsOfferedByItsPanel(t *testing.T) {
	// The date pair, and the reason is the panel's CONTROL SHAPE rather than the
	// column: a checkbox beside a free-text box cannot say "about 399 BCE", and a
	// box that took the phrase would store it unparsed. The staged ROW editor does
	// offer it, under the key `when`, converting to the canonical form on the way
	// out — so the capability exists per row and not per selection.
	deliberate := map[string]string{
		"occasion_date":  "a partial date and a circa flag are one control; the bulk panel's row is a checkbox and a text box",
		"occasion_circa": "the other half of that pair",
	}
	// Not field assignments — the same set the sibling guard names, for the same
	// reasons.
	notAField := map[string]bool{
		"color": true, "favorite": true, "tags": true,
		"location_orig": true, "timestamp_orig": true,
		"book_id": true, "movie_id": true,
	}

	written := map[string]bool{}
	src := stagedBulkSource(t)
	for _, m := range regexp.MustCompile(`set\("([a-z_]+)"`).FindAllStringSubmatch(src, -1) {
		written[m[1]] = true
	}
	for _, m := range regexp.MustCompile(`\{"([a-z_]+)",\s*req\.[A-Za-z]+\}`).FindAllStringSubmatch(src, -1) {
		written[m[1]] = true
	}
	if len(written) < 20 {
		t.Fatalf("only %d written columns parsed; the extraction is broken", len(written))
	}

	page, err := os.ReadFile(filepath.Join("..", "..", "web", "frontend", "src", "StagingPage.jsx"))
	if err != nil {
		t.Fatal(err)
	}
	block := string(page)
	start := strings.Index(block, "export const WRITABLE_FIELDS = [")
	if start < 0 {
		t.Fatal("WRITABLE_FIELDS not found in StagingPage.jsx — did it move or get renamed?")
	}
	end := strings.Index(block[start:], "\n]")
	if end < 0 {
		t.Fatal("WRITABLE_FIELDS is not terminated by a line starting \"]\"")
	}
	offered := map[string]bool{}
	for _, m := range regexp.MustCompile(`\['([a-z_]+)'`).
		FindAllStringSubmatch(block[start:start+end], -1) {
		offered[m[1]] = true
	}
	if len(offered) < 15 {
		t.Fatalf("only %d keys parsed out of WRITABLE_FIELDS; the extraction is broken", len(offered))
	}

	// WHAT THE BULK PANEL DROPS, read from the filter rather than assumed — so
	// dropping a SECOND field fails this instead of passing quietly. A filter that
	// stops matching this shape is a failure too, which is the point: the test
	// cannot silently stop knowing what the panel offers.
	drop := regexp.MustCompile(`WRITABLE_FIELDS\.filter\(\(\[key\]\) => key !== '([a-z_]+)'\)`).
		FindStringSubmatch(block)
	if drop == nil {
		t.Fatal("the bulk panel no longer builds its list as WRITABLE_FIELDS minus one key — " +
			"reword this guard deliberately rather than letting it read a list that moved")
	}
	delete(offered, drop[1])

	for col := range written {
		if notAField[col] || offered[col] {
			continue
		}
		if _, ok := deliberate[col]; ok {
			continue
		}
		t.Errorf("the staged endpoint writes %q in bulk and its panel never offers it — add it to "+
			"WRITABLE_FIELDS, or name it in `deliberate` above with the reason", col)
	}
	// A reason that stops being true is the failure this whole file is about.
	for col, why := range deliberate {
		if offered[col] {
			t.Errorf("%q is named here as a deliberate absence (%s) and the panel offers it now — "+
				"remove the entry rather than leaving a stale reason", col, why)
		}
		if !written[col] {
			t.Errorf("%q is named here as a deliberate absence (%s) and the endpoint does not write "+
				"it at all — remove the entry rather than leaving a reason nothing reads", col, why)
		}
	}
}

// THE notNull FLAGS ARE READ OFF THE SCHEMA, NOT TRANSCRIBED FROM IT.
//
// THE BUG THIS EXISTS FOR IS MINE. The shared table was built by extracting the
// old `notNullQuoteCols` literal with a regex wanting one space after the colon.
// Sixteen of its seventeen entries were written that way; the seventeenth was
// aligned — `"kind":   true,` — so it did not match, and `kind` entered the table
// without its flag. Clearing a quote's kind over a selection became a 500,
// NOT NULL constraint failed, raised inside the transaction after the ownership
// check. The exact failure the flag exists to prevent.
//
// AND THE CHECK WRITTEN TO CATCH IT COULDN'T. It compared the derived map against
// a list produced by THE SAME EXTRACTION, so it confirmed the misreading and
// reported sixteen of sixteen. A test whose expected values come from the same
// reading as the code under test proves only that the reading is self-consistent.
//
// SO THIS ONE READS THE MIGRATIONS. `TestQuoteKindInBulk` is what actually found
// the defect — by clearing a kind and expecting a 200 — and behaviour cases like
// it remain the real proof. What this adds is that a field added to the table
// tomorrow cannot get its flag wrong silently: the schema is asked, not a human.
func TestEveryNotNullFlagMatchesTheSchema(t *testing.T) {
	dir := filepath.Join("..", "store", "migrations")
	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatal(err)
	}
	// Column name -> is it NOT NULL, per the last migration that declared it.
	// Both CREATE TABLE bodies and ALTER TABLE ... ADD COLUMN, over the four
	// tables a bulk edit can reach.
	// ONLY TEXT COLUMNS, and the restriction is the flag's own meaning rather than
	// a convenience. `notNull` exists for one trap: nullable("") is nil, so
	// clearing a NOT NULL text column that way is a constraint violation. An
	// INTEGER flag never travels that path — `occasion_circa` and `favorite` are
	// written through boolToInt and cannot be "cleared" at all — so demanding the
	// flag on them would put columns in notNullQuoteCols that the write loop never
	// consults, which is a table saying something untrue about itself.
	notNull := map[string]bool{}
	col := regexp.MustCompile(`(?m)^\s*([a-z_]+)\s+TEXT\b(.*)$`)
	add := regexp.MustCompile(`(?i)ALTER TABLE\s+(?:utterances|annotations|dialogues|staged_quotes)\s+ADD COLUMN\s+([a-z_]+)\s+TEXT\b([^;]*)`)
	tables := regexp.MustCompile(`(?is)CREATE TABLE\s+(?:IF NOT EXISTS\s+)?(?:utterances|annotations|dialogues|staged_quotes)\s*\((.*?)\n\);`)
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".sql") {
			continue
		}
		b, err := os.ReadFile(filepath.Join(dir, e.Name()))
		if err != nil {
			t.Fatal(err)
		}
		src := string(b)
		for _, body := range tables.FindAllStringSubmatch(src, -1) {
			for _, m := range col.FindAllStringSubmatch(body[1], -1) {
				notNull[m[1]] = strings.Contains(strings.ToUpper(m[2]), "NOT NULL")
			}
		}
		for _, m := range add.FindAllStringSubmatch(src, -1) {
			notNull[m[1]] = strings.Contains(strings.ToUpper(m[2]), "NOT NULL")
		}
	}
	if len(notNull) < 40 {
		t.Fatalf("only %d columns parsed out of the migrations; the extraction is broken", len(notNull))
	}
	// The schema has to know about `kind` at all, or this guard would have passed
	// over the very defect it was written for.
	if _, ok := notNull["kind"]; !ok {
		t.Fatal("the walk did not find `kind` — it would not have caught the bug it exists for")
	}

	for name, f := range bulkFields {
		for _, c := range []string{f.live, f.staged} {
			if c == "" {
				continue
			}
			declared, ok := notNull[c]
			if !ok {
				continue // covered by TestEveryBulkFieldColumnExistsOnTheTableItNames
			}
			if declared && !f.notNull {
				t.Errorf("the column %q is NOT NULL in the schema and bulkFields[%q] does not say so — "+
					"clearing it in bulk is a 500 inside the transaction", c, name)
			}
			if !declared && f.notNull {
				t.Errorf("bulkFields[%q] marks %q NOT NULL and the schema does not — a clear that "+
					"should write NULL writes '' instead", name, c)
			}
		}
	}
}

// ── removing a tag over a selection, on both screens ────────────────────────
//
// THE ASYMMETRY docs/plans/bulk-editors-one-field-table.md FOUND: the import
// queue could take a tag off a selection and the Quotes screen could only put one
// on. The same job, one side of approval apart, and the sort of gap that survives
// because each screen is coherent on its own.
// quoteTagsNow re-reads one quote's tags from the account's list — there is no
// GET /quotes/{id}, which is the same reason QuoteModal picks its row out of the
// list (§24: a standalone quote has no parent to fetch it through).
func quoteTagsNow(t *testing.T, c *testClient, id int64) []string {
	t.Helper()
	for _, u := range decode[struct {
		Utterances []utteranceRow `json:"utterances"`
	}](t, c.mustDo("GET", "/quotes", nil, http.StatusOK)).Utterances {
		if u.ID == id {
			return u.Tags
		}
	}
	t.Fatalf("quote %d is not in the list", id)
	return nil
}

func TestBulkRemoveTagsTakesATagOffASelection(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())

	a := newUtterance(t, c, map[string]any{"quote": "the first", "tags": []string{"faith", "funny"}})
	b := newUtterance(t, c, map[string]any{"quote": "the second", "tags": []string{"faith"}})

	c.mustDo("POST", "/quotes/bulk",
		map[string]any{"ids": []int64{a.ID, b.ID}, "remove_tags": []string{"faith"}}, http.StatusOK)

	if got := quoteTagsNow(t, c, a.ID); !slices.Equal(got, []string{"funny"}) {
		t.Errorf("quote a has %v, want just funny — faith should be off and funny untouched", got)
	}
	if got := quoteTagsNow(t, c, b.ID); len(got) != 0 {
		t.Errorf("quote b has %v, want none", got)
	}

	// THE TAG ITSELF SURVIVES. It carries a colour and a style the reader chose,
	// and PLAN.md's taxonomy rule is explicit: "a tag dropping to zero uses is not
	// a reason to throw away that choice."
	var seen bool
	for _, tg := range decode[struct {
		Tags []struct {
			Name string `json:"name"`
		} `json:"tags"`
	}](t, c.mustDo("GET", "/tags", nil, http.StatusOK)).Tags {
		if tg.Name == "faith" {
			seen = true
		}
	}
	if !seen {
		t.Error("removing the last use of `faith` deleted the tag — it keeps its colour and style")
	}
}

// AND IT ANSWERS THE WAY THE STAGED EDITOR DOES, which is the point of the shared
// table and this repo's rule that two things which look alike behave alike. Two
// questions where the sides could silently differ:
//
//   case      staging matches on strings.ToLower, so "Faith" drops "faith"
//   ordering  staging filters the removals out and THEN appends the additions,
//             so a tag in both lists survives
//
// Asserted here rather than left to each side's own tests, because a difference
// between two correct-looking implementations is invisible to either one.
func TestBulkTagRemovalMatchesTheStagedEditorsAnswers(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())

	folded := newUtterance(t, c, map[string]any{"quote": "folded", "tags": []string{"faith"}})
	c.mustDo("POST", "/quotes/bulk",
		map[string]any{"ids": []int64{folded.ID}, "remove_tags": []string{"Faith"}}, http.StatusOK)
	if got := quoteTagsNow(t, c, folded.ID); len(got) != 0 {
		t.Errorf("removing %q left %v — the staged editor folds case and this must too", "Faith", got)
	}

	both := newUtterance(t, c, map[string]any{"quote": "both", "tags": []string{"grief"}})
	c.mustDo("POST", "/quotes/bulk", map[string]any{
		"ids": []int64{both.ID}, "remove_tags": []string{"grief"}, "add_tags": []string{"grief"},
	}, http.StatusOK)
	if got := quoteTagsNow(t, c, both.ID); !slices.Equal(got, []string{"grief"}) {
		t.Errorf("a tag both removed and added left %v, want it present — the staged editor "+
			"drops then appends, so the addition wins, and one request must not mean two things", got)
	}
}

// ── the occasion date over a selection, and the shape it must keep ──────────
//
// A DATE REFUSED ON ONE QUOTE CANNOT BE ACCEPTED ON TWO HUNDRED. The single-row
// path runs `normalizeHistoricalDate` (utterance_handlers.go) and answers 400 to
// anything that is not a year, YYYY-MM or YYYY-MM-DD with an optional leading '-'
// for BCE. Measured before this landed: `POST /quotes` with "sometime in 1952"
// gives a 400.
//
// THE STAGED EDITOR HAD THE SAME HOLE AND IT WAS OLDER. `normalizeHistoricalDate`
// had exactly three callers — the importer and the single-row create/update — and
// the staged bulk endpoint was not one of them. It length-checked the value and
// stored it verbatim, and approval then dropped it: the importer runs the
// validator this endpoint skipped, so the date vanished between the review screen
// and the quote, with only a log line to say so.
// Both bulk paths call it now — this case covers the LIVE one, and the staged one
// has its own below, because a case named for both and exercising one is how a
// half-guarded repair reads as guarded.
func TestBulkOccasionDateKeepsItsShapeOnTheLiveEditor(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())

	a := newUtterance(t, c, map[string]any{"quote": "the speech"})
	b := newUtterance(t, c, map[string]any{"quote": "the letter"})

	// BCE, the form the whole feature exists for: 399 BCE is stored '-0399'.
	c.mustDo("POST", "/quotes/bulk", map[string]any{
		"ids": []int64{a.ID, b.ID}, "occasion_date": "-0399", "occasion_circa": true,
	}, http.StatusOK)
	for _, id := range []int64{a.ID, b.ID} {
		got := quoteNow(t, c, id)
		if got.OccasionDate != "-0399" {
			t.Errorf("quote %d has occasion_date %q, want -0399", id, got.OccasionDate)
		}
		if !got.OccasionCirca {
			t.Errorf("quote %d did not take the circa tick", id)
		}
	}

	// AND THE PAIR MOVES INDEPENDENTLY. The dates can be right while only the
	// certainty is wrong, which is a real thing to want over a selection.
	c.mustDo("POST", "/quotes/bulk",
		map[string]any{"ids": []int64{a.ID}, "occasion_circa": false}, http.StatusOK)
	if got := quoteNow(t, c, a.ID); got.OccasionCirca || got.OccasionDate != "-0399" {
		t.Errorf("clearing the tick alone gave circa=%v date=%q — the date should not move",
			got.OccasionCirca, got.OccasionDate)
	}

	// THE REFUSAL IS THE SAME ONE THE SINGLE-ROW PATH GIVES.
	rec := c.do("POST", "/quotes/bulk",
		map[string]any{"ids": []int64{a.ID}, "occasion_date": "sometime in 1952"})
	if rec.Code != http.StatusBadRequest {
		t.Errorf("a malformed date over a selection: %d %s — the single-row path answers 400",
			rec.Code, rec.Body)
	}
	// And it did not half-apply: a refused request writes nothing.
	if got := quoteNow(t, c, a.ID); got.OccasionDate != "-0399" {
		t.Errorf("the refused date left %q behind", got.OccasionDate)
	}
}

// A TRANSLATION SET IN BULK IS FINDABLE, which is the half a round-trip through
// the row cannot see. `translation` is one of `utterances_fts`'s seven indexed
// columns (0035, widened by 0047), so a write that does not reach the index
// leaves the quote reading correctly on every screen and absent from the one
// place a reader goes looking for it — a failure with no symptom until someone
// searches.
//
// IT PASSES TODAY FOR A REASON WORTH NAMING: the FTS triggers are AFTER UPDATE ON
// utterances, not UPDATE OF <columns>, so any write to the row reindexes it.
// That is a property of the schema rather than of this endpoint, which is exactly
// why it is asserted here — the bulk path never touches the triggers, so nothing
// else in this file would notice if a future migration narrowed them.
func TestABulkTranslationIsFindableAfterwards(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	a := newUtterance(t, c, map[string]any{"quote": "ঘরের খবর"})
	b := newUtterance(t, c, map[string]any{"quote": "পরের খবর"})

	// Not a word in either quote, so a hit can only have come through the index.
	c.mustDo("POST", "/quotes/bulk", map[string]any{
		"ids": []int64{a.ID, b.ID}, "translation": "news of the household",
	}, http.StatusOK)

	found := decode[searchResults](t, c.mustDo("GET", "/search?q=household", nil, http.StatusOK))
	if len(found.Quotes) != 2 {
		t.Fatalf("searching the translation found %d quotes, want 2 — the bulk write "+
			"did not reach utterances_fts", len(found.Quotes))
	}

	// AND A CLEAR UNINDEXES IT. A stale index entry is the worse half: the quote
	// goes on answering a search for words it no longer carries, and nothing on
	// the row says why.
	c.mustDo("POST", "/quotes/bulk",
		map[string]any{"ids": []int64{a.ID}, "translation": ""}, http.StatusOK)
	after := decode[searchResults](t, c.mustDo("GET", "/search?q=household", nil, http.StatusOK))
	if len(after.Quotes) != 1 {
		t.Fatalf("after clearing one translation the search found %d quotes, want 1", len(after.Quotes))
	}
}

// quoteNow re-reads one quote from the account's list — see quoteTagsNow for why
// there is no GET /quotes/{id} to use instead.
func quoteNow(t *testing.T, c *testClient, id int64) utteranceRow {
	t.Helper()
	for _, u := range decode[struct {
		Utterances []utteranceRow `json:"utterances"`
	}](t, c.mustDo("GET", "/quotes", nil, http.StatusOK)).Utterances {
		if u.ID == id {
			return u
		}
	}
	t.Fatalf("quote %d is not in the list", id)
	return utteranceRow{}
}

// AND THE STAGED EDITOR REFUSES IT TOO, which needed saying separately: removing
// the staged half of this fix failed NO test until this case existed. That is the
// shape of defect this whole file is about — a repair with nothing holding it —
// and it is worth the extra setup an import needs.
//
// THE CONSEQUENCE IF IT REGRESSES, measured rather than assumed — an earlier draft
// of this comment claimed approve stores the bad value, and it does not.
// `writeUtterances` (import_quotes.go) runs the same validator at approval and
// DROPS a date it refuses, with an olog warning and nothing in the reply. So the
// value survives in the queue, shows on the review screen, is approved, and the
// date is gone from the quote that lands — no message, no 400, nothing the reader
// sees. One screen refusing with a message while the other accepts and then
// silently discards is worse than either answer given twice.
func TestTheStagedEditorRefusesAMalformedOccasionDate(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	staged := stageQuotesMD(t, c, "quotes.md", "# Quotes\n\n> A line worth keeping.\n> — Someone\n")
	if len(staged.Works) == 0 {
		t.Fatal("the import staged nothing — the setup, not the endpoint, is wrong")
	}
	rows := decode[struct {
		Quotes []struct {
			ID           int64  `json:"id"`
			OccasionDate string `json:"occasion_date"`
		} `json:"quotes"`
	}](t, c.mustDo("GET", "/import/staged", nil, http.StatusOK))
	if len(rows.Quotes) == 0 {
		t.Fatal("no staged quotes came back")
	}
	id := rows.Quotes[0].ID

	// A shape the single-row path refuses, and this one used to store verbatim.
	c.mustDo("POST", "/import/staged/bulk",
		map[string]any{"ids": []int64{id}, "occasion_date": "sometime in 1952"},
		http.StatusBadRequest)

	// The legitimate forms still pass, so the check is a gate and not a wall.
	c.mustDo("POST", "/import/staged/bulk",
		map[string]any{"ids": []int64{id}, "occasion_date": "-0399"}, http.StatusOK)
	after := decode[struct {
		Quotes []struct {
			ID           int64  `json:"id"`
			OccasionDate string `json:"occasion_date"`
		} `json:"quotes"`
	}](t, c.mustDo("GET", "/import/staged", nil, http.StatusOK))
	for _, q := range after.Quotes {
		if q.ID == id && q.OccasionDate != "-0399" {
			t.Errorf("the staged row has occasion_date %q, want -0399", q.OccasionDate)
		}
	}
}
