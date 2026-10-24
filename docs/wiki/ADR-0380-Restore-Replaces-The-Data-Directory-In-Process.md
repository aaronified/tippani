# ADR-0380: Restore replaces the data directory in-process

Source of truth: this wiki page.

- **Area:** [§11 Backup, Restore and Recovery](ADR-Index.md#area-11)
- **Status:** Accepted
- **Version:** 0.8.2 and earlier

**Decided.** Restore extracts to a staging directory, validates, then closes the live database, moves every non-control top-level entry aside, moves the restored entries in, and reopens — migrate, integrity-check, FTS self-heal — all inside the running process. No Docker socket, no container recreation. The extraction carries hostile-archive guards: a 200,000-entry cap, an 8 GiB decompression-bomb cap, rejection of backslashes and colons in names, `path.Clean` plus an absolute prefix check against the staging root, and rejection of every entry type that is not a regular file or a directory, because a Tippani backup never contains a symlink or a device node. Exactly one `.pre-restore-<ts>` safety generation is kept; older ones are dropped after a successful swap. If the swap fails it rolls back, and if the *rollback* fails it exits 1 with the previous data's location in the log, for a clean boot. I approved the in-process design specifically to keep the socket out of the restore path.

**Instead of.** A restore that recreates the container, which would make the Docker socket a requirement rather than an opt-in.

<sub>0.8.2 and earlier — `internal/httpapi/backup_handlers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
