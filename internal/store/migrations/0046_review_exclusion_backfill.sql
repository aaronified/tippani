-- 0046: the skip that never reached the quotes it was supposed to skip.
--
-- REPORTED, and the report is the clearest statement of it: "Homo Deus is skipped
-- from the daily quiz. So is Sapiens. Yet both are coming in quizzes. Only one
-- quote has the skip mark, which I manually added."
--
-- 0033 gave five tables a `review_excluded` column and made the deck's
-- eligibility rule read TWO of them: a highlight was kept out if its own flag was
-- set OR its book's was. Excluding a book was therefore O(1) — one column, and
-- every highlight in it, including the ones added tomorrow, fell out of the deck
-- for free.
--
-- 1.15.0 removed that second term, deliberately and for a good reason (see
-- reviewSource.where(), "ONE FLAG, NOT TWO"): a quote could be barred from the
-- deck by a flag that was not on it, so the control that cleared the quote's own
-- flag said "back in the quiz" and the deck went on refusing the card. The gate
-- became the flag the reader can see and change on the card in front of them, and
-- excluding a work became a WRITE across its quotes instead of a term in a query.
--
-- WHAT THAT COMMIT DID NOT DO IS LOOK BACKWARDS. Every write path cascades
-- correctly — /books/bulk, /movies/bulk and both importers — but nothing went and
-- wrote the flag onto the children of works that were ALREADY excluded. Those
-- rows had never needed it. So a book skipped in 1.14 kept its own flag set, kept
-- drawing its skip mark, kept reading as skipped everywhere on screen, and its
-- twenty-seven highlights went back into the deck the day the reader upgraded —
-- with nothing anywhere saying so. The same applies to a library restored from a
-- backup taken before 1.15.0, which is a live path and not a historical one.
--
-- This is the write 1.15.0 owed them, run once.
--
-- ONE DIRECTION ONLY. An excluded work stamps its children; an INCLUDED work does
-- not clear anything. A quote whose own flag is set inside a book whose flag is
-- not is somebody skipping one line on its own account, which is the feature
-- working, and clearing it would be this migration inventing an opinion about a
-- decision the reader made by hand.
--
-- THE ONE THING THIS COSTS, said plainly rather than discovered. Excluding a work
-- and then putting a single quote of it back is a reachable state — 1.15.0's
-- commit message names it — and it looks identical in the data to a stale row
-- this migration exists to fix. There is no column that tells them apart: both
-- are `books.review_excluded = 1` with a child at 0. So the child is re-excluded,
-- and the reader gets back a card they had asked for. That is recoverable in one
-- press with a mark on screen saying why; the alternative is a book somebody
-- skipped going on being asked about forever, which is the bug as reported. The
-- conservative-looking rule — skip works that already have an excluded child —
-- would have left the reported library broken, because the report is exactly a
-- book with one hand-skipped quote in it.
--
-- updated_at moves, matching what the cascade does on the live path: the row's
-- data really did change, and 0022 exists because a column that looks usable and
-- is not written is worse than one that is absent. The FTS `_au` triggers fire
-- and rewrite the same text they already held, which is what every other UPDATE
-- to these two tables does.
--
-- Two pairs, because two work kinds have child quotes: books→annotations and
-- movies→dialogues (games are movies rows by media_type, so they are covered).
-- Utterances are standalone and have no parent to inherit from.

UPDATE annotations SET review_excluded = 1, updated_at = datetime('now')
WHERE review_excluded = 0
  AND book_id IN (SELECT id FROM books WHERE review_excluded = 1);

UPDATE dialogues SET review_excluded = 1, updated_at = datetime('now')
WHERE review_excluded = 0
  AND movie_id IN (SELECT id FROM movies WHERE review_excluded = 1);
