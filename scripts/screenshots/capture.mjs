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
// GECKO, NOT BLINK. Puppeteer drives Firefox over WebDriver BiDi rather than Chromium
// over CDP. One engine only: the kit's own rule is that a second driver gives you two
// harnesses to keep deterministic, and every determinism control below is engine-specific
// enough that supporting both would mean two of each. The one API this costs us is
// page.emulateMediaFeatures — Puppeteer routes it through a CDP emulation manager, so on
// Firefox it throws `UnsupportedOperation: CDP support is required for this feature`, and
// the theme would silently have been the host's rather than the one requested. Firefox
// forces the same media queries through profile preferences instead; see THEME_PREF.
//
//   node capture.mjs --base-url http://127.0.0.1:8080 --username demo --password demo1234
//
// See README.md in this directory for the full flag list and the with-server wrapper.

import { existsSync, mkdirSync, realpathSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

// ---- the screen table ----
//
// path is the client-side route each screen answers to (web/frontend/src/routes.js,
// statePath). auth marks the two screens that exist only before a session does, and are
// reached by visiting "/" rather than by their own path. detail screens need an id this
// scaffold has no fixture for, so they are opt-in via --book-id / --movie-id and skipped
// with a reason otherwise, the same way a state screenshot-runner cannot reach is
// reported "not captured" rather than guessed at.
export const SCREENS = [
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

export const AUTH_SCREENS = ['login', 'onboarding']

// The scratch account every harness in this directory signs in as. Exported so a
// second harness reuses it instead of restating it — a third copy of a password is a
// third thing to forget when it changes, and the failure is a 401 thirty seconds into
// a run that already built a binary and seeded a library.
export const HARNESS_ACCOUNT = { username: 'screenshot-bot', password: 'screenshot-bot-pw' }

// THEME_PREF maps a theme name to layout.css.prefers-color-scheme.content-override,
// the Firefox preference that forces what `prefers-color-scheme` reports to content.
//
// THE VALUES ARE NOT GUESSABLE and are not what you would assume: 0 is dark and 1 is
// light. They were confirmed against this Firefox by reading matchMedia back out of a
// blank page under each value, which is the only way to know — a wrong value here does
// not fail, it captures the other theme under the right filename.
//
// The app resolves its own theme from this query (web/frontend/src/theme.js: a stored
// preference of "system", which is what a fresh account has, defers to the media query
// and writes html[data-theme]). So forcing the query exercises the real resolution path
// rather than reaching past it to set data-theme directly, and a break in that path is
// something these captures can still catch.
//
// Preferences are read once when the profile starts, which is why main() launches one
// browser per theme instead of one browser and one page per theme. A fresh profile per
// launch also means a fresh session per theme, which ensureSession already handles: the
// first theme signs up and the rest log in.
const THEME_PREF = { dark: 0, light: 1 }

function parseArgs(argv) {
  const out = {
    baseUrl: 'http://127.0.0.1:8080',
    out: join(import.meta.dirname, 'out'),
    username: HARNESS_ACCOUNT.username,
    // 17 characters, and it MUST stay inside the app's 8..20 range (PASSWORD_MAX in
    // web/frontend/src/secret.js, enforced again in auth_handlers.go). The old default
    // was 23, which worked only by accident: the form input carries maxLength={20}, so
    // the browser silently dropped the tail and signup and login truncated to the same
    // 20 characters. Anything reaching the API directly — seed.mjs does — sent the full
    // string and was refused with "password must be at most 20 characters".
    password: HARNESS_ACCOUNT.password,
    screens: null, // null = every reachable screen
    themes: ['light', 'dark'],
    viewport: { width: 1280, height: 900 },
    freezeClock: true,
    seedRandom: true,
    headless: true,
    firefox: null, // null = discover
    locale: 'en-US',
    timezone: 'UTC',
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
    else if (a === '--no-seed-random') out.seedRandom = false
    else if (a === '--headed') out.headless = false
    else if (a === '--firefox') out.firefox = next()
    else if (a === '--locale') out.locale = next()
    else if (a === '--timezone') out.timezone = next()
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
  for (const theme of out.themes) {
    // Caught here rather than at launch, because an unknown theme would otherwise reach
    // extraPrefsFirefox as `undefined`, which Firefox ignores — leaving the host's own
    // appearance in effect and writing it out under the requested name.
    if (!(theme in THEME_PREF)) {
      console.error(`unknown theme: ${theme} (known: ${Object.keys(THEME_PREF).join(', ')})`)
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
  --password <pass>      password for that account (default screenshot-bot-pw; 8-20 chars)
  --screens a,b,c        only these screens (default: every one in SCREENS)
  --themes light,dark    theme(s) to capture, one browser per theme (default both)
  --viewport 1280x900    fixed viewport (default 1280x900)
  --firefox <path>       Firefox binary (default: discovered; see FIREFOX_CANDIDATES)
  --locale <tag>         pinned page locale (default en-US)
  --timezone <tz>        pinned page timezone (default UTC)
  --book-id <id>         required to reach book-detail
  --movie-id <id>        required to reach movie-detail
  --no-freeze-clock      don't pin the page clock to a fixed instant
  --no-seed-random       don't seed Math.random (Home's greeting varies per run)
  --headed               show the browser instead of running headless
  --timeout <ms>         per-wait timeout (default 15000)
`)
}

// Where a Gecko binary is normally found. puppeteer-core never downloads a browser
// itself, so one of these has to exist — the alternative is a multi-hundred-megabyte
// fetch on a machine that already ships Firefox.
const FIREFOX_CANDIDATES = [
  '/usr/bin/firefox',
  '/usr/bin/firefox-esr',
  '/usr/local/bin/firefox',
  '/snap/bin/firefox',
  '/Applications/Firefox.app/Contents/MacOS/firefox',
]

export function findFirefox(explicit) {
  // PUPPETEER_EXECUTABLE_PATH is honoured because that is the variable CI images set,
  // and it must win over discovery: a runner with two Firefoxes installed should shoot
  // the one it pinned, not whichever appears first in the list below.
  const wanted = explicit || process.env.PUPPETEER_EXECUTABLE_PATH || process.env.FIREFOX_PATH
  if (wanted) {
    if (!existsSync(wanted)) {
      console.error(`Firefox not found at ${wanted}`)
      process.exit(1)
    }
    return wanted
  }
  const found = FIREFOX_CANDIDATES.find((p) => existsSync(p))
  if (!found) {
    console.error(`no Firefox found. Tried:\n  ${FIREFOX_CANDIDATES.join('\n  ')}\nPass --firefox <path> or set PUPPETEER_EXECUTABLE_PATH.`)
    process.exit(1)
  }
  return found
}

// Kill CSS transitions/animations and the caret so no capture lands mid-motion —
// screenshot-runner's "Animations" determinism rule. ui.prefersReducedMotion (set at
// launch) makes the app's own matchMedia checks agree; this stylesheet is still needed
// because a transition written without a reduced-motion guard ignores that query
// entirely.
const NO_MOTION_CSS = `
  *, *::before, *::after {
    transition-duration: 0s !important;
    animation-duration: 0s !important;
    animation-delay: 0s !important;
    caret-color: transparent !important;
    scroll-behavior: auto !important;
  }
`

// Injected by appending a <style> from a page script rather than with addStyleTag: the
// binary serves a Content-Security-Policy, and addStyleTag fails outright ("Could not
// load style") against one without style-src 'unsafe-inline'. That throw would land
// inside the capture loop and report every screen as failed.
//
// The readyState branch matters. As a preload script this usually runs before the DOM
// exists, so the listener is the live path — but on a document that has already parsed,
// DOMContentLoaded has been and gone and waiting for it would mean the stylesheet never
// lands at all, silently, leaving animations on.
function noMotionScript(css) {
  return `(() => {
    const add = () => {
      const style = document.createElement('style')
      style.textContent = ${JSON.stringify(css)}
      document.head.appendChild(style)
    }
    if (document.readyState === 'loading') {
      window.addEventListener('DOMContentLoaded', add)
    } else {
      add()
    }
  })()`
}

// Pins Math.random so a capture is comparable to the one before it.
//
// Home's greeting is drawn with an unseeded `pick()` over a pool
// (web/frontend/src/greetings.js: "the pool is the point, so the pick is random rather
// than seeded"). That is a deliberate product decision and this does not argue with it —
// but it means two runs of the same code produce two different home-*.png, and a
// before/after pair then contains the change you made plus a different greeting, with
// nothing to say which moved the pixels. Epigraphs and daily-quiz ordering draw from the
// same well.
//
// mulberry32 rather than a constant: returning a fixed value from Math.random makes every
// pick the same INDEX, which is deterministic but collapses any list the app shuffles into
// one repeated element — a screenshot that is stable and unrepresentative. This is a real
// generator with a fixed seed, so the app still gets varied values and gets the SAME
// varied values every run.
function seedRandomScript(seed) {
  return `(() => {
    let a = ${seed} >>> 0
    Math.random = () => {
      a = (a + 0x6D2B79F5) >>> 0
      let t = a
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  })()`
}

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

export async function waitForScreenLabel(page, timeoutMs) {
  await page.waitForSelector('[data-screen-label]', { timeout: timeoutMs })
  return page.$eval('[data-screen-label]', (el) => el.getAttribute('data-screen-label'))
}

// Drives the real signup or login form — never constructs the session out-of-band —
// per screenshot-runner's "drive through the real interaction path" rule. Signup
// only succeeds against a data directory with no admin yet; login only succeeds
// against one where --username/--password already exist. Point --base-url at a
// scratch server (see run-with-server.sh) to get the signup path on the first theme.
export async function ensureSession(page, opts) {
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
  // The app loads its own woff2 faces (Hanken Grotesk, Caveat, Gloria Hallelujah). A
  // capture taken while a fallback is still substituted has different metrics for every
  // string on screen, so this waits for the real faces rather than hoping — the skill's
  // "Fonts: awaited before capture" control. networkidle0 does not cover it: a face is
  // requested by CSS when first used, which can be after the network went quiet.
  await page.evaluate(() => document.fonts.ready)
  // networkidle0 plus the label existing plus fonts still races a just-mounted list;
  // one settle tick covers it without a fixed sleep long enough to flake.
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
    console.error('puppeteer-core is not installed here — run `npm ci` in scripts/screenshots/ first.')
    process.exit(1)
  }

  const executablePath = findFirefox(opts.firefox)
  console.log(`firefox   ${executablePath}`)

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

  for (const theme of opts.themes) {
    // One browser per theme — see THEME_PREF: Firefox reads preferences when the
    // profile starts, so a theme change is a relaunch and not a call on the page.
    const browser = await puppeteer.launch({
      browser: 'firefox',
      executablePath,
      headless: opts.headless,
      extraPrefsFirefox: {
        'layout.css.prefers-color-scheme.content-override': THEME_PREF[theme],
        // So the app's own matchMedia('(prefers-reduced-motion: reduce)') checks —
        // web/frontend/src/flow.jsx and ui.jsx both branch on it — see what
        // NO_MOTION_CSS is already enforcing, rather than the two disagreeing.
        'ui.prefersReducedMotion': 1,
      },
    })
    try {
      const page = await browser.newPage()
      await page.setViewport({ ...opts.viewport, deviceScaleFactor: 1 })
      // Both native BiDi operations, unlike emulateMediaFeatures — Firefox honours
      // these. Pinned because the app formats dates and numbers through Intl and
      // renders through its own i18n bundle, and an unpinned host locale changes
      // string widths, which changes wrapping, which changes everything below it.
      await page.emulateTimezone(opts.timezone)
      await page.emulateLocale(opts.locale)
      await page.evaluateOnNewDocument(noMotionScript(NO_MOTION_CSS))
      if (opts.freezeClock) await page.evaluateOnNewDocument(freezeClockScript('2026-01-01T12:00:00.000Z'))
      if (opts.seedRandom) await page.evaluateOnNewDocument(seedRandomScript(0x9E3779B9))

      await ensureSession(page, opts)

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
    } finally {
      await browser.close()
    }
  }

  writeFileSync(join(opts.out, 'manifest.json'), JSON.stringify({ captured, failed }, null, 2))
  console.log(`\nCAPTURED ${captured.length}/${captured.length + failed.length}`)
  if (failed.length) {
    console.log('not captured:')
    for (const f of failed) console.log(`  ${f.screen}${f.theme ? ' ' + f.theme : ''}: ${f.error}`)
  }
  process.exit(failed.length && captured.length === 0 ? 1 : 0)
}

// RUN ONLY WHEN RUN, not when imported. typescale.mjs reuses SCREENS and the session
// helper above rather than restating them — two files answering "what are all the
// screens?" is the shape of bug where a screen is added to one list and forgotten in
// the other, and the half that is missing is invisible.
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
