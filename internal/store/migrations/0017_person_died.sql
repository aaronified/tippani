-- 0017: death year for people (authors / actors / directors). Populated
-- automatically alongside `born` when the source carries it (Open Library
-- death_date, TMDB deathday), or entered by hand in the person edit card.
ALTER TABLE people ADD COLUMN died TEXT NOT NULL DEFAULT '';
