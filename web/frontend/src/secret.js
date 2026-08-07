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

// sniffArchiveKey reads the first bytes of a chosen FILE to learn how it is keyed,
// so the prompt can ask for the right thing instead of offering every field and
// hoping. Mirrors readBackupHeader in backup_crypto.go — the fixed part of the
// header is 36 bytes, and the account name follows it.
//
//   magic 4 · version 1 · mode 1 · salt 16 · nonce 12 · identLen 2 · ident …
//
// A file that does not start with "TPBK" is a pre-1.4.1 plain archive, which is
// keyed by nothing and confirmed by typing RESTORE instead.
export async function sniffArchiveKey(file) {
  try {
    const head = new Uint8Array(await file.slice(0, 36 + 256).arrayBuffer())
    if (head.length < 36) return { key: 'none' }
    const magic = String.fromCharCode(head[0], head[1], head[2], head[3])
    if (magic !== 'TPBK') return { key: 'none' }
    const mode = head[5]
    if (mode === 2) return { key: 'passphrase' }
    if (mode !== 1) return { key: 'unknown' }
    const identLen = (head[34] << 8) | head[35]
    const ident = head.subarray(36, 36 + identLen)
    return { key: 'account', account: new TextDecoder().decode(ident) }
  } catch {
    // An unreadable file is the restore's problem to report, not this helper's.
    return { key: 'unknown' }
  }
}
