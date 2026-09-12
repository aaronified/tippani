// THE LANGUAGES THIS APP KNOWS BY NAME — ISO 639-1 codes, their English names,
// their autonyms, and the script each is written in.
//
// WHY A LIST AT ALL, when every language column in this app is free text and stays
// that way. A quote's language has always been whatever the reader typed, and that
// is right: a library holds Sylheti and Tulu and the Kentish of a 1580 pamphlet, and
// a closed list would refuse all three. So this is an OFFER and never a constraint —
// what the combobox suggests, what a stored value is recognised AS when it happens
// to match, and nothing that can reject anything.
//
// THAT IS WHY THE LIST IS CURATED AND NOT THE WHOLE REGISTRY. ISO 639-1 has 184
// codes and most of them will never appear in anybody's quote library; what they
// would appear as here is a hundred autonyms transcribed from memory, and an autonym
// with the wrong diacritic is worse than an absent one — it is a language's own name
// for itself, spelled wrong, offered by the app as though it knew. Every row below
// carries an autonym its author is sure of. The rest are not omitted because they do
// not matter; they are omitted because the honest form of a row nobody verified is
// no row.
//
// ADDING ONE IS FOUR FIELDS AND NO CEREMONY. That is the design: `languageFor`
// matches a stored value against a code, an English name or an autonym, so a reader
// who typed "Sylheti" for two years goes on seeing "Sylheti" whether or not it is
// ever added, and the day it is added their quotes join the offered set without a
// migration.
//
// THE SCRIPT NAMES ARE fonts.js's, NOT ISO 15924's, and that is deliberate. This app
// already has a script vocabulary — FONT_ROLES keys `bengali` and `devanagari`, the
// two scripts with a face of their own — and a second spelling of the same idea is
// how one of them silently stops matching. So a script here NAMES a font role where
// the app has one and simply matches none where it does not, which is the correct
// behaviour for a script with no dedicated stack: it falls back to the text face, as
// it does today.
//
// It is a leaf: no imports at all, and ONE importer — `languages.jsx`, which reads
// it for a language's mark and its glyph tray. Everything else reaches it through
// there (a proverb board's cover letter is `glyphFor`, which boards.jsx re-exports),
// so there is one place that decides what a stored value resolves to. `fonts.js` is
// downstream of neither. The combobox on the capture and work fields is the next
// caller and is not written yet — this file does not claim it until it is.

