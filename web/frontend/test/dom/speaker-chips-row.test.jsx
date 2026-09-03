// A CHIP PER CHARACTER NAMED ON A LINE, and the row that scrolls when they
// do not fit.
//
// WHAT THIS REPLACES, in the words of the code it replaces. A line with one
// resolvable speaker drew one chip; an ensemble line — several characters, which
// the linker deliberately refuses to guess between — drew a row of small
// FACELESS DISCS instead, and the comment beside it said so: "an ensemble line
// names several characters, the linker refuses to guess between them, and then
// this row is the only thing saying who is in it." A stack of discs says how MANY
// people are in a line and not one of their names, which is the one thing a
// reader wants from it.
//
// NO NEW DATA WAS NEEDED and that is worth pinning too: `character_images` has
// ridden the quote payload since the cast pass, already one entry per named
// character with the picture stored for them. The first attempt at this went
// looking for a schema change; there was none to make.
import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SpeakerChips, chipRows } from '../../src/people.jsx'

const IMAGES = [
  { name: 'Woland', path: 'woland.jpg' },
  { name: 'Behemoth', path: '' },
  { name: 'Margarita', path: 'margarita.jpg' },
]

const SPEAKER = {
  cast_id: 7, character_id: 3, name: 'Woland', record_name: 'Woland',
  image: 'woland.jpg', actor: 'Oleg Basilashvili', actor_image: 'oleg.jpg',
}

const chips = () => [...document.querySelectorAll('.person-chip')]

describe('the chip row', () => {
  it('draws one chip per character the line names', () => {
    render(<SpeakerChips images={IMAGES} />)
    expect(chips().length).toBe(3)
    expect(chips().map((c) => c.querySelector('.person-chip-name').textContent))
      .toEqual(['Woland', 'Behemoth', 'Margarita'])
  })

  // A CHARACTER WITH NO PORTRAIT IS STILL A CHIP. The disc row this replaces
  // dropped them — a disc with no picture is a picture of nobody — and a chip
  // carries a NAME, so it is legible without one.
  it('keeps a character who has no picture, with the hashed silhouette', () => {
    render(<SpeakerChips images={IMAGES} />)
    const behemoth = chips()[1]
    expect(behemoth.querySelector('.person-chip-name').textContent).toBe('Behemoth')
    expect(behemoth.querySelector('img')).toBeNull()
    expect(behemoth.querySelector('.person-chip-face')).toBeTruthy()
  })

  it('puts every chip in one row, on the box the fade hangs off', () => {
    const { container } = render(<SpeakerChips images={IMAGES} />)
    const row = container.querySelector('.speaker-chips')
    expect(row, 'the row is not the Scroller box any more').toBeTruthy()
    // EVERY CHIP IS A CHILD OF IT, which is the half that matters here: a chip
    // nested a level deeper would still be measured by the ResizeObserver but
    // would not lay out in the scrolling row.
    expect([...row.children].filter((c) => c.classList.contains('person-chip')))
      .toHaveLength(3)
    // THE SCROLL ITSELF IS NOT CHECKED HERE, and the first version of this case
    // pretended otherwise: it asserted the box wore the right class and called
    // that "scrolls rather than wraps" — which passed the whole time
    // `.speaker-chips` declared no overflow at all and therefore could not
    // scroll and could never show the fade. jsdom has no layout, so a measured
    // fade is unprovable in it; `test/pure/scroller-boxes.test.js` sweeps the
    // stylesheet for exactly that omission and is what caught this one.
  })

  it('draws nothing at all when the line names nobody', () => {
    const { container } = render(<SpeakerChips images={[]} />)
    expect(container.querySelector('.speaker-chips')).toBeNull()
  })
})

