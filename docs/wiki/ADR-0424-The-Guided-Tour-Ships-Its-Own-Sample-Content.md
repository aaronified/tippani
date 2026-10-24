# ADR-0424: The guided tour ships its own sample content

Source of truth: this wiki page.

- **Area:** [§12 Shell, Navigation and Entry Points](ADR-Index.md#area-12)
- **Status:** Accepted
- **Version:** 0.9.0

**Decided.** A *Pride and Prejudice* quote (in Bengali, song 1 of Tagore's *Gitanjali*) and a *Casablanca* line are built in as tour content. The tour never asks for your files.

**Why.** A tour that needs your library cannot run on first launch, which is the only moment it is for. The samples were meant to be public domain, because they ship in the binary, and only the book lines are: *Casablanca* (1942) is under US copyright until 2038. At 3.0.4 the owner, asked whether to swap it for a public-domain film, chose to keep it as a five-word quotation. The admin steps show and ask for the TMDB / TheTVDB / Google Books keys with instructions on where each comes from, and the highlighted Metadata card stays usable so they can be pasted mid-tour.

**Approved.** I approved the sample content and the licence constraint on it together.

<sub>0.9.0 — `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
