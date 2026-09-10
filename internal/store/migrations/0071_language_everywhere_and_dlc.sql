-- 0071 — a language on every quote, and the pack a game's line came in.
--
-- ───────────────────────── language on all three kinds
--
-- THE OWNER'S CORRECTION, and the reason is mechanical rather than cosmetic:
-- "why is language hard dropped? it is needed everywhere (it is the thing that
-- ascertains whether a translation will get priority over a quote text or not.
-- it should be everywhere)."
--
-- 0051 gave `translation` to all three quote tables. 0035 gave `language` to
-- `utterances` alone, and its own note argued that a book highlight's original
-- language is the book's — which is true of the BOOK and false of the LINE. A
-- Bengali couplet quoted inside an English novel is in Bengali; a line of Hindi
-- in an English-language film is in Hindi. The app already decides which text
-- leads (see textOrder) and it cannot decide without knowing what the quote is
-- in, so a translation on an annotation has been half a feature: the second text
-- existed and the fact that decides its precedence did not.
--
-- FREE TEXT, exactly as `utterances.language` is, and deliberately not an ISO
-- code yet. The language model respec — one master list, four display states,
-- three scopes — is queued and will migrate all three of these columns together.
-- Adding a code column here would be guessing at that design's shape and would
-- have to be undone; adding the same free-text column the app already has makes
-- the respec one migration over three tables instead of one over one.
--
-- NOT IN THE SEARCH INDEX, because `utterances.language` is not either: you find
-- a quote by its words, and the language is a filter rather than a term. This is
-- why this migration costs no FTS rebuild at all.

ALTER TABLE annotations ADD COLUMN language TEXT NOT NULL DEFAULT '';
ALTER TABLE dialogues   ADD COLUMN language TEXT NOT NULL DEFAULT '';

-- `staged_quotes.language` already exists (0035 put it there for the quotes half
-- of the queue) and one column serves all three kinds, so the staging table
-- needs nothing: a book file that names a language now keeps it through approval
-- because the DESTINATION finally has somewhere to put it.

-- ───────────────────────── dialogues.dlc
--
-- THE OWNER'S: "Game needs a DLC field for DLC quotes. act, and quest remain as
-- is. DLC will have the DLC name, optional."
--
-- A THIRD GAME LOCATOR, coarser than both the others. An act and a quest place a
-- line inside a body of content; the DLC names WHICH body — Blood and Wine, Far
-- Harbor, Phantom Liberty — and without it two expansions that both open with a
-- "Prologue" are one shelf. Free text like act and quest, for the reason gameRef
-- states: half the games worth quoting number none of this, so empty is unset and
-- there is no pointer to carry.
--
-- GAMES ONLY, cleared for every other medium by the same rule that clears act and
-- quest — it joins gameRef so that "which locators does a game have" keeps one
-- answer rather than gaining a second one next door to the first.
--
-- OUT OF THE DEDUPE HASH, unlike act and quest. Those two are identity: a bark
-- reused in two quests is two quotes (0047, on 0025's reasoning). A DLC name is a
-- container the act and quest already sit inside, so folding it in would buy no
-- distinguishing power and would fork a duplicate the moment somebody filled the
-- name in on a line that already existed — the failure occasion_circa and
-- recipient are both kept out of the hash to avoid.
--
-- NOT IN THE SEARCH INDEX: no locator is. `dialogues_fts` holds the quote, the
-- note, the character, the actor and the translation, which are the things a
-- reader has words for.

ALTER TABLE dialogues     ADD COLUMN dlc TEXT NOT NULL DEFAULT '';
ALTER TABLE staged_quotes ADD COLUMN dlc TEXT NOT NULL DEFAULT '';
