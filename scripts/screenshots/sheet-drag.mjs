#!/usr/bin/env node
// A PHONE SHEET YOU CAN ACTUALLY DRAG — measured in a real browser, because a
// drag is the one thing jsdom cannot have.
//
// THE OWNER'S RULING, over a screenshot of a bottom sheet with a grab handle:
// "the small bar on top ensures that this is intuitively draggable. the whole
// thing is responsive to drag, and has predefined anchors."
//
// WHAT THE TWO OTHER LAYERS ALREADY ANSWER, so that this one does not repeat
// them. `test/pure/sheet-anchors.test.js` states the arithmetic — which anchor a
// release lands on and when a release is a dismissal — with no React in it.
// `test/dom/sheet-from-the-bottom.test.jsx` states the wiring: which presses
// start a drag, that the sheet resizes rather than slides, that leaving goes
// through the guarded exit. Both of those had to FAKE a height, because jsdom
// reports every box at zero — so neither of them can tell whether the sheet a
// reader opens is at an anchor, whether the handle is big enough for a thumb, or
// whether a real drag moves anything at all.
//
// THIS RUNS THE GESTURE. Puppeteer's mouse emits the same pointer events a finger
// does, so the presses below are the reader's: grab the bar, pull up, let go;
// grab it again, pull it off the bottom of the screen.
//
// EVERY CASE PRESSES ITS SUBJECT OR FAILS. A fixture that has drifted out from
// under a probe leaves the probe knowing less than before it ran, and a note in
// the log is how that reads as a pass to whoever is looking at the exit code.
import puppeteer from 'puppeteer-core'

import { anchorsFor } from '../../web/frontend/src/sheetAnchors.js'
import { HARNESS_ACCOUNT, emulateEngineMedia, ensureSession, findBrowser, launchOptions } from './capture.mjs'

function parseArgs(argv) {
  const out = { baseUrl: 'http://127.0.0.1:8080', movieId: '1', timeoutMs: 30000 }
  for (let i = 0; i < argv.length; i++) {
    const next = () => argv[++i]
    if (argv[i] === '--base-url') out.baseUrl = next()
    else if (argv[i] === '--movie-id') out.movieId = next()
    else if (argv[i] === '--timeout') out.timeoutMs = Number(next())
    else if (argv[i] === '--help' || argv[i] === '-h') {
      console.log('usage: node sheet-drag.mjs [--base-url URL] [--movie-id N]\n\n' +
        'Opens a panel at phone width and checks that it is a sheet with a handle,\n' +
        'that it rests at one of its anchors, that a drag up grows it to the next\n' +
        'one, that a plain press on the handle moves it too, and that a drag off the\n' +
        'bottom of the screen closes it.')
      process.exit(0)
    }
  }
  return out
}

const WIDTH = 390
const HEIGHT = 844
// `getBoundingClientRect` is fractional and the settle is a CSS transition, so a
// height within a pixel of an anchor IS that anchor.
const SLACK = 1.5
// The app's own floor for anything a thumb has to hit.
const TAP_FLOOR = 44

const opts = parseArgs(process.argv.slice(2))
const engine = findBrowser(null, 'chrome')
const browser = await puppeteer.launch(launchOptions(engine, { viewport: { width: WIDTH, height: HEIGHT } }))
let failures = 0

const settle = (ms = 500) => new Promise((r) => setTimeout(r, ms))

// The sheet as the reader sees it: where its top edge is, how tall it is, and
// what its handle is.
const readSheet = (page) => page.evaluate((floor) => {
  const el = document.querySelector('.tp-panel')
  if (!el) return null
  const r = el.getBoundingClientRect()
  const grip = el.querySelector('.tp-sheet-grip')
  const g = grip?.getBoundingClientRect()
  const bar = el.querySelector('.tp-panel-head')
  const b = bar?.getBoundingClientRect()
  return {
    top: r.top,
    height: r.height,
    viewport: window.innerHeight,
    grip: grip ? { top: g.top, height: g.height, mid: g.left + g.width / 2, y: g.top + g.height / 2,
                   touchAction: getComputedStyle(grip).touchAction,
                   tall: g.height + 0.5 >= floor } : null,
    // THE HEADER BAR — the drag target since the owner's ruling, and the thing
    // they asked to be slimmer. Its own height, and the tallest key inside it,
    // because the bar may only be as tall as what it has to hold.
    head: bar ? { height: b.height, mid: b.left + b.width / 2, y: b.top + b.height / 2,
                  touchAction: getComputedStyle(bar).touchAction,
                  key: Math.max(0, ...[...bar.querySelectorAll('button')]
                    .map((k) => k.getBoundingClientRect().height)) } : null,
    // What a thumb has to hit before the sheet moves: the mark and the bar are
    // one surface now, so the floor is asked of the two together.
    dragHeight: (g ? g.height : 0) + (b ? b.height : 0),
  }
}, TAP_FLOOR)

