// BUILT ONCE, SEEDED ONCE, COPIED FIFTEEN TIMES.
//
// The expensive parts of a journey run are compiling the app and filling a
// library, and neither is the thing under test. Both happen here, in the main
// process, before a single worker starts:
//
//   1. `go build` the real binary. Not `go run`, which recompiles per invocation.
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
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { seedFixture } from './seed-fixture.mjs'
import { startServer } from './server.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = join(HERE, '..', '..', '..', '..', '..')

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

export default async function setup() {
  const binDir = await mkdtemp(join(tmpdir(), 'tippani-journey-bin-'))
  const binary = join(binDir, 'tippani')
  await run('go', ['build', '-o', binary, './cmd/tippani'], { cwd: REPO })

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
