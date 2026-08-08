-- 0026: quotes that belong to no book and no film (ROADMAP §24).
--
-- Every quote so far hangs off a parent: an annotation off a book, a dialogue
-- off a film or show. This adds the third kind — a line from a speech, a letter,
-- an interview, a song, a proverb, something a friend said. The roadmap's
-- example is "Give me blood, and I will give you freedom" (Bose, 1944, Burma,
-- most likely over Burma Radio), and there is nowhere to put it today.
--
-- WHY A THIRD TABLE rather than a nullable book_id on annotations. The nullable
-- model is genuinely cheaper — every existing query joins books to scope by
-- user, so parentless rows would be excluded automatically and every one of
-- those ~40 sites would keep working untouched. It was rejected because it makes
-- `annotations` mean two different things, shares one id space between them, and
-- freezes the busiest table in the schema behind a CHECK that a future change
-- can only alter with another full rebuild. The cost of this choice is that
-- ownership is now explicit rather than inherited — see below, it is the single
-- largest source of risk in the feature.
--
-- ON THE NAME. The UI says "Quotes". The table says `utterances` because
-- `quote` is already taken: quoteReq / quoteRow are the SHARED shape of all
-- three kinds, and a `quotes` table would read as the parent of the other two
-- rather than a sibling. `annotations` and `dialogues` are likewise not the
-- words the UI uses; internal tables name the row, the interface names the idea.

-- ---------------------------------------------------------------- the table
--
-- user_id IS THE OWNERSHIP PATH, AND IT IS LOAD-BEARING.
-- annotations and dialogues carry no user_id: `JOIN books b ON b.id = a.book_id
-- WHERE b.user_id = ?` is simultaneously the parent join and the access check,
-- so forgetting the scope is impossible — there is nothing to select from
-- without it. An utterance has no parent, so that safety net does not exist.
-- Every single query against this table must carry `WHERE user_id = ?` of its
-- own, and a missed one is a cross-account leak rather than a hidden row. This
-- repo treats per-user isolation as a security property (a foreign row answers
-- 404, never 403), so the tests carry an ownership case per endpoint.
--
-- quote is NOT NULL here, unlike annotations, where the CHECK is (quote IS NOT
-- NULL OR note IS NOT NULL) because a book highlight may be a bare note about a
-- page. An utterance with no words is not a quote by anything it could mean.
--
-- THE OCCASION IS THE LOCATOR, and unlike every other locator in this schema it
-- DISCRIMINATES — see the dedupe note below.
--
-- occasion_date is a PARTIAL date, following work_reads (0024) exactly: TEXT in
-- one of YYYY / YYYY-MM / YYYY-MM-DD, compared as TEXT, because the three shapes
-- sort correctly against each other lexically. It is deliberately NOT the
-- datetime column noted_at uses: 1944 is usually the honest answer, and padding
-- it to a January morning invents a precision nobody has. Empty string, not
-- NULL, so the lexical comparisons never meet a NULL.
CREATE TABLE utterances (
  id         INTEGER PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quote      TEXT NOT NULL,
  note       TEXT,
  color      TEXT NOT NULL DEFAULT 'yellow'
    CHECK (color IN ('yellow','blue','pink','orange')),
  favorite   INTEGER NOT NULL DEFAULT 0,

  -- The occasion. speaker matches people.name verbatim, the way books.author
  -- and dialogues.actor do — free text, enriched by a people row when one
  -- exists, never a foreign key.
  speaker       TEXT NOT NULL DEFAULT '',
  occasion      TEXT NOT NULL DEFAULT '',  -- a rally, a broadcast, a letter, a recording
  occasion_date TEXT NOT NULL DEFAULT '',  -- partial: YYYY | YYYY-MM | YYYY-MM-DD
  place         TEXT NOT NULL DEFAULT '',
  medium        TEXT NOT NULL DEFAULT '',  -- radio, speech, letter, interview, song

  source      TEXT NOT NULL DEFAULT 'manual',
  dedupe_hash TEXT NOT NULL,
  noted_at    TEXT,                        -- when YOU saved it (not when it was said)
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  sticker_x   REAL,
  sticker_y   REAL,
  sticker_id  INTEGER REFERENCES stickers(id) ON DELETE SET NULL,

  -- THE DEDUPE RULE INVERTS FOR THIS KIND, and the inversion is the point.
  --
  -- store.DedupeHash deliberately EXCLUDES the locator, "so the same passage
  -- recorded twice with different page numbers collapses to one row". §24 needs
  -- the opposite: "the occasion is a locator, and it discriminates. The same
  -- words said on two occasions are two quotes, the way the same line in two
  -- episodes is two quotes." So the hash folds the occasion in — the same
  -- problem DialogueDedupeHash already solved for episodes, whose comment
  -- records what the old behaviour cost: a recurring catchphrase hit the UNIQUE
  -- and "was silently folded into it, or worse, relabelled it with the newer
  -- episode via the importer's COALESCE enrichment".
  --
  -- Scoped by user_id, not global: two accounts must each be able to keep the
  -- same famous line. That is the same reason it cannot be UNIQUE(dedupe_hash).
  UNIQUE (user_id, dedupe_hash)
);

