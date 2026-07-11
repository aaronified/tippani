-- 0014: recall quiz results. One row per completed quiz (a short MCQ round
-- built from the user's own annotations/dialogues), so the Home screen can
-- show an overall score the user can flush. Per-user, hard delete, no FTS.
--
-- The questions themselves are generated on the fly from annotations +
-- dialogues (no stored question bank) and each answered annotation also nudges
-- its annotation_reviews stability (a quiz counts as a revision), so nothing
-- about the questions needs persisting — only the tally.
CREATE TABLE quiz_results (
  id       INTEGER PRIMARY KEY,
  user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  total    INTEGER NOT NULL,              -- questions answered
  correct  INTEGER NOT NULL,              -- of those, right
  taken_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_quiz_user ON quiz_results(user_id);
