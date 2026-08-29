#!/usr/bin/env node
// How snappy is this app, in milliseconds, on every screen and every action?
//
// THE REPORT: "scroll is laggy, pages are fast. clicking share shows 'slowing down'
// from the browser, backdrop takes 5-10s to render. the app needs to be extremely
// snappy." This is the harness that answers it with numbers instead of impressions,
// and then keeps answering it — the budget below fails the run, so a change that
// makes the app sticky again is a red build rather than a bug report six weeks later.
//
// ---- what it measures, and why it is not frames ----------------------------
//
// The obvious metric is the dropped frame: watch requestAnimationFrame and record the
// gaps. It is wrong here, and it is wrong in a way that quietly produces confident
// numbers. A headless browser has no compositor and no vsync, so rAF fires a handful
// of times a second whatever the page is doing; measured that way this app reported
// ~800ms "stalls" while scrolling a board it was not doing any work on at all, and the
// same figure for every A/B variant, because the number was a property of the harness.
//
// So it measures TIMER DRIFT. A timer scheduled every 16ms does not care about vsync:
// the amount by which it comes back late is the length of time the main thread was
// busy and could not answer anything — an event, a scroll, a keystroke. That is what a
// reader feels as an unresponsive page, and it is the same quantity the browser is
// watching when it offers to stop a script that is "slowing down your browser".
//
// It is also, deliberately, a narrower claim than "the app feels fast". Paint and
// compositing happen off the main thread and cannot be measured from inside the page;
// a headless run on a software rasteriser would not represent a real machine even if
// they could. What this asserts is that THE APP'S OWN WORK never holds the thread
// long enough to be felt. That is the half that was broken, and it is the half a
// regression test can actually own.
//
// ---- the budget -------------------------------------------------------------
//
// 500ms for the worst single block of any action. Not a frame budget — 16ms would be
// the frame budget and nothing that mounts two dozen cards will ever meet it — but the
// threshold either side of which an action stops feeling like a response and starts
// feeling like a wait.
//
// Reported three ways, because they fail differently: the WORST action is the one a
// reader will actually complain about, the AVERAGE says whether the app is broadly
// quick or broadly sticky, and the total blocked time per action catches the case
// where nothing crosses the bar but the thread is busy for a second in ten pieces.

import { existsSync } from 'node:fs'

const FIREFOX_CANDIDATES = [
  '/usr/bin/firefox',
  '/usr/sbin/firefox',
  '/usr/local/bin/firefox',
  '/snap/bin/firefox',
  '/Applications/Firefox.app/Contents/MacOS/firefox',
]

function findFirefox(explicit) {
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
    console.error(`no Firefox found. Tried:\n  ${FIREFOX_CANDIDATES.join('\n  ')}\nPass --firefox <path>.`)
    process.exit(1)
  }
  return found
}

// The drift monitor, installed before any app code runs so it is already recording
// during the first paint. `late` is how much longer than the interval the callback
// actually took to come back; anything under a few ms is timer granularity, not the
// page, which is what NOISE_FLOOR discards.
const NOISE_FLOOR = 8
const MONITOR = `
window.__snap = { blocks: [], mark: 0 };
(function () {
  let last = performance.now();
  setInterval(() => {
    const now = performance.now();
    const late = now - last - 16;
    if (late > ${NOISE_FLOOR}) window.__snap.blocks.push([last, Math.round(late)]);
    last = now;
  }, 16);
})();
window.__snapReset = () => { window.__snap.blocks = []; window.__snap.mark = performance.now(); };
window.__snapRead = () => {
  const b = window.__snap.blocks.filter(([at]) => at >= window.__snap.mark - 20).map(([, d]) => d);
  return {
    worst: b.length ? Math.max(...b) : 0,
    total: b.reduce((a, x) => a + x, 0),
    count: b.length,
  };
};
`

