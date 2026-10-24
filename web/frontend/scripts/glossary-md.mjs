#!/usr/bin/env node
// Generates docs/wiki/UI-Glossary.md from the glossary catalogue.
//
// The glossary used to be docs/ui-glossary.html: one self-contained page that rendered every
// component beside its name, with the app's own stylesheet and a theme replayed from theme.js. It
// was a megabyte, it lived outside the wiki, and the half of it that mattered (what each thing is
// CALLED and what it DOES) is prose. The wiki holds all documentation, as Markdown, so the page is
// now the catalogue as text: a section per part of the interface, an entry per element with the
// file that defines it and what it does.
//
// WHAT STAYS GUARDED. The catalogue (scripts/glossary/catalogue.js) is still the one place the
// entries are written, glossary-registry.test.js still fails when a component gains no entry, and
// this page is generated from it so it cannot be retyped and drift. What goes is the rendered
// demos, which a screenshot in the app shows better than a markup copy ever did.
//
//   node scripts/glossary-md.mjs           write docs/wiki/UI-Glossary.md
//   node scripts/glossary-md.mjs --check   exit 1 if it is out of date (CI)
//
// No dependencies beyond the catalogue: it runs on a bare node.

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SECTIONS } from './glossary/catalogue.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const PAGE = join(ROOT, 'docs', 'wiki', 'UI-Glossary.md')
const CHECK = process.argv.includes('--check')

const ENT = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ', '&middot;': '·', '&mdash;': '—', '&ndash;': '–', '&rarr;': '→', '&hellip;': '…', '&le;': '≤', '&ge;': '≥', '&times;': '×', '&rsquo;': '’', '&lsquo;': '‘' }
const decode = (s) => s.replace(/&[a-z#0-9]+;/gi, (m) => ENT[m] ?? m)

// The catalogue's prose is a little carried markup: <code>, <b>, <i>, <a>, <br>, a list now and then.
function md(html) {
  let s = String(html || '')
  s = s.replace(/<code>([\s\S]*?)<\/code>/g, (_, t) => '`' + decode(t.replace(/<[^>]+>/g, '')) + '`')
  s = s.replace(/<(b|strong)>([\s\S]*?)<\/\1>/g, '**$2**')
  s = s.replace(/<(i|em)>([\s\S]*?)<\/\1>/g, '*$2*')
  s = s.replace(/<a [^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g, '[$2]($1)')
  s = s.replace(/<br\s*\/?>/g, '  \n')
  s = s.replace(/<li[^>]*>/g, '\n- ').replace(/<\/li>/g, '')
  s = s.replace(/<\/?(ul|ol|p|div)[^>]*>/g, '\n')
  s = s.replace(/<[^>]+>/g, '')
  return decode(s).replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
}

// A section title carries a version label as a span: "Shelf <span class="g-tlabel">1.3.0</span>".
const title = (t) => {
  const label = (t.match(/<span class="g-tlabel">([\s\S]*?)<\/span>/) || [])[1]
  const base = decode(t.replace(/<span[\s\S]*?<\/span>/g, '').replace(/<[^>]+>/g, '')).trim()
  return label ? `${base} (${decode(label.replace(/<[^>]+>/g, ''))})` : base
}

const out = [
  '# UI glossary',
  '',
  'Source of truth: this wiki page.',
  '',
  'What each part of the interface is called and what it does, so a conversation about it (or a bug report) can name the thing.',
  'It is generated from the glossary catalogue, `web/frontend/scripts/glossary/catalogue.js`, by `npm run glossary`, and a test fails',
  'when a component has no entry, so a rename or a new control updates this page or fails the build. Each entry names the file',
  'that defines it.',
  '',
]
const count = SECTIONS.reduce((n, s) => n + s.entries.length, 0)
out.push(`${count} entries in ${SECTIONS.length} sections.`, '')
for (const s of SECTIONS) {
  out.push(`## ${title(s.title)}`, '')
  const lede = md(s.lede)
  if (lede) out.push(lede, '')
  for (const e of s.entries) {
    out.push(`### ${title(e.name)}`, "")
    if (e.src) out.push(`*Defined in:* ${md(e.src).replace(/\n/g, ' ')}`, '')
    const desc = md(e.desc)
    if (desc) out.push(desc, '')
  }
}
out.push('See also: [Developing](Developing.md) · [Home](Home.md)', '')
const text = out.join('\n')

if (CHECK) {
  const have = existsSync(PAGE) ? readFileSync(PAGE, 'utf8') : ''
  if (have.replace(/\r\n/g, '\n') !== text) {
    console.error('glossary-md: docs/wiki/UI-Glossary.md is out of date — run `npm run glossary` and commit it')
    process.exit(1)
  }
  console.log('glossary-md: docs/wiki/UI-Glossary.md is up to date')
} else {
  writeFileSync(PAGE, text)
  console.log(`glossary-md: wrote docs/wiki/UI-Glossary.md — ${count} entries`)
}
