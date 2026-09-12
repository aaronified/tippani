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
// A LANGUAGE WITH NO 639-1 CODE IS STILL A LANGUAGE. Maa has none — it is `mas` in
// 639-3 — and BCP 47 (RFC 5646 §2.2.1) already says what to do: a primary language
// subtag is the SHORTEST available code, 639-1 where one exists and 639-3 where none
// does. So `code` is two letters or three, and a two-letter-only rule would not have
// been stricter about the standard, it would have been wrong about it.
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
  { code: 'es', name: 'Spanish', autonym: 'español', script: 'latin', mark: 'ñ' },
  { code: 'fr', name: 'French', autonym: 'français', script: 'latin', mark: 'œ' },
  { code: 'pt', name: 'Portuguese', autonym: 'português', script: 'latin' },
  { code: 'it', name: 'Italian', autonym: 'italiano', script: 'latin' },
  { code: 'de', name: 'German', autonym: 'Deutsch', script: 'latin', mark: 'ß' },
  { code: 'nl', name: 'Dutch', autonym: 'Nederlands', script: 'latin' },
  { code: 'sv', name: 'Swedish', autonym: 'svenska', script: 'latin' },
  { code: 'no', name: 'Norwegian', autonym: 'norsk', script: 'latin' },
  { code: 'da', name: 'Danish', autonym: 'dansk', script: 'latin' },
  { code: 'fi', name: 'Finnish', autonym: 'suomi', script: 'latin' },
  { code: 'is', name: 'Icelandic', autonym: 'íslenska', script: 'latin', mark: 'þ' },
  { code: 'pl', name: 'Polish', autonym: 'polski', script: 'latin', mark: 'ł' },
  { code: 'cs', name: 'Czech', autonym: 'čeština', script: 'latin', mark: 'ř' },
  { code: 'sk', name: 'Slovak', autonym: 'slovenčina', script: 'latin', mark: 'ľ' },
  { code: 'hu', name: 'Hungarian', autonym: 'magyar', script: 'latin', mark: 'ő' },
  { code: 'ro', name: 'Romanian', autonym: 'română', script: 'latin', mark: 'ț' },
  { code: 'hr', name: 'Croatian', autonym: 'hrvatski', script: 'latin' },
  { code: 'sl', name: 'Slovenian', autonym: 'slovenščina', script: 'latin' },
  { code: 'sq', name: 'Albanian', autonym: 'shqip', script: 'latin', mark: 'ë' },
  { code: 'lt', name: 'Lithuanian', autonym: 'lietuvių', script: 'latin', mark: 'ė' },
  { code: 'lv', name: 'Latvian', autonym: 'latviešu', script: 'latin', mark: 'ķ' },
  { code: 'et', name: 'Estonian', autonym: 'eesti', script: 'latin' },
  { code: 'tr', name: 'Turkish', autonym: 'Türkçe', script: 'latin', mark: 'ğ' },
  { code: 'az', name: 'Azerbaijani', autonym: 'azərbaycan', script: 'latin', mark: 'ə' },
  { code: 'uz', name: 'Uzbek', autonym: 'oʻzbekcha', script: 'latin' },
  { code: 'vi', name: 'Vietnamese', autonym: 'Tiếng Việt', script: 'latin', mark: 'ơ' },
  { code: 'id', name: 'Indonesian', autonym: 'Bahasa Indonesia', script: 'latin' },
  { code: 'ms', name: 'Malay', autonym: 'Bahasa Melayu', script: 'latin' },
  { code: 'tl', name: 'Tagalog', autonym: 'Tagalog', script: 'latin' },
  { code: 'sw', name: 'Swahili', autonym: 'Kiswahili', script: 'latin' },
  { code: 'ha', name: 'Hausa', autonym: 'Hausa', script: 'latin', mark: 'ɓ' },
  { code: 'yo', name: 'Yoruba', autonym: 'Yorùbá', script: 'latin', mark: 'ṣ' },
  { code: 'ig', name: 'Igbo', autonym: 'Igbo', script: 'latin', mark: 'ị' },
  { code: 'zu', name: 'Zulu', autonym: 'isiZulu', script: 'latin' },
  { code: 'af', name: 'Afrikaans', autonym: 'Afrikaans', script: 'latin' },
  { code: 'ca', name: 'Catalan', autonym: 'català', script: 'latin' },
  { code: 'eu', name: 'Basque', autonym: 'euskara', script: 'latin' },
  { code: 'gl', name: 'Galician', autonym: 'galego', script: 'latin', mark: 'x' },
  { code: 'ga', name: 'Irish', autonym: 'Gaeilge', script: 'latin' },
  { code: 'cy', name: 'Welsh', autonym: 'Cymraeg', script: 'latin', mark: 'ŵ' },
  { code: 'la', name: 'Latin', autonym: 'Latina', script: 'latin' },
  { code: 'eo', name: 'Esperanto', autonym: 'Esperanto', script: 'latin', mark: 'ŭ' },
  { code: 'gd', name: 'Scottish Gaelic', autonym: 'Gàidhlig', script: 'latin' },
  { code: 'mi', name: 'Maori', autonym: 'Māori', script: 'latin', mark: 'ā' },
  { code: 'qu', name: 'Quechua', autonym: 'Runasimi', script: 'latin', mark: 'q' },
  // THE ONE THREE-LETTER CODE, and the reason it is allowed is the standard's own.
  // Maa has no ISO 639-1 code — it is `mas` in 639-3 — and BCP 47 (RFC 5646 §2.2.1)
  // says a primary language subtag is the SHORTEST AVAILABLE code: 639-1 where one
  // exists, 639-3 where one does not. So refusing a three-letter row would not be
  // stricter about the standard, it would be wrong about it, and it would lose a
  // language for a reason that has nothing to do with the language.
  { code: 'mas', name: 'Maasai', autonym: 'Maa', script: 'latin', mark: 'ɔ' },

  // Indic — the block this library is most likely to be full of.
  { code: 'bn', name: 'Bengali', autonym: 'বাংলা', script: 'bengali' },
  { code: 'as', name: 'Assamese', autonym: 'অসমীয়া', script: 'bengali', mark: 'ৰ' },
  { code: 'hi', name: 'Hindi', autonym: 'हिन्दी', script: 'devanagari' },
  { code: 'mr', name: 'Marathi', autonym: 'मराठी', script: 'devanagari', mark: 'ळ' },
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
  { code: 'ur', name: 'Urdu', autonym: 'اردو', script: 'arabic', mark: 'ے' },
  { code: 'fa', name: 'Persian', autonym: 'فارسی', script: 'arabic', mark: 'پ' },
  { code: 'ps', name: 'Pashto', autonym: 'پښتو', script: 'arabic', mark: 'ښ' },
  { code: 'sd', name: 'Sindhi', autonym: 'سنڌي', script: 'arabic', mark: 'ڌ' },

  // Cyrillic
  { code: 'ru', name: 'Russian', autonym: 'Русский', script: 'cyrillic', mark: 'Ж' },
  { code: 'uk', name: 'Ukrainian', autonym: 'Українська', script: 'cyrillic', mark: 'ї' },
  { code: 'be', name: 'Belarusian', autonym: 'беларуская', script: 'cyrillic', mark: 'ў' },
  { code: 'bg', name: 'Bulgarian', autonym: 'български', script: 'cyrillic' },
  { code: 'sr', name: 'Serbian', autonym: 'српски', script: 'cyrillic', mark: 'ђ' },
  { code: 'mk', name: 'Macedonian', autonym: 'македонски', script: 'cyrillic', mark: 'ѓ' },
  { code: 'mn', name: 'Mongolian', autonym: 'Монгол', script: 'cyrillic', mark: 'ө' },
  { code: 'kk', name: 'Kazakh', autonym: 'қазақ тілі', script: 'cyrillic', mark: 'ә' },
  { code: 'ky', name: 'Kyrgyz', autonym: 'кыргызча', script: 'cyrillic' },
  { code: 'tg', name: 'Tajik', autonym: 'тоҷикӣ', script: 'cyrillic', mark: 'ҷ' },

  // East and Southeast Asian
  { code: 'zh', name: 'Chinese', autonym: '中文', script: 'han' },
  { code: 'ja', name: 'Japanese', autonym: '日本語', script: 'japanese' },
  { code: 'ko', name: 'Korean', autonym: '한국어', script: 'hangul' },
  { code: 'th', name: 'Thai', autonym: 'ไทย', script: 'thai' },
  { code: 'lo', name: 'Lao', autonym: 'ລາວ', script: 'lao' },
  { code: 'km', name: 'Khmer', autonym: 'ខ្មែរ', script: 'khmer' },
  { code: 'my', name: 'Burmese', autonym: 'မြန်မာ', script: 'myanmar' },
  { code: 'iu', name: 'Inuktitut', autonym: 'ᐃᓄᒃᑎᑐᑦ', script: 'syllabics' },

  // Their own scripts
  { code: 'el', name: 'Greek', autonym: 'Ελληνικά', script: 'greek', mark: 'Σ' },
  { code: 'he', name: 'Hebrew', autonym: 'עברית', script: 'hebrew' },
  { code: 'yi', name: 'Yiddish', autonym: 'ייִדיש', script: 'hebrew', mark: 'ײ' },
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
const ALIASES = { mandarin: 'zh', masai: 'mas', inuktut: 'iu' }

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
const standalone = (r) => !/[\s\p{P}\p{M}\p{Lm}]/u.test(r)

