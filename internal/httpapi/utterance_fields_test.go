package httpapi

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

import (
	"net/http"
	"testing"
)

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
