# ADR-0192: IGDB for games, Wikidata for their voice cast, because nothing else exists

Source of truth: this wiki page.

- **Area:** [§6 People, Credits and Metadata Providers](ADR-Index.md#area-6)
- **Status:** Accepted
- **Version:** 0040

**Decided.** Games are fetched from IGDB (Twitch client-credentials OAuth, an Apicalypse POST API) for title, year, summary, cover art, genres, franchise and the studio with its logo. The **voice cast comes from Wikidata**, joined on the IGDB slug, via three batched Action-API calls — no SPARQL, no new host. An empty cast is a normal outcome, not a failure, and the stored cast stays hand-editable.

**Why, and this was measured against live APIs before any design.** Probed 24 well-known games on 2026-08-16. IGDB v4 has **no person endpoint and no credit endpoint at all** — its `characters` endpoint carries `akas, gender, mug_shot, species, description, games`, with no actor link. MobyGames' API exposes no credits endpoint. Giant Bomb returns an unroled flat `people` list. IMDb has the data and no API. So Wikidata is not the best of several options; it is the only structured free source that exists.

And it is thin, which changed what got built:

```text
Skyrim          66 credits, 66 with a character role, 38 with a portrait
Baldur's Gate 3 23 credits, 22 with a role
Cyberpunk 2077  17 credits
Elden Ring       9 credits, 9 with a role
Witcher 3 · Mass Effect 3 · Persona 5 · Disco Elysium · BioShock  → ZERO
```

Two of the four games the feature was requested for have no cast at all. **Half the stated hope is not deliverable, and saying so is the design.** A blank the reader can type into is honest; a lookup that reports success and shows nothing is not.

Two routes are walked, because the credits sit in two places: the game's own `P725` with its `P4633` character-name qualifier (which is already the shape `cast_json` wants), and a hop through `P674` characters to each character's own `P725` — the second is what rescues Half-Life 2, Final Fantasy VII and Persona 5.

**The game is pinned by slug, not matched by title.** `P5794` holds the IGDB slug, so `haswbstatement:P5794=elden-ring` returns `Q64826862` and nothing else. This is load-bearing: during the research a fuzzy title search picked *Hades II* for "Hades", and a wrong cast attached to a right game is a defect that reads as correct.

**Instead of.** A `games` cast table — there is nothing to put in it that `cast_json` does not already hold. SPARQL — `wbgetentities` batches 50 ids, which is what makes the plain Action API enough: Skyrim's 66 credits resolve in three requests rather than 133. A built-in shared IGDB key, as TMDB has — the credentials are per-application and rate-limited to 4 req/s, so a shared key is a shared quota.

**Approved.** The reader's, after the research: accept the one-time Twitch key so games get cover art, fetch the cast by both Wikidata routes, and keep it hand-editable.

<sub>0040 — `internal/metadata/igdb.go`, `internal/metadata/igdb_cast.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
