-- 0037: a board knows what KIND of thing it holds, and the three that were seeded
-- can be reached again.
--
-- WHAT WENT WRONG IN 0036. Its seed reads `FROM utterances` — one board per
-- (user, category) that user actually had. The intent was right and is kept:
-- somebody who has never saved a standalone quote should not open the app to
-- three empty shelves. But it has a consequence nobody wrote down, which is that
-- a reader with NO standalone quotes gets no boards at all, and after 0036 there
-- is no way to ask for them. defaultBoardID makes an 'Others' when the first
-- quote is finally saved, so nothing is broken; Proverbs and Speeches are simply
-- unreachable forever. That was reported as "I still cannot access the seeded
-- boards", and it is a gap rather than a bug: the offer was never built.
--
-- The offer belongs on the Add-board screen, where somebody has already said they
-- want a new shelf, rather than as a seed nobody asked for. A starter fills the
-- form in — a name, a colour, and the kind below — and the reader can change any
-- of it before pressing Create. The existing UNIQUE(user_id, name) and the 409 in
-- handleCreateBoard are the guard against a second 'Proverbs', which is why the
-- offer can stay available rather than trying to work out whether the reader has
-- "already added" a shelf they may have renamed.
--
-- ---------------------------------------------------------------- kind
--
-- A KIND IS NOT A NAME, and that distinction is the whole reason this column
-- exists rather than a lookup for boards called 'Proverbs'. 0036 is emphatic that
-- nothing in the code may know a board's name, and it is right — a special case
-- on 'Others' breaks the moment somebody renames it, silently, and the reader is
-- the only one who can see that it broke. But a proverb board genuinely does
-- behave differently: the language and the English translation are the fields
-- that matter on it, and they are noise on a board of speeches.
--
-- So the behaviour hangs on a column the reader sets once and can see, not on
-- what they happened to type in the name box. Rename a proverb board to
-- 'Grandmother' and it is still a proverb board; call a plain board 'Proverbs'
-- and nothing changes about it. Both of those are the correct answer.
--
-- Two values, and no more until something needs a third. 'speech' is deliberately
-- NOT a kind: a speech quote uses the same fields every other quote uses — a
-- speaker, an occasion, a date, a place — so a kind for it would be a label with
-- no behaviour behind it, which is how vocabularies rot.
ALTER TABLE boards ADD COLUMN kind TEXT NOT NULL DEFAULT 'plain'
  CHECK (kind IN ('plain', 'proverb'));

-- ---------------------------------------------------------------- languages
--
-- A JSON array of the languages this board is for, and it is meaningful only when
-- kind = 'proverb'. Empty is the ordinary state for every other board.
--
-- Asked at creation because it is the one thing that makes a proverb board usable
-- immediately: it turns the Language box on the quote form from a free-text field
-- somebody has to spell consistently into a short list, and it is what the
-- optional per-language sections group by. It stays editable, because a reader who
-- starts in Bengali and later adds Hindi should not have to make a second board.
--
-- STORED ON THE BOARD RATHER THAN DERIVED FROM ITS QUOTES, which is the choice
-- worth defending. Deriving would be free and would never go stale — but it can
-- only ever describe a board that already has quotes on it, and the entire point
-- of asking at creation is that the board is empty at that moment. A derived list
-- would be empty exactly when the reader needs it.
ALTER TABLE boards ADD COLUMN languages TEXT NOT NULL DEFAULT '';

-- ---------------------------------------------------------------- the backfill
--
-- Which existing boards hold proverbs is a question the data can answer, so it is
-- not asked of the name. 0035's `category` is still on `utterances` — kept for
-- exactly one release so a mapping like this can be checked against a real
-- library — and it records what the reader themselves filed. A board with any
-- proverb on it is a proverb board.
--
-- This is the last use of `category`, and it is what it was kept for.
UPDATE boards SET kind = 'proverb'
WHERE EXISTS (
  SELECT 1 FROM utterances u WHERE u.board_id = boards.id AND u.category = 'proverb'
);

-- And its languages are the ones actually on it, so a reader who already had
-- Bengali and Hindi proverbs opens 1.14.2 with both listed rather than with an
-- empty picker on a board that plainly has two languages in it.
--
-- json_group_array over DISTINCT gives the same shape the API writes, so nothing
-- downstream has to tell a backfilled board from a made one.
UPDATE boards SET languages = COALESCE((
  SELECT json_group_array(lang) FROM (
    SELECT DISTINCT TRIM(u.language) AS lang
    FROM utterances u
    WHERE u.board_id = boards.id AND TRIM(COALESCE(u.language, '')) <> ''
    ORDER BY lang
  )
), '')
WHERE kind = 'proverb';
