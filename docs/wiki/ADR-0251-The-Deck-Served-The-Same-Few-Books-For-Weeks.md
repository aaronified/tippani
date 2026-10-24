# ADR-0251: The deck served the same few books for weeks

Source of truth: this wiki page.

- **Area:** [§8 The Review Loop](ADR-Index.md#area-8)
- **Status:** Accepted
- **Version:** 1.0.0

**Decided.** Diagnosed as two independent causes and fixed as two.

**Why.** The bounded fetch was a **rowid prefix, not a sample**: both ordering keys tied across huge blocks of rows — for an unseen card the overdue ratio is `NULL`, so every unseen card tied — and SQLite breaks ties in scan order. The importer writes book by book, so annotation ids are contiguous per book and `LIMIT 40` returned forty rows from one book. Separately, unseen cards could not reach the deck **at all** while a backlog existed, because one query ordered seen-before-unseen let the due bucket fill the whole fetch. Either fault alone would have looked like the other.

**Approved.** I approved treating the report as two bugs after the first fix did not move the symptom, which is the part worth recording.

<sub>1.0.0 — `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
