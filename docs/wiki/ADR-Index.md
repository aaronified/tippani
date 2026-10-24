# ADR index

Source of truth: this wiki page.

903 architecture decision records, each its own page, grouped by what they are about rather than by when they happened. This index replaces the single decision log that held them all (see [ADR-0904](ADR-0904-Decisions-Are-Records-One-Page-Each.md)). Add a decision as a new `ADR-NNNN-Title.md` page and one line here: never edit the history of an old one, reverse it in a new one and say so.

## How to read an ADR

An ADR is a decision, the reason that produced it, the alternative turned down and, where it applies, the part that was wrong and what changed the mind. **Decided** says what the code does; **Why** says what it cost; **Instead of** names what was rejected; **Approved** appears only where there is something more to say than the blanket approval in [Design decisions](Design-decisions.md). The footer names the release that first shipped it and the files it governs. A log is allowed to be wrong in public: an ADR that records a decision, and later records that it was wrong, is doing its job.

<a id="area-1"></a>

## §1 The Target Host, the Budgets, and the Scope They Fix

Everything downstream answers to one fact: this runs on a low-powered NAS already hosting roughly a hundred other services, so idle CPU near zero and a tiny dependency surface are requirements rather than aspirations. The refusals are grouped here because most of them are consequences of that budget rather than separate opinions.

- [ADR-0001](ADR-0001-A-NAS-Sharing-A-Box-With-100-Co-Tenant-Services-Makes-CPU.md): A NAS sharing a box with ~100 co-tenant services makes CPU frugality a first-class requirement — pre-1.0
- [ADR-0002](ADR-0002-Hard-Runtime-Caps-GOMAXPROCS-1-GOMEMLIMIT-64MiB-GOGC-200.md): Hard runtime caps: GOMAXPROCS=1, GOMEMLIMIT=64MiB, GOGC=200 — defensive towards the neighbours, not the app — pre-1.0
- [ADR-0003](ADR-0003-Nothing-Wakes-On-A-Timer-Cleanup-And-Scheduling-Run-On-Read-And.md): Nothing wakes on a timer — cleanup and scheduling run on read, and a job runs because somebody started it — pre-1.0; reworded 3.1.0
- [ADR-0004](ADR-0004-Pure-Go-SQLite-Modernc-Over-CGo-Mattn-Buying-CGO-ENABLED-0-At-1.md): Pure-Go SQLite (modernc) over CGo mattn, buying CGO ENABLED=0 at ~1.5–2× per-query CPU — pre-1.0
- [ADR-0005](ADR-0005-Dependency-Budget-Three-Direct-Go-Modules-Three-Runtime-Npm.md): Dependency budget: three direct Go modules, three runtime npm packages, everything else stdlib — pre-1.0
- [ADR-0006](ADR-0006-Static-Assets-Are-Precompressed-At-Build-Time-The-NAS-Never-Runs.md): Static assets are precompressed at build time; the NAS never runs Node and never gzips a byte at request time — 1.1.0 (reversal)
- [ADR-0007](ADR-0007-Layout-Work-That-Can-Happen-On-The-Reader-S-Device-Does-Sticker.md): Layout work that can happen on the reader's device does: sticker text flow is client-side, code-split and lazy-loaded — pre-1.0
- [ADR-0008](ADR-0008-Tippani-Looks-Outward-Only-When-A-Person-Or-The-App-S-Own-Lookup.md): Tippani looks outward only when a person or the app's own lookup asks, and every call is a line in a log — pre-1.0; reworded 3.1.0
- [ADR-0009](ADR-0009-No-AI-At-Runtime-Not-Disabled-By-Default-Not-Present.md): No AI at runtime: not disabled by default, not present — pre-1.0
- [ADR-0010](ADR-0010-No-Built-In-Reader-No-OPDS-No-File-Sync-Annotations-Are-Wanted.md): No built-in reader, no OPDS, no file sync — annotations are wanted, files are not — pre-1.0
- [ADR-0011](ADR-0011-No-Social-Features-And-No-Federation-And-The-Hosted-Read-Only.md): No social features and no federation — and the hosted read-only page was dropped after being on the list — pre-1.0
- [ADR-0012](ADR-0012-Server-Side-OCR-Refused-On-Device-OCR-Is-A-Different-Feature-And.md): Server-side OCR refused; on-device OCR is a different feature and was moved rather than left refused — pre-1.0 (refusal), scope corrected later
- [ADR-0013](ADR-0013-Server-Side-Text-To-Speech-Refused-The-Browser-S-Own.md): Server-side text-to-speech refused; the browser's own SpeechSynthesis accepted — pre-1.0 (refusal); the browser half is accepted, not built
- [ADR-0014](ADR-0014-Android-Only-For-The-Native-Client-No-Unbuildable-Ios-Directory.md): Android only for the native client; no unbuildable ios/ directory ships — pre-1.0

<a id="area-2"></a>

## §2 Ownership, Authentication and Exposure

Per-user isolation is treated as a security property, not a layout convenience, and every credential decision is argued from what a browser does automatically versus what a person does deliberately. Auth was built before the features that depend on it.

- [ADR-0015](ADR-0015-Per-User-Isolated-Libraries-And-The-One-Assumption-Still-Marked.md): Per-user isolated libraries, and the one assumption still marked "confirm" — `docs/wiki/Design-decisions.md` · `internal/store/migrations/0001_init.sql …`
- [ADR-0016](ADR-0016-Ownership-Lives-Inside-The-Write-Statement-And-A-Foreign-Row.md): Ownership lives inside the write statement, and a foreign row answers 404
- [ADR-0017](ADR-0017-Auth-Sessions-And-CSRF-Were-Built-First-Not-Last.md): Auth, sessions and CSRF were built first, not last — `docs/wiki/Design-decisions.md`
- [ADR-0018](ADR-0018-Bcrypt-Cost-10-For-Logins-Argon2id-For-Archive-Keys.md): bcrypt cost 10 for logins, Argon2id for archive keys
- [ADR-0019](ADR-0019-Passwords-Are-8-20-Characters-Of-Printable-ASCII-Because-A.md): Passwords are 8–20 characters of printable ASCII, because a password is a backup key — `internal/httpapi/auth_handlers.go` · `README.md`
- [ADR-0020](ADR-0020-Session-Tokens-SHA-256-At-Rest-30-Day-Sliding-Under-A-90-Day-Cap.md): Session tokens: SHA-256 at rest, 30-day sliding under a 90-day cap, swept lazily — `internal/auth/auth.go` · `docs/wiki/Design-decisions.md`
- [ADR-0021](ADR-0021-Device-Tokens-Have-The-Opposite-Lifetime-To-Sessions-On-Purpose.md): Device tokens have the opposite lifetime to sessions, on purpose — `docs/wiki/Design-decisions.md` · `internal/auth/auth.go`
- [ADR-0022](ADR-0022-Pairing-Codes-Live-In-Memory-One-Shot-Five-Minutes.md): Pairing codes live in memory: one-shot, five minutes, look-alike-free — `internal/httpapi/pairing_handlers.go`
- [ADR-0023](ADR-0023-CSRF-Is-The-Stdlib-Header-Check-And-Bearer-Requests-Bypass-It.md): CSRF is the stdlib header check, and bearer requests bypass it
- [ADR-0024](ADR-0024-A-Present-But-Unusable-Authorization-Header-Fails-Closed.md): A present-but-unusable Authorization header fails closed — `internal/httpapi/server.go`
- [ADR-0025](ADR-0025-Login-Rate-Limiting-Keyed-On-Client-IP-Username-Rightmost-XFF.md): Login rate limiting keyed on (client IP, username), rightmost XFF only
- [ADR-0026](ADR-0026-Roles-Are-One-Is-Admin-Flag-And-The-First-User-Is-The-Admin.md): Roles are one is admin flag, and the first user is the admin — `docs/wiki/Design-decisions.md` · `internal/httpapi/admin_handlers.go`
- [ADR-0027](ADR-0027-Admin-Hand-Over-Is-Grant-Only-Because-A-Role-You-Can-Take-Is-A.md): Admin hand-over is grant-only, because a role you can take is a race
- [ADR-0028](ADR-0028-An-Admin-Account-Must-Step-Down-Before-It-Can-Be-Deleted.md): An admin account must step down before it can be deleted — `internal/httpapi/admin_handlers.go`
- [ADR-0029](ADR-0029-Switching-Accounts-Requires-That-Account-S-Password-And-Retires.md): Switching accounts requires that account's password, and retires the session you arrive with — `internal/httpapi/auth_handlers.go`
- [ADR-0030](ADR-0030-Share-Image-Tokens-Are-Session-Free-By-Design-And-Deliberately.md): Share-image tokens are session-free by design, and deliberately not single-use — `internal/httpapi/share_handlers.go`
- [ADR-0031](ADR-0031-The-Binary-Binds-127-0-0-1-The-Docker-Image-Binds-0-0-0-0.md): The binary binds 127.0.0.1, the Docker image binds 0.0.0.0 — `docs/wiki/Design-decisions.md` · `cmd/tippani/main.go`
- [ADR-0032](ADR-0032-Signup-And-First-Run-Restore-Are-Serialised-Under-One-Lock.md): Signup and first-run restore are serialised under one lock — `internal/httpapi/auth_handlers.go` · `internal/httpapi/backup_handlers.go`

<a id="area-3"></a>

## §3 The SQLite Contract: Durability, Locking, Migrations and Deletion

SQLite is the whole persistence story here, so its pragmas, its lock ordering and its inability to alter a constraint shape more decisions than any other single component. This section also holds the concurrency misdiagnosis that took me two releases to correct, and the plan for making deletion recoverable without a soft-delete flag.

- [ADR-0033](ADR-0033-WAL-With-Synchronous-FULL-For-The-Library-And-One-NORMAL.md): WAL with synchronous=FULL for the library, and one NORMAL connection for the logs — 0.6.4; the log connection 3.1.0
- [ADR-0034](ADR-0034-Graceful-Shutdown-Stops-The-Queue-Drains-Keeps-The-Last-Lines.md): Graceful shutdown stops the queue, drains, keeps the last lines, then checkpoints the WAL — inside one nine-second budget — 0.6.4; the six steps and the budget 3.1.0
- [ADR-0035](ADR-0035-One-Transaction-Per-Imported-File.md): One transaction per imported file — planned in §5/§8; held through the staging rework in 1.2.0
- [ADR-0036](ADR-0036-The-Planned-Single-Writer-Connection-And-A-500-Left-Unpatched-On.md): The planned single-writer connection, and a 500 left unpatched on purpose — 1.1.1
- [ADR-0037](ADR-0037-Txlock-Immediate-Replaced-The-Single-Writer-Plan.md): txlock=immediate replaced the single-writer plan — 1.3.2
- [ADR-0038](ADR-0038-A-Four-Connection-Pool-With-Readers-Deliberately-Left-Concurrent.md): A four-connection pool, with readers deliberately left concurrent — 1.3.2; the log connection 3.1.0
- [ADR-0039](ADR-0039-The-One-Genuinely-Read-Only-Transaction-Is-Marked-ReadOnly.md): The one genuinely read-only transaction is marked ReadOnly — 1.3.2
- [ADR-0040](ADR-0040-On-A-Duplicate-Create-Conflict-The-Transaction-Is-Released-First.md): On a duplicate-create conflict the transaction is released first — 1.1.1
- [ADR-0041](ADR-0041-Rows-Are-Collected-Before-They-Are-Updated.md): Rows are collected before they are updated — 1.2.0 (staging), 1.6.0 (people)
- [ADR-0042](ADR-0042-Migrations-Are-Forward-Only-Append-Only-And-Never-Edited.md): Migrations are forward-only, append-only, and never edited afterwards — from 0.1.0
- [ADR-0043](ADR-0043-An-Old-Build-Refuses-To-Open-A-Newer-Database.md): An old build refuses to open a newer database — 1.7.3
- [ADR-0044](ADR-0044-Column-Order-In-Base-Tables-Is-Append-Only.md): Column order in base tables is append-only — 1.2.0 (recorded), applies from 0001
- [ADR-0045](ADR-0045-Open-Ended-Vocabularies-Are-Validated-In-App-Code-Never-In-A.md): Open-ended vocabularies are validated in app code, never in a CHECK — 0.4.x (migration 0004)
- [ADR-0046](ADR-0046-No-Convenience-Trigger-On-A-Table-Backing-An-External-Content.md): No convenience trigger on a table backing an external-content FTS index — 1.1.1
- [ADR-0047](ADR-0047-A-Column-That-Looks-Usable-Is-Worse-Than-One-That-Is-Absent.md): A column that looks usable is worse than one that is absent — 1.1.1
- [ADR-0048](ADR-0048-Nullable-Helpers-Encode-What-Unset-Means-Per-Column.md): Nullable helpers encode what "unset" means per column — from 1.0.0, extended as columns were added
- [ADR-0049](ADR-0049-Hard-Delete-Everywhere-No-Tombstones-No-Soft-Delete.md): Hard delete everywhere — no tombstones, no soft delete — from 0.1.0
- [ADR-0050](ADR-0050-The-Bin-Reinstates-Recoverability-Via-A-Snapshot-Table-Not-A.md): The bin reinstates recoverability via a snapshot table, not a flag — 1.8.0
- [ADR-0051](ADR-0051-The-Trash-Payload-Reads-Its-Columns-From-PRAGMA-Table-Info.md): The trash payload reads its columns from PRAGMA table info — 1.8.0
- [ADR-0052](ADR-0052-Restore-Is-One-Entry-Per-User-Action-And-An-Account-Shares-The.md): Restore is one entry per user action, and an account shares the table — 1.8.0
- [ADR-0053](ADR-0053-Id-INTEGER-PRIMARY-KEY-Is-A-Rowid-Alias-So-Ids-Need-An.md): id INTEGER PRIMARY KEY is a rowid alias, so ids need an allocation floor — 1.8.0
- [ADR-0054](ADR-0054-The-Purge-Runs-At-Startup-And-Once-A-Day-On-A-Request-Never-On-A.md): The purge runs at startup and once a day on a request, never on a ticker — 1.8.0
- [ADR-0055](ADR-0055-File-Parking-Happens-Last-Outside-The-Transaction-And-Fails-Safe.md): File parking happens last, outside the transaction, and fails safe — 1.8.0
- [ADR-0056](ADR-0056-Only-The-Five-Content-Kinds-Get-A-Bin.md): Only the five content kinds get a bin — 1.8.0
- [ADR-0057](ADR-0057-The-FTS-Restore-Worry-Was-Unfounded.md): The FTS-restore worry was unfounded — 1.8.0
- [ADR-0058](ADR-0058-A-Delete-Is-A-Snapshot-In-A-Bin-Not-A-Flag-On-The-Row.md): A delete is a snapshot in a bin, not a flag on the row — 1.8.0
- [ADR-0059](ADR-0059-What-Travels-With-A-Deleted-Thing-Is-DECLARED-Because-The.md): What travels with a deleted thing is DECLARED, because the foreign-key graph is incomplete — 1.8.0
- [ADR-0060](ADR-0060-Ids-Are-Never-Reused-Via-An-Allocation-Floor-Rather-Than.md): Ids are never reused, via an allocation floor rather than AUTOINCREMENT — 1.8.0
- [ADR-0061](ADR-0061-The-Retention-Sweep-Has-No-Scheduler-And-Never-Is--1.md): The retention sweep has no scheduler, and "never" is -1 — 1.8.0
- [ADR-0062](ADR-0062-An-Account-Entry-Belongs-To-The-Admin-Who-Deleted-It.md): An account entry belongs to the admin who deleted it — 1.8.0
- [ADR-0063](ADR-0063-A-Vocabulary-That-Is-Expected-To-Grow-Carries-No-CHECK-And.md): A vocabulary that is expected to grow carries no CHECK, and boards.kind gave up the one it had — 2.2.0
- [ADR-0064](ADR-0064-A-Work-S-Cast-Is-A-Table-With-Per-Row-Provenance-And-It-Holds.md): A work's cast is a table with per-row provenance, and it holds the only tombstone in the schema — unreleased

<a id="area-4"></a>

## §4 What a Quote Is

Three kinds of quote — a book highlight, a screen line, and one belonging to no work at all — converged on a single shape whose differences are enumerated rather than incidental. The dedupe rules and the colour vocabulary are where most of the schema pain lives.

- [ADR-0065](ADR-0065-Dialogues-Shipped-Without-Colour-Tags-Or-Importers.md): Dialogues shipped without colour, tags or importers — Pre-1.0, in §3b as first written
- [ADR-0066](ADR-0066-Annotations-And-Dialogues-Collapse-To-One-Shared-Shape.md): Annotations and dialogues collapse to one shared shape — 1.1.0, with the embed-flattening correction after it
- [ADR-0067](ADR-0067-Dialogue-Gained-Colour-Noted-At-And-Source-Existing-Lines-Land.md): Dialogue gained colour, noted at and source; existing lines land on yellow — 1.1.0
- [ADR-0068](ADR-0068-One-Deliberate-Asymmetry-Note-Only-Is-A-Book-S-Privilege.md): One deliberate asymmetry: note-only is a book's privilege — 1.1.0, extended to the third kind in 1.5.0
- [ADR-0069](ADR-0069-A-Quote-With-No-Book-And-No-Film-Gets-A-Third-Table.md): A quote with no book and no film gets a third table — 1.5.0
- [ADR-0070](ADR-0070-User-Id-On-Utterances-Is-The-Ownership-Path-And-It-Is.md): user id on utterances is the ownership path, and it is load-bearing — 1.5.0
- [ADR-0071](ADR-0071-A-Chapter-S-Number-And-Its-Name-Are-Two-Fields-And-No-Migration.md): A chapter's number and its name are two fields, and no migration guesses which is which — 2.0.1
- [ADR-0072](ADR-0072-The-Dedupe-Hash-Excludes-The-Locator-Except-Where-The-Locator.md): The dedupe hash excludes the locator — except where the locator identifies — 1.3.1 and 1.5.0
- [ADR-0073](ADR-0073-Normalise-Each-Field-Then-Join.md): Normalise each field, then join — 1.5.0
- [ADR-0074](ADR-0074-The-Re-Hash-Repair-Runs-In-Go-On-Every-Migrate-Unguarded-And.md): The re-hash repair runs in Go on every Migrate, unguarded and idempotent — 1.3.1, amended in 1.5.0
- [ADR-0075](ADR-0075-A-Known-Whitespace-Flaw-Was-Recorded-And-Deliberately-Not-Fixed.md): A known whitespace flaw was recorded and deliberately not fixed in the same commit — Recorded at 1.5.0's groundwork, fixed in 1.5.0
- [ADR-0076](ADR-0076-The-Stored-Colour-Token-Never-Moves.md): The stored colour token never moves — 1.7.0
- [ADR-0077](ADR-0077-Slot-1-Is-The-Unset-Default-Recolourable-Never-Nameable-Never.md): Slot 1 is the unset default: recolourable, never nameable, never hideable — 1.7.0
- [ADR-0078](ADR-0078-Hiding-A-Category-Never-Edits-A-Quote.md): Hiding a category never edits a quote — 1.7.0
- [ADR-0079](ADR-0079-Six-Colours-Is-Zero-Schema-Was-Wrong.md): "Six colours is zero schema" was wrong — 1.7.1
- [ADR-0080](ADR-0080-Colour-Slots-Are-Append-Only-And-Their-Order-Is-Frozen.md): Colour slots are append-only and their order is frozen — 1.7.1
- [ADR-0081](ADR-0081-A-Category-Name-Is-Fifteen-Runes-Down-From-Twenty-Four.md): A category name is fifteen runes, down from twenty-four — Unreleased as of 1.7.6
- [ADR-0082](ADR-0082-The-Category-Palette-Leaves-The-App-S-Accent-Neighbourhood-Alone.md): The category palette leaves the app's accent neighbourhood alone — 1.7.0
- [ADR-0083](ADR-0083-Tags-Are-One-Per-User-Vocabulary-Across-Every-Medium-With-No.md): Tags are one per-user vocabulary across every medium, with no auto-GC — 0.x, GC removed with the managed vocabulary
- [ADR-0084](ADR-0084-Nested-Tags-Are-A-Display-Convention-Not-A-Parent-Id.md): Nested tags are a display convention, not a parent id — Not shipped
- [ADR-0085](ADR-0085-Ratings-Retired-In-Two-Stages-With-Two-Dead-Columns-Deliberately.md): Ratings retired in two stages, with two dead columns deliberately left — 0.4.3 and 0.8.5
- [ADR-0086](ADR-0086-Reviving-A-Rating-Is-Recorded-As-A-Reversal-To-Weigh-Not-As.md): Reviving a rating is recorded as a reversal to weigh, not as planned work — Not shipped
- [ADR-0087](ADR-0087-Uploaded-Stickers-Replaced-The-Tag-Derived-Wax-Seal.md): Uploaded stickers replaced the tag-derived wax seal — 0.x
- [ADR-0088](ADR-0088-Five-Starter-Stickers-Seeded-As-Ordinary-Rows-And-Backfilled.md): Five starter stickers, seeded as ordinary rows and backfilled once per instance — 1.7.9
- [ADR-0089](ADR-0089-Per-User-UI-Preferences-Are-One-JSON-Blob-App-Wide-Settings-Are.md): Per-user UI preferences are one JSON blob; app-wide settings are their own table — 0.x
- [ADR-0090](ADR-0090-A-Board-Is-A-Work-And-Quotes-Is-A-Two-Level-Screen-Like-The.md): A board is a work, and /quotes is a two-level screen like the other two — Not shipped
- [ADR-0091](ADR-0091-One-Board-Per-Quote-And-The-Three-That-Exist-Now-Are-Seeded-And.md): One board per quote, and the three that exist now are seeded and then ordinary — Not shipped
- [ADR-0092](ADR-0092-Deleting-A-Board-Asks-Where-Its-Quotes-Go-Which-Is-Why-No-Board.md): Deleting a board asks where its quotes go, which is why no board has to be permanent — Not shipped
- [ADR-0093](ADR-0093-Hiding-A-Board-Is-Explicit-And-All-Quotes-Is-Pinned-Above-Them.md): Hiding a board is explicit, and All quotes is pinned above them — Not shipped
- [ADR-0094](ADR-0094-An-Import-Creates-A-Board-It-Does-Not-Know-And-That-Is-What.md): An import creates a board it does not know, and that is what makes an old export round-trip — Not shipped
- [ADR-0095](ADR-0095-A-Medium-That-Has-No-Such-Locator-Has-Its-Locator-CLEARED-Not.md): A medium that has no such locator has its locator CLEARED, not refused — 2.2.0
- [ADR-0096](ADR-0096-Which-Languages-The-Reader-Can-Read-And-The-Translation-That.md): Which languages the reader can read, and the translation that leads because of them — 3.1.0
- [ADR-0097](ADR-0097-A-Seventh-Quote-Kind-On-The-Sixth-S-Mechanism.md): A seventh quote kind, on the sixth's mechanism — 3.1.0
- [ADR-0098](ADR-0098-A-Sixth-Quote-Kind-And-The-Cheap-Way-To-Widen-A-CHECK.md): A sixth quote kind, and the cheap way to widen a CHECK — 3.1.0
- [ADR-0099](ADR-0099-The-Bulk-Field-Editor-Named-The-Third-Quote-Kind-Twice-And.md): The bulk field editor named the third quote kind twice, and answered 400 to every field it has — 2.2.0
- [ADR-0100](ADR-0100-Stray-Marks-Lists-What-A-Page-Left-In-A-Quote-And-Never-Fixes.md): Stray marks lists what a page left in a quote, and never fixes any of it — 2.2.0
- [ADR-0101](ADR-0101-A-Translation-Is-A-Shared-Quote-Field-Not-A-Per-Kind-One-And.md): A translation is a shared quote field, not a per-kind one — and there is no language beside it — 2.3.0
- [ADR-0102](ADR-0102-A-Card-S-Full-State-Save-Must-Carry-Every-Column-The-Row-Has-And.md): A card's full-state save must carry every column the row has, and the comment saying so was not enough — 2.3.0

<a id="area-5"></a>

## §5 Works, Shelves and Reading History

Books, films and shows share one catalogue shape, and everything about where you stand with a work is either derived from data already present or moved behind its own endpoint so an ordinary save cannot rewrite history.

