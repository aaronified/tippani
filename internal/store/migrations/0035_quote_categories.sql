-- 0035: what KIND of standalone quote this is, and — for a proverb — whose
-- language it belongs to.
--
-- 0026 built one table for "a line from a speech, a letter, an interview, a
-- song, a proverb, something a friend said", and the screen showed all of them
-- in one board. That was right for one kind of thing and is wrong for three: a
-- proverb has no speaker, no occasion, no date and no place, so it lands in the
-- residual bucket of every grouping the screen offers, and a shelf of proverbs
-- sits mixed into a shelf of Nehru speeches with nothing to tell them apart.
--
-- So the board splits three ways — proverbs, speeches, others — and a quote has
-- to know which it is.
--
-- ---------------------------------------------------------------- category
--
-- DEFAULT 'other', so every existing row keeps meaning exactly what it meant.
-- The alternative — guessing from `medium`, promoting anything that says
-- "speech" — is a migration that RECLASSIFIES somebody's library on upgrade,
-- silently, with no way to tell what it moved. A default nobody has to review
-- beats a guess that is right most of the time.
--
-- The CHECK goes in the ADD COLUMN, which SQLite permits (0021 does exactly this
-- for dialogues.color) — no table rebuild, and therefore none of the FTS
-- drop-and-recreate that a rebuild of this table would drag in.
--
-- ---------------------------------------------------------------- language
--
-- Free text, not an enum. A proverb belongs to a language and the set of
-- languages is the reader's, not this schema's: an enum would need a migration
-- to add Marathi. Empty for everything that is not a proverb, and empty is legal
-- for a proverb too — you may not know.
--
-- Stored as a plain name ('Bengali', 'Hindi'), not a BCP-47 tag. The tag is the
-- right answer for a machine and this value is only ever shown to a person and
-- grouped on; 'bn' would have to be translated back into 'Bengali' at every
-- read, and the first hand-typed 'bengali' would break the join anyway.
--
-- ------------------------------------------------------------- translation
--
-- Optional, and only meaningful when the quote is not already in the reader's
-- language. Its own column rather than reusing `note`: a note is what YOU
-- thought about the line, a translation is what the line SAYS, and folding them
-- together would put the two on the card in the same voice and make the note
-- filter ("has a note") answer yes for every translated proverb.
--
-- ------------------------------------------------------- the dedupe hash
--
-- NONE OF THE THREE FOLD INTO IT, and that is the decision this migration
-- actually turns on.
--
-- 0026 inverted the usual rule for this table: the occasion is a locator and it
-- DISCRIMINATES, so the same words on two occasions are two quotes. It is
-- tempting to read category the same way. It is not the same: the occasion is
-- part of what the quote IS, while the category is where you have decided to
-- file it. The same words filed as a proverb and as an other are one saved line
-- that somebody moved, not two.
--
-- And the cost of the other choice is the real argument. UtteranceDedupeHash is
-- a SHA over normalised fields, computed in Go; SQL cannot compute it. Folding
-- category in would stale every hash already on disk, which means a Migrate-time
-- backfill over `utterances` AND `staged_quotes` — the whole BackfillDialogueHashes
-- apparatus — plus a signature change at four call sites, one of which is
-- rehashRenamedQuotes, which runs after a SPEAKER rename. All of it to express
-- "these are two quotes" about a case nobody has.
--
-- The consequence, stated rather than discovered: re-importing a file that
-- categorises a line differently updates nothing and inserts nothing, because
-- the row is already there under the same hash. That is the same behaviour every
-- other non-hashed field already has.
--
-- --------------------------------------------------------------------- FTS
--
-- translation IS indexed, and it is the only one of the three that should be.
-- Somebody searching for "the thief's mother" over a shelf of Bengali proverbs
-- is searching the English, because the English is the half they can type. That
-- needs the utterances_fts triggers rebuilt to carry a fifth column — see below.
--
-- category and language stay OUT, for 0026's stated reason about place and
-- medium: they are filter values rather than prose, and indexing them would let
-- a search for "proverb" return every proverb, ranked above the quote actually
-- about proverbs.

ALTER TABLE utterances ADD COLUMN category TEXT NOT NULL DEFAULT 'other'
  CHECK (category IN ('proverb','speech','other'));
ALTER TABLE utterances ADD COLUMN language    TEXT NOT NULL DEFAULT '';
ALTER TABLE utterances ADD COLUMN translation TEXT NOT NULL DEFAULT '';

-- The staging queue carries them too, for the reason 0034 records about
-- translator: Tippani's own Markdown export is an importer's source and every
-- import is staged, so a column missing here is a field that survives the export,
-- survives the parse and is dropped on the way into the queue.
ALTER TABLE staged_quotes ADD COLUMN category    TEXT NOT NULL DEFAULT 'other';
ALTER TABLE staged_quotes ADD COLUMN language    TEXT NOT NULL DEFAULT '';
ALTER TABLE staged_quotes ADD COLUMN translation TEXT NOT NULL DEFAULT '';

CREATE INDEX idx_utterances_category ON utterances(user_id, category);

-- ------------------------------------------------------- rebuilding the index
--
-- An FTS5 external-content table cannot gain a column by ALTER; the virtual
-- table and its three sync triggers are dropped and recreated, then repopulated
-- from the content table. 0029 did exactly this to the same index and is the
-- shape being followed.
--
-- THE NAME IS CONSTRAINED IN TWO DIRECTIONS and both failures are silent —
-- store.Recover() excludes '%\_fts' and '%\_fts\_%' from its table copy, and
-- rebuildFTSTable finds an index's triggers with `sql LIKE '%<name>%'`. So this
-- lands back on `utterances_fts` exactly, and the vocab table is left alone:
-- fts5vocab resolves its target by name and exposes (term, doc, cnt) whatever
-- the target's columns are, so it survives the target being replaced under it.
DROP TRIGGER IF EXISTS utterances_ai;
DROP TRIGGER IF EXISTS utterances_ad;
DROP TRIGGER IF EXISTS utterances_au;
DROP TABLE IF EXISTS utterances_fts;

CREATE VIRTUAL TABLE utterances_fts USING fts5(
  quote, note, speaker, occasion, translation,
  content='utterances', content_rowid='id',
  tokenize='unicode61 remove_diacritics 2',
  prefix='2 3'
);

CREATE TRIGGER utterances_ai AFTER INSERT ON utterances BEGIN
  INSERT INTO utterances_fts(rowid, quote, note, speaker, occasion, translation)
  VALUES (new.id, new.quote, new.note, new.speaker, new.occasion, new.translation);
END;
CREATE TRIGGER utterances_ad AFTER DELETE ON utterances BEGIN
  INSERT INTO utterances_fts(utterances_fts, rowid, quote, note, speaker, occasion, translation)
  VALUES ('delete', old.id, old.quote, old.note, old.speaker, old.occasion, old.translation);
END;
CREATE TRIGGER utterances_au AFTER UPDATE ON utterances BEGIN
  INSERT INTO utterances_fts(utterances_fts, rowid, quote, note, speaker, occasion, translation)
  VALUES ('delete', old.id, old.quote, old.note, old.speaker, old.occasion, old.translation);
  INSERT INTO utterances_fts(rowid, quote, note, speaker, occasion, translation)
  VALUES (new.id, new.quote, new.note, new.speaker, new.occasion, new.translation);
END;

-- Repopulate from the content table. 'rebuild' is the documented way and is what
-- 0029 used; it reads every row of `utterances` through the new column list.
INSERT INTO utterances_fts(utterances_fts) VALUES('rebuild');
