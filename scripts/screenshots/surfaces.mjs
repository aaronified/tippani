// EVERY SETTINGS AND METADATA SURFACE, AT BOTH WIDTHS, IN ONE RUN.
//
// WHY IT IS ITS OWN HARNESS. `capture.mjs` photographs the app's TOP-LEVEL
// screens — one picture per address. Settings and Metadata are not screens any
// more; they are twelve sections behind a rail, and almost everything a reader
// actually operates on them opens OVER the section as a panel, a sheet or a
// picker. A run of capture.mjs shows two of the twelve and none of the overlays,
// which is exactly how a screen can be reported by the owner from their own phone
// and not reproduce here.
//
// IT FAILS LOUDLY, WHICH IS THE WHOLE DESIGN. This directory has already paid for
// a probe whose subject was found by guessing a class: the pass was skipped in
// silence and the run reported success. So every step here either captures what it
// was sent for or records a MISS with the reason, the run prints one line per
// surface, and the exit code is non-zero if anything was missed. A capture set with
// a hole in it is worse than none, because the hole is invisible in a directory of
// PNGs.
//
// IT PRESSES BY THE WORDS ON THE SCREEN, the journeys' rule, and for their reason:
// a probe that reaches a panel through a class reaches whatever that class is on
// today. `press()` below computes an accessible name the way the journey harness
// does — Chrome's own, via the accessibility tree — and REFUSES an ambiguous one.
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import puppeteer from 'puppeteer-core'
import { HARNESS_ACCOUNT, emulateEngineMedia, ensureSession, findBrowser, launchOptions, noMotionScript, NO_MOTION_CSS, oneTreePerLook } from './capture.mjs'

const opts = {
  baseUrl: 'http://127.0.0.1:8080',
  timeoutMs: 20000,
  out: '/tmp/claude-0/surfaces',
  widths: [390, 1280],
  theme: 'dark',
  username: HARNESS_ACCOUNT.username,
  password: HARNESS_ACCOUNT.password,
}
for (let i = 2; i < process.argv.length; i++) {
  const n = () => process.argv[++i]
  if (process.argv[i] === '--base-url') opts.baseUrl = n()
  else if (process.argv[i] === '--out') opts.out = n()
  else if (process.argv[i] === '--widths') opts.widths = n().split(',').map(Number)
  else if (process.argv[i] === '--theme') opts.theme = n()
}

// THE SECTIONS, BY THE WORDS ON THEIR TABS. Not by an id: the rail's ids are the
// app's business and the tab's word is what a reader presses.
const SETTINGS = ['Theme', 'Language and font', 'Review', 'Sections', 'Server']
const METADATA = ['Overview', 'Works', 'People', 'Characters', 'Tags', 'Languages', 'Colours', 'Sources']

// WHAT OPENS OVER A SECTION. Each is [the section it lives on, the words to press,
// the name of the capture]. A door that is not on the screen is a MISS with the
// list of what was — never a silent skip.
// EVERY NAME HERE IS ONE THE RUN PROVED IS ON THE SCREEN. The first list was
// written from the design pack and half of it named controls that do not exist
// under those words — "Interface language" is drawn as "Choose a language", "What
// changed" as "Changelog" — which the run reported as twelve misses with the real
// names printed beside each. That is the harness working; a probe that had
// shrugged at a missing door would have left six holes in a directory of pictures.
//
// TWO OF THE PACK'S DOORS ARE GENUINELY NOT BUILT and are not listed: the works
// console's "Fetch empty fields" lives in the bulk bar, which needs rows ticked
// first (`selectAll` below does that), and Sources has no "Test every source" at
// all — that is a pending piece of work rather than a capture to take.
const SETTINGS_DOORS = [
  ['Theme', 'Colours', 'settings-theme-colours'],
  ['Theme', 'Saved looks', 'settings-theme-saved'],
  ['Language and font', 'Choose a language', 'settings-lang-choose'],
  // THREE DOORS THIS LIST OUTLIVED, and each one is a picture that is now IN the
  // section's own capture rather than behind a press: the quotes typeface chooser
  // was folded into fonts by language, the review tuning dials were unfolded onto
  // the Review screen, and the release log is a card on Server. A probe entry for
  // a door that has been opened for good is a MISS that reports the app broken.
  ['Server', 'Read the whole log', 'settings-server-changelog'],
  ['Server', 'Restore…', 'settings-server-restore'],
]
const METADATA_DOORS = [
  ['Works', 'Look up', 'metadata-works-lookup', { anyOf: true }],
]

