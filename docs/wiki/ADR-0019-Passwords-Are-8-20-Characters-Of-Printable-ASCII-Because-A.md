# ADR-0019: Passwords are 8–20 characters of printable ASCII, because a password is a backup key

Source of truth: this wiki page.

- **Area:** [§2 Ownership, Authentication and Exposure](ADR-Index.md#area-2)
- **Status:** Accepted
- **Version:** `internal/httpapi/auth_handlers.go` · `README.md`

**Decided.** `minPasswordChars = 8`, `maxPasswordChars = 20`, and every byte must be in 0x20–0x7E.

**Why.** The upper bound used to be bcrypt's own 72-byte limit, validated only so a long password returned a clean 400 instead of a 500. It is 20 characters now for a reason outside login: the same password wraps the AES-256-GCM key of every backup archive, so it has to survive being typed on a phone keyboard, then on another machine's keyboard, possibly a year later, on a fresh install where getting it wrong means the archive does not open. Diacritics and non-Latin input are exactly what does not survive that trip — the same glyph arrives as one code point or as two and the hashed bytes differ. Scanning bytes rather than decoding runes is sufficient, since any multi-byte UTF-8 sequence necessarily contains a byte ≥ 0x80. I approved narrowing this knowing it makes the app look old-fashioned; the alternative is an unopenable archive.

<sub>`internal/httpapi/auth_handlers.go` · `README.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
