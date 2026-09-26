// THE README'S IMAGES: six whole screens across the top, and one cropped shot per
// feature in the table below them.
//
// AGAINST THE OWNER'S LIBRARY, ANONYMISED, NOT THE SEEDED FIXTURE. The owner's
// call for 3.0.4: "use it for the photoshoot. do not use the notes (anonymise
// using your own notes and tags)". So this runs against a restored copy of the
// archive in which every note, tag, anthology and account name has been replaced
// before the browser opens: 0379e1a5 lists what was changed, bfad2a5f which four
// favourites it keeps, and a09f2527 which lines of The Idiot the anthology holds. It restores nothing and writes no
// note. It sets the skin each shot
// names, answers Daily Quiz cards only to bring a chosen card to the top of the
// deck, and imports readme-import-sample.txt for the import shot.
//
// WHAT IS LEGIBLE IS PUBLIC DOMAIN, WITH TWO NAMED EXCEPTIONS. A README is a public
// page, so every shot that prints quote text frames public-domain text: Bhagat
// Singh, Tagore, Bose, Einstein, Austen, the proverbs, and those lines of The Idiot
// that match Eva Martin's 1915 translation word for word (Project Gutenberg #2638).
// Only 11 of the owner's 22 highlights of it do; the other 11 are some other
// translation, and no shot shows them. The exceptions are the favourites' film and
// game lines, "All izz well…" (3 Idiots) and "Fus Ro Dah" (Skyrim), a few words
// each, which are there because the feature is one library for everything you
// read AND watch. Other books appear as covers and counts, which is not quotation.
// That is the rule the 6aa59990 re-shoot kept, and it is why several shots below
// name the card they want.
//
// usage, with Chrome from the Playwright image:
//   TIPPANI_USER=reader TIPPANI_PASS=… node readme-shots.mjs \
//     --base-url http://127.0.0.1:8151 --out <dir> [--only name,name] [--look]
//
// AND THE SERVER IT RUNS AGAINST IS PART OF THE PICTURE. It is built as a release
// is, and offline, so the rail's badge reads the release and the Catalogue says
// what an install with the image's built-in keys says:
//   CGO_ENABLED=0 go build -trimpath -ldflags "-s -w \
//     -X tippani/internal/buildinfo.Version=<the release> \
//     -X main.defaultTMDBKey=placeholder -X main.defaultTVDBKey=placeholder" -o tippani ./cmd/tippani
//   TIPPANI_DATA=<the anonymised copy> TIPPANI_BIND=127.0.0.1:8151 TIPPANI_OFFLINE=1 ./tippani serve
// The placeholder keys are never sent anywhere: offline, the server makes no call.
//
// WRITES THE README'S OWN FILES, under the names README.md uses: against the server
// above, `--out docs/img` writes the sixteen images the header, the strip and the
// feature tables show, and no conversion or rename follows. (The suppliers' logos
// under docs/img/providers are their own files, left as supplied.) The six screens are JPEG at the size they were shot, the eight
// feature crops JPEG at twice the density and no wider than 1040px, and the
// wordmark PNG on a clear ground. Chrome encodes and scales them itself, on a
// canvas.
// --look also writes each framed feature shot's whole page as look-*.png, so a crop is
// chosen by looking at it.
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'
import { HARNESS_ACCOUNT, ensureSession, findBrowser, launchOptions } from './capture.mjs'
import { screenVerbs } from '../../web/frontend/test/journeys/harness/screen.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const opts = { baseUrl: 'http://127.0.0.1:8151', out: './readme-out', only: null, look: false }
for (let i = 2; i < process.argv.length; i++) {
  const next = () => process.argv[++i]
  const a = process.argv[i]
  if (a === '--base-url') opts.baseUrl = next()
  else if (a === '--out') opts.out = next()
  else if (a === '--only') opts.only = new Set(next().split(','))
  else if (a === '--look') opts.look = true
  else { console.error(`unknown flag ${a}`); process.exit(2) }
}
mkdirSync(opts.out, { recursive: true })

const DESKTOP = { width: 1280, height: 900 }
const PHONE = { width: 390, height: 844 }
// Crops are taken from a tall desktop window, so a card below the fold is still
// laid out where the reader would find it, and at twice the density, so a crop
// shown at half its width in the README's table stays sharp.
const CROP = { width: 1280, height: 1500 }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const engine = findBrowser(null, 'chrome')
const browser = await puppeteer.launch(launchOptions(engine, { viewport: DESKTOP }))
const page = await browser.newPage()
// UTC, so "today" is the day the anonymised copy was prepared for; the app sends
// the browser's offset with every Daily Quiz request.
await page.emulateTimezone('UTC')
const { press, type, see, choose } = screenVerbs(() => page)
const account = { baseUrl: opts.baseUrl, username: HARNESS_ACCOUNT.username, password: HARNESS_ACCOUNT.password, timeoutMs: 30000 }

