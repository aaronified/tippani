# ADR-0384: The account password is verified before the archive is written

Source of truth: this wiki page.

- **Area:** [§11 Backup, Restore and Recovery](ADR-Index.md#area-11)
- **Status:** Accepted
- **Version:** 1.4.1; the job 3.1.0

**Decided.** `POST /admin/backup` checks the supplied password against the stored hash before anything is written — not for authorization, since the session already covers that, but because a typo would otherwise produce a perfectly valid archive that nothing can ever open, and you would not find out until the day you needed it. A backup whose failure surfaces only at restore is worse than no backup, because it has already displaced the habit of taking one. I approved this the moment the failure mode was named. **Since 3.1.0 Back up now is a queued job, and it checks twice**: at the press, so a wrong password is still a 401 before anything waits, and again when the job runs, against the owner's password as it is by then, because the job can wait behind others while the password changes. The password lives only in the queue's memory until the job ends, and is never stored.

**Instead of.** Sealing with whatever was typed and letting restore find out.

<sub>1.4.1; the job 3.1.0 — `internal/httpapi/backup_handlers.go` · `internal/httpapi/jobs_kinds.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
