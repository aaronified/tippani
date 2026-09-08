package httpapi

import (
	"encoding/json"
	"strings"
	"testing"
)

// THE STORED FORM OF THE OWNER'S FOUR STATES.
//
// WHAT IS WORTH TESTING HERE IS NOT THAT A VALID BLOB SURVIVES — it is what gets
// DROPPED. This normaliser exists to make "has this reader changed anything"
// answerable, and it does that by refusing to store facts that are true without
// being stored: a master equal to the default, a row equal to the master. Get that
// wrong and the master can never be moved again, because every language would
// carry an explicit row saying what the master used to say.

func TestTextOrderKeepsWhatTheReaderActuallyChose(t *testing.T) {
	got, ok := normalizeTextOrder(`{"master":"trans-first","byLanguage":{"German":"quote-only"}}`)
	if !ok {
		t.Fatal("a valid blob was refused")
	}
	var out textOrderPrefs
	if err := json.Unmarshal([]byte(got), &out); err != nil {
		t.Fatalf("the stored blob does not parse: %v", err)
	}
	if out.Master != "trans-first" {
		t.Errorf("master = %q, want trans-first", out.Master)
	}
	// FOLDED, because the language box is free text and "German" on a quote has to
	// meet "german" in the table.
	if out.ByLanguage["german"] != "quote-only" {
		t.Errorf("byLanguage = %v, want german -> quote-only", out.ByLanguage)
	}
}

func TestTextOrderDropsAMasterThatIsTheDefault(t *testing.T) {
	// The slider sitting where it started is not a setting. Storing it would make
	// every account that opened the table once indistinguishable from one that
	// chose the default deliberately.
	got, ok := normalizeTextOrder(`{"master":"` + textOrderDefault + `"}`)
	if !ok {
		t.Fatal("refused")
	}
	if got != "" {
		t.Errorf("stored %q for a master at the default; want nothing stored", got)
	}
}

func TestTextOrderDropsARowThatAgreesWithTheMaster(t *testing.T) {
	// THE CASE THAT MATTERS. The owner's master slider "will push all knobs to
	// align with it" — so every move of it offers a row per language repeating what
	// it says. Kept, those rows would then out-rank the master forever: moving it
	// again would change nothing, and the custom indicator would be lit with
	// nothing custom in it.
	got, ok := normalizeTextOrder(
		`{"master":"trans-only","byLanguage":{"german":"trans-only","bengali":"quote-first"}}`)
	if !ok {
		t.Fatal("refused")
	}
	var out textOrderPrefs
	_ = json.Unmarshal([]byte(got), &out)
	if _, has := out.ByLanguage["german"]; has {
		t.Errorf("kept a row that says what the master says: %v", out.ByLanguage)
	}
	if out.ByLanguage["bengali"] != "quote-first" {
		t.Errorf("dropped a row that genuinely differs: %v", out.ByLanguage)
	}
}

func TestTextOrderRefusesAStateThisServerDoesNotKnow(t *testing.T) {
	// Unlike the two drops above, this is a 400 rather than a tidy-up: a value the
	// server has never heard of is a client storing something no reader can see or
	// clear, and silently dropping it would leave that client believing it saved.
	for _, bad := range []string{
		`{"master":"sideways"}`,
		`{"byLanguage":{"german":"upside-down"}}`,
		`{"byLanguage":{"german":""}}`,
	} {
		if _, ok := normalizeTextOrder(bad); ok {
			t.Errorf("accepted %s", bad)
		}
	}
}

func TestTextOrderRefusesABlobThatIsNotOne(t *testing.T) {
	for _, bad := range []string{`[]`, `"quote-first"`, `{`, `{"byLanguage":[]}`} {
		if _, ok := normalizeTextOrder(bad); ok {
			t.Errorf("accepted %s", bad)
		}
	}
}

func TestTextOrderAcceptsNothingAsNoSettings(t *testing.T) {
	// An empty string is an account that has never opened the table; an empty
	// object is one that put everything back. Both mean the same stored value, and
	// both are requests rather than mistakes.
	for _, blank := range []string{"", "   ", "{}", `{"byLanguage":{}}`} {
		got, ok := normalizeTextOrder(blank)
		if !ok || got != "" {
			t.Errorf("normalizeTextOrder(%q) = %q, %v; want \"\", true", blank, got, ok)
		}
	}
}

func TestTextOrderRefusesMoreLanguagesThanAPreferenceShouldHold(t *testing.T) {
	var sb strings.Builder
	sb.WriteString(`{"master":"quote-first","byLanguage":{`)
	for i := 0; i <= textOrderMax; i++ {
		if i > 0 {
			sb.WriteString(",")
		}
		sb.WriteString(`"lang`)
		sb.WriteString(strings.Repeat("x", 1))
		sb.WriteString(string(rune('a' + i%26)))
		sb.WriteString(string(rune('a' + i/26)))
		sb.WriteString(`":"trans-only"`)
	}
	sb.WriteString(`}}`)
	if _, ok := normalizeTextOrder(sb.String()); ok {
		t.Error("accepted a per-language map larger than the cap")
	}
}

// AND THE ORDER OF THE FOUR IS AN AXIS, in the same sequence the client draws
// them. The reader's control is a slider, so a server that agreed about the four
// values and disagreed about their ORDER would validate everything while the
// stops meant different things at each end.
func TestTheFourStatesAreOneAxisInTheClientsOrder(t *testing.T) {
	want := []string{"trans-only", "trans-first", "quote-first", "quote-only"}
	if len(textOrders) != len(want) {
		t.Fatalf("textOrders = %v, want %v", textOrders, want)
	}
	for i := range want {
		if textOrders[i] != want[i] {
			t.Errorf("textOrders[%d] = %q, want %q — web/frontend/src/textOrder.js has the same list and the slider reads it positionally",
				i, textOrders[i], want[i])
		}
	}
	if textOrderDefault != "quote-first" {
		t.Errorf("textOrderDefault = %q; anything else reorders every card in every library on upgrade", textOrderDefault)
	}
}
