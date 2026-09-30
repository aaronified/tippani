// A reader on a phone opens Settings › Jobs while a fill is running, and the card
// reads as one thing: the fold is on the card's title, the job's Stop is beside the
// job's name, and the card's content sits as far from its bottom edge as from its
// sides.
//
// WHAT WENT WRONG, and the owner photographed it (30 September). At 390 wide the
// Current jobs card drew its fold as a round button on a row of its own, under Stop
// all and away from the title it folded; the running job's Stop wrapped under the
// job's name and left the rest of that row empty; and the last row's own 14px
// stood on the card's padding, 35px at the bottom against 21 at the sides.
//
// WHY A JOURNEY. Each is what the layout does at a width, with a job really
// running on a real server, and nothing in the source is wrong to look at. A
// picture of it would pass a reader's eye one step at a time, which is how the card
// shipped this way.
//
// DECLARED EXCEPTIONS, and what each knows:
//   - TIPPANI_JOBS_HOLD=running, the server's test seam (internal/jobs/runner.go):
//     the worker holds the first job running before its first step, until a Stop
//     ends it. Offline — and every journey server is offline — a fill finishes in
//     milliseconds, before a running row could be looked at. The server honours
//     the switch only while offline.
//   - SETUP KNOWS `GET /api/books` and its `books` and `id` fields, and
//     `POST /api/jobs` with `kind: 'fill'` and `book_ids`, to start one fill.
//   - `app.page` MEASURES WHERE THINGS SIT, which no word of the vocabulary says:
//     the controls are found by the names a reader's screen reader would read
//     ("Fold current jobs", "Stop all", "Stop Fill gaps (running)") and the job's
//     row by its own name, the card by its name as a region ("Current jobs").
//
// THE MUTATIONS, each built and run and put back:
//   - the fold back among the head's far-end controls (the IconButton the door
//     replaced, in jobsSection.jsx): red, the fold sits below Stop all (its top at
//     171 against Stop all's bottom at 163);
//   - `.job-row-head > .job-head { flex-basis: 0 }` taken out of index.css: red,
//     the job's Stop sits under its name;
//   - `.job-list > .job-row:last-child .job-body { padding-bottom: 0 }` taken out:
//     red, "inset 35px at the bottom, 23px at the side";
//   - `.jobs-card .job-list { margin-top }` taken out: red, Stop all and the job's
//     Stop are 4px apart rather than a row.

import { expect, it } from 'vitest'

import { PHONE, openApp } from './harness/world.mjs'

const app = openApp({ viewport: PHONE, env: { TIPPANI_JOBS_HOLD: 'running' } })

it('on a phone the running job card folds from its title, keeps Stop beside the job, and insets evenly', async () => {
  const { books } = await app.setup('GET', '/books')
  await app.setup('POST', '/jobs', { kind: 'fill', params: { book_ids: books.slice(0, 5).map((b) => b.id) } })

  await app.goto('/settings/jobs')
  await app.see('1 running')
  await app.see('Stop all')

  const at = await app.page.evaluate(() => {
    const card = document.querySelector('section[aria-label="Current jobs"]')
    const named = (n) => [...card.querySelectorAll('button')]
      .find((b) => (b.getAttribute('aria-label') || b.textContent.trim()) === n)
    const box = (el) => el && el.getBoundingClientRect().toJSON()
    const row = [...card.querySelectorAll('button[aria-expanded]')]
      .find((b) => b.textContent.startsWith('Fill gaps'))
    // The content's extent, as a reader sees it: the edges of what PAINTS — an
    // element with no element inside it, or one that draws a background or a bottom
    // border. A wrapper's box reaches past its children by its own padding, and a
    // measure of wrappers would count the very padding this asks about.
    const painted = [...card.querySelectorAll('*')].filter((e) => {
      const b = e.getBoundingClientRect()
      if (!(b.width > 0 && b.height > 0)) return false
      const cs = getComputedStyle(e)
      const fill = cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent'
      return e.children.length === 0 || fill || parseFloat(cs.borderBottomWidth) > 0
    })
    const bottom = Math.max(...painted.map((e) => e.getBoundingClientRect().bottom))
    const left = Math.min(...painted.map((e) => e.getBoundingClientRect().left))
    const c = card.getBoundingClientRect()
    return {
      fold: box(named('Fold current jobs')),
      stopAll: box(named('Stop all')),
      stop: box(named('Stop Fill gaps (running)')),
      row: box(row),
      insetSide: left - c.left,
      insetBottom: c.bottom - bottom,
    }
  })

  expect(at.fold, 'the card has no fold').toBeTruthy()
  expect(at.fold.top, 'the fold sits on a row below Stop all').toBeLessThan(at.stopAll.bottom)
  expect(at.stop.top, "the job's Stop sits under its name, not beside it").toBeLessThan(at.row.bottom)
  expect(at.stop.top - at.stopAll.bottom, "Stop all and the job's Stop are not a row apart").toBeGreaterThanOrEqual(12)
  expect(Math.abs(at.insetBottom - at.insetSide), `inset ${Math.round(at.insetBottom)}px at the bottom, ${Math.round(at.insetSide)}px at the side`).toBeLessThanOrEqual(2)
  expect(await app.sideways()).toBe(0)

  // AND THE DOOR FOLDS: the counts and Stop all stay, the running row goes — its
  // progress, "0 of 5", is on no other card.
  await app.see('0 of 5')
  await app.press('Fold current jobs')
  await app.gone('0 of 5')
  await app.see('1 running')
  await app.see('Stop all')
  await app.press('Show current jobs')
  await app.see('0 of 5')
})
