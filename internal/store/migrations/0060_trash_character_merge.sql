-- 0060: the bin learns the identity model's four remaining destructive acts.
--
-- 0058 gave `person-merge` a place in the bin because merging two people is the
-- one destructive act in the identity model. 0056 made characters their own
-- table with the same machinery — aliases, a sort name, a merge — and the merge
-- half shipped for people only. This is the row the character half needs.
--
-- WHY A SECOND REBUILD FOR A SECOND WORD. Word for word 0058's reason: `kind`
-- carries a CHECK over an enumerated list, SQLite cannot ALTER a CHECK, so the
-- whole table is copied and the index re-made. 0032 added 'selection' this way
-- and 0058 added 'person-merge'; this is the third of the same shape.
--
-- KEEPING THE ENUMERATION IS STILL WORTH ONE TABLE COPY. The restore branches on
-- this value, so a kind the schema does not know is an entry that lists, sits for
-- thirty days and fails when somebody presses Undo. The CHECK turns that into a
-- write that fails in the transaction that would have created it.
--
-- ALL FOUR ARE REVERSALS, NOT SNAPSHOTS, exactly as 'person-merge' is, and they
-- share its branch in handleRestoreTrash rather than the generic row-by-row path:
--
--   * a MERGE re-points rows rather than deleting them, so the keys the generic
--     restore wants to insert into are all still occupied;
--   * a record DELETE does insert its row back, but two of the three things it
--     disturbs are `ON DELETE SET NULL` columns on rows that still exist — the
--     cast rows and the quotes that pointed at it — and putting those back is an
--     UPDATE by id. The generic restore would return the record and leave every
--     one of them pointing at nothing.
--
-- WHY A RECORD DELETE IS BINNED AT ALL AND A CAST ROW IS NOT. A `work_cast` row is
-- attribution: it says how one work bills somebody, and deleting it is a
-- correction to that work. A `people` or `characters` row is authored — a sort
-- name that was a judgement, a description, a portrait, every alias filed and
-- every merge those aliases record — and that is what a bin is for.
--
-- Nothing references trash, so the rebuild takes no children with it and no
-- foreign key has to be parked — 0018's warning, honoured the same way twice.

CREATE TABLE trash_new (
  id          INTEGER PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL
    CHECK (kind IN ('book','movie','annotation','dialogue','quote','account','selection',
                    'person-merge','character-merge','person-delete','character-delete')),
  label       TEXT NOT NULL,
  child_count INTEGER NOT NULL DEFAULT 0,
  deleted_at  TEXT NOT NULL DEFAULT (datetime('now')),
  payload     TEXT NOT NULL,
  files       TEXT NOT NULL DEFAULT '[]'
);

INSERT INTO trash_new (id, user_id, kind, label, child_count, deleted_at, payload, files)
  SELECT id, user_id, kind, label, child_count, deleted_at, payload, files FROM trash;

DROP TABLE trash;
ALTER TABLE trash_new RENAME TO trash;

-- Same name, same columns: the bin lists one user's entries newest first, and that
-- is still the only query it has.
CREATE INDEX trash_user_time ON trash(user_id, deleted_at);
