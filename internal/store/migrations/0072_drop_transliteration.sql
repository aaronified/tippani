-- 0072 — the transliteration column goes, three releases after it arrived.
--
-- THE OWNER'S REVERSAL, and it is theirs both ways round. 0069 was written to
-- this instruction: "All quote shall get one, but will only be shown for scripts
-- that are not the same as the chosen language. User may want to store bengali
-- transliteration everywhere." Today: "translit. we will drop everywhere ... it
-- can be in notes if user wants it," and then, on the column specifically: "drop
-- it. it doesnt have any data anywhere now. no need to keep the data either."
--
-- WHY THE COLUMN AND NOT JUST THE BOX. A field with no way to fill it is worse
-- than no field: it goes on being exported, imported, staged, bulk-edited and
-- indexed, and the next person to read the schema has to work out from the
-- absence of a form whether the app forgot to draw one. 0069 spent an FTS rebuild
-- on three tables to make this searchable; leaving that index in place to tokenize
-- a column nothing can write is paying the cost with the feature removed.
--
-- FORWARD-ONLY, NOT AN EDIT. 0069 stays exactly as it was written — shipped
-- migrations are never touched — so this pair adds and removes across two files,
-- which is how the schema records that a decision was made and then unmade. The
-- owner's own plan for the pile: "after we release v3, we will drop all migrations
-- after a month or so, to keep the file lean." That is the moment the pair
-- collapses; until then it is history and history is allowed to have a reversal in
-- it.
--
-- ORDER MATTERS AND SQLITE WILL SAY SO. `ALTER TABLE ... DROP COLUMN` refuses a
-- column named by a trigger, and the three FTS triggers name this one on every
-- INSERT, DELETE and UPDATE. So the indexes and their triggers come down FIRST,
-- then the columns go, then the indexes are rebuilt without it. Doing it the
-- obvious way round fails on the first ALTER with an error about a trigger, which
-- reads like a corrupted database and is a statement in the wrong place.

DROP TRIGGER IF EXISTS utterances_ai;
DROP TRIGGER IF EXISTS utterances_ad;
DROP TRIGGER IF EXISTS utterances_au;
DROP TABLE IF EXISTS utterances_fts;

DROP TRIGGER IF EXISTS annotations_ai;
DROP TRIGGER IF EXISTS annotations_ad;
DROP TRIGGER IF EXISTS annotations_au;
DROP TABLE IF EXISTS annotations_fts;

DROP TRIGGER IF EXISTS dialogues_ai;
DROP TRIGGER IF EXISTS dialogues_ad;
DROP TRIGGER IF EXISTS dialogues_au;
DROP TABLE IF EXISTS dialogues_fts;

ALTER TABLE utterances    DROP COLUMN transliteration;
ALTER TABLE annotations   DROP COLUMN transliteration;
ALTER TABLE dialogues     DROP COLUMN transliteration;
ALTER TABLE staged_quotes DROP COLUMN transliteration;

-- ───────────────────────── and the three indexes, back to their 0051 shape
--
-- Byte for byte what 0051 and 0047 left behind, plus 0070's `source_author` on the
-- utterances side — which stays, because that one is a name a reader searches for
-- and the argument for indexing it is untouched by this.
--
-- The names have to land exactly: store.Recover() excludes '%\_fts' and
-- '%\_fts\_%' from its table copy, and rebuildFTSTable finds an index's triggers
-- with `sql LIKE '%<name>%'`. The non-FTS triggers on these tables are untouched.

CREATE VIRTUAL TABLE utterances_fts USING fts5(
  quote, note, speaker, occasion, translation, recipient, work_title, source_author,
  content='utterances', content_rowid='id',
  tokenize='unicode61 remove_diacritics 2',
  prefix='2 3'
);

CREATE TRIGGER utterances_ai AFTER INSERT ON utterances BEGIN
  INSERT INTO utterances_fts(rowid, quote, note, speaker, occasion, translation, recipient, work_title, source_author)
  VALUES (new.id, new.quote, new.note, new.speaker, new.occasion, new.translation, new.recipient, new.work_title, new.source_author);
END;
CREATE TRIGGER utterances_ad AFTER DELETE ON utterances BEGIN
  INSERT INTO utterances_fts(utterances_fts, rowid, quote, note, speaker, occasion, translation, recipient, work_title, source_author)
  VALUES ('delete', old.id, old.quote, old.note, old.speaker, old.occasion, old.translation, old.recipient, old.work_title, old.source_author);
END;
CREATE TRIGGER utterances_au AFTER UPDATE ON utterances BEGIN
  INSERT INTO utterances_fts(utterances_fts, rowid, quote, note, speaker, occasion, translation, recipient, work_title, source_author)
  VALUES ('delete', old.id, old.quote, old.note, old.speaker, old.occasion, old.translation, old.recipient, old.work_title, old.source_author);
  INSERT INTO utterances_fts(rowid, quote, note, speaker, occasion, translation, recipient, work_title, source_author)
  VALUES (new.id, new.quote, new.note, new.speaker, new.occasion, new.translation, new.recipient, new.work_title, new.source_author);
END;

INSERT INTO utterances_fts(utterances_fts) VALUES('rebuild');

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
