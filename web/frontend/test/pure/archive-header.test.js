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
import {
  ARCHIVE_HEADER_MAX,
  ARCHIVE_IDENT_MAX,
  ARCHIVE_MAGIC,
  ARCHIVE_PREFIX_FIXED,
  ARCHIVE_V2,
  ARCHIVE_WRAP_LEN,
  PASSPHRASE_MAX,
  PASSPHRASE_MIN,
  PASSWORD_MAX,
  PASSWORD_MIN,
  passphraseProblem,
  passwordProblem,
  secretProblem,
  sniffArchiveKey,
} from '../../src/secret.js'

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
const MODE_PASSPHRASE = goNumber('backupModePassphrase')
const SALT = goNumber('backupSaltLen')
const NONCE = goNumber('backupNonceLen')
const KEY = goNumber('backupKeyLen')
const IDENT_MAX = goNumber('backupIdentMax')
const WRAP = goNumber('backupWrapLen')
const PREFIX_FIXED = goNumber('backupPrefixFixed')

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

describe('the Go constants this parser was written against', () => {
  it('reads them out of the Go source rather than trusting a copy', () => {
    // If the mechanism above ever silently found nothing, every agreement test
    // below would compare a JS constant against itself. This is the guard.
    expect(() => goNumber('backupNoSuchConstant')).toThrow(/no Go constant/)
    expect(goRHS('backupIdentMax').file).toBe('backup_crypto.go')
    expect(goRHS('minPasswordChars').file).toBe('auth_handlers.go')
    // The two sums, evaluated through their named terms rather than restated.
    // Every named term on the right is itself read from Go — the key length is
    // `backupKeyLen`, not a 32 typed in here, because a 32 typed in here is a
    // stale expectation waiting for the day someone moves to a longer key, and
    // it would fail as though the browser had drifted when nothing had. The
    // bare 16 and the 4+1+1+…+2 stay literal because Go spells them literally
    // too; these lines mirror the SHAPE of the sums, and a change to that shape
    // is a change the parser downstream needs to hear about.
    expect(WRAP).toBe(NONCE + KEY + 16)
    expect(PREFIX_FIXED).toBe(4 + 1 + 1 + SALT + NONCE + 2)
  })

  it('agrees on the magic and the version byte', () => {
    expect(ARCHIVE_MAGIC).toBe(MAGIC)
    expect(ARCHIVE_V2).toBe(V2)
  })

  it('agrees on the fixed prefix, the ident cap and the wrap length', () => {
    expect(ARCHIVE_PREFIX_FIXED).toBe(PREFIX_FIXED)
    expect(ARCHIVE_IDENT_MAX).toBe(IDENT_MAX)
    expect(ARCHIVE_WRAP_LEN).toBe(WRAP)
  })

  // The read window must reach the LAST field of the LARGEST possible header, or
  // a long account name pushes the recovery wrap out of view and it reads as
  // absent. This is the bug the original script caught on its first run.
  it('reads far enough into the file to cover a maximal header', () => {
    expect(ARCHIVE_HEADER_MAX).toBeGreaterThanOrEqual(PREFIX_FIXED + IDENT_MAX + 2 * (2 + WRAP))
  })
})

describe('reading a well-formed header', () => {
  it('reports a password archive, whose it is, and that it is recoverable', async () => {
    expect(await sniff(header())).toEqual({ key: 'password', account: 'alice', recoverable: true })
  })

  it('reports an absent recovery wrap as absent rather than as unknown', async () => {
    expect(await sniff(header({ withRecWrap: false }))).toEqual({
      key: 'password',
      account: 'alice',
      recoverable: false,
    })
  })

  // Mode 2 names nobody on purpose: a passphrase archive should not hint at an
  // account, because the account is not the key.
  it('reports a passphrase archive without asking whose it is', async () => {
    expect(await sniff(header({ mode: MODE_PASSPHRASE, account: '' }))).toEqual({ key: 'passphrase' })
  })

  // A maximum-length name is where an off-by-one in the ident offsets shows up,
  // and where too small a read window truncates.
  it('survives an account name at the Go cap, wrap still in view', async () => {
    const longName = 'a'.repeat(IDENT_MAX)
    expect(await sniff(header({ account: longName }))).toEqual({
      key: 'password',
      account: longName,
      recoverable: true,
    })
  })

  // A byte-length slice must not cut a multi-byte name mid-rune.
  it('decodes a non-Latin account name whole', async () => {
    const name = 'ইন্দ্রাণী'
    expect(new TextEncoder().encode(name).length).toBeGreaterThan(name.length)
    expect((await sniff(header({ account: name }))).account).toBe(name)
  })

  it('accepts a header sized exactly to the read window', async () => {
    const maximal = header({ account: 'a'.repeat(IDENT_MAX) })
    expect(maximal.length).toBe(ARCHIVE_HEADER_MAX)
    expect((await sniff(maximal)).recoverable).toBe(true)
  })
})

