-- 0062: a work's links out.
--
-- A person has had a `links` column since the person panel learned to fetch
-- reference pages, and a character gained the same one in 0057. A WORK — the
-- thing a reader is most likely to want to open somewhere else — had none, so
-- the only place to put a Goodreads page or a Letterboxd entry was the note on
-- one of its quotes.
--
-- THE SAME COLUMN AND THE SAME FORMAT, deliberately: whitespace-separated URLs,
-- read by the client's parseLinks, which files each one under the provider whose
-- host it matches and keeps the rest whole. One parser, one merge, one panel
-- renderer for people, characters and works alike; three shapes would be three
-- chances to disagree about what a stored link is.
--
-- FREE TEXT AND NOT A TABLE, and this is the decision worth recording. A
-- `work_link(kind, work_id, provider, key)` table would let a link carry its own
-- provenance and its own order, and it would also make "any provider on any
-- record" — the rule this feature exists for — a vocabulary somebody has to
-- extend before a reader can paste a URL. The pack is explicit that the list is
-- what is ADDED rather than what exists: a novel with a film adaptation
-- legitimately wants a TMDB page, and an obscure catalogue is not a special case,
-- it is just a URL. A text column takes both without being taught.
--
-- NOT IN THE FTS INDEX, for 0061's reason and one of its own: a URL is a string
-- nobody searches by prose, and every token in it would dilute the title queries
-- that share the index.

ALTER TABLE books  ADD COLUMN links TEXT NOT NULL DEFAULT '';
ALTER TABLE movies ADD COLUMN links TEXT NOT NULL DEFAULT '';

-- The staging queue holds a work between the upload and the approval, so a
-- column the queue does not have is a fact the import loses in silence — with a
-- successful import and matching counts to say nothing happened. 0061 added its
-- three here for the same reason; this is the fourth.
ALTER TABLE staged_works ADD COLUMN links TEXT NOT NULL DEFAULT '';
