-- 0015: spaced-repetition rework (v0.5.0). Two things change.
--
-- 1. The review schedule becomes polymorphic. 0013's annotation_reviews only
--    covered book quotes; the Daily Quiz and Practice now cover films/shows
--    too, and every quote in the Library AND the Catalogue carries a status
--    dot. So one row per reviewable item, keyed by (kind, item_id):
--      kind='book'   -> item_id references annotations(id)
--      kind='screen' -> item_id references dialogues(id)
--    A polymorphic table can't hold a real foreign key to two parents, so
--    ON DELETE CASCADE is replaced by AFTER DELETE triggers on each parent.
--    Existing book review state is carried forward verbatim (kind='book').
--
--    The memory model is unchanged (exponential forgetting curve, half-life =
--    stability in days; the update rule lives in review_handlers.go). Only the
--    surface widens from books to books+screen. Status names are derived, never
--    stored — remembered / forgetting / probably-forgotten replace the old
--    soon/later/someday buckets and are computed from recall probability
--    p = 2^(-elapsed/stability) at read time.
--
-- 2. Scores are logged per session, per mode. 0014's quiz_results modelled the
--    old MCQ round and can't express the daily-vs-practice split, so it is
--    replaced by quiz_sessions: one row per reviewer-local day per mode.
--      mode='daily'    -> permanent learning history + streaks (authoritative
--                         schedule driver); one row/day.
--      mode='practice' -> the separate, resettable practice score; one row/day.
--    answered = got + forgot (skips, Practice-only, are not answers). Old
--    quiz_results scores do not map onto this model and are dropped (noted in
--    CHANGELOG 0.5.0); the schedule itself (item_reviews) is preserved.
--
-- Both new tables are ordinary base tables: they survive store.Recover() (they
-- match no %_fts pattern) and never enter any dedupe hash or FTS index.

CREATE TABLE item_reviews (
  kind             TEXT NOT NULL,              -- 'book' | 'screen'
  item_id          INTEGER NOT NULL,          -- annotations.id (book) / dialogues.id (screen)
  stability        REAL NOT NULL DEFAULT 1.0, -- memory half-life, days
  review_count     INTEGER NOT NULL DEFAULT 0,
  lapse_count      INTEGER NOT NULL DEFAULT 0,
  last_result      TEXT NOT NULL DEFAULT '',   -- got | forgot | skip (app-validated)
  last_reviewed_at TEXT,                        -- UTC; moved by got/forgot only
  last_touched_at  TEXT NOT NULL,               -- UTC; moved by every answer, skip included
  PRIMARY KEY (kind, item_id)
);

-- Carry 0013's book review state forward.
INSERT INTO item_reviews (kind, item_id, stability, review_count, lapse_count,
                          last_result, last_reviewed_at, last_touched_at)
SELECT 'book', annotation_id, stability, review_count, lapse_count,
       last_result, last_reviewed_at, last_touched_at
FROM annotation_reviews;

-- Polymorphic FK stand-ins: a deleted quote takes its review row with it.
CREATE TRIGGER item_reviews_book_del AFTER DELETE ON annotations BEGIN
  DELETE FROM item_reviews WHERE kind = 'book' AND item_id = OLD.id;
END;
CREATE TRIGGER item_reviews_screen_del AFTER DELETE ON dialogues BEGIN
  DELETE FROM item_reviews WHERE kind = 'screen' AND item_id = OLD.id;
END;

DROP TABLE annotation_reviews;

CREATE TABLE quiz_sessions (
  id        INTEGER PRIMARY KEY,
  user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode      TEXT NOT NULL,               -- 'daily' | 'practice' (app-validated)
  day       TEXT NOT NULL,               -- reviewer-local YYYY-MM-DD
  answered  INTEGER NOT NULL DEFAULT 0,  -- got + forgot (skips excluded)
  got       INTEGER NOT NULL DEFAULT 0,
  forgot    INTEGER NOT NULL DEFAULT 0,
  taken_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, mode, day)
);
CREATE INDEX idx_quiz_sessions_user ON quiz_sessions(user_id, mode);

DROP TABLE quiz_results;
