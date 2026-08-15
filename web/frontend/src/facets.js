// facets.js — the `field:value` grammar, and it lives here alone.
//
// ONE PARSER, NOT TWO. The box understands `tag:stoicism`; the server never
// sees a colon. Choosing a value lifts the token out of the box and into a chip,
// and the chip goes on the wire as `&tag=stoicism`.
//
// A grammar the client parses for chips and the server re-parses for SQL is a
// grammar that drifts, and the drift does not announce itself: it shows up as a
// query that RENDERS one way and MATCHES another, which is the hardest kind of
// wrong to notice because both halves look right on their own. Keeping the
// syntax entirely on this side means the API stays typed and a malformed facet
// is impossible to send rather than merely rejected.
//
// Everything here is strings in, values out — no React, no fetch — so it loads
// in the `pure` test project and the grammar can be tested without a browser.

import { editBudget, editDistance, foldText } from './text.js'

// The fields you can name, and where the dropdown gets their values.
//
// `combine` is documentation rather than behaviour, and it is written down
// because it is the rule readers will ask about: two tags INTERSECT (narrowing
// by a second tag is a real question), two colours UNION (a quote has one
// colour, so ANDing them asks for something nothing is). The server owns the
// rule; this is the copy the help screen quotes.
export const FACET_FIELDS = [
  { name: 'tag', vocab: 'tags', combine: 'and' },
  { name: 'colour', vocab: 'colours', combine: 'or' },
  { name: 'author', vocab: 'authors', combine: 'or' },
  { name: 'speaker', vocab: 'speakers', combine: 'or' },
  { name: 'actor', vocab: 'actors', combine: 'or' },
  { name: 'director', vocab: 'directors', combine: 'or' },
  { name: 'genre', vocab: 'genres', combine: 'and' },
  { name: 'series', vocab: 'series', combine: 'or' },
  { name: 'shelf', vocab: 'shelves', combine: 'or' },
  { name: 'year', vocab: 'year', combine: 'or' },
  { name: 'favourite', vocab: 'yesno', combine: 'or' },
  { name: 'note', vocab: 'yesno', combine: 'or' },
  { name: 'wishlist', vocab: 'yesno', combine: 'or' },
  // One work, by id. Seeded by a search started from a work's own page and
  // never typed: there is no vocabulary of titles to offer, and the value is an
  // id rather than the title the chip shows.
  { name: 'book', vocab: null, combine: 'or' },
  { name: 'movie', vocab: null, combine: 'or' },
]

export const FACET_NAMES = FACET_FIELDS.map((f) => f.name)

export function facetField(name) {
  const n = String(name || '').toLowerCase()
  return FACET_FIELDS.find((f) => f.name === n) || null
}

// A known field name followed by a colon, at a word boundary. Case-insensitive,
// because `Tag:` is the same request as `tag:` and correcting the reader's
// shift key is not the job.
const FIELD_RE = new RegExp(`(?:^|\\s)(${FACET_NAMES.join('|')}):`, 'gi')

// readFacetDraft finds the facet being typed: the LAST `field:` in the box, and
// everything after it.
//
// EVERYTHING AFTER IT, and that is the deliberate part. Splitting on whitespace
// would be the obvious way to find "the current token", and it would make
// `author:Le Guin` unreachable — the moment you typed the space, `Guin` would
// become a new word and the draft would be `author:Le`. Since choosing a value
// immediately lifts the whole thing out of the box, a draft running to the end
// costs nothing: there is never text after it that you wanted to keep.
//
// Returns null when nothing is being typed as a facet, in which case the box is
// ordinary free text and goes to the server as `q`.
export function readFacetDraft(text) {
  const s = String(text || '')
  let last = null
  FIELD_RE.lastIndex = 0
  let m
  while ((m = FIELD_RE.exec(s)) !== null) last = m
  if (!last) return null
  // The match may have eaten a leading space; the field starts after it.
  const start = last.index + last[0].length - last[1].length - 1
  return {
    field: last[1].toLowerCase(),
    value: s.slice(last.index + last[0].length),
    start,
  }
}

