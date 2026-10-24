# ADR-0632: The app's index.html gets no og:url and no canonical

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** 1.7.6

**Decided.** The app's own `index.html` carries a title, a description and Open Graph tags, but deliberately no `og:url` and no canonical link. `og:image` is absolute because a relative one is dropped.

**Why.** That same file is embedded in the binary and served by every self-hosted instance, so a hardcoded URL would tell a crawler that somebody's private library *is* the public demo. Omitted, a crawler uses the URL it actually fetched, which is right in both cases. The image has no such choice, and the worst case there is a private instance borrowing the public screenshot for its preview.

**Approved.** My call, and I approved the asymmetry between the two tags rather than treating them as one setting.

<sub>1.7.6 — `web/frontend/index.html`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
