// THE TWO DIALS REACH A QUOTE, AND SURVIVE A RELOAD.
//
// docs/plans/access.md's verification row for §6 reads: "Size, leading and measure
// reach the quote surfaces and survive a reload; the defaults are unchanged for a
// reader who sets nothing." (Quoted rather than cited by line: the first draft of
// this header said access.md:138 and the SAME COMMIT moved it, because that commit
// edited access.md too. fonts.js records the rule — a line number in a comment is a
// fact with no guard on it; the quoted words are greppable and never rot.) Size
// already shipped, so the two
// this change adds are leading and measure. quote-dials.test.js proves the
// arithmetic and the defaults without a DOM; this proves the wiring — the
// properties land on <html>, they inherit down to the words, and the slot is
// asking for them rather than for a number of its own.
//
// A RELOAD IS `applyTypeScale(user.preferences)` AND NOTHING ELSE. App.jsx calls
// it once with whatever the server sent (App.jsx:209), so replaying that call
// with a stored preferences object is the reload, faithfully: there is no other
// path by which a saved dial reaches a page.
//
// jsdom DOES NOT RESOLVE var() IN A SHORTHAND, which is why the assertions are
// shaped the way the language-font suites already shaped theirs: the honest pair
// is the custom property reaching the element and the slot deferring to it. A
// test that asked getComputedStyle for a line-height would read the literal
// string "var(--quote-leading)" and pass on a page where the property was never
// written at all.
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { QUOTE_TEXT } from '../../src/fonts.js'
import { QUOTE_LEADINGS, QUOTE_MEASURES, applyTypeScale } from '../../src/type.js'

// One quote slot, set the way every quote slot in the app is set.
const Quote = () => <p style={{ ...QUOTE_TEXT, fontSize: 'var(--type-display-17)' }}>Der Mensch ist frei</p>

afterEach(() => {
  applyTypeScale({})
  document.documentElement.style.removeProperty('--quote-leading')
  document.documentElement.style.removeProperty('--quote-measure')
})

describe('a reader who has set both dials', () => {
  it('gets them on the quote, through the properties rather than through a number', () => {
    applyTypeScale({ quoteLeading: 190, quoteMeasure: 45 })
    render(<Quote />)
    const p = screen.getByText(/Der Mensch ist frei/)

    // The values inherit from <html> down to the words.
    expect(getComputedStyle(p).getPropertyValue('--quote-leading').trim()).toBe('1.9')
    expect(getComputedStyle(p).getPropertyValue('--quote-measure').trim()).toBe('45ch')
    // And the slot defers to them instead of carrying its own.
    expect(p.style.lineHeight, 'the slot writes a leading of its own').toContain('--quote-leading')
    expect(p.style.maxWidth, 'the slot writes a measure of its own').toContain('--quote-measure')
  })

  it('and every position of each dial reaches the page', () => {
    // Not one value that happened to be true when this was written — the same
    // lesson the Go size test records, where a withdrawn step broke a behaviour
    // case that had nothing to do with the behaviour.
    for (const n of QUOTE_LEADINGS) {
      applyTypeScale({ quoteLeading: n })
      expect(document.documentElement.style.getPropertyValue('--quote-leading'), `leading ${n}`)
        .toBe(String(n / 100))
    }
    for (const n of QUOTE_MEASURES) {
      applyTypeScale({ quoteMeasure: n })
      expect(document.documentElement.style.getPropertyValue('--quote-measure'), `measure ${n}`)
        .toBe(n ? `${n}ch` : 'none')
    }
  })

  it('and still has them after a reload', () => {
    // The round trip: a dial is set, the page is thrown away, and the app boots
    // again from what the server stored. Nothing is remembered on the element.
    const stored = { quoteLeading: 130, quoteMeasure: 80 }
    applyTypeScale(stored)
    const { unmount } = render(<Quote />)
    unmount()
    document.documentElement.style.removeProperty('--quote-leading')
    document.documentElement.style.removeProperty('--quote-measure')

    applyTypeScale(stored) // App.jsx:209, with the preferences the server sent
    render(<Quote />)
    const p = screen.getByText(/Der Mensch ist frei/)
    expect(getComputedStyle(p).getPropertyValue('--quote-leading').trim()).toBe('1.3')
    expect(getComputedStyle(p).getPropertyValue('--quote-measure').trim()).toBe('80ch')
  })
})

