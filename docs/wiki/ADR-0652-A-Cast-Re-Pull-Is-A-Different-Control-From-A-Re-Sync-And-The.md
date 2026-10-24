# ADR-0652: A cast re-pull is a different control from a re-sync, and the difference is what gets pressed

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** 2.2.3

**Decided.** `POST /movies/{id}/cast/tvdb` re-pulls a title's cast and nothing else, from the TheTVDB id already on the record.

**Why not the existing resync.** `PUT /movies/{id}` with a source and source id re-pulls the poster, the genres, the overview, the release year AND the cast. That is the right control for "this record is wrong". It is the wrong control for "this record is fine, its cast is thin" — and the reader who most wants character art is exactly the reader who has corrected a year or a description by hand, so they will not press a button that offers to take those back. 2.2.0's one-time pass flags the titles still pinned to TMDB; this is the control it was flagging them for, and it did not exist.

**No search, and the same argument as the IMDb route's.** A search is where the wrong cast is attached to the right work, and a wrong cast reads as a correct one: the capture form then autofills "played by" from it. A title with no TheTVDB id is a 409 naming the fix, before anything leaves the machine.

<sub>2.2.3 — `internal/httpapi/tvdb_cast_handlers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
