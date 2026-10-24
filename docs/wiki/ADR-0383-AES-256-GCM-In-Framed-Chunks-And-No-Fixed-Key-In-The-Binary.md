# ADR-0383: AES-256-GCM in framed chunks, and no fixed key in the binary

Source of truth: this wiki page.

- **Area:** [§11 Backup, Restore and Recovery](ADR-Index.md#area-11)
- **Status:** Accepted
- **Version:** 1.4.1 (sealed), 1.4.2 (v2)

**Decided.** A backup archive is everything: every user's library, the password hashes, the metadata API keys. It left the server as a plain tar.gz until 1.4.1, which is fine while it sits in `<DataDir>/backups` and not fine the moment it is downloaded to a laptop, synced to a cloud drive, or mailed to yourself — which is exactly what a backup is for. So it is sealed: AES-256-GCM over 1 MiB plaintext frames, chosen so the per-frame 21 bytes of overhead is noise against a multi-hundred-megabyte archive while encrypting one frame never needs more than a couple of megabytes live, which matters inside an idle RSS of about 30 MB (it was ~25 MB when this was written). A single fixed key compiled into the binary was considered and rejected: this is an MIT-licensed repository, so that constant would be public, and "encrypted with a published key" is a claim that reads as protection while providing none. I rejected the fixed key on purpose and I want the rejection on the record, because it is the shortcut this feature invites.

**Instead of.** A compiled-in key; leaving archives plain.

**Reversal.** None, though the key derivation was rewritten within the hour (11.7).

<sub>1.4.1 (sealed), 1.4.2 (v2) — `internal/httpapi/backup_crypto.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
