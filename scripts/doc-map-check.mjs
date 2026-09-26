#!/usr/bin/env node
// Keeps Developing.md's "Where things live" map honest in the two ways it goes wrong,
// and its CI table in step with ci.yml's jobs.
//
// It does NOT try to keep the document in sync with the code. The map is deliberately
// written at an altitude where syncing is unnecessary — patterns and chokepoints, not an
// inventory — and a script that demanded a row per file would force it down to the
// altitude that rots. These are the two failures altitude alone does not catch:
//
//   STALE   the map names a file that no longer exists. Every backticked path is a claim
//           about the tree, and a rename falsifies it silently: nothing errors, the
//           sentence just quietly becomes a lie.
//
//   MISSING a new package, script or workflow was added and the map never heard. This is
//           the real rot mode — not a deleted path, which someone eventually trips over,
//           but an added one, which is invisible forever because there is nothing to trip
//           on. A contributor's first question is "where does this go", and the answer is
//           wrong by omission.
//
// Only three kinds of thing are REQUIRED to appear in the map, and they are the three
// where being absent from it actively misleads: a package under internal/, a script, a
// workflow. Files inside a package are not required — that is the inventory this
// deliberately is not.
//
// And one more, one level down: every job under `jobs:` in ci.yml must have a row in
// the "Maintainer: CI" table, and every row there must be a job, because the workflow
// file being named says nothing about what is in it (see below).
//
//   node scripts/doc-map-check.mjs            check; non-zero on any problem
//   node scripts/doc-map-check.mjs --warn     report and exit 0 (local use); a broken
//                                             extractor still exits 2
//   node scripts/doc-map-check.mjs --root DIR check another tree (its test's fixtures)
//
// No dependencies, and none wanted: it runs on a bare `node` in a workflow container.

import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

// `--root DIR` points the check at another tree, which is how its own test runs it
// over a fixture; left out, it checks the repository this script is in.
const rootAt = process.argv.indexOf('--root')
const ROOT = rootAt > 0 ? resolve(process.argv[rootAt + 1]) : join(dirname(fileURLToPath(import.meta.url)), '..')
const DOC = 'docs/wiki/Developing.md'
const WARN = process.argv.includes('--warn')

// Directories with nothing to say about the source tree, or too much. Kept as entries so
// the map may still name them; only their contents are skipped. BY NAME for the ones that
// recur at any depth, BY PATH for the rest — `data` names both the runtime directory at
// the root, which is ignored, and docs/data, which is four files the map talks about.
const SKIP_NAME = new Set(['.git', 'node_modules'])
const SKIP_PATH = new Set(['bin', '_site', 'data', 'web/dist'])

// Build output and runtime state. The map names these because a contributor needs to know
// where a build lands and what is gitignored — but they do not exist in a fresh clone, and
// on a checkout that has never run `make build` this check would otherwise fail on the
// document being CORRECT. Found on the first CI run, on a machine that had built.
const MAY_BE_ABSENT = new Set(['bin', '_site', 'data', 'node_modules', 'web/dist'])

