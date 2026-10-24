# ADR-0638: A character's picture is fetched once and served from here, not hotlinked

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** 2.2.0

**Decided.** `work_cast.character_image_path` (0050) holds the stored file beside the provider URL 0049 added, and `POST /cast/{id}/image` fills it on demand. The chip draws the local file; the URL is what a fetch would use if the file is not there yet.

**Why not hotlink.** The CSP already allows `artworks.thetvdb.com`, so pointing a chip straight at TheTVDB would have worked with no backend at all. It would also make every quote card a reader opens a request from their browser to a third party, naming a title in their library — in a self-hosted app whose whole premise is that the library is nobody else's business. Every other image here is already fetched once and served locally for exactly that reason. A hotlink additionally breaks silently the day the file moves, on a card that used to work.

**Two columns, and the second is not a provider fact.** The URL is the provider's and a refetch may replace it; the path names a file on this disk and a refetch must leave it alone. Collapsing them means a refetch either orphaning a stored file or overwriting a path with a URL, and both are how an image goes missing.

**On demand, never at seed.** A film's cast is twenty rows and a reader quotes two. Fetching twenty images because a title was added would spend twenty requests answering a question nobody asked, inside the request that added the title — so this follows the portrait pipeline, where a headshot is resolved when a panel is opened rather than when a name first appears in a credit.

**Idempotent so the caller can be dumb.** A row that already has a path is returned without a fetch, so a client may call the route for every chip it is about to draw. A caller that has to remember what it has already asked for is a caller that gets it wrong.

**A role with no art is 200, not 404.** Most roles have none even on TheTVDB and every TMDB-sourced row has none by definition; the reply is the row with an empty path and the chip falls back to the actor's headshot, which is what TheTVDB's own site does. A 404 would make "this role has no picture" indistinguishable from "that row is not yours".

<sub>2.2.0 — `internal/store/migrations/0050_character_image_path.sql` · `internal/httpapi/cast_image_handlers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
