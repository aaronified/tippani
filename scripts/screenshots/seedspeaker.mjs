// Give the Casablanca line a stored speaker link, the way the app does: a
// dialogue PUT runs SyncQuoteCast, which writes speaker_cast_id from the name.
import puppeteer from 'puppeteer-core'
import { HARNESS_ACCOUNT, ensureSession, findBrowser, launchOptions } from './capture.mjs'
const BASE = 'http://127.0.0.1:8099'
const found = findBrowser(null, 'chrome')
const browser = await puppeteer.launch(launchOptions(found, { viewport: { width: 390, height: 844 } }))
const page = await browser.newPage()
await ensureSession(page, { baseUrl: BASE, username: HARNESS_ACCOUNT.username, password: HARNESS_ACCOUNT.password, timeoutMs: 30000 })
console.log(JSON.stringify(await page.evaluate(async () => {
  const api = async (m, p, b) => {
    const r = await fetch('/api' + p, {
      method: m, credentials: 'same-origin',
      headers: b ? { 'content-type': 'application/json' } : undefined,
      body: b ? JSON.stringify(b) : undefined,
    })
    let j = null; try { j = await r.json() } catch {}
    return { status: r.status, body: j }
  }
  const out = {}
  // read the line, PUT it back unchanged so the speaker link is written
  const before = await api('GET', '/dialogues?favorite=1')
  const d = (before.body.dialogues || []).find((x) => /looking at you/.test(x.quote || ''))
  out.before = d ? { id: d.id, character: d.character, actor: d.actor, speaker_cast: d.speaker_cast } : null
  if (d) {
    out.put = await api('PUT', `/dialogues/${d.id}`, {
      quote: d.quote, character: d.character, actor: d.actor,
      timestamp: d.timestamp || '', note: d.note || '', tags: d.tags || [],
      color: d.color || 'yellow', favorite: true, language: d.language || '',
      season: d.season || 0, episode: d.episode || 0, quest: d.quest || '',
    })
    const after = await api('GET', '/dialogues?favorite=1')
    const d2 = (after.body.dialogues || []).find((x) => x.id === d.id)
    out.after = d2 ? { speaker_cast: d2.speaker_cast, character_images: d2.character_images } : null
  }
  return out
}), null, 1))
await browser.close()
