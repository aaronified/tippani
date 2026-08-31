#!/usr/bin/env node
// Does anything break when the reader turns the type up?
//
// THE RULE IT ENFORCES. Type size is a setting, so every px width drawn around text
// is a guess that stops being true the moment somebody changes it. A box that holds
// text is sized in `em`, `ch` or a share of its container; `max-height: 72px` is three
// lines at exactly one setting and a clipped word at every other. The design pack
// states the check directly: "set the root font size to 24px — every line count must
// hold, and nothing may clip that did not clip before."
//
// WHY THE LITERAL VERSION OF THAT TEST WOULD PASS AND PROVE NOTHING HERE. Tippani has
// no root font size to set. `applyTypeScale` (web/frontend/src/type.js) writes finished
// PIXELS into `--type-<role>-<step>` on <html>, and `body` reads `var(--type-ui-15)` —
// so changing the browser's root does almost nothing to this app, and a harness built
// on it would report a clean bill of health for a stylesheet full of px boxes.
//
// The app's own equivalent is its type dial, which goes to 200% (TYPE_FACTORS). At
// that setting a 15px label is 30px — harsher than the 24px the rule asks for. So this
// does BOTH: it doubles every type token the app has written, AND sets the root to
// 24px so the handful of `rem` values are covered too.
//
// WHY IT IS A DIFFERENCE AND NOT A THRESHOLD. Plenty of the app clips on purpose —
// a line-clamped card intro, an ellipsised file path. A test that failed on all
// clipping would fail on the design, so it would be turned off. The pack's wording is
// the better test and it is the one implemented: measure what clips at the normal
// setting, measure again with the type doubled, and fail only on what is NEW.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import puppeteer from 'puppeteer-core'

import { HARNESS_ACCOUNT, SCREENS, ensureSession, findFirefox } from './capture.mjs'

function parseArgs(argv) {
  const out = {
    baseUrl: 'http://127.0.0.1:8080',
    username: HARNESS_ACCOUNT.username,
    password: HARNESS_ACCOUNT.password,
    timeoutMs: 30000,
    screens: null,
    firefox: null,
    bookId: null,
    movieId: null,
    json: null,
    baseline: null,
  }
  const rest = argv.slice(2)
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]
    const next = () => rest[++i]
    if (a === '--base-url') out.baseUrl = next()
    else if (a === '--username') out.username = next()
    else if (a === '--password') out.password = next()
    else if (a === '--timeout') out.timeoutMs = Number(next())
    else if (a === '--screens') out.screens = next().split(',').map((s) => s.trim())
    else if (a === '--firefox') out.firefox = next()
    else if (a === '--book-id') out.bookId = next()
    else if (a === '--movie-id') out.movieId = next()
    else if (a === '--json') out.json = next()
    else if (a === '--baseline') out.baseline = next()
    else if (a === '--help' || a === '-h') {
      console.log(`typescale.mjs — nothing may clip that did not clip before.

  --base-url <url>       default http://127.0.0.1:8080
  --screens a,b,c        only these (default: every screen capture.mjs knows)
  --book-id / --movie-id include the two detail screens
  --json <file>          write the full report
  --baseline <file>      a screen may not clip MORE than this file records (default:
                         typescale-baseline.json beside this script). Pass --baseline
                         none to fail on any new clipping at all.
  --firefox <path>       default: discovered`)
      process.exit(0)
    }
  }
  return out
}

// Runs INSIDE the page. Returns one entry per element whose content is cut off by a
// box that will not scroll — which is the only kind of overflow a reader cannot get
// at. An `overflow: auto` box that outruns its size is a scroller, and by now it wears
// a fade saying so; an `overflow: visible` box that outruns its size spills rather
// than clips, which is ugly but not lost.
const PROBE = `(() => {
  const KEY = (el) => {
    const parts = []
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      const i = n.parentElement ? [...n.parentElement.children].indexOf(n) : 0
      parts.unshift(n.tagName.toLowerCase() + ':' + i)
    }
    return parts.join('>')
  }
  const CUTS = (v) => v === 'hidden' || v === 'clip'
  const out = {}
  for (const el of document.body.querySelectorAll('*')) {
    if (!el.textContent || !el.textContent.trim()) continue
    const r = el.getBoundingClientRect()
    if (!r.width || !r.height) continue
    const cs = getComputedStyle(el)
    if (cs.visibility === 'hidden' || cs.display === 'none') continue
    const wide = el.scrollWidth > el.clientWidth + 1 && CUTS(cs.overflowX)
    const tall = el.scrollHeight > el.clientHeight + 1 && CUTS(cs.overflowY)
    if (!wide && !tall) continue
    out[KEY(el)] = {
      tag: el.tagName.toLowerCase(),
      cls: (el.getAttribute('class') || '').slice(0, 90),
      text: el.textContent.trim().slice(0, 60),
      wide,
      tall,
      by: [el.scrollWidth - el.clientWidth, el.scrollHeight - el.clientHeight],
    }
  }
  return out
})()`

