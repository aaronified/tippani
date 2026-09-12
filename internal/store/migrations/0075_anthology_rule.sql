-- 0075 — an anthology can be FILLED from a search, and this is the app's first
-- stored query.
--
-- THAT IS THE SIGNIFICANT FACT AND NOT THE FEATURE. Nothing in Tippani has ever
-- persisted a question: boards are explicit single membership, tags are explicit
-- many-to-many, and a themed review is a predicate evaluated per request. Every
-- search until now has been stateless. So the shape below matters more than what
-- it does, and it was chosen to keep the blast radius at one row.
--
-- A RULE IS A WAY TO FILL AN ANTHOLOGY, NOT A WAY TO BE ONE, which is the decision
-- the whole feature turns on. A live query anthology can hold neither an ORDER nor
-- YOUR WRITING — re-run the rule and the order is the query's, and per-entry
-- commentary has nothing stable to attach to when membership moves under it. Those
-- two are the whole point of an anthology, stated in its own file's opening
-- comment: "It is not a tag with a nicer hat." A live one would be exactly that.
--
-- So matched quotes become REAL anthology_entries rows at the moment of filling,
-- and from then on they are ordinary entries: draggable, annotatable, removable.
-- Everything the feature already is survives untouched.
--
-- `rule` HOLDS THE SEARCH QUERY STRING — `tag=stoicism&author=Aurelius&q=death` —
-- because that is already the wire format, already bookmarkable, and already parsed
-- by exactly one parser (parseSearchFacets). A JSON criteria object would be a
-- SECOND grammar for a question the app can already ask, and the two would drift:
-- the failure would be a rule that finds different quotes from the search bar
-- showing the same words, which is worse than either behaviour on its own.
--
-- The zero value is the empty string, per the convention throughout this repo, and
-- an anthology with no rule is exactly what an anthology is today.
ALTER TABLE anthologies ADD COLUMN rule TEXT NOT NULL DEFAULT '';

-- KEEP IT FED — run the fill the next time the anthology is opened, and append
-- anything new.
--
-- NOT A BACKGROUND JOB, and this is an invariant rather than a preference: "no
-- goroutine outlives its request — no worker pool, ticker, or scheduler; adding one
-- is a design discussion first." Filling on read is the cheapest thing that is
-- honest, and it means the reader is present when their anthology changes.
ALTER TABLE anthologies ADD COLUMN rule_auto INTEGER NOT NULL DEFAULT 0;

-- When the rule last ran, so the screen can say "12 new since Tuesday" — with the
-- count as a control the reader presses rather than a change that happened while
-- they were not looking.
ALTER TABLE anthologies ADD COLUMN rule_run_at TEXT NOT NULL DEFAULT '';
