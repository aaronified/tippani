-- 0070 — who transmitted the words, and where a line stops.
--
-- TWO FIELDS THE ADD SURFACE ASKED FOR, and neither had anywhere to go.
--
-- ───────────────────────── utterances.source_author
--
-- THE OWNER'S, with the case that settles it: "letter/speech needs a source
-- article, and also a source author/editor. e.g. socrates' speeches are known
-- from plato's paraphrasing."
--
-- The source ARTICLE already has a column — 0047's `work_title` — and a letter
-- and a speech simply get it back on their forms. The person who WROTE that
-- article has nowhere at all, and it is not any of the four names already on the
-- row:
--
--   speaker   — who said it. Socrates.
--   recipient — who it was said TO. 0047, and it is a letter's whole point.
--   author    — not on this table. A `books` row has one; an utterance has no
--               work to hang it off, which is why work_title is free text.
--   character — the annotations/dialogues column, a person inside a work.
--
-- So a fifth relation: who the words reach us THROUGH. Plato is not the speaker
-- of the Apology and not its recipient; he is the reason there is a text. A
-- reader who cannot record him has to put "as paraphrased by Plato" in the note,
-- where nothing can group by it, cite it, or find it.
--
-- ONLY ON `utterances`. A book highlight's source is the book — the row already
-- points at it by id, and a second, typed answer beside a real foreign key is how
-- the two come to disagree. A dialogue's source is the film. This is the one kind
-- of quote with no work behind it, which is exactly why 0047 gave THIS table the
-- four free-text locators and not the other two.
--
-- ZERO-VALUE DEFAULT, NOT NULL — 0045, 0047 and 0069's rule: an upgraded database
-- reads identically to a fresh one and no scanner needs a pointer.
--
-- CAPPED NOWHERE, like the names beside it. `speaker` and `recipient` take
-- whatever a person is called, and an editor line is legitimately two names and
-- an ampersand.

ALTER TABLE utterances    ADD COLUMN source_author TEXT NOT NULL DEFAULT '';
ALTER TABLE staged_quotes ADD COLUMN source_author TEXT NOT NULL DEFAULT '';

-- ───────────────────────── dialogues.timestamp_end
--
-- THE OWNER'S, in three words: "Film timestamp: start and end". A line of film
-- dialogue occupies a stretch of the runtime, not an instant, and the existing
-- `timestamp` column has only ever held where it begins.
--
-- A SECOND COLUMN, NOT A RANGE INSIDE THE FIRST. "01:12:40–01:13:02" in one TEXT
-- field would be one string the app has to re-split at every read, and every
-- consumer of `timestamp` would have to learn the new spelling on the same day:
-- the sort, the card's meta line, the IMDb import, the dedupe hash and the
-- Markdown export all read it as it stands. A start that keeps meaning exactly
-- what it meant is a change nothing downstream has to notice.
--
-- NOT IN THE SEARCH INDEX, and neither is `timestamp` — no locator is. You do
-- not find a line by typing the minute it lands on; `dialogues_fts` holds the
-- quote, the note, the character, the actor, the translation and the
-- transliteration, which are the things a reader has words for. This is why this
-- half of the migration costs no rebuild while 0069 cost three.
--
-- A GAME'S LINE STILL HAS NEITHER. normalizeLocator drops a timestamp on a game
-- (0047) and drops the end with it, for the same reason: an act and a quest are
-- how a bark is placed, and a runtime a game does not have cannot be indexed into.

ALTER TABLE dialogues     ADD COLUMN timestamp_end TEXT NOT NULL DEFAULT '';
-- AND ON THE STAGING TABLE, because the export writes it. A field the app can
-- write out and cannot read back in is data loss on the app's own round-trip:
-- export a film, re-import the file, and the ends are gone with no error. No
-- outside source supplies one (IMDb carries no timestamp at all), so this column
-- exists for our own Markdown and for the bulk editor that fills a batch of
-- staged rows before approval.
ALTER TABLE staged_quotes ADD COLUMN timestamp_end TEXT NOT NULL DEFAULT '';

-- ───────────────────────── and the source author is searchable
--
-- BECAUSE THE NAME IS THE WAY IN. The reason to record Plato is to be able to
-- find the Socrates lines by typing Plato — the same argument `speaker` and
-- `recipient` already won, and 0069 spelled out for `transliteration`. A name
-- stored outside the index is a name you can only reach by remembering which
-- quote it sits on, which is the thing you were trying to look up.
--
-- THE COST IS ONE REBUILD, of `utterances_fts` alone: fts5 external-content
-- tables cannot gain a column, so the index and its three triggers are dropped
-- and recreated and the content re-tokenized. Precedents: 0029, 0047, 0051, 0069.
--
-- The names have to land exactly — store.Recover() excludes '%\_fts' and
-- '%\_fts\_%' from its table copy, and rebuildFTSTable finds an index's triggers
-- with `sql LIKE '%<name>%'`. The non-FTS triggers on this table are untouched.

DROP TRIGGER IF EXISTS utterances_ai;
DROP TRIGGER IF EXISTS utterances_ad;
DROP TRIGGER IF EXISTS utterances_au;
DROP TABLE IF EXISTS utterances_fts;

CREATE VIRTUAL TABLE utterances_fts USING fts5(
  quote, note, speaker, occasion, translation, transliteration, recipient, work_title, source_author,
  content='utterances', content_rowid='id',
  tokenize='unicode61 remove_diacritics 2',
  prefix='2 3'
);

CREATE TRIGGER utterances_ai AFTER INSERT ON utterances BEGIN
  INSERT INTO utterances_fts(rowid, quote, note, speaker, occasion, translation, transliteration, recipient, work_title, source_author)
  VALUES (new.id, new.quote, new.note, new.speaker, new.occasion, new.translation, new.transliteration, new.recipient, new.work_title, new.source_author);
END;
CREATE TRIGGER utterances_ad AFTER DELETE ON utterances BEGIN
  INSERT INTO utterances_fts(utterances_fts, rowid, quote, note, speaker, occasion, translation, transliteration, recipient, work_title, source_author)
  VALUES ('delete', old.id, old.quote, old.note, old.speaker, old.occasion, old.translation, old.transliteration, old.recipient, old.work_title, old.source_author);
END;
CREATE TRIGGER utterances_au AFTER UPDATE ON utterances BEGIN
  INSERT INTO utterances_fts(utterances_fts, rowid, quote, note, speaker, occasion, translation, transliteration, recipient, work_title, source_author)
  VALUES ('delete', old.id, old.quote, old.note, old.speaker, old.occasion, old.translation, old.transliteration, old.recipient, old.work_title, old.source_author);
  INSERT INTO utterances_fts(rowid, quote, note, speaker, occasion, translation, transliteration, recipient, work_title, source_author)
  VALUES (new.id, new.quote, new.note, new.speaker, new.occasion, new.translation, new.transliteration, new.recipient, new.work_title, new.source_author);
END;

INSERT INTO utterances_fts(utterances_fts) VALUES('rebuild');
