-- 0094 — WHAT ONE ENTRY SHOWS, AND WHAT IT SAYS, IN THIS ANTHOLOGY.
--
-- An anthology already decides which parts of a quote it shows (0045, 0074); these two columns let a single entry
-- differ from that, and let it say something other than the quote does, without touching the quote.
--
-- `fields` is an object of overrides, key -> true | false, using the registry's own keys: {"translation": true,
-- "note": false}. A key that is absent inherits the anthology's switch. '' and '{}' are one state (nothing overridden),
-- the way '' and [] are for the anthology's own `fields`.
--
-- `edits` is an object of replacement text, key -> string, for the parts of a quote an anthology may restate: the
-- quote, its note, its translation, its transliteration, and the context before and after it. The quote's own row is
-- never written through these: the anthology prints the edit and the library keeps the original, which is the whole
-- reason they are here and not a write to the quote. An empty string is a real edit (the anthology shows nothing
-- there); a key that is absent shows the quote's own.
ALTER TABLE anthology_entries ADD COLUMN fields TEXT NOT NULL DEFAULT '';
ALTER TABLE anthology_entries ADD COLUMN edits  TEXT NOT NULL DEFAULT '';

-- A passage taken out of an anthology is remembered with its place and its commentary (0088); it now keeps what it showed
-- and what it said as well, so putting it back puts it back as it was.
ALTER TABLE anthology_removed ADD COLUMN fields TEXT NOT NULL DEFAULT '';
ALTER TABLE anthology_removed ADD COLUMN edits  TEXT NOT NULL DEFAULT '';
