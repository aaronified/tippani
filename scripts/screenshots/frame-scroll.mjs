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
      coverW: q('.work-hero-cover') ? Math.round(q('.work-hero-cover').getBoundingClientRect().width) : null,
      // How far the action row's bottom edge falls past what the column shows.
      // <= 0 means a reader sees both verbs without scrolling for them.
      actionsBelow: (() => {
        const col = q('.tp-detail-hero')
        const acts = q('.work-hero-actions')
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

  // ---- THE ONE ARRANGEMENT, AT THE THREE WIDTHS IT HAS TO ANSWER ----------
  //
  // There used to be three hero COMPONENTS and a hook that picked between them.
  // There is one now, and where the cover sits is a single stylesheet rule — so
  // this is the check that the rule fires at the right widths, which is the only
  // thing that could silently go wrong about it. Stacked in the two-column frame
  // (no room beside a 300px column), BESIDE its facts in between (stacked there
  // leaves most of a wide page blank), stacked again on a phone (no room beside
  // anything). And at every width the cover keeps the pack's 132.
  // BOTH PAGES, and the film half is the reason this loop exists in its second
  // form. The arrangement was first written as a width range — 769 to 1179 — on
  // the assumption that above 1180 every hero is in the 300px column. Only a
  // BOOK's page enters that column; a film's is a plain page at every width, so
  // above 1180 a film stacked a 132px cover above full-width facts in 1140px of
  // paper. The check could not see it, because it only ever loaded /books/:id.
  //
  // A film is therefore `beside` at 1440 where a book is `stacked`: same
  // component, same markup, different container — which is the whole claim the
  // collapse makes, measured rather than asserted.
  const ARRANGEMENTS = [
    ['books', 1440, 'stacked'], ['books', 900, 'beside'], ['books', 390, 'stacked'],
    ['movies', 1440, 'beside'], ['movies', 900, 'beside'], ['movies', 390, 'stacked'],
  ]
  for (const [kind, w, want] of ARRANGEMENTS) {
    const label = kind === 'books' ? 'book-detail' : 'movie-detail'
    await page.setViewport({ width: w, height: 900 })
    await page.goto(`${opts.baseUrl}/${kind}/1`, { waitUntil: 'networkidle0' })
    await page.waitForSelector(`[data-screen-label="${label}"] h1`, { timeout: opts.timeoutMs })
    await new Promise((r) => setTimeout(r, 800))
    const a = await page.evaluate((sel) => {
      const cover = document.querySelector('.work-hero-cover')
      const h1 = document.querySelector(`[data-screen-label="${sel}"] h1`)
      if (!cover || !h1) return null
      const c = cover.getBoundingClientRect()
      const t = h1.getBoundingClientRect()
      return {
        // Beside: the cover ends before the title starts, horizontally. Stacked:
        // the cover ends before the title starts, vertically. Measured rather
        // than read off a class, because a media query that never matched would
        // leave the class in place and the layout wrong.
        arrangement: c.right <= t.left + 1 ? 'beside' : c.bottom <= t.top + 1 ? 'stacked' : 'overlapping',
        coverW: Math.round(c.width),
        // Nothing may push the page sideways. A 30px display title in a 390px
        // window is the case that would.
        overflowX: Math.round(document.documentElement.scrollWidth - document.documentElement.clientWidth),
        // The header's own rhythm, read off the computed style. It restates
        // --row rather than inheriting it, because --row is 18 inside the
        // two-column frame and 12 everywhere else — and only a book's page is
        // inside it, so an inherited value spaced a film's header at 12 and a
        // book's at 18 for no reason anybody chose.
        row: getComputedStyle(document.querySelector('.work-hero')).getPropertyValue('--row').trim(),
      }
    }, label)
    if (!a) {
      failures.push(`${kind} ${w}x900: the hero drew no cover or no title`)
      continue
    }
    console.log(`${kind} ${w}x900   cover ${a.coverW}px, ${a.arrangement} (want ${want}), --row ${a.row}, overflows ${a.overflowX}px`)
    if (a.arrangement !== want) {
      failures.push(`${kind} ${w}x900: the cover is ${a.arrangement} its facts, and here it should be ${want}`)
    }
    if (a.coverW < 120 || a.coverW > 180) {
      failures.push(`${kind} ${w}x900: the cover is ${a.coverW}px — the pack draws 132 and the frame derives at most 150`)
    }
    if (a.overflowX > 0) {
      failures.push(`${kind} ${w}x900: the page scrolls ${a.overflowX}px sideways — something in the hero is wider than the window`)
    }
    if (a.row !== '18px') {
      failures.push(`${kind} ${w}x900: the header's --row is ${a.row || 'unset'} — it must carry its own 18 on every page, not inherit the page's`)
    }
  }

  // ---- THE COMPACT BAR, WHICH ONLY A REAL BROWSER CAN SEE ------------------
  //
  // The owner's request: "when the hero section is scrolled down, the poster,
  // title and author needs to morph into a small top bar in that section."
  //
  // jsdom stubs IntersectionObserver with a class whose callback is never called,
  // so every assertion about this in the unit suite is vacuously true — the bar
  // can never appear there, in either direction. This is the only place it can be
  // watched arriving.
  //
  // AND THE THING IT MUST NOT DO IS MOVE THE PAGE. A sticky bar that joins the
  // flow pushes everything below it down by its own height, which as a reader is
  // a jump under your thumb mid-scroll. The scroll position is read before and
  // after, and they have to agree.
  let miniSeen = false
  // THE INVARIANT, IN BOTH DIRECTIONS, rather than "scroll and hope a bar turns
  // up". Whether the fixture's hero is tall enough to push its own marker off the
  // top depends on the cover, the type dial and the window — at 1440x520 there is
  // 218px of scroll room and the cover alone is 225px, so it CANNOT happen there,
  // and a check that demanded a bar would be demanding a bug.
  //
  // What is actually claimed is: the bar is present exactly when the marker is
  // above the top of the column, and never otherwise. That is checkable at any
  // height and is never vacuous — where the marker cannot be pushed off, it
  // asserts the bar stays away, which is the half that was wrong first (the bar
  // appeared at rest on every short window, because "not intersecting" is true
  // below the fold as well as above it).
  // 340 IS IN THE LIST BECAUSE THE OTHERS CANNOT REACH IT. The fixture book has a
  // short description and three credits, so its header is ~748px and the marker
  // sits 368px down — which means the column has to be shorter than 380px before
  // it can push its own marker off the top. At 380 it misses by ONE PIXEL. A real
  // book with a paragraph of description and six genres clears it on any laptop;
  // the fixture does not, and a check that only ever asserted "no bar" would be
  // half a check. So one height is chosen to make it fire.
  for (const [w, h] of [[1440, 900], [1440, 520], [1440, 380], [1440, 340]]) {
    await page.setViewport({ width: w, height: h })
    await page.goto(`${opts.baseUrl}/books/${opts.bookId}`, { waitUntil: 'networkidle0' })
    await page.waitForSelector('[data-screen-label="book-detail"] h1', { timeout: opts.timeoutMs })
    await new Promise((r) => setTimeout(r, 1200))
    const mini = await page.evaluate(async () => {
      const col = document.querySelector('.tp-detail-hero')
      const mark = document.querySelector('.work-hero-mark')
      if (!col || !mark) return { why: !col ? 'no hero column' : 'no marker in the header' }
      const read = () => {
        const bar = document.querySelector('.work-hero-mini')
        return {
          bar: !!bar && bar.getBoundingClientRect().height > 0,
          above: mark.getBoundingClientRect().top < col.getBoundingClientRect().top,
        }
      }
      // A second copy of the name in the document is the cost of this bar, so it
      // may not be paid until it is wanted.
      const rest = { ...read(), titles: document.querySelectorAll('[data-screen-label="book-detail"] h1, .work-hero-mini-title').length }
      col.scrollTop = col.scrollHeight
      await new Promise((r) => setTimeout(r, 450))
      const at = col.scrollTop
      const bottom = read()
      await new Promise((r) => setTimeout(r, 250))
      return {
        rest,
        bottom,
        room: Math.round(col.scrollHeight - col.clientHeight),
        // How far the marker sits below the top of the column at rest. The bar
        // can only ever appear when the column has more scroll room than this.
        markOffset: Math.round(mark.getBoundingClientRect().top - col.getBoundingClientRect().top + col.scrollTop),

        moved: Math.abs(col.scrollTop - at),
        hasCover: !!document.querySelector('.work-hero-mini-cover'),
      }
    })
    if (mini.why) {
      failures.push(`${w}x${h}: ${mini.why}`)
      continue
    }
    console.log(
      `${w}x${h}   compact bar: ${mini.room}px of room, marker ${mini.markOffset}px down · at rest bar=${mini.rest.bar} above=${mini.rest.above} ` +
        `titles=${mini.rest.titles} · scrolled bar=${mini.bottom.bar} above=${mini.bottom.above} · moved ${mini.moved}px`,
    )
    for (const [when, r] of [['at rest', mini.rest], ['scrolled to the end', mini.bottom]]) {
      if (r.bar !== r.above) {
        failures.push(
          `${w}x${h}: ${when}, the marker is ${r.above ? '' : 'not '}above the top of the column and the compact bar is ` +
            `${r.bar ? 'shown' : 'absent'} — it must be shown exactly when the header it repeats has gone`,
        )
      }
    }
    if (mini.rest.titles !== 1) {
      failures.push(`${w}x${h}: ${mini.rest.titles} copies of the title in the document at rest — there must be exactly one`)
    }
    if (mini.bottom.bar) miniSeen = true
    if (mini.bottom.bar && !mini.hasCover) {
      failures.push(`${w}x${h}: the compact bar is shown but carries no cover — it is meant to carry the poster`)
    }
    // A sticky bar that joins the flow pushes everything below it down by its own
    // height: a jump under the reader's thumb, mid-scroll, from the one element
    // that exists to steady them.
    if (mini.moved > 1) {
      failures.push(`${w}x${h}: the column moved ${mini.moved}px when the bar appeared — it must cost no layout`)
    }
  }

  if (!miniSeen) {
    failures.push(
      'the compact bar never appeared at any height — the invariant held, but only in its "stay away" ' +
        'half, which is a check that would pass on a bar that had been deleted',
    )
  }

  // ---- HOW WIDE ONE QUOTE CARD ACTUALLY IS -------------------------------
  //
  // The owner's report, twice: "i see 4 columns in the board tile, all very
  // skinny, on a 1080p screen. the annotations need at least double the width."
  // The board asked how wide the WINDOW was while living in a column that is the
  // window minus the rail minus the hero and then capped for measure, so at 1920
  // it dealt five columns inside 880px — 163px each, a column of syllables.
  //
  // MEASURED AS A CARD, not as a column count, because the count is not the
  // claim: two columns of 163px would be just as wrong. ~400px is what the ladder
  // was chosen to produce and what a quote wants to be read at.
  // BOTH ENDS, because the first attempt at this guard only had a floor and the
  // over-correction sailed through it: the hook returned 1 for ever (its effect
  // keyed on a ref object that never changes, so it ran once before the board
  // existed), the board drew ONE 880px column, and a check asking "is the card at
  // least 300px" said yes. A measure has an upper bound as well as a lower one —
  // 880px of quote in a single column is the same mistake in the other direction.
  const MIN_CARD = 300
  const MAX_CARD = 620
  for (const w of [1920, 1440, 1180]) {
    await page.setViewport({ width: w, height: 900 })
    await page.goto(`${opts.baseUrl}/books/${opts.bookId}`, { waitUntil: 'networkidle0' })
    await page.waitForSelector('[data-screen-label="book-detail"]', { timeout: opts.timeoutMs })
    await new Promise((r) => setTimeout(r, 1500))
    const b = await page.evaluate(() => {
      // The masonry deals absolutely-positioned children into columns; the widest
      // card IS the column width, and counting distinct left edges counts columns.
      const cards = [...document.querySelectorAll('.tp-detail-stream [style*="position: absolute"]')]
      if (!cards.length) return null
      const rects = cards.map((el) => el.getBoundingClientRect())
      return {
        card: Math.round(Math.max(...rects.map((r) => r.width))),
        cols: new Set(rects.map((r) => Math.round(r.left))).size,
      }
    })
    if (!b) {
      console.log(`${w}x900   board: no cards on screen (an empty fixture book?)`)
      continue
    }
    console.log(`${w}x900   board ${b.cols} column(s), widest card ${b.card}px`)
    if (b.card < MIN_CARD) {
      failures.push(
        `${w}x900: the board is dealing ${b.cols} columns and the widest card is ${b.card}px — ` +
          `a quote is read, not glanced at, and under ${MIN_CARD} it is a column of syllables`,
      )
    }
    // The floor only above 1180: below it the stream is the whole page and one
    // column IS the arrangement.
    if (w > 1180 && b.card > MAX_CARD) {
      failures.push(
        `${w}x900: the board is dealing ${b.cols} column(s) at ${b.card}px — ` +
          'the ladder is not firing, so the board is one over-wide column instead of two',
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
  // ---- the metadata screen's own frame ------------------------------------
  //
  // WHY IT IS HERE AT ALL. That screen grew a rail beside a body — two columns on
  // a desk, a scrolling row of the same doors on a phone — and every claim in that
  // sentence is a layout claim, which is precisely the class jsdom cannot answer:
  // it has no layout, so a unit test can prove the rail RENDERS and can never prove
  // it is a column, that it stays put while the body scrolls, or that it scrolls
  // under a fade when five doors do not fit 390px.
  //
  // THE PHONE CASE IS THE ONE WORTH MEASURING. A row of five that overflows and
  // does not scroll is a screen with two sections a reader cannot reach, and it
  // looks exactly like a screen with three sections.
  for (const [w, h, want] of [[1280, 900, 'beside'], [980, 900, 'beside'], [860, 900, 'stacked'], [390, 780, 'stacked']]) {
    await page.setViewport({ width: w, height: h })
    await page.goto(`${opts.baseUrl}/metadata`, { waitUntil: 'networkidle0' })
    await page.waitForSelector('.meta-rail', { timeout: opts.timeoutMs })
    await new Promise((r) => setTimeout(r, 500))
    const m = await page.evaluate(() => {
      const frame = document.querySelector('.meta-frame')
      const rail = document.querySelector('.meta-rail')
      const body = document.querySelector('.meta-body')
      if (!frame || !rail || !body) return null
      const r = rail.getBoundingClientRect()
      const b = body.getBoundingClientRect()
      const items = [...rail.querySelectorAll('.meta-rail-item')]
      return {
        doors: items.length,
        // BESIDE means the body starts to the right of the rail's right edge; a
        // tolerance of 1px, because a fractional grid track is not a stack.
        arrangement: b.left >= r.right - 1 ? 'beside' : 'stacked',
        railW: Math.round(r.width),
        overflows: rail.scrollWidth > rail.clientWidth + 1,
        // The measured attribute the fade is painted from. Absent means the hook
        // decided nothing overflows, which is only correct when nothing does.
        fade: rail.getAttribute('data-scroll-x') || '',
        // Every door reachable: the last one's right edge inside the scrollable
        // extent rather than inside the visible box.
        lastRight: items.length ? Math.round(items[items.length - 1].getBoundingClientRect().right - r.left + rail.scrollLeft) : 0,
        scrollW: rail.scrollWidth,
      }
    })
    if (!m) {
      failures.push(`${w}x${h}: the metadata frame did not render`)
      continue
    }
    console.log(
      `${w}x${h}   metadata rail ${m.doors} door(s), ${m.arrangement}, ${m.railW}px` +
        `${m.overflows ? `, scrolls (fade "${m.fade}")` : ''}`,
    )
    if (m.doors !== 5) failures.push(`${w}x${h}: the rail drew ${m.doors} door(s), want 5`)
    if (m.arrangement !== want) {
      failures.push(`${w}x${h}: the rail is ${m.arrangement} beside its body, want ${want}`)
    }
    // A ROW THAT OVERFLOWS AND WEARS NO FADE IS THE BUG THE STANDING RULE NAMES:
    // the fade is the only signal that a row scrolls, so an overflow without one
    // is doors nobody can find.
    if (m.overflows && !m.fade) {
      failures.push(`${w}x${h}: the rail overflows (${m.scrollW}px in ${m.railW}px) and wears no edge fade`)
    }
    if (m.lastRight > m.scrollW + 1) {
      failures.push(`${w}x${h}: the last door ends at ${m.lastRight}px, past the ${m.scrollW}px it can scroll to`)
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
console.log('\nframe-scroll: the frame is bounded, both columns scroll, the name is whole at every width, and the metadata rail is reachable at each')
