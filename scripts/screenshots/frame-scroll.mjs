#!/usr/bin/env node
// Does the work detail's frame actually scroll, and does it clip?
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
    if (size.h === 520 && m.stream === 0 && m.streamHas > size.h) {
      failures.push(
        `${size.w}x${size.h}: the stream holds ${m.streamHas}px and scrolls nowhere — ` +
          'its height chain is broken, so it grew to its content instead of scrolling',
      )
    }
  }
} finally {
  await browser.close()
}

if (failures.length) {
  console.error('\nframe-scroll FAILED:')
  for (const f of failures) console.error('  - ' + f)
  process.exit(1)
}
console.log('\nframe-scroll: the frame is bounded and both columns scroll')
