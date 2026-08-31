-- 0058: the bin learns one more kind — a merge you can put back.
--
-- 0056 made a person a record rather than a name, and the act that follows from
-- that is merging two of them: "these four spellings are one human being". It is
-- the one destructive operation in the identity model, and this app's standing
-- promise is that the bin holds what you destroy.
--
-- WHY A REBUILD FOR ONE WORD. `kind` carries a CHECK over an enumerated list, and
-- SQLite cannot ALTER a CHECK — the whole table is copied. 0032 did exactly this
-- to add 'selection' and this is its twin, down to the index that has to be
-- re-made because it belonged to the old table.
--
-- THE ENUMERATION IS WORTH KEEPING. It would be simpler to drop the constraint and
-- let the app write whatever it likes, and that is precisely what makes a typo in a
-- kind string a bin entry nothing can restore: the restore branches on this value,
-- so a kind the schema does not know is an entry that lists, sits for thirty days
-- and fails when somebody presses Undo. The CHECK turns that into a write that
-- fails immediately, in the transaction that would have created it.
--
-- 'person-merge' IS NOT A SNAPSHOT LIKE ITS SEVEN NEIGHBOURS. Every other kind is
-- "rows that were deleted, put them back"; a merge deletes almost nothing, it
-- re-points — so its payload is a REVERSAL (store.MergeUndo) and it has its own
-- branch in handleRestoreTrash, before the generic row-by-row restore. The generic
-- one would collide on the first insert, because the keys it wants are all still
-- occupied by the rows the merge changed.
--
-- Nothing references trash, so the rebuild takes no children with it and no
-- foreign key has to be parked — the one thing 0018's warning is about.

CREATE TABLE trash_new (
  id          INTEGER PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL
    CHECK (kind IN ('book','movie','annotation','dialogue','quote','account','selection','person-merge')),
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
