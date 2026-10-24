# ADR-0603: A frontend test suite arrived as dev-only Vitest in two projects

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** 1.5.0

**Decided.** Vitest, dev-only — the three runtime npm packages are unchanged — with two projects: `pure` in node for functions that take values and return values, `dom` in jsdom for components actually under test. The two hand-rolled check scripts, `greetings-check.mjs` and `archive-header-check.mjs`, folded into it.

**Why.** Jsdom is paid for only where a component is under test; the rest stays fast enough that you run it without thinking. Both projects go through Vite and have to: `api.js` reads `import.meta.env` at module scope and `ui.jsx` imports `api.js`, so almost the whole tree is unloadable by `node --test` — which is exactly why the two bespoke scripts could only ever cover `greetings.js` and `secret.js`, the only modules with no imports at all. TZ and locale are pinned because five places format dates through `toLocaleDateString` with an undefined locale.

**Approved.** My call, and I approved absorbing the scripts rather than keeping three runners.

<sub>1.5.0 — `web/frontend/vitest.config.js` · `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
