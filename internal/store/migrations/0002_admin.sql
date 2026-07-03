-- Add an admin flag. The first user (via first-run onboarding or the CLI when
-- the table is empty) becomes the admin; the admin manages other users in-app.
ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0;
