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

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { ARCHIVE_MAGIC, PASSPHRASE_MAX, PASSPHRASE_MIN, PASSWORD_MAX, PASSWORD_MIN, passphraseProblem, passwordProblem, sniffArchiveKey } from '../../src/secret.js'

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

describe('passphraseProblem', () => {
  const at = (n) => 'a'.repeat(n)

  it('refuses one character either side of those bounds', () => {
    expect(passphraseProblem(at(PASSPHRASE_MIN - 1))).toBe(
      `Passphrase must be at least ${PASSPHRASE_MIN} characters`,
    )
    expect(passphraseProblem(at(PASSPHRASE_MAX + 1))).toBe(
      `Passphrase must be at most ${PASSPHRASE_MAX} characters`,
    )
  })
})

