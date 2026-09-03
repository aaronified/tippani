-- 0063: what a credit is, what a character is in one work, and the order of a name.
--
-- The character screens the design pack draws — the identity, and the same
-- character local to a book, a film and a game — ask the schema eight questions
-- it could not answer. This adds them, and the reasoning per column is here
-- rather than in the screen, because a column outlives the screen that wanted it.
--
-- ═══ A CREDIT IS NOT A NAME IN A SLOT ═══
--
-- work_cast has carried (character, actor) since 0048, which reads as "one
-- character is played by one person". The pack's film screen has FOUR credits on
-- one character in one work: the performer, an unnamed flashback child, a Hindi
-- dub and a Bengali dub. Every one of them is a different human being saying or
-- being the same character in the same film, and none is a correction of another.
--
-- Two of those four are not expressible today and one is silently refused.

-- WHAT IS PECULIAR ABOUT THIS CASTING. "voice only", "flashback", "uncredited",
-- "age 17 and the epilogue at 36". It belongs to the credit and to nothing else:
-- not to the person, who is the same person in every work, and not to the
-- character, who is the same character in every performance of them.
--
-- NOT `description`, which 0056 put on this row for a different job — the
-- character's own description in this work, falling back to characters.description.
-- One column cannot be both "who this character is here" and "what is odd about
-- this casting", and merging them would make a refetch that rewrites the
-- character's blurb silently discard the reader's note about a stunt double.
ALTER TABLE work_cast ADD COLUMN credit_note TEXT NOT NULL DEFAULT '';

-- THE LANGUAGE OF THIS PERFORMANCE, and it is what makes a dub list a list. One
-- film carries a dozen dubs, each a different person saying the same lines, and
-- filed without their language they read as a cast of twelve Harrys. Free text
-- rather than a code: a reader who writes "Bengali" and a reader who writes "bn"
-- are both right about their own library, and there is no lookup this app could
-- validate against that would not refuse a language somebody actually has.
ALTER TABLE work_cast ADD COLUMN credit_lang TEXT NOT NULL DEFAULT '';

-- ═══ WHAT THIS CHARACTER IS IN THIS WORK ═══
--
-- Three short answers the pack puts side by side on one line, because given a row
-- each they took 150px of height and read as three unrelated decisions.
--
-- ALL THREE ARE PER WORK AND THAT IS THE WHOLE POINT. Harry is the protagonist of
-- the book, the lead of the film and playable in the game; he first appears on
-- page 9, at 00:02:14, and in Act I; and he is 17 in three works and 11 in one
-- flashback. An identity-level answer would be wrong in every case where the
-- screens differ, which is the case they were drawn for.

-- FREE TEXT AND NOT A VOCABULARY. Protagonist · Lead · Supporting · Playable ·
-- Cameo covers the works I can think of and would refuse the one somebody
-- actually has — a narrator, a framing device, a voice on a radio. The invariant
-- against CHECK on an open vocabulary applies with more force to a list nobody
-- has finished writing.
ALTER TABLE work_cast ADD COLUMN part TEXT NOT NULL DEFAULT '';

-- THE LOCATOR VOCABULARY IS THE WORK'S, not the schema's: a page and a chapter
-- for a book, a timestamp for a film, an act or a quest for a game. This stores
-- whatever the work states, in the words the work states it in — the same bargain
-- `dialogues.timestamp` struck in 0003 and for the same reason.
ALTER TABLE work_cast ADD COLUMN first_appears TEXT NOT NULL DEFAULT '';

-- TEXT AND NOT AN INTEGER. "17" is the common answer and "11 in the flashback",
-- "unstated", "about forty" and "1980–1998" are all real ones. An integer column
-- would take the first and refuse the rest, and a reader with an unstated age
-- would have to leave the field empty — which means "nobody has said" rather
-- than "the work does not say", and those are different facts.
ALTER TABLE work_cast ADD COLUMN age_here TEXT NOT NULL DEFAULT '';

-- EVERY OTHER NAME THIS WORK USES FOR THEM. `character` is the name that prints;
-- this is the rest, one per line, and it is per work because the spellings are:
-- the book calls him Undesirable No. 1 and the film's credits do not.
--
-- FREE TEXT RATHER THAN ROWS IN character_alias, and the distinction is which
-- question is being answered. character_alias is the IDENTITY's spellings — what
-- should find this record in a search, across the whole library. These are one
-- work's own, and they neither travel to the identity nor claim uniqueness
-- against it: two films may each credit him differently and both be right.
ALTER TABLE work_cast ADD COLUMN aliases TEXT NOT NULL DEFAULT '';

