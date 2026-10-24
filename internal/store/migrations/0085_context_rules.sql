-- 0085 — THE MIDDLE TIER OF THE CONTEXT CASCADE (docs/wiki/Plan-Work-Source-Files.md,
-- "How much context"): a work's or a board's own rule for how much of its source file
-- shows around a quote.
--
-- The cascade is quote (source_context.want_*, 0084) > work or board (here) > the
-- reader's global pair > the built-in default. NULL IS NOT 0, the same as in 0084: NULL
-- means "inherit", 0 means "nothing, deliberately". Each half is nullable on its own, so
-- "nothing before, inherit after" is expressible.
--
-- A book's and a film's rule covers their annotations and dialogues; a board's covers its
-- utterances (the only quote with a board, 0036). A quote has at most one middle tier.
--
-- THE GLOBAL PAIR IS NOT A COLUMN: it is two rows in `settings`, per reader
-- ('context_before.<user id>' and 'context_after.<user id>'), and an absent row is NULL.
ALTER TABLE books  ADD COLUMN context_before INTEGER;
ALTER TABLE books  ADD COLUMN context_after  INTEGER;
ALTER TABLE movies ADD COLUMN context_before INTEGER;
ALTER TABLE movies ADD COLUMN context_after  INTEGER;
ALTER TABLE boards ADD COLUMN context_before INTEGER;
ALTER TABLE boards ADD COLUMN context_after  INTEGER;
