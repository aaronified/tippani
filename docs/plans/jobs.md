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

The owner's answers, 27 September, each a task:

- [ ] The invariant's new wording is the sentence above, verbatim: *"nothing runs unless a
      person or the app's own lookup started it, and nothing wakes on a timer."*
- [ ] One job runs at a time across the server. The rest queue in the order started, and a
      waiting job says it is waiting.
- [ ] Single manual lookups (a title search in Add, the cover picker) run in their request,
      as fast as today and never queued behind a bulk run, and each is still recorded as a
      job with its log.
- [ ] A Stop button on a running job. It stops after the item in hand, and the job is kept
      as stopped, with its log, and can be rerun.
- [ ] Ship as 3.1.0.

The owner's asks when 3.1.0 started, 27 September, each a task:

- [ ] Two hooks feed the logs: one in the outbound gate (`internal/outbound`), one in the
      request logger.
- [ ] System logs are written on their own database connection at `synchronous=NORMAL`, so
      logging every request costs no disk sync.
- [ ] Jobs is a tab on a desk and a tile on the phone's Settings index, like the other
      sections. The phone tile holds one red Stop all button, with a confirmation, and a
      count of queued jobs.