// A BULK BAR NEEDS A SELECTION, and the pack's two bulk acts are behind one. So
// this presses the console's own "select all shown" first — which is also the
// press that makes the filtered set the acted-on set — and then the act.
const SELECTED_DOORS = [
  ['metadata', 'Works', 'Fetch empty fields…', 'metadata-works-fills'],
  ['metadata', 'Works', 'Re-verify…', 'metadata-works-reverify'],
]

const rows = []
const note = (surface, width, file, miss) => {
  rows.push({ surface, width, file, miss })
  console.log(miss ? `MISS  ${surface} @${width}: ${miss}` : `ok    ${surface} @${width} -> ${file}`)
}

const engine = findBrowser(null, 'chrome')

// The accessible name of every pressable thing, Chrome's own computation — the
// journey harness's rule, restated here because a probe that named controls its own
// way would disagree with the tier that guards them.
// A TICK BOX IS SOMETHING A PERSON PRESSES, and this list did not have one — so
// the two bulk captures, whose first step is the console's own "select all shown",
// reported it missing on a screen it is plainly on. The box is a bare
// `input[type=checkbox]` inside its label, which is the right markup and matches
// nothing above.
const PRESS_CSS = 'button, a[href], summary, input[type="checkbox"], input[type="radio"], [role="button"], [role="link"], [role="tab"], [role="menuitem"], [role="option"], [role="switch"]'

// A whole tree per control is what took the journeys past their minute, and here it
// would spend press()'s wait on one look at a long console, so a control that
// renders a beat late would be recorded as a MISS. One tree per look, shared with
// the journeys; oneTreePerLook in capture.mjs says how.
async function namesOn(page) {
  const handles = await page.$$(PRESS_CSS)
  const out = []
  await oneTreePerLook(page, async (snapshot) => {
    for (const h of handles) {
      const vis = await h.isVisible?.().catch(() => false) ?? await h.boundingBox().then((b) => !!b).catch(() => false)
      if (!vis) { await h.dispose(); continue }
      const snap = await snapshot(h).catch(() => null)
      if (snap && snap.name) out.push({ name: snap.name.trim(), handle: h })
      else await h.dispose()
    }
  })
  return out
}

// press — REFUSES AN AMBIGUOUS NAME, and says what was there when it finds none.
// Returns null on a miss rather than throwing, because one unreachable door must
// not end a run of forty captures — it must be RECORDED as unreachable.
// `anyOf` — THE ONE PLACE REFUSING AN AMBIGUOUS NAME WOULD MEAN CAPTURING
// NOTHING. A per-row control is one per row by construction: forty-four works
// have forty-four look-ups, each named for its own title, and the picture wanted
// is "a row with its look-up open" rather than any particular row's. So a door
// may declare that the first match is the subject. Nothing else passes it, and a
// door that forgets to is a MISS, which is the default this exists to keep.
async function press(page, want, anyOf = false) {
  const deadline = Date.now() + 8000
  let seen = []
  for (;;) {
    const found = await namesOn(page)
    seen = found.map((f) => f.name)
    // THREE TIERS, NOT TWO, AND THE MIDDLE ONE IS WHY. A tab carries its own
    // count — "Works 44 needing attention" — so no control is named exactly
    // "Works", and a bare substring sweep also catches whatever else on the page
    // has the word in it. A name that BEGINS with what was asked for is the tab;
    // a name that merely contains it is a tile that mentions it.
    const lower = want.toLowerCase()
    const exact = found.filter((f) => f.name.toLowerCase() === lower)
    const starts = found.filter((f) => f.name.toLowerCase().startsWith(lower))
    const all = exact.length ? exact : starts.length ? starts : found.filter((f) => f.name.toLowerCase().includes(lower))
    const hits = anyOf && all.length > 1 ? [all[0]] : all
    if (hits.length === 1) {
      await hits[0].handle.scrollIntoView().catch(() => {})
      await hits[0].handle.click().catch(() => {})
      for (const f of found) await f.handle.dispose()
      await settle(700)
      return true
    }
    for (const f of found) await f.handle.dispose()
    if (hits.length > 1) return `"${want}" is ambiguous: ${hits.length} controls match`
    if (Date.now() > deadline) {
      return `nothing named "${want}". What is there: ${seen.slice(0, 40).join(', ') || '(nothing)'}`
    }
    await settle(300)
  }
}

const settle = (ms) => new Promise((r) => setTimeout(r, ms))

