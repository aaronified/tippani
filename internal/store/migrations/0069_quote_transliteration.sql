-- 0069 — a quote can carry its own words in another script.
--
-- THE OWNER'S, with the example: `অতি সন্ন্যাসীতে গাজন নষ্ট (Ati sannyasite gajon
-- nosto)`. A proverb they keep is written in Bengali, and the thing in the
-- brackets is not a translation of it — the translation is "too many ascetics
-- ruin the festival" and it already has a column (0035, widened to all three
-- kinds in 0051). What the brackets hold is the SAME SENTENCE, letter for letter,
-- in a script the reader can pronounce from.
--
-- SO IT IS A THIRD THING AND NOT A SECOND USE OF EITHER. A note is what you
-- thought about the line; a translation is what the line says; a transliteration
-- is how the line SOUNDS. Folding it into the translation would make the field
-- mean two things at once and leave nothing downstream able to tell them apart —
-- the review deck would prompt with a romanisation where it promised a meaning,
-- and a card that draws both would print the sentence twice.
--
-- EVERY KIND, not just the standalone quote. The owner's ruling: "All quote shall
-- get one." A Bengali line highlighted in a book and a line of Hindi dialogue want
-- this exactly as much as a proverb does, and 0051 has already made the argument
-- for putting a text-about-the-text on all three tables rather than one: the field
-- belongs to the QUOTE, and which shelf the quote came off is not a fact about its
-- script. The shared quoteReq/quoteRow structs are where that argument is spent.
--
-- ZERO-VALUE DEFAULT, NOT NULL, per 0045 and 0047: an upgraded database reads
-- identically to a fresh one and no scanner needs a pointer.
--
-- UNCAPPED, like Quote, Note and Translation and unlike every locator beside
-- them. It is the same kind of content — a whole sentence — and a romanisation is
-- routinely longer than the script it romanises, because one Bengali glyph is
-- often three Latin letters.

ALTER TABLE utterances    ADD COLUMN transliteration TEXT NOT NULL DEFAULT '';
ALTER TABLE annotations   ADD COLUMN transliteration TEXT NOT NULL DEFAULT '';
ALTER TABLE dialogues     ADD COLUMN transliteration TEXT NOT NULL DEFAULT '';
ALTER TABLE staged_quotes ADD COLUMN transliteration TEXT NOT NULL DEFAULT '';

-- ───────────────────────── and it is searchable, which is the point
--
-- A TRANSLITERATION NOT IN THE INDEX IS DECORATION. The reason to write "Ati
-- sannyasite gajon nosto" down at all is to find that proverb by typing Latin
-- letters on a keyboard that cannot produce Bengali ones — so leaving it out of
-- FTS would ship the storage and withhold the feature. 0051 made the same call
-- for `translation` and paid the same cost.
--
-- THE COST IS A REBUILD OF THREE INDEXES, and it is the cost 0029 documented and
-- 0047 and 0051 both paid: fts5 external-content tables cannot gain a column, so
-- the index and its three triggers are dropped and recreated and the content is
-- re-tokenized from the tables. Nothing but the indexes is touched, and they hold
-- no data of their own.
--
-- The names have to land exactly: store.Recover() excludes '%\_fts' and
-- '%\_fts\_%' from its table copy, and rebuildFTSTable finds an index's triggers
-- with `sql LIKE '%<name>%'`. The non-FTS triggers on these tables are
-- deliberately untouched.

DROP TRIGGER IF EXISTS utterances_ai;
DROP TRIGGER IF EXISTS utterances_ad;
DROP TRIGGER IF EXISTS utterances_au;
DROP TABLE IF EXISTS utterances_fts;

CREATE VIRTUAL TABLE utterances_fts USING fts5(
  quote, note, speaker, occasion, translation, transliteration, recipient, work_title,
  content='utterances', content_rowid='id',
  tokenize='unicode61 remove_diacritics 2',
  prefix='2 3'
);

CREATE TRIGGER utterances_ai AFTER INSERT ON utterances BEGIN
  INSERT INTO utterances_fts(rowid, quote, note, speaker, occasion, translation, transliteration, recipient, work_title)
  VALUES (new.id, new.quote, new.note, new.speaker, new.occasion, new.translation, new.transliteration, new.recipient, new.work_title);
END;
CREATE TRIGGER utterances_ad AFTER DELETE ON utterances BEGIN
  INSERT INTO utterances_fts(utterances_fts, rowid, quote, note, speaker, occasion, translation, transliteration, recipient, work_title)
  VALUES ('delete', old.id, old.quote, old.note, old.speaker, old.occasion, old.translation, old.transliteration, old.recipient, old.work_title);
END;
CREATE TRIGGER utterances_au AFTER UPDATE ON utterances BEGIN
  INSERT INTO utterances_fts(utterances_fts, rowid, quote, note, speaker, occasion, translation, transliteration, recipient, work_title)
  VALUES ('delete', old.id, old.quote, old.note, old.speaker, old.occasion, old.translation, old.transliteration, old.recipient, old.work_title);
  INSERT INTO utterances_fts(rowid, quote, note, speaker, occasion, translation, transliteration, recipient, work_title)
  VALUES (new.id, new.quote, new.note, new.speaker, new.occasion, new.translation, new.transliteration, new.recipient, new.work_title);
END;

INSERT INTO utterances_fts(utterances_fts) VALUES('rebuild');

DROP TRIGGER IF EXISTS annotations_ai;
DROP TRIGGER IF EXISTS annotations_ad;
DROP TRIGGER IF EXISTS annotations_au;
DROP TABLE IF EXISTS annotations_fts;

CREATE VIRTUAL TABLE annotations_fts USING fts5(
  quote, note, character, translation, transliteration,
  content='annotations', content_rowid='id',
  tokenize='unicode61 remove_diacritics 2',
  prefix='2 3'
);

CREATE TRIGGER annotations_ai AFTER INSERT ON annotations BEGIN
  INSERT INTO annotations_fts(rowid, quote, note, character, translation, transliteration)
  VALUES (new.id, new.quote, new.note, new.character, new.translation, new.transliteration);
END;
CREATE TRIGGER annotations_ad AFTER DELETE ON annotations BEGIN
  INSERT INTO annotations_fts(annotations_fts, rowid, quote, note, character, translation, transliteration)
  VALUES ('delete', old.id, old.quote, old.note, old.character, old.translation, old.transliteration);
END;
CREATE TRIGGER annotations_au AFTER UPDATE ON annotations BEGIN
  INSERT INTO annotations_fts(annotations_fts, rowid, quote, note, character, translation, transliteration)
  VALUES ('delete', old.id, old.quote, old.note, old.character, old.translation, old.transliteration);
  INSERT INTO annotations_fts(rowid, quote, note, character, translation, transliteration)
  VALUES (new.id, new.quote, new.note, new.character, new.translation, new.transliteration);
END;

INSERT INTO annotations_fts(annotations_fts) VALUES('rebuild');

DROP TRIGGER IF EXISTS dialogues_ai;
DROP TRIGGER IF EXISTS dialogues_ad;
DROP TRIGGER IF EXISTS dialogues_au;
DROP TABLE IF EXISTS dialogues_fts;

CREATE VIRTUAL TABLE dialogues_fts USING fts5(
  quote, note, character, actor, translation, transliteration,
  content='dialogues', content_rowid='id',
  tokenize='unicode61 remove_diacritics 2',
  prefix='2 3'
);

CREATE TRIGGER dialogues_ai AFTER INSERT ON dialogues BEGIN
  INSERT INTO dialogues_fts(rowid, quote, note, character, actor, translation, transliteration)
  VALUES (new.id, new.quote, new.note, new.character, new.actor, new.translation, new.transliteration);
END;
CREATE TRIGGER dialogues_ad AFTER DELETE ON dialogues BEGIN
  INSERT INTO dialogues_fts(dialogues_fts, rowid, quote, note, character, actor, translation, transliteration)
  VALUES ('delete', old.id, old.quote, old.note, old.character, old.actor, old.translation, old.transliteration);
END;
CREATE TRIGGER dialogues_au AFTER UPDATE ON dialogues BEGIN
  INSERT INTO dialogues_fts(dialogues_fts, rowid, quote, note, character, actor, translation, transliteration)
  VALUES ('delete', old.id, old.quote, old.note, old.character, old.actor, old.translation, old.transliteration);
  INSERT INTO dialogues_fts(rowid, quote, note, character, actor, translation, transliteration)
  VALUES (new.id, new.quote, new.note, new.character, new.actor, new.translation, new.transliteration);
END;

INSERT INTO dialogues_fts(dialogues_fts) VALUES('rebuild');
