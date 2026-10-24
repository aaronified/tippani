# ADR-0013: Server-side text-to-speech refused; the browser's own SpeechSynthesis accepted

Source of truth: this wiki page.

- **Area:** [§1 The Target Host, the Budgets, and the Scope They Fix](ADR-Index.md#area-1)
- **Status:** Accepted
- **Version:** pre-1.0 (refusal); the browser half is accepted, not built

**Decided.** No speech model or paid speech API in the binary, and no audio to store or stream. Reading a due review card aloud through the browser's `SpeechSynthesis` is accepted, scoped to a play control on a review card and nothing else — no stored audio, no transcription, no server route.

**Why.** The two are not one feature in different clothes. One is a model and an audio pipeline on a box that cannot spare either; the other is an API the browser already ships, which costs the server nothing, needs no key, and works offline once the service worker exists.

**Approved.** I approved the acceptance specifically because the line it sat next to turned out to be drawn in the right place already — the OCR entry had done the work of separating "on the server" from "the feature".

<sub>pre-1.0 (refusal); the browser half is accepted, not built — `docs/roadmap.html`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
