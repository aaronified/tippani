# ADR-0606: The greeting tables are checked by exhaustive permutation

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** 1.4.0

**Decided.** 129,210 greetings, across every region, every day of a year and every hour bucket, with two assertions written from bugs that had already happened.

**Why.** Every way those tables break is silent: a greeting rendering `{name}` literally, a "Happy" on a day of mourning, a country resolving to its neighbour's time zone. None of it throws and none of it fails a build. The two named cases are the reason the exhaustive form was chosen rather than a sample — `America/Bahia_Banderas` (Mexico) `startsWith` `America/Bahia` (Brazil), so an ordered prefix scan handed Mexican devices Brazilian national days; and `Africa/Addis_Ababa` is a tzdb *Link* to `Africa/Nairobi`, so Ethiopia has no identifier of its own and is absent rather than mislabelled.

**Approved.** Mine, and I approved the absent-rather-than-mislabelled rule as the answer wherever the tzdb cannot distinguish two countries.

<sub>1.4.0 — `CHANGELOG.md` · `How-this-was-written.md` · `web/frontend/test/pure/greetings.test.js`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
