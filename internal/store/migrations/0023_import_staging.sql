-- Import staging (ROADMAP 1.2.0). Every import endpoint used to parse and write
-- in one shot: by the time the results screen said what happened, the quotes
-- were already in annotations/dialogues, already indexed for search, already in
-- the review deck, and the only undo was hand-deleting them. These three tables
-- are the holding area a file lands in instead, so nothing enters the library
-- until it is explicitly okayed.
--
-- They sit deliberately OUTSIDE the live tables rather than adding a `pending`
-- flag to annotations/dialogues. A flag would have to be threaded through every
-- existing read as `WHERE pending = 0` — dozens of queries, each one a place to
-- forget it and leak an unapproved quote into a list, a search hit or a quiz
-- card. Separate tables make the default safe: no existing query can see staged
-- rows because no existing query names these tables.
--
-- Consequences of that choice, all intended:
--   * NO FTS5 tables and NO FTS triggers here. Staged text is not searchable
--     and cannot be pulled into a quiz. (It also keeps these tables clear of the
--     external-content hazard recorded in 0022: a trigger that writes the row it
--     fired on corrupts an FTS index.)
--   * NO item_reviews rows. Repetition state begins at approval, not at import.
--   * Tags live as denormalized comma-joined text in staged_quotes.tags rather
--     than join rows against `tags`, so a tag that exists only inside an
--     unapproved import does not appear in the user's tag vocabulary. Approval
--     is what turns them into real join rows.
--
-- Ownership is by parentage — staged_quotes -> staged_works -> import_batches,
-- which carries the user_id — matching annotations->books. Every read JOINs
-- through it; there is no user_id on the child tables to drift out of step.
--
-- A staged quote carries BOTH locator sets (chapter/location for a book,
-- character/actor/timestamp for a film) because retargeting a batch across kinds
-- is the repair for a misdetected file, and approval reads whichever set the
-- destination kind uses. Moving book highlights onto a show must not destroy the
-- chapter and location on the way, in case the move is itself the mistake.
--
-- location_orig / timestamp_orig are the as-imported snapshot. Bulk location
-- formulae (a Kindle location-to-page division, a PDF page offset) rewrite the
-- live column; reset restores the snapshot, so a formula applied by mistake is
-- recoverable rather than permanent.
--
-- Column order is append-only from here: store.Recover() copies base tables with
-- `INSERT INTO main.t SELECT * FROM old.t`, which needs the physical order of a
-- freshly-migrated database to match an upgraded one. Later migrations may ALTER
-- ... ADD COLUMN; they must never reorder.

CREATE TABLE import_batches (
  id         INTEGER PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source     TEXT NOT NULL,                    -- md | bookcision | hardcover_html | goodreads_html | kindle_notebook | kindle_clippings | imdb (app-validated)
  filename   TEXT NOT NULL DEFAULT '',         -- the uploaded name, so the queue can group and filter by file
  extra      TEXT NOT NULL DEFAULT '',         -- JSON parser counters (clippings: bookmarks skipped, notes merged, …); '' when none
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_import_batches_user ON import_batches(user_id, id);

-- One row per work a file mentioned. Identity is stored as PARSED, not resolved:
-- the ISBN -> ASIN -> title/author fallthrough that picks the real book runs at
-- approval, so a book added to the library while quotes sit staged is still
-- matched. target_kind/target_id are set only when the user retargets the group
-- onto a row that already exists, which pins the destination and skips that
-- resolution.
CREATE TABLE staged_works (
  id           INTEGER PRIMARY KEY,
  batch_id     INTEGER NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL,                  -- book | movie | show (app-validated: a CHECK cannot evolve)
  title        TEXT NOT NULL,
  author       TEXT,                           -- books; the verbatim credit string, co-authors included
  isbn         TEXT,                           -- as parsed; normalized at approval
  asin         TEXT,
  series       TEXT,                           -- series (books) / collection (films)
  series_index REAL,
  release_year INTEGER,                        -- films/shows
  imdb_id      TEXT,                           -- informational; imports carry no tmdb/tvdb id
  director     TEXT,
  genres       TEXT NOT NULL DEFAULT '',       -- comma-joined; fill-empty-only at approval
  target_kind  TEXT,                           -- book | movie: the user picked an existing row
  target_id    INTEGER                         -- books.id / movies.id; no FK, so deleting the work leaves a stale pin the approval re-resolves
);
CREATE INDEX idx_staged_works_batch ON staged_works(batch_id);

-- UNIQUE (staged_work_id, dedupe_hash) mirrors annotations' UNIQUE (book_id,
-- dedupe_hash): staging a file collapses its internal duplicates exactly as the
-- live insert used to, so the counts a user approves match what they saw. It is
-- deliberately NOT unique across batches — importing the same file twice gives
-- two batches, and discarding one is the answer.
CREATE TABLE staged_quotes (
  id             INTEGER PRIMARY KEY,
  staged_work_id INTEGER NOT NULL REFERENCES staged_works(id) ON DELETE CASCADE,
  quote          TEXT,
  note           TEXT,                         -- a note-only row is legal (as in annotations); dialogues gain the quote at approval
  color          TEXT NOT NULL DEFAULT 'yellow'
    CHECK (color IN ('yellow','blue','pink','orange')),
  favorite       INTEGER NOT NULL DEFAULT 0,
  chapter        TEXT,                         -- book locator
  location       TEXT,                         -- book locator; free text (p.142, 610-612, 42%, 1234)
  location_orig  TEXT,                         -- as-imported snapshot; formula reset restores it
  character      TEXT,                         -- film locator
  actor          TEXT,                         -- film locator; autofilled from the title's cast at approval
  timestamp      TEXT,                         -- film locator; HH:MM:SS shape preserved by the formula
  timestamp_orig TEXT,                         -- as-imported snapshot
  tags           TEXT NOT NULL DEFAULT '',     -- comma-joined; NOT join rows (see the header)
  noted_at       TEXT,                         -- the source's own date for the highlight, when it carried one
  dedupe_hash    TEXT NOT NULL,                -- store.DedupeHash(quote or note); locators excluded, as everywhere
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (staged_work_id, dedupe_hash)
);
CREATE INDEX idx_staged_quotes_work ON staged_quotes(staged_work_id);