- [ADR-0103](ADR-0103-TV-Shows-Are-Movie-Rows-With-A-Media-Type-Flag-Not-A-Third.md): TV shows are movie rows with a media type flag, not a third medium duplicating the whole stack — pre-1.0
- [ADR-0104](ADR-0104-Collections-Shipped-With-No-Migration-At-All-The-Column-Had.md): Collections shipped with no migration at all — the column had existed since 0006 and only the affordance was missing — 1.0.1
- [ADR-0105](ADR-0105-Series-For-Books-Collection-For-Films-A-Rename-That-Stops-At-The.md): 'Series' for books, 'collection' for films — a rename that stops at the UI, with the plural carried explicitly — 1.0.1
- [ADR-0106](ADR-0106-Season-And-Episode-Are-A-Show-S-Locator-Nullable-With-NULL-The.md): Season and episode are a show's locator, nullable, with NULL the only unset because season 0 is a real season — 1.3.0
- [ADR-0107](ADR-0107-A-Film-S-Season-And-Episode-Are-Dropped-Rather-Than-Refused-So.md): A film's season and episode are dropped rather than refused, so flipping a show to a film does not brick its edit form — 1.3.0
- [ADR-0108](ADR-0108-Dialogue-Order-Is-Season-Then-Episode-Then-Clock-Then-Id-One.md): Dialogue order is season, then episode, then clock, then id — one definition shared by the list and the export — 1.3.0
- [ADR-0109](ADR-0109-Shelf-Status-Is-Drawn-As-A-Colour-Bar-Under-The-Artwork-Never-A.md): Shelf status is drawn as a colour bar under the artwork, never a badge over it, and --accent is deliberately not the in-flight colour — 1.3.0
- [ADR-0110](ADR-0110-The-Reading-Mark-Became-An-Opaque-Disc-Contrast-From-A-Blur-Halo.md): The reading mark became an opaque disc: contrast from a blur halo does not survive an 18px cover — post-1.3.0
- [ADR-0111](ADR-0111-The-Wishlist-Is-Derived-From-The-Annotation-Count-With-No-Column.md): The wishlist is derived from the annotation count, with no column and no bookkeeping — 1.3.0
- [ADR-0112](ADR-0112-Progress-Is-Derived-From-A-Position-In-The-Work-S-Own-Units-And.md): Progress is derived from a position in the work's own units, and a count with no total is refused rather than stored — 1.3.0
- [ADR-0113](ADR-0113-A-Read-Log-So-A-Reread-Is-History-Rather-Than-An-Overwrite.md): A read log, so a reread is history rather than an overwrite — 1.3.0
- [ADR-0114](ADR-0114-Outcome-Rather-Than-A-Bare-Finished-At-Keeps-The-Read-Counter.md): outcome rather than a bare finished at keeps the read counter honest, with triggers standing in for a cross-table cascade — 1.3.0
- [ADR-0115](ADR-0115-Read-Dates-Are-Partial-TEXT-Compared-Lexically-Then-Required-To.md): Read dates are partial TEXT compared lexically — then required to be real calendar dates — 1.3.0, corrected later
- [ADR-0116](ADR-0116-Status-Progress-And-The-Read-Log-Move-Together-Through-Their-Own.md): Status, progress and the read log move together through their own endpoint, never the full-state PUT — 1.3.0
- [ADR-0117](ADR-0117-Completed-Is-Settled-But-Clearing-To-Empty-Stays-Legal-From.md): completed is settled, but clearing to empty stays legal from every state as the undo for a mis-tap — 1.3.0
- [ADR-0118](ADR-0118-The-Shelf-Cap-Is-A-Client-Side-Nudge-Of-5-Books-2-Films-5-Shows.md): The shelf cap is a client-side nudge of 5 books · 2 films · 5 shows, never enforced by the server — 1.3.0
- [ADR-0119](ADR-0119-The-Read-Log-Became-Directly-Editable-But-The-Open-Read-Stays.md): The read log became directly editable, but the open read stays out of reach — it is the consistency between status and log — 1.7.4
- [ADR-0120](ADR-0120-Last-Read-Sorts-On-The-Finish-Date-Falls-Back-To-The-Start.md): 'Last read' sorts on the finish date, falls back to the start, counts every outcome, and puts never-logged works last — 1.7.2
- [ADR-0121](ADR-0121-Years-May-Be-Negative-And-Estimated-And-Needed-No-Schema-Change.md): Years may be negative and estimated, and needed no schema change — 0 already meant 'not recorded' — 1.7.4
- [ADR-0122](ADR-0122-The-Partial-Date-TEXT-Columns-Are-Deliberately-Not-Extended-To.md): The partial-date TEXT columns are deliberately not extended to BCE, because a leading minus breaks lexical order — 1.7.4
- [ADR-0123](ADR-0123-A-Year-Is-Written-Not-Signed-And-C-Marks-An-Estimate-Without.md): A year is written, not signed, and 'c.' marks an estimate without moving anything — 1.7.4
- [ADR-0124](ADR-0124-The-Completeness-Score-Asks-Whether-A-Year-Is-Present-Not.md): The completeness score asks whether a year is present, not whether it is positive — 1.7.4
- [ADR-0125](ADR-0125-Page-Count-Is-Deliberately-Not-A-Metadata-Field-It-Is-Already.md): Page count is deliberately not a metadata field — it is already the progress denominator — not built (recorded on the backlog)
- [ADR-0126](ADR-0126-Shelf-Belongs-To-Reading-Status-So-The-Collections-Backlog.md): 'Shelf' belongs to reading status, so the collections backlog section became 'tag shelves' — post-1.3.0
- [ADR-0127](ADR-0127-The-Shelf-And-The-Read-Log-Feed-Nothing-Else-And-Every.md): The shelf and the read log feed nothing else, and every temptation to wire them into stats is named — post-1.3.0
- [ADR-0128](ADR-0128-Games-Are-A-Third-Media-Type-On-Movies-Not-A-Games-Table.md): Games are a third media type on movies, not a games table — 0040
- [ADR-0129](ADR-0129-A-Game-Is-Played-And-Every-Shelf-Arm-Is-Named-Rather-Than.md): A game is played, and every shelf arm is named rather than defaulted — 0040

<a id="area-6"></a>

## §6 People, Credits and Metadata Providers

Credits are stored exactly as they arrive and split only when read, so a wrong split costs a wrong grouping and never a corrupted field. Providers are consulted on demand, pinned to an identity rather than a name, and never allowed to overwrite something you typed without being asked.

- [ADR-0130](ADR-0130-People-Were-Keyed-On-User-Id-Kind-Name-Making-A-Role-Part-Of.md): People were keyed on (user id, kind, name), making a role part of identity
- [ADR-0131](ADR-0131-One-Row-Per-Person-Keyed-On-Name-With-Roles-As-A-Set.md): One row per person keyed on name, with roles as a set — `internal/store/migrations/0027_people_one_row.sql`
- [ADR-0132](ADR-0132-Identity-Moved-Off-The-Name-And-Onto-An-Id-The-Credit-Columns.md): Identity moved off the name and onto an id; the credit columns became a derived cache
- [ADR-0133](ADR-0133-The-Cache-Keeps-The-Reader-S-Spelling-It-Is-Rewritten-Only-When.md): The cache keeps the reader's spelling; it is rewritten only when it stops being true — `internal/store/credits.go`
- [ADR-0134](ADR-0134-Characters-Are-Their-Own-Table-Not-People-With-A-Kind.md): Characters are their own table, not people with a kind — `internal/store/migrations/0056_person_identity.sql`
- [ADR-0135](ADR-0135-A-Quote-S-Speaker-Is-A-Column-On-The-Quote-Not-A-Work-Person-Row.md): A quote's speaker is a column on the quote, not a work person row
- [ADR-0136](ADR-0136-A-Quote-S-Speaker-Is-A-Cast-Row-As-Well-As-A-Person.md): A quote's speaker is a cast row as well as a person
- [ADR-0137](ADR-0137-One-Quote-Names-One-Speaker-A-Line-Credited-To-Two-Performers.md): One quote names one speaker; a line credited to two performers links to neither — `internal/store/quote_person.go`
- [ADR-0138](ADR-0138-A-Merge-Leaves-The-Spelling-A-Record-Rename-Moves-It.md): A merge leaves the spelling; a record rename moves it
- [ADR-0139](ADR-0139-A-Restored-Quote-Is-Re-Linked-From-Its-Name-Not-From-The-Id-In.md): A restored quote is re-linked from its name, not from the id in the snapshot — `internal/httpapi/trash_handlers.go`
- [ADR-0140](ADR-0140-A-Character-Merge-Is-The-Person-Merge-With-Three-Things-A.md): A character merge is the person merge with three things a character does not have
- [ADR-0141](ADR-0141-A-Global-Record-Delete-Is-Binned-A-Cast-Row-S-Is-Not.md): A global record delete is binned; a cast row's is not
- [ADR-0142](ADR-0142-The-People-Review-List-Is-Keyed-On-Records-People-Names-Keeps.md): The people review list is keyed on records; /people/names keeps its own question — `internal/httpapi/identity_handlers.go`
- [ADR-0143](ADR-0143-Everyone-On-One-Work-Is-One-Read-Not-Three-The-Client-Stitches.md): Everyone on one work is one read, not three the client stitches
- [ADR-0144](ADR-0144-The-3-1-0-Backfill-Splits-Credits-And-Refuses-To-Weld-Characters.md): The 3.1.0 backfill splits credits and refuses to weld characters — `internal/store/onetime_3_1_0_person_identity.go`
- [ADR-0145](ADR-0145-The-Lossy-People-Merge-Has-A-Written-Survivor-Rule.md): The lossy people merge has a written survivor rule — `internal/store/migrations/0027_people_one_row.sql`
- [ADR-0146](ADR-0146-Person-Kinds-Carries-No-CHECK-Because-A-CHECK-Is-Evaluated.md): person kinds carries no CHECK, because a CHECK is evaluated against data already out in the world
- [ADR-0147](ADR-0147-The-Orphan-Sweep-Un-Files-A-Role-Instead-Of-Deleting-A-Person.md): The orphan sweep un-files a role instead of deleting a person, and its switch has no defaulting arm — `internal/httpapi/people_handlers.go`
- [ADR-0148](ADR-0148-PersonCreditSQL-Returns-The-Scan-And-The-Update-Together.md): personCreditSQL returns the scan and the update together — `internal/httpapi/people_handlers.go` · `internal/httpapi/people_gc_test.go`
- [ADR-0149](ADR-0149-A-Speaker-Rename-Re-Hashes-That-Account-S-Quotes-And-A-Collision.md): A speaker rename re-hashes that account's quotes, and a collision leaves one row on its old hash — `internal/httpapi/people_handlers.go`
- [ADR-0150](ADR-0150-Credits-Are-Stored-Verbatim-And-Split-At-Read-Time.md): Credits are stored verbatim and split at read time — `internal/metadata/credits.go`
- [ADR-0151](ADR-0151-Duplicate-People-Are-Merged-By-Rewriting-The-Library-Not-By.md): Duplicate people are merged by rewriting the library, not by aliasing — `internal/httpapi/people_handlers.go`
- [ADR-0152](ADR-0152-Portraits-Resolve-A-Pinned-Identity-Rather-Than-A-Name.md): Portraits resolve a pinned identity rather than a name — `internal/httpapi/portrait_handlers.go` · `internal/metadata/people.go`
- [ADR-0153](ADR-0153-Directors-And-Actor-Headshots-Come-From-The-TMDB-Payload-Already.md): Directors and actor headshots come from the TMDB payload already cached on the film — `internal/httpapi/portrait_handlers.go` · `docs/wiki/Design-decisions.md`
- [ADR-0154](ADR-0154-Wikidata-Was-Dropped-As-A-Metadata-Source-Then-Re-Admitted-For.md): Wikidata was dropped as a metadata source, then re-admitted for one portrait fallback
- [ADR-0155](ADR-0155-Hardcover-Was-Dropped-As-An-API-Integration-Then-Re-Entered-As.md): Hardcover was dropped as an API integration, then re-entered as an HTML scraper
- [ADR-0156](ADR-0156-Metadata-Is-Fetched-When-Somebody-Asks-And-A-Pass-Over-Many.md): Metadata is fetched when somebody asks, and a pass over many works is a job on the server — the jobs 3.1.0
- [ADR-0157](ADR-0157-TMDB-Ships-A-Built-In-Application-Key-And-The-Env-Var-Was.md): TMDB ships a built-in application key, and the env var was dropped
- [ADR-0158](ADR-0158-Provider-Secrets-Are-Booleans-On-Read-And-Pointers-On-Write-And.md): Provider secrets are booleans on read and pointers on write, and traces redact query-param keys — `internal/httpapi/metadata_handlers.go` · `internal/metadata/metadata.go`
- [ADR-0159](ADR-0159-Name-Fields-Capitalise-In-The-Input-Promote-Only-And-Yield-On-A.md): Name fields capitalise in the input, promote-only, and yield on a case edit — 1.7.8
- [ADR-0160](ADR-0160-A-Film-S-Supplier-Ids-Are-Editable-And-A-Typed-Id-Pins-The-Next.md): A film's supplier ids are editable, and a typed id pins the next search — 1.7.8 (reversal)
- [ADR-0161](ADR-0161-The-Legacy-PUT-Movies-Id-Tmdb-Id-Re-Sync-Is-Told-Apart-From-An.md): The legacy PUT /movies/:id {tmdb id} re-sync is told apart from an id edit by the title — `internal/httpapi/movie_handlers.go`
- [ADR-0162](ADR-0162-A-Rejected-Key-Is-Reported-As-A-Rejected-Key.md): A rejected key is reported as a rejected key
- [ADR-0163](ADR-0163-Where-The-Facts-Come-From-Lives-Beside-The-Records-It-Configures.md): Where the facts come from lives beside the records it configures
- [ADR-0164](ADR-0164-A-Status-Chip-Appears-Only-Where-There-Is-Something-To-Say-And.md): A status chip appears only where there is something to say, and "working" is silence
- [ADR-0165](ADR-0165-The-IGDB-Pair-Gets-Two-Rows-And-One-Warning-And-The-Warning-Is.md): The IGDB pair gets two rows and one warning, and the warning is only for half a pair — 1.15.3
- [ADR-0166](ADR-0166-Covers-Are-Downloaded-Once-And-Served-Locally-Never-Hotlinked.md): Covers are downloaded once and served locally, never hotlinked — `docs/wiki/Design-decisions.md` · `internal/metadata/covers.go`
- [ADR-0167](ADR-0167-Cover-Fetches-Go-Through-An-SSRF-Host-Allowlist-That-Follows.md): Cover fetches go through an SSRF host allowlist that follows redirects — `internal/metadata/covers.go` · `docs/wiki/Design-decisions.md`
- [ADR-0168](ADR-0168-The-Stored-Extension-Comes-From-The-Content-Sniff-Never-The-URL.md): The stored extension comes from the content sniff, never the URL — `internal/metadata/covers.go`
- [ADR-0169](ADR-0169-Cover-Art-Is-Upgraded-At-The-URL-Level-Preferring-Amazon-S.md): Cover art is upgraded at the URL level, preferring Amazon's keyless ISBN-10 CDN — `internal/metadata/amazon.go` · `internal/metadata/covers.go`
- [ADR-0170](ADR-0170-Missing-Only-A-Refetch-Mode-That-Never-Replaces-Stored-Art.md): missing only — a refetch mode that never replaces stored art
- [ADR-0171](ADR-0171-Fetch-Metadata-Opens-The-Edition-Picker-Instead-Of-Silently.md): "Fetch metadata" opens the edition picker instead of silently applying a guess — `web/frontend/src/WorkDetails.jsx`
- [ADR-0172](ADR-0172-Metadata-Adoption-Has-Two-Modes-Overwrite-On-An-Explicit-Pick.md): Metadata adoption has two modes: overwrite on an explicit pick, fill-empty-only on a one-click fetch — `internal/httpapi/metadata_handlers.go` · `web/frontend/src/WorkDetails.jsx`
- [ADR-0173](ADR-0173-Re-Verify-Previews-Every-Changed-Field-Against-The-Pinned.md): Re-verify previews every changed field against the pinned identity and writes nothing until approved
- [ADR-0174](ADR-0174-An-ISBN-Names-One-Book-So-Provider-Records-Are-Merged-Best-Of.md): An ISBN names one book, so provider records are merged best-of per field — `internal/metadata/books.go`
- [ADR-0175](ADR-0175-AdoptFirstPublished-Takes-Min-Year-And-SameWork-Stays-Narrow.md): adoptFirstPublished takes min(year), and sameWork stays narrow enough that Ulysses does not merge with Ulysses — `internal/metadata/books.go` · `internal/metadata/first_published_test.go`
- [ADR-0176](ADR-0176-Book-Lookup-Matches-Title-And-Author-Falling-Back-To-Title-Only.md): Book lookup matches title and author, falling back to title-only — `internal/metadata/books.go`
- [ADR-0177](ADR-0177-Look-Alike-Titles-Are-Flagged-For-Review-Never-Auto-Merged.md): Look-alike titles are flagged for review, never auto-merged
- [ADR-0178](ADR-0178-Speaker-Remap-Matches-The-Original-Character-And-Never-Erases-A.md): Speaker remap matches the original character and never erases a speaker — `internal/httpapi/metadata_library.go`
- [ADR-0179](ADR-0179-Missing-Actor-Counts-Only-The-Lines-That-Could-Actually-Be.md): missing actor counts only the lines that could actually be filled — `internal/httpapi/metadata_library.go`
- [ADR-0180](ADR-0180-A-Movie-Resync-Overwrites-Supplier-Fields-And-Never-User-Owned.md): A movie resync overwrites supplier fields and never user-owned ones — `internal/httpapi/movie_handlers.go`
- [ADR-0181](ADR-0181-Genres-Are-Title-Cased-With-Acronyms-Preserved-And-Are.md): Genres are Title-Cased with acronyms preserved, and are garbage-collected where tags are not — `internal/httpapi/taxonomy_handlers.go`
- [ADR-0182](ADR-0182-Metadata-API-Keys-Save-Per-Field-And-A-Stored-Secret-Is.md): Metadata API keys save per field, and a stored secret is write-only with a badge — `web/frontend/src/Settings.jsx` · `internal/httpapi/metadata_handlers.go`
- [ADR-0183](ADR-0183-Credit-Separators-Are-A-Section-Of-The-Metadata-Card-Not-A-Card.md): Credit separators are a section of the Metadata card, not a card of their own — `web/frontend/src/Settings.jsx`
- [ADR-0184](ADR-0184-A-Descriptive-User-Agent-Because-Open-Library-Rate-Limits-On-It.md): A descriptive User-Agent, because Open Library rate-limits on it — `internal/metadata/metadata.go` · `internal/metadata/amazon.go`
- [ADR-0185](ADR-0185-Provider-Scrapers-Use-Regexes-Over-Stable-Markers-Rather-Than.md): Provider scrapers use regexes over stable markers rather than adding an HTML parser
- [ADR-0186](ADR-0186-The-Amazon-Cookie-Is-Opt-In-Write-Only-And-Its-Risk-Is-Stated.md): The Amazon cookie is opt-in, write-only, and its risk is stated rather than softened — `README.md`
- [ADR-0187](ADR-0187-Fan-Out-To-Every-Source-Is-Slower-And-Worse-A-Per-Kind-Source.md): Fan-out to every source is slower and worse; a per-kind source picker is the planned answer — `docs/roadmap.html` · `internal/httpapi/metadata_handlers.go`
- [ADR-0188](ADR-0188-The-Character-To-Actor-Mapping-Is-Already-Stored-So-Character.md): The character-to-actor mapping is already stored, so character chips need no IMDb at all — Not shipped
- [ADR-0189](ADR-0189-A-Character-S-Aliases-Are-The-Slashes-In-Its-Own-Name-Computed.md): A character's aliases are the slashes in its own name, computed rather than stored — Not shipped
- [ADR-0190](ADR-0190-Names-In-The-Line-Become-Chips-The-Credits-Below-Become-Text.md): Names in the line become chips; the credits below become text — Not shipped
- [ADR-0191](ADR-0191-The-In-Costume-Still-Is-The-Only-Part-That-Needs-IMDb-So-It-Is.md): The in-costume still is the only part that needs IMDb, so it is opt-in, per character, and cached hard — Not shipped
- [ADR-0192](ADR-0192-IGDB-For-Games-Wikidata-For-Their-Voice-Cast-Because-Nothing.md): IGDB for games, Wikidata for their voice cast, because nothing else exists — 0040
- [ADR-0193](ADR-0193-A-Studio-And-A-Director-Share-One-Column-So-Every-Query-Keyed-On.md): A studio and a director share one column, so every query keyed on either must name the media type — 0040
- [ADR-0194](ADR-0194-A-Game-S-Publisher-Is-Its-Own-Column-And-The.md): A game's publisher is its own column, and the developer-to-publisher fallback is gone — 0042
- [ADR-0195](ADR-0195-The-Metadata-Screen-Is-Five-Sections-Behind-A-Rail-And-A-Phone.md): The Metadata screen is five sections behind a rail, and a phone gets the same five — 3.1.0
- [ADR-0196](ADR-0196-Where-Metadata-Comes-From-Moved-From-Settings-To-Metadata-Whole.md): Where metadata comes from moved from Settings to Metadata, whole and unchanged — 3.1.0
- [ADR-0197](ADR-0197-A-Character-S-Page-Is-The-Destination-And-A-Work-Is-Taken-Off-It.md): A character's page is the destination, and a work is taken off it only after its quotes are dealt with — 3.1.0
- [ADR-0198](ADR-0198-A-Book-Gains-A-Subtitle-A-Publisher-And-An-Extent-And-None-Of-It.md): A book gains a subtitle, a publisher and an extent, and none of it is newly fetched — 0061
- [ADR-0199](ADR-0199-A-Work-Links-Out-To-Any-Site-And-An-Unrecognised-Address-Is-A.md): A work links out, to any site, and an unrecognised address is a link and not a mistake — 0062

<a id="area-7"></a>

## §7 Search and the Full-Text Index

Search is FTS5 external-content indexes maintained by triggers, which buys me not storing every quote twice and costs a corruption mode that took four attempts to recover from. Every query string is escaped on the way in, and the facet work is planned so that a malformed query is impossible to send rather than merely rejected.

- [ADR-0200](ADR-0200-External-Content-FTS5-Indexes-Kept-In-Sync-By-Triggers.md): External-content FTS5 indexes, kept in sync by triggers — from 0.1.0
- [ADR-0201](ADR-0201-Changing-Indexed-Columns-Means-Dropping-And-Rebuilding-The-Table.md): Changing indexed columns means dropping and rebuilding the table — 0.9.x (migration 0010)
- [ADR-0202](ADR-0202-FTS-Index-Names-Are-Constrained-In-Two-Silent-Directions.md): FTS index names are constrained in two silent directions — 1.5.0 (recorded), applies from 0001
- [ADR-0203](ADR-0203-Raw-Input-Never-Reaches-An-FTS5-MATCH-And-LIKE-Is-Banned.md): Raw input never reaches an FTS5 MATCH, and LIKE '%…%' is banned — from 0.1.0
- [ADR-0204](ADR-0204-Prefix-2-3-And-Remove-Diacritics-2-Plus-A-200-Ms-Client-Debounce.md): prefix='2 3' and remove diacritics 2, plus a 200 ms client debounce — from 0.1.0
- [ADR-0205](ADR-0205-One-Search-Endpoint-For-Free-Text-Structured-Filters-Stay-On-The.md): One /search endpoint for free text; structured filters stay on the lists — from 0.1.0
- [ADR-0206](ADR-0206-Results-Are-Sectioned-By-What-Matched-With-A-Cross-Column.md): Results are sectioned by what matched, with a cross-column fallback — 0.9.1
- [ADR-0207](ADR-0207-What-Gets-Indexed-Is-Prose-Not-Filter-Values.md): What gets indexed is prose, not filter values — 1.5.0
- [ADR-0208](ADR-0208-Search-Must-Count-Only-What-It-Can-Show.md): Search must count only what it can show — 1.5.0
- [ADR-0209](ADR-0209-Typo-Correction-Runs-Only-On-Zero-Hits-Over-Zero-Storage-Vocab.md): Typo correction runs only on zero hits, over zero-storage vocab views — 0.6.9
- [ADR-0210](ADR-0210-The-Last-Token-Is-Corrected-In-Prefix-Mode-With-No-Upper-Length.md): The last token is corrected in prefix mode with no upper length bound — 0.6.9
- [ADR-0211](ADR-0211-Corrected-Tokens-Flow-Back-Through-PrefixQuery-And-Corrected-Is.md): Corrected tokens flow back through PrefixQuery, and corrected is scoped — 0.6.9
- [ADR-0212](ADR-0212-Structured-Facets-Parse-The-Raw-Query-Only-Never-The-Fuzzy.md): Structured facets parse the raw query only, never the fuzzy re-run — 0.9.1 (facets), 0.6.9 (fuzzy interaction)
- [ADR-0213](ADR-0213-Tag-And-Genre-Facets-Carry-The-User-Scope-On-Both-Halves.md): Tag and genre facets carry the user scope on both halves — 1.5.0
- [ADR-0214](ADR-0214-Edition-Grouping-In-Book-Search-Is-Strict-On-Purpose.md): Edition grouping in book search is strict on purpose — 1.0.0
- [ADR-0215](ADR-0215-Corrupt-Index-Recovery-Escalated-Three-Times-Before-It-Worked.md): Corrupt-index recovery escalated three times before it worked — 0.4.6 → 0.4.7 → 0.6.4
- [ADR-0216](ADR-0216-FtsQuery-Repairs-In-Request-And-Refuses-To-Escalate-On-The-Hot.md): ftsQuery repairs in-request, and refuses to escalate on the hot path — 0.6.4
- [ADR-0217](ADR-0217-A-Searched-Quote-Wears-Its-Colour-Falling-Back-To-The-Border.md): A searched quote wears its colour, falling back to the border — 1.7.5
- [ADR-0218](ADR-0218-Search-Facet-Grammar-Lives-Entirely-On-The-Client-The-Wire.md): Search facet grammar lives entirely on the client; the wire format stays typed — 1.10.0
- [ADR-0219](ADR-0219-AND-Or-OR-Is-A-Property-Of-The-Facet-Not-A-Global-Rule.md): AND or OR is a property of the facet, not a global rule — 1.10.0
- [ADR-0220](ADR-0220-Language-Is-The-Nineteenth-Facet-And-It-Matches-A-Whole-Value.md): language is the nineteenth facet, and it matches a whole value rather than a word — Unreleased
- [ADR-0221](ADR-0221-Facet-Values-Never-Reach-A-MATCH-And-An-Unknown-Facet-Is-A-400.md): Facet values never reach a MATCH, and an unknown facet is a 400 — 1.10.0
- [ADR-0222](ADR-0222-Search-Vocabulary-Is-One-Cached-Call-Returning-Colours-As-Key.md): Search vocabulary is one cached call, returning colours as key and name — 1.10.0
- [ADR-0223](ADR-0223-Context-Aware-Search-Made-Visible-And-Removable-With-A.md): Context-aware search made visible and removable, with a right-click globe — 1.10.0
- [ADR-0224](ADR-0224-Filter-Sheets-Are-Rewired-Onto-The-Facet-State-Rather-Than.md): Filter sheets are rewired onto the facet state rather than replaced — 1.10.0
- [ADR-0225](ADR-0225-Four-Things-The-Facet-Plan-Had-Wrong-Found-By-Building-It.md): Four things the facet plan had wrong, found by building it — 1.10.0 · recorded 1.14.2
- [ADR-0226](ADR-0226-What-A-Board-Filter-Means-To-A-Search-Is-Decided-Before-The.md): What a board filter means to a search is decided before the filter ships — 1.14.2
- [ADR-0227](ADR-0227-More-Like-This-From-The-Existing-Term-Dictionaries-Ships-First.md): "More like this" from the existing term dictionaries ships first — not being built
- [ADR-0228](ADR-0228-Semantic-Search-And-Sqlite-Vec-Deferred-Indefinitely-As-A.md): Semantic search and sqlite-vec deferred indefinitely, as a decision — deferred from 0.1.0
- [ADR-0229](ADR-0229-A-Feature-Nobody-Can-Find-Has-Not-Shipped.md): A feature nobody can find has not shipped — 1.16.0
- [ADR-0230](ADR-0230-The-Combining-Rule-Decides-How-A-Facet-Is-Counted-And-Getting-It.md): The combining rule decides how a facet is counted, and getting it uniform makes one of the two lie — 1.16.0
- [ADR-0231](ADR-0231-Book-And-Movie-Became-Grammar-Reversing-There-Is-No-Vocabulary.md): book: and movie: became grammar, reversing "there is no vocabulary of titles" — 1.16.0
- [ADR-0232](ADR-0232-A-Character-Is-Not-A-Person-And-Gets-A-Section-Rather-Than-A.md): A character is not a person, and gets a section rather than a face — 1.16.0
- [ADR-0233](ADR-0233-Three-Of-Eleven-New-Columns-Were-Indexed-And-The-Other-Eight-Are.md): Three of eleven new columns were indexed, and the other eight are a decision — 2.2.0
- [ADR-0234](ADR-0234-Character-Reaches-A-Book-Highlight-And-The-Sentence-That-Said-It.md): character: reaches a book highlight, and the sentence that said it could not has been rewritten — 2.2.0

