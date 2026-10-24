# ADR-0339: The Kindle clippings importer was deferred behind a registered 501, then shipped labelled experimental

Source of truth: this wiki page.

- **Area:** [§9 Import and the Staging Queue](ADR-Index.md#area-9)
- **Status:** Accepted
- **Version:** 1.0.0

**Decided.** The route existed and answered `501` from the moment the other importers shipped. It was implemented in 1.0.0 and the card says *experimental* on its face.

**Why.** A registered route answering 501 says "this is planned and not built", which is a better answer than a 404 that says "you are wrong about the URL". Shipping it labelled rather than silently is the honest version, because Amazon never documented the format and localises the whole metadata line, so a device set to a language I could not verify will do worse.

**Approved.** I approved both the deferral and the label. Shipping an unverifiable parser with no warning would have been the thing I would want to take back.

<sub>1.0.0 — `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