const api = (method, path, body) => page.evaluate(async (method, path, body) => {
  const r = await fetch(path, {
    method, credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await r.text()
  let parsed = null
  try { parsed = text ? JSON.parse(text) : null } catch { parsed = text }
  return { status: r.status, body: parsed }
}, method, path, body ?? null)

// A SKIN IS THREE PREFERENCES AND A MEDIA QUERY. The app reads the preferences on
// load, so `open` after this picks them up; the colour scheme is emulated to
// match, so nothing that follows the system disagrees.
async function skin({ materialSet, theme, accent }) {
  const r = await api('PUT', '/api/auth/me/preferences', { materialSet, theme, accent })
  if (r.status !== 200) throw new Error(`setting the skin answered ${r.status}`)
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme }])
}

async function open(path, { viewport = DESKTOP, scale = 1, settle = 2500 } = {}) {
  await page.setViewport({ ...viewport, deviceScaleFactor: scale })
  await page.goto(opts.baseUrl + path, { waitUntil: 'networkidle2' })
  await page.waitForSelector('[data-screen-label]')
  await page.evaluate(() => document.fonts.ready)
  await sleep(settle)
}

// Brings the Daily Quiz card whose quote contains `words` to the top of today's
// deck by answering the ones dealt before it, the way a reader working through
// the day would.
async function deckHeadIs(words) {
  for (let i = 0; i < 8; i++) {
    const deck = await api('GET', '/api/review/daily?offset=0')
    const head = deck.body?.items?.[0]
    if (!head) throw new Error('the Daily Quiz deck is empty')
    if (head.quote.includes(words)) return head
    const r = await api('POST', '/api/review/answer', { kind: head.kind, id: head.id, result: 'got', mode: 'daily', offset: 0 })
    if (r.status !== 200) throw new Error(`answering ${head.kind} ${head.id} answered ${r.status}`)
  }
  throw new Error(`no card containing "${words}" reached the top of the deck`)
}

// THE INNERMOST CARD HOLDING SOME WORDS. Every card in the app wears `.hand-card`
// (CLAUDE.md), so the smallest one whose text contains the words is the card a
// reader would point at.
async function cardHolding(words) {
  const h = await page.evaluateHandle((words) => {
    const area = (el) => { const r = el.getBoundingClientRect(); return r.width * r.height }
    // innerText is text AS RENDERED, so a mono label arrives uppercased.
    const hits = [...document.querySelectorAll('.hand-card')].filter((el) => el.innerText.toLowerCase().includes(words.toLowerCase()))
    hits.sort((a, b) => area(a) - area(b))
    return hits[0] || null
  }, words)
  const el = h.asElement()
  if (!el) throw new Error(`no card holds "${words}"`)
  return el
}

// A box in page coordinates, from elements' boxes, padded and optionally cut to a
// height. Scrolled to the top first, so viewport and page coordinates agree.
async function frameOf(handles, { pad = 18, maxHeight = Infinity } = {}) {
  await page.evaluate(() => window.scrollTo(0, 0))
  const boxes = (await Promise.all(handles.filter(Boolean).map((h) => h.boundingBox()))).filter(Boolean)
  if (!boxes.length) throw new Error('nothing to frame')
  const x0 = Math.min(...boxes.map((b) => b.x)), y0 = Math.min(...boxes.map((b) => b.y))
  const x1 = Math.max(...boxes.map((b) => b.x + b.width)), y1 = Math.max(...boxes.map((b) => b.y + b.height))
  const x = Math.max(0, x0 - pad), y = Math.max(0, y0 - pad)
  return { x, y, width: x1 + pad - x, height: Math.min(y1 + pad - y, maxHeight) }
}

// The file each shot becomes, as README.md and docs/landing.html name it.
const FILES = {
  'banner-light': 'wordmark-light.png',
  'banner-dark': 'wordmark-dark.png',
  'hero-library': 'library-manuscript-light.jpg',
  'hero-catalogue': 'catalogue-film-assembly-dark.jpg',
  'hero-search': 'search-atelier-light.jpg',
  'hero-stats': 'stats-bindery-dark.jpg',
  'hero-anthology-phone': 'anthology-mobile-quarry-light.jpg',
  'hero-quiz-phone': 'quiz-mobile-office-dark.jpg',
}
const fileFor = (name) => FILES[name] || (name.startsWith('feature-') ? `features/${name.slice(8)}.jpg` : `${name}.png`)
const FEATURE_WIDTH = 1040

