-- 0036: a board is a thing the reader owns, and /quotes lists boards the way
-- the Library lists books.
--
-- 0035 gave a standalone quote a `category` of proverb | speech | other, and the
-- screen drew a segmented control to switch between them. That was the wrong
-- shape and this migration is the correction, not an extension of it.
--
-- WHAT WENT WRONG. The board was built as a FILTER. A filter narrows what you
-- see within a container; the board decides which container you are in. From
-- that one misclassification: the control was handed to WorkListScaffold's
-- `leading` slot, which on a phone renders inside the Filters sheet — so the
-- three boards were invisible on the device this app is designed for first — and
-- which gates its whole row on `hasItems`, meaning the current board is
-- non-empty. Open an empty Speeches board and the control that got you there
-- disappeared, with the choice persisted, so a reload did not rescue you.
--
-- The fix is not to move a control. It is to stop calling it a filter: boards
-- become rows, /quotes lists them, and each opens its own page.
--
-- ---------------------------------------------------------------- boards
--
-- Named by the reader, and NOTHING IN THE CODE MAY KNOW THOSE NAMES. The three
-- seeded below are seeded and then ordinary — renamable, deletable, hidable. The
-- moment 'Others' is special-cased somewhere, renaming it breaks the special case
-- silently, and the reader is the only one who can see that it broke.
--
-- Where a fallback is genuinely needed — the ＋ pressed outside a board, an
-- import naming no board — it is the reader's DEFAULT BOARD, a preference
-- pointing at a row (set below), never a name.
--
-- `color` reuses 0029's six-colour vocabulary rather than taking a free hex, so
-- a board sits in the same palette as everything else and the reader names its
-- colour once, in Settings, for the whole app.
--
-- `image_path` is a filename under MediaCover/ like every other picture here.
-- Nothing FETCHES one: no supplier has a photograph of a board, so it is uploaded
-- or pasted, and an empty one is an honest blank rather than a failed lookup.
--
-- `hidden` is set by the reader and never inferred. An empty board is not a
-- hidden board: a board you have just made is empty, so hiding on emptiness would
-- make it vanish at the moment of creation — the same trap this migration exists
-- to undo. Hiding loses nothing either, because a hidden board's quotes still
-- appear under All quotes.
CREATE TABLE boards (
  id          INTEGER PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT    NOT NULL,
  description TEXT    NOT NULL DEFAULT '',
  color       TEXT    NOT NULL DEFAULT 'yellow'
    CHECK (color IN ('yellow','blue','pink','orange','green','purple')),
  image_path  TEXT    NOT NULL DEFAULT '',
  hidden      INTEGER NOT NULL DEFAULT 0,
  pos         INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  -- Scoped by user, so two accounts each keep their own Proverbs — the same
  -- rule 0027 applies to people and 0026 to the dedupe hash.
  UNIQUE (user_id, name)
);
CREATE INDEX idx_boards_user ON boards(user_id, hidden, pos);

-- ---------------------------------------------------------------- board_id
--
-- One board per quote. Many-to-many was considered and refused: it is what TAGS
-- already are, and two overlapping ways to group the same rows is worse than
-- either alone. Single membership also means the counts add up to the total and
-- moving a quote is a move rather than a copy.
--
-- NULLABLE IN THE SCHEMA AND NEVER NULL IN PRACTICE, and the reason is SQLite's
-- rather than a design choice: ALTER TABLE ADD COLUMN with a REFERENCES clause
-- must default to NULL when foreign keys are on, and they are on here
-- (store.go's DSN sets _pragma=foreign_keys(1)). The alternative is rebuilding
-- `utterances`, which would drag in the drop-and-recreate of its external-content
-- FTS table and all three of its triggers — a great deal of risk to express a
-- constraint the backfill below and the API both enforce anyway.
--
-- ON DELETE RESTRICT is the part that matters. The rule is that deleting a board
-- asks where its quotes go and refuses until told, and this is that rule in the
-- database rather than only in a handler: if the move is ever skipped, the delete
-- fails instead of orphaning a quote. No board has to be permanent to guarantee
-- that, which is what lets all three seeded boards stay ordinary.
ALTER TABLE utterances ADD COLUMN board_id INTEGER REFERENCES boards(id) ON DELETE RESTRICT;
CREATE INDEX idx_utterances_board ON utterances(user_id, board_id);

-- Staged quotes carry it too, so an import that names a board keeps it through
-- review — the same reason 0035 put `category` on staged_quotes.
ALTER TABLE staged_quotes ADD COLUMN board TEXT NOT NULL DEFAULT '';

-- ---------------------------------------------------------------- the seed
--
-- One row per (user, category) that user actually has, so nobody is given a
-- Speeches board they never used. The names are the 0035 vocabulary written the
-- way it was shown on screen.
--
-- `pos` keeps 0035's deliberate order — proverb, speech, other — which ran from
-- the most particular kind to the residual one.
INSERT INTO boards (user_id, name, color, pos)
SELECT DISTINCT u.user_id,
       CASE u.category WHEN 'proverb' THEN 'Proverbs'
                       WHEN 'speech'  THEN 'Speeches'
                       ELSE 'Others' END,
       CASE u.category WHEN 'proverb' THEN 'green'
                       WHEN 'speech'  THEN 'blue'
                       ELSE 'yellow' END,
       CASE u.category WHEN 'proverb' THEN 0
                       WHEN 'speech'  THEN 1
                       ELSE 2 END
FROM utterances u;

-- Every reader who has any quote at all gets an Others board even if none of
-- their quotes were 'other', because that is what the default-board preference
-- below points at and what the ＋ outside a board needs somewhere to write to.
INSERT INTO boards (user_id, name, color, pos)
SELECT DISTINCT u.user_id, 'Others', 'yellow', 2
FROM utterances u
WHERE NOT EXISTS (
  SELECT 1 FROM boards b WHERE b.user_id = u.user_id AND b.name = 'Others'
);

UPDATE utterances
SET board_id = (
  SELECT b.id FROM boards b
  WHERE b.user_id = utterances.user_id
    AND b.name = CASE utterances.category
                   WHEN 'proverb' THEN 'Proverbs'
                   WHEN 'speech'  THEN 'Speeches'
                   ELSE 'Others' END
);

-- ---------------------------------------------------------------- the default
--
-- Held as a preference pointing at a ROW, so renaming Others does not break it
-- and deleting Others is a matter of pointing it somewhere else rather than a
-- forbidden operation. Written per user into the same JSON blob every other
-- preference lives in.
--
-- json_set on a NULL/'' preferences blob would produce NULL, so the COALESCE
-- gives an empty object to write into first.
UPDATE users
SET preferences = json_set(
      CASE WHEN COALESCE(preferences,'') = '' THEN '{}' ELSE preferences END,
      '$.defaultBoardId',
      (SELECT b.id FROM boards b WHERE b.user_id = users.id AND b.name = 'Others')
    )
WHERE EXISTS (SELECT 1 FROM boards b WHERE b.user_id = users.id AND b.name = 'Others');

-- `category` is LEFT IN PLACE, deliberately and for one release. Dropping a
-- column is the one migration step that cannot be walked back by hand, and the
-- backfill above is the only thing standing between the reader's filing and a
-- board full of everything. It stops being written by the API in this release and
-- can be dropped in the next, once a version has shipped that proves the mapping
-- held on a real library rather than on this file's reading of one.
