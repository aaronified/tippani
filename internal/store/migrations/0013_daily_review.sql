-- 0013: spaced-repetition daily review (ROADMAP №2). One state row per
-- annotation, created lazily the first time a card is answered or skipped —
-- annotations with no row are the "unseen" pool.
--
-- The model is the exponential forgetting curve (Ebbinghaus): recall
-- probability p = 2^(-elapsed_days / stability), where `stability` is the
-- memory half-life in days. A card is due when p <= 0.5, i.e. when
-- elapsed >= stability, so both "due" and most-forgotten-first ordering
-- reduce to the plain ratio elapsed/stability — the decay is computed in
-- SQL at query time with julianday() arithmetic, no math functions, no
-- background jobs (PLAN §2), nothing stored ever ticks.
--
-- Answers move the half-life (expanding retrieval, SM-2 family; the exact
-- update rule lives in internal/httpapi/review_handlers.go):
--   got:    stability' = min(365, max(stability * 2.5, elapsed * 1.2))
--   forgot: stability' = max(1, stability * 0.25)   -- lapse, not a hard reset
--   skip:   stability untouched; only last_touched_at moves, so the card
--           sits out the rest of the local day.
-- Mastery (SOON / LATER / SOMEDAY) is derived from stability in queries,
-- never stored. The outcome vocabulary (got|forgot|skip) is app-validated,
-- not a CHECK (0004 lesson: SQLite cannot evolve CHECK constraints).
--
-- Per-user via the annotations→books parent chain; rows die with their
-- annotation. No FTS impact (annotations_fts indexes quote/note only) and
-- review state never enters the dedupe hash. last_touched_at has no DEFAULT
-- because rows are only ever created by the review endpoint, which stamps it.

CREATE TABLE annotation_reviews (
  annotation_id    INTEGER PRIMARY KEY REFERENCES annotations(id) ON DELETE CASCADE,
  stability        REAL NOT NULL DEFAULT 1.0,  -- memory half-life, days
  review_count     INTEGER NOT NULL DEFAULT 0, -- got/forgot answers recorded
  lapse_count      INTEGER NOT NULL DEFAULT 0, -- "forgot" answers
  last_result      TEXT NOT NULL DEFAULT '',   -- got | forgot | skip (app-validated)
  last_reviewed_at TEXT,                       -- UTC; moved by got/forgot only
  last_touched_at  TEXT NOT NULL               -- UTC; moved by every answer, skip included
);
