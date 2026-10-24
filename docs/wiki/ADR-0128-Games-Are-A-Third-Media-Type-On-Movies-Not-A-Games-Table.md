# ADR-0128: Games are a third media type on movies, not a games table

Source of truth: this wiki page.

- **Area:** [§5 Works, Shelves and Reading History](ADR-Index.md#area-5)
- **Status:** Accepted
- **Version:** 0040

**Decided.** A game is a row in `movies` with `media_type = 'game'`, its studio in the `director` column, its voice cast in `cast_json`, its franchise in `series`, and one new column — `igdb_id` — beside `tmdb_id` and `tvdb_id`. Migration `0040_games.sql` is two statements. There is no `games` table and no fifth nav tab: games are a segment inside the Catalogue, alongside Films and Shows.

**Why.** This is the move `0006` made for TV shows, and every part of the reasoning carried over. The payoff was measured rather than assumed: **20 Go files** query `movies` (search, stats, the bin, backup, restore, export, the review deck, import staging, bulk ops, dupes, portraits, reverify, vocabulary, admin, and the CLI), and they all understood games without being touched. A `games` table would have meant teaching every one of them a third noun, where the failure mode of missing one is silence — a game absent from search, or from a backup, with nothing raised.

`'game'` needed no vocabulary change either, and that was by earlier design rather than luck: `media_type` has no CHECK (0006 validates it in app code and says so), `status` has none (0024), and `person_kinds` has none (0027). A studio therefore becomes a `people` row of kind `studio` with no DDL at all, inheriting image storage, the People panel, rename, merge and orphan GC. `0037` set the bar for a new person kind — it must have *behaviour*, not just a label — and a studio clears it: a logo, a click target, and its own slot on the overview page.

**What I got wrong, and it is worth recording.** The plan this was built from stated the payoff as "eighteen Go files" and "~61 frontend `kind === 'movie'` switches". Recounted against the tree on 2026-08-16: **20 files**, and `kind === 'movie'` appears **9 times** (105 `'movie'` literals across 17 files). The conclusion was right and both supporting numbers were wrong, which is exactly the failure mode `How-this-was-written.md` describes — confident documentation is not verified documentation. The corrected figures and the commands that reproduce them are in the migration header, where the next person to question the design will actually be standing.

**The vocabulary stretch is deliberate and is the one real cost.** A game's studio lives in a column named `director`. That is defensible — a show already stores its *creator* there — but it means two person kinds share one column, told apart only by `media_type`, which is a hazard rather than a tidiness problem. See §6.

**Approved.** My call, after the metadata research settled what could actually be fetched.

<sub>0040 — `internal/store/migrations/0040_games.sql`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
