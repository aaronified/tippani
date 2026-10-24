# ADR-0333: Location bulk edits are formulae over the numeric runs inside free text, with a separate clock path and a clamp

Source of truth: this wiki page.

- **Area:** [§9 Import and the Staging Queue](ADR-Index.md#area-9)
- **Status:** Accepted
- **Version:** 1.2.0

**Decided.** Add, subtract, multiply, divide, set and reset over a selection. Locators stay free text — `p.142`, `610-612`, `42%`, `1234` — and a transform rewrites the numbers inside the string, leaving everything around them alone. A value containing a time pattern converts to seconds, shifts, and re-renders with the component count and zero-padding it arrived with. Results clamp at zero; division rounds to the precision the input showed.

**Why.** Editing locations in bulk needs more than a text box: a Kindle export numbers by *location* rather than page and the conversion is a division, and a PDF's page numbers run a few ahead of the print edition's. `p.142` minus 5 is `p.137`, and a range moves at both ends because both ends are numbers. Digit-by-digit arithmetic on a clock would be wrong — `01:02:03` plus a minute is `01:03:03`, not `61:62:63`. Detection is by *value*, not by which field was picked, because a staged row carries both locator sets and an audiobook "location" of `2:15:00` deserves the same treatment as a film timestamp.

**Instead of.** Matching a chapter:verse locator as a clock — deliberately not done; `2:255` is not a time, and half-matching it would be worse than not matching it at all.

**Approved.** My call, and I approved detection-by-value over detection-by-field after noticing the audiobook case, which the field-based version would have got wrong every time.

<sub>1.2.0 — `internal/httpapi/locformula.go` · `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
