# ADR-0119: The read log became directly editable, but the open read stays out of reach — it is the consistency between status and log

Source of truth: this wiki page.

- **Area:** [§5 Works, Shelves and Reading History](ADR-Index.md#area-5)
- **Status:** Accepted
- **Version:** 1.7.4

**Decided.** `POST /books|movies/{id}/reads`, `PUT /reads/{id}` and `DELETE /reads/{id}` edit past reads. An `outcome` of `open` or `''` is refused with a message naming where the operation actually lives: "an in-progress read is set by the shelf status, not by editing history."

**Why.** Writing the log only as a side effect of a status change records what is happening now and is hopeless for what already happened — a book read three times over fifteen years had one row at best, and there was no way to say "I finished this in 2019" about anything already on the shelf. Then 1.7.2 made that log sort the Library, and a sort you cannot correct is worse than no sort. But the open row *is* the consistency between status and log: it exists exactly while the work is in progress. Deleting it would leave a book reading with nothing being read; closing it by hand would leave it finished and still on the in-progress shelf. Both are reachable already, through the status control.

**Instead of.** Full CRUD over every row including the open one — rejected as a way to manufacture states the shelf cannot draw.

**Approved.** I signed this off after 1.7.2 turned a mostly-empty table into something the shelf order depends on; the refusal on the open row is the part I approved most deliberately.

<sub>1.7.4 — `internal/httpapi/read_history_handlers.go` · `internal/httpapi/server.go` · `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
