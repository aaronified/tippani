# ADR-0394: Truncation is caught by the absence of a final frame

Source of truth: this wiki page.

- **Area:** [§11 Backup, Restore and Recovery](ADR-Index.md#area-11)
- **Status:** Accepted
- **Version:** 1.4.2

**Decided.** Each frame carries a `final` byte, and the frames' additional data is the whole header plus the frame's counter and its final flag. Re-ordering frames breaks the counter, splicing frames from another archive breaks the salt binding, editing the header — swapping the account label, stripping `recWrap` to force a password prompt — breaks every frame, and flipping a final flag breaks that frame. A stream that ends without a frame marked final is an error, not a short read. That is the failure mode that matters most here, because a backup silently missing its tail looks like a backup: right name, plausible size, opens far enough to look fine. `writeBackupArchive` checks every `Close` in order, and `enc.Close()` is the one that matters most, because it writes the final frame. I approved the design around that single sentence.

**Instead of.** A trailing length or checksum, which is another thing a truncation can remove.

<sub>1.4.2 — `internal/httpapi/backup_crypto.go` · `internal/httpapi/backup_handlers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
