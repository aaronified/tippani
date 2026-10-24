# ADR-0001: A NAS sharing a box with ~100 co-tenant services makes CPU frugality a first-class requirement

Source of truth: this wiki page.

- **Area:** [§1 The Target Host, the Budgets, and the Scope They Fix](ADR-Index.md#area-1)
- **Status:** Accepted
- **Version:** pre-1.0

**Decided.** The target host is stated at the top of the plan as a constraint, not as context: "Target host: a low-powered NAS also running ~100 other services → CPU frugality is a first-class requirement." It is restated in the contributing guide as "a requirement, not a preference", and in the README as the first sentence about the binary.

**Why.** Every budget below is downstream of it. A constraint that lives only in my head gets traded away the first time a feature wants a timer; written into the plan, the README and `Developing.md`, it is something a patch has to argue against rather than something I have to remember to defend.

**Approved.** Mine from the first line of the plan — I picked the host, so I own the budget, and I approved writing it down in three places rather than one.

<sub>pre-1.0 — `docs/wiki/Design-decisions.md` · `Developing.md` · `README.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
