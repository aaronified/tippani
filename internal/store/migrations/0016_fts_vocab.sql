-- 0016: fts5vocab views for typo-tolerant search.
--   Zero-storage virtual tables that read each FTS index's term dictionary.
--   The fuzzy-search path corrects a zero-hit query's tokens against these
--   terms (bounded edit distance in Go) and re-runs the normal MATCH.
--   They hold no data of their own: nothing to sync, nothing to corrupt,
--   nothing for store.Recover() to copy (their names match the %_fts_%
--   exclusion), and a fresh Migrate() recreates them.
--
-- The 'row' variant exposes term, doc, cnt — doc (documents containing the
-- term) is the popularity tie-breaker the corrector prefers. fts5vocab
-- resolves its target index by name at query time, so a later
-- rebuildFTSTable() that DROPs + recreates the base FTS table leaves these
-- working (covered by a store test).

CREATE VIRTUAL TABLE books_fts_vocab       USING fts5vocab('books_fts', 'row');
CREATE VIRTUAL TABLE annotations_fts_vocab USING fts5vocab('annotations_fts', 'row');
CREATE VIRTUAL TABLE movies_fts_vocab      USING fts5vocab('movies_fts', 'row');
CREATE VIRTUAL TABLE dialogues_fts_vocab   USING fts5vocab('dialogues_fts', 'row');
