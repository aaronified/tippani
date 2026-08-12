-- 0032: a deleted SELECTION is one thing in the bin.
--
-- Bulk delete arrives with multiselect, and the question it forces is what the bin
-- shows afterwards. Forty-one quotes deleted in one act could be forty-one entries
-- or one, and forty-one is the wrong answer twice over: the bin becomes a wall of
-- rows for a single decision, and undoing that decision means forty-one restores
-- that can each half-fail.
--
-- So `kind` gains 'selection': one entry, one payload holding every row from every
-- item, one Undo. The restore needs no new code at all — it walks the payload's
-- tables in foreign-key order (see restoreOrder), and a payload with forty
-- annotations in it is the same shape as a payload with one.
--
-- WHY THIS REBUILD IS SAFE, since this repo treats table rebuilds as its most
-- dangerous migration class (0018, 0029): `trash` is a leaf. Nothing references it,
-- it has no children, and its only foreign key points OUT at users. There is no
-- cascade to trip and nothing to lose but the rows themselves, which are copied
-- across explicitly below rather than left to a rename.
--
-- The alternative was dropping the CHECK entirely, which is how a table ends up
-- holding a kind nobody wrote a restore path for.

CREATE TABLE trash_new (
  id          INTEGER PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL
    CHECK (kind IN ('book','movie','annotation','dialogue','quote','account','selection')),
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

-- The index goes with the old table and has to be re-made. Same name, same columns:
-- the bin lists one user's entries newest first, and that is the only query it has.
CREATE INDEX trash_user_time ON trash(user_id, deleted_at);