<a id="area-8"></a>

## §8 The Review Loop

Spaced repetition is an exponential forgetting curve evaluated in SQL at query time, chosen so that due-ness needs no stored due date and no background sweep. Almost every subsequent decision here is a reversal, including the two that removed a feature and brought it back.

- [ADR-0235](ADR-0235-Recall-Is-Computed-At-Query-Time-From-A-Stored-Half-Life.md): Recall is computed at query time from a stored half-life — 0.4.0
- [ADR-0236](ADR-0236-Review-State-Lives-In-Its-Own-Table.md): Review state lives in its own table — 0.4.0
- [ADR-0237](ADR-0237-Annotation-Reviews-Became-A-Polymorphic-Item-Reviews.md): annotation reviews became a polymorphic item reviews — 0.5.0
- [ADR-0238](ADR-0238-Quiz-Results-Was-Replaced-By-Quiz-Sessions-And-The-Old-Score.md): quiz results was replaced by quiz sessions, and the old score history dropped — 0.5.0
- [ADR-0239](ADR-0239-Configurable-SrGrow-SrShrink-Half-Life-Multipliers.md): Configurable srGrow / srShrink half-life multipliers — 0.4.3
- [ADR-0240](ADR-0240-A-Fixed-Ladder-Replaced-The-Tunable-Rule-At-7-30-100.md): A fixed ladder replaced the tunable rule, at 7 → 30 → 100 — 0.9.5
- [ADR-0241](ADR-0241-The-Ladder-S-Ceiling-Is-A-Year-And-The-Fourth-Rung-Is-Where.md): The ladder's ceiling is a year, and the fourth rung is where capacity comes from — 3.1.0
- [ADR-0242](ADR-0242-The-Half-Life-Floor-Rose-From-1-Day-To-7-With-A-Grace-Week-For-A.md): The half-life floor rose from 1 day to 7, with a grace week for a new quote — 0.8.6
- [ADR-0243](ADR-0243-A-Recorded-Lapse-Is-Decisive.md): A recorded lapse is decisive — 0.6.2
- [ADR-0244](ADR-0244-Repetition-Statuses-Renamed-To-Describe-Recall-And-Derived-Live.md): Repetition statuses renamed to describe recall, and derived live — 0.5.0
- [ADR-0245](ADR-0245-Daily-Quiz-And-Practice-Are-Two-Modes-With-Different-Contracts.md): Daily Quiz and Practice are two modes with different contracts — 0.5.0
- [ADR-0246](ADR-0246-Multiple-Choice-Was-Removed-For-Self-Graded-Recall-Then-Restored.md): Multiple choice was removed for self-graded recall, then restored — Removed 0.5.0, restored 0.6.1
- [ADR-0247](ADR-0247-Distractors-Are-Chosen-To-Be-Plausible-And-The-Rule-Differs-By.md): Distractors are chosen to be plausible, and the rule differs by medium — 0.6.1
- [ADR-0248](ADR-0248-Quiz-Options-Are-Sent-Whole-And-Clamped-On-The-Client.md): Quiz options are sent whole and clamped on the client — 1.5.2
- [ADR-0249](ADR-0249-The-Quiz-Option-S-Expander-Is-Its-Own-Button.md): The quiz option's expander is its own button — 1.5.2
- [ADR-0250](ADR-0250-The-Daily-Quiz-Seeds-Every-Shuffle.md): The Daily Quiz seeds every shuffle — 1.x
- [ADR-0251](ADR-0251-The-Deck-Served-The-Same-Few-Books-For-Weeks.md): The deck served the same few books for weeks — 1.0.0
- [ADR-0252](ADR-0252-Deck-Ordering-Hashes-The-Id-The-Buckets-Are-Fetched-Separately.md): Deck ordering hashes the id, the buckets are fetched separately, and spreadByWork rotates — 1.0.0
- [ADR-0253](ADR-0253-Every-Third-Daily-Slot-Is-Reserved-For-A-Never-Seen-Card.md): Every third Daily slot is reserved for a never-seen card — 1.0.0
- [ADR-0254](ADR-0254-Quotes-Not-Yet-Asked-Lead-The-Deck-In-The-Daily-Quiz-And-In.md): Quotes not yet asked lead the deck, in the Daily Quiz and in Practice — 3.0.3
- [ADR-0255](ADR-0255-ReviewSource-Descriptors-Put-The-Five-Queries-That-Must-Agree-In.md): reviewSource descriptors put the five queries that must agree in one place — 1.5.0
- [ADR-0256](ADR-0256-A-Standalone-Quote-S-Card-Is-Sourced-From-The-Occasion-Falling.md): A standalone quote's card is sourced from the occasion, falling back to the speaker — 1.5.0
- [ADR-0257](ADR-0257-A-Quote-With-Neither-Speaker-Nor-Occasion-Is-Kept-But-Never.md): A quote with neither speaker nor occasion is kept but never enters the deck — 1.5.0
- [ADR-0258](ADR-0258-Review-Scope-Was-An-Exclusive-Three-Way-Toggle-Whose-Both-Named.md): Review scope was an exclusive three-way Toggle whose "Both" named three media — Broken from 1.5.0, fixed in 1.7.0
- [ADR-0259](ADR-0259-Review-Scope-Became-Three-Independent-Choices-In-One.md): Review scope became three independent choices in one comma-separated string — 1.7.0
- [ADR-0260](ADR-0260-An-Unparseable-Or-Unknown-Scope-Means-Everything-Never-Nothing.md): An unparseable or unknown scope means everything, never nothing — 1.7.0
- [ADR-0261](ADR-0261-Seeing-A-Quote-Can-Reinforce-It-Opt-In-And-Marginal.md): "Seeing" a quote can reinforce it, opt-in and marginal — 0.6.2
- [ADR-0262](ADR-0262-A-Daily-Re-Answer-On-The-Same-Local-Day-Is-An-Idempotent-Echo.md): A Daily re-answer on the same local day is an idempotent echo — 1.x
- [ADR-0263](ADR-0263-ItemAgeDays-And-OwnsItem-Switch-Exhaustively.md): itemAgeDays and ownsItem switch exhaustively — 1.5.0
- [ADR-0264](ADR-0264-The-Reviewer-S-Local-Day-Comes-From-A-Client-Sent-UTC-Offset.md): The reviewer's local day comes from a client-sent UTC offset — 0.4.0
- [ADR-0265](ADR-0265-A-Failed-Grade-Save-Keeps-The-Reveal-And-Always-Lets-The-Reader.md): A failed grade save keeps the reveal and always lets the reader advance — 1.0.0
- [ADR-0266](ADR-0266-A-Grade-Is-Kept-On-The-Device-And-Sent-Until-The-Server-Takes-It.md): A grade is kept on the device and sent until the server takes it — Unreleased
- [ADR-0267](ADR-0267-Practice-State-Persists-Per-User-Not-Per-Browser.md): Practice state persists per user, not per browser — 0.9.2
- [ADR-0268](ADR-0268-The-Fixed-Ladder-Stays-The-Default-Adaptive-Intervals-Would-Ship.md): The fixed ladder stays the default; adaptive intervals would ship beside it — 1.15.0
- [ADR-0269](ADR-0269-Adaptive-Intervals-Became-The-Default-And-The-Ladder-Became-The.md): Adaptive intervals became the default, and the ladder became the opt-in — 3.1.0
- [ADR-0270](ADR-0270-A-Typed-Blank-Is-Graded-At-One-Width-The-Tier-S-Recomputed-And.md): A typed blank is graded at one width — the tier's, recomputed — and the union of widths was withdrawn — 3.1.0
- [ADR-0271](ADR-0271-The-Quiz-Has-Three-Difficulties-And-A-Tier-Is-A-Property-Of-The.md): The quiz has three difficulties, and a tier is a property of the round — 3.1.0
- [ADR-0272](ADR-0272-At-Most-One-Card-In-Three-Offers-A-Wrong-Answer-By-The-Right.md): At most one card in three offers a wrong answer by the right answer's own author — 3.1.0
- [ADR-0273](ADR-0273-An-Easy-Card-Names-Who-Is-In-The-Line-And-Never-On-A-Card-That.md): An easy card names who is in the line, and never on a card that asks it — 3.1.0
- [ADR-0274](ADR-0274-A-Fill-In-The-Blank-Card-S-Wrong-Options-Are-Ranked-By-How-Much.md): A fill-in-the-blank card's wrong options are ranked by how much they look like the answer, and none of them is a second right answer — 3.1.0
- [ADR-0275](ADR-0275-The-Due-Point-Is-One-Number-Named-With-The-Dot-And-The-Deck.md): The due point is one number, named, with the dot and the deck derived from it — 3.1.0
- [ADR-0276](ADR-0276-A-Person-Card-Masks-Its-Own-Answer-In-The-Words-It-Shows.md): A person card masks its own answer in the words it shows — 3.1.0
- [ADR-0277](ADR-0277-Cloze-Review-Computes-The-Masked-Span-At-Request-Time-No-Schema.md): Cloze review computes the masked span at request time — no schema, no storage — 1.15.0
- [ADR-0278](ADR-0278-Achievements-Are-Off-By-Default-Computed-At-Query-Time-One.md): Achievements are off by default, computed at query time, one streak — Not shipped
- [ADR-0279](ADR-0279-A-Card-S-Difficulty-Is-A-Property-Of-The-Library-And-Nothing-In.md): A card's difficulty is a property of the library, and nothing in the deck knew it — Not shipped
- [ADR-0280](ADR-0280-The-Question-S-Grain-Follows-The-Series-And-That-Is-Not-A.md): The question's grain follows the series, and that is not a preference — Not shipped
- [ADR-0281](ADR-0281-Six-Question-Facets-And-Which-Apply-Is-A-Property-Of-The-Kind.md): Six question facets, and which apply is a property of the kind — 1.15.0, four of the six
- [ADR-0282](ADR-0282-Question-Types-Are-A-Preference-And-The-Filter-Belongs-In.md): Question types are a preference, and the filter belongs in reviewSource — Not shipped
- [ADR-0283](ADR-0283-Cloze-Is-Forgiving-With-Typos-And-Strict-With-Synonyms-And-The.md): Cloze is forgiving with typos and strict with synonyms, and the threshold follows word length — 1.15.0
- [ADR-0284](ADR-0284-Cloze-Now-Forgives-A-Close-Synonym-Reversing-The-Entry-Above.md): Cloze now forgives a close synonym, reversing the entry above — v3.0.0
- [ADR-0285](ADR-0285-A-Question-Has-A-Class-And-A-Form-And-The-Two-Axes-Are-What.md): A question has a class and a form, and the two axes are what makes the missing ones visible — v3.0.0
- [ADR-0286](ADR-0286-A-Work-Option-Is-Shown-By-Its-Picture-And-A-Person-By-Their-Chip.md): A work option is shown by its picture and a person by their chip, and nothing shows both — v3.0.0
- [ADR-0287](ADR-0287-A-Which-Quote-Card-Names-Every-Option-S-Source-After-The-Grade.md): A "which quote?" card names every option's source after the grade, and reading them counts as seeing them — v3.0.0
- [ADR-0288](ADR-0288-A-Blank-Is-Asked-Only-Of-A-Short-Quote-And-The-Line-Is-The.md): A blank is asked only of a short quote, and the line is the reader's — v3.2.0
- [ADR-0289](ADR-0289-After-The-Grade-Every-Option-Says-What-It-Is.md): After the grade, every option says what it is — v3.2.0
- [ADR-0290](ADR-0290-A-Quiz-Round-Runs-In-Its-Own-Screen-And-Home-S-Cards-Open-It.md): A quiz round runs in its own screen, and Home's cards open it — v3.2.0
- [ADR-0291](ADR-0291-The-Built-In-TMDB-Credential-Is-Injected-At-Build-Time-And-Is-A.md): The built-in TMDB credential is injected at build time, and is a read token — v3.0.0
- [ADR-0292](ADR-0292-Suppliers-Mix-A-Re-Fetch-Keeps-The-Ids-It-Was-Not-Told-About-And.md): Suppliers mix: a re-fetch keeps the ids it was not told about, and a match can hand over its id alone — v3.0.0
- [ADR-0293](ADR-0293-TheTVDB-S-Free-Key-Logs-In-With-A-PIN-And-A-Refused-Supplier-Is.md): TheTVDB's free key logs in with a PIN, and a refused supplier is said out loud — v3.0.0
- [ADR-0294](ADR-0294-A-Picture-Search-Is-A-Different-Question-From-A-Catalogue-Lookup.md): A picture search is a different question from a catalogue lookup, and gets its own route
- [ADR-0295](ADR-0295-A-Stored-Title-Is-Re-Read-From-The-DEFAULT-Source-And-That-Rule.md): A stored title is re-read from the DEFAULT source, and that rule lives in one function — 2.3.0
- [ADR-0296](ADR-0296-The-Fandom-Wiki-Is-Probed-Once-Remembered-And-Overridable.md): The Fandom wiki is probed once, remembered, and overridable — 2.3.0
- [ADR-0297](ADR-0297-Measured-Difficulty-Feeds-The-Schedule-Beside-The-Fixed-Ladder.md): Measured difficulty feeds the schedule, beside the fixed ladder — Not shipped
- [ADR-0298](ADR-0298-Skipping-The-Quiz-Is-A-Fact-About-A-Quote-And-A-Work-S-Toggle-Is.md): Skipping the quiz is a fact about a quote, and a work's toggle is a bulk edit
- [ADR-0299](ADR-0299-The-Debt-Of-A-Write-Not-A-Filter-Is-That-Every-Create-Path-Owes.md): The debt of a write-not-a-filter is that every create path owes it — 2.0.1
- [ADR-0300](ADR-0300-And-The-Debt-Is-Owed-Backwards-As-Well-A-Migration-Not-Just-A.md): And the debt is owed backwards as well: a migration, not just a create path — 2.1.3
- [ADR-0301](ADR-0301-One-Ordered-Table-Of-Question-Types-And-A-Flip-Card-That-Cannot.md): One ordered table of question types, and a flip card that cannot fail — 1.15.0
- [ADR-0302](ADR-0302-The-Client-Keys-A-Flip-Card-On-The-ABSENCE-Of-Options-Not-On-The.md): The client keys a flip card on the ABSENCE of options, not on the direction string — 1.15.0
- [ADR-0303](ADR-0303-Three-Answer-Leaks-Two-Of-Them-Live-In-The-Shipped-App-Before.md): Three answer leaks, two of them live in the shipped app before this release — 1.15.0
- [ADR-0304](ADR-0304-The-Daily-Deck-S-Seeded-Options-Were-Never-Seeded.md): The daily deck's "seeded" options were never seeded — 1.15.0
- [ADR-0305](ADR-0305-A-Confirm-Step-Replaced-Undo-Because-The-Roadmap-Asked-For-The.md): A confirm step replaced undo, because the roadmap asked for the wrong thing — 1.15.0
- [ADR-0306](ADR-0306-A-Card-Forgotten-Five-Times-Is-Offered-A-Way-Out-And-Never-Taken.md): A card forgotten five times is offered a way out, and never taken out automatically — 1.15.0
- [ADR-0307](ADR-0307-A-Cloze-Card-Is-Offered-Only-Where-The-Stopword-List-Means.md): A cloze card is offered only where the stopword list means something — 1.15.0
- [ADR-0308](ADR-0308-A-Work-Level-Character-Can-Be-Given-Another-Work-And-The-Second.md): A work-level character can be given another work, and the second credit IS the promotion — 3.1.0
- [ADR-0309](ADR-0309-The-Recall-Log-Is-One-Row-Per-Answer-Beside-A-Schedule-That-Is.md): The recall log is one row per answer, beside a schedule that is one row per card — 3.1.0
- [ADR-0310](ADR-0310-The-Log-Records-Whether-An-Answer-Counted-Because-Nothing-Can.md): The log records whether an answer counted, because nothing can work it out later — 3.1.0
- [ADR-0311](ADR-0311-The-Repetition-Mark-Opens-The-Panel-Itself-And-Asks-The-Server.md): The repetition mark opens the panel itself, and asks the server rather than trusting the card — 3.1.0
- [ADR-0312](ADR-0312-The-Cloze-Mask-Is-Derived-From-Kind-Id-And-Never-From-The-Day.md): The cloze mask is derived from (kind, id) and never from the day — 1.15.0
- [ADR-0313](ADR-0313-Who-Said-This-Draws-Its-Distractors-From-The-Film-S-Own-Cast-And.md): "Who said this" draws its distractors from the film's own cast, and never fetches — 1.15.0
- [ADR-0314](ADR-0314-A-Theme-Narrows-Practice-Only-And-The-Clause-Is-Kept-Out-Of-The.md): A theme narrows Practice only, and the clause is kept out of the shared eligibility string — 1.15.0
- [ADR-0315](ADR-0315-In-Card-Actions-Open-Only-After-The-Card-Is-Graded.md): In-card actions open only after the card is graded — 1.15.0
- [ADR-0316](ADR-0316-QuizRunner-Had-No-Tests-At-All-And-Six-Features-Rewrote-It.md): QuizRunner had no tests at all, and six features rewrote it — 1.15.0
- [ADR-0317](ADR-0317-The-Reader-Chooses-The-Deck-S-Repertoire-And-Three-Rules-Stop.md): The reader chooses the deck's repertoire, and three rules stop them breaking it — 1.16.0
- [ADR-0318](ADR-0318-The-Numbers-Behind-The-Schedule-Are-Bounded-Not-Free.md): The numbers behind the schedule are bounded, not free — 1.16.0
- [ADR-0319](ADR-0319-The-Anthology-Theme-Worked-For-Two-Releases-And-Nothing-Could.md): The anthology theme worked for two releases and nothing could ask for it — 2.1.2

<a id="area-9"></a>

## §9 Import and the Staging Queue

Imports used to parse and write in one shot, which meant a misdetected file was reported after it had already reached search and the review deck. Everything now lands in separate staging tables where nothing is irreversible, and every parser reads structure rather than English.

- [ADR-0320](ADR-0320-Every-Importer-Parsed-And-Wrote-In-One-Shot-Reporting-Added.md): Every importer parsed and wrote in one shot, reporting added/skipped/enriched after the fact — 1.2.0 (reversal)
- [ADR-0321](ADR-0321-Imports-Land-In-Separate-Staging-Tables-Rather-Than-Behind-A.md): Imports land in separate staging tables rather than behind a pending flag, so no existing read can leak an unapproved quote — 1.2.0
- [ADR-0322](ADR-0322-Staged-Rows-Get-No-FTS-Tables-No-Triggers-And-No-Review-Rows-And.md): Staged rows get no FTS tables, no triggers and no review rows, and tags stay denormalised text — 1.2.0
- [ADR-0323](ADR-0323-Import-Counters-Moved-From-The-Import-Call-To-The-Approval-Call.md): Import counters moved from the import call to the approval call, because nothing is written at import time any more — 1.2.0
- [ADR-0324](ADR-0324-The-Staged-Destination-Preview-Is-Recomputed-On-Every-Read-Never.md): The staged destination preview is recomputed on every read, never stored, because the library moves while quotes wait — 1.2.0
- [ADR-0325](ADR-0325-A-Staged-Quote-Carries-Both-Locator-Sets-Plus-As-Imported.md): A staged quote carries both locator sets plus as-imported snapshots, so a cross-kind retarget is reversible — 1.2.0
- [ADR-0326](ADR-0326-A-Staged-Work-With-No-Quotes-Is-Still-Approved-Or-A.md): A staged work with no quotes is still approved, or a whole-library round-trip would drop the unquoted shelf — 1.2.0
- [ADR-0327](ADR-0327-A-Duplicate-Within-One-File-Enriches-Instead-Of-Disappearing.md): A duplicate within one file enriches instead of disappearing, keeping the approved count equal to the shown count — 1.2.0
- [ADR-0328](ADR-0328-Duplicate-Enrichment-Is-Monotone-In-The-Safe-Direction-Fill.md): Duplicate enrichment is monotone in the safe direction: fill empty, upgrade colour off yellow, favourite only upward, tags union — 1.2.0
- [ADR-0329](ADR-0329-Approval-Converts-Staged-Rows-Back-Into-The-Importers-Own.md): Approval converts staged rows back into the importers' own intermediate shape and replays the existing persist path — 1.2.0
- [ADR-0330](ADR-0330-All-Four-Staged-Endpoints-Share-One-Selector-Shape-And-A-Foreign.md): All four staged endpoints share one selector shape, and a foreign selection matches nothing and answers 404 — 1.2.0
- [ADR-0331](ADR-0331-Selections-Chunk-Their-Bound-Ids-32766-Is-A-Real-Ceiling-And-The.md): Selections chunk their bound ids — 32766 is a real ceiling, and the fullest queue was the one that could not be emptied — 1.2.0
- [ADR-0332](ADR-0332-Staged-Tag-Edits-Can-Remove-As-Well-As-Add-And-The-Reason-The.md): Staged tag edits can remove as well as add, and the reason the live endpoint still cannot is structural — 1.2.0
- [ADR-0333](ADR-0333-Location-Bulk-Edits-Are-Formulae-Over-The-Numeric-Runs-Inside.md): Location bulk edits are formulae over the numeric runs inside free text, with a separate clock path and a clamp — 1.2.0
- [ADR-0334](ADR-0334-Bulk-Staged-Edits-Apply-In-A-Fixed-Order-Assignments-Tags.md): Bulk staged edits apply in a fixed order — assignments, tags, formula, retarget — and an assignment re-bases the reset snapshot — 1.2.0
- [ADR-0335](ADR-0335-Standalone-Quotes-Stage-Under-One-Synthetic-Staged-Work-Of-Kind.md): Standalone quotes stage under one synthetic staged work of kind 'quotes'; a nullable parent would have disabled dedupe — post-1.3.0
- [ADR-0336](ADR-0336-Imported-Dialogue-Anchors-Onto-A-Pre-Existing-Same-Title-Film.md): Imported dialogue anchors onto a pre-existing same-title film, and the anchor is previewed before approval — 1.2.0
- [ADR-0337](ADR-0337-Book-Identity-Falls-Through-ISBN-ASIN-Title-Author-Read-Only.md): Book identity falls through ISBN → ASIN → title+author, read-only, with identifiers backfilled fill-empty-only — pre-1.0, split read-only in 1.2.0
- [ADR-0338](ADR-0338-Markdown-Import-Auto-Detects-Two-Shapes-From-The-First-Line-And.md): Markdown import auto-detects two shapes from the first line, and every field is optional — 1.0.1 (correction)
- [ADR-0339](ADR-0339-The-Kindle-Clippings-Importer-Was-Deferred-Behind-A-Registered.md): The Kindle clippings importer was deferred behind a registered 501, then shipped labelled experimental — 1.0.0
- [ADR-0340](ADR-0340-The-Clippings-Parser-Reads-Structure-Never-English-Keywords-And.md): The clippings parser reads structure, never English keywords, and language words may only promote a highlight to a note — 1.0.0
- [ADR-0341](ADR-0341-The-Kindle-Author-String-Is-Kept-Verbatim-Because-A-Joined.md): The Kindle author string is kept verbatim, because a joined credit and a reversed name are indistinguishable — 1.0.0
- [ADR-0342](ADR-0342-A-Kindle-Note-Merges-Onto-A-Highlight-Only-At-A-Shared-Non-Empty.md): A Kindle note merges onto a highlight only at a shared non-empty position, and a re-emitted record keeps the longer copy — 1.0.0
- [ADR-0343](ADR-0343-Upload-Safety-Cap-The-Body-Before-Parsing-Sniff-The-Content.md): Upload safety: cap the body before parsing, sniff the content, never trust the declared Content-Type — pre-1.0
- [ADR-0344](ADR-0344-Uploaded-Filenames-Are-Base-Named-And-Truncated-Never-Rejected.md): Uploaded filenames are base-named and truncated, never rejected, because the name is displayed and never used as a path — 1.2.0
- [ADR-0345](ADR-0345-An-Import-Never-400s-Over-Its-Media-Type-Or-A-Bad-Date-The-Queue.md): An import never 400s over its media type or a bad date — the queue is where a wrong guess gets corrected — 1.2.0
- [ADR-0346](ADR-0346-Noted-At-And-Source-Are-Create-Only-Allowlisted-And-Bounded.md): noted at and source are create-only, allowlisted, and bounded against clock skew — 1.1.0
- [ADR-0347](ADR-0347-Unverified-Importers-Ship-Only-When-Someone-Can-Confirm-Them-Or.md): Unverified importers ship only when someone can confirm them, or ship labelled experimental — ongoing
- [ADR-0348](ADR-0348-Text-Cleanup-Belongs-Server-Side-And-Shared-Not-Inside-The-OCR.md): Text cleanup belongs server-side and shared, not inside the OCR client — not built (recorded on the backlog)
- [ADR-0349](ADR-0349-The-Photo-Taken-For-OCR-Is-Worth-Keeping-Attached-To-The-Quote.md): The photo taken for OCR is worth keeping, attached to the quote — ?

