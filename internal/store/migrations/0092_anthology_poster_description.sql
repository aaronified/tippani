-- 0092: an anthology reads like a book: a landscape poster and a description the reader writes.
--
-- The poster is one of the reader's images, stored like every other (a file named in this column,
-- under MediaCover). It is LANDSCAPE, drawn as the banner of the anthology's page and its list row;
-- the cover (0090) stays the portrait jacket the EPUB opens with. The description is the blurb: a few
-- lines the reader types, apart from the introduction that opens the book itself. Both default to
-- nothing, so an anthology without them reads and exports exactly as it did.
--
-- Written through the front route and the poster upload, never the anthology's full-state PUT, for
-- the reason the cover and the epigraph are: a form that has not heard of a column would clear it.
ALTER TABLE anthologies ADD COLUMN poster_path TEXT;
ALTER TABLE anthologies ADD COLUMN description TEXT NOT NULL DEFAULT '';

-- The description rides an anthology's Markdown export and import like the epigraph does, so a staged
-- entry carries it until approval creates the anthology.
ALTER TABLE staged_quotes ADD COLUMN anthology_description TEXT NOT NULL DEFAULT '';
