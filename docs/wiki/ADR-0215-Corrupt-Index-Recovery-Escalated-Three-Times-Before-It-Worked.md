# ADR-0215: Corrupt-index recovery escalated three times before it worked

Source of truth: this wiki page.

- **Area:** [§7 Search and the Full-Text Index](ADR-Index.md#area-7)
- **Status:** Accepted
- **Version:** 0.4.6 → 0.4.7 → 0.6.4

**Decided.** This is the most instructive sequence in the repo, so it is recorded in full. 0.4.6 added the startup FTS integrity check and rebuilt a corrupt index by dropping and recreating it, on the correct observation — stated in that release's own notes — that a bare `rebuild` cannot fix page-level corruption because it re-reads the same bad pages. 0.4.7 found that a badly-corrupt index makes even `DROP TABLE` raise `database disk image is malformed`, and added `Recover`: copy every intact base table into a fresh file, let the triggers repopulate, never read the corrupt pages. That should have been the end of it. It was not, because the *runtime* path — the one a live search hits — had been left running a bare `rebuild`, the version 0.4.6 had already documented as insufficient. Every search 500'd until a restart. 0.6.4 finally pointed the runtime path at the same drop-and-recreate the startup path used. My mistake was fixing one caller and not auditing the others, and it is the reason the repair primitives now live in one file with one lock.

**Instead of.** None worth the name; each step was a correction of the last.

**Reversal.** Twice over, and the second reversal was of a gap I had left, not of a decision I had taken. That is worse.

<sub>0.4.6 → 0.4.7 → 0.6.4</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
