# ADR-0589: Importers are verified against real exports, and the fixtures are synthetic

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** 0.x onward

**Decided.** Every importer has a committed synthetic fixture — `hardcover_ synth.htm`, `goodreads_synth.htm`, `imdb_synth.htm`, `amazon_notebook_synth. htm`, `markdown_readest_synth.md` — plus a second test that opens the real third-party export and calls `t.Skip` when it is absent, with the reason stated: gitignored, owner privacy. "Verified against a real export" is tracked in §11's confidence table as its own class, distinct from design inference.

**Why.** A real export is somebody's library and cannot be committed, but a parser written against a guessed shape is a guess. Keeping both means CI has something deterministic to run and my own machine still runs the file the format was learned from. §11 marks the difference so a reader can tell which claims were checked against reality — Bookcision's `authors` field is recorded as a string with a nullable `note` because a real export said so, while the FTS latency figure is marked design inference.

**Approved.** Mine, and I approved the skip-when-absent shape rather than weakening the tests to the synthetic fixture alone.

<sub>0.x onward — `internal/importer/testdata/` · `internal/importer/bookcision_test.go` · `docs/wiki/Design-decisions.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
