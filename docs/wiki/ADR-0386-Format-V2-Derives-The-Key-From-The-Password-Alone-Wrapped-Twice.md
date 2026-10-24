# ADR-0386: Format v2 derives the key from the password alone, wrapped twice

Source of truth: this wiki page.

- **Area:** [§11 Backup, Restore and Recovery](ADR-Index.md#area-11)
- **Status:** Accepted
- **Version:** 1.4.2

**Decided.** V2 generates a random per-archive key and seals it twice. `keyWrap` is that key under `Argon2id(secret, per-archive salt)`, where the secret is your password (mode 1) or a passphrase you chose (mode 2) — portable, travelling with the file and opening it on any Tippani, on any machine, with no database, which is what makes a backup a backup. `recWrap` is the same key under this instance's recovery key. The username is not an input at all, which closes the ambiguity, and the password-change orphaning is closed by the recovery wrap rather than by weakening the cipher. Argon2id runs at the OWASP floor — m=19 MiB, t=2, p=1 — deliberately rather than something showier, because this runs on NAS boxes whose unit sets `GOMEMLIMIT` to 64 MiB and a 64 MiB scratch buffer would thrash the collector during the one operation you least want to be fragile. All three parameters are fixed rather than stored, because `p` in particular changes the output and a portable archive cannot let it vary by machine. What this does not do is stated too: it is not a signature, and anyone who can read the data directory holds both the recovery key and the database it protects. I approved v2 and its honest limits in the same review.

**Instead of.** Re-wrapping every archive on a password change, which requires reaching archives that have already left the box.

<sub>1.4.2 — `internal/httpapi/backup_crypto.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