function walk(rel, out) {
  let entries
  try {
    entries = readdirSync(join(ROOT, rel || '.'), { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of entries) {
    const p = rel ? `${rel}/${e.name}` : e.name
    if (e.isDirectory()) {
      out.dirs.add(p)
      if (SKIP_NAME.has(e.name) || SKIP_PATH.has(p)) continue // keep it, drop its contents
      walk(p, out)
    } else {
      out.files.add(p)
    }
  }
  return out
}

const tree = walk('', { files: new Set(), dirs: new Set() })
for (const p of MAY_BE_ABSENT) tree.dirs.add(p)
const all = [...tree.files, ...tree.dirs]

const text = readFileSync(join(ROOT, DOC), 'utf8')
const ticked = [...new Set([...text.matchAll(/`([^`\n]+)`/g)].map((m) => m[1]))]

// A backticked span is only a CLAIM ABOUT THE TREE when it is unambiguously one. The
// document is full of things that read like paths and are not — a route (`/api/me`), a
// module (`modernc.org/sqlite`), a repo slug (`aaronified/tippani`), a placeholder
// (`NNNN_what_it_does.sql`). Every one of those, treated as a claim, produces a warning
// that is wrong, and a check that cries wolf is a check nobody runs.
const EXT = /\.(go|mjs|js|jsx|json|css|html|md|sql|yml|yaml|mod|sum|webp|svg|png|jpg)$/
const isClaim = (s) => {
  if (s.includes(' ') || s.includes('..') || s.includes('<') || s.includes('>')) return false
  if (s.startsWith('/') || s.startsWith('-') || s.includes('://')) return false
  if (/[A-Z]{3,}/.test(s.split('/').pop())) return false // NNNN_, ISSUE_TEMPLATE is a dir below
  if (/^[a-z0-9-]+\.[a-z]{2,}\//.test(s)) return false // a domain: modernc.org/sqlite
  // Either it names a file type, or it is explicitly marked a directory.
  return EXT.test(s.replace(/[*]+$/, '')) || s.endsWith('/')
}

// The map names files by the shortest name that is unambiguous in context — `server.go`
// under the internal/httpapi heading, `data/` under docs. So a claim resolves if it is a
// SUFFIX of any real path, on a segment boundary. A glob resolves if its literal part is.
const resolves = (claim) => {
  const c = claim.replace(/\/$/, '')
  if (c.includes('*')) {
    const lit = c.split('*')[0].replace(/\/$/, '')
    const tail = c.split('*').pop()
    return all.some((p) => (!lit || p.includes(lit)) && p.endsWith(tail))
  }
  return all.some((p) => p === c || p.endsWith(`/${c}`))
}

const claims = ticked.filter(isClaim)
const stale = claims.filter((c) => !resolves(c))

// What must be named somewhere in the document.
const under = (d, pick) =>
  [...tree.dirs, ...tree.files].filter((p) => p.startsWith(`${d}/`) && p.slice(d.length + 1).indexOf('/') < 0).filter(pick)

const required = [
  ...under('internal', (p) => tree.dirs.has(p)).map((p) => `${p}/`),
  ...under('scripts', (p) => p.endsWith('.mjs')),
  ...under('.github/workflows', (p) => p.endsWith('.yml')),
]

// Named in any form the document plausibly uses: full path, without a trailing slash, or
// the bare basename once its section has introduced the directory — `changelog-entry.mjs`
// and four workflows are referred to that way and would otherwise read as missing.
//
// A PACKAGE UNDER internal/ GETS NO BASENAME FALLBACK, and the reason is that it let one
// through. `internal/outbound/` was absent from this document entirely and the check passed
// `24 packages/scripts/workflows all covered`, because the word "outbound" appears six times
// in ordinary prose about outbound calls. Every other package here is named by its full path
// already, so requiring it costs nothing — and the packages most at risk are exactly the ones
// whose names are also English: search, store, auth, importer, updater, changelog.
const named = (p) => {
  const bare = p.replace(/\/$/, '')
  if (text.includes(bare)) return true
  if (bare.startsWith('internal/')) return false
  return text.includes(bare.split('/').pop())
}
const missing = required.filter((p) => !named(p))

// AND THE CI TABLE NAMES EVERY CI JOB. This document said "four jobs" while
// race-nightly (6869b0a1) and journeys (b0fa2f04) were added, and this check passed
// throughout: it asks for every workflow FILE and not for what is in one. The
// Maintainer: CI table is where someone reading a red run learns what a job is for,
// so a job it never names is the MISSING failure one level down. It reads the job
// keys by their indentation under `jobs:` and the table's rows by their first cell,
// in both directions: a job with no row, and a row for a job ci.yml no longer has.
// The `jobs:` block ends at the next line that starts in column 0 and is not a comment.
//
// WHICH SIDE IS WRONG DECIDES THE EXIT. Exit 2, the extractor, is for what this
// script failed to read: no jobs, a key line under `jobs:` that is not a job id, or
// no table under the heading at all. A table it can read that says something wrong
// is the document's fault, and is reported by line with the other document faults.
// That covers a row whose first cell is not one backticked job id, and a table with
// no delimiter row. It reads the section's FIRST table only, so a second table
// under the heading is prose, and the delimiter row is GFM's: one dash or more per
// cell, with optional colons.
const jobsText = (readFileSync(join(ROOT, '.github/workflows/ci.yml'), 'utf8').split(/^jobs:\s*$/m)[1] ?? '')
  .split(/^[^\s#]/m)[0]
const ciJobs = [...jobsText.matchAll(/^ {2}([A-Za-z_][A-Za-z0-9_-]*):[ \t]*(?:#.*)?$/gm)].map((m) => m[1])
const oddKeys = [...jobsText.matchAll(/^ {2}[^ #\r\n].*$/gm)].map((m) => m[0])
  .filter((l) => !/^ {2}[A-Za-z_][A-Za-z0-9_-]*:[ \t]*(?:#.*)?$/.test(l))
const docLines = text.split('\n')
const ciHead = docLines.findIndex((l) => /^## Maintainer: CI\s*$/.test(l))
const table = []
for (let i = ciHead + 1; ciHead >= 0 && i < docLines.length && !docLines[i].startsWith('## '); i++) {
  if (docLines[i].startsWith('|')) table.push({ n: i + 1, l: docLines[i] })
  else if (table.length) break
}
if (!ciJobs.length || oddKeys.length || !table.length) {
  console.error(`${DOC}: read ${ciJobs.length} job ids under jobs: in ci.yml, and ${table.length} table lines under ` +
    `"## Maintainer: CI" in ${DOC} — the extractor is broken`)
  for (const l of oddKeys) console.error(`  ci.yml: a key under jobs: that is not a job id: ${l.trim()}`)
  process.exit(2)
}
const [, delimiter, ...body] = table
// GFM's delimiter row: one or more dashes per cell, optional colons, and the last
// cell's closing pipe optional, as GitHub renders it either way.
const undelimited = !delimiter || !/^\|(\s*:?-+:?\s*\|)*\s*:?-+:?\s*\|?\s*$/.test(delimiter.l) ? [table[0].n] : []
const cells = (undelimited.length ? table.slice(1) : body).map(({ n, l }) => ({ n, l, id: /^\|\s*`([^`]+)`\s*\|/.exec(l)?.[1] }))
const rows = cells.map((c) => c.id).filter(Boolean)
const unread = cells.filter((c) => !c.id)
const unlisted = ciJobs.filter((j) => !rows.includes(j))
const gone = rows.filter((r) => !ciJobs.includes(r))

for (const p of stale) console.error(`${DOC}: names \`${p}\`, which matches nothing in the tree`)
for (const p of missing) console.error(`${DOC}: never mentions ${p}`)
for (const j of unlisted) console.error(`${DOC}: the CI table has no row for ci.yml's job \`${j}\``)
for (const r of gone) console.error(`${DOC}: the CI table has a row for \`${r}\`, which ci.yml has no job called`)
for (const n of undelimited) console.error(`${DOC}:${n}: the CI table has no delimiter row under its header, so it does not render as a table`)
for (const c of unread) console.error(`${DOC}:${c.n}: a CI table row whose first cell is not one backticked job id: ${c.l.slice(0, 80)}`)

const tableWrong = unlisted.length + gone.length + undelimited.length + unread.length
if (!stale.length && !missing.length && !tableWrong) {
  console.log(
    `${DOC} up to date — ${claims.length} paths named and all resolve, ` +
      `${required.length} packages/scripts/workflows all covered, ${ciJobs.length} CI jobs in the CI table`,
  )
  process.exit(0)
}
console.error(`${DOC}: ${stale.length} stale, ${missing.length} uncovered, ${tableWrong} CI table problems`)
process.exit(WARN ? 0 : 1)