const claimed = new Map() // script -> Set of folded runes
const marks = new Map() // code -> mark

// A ROW'S OWN `mark` WINS, AND EVERY ONE OF THEM IS CLAIMED BEFORE ANYTHING IS
// DERIVED. Otherwise a language earlier in the list could derive ñ off its autonym
// and Spanish would arrive to find its own letter taken — the explicit answer losing
// to a guess, which is the wrong way round and would depend on list order to boot.
for (const l of LANGUAGES) {
  if (!l.mark) continue
  if (!claimed.has(l.script)) claimed.set(l.script, new Set())
  claimed.get(l.script).add(l.mark.toLowerCase())
  marks.set(l.code, l.mark)
}

const freeRune = (word, taken) =>
  [...word].filter(standalone).find((r) => !taken.has(r.toLowerCase())) || ''

// EVERY LETTER THE SCRIPT'S OWN LANGUAGES ACTUALLY WRITE, in list order. Derived
// from the autonyms rather than typed out, so adding a language adds its letters to
// the pool and nothing has to be kept in step.
const alphabet = (script) =>
  LANGUAGES.filter((l) => l.script === script).flatMap((l) => [...l.autonym]).filter(standalone)

// THE AUTONYM CAN RUN OUT, AND THE OLD LAST RESORT LIED ABOUT IT. Every rune of
// galego — g, a, l, e, o — is already some other Latin language's mark by the time
// Galician is reached, and the fallback was `usable[0]`, which took g whether or not
// Tagalog had it. That silently broke the one thing this tie-break exists for: at
// 8dc0a259 SIX pairs shared a mark (sk/es, lv/pl, zu/it, eu/et, gl/tl, eo/en) while
// the comment above said they could not, and only a script that printed every mark
// and compared them found it. The uniqueness test below is that script, kept.
//
// The English name is searched next, and ONLY for a Latin-script language, because
// "Galician" is in the same script as "galego" while "Bengali" is not in the same
// script as বাংলা. Taking a Latin G for a Bengali-script language is the
// confidently-wrong answer this file exists to refuse.
//
// AND THE LAST RESORT IS THE SCRIPT'S OWN ALPHABET, because Latin has twenty-six
// letters and this list has forty-three languages written in it — exhaustion is
// structural there, not bad luck, and both galego and oʻzbekcha hit it. A letter
// nothing in the language's own name offers is not evocative, and that is the right
// trade: a mark that says little is a mark, and two boards wearing the SAME letter
// is not. Ordered by the list so it is stable, and drawn from the autonyms so a new
// language widens the pool without anyone maintaining one.
for (const l of LANGUAGES) {
  if (marks.has(l.code)) continue
  if (!claimed.has(l.script)) claimed.set(l.script, new Set())
  const taken = claimed.get(l.script)
  const runes = [...l.autonym]
  const pick = freeRune(l.autonym, taken)
    || (l.script === 'latin' ? freeRune(l.name, taken) : '')
    || alphabet(l.script).find((r) => !taken.has(r.toLowerCase()))
    || runes.filter(standalone)[0] || runes[0] || ''
  taken.add(pick.toLowerCase())
  marks.set(l.code, pick)
}

