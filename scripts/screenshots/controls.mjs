#!/usr/bin/env node
// EVERY CONTROL IN THE APP EITHER ACTS OR SAYS IT CANNOT.
//
// A SPECIFICATION, NOT A REGRESSION TEST. Nothing here knows about any
// particular defect: it walks the app, finds everything a reader can press, and
// asks two questions of each one —
//
//   Does pressing it change anything at all?
//   If not, does it SAY so, with aria-disabled or a disabled attribute?
//
// A control that answers no to both is a lie to the reader, whatever the reason,
// and the reason is never visible from the outside. That is the whole rule.
//
// WHY THIS SHAPE. The repo's own standing rule is that every chip is a button
// because "a chip names a character and a character has a screen; the row is a
// row of doors" — and a door that does not open is worse than no door, because
// the reader has already decided to go through it. Written per-defect, a test
// asserts the one handler that was fixed; written as a property, it asks the
// question of every control that exists, including the ones nobody has looked at.
//
// AND THE TOUCH FLOOR WITH IT, because it is the same kind of claim. 44px is the
// design pack's number — `docs/design/handoff/design-system.md` line 180, "44px
// touch targets", with `.tp-btn`'s `min-height:44px` beside it at line 134 — and
// `index.css` says why it is one of the handful of sizes that stays in px: "20px
// is a gutter and 44px is a fingertip; neither changes when the reader changes
// their type size". A control below it on a phone is one a thumb cannot reliably
// hit.
//
// WHAT COUNTS AS "SOMETHING HAPPENED": a new dialog or panel, one closing, the
// route changing, focus moving, the surface scrolling, or the surface's own text
// changing. Deliberately broad — the point is to find controls that do NOTHING,
// not to judge what they did.
import puppeteer from 'puppeteer-core'

import { HARNESS_ACCOUNT, emulateEngineMedia, ensureSession, findBrowser, launchOptions } from './capture.mjs'

const opts = { baseUrl: 'http://127.0.0.1:8080', timeoutMs: 30000, width: 1280, height: 1000, only: '' }
for (let i = 2; i < process.argv.length; i++) {
  const next = () => process.argv[++i]
  if (process.argv[i] === '--base-url') opts.baseUrl = next()
  else if (process.argv[i] === '--only') opts.only = next()
  else if (process.argv[i] === '--width') opts.width = Number(next())
  else if (process.argv[i] === '--help' || process.argv[i] === '-h') {
    console.log('usage: node controls.mjs [--base-url URL] [--only substring] [--width N]\n\n' +
      'Presses every control on every screen and panel it can reach, and fails on\n' +
      'any that does nothing without saying it is disabled, or that is under 44px.')
    process.exit(0)
  }
}

// THE TOUCH FLOOR IS CHECKED AT PHONE WIDTH ONLY, because that is what it is for
// — and a desk pointer does not need it. 1px of slack for fractional layout.
const TOUCH_FLOOR = 44
const SLACK = 1
// The floor for "this screen rendered at all" — see the check at the loop head.
const MIN_CONTROLS = 4

// Controls a press must not fire, because doing so ends the run rather than
// testing it. Named by their accessible name, not by class, so the list reads as
// what a person would avoid rather than as implementation.
const DESTRUCTIVE = /\b(delete|remove|discard|log ?out|sign ?out|reset|clear|empty the bin|take this credit off)\b/i
// And ones that leave the app, which a probe cannot come back from.
const LEAVES = /^(https?:)?\/\//

