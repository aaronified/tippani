-- 0039 — fonts a reader uploaded.
--
-- Settings → Type offers three bundled faces per role. This is the fourth
-- option: bring your own. One row per uploaded file, and the file itself lives
-- beside the covers and stickers in <DataDir>/MediaCover, which is the directory
-- the backup already takes.
--
-- THE SERVER NEVER PARSES THE FILE. It checks the first four bytes against the
-- four font-container magics and stores the rest verbatim. Font parsers are a
-- famously bad attack surface, and the only thing that needs to read this file
-- is the browser that asked for it — which has a battle-tested parser and is
-- going to run it whatever this table says.
--
-- No role column, deliberately. A preference points at a font (`upload:12`), not
-- the other way round, so the same uploaded file can serve the quote face and
-- the note face without being stored twice. Deleting a font a preference still
-- names is safe by the same rule every other token is: the client falls back to
-- the built-in for anything it cannot resolve.
CREATE TABLE user_fonts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- What to call it in the picker. Taken from the filename and capped; a font's
  -- real family name is inside the file, and reading it would mean parsing.
  name       TEXT    NOT NULL DEFAULT '',
  -- The stored filename under MediaCover, like a cover or a sticker.
  path       TEXT    NOT NULL,
  -- woff2 | woff | otf | ttf — what the magic bytes said, so the file can be
  -- served with the right type without sniffing it again.
  format     TEXT    NOT NULL DEFAULT '',
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_user_fonts_user ON user_fonts(user_id);
