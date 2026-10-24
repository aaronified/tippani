# ADR-0604: Test file paths come from vitest.config.js, not from cwd

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** 1.6.x

**Decided.** The config exports `TIPPANI_SRC` as an absolute path for the handful of tests that read a source file rather than import it — the CSS/JS agreement checks in `palette.test.jsx` and `button-labels.test.jsx`.

**Why.** They cannot work it out themselves. Under jsdom `import.meta.url` is an http URL, so `readFileSync` rejects it; and `process.cwd()` is whatever directory vitest was launched from, which is `web/frontend` for `npm test` and the repo root for `npx vitest --root web/frontend`. Both are real invocations, and the second one is how the divergence was found. The config is the only place that knows for certain, and it runs in Node where `import.meta.url` is a `file:` URL.

**Approved.** Mine, and I approved putting the answer in the one file that has it rather than making each test guess.

<sub>1.6.x — `web/frontend/vitest.config.js`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
