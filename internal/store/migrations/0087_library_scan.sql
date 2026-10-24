-- 0087: library scan. Checkpoint, findings and seen files, so a scan can resume
-- and a later scan only reads what changed.
--
-- A scan of a mounted folder runs as a job (ADR-0917-A). These tables keep its
-- state in the database, so a Stop, a crash or a restart loses nothing.
--
-- No absolute path is stored. `rel` is the path relative to the configured
-- folder. Tokens are signed when findings are read, so they still do not
-- survive a restart.
--
-- All three tables are per user and per folder, and go with the account.
-- handlePutMounts clears them when a folder is removed or repointed, because a
-- folder id can be reused.

-- One row per user and folder: where the walk is, and the numbers the screen shows.
CREATE TABLE library_scans (
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mount_id    TEXT    NOT NULL,
  -- Number of the current pass over the folder. Rows touched by a pass carry it;
  -- a pass that reaches the end deletes rows with an older number.
  pass        INTEGER NOT NULL DEFAULT 1,
  -- Last file finished in this pass (relative path). '' means the start.
  cursor      TEXT    NOT NULL DEFAULT '',
  -- 1 when the pass reached the end. 0 means it was stopped or cut off, and the
  -- next scan resumes from cursor.
  done        INTEGER NOT NULL DEFAULT 0,
  files_seen  INTEGER NOT NULL DEFAULT 0,
  unclaimed   INTEGER NOT NULL DEFAULT 0,
  skipped     INTEGER NOT NULL DEFAULT 0,
  updated_at  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, mount_id)
);

-- Proposals: at most one per work (and episode), the best file for it.
-- Order of preference: exact before review, then lower rank, then shorter path.
CREATE TABLE library_scan_findings (
  user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mount_id  TEXT    NOT NULL,
  subject   TEXT    NOT NULL,              -- book | screen
  work_id   INTEGER NOT NULL,
  episode   TEXT    NOT NULL DEFAULT '',   -- s01e04, or '' for a film or a book
  rel       TEXT    NOT NULL,
  format    TEXT    NOT NULL,              -- subtitle | epub
  title     TEXT    NOT NULL,
  how       TEXT    NOT NULL,              -- id | title (the evidence)
  bucket    TEXT    NOT NULL,              -- exact | review
  rank      INTEGER NOT NULL DEFAULT 0,    -- subtitle track preference
  pass      INTEGER NOT NULL,
  PRIMARY KEY (user_id, mount_id, subject, work_id, episode)
);

CREATE INDEX idx_library_scan_findings_rel ON library_scan_findings(user_id, mount_id, rel);

-- Files already seen. A file whose size and mtime are unchanged is not read again.
CREATE TABLE library_scan_files (
  user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mount_id  TEXT    NOT NULL,
  rel       TEXT    NOT NULL,
  size      INTEGER NOT NULL,
  mtime     INTEGER NOT NULL,              -- unix milliseconds
  -- ok (identified, or a subtitle named by its path), skipped (empty or over the
  -- source cap), unreadable (an ebook that would not open).
  verdict   TEXT    NOT NULL,
  -- An ebook's title, creator, ISBNs and ASINs as JSON. Kept so an unchanged file
  -- can be matched again against a larger library without opening it.
  meta      TEXT    NOT NULL DEFAULT '',
  pass      INTEGER NOT NULL,
  PRIMARY KEY (user_id, mount_id, rel)
);

-- Work ids are reused after the highest row is deleted (see 0026, 0084). Without
-- these, a new work could inherit a deleted work's proposal.
CREATE TRIGGER library_scan_findings_book_del AFTER DELETE ON books
BEGIN DELETE FROM library_scan_findings WHERE subject = 'book' AND work_id = OLD.id; END;
CREATE TRIGGER library_scan_findings_screen_del AFTER DELETE ON movies
BEGIN DELETE FROM library_scan_findings WHERE subject = 'screen' AND work_id = OLD.id; END;