<a id="area-10"></a>

## §10 What Leaves the App: Exports, Round-Trips and the Shared Image

An export whose own re-import loses or duplicates data is not an export, so round-trip fidelity is treated as a testable property rather than a hope. The share image is the other artefact that leaves the machine, and it is governed by what a recipient can and cannot be expected to understand.

- [ADR-0350](ADR-0350-Export-Is-One-Renderer-Behind-Three-Endpoints.md): Export is one renderer behind three endpoints — `docs/wiki/Design-decisions.md` · `internal/httpapi/export_handlers.go`
- [ADR-0351](ADR-0351-Both-Exports-Must-Round-Trip-Re-Importing-Either-Is-A-Dedupe.md): Both exports must round-trip: re-importing either is a dedupe no-op — `docs/wiki/Design-decisions.md` · `internal/httpapi/export_test.go`
- [ADR-0352](ADR-0352-Series-And-Collections-Were-Silently-Lost-On-Round-Trip.md): Series and collections were silently lost on round-trip — `internal/httpapi/export_handlers.go`
- [ADR-0353](ADR-0353-A-Default-Needn-T-Be-Stated-Cost-Round-Trip-Fidelity-A-Film-S.md): "A default needn't be stated" cost round-trip fidelity: a film's own export re-imported as a book — `internal/httpapi/export_handlers.go`
- [ADR-0354](ADR-0354-Type-Is-The-Decisive-Import-Signal-With-The-Heuristics-Kept-For.md): type: is the decisive import signal, with the heuristics kept for hand-written files — `internal/httpapi/export_handlers.go` · `internal/httpapi/export_quotes.go`
- [ADR-0355](ADR-0355-A-Show-S-Season-0-Is-Written-Explicitly-And-Combined-Forms-Are.md): A show's season: 0 is written explicitly, and combined forms are accepted on read — `docs/wiki/Design-decisions.md`
- [ADR-0356](ADR-0356-Status-Progress-Position-And-The-Read-Log-Round-Trip.md): Status, progress, position and the read log round-trip, fill-empty-only — `internal/httpapi/export_handlers.go`
- [ADR-0357](ADR-0357-The-Cast-Round-Trips-On-One-Line-And-The-Line-Carries-Who-Wrote.md): The cast round-trips on one line, and the line carries who wrote each row — `internal/httpapi/export_handlers.go` · `internal/importer/importer.go`
- [ADR-0358](ADR-0358-A-Quotes-Export-Groups-By-Occasion-And-Puts-Unattributed-Quotes.md): A quotes export groups by occasion and puts unattributed quotes first — `internal/httpapi/export_quotes.go`
- [ADR-0359](ADR-0359-Date-Is-When-You-Saved-It-And-Occasion-Date-Is-When-It-Was-Said.md): date is when you saved it and occasion date is when it was said — `internal/httpapi/export_quotes.go` · `internal/httpapi/export_handlers.go`
- [ADR-0360](ADR-0360-Export-All-Was-Renamed-Because-All-Three-Screens-Export-The.md): "Export all" was renamed, because all three screens export the filtered view
- [ADR-0361](ADR-0361-Quote-Card-Images-Render-Entirely-In-The-Browser.md): Quote-card images render entirely in the browser — `web/frontend/src/share.jsx` · `web/frontend/src/quoteImage.js`
- [ADR-0362](ADR-0362-The-Image-S-Credit-Is-The-Mark-Plus-Made-With-And-The-Mark-Is.md): The image's credit is the mark plus "made with", and the mark is drawn rather than loaded — 1.7.9
- [ADR-0363](ADR-0363-The-Credit-Is-One-Baseline-And-One-Optical-Centre-With-No.md): The credit is one baseline and one optical centre, with no per-run nudges — 1.7.10
- [ADR-0364](ADR-0364-The-Share-Sheet-Opens-On-The-Picture-And-Its-Two-Window-Actions.md): The share sheet opens on the picture, and its two window actions live together — 1.7.10
- [ADR-0365](ADR-0365-One-Class-Of-Client-Forced-A-Server-Route-Android-WebView-Has-No.md): One class of client forced a server route: Android WebView has no Web Share, and a blob URL is revoked mid-save — `web/frontend/src/share.jsx` · `internal/httpapi/share_handlers.go`
- [ADR-0366](ADR-0366-Copy-Falls-Back-To-A-Legacy-Path-Because-A-Plain-HTTP-LAN.md): Copy falls back to a legacy path, because a plain-HTTP LAN instance has no async Clipboard API — `web/frontend/src/share.jsx`
- [ADR-0367](ADR-0367-The-Share-Image-Skin-Is-Chosen-Independently-Of-The-App-Theme.md): The share-image skin is chosen independently of the app theme and remembered per device — `web/frontend/src/share.jsx`
- [ADR-0368](ADR-0368-The-Backdrop-Replaces-The-Portrait-Chip-And-The-Control-Names.md): The backdrop replaces the portrait chip, and the control names both states — `web/frontend/src/share.jsx`
- [ADR-0369](ADR-0369-Every-Word-On-A-Backdrop-Card-Carries-A-Zero-Offset-Halo-In-The.md): Every word on a backdrop card carries a zero-offset halo in the drawn skin's own surface colour — `web/frontend/test/dom/quote-image-halo.test.jsx`
- [ADR-0370](ADR-0370-The-Portrait-Tint-Is-A-Duotone-Applied-Before-The-Fade-Mask-With.md): The portrait tint is a duotone applied before the fade mask, with the blend mode read back — `web/frontend/test/dom/quote-image-portrait.test.jsx`
- [ADR-0371](ADR-0371-The-Share-Image-S-Colour-Tint-Defaulted-On-As-Information-About.md): The share image's colour tint defaulted on, as information about the quote
- [ADR-0372](ADR-0372-The-Tint-Defaults-Off-And-The-Storage-Key-Was-Retired-To-Make.md): The tint defaults off, and the storage key was retired to make that true — `web/frontend/src/share.jsx`
- [ADR-0373](ADR-0373-The-Share-Image-Picks-Which-Credit-Line-Wears-Portraits-By-A.md): The share image picks which credit line wears portraits by a positive test — `web/frontend/src/quoteImage.js`
- [ADR-0374](ADR-0374-CategoryHex-Is-The-One-Place-A-Real-Hex-Value-Is-Still-Required.md): categoryHex is the one place a real hex value is still required — `web/frontend/src/theme.js` · `web/frontend/src/share.jsx`
- [ADR-0375](ADR-0375-Location-And-Noted-Start-Unchecked-In-The-Share-Dialog.md): Location and Noted start unchecked in the share dialog — `web/frontend/src/share.jsx` · `share.jsx`
- [ADR-0376](ADR-0376-The-Markdown-Preview-Avoids-ES2018-Regex-Lookbehind.md): The Markdown preview avoids ES2018 regex lookbehind — `web/frontend/src/share.jsx`
- [ADR-0377](ADR-0377-Anthologies-Are-The-Missing-Output-Of-A-Commonplace-Book.md): Anthologies are the missing output of a commonplace book — `docs/roadmap.html`
- [ADR-0378](ADR-0378-An-Anthology-Decides-What-Its-Own-Passages-Show-And-The-Choice.md): An anthology decides what its own passages show, and the choice lives on the row — 2.1.2

<a id="area-11"></a>

## §11 Backup, Restore and Recovery

Backup is a nightly `VACUUM INTO` snapshot with no streaming daemon, and restore runs in-process specifically so the container never needs the host's Docker socket. The archive format's two encryption designs and the two recovery-key designs that died under review are the most instructive entries here.

- [ADR-0379](ADR-0379-A-Nightly-VACUUM-INTO-Snapshot-From-The-Box-S-Own-Cron.md): A nightly VACUUM INTO snapshot from the box's own cron — from 0.1.0
- [ADR-0380](ADR-0380-Restore-Replaces-The-Data-Directory-In-Process.md): Restore replaces the data directory in-process — 0.8.2 and earlier
- [ADR-0381](ADR-0381-Restore-Accepts-An-Uploaded-Archive-And-A-Foreign-Schema-Only-If.md): Restore accepts an uploaded archive, and a foreign schema only if older — 0.8.3
- [ADR-0382](ADR-0382-Restore-Is-Reachable-During-Onboarding-Without-A-Typed.md): Restore is reachable during onboarding without a typed confirmation — 0.8.3
- [ADR-0383](ADR-0383-AES-256-GCM-In-Framed-Chunks-And-No-Fixed-Key-In-The-Binary.md): AES-256-GCM in framed chunks, and no fixed key in the binary — 1.4.1 (sealed), 1.4.2 (v2)
- [ADR-0384](ADR-0384-The-Account-Password-Is-Verified-Before-The-Archive-Is-Written.md): The account password is verified before the archive is written — 1.4.1; the job 3.1.0
- [ADR-0385](ADR-0385-Archive-V1-Keyed-On-Username-Password-And-Lasted-About-An-Hour.md): Archive v1 keyed on <username>#<password>, and lasted about an hour — 1.4.1, superseded in 1.4.2
- [ADR-0386](ADR-0386-Format-V2-Derives-The-Key-From-The-Password-Alone-Wrapped-Twice.md): Format v2 derives the key from the password alone, wrapped twice — 1.4.2
- [ADR-0387](ADR-0387-V1-Archives-Are-Refused-By-Version-Not-Read.md): v1 archives are refused by version, not read — 1.4.2
- [ADR-0388](ADR-0388-The-Instance-Recovery-Key-Is-A-File-After-Two-Designs-That.md): The instance recovery key is a file, after two designs that destroyed it — 1.4.2
- [ADR-0389](ADR-0389-The-Recovery-Key-Is-Never-Archived-Never-Moved-Never-Logged.md): The recovery key is never archived, never moved, never logged — 1.4.2
- [ADR-0390](ADR-0390-A-Passphrase-Archive-Gets-No-Recovery-Wrap.md): A passphrase archive gets no recovery wrap — 1.4.2
- [ADR-0391](ADR-0391-The-Recovery-Restore-Path-Requires-The-Caller-S-Own-Current.md): The recovery restore path requires the caller's own current password — 1.4.2
- [ADR-0392](ADR-0392-Wrong-Password-And-Damaged-Archive-Are-Reported-As-Different.md): Wrong password and damaged archive are reported as different failures — 1.4.2
- [ADR-0393](ADR-0393-Every-Nonce-Is-Twelve-Fresh-Random-Bytes-Frame-Nonces-XOR.md): Every nonce is twelve fresh random bytes; frame nonces XOR — 1.4.2
- [ADR-0394](ADR-0394-Truncation-Is-Caught-By-The-Absence-Of-A-Final-Frame.md): Truncation is caught by the absence of a final frame — 1.4.2
- [ADR-0395](ADR-0395-The-V2-Header-Keeps-The-V1-Prefix-Byte-Identical-And-Appends.md): The v2 header keeps the v1 prefix byte-identical and appends — 1.4.2
- [ADR-0396](ADR-0396-Sealed-Archives-Are-Tpbk-A-Typed-RESTORE-Guards-Only-Unsealed.md): Sealed archives are .tpbk; a typed RESTORE guards only unsealed ones — 1.4.1
- [ADR-0397](ADR-0397-Both-Keys-Are-Tried-Against-One-Parsed-Header-Never-A-Re-Parse.md): Both keys are tried against one parsed header, never a re-parse — 1.4.2
- [ADR-0398](ADR-0398-The-Archive-Layers-Tar-Gzip-Envelope.md): The archive layers tar → gzip → envelope — 1.4.1
- [ADR-0399](ADR-0399-Each-Read-Of-A-Restore-Upload-Moves-Its-Deadline-A-Minute-Ahead.md): Each read of a restore upload moves its deadline a minute ahead, the restore clears its write deadline, and the safety copy uses MkdirTemp — 1.4.1; the upload's idle deadline 3.1.0
- [ADR-0400](ADR-0400-Two-Restore-Blocks-With-Two-Confirmations-Became-One-Control.md): Two restore blocks with two confirmations became one control — 1.4.1
- [ADR-0401](ADR-0401-RebindDB-Repoints-Every-Auth-Store-After-An-In-Process-Swap.md): rebindDB repoints every auth store after an in-process swap — 1.1.0
- [ADR-0402](ADR-0402-Factory-Reset-Deletes-The-Database-File-Not-Its-Rows.md): Factory reset deletes the database file, not its rows — 0.4.6

<a id="area-12"></a>

## §12 Shell, Navigation and Entry Points

The navigation shape is the single most re-litigated decision in the project, moving from bottom tabs to a drawer and back to both. The through-line is that a control belongs to the shell once, not to every screen that needs it.

- [ADR-0403](ADR-0403-Mobile-First-PWA-Shell-With-A-Bottom-Navigation-Bar.md): Mobile-first PWA shell with a bottom navigation bar — 0.3.1
- [ADR-0404](ADR-0404-The-Bottom-Bar-Was-Removed-Outright-In-Favour-Of-The-Hamburger.md): The bottom bar was removed outright in favour of the hamburger drawer — 0.4.0
- [ADR-0405](ADR-0405-The-Bottom-Bar-Returned-As-A-Four-Icon-Float.md): The bottom bar returned as a four-icon float — 1.0.0
- [ADR-0406](ADR-0406-The-Phone-Bottom-Bar-Dropped-Search-And-Gained-Quotes.md): The phone bottom bar dropped Search and gained Quotes — 1.5.0
- [ADR-0407](ADR-0407-One-Add-Surface-Consolidated-Over-Several-Releases.md): One "＋ Add" surface, consolidated over several releases — 0.4.3 through 0.9.3
- [ADR-0408](ADR-0408-The-Add-Surface-Knows-Where-You-Are-The-Drawer-S-Add-Is-The.md): The Add surface knows where you are; the drawer's Add is the context-free twin — 1.4.1
- [ADR-0409](ADR-0409-Eleven-Page-Buttons-And-A-On-Every-List-Became-One-Shell-Set.md): Eleven page "?" buttons and a "＋" on every list became one shell set — 1.4.1
- [ADR-0410](ADR-0410-Detail-Screens-Reach-Help-Through-The-Menu.md): Detail screens reach help through the ⋯ menu — 1.4.0
- [ADR-0411](ADR-0411-The-Nav-Collapses-To-Icons-By-Measuring-Real-Overflow-Not-A.md): The nav collapses to icons by measuring real overflow, not a breakpoint — 0.6.7, corrected in 0.6.9
- [ADR-0412](ADR-0412-The-Configurable-Desktop-Nav-Was-Shipped-And-Then-Retired.md): The configurable desktop nav was shipped and then retired — Added 0.4.3, retired 0.6.7
- [ADR-0413](ADR-0413-A-Reader-Can-Hide-A-Whole-Section-And-Hiding-Takes-Away-Doors.md): A reader can hide a whole section, and hiding takes away doors rather than data — 1.16.x
- [ADR-0414](ADR-0414-Four-Hand-Maintained-Navigation-Lists-Moved-Into-Routes-Js.md): Four hand-maintained navigation lists moved into routes.js — 1.5.1
- [ADR-0415](ADR-0415-Home-Is-The-Landing-View-And-The-Stored-Start-Page-Preference-Is.md): Home is the landing view, and the stored start-page preference is ignored — 0.4.0
- [ADR-0416](ADR-0416-Home-Is-One-Narrow-Reading-Column-At-Every-Size-And-Capture-Is.md): Home is one narrow reading column at every size, and capture is not on it — 0.4.0, capture removed 0.9.1
- [ADR-0417](ADR-0417-Scroll-Memory-Holds-Exactly-The-Last-Two-List-Pages-LRU.md): Scroll memory holds exactly the last two list pages, LRU — 0.6.8
- [ADR-0418](ADR-0418-Profile-Became-One-Screen-And-The-Avatar-Chip-Opens-It-Directly.md): Profile became one screen and the avatar chip opens it directly — 1.4.1, completed 1.5.2
- [ADR-0419](ADR-0419-Switching-Accounts-Is-Laid-Out-As-The-Sibling-Of-The-Log-Out.md): Switching accounts is laid out as the sibling of the log-out beside it — 1.7.2
- [ADR-0420](ADR-0420-Preferences-Are-A-Partial-Merge-Not-A-Full-State-Write.md): Preferences are a partial merge, not a full-state write — 0.4.3, duplicate removed 1.1.1
- [ADR-0421](ADR-0421-A-Preference-Written-From-Outside-The-Preferences-Handler-Has-To.md): A preference written from outside the preferences handler has to be a field in its struct — 1.16.x
- [ADR-0422](ADR-0422-Viewport-Preferences-Are-Device-Local-Identity-Preferences-Ride.md): Viewport preferences are device-local; identity preferences ride the account — 1.6.0
- [ADR-0423](ADR-0423-The-At-Scale-Metadata-Console-Is-Desktop-Only-And-The-Phone-Says.md): The at-scale Metadata console is desktop-only, and the phone says so — 0.4.4
- [ADR-0424](ADR-0424-The-Guided-Tour-Ships-Its-Own-Sample-Content.md): The guided tour ships its own sample content — 0.9.0
- [ADR-0425](ADR-0425-Dead-Code-That-Duplicates-A-Live-Screen-Is-Deleted-Not-Left.md): Dead code that duplicates a live screen is deleted, not left — 1.7.2, and 1.4.1 before it
- [ADR-0426](ADR-0426-Serendipity-Is-Not-The-Review-Loop-And-Must-Not-Touch-Its.md): Serendipity is not the review loop, and must not touch its schedule — 1.16.0
- [ADR-0427](ADR-0427-Eight-Planned-Items-Dropped-And-The-Three-Findings-Worth-Keeping.md): Eight planned items dropped, and the three findings worth keeping from them — 1.16.0
- [ADR-0428](ADR-0428-A-Shortcut-Is-Not-Real-Until-The-Button-That-Shares-Its-Job-Says.md): A shortcut is not real until the button that shares its job says so — 1.16.x
- [ADR-0429](ADR-0429-A-Replace-Is-Previewed-Because-Its-Damage-Is-The-Only-Kind-You.md): A replace is previewed because its damage is the only kind you cannot see — 1.16.x

<a id="area-13"></a>

## §13 Controls, Labels, Icons and Help

Two mechanisms for explaining a control both widened the page and neither worked on touch, so tooltips, info dots and per-screen help were rebuilt as one system with a five-word ceiling. The rule that came out of it is that a glyph is something you must already have learned.

- [ADR-0430](ADR-0430-A-Pure-CSS-Hover-Bubble-And-A-Viewport-Pinned-Long-Press-Pill.md): A pure-CSS hover bubble and a viewport-pinned long-press pill — two mechanisms, both of which widened the page — 1.4.1 (reversal)
- [ADR-0431](ADR-0431-One-Tooltip-Implementation-Measured-Clamped-Anchored-To-Its.md): One tooltip implementation: measured, clamped, anchored to its control, serving hover, keyboard focus and long press — 1.4.1
- [ADR-0432](ADR-0432-A-Closed-Tooltip-Must-Leave-Layout-Entirely-And-Nothing-In-The.md): A closed tooltip must leave layout entirely, and nothing in the app is allowed to widen the page — 1.4.1
- [ADR-0433](ADR-0433-Touch-Tooltips-Are-A-500ms-Long-Press-And-A-Fired-Press-Swallows.md): Touch tooltips are a 500ms long press, and a fired press swallows the click behind it — 1.4.1
- [ADR-0434](ADR-0434-Keyboard-Focus-Opens-A-Label-Only-Via-Focus-Visible-So-A-Tap.md): Keyboard focus opens a label only via :focus-visible, so a tap does not double up with the long-press path — 1.4.1
- [ADR-0435](ADR-0435-The-Hint-Slot-Is-Its-Own-Slot-With-Token-Based-Closes-Because-A.md): The hint slot is its own slot with token-based closes, because a label and a toast can legitimately coexist — 1.4.1
- [ADR-0436](ADR-0436-Every-Label-And-Confirmation-Is-Five-Words-Or-Fewer-With-1-2s.md): Every label and confirmation is five words or fewer, with 1.2s and 1.5s dwell times that only work because the copy is short — 1.4.1
- [ADR-0437](ADR-0437-Standing-Explanatory-Prose-Moved-Into-Info-Dots-Repeatedly.md): Standing explanatory prose moved into info dots, repeatedly, across four releases — label and state stay, explanation moves — 0.6.9 → 1.7.2
- [ADR-0438](ADR-0438-The-Help-Panel-S-Copy-Had-No-Budget-So-It-Grew-One-Reasonable.md): The help panel's copy had no budget, so it grew one reasonable sentence at a time — 2.0.1
- [ADR-0439](ADR-0439-A-Gesture-Is-Drawn-And-The-Drawing-Is-Abstract-So-It-Cannot-Go.md): A gesture is drawn, and the drawing is abstract so it cannot go stale — 2.0.1
- [ADR-0440](ADR-0440-An-Info-Dot-Opens-An-Anchored-Popover-On-A-Pointer-And-A-Centred.md): An info dot opens an anchored popover on a pointer and a centred card on a phone, and carries no hover label of its own — 1.4.2
- [ADR-0441](ADR-0441-Hover-Affordances-Do-Not-Exist-On-Touch-Which-Is-The.md): Hover affordances do not exist on touch, which is the counterweight to every info-dot compaction — 1.4.0
- [ADR-0442](ADR-0442-Per-Screen-Help-Lives-In-One-Registry-Keyed-By-Screen-And.md): Per-screen help lives in one registry keyed by screen, and describes the shell that is actually on screen — 1.4.0, relocated 1.4.1
- [ADR-0443](ADR-0443-Settings-Reference-Was-Removed-The-Per-Screen-Replaces-The.md): Settings → Reference was removed; the per-screen ? replaces the glossary link and the roadmap link moved to Updates — 1.4.0
- [ADR-0444](ADR-0444-Button-Labels-Are-A-Device-Local-Setting-With-Auto-On-Off-And.md): Button labels are a device-local setting with auto/on/off, and collapsed words are clipped so they stay in the accessibility tree — 1.6.0
- [ADR-0445](ADR-0445-KeepLabel-Primary-Submits-And-Destructive-Confirms-Never.md): keepLabel: primary submits and destructive confirms never collapse, and has-btn-icon marks only buttons whose words may disappear — 1.6.0
- [ADR-0446](ADR-0446-A-Repeated-Action-Is-A-Glyph-A-One-Off-Keeps-Its-Words-Ending.md): A repeated action is a glyph; a one-off keeps its words — ending 'share edit delete' on desktop and 'del' in a table — 1.6.0
- [ADR-0447](ADR-0447-One-Glyph-Per-Meaning-At-One-Stroke-Weight-With-The-Nav-S.md): One glyph per meaning at one stroke weight, with the nav's private icon set deleted and duplicates caught by geometry comparison — 1.6.0
- [ADR-0448](ADR-0448-The-Icon-Vocabulary-Was-Drawn-From-A-Counted-Button-Inventory.md): The icon vocabulary was drawn from a counted button inventory, not from the plan's guess of twenty-six — 1.6.0
- [ADR-0449](ADR-0449-Two-Icon-Button-Sizes-Only-And-IconButton-Renders-Its-Own.md): Two icon-button sizes only, and IconButton renders its own tooltip from its ariaLabel rather than being wrapped at forty call sites — 1.4.0
- [ADR-0450](ADR-0450-Tab-Strip-Tooltips-Are-Driven-From-Inside-The-Toggle-Because-A.md): Tab-strip tooltips are driven from inside the Toggle, because a wrapper would reset every offsetLeft the thumb is positioned from — 1.4.1
- [ADR-0451](ADR-0451-Five-Ways-To-Dismiss-A-Window-Became-Two-A-Over-Content-A-Back.md): Five ways to dismiss a window became two: a × over content, a back arrow out of a full-screen sheet — 1.6.0
- [ADR-0452](ADR-0452-Word-Buttons-Become-Glyphs-Only-Where-The-Glyph-Is-Unambiguous.md): Word buttons become glyphs only where the glyph is unambiguous — 1.4.0
- [ADR-0453](ADR-0453-One-Colour-Per-Meaning-Correct-Is-Green-Not-The-Accent-And.md): One colour per meaning: correct is green, not the accent, and identity never rides on colour alone — 0.4.2, reinforced later
- [ADR-0454](ADR-0454-Metadata-Source-Marks-Are-16px-Category-Glyphs-Not-Brand-Logos.md): Metadata source marks are 16px category glyphs, not brand logos or text pills — 1.0.0
- [ADR-0455](ADR-0455-Colour-Pickers-And-Breakdowns-Read-The-Reader-S-Own-Category.md): Colour pickers and breakdowns read the reader's own category names, not the storage colour word — post-1.4.0
- [ADR-0456](ADR-0456-Save-Stays-Greyed-Until-It-Would-Work-And-Says-Which-Field-Is.md): Save stays greyed until it would work, and says which field is missing — 1.4.1
- [ADR-0457](ADR-0457-Greetings-Use-Fixed-Date-Festivals-Only-Resolved-On-The-Device.md): Greetings use fixed-date festivals only, resolved on the device, with no user-extension escape hatch — post-1.4.0
- [ADR-0458](ADR-0458-An-Actionable-Toast-Lives-Longer-And-There-Is-Only-Ever-One.md): An actionable toast lives longer, and there is only ever one action — 1.8.0
- [ADR-0459](ADR-0459-Two-Icon-Sizes-Two-Rules-44px-Can-Be-Named-34px-Cannot.md): Two icon sizes, two rules: 44px can be named, 34px cannot — 1.14.0
- [ADR-0460](ADR-0460-The-Onboarding-Card-Lists-Nothing-A-Section-Picker-Replays-One.md): The Onboarding card lists nothing; a section picker replays one step, and the index comes from the unfiltered list — 1.15.2
- [ADR-0461](ADR-0461-A-Setting-Names-The-Reader-S-Own-Screens-Not-The-Media-On-Them.md): A setting names the reader's own screens, not the media on them — 1.15.2
- [ADR-0462](ADR-0462-A-Screen-Asking-The-Registry-The-Wrong-Question-Is-Silent-In.md): A screen asking the registry the wrong question is silent in every direction — 1.16.0
- [ADR-0463](ADR-0463-There-Is-No-Source-Language-The-Code-Holds-Keys-And-English-Is-A.md): There is no source language: the code holds keys, and English is a file like any other
- [ADR-0464](ADR-0464-The-App-Writes-The-Template-Because-The-Person-Who-Needs-It-Has.md): The app writes the template, because the person who needs it has no checkout — 2.1.3
- [ADR-0465](ADR-0465-Two-Files-Claiming-One-Language-Prefer-The-Answer-That-Loses.md): Two files claiming one language: prefer the answer that loses nothing — 2.1.3
- [ADR-0466](ADR-0466-Six-Default-Portraits-Picked-By-A-Hash-Of-The-Name.md): Six default portraits, picked by a hash of the name — 3.1.0
- [ADR-0467](ADR-0467-No-Label-Over-The-Portrait-And-A-Label-Over-The-Cover.md): No label over the portrait, and a label over the cover — 3.1.0
- [ADR-0468](ADR-0468-A-Panel-Body-Owns-Its-Record-Because-A-Panel-S-Props-Are-Frozen.md): A panel body owns its record, because a panel's props are frozen when it is pushed — 3.1.0
- [ADR-0469](ADR-0469-Details-Is-One-List-In-Relevance-Order-And-Four-Fields-Keep-A.md): Details is one list in relevance order, and four fields keep a sheet — 3.1.0

