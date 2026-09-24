# Jobs and logs

**Not built.** This is a brief for the planning agent, written at the owner's request
(*"Write a plan first"*) rather than designed here. The asks are quoted exactly; the
facts about the codebase below were checked at the lines cited. The questions it first left
open were put to the owner and are closed under **Decided** at the end, each with the
owner's answer; what is left for the planning agent is the design, not the choices.

## The asks, in the owner's words

1. *"when i fetch in one screen and then move to another, the older fetch dies silently.
   it should continue in the background. all jobs should run in background when started.
   maybe add a jobs tab in settings. that will show the current jobs in one expandable
   card, and all older jobs in another along with their state details (success / fail /
   export logs). all jobs should have their own logs (detailed, like what was searched,
   where, etc.)."*
2. *"job history to be saved for 30 days. auto jobs, if any, like looking up a book
   details will also be part of jobs."*
3. *"logs shall have each outbound ping / lookup, as well as each inbound write or read"*
4. Asked whether this meant background jobs against the rule below: *"this is not about
   background jobs, per se, but about long routines that the user start, those should be
   able to run in the background. this is is for that. also all outbound requests will be
   logged here, grouped by jobs. add system logs here as well, in a separate card. this
   will have all the system logs, with user able to choose the level and export them as
   markdown."*

So the shape is **Settings › Jobs**, with three cards:

| card | holds |
|---|---|
| Current jobs | routines a reader started, and the app's own outward lookups, still running; each expandable to its live log |
| Past jobs | the last 30 days: state (succeeded / failed), details, and "export logs" |
| System logs (admin only) | the app's logs for the last 30 days, surviving restarts, filtered by level, time and keyword, exported as Markdown |

## What exists today (checked)

- **A fetch is driven by the browser.** The bulk fetch on People (`fetchMissing` in
  `web/frontend/src/MetadataPage.jsx`, a `runPooled` over the missing rows) and re-verify's
  apply step (`ReverifyReview.jsx`, posting `/metadata/reverify/apply` in chunks) loop
  request by request inside a component, so unmounting it, which leaving the screen does,
  ends the loop. The server never learns a routine was abandoned. That is the "dies silently".
- **The invariant this touches.** CLAUDE.md, Invariants: *"No goroutine outlives its
  request — no worker pool, ticker, or scheduler; adding one is a design discussion
  first."* `Design-decisions.md` records why (no wakeups on an idle box; `30 days`
  retention elsewhere is swept lazily on read, not by a ticker). The owner's ask 4 is that
  discussion's starting point: routines the reader STARTS must be able to outlive the
  screen, and nothing needs to wake up on its own.
- **Every outbound call already passes one choke point.** `internal/outbound` (`Transport`,
  the `gate` RoundTripper) is what makes `TIPPANI_OFFLINE` real, and
  `TestEveryOutboundClientCarriesTheGate` fails on a client that bypasses it. It is the
  natural place to record ask 3's outbound half, per job.
- **System logs are stdout/stderr only.** `internal/olog` writes lines with a level
  (error/warn/info always, trace behind `TIPPANI_LOG_LEVEL=debug`) and a `TIP-*` code, and
  keeps nothing in memory or on disk. A System logs card needs a retained copy.

## Decided

The owner answered each open question. Where they chose an offered option it is named;
where they answered in their own words, the words are quoted.

1. **Where a started routine runs: on the server.** Starting a routine returns a job id
   and the server carries it to the end, whatever the browser does. The CLAUDE.md
   invariant *"No goroutine outlives its request"* is reworded, not dropped: nothing runs
   unless a person or the app's own lookup started it, and nothing wakes on a timer. The
   rewording ships in the same change as the runner.
2. **A restart mid-job: marked interrupted.** On boot, a job left running is marked
   *interrupted* with its log kept, and can be rerun with one press. Nothing resumes on
   its own.
3. **Which routines are jobs: every time the app looks outward.** The owner's words:
   *"everytime the app looks outward."* That covers, and they ticked all four:
   - bulk fetches and re-verify (fetch-missing, re-verify and fill-empty, Test every
     source, bulk cover and poster lookups);
   - imports and backups (staging, making a backup, restoring one);
   - automatic lookups the app makes on its own, e.g. a book's details when it is added;
   - single manual lookups, one press on one row, each a small job with its own log.

   `internal/outbound` is the one place every outward call passes, so it is where a call
   is attached to its job.
4. **Logs are the app's logs, kept 30 days and made easy to reach.** The owner's words:
   *"logs are different. they will be the app logs. a screen will make them easy to
   access and export as needed with proper level, time, & keyword filtering enabled. and
   will also contain all logs for the last 30 days. right now logs are kinda hard to get
   after the server restarts."* So the System logs card is `olog`'s output (every level,
   including the per-request lines the server already writes), retained across restarts,
   with filters for level, time range and keyword. Inbound reads and writes reach it as
   the app's own request log lines. They are not a separate job-log stream.
5. **Who sees what: users see their own jobs, and an admin sees every user's jobs as well
   as the system logs.** Every job query is scoped by `user_id` except an admin's.
   System logs hold every user's requests and server internals, so they are admin-only.
6. **Retention: pruned on write and on open.** Anything older than 30 days is deleted
   when a job or log line is written and when the Jobs tab opens. There is no timer. A
   box that sat off for a month loses its old rows on its first activity.
7. **Store: the app's SQLite database.** Jobs, job logs and system logs are tables in the
   existing database, so filtering is a query and backups already cover them. stdout and
   stderr keep working as they do now, for `docker logs`.
8. **Export: Markdown, both ways.** The owner chose both options offered: export exactly
   what the current filters show (level, time range, keyword), with the filters and range
   in a header; and export everything retained (the full 30 days) regardless of filters.
   A job's export is its own log, grouped by step.
