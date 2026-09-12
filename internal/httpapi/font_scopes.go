package httpapi

// TYPE PER LANGUAGE — the two scopes the six flat font fields cannot express.
//
// THE OWNER'S SPEC, and it is one sentence with two halves: "any language that
// the user adds in via translation files should have a full ui font picker
// (revamp the font picker in settings for that). And then every language that the
// user adds via adding them in metadata or via adding them in quotes (via the
// language field) should also get a font picker for their quotes. Even when they
// use same script. I may want my german to have serifs, but not english."
//
// THE LAST SENTENCE IS THE WHOLE REASON THESE EXIST. German and English are one
// script, so a per-SCRIPT setting — which is what FontDisplay..FontDevanagari are
// — cannot tell them apart by construction. Neither half of the spec is reachable
// by adding more flat fields either: the set of UI languages is whatever is in
// data/Locales, and the set of quote languages is whatever the reader has typed.
// Both are open, so both are blobs.
//
// A BLOB, FOR THE REASON TextOrder IS ONE: prefs is a flat comparable struct
// (ui_test.go compares two with `!=`), so a map field would not compile. The
// shape is validated here and the bytes are stored as a string.
//
// AND THE SERVER STILL KNOWS THE TOKENS AND NOT THE FONTS, exactly as
// font_prefs.go says: which face `literata` names is the browser's question. What
// is checked here is the SHAPE — that a key is a locale code or a language name,
// that a value is a face token or a style list, and that neither collection can
// grow into storage.

import (
	"encoding/json"
	"sort"
	"strings"

	"tippani/internal/i18n"
)

const (
	// A preference is not a corpus — readLanguagesMax's rule, applied to both
	// tables. The locale bound is smaller because a UI language is a FILE an
	// operator put on disk, and i18n already reads at most 64 of those.
	fontsByLanguageMax = 64
	fontsByLocaleMax   = 32
	// Six roles, each with a face and a style list. Anything longer is not a
	// picker's output.
	fontsPerLocaleMax = 12
)

// fontRoleKeys mirrors FONT_ROLES in fonts.js. It is the key half of the
// per-locale overlay: `display` carries a face token and `displayStyle` a
// modifier list, which is the same pair of names the flat fields use so the
// client's overlay is a partial of the preference shape it already sends.
var fontRoleKeys = map[string]bool{
	"display": true, "ui": true, "mono": true,
	"hand": true, "bengali": true, "devanagari": true,
}

// normalizeFontsByLanguage round-trips the QUOTE table: folded language name ->
// face token.
//
// ONE FACE PER LANGUAGE AND NO MODIFIERS, which is narrower than the per-locale
// table below and deliberately so. This setting answers "what is my German set
// in"; bolding or small-capping every German quote is a decision about the CARD,
// which the role's own modifiers already make for all of them. Two ways to bold
// one line is the "one fact signalled twice" the repo forbids.
//
// AN EMPTY VALUE IS DROPPED, NOT STORED. "" means this language follows the card,
// which is the absence of a setting — storing it would make "has this reader
// chosen anything" unanswerable, and the row would survive a clear.
//
// AN UNPARSEABLE TOKEN IS REFUSED rather than dropped, the rule normalizeTextOrder
// follows: a value this server cannot spell is a client sending something it
// invented, and storing it would leave a face nobody can see or clear.
func normalizeFontsByLanguage(raw string) (string, bool) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", true
	}
	var in map[string]string
	if err := json.Unmarshal([]byte(raw), &in); err != nil {
		return "", false
	}
	if len(in) > fontsByLanguageMax {
		return "", false
	}
	out := map[string]string{}
	for _, name := range sortedKeys(in) {
		key := foldLanguageName(name)
		if key == "" || len([]rune(key)) > languageNameMaxRunes {
			return "", false
		}
		tok, ok := normalizeFontToken(in[name])
		if !ok {
			return "", false
		}
		if tok == "" {
			continue
		}
		out[key] = tok
	}
	return marshalOrEmpty(out)
}

// normalizeFontsByLocale round-trips the INTERFACE table: locale code -> the
// roles that locale answers differently.
//
// A PARTIAL, NEVER A FULL SET. A locale stores only what it says differently from
// the flat fields, so the six rows a reader never touched under `bn` keep
// following their English answers — and an upgrade that changes a built-in face
// still reaches every locale that had no opinion about it. The client composes
// `{...flat, ...byLocale[code]}` and nothing here has to know that it does.
//
// THE CODE IS SHAPE-CHECKED AND NOT LOOKED UP, which is design §4 and the same
// rule the Locale field itself follows: a language is a file, so the set of valid
// codes is whatever is on disk when somebody asks, and this server may be older
// than the file. i18n.NormalizeCode is the whole of the check.
func normalizeFontsByLocale(raw string) (string, bool) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", true
	}
	var in map[string]map[string]string
	if err := json.Unmarshal([]byte(raw), &in); err != nil {
		return "", false
	}
	if len(in) > fontsByLocaleMax {
		return "", false
	}
	out := map[string]map[string]string{}
	for _, code := range sortedKeys(in) {
		key := i18n.NormalizeCode(code)
		if key == "" {
			return "", false
		}
		roles := in[code]
		if len(roles) > fontsPerLocaleMax {
			return "", false
		}
		kept := map[string]string{}
		for _, field := range sortedKeys(roles) {
			v, ok := normalizeFontField(field, roles[field])
			if !ok {
				return "", false
			}
			if v == "" {
				continue
			}
			kept[field] = v
		}
		if len(kept) == 0 {
			continue
		}
		out[key] = kept
	}
	return marshalOrEmpty(out)
}

// normalizeFontField cleans one entry of a locale's overlay — a face under a role
// name, a modifier list under that name plus "Style" — and refuses any other key.
//
// REFUSED RATHER THAN IGNORED, because an unknown role is the one mistake a
// client can make here that a reader would never see: the picker would look
// saved, the interface would not change, and nothing anywhere would say why.
func normalizeFontField(field, value string) (string, bool) {
	if role, ok := strings.CutSuffix(field, "Style"); ok {
		if !fontRoleKeys[role] {
			return "", false
		}
		return normalizeFontStyles(value)
	}
	if !fontRoleKeys[field] {
		return "", false
	}
	return normalizeFontToken(value)
}

// sortedKeys is why both tables serialise to stable bytes: setting a language and
// clearing it again produces the blob it started with, so a diff of two accounts
// means something. Go's map iteration is deliberately unordered and
// encoding/json sorts string keys on the way out — this makes the VALIDATION walk
// deterministic too, so a blob with two bad entries always reports the same one.
func sortedKeys[V any](m map[string]V) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}

// marshalOrEmpty writes the cleaned table, or "" when nothing survived — the
// difference between "this reader set nothing" and "{}", which would read as a
// preference forever.
func marshalOrEmpty[V any](m map[string]V) (string, bool) {
	if len(m) == 0 {
		return "", true
	}
	b, err := json.Marshal(m)
	if err != nil {
		return "", false
	}
	return string(b), true
}
