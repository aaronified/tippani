-- 0081 — WHO SUPPLIED A PORTRAIT, A CHARACTER'S PICTURE, AND EACH OF A PERSON'S LINKS.
--
-- The owner chose "Every path" records its source, and for a person's page "Links
-- auto/you + portrait source". people.source is the identity a record is pinned
-- to, not the supplier of its picture (an author's photo from Wikipedia was filed
-- under "openlibrary"), and nothing said who added a link.
--
-- image_source: the supplier slug a picture came from, 'manual' for one the
-- reader chose or uploaded, '' for unknown (everything before this).
-- link_sources: a JSON object from each link's address to its source, the same
-- vocabulary; an address with no entry is unknown. Kept beside `links` rather
-- than in a table of its own because `links` is free text the reader edits as one
-- field, and the two are written together in every transaction that writes it.
ALTER TABLE people ADD COLUMN image_source TEXT NOT NULL DEFAULT '';
ALTER TABLE people ADD COLUMN link_sources TEXT NOT NULL DEFAULT '';
ALTER TABLE characters ADD COLUMN image_source TEXT NOT NULL DEFAULT '';
ALTER TABLE work_cast ADD COLUMN character_image_source TEXT NOT NULL DEFAULT '';
