-- 0051: what the line says, on all three kinds of quote.
--
-- 0035 gave a standalone quote a `translation`, because a proverb is the case
-- that forced it: a Bengali proverb saved by a reader who thinks in English is
-- two texts, and only one of them is the quote. This puts the same column on the
-- other two kinds, where the same reader has the same problem and until now had
-- nowhere to put the answer but the note.
--
-- THE NOTE IS NOT THE PLACE, and that is the whole argument. A note is what YOU
-- thought about the line; a translation is what the LINE says. Folded together
-- they cannot be told apart by anything downstream: the review deck asks you to
-- recall a quote and shows you its own words in another language as the prompt;
-- the share image prints your private reaction where the meaning should be; and
-- `notes` as a search section stops meaning notes. quote_markdown.go has drawn
-- that distinction in one sentence since the importer was written — "a note is
-- what you thought, a translation is what the line says" — and this is the
-- migration that makes it true of the other two kinds.
--
-- ON THE QUOTE AND NOT ON THE WORK. A book already records two languages (0047:
-- `language` is the edition in hand, `orig_language` what it was written in), and
-- it would be tempting to read a translation off those. It cannot be: the work's
-- languages say what the BOOK is, and the translation is a fact about one
-- sentence somebody wrote down. A single Bengali novel yields highlights the
-- reader translated and highlights they did not, and there is no column on
-- `books` that can be true of both.
--
-- NO `language` COLUMN BESIDE IT, which is the asymmetry with 0035 worth naming.
-- A standalone quote has no parent, so it carries its own `language` — without it
-- a proverb has no locator at all. An annotation's original language is the
-- book's, which `books.language` already holds. A film's is nowhere: `movies` has
-- no language column and this migration does not add one, so a translated
-- dialogue records what it says and not what it was said in. That is a real gap,
-- left open deliberately rather than closed on the way past: a film's language is
-- a work field, it belongs with the metadata pipeline that fills the rest of
-- them from a provider, and inventing it here as a free-text box on the quote
-- form would put the same fact in two places on two kinds.
--
-- UNCAPPED PROSE, like `quote` and `note` and unlike every locator around them.
-- A translation is routinely longer than its original — Bengali compounds into
-- English needs the room — so there is no length here for the same reason there
-- is none on the words being translated.
--
-- NOT IN THE DEDUPE HASH. The hash answers "is this the same quote", and the
-- answer cannot depend on whether somebody has got round to translating it yet:
-- folding this in would make typing a translation fork a second copy of the line
-- on the next import of the same file. 0035 settled this for the third kind and
-- store.DedupeHash is unchanged here.
ALTER TABLE annotations ADD COLUMN translation TEXT NOT NULL DEFAULT '';
ALTER TABLE dialogues   ADD COLUMN translation TEXT NOT NULL DEFAULT '';

-- ───────────────────────── the two indexes gain `translation`
--
-- SEARCHABLE, and 0034 is the precedent that argues the other way: it refused to
-- put `translator` in books_fts because the rebuild is a real risk — DROP and
-- CREATE of the virtual table and its three sync triggers, then a full reindex —
-- "taken for a feature nobody asked for".
--
-- This is the feature. A translation exists so that the half of the line the
-- reader can actually type is written down somewhere; an index that does not hold
-- it means typing that half finds nothing, which is the one thing a translation
-- was for. utterances_fts has carried the column since 0035 for exactly this
-- reason, and a search that finds a translated proverb but not a translated
-- highlight is the drift quote.go's parity tests exist to stop.
--
-- The triggers below are 0047's for annotations and 0029's for dialogues,
-- verbatim, with `translation` APPENDED to every column list — appended and not
-- slotted in beside `note`, so the existing columns keep their positions.
--
-- The name has to land exactly: store.Recover() excludes '%\_fts' and
-- '%\_fts\_%' from its table copy, and rebuildFTSTable finds an index's triggers
-- with `sql LIKE '%<name>%'`. The fts5vocab shadows are left alone — they resolve
-- their target by name and expose (term, doc, cnt) whatever its columns are, so
-- they survive the target being replaced under them (0035).
--
-- The non-FTS triggers on these two tables are deliberately untouched:
-- item_reviews_book_del and item_reviews_screen_del (0015/0018) and
-- anthology_entries_book_del (0043) are attached to `annotations` and
-- `dialogues`, and neither base table is being rebuilt here.
DROP TRIGGER IF EXISTS annotations_ai;
DROP TRIGGER IF EXISTS annotations_ad;
DROP TRIGGER IF EXISTS annotations_au;
DROP TABLE IF EXISTS annotations_fts;