// One row per language: the ISO 639-1 code, the English name, the language's own
// name for itself, and the script it is written in.
//
// ORDERED BY SCRIPT AND THEN ROUGHLY BY USE, not alphabetically, because the only
// reader of this file as a FILE is somebody adding to it — and the question they
// have is "is my language here", which is answered faster by a block of Indic than
// by a run from Afrikaans to Zulu. The combobox sorts its own offer.
export const LANGUAGES = [
  // Latin
  { code: 'en', name: 'English', autonym: 'English', script: 'latin' },
  { code: 'es', name: 'Spanish', autonym: 'español', script: 'latin' },
  { code: 'fr', name: 'French', autonym: 'français', script: 'latin' },
  { code: 'pt', name: 'Portuguese', autonym: 'português', script: 'latin' },
  { code: 'it', name: 'Italian', autonym: 'italiano', script: 'latin' },
  { code: 'de', name: 'German', autonym: 'Deutsch', script: 'latin' },
  { code: 'nl', name: 'Dutch', autonym: 'Nederlands', script: 'latin' },
  { code: 'sv', name: 'Swedish', autonym: 'svenska', script: 'latin' },
  { code: 'no', name: 'Norwegian', autonym: 'norsk', script: 'latin' },
  { code: 'da', name: 'Danish', autonym: 'dansk', script: 'latin' },
  { code: 'fi', name: 'Finnish', autonym: 'suomi', script: 'latin' },
  { code: 'is', name: 'Icelandic', autonym: 'íslenska', script: 'latin' },
  { code: 'pl', name: 'Polish', autonym: 'polski', script: 'latin' },
  { code: 'cs', name: 'Czech', autonym: 'čeština', script: 'latin' },
  { code: 'sk', name: 'Slovak', autonym: 'slovenčina', script: 'latin' },
  { code: 'hu', name: 'Hungarian', autonym: 'magyar', script: 'latin' },
  { code: 'ro', name: 'Romanian', autonym: 'română', script: 'latin' },
  { code: 'hr', name: 'Croatian', autonym: 'hrvatski', script: 'latin' },
  { code: 'sl', name: 'Slovenian', autonym: 'slovenščina', script: 'latin' },
  { code: 'sq', name: 'Albanian', autonym: 'shqip', script: 'latin' },
  { code: 'lt', name: 'Lithuanian', autonym: 'lietuvių', script: 'latin' },
  { code: 'lv', name: 'Latvian', autonym: 'latviešu', script: 'latin' },
  { code: 'et', name: 'Estonian', autonym: 'eesti', script: 'latin' },
  { code: 'tr', name: 'Turkish', autonym: 'Türkçe', script: 'latin' },
  { code: 'az', name: 'Azerbaijani', autonym: 'azərbaycan', script: 'latin' },
  { code: 'uz', name: 'Uzbek', autonym: 'oʻzbekcha', script: 'latin' },
  { code: 'vi', name: 'Vietnamese', autonym: 'Tiếng Việt', script: 'latin' },
  { code: 'id', name: 'Indonesian', autonym: 'Bahasa Indonesia', script: 'latin' },
  { code: 'ms', name: 'Malay', autonym: 'Bahasa Melayu', script: 'latin' },
  { code: 'tl', name: 'Tagalog', autonym: 'Tagalog', script: 'latin' },
  { code: 'sw', name: 'Swahili', autonym: 'Kiswahili', script: 'latin' },
  { code: 'ha', name: 'Hausa', autonym: 'Hausa', script: 'latin' },
  { code: 'yo', name: 'Yoruba', autonym: 'Yorùbá', script: 'latin' },
  { code: 'ig', name: 'Igbo', autonym: 'Igbo', script: 'latin' },
  { code: 'zu', name: 'Zulu', autonym: 'isiZulu', script: 'latin' },
  { code: 'af', name: 'Afrikaans', autonym: 'Afrikaans', script: 'latin' },
  { code: 'ca', name: 'Catalan', autonym: 'català', script: 'latin' },
  { code: 'eu', name: 'Basque', autonym: 'euskara', script: 'latin' },
  { code: 'gl', name: 'Galician', autonym: 'galego', script: 'latin' },
  { code: 'ga', name: 'Irish', autonym: 'Gaeilge', script: 'latin' },
  { code: 'cy', name: 'Welsh', autonym: 'Cymraeg', script: 'latin' },
  { code: 'la', name: 'Latin', autonym: 'Latina', script: 'latin' },
  { code: 'eo', name: 'Esperanto', autonym: 'Esperanto', script: 'latin' },

  // Indic — the block this library is most likely to be full of.
  { code: 'bn', name: 'Bengali', autonym: 'বাংলা', script: 'bengali' },
  { code: 'as', name: 'Assamese', autonym: 'অসমীয়া', script: 'bengali' },
  { code: 'hi', name: 'Hindi', autonym: 'हिन्दी', script: 'devanagari' },
  { code: 'mr', name: 'Marathi', autonym: 'मराठी', script: 'devanagari' },
  { code: 'ne', name: 'Nepali', autonym: 'नेपाली', script: 'devanagari' },
  { code: 'sa', name: 'Sanskrit', autonym: 'संस्कृतम्', script: 'devanagari' },
  { code: 'gu', name: 'Gujarati', autonym: 'ગુજરાતી', script: 'gujarati' },
  { code: 'pa', name: 'Punjabi', autonym: 'ਪੰਜਾਬੀ', script: 'gurmukhi' },
  { code: 'or', name: 'Odia', autonym: 'ଓଡ଼ିଆ', script: 'odia' },
  { code: 'ta', name: 'Tamil', autonym: 'தமிழ்', script: 'tamil' },
  { code: 'te', name: 'Telugu', autonym: 'తెలుగు', script: 'telugu' },
  { code: 'kn', name: 'Kannada', autonym: 'ಕನ್ನಡ', script: 'kannada' },
  { code: 'ml', name: 'Malayalam', autonym: 'മലയാളം', script: 'malayalam' },
  { code: 'si', name: 'Sinhala', autonym: 'සිංහල', script: 'sinhala' },

  // Arabic script
  { code: 'ar', name: 'Arabic', autonym: 'العربية', script: 'arabic' },
  { code: 'ur', name: 'Urdu', autonym: 'اردو', script: 'arabic' },
  { code: 'fa', name: 'Persian', autonym: 'فارسی', script: 'arabic' },
  { code: 'ps', name: 'Pashto', autonym: 'پښتو', script: 'arabic' },
  { code: 'sd', name: 'Sindhi', autonym: 'سنڌي', script: 'arabic' },

  // Cyrillic
  { code: 'ru', name: 'Russian', autonym: 'Русский', script: 'cyrillic' },
  { code: 'uk', name: 'Ukrainian', autonym: 'Українська', script: 'cyrillic' },
  { code: 'be', name: 'Belarusian', autonym: 'беларуская', script: 'cyrillic' },
  { code: 'bg', name: 'Bulgarian', autonym: 'български', script: 'cyrillic' },
  { code: 'sr', name: 'Serbian', autonym: 'српски', script: 'cyrillic' },
  { code: 'mk', name: 'Macedonian', autonym: 'македонски', script: 'cyrillic' },
  { code: 'mn', name: 'Mongolian', autonym: 'Монгол', script: 'cyrillic' },
  { code: 'kk', name: 'Kazakh', autonym: 'қазақ тілі', script: 'cyrillic' },
  { code: 'ky', name: 'Kyrgyz', autonym: 'кыргызча', script: 'cyrillic' },
  { code: 'tg', name: 'Tajik', autonym: 'тоҷикӣ', script: 'cyrillic' },

  // East and Southeast Asian
  { code: 'zh', name: 'Chinese', autonym: '中文', script: 'han' },
  { code: 'ja', name: 'Japanese', autonym: '日本語', script: 'japanese' },
  { code: 'ko', name: 'Korean', autonym: '한국어', script: 'hangul' },
  { code: 'th', name: 'Thai', autonym: 'ไทย', script: 'thai' },
  { code: 'lo', name: 'Lao', autonym: 'ລາວ', script: 'lao' },
  { code: 'km', name: 'Khmer', autonym: 'ខ្មែរ', script: 'khmer' },
  { code: 'my', name: 'Burmese', autonym: 'မြန်မာ', script: 'myanmar' },

  // Their own scripts
  { code: 'el', name: 'Greek', autonym: 'Ελληνικά', script: 'greek' },
  { code: 'he', name: 'Hebrew', autonym: 'עברית', script: 'hebrew' },
  { code: 'yi', name: 'Yiddish', autonym: 'ייִדיש', script: 'hebrew' },
  { code: 'hy', name: 'Armenian', autonym: 'Հայերեն', script: 'armenian' },
  { code: 'ka', name: 'Georgian', autonym: 'ქართული', script: 'georgian' },
  { code: 'am', name: 'Amharic', autonym: 'አማርኛ', script: 'ethiopic' },
  { code: 'ti', name: 'Tigrinya', autonym: 'ትግርኛ', script: 'ethiopic' },
]

