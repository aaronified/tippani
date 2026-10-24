# ADR-0265: A failed grade save keeps the reveal and always lets the reader advance

Source of truth: this wiki page.

- **Area:** [§8 The Review Loop](ADR-Index.md#area-8)
- **Status:** Accepted
- **Version:** 1.0.0

**Decided.** `json()` resolves to `{ok:false}` on a transport-level rejection instead of throwing; a non-2xx keeps the reveal on screen, shows an inline error saying the grade did not count, and Next always advances.

**Why.** An escaping rejection — an offline blip, a Wi-Fi-to-cellular handover, a server restart mid-request — skipped every line after the `await`, including the one re-enabling the control, so the quiz stalled with no way forward. Worse, a non-2xx *removed* the Next button from the DOM rather than disabling it. Losing one grade is a small cost; being unable to finish the session is not.

**Approved.** Mine, and I approved fixing `json()` for the whole app rather than the quiz alone — it unsticks in-flight flags everywhere.

**Superseded** by the entry below: a grade is no longer lost when its save fails, and there is no inline error to show.

<sub>1.0.0 — `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
