-- Shelf status + the read log (see PLAN §3f / §8.3): where a work stands with
-- you — reading it, paused, abandoned, finished — plus a row per read so a
-- reread is history rather than an overwrite.
--
-- Two columns per side, named per side as the rest of the catalogue is
-- (cover_path/poster_path, author/director): a book's in-progress status reads
-- "reading", a film's "watching", and both files export as the word a human
-- would write. The shared values are 'paused' | 'abandoned' | 'completed', and
-- '' is the ordinary un-tracked state.
--
--   books.status   '' | reading  | paused | abandoned | completed
--   movies.status  '' | watching | paused | abandoned | completed
--
-- No CHECK: 0004 established that SQLite cannot evolve one, so open-ended
-- vocabularies are validated in app code (normalizeStatus in httpapi).
--
-- progress is 0-100 and only means anything while reading/watching — it drives
-- the fill on the status bar under the cover. Kept on the work rather than on
-- the open read: it is "where am I now", not history.
--
-- The companion "Wishlist" state deliberately gets no column: it is derived —
-- a work with zero annotations/dialogues IS the wishlist, so it needs no storage
-- and can never drift out of sync with the quotes it counts.
--
-- Plain ALTER TABLE ADD COLUMN, no table rebuild: books_fts / movies_fts are
-- external-content FTS over title/author/director/genre_text only, so neither
-- the FTS tables nor their triggers reference these columns (0006 established
-- this). Every existing row starts un-tracked at 0%.

ALTER TABLE books ADD COLUMN status TEXT NOT NULL DEFAULT '';
ALTER TABLE books ADD COLUMN progress INTEGER NOT NULL DEFAULT 0;

ALTER TABLE movies ADD COLUMN status TEXT NOT NULL DEFAULT '';
ALTER TABLE movies ADD COLUMN progress INTEGER NOT NULL DEFAULT 0;

-- Where you actually are, for people who count in the units the thing is made of
-- rather than in percentages: a page of a physical book, an episode of a season.
-- progress above stays the CANONICAL value — it is derived from these whenever
-- they are set (see positionPercent in httpapi/shelf.go) — so the bar, the export
-- and every client keep reading one number and cannot disagree with the other.
--
--   pos_unit   '' = tracking by percent · 'page' (books) · 'episode' (shows)
--   pos        the page / episode you are on      (0 = not tracking by unit)
--   pos_total  pages in the book / episodes in the CURRENT season
--
-- A show is positioned in two dimensions, so it also carries where in the run it
-- is; a book leaves these at 0. Episodes-per-season is the current season's own
-- count because that is what a viewer knows, and nothing here stores a per-season
-- episode map (TMDB/TVDB could supply one; that is a separate feature).
ALTER TABLE books ADD COLUMN pos_unit TEXT NOT NULL DEFAULT '';
ALTER TABLE books ADD COLUMN pos INTEGER NOT NULL DEFAULT 0;
ALTER TABLE books ADD COLUMN pos_total INTEGER NOT NULL DEFAULT 0;

ALTER TABLE movies ADD COLUMN pos_unit TEXT NOT NULL DEFAULT '';
ALTER TABLE movies ADD COLUMN pos INTEGER NOT NULL DEFAULT 0;
ALTER TABLE movies ADD COLUMN pos_total INTEGER NOT NULL DEFAULT 0;
ALTER TABLE movies ADD COLUMN season INTEGER NOT NULL DEFAULT 0;
ALTER TABLE movies ADD COLUMN season_total INTEGER NOT NULL DEFAULT 0;

-- One row per read/watch. Dates are PARTIAL by design: 'YYYY', 'YYYY-MM' or
-- 'YYYY-MM-DD', because "I read it in 2019" is often all anyone honestly knows.
-- Stored as TEXT and compared as TEXT — the three shapes sort correctly against
-- each other lexically, which is the same trick noted_at (0008) relies on.
--
-- outcome, not a bare finished_at, so the counter can stay honest: an abandoned
-- attempt has a stop date but was never finished, and only 'finished' rows count
-- towards "read 3 times".
--
--   open       started, still going          finished_at = ''
--   finished   ran to the end                finished_at = the finish date
--   abandoned  given up on                   finished_at = the stop date
--
-- kind + work_id is a polymorphic pointer at books.id / movies.id, so no FK is
-- possible; the two triggers below stand in for ON DELETE CASCADE. At most one
-- 'open' row per work — enforced in app code, since the partial unique index
-- that would express it cannot also be scoped per user cheaply.
CREATE TABLE work_reads (
  id          INTEGER PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,                    -- 'book' | 'movie' (a show is a movie row, as everywhere)
  work_id     INTEGER NOT NULL,                 -- books.id / movies.id
  started_at  TEXT NOT NULL DEFAULT '',         -- partial date; '' when unknown
  finished_at TEXT NOT NULL DEFAULT '',         -- partial date; '' while open
  outcome     TEXT NOT NULL DEFAULT 'open',     -- open | finished | abandoned
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_work_reads_work ON work_reads(kind, work_id, id);

-- Stand-ins for the cross-table ON DELETE CASCADE SQLite cannot express here:
-- deleting a book or a film takes its read history with it.
CREATE TRIGGER work_reads_book_ad AFTER DELETE ON books BEGIN
  DELETE FROM work_reads WHERE kind = 'book' AND work_id = old.id;
END;
CREATE TRIGGER work_reads_movie_ad AFTER DELETE ON movies BEGIN
  DELETE FROM work_reads WHERE kind = 'movie' AND work_id = old.id;
END;

-- Staging carries an imported status AND its read log across the approval queue
-- (0023): every import is staged first, so without these a "status: reading" key
-- and its reads would be parsed and then dropped before anything lands. One set
-- for all three kinds — staged_works.kind already says which side a row is on.
-- reads_json holds the parsed rows verbatim as JSON, the same way cast_json and
-- source_metadata carry structure through a TEXT column.
-- pos_json is the parsed page/season/episode position as JSON rather than four
-- more columns: staging is a waiting room, and nothing queries inside it.
ALTER TABLE staged_works ADD COLUMN status TEXT NOT NULL DEFAULT '';
ALTER TABLE staged_works ADD COLUMN progress INTEGER NOT NULL DEFAULT 0;
ALTER TABLE staged_works ADD COLUMN pos_json TEXT NOT NULL DEFAULT '';
ALTER TABLE staged_works ADD COLUMN reads_json TEXT NOT NULL DEFAULT '[]';
