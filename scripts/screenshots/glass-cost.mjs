#!/usr/bin/env node
// WHAT THE LENS COSTS, measured rather than asserted.
//
// WHY THIS EXISTS AT ALL. True glass was approved on one condition: that the cost
// be measured against this repository's own budget before the control is offered.
// That budget is already written down, in `ui.jsx`'s sheet-drag note — ONE
// `blur(10px)` on the sheet scrim blew the frame budget on a phone, the browser
// coalesced and dropped the pointer stream, and a drag stopped tracking the
// finger. The lens is a filter graph of a dozen primitives per surface, so the
// question is not whether it is more expensive but by how much.
//
// WHAT IT MEASURES: how many animation frames a two-second programmatic scroll
// gets through at phone width, with the lens off and then on, on the same page of
// the same library. Frames-per-second on a headless container is NOT a phone
// number and this script does not pretend it is — what it is good for is the
// RATIO, which is a property of the work being asked of the compositor rather
// than of the machine doing it.
import { ensureSession, findBrowser, launchBrowser } from './capture.mjs'

const BASE = process.argv[2] || 'http://127.0.0.1:8129'
const engine = findBrowser(null, process.env.TIPPANI_BROWSER || 'chrome')
const browser = await launchBrowser(engine, { theme: 'dark', headless: true, viewport: { width: 390, height: 844 } })
const page = await browser.newPage()
// Dark on Chrome too, since launchBrowser's theme reaches Firefox's profile only.
// NOT emulateEngineMedia: it also asks for reduced motion, and lensAllowed
// (web/frontend/src/glassLens.js) switches the lens off under it, so both halves
// of this measurement would be the lens off.
if (engine.browser === 'chrome') {
  await page.emulateMediaFeatures([
    { name: 'prefers-color-scheme', value: 'dark' },
    { name: 'prefers-reduced-motion', value: 'no-preference' },
  ])
}
await page.setViewport({ width: 390, height: 844 })
// The scaffold's own sign-in, with the same shape it takes everywhere else: the
// onboarding path runs because this is a fresh data dir.
await ensureSession(page, { baseUrl: BASE, username: 'probe', password: 'probe-probe-probe', timeoutMs: 30000 })

async function scrollFrames() {
  await page.evaluate(() => window.scrollTo(0, 0))
  return page.evaluate(async () => {
    let n = 0
    const start = performance.now()
    await new Promise((done) => {
      const step = () => {
        window.scrollBy(0, 18)
        n += 1
        if (performance.now() - start > 2000) return done()
        requestAnimationFrame(step)
      }
      requestAnimationFrame(step)
    })
    return n
  })
}

// The preference is set through the API rather than through the screen, because
// what is being measured is the renderer and not the route to its switch.
async function setGlass(on) {
  await page.evaluate(async (v) => {
    await fetch('/api/auth/me/preferences', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ trueGlass: v }),
    })
  }, on)
  await page.reload({ waitUntil: 'networkidle2' })
  await new Promise((r) => setTimeout(r, 600))
}

await page.goto(BASE + '/library', { waitUntil: 'networkidle2' })
const panes = await page.evaluate(() => document.querySelectorAll('[data-glass]:not([data-glass=""])').length)

await setGlass(false)
const off = await scrollFrames()
await setGlass(true)
const lensed = await page.evaluate(() => document.querySelectorAll('svg[data-tp-lens] filter').length)
// A lens that never applied has no cost, and printing one would read as "free".
// lensAllowed refuses it under reduced motion, which launchBrowser's Firefox
// profile always sets.
if (!lensed) {
  console.error('glass-cost: the lens was never applied (0 filters built), so there is no cost to measure')
  await browser.close()
  process.exit(1)
}
const on = await scrollFrames()

console.log(`panes marked          ${panes}`)
console.log(`filters built         ${lensed}`)
console.log(`frames, lens off      ${off}  (${(off / 2).toFixed(1)}/s)`)
console.log(`frames, lens on       ${on}  (${(on / 2).toFixed(1)}/s)`)
console.log(`cost                  ${off ? (100 - (on / off) * 100).toFixed(1) : '?'}% of the frames`)
await browser.close()
