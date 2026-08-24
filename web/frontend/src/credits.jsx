// credits.jsx — the person primitives, with no screen attached.
//
// A name, its portrait, the map of saved people, and the rule for splitting a
// joined credit into the people in it. Everything here is used BY a screen and
// depends on none: React, api.js, nothing else.
//
// IT WAS ALL IN people.jsx, WHICH IS ALSO A SCREEN — the metadata panel, its
// form, its merge flow. That was fine until the quiz card wanted portraits on
// its options and the person panel wanted a button that opens a quiz. Those two
// wants are a cycle (review.jsx needs a portrait; people.jsx needs a round), and
// the cycle is real rather than accidental: a card credits a person, and a
// person is worth being asked about.
//
// So the half that everything needs moved down here, and people.jsx re-exports
// it — every existing caller still imports these names from people.jsx, because
// that is where a reader looks for them and a re-export costs nothing. What
// changed is that review.jsx can import the portrait without importing the
// panel.
import { useEffect, useState } from 'react'
import { coverImgURL, json } from './api.js'

export function personImgURL(path) {
  return coverImgURL(path)
}

// ---- multi-author credit splitting (ROADMAP §11) ----
// parseCreditSeps / splitCredits mirror internal/metadata/credits.go — keep
// the two in LOCKSTEP; the Go table in credits_test.go is the source of truth.
// A credit stays stored verbatim ("Gaiman & Pratchett"); only people-derived
// views (group-by headings, the People console, person links) split it.

export const DEFAULT_CREDIT_SEPS = { comma: true, semicolon: true, amp: true, and: true }

// parseCreditSeps reads the creditSeparators preference: a comma-separated
// token list from {comma, semicolon, amp, and}, or "none". Empty/unknown-only
// falls back to the default set.
export function parseCreditSeps(pref) {
  const v = String(pref || '').trim()
  if (!v) return DEFAULT_CREDIT_SEPS
  if (v.toLowerCase() === 'none') return { comma: false, semicolon: false, amp: false, and: false }
  const seps = { comma: false, semicolon: false, amp: false, and: false }
  let seen = false
  for (const tok of v.split(',')) {
    const t = tok.trim().toLowerCase()
    if (t in seps) {
      seps[t] = true
      seen = true
    }
  }
  return seen ? seps : DEFAULT_CREDIT_SEPS
}

// ROMAN NUMERALS ARE NOT IN HERE, and their absence is the decision. This set has
// to match internal/metadata/credits.go exactly — the two split the same strings and
// a disagreement about what a component IS shows up as a rename that touches one
// side and not the other.
//
// It used to carry ii/iii/iv/v for "Henry Ford II". The cost appeared the moment
// characters were split the same way: "V" is a real character name, so a dialogue
// line stored as "Evey, V" had its second speaker swallowed onto the first and came
// out as one label nobody could remap. A single letter is a plausible name and a
// terrible suffix.
//
// Numbers take their place: a bare number, with or without an ordinal ending, is a
// generational marker rather than a person. It cannot collide with a name.
//
// The consequence, stated rather than discovered: "Henry Ford, II" now splits in two.
// That is the right way round — a wrongly-split credit is visible and fixable, a
// wrongly-merged one hides a whole person.
const CREDIT_SUFFIXES = new Set([
  'jr', 'jr.', 'sr', 'sr.',
  'inc', 'inc.', 'ltd', 'ltd.', 'llc', 'llc.', 'co', 'co.',
])
// 2, 2nd, 3rd, 4th, with an optional trailing dot. Anchored, so "2 Fast 2 Furious"
// is not a suffix.
const CREDIT_NUMBER_SUFFIX_RE = /^[0-9]+(st|nd|rd|th)?\.?$/
const isCreditSuffix = (low) => CREDIT_SUFFIXES.has(low) || CREDIT_NUMBER_SUFFIX_RE.test(low)
const CREDIT_AND_RE = /\s+and\s+/i
const CREDIT_LEADING_AND_RE = /^and\s+/i
const MAX_CREDIT_COMPONENTS = 8

function splitCreditAnd(p, listCtx) {
  p = p.trim()
  if (!p) return []
  if (listCtx) {
    // Oxford comma: ", and Lee" comma-splits into a leading-"and" token the
    // infix regex below can't reach — strip the joiner first.
    p = p.replace(CREDIT_LEADING_AND_RE, '').trim()
    if (!p) return []
  }
  const parts = p.split(new RegExp(CREDIT_AND_RE.source, 'gi'))
  if (parts.length < 2) return [p]
  if (!listCtx) {
    // Outside list context both sides must look like full names (≥ 2 words) —
    // "Daniels and Sons" / "William and Mary" stay whole.
    for (const q of parts) {
      if (q.trim().split(/\s+/).filter(Boolean).length < 2) return [p]
    }
  }
  return parts
}

// splitCredits splits a joined credit into individual names using the enabled
// separators; a verbatim single name passes through as [name], '' as [].
// Whitespace normalizes first (JS \s is Unicode-aware) to stay in lockstep
// with Go's strings.Fields normalization.
export function splitCredits(s, seps = DEFAULT_CREDIT_SEPS) {
  const t = String(s || '').trim().replace(/\s+/g, ' ')
  if (!t) return []
  if (!seps.comma && !seps.semicolon && !seps.amp && !seps.and) return [t]

  let listCtx = false
  let parts = [t]
  const splitOn = (list, sep) => list.flatMap((p) => p.split(sep))
  if (seps.comma && t.includes(',')) {
    listCtx = true
    parts = splitOn(parts, ',')
  }
  if (seps.semicolon && t.includes(';')) {
    listCtx = true
    parts = splitOn(parts, ';')
  }
  if (seps.amp && t.includes('&')) {
    listCtx = true
    parts = splitOn(parts, '&')
  }
  if (seps.and) parts = parts.flatMap((p) => splitCreditAnd(p, listCtx))

  const merged = []
  for (let p of parts) {
    p = p.trim()
    if (!p) continue
    const low = p.toLowerCase()
    if (low === 'et al' || low === 'et al.') continue
    if (isCreditSuffix(low) && merged.length > 0) {
      merged[merged.length - 1] += ', ' + p
      continue
    }
    merged.push(p)
  }

  const seen = new Set()
  const out = []
  for (const p of merged) {
    const k = p.toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    out.push(p)
    if (out.length === MAX_CREDIT_COMPONENTS) break
  }
  return out.length ? out : [t]
}

// usePeople loads every saved metadata row for a kind ('author'|'actor') and
// returns a name→row map (for group-by portraits + quick presence checks) plus
// a reload to call after a save/delete.
// A FALSY KIND FETCHES NOTHING, and returns an empty map. Hooks cannot be called
// conditionally, so a caller whose kind depends on what it is rendering — a cast
// panel that wants actors for a film and has no second column on a book — either
// asks a question with no answer or says nothing, and this is how it says nothing.
export function usePeople(kind) {
  const [map, setMap] = useState({})
  async function reload() {
    if (!kind) return
    const r = await json('GET', `/people?kind=${kind}`)
    if (r.ok) setMap(Object.fromEntries((r.data.people || []).map((p) => [p.name, p])))
  }
  useEffect(() => {
    if (!kind) {
      setMap({})
      return
    }
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind])
  return { map, reload }
}

// PersonPortrait — the small round portrait for a group-by heading (renders
// nothing when there's no saved image).
export function PersonPortrait({ person, size = 30 }) {
  if (!person?.image_path) return null
  return (
    <img
      src={personImgURL(person.image_path)}
      alt=""
      style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--ink-border)', flex: 'none' }}
    />
  )
}
