// ONE QUOTE, ONE CREDIT, WHEREVER IT IS DRAWN.
//
// WHAT WAS WRONG, AND IT WAS WRONG IN TWO PLACES A COMMIT APART. Every surface is
// supposed to compose a quote's credit with `attributionParts` — the kind's own
// phrase, so "Letter" and "to Carl Seelig" are one fact rather than two. Two did
// not:
//
//   the search results list   [h.speaker, h.occasion].filter(Boolean).join(' · ')
//   the Home favourite tile   [u.occasion, date, u.place, quoteKindMeta(u)]
//
// Both are the concatenation `docs/plans/quote-card-types.md` opens on. A letter
// read "Albert Einstein · after the prize" in search and "after the prize · 11 Mar
// 1952 · Zurich · Letter" on the wall, while its own card read "Albert Einstein ·
// Letter to Carl Seelig · 11 Mar 1952 · Zurich · p. 3". Three surfaces, three
// pictures of one quote.
//
// THE SECOND ONE IS THE REASON THIS FILE IS NAMED FOR THE RULE AND NOT FOR THE
// SCREEN. It was called `search-hit-credit` and covered the search row alone,
// while the commit that added it told users the search row was "the one place
// left". It was not, and a guard scoped to one surface cannot say so. Home's
// hand-join even carried a comment claiming "the same rule utteranceMeta follows,
// spelled through the same helper" — a rule CITED rather than CALLED, which is
// the shape both defects took.
//
// AND HALF THE SEARCH FIX IS ON THE SERVER. `utteranceHit` carried no
// `recipient`, `work_title` or `locator`, so composing the row correctly was not
// enough — the hit had nothing to compose from, and a client-only repair would
// have drawn the kind's bare word and looked like the phrase working.
// `TestASearchHitCarriesWhatItsAttributionIsMadeOf` is that half.
//
// WHAT IS NOT GUARDED HERE, deliberately: `region`. No shape consumes it (see
// CONSUMES in attribution.js — the owner's correction made a proverb's
// attribution `{language} proverb`), so it would be a field shipped to no reader.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { quoteFav } from '../../src/Home.jsx'
import { utteranceMeta } from '../../src/Quotes.jsx'

const src = (f) => readFileSync(new URL(`../../src/${f}`, import.meta.url), 'utf8')

// The fields a quote SEARCH HIT carries, as search_handler.go's utteranceHit
// sends them. That is the point of spelling them out: this is the subset the
// results row has, and the cases below are that the subset is now enough.
const letterHit = {
  id: 7,
  kind: 'letter',
  speaker: 'Albert Einstein',
  recipient: 'Carl Seelig',
  occasion: 'after the prize',
  place: 'Zurich',
  occasion_date: '1952-03-11',
  language: 'German',
}

// The same quote as a STORED ROW — `GET /quotes`, which is what the board's card
// and the Home tile are handed. Written out in full rather than spread from the
// hit ON PURPOSE: a fixture built with `{ ...letterHit, extra }` cannot fail the
// equality case below for the reason that case exists, because a field missing
// from the hit is then missing from both sides and the two strings agree by
// construction. A rater deleted `place` from the shared fixture and all four
// cases went on passing. Two independent literals is what makes the comparison
// mean anything.
const letterRow = {
  id: 7,
  kind: 'letter',
  speaker: 'Albert Einstein',
  recipient: 'Carl Seelig',
  occasion: 'after the prize',
  place: 'Zurich',
  occasion_date: '1952-03-11',
  language: 'German',
  // Columns the hit does not carry, and must not need to: if the phrase ever
  // reads one of these the equality case fails, which is the alarm.
  region: 'Swabia',
  note: 'from the Seelig correspondence',
  color: 'blue',
  board_id: 3,
  translation: 'Es ist unverzeihlich…',
  created_at: '2026-03-11T00:00:00Z',
}

describe('the composed credit', () => {
  it('names who a letter was to, instead of saying "Letter"', () => {
    const line = utteranceMeta(letterHit)
    expect(line).toContain('Carl Seelig')
    // AND THE KIND'S OWN WORD IS GONE FROM IT. That is the rule the phrase exists
    // for: the word is printed only when nothing else implies it, so a letter
    // WITH a recipient must not also say "Letter".
    expect(line).not.toMatch(/\bLetter\b(?! to)/)
  })

  it('draws an essay its title and its page', () => {
    const line = utteranceMeta({ kind: 'essay', work_title: 'Why Socialism?', locator: 'p. 3' })
    expect(line).toContain('Why Socialism?')
    expect(line).toContain('p. 3')
  })
})

describe('every surface draws the same line for the same quote', () => {
  // The search row against the board's card. These are two independent objects
  // (see letterRow's note), so this fails the moment the hit stops carrying a
  // column the phrase reads — which is exactly how the defect shipped.
  it('the search results row and the stored row agree', () => {
    expect(utteranceMeta(letterHit)).toBe(utteranceMeta(letterRow))
  })

  // The Home favourite tile against the same card. `quoteFav` turns a row into
  // the tile's shape, and `meta` is the line the expanded tile prints.
  it('the Home favourite tile and the card agree', () => {
    expect(quoteFav(letterRow).meta).toBe(utteranceMeta(letterRow))
  })

  // AND THE TILE NAMES THE RECIPIENT, stated on its own rather than left implicit
  // in the equality above: if both sides regressed together the case above would
  // still pass, and this one would not.
  it('the Home tile names the recipient', () => {
    expect(quoteFav(letterRow).meta).toContain('Carl Seelig')
  })
})

// THE SOURCE GUARDS, because the failure this keeps meeting is a correct
// mechanism landing BESIDE an old one that still fires. A behaviour case proves
// `utteranceMeta` is right; it cannot prove a screen calls it.
describe('no screen keeps a second way to write a credit', () => {
  it('the search hit row composes through utteranceMeta and not by hand', () => {
    const page = src('SearchPage.jsx')
    const start = page.indexOf('function QuoteHit(')
    expect(start).toBeGreaterThan(-1)
    // To the next top-level declaration — QuoteHit is the only function between.
    const end = page.indexOf('\nfunction ', start + 1)
    const body = page.slice(start, end > -1 ? end : undefined)

    expect(body).toContain('utteranceMeta(h)')
    // `h.occasion` is what the old hand-join reached for. Its presence anywhere
    // in this function means a second composition was written beside the shared
    // one.
    expect(body).not.toContain('h.occasion')
  })

  it('the Home favourite tile composes through utteranceMeta and not by hand', () => {
    const page = src('Home.jsx')
    const start = page.indexOf('export function quoteFav(')
    expect(start).toBeGreaterThan(-1)
    const end = page.indexOf('\n}', start)
    const body = page.slice(start, end)

    expect(body).toContain('utteranceMeta(u)')
    // The two halves of the old join. `quoteKindMeta` is the one that made the
    // kind say its word twice, and `u.occasion` the one that put the recipient's
    // job on the wrong field.
    expect(body).not.toContain('quoteKindMeta(')
    expect(body).not.toContain('u.occasion')
  })
})
