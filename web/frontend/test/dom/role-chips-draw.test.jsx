// A ROLE MARK DRAWS THE ROLE'S OWN GLYPH, AND NO TWO ROLES SHARE ONE.
//
// IT WAS A CHIP WITH ITS WORD BESIDE IT AND IS A MARK ALONE, which is the owner's
// row spec landing: "Row2: work and quote counts (as is) • role (e.g. author)
// icons. The icon will be explained in the person popup." The roomy half of the
// count rule moved to the panel, where a reader meets the legend; the row is the
// tight half and draws the glyph only. The word did not disappear — it is the
// mark's accessible name and its tooltip, which is the half of that rule that
// never moves.
//
// WHY THIS FILE EXISTS, AND IT IS THE RATER'S FINDING RATHER THAN A HUNCH. The
// commit that gave the eight roles their drawings shipped with NOTHING holding
// them. Two mutations were run against it in a scratch worktree and both survived
// the whole suite, 3,557 tests, with output identical to baseline:
//
//   1. publisher put back to the studio light — re-creating, exactly, the defect
//      the change exists to remove — and the chip's glyph blanked;
//   2. every rewired call site reverted to the old circular arrow.
//
// `icons.test.jsx` and `icons-fill.test.jsx` look at the EXPORT SET: that every
// glyph is distinct, hidden, and at one weight. Neither knows whether a role chip
// renders one, or which. So the set was guarded and the thing the owner actually
// asked for — "role (e.g. author) icons", eight of them, telling eight roles apart
// — was not.
//
// THE ASSERTION IS DISTINCTNESS AND PRESENCE, NEVER A PATH. `person-modal-icons`
// argues the case for not pinning a drawing's identity, and it is right: pinning
// one makes every redraw a test edit. But which-glyph-is-which is not a drawing's
// identity. The owner named eight roles and chose eight pictures BECAUSE four of
// them had been sharing two, so "these two chips draw different things" is the
// fact, and it survives any future redrawing of either.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

let RECORDS

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path, body) => {
    if (method === 'GET' && path === '/people/records') return { ok: true, data: { people: RECORDS } }
    if (method === 'POST' && path === '/people/portrait') return { ok: true, data: { person: null, links: {} } }
    return { ok: true, data: {} }
  }),
}))

const { PeopleConsole } = await import('../../src/MetadataPage.jsx')

const rec = (id, name, kinds) => ({
  id, name, sort_name: '', bio: '', image_path: '', born: '', died: '', links: '',
  source: '', source_id: '', kinds, spellings: [], works: 0, quotes: 0,
})

// ONE ROW PER ROLE, so every one of the eight is on screen at once and the
// comparison below is over the whole set rather than over a pair.
//
// THE NAMES DO NOT CONTAIN THE ROLE WORD, and the first cut's did — "Person
// author", which then matched both the row's name and the role chip beside it, so
// every lookup in this file found two elements and every case died in setUp
// rather than on its assertion.
const ROLES = ['author', 'actor', 'director', 'studio', 'publisher', 'speaker', 'translator', 'editor']
const WHO = { author: 'Ama', actor: 'Bex', director: 'Cyd', studio: 'Dot',
  publisher: 'Eli', speaker: 'Fen', translator: 'Gus', editor: 'Hal' }

beforeEach(() => {
  RECORDS = ROLES.map((k, i) => rec(i + 1, WHO[k], [k]))
})
afterEach(() => cleanup())

const mount = async () => {
  render(<PeopleConsole onFlash={() => {}} onSearch={() => {}} />)
  await screen.findByText(WHO.author)
}
const row = (name) => screen.getByText(name).closest('.record-row')
// The mark is located by the NAME it answers to, which is the role's word — what a
// reader hears, what a hover says, and what survives the next change of chrome.
// Not by a class: a class is this file knowing what the code is.
const chipGlyph = (r, word) => {
  const mark = [...r.querySelectorAll('[aria-label], [title]')].find(
    (n) => (n.getAttribute('aria-label') || n.getAttribute('title') || '').trim().toLowerCase() === word
      && n.querySelector('svg'),
  )
  return mark ? mark.querySelector('svg') : null
}

describe('the role chips', () => {
  it('draw a glyph, every one of the eight', async () => {
    await mount()
    const missing = []
    for (const k of ROLES) {
      const g = chipGlyph(row(WHO[k]), k)
      if (!g || g.querySelectorAll('path, circle, rect, line, polyline, g').length === 0) missing.push(k)
    }
    expect(missing, 'a role chip with no drawing in it').toEqual([])
  })

  it('and no two roles draw the same picture', async () => {
    await mount()
    // THE PAIR THAT MATTERS MOST IS studio/publisher: they shared one company mark
    // before this, and they are the two a reader is likeliest to meet in one list —
    // a film has both. But the check is over all eight, because the defect was
    // never about one pair; it was about a column answering eight questions with
    // four answers.
    const seen = new Map()
    const clashes = []
    for (const k of ROLES) {
      const g = chipGlyph(row(WHO[k]), k)
      // A CONSTANT FOR THE MISSING CASE, NOT THE ROLE'S NAME. Keyed on `(none: k)`
      // every blank was unique, so a run with EVERY glyph deleted read as eight
      // distinct pictures and this case passed — the presence case above caught it,
      // but a case that only works because its neighbour does is a case that will
      // be wrong the first time the neighbour changes.
      const art = g ? g.innerHTML : '(nothing drawn)'
      if (seen.has(art)) clashes.push(`${seen.get(art)} and ${k}`)
      else seen.set(art, k)
    }
    expect(clashes, 'two roles drawn alike').toEqual([])
  })

  it('and the word is still SAID, even though it is no longer drawn', async () => {
    await mount()
    // The roomy half of the count rule: the glyph is learnable only because the
    // noun is printed next to it. A future change to the glyph-only form belongs
    // on rows already carrying buttons and facts, not here, and would have to
    // move this case deliberately rather than by accident.
    // A GLYPH ALONE IS A PICTURE TO A SCREEN READER AND NOTHING AT ALL. The row
    // stopped PAINTING the noun when the owner's spec moved the legend to the
    // panel; it must never stop saying it. Case-folded, because the capital is
    // the locale's and the stylesheet's to choose — asserting it would make this
    // a test of the wording rather than of the word being there, which is how it
    // failed once already on "translator".
    for (const k of ROLES) {
      const said = [...row(WHO[k]).querySelectorAll('[aria-label], [title]')]
        .some((n) => (n.getAttribute('aria-label') || n.getAttribute('title') || '').trim().toLowerCase() === k)
      expect(said, `${k} is drawn but never named`).toBe(true)
    }
  })
})
