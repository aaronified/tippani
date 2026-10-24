# ADR-0605: The demo fetch shim is tested against the handlers it imitates

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** 1.3.1 and 1.5.0

**Decided.** `install.js` exports its `route` function and its response shapes are asserted; its catch-all warns on any path it does not know instead of answering `200 {}`.

**Why.** It answers the API with dummy data so the Pages demo runs with no server, and nothing checked it against the handlers it imitates. `GET /auth/devices` and `/admin/backup` had no case and fell through to the catch-all, so the Devices card read a list field that was not there and threw, taking the whole Settings page down. Its backup response returned `created_at` where the server returns `created`, so the demo rendered "Invalid Date" for as long as that card existed. Nobody's data is at risk from a shim, which is exactly why it drifts: a fake that is close but not identical fails in the one place no test looks. The cover is partial — it asserts what the newest screen reads, not every route — so the risk is reduced rather than closed.

**Approved.** My call, and I approved saying plainly in `How-this-was-written.md` that the cover is partial.

<sub>1.3.1 and 1.5.0 — `CHANGELOG.md` · `How-this-was-written.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
