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
