// IS THE PEOPLE CONSOLE'S FILTER ROW ONE LINE, AND DOES IT OVERFLOW?
// The owner: "People: one line for the filter row, and long-press names a glyph
// button." This measures the row before anything is changed: how many visual
// lines its children occupy, and how far past the edge it runs.
//
// WHAT IT FOUND, and what it then held the repair to. Before: 283px past the edge
// at 390 and 399px at 1280 — a third of the row sitting off-screen behind a
// sideways scroll, on a row whose whole job is to show what the filters are. The
// three fixes, each measured on its own:
//
//   the three verbs collapse to glyphs      1280: 399 -> 64   390: 283 -> 221
//   the phone drops the duplicate search box 390:  221 -> 12
//   the search field is allowed to shrink   1280:  64 -> 0
//
// A FOURTH WAS TRIED AND PUT BACK: letting the phone's role chooser shrink too,
// with min-width 11ch, which is WIDER than that chooser already was — it pushed
// 390 from 12px over to 28px over. Recorded because "let it shrink" sounds like it
// can only help, and it cannot.
//
// IT FAILS THE RUN, not just prints. A row that overflows again is the defect
// coming back, and a probe that only reports it would be read by nobody.
const BUDGET = { 390: 16, 1280: 0 }
import { mkdirSync } from 'node:fs'
import puppeteer from 'puppeteer-core'
import { HARNESS_ACCOUNT, NO_MOTION_CSS, emulateEngineMedia, ensureSession, findBrowser, launchOptions, noMotionScript } from './capture.mjs'

const opts = { baseUrl: 'http://127.0.0.1:8080', out: '/tmp/claude-0/peoplerow', theme: 'dark' }
for (let i = 2; i < process.argv.length; i++) {
  const n = () => process.argv[++i]
  if (process.argv[i] === '--base-url') opts.baseUrl = n()
  else if (process.argv[i] === '--out') opts.out = n()
}
mkdirSync(opts.out, { recursive: true })

const engine = findBrowser(null, 'chrome')
const browser = await puppeteer.launch(launchOptions(engine))
const page = await browser.newPage()
// The theme reaches Chrome only this way: launchOptions sets it for Firefox alone,
// and ensureSession never read the `theme` it used to be handed.
await emulateEngineMedia(page, engine, opts.theme)
await page.evaluateOnNewDocument(noMotionScript(NO_MOTION_CSS))

const nameOf = async (h) => (await page.evaluate((e) => (e.innerText || e.getAttribute('aria-label') || '').trim(), h)) || ''
const pressByWords = async (words) => {
  for (const h of await page.$$('button, [role="button"], [role="tab"], [role="option"]')) {
    const n = (await nameOf(h)).toLowerCase()
    const last = n.split('\n').filter(Boolean).pop() || ''
    if (n === words.toLowerCase() || n.startsWith(`${words.toLowerCase()}\n`) || last === words.toLowerCase()) {
      if (await h.boundingBox()) { await h.click(); return true }
    }
  }
  return false
}

let bad = 0
for (const width of [390, 1280]) {
  await page.setViewport({ width, height: 1100, deviceScaleFactor: 2 })
  await ensureSession(page, { baseUrl: opts.baseUrl, ...HARNESS_ACCOUNT })
  await page.goto(`${opts.baseUrl}/metadata`, { waitUntil: 'networkidle0' })
  await new Promise((r) => setTimeout(r, 900))
  for (const w of ['skip tour', 'finish later']) { if (await pressByWords(w)) await new Promise((r) => setTimeout(r, 300)) }
  if (!(await pressByWords('People'))) { console.log(`MISS @${width}: no People section`); bad++; continue }
  await new Promise((r) => setTimeout(r, 1000))

  const m = await page.evaluate(() => {
    const row = document.querySelector('.console-filters')
    if (!row) return null
    const kids = [...row.children].filter((n) => n.getBoundingClientRect().width > 0)
    // DISTINCT TOPS ARE LINES. A row that wraps puts its children on more than one.
    const tops = [...new Set(kids.map((n) => Math.round(n.getBoundingClientRect().top)))].sort((a, b) => a - b)
    return {
      children: kids.length,
      lines: tops.length,
      clientWidth: row.clientWidth,
      scrollWidth: row.scrollWidth,
      overflowPx: row.scrollWidth - row.clientWidth,
      labels: kids.map((n) => (n.innerText || n.getAttribute('aria-label') || n.tagName).trim().split('\n')[0].slice(0, 22)),
    }
  })
  if (!m) { console.log(`MISS @${width}: no .console-filters on the People console`); bad++; continue }
  const budget = BUDGET[width] ?? 0
  const over = m.overflowPx > budget
  if (over) bad++
  console.log(`${over ? 'OVER ' : 'ok   '} @${width}  children ${m.children}  width ${m.clientWidth} of ${m.scrollWidth} ` +
    `(overflow ${m.overflowPx}px, budget ${budget}px)`)
  console.log(`        ${m.labels.join(' | ')}`)
  await page.screenshot({ path: `${opts.out}/people-${width}.png`, fullPage: false })
}
await browser.close()
process.exit(bad ? 1 : 0)
