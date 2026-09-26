// DOES A SETTINGS CARD LOOK DIFFERENT IN EACH MATERIAL SET? Press every set in
// the real app, photograph the same card each time, and measure.
//
// WHAT IT FOUND, and it is the owner's report confirmed: "they now look identical
// in all material sets". Over the Review card at 1280 — recorded as "dark", but
// the probe never applied its theme on Chrome until 9b2d67b2, so these are
// Chrome's default light scheme (grey levels of 221-231 out of 255 are a light
// card), and without reduced motion:
//
//   manuscript 225.44   film-assembly 221.76   office 223.59   school 223.61
//   atelier    223.59   bindery       223.59   quarry 223.59   atrium 231.14
//
// FIVE SETS AT 223.59, to two decimal places, across FOUR different card
// materials — satin, paper, cotton and paper-photo. Not a rounding artefact: the
// standard deviations agree too (17.95, 18.14, 18.14, 18.18).
//
// AND THE PLUMBING IS NOT BROKEN, which is the part worth knowing. The probe
// reads the computed style beside each shot: --tile-card resolves to a different
// file per set, the ::before has content, and its background-image is that file
// fetched and painted. The tile is there. What flattens it is that every material
// is drawn through one --grain-card: 300px at one opacity: .16, while theme.js
// has measured a scale and a strength for each — paper 220px at .10, satin 210px
// at .07 — and --surf-card-*, the calibrated composite, is written on every theme
// change and read by nothing.
//
// WHY A PROBE AND NOT A TEST PAGE. The first attempt at this answered the
// question from a synthetic page — the built stylesheet, one bare `.hand-card`,
// `--tile-card` set by hand the way theme.js sets it — and it gave a confident
// wrong answer: 0.2 grey levels of spread across seven sets, which reads as
// "every set is identical". Rendered side by side the same eight cards were
// plainly NOT identical. A mean is not a look, and a bare card is not a card
// with a screen's worth of content on it. So this presses the real control on
// the real screen and photographs what a reader would see.
import { mkdirSync } from 'node:fs'
import puppeteer from 'puppeteer-core'
import { HARNESS_ACCOUNT, NO_MOTION_CSS, emulateEngineMedia, ensureSession, findBrowser, launchOptions, noMotionScript } from './capture.mjs'

const opts = { baseUrl: 'http://127.0.0.1:8080', out: '/tmp/claude-0/cardmaterial', width: 1280, theme: 'dark' }
for (let i = 2; i < process.argv.length; i++) {
  const n = () => process.argv[++i]
  if (process.argv[i] === '--base-url') opts.baseUrl = n()
  else if (process.argv[i] === '--out') opts.out = n()
  else if (process.argv[i] === '--theme') opts.theme = n()
}
mkdirSync(opts.out, { recursive: true })

// The eight sets by the words on their own buttons, which is what a reader presses.
const SETS = ['Manuscript', 'Film assembly', 'Office', 'School', 'Atelier', 'Bindery', 'Quarry', 'Atrium']

const engine = findBrowser(null, 'chrome')
const browser = await puppeteer.launch(launchOptions(engine))
const page = await browser.newPage()
// The theme reaches Chrome only this way: launchOptions sets it for Firefox alone,
// and ensureSession never read the `theme` it used to be handed.
await emulateEngineMedia(page, engine, opts.theme)
await page.setViewport({ width: opts.width, height: 1100, deviceScaleFactor: 2 })
await page.evaluateOnNewDocument(noMotionScript(NO_MOTION_CSS))
await ensureSession(page, { baseUrl: opts.baseUrl, ...HARNESS_ACCOUNT })

const nameOf = async (h) => (await page.evaluate((e) => (e.innerText || e.getAttribute('aria-label') || '').trim(), h)) || ''
const pressByWords = async (words) => {
  for (const h of await page.$$('button, [role="button"], [role="radio"], [role="option"]')) {
    const n = (await nameOf(h)).toLowerCase()
    // EXACT, OR THE LAST LINE. A material's button is a whole specimen card —
    // "13A / the margins, wider than the text… / MANUSCRIPT" — so the set's name
    // is the last line of it rather than the whole accessible name. Matching the
    // last line keeps this from also matching any control that merely mentions a
    // set somewhere in its text.
    const last = n.split('\n').filter(Boolean).pop() || ''
    if (n === words.toLowerCase() || n.startsWith(`${words.toLowerCase()}\n`) || last === words.toLowerCase()) {
      if (await h.boundingBox()) { await h.click(); return true }
    }
  }
  return false
}