// One whole gesture with the pointer, in steps, so the hook sees a drag rather
// than a teleport.
async function pull(page, from, by) {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  const steps = 12
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(from.x, from.y + (by * i) / steps)
    await settle(16)
  }
  await page.mouse.up()
  await settle(450)
}

const nearest = (h, anchors) => anchors.reduce((b, a) => (Math.abs(a - h) < Math.abs(b - h) ? a : b), anchors[0])

try {
  const page = await browser.newPage()
  await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 2, hasTouch: true })
  await emulateEngineMedia(page, engine.browser, 'light')
  await ensureSession(page, {
    baseUrl: opts.baseUrl,
    username: HARNESS_ACCOUNT.username,
    password: HARNESS_ACCOUNT.password,
    timeoutMs: opts.timeoutMs,
  })

  await page.goto(`${opts.baseUrl}/catalogue/${opts.movieId}`, { waitUntil: 'networkidle2' })
  await page.waitForSelector('.tp-btn', { timeout: opts.timeoutMs })
  const opened = await page.evaluate(() => {
    const b = [...document.querySelectorAll('.tp-btn')].find((x) => x.textContent.trim() === 'Details')
    if (!b) return false
    b.click()
    return true
  })
  if (!opened) {
    console.log('FAIL  this film page has no Details key, so there is no panel to drag')
    process.exit(1)
  }
  await settle(1400)

  let s = await readSheet(page)
  if (!s) {
    console.log('FAIL  pressing Details opened no panel, so nothing here can be measured')
    process.exit(1)
  }

  // 1. THERE IS A MARK, AND A THUMB CAN HIT THE SURFACE IT SITS ON.
  //
  //    THE RULING THAT CHANGED THIS CASE: "the bar is too small to drag. the
  //    whole header bar should act as the bar. the bar is there just to make it
  //    intuitive." So the 44px floor is asked of the DRAG SURFACE — the mark's
  //    strip plus the header bar — and not of the mark, which is now a sign and
  //    is deliberately thin.
  if (!s.grip) {
    console.log('FAIL  the sheet draws no mark, so nothing says it moves')
    failures++
  } else if (!s.head) {
    console.log('FAIL  the sheet draws no header bar, so there is nothing to drag it by')
    failures++
  } else if (s.dragHeight + 0.5 < TAP_FLOOR) {
    console.log(`FAIL  the draggable top is ${s.dragHeight.toFixed(1)}px tall, under the ${TAP_FLOOR}px a thumb needs`)
    failures++
  } else if (s.grip.touchAction !== 'none') {
    // The browser's own answer to a drag here is to scroll, and the page is frozen.
    console.log(`FAIL  the mark's touch-action is ${JSON.stringify(s.grip.touchAction)}, so the browser fights the drag`)
    failures++
  } else if (s.head.touchAction === 'auto' || s.head.touchAction === 'manipulation') {
    console.log(`FAIL  the header bar's touch-action is ${JSON.stringify(s.head.touchAction)}, so the browser fights a drag from it`)
    failures++
  } else {
    console.log(`ok    ${s.dragHeight.toFixed(0)}px of draggable top (${s.grip.height.toFixed(0)}px mark + ${s.head.height.toFixed(0)}px bar) that the browser leaves alone`)
  }

  // 1b. AND THE BAR IS NO TALLER THAN WHAT IT HOLDS. The owner: "the header bar
  //     is too thick (vertically). make it slimmer. by at least 30-40%." The
  //     floor under the KEY inside it is the pack's 44 and is not what was
  //     thick; the room around the key was. Asked as a rule rather than as a
  //     number: the bar may exceed its tallest key by the padding a rule needs
  //     and no more.
  const SURROUND = 8
  if (s.head && s.head.key > 0 && s.head.height > s.head.key + SURROUND) {
    console.log(`FAIL  the header bar is ${s.head.height.toFixed(0)}px around a ${s.head.key.toFixed(0)}px key — ${(s.head.height - s.head.key).toFixed(0)}px of it is room around nothing`)
    failures++
  } else if (s.head) {
    console.log(`ok    the header bar is ${s.head.height.toFixed(0)}px around a ${s.head.key.toFixed(0)}px key`)
  }

  // 2. IT OPENS AT AN ANCHOR, and not at whatever its content happened to want.
  //    `natural` is unknowable from outside, so the check is the pack's two stops
  //    OR something smaller than the first — which is what a natural anchor is.
  const anchors = anchorsFor({ viewport: s.viewport })
  const atAnchor = (h) => Math.abs(h - nearest(h, anchors)) <= SLACK || h < anchors[0]
  if (!atAnchor(s.height)) {
    console.log(`FAIL  the sheet opened ${s.height.toFixed(0)}px tall, which is no anchor (${anchors.join(', ')})`)
    failures++
  } else {
    console.log(`ok    the sheet opened ${s.height.toFixed(0)}px tall, at an anchor`)
  }

  // 3. A STRIP OF THE PAGE SURVIVES ABOVE IT. It is what says the reader is on
  //    top of something rather than on a new screen, and it is what the scrim's
  //    blur is drawn on.
  if (!(s.top > 0)) {
    console.log('FAIL  the sheet reaches the top of the screen, so it reads as a route and the blur has nothing to blur')
    failures++
  } else {
    console.log(`ok    ${s.top.toFixed(0)}px of the page is still visible above the sheet`)
  }

  if (s.grip) {
    // 4. A PULL UP GROWS IT, AND IT STAYS GROWN. The failure this replaces stood
    //    still until it vanished; a sheet that springs straight back says the
    //    drag was read and thrown away.
    const before = s.height
    await pull(page, { x: s.grip.mid, y: s.grip.y }, -180)
    s = await readSheet(page)
    if (!s) {
      console.log('FAIL  pulling the handle UP closed the sheet')
      failures++
    } else if (!(s.height > before + SLACK)) {
      console.log(`FAIL  pulling up left the sheet at ${s.height.toFixed(0)}px, where it was ${before.toFixed(0)}px`)
      failures++
    } else if (!atAnchor(s.height)) {
      console.log(`FAIL  the sheet came to rest at ${s.height.toFixed(0)}px, between anchors (${anchors.join(', ')})`)
      failures++
    } else {
      console.log(`ok    a pull up took the sheet from ${before.toFixed(0)}px to ${s.height.toFixed(0)}px, an anchor`)
    }
  }

  // 5. AND A PLAIN PRESS ON THE BAR MOVES IT. The bar is a BUTTON, and a button
  //    that answers a drag and the arrow keys and does nothing when you press it
  //    is exactly the dead control `make controls` exists to catch. A mouse
  //    cannot discover a gesture, and a reader who taps where the app drew
  //    something pressable is owed an answer.
  //
  //    THE PRESS IS A REAL ONE — `mouse.click`, which is pointerdown, pointerup
  //    and click at one point — because that is the sequence the hook has to tell
  //    apart from a drag, and a synthetic `element.click()` skips the two events
  //    that make it hard.
  s = await readSheet(page)
  if (s?.grip) {
    const was = s.height
    await page.mouse.click(s.grip.mid, s.grip.y)
    await settle(450)
    s = await readSheet(page)
    if (!s) {
      console.log('FAIL  pressing the handle closed the sheet')
      failures++
    } else if (Math.abs(s.height - was) <= SLACK) {
      console.log(`FAIL  pressing the handle left the sheet at ${s.height.toFixed(0)}px, exactly where it was`)
      failures++
    } else if (!atAnchor(s.height)) {
      console.log(`FAIL  pressing the handle put the sheet at ${s.height.toFixed(0)}px, between anchors (${anchors.join(', ')})`)
      failures++
    } else {
      console.log(`ok    a press on the handle took the sheet from ${was.toFixed(0)}px to ${s.height.toFixed(0)}px, an anchor`)
    }
  }

  // 5b. AND THE WHOLE BAR DRAGS, not only the mark. This is the ruling itself: a
  //     reader who grabs the header — which is most of them, because it is the
  //     big obvious thing at the top — must move the sheet.
  s = await readSheet(page)
  if (s?.head) {
    const was = s.height
    await pull(page, { x: s.head.mid, y: s.head.y }, -160)
    s = await readSheet(page)
    if (!s) {
      console.log('FAIL  pulling the header bar UP closed the sheet')
      failures++
    } else if (Math.abs(s.height - was) <= SLACK) {
      console.log(`FAIL  a drag from the header bar left the sheet at ${s.height.toFixed(0)}px, exactly where it was`)
      failures++
    } else {
      console.log(`ok    a drag from the header bar took the sheet from ${was.toFixed(0)}px to ${s.height.toFixed(0)}px`)
    }
  }

  // 6. AND A PULL OFF THE BOTTOM CLOSES IT. Twice the viewport, which is past the
  //    smallest anchor by any fraction.
  s = await readSheet(page)
  if (s?.grip) {
    await pull(page, { x: s.grip.mid, y: s.grip.y }, HEIGHT)
    const gone = await page.evaluate(() => !document.querySelector('.tp-panel'))
    if (!gone) {
      const after = await readSheet(page)
      console.log(`FAIL  dragging the sheet off the bottom left it open at ${after.height.toFixed(0)}px`)
      failures++
    } else {
      console.log('ok    dragging the sheet off the bottom closed it')
    }
  } else if (!failures) {
    console.log('FAIL  the sheet vanished before the dismissal could be tried')
    failures++
  }
} finally {
  await browser.close()
}
process.exit(failures ? 1 : 0)
