-- UI surface (UI instructions §10; PLAN §7 note):
--   * per-user UI preferences (aesthetic/theme/accent) stored as one JSON blob
--   * tag colour + presentation style for the Tags page (managed vocabulary)
--   * app-wide settings table (settings-managed metadata API keys)

ALTER TABLE users ADD COLUMN preferences TEXT NOT NULL DEFAULT '{}';

ALTER TABLE tags ADD COLUMN color TEXT NOT NULL DEFAULT 'yellow'
  CHECK (color IN ('yellow','blue','pink','orange'));
ALTER TABLE tags ADD COLUMN style TEXT NOT NULL DEFAULT 'sticker'
  CHECK (style IN ('sticker','banner','flyout','tape','reel'));

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