-- ═══ THE CHARACTER'S OWN DATE ═══
--
-- IN-WORLD, where a work states it. `people` has had `born` and `died` since it
-- existed, because a person is a person; a character had neither, so a birthday
-- a book prints on the page had nowhere to go. Only `born`: a character's death
-- is a plot point and belongs in the description a reader writes, not in a field
-- the app prints beside their name on every list.
--
-- Free text, like a person's, because "31 July 1980", "the Third Age", "unstated"
-- and "before the war" are all answers a work gives.
ALTER TABLE characters ADD COLUMN born TEXT NOT NULL DEFAULT '';

-- ═══ PLAYED BY OR VOICED BY IS THE WORK'S FACT ═══
--
-- `actorRoleFor` derives it from the medium — a book has no performer, a game has
-- a voice, a film has an actor — and that is right about the common case and
-- wrong about several real ones. An animated film casts voices. A motion-capture
-- performance is a performer whose voice is somebody else. A game can do both.
--
-- So the derivation becomes the DEFAULT rather than the answer: empty means "ask
-- the medium", which is every row that exists today and every row nobody has an
-- opinion about. Only a reader who has said otherwise stores anything here.
--
-- ON `movies` AND NOT ON `work_cast`, because it is a fact about the work: an
-- animated film voices its whole cast, and asking per credit would make the
-- reader answer the same question twenty times. A single credit that differs —
-- the mocap performer among the voices — says so in its own note.
--
-- Books are absent deliberately: a book performs nobody, and a column offering
-- to say otherwise is a column somebody will one day set.
ALTER TABLE movies ADD COLUMN cast_role TEXT NOT NULL DEFAULT '';

-- ═══ AN ALIAS LIST HAS AN ORDER NOW ═══
--
-- 0056 said of these tables: "display never uses one". That rule stands — what
-- prints is the record's own `name` — but the pack edits a name and its spellings
-- as ONE multi-line field whose FIRST LINE IS THE ONE THAT PRINTS, so promoting
-- an alias is a line move rather than a two-field dance. A line move is only
-- meaningful if the lines have an order.
--
-- The owner ruled this change explicitly. `seq` is the field's own line order,
-- 1-based below the name; 0 is every row that existed before this migration and
-- every row a merge writes, which have no position anybody chose.
--
-- WHY NOT A `position` ON THE PRIMARY KEY: the key is (user_id, alias_key) and
-- must stay so — it is what stops two records claiming one spelling, which is the
-- thing that makes a credit string resolve to exactly one person across a merge.
ALTER TABLE character_alias ADD COLUMN seq INTEGER NOT NULL DEFAULT 0;
ALTER TABLE person_alias    ADD COLUMN seq INTEGER NOT NULL DEFAULT 0;

-- ═══ SEVERAL CREDITS MAY BE WAITING FOR A NAME ═══
--
-- idx_work_cast_pair is UNIQUE on (kind, work_id, character_key, actor_key) where
-- the row is not a tombstone, and it is what stops a refetch billing one
-- character twice for the same performer. An unnamed credit has actor_key '', so
-- the index also allows exactly ONE of those per character per work — and the
-- pack's film screen has two: a flashback nobody has cast, and a Bengali dub
-- nobody has named. The second was refused with a constraint error on a screen
-- whose whole point is that a credit with nobody named is a legitimate state.
--
-- So the uniqueness now applies only where there is a name to be unique about.
-- A named duplicate is still refused, which is the case the index was written for;
-- any number of empty credits may sit waiting, which is the case it was not.
--
-- Rejected: a credit_seq column in the key. It would also permit two identical
-- NAMED credits — a duplicate the refetch merge relies on being impossible — and
-- it would make every writer of a cast row allocate a sequence: the provider
-- seed, the reader's add, the merge, and the trash restore, four places that must
-- agree about a number none of them cares about.
DROP INDEX idx_work_cast_pair;
CREATE UNIQUE INDEX idx_work_cast_pair ON work_cast(kind, work_id, character_key, actor_key)
  WHERE origin <> 'removed' AND actor_key <> '';
