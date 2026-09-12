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

import { quoteShare, shareDefaults } from '../../src/share.jsx'

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

  it('and keeps the occasion the phrase did not speak for', () => {
    // A SILENT LOSS FOR ONE COMMIT, and a rater found it: this read
    // `line || occasion`, and a letter's phrase names its recipient without
    // consuming the occasion — so a typed occasion vanished from the share while
    // the card went on showing it. The card prints
    // `[kindLine, ...unspoken].join(' · ')` and so does this.
    expect(valueOf(letter(), 'occasion')).toBe('Letter to Carl Seelig · after the prize')
  })

  it('and does not glue the kind’s word to the recipient', () => {
    // "Letter · Carl Seelig" is what three flat entries would have produced, and
    // is the concatenation docs/plans/quote-card-types.md warns against by name.
    // Joining a finished phrase to the facts it left unsaid is a different thing
    // and is what band 3 has always been.
    expect(valueOf(letter(), 'occasion')).not.toMatch(/Letter · /)
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

  it('and draws no proverb legend beside one either', () => {
    const s = share({ kind: 'proverb', language: 'Bengali' }, { kind: 'proverb', language: 'Bengali', medium: 'Proverb' })
    expect(valueOf(s, 'occasion')).toMatch(/Bengali/)
    expect(valueOf(s, 'proverb')).toBe('')
    expect(valueOf(s, 'medium')).toBe('')
  })

  it('but keeps both where there is no phrase to say it', () => {
    // A row with no `kind` has no phrase — the legend is then the only thing a
    // shared proverb has, which is why it was added and why it is gated rather
    // than deleted.
    const s = quoteShare({ quote: 'x', kind: 'proverb', language: 'Bengali', medium: 'Proverb' })
    expect(valueOf(s, 'proverb')).toBe('Bengali')
    expect(valueOf(s, 'medium')).toBe('Proverb')
  })
})

describe('a quote’s page defaults the way a book highlight’s does', () => {
  it('is off until asked for, like `location`', () => {
    // One fact under two ids, labelled with the same word on both surfaces. A
    // rater noticed `locator` escaped the off-by-default set that `location` is
    // in, so the same page was off on a book highlight and on on a quote.
    const s = quoteShare({ row: { kind: 'letter', recipient: 'C', locator: 'p. 3' }, quote: 'x' })
    expect(valueOf(s, 'locator')).toBe('p. 3')
    expect(shareDefaults(s).locator, 'a page is on without being asked for').toBe(false)
  })
})
