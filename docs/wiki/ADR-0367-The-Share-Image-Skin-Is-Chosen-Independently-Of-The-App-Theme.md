# ADR-0367: The share-image skin is chosen independently of the app theme and remembered per device

Source of truth: this wiki page.

- **Area:** [§10 What Leaves the App: Exports, Round-Trips and the Shared Image](ADR-Index.md#area-10)
- **Status:** Accepted
- **Version:** `web/frontend/src/share.jsx`

**Decided.** `tippani:shareImageTheme` persists the picture's skin, defaulting to whatever the app is currently showing so the first share matches what you were just looking at. Changing it never changes the app.

**Why.** The card you post and the app you read in are two different rooms. The one you read in is an identity preference; the one you post is an export preference, like the view toggles, so it belongs on the device rather than on the account. The default is the live skin because that is the least surprising first answer, not because the two are linked. I approved the per-device storage for all three picture options — skin, portrait mode and colour — as one class.

<sub>`web/frontend/src/share.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
