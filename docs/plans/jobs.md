# Jobs and logs

**Not built.** This is a brief for the planning agent, written at the owner's request
(*"Write a plan first"*) rather than designed here. The asks are quoted exactly; the
facts about the codebase below were checked at the lines cited; the open questions at the
end are the planning agent's to design, not answered here.

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
| Current jobs | routines a reader started that are still running, each expandable to its live log |
| Past jobs | the last 30 days: state (succeeded / failed), details, and "export logs" |
| System logs | everything the server logs, with a level chooser and a Markdown export |

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

## Open questions for the planning agent

1. **Where a started routine runs.** Server-side (the routine becomes a request that
   returns a job id and keeps going), which changes the invariant's wording; or held in
   the app shell rather than the screen, which keeps it but still dies with the tab. The
   owner's ask 1 says "continue in the background", which only the first satisfies across
   a closed tab. A restart mid-job needs a stated outcome (marked interrupted, or resumed).
2. **Which routines are jobs.** The bulk fetches and re-verifies are; ask 2 adds the
   automatic ones ("looking up a book details"). Each needs listing, with what its log
   records.
3. **The log's grain.** Ask 3 wants every outbound lookup AND every inbound read or write.
   Inbound reads are every request the SPA makes; the plan has to say whether all of them
   are logged, only those inside a job, or all of them in System logs and only a job's own
   in its card. Volume on a real library is the constraint.
4. **Retention without a ticker.** 30 days, pruned lazily (on opening the tab, or on the
   next job's write), the way the existing retention settings are.
5. **Per-user isolation.** A job belongs to the user who started it (every query scoped
   by `user_id`). System logs are instance-wide and so admin-only.
6. **Export format.** Markdown, per the owner, for both a job's log and the system log.