const fold = (s) => String(s || '').trim().toLowerCase()

// NAMES THIS APP ITSELF OFFERED THAT ISO 639 DOES NOT USE.
//
// The board form's language picker was `STARTER_LANGUAGES.map((l) => l.name)` for a
// year, and one of those ten names is not the one the standard carries: the starter
// list said "Mandarin" where 639-1 `zh` is "Chinese". Every board created from that
// picker holds the string "Mandarin", so without this line those boards stop
// resolving the day the picker starts offering "Chinese" — the cover glyph goes
// blank and the row splits in two on the Settings table.
//
// It is a map rather than a second `name` field because an alias is a fact about
// THIS APP'S HISTORY, not about the language: nothing outside these lines should
// have to know that a name was once spelled differently here. The one-time upgrade
// that folds free-text languages onto codes reads the same map.
const ALIASES = { mandarin: 'zh' }

// THE THREE WAYS A STORED VALUE CAN NAME A LANGUAGE, and all three have to work
// because all three are already in somebody's library: the code (`bn`), the English
// name (`Bengali`), and the autonym (`বাংলা`). A reader who has been typing one of
// them for two years must not have to learn which one this file prefers.
const byKey = (() => {
  const m = new Map()
  for (const l of LANGUAGES) {
    m.set(l.code, l)
    m.set(fold(l.name), l)
    m.set(fold(l.autonym), l)
  }
  // After the three canonical keys, so an alias can never shadow a real name.
  for (const [alias, code] of Object.entries(ALIASES)) {
    if (!m.has(alias) && m.has(code)) m.set(alias, m.get(code))
  }
  return m
})()

