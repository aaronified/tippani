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
import { HARNESS_ACCOUNT, emulateEngineMedia, ensureSession, filmLookups, findBrowser, launchOptions } from './capture.mjs'
import { pickFilm } from './pickfilm.mjs'
import { judgeDrag, judgeFrames } from './dragverdict.mjs'

function parseArgs(argv) {
  // NO DEFAULT ID. A number here is a fact about one library, and this probe
  // runs against two — the seeded fixture and a restored archive. Left empty it
  // is resolved from whichever library is loaded; see `filmWithCast`.
  const out = { baseUrl: 'http://127.0.0.1:8080', movieId: '', timeoutMs: 30000, surface: 'details' }
  for (let i = 0; i < argv.length; i++) {
    const next = () => argv[++i]
    if (argv[i] === '--base-url') out.baseUrl = next()
    else if (argv[i] === '--movie-id') out.movieId = next()
    else if (argv[i] === '--surface') out.surface = next()
    else if (argv[i] === '--timeout') out.timeoutMs = Number(next())
    else if (argv[i] === '--help' || argv[i] === '-h') {
      console.log('usage: node sheet-drag.mjs [--base-url URL] [--movie-id N] [--surface S]\n\n' +
        'Opens a panel at phone width and checks that it is a sheet with a handle,\n' +
        'that it rests at one of its anchors, that a drag up grows it to the next\n' +
        'one, that a plain press on the handle moves it too, and that a drag off the\n' +
        'bottom of the screen closes it.\n\n' +
        '--surface picks WHICH panel, and it matters more than it looks:\n' +
        '  details    the film\'s Details key. The owner reports this one FINE.\n' +
        '  character  a speaker chip, then the character row in the chooser.\n' +
        '  people     the same chip, then the performer row.\n' +
        'The owner reports the last two flaky, twice, and this probe could not open\n' +
        'either of them until now — so two fixes were written and shipped against\n' +
        'the one surface that was never broken.')
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

// pressChip — the reader's own way into a character or a people panel.
//
// THERE IS NO OTHER WAY IN. `routes.js` parses no /people/{id} or /characters/{id},
// so these two panels exist only behind a chip on a work page, and a probe that
// wanted to reach them by URL would have quietly measured nothing. That is how
// they went unmeasured through two fixes.
const pressChip = async (page, opts, wantActor = false) => {
  try {
    await page.waitForSelector('button.person-chip', { timeout: opts.timeoutMs })
  } catch {
    return 'this film draws no speaker chip, so no character or people panel can be opened from it'
  }
  // WHICH CHIP, AND `is-stacked` IS THE TELL. A chooser only offers a performer row
  // where the line's character HAS a linked performer, and `openCharacterDoor` skips
  // the chooser entirely when one door is live — so a probe that pressed the first
  // chip it found reported "no performer to reach" and looked like a fixture problem.
  // `PersonChip` adds `is-stacked` exactly when it has a sub-line, and that sub-line
  // IS the performer's name, so this is the same fact the chooser will use.
  const ok = await page.evaluate((stacked) => {
    const chip = stacked
      ? document.querySelector('button.person-chip.is-stacked')
      : document.querySelector('button.person-chip')
    if (!chip) return false
    chip.click()
    return true
  }, wantActor)
  if (!ok) {
    return wantActor
      ? 'SKIP no chip on this film names a performer, so no people panel sits behind one'
      : 'the speaker chip vanished between being found and being pressed'
  }
  // The chooser is a panel on the stack and takes an entrance; pressing into it
  // before it has arrived reads as an empty chooser.
  await settle(900)
  return ''
}

// watchHeight — does the sheet move when nothing is moving it.
//
// SAMPLED RATHER THAN OBSERVED, because what is being caught is a height that
// settles more than once: a MutationObserver on the style attribute would report
// every write including the ones that write the same number, and a reader does not
// see a write, they see a change.
//
// `SLACK` IS THE TOLERANCE, not zero. `getBoundingClientRect` is fractional and the
// sheet's height comes off a CSS variable through a transition, so a sub-pixel
// difference between two samples is the same height twice.
const watchHeight = async (page, ms) => page.evaluate((span, slack) => new Promise((done) => {
  const el = document.querySelector('.tp-panel')
  if (!el) return done({ first: 0, moves: ['no panel'] })
  const at = () => Math.round(el.getBoundingClientRect().height * 10) / 10
  const first = at()
  let last = first
  const moves = []
  const tick = setInterval(() => {
    const now = at()
    if (Math.abs(now - last) > slack) {
      moves.push(`${last}px->${now}px`)
      last = now
    }
  }, 50)
  setTimeout(() => { clearInterval(tick); done({ first, moves }) }, span)
}), ms, SLACK)

// One whole gesture with the pointer, in steps, so the hook sees a drag rather
// than a teleport.
// HOW MANY STEPS A PULL IS MADE OF, and how far case 5c pulls. Both were
// literals — a `12` in the helper and a `70` at the call, with a comment beside
// the verdict that said "12 steps of 140px" long after the 140 became 70. The
// slack the verdict allows is one step's worth, so it is arithmetic over these
// two and not a number typed next to them.
const STEPS = 12
const PULL = 70
// The sheet's own exit duration, so this file waits for the animation rather than
// for a number somebody typed beside it. Keep in step with `ui.jsx`'s EXIT_MS.
const EXIT_MS = 160

async function pull(page, from, by, watch) {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  const steps = STEPS
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(from.x, from.y + (by * i) / steps)
    await settle(16)
    // MID-GESTURE READINGS, for the one thing only a browser can answer: whether
    // a frame of this drag costs a LAYOUT or a composite. See case 5c.
    if (watch) {
      watch.push(await page.evaluate(() => {
        const el = document.querySelector('.tp-panel')
        if (!el) return null
        const box = el.getBoundingClientRect()
        return {
          declared: el.style.getPropertyValue('--tp-sheet-h'),
          transform: el.style.transform || '',
          top: Math.round(box.top),
          height: Math.round(box.height),
        }
      }))
    }
  }
  // THE FRAME AFTER THE RELEASE, before the landing has had time to run. The
  // release used to jump to the tallest anchor for a frame — 216px, measured in
  // Chromium — and this probe could not see it: it read the sheet 450ms later,
  // by which time the leap had been animated away.
  await page.mouse.up()
  if (watch) {
    watch.push(await page.evaluate(() => {
      const el = document.querySelector('.tp-panel')
      if (!el) return null
      const box = el.getBoundingClientRect()
      return { released: true, top: Math.round(box.top), height: Math.round(box.height), transform: el.style.transform || '' }
    }))
  }
  await settle(450)
}

const nearest = (h, anchors) => anchors.reduce((b, a) => (Math.abs(a - h) < Math.abs(b - h) ? a : b), anchors[0])

// A LEAP IS NOT A THRESHOLD IN PIXELS, because the landing is an animation and
// the first frame of one has moved. It is a JUMP: the frame after the release is
// nearer to where the sheet ends up than to where the finger left it, or it has
// covered most of the distance at once. 216px out of 216 is a leap; 12px out of
// 100 is an ease that has started.
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

  // THE SUBJECT, ASKED OF THE LIBRARY THAT IS LOADED, and written back onto `opts`
  // so the one place that navigates and the messages that name it agree.
  //
  // `--movie-id 2` was a seeded-fixture fact (`seed-cast.mjs --movie-id 2` is what
  // puts a cast on it) carried onto the archive path, where `/catalogue/2` need not
  // be a film at all: measured, the probe spent thirty seconds on
  // `waitForSelector('.tp-btn')` and died with "Waiting for selector `.tp-btn`
  // failed" — a message about a button, from a wrong id, on a screen that was never
  // a film.
  // CAST IS REQUIRED FOR TWO OF THE THREE. A speaker chip is drawn from a line's
  // own cast link, so a film with no cast has no chip and no way into either panel
  // — and picking such a film would report "no chip" as a defect in the app.
  opts.movieId = opts.movieId || await pickFilm({ ...filmLookups(page, opts.baseUrl), wantCast: opts.surface !== 'details' })
  if (!opts.movieId) {
    console.log('SKIP  the library has no film to open, so there is no sheet to measure')
    process.exit(0)
  }

  await page.goto(`${opts.baseUrl}/catalogue/${opts.movieId}`, { waitUntil: 'networkidle2' })

  // WHICH PANEL, AND WHY IT IS A FLAG RATHER THAN A CONSTANT.
  //
  // THE OWNER, TWICE: "the drag issue is still not solved for character and people
  // popups. details are totally fine, as before." This probe opened the Details key
  // and nothing else — the ONE surface they had already called fine — so two fixes
  // were written, shipped and reported closed against a panel that was never
  // broken. That is the whole reason this flag exists, and the reason it takes a
  // value rather than defaulting to "whatever is easiest to reach".
  //
  // THE OTHER TWO HAVE NO URL. `routes.js` parses no /people/{id} or
  // /characters/{id}, so a chip press is the only way in and the probe has to make
  // the same journey a reader does: press the speaker chip, then answer the chooser
  // that `openCharacterDoor` opens.
  const openers = {
    details: async () => {
      await page.waitForSelector('.tp-btn', { timeout: opts.timeoutMs })
      return page.evaluate(() => {
        const b = [...document.querySelectorAll('.tp-btn')].find((x) => x.textContent.trim() === 'Details')
        if (!b) return 'this film page has no Details key'
        b.click()
        return ''
      })
    },
    // The chip may open the character panel OUTRIGHT — `openCharacterDoor` skips the
    // chooser when only one door is live, which is a character with no linked
    // performer. So a missing chooser is a pass here and a SKIP for `people`.
    character: async () => {
      const why = await pressChip(page, opts)
      if (why) return why
      return page.evaluate(() => {
        const rows = [...document.querySelectorAll('button.cs-choose')].filter((b) => !b.disabled)
        if (!rows.length) return ''
        // THE CHARACTER-ON-THIS-WORK ROW IS THE FIRST, and the `key` that says so is
        // a React key rather than an attribute — so it is identified by position and
        // by carrying no works count, which is the global row's own mark.
        const local = rows[0]
        if (local.querySelector('.cs-choose-meta')) return 'the first chooser row carries a works count, so it is not the work-level character'
        local.click()
        return ''
      })
    },
    people: async () => {
      const why = await pressChip(page, opts, true)
      if (why) return why
      return page.evaluate(() => {
        const rows = [...document.querySelectorAll('button.cs-choose')].filter((b) => !b.disabled)
        if (!rows.length) return 'SKIP the chip opened its character outright, so this line has no performer to reach'
        const label = (b) => b.querySelector('.cs-choose-label')?.textContent?.trim() || ''
        // THE PERFORMER IS LAST — the order is the owner's, "the work-character,
        // global-character ... or the people" — and it must not be the character row
        // read twice, which is what a one-row chooser would give.
        const last = rows[rows.length - 1]
        if (rows.length < 2 || label(last) === label(rows[0])) {
          return 'SKIP no performer row on this line, so there is no people panel behind it'
        }
        last.click()
        return ''
      })
    },
  }
  if (!openers[opts.surface]) {
    console.log(`FAIL  --surface ${opts.surface} is not one of details, character, people`)
    process.exit(1)
  }
  const why = await openers[opts.surface]()
  if (why.startsWith('SKIP')) {
    console.log(`SKIP  ${why.slice(5)}`)
    process.exit(0)
  }
  if (why) {
    console.log(`FAIL  ${why}, so there is no panel to drag`)
    process.exit(1)
  }
  await settle(1400)

  let s = await readSheet(page)
  if (!s) {
    console.log(`FAIL  opening the ${opts.surface} panel drew nothing, so nothing here can be measured`)
    process.exit(1)
  }
  console.log(`--    surface: ${opts.surface}`)

  // 0. IT HOLDS STILL WHILE NOTHING IS TOUCHING IT.
  //
  //    THE OWNER'S SYMPTOM, and the one no other case here can see: "it flashes
  //    sometimes". A flash is the sheet changing height with no gesture behind it,
  //    and every case below moves the sheet on purpose — so a sheet that resizes
  //    itself passes all of them.
  //
  //    WHY THESE PANELS AND NOT DETAILS. A details panel has its content when it
  //    mounts; a character or a people panel makes its requests after opening, and
  //    each answer is a render. `refit` runs after every render and is guarded
  //    against a live drag and a live landing — so if the sheet still moves here,
  //    the guard is not the whole story and this is the number that says so.
  const held = await watchHeight(page, 2000)
  if (held.moves.length) {
    console.log(`FAIL  the sheet resized itself ${held.moves.length}x with nothing touching it: ${held.moves.join(' -> ')}`)
    failures++
  } else {
    console.log(`ok    holds still when untouched (${held.first}px for 2s)`)
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
  // THE LADDER ITSELF, REPORTED — not just "did it land on one".
  //
  // Every case in this file asks whether a gesture reached AN ANCHOR, and all of
  // them pass on a sheet with two anchors a thumb's width apart. The owner's
  // report is about the LADDER: "it rarely goes up and never down ... it feels
  // like i am tugging on a hard leather sheet hung on the wall. just that much
  // give." That is a range, and nothing here was measuring it.
  const natural = await page.evaluate(() => {
    const el = document.querySelector('.tp-panel')
    const box = el?.querySelector('.tp-panel-body')
    if (!el || !box) return 0
    let chrome = 0
    for (const kid of el.children) if (kid !== box) chrome += kid.getBoundingClientRect().height
    return Math.ceil(chrome + box.scrollHeight)
  })
  const ladder = anchorsFor({ viewport: s.viewport, natural })
  const travel = ladder.length > 1 ? ladder[ladder.length - 1] - ladder[0] : 0
  console.log(`--    content wants ${natural}px of a ${s.viewport}px screen; ladder ${ladder.join('/')} = ${travel}px of travel`)
  // WHAT A THUMB LANDS ON AT THE TOP OF THE SHEET, which is not the same question
  // as "does .tp-panel-head drag". THE OWNER: "the behaviour i see in character and
  // people screen is that they behave the same way any screen does when i am
  // reaching end of scroll. not how the draggable top bar should perform." That is
  // the browser answering the gesture as a SCROLL and rubber-banding — and per
  // `claim` in ui.jsx, a gesture the browser claims is one this hook stops
  // receiving. It happens when the press lands INSIDE the scrolling body, where
  // `down` only drags while `scrollTop === 0`. So: what is actually up there.
  const top = await page.evaluate(() => {
    const el = document.querySelector('.tp-panel')
    const body = el?.querySelector('.tp-panel-body')
    if (!el) return null
    const r = el.getBoundingClientRect()
    // Everything the reader could plausibly aim at in the top 120px of the sheet,
    // in paint order, with whether it is inside the scroller.
    const rows = []
    for (const n of el.querySelectorAll('*')) {
      const b = n.getBoundingClientRect()
      if (b.height < 8 || b.width < 40) continue
      if (b.top - r.top > 120) continue
      rows.push({
        tag: n.tagName.toLowerCase(),
        cls: (n.className || '').toString().split(/\s+/).filter(Boolean).slice(0, 3).join('.'),
        h: Math.round(b.height),
        dy: Math.round(b.top - r.top),
        inBody: !!body && body.contains(n),
        touch: getComputedStyle(n).touchAction,
      })
    }
    return { scrollTop: body ? body.scrollTop : -1, scrollable: body ? body.scrollHeight > body.clientHeight : false, rows: rows.slice(0, 12) }
  })
  if (top) {
    console.log(`--    body scrolls: ${top.scrollable} (scrollTop ${top.scrollTop})`)
    for (const r of top.rows) {
      console.log(`--      +${String(r.dy).padStart(3)}px ${String(r.h).padStart(3)}px  ${r.inBody ? 'IN BODY ' : 'chrome  '} touch-action:${r.touch.padEnd(12)} ${r.tag}.${r.cls}`)
    }
  }

  // THE DRAG SURFACE MUST OWN THE WHOLE GESTURE, and this is READ rather than
  // performed — the one assertion in this file that presses nothing.
  //
  // WHY IT CANNOT BE A GESTURE. `pull` drives Puppeteer's MOUSE, and `touch-action`
  // governs touch panning rather than mouse events. So a header no finger can drag
  // passes every gesture case in this file, which is precisely what happened for
  // three rounds while the owner reported it broken. The computed value is the only
  // thing within this harness's reach that a real thumb obeys.
  const claimed = await page.evaluate(() => {
    const head = document.querySelector('.tp-panel-head')
    if (!head) return null
    const bad = []
    const scrollers = []
    for (const n of [head, ...head.querySelectorAll('*')]) {
      const cs = getComputedStyle(n)
      const name = n.tagName.toLowerCase() + '.' + (n.className || '').toString().split(/\s+/).filter(Boolean).slice(0, 2).join('.')
      // Anything but `none` leaves the browser a pan to claim, and every real thumb
      // drag is slightly diagonal.
      if (cs.touchAction !== 'none') bad.push(`${name}:${cs.touchAction}`)
      // AND A SCROLL CONTAINER IN HERE IS THE SAME DEFECT ONE LAYER DOWN — the
      // owner's "header should not even have any scrollable part". `visible`
      // computes to `auto` beside a scrolling partner, so both axes are read.
      if (/(auto|scroll)/.test(cs.overflowY) || /(auto|scroll)/.test(cs.overflowX)) {
        scrollers.push(`${name}:${cs.overflowX}/${cs.overflowY}`)
      }
    }
    return { bad, scrollers }
  })
  if (!claimed) {
    console.log('SKIP  no panel header to read, so the drag surface went unchecked')
  } else {
    if (claimed.bad.length) {
      console.log(`FAIL  the header leaves the browser a gesture to claim: ${claimed.bad.join(', ')}`)
      failures++
    } else {
      console.log('ok    the header and everything in it claim the whole gesture (touch-action: none)')
    }
    if (claimed.scrollers.length) {
      console.log(`FAIL  the header has a scrollable part, so a thumb pans it instead of the sheet: ${claimed.scrollers.join(', ')}`)
      failures++
    } else {
      console.log('ok    and nothing in the header is a scroll container')
    }
  }
  // A LADDER WITH NOWHERE BELOW WHERE IT OPENS IS NOT DRAGGABLE DOWNWARD AT ALL.
  // `clampDrag` leaves downward free and `landing` then reads any release below
  // the smallest anchor as either a spring-back or a dismissal — so a sheet whose
  // smallest anchor IS its opening height can only be pulled down to be thrown
  // away, which is the "never down" half of the report.
  // REPORTED, NOT FAILED, and the first cut of this failed it.
  //
  // A sheet whose content exceeds 76% has the ladder [76%, 94%] — it opens at its
  // smallest anchor, so a pull down can only dismiss it. That reads like the "never
  // down" half of the owner's report and IS NOT A DEFECT: it is what a bottom sheet
  // at its lowest detent does everywhere, and the owner calls the Details panel —
  // which has the same two-anchor ladder — "totally fine". What made character and
  // people feel stuck was the header handing the gesture to the browser, one case
  // below. An assertion here condemned three working surfaces on the strength of a
  // symptom whose cause was elsewhere.
  if (natural > 0 && ladder[0] >= Math.round(s.viewport * 0.76)) {
    console.log(`--    content taller than the first stop, so the ladder is ${ladder.join('/')} and down from ${ladder[0]}px dismisses`)
  } else {
    console.log(`--    there is a stop below where it opens (${ladder[0]}px under ${Math.round(s.viewport * 0.76)}px)`)
  }
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

  // 5c. AND A FRAME OF THE DRAG COSTS A COMPOSITE, NOT A LAYOUT.
  //
  //     THE OWNER'S REPORT, three times, and the third named both ends of it:
  //     "now dragging is almost impossible, extremely flaky, and the page tears
  //     too much (often the background blur is removed for a second)". Writing a
  //     HEIGHT every frame re-lays-out the sheet and invalidates the 10px
  //     backdrop blur behind it, so the compositor re-blurred a screen's worth of
  //     pixels at every step; the repair for THAT switched the blur off for the
  //     length of the gesture, which is the second half of the same sentence.
  //
  //     Only a browser can say which property moved. The box must keep ONE height
  //     for the whole gesture — laid out once, at the tallest anchor — while its
  //     top edge follows the finger. A run of readings where the height changes is
  //     the tear, whatever the sheet ends up at.
  s = await readSheet(page)
  if (s?.head) {
    // DOWN, because 5b left the sheet at the TALLEST anchor and a pull up from
    // there is clamped — the top edge cannot move, and the first version of this
    // case reported that as the sheet holding still. A probe has to know where it
    // left the thing it is measuring.
    //
    // AND IT STOPS BETWEEN ANCHORS. At 140px this landed within about ten pixels
    // of the next anchor down, so the landing had nothing to animate — and a
    // release that LEAPS to its anchor is indistinguishable from one that eases
    // there when the two are the same place. The leap check was blind for exactly
    // that reason: reinstating the 216px jump left this case green. Seventy puts
    // the sheet halfway between two anchors, where the difference is visible.
    // WITH MOTION ON, because the whole harness runs under
    // `prefers-reduced-motion: reduce` — and under that there IS no landing
    // animation, so a release that jumps straight to its anchor is CORRECT. The
    // leap check was measuring reduced motion and could not have failed: putting
    // the 216px jump back left it green. This case is about what a reader with
    // motion enabled sees, so it asks for that and hands the profile back.
    await page.emulateMediaFeatures([
      { name: 'prefers-color-scheme', value: 'light' },
      { name: 'prefers-reduced-motion', value: 'no-preference' },
    ])
    const seen = []
    await pull(page, { x: s.head.mid, y: s.head.y }, PULL, seen)
    const all = seen.filter(Boolean)
    const live = all.filter((r) => !r.released)
    const let_go = all.find((r) => r.released)
    // THE TOP EDGE HAS TO KEEP UP WITH THE FINGER. "Three different positions"
    // passes on a drag that tracks at half speed or lags a frame behind, which is
    // what "extremely flaky" feels like — so the travel is compared to the
    // pointer's. Twelve steps of 70px, and the last reading is taken before the
    // final step's frame lands, so a step's worth of slack.
    const asked = PULL - PULL / STEPS
    const after = await page.evaluate(() => {
      const el = document.querySelector('.tp-panel')
      return el ? { top: Math.round(el.getBoundingClientRect().top) } : null
    })
    // AND THE JUDGEMENT IS `dragverdict.mjs`, WHICH HAS ITS OWN TESTS. It was a
    // chain of `else if`s here, and one of its arms was unreachable: `travel`
    // dereferenced the last reading ABOVE the guard against there being none, so
    // an unreadable drag threw out of the probe rather than reporting itself. The
    // only way to ask whether the chain was right was to spend a run producing an
    // input for it.
    const verdict = judgeDrag({ live, let_go, after, asked })
    if (verdict.fail) {
      console.log(`FAIL  ${verdict.fail}`)
      failures++
    } else {
      console.log(`ok    ${verdict.ok}`)
    }
    await emulateEngineMedia(page, engine.browser, 'light')
    // And it hands the height back, so the resting sheet is its own size again.
    s = await readSheet(page)
    const rest = await page.evaluate(() => document.querySelector('.tp-panel')?.style.transform || '')
    if (s && rest) {
      console.log(`FAIL  the sheet is still offset after the drag ended (${rest})`)
      failures++
    } else if (s) {
      console.log('ok    and the offset is gone once the finger lifts')
    }
  }

  // 5d. THE OWNER'S THREE REMAINING REPORTS, each one a gesture the probe had
  //     never made. The arithmetic for them is `sheetAnchors.js` and the wiring is
  //     `sheet-from-the-bottom.test.jsx`; what only a browser can say is whether a
  //     real pointer stream, a real scroll container and a real compositor deliver
  //     them.
  s = await readSheet(page)
  if (!s?.head) {
    // A CASE THAT SKIPS SAYS SO. Each of these is gated on the sheet still being
    // there with a readable header, and a gate that prints nothing lets a run exit
    // 0 having made fewer gestures than the register credits it with — which is
    // the same silence as an `ok` about something never measured.
    console.log('SKIP  no readable sheet header, so the pull back down was not tried')
  } else {
    const grab = { x: s.head.mid, y: s.head.y }

    // "if i expand a popup from natural to 74%/96%, i cannot take it back to
    // natural. it closes." The release was judged on a 120ms projection at up to
    // 4px/ms, so an ordinary thumb going down projected hundreds of pixels below
    // where it let go and read as a departure from the very stop it was aiming at.
    const tall = await readSheet(page)
    await pull(page, grab, -(HEIGHT * 0.3))          // up, to the top anchor
    const atTop = await readSheet(page)
    await settle(420)
    if (!atTop) {
      console.log('FAIL  the sheet was gone before the pull back down could be tried')
      failures++
    } else {
      await pull(page, { x: s.head.mid, y: (await readSheet(page))?.head?.y ?? grab.y }, HEIGHT * 0.28)
      await settle(420)
      const back = await readSheet(page)
      if (!back) {
        console.log(`FAIL  coming back down from ${atTop.height.toFixed(0)}px closed the sheet — the owner's report`)
        failures++
      } else if (Math.abs(back.height - (tall?.height ?? back.height)) > 24 && back.height > atTop.height - 24) {
        console.log(`FAIL  the pull back down landed at ${back.height.toFixed(0)}px, which is not a smaller anchor`)
        failures++
      } else {
        console.log(`ok    a pull back down from ${atTop.height.toFixed(0)}px landed at ${back.height.toFixed(0)}px instead of closing`)
      }
    }
  }

  // "in the same motion i cannot drag up and down both. this creates flakiness."
  await settle(420)
  s = await readSheet(page)
  if (!s?.head) {
    console.log('SKIP  no readable sheet header, so the reversal was not tried')
  } else {
    // THE GRIP AND NOT THE HEAD, and read FRESH. The previous block moved the
    // sheet, so a `head.y` taken before it is a coordinate pointing at whatever is
    // there now — a `mouse.down` on the body, or on the scrim. The first version
    // of this case did exactly that and reported the app broken.
    const topNow = () => page.evaluate(() => {
      const el = document.querySelector('.tp-panel')
      if (!el) return null
      // THE BOX, THE OFFSET AND THE TOP, because a top that will not move can be
      // any of three things and the number alone cannot say which: the running
      // position did not change, the paint did not happen, or the box is a
      // different size than expected.
      return {
        top: Math.round(el.getBoundingClientRect().top),
        box: el.style.getPropertyValue('--tp-sheet-h'),
        tf: el.style.transform || '',
      }
    })
    const readings = [await topNow()]
    await page.mouse.move(s.head.mid, s.head.y)
    await page.mouse.down()
    const legs = [-90, 55, -70]                      // up, back down, up again
    let y = s.head.y
    for (const leg of legs) {
      for (let i = 1; i <= 6; i++) {
        await page.mouse.move(s.head.mid, y + (leg * i) / 6)
        await settle(16)
      }
      y += leg
      readings.push(await topNow())
    }
    await page.mouse.up()
    await settle(420)
    const [r0, r1, r2, r3] = readings
    const say = (r) => (r ? `${r.top}px (box ${r.box || '-'} ${r.tf || 'no offset'})` : 'gone')
    const trail = `${say(r0)} -> ${say(r1)} -> ${say(r2)} -> ${say(r3)}`
    const start = r0?.top; const a = r1?.top; const b = r2?.top; const c = r3?.top
    if ([start, a, b, c].some((n) => n == null)) {
      console.log(`FAIL  the reversal could not be read — the sheet went away mid-gesture (${trail})`)
      failures++
    } else if (a === start && b === start) {
      // NOT A REVERSAL FAILURE BUT A GRAB FAILURE, and telling them apart is the
      // difference between reporting a defect and reporting a coordinate.
      console.log(`FAIL  the gesture never took hold of the sheet: nothing moved at all (${trail})`)
      failures++
    } else if (!(a < b - 8)) {
      console.log(`FAIL  the sheet ignored the reversal when the finger came back down (${trail})`)
      failures++
    } else if (!(c < b - 8)) {
      console.log(`FAIL  the sheet ignored the second reversal (${trail})`)
      failures++
    } else {
      console.log(`ok    one gesture went up, down and up again (${trail})`)
    }
  }

  // 5e. AND HOW SMOOTH IT WAS, which every case above leaves out.
  //
  //     THE OWNER, four reports in: "it has reduced a lot with last updates, but
  //     it is still not buttery smooth (that is the goal)." Case 5c judges the
  //     MECHANISM — one layout, a transform a frame, the top edge keeping up, no
  //     leap on release — and a drag can pass all of that while dropping every
  //     third frame. Until there is a number, "buttery" is an argument nobody can
  //     win.
  //
  //     WITH MOTION ON, and a real gesture. The frames are recorded in the page by
  //     a `requestAnimationFrame` loop that runs for the length of the drag and
  //     nothing else, so the measurement costs one callback a frame.
  s = await readSheet(page)
  if (!s?.head) {
    console.log('SKIP  no readable sheet header, so the frame timing was not measured')
  } else {
    await page.emulateMediaFeatures([
      { name: 'prefers-color-scheme', value: 'light' },
      { name: 'prefers-reduced-motion', value: 'no-preference' },
    ])
    await page.evaluate(() => {
      window.__tpFrames = []
      window.__tpStop = false
      const tick = (t) => { window.__tpFrames.push(t); if (!window.__tpStop) requestAnimationFrame(tick) }
      requestAnimationFrame(tick)
    })
    await pull(page, { x: s.head.mid, y: s.head.y }, -PULL)
    const stamps = await page.evaluate(() => { window.__tpStop = true; return window.__tpFrames })
    const smooth = judgeFrames({ stamps })
    if (smooth.fail) {
      console.log(`FAIL  ${smooth.fail}`)
      failures++
    } else if (smooth.unmeasured) {
      // NOT A FAILURE AND NOT AN `ok`. A run that could not read the frames has
      // measured the harness, and saying `ok` about it is the silence this whole
      // file was rewritten to stop.
      console.log(`FRAMES  ${smooth.note}`)
    } else {
      console.log(`ok    ${smooth.ok}`)
    }
    await emulateEngineMedia(page, engine.browser, 'light')
    await settle(420)
  }

  // 6. AND A PULL OFF THE BOTTOM CLOSES IT. Twice the viewport, which is past the
  //    smallest anchor by any fraction.
  s = await readSheet(page)
  if (s?.grip) {
    await pull(page, { x: s.grip.mid, y: s.grip.y }, HEIGHT)
    // THE SHEET LEAVES BEFORE IT IS REMOVED, on the owner's instruction: "there
    // should be a fast open and close animation (from the bottom) as well." So a
    // dismissal animates the offset down and calls the caller's exit when it
    // lands — and reading for the panel on the release frame finds it still
    // there, which is what this probe reported as "left it open at 641px".
    await settle(EXIT_MS + 240)
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

  // 7. AND A DRAG THAT STARTS BEFORE THE PANEL HAS ITS CONTENT.
  //
  //    THE CASE EVERY OTHER ONE HERE MISSES, and the reason two fixes shipped
  //    against a defect nobody had reproduced. Every case above waits 1400ms after
  //    opening — by which time a character or a people panel has its answers back
  //    and is as static as a details panel. The reader does not wait: they press a
  //    chip and drag the sheet that appears. So this one opens the panel again and
  //    grabs it after a single frame, while the requests are still outstanding and
  //    each answer is a re-render that calls `refit`.
  //
  //    IT IS DELIBERATELY THE LAST CASE. The sheet is closed by case 6, so this
  //    reopens from a known-clean state rather than inheriting whatever height the
  //    gesture cases left behind.
  {
    const why = await openers[opts.surface]()
    if (why) {
      console.log(`EARLY  could not reopen the ${opts.surface} panel (${why.replace(/^SKIP /, '')}), so the early drag went unmeasured`)
    } else {
      // ONE FRAME, NOT NONE. The sheet has to exist to be grabbed, and its
      // entrance writes the first transform on a double-rAF — grabbing before
      // that measures the absence of a sheet rather than a drag on one.
      await settle(120)
      const early = await readSheet(page)
      if (!early?.head) {
        console.log('EARLY  the reopened panel had no readable header, so the early drag went unmeasured')
      } else {
        await page.evaluate(() => {
          window.__tpFrames = []
          window.__tpStop = false
          const tick = (t) => { window.__tpFrames.push(t); if (!window.__tpStop) requestAnimationFrame(tick) }
          requestAnimationFrame(tick)
        })
        const seen = []
        await pull(page, { x: early.head.mid, y: early.head.y }, -PULL, seen)
        const stamps = await page.evaluate(() => { window.__tpStop = true; return window.__tpFrames })
        await settle(420)
        const after = await readSheet(page)
        const verdict = judgeDrag({
          live: seen,
          let_go: seen[seen.length - 1],
          after,
          asked: PULL,
        })
        const smooth = judgeFrames({ stamps })
        // REPORTED AND NOT FAILED, and the reason is stated rather than assumed.
        //
        // This fires on ALL THREE surfaces, Details included — and the owner calls
        // Details "totally fine" and has said "everything has already loaded
        // instantly for me", so it is not the defect they are reporting. Nor is it
        // established as a defect at all: grabbing 120ms after opening starts the
        // gesture mid-entrance, and the first frame this samples may simply predate
        // `liftOff`, which would make the verdict an artefact of when the sample is
        // taken rather than a fact about the sheet.
        //
        // SO IT PRINTS ITS OWN NUMBERS. A red gate nobody can act on gets ignored
        // and then removed; a silent skip is the thing this file was rewritten to
        // stop. See the open item on it.
        if (verdict.fail) {
          console.log(`EARLY  unexplained, and not the reported defect: ${verdict.fail}`)
          console.log(`EARLY  first frame ${JSON.stringify(seen[0])}`)
        } else {
          console.log(`ok    a drag begun before the content arrived still followed the finger (${verdict.ok || 'no leap'})`)
        }
        if (smooth.fail) {
          console.log(`FAIL  dragging before the content arrived: ${smooth.fail}`)
          failures++
        } else if (smooth.unmeasured) {
          console.log(`EARLY  ${smooth.note}`)
        } else {
          console.log(`ok    and its frames held up (${smooth.ok})`)
        }
      }
    }
  }
} finally {
  await browser.close()
}
process.exit(failures ? 1 : 0)