describe('refusing what it cannot read, rather than guessing', () => {
  // v1 shipped for about an hour and Go refuses it outright; the browser must
  // not read it with the v2 reader just because the prefix happens to line up.
  it('will not parse v1 with the v2 reader', async () => {
    expect(await sniff(header({ version: V1 }))).toEqual({ key: 'unknown' })
  })

  it('reports a future version as unknown instead of reading it anyway', async () => {
    for (const version of [0, 3, 99, 0xff]) {
      expect(await sniff(header({ version }))).toEqual({ key: 'unknown' })
    }
  })

  it('reports an unknown key mode as unknown', async () => {
    for (const mode of [0, 3, 7, 0xff]) {
      expect(await sniff(header({ mode }))).toEqual({ key: 'unknown' })
    }
  })

  // A pre-1.4.1 archive is plain gzip: no key, confirmed by typing RESTORE.
  // Long enough here to actually reach the magic comparison — a short gzip would
  // come back 'none' for the wrong reason.
  it('reports a plain gzip archive as unkeyed', async () => {
    const gzip = new Uint8Array(PREFIX_FIXED + 64)
    gzip.set([0x1f, 0x8b, 0x08, 0x00])
    expect(await sniff(gzip)).toEqual({ key: 'none' })
    expect(await sniff(new Uint8Array([0x1f, 0x8b, 0x08, 0x00, 0, 0, 0, 0, 0, 0]))).toEqual({ key: 'none' })
  })

  it('handles a file far too short to hold a header without reading past its end', async () => {
    expect(await sniff(new Uint8Array([0x54, 0x50]))).toEqual({ key: 'none' })
    expect(await sniff(new Uint8Array(0))).toEqual({ key: 'none' })
    // One byte short of the fixed prefix, magic and version both intact: still
    // not enough to answer, and it must say so rather than read the shortfall.
    expect(await sniff(header().slice(0, PREFIX_FIXED - 1))).toEqual({ key: 'none' })
    // And one byte the other way, which is the boundary that actually costs
    // something to get wrong. At exactly the prefix length the magic, the
    // version and the mode have all been read, so the answer is 'password' with
    // a name it could not reach — NOT 'none'. 'none' is not a weaker answer
    // here, it is a different and false one: it means "a plain pre-1.4.1
    // archive, confirm by typing RESTORE", and offering that for a file that is
    // plainly an encrypted v2 archive sends someone down a path that cannot
    // work. A `<=` in place of the `<` in the length guard is all it takes.
    expect(await sniff(header().slice(0, PREFIX_FIXED))).toEqual({ key: 'password', account: '' })
  })

  // A hostile identLen must not be believed. Go refuses `identLen > backupIdentMax`
  // in readBackupHeader; this is the same line drawn in the browser, tested on
  // both sides of it.
  it('refuses an identLen past the Go cap', async () => {
    expect(await sniff(header({ account: 'alice', identLen: IDENT_MAX + 1 }))).toEqual({ key: 'unknown' })
    expect(await sniff(header({ account: 'alice', identLen: 0xffff }))).toEqual({ key: 'unknown' })
    // And the byte before that line is still fine — the cap is a cap, not an
    // off-by-one that quietly costs one character of every long name.
    expect((await sniff(header({ account: 'a'.repeat(IDENT_MAX) }))).account).toHaveLength(IDENT_MAX)
  })

  // Truncation after the ident is the case the read window used to get wrong.
  // `recoverable` must never come back from bytes that were never read — "your
  // current password will open this" is a promise, and a promise made from a
  // short read is the worst possible answer.
  //
  // ABSENT, not false. The field has three states on purpose — true, false, and
  // "I could not tell" — and the difference between the last two is the whole
  // point of this test. `false` is a claim: it means the header was read to the
  // end of rwLen and rwLen was zero, so the dialog is entitled to say only
  // alice's password opens this. Off the end of a truncated buffer, JS hands
  // back `undefined` for every index, which coerces to zero, which reads as a
  // declared-absent wrap — the wrong answer arrives looking exactly like a
  // right one. So `.not.toBe(true)` is too weak to be worth writing here: it
  // passes for a parser that has stopped bounds-checking and is inventing
  // `false` out of bytes past the end. `toBeUndefined` is the assertion that
  // says what the parser is actually promising.
  it('never claims recoverability it has not seen', async () => {
    const full = header()
    const identEnd = PREFIX_FIXED + 5 // "alice"
    const cuts = [
      identEnd, // nothing after the name at all
      identEnd + 1, // mid kwLen
      identEnd + 2, // kwLen read, the wrap itself absent
      identEnd + 2 + WRAP, // the key wrap is whole, rwLen has not started
      identEnd + 2 + WRAP + 1, // mid rwLen — half a length is not a length
    ]
    for (const cut of cuts) {
      const r = await sniff(full.slice(0, cut))
      expect(r.key).toBe('password')
      expect(r.account).toBe('alice')
      expect(r.recoverable).toBeUndefined()
    }
    // One byte further and rwLen is whole, so the answer flips — that is the
    // boundary, stated so a change to it has to be deliberate.
    expect((await sniff(full.slice(0, identEnd + 2 + WRAP + 2))).recoverable).toBe(true)
  })

  // The limit of what presence can mean here, written down rather than left to
  // be rediscovered: `recoverable` reports that the header DECLARES a recovery
  // wrap, not that a whole one is present. The parser reads rwLen and stops,
  // deliberately — the wrap is ciphertext under a key the browser does not have
  // and will never open, so there is nothing it could check. An archive whose
  // tail was lost still says recoverable, and Go catches that on the restore
  // itself (readWrap's io.ReadFull, then the frames' AAD over the whole header).
  it('reports a declared recovery wrap even when its bytes are cut short', async () => {
    const full = header()
    expect((await sniff(full.slice(0, full.length - 1))).recoverable).toBe(true)
  })

  // Cut mid-name, the parser cannot invent the rest of it. Go refuses this
  // outright ("the backup header is truncated"); the browser returns the short
  // label it can see, which is a weaker answer but not a wrong one — nothing
  // beyond the bytes read is ever reported, and the server re-reads the header
  // for real before a restore happens.
  it('cannot invent the tail of a name it was cut off inside', async () => {
    const r = await sniff(header({ account: 'alice' }).slice(0, PREFIX_FIXED + 3))
    expect(r.account.length).toBeLessThanOrEqual(3)
    expect(r.account).not.toContain('alice')
    expect(r.recoverable).toBeUndefined()
  })

  // The catch-all. A file the browser cannot read at all is the restore's
  // problem to report, and it must arrive there as 'unknown' rather than as a
  // thrown exception out of a helper the dialog calls while rendering.
  it('answers unknown for a file it cannot read at all', async () => {
    const unreadable = {
      slice: () => ({
        arrayBuffer: () => Promise.reject(new Error('the drive went away mid-read')),
      }),
    }
    expect(await sniffArchiveKey(unreadable)).toEqual({ key: 'unknown' })
    expect(
      await sniffArchiveKey({
        slice() {
          throw new TypeError('not a File')
        },
      }),
    ).toEqual({ key: 'unknown' })
    expect(await sniffArchiveKey(null)).toEqual({ key: 'unknown' })
  })
})

