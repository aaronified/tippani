// text.js — the string primitives two unrelated screens both need.
//
// Everything here takes strings and returns values. No React and no fetch, which
// is the whole point: it loads in the `pure` test project without dragging the
// component tree behind it, and neither caller has to know the other exists. The
// one import is `fonts.js` — a table, a few pure lookups over it, and one import
// of its own (`iso639.js`, which has none), so nothing else follows it in. (This
// said "the one import" while there were two, and "neither has an import of its
// own" after one of them gained one: a count in prose is only ever right for as
// long as somebody keeps counting.)
//
// It exists because `editDistance` was written inside MetadataPage.jsx for
// near-duplicate person names, and the search box's facet dropdown now wants the
// same function for typo tolerance over the vocabulary. Two copies of Levenshtein
// in one app is the kind of duplication that stays correct right up until
// somebody tunes one of them.
import { languageClass } from './fonts.js'

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

// chapterMeta WAS HERE, and its rule moved to `locatorMeta` in attribution.js.
//
// Its job was chapterLabel plus the "CH." a card's meta line wants, on a NUMBER
// only — "CH. 7" reads as a chapter, "CH. Envoi" reads as somebody who did not
// know what was in the field. That rule is kept; what could not stay is the
// caption, because "CH." was a LITERAL in a module that imports nothing, while
// the book page drew the same field through `common.locator.chapter.label` — so
// one row was captioned in English on Home and the recall card and in the
// reader's own language on the book page. A caption is vocabulary and needs
// `t`; this module takes strings and returns
// values and has no imports at all, deliberately. So the rule went to where the
// vocabulary already lives, and the page number went with it — the two were
// always one decision and were being made in four places.

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
  const pair = () => {
    switch (order) {
      case 'quote-only':
        return { body: quote || translation, second: '' }
      case 'trans-only':
        return { body: translation || quote, second: '' }
      case 'trans-first':
        // AND NOTHING TO LEAD WITH IS NOT A REORDERING. A row with no translation
        // under "translations first" is not a card with an empty top line; it is a
        // card with one text, and the one text goes in the big type.
        return translation ? { body: translation, second: quote } : { body: quote, second: '' }
      default:
        return { body: quote, second: translation }
    }
  }
  // AND WHICH FACE EACH OF THE TWO IS SET IN, which only this function can say.
  //
  // A quote's language is a fact about the QUOTE and not about the card: the
  // translation beside it is in whatever the reader translated into, and nothing
  // stores that. So the script tags the slot holding `a.quote`, wherever the four
  // states have put it — and a card under "translations first" gets its Bengali
  // face on the SECOND line, which is the case that makes this the wrong thing to
  // compute at a render site. Every caller already asks this function which text
  // leads; asking it in one more place for a class name would be a second opinion
  // about the same question.
  //
  // '' FOR EVERY LANGUAGE NOTHING HAS SET AND WHOSE SCRIPT THIS APP HAS NO FACE
  // FOR, which is most of them — English, Italian and Sylheti alike end up blank,
  // so the text keeps the card's own face. `languageClass` is the whole ladder:
  // the reader's own choice for this language first, the script's role second,
  // nothing third. It is keyed on the LANGUAGE and not the script because those
  // are different questions for German and English, which share one.
  const { body, second } = pair()
  const script = languageClass(a?.language)
  const tag = (text) => (text && text === quote ? script : '')
  return { body, second, bodyScript: tag(body), secondScript: tag(second) }
}

// quoteBody — the big type alone, for the callers that draw nothing else: the
// table's two-line cell and the share payload. Expressed through quoteTexts so
// there is one answer to "which text leads" in the app.
export function quoteBody(a, order) {
  return quoteTexts(a, order).body
}
// showsTranslationLine — kept for the reader who looks for it by name. It answers
// "is there a second line", which is not the same question as "is there a
// translation".
export function showsTranslationLine(a, order) {
  return !!quoteTexts(a, order).second
}

