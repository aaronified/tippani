# Troubleshooting — Tippani error codes

Every handled error Tippani logs carries a stable code of the form
`TIP-<SUBSYS>-<NNN>` (for example `TIP-SRCH-002`). When something goes wrong,
find the code in `docker logs` and look it up here.

- Logs go to **both stdout and stderr**, so `docker logs <container>` shows them
  regardless of how the stream is captured.
- Lines are tagged: `[error]` (a failure), `[warn]` (recovered/degraded, worth
  knowing), `[trace]` (deep per-operation detail, only when
  `TIPPANI_LOG_LEVEL=debug`).
- Set `TIPPANI_LOG_LEVEL=debug` to turn on full per-operation tracing when you are
  hunting an intermittent problem; leave it unset for normal, quiet operation.

The codes are defined in `internal/olog/codes.go`; a build-time test keeps this
document and that registry in lockstep.

## HTTP

| Code | Meaning | Likely cause | What to do |
| --- | --- | --- | --- |
| `TIP-HTTP-000` | Unclassified internal server error (the generic 500 fallback). | A database, transaction, or encoding failure that has not yet been given a specific code. | Read the full `[error]` line — it includes the request method, path, and underlying cause. If it recurs, the handler should be given a specific code. |

## STORE — database lifecycle, integrity, repair

| Code | Meaning | Likely cause | What to do |
| --- | --- | --- | --- |
| `TIP-STORE-001` | SQLite `PRAGMA quick_check` could not run. | The database file is unreadable or the handle is broken. | Check the data volume is mounted and readable. Restart to re-run startup repair; if it persists, restore from backup. |
| `TIP-STORE-002` | `quick_check` found page-level corruption. | An unclean shutdown or an unreliable storage volume tore the file. | Startup attempts automatic recovery. Ensure the container stops gracefully (see below) and the volume honours fsync. If recovery fails, use Profile → Rebuild search index, then restore from backup as a last resort. |
| `TIP-STORE-003` | A full-text index could not be reconstructed in place. | The index shadow tables are too corrupt to drop and recreate. | Recovery escalates to a whole-database rebuild automatically. If that also fails (`TIP-STORE-004`), restore from backup. |
| `TIP-STORE-004` | Whole-database recovery (rebuild from intact content) failed. | Corruption has spread beyond the search indexes into base tables. | Restore from backup. Search stays unavailable until Profile → Reset all data or a restore. |
| `TIP-STORE-005` | WAL checkpoint on shutdown failed. | A reader still held the database as the server stopped. | Harmless — the WAL is valid and replays on the next start. If frequent, check for a stuck long-running request at shutdown. |
| `TIP-STORE-006` | Factory reset could not delete a database file. | The OS still held the file handle (common briefly on Windows). | The server reopens the existing database and reports the error; retry the reset. |

## SRCH — full-text search

| Code | Meaning | Likely cause | What to do |
| --- | --- | --- | --- |
| `TIP-SRCH-001` | A full-text search query failed at runtime. | The FTS index is corrupt or has drifted from its content table. | Tippani reconstructs the index and retries automatically within the same request. No action needed unless it is followed by `TIP-SRCH-002`. |
| `TIP-SRCH-002` | A corrupt FTS index could not be reconstructed while serving a search. | Page-level corruption too severe for an in-place rebuild. | Restart the server (startup repair escalates to a full recovery) or run Profile → Rebuild search index. Library data is never affected. |
| `TIP-SRCH-003` | A search result row failed to scan and was dropped. | A `SELECT` and its target struct drifted apart (usually a migration added a column). | Report it — the search query and its scan target need realigning. |

## List scanning — dropped rows

These all mean one row of a list/collection failed to scan and was skipped, so a
list came back mysteriously short (the class of bug the 0.6.4 favourites fix
exposed). The cause is almost always a `SELECT` that drifted from the Go struct it
scans into — usually a migration that added or reordered a column without updating
the query. The fix is to realign the query and the scan target; the log line names
the subsystem and the underlying error.

| Code | Subsystem |
| --- | --- |
| `TIP-ANNO-001` | Annotations list |
| `TIP-DLG-001` | Dialogues list |
| `TIP-BOOK-001` | Books list / count / tags |
| `TIP-MOVIE-001` | Movies list / count |
| `TIP-PEOPLE-001` | People list / names / orphan images |
| `TIP-REVIEW-001` | Quiz / practice candidate rows |
| `TIP-EXPORT-001` | Export rows |
| `TIP-BULK-001` | Bulk-selection id rows |
| `TIP-TAG-001` | Genres / tags list |
| `TIP-STATS-001` | Stats aggregate rows |
| `TIP-STICKER-001` | Stickers list |
| `TIP-ADMIN-001` | Admin user list |
| `TIP-META-001` | Metadata console / library rows |

## Metadata, covers, people, imports

| Code | Meaning | Likely cause | What to do |
| --- | --- | --- | --- |
| `TIP-META-002` | A metadata provider key or setting could not be read. | A `settings` read failed, so a lookup degrades to "unconfigured". | Check the database is healthy; re-save the key in Settings → metadata keys. |
| `TIP-META-010` | Genres failed to persist even though the request returned OK. | The genre write transaction failed to begin or commit. | Retry the edit. If it recurs, check for database corruption (`TIP-STORE-002`). |
| `TIP-COVER-001` | An on-demand cover/poster refetch failed. | The provider was unreachable or returned no image. | Retry later; manual cover upload still works. |
| `TIP-BOOK-002` | A book cover could not be fetched on create; the book was saved without one. | The cover URL was unreachable or blocked by the SSRF guard. | Add a cover later via the cover picker; the book itself saved fine. |
| `TIP-MOVIE-002` | A movie poster could not be fetched on create/update; saved without one. | The poster URL was unreachable or blocked. | Add a poster later; the movie saved fine. |
| `TIP-PEOPLE-010` | Garbage-collecting orphaned people rows/images failed. | A delete query failed after the parent row was removed. | Harmless to users; orphaned rows/images may accumulate. Investigate if disk grows. |
| `TIP-BOOK-003` | A user-supplied cover URL failed to fetch while editing a book; the save was rejected. | The URL doesn't point directly at an image, the host blocked/hotlink-protected the request, it exceeded 10 MB, or the fetch timed out/was refused (private-IP guard). | Read the full `[error]` line for the underlying cause; try a direct image link or upload the file instead. |
| `TIP-MOVIE-003` | A user-supplied poster URL failed to fetch while editing a movie; the save was rejected. | Same causes as `TIP-BOOK-003`. | Read the full `[error]` line for the underlying cause; try a direct image link or upload the file instead. |
| `TIP-PEOPLE-002` | A user-supplied person image URL failed to fetch; the save was rejected. | Same causes as `TIP-BOOK-003`. | Read the full `[error]` line for the underlying cause; try a direct image link or upload the file instead. |
| `TIP-META-011` | A provider lookup failed while previewing a re-verify; the item reported `fetch_failed`. | The source (Google Books / Open Library / Amazon / TMDB / TheTVDB) was unreachable, rejected the key, or is out of quota. | Retry later; check the key/quota in Settings → Metadata sources. The rest of the batch still previewed. |
| `TIP-META-012` | Writing an approved re-verify change failed for one item. | A database write failed mid-apply (or an id collided with another item's). | Read the full `[error]` line; retry the apply for that item. Other items in the batch were unaffected. |
| `TIP-META-013` | An approved cover/poster/portrait failed to download on re-verify apply. | The image URL was unreachable or blocked by the host allowlist. | The item's text fields were still applied; re-run the re-verify or set the image manually. |
