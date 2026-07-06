-- 0008: date of addition for annotations.
--   noted_at is the original date a highlight/note was made — carried by sources
--   that record one (Bookcision, the Tippani/Readest "- date:" binding) or set to
--   the moment of a manual add. NULL when a source doesn't provide one; the UI and
--   the table sort fall back to created_at. Plain ADD COLUMN — the FTS triggers
--   only touch quote/note, so no table rebuild is needed.
ALTER TABLE annotations ADD COLUMN noted_at TEXT;