// markFor is the glyph a language leads with where the reader has chosen none.
// '' for a language this file has never heard of — the caller falls back to whatever
// it fell back to before, which for a proverb card is the first rune of what the
// reader typed.
//
// NOT COLLIDING IS NOT THE SAME AS IDENTIFYING, and this file shipped believing it
// was. The owner, on the answer the derivation gave: "Bengali ব vs Assamese অ,
// assamese should get their r, that is uniquely assamese. Same for all languages."
// অ is the first letter of অসমীয়া, so the derivation was working; it is also the
// first vowel of the script BOTH languages write, so the tile said "a Bengali-script
// language that is not Bengali" and stopped there.
//
// SO A ROW MAY NAME ITS OWN LETTER, and where it does that letter is one no other
// listed language of its script writes: ৰ where Bengali writes র, ښ for Pashto, ѓ
// for Macedonian, ß for German. Roughly half the list has one. A language that
// genuinely has no letter of its own — Nepali and Hindi share an alphabet entirely,
// and Galician shares Spanish's — keeps the derivation, which is the honest answer
// rather than a letter invented to look decisive.
//
// BENGALI KEEPS ব RATHER THAN TAKING র, WHICH IS ALSO ITS OWN. The principled pair
// would be (র, ৰ) — and those differ by one short diagonal, so two covers a reader
// cannot tell apart at 22px, which is the same failure arrived at from the other
// side. ব is the first letter of বাংলা and shares no shape with ৰ. Where the letter
// that is technically unique is visually a twin, the legible one wins.
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
