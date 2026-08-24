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
| `TIP-HTTP-001` | The TLS certificate/key pair changed on disk but failed to re-load; the previous pair is still served. | A renewal wrote a malformed file, or wrote the cert and key non-atomically (Tippani retries once the second file lands). | Check `TIPPANI_TLS_CERT`/`TIPPANI_TLS_KEY` point at a matching PEM pair. HTTPS keeps working on the old certificate until it expires, so fix the files and the next handshake picks them up — no restart needed. |

## UPDATE — in-app self-update

| Code | Meaning | Likely cause | What to do |
| --- | --- | --- | --- |
| `TIP-UPDATE-001` | A Docker Engine API call failed during self-update (identify self, pull the image, or launch the recreater). | The socket/proxy lacks a needed permission (a socket proxy must allow `CONTAINERS=1`, `IMAGES=1`, `POST=1`), the registry was unreachable, or the container name could not be resolved. | Read the `[error]` line for the Engine's status and message. For a socket proxy, verify the permission env vars on the proxy container; for the raw socket, verify the mount and the `group_add` gid. The guided manual command in Settings always works meanwhile. |

## STORE — database lifecycle, integrity, repair

| Code | Meaning | Likely cause | What to do |
| --- | --- | --- | --- |
| `TIP-STORE-001` | SQLite `PRAGMA quick_check` could not run. | The database file is unreadable or the handle is broken. | Check the data volume is mounted and readable. Restart to re-run startup repair; if it persists, restore from backup. |
| `TIP-STORE-002` | `quick_check` found page-level corruption. | An unclean shutdown or an unreliable storage volume tore the file. | Startup attempts automatic recovery. Ensure the container stops gracefully (see below) and the volume honours fsync. If recovery fails, use Profile → Rebuild search index, then restore from backup as a last resort. |
| `TIP-STORE-003` | A full-text index could not be reconstructed in place. | The index shadow tables are too corrupt to drop and recreate. | Recovery escalates to a whole-database rebuild automatically. If that also fails (`TIP-STORE-004`), restore from backup. |
| `TIP-STORE-004` | Whole-database recovery (rebuild from intact content) failed. | Corruption has spread beyond the search indexes into base tables. | Restore from backup. Search stays unavailable until Profile → Reset all data or a restore. |
| `TIP-STORE-005` | WAL checkpoint on shutdown failed. | A reader still held the database as the server stopped. | Harmless — the WAL is valid and replays on the next start. If frequent, check for a stuck long-running request at shutdown. |
| `TIP-STORE-006` | Factory reset could not delete a database file. | The OS still held the file handle (common briefly on Windows). | The server reopens the existing database and reports the error; retry the reset. |
| `TIP-STORE-007` | A one-time upgrade pass failed and was skipped. | A pass is the third kind of database change — once per database, on an instance that already existed, because a release changed what something means (`internal/store/onetime.go`). It runs from `Migrate()`, where a returned error would stop the app from starting, so a failure is logged instead. The commonest cause is the pass's own query meeting data it did not expect. | The app boots normally and the pass is left **unrecorded**, so the next start tries it again — which means this line repeats on every boot until it succeeds or the pass is removed. What is lost is whatever that pass does; for the 2.2.0 pass that is one advisory notice in Settings → Metadata sources, and nothing else. |

## SRCH — full-text search

| Code | Meaning | Likely cause | What to do |
| --- | --- | --- | --- |
| `TIP-SRCH-001` | A full-text search query failed at runtime. | The FTS index is corrupt or has drifted from its content table. | Tippani reconstructs the index and retries automatically within the same request. No action needed unless it is followed by `TIP-SRCH-002`. |
| `TIP-SRCH-002` | A corrupt FTS index could not be reconstructed while serving a search. | Page-level corruption too severe for an in-place rebuild. | Restart the server (startup repair escalates to a full recovery) or run Profile → Rebuild search index. Library data is never affected. |
| `TIP-SRCH-003` | A search result row failed to scan and was dropped. | A `SELECT` and its target struct drifted apart (usually a migration added a column). | Report it — the search query and its scan target need realigning. |
| `TIP-SRCH-004` | A fuzzy-search vocabulary read failed; typo correction was skipped. | A corrupt FTS index that also failed its one-shot repair, or the `0016` fts5vocab migration did not apply. | Run Profile → Rebuild search index or restart. Exact search still works; only the zero-hit typo-correction pass was skipped. If it persists, check for `TIP-SRCH-002`. |

