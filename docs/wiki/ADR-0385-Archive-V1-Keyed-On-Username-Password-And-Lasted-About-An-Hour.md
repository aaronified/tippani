# ADR-0385: Archive v1 keyed on <username>#<password>, and lasted about an hour

Source of truth: this wiki page.

- **Area:** [§11 Backup, Restore and Recovery](ADR-Index.md#area-11)
- **Status:** Accepted
- **Version:** 1.4.1, superseded in 1.4.2

**Decided.** V1 derived the archive key straight from `"<username>#<password>"`, and it had two faults. Changing your password orphaned every archive made before the change — the archive is a file, and its key was a string you had stopped using. And the secret was ambiguous: the comment asserting that `#` could not appear in an account name was simply false, because `normalizeUsername` rejects only empty, over-long, whitespace and control characters, so `accountSecret("a#b","cd")` and `accountSecret("a","b#cd")` derived the same key. Harmless in practice — no v1 archive was ever made outside this repository's tests — and entirely my error, including the false comment. One correction to a claim v1 made that v2 should not repeat: a *rename* never orphaned an archive, because the account name is written into the header at seal time and the restore path defaults to it. What a rename broke was the dialog's label, which called your own archive somebody else's.

**Instead of.** A delimiter that genuinely cannot occur, which is a narrower fix to the second fault and no fix at all to the first.

**Reversal.** Reversed wholesale by 11.8, one release later.

<sub>1.4.1, superseded in 1.4.2 — `internal/httpapi/backup_crypto.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
