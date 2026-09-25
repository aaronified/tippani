-- 0076 — three ways the app reaches outside itself: single sign-on, a dashboard
-- widget, and Pushover.
--
-- oidc_subject IS `issuer|sub`, NOT THE USERNAME OR THE EMAIL. `sub` is the one
-- claim OpenID Connect promises is stable and unique within an issuer (Core 1.0
-- §5.7); preferred_username and email are both editable at most providers, so a
-- link keyed on either is a link somebody else can walk into by renaming
-- themselves. The issuer is part of the key so that pointing the app at a new
-- provider cannot collide with a `sub` the old one happened to issue.
-- NULL for every account that has never signed in that way; UNIQUE over the
-- non-NULL values, which is what SQLite's UNIQUE already means.
ALTER TABLE users ADD COLUMN oidc_subject TEXT;
CREATE UNIQUE INDEX idx_users_oidc_subject ON users(oidc_subject) WHERE oidc_subject IS NOT NULL;

-- A READ-ONLY KEY for a dashboard widget (gethomepage's Custom API widget and
-- anything shaped like it). Not a device token: a device token opens the whole
-- API, and a key pasted into a dashboard's YAML should open four numbers.
-- One per account, stored as a sha256 like every other credential here.
CREATE TABLE widget_keys (
  user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  key_hash   TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Pushover, per account. app_token is optional: empty falls back to the
-- operator's TIPPANI_PUSHOVER_TOKEN, so a household shares one Pushover
-- application and each reader brings only their own user key.
-- last_daily_day is the reviewer-local date the "deck is ready" message last
-- went out, so a cron entry that fires twice sends once.
CREATE TABLE notify_settings (
  user_id        INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  pushover_user  TEXT NOT NULL DEFAULT '',
  app_token      TEXT NOT NULL DEFAULT '',
  on_daily       INTEGER NOT NULL DEFAULT 1,
  on_import      INTEGER NOT NULL DEFAULT 1,
  on_fetch       INTEGER NOT NULL DEFAULT 1,
  on_backup      INTEGER NOT NULL DEFAULT 1,
  last_daily_day TEXT NOT NULL DEFAULT ''
);
