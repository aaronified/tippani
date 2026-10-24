# ADR-0633: Every local link on the published site is checked before deploy

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** 1.7.6, corrected in 3.0.0

**Decided.** `scripts/site-links.mjs` walks the assembled `_site`, resolves every href/src and CSS `url()`, and fails the deploy on any unresolved local link. It also refuses to pass if it finds fewer than ten links.

**Why.** The site is assembled by copying, not by a build that understands links, so every failure mode is silent and identically shaped: a copy step that stops running, a screenshot renamed on one side of a move, a relative path written for the old layout. Moving the demo made the last one live — `href="roadmap.html"` from inside the demo used to be correct and now points at /demo/roadmap.html, a 404 reached only by clicking the ribbon. The ten-link floor exists because a sweep whose extractor broke reports a clean site by looking at nothing.

**Where it was wrong, found at 3.0.0.** "Resolves every href/src and CSS `url()`" was one claim too many: the script never read a `url()`. And it resolved paths on disk inside the checkout, so a link that left `_site` passed whenever the repo held the file. The published glossary is generated to be opened from `docs/`. Its mark has been `../web/dist/mark.svg` since `af3a0f69` (July), and its fonts and material textures, 357 at 2.2.9 and 365 now, are `url(../web/dist/assets/…)`. The site has published it since `edc6aadc` (4 August), and every one of those references was a 404 on github.io and green here. The script now reads `url()` in the site's pages and in its stylesheets, the demo's own included, and refuses any path that resolves outside the site. `pages.yml` copies the files the glossary names into the site and drops the `../`.

**Instead of.** Trusting the copy steps (the status quo, which hid three classes of breakage). A build system that understands links (larger change than the site warrants).

**Approved.** Mine, and I approved the floor as the part that keeps the sweep honest about itself.

<sub>1.7.6, corrected in 3.0.0 — `scripts/site-links.mjs` · `.github/workflows/pages.yml` · `CHANGELOG.md` · `docs/changelog/3.0.0.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
