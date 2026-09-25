// EVERY GLYPH THAT SITS BESIDE TEXT, AND HOW FAR OFF THE LINE IT IS.
//
// THE OWNER'S COMPLAINT, AND IT IS NOT ABOUT ONE ROW: "The chevrons are slightly
// up compared to the version numbers. This is an alignment problem i see app
// wide. This kind of things differentiate casual from professional."
//
// WHY A MEASUREMENT AND NOT A READING. An svg's baseline is its BOTTOM EDGE, so a
// glyph in a `align-items: baseline` flex row hangs its whole body above the text
// baseline — about half a glyph high, which is three or four pixels and looks like
// nothing until you see the two together. By eye it is a maybe on every row in the
// app; measured it is a number per site, and the sites sort themselves.
//
// HOW IT MEASURES, AND THE INK IS THE POINT. For every element holding both an
// svg and its own text, the text's optical centre comes from a Range over its text
// nodes — the rect the browser actually painted, not the line box — and the
// glyph's comes from `getBBox()` mapped through the viewBox onto the screen: the
// INK, not the element.
//
// THAT DISTINCTION IS THE WHOLE INSTRUMENT. This app's fill glyphs are Phosphor
// icons with viewBoxes cropped off centre (`viewBox="14.1 2.1 243.9 243.9"`), so a
// box centred perfectly can still have its drawing sitting three pixels high. A
// first cut measured element boxes, reported every count in the app as within
// 1.5px, and disagreed with the owner — who was looking at the ink. Where a glyph
// has no ink to measure (a decorative rule, an empty svg) the element box stands
// in, because that is all there is.
//
// The delta is positive when the glyph sits LOW and negative when it sits high.
// Sites are grouped by the glyph's own class chain, because that is what a fix is
// written against.
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join as joinPath } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'
import { HARNESS_ACCOUNT, emulateEngineMedia, ensureSession, findBrowser, launchOptions, noMotionScript, NO_MOTION_CSS } from './capture.mjs'

const opts = {
  baseUrl: 'http://127.0.0.1:8080',
  theme: 'dark',
  widths: [390, 1280],
  tol: 1.5,
  out: '/tmp/claude-0/glyph-align.json',
  username: HARNESS_ACCOUNT.username,
  password: HARNESS_ACCOUNT.password,
}
for (let i = 2; i < process.argv.length; i++) {
  const n = () => process.argv[++i]
  if (process.argv[i] === '--base-url') opts.baseUrl = n()
  else if (process.argv[i] === '--tol') opts.tol = Number(n())
  else if (process.argv[i] === '--out') opts.out = n()
  else if (process.argv[i] === '--tolerance') opts.tol = Number(n())
}

// THE SCREENS, BY ADDRESS. Every top-level one plus the two sectioned screens'
// own sections, because the sections are where most of this app's rows live.
const PLACES = [
  '/', '/library', '/catalogue', '/quotes', '/anthologies', '/tags', '/search',
  '/stats', '/checks', '/staging', '/bin', '/import',
  '/settings/theme', '/settings/lang', '/settings/review', '/settings/sections', '/settings/server',
  '/metadata/overview', '/metadata/works', '/metadata/people', '/metadata/characters',
  '/metadata/tags', '/metadata/languages', '/metadata/categories', '/metadata/sources',
]

const settle = (ms) => new Promise((r) => setTimeout(r, ms))

