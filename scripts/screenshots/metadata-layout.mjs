#!/usr/bin/env node
// metadata-layout.mjs — measure what the owner asked of the Metadata and Settings
// screens on a desk, and fail when a measurement disagrees.
//
// WHY A PROBE AND NOT A JOURNEY. Every one of these is a fact about WHERE something
// sits or how big it is — the height of a tab row, the reach of an underline, the
// size of a face, the number of lines in a row, a hole between two cards. A journey
// asks what is on the screen and what a person can do to it; none of these is
// either, and the vocabulary has no verb for "is this box as tall as that one"
// without becoming a ruler. So they are measured here, the way `make typescale` and
// `make glyph-align` measure what their rules are about.
//
// WHAT IT CHECKS, each the owner's own words:
//   1. "the space between the topbar and the tabs is not uniform" — every section's
//      tab row at the same height, Metadata and Settings alike.
//   2. "it may be prudent to add that much width to both sides of all lines" — the
//      selected underline overhangs its content by the same amount on both sides,
//      counted tab or not (a counted tab's right side measured from the count's
//      text, since the badge's padding IS the overhang there).
//   3. "character images … should be the same size as the images in the people
//      page" — the first face on each list, the same box.
//   4. "two rows only in desktop" — every People and Characters row draws its
//      name-line and its chips and nothing else.
//   5. "use masonry packing on desktop, not grid" — no card floats more than a gap
//      below the card above it, and none overlaps another.
//
// Usage: node metadata-layout.mjs --base-url http://127.0.0.1:8130
import puppeteer from 'puppeteer-core'

import { HARNESS_ACCOUNT, emulateEngineMedia, ensureSession, findBrowser, launchOptions } from './capture.mjs'

function parseArgs(argv) {
  const out = { baseUrl: 'http://127.0.0.1:8080', username: HARNESS_ACCOUNT.username, password: HARNESS_ACCOUNT.password, timeoutMs: 30000, firefox: false, browser: undefined }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const next = () => argv[++i]
    if (a === '--base-url') out.baseUrl = next()
    else if (a === '--firefox') out.firefox = true
    else if (a === '--browser') out.browser = next()
  }
  return out
}

const opts = parseArgs(process.argv.slice(2))
const VIEW = { width: 1440, height: 900 }
const SECTIONS = [
  '/metadata/works', '/metadata/people', '/metadata/characters', '/metadata/languages',
  '/metadata/categories', '/metadata/sources',
  '/settings/theme', '/settings/lang', '/settings/review', '/settings/sections', '/settings/server',
]
const MASONRY = ['/settings/lang', '/settings/server', '/metadata/categories', '/metadata/sources']
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

