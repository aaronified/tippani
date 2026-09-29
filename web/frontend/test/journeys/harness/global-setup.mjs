// BUILT ONCE, SEEDED ONCE, COPIED FIFTEEN TIMES.
//
// The expensive parts of a journey run are compiling the app and filling a
// library, and neither is the thing under test. Both happen here, in the main
// process, before a single worker starts:
//
//   1. `go build` the real binary. Not `go run`, which recompiles per invocation.
//      It embeds the SPA the tree's sources build, which is not always the one in
//      web/dist: see spaOverlay.
//   2. Boot it once against an empty directory and replay the fixture through the
//      PUBLIC API — the same endpoints the SPA calls, so a fixture the API would
//      have refused never becomes a library a journey can see.
//   3. Stop it cleanly, so SQLite has flushed, and keep that directory.
//
// Each journey file then copies the directory and boots its own server against
// the copy. See server.mjs for why the isolation is per file.
//
// IT SEEDS THE CURATED FIXTURE, NOT THE SCREENSHOT SCAFFOLD'S. The difference
// that matters is artwork: seed.mjs FETCHES its covers, every image request in
// this container comes back 403, so its library has none — and CLAUDE.md is
// explicit that a fixture with no artwork hides a class of defect, a poster
// behind a medium glyph among them, reported from a real phone and never
// reproducible here. The curated fixture carries its images as committed files,
// so a journey can finally see one.
//
// It also carries the shapes that catch things: a 70-character title, a
// 2,375-character quote, eleven cast rows, three writing systems, and a show with
// six lines for the bulk season and episode journey to work on. See
// scripts/journeys/curate-fixture.mjs for where all of that came from and what
// was kept out of it.

import { spawn } from 'node:child_process'
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import { seedFixture } from './seed-fixture.mjs'
import { startServer } from './server.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = join(HERE, '..', '..', '..', '..', '..')
const FRONTEND = join(REPO, 'web', 'frontend')
const DIST = join(REPO, 'web', 'dist')

export const ACCOUNT = { username: 'journey-reader', password: 'journey-reader-pw' }

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], ...opts })
    let out = ''
    p.stdout.on('data', (b) => { out += b })
    p.stderr.on('data', (b) => { out += b })
    p.on('error', reject)
    p.on('exit', (code) => (code === 0
      ? resolve(out)
      : reject(new Error(`${cmd} ${args.join(' ')} exited ${code}:\n${out}`))))
  })
}

// refuseDevelopmentReact fails the run when the bundle it was handed is React's
// development build. The sentence below is one only the development build carries
// (measured: once in a NODE_ENV=test build, never in a production one), so a regression
// of the env line above stops the journeys at setup instead of letting them pass on a
// React nobody ships. IT LEANS ON REACT'S WORDING: if a React upgrade rewords that
// warning, the guard finds nothing in either build and goes quiet rather than red. A
// React bump is the time to check it still fires on a NODE_ENV=test build.
const DEVELOPMENT_ONLY = 'Each child in a list should have a unique'
async function refuseDevelopmentReact(dir) {
  for (const f of await filesUnder(dir)) {
    if (!f.endsWith('.js')) continue
    if ((await readFile(f, 'utf8')).includes(DEVELOPMENT_ONLY)) {
      throw new Error(`journeys: ${relative(dir, f)} is React's development build; the harness must build what ships (NODE_ENV=production)`)
    }
  }
}

async function filesUnder(dir) {
  const out = []
  for (const e of await readdir(dir, { withFileTypes: true, recursive: true })) {
    if (e.isFile()) out.push(join(e.parentPath, e.name))
  }
  return out
}

