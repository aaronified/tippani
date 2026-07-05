-- Owner-requested enrichments (this session), three themes in one migration:
--   * book/movie-level favorite + rating — mirrors the annotation/dialogue
--     columns added in 0004; drives list sort/filter.
--   * series metadata (name + fractional index) on books AND movies — for
--     grouping/sorting a franchise or reading order.
--   * folding TV shows into movies: a media_type flag ('movie'|'show') plus a
--     tvdb_id for the second metadata supplier (TheTVDB), with its own partial
--     unique index mirroring tmdb_id.
--
-- Plain ALTER TABLE ADD COLUMN, no table rebuild: books_fts / movies_fts are
-- external-content FTS over title/author/director/genre_text only, so neither
-- the FTS tables nor their triggers reference these columns — nothing to change.
-- rating keeps the same CHECK as annotations/dialogues; media_type is validated
-- in app code (0004 established that SQLite can't evolve CHECKs, so new
-- open-ended vocabularies live in the app layer).

ALTER TABLE books ADD COLUMN favorite INTEGER NOT NULL DEFAULT 0;
ALTER TABLE books ADD COLUMN rating INTEGER NOT NULL DEFAULT 0
  CHECK (rating BETWEEN 0 AND 5);
ALTER TABLE books ADD COLUMN series TEXT;
ALTER TABLE books ADD COLUMN series_index REAL;   -- fractional (e.g. 1.5) reading order

ALTER TABLE movies ADD COLUMN favorite INTEGER NOT NULL DEFAULT 0;
ALTER TABLE movies ADD COLUMN rating INTEGER NOT NULL DEFAULT 0
  CHECK (rating BETWEEN 0 AND 5);
ALTER TABLE movies ADD COLUMN series TEXT;         -- franchise / collection name
ALTER TABLE movies ADD COLUMN series_index REAL;
ALTER TABLE movies ADD COLUMN media_type TEXT NOT NULL DEFAULT 'movie'; -- 'movie' | 'show'
ALTER TABLE movies ADD COLUMN tvdb_id INTEGER;

-- Per-user dedupe on the TVDB id, mirroring idx_movies_user_tmdb (0003).
CREATE UNIQUE INDEX idx_movies_user_tvdb ON movies(user_id, tvdb_id) WHERE tvdb_id IS NOT NULL;
