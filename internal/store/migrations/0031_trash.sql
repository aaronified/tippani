-- 0031: somewhere for deleted things to go.
--
-- Every delete in this app has been final since 0001. That was tolerable while
-- deleting meant one row behind a confirm dialog; it stops being tolerable the
-- moment a selection can delete forty things at once, which is what the next
-- release wants. So the bin lands first, on its own merits: it makes every delete
-- the app ALREADY HAS recoverable, and it is the precondition for bulk delete
-- existing at all.
--
-- A SNAPSHOT, NOT A SOFT DELETE. The rows are really deleted, exactly as they
-- were before, and what is kept is a JSON copy of the subtree. The alternative --
-- a `deleted_at` column on five tables -- would put a predicate in the way of
-- every query, count, stat, export, FTS trigger and dedupe check in the app, and
-- the one that gets forgotten shows a deleted quote in a quiz six months later.
-- With a snapshot, nothing else in the schema changes and nothing else in the
-- application knows this table exists.
--
-- ONE ROW PER USER ACTION, not per deleted row. Deleting a book is one entry --
-- "The Dispossessed + 40 quotes" -- restored whole, so there is no way to end up
-- with a quote whose book is missing.
--
-- ------------------------------------------------------- what the payload holds
--
-- `payload` is {"<table>": [ {column: value, ...}, ... ]}, and the column names
-- are read from PRAGMA table_info at write time rather than listed in Go. A
-- snapshot that names its columns by hand is a snapshot that silently stops
-- carrying the column added next release, and the failure shows up months later,
-- on a restore, as a field quietly reset to its default.
--
-- THE SUBTREE IS NOT THE FK GRAPH. This was the plan's assumption and the live
-- schema disagrees, so it is recorded here rather than rediscovered:
--
--   1. A book cascades to `annotations` and `book_genres`, and that is all. The
--      wider cascade the plan expected belonged to tables that have since been
--      rebuilt (0018, 0029) without their foreign keys.
--   2. `item_reviews` and `work_reads` carry NO foreign key to the rows they
--      describe -- item_reviews is polymorphic (kind, item_id) and work_reads is
--      (kind, work_id). Both are cleared by AFTER DELETE TRIGGERS instead (0015,
--      0024, restated by 0029). So a walk of the FK graph alone would drop
--      somebody's memory half-life and their whole read log, silently, and the
--      restore would look like it worked. The writer therefore carries a declared
--      list of logically-linked tables beside the discovered FK children.
--   3. `tags` and `genres` are NOT deleted with the row -- a tag is managed
--      vocabulary and genres are garbage-collected separately -- so their JOIN
--      rows are restored by NAME, not by id. A tag deleted between the delete and
--      the restore would otherwise fail the FK, and a genre GC'd and re-created
--      would have a different id pointing at the right name.
--
-- ------------------------------------------------------------ no FK on the bin
--
-- Nothing in `payload` exists, so there is nothing for it to reference.
--
-- `user_id` is WHOSE BIN THIS ROW SITS IN, which is not always whose data it was:
-- for the five content kinds it is the owner, and for `kind = 'account'` it is the
-- ADMIN who deleted the account. That is deliberate and load-bearing. With the
-- row in the deleted user's own bin, `ON DELETE CASCADE` would take the entry
-- away in the same statement that made it necessary. It also matches who is
-- allowed to put it back.
--
-- `kind = 'account'` shares this table rather than getting its own, because the
-- purge, the retention window and the ownership check are the same code for both,
-- and a second table would be a second place to forget them.

CREATE TABLE trash (
  id          INTEGER PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL
    CHECK (kind IN ('book','movie','annotation','dialogue','quote','account')),
  label       TEXT NOT NULL,              -- what the row says in the bin: a title, or a quote's first words
  child_count INTEGER NOT NULL DEFAULT 0, -- how many rows go back with it, for the summary line
  deleted_at  TEXT NOT NULL DEFAULT (datetime('now')),
  payload     TEXT NOT NULL,              -- JSON: table name -> whole rows
  files       TEXT NOT NULL DEFAULT '[]'  -- JSON array of parked image filenames
);

CREATE INDEX trash_user_time ON trash(user_id, deleted_at);

-- --------------------------------------------------------------- the id floor
--
-- `id INTEGER PRIMARY KEY` is a rowid alias on every table in this schema, so
-- SQLite allocates max(rowid) + 1 and DOES reuse a freed id -- but only when the
-- deleted row held the table's highest. That is exactly the common case: you
-- delete the thing you just added.
--
-- Which makes a restore a collision waiting to happen. Delete the newest quote,
-- add another, restore the first, and the id it wants is taken. The three ways
-- out are to renumber on restore (an id remap across every child row and join
-- table, which is the most dangerous code in the feature, running on the path
-- that is supposed to be putting things back), to add AUTOINCREMENT (a rebuild of
-- five FK parents with cascading children -- the migration class 0018 refused to
-- attempt), or this: a high-water mark the create paths allocate above.
--
-- `next_id` is the lowest id that may be handed out for that table. It is raised
-- to the table's own max on every allocation, so it seeds itself correctly on an
-- existing database and cannot fall behind if a row is inserted some other way.
-- A restore raises it above every id it puts back.
--
-- The cost is real and is confined to the create paths: they allocate an id
-- explicitly instead of letting SQLite choose. Import loops take a block of ids
-- in one bump rather than one bump per row, because a thousand-quote import
-- should not pay a thousand extra round trips.
--
-- This also fixes a bug that predates it. `item_reviews` is keyed (kind, item_id)
-- with no foreign key, so a reused annotation id used to inherit the deleted
-- quote's memory half-life and review count. With ids never reused, it cannot.

CREATE TABLE id_floor (
  table_name TEXT PRIMARY KEY,
  next_id    INTEGER NOT NULL
);
