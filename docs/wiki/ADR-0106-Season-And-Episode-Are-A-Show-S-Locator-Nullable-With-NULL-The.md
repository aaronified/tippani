# ADR-0106: Season and episode are a show's locator, nullable, with NULL the only unset because season 0 is a real season

Source of truth: this wiki page.

- **Area:** [§5 Works, Shelves and Reading History](ADR-Index.md#area-5)
- **Status:** Accepted
- **Version:** 1.3.0

**Decided.** Migration 0025 added nullable `season` and `episode` to `dialogues`. Both are pointers in Go, and NULL is the only "unset" — deliberately not the 0-means-unset convention 0024's position columns use.

**Why.** A film is one runtime, so a timestamp locates a line completely; a series with sixty episodes needs to say which of them "01:12:40" belongs to. Season 0 is where TVDB and everyone following it put specials and pilots, so S0E1 has to be storable and distinguishable from "no episode recorded". It also matches the rest of the locator: character, actor and timestamp have been nullable since 0003, meaning exactly this. A line may name a season with no episode; an episode with no season is rejected, because an episode number means nothing without one and would sort ahead of every numbered season.

**Instead of.** 0-means-unset, as the position columns do — rejected because it collides with a real season.

**Approved.** Mine, and I approved the inconsistency with 0024 knowingly rather than for tidiness — two columns with different sentinels is cheaper than losing the ability to record a pilot.

<sub>1.3.0 — `internal/store/migrations/0025_dialogue_episode.sql` · `internal/httpapi/dialogue_handlers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
