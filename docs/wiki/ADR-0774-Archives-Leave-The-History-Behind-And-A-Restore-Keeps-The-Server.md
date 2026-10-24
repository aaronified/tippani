# ADR-0774: Archives leave the history behind, and a restore keeps the server's own

Source of truth: this wiki page.

- **Area:** [§18 Jobs and Logs](ADR-Index.md#area-18)
- **Status:** Accepted
- **Version:** 3.1.0

**Decided.** Every archive is stripped — the kept backup, the API's, and the safety copy a restore or reset insists on: after `VACUUM INTO`, `StripJournal` empties the three tables on a private handle, writes the snapshot again with `VACUUM INTO` a sibling file and renames that over it, so no deleted row survives in a free page. A restore carries the replaced server's history into the restored file (`CarryJournal`, the swap's last step, with the log writer held off): the three tables copied with their ids, a job's owner kept only when the restored accounts hold that id under the name the job was started with or under the name the account had on the server being replaced, a running or waiting job marked interrupted, and the id counter it leaves kept as the mark where the carried jobs end (*A job a restore carried over is its history, and nothing acts on it again*). A carry that fails logs `TIP-BACKUP-009` and the restore goes ahead with no history; a strip that fails fails the backup (`TIP-BACKUP-008`). A factory reset takes the history with everything else, and the reset's own job is the only row of the empty file.

**Why.** The history belongs to the server, not to the library. A million request lines would be most of a small library's archive, and a restore that brought back an older history would reuse job ids that the queue, the log writer and a reader's open screens are still using.

**Instead of.** `secure_delete`, which overwrites the deleted cells and keeps their pages, so the archive would carry the full size of the log it had just emptied. A plain `VACUUM` in place, which needs a writable temp directory and two to three times the snapshot's size.

<sub>3.1.0 — `internal/store/journal.go` · `internal/store/swap.go` · `internal/httpapi/backup_handlers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
