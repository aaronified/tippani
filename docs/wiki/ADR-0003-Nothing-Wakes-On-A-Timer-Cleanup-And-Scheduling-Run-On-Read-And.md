# ADR-0003: Nothing wakes on a timer — cleanup and scheduling run on read, and a job runs because somebody started it

Source of truth: this wiki page.

- **Area:** [§1 The Target Host, the Budgets, and the Scope They Fix](ADR-Index.md#area-1)
- **Status:** Accepted
- **Version:** pre-1.0; reworded 3.1.0

**Decided.** Nothing in the binary wakes up on its own. There is no `time.Ticker` anywhere outside tests, no poller, no cron and no scheduler. Expired sessions are deleted lazily inside `Sessions.Create`, and review scheduling is computed at query time. Three goroutines outlive the call that starts them: the listener in `main`, and in `internal/jobs` the queue's worker and the log's writer (shutdown's bounded waits aside, which end with the process). Each of those two is started by the call that hands it work — a press that queues a job, a line that needs writing — and exits when there is none. The clocks the binary does hold each bound a wait (a retry's backoff while SQLite's lock is held, shutdown's budget), and none of them starts anything.

**Why.** Idle CPU has to be approximately zero on a box with a hundred neighbours, and a timer is the one thing that cannot be. `Developing.md` states it as a rejection criterion: "If a change needs something to wake up on its own, that is a design discussion before it is a patch." A worker that exists only while a job waits costs nothing while nothing does, which is the property this line was drawn to protect; a worker that waited for work for the life of the process would not.

**Instead of.** A cleanup cron for expired sessions — rejected in the plan itself ("no cleanup cron"). Litestream for continuous backup — rejected for constant background CPU; nightly `VACUUM INTO` from the host's own cron is the answer instead, which is the user's timer and not mine. A pool of workers, or one worker parked on a channel from boot to shutdown, for the jobs (§18).

**Reversal.** Partly, in 3.1.0. This entry was *"No background jobs, pollers, tickers or cron — cleanup and scheduling run on read"*, and it said "the only goroutine in `main` is the listener". I asked for the routines a reader starts to run on the server, so that they survive leaving the screen, and reworded the invariant for it, verbatim: *"nothing runs unless a person or the app's own lookup started it, and nothing wakes on a timer."* So background jobs exist now. What did not come back is anything that wakes by itself.

**Approved.** I signed this off as a hard line rather than a default, which is why it appears in the contributing guide as grounds for rejecting a patch. The rewording is mine word for word, and it keeps the line where it was always drawn: at the clock.

<sub>pre-1.0; reworded 3.1.0 — `internal/auth/auth.go` · `internal/jobs/doc.go` · `docs/wiki/Design-decisions.md` · `Developing.md` · `README.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
