// THE ARCHIVE IS THE DEFAULT FOR EVERY HARNESS, AND THE FILE THAT SAYS SO IS READ
// BY A SHELL THAT SWALLOWS ITS OWN MISTAKES.
//
// THE OWNER'S RULING, 7 September: "why don't you use the backup instead for
// seeding? … save it in your claude.md to use it for all tests." ALL tests. The
// branch was written into `run-controls.sh` alone, and CLAUDE.md was written as
// though every harness had it — "every harness in that directory picks the archive
// up with no flags at all — `make controls`, `make sheet-drag`, `make typescale`"
// — while five of the six went on calling `seed.mjs` unconditionally. A promise in
// a document is not a code path, and nothing failed.
//
// AND EVERY WAY THE CONFIGURATION FAILED TO LOAD FAILED TOWARDS SEEDING, which is
// the worst direction: a harness with no archive seeds and says so on its first
// line, so "there is no archive here" and "the line naming the archive was
// dropped" print the same sentence. Four of those, all real:
//
//   NO TRAILING NEWLINE — `read` returns false on a final line without one,
//   having read it, so `while read` discarded whichever variable came last.
//   `export FOO=bar` — a line that is a shell setting, unmatched by an allowlist
//   written as `FOO=*`.
//   A QUOTED VALUE — the quotes stayed in the path, so the file did not exist.
//   CRLF — the value ended in a carriage return, same result.
//
// WHY A TEST AND NOT A RUN. Answering "does `make typescale` take the archive"
// by running it is a build, a restore and a browser — minutes, per harness, per
// question. The two things worth asking are static: does every harness that seeds
// go through the one shared decision first, and does the parser read a file a
// person plausibly wrote. Both answer in milliseconds.
//
// WHAT A TEST WRITER NEEDS TO KNOW: `scratch_prefer_archive` (in
// `scratch-server.sh`) is the shared decision — it re-enters through
// `run-with-backup.sh` and never returns when an archive is configured;
// `backup-env.sh` is the parser and reads `backup.env` from its OWN directory,
// which is what lets this file test it against a temp copy. `backup.env` itself is
// gitignored and holds somebody's credentials: nothing here reads the real one.

import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const REPO = join(process.env.TIPPANI_SRC, '..', '..', '..')
const SHOTS = join(REPO, 'scripts', 'screenshots')

