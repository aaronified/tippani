# ADR-0227: "More like this" from the existing term dictionaries ships first

Source of truth: this wiki page.

- **Area:** [§7 Search and the Full-Text Index](ADR-Index.md#area-7)
- **Status:** Accepted
- **Version:** not being built

**Decided.** Semantic search via `sqlite-vec` would cost a dependency and an indexing pass. There is an 80% version that costs neither: take a quote's highest-value terms from the `*_fts_vocab` views that already exist for typo correction and run them as one `OR` match. It ships before the embedding model, because it may well be enough — and if it is, the dependency never gets added. I approved sequencing it this way on the general rule this project runs on: build the version that uses what is already there, then find out whether the expensive version is still wanted.

**Instead of.** Going straight to embeddings.

<sub>not being built — dropped from the roadmap, with the section it sat in, by `e84414bc` — `docs/roadmap.html`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