// ---- the shape a password or passphrase has to have -------------------------
//
// The server is the authority here too, and for the same reason the header is:
// getting these bounds wrong in the browser means a field that greys out Save
// for a password the server would have taken, or — worse — lets one through that
// the server then refuses with a 400 after the form has been filled in.

describe('the secret bounds, against the Go constants', () => {
  it('agrees with passwordProblem in auth_handlers.go', () => {
    expect(PASSWORD_MIN).toBe(goNumber('minPasswordChars'))
    expect(PASSWORD_MAX).toBe(goNumber('maxPasswordChars'))
  })

  it('agrees with passphraseProblem in backup_crypto.go', () => {
    expect(PASSPHRASE_MIN).toBe(goNumber('minPassphraseChars'))
    expect(PASSPHRASE_MAX).toBe(goNumber('maxPassphraseChars'))
  })

  // A passphrase is optional; someone who sets one instead of using their
  // account password is asking for real secrecy, so its floor is higher. The
  // ceilings match, because both have to be re-typed on a strange keyboard.
  it('holds the passphrase floor above the password floor', () => {
    expect(PASSPHRASE_MIN).toBeGreaterThan(PASSWORD_MIN)
    expect(PASSPHRASE_MAX).toBe(PASSWORD_MAX)
  })
})

