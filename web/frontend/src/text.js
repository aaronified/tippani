// text.js — the string primitives two unrelated screens both need.
//
// Everything here takes strings and returns values. No React, no fetch, no
// imports at all, which is the whole point: it loads in the `pure` test project
// without dragging the component tree behind it, and neither caller has to know
// the other exists.
//
// It exists because `editDistance` was written inside MetadataPage.jsx for
// near-duplicate person names, and the search box's facet dropdown now wants the
// same function for typo tolerance over the vocabulary. Two copies of Levenshtein
// in one app is the kind of duplication that stays correct right up until
// somebody tunes one of them.

// editDistance is Levenshtein (iterative, one row of state) — the number of
// single-character insertions, deletions or substitutions between a and b.
//
// Moved here verbatim from MetadataPage.jsx, where it spotted author/actor names
// one or two edits apart (typos, transliterations). Its second caller is the
// facet dropdown, which uses it to forgive one mistyped letter in a tag name.
export function editDistance(a, b) {
  const m = a.length, n = b.length
  if (!m) return n
  if (!n) return m
  const dp = Array.from({ length: m + 1 }, (_, i) => i)
  for (let j = 1; j <= n; j++) {
    let prev = dp[0]
    dp[0] = j
    for (let i = 1; i <= m; i++) {
      const tmp = dp[i]
      dp[i] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[i], dp[i - 1])
      prev = tmp
    }
  }
  return dp[m]
}

// foldText lowercases and strips combining diacritics, and stops there.
//
// IT IS NOT normName, AND THE DIFFERENCE IS THE WHOLE REASON IT EXISTS. normName
// (ui.jsx) also drops everything outside [a-z0-9], which folds a Bengali or
// Cyrillic or CJK string to the empty string. That is correct for its job —
// grouping Latin names, where "" reliably means "cannot compare" — and fatal for
// this one: a reader whose tags are in Bengali would type into a dropdown where
// every option folded to "" and therefore matched everything equally.
//
// So this folds case and accents, which is all a typeahead needs, and never
// deletes a character for being unspellable in ASCII.
//
// It is accent folding, not Latin-only folding, and the two are worth keeping
// apart. The combining marks it strips are the U+0300–U+036F block, which Greek
// and Cyrillic borrow as well: `Толстой` folds to `толстои` and `ά` to `α`,
// exactly as `Émile` folds to `emile`. That is the same forgiveness in three
// scripts rather than a Latin rule leaking into two others — a reader who types
// `толстои` finds Tolstoy, and one who types `толстой` still does.
//
// THE ROUND TRIP THROUGH NFC IS LOAD-BEARING, and it is the reason this is four
// lines rather than three. Decomposing is how the accent is separated from its
// letter so the strip can find it — but NFKD decomposes EVERY script, and the
// combining class it produces for Bengali or Devanagari is nowhere near the
// U+0300–U+036F range the strip covers. Without recomposing, `স্টোইক` came back
// as a longer string of pieces that merely renders the same: identical on
// screen, a different length to editDistance, and a different value to `===`.
// Both sides of a comparison go through this function, so matching still worked
// — which is exactly why it would have gone unnoticed until the edit budget
// started forgiving two typos in a word the reader sees as six characters.
export function foldText(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip combining diacritics (Latin range)
    .normalize('NFC')
    .trim()
}

// editBudget is how many edits a token of n folded characters is allowed to be
// wrong by: nothing under 3 characters (too little signal — at two characters
// almost every option is one edit away), one edit up to 5, two beyond that.
//
// This mirrors `budgetFor` in internal/search/levenshtein.go on purpose. The two
// are not called by the same code and never will be — one corrects a search query
// against the FTS vocabulary on the server, the other narrows a dropdown in the
// browser — but a reader who learns that the box forgives one typo should find
// that true in both places, so the thresholds are kept in lockstep by hand.
export function editBudget(n) {
  if (n < 3) return 0
  return n <= 5 ? 1 : 2
}

// episodeLabel renders a show line's episode locator the way people write it:
// S2E5, or S2 when the season is all that's recorded. '' when there is none —
// which is every film line, so a caller can join it into a credit unconditionally.
//
// The null checks are deliberate, not `|| ''`: season 0 is a real season (it is
// where a series keeps its specials), so 0 has to render.
//
// HERE RATHER THAN IN Movies.jsx, where it was written and where its four other
// callers still are. The quiz runner needs it to caption a film line, and the
// runner now lives in review.jsx — which the work tiles and the person panel
// import, and which Movies.jsx imports by way of works.jsx. A one-line pure
// formatter was the only thing standing between those two facts and an import
// cycle, so it moved to the module that imports nothing.
export function episodeLabel(d) {
  if (d?.season == null) return ''
  return d.episode == null ? `S${d.season}` : `S${d.season}E${d.episode}`
}

