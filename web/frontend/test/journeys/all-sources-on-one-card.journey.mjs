// An owner opens Metadata › Sources on a desk and finds every supplier on one card,
// "All sources", across the page, and a supplier's key opens from that supplier's
// own row.
//
// THE OWNER'S ASK, 30 September: "who the app can ask, and keys and credentials can
// be merged into one card (full width in desktop). Just add the edit buttons in the
// 'who the app can ask' card. The combined card can be renamed to 'all sources'."
// The keys were a second card under the supplier list, a scroll away from the row
// whose mark they turn green, and each card took half the page.
//
// WHY A JOURNEY. Whether a card spans the page is what the grid does at a width,
// and whether a key opens from its row is a press.
//
// DECLARED EXCEPTION: `app.page` MEASURES the card's width against the page's
// two-column grid of cards, finding the card as the box around the words "All
// sources" that sits directly in that grid, because no word of the vocabulary
// measures a width.
//
// THE MUTATIONS, each run and put back (MetadataSources.jsx):
//   - `is-wide` taken off the card: red, "the card is 490px of a 1004px column";
//   - the row's setup door taken out of SourceRows: red, "nothing a person could
//     press is named "Set up TMDB"".
// A first draft measured the card against the list of rows inside it, which is a
// grid too, and passed with `is-wide` gone; it is measured against the two-column
// grid now.

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()

it('every supplier is on one full-width card, and a key opens from its supplier’s row', async () => {
  await app.goto('/metadata/sources')
  await app.see('All sources')
  await app.gone('Keys and credentials')
  await app.gone('TMDB key')

  const at = await app.page.evaluate(() => {
    const title = [...document.querySelectorAll('body *')]
      .filter((e) => e.textContent.toLowerCase().includes('all sources'))
      .sort((a, b) => a.textContent.length - b.textContent.length)[0]
    // The card is the box around the title that sits directly in the page's grid of
    // cards, the one grid on the way up with two columns: the list of rows inside the
    // card is a grid too, and a measure against it compares the card with itself
    // (a first draft did, and passed with the card at half width).
    const twoColumns = (el) => getComputedStyle(el).gridTemplateColumns.split(' ').filter(Boolean).length >= 2
    let card = title
    while (card.parentElement && !twoColumns(card.parentElement)) card = card.parentElement
    const column = card.parentElement
    return { card: card.getBoundingClientRect().width, column: column.getBoundingClientRect().width }
  })
  expect(at.card / at.column, `the card is ${Math.round(at.card)}px of a ${Math.round(at.column)}px column`).toBeGreaterThan(0.95)

  await app.press('Set up TMDB')
  await app.see('TMDB key')
  expect(await app.sideways()).toBe(0)
  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
