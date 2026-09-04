// RENDER A PROTOTYPE OFFLINE. The .dc.html files pull React, ReactDOM and Babel
// from unpkg, which this environment blocks — so the three requests are fulfilled
// from a local copy instead of the prototype being edited.
import { readFileSync } from 'node:fs'
import puppeteer from 'puppeteer-core'
import { emulateEngineMedia, findBrowser, launchOptions } from './capture.mjs'

const CDN = '/tmp/claude-0/-home-user/e0bcd098-dba2-555e-ad39-5788e9c6d227/scratchpad/dcrender/node_modules'
const LOCAL = {
  'react@18.3.1/umd/react.production.min.js': `${CDN}/react/umd/react.production.min.js`,
  'react-dom@18.3.1/umd/react-dom.production.min.js': `${CDN}/react-dom/umd/react-dom.production.min.js`,
  '@babel/standalone@7.29.0/babel.min.js': `${CDN}/@babel/standalone/babel.min.js`,
}
const OUT = '/tmp/claude-0/-home-user/e0bcd098-dba2-555e-ad39-5788e9c6d227/scratchpad'
const which = process.argv[2] || 'character-popup'
const w = Number(process.argv[3] || 1500)
const h = Number(process.argv[4] || 2000)

const found = findBrowser(null, 'chrome')
const browser = await puppeteer.launch(launchOptions(found, { viewport: { width: w, height: h } }))
const page = await browser.newPage()
await page.setViewport({ width: w, height: h, deviceScaleFactor: 2 })
await emulateEngineMedia(page, found.browser, 'light')
// THE PROTOTYPE'S OWN ESCAPE HATCH. support.js's `cdnScriptFor` checks
// `window.__resources[url]` first and, where it finds a string, uses it as the
// src WITHOUT the integrity attribute — which is exactly what a local substitute
// needs, since an SRI hash pins the byte stream to unpkg's copy. Set before any
// page script runs, so nothing on disk is edited to make this render.
await page.evaluateOnNewDocument((map) => { window.__resources = map }, {
  'https://unpkg.com/react@18.3.1/umd/react.production.min.js': `file://${LOCAL['react@18.3.1/umd/react.production.min.js']}`,
  'https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js': `file://${LOCAL['react-dom@18.3.1/umd/react-dom.production.min.js']}`,
  'https://unpkg.com/@babel/standalone@7.29.0/babel.min.js': `file://${LOCAL['@babel/standalone@7.29.0/babel.min.js']}`,
})
const errs = []
page.on('pageerror', (e) => errs.push(e.message.slice(0, 160)))
await page.goto(`file:///home/user/tippani/docs/design/prototypes/${which}.dc.html`, { waitUntil: 'networkidle2' })
await new Promise((r) => setTimeout(r, 5000))
const info = await page.evaluate(() => ({
  chars: document.body.textContent.replace(/\s+/g, ' ').trim().length,
  headings: [...document.querySelectorAll('h1,h2,h3,[class*=title]')].slice(0, 14)
    .map((e) => e.textContent.replace(/\s+/g, ' ').trim().slice(0, 44)).filter(Boolean),
  height: document.documentElement.scrollHeight,
}))
console.log(JSON.stringify(info, null, 1))
if (errs.length) console.log('page errors:', JSON.stringify(errs.slice(0, 3)))
await page.screenshot({ path: `${OUT}/proto-${which}.png`, fullPage: true })
console.log(`shot -> proto-${which}.png (${info.height}px tall)`)
await browser.close()
