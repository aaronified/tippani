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
    expect(valueOf(letter(), 'occasion')).toBe('Letter to Carl Seelig')
  })

  it('and does not concatenate it — the phrase is a sentence, not a join', () => {
    // "Letter · Carl Seelig" is what three flat entries would have produced.
    expect(valueOf(letter(), 'occasion')).not.toMatch(/·/)
  })

  it('names an essay by its title and page, both of which reached nothing', () => {
    const row = { kind: 'essay', work_title: 'Politics and the English Language', locator: 'p. 12' }
    const share = quoteShare({ row, quote: 'Never use a long word.', speaker: 'George Orwell' })
    expect(valueOf(share, 'occasion')).toMatch(/Politics and the English Language/)
    // An essay's phrase speaks for its page, so the separate entry stays empty
    // rather than saying it twice.
    expect(valueOf(share, 'locator')).toBe('')
  })

  it('carries the page on its own row for a kind whose phrase does not say it', () => {
    // A letter's phrase names the recipient and nothing else, so p. 3 needs a
    // row of its own — and it had none.
    expect(valueOf(letter(), 'locator')).toBe('p. 3')
  })
})

describe('and it drops what the phrase already said', () => {
  it('leaves a speech’s place off, because the phrase names it', () => {
    const row = { kind: 'speech', occasion: 'the Azad Hind broadcast', place: 'Burma' }
    const share = quoteShare({ row, quote: 'Give me blood.', speaker: 'Subhas Chandra Bose', occasion: row.occasion, place: row.place, when: '1944' })
    expect(valueOf(share, 'occasion')).toMatch(/Burma/)
    // "Burma" twice on one card is the duplicate the attribution work ended.
    expect(valueOf(share, 'place')).toBe('')
  })

  it('keeps a letter’s place, because its phrase does not', () => {
    expect(valueOf(letter(), 'place')).toBe('Princeton')
  })

  // A CASE STOOD HERE AND WAS DELETED RATHER THAN KEPT, because a mutation run
  // showed it could not fail. It claimed that handing attributionParts the date
  // would make the picture print the year twice — and it would not: a phrase
  // never speaks for a date, and the share reads `rest` for MEMBERSHIP rather
  // than rendering it, so the option changes nothing this function looks at. The
  // comment in share.jsx was corrected with it. An unfalsifiable case is worse
  // than no case: it reports a guarantee nobody is holding.
})

describe('the toggle ids a reader has already set', () => {
  it('keeps `occasion`, so nobody’s switched-off field comes back', () => {
    // The owner's call, and its cost is the label: a letter's toggle says
    // "Occasion" over "Letter to Carl Seelig".
    const ids = letter().attribution.map((e) => e.id)
    expect(ids).toEqual(['speaker', 'occasion', 'when'])
  })

  it('and a quote with no kind still shares the occasion it was given', () => {
    // Every row captured before 0053 has no `kind`, so the phrase is empty and
    // the raw occasion has to survive — a fallback, not a rewrite.
    const share = quoteShare({ row: { occasion: 'a letter to his son' }, quote: 'Be good.', occasion: 'a letter to his son' })
    expect(valueOf(share, 'occasion')).toBe('a letter to his son')
  })

  it('and a share built with no row at all keeps every field it was handed', () => {
    // THIS ONE WAS A REGRESSION AND THE SUITE CAUGHT IT. With no row there is no
    // phrase and `rest` is empty, so a membership test answers NO for every
    // field — and the first version of this dropped a place it had been given
    // directly. Nothing spoke for anything, so everything stands.
    expect(() => quoteShare({ quote: 'x' })).not.toThrow()
    const share = quoteShare({ quote: 'x', occasion: 'somewhere', place: 'Burma' })
    expect(valueOf(share, 'occasion')).toBe('somewhere')
    expect(valueOf(share, 'place')).toBe('Burma')
  })

  it('and a row captured before quotes had a kind keeps them too', () => {
    // Every row from before 0053 has no `kind`, so it has no phrase either —
    // which is the same case as no row at all, arriving by a different door.
    const row = { occasion: 'a letter to his son', place: 'Princeton', locator: 'p. 3' }
    const share = quoteShare({ row, quote: 'Be good.', occasion: row.occasion, place: row.place })
    expect(valueOf(share, 'occasion')).toBe('a letter to his son')
    expect(valueOf(share, 'place')).toBe('Princeton')
    expect(valueOf(share, 'locator')).toBe('p. 3')
  })
})
