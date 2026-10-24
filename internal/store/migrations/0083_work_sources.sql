-- 0083 — A WORK KEEPS THE FILE ITS QUOTES CAME FROM.
--
-- One row per (what it belongs to, what it is for). The bytes live under
-- <DataDir>/Sources/<16 hex>, never in this table and never served back: the
-- app extracts spans of text from them and sends only those (docs/plans/
-- work-source-files.md). The table is NAMED for the first job and carries the
-- second as `role`, because a film's subtitle and a book's ebook are the same
-- idea — the file the words came from.
--
-- WHAT IT BELONGS TO is a polymorphic pair, as item_reviews and work_reads are,
-- and for the same reason: no single parent table exists. `subject` is the media
-- word the rest of the app uses; `subject_id` is a row id for book and screen and
-- 0 for utterance, which has no work row. `subject_key` completes the pair: the
-- folded title for an utterance (item_reviews' own key), `s01e04` for one episode
-- of a show, empty for a film and a book. Folding it into the key, rather than
-- adding two columns that are null for everything else, costs the UNIQUE nothing.
--
-- THE UNIQUE IS "a second upload replaces the first", made a constraint rather
-- than a convention.
--
-- `path` is a stored filename under Sources/ for origin 'upload', and (a later
-- release) a path relative to a configured mount root for origin 'mount'. Empty
-- once the file has been pruned; the ROW STAYS, because it is the only record that
-- this work ever had a source. `sha256` is what lets a re-upload be recognised as
-- the same file and a different one be recognised as another edition.
--
-- No CHECK on the vocabularies: the app writes them, and a CHECK would have to be
-- rebuilt (the 0018 hazard) every time a role or an origin is added.
CREATE TABLE work_sources (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject     TEXT    NOT NULL,
  subject_id  INTEGER NOT NULL DEFAULT 0,
  subject_key TEXT    NOT NULL DEFAULT '',
  role        TEXT    NOT NULL,
  format      TEXT    NOT NULL,
  path        TEXT    NOT NULL,
  origin      TEXT    NOT NULL DEFAULT 'upload',
  mount_id    TEXT    NOT NULL DEFAULT '',
  name        TEXT    NOT NULL DEFAULT '',
  bytes       INTEGER NOT NULL DEFAULT 0,
  sha256      TEXT    NOT NULL DEFAULT '',
  pruned_at   TEXT    NOT NULL DEFAULT '',
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX idx_work_sources_one
  ON work_sources(user_id, subject, subject_id, subject_key, role);
CREATE INDEX idx_work_sources_user ON work_sources(user_id);
