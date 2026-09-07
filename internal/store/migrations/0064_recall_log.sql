-- 0064 — WHAT THE READER ACTUALLY ANSWERED, one row per answer.
--
-- THE OWNER: "when i click on the spaced repetition icon in the quote cards, it
-- should show a popup for the halflife status, and recall history (will need to
-- create a recall history table), like the infodots… we will also do a complete
-- overhaul of the spaced repetition system after this."
--
-- WHAT EXISTS AND WHY IT CANNOT ANSWER THAT. `item_reviews` (0015) is a CURRENT
-- STATE: one row per item holding the half-life, the counts and the last result.
-- It is exactly what a scheduler needs and it has no memory — the answer before
-- last is gone, so nothing can say when a card was forgotten, whether it is
-- getting easier, or how a half-life of 30 days was arrived at. `quiz_results`
-- (0014) keeps a total and a correct count per SESSION, which is the same
-- information about a different thing: how a sitting went, not how a card is
-- doing. Neither can draw a history for one quote.
--
-- SO: A LOG, APPEND-ONLY, AND IT IS NOT THE SCHEDULER'S INPUT. `item_reviews`
-- stays the state the scheduler reads and writes; this table is written beside
-- it and read by nothing that decides anything. That separation is deliberate
-- with an overhaul coming: a scheduler that derives its state by replaying a log
-- is a different design, and if the overhaul wants that it can build it FROM this
-- table without a migration to fill it, because it will already be full.
--
-- WHAT EACH ROW HAS TO CARRY TO BE WORTH KEEPING. Not just "got at 14:02": the
-- half-life the answer PRODUCED, and how long it had been since the last one. A
-- log of results alone cannot draw the curve the popup is about, and recomputing
-- the curve later from the ladder in `review_handlers.go` would be recomputing it
-- from a ladder that the overhaul is about to change. What the app believed at the
-- time is the fact; what it would believe now is a different fact.
--
-- `user_id` IS HERE EVEN THOUGH `item_reviews` HAS NONE. That table is always
-- reached by a JOIN onto an already-scoped item query, which is a real isolation
-- story and an invisible one — nothing about the table itself says "this row
-- belongs to somebody". The repo's invariant is stated flatly ("every query
-- scoped by user_id"), a log is the kind of table a later stats screen will want
-- to read per reader rather than per item, and eight bytes a row buys a guard that
-- can be checked by reading one query instead of tracing its joins.
CREATE TABLE item_recalls (
  id           INTEGER PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL,               -- 'book' | 'screen', as item_reviews
  item_id      INTEGER NOT NULL,            -- annotations.id | dialogues.id
  result       TEXT NOT NULL,               -- got | forgot | skip, app-validated
  -- THE HALF-LIFE THIS ANSWER LEFT BEHIND, in days, so the curve can be drawn
  -- from the log rather than recomputed from whatever ladder is current.
  stability    REAL NOT NULL,
  -- HOW LONG SINCE THE PREVIOUS ANSWER, in days, and NULL for the first one —
  -- which is a real answer and not a missing number. Zero would say "answered
  -- twice in the same instant", which is a different thing.
  elapsed_days REAL,
  answered_at  TEXT NOT NULL
);

-- The two reads this table is for: one item's history, newest first, and one
-- reader's, for anything that later wants a streak or a rate.
CREATE INDEX idx_item_recalls_item ON item_recalls(kind, item_id, answered_at);
CREATE INDEX idx_item_recalls_user ON item_recalls(user_id, answered_at);

-- POLYMORPHIC FK STAND-INS, the same pair 0015 wrote for `item_reviews`: SQLite
-- cannot reference two tables from one column, so a deleted quote takes its log
-- with it by trigger. Without these a reader who deletes a quote leaves its
-- recall history behind, and the next quote to be given that rowid inherits
-- somebody else's memory of it.
CREATE TRIGGER item_recalls_book_del AFTER DELETE ON annotations BEGIN
  DELETE FROM item_recalls WHERE kind = 'book' AND item_id = OLD.id;
END;
CREATE TRIGGER item_recalls_screen_del AFTER DELETE ON dialogues BEGIN
  DELETE FROM item_recalls WHERE kind = 'screen' AND item_id = OLD.id;
END;
