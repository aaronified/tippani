-- 0059: the last two person-bearing columns get a record to point at.
--
-- 0056 made a person a RECORD rather than a name and gave the four column-backed
-- credits somewhere to point (work_person). Two person-bearing columns were left
-- out, and they are the two that are not work-level credits at all:
--
--   dialogues.actor      who said THIS film or show line
--   utterances.speaker   who said THIS standalone quote
--
-- WHY THEY ARE NOT work_person ROWS. work_person is keyed
-- (user_id, kind, work_id, role, ordering) — it says "this WORK is credited to
-- this person". An actor on a dialogue is not a credit on the film; it is a fact
-- about one line, and two lines of the same film routinely name two different
-- actors. A standalone quote has no work at all. So the link belongs on the quote,
-- which is what these columns are.
--
-- THE STRING COLUMNS STAY, and it is the same argument that kept books.author:
-- dialogues_fts and utterances_fts are external-content FTS5 (content='dialogues',
-- content='utterances') and index `actor` and `speaker` directly. FTS5
-- external-content cannot index a joined table, so dropping the strings would mean
-- a contentless index populated by hand — which loses
-- INSERT INTO <t>_fts(<t>_fts) VALUES('rebuild'), the self-repair.
--
-- THE STRING IS ALSO THE PER-QUOTE SPELLING, which is why there is no `credit_as`
-- here as there is on work_person. On a book the column is a JOINED credit line
-- that has to be recomposed from several link rows; here one quote points at one
-- person, so the column already IS "as credited on this quote". A merge re-points
-- the id and leaves the string exactly as it was — the same promise the covers get.
--
-- ONE PERSON, AND THAT WAS DECIDED IN 0056, not here: both quote tables already
-- carry a single speaker_cast_id. The autofill can still PRINT two names in this
-- column when a line credits two characters, and such a row simply stays
-- unlinked — there is no honest single answer, and picking the first would put a
-- two-hander into one performer's panel while hiding it from the other's. Which
-- is precisely what speaker_cast_id does with the same line.
--
-- ON DELETE SET NULL, NOT CASCADE. Deleting a person must never delete a quote.
-- The line survives with the name still printed on it and nothing pointing at a
-- record, which is precisely the state the library was in before 0056 and is a
-- perfectly good one to be in.

ALTER TABLE dialogues  ADD COLUMN actor_id   INTEGER REFERENCES people(id) ON DELETE SET NULL;
ALTER TABLE utterances ADD COLUMN speaker_id INTEGER REFERENCES people(id) ON DELETE SET NULL;

-- The question these answer is "everything this person said", which is what the
-- person panel asks and what a merge walks.
--
-- PARTIAL, WHICH 0056's work_cast INDEXES ARE NOT. There the id is one of two on a
-- narrow table that only ever holds cast rows; here the linked rows are a minority
-- of every quote in the library — a book-only reader has none at all — and an index
-- over NULLs would be mostly a list of rows the query can never want. The predicate
-- has to be repeated in the WHERE clause for SQLite to use it, which every reader
-- of these columns does anyway: a quote with no linked person is not an answer to
-- "what did this person say".
CREATE INDEX idx_dialogues_actor_id   ON dialogues(actor_id)    WHERE actor_id IS NOT NULL;
CREATE INDEX idx_utterances_speaker_id ON utterances(speaker_id) WHERE speaker_id IS NOT NULL;
