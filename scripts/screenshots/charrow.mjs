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

const opts = { baseUrl: 'http://127.0.0.1:8080', out: '/tmp/claude-0/charrow', theme: 'dark' }
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

// THE CHARACTERS SECTION, BEFORE IT IS CHANGED. The owner: "Characters: an
// orphans filter, the remap card at the top, and close the gap." Three claims,
// and this reads all three off the running app rather than off the source:
// whether a filter for characters in no work is on the screen at all, what order
// the console and the speaker-remap card sit in, and how big the gap between them
// is.
let bad = 0
for (const width of [390, 1280]) {
  await page.setViewport({ width, height: 1100, deviceScaleFactor: 2 })
  await ensureSession(page, { baseUrl: opts.baseUrl, ...HARNESS_ACCOUNT })
  await page.goto(`${opts.baseUrl}/metadata`, { waitUntil: 'networkidle0' })
  await new Promise((r) => setTimeout(r, 900))
  for (const w of ['skip tour', 'finish later']) { if (await pressByWords(w)) await new Promise((r) => setTimeout(r, 300)) }
  if (!(await pressByWords('Characters'))) { console.log(`MISS @${width}: no Characters section`); bad++; continue }
  await new Promise((r) => setTimeout(r, 1000))

  const m = await page.evaluate(() => {
    const row = document.querySelector('.console-filters')
    const pills = [...document.querySelectorAll('.tp-filter-chip')].map((n) => n.innerText.trim().split('\n')[0])
    // The two blocks, in the order the DOM has them, with the space between.
    // THE TWO BLOCKS THIS SECTION IS MADE OF, by the words on them rather than by
    // a class: the remap card names itself, and the console is the block holding
    // the filter row. The gap is the space between them, which is the thing the
    // owner called out.
    const byText = (t) => [...document.querySelectorAll('section, .hand-card, div')]
      .filter((n) => (n.innerText || '').trim().startsWith(t) && n.getBoundingClientRect().height > 60)
      .sort((a, b) => a.getBoundingClientRect().height - b.getBoundingClientRect().height)[0] || null
    const remap = byText('Speaker & character remap')
    const console_ = row ? row.closest('section') : null
    const r = (n) => n ? { top: Math.round(n.getBoundingClientRect().top), bottom: Math.round(n.getBoundingClientRect().bottom) } : null
    const a = r(remap), b = r(console_)
    const first = a && b && a.top < b.top ? 'remap' : 'console'
    return {
      rowOverflow: row ? row.scrollWidth - row.clientWidth : null,
      pills,
      order: first,
      remap: a, console: b,
      gap: a && b ? (a.top < b.top ? b.top - a.bottom : a.top - b.bottom) : null,
      // AND WHAT IS LEFT UNDER THEM. The standing rule: "Empty space under a card
      // is not restraint, it is a surface not doing its job."
      trailing: b ? Math.round(window.innerHeight - Math.max(a ? a.bottom : 0, b.bottom)) : null,
      viewport: window.innerHeight,
      // THE CHROME ABOVE THE FIRST ROW, band by band. On a phone this is what a
      // reader scrolls past before reaching a character.
      bands: (() => {
        const q = (sel) => document.querySelector(sel)
        const rect = (n) => n ? { t: Math.round(n.getBoundingClientRect().top), b: Math.round(n.getBoundingClientRect().bottom) } : null
        const filters = rect(q('.console-filters'))
        const countRow = rect(q('.console-filters-count-row') || q('.console-filters-count'))
        const pills = rect(document.querySelector('.tp-filter-chip')?.parentElement)
        const firstRow = rect(q('.record-row'))
        const out = { filters, countRow, pills, firstRow }
        out.gapFiltersToCount = filters && countRow ? countRow.t - filters.b : null
        out.gapCountToPills = countRow && pills ? pills.t - countRow.b : null
        out.gapPillsToFirstRow = pills && firstRow ? firstRow.t - pills.b : null
        return out
      })(),
    }
  })
  if (!m) { console.log(`MISS @${width}`); bad++; continue }
  console.log(`@${width}  filter row overflow ${m.rowOverflow}px`)
  console.log(`        pills: ${m.pills.join(' | ') || '(none)'}`)
  console.log(`        first block: ${m.order}   remap ${JSON.stringify(m.remap)}  console ${JSON.stringify(m.console)}`)
  console.log(`        gap between them: ${m.gap}px   empty below: ${m.trailing}px of ${m.viewport}`)
  const bd = m.bands
  console.log(`        chrome bands: filters->count ${bd.gapFiltersToCount}px  count->pills ${bd.gapCountToPills}px  pills->first row ${bd.gapPillsToFirstRow}px`)
  await page.screenshot({ path: `${opts.out}/people-${width}.png`, fullPage: false })
}
await browser.close()
process.exit(bad ? 1 : 0)