const SURFACES = [
  { route: '/', name: 'Home' },
  { route: '/library', name: 'Library' },
  { route: '/catalogue', name: 'Catalogue' },
  { route: '/quotes', name: 'Quotes' },
  { route: '/search', name: 'Search' },
  // NOT `/people`: it is not a route — `routes.js`'s ROUTE_TABS does not list it
  // and the parser falls through to `{ tab: 'home' }`, so this line probed Home a
  // second time under another name for as long as it stood here. The screen that
  // actually lists the library's people is the metadata console.
  { route: '/metadata', name: 'Metadata' },
  { route: '/anthologies', name: 'Anthologies' },
  { route: '/bin', name: 'Bin' },
  { route: '/tags', name: 'Tags' },
  { route: '/stats', name: 'Stats' },
  { route: '/checks', name: 'Checks' },
  { route: '/settings', name: 'Settings' },
  { route: '/books/1', name: 'Book detail' },
  // `/catalogue/2` AND NOT `/movies/2`. Both resolve — routes.js takes either —
  // but the app CANONICALISES to /catalogue, so a probe naming the other lands
  // somewhere with a different path and the route check calls it not-a-route.
  // The check is right; the list was naming the alias.
  { route: '/catalogue/2', name: 'Film detail' },
  // THE PANELS, REACHED THE WAY A READER REACHES THEM. A panel has no route of
  // its own — it is a door on a screen — so a surface may name the door, and this
  // probe presses it before enumerating. `list()` already scopes to `.tp-panel`
  // when one is open, so everything downstream works unchanged.
  //
  // THEY WERE COVERED BY A SECOND SCRIPT, `audit-panel.mjs`, which pressed the
  // character panel's controls and which this replaces. It carried both faults
  // this file was hardened against — it re-resolved controls BY INDEX after
  // re-opening, and it exited 0 whatever it found, so `make` could not fail on
  // it. A weaker copy of a probe is worse than none: it is the one somebody
  // reads.
  { route: '/catalogue/2', name: 'Character panel', door: { selector: '.person-chip', text: 'Rick Blaine' } },
]

const engine = findBrowser(null, 'chrome')
const browser = await puppeteer.launch(launchOptions(engine, { viewport: { width: opts.width, height: opts.height } }))
const findings = { dead: [], small: [], empty: [], blank: [], unreachable: [], sideways: [], notaroute: [] }
let pressed = 0

