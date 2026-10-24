# ADR-0607: The archive header is parsed in two languages and checked against itself

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** 1.4.2, moved into Vitest at 1.5.0

**Decided.** The check builds headers from the shared constants and asserts the browser parser reads them back, including that it *refuses* a version it does not know rather than guessing.

**Why.** `secret.js` parses that binary header in the browser, by fixed byte offsets into a format defined in Go, and at the time this app had no frontend test runner — so nothing would have noticed the day the two disagreed. It earned itself immediately by failing on its first run, on a bug written minutes earlier: the read window covered a maximal account name but stopped short of the field after it, so an archive's recoverability read as absent for exactly the accounts with long names. That is the shape of every bug in this class — it does not throw, it does not look wrong, and it is only ever wrong for inputs nobody happened to try.

**Approved.** My call, and I approved the refuse-unknown-version assertion as part of it, which is the half that protects a future format.

<sub>1.4.2, moved into Vitest at 1.5.0 — `CHANGELOG.md` · `How-this-was-written.md` · `web/frontend/test/pure/archive-header.test.js`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