// chapterLabel is what a chapter is CALLED anywhere the interface prints one, and
// it is spelled the same way as chapterHeading in export_handlers.go — the string
// this produces is the string a book export writes as its "## " heading, and the
// string the importer reads back.
//
//   7 · The Fall    a number and a name
//   7               a number alone (most books)
//   The Fall        a name alone (essays, scripture, anything unnumbered)
//   ''              neither, so a caller can join it in unconditionally
//
// TWO FIELDS, ONE LABEL. 0044 split `chapter` into a number and a name because one
// text field was holding both and could not sort — but nothing on a card wants to
// show them as two things, so every display site goes through here instead of
// deciding for itself how to punctuate the pair. That is the whole reason it is a
// function and not four template literals.
//
// A whole number prints without its decimal part: 7, never 7.0. That is what
// JavaScript's own number-to-string gives us, and it happens to match Go's
// shortest-form FormatFloat, which is what keeps the two spellings identical.
export function chapterLabel(a) {
  const no = Number(a?.chapter_no) || 0
  const name = (a?.chapter || '').trim()
  if (!no) return name
  return name ? `${no} · ${name}` : String(no)
}

// chapterMeta is chapterLabel with the "CH." a card's meta line wants — and it puts
// the prefix on a NUMBER only. "CH. 7" reads as a chapter; "CH. Envoi" reads as
// somebody who did not know what was in the field.
//
// This replaces the same heuristic written out in three files — `/^\d/.test(ch) ?
// 'CH. ' + ch : ch` — which existed precisely BECAUSE one text field held both a
// number and a name and the card had to guess which it had. Now it knows, so the
// guess becomes a rule; and Library's own meta line, which prefixed CH. onto
// everything unconditionally, stops disagreeing with Home and the quiz about how to
// caption the identical row.
export function chapterMeta(a) {
  const label = chapterLabel(a)
  if (!label) return ''
  return Number(a?.chapter_no) ? `CH. ${label}` : label
}

// ---- the one clip the app is allowed ----------------------------------------
//
// A DEPARTURE FROM "NEVER TRUNCATE A NAME", recorded in PLAN.md and granted by
// the owner in as many words: "we do not want wrap, long names can instead get a
// … after a certain number of chars." The argument is the ROW rather than the
// name — a row of chips that reflows moves every other chip when one name is
// long, and a scroller inside each chip of a row of chips is a gesture nobody
// would find. The whole name goes on the button's `title`.
//
// IN JS AT A CHARACTER COUNT, NOT `text-overflow`. Two reasons, and PLAN.md gives
// both: the ellipsis lands in the same place whatever the type dial says, and
// `no-truncated-names.test.js` reads the stylesheet for that declaration on the
// classes that hold names, so putting it in CSS would either trip that test or
// teach the next reader that the rule has exceptions in the stylesheet.
//
// AND IT LIVES HERE BECAUSE TWO CHIPS DRAW NAMES. people.jsx has the app's rich
// chip row; review.jsx has its own display-only one, which it must (people.jsx
// imports usePractice from review.jsx). That one clipped with `textOverflow:
// 'ellipsis'` in an inline style — the same truncation, in the one form the
// stylesheet guard cannot see, on the surface the Easy tier exists to name people
// on. One clip, one number, both callers.
export const CHIP_NAME_CHARS = 18

export function clipChipName(v) {
  const s = String(v || '').trim()
  return s.length > CHIP_NAME_CHARS ? s.slice(0, CHIP_NAME_CHARS - 1).trimEnd() + '…' : s
}

// quoteTexts — WHICH TEXT GOES IN THE BIG TYPE AND WHICH GOES UNDER IT.
//
// ONE FUNCTION FOR BOTH HALVES, and it used to be two that could disagree:
// `quoteBody` chose the big type and `showsTranslationLine` decided the second
// line, each reading `tview` for itself. That was safe while the second line was
// always the translation. It is not safe now that the two can SWAP, because the
// pair would then have to arrive at the same answer twice from the same inputs —
// and the failure is silent and doubled: the same words printed in both sizes, or
// a card that shows one text and hides the other.
//
// THE NARROWEST SCOPE DECIDES, and it replaced an inference. resolveTextOrder
// walks scope → language → master: a work's own setting beats the reader's row for
// that language, which beats their master slider, which falls back to quote-first.
// Nothing is stored per card — a card contributes only the language of its own
// line, which is what keeps this per-card without a column.
//
// AND THE ⋯ MENU'S TEXT SECTION IS GONE, which is the point and not a side-effect.
// It held one device-local key for the whole app, sat ABOVE the work in the chain,
// and answered exactly the question the master slider answers now: a global menu
// and a global slider on one question is the "one fact signalled twice" this repo
// forbids. What replaced it is not a shorter menu but scopes that can each say
// nothing and defer — which a three-way menu could not do.
//
// A FALLBACK, NOT A BLANK, kept from the version this replaces: a state that asks
// for the translation alone, on a quote with no translation, shows the quote.
// Honouring it exactly would empty every untranslated quote on the board, which on
// a library where translations are the exception is a setting that looks like a bug
// that has deleted your highlights. The state says which text to PREFER; a card
// still has to say something. The mirror holds too: "no translation" on a row that
// is only a translation shows it.
//
// ONE RESOLVED STATE, NOT A MENU AND A PREDICATE. This took `(tview, canRead)` and
// inferred the answer — the menu said quote/translation/both and, on `both`, a
// predicate over the reader's declared languages decided which led. The owner
// replaced the inference with an instruction in four parts and three scopes, so
// the deciding is now textOrder.js's and this function only draws the decision.
// That is the whole reason the predicate threading is gone: a capability that has
// to reach every call site is absent at most of them, which is exactly how the
// table view spent a day disagreeing with the cards.
export function quoteTexts(a, order) {
  const quote = a?.quote || ''
  const translation = a?.translation || ''
  // 0069. A THIRD TEXT THAT THE ORDER DIAL DOES NOT REORDER, and that is the one
  // decision worth stating. The dial answers "which MEANING leads" — the words as
  // said, or the words as understood — and a transliteration is neither: it is how
  // the original SOUNDS, so it belongs beside the original rather than in the
  // queue with it. Returned as its own field so the callers that draw one line
  // (the table cell, the share payload) are unaffected by its existence.
  const roman = a?.transliteration || ''
  switch (order) {
    case 'quote-only':
      return { body: quote || translation, second: '', roman }
    // Under "translations only" the original is not on the card, so a
    // pronunciation of it has nothing to be a pronunciation OF.
    case 'trans-only':
      return { body: translation || quote, second: '', roman: '' }
    case 'trans-first':
      // AND NOTHING TO LEAD WITH IS NOT A REORDERING. A row with no translation
      // under "translations first" is not a card with an empty top line; it is a
      // card with one text, and the one text goes in the big type.
      return translation ? { body: translation, second: quote, roman } : { body: quote, second: '', roman }
    default:
      return { body: quote, second: translation, roman }
  }
}

