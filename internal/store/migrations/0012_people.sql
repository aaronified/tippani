-- 0012: per-name metadata for the people already referenced as free text —
-- book.author and dialogue.actor (+ movie cast). No link tables (KISS): a row is
-- keyed by (user_id, kind, name) and matched to a book/film by exact name, so
-- clicking an author or actor surfaces their bio/photo/links, and a group-by
-- author/actor heading can show the portrait. Fetched from Open Library / Amazon
-- (authors) or TMDB / TheTVDB (actors), or entered by hand.
--
-- image_path is a filename under <DataDir>/MediaCover (same StoreImage pipeline
-- as covers/posters). Deleting a user cascades their people rows; the free-text
-- author/actor strings on books/movies are untouched (this is pure enrichment).
CREATE TABLE people (
  id         INTEGER PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL,               -- 'author' | 'actor'
  name       TEXT NOT NULL,               -- matches book.author / dialogue.actor verbatim
  bio        TEXT NOT NULL DEFAULT '',
  image_path TEXT NOT NULL DEFAULT '',    -- filename under MediaCover/
  born       TEXT NOT NULL DEFAULT '',    -- birth date/year (freeform)
  links      TEXT NOT NULL DEFAULT '',    -- homepage / wikipedia etc. (freeform)
  source     TEXT NOT NULL DEFAULT '',    -- openlibrary|amazon|tmdb|tvdb|manual
  source_id  TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, kind, name)
);
CREATE INDEX idx_people_user_kind ON people(user_id, kind);
