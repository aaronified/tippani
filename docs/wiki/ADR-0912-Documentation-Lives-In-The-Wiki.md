# ADR-0912: Documentation lives in the wiki, and nothing else is HTML

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

All documentation, the roadmap and the UI glossary included, moved to `docs/wiki` as Markdown, and the HTML pages and their
build scripts were removed. The wiki is the source of truth, mirrored to GitHub by `wiki.yml`; `scripts/wiki-check.mjs` verifies
every page is reachable from Home and every link resolves, and `scripts/doc-map-check.mjs` keeps the file map in
[Developing](Developing.md) true. The UI glossary is generated (`make glossary`), not hand-written.

**CHANGELOG.md is the one exception**: it is embedded in the binary and shown in the app.

See also: [ADR index](ADR-Index.md) · [Home](Home.md)
