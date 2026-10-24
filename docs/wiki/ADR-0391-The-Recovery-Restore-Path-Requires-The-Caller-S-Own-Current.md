# ADR-0391: The recovery restore path requires the caller's own current password

Source of truth: this wiki page.

- **Area:** [§11 Backup, Restore and Recovery](ADR-Index.md#area-11)
- **Status:** Accepted
- **Version:** 1.4.2

**Decided.** `RecoveryOK` is the entitlement to use this instance's recovery key, and it is deliberately *not* inferred inside `openArchive`. The recovery key opens any archive this box made without the era password, which is the point — and it means the key alone must never be sufficient, or a stolen session cookie could overwrite the whole instance with no credential at all. It could, briefly: the first draft of this handed the recovery path to anyone who asked, and the round-trip test caught a restore succeeding with an empty body. On the admin routes the entitlement is earned by `passwordIsCallers` — the session says who you are, this says you are present and meant it, discharging the role the typed `RESTORE` played in 1.4.1 with something that cannot be guessed from the shape of the dialog. An empty password never qualifies. On the onboarding routes it is free, and has to be: there are no users, so there is no password to verify against and nothing a hijacked session could take. I approved the first draft and the test caught me.

**Instead of.** Inferring the entitlement from an admin session alone, which is what the first draft did.

**Reversal.** Yes, before release, on a test failure.

<sub>1.4.2 — `internal/httpapi/backup_handlers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
