# ADR-0191: The in-costume still is the only part that needs IMDb, so it is opt-in, per character, and cached hard

Source of truth: this wiki page.

- **Area:** [§6 People, Credits and Metadata Providers](ADR-Index.md#area-6)
- **Status:** Accepted
- **Version:** Not shipped

**Decided.** A character portrait — the actor in costume, as on `imdb.com/title/{tt}/characters/{nm}` — is fetched only when the reader asks for that character, stored per (movie, character), and used **only** for that film's own chips. The person's people-chip portrait is untouched. Any IMDb read happens at most once a day per title, with an explicit manual refresh, and an `imdb_id` on `movies` has to exist first.

**Why it is separated from everything above.** `CastMember.ImageURL` already carries a headshot from TMDB, and a headshot is not the thing being asked for: the point of a character chip is the character. That picture is not in any API the app already speaks to, which is the entire reason IMDb enters the design — and IMDb blocks traffic, has no API, and would be scraped. So it is the one part that is expensive, fragile and legally awkward, and it is therefore the part that is optional, manual and last.

**Storage, unlike the mapping.** This one IS a table — sparse, one row per character the reader actually asked about, created lazily, exactly the shape `item_reviews` uses. The absence of a row is the default, and a film nobody has fetched a still for costs nothing.

**The daily ceiling is a property of the title, not of the app.** Recorded so it is not later mistaken for a general politeness setting: one read per title per day, so refreshing a film's cast twice in an afternoon fetches once, and the reader gets a manual override because they know when they have changed something.

**Instead of.** Fetching stills for the whole cast on sync — twenty scrapes per film for pictures nobody asked to see. A Google image search — considered, and it is the fallback if IMDb proves unworkable, but it returns a page of guesses where IMDb returns the answer, so it would need the reader to pick, which is a different feature.

**Approved.** The reader's, in the form "if you fetch IMDB data, do that once a day only with optional user refresh. this is because otherwise Imdb blocks traffic" and "these will only be used for the actor chips in the movie itself. the person will retain his people chip as usual."

<sub>Not shipped</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
