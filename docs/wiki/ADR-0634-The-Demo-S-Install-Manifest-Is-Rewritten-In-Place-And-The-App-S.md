# ADR-0634: The demo's install manifest is rewritten in place, and the app's copy is left alone

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** 1.7.6

**Decided.** A post-copy step rewrites `_site/demo/manifest.json` to relative `start_url`, `scope` and icon paths. The app's own manifest is untouched.

**Why.** The manifest's root-absolute paths are correct for the self-hosted app and wrong for a site served from a sub-path — they pointed at the domain root and 404'd, and had done since the manifest was added. Vite's `--base` rewrites `index.html` only, never a copied public asset, so nothing caught it. For the app it was never wrong, so the fix belongs to the published copy rather than the source.

**Instead of.** Making the source manifest relative (would be wrong for the self-hosted app, which is the primary consumer).

**Approved.** My call, and I approved fixing the copy rather than the source on the grounds of who the primary consumer is.

<sub>1.7.6 — `.github/workflows/pages.yml` · `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
