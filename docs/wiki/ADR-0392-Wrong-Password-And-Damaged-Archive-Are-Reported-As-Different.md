# ADR-0392: Wrong password and damaged archive are reported as different failures

Source of truth: this wiki page.

- **Area:** [§11 Backup, Restore and Recovery](ADR-Index.md#area-11)
- **Status:** Accepted
- **Version:** 1.4.2

**Decided.** `errBadKey` is returned from exactly one place — opening a wrap — and covers "wrong password", "wrong passphrase" and "this box's recovery key does not fit" identically, so nothing distinguishes a valid account from an invalid one to whoever is guessing. It must never cover a *frame* failure. In v1 it did, and the inference was sound there, because the derived key's first and only test was frame zero. In v2 the credential is proven the moment a wrap opens, so a frame that fails afterwards means the body was altered or truncated — and reporting that as "wrong password" tells an operator whose archive has been damaged to go and doubt their memory instead. `badKeyMessage` walks the same line from the other side: it never distinguishes "no such account" from "wrong password", but it does say which *kind* of secret is wanted and whether this box can recover the archive on its own, because someone being asked for the wrong kind of thing has no way to work that out from "does not open this backup". My call, and the distinction only became available because v2 changed where the credential is proven.

**Instead of.** One undifferentiated error, which is the safe-looking default and is actively misleading here.

**Reversal.** None; v1's behaviour was correct for v1.

<sub>1.4.2 — `internal/httpapi/backup_crypto.go` · `internal/httpapi/backup_handlers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