<a id="area-14"></a>

## §14 Boards, Cards, Charts and Popups

A popup that places itself in CSS is correct exactly once, and a board that re-packs while you read moves everything you were not looking at — both were fixed by one primitive rather than nine local patches. Charts are here too, because most chart decisions turned out to be about what a number means.

- [ADR-0470](ADR-0470-Popups-Placed-Themselves-In-CSS-And-A-Card-Lifting-Z-Index-Rule.md): Popups placed themselves in CSS, and a card-lifting z-index rule existed to work around it — `web/frontend/test/rules/popup-offsets.test.js`
- [ADR-0471](ADR-0471-The-Desktop-Menu-Portalled-To-Body-The-Origin-Of-The-Standing.md): The desktop ⋯ menu portalled to <body> — the origin of the standing rule — `web/frontend/src/ui.jsx`
- [ADR-0472](ADR-0472-Every-Popup-Is-Portalled-And-Viewport-Positioned-By-One-Measured.md): Every popup is portalled and viewport-positioned by one measured primitive — `web/frontend/src/ui.jsx` · `web/frontend/test/rules/popup-offsets.test.js`
- [ADR-0473](ADR-0473-Flip-Only-When-The-Preferred-Side-Cannot-Fit-And-The-Other-Is.md): Flip only when the preferred side cannot fit and the other is roomier; always cap — `web/frontend/src/ui.jsx`
- [ADR-0474](ADR-0474-UseDismiss-Takes-A-List-Of-Refs-Because-Portalling-Changed-What.md): useDismiss takes a list of refs, because portalling changed what counts as "outside" — `web/frontend/src/ui.jsx`
- [ADR-0475](ADR-0475-The-Colour-Picker-Was-Fixed-Once-Locally-Then-That.md): The colour picker was fixed once locally, then that implementation was deleted the same day
- [ADR-0476](ADR-0476-Two-Classes-On-One-Popup-Solved-For-A-Negative-Height-And.md): Two classes on one popup solved for a negative height and shipped a 3px sliver — `web/frontend/test/rules/popup-offsets.test.js`
- [ADR-0477](ADR-0477-A-Container-Query-Not-A-Media-Query-Or-A-ResizeObserver-Chooses.md): A container query, not a media query or a ResizeObserver, chooses the collapsed colour picker — `web/frontend/src/index.css`
- [ADR-0478](ADR-0478-The-Collapsed-Picker-Is-A-Named-List-So-The-Narrow-Layout-Shows.md): The collapsed picker is a named list, so the narrow layout shows more than the wide one — `web/frontend/src/index.css`
- [ADR-0479](ADR-0479-The-Masonry-Re-Packed-Under-The-Reader-Column-Assignment-Now.md): The masonry re-packed under the reader; column assignment now latches on the rising edge of an expand — `web/frontend/src/ui.jsx`
- [ADR-0480](ADR-0480-Quote-Boards-Deal-In-Source-Order-With-A-Seeded-3-5-Line-Clamp.md): Quote boards deal in source order with a seeded 3–5 line clamp — `web/frontend/src/Library.jsx` · `web/frontend/src/ui.jsx`
- [ADR-0481](ADR-0481-Column-Ladders-Are-Paired-With---Container-Max.md): Column ladders are paired with --container-max — `web/frontend/src/ui.jsx` · `web/frontend/src/index.css`
- [ADR-0482](ADR-0482-Settings-Abandons-The-Masonry-For-A-Written-Down-Column-Layout.md): Settings abandons the masonry for a written-down column layout
- [ADR-0483](ADR-0483-The-Work-Boards-Fetch-Whole-And-Render-A-Window.md): The work boards fetch whole and render a window
- [ADR-0484](ADR-0484-Quote-Cards-Use-Progressive-Disclosure-Only-At-Rest-With-Opacity.md): Quote cards use progressive disclosure — only ♥ at rest — with opacity rather than display — `web/frontend/src/index.css`
- [ADR-0485](ADR-0485-A-Card-S-Row-Is-Copy-Share-Colour-Then-A-Holding-Edit-And-Delete.md): A card's row is ♥ · copy · share · colour, then a ⋯ holding edit and delete — 1.7.9
- [ADR-0486](ADR-0486-A-Favourite-Tile-S-Row-Is-The-Card-Row-And-Its-Open-Button-Is.md): A favourite tile's row is the card row, and its open button is the nav's own glyph — 1.7.10
- [ADR-0487](ADR-0487-Quotes-Expand-On-Click-And-Overflow-Is-Measured-Rather-Than.md): Quotes expand on click, and overflow is measured rather than guessed — `web/frontend/src/ui.jsx`
- [ADR-0488](ADR-0488-One-Card-Primitive-For-Books-And-Films-With-Film-Frame-Finally.md): One card primitive for books and films, with .film-frame finally given its material — `web/frontend/src/index.css`
- [ADR-0489](ADR-0489-A-Dialogue-S-Frame-Is-A-Property-Of-The-Strip-Not-Of-The.md): A dialogue's frame is a property of the strip, not of the dialogue — `web/frontend/src/ui.jsx` · `web/frontend/src/Movies.jsx`
- [ADR-0490](ADR-0490-One-Grain-Scale-Per-Material-Role-Not-Per-Call-Site.md): One grain scale per material role, not per call site — `web/frontend/src/index.css`
- [ADR-0491](ADR-0491-Prefers-Contrast-More-And-Prefers-Reduced-Transparency-Strip.md): prefers-contrast: more and prefers-reduced-transparency strip every decorative layer — `web/frontend/src/index.css` · `web/frontend/src/ui.jsx`
- [ADR-0492](ADR-0492-Never-Rasterise-Text-On-A-Rotated-Or-Half-Pixel-Layer.md): Never rasterise text on a rotated or half-pixel layer
- [ADR-0493](ADR-0493-The-Measured-Genre-Chip-Strip-Was-Abandoned-For-A-Single.md): The measured genre chip strip was abandoned for a single dropdown
- [ADR-0494](ADR-0494-Native-Select-Is-Replaced-By-An-On-Brand-Select-With-A-Draggable.md): Native <select> is replaced by an on-brand Select with a draggable thumb — `web/frontend/src/ui.jsx`
- [ADR-0495](ADR-0495-ColorSwatches-Is-A-Roving-Tabindex-Radio-Group-Where-Selection.md): ColorSwatches is a roving-tabindex radio group where selection does not follow focus — `web/frontend/src/ui.jsx`
- [ADR-0496](ADR-0496-Edit-Forms-Open-In-A-Portalled-FormModal-A-Full-Screen-Sheet-On.md): Edit forms open in a portalled FormModal, a full-screen sheet on phones — `web/frontend/src/ui.jsx`
- [ADR-0497](ADR-0497-A-Form-Sheet-Does-Not-Dismiss-On-A-Scrim-Tap-And-Its-Save-Lives.md): A form sheet does not dismiss on a scrim tap, and its Save ✓ lives in the title bar — `web/frontend/src/ui.jsx`
- [ADR-0498](ADR-0498-Details-Replaced-The-Whole-Record-Edit-Form.md): Details replaced the whole-record Edit form — `web/frontend/src/WorkDetails.jsx` · `web/frontend/src/index.css`
- [ADR-0499](ADR-0499-Scroll-Chaining-Was-Fixed-By-A-Stylesheet-Invariant-Rather-Than.md): Scroll chaining was fixed by a stylesheet invariant rather than a case — `web/frontend/test/rules/scroll-containment.test.js`
- [ADR-0500](ADR-0500-An-ErrorBoundary-Shows-The-Real-Error-Instead-Of-A-White-Screen.md): An ErrorBoundary shows the real error instead of a white screen — `web/frontend/src/ui.jsx` · `web/frontend/src/App.jsx`
- [ADR-0501](ADR-0501-Overlapping-List-Requests-Are-Dropped-By-A-Sequence-Guard.md): Overlapping list requests are dropped by a sequence guard; freshly-added quotes pin to the top — `web/frontend/src/Movies.jsx` · `web/frontend/src/Library.jsx`
- [ADR-0502](ADR-0502-Tiles-Run-A-One-Open-At-A-Time-Accordion-And-The-Board-Collapses.md): Tiles run a one-open-at-a-time accordion, and the board collapses before any set change — `web/frontend/src/Library.jsx` · `Library.jsx` · `Movies.jsx`
- [ADR-0503](ADR-0503-The-Lightbox-Pushes-A-History-Entry-And-Portals-Past-Its.md): The Lightbox pushes a history entry, and portals past its filtered ancestor — `web/frontend/src/ui.jsx`
- [ADR-0504](ADR-0504-The-In-App-Back-Arrow-Is-The-Browser-S-Back-And-History-Js-Is.md): The in-app Back arrow is the browser's Back, and history.js is where that is decided — 2.1.3
- [ADR-0505](ADR-0505-Home-Favourites-Shuffle-On-Every-Load-And-Had-Never-Asked-For.md): Home favourites shuffle on every load, and had never asked for standalone quotes — `web/frontend/test/pure/home-favourites.test.js`
- [ADR-0506](ADR-0506-A-Credited-Person-Is-Always-A-Doorway-And-Everything-Named-On.md): A credited person is always a doorway, and everything named on Stats clicks through
- [ADR-0507](ADR-0507-Stats-Counted-Book-Highlights-As-Quotes-While-The-Nav-S-Quotes.md): Stats counted book highlights as "Quotes" while the nav's Quotes tab meant something else
- [ADR-0508](ADR-0508-Stats-Counts-All-Three-Kinds-Of-Quote-And-The-Colours-Card.md): Stats counts all three kinds of quote, and the colours card finally counts dialogues — `web/frontend/test/dom/stats-quotes.test.jsx`
- [ADR-0509](ADR-0509-Four-Role-Shaped-People-Breakdowns-Became-One-Row-Per-Person.md): Four role-shaped people breakdowns became one row per person — `internal/store/migrations/0027_people_one_row.sql`
- [ADR-0510](ADR-0510-The-Occasions-Breakdown-Was-Added-Because-The-Server-Already.md): The Occasions breakdown was added because the server already computed it, and removed
- [ADR-0511](ADR-0511-Superlatives-That-Needed-No-New-Query-With-Ties-Broken-Towards.md): Superlatives that needed no new query, with ties broken towards the earlier answer
- [ADR-0512](ADR-0512-The-Timeline-Dates-A-Quote-By-Its-Work-Draws-Empty-Buckets-And.md): The timeline dates a quote by its work, draws empty buckets, and lets the reader pick the scale — `web/frontend/test/pure/timeline-buckets.test.js`
- [ADR-0513](ADR-0513-The-Timeline-S-Stacked-Bar-Became-A-Dot-Plot.md): The timeline's stacked bar became a dot plot
- [ADR-0514](ADR-0514-The-Activity-Calendar-Reports-Accuracy-Alongside-Volume-And-Says.md): The activity calendar reports accuracy alongside volume, and says "no answers"
- [ADR-0515](ADR-0515-The-Quotes-Screen-Was-A-Flat-List-On-The-Premise-That-A.md): The Quotes screen was a flat list on the premise that a parentless quote has nothing to group by — `web/frontend/src/Quotes.jsx`
- [ADR-0516](ADR-0516-Quotes-Renders-On-The-Shared-List-Scaffold-And-Groups-By-Speaker.md): Quotes renders on the shared list scaffold and groups by speaker, medium, place and date
- [ADR-0517](ADR-0517-One-Action-Registry-Feeds-Both-The-Context-Menu-And-The-Bulk-Bar.md): One action registry feeds both the context menu and the bulk bar — 1.10.0 · works 1.11.1
- [ADR-0518](ADR-0518-An-Action-That-Cannot-Be-Done-In-Bulk-Is-Marked-Single-True.md): An action that cannot be done in bulk is marked single: true — 1.10.0 · works 1.11.1
- [ADR-0519](ADR-0519-Long-Press-Is-Already-Taken-By-Tooltips-Which-Constrains-Where.md): Long-press is already taken by tooltips, which constrains where the menu can be bound — 1.10.0 · works 1.11.1
- [ADR-0520](ADR-0520-Right-Click-Yields-To-The-Browser-When-Text-Is-Selected.md): Right-click yields to the browser when text is selected — 1.10.0 · works 1.11.1
- [ADR-0521](ADR-0521-A-Selection-Clears-When-The-Filter-Changes-Spans-One-Kind-And.md): A selection clears when the filter changes, spans one kind, and never persists — 1.10.0 · works 1.11.1
- [ADR-0522](ADR-0522-Bulk-Delete-Is-Never-Reachable-From-A-Gesture-Ships-Last-And.md): Bulk delete is never reachable from a gesture, ships last and alone, and needs the bin first — 1.10.0 · works 1.11.1
- [ADR-0523](ADR-0523-Two-Things-The-Context-Menu-Plan-Had-Wrong-And-One-It-Could-Not.md): Two things the context-menu plan had wrong, and one it could not have known — 1.10.0 · works 1.11.1 · completed 1.14.2
- [ADR-0524](ADR-0524-Gesture-Ground-Rules-Come-Before-Any-Gesture-And.md): Gesture ground rules come before any gesture, and swipe-between-tabs is rejected permanently — `docs/roadmap.html`
- [ADR-0525](ADR-0525-One-Action-Registry-Rendered-By-Every-Surface.md): One action registry, rendered by every surface — 1.9.0
- [ADR-0526](ADR-0526-The-Card-Menu-S-Long-Press-Is-On-The-Card-BODY-Because-Tooltip.md): The card menu's long press is on the card BODY, because Tooltip already owns the control — 1.9.0
- [ADR-0527](ADR-0527-A-Text-Selection-Inside-A-Card-Gives-The-Browser-S-Menu-Right-Of.md): A text selection inside a card gives the browser's menu right of way — 1.9.0
- [ADR-0528](ADR-0528-POST-Quotes-Bulk-Is-Not-A-Mirror-Of-The-Other-Two.md): POST /quotes/bulk is not a mirror of the other two — 1.9.0
- [ADR-0529](ADR-0529-A-Selection-Drops-What-Leaves-The-Screen-Rather-Than-Clearing-Or.md): A selection drops what leaves the screen, rather than clearing or persisting — 1.10.0
- [ADR-0530](ADR-0530-Select-Is-The-First-Item-In-The-Card-S-Own-Menu.md): Select is the first item in the card's own menu — 1.10.0
- [ADR-0531](ADR-0531-A-Deleted-Selection-Is-ONE-Bin-Entry-Behind-A-Phrase-Counting.md): A deleted selection is ONE bin entry, behind a phrase counting what will go — 1.10.0
- [ADR-0532](ADR-0532-A-Long-Press-Means-Three-Different-Things-Decided-By-Where-It.md): A long press means three different things, decided by where it lands — 1.11.1
- [ADR-0533](ADR-0533-Work-Cards-Select-Too-And-The-Bar-Serves-Both-Kinds-Off-One.md): Work cards select too, and the bar serves both kinds off one registry — 1.11.1
- [ADR-0534](ADR-0534-Keeping-Something-Out-Of-The-Quiz-Is-A-Column-On-The-Row-Not-A.md): Keeping something out of the quiz is a column on the row, not a flag on the schedule — 1.11.1
- [ADR-0535](ADR-0535-Fill-The-Gaps-Writes-Only-What-Is-Empty-Which-Is-What-Lets-It.md): Fill the gaps writes only what is empty, which is what lets it skip the preview — 1.11.1
- [ADR-0536](ADR-0536-Home-S-Favourites-Reorder-Once-Per-Visit-Not-Once-Per-Reload.md): Home's favourites reorder once per visit, not once per reload — 1.11.1
- [ADR-0537](ADR-0537-The-Selection-Bar-Is-Three-Glyphs-And-An-Overflow-And-Which.md): The selection bar is three glyphs and an overflow, and which three is a decision in the registry — 1.12.0
- [ADR-0538](ADR-0538-The-Wishlist-Folder-Is-A-Door-To-The-Chip-Not-A-Place-Things.md): The wishlist folder is a door to the chip, not a place things live — 1.12.0
- [ADR-0539](ADR-0539-A-Long-Empty-Stretch-Of-The-Timeline-Keeps-Its-Width-And-Earns.md): A long empty stretch of the timeline keeps its width and earns it — 1.12.0
- [ADR-0540](ADR-0540-The-Quotes-Page-Splits-Three-Ways-On-One-Tab-Rather-Than-Three.md): The Quotes page splits three ways, on one tab rather than three — 1.13.0
- [ADR-0541](ADR-0541-Starter-Proverbs-Are-Opt-In-Per-Language-And-That-Is-The-Whole.md): Starter proverbs are opt-in, per language, and that is the whole design — 1.13.0
- [ADR-0542](ADR-0542-One-Control-Family-So-Button-Labels-Governs-The-Whole-App.md): One control family, so "Button labels" governs the whole app — 1.13.0
- [ADR-0543](ADR-0543-Info-Dots-Are-What-The-Control-Does-Plus-One-Consequence-And-It.md): Info dots are what the control does plus one consequence, and it is enforced — 1.13.0
- [ADR-0544](ADR-0544-A-Book-Has-Three-Credits-And-The-Other-Two-Are-People-Rather.md): A book has three credits, and the other two are people rather than strings — 1.12.0
- [ADR-0545](ADR-0545-The-Changelog-Ships-Inside-The-Binary-Rather-Than-Being-Fetched.md): The changelog ships inside the binary rather than being fetched — 1.12.0
- [ADR-0546](ADR-0546-A-Timeline-Label-Is-A-Year-And-A-Year-Has-To-Be-Readable-And.md): A timeline label is a year, and a year has to be readable and honest about its scale — 1.13.2
- [ADR-0547](ADR-0547-A-Decade-Is-A-Door-A-Year-And-A-Century-Are-Deliberately-Not.md): A decade is a door; a year and a century are deliberately not — 1.13.2
- [ADR-0548](ADR-0548-A-Board-Of-Quotes-Is-Ordered-And-Grouped-And-Each-Dimension-Runs.md): A board of quotes is ordered and grouped, and each dimension runs in the order it is read in — 3.1.0

<a id="area-15"></a>

## §15 Appearance as Material: Skins, Texture, Type and Colour

The look is not decoration sitting on top of the app; it is a set of decisions with
tests, escape hatches and a migration behind them. This section exists because a
completeness pass over the other sixteen found that the most-argued family in the
project — what the thing is made of — had no home in any of them, which is how a
decision quietly becomes a preference.

- [ADR-0549](ADR-0549-Two-Aesthetics-Light-Dark-Four-Accents-And-No-More-Axes-Than.md): Two aesthetics × light/dark × four accents, and no more axes than that — pre-1.0
- [ADR-0550](ADR-0550-The-Textures-Are-Real-Tiles-Blended-Not-Gradients-Pretending.md): The textures are real tiles, blended — not gradients pretending — pre-1.0
- [ADR-0551](ADR-0551-Every-Decorative-Layer-Drops-To-Zero-On-Prefers-Contrast-Or.md): Every decorative layer drops to zero on prefers-contrast or prefers-reduced-transparency — 1.6.0
- [ADR-0552](ADR-0552-Five-Self-Hosted-Families-In-Semantic-Roles-And-A-Bengali-One.md): Five self-hosted families in semantic roles, and a Bengali one that is not decoration — pre-1.0
- [ADR-0553](ADR-0553-Font-Src-Allows-Data-And-The-Reason-Is-A-Silent-Failure.md): font-src allows data:, and the reason is a silent failure — `internal/httpapi/server.go`
- [ADR-0554](ADR-0554-The-Colour-Category-Palette-Is-Curated-And-Deliberately-Disjoint.md): The colour-category palette is curated, and deliberately disjoint from the accents — 1.7.0
- [ADR-0555](ADR-0555-A-Category-Name-Is-Capped-At-Fifteen-Runes-Counted-In-Runes-And.md): A category name is capped at fifteen runes, counted in runes, and lowering it is not retroactive — 1.7.7
- [ADR-0556](ADR-0556-Theme-Colours-And-Label-Density-Are-Applied-Before-The-First.md): Theme, colours and label density are applied before the first paint — `web/frontend/src/main.jsx`
- [ADR-0557](ADR-0557-Every-Label-Is-Five-Words-Or-Fewer-And-Longer-Copy-Goes-Behind.md): Every label is five words or fewer, and longer copy goes behind an info dot — 1.4.1
- [ADR-0558](ADR-0558-Six-Type-ROLES-Three-Faces-Each-And-Every-One-Bundled.md): Six type ROLES, three faces each, and every one bundled — 1.15.0
- [ADR-0559](ADR-0559-The-Bengali-Face-Changed-On-The-Reader-S-Judgement-And-The-Old.md): The Bengali face changed on the reader's judgement, and the old one stayed on the list — 1.15.0
- [ADR-0560](ADR-0560-The-Indic-Faces-Live-Inside-The-Latin-Stacks-So-Changing-One.md): The Indic faces live inside the Latin stacks, so changing one rebuilds three — 1.15.0
- [ADR-0561](ADR-0561-The-Style-Modifiers-Are-Companion-Custom-Properties-And-OFF-Is.md): The style modifiers are companion custom properties, and OFF is inherit — 1.15.0, revised 1.15.2
- [ADR-0562](ADR-0562-An-Uploaded-Font-Is-Stored-And-Never-Parsed-And-The-Script-Check.md): An uploaded font is stored and never parsed, and the script check runs in the browser — 1.15.0
- [ADR-0563](ADR-0563-The-Share-Image-Resolves-The-Same-Faces-Because-Canvas-Cannot.md): The share image resolves the same faces, because canvas cannot read a custom property — 1.15.0
- [ADR-0564](ADR-0564-A-Proverb-Wears-Its-Language-Where-Every-Other-Quote-Wears-A.md): A proverb wears its language where every other quote wears a face — 1.15.0
- [ADR-0565](ADR-0565-Type-And-Language-Marks-Are-Pop-Ups-Off-The-Appearance-Card-Not.md): Type and Language marks are pop-ups off the Appearance card, not cards in the settings grid — 1.15.2
- [ADR-0566](ADR-0566-A-Component-Used-In-JSX-And-Never-Imported-Is-Caught-By-Reading.md): A component used in JSX and never imported is caught by reading every capitalised tag, not every Icon — 1.15.2

