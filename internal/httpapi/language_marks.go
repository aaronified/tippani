package httpapi

// The mark a language wears.
//
// A standalone quote can be a proverb, and a proverb is the one kind with
// nobody to credit — no speaker, no occasion, no date. Every other quote card
// leads its meta line with a face; a proverb led with nothing. What it does have
// is a language, so the language takes the face's place.
//
// FLAGS ARE OFFERED AND NOT ASSUMED, and that is the whole design. The ask was
// "use flags for languages", and a flag is exactly what many readers will want —
// but a flag is a country and a language is not. Bengali is spoken either side of
// a border, Hindi has no flag of its own, Spanish and Portuguese and Arabic and
// English each have a dozen, and shipping a default here would mean this app
// telling somebody which country owns their mother tongue. So the built-in
// default is a letter from the language's own script, the picker offers flags
// first, and one tap makes it a flag forever. "Let the user change them if
// needed" is not a fallback here; it is the mechanism.
//
// STORED AS A JSON STRING, not a map, and that is not laziness either: prefs is
// a flat comparable struct — ui_test.go compares two of them with `!=` — and a
// map field would not compile there. The same reasoning already keeps
// creditSeparators a token string rather than a set.

import (
	"encoding/json"
	"sort"
	"strings"
	"unicode"
)

const (
	// A mark is a glyph, not a word. Two regional-indicator code points make a
	// flag; a few more allow the subdivision flags (🏴󠁧󠁢󠁳󠁣󠁴󠁿 is seven) and any single
	// letter of any script. Beyond that it stops being a mark and starts being a
	// label, and the card has a label already — the language's name.
	languageMarkMaxRunes = 8
	// The name side. Long enough for the longest language name anybody writes,
	// short enough that the blob cannot become a place to keep notes.
	languageNameMaxRunes = 40
	// How many languages one reader may re-mark. Ten starters plus room for a
	// genuinely multilingual library; a bound exists because this is one column
	// of one row and an unbounded map in it is a storage bug waiting to happen.
	languageMarksMax = 64
)

// normalizeLanguageMarks parses, cleans and re-serialises the stored blob.
//
// Returns ("", true) for anything empty — no marks is the default state and must
// round-trip as the empty string rather than as "{}", so an untouched account
// stores nothing at all. Returns ok=false only for input a client sent and got
// wrong, so a PUT can be refused; a bad value already IN the database is read as
// no marks rather than failing the login.
func normalizeLanguageMarks(raw string) (string, bool) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", true
	}
	var in map[string]string
	if err := json.Unmarshal([]byte(raw), &in); err != nil {
		return "", false
	}
	if len(in) > languageMarksMax {
		return "", false
	}
	out := map[string]string{}
	for name, mark := range in {
		// The KEY IS FOLDED, once, here. "Bengali" and "bengali" are one language
		// — the board form seeds a free-text field, so both spellings arrive — and
		// two entries for one language is a mark that depends on how it was typed.
		key := strings.ToLower(strings.TrimSpace(name))
		mark = strings.TrimSpace(mark)
		if key == "" || len([]rune(key)) > languageNameMaxRunes {
			return "", false
		}
		if len([]rune(mark)) > languageMarkMaxRunes {
			return "", false
		}
		// An empty mark is a real value and means "back to the script letter", so
		// it is dropped rather than stored — the absence IS the default.
		if mark == "" {
			continue
		}
		// No control characters, and nothing that is only whitespace. Both would
		// draw as an empty circle the reader cannot tell from a bug.
		for _, r := range mark {
			if unicode.IsControl(r) {
				return "", false
			}
		}
		out[key] = mark
	}
	if len(out) == 0 {
		return "", true
	}
	// Marshalled from a sorted key list so the stored string is stable: the same
	// set of marks must serialise identically every time, or prefs compare unequal
	// to themselves and every save looks like a change.
	keys := make([]string, 0, len(out))
	for k := range out {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	var b strings.Builder
	b.WriteByte('{')
	for i, k := range keys {
		if i > 0 {
			b.WriteByte(',')
		}
		kj, _ := json.Marshal(k)
		vj, _ := json.Marshal(out[k])
		b.Write(kj)
		b.WriteByte(':')
		b.Write(vj)
	}
	b.WriteByte('}')
	return b.String(), true
}
