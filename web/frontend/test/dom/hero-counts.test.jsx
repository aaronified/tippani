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

// TWO READINGS, because there are now two tiers and conflating them is what the
// old single-string helper did. `lead` is the headline — the number you came for
// and its noun — and `rest` is the breakdown one tier down. A helper that glued
// them into one string could not tell "12 quotes, 3 of them favourites" from a
// flat row of four equal numbers, which is precisely the difference this design
// turns on.
function lead(counts, props = {}) {
  cleanup()
  const { container } = render(<HeroCounts counts={counts} {...props} />)
  const el = container.querySelector('.hero-counts')
  if (!el) return null
  const num = el.querySelector('.hero-counts-total')
  const word = el.querySelector('.hero-counts-word')
  // The space is CSS (a flex gap), so it is supplied here rather than read: the
  // two spans are separate boxes and textContent would run them together.
  if (num && word) return `${num.textContent} ${word.textContent}`
  return el.querySelector('.hero-counts-empty')?.textContent ?? null
}

// The breakdown, or null when there is nothing to break down.
function rest(counts, props = {}) {
  cleanup()
  const { container } = render(<HeroCounts counts={counts} {...props} />)
  return container.querySelector('.hero-counts-rest')?.textContent ?? null
}

// Still rendered at all? The whole component is absent while counts are loading.
function present(counts, props = {}) {
  cleanup()
  const { container } = render(<HeroCounts counts={counts} {...props} />)
  return !!container.querySelector('.hero-counts')
}

describe('the line it prints', () => {

  it('drops the three that are zero and keeps the total', () => {
    expect(lead({ total: 7, favourites: 0, noted: 0, tagged: 0 })).toBe('7 quotes')
    // Not "an empty breakdown row": no row at all, so the headline has nothing
    // hanging under it.
    expect(rest({ total: 7, favourites: 0, noted: 0, tagged: 0 })).toBeNull()
  })

})

