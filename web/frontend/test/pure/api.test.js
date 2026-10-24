import { afterAll, describe, expect, it, vi } from 'vitest'
import { blobFromDataURL } from '../../src/api.js'
import { patchMovesTheRow } from '../../src/works.jsx'
import { annotationState, bookState } from '../../src/Library.jsx'
import { dialogueState, movieState } from '../../src/Movies.jsx'
import { utteranceState } from '../../src/Quotes.jsx'
import { fullState } from '../../src/WorkDetails.jsx'
import { RESTART_SAME, RESTART_TIMEOUT, waitForRestart } from '../../src/update.js'
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ARCHIVE_MAGIC, PASSWORD_MAX, PASSWORD_MIN, passwordProblem, sniffArchiveKey } from '../../src/secret.js'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'

// A data: URL turned into bytes without fetch (src/api.js). The function is the observable unit
// here: it exists because a browser, under this app's CSP, refuses fetch(data:...), so what it
// must get right is the bytes and the type.
describe('blob from data url', () => {
  const bytesOf = async (blob) => new Uint8Array(await blob.arrayBuffer())

  describe('a data: URL as a Blob', () => {
    it('decodes base64 to the same bytes, under the type it names', async () => {
      const blob = blobFromDataURL('data:image/png;base64,iVBORw0KGgo=')
      expect(blob.type).toBe('image/png')
      expect([...(await bytesOf(blob))]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    })
  })
})

// When a one-field save has to refetch the board, and when it must not.
//
// WHY THIS IS WORTH ITS OWN FILE. Hearting a quote is the most frequent thing
// anybody does in this app, and it cost two serialised round trips: a PUT whose
// reply already carried the updated row, and then a full GET of every row on the
// board to learn what the reply had just said. On a phone over a VPN that is the
// difference the owner reported as "terribly unresponsive" — and the release that
// went looking for it concluded there was exactly one duplicate read and named a
// different one.
//
// It lives in works.jsx — "what books and films share" — because all THREE boards
// need it and one of them was left out the first time, which is how the film
// board kept its extra round trip for a release after the other two lost theirs.
//
// The reason it could not simply be deleted is the other half: the filters are
// applied by the SERVER. Un-hearting a row while the favourites filter is on has
// to take it off the board, and splicing the reply back in would leave it sitting
// there looking saved and wrong. So the rule is a rule about the filters in force,
// and it is exported rather than buried in a closure so it can be read.
describe('patch refetch', () => {
  describe('and with the filter that reads it', () => {
    it('moves the row, so the board is refetched', () => {
      expect(patchMovesTheRow({ favorite: false }, { fav: true })).toBe(true)
      expect(patchMovesTheRow({ color: 'blue' }, { color: 'pink' })).toBe(true)
      expect(patchMovesTheRow({ tags: [] }, { tag: 'grief' })).toBe(true)
    })
  })
})

// Every PUT in this app is full-state, so a field missing from the object a card
// saves is a field that request CLEARS.
//
// THIS IS A TEST FOR A BUG THAT WAS LIVE, not for a feature that is new.
// `annotationState` did not carry `character` from the release that added the
// column (0047) until 0051, which meant that recolouring a highlight — or
// hearting it, or dragging its sticker, or touching it from the selection bar —
// quietly threw away who said the line. `dialogueState` lost an episode's title
// and a game line's act and quest the same way. Nothing noticed, because every
// one of those saves answers 200 and the field it dropped was one the form
// showing it never had a box for.
//
// utteranceState has carried a comment saying "AND THIS IS A SILENT-LOSS SITE"
// since 0035 and has been correct ever since. The comment was not enough; the
// difference between that kind and the other two is that somebody wrote the
// sentence down on one of them. So this is the sentence as a test.
//
// WHY A LIST AND NOT INTROSPECTION. There is nothing on this side of the wire to
// introspect: the server's shape is the authority, and a browser test cannot ask
// it. So the list below is a hand-kept mirror of what each kind stores — which is
// exactly what makes it useful, because adding a column to the API and NOT
// arriving here is the failure, and the next person to add one has to come and
// argue with this file.
describe('full state put', () => {
  // A LIST PER KIND, not one function. A book is saved by two different builders —
  // bookState for the ♥ and the shelf, fullState for the Details panel — and they
  // are written out separately in two files. Checking one and not the other leaves
  // the other free to drift, which is how they came to disagree in the first place.
  const STATE = {
    annotation: [annotationState],
    dialogue: [dialogueState],
    quote: [utteranceState],
    book: [bookState, (r) => fullState('book', r)],
    movie: [movieState, (r) => fullState('movie', r)],
  }

  describe('the translation reaches every kind (0051)', () => {
    it('is carried by all three, since a recolour must not erase it', () => {
      // The three QUOTE kinds. A book and a film have no translation column —
      // 0051 put it on the quote, not on the work it came from.
      for (const kind of ['annotation', 'dialogue', 'quote']) {
        const body = STATE[kind][0]({ quote: 'x', translation: 'what it says' })
        expect(body.translation, `${kind} drops the translation`).toBe('what it says')
      }
    })
  })
})

// Waiting for the box to come back — the decision table, and the case that had
// this screen stuck three times.
//
// WHY THIS FILE EXISTS AT ALL is the point of it. The wait ran as twenty lines
// inside a click handler in Settings.jsx, which is why two earlier fixes shipped
// on the strength of "it looked right": the only way to exercise it was to update
// a real container and watch a real page. Both attempts left the page stuck on
// "updating & restarting…" and neither had a test that could have said so.
//
// The clock, the sleep and the ping are all injected, so six minutes of waiting
// runs in under a millisecond and "the server never answers" is one line.
describe('update wait', () => {
  // A fake clock that only moves when something sleeps on it. Nothing here waits on
  // wall time, so a six-minute window is exercised in full at no cost — and a loop
  // that fails to advance the clock hangs the test rather than passing quietly.
  function fakeClock() {
    let t = 1_000_000
    return {
      now: () => t,
      sleep: (ms) => {
        t += ms
        return Promise.resolve()
      },
    }
  }

  // A scripted server: one entry per poll, replayed in order, last entry repeating.
  // `null` means the poll never comes back at all — a pending promise, which is the
  // shape of the bug rather than a rejection.
  function scripted(script) {
    let i = 0
    return () => {
      const step = script[Math.min(i++, script.length - 1)]
      if (step === null) return new Promise(() => {}) // never settles, ever
      return Promise.resolve(step)
    }
  }

  const up = (version) => ({ ok: true, version })
  const gone = { ok: false }

  describe('waiting for the box to come back', () => {
    it('ENDS even when every poll hangs for ever', async () => {
      // THE THIRD BUG, and the one this file was written for. fetch has no timeout
      // of its own, and a socket that is accepted and never answered leaves the
      // promise pending rather than rejecting — which is exactly what Docker's port
      // proxy offers while the container behind it is being recreated. The old loop
      // counted turns, so one pending poll stopped it counting: the page sat on
      // "updating & restarting…" for ever, on the server itself as readily as from
      // another device.
      //
      // If this ever regresses, the test does not fail — it HANGS, which is the
      // honest reproduction of the defect.
      const c = fakeClock()
      const out = await waitForRestart({
        ping: scripted([null]),
        sleep: c.sleep,
        now: c.now,
        was: '3.0.0',
        windowMs: 60_000,
      })
      expect(out.outcome).toBe(RESTART_TIMEOUT)
    })

    it('says so when it restarted onto the SAME build', async () => {
      // A branch tag can move without its image being rebuilt: pull, recreate,
      // same version. The reader is told that rather than reloaded onto what they
      // already had and left to compare two strings themselves.
      const c = fakeClock()
      const out = await waitForRestart({
        ping: scripted([up('3.0.0'), gone, gone, up('3.0.0')]),
        sleep: c.sleep,
        now: c.now,
        was: '3.0.0',
      })
      expect(out.outcome).toBe(RESTART_SAME)
    })
  })
})

// secret.js — the backup-archive header parser, and the password/passphrase
// shape rules, both checked against the Go source that defines them.
//
// WHY THIS FILE EXISTS. src/secret.js reads the first few hundred bytes of a
// chosen .tpbk file to decide which credential the restore dialog should ask
// for: a password (and whose), a passphrase, or a typed RESTORE. It does that by
// FIXED BYTE OFFSETS into a binary format defined in Go, in another language, in
// another directory, with no shared schema between them.
//
// The failure mode is not a crash. A mis-parsed header yields a plausible-looking
// account name made of ciphertext, which the dialog then prints and posts. It
// went wrong exactly that way once already: v2 was first drafted with the key
// wraps INSERTED before the ident rather than appended after it, which would have
// left every restore prompt asking for the password of an account named in
// mojibake. The format keeps the v1 prefix byte-for-byte for that reason, and
// this file is what holds it there.
//
// This began as scripts/archive-header-check.mjs, a bare-node script run from CI
// because the frontend had no test runner. It has one now, so the check lives
// here — but the part that made the script worth having survives intact: it does
// not RESTATE the Go constants, it READS them out of the Go source and asserts
// the two languages agree. The `pure` project runs in the node environment, so
// node:fs is available and that trick still works. If someone changes a length in
// Go and not here, this is what notices.
describe('archive header', () => {
  // test/pure -> test -> frontend -> web -> repo root.
  const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..')
  const GO = {
    'backup_crypto.go': readFileSync(join(ROOT, 'internal', 'httpapi', 'backup_crypto.go'), 'utf8'),
    'auth_handlers.go': readFileSync(join(ROOT, 'internal', 'httpapi', 'auth_handlers.go'), 'utf8'),
  }

  // goRHS finds a Go constant's right-hand side in either file. The leading
  // `[\t ]*` is what keeps comment lines out: a line beginning `// backupIdentMax`
  // cannot match, so prose that happens to quote a constant is never read as one.
  // A miss THROWS rather than returning a default — a Go rename must break this
  // suite loudly, not quietly downgrade it into a check of nothing.
  function goRHS(name) {
    const re = new RegExp(`^[\\t ]*${name}\\b[^=\\n]*=[\\t ]*([^\\n/]+)`, 'm')
    for (const [file, src] of Object.entries(GO)) {
      const m = src.match(re)
      if (m) return { file, rhs: m[1].trim() }
    }
    throw new Error(`no Go constant named ${name} in ${Object.keys(GO).join(' or ')}`)
  }

  // goNumber resolves a numeric constant, following additive expressions through
  // the constants they name. Go spells two of these as sums —
  //
  //   backupWrapLen     = backupNonceLen + backupKeyLen + 16
  //   backupPrefixFixed = 4 + 1 + 1 + backupSaltLen + backupNonceLen + 2
  //
  // — and the original script hand-copied those sums into JS, which is the one
  // place it still restated Go rather than reading it. Evaluating them here closes
  // that gap: change the shape of a wrap in Go and this arithmetic follows.
  //
  // `seen` is copied down each branch rather than shared across them, and the
  // difference is not academic. Shared, the set accumulates every name already
  // resolved anywhere in the expression, so a sum that names the same constant
  // TWICE — `backupNonceLen + backupNonceLen + ...`, which is exactly how you would
  // spell a wrap that carried two nonces — is misread as a cycle and throws
  // "defined in terms of itself". That failure lands on a Go change that is
  // perfectly legal and may not even alter the value, and it takes the whole file
  // down at import, so every other check in it disappears at the same time. Copying
  // keeps the guard that matters (a name reached from itself, down one chain, still
  // throws) and drops the false positive.
  function goNumber(name, seen = new Set()) {
    if (seen.has(name)) throw new Error(`Go constant ${name} is defined in terms of itself`)
    const branch = new Set(seen).add(name)
    return goRHS(name)
      .rhs.split('+')
      .map((term) => {
        const t = term.trim()
        if (/^\d+$/.test(t)) return Number(t)
        if (/^[A-Za-z_]\w*$/.test(t)) return goNumber(t, branch)
        throw new Error(`cannot evaluate Go constant ${name}: unsupported term ${JSON.stringify(t)}`)
      })
      .reduce((a, b) => a + b, 0)
  }

  function goString(name) {
    const { rhs } = goRHS(name)
    const m = rhs.match(/^"([^"]*)"/)
    if (!m) throw new Error(`Go constant ${name} is not a string literal: ${rhs}`)
    return m[1]
  }

  const MAGIC = goString('backupMagic')
  const V1 = goNumber('backupCryptoV1')
  const V2 = goNumber('backupCryptoV2')
  const MODE_PASSWORD = goNumber('backupModePassword')
  const SALT = goNumber('backupSaltLen')
  const NONCE = goNumber('backupNonceLen')
  const WRAP = goNumber('backupWrapLen')

  // ---- building headers the way newBackupEncWriter does -----------------------

  // The filler bytes are a fixed non-zero pattern rather than zeros or randoms.
  // Zeros would let a read at the wrong offset still look like a plausible empty
  // field; randoms would make a failure unreproducible. A stride means a
  // mis-offset read lands on a value that is wrong in a way you can see.
  const filler = (n, a, b) => Array.from({ length: n }, (_, i) => (i * a + b) & 0xff)

  function header({
    version = V2,
    mode = MODE_PASSWORD,
    account = 'alice',
    // identLen forges a length that LIES about the ident that follows it — the
    // only way to reach the malformed-header branch from a well-formed writer.
    identLen = null,
    withRecWrap = true,
  } = {}) {
    const ident = new TextEncoder().encode(account)
    const declared = identLen === null ? ident.length : identLen
    const bytes = []
    for (const c of ARCHIVE_MAGIC) bytes.push(c.charCodeAt(0))
    bytes.push(version, mode)
    bytes.push(...filler(SALT, 7, 1))
    bytes.push(...filler(NONCE, 11, 2))
    bytes.push((declared >> 8) & 0xff, declared & 0xff)
    bytes.push(...ident)
    // kwLen || keyWrap — always present, in both modes.
    bytes.push((WRAP >> 8) & 0xff, WRAP & 0xff)
    bytes.push(...filler(WRAP, 13, 3))
    // rwLen || recWrap — absent (length 0) for a passphrase archive, and for an
    // instance that has no recovery key.
    const rw = withRecWrap ? WRAP : 0
    bytes.push((rw >> 8) & 0xff, rw & 0xff)
    bytes.push(...filler(rw, 17, 5))
    return new Uint8Array(bytes)
  }

  // sniffArchiveKey takes a File; a Blob is enough for the slice() + arrayBuffer()
  // it actually uses, and node has had both as globals since 18.
  const asFile = (u8) => new Blob([u8])
  const sniff = (u8) => sniffArchiveKey(asFile(u8))

  describe('reading a well-formed header', () => {
    it('reports a password archive, whose it is, and that it is recoverable', async () => {
      expect(await sniff(header())).toEqual({ key: 'password', account: 'alice', recoverable: true })
    })
  })

  describe('refusing what it cannot read, rather than guessing', () => {
    it('reports a future version as unknown instead of reading it anyway', async () => {
      for (const version of [0, 3, 99, 0xff]) {
        expect(await sniff(header({ version }))).toEqual({ key: 'unknown' })
      }
    })
  })

  // ---- the shape a password or passphrase has to have -------------------------
  //
  // The server is the authority here too, and for the same reason the header is:
  // getting these bounds wrong in the browser means a field that greys out Save
  // for a password the server would have taken, or — worse — lets one through that
  // the server then refuses with a 400 after the form has been filled in.

  describe('passwordProblem', () => {
    // Lengths are built FROM the Go numbers, not from literals, so the boundary
    // moves with the server rather than needing to be found again by hand.
    const at = (n) => 'a'.repeat(n)

    it('refuses one character either side of those bounds', () => {
      expect(passwordProblem(at(PASSWORD_MIN - 1))).toBe(`Password must be at least ${PASSWORD_MIN} characters`)
      expect(passwordProblem(at(PASSWORD_MAX + 1))).toBe(`Password must be at most ${PASSWORD_MAX} characters`)
    })
  })
})

