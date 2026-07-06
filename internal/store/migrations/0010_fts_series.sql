-- 0010: index series names for search.
--   books.series / movies.series were added in 0006 but never wired into the
--   FTS tables, so a search for a franchise/reading-order name ("Malazan",
--   "Middle-earth") returned nothing. External-content FTS5 can't ALTER in a
--   new column, so rebuild books_fts and movies_fts with an extra `series`
--   column, re-point their sync triggers, and repopulate from the content
--   tables via the 'rebuild' command. annotations_fts / dialogues_fts are
--   untouched (no series there).
--
-- Dropping the virtual table also drops its shadow tables; recreating +
-- 'rebuild' re-derives the whole index from the content rows, so no data is
-- lost. NULL series columns index as empty — a book with no series simply has
-- nothing to match in that column.

-- ---- books_fts ----------------------------------------------------------
DROP TRIGGER IF EXISTS books_ai;
DROP TRIGGER IF EXISTS books_ad;
DROP TRIGGER IF EXISTS books_au;
DROP TABLE IF EXISTS books_fts;

CREATE VIRTUAL TABLE books_fts USING fts5(
  title, author, genre_text, series,
  content='books', content_rowid='id',
  tokenize='unicode61 remove_diacritics 2',
  prefix='2 3'
);

CREATE TRIGGER books_ai AFTER INSERT ON books BEGIN
  INSERT INTO books_fts(rowid, title, author, genre_text, series)
  VALUES (new.id, new.title, new.author, new.genre_text, new.series);
END;
CREATE TRIGGER books_ad AFTER DELETE ON books BEGIN
  INSERT INTO books_fts(books_fts, rowid, title, author, genre_text, series)
  VALUES ('delete', old.id, old.title, old.author, old.genre_text, old.series);
END;
CREATE TRIGGER books_au AFTER UPDATE ON books BEGIN
  INSERT INTO books_fts(books_fts, rowid, title, author, genre_text, series)
  VALUES ('delete', old.id, old.title, old.author, old.genre_text, old.series);
  INSERT INTO books_fts(rowid, title, author, genre_text, series)
  VALUES (new.id, new.title, new.author, new.genre_text, new.series);
END;

INSERT INTO books_fts(books_fts) VALUES ('rebuild');

-- ---- movies_fts ---------------------------------------------------------
DROP TRIGGER IF EXISTS movies_ai;
DROP TRIGGER IF EXISTS movies_ad;
DROP TRIGGER IF EXISTS movies_au;
DROP TABLE IF EXISTS movies_fts;

CREATE VIRTUAL TABLE movies_fts USING fts5(
  title, director, genre_text, series,
  content='movies', content_rowid='id',
  tokenize='unicode61 remove_diacritics 2',
  prefix='2 3'
);

CREATE TRIGGER movies_ai AFTER INSERT ON movies BEGIN
  INSERT INTO movies_fts(rowid, title, director, genre_text, series)
  VALUES (new.id, new.title, new.director, new.genre_text, new.series);
END;
CREATE TRIGGER movies_ad AFTER DELETE ON movies BEGIN
  INSERT INTO movies_fts(movies_fts, rowid, title, director, genre_text, series)
  VALUES ('delete', old.id, old.title, old.director, old.genre_text, old.series);
END;
CREATE TRIGGER movies_au AFTER UPDATE ON movies BEGIN
  INSERT INTO movies_fts(movies_fts, rowid, title, director, genre_text, series)
  VALUES ('delete', old.id, old.title, old.director, old.genre_text, old.series);
  INSERT INTO movies_fts(rowid, title, director, genre_text, series)
  VALUES (new.id, new.title, new.director, new.genre_text, new.series);
END;

INSERT INTO movies_fts(movies_fts) VALUES ('rebuild');
