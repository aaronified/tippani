-- Annotations rework (one rebuild, three changes):
--   * add favorite (star flag) + rating (0 = unrated, else 1-5) — owner-requested
--   * drop the CHECK on source: the importer list keeps growing (readest md,
--     hardcover_html, ...) and SQLite can't alter constraints; the app layer
--     validates source values now
-- SQLite table-rebuild dance. DROP TABLE under foreign_keys=ON implicitly
-- deletes annotation_tags rows via ON DELETE CASCADE, so park them first
-- (ids are preserved by the copy, so the joins stay valid).

CREATE TABLE _annotation_tags_backup AS SELECT * FROM annotation_tags;

CREATE TABLE annotations_new (
  id INTEGER PRIMARY KEY,
  book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  quote TEXT,
  note TEXT,
  color TEXT NOT NULL DEFAULT 'yellow'
    CHECK (color IN ('yellow','blue','pink','orange')),
  chapter TEXT,
  location TEXT,                         -- free text page/loc/%; NOT part of dedupe
  source TEXT NOT NULL,                  -- validated in app code (PLAN §5)
  favorite INTEGER NOT NULL DEFAULT 0,   -- star flag
  rating INTEGER NOT NULL DEFAULT 0      -- 0 = unrated, else 1-5
    CHECK (rating BETWEEN 0 AND 5),
  dedupe_hash TEXT NOT NULL,             -- sha256(lower(collapse_ws(coalesce(quote, note))))
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (quote IS NOT NULL OR note IS NOT NULL),
  UNIQUE (book_id, dedupe_hash)
);

INSERT INTO annotations_new
  (id, book_id, quote, note, color, chapter, location, source, dedupe_hash, created_at, updated_at)
  SELECT id, book_id, quote, note, color, chapter, location, source, dedupe_hash, created_at, updated_at
  FROM annotations;

DROP TABLE annotations;                  -- drops the old FTS triggers with it
ALTER TABLE annotations_new RENAME TO annotations;
CREATE INDEX idx_ann_book ON annotations(book_id);

INSERT INTO annotation_tags SELECT * FROM _annotation_tags_backup;
DROP TABLE _annotation_tags_backup;

-- Recreate the FTS sync triggers (PLAN §4) and re-sync the index.
CREATE TRIGGER annotations_ai AFTER INSERT ON annotations BEGIN
  INSERT INTO annotations_fts(rowid, quote, note)
  VALUES (new.id, new.quote, new.note);
END;
CREATE TRIGGER annotations_ad AFTER DELETE ON annotations BEGIN
  INSERT INTO annotations_fts(annotations_fts, rowid, quote, note)
  VALUES ('delete', old.id, old.quote, old.note);
END;
CREATE TRIGGER annotations_au AFTER UPDATE ON annotations BEGIN
  INSERT INTO annotations_fts(annotations_fts, rowid, quote, note)
  VALUES ('delete', old.id, old.quote, old.note);
  INSERT INTO annotations_fts(rowid, quote, note)
  VALUES (new.id, new.quote, new.note);
END;

INSERT INTO annotations_fts(annotations_fts) VALUES('rebuild');