// liftFacet removes the draft from the box, leaving whatever free text preceded
// it. This is the "lifts the token out of the box into a chip" half — the chip
// itself is the caller's business.
export function liftFacet(text, draft) {
  if (!draft) return text
  return String(text || '').slice(0, draft.start).replace(/\s+$/, '')
}

// The two vocabularies that do not come from the server, because they are not
// facts about a library.
const YES_NO = [
  { value: 'yes', label: 'yes' },
  { value: 'no', label: 'no' },
]

// facetOptions is every value a field could take, before narrowing.
//
// Colours arrive as {key, name} and stay that way: the chip has to read
// `colour:doubt` while the query sends `blue`, because 1.7.1 made the six slots
// user-named and showing the storage word would be showing the reader a word
// they deliberately renamed.
//
// `year` has no vocabulary and cannot have one — the server does not enumerate
// them and a library spans centuries. So it offers back whatever number you
// typed, which turns the dropdown into a confirmation rather than a list.
export function facetOptions(field, vocabulary = {}, typed = '') {
  const spec = facetField(field)
  if (!spec || !spec.vocab) return []
  if (spec.vocab === 'yesno') return YES_NO
  if (spec.vocab === 'year') {
    const n = String(typed || '').trim()
    return /^-?\d{1,4}$/.test(n) ? [{ value: n, label: n }] : []
  }
  const raw = vocabulary[spec.vocab] || []
  if (spec.vocab === 'colours') {
    return raw.map((c) => ({ value: c.key, label: c.name || c.key }))
  }
  return raw.map((v) => ({ value: v, label: v }))
}

// bestDistance is the edit distance from `q` to the closest of: the whole
// option, or any single word of it. Per-word matters for names — "guin" is two
// edits from "ursula k. le guin" as a whole string and zero from its last word.
function bestDistance(folded, q) {
  let best = editDistance(q, folded)
  for (const w of folded.split(/\s+/)) {
    const d = editDistance(q, w)
    if (d < best) best = d
  }
  return best
}

// narrowFacetOptions filters and RANKS the options against what has been typed.
//
// AN EXACT PREFIX NEVER LOSES TO A FUZZY MATCH ON A DIFFERENT WORD. That is the
// whole reason this ranks rather than filters. Typing "de" over a library
// holding both "death" and "dawn" must offer death first; a flat
// "within one edit" test would rate "dawn" (one edit from "de"… no — two, but
// "de" vs "do" would) as equal to a word that literally starts with what you
// typed. Ranking makes the guarantee unconditional instead of accidental.
//
// Rank 0 is a prefix, of the whole option or of any word in it. Rank 1 is a
// substring anywhere. Rank 2 is within the typo budget. Sort is stable, so
// options at the same rank keep the vocabulary's own order — which is
// alphabetical, because the server sorted it.
export function narrowFacetOptions(options, typed, limit = 8) {
  const q = foldText(typed)
  if (!q) return options.slice(0, limit)
  const budget = editBudget(q.length)
  const ranked = []
  for (const o of options) {
    const f = foldText(o.label)
    let rank = -1
    let dist = 0
    if (f.startsWith(q) || f.split(/\s+/).some((w) => w.startsWith(q))) rank = 0
    else if (f.includes(q)) rank = 1
    else if (budget > 0) {
      const d = bestDistance(f, q)
      if (d <= budget) {
        rank = 2
        dist = d
      }
    }
    if (rank >= 0) ranked.push({ o, rank, dist })
  }
  ranked.sort((a, b) => a.rank - b.rank || a.dist - b.dist)
  return ranked.slice(0, limit).map((r) => r.o)
}

// ---- the active chips ------------------------------------------------------
//
// A chip is {field, value, label}. `value` goes on the wire, `label` is what the
// reader sees — the two differ only for colours, and that difference is the
// entire reason the vocabulary endpoint returns pairs.

export function makeChip(field, option) {
  return { field, value: option.value, label: option.label ?? option.value }
}

