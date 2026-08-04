-- Season + episode on a dialogue (see PLAN §3b): which episode the line is from.
--
-- A film is one runtime, so a timestamp locates a line completely — that is why
-- 0003 gave dialogues nothing else. A show is not: "01:12:40" says nothing
-- without the episode it is 01:12:40 of, and a series with sixty episodes has
-- sixty of them. So the locator gains the two numbers a viewer actually cites.
--
-- SHOWS ONLY. A film's dialogues leave both NULL, enforced in app code
-- (episodeRef.validate rejects them for a film, and the importer drops them
-- rather than failing a file) — a CHECK cannot reach across to movies.media_type,
-- and 0004 established that app-side validation is where evolving rules live.
--
-- NULLABLE, and NULL is the only "unset" — deliberately NOT 0-means-unset as
-- 0024's position columns are. Season 0 is a real season: it is where TVDB and
-- everyone following it put specials and pilots, so S0E1 has to be storable and
-- distinguishable from "no episode recorded". This matches the rest of the
-- locator anyway — character, actor and timestamp have all been nullable since
-- 0003, meaning exactly this.
--
-- A line may name a season with no episode (all anyone remembers is the season it
-- was in); an episode with no season is rejected, because an episode number means
-- nothing without one and would sort ahead of every numbered season.
--
-- Dialogue order becomes season, episode, timestamp, id, NULLs last within each
-- group — see dialogueOrder in httpapi. Every existing row is NULL/NULL, so films
-- sort exactly as they did and an un-episoded show line falls to the end.
--
-- No FTS impact: dialogues_fts is external-content over quote/note/character/
-- actor only, so neither the index nor its triggers name these columns.

ALTER TABLE dialogues ADD COLUMN season INTEGER;
ALTER TABLE dialogues ADD COLUMN episode INTEGER;

-- Staging (0023) has to carry them, since every import lands there first: without
-- these, a "- episode: 5" binding would be parsed and then dropped on the way to
-- the queue, and the export/re-import round trip would lose the locator it just
-- wrote. Real columns rather than JSON because the staged-quote editor edits
-- locators field by field, exactly as it does timestamp.
--
-- No _orig snapshot pair (as location/timestamp have): those exist because bulk
-- location formulae REWRITE the live column and reset restores it. A formula is
-- arithmetic on a page number or a clock; there is no formula that renumbers
-- episodes, so there is nothing to restore.
ALTER TABLE staged_quotes ADD COLUMN season INTEGER;
ALTER TABLE staged_quotes ADD COLUMN episode INTEGER;
