-- 0027: one row per person, not one row per person per role.
--
-- 0012 keyed people on (user_id, kind, name), which made a role part of a
-- person's identity. A novelist who also acts is two rows with two bios and two
-- portraits; renaming one leaves the other. It has been tolerable because the
-- overlap between authors, actors and directors is small.
--
-- §24 makes it untenable. A speaker is very often already an author — the whole
-- appeal of saving a line from a speech is that you have read the person too —
-- so adding `speaker` to the old key would have manufactured a duplicate for
-- exactly the people most likely to be enriched. Kinds become a set a person
-- belongs to, and identity becomes the name.
--
-- WHAT THIS REBUILD DOES NOT HAVE TO WORRY ABOUT. 0018's warning is about
-- rebuilding an FK parent whose children cascade: `tags` parents annotation_tags
-- and dialogue_tags, and a DROP-TABLE rebuild takes every join row with it.
-- NOTHING REFERENCES people(id) — verified across every migration — so there is
-- nothing of the old schema to park. This is the easy shape of the dance, and
-- saying so is worth more than a reader assuming somebody checked.
--
-- It still parks a copy, for a different reason: person_kinds is derived from
-- the OLD table's kind column, and that column has to outlive the table it sits
-- on. Parking it also lets person_kinds be created under its final name, so
-- nothing here depends on ALTER TABLE RENAME rewriting a foreign key — the
-- migration runner holds a transaction with foreign_keys(1) on and cannot
-- toggle the pragma, so the fewer FK subtleties in flight the better.

-- ------------------------------------------------------------------ merging
--
-- THE MERGE IS LOSSY AND THE RULE IS THEREFORE EXPLICIT. Where one name exists
-- under several kinds, one row survives and the others are dropped, so the
-- choice cannot be "whichever SQLite happens to return first".
--
-- Prefer the row carrying the most: a portrait first, then a bio, then the
-- oldest — a hand-entered row usually predates an enrichment fetch — and ties
-- broken by id so the result is deterministic on any SQLite build.
--
-- The surviving row KEEPS ITS ID. Nothing references people(id) today, but ids
-- appear in API responses and stability is free here.
--
-- One consequence worth stating plainly: if two merged rows each had a
-- DIFFERENT portrait, the loser's file under MediaCover is left unreferenced.
-- Nothing routinely sweeps that directory — only a full reset clears it — so it
-- leaks a few kilobytes. Preferring the row WITH an image means the ordinary
-- case, one enriched row and one bare one, loses nothing at all.
CREATE TABLE _people_backup AS SELECT * FROM people;

CREATE TABLE people_new (
  id         INTEGER PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,               -- matches books.author / dialogues.actor / movies.director / utterances.speaker verbatim
  bio        TEXT NOT NULL DEFAULT '',
  image_path TEXT NOT NULL DEFAULT '',    -- filename under MediaCover/
  born       TEXT NOT NULL DEFAULT '',
  died       TEXT NOT NULL DEFAULT '',
  links      TEXT NOT NULL DEFAULT '',
  source     TEXT NOT NULL DEFAULT '',    -- openlibrary|amazon|tmdb|tvdb|wikidata|manual
  source_id  TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  -- Scoped by user, so two accounts each keep their own Bose — the same reason
  -- 0026 scopes its dedupe hash by user rather than globally.
  UNIQUE (user_id, name)
);

INSERT INTO people_new (id, user_id, name, bio, image_path, born, died, links, source, source_id, created_at)
SELECT id, user_id, name, bio, image_path, born, died, links, source, source_id, created_at
FROM (
  SELECT *, ROW_NUMBER() OVER (
    PARTITION BY user_id, name
    ORDER BY (image_path <> '') DESC, (bio <> '') DESC, created_at ASC, id ASC
  ) AS rn
  FROM people
)
WHERE rn = 1;

DROP TABLE people;
ALTER TABLE people_new RENAME TO people;

-- ------------------------------------------------------------------- kinds
--
-- NO CHECK ON kind, deliberately, and 0012 made the same call. A CHECK would be
-- evaluated against whatever is already in the column, so one unexpected value
-- in one existing database turns this migration into a failure — and a failed
-- migration means Migrate() returns an error and THE APP DOES NOT START. A
-- constraint that can stop startup in order to reject a value the API already
-- refuses to write is a bad trade. validPersonKind gates every write.
CREATE TABLE person_kinds (
  person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  kind      TEXT NOT NULL,               -- author | actor | director | speaker
  PRIMARY KEY (person_id, kind)
);

-- DISTINCT because the join collapses several old rows onto one survivor, and
-- two of them can carry the same kind.
INSERT INTO person_kinds (person_id, kind)
SELECT DISTINCT p.id, b.kind
FROM _people_backup b
JOIN people p ON p.user_id = b.user_id AND p.name = b.name;

DROP TABLE _people_backup;

-- idx_people_user_kind went with the column it indexed. UNIQUE(user_id, name)
-- already covers lookup by name; this covers "everyone of kind X", which the
-- People console asks for on every load.
CREATE INDEX idx_person_kinds_kind ON person_kinds(kind);