const engine = findBrowser(opts.firefox, opts.browser)
const browser = await puppeteer.launch(launchOptions(engine, { headless: true, viewport: VIEW }))
const failures = []
try {
  const page = await browser.newPage()
  await page.setViewport(VIEW)
  await emulateEngineMedia(page, engine.browser)
  await ensureSession(page, opts)
  const open = async (path) => {
    await page.goto(opts.baseUrl + path, { waitUntil: 'networkidle0' })
    await page.waitForSelector('.meta-rail-row', { timeout: opts.timeoutMs })
    await wait(1200)
  }

  // 1 and 2: the tab row, and the underline, on every section.
  const rows = []
  for (const path of SECTIONS) {
    await open(path)
    const m = await page.evaluate(() => {
      const row = document.querySelector('.meta-rail-row').getBoundingClientRect()
      const on = document.querySelector('.meta-rail-item.is-on')
      const a = getComputedStyle(on, '::after')
      const box = on.getBoundingClientRect()
      const lineL = box.left + parseFloat(a.left)
      const lineR = box.right - parseFloat(a.right)
      const icon = on.querySelector('.meta-rail-icon').getBoundingClientRect()
      const count = on.querySelector('.meta-rail-count')
      const label = on.querySelector('.meta-rail-label').getBoundingClientRect()
      const rightContent = count
        ? count.getBoundingClientRect().right - parseFloat(getComputedStyle(count).paddingRight)
        : label.right
      return { top: Math.round(row.top), bottom: Math.round(row.bottom), left: icon.left - lineL, right: lineR - rightContent, counted: !!count }
    })
    rows.push([path, m])
    console.log(`${path.padEnd(22)} tabs ${m.top}–${m.bottom}   underline overhang ${m.left.toFixed(1)} / ${m.right.toFixed(1)}${m.counted ? ' (counted)' : ''}`)
    if (Math.abs(m.left - m.right) > 1.5) failures.push(`${path}: the underline reaches ${m.left.toFixed(1)}px past the left and ${m.right.toFixed(1)}px past the right`)
  }
  const [firstPath, first] = rows[0]
  for (const [path, m] of rows.slice(1)) {
    if (Math.abs(m.top - first.top) > 1 || Math.abs(m.bottom - first.bottom) > 1) {
      failures.push(`${path}: its tabs sit at ${m.top}–${m.bottom}, ${firstPath}'s at ${first.top}–${first.bottom}`)
    }
  }

  // 3 and 4: the two record lists.
  const face = {}
  for (const path of ['/metadata/people', '/metadata/characters']) {
    await open(path)
    const m = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('.record-row-lg')].slice(0, 8)
      const f = rows[0]?.querySelector('.person-face-btn')?.getBoundingClientRect()
      // A LINE IS A BAND OF INK. Every painted leaf in the name's line and the
      // sub-line under it is placed by its vertical centre, and centres within 10px
      // are one line. Counting the sub-line's CHILDREN was the first cut and missed
      // the one defect that matters: the chips live in a single scroller, so chips
      // that wrap to three lines are still one child.
      const lines = rows.map((r) => {
        const col = r.querySelector('.record-row-head').parentElement
        const leaves = [col.querySelector('.record-row-head'), ...col.querySelectorAll('.cs-row-sub')]
          .flatMap((el) => [...el.querySelectorAll('*')].filter((k) => !k.children.length))
        const mids = leaves.map((k) => k.getBoundingClientRect()).filter((b) => b.height > 0 && b.width > 0)
          .map((b) => b.top + b.height / 2).sort((a, b) => a - b)
        let n = 0; let last = -Infinity
        for (const m of mids) { if (m - last > 10) n++; last = m }
        return n
      })
      return { face: f && [Math.round(f.width), Math.round(f.height)], lines }
    })
    face[path] = m.face
    console.log(`${path.padEnd(22)} face ${m.face?.join('×')}   lines per row ${m.lines.join(' ')}`)
    const over = m.lines.filter((n) => n > 2).length
    if (over) failures.push(`${path}: ${over} row(s) draw more than two lines on a desk`)
    if (!m.lines.length) failures.push(`${path}: no rows to measure`)
  }
  const [p, c] = [face['/metadata/people'], face['/metadata/characters']]
  if (!p || !c || Math.abs(p[0] - c[0]) > 1 || Math.abs(p[1] - c[1]) > 1) {
    failures.push(`a character's face is ${c?.join('×')} and a person's ${p?.join('×')}`)
  }

  // 5: masonry — every card sits a gap under the card above it, and on nothing.
  for (const path of MASONRY) {
    await open(path)
    const m = await page.evaluate(() => {
      const grids = [...document.querySelectorAll('.pref-columns, .meta-columns')].filter((g) => g.offsetParent)
      const out = []
      for (const g of grids) {
        const cols = getComputedStyle(g).gridTemplateColumns.split(' ').length
        if (cols < 2) continue
        const gap = parseFloat(getComputedStyle(g).columnGap) || 0
        const boxes = [...g.children].map((k) => {
          const b = k.getBoundingClientRect()
          const mb = parseFloat(getComputedStyle(k).marginBottom) || 0
          return { l: b.left, r: b.right, t: b.top, b: b.bottom + mb }
        })
        for (const k of boxes) {
          const above = boxes.filter((o) => o !== k && o.b <= k.t + 1 && o.l < k.r - 1 && o.r > k.l + 1)
          const overlaps = boxes.filter((o) => o !== k && o.t < k.b - 2 && o.b > k.t + 2 && o.l < k.r - 1 && o.r > k.l + 1)
          if (overlaps.length) out.push(`a card at ${Math.round(k.l)},${Math.round(k.t)} overlaps another`)
          if (!above.length) continue
          const hole = k.t - Math.max(...above.map((o) => o.b))
          if (hole > gap + 6) out.push(`a card at ${Math.round(k.l)},${Math.round(k.t)} floats ${Math.round(hole)}px under the one above it (gap ${gap}px)`)
        }
      }
      return out
    })
    console.log(`${path.padEnd(22)} masonry ${m.length ? m.length + ' problem(s)' : 'packed'}`)
    for (const f of m) failures.push(`${path}: ${f}`)
  }
} finally {
  await browser.close()
}

if (failures.length) {
  console.error('\nmetadata-layout FAILED:')
  for (const f of failures) console.error('  - ' + f)
  process.exit(1)
}
console.log('\nmetadata-layout: tabs level, underlines even, faces matched, records two lines, cards packed')
