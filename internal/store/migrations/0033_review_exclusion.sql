-- 0033: not this one. A quote you keep, and never want to be quizzed on.
--
-- The Daily Quiz draws from EVERYTHING with words in it, and that is right for a
-- library of highlights and wrong for the corners of one. A shopping list you
-- saved as a quote, a line you keep for its wording rather than its sense, a
-- reference book whose forty highlights are all page numbers — none of them are
-- recall material, and until now the only way to keep them out of the deck was to
-- delete them. "Remove it from the library to stop being asked about it" is the
-- app telling somebody their note-keeping is wrong.
--
-- WHY A COLUMN ON THE ROW, AND NOT A FLAG ON item_reviews. The obvious home is
-- the schedule table, since exclusion is a scheduling fact. It is a trap:
-- item_reviews has NO ROW for a quote that has never been reviewed, so excluding
-- an unseen quote would have to INSERT one — and the deck reads
-- `r.item_id IS NOT NULL` as "this card has been seen" in four separate places
-- (the unseen bucket, the due bucket, the status breakdown, the stats page).
-- Excluding a quote and then putting it back would silently promote it from
-- "never seen" to "seen and overdue", which is a lie about the reader's history
-- told by a preference they set for an unrelated reason.
--
-- A column on the quote itself has none of that. It also travels for free
-- everywhere a quote already travels: the bin snapshots rows with SELECT *, the
-- account backup does the same, and the export carries the row — so an excluded
-- quote deleted and restored comes back excluded, with no code in any of those
-- three places knowing this column exists.
--
-- WHY THE WORKS TOO. "This book is not for quizzing" is a property of the book,
-- not of the forty highlights it happens to have today: exclude the book and the
-- highlight you add tomorrow is excluded as well, which is what somebody who
-- excluded a reference manual meant. The deck already joins each child quote to
-- its parent work to establish ownership, so the parent's flag costs the query
-- one more term and no new join. A standalone quote has no parent and carries
-- only its own flag, which is the same asymmetry every other part of §24 has.
--
-- Five ADD COLUMNs, no rebuild. Nothing here touches a table another table points
-- at, so none of the FK-parent-rebuild care the repo takes elsewhere applies; the
-- FTS triggers name their columns explicitly and are unaffected.
--
-- DEFAULT 0 = included, which is what every existing row means today.

ALTER TABLE books ADD COLUMN review_excluded INTEGER NOT NULL DEFAULT 0;
ALTER TABLE movies ADD COLUMN review_excluded INTEGER NOT NULL DEFAULT 0;
ALTER TABLE annotations ADD COLUMN review_excluded INTEGER NOT NULL DEFAULT 0;
ALTER TABLE dialogues ADD COLUMN review_excluded INTEGER NOT NULL DEFAULT 0;
ALTER TABLE utterances ADD COLUMN review_excluded INTEGER NOT NULL DEFAULT 0;
