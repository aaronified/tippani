# ADR-0422: Viewport preferences are device-local; identity preferences ride the account

Source of truth: this wiki page.

- **Area:** [§12 Shell, Navigation and Entry Points](ADR-Index.md#area-12)
- **Status:** Accepted
- **Version:** 1.6.0

**Decided.** Button-label density and the two cover-size sliders live in `localStorage`, as do the share image's skin, backdrop and colour switches. Theme, accent, aesthetic and the review settings live in `users.preferences`.

**Why.** How much room a row has is a property of the monitor, not of the reader. A share-image skin is a property of the picture you are making on this device. Everything that is a statement about *you* follows you to the next browser.

**Approved.** My call, and I approved the split as a rule rather than deciding it per control.

<sub>1.6.0 — `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