describe('passwordProblem', () => {
  // Lengths are built FROM the Go numbers, not from literals, so the boundary
  // moves with the server rather than needing to be found again by hand.
  const at = (n) => 'a'.repeat(n)

  it('accepts the shortest and longest password the server would', () => {
    expect(passwordProblem(at(PASSWORD_MIN))).toBe('')
    expect(passwordProblem(at(PASSWORD_MAX))).toBe('')
  })

  it('refuses one character either side of those bounds', () => {
    expect(passwordProblem(at(PASSWORD_MIN - 1))).toBe(`Password must be at least ${PASSWORD_MIN} characters`)
    expect(passwordProblem(at(PASSWORD_MAX + 1))).toBe(`Password must be at most ${PASSWORD_MAX} characters`)
  })

  // The same vectors TestPasswordRules uses on the Go side, so the two are
  // asserted to agree on the inputs somebody actually types, not only on the
  // numbers. Spaces and punctuation are printable ASCII and stay legal.
  it('accepts punctuation and spaces', () => {
    expect(passwordProblem('p@ssw0rd!#$%^&*')).toBe('')
    expect(passwordProblem('two words here')).toBe('')
  })

  it('refuses accents, non-Latin scripts, emoji and control characters', () => {
    for (const bad of ['pásswórd1', 'パスワード1234', 'password🔐', 'pass\tword', 'pass\nword']) {
      expect(passwordProblem(bad)).toBe('Password: letters, digits and punctuation only — no accents')
    }
  })

  // The exact edges of the printable range, which is where a regex written from
  // memory goes wrong: space (0x20) and tilde (0x7e) are IN, and the two
  // characters flanking them are OUT.
  it('draws the printable range at space and tilde inclusive', () => {
    const pad = at(PASSWORD_MIN - 1)
    expect(passwordProblem(pad + ' ')).toBe('')
    expect(passwordProblem(pad + '~')).toBe('')
    expect(passwordProblem(pad + '\x1f')).not.toBe('')
    expect(passwordProblem(pad + '\x7f')).not.toBe('')
  })

  // Every printable ASCII character, one at a time, against the Go rule
  // (0x20..0x7e). A regex range typed as [\x20-\x7f] or [\x21-\x7e] passes every
  // test above and fails here.
  it('accepts every character in the range and nothing outside it', () => {
    const pad = at(PASSWORD_MIN - 1)
    for (let c = 0; c < 0x100; c++) {
      const legal = c >= 0x20 && c <= 0x7e
      expect(passwordProblem(pad + String.fromCharCode(c)) === '').toBe(legal)
    }
  })

  // Length is checked before the alphabet, which matters: an over-long accented
  // password should be told it is too long first, since that is the fault the
  // person can see. (Go orders its switch the same way.)
  it('reports length before alphabet when both are wrong', () => {
    expect(passwordProblem('á')).toContain('at least')
    expect(passwordProblem('á'.repeat(PASSWORD_MAX + 1))).toContain('at most')
  })

  it('treats an absent value as empty rather than throwing', () => {
    for (const nothing of [undefined, null, '', 0, false]) {
      expect(passwordProblem(nothing)).toBe(`Password must be at least ${PASSWORD_MIN} characters`)
    }
  })
})

describe('passphraseProblem', () => {
  const at = (n) => 'a'.repeat(n)

  it('accepts the shortest and longest passphrase the server would', () => {
    expect(passphraseProblem(at(PASSPHRASE_MIN))).toBe('')
    expect(passphraseProblem(at(PASSPHRASE_MAX))).toBe('')
  })

  it('refuses one character either side of those bounds', () => {
    expect(passphraseProblem(at(PASSPHRASE_MIN - 1))).toBe(
      `Passphrase must be at least ${PASSPHRASE_MIN} characters`,
    )
    expect(passphraseProblem(at(PASSPHRASE_MAX + 1))).toBe(
      `Passphrase must be at most ${PASSPHRASE_MAX} characters`,
    )
  })

  it('refuses an accented passphrase, as the server does', () => {
    expect(passphraseProblem('pässphrase')).toBe('Passphrase: letters, digits and punctuation only — no accents')
  })

  // A password of legal length can still be too short to be a passphrase, and
  // the field has to say so — this is the gap the two rules exist to keep.
  it('refuses a password-length secret that is short of the passphrase floor', () => {
    const between = at(PASSWORD_MIN)
    expect(passwordProblem(between)).toBe('')
    expect(passphraseProblem(between)).not.toBe('')
  })
})

describe('secretProblem', () => {
  // The shared helper both of the above are made from. Tested directly because
  // the noun is interpolated into the message and a caller passing the wrong one
  // produces a field that tells you to fix something you are not editing.
  it('names the thing it is complaining about', () => {
    const opts = { min: 4, max: 6, noun: 'Recovery code' }
    expect(secretProblem('abc', opts)).toBe('Recovery code must be at least 4 characters')
    expect(secretProblem('abcdefg', opts)).toBe('Recovery code must be at most 6 characters')
    expect(secretProblem('abcé', opts)).toBe('Recovery code: letters, digits and punctuation only — no accents')
    expect(secretProblem('abcd', opts)).toBe('')
  })

  // Counted in UTF-16 code units, where Go counts bytes. For anything the rule
  // ACCEPTS the two are identical — printable ASCII is one byte and one unit —
  // so the divergence can only ever appear on input both sides already refuse.
  it('never accepts a string the Go byte-length rule would refuse', () => {
    const emoji = '🔐' // 2 code units in JS, 4 bytes in Go
    expect(emoji.length).toBe(2)
    expect(new TextEncoder().encode(emoji).length).toBe(4)
    expect(passwordProblem('password' + emoji)).not.toBe('')
  })
})
