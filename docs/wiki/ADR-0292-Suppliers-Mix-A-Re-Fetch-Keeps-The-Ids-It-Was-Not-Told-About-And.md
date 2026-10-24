# ADR-0292: Suppliers mix: a re-fetch keeps the ids it was not told about, and a match can hand over its id alone

Source of truth: this wiki page.

- **Area:** [§8 The Review Loop](ADR-Index.md#area-8)
- **Status:** Accepted
- **Version:** v3.0.0

**Decided.** `resyncMovieFromSource` writes each of `tmdb_id` / `tvdb_id` / `igdb_id` only when the payload it is syncing from actually carries one, keeping the stored value otherwise (`supplierIDOrKeep`). And a look-up match proposes ITS OWN supplier id as an adoptable row in the merge, so a reader can take the id and nothing else.

**Why it was a real loss rather than an untidiness.** `POST /movies/{id}/cast/tvdb` is the only route in the app to an image PER ROLE, it needs `movies.tvdb_id` on the row, and it deliberately refuses to search for one — a search is where the wrong cast gets attached to the right work. So the id IS the feature. A re-sync from TMDB wrote every id column from a TMDB payload, which knows nothing about TheTVDB, and cleared it: the reader pressed "this record is stale", got fresh metadata, and lost the character art with no message and nothing connecting the two facts. The rule for `imdb_id` one function above says exactly why that is wrong, and had been applied to one column out of four.

**Why the merge may now hand over an id.** `buildRows` excluded supplier ids on the grounds that "adopting an id without the record behind it would leave the row pointing at something it does not describe". That is still true of the ids a candidate does NOT carry, and they are still excluded. It was never true of the candidate's OWN id: the reader is looking at that record in the picker when they take it. Taking it alone is the whole of "keep TMDB's metadata, remember which TheTVDB record this is".

**Approved.** The reader's, in the form "i need to be able to use TMDB metadata but TVDB character images. metadata should be able to be mixed and matched."

<sub>v3.0.0 — `internal/httpapi/movie_handlers.go` · `internal/httpapi/mixed_sources_test.go` · `web/frontend/src/WorkDetails.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
