-- Tippani schema v1 (see docs/PLAN.md §3–4)

CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,           -- sha256 of the cookie token
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_sessions_expiry ON sessions(expires_at);

CREATE TABLE books (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  author TEXT,
  isbn TEXT,                             -- normalized ISBN-13, no hyphens
  asin TEXT,
  cover_path TEXT,                       -- local file under data/covers/
  description TEXT,
  published_year INTEGER,
  google_id TEXT,
  openlibrary_id TEXT,
  genre_text TEXT NOT NULL DEFAULT '',   -- denormalized, space-joined genre names (FTS input)
  source_metadata TEXT,                  -- raw API payloads (json)
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX idx_books_user_isbn ON books(user_id, isbn) WHERE isbn IS NOT NULL;
CREATE UNIQUE INDEX idx_books_user_asin ON books(user_id, asin) WHERE asin IS NOT NULL;

CREATE TABLE genres (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  UNIQUE(user_id, name)
);

CREATE TABLE book_genres (
  book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  genre_id INTEGER NOT NULL REFERENCES genres(id) ON DELETE CASCADE,
  PRIMARY KEY (book_id, genre_id)
);
CREATE INDEX idx_bg_genre ON book_genres(genre_id, book_id);

CREATE TABLE annotations (
  id INTEGER PRIMARY KEY,
  book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  quote TEXT,
  note TEXT,
  color TEXT NOT NULL DEFAULT 'yellow'
    CHECK (color IN ('yellow','blue','pink','orange')),
  chapter TEXT,
  location TEXT,                         -- free text page/loc/%; NOT part of dedupe
  source TEXT NOT NULL CHECK (source IN ('manual','md','kindle_clippings','bookcision')),
  dedupe_hash TEXT NOT NULL,             -- sha256(lower(collapse_ws(coalesce(quote, note))))
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (quote IS NOT NULL OR note IS NOT NULL),
  UNIQUE (book_id, dedupe_hash)
);
CREATE INDEX idx_ann_book ON annotations(book_id);

CREATE TABLE tags (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  UNIQUE(user_id, name)
);

CREATE TABLE annotation_tags (
  annotation_id INTEGER NOT NULL REFERENCES annotations(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (annotation_id, tag_id)
);
CREATE INDEX idx_at_tag ON annotation_tags(tag_id, annotation_id);

-- Full-text search: external-content FTS5 tables + sync triggers (PLAN §4)

CREATE VIRTUAL TABLE books_fts USING fts5(
  title, author, genre_text,
  content='books', content_rowid='id',
  tokenize='unicode61 remove_diacritics 2',
  prefix='2 3'
);

CREATE TRIGGER books_ai AFTER INSERT ON books BEGIN
  INSERT INTO books_fts(rowid, title, author, genre_text)
  VALUES (new.id, new.title, new.author, new.genre_text);
END;
CREATE TRIGGER books_ad AFTER DELETE ON books BEGIN
  INSERT INTO books_fts(books_fts, rowid, title, author, genre_text)
  VALUES ('delete', old.id, old.title, old.author, old.genre_text);
END;
CREATE TRIGGER books_au AFTER UPDATE ON books BEGIN
  INSERT INTO books_fts(books_fts, rowid, title, author, genre_text)
  VALUES ('delete', old.id, old.title, old.author, old.genre_text);
  INSERT INTO books_fts(rowid, title, author, genre_text)
  VALUES (new.id, new.title, new.author, new.genre_text);
END;

CREATE VIRTUAL TABLE annotations_fts USING fts5(
  quote, note,
  content='annotations', content_rowid='id',
  tokenize='unicode61 remove_diacritics 2',
  prefix='2 3'
);

CREATE TRIGGER annotations_ai AFTER INSERT ON annotations BEGIN
  INSERT INTO annotations_fts(rowid, quote, note)
  VALUES (new.id, new.quote, new.note);
END;
CREATE TRIGGER annotations_ad AFTER DELETE ON annotations BEGIN
  INSERT INTO annotations_fts(annotations_fts, rowid, quote, note)
  VALUES ('delete', old.id, old.quote, old.note);
END;
CREATE TRIGGER annotations_au AFTER UPDATE ON annotations BEGIN
  INSERT INTO annotations_fts(annotations_fts, rowid, quote, note)
  VALUES ('delete', old.id, old.quote, old.note);
  INSERT INTO annotations_fts(rowid, quote, note)
  VALUES (new.id, new.quote, new.note);
END;
