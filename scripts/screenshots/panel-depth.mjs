#!/usr/bin/env node
// A PANEL THAT OPENS ANOTHER PANEL — measured in a real browser, because this is
// the one that jsdom cannot see.
//
// THE FAILURE THIS EXISTS FOR. `usePanelStack().open()` replaces what is open
// rather than deepening it, so it walks history back and then pushes. Written as
// `history.go(-n)` followed by `requestAnimationFrame(push)`, the push landed
// before the pop and the stack's own popstate handler truncated away the panel
// that had just been opened. Pressing a panel's own door therefore closed
// everything and opened nothing.
//
// IT IS BROWSER-ONLY, AND IT DOES CATCH THE RACE. Reverted to the shipped
// `requestAnimationFrame(() => push(panel))` on a freshly rebuilt binary — the
// embed verified by asset hash, because a stale one has produced a false reading
// here before — it prints `FAIL … left NOTHING open (depth 0)` and exits 1, five
// runs out of five. Against the fix: `ok … depth 1`. jsdom cannot do this;
// `test/dom/panel-opens-panel.test.jsx` passes either way and says so.
//
// A RETRACTION THAT WAS ITSELF WRONG, recorded because it nearly shipped. One
// run of this probe against the broken version came back `ok`, and that single
// observation was generalised into "the probe does not discriminate" and written
// into four places, this header among them. Five controlled runs then failed
// five times. The anomaly was almost certainly a seeding gap in that one attempt
// — the chip it pressed reached a different surface — and the lesson is the
// obvious one: a single pass is not evidence of a negative, and a probe that
// depends on a seeded fixture must be run with the seed verified.
//
// WHAT IT PRESSES, AND THE DOOR IT USED TO PRESS IS GONE. A film page draws no
// cast: the cast moved into the Details panel when that screen was built to the
// pack, so "a film page, a cast chip, then that row" stopped being a path. The
// two chips left on a film page are the CREDITS row's — the director's — and
// they open the older person modal rather than a panel, so this probe reported
// "no chip on movie 2 opens a panel" and exited 1 on every run while three
// places in the repo called it the guard for the race. Found by extending it,
// not by running it, which is the argument for running a guard on the schedule
// its subject changes on.
//
// The path now is the reader's: a film page, Details, a face in its cast strip —
// the same two presses `controls.mjs` had to learn for the same reason.
//
// AND WHAT IT CAN SEE. Three things, all browser-only:
//
//   THE STACK AND HISTORY AGREE. A panel opened from inside a panel is on screen
//   and `history.state.tpPanelDepth` counts it. The race left nothing open; the
//   first repair for the race left the depth disagreeing with the stack, which is
//   what makes the ✕ stop working (`panel-open-replaces.test.jsx` has that story).
//
//   ANSWERING A QUESTION LANDS ON THE ANSWER. The chooser a chip opens is itself
//   a panel and every row answers with `open()`, which replaces the top — so a
//   row that also dismisses the question pops the entry UNDER its own answer and
//   closes everything. Four cases in `speaker-destinations.test.jsx` passed
//   against exactly that, because `history.back()` in jsdom delivers no popstate.
//
//   THE BACK CRUMB STAYS OUT OF THE TITLE, which jsdom cannot answer at all.
//
// NONE OF THE THREE MAY REPORT NOTHING AS OK. Every case here either presses its
// subject or fails: a fixture that has drifted out from under a probe leaves the
// probe knowing less than before it ran, and a `note` in the log is how that
// reads as a pass to whoever is looking at the exit code. Two of them used to do
// exactly that. Proven by mutation rather than asserted: with the search below
// asked for 99 answers instead of 2 — a fixture that cannot show the subject —
// the run prints the FAIL and exits 1, and prints the ok and exits 0 as shipped.
//
import puppeteer from 'puppeteer-core'

import { HARNESS_ACCOUNT, emulateEngineMedia, ensureSession, findBrowser, launchOptions } from './capture.mjs'

