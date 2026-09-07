#!/usr/bin/env node
// AN OVERLAY CLOSES AND THE PAGE IS WHERE YOU LEFT IT.
//
// THE OWNER'S REPORT, from their own phone: "when the popup is dismissed, it
// resets the scroll level of the master page. that is unacceptable."
//
// TWO OVERLAYS, TWO MECHANISMS, ONE PROMISE. A panel and a popover are both a
// layer over one page, so closing either has to leave that page alone — and they
// broke it by different routes, which is why both are pressed here:
//
//   THE PANEL went through the history stack. `usePanelStack` pushes with no url,
//   so the pop that closes it arrives at the same address, and App's route handler
//   took it for a navigation, re-derived the screen, and re-ran the scroll memory
//   — which for a detail page means the top.
//
//   THE POPOVER went through focus. Dismissing one hands focus back to its anchor,
//   and `HTMLElement.focus()` scrolls its target into view, so the page leaps to
//   wherever that anchor now is.
//
// NEITHER IS VISIBLE ANYWHERE ELSE IN THE SUITE. jsdom has no layout and does not
// scroll — `focus()` there moves nothing whatever you pass it — so no rendered
// test can tell a restore that scrolls from one that does not, and `controls.mjs`
// presses with `element.click()` and never reads a scroll offset. This is the only
// place either claim is checkable.
//
// A WORK PAGE AT PHONE WIDTH, because that is the configuration where the WINDOW
// is the scroller: above 1180px the work detail takes the scroll into its own
// columns (`html[data-scroll='screen']`) and there is no window offset to lose, so
// a desktop-width run would pass over the defect entirely.
//
// AND `--delay` HOLDS BACK `GET /characters/:id` to stand in for a mobile network,
// so a door that cannot draw until that request lands shows up as a slow open
// rather than as a fast one on a fast machine. The TIMING half of that — how long
// a tap may go unanswered before the app must say something — is not asserted
// here: it waits on the prefetch-and-loader decision, which is the owner's to make.
import puppeteer from 'puppeteer-core'

import { HARNESS_ACCOUNT, emulateEngineMedia, ensureSession, findBrowser, launchOptions } from './capture.mjs'

function parseArgs(argv) {
  const out = { baseUrl: 'http://127.0.0.1:8080', timeoutMs: 30000, delayMs: 700 }
  for (let i = 0; i < argv.length; i++) {
    const next = () => argv[++i]
    if (argv[i] === '--base-url') out.baseUrl = next()
    else if (argv[i] === '--timeout') out.timeoutMs = Number(next())
    else if (argv[i] === '--delay') out.delayMs = Number(next())
    else if (argv[i] === '--help' || argv[i] === '-h') {
      console.log('usage: node overlay-scroll [--base-url URL] [--delay MS]\n\n' +
        'At 390px on a work page, with GET /characters/:id held back by --delay:\n' +
        'opens a panel and checks the page is where it was after the dismissal, then\n' +
        'does the same for each popover — pressed on screen, the page scrolled behind\n' +
        'the open overlay, then Escape.')
      process.exit(0)
    }
  }
  return out
}

const WIDTH = 390
const HEIGHT = 844
const opts = parseArgs(process.argv.slice(2))
const browser = await puppeteer.launch({
  ...launchOptions(findBrowser(process.env.TIPPANI_BROWSER_PATH, process.env.TIPPANI_BROWSER), { viewport: null }),
})
const fails = []
const notes = []

