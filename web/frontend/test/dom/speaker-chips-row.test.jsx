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

  // EVERY CHIP IS A BUTTON — the owner's ruling, in their words: "all chips will
  // be buttons as well! that's their function."
  //
  // WHAT THIS REPLACES, because the reasoning is worth keeping in view. A chip
  // with nothing behind it was drawn as a span, on the argument that a button
  // which does nothing still takes a tab stop and is still announced as a press.
  // The ruling overturns the conclusion rather than the observation: the answer
  // is to give the chip something behind it. It has one now — every name the
  // work's cast knows carries its cast row, and the chip opens that work's
  // character popup. What is left is the one case with genuinely nowhere to go,
  // which says so with aria-disabled rather than by becoming a different element.
  it('is a control, every one of them', () => {
    render(<SpeakerChips images={IMAGES} speaker={{ ...SPEAKER, onOpen: () => {} }} />)
    expect(chips().map((c) => c.tagName)).toEqual(['BUTTON', 'BUTTON', 'BUTTON'])
  })

  it('says which of them has nowhere to go, rather than looking identical', () => {
    // These fixtures carry no cast row, so only the stored speaker opens.
    render(<SpeakerChips images={IMAGES} speaker={{ ...SPEAKER, onOpen: () => {} }} />)
    expect(chips().map((c) => c.getAttribute('aria-disabled')))
      .toEqual([null, 'true', 'true'])
  })

  // AND ONE THAT DOES OPEN, because that is the whole point of the ruling: a
  // named character the work's cast knows carries its cast row down to the chip.
  it('opens the work’s character popup for a name the cast knows', () => {
    const onOpen = vi.fn()
    render(
      <SpeakerChips
        images={[{ name: 'Behemoth', path: '', cast_id: 42, character_id: 7 }]}
        onOpenCharacter={onOpen}
      />,
    )
    fireEvent.click(chips()[0])
    // THE CAST ROW NAMES THE SCREEN, not the record: a work can bill one
    // character twice and the record id cannot tell the two apart.
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ cast_id: 42, character_id: 7 }))
  })

  // IT KEEPS THE PRESS TO ITSELF, ALWAYS. A chip is drawn beside things that are
  // themselves pressable, and one click must not be two answers.
  //
  // THE ROW IS NEVER NESTED INSIDE A BUTTON ANY MORE, which is the structural
  // half of the same ruling: Home's favourite tile used to wrap its whole head
  // AND this row in one <button>, and a <button> inside a <button> is invalid
  // markup that the parser hoists out — the chips escape the row and lay out as
  // loose text. The row moved out of the tile's head instead.
  it('does not let the press fall through to what it is drawn beside', () => {
    const onSurface = vi.fn()
    render(
      <div onClick={onSurface}>
        <SpeakerChips images={IMAGES} />
      </div>,
    )
    fireEvent.click(chips()[0])
    expect(onSurface, 'one click, two answers').not.toHaveBeenCalled()
  })

  // THE ROW IS STILL A SPAN. Nothing nests it inside a button now, but a span
  // with `display: flex` lays out identically and stays legal wherever it is put
  // — and this row is put on three surfaces with three different parents.
  it('is an element any parent is allowed to contain', () => {
    const { container } = render(<SpeakerChips images={IMAGES} />)
    expect(container.querySelector('.speaker-chips').tagName).toBe('SPAN')
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