// languageFor answers what a stored value IS, or null when this file has never
// heard of it.
//
// NULL IS A NORMAL ANSWER AND NOT A FAILURE. Every language column in this app is
// free text; a reader typing "Sylheti" gets null here and goes on seeing "Sylheti"
// everywhere, because the display value has always been what they typed. The only
// thing null costs is the autonym and the script — an offer, not a capability.
export function languageFor(value) {
  return byKey.get(fold(value)) || null
}

// displayName is what to SHOW for a stored value: the language's own name for
// itself where this file knows one, and otherwise exactly what the reader typed.
//
// THE AUTONYM AND NOT THE ENGLISH NAME, which is the whole point of carrying one. A
// Bengali reader's quote is in বাংলা, and an app that has the word and shows them
// "Bengali" is translating their language into somebody else's for no reason. The
// reader's own rename still outranks this — see languages.jsx, where the per-reader
// name has always won.
export function displayName(value) {
  const l = languageFor(value)
  return (l && l.autonym) || String(value || '').trim()
}

// scriptOf is which script a stored value is written in, or '' when unknown.
// The values are fonts.js's FONT_ROLES keys where the app has a face for the script
// — see the header — so this is what a per-language face is chosen by.
export function scriptOf(value) {
  const l = languageFor(value)
  return (l && l.script) || ''
}

