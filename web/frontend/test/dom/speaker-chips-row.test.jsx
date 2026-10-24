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
import { render, fireEvent } from '@testing-library/react'
import { SpeakerChips } from '../../src/people.jsx'

const IMAGES = [
  { name: 'Woland', path: 'woland.jpg' },
  { name: 'Behemoth', path: '' },
  { name: 'Margarita', path: 'margarita.jpg' },
]

const chips = () => [...document.querySelectorAll('.person-chip')]

describe('the chip row', () => {
  it('draws one chip per character the line names', () => {
    render(<SpeakerChips images={IMAGES} />)
    expect(chips().length).toBe(3)
    expect(chips().map((c) => c.querySelector('.person-chip-name').textContent))
      .toEqual(['Woland', 'Behemoth', 'Margarita'])
  })

})

describe('the stored speaker among them', () => {

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

})

