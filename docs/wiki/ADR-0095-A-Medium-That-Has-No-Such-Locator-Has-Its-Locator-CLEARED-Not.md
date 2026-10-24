# ADR-0095: A medium that has no such locator has its locator CLEARED, not refused

Source of truth: this wiki page.

- **Area:** [§4 What a Quote Is](ADR-Index.md#area-4)
- **Status:** Accepted
- **Version:** 2.2.0

**Decided.** A game's line is placed by its **act** and its **quest** and carries no timestamp and no season/episode; a film's and a show's carry no act or quest; an episode NAME belongs to a show and nowhere else. Every one of those rules is applied by clearing the field on save — `dialogueReq.normalizeLocator`, one call, in both the create and the update path — and not by answering 400.

**Why not a CHECK.** A game is a `movies` row (0040) exactly as a show is (0025), so the rule needs `movies.media_type`, and SQLite cannot reach across from `dialogues` to read it. It has to be a Go rule wherever it lives.

**Why cleared and not refused.** This is `episodeRef.normalize`'s decision, restated for two more media, and its reason still holds: a work retargeted from a show to a film leaves its lines holding episode numbers that mean nothing, and refusing them would make every later edit of those lines fail from a form that — correctly — no longer offers the field. Retargeting is a legitimate repair, and the importer already forgives the same case.

It matters more for the timestamp than it ever did for the season. **Nothing in the shipped capture forms gates the timestamp box by media type** — `AddSurface` computes `isScreen` and `isShow` and has no `isGame`, and the film page sends a timestamp unconditionally — so a 400 would have refused every game line the app is currently able to capture. The forms come with the design pass; until they do, a game's timestamp is silently dropped, which is stated here so that it is a known cost rather than a bug report.

**A malformed value is still a 400.** Too long is too long on every medium, and the cap is applied in `validate` beside `timestamp`'s, before the media type is even known: a cap is a property of the column, not of the medium.

**The cost, stated.** Two embedded structs on `dialogueReq` now both have a method called `normalize`, so neither is promoted and every call has to name which one it means. That is deliberate — an unqualified `d.normalize()` does not compile, which is a better failure than one of the two rules quietly not running.

**Approved.** Mine.

<sub>2.2.0 — `internal/httpapi/dialogue_handlers.go` · `internal/httpapi/game_locator_test.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
