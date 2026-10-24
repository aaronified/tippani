# ADR-0781: The screen polls while it is open, and the server never does

Source of truth: this wiki page.

- **Area:** [§18 Jobs and Logs](ADR-Index.md#area-18)
- **Status:** Accepted
- **Version:** 3.1.0

**Decided.** A job's own view polls `GET /jobs/{id}?log_after=` every second while the job lives, every three seconds after ten polls that brought nothing, and not at all while the tab is hidden; Current jobs polls every 2 s while anything is current and every 10 s otherwise. Each of those reads gives up after ten seconds, so one answer that never comes cannot freeze a card. Current jobs is the whole queue in one answer, never paged, which it can be because an account has at most five jobs waiting or running. A Stop hurries them: from the server's answer to the press, the current jobs, the Common jobs card's rows, and the stopped job's own view where a screen has it open, are asked for every 200 ms until the job reads stopped, for three seconds at most, and then at their own pace again. Wherever the Stop was pressed, every one of those that draws the job hurries, and each of the job's rows says Stopping… from the press, so one job reads the same on both cards that draw it. They are the reads the log does not keep.

**Why.** It is the reader's screen asking while the reader is looking, which is §1's rule read the way it was meant: nothing on the server wakes, and a closed tab asks nothing.

<sub>3.1.0 — `web/frontend/src/jobs.js` · `web/frontend/src/jobsSection.jsx` · `web/frontend/src/commonJobs.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
