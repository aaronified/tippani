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
// WHAT IT PRESSES. The character sheet's "Open the global record", which is a
// panel opening a panel from inside itself, and the shortest real path to it: a
// film page, a cast chip, then that row.
//
// IT FAILS RATHER THAN SKIPS WHEN IT CANNOT FIND ITS SUBJECT, and the first
// version did the opposite: three `process.exit(0)` skips, so `make panel-depth`
// printed "SKIP no chip on this fixture opens a panel" and reported success —
// while three separate places in the repo called this file the guard for the
// race. A probe that cannot see its subject has learned nothing, and reporting
// nothing as ok is how a guard becomes decoration. The fixture is the caller's
// to get right: `--movie-id` must name a work whose cast row carries a character
// record, and if it does not, that is a failure of the run and not a pass.
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
        'Opens a character sheet from a film page, presses a door the sheet itself\n' +
        'offers, and fails if the second panel is not on screen afterwards.')
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

  await page.goto(`${opts.baseUrl}/movies/${opts.movieId}`, { waitUntil: 'networkidle2' })
  await page.waitForSelector('.person-chip', { timeout: opts.timeoutMs })

  // A CHIP THAT OPENS A PANEL, and finding one is not the same as finding a live
  // chip. Two kinds share this row: a CHARACTER chip opens the pack's panel, and
  // a PERSON chip whose record the library has not saved opens the older modal
  // instead. Only the first is the subject here, and which is which depends on
  // the fixture — so try each live chip and keep the one that yields a panel.
  const live = await page.evaluate(() => [...document.querySelectorAll('.person-chip')]
    .map((x, i) => ({ i, dead: x.getAttribute('aria-disabled') === 'true', text: x.textContent.trim().slice(0, 30) }))
    .filter((x) => !x.dead))
  if (live.length === 0) {
    console.log('FAIL  no live cast chip on movie ' + opts.movieId + ' — this probe cannot see its subject, ' +
      'which is not the same as the subject being well')
    process.exit(1)
  }
  let panelUp = false
  for (const c of live) {
    await page.goto(`${opts.baseUrl}/movies/${opts.movieId}`, { waitUntil: 'networkidle2' })
    await page.waitForSelector('.person-chip', { timeout: opts.timeoutMs })
    await page.evaluate((i) => document.querySelectorAll('.person-chip')[i].click(), c.i)
    await new Promise((r) => setTimeout(r, 1400))
    if (await page.evaluate(() => !!document.querySelector('.tp-panel'))) {
      console.log(`      opened a panel from chip ${JSON.stringify(c.text)}`)
      panelUp = true
      break
    }
  }
  if (!panelUp) {
    console.log('FAIL  no chip on movie ' + opts.movieId + ' opens a panel — every live one is a person with ' +
      'no saved record, so the door this probe exists to press is not on the page')
    process.exit(1)
  }

  // Now the door the panel itself offers. `.cs-row` is the pack's row; the one
  // that opens the global record is the only one on this sheet that opens a panel.
  const pressed = await page.evaluate(() => {
    const row = [...document.querySelectorAll('.tp-panel .cs-row')]
      .find((r) => /global record/i.test(r.textContent))
    if (!row) return null
    const before = document.querySelectorAll('.tp-panel').length
    row.click()
    return before
  })
  if (pressed === null) {
    console.log('FAIL  this sheet offers no panel-opening row, so the race cannot be exercised')
    process.exit(1)
  }

  await new Promise((r) => setTimeout(r, 1200))
  const after = await page.evaluate(() => {
    const p = document.querySelector('.tp-panel')
    return { panels: document.querySelectorAll('.tp-panel').length, depth: window.history.state?.tpPanelDepth ?? 0,
             text: p ? p.textContent.replace(/\s+/g, ' ').slice(0, 80) : '' }
  })

  // THE ASSERTION. A panel must still be open, and the depth must be 1 because
  // open() replaces. Zero panels is the race: pushed, then truncated.
  if (after.panels < 1) {
    console.log(`FAIL  pressing a panel's own door left NOTHING open (depth ${after.depth}) — the go/push race is back`)
    failures++
  } else if (after.depth !== 1) {
    console.log(`FAIL  a replacing open() left depth ${after.depth}, so Back answers a panel nobody saw`)
    failures++
  } else {
    console.log(`ok    a panel's own door opens a panel — depth 1, showing ${JSON.stringify(after.text)}`)
  }
} finally {
  await browser.close()
}
process.exit(failures ? 1 : 0)
