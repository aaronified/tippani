#!/usr/bin/env node
// The work detail screen, measured in a real browser: does its frame scroll,
// does it clip, and is the book's own name drawn in one piece?
//
// THE FAILURE THIS EXISTS FOR is a screen that opts out of the window's scroll
// and then gives nothing back. That screen locks the document at 100dvh and asks
// two columns inside it to scroll instead — which needs an unbroken chain of
// definite heights from the viewport down. One missing link and the boxes simply
// grow to their content: no scrollbar appears, no error is thrown, nothing logs,
// and the body's own `overflow: hidden` quietly cuts off everything past the
// first screen. A book's quotes become unreachable and the page looks deliberate.
//
// That is exactly what shipped, and NOTHING in the repo could have caught it:
// jsdom has no layout, so `scrollHeight` there is a constant 0 and every
// assertion about scrolling passes vacuously. The stylesheet half is guarded by
// test/pure/screen-scroll-chain.test.js, which fails when a link is deleted. This
// is the other half — the one that measures.
//
// WHY A SHORT WINDOW IS PART OF THE CHECK. The fixture library's books carry two
// or three quotes, which fit whatever the frame does; measured only at 1440x900
// the stream reports "0 to scroll" whether it is bounded or broken. At 1440x520
// its content cannot fit, so a stream that still reports 0 is a stream that is
// not a scroller — the difference this file exists to see.
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import puppeteer from 'puppeteer-core'

import { HARNESS_ACCOUNT, ensureSession, findFirefox } from './capture.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))

function parseArgs(argv) {
  const out = {
    baseUrl: 'http://127.0.0.1:8080',
    username: HARNESS_ACCOUNT.username,
    password: HARNESS_ACCOUNT.password,
    bookId: '1',
    timeoutMs: 30000,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const next = () => argv[++i]
    if (a === '--base-url') out.baseUrl = next()
    else if (a === '--username') out.username = next()
    else if (a === '--password') out.password = next()
    else if (a === '--book-id') out.bookId = next()
    else if (a === '--timeout') out.timeoutMs = Number(next())
    else if (a === '--help' || a === '-h') {
      console.log(`usage: node frame-scroll.mjs [--base-url URL] [--book-id N]

Opens one book's detail at two window sizes and fails if the page clips or a
column cannot scroll. Point --base-url at a scratch server (run-frame-scroll.sh
boots one, seeds it, and passes the flag).`)
      process.exit(0)
    }
  }
  return out
}

// The two sizes, and what each one is for. Both are >= the 1180px the frame
// switches on at; the second is short enough that the fixture's own content
// cannot fit in the stream.
const SIZES = [
  { w: 1440, h: 900, label: 'a normal desktop window' },
  { w: 1440, h: 520, label: 'a short window, where the stream MUST overflow' },
]

// THE NAME IS CHECKED ACROSS THE OTHER ARRANGEMENT'S WHOLE BAND, not at one
// width, because what breaks it is a float fitting on one line and not the next
// — which is a property of the exact number, not of the layout. 900 is where it
// was caught; its neighbours 1000 and 800 were both fine, which is precisely why
// one sample would have said the screen was well.
const NAME_WIDTHS = [1179, 1100, 1000, 950, 900, 850, 800, 780]