// quoteBody — the big type alone, for the callers that draw nothing else: the
// table's two-line cell and the share payload. Expressed through quoteTexts so
// there is one answer to "which text leads" in the app.
export function quoteBody(a, order) {
  return quoteTexts(a, order).body
}

// scriptOf — which writing system a string is mostly in, as a script name or ''.
//
// NOT A LANGUAGE, and the difference is why this is answerable at all. One script
// serves many languages and the app's language field is free text a reader typed
// (see languages.jsx — there are no ISO codes yet and no script column), so
// "which language is this" cannot be read off a row. "Which script are these
// characters" can be read off the characters, needs no metadata, and is the
// question actually being asked.
//
// FIRST MATCH WINS over a fixed order rather than a count of every character. A
// transliteration in brackets after the original, or a stray Latin name inside a
// Bengali proverb, would tip a majority vote; the leading strong character is what
// the bidi algorithm uses for the same kind of decision (see the direction rule in
// CLAUDE.md) and it is stable under that mixing. Digits, spaces and punctuation
// belong to no script and are skipped by every pattern.
const SCRIPTS = [
  ['bengali', /\p{Script=Bengali}/u],
  ['devanagari', /\p{Script=Devanagari}/u],
  ['arabic', /\p{Script=Arabic}/u],
  ['han', /\p{Script=Han}/u],
  ['cyrillic', /\p{Script=Cyrillic}/u],
  ['greek', /\p{Script=Greek}/u],
  ['hebrew', /\p{Script=Hebrew}/u],
  ['latin', /\p{Script=Latin}/u],
]

export function scriptOf(s) {
  const str = String(s || '')
  if (!str.trim()) return ''
  for (const ch of str) {
    for (const [name, re] of SCRIPTS) if (re.test(ch)) return name
  }
  return ''
}

// LOCALE_SCRIPT — the script each interface language is written in. Two entries
// because the app has two locales; a third locale adds a row here and nothing
// else. Unknown locales fall back to Latin, which is what an unlisted one is
// overwhelmingly likely to be and is the same guess the fonts already make.
const LOCALE_SCRIPT = { en: 'latin', bn: 'bengali' }

// wantsTransliteration — whether the form should offer the box.
//
// THE OWNER'S RULE: "All quote shall get one, but will only be shown for scripts
// that are not the same as the chosen language. User may want to store bengali
// transliteration everywhere." So the question is not "is this Bengali" but "is
// this in a script other than the one the reader is reading the app in" — which
// means the app in Bengali offers a Bengali romanisation of an English quote, and
// the app in English offers a Latin one of a Bengali quote. The same field, two
// directions, decided by the reader's own locale rather than by a hardcoded idea
// of which script is the strange one.
//
// AN EXISTING VALUE ALWAYS SHOWS ITS BOX. A field that hides while holding text
// is a field that silently drops it on the next save, and a reader who switched
// locale would watch their own work disappear. Nothing here can hide data; it can
// only decline to ask for it.
export function wantsTransliteration(quote, locale, existing = '') {
  if (String(existing || '').trim()) return true
  const s = scriptOf(quote)
  if (!s) return false // nothing typed yet, or nothing but digits — do not ask
  return s !== (LOCALE_SCRIPT[locale] || 'latin')
}

// showsTranslationLine — kept for the reader who looks for it by name. It answers
// "is there a second line", which is not the same question as "is there a
// translation".
export function showsTranslationLine(a, order) {
  return !!quoteTexts(a, order).second
}
