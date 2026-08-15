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
  it('finds a language however it was typed', () => {
    expect(glyphFor(['Bengali'])).toBe('অ')
    expect(glyphFor(['bengali'])).toBe('অ')
    expect(glyphFor(['  Hindi  '])).toBe('अ')
  })

  // Four of the ten are written in Latin, so the glyphs are deliberately
  // different letters — an identical "A" on four covers would tell you nothing
  // about which board you were looking at.
  it('gives the Latin languages distinct letters', () => {
    const latin = [glyphFor(['English']), glyphFor(['Spanish']), glyphFor(['French']), glyphFor(['Portuguese'])]
    expect(new Set(latin).size).toBe(4)
  })

  it('takes the first language it recognises, so a mixed board still has one', () => {
    expect(glyphFor(['Yoruba', 'Bengali'])).toBe('অ')
  })

  // Guessing a script from a name nobody listed would put a Latin A on a board
  // of Yoruba proverbs. Being confidently wrong about somebody's language is
  // worse than being blank.
  it('says nothing about a language it does not know', () => {
    expect(glyphFor(['Yoruba'])).toBe('')
    expect(glyphFor([])).toBe('')
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
  it('falls back to the app mark for a proverb board in a language it cannot draw', () => {
    render(<BoardCover board={board({ kind: 'proverb', languages: ['Yoruba'] })} />)
    expect(glyph()).toBeNull()
    expect(art()).toBeNull()
  })

  it('falls back to the app mark on a plain board', () => {
    render(<BoardCover board={board({ kind: 'plain' })} />)
    expect(glyph()).toBeNull()
    expect(art()).toBeNull()
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