// ---- the mark a language wears ---------------------------------------------
//
// THE OWNER RULED THE HAND-PICKED GLYPHS OUT, and the objection they raised against
// the replacement is real and is answered here rather than accepted.
//
// The ten rows this file replaces carried four hand-chosen glyphs each, and their
// comment gave the reason: "The glyphs are deliberately DISTINCT between languages
// that share a script: four of these ten are written in Latin, and a cover that was
// the identical glyph on all four would tell you nothing about which board you were
// looking at." A plain first-rune rule reintroduces exactly that collision — English
// and español differ only in case, norsk and Nederlands likewise, and العربية and
// اردو both begin with alef, which for a library holding Arabic AND Urdu is not a
// hypothetical.
//
// SO THE RULE IS "THE FIRST RUNE OF THE AUTONYM THAT NO EARLIER LANGUAGE OF THE SAME
// SCRIPT HAS TAKEN". العربية gives ا; اردو finds ا taken and gives ر. español finds
// e taken by English and gives s. Hand-picking is back to being unnecessary and
// distinctness survives.
//
// COMPUTED OVER THIS FILE'S OWN LIST AND NOT OVER THE READER'S, which is the part
// that had to be got right. A tie-break resolved against the languages a reader
// happens to have would change a board's cover glyph because they added a DIFFERENT
// language — a tile silently becoming another letter, with nothing on screen to
// explain it. The list below is fixed, so every mark is fixed with it.
//
// CASE-INSENSITIVE, because the collision the old comment names is a cover drawn at
// one size where E and e are one shape with two heights. Two languages whose only
// difference is case are not distinguishable on a tile.
//
// AND WHERE EVERY RUNE IS TAKEN the first one is used anyway and two marks match.
// That is a real outcome for a script with few distinct openings, and the app
// already has the answer a reader needs: the per-reader mark and rename in
// Settings → Languages, which has always outranked anything derived.
// A RUNE THAT CAN STAND ALONE, which is not the same as "not a space".
//
// THE COMBINING MARKS ARE THE ONES THAT MATTER HERE and they nearly shipped. বাংলা
// is ব + া + ং + ল + া, and হিন্দী likewise carries ি and the virama ্ — dependent
// vowel signs and diacritics that have no form of their own. Rendered alone, every
// one of them draws as a DOTTED CIRCLE with the mark hung off it, which is precisely
// the "reads as a rendering bug rather than a letter" failure a tile must not have.
// So `\p{M}` goes out beside the punctuation and the spaces, and বাংলা offers ব and
// ল rather than ব and a matra.
//
// FEWER GLYPHS IS THE RIGHT PRICE. An abugida has fewer standalone letters in a
// short word than a Latin alphabet does, so some rows offer two where English offers
// four — which is honest, and better than four where two of them are unreadable.
const standalone = (r) => !/[\s\p{P}\p{M}]/u.test(r)

const claimed = new Map() // script -> Set of folded runes
const marks = new Map() // code -> mark

for (const l of LANGUAGES) {
  if (!claimed.has(l.script)) claimed.set(l.script, new Set())
  const taken = claimed.get(l.script)
  const runes = [...l.autonym]
  const usable = runes.filter(standalone)
  const pick = usable.find((r) => !taken.has(r.toLowerCase())) || usable[0] || runes[0] || ''
  taken.add(pick.toLowerCase())
  marks.set(l.code, pick)
}

// markFor is the glyph a language leads with where the reader has chosen none.
// '' for a language this file has never heard of — the caller falls back to whatever
// it fell back to before, which for a proverb card is the first rune of what the
// reader typed.
export function markFor(value) {
  const l = languageFor(value)
  return (l && marks.get(l.code)) || ''
}

// glyphsFor is the row of choices a language offers: its own first distinct runes,
// the mark above leading.
//
// FOUR, AND ALL FOUR FROM ITS OWN SCRIPT, which is the rule the hand-picked rows
// followed and the reason they existed at all. The choice being offered is "which
// letter stands for my language", not "which country" — so a row drawn from the
// autonym is the same offer the ten starters made, generalised to every language
// this file knows instead of the ten somebody had time to type.
//
// DISTINCT RUNES, because "eesti" would otherwise offer e, e, s, t and waste a
// quarter of the row saying the same thing twice. Punctuation and spaces are out for
// the reason markFor drops them: a tile that is a space reads as a bug.
//
// FEWER THAN FOUR IS A FINE ANSWER. 中文 has two runes and offers two; padding the
// row with something from another script would be the flags mistake in miniature.
export function glyphsFor(value) {
  const l = languageFor(value)
  if (!l) return []
  const lead = markFor(value)
  const out = lead ? [lead] : []
  for (const r of l.autonym) {
    if (out.length >= 4) break
    if (!standalone(r)) continue
    if (out.some((x) => x.toLowerCase() === r.toLowerCase())) continue
    out.push(r)
  }
  return out
}
