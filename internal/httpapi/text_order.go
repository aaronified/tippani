package httpapi

import (
	"encoding/json"
	"sort"
	"strings"
)

// HOW MUCH OF THE ORIGINAL A CARD SHOWS, stored.
//
// THE OWNER'S FOUR STATES: "1) translations above quotations, 2) quotations above
// translation, 3) no translation, 4) no quotations" — set per language here, and
// per work or per board on the row itself, where the work's answer wins.
//
// IT REPLACES `readLanguages`, on the owner's ruling. That preference held a list
// of languages the reader can read and inferred the rest: declared meant "as
// written", undeclared meant "translation first". Four states say both of those
// and two more the list could not spell at all, so the list is absorbed rather
// than kept beside them. It is still READ, once, to migrate an account that has
// one — the client does that, because the client is what knows whether this
// account has ever opened the new table.
//
// THE ORDER OF THE FOUR IS ONE AXIS and matches web/frontend/src/textOrder.js
// exactly: each shows strictly more of the original than the last. That is what
// makes the reader's control a slider rather than four buttons, and a server that
// disagreed about the order would still validate every value while the client drew
// them in a different sequence.
var textOrders = []string{"trans-only", "trans-first", "quote-first", "quote-only"}

// textOrderDefault is what the app did before any of this: every quote reads as
// written, with its translation underneath. Stored blobs omit it rather than spell
// it, so a reader who has changed nothing has no row and no master.
const textOrderDefault = "quote-first"

// textOrderMax bounds the per-language map, for the reason readLanguagesMax bounds
// its list: a preference is not a corpus.
const textOrderMax = 64

func validTextOrder(s string) bool {
	for _, o := range textOrders {
		if o == s {
			return true
		}
	}
	return false
}

// textOrderPrefs is the shape the blob holds. `Master` is the slider above the
// column; `ByLanguage` is the rows under it, keyed by folded language name.
type textOrderPrefs struct {
	Master     string            `json:"master,omitempty"`
	ByLanguage map[string]string `json:"byLanguage,omitempty"`
}

// normalizeTextOrder is the round trip loadPrefs and the PUT handler both use.
//
// IT DROPS WHAT MEANS NOTHING RATHER THAN REFUSING THE BLOB, with one exception:
// a value that is not one of the four is a client sending a state this server has
// never heard of, and accepting it would store something no reader can see or
// clear. So an unknown STATE is a 400, while a master equal to the default and a
// row equal to the master are simply dropped — they are true without being stored,
// and keeping them would make "has this reader changed anything" unanswerable.
//
// AND THE KEYS ARE SORTED, so the bytes are stable: setting a language and unsetting
// it again produces the blob it started with, and a diff of two accounts means
// something. Same rule normalizeReadLanguages and cleanDirections follow.
func normalizeTextOrder(raw string) (string, bool) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", true
	}
	var in textOrderPrefs
	if err := json.Unmarshal([]byte(raw), &in); err != nil {
		return "", false
	}
	if len(in.ByLanguage) > textOrderMax {
		return "", false
	}
	out := textOrderPrefs{ByLanguage: map[string]string{}}
	master := textOrderDefault
	if in.Master != "" {
		if !validTextOrder(in.Master) {
			return "", false
		}
		master = in.Master
		if master != textOrderDefault {
			out.Master = master
		}
	}
	keys := make([]string, 0, len(in.ByLanguage))
	for name := range in.ByLanguage {
		keys = append(keys, name)
	}
	sort.Strings(keys)
	for _, name := range keys {
		key := foldLanguageName(name)
		if key == "" || len([]rune(key)) > languageNameMaxRunes {
			return "", false
		}
		state := in.ByLanguage[name]
		if !validTextOrder(state) {
			return "", false
		}
		// A ROW THAT AGREES WITH THE MASTER IS NOT A SETTING. The reader's slider
		// above the column pushes every row to itself, which would otherwise store
		// one row per language saying what the master already says — and then the
		// master could never be moved again without moving all of them back.
		if state == master {
			continue
		}
		out.ByLanguage[key] = state
	}
	if len(out.ByLanguage) == 0 {
		out.ByLanguage = nil
	}
	if out.Master == "" && out.ByLanguage == nil {
		return "", true
	}
	b, err := json.Marshal(out)
	if err != nil {
		return "", false
	}
	return string(b), true
}

// ---- the scope rung: a work's or a board's own opinion (0073) ---------------

// normalizeTextOrderScope is the whole of what a book, a film, a show, a game or
// a board may store in its `text_order` column — ONE function for all five,
// because "similar things act similarly" and five copies of a four-value
// whitelist is four chances for one of them to drift.
//
// IT IS NOT normalizeTextOrder ABOVE, and the difference is the shape rather than
// the vocabulary. That one round-trips the READER's blob — a master plus a table
// keyed by language, with rows that agree with the master dropped. This one holds
// a single state, because a work has one answer and not a table: a book is not
// bilingual by container the way a reader is by habit.
//
// ” IS INHERIT AND IS ALWAYS ACCEPTED. A work with no opinion stores nothing and
// the ladder falls through to the language and then to the master, which is what
// clearing the control has to mean. Whitespace is trimmed into that same answer,
// so a client sending " " is clearing it rather than storing a state no reader can
// see or remove.
//
// AN UNKNOWN STATE IS REFUSED rather than dropped, which is the rule the blob
// above already follows for the same reason: a value this server has never heard
// of is a client sending something it invented, and storing it would put a card
// into a state the reader cannot reach the control for.
func normalizeTextOrderScope(raw string) (string, bool) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", true
	}
	if !validTextOrder(raw) {
		return "", false
	}
	return raw, true
}

// textOrderList is the error message's half of the same table, so a 400 names the
// four states rather than saying a value was wrong without saying what is right.
func textOrderList() string {
	return strings.Join(textOrders, " / ")
}
