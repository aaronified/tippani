-- 0056: a person is an id, a character is a record, and a credit is a row.
--
-- THE NAME WAS THE KEY, AND THAT IS THE WHOLE PROBLEM. 0027 collapsed people to
-- one row per name and called identity solved; `UNIQUE (user_id, name)` is that
-- decision written down. Every credit in the app is a string that happens to
-- match it — books.author, books.translator, books.editor, movies.director,
-- dialogues.actor, utterances.speaker, work_cast.actor — so a person IS their
-- printed name and nothing else.
--
-- Bulgakov is the ordinary case rather than an edge one. Penguin prints "Mikhail
-- Bulgakov", Vintage prints "M. Bulgakov", Азбука prints "Михаил Булгаков", a
-- Bengali edition prints "মিখাইল বুলগাকভ". Four strings, one human being, twelve
-- works, and today four separate people each holding a quarter of the quotes —
-- with "Works: 6" on every one of them being a lie by construction. There is no
-- amount of care at the call sites that fixes that, because the model has
-- nowhere to put the fact that the four are one.
--
-- So: identity moves to an id, the printed name becomes a property of the CREDIT
-- rather than of the person, and the spellings that should FIND somebody become
-- a list.
--
-- ---------------------------------------------------------------- the cache
--
-- THE FOUR CREDIT COLUMNS STAY, AND THEY ARE NOW DERIVED. This is the decision a
-- reader of this file will most want argued, because a derived column is a
-- second copy of a fact and this schema is otherwise careful not to keep one.
--
-- books_fts and movies_fts are EXTERNAL-CONTENT FTS5 tables: `content='books'`,
-- `content_rowid='id'`, three triggers keeping them in step. They store no copy
-- of the text — they point back at the content row — and FTS5 external-content
-- cannot index a joined table. There is no form of CREATE VIRTUAL TABLE that
-- reaches into work_person and pulls the names in.
--
-- So dropping books.author does not remove the write-through problem, it MOVES
-- it: books_fts would have to become contentless and be populated by hand on
-- every credit change, which is the same discipline in a harder place — and it
-- costs `INSERT INTO books_fts(books_fts) VALUES('rebuild')`, the one-line
-- repair that today re-derives the whole index from the content rows. A search
-- index that can silently disagree with the library and has nothing to recompute
-- it from is a worse bug than a derived column with a test on it.
--
-- The column is therefore recomposed from work_person inside the same
-- transaction as any credit change, by ONE store function, and a test walks
-- every work asserting the two agree. `credit_as` where set, else the person's
-- name, joined in `ordering` with ", " — which is what is printed on the work,
-- so search finds a book by the spelling on its own cover and export writes the
-- name the book carries.
--
-- ------------------------------------------------------- characters, apart
--
-- A CHARACTER IS NOT A PERSON WITH A FLAG. person-instructions proposes one
-- table with a `kind`; this is two, and the reason is that they answer different
-- questions and the app asks both at once. A person has a birth and a death and
-- a photograph; a character has a description and an appearance that changes per
-- work. A picker for "who wrote this" must never offer Woland, and a picker for
-- "who says this line" must never offer Bulgakov.
--
-- The cost is real and is paid deliberately: aliases, merge and links exist
-- twice. They are built ONCE in Go over two tables rather than written twice —
-- see people.go — because the second copy is the entire risk of this decision.
--
-- HARRY POTTER IS THE CASE THAT SHAPES work_cast. Same character, same actor,
-- across eight films, and a different photograph in each. So the character's
-- IDENTITY is library-wide and its APPEARANCE is per work: character_id and
-- actor_id point out of the row, while the image and the description stay in
-- it, falling back to the character's own when the row has none.
--
-- AND A CHARACTER IS NOT BOUND TO AN ACTOR. work_cast.actor_id is nullable and
-- is null for every book: a novel has characters and no performers, and a slot
-- invites a value where there is nothing true to put.

