#!/usr/bin/env node
// Checks that the browser's backup-archive header parser agrees with the Go one.
//
// WHY THIS EXISTS. web/frontend/src/secret.js reads the first ~300 bytes of a
// chosen .tpbk file to decide which credential the restore dialog should ask for:
// a password (and whose), a passphrase, or a typed RESTORE. It does that by FIXED
// BYTE OFFSETS into a binary format defined in Go, in another language, in another
// directory, with no shared schema between them — and this app has no frontend test
// runner at all, so nothing else in CI would notice the day they disagree.
//
// The failure is not a crash. A mis-parsed header yields a plausible-looking
// account name made of ciphertext, which the dialog then prints and posts. It went
// wrong exactly that way once already: the v2 format was first drafted with the key
// wraps INSERTED before the ident rather than appended after it, which would have
// left every restore prompt asking for the password of an account named in mojibake.
// The format now keeps the v1 prefix byte-for-byte for that reason, and this script
// is what holds it there.
//
//   node scripts/archive-header-check.mjs
//
// It builds headers from the constants secret.js exports, asserts the parser reads
// back what was put in, and asserts it REFUSES what it cannot understand — an
// unknown version must report "unknown", never a guess. No dependencies, and none
// wanted: it runs on a bare `node`.

import { readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const GO = join(ROOT, 'internal', 'httpapi', 'backup_crypto.go')

// pathToFileURL, not a bare path: a Windows path starts "C:\\", which the ESM
// loader reads as a URL scheme and refuses outright.
const {
  sniffArchiveKey,
  ARCHIVE_MAGIC,
  ARCHIVE_V2,
  ARCHIVE_PREFIX_FIXED,
  ARCHIVE_IDENT_MAX,
  ARCHIVE_WRAP_LEN,
  ARCHIVE_HEADER_MAX,
} = await import(pathToFileURL(join(ROOT, 'web', 'frontend', 'src', 'secret.js')).href)

let failed = 0
function check(what, cond, detail = '') {
  if (cond) return
  failed++
  console.error(`archive-header-check: FAIL ${what}${detail ? ` — ${detail}` : ''}`)
}

// ---- the Go side is the authority; read its constants rather than restate them --
// If someone changes a length in Go and not here, this is what notices.
const go = readFileSync(GO, 'utf8')
function goConst(name) {
  const m = go.match(new RegExp(`^\\s*${name}\\s*=\\s*([0-9]+)`, 'm'))
  if (!m) throw new Error(`could not find ${name} in backup_crypto.go`)
  return Number(m[1])
}
const SALT = goConst('backupSaltLen')
const NONCE = goConst('backupNonceLen')
const KEYLEN = goConst('backupKeyLen')
const IDENT_MAX = goConst('backupIdentMax')
const V2 = goConst('backupCryptoV2')
const WRAP = NONCE + KEYLEN + 16 // backupWrapLen, spelled out in Go as a sum

check('the version constant agrees with Go', ARCHIVE_V2 === V2, `js ${ARCHIVE_V2}, go ${V2}`)
check('the ident cap agrees with Go', ARCHIVE_IDENT_MAX === IDENT_MAX, `js ${ARCHIVE_IDENT_MAX}, go ${IDENT_MAX}`)
check('the wrap length agrees with Go', ARCHIVE_WRAP_LEN === WRAP, `js ${ARCHIVE_WRAP_LEN}, go ${WRAP}`)
// The read window must reach the LAST field of the LARGEST possible header, or a
// long account name pushes the recovery wrap out of view and it reads as absent.
check(
  'the read window covers a maximal header',
  ARCHIVE_HEADER_MAX >= ARCHIVE_PREFIX_FIXED + IDENT_MAX + 2 * (2 + WRAP),
  `window ${ARCHIVE_HEADER_MAX}, need ${ARCHIVE_PREFIX_FIXED + IDENT_MAX + 2 * (2 + WRAP)}`,
)
check(
  'the fixed prefix length agrees with Go',
  ARCHIVE_PREFIX_FIXED === 4 + 1 + 1 + SALT + NONCE + 2,
  `js ${ARCHIVE_PREFIX_FIXED}, go ${4 + 1 + 1 + SALT + NONCE + 2}`,
)

// ---- build a header the way newBackupEncWriter does ---------------------------
function header({ version = V2, mode = 1, account = 'alice', withRecWrap = true } = {}) {
  const ident = new TextEncoder().encode(account)
  const bytes = []
  for (const c of ARCHIVE_MAGIC) bytes.push(c.charCodeAt(0))
  bytes.push(version, mode)
  for (let i = 0; i < SALT; i++) bytes.push((i * 7 + 1) & 0xff)
  for (let i = 0; i < NONCE; i++) bytes.push((i * 11 + 2) & 0xff)
  bytes.push((ident.length >> 8) & 0xff, ident.length & 0xff)
  bytes.push(...ident)
  // kwLen || keyWrap — always present.
  bytes.push((WRAP >> 8) & 0xff, WRAP & 0xff)
  for (let i = 0; i < WRAP; i++) bytes.push((i * 13 + 3) & 0xff)
  // rwLen || recWrap — absent (0) for a passphrase archive.
  const rw = withRecWrap ? WRAP : 0
  bytes.push((rw >> 8) & 0xff, rw & 0xff)
  for (let i = 0; i < rw; i++) bytes.push((i * 17 + 5) & 0xff)
  return new Uint8Array(bytes)
}

// The parser takes a File; a Blob is enough for slice() + arrayBuffer().
const asFile = (u8) => new Blob([u8])

// ---- what it must read correctly ---------------------------------------------
let r = await sniffArchiveKey(asFile(header()))
check('a password archive reports key=password', r.key === 'password', JSON.stringify(r))
check('it reads the account label back', r.account === 'alice', JSON.stringify(r))
check('it sees the recovery wrap', r.recoverable === true, JSON.stringify(r))

r = await sniffArchiveKey(asFile(header({ withRecWrap: false })))
check('no recovery wrap is reported as such', r.key === 'password' && !r.recoverable, JSON.stringify(r))

r = await sniffArchiveKey(asFile(header({ mode: 2, account: '' })))
check('a passphrase archive reports key=passphrase', r.key === 'passphrase', JSON.stringify(r))

// A long name is where an off-by-one in the ident offsets would show up, and where
// too small a read window would truncate.
const longName = 'a'.repeat(IDENT_MAX)
r = await sniffArchiveKey(asFile(header({ account: longName })))
check('a maximum-length account name survives', r.account === longName, `got ${r.account?.length} chars`)
check('and its recovery wrap is still found', r.recoverable === true, JSON.stringify(r))

// A multi-byte name must not be cut mid-rune by a byte-length slice.
r = await sniffArchiveKey(asFile(header({ account: 'ইন্দ্রাণী' })))
check('a non-Latin account name decodes', r.account === 'ইন্দ্রাণী', JSON.stringify(r))

// ---- what it must REFUSE, rather than guess ----------------------------------
r = await sniffArchiveKey(asFile(header({ version: 1 })))
check('v1 is not parsed by the v2 reader', r.key === 'unknown', JSON.stringify(r))

r = await sniffArchiveKey(asFile(header({ version: 99 })))
check('a future version reports unknown', r.key === 'unknown', JSON.stringify(r))

r = await sniffArchiveKey(asFile(header({ mode: 7 })))
check('an unknown key mode reports unknown', r.key === 'unknown', JSON.stringify(r))

// A plain gzip file is a pre-1.4.1 archive: no key, confirmed by typing RESTORE.
r = await sniffArchiveKey(asFile(new Uint8Array([0x1f, 0x8b, 0x08, 0x00, 0, 0, 0, 0, 0, 0])))
check('plain gzip reports key=none', r.key === 'none', JSON.stringify(r))

// Something far too short must not throw or read past its end.
r = await sniffArchiveKey(asFile(new Uint8Array([0x54, 0x50])))
check('a two-byte file is handled', r.key === 'none', JSON.stringify(r))

// A hostile identLen must not be believed.
const hostile = header()
hostile[34] = 0xff
hostile[35] = 0xff
r = await sniffArchiveKey(asFile(hostile))
check('an over-long identLen is refused', r.key === 'unknown', JSON.stringify(r))

if (failed) {
  console.error(`archive-header-check: ${failed} check(s) failed`)
  process.exit(1)
}
console.log('archive-header-check: ok — the browser and Go agree on the archive header')
