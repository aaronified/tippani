# ADR-0348: Text cleanup belongs server-side and shared, not inside the OCR client

Source of truth: this wiki page.

- **Area:** [§9 Import and the Staging Queue](ADR-Index.md#area-9)
- **Status:** Accepted
- **Version:** not built (recorded on the backlog)

**Decided.** De-hyphenating across line breaks, dropping page numbers and running heads, and normalising the quote marks and ligatures that get mangled in transit belong in [data hygiene](Roadmap.md#data-hygiene), server-side and shared — not in the Android client where the Android section first listed them.

**Why.** Every import source produces some of it, not just OCR, and the typographic-folding normaliser already exists for the dedupe hash. Putting it in the app would mean one source got the cleanup and the other seven did not.

**Reversal.** The work is listed in the [Android app](Roadmap.md#android) section as OCR post-processing and I moved its home rather than its description. What I got wrong first time was locating a shared problem inside the feature that happened to surface it.

**Approved.** I approved the move and approved leaving the cross-reference in both sections, so neither reads as though the other forgot.

<sub>not built (recorded on the backlog) — `docs/roadmap.html`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
