# ADR-0665: Half a sweep is a sweep that reads as done

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** 2.2.5

**Decided.** The character reaches Shuffle, On-this-day and the anthology; the film forms get the title casing; the staging line gets the kind.

**Three separate misses, one shape.** Each was a change applied to the surfaces the author had in front of them: the character to the library card and the shares but not to two server reads that build the same card elsewhere; the title casing to books and to both Details panels but not to the film tab's own forms; the kind to five surfaces but not to the approval queue. Every one of them looked complete from inside the change that made it, and every one leaves the reported symptom visible somewhere the reporter will find it.

**The serendipity one is the sharpest**, because the fault is legible in the source: the book branch selected the literal `''` for the character while the screen branch, twenty lines below, selected `COALESCE(d.character,'')`. Nothing is easier to read past.

**What would have caught them is asking, per change, which OTHER code builds this same thing** — the question `sweep-check` exists for. A test cannot: each surface passed its own.

<sub>2.2.5 — `internal/httpapi/serendipity_handlers.go` · `internal/httpapi/anthology_handlers.go` · `web/frontend/src/Movies.jsx` · `web/frontend/src/StagingPage.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
