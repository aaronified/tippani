package httpapi

import (
	"net/http"
	"strings"
	"testing"
)

// Quotes with no book and no film (ROADMAP §24).
//
// The ownership tests are the important half of this file. Annotations and
// dialogues are owned through a parent, so their queries cannot omit the user
// scope — the join that fetches the row IS the check. An utterance has no
// parent, so every query carries its own WHERE user_id and a missing one leaks
// another account's quotes rather than hiding a row. There is a case per
// endpoint, and each asserts 404 rather than 403: 403 confirms the row exists.

type utterancesResp struct {
	Utterances []utteranceRow `json:"utterances"`
}

func newUtterance(t *testing.T, c *testClient, body map[string]any) utteranceRow {
	t.Helper()
	return decode[utteranceRow](t, c.mustDo("POST", "/quotes", body, http.StatusCreated))
}

func bose() map[string]any {
	return map[string]any{
		"quote":         "Give me blood, and I will give you freedom",
		"speaker":       "Subhas Chandra Bose",
		"occasion":      "Burma Radio broadcast",
		"occasion_date": "1944",
		"place":         "Burma",
		"medium":        "radio",
	}
}

func TestUtteranceCRUD(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	u := newUtterance(t, c, bose())
	if u.Quote != "Give me blood, and I will give you freedom" {
		t.Fatalf("quote: %q", u.Quote)
	}
	if u.Speaker != "Subhas Chandra Bose" || u.Occasion != "Burma Radio broadcast" ||
		u.OccasionDate != "1944" || u.Place != "Burma" || u.Medium != "radio" {
		t.Fatalf("occasion round-trip: %+v", u)
	}
	// The shared half behaves like the other two kinds.
	if u.Color != "yellow" {
		t.Fatalf("colour should default to yellow, got %q", u.Color)
	}
	if u.Tags == nil {
		t.Fatal("tags must marshal as [] rather than null")
	}
	if u.NotedAt == "" {
		t.Fatal("noted_at should default to now")
	}

	list := decode[utterancesResp](t, c.mustDo("GET", "/quotes", nil, http.StatusOK))
	if len(list.Utterances) != 1 {
		t.Fatalf("list: %d", len(list.Utterances))
	}

	// PUT is full-state, and editing the words changes what the quote IS, so the
	// dedupe hash has to move with it.
	body := bose()
	body["quote"] = "Give me blood and I will give you freedom!"
	body["tags"] = []string{"freedom", "1944"}
	updated := decode[utteranceRow](t, c.mustDo("PUT", "/quotes/"+itoa(u.ID), body, http.StatusOK))
	if updated.Quote != "Give me blood and I will give you freedom!" {
		t.Fatalf("update did not take: %q", updated.Quote)
	}
	if len(updated.Tags) != 2 {
		t.Fatalf("tags: %v", updated.Tags)
	}

	c.mustDo("DELETE", "/quotes/"+itoa(u.ID), nil, http.StatusOK)
	after := decode[utterancesResp](t, c.mustDo("GET", "/quotes", nil, http.StatusOK))
	if len(after.Utterances) != 0 {
		t.Fatalf("still %d after delete", len(after.Utterances))
	}
}

// One case per endpoint. This is the risk the no-parent model carries.
func TestUtteranceOwnership(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")

	mine := newUtterance(t, alice, bose())

	// Bob cannot see it in a list...
	list := decode[utterancesResp](t, bob.mustDo("GET", "/quotes", nil, http.StatusOK))
	if len(list.Utterances) != 0 {
		t.Fatalf("another account's quotes are visible: %d", len(list.Utterances))
	}
	// ...cannot edit it...
	bob.mustDo("PUT", "/quotes/"+itoa(mine.ID), bose(), http.StatusNotFound)
	// ...and cannot delete it. 404 rather than 403 throughout: 403 would confirm
	// the row exists, which is itself a disclosure.
	bob.mustDo("DELETE", "/quotes/"+itoa(mine.ID), nil, http.StatusNotFound)

	// And it survived all three attempts.
	still := decode[utterancesResp](t, alice.mustDo("GET", "/quotes", nil, http.StatusOK))
	if len(still.Utterances) != 1 {
		t.Fatalf("owner lost their quote: %d", len(still.Utterances))
	}
}

// The dedupe rule inverts for this kind: the occasion discriminates.
func TestUtteranceDedupeByOccasion(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	newUtterance(t, c, bose())

	// The same words on the same occasion is a duplicate, and the 409 carries
	// the row already holding the slot so a retrying offline client can tell its
	// own earlier write from a real clash.
	c.mustDo("POST", "/quotes", bose(), http.StatusConflict)

	// The same words on a DIFFERENT occasion is a different quote.
	other := bose()
	other["occasion_date"] = "1943"
	newUtterance(t, c, other)

	elsewhere := bose()
	elsewhere["occasion"] = "Singapore rally"
	newUtterance(t, c, elsewhere)

	list := decode[utterancesResp](t, c.mustDo("GET", "/quotes", nil, http.StatusOK))
	if len(list.Utterances) != 3 {
		t.Fatalf("expected three quotes, got %d", len(list.Utterances))
	}
}

