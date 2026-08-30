-- 0054: where each field came from.
--
-- THE RECORD PICKED ONE SUPPLIER FOR EVERY FIELD, and that was the whole model.
-- A film has a tmdb_id and a tvdb_id and re-verify chose between them once, for
-- the entire row, so "this description is TheTVDB's and this cast is TMDB's" was
-- not a thing the app could hold — let alone show. What a reader could see was a
-- single notice counting titles "still on TMDB", which is the coarsest possible
-- version of the question they were actually asking.
--
-- SPARSE, AND ONE ROW PER FIELD THAT A SUPPLIER ACTUALLY WROTE. A field nobody
-- has fetched has no row. That is not a saving, it is the point: absence means
-- "we do not know", and it has to stay distinguishable from "the reader typed
-- this themselves", which is recorded as source='manual'.
--
-- NO BACKFILL, DELIBERATELY. Every field in every existing library reads as
-- unknown until something next writes it. The alternative is to guess — infer a
-- supplier from whichever id the row happens to carry — and a guess is
-- indistinguishable from a fact once it is in this table. It would also be wrong
-- for exactly the rows that matter most: the ones a reader has spent time
-- correcting by hand, which look identical to provider values from here. An empty
-- table that fills up as the library is used is honest; a full table of
-- assumptions is not, and cannot be un-assumed later.
--
-- WHY NOT A HISTORY. One row per (work, field), overwritten in place, and no log.
-- A ledger of every value a field has ever held is written on every fetch and read
-- by nobody: the question a reader asks is "where is this from", present tense,
-- and answering it does not require remembering what it displaced. `at` is kept
-- because "TheTVDB, in March" is a materially better answer than "TheTVDB", and
-- costs one column rather than one table.
--
-- KIND + WORK_ID RATHER THAN TWO TABLES because books and films ask this question
-- identically and their field names barely overlap; the same reason work_cast is
-- one table keyed by (kind, work_id) rather than book_cast and movie_cast.
--
-- ON DELETE CASCADE from users only. A deleted work leaves its rows behind for the
-- same reason work_cast tombstones do not cascade: the cleanup is a sweep, not a
-- foreign key, and a dangling row here is invisible rather than wrong.
CREATE TABLE work_field_source (
  user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind      TEXT    NOT NULL,            -- 'book' | 'movie'
  work_id   INTEGER NOT NULL,
  field     TEXT    NOT NULL,            -- 'description' | 'director' | 'genres' | …
  source    TEXT    NOT NULL,            -- tmdb | tvdb | igdb | openlibrary | google | amazon | wikidata | import | manual
  source_id TEXT    NOT NULL DEFAULT '', -- that supplier's id for the work, when it has one
  at        TEXT    NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, kind, work_id, field)
) WITHOUT ROWID;

-- The read is always "every field of this one work", which the primary key's own
-- prefix already serves. No second index: this table is written on every accepted
-- diff, and an index nothing reads is a write cost with no reader.
