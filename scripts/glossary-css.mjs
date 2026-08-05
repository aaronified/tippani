#!/usr/bin/env node
// Refreshes the app CSS that docs/ui-glossary.html inlines.
//
// WHY THIS EXISTS. The glossary shows real components — a real .hand-card, a
// real .tp-btn — by inlining the built stylesheet into a <style id="appcss">
// block. That is what makes it honest: the samples are styled by the same rules
// the app runs on, not by a hand-copied approximation. It is also why it rots.
// Every `npm run build` emits web/dist/assets/index-<hash>.css under a new name,
// and a glossary written before a frontend change is a glossary showing the old
// look, silently. AI.md has called this out as the file most likely to be stale;
// this is the first half of the fix (ROADMAP §9 — the second half is generating
// the glossary's COPY from web/frontend/src/help.jsx too).
//
// What it does: finds the newest built index-*.css, rewrites its `assets/…` font
// URLs to the `../web/dist/assets/…` paths the glossary needs (it is served from
// docs/, one level up), and swaps it into the <style id="appcss"> block.
//
//   node scripts/glossary-css.mjs           refresh in place
//   node scripts/glossary-css.mjs --check   exit 1 if it is out of date (CI)
//
// No dependencies, and none wanted: it runs on a bare `node`.

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PAGE = join(ROOT, 'docs', 'ui-glossary.html')
const ASSETS = join(ROOT, 'web', 'dist', 'assets')
const CHECK = process.argv.includes('--check')

const OPEN = '<style id="appcss">'
const CLOSE = '</style>'

function fail(msg) {
  console.error(`glossary-css: ${msg}`)
  process.exit(1)
}

if (!existsSync(ASSETS)) fail('web/dist/assets is missing — run `npm run build` in web/frontend first')

// A build leaves exactly one index-*.css. Two means a dirty web/dist, and
// silently picking one of them is how the glossary would end up inlining CSS
// from a build nobody remembers making — so say it out loud instead of guessing.
const cssFiles = readdirSync(ASSETS).filter((f) => /^index-.*\.css$/.test(f))
if (!cssFiles.length) fail('no web/dist/assets/index-*.css — run `npm run build` in web/frontend first')
if (cssFiles.length > 1) {
  fail(`web/dist/assets holds ${cssFiles.length} index-*.css files (${cssFiles.join(', ')}) — clear web/dist and rebuild so there is one`)
}
const cssPath = join(ASSETS, cssFiles[0])

// Vite writes url(/assets/x.woff2) or url(assets/x.woff2) depending on `base`.
// The glossary sits in docs/, so both become ../web/dist/assets/….
const built = readFileSync(cssPath, 'utf8')
  .replace(/url\((["']?)\/?assets\//g, 'url($1../web/dist/assets/')

const page = readFileSync(PAGE, 'utf8')
const start = page.indexOf(OPEN)
if (start < 0) fail(`docs/ui-glossary.html has no ${OPEN} block`)
const bodyStart = start + OPEN.length
const end = page.indexOf(CLOSE, bodyStart)
if (end < 0) fail('the <style id="appcss"> block is never closed')

// Compare with line endings normalised. On Windows any tool that rewrites the
// page with newline translation turns the stylesheet's single trailing \n into
// \r\n, which is a one-byte difference that means nothing and would otherwise
// fail CI forever with a diff nobody can see.
const norm = (s) => s.replace(/\r\n/g, '\n')
const current = page.slice(bodyStart, end)
if (norm(current) === norm(built)) {
  console.log(`glossary-css: up to date (${cssFiles[0]}, ${built.length} bytes)`)
  process.exit(0)
}

if (CHECK) {
  console.error(
    `glossary-css: docs/ui-glossary.html inlines stale app CSS.\n` +
      `  inlined: ${current.length} bytes\n` +
      `  built:   ${built.length} bytes (${cssFiles[0]})\n` +
      `  fix: npm --prefix web/frontend run build && node scripts/glossary-css.mjs`,
  )
  process.exit(1)
}

const next = page.slice(0, bodyStart) + built + page.slice(end)
// Sanity before writing over a published page: the swap must not lose the rest
// of the document. Anything that shrinks it to a fraction is a bug, not an edit.
if (next.length < page.length - current.length - 1000) fail('refused to write — the rendered page collapsed')
writeFileSync(PAGE, next)
console.log(`glossary-css: refreshed from ${cssFiles[0]} (${current.length} → ${built.length} bytes)`)
