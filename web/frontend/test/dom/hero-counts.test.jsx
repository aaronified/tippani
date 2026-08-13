// What a work is holding, said at the top of its own page.
//
// The board below has always printed a count in its toolbar, and that toolbar is
// the wrong place to learn it from: on a phone it is inside the filter sheet, and
// on a desktop it is past the description. So "how much have I got out of this
// book" was a scroll away on the page whose entire subject is the answer.
//
// Two things are worth pinning here and neither is the layout.
//
// THE ZERO RULES, because they are the whole design and every one of them is a
// judgement that reads as a bug if it goes the other way. The total always shows —
// a zero total IS the wishlist state, and saying so out loud beats an empty gap
// where a number goes. The other three vanish at zero, because "0 favourites · 0
// noted · 0 tagged" is a row of failures to report and there is nothing in it to
// act on.
//
// AND THAT IT IS COUNTED OFF THE UNFILTERED SET. countQuotes is handed the whole
// list; a colour filter must not be able to make a book look emptier than it is.
// That is a property of the two call sites rather than of this function, so what
// is asserted here is the arithmetic, and the call sites are asserted by the fact
// that they only recompute on an unfiltered load.

import { describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { HeroCounts, countQuotes, minusQuote } from '../../src/works.jsx'

const q = (over = {}) => ({ favorite: false, note: '', tags: [], ...over })

// The rendered line as one string, which is how it is read.
function line(counts, props = {}) {
  cleanup()
  const { container } = render(<HeroCounts counts={counts} {...props} />)
  const el = container.querySelector('.hero-counts')
  return el ? el.textContent : null
}

describe('counting a list of quotes', () => {
  it('counts each of the four independently', () => {
    expect(
      countQuotes([
        q({ favorite: true, note: 'a thought', tags: ['craft'] }),
        q({ favorite: true }),
        q({ note: '   ' }), // whitespace is not a note
        q({ tags: [] }),
      ]),
    ).toEqual({ total: 4, favourites: 2, noted: 1, tagged: 1 })
  })

  it('treats a whitespace-only note as no note', () => {
    // The server stores what was typed, and a note field somebody tabbed through
    // holds a space. Counting it would report a note nobody wrote.
    expect(countQuotes([q({ note: '\n \t ' })]).noted).toBe(0)
    expect(countQuotes([q({ note: 'x' })]).noted).toBe(1)
  })

  it('survives a row that arrives without its tags array', () => {
    // A row mid-save should not be able to crash a hero.
    expect(countQuotes([{ favorite: true }]).tagged).toBe(0)
  })

  it('counts an empty library as four zeroes rather than nothing', () => {
    expect(countQuotes([])).toEqual({ total: 0, favourites: 0, noted: 0, tagged: 0 })
  })
})

describe('the line it prints', () => {
  it('says nothing at all while the counts are still loading', () => {
    // null, not zero. A hero that flashes "no quotes yet" before the quotes land
    // tells you the book is empty, briefly and wrongly, on every visit.
    expect(line(null)).toBeNull()
  })

  it('names the wishlist state instead of printing a zero', () => {
    expect(line({ total: 0, favourites: 0, noted: 0, tagged: 0 })).toBe('no quotes yet')
  })

  it('drops the three that are zero and keeps the total', () => {
    expect(line({ total: 7, favourites: 0, noted: 0, tagged: 0 })).toBe('7 quotes')
  })

  it('prints every part that has something in it', () => {
    const t = line({ total: 12, favourites: 3, noted: 5, tagged: 8 })
    expect(t).toContain('12 quotes')
    expect(t).toContain('3 favourites')
    expect(t).toContain('5 noted')
    expect(t).toContain('8 tagged')
  })

  it('says one quote, not 1 quotes', () => {
    expect(line({ total: 1, favourites: 1 })).toBe('1 quote·1 favourite')
  })

  it('takes the film side’s word for what it is counting', () => {
    expect(line({ total: 4 }, { noun: ['line', 'lines'] })).toBe('4 lines')
    expect(line({ total: 0 }, { noun: ['line', 'lines'] })).toBe('no lines yet')
  })

  it('carries the accent on the total and nothing else', () => {
    // The number you came for is the one you see first; the breakdown sits back.
    cleanup()
    render(<HeroCounts counts={{ total: 9, favourites: 2 }} />)
    const marked = document.querySelectorAll('.hero-counts-total')
    expect(marked).toHaveLength(1)
    expect(marked[0].textContent).toBe('9 quotes')
  })

  it('asks for amber by prop, because there is no page class to inherit', () => {
    cleanup()
    const { container } = render(<HeroCounts counts={{ total: 2 }} tone="amber" />)
    expect(container.querySelector('.hero-counts').className).toContain('hero-counts-amber')
    cleanup()
    const plain = render(<HeroCounts counts={{ total: 2 }} />).container
    expect(plain.querySelector('.hero-counts').className).not.toContain('hero-counts-amber')
  })

  it('hides the separators from a screen reader', () => {
    // The middot is punctuation between numbers, not a word to be read out.
    cleanup()
    render(<HeroCounts counts={{ total: 3, favourites: 1, noted: 1 }} />)
    for (const s of document.querySelectorAll('.hero-counts-sep')) {
      expect(s.getAttribute('aria-hidden')).toBe('true')
    }
  })
})

describe('taking one row back out', () => {
  const stats = { total: 10, favourites: 4, noted: 3, tagged: 6 }

  it('subtracts what THAT row contributed, not just the total', () => {
    // The point of the helper. Deleting a favourited, noted, tagged quote has to
    // take one off all four, and deleting a bare one has to take one off the total
    // alone — a blanket decrement would drift the breakdown a little at a time.
    expect(minusQuote(stats, q({ favorite: true, note: 'x', tags: ['a'] }))).toEqual({
      total: 9,
      favourites: 3,
      noted: 2,
      tagged: 5,
    })
    expect(minusQuote(stats, q())).toEqual({ total: 9, favourites: 4, noted: 3, tagged: 6 })
  })

  it('never goes below zero', () => {
    // A double-fire, or a delete of a row the counts never saw, must not print
    // "-1 quotes" — which is the kind of thing a hero shows for the rest of a
    // session because nothing throws.
    const out = minusQuote({ total: 0, favourites: 0, noted: 0, tagged: 0 }, q({ favorite: true }))
    expect(out).toEqual({ total: 0, favourites: 0, noted: 0, tagged: 0 })
  })

  it('passes null through, because a delete can land before the counts do', () => {
    expect(minusQuote(null, q())).toBeNull()
  })
})
