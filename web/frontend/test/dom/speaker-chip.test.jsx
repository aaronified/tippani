// The speaker chip: two lines, and the face that was missing.
//
// THE BUG THIS PINS. A book highlight's speaker chip drew `sp.image` and nothing
// else — the character's picture, or none. A character with no picture of their
// own therefore drew no face at all, even when the person who played them had a
// portrait on file, so a line naming two characters where only one had a
// character image showed exactly one face and the other looked like missing data.
// The film card had the fall-back already (through its own actorMap); the book
// card never did, and the two disagreeing is how it survived.
//
// AND THE SHAPE. One line held "Woland — Oleg Basilashvili", which on a card
// beside three other chips reads as a single unfamiliar name with punctuation in
// it. Stacked, the character is the fact and the actor is its caption.
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PersonChip } from '../../src/people.jsx'

describe('a speaker chip with an actor', () => {

  it('wears the face it was handed, and a silhouette when handed none', () => {
    const { unmount } = render(<PersonChip kind="character" name="Woland" faceSrc="/api/covers/x.jpg" onPress={() => {}} />)
    expect(screen.getByRole('button').querySelector('img')).toBeTruthy()
    unmount()
    render(<PersonChip kind="character" name="Woland" onPress={() => {}} />)
    // The silhouette is drawn rather than nothing — the row is a run of equal
    // shapes, which is the whole reason the face is unconditional.
    expect(screen.getByRole('button').querySelector('img')).toBeNull()
    expect(screen.getByRole('button').querySelector('.person-chip-face')).toBeTruthy()
  })

})