// THE JOURNEYS JOB'S SANDBOX PROBE NAMES EVERY OUTCOME RIGHTLY.
//
// scripts/sandbox-probe.sh starts Chrome with its setuid fallback off, then on if
// the first start found no sandbox, and says which one Chrome rests on. It was
// written into ci.yml and rewritten three times (9cc0d685, cba26beb, ba2552f0),
// and each time a rater found an outcome it named wrong by writing a stub Chrome
// by hand, the last a misconfigured setuid helper read as "not the sandbox". So
// the outcomes are cases here, run against a stub, and what is asserted is what a
// maintainer reads on the run page: the annotation, and whether the job fails.
//
// It knows the script's command line and its two settings (CHROME_PATH and
// SANDBOX_PROBE_TIMEOUT), and Chrome's own messages, which the stub prints.
describe('sandbox probe', () => {
const REPO = join(process.env.TIPPANI_SRC, '..', '..', '..')
const SCRIPT = join(REPO, 'scripts', 'sandbox-probe.sh')

// A Chrome that behaves as told: M1 is the start with the setuid fallback off,
// M2 the one with it allowed.
const dir = mkdtempSync(join(tmpdir(), 'sandbox-probe-'))
const CHROME = join(dir, 'chrome')
writeFileSync(CHROME, `#!/usr/bin/env bash
case "$*" in *--disable-setuid-sandbox*) m=$M1;; *) m=$M2;; esac
case $m in
  ok) exit 0;;
  nosb) echo "FATAL:zygote_host_impl_linux.cc(128)] No usable sandbox!" >&2; exit 133;;
  suidbad) echo "FATAL:setuid_sandbox_host.cc(163)] The SUID sandbox helper binary was found, but is not configured correctly." >&2; exit 133;;
  hang) sleep 30;;
  other) echo "boom" >&2; exit 7;;
  silent) exit 9;;
esac
`)
chmodSync(CHROME, 0o755)
afterAll(() => rmSync(dir, { recursive: true, force: true }))

function probe(m1, m2 = 'ok') {
  const r = spawnSync('bash', [SCRIPT], {
    encoding: 'utf8',
    env: { ...process.env, CHROME_PATH: CHROME, SANDBOX_PROBE_TIMEOUT: '1', M1: m1, M2: m2 },
  })
  return { code: r.status, out: r.stdout + r.stderr }
}

describe('the sandbox probe', () => {
  const cases = [
    ['ok', 'x', 0, /the namespace sandbox starts/],
    ['nosb', 'ok', 0, /::warning::the namespace sandbox does not start here; Chrome started on its setuid chrome-sandbox/],
    ['nosb', 'hang', 1, /::error::.*did not finish within 1s, so whether that sandbox works is unknown/],
    ['nosb', 'nosb', 1, /::error::neither sandbox starts: no user namespace, and no chrome-sandbox helper/],
    ['nosb', 'suidbad', 1, /::error::neither sandbox starts: no user namespace, and the chrome-sandbox helper is missing or not owned by root/],
    ['nosb', 'other', 1, /::error::.*exited 7 for a reason it did not name as the sandbox/],
    ['nosb', 'silent', 1, /::error::.*exited 9 for a reason it did not name as the sandbox/],
    ['hang', 'x', 0, /::warning::the sandbox probe did not finish within 1s, so it says nothing about the sandbox/],
    ['silent', 'x', 0, /::warning::the sandbox probe exited 9 for a reason other than the sandbox/],
    ['other', 'x', 0, /boom[\s\S]*::warning::the sandbox probe exited 7 for a reason other than the sandbox/],
  ]
  for (const [m1, m2, code, says] of cases) {
    it(`first start ${m1}, fallback ${m2}: exits ${code} and says so`, () => {
      const r = probe(m1, m2)
      expect(r.out).toMatch(says)
      expect(r.code, r.out).toBe(code)
    })
  }
})
})
