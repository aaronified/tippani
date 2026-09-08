-- 0067 — a sixth quote kind: poem.
--
-- THE OWNER'S, IN ONE LINE: "we need a poem kind as well." A poem is not an
-- essay and not an 'other': it has a title, it is often in another language, and
-- its line breaks ARE the text — which is the shape of every other thing this
-- release is doing to the translation and the quote body.
--
-- ---------------------------------------------------------------------------
--
-- WHY THIS IS A MIGRATION AT ALL. 0053 put the vocabulary in a column CHECK, and
-- utterance_handlers.go says so in as many words: "WIDENING IT IS A MIGRATION,
-- not an edit here — the CHECK is on the column. That is the cost of a fixed
-- vocabulary, and it is worth paying." It is still worth paying: `medium` was
-- free text and the Quotes board GROUPS on the kind, so a typed field produced
-- one shelf per spelling with nothing in the interface able to say that "Speech"
-- and "speech" were the same kind of thing.
--
-- AND WHY IT IS SIX STATEMENTS RATHER THAN A TABLE REBUILD. 0029 widened the
-- colour CHECK by rebuilding `utterances` — a hundred and fifty lines that had to
-- reproduce every column, index and trigger, and would silently lose whichever one
-- somebody forgot. `utterances` has gained fourteen columns since then (0033,
-- 0035, 0036, 0047, 0053, 0059), three FTS triggers, two schedule triggers and six
-- indexes, so the rebuild has grown from risky to a bad idea: the failure mode is
-- somebody's library, and it is silent.
--
-- SQLite has since learned DROP COLUMN (3.35) and RENAME COLUMN (3.25), and a
-- rename REWRITES the column's own CHECK expression along with it. So the widening
-- is: park the value in a new column that carries the wider constraint, drop the
-- old one, rename. Nothing else in the schema is touched, and nothing can be
-- forgotten because nothing is retyped.
--
-- Verified against this build (modernc.org/sqlite) before it was written, because
-- "the rename rewrites the CHECK" is exactly the kind of assumption that is true
-- of the documentation and not of the driver: the value survives, `poem` is
-- accepted, and a value outside the list is still refused.
--
-- THE INDEX HAS TO GO FIRST. DROP COLUMN refuses a column an index refers to, and
-- idx_utterances_kind (0053) is the only thing in the schema that refers to this
-- one — no trigger does, because the FTS triggers carry quote, note, speaker and
-- occasion and the kind is a filter value rather than prose (0053's own rule).
DROP INDEX idx_utterances_kind;

ALTER TABLE utterances ADD COLUMN kind_wide TEXT NOT NULL DEFAULT ''
  CHECK (kind_wide IN ('', 'speech', 'letter', 'essay', 'poem', 'proverb', 'other'));

UPDATE utterances SET kind_wide = kind;

ALTER TABLE utterances DROP COLUMN kind;
ALTER TABLE utterances RENAME COLUMN kind_wide TO kind;

CREATE INDEX idx_utterances_kind ON utterances(user_id, kind);

-- staged_quotes.kind is unconstrained and stays that way, on 0053's argument in
-- 0053's words: "A staged row is somebody's file before anybody has approved it:
-- refusing it at the door means an import fails with a constraint error naming a
-- column, where the approval screen could have shown the value and let the reader
-- fix it." So an import naming a poem already worked; it is the library's own
-- column that had to learn the word.
