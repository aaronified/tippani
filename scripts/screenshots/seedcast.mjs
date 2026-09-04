// Seed the shape the user's library actually has, THROUGH THE APP'S OWN API:
// a film whose cast row names the character its favourite dialogue names.
// This exercises cast_handlers.go — one of the three writers that never set
// character_id — so the press that follows is a real end-to-end test.
import puppeteer from 'puppeteer-core'
import { HARNESS_ACCOUNT, ensureSession, findBrowser, launchOptions } from './capture.mjs'
const BASE = 'http://127.0.0.1:8099'
const found = findBrowser(null, 'chrome')
const browser = await puppeteer.launch(launchOptions(found, { viewport: { width: 390, height: 844 } }))
const page = await browser.newPage()
await ensureSession(page, { baseUrl: BASE, username: HARNESS_ACCOUNT.username, password: HARNESS_ACCOUNT.password, timeoutMs: 30000 })
console.log(JSON.stringify(await page.evaluate(async () => {
  const post = async (path, body) => {
    const r = await fetch('/api' + path, {
      method: 'POST', credentials: 'same-origin',
      headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    })
    let j = null
    try { j = await r.json() } catch {}
    return { status: r.status, body: j }
  }
  const out = {}
  // Casablanca is movie 2; its favourite line names "Rick Blaine" / Humphrey Bogart.
  out.rick = await post('/movies/2/cast', { character: 'Rick Blaine', actor: 'Humphrey Bogart' })
  out.ilsa = await post('/movies/2/cast', { character: 'Ilsa Lund', actor: 'Ingrid Bergman' })
  // Sunset Boulevard is movie 9.
  out.norma = await post('/movies/9/cast', { character: 'Norma Desmond', actor: 'Gloria Swanson' })
  const r = await fetch('/api/movies/2/cast', { credentials: 'same-origin' })
  out.readBack = await r.json()
  return out
}), null, 1))
await browser.close()
