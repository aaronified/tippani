# ADR-0330: All four staged endpoints share one selector shape, and a foreign selection matches nothing and answers 404

Source of truth: this wiki page.

- **Area:** [§9 Import and the Staging Queue](ADR-Index.md#area-9)
- **Status:** Accepted
- **Version:** 1.2.0

**Decided.** `GET /import/staged`, `POST /import/staged/bulk`, `POST /import/staged/approve` and `DELETE /import/staged` take the same `{ids | work_ids | batch_id | all}` selector. Any one is enough; combining them narrows. Explicit id lists cap at 5000.

**Why.** `all` exists so "approve everything" does not have to ship thousands of ids through a 64 KiB body. Every query joins through `import_batches.user_id`, so another user's ids simply do not match — a foreign selection reads as an empty one and answers 404, never 403, per the house rule that one account cannot learn another's row ids exist.

**Approved.** I approved one selector across four verbs rather than four bespoke bodies, and approved 404-not-403 as the uniform answer for anything that is not yours.

<sub>1.2.0 — `internal/httpapi/import_staging.go` · `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
