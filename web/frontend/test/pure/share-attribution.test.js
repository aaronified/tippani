// A LETTER'S RECIPIENT, AN ESSAY'S TITLE AND ITS PAGE REACH THE SHARE.
//
// WHAT WAS WRONG. `quoteShare` composed its attribution out of flat fields —
// speaker, occasion, when — and never called attribution.js at all. So of the
// five fields migrations 0047 and 0053 added, THREE appeared in no part of the
// share: not in the picture, not in the text. A letter went out as
//
//     — Albert Einstein, 1952
//
// with Carl Seelig nowhere. That is the same "captured and never shown" fault
// attribution.js's own header says taught readers to type the whole attribution
// into Occasion by hand in the first place.
//
// AND THE OBVIOUS FIX IS THE WRONG ONE. Adding recipient, work_title and locator
// as three more flat entries breaks no toggle and reinstates exactly the
// concatenation the attribution work replaced — "Letter · Carl Seelig" where the
// card says "Letter to Carl Seelig". docs/plans/quote-card-types.md ends on that
// warning by name: "if that discipline is not held, B2 and B3 will drift and the
// share image will keep drawing a proverb as a speech."
//
// SO THE SHARE CALLS attributionParts, and these cases are about the two things
// that buys and the one thing it costs.
//
// THE COST, which the owner chose: the phrase rides on the `occasion` id it has
// always had, so a letter's toggle reads "Occasion" over "Letter to Carl Seelig".
// The alternative was a new id, and a new id resets the stored preference of
// every reader who had switched that field off.

import { describe, expect, it } from 'vitest'

import { quoteShare } from '../../src/share.jsx'

const valueOf = (share, id) =>
  [...share.attribution, ...share.meta].find((e) => e.id === id)?.value || ''

const letter = () => {
  const row = { kind: 'letter', recipient: 'Carl Seelig', occasion: 'after the prize', place: 'Princeton', locator: 'p. 3' }
  return quoteShare({ row, quote: 'Everything should be made as simple as possible.', speaker: 'Albert Einstein', occasion: row.occasion, when: '1952', place: row.place })
}

describe('the phrase the card composes is the phrase the picture shares', () => {
  it('names a letter’s recipient, which reached nothing at all before', () => {
    expect(valueOf(letter(), 'occasion')).toMatch(/^Letter to Carl Seelig\b/)
  })
})

// ---- what the phrase already said, and must not say twice ---------------------
//
// A RATER FOUND ALL OF THIS, on the surface the change was about. The first cut
// composed the credit correctly and then printed the kind AGAIN beside it, so a
// letter shared as "Letter to Carl Seelig … Letter" and a proverb as "Bengali
// proverb … Bengali … Proverb" — one fact, three times, which is the exact
// duplicate the attribution work exists to end.
describe('the kind is in the phrase, so nothing prints it again', () => {
  const share = (row, extra = {}) => quoteShare({ row, quote: 'x', ...extra })

  it('draws no separate Kind beside a phrase', () => {
    // Every branch of phrase() falls back to the kind's own WORD when its shape
    // has nothing, and its default arm returns quoteKindMeta — the very value
    // this entry carries. So a phrase implies the kind by construction, which is
    // why the card draws no medium at all.
    const s = share({ kind: 'letter', recipient: 'Carl Seelig' }, { medium: 'Letter' })
    expect(valueOf(s, 'occasion')).toBe('Letter to Carl Seelig')
    expect(valueOf(s, 'medium')).toBe('')
  })
})
