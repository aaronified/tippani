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
