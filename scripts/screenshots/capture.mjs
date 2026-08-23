#!/usr/bin/env node
// Puppeteer scaffold: screenshots every screen of the running Tippani app.
//
// Screens are found by [data-screen-label="…"] — a hook the app already sets on every
// top-level screen (see web/frontend/src/App.jsx and the *Page.jsx files), plus "login"
// and "onboarding" for the auth gate. That means this script never has to guess a CSS
// selector for "is Home showing yet": it waits for the same attribute the app itself
// uses to say which screen is up.
//
// This is deliberately its own package (own node_modules, own lockfile) rather than a
// dependency of web/frontend — a browser-automation tool has nothing to do with the app
// bundle, and adding it there would drag Puppeteer into every `npm ci` a contributor runs.
//
//   node capture.mjs --base-url http://127.0.0.1:8080 --username demo --password demo1234
//
// See README.md in this directory for the full flag list and the with-server wrapper.

import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

// ---- the screen table ----
//
// path is the client-side route each screen answers to (web/frontend/src/routes.js,
// statePath). auth marks the two screens that exist only before a session does, and are
// reached by visiting "/" rather than by their own path. detail screens need an id this
// scaffold has no fixture for, so they are opt-in via --book-id / --movie-id and skipped
// with a reason otherwise, the same way a state screenshot-runner cannot reach is
// reported "not captured" rather than guessed at.
const SCREENS = [
  { name: 'home', path: '/' },
  { name: 'library', path: '/library' },
  { name: 'movies', path: '/catalogue' },
  { name: 'quotes', path: '/quotes/all' },
  { name: 'anthologies', path: '/anthologies' },
  { name: 'tags', path: '/tags' },
  { name: 'metadata', path: '/metadata' },
  { name: 'search', path: '/search' },
  { name: 'stats', path: '/stats' },
  { name: 'staging', path: '/pending' },
  { name: 'settings', path: '/settings' },
  { name: 'bin', path: '/bin' },
  { name: 'book-detail', path: (id) => `/books/${id}`, needs: 'book-id' },
  { name: 'movie-detail', path: (id) => `/catalogue/${id}`, needs: 'movie-id' },
]

const AUTH_SCREENS = ['login', 'onboarding']

function parseArgs(argv) {
  const out = {
    baseUrl: 'http://127.0.0.1:8080',
    out: join(import.meta.dirname, 'out'),
    username: 'screenshot-bot',
    password: 'screenshot-bot-password',
    screens: null, // null = every reachable screen
    themes: ['light', 'dark'],
    viewport: { width: 1280, height: 900 },
    freezeClock: true,
    headless: true,
    bookId: null,
    movieId: null,
    timeoutMs: 15000,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const next = () => argv[++i]
    if (a === '--base-url') out.baseUrl = next()
    else if (a === '--out') out.out = next()
    else if (a === '--username') out.username = next()
    else if (a === '--password') out.password = next()
    else if (a === '--screens') out.screens = next().split(',').map((s) => s.trim())
    else if (a === '--themes') out.themes = next().split(',').map((s) => s.trim())
    else if (a === '--viewport') {
      const [w, h] = next().split('x').map(Number)
      out.viewport = { width: w, height: h }
    } else if (a === '--no-freeze-clock') out.freezeClock = false
    else if (a === '--headed') out.headless = false
    else if (a === '--book-id') out.bookId = next()
    else if (a === '--movie-id') out.movieId = next()
    else if (a === '--timeout') out.timeoutMs = Number(next())
    else if (a === '--help') {
      printHelp()
      process.exit(0)
    } else {
      console.error(`unknown flag: ${a} (--help for usage)`)
      process.exit(1)
    }
  }
  return out
}