try {
  const page = await browser.newPage()
  // WHAT A PRESS CAN DO THAT THE DOCUMENT NEVER SHOWS. Four effects leave no
  // trace in the DOM at all, and counting a control that has one as dead is how
  // this probe would have reported "Upload sticker" — a button whose whole job is
  // `fileRef.current.click()` on a hidden <input type=file>, opening the
  // operating system's own picker. Same for Copy (the clipboard), Share
  // (navigator.share, or the clipboard again), and any verb whose result is a
  // request whose reply has not landed inside the settle window.
  //
  // Installed before any script runs, and only ever INCREMENTED — the probe reads
  // the counters, it does not need the values, and a counter cannot be mistaken
  // for a rendering change.
  await page.evaluateOnNewDocument(() => {
    window.__tpFx = { file: 0, clip: 0, share: 0, net: 0 }
    const click = HTMLElement.prototype.click
    HTMLElement.prototype.click = function () {
      if (this instanceof HTMLInputElement && this.type === 'file') window.__tpFx.file++
      return click.apply(this, arguments)
    }
    if (navigator.clipboard?.writeText) {
      const w = navigator.clipboard.writeText.bind(navigator.clipboard)
      navigator.clipboard.writeText = (...a) => { window.__tpFx.clip++; return w(...a) }
    }
    const exec = document.execCommand?.bind(document)
    if (exec) document.execCommand = (cmd, ...a) => { if (cmd === 'copy' || cmd === 'cut') window.__tpFx.clip++; return exec(cmd, ...a) }
    if (navigator.share) {
      const sh = navigator.share.bind(navigator)
      navigator.share = (...a) => { window.__tpFx.share++; return sh(...a) }
    }
    const f = window.fetch
    window.fetch = (...a) => { window.__tpFx.net++; return f(...a) }
    const open = XMLHttpRequest.prototype.open
    XMLHttpRequest.prototype.open = function () { window.__tpFx.net++; return open.apply(this, arguments) }
  })
  await page.setViewport({ width: opts.width, height: opts.height, deviceScaleFactor: 1 })
  await emulateEngineMedia(page, engine.browser, 'light')
  await ensureSession(page, {
    baseUrl: opts.baseUrl,
    username: HARNESS_ACCOUNT.username,
    password: HARNESS_ACCOUNT.password,
    timeoutMs: opts.timeoutMs,
  })

  // The fingerprint a press is judged against.
  const shot = () => page.evaluate(() => {
    const top = document.querySelector('.tp-panel') || document.body
    const a = document.activeElement
    return {
      url: location.pathname + location.search,
      panels: document.querySelectorAll('.tp-panel').length,
      dialogs: document.querySelectorAll('[role=dialog]').length,
      inputs: document.querySelectorAll('input, textarea, select').length,
      focus: a && a !== document.body ? `${a.tagName}#${a.id}.${(a.className || '').toString().slice(0, 24)}` : '',
      scroll: Math.round((document.querySelector('.tp-panel-body') || document.scrollingElement).scrollTop),
      text: top.textContent.replace(/\s+/g, ' ').trim().slice(0, 600),
      toasts: document.querySelectorAll('[class*=toast]').length,
      // The four effects that never reach the document — see the hooks above.
      fx: JSON.stringify(window.__tpFx || {}),
      // A DISCLOSURE'S EFFECT IS ON ITSELF. A ⋯ that opens a menu changes
      // `aria-expanded` and may render the menu outside the scope being watched,
      // so without this the honest control reads as dead.
      // `aria-checked` IS IN HERE FOR THE SAME REASON THE OTHER TWO ARE, and
      // leaving it out reported eleven working controls on one screen. A tag
      // style, an annotation kind and a colour are all `role=radio` with
      // `aria-checked`: pressing one moves a 2px border and a chip preview, and
      // nothing else on the page changes at all — no dialog, no route, no text.
      // Without the attribute in the fingerprint the whole radiogroup reads as
      // dead, and with it a press is visible exactly when it moved the choice.
      expanded: [...document.querySelectorAll('[aria-expanded],[aria-pressed],[aria-checked],[aria-selected],details')]
        .map((e) => `${e.getAttribute('aria-expanded') ?? ''}${e.getAttribute('aria-pressed') ?? ''}${e.getAttribute('aria-checked') ?? ''}${e.getAttribute('aria-selected') ?? ''}${e.open ?? ''}`).join('|'),
      // AND A MENU THAT OPENS EMPTY IS ITS OWN DEFECT, not a pass: the reader
      // pressed a door and got a blank. Counted so it can be reported.
      menuItems: [...document.querySelectorAll('[role=menu]')]
        .reduce((n, m) => n + m.querySelectorAll('[role=menuitem],button,a').length, 0),
      menus: document.querySelectorAll('[role=menu]').length,
    }
  })

  // A SURFACE MUST NOT SCROLL SIDEWAYS; ITS SCROLLERS DO. Content wider than the
  // screen belongs inside something with `overflow-x`, and the app has one —
  // `Scroller`, which writes `data-scroll-x` so a fade says it moves. When the
  // container instead STRETCHES, three things go wrong at once and none of them
  // looks like the same bug: the row does not scroll (it is never narrower than
  // its contents), it wears no fade (`useEdgeScroll` measures no overflow, quite
  // correctly), and every sibling is dragged out with it so their labels run past
  // the edge and are cut mid-word.
  //
  // That is one missing `min-width: 0` on a flex item, whose default is `auto` —
  // "do not shrink below your content". Measured on the author sheet at 390px
  // before the fix: body scrollWidth 1266 against clientWidth 364, and a works
  // strip 1248px wide reporting `scrollWidth === clientWidth`.
  //
  // The check is here rather than in vitest because jsdom has no layout: every
  // width it reports is zero, so this class of defect is invisible to the entire
  // unit suite by construction.
  const sideways = () => page.evaluate(() => {
    const out = []
    const scope = document.querySelector('.tp-panel-body') || document.scrollingElement
    if (scope && scope.scrollWidth > scope.clientWidth + 1) {
      out.push(`${scope.className || 'the page'} scrolls sideways: ${scope.scrollWidth}px of content in ${scope.clientWidth}px`)
    }
    return out
  })

  const differs = (a, b) => a.url !== b.url || a.panels !== b.panels || a.dialogs !== b.dialogs
    || a.inputs !== b.inputs || a.focus !== b.focus || a.scroll !== b.scroll
    || a.text !== b.text || a.toasts !== b.toasts || a.expanded !== b.expanded
    || a.fx !== b.fx
    // COLLECTED AND NEVER COMPARED, which is its own small lesson: both of these
    // were read on every press so an EMPTY menu could be reported, and neither was
    // in this list — so a control whose only effect was opening a menu depended on
    // `expanded` catching it, and a trigger that carries no `aria-expanded` (the
    // phone drawer is one) read as dead. A field gathered for one purpose is not
    // automatically serving the other.
    || a.menus !== b.menus || a.menuItems !== b.menuItems

  // Enumerate the controls on whatever is currently on screen. A panel, when one
  // is open, otherwise the page — so a modal's own controls are judged against
  // the modal and not against the screen behind it.
  const list = () => page.evaluate(() => {
    const scope = document.querySelector('.tp-panel') || document.querySelector('[role=dialog]') || document.body
    const seen = new Map()
    // ON SCREEN, AND `offsetParent` CANNOT ANSWER THAT. It is null for anything
    // `position: fixed` — which is the to-top button, the phone dock, and every
    // floating bar in this app — so the filter that was meant to skip hidden
    // controls was silently skipping the ENTIRE class of controls that float. A
    // probe whose coverage gap is invisible is worse than no probe.
    //
    // What "on screen" actually means: it has a box, and nothing in its own style
    // has taken it out of the flow or faded it away. `.to-top` without `is-on` is
    // `opacity: 0; pointer-events: none` and must still be skipped — but by what
    // its style says, not by an accident of where its offset parent is.
    const onScreen = (b) => {
      if (b.tagName === 'SUMMARY') return true
      const r = b.getBoundingClientRect()
      if (!r.width || !r.height) return false
      const cs = getComputedStyle(b)
      return cs.display !== 'none' && cs.visibility !== 'hidden'
        && parseFloat(cs.opacity) > 0.01 && cs.pointerEvents !== 'none'
    }
    return [...scope.querySelectorAll('button, [role=button], a[href], summary')]
      .filter(onScreen)
      .map((b, i) => {
        const r = b.getBoundingClientRect()
        const name = (b.getAttribute('aria-label') || b.textContent.replace(/\s+/g, ' ').trim() || b.title || '(unnamed)').slice(0, 40)
        // THE KEY IS THE NAME WITH ITS NUMBERS MASKED. A library tile's accessible
        // name is its title, author, year AND quote count run together — "COVER
        // Middlemarch George Eliot · 1871 0 quotes" — and a press earlier in the
        // run that adds a quote changes the last of those. The row is the same
        // row; only the tally moved. Matching on the digits made thirteen tiles
        // unfindable on the second look and reported them as vanished.
        const key = name.replace(/\d+/g, '#')
        const nth = seen.get(key) || 0
        seen.set(key, nth + 1)
        return {
          i,
          nth,
          key,
          name,
          says: b.disabled === true || b.getAttribute('aria-disabled') === 'true',
          // WHERE YOU ALREADY ARE, and `active` is on this list because CLAUDE.md
          // puts it there: "A chip's on-state class is `active`. `.tp-filter-chip
          // .active` is what the stylesheet styles; `is-on` belongs to other
          // things". Pressing the filter you are already on, or the tab you are
          // already looking at, changes nothing and is not a broken control —
          // the destination is simply the current one. Without this the probe
          // reports every "All" chip in the app, which is how a checker earns a
          // reputation for crying wolf and then gets switched off.
          //
          // `is-on` IS NOT A GENERIC ON-STATE, and this list used to treat it as
          // one while quoting the line that says it is not. CLAUDE.md names the
          // three things that wear it — `.cat-swatch`, `.meta-rail-item`,
          // `.to-top` — and only the first two mean "chosen". On `.to-top` it
          // means VISIBLE (`opacity: 1; pointer-events: auto`), so exempting it
          // excused the app's one scroll-to-top button from ever being pressed:
          // the state that makes it pressable was being read as the state that
          // makes it pointless to press.
          current: b.getAttribute('aria-current') === 'page'
            || b.getAttribute('aria-pressed') === 'true'
            || b.getAttribute('aria-selected') === 'true'
            || b.getAttribute('aria-checked') === 'true'
            || b.classList.contains('is-current')
            || b.classList.contains('active')
            || (b.classList.contains('is-on')
              && (b.classList.contains('cat-swatch') || b.classList.contains('meta-rail-item'))),
          href: b.getAttribute('href') || '',
          w: Math.round(r.width),
          h: Math.round(r.height),
        }
      })
  })

  // ---- waiting for the app rather than for the clock ------------------------
  //
  // Every fixed sleep in this file was a guess at how long a screen takes to
  // render, made on an idle machine and then run on one saturated by this very
  // probe. Both of the run that prompted this were wrong in the same direction:
  // a control enumerated on a fast load was "vanished" on a slow one, and a panel
  // that opens in 400ms idle was declared not to have opened. So: poll for the
  // condition, with a ceiling — the ceiling is what keeps a genuinely dead
  // control from costing the whole budget.
  const waitFor = async (fn, ms = 6000, every = 100) => {
    const until = Date.now() + ms
    for (;;) {
      if (await fn()) return true
      if (Date.now() > until) return false
      await new Promise((r) => setTimeout(r, every))
    }
  }

  // SETTLED = the control count has stopped changing. A screen that fetches its
  // rows adds controls as they land, and enumerating mid-flight silently tests a
  // fraction of the surface — a coverage gap that leaves no trace, which is the
  // failure D4 is on the register for. Two identical samples 300ms apart, and a
  // ceiling for a screen that genuinely never stops (a ticking clock; there is
  // none here, but the probe must not hang if one appears).
  const countControls = () => page.evaluate(() => {
    const scope = document.querySelector('.tp-panel') || document.querySelector('[role=dialog]') || document.body
    return scope.querySelectorAll('button, [role=button], a[href], summary').length
  })
  const settled = async (ms = 8000) => {
    const until = Date.now() + ms
    let last = -1
    for (;;) {
      await new Promise((r) => setTimeout(r, 300))
      const now = await countControls().catch(() => -1)
      if (now >= 0 && now === last) return true
      last = now
      if (Date.now() > until) return false
    }
  }

  for (const surface of SURFACES) {
    if (opts.only && !surface.name.toLowerCase().includes(opts.only.toLowerCase())) continue
    const reopen = async () => {
      await page.goto(opts.baseUrl + surface.route, { waitUntil: 'networkidle2' }).catch(() => {})
      await settled()
      if (!surface.door) return true
      const opened = await page.evaluate((d) => {
        const b = [...document.querySelectorAll(d.selector)].find((x) => x.textContent.includes(d.text))
        if (!b) return false
        b.click()
        return true
      }, surface.door)
      // THE DOOR HAS TO HAVE OPENED. Without this the surface degrades silently
      // to the screen the door is on, and the probe reports the film page's
      // controls under the character panel's name — the same "tested something
      // other than what it said" failure the route check below exists for.
      //
      // WAITED FOR, NOT SLEPT THROUGH. This was a flat 1600ms, and the panel it
      // waits for arrives behind a dynamic import (`identity.jsx`, which pulls in
      // Movies.jsx and cast.jsx) plus the record's own fetch — so under the load
      // this run itself creates, the chip opened the panel a beat after the probe
      // had already decided it had not. It reported the app's one character door
      // as broken on a run where pressing it by hand opens it every time. A gate
      // that reports a defect that is not there gets switched off exactly as fast
      // as one that misses a defect that is.
      if (!opened) return false
      return await waitFor(() => page.evaluate(() => !!document.querySelector('.tp-panel')))
    }
    if (!await reopen()) {
      findings.unreachable.push(`${surface.name}: the door it is reached through (${surface.door.selector} "${surface.door.text}") did not open a panel`)
      console.log(`FAIL  ${surface.name.padEnd(14)} door did not open`)
      continue
    }
    // AND THE ROUTE HAS TO BE THE ROUTE. `/people` is not one — `routes.js` falls
    // through to `{ tab: 'home' }` — so this list quietly probed Home twice under
    // two names and reported "People" as a screen with its own findings. A probe
    // that tests something other than what it says it tested is worse than one
    // that skips: its output is wrong rather than short.
    // A DOOR SURFACE HAS ALREADY PROVED ITSELF: `reopen()` refused to continue
    // unless a panel opened. Its route is checked by whichever surface names that
    // route on its own, and opening a panel writes to history, so asking about
    // the path here would ask the wrong question.
    const landed = surface.door ? surface.route : await page.evaluate(() => location.pathname)
    if (landed !== surface.route && !landed.startsWith(surface.route)) {
      findings.notaroute.push(`${surface.name}: /${surface.route.replace(/^\//, '')} resolves to ${landed} — it is not a screen of its own`)
      console.log(`FAIL  ${surface.name.padEnd(14)} ${surface.route} is not a route (landed on ${landed})`)
      continue
    }
    const controls = await list()
    // A SURFACE THAT DREW NOTHING IS A FAILED RUN, NOT A CLEAN ONE. A route that
    // 404s, a fixture without the row the route names, a login that did not take:
    // each leaves an empty page, and "0 controls, 0 that do nothing" reads as a
    // pass on the one line of output anybody looks at. Every screen in this app
    // has a rail, a topbar and a ⋯ before it has any content at all, so a handful
    // of controls is the floor for "this screen rendered".
    if (controls.length < MIN_CONTROLS) {
      findings.blank.push(`${surface.name} (${surface.route}) drew ${controls.length} controls — it did not render, so nothing on it was tested`)
      console.log(`FAIL  ${surface.name.padEnd(14)} did not render (${controls.length} controls)`)
      continue
    }
    for (const w of await sideways()) findings.sideways.push(`${surface.name}: ${w}`)
    let dead = 0
    for (const c of controls) {
      // The touch floor is a property of the control, not of pressing it.
      if (opts.width <= 480 && (c.w < TOUCH_FLOOR - SLACK || c.h < TOUCH_FLOOR - SLACK) && !c.says) {
        findings.small.push(`${surface.name}: ${JSON.stringify(c.name)} is ${c.w}x${c.h}`)
      }
      if (c.says) continue                          // it said so; that is honest
      if (DESTRUCTIVE.test(c.name) || LEAVES.test(c.href)) continue
      // WHERE YOU ALREADY ARE. Pressing "Home" on Home, or the brand that goes
      // Home from Home, changes nothing and is not a broken control — the
      // destination is simply the current one. Judged by the href, and by the
      // rail row whose own aria-current says it is the one you are on.
      if (c.href && c.href === surface.route) continue
      if (c.current) continue
      await reopen()
      const before = await shot()
      // BY NAME AND OCCURRENCE, NOT BY INDEX. `reopen()` rebuilds the DOM before
      // every press, and an index into the previous build is only valid while
      // exactly the same controls come back in exactly the same order — which a
      // lazily-loaded cover grid and a list whose length depends on a fetch do
      // not promise. Twenty-three controls were reported unreachable on one run
      // for that reason alone, none of them actually gone. The accessible name
      // plus which one of that name it is survives a re-render, which is also how
      // a person would say which control they meant.
      const ok = await page.evaluate(async ({ key, nth }) => {
        const scope = document.querySelector('.tp-panel') || document.querySelector('[role=dialog]') || document.body
        // AND THE PAGE IS WALKED TO THE BOTTOM FIRST. A list that renders as you
        // reach it has not rendered anything below the fold on a fresh load, so a
        // control enumerated after an earlier press had scrolled the surface is
        // simply not in the document yet — which reads as "vanished" and is
        // "not built yet".
        const box = document.querySelector('.tp-panel-body') || document.scrollingElement
        if (box) box.scrollTop = box.scrollHeight
        const find = () => [...scope.querySelectorAll('button, [role=button], a[href], summary')]
          .filter((x) => x.offsetParent !== null || x.tagName === 'SUMMARY')
          .filter((x) => ((x.getAttribute('aria-label') || x.textContent.replace(/\s+/g, ' ').trim() || x.title || '(unnamed)').slice(0, 40)).replace(/\d+/g, '#') === key)
        // A FRAME FOR WHAT THE SCROLL ASKED FOR. Setting scrollTop is synchronous
        // and rendering the rows it brought into view is not, so looking in the
        // same tick finds the same twelve missing tiles it did before the scroll.
        //
        // AND THEN AS LONG AS IT TAKES, up to a ceiling. The single 250ms retry
        // was another guess at a render: on a film page under this probe's own
        // load, a cast chip that is on screen when you look by hand was reported
        // "moved or vanished" because the second look was still too early. Every
        // such report is a false finding in a run whose whole value is that its
        // findings are real.
        let b = find()[nth]
        const until = Date.now() + 4000
        while (!b && Date.now() < until) {
          await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 120)))
          b = find()[nth]
        }
        if (!b) return false
        b.scrollIntoView({ block: 'center' })
        b.click()
        return true
      }, { key: c.key, nth: c.nth })
      // NOT PRESSED IS NOT PASSED. The index is re-resolved after `reopen`, so a
      // control that has moved or gone leaves the press unmade — and a `continue`
      // there quietly drops it from a run whose whole claim is "every control".
      // Reported rather than skipped, for the reason panel-depth.mjs and
      // hero-control.mjs both had to learn: a probe that can silently test
      // nothing is a probe that gets cited as a guard it never was.
      if (!ok) {
        findings.unreachable.push(`${surface.name}: ${JSON.stringify(c.name)} could not be pressed — the control moved or vanished between enumerating and pressing`)
        continue
      }
      pressed++
      await new Promise((r) => setTimeout(r, 900))
      const after = await shot()
      // AND WHATEVER THE PRESS OPENED, which is where this class of defect
      // actually lives: a panel is the surface whose body has to hold a strip of
      // covers, and the sheet that stretched was one a press opens.
      if (after.panels > before.panels || after.dialogs > before.dialogs) {
        for (const w of await sideways()) {
          const line = `${surface.name} → ${JSON.stringify(c.name)}: ${w}`
          if (!findings.sideways.includes(line)) findings.sideways.push(line)
        }
      }
      if (!differs(before, after)) {
        dead++
        findings.dead.push(`${surface.name}: ${JSON.stringify(c.name)}`)
      } else if (after.menus > before.menus && after.menuItems === before.menuItems) {
        findings.empty.push(`${surface.name}: ${JSON.stringify(c.name)} opened a menu with nothing in it`)
      }
    }
    console.log(`${dead ? 'FAIL' : 'ok  '}  ${surface.name.padEnd(14)} ${String(controls.length).padStart(3)} controls, ${dead} that do nothing and do not say so`)
  }
} finally {
  await browser.close()
}

