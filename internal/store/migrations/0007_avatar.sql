-- 0007: per-user avatar image.
--   Stored exactly like covers/posters (in <DataDir>/MediaCover, a server-
--   generated hex name) and served through the existing GET /covers/{file}.
--   Empty string = no avatar; the UI falls back to the username initial.
ALTER TABLE users ADD COLUMN avatar_path TEXT NOT NULL DEFAULT '';