function printHelp() {
  console.log(`Usage: node capture.mjs [flags]

  --base-url <url>       Tippani server to shoot (default http://127.0.0.1:8080)
  --out <dir>            output directory (default ./out)
  --username <name>      account to create/log in as (default screenshot-bot)
  --password <pass>      password for that account (default screenshot-bot-password)
  --screens a,b,c        only these screens (default: every one in SCREENS)
  --themes light,dark    theme(s) to capture, one pass per theme (default both)
  --viewport 1280x900    fixed viewport (default 1280x900)
  --book-id <id>         required to reach book-detail
  --movie-id <id>        required to reach movie-detail
  --no-freeze-clock      don't pin the page clock to a fixed instant
  --headed               show the browser instead of running headless
  --timeout <ms>         per-wait timeout (default 15000)
`)
}

function findChromium() {
  // The environment this scaffold was written in pre-installs Chromium for
  // Playwright at this exact path (PLAYWRIGHT_BROWSERS_PATH) and asks callers not
  // to fetch a second copy. puppeteer-core never downloads a browser itself, so
  // pointing it at the same binary avoids a network fetch entirely. Elsewhere,
  // set PUPPETEER_EXECUTABLE_PATH and this is skipped.
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH
  return '/opt/pw-browsers/chromium'
}

// Kill CSS transitions/animations and the caret so no capture lands mid-motion —
// screenshot-runner's "Animations" determinism rule.
const NO_MOTION_CSS = `
  *, *::before, *::after {
    transition-duration: 0s !important;
    animation-duration: 0s !important;
    animation-delay: 0s !important;
    caret-color: transparent !important;
    scroll-behavior: auto !important;
  }
`

// Pins Date so a relative "2 minutes ago" label can't change the image between
// runs — screenshot-runner's "Clock" determinism rule. Browser-side only; it never
// touches the Go process's clock.
function freezeClockScript(isoInstant) {
  return `(() => {
    const FIXED = new Date(${JSON.stringify(isoInstant)}).getTime()
    const RealDate = Date
    class FrozenDate extends RealDate {
      constructor(...args) { super(...(args.length ? args : [FIXED])) }
      static now() { return FIXED }
    }
    window.Date = FrozenDate
  })()`
}

async function waitForScreenLabel(page, timeoutMs) {
  await page.waitForSelector('[data-screen-label]', { timeout: timeoutMs })
  return page.$eval('[data-screen-label]', (el) => el.getAttribute('data-screen-label'))
}

// Drives the real signup or login form — never constructs the session out-of-band —
// per screenshot-runner's "drive through the real interaction path" rule. Signup
// only succeeds against a data directory with no admin yet; login only succeeds
// against one where --username/--password already exist. Point --base-url at a
// scratch server (see run-with-server.sh) to get the signup path every time.
async function ensureSession(page, opts) {
  await page.goto(opts.baseUrl + '/', { waitUntil: 'networkidle0' })
  const label = await waitForScreenLabel(page, opts.timeoutMs)
  if (!AUTH_SCREENS.includes(label)) return label // already have a session

  const usernameSel = 'input[autocomplete="username"]'
  const passwordSel = label === 'onboarding' ? 'input[autocomplete="new-password"]' : 'input[autocomplete="current-password"]'
  await page.waitForSelector(usernameSel, { timeout: opts.timeoutMs })
  await page.type(usernameSel, opts.username)
  await page.type(passwordSel, opts.password)
  await page.keyboard.press('Enter')

  await page.waitForFunction(
    (authScreens) => {
      const el = document.querySelector('[data-screen-label]')
      return !!el && !authScreens.includes(el.getAttribute('data-screen-label'))
    },
    { timeout: opts.timeoutMs },
    AUTH_SCREENS,
  )

  // A brand-new account auto-opens the guided feature tour ~800ms after landing on
  // Home (web/frontend/src/App.jsx, the tourState effect), and the tour drives its
  // own tab changes via selectTab as it steps through — which looks exactly like a
  // navigation bug from the outside (screens silently land back on Home). Skip it
  // the same way a real reader would from Settings, so it never gets the chance:
  // PUT the same preference its own "Skip" button writes
  // (web/frontend/src/tour.jsx skip()).
  await page.evaluate(() =>
    fetch('/api/auth/me/preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tour: 'skipped', tourStep: 0 }),
    }),
  )

  return page.$eval('[data-screen-label]', (el) => el.getAttribute('data-screen-label'))
}

