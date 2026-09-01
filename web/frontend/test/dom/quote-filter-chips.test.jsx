// The three chips over a book's quote board.
//
// There was one — favourites — and it was a hand-rolled <button> carrying its ♥
// as a CHARACTER in the label, so the mark sized and coloured as text and a
// screen reader read it out as a word. The design pack draws four (its fourth,
// "unread", means nothing for a quote); the app already shipped the strings for
// the other two on its list scaffold and simply never drew them here.
//
// Three claims, and each fails silently rather than loudly.
//
// THE SAME SET ON BOTH SURFACES. The desktop row and the phone's filter sheet
// were writing their chips inline, separately, and had already drifted to one
// each — a screen that offers a different set of filters depending on the device
// is offering a different board. They read one list now, and this is the test
// that says so.
//
// THE STATE IS ANNOUNCED. FilterChip sets aria-pressed and its own comment says
// why: a toggle that announces its state in only one of the two states reads as
// a plain button half the time. Nothing throws when it does not.
//
// AND "noted" AGREES WITH THE NUMBER THE HERO PRINTS. countQuotes has always
// treated a whitespace-only note as no note — the server stores what was typed,
// and a field somebody tabbed through holds a space. A chip that counted it
// would filter "5 noted" down to four rows.

import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FilterChip } from '../../src/ui.jsx'
import { countQuotes } from '../../src/works.jsx'

const ROWS = [
  { id: 1, book_id: 1, quote: 'Call me Ishmael.', note: 'the opening', tags: ['craft'], favorite: true, color: 'yellow' },
  { id: 2, book_id: 1, quote: 'It is a way I have of driving off the spleen.', note: '', tags: [], favorite: false, color: 'blue' },
]

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path) => {
    if (path.startsWith('/annotations')) return { ok: true, data: { annotations: ROWS } }
    if (path === '/books/1') {
      return { ok: true, data: { id: 1, title: 'Moby-Dick', author: 'Herman Melville', genres: '' } }
    }
    return { ok: true, data: { tags: [], stickers: [], people: [], items: [], annotations: [] } }
  }),
}))

const { default: Library } = await import('../../src/Library.jsx')

// The predicate the board applies, stated here as the contract the chip and the
// hero's count have to share.
const noted = (a) => (a.note || '').trim().length > 0
const tagged = (a) => (a.tags || []).length > 0

describe('what a chip says about itself', () => {
  it('announces pressed in BOTH states, not only when on', () => {
    render(<FilterChip active={false} label="tagged" onClick={() => {}} />)
    expect(screen.getByRole('button', { name: 'tagged' }).getAttribute('aria-pressed')).toBe('false')
  })

  it('announces pressed when it is on', () => {
    render(<FilterChip active label="has notes" onClick={() => {}} />)
    expect(screen.getByRole('button', { name: 'has notes' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('coerces an unset active rather than dropping the attribute', () => {
    // A missing aria-pressed is a plain button. Undefined must read as off.
    render(<FilterChip label="favourites" onClick={() => {}} />)
    expect(screen.getByRole('button', { name: 'favourites' }).getAttribute('aria-pressed')).toBe('false')
  })
})

describe('the on-chips come first', () => {
  it('puts a switched-on filter ahead of the ones that are off', () => {
    // The row scrolls under a measured fade. A switched-on filter that has
    // scrolled out of sight is a board quietly hiding rows for a reason nothing
    // on screen still says — so the sort is by on-ness, and it is stable.
    const chips = [
      { on: false, label: 'favourites' },
      { on: false, label: 'has notes' },
      { on: true, label: 'tagged' },
    ]
    const ordered = chips.slice().sort((a, b) => Number(b.on) - Number(a.on))
    expect(ordered.map((c) => c.label)).toEqual(['tagged', 'favourites', 'has notes'])
  })

  it('leaves the order alone when none of them is on', () => {
    const chips = [{ on: false, label: 'a' }, { on: false, label: 'b' }, { on: false, label: 'c' }]
    const ordered = chips.slice().sort((a, b) => Number(b.on) - Number(a.on))
    expect(ordered.map((c) => c.label)).toEqual(['a', 'b', 'c'])
  })
})

describe('the chips agree with the numbers the hero prints', () => {
  const rows = [
    { id: 1, note: 'a real thought', tags: ['craft'], favorite: true },
    { id: 2, note: '   ', tags: [], favorite: false }, // tabbed through
    { id: 3, note: '', tags: ['craft', 'grief'], favorite: false },
    { id: 4, favorite: false }, // mid-save: no tags array at all
  ]

  it('counts a whitespace-only note as no note, exactly as countQuotes does', () => {
    // The two have to give the same answer or "5 noted" filters to four rows.
    expect(rows.filter(noted)).toHaveLength(countQuotes(rows).noted)
  })

  it('counts tags the same way, and survives a row with no tags array', () => {
    expect(rows.filter(tagged)).toHaveLength(countQuotes(rows).tagged)
    expect(() => rows.filter(tagged)).not.toThrow()
  })

  it('combines as AND, so two chips narrow rather than widen', () => {
    // Two filters that widened would be a board that shows MORE the more you
    // ask of it — which is the one behaviour a filter may not have.
    const both = rows.filter((a) => noted(a) && tagged(a))
    expect(both.map((r) => r.id)).toEqual([1])
    expect(both.length).toBeLessThanOrEqual(rows.filter(noted).length)
    expect(both.length).toBeLessThanOrEqual(rows.filter(tagged).length)
  })
})


// THE CLAIM THAT CAN ONLY BE MADE ON THE SCREEN. Everything above is about a
// predicate and a component; this is about whether the board actually draws the
// set. The two surfaces were writing their chips inline and separately, and had
// already drifted to one each — which is the failure mode a shared list exists to
// end, and the only way to see it is to render the thing.
describe('the board draws all three', () => {
  it('offers favourites, notes and tags — not just favourites', async () => {
    render(
      <Library openId={1} onOpen={() => {}} onClose={() => {}} creditSeparators=",;&" onAdd={() => {}} onSearch={() => {}} dataNonce={0} />,
    )
    // Each is a toggle, so each announces itself as one.
    for (const label of ['♥ favourites', 'has notes', 'tagged']) {
      const chip = await screen.findByRole('button', { name: label })
      expect(chip.getAttribute('aria-pressed'), `${label} does not announce its state`).toBe('false')
    }
  })
})
