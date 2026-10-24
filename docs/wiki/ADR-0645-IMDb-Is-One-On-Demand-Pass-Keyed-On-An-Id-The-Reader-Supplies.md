# ADR-0645: IMDb is one on-demand pass, keyed on an id the reader supplies, and it never searches

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** 1.17.0

**Decided.** `POST /movies/{id}/cast/imdb` takes an IMDb title link or id, performs exactly ONE outbound GET of that title's page, parses the cast out of the JSON document the page embeds for itself, and merges it through `mergeProviderCast` with `source = 'imdb'`. Nothing calls it unless a reader presses the control on a work.

**Why, when igdb_cast.go already concluded there is no other source.** That measurement is why: over 24 games, IGDB has no credit endpoint, MobyGames exposes none, Giant Bomb returns an unroled list, and Wikidata — the only structured free source — had nothing at all for eight of them, including The Witcher 3 and Mass Effect 3. Those are the games somebody wants to keep a line from. IMDb has them, with characters.

**An id, never a title search, and the id is validated before a URL exists.** A fuzzy title search picked *Hades II* for "Hades" during the earlier research, and a wrong cast on a right work reads as correct — the quote form then autofills "played by" from a different game. So the reader pastes the page they are looking at, `IMDbTitleID` extracts `tt\d{7,9}` from it, and the URL that goes out is built from that against a constant host. A `nm…` person id, a search URL, or anything else is refused with no request made, which is also this provider's SSRF guard: the set of URLs this code can construct is finite and inspectable.

**One request, and the test counts them.** "IMDb once" is a promise about a number, so the stub server in `imdb_cast_test.go` counts its hits and the case fails on two. There is deliberately no preview-then-apply pair — that would be two fetches of one page — so the reply carries the title IMDb answered with and the reader checks it after the fact, against a cast they can edit.

**The provenance rule is not re-implemented for it.** It merges through the same function TMDB's resync and the unattended fill use, so a row the reader typed or corrected keeps both names, a tombstone stays dead, and IMDb's disagreement about who plays a character is stored as its own row rather than as an edit to theirs — visible and deletable rather than a silent rewrite. Pinned by a test.

**On terms of use, recorded because it is a real constraint and not a footnote.** IMDb publishes no free API and its conditions prohibit data mining and scraping; it does publish official datasets under a non-commercial licence, which cover video games and their principals. This path is a single fetch of one page a reader explicitly asked for, for their own private library — but that is the owner's call and not mine, which is why it is behind a control, why nothing schedules it, and why the datasets remain the route to prefer for anything bulk. I raised this before building it and was asked to proceed.

**What is deliberately not built.** No portrait fetch (the URL is stored and the existing SSRF-guarded fetcher downloads it when something wants it), no full-credits page, no paging, and no title search — each of those is a second request, and the request count is the contract.

<sub>1.17.0 — `internal/metadata/imdb.go` · `internal/httpapi/imdb_handlers.go` · `web/frontend/src/WorkDetails.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
