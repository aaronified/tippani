package httpapi

// The mark a language wears.
//
// A standalone quote can be a proverb, and a proverb is the one kind with
// nobody to credit — no speaker, no occasion, no date. Every other quote card
// leads its meta line with a face; a proverb led with nothing. What it does have
// is a language, so the language takes the face's place.
//
// NO FLAGS ARE OFFERED ANY MORE (1.16.0). The original ask was "use flags for
// languages" and the answer was to offer two dozen without ever mapping one to a
// language, because a flag is a country and a language is not. The reasoning
// held; the screen still did the thing it was defending against, since a grid of
// flags at the top of a language's tray is a recommendation whoever wrote it. A
// language offers four letters of its OWN SCRIPT now, and a flag is reachable by
// typing one — which is the difference between a tool and a suggestion. Nothing
// in this file ever knew which flag went with which language and nothing here
// changes: it validates marks, it does not choose them.
//
// STORED AS A JSON STRING, not a map, and that is not laziness either: prefs is
// a flat comparable struct — ui_test.go compares two of them with `!=` — and a
// map field would not compile there. The same reasoning already keeps
// creditSeparators a token string rather than a set.
//
// THE VALUE HAS TWO SHAPES AND BOTH ARE READ. Until 1.16.0 an entry was a bare
// string, `{"bengali":"অ"}`. It is an object now — `{"bengali":{"m":"অ",
// "c":["✦"],"n":"বাংলা"}}` — carrying the chosen mark, up to four of the
// reader's own marks for that language, and the name they call it by. The old
// shape is accepted forever and normalised into the new one on the way through.
// There is no migration step for a per-user preference string and there is not
// going to be one: an account that had set a mark would otherwise open Settings
// to find it gone, with nothing on the screen to say why.

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
	// short enough that the blob cannot become a place to keep notes. It bounds
	// both the KEY (the canonical language) and the reader's own display name.
	languageNameMaxRunes = 40
	// How many languages one reader may re-mark. Ten starters plus room for a
	// genuinely multilingual library; a bound exists because this is one column
	// of one row and an unbounded map in it is a storage bug waiting to happen.
	languageMarksMax = 64
	// How many of their own marks one language may keep. Mirrors MAX_CUSTOM_MARKS
	// in languages.jsx, and is the reason the whole blob stays small: 64 languages
	// × 4 marks × 8 runes is a bounded worst case somebody can reason about.
	languageCustomMax = 4
)

// langEntry is the stored shape of one language. Short field names because this
// is one column of one row and the long ones would be most of it.
type langEntry struct {
	Mark    string   `json:"m,omitempty"`
	Customs []string `json:"c,omitempty"`
	Name    string   `json:"n,omitempty"`
}

// okMark returns the trimmed mark and whether it is storable at all. A mark that
// is only whitespace or carries a control character draws as an empty circle the
// reader cannot tell from a bug, so it is refused rather than stored.
func okMark(s string) (string, bool) {
	s = strings.TrimSpace(s)
	if len([]rune(s)) > languageMarkMaxRunes {
		return "", false
	}
	for _, r := range s {
		if unicode.IsControl(r) {
			return "", false
		}
	}
	return s, true
}

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
	// json.RawMessage rather than a concrete type, because the two shapes have to
	// be told apart per entry: a reader mid-migration has old string entries and
	// new object ones in the same blob, written by two versions of the app across
	// a browser refresh.
	var in map[string]json.RawMessage
	if err := json.Unmarshal([]byte(raw), &in); err != nil {
		return "", false
	}
	if len(in) > languageMarksMax {
		return "", false
	}
	out := map[string]langEntry{}
	for name, rawVal := range in {
		// The KEY IS FOLDED, once, here. "Bengali" and "bengali" are one language
		// — the board form seeds a free-text field, so both spellings arrive — and
		// two entries for one language is a mark that depends on how it was typed.
		key := strings.ToLower(strings.TrimSpace(name))
		if key == "" || len([]rune(key)) > languageNameMaxRunes {
			return "", false
		}

		var e langEntry
		// The 1.15.x shape: the whole value is the mark.
		var asString string
		if err := json.Unmarshal(rawVal, &asString); err == nil {
			e.Mark = asString
		} else if err := json.Unmarshal(rawVal, &e); err != nil {
			return "", false
		}

		mark, ok := okMark(e.Mark)
		if !ok {
			return "", false
		}
		display, ok := okMark(e.Name)
		if !ok || len([]rune(display)) > languageNameMaxRunes {
			return "", false
		}
		// WHETHER A DISPLAY NAME IS REDUNDANT IS NOT THIS LAYER'S CALL, and an
		// earlier draft of this function made it: it dropped any name that folded
		// to its key, on the reasoning that renaming Bengali to "Bengali" says
		// nothing. True for a starter language, and wrong for one the reader
		// added — there the key is the folded name ("yoruba") and the display
		// name is the only record of what they actually typed ("Yoruba"). Since
		// an entry with nothing left in it is dropped whole, that rule deleted
		// the language on the next save.
		//
		// The starter list is a client concept and belongs there; teaching it to
		// the server would be a second copy of a table to keep in step. So this
		// validates the name and stores what it is given.
		if len(e.Customs) > languageCustomMax {
			return "", false
		}
		customs := make([]string, 0, len(e.Customs))
		for _, c := range e.Customs {
			g, ok := okMark(c)
			if !ok {
				return "", false
			}
			if g == "" {
				continue
			}
			// Deduped: two identical customs are one swatch drawn twice and a
			// remove button that appears to do nothing.
			if !contains(customs, g) {
				customs = append(customs, g)
			}
		}
		// An entry with nothing in it is dropped, not stored — the absence IS the
		// default, and an empty object would be a row the client re-renders
		// forever for a language nobody has touched.
		if mark == "" && display == "" && len(customs) == 0 {
			continue
		}
		out[key] = langEntry{Mark: mark, Customs: customs, Name: display}
	}
	if len(out) == 0 {
		return "", true
	}
	// Marshalled from a sorted key list so the stored string is stable: the same
	// set of marks must serialise identically every time, or prefs compare unequal
	// to themselves and every save looks like a change. The ENTRY is marshalled by
	// encoding/json from a struct with fixed field order, so its own key order is
	// stable for the same reason without a second sort.
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
		vj, err := json.Marshal(out[k])
		if err != nil {
			return "", false
		}
		b.Write(kj)
		b.WriteByte(':')
		b.Write(vj)
	}
	b.WriteByte('}')
	return b.String(), true
}

func contains(list []string, s string) bool {
	for _, v := range list {
		if v == s {
			return true
		}
	}
	return false
}
