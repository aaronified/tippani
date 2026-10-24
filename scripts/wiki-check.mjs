#!/usr/bin/env node
// docs/wiki/ is published to the GitHub wiki by .github/workflows/wiki.yml, and a
// wiki is the one place a broken link costs the most: there is no build step
// between the file and the reader, so a dead link ships the moment it is pushed.
//
// THREE THINGS GO WRONG, AND THIS CATCHES ALL THREE. Every one was seen for real
// while the directory was being assembled:
//
//   1. A LINK THAT RESOLVES NOWHERE. Three of these existed the day the documents
//      moved in — `../DEVELOPMENT.md` from a file that was now a directory deeper,
//      `plans/` from one that used to sit beside it.
//   2. NAVIGATION POINTING AT A PAGE THAT DOES NOT EXIST. Home and _Sidebar were
//      written before the page set was settled and named eleven pages that were
//      never created. In the repo that is a dead relative link; in the wiki it is
//      a "create this page" invitation, which reads as a missing page rather than
//      a mistake.
//   3. A PAGE NOTHING LINKS TO. The wiki publishes it and no reader can find it —
//      the only symptom is silence, which is why a machine has to say it.
//
// It does NOT check the prose, and it does not check outbound URLs: a network call
// in CI fails on somebody else's outage rather than on this repository's mistake.

import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const WIKI = join(REPO, 'docs', 'wiki')

// GitHub derives a wiki page's name from its file name, so these two are the wiki's
// own furniture rather than pages: _Sidebar renders beside every page and _Footer
// under it. They are the navigation, so they are where reachability is measured
// from — never things that have to be reached.
const FURNITURE = new Set(['_Sidebar.md', '_Footer.md'])
const HOME = 'Home.md'

const pages = readdirSync(WIKI).filter((f) => f.endsWith('.md'))
const failures = []
let linksChecked = 0

// Markdown inline links, minus the bare-URL and image forms. The negative lookahead
// on `#` skips a same-page anchor, which has no file to resolve.
const LINK = /\]\(([^)\s#][^)\s]*?)\)/g

const linkedTo = new Set()
const outgoing = new Map() // page -> the pages it links to, for reachability

for (const page of pages) {
  const body = readFileSync(join(WIKI, page), 'utf8')
  for (const [, target] of body.matchAll(LINK)) {
    const path = target.split('#')[0].trim()
    if (!path || /^(https?:|mailto:)/.test(path)) continue
    linksChecked++
    if (!existsSync(join(WIKI, path))) {
      failures.push(`${page}: link to "${path}" resolves to nothing`)
      continue
    }
    if (!outgoing.has(page)) outgoing.set(page, new Set())
    outgoing.get(page).add(path)
  }
}

// REACHABLE FROM THE NAVIGATION, BY ANY NUMBER OF LINKS. A reader arrives on Home or in the sidebar
// and follows links; a page that no chain of links from either reaches is unreachable. It used to
// have to be linked from them directly, which a set of nine hundred decision records (one page each,
// listed in ADR-Index) cannot be.
const queue = [HOME, ...FURNITURE]
for (const start of queue) linkedTo.add(start)
while (queue.length) {
  const here = queue.pop()
  for (const next of outgoing.get(here) || []) {
    if (!linkedTo.has(next)) {
      linkedTo.add(next)
      queue.push(next)
    }
  }
}
for (const page of pages) {
  if (page === HOME || FURNITURE.has(page)) continue
  if (!linkedTo.has(page)) {
    failures.push(`${page}: no chain of links from ${HOME} or _Sidebar.md reaches it — the wiki would publish a page nobody can find`)
  }
}

for (const required of [HOME, '_Sidebar.md']) {
  if (!pages.includes(required)) failures.push(`docs/wiki/${required} is missing — the wiki has no front door`)
}

if (failures.length) {
  console.error(`docs/wiki: ${failures.length} problem(s)\n`)
  for (const f of failures) console.error(`  ${f}`)
  process.exit(1)
}

const reachable = pages.length - 1 - [...FURNITURE].filter((f) => pages.includes(f)).length
console.log(
  `docs/wiki up to date — ${pages.length} pages, ${linksChecked} internal links all resolve, ` +
    `${reachable} reachable from Home or the sidebar`,
)
