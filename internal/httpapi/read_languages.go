package httpapi

// WHICH LANGUAGES THE READER CAN READ, and the one thing it decides.
//
// THE OWNER'S ASK, and the scope is theirs too: "there will be a settings where
// user can declare what languages they can read (only for this feature, as of
// now)." The feature is which text a quote card puts in the big type. A quote in a
// language the reader has not declared leads with its TRANSLATION and prints the
// original underneath — "a poem in a foreign language will need the translation to
// be on top, and the original in the bottom" — and a quote in a language they have
// declared reads the way it was written.
//
// ONLY FOR THIS FEATURE. It is not a locale, not a filter, and not a claim about
// what the app should render in: `Locale` answers that and answers it alone. The
// temptation to make this the general answer to "what can this reader read" is
// what the parenthesis in the request is guarding against, and the field's name is
// the narrow one on purpose.
//
// A LIST AND NOT A MAP, unlike LanguageMarks beside it: there is nothing to say
// about a language here except that it is in the set. Stored as a JSON STRING for
// the reason that field gives — `prefs` is a flat comparable struct that
// `ui_test.go` compares with `!=`, so a slice cannot live in it.
//
// EMPTY MEANS EVERY LANGUAGE READS AS WRITTEN, which is the honest default and the
// one that changes nothing for a reader who never opens the setting: an empty set
// makes `canReadLanguage` true for everything. The alternative — empty meaning "I
// read nothing", so every translated quote leads with its translation — would flip
// every card in the app on an upgrade for a preference nobody had expressed.

import (
	"encoding/json"
	"sort"
	"strings"
)

// readLanguagesMax bounds the blob for the reason languageMarksMax bounds the
// other one: it is a preference, not a corpus.
const readLanguagesMax = 64

// foldLanguageName is the one fold this app applies to a language name, and
// language_marks.go applies it inline to its keys — "Bengali" and "bengali" are
// one language, because the board form seeds a free-text field and both spellings
// arrive.
func foldLanguageName(s string) string {
	return strings.ToLower(strings.TrimSpace(s))
}

// normalizeReadLanguages is the round trip loadPrefs and the PUT handler both use.
// It folds, drops blanks, dedupes and SORTS, so the stored blob is stable: adding
// a language and removing it again produces the same bytes, and a diff of two
// accounts' preferences means something. Same rule cleanDirections follows for the
// question repertoire.
func normalizeReadLanguages(raw string) (string, bool) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", true
	}
	var in []string
	if err := json.Unmarshal([]byte(raw), &in); err != nil {
		return "", false
	}
	if len(in) > readLanguagesMax {
		return "", false
	}
	seen := map[string]bool{}
	out := make([]string, 0, len(in))
	for _, name := range in {
		key := foldLanguageName(name)
		if key == "" || len([]rune(key)) > languageNameMaxRunes {
			return "", false
		}
		if seen[key] {
			continue
		}
		seen[key] = true
		out = append(out, key)
	}
	if len(out) == 0 {
		return "", true
	}
	sort.Strings(out)
	b, err := json.Marshal(out)
	if err != nil {
		return "", false
	}
	return string(b), true
}

// readLanguageSet is the parsed form, for anything server-side that needs to ask.
// Nothing does yet — the card is the client's — and it exists so that the next
// thing to need it does not parse the blob a second way.
func readLanguageSet(blob string) map[string]bool {
	out := map[string]bool{}
	var in []string
	if json.Unmarshal([]byte(blob), &in) != nil {
		return out
	}
	for _, n := range in {
		if k := foldLanguageName(n); k != "" {
			out[k] = true
		}
	}
	return out
}

// canReadLanguage — may this reader read a quote in this language as written?
//
// AN EMPTY SET SAYS YES TO EVERYTHING, and an empty LANGUAGE does too: a quote
// nobody has assigned a language to cannot be one the reader is unable to read,
// and treating it as foreign would put the translation first on every untagged
// row in the library.
func canReadLanguage(set map[string]bool, language string) bool {
	if len(set) == 0 {
		return true
	}
	key := foldLanguageName(language)
	return key == "" || set[key]
}