console.log(`\n${pressed} presses`)
if (findings.dead.length) {
  console.log(`\n${findings.dead.length} CONTROL(S) DO NOTHING AND DO NOT SAY SO:`)
  for (const d of findings.dead) console.log('  ' + d)
}
if (findings.small.length) {
  console.log(`\n${findings.small.length} UNDER THE ${TOUCH_FLOOR}px TOUCH FLOOR:`)
  for (const d of findings.small) console.log('  ' + d)
}
if (findings.empty.length) {
  console.log(`\n${findings.empty.length} MENU(S) THAT OPEN EMPTY:`)
  for (const d of findings.empty) console.log('  ' + d)
}
if (findings.sideways.length) {
  console.log(`\n${findings.sideways.length} SURFACE(S) THAT SCROLL SIDEWAYS:`)
  for (const d of findings.sideways) console.log('  ' + d)
}
if (findings.notaroute.length) {
  console.log(`\n${findings.notaroute.length} ROUTE(S) THAT ARE NOT SCREENS:`)
  for (const d of findings.notaroute) console.log('  ' + d)
}
if (findings.blank.length) {
  console.log(`\n${findings.blank.length} SURFACE(S) THAT DID NOT RENDER:`)
  for (const d of findings.blank) console.log('  ' + d)
}
if (findings.unreachable.length) {
  console.log(`\n${findings.unreachable.length} CONTROL(S) THAT COULD NOT BE PRESSED:`)
  for (const d of findings.unreachable) console.log('  ' + d)
}
process.exit(Object.values(findings).some((l) => l.length) ? 1 : 0)