// NOT `fullPage`, AND THE FIRST CUT OF THIS LIED ABOUT A BUG THAT WAS NOT THERE.
// A full-page capture expands the shot to the DOCUMENT'S scroll extent, and this
// app has one sanctioned horizontal scroller (`.ann-table-wrap`) whose inner
// scrollWidth a long title runs out to. So the works console came back as a 1235px
// image at a 390px viewport — a phone screen apparently three times too wide, with
// the dock and the card below it stretched across it — and the page it was taken
// of measures 390 wide with nothing at all past the edge. An hour was spent on that
// picture before anything measured it.
//
// A TALL VIEWPORT INSTEAD, so a long section is still in one image and the WIDTH is
// the reader's. And the measurement goes in the record beside the file, because a
// picture cannot be asked whether the page it shows overflowed.
async function shot(page, name, width) {
  const file = join(opts.out, `${name}-${width}.png`)
  await page.evaluate(() => document.fonts.ready)
  const over = await page.evaluate(() => {
    const de = document.scrollingElement
    return de.scrollWidth > de.clientWidth + 1 ? `${de.scrollWidth} in ${de.clientWidth}` : ''
  })
  await page.screenshot({ path: file, captureBeyondViewport: false })
  return over ? `${file} (SIDEWAYS: ${over})` : file
}

async function runWidth(browser, width) {
  const page = await browser.newPage()
  // TALL, because the shot is no longer a full-page one and a section runs past a
  // phone's 844. 2400 keeps the whole of every section in this app in one image
  // without the width lie `fullPage` tells; anything longer than that is a finding
  // in itself and shows as a cut.
  await page.setViewport({ width, height: 2400 })
  await emulateEngineMedia(page, engine.browser, opts.theme)
  // A REST STATE IS WHAT IS BEING PHOTOGRAPHED. An entrance animation caught
  // half-way is a picture of a frame nobody sees, and the repo's own rule is that
  // the content is there with every animation disabled.
  await page.evaluateOnNewDocument(noMotionScript(NO_MOTION_CSS))
  await ensureSession(page, opts)

  for (const [screen, sections, doors] of [
    ['settings', SETTINGS, SETTINGS_DOORS],
    ['metadata', METADATA, METADATA_DOORS],
  ]) {
    await page.goto(`${opts.baseUrl}/${screen}`, { waitUntil: 'networkidle0' })
    await settle(1200)
    note(`${screen}-landing`, width, await shot(page, `${screen}-landing`, width))

    for (const section of sections) {
      await page.goto(`${opts.baseUrl}/${screen}`, { waitUntil: 'networkidle0' })
      await settle(900)
      const r = await press(page, section)
      if (r !== true) { note(`${screen}/${section}`, width, null, r); continue }
      await settle(900)
      const slug = section.toLowerCase().replace(/[^a-z0-9]+/g, '-')
      note(`${screen}/${section}`, width, await shot(page, `${screen}-${slug}`, width))
    }

    for (const [section, door, name, doorOpts] of doors) {
      await page.goto(`${opts.baseUrl}/${screen}`, { waitUntil: 'networkidle0' })
      await settle(900)
      const toSection = await press(page, section)
      if (toSection !== true) { note(`${name}`, width, null, `could not reach ${section}: ${toSection}`); continue }
      await settle(700)
      const toDoor = await press(page, door, !!doorOpts?.anyOf)
      if (toDoor !== true) { note(`${name}`, width, null, toDoor); continue }
      await settle(1000)
      note(name, width, await shot(page, name, width))
    }
  }

  for (const [screen, section, door, name] of SELECTED_DOORS) {
    await page.goto(`${opts.baseUrl}/${screen}`, { waitUntil: 'networkidle0' })
    await settle(900)
    const toSection = await press(page, section)
    if (toSection !== true) { note(name, width, null, `could not reach ${section}: ${toSection}`); continue }
    await settle(700)
    const ticked = await press(page, 'select all shown')
    if (ticked !== true) { note(name, width, null, `could not select: ${ticked}`); continue }
    await settle(500)
    const toDoor = await press(page, door)
    if (toDoor !== true) { note(name, width, null, toDoor); continue }
    await settle(1400)
    note(name, width, await shot(page, name, width))
  }
  await page.close()
}

mkdirSync(opts.out, { recursive: true })
const browser = await puppeteer.launch(launchOptions(engine, { theme: opts.theme, headless: true }))
try {
  for (const w of opts.widths) await runWidth(browser, w)
} finally {
  await browser.close()
}

const missed = rows.filter((r) => r.miss)
writeFileSync(join(opts.out, 'index.json'), JSON.stringify(rows, null, 2))
console.log(`\n${rows.length - missed.length} captured, ${missed.length} missed -> ${opts.out}`)
if (missed.length) {
  console.log('\nMISSED:')
  for (const m of missed) console.log(`  ${m.surface} @${m.width}: ${m.miss}`)
}
process.exit(missed.length ? 1 : 0)
