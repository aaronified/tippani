-- 0011: uploaded stickers. A user's library of transparent PNG/SVG images,
-- managed in the Tags tab, one attachable to each annotation/dialogue — the
-- real sticker feature, replacing the old tag-derived wax seal (which was only
-- ever a CSS stand-in). Image files live in <DataDir>/MediaCover alongside
-- covers/posters (same StoreImage pipeline); `path` is the stored filename.
--
-- annotations.sticker_id / dialogues.sticker_id reference a sticker with
-- ON DELETE SET NULL: deleting a sticker just clears the seal from the quotes
-- that used it, the quotes themselves survive. The existing sticker_x/sticker_y
-- (0009) keep positioning it. FK-neutral for FTS (triggers only touch
-- quote/note), so plain ADD COLUMN. ADD COLUMN with a REFERENCES clause is
-- allowed because the column defaults to NULL.

CREATE TABLE stickers (
  id         INTEGER PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL DEFAULT '',
  path       TEXT NOT NULL,                         -- filename under MediaCover/
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_stickers_user ON stickers(user_id);

ALTER TABLE annotations ADD COLUMN sticker_id INTEGER REFERENCES stickers(id) ON DELETE SET NULL;
ALTER TABLE dialogues   ADD COLUMN sticker_id INTEGER REFERENCES stickers(id) ON DELETE SET NULL;
