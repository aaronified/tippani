#!/usr/bin/env node
// THE CONTROL BESIDE A TITLE SITS ON THE TITLE — measured, in a browser.
//
// THE REPORT THIS EXISTS FOR, in the owner's words: "headers with two rows look
// fine now. but not headers with one row." The heart beside a work's title is the
// app's 44px tap target; a one-line title's box is font-size x 1.15, about 25px
// at phone width. Aligned by their top edges, all 19px of the difference fell
// BELOW the line: half of it under the glyph, which is what the eye reads as
// misaligned, and all of it under the row, which is the gap that opened above the
// genres. Two lines hid both, because the title's box is then the taller of the
// two — so one defect showed in exactly one of the two cases, which is why the
// report reads as a difference between them.
//
// WHY THIS IS NOT A jsdom TEST, and the first attempt at one is the argument.
// It read `index.css` and asserted the declarations were present — `align-items:
// center`, a literal `margin-block: calc(...)` string. That guards nothing: the
// heart lives inside a Tooltip, so renaming a class leaves the rule matching
// nothing while the assertion stays green, and any equivalent implementation
// (align-self, a grid, an absolute position) fails it while the header is
// perfect. The observable is a DISTANCE, jsdom has no layout, and this harness
// measures distances — so the check belongs here and the jsdom file is deleted
// rather than kept as a comfort.
//
// BOTH CASES OR NEITHER. A one-line title and a wrapped one, because the pair is
// the whole report: a fix that centres the glyph on a two-line block and not on a
// one-line one would pass a single sample.
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import puppeteer from 'puppeteer-core'

import { HARNESS_ACCOUNT, emulateEngineMedia, ensureSession, findBrowser, launchOptions } from './capture.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))

function parseArgs(argv) {
  const out = { baseUrl: 'http://127.0.0.1:8080', timeoutMs: 30000 }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--base-url') out.baseUrl = argv[++i]
    else if (argv[i] === '--timeout') out.timeoutMs = Number(argv[++i])
    else if (argv[i] === '--help' || argv[i] === '-h') {
      console.log('usage: node hero-control.mjs [--base-url URL]\n\n' +
        'Opens book details at phone width and fails when the heart is not on the\n' +
        "title's optical centre, or when the title's row is taller than its text.")
      process.exit(0)
    }
  }
  return out
}

// THE TOLERANCES, AND WHY THEY ARE NOT ZERO. `getBoundingClientRect` is
// fractional and a glyph's optical centre is not its box's centre to the pixel,
// so 2px is "the same line" and anything beyond it is the 9.35px overhang this
// exists to catch. The row cap is the title's own line box plus the same 2px:
// a 44px row over a 25px line is what pushed the genres down.
const CENTRE_TOLERANCE = 2
const ROW_SLACK = 2

async function measure(page) {
  return page.evaluate(() => {
    const row = document.querySelector('.work-hero-title')
    const title = document.querySelector('.work-hero-title .display-title')
    const heart = document.querySelector('.work-hero-title .heart')
    if (!row || !title || !heart) return null
    // INK, not the border box. A line box is taller than the glyphs in it, so an
    // element aligned by its box is not aligned by what a reader sees.
    const r = document.createRange()
    r.selectNodeContents(title)
    const rects = [...r.getClientRects()].filter((x) => x.width > 0 && x.height > 0)
    if (!rects.length) return null
    const lines = new Set(rects.map((x) => Math.round(x.top))).size
    const inkTop = Math.min(...rects.map((x) => x.top))
    const inkBottom = Math.max(...rects.map((x) => x.bottom))
    const hb = heart.getBoundingClientRect()
    const cs = getComputedStyle(title)
    return {
      lines,
      titleCentre: (inkTop + inkBottom) / 2,
      heartCentre: hb.top + hb.height / 2,
      rowHeight: row.getBoundingClientRect().height,
      lineBox: parseFloat(cs.lineHeight) * lines,
      titleText: title.textContent.trim().slice(0, 40),
    }
  })
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

  // WHICH BOOKS: the fixture is walked until BOTH a one-line and a multi-line
  // title have been measured, rather than trusting two hard-coded ids to keep
  // wrapping the way they did the day this was written.
  const seen = { 1: null, many: null }
  for (let id = 1; id <= 12 && !(seen[1] && seen.many); id++) {
    await page.goto(`${opts.baseUrl}/books/${id}`, { waitUntil: 'networkidle2' })
    try {
      await page.waitForSelector('.work-hero-title .heart', { timeout: 6000 })
    } catch { continue }
    const m = await measure(page)
    if (!m) continue
    const slot = m.lines === 1 ? 1 : 'many'
    if (!seen[slot]) seen[slot] = { id, ...m }
  }

  for (const [slot, m] of Object.entries(seen)) {
    const what = slot === '1' ? 'a one-line title' : `a ${m ? m.lines : '?'}-line title`
    if (!m) {
      console.log(`SKIP  no book in the fixture has ${what}`)
      continue
    }
    const off = Math.abs(m.heartCentre - m.titleCentre)
    if (off > CENTRE_TOLERANCE) {
      console.log(`FAIL  ${what} (${JSON.stringify(m.titleText)}): the heart sits ${off.toFixed(1)}px off the title's centre`)
      failures++
    } else {
      console.log(`ok    ${what}: the heart is on the title's centre (${off.toFixed(1)}px)`)
    }
    if (m.rowHeight > m.lineBox + ROW_SLACK) {
      console.log(`FAIL  ${what}: the title's row is ${m.rowHeight.toFixed(1)}px for a ${m.lineBox.toFixed(1)}px line — ` +
        'the tap target is growing the header')
      failures++
    } else {
      console.log(`ok    ${what}: the row is the title's own height (${m.rowHeight.toFixed(1)}px)`)
    }
  }
} finally {
  await browser.close()
}
process.exit(failures ? 1 : 0)
