#!/usr/bin/env node
// Keeps DEVELOPMENT.md's "Where things live" map honest, in the two ways it goes wrong.
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
// Only three kinds of thing are REQUIRED to appear, and they are the three where being
// absent from the map actively misleads: a package under internal/, a script, a workflow.
// Files inside a package are not required — that is the inventory this deliberately
// is not.
//
//   node scripts/doc-map-check.mjs            check; non-zero on any problem
//   node scripts/doc-map-check.mjs --warn     report and exit 0 (local use)
//
// No dependencies, and none wanted: it runs on a bare `node` in a workflow container.

import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DOC = 'DEVELOPMENT.md'
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
// the bare basename once its section has introduced the directory.
const named = (p) => {
  const bare = p.replace(/\/$/, '')
  return text.includes(bare) || text.includes(bare.split('/').pop())
}
const missing = required.filter((p) => !named(p))

for (const p of stale) console.error(`${DOC}: names \`${p}\`, which matches nothing in the tree`)
for (const p of missing) console.error(`${DOC}: never mentions ${p}`)

if (!stale.length && !missing.length) {
  console.log(
    `${DOC} up to date — ${claims.length} paths named and all resolve, ` +
      `${required.length} packages/scripts/workflows all covered`,
  )
  process.exit(0)
}
console.error(`${DOC}: ${stale.length} stale, ${missing.length} uncovered`)
process.exit(WARN ? 0 : 1)