// A JPEG no wider than `maxWidth`, from a PNG, scaled and encoded by Chrome.
let encoder = null
async function toJpeg(png, maxWidth) {
  encoder ??= await browser.newPage()
  const b64 = await encoder.evaluate(async (src, maxWidth) => {
    const img = new Image()
    img.src = src
    await img.decode()
    const w = Math.min(img.naturalWidth, maxWidth), h = Math.round(img.naturalHeight * w / img.naturalWidth)
    const c = document.createElement('canvas')
    c.width = w; c.height = h
    const g = c.getContext('2d')
    g.imageSmoothingQuality = 'high'
    g.drawImage(img, 0, 0, w, h)
    return c.toDataURL('image/jpeg', 0.85).split(',')[1]
  }, `data:image/png;base64,${png.toString('base64')}`, maxWidth)
  return Buffer.from(b64, 'base64')
}

async function save(name, clip, clear = false) {
  const file = join(opts.out, fileFor(name))
  mkdirSync(dirname(file), { recursive: true })
  // NOT BEYOND THE VIEWPORT. By default a clipped shot resizes the page to reach
  // it, the app re-lays out, and the entrance fade starts again: the first crops
  // came out washed pale. Every frame here fits the tall crop window.
  const png = await page.screenshot(clip ? { clip, captureBeyondViewport: false, omitBackground: clear } : {})
  const bytes = file.endsWith('.jpg') ? await toJpeg(png, name.startsWith('feature-') ? FEATURE_WIDTH : Infinity) : png
  writeFileSync(file, bytes)
  console.log('captured', file)
}

const PAPER = { materialSet: 'manuscript', theme: 'light', accent: 'terracotta' }

// THE HEADER'S WORDMARK, drawn by the app in its own faces. The owner's layout:
// the mark at the height of four stacked lines, and beside it the name in English
// and Bengali, then the romanisation and Hindi, then what the word means. Drawn
// on a transparent ground, once per theme, with the theme's own ink.
async function banner(dark) {
  // THE APP'S CSP REFUSES INLINE STYLE, which is right for the app and the reason
  // a first cut drew the mark at the window's width with the lines run together:
  // every style attribute and <style> below was dropped. The capture page alone
  // bypasses it, for this drawing, and only in this browser.
  await page.setBypassCSP(true)
  await open('/', { viewport: { width: 900, height: 400 }, scale: 2, settle: 1500 })
  await page.evaluate((dark) => {
    const style = document.createElement('style')
    style.textContent = 'html, body { background: transparent !important; } html::before, html::after, body::before, body::after { display: none !important; }'
    document.head.appendChild(style)
    document.body.innerHTML = ''
    // IN A SHADOW ROOT, because the app's own stylesheet sizes a bare <img> to
    // the page's width over its inline height, and a banner fighting the cascade
    // rule by rule is fragile. Page styles stop at the shadow boundary; the
    // faces (@font-face is document-wide) and the theme's colour variables (custom
    // properties inherit) still come through, which is all this needs from the app.
    const host = document.createElement('div')
    host.id = 'readme-banner'
    host.style.cssText = 'position:absolute;top:24px;left:24px;display:inline-block'
    const root = host.attachShadow({ mode: 'open' })
    const line = (text, css, lang) => `<span${lang ? ` lang="${lang}"` : ''} style="display:block;white-space:nowrap;${css}">${text}</span>`
    root.innerHTML = '<style>:host { all: initial; display: inline-block; } .row { display: inline-flex; align-items: center; gap: 26px; padding: 12px; } img { display: block; height: 172px; width: auto; }</style>'
      + `<div class="row"><img src="${dark ? '/mark-dark.svg' : '/mark.svg'}" alt=""><div>`
      + line('tippani', 'font-family:var(--font-ui);font-weight:600;font-size:52px;line-height:1.02;color:var(--ink);letter-spacing:-0.01em')
      + line('টিপ্পনী', 'font-family:var(--font-bengali);font-weight:600;font-size:38px;line-height:1.35;color:var(--ink)', 'bn')
      + line('ṭippaṇī · <span lang="hi" style="font-family:var(--font-devanagari)">टिप्पणी</span>', 'font-family:var(--font-ui);font-size:20px;line-height:1.55;margin-top:4px;color:var(--soft)')
      + line('a note in the margin', 'font-family:var(--font-ui);font-style:italic;font-size:20px;line-height:1.45;color:var(--soft)')
      + '</div></div>'
    document.body.appendChild(host)
  }, dark)
  await page.setBypassCSP(false)
  // A face loads when something first asks for it, and `fonts.ready` had already
  // resolved before these lines asked: the Bengali came out in a fallback sans.
  await page.evaluate(() => Promise.all([
    document.fonts.load('600 52px "Hanken Grotesk"', 'tippani'),
    document.fonts.load('600 38px "Noto Serif Bengali"', 'টিপ্পনী'),
    document.fonts.load('20px "Noto Serif Devanagari"', 'टिप्पणी'),
    document.fonts.load('italic 20px "Hanken Grotesk"', 'a note in the margin'),
  ]))
  await sleep(800)
}