function parseArgs(argv) {
  const out = { baseUrl: 'http://127.0.0.1:8080', movieId: '1', timeoutMs: 30000 }
  for (let i = 0; i < argv.length; i++) {
    const next = () => argv[++i]
    if (argv[i] === '--base-url') out.baseUrl = next()
    else if (argv[i] === '--movie-id') out.movieId = next()
    else if (argv[i] === '--timeout') out.timeoutMs = Number(next())
    else if (argv[i] === '--help' || argv[i] === '-h') {
      console.log('usage: node panel-depth.mjs [--base-url URL] [--movie-id N]\n\n' +
        'Opens a film page, its Details panel and a character from the cast strip,\n' +
        'then checks that history counted both panels, that answering a chip\'s\n' +
        'question lands on the answer, and that the back crumb does not print\n' +
        'over the title beside it.')
      process.exit(0)
    }
  }
  return out
}

const opts = parseArgs(process.argv.slice(2))
const engine = findBrowser(null, 'chrome')
const browser = await puppeteer.launch(launchOptions(engine, { viewport: { width: 390, height: 844 } }))
let failures = 0
try {
  const page = await browser.newPage()
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 })
  await emulateEngineMedia(page, engine.browser, 'light')
  await ensureSession(page, {
    baseUrl: opts.baseUrl,
    username: HARNESS_ACCOUNT.username,
    password: HARNESS_ACCOUNT.password,
    timeoutMs: opts.timeoutMs,
  })

  await page.goto(`${opts.baseUrl}/catalogue/${opts.movieId}`, { waitUntil: 'networkidle2' })
  await page.waitForSelector('.tp-btn', { timeout: opts.timeoutMs })

  // 1. DETAILS, which is a panel over the screen.
  const opened = await page.evaluate(() => {
    const b = [...document.querySelectorAll('.tp-btn')].find((x) => x.textContent.trim() === 'Details')
    if (!b) return false
    b.click()
    return true
  })
  if (!opened) {
    console.log('FAIL  this film page has no Details key, so the cast this probe reaches through is unreachable')
    process.exit(1)
  }
  await new Promise((r) => setTimeout(r, 1600))

  // 2. A FACE IN ITS CAST STRIP, which is a panel opened from inside a panel.
  // A tile with no record behind it opens nothing and says so with aria-disabled;
  // picking one of those would report the app broken over a gap in the fixture.
  const tile = await page.evaluate(() => {
    const t = document.querySelector('.cs-face-tile:not([aria-disabled])')
    if (!t) return null
    const text = t.textContent.replace(/\s+/g, ' ').trim().slice(0, 40)
    t.click()
    return text
  })
  if (tile === null) {
    console.log('FAIL  the Details panel on movie ' + opts.movieId + ' offers no openable cast face — this probe ' +
      'cannot see its subject, which is not the same as the subject being well')
    process.exit(1)
  }
  console.log(`      opened a character from the cast face ${JSON.stringify(tile)}`)
  await new Promise((r) => setTimeout(r, 1600))

  const after = await page.evaluate(() => {
    const p = document.querySelector('.tp-panel')
    return { panels: document.querySelectorAll('.tp-panel').length, depth: window.history.state?.tpPanelDepth ?? 0,
             crumbs: document.querySelectorAll('.tp-panel-head .tp-panel-back-word').length,
             text: p ? p.textContent.replace(/\s+/g, ' ').slice(0, 80) : '' }
  })

  // THE ASSERTION. A panel must be on screen, history must have counted BOTH of
  // them, and the one on top must know it is nested — a head with no crumb is a
  // panel that has forgotten where it came from, which is the same disagreement
  // between the stack and history seen from the other side.
  if (after.panels < 1) {
    console.log(`FAIL  opening a panel from inside a panel left NOTHING open (depth ${after.depth})`)
    failures++
  } else if (after.depth !== 2) {
    console.log(`FAIL  two panels were opened and history records depth ${after.depth}, so the way out walks to the wrong place`)
    failures++
  } else if (after.crumbs < 1) {
    console.log('FAIL  the nested panel draws no back crumb, so it does not know what it is on top of')
    failures++
  } else {
    console.log(`ok    a panel opened from inside a panel — depth 2, showing ${JSON.stringify(after.text)}`)
  }

  // ── AND ANSWERING A QUESTION LANDS ON THE ANSWER, which is the third thing
  // only a browser can answer and the one that cost a working door.
  //
  // A character chip on a quote card asks which record you meant, and the sheet
  // it asks in is a PANEL: every row answers with `open()`, which REPLACES the
  // top. The first cut had the rows dismiss the question afterwards — right for
  // the modal it used to be, one entry too far for a panel — so the press popped
  // the entry UNDER the answer, the popstate guard truncated the stack, and
  // pressing an answer closed everything. jsdom cannot see it: `history.back()`
  // there delivers no popstate, so four cases in `speaker-destinations.test.jsx`
  // passed against the broken version. This is where it is visible.
  //
  // FROM THE FILM PAGE, not from the panel that is currently up: the chips this
  // presses are on the quote cards behind it.
  //
  // AND THE CHIP IS FOUND, NOT ASSUMED. A character with a single live candidate
  // opens that record directly — that is the design, not a fault — so pressing
  // whichever chip happens to come first and logging "nothing was pressed"
  // measures the ORDER of the fixture and calls it a run. Both of the branches
  // that used to do that are gone: this walks the live chips until one of them
  // ASKS, and only when none of them does has the probe failed to see its
  // subject, which is a failure and not a note.
  let asked = null
  for (let i = 0; i < 12 && asked === null; i++) {
    await page.goto(`${opts.baseUrl}/catalogue/${opts.movieId}`, { waitUntil: 'networkidle2' })
    await new Promise((r) => setTimeout(r, 1600))
    const chip = await page.evaluate((n) => {
      const live = [...document.querySelectorAll('article .person-chip, .film-frame .person-chip')]
        .filter((x) => x.getAttribute('aria-disabled') !== 'true')
      if (n >= live.length) return null
      live[n].click()
      return live[n].textContent.replace(/\s+/g, ' ').trim().slice(0, 40)
    }, i)
    if (chip === null) break
    await new Promise((r) => setTimeout(r, 1600))
    const rows = await page.evaluate(() =>
      [...document.querySelectorAll('.cs-choose')].filter((b) => b.getAttribute('aria-disabled') !== 'true').length)
    if (rows >= 2) asked = { chip, rows }
  }

  if (asked === null) {
    console.log('FAIL  no live character chip on this film page opens a question with two answers, so the ' +
      'answering case could not run — this probe cannot see its subject, which is not the same as the ' +
      'subject being well')
    failures++
  } else {
    // The question is on screen from the search above. Press its LAST answer:
    // the first is the one the chip already points at, so answering with it
    // cannot tell a landing apart from a no-op.
    const answered = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('.cs-choose')].filter((b) => b.getAttribute('aria-disabled') !== 'true')
      const label = rows[rows.length - 1].querySelector('.cs-choose-label')?.textContent || ''
      rows[rows.length - 1].click()
      return { label }
    })
    await new Promise((r) => setTimeout(r, 1600))
    const landed = await page.evaluate(() => ({
      panels: document.querySelectorAll('.tp-panel').length,
      title: (document.querySelector('.tp-panel-title, .tp-panel-names')?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 50),
      stillAsking: !!document.querySelector('.cs-choose'),
    }))
    if (landed.panels === 0) {
      console.log(`FAIL  answering "${answered.label}" closed everything — the question dismissed a surface its own answer had replaced`)
      failures++
    } else if (landed.stillAsking) {
      console.log('FAIL  the question is still on screen after an answer was pressed')
      failures++
    } else if (!landed.title.includes(answered.label.split(' ')[0])) {
      console.log(`FAIL  answering "${answered.label}" landed on ${JSON.stringify(landed.title)}`)
      failures++
    } else {
      console.log(`ok    the chip ${JSON.stringify(asked.chip)} asked with ${asked.rows} answers; ` +
        `"${answered.label}" lands on ${JSON.stringify(landed.title)}`)
    }
  }

  // Back to a nested panel for the crumb measurement below.
  await page.goto(`${opts.baseUrl}/catalogue/${opts.movieId}`, { waitUntil: 'networkidle2' })
  await new Promise((r) => setTimeout(r, 1400))
  await page.evaluate(() => [...document.querySelectorAll('.tp-btn')].find((x) => x.textContent.trim() === 'Details')?.click())
  await new Promise((r) => setTimeout(r, 1400))
  await page.evaluate(() => document.querySelector('.cs-face-tile:not([aria-disabled])')?.click())
  await new Promise((r) => setTimeout(r, 1600))

  // ── AND THE BACK CRUMB STAYS OUT OF THE TITLE, which is the other thing only a
  // browser can answer.
  //
  // THE FAILURE: a nested head's crumb is capped at 11ch and its word carried the
  // default `min-width: auto`, so it could neither shrink nor clip and simply
  // printed across the title beside it — reported with a screenshot of
  // "← V / William Ro" laid over "Change who this is". jsdom has no layout, so
  // `test/pure/crumb-stays-in-its-slot.test.js` can only read the four
  // declarations that decide it; this reads the rectangles.
  //
  // FORCED TO THE WORST CASE RATHER THAN HOPING FOR IT. The fixture's names are
  // short, so measuring what happens to be on screen measures the fixture: a
  // crumb that never overflows cannot overlap, and the case would pass against
  // the broken stylesheet. A long parent name is written into the crumb first —
  // that is the input the report came in on, and layout is the whole subject.
  //
  // MEASURED ON EVERY HEAD THAT DRAWS ONE, because there are two shapes: the
  // nested panel head, and the sub-sheet head a field row opens (`.tp-subsheet`),
  // which is where it was reported.
  const measureCrumbs = () => page.evaluate(() => {
    const LONG = 'A Very Long Parent Screen Name Indeed, With More After It'
    const heads = [...document.querySelectorAll('.tp-panel-head')].filter((h) => h.querySelector('.tp-panel-back-word'))
    return heads.map((h) => {
      const w = h.querySelector('.tp-panel-back-word')
      const title = h.querySelector('.tp-panel-title, .tp-panel-names')
      w.textContent = LONG
      const box = (e) => { const b = e.getBoundingClientRect(); return { l: Math.round(b.left), r: Math.round(b.right) } }
      const wb = box(w)
      return {
        sub: !!h.closest('.tp-subsheet'),
        titleText: title ? title.textContent.replace(/\s+/g, ' ').trim().slice(0, 40) : '',
        overlaps: title ? wb.r > box(title).l : false,
        clipped: w.scrollWidth > w.clientWidth,
        marked: getComputedStyle(w).textOverflow === 'ellipsis',
        overruns: wb.r > Math.round(h.getBoundingClientRect().right),
      }
    })
  })

  // The sub-sheet, if this sheet offers one: the credit portrait opens "Change
  // who this is", which is the head the report's screenshot is of.
  await page.evaluate(() => document.querySelector('.tp-panel .cs-credit-pick')?.click())
  await new Promise((r) => setTimeout(r, 1200))

  const crumbs = await measureCrumbs()
  if (crumbs.length === 0) {
    console.log('FAIL  no head on screen draws a back crumb, so the overlap this checks cannot be seen')
    failures++
  }
  for (const c of crumbs) {
    const where = c.sub ? 'a sub-sheet head' : 'a nested panel head'
    if (c.overlaps) {
      console.log(`FAIL  ${where}'s crumb prints over its title ${JSON.stringify(c.titleText)} — two screens' words in one line box`)
      failures++
    } else if (c.overruns) {
      console.log(`FAIL  ${where}'s crumb runs past the end of the head`)
      failures++
    } else if (!c.clipped) {
      console.log(`FAIL  ${where}'s crumb did not clip a name far longer than its key, so it is overflowing somewhere unmeasured`)
      failures++
    } else if (!c.marked) {
      console.log(`FAIL  ${where}'s crumb clips with no ellipsis, so a cut name and a short name look alike`)
      failures++
    } else {
      console.log(`ok    ${where}'s crumb clips, is marked, and stays clear of ${JSON.stringify(c.titleText)}`)
    }
  }
} finally {
  await browser.close()
}
process.exit(failures ? 1 : 0)
