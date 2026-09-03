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
  it('stacks the character over the actor', () => {
    render(<PersonChip kind="character" name="Woland" sub="Oleg Basilashvili" onPress={() => {}} />)
    const btn = screen.getByRole('button')
    expect(btn.classList.contains('is-stacked')).toBe(true)
    expect(btn.querySelector('.person-chip-name').textContent).toBe('Woland')
    expect(btn.querySelector('.person-chip-sub').textContent).toBe('Oleg Basilashvili')
  })

  it('keeps one line when nobody played them', () => {
    // A novel bills a character and nobody plays them — work_cast.actor_id is
    // null on every book by design, so the second line must not appear as empty.
    render(<PersonChip kind="character" name="Prince Myshkin" onPress={() => {}} />)
    const btn = screen.getByRole('button')
    expect(btn.classList.contains('is-stacked')).toBe(false)
    expect(btn.querySelector('.person-chip-sub')).toBeNull()
  })

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

  it('clips a long name and keeps the whole of it on the title', () => {
    // The departure from "never truncate a name", recorded in PLAN.md: these
    // chips must not wrap, because a reflow moves every other chip on the row.
    const long = 'Bartholomew Featherstonehaugh'
    render(<PersonChip kind="character" name={long} sub="Someone With A Long Name Too" onPress={() => {}} />)
    const btn = screen.getByRole('button')
    const shown = btn.querySelector('.person-chip-name').textContent
    expect(shown.endsWith('…')).toBe(true)
    expect(shown.length).toBeLessThan(long.length)
    // Nothing is lost: the full pair is one hover away.
    expect(btn.title).toContain(long)
    expect(btn.title).toContain('Someone With A Long Name Too')
  })

  it('does not clip a name that fits', () => {
    render(<PersonChip kind="character" name="Woland" sub="Oleg B" onPress={() => {}} />)
    expect(screen.getByRole('button').querySelector('.person-chip-name').textContent).toBe('Woland')
  })
})
