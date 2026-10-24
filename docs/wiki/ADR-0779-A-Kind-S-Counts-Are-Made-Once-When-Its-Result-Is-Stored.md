# ADR-0779: A kind's counts are made once, when its result is stored

Source of truth: this wiki page.

- **Area:** [§18 Jobs and Logs](ADR-Index.md#area-18)
- **Status:** Accepted
- **Version:** 3.1.0

**Decided.** Each queued kind says what its counts are — fill `{fields, failed, unpinned}`, covers `{fetched, enriched, failed, skipped}`, people `{ok, failed, first_error}`, reverify `{items, changes}`, reverify-apply `{applied, skipped, failed}`, and none for a backup — and storing a result writes its counts beside it, in their own column. A list reads that column and never the result.

**Why.** The first build made the counts in SQL from whatever the result held, which dropped the one string among them (a people fetch's first error), turned a re-verify's findings into a bare length, and ran `json_each` over up to 8 MB a row on every poll of the list.

**Instead of.** Teaching that query each kind's field names, which is still a scan of every result on every read, with the meaning of a kind's counts in a query rather than beside the kind.

<sub>3.1.0 — `internal/httpapi/jobs_kinds.go` · `internal/jobs/job.go` · `internal/store/migrations/0079_jobs.sql`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
