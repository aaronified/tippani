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
// AND THE TOUCH FLOOR WITH IT, because it is the same kind of claim: 44px is the
// repo's own number, stated in `CLAUDE.md` and repeated through `index.css`, and
// a control below it on a phone is one a thumb cannot reliably hit.
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
  { route: '/people', name: 'People' },
  { route: '/tags', name: 'Tags' },
  { route: '/stats', name: 'Stats' },
  { route: '/checks', name: 'Checks' },
  { route: '/settings', name: 'Settings' },
  { route: '/books/1', name: 'Book detail' },
  { route: '/movies/2', name: 'Film detail' },
]

const engine = findBrowser(null, 'chrome')
const browser = await puppeteer.launch(launchOptions(engine, { viewport: { width: opts.width, height: opts.height } }))
const findings = { dead: [], small: [], empty: [], blank: [], unreachable: [] }
let pressed = 0

try {
  const page = await browser.newPage()
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
      // A DISCLOSURE'S EFFECT IS ON ITSELF. A ⋯ that opens a menu changes
      // `aria-expanded` and may render the menu outside the scope being watched,
      // so without this the honest control reads as dead.
      expanded: [...document.querySelectorAll('[aria-expanded],[aria-pressed],details')]
        .map((e) => `${e.getAttribute('aria-expanded') ?? ''}${e.getAttribute('aria-pressed') ?? ''}${e.open ?? ''}`).join('|'),
      // AND A MENU THAT OPENS EMPTY IS ITS OWN DEFECT, not a pass: the reader
      // pressed a door and got a blank. Counted so it can be reported.
      menuItems: [...document.querySelectorAll('[role=menu]')]
        .reduce((n, m) => n + m.querySelectorAll('[role=menuitem],button,a').length, 0),
      menus: document.querySelectorAll('[role=menu]').length,
    }
  })

  const differs = (a, b) => a.url !== b.url || a.panels !== b.panels || a.dialogs !== b.dialogs
    || a.inputs !== b.inputs || a.focus !== b.focus || a.scroll !== b.scroll
    || a.text !== b.text || a.toasts !== b.toasts || a.expanded !== b.expanded

  // Enumerate the controls on whatever is currently on screen. A panel, when one
  // is open, otherwise the page — so a modal's own controls are judged against
  // the modal and not against the screen behind it.
  const list = () => page.evaluate(() => {
    const scope = document.querySelector('.tp-panel') || document.querySelector('[role=dialog]') || document.body
    return [...scope.querySelectorAll('button, [role=button], a[href], summary')]
      .filter((b) => b.offsetParent !== null || b.tagName === 'SUMMARY')
      .map((b, i) => {
        const r = b.getBoundingClientRect()
        return {
          i,
          name: (b.getAttribute('aria-label') || b.textContent.replace(/\s+/g, ' ').trim() || b.title || '(unnamed)').slice(0, 40),
          says: b.disabled === true || b.getAttribute('aria-disabled') === 'true',
          current: b.getAttribute('aria-current') === 'page' || b.classList.contains('is-current'),
          href: b.getAttribute('href') || '',
          w: Math.round(r.width),
          h: Math.round(r.height),
        }
      })
  })

  for (const surface of SURFACES) {
    if (opts.only && !surface.name.toLowerCase().includes(opts.only.toLowerCase())) continue
    const reopen = async () => {
      await page.goto(opts.baseUrl + surface.route, { waitUntil: 'networkidle2' }).catch(() => {})
      await new Promise((r) => setTimeout(r, 1800))
    }
    await reopen()
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
      const ok = await page.evaluate((idx) => {
        const scope = document.querySelector('.tp-panel') || document.querySelector('[role=dialog]') || document.body
        const b = [...scope.querySelectorAll('button, [role=button], a[href], summary')]
          .filter((x) => x.offsetParent !== null || x.tagName === 'SUMMARY')[idx]
        if (!b) return false
        b.scrollIntoView({ block: 'center' })
        b.click()
        return true
      }, c.i)
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
if (findings.blank.length) {
  console.log(`\n${findings.blank.length} SURFACE(S) THAT DID NOT RENDER:`)
  for (const d of findings.blank) console.log('  ' + d)
}
if (findings.unreachable.length) {
  console.log(`\n${findings.unreachable.length} CONTROL(S) THAT COULD NOT BE PRESSED:`)
  for (const d of findings.unreachable) console.log('  ' + d)
}
process.exit(Object.values(findings).some((l) => l.length) ? 1 : 0)
