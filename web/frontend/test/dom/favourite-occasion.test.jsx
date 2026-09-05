// A NAME IS PRINTED ONCE, AND THE OCCASION HAS ITS OWN LINE.
//
// THE REPORT, in the owner's words, of a standalone quote on Home's favourites
// board: "why is albert einstein repeated in the prose? and the part about the
// letter could be placed below/above the chip row, like notes or translation."
//
// TWO RULES FALL OUT OF IT, and neither needs a line of the source:
//
//   A FACT APPEARS ONCE PER CARD. The chip beside the quote carries the
//   speaker's name AND their portrait; a line under it repeating that name in
//   small caps is the same fact twice, and the second printing is the one that
//   pushed the first out of its row. What the collapsed line is FOR is the one
//   thing no chip and no header carries — where the line was said.
//
//   AND IT SITS ON ITS OWN LINE. Beside the chips it competes with them for one
//   row's width, which is what clipped the chip to "Albert Ein…". Above or below
//   them, the way a note or a translation sits.
//
// THE CARD IS BUILT FROM A STORED ROW, not handed a finished shape. Both facts
// are decided in `quoteFav`, which turns the row into the card's shape, and a
// test given that shape ready-made would assert only that the tile prints what
// it was told to — the exact hole `credit-row.test.jsx` sat in for a week.
//
// WHAT A TEST WRITER NEEDS TO KNOW: the paragraphs above.
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { FavouriteTile, quoteFav } from '../../src/Home.jsx'

const ROW = {
  id: 7,
  quote: 'Everything should be made as simple as possible, but not simpler.',
  note: '',
  speaker: 'Albert Einstein',
  occasion: 'writing to Carl Seelig',
  kind: 'letter',
  color: 'yellow',
  tags: [],
  created_at: '1946-03-11T00:00:00Z',
  favorite: true,
}

const tile = (over = {}) => {
  const f = quoteFav({ ...ROW, ...over })
  render(
    <FavouriteTile
      f={f}
      variant="a"
      open={false}
      editing={false}
      onToggle={() => {}}
      onOpen={() => {}}
      speakerMap={{}}
      seps={{}}
    />,
  )
  return f
}

// The card's own body, so the edit modal's hidden copy of the same strings
// cannot answer for the resting card.
const card = () => document.querySelector('.tp-hand-card') || document.body

afterEach(() => cleanup())

describe('a standalone quote on the favourites board', () => {
  it('prints the speaker once, not once in a chip and again in the line beneath', () => {
    tile()
    const hits = [...card().querySelectorAll('*')]
      .filter((el) => el.children.length === 0 && /Albert Einstein/.test(el.textContent))
    expect(hits.length,
      `the speaker is printed ${hits.length} times: ` + hits.map((h) => h.textContent).join(' | '))
      .toBe(1)
  })

  it('and the surviving printing is the chip, the one with a face on it', () => {
    tile()
    const chipRow = card().querySelector('.people-chips, .speaker-chips')
      || [...card().querySelectorAll('*')].find((el) => /Albert Einstein/.test(el.textContent) && el.querySelector('img, svg'))
    expect(chipRow, 'the name survives only as small caps under the quote, with no face').toBeTruthy()
  })

  it('still says WHERE the line was said, which no chip carries', () => {
    tile()
    expect(card().textContent).toMatch(/writing to Carl Seelig/)
  })

  it('and says it on a line of its own, not beside the chips', () => {
    tile()
    const occasion = [...card().querySelectorAll('*')]
      .find((el) => el.children.length === 0 && /writing to Carl Seelig/.test(el.textContent))
    expect(occasion, 'the occasion is not on the card at all').toBeTruthy()
    // A ROW OF ITS OWN, in the only sense jsdom can see: nothing else on the
    // card shares its line box. The chips are its previous siblings, not its
    // neighbours — either it is the sole child of its row, or it is declared to
    // take the full width of the one it is in.
    const parent = occasion.closest('[class]')
    const takesTheRow = /basis-full|w-full|block/.test(parent.className || '')
      || parent.parentElement.children.length === 1
    expect(takesTheRow,
      'the occasion shares a row with the chips, which is what clipped the chip mid-name').toBe(true)
  })

  it('and prints nothing there when the quote has no occasion', () => {
    tile({ occasion: '' })
    // An empty line is still a flex child with a gap before it — a column of air
    // pretending to be a line.
    const empties = [...card().querySelectorAll('.tp-mono-label')]
      .filter((el) => !el.textContent.trim())
    expect(empties.length, 'an empty line claims there is something to read').toBe(0)
  })
})