## LOCALE — the languages in data/Locales

| Code | Meaning | Likely cause | What to do |
| --- | --- | --- | --- |
| `TIP-LOCALE-001` | Two files in `data/Locales` resolve to the same language code; only one is loaded. | The language code is the file name with the extension removed, lower-cased — so `FR.txt` and `fr.txt` are both `fr`, as are `fr .txt` and `fr.TXT`. Only possible on a case-sensitive filesystem (Linux); Windows and macOS refuse the second file themselves. | The log line names every file that collided and which one won — the exact lower-case spelling is always preferred, so `fr.txt` beats `FR.txt`. Rename or delete the others. Nothing is lost: the losing files are read past, not touched. |

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
| `TIP-UTT-001` | Quotes list (the ones with no book or film) |
| `TIP-BOOK-001` | Books list / count / tags |
| `TIP-MOVIE-001` | Movies list / count |
| `TIP-PEOPLE-001` | People list / names / orphan images |
| `TIP-REVIEW-001` | Quiz / practice candidate rows |
| `TIP-EXPORT-001` | Export rows |
| `TIP-BULK-001` | Bulk-selection id rows |
| `TIP-TAG-001` | Genres / tags list |
| `TIP-BOARD-001` | Quote boards list |
| `TIP-ANTH-001` | Anthologies list / an anthology's entries |
| `TIP-STATS-001` | Stats aggregate rows |
| `TIP-STICKER-001` | Stickers list |
| `TIP-TRASH-005` | The bin list |
| `TIP-ADMIN-001` | Admin user list |
| `TIP-META-001` | Metadata console / library rows |
| `TIP-IMPORT-002` | Import staging queue rows (batches / works / quotes) |

## IMPORT — the staging queue

A bulk import parses into a holding area and nothing enters the library until it
is approved, so these failures leave the library untouched by construction: a
failed stage means the file was not taken in, and a failed approve means the
quotes are still queued. Nothing is half-applied — every one of these paths runs
in a single transaction.

| Code | Meaning | Likely cause | What to do |
| --- | --- | --- | --- |
| `TIP-IMPORT-001` | A parsed import could not be written into the staging tables; nothing was staged. | A database write failed mid-batch (disk full, or corruption — check for `TIP-STORE-002`). | Retry the upload. The file parsed fine, so nothing is wrong with it; the library and the existing queue are unchanged. |
| `TIP-IMPORT-003` | Approving staged quotes failed; the transaction rolled back. | A write failed while resolving the destination work or inserting quotes — often a book or film that was deleted while its quotes sat staged. | The quotes are still in the queue, so retry the approval. If it recurs, approve one batch (or one work) at a time to find the row that fails. |
| `TIP-IMPORT-004` | A staging-queue mutation (bulk edit, retarget or discard) failed; the queue is unchanged. | A write failed, or a retarget named a book/film that was deleted mid-edit. | Reload the queue so it reflects the current library, then retry. Nothing was partially applied. |

## Metadata, covers, people, imports

