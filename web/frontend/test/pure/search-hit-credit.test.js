// THE SEARCH RESULTS LIST DRAWS THE SAME CREDIT THE BOARD DOES.
//
// WHAT WAS WRONG. Every other surface in the app composes a quote's credit with
// `attributionParts` — the kind's own phrase, so "Letter" and "to Carl Seelig"
// are one fact rather than two. The search results list did not. It hand-joined
// two fields:
//
//     [h.speaker, h.occasion].filter(Boolean).join(' · ')
//
// which is exactly the concatenation `docs/plans/quote-card-types.md` opens on,
// still live on the one surface the attribution work never reached. A letter
// found by search read
//
//     Albert Einstein · after the prize
//
// while the same quote on its board read
//
//     Albert Einstein · Letter to Carl Seelig · after the prize · Zurich · p. 3
//
// One quote, two pictures, on two screens a reader moves between — the repo's
// "two things that look the same behave the same", failed by a line each.
//
// AND HALF THE FIX IS ON THE SERVER. `utteranceHit` carried no `recipient`,
// `work_title` or `locator`, so even composed correctly the row could only draw
// the kind's bare word. `search_handler.go` now sends the three, and
// `TestASearchHitCarriesWhatItsAttributionIsMadeOf` is that half.
//
// WHAT IS NOT HERE, deliberately: `region`. No shape consumes it (see CONSUMES
// in attribution.js — the owner's correction made a proverb's attribution
// `{language} proverb`), so it would be a field shipped to no reader.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { utteranceMeta } from '../../src/Quotes.jsx'

const src = (f) => readFileSync(new URL(`../../src/${f}`, import.meta.url), 'utf8')

// The fields a quote search hit carries, as search_handler.go's utteranceHit
// sends them — which is the point: this is the SUBSET the list row has, and the
// case below is that the subset is now enough.
const letterHit = {
  kind: 'letter',
  speaker: 'Albert Einstein',
  recipient: 'Carl Seelig',
  occasion: 'after the prize',
  place: 'Zurich',
  occasion_date: '1952-03-11',
  language: 'German',
}

describe('a quote search hit composes its credit', () => {
  it('names who a letter was to, instead of saying "Letter"', () => {
    const line = utteranceMeta(letterHit)
    expect(line).toContain('Carl Seelig')
    // AND THE KIND'S OWN WORD IS GONE FROM IT. That is the rule the phrase
    // exists for: the word is printed only when nothing else implies it, so a
    // letter WITH a recipient must not also say "Letter".
    expect(line).not.toMatch(/\bLetter\b(?! to)/)
  })

  it('draws an essay its title and its page', () => {
    const line = utteranceMeta({ kind: 'essay', work_title: 'Why Socialism?', locator: 'p. 3' })
    expect(line).toContain('Why Socialism?')
    expect(line).toContain('p. 3')
  })

  // THE ONE THAT MATTERS: the hit and the full row compose the SAME line. The
  // board's card is handed a `GET /quotes` row, which carries more columns than
  // the hit does; if a column the phrase reads were missing from the hit the two
  // strings would differ, and this is what says so rather than leaving it to a
  // reader to spot on two screens.
  it('composes the same line the board draws for the same quote', () => {
    const fullRow = { ...letterHit, region: 'Swabia', note: 'from the Seelig correspondence', color: 'blue', board_id: 3 }
    expect(utteranceMeta(letterHit)).toBe(utteranceMeta(fullRow))
  })
})

// AND THE SOURCE GUARD, because the failure this session keeps meeting is a
// correct new mechanism landing BESIDE an old one that still fires. A behaviour
// case proves `utteranceMeta` is right; it cannot prove the search page calls it.
describe('the search page has no second way to write a credit', () => {
  it('composes the quote hit row through utteranceMeta and not by hand', () => {
    const page = src('SearchPage.jsx')
    const start = page.indexOf('function QuoteHit(')
    expect(start).toBeGreaterThan(-1)
    // To the next top-level declaration — QuoteHit is the only function between.
    const end = page.indexOf('\nfunction ', start + 1)
    const body = page.slice(start, end > -1 ? end : undefined)

    expect(body).toContain('utteranceMeta(h)')
    // `h.occasion` is the field the old hand-join reached for. Its presence
    // anywhere in this function means a second composition has been written
    // beside the shared one.
    expect(body).not.toContain('h.occasion')
  })
})
