# ADR-0775: A job a restore carried over is its history, and nothing acts on it again

Source of truth: this wiki page.

- **Area:** [§18 Jobs and Logs](ADR-Index.md#area-18)
- **Status:** Accepted
- **Version:** 3.1.0, corrected after its release

**Decided.** The carry-over marks where the carried jobs end. It keeps the id counter it leaves in the restored file's settings (`jobs.carried_through`), and every job at or below that number came over from the server the restore replaced. Such a job reads as it did: its row, its log, its counts, its export, and `carried` on the wire. Nothing acts on it again. Past jobs offers it no Run again, and `POST /jobs/{id}/rerun` answers 409, whatever its kind. A re-verify's findings are not reviewed: `GET /jobs/{id}/result` answers 409, Past jobs offers no Review, and no apply may name the check as the one it came from. An import stopped or interrupted before the restore lets go of its upload at the sweep that follows the restore. The Common jobs card is untouched, because its rows send params of their own that name no rows, so Run there starts the job over the restored library as any press does. A recovery copies the mark with the rest of the file, and a factory reset starts with none.

**Why.** A carried job's params name rows by id: the works a fill was given, the records a people fetch was given, the rows an apply writes, the staged quotes and the batch bound an approval took. In the restored library the same ids can be other rows. Run again on a carried fill filled works nobody chose. Run again on a stopped approval approved every batch staged at or below its bound, and in the restored file those are the batches the archive holds, not the ones the reader looked at. A review read every field of the work its finding names as the restored library has it, ticked the fields both had left empty, and its apply wrote one work's findings into another. The imports rater found the approval half, and each of the other kinds was checked against it one by one: fill, covers, people, reverify, reverify-apply, backup, import and import.approve. A covers pass, a backup, an import and the library-wide fill and people fetch name no rows. They are held to the same rule so that one rule answers for every kind, including the next one, and each can be started again from the Common jobs card or from the screen that started it.

**Instead of.** A column on each row saying the job was carried, which is a migration (0079 is shipped) to hold what one number already says, since the carry keeps ids and the counter. A rule per kind, reading its params to decide whether they name rows, which is a list the next kind has to remember to join. Rewriting a carried job's params, which are the job's record of what it was asked. Offering the review and refusing it when pressed, which is a press that can only say no.

<sub>3.1.0, corrected after its release — `internal/store/journal.go` · `internal/jobs/runner.go` · `internal/httpapi/jobs_handlers.go` · `internal/httpapi/jobs_kinds.go` · `internal/httpapi/import_queue.go` · `web/frontend/src/jobsSection.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
