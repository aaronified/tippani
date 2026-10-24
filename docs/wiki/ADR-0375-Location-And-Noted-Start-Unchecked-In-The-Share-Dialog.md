# ADR-0375: Location and Noted start unchecked in the share dialog

Source of truth: this wiki page.

- **Area:** [§10 What Leaves the App: Exports, Round-Trips and the Shared Image](ADR-Index.md#area-10)
- **Status:** Accepted
- **Version:** `web/frontend/src/share.jsx` · `share.jsx`

**Decided.** `SHARE_OFF_BY_DEFAULT = {location, noted}`; everything else defaults on.

**Why.** The page/timestamp and the date you saved it are the two least-wanted parts in a shared quote — factual noise for most readers — while remaining one tick away per share. I approved this on the same reasoning as the tint default: the recipient is the audience, and anything that is a note to myself starts off.

**Instead of.** Everything on by default (noisy).

<sub>`web/frontend/src/share.jsx` · `share.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
