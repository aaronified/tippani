package olog

// Code is a stable, greppable error identifier of the form TIP-<SUBSYS>-<NNN>.
// It appears verbatim in `[error]`/`[warn]` log lines and in docs/troubleshoot.md,
// so an operator who sees a code in `docker logs` can look up its cause and fix.
//
// Rules (see the error-logging skill):
//   - Every Code MUST have an entry in Registry below AND a row in
//     docs/troubleshoot.md. TestCodesDocumented (codes_test.go) fails the build if
//     the two ever drift apart.
//   - Codes are append-only within a subsystem: never renumber or reuse a code, so
//     a code seen in an old log always means the same thing.
type Code string

const (
	// HTTP — cross-cutting web layer.
	CodeHTTPInternal  Code = "TIP-HTTP-000" // unclassified internal error (generic 500 fallback)
	CodeHTTPTLSReload Code = "TIP-HTTP-001" // the TLS cert/key pair failed to re-load after changing on disk; the previous pair is still served

	// UPDATE — in-app self-update (Settings → Updates, admin).
	CodeUpdateEngine Code = "TIP-UPDATE-001" // a Docker Engine API call failed during self-update (identify/pull/recreate)

	// STORE — database lifecycle, integrity, repair, checkpoint.
	CodeStoreIntegrityRun  Code = "TIP-STORE-001" // PRAGMA quick_check could not run
	CodeStoreCorruption    Code = "TIP-STORE-002" // quick_check found page-level corruption
	CodeStoreFTSRebuild    Code = "TIP-STORE-003" // an FTS index could not be reconstructed in place
	CodeStoreRecoverFailed Code = "TIP-STORE-004" // whole-database recovery-from-content failed
	CodeStoreCheckpoint    Code = "TIP-STORE-005" // WAL checkpoint on shutdown failed
	CodeStoreResetDelete   Code = "TIP-STORE-006" // factory reset could not delete a database file

	// SRCH — full-text search.
	CodeSearchQuery   Code = "TIP-SRCH-001" // an FTS MATCH query failed at runtime
	CodeSearchRepair  Code = "TIP-SRCH-002" // a corrupt FTS index could not be reconstructed at query time
	CodeSearchRowScan Code = "TIP-SRCH-003" // a search result row failed to scan (dropped from results)
	CodeSearchVocab   Code = "TIP-SRCH-004" // fuzzy-search vocabulary read failed; typo correction skipped

	// Per-subsystem "list row failed to scan" — a SELECT/struct drift that would
	// otherwise silently shorten a list with a 200 (the class the 0.6.4 favourites
	// bug exposed). One per subsystem that has list/collection loops.
	CodeAnnoRowScan    Code = "TIP-ANNO-001"
	CodeDlgRowScan     Code = "TIP-DLG-001"
	CodeUttRowScan     Code = "TIP-UTT-001"
	CodeBookRowScan    Code = "TIP-BOOK-001"
	CodeMovieRowScan   Code = "TIP-MOVIE-001"
	CodePeopleRowScan  Code = "TIP-PEOPLE-001"
	CodeReviewRowScan  Code = "TIP-REVIEW-001"
	CodeExportRowScan  Code = "TIP-EXPORT-001"
	CodeBulkRowScan    Code = "TIP-BULK-001"
	CodeTagRowScan     Code = "TIP-TAG-001"
	CodeBoardRowScan   Code = "TIP-BOARD-001"
	CodeStatsRowScan   Code = "TIP-STATS-001"
	CodeStickerRowScan Code = "TIP-STICKER-001"
	CodeAdminRowScan   Code = "TIP-ADMIN-001"
	CodeMetaRowScan    Code = "TIP-META-001"

	// Specific genuine-failure codes (were silently swallowed before).
	CodeStickerSeed      Code = "TIP-STICKER-002" // a starter sticker could not be copied into a user's library
	CodeMetaKeyRead      Code = "TIP-META-002"    // provider key/settings read failed (degrades to no-key)
	CodeMetaGenrePersist Code = "TIP-META-010"    // genre write not persisted (tx begin/commit failed)
	CodePeopleOrphanGC   Code = "TIP-PEOPLE-010"  // orphan-people garbage collection failed
	CodeBookCover        Code = "TIP-BOOK-002"    // book cover fetch failed on create (cover dropped, book kept)
	CodeMovieCover       Code = "TIP-MOVIE-002"   // movie poster fetch failed on create/update (dropped)
	CodeCoverFetch       Code = "TIP-COVER-001"   // on-demand cover/poster refetch failed

	// User-supplied cover/poster/image URL fetch failed on an edit — the whole
	// save is rejected (502), unlike the create-time CodeBookCover/CodeMovieCover
	// paths, which are non-fatal. These log the real cause since the client only
	// ever sees a generic "couldn't fetch that image" message.
	CodeBookCoverUpdate  Code = "TIP-BOOK-003"
	CodeMovieCoverUpdate Code = "TIP-MOVIE-003"
	CodePeopleImageFetch Code = "TIP-PEOPLE-002"

	// META — force-fetch & re-verify (review before apply, ROADMAP §2).
	CodeMetaReverifyFetch Code = "TIP-META-011" // a provider lookup failed during a re-verify preview (item reported fetch_failed)
	CodeMetaReverifyApply Code = "TIP-META-012" // an approved re-verify write failed for one item
	CodeMetaReverifyImage Code = "TIP-META-013" // an approved cover/poster/portrait fetch failed on apply (text fields kept)
	CodeMetaFillField     Code = "TIP-META-015" // one fetched field could not be encoded during a fill-the-gaps run (field skipped)
	// An ensemble dialogue whose character and actor lists do not line up, so a
	// remap rewrote the character and deliberately left the actor alone. Logged
	// because the alternative — guessing a slot — would pair the wrong actor with
	// the wrong character invisibly, and the user would read it as their own data.
	CodeMetaRemapUnaligned Code = "TIP-META-016"

	// On-demand provider lookups (book/movie/person) that failed and were
	// surfaced to the client as a 502. The client only ever sees a generic
	// "lookup failed" message, so these log the real provider cause (a rejected
	// key, a quota, a bad status) — otherwise the failure is invisible in the logs.
	CodeMetaLookupFailed   Code = "TIP-META-014"   // a book/movie provider lookup failed (Google Books / Open Library / TMDB / TheTVDB)
	CodePeopleLookupFailed Code = "TIP-PEOPLE-003" // a person link/portrait lookup failed (Open Library / TMDB)

	// GAMES (0040). Two codes because the two failures need different answers:
	// the first is the operator's key, the second is nobody's fault at all.
	CodeMetaIGDBLookup Code = "TIP-META-017" // an IGDB game lookup failed (rejected Twitch credentials, quota, or a bad status)
	CodeMetaGameNoCast Code = "TIP-META-018" // no Wikidata item claims a game's IGDB slug, so no voice cast could be fetched

	// A shelf cap was asked for a media type nothing recognises. Warned rather
	// than defaulted silently — see shelfCap in internal/httpapi/shelf.go.
	CodeShelfMediaType Code = "TIP-SHELF-001"

	// IMPORT — the staging queue a bulk import lands in before it is approved.
	CodeImportStage    Code = "TIP-IMPORT-001" // a parsed import could not be written into the staging tables; nothing was staged
	CodeImportRowScan  Code = "TIP-IMPORT-002" // a staged batch/work/quote row could not be scanned while listing the queue
	CodeImportApprove  Code = "TIP-IMPORT-003" // approving staged quotes failed; the transaction rolled back, so nothing entered the library
	CodeImportStagedOp Code = "TIP-IMPORT-004" // a staging-queue mutation (bulk edit, retarget or discard) failed; the queue is unchanged

	// TRASH — the bin (0031): a 30-day undo for anything deleted.
	CodeTrashWrite   Code = "TIP-TRASH-001" // a delete could not be binned; the delete was refused rather than made final
	CodeTrashFile    Code = "TIP-TRASH-002" // a binned image could not be parked, restored or purged
	CodeTrashRestore Code = "TIP-TRASH-003" // a restore failed; the bin entry is left intact
	CodeTrashPurge   Code = "TIP-TRASH-004" // the retention sweep failed; nothing was removed
	CodeTrashRowScan Code = "TIP-TRASH-005" // a bin list row failed to scan; dropped from the list

	// BACKUP — server-side backup & restore (Settings, admin).
	CodeBackupSnapshot Code = "TIP-BACKUP-001" // database snapshot (VACUUM INTO) failed; no archive produced
	CodeBackupArchive  Code = "TIP-BACKUP-002" // the backup archive could not be written/promoted
	CodeBackupExtract  Code = "TIP-BACKUP-003" // restore extraction to staging failed (server-side I/O)
	CodeBackupSwap     Code = "TIP-BACKUP-004" // restore swap failed; the previous data was rolled back intact
	CodeBackupRollback Code = "TIP-BACKUP-005" // restore rollback failed; the server exited for a clean boot
	CodeBackupCleanup  Code = "TIP-BACKUP-006" // cleanup of backup/restore temp files failed (leftovers consume disk)
	CodeBackupUpload   Code = "TIP-BACKUP-007" // an uploaded restore archive could not be spooled to disk
)

