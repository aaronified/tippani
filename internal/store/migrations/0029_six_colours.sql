-- 0029: widen the colour set from four to six — add 'green' and 'purple'.
--
-- WHY THIS IS FOUR TABLE REBUILDS AND NOT AN ALTER. `color` carries a
-- CHECK (color IN (...)) on annotations, dialogues, utterances and
-- staged_quotes, and SQLite cannot alter a CHECK. The only supported way to
-- change one is the full rebuild dance 0004 and 0018 already use here.
--
-- THIS IS THE MOST DANGEROUS MIGRATION IN THE PROJECT, and the shape 0018
-- explicitly declined to attempt on books/movies. Every hazard, and what
-- answers it:
--
--   1. THREE OF THE FOUR ARE FK PARENTS with ON DELETE CASCADE children —
--      annotation_tags, dialogue_tags, utterance_tags. `PRAGMA foreign_keys` is
--      a no-op inside a transaction and every migration runs inside one, so the
--      cascade CANNOT be turned off: the join rows are parked in a backup table
--      and restored after the rename. Losing them would silently untag a whole
--      library, which no error and no test that counts rows would notice.
--
--   2. THREE BACK EXTERNAL-CONTENT FTS5 INDEXES with live sync triggers. The
--      triggers vanish with the table (they are attached to it) and are
--      recreated verbatim below, then each index is rebuilt from its content
--      table. Rebuilding an external-content FTS5 index while its triggers are
--      live is the documented route to "database disk image is malformed", so
--      the order matters: the index rebuild is the LAST statement for each
--      table, after the triggers exist and the rows are in place.
--
--   3. DROP TABLE FIRES NO TRIGGERS but DOES cascade. SQLite performs an
--      implicit DELETE FROM for foreign-key purposes without running delete
--      triggers — which is why the join rows need parking (cascade) and why the
--      FTS index does NOT self-empty (no triggers), hence the explicit rebuild.
--
--   4. THE THREE item_reviews DELETE TRIGGERS are the polymorphic stand-in for
--      a foreign key the schema cannot express. They go with their tables and
--      are recreated. The item_reviews ROWS survive untouched and still match,
--      because every id is carried across verbatim by the INSERT ... SELECT.
--
-- IDS ARE PRESERVED THROUGHOUT. Everything outside these tables that points at
-- a quote — item_reviews, quiz_sessions, the review log, a shared URL — matches
-- by id, so an id that changed would break a link with no error anywhere.
--
-- The new tokens are appended, never reordered: 'yellow' stays the column
-- default and the value an import writes when the source named no colour.

-- ============================ annotations ============================
CREATE TABLE _annotation_tags_backup AS SELECT * FROM annotation_tags;

CREATE TABLE annotations_new (
  id INTEGER PRIMARY KEY,
  book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  quote TEXT,
  note TEXT,
  color TEXT NOT NULL DEFAULT 'yellow'
    CHECK (color IN ('yellow','blue','pink','orange','green','purple')),
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

DROP TABLE annotations;                  -- cascades: annotation_tags rows (parked)
ALTER TABLE annotations_new RENAME TO annotations;
CREATE INDEX idx_ann_book ON annotations(book_id);

INSERT INTO annotation_tags SELECT * FROM _annotation_tags_backup;
DROP TABLE _annotation_tags_backup;

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
  noted_at TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  color TEXT NOT NULL DEFAULT 'yellow'
    CHECK (color IN ('yellow','blue','pink','orange','green','purple')),
  season INTEGER,
  episode INTEGER,
  UNIQUE (movie_id, dedupe_hash)
);

INSERT INTO dialogues_new
  (id, movie_id, quote, note, character, actor, timestamp, favorite,
   dedupe_hash, created_at, updated_at, sticker_x, sticker_y, sticker_id,
   noted_at, source, color, season, episode)
  SELECT id, movie_id, quote, note, character, actor, timestamp, favorite,
         dedupe_hash, created_at, updated_at, sticker_x, sticker_y, sticker_id,
         noted_at, source, color, season, episode
  FROM dialogues;

DROP TABLE dialogues;                    -- cascades: dialogue_tags rows (parked)
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

-- ============================ utterances ============================
CREATE TABLE _utterance_tags_backup AS SELECT * FROM utterance_tags;

CREATE TABLE utterances_new (
  id         INTEGER PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quote      TEXT NOT NULL,
  note       TEXT,
  color      TEXT NOT NULL DEFAULT 'yellow'
    CHECK (color IN ('yellow','blue','pink','orange','green','purple')),
  favorite   INTEGER NOT NULL DEFAULT 0,
  speaker       TEXT NOT NULL DEFAULT '',
  occasion      TEXT NOT NULL DEFAULT '',
  occasion_date TEXT NOT NULL DEFAULT '',
  place         TEXT NOT NULL DEFAULT '',
  medium        TEXT NOT NULL DEFAULT '',
  source      TEXT NOT NULL DEFAULT 'manual',
  dedupe_hash TEXT NOT NULL,
  noted_at    TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  sticker_x   REAL,
  sticker_y   REAL,
  sticker_id  INTEGER REFERENCES stickers(id) ON DELETE SET NULL,
  -- The occasion is folded into the hash (see 0026): the same words on two
  -- occasions are two quotes. Scoped by user so two accounts can each keep the
  -- same famous line.
  UNIQUE (user_id, dedupe_hash)
);

INSERT INTO utterances_new
  (id, user_id, quote, note, color, favorite, speaker, occasion, occasion_date,
   place, medium, source, dedupe_hash, noted_at, created_at, updated_at,
   sticker_x, sticker_y, sticker_id)
  SELECT id, user_id, quote, note, color, favorite, speaker, occasion, occasion_date,
         place, medium, source, dedupe_hash, noted_at, created_at, updated_at,
         sticker_x, sticker_y, sticker_id
  FROM utterances;