const read = (name) => readFileSync(join(SHOTS, name), 'utf8')
// Comments do not run, and the branch is described in prose in several of these.
const code = (name) => read(name).split('\n').filter((l) => !/^\s*#/.test(l)).join('\n')

const runners = readdirSync(SHOTS).filter((f) => /^run-.*\.sh$/.test(f))

describe('every harness that fills a library prefers the archive', () => {
  it('finds the harnesses at all', () => {
    // A LIST THAT COMES BACK EMPTY PASSES EVERY CASE BELOW. This is the floor
    // under the walk — the failure mode `one-walk.test.js` was written for.
    expect(runners.length, 'no run-*.sh found; the walk is looking in the wrong place')
      .toBeGreaterThanOrEqual(7)
  })

  it('and each of them goes through the one shared decision', () => {
    // WHICHEVER HARNESS SEEDS. `run-with-backup.sh` is the restore itself and
    // does not choose; everything else that puts a library into an account has to
    // ask for the archive first.
    const seeds = runners.filter((f) => f !== 'run-with-backup.sh' && /\bseed\.mjs\b/.test(code(f)))
    expect(seeds.length, 'no harness seeds, so this case is measuring nothing').toBeGreaterThanOrEqual(6)
    for (const f of seeds) {
      expect(code(f), `${f} seeds without ever asking for the archive`).toMatch(/scratch_prefer_archive/)
    }
  })

  it('and asks before it builds or boots anything', () => {
    // THE ORDER MATTERS AND IS NOT COSMETIC: the archive path boots its own
    // server, so a harness that has already started one leaks it — the mistake
    // `scratch-server.sh` was written for, after four orphaned servers and nine
    // data dirs holding a restored copy of somebody's library.
    const asking = runners.filter((x) => /scratch_prefer_archive/.test(code(x)))
    // A LOOP OVER AN EMPTY LIST PASSES. The case above would already have failed
    // in that world, but a guard that depends on another guard's failure to mean
    // anything is one rename away from meaning nothing.
    expect(asking.length, 'no harness asks for the archive at all, so this case is iterating nothing')
      .toBeGreaterThanOrEqual(6)
    for (const f of asking) {
      const lines = code(f).split('\n')
      const ask = lines.findIndex((l) => /scratch_prefer_archive/.test(l))
      const boot = lines.findIndex((l) => /"\$BIN" serve|go build -o/.test(l))
      expect(ask, `${f} builds or boots before it asks for the archive`).toBeLessThan(boot)
    }
  })

  it('and none of them reads TIPPANI_BACKUP at all', () => {
    // The repo's directive: "a control drawn by one component on two screens has
    // ONE behaviour, and it lives in one function that both screens call — not in
    // a line each, which is how one of them goes on being right while the other
    // quietly stops." Six copies of this branch is six chances for that.
    //
    // THE PROPERTY, NOT THE SPELLING. The first version of this matched the exact
    // punctuation of the branch it replaced — `if [ -n "${TIPPANI_BACKUP:-}" ]` —
    // and a rater put `if [ -n "$TIPPANI_BACKUP" ]` into `run-hero-control.sh` and
    // watched it stay green. There are a dozen ways to ask that question in shell
    // and only one of them was forbidden, which is not a rule, it is a filter.
    //
    // So: a runner may not MENTION the variable. Deciding which library to use is
    // `scratch_prefer_archive`'s and the restore is `run-with-backup.sh`'s; a
    // runner that names it is either duplicating the decision or reading it for
    // something the shared function should be doing. `run-with-backup.sh` is the
    // restore itself and is excepted by name.
    const RESTORER = 'run-with-backup.sh'
    for (const f of runners) {
      if (f === RESTORER) continue
      const hits = (code(f).match(/TIPPANI_BACKUP\w*/g) || [])
      expect(hits, `${f} reads ${hits.join(', ')} itself instead of leaving that to scratch_prefer_archive`)
        .toEqual([])
    }
    // AND THE EXCEPTION IS NOT VACUOUS: the restorer really does read it, so a
    // rename that emptied this check would be caught here rather than passing.
    expect(code(RESTORER).match(/TIPPANI_BACKUP\w*/g) || [],
      `${RESTORER} no longer reads the archive it exists to restore`).not.toEqual([])
  })
})

describe('and every probe signs in as whoever the run configured', () => {
  // THE HALF THAT MADE THE OTHER HALF USELESS. Wiring six harnesses to the archive
  // achieves nothing if their probes then sign in as `screenshot-bot`, which a
  // restored library has never heard of: `ensureSession` gets a 401 and spends
  // thirty seconds in `waitForFunction` before dying with a timeout that says
  // nothing about accounts. Measured, on the first run of the newly-wired
  // `make sheet-drag`: "TimeoutError: Waiting failed: 30000ms exceeded".
  //
  // The override was one line in `controls.mjs`, which is why `make controls`
  // reached the archive and nothing else did.
  // COMMENTS DO NOT RUN, and the argument for this rule is written beside the two
  // lines it replaced — so a check over raw text finds the prose that explains the
  // fix and calls it the defect.
  const js = (name) => read(name).replace(/\/\*[\s\S]*?\*\//g, '').split('\n')
    .filter((l) => !/^\s*\/\//.test(l)).join('\n')
  const probes = readdirSync(SHOTS).filter((f) => f.endsWith('.mjs') && /HARNESS_ACCOUNT/.test(read(f)))

  it('finds the probes at all', () => {
    expect(probes.length, 'no probe imports the harness account; the walk is looking in the wrong place')
      .toBeGreaterThanOrEqual(6)
  })

  it('and the account is decided in exactly one file', () => {
    const own = probes.filter((f) => f !== 'capture.mjs' && /TIPPANI_USER|TIPPANI_PASS/.test(js(f)))
    expect(own, `${own.join(', ')} reads TIPPANI_USER itself, so every other probe goes on signing in as the bot`)
      .toEqual([])
  })

  it('and that file lets the environment win', () => {
    const src = js('capture.mjs')
    expect(src, 'HARNESS_ACCOUNT ignores the environment, so a restored archive is unreachable')
      .toMatch(/HARNESS_ACCOUNT = \{[\s\S]*?process\.env\.TIPPANI_USER[\s\S]*?process\.env\.TIPPANI_PASS[\s\S]*?\}/)
  })
})

// A crafted backup.env beside a copy of the parser, sourced, with the four names
// printed back. Nothing reads the real file.
function parse(contents) {
  const dir = mkdtempSync(join(tmpdir(), 'benv-'))
  try {
    copyFileSync(join(SHOTS, 'backup-env.sh'), join(dir, 'backup-env.sh'))
    writeFileSync(join(dir, 'backup.env'), contents)
    const out = spawnSync('bash', ['-c',
      `set -euo pipefail; . "${dir}/backup-env.sh"; backup_env_load; `
      + 'printf "%s\\n%s\\n%s\\n%s\\n" "${TIPPANI_BACKUP:-}" "${TIPPANI_BACKUP_PASSWORD:-}" '
      + '"${TIPPANI_BACKUP_USER:-}" "${TIPPANI_BACKUP_PASS:-}"',
    ], { encoding: 'utf8', env: { PATH: process.env.PATH } })
    expect(out.status, out.stderr).toBe(0)
    const [archive, password, user, pass] = out.stdout.split('\n')
    return { archive, password, user, pass }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

describe('the file that says where the archive is', () => {
  it('reads the ordinary shape', () => {
    const got = parse('TIPPANI_BACKUP=/lib/a.tpbk\nTIPPANI_BACKUP_PASSWORD=hunter2\nTIPPANI_BACKUP_USER=Aro\nTIPPANI_BACKUP_PASS=pw\n')
    expect(got).toEqual({ archive: '/lib/a.tpbk', password: 'hunter2', user: 'Aro', pass: 'pw' })
  })

  it('and a file that does not end in a newline keeps its last line', () => {
    // An editor that saves without a trailing newline dropped whichever variable
    // came last — silently, and the run seeded.
    const got = parse('TIPPANI_BACKUP=/lib/a.tpbk\nTIPPANI_BACKUP_PASSWORD=hunter2')
    expect(got.password, 'the last line of a file with no trailing newline was dropped').toBe('hunter2')
  })

  it('and an export prefix is still a setting', () => {
    const got = parse('export TIPPANI_BACKUP=/lib/a.tpbk\n')
    expect(got.archive).toBe('/lib/a.tpbk')
  })

  it('and an indented line is still a setting', () => {
    const got = parse('  TIPPANI_BACKUP=/lib/a.tpbk\n\texport TIPPANI_BACKUP_USER=Aro\n')
    expect(got.archive).toBe('/lib/a.tpbk')
    expect(got.user).toBe('Aro')
  })

  it('and a quoted path is the path, not the quotes', () => {
    // A path with a space in it has to be quotable, and the quotes are not part
    // of the path — so the file did not exist and the harness seeded.
    expect(parse('TIPPANI_BACKUP="/lib/my library.tpbk"\n').archive).toBe('/lib/my library.tpbk')
    expect(parse("TIPPANI_BACKUP='/lib/my library.tpbk'\n").archive).toBe('/lib/my library.tpbk')
  })

  it('and a file written on Windows loses its carriage returns', () => {
    const got = parse('TIPPANI_BACKUP=/lib/a.tpbk\r\nTIPPANI_BACKUP_PASSWORD=hunter2\r\n')
    expect(got.archive, 'a CRLF file left a carriage return in the path').toBe('/lib/a.tpbk')
    expect(got.password).toBe('hunter2')
  })

  it('and a passphrase may contain the characters a passphrase contains', () => {
    // Only a MATCHING outer pair is stripped. Nothing else about the value is
    // interpreted: an unbalanced quote, an inner quote and a `#` are all part of
    // the passphrase, and a passphrase this file mangles is a restore that fails
    // with "wrong password".
    expect(parse('TIPPANI_BACKUP_PASSWORD=a"b\n').password).toBe('a"b')
    expect(parse("TIPPANI_BACKUP_PASSWORD=it's\n").password).toBe("it's")
    expect(parse('TIPPANI_BACKUP_PASSWORD=a b # c\n').password).toBe('a b # c')
    expect(parse('TIPPANI_BACKUP_PASSWORD="\n').password).toBe('"')
  })

  it('and reads nothing but the four names it is for', () => {
    // A stray line in that file may not set anything else in a shell that is
    // about to run a browser as root.
    const got = parse('PATH=/nowhere\nTIPPANI_BACKUP=/lib/a.tpbk\nHOME=/tmp/x\nTIPPANI_OTHER=1\n')
    expect(got.archive).toBe('/lib/a.tpbk')
    const out = spawnSync('bash', ['-c', 'echo "${TIPPANI_OTHER:-clean}"'], { encoding: 'utf8' })
    expect(out.stdout.trim()).toBe('clean')
  })

  it('and a missing file is not an error', () => {
    // A machine with no archive is the normal case, not a broken one.
    const dir = mkdtempSync(join(tmpdir(), 'benv-'))
    try {
      copyFileSync(join(SHOTS, 'backup-env.sh'), join(dir, 'backup-env.sh'))
      const out = spawnSync('bash', ['-c',
        `set -euo pipefail; . "${dir}/backup-env.sh"; backup_env_load; echo "${'$'}{TIPPANI_BACKUP:-none}"`,
      ], { encoding: 'utf8', env: { PATH: process.env.PATH } })
      expect(out.status, out.stderr).toBe(0)
      expect(out.stdout.trim()).toBe('none')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('and an environment already set wins, so a one-off run can override the file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'benv-'))
    try {
      copyFileSync(join(SHOTS, 'backup-env.sh'), join(dir, 'backup-env.sh'))
      writeFileSync(join(dir, 'backup.env'), 'TIPPANI_BACKUP=/lib/from-file.tpbk\n')
      const out = spawnSync('bash', ['-c',
        `set -euo pipefail; . "${dir}/backup-env.sh"; backup_env_load; echo "${'$'}TIPPANI_BACKUP"`,
      ], { encoding: 'utf8', env: { PATH: process.env.PATH, TIPPANI_BACKUP: '/lib/from-env.tpbk' } })
      expect(out.status, out.stderr).toBe(0)
      expect(out.stdout.trim()).toBe('/lib/from-env.tpbk')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
