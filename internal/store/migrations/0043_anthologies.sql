-- 0043: an anthology — a named, ordered list of quotes drawn from anywhere in
-- the library, carrying prose of its own (ROADMAP #anthologies, issue #18).
--
-- IT IS NOT A TAG WITH A NICER HAT, and the two things a tag cannot do are the
-- whole feature: hold an ORDER, and hold YOUR WRITING. Everything else in this
-- schema points inward — you file a passage, you find it again, you get asked
-- about it. This is the first thing a reader MAKES out of the collection.
--
-- ---------------------------------------------------------------- anthologies
--
-- `intro` is the prose before the first entry, and `note` on each entry below is
-- the prose before that entry. Two columns, one idea: an anthology is a document
-- with quotes in it, not a list with a description attached.
--
-- No `hidden`, no `color`, no `image_path` — boards (0036) carry all three and an
-- anthology is not a shelf. A shelf is somewhere to put things and wants to be
-- recognisable at a glance in a grid of shelves; an anthology is read.
CREATE TABLE anthologies (
  id         INTEGER PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  intro      TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_anthologies_user ON anthologies(user_id, id);

-- ---------------------------------------------------------------- entries
--
-- POSITION IS A REAL, NOT AN INTEGER, and this is the one decision here worth
-- arguing about. Dragging an entry between two others with integer positions
-- rewrites every row after it; with a float it writes ONE row, at the midpoint of
-- its new neighbours. A personal anthology is thirty entries, so neither is slow
-- — the reason is the failure mode rather than the speed. The renumbering version
-- has to succeed for every row or the order is corrupt, and it runs on every
-- drag; the midpoint version touches one row and cannot leave a half-order behind.
--
-- The float's own failure mode is exhaustion of precision after enough repeated
-- midpoint splits between the same two neighbours. A double has ~52 bits of
-- mantissa, so that is about fifty successive splits in one gap — reachable by a
-- script and not by a reader, and the handler renormalises the whole anthology to
-- 1, 2, 3… when a gap gets too small to halve, which is the one place a full
-- rewrite is the right answer because it is not on the common path.
--
-- THE ENTRY IS POLYMORPHIC AND CARRIES NO FOREIGN KEY, exactly as item_reviews
-- (0015) and work_reads (0024) do, because a table cannot hold a real FK to three
-- different parents. That has a cost this schema has already paid twice and pays
-- again here: nothing in the database makes a deleted quote take its entries with
-- it, so the three AFTER DELETE triggers below are the foreign key, written out.
-- 0018's warning now covers a fourth join: hand-recreate them after any table
-- rebuild or an anthology silently keeps rows pointing at quotes that are gone.
--
-- `kind` USES THE VOCABULARY item_reviews ALREADY ESTABLISHED — book | screen |
-- utterance — and NOT the annotation | dialogue | utterance the plan for this
-- feature proposed. Three reasons, and the third is the one that decided it: the
-- two tables are the same shape and should read the same way; the themed-review
-- clause joins this table against reviewSource.kind directly, so a second
-- spelling would need a mapping in the one place a mistake is invisible (a wrong
-- kind matches no rows, and a themed round that draws nothing looks like an empty
-- anthology); and a second name for one idea is the drift this repo keeps writing
-- entries about. It is spelled 'screen' rather than 'dialogue' for the same
-- reason item_reviews is: a film line and a television line are one kind.
--
-- No CHECK on `kind`, following media_type (0006), status (0024) and person_kinds
-- (0027): the vocabulary is validated in app code so a fourth kind of quote does
-- not need a schema change. anthologyKinds in anthology_handlers.go is the list.
--
-- THE PRIMARY KEY IS THE "ONCE PER ANTHOLOGY" RULE. A quote may appear once in
-- any given anthology and in any number of anthologies — filing is not moving,
-- which is the opposite of a board (0036), where membership is single and a move
-- is a move.
CREATE TABLE anthology_entries (
  anthology_id INTEGER NOT NULL REFERENCES anthologies(id) ON DELETE CASCADE,
  position     REAL NOT NULL,
  kind         TEXT NOT NULL,            -- book | screen | utterance (app-validated)
  item_id      INTEGER NOT NULL,
  note         TEXT NOT NULL DEFAULT '', -- your commentary, before this entry
  PRIMARY KEY (anthology_id, kind, item_id)
);

-- The order is read far more often than it is written — every open of the
-- anthology, its export and its themed round — and the PK above is no help for
-- it, because `position` is not in it.
CREATE INDEX idx_anthology_entries_order ON anthology_entries(anthology_id, position);

-- Reverse lookup: "which anthologies is this quote in?", which the delete
-- confirmation asks and which the triggers below would otherwise scan for.
CREATE INDEX idx_anthology_entries_item ON anthology_entries(kind, item_id);

-- ---------------------------------------------------------------- the FK, by hand
--
-- One per parent, and all three are required: a quote deleted from its book, its
-- film or the Quotes screen has to leave every anthology it was in. Without them
-- the entry survives, the join in the read path finds no quote, and the anthology
-- renders a gap the reader cannot delete because nothing on screen represents it.
--
-- WHAT THESE ARE *NOT* FOR, and 0026's header would suggest otherwise: id reuse.
-- SQLite hands out max(rowid) + 1 and therefore does reuse the id of a deleted
-- row when that row held the highest — but 0031's id floor took that away for
-- exactly these three tables, because a reused id is a restore that collides and
-- because item_reviews had already been bitten by it (a new quote inheriting a
-- deleted one's half-life). All three create paths allocate through nextID, so an
-- orphaned entry can no longer be adopted by an unrelated quote. These triggers
-- are about the orphan itself, which is a correctness problem on its own.
CREATE TRIGGER anthology_entries_book_del AFTER DELETE ON annotations BEGIN
  DELETE FROM anthology_entries WHERE kind = 'book' AND item_id = OLD.id;
END;
CREATE TRIGGER anthology_entries_screen_del AFTER DELETE ON dialogues BEGIN
  DELETE FROM anthology_entries WHERE kind = 'screen' AND item_id = OLD.id;
END;
CREATE TRIGGER anthology_entries_utterance_del AFTER DELETE ON utterances BEGIN
  DELETE FROM anthology_entries WHERE kind = 'utterance' AND item_id = OLD.id;
END;

-- ---------------------------------------------------------------- the round trip
--
-- An anthology exports as one Markdown file and re-imports through the SAME
-- staging queue every other import uses, which is what these two columns are for.
--
-- WHY STAGING RATHER THAN A DIRECT IMPORT. The queue exists because a file is a
-- claim and not a fact, and an anthology file makes MORE claims than a quotes
-- file, not fewer: it names quotes that may already be in the library under a
-- different attribution. Building the anthology directly would be the one import
-- path in the app with no review step in front of it.
--
-- 0036 laid the same track for boards — "Staged quotes carry it too, so an import
-- that names a board keeps it through review" — and left the approval half
-- unbuilt. This is that shape finished for anthologies: the title travels with
-- each staged row, and approval resolves it to a row by NAME, find-or-create, the
-- way boardByName does. A typo makes a second anthology, which is visible in the
-- list and fixable by renaming; the alternative is a refused import, and 1.13.1
-- settled that trade for credit suffixes on the same grounds.
--
-- NO POSITION COLUMN. The order is the order the rows were staged in, which the
-- queue already preserves by id, and approval appends in that order. A position
-- here would be a second source of truth for the same fact, and the failure mode
-- of the two disagreeing is an anthology whose order is subtly not the file's.
ALTER TABLE staged_quotes ADD COLUMN anthology TEXT NOT NULL DEFAULT '';
ALTER TABLE staged_quotes ADD COLUMN anthology_note TEXT NOT NULL DEFAULT '';

-- The INTRODUCTION is one string for the whole file and is stored on every row of
-- it, which is redundant and is the right trade here. The alternative is a column
-- on staged_works, which is one row per file — but the queue is transient scratch
-- state that a discard drops whole, the approval path already carries each quote's
-- anthology title on the row beside it, and splitting the two halves of one fact
-- across two tables would mean a third place to keep them in step. Approval writes
-- it only when it CREATES the anthology, so re-importing into one that exists never
-- overwrites prose the reader has since edited.
ALTER TABLE staged_quotes ADD COLUMN anthology_intro TEXT NOT NULL DEFAULT '';