-- --------------------------------------------------------------- people
--
-- The rebuild exists only to drop UNIQUE (user_id, name). Two people genuinely
-- share a name — it is the commonest reason a library has a wrong merge in it —
-- and a uniqueness constraint on a DISPLAY string is the same mistake this
-- migration is undoing, one level down.
--
-- 0018's warning about rebuilding an FK parent applies here and is handled:
-- person_kinds references people(id) ON DELETE CASCADE, so the parent is parked
-- and restored rather than dropped out from under it.

CREATE TABLE people_new (
  id         INTEGER PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,               -- canonical; what the app calls them when nothing else applies
  -- HOW THEY FILE, AND IT IS A FIELD BECAUSE IT IS A JUDGEMENT. Never derived by
  -- splitting on the last space: that breaks on mononyms, on Spanish double
  -- surnames, and on every name where the family name comes first.
  sort_name  TEXT NOT NULL DEFAULT '',
  bio        TEXT NOT NULL DEFAULT '',
  image_path TEXT NOT NULL DEFAULT '',
  born       TEXT NOT NULL DEFAULT '',
  died       TEXT NOT NULL DEFAULT '',
  links      TEXT NOT NULL DEFAULT '',
  note       TEXT NOT NULL DEFAULT '',    -- the reader's own, private, never printed on a credit
  source     TEXT NOT NULL DEFAULT '',
  source_id  TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO people_new (id, user_id, name, bio, image_path, born, died, links, source, source_id, created_at)
SELECT id, user_id, name, bio, image_path, born, died, links, source, source_id, created_at FROM people;

-- Parked, not dropped: person_kinds cascades from people(id).
CREATE TABLE _person_kinds_backup AS SELECT * FROM person_kinds;
DROP TABLE person_kinds;
DROP TABLE people;
ALTER TABLE people_new RENAME TO people;

CREATE TABLE person_kinds (
  person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  kind      TEXT NOT NULL,               -- author | actor | director | speaker
  PRIMARY KEY (person_id, kind)
);
INSERT INTO person_kinds (person_id, kind) SELECT person_id, kind FROM _person_kinds_backup;
DROP TABLE _person_kinds_backup;
CREATE INDEX idx_person_kinds_kind ON person_kinds(kind);

-- Lookup by name is no longer unique, so it needs an index of its own — and it
-- is the hot path: every credit written re-resolves its components to people.
CREATE INDEX idx_people_user_name ON people(user_id, name);

-- --------------------------------------------------------------- characters

CREATE TABLE characters (
  id          INTEGER PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  sort_name   TEXT NOT NULL DEFAULT '',  -- "Woland" sorts as Woland, not "Woland, "
  description TEXT NOT NULL DEFAULT '',  -- the fallback a work_cast row with none uses
  image_path  TEXT NOT NULL DEFAULT '',
  image_url   TEXT NOT NULL DEFAULT '',
  note        TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_characters_user_name ON characters(user_id, name);

-- ---------------------------------------------------------------- aliases
--
-- EVERY OTHER SPELLING THAT SHOULD FIND THIS RECORD. Populated by merges (the
-- loser's name becomes an alias of the winner) and by hand. Search matches any
-- alias; display never uses one.
--
-- It is also what makes the derived column safe across a merge. A credit string
-- resolves to a person by name OR alias, so folding "M. Bulgakov" into "Mikhail
-- Bulgakov" leaves every work that prints the short form still resolving to the
-- one record — instead of manufacturing the duplicate again on the next write.
--
-- alias_key is the folded form (store.CastKey), computed in Go: SQLite's lower()
-- knows only ASCII, so any fold richer than that can only be agreed on in Go —
-- the same argument 0048 makes for character_key.
--
-- UNIQUE on the key per user, so two records cannot claim one spelling.

CREATE TABLE person_alias (
  user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  alias     TEXT NOT NULL,
  alias_key TEXT NOT NULL,
  PRIMARY KEY (user_id, alias_key)
) WITHOUT ROWID;
CREATE INDEX idx_person_alias_person ON person_alias(person_id);

CREATE TABLE character_alias (
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  alias        TEXT NOT NULL,
  alias_key    TEXT NOT NULL,
  PRIMARY KEY (user_id, alias_key)
) WITHOUT ROWID;
CREATE INDEX idx_character_alias_character ON character_alias(character_id);

-- ----------------------------------------------------------- the credit row
--
-- ONE PERSON, MANY CREDITS. How somebody is credited is a property of the WORK,
-- not of the person, which is what credit_as holds — nullable, and when it is
-- empty the work prints the person's name. This is the field that lets one
-- record wear four jackets.
--
-- `ordering` is the position within a role, so "Pevear and Volokhonsky" comes
-- back in the order the book prints it rather than in whatever order SQLite
-- returns. It is also what the recomposed column joins by.
--
-- kind + work_id rather than two tables, for the reason 0048 and 0054 both give:
-- books and films ask this question identically.

CREATE TABLE work_person (
  user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind      TEXT    NOT NULL,             -- 'book' | 'movie'
  work_id   INTEGER NOT NULL,
  person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  role      TEXT    NOT NULL,             -- author | translator | editor | director
  credit_as TEXT    NOT NULL DEFAULT '',  -- '' = print the person's own name
  ordering  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, kind, work_id, role, ordering)
) WITHOUT ROWID;
-- "every work this person is credited on", which the person panel asks for on
-- every open and the primary key's prefix cannot serve.
CREATE INDEX idx_work_person_person ON work_person(user_id, person_id);

-- ------------------------------------------------------------- work_cast
--
-- The strings stay beside the ids for the same reason the credit columns do:
-- character and actor are read by the dialogue autofill, the speaker remap, the
-- cast merge and every provider seed, and 0048's own keys are computed from
-- them. They become the printed form of the row; the ids are its identity.
--
-- actor_id is NULLABLE and is null on every book.
--
-- IT IS NOT CALLED person_id, AND THE COLLISION IS WORTH STATING. 0048 already
-- spent that name on the PROVIDER's id for the performer — "id within source", a
-- TEXT column carrying TMDB's or TheTVDB's number. Two columns called person_id
-- meaning two different id spaces on one row is how a join silently goes to the
-- wrong table, so ours takes the name that says what it points at.

ALTER TABLE work_cast ADD COLUMN character_id INTEGER REFERENCES characters(id) ON DELETE SET NULL;
ALTER TABLE work_cast ADD COLUMN actor_id     INTEGER REFERENCES people(id) ON DELETE SET NULL;
ALTER TABLE work_cast ADD COLUMN description  TEXT NOT NULL DEFAULT '';

CREATE INDEX idx_work_cast_character_id ON work_cast(user_id, character_id);
CREATE INDEX idx_work_cast_actor_id     ON work_cast(user_id, actor_id);

-- ---------------------------------------------------------------- speaker
--
-- A QUOTE'S SPEAKER POINTS AT THE CAST ROW, not at the character. One reference
-- then yields all three things the card has to draw — the character's name, the
-- performer, and THIS work's photograph of them — in a single join, and a quote
-- can never name somebody who is not in this work's cast.
--
-- Harry in Philosopher's Stone and Harry in Deathly Hallows are two cast rows
-- pointing at one character, and a line from each correctly shows a different
-- face. Pointing at the character instead would need a second lookup per card
-- and would break on a work that casts the same character twice, which is what
-- child-and-adult casting is.
--
-- Books get this too: 1.6 gives a novel characters, so an annotation needs the
-- same column a dialogue does.
ALTER TABLE annotations ADD COLUMN speaker_cast_id INTEGER REFERENCES work_cast(id) ON DELETE SET NULL;
ALTER TABLE dialogues   ADD COLUMN speaker_cast_id INTEGER REFERENCES work_cast(id) ON DELETE SET NULL;
CREATE INDEX idx_annotations_speaker ON annotations(speaker_cast_id);
CREATE INDEX idx_dialogues_speaker   ON dialogues(speaker_cast_id);
