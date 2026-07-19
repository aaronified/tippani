-- 0018: fully retire ratings (favourites-only). Drop the vestigial 1-5 `rating`
-- column (and its CHECK) from the two tables where the star rating actually
-- lived: annotations (book quotes) and dialogues (screen lines). A prior pass
-- (CHANGELOG "Favourite-only") removed the rating UI but kept the columns; this
-- removes them from the schema too.
--
-- SQLite can't DROP a column named in a table CHECK, so each table is rebuilt
-- (the 0004 dance): park the tag-join rows (dropped by ON DELETE CASCADE when the
-- table goes), recreate the table without `rating` — reproducing its FULL current
-- shape (0004 base + 0008 noted_at + 0009 sticker_x/y + 0011 sticker_id) — restore
-- the joins, then recreate every trigger the table carries: the three FTS sync
-- triggers AND the 0015 item_reviews delete-trigger (the polymorphic spaced-
-- repetition FK stand-in), and resync the FTS index. item_reviews rows survive
-- untouched (no FK, and DROP TABLE's implicit delete fires no triggers) and still
-- match by the preserved ids.
--
-- books.rating / movies.rating (added in 0006) are DELIBERATELY LEFT as inert,
-- always-zero dead columns: those tables are FK parents of annotations/dialogues,
-- so a DROP-TABLE rebuild would cascade-delete the child rows (and desync their
-- FTS) — not worth it for a hidden column the code no longer reads or writes.

-- ============================ annotations ============================
CREATE TABLE _annotation_tags_backup AS SELECT * FROM annotation_tags;

CREATE TABLE annotations_new (
  id INTEGER PRIMARY KEY,
  book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  quote TEXT,
  note TEXT,
  color TEXT NOT NULL DEFAULT 'yellow'
    CHECK (color IN ('yellow','blue','pink','orange')),
  chapter TEXT,
  location TEXT,
  source TEXT NOT NULL,
  favorite INTEGER NOT NULL DEFAULT 0,
  dedupe_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  noted_at TEXT,
  sticker_x REAL,
  sticker_y REAL,
  sticker_id INTEGER REFERENCES stickers(id) ON DELETE SET NULL,
  CHECK (quote IS NOT NULL OR note IS NOT NULL),
  UNIQUE (book_id, dedupe_hash)
);

INSERT INTO annotations_new
  (id, book_id, quote, note, color, chapter, location, source, favorite,
   dedupe_hash, created_at, updated_at, noted_at, sticker_x, sticker_y, sticker_id)
  SELECT id, book_id, quote, note, color, chapter, location, source, favorite,
         dedupe_hash, created_at, updated_at, noted_at, sticker_x, sticker_y, sticker_id
  FROM annotations;

DROP TABLE annotations;                  -- cascades: annotation_tags rows (backed up)
ALTER TABLE annotations_new RENAME TO annotations;
CREATE INDEX idx_ann_book ON annotations(book_id);

INSERT INTO annotation_tags SELECT * FROM _annotation_tags_backup;
DROP TABLE _annotation_tags_backup;

-- FTS sync triggers (PLAN §4) — recreate verbatim.
CREATE TRIGGER annotations_ai AFTER INSERT ON annotations BEGIN
  INSERT INTO annotations_fts(rowid, quote, note)
  VALUES (new.id, new.quote, new.note);
END;
CREATE TRIGGER annotations_ad AFTER DELETE ON annotations BEGIN
  INSERT INTO annotations_fts(annotations_fts, rowid, quote, note)
  VALUES ('delete', old.id, old.quote, old.note);
END;
CREATE TRIGGER annotations_au AFTER UPDATE ON annotations BEGIN
  INSERT INTO annotations_fts(annotations_fts, rowid, quote, note)
  VALUES ('delete', old.id, old.quote, old.note);
  INSERT INTO annotations_fts(rowid, quote, note)
  VALUES (new.id, new.quote, new.note);
END;

-- 0015 spaced-repetition FK stand-in — recreate.
CREATE TRIGGER item_reviews_book_del AFTER DELETE ON annotations BEGIN
  DELETE FROM item_reviews WHERE kind = 'book' AND item_id = OLD.id;
END;

INSERT INTO annotations_fts(annotations_fts) VALUES('rebuild');

-- ============================ dialogues ============================
CREATE TABLE _dialogue_tags_backup AS SELECT * FROM dialogue_tags;

CREATE TABLE dialogues_new (
  id INTEGER PRIMARY KEY,
  movie_id INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  quote TEXT NOT NULL,
  note TEXT,
  character TEXT,
  actor TEXT,
  timestamp TEXT,
  favorite INTEGER NOT NULL DEFAULT 0,
  dedupe_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  sticker_x REAL,
  sticker_y REAL,
  sticker_id INTEGER REFERENCES stickers(id) ON DELETE SET NULL,
  UNIQUE (movie_id, dedupe_hash)
);

INSERT INTO dialogues_new
  (id, movie_id, quote, note, character, actor, timestamp, favorite,
   dedupe_hash, created_at, updated_at, sticker_x, sticker_y, sticker_id)
  SELECT id, movie_id, quote, note, character, actor, timestamp, favorite,
         dedupe_hash, created_at, updated_at, sticker_x, sticker_y, sticker_id
  FROM dialogues;

DROP TABLE dialogues;                    -- cascades: dialogue_tags rows (backed up)
ALTER TABLE dialogues_new RENAME TO dialogues;
CREATE INDEX idx_dlg_movie ON dialogues(movie_id);

INSERT INTO dialogue_tags SELECT * FROM _dialogue_tags_backup;
DROP TABLE _dialogue_tags_backup;

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

CREATE TRIGGER item_reviews_screen_del AFTER DELETE ON dialogues BEGIN
  DELETE FROM item_reviews WHERE kind = 'screen' AND item_id = OLD.id;
END;

INSERT INTO dialogues_fts(dialogues_fts) VALUES('rebuild');
