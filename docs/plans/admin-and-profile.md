# Admin and Profile

Not built. Tasks, one per ask:

- [ ] Rename Settings › Server to Settings › Admin; keep `/settings/server` working as an alias.
- [ ] Move the "Users on this server" card from Profile to Admin.
- [ ] Show each user's SSO state on their row: linked or not (and the provider), how the account was made (password or SSO auto-create), and whether it has a password anyone knows.
- [ ] Add "Unlink SSO" to a user's row in Admin.
- [ ] Replace the command-line-only password reset with "Issue temporary password" on a user's row.
- [ ] End every session and device made before a person's first own password, when they set it.
- [ ] Tell the person when an admin resets their password (Pushover, if they have it set).
- [ ] Keep SSO linking on Profile.
- [ ] Add an SSO setup card to Admin: issuer, client ID, client secret, button name, scopes, auto-create, link-by-username, the callback URL to copy, and a Test button.
- [ ] Let a `TIPPANI_OIDC_*` variable still win over the card, shown as a locked "set by the environment" field.
- [ ] Make the client secret write-only in the card: replaceable, never shown back.
- [ ] Keep `TIPPANI_COOKIE_SECURE` and `TIPPANI_TRUSTED_PROXY` as environment variables only.
- [ ] Add an optional per-account "SSO only" switch in Admin, which can never be set on the last admin with a password.
- [ ] Never allow the admin's own password sign-in to be switched off from the app.
- [ ] Move API keys to Profile: each reader makes their own named keys, each reading only that reader's own library.
- [ ] Carry every existing widget key over as an API key, so dashboards keep working.
- [ ] Keep an API key to its scope (the widget for now); it never reaches the rest of the API.
- [ ] Show in Admin only how many API keys each account has: no names, no outputs.
- [ ] Keep the Devices card hidden; when it returns, it returns to Profile, with a monitoring-only list in Admin.
- [ ] Keep Notifications on Profile only.
- [ ] Move the Maintenance card (reindex, factory reset) from Profile to Admin.
- [ ] Reuse a cover, poster or portrait already on disk when the same image is needed again, instead of downloading or storing another copy.
- [ ] When these ship, update the placement entry in Design-decisions ("Where the three live") to say they are built.

Decided and kept as is: the whole-server backup stays sealed with the admin's own password, accepting that an admin who downloads it can read every library outside the app.
