# ADR-0390: A passphrase archive gets no recovery wrap

Source of truth: this wiki page.

- **Area:** [§11 Backup, Restore and Recovery](ADR-Index.md#area-11)
- **Status:** Accepted
- **Version:** 1.4.2

**Decided.** Choosing a passphrase is choosing not to tie the archive to this instance or to any login, so a passphrase archive carries no `recWrap`, and its `ident` field is empty — a passphrase archive has nothing to name and should not hint at the key. That leaves exactly one way to lose an archive permanently now that a password change no longer orphans anything: forget the passphrase. There is no recovery path and deliberately no hint stored, and the UI says so at the moment of choosing rather than in documentation. Passphrases are bounded at 10–20 printable ASCII characters for the same reason the password rules are: this has to be re-typed, on a different keyboard, possibly a year later, with an archive that will not open if it comes out even one byte different. I approved the mode and the warning together; the mode without the warning would have been a trap.

**Instead of.** Recovery-wrapping passphrase archives too, which would contradict what choosing a passphrase means.

<sub>1.4.2 — `internal/httpapi/backup_crypto.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
