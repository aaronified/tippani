// A reader opens Metadata and Settings on a phone, and every section's card has
// the same air on its left, top and bottom edges.
//
// WHAT THIS GUARDS. The owner, twice: "The horizontal spaces are still too thin,
// especially near the borders of the cards … Horizontal and vertical spacing
// should match." The first fix matched the boxes and not the drawing; the second
// matched the sides and left the top 6px deeper. Neither was visible to a test,
// because nothing measured it.
//
// DECLARED EXCEPTION: GEOMETRY READ OFF THE PAGE. "The same air on every edge" is
// a distance, and the vocabulary has words, not rulers. The card is found as the
// nearest thing around the section's name that draws a border — what a reader
// sees as the card's edge — and what counts as its content is whatever paints:
// text, a drawing, a control's own outline. The right edge is not compared, because
// a row of chips there scrolls under a fade on purpose.
//
// Mutation: with the row's pull-up removed (the rule that makes the drawing, not the
// box, sit at the inset), the top reads about 25px against 19 and this fails.

import { expect, it } from 'vitest'

import { PHONE, openApp } from './harness/world.mjs'

const app = openApp({ viewport: PHONE })

async function insets(names) {
  return app.page.evaluate((names) => names.map((name) => {
    const label = [...document.querySelectorAll('span, h2, h3, p')].find((e) => e.textContent.trim() === name)
    if (!label) return { name, missing: true }
    let card = label.parentElement
    while (card && getComputedStyle(card).borderTopWidth === '0px') card = card.parentElement
    const r = card.getBoundingClientRect()
    const paints = [...card.querySelectorAll('*')].filter((e) => {
      const b = e.getBoundingClientRect()
      if (!b.width || !b.height) return false
      const cs = getComputedStyle(e)
      const text = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
      return text || e.tagName === 'svg' || cs.borderTopWidth !== '0px' || !/rgba\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor)
    }).map((e) => e.getBoundingClientRect())
    return {
      name,
      top: Math.min(...paints.map((b) => b.top)) - r.top,
      left: Math.min(...paints.map((b) => b.left)) - r.left,
      bottom: r.bottom - Math.max(...paints.map((b) => b.bottom)),
    }
  }), names)
}

it('every section card on the phone index has even margins', async () => {
  for (const [where, names] of [['/metadata', ['Works', 'People', 'Characters', 'Sources']], ['/settings', ['Theme', 'Review', 'Sections']]]) {
    await app.goto(where)
    await app.see(names[0])
    for (const c of await insets(names)) {
      expect(c.missing, `${c.name} is not on ${where}`).toBeFalsy()
      expect(Math.abs(c.top - c.left), `${where} ${c.name}: top ${c.top.toFixed(1)} against left ${c.left.toFixed(1)}`).toBeLessThanOrEqual(3)
      expect(Math.abs(c.bottom - c.left), `${where} ${c.name}: bottom ${c.bottom.toFixed(1)} against left ${c.left.toFixed(1)}`).toBeLessThanOrEqual(3)
      expect(c.left, `${where} ${c.name}: content ${c.left.toFixed(1)}px from the border`).toBeGreaterThanOrEqual(14)
    }
  }
  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
