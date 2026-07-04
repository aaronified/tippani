-- Movies + dialogues (see docs/PLAN.md §3b). Movies mirror books; dialogues
-- mirror annotations but carry timestamp/character/actor instead of
-- chapter/location, and have no colour/tags. The genres table is shared.

CREATE TABLE movies (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  director TEXT,
  release_year INTEGER,
  tmdb_id INTEGER,
  poster_path TEXT,                      -- local file under data/covers/
  description TEXT,
  genre_text TEXT NOT NULL DEFAULT '',   -- denormalized, space-joined (FTS input)
  cast_json TEXT NOT NULL DEFAULT '[]',  -- [{"character":"…","actor":"…"}] from TMDB credits
  source_metadata TEXT,                  -- raw TMDB payload (json)
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX idx_movies_user_tmdb ON movies(user_id, tmdb_id) WHERE tmdb_id IS NOT NULL;

CREATE TABLE movie_genres (
  movie_id INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  genre_id INTEGER NOT NULL REFERENCES genres(id) ON DELETE CASCADE,
  PRIMARY KEY (movie_id, genre_id)
);
CREATE INDEX idx_mg_genre ON movie_genres(genre_id, movie_id);

CREATE TABLE dialogues (
  id INTEGER PRIMARY KEY,
  movie_id INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  quote TEXT NOT NULL,
  note TEXT,
  character TEXT,                        -- who says it
  actor TEXT,                            -- who plays them (auto-filled from cast_json on match)
  timestamp TEXT,                        -- free text; HH:MM:SS sorts lexically
  favorite INTEGER NOT NULL DEFAULT 0,   -- star flag (annotations get theirs in 0004)
  rating INTEGER NOT NULL DEFAULT 0      -- 0 = unrated, else 1-5
    CHECK (rating BETWEEN 0 AND 5),
  dedupe_hash TEXT NOT NULL,             -- sha256(lower(collapse_ws(quote)))
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (movie_id, dedupe_hash)
);
CREATE INDEX idx_dlg_movie ON dialogues(movie_id);

-- Dialogues share the per-user tags table with annotations.
CREATE TABLE dialogue_tags (
  dialogue_id INTEGER NOT NULL REFERENCES dialogues(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (dialogue_id, tag_id)
);
CREATE INDEX idx_dt_tag ON dialogue_tags(tag_id, dialogue_id);

-- FTS mirrors books/annotations (PLAN §4); dialogues also index character +
-- actor so "everything Bogart says" is one search away.

CREATE VIRTUAL TABLE movies_fts USING fts5(
  title, director, genre_text,
  content='movies', content_rowid='id',
  tokenize='unicode61 remove_diacritics 2',
  prefix='2 3'
);

CREATE TRIGGER movies_ai AFTER INSERT ON movies BEGIN
  INSERT INTO movies_fts(rowid, title, director, genre_text)
  VALUES (new.id, new.title, new.director, new.genre_text);
END;
CREATE TRIGGER movies_ad AFTER DELETE ON movies BEGIN
  INSERT INTO movies_fts(movies_fts, rowid, title, director, genre_text)
  VALUES ('delete', old.id, old.title, old.director, old.genre_text);
END;
CREATE TRIGGER movies_au AFTER UPDATE ON movies BEGIN
  INSERT INTO movies_fts(movies_fts, rowid, title, director, genre_text)
  VALUES ('delete', old.id, old.title, old.director, old.genre_text);
  INSERT INTO movies_fts(rowid, title, director, genre_text)
  VALUES (new.id, new.title, new.director, new.genre_text);
END;

CREATE VIRTUAL TABLE dialogues_fts USING fts5(
  quote, note, character, actor,
  content='dialogues', content_rowid='id',
  tokenize='unicode61 remove_diacritics 2',
  prefix='2 3'
);

CREATE TRIGGER dialogues_ai AFTER INSERT ON dialogues BEGIN
  INSERT INTO dialogues_fts(rowid, quote, note, character, actor)
  VALUES (new.id, new.quote, new.note, new.character, new.actor);
END;
CREATE TRIGGER dialogues_ad AFTER DELETE ON dialogues BEGIN
  INSERT INTO dialogues_fts(dialogues_fts, rowid, quote, note, character, actor)
  VALUES ('delete', old.id, old.quote, old.note, old.character, old.actor);
END;
CREATE TRIGGER dialogues_au AFTER UPDATE ON dialogues BEGIN
  INSERT INTO dialogues_fts(dialogues_fts, rowid, quote, note, character, actor)
  VALUES ('delete', old.id, old.quote, old.note, old.character, old.actor);
  INSERT INTO dialogues_fts(rowid, quote, note, character, actor)
  VALUES (new.id, new.quote, new.note, new.character, new.actor);
END;