// `/settings`, not `#/settings/theme` — the app does not route on the hash, and
// the wrong form left the probe standing on Home reporting eight missing controls
// for a screen it had never opened. Then press the section by its own word, the
// way `surfaces.mjs` does.
await page.goto(`${opts.baseUrl}/settings`, { waitUntil: 'networkidle0' })
// NO addStyleTag HERE. `noMotionScript` above is already installed on every
// document this page loads, and adding the stylesheet as well threw "Could not
// load style" — two ways of saying the same thing, one of which does not work.
await new Promise((r) => setTimeout(r, 900))

// THE TOUR IS OPEN ON A FRESH ACCOUNT and it covers the screen. Dismissing it is
// setup, not the thing under test, so it presses the app's own way out.
for (const words of ['skip tour', 'finish later']) { if (await pressByWords(words)) await new Promise((r) => setTimeout(r, 400)) }
if (!(await pressByWords('Theme'))) { console.log('MISS  could not open the Theme section'); process.exit(1) }
await new Promise((r) => setTimeout(r, 900))

if (process.env.TIPPANI_LIST) {
  const seen = []
  for (const h of await page.$$('button, [role="button"], [role="radio"], [role="option"]')) {
    if (await h.boundingBox()) seen.push(JSON.stringify((await nameOf(h)).slice(0, 60)))
  }
  console.log('NAMES', seen.join(' | '))
}

const rows = []
for (const set of SETS) {
  const hit = await pressByWords(set)
  if (!hit) { console.log(`MISS  ${set}: no control with that name`); rows.push({ set, miss: true }); continue }
  await new Promise((r) => setTimeout(r, 500))
  // NOT THE CARD ON THEME. The first cut photographed the Theme section's own
  // card, which CONTAINS the material picker — so what changed between shots was
  // eight specimen tiles swapping their selected state, and the measurement said
  // the sets differ when what differed was the control. Every set landed in one
  // of two clusters whose means matched to a hundredth, which is the shape of a
  // probe measuring its own instrument.
  //
  // So: set the material on Theme, then walk to a section with no picker on it
  // and photograph THAT card. Review is the plainest of the five.
  if (!(await pressByWords('Review'))) { console.log(`MISS  ${set}: could not reach Review`); rows.push({ set, miss: true }); continue }
  await new Promise((r) => setTimeout(r, 700))
  const card = await page.$('.hand-card')
  if (!card) { console.log(`MISS  ${set}: no card on screen`); rows.push({ set, miss: true }); continue }
  const diag = await page.evaluate((el) => {
    const cs = getComputedStyle(el), be = getComputedStyle(el, '::before')
    const root = getComputedStyle(document.documentElement)
    return {
      tileCard: root.getPropertyValue('--tile-card').trim().slice(0, 60),
      surfImg: root.getPropertyValue('--surf-card-image').trim().slice(0, 40),
      beImage: be.backgroundImage.slice(0, 60),
      beSize: be.backgroundSize, beOpacity: be.opacity, beBlend: be.mixBlendMode,
      beContent: be.content, cardBg: cs.backgroundImage.slice(0, 40),
    }
  }, card)
  console.log(`      ${set}: ${JSON.stringify(diag)}`)
  const file = `${opts.out}/${set.toLowerCase().replace(/\s+/g, '-')}.png`
  await card.screenshot({ path: file })
  // AND THE SAME CARD WITH THE MATERIAL TAKEN OFF. Comparing two sets' cards
  // directly does not measure the material: the card carries CONTENT, the content
  // differs between visits, and the first cut of this probe duly reported two
  // different BEFORE readings for the same commit. The difference between a card
  // and ITSELF with the tile suppressed is the material's own contribution, and
  // nothing else in the frame can move it.
  // THROUGH THE APP'S OWN PROPERTY, not an injected stylesheet: a Content
  // Security Policy blocks the style tag ("Could not load style"), and the rule
  // already reads --tile-card, so setting it to `none` on the root turns exactly
  // the one layer off and nothing else.
  const prev = await page.evaluate(() => {
    const v = document.documentElement.style.getPropertyValue('--tile-card')
    document.documentElement.style.setProperty('--tile-card', 'none')
    return v
  })
  await new Promise((r) => setTimeout(r, 250))
  await card.screenshot({ path: file.replace('.png', '-bare.png') })
  await page.evaluate((v) => document.documentElement.style.setProperty('--tile-card', v), prev)
  await new Promise((r) => setTimeout(r, 250))
  console.log(`ok    ${set} -> ${file}`)
  rows.push({ set, file })
  if (!(await pressByWords('Theme'))) { console.log('MISS  could not return to Theme'); break }
  await new Promise((r) => setTimeout(r, 600))
}
await browser.close()
process.exit(rows.some((r) => r.miss) ? 1 : 0)
