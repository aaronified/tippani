-- 0052: a suggestion the reader has already said no to, remembered.
--
-- The cleanup page (Settings → Stray marks) reads every quote, note and
-- translation in the library and reports what cleanup.go's eight rules found: an
-- invisible character that arrived from a page, padding at an end, a doubled space,
-- a space before closing punctuation, a reference index left behind, a pronunciation
-- gloss, a word broken across a line by a hyphen, doubled punctuation. Each finding
-- is now offered WITH the rewrite it would make (cleanup_fix.go), and answered one
-- of two ways: accept it, or ignore it.
--
-- ACCEPTING NEEDS NO TABLE. It rewrites the field, and the finding is then gone —
-- the next scan finds nothing there because there is nothing there. Ignoring is the
-- half that needs storage, and it needs it for a reason that is not convenience: a
-- scan is derived from the text, so an unremembered "no" is a "no" the reader has to
-- give again on every visit, to the same finding, for ever.
--
-- AND THE "NO" IS THE POINT OF THE PAGE. cleanup.go says in as many words that
-- every one of its rules has a false positive that is somebody's real writing — a
-- sentence that genuinely ends in a numeral, a bracketed aside that belongs, a
-- character another language calls invisible. That is why it reported and fixed
-- nothing. A remembered refusal is what lets it do both: the finding that was real
-- writing is dismissed ONCE, and the list left behind is the list that is actually
-- wrong.
--
-- WHY THIS IS NOT A COLUMN ON THE QUOTE. Two reasons, and the first is fatal on its
-- own. A quote can carry more than one finding — a doubled space AND a hyphen break
-- — and the reader may want one fixed and the other left alone, so the answer is per
-- (quote, field, rule) and not per quote. And the three quote kinds are three
-- tables: a column would be three columns, three migrations and three write paths
-- for one preference, which is the shape 0043 and 0015 already rejected in favour of
-- a polymorphic side table.
--
-- ---------------------------------------------------------------- the shape
--
-- POLYMORPHIC (kind, item_id), spelled with the SAME THREE WORDS the other two
-- tables that point at a quote already use — `book` (annotations), `screen`
-- (dialogues), `quote` (utterances) — the three words the cleanup scan already
-- answers with. anthology_entries (0043) and
-- item_reviews (0015) both chose that vocabulary; a fourth table inventing
-- `annotation`/`dialogue` for the same three things would be one more mapping to
-- get wrong in the one place — the delete triggers — where getting it wrong
-- leaves rows behind silently.
--
-- NO FOREIGN KEY, for the reason those two have none: SQLite cannot express one
-- that points at either of three tables. So the cascade is written out as three
-- AFTER DELETE triggers, and they are not optional bookkeeping. A deleted quote
-- whose ignores survive is a landmine with a fuse: 0031's id floor stops a NEW
-- quote from inheriting a deleted one's id, so the orphan cannot be adopted by
-- an unrelated row — but the orphan itself accumulates, travels into every
-- backup, and is restored into a database where nothing points at it.
--
-- THE MATCH HASH IS WHAT MAKES A "NO" STAY ANSWERED WITHOUT GOING STALE, and it
-- is the one part of this table that is a decision rather than a shape.
--
-- The key could have been (quote, field, rule) alone. It is not, because a rule is
-- not one finding: `reference-mark` can fire twice in one note, once on a footnote
-- index that should go and once on a sentence that genuinely ends in a numeral.
-- Ignoring "the reference-mark rule on this note" would bury the first along with
-- the second, with nothing on any screen saying so.
--
-- The key could equally have been a hash of the WHOLE FIELD. It is not, because
-- then accepting one suggestion would revive every ignored one on the same field:
-- the text changed, so every hash over it changed, and the reader's answers to
-- untouched artefacts evaporate the moment they fix a different one.
--
-- So it is a fold of exactly the spans THIS rule matched, in order. Accepting a
-- different rule leaves those spans alone and the ignore holds; editing the quote
-- so the artefact itself changes produces a different fold, and the suggestion
-- comes back — which is right, because it is a different suggestion about
-- different words. The fold is computed in Go (cleanup_fix.go) rather than in SQL
-- for the reason CastKey is: SQLite's lower() knows only ASCII, and these spans
-- are by definition full of the characters ASCII does not cover.
--
-- created_at is kept so the Ignored bucket can be read newest-first — the order
-- somebody wants when they are undoing a decision they have just made.
CREATE TABLE IF NOT EXISTS cleanup_ignores (
  id         INTEGER PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       TEXT    NOT NULL,               -- book | screen | quote
  item_id    INTEGER NOT NULL,               -- the quote's id, in its own table
  field      TEXT    NOT NULL,               -- quote | note | translation
  rule       TEXT    NOT NULL,               -- the detector's token; no CHECK, see below
  match_hash TEXT    NOT NULL,               -- fold of the spans that rule matched
  created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  UNIQUE (user_id, kind, item_id, field, rule, match_hash)
);

-- NO CHECK ON `rule`, `kind` OR `field`, deliberately and for the reason 0006 and
-- 0027 give: these are open vocabularies validated in app code. The rule set is
-- the whole point of the feature and it will grow; a CHECK listing today's eight
-- would make every new detector a schema change, and — worse — an older binary
-- reading a database where a newer one has stored a rule it does not know would
-- have to be taught to survive its own constraint.
--
-- A rule this build does not recognise is simply never offered by it, which is
-- the same forward-compatibility the client already relies on for question types
-- and shelf states.

-- Read path: "everything this user has ignored", and "is THIS suggestion
-- ignored". The unique index above already serves the second as a covering
-- lookup; this one serves the Ignored bucket's listing and the per-item filter
-- the scan applies while it walks the library.
CREATE INDEX IF NOT EXISTS cleanup_ignores_user_kind ON cleanup_ignores(user_id, kind, item_id);

-- The cascade SQLite cannot declare. One per quote kind, named for the table it
-- watches, in the same shape as anthology_entries' three (0043) — including the
-- kind word each one writes, which is the single thing that has to agree with the
-- API and with the scan.
CREATE TRIGGER IF NOT EXISTS cleanup_ignores_book_del AFTER DELETE ON annotations BEGIN
  DELETE FROM cleanup_ignores WHERE kind = 'book' AND item_id = OLD.id;
END;
CREATE TRIGGER IF NOT EXISTS cleanup_ignores_screen_del AFTER DELETE ON dialogues BEGIN
  DELETE FROM cleanup_ignores WHERE kind = 'screen' AND item_id = OLD.id;
END;
CREATE TRIGGER IF NOT EXISTS cleanup_ignores_quote_del AFTER DELETE ON utterances BEGIN
  DELETE FROM cleanup_ignores WHERE kind = 'quote' AND item_id = OLD.id;
END;
