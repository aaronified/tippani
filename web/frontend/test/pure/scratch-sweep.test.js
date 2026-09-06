// THE HARNESS'S SWEEP TELLS AN ORPHAN FROM A CONCURRENT RUN.
//
// WHY THIS IS TESTED AT ALL, when nothing else in scripts/screenshots/ is. Those
// scripts restore SOMEBODY'S REAL LIBRARY into a `mktemp -d` — the archive is
// sealed on disk and not in that directory — so a directory the harness fails to
// remove is a decrypted copy of a person's library sitting in /tmp. Nine of them
// were found once. The cleanup was written seven times, fixed in one, and the
// remaining hole is the one this file measures.
//
// THE HOLE. `trap … EXIT` never fires for a run stopped with a SIGKILL, so the
// server outlives its shell and goes on holding `tippani.db` open. The sweep
// skipped any directory `fuser` called in use — which is exactly that directory,
// for exactly that reason. The port guard only surfaces it when the NEXT run
// happens to want the same port; on any other port it is invisible and permanent.
//
// THE RULE, which is what these cases ask: a scratch directory is swept when the
// only things holding it are the harness's OWN servers with no shell left above
// them, and is left alone otherwise. "Ours" is the binary's path — the run
// scripts build it into a mktemp of its own; "no shell above it" is a parent of
// PID 1, because an orphan is reparented to init and a concurrent run's server
// still has its `run-*.sh`.
//
// WHAT A TEST WRITER NEEDS TO KNOW: the paragraph above, that the function lives
// in `scripts/screenshots/scratch-server.sh` and is sourced by every `run-*.sh`,
// and that it sweeps `${TMPDIR:-/tmp}` — which is what lets these cases point it
// at a directory of their own and never near a real one.

import { execFileSync, spawn } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const SWEEP = join(process.env.TIPPANI_SRC, '..', '..', '..', 'scripts', 'screenshots', 'scratch-server.sh')

let root
const spawned = []

// A stand-in for the scratch server: a real executable — `/proc/<pid>/exe`
// resolves a script to its INTERPRETER, so a shell script called `tippani`
// would look like bash and the case could never pass — holding the database
// open the way a running server does.
//
// AND IT HOLDS IT WITH NO CHILD PROCESS, which the first cut of this fixture did
// not. A `while :; do sleep 1; done` loop spawns a `sleep` that INHERITS the open
// descriptor, so `fuser` named two holders, one of them /usr/bin/sleep, and the
// sweep quite correctly declined to touch a directory something foreign was in.
// The real server is a single Go process. Blocking on a fifo nobody writes to
// keeps this one single too.
function hold(dbPath, { ours = true, orphan = true } = {}) {
  const binDir = mkdtempSync(join(root, 'tmp.bin'))
  const exe = join(binDir, ours ? 'tippani' : 'something-else')
  copyFileSync('/bin/bash', exe)
  const gate = join(binDir, 'gate')
  execFileSync('mkfifo', [gate])
  const argv = [exe, '-c', 'exec 9<"$0"; exec 8<>"$1"; read -u 8', dbPath, gate]
  const p = orphan
    ? spawn('setsid', argv, { stdio: 'ignore', detached: true })
    : spawn(argv[0], argv.slice(1), { stdio: 'ignore' })
  spawned.push(p)
  return p
}

// The holder is what we wait for, not the spawner: `setsid` forks and exits, so
// its own pid says nothing about whether the child has opened the file yet.
function holderPids(dbPath) {
  try {
    return String(execFileSync('fuser', [dbPath], { stdio: ['ignore', 'pipe', 'ignore'] }))
      .trim().split(/\s+/).filter((s) => /^\d+$/.test(s))
  } catch { return [] }
}

async function waitForHold(dbPath) {
  for (let i = 0; i < 60; i++) {
    if (holderPids(dbPath).length) return true
    await new Promise((r) => setTimeout(r, 100))
  }
  return false
}

function sweep() {
  return String(execFileSync('bash', ['-c', `. "${SWEEP}"; scratch_sweep`],
    { env: { ...process.env, TMPDIR: root }, stdio: ['ignore', 'pipe', 'pipe'] }))
}

function scratchDir(name) {
  const d = join(root, `tmp.${name}`)
  mkdirSync(d)
  writeFileSync(join(d, 'tippani.db'), 'not really a database')
  return d
}

beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'sweep-case-')) })
afterEach(() => {
  for (const p of spawned.splice(0)) {
    for (const pid of [p.pid, -p.pid]) { try { process.kill(pid, 'SIGKILL') } catch { /* already gone */ } }
  }
  rmSync(root, { recursive: true, force: true })
})

describe('the scratch sweep', () => {
  it('removes a directory nothing is holding, which is what a SIGKILL leaves', () => {
    const d = scratchDir('dead')
    sweep()
    expect(existsSync(d), 'a scratch dir with no reader left in it survived the sweep').toBe(false)
  }, 30000)

  it('removes a directory whose only holder is one of ours with no shell above it', async () => {
    const d = scratchDir('orphaned')
    hold(join(d, 'tippani.db'), { ours: true, orphan: true })
    expect(await waitForHold(join(d, 'tippani.db')), 'the fixture never opened the database').toBe(true)

    sweep()
    expect(existsSync(d),
      'an orphaned scratch server kept somebody\'s restored library on disk — this is the leak the sweep exists for')
      .toBe(false)
    expect(holderPids(join(d, 'tippani.db')), 'the orphan is still running').toEqual([])
  }, 30000)

  it('leaves a directory a CONCURRENT run is serving, shell and all', async () => {
    const d = scratchDir('concurrent')
    hold(join(d, 'tippani.db'), { ours: true, orphan: false })
    expect(await waitForHold(join(d, 'tippani.db')), 'the fixture never opened the database').toBe(true)

    sweep()
    expect(existsSync(d),
      'the sweep deleted a live run\'s data dir out from under it — a run at another port is a normal thing to be doing')
      .toBe(true)
  }, 30000)

  it('leaves a directory something that is NOT ours is reading, orphan or not', async () => {
    const d = scratchDir('foreign')
    hold(join(d, 'tippani.db'), { ours: false, orphan: true })
    expect(await waitForHold(join(d, 'tippani.db')), 'the fixture never opened the database').toBe(true)

    sweep()
    expect(existsSync(d),
      'the sweep stopped and deleted a process it has no claim over — "ours" is the binary the run scripts build')
      .toBe(true)
  }, 30000)
})
