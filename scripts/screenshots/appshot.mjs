// THE APP'S OWN PANEL, captured to be held against a prototype artboard —
// `proto.mjs` beside this renders the other half. Two pictures rather than two
// opinions, which is what a fidelity argument needs.
//
// WHY THE PAIR EXISTS. The design pack's `.dc.html` files are the contract for
// what a screen looks like, and until proto.mjs they could not be rendered in
// this environment at all — so "it only resembles the prototype" was a claim
// nobody could check without a browser and the two files open side by side.
//
// IT UNFOLDS THE DISCLOSURES before shooting. The app folds its per-work editors
// behind a `<details>`; the prototype has no such block, and a comparison of a
// folded sheet against an unfolded artboard is a comparison of two different
// things. Unfolding makes the extra block visible, which is the point.
//
// usage: node appshot.mjs [path] [chip-text] [out-name]
//   node appshot.mjs /movies/2 "Rick Blaine" char-film
import puppeteer from 'puppeteer-core'
import { HARNESS_ACCOUNT, emulateEngineMedia, ensureSession, findBrowser, launchOptions } from './capture.mjs'
const BASE = 'http://127.0.0.1:8099'
const OUT = '/tmp/claude-0/-home-user/e0bcd098-dba2-555e-ad39-5788e9c6d227/scratchpad'
const found = findBrowser(null, 'chrome')
const browser = await puppeteer.launch(launchOptions(found, { viewport: { width: 900, height: 1600 } }))
const page = await browser.newPage()
await page.setViewport({ width: 900, height: 1600, deviceScaleFactor: 2 })
await emulateEngineMedia(page, found.browser, 'light')
await ensureSession(page, { baseUrl: BASE, username: HARNESS_ACCOUNT.username, password: HARNESS_ACCOUNT.password, timeoutMs: 30000 })
const where = process.argv[2] || '/movies/2'
const chip = process.argv[3] || 'Rick Blaine'
const name = process.argv[4] || 'char-film'
await page.goto(BASE + where, { waitUntil: 'networkidle2' })
await new Promise((r) => setTimeout(r, 2200))
await page.evaluate((c) => {
  const b = [...document.querySelectorAll('.person-chip')].find((x) => x.textContent.includes(c))
  if (!b) throw new Error(`no chip matching ${JSON.stringify(c)} on ${location.pathname}`)
  b.click()
}, chip)
await page.waitForSelector('.tp-panel', { timeout: 20000 })
await new Promise((r) => setTimeout(r, 1500))
// Unfold the editors so the whole sheet is visible in one shot, the way the
// prototype draws it — the app folds them behind a disclosure.
await page.evaluate(() => { document.querySelectorAll('.tp-panel details').forEach((d) => { d.open = true }) })
await new Promise((r) => setTimeout(r, 600))
const el = await page.$('.tp-panel')
await el.screenshot({ path: `${OUT}/app-${name}.png` })
// And the section order, as text, so the comparison is not only visual
console.log(JSON.stringify(await page.evaluate(() => {
  const p = document.querySelector('.tp-panel')
  return [...p.querySelectorAll('.cs-section, .cs-head-row, .cs-row, .cs-fact, .cs-count, .cs-seg, .cs-credit-name, summary')]
    .map((e) => `${e.className.split(' ')[0]}: ${e.textContent.replace(/\s+/g, ' ').trim().slice(0, 52)}`)
}), null, 1))
await browser.close()
