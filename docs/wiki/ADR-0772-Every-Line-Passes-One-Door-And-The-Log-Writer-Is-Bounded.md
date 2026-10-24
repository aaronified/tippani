# ADR-0772: Every line passes one door, and the log writer is bounded

Source of truth: this wiki page.

- **Area:** [§18 Jobs and Logs](ADR-Index.md#area-18)
- **Status:** Accepted
- **Version:** 3.1.0

**Decided.** Every line, subject, error and string count passes one door, `clean`, before it is kept: CR and LF become `⏎`, control characters and escape sequences go, invalid UTF-8 becomes U+FFFD, every URL in it goes through `outbound.RedactText`, and it is cut at 2 KB for a request or file line and 8 KB for anything else, ending "… N bytes cut". Redaction runs before the cut, so the count is true. The buffer holds 8 MB and 16,384 lines; when it is full, the oldest line of the lowest class below the newcomer's goes — request, file and trace lines first, then info — while job lines, in-request jobs, warnings and errors stay until only they fill it, and the next batch says how many were not kept (`TIP-LOG-003`). Batches of 500 are written one transaction each on the log connection; a batch that meets a held lock is kept and retried, 50 ms doubling to 2 s, six times. `Flush` waits until every line logged before it is written, not until the buffer is empty, which under a steady stream of requests never happens. **The prune rides the writer**: 2,000 rows a chunk, each chunk its own transaction, on the first write after start and a write an hour after the last prune, whenever the tab's first read asks, and one chunk every four batches while lines keep coming, because under a flood the buffer never empties and a prune that waited for a quiet moment would never run.

**Why.** One door is the only shape that makes "no key in the log" checkable: the gate's line, a provider's error text, a people fetch's first error, a request's subject and every `olog` line pass it, and whatever arrives next will too. The bounds are the log's answer to a burst it cannot keep up with — a crawler, a script, many readers at once — and the drop order keeps the lines somebody opens a log to read.

**Instead of.** A writer per caller, which puts a database write, and a disk wait, on every request's path. A flusher on a ticker, which the invariant forbids. A prune per line written, which is a `DELETE` for every line kept.

<sub>3.1.0 — `internal/jobs/clean.go` · `internal/jobs/logbook.go` · `internal/jobs/prune.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
