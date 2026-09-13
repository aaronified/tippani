// A WORLD IS: one real Tippani, one real browser, one signed-in reader.
//
// `openApp()` at the top of a journey file registers the setup and teardown for
// that file and hands back the handle every journey in it uses. Nothing is shared
// with any other file — see server.mjs for why that is per file rather than per
// run.
//
// THE SIGN-IN IS THE APP'S OWN FORM, not a cookie poked into the jar:
// `ensureSession` navigates to /, types into the username and password boxes and
// presses Enter, which is what the reader does. It is imported from the
// screenshot scaffold rather than copied, because the repo's rule is that one
// verb lives in one function — and a second copy of "how do you log in" is a
// second thing to fix the day the form changes.
//
// SETUP MAY USE THE API; A JOURNEY MAY NOT. Arranging the world is not the thing
// under test, and a reader does not curl their own library into existence either.
// What has to be user-like is the part being ASSERTED — so everything after the
// sign-in happens by pressing what is on the screen. The handle below gives a
// journey a page and a URL and deliberately gives it no `api()`.

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterAll, afterEach, beforeAll } from 'vitest'

import {
  NO_MOTION_CSS,
  emulateEngineMedia,
  ensureSession,
  findBrowser,
  freezeClockScript,
  launchBrowser,
  noMotionScript,
  seedRandomScript,
} from '../../../../../scripts/screenshots/capture.mjs'
import { startServer } from './server.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const FAILURES = join(HERE, '..', '..', '..', 'journey-failures')

// A phone is 390 and a desktop is 1280 — the two widths every probe in
// scripts/screenshots measures at. A journey that is about a narrow layout says
// so by asking for one; everything else gets the desktop.
export const PHONE = { width: 390, height: 844 }
export const DESKTOP = { width: 1280, height: 900 }

function required(name) {
  const v = process.env[name]
  if (!v) {
    throw new Error(
      `${name} is unset, so the journeys' globalSetup has not run — it is what builds the binary and seeds ` +
      'the library. Run the journeys through `npm run journeys` rather than by pointing vitest at one file ' +
      'with a different config.')
  }
  return v
}

export function openApp({ viewport = DESKTOP, theme = 'light' } = {}) {
  const w = {}

  beforeAll(async () => {
    w.server = await startServer({
      binary: required('TIPPANI_JOURNEY_BINARY'),
      goldenData: required('TIPPANI_JOURNEY_GOLDEN'),
    })
    const engine = findBrowser(null, process.env.TIPPANI_BROWSER || 'chrome')
    w.engine = engine
    w.browser = await launchBrowser(engine, { theme, headless: true, viewport })
    w.page = await w.browser.newPage()
    await w.page.setViewport(viewport)
    await emulateEngineMedia(w.page, engine.browser, theme)

    // THE THREE PINS, BEFORE THE FIRST NAVIGATION. Each is the screenshot
    // harness's, imported rather than rewritten.
    //
    // Math.random FIRST, because the journeys found out the hard way why it
    // matters: Home SHUFFLES which of the library's works it shows, so a journey
    // asking "is my book on the screen?" got yes or no depending on the draw.
    // Four identical files run at once: three red, one green, on code that had
    // not changed. A real generator with a fixed seed, not a constant — a
    // constant makes every pick the same index and collapses any shuffled list
    // into one repeated element.
    //
    // The clock, so anything the app phrases as "3 months ago" says the same
    // thing tomorrow. 2026-01-01 is the capture harness's instant and the
    // fixture's dates are all before it.
    //
    // And motion off, so a press waits for a render rather than for an
    // animation — with the app's own matchMedia seeing what the CSS is already
    // enforcing, instead of the two disagreeing.
    await w.page.evaluateOnNewDocument(seedRandomScript(0x9E3779B9))
    await w.page.evaluateOnNewDocument(freezeClockScript('2026-01-01T12:00:00.000Z'))
    await w.page.evaluateOnNewDocument(noMotionScript(NO_MOTION_CSS))

    // THE PAGE'S OWN ERRORS, FORWARDED. Without this a screen that throws on
    // mount reports as a selector timeout — which reads as a slow server rather
    // than a broken build, and names no line. capture.mjs learned this the same
    // way.
    w.pageErrors = []
    w.page.on('pageerror', (err) => w.pageErrors.push(err.message))

    await ensureSession(w.page, {
      baseUrl: w.server.baseUrl,
      username: required('TIPPANI_JOURNEY_USER'),
      password: required('TIPPANI_JOURNEY_PASS'),
      timeoutMs: 20000,
    })
  }, 180000)

  // A FAILING JOURNEY LEAVES EVIDENCE. What the reader saw, and what the server
  // said while they were looking at it — both are gone the moment the world is
  // torn down, and a CI failure with neither is a failure nobody can act on.
  afterEach(async (ctx) => {
    if (ctx.task?.result?.state !== 'fail' || !w.page) return
    const stem = ctx.task.name.replace(/[^a-z0-9]+/gi, '-').slice(0, 80)
    await mkdir(FAILURES, { recursive: true })
    try {
      await w.page.screenshot({ path: join(FAILURES, `${stem}.png`), fullPage: true })
      await writeFile(join(FAILURES, `${stem}.log`),
        `--- the server said ---\n${w.server?.log() ?? ''}\n\n` +
        `--- the page threw ---\n${w.pageErrors.join('\n') || '(nothing)'}\n`)
    } catch {
      // A browser that has already died cannot be photographed, and saying so
      // here would replace the real failure with this one.
    }
  })

  afterAll(async () => {
    await w.browser?.close().catch(() => {})
    await w.server?.stop().catch(() => {})
  })

  return {
    // WHAT A JOURNEY MAY KNOW: the address it opens, and the page it is looking
    // at. Not the server's data directory, not an api() — see the header.
    get page() { return w.page },
    get baseUrl() { return w.server.baseUrl },
    goto: (path) => w.page.goto(w.server.baseUrl + path, { waitUntil: 'networkidle0' }),
    pageErrors: () => w.pageErrors,
  }
}