// Registry maps every Code to a one-line description. It is the machine-readable
// source of truth paired with docs/troubleshoot.md (human-readable cause+fix).
// Keep this and the doc in lockstep — the sync test enforces it.
var Registry = map[Code]string{
	CodeHTTPInternal:  "Unclassified internal server error (generic 500 fallback).",
	CodeHTTPTLSReload: "The TLS certificate/key pair changed on disk but failed to re-load; the previously loaded pair is still being served.",

	CodeUpdateEngine: "A Docker Engine API call failed during self-update (identify self, pull image, or launch the recreater).",

	CodeStoreIntegrityRun:  "SQLite PRAGMA quick_check could not run — the database file may be unreadable.",
	CodeStoreCorruption:    "quick_check found page-level corruption in the database file.",
	CodeStoreFTSRebuild:    "A full-text index could not be reconstructed in place from its content table.",
	CodeStoreRecoverFailed: "Whole-database recovery (rebuild from intact content) failed.",
	CodeStoreCheckpoint:    "WAL checkpoint on shutdown failed (the WAL is still valid and replays on reopen).",
	CodeStoreResetDelete:   "Factory reset could not delete a database file.",

	CodeSearchQuery:   "A full-text search query failed at runtime (often a corrupt or drifted FTS index).",
	CodeSearchRepair:  "A corrupt FTS index could not be reconstructed while serving a search.",
	CodeSearchRowScan: "A search result row failed to scan and was dropped from the results.",
	CodeSearchVocab:   "A fuzzy-search vocabulary read failed; typo correction was skipped and the exact (empty) result was returned.",

	CodeAnnoRowScan:    "An annotation list row failed to scan (SELECT/struct drift); dropped from the list.",
	CodeDlgRowScan:     "A dialogue list row failed to scan (SELECT/struct drift); dropped from the list.",
	CodeUttRowScan:     "A quote list row failed to scan (SELECT/struct drift); dropped from the list.",
	CodeBookRowScan:    "A book list row failed to scan (SELECT/struct drift); dropped from the list.",
	CodeMovieRowScan:   "A movie list row failed to scan (SELECT/struct drift); dropped from the list.",
	CodePeopleRowScan:  "A people list row failed to scan (SELECT/struct drift); dropped from the list.",
	CodeReviewRowScan:  "A review/quiz candidate row failed to scan; dropped from the set.",
	CodeExportRowScan:  "An export row failed to scan; omitted from the export.",
	CodeBulkRowScan:    "A bulk-selection id row failed to scan; omitted from the operation.",
	CodeTagRowScan:     "A genre/tag row failed to scan; dropped from the list.",
	CodeBoardRowScan:   "A quote-board row failed to scan; dropped from the list.",
	CodeStatsRowScan:   "A stats aggregate row failed to scan; omitted from the totals.",
	CodeStickerRowScan: "A sticker list row failed to scan; dropped from the list.",
	CodeAdminRowScan:   "A user list row failed to scan; dropped from the admin list.",
	CodeMetaRowScan:    "A metadata console/library row failed to scan; dropped from the result.",

	CodeStickerSeed:      "A starter sticker could not be copied into a user's library; the rest of the set still went in.",
	CodeMetaKeyRead:      "A metadata provider key/setting could not be read; lookups degrade to unconfigured.",
	CodeMetaGenrePersist: "Genres failed to persist (transaction begin/commit error) although the request returned OK.",
	CodePeopleOrphanGC:   "Garbage-collecting orphaned people rows/images failed; orphans may remain.",
	CodeBookCover:        "A book cover image could not be fetched on create; the book was saved without a cover.",
	CodeMovieCover:       "A movie poster could not be fetched on create/update; saved without a poster.",
	CodeCoverFetch:       "An on-demand cover/poster refetch failed.",

	CodeBookCoverUpdate:  "A user-supplied cover URL failed to fetch on edit; the save was rejected.",
	CodeMovieCoverUpdate: "A user-supplied poster URL failed to fetch on edit; the save was rejected.",
	CodePeopleImageFetch: "A user-supplied person image URL failed to fetch; the save was rejected.",

	CodeMetaReverifyFetch: "A provider lookup failed while previewing a re-verify; the item was reported fetch_failed.",
	CodeMetaReverifyApply: "Writing an approved re-verify change failed for one item; the rest of the batch continued.",
	CodeMetaReverifyImage: "An approved cover/poster/portrait failed to download on re-verify apply; text fields were kept.",
	CodeMetaFillField:     "A fetched field could not be encoded during a fill-the-gaps run; that one field was skipped and the rest of the item was still written.",

	CodeMetaLookupFailed:   "An on-demand book/movie lookup failed at the provider (Google Books / Open Library / TMDB / TheTVDB); the client saw a generic 502.",
	CodePeopleLookupFailed: "An on-demand person link/portrait lookup failed at the provider (Open Library / TMDB); the client saw a generic 502.",

	CodeMetaIGDBLookup: "An IGDB game lookup failed — most often the Twitch client id or secret is wrong or expired; the client saw a generic 502 or a missing-key 503.",
	CodeMetaGameNoCast: "No Wikidata item claims this game's IGDB slug, so no voice cast could be fetched. Expected for most games and not an error: the cast is left blank for you to type in.",

	CodeShelfMediaType: "A shelf cap was requested for an unrecognised media_type; the tightest (film) cap was used. Indicates a media type reached the shelf that shelfCap was never taught.",

	CodeImportStage:    "A parsed import could not be written into the staging tables; the batch was rolled back and nothing was staged.",
	CodeImportRowScan:  "A staged batch, work or quote row could not be scanned while listing the import queue; that row was left out of the response.",
	CodeImportApprove:  "Approving staged quotes failed; the transaction rolled back, so nothing entered the library and the queue still holds them.",
	CodeImportStagedOp: "A staging-queue mutation (bulk edit, retarget or discard) failed; the queue is unchanged.",

	CodeTrashWrite:   "A delete could not be written to the bin, so the delete was refused and nothing was removed.",
	CodeTrashFile:    "A binned cover/poster could not be parked, restored or purged; the row itself is unaffected.",
	CodeTrashRestore: "A restore from the bin failed and rolled back; the bin entry is still there to retry.",
	CodeTrashPurge:   "The bin's retention sweep failed; expired entries and their files are still on disk.",
	CodeTrashRowScan: "A bin list row failed to scan; that entry was left out of the list.",

	CodeBackupSnapshot: "The backup's database snapshot (VACUUM INTO) failed; no archive was produced.",
	CodeBackupArchive:  "The backup archive could not be written or promoted into the backups directory.",
	CodeBackupExtract:  "Restore could not extract the backup archive to staging (server-side I/O).",
	CodeBackupSwap:     "The restore swap failed; the previous data directory was rolled back intact.",
	CodeBackupRollback: "The restore rollback failed; the server exited so Docker restarts it cleanly — previous data is in .pre-restore-<ts>.",
	CodeBackupCleanup:  "Backup/restore temporary files could not be cleaned up; leftovers consume disk space.",
	CodeBackupUpload:   "An uploaded restore archive could not be spooled to disk (server-side I/O, or the disk is full).",
}
