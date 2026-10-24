-- 0086 — WHERE IN THE BOOK A QUOTE SITS, KEPT BESIDE ITS CONTEXT.
--
-- An EPUB attached to a book is read once, at attach, and the match of each highlight is
-- stored (0084). The same read knows two more facts about where the match is, and they are
-- kept in the same row for the same reason the surroundings are: a proposed location is
-- then read from rows and opens no file (locators-from-files).
--
-- loc_pct is the percent of the book's text before the matched paragraph, 0 to 99, by the
-- rule internal/ebook pins (runes of the extracted paragraphs, end to end, floored). -1
-- means "no position": a cue, a plain text file, or a row stored before this migration —
-- NOT 0, which is a real answer (the first page of the book).
--
-- chapter_title is the name the book's own table of contents gives the chapter, '' when it
-- gives none. Neither is a page number or a Kindle location, and neither pretends to be:
-- they are a new, internally consistent unit that comes from THIS file.
ALTER TABLE source_context ADD COLUMN loc_pct       INTEGER NOT NULL DEFAULT -1;
ALTER TABLE source_context ADD COLUMN chapter_title TEXT    NOT NULL DEFAULT '';
