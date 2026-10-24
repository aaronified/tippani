# ADR-0257: A quote with neither speaker nor occasion is kept but never enters the deck

Source of truth: this wiki page.

- **Area:** [§8 The Review Loop](ADR-Index.md#area-8)
- **Status:** Accepted
- **Version:** 1.5.0

**Decided.** `utteranceSource()` carries an eligibility clause of its own: `AND (COALESCE(x.occasion,'') <> '' OR COALESCE(x.speaker,'') <> '')`.

**Why.** A proverb is perfectly fine to keep, and there is nothing to recall but the words already in front of you. It makes utterances the first kind whose reviewable pool is smaller than its table, which is exactly why the five queries had to be made to agree.

**Approved.** Mine — keeping it and excluding it were one decision and I approved them together.

<sub>1.5.0 — `internal/httpapi/review_handlers.go` · `docs/roadmap.html`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
