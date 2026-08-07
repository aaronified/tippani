// secret.js — the shape a password or a backup passphrase has to have, in one
// place, mirroring passwordProblem / passphraseProblem on the server
// (internal/httpapi/auth_handlers.go, backup_crypto.go). The server is the
// authority; this exists so a field can grey its own Save out and say why,
// instead of a round trip answering with a 400.
//
// Why the alphabet is this narrow: a password is also a backup-archive
// passphrase, so it has to survive being typed on a phone keyboard, on another
// machine's keyboard, and possibly months later on a fresh install where getting
// it wrong means the archive does not open. Diacritics and non-Latin input are
// exactly what does not survive that trip — the same glyph can arrive as one
// code point or as two, and the bytes that get hashed differ.

export const PASSWORD_MIN = 8
export const PASSWORD_MAX = 20
// A passphrase is longer at the bottom because it is optional: someone who
// bothers to set one instead of using their account password is asking for real
// secrecy, and ten characters is the floor where that starts to mean anything.
export const PASSPHRASE_MIN = 10
export const PASSPHRASE_MAX = 20

// Printable ASCII, space through tilde. Anything outside it — an accented
// letter, a curly quote a phone keyboard inserted by itself, any non-Latin
// script — is refused rather than silently accepted and later unmatched.
const PRINTABLE = /^[\x20-\x7e]*$/

// secretProblem returns the reason `v` is unusable, or '' when it is fine.
// `noun` names the thing in the message ("password" / "passphrase").
export function secretProblem(v, { min, max, noun }) {
  const s = String(v || '')
  if (s.length < min) return `${noun} must be at least ${min} characters`
  if (s.length > max) return `${noun} must be at most ${max} characters`
  if (!PRINTABLE.test(s)) return `${noun}: letters, digits and punctuation only — no accents`
  return ''
}

export function passwordProblem(v) {
  return secretProblem(v, { min: PASSWORD_MIN, max: PASSWORD_MAX, noun: 'Password' })
}

export function passphraseProblem(v) {
  return secretProblem(v, { min: PASSPHRASE_MIN, max: PASSPHRASE_MAX, noun: 'Passphrase' })
}

// The archive header layout, mirroring readBackupHeader in
// internal/httpapi/backup_crypto.go. Exported so scripts/archive-header-check.mjs
// can build a header from these numbers and assert the parser below reads it —
// there is no test runner for this app's frontend, and a parser that reads a
// binary format by fixed offsets is the last place to rely on nobody making a
// mistake. (It already went wrong once: the v2 format was drafted with the wraps
// INSERTED before the ident, which would have made this function decode
// ciphertext as an account name and hand the mojibake to a password prompt.)
export const ARCHIVE_MAGIC = 'TPBK'
export const ARCHIVE_V2 = 2
// magic 4 · version 1 · mode 1 · salt 16 · nonce 12 · identLen 2 = 36, then ident.
// v2 appends the key wraps AFTER the ident precisely so these offsets stay put.
export const ARCHIVE_PREFIX_FIXED = 36
export const ARCHIVE_IDENT_MAX = 256
// nonce(12) || ciphertext(32) || tag(16) — backupWrapLen in Go.
export const ARCHIVE_WRAP_LEN = 60
// The largest a header can be, and therefore how much of the file to read: the
// fixed prefix, the longest possible account name, and both length-prefixed wraps.
// Sized from the constants rather than guessed — the first draft read 300 bytes,
// which covered a long name but stopped short of the recovery wrap that follows
// it, so `recoverable` came back undefined for exactly the accounts with long
// names. scripts/archive-header-check.mjs caught that, which is what it is for.
export const ARCHIVE_HEADER_MAX = ARCHIVE_PREFIX_FIXED + ARCHIVE_IDENT_MAX + 2 * (2 + ARCHIVE_WRAP_LEN)

// sniffArchiveKey reads the first bytes of a chosen FILE to learn how it is keyed,
// so the prompt can ask for the right thing instead of offering every field and
// hoping.
//
// Returns { key, account?, recoverable? } where key is:
//   'password'    keyed on an account password; `account` names whose, as a label
//   'passphrase'  keyed on a passphrase, and nothing else can open it
//   'none'        a pre-1.4.1 plain archive — no key, confirmed by typing RESTORE
//   'unknown'     a version this build does not know, or an unreadable file
//
// `recoverable` says the archive carries an instance-recovery wrap, so the server
// that made it can open it with any admin's CURRENT password. Whether THIS server
// is that one is a question only the server can answer (GET /admin/backup reports
// it); from a file on disk, all the browser can see is that the wrap is there.
export async function sniffArchiveKey(file) {
  try {
    const head = new Uint8Array(await file.slice(0, ARCHIVE_HEADER_MAX).arrayBuffer())
    if (head.length < ARCHIVE_PREFIX_FIXED) return { key: 'none' }
    const magic = String.fromCharCode(head[0], head[1], head[2], head[3])
    if (magic !== ARCHIVE_MAGIC) return { key: 'none' }
    // Gate on the version. A format this build cannot parse must say so rather
    // than read the bytes it expected to find and present the result as fact.
    if (head[4] !== ARCHIVE_V2) return { key: 'unknown' }
    const mode = head[5]
    if (mode === 2) return { key: 'passphrase' }
    if (mode !== 1) return { key: 'unknown' }
    const identLen = (head[34] << 8) | head[35]
    if (identLen > ARCHIVE_IDENT_MAX) return { key: 'unknown' }
    const account = new TextDecoder().decode(head.subarray(ARCHIVE_PREFIX_FIXED, ARCHIVE_PREFIX_FIXED + identLen))
    // Immediately after the ident: kwLen(2) || keyWrap, then rwLen(2) || recWrap.
    // A non-zero rwLen is the recovery wrap's presence.
    const kwAt = ARCHIVE_PREFIX_FIXED + identLen
    if (head.length < kwAt + 2) return { key: 'password', account }
    const kwLen = (head[kwAt] << 8) | head[kwAt + 1]
    const rwAt = kwAt + 2 + kwLen
    if (head.length < rwAt + 2) return { key: 'password', account }
    const rwLen = (head[rwAt] << 8) | head[rwAt + 1]
    return { key: 'password', account, recoverable: rwLen > 0 }
  } catch {
    // An unreadable file is the restore's problem to report, not this helper's.
    return { key: 'unknown' }
  }
}