// Two accounts must each be able to keep the same famous line — which is why
// the UNIQUE is (user_id, dedupe_hash) and not (dedupe_hash).
func TestUtteranceSameLineInTwoAccounts(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")

	newUtterance(t, alice, bose())
	newUtterance(t, bob, bose()) // must not 409 against someone else's row
}

// Deleting a quote takes its schedule row with it. item_reviews is polymorphic
// and cannot hold a foreign key to three parents, so this rides on the 0026
// AFTER DELETE trigger — and without it a reused rowid would hand the next
// quote a stranger's review history.
func TestDeletingAQuoteClearsItsSchedule(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	u := newUtterance(t, c, bose())
	if _, err := srv.Store.DB.Exec(
		`INSERT INTO item_reviews (kind, item_id, stability, review_count, last_touched_at)
		 VALUES ('utterance', ?, 30, 3, datetime('now'))`, u.ID); err != nil {
		t.Fatal(err)
	}
	c.mustDo("DELETE", "/quotes/"+itoa(u.ID), nil, http.StatusOK)

	var n int
	if err := srv.Store.DB.QueryRow(
		`SELECT count(*) FROM item_reviews WHERE kind = 'utterance' AND item_id = ?`, u.ID).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 0 {
		t.Fatal("the schedule row outlived its quote")
	}
}

// Every filter must keep the user scope. A filter that replaced the WHERE
// rather than extending it would be the leak this model risks.
func TestUtteranceFiltersStayScopedToTheOwner(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")

	a := bose()
	a["tags"] = []string{"freedom"}
	a["color"] = "blue"
	a["favorite"] = true
	newUtterance(t, alice, a)

	for _, qs := range []string{"", "?color=blue", "?favorite=1", "?tag=freedom", "?speaker=Subhas+Chandra+Bose"} {
		got := decode[utterancesResp](t, bob.mustDo("GET", "/quotes"+qs, nil, http.StatusOK))
		if len(got.Utterances) != 0 {
			t.Fatalf("GET /quotes%s leaked %d of another account's quotes", qs, len(got.Utterances))
		}
	}
}

// What a proverb, a letter and an essay carry (0047).
//
// Five columns, one request struct, one scan helper — which is why this is the
// cheapest of the three kinds to extend and the easiest to half-extend. The scan
// is shared by the single fetch and the list, so a column added to utteranceCols
// and forgotten in scanUtterance is a scan error that the list handler LOGS AND
// SKIPS: a 200 with a short list, which is the "my quotes vanished" symptom that
// file's own comment is about. Reading the list back is therefore not belt and
// braces, it is the assertion.
//
// THE FIELDS ARE STORED ON EVERY BOARD, whatever its kind. Which of them a form
// offers is the board's kind's business; which of them the table keeps is all of
// them, because the kind lives on the board and a quote dragged from an essay
// board to a plain one must not lose its page number on the way.

func TestEveryStandaloneQuoteFieldMakesTheRoundTrip(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	created := newUtterance(t, c, map[string]any{
		"quote":          "Ami tomake bhalobashi",
		"speaker":        "Rabindranath Tagore",
		"occasion":       "a letter",
		"occasion_date":  "1913",
		"occasion_circa": true,
		"region":         "Sylhet",
		"recipient":      "Jawaharlal Nehru",
		"work_title":     "Letters from Abroad",
		"locator":        "p. 288",
	})
	want := map[string]string{
		"region": "Sylhet", "recipient": "Jawaharlal Nehru",
		"work_title": "Letters from Abroad", "locator": "p. 288",
	}
	check := func(where string, u utteranceRow) {
		got := map[string]string{
			"region": u.Region, "recipient": u.Recipient,
			"work_title": u.WorkTitle, "locator": u.Locator,
		}
		for k, v := range want {
			if got[k] != v {
				t.Errorf("%s: %s = %q, want %q", where, k, got[k], v)
			}
		}
		if !u.OccasionCirca {
			t.Errorf("%s: occasion_circa came back false", where)
		}
	}
	check("create", created)

	// The list, through scanUtterance — see the header for why this is the real
	// assertion and not a repetition of the one above.
	listed := decode[struct {
		Utterances []utteranceRow `json:"utterances"`
	}](t, c.mustDo("GET", "/quotes", nil, http.StatusOK)).Utterances
	if len(listed) != 1 {
		t.Fatalf("the quote did not come back in the list: %+v", listed)
	}
	check("list", listed[0])

	// Full-state PUT, both ways: a body that carries them keeps them, a body that
	// does not clears them. That is this endpoint's stated contract — the same one
	// board_id has, and the trap 0035 and 0036 each caught once.
	updated := decode[utteranceRow](t, c.mustDo("PUT", "/quotes/"+itoa(created.ID), map[string]any{
		"quote": "Ami tomake bhalobashi", "speaker": "Rabindranath Tagore",
		"occasion": "a letter", "occasion_date": "1913",
		"region": "Kolkata", "recipient": "Jawaharlal Nehru",
		"work_title": "Letters from Abroad", "locator": "p. 289",
		"board_id": created.BoardID,
	}, http.StatusOK))
	if updated.Region != "Kolkata" || updated.Locator != "p. 289" {
		t.Errorf("the PUT did not update: region=%q locator=%q", updated.Region, updated.Locator)
	}
	if updated.OccasionCirca {
		t.Error("a full-state PUT that omitted occasion_circa left it set")
	}
}

