# ADR-0780: An export is what the filters select, in a fence nothing inside can close, read in batches

Source of truth: this wiki page.

- **Area:** [§18 Jobs and Logs](ADR-Index.md#area-18)
- **Status:** Accepted
- **Version:** 3.1.0

**Decided.** A job's `log.md` and the system log's `logs.md` are Markdown: a heading (a job's English title, in a code span), a line naming the version, the export time in UTC and the filters, or "everything kept, 30 days", and then the lines in one fenced block whose fence is longer than any run of backticks in them, measured over exactly the lines written. "What is shown" is every line the filters select, oldest first, not the page on screen, over the window the list was read over. That window is the server's: the card asks for its range as a length of time (`since`), which the server ends at its own now, and the list's answer names the window it read, its start and its newest line (`from` and `upto`), which the next page and "What is shown" send back. A window that ends before it starts is refused. The lines are read 2,000 at a time by id, each batch closed before any of it is written, and the write deadline moves a minute ahead with every 64 KB the client takes. A restore or reset between two batches ends the export with a line saying so.

**Why.** An export is the file somebody is handed to read a failure from, so it has to survive whatever text a line holds and a client that reads slowly. A cursor held open while writing to a phone that had gone to sleep held one of the library's four connections, and its snapshot, with no limit.

**Instead of.** Spooling the export to a file in the data directory, which needs a month of request lines' worth of disk for every export at once. Exporting the page on screen. A window from the browser's clock, which is what the card first sent: `from` and `to` from the browser's now. A browser whose clock ran behind the server's exported a file that ended before the newest lines, the ones somebody exports a log for, and the journey tier's browser, its clock fixed at 2026-01-01, was handed a file with none of the lines on its card. A line id cannot be skewed, so that is where "What is shown" ends.

<sub>3.1.0 — `internal/httpapi/jobs_markdown.go` · `internal/httpapi/jobs_handlers.go` · `internal/httpapi/logs_handlers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
