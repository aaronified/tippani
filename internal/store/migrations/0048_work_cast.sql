-- 0048: a work's cast is a table the reader owns, not a blob the provider wrote.
--
-- A film's cast has lived in `movies.cast_json` since 0003 — an array of
-- {character, actor, person_id, image_url} written whole by whichever supplier
-- pinned the title, and rewritten whole by the next fetch. One thing reads it
-- that a reader can see: the dialogue form types a character ahead out of it and
-- derives the "played by" from the matching entry. That is a genuinely useful
-- derivation and it fails in two directions at once.
--
--   * IT CANNOT BE CORRECTED. There is no edit surface anywhere in the app — not
--     in the edit modal, not in the Details panel, not in the metadata console.
--     `movieReq` has no cast field and handleUpdateMovie's UPDATE does not name
--     the column, so a provider that mis-bills a minor role mis-bills it for
--     ever, on every line the reader ever quotes from that film.
--   * IT IS EMPTY FOR ALMOST EVERY GAME. A game's voice credits come from
--     Wikidata joined on the IGDB slug (IGDB v4 has no person endpoint and no
--     credit endpoint at all), and TIP-META-018 already records what that
--     coverage is worth: of 24 measured titles, 14 had no usable voice cast. So
--     for a game the derivation silently produces nothing, and there is nothing
--     the reader can do about it — which is the bug this file exists to fix.
--
-- A COLUMN CANNOT HOLD A FACT TWO PARTIES OWN. That is the whole argument. The
-- provider owns the billed cast and rewrites it on every fetch; the reader owns
-- the corrections and the credits nobody published. A single JSON blob has room
-- for exactly one of those, and whichever wrote last wins — which is why the
-- obvious cheaper alternative, "let the reader edit cast_json too", was rejected
-- rather than overlooked. Editing the blob would work perfectly until the first
-- refetch, at which point every correction disappears with no trace that it was
-- ever made. Provenance has to be stored per ROW, and a row is a table.
--
-- ---------------------------------------------------------------- the shape
--
-- ONE ROW PER (WORK, CHARACTER, ACTOR), and the work is polymorphic: a book, or
-- a `movies` row, which covers film, show and game through media_type exactly as
-- it has since 0006 and 0040.
--
-- work_reads (0024) is the precedent and it is copied deliberately rather than
-- reinvented: it is the only other table in this schema whose pointer is at a
-- WORK rather than at a quote. What comes with it is the `user_id` column, the
-- (kind, work_id) pair, THE ABSENCE OF ANY FOREIGN KEY — SQLite cannot express
-- one that points at either of two tables — and the two AFTER DELETE triggers
-- that stand in for the ON DELETE CASCADE it therefore cannot have.
--
-- A BOOK'S ROWS HAVE NO ACTOR, and nothing in the schema says so. 0047 refused
-- an `actor` column on `annotations` in as many words — "a column for the actor
-- who plays him would be empty in every book ever imported" — and the same fact
-- expressed here would be a second CHECK that could never be widened. It is one
-- line in the API instead: a book's cast row is refused an actor, and the reply
-- says what a book's list is for. A GAME'S SECOND COLUMN IS THE VOICE ACTOR,
-- which is a LABEL and not a column: the same string, the same index, the same
-- autofill, and one word different on a screen that does not exist yet.
--
-- WHY A SURROGATE `id` AND NOT PRIMARY KEY (kind, work_id, character_key).
-- Correcting a spelling is the feature. Under a composite key a correction is a
-- primary-key update: the row the reader is editing moves, and — the part that
-- actually matters — the "the reader has touched this" flag would hang off an
-- identity that the edit itself changes. An `id` is what lets `PUT /cast/{id}`
-- mean one row for its whole life. work_reads carries an id for the same reason.
--
-- It is deliberately NOT on idFloorTables (id_floor.go): that list is "exactly
-- the five kinds the bin can hold", and a cast row's id is not part of its
-- identity — nothing references it and nothing exports it. A restore therefore
-- lets SQLite reissue one rather than insisting on the original, which is what
-- keeps a restore from colliding with an id handed out in the meantime.
--
-- ---------------------------------------------------------------- the keys
--
-- Three key columns, and they are folded by two different rules on purpose.
--
--   character_key  CastKey(character)   folded: typographic punctuation folded,
--   actor_key      CastKey(actor)       whitespace collapsed, case dropped
--   provider_key   character + US + actor    NOT folded, only trimmed
--
-- character_key and actor_key are the READER-FACING lookup — what the dialogue
-- autofill matches a typed character against, and what the API calls a
-- duplicate. They must fold, because "Eowyn" and "eowyn " are one person to
-- everybody except a byte comparison.
--
-- provider_key exists for exactly one job: matching one entry in a provider's
-- list to the row that entry seeded last time. It must NOT fold, for three
-- reasons that all point the same way. TMDB does not change its own casing
-- between fetches, so folding buys nothing. Folding would collide a genuine
-- recast that differs only in case with the row it is not. And decisively:
-- SQLITE'S lower() HAS NO UNICODE TABLES — it lowercases ASCII and leaves every
-- other codepoint exactly as it found it — so a folded key cannot be computed
-- identically in SQL and in Go, and a key that disagrees with itself across the
-- two is worse than no key at all.
--
-- IT IS FROZEN AT SEED, and that is enforced in exactly one place: adoptCastRow
-- writes a provider key onto a row that has none and never rewrites one that
-- has. The temptation is the opposite — a supplier that re-cases a name changes
-- the key it computes, so re-keying the row it already seeded looks like keeping
-- the two in step. It is not, and the reason is that ONE ROW CAN BE REACHED BY
-- TWO FETCHED ENTRIES: once by key, once by folded pair. A provider list holding
-- both ("Neo","Keanu Reeves") and ("neo","keanu reeves") — the double billing the
-- backfill's INSERT OR IGNORE below exists for — then leaves the row wearing
-- whichever key came second, and the next fetch swaps it back. A key that flips
-- on every refetch is not an identity anchor, and the merge and the carry both
-- lean on it as one. Freezing costs one extra indexed lookup per re-cased entry
-- per fetch, and buys a column that means the same thing tomorrow.
--
-- That last fact is also why the backfill below writes an ASCII APPROXIMATION of
-- character_key and actor_key, and store.BackfillCastKeys() re-folds them from
-- Migrate()'s tail. It is the arrangement BackfillDialogueHashes has lived under
-- since 1.3.0 for want of a SQL sha256 (hash.go), copied including its unguarded
-- re-run on every boot: that is what makes it idempotent and what heals a key
-- left stale by a later rename sweep. It does NOT re-fold a repair's copied rows
-- in place — Recover() migrates the empty temp database before it copies the base
-- tables in, so the pass runs over nothing and the next boot's is what heals them.
-- A UNIQUE collision while re-folding is
-- logged and skipped rather than returned, because it runs from Migrate and a
-- returned error there means the application does not start.
--
-- ---------------------------------------------------------------- origin
--
-- THE MERGE RULE IS THE POINT OF THIS TABLE, and `origin` is where it is kept.
-- A REFETCH NEVER OVERWRITES A ROW THE READER HAS TOUCHED. Four states:
--
--   provider   seeded by a fetch and never touched. A refetch may rewrite it
--              completely, or delete it when the provider stops listing it.
--   corrected  seeded by a fetch and then edited. A refetch may update the
--              provider's own facts on it — billing, person_id, image_url,
--              source — and may not touch the character or the actor.
--   reader     typed by hand, with no provider row underneath. A refetch treats
--              it exactly as it treats `corrected`: the provider's facts, and
--              neither name, ever.
--   removed    a tombstone for a provider row the reader deleted. It keeps its
--              character, its actor and its provider_key precisely so the next
--              fetch RECOGNISES it and skips it. A refetch does not resurrect a
--              row somebody deleted on purpose.
--
-- IT IS THIS COLUMN THAT DOES THE PROTECTING, AND NOTHING ELSE DOES — written out
-- because this file previously claimed two mechanisms that do not exist, and a
-- skeptic deleted both without a test noticing.
--
--   * `reader` was said to be "protected by construction, not by a check", on the
--     grounds that it has no provider_key and the merge reads only rows that have
--     one. That holds until the provider catches up with the credit, at which
--     point adoptCastRow gives the row a key ON PURPOSE — so the listing is
--     re-matched rather than duplicated beside it — and the row is in the merge's
--     set from then on like any other. The `provider_key <> ''` predicate on that
--     query is a narrowing (it keeps unkeyable rows out of a map keyed by the
--     column) and never a protection.
--   * The merge's `case removed:` was said to be "the whole of its enforcement"
--     of the no-resurrection rule. Nothing in the merge writes `origin` at all, so
--     a tombstone survives every branch of that switch as a tombstone; what makes
--     it invisible is handleDeleteCast keeping the row and every read outside the
--     merge filtering `origin <> 'removed'`. What the empty case does enforce is
--     narrower and true: a tombstone records what the reader deleted IN THE WORDS
--     THEY WERE LOOKING AT, which is what the Markdown export shows them.
--
-- All three live mechanisms — the switch's `default:`, the retraction pass's
-- `origin = 'provider'` test, and the empty `removed` case — now fail a named test
-- in internal/httpapi/cast_protection_test.go when they are removed.
--
-- WHAT THE RULE PROTECTS IS THE CHARACTER AND THE ACTOR — NOTHING ELSE. billing,
-- person_id, image_url and source are the provider's facts, no edit surface will
-- ever offer them, and the portrait pipeline and the quiz's distractor ordering
-- both read them. A refetch always takes those. It is stated here because it is
-- the one place the rule looks like it is being broken and is not.
--
-- WHAT IT COSTS, plainly: A NAME THE READER "FIXED" WRONGLY STAYS WRONG FOR
-- EVER, even after the provider later agrees with the truth. Rename "Ellen
-- Ripley" to something worse and TMDB is right, and the refetch that would have
-- put it back is exactly the refetch this rule forbids. There is one route out
-- and it is deliberate: delete the row — which tombstones it — then delete the
-- tombstone, and let the next fetch re-seed the name from the provider. The
-- alternative cost, a refetch quietly discarding a correction somebody made on
-- purpose, is the one this feature exists to refuse. Between "a wrong name you
-- can see and delete" and "an edit that vanished without a trace", the first is
-- recoverable by the person who made it and the second is not.
--
-- ---------------------------------------- no CHECK on kind, and none on origin
--
-- 0047 DROPPED a CHECK off boards.kind and says in capitals that it must not
-- become one again; 0027 records the mechanism, which is that a CHECK is
-- evaluated against whatever is ALREADY STORED, so one unexpected value turns
-- the migration that adds it into an error — and an error out of Migrate() means
-- the app does not start. `kind` here is validated in Go beside validPersonKind
-- and anthologyKinds, following media_type (0006), status (0024) and
-- person_kinds (0027), every one of which has since gained a value without a
-- schema change. `origin` is the merge rule's own bookkeeping and never arrives
-- from a request at all.
--
-- trash.kind (0032) is the one polymorphic CHECK in this schema and it is a
-- closed seven-value enum written once, not a vocabulary anybody expects to
-- grow. This is not that.
--
-- ------------------------------------------------------------- the indexes
--
-- idx_work_cast_work is the read every screen makes: one work's list in billing
-- order. anthology_entries (0043) is the shape — the ordering column goes in the
-- index because the key alone is no help for it.
--
-- idx_work_cast_character serves the dialogue autofill, which looks a folded
-- character up within one work every time a quote is saved.
--
-- idx_work_cast_actor is per-USER rather than per-work, because the question it
-- answers is "does this actor appear in any cast at all?" — which is what a
-- people-orphan sweep and a rename both have to ask before deleting or
-- rewriting a name.
--
-- THE PAIR UNIQUE IS PARTIAL, `WHERE origin <> 'removed'`, and the predicate is
-- load-bearing. A tombstone keeps its character and its actor so that a refetch
-- can recognise it. Without the predicate, deleting the provider's "Neo / Keanu
-- Reeves" and then typing it back by hand would collide with the row that
-- records the deletion — the reader refused their own cast row by a row they
-- cannot see.
--
-- The provider unique is partial for the plainer reason: every reader-authored
-- row has provider_key = '', and there may be any number of those on one work.
CREATE TABLE work_cast (
  id            INTEGER PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind          TEXT    NOT NULL,                    -- 'book' | 'movie' (app-validated)
  work_id       INTEGER NOT NULL,                    -- books.id / movies.id
  character     TEXT    NOT NULL DEFAULT '',
  character_key TEXT    NOT NULL DEFAULT '',         -- store.CastKey(character)
  actor         TEXT    NOT NULL DEFAULT '',         -- the VOICE actor on a game; always '' on a book
  actor_key     TEXT    NOT NULL DEFAULT '',         -- store.CastKey(actor)
  provider_key  TEXT    NOT NULL DEFAULT '',         -- frozen at seed; '' = reader-authored
  person_id     TEXT    NOT NULL DEFAULT '',         -- id within `source`
  image_url     TEXT    NOT NULL DEFAULT '',
  billing       INTEGER NOT NULL DEFAULT 0,          -- the provider's order; hand-typed rows sort after
  origin        TEXT    NOT NULL DEFAULT 'provider', -- provider | corrected | reader | removed
  source        TEXT    NOT NULL DEFAULT '',         -- tmdb | tvdb | wikidata | ''
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_work_cast_work      ON work_cast(kind, work_id, billing, id);
CREATE INDEX idx_work_cast_character ON work_cast(kind, work_id, character_key);
CREATE INDEX idx_work_cast_actor     ON work_cast(user_id, actor_key);

CREATE UNIQUE INDEX idx_work_cast_provider ON work_cast(kind, work_id, provider_key)
  WHERE provider_key <> '';
CREATE UNIQUE INDEX idx_work_cast_pair ON work_cast(kind, work_id, character_key, actor_key)
  WHERE origin <> 'removed';

-- Stand-ins for the cross-table ON DELETE CASCADE SQLite cannot express here,
-- word for word 0024's: deleting a book or a film takes its cast with it. The
-- tombstones go too, which is right — a tombstone is a fact about one work's
-- cast and means nothing once the work is gone.
CREATE TRIGGER work_cast_book_ad AFTER DELETE ON books BEGIN
  DELETE FROM work_cast WHERE kind = 'book' AND work_id = old.id;
END;
CREATE TRIGGER work_cast_movie_ad AFTER DELETE ON movies BEGIN
  DELETE FROM work_cast WHERE kind = 'movie' AND work_id = old.id;
END;

-- ---------------------------------------------------------------- the backfill
--
-- Every cast already on disk comes across, so nobody opens this release to an
-- empty list on a film they catalogued a year ago. `e.key` from json_each over
-- an array IS the array index, which is exactly what `billing` means, so the
-- provider's own order survives without ever having been recorded anywhere.
--
-- INSERT OR IGNORE, and it is the pair unique doing the ignoring. A blob holding
-- the same (character, actor) twice is a duplicate and dropping the second is
-- right; the alternative is a UNIQUE violation raised INSIDE A MIGRATION, which
-- is an application that will not boot because a provider double-billed
-- somebody.
--
-- The json_valid / json_type guard is there because this column has been NOT
-- NULL DEFAULT '[]' since 0003 and has been written by four code paths since:
-- '' and a stored `null` both reach json_each as a hard error otherwise, and one
-- bad row must not fail the upgrade for a whole library.
--
-- WHAT THE BACKFILL CANNOT RECOVER — all six, stated rather than discovered:
--
--   1. PROVENANCE. Every backfilled row is 'provider', because nothing on disk
--      records that a reader ever touched the blob — there was no way for them
--      to. So THE FIRST REFETCH AFTER THIS MIGRATION IS THE LAST ONE THAT MAY
--      LEGITIMATELY CHANGE A NAME. After it, every row the reader has since
--      corrected is protected; before it, none of them were.
--   2. RETRACTED ROWS. resyncMovieFromSource replaces the whole blob, so
--      anything a provider once returned and a later resync dropped is gone and
--      there is nothing left to read it back from.
--   3. DELETIONS. No tombstone can be recovered, because the reader could never
--      delete a cast row. Every origin='removed' row will have been created
--      after this file.
--   4. BOOKS. No book has ever had a cast column, so every book starts empty.
--      That is correct rather than a loss: annotations.character (0047) is a
--      per-quote speaker and not a roster, and seeding from DISTINCT
--      annotations.character would file every misspelling as its own character.
--   5. WHICH PROVIDER SEEDED WHICH ROW is GUESSED from the id the title is
--      currently pinned by — the same guess actorPortraitFromCast already makes.
--      A row seeded by TMDB on a title later re-pinned to TheTVDB is labelled
--      'tvdb'. `source` is provenance and presentation, never identity: nothing
--      matches on it, so a wrong guess costs a wrong word and no behaviour.
--   6. MOST GAMES START EMPTY, and that is the normal outcome rather than a
--      failure — TIP-META-018's row in docs/troubleshoot.md says so already. For
--      a game this table is the PRIMARY source with an occasional partial seed,
--      not a provider list with a correction layer on top of it.
--
-- A BLANK CHARACTER IS STORABLE HERE AND NOT CREATABLE THROUGH THE API, which is
-- why `character` carries a default rather than a NOT-NULL-non-empty pretence.
-- TMDB's aggregate_credits yields character == "" when a person's Roles array is
-- empty, and the Wikidata game route yields it when there is no P4633 qualifier.
-- The provider may seed one; a reader may not type one.
INSERT OR IGNORE INTO work_cast
  (user_id, kind, work_id, character, character_key, actor, actor_key,
   provider_key, person_id, image_url, billing, origin, source)
SELECT m.user_id, 'movie', m.id,
       TRIM(COALESCE(json_extract(e.value,'$.character'),'')),
       LOWER(TRIM(COALESCE(json_extract(e.value,'$.character'),''))),
       TRIM(COALESCE(json_extract(e.value,'$.actor'),'')),
       LOWER(TRIM(COALESCE(json_extract(e.value,'$.actor'),''))),
       TRIM(COALESCE(json_extract(e.value,'$.character'),'')) || CHAR(31) ||
       TRIM(COALESCE(json_extract(e.value,'$.actor'),'')),
       COALESCE(json_extract(e.value,'$.person_id'),''),
       COALESCE(json_extract(e.value,'$.image_url'),''),
       e.key, 'provider',
       CASE WHEN m.tmdb_id IS NOT NULL THEN 'tmdb'
            WHEN m.tvdb_id IS NOT NULL THEN 'tvdb'
            WHEN m.igdb_id IS NOT NULL THEN 'wikidata' ELSE '' END
FROM movies m,
     json_each(CASE WHEN json_valid(m.cast_json) AND json_type(m.cast_json) = 'array'
                    THEN m.cast_json ELSE '[]' END) e
WHERE TRIM(COALESCE(json_extract(e.value,'$.character'),'')) <> ''
   OR TRIM(COALESCE(json_extract(e.value,'$.actor'),'')) <> '';

-- ------------------------------------------ the queue carries a cast too
--
-- staged_works.cast_json is the SIXTH column on that table to exist for one
-- reason: STAGING SITS IN THE MIDDLE OF THE EXPORT/IMPORT ROUND TRIP. Tippani's
-- own Markdown export is an importer's source, every import is staged, and a
-- field that is parsed out of a file and not carried through the queue is lost
-- between the parse and the approval — with a successful import and matching
-- counts to say nothing happened. 0034 records that exact mistake being nearly
-- shipped for `translator` on the reasoning that no third-party importer has a
-- source for one; the reasoning was wrong then and would be wrong here.
--
-- It is JSON in a TEXT column, which is what pos_json and reads_json (0024)
-- already are and for the identical reason: the queue is a staging area, not a
-- second schema, and a parsed cast is a list of small records that only ever
-- travels whole. A staged_cast table would need its own selection, its own
-- part-approval and its own garbage collection to hold data that lives for
-- exactly as long as a batch does.
--
-- DEFAULT '[]' rather than '' so that the fill-empty-only backfill in
-- stageMovieWork can spell "this row learnt nothing yet" as one comparison,
-- exactly as reads_json does.
ALTER TABLE staged_works ADD COLUMN cast_json TEXT NOT NULL DEFAULT '[]';

-- ------------------------------------------- movies.cast_json IS NOT DROPPED
--
-- And it is still WRITTEN for one more release — by the two paths that replace a
-- title's whole record (the create-from-source insert and resyncMovieFromSource),
-- and only WHERE IT IS EMPTY by the third.
--
-- THE THIRD PATH IS THE ONE THAT MUST NOT SPEND IT. applyReverifyMovie writes the
-- approved re-verify diff AND is what /metadata/fill applies through, and fill is
-- unattended and bulk: fifteen titles a call, no diff on screen, chunked over a
-- whole selection by the client. A resync is one title somebody asked for by
-- name; a fill is a button that can walk a library. So that statement is a CASE
-- that fills a '[]' blob and leaves any other alone, which keeps the pre-0048
-- copy on every title that has one. It was ALSO how the blob's last reader kept
-- getting a list on a title that never had one; that reader has since moved to
-- this table (see below), and what holds the CASE in place now is narrower — it
-- keeps `cast_json` in the UPDATE's column list, so a cast-only approval still
-- has a statement to prove the row is the caller's with.
--
-- THE PRECEDENT IS EXPLICIT AND IT IS FOLLOWED ON PURPOSE. 0036 left
-- utterances.category in place "deliberately and for one release", with the
-- reason spelled out: "Dropping a column is the one migration step that cannot
-- be walked back by hand, and the backfill above is the only thing standing
-- between the reader's filing and a board full of everything." 0037 then spent
-- its own backfill on that column and called it "the last use of `category`, and
-- it is what it was kept for". This is that arrangement again, in the same
-- schema, eleven migrations later.
--
-- One deliberate strengthening over 0036's case. `category` was a value the
-- reader typed and could have retyped from memory; a CAST comes from a provider
-- that may be unreachable, out of quota or unkeyed next week — so if this
-- backfill turns out to be wrong about somebody's library, the frozen copy in
-- cast_json is not merely convenient, it is the only copy in existence. It is
-- kept so that a mistake here is repairable, and it may be dropped in 0049 or
-- later once a version has shipped that proves the mapping held on a real
-- library rather than on this file's reading of one.
--
-- NOTHING READS IT, and that sentence is the condition for dropping the column.
-- It began as an inventory of the one thing that still did — the quiz's speaker
-- distractors (castActors, review_handlers.go) — with the move deferred to the
-- drop commit and recorded as a failing-when-fixed test rather than as prose.
-- THE DEFERRAL DID NOT SURVIVE THE FILL-ONLY WRITE ABOVE. A frozen column with a
-- reader on it is a pool that goes stale the first time a cast diff is approved
-- and never recovers, while resyncMovieFromSource goes on replacing the blob
-- whole — one title, two buttons, two answers. So the distractors read work_cast
-- now (quizPools, review_handlers.go), which also gives a GAME's typed voice cast
-- its first distractors: the blob is '[]' for nearly every game, so there was
-- never anything there to offer.
--
-- The actor→portrait resolver was the other reader and moved for the same reason
-- one step earlier — the blob holds no name the reader corrected and nothing at
-- all for a game, so every such actor was being resolved by a namesake-prone
-- by-name search. Both wanted the same two facts (a person id, a headshot) and
-- this table carries both per row, which is why each was a move and not a
-- rewrite.
--
-- ------------------------------------------- dialogues.actor IS NOT TOUCHED
--
-- The mapping becomes the SOURCE THAT FILLS `dialogues.actor`, not a replacement
-- for it. That column is stored on the line, indexed in dialogues_fts (since
-- 0003), faceted — the whole Actors section of the search page is an FTS query
-- against it — exported and imported. A quote carries the name it was saved
-- with, which is also what keeps a line honest when a cast row is corrected or
-- deleted later. Nothing here writes to it, and nothing here stops anything else
-- writing to it.