// Each cap is its own 400, because a message naming the wrong field is a message
// the reader argues with.
func TestAStandaloneQuoteFieldTooLongToStoreIsRefused(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	long := func(n int) string {
		b := make([]byte, n)
		for i := range b {
			b[i] = 'x'
		}
		return string(b)
	}
	for field, n := range map[string]int{
		"region": 101, "recipient": 201, "work_title": 201, "locator": 129,
	} {
		c.mustDo("POST", "/quotes",
			map[string]any{"quote": "a line for " + field, field: long(n)}, http.StatusBadRequest)
	}
	// And the value one under each cap is accepted, so the test is measuring the
	// boundary rather than "any long string fails".
	for field, n := range map[string]int{
		"region": 100, "recipient": 200, "work_title": 200, "locator": 128,
	} {
		c.mustDo("POST", "/quotes",
			map[string]any{"quote": "an accepted line for " + field, field: long(n)}, http.StatusCreated)
	}
}

// Circa is a precision flag and NOT part of what a quote IS, so ticking it must
// not fork a duplicate. occasion_date is in UtteranceDedupeHash and this is
// deliberately not, which is the one part of that decision that looks arguable —
// so it gets the test rather than the comment.
func TestTickingCircaDoesNotForkADuplicate(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	q := newUtterance(t, c, map[string]any{
		"quote": "Give me blood", "speaker": "Bose", "occasion_date": "1944",
	})
	c.mustDo("POST", "/quotes", map[string]any{
		"quote": "Give me blood", "speaker": "Bose", "occasion_date": "1944", "occasion_circa": true,
	}, http.StatusConflict)

	// Setting it on the row that exists is the supported way, and it does not
	// change the hash — so the edit is accepted rather than answering 409 against
	// itself.
	got := decode[utteranceRow](t, c.mustDo("PUT", "/quotes/"+itoa(q.ID), map[string]any{
		"quote": "Give me blood", "speaker": "Bose", "occasion_date": "1944",
		"occasion_circa": true, "board_id": q.BoardID,
	}, http.StatusOK))
	if !got.OccasionCirca {
		t.Fatal("circa did not stick")
	}
}

// THE COLUMN HAS TO LEARN THE WORD, not just the two lists.
//
// The kind vocabulary lives in three places that must agree: QUOTE_KINDS in the
// client, quoteKinds in Go, and a CHECK on utterances.kind. The first two are
// edits; the third is a migration, and 0067 is the one that taught the column
// `poem`. A test over either list would pass with the migration missing and every
// save of a poem failing on a constraint error naming a column.
//
// SO THIS SAVES ONE, which is the only way to ask the CHECK anything.

func TestAPoemCanBeSavedAndAnInventedKindCannot(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	got := newUtterance(t, c, map[string]any{
		"quote":   "Turning and turning in the widening gyre\nThe falcon cannot hear the falconer;",
		"speaker": "W. B. Yeats", "work_title": "The Second Coming", "kind": "poem",
	})
	if got.Kind != "poem" {
		t.Fatalf("saved a poem and it came back as %q", got.Kind)
	}
	// AND THE LINE BREAKS ARE THE TEXT, for a poem more than for anything else in
	// the library. A store that folded whitespace would make every poem prose.
	if want := "gyre\nThe falcon"; !strings.Contains(got.Quote, want) {
		t.Errorf("the stored quote is %q — a poem's line breaks are its text", got.Quote)
	}
	// AND AN UNKNOWN KIND IS STILL REFUSED — BY THE HANDLER, WHICH IS THE ONLY
	// THING THIS LINE CAN SPEAK FOR. It used to say "the vocabulary is still a
	// vocabulary", which read as a claim about the column and is not one: the 400
	// comes from validQuoteKind (utterance_handlers.go), so stripping the CHECK out
	// of the migration entirely leaves this passing. The column's own vocabulary is
	// guarded in the store package, where the schema is — TestQuoteKindColumnRefuses-
	// AnythingElse enumerates all eight values and refuses a ninth, and
	// quote_kind_widening_test.go proves the widening carried the existing values
	// across. Two layers, two tests, and neither one covers for the other.
	c.mustDo("POST", "/quotes", map[string]any{
		"quote": "x", "kind": "haiku"}, http.StatusBadRequest)
}