async function measure(page) {
  return page.evaluate(() => {
    const q = (s) => document.querySelector(s)
    const room = (el) => (el ? el.scrollHeight - el.clientHeight : null)
    return {
      locked: document.documentElement.getAttribute('data-scroll') === 'screen',
      // What the reader cannot reach. A locked body that holds more than it
      // shows is content nothing can scroll to.
      clipped: document.body.scrollHeight - document.body.clientHeight,
      hero: room(q('.tp-detail-hero')),
      stream: room(q('.tp-detail-stream')),
      streamHas: q('.tp-detail-stream') ? q('.tp-detail-stream').scrollHeight : 0,
      // THE STANDING RULE: an edge fade means it scrolls. A column with room
      // below it and no fade is a column that has given the reader no signal —
      // which is the same failure as not scrolling, one step later.
      heroFade: q('.tp-detail-hero') ? q('.tp-detail-hero').getAttribute('data-scroll-v') : null,
      streamFade: q('.tp-detail-stream') ? q('.tp-detail-stream').getAttribute('data-scroll-v') : null,
      // ---- THE HERO'S OWN PROPORTIONS -------------------------------------
      // Both of these are one defect measured at two points, and it shipped:
      // the cover was given `width: 100%`, which at 300px is 2.3x the design's
      // 132 and FIVE TIMES its area, and the ~290px it pushed downward put the
      // two verbs a reader came for below the fold. Neither half is visible to
      // jsdom — `getBoundingClientRect` there is all zeroes — so this is the
      // only place in the repo that can see it.
      colW: q('.tp-detail-hero') ? Math.round(q('.tp-detail-hero').clientWidth) : null,
      coverW: q('.work-hero-col-cover') ? Math.round(q('.work-hero-col-cover').getBoundingClientRect().width) : null,
      // How far the action row's bottom edge falls past what the column shows.
      // <= 0 means a reader sees both verbs without scrolling for them.
      actionsBelow: (() => {
        const col = q('.tp-detail-hero')
        const acts = q('.work-hero-col-actions')
        if (!col || !acts) return null
        return Math.round(acts.getBoundingClientRect().bottom - col.getBoundingClientRect().bottom)
      })(),
    }
  })
}

// A NAME'S LINES ALL START IN THE SAME PLACE, or something has cut into it.
//
// THE DEFECT THIS CATCHES, seen at exactly 1179x820 down to about 950: the hero
// floats its action buttons right and its cover left, and where the buttons left
// a sliver on the first line the title flowed into it — so "Moby-Dick; or, The
// Whale" was drawn as "Moby-" on one line, then five buttons, then "Dick; or,
// The Whale" beside the cover. The book's name torn in half with a toolbar in the
// tear. Nothing clipped, nothing overflowed, every existing guard passed: the
// name was all there, in the wrong two places.
//
// It is measured rather than eyeballed because it is a property of the exact
// width. The test is simple and general — group the title's client rects into
// lines by their top edge, take each line's left edge, and fail when they
// disagree. A title that wraps is fine; a title that wraps AROUND something is
// not.
async function nameIsWhole(page) {
  return page.evaluate(() => {
    const h1 = document.querySelector('[data-screen-label="book-detail"] h1')
    if (!h1) return { ok: false, why: 'the detail drew no title at all' }
    const range = document.createRange()
    range.selectNodeContents(h1)
    const rects = [...range.getClientRects()].filter((r) => r.width > 0 && r.height > 0)
    if (!rects.length) return { ok: false, why: 'the title has no drawn text' }
    // One entry per line, keyed by rounded top; the value is that line's left.
    const lines = new Map()
    for (const r of rects) {
      const key = Math.round(r.top)
      lines.set(key, Math.min(lines.has(key) ? lines.get(key) : Infinity, Math.round(r.left)))
    }
    const lefts = [...lines.values()]
    const spread = Math.max(...lefts) - Math.min(...lefts)
    return {
      ok: spread <= 1,
      spread,
      lines: lefts.length,
      text: h1.textContent.trim().slice(0, 60),
      why: `the title is drawn on ${lefts.length} lines starting at ${lefts.join('px, ')}px — ` +
        'a float has cut into the name',
    }
  })
}

