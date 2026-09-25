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
// text, a drawing, a control's own outline. The right edge is compared too, except
// on a card holding a row that scrolls sideways — a row of chips there runs under
// a fade on purpose, so its right edge is the card's border by design.
//
// Mutations: with the row's pull-up removed (the rule that makes the drawing, not the
// box, sit at the inset), the top reads about 25px against 19 and this fails; with
// the range input left inline, Review's "Schedule" card is about 7px heavier at the
// bottom and the second case fails.

import { expect, it } from 'vitest'

import { PHONE, openApp } from './harness/world.mjs'

const app = openApp({ viewport: PHONE })

async function insets(names) {
  return app.page.evaluate((names) => names.map((name) => {
    // A card head is numbered when a section has two or more ("2 · Schedule"), so
    // the name may follow a short ordinal; it is still the name as printed.
    const label = [...document.querySelectorAll('span, h2, h3, p')].find((e) => {
      const t = e.textContent.trim()
      return t === name || (t.endsWith(name) && t.length <= name.length + 5)
    })
    if (!label) return { name, missing: true }
    let card = label.parentElement
    while (card && getComputedStyle(card).borderTopWidth === '0px') card = card.parentElement
    const r = card.getBoundingClientRect()
    // A BORDER PAINTS ITS OWN EDGE, NOT THE BOX IT BOUNDS. A row ruled off from
    // the one above by a top border would otherwise count its whole box — air
    // below the drawing included — as painted, which is how a card ending on a
    // slider measured even while it was 7px heavier at the bottom.
    const paints = []
    for (const e of card.querySelectorAll('*')) {
      const b = e.getBoundingClientRect()
      if (!b.width || !b.height) continue
      const cs = getComputedStyle(e)
      const text = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
      if (text || e.tagName === 'svg' || e.tagName === 'INPUT' || !/rgba\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor)) { paints.push(b); continue }
      const w = (side) => parseFloat(cs[`border${side}Width`]) || 0
      if (w('Top')) paints.push({ top: b.top, bottom: b.top + w('Top'), left: b.left, right: b.right })
      if (w('Bottom')) paints.push({ top: b.bottom - w('Bottom'), bottom: b.bottom, left: b.left, right: b.right })
      if (w('Left')) paints.push({ top: b.top, bottom: b.bottom, left: b.left, right: b.left + w('Left') })
      if (w('Right')) paints.push({ top: b.top, bottom: b.bottom, left: b.right - w('Right'), right: b.right })
    }
    const scrolls = [...card.querySelectorAll('*')].some((e) => e.scrollWidth > e.clientWidth + 1 && /auto|scroll|hidden/.test(getComputedStyle(e).overflowX))
    return {
      name,
      top: Math.min(...paints.map((b) => b.top)) - r.top,
      left: Math.min(...paints.map((b) => b.left)) - r.left,
      bottom: r.bottom - Math.max(...paints.map((b) => b.bottom)),
      right: scrolls ? null : r.right - Math.max(...paints.map((b) => b.right)),
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
      if (c.right != null) expect(Math.abs(c.right - c.left), `${where} ${c.name}: right ${c.right.toFixed(1)} against left ${c.left.toFixed(1)}`).toBeLessThanOrEqual(3)
    }
  }
  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})

it('every card in a Settings section has even margins, a card ending on a slider too', async () => {
  await app.goto('/settings/review')
  await app.see('Schedule')
  for (const c of await insets(['The deck and what it asks', 'Schedule', 'Practice'])) {
    expect(c.missing, `${c.name} is not on Review`).toBeFalsy()
    expect(Math.abs(c.top - c.left), `Review ${c.name}: top ${c.top.toFixed(1)} against left ${c.left.toFixed(1)}`).toBeLessThanOrEqual(3)
    expect(Math.abs(c.bottom - c.left), `Review ${c.name}: bottom ${c.bottom.toFixed(1)} against left ${c.left.toFixed(1)}`).toBeLessThanOrEqual(3)
  }
  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