const MEASURE = (tol) => {
  const out = []
  const chain = (el) => {
    const bits = []
    for (let e = el; e && e !== document.body; e = e.parentElement) {
      const c = String(e.className?.baseVal ?? e.className ?? '').trim().split(/\s+/).filter(Boolean)
      if (c.length) bits.push('.' + c.join('.'))
      if (bits.length >= 2) break
    }
    return bits.join(' in ') || el.tagName.toLowerCase()
  }
  // A LABEL THIS APP HAS CLIPPED AWAY. Every icon-only control keeps its words in
  // the accessibility tree with `clip: rect(0 0 0 0)` rather than `display: none`,
  // and the text's LINE BOX is still laid out and still measurable — a Range over
  // it returns a full-height rect sitting wherever the 1px container was put. So a
  // height filter does not catch it and a glyph beside it measured eleven pixels
  // out of line against words that are not on the screen. This is the one check
  // that reads a style rather than a rect, and it is here because there is nothing
  // in the geometry to read.
  const clippedAway = (el, host) => {
    for (let e = el; e && e !== host.parentElement; e = e.parentElement) {
      if (e.nodeType !== 1) continue
      const cs = getComputedStyle(e)
      if (cs.clip === 'rect(0px, 0px, 0px, 0px)' || cs.clipPath === 'inset(50%)') return true
    }
    return false
  }
  for (const host of document.querySelectorAll('*')) {
    const svgs = [...host.children].filter((c) => c.tagName === 'svg' || c.querySelector?.(':scope > svg'))
    if (!svgs.length) continue
    // The host's OWN text: direct text children, and text inside children that
    // hold no glyph of their own. A range over them is what the browser painted.
    const texts = []
    for (const node of host.childNodes) {
      if (node.nodeType === 3 && node.textContent.trim()) texts.push(node)
      else if (node.nodeType === 1 && !node.querySelector('svg') && node.textContent.trim()) {
        if (clippedAway(node, host)) continue
        for (const t of node.childNodes) if (t.nodeType === 3 && t.textContent.trim()) texts.push(t)
      }
    }
    if (!texts.length) continue
    let top = Infinity, bottom = -Infinity
    for (const t of texts) {
      const r = document.createRange()
      r.selectNodeContents(t)
      for (const rect of r.getClientRects()) {
        // A CLIPPED LABEL IS NOT TEXT ON THE SCREEN, and three of this probe's
        // first six findings were that. Every icon-only control in this app keeps
        // its words in the accessibility tree with the clip pattern — absolutely
        // positioned, one pixel square — so at phone width, where labels are off,
        // a Range over the label returns a 1px rect in the corner and the glyph
        // beside it measures eleven pixels out of line. The reading was arithmetic
        // about something nobody can see. Under 4px tall is that, at every type
        // setting this app offers.
        if (rect.height < 4) continue
        top = Math.min(top, rect.top)
        bottom = Math.max(bottom, rect.bottom)
      }
    }
    if (!isFinite(top)) continue
    // ONE LINE ONLY. A glyph beside a paragraph has no single line to sit on, and
    // the app's rule for those is different (it leads the block, not the line).
    if (bottom - top > 1.9 * parseFloat(getComputedStyle(host).fontSize || '16')) continue
    const textMid = (top + bottom) / 2
    for (const holder of svgs) {
      const svg = holder.tagName === 'svg' ? holder : holder.querySelector(':scope > svg')
      // THE GLYPH AND THE WORDS HAVE TO BELONG TO THE SAME CONTROL, and this is
      // the filter that turned a list of thirteen into a list of the ones that are
      // real. A toolbar row holds three buttons; it also holds an svg and the word
      // "Export", so the row measured one button's glyph against another button's
      // label and reported it eleven pixels out of line. Nothing was wrong with
      // either. A glyph is at most a wrapper away from the text it sits beside —
      // deeper than that and the two are in different boxes, where alignment is
      // the layout's business rather than the type's.
      if (svg.parentElement !== host && svg.parentElement?.parentElement !== host) continue
      const box = svg.getBoundingClientRect()
      if (!box.height) continue
      // THE INK'S RECT, in screen pixels. getBBox is in user units, so it is mapped
      // through the viewBox: a glyph whose drawing fills the top two thirds of its
      // box is three pixels higher than its box says, and that is exactly the
      // difference the eye reads and the element rect hides.
      let r = box
      try {
        const vb = svg.viewBox?.baseVal
        const bb = svg.getBBox()
        if (vb && vb.height && bb.height) {
          const scale = box.height / vb.height
          r = {
            top: box.top + (bb.y - vb.y) * scale,
            bottom: box.top + (bb.y - vb.y + bb.height) * scale,
            height: bb.height * scale,
          }
        }
      } catch { /* no ink to measure; the element box is all there is */ }
      if (!r.height) continue
      // ON THE SAME LINE, OR IT IS NOT AN ALIGNMENT QUESTION. The first cut of this
      // reported a dock button 21px off its own label and a clamp-more 21px off the
      // paragraph above it — pairs that are not side by side at all, where a glyph
      // LEADS a block rather than sitting in a line. Requiring the two rects to
      // overlap vertically is what tells "beside" from "above", and it took the
      // list from ten sites to the ones a reader can actually see.
      if (r.top >= bottom || r.bottom <= top) continue
      const delta = (r.top + r.bottom) / 2 - textMid
      if (Math.abs(delta) < tol) continue
      out.push({
        where: chain(svg),
        delta: Math.round(delta * 10) / 10,
        glyph: Math.round(r.height), box: Math.round(box.height),
        // THE WORDS IT MEASURED AGAINST, so a reading can be checked rather than
        // trusted: a site reported 11px off is either a real defect or a glyph
        // measured against text it is not beside, and only the text says which.
        said: host.textContent.trim().slice(0, 40),
        align: getComputedStyle(host).alignItems,
      })
    }
  }
  return out
}

