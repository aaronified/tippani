// A reader on a phone drags one of the schedule's numbers, and has the whole width
// of the card to do it in.
//
// WHAT WENT WRONG. The ten tuning numbers are rows — label on the left, range
// beside it — and on a phone the row wraps, so the range drops to its own line.
// `.pref-row-control` shrink-wraps, which is right for a toggle and a picker and
// wrong for the one control whose PRECISION IS ITS WIDTH: the track stopped at
// about half the row with the rest of the line empty beside it, so a twenty-stop
// range had two stops under a thumb. The owner, of the screenshot: "the sliders
// above should take up the whole width on phone."
//
// WHY THIS IS A MEASUREMENT AND NOT A `see`. There is nothing to read. The screen
// says the same words whichever width the track is, and a screenshot of a short
// track looks like a screenshot of a slider — which is exactly how it shipped.
// `page` is the harness's escape hatch and this is what it is for: a fact about
// the rendered screen that has no words in it.
//
// THE MUTATION. Take the `@media (max-width: 768px)` block off
// `.pref-row-control:has(.tp-slider)` in index.css, `make frontend`, and the ratio
// measured here falls to about half. The threshold is 0.9 rather than 1 because
// the row keeps its own edge padding, which a track should not eat.
//
// It knows the words on the screen and one measurement of it — no class, no
// component, no preference key.

import { expect, it } from 'vitest'

import { PHONE, openApp } from './harness/world.mjs'

const app = openApp({ viewport: PHONE })

it('a tuning slider takes the whole width of its card on a phone', async () => {
  await app.goto('/settings/review')
  // The row is on the screen before anything is measured: a measurement of a
  // control that has not rendered is a measurement of zero, and zero divided by
  // the card is not a ratio anybody wants to read.
  await app.see('Ladder rung 1')

  const ratio = await app.page.evaluate(() => {
    // BY THE WORDS ON THE SCREEN, like everything else here: find the row whose
    // text says "Ladder rung 1", then the range inside it, then compare what the
    // range got against what the row had to give.
    const rows = [...document.querySelectorAll('*')].filter(
      (el) => el.querySelector('input[type="range"]') && /Ladder rung 1/.test(el.textContent),
    )
    // The innermost one: every ancestor up to <body> also contains both.
    const row = rows[rows.length - 1]
    if (!row) return null
    const track = row.querySelector('input[type="range"]')
    return track.getBoundingClientRect().width / row.getBoundingClientRect().width
  })

  expect(ratio, 'no row on this screen holds a range with that label').not.toBeNull()
  expect(ratio, 'the track is a fraction of the row it sits in — a phone thumb has two stops to aim at')
    .toBeGreaterThan(0.9)

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
