# ADR-0600: Changing a default changes nothing if the default was ever written down

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** 1.7.2

**Decided.** Turning the share image's colour switch off by default also retired its storage key.

**Why.** The one-character version — flip `true` to `false` — is correct, reviews clean, and alters the behaviour of no device that has ever opened the panel: the hook behind it persists on *mount*, so the old default had already been stamped into local storage by the first render, and a stored value beats a default every time. The obvious test passes too. Clear the storage, render, assert the switch reads Off — green, for a change nobody would experience. The test that means anything seeds the *retired* key with the *old* value and asserts the switch still reads Off, which is the only version that can tell a default from a decision somebody made.

**Approved.** Mine, and I approved the key retirement as part of the change rather than a follow-up.

<sub>1.7.2 — `CHANGELOG.md` · `How-this-was-written.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
