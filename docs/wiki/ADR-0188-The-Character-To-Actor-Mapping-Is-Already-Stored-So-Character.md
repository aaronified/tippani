# ADR-0188: The character-to-actor mapping is already stored, so character chips need no IMDb at all

Source of truth: this wiki page.

- **Area:** [§6 People, Credits and Metadata Providers](ADR-Index.md#area-6)
- **Status:** Accepted
- **Version:** Not shipped

**Decided.** Character chips are built from `movies.cast_json`, which already holds up to twenty top-billed `CastMember{Character, Actor, PersonID, ImageURL}` rows per film, harvested from the SAME TMDB credits call the details fetch already makes. No new fetch, no new supplier, no scraping, and nothing that has to be rate-limited.

**Why this is worth an entry.** The feature was specified around IMDb — "this will need IMDb IDs", with a once-a-day ceiling because IMDb blocks traffic. That is true of the character *pictures* and of nothing else. The mapping, which is the part every other piece of this depends on, is in the database now and is already served on the movie payload as `Cast`. `movies` has no `imdb_id` column at all — only `staged_works` carries one, marked informational — so the IMDb route would have started by adding an identifier to fetch data the app already has.

**The consequence for the review deck is the useful one.** §8's new `speaker` facet — *who said this line* — needs the character list and the mapping, and nothing else. So it is **not** blocked on the picture work, and the two can ship in either order. I said the opposite when proposing them; the cast column is the reason it is not so.

**Approved.** Mine, having checked `cast_json` before writing the plan the feature was requested as.

<sub>Not shipped — `internal/metadata/tmdb.go` · `internal/httpapi/movie_handlers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