// THE SPA THE TREE WOULD BUILD, NOT THE ONE LAST COMMITTED. The binary embeds
// web/dist, and web/dist is rebuilt once per push (CLAUDE.md), so between two
// rebuilds it is the SPA of the last push: a journey run then drives the old
// screens against the new server, and a green run says nothing about a screen
// changed since. It did, for the whole of 3.1.0's Settings › Jobs work: the
// tier stayed green driving the browser loops those screens had given up.
//
// So when web/dist-inputs.json no longer matches the sources
// (scripts/dist-inputs.mjs --check, the question `go test` asks), the SPA is
// built into this run's own directory and handed to `go build` as an overlay
// over web/dist: every committed file taken out, every built one put in its
// place. web/dist itself is never written. A rebuilt web/dist in the working
// tree would be one `git add` from a commit between rebuilds, and it would turn
// the stale-dist check green over a dist nobody meant to ship.
//
// Rejected: a flag or an environment variable telling the server to serve the
// SPA from a directory. It would be a way for the app to serve files other than
// the ones it was built with, added so a test can do it.
//
// Returns the overlay's path, or null when web/dist is current and the binary
// can embed it as it is. Either way the run says which it is on, since "which
// bundle did these journeys drive" is the first question about a result.
async function spaOverlay(binDir) {
  try {
    await run(process.execPath, ['scripts/dist-inputs.mjs', '--check'], { cwd: REPO })
    console.log('journeys: web/dist is current for its sources, and the binary embeds it')
    return null
  } catch {
    // Stale, or no manifest: build the SPA the sources describe.
  }
  const built = join(binDir, 'dist')
  // NODE_ENV=production, SAID OUTRIGHT (#48). vitest runs this setup with NODE_ENV=test,
  // the build inherits it, and vite then bundles React's development build: a branch's
  // journeys ran a different React from the one that ships, with its warnings and its
  // timing. `vite build` alone does not override an inherited NODE_ENV.
  await run(process.execPath, [join(FRONTEND, 'node_modules', 'vite', 'bin', 'vite.js'), 'build', '--outDir', built, '--emptyOutDir'],
    { cwd: FRONTEND, env: { ...process.env, NODE_ENV: 'production' } })
  await refuseDevelopmentReact(built)
  const replace = {}
  for (const f of await filesUnder(DIST)) replace[f] = ''
  for (const f of await filesUnder(built)) replace[join(DIST, relative(built, f))] = f
  const overlay = join(binDir, 'overlay.json')
  await writeFile(overlay, JSON.stringify({ Replace: replace }))
  console.log('journeys: web/dist is behind its sources, so the binary embeds a fresh build of the SPA (web/dist is not touched)')
  return overlay
}

export default async function setup() {
  const binDir = await mkdtemp(join(tmpdir(), 'tippani-journey-bin-'))
  const binary = join(binDir, 'tippani')
  const overlay = await spaOverlay(binDir)
  await run('go', ['build', ...(overlay ? ['-overlay', overlay] : []), '-o', binary, './cmd/tippani'], { cwd: REPO })

  const server = await startServer({ binary, goldenData: null })
  const goldenData = server.data
  const cleanup = async () => {
    await rm(goldenData, { recursive: true, force: true })
    await rm(binDir, { recursive: true, force: true })
  }

  try {
    await seedFixture({ baseUrl: server.baseUrl, ...ACCOUNT })
  } catch (err) {
    await server.stop({ keepData: true })
    await cleanup()
    throw new Error(`the journey fixture would not seed:\n${err.message}`)
  }

  // STOPPED BEFORE IT IS COPIED, and that is not tidiness. A running server holds
  // an open write-ahead log, so a copy taken mid-flight is missing whatever had
  // not been checkpointed — intermittently, and differently each run. keepData
  // keeps the directory the copies come from.
  await server.stop({ keepData: true })

  // WORKERS INHERIT THIS ENV BECAUSE THEY ARE FORKED AFTER globalSetup RETURNS.
  // A journey that finds these unset is reading them from a worker that started
  // first, which would mean vitest changed when globalSetup runs — world.mjs
  // says so by name rather than failing on `undefined is not a path`.
  process.env.TIPPANI_JOURNEY_BINARY = binary
  process.env.TIPPANI_JOURNEY_GOLDEN = goldenData
  process.env.TIPPANI_JOURNEY_USER = ACCOUNT.username
  process.env.TIPPANI_JOURNEY_PASS = ACCOUNT.password

  return cleanup
}
