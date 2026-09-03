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
import { useEffect, useRef, useState } from 'react'
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

// useCharacterFaces — the same shape as usePeople, for the other identity table.
//
// A CHARACTER IS NOT A PERSON HERE, which is the whole reason this exists beside
// the hook above rather than as a fifth `kind` passed to it. 0056 gave characters
// their own table: a book has characters and no actors, one character is played by
// several actors across adaptations, and a character's picture is a still from a
// work rather than a headshot — so it is stored under the COVER root and read with
// `coverImgURL`, where a person's goes through `personImgURL`. Two tables, two
// roots, two hooks.
export function useCharacterFaces() {
  const [map, setMap] = useState({})
  useEffect(() => {
    let alive = true
    json('GET', '/characters').then((r) => {
      if (!alive || !r.ok) return
      // Keyed by NAME, like usePeople, because that is what a stats row carries —
      // the breakdown counts a character's quotes by the name on the line, and has
      // no id to hand back.
      setMap(Object.fromEntries((r.data.characters || []).map((c) => [c.name, c])))
    })
    return () => { alive = false }
  }, [])
  return map
}

// usePortraitFill — the portraits a screen is about to draw, fetched because it
// is about to draw them.
//
// THE COMPLAINT: "people images are not auto fetched still and needs to be
// manually fetched." Which was the literal truth. `POST /people/portrait` has
// existed for many releases and resolves an actor's headshot from the cast row
// the library already holds — but the only thing that ever called it was
// PersonModal's own effect, which runs when you OPEN one person. So a film with
// twenty credits needed twenty panels opened by hand before its board had twenty
// faces, and an author's shelf heading stayed blank until somebody went looking
// for the author. The route was right and nothing was asking.
//
// THIS IS useCharacterArt'S ARGUMENT, applied to the other picture (cast.jsx). A
// work's page already holds the names it is about to draw and the map saying who
// has a stored portrait, so it can tell — with no request at all — whether there
// is anything to do. When there is not, this costs nothing.
//
// SERIAL AND CAPPED, for the reason twenty of anything is: a self-hosted box
// should not open twenty outbound connections because somebody opened a film.
// Twenty is metadata.maxCast, the largest a provider seed can be.
//
// ASKED ONCE PER NAME PER MOUNT, tracked in a ref rather than inferred from the
// map. The obvious version — "ask for everyone the map has no picture for" —
// re-asks on every render for the people who HAVE no findable portrait, which is
// most minor credits, for ever. A name is attempted once and then left alone
// whether it resolved or not; re-opening the page is how you retry.
//
// `onFilled` fires once, after the last one lands, and only if something actually
// arrived — a reload that changes nothing is a request and a re-render for free.
const PORTRAIT_FILL_CAP = 20

export function usePortraitFill(kind, names, people, onFilled) {
  const asked = useRef(null)
  if (asked.current === null) asked.current = new Set()
  useEffect(() => {
    if (!kind) return undefined
    const want = []
    for (const raw of names || []) {
      const name = String(raw || '').trim()
      if (!name || asked.current.has(name) || people?.[name]?.image_path) continue
      want.push(name)
      if (want.length >= PORTRAIT_FILL_CAP) break
    }
    if (want.length === 0) return undefined
    // MARKED BEFORE THE AWAIT, not after: a re-render while the loop is in flight
    // would otherwise start a second loop over the same names.
    for (const n of want) asked.current.add(n)
    let live = true
    ;(async () => {
      let got = 0
      for (const name of want) {
        if (!live) return
        const r = await json('POST', '/people/portrait', { kind, name })
        if (r.ok && r.data?.image) got += 1
      }
      if (live && got) onFilled?.()
    })()
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, names, people])
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

// ---- the face cluster --------------------------------------------------
//
// MOVED HERE FROM people.jsx, for the reason that file was split for: the quiz
// card wants a cluster, people.jsx is a SCREEN, and review.jsx importing it
// would close a cycle. These three depend on PersonPortrait above and nothing
// else, which is the test for whether something belongs in this file.

// CreditFaces — the round-portrait chip for a credit line, sized like a book's
// author face. When a credit names more than one person (co-authors, a film's
// director + creator), the portraits OVERLAP like set intersections with the
// FIRST credited name on top; a ring in the surface colour cuts each disc out
// from the one beneath so the overlap reads as stacked, not merged. Only names
// with a saved photo appear, and it renders nothing when none do. `names` takes
// a single name or an array; `map` is the usePeople name→row map; `ring` must
// match the surface the chip sits on (a lone disc then shows no visible ring).
export function CreditFaces({ names, map = {}, size = 24, ring = 'var(--bg)', className = '' }) {
  const list = Array.isArray(names) ? names : names ? [names] : []
  const people = list.map((n) => map?.[n]).filter((p) => p?.image_path)
  return <FaceStack paths={people.map((p) => p.image_path)} size={size} ring={ring} className={className} />
}

// CharacterFaces — the same cluster, for the CHARACTERS on a quote rather than
// the people who play them (0050). One entry per character on the line that has a
// stored picture, in the order the line names them, so the first speaker is on
// top exactly as the first credited name is.
//
// Takes {name, path} pairs off the row rather than a name→row map, because a
// character's picture belongs to ONE WORK: the same name in two films is two
// pictures, and a map keyed by name alone could not hold both. The server
// resolves the pair (see cast_images.go) because the match needs a fold SQLite
// cannot do and the client should not implement twice.
export function CharacterFaces({ images = [], size = 24, ring = 'var(--bg)', className = '' }) {
  return (
    <FaceStack
      paths={(images || []).map((c) => c?.path).filter(Boolean)}
      size={size}
      ring={ring}
      className={className}
    />
  )
}

// FaceStack is the overlap itself, shared so the actor cluster and the character
// cluster cannot drift apart: portraits overlap like set intersections with the
// FIRST one on top, and a ring in the surface colour cuts each disc out of the one
// beneath so the overlap reads as stacked rather than merged. Nothing renders when
// there is nothing to show.
function FaceStack({ paths = [], size = 24, ring = 'var(--bg)', className = '' }) {
  if (paths.length === 0) return null
  const overlap = Math.round(size * 0.34)
  return (
    <span className={('inline-flex items-center ' + className).trim()} style={{ flex: 'none' }}>
      {paths.map((path, i) => (
        <span
          key={path + i}
          style={{
            position: 'relative',
            marginLeft: i === 0 ? 0 : -overlap,
            zIndex: paths.length - i, // the first one sits on top
            borderRadius: '50%',
            boxShadow: `0 0 0 2px ${ring}`,
            lineHeight: 0,
          }}
        >
          <PersonPortrait person={{ image_path: path }} size={size} />
        </span>
      ))}
    </span>
  )
}
