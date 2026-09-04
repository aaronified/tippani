// PRESS EVERY CONTROL ON THE CHARACTER PANEL AND REPORT WHAT EACH ONE DID.
// Not "does it have a handler" — what changed on the screen when it was pressed.
// The panel is re-opened before each press so one control cannot poison the next.
import puppeteer from 'puppeteer-core'
import { HARNESS_ACCOUNT, emulateEngineMedia, ensureSession, findBrowser, launchOptions } from './capture.mjs'
const BASE = 'http://127.0.0.1:8099'
const found = findBrowser(null, 'chrome')
const browser = await puppeteer.launch(launchOptions(found, { viewport: { width: 390, height: 844 } }))
const page = await browser.newPage()
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 })
await emulateEngineMedia(page, found.browser, 'dark')
const errs = []
page.on('pageerror', (e) => errs.push(e.message))
await ensureSession(page, { baseUrl: BASE, username: HARNESS_ACCOUNT.username, password: HARNESS_ACCOUNT.password, timeoutMs: 30000 })

async function openPanel() {
  await page.goto(`${BASE}/movies/2`, { waitUntil: 'networkidle2' })
  await new Promise((r) => setTimeout(r, 2200))
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('.person-chip')].find((x) => /Rick Blaine/.test(x.textContent))
    if (b) b.click()
  })
  await new Promise((r) => setTimeout(r, 1800))
}

const fingerprint = () => page.evaluate(() => {
  const panels = document.querySelectorAll('.tp-panel').length
  const dialogs = [...document.querySelectorAll('[role="dialog"]')].map((d) => d.getAttribute('aria-label') || d.querySelector('h1,h2,h3')?.textContent?.trim() || '(unlabelled)')
  const inputs = document.querySelectorAll('.tp-panel input, .tp-panel textarea').length
  const panelText = (document.querySelector('.tp-panel')?.textContent || '').replace(/\s+/g, ' ').slice(0, 400)
  // FOCUS IS AN OUTCOME. Several rows on this panel are documented as shortcuts —
  // "press the row and the caret lands in the field that owns it" — so a harness
  // that only watches for new dialogs calls a working row dead.
  const a = document.activeElement
  const focus = a && a !== document.body
    ? `${a.tagName.toLowerCase()}#${a.id || ''}.${(a.className || '').slice(0, 20)}`
    : '(none)'
  // And so is a scroll: a shortcut that focuses a field further down moves the body.
  const scroll = Math.round(document.querySelector('.tp-panel-body')?.scrollTop || 0)
  return { panels, dialogs, inputs, panelText, url: location.pathname, focus, scroll }
})

await openPanel()
const controls = await page.evaluate(() => {
  const p = document.querySelector('.tp-panel')
  if (!p) return []
  return [...p.querySelectorAll('button, [role="button"], a[href]')].map((b, i) => ({
    i,
    name: (b.getAttribute('aria-label') || b.textContent.trim() || b.title || '').replace(/\s+/g, ' ').slice(0, 44) || '(no name)',
    cls: b.className.slice(0, 34),
    disabled: b.disabled || b.getAttribute('aria-disabled') === 'true',
  }))
})
console.log(`\n${controls.length} controls on the character panel:`)
for (const c of controls) console.log(`  [${c.i}] ${c.disabled ? 'DISABLED ' : ''}${JSON.stringify(c.name)}  .${c.cls}`)

console.log('\n--- pressing each ---')
// SKIP THE DESTRUCTIVE ONES. Pressing "Take this credit off" removed the
// performer, so every later index shifted and the rest of the audit read as
// "GONE" — the harness broke its own subject. A press that changes the record is
// not something to fire blind while enumerating.
const DESTRUCTIVE = /take this credit off|remove from this|^close$/i
for (const c of controls) {
  if (DESTRUCTIVE.test(c.name)) { console.log(`  [${c.i}] ${JSON.stringify(c.name)} -> SKIPPED (destructive)`); continue }
  await openPanel()
  const before = await fingerprint()
  errs.length = 0
  const ok = await page.evaluate((i) => {
    const p = document.querySelector('.tp-panel')
    if (!p) return false
    const b = [...p.querySelectorAll('button, [role="button"], a[href]')][i]
    if (!b) return false
    b.scrollIntoView({ block: 'center' })
    b.click()
    return true
  }, c.i)
  if (!ok) { console.log(`  [${c.i}] ${c.name}: GONE`); continue }
  await new Promise((r) => setTimeout(r, 1500))
  const after = await fingerprint()
  const changed = []
  if (after.url !== before.url) changed.push(`url->${after.url}`)
  if (after.panels !== before.panels) changed.push(`panels ${before.panels}->${after.panels}`)
  if (JSON.stringify(after.dialogs) !== JSON.stringify(before.dialogs)) changed.push(`dialogs->${JSON.stringify(after.dialogs)}`)
  if (after.inputs !== before.inputs) changed.push(`inputs ${before.inputs}->${after.inputs}`)
  if (after.panelText !== before.panelText) changed.push('panel content changed')
  if (after.focus !== before.focus) changed.push(`focus->${after.focus}`)
  if (after.scroll !== before.scroll) changed.push(`scrolled ${before.scroll}->${after.scroll}`)
  const verdict = changed.length ? changed.join(', ') : '*** NOTHING HAPPENED ***'
  console.log(`  [${c.i}] ${JSON.stringify(c.name)} -> ${verdict}${errs.length ? '  ERRORS: ' + errs.join(' | ') : ''}`)
}
await browser.close()