-- Owner-scoped listing is the common read, and speaker is the common facet.
CREATE INDEX idx_utterances_user    ON utterances(user_id);
CREATE INDEX idx_utterances_speaker ON utterances(user_id, speaker);

-- ------------------------------------------------------------------- tags
-- setTags interpolates <kind>_tags and <kind>_id, so the column name is fixed
-- by the helper rather than chosen here.
CREATE TABLE utterance_tags (
  utterance_id INTEGER NOT NULL REFERENCES utterances(id) ON DELETE CASCADE,
  tag_id       INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (utterance_id, tag_id)
);

-- NOTE FOR THE NEXT PERSON WHO REBUILDS `tags`: it is now the FK parent of
-- THREE join tables, not two. 0018's header warns that a DROP-TABLE rebuild of
-- tags silently takes every join row with it unless the migration parks and
-- restores them, and both that warning and the schema test that pins it were
-- written when there were two. This is the third.

-- -------------------------------------------------------------------- FTS
-- External-content index over the searchable text, mirroring annotations_fts.
-- speaker and occasion are indexed alongside quote and note, because unlike a
-- book's author and title they are ON the row rather than on a parent that
-- search already joins — leave them out and the two most natural ways to look
-- for one of these ("who said the thing about freedom", "that Burma
-- broadcast") both find nothing. The occasion is also the title the review deck
-- shows, and a title you cannot search for is the gap this whole feature would
-- be judged on.
--
-- place and medium stay out. They are filter values, like a genre, not prose:
-- indexing them would let a search for "radio" return every quote ever
-- broadcast, ranked above the one that is actually about radios.
--
-- THE NAME IS CONSTRAINED, in two directions, and both are silent if broken:
--   * store.Recover() copies base tables with `INSERT INTO main.t SELECT * FROM
--     old.t` while the sync triggers are live, excluding anything matching
--     '%\_fts' or '%\_fts\_%'. A name outside that pattern gets copied into a
--     live FTS index and reports as "database disk image is malformed" on the
--     next insert.
--   * rebuildFTSTable finds an index's triggers with `sql LIKE '%<name>%'`, so
--     an FTS name that CONTAINS or IS CONTAINED BY another one cross-wires two
--     repairs. `utterances_fts` is neither a substring of nor a superstring of
--     books_fts, annotations_fts, movies_fts or dialogues_fts.
CREATE VIRTUAL TABLE utterances_fts USING fts5(
  quote, note, speaker, occasion,
  content='utterances', content_rowid='id',
  tokenize='unicode61 remove_diacritics 2',
  prefix='2 3'
);

CREATE TRIGGER utterances_ai AFTER INSERT ON utterances BEGIN
  INSERT INTO utterances_fts(rowid, quote, note, speaker, occasion)
  VALUES (new.id, new.quote, new.note, new.speaker, new.occasion);
END;
CREATE TRIGGER utterances_ad AFTER DELETE ON utterances BEGIN
  INSERT INTO utterances_fts(utterances_fts, rowid, quote, note, speaker, occasion)
  VALUES ('delete', old.id, old.quote, old.note, old.speaker, old.occasion);
END;
CREATE TRIGGER utterances_au AFTER UPDATE ON utterances BEGIN
  INSERT INTO utterances_fts(utterances_fts, rowid, quote, note, speaker, occasion)
  VALUES ('delete', old.id, old.quote, old.note, old.speaker, old.occasion);
  INSERT INTO utterances_fts(rowid, quote, note, speaker, occasion)
  VALUES (new.id, new.quote, new.note, new.speaker, new.occasion);
END;

-- NO CONVENIENCE TRIGGER ON THIS TABLE. 0022's header records why: an AFTER
-- INSERT trigger that turns around and UPDATEs the row it fired on drives the
-- FTS triggers out of step, and SQLite reports it as "database disk image is
-- malformed" on the very next insert. updated_at is stamped by the handlers.

CREATE VIRTUAL TABLE utterances_fts_vocab USING fts5vocab('utterances_fts', 'row');

-- --------------------------------------------------------- review schedule
-- item_reviews is polymorphic — (kind, item_id) with no foreign key, because a
-- table cannot hold a real FK to two parents. 0015 replaced ON DELETE CASCADE
-- with one AFTER DELETE trigger per parent, and 0018 had to hand-recreate both
-- after its rebuilds.
--
-- The third kind needs the third trigger, and its absence would not be
-- cosmetic. id is a plain INTEGER PRIMARY KEY, so SQLite REUSES a rowid once the
-- highest row is deleted: an orphaned schedule row left behind by a deleted
-- utterance would be silently adopted by the next one created, which would
-- arrive carrying a stranger's stability, review count and lapse history.
CREATE TRIGGER item_reviews_utterance_del AFTER DELETE ON utterances BEGIN
  DELETE FROM item_reviews WHERE kind = 'utterance' AND item_id = OLD.id;
END;