const SHOTS = [
  // ---- the header ------------------------------------------------------------
  { name: 'banner-light', skin: PAPER, go: () => banner(false), frame: async () => frameOf([await page.$('#readme-banner')], { pad: 0 }), clear: true },
  { name: 'banner-dark', skin: { materialSet: 'manuscript', theme: 'dark', accent: 'terracotta' }, go: () => banner(true), frame: async () => frameOf([await page.$('#readme-banner')], { pad: 0 }), clear: true },

  // ---- the strip across the top: six whole screens --------------------------
  { name: 'hero-library', skin: PAPER, go: async () => {
    await open('/library')
    // BY AUTHOR, for variety across the first rows and to keep one cover out of
    // a published image: The Rise and Fall of the Third Reich wears a swastika,
    // and Shirer sorts last.
    await press('Sort')
    await press('Author')
    await sleep(1500)
  } },
  { name: 'hero-catalogue', skin: { materialSet: 'film-assembly', theme: 'dark', accent: 'ochre' }, go: () => open('/catalogue') },
  { name: 'hero-search', skin: { materialSet: 'atelier', theme: 'light', accent: 'slate' }, go: async () => {
    await open('/search', { viewport: { width: 1280, height: 760 } })
    await type('Search', 'athiest')
    await page.keyboard.press('Enter')
    await see('no exact matches')
    await sleep(1500)
  } },
  { name: 'hero-stats', skin: { materialSet: 'bindery', theme: 'dark', accent: 'olive' }, go: () => open('/stats', { settle: 3500 }) },
  { name: 'hero-anthology-phone', skin: { materialSet: 'quarry', theme: 'light', accent: 'terracotta' }, go: () => open('/anthologies/2', { viewport: PHONE, scale: 2 }) },
  { name: 'hero-quiz-phone', skin: { materialSet: 'office', theme: 'dark', accent: 'slate' }, go: async () => {
    await deckHeadIs('Give me blood')
    await open('/', { viewport: PHONE, scale: 2 })
  } },

  // ---- one crop per feature -------------------------------------------------
  { name: 'feature-remember', skin: PAPER, go: async () => {
    // A different question from the phone's: choices rather than typing.
    await deckHeadIs('passionately')
    await open('/', { viewport: CROP, scale: 2 })
  }, frame: async () => frameOf([await cardHolding('Daily Quiz')]) },
  { name: 'feature-library', skin: PAPER, go: () => open('/', { viewport: CROP, scale: 2 }),
    frame: async () => {
      const section = await page.evaluateHandle(() => {
        const h = [...document.querySelectorAll('h2, h3')].find((e) => e.textContent.trim().startsWith('Favourites'))
        return h ? h.parentElement.parentElement : null
      })
      return frameOf([section.asElement()], { maxHeight: 620 })
    } },
  // A WORK AS IT ARRIVES: the cover, the year, the genre and the author's
  // portrait came from the metadata sources, and The Idiot's lines beside them
  // are Eva Martin's 1915 translation. CUT ABOVE THE BLURB, which is the
  // publisher's copy for a modern translation and not public domain.
  { name: 'feature-details', skin: PAPER, go: () => open('/books/15', { viewport: CROP, scale: 2 }),
    frame: async () => {
      const f = await frameOf([await page.$('[data-screen-label]')], { pad: 0 })
      const blurbTop = await page.evaluate(() => {
        const el = [...document.querySelectorAll('[data-screen-label] *')].find((e) => e.children.length === 0 && /^Revealing Dostoevsky/.test(e.textContent.trim()))
        return el ? el.getBoundingClientRect().top : null
      })
      if (blurbTop == null) throw new Error('the blurb this crop stops above was not found')
      return { ...f, height: blurbTop - f.y - 10 }
    } },
  { name: 'feature-search', skin: PAPER, go: async () => {
    await open('/search', { viewport: CROP, scale: 2 })
    await type('Search', 'tag:')
    await sleep(1500)
  }, frame: async () => {
    // The field and the suggestions under it, which draw as a list below it.
    const f = await frameOf([await page.$('[data-screen-label="search"] input')], { pad: 20 })
    return { ...f, height: f.height + 175 }
  } },
  { name: 'feature-anthology', skin: PAPER, go: () => open('/anthologies/2', { viewport: CROP, scale: 2 }),
    // The toolbar runs wider than the entries, so it is framed too: Export and
    // EPUB are half of what the feature says.
    frame: async () => frameOf([await page.$('.anthology-read'), ...(await page.$$('.anthology-read .page-header button'))], { maxHeight: 700 }) },
  // THE PICTURE ITSELF, not the dialog around it: at the table's width the
  // dialog's controls left the quote too small to read. In the image's DARK theme,
  // the owner's call on contrast: on a light card the portrait behind the text all
  // but vanishes, and on a dark one Bhagat Singh's face and hat read.
  { name: 'feature-share', skin: PAPER, go: async () => {
    await open('/books/21', { viewport: CROP, scale: 2 })
    const card = await cardHolding('Bombs and pistols')
    for (const b of await card.$$('button')) {
      if ((await b.evaluate((e) => (e.getAttribute('aria-label') || e.innerText).trim())) === 'Share') { await b.click(); break }
    }
    await page.waitForSelector('[role="dialog"]')
    await sleep(1200)
    await press('Backdrop')
    await choose('Image theme', 'Dark')
    await sleep(1800)
  }, frame: async () => frameOf([await page.$('[role="dialog"] canvas')], { pad: 0 }) },
  // THE QUEUE, NOT THE DROP WELL. The claim is that imports wait for approval, and
  // the file is dropped the way a reader drops one, through ＋ Add › Files.
  { name: 'feature-import', skin: PAPER, go: async () => {
    await open('/', { viewport: CROP, scale: 2 })
    await press('Add or import')
    await press('Files')
    await sleep(800)
    const input = await page.$('[role="dialog"] input[type="file"]')
    if (!input) throw new Error('the Files door has no file input')
    await input.uploadFile(join(here, 'readme-import-sample.txt'))
    await sleep(3500)
    await open('/pending', { viewport: CROP, scale: 2 })
  }, frame: async () => frameOf([await page.$('[data-screen-label]')], { pad: 16, maxHeight: 700 }) },
  { name: 'feature-language', skin: PAPER, go: () => open('/quotes/2', { viewport: CROP, scale: 2 }),
    frame: async () => frameOf((await page.$$('[data-screen-label] .hand-card')).slice(0, 6)) },
]

