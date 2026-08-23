#!/usr/bin/env node
// What web/dist was built from, recorded so the staleness question has an answer
// that does not require a build.
//
// THE FAILURE THIS EXISTS FOR. web/dist is a committed artefact and the rule has
// always been "a frontend change ships with the rebuilt dist in the same commit".
// CI enforced it the only way it could — rebuild, then `git diff --exit-code --
// web/dist` — and that guard works. It caught the first commit after v2.1.3 and
// turned main red.
//
// But the commit it caught did not touch web/frontend at all. It edited
// internal/i18n/en.txt and bn.txt, which src/i18n.js imports across the tree
// boundary with Vite's `?raw` (i18n.js says why at length). Every user-facing
// string in the SPA comes from those two files, so editing one changes the bundle
// — and nothing about editing a .txt file inside a Go package suggests you have
// just changed the frontend. The author had no reason to run `make frontend`, the
// documented rule did not cover them, and the first thing to notice was CI, after
// the merge, six minutes later.
//
// So the input set is WIDER than the directory the rule names, and that is the
// part worth fixing rather than the one stale artefact. This script writes the
// set down — every path, with its hash — and web/dist_inputs_test.go checks it
// during `go test ./...`, which is a thing everybody already runs and needs no
// Node, no build and no hook installed. A locale edit now goes red on the next
// test run, in the working tree, before the commit exists.
//
// DERIVED, NOT LISTED, for the paths outside web/frontend: the script reads
// src/** and finds the imports that escape the directory. A hand-kept list is the
// same class of bug one level up — the next cross-boundary import would be
// missing from it and nothing would say so.
//
//   node scripts/dist-inputs.mjs            write web/dist-inputs.json
//   node scripts/dist-inputs.mjs --check    verify it; non-zero if stale
//
// `npm run build` runs the write, so the manifest cannot be forgotten by anyone
// who rebuilds dist by any of the routes that rebuild it (make frontend, the
// Dockerfile's frontend stage, CI).
//
// No dependencies, and none wanted: it runs on a bare `node` in a workflow
// container and in a node:alpine build stage.

import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative, resolve, sep } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const MANIFEST = 'web/dist-inputs.json'
const CHECK = process.argv.includes('--check')

// The SPA's own tree, split by how it is read. Trees are walked so a file added
// under either one is an input the moment it exists; files are named because the
// rest of web/frontend is not an input at all — test/ and vitest.config.js are
// the test runner's, and node_modules is the lockfile's business, not a hash's.
const TREES = ['web/frontend/src', 'web/frontend/public']
const FILES = [
  'web/frontend/index.html',
  'web/frontend/package.json',
  // The lockfile, not the tree it installs. Every dependency here is a caret
  // range and the bundle carries their bytes — @fontsource alone is eighteen
  // packages of embedded font. Hashing node_modules would be tens of thousands
  // of files to say what one file already pins, and the Dockerfile's comment
  // explains what an unlocked install cost this app once already.
  'web/frontend/package-lock.json',
  'web/frontend/vite.config.js',
]

// Editor and Finder droppings. Skipped on BOTH sides — here and in the Go check
// — because they are the one thing that can differ between the machine that
// wrote the manifest and the machine that verifies it. A .DS_Store hashed into
// the manifest on a Mac is a file CI does not have, and the check would fail on
// a dist that is correct.
const JUNK = new Set(['.DS_Store', 'Thumbs.db'])

const slash = (p) => p.split(sep).join('/')

function walk(rel, out) {
  for (const e of readdirSync(join(ROOT, rel), { withFileTypes: true })) {
    if (JUNK.has(e.name)) continue
    const p = `${rel}/${e.name}`
    if (e.isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}

// The imports that leave web/frontend. Regex over the source rather than a real
// module graph: the only escapes are `?raw` asset imports (two, both locale
// files), a resolver would need the bundler, and a specifier this misses is one
// no bundler would resolve either.
const SPECIFIER = /(?:^|[^\w$])(?:import|from)\s*\(?\s*['"]([^'"]+)['"]/g

function escapingImports(srcFiles) {
  const inside = resolve(ROOT, 'web/frontend')
  const found = new Set()
  for (const f of srcFiles) {
    const text = readFileSync(join(ROOT, f), 'utf8')
    for (const [, spec] of text.matchAll(SPECIFIER)) {
      if (!spec.startsWith('.')) continue // a package, not a path
      const target = resolve(dirname(join(ROOT, f)), spec.split('?')[0])
      if (target === inside || target.startsWith(inside + sep)) continue
      found.add(slash(relative(ROOT, target)))
    }
  }
  return [...found]
}

const trees = TREES.map((t) => walk(t, [])).flat()
// The derived escapes join the named files rather than sitting in a list of their
// own: `files` is then the complete answer to "what outside src/ and public/ does
// the bundle read", and internal/i18n/en.txt appears in it by name — which is the
// fact that was missing from every place a person might have looked.
const named = [...new Set([...FILES, ...escapingImports(trees)])].sort()
const paths = [...new Set([...trees, ...named])].sort()

const sha256 = {}
for (const p of paths) sha256[p] = createHash('sha256').update(readFileSync(join(ROOT, p))).digest('hex')

const manifest = {
  note:
    'What web/dist was built from. Written by `npm run build` (scripts/dist-inputs.mjs); ' +
    'checked by TestDistWasBuiltFromTheseInputs in web/. Do not hand-edit — run `make frontend`.',
  trees: TREES,
  files: named,
  sha256,
}
const rendered = JSON.stringify(manifest, null, 2) + '\n'

if (!CHECK) {
  writeFileSync(join(ROOT, MANIFEST), rendered)
  console.log(`${MANIFEST} written — ${paths.length} inputs`)
  process.exit(0)
}

let committed
try {
  committed = JSON.parse(readFileSync(join(ROOT, MANIFEST), 'utf8'))
} catch (err) {
  console.error(`${MANIFEST} is missing or unreadable (${err.message}). Run \`make frontend\`.`)
  process.exit(1)
}

const was = committed.sha256 || {}
const gone = Object.keys(was).filter((p) => !(p in sha256))
const added = paths.filter((p) => !(p in was))
const changed = paths.filter((p) => p in was && was[p] !== sha256[p])

if (!gone.length && !added.length && !changed.length) {
  console.log(`${MANIFEST} up to date — ${paths.length} inputs, all hashes match`)
  process.exit(0)
}

console.error('web/dist is stale: it was built before these inputs reached their current state.\n')
for (const [label, list] of [
  ['changed since the build', changed],
  ['added since the build', added],
  ['gone since the build', gone],
]) {
  if (list.length) console.error(`  ${label}:\n${list.map((p) => `    ${p}`).join('\n')}`)
}
console.error('\nRun `make frontend` and commit web/dist and web/dist-inputs.json with your change.')
process.exit(1)