// The 200% dial, applied the way the app applies it. Every token currently on <html>
// is a finished pixel written by applyTypeScale at 100%, and scaled(px, 200) is
// exactly px * 2 — so doubling what is there IS the top of the dial, with no second
// copy of the type table living in this harness to fall out of step.
const TURN_IT_UP = `(() => {
  const root = document.documentElement
  const names = [...root.style].filter((n) => n.startsWith('--type-'))
  if (!names.length) return { tokens: 0, note: 'applyTypeScale had written nothing' }
  for (const n of names) {
    const px = parseFloat(root.style.getPropertyValue(n))
    if (!Number.isNaN(px)) root.style.setProperty(n, Math.round(px * 2) + 'px')
  }
  // And the literal instruction from the pack, for the few rem values.
  root.style.fontSize = '24px'
  return { tokens: names.length }
})()`

async function settle(page) {
  await page.evaluate(() => document.fonts.ready)
  await new Promise((r) => setTimeout(r, 200))
}

async function checkScreen(page, screen, opts) {
  const path =
    typeof screen.path === 'function'
      ? screen.path(screen.name === 'book-detail' ? opts.bookId : opts.movieId)
      : screen.path
  await page.goto(opts.baseUrl + path, { waitUntil: 'networkidle0' })
  await page.waitForSelector(`[data-screen-label="${screen.name}"]`, { timeout: opts.timeoutMs })
  await settle(page)

  const before = await page.evaluate(PROBE)
  const applied = await page.evaluate(TURN_IT_UP)
  await settle(page)
  const after = await page.evaluate(PROBE)

  const fresh = []
  for (const [key, info] of Object.entries(after)) {
    if (!before[key]) fresh.push({ key, ...info })
  }
  return { screen: screen.name, tokens: applied.tokens, clippedBefore: Object.keys(before).length, fresh }
}

// `--baseline none` opts out; anything else is a path, and the default sits beside
// this script so a bare run is still a ratchet rather than a wall of known debt.
function readBaseline(opts) {
  if (opts.baseline === 'none') return {}
  const file = opts.baseline || join(dirname(fileURLToPath(import.meta.url)), 'typescale-baseline.json')
  if (!existsSync(file)) return {}
  return JSON.parse(readFileSync(file, 'utf8')).screens || {}
}

async function main() {
  const opts = parseArgs(process.argv)
  const wanted = opts.screens
    ? SCREENS.filter((s) => opts.screens.includes(s.name))
    : SCREENS.filter((s) => !s.needs || (s.needs === 'book-id' ? opts.bookId : opts.movieId))

  const browser = await puppeteer.launch({
    browser: 'firefox',
    executablePath: findFirefox(opts.firefox),
    headless: true,
  })
  const report = []
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 1280, height: 900 })
    await ensureSession(page, opts)
    for (const screen of wanted) {
      try {
        const r = await checkScreen(page, screen, opts)
        report.push(r)
        const verdict = r.fresh.length ? `${r.fresh.length} NEW` : 'clean'
        console.log(`${screen.name.padEnd(14)} ${String(r.clippedBefore).padStart(3)} clipped at rest   ${verdict}`)
        for (const f of r.fresh.slice(0, 6)) {
          console.log(`    ${f.tag}${f.cls ? '.' + f.cls.split(/\s+/).join('.') : ''}`)
          console.log(`      "${f.text}"  cut by ${f.wide ? f.by[0] + 'px wide' : ''}${f.wide && f.tall ? ', ' : ''}${f.tall ? f.by[1] + 'px tall' : ''}`)
        }
        if (r.fresh.length > 6) console.log(`    …and ${r.fresh.length - 6} more`)
      } catch (err) {
        report.push({ screen: screen.name, error: String(err?.message || err) })
        console.error(`${screen.name.padEnd(14)} FAILED  ${err?.message || err}`)
      }
    }
  } finally {
    await browser.close()
  }

  if (opts.json) writeFileSync(opts.json, JSON.stringify(report, null, 2))

  // ---- the ratchet ---------------------------------------------------------
  //
  // Three screens still clip 47 elements between them, and all 47 are the same
  // failure: a work title or a person's name wearing Tailwind's `truncate`. Fixing
  // them is those screens' own pass, not this one — but a run that simply printed
  // the number would be a run nobody reads. So the number is recorded, and it may
  // FALL and never RISE: a screen that starts clipping something new is a red run
  // in the change that would have shipped it.
  const baseline = readBaseline(opts)
  const newly = report.reduce((n, r) => n + (r.fresh?.length || 0), 0)
  const broke = report.filter((r) => r.error).length
  const over = report.filter((r) => (r.fresh?.length || 0) > (baseline[r.screen] ?? 0))
  const under = report.filter((r) => (r.fresh?.length || 0) < (baseline[r.screen] ?? 0))

  console.log(`\n${newly} element(s) newly clipped with the type at 200% and the root at 24px`)
  if (broke) console.log(`${broke} screen(s) could not be checked`)
  for (const r of over) {
    console.log(`OVER   ${r.screen}: ${r.fresh.length}, recorded ${baseline[r.screen] ?? 0}`)
  }
  for (const r of under) {
    console.log(`under  ${r.screen}: ${r.fresh.length}, recorded ${baseline[r.screen] ?? 0} — spend it: lower the baseline`)
  }
  process.exit(over.length || broke ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
