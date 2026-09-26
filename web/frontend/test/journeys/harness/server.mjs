// ONE REAL TIPPANI PER JOURNEY FILE: its own binary, its own data directory, its
// own port, its own browser. Nothing a journey does can reach another journey.
//
// WHY PER FILE AND NOT ONE SHARED SERVER. Journeys WRITE. One bulk-edits a
// season across four lines, one captures a highlight, one changes a setting that
// changes what every other screen draws. Share a server and the second file to
// run sees a library the first one edited — which is not a flaky test, it is a
// test whose result depends on file ordering, and vitest does not promise one.
//
// (The plan this came from gave a different reason — that
// handleOnboardRestoreUpload is gated on an empty users table, so a .tpbk restore
// brings its own account. True, and it stopped applying the moment the fixture
// became a recipe replayed through the API rather than an archive. The reason
// above is the one that survives, and it is the stronger one anyway.)
//
// AND THE SEEDING HAPPENS ONCE, NOT FIFTEEN TIMES. globalSetup builds the binary
// and seeds ONE golden data directory; each file COPIES it. A SQLite library is a
// directory of files, so a copy is milliseconds where replaying the fixture
// through the public API is seconds — fifteen files would have paid for the same
// library fifteen times. Same isolation, a fraction of the clock.
//
// THE SERVER RUNS WITH TIPPANI_OFFLINE=1. Otherwise adding a book provokes the
// app's own provider lookups, and which of them land first varies between runs —
// the drift CLAUDE.md records as the control ratchet reading 187 three times and
// 188 on the fourth with no change to the app. A journey that cannot be run twice
// with the same result is not a test.

import { spawn } from 'node:child_process'
import { cp, mkdtemp, rm } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// A PORT THE OS HANDS OUT, rather than one derived from the worker id. A worker
// id is stable within a run and says nothing about what else on the machine is
// listening — two runs at once, or a developer's own `make run` on 8080, and a
// derived port collides with something it cannot see. Binding to 0 asks the only
// authority that knows. The window between closing this and the server binding is
// real, which is why boot() retries rather than trusting the first answer.
function freePort() {
  return new Promise((resolve, reject) => {
    const s = createServer()
    s.on('error', reject)
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address()
      s.close((err) => (err ? reject(err) : resolve(port)))
    })
  })
}

// Asked with the app's own healthcheck — the same question ci.yml's smoke test
// asks, and it needs no tool that may not be installed.
function healthy(bin, bind) {
  return new Promise((resolve) => {
    const p = spawn(bin, ['healthcheck'], {
      env: { ...process.env, TIPPANI_BIND: bind },
      stdio: 'ignore',
    })
    p.on('exit', (code) => resolve(code === 0))
    p.on('error', () => resolve(false))
  })
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// `env` is how the operator configured this instance, for a journey about
// something only configuration turns on (a sign-on provider). It is added last,
// so a journey can see it did what it set.
export async function startServer({ binary, goldenData, offline = true, env = {} }) {
  const data = await mkdtemp(join(tmpdir(), 'tippani-journey-'))
  if (goldenData) await cp(goldenData, data, { recursive: true })

  for (let attempt = 0; attempt < 5; attempt++) {
    const port = await freePort()
    const bind = `127.0.0.1:${port}`
    const log = []
    const proc = spawn(binary, ['serve'], {
      env: {
        ...process.env,
        TIPPANI_DATA: data,
        TIPPANI_BIND: bind,
        ...(offline ? { TIPPANI_OFFLINE: '1' } : {}),
        ...env,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    // KEPT, NOT PRINTED. A journey that fails wants the server's side of the
    // story in its own failure message; a journey that passes wants silence.
    proc.stdout.on('data', (b) => log.push(String(b)))
    proc.stderr.on('data', (b) => log.push(String(b)))

    let died = false
    proc.on('exit', () => { died = true })

    let up = false
    for (let i = 0; i < 60 && !died; i++) {
      if (await healthy(binary, bind)) { up = true; break }
      await sleep(250)
    }
    if (up) {
      return {
        baseUrl: `http://${bind}`,
        data,
        log: () => log.join(''),
        // keepData is for the golden directory, which outlives the server that
        // filled it. Everything else wants the default: a journey's library is
        // a copy and must not survive the file that made it.
        async stop({ keepData = false } = {}) {
          proc.kill('SIGTERM')
          await new Promise((r) => {
            if (died) return r()
            proc.on('exit', r)
            setTimeout(() => { proc.kill('SIGKILL'); r() }, 5000)
          })
          if (!keepData) await rm(data, { recursive: true, force: true })
        },
      }
    }
    proc.kill('SIGKILL')
    // A port taken between freePort() and bind is the expected failure and is
    // worth one more try; anything else shows up as the same timeout, so the
    // last attempt reports what the server actually said.
    if (attempt === 4) {
      await rm(data, { recursive: true, force: true })
      throw new Error(`a journey server never became healthy on ${bind}:\n${log.join('') || '(it printed nothing)'}`)
    }
  }
  throw new Error('unreachable')
}
