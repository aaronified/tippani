-- 0028: let the import queue hold a quote that belongs to no book and no film.
--
-- THE PROBLEM. Every import stages before it writes (0023): nothing reaches
-- annotations or dialogues until the pending queue is approved. But
-- staged_quotes.staged_work_id is `NOT NULL REFERENCES staged_works(id)`, so a
-- work-less quote could not be staged at all — which meant §24 could export
-- quotes and never take them back, exactly the gap 1.1.1 closed for the
-- catalogue and that the roadmap warns against repeating.
--
-- WHAT WAS REJECTED, and why, because both look cheaper than they are:
--
--   * Making staged_work_id nullable. SQLite cannot drop a NOT NULL, so it
--     means a full rebuild — and worse, it breaks the dedupe it is trying to
--     preserve: UNIQUE (staged_work_id, dedupe_hash) stops collapsing anything
--     once the first column is NULL, because SQLite treats NULLs as distinct in
--     a UNIQUE. A file with the same line twice would stage twice.
--
--   * A parallel staged_utterances table. It duplicates the whole staging
--     pipeline — group, retarget, approve-in-part, discard — for a second shape
--     that wants identical behaviour.
--
-- WHAT THIS DOES INSTEAD. A batch of standalone quotes gets ONE synthetic
-- staged_work of kind 'quotes' to hang from. Grouping, dedupe, partial approval
-- and discard then work untouched, and the approve path branches on the kind it
-- already reads.
--
-- 0023 made that possible on purpose. Its own comment on staged_works.kind says
-- "book | movie | show (app-validated: a CHECK cannot evolve)" — so a third
-- kind costs nothing here, and the foresight is worth naming rather than
-- silently spending.

-- The occasion, mirroring `utterances` (0026). All five default to empty rather
-- than NULL, matching that table, so a staged row and a live row read the same
-- to the same scanner.
--
-- ALTER TABLE ADD COLUMN, not a rebuild: staged_quotes is an FK child of
-- staged_works and a rebuild would have to park nothing, but it would still
-- have to recreate the UNIQUE and the index by hand for no gain.
ALTER TABLE staged_quotes ADD COLUMN speaker       TEXT NOT NULL DEFAULT '';
ALTER TABLE staged_quotes ADD COLUMN occasion      TEXT NOT NULL DEFAULT '';
ALTER TABLE staged_quotes ADD COLUMN occasion_date TEXT NOT NULL DEFAULT '';
ALTER TABLE staged_quotes ADD COLUMN place         TEXT NOT NULL DEFAULT '';
ALTER TABLE staged_quotes ADD COLUMN medium        TEXT NOT NULL DEFAULT '';

-- NOTE ON THE DEDUPE HASH for these rows. staged_quotes.dedupe_hash is
-- store.DedupeHash(quote or note) for the other two kinds — locators excluded,
-- "so the same passage recorded twice with different page numbers collapses to
-- one row". §24 inverts that: the occasion IS a locator and it DISCRIMINATES,
-- so staged standalone quotes carry store.UtteranceDedupeHash instead, and
-- staging then collapses a file's internal duplicates the same way the live
-- table would. Nothing in the schema can enforce which function was used; the
-- staging code is the only writer, and its tests pin it.
