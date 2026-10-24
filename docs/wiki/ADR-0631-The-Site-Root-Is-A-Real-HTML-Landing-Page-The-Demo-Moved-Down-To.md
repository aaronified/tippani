# ADR-0631: The site root is a real HTML landing page; the demo moved down to /demo/

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** 1.7.6

**Decided.** The published site's canonical URL is a written landing page. The demo is one click away at `/demo/` and still rebuilds on every UI change.

**Why.** Tippani did not come up in a search for its own name, and the reason was not subtle: there was nothing to return. The canonical URL served the demo — an empty div until JavaScript runs, titled `tippani`, with no description, no social preview, no sitemap and no robots.txt. A crawler found a single lowercase word competing with the Hindi and Bengali word the project is named after, and no text at all. It had been the other way round, which put the least readable page in the repository at the most important URL.

**Approved.** Mine, and I approved demoting the demo rather than bolting metadata onto it.

<sub>1.7.6 — `CHANGELOG.md` · `docs/landing.html`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
