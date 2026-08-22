-- 0047: a field model per kind, and a kind vocabulary that can grow.
--
-- Nine types share three quote tables here — book, film, show and game hang off
-- `books`/`movies`, and the five standalone kinds all live in `utterances` — and
-- until now every one of them was offered whichever columns its table happened to
-- have. So a novel's dialogue had nowhere to name its speaker, a game's line was
-- located by a timestamp it does not have, a letter could not say who it was to,
-- and a book carried no language at all while a proverb carried one. This adds the
-- missing column to each, in one pass, so that the forms being redesigned in
-- parallel have something real to bind to.
--
-- EVERY NEW COLUMN'S DEFAULT IS THE ZERO VALUE — '' for text, 0 for a flag —
-- which is 0045's rule and it is worth restating: an upgraded database has to read
-- identically to a fresh one, and a non-zero default is a value somebody has to
-- review on every row it was written to. NOT NULL with it, so nothing downstream
-- needs a COALESCE and no scanner needs a pointer. That is a deliberate break with
-- 0001's habit of nullable text on these tables; 0026 and 0035 already write the
-- new way and this follows them, at the cost of the two spellings sitting side by
-- side in `annotations` and `dialogues` for good.
--
-- ---------------------------------------------------------------- dialogues
--
-- ACT AND QUEST ARE A GAME'S ONLY LOCATORS, and they nest exactly as season and
-- episode do: an act with no quest is ordinary, and a quest inside no act is
-- ordinary too, because most games number neither. Free text, because "Prologue",
-- "Chapter II" and "3" are all things a game calls the same thing — and free text
-- is also what makes them safe to fold into the dedupe hash, on which see below.
--
-- They are NOT a second spelling of season/episode. A game is a `movies` row
-- (0040) and season/episode stay meaningless on it: the server clears them the way
-- it already clears a season on a film, and it clears act/quest on a film and on a
-- show for the same reason. That rule lives in Go and not in a CHECK because
-- SQLite cannot reach across to movies.media_type — 0025's argument, unchanged.
--
-- EPISODE_NAME belongs to the show and to nothing else. Season and episode NUMBER
-- a line; the episode's title is what a reader actually remembers it by, and until
-- now it could only be typed into the note. It sits on the LINE rather than in a
-- new episodes table on purpose: an episode record would need a title, a number, a
-- season, an air date and a screen of its own before it earned itself, and what is
-- wanted here is one string beside the number it belongs to.
--
-- ---------------------------------------------------------------- annotations
--
-- A NOVEL HAS SPEAKERS AND NOT A CAST, which is the whole reason `character` lands
-- here and `actor` does not. `dialogues` has carried both since 0003 because a
-- film line genuinely has two people behind it; a line of Ahab's has one, and a
-- column for the actor who plays him would be empty in every book ever imported.
--
-- ---------------------------------------------------------------- utterances
--
-- Five columns, one per standalone kind that needed one:
--
--   region          a proverb's. A Bengali proverb from Sylhet is not one from
--                   Kolkata, and `place` already means something else on this
--                   table — where a speech was delivered. Free text, never an
--                   enum: the set of regions belongs to the reader, which is
--                   0035's argument for `language` verbatim.
--   recipient       a letter's, and it is what makes a letter a letter. Without
--                   it the kind is a speech with a field hidden.
--   work_title      an essay's source title, and
--   locator         its page, section or paragraph.
--   occasion_circa  "around 1890" for the occasion's date — the flag
--                   books.published_circa already is for a publication year.
--                   INTEGER because SQLite has no boolean, and 0/1 is what every
--                   other flag in this schema stores.
--
-- WORK_TITLE AND LOCATOR ARE NAMED GENERICALLY ON PURPOSE. The kinds being built
-- are Others, Proverb, Speech, Letter and Essay; Poem, Lyrics and Article are
-- expected and are explicitly NOT being built. Naming these two `essay_title` and
-- `essay_page` would make each of those three a migration instead of a label and a
-- list entry, which is the cost this file spends one sentence to avoid.
--
-- ERA IS NOT A COLUMN, and that is a refusal rather than an omission. Traditional
-- versus modern is a judgement, it is binary only until the first classical
-- proverb arrives, and every quote already has tags — a managed vocabulary with
-- its own colours and its own page. A boolean would have to be migrated into a
-- vocabulary the moment somebody wanted a third value.
--
-- ---------------------------------------------------------------- books
--
-- A BOOK CARRIED NO LANGUAGE AT ALL, which is the odder half of a real asymmetry:
-- 0035 gave a standalone quote a language and a translation, and the shelf holding
-- translated novels had neither. Two columns rather than one, because a translated
-- book has two facts — what you are reading, and what it was written in — and one
-- column can only hold whichever the reader typed last.
--
-- Plain names ('Bengali'), not BCP-47 tags, for 0035's stated reason: the value is
-- only ever shown to a person and grouped on, 'bn' would have to be translated
-- back at every read, and the first hand-typed 'bengali' breaks the join anyway.
--
-- ---------------------------------------------------------- the staging mirror
--
-- Every import stages before it writes (0023), so a column present on the live
-- table and absent from the queue is a field that survives the export, survives
-- the parse and is dropped at the last step — 0034's and 0044's words for the same
-- hazard, and the one place a loss is invisible because the file is already gone.
--
-- Plain ALTER TABLE and no rebuild, which is 0028's stated precedent for this
-- table: a rebuild would still have to recreate the UNIQUE and the index by hand,
-- for no gain. staged_quotes already carries `character` (0023's column, kept
-- through 0029's rebuild), so only the eight are added.
--
-- ------------------------------------------------ boards.kind loses its CHECK
--
-- THE VOCABULARY WIDENS FROM TWO VALUES TO FIVE — plain | proverb | speech |
-- letter | essay — AND THE CHECK IS DROPPED RATHER THAN WIDENED.
--
-- 0045 wrote the argument and it applies here word for word: "a CHECK on six
-- columns is six things SQLite cannot later alter (0029 rebuilt four tables to
-- widen one CHECK, which is the whole argument)". This vocabulary is EXPECTED to
-- grow — Poem, Lyrics and Article are named above as the reason two of the new
-- utterance columns are spelled generically, and each of them is a board kind
-- eventually. A CHECK here means a migration every time, and the migration is
-- exactly the awkward one below. So: validated in Go, alongside media_type
-- (0006), status (0024) and person_kinds (0027), every one of which carries no
-- CHECK for this reason and every one of which has since gained a value without a
-- schema change. THIS MUST NOT BECOME A CHECK AGAIN.
--
-- THIS FIXES A SHIPPED 500, which is worth saying plainly because nothing tests
-- it. board_handlers.go has defined boardKindSpeech = "speech" and accepted it
-- since 1.15.0, with a header arguing that a speech board earns its kind; the
-- Quotes page POSTs it from the Speeches starter; and 0037's CHECK refuses it. So
-- pressing that starter today is an insert that fails the constraint and answers
-- 500. The Go validator and the schema have disagreed for a release.
--
-- WHY THIS IS DROP COLUMN + ADD COLUMN AND NOT 0029'S REBUILD. SQLite cannot alter
-- or drop a CHECK, and the standard answer in this repo is the rebuild dance: park
-- the children, build a `_new` table, copy, DROP, rename, recreate the indexes and
-- the triggers. IT DOES NOT TRANSFER TO `boards`, because boards is the parent of
-- a RESTRICT child rather than a CASCADE one — utterances.board_id is ON DELETE
-- RESTRICT (0036, deliberately: deleting a board must ask where its quotes go and
-- refuse until told). All three ways round that were probed on this schema:
--
--   * DROP TABLE boards, with any quote filed on any board, fails outright —
--     FOREIGN KEY constraint failed (1811). It does not cascade; that is what
--     RESTRICT means. So 0029's "DROP cascades, therefore park the join rows"
--     does not apply, and there is nothing that parking can buy.
--   * PRAGMA defer_foreign_keys=1 lets the DROP through and then fails at COMMIT
--     (787), because a RESTRICT action is not deferrable.
--   * PRAGMA foreign_keys=OFF is a NO-OP inside a transaction — 0029's own header
--     says so, and it was re-probed here: the pragma returns no error, the setting
--     reads back as 1, and the DROP still fails 1811. Every migration runs inside
--     a transaction.
--
-- A rebuild would therefore additionally have to park utterances.board_id, null
-- it, rebuild, and re-point it, plus recreate idx_boards_user and the UNIQUE by
-- hand. DROP COLUMN + ADD COLUMN with the values parked in a scratch table is
-- strictly fewer moving parts, and it takes the CHECK with it: the constraint was
-- written as part of the column definition by 0037's ALTER TABLE ADD COLUMN, so
-- dropping the column removes both (probed).
--
-- WHAT IT COSTS, stated rather than discovered:
--
--   * `kind` MOVES TO THE END of the table's column order, after `languages`.
--     schema_test.go pins column order for the tables it captures, precisely
--     because that order is the history; `boards` is not one of them, but the fact
--     is recorded here so a later reader knows the order is 0047's, not 0037's.
--   * DROP COLUMN needs SQLite >= 3.35. modernc's is far newer (3.53.2, probed),
--     and this binary is the only thing that ever opens the file.
--   * The one POSITIONAL reader of a base table is store.Recover, which copies
--     with `INSERT INTO main."t" SELECT * FROM old."t"`. It only ever runs AFTER a
--     successful Migrate, and the fresh side is built by these same migrations, so
--     both sides of that copy always move together. Trash and restore discover
--     columns by name and the backup is a file-level VACUUM INTO, so neither cares
--     what order the columns are in.
--
-- NO REPLACEMENT CHECK, AND NO NEW INDEX. There is deliberately no
-- idx_boards_kind: a reader has tens of boards rather than thousands, and
-- idx_boards_user (user_id, hidden, pos) already covers the only query that lists
-- them.
--
-- 'plain' STAYS THE STORED VALUE for the kind the screen calls "Others". Renaming
-- a stored value to match a label is a data migration that buys a label, and the
-- label is a locale key.
--
-- utterances.category IS NOT REVIVED. 0035 put a kind on the quote, 0036 called
-- that "the wrong shape", and 0037 moved it to the board and spent its backfill on
-- it — the last use, and what the column was kept for. This file extends the
-- BOARD's kind. Nothing here reads or writes `category`.
--
-- -------------------------------------------------------------- the FTS indexes
--
-- WHAT IS INDEXED, AND WHY IT IS ONLY THREE OF THE ELEVEN NEW COLUMNS.
--
--   annotations.character   INDEXED. dialogues_fts has carried `character` since
--                           0003, the search page already builds a Characters
--                           section out of it, and the vocabulary endpoint already
--                           autocompletes it — for films, shows and games only. A
--                           book character that is storable and not findable is
--                           precisely the parity gap the quote-parity tests exist
--                           to catch, and it would read as a bug on the day the
--                           form ships.
--   utterances.recipient    INDEXED, both of them. "Every letter to Nehru" and
--   utterances.work_title   "everything in that essay" are the same query shape as
--                           "everything Bose said", which is already a section of
--                           the results. One rebuild of this index covers both,
--                           and there will not be a cheaper moment to do it.
--
--   act, quest, locator     NOT INDEXED. They are LOCATORS, and no locator in this
--                           schema is indexed — not chapter, not location, not the
--                           timestamp. Searching by one is what the facet grammar
--                           is for.
--   region, language,       NOT INDEXED, for 0026's reason about place and medium
--   orig_language           and 0035's about language: they are short reader-owned
--                           vocabularies rather than prose, and indexing them
--                           would let a search for "Bengali" return every Bengali
--                           proverb, ranked above the quote that is actually about
--                           Bengal. The vocabulary endpoint is their surface.
--   episode_name            NOT INDEXED, for the same reason as the season it sits
--                           beside; and a show's own title is already in
--                           movies_fts.
--   occasion_circa          a flag.
--
-- AN FTS5 EXTERNAL-CONTENT TABLE CANNOT GAIN A COLUMN, so each of the two indexes
-- is dropped and recreated: drop the three sync triggers, drop the virtual table,
-- recreate it with the column appended, recreate the triggers VERBATIM from the
-- migration that last cut them, and rebuild LAST. That order is not stylistic —
-- 0029 records that rebuilding an external-content index while its triggers are
-- live is the documented route to "database disk image is malformed".
--
-- COLUMNS ARE APPENDED, NEVER REORDERED (0029's rule), so anything that names a
-- column by position keeps meaning what it meant. bm25() is called with no
-- per-column weights, so a new column changes no ranking.
--
-- THE NAMES MUST LAND BACK EXACTLY, and both failures are silent: store.Recover
-- excludes '%\_fts' from its table copy, and rebuildFTSTable finds an index's
-- triggers with `sql LIKE '%<name>%'`. The *_fts_vocab tables are untouched —
-- fts5vocab resolves its target by name at query time and exposes (term, doc, cnt)
-- whatever the target's columns are, so it survives the target being replaced under
-- it. repair.go's ftsTables list needs no edit either: no index is added or removed
-- here, only widened.
--
-- ------------------------------------------------------------- the dedupe hash
--
-- ACT AND QUEST FOLD INTO DialogueDedupeHash. EVERY NEW UTTERANCE FIELD STAYS OUT.
-- That asymmetry is the one decision in this file that has to be argued rather
-- than stated.
--
-- The dialogue side is the television argument, unchanged: a series is a single
-- `movies` row while a line is located by episode, so the same words twice in one
-- work are two quotes rather than a duplicate. A game is the same shape — one
-- `movies` row — and a bark that recurs in two quests is two quotes, not one that
-- was saved twice. Leaving act/quest out would mean only the first occurrence
-- could ever be stored, which is exactly the loss the qualified hash was written
-- to stop.
--
-- NOTHING ON DISK NEEDS REHASHING, and that is a property rather than a hope:
-- every dialogue that exists has act = quest = '' because the columns did not
-- exist, and DialogueDedupeHash is byte-identical to its old self whenever both
-- are empty. A film row keeps its plain-text hash and a show row keeps its
-- season/episode hash. BackfillDialogueHashes is still widened to select the two
-- new columns — not to repair anything today, since no historical row can carry an
-- act, but so that the self-healing property its own header claims covers the new
-- locators too. That is what makes a stale hash left by a bulk field edit heal at
-- the next boot instead of waiting for a duplicate to appear.
--
-- The utterance side goes the other way, and the case that looks arguable is
-- occasion_circa: occasion_date IS folded into UtteranceDedupeHash and the circa
-- flag is not, because ticking a precision box beside a date must not fork a
-- duplicate of the quote. region, work_title and locator LOCATE or DESCRIBE, which
-- is the excluded side of the line all three hash functions draw. recipient is the
-- interesting refusal: it arguably identifies a letter the way an occasion
-- identifies a speech — but it is also the field most likely to be filled in after
-- the fact ("a friend" becomes "Nehru"), and folding it in would make that
-- refinement fork a duplicate on the next import of the same file rather than
-- enriching the row already there. There is also no BackfillUtteranceHashes, so a
-- field added to that hash would silently strand every row that later gains a
-- value.

-- ───────────────────────── the game's locators, and the show's episode name
ALTER TABLE dialogues ADD COLUMN act          TEXT NOT NULL DEFAULT '';
ALTER TABLE dialogues ADD COLUMN quest        TEXT NOT NULL DEFAULT '';
ALTER TABLE dialogues ADD COLUMN episode_name TEXT NOT NULL DEFAULT '';

-- ───────────────────────── a novel has speakers, not a cast
ALTER TABLE annotations ADD COLUMN character TEXT NOT NULL DEFAULT '';

-- ───────────────────────── what a proverb, a letter and an essay carry
ALTER TABLE utterances ADD COLUMN region         TEXT    NOT NULL DEFAULT '';
ALTER TABLE utterances ADD COLUMN recipient      TEXT    NOT NULL DEFAULT '';
ALTER TABLE utterances ADD COLUMN work_title     TEXT    NOT NULL DEFAULT '';
ALTER TABLE utterances ADD COLUMN locator        TEXT    NOT NULL DEFAULT '';
ALTER TABLE utterances ADD COLUMN occasion_circa INTEGER NOT NULL DEFAULT 0;

-- ───────────────────────── a book's two languages
ALTER TABLE books ADD COLUMN language      TEXT NOT NULL DEFAULT '';
ALTER TABLE books ADD COLUMN orig_language TEXT NOT NULL DEFAULT '';

-- ───────────────────────── the staging mirror
ALTER TABLE staged_quotes ADD COLUMN act            TEXT    NOT NULL DEFAULT '';
ALTER TABLE staged_quotes ADD COLUMN quest          TEXT    NOT NULL DEFAULT '';
ALTER TABLE staged_quotes ADD COLUMN episode_name   TEXT    NOT NULL DEFAULT '';
ALTER TABLE staged_quotes ADD COLUMN region         TEXT    NOT NULL DEFAULT '';
ALTER TABLE staged_quotes ADD COLUMN recipient      TEXT    NOT NULL DEFAULT '';
ALTER TABLE staged_quotes ADD COLUMN work_title     TEXT    NOT NULL DEFAULT '';
ALTER TABLE staged_quotes ADD COLUMN locator        TEXT    NOT NULL DEFAULT '';
ALTER TABLE staged_quotes ADD COLUMN occasion_circa INTEGER NOT NULL DEFAULT 0;
ALTER TABLE staged_works  ADD COLUMN language       TEXT    NOT NULL DEFAULT '';
ALTER TABLE staged_works  ADD COLUMN orig_language  TEXT    NOT NULL DEFAULT '';

-- ───────────────────────── boards.kind loses its CHECK
--
-- The values are parked in a scratch table keyed by id, because DROP COLUMN
-- discards them and ADD COLUMN can only supply one default for every row. The
-- scratch table is created and dropped inside this migration's own transaction,
-- so nothing outside it — store.Recover's table list included — can ever see it.
--
-- The COALESCE is defensive rather than necessary: the INSERT above wrote one row
-- per board, so there is nothing for it to catch. It is there because 'plain' is
-- the honest answer for a board this migration somehow could not read, and NULL
-- would be a NOT NULL violation that aborted the whole upgrade.
CREATE TABLE _board_kinds_0047 (id INTEGER PRIMARY KEY, kind TEXT NOT NULL);
INSERT INTO _board_kinds_0047 (id, kind) SELECT id, kind FROM boards;
ALTER TABLE boards DROP COLUMN kind;
ALTER TABLE boards ADD COLUMN kind TEXT NOT NULL DEFAULT 'plain';
UPDATE boards SET kind =
  COALESCE((SELECT p.kind FROM _board_kinds_0047 p WHERE p.id = boards.id), 'plain');
DROP TABLE _board_kinds_0047;

-- ───────────────────────── annotations_fts gains `character`
--
-- The triggers below are 0029's, verbatim, with `character` appended to every
-- column list. The two non-FTS triggers on this table — item_reviews_book_del
-- (0015) and anthology_entries_book_del (0043) — are deliberately not touched:
-- they are attached to `annotations`, and `annotations` is not being rebuilt.
DROP TRIGGER IF EXISTS annotations_ai;
DROP TRIGGER IF EXISTS annotations_ad;
DROP TRIGGER IF EXISTS annotations_au;
DROP TABLE IF EXISTS annotations_fts;

CREATE VIRTUAL TABLE annotations_fts USING fts5(
  quote, note, character,
  content='annotations', content_rowid='id',
  tokenize='unicode61 remove_diacritics 2',
  prefix='2 3'
);

CREATE TRIGGER annotations_ai AFTER INSERT ON annotations BEGIN
  INSERT INTO annotations_fts(rowid, quote, note, character)
  VALUES (new.id, new.quote, new.note, new.character);
END;
CREATE TRIGGER annotations_ad AFTER DELETE ON annotations BEGIN
  INSERT INTO annotations_fts(annotations_fts, rowid, quote, note, character)
  VALUES ('delete', old.id, old.quote, old.note, old.character);
END;
CREATE TRIGGER annotations_au AFTER UPDATE ON annotations BEGIN
  INSERT INTO annotations_fts(annotations_fts, rowid, quote, note, character)
  VALUES ('delete', old.id, old.quote, old.note, old.character);
  INSERT INTO annotations_fts(rowid, quote, note, character)
  VALUES (new.id, new.quote, new.note, new.character);
END;

INSERT INTO annotations_fts(annotations_fts) VALUES('rebuild');

-- ───────────────────────── utterances_fts gains `recipient` and `work_title`
--
-- 0035's triggers, verbatim, with the two columns appended after `translation` —
-- appended and not slotted in beside `speaker`, so the existing five keep their
-- positions.
DROP TRIGGER IF EXISTS utterances_ai;
DROP TRIGGER IF EXISTS utterances_ad;
DROP TRIGGER IF EXISTS utterances_au;
DROP TABLE IF EXISTS utterances_fts;

CREATE VIRTUAL TABLE utterances_fts USING fts5(
  quote, note, speaker, occasion, translation, recipient, work_title,
  content='utterances', content_rowid='id',
  tokenize='unicode61 remove_diacritics 2',
  prefix='2 3'
);

CREATE TRIGGER utterances_ai AFTER INSERT ON utterances BEGIN
  INSERT INTO utterances_fts(rowid, quote, note, speaker, occasion, translation, recipient, work_title)
  VALUES (new.id, new.quote, new.note, new.speaker, new.occasion, new.translation, new.recipient, new.work_title);
END;
CREATE TRIGGER utterances_ad AFTER DELETE ON utterances BEGIN
  INSERT INTO utterances_fts(utterances_fts, rowid, quote, note, speaker, occasion, translation, recipient, work_title)
  VALUES ('delete', old.id, old.quote, old.note, old.speaker, old.occasion, old.translation, old.recipient, old.work_title);
END;
CREATE TRIGGER utterances_au AFTER UPDATE ON utterances BEGIN
  INSERT INTO utterances_fts(utterances_fts, rowid, quote, note, speaker, occasion, translation, recipient, work_title)
  VALUES ('delete', old.id, old.quote, old.note, old.speaker, old.occasion, old.translation, old.recipient, old.work_title);
  INSERT INTO utterances_fts(rowid, quote, note, speaker, occasion, translation, recipient, work_title)
  VALUES (new.id, new.quote, new.note, new.speaker, new.occasion, new.translation, new.recipient, new.work_title);
END;

INSERT INTO utterances_fts(utterances_fts) VALUES('rebuild');