const opts = parseArgs(process.argv.slice(2))
const browser = await puppeteer.launch({
  browser: 'firefox',
  executablePath: findFirefox(),
  headless: true,
  defaultViewport: { width: SIZES[0].w, height: SIZES[0].h },
})
const failures = []
try {
  const page = await browser.newPage()
  await ensureSession(page, opts)
  for (const size of SIZES) {
    await page.setViewport({ width: size.w, height: size.h })
    await page.goto(`${opts.baseUrl}/books/${opts.bookId}`, { waitUntil: 'networkidle0' })
    await page.waitForSelector('[data-screen-label="book-detail"]', { timeout: opts.timeoutMs })
    // The quotes arrive after the screen does, and the column is only as tall as
    // what is in it — measuring before they land measures an empty stream.
    await new Promise((r) => setTimeout(r, 1800))
    const m = await measure(page)
    console.log(
      `${size.w}x${size.h}  locked=${m.locked}  clipped=${m.clipped}px  ` +
        `hero ${m.hero}px/${m.heroFade || 'no fade'}  stream ${m.stream}px/${m.streamFade || 'no fade'}  (${size.label})`,
    )
    if (!m.locked) failures.push(`${size.w}x${size.h}: the screen never took the lock`)
    if (m.clipped > 0) {
      failures.push(`${size.w}x${size.h}: ${m.clipped}px of the page is cut off and unreachable`)
    }
    if (m.hero === null || m.stream === null) {
      failures.push(`${size.w}x${size.h}: the frame's columns are not on the page at all`)
    }
    for (const [name, room, fade] of [['hero', m.hero, m.heroFade], ['stream', m.stream, m.streamFade]]) {
      if (room > 0 && !fade) {
        failures.push(
          `${size.w}x${size.h}: the ${name} column has ${room}px below the fold and wears no edge fade — ` +
            'nothing tells the reader there is more',
        )
      }
    }
    // THE COVER IS AN OBJECT IN THE COLUMN, NOT THE COLUMN. The pack draws it at
    // 132 of 300 — 44%. Half is the ceiling rather than the target: it leaves room
    // for a different column width or a rounded ratio, and still fails the version
    // that took the whole 300.
    if (m.coverW !== null && m.colW) {
      const share = m.coverW / m.colW
      console.log(`          cover ${m.coverW}px of ${m.colW}px column (${Math.round(share * 100)}%), actions ${m.actionsBelow}px below the fold`)
      if (share > 0.5) {
        failures.push(
          `${size.w}x${size.h}: the cover is ${m.coverW}px of a ${m.colW}px column (${Math.round(share * 100)}%) — ` +
            'it is meant to be an object in the column, not the column',
        )
      }
    }
    // AND THE VERBS ARE ABOVE THE FOLD, at the size a desktop actually is. Not
    // checked at 520: a window that short cannot hold a hero, and demanding it
    // would be demanding the description be cut instead.
    if (size.h === 900 && m.actionsBelow !== null && m.actionsBelow > 0) {
      failures.push(
        `${size.w}x${size.h}: the hero's action row ends ${m.actionsBelow}px past the bottom of its column — ` +
          'the two verbs the page is for are below the fold',
      )
    }
    if (size.h === 520 && m.stream === 0 && m.streamHas > size.h) {
      failures.push(
        `${size.w}x${size.h}: the stream holds ${m.streamHas}px and scrolls nowhere — ` +
          'its height chain is broken, so it grew to its content instead of scrolling',
      )
    }
  }

  // The other arrangement's whole band. Height is fixed and irrelevant here —
  // what is being asked is a question about width.
  for (const w of NAME_WIDTHS) {
    await page.setViewport({ width: w, height: 820 })
    await page.goto(`${opts.baseUrl}/books/${opts.bookId}`, { waitUntil: 'networkidle0' })
    await page.waitForSelector('[data-screen-label="book-detail"] h1', { timeout: opts.timeoutMs })
    await new Promise((r) => setTimeout(r, 600))
    const n = await nameIsWhole(page)
    console.log(`${w}x820   title on ${n.lines ?? '?'} line(s), left spread ${n.spread ?? '?'}px  ${n.ok ? 'whole' : 'BROKEN'}`)
    if (!n.ok) failures.push(`${w}x820: ${n.why}  (“${n.text ?? ''}”)`)
  }
} finally {
  await browser.close()
}

if (failures.length) {
  console.error('\nframe-scroll FAILED:')
  for (const f of failures) console.error('  - ' + f)
  process.exit(1)
}
console.log('\nframe-scroll: the frame is bounded, both columns scroll, and the name is whole at every width')
