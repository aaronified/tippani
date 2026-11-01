-- 0090: an anthology's front matter: a cover picture, an epigraph and a dedication.
--
-- The cover is one of the reader's images, stored like every other (a file named in this column,
-- under MediaCover), and is the EPUB's cover. The epigraph and the dedication are the reader's own
-- prose, a line or two each. All three default to nothing, and an anthology without them reads and
-- exports exactly as it did.
--
-- They are written through a route of their own and not the anthology's full-state PUT, for the
-- reason group_by and the rule columns are: a form that has not heard of a column would clear it.
ALTER TABLE anthologies ADD COLUMN cover_path TEXT;
ALTER TABLE anthologies ADD COLUMN epigraph   TEXT NOT NULL DEFAULT '';
ALTER TABLE anthologies ADD COLUMN dedication TEXT NOT NULL DEFAULT '';

-- Carried through the staging queue on every entry of an imported file, like the introduction, and
-- written only on the anthology the import creates.
ALTER TABLE staged_quotes ADD COLUMN anthology_epigraph   TEXT NOT NULL DEFAULT '';
ALTER TABLE staged_quotes ADD COLUMN anthology_dedication TEXT NOT NULL DEFAULT '';
