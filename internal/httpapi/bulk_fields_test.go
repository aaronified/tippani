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
	"slices"
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