await ensureSession(page, account)
// THE README'S READER READS ENGLISH, so every quote in another language carries
// its translation under it. The owner's own account showed Bengali bare, which is
// right for somebody who reads it.
// With no language named as read, every quote leads with its own script and
// carries its translation underneath (textOrder.js).
await api('PUT', '/api/auth/me/preferences', { readLanguages: '[]', textOrder: '{"master":"quote-first","byLanguage":{}}' })
let failed = 0
for (const shot of SHOTS) {
  if (opts.only && !opts.only.has(shot.name)) continue
  try {
    // A SESSION THAT WENT MISSING IS RE-ESTABLISHED, not reported as a broken shot.
    // Once, after Home, the next request reached the server with no cookie at all;
    // a shot failing on that says nothing about the screen it was for.
    if ((await api('GET', '/api/auth/me').catch(() => ({ status: 0 }))).status !== 200) await ensureSession(page, account)
    await skin(shot.skin)
    await shot.go()
    if (shot.frame) {
      const clip = await shot.frame()
      if (opts.look && shot.name.startsWith('feature-')) await save(shot.name.replace(/^feature-/, 'look-'))
      await save(shot.name, clip, !!shot.clear)
    } else {
      await save(shot.name)
    }
  } catch (e) {
    failed++
    console.error(`FAILED ${shot.name}: ${e.message.split('\n')[0]}`)
  }
}
await browser.close()
process.exit(failed ? 1 : 0)
