# ADR-0014: Android only for the native client; no unbuildable ios/ directory ships

Source of truth: this wiki page.

- **Area:** [§1 The Target Host, the Budgets, and the Scope They Fix](ADR-Index.md#area-1)
- **Status:** Accepted
- **Version:** pre-1.0

**Decided.** The planned native client is Flutter in `mobile/`, Android only. No `ios/` directory in the tree.

**Why.** Flutter compiles for iOS and the Dart here stays platform-agnostic, but building and signing for iOS needs a Mac and I do not have one. An `ios/` directory I cannot build is a directory that rots, and it advertises a platform nobody can ship. A fork with a Mac adds it with `flutter create --platforms=ios .` and a signing config.

**Instead of.** Shipping the directory anyway for the look of portability — rejected.

**Approved.** My call, and I approved saying why in the roadmap rather than letting the absence read as an oversight. The README says Android and does not imply otherwise.

<sub>pre-1.0 — `docs/roadmap.html`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