async function captureScreen(page, screen, opts, theme) {
  const path = typeof screen.path === 'function' ? screen.path(screen.name === 'book-detail' ? opts.bookId : opts.movieId) : screen.path
  await page.goto(opts.baseUrl + path, { waitUntil: 'networkidle0' })
  await page.waitForSelector(`[data-screen-label="${screen.name}"]`, { timeout: opts.timeoutMs })
  // networkidle0 plus the label existing still races a font swap or a just-mounted
  // list; one settle tick covers it without a fixed sleep long enough to flake.
  await new Promise((r) => setTimeout(r, 150))
  const file = join(opts.out, `${screen.name}-${theme}.png`)
  await page.screenshot({ path: file, fullPage: true })
  return file
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  mkdirSync(opts.out, { recursive: true })

  let puppeteer
  try {
    puppeteer = await import('puppeteer-core')
  } catch {
    console.error('puppeteer-core is not installed here — run `npm install` in scripts/screenshots/ first.')
    process.exit(1)
  }

  const executablePath = findChromium()
  const browser = await puppeteer.launch({
    executablePath,
    headless: opts.headless,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })

  const requested = opts.screens
    ? SCREENS.filter((s) => opts.screens.includes(s.name))
    : SCREENS.filter((s) => !s.needs || (s.needs === 'book-id' ? opts.bookId : opts.movieId))
  const skipped = opts.screens
    ? []
    : SCREENS.filter((s) => s.needs && !(s.needs === 'book-id' ? opts.bookId : opts.movieId)).map((s) => ({
        screen: s.name,
        error: `no --${s.needs} given`,
      }))

  const captured = []
  const failed = [...skipped]

  try {
    const page = await browser.newPage()
    await page.setViewport({ ...opts.viewport, deviceScaleFactor: 1 })
    await page.evaluateOnNewDocument((css) => {
      window.addEventListener('DOMContentLoaded', () => {
        const style = document.createElement('style')
        style.textContent = css
        document.head.appendChild(style)
      })
    }, NO_MOTION_CSS)
    if (opts.freezeClock) await page.evaluateOnNewDocument(freezeClockScript('2026-01-01T12:00:00.000Z'))

    for (const theme of opts.themes) {
      // One call: emulateMediaFeatures REPLACES the whole emulated-feature set each
      // time it's called rather than merging, so two separate calls here would leave
      // only the second feature's value in effect and silently drop the first.
      await page.emulateMediaFeatures([
        { name: 'prefers-color-scheme', value: theme },
        { name: 'prefers-reduced-motion', value: 'reduce' },
      ])

      const label = await ensureSession(page, opts)
      if (!requested.some((s) => s.name === label) && !AUTH_SCREENS.includes(label)) {
        // fine — we just landed somewhere other than home after login, e.g. onboarding
        // redirecting straight to home; capture proceeds from the route table below.
      }

      for (const screen of requested) {
        try {
          const file = await captureScreen(page, screen, opts, theme)
          captured.push({ screen: screen.name, theme, file })
          console.log(`captured  ${screen.name.padEnd(14)} ${theme.padEnd(6)} -> ${file}`)
        } catch (err) {
          failed.push({ screen: screen.name, theme, error: String(err && err.message ? err.message : err) })
          console.error(`FAILED    ${screen.name.padEnd(14)} ${theme.padEnd(6)} ${err.message || err}`)
        }
      }
    }
  } finally {
    await browser.close()
  }

  writeFileSync(join(opts.out, 'manifest.json'), JSON.stringify({ captured, failed }, null, 2))
  console.log(`\nCAPTURED ${captured.length}/${captured.length + failed.length}`)
  if (failed.length) {
    console.log('not captured:')
    for (const f of failed) console.log(`  ${f.screen}${f.theme ? ' ' + f.theme : ''}: ${f.error}`)
  }
  process.exit(failed.length && captured.length === 0 ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
