# ADR-0323: Import counters moved from the import call to the approval call, because nothing is written at import time any more

Source of truth: this wiki page.

- **Area:** [§9 Import and the Staging Queue](ADR-Index.md#area-9)
- **Status:** Accepted
- **Version:** 1.2.0

**Decided.** The seven import endpoints answer with a batch id and a staged count. `added` / `skipped` / `enriched` come back from `POST /import/staged/approve`, which is where the writing happens.

**Why.** The counters describe writes, and at import time there are none. A parser's own counters stay on the import reply, though — the Kindle clippings importer still says "1 bookmark skipped, no text to import" at the moment you upload the file, which is the only point at which that is actionable.

**Approved.** My call, and the split between "what the parser saw" and "what the library did" is the part I approved deliberately: they answer different questions at different moments.

<sub>1.2.0 — `CHANGELOG.md` · `internal/httpapi/import_handlers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
