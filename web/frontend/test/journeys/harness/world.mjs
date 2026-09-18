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

import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
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
import { screenVerbs } from './screen.mjs'
import { startServer } from './server.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const FAILURES = join(HERE, '..', '..', '..', 'journey-failures')

// A phone is 390 and a desktop is 1280 — the two widths every probe in
// scripts/screenshots measures at. A journey that is about a narrow layout says
// so by asking for one; everything else gets the desktop.
//
// hasTouch, BECAUSE A PHONE HAS ONE. It is not decoration: every long press in
// this app guards on `pointerType === "touch"`, and Chrome only reports that
// pointer type when touch emulation is on — so without this the `hold` verb
// raises real touch events that the app correctly ignores, and the journey reads
// as a dead gesture. It also lets `pointer: coarse` and `hover: none` answer the
// way they do on the device, which is what the stylesheet is written for.
export const PHONE = { width: 390, height: 844, hasTouch: true }
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

// `empty: true` IS FOR EXACTLY ONE JOURNEY, and it is the first thing a person
// ever sees. Onboarding only happens on an instance with no accounts in it, so a
// world restored from the golden library — which has one — can never reach that
// screen. So this world skips the copy AND skips the sign-in: there is nobody to
// sign in as yet, and making the account is the thing being tested.
export function openApp({ viewport = DESKTOP, theme = 'light', empty = false } = {}) {
  const w = {}

  beforeAll(async () => {
    w.server = await startServer({
      binary: required('TIPPANI_JOURNEY_BINARY'),
      goldenData: empty ? null : required('TIPPANI_JOURNEY_GOLDEN'),
    })
    const engine = findBrowser(null, process.env.TIPPANI_BROWSER || 'chrome')
    w.engine = engine
    w.browser = await launchBrowser(engine, { theme, headless: true, viewport })
    w.page = await w.browser.newPage()
    await w.page.setViewport(viewport)

    // WHERE A DOWNLOAD LANDS, because the app's exports ARE downloads. `/export/*`
    // streams Markdown, `downloadPost` turns the response into a blob and clicks a
    // synthetic <a download> at it — so there is no navigation to intercept and no
    // response to read off the wire. Chrome's own download manager is the only
    // place the bytes appear, and this is how it is told where to put them.
    //
    // A DIRECTORY PER WORLD, removed with the world. Journeys run in parallel
    // processes; one shared downloads folder would make "the file that appeared"
    // ambiguous exactly when two files appeared.
    w.downloadDir = await mkdtemp(join(tmpdir(), 'tippani-journey-dl-'))
    const cdp = await w.page.createCDPSession()
    await cdp.send('Browser.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: w.downloadDir,
      eventsEnabled: true,
    })
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

    if (!empty) {
      await ensureSession(w.page, {
        baseUrl: w.server.baseUrl,
        username: required('TIPPANI_JOURNEY_USER'),
        password: required('TIPPANI_JOURNEY_PASS'),
        timeoutMs: 20000,
      })
    }
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
    if (w.downloadDir) await rm(w.downloadDir, { recursive: true, force: true }).catch(() => {})
  })

  return {
    // WHAT A JOURNEY MAY KNOW: the address it opens, the words on the screen, and
    // the six verbs in screen.mjs. Not the server's data directory, not an api().
    //
    // `page` is here for the handful of things the vocabulary does not cover yet —
    // a keyboard shortcut, a drag. It is an escape hatch and every use of it is a
    // small debt: whatever it is doing either belongs in the vocabulary or is the
    // journey reaching past what a reader can do.
    get page() { return w.page },
    get baseUrl() { return w.server.baseUrl },
    goto: (path) => w.page.goto(w.server.baseUrl + path, { waitUntil: 'networkidle0' }),

    // WHO THE READER IS, for the one journey that needs to sign in as them again.
    // Switching accounts asks for a password every time — that is the app's rule,
    // not an inconvenience — so a journey that switches away has to be able to
    // switch back. It is on the handle rather than read out of process.env at the
    // call site because the variable's NAME is the harness's business: a journey
    // that spells TIPPANI_JOURNEY_PASS knows one thing too many about how its
    // world was built, and the next journey to need it would copy the spelling.
    account: { username: required('TIPPANI_JOURNEY_USER'), password: required('TIPPANI_JOURNEY_PASS') },

    // downloaded — WAIT FOR THE FILE THE APP JUST HANDED THE READER, and give
    // back what is in it. This is the only way to assert on an export: what a
    // reader gets is a file, and a screen that says "exported" while writing an
    // empty one is exactly the shape of failure this tier exists to catch.
    //
    // Chrome writes a `.crdownload` first and renames it when the transfer
    // finishes, so a file still wearing that suffix is not finished and is
    // skipped rather than read half-written.
    downloaded: async (namePart, { timeout = 15000 } = {}) => {
      const deadline = Date.now() + timeout
      for (;;) {
        const files = await readdir(w.downloadDir).catch(() => [])
        const hit = files.find((f) => !f.endsWith('.crdownload') && f.toLowerCase().includes(namePart.toLowerCase()))
        if (hit) return { name: hit, text: await readFile(join(w.downloadDir, hit), 'utf8'), path: join(w.downloadDir, hit) }
        if (Date.now() > deadline) {
          throw new Error(`waited ${timeout}ms for a downloaded file whose name holds "${namePart}". ` +
            `The reader was handed: ${files.length ? files.join(', ') : 'nothing at all'}.`)
        }
        await new Promise((r) => setTimeout(r, 150))
      }
    },
    pageErrors: () => w.pageErrors,
    ...screenVerbs(() => w.page),
  }
}
