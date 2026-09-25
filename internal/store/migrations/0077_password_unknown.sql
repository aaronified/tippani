-- 0077 — whether anyone knows an account's password.
--
-- An account that single sign-on created gets a random password nobody was ever
-- shown, so the provider is its only way in. Unlinking it from the provider
-- would lock it out for good, and the server has to be able to refuse that —
-- which it cannot do from the hash alone. 1 from creation by SSO until a
-- password is set (the `passwd` command); 0 for every account made any other way.
ALTER TABLE users ADD COLUMN password_unknown INTEGER NOT NULL DEFAULT 0;
