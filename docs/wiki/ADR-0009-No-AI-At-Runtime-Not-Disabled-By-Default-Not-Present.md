# ADR-0009: No AI at runtime: not disabled by default, not present

Source of truth: this wiki page.

- **Area:** [§1 The Target Host, the Budgets, and the Scope They Fix](ADR-Index.md#area-1)
- **Status:** Accepted
- **Version:** pre-1.0

**Decided.** There is no OpenAI, Anthropic or local-inference code path in `internal/` or in the frontend, no model ships with the binary, and highlights are never sent to a model because they are never sent anywhere.

**Why.** The distinction that matters is between "off by default" and "absent", and only the second is a property someone can verify. `How-this-was-written.md` separates the two questions people conflate — was the code written with AI (yes, throughout) and does the app use AI (no) — and answers them apart, because they are not the same claim.

**Instead of.** Opt-in digest summaries against an OpenAI-compatible endpoint the user configures with their own key sits under *Later / maybe* on the roadmap: not built, not started, and if ever built, off by default and explicit about what leaves the machine.

**Approved.** Mine, and I wrote the disclosure myself in the first person because a hedged version of this claim would be worse than none.

<sub>pre-1.0 — `How-this-was-written.md` · `README.md` · `docs/landing.html`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
