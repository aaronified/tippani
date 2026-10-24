# ADR-0397: Both keys are tried against one parsed header, never a re-parse

Source of truth: this wiki page.

- **Area:** [§11 Backup, Restore and Recovery](ADR-Index.md#area-11)
- **Status:** Accepted
- **Version:** 1.4.2

**Decided.** `openArchive` parses the header once and tries the portable wrap and then the recovery wrap against that same parsed structure, so a failed first attempt cannot leave the reader mid-header. An earlier draft re-ran the whole parse per attempt, which reported a perfectly good archive as "not a valid tar.gz" whenever the first key was wrong — the worst possible message, because it tells an operator holding an intact backup that their backup is broken. Everything here happens before anything live is touched, so a wrong credential is a 401 with the current data untouched. I approved the re-parse first and it was wrong; the single-parse version is the fix.

**Instead of.** The re-parse, which is the obvious structure and the one I wrote.

**Reversal.** Yes, before release.

<sub>1.4.2 — `internal/httpapi/backup_handlers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
