# ADR-0012: Server-side OCR refused; on-device OCR is a different feature and was moved rather than left refused

Source of truth: this wiki page.

- **Area:** [§1 The Target Host, the Budgets, and the Scope They Fix](ADR-Index.md#area-1)
- **Status:** Accepted
- **Version:** pre-1.0 (refusal), scope corrected later

**Decided.** OCR will not be built into the Go binary. Recognition in the planned Android client runs on the device via ML Kit.

**Why.** In the binary it is a dependency, a CPU cost and an upload path, all on a box chosen for being small. On the device it costs the server nothing at all, so the reason for the refusal simply does not reach it.

**Instead of.** The share-target route remains the no-app answer for a phone, and is still planned.

**Reversal.** The refusal stands; my reasoning around it did not. I had written it as though the server were the only place OCR could live, which made a hosting decision read as a feature judgement. The entry now says so and the feature moved to the roadmap's [Android app](Roadmap.md#android) section rather than staying on the set-aside list.

**Approved.** I approved the original refusal and I approved correcting its scope. The correction is the point: what I got wrong was the boundary of my own argument, not its conclusion.

<sub>pre-1.0 (refusal), scope corrected later — `docs/roadmap.html`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
