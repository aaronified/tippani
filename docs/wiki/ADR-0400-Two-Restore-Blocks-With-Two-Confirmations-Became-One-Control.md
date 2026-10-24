# ADR-0400: Two restore blocks with two confirmations became one control

Source of truth: this wiki page.

- **Area:** [§11 Backup, Restore and Recovery](ADR-Index.md#area-11)
- **Status:** Accepted
- **Version:** 1.4.1

**Decided.** Restoring the archive kept on the server and restoring a file from another server were two blocks with two warning paragraphs and two typed confirmations, for one operation whose only real variable is where the file is. It is one control with a source picker now, and — the part that matters — it resolves what the chosen archive is *keyed with* before prompting, so a passphrase-sealed archive is never met with a password field. `backupMetaAt` reads the header and reports `key` as `none`, `account` (with the account name) or `passphrase` so the UI can ask for the right thing first. The backup warnings became one line each, in the dialog you are standing in when they apply, rather than three red paragraphs above the buttons: the consequences have not been softened, only moved to where a warning is actually read. I approved the consolidation and the resolve-before-prompt ordering.

**Instead of.** Keeping the two blocks and prompting for both credentials.

**Reversal.** Yes, of the two-block layout.

<sub>1.4.1 — `internal/httpapi/backup_handlers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