| Code | Meaning | Likely cause | What to do |
| --- | --- | --- | --- |
| `TIP-META-002` | A metadata provider key or setting could not be read. | A `settings` read failed, so a lookup degrades to "unconfigured". | Check the database is healthy; re-save the key in Settings → metadata keys. |
| `TIP-META-010` | Genres failed to persist even though the request returned OK. | The genre write transaction failed to begin or commit. | Retry the edit. If it recurs, check for database corruption (`TIP-STORE-002`). |
| `TIP-COVER-001` | An on-demand cover/poster refetch failed. | The provider was unreachable or returned no image. | Retry later; manual cover upload still works. |
| `TIP-BOOK-002` | A book cover could not be fetched on create; the book was saved without one. | The cover URL was unreachable or blocked by the SSRF guard. | Add a cover later via the cover picker; the book itself saved fine. |
| `TIP-MOVIE-002` | A movie poster could not be fetched on create/update; saved without one. | The poster URL was unreachable or blocked. | Add a poster later; the movie saved fine. |
| `TIP-PEOPLE-010` | Garbage-collecting orphaned people rows/images failed. | A delete query failed after the parent row was removed. | Harmless to users; orphaned rows/images may accumulate. Investigate if disk grows. |
| `TIP-STICKER-002` | A starter sticker could not be copied into a user's library; the rest of the set still went in. | The `MediaCover` directory is not writable, or the disk is full. | Fix the volume permissions / free disk space. Uploading your own stickers uses the same directory, so this affects that too. The starter set is offered once per instance and is not retried — upload the shapes you want, or restore from a backup taken before the upgrade. |
| `TIP-BOOK-003` | A user-supplied cover URL failed to fetch while editing a book; the save was rejected. | The URL doesn't point directly at an image, the host blocked/hotlink-protected the request, it exceeded 10 MB, or the fetch timed out/was refused (private-IP guard). | Read the full `[error]` line for the underlying cause; try a direct image link or upload the file instead. |
| `TIP-MOVIE-003` | A user-supplied poster URL failed to fetch while editing a movie; the save was rejected. | Same causes as `TIP-BOOK-003`. | Read the full `[error]` line for the underlying cause; try a direct image link or upload the file instead. |
| `TIP-PEOPLE-002` | A user-supplied person image URL failed to fetch; the save was rejected. | Same causes as `TIP-BOOK-003`. | Read the full `[error]` line for the underlying cause; try a direct image link or upload the file instead. |
| `TIP-META-011` | A provider lookup failed while previewing a re-verify; the item reported `fetch_failed`. | The source (Google Books / Open Library / Amazon / TMDB / TheTVDB) was unreachable, rejected the key, or is out of quota. | Retry later; check the key/quota in Settings → Metadata sources. The rest of the batch still previewed. |
| `TIP-META-012` | Writing an approved re-verify change failed for one item. | A database write failed mid-apply (or an id collided with another item's). | Read the full `[error]` line; retry the apply for that item. Other items in the batch were unaffected. |
| `TIP-META-013` | An approved cover/poster/portrait failed to download on re-verify apply. | The image URL was unreachable or blocked by the host allowlist. | The item's text fields were still applied; re-run the re-verify or set the image manually. |
| `TIP-META-015` | A fetched field could not be encoded during a **fill the gaps** run over a selection, so that one field was skipped. | The provider returned a value of a shape the writer does not accept — effectively a provider or parser change, not a configuration problem. | The item's other missing fields were still filled. Re-run **fill the gaps**, or set the one field by hand; the log line names it. |
| `TIP-META-014` | An on-demand book or movie lookup failed at the provider; the client saw a generic 502 ("lookup failed"). | Google Books / Open Library / TMDB / TheTVDB was unreachable, rejected the key, or is out of quota — the real cause is on the same `[error]` line. | Read the full `[error]` line: a `401` / "rejected the key" means fix the key in Settings → Metadata sources; a `429`/quota means retry later or add your own key; a connection error means the container can't reach the provider (check egress/DNS). |
| `TIP-PEOPLE-003` | An on-demand person link/portrait lookup failed at the provider; the client saw a generic 502 ("lookup failed"). | For authors, Open Library was unreachable or errored; for actors/directors, TMDB was unreachable or rejected the key (including the built-in fallback key hitting its rate cap). The real cause is on the same `[error]` line. | Read the full `[error]` line: a TMDB `401` means fix/replace the key in Settings → Metadata sources; a `429` means retry later; a connection error means the container can't reach the provider. |
| `TIP-META-017` | An IGDB game lookup failed; the client saw a generic 502, or a 503 when no key is set at all. | IGDB needs BOTH a Twitch client id and a client secret, and Twitch answers a wrong one with `400 invalid client` rather than a 401 — so "rejected the credentials" usually means one of the two is mistyped or the app was deleted. Otherwise: out of quota (4 req/s), or the container cannot reach `api.igdb.com` / `id.twitch.tv`. | Check both values in Settings → Metadata sources; they are a pair and a valid id with a stale secret fails the same way as a wrong id. Register an application at dev.twitch.tv to get a fresh pair. A connection error means egress or DNS, not the key. |
| `TIP-META-018` | No Wikidata item claims a game's IGDB slug, so its voice cast could not be fetched. The game itself was saved. | **Expected for most games and not a fault.** Wikidata is the only free structured source of game voice credits and its coverage is thin — of 24 well-known titles measured, 10 had a usable cast and The Witcher 3, Mass Effect 3, Persona 5, Disco Elysium and BioShock had none at all. | Nothing to fix. The cast is left blank and is hand-editable: type the credits into the game's Details, and they are kept exactly as a fetched cast would be. |

## SHELF — status and the read log

| Code | Meaning | Likely cause | What to do |
| :-- | :-- | :-- | :-- |
| `TIP-SHELF-001` | A shelf cap was asked for a `media_type` the shelf does not recognise; the tightest (film) cap of two was used. | A media type reached the shelf that `shelfCap` was never taught — either a new one added without an arm, or a corrupted `movies.media_type` value. | Check the log line for the offending value. If it is a media type the app should support, `shelfCap` in `internal/httpapi/shelf.go` needs a decided arm rather than a fallthrough; if it is junk, correct the row. Nothing is lost either way — the cap is only a client-side nudge. |

## CAST — a work's character-to-actor mapping

Every book, film, show and game owns a list of characters with the actor beside
each (the **voice actor** on a game; a book's list has no second column at all).
It is seeded by whichever metadata provider pinned the title and is editable by
hand, and the rule that keeps those two apart is that **a refetch never
overwrites a row you have touched** — see the header of migration `0048`.

| Code | Meaning | Likely cause | What to do |
| --- | --- | --- | --- |
| `TIP-CAST-001` | A cast row failed to scan, so that character was left out of the list. | A `SELECT` that drifted from the Go struct it scans into — usually a migration that added or reordered a column in `work_cast` without updating the query. | Cosmetic per row and reported as a 500 only if the whole read fails. Realign the query and the scan target; the log line names the work and the underlying error. |
| `TIP-CAST-002` | A cast row's folded lookup keys could not be rewritten by the boot-time repair; the row kept the keys it had. | Almost always the pair `UNIQUE`: two rows on one work whose names differ only by case or by punctuation (`Éowyn` and `éowyn`) become the same row once both are folded, and SQLite refuses the second. This repair runs on every start, so refusing to boot over it would be far worse than skipping it. | Nothing breaks. That one row goes on being missed by the quote form's actor auto-fill, exactly as it was before the repair ran. Open the work's cast, delete whichever of the two duplicates is wrong, and the next start folds the survivor. |
| `TIP-CLEANUP-001` | A quote could not be read during the Settings cleanup sweep, so it was skipped. | A SELECT/struct drift, or a row whose text column holds something the scan could not decode. The sweep reads every quote in one pass, so refusing the whole list over one unreadable row would hide every other finding. | Nothing is changed by this sweep at all — it only lists. That one quote is absent from the list; every other quote is still reported, and the count of quotes scanned in the reply tells you one went missing. |

## TRASH — the bin

Deleting a book, film, quote or account writes a JSON snapshot of the whole
subtree to the `trash` table first, then deletes the rows. A failure to write the
snapshot REFUSES the delete: nothing is removed, which is the safe direction for
a feature whose whole purpose is not losing things.

| Code | Meaning | Likely cause | What to do |
| --- | --- | --- | --- |
| `TIP-TRASH-001` | A delete could not be binned, so the delete was refused and nothing was removed. | A database write failed (disk full, or corruption — check for `TIP-STORE-002`). | Free disk space and retry. The item is still there; nothing is half-deleted. |
| `TIP-TRASH-002` | A binned cover/poster could not be parked, restored or purged. | The `MediaCover` volume is not writable, or the file was already removed by hand. | Cosmetic: the row is unaffected. Parking fails towards KEEPING the file, so a stale image may sit in `MediaCover/` or `MediaCover/trash/`; both are collected by a later sweep. |
| `TIP-TRASH-003` | A restore failed and rolled back; the bin entry is still there. | An id collision (should be impossible — see `id_floor`), a username already taken when restoring an account, or a write failure. | Read the full `[error]` line. The entry is intact, so retrying is safe. |
| `TIP-TRASH-004` | The bin's retention sweep failed; expired entries and their files are still on disk. | A database or filesystem error during the sweep. | Harmless to data; the sweep runs again on the next start and once a day after. Disk use stays higher than the retention setting implies until it succeeds. |

## BACKUP — backup & restore

| Code | Meaning | Likely cause | What to do |
| --- | --- | --- | --- |
| `TIP-BOOK-004` | A book's own chapter list could not be read, so the chapter number and name fields offered no suggestions. | A `SELECT` over `annotations`' two chapter columns failed — schema drift, or the database unreadable at that moment. | Cosmetic. The fields still accept anything you type, and the highlight saves exactly as before; only the dropdown is empty. |
| `TIP-CAST-003` | A requested IMDb cast fetch failed. | Network (IMDb unreachable, timed out at the shared 10s client timeout), a page that carries no embedded document, or the write. A 404 from IMDb is reported to the reader as "no title with that id" rather than logged. | The work's existing cast is unchanged — the merge runs in one transaction, so nothing partial is stored. Check the id against the page in a browser, then press it again; nothing retries on its own, by design. |
| `TIP-BACKUP-001` | The backup's database snapshot (`VACUUM INTO`) failed; no archive was produced. | Disk full, or the live database is corrupt (`TIP-STORE-002`). | Free disk space; run Profile → Rebuild search index or check integrity, then retry. |
| `TIP-BACKUP-002` | The backup archive could not be written or promoted into `backups/`. | Disk full or a permissions problem on the data volume. | Free disk space / fix volume permissions and retry. |
| `TIP-BACKUP-003` | Restore could not extract the backup archive to staging. | Disk full (restore needs roughly the archive's expanded size free) or a truncated archive. | Free disk space; re-create the backup if the archive is damaged. |
| `TIP-BACKUP-004` | The restore swap failed; the previous data was rolled back intact. | A file in the data dir was locked, or the restored database failed to open/migrate. | Read the full `[error]` line; nothing was lost — retry after fixing the cause. |
| `TIP-BACKUP-005` | The restore rollback failed; the server exited so Docker restarts it cleanly. | Cascading I/O failure during rollback. | The container comes back on whatever is on disk; the previous data dir is preserved in `.pre-restore-<ts>` inside the data volume for manual recovery. |
| `TIP-BACKUP-006` | Backup/restore temporary files could not be cleaned up. | A lingering file lock (Windows) or permissions. | Harmless to data; delete stray `.backup-*` / `.restore-*` dirs and old `backups/*.partial` files to reclaim disk. |
| `TIP-BACKUP-007` | An uploaded restore archive could not be spooled to disk. | Disk full (the upload needs the archive's size free on the data volume) or a permissions problem. | Free disk space / fix volume permissions and retry the upload; live data is untouched. |
