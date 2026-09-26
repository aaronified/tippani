// TAGS, SOURCES AND LANGUAGES, at both widths, as the app draws them.
// The three "small" metadata sections: #84 two columns of tags and four of
// stickers on a phone, #83 the API keys on a card of their own, #82 whatever the
// Languages section needs. This captures all three so the redesign of the third
// starts from a picture rather than a guess.
//
// WHAT IT MEASURED, before and after:
//
//   Tags     @390   tags 1 col -> 2 cols, stickers 1 -> 4 (5 at 1280)
//   Sources  @390   one card -> three: the suppliers, the credentials, the
//                   credit separators
//   Languages@390   card 1,038px -> 726px   @1280 510px -> 426px
//
// THE COLUMN COUNT IS READ OFF getComputedStyle, and the first cut divided items
// by distinct row tops instead: five stickers in four columns is two rows, 5/2
// rounds to 3, and a four-column grid was reported as three. A derived number
// that happens to look plausible is the worst kind.
import { mkdirSync } from 'node:fs'
import puppeteer from 'puppeteer-core'
import { HARNESS_ACCOUNT, emulateEngineMedia, ensureSession, findBrowser, launchOptions, noMotionScript } from './capture.mjs'

const opts = { baseUrl: 'http://127.0.0.1:8080', out: '/tmp/claude-0/threesecs', theme: 'dark' }
for (let i = 2; i < process.argv.length; i++) {
  const n = () => process.argv[++i]
  if (process.argv[i] === '--base-url') opts.baseUrl = n()
  else if (process.argv[i] === '--out') opts.out = n()
}
mkdirSync(opts.out, { recursive: true })

const engine = findBrowser(null, 'chrome')
const browser = await puppeteer.launch(launchOptions(engine))
const page = await browser.newPage()
// The theme reaches Chrome only this way: launchOptions sets it for Firefox alone,
// and ensureSession never read the `theme` it used to be handed.
await emulateEngineMedia(page, engine, opts.theme)
await page.evaluateOnNewDocument(noMotionScript)

const nameOf = async (h) => (await page.evaluate((e) => (e.innerText || e.getAttribute('aria-label') || '').trim(), h)) || ''
const pressByWords = async (words) => {
  for (const h of await page.$$('button, [role="button"], [role="tab"], [role="option"]')) {
    const n = (await nameOf(h)).toLowerCase()
    const last = n.split('\n').filter(Boolean).pop() || ''
    if (n === words.toLowerCase() || n.startsWith(`${words.toLowerCase()}\n`) || last === words.toLowerCase()) {
      if (await h.boundingBox()) { await h.click(); return true }
    }
  }
  return false
}

let bad = 0
for (const width of [390, 1280]) {
  await page.setViewport({ width, height: 1400, deviceScaleFactor: 2 })
  await ensureSession(page, { baseUrl: opts.baseUrl, ...HARNESS_ACCOUNT })
  for (const section of ['Tags', 'Sources', 'Languages']) {
    await page.goto(`${opts.baseUrl}/metadata`, { waitUntil: 'networkidle0' })
    await new Promise((r) => setTimeout(r, 800))
    for (const w of ['skip tour', 'finish later']) { if (await pressByWords(w)) await new Promise((r) => setTimeout(r, 250)) }
    if (!(await pressByWords(section))) { console.log(`MISS @${width}: no ${section}`); bad++; continue }
    await new Promise((r) => setTimeout(r, 1100))
    const m = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('.hand-card')].map((n) => ({
        h: Math.round(n.getBoundingClientRect().height),
        head: (n.innerText || '').trim().split('\n')[0].slice(0, 30),
      }))
      const grids = [...document.querySelectorAll('[class*="grid-cols"]')].map((n) => {
        const kids = [...n.children].filter((k) => k.getBoundingClientRect().width > 0)
        // THE COMPUTED TRACK COUNT, not items divided by rows: five stickers in
        // four columns is two rows, and 5/2 rounds to 3, which reported a
        // four-column grid as a three-column one.
        const cols = getComputedStyle(n).gridTemplateColumns.split(' ').filter(Boolean).length
        return `${kids.length} items in ${cols} cols`
      })
      return { cards, grids, height: Math.round(document.body.scrollHeight) }
    })
    console.log(`@${width} ${section}: page ${m.height}px  cards ${m.cards.length} [${m.cards.map((c) => `${c.head}:${c.h}`).join(' | ')}]`)
    if (m.grids.length) console.log(`        grids: ${m.grids.join(' | ')}`)
    await page.screenshot({ path: `${opts.out}/${section.toLowerCase()}-${width}.png`, fullPage: true })
  }
}
await browser.close()
process.exit(bad ? 1 : 0)
