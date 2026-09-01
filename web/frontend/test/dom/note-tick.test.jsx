// The mark beside a margin note.
//
// It was a literal ▍ — U+258D, LEFT FIVE EIGHTHS BLOCK — typed into the markup
// as text, which is three bets at once and every one of them is invisible when
// it loses:
//
//   · that the reader's font HAS the glyph. Without it the browser draws tofu,
//     and it draws one beside every margin note in the library at once.
//   · that it draws it as a SOLID BAR. It is a block-drawing character; faces
//     vary it in width and in whether it is filled.
//   · that it scales like a RULE. It does not — it is a letter, so it takes the
//     hand dial and the hand face, and a note set in a different font gets a
//     differently-proportioned mark.
//
// None of that throws, and none of it shows on the machine of whoever typed it.
// So the mark is drawn now, and what is pinned here is that no character is
// standing in for a shape.

import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { HandNote } from '../../src/ui.jsx'

const note = () => render(<HandNote>a thought in the margin</HandNote>)

describe('the tick beside a margin note', () => {
  it('is an empty element, not a character', () => {
    const { container } = note()
    const tick = container.querySelector('.tick')
    expect(tick, 'no tick at all').not.toBeNull()
    expect(tick.textContent, 'the tick is drawn with a character again').toBe('')
  })

  it('puts no block-drawing character anywhere in the note', () => {
    // The whole class, not just the one that was here — ▍ has seven siblings and
    // any of them would be the same mistake.
    const { container } = note()
    expect(container.textContent).toBe('a thought in the margin')
    expect(container.textContent).not.toMatch(/[▀-▟]/)
  })

  it('is hidden from a screen reader, because it is decoration', () => {
    // A rule beside a note says "this is a note" to an eye. Read aloud it is
    // either nothing or the words "left five eighths block".
    expect(note().container.querySelector('.tick').getAttribute('aria-hidden')).toBe('true')
  })

  it('still carries the note itself as selectable text', () => {
    // card-text is what lets a long press over the note select words rather than
    // grabbing the card; losing it turns a note into furniture.
    expect(note().container.querySelector('p').className).toContain('card-text')
  })
})
