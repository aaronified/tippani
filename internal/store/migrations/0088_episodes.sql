-- 0088: an episode of a series has a name of its own, and up to three orders.
--
-- A line of dialogue carries (season, episode) and a typed name since 0025 and 0047, so
-- one episode's name was repeated on every line of it and could disagree with itself. An
-- `episodes` row is the one place the name lives, and `episode_orders` holds where the
-- episode sits in each numbering the reader can show. A real reordering moves the season
-- as well, so one position cannot hold it: each order maps the episode to a PAIR.
--
-- `kind` is free text on purpose and has no CHECK, as movies.media_type has none: `tv` is
-- the order the lines are stored in, `dvd` is the provider's published alternative
-- (read-only), `custom` is the reader's. A fourth order is a row, not a migration.
--
-- dialogues.season / dialogues.episode ALWAYS hold the `tv` order. They sit inside the
-- dedupe hash and the per-series unique key, so switching the order shown rewrites and
-- rehashes nothing. `movies.episode_order` is only which order is SHOWN; '' means `tv`.
--
-- Neither table has a user_id: an episode belongs to its series, which belongs to a user,
-- and both go with the series (ON DELETE CASCADE).
CREATE TABLE episodes (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  movie_id  INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  name      TEXT    NOT NULL DEFAULT '',
  overview  TEXT    NOT NULL DEFAULT '',
  air_date  TEXT    NOT NULL DEFAULT '',
  -- Who wrote the name: 'lines' (seeded from a quote's own), 'reader', or a provider's
  -- word. A refetch never overwrites a name the reader wrote.
  source    TEXT    NOT NULL DEFAULT ''
);
CREATE INDEX idx_episodes_movie ON episodes(movie_id);

CREATE TABLE episode_orders (
  episode_id INTEGER NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  kind       TEXT    NOT NULL,
  season     INTEGER NOT NULL,
  episode    INTEGER NOT NULL,
  UNIQUE (episode_id, kind)
);

ALTER TABLE movies ADD COLUMN episode_order TEXT NOT NULL DEFAULT '';