CREATE VIRTUAL TABLE annotations_fts USING fts5(
  quote, note, character, translation,
  content='annotations', content_rowid='id',
  tokenize='unicode61 remove_diacritics 2',
  prefix='2 3'
);

CREATE TRIGGER annotations_ai AFTER INSERT ON annotations BEGIN
  INSERT INTO annotations_fts(rowid, quote, note, character, translation)
  VALUES (new.id, new.quote, new.note, new.character, new.translation);
END;
CREATE TRIGGER annotations_ad AFTER DELETE ON annotations BEGIN
  INSERT INTO annotations_fts(annotations_fts, rowid, quote, note, character, translation)
  VALUES ('delete', old.id, old.quote, old.note, old.character, old.translation);
END;
CREATE TRIGGER annotations_au AFTER UPDATE ON annotations BEGIN
  INSERT INTO annotations_fts(annotations_fts, rowid, quote, note, character, translation)
  VALUES ('delete', old.id, old.quote, old.note, old.character, old.translation);
  INSERT INTO annotations_fts(rowid, quote, note, character, translation)
  VALUES (new.id, new.quote, new.note, new.character, new.translation);
END;

INSERT INTO annotations_fts(annotations_fts) VALUES('rebuild');

DROP TRIGGER IF EXISTS dialogues_ai;
DROP TRIGGER IF EXISTS dialogues_ad;
DROP TRIGGER IF EXISTS dialogues_au;
DROP TABLE IF EXISTS dialogues_fts;

CREATE VIRTUAL TABLE dialogues_fts USING fts5(
  quote, note, character, actor, translation,
  content='dialogues', content_rowid='id',
  tokenize='unicode61 remove_diacritics 2',
  prefix='2 3'
);

CREATE TRIGGER dialogues_ai AFTER INSERT ON dialogues BEGIN
  INSERT INTO dialogues_fts(rowid, quote, note, character, actor, translation)
  VALUES (new.id, new.quote, new.note, new.character, new.actor, new.translation);
END;
CREATE TRIGGER dialogues_ad AFTER DELETE ON dialogues BEGIN
  INSERT INTO dialogues_fts(dialogues_fts, rowid, quote, note, character, actor, translation)
  VALUES ('delete', old.id, old.quote, old.note, old.character, old.actor, old.translation);
END;
CREATE TRIGGER dialogues_au AFTER UPDATE ON dialogues BEGIN
  INSERT INTO dialogues_fts(dialogues_fts, rowid, quote, note, character, actor, translation)
  VALUES ('delete', old.id, old.quote, old.note, old.character, old.actor, old.translation);
  INSERT INTO dialogues_fts(rowid, quote, note, character, actor, translation)
  VALUES (new.id, new.quote, new.note, new.character, new.actor, new.translation);
END;

INSERT INTO dialogues_fts(dialogues_fts) VALUES('rebuild');

-- ───────────────────────── the queue already holds it
--
-- staged_quotes gained `translation` in 0035 and has carried it for every row
-- since, whatever kind of work it belongs to — see the column's comment there
-- and 0034's proof of why: this app's own export is an importer's source, every
-- import is staged, and a field the queue does not hold is one that survives the
-- export, survives the parse and is dropped on the way in, with a successful
-- import and matching counts to say nothing happened. So there is nothing to add
-- to the queue here; what 0051 changes is that the two kinds it was already
-- being carried for now have somewhere to put it at approval.