DROP TABLE utterances;                   -- cascades: utterance_tags rows (parked)
ALTER TABLE utterances_new RENAME TO utterances;
CREATE INDEX idx_utterances_user    ON utterances(user_id);
CREATE INDEX idx_utterances_speaker ON utterances(user_id, speaker);

INSERT INTO utterance_tags SELECT * FROM _utterance_tags_backup;
DROP TABLE _utterance_tags_backup;

CREATE TRIGGER utterances_ai AFTER INSERT ON utterances BEGIN
  INSERT INTO utterances_fts(rowid, quote, note, speaker, occasion)
  VALUES (new.id, new.quote, new.note, new.speaker, new.occasion);
END;
CREATE TRIGGER utterances_ad AFTER DELETE ON utterances BEGIN
  INSERT INTO utterances_fts(utterances_fts, rowid, quote, note, speaker, occasion)
  VALUES ('delete', old.id, old.quote, old.note, old.speaker, old.occasion);
END;
CREATE TRIGGER utterances_au AFTER UPDATE ON utterances BEGIN
  INSERT INTO utterances_fts(utterances_fts, rowid, quote, note, speaker, occasion)
  VALUES ('delete', old.id, old.quote, old.note, old.speaker, old.occasion);
  INSERT INTO utterances_fts(rowid, quote, note, speaker, occasion)
  VALUES (new.id, new.quote, new.note, new.speaker, new.occasion);
END;
CREATE TRIGGER item_reviews_utterance_del AFTER DELETE ON utterances BEGIN
  DELETE FROM item_reviews WHERE kind = 'utterance' AND item_id = OLD.id;
END;

INSERT INTO utterances_fts(utterances_fts) VALUES('rebuild');

-- ============================ staged_quotes ============================
-- The easy one, and worth saying why: nothing references staged_quotes, it
-- backs no FTS index and carries no triggers. Its parent staged_works is
-- untouched, so the FK survives the rebuild in the ordinary way.
CREATE TABLE staged_quotes_new (
  id             INTEGER PRIMARY KEY,
  staged_work_id INTEGER NOT NULL REFERENCES staged_works(id) ON DELETE CASCADE,
  quote          TEXT,
  note           TEXT,
  color          TEXT NOT NULL DEFAULT 'yellow'
    CHECK (color IN ('yellow','blue','pink','orange','green','purple')),
  favorite       INTEGER NOT NULL DEFAULT 0,
  chapter        TEXT,
  location       TEXT,
  location_orig  TEXT,
  character      TEXT,
  actor          TEXT,
  timestamp      TEXT,
  timestamp_orig TEXT,
  tags           TEXT NOT NULL DEFAULT '',
  noted_at       TEXT,
  dedupe_hash    TEXT NOT NULL,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  season         INTEGER,
  episode        INTEGER,
  speaker       TEXT NOT NULL DEFAULT '',
  occasion      TEXT NOT NULL DEFAULT '',
  occasion_date TEXT NOT NULL DEFAULT '',
  place         TEXT NOT NULL DEFAULT '',
  medium        TEXT NOT NULL DEFAULT '',
  UNIQUE (staged_work_id, dedupe_hash)
);

INSERT INTO staged_quotes_new
  (id, staged_work_id, quote, note, color, favorite, chapter, location,
   location_orig, character, actor, timestamp, timestamp_orig, tags, noted_at,
   dedupe_hash, created_at, season, episode, speaker, occasion, occasion_date,
   place, medium)
  SELECT id, staged_work_id, quote, note, color, favorite, chapter, location,
         location_orig, character, actor, timestamp, timestamp_orig, tags, noted_at,
         dedupe_hash, created_at, season, episode, speaker, occasion, occasion_date,
         place, medium
  FROM staged_quotes;

DROP TABLE staged_quotes;
ALTER TABLE staged_quotes_new RENAME TO staged_quotes;
CREATE INDEX idx_staged_quotes_work ON staged_quotes(staged_work_id);


-- ============================ tags ============================
-- The fifth table, and the one 0018 explicitly declined to rebuild: it is a
-- foreign-key parent of THREE cascading join tables, and its comment warned that
-- a DROP-TABLE rebuild would take the child rows with it. All three are parked.
--
-- It has to be here. `tags.color` is validated by the same allowlist the quote
-- colours use, so widening one and not the other means the API cheerfully
-- accepts a green tag and the CHECK rejects it — a 500 on a valid request, which
-- is a worse outcome than either set alone.
CREATE TABLE _tag_ann_backup AS SELECT * FROM annotation_tags;
CREATE TABLE _tag_dlg_backup AS SELECT * FROM dialogue_tags;
CREATE TABLE _tag_utt_backup AS SELECT * FROM utterance_tags;

CREATE TABLE tags_new (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'yellow'
    CHECK (color IN ('yellow','blue','pink','orange','green','purple')),
  style TEXT NOT NULL DEFAULT 'sticker'
    CHECK (style IN ('sticker','banner','flyout','tape','reel')),
  UNIQUE(user_id, name)
);

INSERT INTO tags_new (id, user_id, name, color, style)
  SELECT id, user_id, name, color, style FROM tags;

DROP TABLE tags;                         -- cascades: all three tag joins (parked)
ALTER TABLE tags_new RENAME TO tags;

INSERT INTO annotation_tags SELECT * FROM _tag_ann_backup;
INSERT INTO dialogue_tags   SELECT * FROM _tag_dlg_backup;
INSERT INTO utterance_tags  SELECT * FROM _tag_utt_backup;
DROP TABLE _tag_ann_backup;
DROP TABLE _tag_dlg_backup;
DROP TABLE _tag_utt_backup;
