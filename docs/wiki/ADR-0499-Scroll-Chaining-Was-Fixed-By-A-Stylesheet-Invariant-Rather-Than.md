# ADR-0499: Scroll chaining was fixed by a stylesheet invariant rather than a case

Source of truth: this wiki page.

- **Area:** [§14 Boards, Cards, Charts and Popups](ADR-Index.md#area-14)
- **Status:** Accepted
- **Version:** `web/frontend/test/rules/scroll-containment.test.js`

**Decided.** A test walks every rule block in `index.css` and requires that anything matching `overflow(-x|-y)?: auto|scroll` also carries `overscroll-behavior(-x|-y)?: contain|none`. Eleven full-viewport overlays additionally freeze the page.

**Why.** A wheel or a swipe that runs past the end of a popup carries on into the page behind it. Nothing throws and nothing looks broken while it happens — the page you cannot see moves under the dialog you are reading, and it is still moved when you close it, so you come back somewhere you never navigated to. Nine scroll containers were affected and only two declared the property, which makes it a bug of *omission* — and the failure mode is not "someone wrote the wrong value", it is "someone adds `overflow-y: auto` next year and never thinks about chaining at all". Only a sweep catches that. The second half was worse than the report: CSS containment only governs a scroll that *started* inside the overlay, so eleven full-viewport overlays needed the body lock as well. My call to write the invariant rather than eleven fixes, and it is the pattern the popup-offsets test later copied.

<sub>`web/frontend/test/rules/scroll-containment.test.js`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
