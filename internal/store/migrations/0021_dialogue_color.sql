-- Dialogues get the highlight colour annotations have always had.
--
-- 0003 built dialogues as a near-copy of annotations ("mirror annotations but
-- carry timestamp/character/actor instead of chapter/location, and have no
-- colour/tags"). Tags arrived later; colour never did, so a film line could be
-- favourited, tagged, stickered and reviewed exactly like a book highlight, but
-- not coloured — the one arbitrary hole in an otherwise deliberate symmetry.
--
-- With this, the two quote kinds differ only in how they point at their source:
-- an annotation has chapter/location, a dialogue has character/actor/timestamp.
-- Everything else — quote, note, colour, favourite, tags, stickers, noted_at,
-- source, review state — is common, and is modelled that way in Go (see the
-- quoteReq/quoteRow embedded structs in internal/httpapi).
--
-- 'yellow' is the same default new annotations get, so every existing line
-- lands on the neutral colour rather than appearing to have been categorised.
-- The CHECK mirrors annotations' exactly; the four colours are fixed (PLAN §3).
ALTER TABLE dialogues ADD COLUMN color TEXT NOT NULL DEFAULT 'yellow'
  CHECK (color IN ('yellow','blue','pink','orange'));
