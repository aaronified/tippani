# ADR-0622: Issue-form labels are recovered from the form's field headings

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** 1.3.2

**Decided.** The workflow reads the form's own field headings to work out which template was used, and only ever adds a label.

**Why.** An issue form's `labels:` block is applied with the *author's* permissions, and labelling needs Triage — so `labels: ["bug"]` did nothing for exactly the people the pipeline exists for, and an outside report would never have reached the page. The field headings are better evidence than the title prefix, which is a prefill the reporter can edit away. Add-only, so a label removed on purpose stays removed.

**Approved.** Mine, and I approved the add-only rule as the part that keeps my own triage decisions from being undone by a re-run.

<sub>1.3.2 — `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
