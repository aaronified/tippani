-- 0091: the work an imported anthology entry says it came from, by its identifiers.
--
-- An anthology file written by this app names, for each passage that came out of a work, the work's
-- identifiers (an ISBN, an ASIN, a provider id). Staging is per quote, so the string rides on the staged
-- row; approval uses it to re-link an entry to a work already in the library, and only on an exact
-- identifier match. Without a match the entry stays a standalone quote, as it always has.
ALTER TABLE staged_quotes ADD COLUMN anthology_work_ref TEXT NOT NULL DEFAULT '';