describe('the stored speaker among them', () => {
  // THE SPEAKER LEADS, because who said it is the first thing about a line and
  // the rest are who else is in it.
  it('comes first, whatever order the line names them in', () => {
    render(<SpeakerChips images={[{ name: 'Behemoth', path: '' }, { name: 'Woland', path: 'w.jpg' }]}
      speaker={SPEAKER} />)
    expect(chips()[0].querySelector('.person-chip-name').textContent).toBe('Woland')
  })

  // AND IS NOT DRAWN TWICE. It is matched by folded name, because the link is
  // stored and the names are typed — the two agree on spelling only after a fold.
  it('is folded against the names on the line rather than compared raw', () => {
    render(<SpeakerChips images={[{ name: '  woland ', path: '' }]} speaker={SPEAKER} />)
    expect(chips().length).toBe(1)
  })

  it('keeps its second line and its door, which the others do not have', () => {
    const onOpen = vi.fn()
    render(<SpeakerChips images={IMAGES} speaker={{ ...SPEAKER, onOpen }} />)
    const lead = chips()[0]
    // The actor is the caption to the character — a fact the app holds only for
    // the stored speaker, so a blank second line on the others would claim they
    // had no performer rather than that nobody has said.
    expect(lead.querySelector('.person-chip-sub').textContent).toBe('Oleg Basilashvili')
    expect(chips()[1].querySelector('.person-chip-sub')).toBeNull()
    fireEvent.click(lead)
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ character_id: 3, cast_id: 7 }))
  })

  // A CHIP THAT OPENS NOTHING IS NOT A DOOR. The three conditions the single chip
  // kept are kept here: no record, or no stack to open into, and it does not press.
  it('does not press when there is no record behind it', () => {
    const onOpen = vi.fn()
    render(<SpeakerChips images={[]} speaker={{ ...SPEAKER, character_id: 0, onOpen }} />)
    fireEvent.click(chips()[0])
    expect(onOpen).not.toHaveBeenCalled()
  })

  // AND IS NOT A BUTTON EITHER, which is the half a click test cannot see: a
  // button that does nothing still takes a tab stop and is still announced as a
  // press. On an ensemble line every chip but the linked one is in this state, so
  // a row of five names would have cost five dead stops on the way past it.
  it('is not announced as a control, on the row or beside it', () => {
    render(<SpeakerChips images={IMAGES} speaker={{ ...SPEAKER, onOpen: () => {} }} />)
    const tags = chips().map((c) => c.tagName)
    expect(tags, 'the speaker opens; the others are labels').toEqual(['BUTTON', 'SPAN', 'SPAN'])
  })

  // AND DOES NOT SWALLOW THE PRESS OF WHATEVER IS BEHIND IT. Home's favourite
  // tile is one button from its label to its faces, and the chips draw inside it
  // — so a label chip that stopped propagation (which the pressable form must do,
  // or opening a character would also toggle the tile) turned the row into a dead
  // strip across the middle of the tile: click a name, nothing happens at all.
  it('lets the click reach the tile it is drawn inside', () => {
    const onTile = vi.fn()
    render(
      <button type="button" onClick={onTile}>
        <SpeakerChips images={IMAGES} />
      </button>,
    )
    fireEvent.click(chips()[0])
    expect(onTile, 'the chip ate the tile’s press').toHaveBeenCalledTimes(1)
  })

  // THE ROW IS A SPAN, for the same reason: it draws inside that button, whose
  // content model is phrasing only, and a <div> there is invalid markup that the
  // browser is free to reparent out of the button.
  it('is an element a button is allowed to contain', () => {
    const { container } = render(<SpeakerChips images={IMAGES} />)
    expect(container.querySelector('.speaker-chips').tagName).toBe('SPAN')
  })

  // AND THE PRESSABLE ONE STILL DOES SWALLOW IT, which is the other half: on a
  // card the chip opens a character and must not also toggle the card it sits on.
  it('keeps the press to itself when it has one', () => {
    const onTile = vi.fn()
    const onOpen = vi.fn()
    render(
      <button type="button" onClick={onTile}>
        <SpeakerChips images={[]} speaker={{ ...SPEAKER, onOpen }} />
      </button>,
    )
    fireEvent.click(chips()[0])
    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(onTile, 'opening a character also pressed the card').not.toHaveBeenCalled()
  })

  // A SPEAKER NAMED NOWHERE ON THE LINE IS STILL DRAWN: it is a stored fact and
  // the line's text is free, so somebody may have edited the words and left the
  // link. Dropping it would hide the one thing the app is sure of.
  it('survives a line whose text no longer names them', () => {
    render(<SpeakerChips images={[{ name: 'Behemoth', path: '' }]} speaker={SPEAKER} />)
    expect(chips().map((c) => c.querySelector('.person-chip-name').textContent))
      .toEqual(['Woland', 'Behemoth'])
  })
})

describe('chipRows, which both cards share', () => {
  // SHARED SO THE TWO CANNOT DRIFT. They did once — the film card had the
  // actor-face fall-back and the book card did not — and that divergence is how
  // the missing-face bug survived on one side after being fixed on the other.
  it('folds duplicate names, because two identical chips read as a fault', () => {
    const rows = chipRows([{ name: 'Woland', path: '' }, { name: 'woland', path: '' }], null)
    expect(rows.length).toBe(1)
  })

  it('counts nothing for a line with neither a speaker nor a named character', () => {
    expect(chipRows([], null)).toEqual([])
    expect(chipRows(undefined, null)).toEqual([])
  })

  it('hashes the record name and prints the billing', () => {
    // handoff 1.8: hash the canonical name, never the billing, or one character
    // changes face between a novel and its adaptation.
    const rows = chipRows([], { ...SPEAKER, name: 'the professor', record_name: 'Woland' })
    expect(rows[0].name).toBe('the professor')
    expect(rows[0].faceName).toBe('Woland')
  })
})