function parseArgs(argv) {
  const out = {
    baseUrl: 'http://127.0.0.1:8080',
    username: 'screenshot-bot',
    password: 'screenshot-bot-pw',
    budgetMs: 500,
    viewport: { width: 1440, height: 900 },
    timeoutMs: 30000,
    headless: true,
    firefox: '',
    json: '',
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const next = () => argv[++i]
    if (a === '--base-url') out.baseUrl = next()
    else if (a === '--username') out.username = next()
    else if (a === '--password') out.password = next()
    else if (a === '--budget') out.budgetMs = Number(next())
    else if (a === '--firefox') out.firefox = next()
    else if (a === '--json') out.json = next()
    else if (a === '--headful') out.headless = false
    else if (a === '--viewport') {
      const [w, h] = next().split('x').map(Number)
      out.viewport = { width: w, height: h }
    } else if (a === '--help' || a === '-h') {
      console.log(`snappiness.mjs — measure main-thread blocking per action, against a budget

  --base-url <url>    the running app (default http://127.0.0.1:8080)
  --username <name>   account to sign in as (default screenshot-bot)
  --password <pass>   its password (default screenshot-bot-pw)
  --budget <ms>       fail if any action's worst block exceeds this (default 500)
  --viewport <WxH>    default 1440x900
  --firefox <path>    Firefox binary; otherwise discovered
  --json <path>       also write the measurements as JSON
  --headful           show the browser

Exits non-zero when any measured action is over budget.`)
      process.exit(0)
    } else {
      console.error(`unknown argument ${a}`)
      process.exit(1)
    }
  }
  return out
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  let puppeteer
  try {
    puppeteer = await import('puppeteer-core')
  } catch {
    console.error('puppeteer-core is not installed here — run `npm ci` in scripts/perf/ first.')
    process.exit(1)
  }
  const executablePath = findFirefox(opts.firefox)
  console.log(`firefox   ${executablePath}`)
  console.log(`base-url  ${opts.baseUrl}`)
  console.log(`budget    ${opts.budgetMs}ms worst block per action\n`)

  const rows = []
  const skipped = []
  // Actions whose absence is a FAILURE rather than a note. The share picture is the
  // whole reason this harness exists, so a run where it could not be opened has not
  // measured the thing it was written to measure — and a green result there would be
  // worse than a red one, because it would be believed.
  const REQUIRED = ['open share', 'share: backdrop on']
  const browser = await puppeteer.launch({
    browser: 'firefox',
    executablePath,
    headless: opts.headless,
    // Reduced motion, so the numbers are the app's work and not its animations —
    // and so a run on a machine that honours the preference matches one that does
    // not. The same pin scripts/screenshots makes, for the same reason.
    extraPrefsFirefox: { 'ui.prefersReducedMotion': 1 },
  })

  try {
    const page = await browser.newPage()
    await page.setViewport({ ...opts.viewport, deviceScaleFactor: 1 })
    await page.evaluateOnNewDocument(MONITOR)

    // measure runs one action with the monitor reset around it, then waits for the
    // thread to go quiet before reading. `settle` is generous on purpose: an action
    // that finishes its own work and then schedules more (a fetch, an image, a
    // re-pack on the next frame) is still that action's cost to the reader.
    const measure = async (label, action, settle = 1500) => {
      // Guarded, because the very first action is the navigation that INSTALLS the
      // monitor: there is nothing to reset on about:blank, and the fresh document
      // starts its own record at zero, which is exactly what a cold load wants.
      await page.evaluate('window.__snapReset && window.__snapReset()')
      const t0 = Date.now()
      let ok = true
      try {
        await action()
      } catch (err) {
        ok = false
        skipped.push({ label, error: String(err.message || err).split('\n')[0] })
      }
      await sleep(settle)
      if (!ok) return null
      const r = await page.evaluate('window.__snapRead ? window.__snapRead() : { worst: 0, total: 0, count: 0 }')
      const row = { label, ...r, wall: Date.now() - t0 - settle }
      rows.push(row)
      const over = row.worst > opts.budgetMs ? '  OVER' : ''
      console.log(
        `${label.padEnd(34)}${String(row.worst).padStart(7)}ms worst ${String(row.total).padStart(7)}ms total ${String(row.count).padStart(4)} blocks${over}`,
      )
      return row
    }

    const screenLabel = () =>
      page.$eval('[data-screen-label]', (el) => el.getAttribute('data-screen-label')).catch(() => null)

    // ---- arriving ----
    await measure('cold load', async () => {
      await page.goto(opts.baseUrl + '/', { waitUntil: 'networkidle0' })
      await page.waitForSelector('[data-screen-label]', { timeout: opts.timeoutMs })
    }, 2500)

    const first = await screenLabel()
    if (first === 'login' || first === 'onboarding') {
      await measure('sign in', async () => {
        const pw = first === 'onboarding' ? 'input[autocomplete="new-password"]' : 'input[autocomplete="current-password"]'
        await page.type('input[autocomplete="username"]', opts.username)
        await page.type(pw, opts.password)
        await page.keyboard.press('Enter')
        await page.waitForFunction(
          () => {
            const el = document.querySelector('[data-screen-label]')
            return el && !['login', 'onboarding'].includes(el.getAttribute('data-screen-label'))
          },
          { timeout: opts.timeoutMs },
        )
      }, 2500)
      // The guided tour drives its own tab changes and would move the screen out from
      // under every measurement below. Skipped the way its own Skip button does it.
      await page.evaluate(() =>
        fetch('/api/auth/me/preferences', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tour: 'skipped', tourStep: 0 }),
        }),
      )
      await sleep(1200)
    }

    // ---- moving between screens ----
    // Through the router the way a link does, not by reloading: a full navigation
    // would measure the server and the bundle again, which "cold load" already owns.
    const goto = async (path, name) => {
      await page.evaluate((p) => {
        history.pushState({}, '', p)
        dispatchEvent(new PopStateEvent('popstate'))
      }, path)
      await page.waitForSelector(`[data-screen-label="${name}"]`, { timeout: opts.timeoutMs })
    }
    const SCREENS = [
      ['home', '/'],
      ['library', '/library'],
      ['movies', '/catalogue'],
      ['quotes', '/quotes/all'],
      ['anthologies', '/anthologies'],
      ['tags', '/tags'],
      ['search', '/search'],
      ['stats', '/stats'],
      ['settings', '/settings'],
      ['bin', '/bin'],
    ]
    for (const [name, path] of SCREENS) {
      await measure(`open ${name}`, () => goto(path, name), 2000)
    }

    // ---- scrolling a board ----
    // To the bottom in reader-sized steps, so the window grows as it would under a
    // finger. This is where mounting happens, and mounting is main-thread work.
    const scrollBoard = async (name, path) => {
      await goto(path, name)
      await sleep(2500)
      await measure(`scroll ${name}`, async () => {
        for (let i = 0; i < 12; i++) {
          // `instant`, explicitly: the stylesheet asks for smooth scrolling, and a
          // smooth scrollBy would spread this scroll over its own animation rather
          // than land it, which measures the animation instead of the board.
          await page.evaluate(() => window.scrollBy({ top: 700, behavior: 'instant' }))
          await sleep(150)
        }
      }, 1500)
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
      await sleep(600)
    }
    for (const [name, path] of [['library', '/library'], ['movies', '/catalogue'], ['quotes', '/quotes/all']]) {
      await scrollBoard(name, path)
    }

    // ---- the share picture ----
    // The whole reason this harness exists. Opened through the card's own menu, so
    // it measures the path a reader takes rather than a component in isolation.
    await goto('/quotes/all', 'quotes')
    await sleep(2000)
    const card = await page.$('.hand-card')
    if (!card) {
      skipped.push({ label: 'share', error: 'no quote card on the board to open' })
    } else {
      const openedShare = await measure('open share', async () => {
        // The contextmenu event itself, dispatched on the card body. A synthesised
        // right-click through the driver sends mousedown/mouseup with button 2 and
        // Firefox does not turn that into a contextmenu, so the menu never opened and
        // the whole share measurement was skipped. This is still the real handler on
        // the real element — see useCardMenu, which listens for exactly this.
        await page.evaluate(() => {
          const el = document.querySelector('.hand-card')
          const r = el.getBoundingClientRect()
          el.dispatchEvent(
            new MouseEvent('contextmenu', {
              bubbles: true,
              cancelable: true,
              clientX: Math.round(r.left + 20),
              clientY: Math.round(r.top + 20),
            }),
          )
        })
        await page.waitForSelector('[role="menuitem"]', { timeout: opts.timeoutMs })
        const items = await page.$$('[role="menuitem"]')
        let hit = null
        for (const it of items) {
          const text = await it.evaluate((el) => el.textContent || '')
          if (/share/i.test(text)) { hit = it; break }
        }
        if (!hit) throw new Error('no Share item in the card menu')
        // Clicked through the element rather than the driver's pointer. A menu that
        // opens at the pointer can land partly outside the viewport or under the
        // driver's idea of what is on top, and "not clickable" is then a fact about
        // the harness, not the app.
        await hit.evaluate((el) => el.click())
        await page.waitForSelector('.share-image-canvas', { timeout: opts.timeoutMs })
      }, 2500)

      if (openedShare) {
        // The backdrop. A tab, by its accessible name, so this does not depend on
        // which control shape the panel happens to use this release.
        const tabByName = async (re) => {
          const tabs = await page.$$('[role="tab"]')
          for (const t of tabs) {
            const text = await t.evaluate((el) => el.textContent || '')
            if (re.test(text)) return t
          }
          return null
        }
        const backdrop = await tabByName(/backdrop/i)
        if (!backdrop) {
          skipped.push({
            label: 'share: backdrop on',
            error: 'no Backdrop tab — the quote has no credited person with a portrait',
          })
        } else {
          await measure('share: backdrop on', async () => {
            await backdrop.evaluate((el) => el.click())
            await sleep(150)
          }, 2500)
          const chip = await tabByName(/chip/i)
          if (chip) await measure('share: backdrop off', async () => { await chip.evaluate((el) => el.click()) }, 2000)
        }
        await page.keyboard.press('Escape')
        await sleep(800)
      }
    }

    // ---- typing ----
    // Search is the one screen where every keystroke does work, so it is the one
    // where a slow main thread is felt per character rather than per click.
    await goto('/search', 'search')
    await sleep(1500)
    const box = await page.$('input[type="search"], input[role="combobox"], .tp-input')
    if (!box) skipped.push({ label: 'search: type a query', error: 'no search input found' })
    else {
      await measure('search: type a query', async () => {
        await box.evaluate((el) => el.focus())
        await page.keyboard.type('winter', { delay: 90 })
      }, 2000)
    }
  } finally {
    await browser.close()
  }

  // ---- the verdict ----
  console.log('')
  if (skipped.length) {
    // Named, never silent: an action that did not run is not an action that passed,
    // and a harness that hides its own gaps reads as full coverage when it is not.
    console.log('not measured:')
    for (const s of skipped) console.log(`  ${s.label} — ${s.error}`)
    console.log('')
  }
  if (!rows.length) {
    console.error('nothing was measured')
    process.exit(1)
  }
  const worstRow = rows.reduce((a, b) => (b.worst > a.worst ? b : a))
  const avg = Math.round(rows.reduce((a, r) => a + r.worst, 0) / rows.length)
  const over = rows.filter((r) => r.worst > opts.budgetMs)
  const measuredLabels = new Set(rows.map((r) => r.label))
  const missing = REQUIRED.filter((l) => !measuredLabels.has(l))
  console.log(`actions measured   ${rows.length}`)
  console.log(`average worst      ${avg}ms`)
  console.log(`least snappy       ${worstRow.worst}ms  (${worstRow.label})`)
  console.log(`budget             ${opts.budgetMs}ms`)

  if (opts.json) {
    const { writeFileSync } = await import('node:fs')
    writeFileSync(opts.json, JSON.stringify({ budgetMs: opts.budgetMs, average: avg, worst: worstRow, rows, skipped }, null, 2))
    console.log(`wrote              ${opts.json}`)
  }

  if (over.length || missing.length) {
    if (over.length) {
      console.error(`\nFAIL — ${over.length} action(s) over the ${opts.budgetMs}ms budget:`)
      for (const r of over) console.error(`  ${r.label}: ${r.worst}ms`)
    }
    if (missing.length) {
      console.error(`\nFAIL — ${missing.length} required action(s) never ran, so nothing was proved about them:`)
      for (const l of missing) console.error(`  ${l}`)
    }
    process.exit(1)
  }
  console.log('\nPASS — every measured action stayed under budget.')
}

await main()
