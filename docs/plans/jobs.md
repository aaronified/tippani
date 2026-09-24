# Jobs and logs

Not built. Tables, endpoints and screen layout are decided during implementation. Tasks, one
per ask:

- [ ] Run every routine a reader starts on the server, so it survives leaving the screen or closing the tab.
- [ ] Reword the CLAUDE.md invariant "no goroutine outlives its request": nothing runs unless a person or the app's own lookup started it, and nothing wakes on a timer.
- [ ] Make a job of every time the app looks outward: bulk fetches and re-verify, imports and backups, automatic lookups, and single manual lookups.
- [ ] Give every job its own detailed log: what was searched, where, and every outbound request, grouped by job.
- [ ] Mark a job still running at boot as interrupted, keep its log, and offer a one-press rerun.
- [ ] Add a Settings › Jobs tab.
- [ ] Current jobs: one expandable card, each job showing its live log.
- [ ] Past jobs: a second card with state (succeeded, failed, interrupted), details, and log export.
- [ ] System logs: a separate card holding the app's own logs (every level, including the request lines for inbound reads and writes), kept across restarts.
- [ ] Filter system logs by level, time range and keyword.
- [ ] Export as Markdown both ways: exactly what the filters show, or everything retained.
- [ ] Keep 30 days of jobs and logs, pruned when a job or log line is written and when the tab opens, with no timer.
- [ ] Store jobs, job logs and system logs in the app's SQLite database; stdout and stderr keep working for `docker logs`.
- [ ] Users see their own jobs; an admin sees every user's jobs and the system logs.