try {
  const page = await browser.newPage()
  await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 2, hasTouch: true, isMobile: true })
  await emulateEngineMedia(page, process.env.TIPPANI_BROWSER)
  await ensureSession(page, { ...opts, ...HARNESS_ACCOUNT })

  // THE DELAY IS ON ONE ROUTE ONLY. Slowing everything would tell us about the
  // harness; slowing the one request the door makes tells us whether the door
  // waits for it.
  await page.setRequestInterception(true)
  page.on('request', (req) => {
    if (/\/api\/characters\/\d+(\?|$)/.test(req.url())) {
      setTimeout(() => req.continue().catch(() => {}), opts.delayMs)
      return
    }
    req.continue().catch(() => {})
  })

  // A WORK PAGE, NOT THE QUOTES BOARD. The board draws board TILES; the character
  // chips live on the quote cards inside a board, so a run aimed at /quotes finds
  // no chip and reports a clean pass over nothing — which is what the first two
  // runs of this probe did.
  const bookId = await page.evaluate(async () => {
    const r = await fetch('/api/books')
    if (!r.ok) return 0
    const d = await r.json()
    return (d.books || [])[0]?.id || 0
  })
  const gotoWork = async () => {
    if (!bookId) return
    await page.goto(`${opts.baseUrl}/books/${bookId}`, { waitUntil: 'networkidle0' })
    await page.waitForFunction(() => document.querySelectorAll('button, [role=button]').length > 4,
      { timeout: opts.timeoutMs })
    await new Promise((r) => setTimeout(r, 1200))
  }
  if (!bookId) fails.push('no book in the library — the probe has no page to stand on')
  await gotoWork()

  // ---- 2. DOES DISMISSING A PANEL LEAVE THE PAGE WHERE IT WAS --------------
  //
  // THE OWNER'S REPORT: "when the popup is dismissed, it resets the scroll level
  // of the master page. that is unacceptable."
  //
  // A WORK PAGE AT PHONE WIDTH, because that is the configuration where the
  // WINDOW is the scroller — above 1180px the work detail takes the scroll into
  // its own columns (`html[data-scroll='screen']`) and there is no window offset
  // to lose. A run at desktop width would pass over the defect entirely.
  //
  // AND THE PANEL IS OPENED BY PRESSING SOMETHING, not by calling into the app.
  // What is under test is the whole path a finger takes: press, panel, dismiss,
  // and where the page is afterwards.
  if (!bookId) {
    fails.push('no book in the library, so the dismissal case has no work page to stand on')
  } else {
    await gotoWork()

    const owns = await page.evaluate(() => document.documentElement.getAttribute('data-scroll'))
    notes.push(`at ${WIDTH}px the work page reports data-scroll=${JSON.stringify(owns)}`)

    const travel = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight)
    if (travel < 300) {
      fails.push(`the work page has only ${travel}px of travel at ${WIDTH}px, so there is no scroll position to lose — the case is measuring nothing`)
    } else {
      const WANT = Math.min(600, Math.floor(travel / 2))
      await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), WANT)
      await new Promise((r) => setTimeout(r, 300))
      const before = await page.evaluate(() => Math.round(window.scrollY))
      if (Math.abs(before - WANT) > 4) {
        fails.push(`the page would not hold a scroll offset (asked ${WANT}, got ${before})`)
      } else {
        // A NAMED PANEL-OPENER, not the first control that happens to work. Walking
        // every control presses the phone drawer's Menu button first, which puts a
        // surface over everything after it — so the walk reported "nothing opens a
        // panel" on a page where two things do. The work page's Details button and
        // its credit chip are both verified openers; either will do, and if neither
        // is there that is a finding rather than a pass.
        const opened = await page.evaluate(async () => {
          const settle = () => new Promise((r) => setTimeout(r, 700))
          const named = (label) => [...document.querySelectorAll('button, [role=button]')]
            .find((e) => ((e.textContent || e.getAttribute('aria-label') || '')).trim().startsWith(label))
          for (const label of ['Details', 'Everything this screen can']) {
            const el = named(label)
            if (!el) continue
            el.click()
            await settle()
            if (document.querySelector('.tp-panel')) return label
          }
          return ''
        })
        if (!opened) {
          fails.push('nothing on the work page opened a panel, so the dismissal case pressed nothing')
        } else {
          const held = await page.evaluate(() => Math.round(window.scrollY))
          notes.push(`opened a panel from ${JSON.stringify(opened)}; behind it the page is at ${held}px`)
          // THE LOCK'S OWN CONTRIBUTION, MEASURED SEPARATELY. If the page is
          // already at the top with the panel merely OPEN, that is the scroll lock
          // dropping the offset — a different defect from the dismissal, and one
          // that would otherwise be blamed on the dismissal.
          if (held < before - 8) {
            fails.push(`merely OPENING the panel moved the page from ${before}px to ${held}px — the scroll lock is dropping the offset, which is a second defect and not the dismissal`)
          }
          await page.keyboard.press('Escape')
          await page.waitForFunction(() => !document.querySelector('.tp-panel'), { timeout: opts.timeoutMs })
            .catch(() => {})
          await new Promise((r) => setTimeout(r, 600))
          const after = await page.evaluate(() => Math.round(window.scrollY))
          console.log(`\n  work page: ${before}px before, ${held}px behind the panel, ${after}px after the dismissal`)
          if (Math.abs(after - before) > 8) {
            fails.push(`dismissing the panel moved the work page from ${before}px to ${after}px — the reader loses their place`)
          }
        }
      }
    }
  }

  // ---- 3. AND A POPOVER IS THE SAME PROMISE ---------------------------------
  //
  // A panel and a popover are two overlays over one page, so they answer to one
  // rule: closing either leaves the page where the reader left it. They got there
  // by different routes — the panel through the history stack, the popover by
  // handing focus back to its anchor — and only one of the two was found by
  // pressing panels. This case is the reader's own sequence: press the chip while
  // it is on screen, scroll the page BEHIND the open popover (nothing locks it for
  // a menu), then dismiss.
  if (bookId) {
    for (const want of ['Reading', 'Colour category', 'More actions']) {
      await page.goto(`${opts.baseUrl}/books/${bookId}`, { waitUntil: 'networkidle0' })
      await page.waitForFunction(() => document.querySelectorAll('button, [role=button]').length > 4,
        { timeout: opts.timeoutMs })
      await new Promise((r) => setTimeout(r, 1200))
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
      const got = await page.evaluate(async (label) => {
        const settle = (ms) => new Promise((r) => setTimeout(r, ms))
        const el = [...document.querySelectorAll('button, [role=button]')]
          .find((e) => ((e.textContent || e.getAttribute('aria-label') || '')).trim().startsWith(label))
        if (!el) return { found: false }
        const box = el.getBoundingClientRect()
        // A READER CAN ONLY PRESS WHAT IS ON SCREEN, and this is the line that
        // keeps the case honest: pressing an off-screen control by DOM query
        // manufactures a scroll the reader never asked for and then reports it.
        if (box.top < 0 || box.bottom > window.innerHeight) return { found: true, onScreen: false }
        el.click()
        await settle(600)
        const up = !!document.querySelector('.more-menu, .cs-menu, .tp-panel')
        window.scrollTo({ top: 600, behavior: 'instant' })
        await settle(400)
        const behind = Math.round(window.scrollY)
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
        await settle(700)
        return { found: true, onScreen: true, up, behind, after: Math.round(window.scrollY) }
      }, want)
      if (!got.found) { notes.push(`no ${JSON.stringify(want)} control on this work page`); continue }
      if (!got.onScreen) { notes.push(`${JSON.stringify(want)} is off screen at rest, so it was not pressed`); continue }
      if (!got.up) { fails.push(`pressing ${JSON.stringify(want)} opened nothing, so its dismissal proves nothing`); continue }
      if (got.behind < 500) { fails.push(`the page would not scroll behind ${JSON.stringify(want)}'s popover (${got.behind}px)`); continue }
      console.log(`  popover ${JSON.stringify(want)}: ${got.behind}px behind it, ${got.after}px after the dismissal`)
      if (Math.abs(got.after - got.behind) > 8) {
        fails.push(`dismissing ${JSON.stringify(want)}'s popover moved the page from ${got.behind}px to ${got.after}px — the reader loses their place`)
      }
    }
  }

} catch (err) {
  fails.push(`the run stopped early — ${String(err && err.message ? err.message : err).split('\n')[0]}`)
} finally {
  await browser.close()
}

for (const n of notes) console.log(`  note: ${n}`)
if (fails.length) {
  console.log(`\n${fails.length} FINDING(S):`)
  for (const f of fails) console.log('  ' + f)
  process.exit(1)
}
console.log('\nok  every overlay closes onto the page the reader left')