const engine = findBrowser(null, 'chrome')
const browser = await puppeteer.launch(launchOptions(engine, { theme: opts.theme, headless: true }))
const found = new Map()
for (const width of opts.widths) {
  const page = await browser.newPage()
  await page.setViewport({ width, height: 2000 })
  await emulateEngineMedia(page, engine.browser, opts.theme)
  await page.evaluateOnNewDocument(noMotionScript(NO_MOTION_CSS))
  await ensureSession(page, opts)
  for (const place of PLACES) {
    await page.goto(opts.baseUrl + place, { waitUntil: 'networkidle0' }).catch(() => {})
    await settle(900)
    const rows = await page.evaluate(MEASURE, opts.tol).catch(() => [])
    for (const r of rows) {
      const key = r.where
      const hit = found.get(key) || { where: key, glyph: r.glyph, worst: 0, seen: 0, places: new Set(), said: r.said, align: r.align }
      hit.seen += 1
      if (Math.abs(r.delta) > Math.abs(hit.worst)) { hit.worst = r.delta; hit.said = r.said; hit.align = r.align; hit.glyph = r.glyph; hit.box = r.box }
      hit.places.add(`${place}@${width}`)
      found.set(key, hit)
    }
  }
  await page.close()
}
await browser.close()

const rows = [...found.values()]
  .map((r) => ({ ...r, places: [...r.places].slice(0, 4) }))
  .sort((a, b) => Math.abs(b.worst) - Math.abs(a.worst))
writeFileSync(opts.out, JSON.stringify(rows, null, 2))
console.log(`\n${rows.length} glyph sites sit more than ${opts.tol}px off the text beside them:\n`)
for (const r of rows) {
  console.log(`  ${r.worst > 0 ? 'LOW ' : 'HIGH'} ${String(r.worst).padStart(6)}px  ${r.where}`)
  console.log(`        ink ${r.glyph}px in a ${r.box}px box · align-items: ${r.align} · ${r.seen} of them, e.g. ${r.places[0]}`)
  console.log(`        beside: ${JSON.stringify(r.said)}`)
}
console.log(`\n-> ${opts.out}`)

// THE RATCHET. The file beside this one records what each site measured when it
// was last looked at, with a reason per site; a site may improve and may not get
// worse, and a NEW site is a failure rather than a line to add silently. That is
// the same instrument `typescale-baseline.json` is, for the same reason: a
// measurement nobody compares is a measurement nobody reads.
//
// `--update-baseline` prints the file to rewrite it with, and deliberately does
// not write it: every entry needs a REASON, and a tool that filled them in would
// be filling in the only part that matters.
const HERE = dirname(fileURLToPath(import.meta.url))
const BASE = joinPath(HERE, 'glyph-align-baseline.json')
const base = JSON.parse(readFileSync(BASE, 'utf8'))
const SLACK = 0.6 // one layout pixel's worth of rounding, and no more
let bad = 0
for (const r of rows) {
  const was = base.sites[r.where]
  if (!was) {
    console.log(`\nNEW  ${r.where} is ${r.worst}px off and is in no baseline.`)
    console.log('     Sit it on the line, or add it to glyph-align-baseline.json with the reason it cannot be.')
    bad += 1
    continue
  }
  if (Math.abs(r.worst) > Math.abs(was.off) + SLACK) {
    console.log(`\nWORSE ${r.where}: ${was.off}px when it was recorded, ${r.worst}px now.`)
    bad += 1
  }
}
for (const where of Object.keys(base.sites)) {
  if (!rows.some((r) => r.where === where)) console.log(`\nfixed: ${where} is on the line now — drop it from the baseline.`)
}
console.log(bad ? `\n${bad} site(s) drifted.` : '\nok — nothing off the line that was not already recorded.')
process.exit(bad ? 3 : 0)
