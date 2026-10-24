# ADR-0629: Attribution is a stated requirement, not a courtesy

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** ?

**Decided.** README names Google Books, Open Library, Amazon, TMDB and TheTVDB as sources, states explicitly that the product uses the TMDB and TheTVDB APIs but is not endorsed or certified by either, and credits `pretext`, the CC0 Textures packs, and Bookcision and Readest as read import formats.

**Why.** Named as part of the AI-provenance position: what was borrowed is credited by name, and design influences are named where they apply — the Radarr-style status bar, the `*arr`-style cover folder — "so an idea taken from elsewhere is attributed rather than passed off". Closing invitation: "If you spot something in here that belongs to someone else and is not credited, that is a bug worth an issue."

**Instead of.** Omitting the not-endorsed language — required by the API terms and stated anyway.

**Approved.** Mine, and I approved treating an uncredited borrowing as a bug class rather than an oversight.

<sub>? — `README.md` · `How-this-was-written.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