<a id="area-16"></a>

## §16 Serving and Running It: HTTP Surface, Logging, TLS and Updates

The HTTP surface is stdlib routing with compression and paging added without changing any existing behaviour, and every operational failure is expected to be diagnosable from `docker logs` alone. Update and TLS features are opt-in, with the trade-offs stated rather than sold.

- [ADR-0567](ADR-0567-The-JSON-API-Mounts-Under-Api-And-Healthz-Stays-Out-Of-The-Log.md): The JSON API mounts under /api, and /healthz stays out of the log — 1.0.0
- [ADR-0568](ADR-0568-Healthz-Asks-The-Pool-For-A-Connection-And-An-API-Request-Waits.md): /healthz asks the pool for a connection, and an API request waits ten seconds for one at most — 3.0.1
- [ADR-0569](ADR-0569-Response-Gzip-From-Compress-Gzip-Decided-At-WriteHeader.md): Response gzip from compress/gzip, decided at WriteHeader — 1.1.0
- [ADR-0570](ADR-0570-Pagination-Is-Opt-In-Limit-Offset-So-The-Web-UI-Is-Unchanged.md): Pagination is opt-in limit/offset, so the web UI is unchanged — 1.1.0
- [ADR-0571](ADR-0571-An-Unauthenticated-Api-Capabilities-Handshake.md): An unauthenticated /api/capabilities handshake — 1.1.0
- [ADR-0572](ADR-0572-Separate-Body-Size-Caps-Per-Surface.md): Separate body-size caps per surface — from 1.0.0
- [ADR-0573](ADR-0573-Stored-Images-Have-Random-Never-Reused-Names.md): Stored images have random, never-reused names — from 0.3.0
- [ADR-0574](ADR-0574-Structured-Error-Codes-TIP--SUBSYS--NNN-Append-Only-On-Both.md): Structured error codes TIP-<SUBSYS>-NNN, append-only, on both streams — 0.6.4 onward
- [ADR-0575](ADR-0575-A-Read-That-Shows-A-Log-Waits-Up-To-200-Ms-For-The-Log-Writer.md): A read that shows a log waits up to 200 ms for the log writer; the list of past jobs does not — 3.1.0
- [ADR-0576](ADR-0576-A-List-Row-Scan-Error-Is-Logged-Loudly-And-Never-Shortens-A-List.md): A list-row scan error is logged loudly and never shortens a list — 0.6.4
- [ADR-0577](ADR-0577-Startup-Runs-Quick-Check-And-An-FTS-Integrity-Check-On-Every.md): Startup runs quick check and an FTS integrity check on every boot — 0.4.6
- [ADR-0578](ADR-0578-Outbound-Tracing-Redacts-Query-Param-Secrets-And-So-Does-Every.md): Outbound tracing redacts query-param secrets, and so does every error a call returns — 0.6.4; one list 3.1.0
- [ADR-0579](ADR-0579-The-Container-Healthcheck-Is-The-Binary-Probing-Its-Own-Loopback.md): The container healthcheck is the binary probing its own loopback port — from 0.3.0
- [ADR-0580](ADR-0580-Native-TLS-From-A-PEM-Pair-Hot-Reloaded-With-An-Explicit-Refusal.md): Native TLS from a PEM pair, hot-reloaded, with an explicit refusal on ACME — 0.9.4
- [ADR-0581](ADR-0581-One-Click-Update-Through-The-Mounted-Docker-Socket-Opt-In.md): One-click update through the mounted Docker socket, opt-in — 0.6.0
- [ADR-0582](ADR-0582-TIPPANI-DOCKER-HOST-Adds-A-Socket-Proxy-Route-Honestly.md): TIPPANI DOCKER HOST adds a socket-proxy route, honestly documented — 0.9.4
- [ADR-0583](ADR-0583-The-Update-Helper-Joins-All-Of-The-Target-S-Networks.md): The update helper joins all of the target's networks — 0.9.4
- [ADR-0584](ADR-0584-The-Update-Check-Is-Strictly-On-Demand-And-The-Version-Is.md): The update check is strictly on demand, and the version is stamped in — 0.6.0
- [ADR-0585](ADR-0585-The-Manual-Update-Command-Became-One-Idempotent-Line.md): The manual update command became one idempotent line — 0.6.2
- [ADR-0586](ADR-0586-The-Self-Updater-Speaks-Raw-Engine-API-And-Leans-On-A-One-Shot.md): The self-updater speaks raw Engine API, and leans on a one-shot Watchtower — 0.6.0
- [ADR-0587](ADR-0587-TIPPANI-DOCKER-HOST-Rather-Than-The-Conventional-DOCKER-HOST.md): TIPPANI DOCKER HOST rather than the conventional DOCKER HOST — 0.9.4
- [ADR-0588](ADR-0588-The-Homepage-Widget-Is-Tiered-Cheapest-First-With-The-PR-Gated.md): The Homepage widget is tiered cheapest-first, with the PR gated upstream — planned

<a id="area-17"></a>

## §17 Verification, Release Engineering and Provenance

This code was written almost entirely by AI, which fails differently: it compiles, reads well, and can still be wrong, so plausibility counts for nothing and only execution does. The decisions here are about what gets checked, what the checks cannot cover, and how the project's own documents are kept from drifting.

- [ADR-0589](ADR-0589-Importers-Are-Verified-Against-Real-Exports-And-The-Fixtures-Are.md): Importers are verified against real exports, and the fixtures are synthetic — 0.x onward
- [ADR-0590](ADR-0590-A-Test-Must-Not-Assert-Against-The-Wall-Clock-Or-Against-Being.md): A test must not assert against the wall clock, or against being the newest migration — 0.6.1 / 1.1.0
- [ADR-0591](ADR-0591-Round-Trip-Tests-Keep-Asserting-What-They-Asserted-Before.md): Round-trip tests keep asserting what they asserted before — 1.2.0
- [ADR-0592](ADR-0592-A-Passing-Test-You-Have-Not-Seen-Fail-Is-A-Decoration.md): A passing test you have not seen fail is a decoration — 1.5.0
- [ADR-0593](ADR-0593-A-Test-Whose-Invalid-Input-Silently-Becomes-Valid-Asserts.md): A test whose invalid input silently becomes valid asserts nothing — 1.7.1
- [ADR-0594](ADR-0594-Mutation-Testing-Is-The-Gate-For-A-New-Rule-And-A-Surviving.md): Mutation testing is the gate for a new rule, and a surviving mutant is the finding — 1.7.0
- [ADR-0595](ADR-0595-Assertions-About-A-Destructive-Migration-Are-About-Values-Not.md): Assertions about a destructive migration are about values, not counts — 1.7.1
- [ADR-0596](ADR-0596-Schema-Shape-Is-Captured-From-SQLite-Itself-Via-PRAGMA.md): Schema shape is captured from SQLite itself, via PRAGMA — 1.7.x
- [ADR-0597](ADR-0597-A-Gate-That-Only-Reads-Its-Own-Output-Cannot-Fail.md): A gate that only reads its own output cannot fail — 1.5.2
- [ADR-0598](ADR-0598-Doc-Tests-Read-The-Source-Not-The-Docs.md): Doc tests read the source, not the docs — 1.6.0
- [ADR-0599](ADR-0599-A-Bug-Of-Omission-Needs-A-Stylesheet-Invariant-Sweep-Not-A-Case.md): A bug of omission needs a stylesheet invariant sweep, not a case — 1.7.2, extended 1.7.6
- [ADR-0600](ADR-0600-Changing-A-Default-Changes-Nothing-If-The-Default-Was-Ever.md): Changing a default changes nothing if the default was ever written down — 1.7.2
- [ADR-0601](ADR-0601-Placement-Arithmetic-Is-A-Pure-Exported-Function.md): Placement arithmetic is a pure exported function — 1.7.6
- [ADR-0602](ADR-0602-Frontend-Tests-Assert-Paint-Calls-And-Canvas-Output-Not.md): Frontend tests assert paint calls and canvas output, not configuration or markup — 1.6.0
- [ADR-0603](ADR-0603-A-Frontend-Test-Suite-Arrived-As-Dev-Only-Vitest-In-Two-Projects.md): A frontend test suite arrived as dev-only Vitest in two projects — 1.5.0
- [ADR-0604](ADR-0604-Test-File-Paths-Come-From-Vitest-Config-Js-Not-From-Cwd.md): Test file paths come from vitest.config.js, not from cwd — 1.6.x
- [ADR-0605](ADR-0605-The-Demo-Fetch-Shim-Is-Tested-Against-The-Handlers-It-Imitates.md): The demo fetch shim is tested against the handlers it imitates — 1.3.1 and 1.5.0
- [ADR-0606](ADR-0606-The-Greeting-Tables-Are-Checked-By-Exhaustive-Permutation.md): The greeting tables are checked by exhaustive permutation — 1.4.0
- [ADR-0607](ADR-0607-The-Archive-Header-Is-Parsed-In-Two-Languages-And-Checked.md): The archive header is parsed in two languages and checked against itself — 1.4.2, moved into Vitest at 1.5.0
- [ADR-0608](ADR-0608-CI-Checks-The-Committed-Web-Dist-And-Runs-The-Race-Detector.md): CI checks the committed web/dist and runs the race detector — 1.5.0
- [ADR-0609](ADR-0609-Both-CI-Jobs-Had-Been-Red-On-Every-Push-For-Eight-Releases.md): Both CI jobs had been red on every push for eight releases — 1.7.4
- [ADR-0610](ADR-0610--Race-Is-Split-Five-Locking-Tests-Per-Push-The-Whole-Suite.md): -race is split: five locking tests per push, the whole suite nightly — 1.7.5
- [ADR-0611](ADR-0611-A-Composite-Map-Key-Uses-An-Escape-Never-A-Literal-NUL-Byte.md): A composite map key uses an escape, never a literal NUL byte — 1.5.1
- [ADR-0612](ADR-0612-Gitattributes-Names-The-Text-Types-Explicitly.md): .gitattributes names the text types explicitly — 1.7.4
- [ADR-0613](ADR-0613-Releases-Are-Cut-Automatically-From-The-Matching-CHANGELOG.md): Releases are cut automatically from the matching CHANGELOG section — 0.4.3
- [ADR-0614](ADR-0614-Latest-And-X-Y-Are-Claimed-By-Rank-Not-By-Arrival.md): ":latest" and "X.Y" are claimed by rank, not by arrival — 1.7.3
- [ADR-0615](ADR-0615-The-Documented-Release-Command-Pushes-One-Named-Tag.md): The documented release command pushes one named tag — 1.7.3
- [ADR-0616](ADR-0616-Departures-From-The-Plan-Are-Recorded-In-The-Plan.md): Departures from the plan are recorded in the plan — 1.3.2
- [ADR-0617](ADR-0617-Docs-Wiki-Design-Decisions-Md-Stays-ROADMAP-Md-And-MILESTONE-3.md): docs/wiki/Design-decisions.md stays; ROADMAP.md and MILESTONE-3.md go — 1.3.1
- [ADR-0618](ADR-0618-Docs-Live-As-Self-Contained-Static-HTML-With-No-Script.md): Docs live as self-contained static HTML with no script — 1.3.1 and 1.3.2
- [ADR-0619](ADR-0619-The-Roadmap-Has-No-Curated-List-Labels-Decide-The-Page.md): The roadmap has no curated list — labels decide the page — 1.3.2
- [ADR-0620](ADR-0620-Closing-The-Issue-Is-What-Takes-An-Item-Off-The-Roadmap-And.md): Closing the issue is what takes an item off the roadmap, and something checks that now — 1.16.x
- [ADR-0621](ADR-0621-Every-Roadmap-Write-Is-Guarded-And-Keeps-A-Backup.md): Every roadmap write is guarded and keeps a backup — 1.3.2
- [ADR-0622](ADR-0622-Issue-Form-Labels-Are-Recovered-From-The-Form-S-Field-Headings.md): Issue-form labels are recovered from the form's field headings — 1.3.2
- [ADR-0623](ADR-0623-A-Plan-Lives-In-Docs-Plans-Until-It-Ships-Then-Folds-Into-This.md): A plan lives in docs/plans/ until it ships, then folds into this document and retires — 1.7.x · retired at 1.14.2
- [ADR-0624](ADR-0624-Verification-Against-The-Tree-Changed-The-Plans-Before-Any-Code.md): Verification against the tree changed the plans before any code was written — 1.7.x
- [ADR-0625](ADR-0625-Every-Decision-In-The-Three-Feature-Plans-Is-A-Settled-Answer.md): Every decision in the three feature plans is a settled answer, and the unsettled one says so — 1.7.x
- [ADR-0626](ADR-0626-AI-Review-Is-Worth-More-Than-AI-Code-And-It-Is-The-Same-Model.md): AI review is worth more than AI code, and it is the same model — 1.4.2
- [ADR-0627](ADR-0627-What-Is-Checked-Is-Published-Alongside-What-It-Does-Not-Cover.md): What is checked is published alongside what it does not cover — 1.4.2 onward
- [ADR-0628](ADR-0628-The-AI-Audit-Trail-Is-The-Git-History-Itself.md): The AI audit trail is the git history itself — 1.4.2 onward
- [ADR-0629](ADR-0629-Attribution-Is-A-Stated-Requirement-Not-A-Courtesy.md): Attribution is a stated requirement, not a courtesy — ?
- [ADR-0630](ADR-0630-Developing-Md-Exists-For-People-Who-Would-Rather-Fork-Than-File.md): Developing.md exists for people who would rather fork than file — 1.3.2
- [ADR-0631](ADR-0631-The-Site-Root-Is-A-Real-HTML-Landing-Page-The-Demo-Moved-Down-To.md): The site root is a real HTML landing page; the demo moved down to /demo/ — 1.7.6
- [ADR-0632](ADR-0632-The-App-S-Index-Html-Gets-No-Og-Url-And-No-Canonical.md): The app's index.html gets no og:url and no canonical — 1.7.6
- [ADR-0633](ADR-0633-Every-Local-Link-On-The-Published-Site-Is-Checked-Before-Deploy.md): Every local link on the published site is checked before deploy — 1.7.6, corrected in 3.0.0
- [ADR-0634](ADR-0634-The-Demo-S-Install-Manifest-Is-Rewritten-In-Place-And-The-App-S.md): The demo's install manifest is rewritten in place, and the app's copy is left alone — 1.7.6
- [ADR-0635](ADR-0635-Every-Screen-Is-Mounted-By-A-Test-Because-Extracting-The-Logic.md): Every screen is mounted by a test, because extracting the logic left the screen unexecuted — 1.13.2
- [ADR-0636](ADR-0636-TheTVDB-Is-The-Default-Film-Source-Because-A-Role-Can-Have-A.md): TheTVDB is the default film source, because a role can have a face and TMDB has none — 2.2.0
- [ADR-0637](ADR-0637-A-One-Time-Upgrade-Pass-Is-Its-Own-File-Named-For-Its-Release.md): A one-time upgrade pass is its own file, named for its release, and deleting it is the whole of retiring it — 2.2.0
- [ADR-0638](ADR-0638-A-Character-S-Picture-Is-Fetched-Once-And-Served-From-Here-Not.md): A character's picture is fetched once and served from here, not hotlinked — 2.2.0
- [ADR-0639](ADR-0639-A-Reader-S-Own-Picture-And-A-Fetched-One-Are-The-Same-Picture.md): A reader's own picture and a fetched one are the same picture — 2.2.0
- [ADR-0640](ADR-0640-A-Proverb-S-Share-Carries-Both-Texts-And-The-Drawing-Finally-Has.md): A proverb's share carries both texts, and the drawing finally has a test — 2.2.0
- [ADR-0641](ADR-0641-A-Quote-S-Chip-Is-The-Character-S-Face-And-The-Search-Section.md): A quote's chip is the character's face, and the search section decides which face — 2.2.0
- [ADR-0642](ADR-0642-Nine-Yes-No-Toggles-Become-One-Row-Of-Chips-Because-The-Question.md): Nine Yes/No toggles become one row of chips, because the question was a set all along — 2.2.1
- [ADR-0643](ADR-0643-A-Locator-Box-Offers-What-The-Work-Already-Knows-And-The-Work-Is.md): A locator box offers what the work already knows, and the work is asked rather than the library — 1.17.0
- [ADR-0644](ADR-0644-The-Capture-Surface-Asks-For-The-Locators-The-Medium-Actually.md): The capture surface asks for the locators the medium actually has — 1.17.0
- [ADR-0645](ADR-0645-IMDb-Is-One-On-Demand-Pass-Keyed-On-An-Id-The-Reader-Supplies.md): IMDb is one on-demand pass, keyed on an id the reader supplies, and it never searches — 1.17.0
- [ADR-0646](ADR-0646-The-Cleanup-Page-Answers-Its-Own-Findings-And-A-Refusal-Is.md): The cleanup page answers its own findings, and a refusal is remembered — 2.2.1
- [ADR-0647](ADR-0647-A-Game-S-Line-Is-Corrected-Where-It-Is-Written-And-A-Standalone.md): A game's line is corrected where it is written, and a standalone quote stops losing its own fields — 2.2.1
- [ADR-0648](ADR-0648-A-Rule-Earns-An-Accept-Button-Only-When-Its-Rewrite-Is-Safe-On.md): A rule earns an accept button only when its rewrite is safe on the text it fires on wrongly — 2.2.2
- [ADR-0649](ADR-0649-A-Control-That-Writes-Nothing-Is-Worse-Than-A-Missing-One-And.md): A control that writes nothing is worse than a missing one, and only a test that types into it can tell — 2.2.2
- [ADR-0650](ADR-0650-A-Fixed-Vocabulary-Beats-A-Text-Box-Wherever-A-Screen-GROUPS-By.md): A fixed vocabulary beats a text box wherever a screen GROUPS by the field — 2.2.3
- [ADR-0651](ADR-0651-Plumbing-With-No-Tap-Is-Not-A-Feature-And-Nothing-In-This-Repo.md): Plumbing with no tap is not a feature, and nothing in this repo notices — 2.2.3
- [ADR-0652](ADR-0652-A-Cast-Re-Pull-Is-A-Different-Control-From-A-Re-Sync-And-The.md): A cast re-pull is a different control from a re-sync, and the difference is what gets pressed — 2.2.3
- [ADR-0653](ADR-0653-A-Native-Control-Is-Only-Better-While-The-Browsers-Agree-About.md): A native control is only better while the browsers agree about it — 2.2.3
- [ADR-0654](ADR-0654-The-Demotion-Is-What-Makes-An-As-You-Type-Rule-Survive-Its-Own.md): The demotion is what makes an as-you-type rule survive its own prefixes — 2.2.3
- [ADR-0655](ADR-0655-Measure-The-Round-Trips-Before-Optimising-The-Work.md): Measure the round trips before optimising the work — 2.2.3
- [ADR-0656](ADR-0656-A-Feature-Can-Be-One-Argument-Wide.md): A feature can be one argument wide — 2.2.3
- [ADR-0657](ADR-0657-Two-Harmless-Changes-One-Bug-The-Default-Button-Nobody-Declared.md): Two harmless changes, one bug: the default button nobody declared — 2.2.4
- [ADR-0658](ADR-0658-A-Rule-About-English-Words-Cannot-Be-Applied-To-A-Field-That.md): A rule about English words cannot be applied to a field that might hold a name — 2.2.4
- [ADR-0659](ADR-0659-Who-Capitalises-The-Page-The-Keyboard-And-The-Two-Of-Them.md): Who capitalises: the page, the keyboard, and the two of them disagreeing — 2.2.4
- [ADR-0660](ADR-0660-A-Blank-Is-Only-A-Clear-Where-The-Column-Has-One.md): A blank is only a clear where the column has one — 2.2.4
- [ADR-0661](ADR-0661-Answering-It-Does-Not-Fetch-By-Default-On-One-Screen-Is-Not.md): Answering "it does not fetch by default" on one screen is not answering it — 2.2.4
- [ADR-0662](ADR-0662-A-Form-Inside-A-Form-And-Why-A-Portal-Does-Not-Save-You.md): A form inside a form, and why a portal does not save you — 2.2.5
- [ADR-0663](ADR-0663-The-Last-Word-And-The-Demotion-That-Makes-It-Safe.md): The last word, and the demotion that makes it safe — 2.2.5
- [ADR-0664](ADR-0664-Reversing-A-List-Of-One-Is-That-List.md): Reversing a list of one is that list — 2.2.5
- [ADR-0665](ADR-0665-Half-A-Sweep-Is-A-Sweep-That-Reads-As-Done.md): Half a sweep is a sweep that reads as done — 2.2.5
- [ADR-0666](ADR-0666-A-Callback-Named-For-The-Record-Cannot-Be-Called-By-Something.md): A callback named for the record cannot be called by something that means "the list" — 2.2.6
- [ADR-0667](ADR-0667-The-Third-And-Fourth-Shapes-Of-One-Casing-Rule.md): The third and fourth shapes of one casing rule — 2.2.6
- [ADR-0668](ADR-0668-The-Reply-Is-The-Answer-Unless-The-Filter-Disagrees.md): The reply is the answer, unless the filter disagrees — 2.2.6
- [ADR-0669](ADR-0669-A-Vocabulary-That-Changed-Has-To-Be-Chased-Into-The-Copy-And-The.md): A vocabulary that changed has to be chased into the copy and the stored keys — 2.2.6
- [ADR-0670](ADR-0670-The-Repair-That-Stopped-One-Step-Short-Twice.md): The repair that stopped one step short, twice — 2.2.7
- [ADR-0671](ADR-0671-A-Shared-Rule-Belongs-In-The-Module-That-Is-Shared.md): A shared rule belongs in the module that is shared — 2.2.7
- [ADR-0672](ADR-0672-The-Fourth-Read-Of-One-Column.md): The fourth read of one column — 2.2.7
- [ADR-0673](ADR-0673-The-Capitaliser-Could-Not-Be-Argued-With.md): The capitaliser could not be argued with — 2.2.8
- [ADR-0674](ADR-0674-A-Table-Nothing-Wrote-To-Is-A-Feature-Nobody-Has.md): A table nothing wrote to is a feature nobody has — 2.2.8
- [ADR-0675](ADR-0675-The-Picture-Is-The-Thing-You-Press.md): The picture is the thing you press — 2.2.8
- [ADR-0676](ADR-0676-The-Route-Was-Right-And-Nothing-Was-Asking.md): The route was right and nothing was asking — 2.2.8; one request 3.1.0
- [ADR-0677](ADR-0677-V3-The-Materials-Release-Decided-Before-It-Was-Started.md): v3 — the materials release, decided before it was started — v3.0.0
- [ADR-0678](ADR-0678-The-Glossary-Is-Generated-Because-A-Document-Nothing-Executes.md): The glossary is generated, because a document nothing executes cannot fail — Unreleased
- [ADR-0679](ADR-0679-A-Fill-Has-To-Argue-For-Itself-And-Only-Four-Arguments-Count.md): A fill has to argue for itself, and only four arguments count — Unreleased
- [ADR-0680](ADR-0680-An-Edge-Fade-Is-Measured-Not-Painted-And-It-Names-Which-End.md): An edge fade is measured, not painted — and it names which end still has content
- [ADR-0681](ADR-0681-The-Scroller-S-Listeners-Live-On-The-Scroller-And-Nothing.md): The scroller's listeners live on the scroller, and nothing listens at rest
- [ADR-0682](ADR-0682-ROW-And-EDGE-Are-Custom-Properties-The-Other-Geometry-Constants.md): ROW and EDGE are custom properties; the other geometry constants are not
- [ADR-0683](ADR-0683-The-24px-Root-Test-Is-Run-At-The-Type-Dial-S-200-Because-The.md): The 24px-root test is run at the type dial's 200%, because the literal version proves nothing here
- [ADR-0684](ADR-0684-Two-Placeholder-Findings-Reported-Rather-Than-Fixed.md): Two placeholder findings, reported rather than fixed — Unreleased
- [ADR-0685](ADR-0685-The-Navigation-Is-A-Rail-Down-The-Left-Edge-Not-A-Strip-Across.md): The navigation is a rail down the left edge, not a strip across the top
- [ADR-0686](ADR-0686-The-Bin-And-Checks-Are-Doors-In-The-Rail-S-Foot-Not-Tiles-In.md): The bin and Checks are doors in the rail's foot, not tiles in Settings
- [ADR-0687](ADR-0687-The-Top-Bar-Holds-Where-You-Are-And-How-To-Leave.md): The top bar holds where you are and how to leave
- [ADR-0688](ADR-0688-An-Icon-Test-That-Approximated-The-Geometry-Certified-The.md): An icon test that approximated the geometry certified the approximation — Unreleased
- [ADR-0689](ADR-0689-A-Field-S-Source-Is-Shown-Per-Field-With-The-Supplier-S-Own-Mark.md): A field's source is shown per field, with the supplier's own mark
- [ADR-0690](ADR-0690-Brand-Marks-Which-Reverses-A-Decision-Written-In-The-Source.md): Brand marks, which reverses a decision written in the source
- [ADR-0691](ADR-0691-Typing-Over-A-Value-Re-Sources-That-Field-To-You.md): Typing over a value re-sources that field to you
- [ADR-0692](ADR-0692-SourceName-Moved-To-Ui-Jsx.md): sourceName moved to ui.jsx — Unreleased
- [ADR-0693](ADR-0693-A-Single-Work-S-Delete-Asks-For-The-Typed-Phrase-In-English.md): A single work's delete asks for the typed phrase, in English — Unreleased
- [ADR-0694](ADR-0694-A-Nav-Row-Names-Its-Container-And-Its-Contents.md): A nav row names its container and its contents — Unreleased
- [ADR-0695](ADR-0695-The-Is-A-Menu-Bar-Not-An-Overflow.md): The ⋯ is a menu bar, not an overflow — Unreleased
- [ADR-0696](ADR-0696-A-Person-And-A-Character-Are-Reached-By-Id-And-The-Name.md): A person and a character are reached by id, and the name endpoints stay — Unreleased
- [ADR-0697](ADR-0697-The-Person-Panel-Is-Three-Scopes-And-Each-One-Says-Its-Blast.md): The person panel is three scopes, and each one says its blast radius — Unreleased
- [ADR-0698](ADR-0698-Merging-Two-Records-Writes-A-Reversal-Into-The-Bin-Not-A.md): Merging two records writes a reversal into the bin, not a snapshot — Unreleased
- [ADR-0699](ADR-0699-Splitting-An-Alias-Back-Out-Gives-A-Record-And-Moves-Nothing.md): Splitting an alias back out gives a record and moves nothing — Unreleased
- [ADR-0700](ADR-0700-A-Cast-Row-Writes-Its-Two-Records-At-The-Moment-It-Is-Written.md): A cast row writes its two records at the moment it is written — Unreleased
- [ADR-0701](ADR-0701-The-Merge-Picker-Says-How-Much-Hangs-Off-Each-Record.md): The merge picker says how much hangs off each record — Unreleased
- [ADR-0702](ADR-0702-OPEN-There-Are-Now-Two-Ways-To-Fold-Two-People-And-They-Promise.md): OPEN — there are now two ways to fold two people, and they promise different things — Unreleased
- [ADR-0703](ADR-0703-The-Browser-S-Confirm-Is-Gone-And-The-Dialog-That-Replaced-It-Is.md): The browser's confirm() is gone, and the dialog that replaced it is portalled — Unreleased
- [ADR-0704](ADR-0704-The-Wide-Rail-Is-Not-A-Px-Box-And-Make-Typescale-Is-Still-Red.md): The wide rail is not a px box, and make typescale is still red — Unreleased
- [ADR-0705](ADR-0705-OPEN-A-Growing-Rail-Or-The-Icon-Rail-Once-The-Type-Is-Turned-Up.md): OPEN — a growing rail, or the icon rail, once the type is turned up — Unreleased
- [ADR-0706](ADR-0706-OPEN-The-Nightly--Race-Sweep-No-Longer-Fits-In-Its-Hour.md): OPEN — the nightly -race sweep no longer fits in its hour — Unreleased
- [ADR-0707](ADR-0707-The-Type-Dial-Stops-At-175-And-The-Rail-Drops-Its-Words-Rather.md): The type dial stops at 175%, and the rail drops its words rather than growing — Unreleased
- [ADR-0708](ADR-0708-A-Name-Is-Never-Truncated-And-Now-Nothing-Truncates-One.md): A name is never truncated, and now nothing truncates one — Unreleased
- [ADR-0709](ADR-0709-The-Nightly--Race-Sweep-Is-Sharded-By-Package.md): The nightly -race sweep is sharded by package — Unreleased
- [ADR-0710](ADR-0710-Internal-Httpapi-Is-Raced-Nightly-In-Shards-By-Test-Name.md): internal/httpapi is raced nightly in shards, by test name — 3.0.1; ten shards 3.1.1
- [ADR-0711](ADR-0711-The-Work-Detail-Is-Two-Columns-And-It-Opts-Out-Of-The-Window-S.md): The work detail is two columns, and it opts out of the window's scroll
- [ADR-0712](ADR-0712-BookDetail-Becomes-WorkDetail-The-Target-Stated-Before-It-Is.md): BookDetail becomes WorkDetail — the target, stated before it is built
- [ADR-0713](ADR-0713-One-Cover-Floor-And-It-Is-The-Server-S.md): One cover floor, and it is the server's
- [ADR-0714](ADR-0714-A-Locked-Screen-Is-One-Unbroken-Chain-Of-Heights-And-A-Missing.md): A locked screen is one unbroken chain of heights, and a missing link is silent — Unreleased
- [ADR-0715](ADR-0715-A-Deadline-That-Cannot-Reach-The-Connection-Fails-By-Doing.md): A deadline that cannot reach the connection fails by doing nothing — Unreleased
- [ADR-0716](ADR-0716-A-Name-Can-Be-Complete-Unclipped-And-In-Two-Pieces.md): A name can be complete, unclipped, and in two pieces — Unreleased
- [ADR-0717](ADR-0717-Full-State-Means-The-Body-Is-The-Record-Not-The-Form.md): Full-state means the body is the record, not the form — Unreleased
- [ADR-0718](ADR-0718-The-Board-Header-Is-One-Row-And-The-Settings-Went-Behind.md): The board header is one row, and the settings went behind ⋯ — Unreleased
- [ADR-0719](ADR-0719-Home-S-Dock-Seats-And-Two-Glyphs-That-Had-To-Be-Outlines.md): Home's dock seats, and two glyphs that had to be outlines — Unreleased
- [ADR-0720](ADR-0720-A-Worklist-S-Phone-Bar-And-The-Sheet-S-Quietest-Destructive.md): A worklist's phone bar, and the sheet's quietest destructive control — Unreleased
- [ADR-0721](ADR-0721-Two-Verbs-On-The-Settings-Dock-And-A-Toggle-That-Stopped-Moving.md): Two verbs on the Settings dock, and a toggle that stopped moving — Unreleased
- [ADR-0722](ADR-0722-The-Metadata-Page-On-A-Phone-And-A-Filter-The-Character-List.md): The metadata page on a phone, and a filter the character list never had — Unreleased
- [ADR-0723](ADR-0723-Three-Bugs-The-Owner-Found-And-What-Each-Turned-Out-To-Be.md): Three bugs the owner found, and what each turned out to be — Unreleased
- [ADR-0724](ADR-0724-Duplicate-A-Quote-And-A-Cluster-That-Was-Asked-For-The-Wrong.md): Duplicate a quote, and a cluster that was asked for the wrong name — Unreleased
- [ADR-0725](ADR-0725-The-Phone-Book-Detail-Measured-Against-Its-Own-Prototype.md): The phone book detail, measured against its own prototype — Unreleased
- [ADR-0726](ADR-0726-The-Merged-Character-S-Face-On-The-Second-Reader-Of-The-Same.md): The merged character's face, on the second reader of the same data — Unreleased
- [ADR-0727](ADR-0727-The-Note-Folds-And-The-Fourth-Copy-Of-One-Effect-Became-A-Hook.md): The note folds, and the fourth copy of one effect became a hook — Unreleased
- [ADR-0728](ADR-0728-The-Way-Back-Up.md): The way back up — Unreleased
- [ADR-0729](ADR-0729-The-Dock-S-Two-Seats-Stop-Being-Home-S-And-Export-Gives-One-Back.md): The dock's two seats stop being Home's, and Export gives one back — Unreleased
- [ADR-0730](ADR-0730-A-Character-S-Name-Stops-Opening-A-Picture-And-The-Page-It-Opens.md): A character's name stops opening a picture, and the page it opens knows which work — Unreleased
- [ADR-0731](ADR-0731-The-Twelfth-Line-In-Details-And-The-Fourth-State-A-Cast-Row-Has.md): The twelfth line in Details, and the fourth state a cast row has — Unreleased
- [ADR-0732](ADR-0732-The-Prototype-Sweep-And-What-It-Says-Is-Still-Missing.md): The prototype sweep, and what it says is still missing — Unreleased
- [ADR-0733](ADR-0733-The-Speaker-Reaches-The-Card-And-The-Half-Of-The-Backfill-That.md): The speaker reaches the card, and the half of the backfill that is missing — Unreleased
- [ADR-0734](ADR-0734-The-Bengali-Names-As-The-Owner-Ruled-Them.md): The Bengali names, as the owner ruled them
- [ADR-0735](ADR-0735-The-Speaker-Chip-Is-Two-Lines-And-A-Name-Is-Clipped.md): The speaker chip is two lines, and a name is clipped
- [ADR-0736](ADR-0736-The-Work-Detail-S-Header-Gets-Air-Under-The-Top-Bar.md): The work detail's header gets air under the top bar
- [ADR-0737](ADR-0737-The-Door-Behind-A-Field-S-Mark-And-The-Question-Re-Verify-Cannot.md): The door behind a field's mark, and the question re-verify cannot answer — Unreleased
- [ADR-0738](ADR-0738-The-List-You-Pick-A-Link-From-And-The-Roster-It-Is-Deliberately.md): The list you pick a link from, and the roster it is deliberately not — Unreleased
- [ADR-0739](ADR-0739-A-Work-S-Ids-And-Links-On-One-Screen.md): A work's ids and links on one screen — Unreleased
- [ADR-0740](ADR-0740-The-Character-Screens-The-Owner-S-Rulings-Before-A-Line-Of-Them.md): The character screens: the owner's rulings, before a line of them was drawn — Unreleased
- [ADR-0741](ADR-0741-Every-Name-On-A-Line-Gets-A-Chip-And-The-Discs-That-Stood-In-For.md): Every name on a line gets a chip, and the discs that stood in for them retire — Unreleased
- [ADR-0742](ADR-0742-The-Rating-Pass-Found-The-Chips-Half-Built-And-What-Each-Finding.md): The rating pass found the chips half-built, and what each finding turned out to be — Unreleased
- [ADR-0743](ADR-0743-Task-16-First-Half-The-Two-Global-Screens-And-The-Scope-Table.md): Task 16, first half: the two global screens, and the scope table under all five
- [ADR-0744](ADR-0744-The-Favourite-Tile-Grows-A-Work-And-Every-Pill-Becomes-A-Door.md): The favourite tile grows a work, and every pill becomes a door — Unreleased
- [ADR-0745](ADR-0745-The-Match-Picker-S-By-Id-And-Why-It-Shows-Rather-Than-Edits.md): The match picker's "By id", and why it shows rather than edits — Unreleased
- [ADR-0746](ADR-0746-The-Character-Sheet-S-Rows-Are-Displays-And-Its-Editors-Are-A.md): The character sheet's rows are displays and its editors are a form, which the pack does not do — Unreleased
- [ADR-0747](ADR-0747-A-Card-Names-Each-Person-Once-And-The-Crumb-Is-The-One-Name.md): A card names each person once, and the crumb is the one name allowed an ellipsis — Unreleased
- [ADR-0748](ADR-0748-Three-Lines-Of-The-Character-Sheet-Leave-The-Artboard-And-Each.md): Three lines of the character sheet leave the artboard, and each is a measurement — Unreleased
- [ADR-0749](ADR-0749-The-Phone-Sheet-Takes-What-It-Needs-Where-The-Pack-Takes-A-Share.md): The phone sheet takes what it needs, where the pack takes a share — Unreleased
- [ADR-0750](ADR-0750-The-Phone-Sheet-Grows-A-Handle-And-Predefined-Anchors-Where-The.md): The phone sheet grows a handle and predefined anchors, where the pack has neither — Unreleased
- [ADR-0751](ADR-0751-The-Portrait-Caption-Says-Three-Things-Where-The-Pack-Says-One.md): The portrait caption says three things where the pack says one, and the pack says two floors
- [ADR-0752](ADR-0752-The-Three-Facts-Wear-A-Pencil-Where-The-Artboard-Draws-None.md): The three facts wear a pencil, where the artboard draws none
- [ADR-0753](ADR-0753-In-This-Work-And-Note-Are-Two-Facts-And-The-Screen-Does-Not-Say.md): "In this work" and "Note" are two facts, and the screen does not say which
- [ADR-0754](ADR-0754-No-Prefetch-And-A-Door-That-Draws-Before-Its-Own-Count-Answers.md): No prefetch, and a door that draws before its own count answers — Unreleased
- [ADR-0755](ADR-0755-The-Flag-That-Qualifies-A-Date-Moves-Onto-The-Date-And-The.md): The flag that qualifies a date moves onto the date, and the marker stops being deleted — Unreleased
- [ADR-0756](ADR-0756-Every-Year-Box-Gets-The-Estimate-Flag-And-Stops-Deleting-The.md): Every year box gets the estimate flag, and stops deleting the phrase that carried it — Unreleased
- [ADR-0757](ADR-0757-The-Panel-Header-Was-Handing-The-Drag-To-The-Browser-And-The.md): The panel header was handing the drag to the browser, and the probe could not see it — Unreleased
- [ADR-0758](ADR-0758-The-Second-Count-Could-Only-Ever-Read-One-And-The-Hero-Picture.md): The second count could only ever read one, and the hero picture stopped opening — Unreleased
- [ADR-0759](ADR-0759-One-Class-Served-Two-Marks-And-A-Four-Screen-Instruction-Shipped.md): One class served two marks, and a four-screen instruction shipped as one screen — Unreleased
- [ADR-0760](ADR-0760-The-One-Endpoint-That-Can-Rename-Had-No-Caller-And-A-Moved-Block.md): The one endpoint that can rename had no caller, and a moved block left its scope — Unreleased
- [ADR-0761](ADR-0761-The-Flicker-Was-An-Animation-Nothing-Ever-Turned-Off-And-I-Put.md): The flicker was an animation nothing ever turned off, and I put it there — Unreleased
- [ADR-0762](ADR-0762-An-Empty-Picture-Strip-Stopped-Being-Silent-And-A-Pasted-Address.md): An empty picture strip stopped being silent, and a pasted address beats every guess — Unreleased
- [ADR-0763](ADR-0763-A-Date-In-History-The-Year-399-And-The-Era.md): A date in history: the year 399, and the era
- [ADR-0764](ADR-0764-The-Info-Dot-Goes-Inside-The-Box-Not-On-The-Label.md): The info dot goes inside the box, not on the label — Unreleased
- [ADR-0765](ADR-0765-The-Decade-Search-Reaches-The-Quotes-It-Was-Already-Counting.md): The decade search reaches the quotes it was already counting — Unreleased