// ---- the chapter pair, in one function both forms call ----------------------
//
// A BOOK'S CHAPTER IS TWO COLUMNS (0044) — a number and a name — and a reader who
// has recorded both once should not have to remember the mapping again. Choosing
// "The Whale" can fill 42 beside it, and choosing 42 can fill "The Whale".
//
// THE OWNER REVERSED THE DIRECTION THIS SHIPPED WITH, and the old reasoning is
// kept here because it was not wrong, only outvoted. `suggest.jsx` said: "Filling
// the name from a number would be guessing at what somebody meant by '42';
// filling the number from a name is repeating what they themselves typed against
// those exact words." The owner's answer: "chapter number auto populates from
// chapter name now, but not vice versa. chapter name from number is more useful."
//
// And in use they are right, because of which box a reader reaches for FIRST. You
// are holding a book open at chapter 42; the number is on the page in front of
// you and the name is the thing you would have to flip back to find. So the
// number is what gets typed and the name is what is worth recalling. The old
// argument answers a different question — which direction is more RELIABLE — and
// reliability is bought back below by never overwriting.
//
// BOTH DIRECTIONS, AND NEITHER EVER CLOBBERS. A fill lands only in an EMPTY
// counterpart. The failure it avoids: you type 7, then pick a chapter name to
// save typing, and the 7 silently becomes 3 — you would not notice until the
// quote was filed under the wrong chapter, and nothing would record that the app
// had done it. So a disagreement is left alone; the reader's own typing always
// wins.
//
// AND "LEFT ALONE" IS NOT THE SAME AS "NOTHING HAPPENS", WHICH IS WHAT IT WAS FOR
// A RELEASE. The owner found the dead end this rule creates, and found it by
// typing: "if i am at chapter 15, the chapter name is assigned at typing 1 and
// then no rewrites". Two defects, one report. The first is WHEN — the rule ran on
// every keystroke, so `1` of `15` matched chapter one and filled its name, and by
// the `5` the never-clobber rule had made that permanent. The fix is theirs:
// "should it not be assigned when the edit is complete (the typing cursor is
// moved)?" — yes, and it now runs on COMMIT, which is picking a suggestion or
// leaving the box, never mid-word. The second is that never-clobber with no way
// back is a trap rather than a safeguard, so a disagreement now returns an OFFER:
// one chip naming what the pool says, which fills on a tap and writes nothing
// until it is tapped. That is `docs/plans/entry-helpers.md`'s state 3, built.
//
// IT LIVES HERE, IMPORT-FREE, so the add form and the edit form call one function
// rather than keeping a line each — the repo's directive that two things which
// look the same behave the same, and the reason `chapterLabel` is already in this
// file. A rule duplicated across two forms is two places for one of them to stop
// being right.
//
// `pool` is [{ no, name, count }] as `GET /books/{id}/chapters` returns it.
//
// Returns `{ patch, offer }`. `patch` is always applied; `offer` is null or
// `{ field, value }` for the counterpart the pool disagrees with — never both, by
// construction, because a fill and an offer answer the same question.
export function chapterPatch(which, typed, current, pool) {
  const rows = Array.isArray(pool) ? pool : []
  const fold = (s) => String(s ?? '').trim().toLowerCase()
  if (which === 'name') {
    const patch = { chapter: typed }
    // FIRST MATCH, and the pool arrives commonest-first, so a one-off typo of a
    // chapter name loses to the spelling actually used. A name recorded against
    // two different numbers is genuinely ambiguous and the first is the one the
    // reader used most — which beats picking neither on a form whose whole point
    // is being quick.
    const hit = rows.find((r) => fold(r.name) === fold(typed) && r.no)
    if (!hit) return { patch, offer: null }
    const want = String(hit.no)
    if (fold(current) === '') return { patch: { ...patch, chapter_no: want }, offer: null }
    // Numbers compare as numbers on the way to "do these agree": 42 and "42.0"
    // are one chapter, and a string compare would offer a chip that changes
    // nothing visible.
    if (Number(String(current).trim()) === Number(want)) return { patch, offer: null }
    return { patch, offer: { field: 'chapter_no', value: want } }
  }
  const patch = { chapter_no: typed }
  // Numbers compare as numbers: "42", "42.0" and 42 are one chapter, and a string
  // compare would offer the name for one spelling of it and not the others.
  const want = Number(String(typed).trim())
  if (!Number.isFinite(want) || String(typed).trim() === '') return { patch, offer: null }
  const hit = rows.find((r) => Number(r.no) === want && String(r.name || '').trim())
  if (!hit) return { patch, offer: null }
  const name = String(hit.name).trim()
  if (fold(current) === '') return { patch: { ...patch, chapter: name }, offer: null }
  if (fold(current) === fold(name)) return { patch, offer: null }
  return { patch, offer: { field: 'chapter', value: name } }
}
