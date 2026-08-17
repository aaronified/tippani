-- 0041: studios stop claiming they came from Open Library.
--
-- A game studio is a person row of kind 'studio' (0040), and until 1.16.0 both
-- paths that enrich a person sent it down the AUTHOR branch: handlePersonLookup
-- for the "refetch links" button, and resolvePersonPortrait for "fill in
-- automatically" — the one that WRITES. Electronic Arts therefore resolved to
-- openlibrary.org/authors/OL7329153A, and that identity was stored: source,
-- source_id and a links blob pointing at a book author.
--
-- Fixing the code stopped new rows being written that way and did nothing about
-- the ones already there, so the panel kept reading "VIA OPENLIBRARY" under a
-- studio that had just been re-fetched from IGDB and correctly found nothing.
-- A stale provenance line is worse than none: it is the interface stating, in
-- the present tense, where a fact came from — and being wrong about it.
--
-- SCOPED AS TIGHTLY AS THE FACTS ALLOW. Only rows that are a studio, and only
-- where the recorded source is openlibrary. A person who is genuinely an author
-- AND happens to share a name with a studio keeps their author identity: the
-- role is in person_kinds, so the EXISTS clause asks "is this row a studio" and
-- the source test asks "did the wrong branch write it".
--
-- The bio, born and died are cleared with it. They came from the same author
-- record, so a studio carrying a novelist's birthday is the same error wearing
-- different words — and unlike the source line, nothing on screen says where
-- they came from.
UPDATE people
   SET source = '', source_id = '', links = '', bio = '', born = '', died = ''
 WHERE source = 'openlibrary'
   AND EXISTS (SELECT 1 FROM person_kinds pk WHERE pk.person_id = people.id AND pk.kind = 'studio');
