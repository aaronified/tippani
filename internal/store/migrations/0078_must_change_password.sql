-- 0078 — a password somebody else chose is temporary.
--
-- When an admin makes an account or resets a password, the admin knows that
-- password, and so the account is not yet its owner's alone. 1 until the owner
-- picks their own through POST /auth/password; until then the session can do
-- nothing else. 0 for every account whose password its owner chose.
ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0;
