-- 0082 — A PERSON'S SIGNATURE, BESIDE THEIR PORTRAIT.
--
-- signature_path: the stored file's name in MediaCover, '' for none. The same kind
-- of column image_path is, and for the same reason it is on the PERSON row and not
-- a table of its own: one signature per person, read with the person, written by
-- the same transactions. The file is named by the hash of its bytes, so two
-- readers holding the same signature share one file; that is why nothing deletes
-- one without asking whether another row, or a bin row, still names it.
--
-- signature_source: the supplier slug, 'manual' for one the reader uploaded or
-- chose, '' for unknown. The owner's "every path records its source" (0081), kept
-- here from the start rather than added a release later.
--
-- signature_removed: 1 once the reader removed a signature. The person's Fetch
-- fills an empty slot, and without this memory it would put back, at the next
-- Fetch, every signature the reader had just taken off. An upload or the slot's
-- own Fetch (both a reader asking for one) clear it again.
--
-- Defaults are empty and zero rather than NULL, as every enrichment column on this
-- table is, so a hand-made row and a fetched one read the same to the scanner.
-- Nothing here is a CHECK: signature_removed is a flag the app writes, and a CHECK
-- would be evaluated against existing data for no gain.
ALTER TABLE people ADD COLUMN signature_path TEXT NOT NULL DEFAULT '';
ALTER TABLE people ADD COLUMN signature_source TEXT NOT NULL DEFAULT '';
ALTER TABLE people ADD COLUMN signature_removed INTEGER NOT NULL DEFAULT 0;
