-- 0084 — WHAT A WORK'S SOURCE FILE SAYS AROUND A QUOTE, KEPT AS ROWS.
--
-- The context is STORED, and that is the whole design (docs/plans/work-source-
-- files.md): GET .../context reads one row here and opens no file. The file is where
-- context comes from ONCE — on attach, and on a rescan that fills in the quotes
-- added since — never a read path. So a quote opens its surroundings whether the
-- file is still there, was pruned, or sat on a mount that is unplugged.
--
-- One row per quote, because the windows barely overlap (measured at 1% on a real
-- book), so a shared span pool would be machinery bought for nothing.
--
-- `before`/`body`/`after` are the FILE'S words, not the reader's: a quote they
-- tidied and the line as published are both worth seeing and only one is here.
-- Units are joined by one newline for a cue and a blank line for a paragraph, so the
-- stored text splits back into units and a narrower window can be rendered out of a
-- wider stored one without the file ("store wide, render narrow").
--
-- want_before/want_after are THIS quote's own adjustment, and NULL is not 0: NULL
-- means "inherit from the work, then the global"; 0 means "nothing, deliberately" —
-- the chapter-start case. Independently nullable, so "nothing before, inherit after"
-- is expressible.
--
-- bound_* say the span ran out at a chapter edge, a long silence or the end of the
-- work instead of reaching the ceiling, so a short span reads as the work's shape and
-- not as a bug.
--
-- THERE IS NO FOREIGN KEY TO THE QUOTE, because the quote is one of three tables
-- (annotation, dialogue, utterance) — the polymorphic pair item_reviews has, and for
-- the same reason it is cleared by AFTER DELETE triggers below rather than by a
-- cascade. Without them a deleted quote would leave its surroundings behind.
CREATE TABLE source_context (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_id     INTEGER NOT NULL REFERENCES work_sources(id) ON DELETE CASCADE,
  subject       TEXT    NOT NULL,          -- annotation | dialogue | utterance
  item_id       INTEGER NOT NULL,
  before        TEXT    NOT NULL DEFAULT '',
  body          TEXT    NOT NULL DEFAULT '',
  after         TEXT    NOT NULL DEFAULT '',
  unit          TEXT    NOT NULL,          -- paragraph | cue
  stored_before INTEGER NOT NULL,
  stored_after  INTEGER NOT NULL,
  want_before   INTEGER,
  want_after    INTEGER,
  -- How far the match was from verbatim: 0 is exact after the fold, anything else is the
  -- edit distance. It is what lets a proposal built from this row say how sure it is
  -- without re-reading the file (locators-from-files: exact and unique is the bucket a
  -- reader may accept together; anything else wants an eye).
  match_dist    INTEGER NOT NULL DEFAULT 0,
  bound_before  INTEGER NOT NULL DEFAULT 0,
  bound_after   INTEGER NOT NULL DEFAULT 0,
  start_at      TEXT    NOT NULL DEFAULT '',
  end_at        TEXT    NOT NULL DEFAULT '',
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX idx_source_context_one ON source_context(user_id, subject, item_id);
CREATE INDEX idx_source_context_source ON source_context(source_id);

CREATE TRIGGER source_context_book_del AFTER DELETE ON annotations
BEGIN DELETE FROM source_context WHERE subject = 'annotation' AND item_id = OLD.id; END;
CREATE TRIGGER source_context_screen_del AFTER DELETE ON dialogues
BEGIN DELETE FROM source_context WHERE subject = 'dialogue' AND item_id = OLD.id; END;
CREATE TRIGGER source_context_utterance_del AFTER DELETE ON utterances
BEGIN DELETE FROM source_context WHERE subject = 'utterance' AND item_id = OLD.id; END;

-- A REFUSED ATTACH PROPOSAL IS KEYED ON A WORK, and a work's id is reused once the highest row
-- is deleted (INTEGER PRIMARY KEY without AUTOINCREMENT, the hazard 0026 is written about). The
-- ignores live in cleanup_ignores under kinds the quote triggers of 0052 cannot reach ('work-book',
-- 'work-screen'), so without these a new book given a deleted book's id would inherit its refusals.
CREATE TRIGGER cleanup_ignores_work_book_del AFTER DELETE ON books
BEGIN DELETE FROM cleanup_ignores WHERE kind = 'work-book' AND item_id = OLD.id; END;
CREATE TRIGGER cleanup_ignores_work_screen_del AFTER DELETE ON movies
BEGIN DELETE FROM cleanup_ignores WHERE kind = 'work-screen' AND item_id = OLD.id; END;
