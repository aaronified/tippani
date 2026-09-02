-- 0061: a book's subtitle, publisher and extent.
--
-- The design pack's Details form names twelve fields in relevance order — title,
-- subtitle, people, description, genres, year, language, publisher, series, pages,
-- ISBN, links — and three of them had nowhere to be stored. Both suppliers already
-- return all three on every lookup and the app was discarding them: Google Books
-- carries `subtitle`, `publisher` and `pageCount`; Open Library carries `subtitle`,
-- `publishers` and `number_of_pages`. So this is not new information to go and
-- fetch, it is information already arriving and being dropped on the floor.
--
-- ZERO-VALUE DEFAULTS, NOT NULL, per 0045 and 0047: an upgraded database reads
-- identically to a fresh one, and no scanner needs a pointer.
--
-- ---------------------------------------------------------------- subtitle
--
-- Its own column rather than part of `title`, because the two are asked
-- different questions. A title identifies the work and is what the dedupe, the
-- lookup match and every export key on; a subtitle belongs to the EDITION and
-- changes between printings of the same book. Folding it into the title would
-- make "The Master and Margarita" and "The Master and Margarita: A Novel" two
-- works, which is precisely the merge the catalogue spends its effort avoiding.
--
-- NOT INDEXED IN books_fts, deliberately. The index is external-content with
-- three triggers keeping it in step (0029 is the record of what changing its
-- shape costs), and the words a subtitle carries are usually "A Novel" — noise
-- that would dilute every title query to buy the rare subtitle that is the real
-- distinguishing phrase. The day that trade looks wrong, 0029 says what it costs.
--
-- ---------------------------------------------------------------- publisher
--
-- `movies.publisher` already exists (0042) and means the same kind of fact — the
-- company that put it out — so the name is reused rather than invented. A book's
-- publisher gets no `people` row, for exactly the argument 0042 made about a
-- game's: 0037's bar is that a new kind must have BEHAVIOUR, and a publisher here
-- has no logo, no portrait slot and nothing that groups or navigates by it. It is
-- a name on a details page, and a clickable one would promise a page that does not
-- exist.
--
-- ---------------------------------------------------------------- pages
--
-- A SEPARATE FACT FROM `pos_total`, which is the reason this is a new column and
-- not a reading of an old one. `pos_total` (0024) is the denominator of a READ:
-- it is episodes for a show, it is 100 for somebody tracking a book by percent,
-- and it is whatever edition the reader happens to hold. `pages` is the extent of
-- the work as its publisher states it, it arrives from a supplier, it is the same
-- for a book nobody has opened, and it survives a re-read tracked a different way.
--
-- They are related and the relation is one-directional: starting a page-counted
-- read with no total offered may DEFAULT its total from `pages`. Nothing writes
-- back the other way — finishing a 480-page edition does not restate the extent of
-- the work, and a reader who typed 503 into their progress did not thereby correct
-- Penguin.
--
-- INTEGER, zero meaning "not known", which is the same encoding `series_index`
-- and `published_year` already use on this table. A book of zero pages is not a
-- thing, so no sentinel is being spent on a real value.

ALTER TABLE books ADD COLUMN subtitle  TEXT    NOT NULL DEFAULT '';
ALTER TABLE books ADD COLUMN publisher TEXT    NOT NULL DEFAULT '';
ALTER TABLE books ADD COLUMN pages     INTEGER NOT NULL DEFAULT 0;

-- ------------------------------------------------------------ staged_works
--
-- The staging queue holds a work between the upload and the approval, so a
-- column the queue does not have is a fact the import silently loses on the way
-- into the library — which is what happened to translator and editor until 0034
-- and to the languages until 0047. Same three columns, same defaults.
ALTER TABLE staged_works ADD COLUMN subtitle  TEXT    NOT NULL DEFAULT '';
ALTER TABLE staged_works ADD COLUMN publisher TEXT    NOT NULL DEFAULT '';
ALTER TABLE staged_works ADD COLUMN pages     INTEGER NOT NULL DEFAULT 0;
