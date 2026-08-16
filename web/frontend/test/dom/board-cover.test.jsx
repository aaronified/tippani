// What a board wears when nobody has given it a picture.
//
// Every board used to show the same grey quote mark, which is the same answer to
// a different question forty times over. The default is drawn from what the board
// HOLDS now — a thing it already knows (kind, 0037) rather than a thing inferred
// from its name, which is the rule everything else about kind follows.
//
// The name test below is the one that matters most. 0036 is emphatic that nothing
// in the code may know a board's name, and a cover keyed on "Proverbs" would
// break silently the moment somebody renamed it — visible only to the reader.

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BoardCover, glyphFor } from '../../src/boards.jsx'

const board = (over = {}) => ({ id: 1, name: 'A board', color: 'blue', kind: 'plain', languages: [], ...over })

const art = () => document.querySelector('.board-cover-art')
const glyph = () => document.querySelector('.board-cover-glyph')

describe('glyphFor', () => {
  // One test over all six language lists rather than three: every case is the
  // same glyphFor(list) → glyph comparison and only the list differs, so one
  // table asserted at once names every list that came out wrong instead of
  // dying on the first. Each row keeps the name of the it() it used to be.
  it('draws the script it recognises, and nothing when it recognises none', () => {
    const cases = [
      { name: 'finds a language however it was typed', languages: ['Bengali'], want: 'অ' },
      { name: 'finds a language however it was typed', languages: ['bengali'], want: 'অ' },
      { name: 'finds a language however it was typed', languages: ['  Hindi  '], want: 'अ' },
      { name: 'takes the first language it recognises, so a mixed board still has one', languages: ['Yoruba', 'Bengali'], want: 'অ' },
      // Guessing a script from a name nobody listed would put a Latin A on a board
      // of Yoruba proverbs. Being confidently wrong about somebody's language is
      // worse than being blank.
      { name: 'says nothing about a language it does not know', languages: ['Yoruba'], want: '' },
      { name: 'says nothing about a language it does not know', languages: [], want: '' },
    ]
    const got = cases.map(({ name, languages }) => [name, languages, glyphFor(languages)])
    expect(got).toEqual(cases.map(({ name, languages, want }) => [name, languages, want]))
  })

  // Four of the ten are written in Latin, so the glyphs are deliberately
  // different letters — an identical "A" on four covers would tell you nothing
  // about which board you were looking at.
  it('gives the Latin languages distinct letters', () => {
    const latin = [glyphFor(['English']), glyphFor(['Spanish']), glyphFor(['French']), glyphFor(['Portuguese'])]
    expect(new Set(latin).size).toBe(4)
  })
})

describe('the default cover', () => {
  it('draws a microphone and an audience on a board of speeches', () => {
    render(<BoardCover board={board({ kind: 'speech' })} />)
    expect(art()).not.toBeNull()
  })

  it('draws its language on a board of proverbs', () => {
    render(<BoardCover board={board({ kind: 'proverb', languages: ['Bengali'] })} />)
    expect(glyph().textContent).toBe('অ')
  })

  // The stated fallback: "for others, use the tippani mark".
  //
  // One test over both boards rather than two: the pair of assertions is
  // identical per board and only the board differs, so the collected list names
  // every board that drew something of its own instead of falling back. Each
  // row keeps the name of the it() it used to be.
  it('falls back to the app mark', () => {
    const drew = []
    for (const [name, over] of [
      ['for a proverb board in a language it cannot draw', { kind: 'proverb', languages: ['Yoruba'] }],
      ['on a plain board', { kind: 'plain' }],
    ]) {
      const { unmount } = render(<BoardCover board={board(over)} />)
      if (glyph() !== null) drew.push(`${name}: a glyph`)
      if (art() !== null) drew.push(`${name}: cover art`)
      unmount()
    }
    expect(drew).toEqual([])
  })

  // THE RULE 0036 SET. A cover keyed on the name would break the moment somebody
  // renamed the board, silently, and only they could see it.
  it('follows the kind and not the name', () => {
    const { unmount } = render(<BoardCover board={board({ name: 'Grandmother', kind: 'proverb', languages: ['Hindi'] })} />)
    expect(glyph().textContent).toBe('अ')
    unmount()
    // ...and the converse: a plain board called Proverbs gets no glyph.
    render(<BoardCover board={board({ name: 'Proverbs', kind: 'plain' })} />)
    expect(glyph()).toBeNull()
  })

  // The colour lives on the tile as a custom property and the cover reads it, so
  // one drawing serves every board and both themes.
  it('carries the kind in its class so the stylesheet can theme it', () => {
    render(<BoardCover board={board({ kind: 'speech' })} />)
    expect(document.querySelector('.board-cover-speech')).not.toBeNull()
  })
})
