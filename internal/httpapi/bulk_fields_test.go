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
			[]string{"note", "chapter", "location", "character"}},
		{"dialogue", "/dialogues/bulk", "dialogues", dlgID,
			[]string{"note", "character", "actor", "timestamp", "act", "quest", "episode_name"}},
		{"utterance", "/quotes/bulk", "utterances", quoteID,
			[]string{"note", "speaker", "occasion", "place", "medium",
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
func TestABulkFieldTheKindHasNoColumnForIsStillRefused(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	book := createBook(t, c, "Moby-Dick")
	annID := idOf(t, c.mustDo("POST", "/annotations",
		map[string]any{"book_id": book, "quote": "a highlight"}, http.StatusCreated).Body.Bytes())
	quoteID := newUtterance(t, c, map[string]any{"quote": "a standalone quote"}).ID

	for _, tc := range []struct {
		path  string
		id    int64
		field string
	}{
		// An annotation has no act, no quest and no actor: a novel has speakers,
		// and nobody plays Ahab.
		{"/annotations/bulk", annID, "act"},
		{"/annotations/bulk", annID, "quest"},
		{"/annotations/bulk", annID, "actor"},
		{"/annotations/bulk", annID, "recipient"},
		// A standalone quote has no chapter and no episode.
		{"/quotes/bulk", quoteID, "chapter"},
		{"/quotes/bulk", quoteID, "episode_name"},
		{"/quotes/bulk", quoteID, "character"},
	} {
		c.mustDo("POST", tc.path,
			map[string]any{"ids": []int64{tc.id}, tc.field: "x"}, http.StatusBadRequest)
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
	// Numbers the queue's own retarget already moves. Setting a season or an episode
	// number across a mixed selection would renumber lines from different episodes
	// alike, which is a data change disguised as a correction.
	deliberate["season"] = "a number retarget owns"
	deliberate["episode"] = "a number retarget owns"

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
	liveOnly := map[string]string{
		"note":   "the staged editor has no note field; parity says it should, and the plan records the doubt",
		"medium": "0053 retired it — deliberate on both sides",
		"kind":   "not yet wired to the staged endpoint",
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
		"season":         "a number retarget owns — see the panel walk above",
		"episode":        "a number retarget owns",
		"occasion_date":  "not yet in the shared table; the live editor cannot set it either",
		"occasion_circa": "likewise — the pair move together",
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