describe('a reader who has set neither', () => {
  it('gets the leading the app has always drawn and no measure at all', () => {
    // THE CASE THIS FILE EXISTS FOR. Everybody's account stores 0 for both today,
    // so if this one is wrong the change restyles every library on upgrade.
    applyTypeScale({})
    render(<Quote />)
    const p = screen.getByText(/Der Mensch ist frei/)
    expect(getComputedStyle(p).getPropertyValue('--quote-leading').trim()).toBe('1.55')
    expect(getComputedStyle(p).getPropertyValue('--quote-measure').trim()).toBe('none')
  })
})

// ---- and the element it lands on can actually honour it -----------------------
//
// THE DEFECT THIS WAS WRITTEN FOR, found by a rater on the commit that added the
// measure: `max-width` has NO EFFECT on a non-replaced INLINE element (CSS 2.1
// §10.4). `MatchWindow` put QUOTE_TEXT on a bare <span>, so the reading-comfort
// dial reached every quote surface in the app EXCEPT the five search slots — and
// it failed SILENTLY, because the leading went on working and only the width did
// not. The CHANGELOG meanwhile promised it worked "in a search result".
//
// SO THE QUESTION IS ABOUT THE RENDERED ELEMENT, NOT THE STYLE OBJECT. Asserting
// that QUOTE_TEXT carries a maxWidth — which the file above already does — cannot
// see this: the object was right and the element could not obey it. This renders
// each shape a quote is actually drawn in and asks what the browser would do.
//
// REPLACED ELEMENTS ARE THE ONE EXEMPTION AND IT IS REAL, NOT A LOOPHOLE. A
// <textarea> (the capture box, AddSurface.jsx:1287) is a replaced element, and
// max-width applies to those whatever their display computes to. jsdom's default
// sheet reports `inline` for one where a browser computes `inline-block`, so the
// walk would fail on a slot that is genuinely fine.
const REPLACED = new Set(['TEXTAREA', 'INPUT', 'IMG', 'VIDEO', 'CANVAS', 'SELECT', 'OBJECT'])

// Every element carrying an inline max-width that a browser would ignore.
function deafToTheMeasure(container) {
  return [...container.querySelectorAll('*')]
    .filter((el) => el.style?.maxWidth)
    .filter((el) => !REPLACED.has(el.tagName))
    .filter((el) => getComputedStyle(el).display === 'inline')
    .map((el) => `${el.tagName.toLowerCase()} "${(el.textContent || '').slice(0, 24)}"`)
}

describe('the element the measure lands on', () => {
  it('is one a browser would apply max-width to — every shape a quote is drawn in', async () => {
    const { MatchWindow } = await import('../../src/SearchPage.jsx')
    const { ExpandableText } = await import('../../src/ui.jsx')
    const { QuoteBlock } = await import('../../src/review.jsx')
    const style = { ...QUOTE_TEXT, fontSize: 'var(--type-display-15)' }

    // A short hit: MatchWindow's un-windowed branch, the one that returns `inner`.
    const short = render(<MatchWindow text="Der Mensch ist frei" terms={['frei']} style={style} />)
    expect(deafToTheMeasure(short.container), 'a short search hit').toEqual([])

    // A long hit with the match in the middle: the WINDOWED branch, which is the
    // one most real results take and which used to be a second inline span.
    const long = 'x '.repeat(140) + 'frei ' + 'y '.repeat(140)
    const windowed = render(<MatchWindow text={long} terms={['frei']} style={style} />)
    expect(deafToTheMeasure(windowed.container), 'a windowed search hit').toEqual([])

    // The two shapes the boards draw.
    const exp = render(<ExpandableText text="Der Mensch ist frei" lines={2} style={style} />)
    expect(deafToTheMeasure(exp.container), 'a board card').toEqual([])

    const deck = render(<QuoteBlock card={{ quote: 'Der Mensch ist frei', color: 'yellow' }} />)
    expect(deafToTheMeasure(deck.container), 'the recall deck').toEqual([])
  })

  it('and this walk can fail — an inline span with a measure is caught', () => {
    // THE FLOOR. Every case above compares against [], so a walk that finds no
    // measured element passes while checking nothing. This is the same shape the
    // defect had, built on purpose.
    const { container } = render(<span style={{ maxWidth: '45ch' }}>Der Mensch ist frei</span>)
    expect(deafToTheMeasure(container)).toHaveLength(1)
  })
})
