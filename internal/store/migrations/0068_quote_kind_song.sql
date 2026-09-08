-- 0068 — a seventh quote kind: song.
--
-- THE OWNER'S, one line after the poem landed: "you have added poem, add songs
-- too." A song is the poem's neighbour in every way this release cares about —
-- its line breaks are its text, it is often in another language, and it has a
-- title rather than an occasion — and it is not a poem: one is read and the other
-- is sung, and a library that files Tagore's songs under Tagore's poems has lost
-- the distinction its owner keeps them for.
--
-- 0026 ALREADY LISTED IT. The free-text `medium` column's own comment named
-- "radio, speech, letter, interview, song" as the values it expected, so a reader
-- who has been here since then may have `medium = 'song'` on rows the one-time
-- pass (onetime_2_2_3_quote_kind.go) declined to fold, because 0053's five words
-- had nowhere to put it. Those cards have been showing the leftover text ever
-- since, which is what made it visible as work to do. They can be filed now.
--
-- THE MECHANISM IS 0067'S and the argument for it is 0067's: park the value in a
-- new column carrying the wider constraint, drop the old column, rename. Six
-- statements against a hundred and fifty, and nothing else in the schema touched.
-- That 0067 and 0068 are the same six statements a day apart is the point — the
-- vocabulary is now known to grow, and this is the shape that makes growing it
-- cheap and safe rather than a table rebuild each time.
DROP INDEX idx_utterances_kind;

ALTER TABLE utterances ADD COLUMN kind_wide TEXT NOT NULL DEFAULT ''
  CHECK (kind_wide IN ('', 'speech', 'letter', 'essay', 'poem', 'song', 'proverb', 'other'));

UPDATE utterances SET kind_wide = kind;

ALTER TABLE utterances DROP COLUMN kind;
ALTER TABLE utterances RENAME COLUMN kind_wide TO kind;

CREATE INDEX idx_utterances_kind ON utterances(user_id, kind);
