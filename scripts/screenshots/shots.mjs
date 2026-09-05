// Focused captures against whatever library is running — the screens the owner
// reported, at phone width, so a fix can be looked at rather than argued about.
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import puppeteer from 'puppeteer-core'
import { HARNESS_ACCOUNT, emulateEngineMedia, ensureSession, findBrowser, launchOptions } from './capture.mjs'

const opts = { baseUrl: 'http://127.0.0.1:8080', timeoutMs: 30000, width: 390, out: '/tmp/claude-0/shots',
  username: process.env.TIPPANI_USER || HARNESS_ACCOUNT.username,
  password: process.env.TIPPANI_PASS || HARNESS_ACCOUNT.password }
for (let i = 2; i < process.argv.length; i++) {
  const n = () => process.argv[++i]
  if (process.argv[i] === '--base-url') opts.baseUrl = n()
  else if (process.argv[i] === '--width') opts.width = Number(n())
  else if (process.argv[i] === '--out') opts.out = n()
}
mkdirSync(opts.out, { recursive: true })
const engine = findBrowser(null, 'chrome')
const browser = await puppeteer.launch(launchOptions(engine, { viewport: { width: opts.width, height: 1600 } }))
const page = await browser.newPage()
await emulateEngineMedia(page, engine, 'dark')
await ensureSession(page, opts)

const settle = async (ms = 2600) => new Promise((r) => setTimeout(r, ms))
const shot = async (name) => {
  const f = join(opts.out, `${name}.png`)
  await page.screenshot({ path: f })
  console.log('captured', f)
}

const wide = () => page.evaluate(() => {
  const s = document.querySelector('.tp-panel-body') || document.scrollingElement
  return s.scrollWidth > s.clientWidth + 1 ? `${s.scrollWidth} in ${s.clientWidth}` : ''
})

// A CARD IS A BUTTON, NOT AN ANCHOR, so a film is reached by pressing one — the
// same way a reader reaches it. Asking for `a[href^="/catalogue/"]` found nothing
// and the whole film capture was skipped in silence.
await page.goto(opts.baseUrl + '/catalogue', { waitUntil: 'networkidle2' }); await settle(3000)
console.log('catalogue sideways:', await wide() || 'none')
// BY ID FROM THE API, because a card's class is the app's business and a probe
// that guesses one silently captures nothing — which is what happened: the film
// pass was skipped and the run reported success.
const filmId = await page.evaluate(async () => {
  const r = await fetch('/api/movies?limit=40', { credentials: 'same-origin' })
  const d = await r.json()
  const withCast = (d.movies || []).find((m) => m.media_type !== 'game')
  return withCast ? withCast.id : ((d.movies || [])[0] || {}).id || 0
})
console.log('film id', filmId)
if (filmId) {
  await page.goto(`${opts.baseUrl}/catalogue/${filmId}`, { waitUntil: 'networkidle2' })
  await settle(3400)
  console.log('film sideways:', await wide() || 'none')
  await shot('film-detail')
  // THE CAST ROW'S CHARACTER, NOT THE FIRST PERSON CHIP. A film's credits row
  // draws person chips too and the director's is usually first, so this captured
  // the DIRECTOR's page and filed it as character-panel.png — a screenshot of the
  // wrong screen under the right name, which is worse than a missing one because
  // it is the picture somebody then reviews.
  //
  // AND THE FILM PAGE HAS NO CAST ON IT, which is why fixing the selector alone
  // was not enough: `.cast-character` is present zero times on `/catalogue/{id}`,
  // so this evaluate returned false every run and the shot was skipped in
  // silence. A capture that skips itself and reports nothing is the same failure
  // as the wrong picture, one step quieter. The cast is in Details, drawn as
  // faces under its own `Cast · N` head, and a face is the character's door.
  const opened = await page.evaluate(() => {
    const press = (el) => { if (!el) return false; el.click(); return true }
    return press([...document.querySelectorAll('.tp-btn')].find((b) => /details/i.test(b.textContent)))
  })
  if (opened) {
    await settle(2600)
    const onCharacter = await page.evaluate(() => {
      // A tile with no record behind it opens nothing and says so.
      const b = document.querySelector('.cs-face-tile:not([aria-disabled])')
      if (!b) return false
      b.click(); return true
    })
    if (onCharacter) { await settle(3400); await shot('character-panel') }
    else console.log('character-panel: no cast tile with a record behind it — not captured')
  } else console.log('character-panel: no Details button on the film page — not captured')
}
await page.goto(opts.baseUrl + '/quotes', { waitUntil: 'networkidle2' }); await settle(3000)
console.log('quotes sideways:', await wide() || 'none')
await shot('quotes-boards')
// Into a board, which is the screen the report was about.
const onBoard = await page.evaluate(() => {
  const b = [...document.querySelectorAll('button, a[href]')].find((x) => /Others/.test(x.textContent))
  if (!b) return false
  b.click(); return true
})
if (onBoard) { await settle(3200); console.log('board sideways:', await wide() || 'none'); await shot('quotes-board') }
await page.goto(opts.baseUrl + '/', { waitUntil: 'networkidle2' }); await settle(3000)
await shot('home')
await browser.close()