export function chipText(chip) {
  return `${chip.field}:${chip.label}`
}

// sameChip compares by field and WIRE VALUE, never by label. Two colour chips
// for the same slot are the same chip even if the reader renamed the slot
// between them.
export function sameChip(a, b) {
  return a.field === b.field && a.value === b.value
}

export function addChip(chips, chip) {
  return chips.some((c) => sameChip(c, chip)) ? chips : [...chips, chip]
}

export function removeChipAt(chips, i) {
  return chips.filter((_, j) => j !== i)
}

// facetParams turns the chips into the query parameters /search takes. Repeated
// names are how a multi-valued facet is expressed, which is why this returns
// pairs rather than an object.
export function facetParams(chips = []) {
  return chips.map((c) => [c.field, c.value])
}

// ---- seeding from where you were -------------------------------------------
//
// A search started from a shelf should search the shelf. The Library already
// computes the scope for this (searchScope in routes.js); what it could not
// carry was the FILTERS — the board knew it was showing you reading, Fantasy,
// Earthsea, and the search it opened knew none of it.
//
// The channel is a module-level variable rather than React state, and that is
// on purpose. The shell reads it at the moment Search is pressed and at no
// other time, so putting it in state would re-render the whole shell on every
// keystroke in a filter field to deliver a value nobody is looking at yet.
//
// The board publishes on change and CLEARS ON UNMOUNT. A stale seed is worse
// than none: pressing Search from Stats and arriving with the Library's shelf
// chip still up would narrow a search to a board you had already left.
let searchSeed = []

export function publishSearchSeed(chips) {
  searchSeed = Array.isArray(chips) ? chips : []
}

export function takeSearchSeed() {
  return searchSeed
}

// boardSeedChips maps a board's filter state onto the facets that mean the same
// thing. Only the ones that translate EXACTLY are here.
//
// `tagged`, `noted` and `mediaType` are deliberately absent, and the reason is
// worth writing down because their absence looks like an oversight. A board's
// "noted" means "this BOOK has a highlight carrying a note" — a property of the
// work, derived from its children. The `note:` facet means "this QUOTE has a
// note", which is a property of the child. Seeding one from the other would
// send `note=yes` with books in scope, and since a book has no note column that
// facet empties the books section: press Search on a filtered board and get
// nothing back. Half a mapping that is right beats a whole one that is wrong.
export function boardSeedChips({ genre, series, fav, states, wish } = {}) {
  const chips = []
  if (genre) chips.push({ field: 'genre', value: genre, label: genre })
  if (series) chips.push({ field: 'series', value: series, label: series })
  if (fav) chips.push({ field: 'favourite', value: 'yes', label: 'yes' })
  for (const s of states || []) if (s) chips.push({ field: 'shelf', value: s, label: s })
  // The board's third state, "annotated", is the wishlist's complement rather
  // than a thing of its own.
  if (wish === 'wishlist') chips.push({ field: 'wishlist', value: 'yes', label: 'yes' })
  else if (wish === 'annotated') chips.push({ field: 'wishlist', value: 'no', label: 'no' })
  return chips
}

// workSeedChip is what a search started from a work's own page narrows to. The
// chip SHOWS the title and SENDS the id, because a title is not unique and an id
// is — the same split colours use, for the same reason.
export function workSeedChip(type, id, title) {
  if (!id) return null
  const field = type === 'movie' ? 'movie' : 'book'
  return { field, value: String(id), label: title || `#${id}` }
}

// searchQueryString assembles the whole request: free text, scope, then a
// parameter per chip. One place, so the debounce effect and any future caller
// cannot build subtly different URLs for the same screen state.
export function searchQueryString({ q = '', scope = 'all', chips = [] } = {}) {
  const p = new URLSearchParams()
  const text = String(q || '').trim()
  if (text) p.set('q', text)
  p.set('scope', scope)
  for (const [k, v] of facetParams(chips)) p.append(k, v)
  return p.toString()
}
