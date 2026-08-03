-- Device tokens for native clients (the Android app under mobile/), plus the
-- updated_at columns books and movies never had.
--
-- Why a separate table from `sessions` rather than a flag on it: the two have
-- opposite lifetimes on purpose. A browser session slides on use and dies at an
-- absolute 90-day cap (auth.SessionMaxLifetime), and every session is revoked
-- when the password changes — both correct for a cookie a browser holds
-- ambiently. A paired device is the opposite: it lives until you revoke it from
-- Settings, and a password rotation must not silently unpair your phone with no
-- signal. Encoding that as a mode on one table would mean every session query
-- growing a "which kind is this" branch.

-- id, rather than token_hash, is the primary key: the Settings list revokes a
-- device by a stable handle, and that handle must not be the credential's hash.
CREATE TABLE device_tokens (
  id           INTEGER PRIMARY KEY,
  token_hash   TEXT NOT NULL UNIQUE,      -- sha256 of the bearer token; the raw token is never stored
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,             -- "Arani's Pixel" — shown in the Settings device list
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at TEXT                       -- NULL until first use; written at most hourly (PLAN §8)
);
CREATE INDEX idx_device_tokens_user ON device_tokens(user_id);

-- books/movies carried only created_at, while annotations/dialogues have had
-- updated_at since 0001/0003. A client reconciling a local mirror needs it on
-- all four. SQLite's ADD COLUMN rejects a non-constant default, so the column
-- arrives nullable and is backfilled to created_at — readers COALESCE anyway.
ALTER TABLE books ADD COLUMN updated_at TEXT;
UPDATE books SET updated_at = created_at WHERE updated_at IS NULL;

ALTER TABLE movies ADD COLUMN updated_at TEXT;
UPDATE movies SET updated_at = created_at WHERE updated_at IS NULL;

-- Dialogues never got the noted_at that 0008 gave annotations, so the date a
-- line was captured has nowhere to live. Harmless while every dialogue is typed
-- into the browser as it is added, but a capture made offline on Tuesday and
-- flushed on Friday would be dated Friday with no way to correct it. Left NULL
-- for existing rows — readers already fall back to created_at.
ALTER TABLE dialogues ADD COLUMN noted_at TEXT;

-- Nor a source, which annotations have carried since 0001. Without it the API
-- could accept "this line came from OCR" and would have nowhere to put it —
-- worse than not offering the field. Everything already in the table was typed
-- into the browser, so 'manual' is the honest backfill.
ALTER TABLE dialogues ADD COLUMN source TEXT NOT NULL DEFAULT 'manual';
