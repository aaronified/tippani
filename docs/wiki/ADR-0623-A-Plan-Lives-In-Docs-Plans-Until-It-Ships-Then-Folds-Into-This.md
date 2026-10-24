# ADR-0623: A plan lives in docs/plans/ until it ships, then folds into this document and retires

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted, then changed or withdrawn: the entry says how
- **Version:** 1.7.x · retired at 1.14.2

**Decided.** `docs/plans/` holds one file per feature that is **designed and not yet built**. The moment it ships, its decisions are folded into this log — with a pass recording where the plan was wrong — and the plan file is deleted. The directory is therefore always a list of what is coming, never an archive. `docs/wiki/Design-decisions.md` is the opposite: only work already released.

**Why.** They are different documents doing different jobs, and the separation was right. What was missing was the second half of it — an exit. A plan for a feature that shipped six releases ago is a design document sitting in a directory whose whole promise is "this is not built yet", and it goes stale in the one way that cannot be detected: every sentence in it was true when written, and some of them are still true, and nothing marks which. That is precisely the failure that turned this file from a design document into a log. Leaving the plans in place reintroduced it one directory over.

There is a second cost, and it is the one that made this concrete. Decisions taken at plan time are logged here with the plan file as their source. Twenty-five grey lines cited one of the three. **Fourteen still read *planned*** for features that had been running for months — a reader skimming the log would take a built feature for a proposal, which is the same class of wrong as an overturned decision left standing — and **six named no release at all**, which is the same fault with the evidence missing.

**Instead of.** Keeping the shipped plans as historical design records. Rejected on the argument above: git already holds them, and a file in a *forward* directory is read as forward whatever a header says.

**Reversal.** Supplements the original decision rather than overturning it. The separation stands; what changes is that it now has a direction and an end. The earlier entry read: *"Forward build plans for unreleased features — `trash-and-undo.md` (1.8.0), `context-menu-and-multiselect.md` (1.9.0), `search-facets.md` (1.10.0) — live under `docs/plans/`. `docs/wiki/Design-decisions.md` stays where it is."* All three shipped; all three were folded in and deleted at 1.14.2, which is when the rule got its missing half.

**Approved.** Mine. The separation I approved before the first plan was written; the retirement I approved after three had shipped and none had left.

<sub>1.7.x · retired at 1.14.2 — `docs/wiki/Design-decisions.md` · `Developing.md`; the three plans are in git</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