<a id="area-18"></a>

## §18 Jobs and Logs

3.1.0 moved every routine a reader starts off their tab and onto the server, and began keeping the app's log in its own database: each job's lines, the system log, and a job for every request that looked outward, for thirty days, read in Settings › Jobs. The plan that asked for it was `docs/plans/jobs.md`, a task list with my answers of 27 September and the three asks I made as the release began; it is folded in here and deleted, and git has it as it stood at `aae3f761`. Entries elsewhere that it changed are corrected where they stand, each with its reversal: in §1 the line about timers and the one about the network, in §3 the `synchronous` entry, the pool and the shutdown sequence, in §11 the upload's deadline, and in §16 the redaction list.

### What each of the plan's tasks became

| The plan's task | What shipped |
|---|---|
| Run every routine a reader starts on the server, so it survives leaving the screen or closing the tab. | Fill gaps, Fetch covers, People's Fetch missing, re-verify's check and its apply, and Back up now are six kinds of queued job: `fill`, `covers`, `people`, `reverify`, `reverify-apply` and `backup`; and from my ask of 28 September an import and its approval are two more, `import` and `import.approve` (*An import and its approval are queued jobs*). The screen that pressed watches its job while it is up; leaving stops nothing, and Settings › Jobs has the job either way. |
| Reword the invariant "no goroutine outlives its request". | In `CLAUDE.md`, verbatim, and in §1. |
| Make a job of every time the app looks outward: bulk fetches and re-verify, imports and backups, automatic lookups, and single manual lookups. | The queued kinds are jobs by construction. Any other request that looks outward becomes a job the moment its first outward call is logged, its kind read from the route it matched (`jobkinds.go`). A restore, a reset and an update's apply name themselves as jobs, because each is worth a record even when it looks nowhere, and so does the daily deck; an import and its approval are queued jobs of their own (*An import and its approval are queued jobs*), the API's `POST /admin/backup` queues the backup job the Server card starts, and the safety copy is a queued job too (*Every backup queues, and the safety copy is handed over once*); single sign-on is kept under its own kind, `signin.oidc`, whenever it asks the provider. A call no job claims goes in the system log, tagged `[outbound]`. |
| Give every job its own detailed log: what was searched, where, and every outbound request, grouped by job. | What was searched is the job's subject — a title, an ISBN, a name, a file — kept as data. Its lines are one per outward call, `GET api.themoviedb.org/3/search/movie?query=Dune&api_key=… → 200 · 312 ms · 14 B` or `→ refused (offline)`, and for a queued kind one per item, saying what came of it. |
| Mark a job still running at boot as interrupted, keep its log, and offer a one-press rerun. | `Runner.Boot`, which `serve()` alone calls, marks every running or waiting row interrupted, with a line saying which it was. Run again is offered to the job's owner where the kind can be run again. |
| Add a Settings › Jobs tab. | The last section, for every reader: the sixth for an admin, the fifth for a reader, who has no Server. |
| Current jobs: one expandable card, each job showing its live log. | One card that folds to its head. The running job opens on its live log, which follows the newest line until the reader scrolls up; a waiting job is one line, "Waiting — 2 jobs ahead". |
| Past jobs: a second card with state (succeeded, failed, interrupted), details, and log export. | Chips over the four ways a job ends (stopped is the fourth). A row opens to who started it (for an admin), when, how long, its counts and its error, its log, Export, Run again, and Review findings for a re-verify whose findings are not yet applied. |
| System logs: a separate card holding the app's own logs (every level, including the request lines for inbound reads and writes), kept across restarts. | An admin's card: every line `olog` writes, the standard logger's, net/http's own, and a line per request. |
| Filter system logs by level, time range and keyword. | Level chips (error, warning, info, request, file, trace, all but the last two on), the app's own `Select` for the last hour, 24 hours, 7 days or 30 days, and the keyword typed into the shell's search bar while the section is open, mirrored by a field in the card on a desk. |
| Export as Markdown both ways: exactly what the filters show, or everything retained. | Both. "What is shown" is every line the filters select, not the page on screen. A job's log exports the same way. |
| Keep 30 days of jobs and logs, pruned when a job or log line is written and when the tab opens, with no timer. | Thirty days, and at most a million system lines. The prune rides the log writer (below), and the tab's first read asks for one. Every read stops at thirty days whether or not the prune has run. |
| Store jobs, job logs and system logs in the app's SQLite database; stdout and stderr keep working for `docker logs`. | Three tables in migration 0079. The terminal's lines are what they were, the access line's full URI included. |
| Users see their own jobs; an admin sees every user's jobs and the system logs. | Every read is scoped, and another reader's job answers 404 wherever it is asked for. An admin sees each job under the name it was started with. |

My answers of 27 September:

| The answer | What shipped |
|---|---|
| The invariant's new wording, verbatim: *"nothing runs unless a person or the app's own lookup started it, and nothing wakes on a timer."* | As above. |
| One job runs at a time across the server; the rest queue in the order started, and a waiting job says it is waiting. | One worker, claiming the oldest waiting job by id. Every job carries `ahead`, how many jobs are before it across every reader — a number, not rows, so nobody sees whose — and every screen that shows a waiting job says it. |
| Single manual lookups run in their request, as fast as today and never queued behind a bulk run, and each is still recorded as a job with its log. | A request's job is held in memory and written after the answer has gone (*A lookup in a request is a job written from memory*). |
| A Stop button on a running job: it stops after the item in hand, the job is kept as stopped with its log, and it can be rerun. | Stop on each job, and Stop all. A waiting job is stopped before it starts. "After the item in hand" shipped first and was replaced before the release by my asks of 28 September: a running job is stopped at once, and the item it had in hand is left exactly as it was (*Stop is at once, and it breaks nothing*). A Stop that lands once a job's last item is written finds nothing left to stop, and the job reads succeeded, not stopped, because it did everything it was given. Run again is offered after a success only where the kind offers it after any success, which is every kind but the review's apply. |
| Ship as 3.1.0. | This release. |

My asks as 3.1.0 began, the same day:

| The ask | What shipped |
|---|---|
| Two hooks feed the logs: one in the outbound gate, one in the request logger. | `outbound.SetObserver`, which the gate calls after every round trip and every refusal, and the request logger's kept line and in-request job (*Two hooks write the job lines*). |
| System logs on their own database connection at `synchronous=NORMAL`, so logging every request costs no disk sync. | `Store.LogDB`, one connection, written only by the log writer (§3). |
| Jobs is a tab on a desk and a tile on the phone's Settings index; the tile holds one red Stop all, with a confirmation, and a count of queued jobs. | The tile is the Current jobs card drawn compact: how many are running and how many are waiting (F11), each with its glyph and its word, and a red Stop all behind a confirmation that says what happens to the running job and to the waiting ones. |

My asks of 28 September, as the build was being merged, and my answers to the two questions they raised:

