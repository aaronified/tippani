#!/usr/bin/env node
// GIVE A WORK THE CAST ROW A LIVE CHIP NEEDS, through the app's own API.
//
// WHY A PROBE NEEDS THIS. `characterImagesFor` emits one entry per name on a
// quote line whether or not the work's cast knows that name — so a chip is drawn
// either way, and only a name the cast DOES know carries the `character_id` the
// press is gated on. A fixture with dialogue but no cast rows therefore draws
// chips that are correctly dead, and a probe pointed at it learns nothing about
// whether a live chip works. That is not a hypothetical: it is how an early
// reading of this session mistook a correct dead chip for the reported bug.
//
// AND THE SPEAKER LINK, which is the second half. The stacked chip — a character
// with its performer beneath, the one a reader presses first — comes from
// `speaker_cast`, and that is written by SyncQuoteCast on a dialogue PUT rather
// than by a cast read. So the line is PUT back unchanged to make the link.
//
// Through the API rather than by writing SQL: the write paths are part of what a
// probe is checking, and a fixture built behind them can be a shape the app
// cannot actually produce.
//
// usage: node seed-cast.mjs --base-url http://127.0.0.1:8126 [--movie-id 2]
import puppeteer from 'puppeteer-core'

import { HARNESS_ACCOUNT, ensureSession, findBrowser, launchOptions } from './capture.mjs'

const opts = { baseUrl: 'http://127.0.0.1:8080', movieId: '2', timeoutMs: 30000 }
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === '--base-url') opts.baseUrl = process.argv[++i]
  else if (process.argv[i] === '--movie-id') opts.movieId = process.argv[++i]
  else if (process.argv[i] === '--help' || process.argv[i] === '-h') {
    console.log('usage: node seed-cast.mjs --base-url URL [--movie-id N]')
    process.exit(0)
  }
}

const engine = findBrowser(null, 'chrome')
const browser = await puppeteer.launch(launchOptions(engine, { viewport: { width: 900, height: 900 } }))
try {
  const page = await browser.newPage()
  await ensureSession(page, {
    baseUrl: opts.baseUrl,
    username: HARNESS_ACCOUNT.username,
    password: HARNESS_ACCOUNT.password,
    timeoutMs: opts.timeoutMs,
  })
  const out = await page.evaluate(async (movieId) => {
    const api = async (m, p, b) => {
      const r = await fetch('/api' + p, {
        method: m,
        credentials: 'same-origin',
        headers: b ? { 'content-type': 'application/json' } : undefined,
        body: b ? JSON.stringify(b) : undefined,
      })
      let j = null
      try { j = await r.json() } catch { /* 204 and friends */ }
      return { status: r.status, body: j }
    }
    // Every favourite line on this work, so the cast is seeded from what the
    // fixture actually says rather than from a name hard-coded here.
    const list = await api('GET', '/dialogues?favorite=1')
    const lines = (list.body?.dialogues || []).filter((d) => String(d.movie_id) === String(movieId))
    const made = []
    for (const d of lines) {
      if (!d.character) continue
      // 409 is the ordinary answer on a re-run: the row is already there.
      const add = await api('POST', `/movies/${movieId}/cast`, { character: d.character, actor: d.actor || '' })
      // A PUT of the line as it stands is what writes speaker_cast_id.
      const put = await api('PUT', `/dialogues/${d.id}`, {
        quote: d.quote, character: d.character, actor: d.actor || '',
        timestamp: d.timestamp || '', note: d.note || '', tags: d.tags || [],
        color: d.color || 'yellow', favorite: true, language: d.language || '',
        season: d.season || 0, episode: d.episode || 0, quest: d.quest || '',
      })
      made.push({ line: d.id, character: d.character, cast: add.status, link: put.status })
    }
    return { lines: lines.length, made }
  }, opts.movieId)
  if (out.lines === 0) {
    console.log(`seed-cast: movie ${opts.movieId} has no favourite dialogue to seed a cast from`)
    process.exit(1)
  }
  for (const m of out.made) {
    console.log(`seed-cast: ${JSON.stringify(m.character)} cast=${m.cast} speaker-link=${m.link}`)
  }
} finally {
  await browser.close()
}