| The ask | What shipped |
|---|---|
| *"This screen needs to be authoritative. If any eligible action is run, a job will be created and queued (some small things skip queues, like one off lookups). This must be totally bug free. No action should skip through."* | An audit of every route that looks outward or writes the library found what ran beside the queue: an import, its approval (which left no job at all), and the two backups that ran in their request, the API's `POST /admin/backup` and the safety copy a restore or reset asks for. An import and its approval became queued jobs (*An import and its approval are queued jobs*), and so did both backups (*Every backup queues, and the safety copy is handed over once*). A one-off lookup still runs in its request and is still a job (*A lookup in a request is a job written from memory*). |
| Asked which routines queue: *"Queue imports and backups only"*. | F1, ruled: imports and every backup queue; a restore, a factory reset and an update stay immediate, because each already refuses while a job runs (*A restore, a reset, a search rebuild or an update waits for the running job*). The onboarding restore stays immediate as well, and the queue does not hold it, since it runs only while the server has no account. |
| *"the job cancel button must also be the most responsive kill switch. No dillydallying after it has been pressed."* | A running job's own context is cancelled at the press, so a call on the wire aborts there and then (*Stop is at once, and it breaks nothing*), and a waiting job's Stop is answered from memory, after trying for the write lock for 50 ms at most rather than waiting it out (*A waiting job's Stop is kept in memory first, and its row is written after*). |
| *"Stop cancels instantly: but it still shall not break anything. That's important."* | An item a Stop reaches before its write is abandoned whole, and every kind that writes the library writes an item in one transaction after its last lookup; a stopped backup removes its partial archive (*Stop is at once, and it breaks nothing*). |
| *"add a list of common jobs, that can be restarted from there itself, and as such will have a persistent place."* Asked which, all four offered: Back up now, Fetch covers and details, Fill gaps in every work, Fetch missing people. | A Common jobs card in Settings › Jobs, after Current jobs (*Four common jobs keep a place of their own*). |

### One job at a time across the server, and the table is the queue

**Decided.** The queue is the `jobs` table. A press checks and inserts a waiting row in one transaction; one worker claims the oldest waiting row with a single `UPDATE … RETURNING`, runs it, and records its end before it claims the next. A reader may have five jobs waiting or running at once; the same kind with the same params pressed twice is one job, and the second press is told which; a reader pressing an admin's kind is refused. Before the finishing write the worker waits, up to 2 s, for the job's own lines to be written, so a job never reads finished with its last lines missing. Stop is a compare-and-set on a waiting row, and on the running one the cancel of that job's own context (*Stop is at once, and it breaks nothing*). One line per finished job goes to the terminal: `[jobs] #12 Fill gaps in 40 works for aro succeeded in 2m3s (40/40)`.

**Why.** My rule, and the box's: one at a time is what keeps a fill of two thousand works from being two thousand works times however many readers pressed at once. A table survives what a channel does not — a crash, a restart — as rows `Boot` can mark interrupted and a reader can run again.

**Instead of.** A goroutine per job with a channel for the queue: its order and its contents are gone on a restart. A pool of workers, which my rule forbids.

<sub>3.1.0 — `internal/jobs/runner.go` · `internal/jobs/job.go` · `internal/httpapi/jobs_kinds.go` · `internal/store/migrations/0079_jobs.sql`</sub>

- [ADR-0766](ADR-0766-Stop-Is-At-Once-And-It-Breaks-Nothing.md): Stop is at once, and it breaks nothing — 3.1.0
- [ADR-0767](ADR-0767-A-Waiting-Job-S-Stop-Is-Kept-In-Memory-First-And-Its-Row-Is.md): A waiting job's Stop is kept in memory first, and its row is written after — 3.1.0, corrected after its release
- [ADR-0768](ADR-0768-The-Worker-And-The-Log-Writer-Exist-Only-While-There-Is-Work.md): The worker and the log writer exist only while there is work — 3.1.0
- [ADR-0769](ADR-0769-Two-Hooks-Write-The-Job-Lines-And-Olog-S-Sink-Carries-The-App-S.md): Two hooks write the job lines, and olog's sink carries the app's own — 3.1.0
- [ADR-0770](ADR-0770-What-A-Kept-Request-Line-Holds-And-What-It-Leaves-Out.md): What a kept request line holds, and what it leaves out — 3.1.0
- [ADR-0771](ADR-0771-A-Lookup-In-A-Request-Is-A-Job-Written-From-Memory-After-The.md): A lookup in a request is a job written from memory, after the answer — 3.1.0
- [ADR-0772](ADR-0772-Every-Line-Passes-One-Door-And-The-Log-Writer-Is-Bounded.md): Every line passes one door, and the log writer is bounded — 3.1.0
- [ADR-0773](ADR-0773-A-Generation-Guards-Every-Owner-Across-A-File-Swap.md): A generation guards every owner across a file swap — 3.1.0
- [ADR-0774](ADR-0774-Archives-Leave-The-History-Behind-And-A-Restore-Keeps-The-Server.md): Archives leave the history behind, and a restore keeps the server's own — 3.1.0
- [ADR-0775](ADR-0775-A-Job-A-Restore-Carried-Over-Is-Its-History-And-Nothing-Acts-On.md): A job a restore carried over is its history, and nothing acts on it again — 3.1.0, corrected after its release
- [ADR-0776](ADR-0776-A-Restore-A-Reset-A-Search-Rebuild-Or-An-Update-Waits-For-The.md): A restore, a reset, a search rebuild or an update waits for the running job — 3.1.0
- [ADR-0777](ADR-0777-Deleting-A-Reader-Stops-Their-Jobs-And-Waits-For-The-Running-One.md): Deleting a reader stops their jobs and waits for the running one to let go — 3.1.0
- [ADR-0778](ADR-0778-The-Server-Stores-Data-Not-Prose.md): The server stores data, not prose — 3.1.0
- [ADR-0779](ADR-0779-A-Kind-S-Counts-Are-Made-Once-When-Its-Result-Is-Stored.md): A kind's counts are made once, when its result is stored — 3.1.0
- [ADR-0780](ADR-0780-An-Export-Is-What-The-Filters-Select-In-A-Fence-Nothing-Inside.md): An export is what the filters select, in a fence nothing inside can close, read in batches — 3.1.0
- [ADR-0781](ADR-0781-The-Screen-Polls-While-It-Is-Open-And-The-Server-Never-Does.md): The screen polls while it is open, and the server never does — 3.1.0
- [ADR-0782](ADR-0782-Two-Test-Seams-Are-In-The-Binary-And-Neither-Works-Online.md): Two test seams are in the binary, and neither works online — 3.1.0
- [ADR-0783](ADR-0783-An-Import-And-Its-Approval-Are-Queued-Jobs.md): An import and its approval are queued jobs — 3.1.0
- [ADR-0784](ADR-0784-Four-Common-Jobs-Keep-A-Place-Of-Their-Own.md): Four common jobs keep a place of their own — 3.1.0
- [ADR-0785](ADR-0785-Every-Backup-Queues-And-The-Safety-Copy-Is-Handed-Over-Once.md): Every backup queues, and the safety copy is handed over once — 3.1.0
- [ADR-0786](ADR-0786-Where-The-Plan-Turned-Out-To-Be-Wrong.md): Where the plan turned out to be wrong

<a id="later-decisions"></a>

## Later decisions, in the order they were made

- [ADR-0787](ADR-0787-The-Library-Sorts-By-Year-And-The-Absence-Leaves-The-Number-Line.md): The Library sorts by year, and the absence leaves the number line
- [ADR-0788](ADR-0788-A-Board-Is-A-Detail-And-Two-Functions-Read-That-As-A-Work.md): A board is a detail, and two functions read that as a work
- [ADR-0789](ADR-0789-A-Quote-S-Third-Text-And-Which-Reader-Gets-Asked-For-It.md): A quote's third text, and which reader gets asked for it
- [ADR-0790](ADR-0790-The-Multilingual-Plan-Is-Finished-And-Two-Warts-Outlive-It.md): The multilingual plan is finished, and two warts outlive it
- [ADR-0791](ADR-0791-Four-Fields-The-Add-Surface-Asked-For-And-One-Argument-Reversed.md): Four fields the add surface asked for, and one argument reversed
- [ADR-0792](ADR-0792-The-Transliteration-Column-Is-Withdrawn.md): The transliteration column is withdrawn
- [ADR-0793](ADR-0793-The-Chapter-Pair-Fills-Both-Ways-And-The-Old-Argument-Was.md): The chapter pair fills both ways, and the old argument was answering a different question
- [ADR-0794](ADR-0794-Every-Name-Box-Asks-For-Capitals-And-No-Prose-Box-Does.md): Every name box asks for capitals, and no prose box does
- [ADR-0795](ADR-0795-The-Add-Surface-Rebuilt-One-Panel-Two-States.md): The add surface, rebuilt: one panel, two states
- [ADR-0796](ADR-0796-The-Phone-Fit-Target-Met-On-Four-Doors-Of-Eleven.md): The phone-fit target, met on four doors of eleven
- [ADR-0797](ADR-0797-A-Card-Says-Where-In-The-Book-Once-And-The-Plan-For-It-Was-One.md): A card says where in the book once, and the plan for it was one size too big
- [ADR-0798](ADR-0798-The-Add-Surface-S-Header-Is-One-Line-And-That-Is-The-Third.md): The add surface's header is one line, and that is the third exception to a standing rule
- [ADR-0799](ADR-0799-The-Import-Wall-Became-One-Drop-Target-And-The-Guard-That-Was.md): The import wall became one drop target, and the guard that was supposed to catch it took three weeks
- [ADR-0800](ADR-0800-The-Six-Item-Queue-And-Why-Two-Of-Its-Items-Had-Shipped-Nothing.md): The six-item queue, and why two of its items had shipped nothing by 11 September
- [ADR-0801](ADR-0801-An-Anthology-S-Switches-Become-A-Registry-And-The-Work-Behind-A.md): An anthology's switches become a registry, and the work behind a passage reaches the page
- [ADR-0802](ADR-0802-An-Anthology-Fills-Itself-By-Asking-And-The-Plan-S-Own-Two.md): An anthology fills itself by asking, and the plan's own two sentences could not both ship
- [ADR-0803](ADR-0803-The-Anthology-Update-Shipped-And-Both-Its-Plan-Files-Leave-By.md): The anthology update shipped, and both its plan files leave by the front door
- [ADR-0804](ADR-0804-An-Anthology-Is-Pointed-At-Something-Not-Composed-Out-Of-A-Query.md): An anthology is pointed at something, not composed out of a query
- [ADR-0805](ADR-0805-The-Tour-Goes-To-The-Screen-The-Reader-Is-On-And-Settings-Stops.md): The tour goes to the screen the reader is on, and Settings stops holding it
- [ADR-0806](ADR-0806-An-Anthology-Has-Four-Doors-Instead-Of-One-And-A-Work-S-Door.md): An anthology has four doors instead of one, and a work's door means its passages
- [ADR-0807](ADR-0807-Ten-Hand-Picked-Languages-Became-Eighty-Six-Derived-Ones-And.md): Ten hand-picked languages became eighty-six derived ones, and four rules changed shape underneath
- [ADR-0808](ADR-0808-Not-Colliding-Is-Not-The-Same-As-Identifying-And-Six-Pairs-Were.md): Not colliding is not the same as identifying, and six pairs were colliding anyway
- [ADR-0809](ADR-0809-The-Upgrade-That-Folds-Languages-Onto-Codes-Is-Not-Being-Built.md): The upgrade that folds languages onto codes is not being built
- [ADR-0810](ADR-0810-One-Table-Where-The-Schema-Has-Three-And-The-Promises-That.md): One table where the schema has three, and the promises that rested on it
- [ADR-0811](ADR-0811-A-Face-Nobody-Could-Reach-And-The-Seam-That-Had-No-Caller.md): A face nobody could reach, and the seam that had no caller
- [ADR-0812](ADR-0812-The-8-10-Pass-And-The-Four-Things-It-Found.md): The 8/10 pass, and the four things it found
- [ADR-0813](ADR-0813-A-Quote-S-Face-Is-Keyed-On-Its-Language-Not-On-Its-Script.md): A quote's face is keyed on its language, not on its script
- [ADR-0814](ADR-0814-The-Face-That-Was-Asked-For-Everywhere-And-Won-Nowhere.md): The face that was asked for everywhere and won nowhere
- [ADR-0815](ADR-0815-Two-Work-Screens-That-Were-One-Screen-And-A-Bar-That-Was-Two.md): Two work screens that were one screen, and a bar that was two
- [ADR-0816](ADR-0816-Two-Numbers-That-Were-Each-Right-And-A-Ceiling-Neither-Declared.md): Two numbers that were each right, and a ceiling neither declared
- [ADR-0817](ADR-0817-The-Quote-Card-S-Last-Two-And-The-Ruling-On-Each.md): The quote card's last two, and the ruling on each
- [ADR-0818](ADR-0818-The-6-10-Pass-And-The-Finding-That-Was-The-Original-Bug.md): The 6/10 pass, and the finding that was the original bug
- [ADR-0819](ADR-0819-Quote-Card-Types-Md-Retires-And-The-Five-Places-It-Turned-Out-To.md): quote-card-types.md retires, and the five places it turned out to be wrong
- [ADR-0820](ADR-0820-Bulk-Editors-One-Field-Table-Md-Retires-And-The-Seven-Places-It.md): bulk-editors-one-field-table.md retires, and the seven places it turned out to be wrong
- [ADR-0821](ADR-0821-A-Quotation-Is-Italic-And-The-Leading-Is-A-Token.md): A quotation is italic, and the leading is a token
- [ADR-0822](ADR-0822-The-Quote-S-Two-Reading-Dials-And-The-One-That-Is-Worth-The.md): The quote's two reading dials, and the one that is worth the feature
- [ADR-0823](ADR-0823-A-Face-For-Dyslexia-And-Why-It-Is-Offered-On-Two-Roles-Rather.md): A face for dyslexia, and why it is offered on two roles rather than one
- [ADR-0824](ADR-0824-Access-Md-Retires-And-The-Five-Places-It-Was-Wrong.md): access.md retires, and the five places it was wrong
- [ADR-0825](ADR-0825-Category-And-Board-Name-Two-Different-Things-And-The-Owner-Said.md): Category and board name two different things, and the owner said which
- [ADR-0826](ADR-0826-Season-And-Episode-Join-The-Live-Bulk-Editor-And-A-Claim-About.md): Season and episode join the live bulk editor, and a claim about SQLite that was wrong
- [ADR-0827](ADR-0827-Entry-Helpers-What-The-Plan-Got-Wrong-And-The-One-Item-It-Could.md): Entry helpers: what the plan got wrong, and the one item it could not have worked
- [ADR-0828](ADR-0828-Three-Loose-Ends-And-Two-Of-Them-Were-About-What-A-Test-Cannot.md): Three loose ends, and two of them were about what a test cannot see
- [ADR-0829](ADR-0829-A-Suite-That-Read-The-App-And-The-Tier-That-Uses-It-Instead.md): A suite that read the app, and the tier that uses it instead
- [ADR-0830](ADR-0830-One-Question-Two-Postures-And-The-Bar-That-Was-Hiding-Behind-The.md): One question, two postures, and the bar that was hiding behind the header
- [ADR-0831](ADR-0831-The-Omnibar-Reaches-Two-Screens-And-The-Other-Sixteen-Are-Not.md): The omnibar reaches two screens, and the other sixteen are not pretending
- [ADR-0832](ADR-0832-A-Dialog-Is-Not-A-Screen-And-Profile-Is-A-Dialog.md): A dialog is not a screen, and Profile is a dialog
- [ADR-0833](ADR-0833-Two-Copies-Of-One-Filter-And-The-Test-That-Guarded-The-Wrong-One.md): Two copies of one filter, and the test that guarded the wrong one
- [ADR-0834](ADR-0834-The-Search-Bar-S-Helper-Text-And-A-Word-That-Was-Thrown-Away.md): The search bar's helper text, and a word that was thrown away
- [ADR-0835](ADR-0835-Holding-Back-And-The-Number-That-Had-To-Be-Counted-In-Entries.md): Holding Back, and the number that had to be counted in entries
- [ADR-0836](ADR-0836-One-Row-For-Every-List-And-The-Line-It-Moved-Off-The-Name.md): One row for every list, and the line it moved off the name
- [ADR-0837](ADR-0837-Settings-Becomes-Six-Screens-For-An-Admin-And-Five-For-A-Reader.md): Settings becomes six screens for an admin and five for a reader, and the rail it is navigated by is Metadata's
- [ADR-0838](ADR-0838-The-Sections-Take-An-Order-And-The-Language-Table-Takes-An.md): The sections take an order, and the language table takes an address
- [ADR-0839](ADR-0839-Four-Grounds-Per-Mode-And-The-Formula-That-Had-To-Be-Thrown-Away.md): Four grounds per mode, and the formula that had to be thrown away
- [ADR-0840](ADR-0840-Four-Dials-Per-Material-And-The-Tier-Rule-They-Are-The-Exception.md): Four dials per material, and the tier rule they are the exception to
- [ADR-0841](ADR-0841-True-Glass-Off-By-Default-And-The-Measurement-That-Was-Weaker.md): True glass, off by default, and the measurement that was weaker than promised
- [ADR-0842](ADR-0842-Colour-Categories-Leave-Settings-And-The-Layout-Table-Leaves.md): Colour categories leave Settings, and the layout table leaves with them
- [ADR-0843](ADR-0843-A-Saved-Look-Is-Six-Fields-And-The-Mode-Is-Not-One-Of-Them.md): A saved look is six fields, and the mode is not one of them
- [ADR-0844](ADR-0844-The-Last-Two-Consoles-Join-The-Row-And-The-Defect-The-Log-Named.md): The last two consoles join the row, and the defect the log named is closed
- [ADR-0845](ADR-0845-The-Preference-Row-And-The-Control-It-Refuses-To-Draw.md): The preference row, and the control it refuses to draw
- [ADR-0846](ADR-0846-A-Swatch-Is-Drawn-From-The-Palette-It-Produces-Not-From-The.md): A swatch is drawn from the palette it produces, not from the ground's own tokens
- [ADR-0847](ADR-0847-A-Phone-Gets-An-Index-Of-The-Sections-Not-A-Field-That-Names-One.md): A phone gets an index of the sections, not a field that names one
- [ADR-0848](ADR-0848-Changed-Means-Set-Not-Different.md): Changed means set, not different
- [ADR-0849](ADR-0849-A-Number-You-Can-Read-Is-A-Number-You-Can-Press.md): A number you can read is a number you can press
- [ADR-0850](ADR-0850-Where-A-Line-Enters-Is-Not-How-Hard-It-Is-Asked.md): Where a line enters is not how hard it is asked
- [ADR-0851](ADR-0851-The-Defaults-Are-One-File-Because-They-Could-Not-Be-One-Place.md): The defaults are one file, because they could not be one place
- [ADR-0852](ADR-0852-A-Specimen-Is-The-Part-That-Cannot-Be-A-Name.md): A specimen is the part that cannot be a name
- [ADR-0853](ADR-0853-A-List-Of-What-You-Excluded-Because-Exclusion-Leaves-No-Other.md): A list of what you excluded, because exclusion leaves no other trace
- [ADR-0854](ADR-0854-The-Tab-Row-Is-The-Pack-S-Geometry-For-Geometry.md): The tab row is the pack's, geometry for geometry
- [ADR-0855](ADR-0855-One-Colours-Row-And-An-Accessibility-Heading-In-Each-Section.md): One Colours row, and an Accessibility heading in each section
- [ADR-0856](ADR-0856-One-Row-Per-Section-Holding-Every-Decision-About-It.md): One row per section, holding every decision about it
- [ADR-0857](ADR-0857-A-Size-You-Can-See-A-Name-Said-Once-And-A-Row-With-No-Band-Under.md): A size you can see, a name said once, and a row with no band under it
- [ADR-0858](ADR-0858-A-Character-Row-That-Counts-Faces.md): A character row that counts faces
- [ADR-0859](ADR-0859-The-Works-Console-Sees-The-Library-Through-What-Is-Missing.md): The works console sees the library through what is missing
- [ADR-0860](ADR-0860-The-Section-Is-The-Heading.md): The section is the heading
- [ADR-0861](ADR-0861-Photographing-Every-Surface-And-The-Picture-That-Lied.md): Photographing every surface, and the picture that lied
- [ADR-0862](ADR-0862-One-Row-Of-Chrome-Then-The-Screen.md): One row of chrome, then the screen
- [ADR-0863](ADR-0863-A-Door-That-Outlived-Its-Reason.md): A door that outlived its reason
- [ADR-0864](ADR-0864-Language-And-Font-The-Type-Panel-Is-Gone-And-The-Faces-Are-Per.md): Language and font: the type panel is gone, and the faces are per language
- [ADR-0865](ADR-0865-Theme-Three-Doors-A-Grid-That-Fits-And-Prose-That-Stopped-Being.md): Theme: three doors, a grid that fits, and prose that stopped being code
- [ADR-0866](ADR-0866-Review-The-Schedule-Comes-Out-From-Behind-The-Door-And-The.md): Review: the schedule comes out from behind the door, and the section gets rows
- [ADR-0867](ADR-0867-Review-Third-Pass-The-Reset-That-Reset-Nothing-And-A-Rationale.md): Review, third pass: the reset that reset nothing, and a rationale that did not hold
- [ADR-0868](ADR-0868-Review-Fourth-Pass-A-Control-The-App-Stored-And-Then-Ignored.md): Review, fourth pass: a control the app stored and then ignored
- [ADR-0869](ADR-0869-Sections-The-Last-Half-Screen-In-Settings-And-A-Specimen-That.md): Sections: the last half-screen in Settings, and a specimen that never measured anything
- [ADR-0870](ADR-0870-Sections-Second-Pass-The-Pack-S-Own-Layout-Inverted.md): Sections, second pass: the pack's own layout, inverted
- [ADR-0871](ADR-0871-Sections-Third-Pass-A-Stored-Size-That-Disagreed-With-Its-Own.md): Sections, third pass: a stored size that disagreed with its own handle
- [ADR-0872](ADR-0872-Server-One-Panel-Of-Three-Groups-And-The-Release-Log-Comes-Out.md): Server: one panel of three groups, and the release log comes out from behind its door
- [ADR-0873](ADR-0873-Server-Second-Pass-A-Guard-Removed-While-Claiming-To-Preserve-It.md): Server, second pass: a guard removed while claiming to preserve it
- [ADR-0874](ADR-0874-Settings-The-Owner-S-Own-Pass-Cards-Per-Subsection-And-Four.md): Settings, the owner's own pass: cards per subsection, and four fixes to Theme and Sections
- [ADR-0875](ADR-0875-The-Rest-Of-The-Eighteen-Review-Language-And-Server.md): The rest of the eighteen: Review, Language and Server
- [ADR-0876](ADR-0876-A-Row-Per-Supplier-And-A-Way-To-Ask-One-Now.md): A row per supplier, and a way to ask one now
- [ADR-0877](ADR-0877-The-Consoles-Read-On-A-Phone-Pills-That-Count-And-A-Badge-That.md): The consoles read on a phone: pills that count, and a badge that means something
- [ADR-0878](ADR-0878-One-Variable-Two-Jobs-And-A-Top-Bar-Set-In-The-Quote-Font.md): One variable, two jobs, and a top bar set in the quote font
- [ADR-0879](ADR-0879-The-Last-Doors-The-Schedule-S-Numbers-Come-Out-The-Material.md): The last doors: the schedule's numbers come out, the material dials stay in
- [ADR-0880](ADR-0880-The-Info-Dots-The-Premise-Was-Half-Right-And-The-Measurement.md): The info dots: the premise was half right, and the measurement said which half
- [ADR-0881](ADR-0881-A-Tag-Vocabulary-That-Can-Be-Tidied-The-Duplicates-And-The-Verb.md): A tag vocabulary that can be tidied: the duplicates, and the verb that was missing
- [ADR-0882](ADR-0882-Two-Small-Ones-And-The-Guard-That-Was-Wrong-In-The-Expensive.md): Two small ones, and the guard that was wrong in the expensive direction
- [ADR-0883](ADR-0883-Spelling-In-The-Quote-Field-The-Browser-S-Own-And-Only-While-You.md): Spelling in the quote field: the browser's own, and only while you are typing
- [ADR-0884](ADR-0884-The-Capture-Probe-Found-Four-Things-The-Pictures-Could-Not.md): The capture probe found four things the pictures could not
- [ADR-0885](ADR-0885-A-Count-Wears-The-Glyph-Of-What-It-Counts.md): A count wears the glyph of what it counts
- [ADR-0886](ADR-0886-What-The-Never-Asked-About-List-Was-Not-Saying.md): What the Never-asked-about list was not saying
- [ADR-0887](ADR-0887-A-Bullet-That-Was-A-Control-Character-And-The-Digit-2.md): A bullet that was a control character and the digit 2
- [ADR-0888](ADR-0888-A-Slider-Is-The-One-Control-Whose-Precision-Is-Its-Width.md): A slider is the one control whose precision is its width
- [ADR-0889](ADR-0889-A-Glyph-S-Baseline-Is-Its-Bottom-Edge.md): A glyph's baseline is its bottom edge
- [ADR-0890](ADR-0890-The-Ink-Not-The-Box-Why-A-First-Pass-Measured-Nothing.md): The ink, not the box — why a first pass measured nothing
- [ADR-0891](ADR-0891-Two-Lines-Then-An-Ellipsis-On-A-List-Row.md): Two lines, then an ellipsis, on a list row
- [ADR-0892](ADR-0892-Practice-Answers-To-One-Setting-And-Seeing-Is-Not-It.md): Practice answers to one setting, and "seeing" is not it — v3.0.0
- [ADR-0893](ADR-0893-Profile-Is-A-Screen-With-An-Address-Not-A-Panel-Over-The-One-You.md): Profile is a screen with an address, not a panel over the one you were on — v3.0.0
- [ADR-0894](ADR-0894-A-Character-Is-Their-Performers-And-The-Row-Says-So.md): A character is their performers, and the row says so — v3.0.0
- [ADR-0895](ADR-0895-One-Person-Screen-And-The-Verb-The-Second-One-Was-Carrying.md): One person screen, and the verb the second one was carrying — v3.0.0
- [ADR-0896](ADR-0896-Metadata-Without-An-Overview-A-Page-That-Scrolls-And-A-Language.md): Metadata without an Overview, a page that scrolls, and a language table keyed to ISO 639-3
- [ADR-0897](ADR-0897-Categories-Quote-Faces-In-The-Language-Table-Two-Line-Records.md): Categories, quote faces in the language table, two-line records, masonry, and a phone index that says something
- [ADR-0898](ADR-0898-One-Card-Head-On-Metadata-And-Settings.md): One card head on Metadata and Settings
- [ADR-0899](ADR-0899-People-S-Role-Is-A-Dropdown-And-A-Desktop-Record-S-Chips-Print.md): People's role is a dropdown, and a desktop record's chips print in full
- [ADR-0900](ADR-0900-Media-Type-On-Every-Console-Row-And-A-Type-Dropdown-On-Each.md): Media type on every console row, and a type dropdown on each
- [ADR-0901](ADR-0901-Single-Sign-On-A-Dashboard-Widget-And-Pushover.md): Single sign-on, a dashboard widget, and Pushover
- [ADR-0902](ADR-0902-A-Person-S-Signature.md): A person's signature
- [ADR-0903](ADR-0903-Every-Picture-Is-Framed-Before-It-Is-Kept.md): Every picture is framed before it is kept
- [ADR-0904](ADR-0904-Decisions-Are-Records-One-Page-Each.md): Decisions are records, one page each, built from the log they came from
- [ADR-0905](ADR-0905-A-Work-Keeps-The-File-Its-Quotes-Came-From.md): A work keeps the file its quotes came from
- [ADR-0906](ADR-0906-Context-Is-Read-Once-And-Stored.md): Context is read once and stored, so it outlives the file
- [ADR-0907](ADR-0907-Library-Folders-Are-Mounted-Read-Only-And-Only-Propose.md): Library folders are mounted read-only, and a scan only proposes
- [ADR-0908](ADR-0908-The-Bin-Covers-Everything-A-Delete-Takes.md): The bin covers everything a delete takes
- [ADR-0909](ADR-0909-A-Books-Own-Metadata-Is-A-Source-You-Can-Pick.md): A book's own metadata is a source you can pick, and it fills gaps
- [ADR-0910](ADR-0910-Prune-Keeps-The-Context-And-Drops-The-Bytes.md): Prune keeps the context and drops the bytes
- [ADR-0911](ADR-0911-No-Shadow-On-Text.md): No shadow on text, and the same on its icon
- [ADR-0912](ADR-0912-Documentation-Lives-In-The-Wiki.md): Documentation lives in the wiki, and nothing else is HTML
- [ADR-0913](ADR-0913-A-Test-Names-Behaviour-Or-Is-Lint.md): A test names behaviour, or it is lint, or it is deleted

See also: [Design decisions](Design-decisions.md) · [Home](Home.md)
