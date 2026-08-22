# The Tippani decision log

Every design decision I have made in this project, with the reasoning that produced it,
the alternative I turned down, and — where it applies — the part I got wrong and what
changed my mind. Four hundred and seventy-two entries, grouped by what they are about
rather than by when they happened.

**Everything in this document was approved by me.** That statement covers every entry
below without exception, and it is why the **Approved** line exists on an entry at all. I
am one person building this, so there is no committee to hide a decision behind and no
reviewer to blame it on; a thing is in this repository because I looked at it and said
yes. Where an entry carries its own **Approved** line it is because there is something
more to say — that I signed it off on a summary rather than on the code, that I approved
correcting my own earlier claim, that I would defend this one hardest. Where an entry has
none, the blanket approval above is the whole of it and nothing is being left unsaid.

And where I said yes on thin reasoning, or by default, or because nothing ever pushed
back, the entry says that too. "Approved by silence" is a real approval and a weaker one,
and grading it honestly is the difference between this document and a press release.

## What this replaces

Until now this file was the original **design document** — the plan I wrote before
building, kept roughly up to date afterwards. It had stopped being either thing. Parts of
it described a system that was never built (precompressed assets, a single writer
connection), parts described one that had been rebuilt underneath it (the whole review
loop substrate, the four-colour palette, `synchronous=NORMAL`), and it cited its own §7,
which does not exist. A design document that is 80% true is worse than none, because
there is no way to tell from inside it which 80%.

So it is a log now. **A log is allowed to be wrong in public**, which is exactly the
property the old document lacked: an entry that records a decision, and then records that
the decision was wrong and what replaced it, stays true forever. The original is not
deleted — it is in the git history at `docs/PLAN.md` before this commit, and several
entries below quote it against itself.

## How to read an entry

Each is a heading and up to five lines:

- **Decided** — what is actually true of the code today.
- **Why** — the reasoning at the time, not a reconstruction.
- **Instead of** — what I turned down, and on what grounds. An entry with no alternative
  is one where I did not consider one, which is itself worth knowing.
- **Reversal** — present only where I changed my mind. These are the most useful entries
  in the document and they are deliberately not tidied away. An overturned decision is
  logged as the **updated** decision with its reason — heading, **Decided** and **Why**
  all describe what is true now — and the decision it replaces is quoted underneath,
  inside the **Reversal**. The old one is referenced, never left standing where a reader
  skimming the first paragraph would take it for current.
- **Approved** — mine, and how firmly.

The small grey line underneath is the release it landed in and the files it lives in.
**There are no line numbers**: a line number in a document is wrong within a release, and
a path is not.

Two conventions for cross-references, because both were a source of quiet error:

- **A bare `§N` refers to the original design document**, the one this log replaces —
  `PLAN §8` was its pragma section, `§5f` its import staging, `§3b` its film model. Those
  numbers mean nothing in this file; they are historical citations and the document they
  cite is in git.
- **Roadmap sections are always named and linked**, never cited by number. A roadmap
  §number is a *position* and moves whenever I reorder the page, so anything written down
  against one goes stale without anybody touching it.

About a hundred comments in the Go and JSX source still cite the original document's
numbering — `// PLAN §8`, `// §5f`. They mean what they always meant, and they are not
pointing at the section that now carries that number here. Chasing them all would be a
hundred edits for a convention I have just retired, so they get corrected as their files
are touched rather than in one sweep.

## What this document is not

It does not say how to build or test the app — that is
[`DEVELOPMENT.md`](../DEVELOPMENT.md). It does not say what is coming — that is
[the roadmap](roadmap.html). It does not say what a piece of the interface is called —
that is [the UI glossary](ui-glossary.html). It records **why**, and only why.

One thing it deliberately does contain: decisions about things **not built yet**, where
the constraint was agreed before the code — and, just as often, where the decision was
*not to build it*. Those are marked *planned* or *deferred* on the grey line, and they
cite [the roadmap](roadmap.html). A constraint agreed in advance and then forgotten is how
a feature quietly arrives in the wrong shape; a deferral left unwritten is
indistinguishable from an omission, and only one of the two is honest.

**A feature's design is not one of those.** That lives in
[`plans/`](plans/) while the feature is unbuilt, and is folded in here — with a pass on
what the plan got wrong — the moment it ships. The distinction is between a *constraint*
("semantic search is deferred, and here is the cost that decided it") and a *design*
("here is how the bin will work"). Three designs were left sitting in the forward
directory after shipping and went stale there; *A plan lives in docs/plans/ until it
ships* in section 17 is the entry that gave the rule its missing half.

---

## The sections

1. [The Target Host, the Budgets, and the Scope They Fix](#1-the-target-host-the-budgets-and-the-scope-they-fix)
2. [Ownership, Authentication and Exposure](#2-ownership-authentication-and-exposure)
3. [The SQLite Contract: Durability, Locking, Migrations and Deletion](#3-the-sqlite-contract-durability-locking-migrations-and-deletion)
4. [What a Quote Is](#4-what-a-quote-is)
5. [Works, Shelves and Reading History](#5-works-shelves-and-reading-history)
6. [People, Credits and Metadata Providers](#6-people-credits-and-metadata-providers)
7. [Search and the Full-Text Index](#7-search-and-the-full-text-index)
8. [The Review Loop](#8-the-review-loop)
9. [Import and the Staging Queue](#9-import-and-the-staging-queue)
10. [What Leaves the App: Exports, Round-Trips and the Shared Image](#10-what-leaves-the-app-exports-round-trips-and-the-shared-image)
11. [Backup, Restore and Recovery](#11-backup-restore-and-recovery)
12. [Shell, Navigation and Entry Points](#12-shell-navigation-and-entry-points)
13. [Controls, Labels, Icons and Help](#13-controls-labels-icons-and-help)
14. [Boards, Cards, Charts and Popups](#14-boards-cards-charts-and-popups)
15. [Appearance as Material: Skins, Texture, Type and Colour](#15-appearance-as-material-skins-texture-type-and-colour)
16. [Serving and Running It: HTTP Surface, Logging, TLS and Updates](#16-serving-and-running-it-http-surface-logging-tls-and-updates)
17. [Verification, Release Engineering and Provenance](#17-verification-release-engineering-and-provenance)

---

## 1. The Target Host, the Budgets, and the Scope They Fix

Everything downstream answers to one fact: this runs on a low-powered NAS already hosting roughly a hundred other services, so idle CPU near zero and a tiny dependency surface are requirements rather than aspirations. The refusals are grouped here because most of them are consequences of that budget rather than separate opinions.

### A NAS sharing a box with ~100 co-tenant services makes CPU frugality a first-class requirement

**Decided.** The target host is stated at the top of the plan as a constraint, not as context: "Target host: a low-powered NAS also running ~100 other services → CPU frugality is a first-class requirement." It is restated in the contributing guide as "a requirement, not a preference", and in the README as the first sentence about the binary.

**Why.** Every budget below is downstream of it. A constraint that lives only in my head gets traded away the first time a feature wants a timer; written into the plan, the README and `DEVELOPMENT.md`, it is something a patch has to argue against rather than something I have to remember to defend.

**Approved.** Mine from the first line of the plan — I picked the host, so I own the budget, and I approved writing it down in three places rather than one.

<sub>pre-1.0 — `docs/PLAN.md` · `DEVELOPMENT.md` · `README.md`</sub>

### Hard runtime caps: `GOMAXPROCS=1`, `GOMEMLIMIT=64MiB`, `GOGC=200` — defensive towards the neighbours, not the app

**Decided.** The shipped systemd unit sets all three as environment variables; the compose file carries them commented out with a pointer to PLAN §8, and the README repeats them under "Runtime tuning for a shared NAS".

**Why.** `GOMAXPROCS=1` hard-caps the app at one core so an import or a search burst cannot starve the hundred services beside it. `GOGC=200` trades a little RSS for fewer GC cycles, which is the right way round when the scarce thing is CPU. The README's own idle figure is ~25 MB RSS, so a 64 MiB limit is a ceiling rather than a squeeze.

**Instead of.** `GOMAXPROCS=2` is named in the plan as the looser option. Argon2id for password hashing was rejected on the same budget — its ~64 MB per hash is exactly wrong on a RAM-shared box.

**Approved.** My call, and I stand by it: the numbers are conservative on purpose because the cost of being wrong lands on someone else's services, not mine.

<sub>pre-1.0 — `deploy/tippani.service` · `docker-compose.yml` · `README.md` · `docs/PLAN.md`</sub>

### No background jobs, pollers, tickers or cron — cleanup and scheduling run on read

**Decided.** Nothing in the binary wakes up on its own. There is no `time.Ticker` anywhere outside tests; the only goroutine in `main` is the listener. Expired sessions are deleted lazily inside `Sessions.Create`, and review scheduling is computed at query time.

**Why.** Idle CPU has to be approximately zero on a box with a hundred neighbours, and a timer is the one thing that cannot be. `DEVELOPMENT.md` states it as a rejection criterion: "If a change needs something to wake up on its own, that is a design discussion before it is a patch."

**Instead of.** A cleanup cron for expired sessions — rejected in the plan itself ("no cleanup cron"). Litestream for continuous backup — rejected for constant background CPU; nightly `VACUUM INTO` from the host's own cron is the answer instead, which is the user's timer and not mine.

**Approved.** I signed this off as a hard line rather than a default, which is why it appears in the contributing guide as grounds for rejecting a patch.

<sub>pre-1.0 — `internal/auth/auth.go` · `docs/PLAN.md` · `DEVELOPMENT.md` · `README.md`</sub>

### Pure-Go SQLite (modernc) over CGo mattn, buying `CGO_ENABLED=0` at ~1.5–2× per-query CPU

**Decided.** `modernc.org/sqlite` is the only driver. The Dockerfile builds with `CGO_ENABLED=0` and cross-compiles on `$BUILDPLATFORM` with no QEMU, into a distroless static image.

**Why.** The plan states the trade honestly — modernc costs roughly 1.5–2× the per-query CPU of `mattn/go-sqlite3` — and takes it anyway, because queries at this scale are single-digit milliseconds either way while the build story is the difference between one multi-arch image and a cross-compilation toolchain. FTS5 is compiled in by default with no build tag, which was part of the choice.

**Instead of.** CGo `mattn/go-sqlite3` — faster per query, rejected on build and deploy complexity.

**Approved.** Mine, taken with the CPU cost written down beside it so nobody later discovers it as a surprise. I approved paying it.

<sub>pre-1.0 — `docs/PLAN.md` · `go.mod`</sub>

### Dependency budget: three direct Go modules, three runtime npm packages, everything else stdlib

**Decided.** `go.mod` has exactly three direct requirements — `golang.org/x/crypto`, `golang.org/x/time`, `modernc.org/sqlite`. `package.json` has exactly three runtime dependencies — `@chenglou/pretext`, `react`, `react-dom`. Everything else is a devDependency or the standard library.

**Why.** A dependency on a NAS is a thing that has to be audited, updated and trusted forever. Concretely: CSRF is Go 1.25's `http.CrossOriginProtection` rather than a token library, response compression is `compress/gzip`, and backup sealing is AES-256-GCM and Argon2id out of the stdlib and `x/crypto`.

**Approved.** I approved each of the six individually and treat the count as a budget — a seventh needs an argument, which is why "a new always-on dependency" is listed in `DEVELOPMENT.md` as grounds for rejection.

<sub>pre-1.0 — `go.mod` · `web/frontend/package.json` · `DEVELOPMENT.md`</sub>

### Static assets are precompressed at build time; the NAS never runs Node and never gzips a byte at request time

**Decided.** The Node half shipped and holds — the frontend builds in its own Docker stage and `web/dist` is embedded with `go:embed`, so the runtime image is distroless static with no Node in it. The precompression half never shipped.

**Why.** The plan promised "Precompressed (gzip + brotli) at build, served with `Content-Encoding` + `Cache-Control: immutable` → zero runtime compression CPU". That is not what is built: `vite.config.js` has no compression plugin, `spaHandler` is a plain `http.FileServerFS`, and `Cache-Control: immutable` is set on stored covers only.

**Reversal.** Reversed in 1.1.0, and I got the priority wrong rather than the arithmetic. I designed for the LAN case, where compression is invisible, and forgot the case the mobile client actually lives in. Quote text compresses roughly eight to one, and over Tailscale or cellular that is the difference between a library sync that feels instant and one that does not. So a stdlib `compress/gzip` middleware went in, opt-in per request via `Accept-Encoding` and skipped for content types that are already compressed — the NAS does gzip bytes at request time now, deliberately.

**Approved.** Both halves are mine. I approved the original plan and I approved overturning it once the phone made the cost visible; the honest summary is that I optimised for the wrong link.

<sub>1.1.0 (reversal) — `docs/PLAN.md` · `web/frontend/vite.config.js` · `internal/httpapi/server.go` · `internal/httpapi/gzip.go` · `CHANGELOG.md`</sub>

### Layout work that can happen on the reader's device does: sticker text flow is client-side, code-split and lazy-loaded

**Decided.** The quote-flows-around-a-sticker layout runs entirely in the browser. `@chenglou/pretext` is loaded by a bare `await import('@chenglou/pretext')` inside the relayout effect, so it is its own chunk and arrives only when a quote with a seal is on screen.

**Why.** Zero NAS cost is the point. pretext measures each quote once and reflows with arithmetic rather than DOM reflow; the plan budgets the chunk at ~17 KB gzip. It falls back to a plain paragraph with the seal floated under `prefers-reduced-motion`, with no seal, and until the chunk lands — so the feature degrades to text rather than to nothing.

**Instead of.** Server-side layout — never seriously entertained; it is the exact shape of work this host cannot afford.

**Approved.** My call. The general rule I approved here is the one that decides the OCR and speech questions further down: if the reader's device can do it, the NAS does not.

<sub>pre-1.0 — `web/frontend/src/flow.jsx` · `docs/PLAN.md`</sub>

### Tippani never contacts the network on its own — every outbound call is one you triggered

**Decided.** There is no scheduled or ambient outbound traffic. Metadata lookups (Google Books, Open Library, TMDB, TheTVDB, Wikidata) run when you ask for them; the GitHub release check runs only when an admin presses the button. Cover and portrait fetches go through a host allowlist behind an SSRF guard and are then served from local disk, never hotlinked.

**Why.** It follows from the no-background-jobs rule, and it is also the honest reading of "self-hosted". A CSP of `default-src 'self'` with nothing external is what makes it checkable from the browser side rather than only from the source.

**Approved.** I approved this and I approved saying it plainly in `AI.md` rather than leaving it to be inferred from the absence of code.

<sub>pre-1.0 — `AI.md` · `README.md` · `docs/PLAN.md`</sub>

### No AI at runtime: not disabled by default, not present

**Decided.** There is no OpenAI, Anthropic or local-inference code path in `internal/` or in the frontend, no model ships with the binary, and highlights are never sent to a model because they are never sent anywhere.

**Why.** The distinction that matters is between "off by default" and "absent", and only the second is a property someone can verify. `AI.md` separates the two questions people conflate — was the code written with AI (yes, throughout) and does the app use AI (no) — and answers them apart, because they are not the same claim.

**Instead of.** Opt-in digest summaries against an OpenAI-compatible endpoint the user configures with their own key sits under *Later / maybe* on the roadmap: not built, not started, and if ever built, off by default and explicit about what leaves the machine.

**Approved.** Mine, and I wrote the disclosure myself in the first person because a hedged version of this claim would be worse than none.

<sub>pre-1.0 — `AI.md` · `README.md` · `docs/landing.html`</sub>

### No built-in reader, no OPDS, no file sync — annotations are wanted, files are not

**Decided.** Tippani holds no book files. No reader, no OPDS catalogue, no sync to a Kobo or Kindle.

**Why.** It is a home for what you marked, not for what you own. Grimmory, Kavita, Calibre-Web and Audiobookshelf all do the shelf properly, one of them is already a planned sync source, and competing means carrying a format zoo, a streaming path and a storage story for no gain. The distinction worth stating, because the two look alike from outside: reading annotations out of KOReader or Kobo is very much wanted and is on the roadmap; serving files is not.

**Approved.** My call, recorded under "Considered and set aside" so the boundary stays a decision instead of reading as a missing feature.

<sub>pre-1.0 — `docs/roadmap.html`</sub>

### No social features and no federation — and the hosted read-only page was dropped after being on the list

**Decided.** No following, feeds, public profiles, discovery or ActivityPub-style federation.

**Why.** Per-user isolation here is a security property rather than a layout choice — a foreign row answers 404 precisely so nothing leaks between accounts on one box — and a social graph works against the reason for self-hosting at all. Sharing something deliberately is already handled: the share sheet does one quote, the export does a work, a filtered set or the whole library as Markdown.

**Reversal.** A hosted read-only page sat on this list as a wanted thing for a while, and I dropped it. What I got wrong was thinking it was a different feature from the export. It is mostly a worse version of one — the same content, plus a public surface to secure and a link to remember to revoke.

**Approved.** Mine both times, and the reversal is the more useful half: I approved adding it, then approved removing it once I could say what it added over an export, which was nothing.

<sub>pre-1.0 — `docs/roadmap.html`</sub>

### Server-side OCR refused; on-device OCR is a different feature and was moved rather than left refused

**Decided.** OCR will not be built into the Go binary. Recognition in the planned Android client runs on the device via ML Kit.

**Why.** In the binary it is a dependency, a CPU cost and an upload path, all on a box chosen for being small. On the device it costs the server nothing at all, so the reason for the refusal simply does not reach it.

**Instead of.** The share-target route remains the no-app answer for a phone, and is still planned.

**Reversal.** The refusal stands; my reasoning around it did not. I had written it as though the server were the only place OCR could live, which made a hosting decision read as a feature judgement. The entry now says so and the feature moved to the roadmap's [Android app](roadmap.html#android) section rather than staying on the set-aside list.

**Approved.** I approved the original refusal and I approved correcting its scope. The correction is the point: what I got wrong was the boundary of my own argument, not its conclusion.

<sub>pre-1.0 (refusal), scope corrected later — `docs/roadmap.html`</sub>

### Server-side text-to-speech refused; the browser's own `SpeechSynthesis` accepted

**Decided.** No speech model or paid speech API in the binary, and no audio to store or stream. Reading a due review card aloud through the browser's `SpeechSynthesis` is accepted, scoped to a play control on a review card and nothing else — no stored audio, no transcription, no server route.

**Why.** The two are not one feature in different clothes. One is a model and an audio pipeline on a box that cannot spare either; the other is an API the browser already ships, which costs the server nothing, needs no key, and works offline once the service worker exists.

**Approved.** I approved the acceptance specifically because the line it sat next to turned out to be drawn in the right place already — the OCR entry had done the work of separating "on the server" from "the feature".

<sub>pre-1.0 (refusal); the browser half is accepted, not built — `docs/roadmap.html`</sub>

### Android only for the native client; no unbuildable `ios/` directory ships

**Decided.** The planned native client is Flutter in `mobile/`, Android only. No `ios/` directory in the tree.

**Why.** Flutter compiles for iOS and the Dart here stays platform-agnostic, but building and signing for iOS needs a Mac and I do not have one. An `ios/` directory I cannot build is a directory that rots, and it advertises a platform nobody can ship. A fork with a Mac adds it with `flutter create --platforms=ios .` and a signing config.

**Instead of.** Shipping the directory anyway for the look of portability — rejected.

**Approved.** My call, and I approved saying why in the roadmap rather than letting the absence read as an oversight. The README says Android and does not imply otherwise.

<sub>pre-1.0 — `docs/roadmap.html`</sub>

## 2. Ownership, Authentication and Exposure

Per-user isolation is treated as a security property, not a layout convenience, and every credential decision is argued from what a browser does automatically versus what a person does deliberately. Auth was built before the features that depend on it.

### Per-user isolated libraries, and the one assumption still marked "confirm"

**Decided.** Every book, annotation, tag, genre, quote and person row belongs to exactly one user. Nothing is shared, and there is no shared-library mode.

**Why.** Duplicate book rows across accounts cost kilobytes; the isolation is the strongest available and the queries are the simplest. What is worth recording is that this was never actually settled: §11 still grades it "Assumed — confirm", §12 still carries "Confirm the per-user-isolated library assumption" as open item 3, and thirty migrations (0001 through 0030) have been written on top of it without anyone going back. The honest reasoning is thin — nothing ever pushed back on it, so it hardened by default rather than by argument. I approved it at the start and I have re-approved it by silence ever since, which is the weaker of the two.

**Instead of.** A shared/household library, deferred in §9 and never picked up — it would change §3 materially.

<sub>`docs/PLAN.md` · `internal/store/migrations/0001_init.sql …`</sub>

### Ownership lives inside the write statement, and a foreign row answers 404

**Decided.** Every read and write carries its own ownership predicate — either `WHERE user_id = ?` or the parent join that stands in for it — and a row that is not yours is reported as absent, never as forbidden.

**Why.** For annotations and dialogues the ownership check and the parent join are the same clause (`JOIN books b ON b.id = a.book_id WHERE b.user_id = ?`), so forgetting it is not really possible — there is nothing to select from. Standalone quotes have no parent and therefore no safety net, which is why every query in `utterance_handlers.go` carries `WHERE user_id = ?` and a missing one is a cross-account leak rather than a hidden row. The status code follows from the same premise: 403 confirms the row exists, so it is an existence oracle over another account's library. 403 is kept only where the refusal is genuinely about who is asking (the admin gate, and stepping down on someone else's behalf), which is a different fact and says so. My call, and I stand by it.

<sub>`internal/httpapi/utterance_handlers.go` · `internal/httpapi/book_handlers.go` · `internal/httpapi/read_history_handlers.go` · `internal/httpapi/admin_handlers.go` · `internal/httpapi/maintenance_avatar_test.go`</sub>

### Auth, sessions and CSRF were built first, not last

**Decided.** The build order is schema + migrations → auth/sessions/CSRF → annotation CRUD + search → importers → metadata + covers → movies → UI → packaging. The plan says "(first, not last)" in the line itself.

**Why.** Every table below `users` has a `user_id` foreign key with `ON DELETE CASCADE`, and every handler above it reads an identity out of the request context. Retrofitting either is a rewrite of the schema and of every handler at once. Doing it first means the ownership predicate is present in the first query anyone writes rather than being added to forty of them later. I signed this off before the first migration ran.

<sub>`docs/PLAN.md`</sub>

### bcrypt cost 10 for logins, Argon2id for archive keys

**Decided.** Passwords hash with bcrypt at cost 10. Argon2id was rejected for logins on memory grounds — and then used anyway for backup-archive key wrapping, at the OWASP floor (m = 19 MiB, t = 2, p = 1).

**Why.** Cost 10 is ~60–100 ms on weak ARM, which is fine for a rare event, and its acknowledged downside is that it is not memory-hard. Argon2id's ~64 MiB per hash is exactly wrong on a NAS whose systemd unit sets `GOMEMLIMIT` to 64 MiB and which shares RAM with about a hundred other services. The apparent contradiction is a budget question, not a cryptography one: a login happens often and concurrently, an archive is sealed once and deliberately, so the 19 MiB scratch buffer is affordable exactly where the 64 MiB one is not. The three Argon2 parameters are fixed rather than stored, because `p` changes the output and a portable archive cannot let it vary by machine. Mine, and the `internal/auth` comment names `internal/httpapi/backup_crypto` explicitly so neither half reads as an oversight.

**Instead of.** Argon2id everywhere (rejected on RSS); scrypt (never argued for).

<sub>`internal/auth/auth.go` · `internal/httpapi/backup_crypto.go` · `docs/PLAN.md`</sub>

### Passwords are 8–20 characters of printable ASCII, because a password is a backup key

**Decided.** `minPasswordChars = 8`, `maxPasswordChars = 20`, and every byte must be in 0x20–0x7E.

**Why.** The upper bound used to be bcrypt's own 72-byte limit, validated only so a long password returned a clean 400 instead of a 500. It is 20 characters now for a reason outside login: the same password wraps the AES-256-GCM key of every backup archive, so it has to survive being typed on a phone keyboard, then on another machine's keyboard, possibly a year later, on a fresh install where getting it wrong means the archive does not open. Diacritics and non-Latin input are exactly what does not survive that trip — the same glyph arrives as one code point or as two and the hashed bytes differ. Scanning bytes rather than decoding runes is sufficient, since any multi-byte UTF-8 sequence necessarily contains a byte ≥ 0x80. I approved narrowing this knowing it makes the app look old-fashioned; the alternative is an unopenable archive.

<sub>`internal/httpapi/auth_handlers.go` · `README.md`</sub>

### Session tokens: SHA-256 at rest, 30-day sliding under a 90-day cap, swept lazily

**Decided.** A session token is 256 bits of randomness; only its SHA-256 is stored. `SessionLifetime` is 30 days sliding, `sessionRefreshAt` bumps expiry when under 15 days remain, and `SessionMaxLifetime` caps the whole thing at 90 days from creation. Expired rows are deleted on the next `Create`.

**Why.** Storing the hash means a database read — a backup archive, a stolen file — does not yield a usable cookie. The sliding window keeps a daily user signed in; the absolute cap stops a token renewing itself indefinitely, which is the failure mode a purely sliding window has. The sweep runs inside `Create` rather than on a timer because a cleanup cron is a background process, and §8's CPU budget says idle CPU is approximately zero — a login is the only moment the table needs tidying and the only moment anyone is waiting on it anyway. My decision, approved with the constants written into `auth.go` rather than config, so a reader sees the policy and not a knob.

<sub>`internal/auth/auth.go` · `docs/PLAN.md`</sub>

### Device tokens have the opposite lifetime to sessions, on purpose

**Decided.** A device token is constructed exactly like a session — 256 random bits, only the SHA-256 stored — and then given the opposite policy: no expiry at all, and a password change does not revoke it.

**Why.** A browser cookie is ambient and long-lived by accident, so capping it and sweeping it on a password change is right. A paired phone is deliberate: you went and paired it. Silently unpairing every device on a routine password rotation gives the device no signal at all — from the phone it is indistinguishable from an outage — and that is worse than the threat it would mitigate. Unpairing is therefore its own explicit act, per device or all at once, in Settings → Devices. The revoke endpoint returns one error for "no such device" and "not yours" together, because distinguishing them turns it into an oracle for which device ids exist on other accounts. This is my call and I would make it again; it is the one place in the app where the less-secure-looking option is the correct one.

<sub>`docs/PLAN.md` · `internal/auth/auth.go`</sub>

### Pairing codes live in memory: one-shot, five minutes, look-alike-free

**Decided.** `pairingTTL = 5 * time.Minute`, `pairingCodeLen = 8` over the 32-symbol Crockford-ish alphabet `0123456789ABCDEFGHJKMNPQRSTVWXYZ`, `maxPairingCodes = 64`, redeemed by deletion whether or not it had expired.

**Why.** The claim endpoint has to be unauthenticated — the phone has no credential yet, which is the whole point — so the code *is* the credential for those few minutes and is treated like one. Eight characters of a 32-symbol alphabet is 40 bits, trivial to brute-force unthrottled, which is why the claim route is rate limited and why the TTL is minutes. No I, L, O or U, so a code read off a screen cannot be mistyped into a different valid code. The modulo in `newPairingCode` is unbiased only because 256 is an exact multiple of 32, and the comment says so — an earlier version of that comment claimed rejection sampling, which the code has never done, and correcting a comment that lied is worth as much as fixing code. Codes live in a map rather than a table because they outlive nothing: a restart costs one tap, and it keeps a transient concern out of the schema and out of the backup archive.

**Reversal.** Eviction originally took the globally-oldest entry, so one account holding down "Pair a device" could evict everyone else's pending code. I got the scope wrong: I was thinking about the map, not about whose map it is. Eviction now prefers the minter's own oldest code and only reaches other users' when it has none of its own. Small on a family box, but a cross-user effect for no reason.

<sub>`internal/httpapi/pairing_handlers.go`</sub>

### CSRF is the stdlib header check, and bearer requests bypass it

**Decided.** `http.NewCrossOriginProtection()` wraps every route. `exceptBearer` routes a request carrying `Authorization: Bearer` around that wrapper and everything else through it.

**Why.** Cross-origin protection exists to stop a hostile page making a browser spend an *ambient* credential. A bearer token is never attached automatically — it has to be read from storage and set deliberately, which a cross-origin page cannot do — so the check buys nothing on that path. Today a header-less request already passes (no `Sec-Fetch-Site`, no `Origin`, nothing to reject), so this makes the native client's exemption explicit rather than incidental, and a stricter stdlib default in a future Go release cannot silently break every phone. It deliberately does not weaken the cookie path: a cookie-only request goes through the wrapper cross-site or not, and there is a test named for exactly that. Skipping CSRF is also not skipping auth — a forged header buys a 401. I approved the bypass only once the second half was pinned by a test.

**Instead of.** Double-submit tokens (rejected: state, deps, and a stdlib answer exists).

<sub>`internal/httpapi/server.go` · `internal/httpapi/bearer_auth_test.go` · `internal/httpapi/csrf_native_test.go` · `docs/PLAN.md`</sub>

### A present-but-unusable Authorization header fails closed

**Decided.** `bearerToken` returns `ok = true` with an empty token for `"Bearer"`, `"Bearer "`, or a different scheme entirely — anything except an absent header. `requireAuth` then validates that empty token and 401s.

**Why.** The tempting behaviour is to treat an unusable header as no header and fall through to whatever cookie happens to be attached. That would mean a revoked device keeps working as long as a browser session exists alongside it on the same device, which is precisely the case unpairing is supposed to close. Bearer also wins when both credentials are somehow present, so the identity does not depend on header ordering. My decision, and the failing-closed half is the part I care about.

<sub>`internal/httpapi/server.go`</sub>

### Login rate limiting keyed on (client IP, username), rightmost XFF only

**Decided.** `golang.org/x/time/rate`, keyed on `clientIP + "|" + username`. `X-Forwarded-For` is read only when `TIPPANI_TRUSTED_PROXY=1`, and then only its **rightmost** entry.

**Why.** A single reverse proxy appends the real client IP to whatever the client already sent, so everything left of the last comma is client-forgeable. Reading the leftmost entry — the usual mistake — lets an attacker rotate a fake IP per request and mint a fresh limiter bucket each time, which defeats both the brute-force protection and the bcrypt-DoS protection it doubles as. Without a declared proxy the header is ignored entirely and `RemoteAddr` is used. Signup and onboarding restore ride the same limiter under their own key suffixes, because both are unauthenticated routes that spend real CPU. I approved this after the rightmost/leftmost distinction was written down as a test rather than a comment.

<sub>`internal/httpapi/server.go` · `internal/httpapi/auth_handlers.go` · `internal/httpapi/security_test.go` · `docs/PLAN.md`</sub>

### Roles are one `is_admin` flag, and the first user is the admin

**Decided.** A single boolean column. The first user is created by onboarding (or by the CLI on an empty database) and is the admin; onboarding closes the moment any user exists.

**Why.** Under per-user isolation there is nothing for finer-grained permissions to protect. An admin cannot read another account's library — no route exposes one — so the only privileged surface is instance management: add and remove users, metadata keys, backup and restore, maintenance. That is one bit of information. Anything more is a permissions model built for a sharing feature that does not exist, which is YAGNI in its purest form. Mine, and I have refused to widen it twice since.

<sub>`docs/PLAN.md` · `internal/httpapi/admin_handlers.go`</sub>

### Admin hand-over is grant-only, because a role you can take is a race

**Decided.** An admin may promote any member and may step down. Nobody may revoke another admin. The last remaining admin cannot step down, guarded by one atomic statement that counts and updates together.

**Why.** Otherwise admin is not a role, it is a race: two admins, and whoever opens the page first is the only one left. There is no seniority here to appeal to, no founder flag, no audit trail, and nothing to undo it with once your own rights are gone. Handing over is still one action each — I make you an admin, you step down, or I do. What was removed is doing the second half *to* somebody.

**Reversal.** This started as grant-then-revoke-your-own, i.e. the full matrix, and I was wrong: I had modelled it as an administrative capability when it is actually a mutual-destruction button on an instance with no recovery path. The refusal answers 403 rather than the 409 its neighbours use, and the distinction is real — it is refused because of *who is asking*, and the identical request from the target themselves succeeds.

<sub>`internal/httpapi/admin_handlers.go` · `internal/httpapi/admin_rights_test.go` · `README.md`</sub>

### An admin account must step down before it can be deleted

**Decided.** `handleDeleteUser` refuses when the target is an admin, on the same rule as the revoke guard.

**Why.** Refusing to let an admin take another admin's rights while letting them delete the account those rights belong to protects nothing: the bypass is louder and strictly worse, because it takes that person's whole library with it. Without this line the revoke guard is decorative. The consequence, stated plainly rather than hidden: an admin account can only be removed after it steps down, and only its own holder can do that — so getting rid of an uncooperative admin is a database operation, not a UI one. That is the correct place for it, on an instance whose alternative is that any admin can quietly delete any other. I approved this as the second half of one decision, not as a separate feature.

<sub>`internal/httpapi/admin_handlers.go`</sub>

### Switching accounts requires that account's password, and retires the session you arrive with

**Decided.** Switching goes through `POST /auth/login` like any other sign-in, and the cookie session presented on the way in is deleted — after the password check, before the new session is minted.

**Why.** Switching from Profile logs in over a session that is still valid, and `startSession` only overwrites the cookie. The old row would sit in the `sessions` table until it expired, reachable by anyone holding that token — a session you believed you had left. Deleting it *after* the check is the load-bearing detail: a failed switch must leave the session you are still using alone. Being an admin does not let you into another account without its password either. My call.

<sub>`internal/httpapi/auth_handlers.go`</sub>

### Share-image tokens are session-free by design, and deliberately not single-use

**Decided.** `POST /share/image` stages a PNG under a 128-bit random token with a three-minute TTL in a 16-entry capped map; `GET /share/image/{token}` serves it with no session, and does not consume it.

**Why.** Android's DownloadManager fetches outside the WebView's cookie jar, so requiring a session would make the download fail for exactly the clients the route exists for. The token is the credential instead: unguessable, short-lived, capped, swept on read and on the next upload. Uploads are PNG-only — the GET reflects bytes without a session, so it must only ever serve what a canvas produced.

**Reversal.** It was single-use, and that was wrong. A WebView `<a download>` handed to DownloadManager commonly fetches the URL more than once — the WebView's own navigation plus the manager's fetch, or a probe followed by a ranged request — so consuming the token on the first hit made the real download 404. I had reasoned about the security property and not about the client. Serving it a few times over three minutes is safe; the file header still says "single-use" and is now stale against the handler twenty lines below it.

<sub>`internal/httpapi/share_handlers.go`</sub>

### The binary binds 127.0.0.1, the Docker image binds 0.0.0.0

**Decided.** `TIPPANI_BIND` defaults to `127.0.0.1:8080` for the binary; the image binds `0.0.0.0:8080` and the shipped compose publishes `8080:8080`.

**Why.** §1's table states a flat "binds `127.0.0.1`" and that is no longer the whole truth, so §2 softens it explicitly rather than leaving the two in disagreement. A NAS app that is not reachable on the LAN is not a NAS app. The cost is named rather than buried: first-run onboarding is unauthenticated, because the first caller claims admin, so there is a window on a fresh box in which anyone on the LAN can become its administrator. The remedy is stated in the same breath — onboard promptly, or publish host-local behind a proxy until you have. After onboarding every route requires a credential. I approved shipping the window with the warning attached rather than shipping an app nobody can reach.

<sub>`docs/PLAN.md` · `cmd/tippani/main.go`</sub>

### Signup and first-run restore are serialised under one lock

**Decided.** `handleSignup` takes `backupMu` with `TryLock` around its whole check → hash → insert, and the onboarding restore holds the same mutex across its swap, re-checking users-empty in a guard closure immediately before the point of no return.

**Why.** Both routes are unauthenticated and both are gated on "the users table is empty", which is a fact that can stop being true while you are working. A slow multi-gigabyte extraction could finish long after a legitimate signup landed and swap that new admin away; equally, a signup could commit an admin during a restore that then discards it. The users-empty check at the top of the restore is a fast rejection, not the guard — the guard is the closure under the lock, and it only closes the race *because* a signup cannot commit while the lock is held. `TryLock` rather than `Lock` so a running restore answers a clean 409 instead of blocking a signup for minutes. The `INSERT … WHERE NOT EXISTS` stays as the atomic backstop. I signed this off once both halves were named in each other's comments.

<sub>`internal/httpapi/auth_handlers.go` · `internal/httpapi/backup_handlers.go`</sub>

## 3. The SQLite Contract: Durability, Locking, Migrations and Deletion

SQLite is the whole persistence story here, so its pragmas, its lock ordering and its inability to alter a constraint shape more decisions than any other single component. This section also holds the concurrency misdiagnosis that took me two releases to correct, and the plan for making deletion recoverable without a soft-delete flag.

### WAL with `synchronous=FULL`, superseding the planned `NORMAL`

**Decided.** I open the database with `journal_mode(WAL)` and `synchronous(FULL)`. PLAN §8 specified `NORMAL`, and I was wrong: in WAL mode `NORMAL` only fsyncs at checkpoint, so an unclean stop — `docker stop` escalating to SIGKILL, or a volume that does not guarantee fsync ordering — can leave a torn WAL that surfaces later as `database disk image is malformed`. `FULL` fsyncs the WAL on every commit and closes that window. Write volume here is low (imports, edits, never a hot path), so the extra fsync is negligible against the corruption it prevents. I approved this the day I finished reading the corruption postmortem.

**Instead of.** `synchronous=NORMAL`, as planned, on the argument that WAL is crash-safe anyway. It is, against a process crash; not against a volume that reorders.

**Reversal.** This entry *is* a reversal of the plan. §8 now records the supersession in place rather than quietly reading as if it were built.

<sub>0.6.4 — `internal/store/store.go` · `docs/PLAN.md`</sub>

### Graceful shutdown drains, then checkpoints the WAL

**Decided.** On `SIGTERM` or interrupt the server drains in-flight requests with a 5-second `http.Server.Shutdown` context, then runs `PRAGMA wal_checkpoint(TRUNCATE)` to fold the log back into the main file before the deferred `Close` runs. Docker's default stop grace is around ten seconds, so the whole sequence finishes well before SIGKILL. Without the handler the Go runtime terminates immediately, the deferred close never runs, and an unclean kill has a live WAL to tear. The checkpoint is best-effort — a busy checkpoint is logged as `TIP-STORE-005` and not treated as fatal, because the WAL is still valid and replays on reopen. My call, made in the same pass as the `FULL` change and for the same reason.

**Instead of.** Relying on WAL replay alone; rejected because replay is the recovery path, not the design.

<sub>0.6.4 — `cmd/tippani/main.go` · `internal/store/store.go`</sub>

### One transaction per imported file

**Decided.** An import stream-parses with `bufio` (raised max-token cap, since the 64 KB default errors on pathological long lines) and commits every insert in a single transaction per file. The plan states the reason as bluntly as I would: batched inserts are the difference between a sub-second burst and minutes of fsync churn. With `synchronous=FULL` this stopped being a nicety — per-row commits would fsync per row. The staging rework kept the shape: parse one or many books, then one transaction that stages every work and its quotes. I signed this off at plan time and never had cause to revisit it.

**Instead of.** Per-row or per-book commits, for finer failure granularity. Rejected: a half-imported file is worse than a rejected one.

<sub>planned in §5/§8; held through the staging rework in 1.2.0 — `docs/PLAN.md` · `internal/httpapi/import_handlers.go`</sub>

### The planned single-writer connection, and a 500 left unpatched on purpose

**Decided.** PLAN §8 specified a single writer connection. `store.Open` allowed four. When 1.1.1's adversarial re-read turned up concurrent writes still returning a 500, I deliberately did not patch it in that release, on the reasoning that it needed the single-writer design the plan had always specified rather than a spot fix. I recorded it in *Known bugs* on the roadmap and shipped without it. That was the right instinct about process and the wrong diagnosis about cause, and I own both halves — the bug then sat in the roadmap for two releases.

**Instead of.** An in-process mutex around the two write paths that had reproduced, shipped in 1.1.1. Rejected as a patch over a design.

**Reversal.** Reversed in full by 3.5. The design I was protecting was not the fix.

<sub>1.1.1 — `docs/PLAN.md`</sub>

### `_txlock=immediate` replaced the single-writer plan

**Decided.** The lock order was the bug and the pool size never was. Almost every write here reads before it writes — the duplicate check, the ownership check, the FTS row about to be updated — and under SQLite's default `DEFERRED` locking that makes `BEGIN` take a read lock the first `INSERT` must upgrade. SQLite will not run the busy handler for that upgrade, because two transactions both holding read locks and both wanting to write would deadlock, so it fails the second one instantly. That is why eight concurrent POSTs produced a 500 in 17 ms against a `busy_timeout` of 5000: the timeout was never consulted. Opening with `_txlock=immediate` takes the write lock at `BEGIN`, where there is nothing to upgrade, and a second writer simply waits. One line, covering all thirty write transactions rather than the two a mutex would have been threaded through — and unlike a mutex it holds against a second process, a `sqlite3` shell or a restore. I approved this after reproducing the failure, and it is the correction I am gladdest about.

**Instead of.** The single-writer connection of 3.4, and a serialising mutex. Both aimed at the symptom through the wrong mechanism.

**Reversal.** None since; this is itself the reversal of the plan.

<sub>1.3.2 — `internal/store/store.go` · `internal/store/write_lock_test.go`</sub>

### A four-connection pool, with readers deliberately left concurrent

**Decided.** `SetMaxOpenConns(4)`. `_txlock` applies only to read-write transactions, so a read-only `BEGIN` still gets a plain deferred lock and several readers can overlap — including while a writer holds the write lock, which is the entire point of WAL. This is pinned rather than asserted: `TestReadersOverlapAWriter` opens a writer, holds it, and requires two reads to get through; its failure message says what a failure would mean, which is that every search on the box is now queueing behind imports. I asked for that test specifically, because the property is invisible until it is gone.

**Instead of.** Dropping to a single connection, which the abandoned single-writer plan implied. It would have serialised readers behind writers on a box whose search is meant to be the fast thing.

<sub>1.3.2 — `internal/store/store.go` · `internal/store/write_lock_test.go`</sub>

### The one genuinely read-only transaction is marked `ReadOnly`

**Decided.** `previewStagedTarget` answers "where would this work's quotes land?" and never writes. Because the DSN sets `_txlock=immediate`, a plain `Begin` there would take SQLite's write lock up front — and this runs once per staged work while a staging list renders. So it opens with `sql.TxOptions{ReadOnly: true}`. A preview has no business queueing behind a real writer, or making one queue behind it. It is the only transaction in the tree that qualified, and I moved it in the same commit that introduced the immediate locking, because that change is what made the distinction matter.

**Instead of.** Leaving it read-write, which was invisible until `_txlock=immediate` gave it a cost.

<sub>1.3.2 — `internal/httpapi/import_staging.go` · `internal/httpapi/conflict_pool_test.go`</sub>

### On a duplicate-create conflict the transaction is released first

**Decided.** The duplicate-create path reads the existing row so a retried write is idempotent, and it used to read it through the pool while still holding its own INSERT transaction — which needs a *second* connection. The pool caps at four, so once those were in use the handler blocked waiting for a connection only it could free, and the request hung until `busy_timeout` turned it into a 500. It is reachable by the least exotic client behaviour there is: re-posting the same captures, which is what an offline queue does. The transaction is now rolled back before the read, which is safe and complete because the failed INSERT matched nothing and has no work to commit. I approved this fix the hour I understood it.

**Instead of.** Raising the pool size, which moves the cliff rather than removing it.

**Reversal.** None. A related wrinkle on the same path was fixed alongside: a row deleted concurrently between the failed insert and the read used to give a 500 and now gives a plain 409.

<sub>1.1.1 — `internal/httpapi/annotation_handlers.go` · `internal/httpapi/conflict_pool_test.go`</sub>

### Rows are collected before they are updated

**Decided.** Two write paths that iterate and mutate — the staged-quote tag rewrite and the people rename — collect their rewrites into a slice first and apply them after the cursor closes, rather than executing inside the loop. The recorded reasoning is thin, and I am not going to inflate it: the comments say "collect before writing: SQLite dislikes writes mid-cursor" and "no exec while the cursor is open", and the rename adds that a full scan is fine because libraries are hundreds of rows and renaming is rare. That is the whole of what is written down. The rule is mine and I keep it, but it is a habit backed by a caution rather than a reproduction.

**Instead of.** A single `UPDATE` on the rename path, rejected for a separate and better-documented reason: `from` may be one component inside a joined credit ("Neil Gaiman & Terry Pratchett"), which SQL string equality cannot rewrite without clobbering the co-credits.

<sub>1.2.0 (staging), 1.6.0 (people) — `internal/httpapi/import_staged_bulk.go` · `internal/httpapi/people_handlers.go`</sub>

### Migrations are forward-only, append-only, and never edited afterwards

**Decided.** Files are `NNNN_description.sql`, embedded with `go:embed`, applied in lexical order, each in its own transaction, with the version row written inside that same transaction. A misnamed file is caught before anything is applied, because every version is parsed up front. The rule in `DEVELOPMENT.md` is one sentence and it is the important one: never edit a migration that has shipped — someone is already running it. I hold to this even when the fix would be trivial, and the one repair that genuinely could not be expressed as SQL (re-hashing dialogues that 1.3.0 wrote with a text-only dedupe hash) runs as an idempotent Go backfill from `Migrate` rather than as a rewritten migration.

**Instead of.** Down-migrations. Never built; a downgrade path implies a downgrade is supported, and it is not (3.11).

<sub>from 0.1.0 — `internal/store/migrate.go` · `DEVELOPMENT.md` · `AI.md`</sub>

### An old build refuses to open a newer database

**Decided.** Because migrations are forward-only, an older binary's failure mode is not an error — it is a *success*. It looks for work, finds all of its own migrations applied, skips them, returns cleanly, and serves an app in which every table added since its release does not exist. No warning, no log line, nothing to search for. This happened: a stray `v1.3.0` tag went up alongside `v1.7.2`, both fired the image workflow, the older build finished about two minutes later and so claimed `:latest`, and a 1.3.0 container came up against a schema-0029 database reporting no quotes at all. Nothing was damaged, but establishing that took an audit of four migrations. `Migrate` now compares the recorded version against the highest it carries and stops with both numbers in the message. Stopping is the safe direction; starting is the direction with no way back. I approved this the same day, and asked for it to be mutation-tested before it was kept.

**Instead of.** Starting with a warning. Rejected: the warning is the thing nobody reads, and an empty screen is indistinguishable from data loss.

<sub>1.7.3 — `internal/store/migrate.go` · `AI.md`</sub>

### Column order in base tables is append-only

**Decided.** `store.Recover()` copies base tables with `INSERT INTO main.t SELECT * FROM old.t`, which needs a freshly-migrated database's physical column order to match an upgraded one. So a new column goes on the end, and a table rebuild that reorders columns is a recovery bug that only appears the day recovery is needed. The rule is written into the migrations themselves — `0023` states it and `0026` restates it — rather than living only in the plan, because the person adding column twelve is reading a migration, not a design document. Mine, and one I would defend hard: the cost of the constraint is tidiness and the cost of breaking it is silent.

**Instead of.** Naming columns explicitly in `Recover`, which would decouple the two. That trades one silent failure for another: a copy that names columns by hand stops carrying the column added next release.

<sub>1.2.0 (recorded), applies from 0001 — `internal/store/repair.go` · `internal/store/migrations/0023_import_staging.sql` · `docs/PLAN.md`</sub>

### Open-ended vocabularies are validated in app code, never in a `CHECK`

**Decided.** Migration 0004 dropped the `CHECK` on `annotations.source` because the importer list keeps growing — `md`, `bookcision`, `hardcover_html`, `readest`, `ocr` — and SQLite cannot alter a constraint. Every open-ended vocabulary since has followed: shelf status (`normalizeStatus`), review outcomes, the work `kind`. Two costs justify it. Altering a `CHECK` means a full table rebuild, and these are FK parents with cascading children — the most dangerous migration class in this repo. And a migration that fails means the application does not start, so a constraint that has to change on every vocabulary addition is a constraint that can take the box down over a new import format. Closed vocabularies — the six colours, the five sticker styles — keep their `CHECK`, because they are not open-ended. I settled this in 0004 and have applied it consistently since.

**Instead of.** Rebuilding the table each time the vocabulary grows. Rejected on both costs above.

<sub>0.4.x (migration 0004) — `internal/store/migrations/0004_quote_meta.sql` · `docs/PLAN.md`</sub>

### No convenience trigger on a table backing an external-content FTS index

**Decided.** When I found that `books.updated_at` and `movies.updated_at` were never written, my first attempt was a trigger — the robust-looking answer for tables written from a dozen places. It is not. Both tables carry FTS5 external-content sync triggers, and a trigger that updates the row it was fired by drives those out of step with the content table; SQLite reports it as `database disk image is malformed` on the next insert. I backed the triggers out and did the work at the call sites instead. The changelog says the thing I want the next person to read: worth knowing before anyone adds a convenience trigger to a table with an external-content index. My call, and the reversal is the useful part of it.

**Instead of.** The trigger, which is what I tried first.

**Reversal.** Yes: attempted with triggers, reverted, replaced by explicit writes (3.15).

<sub>1.1.1 — `internal/store/migrations/0026_utterances.sql`</sub>

### A column that looks usable is worse than one that is absent

**Decided.** 1.1.0 added `books.updated_at` and `movies.updated_at` and backfilled them, on the reasoning that a client mirroring the library needs them and that adding a column later is more annoying. It did not *write* them: no INSERT set either, and none of the nineteen UPDATE sites across editing, metadata backfill, bulk edit and import bumped them. Every row created since 1.1.0 held NULL and no edit ever moved the value. That is worse than the column being absent, because the first delta-sync client to trust it would silently have missed every edit — an absent column fails loudly at compile or at parse. All twenty-four write sites now maintain it, and rows created since 1.1.0 were backfilled by migration 0022. I approved shipping the column early and I was wrong to; the principle it taught is the one I would keep.

**Instead of.** Dropping the column until a client needed it. In hindsight that was the right answer for 1.1.0.

**Reversal.** Yes, of my own 1.1.0 decision, one release later.

<sub>1.1.1 — `internal/store/migrations/0022_updated_at_backfill.sql`</sub>

### Nullable helpers encode what "unset" means per column

**Decided.** There is no single rule for what an absent value looks like, because `0`, `''` and `NULL` mean different things in different places. So there is a small family of helpers rather than one: `nullable` maps `""` to NULL so the partial unique indexes on `isbn`/`asin`/`tmdb_id` behave, since an absent value is not an identity; `nullableInt` maps `0` to NULL; `nullableCount` is its counterpart for columns where `0` is a value in its own right, as a dialogue's season is, so only a blank reads as unset; `nullableFloat` maps `0` to NULL for `series_index`, where "unset" and "position 0" are not meaningfully distinct in a reading order; `nullableInt64` covers the partial-unique id columns. I approved having five near-identical functions rather than one clever one, because the difference between them is the documentation.

**Instead of.** One generic helper plus a convention. Rejected: the convention is exactly what would drift.

<sub>from 1.0.0, extended as columns were added — `internal/httpapi/server.go`</sub>

### Hard delete everywhere — no tombstones, no soft delete

**Decided.** Deleting a row deletes it, and `ON DELETE CASCADE` takes the children. There are 45 cascade edges across 15 migrations, and a book delete takes seven child tables with it. The reason is one line in PLAN §3 and it is sufficient: there is no external sync partner, so there is nothing to reconcile a tombstone against. A soft-delete flag on a library with no replica buys a filter clause on every read and nothing else. I approved this at plan time.

**Instead of.** A `deleted_at` column on every content table.

**Reversal.** Not reversed, but *supplemented* — see 3.18, which reinstates recoverability without touching this rule.

<sub>from 0.1.0 — `internal/store/migrations/`</sub>

### The bin reinstates recoverability via a snapshot table, not a flag

**Decided.** Every delete in this app is final, and there has never been an undo. That was tolerable while deleting meant one row behind a confirm dialog; it stops being tolerable the moment a selection can delete forty things at once, which is what the release after next wants. The answer is a `trash` table holding a JSON snapshot, and the rows are still really deleted. That is the whole point: nothing else in the app changes, and every query, count, stat and search keeps working untouched. A soft-delete flag would have made every read in the codebase grow a predicate, and the one read that forgot it would be a bug that shows a deleted quote to its owner. I approved the snapshot design over the flag on exactly that argument.

**Instead of.** A `deleted_at` predicate on the five content tables. Rejected on the every-read-grows-a-clause cost and the forgotten-predicate failure mode.

**Reversal.** None yet; nothing is written.

<sub>1.8.0 — `internal/store/migrations/0031_trash.sql` · `internal/httpapi/trash.go` · `internal/httpapi/trash_handlers.go`</sub>

### The trash payload reads its columns from `PRAGMA table_info`

**Decided.** The snapshot is built by reading `PRAGMA table_info` per table rather than by naming columns. A snapshot that lists columns by hand is a snapshot that silently stops carrying the column added next release, and the failure only shows up on a restore, months later, as a field quietly reset to its default. The delayed, silent failure mode is the entire justification, and it is backed by a test that adds a column and expects it to survive the round trip — the claim tested rather than asserted in a comment. I approved this, and I approved the test alongside it, because the claim is worthless without one.

**Instead of.** An explicit per-table column list; rejected on the delayed-failure argument.

<sub>1.8.0 — `internal/store/migrations/0031_trash.sql` · `internal/httpapi/trash.go` · `internal/httpapi/trash_handlers.go`</sub>

### Restore is one entry per user action, and an account shares the table

**Decided.** Deleting a book is one trash row — *The Dispossessed* plus its 40 quotes — restored whole. There is no way to end up with a quote whose book is missing, because there is no way to restore half an entry. Restore is a subtree, not a row. Deleting an account is binned the same way, as a single all-or-nothing entry covering the whole library, and `kind = 'account'` lives in the same table rather than beside it: the purge, the retention setting and the ownership check are the same code for both, and a second table would mean a second place to forget. My call on both halves.

**Instead of.** Per-row trash entries with a restore that reassembles, and a separate table for account deletions.

<sub>1.8.0 — `internal/store/migrations/0031_trash.sql` · `internal/httpapi/trash.go` · `internal/httpapi/trash_handlers.go`</sub>

### `id INTEGER PRIMARY KEY` is a rowid alias, so ids need an allocation floor

**Decided.** Verification turned up something the decision had assumed away. `id INTEGER PRIMARY KEY` is a rowid alias on every one of these tables, so SQLite allocates `max(existing rowid) + 1` and *does* reuse a freed id — but only when the deleted row held the table's highest. That is exactly the common case: you delete the thing you just added. Making ids permanently unique needs `AUTOINCREMENT`, which is part of the column definition, so adding it means rebuilding all five tables — and those five are FK parents with cascading children, precisely the shape `0018_retire_ratings.sql` refused to touch on the grounds that a DROP-TABLE rebuild would cascade-delete the child rows. My recommendation, and the one I approved, is an `id_floor(table_name, next_id)` table with the five create handlers allocating explicitly above the floor. It delivers the decision as taken without rebuilding a single FK parent, at the cost of a new subtlety on every create.

**Instead of.** "original id if free, new id otherwise" (no migration risk, loses the bookmark guarantee in the narrow case), or `AUTOINCREMENT` on all five (permanent, invisible afterwards, needs the five-table rebuild).

**Reversal.** This point is explicitly not yet settled; the rest of the plan is written to be independent of the answer.

<sub>1.8.0 — `internal/store/migrations/0031_trash.sql` · `internal/httpapi/trash.go` · `internal/httpapi/trash_handlers.go`</sub>

### The purge runs at startup and once a day on a request, never on a ticker

**Decided.** Two triggers, no scheduler: immediately after `st.Migrate()` at startup, and once a day on the first request that observes the date has changed since the last sweep, from a date stamp in settings. Nothing to leak, and nothing running on an idle instance — which is PLAN §2's no-pollers rule holding. The semantics that falls out is also the better one: nothing is expiring while nothing is running, so "30 days" means 30 days of the app being alive, which is the honest reading on a self-hosted box that gets switched off. I approved the mechanism for the CPU budget and kept it for the semantics.

**Instead of.** A background ticker goroutine.

<sub>1.8.0 — `internal/store/migrations/0031_trash.sql` · `internal/httpapi/trash.go` · `internal/httpapi/trash_handlers.go`</sub>

### File parking happens last, outside the transaction, and fails safe

**Decided.** `trashAndDelete` does five things in one transaction and the order is the design: read the subtree by following the cascade edges rather than a hand-written list; collect image filenames the way `userCoverFiles` already does, *before* anything is deleted, because the cascade frees rows and not files; write the `trash` row; delete the row and let the existing cascade do exactly what it does today; then move — not copy — the files into `MediaCover/trash/`. The move is last and outside the database's control, so it is the one step that can leave a mismatch, and it is deliberately biased: a parked file with no trash row is garbage the purge collects, while a trash row pointing at a deleted file is a restore that silently loses a cover. I approved that bias explicitly.

**Instead of.** Parking files first, or copying instead of moving.

<sub>1.8.0 — `internal/store/migrations/0031_trash.sql` · `internal/httpapi/trash.go` · `internal/httpapi/trash_handlers.go`</sub>

### Only the five content kinds get a bin

**Decided.** Book, movie, annotation, dialogue and standalone quote go to the bin. Tags, people, stickers and avatars still delete outright, because a tag is vocabulary and a person is a reference row — deleting either is a change to how the library is organised, not a loss of what is in it, and both are cheap to recreate. Of the ten delete handlers in `internal/httpapi/*_handlers.go`, five are in scope. I drew that line and I approved it.

**Instead of.** Binning everything, which would have made the payload builder handle four more shapes for no recoverable loss.

<sub>1.8.0 — `internal/store/migrations/0031_trash.sql` · `internal/httpapi/trash.go` · `internal/httpapi/trash_handlers.go`</sub>

### The FTS-restore worry was unfounded

**Decided.** An earlier draft of the bin plan budgeted work for reindexing after a restore. Verification killed it: the `_ai` / `_ad` / `_au` triggers from `0001_init.sql` and `0003_movies.sql` already cover insert and delete on every content table, so a restore that re-inserts rows reindexes for free. I am recording it rather than deleting it, because the draft was wrong in a specific and instructive way — 1.7.1 genuinely *was* bitten by an external-content index, so the caution was not irrational, just misapplied. I approved striking the budgeted work once the triggers were checked.

**Instead of.** An explicit rebuild step after restore, which would have been dead code.

**Reversal.** Yes: a planned work item removed before it was written.

<sub>1.8.0 — `internal/store/migrations/0031_trash.sql` · `internal/httpapi/trash.go` · `internal/httpapi/trash_handlers.go`</sub>

### A delete is a snapshot in a bin, not a flag on the row

**Decided.** The five content kinds and a whole account go to `trash` (migration 0031) as a JSON snapshot of their subtree; the rows are then really deleted, cascades and triggers and all. Restoring re-inserts them. Retention is a per-user preference, swept at boot and once a day.

**Why.** The alternative is a `deleted_at` column, and it costs a predicate in front of every query, count, stat, export, dedupe check and FTS trigger in the app — forever, on every future one too. The failure mode is not a crash: it is a deleted quote turning up in a quiz six months later because one query out of two hundred forgot the clause. With a snapshot, nothing else in the schema changes and nothing else in the application knows the bin exists.

The cost is real and named: a snapshot is a copy, so it can be incomplete in ways the live row cannot. That is why the payload's COLUMNS are read from `PRAGMA table_info` rather than listed in Go, and why there is a test comparing a payload's keys against the table's own columns.

**Instead of** a soft delete, above. **Instead of** an export-and-reimport round trip, which loses everything the exporter does not carry — ids, review schedules, sticker positions — and would make "undo" mean "something quite like it".

**Approved.** Mine, and I approved shipping it BEFORE the features that need it: bulk delete is only a reasonable thing to offer once every delete is recoverable.

<sub>1.8.0 — `internal/store/migrations/0031_trash.sql` · `internal/httpapi/trash.go` · `internal/httpapi/trash_handlers.go` · `CHANGELOG.md`</sub>

### What travels with a deleted thing is DECLARED, because the foreign-key graph is incomplete

**Decided.** The writer carries a hand-listed set of tables per kind — the row, its quote children, their tag joins, the tag and genre ROWS by name, `item_reviews` and `work_reads` — rather than walking `PRAGMA foreign_key_list`.

**Why.** The FK walk is the obviously-robust choice and it silently loses data here. `item_reviews` is polymorphic `(kind, item_id)` and `work_reads` is `(kind, work_id)`; neither can hold a real foreign key to three parents, so both are cleared by AFTER DELETE TRIGGERS instead (0015, 0024, restated in 0029). A walk of the FK graph finds neither, and the restore that follows looks perfect: the book is back, the quotes are back, and a year of review history is quietly a new card. Nothing throws and nothing logs.

Tags and genres travel by NAME as well as by id for a related reason: both outlive the rows that used them — a tag is managed vocabulary, and a genre is garbage-collected when its last work goes — so between the delete and the restore an id can be gone or belong to something else. The name is the stable thing.

**Instead of** the FK walk, and this entry exists mostly to argue against it, because it is what the next person will reach for and for good reasons.

**Approved.** Mine, on the strength of the verification rather than the plan: the plan said "follow the cascade edges rather than a hand-written list", and the schema disagreed.

<sub>1.8.0 — `internal/httpapi/trash.go` · `internal/store/migrations/0031_trash.sql` · `internal/httpapi/trash_test.go` · `AI.md`</sub>

### Ids are never reused, via an allocation floor rather than AUTOINCREMENT

**Decided.** `id_floor(table_name, next_id)` is a high-water mark the create paths allocate above, for the five binnable tables. Nine create paths take an id explicitly; the three import loops take a block per batch. A restore raises the floor past everything it puts back.

**Why.** `id INTEGER PRIMARY KEY` is a rowid alias, so SQLite hands out `max(rowid) + 1` — which reuses a freed id whenever the deleted row held the table's highest, and that is the common case rather than an edge one: you delete the thing you just added. A bin holding that row's snapshot then cannot put it back.

The two alternatives were worse in opposite directions. AUTOINCREMENT is a column definition, so adding it means rebuilding five foreign-key parents with cascading children — precisely the migration class 0018 refused to attempt, and the most dangerous kind in this repo. Renumbering on restore means an id remap across every child row and join table, running on the one code path whose entire purpose is putting things back exactly as they were.

It also closed a bug older than itself: `item_reviews` is keyed `(kind, item_id)` with no FK, so a reused annotation id inherited the deleted quote's half-life, review count and lapse count.

**Instead of** "original id if free, a new one otherwise", which needs no migration and no create-path changes — and hands the id remap to the restore anyway, which is where it can do the most damage.

**Reversal.** This settles the open question the plan left open, in favour of its own recommendation.

**Approved.** Mine. The cost is a new subtlety on nine create paths, and the test is behavioural — create, delete, create, compare — because a test that asserted "the code calls nextID" would pass for a call that passes the wrong table name.

<sub>1.8.0 — `internal/httpapi/id_floor.go` · `internal/httpapi/id_floor_test.go` · `internal/store/migrations/0031_trash.sql` · `CHANGELOG.md`</sub>

### The retention sweep has no scheduler, and "never" is -1

**Decided.** The purge runs once at boot and then at most once a calendar day, from whichever authenticated request is first after midnight — a date stamp in `settings`, checked in `requireAuth`. The window is a per-user preference of 7, 30, 90, or **-1** for never.

**Why.** A ticker means a goroutine and a wakeup on a machine that is otherwise asleep, which is the frugality budget this whole app is built inside. It also means "30 days" would be a promise made by a program that is not running: a self-hosted box gets switched off, and thirty days OF THE APP BEING ALIVE is the honest reading.

The stamp is written BEFORE the sweep, not after: two requests can arrive in the same millisecond after midnight, and the loser should do nothing rather than run a second concurrent sweep over the same rows.

`-1` for never is the subtle half. Preferences are one JSON blob with defaults applied on read, so a field nobody has set unmarshals to 0 — if 0 meant "never", every account that predates the bin would read as never-expire and the purge would never run for any of them. 0 stays "not saying" on the way in too, so a client can PUT the whole preferences struct without knowing this field exists.

**Instead of** a cron entry or a background goroutine (the budget), and instead of one instance-wide window (the setting is per person, so the sweep asks each owner).

**Approved.** Mine, including the -1, which I would defend hardest: it is the difference between a feature that works on a fresh install and one that works on every install.

<sub>1.8.0 — `internal/httpapi/trash.go` · `internal/httpapi/auth_handlers.go` · `cmd/tippani/main.go` · `internal/httpapi/trash_purge_test.go`</sub>

### An account entry belongs to the admin who deleted it

**Decided.** Deleting a member bins the account, its library, its vocabulary, its review history and its files as one entry in the DELETING ADMIN's bin. Restoring is admin-only and refuses with a 409 that names the clash when the username has been taken since. Sessions, device tokens and quiz sessions are the three user-owned tables deliberately not restored.

**Why.** `trash.user_id` is whose bin a row sits in, and it cascades with that user — so an account entry in the deleted user's own bin would be removed by the same statement that made it necessary. Putting it in the admin's bin also puts it with the person allowed to undo it, so the ownership and the permission are one fact rather than two rules.

The three exclusions are credentials or scratch: a session or a device token that out-survives the account it belonged to is a credential nobody chose to reissue, and pairing a phone again is one scan. A quiz session is a day's state.

The table list is declared, like every other snapshot here, and the test that matters asks the SCHEMA for every table with a `user_id` column and fails when one is in neither list — because otherwise adding a table next release means a deleted account silently drops it, and the loss surfaces on a restore months later.

**Approved.** Mine, and I approved the exclusions individually rather than as a category.

<sub>1.8.0 — `internal/httpapi/trash.go` · `internal/httpapi/admin_handlers.go` · `internal/httpapi/trash_account_test.go`</sub>

## 4. What a Quote Is

Three kinds of quote — a book highlight, a screen line, and one belonging to no work at all — converged on a single shape whose differences are enumerated rather than incidental. The dedupe rules and the colour vocabulary are where most of the schema pain lives.

### Dialogues shipped without colour, tags or importers

**Decided.** When films arrived, a dialogue carried `timestamp`, `character` and `actor` in place of chapter and location, and deliberately had no colour, no tags and no importers.

**Why.** V3 of this plan says it in as many words: "not needed — YAGNI". I thought a film line was a different kind of object from a book highlight, and that nobody highlights a film in four colours.

**Reversal.** Wrong, and the rest of this section is the repair bill. Tags came later, colour in migration 0021, `noted_at` and `source` in 1.1.0, and importers after that. What I got wrong was not the individual omissions but the premise: each gap stayed invisible until somebody went looking for a feature on the wrong kind of quote.

**Approved.** Mine, and I approved it at the time on exactly the reasoning above.

<sub>Pre-1.0, in §3b as first written — `docs/PLAN.md` · `CHANGELOG.md`</sub>

### Annotations and dialogues collapse to one shared shape

**Decided.** Both kinds embed a common `quoteReq`/`quoteRow` (`internal/httpapi/quote.go`) — quote, note, colour, favourite, tags, stickers, `noted_at`, `source` and review state — and differ in exactly one respect: how a quote points back at its source. `TestQuoteKindsShareTheirFields` pins the boundary, requires the embed to be anonymous so the wire format stays flat, and **walks embedded structs rather than skipping them**.

**Why.** Writing the two sides separately is what let them drift. The flattening rule is the load-bearing detail: `episodeRef` arrived as an embed and would otherwise have carried `season` and `episode` onto one kind unseen, which is precisely the failure the test exists to prevent. `AI.md` records the earlier version skipping embeds and staying green while two fields rode past it — found by reading the test, not by running it.

**Approved.** My call, and I stand by it; the test is the half of the decision I care about.

<sub>1.1.0, with the embed-flattening correction after it — `internal/httpapi/quote_parity_test.go` · `docs/PLAN.md` · `AI.md`</sub>

### Dialogue gained colour, noted_at and source; existing lines land on yellow

**Decided.** Migration 0021 gave dialogues the same four-value `color` CHECK annotations had; 1.1.0 added `noted_at` and `source` to both quote kinds. Every line already on disk was backfilled to `yellow`.

**Why.** These were the holes the 0003 near-copy left, and filling them made "mirror" literal rather than aspirational. Yellow is the column default and what an import writes when the source named no colour, so backfilling to it asserts nothing about the line — "nothing looks categorised that wasn't."

**Approved.** I approved this, including the yellow backfill, which was the only part with a wrong answer available.

<sub>1.1.0 — `CHANGELOG.md` · `internal/store/migrations/0021_dialogue_color.sql`</sub>

### One deliberate asymmetry: note-only is a book's privilege

**Decided.** `annotations` keeps `CHECK (quote IS NOT NULL OR note IS NOT NULL)`. `dialogues.quote` and `utterances.quote` are `NOT NULL`.

**Why.** A thought about a page with no passage attached is a real annotation. A thought about a film belongs on the film, not on a line nobody said. 0026 puts the third kind bluntly: "An utterance with no words is not a quote by anything it could mean."

**Instead of.** Making all three note-capable for symmetry — rejected, since the symmetry would have been the point rather than the behaviour.

**Approved.** Mine. I signed this off as the one difference worth keeping after the parity work removed every other one.

<sub>1.1.0, extended to the third kind in 1.5.0 — `docs/PLAN.md` · `internal/store/migrations/0026_utterances.sql` · `internal/store/migrations/0029_six_colours.sql`</sub>

### A quote with no book and no film gets a third table

**Decided.** Migration 0026 adds `utterances` rather than making `annotations.book_id` nullable. The UI says "Quotes"; the table says `utterances` because `quote` is already taken by the shared shape, and a `quotes` table would read as the parent of the other two rather than a sibling.

**Why.** The nullable model is genuinely cheaper and I costed it before refusing it: every existing query joins `books` to scope by user, so parentless rows would be excluded automatically and roughly forty call sites would have kept working untouched. It was rejected because it makes `annotations` mean two different things, shares one id space between them, and freezes the busiest table in the schema behind a CHECK a future change can only alter with another full rebuild.

**Instead of.** The nullable `book_id` — cheaper, costed, rejected. The named cost of refusing it is written into the migration: ownership becomes explicit rather than inherited, "the single largest source of risk in the feature".

**Approved.** I took this call and approved it knowing which of the two was cheaper.

<sub>1.5.0 — `internal/store/migrations/0026_utterances.sql`</sub>

### user_id on utterances is the ownership path, and it is load-bearing

**Decided.** `user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE`, with every single query against the table carrying its own `WHERE user_id = ?`, and an ownership case in the tests per endpoint.

**Why.** For the other two kinds, `JOIN books b ON b.id = a.book_id WHERE b.user_id = ?` is simultaneously the parent join and the access check — there is nothing to select from without it, so forgetting the scope is impossible. An utterance has no parent, so that net does not exist, and a missed scope is a cross-account leak rather than a hidden row. This repo treats per-user isolation as a security property: a foreign row answers 404, never 403.

**Approved.** Mine, approved with the risk written into the migration header rather than left for someone to discover.

<sub>1.5.0 — `internal/store/migrations/0026_utterances.sql` · `internal/store/utterances_test.go`</sub>

### A chapter's number and its name are two fields, and no migration guesses which is which

**Decided.** 0044 adds `annotations.chapter_no REAL` (and the same column on `staged_quotes`); `chapter` keeps its name and becomes the chapter's NAME. Both optional, independently. One formatter renders the pair wherever it is printed — `chapterHeading` in Go, `chapterLabel` in `text.js` — and the two produce the identical string, `7 · The Fall`.

**Why one text field was not enough.** It was holding two facts, and the evidence was already in the interface: the capture form's placeholder read *"e.g. 3"* under a label saying **Chapter**, so the app was asking for a number and filing it as a name. The consequences were a table column that sorted chapter 10 between 1 and 2, three separate copies of the heuristic `/^\d/.test(ch) ? 'CH. ' + ch : ch` — one per screen, each guessing which of the two facts it had been handed — and a reader who wanted both having to invent punctuation and then retype it identically forever.

**REAL, not INTEGER**, for the reason `series_index` is: 12.5 is where an interlude, an appendix or a part boundary goes, and a column that cannot hold one pushes the reader back into the text field this exists to empty. Zero means absent, which is that column's convention one table over; the stated cost is that a chapter deliberately numbered 0 has to live in the name.

**Nothing is backfilled, and that is the whole of the risk management.** Every existing row holds a number, a name or both in whatever punctuation its reader or its importer chose, and nothing records which. A migration parsing `"3. The Fall"` into `3` + `"The Fall"` would be right most of the time and silently wrong for a chapter named `"1984"` or a locator like `"3:16"` — and a wrong value written by a migration carries the authority of having been migrated. That is 0042's argument about the game publisher, applied unchanged. Existing values stay whole, in the name.

**The separator is the round trip, and the printed convention could not be it.** A book export writes the pair as its `## ` heading and the importer reads that heading back, so the join has to be unambiguous. `7. The Fall` — how a book prints it — cannot be parsed once numbers may be fractional: `7.5` is either chapter 7.5 or chapter 7 named "5", and no rule can tell. The middle dot this app already uses to join facts has no such collision, and a number cannot contain one.

**One heuristic was unavoidable and it is bounded.** A heading that is nothing but a small number — `## 7` — is read as a number, because that is what the export writes for a numbered chapter with no name and that is most chapters; without it the commonest shape would be the one that cannot come home. `chapterNoCeiling = 1000` is what keeps it from swallowing a numeric NAME (`## 1984`, `## 2001`): no book has a thousandth chapter and every year-shaped title is above it. Deliberately tighter than the 10,000 the API refuses at, because the two are different jobs — one rejects what a person typed in the wrong box, the other resolves an ambiguous string with nobody to ask. A consequence worth stating: an older file whose chapter was the text `"3"` re-imports as the *number* 3, which is the same fact in the right field and the only place anything here moves existing data.

**What is deliberately not parsed:** `## 3. The Fall`, `## Chapter 7`, `## 1984` and `## 3:16` all stay names, whole, exactly as before 0044 — asserted by a test, because a parse tuned to the exporter's own output is how a reader's hand-written file gets mangled. The anthology importer makes the same argument about not splitting an em dash out of a heading.

**One rule for what a number may be**, in `chapterNoProblem`, shared by the single-quote form and both bulk editors — a number the details form accepts and the selection bar refuses is a rule nobody can learn. The bulk path refuses junk rather than letting `nullableMeasure` null it, because clearing the chapter number on forty rows and reporting success is the worst answer available.

**Approved.** The reader's, who asked for it as *"separate chapter number and chapter names, both optional"*, chose REAL-with-decimals over free text or integers, and chose to leave existing values alone rather than split what parses.

<sub>2.0.1 — `internal/store/migrations/0044_chapter_number.sql` · `internal/httpapi/annotation_handlers.go` · `internal/httpapi/export_handlers.go` · `internal/importer/markdown.go` · `web/frontend/src/text.js`</sub>

### The dedupe hash excludes the locator — except where the locator identifies

**Decided.** `DedupeHash` is `sha256(lower(collapse_ws(fold_punct(text))))` with chapter, location and timestamp excluded. `DialogueDedupeHash` folds season and episode in. `UtteranceDedupeHash` folds speaker, occasion and occasion date in, and leaves place and medium out.

**Why.** A book is one work and a passage in it is one passage, so excluding the locator is what keeps re-importing a growing `My Clippings.txt` a no-op. A series is one `movies` row holding a whole run, so a line is located *by episode* — before 1.3.1 the second occurrence of a catchphrase hit `UNIQUE (movie_id, dedupe_hash)` and was silently folded into the first, or worse relabelled it with the newer episode through the importer's COALESCE enrichment. For an utterance the occasion discriminates outright: the same words said on two occasions are two quotes. Place and medium stay out because they are the fields refined afterwards — Burma to Rangoon, radio to Azad Hind Radio — and folding them in would make each refinement fork a duplicate instead of enriching the row already there.

**Instead of.** Folding the whole occasion in — rejected, with the cost of refusing it stated: the same speaker giving the same line at two rallies on one date in different places collapses to one quote. Rarer than the typo, and recoverable by editing.

**Approved.** Both inversions are mine and I approved each separately, a release apart.

<sub>1.3.1 and 1.5.0 — `internal/store/hash.go` · `CHANGELOG.md`</sub>

### Normalise each field, then join

**Decided.** `normalizeQuoteText` is its own function, and every field goes through it *before* the `\x1f` join, never after.

**Why.** Normalising the joined string puts the separator inside the run being collapsed. `strings.Fields` then treats a space beside `\x1f` as a token boundary, so `"freedom\x1fsubhas"` and `"freedom \x1f subhas"` are different strings and a trailing space in a form field produces a second copy of the quote on the next import. It was a live bug in `DialogueDedupeHash` and a caught-in-review one in `UtteranceDedupeHash` — caught by a test I wrote expecting it to pass.

**Approved.** I approved the shared helper rather than a second local fix, because two hashes spelling the same rule differently is how they diverge.

<sub>1.5.0 — `internal/store/hash.go`</sub>

### The re-hash repair runs in Go on every Migrate, unguarded and idempotent

**Decided.** `BackfillDialogueHashes` rewrites `dedupe_hash` wherever a row carries an episode and still holds the old text-only hash. It runs from `Migrate` rather than from a migration file, is deliberately unguarded and re-run every time, and a row whose UPDATE hits the UNIQUE is logged and skipped.

**Why.** SQLite has no `sha256`, so the value can only be computed in Go. Unguarded is what makes it idempotent and self-healing on all four `Migrate` paths, including the two repair paths that copy base tables into a fresh database and could otherwise carry stale hashes back in past a one-shot flag. The skip matters more: this runs from `Migrate`, so a returned error means the application does not start, and refusing to boot over a pair of near-identical quotes is a far worse outcome than leaving one of them on its old hash. The consequence of skipping is bounded and visible — that row can still be duplicated by a future import, exactly as it could before.

**Instead of.** A settings-flag guard so it runs once — rejected; it would have defeated the two restore paths.

**Approved.** My decision on both halves, and I approved the log-and-skip after 1.5.0 made a collision possible for the first time.

<sub>1.3.1, amended in 1.5.0 — `internal/store/hash.go` · `CHANGELOG.md`</sub>

### A known whitespace flaw was recorded and deliberately not fixed in the same commit

**Decided.** Commit `06e75c3` shipped `UtteranceDedupeHash` and recorded, under a heading reading "FOUND WHILE HERE, NOT FIXED", that `DialogueDedupeHash` carried the same trailing-whitespace flaw and that it was reachable — the import paths hash the parsed text directly while the API trims, so one line arriving from a file with a trailing space and from the capture form becomes two rows. It was fixed in 1.5.0 instead.

**Why.** The repair moves the hash in the *less* discriminating direction for the first time. `BackfillDialogueHashes` justified itself on the new hash being strictly more discriminating than the one it replaced; normalising first breaks that, two rows differing only in trailing whitespace converge, the UPDATE hits `UNIQUE (movie_id, dedupe_hash)`, `Migrate` fails and the app does not start. Fixing it needed a backfill that resolves collisions by deleting rather than updating, which is its own change with its own risk, and it should not ride along inside a feature.

**Approved.** Mine — I approved shipping a known defect with the reasoning written down, which I would rather do than fix two things in one commit.

<sub>Recorded at 1.5.0's groundwork, fixed in 1.5.0 — `internal/store/hash.go`</sub>

### The stored colour token never moves

**Decided.** `yellow|blue|pink|orange|green|purple` stays the value in every table and every Markdown export. What a slot is called, what it looks like and whether it is offered are all presentation.

**Why.** A rename must not be able to break a round trip. There is a test whose entire job is to prove an export is byte-identical before and after one, because a year of highlights that stopped importing would be discovered by the person re-importing them.

**Approved.** I approved this as the precondition for the whole feature — the naming was only worth building because it could not touch stored data.

<sub>1.7.0 — `web/frontend/src/theme.js` · `CHANGELOG.md`</sub>

### Slot 1 is the unset default: recolourable, never nameable, never hideable

**Decided.** The server refuses both a name and a hidden flag on the first slot. Its hex is the reader's to change. `CATEGORY_DEFAULT_NAME` starts with an empty string, and its label is `UNSET_LABEL` — "Uncategorised".

**Why.** It is the column default *and* what an import writes when the source gave no colour, so a yellow quote may be yellow because you chose it or because nobody chose anything. Nothing can tell those apart, and naming it would silently label every unmarked quote ever imported. Colour is presentation, so recolouring it costs nothing.

**Reversal.** The original roadmap note did not see this. I had filed naming the colours as an afternoon's work with no edge cases in it. That note left the roadmap when the feature shipped, which is why the correction is recorded here instead of beside the prediction.

**Approved.** My call, made once the first import was staged against it, and I approved the correction to the roadmap rather than editing the prediction out.

<sub>1.7.0 — `web/frontend/src/theme.js` · `docs/roadmap.html` · `CHANGELOG.md`</sub>

### Hiding a category never edits a quote

**Decided.** Putting a colour away removes it from pickers; a quote already wearing it keeps the colour, the name and the swatch.

**Why.** The alternative is the app editing your library to match a preference you were not thinking about it with.

**Instead of.** Reassigning or clearing quotes on hide — rejected.

**Approved.** Mine, and I approved it as the whole point of the hidden flag being presentation rather than data.

<sub>1.7.0</sub>

### "Six colours is zero schema" was wrong

**Decided.** Migration 0029 widens the CHECK by rebuilding five tables: `annotations`, `dialogues`, `utterances`, `staged_quotes` and `tags`.

**Why.** Naming the colours was zero schema, as predicted. Growing the *set* was not. `color` carries a `CHECK (color IN (…))` on five live tables and SQLite cannot alter a CHECK. Three of them are foreign-key parents with cascading children and `PRAGMA foreign_keys` is a no-op inside a transaction — every migration runs inside one — so the join rows are parked in backup tables and restored after the rename, since losing them would silently untag a whole library and no error and no row count would notice. Three back external-content FTS5 indexes whose triggers vanish with the table, so the index rebuild is the last statement for each. `DROP TABLE` fires no triggers but does cascade, which is why the joins need parking and the FTS index does not self-empty. Ids are carried across verbatim, because everything pointing at a quote matches by id. `tags` is the fifth and the table 0018 explicitly declined to rebuild; it could not be left out, because `tags.color` is validated by the same allowlist the quote colours use, so widening one and not the other turns a green tag into a 500 on a valid request.

**Reversal.** Of my own roadmap note, which had recorded naming the colours as costing zero schema. That much held. Growing the set did not, and the prediction is kept here beside what actually happened rather than quietly edited out.

**Approved.** I approved this one after reading the migration line by line; it is the most dangerous migration in the project and I would not have signed it off on a summary.

<sub>1.7.1 — `internal/store/migrations/0029_six_colours.sql` · `docs/roadmap.html` · `CHANGELOG.md`</sub>

### Colour slots are append-only and their order is frozen

**Decided.** `CATEGORY_SLOTS` is `['yellow','blue','pink','orange','green', 'purple']` and never reorders; `green` and `purple` were appended by 0029.

**Why.** Slot N is `--hl-N` in the stylesheet and always has been, and the token in slot N is the token stored on every row that wears it. Reordering would silently recolour every quote in the library. The migration states the same rule from its own side: "The new tokens are appended, never reordered: 'yellow' stays the column default."

**Approved.** Mine; I approved append-only as a standing rule rather than a one-off, so the next widening has nothing to decide.

<sub>1.7.1 — `web/frontend/src/theme.js` · `web/frontend/src/index.css` · `internal/store/migrations/0029_six_colours.sql`</sub>

### A category name is fifteen runes, down from twenty-four

**Decided.** `CAT_NAME_MAX = 15`, counted in code points, mirrored by `catNameMax` in `auth_handlers.go`, which refuses a longer name rather than storing a cut-off one. `capCategoryName` slices by code point, not UTF-16 unit, because a `.slice()` can cut an astral character in half and leave a lone surrogate — one unit to JS, one rune to Go, and a validation failure with no on-screen explanation.

**Why.** These are labels. They ride a swatch tooltip, a filter chip, a group heading and the Stats breakdown's label column, and none of those has room for a sentence. Twenty-four was a number nothing was built for: the breakdown's column could not hold one and ellipsised instead, which is a chart truncating the very categories it is breaking down. Fifteen is what that column holds outright, so the cap and the layout agree. Every built-in name fits with room to spare — "Inspirational" is 13, "Uncategorised" 13. The constant lives in `theme.js` rather than in `Settings.jsx` because `StatsPage` sizes its label column from it, and a cap the layout is cut for has to be a cap the layout can see.

**Reversal.** Of my own 24, which I had picked without checking what read it.

**Approved.** My call, and I approved it as the cap moving to meet the layout rather than the layout apologising for the cap.

<sub>Unreleased as of 1.7.6 — `web/frontend/src/theme.js`</sub>

### The category palette leaves the app's accent neighbourhood alone

**Decided.** `CATEGORY_PALETTE` is sixteen curated swatches, disjoint from the theme accents by construction, held there by `palette.test.jsx`.

**Why.** A free hex field produces libraries nobody can read at a glance — the point of a category colour is that six of them are instantly distinguishable, and that survives about as long as the first two near-identical blues. Disjointness is not merely avoiding the four exact accent values: the whole ochre / terracotta / olive / slate neighbourhood is left alone, so a category can never be mistaken for an accent. It is pinned by a test because "these look different enough" is exactly the kind of judgement that quietly stops being true when somebody adds a seventeenth swatch.

**Instead of.** A free hex input — rejected.

**Approved.** I approved the curated list and the test together; the list on its own would have decayed.

<sub>1.7.0 — `web/frontend/src/theme.js` · `web/frontend/test/dom/palette.test.jsx` · `CHANGELOG.md`</sub>

### Tags are one per-user vocabulary across every medium, with no auto-GC

**Decided.** One `tags` table per user, joined by `annotation_tags`, `dialogue_tags` and `utterance_tags`. Colour and style columns since 0005. Names are trimmed, capped at 64 runes and deduped case-insensitively; `setTags` and the importers auto-create unknown names with the yellow/sticker defaults. A tag that drops to zero usage keeps its colour and style until `DELETE /tags/{id}`, and the join rows cascade from there.

**Why.** One vocabulary is what makes "grief" mean the same thing on a book highlight, a film line and a speech. The garbage collector went because a tag is a vocabulary entry, not a join count: sweeping it at zero usage throws away the colour and the style you set the first time you used it, and you find out the next time you use the name.

**Approved.** Mine, and I approved removing the GC rather than making it smarter about what it kept.

<sub>0.x, GC removed with the managed vocabulary — `docs/PLAN.md` · `internal/store/migrations/0026_utterances.sql`</sub>

### Nested tags are a display convention, not a parent id

**Decided.** `theme/grief`, displayed hierarchically over the existing `name` column. Planned, not built.

**Why.** No schema change and no migration to regret. A parent id buys a real tree and costs a table rebuild on a foreign-key parent of three cascading join tables — the exact shape this project keeps calling its most dangerous migration class.

**Approved.** My call, recorded on the roadmap before anything was written so that the cheap shape is the one already agreed.

<sub>Not shipped — `docs/roadmap.html`</sub>

### Ratings retired in two stages, with two dead columns deliberately left

**Decided.** 0.4.3 removed the 1–5 stars from the UI and left them stored. 0.8.5 removed them from every request and response, the `min_rating` list filter, the importers, the Markdown bindings and Stats, and migration 0018 dropped the `rating` column from `annotations` and `dialogues` by table rebuild, preserving tags, the repetition schedule and full-text search. `books.rating` and `movies.rating` stay as inert dead columns.

**Why.** The favourite ♥ is the one keep/love signal and two of them is one too many. The columns stayed on `books` and `movies` because those tables are foreign-key parents, and rebuilding them to drop a hidden column would risk the library — a dead column costs a few bytes and a comment; a bad rebuild costs everything under it.

**Approved.** Mine at both stages. I approved leaving the two columns rather than tidying them, and the schema comment says they are inert so nobody reads them as live.

<sub>0.4.3 and 0.8.5 — `CHANGELOG.md` · `docs/PLAN.md`</sub>

### Reviving a rating is recorded as a reversal to weigh, not as planned work

**Decided.** Filed under Later / maybe as a reversal to weigh. If it ever comes back it is per-user and opt-in, so the default library looks exactly as it does now.

**Why.** The stars were retired on purpose and ♥ is the cleaner signal — but half-stars are the single most-cited feature of the trackers people arrive from, and the columns are still there, inert, from before the drop. Filing it as planned work would pretend my original decision was a mistake; filing it as nothing would pretend the request does not exist.

**Approved.** My call to keep it visible and unpromised, and I approved the wording that says so.

<sub>Not shipped</sub>

### Uploaded stickers replaced the tag-derived wax seal

**Decided.** Migration 0011 adds a per-user `stickers` table of transparent PNG/SVG images managed on the Tags page, one attachable per quote, referenced `ON DELETE SET NULL`. Migration 0009 had already added `sticker_x` / `sticker_y`, storing the seal's centre as a fraction of the quote block's **width**.

**Why.** The tag-derived seal was only ever a CSS stand-in for a real sticker. `ON DELETE SET NULL` means deleting a sticker clears the seal from the quotes that used it and the quotes themselves survive. The position is width-normalised so the coordinate is stable however the text reflows around it; `NULL` means unplaced and the UI falls back to the top-right corner, which is exactly the pre-drag behaviour.

**Approved.** I approved both migrations, and specifically the width normalisation over storing pixels, which would have been wrong on the second device.

<sub>0.x — `internal/store/migrations/0009_sticker_pos.sql` · `internal/store/migrations/0011_stickers.sql`</sub>

### Five starter stickers, seeded as ordinary rows and backfilled once per instance

**Decided.** A heart, a star and three faces ship as embedded SVGs. On account creation — and once, at boot, for accounts that predate the feature — each is copied into that user's own `MediaCover` store with `StoreImage` and inserted into `stickers` exactly like an upload. They are indistinguishable from uploads afterwards: renameable, deletable, served by the cover route, carried in a backup, removed with the user. The backfill is guarded by the `seeded_stickers_v1` key in `settings`.

**Why.** The feature shipped upload-only, so the first thing it asked of a new reader was to go and find a transparent PNG. Five in the box means a seal can be pinned to a quote in the first minute, which is the only way anybody finds out what the seal *is*.

The reason they are ordinary rows rather than built-in ids is the count of places that would otherwise need a branch: the cover serve route, the picker, rename, delete, the annotation/dialogue foreign key, user deletion, and the backup archive. A negative or reserved `sticker_id` would have bought a few kilobytes per account and cost a special case in every one of them, each of which is a place to forget it.

The flag is the whole safety argument for the backfill. Without it the sweep runs on every boot, and a starter sticker somebody deliberately deleted is back after the next restart — a bug that reads as the app not saving anything, and one nobody would report as a sticker bug. The flag is set even where an individual copy failed: a full disk or a read-only volume does not clear up by being retried a thousand times, and `TIP-STICKER-002` is the honest signal instead.

**Instead of** a store migration. Migrations run against the database alone, and this writes image files into the cover store — that is the server's business, not the schema's, and a migration that needed `DataDir` would be the first one to know where the data directory is.

**Approved.** Mine, including the choice to seed rather than to ship a built-in kind.

<sub>1.7.9 — `internal/httpapi/seed_stickers.go` · `internal/httpapi/assets/stickers/` · `internal/httpapi/auth_handlers.go` · `internal/httpapi/admin_handlers.go` · `cmd/tippani/main.go` · `internal/httpapi/seed_stickers_test.go` · `CHANGELOG.md`</sub>

### Per-user UI preferences are one JSON blob; app-wide settings are their own table

**Decided.** Migration 0005 adds `users.preferences TEXT NOT NULL DEFAULT '{}'` and a separate `settings(key, value)` table.

**Why.** A preference belongs to a person and is read whole on every `GET /auth/me`, so one blob with defaults applied on read costs one column and no migration per new key, and `PUT /auth/me/preferences` is a partial merge. A metadata API key belongs to the instance rather than to a reader, there is exactly one of each, and the server never sends a stored secret back — a key/value table is the honest shape for that and keeps it out of a document the browser is handed on every login.

**Approved.** Mine, and I approved the split rather than folding the keys into the same blob for convenience.

<sub>0.x — `internal/store/migrations/0005_ui_prefs.sql` · `docs/PLAN.md` · `CHANGELOG.md`</sub>

### A board is a work, and /quotes is a two-level screen like the other two

**Decided.** The three-board segmented control shipped in 1.13.0 is **withdrawn**. Boards become rows the reader owns, listed on `/quotes` the way books are listed in the Library and films in the Catalogue, each opening its own page at `/quotes/{id}`. The reader creates as many as they like. Called **boards**, on screen and here.

**Why, and it is my error rather than a change of mind.** I built the board as a filter. It is not one: a filter narrows what you see *within* a container, and the board decides which container you are in. Everything that went wrong followed from that single misclassification — `WorkListScaffold` renders the `leading` slot inside the **Filters sheet** on a phone, so the three boards were invisible on the device the app is designed for first; and it gates that whole row on `hasItems`, which `Quotes.jsx` passes as *the current board is non-empty*, so switching to an empty Speeches board **removed the control that got you there**. `tippani:quotes:category` is persisted, so a reload did not rescue you. A reader on a phone saw a screen identical to 1.12, which is exactly what was reported.

Neither is a bug to patch. A control that belongs above the list was placed in the drawer that narrows the list, and the fix is to stop calling it a filter.

**What this buys beyond the fix.** The route falls out for free (a board's page is a work's page), capture inside a board files into that board exactly as capture inside a book does, and the vocabulary stops being three names the code knows.

**Approved.** The reader's, in the form "proverbs, speeches, and others (user can create other boards) sit in the quotes page like works do in libraries."

<sub>Not shipped — supersedes the 1.13.0 board toggle</sub>

### One board per quote, and the three that exist now are seeded and then ordinary

**Decided.** `utterances.board_id` replaces the fixed `category` column: one board per quote, like a book on a shelf. Migration seeds **Proverbs**, **Speeches** and **Others** from the three existing values and then knows nothing further about them — all three are renamable, deletable and reorderable. A board carries a name, a colour, a description and a **picture**, uploaded or pasted like a cover; nothing fetches one, because no supplier has a picture of a board.

**Why single membership.** It is the honest evolution of a column that already held one value, the counts add up to the total, and moving a quote is a move rather than a copy. Many-to-many was considered and refused for a specific reason: it is what **tags** already are, and two overlapping ways to group the same rows is worse than either alone.

**Why nothing in the code may know their names.** The moment `Others` is special-cased, renaming it breaks the special case silently. Where a fallback board is genuinely needed — the global ＋, and an import with no board named — it is the reader's **default board**, held as a preference pointing at a row, set to Others by the migration and changeable afterwards.

**Approved.** The reader's: "One board, like a book on a shelf" and "Seeded, then ordinary", with a picture "like a work has a cover".

<sub>Not shipped</sub>

### Deleting a board asks where its quotes go, which is why no board has to be permanent

**Decided.** Deleting a board that holds quotes offers the other boards and moves them; it cannot proceed until one is chosen. A board with nothing on it deletes freely. The consequence is accepted deliberately: **you cannot delete your last board while any quote exists**, because there would be nowhere for its quotes to go.

**Why this rather than a permanent Others.** A permanent bucket is a name in the code, and the entry above exists to keep names out of the code. This achieves the same guarantee — no quote is ever orphaned — through a rule about the *operation* instead of a rule about one privileged row.

**Instead of.** Deleting the quotes with the board, the way deleting a book takes its annotations: a book genuinely contains its annotations, whereas a board is a place a reader filed something, and unfiling should not destroy it. Allowing board-less quotes with an Unfiled tile: it makes `board_id` nullable, and every count, filter and query then carries a null case forever to serve a state the reader can always avoid.

**Approved.** The reader's, in the form "Ask where they go, and refuse until told."

<sub>Not shipped</sub>

### Hiding a board is explicit, and All quotes is pinned above them

**Decided.** A board is hidden only when the reader hides it, and a filter shows the hidden ones again. Emptiness never hides anything. The board list also carries one pinned **All quotes** entry, which opens every quote regardless of board; it is not a board, and cannot be renamed, hidden or deleted.

**Why not "empty means hidden".** A board you have just made is empty. The automatic rule would make it disappear at the moment of creation, which is the same class of trap as the one this whole section is undoing — a control vanishing exactly when it is needed. Explicit hiding also matches how a colour category is hidden in Settings, so the app has one idea of what hiding means.

**Hiding never loses anything**, because a hidden board's quotes are still in All quotes. That is what makes hiding safe enough to be a one-tap action instead of a confirm.

**Approved.** The reader's: "Hide boards that user is not using. but keep a filter that enables them at will", and "Yes — an All quotes entry".

<sub>Not shipped</sub>

### An import creates a board it does not know, and that is what makes an old export round-trip

**Decided.** `board: Kennedy` in a Markdown import creates a Kennedy board and files the quote there. A quote with no board key goes to the default board. The old `category` / `kind` / `type` keys are accepted as aliases and their values are treated as board names.

**Why, given the current rule is the opposite.** Today an unknown category is a 400 with the offending value named, and that was right when the set was three values the server defined. Once boards are the reader's own, an unknown name is not an error — it is a board they have not made yet, and refusing the file would mean hand-making every board before importing. It also means **a file exported from an older version imports cleanly**, because `category: proverb` simply finds or creates a board called proverb.

**The cost, stated.** A typo creates a board. That is visible in the list and fixable by renaming or deleting it, which is a far cheaper failure than a refused import — the same reasoning 1.13.1 used for credit suffixes, where a wrongly-split name is visible and a wrongly-merged one hides a whole person.

**Approved.** The reader's, in the form "Create the board."

<sub>Not shipped</sub>

## 5. Works, Shelves and Reading History

Books, films and shows share one catalogue shape, and everything about where you stand with a work is either derived from data already present or moved behind its own endpoint so an ordinary save cannot rewrite history.

### TV shows are movie rows with a `media_type` flag, not a third medium duplicating the whole stack

**Decided.** Migration 0006 folded shows into `movies` with `media_type TEXT NOT NULL DEFAULT 'movie'` ('movie' | 'show'), plus a `tvdb_id` for the second supplier with its own partial unique index mirroring `tmdb_id`.

**Why.** A show and a film differ in their locator and their metadata source, not in their shape — both have a title, a year, a poster, credits, a collection and quoted lines. A third table would have duplicated the whole catalogue stack, and every join, filter, sort and export with it. `media_type` is validated in app code rather than by a CHECK, because 0004 had already established that SQLite cannot evolve one and open-ended vocabularies therefore live in the app layer.

**Instead of.** A separate `shows` table — rejected as duplication.

**Approved.** Mine, and it has paid for itself repeatedly: a collection can hold a film and a show together because they are rows in one table, which needed no schema change at all.

<sub>pre-1.0 — `internal/store/migrations/0006_enrich_books_movies.sql`</sub>

### Collections shipped with no migration at all — the column had existed since 0006 and only the affordance was missing

**Decided.** Grouping the Catalogue by collection shipped in 1.0.1 with zero schema change.

**Why.** 0006 had added `series` to `movies` with its own comment calling it a "franchise / collection name", and `media_type` sits on the same row, so cross-type membership — Twin Peaks with Fire Walk With Me, Firefly with Serenity — needed nothing new. TMDB's `belongs_to_collection` was already filling the column on lookup. What was missing was the control: the Catalogue had no group-by, so you could filter to one collection but never see the structure.

**Approved.** I approved this one quickly, and it is worth logging precisely because it was cheap: the earlier decision to name the column generically is what made it cheap.

<sub>1.0.1 — `CHANGELOG.md` · `internal/store/migrations/0006_enrich_books_movies.sql`</sub>

### 'Series' for books, 'collection' for films — a rename that stops at the UI, with the plural carried explicitly

**Decided.** Films and shows say **collection** everywhere a reader looks — filter, sort, group, both edit forms — while books say **series**. Same column, same JSON key, same FTS index.

**Why.** "Series / franchise" reads as a TV field on a page where *series* already means a show. Renaming the column would touch some sixty Go call sites and the tests pinning them, for nothing a reader would see. The UI carries `seriesNoun` plus a separate `seriesNounPlural`, because "series" is its own plural and appending an *s* had produced "all seriess"; the plural defaults to the regular English form so "collection" needed no call-site change.

**Instead of.** Renaming the column and the JSON key — rejected on cost with no visible benefit.

**Approved.** My call, and I stand by the boundary: a vocabulary problem gets a vocabulary fix, not a migration.

<sub>1.0.1 — `CHANGELOG.md` · `web/frontend/src/works.jsx`</sub>

### Season and episode are a show's locator, nullable, with NULL the only unset because season 0 is a real season

**Decided.** Migration 0025 added nullable `season` and `episode` to `dialogues`. Both are pointers in Go, and NULL is the only "unset" — deliberately not the 0-means-unset convention 0024's position columns use.

**Why.** A film is one runtime, so a timestamp locates a line completely; a series with sixty episodes needs to say which of them "01:12:40" belongs to. Season 0 is where TVDB and everyone following it put specials and pilots, so S0E1 has to be storable and distinguishable from "no episode recorded". It also matches the rest of the locator: character, actor and timestamp have been nullable since 0003, meaning exactly this. A line may name a season with no episode; an episode with no season is rejected, because an episode number means nothing without one and would sort ahead of every numbered season.

**Instead of.** 0-means-unset, as the position columns do — rejected because it collides with a real season.

**Approved.** Mine, and I approved the inconsistency with 0024 knowingly rather than for tidiness — two columns with different sentinels is cheaper than losing the ability to record a pilot.

<sub>1.3.0 — `internal/store/migrations/0025_dialogue_episode.sql` · `internal/httpapi/dialogue_handlers.go`</sub>

### A film's season and episode are dropped rather than refused, so flipping a show to a film does not brick its edit form

**Decided.** `episodeRef.normalize` clears both fields outright when the parent's `media_type` is not "show", instead of returning an error.

**Why.** Flipping a show to a film in the Edit form leaves its dialogues holding episode numbers that no longer mean anything. Refusing them would make every later edit of those lines fail, with no way to fix it from a form that correctly does not offer the fields. Clearing heals the line on its next save, and matches the importer's forgiveness for the same case. The rule lives in `normalize` rather than in a CHECK because SQLite cannot reach across to `movies.media_type`.

**Instead of.** A 400 on the mismatch — rejected as a trap with no exit.

**Approved.** I signed this off after working out that the strict version produced a row that could never be edited again, which is a worse failure than silently dropping two numbers.

<sub>1.3.0 — `internal/httpapi/dialogue_handlers.go`</sub>

### Dialogue order is season, then episode, then clock, then id — one definition shared by the list and the export

**Decided.** `dialogueOrder(p)` returns a single `ORDER BY` fragment, used by the list query and by the Markdown export, with NULLs last within each group.

**Why.** A file should read in the order the screen shows. One definition, taking the table alias as an argument, is what makes that true by construction rather than by two people remembering. A film's season and episode are always NULL, so it collapses to the timestamp order dialogues have always had; an un-episoded show line falls to the end of its group rather than the front, while season 0 sorts first, which is where specials belong.

**Approved.** My call. Sharing the fragment rather than the query is the smallest thing that stops the two from drifting, and I approved it on that basis.

<sub>1.3.0 — `internal/httpapi/dialogue_handlers.go` · `internal/httpapi/export_handlers.go`</sub>

### Shelf status is drawn as a colour bar under the artwork, never a badge over it, and `--accent` is deliberately not the in-flight colour

**Decided.** `StatusBar` is a 5px strip below the cover or poster, never overlapping it. In flight it is a progress bar filled to `progress` with the rest of the track a 22% wash of the same colour; every settled state is solid, because there is no partial "completed". Colours follow Radarr's convention — blue in flight, green done, red given up, amber held.

**Why.** The whole cover stays visible, so nothing is hidden behind a status. The unfilled track is the state's own colour at low opacity rather than neutral grey, so a barely-started book still reads as "reading" and not as an empty slot. `--accent` (terracotta) is deliberately not used for *reading*: it sits a few degrees from `--error`, and a bar you have to squint at to tell "reading" from "abandoned" is no bar at all.

**Instead of.** A badge over the artwork — rejected; it hides the thing the grid exists to show.

**Approved.** Mine, including the accent exclusion, which I approved specifically because using the brand colour there would have been the obvious choice and the wrong one.

<sub>1.3.0 — `web/frontend/src/ui.jsx` · `CHANGELOG.md`</sub>

### The reading mark became an opaque disc: contrast from a blur halo does not survive an 18px cover

**Decided.** `ReadingBadge` — the one glyph that still rides on artwork — is an opaque disc in shelf blue with a white glyph and a hard rim.

**Why.** It was a bare blue glyph carrying a dark blur halo, and a halo is a soft gradient, so at the ~18px a phone cover gives it the halo ate the thin strokes it existed to protect and the mark read as a smudge on anything but plain artwork. Contrast from an edge does not scale away. It also stops being the one thing in the app with a glow.

**Reversal.** Reversed. What I got wrong was testing the badge at the size I was drawing it rather than the size a phone renders it at.

**Approved.** Mine both times; I approved the redraw as soon as I looked at a real cover grid on a phone instead of a component in isolation.

<sub>post-1.3.0 — `web/frontend/src/ui.jsx`</sub>

### The wishlist is derived from the annotation count, with no column and no bookkeeping

**Decided.** A work with zero annotations or dialogues *is* the wishlist. Migration 0024 gave it no column, deliberately.

**Why.** It needs no storage and can never drift out of sync with the quotes it counts. A set status wins over wishlist for the label a tile draws — a book you started last night has no quotes yet and satisfies both, and the state you chose is the truer one — while the wishlist *filter* keys on the count alone, so the two chips never disagree about the same row.

**Instead of.** A `wishlist` boolean — rejected as a second source of truth for something already computable.

**Approved.** I approved this in the migration itself and wrote the reasoning into the SQL comment, so the next person to reach for a column finds the argument before they add one.

<sub>1.3.0 — `internal/store/migrations/0024_in_progress.sql` · `web/frontend/src/works.jsx`</sub>

### Progress is derived from a position in the work's own units, and a count with no total is refused rather than stored

**Decided.** `progress` (0–100) is the canonical value and drives the bar, the export and every client. Where a position is set — page 96 of 214, season 2 of 3 episode 6 of 10 — the server derives the percentage from it, and the client's own percentage is consulted only when there is nothing to derive from. A page or episode number with no total is a 400.

**Why.** People count in the units the thing is made of, not in percentages, but two numbers that can disagree is worse than one. Deriving server-side means the bar, the file and every client read one number. A count with no total cannot become a percentage, and silently storing it would leave a bar that never moves. For a show, whole earlier seasons count in full, which is the only reading that makes the bar advance monotonically through a run.

**Instead of.** Storing the position and computing the percentage per client — rejected; that is how clients disagree.

**Approved.** My call, and the refusal is the part I approved most deliberately: a validation error at the door beats a broken bar nobody can explain.

<sub>1.3.0 — `internal/httpapi/shelf.go` · `internal/store/migrations/0024_in_progress.sql` · `CHANGELOG.md`</sub>

### A read log, so a reread is history rather than an overwrite

**Decided.** Finishing a work closes its read and starting again opens the next one, with a `work_reads` row per read; an abandoned attempt keeps its stop date but does not count as a read.

**Why.** Before this, a reread overwrote the read before it and 'how many times have I read this' was unanswerable. `progress` stays on the work rather than on the open read because it is 'where am I now', not history.

**Approved.** Mine, and I approved keeping `progress` on the work rather than moving it onto the open read — the split between "where am I now" and "what happened" is the whole shape of this table.

<sub>1.3.0 — `CHANGELOG.md`</sub>

### `outcome` rather than a bare `finished_at` keeps the read counter honest, with triggers standing in for a cross-table cascade

**Decided.** `work_reads.outcome` is 'open' | 'finished' | 'abandoned'. `readCounts` counts only 'finished' rows. Two `AFTER DELETE` triggers on `books` and `movies` remove the matching read rows.

**Why.** An abandoned attempt has a stop date but was never finished, so a bare `finished_at` would count giving up as reading. `kind` + `work_id` is a polymorphic pointer at `books.id` or `movies.id`, so no foreign key is possible and no `ON DELETE CASCADE` exists to declare — the triggers are the stand-in, and deleting a work takes its history with it. At most one 'open' row per work is enforced in app code, since the partial unique index that would express it cannot also be scoped per user cheaply.

**Instead of.** Two parallel tables with real foreign keys — rejected as duplication of the whole log for two kinds that behave identically.

**Approved.** I approved the polymorphic pointer knowing it costs the FK, and approved the triggers as the explicit price of that.

<sub>1.3.0 — `internal/store/migrations/0024_in_progress.sql` · `internal/httpapi/shelf.go`</sub>

### Read dates are partial TEXT compared lexically — then required to be real calendar dates

**Decided.** `started_at` and `finished_at` are TEXT holding 'YYYY', 'YYYY-MM' or 'YYYY-MM-DD', compared as TEXT. The validator accepts all three shapes, bounds the year to 1000–3000, and for a full date hands it to `time.Parse` to confirm it exists.

**Why.** "I read it in 2019" is often all anyone honestly knows, and padding it to January 1st invents a precision nobody has. The three shapes sort correctly against each other lexically, which is the same trick `noted_at` has relied on since 0008, so `MAX()` over the mixed shapes is meaningful without parsing anything.

**Reversal.** The range checks alone were not enough and I fixed that. A day between 1 and 31 is not the same as a day that exists: the validator accepted 30 February and 31 April while its own comment promised "a stored date is always a real one". `time.Parse` is the calendar and now does the deciding.

**Approved.** Mine, and the correction is mine too — the comment was right and the code was not, which is the useful thing to record.

<sub>1.3.0, corrected later — `internal/httpapi/shelf.go` · `internal/store/migrations/0024_in_progress.sql`</sub>

### Status, progress and the read log move together through their own endpoint, never the full-state PUT

**Decided.** `PUT /books/:id/status` and `PUT /movies/:id/status` are the only paths that write status, progress, position and the read log. On `bookDetail` and its film counterpart, those fields are read-only.

**Why.** They are one consistent state, not three fields. A full-state PUT that carried them would let an ordinary Edit-form save silently rewrite reading history. Everything the transition implies — opening a read, resuming a pause into the same read rather than a second one, closing as finished or abandoned, restarting a reread at 0 — lives in one function so status and log can never disagree.

**Instead of.** Carrying them on the existing PUT — rejected precisely because the Edit form would then be able to erase a history it never showed.

**Approved.** My call, and I stand by it; the endpoint split is what makes every later rule about the read log enforceable in one place.

<sub>1.3.0 — `internal/httpapi/book_handlers.go` · `internal/httpapi/shelf.go`</sub>

### `completed` is settled, but clearing to empty stays legal from every state as the undo for a mis-tap

**Decided.** `statusTransitionAllowed` enforces exactly one rule: from `completed`, the only move is to the in-progress status for that side. Pausing or abandoning something already finished answers 409. Clearing back to `''` is legal from every status, `completed` included.

**Why.** Pausing something you already finished is not a thing that happens, so it is refused rather than quietly accepted. But clearing is not a lifecycle move — it is the undo for a mis-tap, and without it a wrong click would be permanent.

**Instead of.** A full state machine over all five states — rejected; one real rule is all the lifecycle actually has, and inventing four more would refuse things people legitimately do.

**Approved.** I approved keeping the gate this small on purpose. A validation rule that exists to look thorough is a rule that eventually blocks someone for no reason.

<sub>1.3.0 — `internal/httpapi/shelf.go`</sub>

### The shelf cap is a client-side nudge of 5 books · 2 films · 5 shows, never enforced by the server

**Decided.** `shelfCap` returns 5 for books, 5 for shows and 2 for films, mirrored in the frontend as `SHELF_CAPS`. Going past it opens the shelf so you can settle something from the list, or carry on anyway. The server never refuses.

**Why.** Films are capped hardest because two at a time is already unusual, whereas five part-read books is an ordinary shelf, and a binge-watched series should not crowd out a film — which is why films and shows count in separate pools. The cap is a nudge: a second device must never be told "no" about a limit the first device is only suggesting.

**Instead of.** Server enforcement — rejected outright; the user can always wave it through, so enforcing it would only break the sync path.

**Approved.** Mine, and I approved keeping the two constants mirrored with a comment on each side pointing at the other rather than fetching the number from the server, which would have been a request for a value that is advisory anyway.

<sub>1.3.0 — `internal/httpapi/shelf.go` · `web/frontend/src/works.jsx` · `CHANGELOG.md`</sub>

### The read log became directly editable, but the open read stays out of reach — it is the consistency between status and log

**Decided.** `POST /books|movies/{id}/reads`, `PUT /reads/{id}` and `DELETE /reads/{id}` edit past reads. An `outcome` of `open` or `''` is refused with a message naming where the operation actually lives: "an in-progress read is set by the shelf status, not by editing history."

**Why.** Writing the log only as a side effect of a status change records what is happening now and is hopeless for what already happened — a book read three times over fifteen years had one row at best, and there was no way to say "I finished this in 2019" about anything already on the shelf. Then 1.7.2 made that log sort the Library, and a sort you cannot correct is worse than no sort. But the open row *is* the consistency between status and log: it exists exactly while the work is in progress. Deleting it would leave a book reading with nothing being read; closing it by hand would leave it finished and still on the in-progress shelf. Both are reachable already, through the status control.

**Instead of.** Full CRUD over every row including the open one — rejected as a way to manufacture states the shelf cannot draw.

**Approved.** I signed this off after 1.7.2 turned a mostly-empty table into something the shelf order depends on; the refusal on the open row is the part I approved most deliberately.

<sub>1.7.4 — `internal/httpapi/read_history_handlers.go` · `internal/httpapi/server.go` · `CHANGELOG.md`</sub>

### 'Last read' sorts on the finish date, falls back to the start, counts every outcome, and puts never-logged works last

**Decided.** `lastReadAt` takes `MAX(CASE WHEN finished_at <> '' THEN finished_at ELSE started_at END)` per work, over every outcome. The client comparator inverts a lexical compare, so `''` — a prefix of every string — sorts last.

**Why.** A read you are still in the middle of has no finish date and is the one you touched most recently, so sorting on `finished_at` alone would file the book currently open under "never". Every outcome counts because the question is "when did I last have this in my hands", and abandoning something in November is an answer to it — which is also why this cannot reuse `readCounts`, which asks how many times I got to the end and is right to filter on the outcome. Anything never logged sits at the end alphabetically, which in a library built to hold quotes is usually most of it.

**Instead of.** Two explicit `if (!da) return 1` guards in the comparator — written, then deleted: a mutation proved them unreachable, because the inverted direction was already doing their work. The invariant now lives in the test rather than in a branch that cannot run.

**Approved.** My call, and I approved deleting the dead guards rather than keeping them for comfort — a branch that cannot run is a line a later change trusts.

<sub>1.7.2 — `internal/httpapi/shelf.go` · `web/frontend/src/ui.jsx` · `CHANGELOG.md`</sub>

### Years may be negative and estimated, and needed no schema change — 0 already meant 'not recorded'

**Decided.** The year floor moved from 1000 to −4000 and a negative year is BCE. Migration 0030 is four lines: two `published_circa` / `release_circa` flags. The year columns themselves were not touched.

**Why.** The old floor refused the Meditations, the Analects and the Gita outright, which is not a rounding error in an app for keeping quotes from things worth quoting. Almost nothing had to change: `books.published_year` and `movies.release_year` have been INTEGER since 0001 and 0003 with no CHECK — the 1000–3000 range lived in Go, in `validYear` — so −380 already stored and already sorted correctly, and 0 has always meant "no year recorded", which is exactly the convention the era needs since there is no year 0 between 1 BCE and 1 CE. Not one existing row changes meaning.

**Instead of.** A separate era column or a sentinel — neither was needed, and the migration comment records that as the reason it is four lines instead of a rebuild.

**Approved.** Mine, and I approved writing the "nothing had to change" reasoning into the migration, because a four-line migration for a headline feature otherwise looks like something was missed.

<sub>1.7.4 — `internal/store/migrations/0030_ancient_years.sql` · `CHANGELOG.md`</sub>

### The partial-date TEXT columns are deliberately not extended to BCE, because a leading minus breaks lexical order

**Decided.** `work_reads.started_at` / `finished_at` (0024) and `utterances.occasion_date` (0026) stay CE-only. The timeline parses a leading '-' when reading them so nothing crashes, but it is not a supported input.

**Why.** Those columns are TEXT precisely so 'YYYY', 'YYYY-MM' and 'YYYY-MM-DD' compare against each other lexically, and a leading '-' breaks that outright: '-380' sorts before every CE date as a string, which is right by luck, but '-380' and '-63' compare in the wrong order because a shorter BCE year is a *later* one. And they record when you read something and when a speech was given — a rally, a broadcast, a letter — none of which is ancient.

**Instead of.** Extending the era everywhere for consistency — rejected; it would have bought symmetry and cost correct ordering on the columns that actually sort.

**Approved.** My call. Two date conventions in one schema is a wart, and I approved the wart over a sort that silently reverses.

<sub>1.7.4 — `internal/store/migrations/0030_ancient_years.sql`</sub>

### A year is written, not signed, and 'c.' marks an estimate without moving anything

**Decided.** −380 renders as "380 BCE", never "−380". CE is unmarked. The field reads back everything it writes, so "380 BC", "-380", "c. 380 BCE" and "circa 380 BCE" all arrive at the same year. `circa` is display-only: it never participates in sorting, bucketing or comparison.

**Why.** A minus in front of a year reads as a countdown, and writing "1954 CE" on a novel is pedantry — the era only needs saying when it is the unusual one. A text written over a century does not have a publication date, it has a contested estimate, and storing −380 while rendering a flat "380 BCE" states a precision nobody has, in an app whose whole purpose is keeping other people's words accurately. A `circa` that changed the ordering would put the timeline and the shelf into disagreement about the same book.

**Instead of.** A nullable boolean for `circa` — rejected in favour of `INTEGER NOT NULL DEFAULT 0`, matching `favorite` and every other flag in this schema: SQLite has no boolean, and a NULL third state would mean "we do not know whether we know", which is not a thing.

**Approved.** I approved the display-only constraint on `circa` explicitly, in both the migration and the formatter, because it is the kind of flag someone later reaches for when they want an "approximate" bucket.

<sub>1.7.4 — `internal/store/migrations/0030_ancient_years.sql` · `web/frontend/src/ui.jsx`</sub>

### The completeness score asks whether a year is present, not whether it is positive

**Decided.** The metadata console's `has_year` is `published_year IS NOT NULL AND published_year <> 0`, not `> 0`.

**Why.** It was `> 0`, so the oldest books in a library — the ones the BCE work existed to make storable — would have been the ones it nagged about hardest. The score's question is "is a year recorded", and 0 is the answer to that, not the sign.

**Reversal.** Reversed. This is a bug that shipped inside the same release as the feature that created it: I widened the domain of the column and did not go looking for the places that had encoded the old domain as a comparison.

**Approved.** Mine, and the lesson I approved recording is the general one — a widened range means auditing every predicate over it, not just the validator.

<sub>1.7.4 — `internal/httpapi/metadata_library.go` · `CHANGELOG.md`</sub>

### Page count is deliberately not a metadata field — it is already the progress denominator

**Decided.** Page count is excluded from the planned book-fields list (format, language, publisher, translator, subtitle), by name and with a reason.

**Why.** It is already stored as `pos_total`, the progress bar's denominator. A second metadata-sourced page count would give the app two numbers that can disagree about the same book. If it is ever wanted as canonical metadata it should *feed* that one, not sit beside it.

**Approved.** I approved naming the exclusion in the backlog rather than leaving it out silently, because "page count" is the first field anyone would think to add and the omission would otherwise read as an oversight.

<sub>not built (recorded on the backlog) — `docs/roadmap.html`</sub>

### 'Shelf' belongs to reading status, so the collections backlog section became 'tag shelves'

**Decided.** The roadmap's [collections](roadmap.html#collections) section, formerly *Collections & shelves*, is now *Collections & tag shelves*.

**Why.** "Shelf" now means where you stand with a work — reading, paused, completed. What that section builds is tags surfaced as first-class groupings, so it is tag shelves, and the plain word belongs to the other feature.

**Approved.** A small call, mine, and logged because renaming a backlog section to protect a word that shipped later is exactly the kind of thing that goes unrecorded and then gets undone.

<sub>post-1.3.0 — `docs/roadmap.html`</sub>

### The shelf and the read log feed nothing else, and every temptation to wire them into stats is named

**Decided.** The shelf gives a status per work, a progress figure, a position and a read log with dates. All of it is your input, shown back to you, and nothing else consumes it. The specific temptations are listed: no read-log series in the Stats activity calendar; no "books finished this year" in the year in review; no reading-pace or completion charts; no progress- or completion-based achievements; no shelf status feeding the review deck's scheduling.

**Why.** These are all plausible and all cheap-looking, which is why naming them individually is the only version of this boundary that survives. The roadmap's [serendipity](roadmap.html#serendipity) section carries a back-reference at the exact spot someone would first reach for it, because that is the first place anyone would.

**Approved.** My call, recorded under "Considered and set aside" so the boundary stays a decision instead of being rediscovered later as an opportunity.

<sub>post-1.3.0 — `docs/roadmap.html`</sub>

### Games are a third `media_type` on `movies`, not a `games` table

**Decided.** A game is a row in `movies` with `media_type = 'game'`, its studio in the `director` column, its voice cast in `cast_json`, its franchise in `series`, and one new column — `igdb_id` — beside `tmdb_id` and `tvdb_id`. Migration `0040_games.sql` is two statements. There is no `games` table and no fifth nav tab: games are a segment inside the Catalogue, alongside Films and Shows.

**Why.** This is the move `0006` made for TV shows, and every part of the reasoning carried over. The payoff was measured rather than assumed: **20 Go files** query `movies` (search, stats, the bin, backup, restore, export, the review deck, import staging, bulk ops, dupes, portraits, reverify, vocabulary, admin, and the CLI), and they all understood games without being touched. A `games` table would have meant teaching every one of them a third noun, where the failure mode of missing one is silence — a game absent from search, or from a backup, with nothing raised.

`'game'` needed no vocabulary change either, and that was by earlier design rather than luck: `media_type` has no CHECK (0006 validates it in app code and says so), `status` has none (0024), and `person_kinds` has none (0027). A studio therefore becomes a `people` row of kind `studio` with no DDL at all, inheriting image storage, the People panel, rename, merge and orphan GC. `0037` set the bar for a new person kind — it must have *behaviour*, not just a label — and a studio clears it: a logo, a click target, and its own slot on the overview page.

**What I got wrong, and it is worth recording.** The plan this was built from stated the payoff as "eighteen Go files" and "~61 frontend `kind === 'movie'` switches". Recounted against the tree on 2026-08-16: **20 files**, and `kind === 'movie'` appears **9 times** (105 `'movie'` literals across 17 files). The conclusion was right and both supporting numbers were wrong, which is exactly the failure mode `AI.md` describes — confident documentation is not verified documentation. The corrected figures and the commands that reproduce them are in the migration header, where the next person to question the design will actually be standing.

**The vocabulary stretch is deliberate and is the one real cost.** A game's studio lives in a column named `director`. That is defensible — a show already stores its *creator* there — but it means two person kinds share one column, told apart only by `media_type`, which is a hazard rather than a tidiness problem. See §6.

**Approved.** My call, after the metadata research settled what could actually be fetched.

<sub>0040 — `internal/store/migrations/0040_games.sql`</sub>

### A game is played, and every shelf arm is named rather than defaulted

**Decided.** `StatusPlaying` joins the status vocabulary; `activeStatus` and `normalizeStatus` take the media type as well as the kind; `shelfCap` gains a `game` arm of **3**; and its bare `default:` is gone, replaced by named arms plus a warned fallback (`TIP-SHELF-001`).

**Why.** `shelfCap` ended in `default: return 2`, so a game would have inherited the film cap on the strength of a fallthrough rather than a decision. Three is the decision: more than a film, because a long game sits unfinished for months and two would nag constantly; fewer than a book, because you cannot really be playing five at once.

The subtler one was `bulkSetStatus`, which validates **one** status word for a whole selection. A catalogue selection can hold films and games together, so the choices were to refuse mixed selections — which this file's own comment already rejects for the completed-work case, on the grounds that a bulk action must not fail on a property of its least convenient member — or to write the literal word through, which stamps `watching` onto a game. Neither. The word is validated against the *set* of active words for the kind and resolved **per row** against that row's own `media_type`.

**Approved.** My call.

<sub>0040 — `internal/httpapi/shelf.go`, `internal/httpapi/bulk_handlers.go`</sub>

## 6. People, Credits and Metadata Providers

Credits are stored exactly as they arrive and split only when read, so a wrong split costs a wrong grouping and never a corrupted field. Providers are consulted on demand, pinned to an identity rather than a name, and never allowed to overwrite something you typed without being asked.

### People were keyed on (user_id, kind, name), making a role part of identity

**Decided.** Migration 0012 created `people` with the role in the key, so a person existed once per job they did.

**Why.** Enrichment was layered over free text — `books.author`, `dialogues.actor`, `movies.director` are strings, and `people` was a side table of bios and portraits matched by exact name. Keying on the role made each console self-contained and the queries trivial. It was tolerable because the overlap between authors, actors and directors is genuinely small. I approved it on that basis, and the basis was a fact about my library rather than a fact about people.

**Reversal.** See below: it did not survive the fourth kind.

<sub>`internal/store/migrations/0012_people.sql` · `internal/store/migrations/0027_people_one_row.sql`</sub>

### One row per person keyed on name, with roles as a set

**Decided.** Migration 0027 rebuilds `people` on `UNIQUE (user_id, name)` and moves the role into a `person_kinds` join table. Identity becomes the name; kinds become a set the person belongs to.

**Why.** Standalone quotes made the old key untenable rather than merely untidy. A speaker is very often already an author — the whole appeal of saving a line from a speech is that you have read the person too — so adding `speaker` to the old key would have manufactured a duplicate for exactly the people most likely to be enriched: two rows, two bios, two portraits, and enriching one leaving the other blank. The rebuild was cheap because nothing references `people(id)`, verified across every migration, so there were no cascading children to park. I got the original key wrong and this is the correction; I approved the rebuild rather than special-casing speakers, because the special case would have been the same bug with a name.

<sub>`internal/store/migrations/0027_people_one_row.sql`</sub>

### The lossy people merge has a written survivor rule

**Decided.** Where one name existed under several kinds, the survivor is chosen by `ORDER BY (image_path <> '') DESC, (bio <> '') DESC, created_at ASC, id ASC` — portrait, then bio, then oldest, ties by id. The survivor keeps its id.

**Why.** The merge is lossy, so the choice cannot be "whichever SQLite happens to return first" — that is a different library on a different build. Prefer the row carrying the most; a hand-entered row usually predates an enrichment fetch, which is why oldest is the third key rather than the first. One consequence is stated in the migration rather than discovered later: if two merged rows each had a *different* portrait, the loser's file under `MediaCover` is left unreferenced and nothing routinely sweeps that directory, so it leaks a few kilobytes. Preferring the row with an image means the ordinary case — one enriched row, one bare one — loses nothing at all. My call, and writing the rule into the migration is the part that makes it a decision instead of an accident.

<sub>`internal/store/migrations/0027_people_one_row.sql`</sub>

### `person_kinds` carries no CHECK, because a CHECK is evaluated against data already out in the world

**Decided.** `person_kinds.kind` is a bare `TEXT NOT NULL`. Validation lives in `validPersonKind`, which gates every write.

**Why.** A CHECK added in a migration is evaluated against whatever is already in the column, so one unexpected value in one existing database turns the migration into a failure — and a failed migration means `Migrate()` returns an error and the app does not start. A constraint that can stop startup in order to reject a value the API already refuses to write is a bad trade. 0012 made the same call for the same reason, and 0004 had already dropped `annotations.source`'s CHECK when the source list grew. I approved keeping the invariant in Go where it can be changed without a schema rebuild.

<sub>`internal/store/migrations/0027_people_one_row.sql` · `internal/httpapi/people_handlers.go`</sub>

### The orphan sweep un-files a role instead of deleting a person, and its switch has no defaulting arm

**Decided.** `gcOrphanPeople` deletes the `person_kinds` row for the swept kind and removes the person only once no role is left. `orphanRefQuery` returns `""` for an unrecognised kind and the sweep does nothing.

**Why.** Under 0027 deleting a person because their last book went would take a portrait and a bio the speaker side is still using — that is not a refinement, it is the difference between right and wrong under the new schema. The empty default is the whole reason the function was extracted: it used to be written inline as the `books.author` query with a switch overriding it for actor and director, which is correct for exactly three kinds and correct only for that reason. A fourth kind would have silently inherited the books query, and every person of it whose name was not also one of your book authors would have been deleted and their portrait unlinked — by a best-effort sweep that logs at Warn and still answers 200. Failing to sweep leaves clutter; sweeping wrongly loses a bio and a portrait. The keep-set also holds every credit's split components under both the user's separator config and the default one, so flipping that setting can never turn saved people into orphans. My decision, made after the fourth kind proved the shape of the hazard.

<sub>`internal/httpapi/people_handlers.go`</sub>

### `personCreditSQL` returns the scan and the update together

**Decided.** One function, one switch, returning both statements plus an `ok` flag; a kind with no credit column cannot be renamed.

**Why.** They were previously two separate switches — each a default-plus-overrides over books — sitting forty lines apart inside `handleRenamePerson`, which is two ways to get the same thing wrong. Independently, either could inherit the books arm for a kind it does not know. Jointly, they could *disagree*: scan one table and write to another, reading every book's author and stamping the rewritten strings onto dialogue rows by matching id. The blast radius is larger than the orphan sweep's, because `ReplaceCredit` matches a name as a component inside a joined credit — a speaker renamed from "Bose" would rewrite the author line of every book credited to anyone called Bose, across the whole library, and rename has no undo. A test asserts that every kind `validPersonKind` accepts has a case here. Approved by me as a refactor with no behaviour change, which is the only kind worth doing to a path with no undo.

<sub>`internal/httpapi/people_handlers.go` · `internal/httpapi/people_gc_test.go`</sub>

### A speaker rename re-hashes that account's quotes, and a collision leaves one row on its old hash

**Decided.** After the credit rewrite, `rehashRenamedQuotes` recomputes `dedupe_hash` for every utterance in the account. A row whose new hash collides with an existing one keeps its old hash and logs a warning.

**Why.** `UtteranceDedupeHash` folds the speaker in, because standalone quotes invert the usual rule — the occasion is a locator and it *discriminates*. So renaming a speaker changes what those quotes are, and a hash still computed from the old spelling would fail to recognise a re-import of the same line under the new one, quietly producing a duplicate months later. SQL cannot compute a SHA over normalised fields, so this is a second pass rather than part of the UPDATE. On collision: two quotes that differed only by the spelling of a name become the same quote, and `UNIQUE (user_id, dedupe_hash)` refuses the second. Failing the whole rename over it would strand the library half-renamed; deleting the loser would destroy a row nobody asked to lose. Leaving that one row on its old hash costs nothing today and is visible as an ordinary duplicate pair the user can resolve. My call — the least bad of three bad options, and I would rather it be written down than discovered.

<sub>`internal/httpapi/people_handlers.go`</sub>

### Credits are stored verbatim and split at read time

**Decided.** `books.author`, `dialogues.actor`, `movies.director` and `utterances.speaker` store whatever arrived. `SplitCredits` splits at read for the people views; `ReplaceCredit` splices one component in place when a rename lands.

**Why.** This is the whole safety argument for multi-author support: a wrong split costs a wrong grouping on a screen, and a wrong join costs a corrupted field with no undo. Because the stored string is never rewritten by the setting, the separator preference is safe to flip at any time. `ReplaceCredit` splices in place rather than re-serialising, so separators, "et al." markers and every co-credit stay byte-for-byte as stored — no lossy round trip and no component cap. When the rename makes a component collide with an existing spelling of the target, the later duplicate drops with its separator, which is what lets the merge tools recombine a bad split. The split rules carry their own guards: " and " only cuts in list context or between two things that both look like full names, so "Daniels and Sons" and "William and Mary" stay whole; suffix tokens re-attach ("Martin Luther King, Jr."); "et al" is dropped. I approved storing verbatim first and worrying about splitting second, and that ordering is why every later mistake here was recoverable.

<sub>`internal/metadata/credits.go`</sub>

### Duplicate people are merged by rewriting the library, not by aliasing

**Decided.** There is no alias table. Merging two spellings of one person is a rename: the credit strings across the library are rewritten, the metadata rows are folded onto the target, roles move before the losing row is deleted, and freed portrait files are unlinked after the commit.

**Why.** People are keyed by name, so an alias would be a second identity mechanism sitting beside the primary one and every read would have to consult both. Rewriting is the honest operation: after it, the library says one thing. The ordering matters and is commented — roles are copied to the survivor *before* the delete, because deleting the row cascades its `person_kinds` away and a speaker folded into an existing author row would otherwise quietly stop being a speaker. The rename is also looked up by name alone now; `kind` on the request says only which console you came from, because one row plays a set of roles and renaming Bose from the Authors console has to rewrite their speaker credits too. This was mine, and the cost — rename has no undo — is why `personCreditSQL` exists in the form it does.

<sub>`internal/httpapi/people_handlers.go`</sub>

### Portraits resolve a pinned identity rather than a name

**Decided.** `POST /people/portrait` resolves a portrait from a stable external id and persists `source` + `source_id` on the person, leaving bio, born and links untouched.

**Why.** A by-name lookup grabs the wrong same-name person — the "several David Reichs" problem, where the more-published namesake wins. So each kind is disambiguated by something that is not the name: an actor from the film's stored cast (`movies.cast_json`, which already carries the supplier's person id and a headshot URL), a director from the crew in the cached TMDB payload, an author through Open Library cross-checked against the books that author wrote in *this* library. Pinning the id means a re-fetch cannot drift.

**Reversal.** The fix landed in one modal and I called it done. The Metadata → People console — both per-row and the "Fetch missing" bulk — was still on the old name + work-count lookup, so the same wrong person came back on the screen most likely to be used for this. What I got wrong is a repeat of the same class of mistake as `personCreditSQL`: a rule implemented at one call site is not a rule. It was moved onto the shared path a release later, which also gained it photos rather than only links.

<sub>`internal/httpapi/portrait_handlers.go` · `internal/metadata/people.go`</sub>

### Directors and actor headshots come from the TMDB payload already cached on the film

**Decided.** Both read out of what the movie fetch already stored — the parsed cast for actors, `credits.crew` inside `source_metadata` for directors — at no extra provider call. A by-name person search is the fallback only for films synced without a payload.

**Why.** TMDB details use `append_to_response=credits`, so one call returns details, cast and crew. The film *is* the disambiguator: it is that film's cast, so there is no same-name problem to solve and nothing to ask a provider. The director's person id and `profile_path` are sitting in the raw credits even though only the name was flattened onto the movie row. Approved: the cheapest correct answer in the whole metadata layer, and it costs a JSON walk.

<sub>`internal/httpapi/portrait_handlers.go` · `docs/PLAN.md`</sub>

### Wikidata was dropped as a metadata source, then re-admitted for one portrait fallback

**Decided.** V2 of the plan dropped Wikidata outright — "weak fuzzy data, extra integration + throttling rules". It is back, used only to reach a P18 image and a Wikipedia link for an author already pinned by identity.

**Why.** What I rejected was Wikidata as a *search* surface, and that rejection still stands: a bare name query hits namesakes. What came back is different — the QID arrives from Open Library's remote ids on an author I have already disambiguated, so there is no fuzzy matching left to do. The narrow re-entry is the sparse-record case: an author with no Open Library photo and no wikidata link (David Reich is the standing example) is resolved by anchoring on a book they wrote and reading the work's author, P50, which is unambiguous where a name search is not. The portrait order is mine and deliberate: Open Library photo, then the Wikipedia lead image, then the P18. Two hosts were added to the cover allowlist for it. I approved the re-admission on the condition that it never runs from a name alone.

<sub>`docs/PLAN.md` · `internal/metadata/people.go` · `internal/metadata/covers.go`</sub>

### Hardcover was dropped as an API integration, then re-entered as an HTML scraper

**Decided.** V2 dropped Hardcover read *and* write — no documented write mutation exists for `reading_journals`, per-quote push is likely impossible via the public API, and the read half was not worth keeping alone. Removed with it: `hardcover_id`, `sync_state`, `/sync/*`, token handling. What exists now is `POST /import/hardcover-html`, which parses a saved journal page.

**Why.** The integration was dropped for the right reason and the *data* was never the problem. A saved page carries everything HTML-escaped as JSON in the `data-page` attribute of the Inertia root div, so the parser scans between markers and decodes — no API, no token, no sync state, and no HTML-parser dependency. The structs mirror only the slice needed and are tolerant: missing fields stay zero, variable-shaped ones (`entry` is a string on quotes and null elsewhere, `tags` varies) are kept raw and parsed defensively per entry. Journals that are not quotes are ignored. Mine, and the second form is strictly better than the one I abandoned — it needs no credential at all.

<sub>`docs/PLAN.md` · `internal/importer/hardcover.go` · `internal/httpapi/import_handlers.go`</sub>

### Metadata is fetched on demand only, and the one bulk path is admin-triggered and cursor-chunked

**Decided.** No background fetching, ever. `POST /books/lookup` and `POST /movies/lookup` return candidates for a person to pick. The single bulk path, `POST /covers/refetch`, is behind `requireAdmin` and processes up to `limit` rows after `cursor`, returning `{next_cursor, done, total, remaining}`.

**Why.** §8 sets an idle-CPU budget of approximately zero on a NAS sharing a box with a hundred other services, and a background enricher is a poller by another name. Chunking is not only about that budget: each HTTP request stays short, so a proxy timeout or a tab navigation can no longer silently abort a long run, and the client can draw real progress instead of a spinner that means nothing. The `total` is the full workload at that instant and `remaining` shrinks with the cursor. I approved the chunked shape after the un-chunked one died against a reverse proxy.

<sub>`docs/PLAN.md` · `internal/httpapi/metadata_handlers.go` · `internal/httpapi/server.go`</sub>

### TMDB ships a built-in application key, and the env var was dropped

**Decided.** `defaultTMDBKey` is a compile-time constant in `cmd/tippani/main.go`. Resolution order is: a direct programmatic key, then the Settings-saved custom key, then the built-in, then none — and none means a 503 with a clear message while manual entry still works. There is no environment slot.

**Why.** TMDB rate-limits per client IP, at roughly 50 req/s, so a key shared by every install never pools into one quota — which is why the Jellyfin/Kodi pattern of embedding an app key works, and TMDB permits it for open-source apps with attribution. The env var went because a key that can be set in three places is a key whose effective value nobody can state; it is managed in-app, where the Settings page can also report which source is in effect. The constant is empty in the source tree, which the roadmap names as the first thing a new install hits. My call, and the removal of the env slot is the half I was least sure about at the time.

<sub>`cmd/tippani/main.go` · `internal/httpapi/metadata_handlers.go` · `docs/PLAN.md`</sub>

### Provider secrets are booleans on read and pointers on write, and traces redact query-param keys

**Decided.** `GET /admin/metadata-keys` returns `tmdb_key_set`, `tvdb_key_set`, `google_books_key_set`, `amazon_cookie_set` — booleans — plus the Amazon domain, which is not secret. `PUT` takes `*string` per field: `nil` means "omitted, leave as-is", `""` means "clear".

**Why.** A stored secret is never echoed, so there is nothing for a compromised session or a screenshot to read back. Pointers are what make a partial save safe: a plain string cannot distinguish "the client did not send this field" from "the user cleared it", so saving just the Amazon cookie would wipe every other key. The trace layer closes the other leak — the v3 TMDB key travels as `api_key=` and the Google Books key as `key=`, both in the query string, so `redactURL` rewrites them before the URL reaches a debug line, and returns the URL byte-for-byte when there is nothing to hide. The v4 token and the TVDB JWT travel in the Authorization header and never reach a trace at all. Approved by me; the pointer half was a bug fix first and a decision second.

<sub>`internal/httpapi/metadata_handlers.go` · `internal/metadata/metadata.go`</sub>

### Name fields capitalise in the input, promote-only, and yield on a case edit

**Decided.** Every field holding a name or a title — Title, Author, Director/Creator, Series/Collection, Character, Actor, Speaker, the person rename box, the account display name — capitalises the first letter of each word **as you type**, via `capitalizeNames` + `useNameCasing` in `ui.jsx`. Three rules make it safe:

1. **The transform is on the input, never on the save path.** What the field shows is the string that gets saved. A capitaliser that ran at save time would pass its own tests while the form said "agatha" and the database held "Agatha".
2. **Promote only; never lower-case anything typed.** A word that already carries a capital anywhere is left alone entirely.
3. **It yields.** The first change that alters nothing but letter case flips the field to `free`, and it is never transformed again for the rest of that edit.

Word boundaries are whitespace and nothing else. Opt-in per field: `nameCase` on `Field` / `InlineField` / `TokenInput`, or the `NameInput` twin for forms that lay out their own inputs. Description, quote, ISBN, ASIN and the supplier ids do not get it.

**Why.** Rule 2 is the whole design. `titleCaseGenre` already existed and title-cases each word by lower-casing everything after the first letter, which is right for a genre — a word from a small closed vocabulary — and destructive for a name. Reusing it would return "McDonald" as "Mcdonald", "O'Brien" as "O'brien" and "Ian McEwan" as "Ian Mcewan". Combined with rule 1 that is not a display quirk, it is data loss on save. The "already has a capital → leave it" clause falls out of the same reasoning and pays for itself twice, keeping "eBay" and "iRobot" and giving a discoverable escape hatch: put a capital anywhere and the word is yours.

Rule 3 exists because an as-you-type capitaliser is otherwise an unappealable one. "bell hooks", "danah boyd" and "k.d. lang" are names, and a field that re-capitalises on every keystroke makes them unenterable. A change whose letters are identical and whose case is not can only be a deliberate re-casing, so that is the signal to stand down.

**Instead of** capitalising on blur, or on save. Blur was rejected because the change then happens away from the cursor, and re-editing re-applies it — the same unappealable behaviour with worse feedback. On-save was rejected outright: it breaks rule 1, and the divergence between the form and the database is invisible until an export or a group-by heading disagrees.

**Instead of** hyphen and apostrophe word boundaries. Promoting after a hyphen fixes "jean-luc" and breaks "e-mail"; after an apostrophe it fixes "o'brien" and produces "Schindler'S List". With titles in scope both trades lose, so the narrow rule promotes what it is sure of and leaves the rest to be typed.

**Approved.** Mine. I chose the scope — names *and* titles, not names alone — knowing titles are the riskier half, which is why the promote-only rule and the yield had to come with it rather than after it.

<sub>1.7.8 — `web/frontend/src/ui.jsx` · `web/frontend/test/pure/name-casing.test.js` · `web/frontend/test/dom/name-casing-field.test.jsx` · `CHANGELOG.md`</sub>

### A film's supplier ids are editable, and a typed id pins the next search

**Decided.** `tmdb_id` and `tvdb_id` are **editable fields**, typed or fetched. They still read as a link to the record they name, and picking a match under Fetch metadata still writes them, but both rows now edit in place like any other field on the Details panel and in the Metadata console's editor. They also *feed* the search rather than only recording its result: `POST /movies/lookup` takes `tmdb_id`/`tvdb_id`, fetches those records by id, and lists them ahead of the title hits, deduped against them. A title is no longer required — an id alone names one record exactly, which is more than a title ever did.

Two guards come with that. The id fields are `*int64` on `movieReq` while everything else on that PUT is full-state, because a supplier id is not a value you retype on every save and an older client that has never heard of it must not wipe it by omission — `nil` leaves the column alone, `0` clears it. And a hand-typed id another of the user's titles already holds is caught before the write, so the partial unique index reports as a 409 naming the collision instead of a 500. Correcting an id does not touch the cached cast or `source_metadata`, which still describe the old record until a re-sync goes and gets the new one: fixing the pointer is not the same act as following it.

**Why.** A title search cannot tell two films of the same name apart. Search TMDB for *Persuasion* and four films come back with that name; the id is the only thing that separates them, and it was the one field the picker could not be told.

**Instead of** a smarter matcher — more ranking signals on the title search, or a disambiguation step in the picker. Both are guesses about which record you meant, and the id already *is* the answer; adding cleverness to avoid asking for it would be a worse version of typing seven digits.

**Reversal.** This replaces the decision below, taken when the ids were introduced and overturned in 1.7.8.

> **A film's supplier ids are read-only, written only by picking a match.** `tmdb_id` and `tvdb_id` are set by `createMovieFromSource` / `resyncMovieFromSource` from whatever the fetched details carried, and shown as a link to the record rather than an editable field — the hint beside each said so in as many words: set by picking a match, not typed, because it is what a re-sync pulls from. An id you cannot type is an id that cannot be wrong: every one in the database arrived attached to a real fetched record, so the id and the cached payload beside it always described the same thing, and a re-sync could never be pointed at a record nobody chose.

That was sound about the id and wrong about the search that produces it: it defended the field from *becoming* wrong while leaving no way to fix it when it already was. The guarantee it bought — id and cached payload always agreeing — is kept anyway, because editing an id deliberately does not touch the payload; the two disagree only until the re-sync you edited the id in order to run.

**Approved.** Mine, both halves. The original was the conservative reading — plumbing only the machine writes has one fewer failure mode — and it cost more than it saved the first time a common title needed correcting.

<sub>1.7.8 (reversal) — `internal/httpapi/movie_handlers.go` · `internal/httpapi/lookup_handlers.go` · `web/frontend/src/WorkDetails.jsx` · `web/frontend/src/CoverPicker.jsx` · `CHANGELOG.md`</sub>

### The legacy `PUT /movies/:id {tmdb_id}` re-sync is told apart from an id edit by the title

**Decided.** `PUT /movies/:id` re-syncs from a supplier when the body carries `source`+`source_id`, or when it carries `tmdb_id` **and no title**. Anything with a title is an ordinary save, where `tmdb_id`/`tvdb_id` are two more editable columns.

**Why.** A bare `{"tmdb_id": N}` was the re-sync verb before `source`/`source_id` existed, and external clients may still send it. Making the ids editable gave the same field a second meaning, and the two had to be separated without breaking the old one. The title does it exactly: a full-state save is refused without a title, so a body carrying `tmdb_id` and no title cannot be an edit — there is no ambiguous case to guess at, which is why this is a discriminator rather than a heuristic. `POST /movies` was deliberately left alone: a create with `tmdb_id` still means create-from-source whether or not a title rides along, because nothing asked for a manual add that carries an id and changing it would be a silent break for the sake of symmetry.

<sub>`internal/httpapi/movie_handlers.go`</sub>

### A rejected key is reported as a rejected key

**Decided.** `ErrTMDBAuth`, `ErrTVDBAuth` and `ErrQuota` are distinct sentinels, and each produces its own message naming the remedy. Everything else gets the generic "lookup failed" with the real cause logged.

**Why.** "Try again in a moment" is false when the answer is that the credential is wrong, and it costs the reader an afternoon of retrying. So TMDB's 401 says a v4 token starts with `ey` and asks for the v3 API key, since pasting the wrong one of the two is the actual mistake people make. Google's quota case says whether *your* key was rejected or the shared free quota is exhausted, and gives the one-step remedy for each. The client still never sees a provider's raw error — that goes to the log with the ISBN and title — because a provider message is not written for this reader. My decision, and it is the same principle as the 404-not-403 rule pointed the other way: say what is true and useful, not what is safe and empty.

<sub>`internal/httpapi/lookup_handlers.go` · `internal/metadata/tmdb.go` · `internal/metadata/tvdb.go`</sub>

### A status chip appears only where there is something to say, and "working" is silence

**Decided.** The chip row under Metadata sources carries a chip for a **failed** book lookup, and for TMDB running on the shared built-in key or on no key at all. A working lookup produces **no chip**, a lookup nobody has tried yet produces **no chip**, and the row itself is not rendered when both are absent.

**Why.** The chip had three states and one of them was "OK". A badge that is present exactly when there is nothing to do about it, and absent the moment there is, teaches the reader to look at a place that is empty in every case that matters — and it spends a row under the heading to say so. Silence is the healthy state; the heading's info dot explains that, so the absence is documented rather than merely quiet.

Dropping the whole row rather than leaving an empty flex box is the smaller half of the same point: a gap under a heading reads as a missing element, not as nothing to report.

**Instead of** keeping "OK" and toning it down — grey instead of green, or smaller. Rejected because the objection is not that it is loud, it is that it carries no information.

**Reversal (1.15.2).** "Untested" was kept in 1.7.9 on this reasoning, which I now think was wrong:

> **Instead of** dropping "Untested" with it. That one *is* information a key field cannot give: whether anything has been tried since the process started, which is the difference between "your key is fine" and "nobody has asked yet".

The distinction is real and the chip was still the "OK" mistake wearing a duller colour. `books_lookup.ok` is null until the first book lookup of a *process's* life, so the chip greeted every admin on a freshly started or freshly restarted server — the exact moment they are least sure the thing works — with a word that sounds like a warning, describes no fault, names nothing to do, and clears itself as soon as anybody uses the app. "Whether anything has been tried yet" turned out to be a fact about the server's uptime dressed as a fact about the reader's configuration. The owner asked for it to go; I agree with the ask, and the reasoning above is what it corrects.

**Approved.** Mine for the original chip cull; the owner's for the reversal.

<sub>1.7.9, revised 1.15.2 — `web/frontend/src/Settings.jsx` · `web/frontend/test/dom/settings-key-field.test.jsx` · `CHANGELOG.md`</sub>

### The IGDB pair gets two rows and one warning, and the warning is only for half a pair

**Decided.** Settings → Metadata sources carries an **IGDB client id** and an **IGDB secret** row, write-only like the other secrets and saved independently. Neither set renders nothing. Exactly one set renders a line naming the blank half.

**Why it was missing, which is the part worth recording.** 1.15.1 shipped the games board, the IGDB lookup, the settings *endpoint* (`igdb_client_id` / `igdb_secret`), a GET that reports the halves separately, and an Add-sheet warning naming the screen to go and fix it on. The two rows on that screen were the only piece that did not land, and nothing failed: the handler had tests, the lookup had tests, the warning had a test, and the reader had no field. **Games were the one feature in the app whose key could only be set by editing the database** — while every layer under it reported itself healthy.

The GET's own comment had been describing this card since the release before it existed: *"Reported separately rather than as one `igdb_key_set`, so the Settings card can point at the half that is missing."* A comment about a caller is not a caller.

**Why no chip for "unset".** There is no shared built-in for IGDB the way there is for TMDB — the credentials are per-application and rate-limited to 4 req/s, so a key shipped with the app would be a shared quota — which means **unset is the ordinary state of every instance** until somebody registers a Twitch app. A standing chip for that is the "Untested" mistake with a new label, decided one entry above.

**Why a warning for half a pair.** That state is not ordinary and is not self-evident. It fails at the Twitch token exchange with "invalid client", which surfaces as a lookup failure — so the reader is told games are broken when one box is blank. It is the only IGDB state with something to act on, and it is exactly what the split booleans were reported for.

**Instead of** one combined "IGDB credentials" field taking `id:secret`. Rejected because correcting a mistyped secret would mean re-entering the id, which is the reason the server saves them independently in the first place.

**Approved.** The owner's: "Games apparently need IGDB key, but there is no option in metadata sources for that!"

<sub>1.15.3 — `web/frontend/src/Settings.jsx` · `web/frontend/src/help.jsx` · `internal/httpapi/metadata_handlers.go` · `web/frontend/test/dom/settings-key-field.test.jsx`</sub>

### Covers are downloaded once and served locally, never hotlinked

**Decided.** Every cover, poster and portrait is fetched once into `data/MediaCover/` and served from `/covers/{file}` under a server-generated filename. The CSP stays `default-src 'self'`.

**Why.** Hotlinking would put a third party in the render path of every board in the app: a runtime dependency on someone else's CDN, a leak of every reader's IP to it, and a CSP that has to name image hosts and then keep naming them. The cost is a few kilobytes stored per work, which on a library of any size is nothing next to the database. It also means a work keeps its art when the provider reorganises. My call, made in the plan and never revisited, and it is what lets the headers stay as short as they are.

<sub>`docs/PLAN.md` · `internal/metadata/covers.go`</sub>

### Cover fetches go through an SSRF host allowlist that follows redirects

**Decided.** `coverHosts` is the allowlist, checked on the initial URL *and* on every redirect target, with at most two redirects. `blockPrivateAddr` runs as the dialer's `Control` function, so loopback, private, link-local and unspecified addresses are refused at connect time. A user-typed URL drops the host allowlist and the https-only rule; every other guard still applies.

**Why.** Checking only the first URL is the classic hole — a permitted host that redirects to `169.254.169.254` is a permitted host. Checking at dial time rather than after a DNS resolution closes the rebinding gap, because the address the guard sees is the address the connection uses. The allowlist has grown honestly: `archive.org` and the `iaNNNNNN.us.archive.org` pattern are there because Open Library's cover service redirects through them and without them every OL cover died silently on the redirect hop. Two Amazon hosts, two Wikimedia hosts, TVDB's artwork host — each carries a comment saying which feature needs it. The relaxation for a pasted URL is deliberate and narrow: the user may point at any image host, but the private-IP guard, the size cap, the sniff and the redirect limit are not theirs to disable. I approved each host addition individually rather than widening the rule.

<sub>`internal/metadata/covers.go` · `docs/PLAN.md`</sub>

### The stored extension comes from the content sniff, never the URL

**Decided.** `sniffImageType` classifies the bytes; `imageExt` maps the sniffed type to an extension; the filename is 16 hex characters plus that extension, with nothing caller-controlled anywhere in the path. SVG is probed separately, floored at 48 bytes, refused outright if it contains script, and sandboxed by CSP on serve.

**Why.** A URL's extension is an assertion by whoever wrote the URL. Deriving the stored name from the bytes means a `.jpg` that is really something else cannot become a `.jpg` on my disk. SVG needs its own probe because `http.DetectContentType` never returns `image/svg+xml` — SVG documents sniff as `text/xml` or `text/plain` — and the probe anchors on the document root rather than searching for `<svg`, so an HTML page with an inline SVG cannot pass as an image. Refusing scripted SVG at rest is defence in depth: the serve path already sandboxes it, and a script-free file cannot attack anything even if a header is ever wrong. Mine, and the two-layer treatment of SVG is the part I would not trade away.

<sub>`internal/metadata/covers.go`</sub>

### Cover art is upgraded at the URL level, preferring Amazon's keyless ISBN-10 CDN

**Decided.** `AmazonCoverByISBN` converts an ISBN-13 to the ISBN-10 that Amazon's image CDN indexes by and requests the `_SCLZZZZZZZ_` variant; `AmazonFullSizeImage` strips the inline size modifier from any Amazon image URL so the stored file is the original scan; Google's is rewritten to a w1280-h1920 render. `maxImageBytes` was raised to 10 MiB and `minImageBytes` floors out placeholders.

**Why.** This is the trick book apps use for a hi-res cover when Google and Open Library only offer a thumbnail, and it needs no key — that host serves cover art openly. The bare `.01.jpg` returns a ~4 KB thumbnail while `_SCLZZZZZZZ_` returns the full-size cover, typically five times the bytes. The size caps had to move with it: the original 2 MB cap rejected exactly the full-size provider art this exists to get, so a cap written to bound abuse was silently bounding quality. A book Amazon does not stock returns a small "image unavailable" placeholder, which is what the minimum-size floor is for, so this is a source to *try* rather than a guaranteed hit. I approved raising the cap as part of the same change, because shipping the upgrade without it would have been a no-op dressed as a feature.

<sub>`internal/metadata/amazon.go` · `internal/metadata/covers.go`</sub>

### `missing_only` — a refetch mode that never replaces stored art

**Decided.** A boolean on `POST /covers/refetch` that fills empty covers and posters only and never upgrades a stored low-resolution image. It is what the mobile Metadata screen sends.

**Why.** The bulk refetch is otherwise happy to replace a thumbnail with a better scan, which is right when you asked for it on a desktop and watched the progress bar. A quick tap on a phone should not be able to churn art you are happy with — including art you uploaded or pasted yourself — and there is no undo for a replaced cover. Two intentions, one endpoint, one flag. My call.

<sub>`internal/httpapi/metadata_handlers.go` · `web/frontend/src/MetadataPage.jsx`</sub>

### "Fetch metadata" opens the edition picker instead of silently applying a guess

**Decided.** The button opens a candidate list; choosing a candidate opens a stored-versus-offered comparison; nothing is written until fields are ticked and applied. The info dot says so before you press it: "Nothing is applied yet."

**Why.** A one-shot fetch has to guess an edition, and editions differ in the fields people care about — the cover, the year, the description, the subtitle. A guess that lands is invisible; a guess that misses replaces something you typed. The picker costs one extra tap and converts an irreversible write into a choice. I approved the three-step shape (fields → lookup → merge) even though it is more screens than a button usually earns.

<sub>`web/frontend/src/WorkDetails.jsx`</sub>

### Metadata adoption has two modes: overwrite on an explicit pick, fill-empty-only on a one-click fetch

**Decided.** Picking a candidate and ticking fields overwrites those fields. The bulk refetch backfills empty author, description, year, genres and art and never overwrites anything.

**Why.** The mode follows the intent, and the intent is legible from which control you used. Choosing an edition from a list is a statement that this record is the right one, so honouring it means overwriting. Pressing a button that says it will fill in what is missing is not a statement about any particular field, so it must not touch one that is already filled. A title-only book skips the metadata backfill entirely in that path — a bare title match is too loose to trust — while still trying a candidate cover. Mine, and stating it as two named modes rather than one fuzzy policy is what stops the next endpoint picking a third.

<sub>`internal/httpapi/metadata_handlers.go` · `web/frontend/src/WorkDetails.jsx`</sub>

### Re-verify previews every changed field against the pinned identity and writes nothing until approved

**Decided.** `POST /metadata/reverify` re-runs each item's lookup against the *pinned* ids — `isbn`/`asin`/`google_id`, `tmdb_id`/`tvdb_id`, `people.source_id` or the stored cast — and returns per-field diffs without writing. `POST /metadata/reverify/apply` writes only what was approved, resending the previewed values. Rows where the stored value is empty arrive pre-ticked; anything that would overwrite arrives unticked.

**Why.** Targeting the pinned identity is what makes this a re-check rather than a re-guess: a by-name re-lookup could return a different book. The flow is stateless by design — no server-side diff session — so the client holds the preview and sends back exactly what the user saw and ticked, which is the same trust boundary as the existing PUT surface: whitelisted fields, the same validators, ownership-scoped SQL. The tick defaults encode the same rule as the adoption modes: a pure fill takes nothing away, so approving it is the reasonable default; an overwrite is the thing you opened this screen to review. It runs under `requireAuth` rather than `requireAdmin`, because both endpoints touch only the caller's own rows, with a 15-item cap per call bounding provider load and the client chunking above it. I approved the whole shape, including the pre-ticking, which is the only part that does anything without being asked.

<sub>`internal/httpapi/reverify_handlers.go` · `web/frontend/src/ReverifyReview.jsx`</sub>

### An ISBN names one book, so provider records are merged best-of per field

**Decided.** An ISBN lookup runs `mergeSameBook` and returns one record; a text search returns ranked rivals.

**Why.** Two providers describing one ISBN are not two choices — they are two partial accounts of the same object, and asking somebody to choose a *row* means choosing a whole set of fields at once. Pick the Google row and you get its blurb, its large cover and the year the paperback was printed. Pick the Open Library row and you get the first-publication year and often no description at all. Neither row is the best answer; the best answer is assembled: earliest non-zero year, highest resolution cover, longer description, fuller credit, the work's title rather than the edition's, and both providers' subject lists rather than one. On a modern paperback the year is a four-year quibble; on the Meditations it is eighteen centuries, and a shelf sorted by publication year was sorted by when the reprint went to press. My call, and each field's winner carries its own reason in the comment rather than a blanket "prefer X".

<sub>`internal/metadata/books.go`</sub>

### `adoptFirstPublished` takes min(year), and `sameWork` stays narrow enough that Ulysses does not merge with Ulysses

**Decided.** The earliest non-zero year any provider reported for the same work wins. With an ISBN, every candidate is that book, so no matching is needed. Without one, the titles must fold equal *and* the authors must share a token.

**Why.** The two sources answer different questions: Open Library's search returns `first_publish_year` — when the work was written — and Google returns `publishedDate`, which is the date of whichever edition it is describing. For a modern library they agree closely enough not to notice; for anything old they disagree by centuries. The rule is `min()` rather than "prefer Open Library" because a first publication cannot be later than an edition of it, and because if OL is the one missing a year, Google's edition date survives as the fallback. Both providers are already queried in the same call, so this costs no request. `sameWork` is narrow deliberately: a title search can return two different works with one name — Ulysses is Joyce's and Tennyson's — so folding on title alone would date Joyce to 1842. Sharing a *token* rather than matching whole is what lets "Marcus Aurelius" meet "Marcus Aurelius Antoninus", which is the exact case it exists for. Approved, with the Ulysses case pinned as a test rather than left as a comment.

<sub>`internal/metadata/books.go` · `internal/metadata/first_published_test.go`</sub>

### Book lookup matches title and author, falling back to title-only

**Decided.** With no ISBN, query Google `intitle:… inauthor:…` and Open Library `title=&author=`, rank the merged list by title+author similarity, and if the author-scoped query returns nothing, re-run title-only.

**Why.** Author-scoping sorts the edition you meant above the box sets, study guides and foreign reprints a title-only search surfaces first. It can also over-constrain — a slightly-off author string, or a supplier that indexes the author differently — so the fallback guarantees the change never yields *fewer* results than before, which is the property that made it safe to ship. Mine.

<sub>`internal/metadata/books.go`</sub>

### Look-alike titles are flagged for review, never auto-merged

**Decided.** `findSimilarBooks` and `findSimilarMovies` surface same-title candidates at import, at add-from-source and in the Metadata console's duplicate groups. Merging is always an explicit act — `POST /books/merge` — and a movie add past a look-alike needs `confirm_new`.

**Why.** The fuzzy title rule (subtitle dropped, punctuation stripped, case-folded) is right often enough to be useful and wrong often enough that auto-merging would lose real rows — two editions of one book are a merge, a film and its remake are not. Films are additionally scoped to the same `media_type`, because a movie and a show of the same name are never the same entry. On the merge itself: annotations re-point to the target and any that would collide on `(book_id, dedupe_hash)` are dropped rather than duplicated — `UPDATE OR IGNORE` leaves them on the source, which is then deleted — so a quote already on the target does not come back twice. Detection and action are separate endpoints on purpose. I approved this split; detection is cheap to be generous with, action is not.

<sub>`internal/httpapi/import_dupes.go` · `internal/httpapi/metadata_bulk.go` · `internal/httpapi/movie_handlers.go`</sub>

### Speaker remap matches the original character and never erases a speaker

**Decided.** `POST /movies/{id}/remap-speakers` reads every dialogue's character once up front and matches against that. `from` matches exactly, not case-folded. Mappings whose target character is empty are skipped.

**Why.** Reading the originals first is what stops chained renames cascading: with A→B and B→C in one request, matching against live values would carry A all the way to C. Exact matching on `from` is right because it is a stored label the UI handed back, and case-folding would collapse "Evey" and "EVEY" into one bucket with last-write-wins. Skipping an empty target is the important one: remap renames a speaker, and letting it blank one would be silent, unrecoverable data loss from a bulk operation. Mappings are capped at 500 and each field at 128 characters. My call.

<sub>`internal/httpapi/metadata_library.go`</sub>

### `missing_actor` counts only the lines that could actually be filled

**Decided.** The SQL counts dialogues with no actor **and** a non-empty character.

**Why.** Speakerless lines — narration, an unattributed line — have nothing to match against the cast, so no action can ever clear them. Counting them would inflate a warning tile with work that cannot be done, and a warning nobody can act on trains you to ignore the tile. I approved narrowing the count even though the headline number got smaller, which is the point.

<sub>`internal/httpapi/metadata_library.go`</sub>

### A movie resync overwrites supplier fields and never user-owned ones

**Decided.** `resyncMovieFromSource` re-pulls details and credits and overwrites title, director, year, description, cast, genres, series, poster, the source ids and `media_type`. `favorite`, `watching` and `series_index` are left alone.

**Why.** The split is not "old versus new", it is "who owns this fact". A title and a cast list are the supplier's answer and re-syncing is asking for it again. A favourite, a shelf state and your position in a collection are yours and the supplier has no opinion about them — overwriting those would be the app editing your library to match a provider. Mine, and the rule generalises: every place metadata lands, the question is ownership rather than freshness.

<sub>`internal/httpapi/movie_handlers.go`</sub>

### Genres are Title-Cased with acronyms preserved, and are garbage-collected where tags are not

**Decided.** `titleCaseGenre` normalises on write, leaving an all-caps token (YA, SFF) untouched. `gcGenres` deletes genres nothing references. Tags are never swept.

**Why.** Genres arrive from providers in whatever casing the provider used, so without normalisation one library ends up with "science fiction", "Science Fiction" and "SCIENCE FICTION" as three facets. Tags are the opposite: they are typed by a person and the casing *is* the person's, so they keep whatever you wrote. The sweep follows the same distinction — a genre is derived, so one nothing references is debris, while a tag is a managed vocabulary with a colour and a style you chose, and a tag dropping to zero uses is not a reason to throw away that choice. `cleanNames` already dedupes case-insensitively, so title-casing cannot introduce a new collision. My call, and the asymmetry is deliberate rather than an oversight in one of the two.

<sub>`internal/httpapi/taxonomy_handlers.go`</sub>

### Metadata API keys save per field, and a stored secret is write-only with a badge

**Decided.** Each key field saves on its own; a saved secret shows a small floppy-with-tick badge beside the edit button rather than a row of dots. The Amazon *domain* is not a secret and is shown in full.

**Why.** A row of dots is a lie about length and invites the reader to try to read it back; the secret is write-only here precisely so that nothing can reveal it, and one badge carries the one bit that is actually known — whether something is stored. Six keys meant six explanatory lines saying the same thing, so the badge replaced the prose. Per-field saving matches the pointer semantics on the server: a single "Save keys" button is a convenience that quietly wipes its neighbours. The domain stays visible because "www.amazon.de" is a setting, not a credential, and hiding it behind "saved" would make the reader guess which marketplace they configured. Approved by me as part of the density pass.

<sub>`web/frontend/src/Settings.jsx` · `internal/httpapi/metadata_handlers.go`</sub>

### Credit separators are a section of the Metadata card, not a card of their own

**Decided.** Four chips and a label at the bottom of Metadata sources; `none` is the explicit off switch rather than an empty string.

**Why.** Four chips and a label is not a subject; it is a footnote to one, and the subject is the card it now sits at the bottom of — a lookup returns "Gaiman & Pratchett" as one string and this decides whether that is one person or two, so the question only arises because of the sources above it. A card with four chips in it was claiming the same share of a settings page as the keys every lookup runs on. `none` is stored explicitly because an empty string would read as "unset" and fall back to the default on the server. The author string stored on each book is never rewritten — only the people views split — so the setting is safe to flip at any time. I approved the demotion; it is a smaller change than it looks and it is the kind the page needed a dozen of.

**Instead of.** A standalone Credits card (out of proportion). Empty string for off (indistinguishable from unset).

<sub>`web/frontend/src/Settings.jsx`</sub>

### A descriptive User-Agent, because Open Library rate-limits on it

**Decided.** One shared descriptive UA on every outbound call, with a 10 s client timeout and `io.LimitReader` on every body.

**Why.** Open Library grants 3 req/s (versus 1) to descriptive agents. Amazon needs the opposite kind of UA — a browser string, because it serves a bot wall to obvious non-browser agents — and is still strictly best-effort, since CAPTCHAs happen. Both constants sit next to comments saying which provider they are for, so neither reads as cargo cult. Mine, and the split is the honest consequence of two providers wanting opposite things.

<sub>`internal/metadata/metadata.go` · `internal/metadata/amazon.go`</sub>

### Provider scrapers use regexes over stable markers rather than adding an HTML parser

**Decided.** Hardcover's journal page is read by scanning between the `data-page` attribute's delimiters and decoding the JSON inside. Amazon's product page is read by three regexes over `og:title`, `og:image` and `og:description`.

**Why.** Both targets have a stable marker that carries everything needed, so a full parse buys nothing and costs a dependency — the plan holds Go direct deps at four, and a parser would be a fifth for two best-effort code paths. The `og:` tags in particular are the part of an Amazon page least likely to move, precisely because they exist for other people's crawlers. Both are explicitly fragile-proof rather than robust: an unreadable page returns an explanatory error rather than partial garbage, because half-scraped metadata written into a library is worse than none. I approved the regex approach with the fragility written down instead of denied.

<sub>`internal/importer/hardcover.go` · `internal/metadata/amazon.go` · `docs/PLAN.md`</sub>

### The Amazon cookie is opt-in, write-only, and its risk is stated rather than softened

**Decided.** An admin may paste an Amazon session cookie to enrich book metadata by scraping; off by default, stored write-only, never shown back.

**Why.** Book covers (the keyless image CDN) and Kindle highlight import (a file you export) both work with no cookie, so nothing core depends on it. The warning says plainly that the cookie grants access to your Amazon account and that automated scraping is against Amazon's Conditions of Use: the account whose cookie you supply bears that risk, so only you can decide to enable it. Tippani never ships, shares or centralises it, and only ever uses it on your behalf. I approved shipping the feature only with the warning at full strength — softening it would have been the same as shipping it on by default.

**Instead of.** Enabling it by default, or omitting the risk statement — refused.

<sub>`README.md`</sub>

### Fan-out to every source is slower and worse; a per-kind source picker is the planned answer

**Decided.** Today a lookup fans out to whatever happens to be configured, in an order baked into the code, and you find out what it consulted by reading the result. The roadmap's [choose your metadata sources](roadmap.html#metadata-sources) section plans checkboxes per lookup, remembered per kind.

**Why.** Fan-out spends every provider's quota on every query and gives the reader no way to say "just Open Library", which is the honest answer to a source that is simply wrong about a particular book. It also makes an unkeyed provider look broken: TMDB and TheTVDB do nothing without a key — their rule, not mine — and an unkeyed instance answers a 503 from a lookup that looked like it should work. Half of that half has shipped: Settings now says the state out loud with a chip reading "Built-in key" or "No key" plus a chip for whether the last book lookup worked, so it is no longer discovered by a failed lookup. What is open is the picker itself. Recorded as mine and still owed.

<sub>`docs/roadmap.html` · `internal/httpapi/metadata_handlers.go`</sub>

### The character-to-actor mapping is already stored, so character chips need no IMDb at all

**Decided.** Character chips are built from `movies.cast_json`, which already holds up to twenty top-billed `CastMember{Character, Actor, PersonID, ImageURL}` rows per film, harvested from the SAME TMDB credits call the details fetch already makes. No new fetch, no new supplier, no scraping, and nothing that has to be rate-limited.

**Why this is worth an entry.** The feature was specified around IMDb — "this will need IMDb IDs", with a once-a-day ceiling because IMDb blocks traffic. That is true of the character *pictures* and of nothing else. The mapping, which is the part every other piece of this depends on, is in the database now and is already served on the movie payload as `Cast`. `movies` has no `imdb_id` column at all — only `staged_works` carries one, marked informational — so the IMDb route would have started by adding an identifier to fetch data the app already has.

**The consequence for the review deck is the useful one.** §8's new `speaker` facet — *who said this line* — needs the character list and the mapping, and nothing else. So it is **not** blocked on the picture work, and the two can ship in either order. I said the opposite when proposing them; the cast column is the reason it is not so.

**Approved.** Mine, having checked `cast_json` before writing the plan the feature was requested as.

<sub>Not shipped — `internal/metadata/tmdb.go` · `internal/httpapi/movie_handlers.go`</sub>

### A character's aliases are the slashes in its own name, computed rather than stored

**Decided.** "V / William Rookwood" is one character with two names. The alias set is produced by splitting the stored character string on `/`, at read time, from `cast_json`. Both halves resolve to the same actor; **the quote keeps whatever name it used** — a line credited to "V" still reads "V", and is never rewritten to the full slashed form.

**Why no table.** The aliasing is a pure function of a string the supplier already gives us, so storing it would be caching a derivation — the same objection §8 makes to a stored `due_at` and §3 makes generally. It also cannot drift out of step with a re-sync, because it is recomputed from whatever the re-sync wrote.

**Preserving the quote's own naming is the load-bearing half.** The character string is a supplier's label; what the reader typed when they saved the line is the name that line uses, and replacing it with the canonical form would edit their quote to match a metadata provider. Resolution goes one way: from the name on the line, to the actor.

**Splitting on `/` only, not on the credit separators.** `metadata.SplitCredits` exists and is wrong here: it splits a list of *people*, and "V / William Rookwood" is one person under two names. A comma in a character field is far more likely to be part of a title ("Bob, the Baker") than a second character.

**Approved.** The reader's, in the form "sometimes the names of the characters are retrieved as \"V / William Rookwood\", in that case, both \"V\" and \"William Rookwood\" should resolve to that actor and preserve the quote's way of naming the character."

<sub>Not shipped</sub>

### Names in the line become chips; the credits below become text

**Decided.** A film or show line has its character names found in the quote text and drawn as chips in place. The block beneath, which currently shows actor portrait chips, becomes a plain **character — actor** list. The person keeps their ordinary people chip everywhere else; this changes only how a film's own page reads.

**Why.** The portraits below the line were answering a question the reader did not have. What they want while reading a line is *who is speaking*, which belongs in the line, and the mapping is a footnote — so the picture and the text were the wrong way round. Putting the chip on the name in the text also makes the line self-describing when it is shared or exported out of context.

**The matching is over the alias set** from the entry above, longest-first so "William Rookwood" is matched before "William", and case-insensitively at word boundaries so a character called Will is not found inside "willing".

**Approved.** The reader's, in the form "whose names will be highlighted in the card itself with their people chips. the bottom area where the actor chips sit now, will only name the character-actor mapping, not their image chips."

<sub>Not shipped</sub>

### The in-costume still is the only part that needs IMDb, so it is opt-in, per character, and cached hard

**Decided.** A character portrait — the actor in costume, as on `imdb.com/title/{tt}/characters/{nm}` — is fetched only when the reader asks for that character, stored per (movie, character), and used **only** for that film's own chips. The person's people-chip portrait is untouched. Any IMDb read happens at most once a day per title, with an explicit manual refresh, and an `imdb_id` on `movies` has to exist first.

**Why it is separated from everything above.** `CastMember.ImageURL` already carries a headshot from TMDB, and a headshot is not the thing being asked for: the point of a character chip is the character. That picture is not in any API the app already speaks to, which is the entire reason IMDb enters the design — and IMDb blocks traffic, has no API, and would be scraped. So it is the one part that is expensive, fragile and legally awkward, and it is therefore the part that is optional, manual and last.

**Storage, unlike the mapping.** This one IS a table — sparse, one row per character the reader actually asked about, created lazily, exactly the shape `item_reviews` uses. The absence of a row is the default, and a film nobody has fetched a still for costs nothing.

**The daily ceiling is a property of the title, not of the app.** Recorded so it is not later mistaken for a general politeness setting: one read per title per day, so refreshing a film's cast twice in an afternoon fetches once, and the reader gets a manual override because they know when they have changed something.

**Instead of.** Fetching stills for the whole cast on sync — twenty scrapes per film for pictures nobody asked to see. A Google image search — considered, and it is the fallback if IMDb proves unworkable, but it returns a page of guesses where IMDb returns the answer, so it would need the reader to pick, which is a different feature.

**Approved.** The reader's, in the form "if you fetch IMDB data, do that once a day only with optional user refresh. this is because otherwise Imdb blocks traffic" and "these will only be used for the actor chips in the movie itself. the person will retain his people chip as usual."

<sub>Not shipped</sub>

### IGDB for games, Wikidata for their voice cast, because nothing else exists

**Decided.** Games are fetched from IGDB (Twitch client-credentials OAuth, an Apicalypse POST API) for title, year, summary, cover art, genres, franchise and the studio with its logo. The **voice cast comes from Wikidata**, joined on the IGDB slug, via three batched Action-API calls — no SPARQL, no new host. An empty cast is a normal outcome, not a failure, and the stored cast stays hand-editable.

**Why, and this was measured against live APIs before any design.** Probed 24 well-known games on 2026-08-16. IGDB v4 has **no person endpoint and no credit endpoint at all** — its `characters` endpoint carries `akas, gender, mug_shot, species, description, games`, with no actor link. MobyGames' API exposes no credits endpoint. Giant Bomb returns an unroled flat `people` list. IMDb has the data and no API. So Wikidata is not the best of several options; it is the only structured free source that exists.

And it is thin, which changed what got built:

```text
Skyrim          66 credits, 66 with a character role, 38 with a portrait
Baldur's Gate 3 23 credits, 22 with a role
Cyberpunk 2077  17 credits
Elden Ring       9 credits, 9 with a role
Witcher 3 · Mass Effect 3 · Persona 5 · Disco Elysium · BioShock  → ZERO
```

Two of the four games the feature was requested for have no cast at all. **Half the stated hope is not deliverable, and saying so is the design.** A blank the reader can type into is honest; a lookup that reports success and shows nothing is not.

Two routes are walked, because the credits sit in two places: the game's own `P725` with its `P4633` character-name qualifier (which is already the shape `cast_json` wants), and a hop through `P674` characters to each character's own `P725` — the second is what rescues Half-Life 2, Final Fantasy VII and Persona 5.

**The game is pinned by slug, not matched by title.** `P5794` holds the IGDB slug, so `haswbstatement:P5794=elden-ring` returns `Q64826862` and nothing else. This is load-bearing: during the research a fuzzy title search picked *Hades II* for "Hades", and a wrong cast attached to a right game is a defect that reads as correct.

**Instead of.** A `games` cast table — there is nothing to put in it that `cast_json` does not already hold. SPARQL — `wbgetentities` batches 50 ids, which is what makes the plain Action API enough: Skyrim's 66 credits resolve in three requests rather than 133. A built-in shared IGDB key, as TMDB has — the credentials are per-application and rate-limited to 4 req/s, so a shared key is a shared quota.

**Approved.** The reader's, after the research: accept the one-time Twitch key so games get cover art, fetch the cast by both Wikidata routes, and keep it hand-editable.

<sub>0040 — `internal/metadata/igdb.go`, `internal/metadata/igdb_cast.go`</sub>

### A studio and a director share one column, so every query keyed on either must name the media type

**Decided.** `orphanRefQuery`, `personCreditSQL` and `handlePeopleNames` all narrow their `director` arm to `media_type <> 'game'` and gain a `studio` arm scoped to `media_type = 'game'`. `validPersonKind` is backed by an enumerable `personKinds` slice, and the invariant tests range over it.

**Why.** This is the **third** appearance of a hazard this file already carries a twenty-line comment about. The first was `gcOrphanPeople`'s default-plus-overrides; the second was `handleRenamePerson`'s two separate switches; both were fixed. The third — `handlePeopleNames` — was missed, and the plan for this feature named only the first two. Left alone, the Metadata console's director list would have answered with every studio in the library, tallied, named as directors and **offered for renaming** — the identical sentence written up about translators and authors one kind earlier. Knowing the shape is not the same as having swept for it.

The rename's blast radius is the larger one: `metadata.ReplaceCredit` matches a name as a *component* inside a joined credit, and rename has no undo.

**What this also exposed.** Two invariant tests written specifically to catch this class were passing vacuously. `TestEveryValidKindHasAReferenceQuery` and `TestEveryValidKindIsRenameableOrExplicitlyNot` both carried hand-written kind lists under comments claiming they were "kept in step with validPersonKind by construction" — one listed six kinds, the other four, against a vocabulary of six. A seventh would have passed both without being checked. That is the same defect as the parity test in `AI.md` that skipped embedded structs: **a test whose coverage is a copy of the thing under test agrees with it forever.** Both now enumerate `personKinds`, and a third test asserts the media-type predicate is present in all six director/studio query strings — a sweep rather than an example.

**Approved.** My call; the third-instance sweep was not in the plan and is the reason it was found.

<sub>0040 — `internal/httpapi/people_handlers.go`, `internal/httpapi/people_gc_test.go`</sub>

### A game's publisher is its own column, and the developer-to-publisher fallback is gone

**Decided.** Migration 0042 adds `movies.publisher`. `igdbCredits` and `GameDetailsWikidata` return the developer and the publisher as two values; neither stands in for the other. Where a record names only a publisher, the studio is empty. Where several companies are flagged developer, the one with the **narrower claim** wins — a company flagged developer *and* publisher is passed over while a developer-only company exists.

**Why.** Reported exactly: *Mass Effect Legendary Edition* stored **Electronic Arts** as its studio. EA published it; BioWare made it.

0040 mapped "studio" onto `movies.director` on good grounds — a show's creator already lived there — and both suppliers were then written to fall back from the developer to the publisher when no developer was flagged, on the stated reasoning that "a blank studio is worse than a slightly wrong one", measured as developer logos on 18 of 24 games against publisher on 22. **That reasoning was sound about one column and became wrong the moment the fact had somewhere else to go.** A field labelled STUDIO naming a company that did not make the game is not vagueness; it is the interface asserting something false in the present tense, which is the same class 0041 fixed for provenance and for the same reason.

**The tie-break is where the reported bug actually lived, and I did not see it until I looked at the payload shape.** Removing the fallback alone would not have fixed the report. IGDB's `involved_companies` is a set of flag pairs in **no meaningful order**, and a label that owns the studio it published through is routinely entered as both — so "the first row flagged developer" picked EA by array position while BioWare sat further down flagged developer alone. The narrower claim is the only signal in the payload. It narrows an answer and never blanks one: a studio that publishes its own game is named in both fields, because both are true of it, and there is a test asserting that specifically because it is the way this change could have made things worse. Wikidata's P178/P123 take the same rule, and the studio LOGO is now read off the entity the name came from rather than the first `P178` statement — otherwise the tie-break would leave the icon and the credit beside it describing two different companies.

**A publisher gets no `people` row**, unlike a studio. 0037 set the bar — a new kind must have BEHAVIOUR, not just a label — and a studio clears it with a logo, a click target and its own slot where a director's face goes. A publisher here has none of that: it is a name on a details page, and nothing groups, portraits or navigates by it. So it is a plain column and plain mono text (`PUB.`), and a clickable name would promise a page that does not exist.

**Not backfilled, and it cannot be.** Every game stored before 0042 holds either its developer or its publisher in `director` and **nothing records which** — that is the defect. Guessing would write the same wrong fact into a second column and give it the authority of having been migrated. The remedy is a re-fetch, which is why the publisher is deliberately **overwritten** by a re-sync rather than preserved the way a hand-typed `imdb_id` is: the supplier is the authority on this one, and keeping a blank would leave the row exactly as wrong as it was.

**Instead of.** Splitting `movies` into `movies`/`shows`/`games` — the reasoning 0040 measured (twenty query files, 105 `'movie'` literals, and a failure mode of *silence*) has not weakened, and this defect was not caused by the shared table but by a shared *field with two meanings*, which is what giving the second meaning its own column fixes. A CHECK tying the column to games — a film has a distributor and a show has a network, both the same kind of fact, and the CHECK would be the obstacle the next time either is wanted. Indexing it in `movies_fts` — a fourth column means dropping and rebuilding the external-content table and all three of its sync triggers, which 0029 is the record of the care required for, bought for a field nobody has asked to search by.

**Approved.** The reader's report, and my call on the shape. The five write sites were swept rather than patched — create, full-state update, re-sync, bulk edit and the export round trip — because a column some paths write is the defect class this repo has documented five times, and the two front-end full-state bodies (`movieState`, `fullState`) are the ones that silently *clear* a column rather than merely miss it.

<sub>0042 — `internal/metadata/igdb.go`, `internal/metadata/wikidata_games.go`, `internal/httpapi/movie_handlers.go`, `internal/httpapi/game_publisher_test.go`</sub>

## 7. Search and the Full-Text Index

Search is FTS5 external-content indexes maintained by triggers, which buys me not storing every quote twice and costs a corruption mode that took four attempts to recover from. Every query string is escaped on the way in, and the facet work is planned so that a malformed query is impossible to send rather than merely rejected.

### External-content FTS5 indexes, kept in sync by triggers

**Decided.** Five virtual tables — `books_fts`, `annotations_fts`, `movies_fts`, `dialogues_fts`, `utterances_fts` — declared `content='<table>'` with `content_rowid='id'`, kept in step by AFTER INSERT / DELETE / UPDATE triggers (the update trigger issues an FTS `'delete'` row then re-inserts). External content means the index stores terms and not text, so a quote is not stored twice. The plan attaches a condition to that choice which turned out to be the important one: keep an `INSERT INTO x_fts(x_fts) VALUES('rebuild')` maintenance path. Because the index is derived, a corrupt one loses nothing recoverable — it can always be rebuilt from the content it mirrors, and every repair in this section rests on that. I approved the design at plan time and the escape hatch with it.

**Instead of.** A contentless or self-contained FTS5 table, which stores the text again.

<sub>from 0.1.0 — `docs/PLAN.md` · `internal/store/repair.go`</sub>

### Changing indexed columns means dropping and rebuilding the table

**Decided.** `books.series` and `movies.series` were added in `0006` and never wired into the FTS tables, so a search for a franchise or reading-order name — "Malazan", "Middle-earth" — returned nothing. External-content FTS5 cannot `ALTER` in a new column, so `0010` drops the triggers and the virtual table, recreates it with the extra `series` column, re-points the triggers, and repopulates via `'rebuild'`. Dropping the virtual table drops its shadow tables too, and the rebuild re-derives the whole index from content, so no data is lost. NULL series columns index as empty. I signed this off once I had established that the rebuild is non-destructive; on a derived index it is the cheap operation, not the scary one.

**Instead of.** A second index alongside, or matching series through a denormalised text column as `genre_text` does. The second column would have been a fifth thing to keep in sync.

<sub>0.9.x (migration 0010) — `internal/store/migrations/0010_fts_series.sql`</sub>

### FTS index names are constrained in two silent directions

**Decided.** Both constraints break silently, which is why they are written into the migration that most recently had to obey them. First, `store.Recover()` copies base tables while the sync triggers are live, excluding anything matching `'%\_fts'` or `'%\_fts\_%'`; a name outside that pattern gets copied into a live FTS index and reports as `database disk image is malformed` on the next insert. Second, `rebuildFTSTable` finds an index's triggers with `sql LIKE '%<name>%'`, so an FTS name that contains or is contained by another one cross-wires two repairs. The 0026 migration states the check it performed: `utterances_fts` is neither a substring of nor a superstring of `books_fts`, `annotations_fts`, `movies_fts` or `dialogues_fts`. I approved recording the check in the migration rather than in a style guide, because the person naming the next index is looking at a migration.

**Instead of.** An explicit list of index names in `Recover`, replacing the pattern. That trades a naming rule for a registration rule, and a forgotten registration is just as silent.

<sub>1.5.0 (recorded), applies from 0001 — `internal/store/migrations/0026_utterances.sql` · `internal/store/repair.go`</sub>

### Raw input never reaches an FTS5 `MATCH`, and `LIKE '%…%'` is banned

**Decided.** Parameter binding does not stop syntax interpretation. Input passed to `MATCH` is parsed as FTS5 *query syntax* even when bound — `AND`, `OR`, `NOT`, `NEAR`, `col:`, `-`, `*`, `^`, quotes — so malformed input errors and crafted input changes semantics. Every query goes through `search.Query` / `PrefixQuery`, which double-quotes each whitespace token (doubling embedded quotes) and joins with implicit AND. The package comment carries the rule at the top of the file so it is unmissable. The plan's other search rule is just as absolute and for a different reason: never use `LIKE '%…%'` anywhere, because a leading wildcard cannot use an index and turns a millisecond lookup into a table scan on a box that cannot spare the CPU. Both are mandatory, both are mine.

**Instead of.** Stripping operator characters rather than quoting tokens. Quoting preserves the user's words; stripping silently changes their query.

<sub>from 0.1.0 — `internal/search/fts.go` · `docs/PLAN.md`</sub>

### `prefix='2 3'` and `remove_diacritics 2`, plus a 200 ms client debounce

**Decided.** Every FTS table is declared `tokenize='unicode61 remove_diacritics 2'` and `prefix='2 3'`. The prefix index keeps 2- and 3-character typeahead index-backed instead of term-expanding, at roughly a 20–30% larger index. That is the trade I want on this hardware: disk is cheap, CPU is not, and the box is a NAS sharing itself with about a hundred other services. `remove_diacritics 2` makes "Bronte" find "Brontë". The client debounces input around 200 ms so a typeahead box does not issue a query per keystroke. I approved the whole set as one decision, because they only make sense together — the prefix index exists to serve typeahead, and the debounce is what keeps typeahead affordable.

**Instead of.** No prefix index and a trailing `*`, which term-expands at query time; that moves the cost from disk to CPU, which is backwards here.

<sub>from 0.1.0 — `docs/PLAN.md` · `internal/store/migrations/0001_init.sql`</sub>

### One `/search` endpoint for free text; structured filters stay on the lists

**Decided.** `GET /search?q=&scope=&limit=` handles free text. Structured filters — tag, colour, `book_id`, `movie_id` — live on `GET /annotations` and `GET /dialogues`, where the UI actually uses them, and are deliberately not duplicated onto `/search`. Two implementations of "quotes tagged grief" is two places to fix a bug and two places for the answers to disagree. Every query is scoped to the session user without exception. My call, taken at plan time under a KISS argument, and the facet work in 7.20 is careful not to break it: facets narrow the free-text search, they do not become a second list API.

**Instead of.** One universal query endpoint doing both.

<sub>from 0.1.0 — `docs/PLAN.md` · `internal/httpapi/search_handler.go`</sub>

### Results are sectioned by what matched, with a cross-column fallback

**Decided.** A query that hits an author name lands in *Authors* — the name, heading their books — not as bare book rows; a note match lands in *Notes*, not *Annotations*. The sections are Books, Annotations, Movies, Dialogues, Quotes, Authors, Directors, Actors, Speakers, Notes, Tags and Genres, each independent, and the client renders only the non-empty ones. Sectioning by column has one failure mode, and I did not want to discover it in use: a query whose tokens span two columns matches nothing in either. So `runMixedPass` re-runs the unrestricted queries — implicit AND across all indexed columns of a row, the pre-facet behaviour — when no single facet matched, and "casab mich" still finds *Casablanca* by Curtiz. I approved the fallback in the same release as the sectioning, because sectioning without it is a regression.

**Instead of.** Always running both passes and merging, which costs a second query on every search for a case that is rare.

<sub>0.9.1 — `internal/httpapi/search_handler.go`</sub>

### What gets indexed is prose, not filter values

**Decided.** `utterances_fts` indexes `quote`, `note`, `speaker` and `occasion`. The occasion is in because it is the title this kind of quote has, and a title you cannot search for is the gap the whole feature would be judged on — "who said the thing about freedom", "that Burma broadcast". `place` and `medium` stay out. They are filter values, like a genre, not prose: indexing them would let a search for "radio" return every quote ever broadcast, ranked above the one that is actually *about* radios. I approved the line at exactly that boundary, and it is the line the facet plan (7.20) then builds on — filter values become facets, not index columns.

**Instead of.** Indexing everything on the row, which is the default instinct and produces exactly the ranking failure above.

<sub>1.5.0 — `internal/store/migrations/0026_utterances.sql`</sub>

### Search must count only what it can show

**Decided.** A tag worn only by standalone quotes rendered a chip reading `grief · 3` above an empty box, and a day on which you had saved only quotes rendered `Added on … · 0`. The counts were right about the library and wrong about the result: they counted rows the section had no scope to display. A count beside an empty box is not a small cosmetic defect — it tells you the search is broken and gives you no way to find out otherwise. Speakers got their own section in the same release, beside Authors and Actors, for the reason that governs the whole sectioning scheme: searching a person's name is asking about the person. I approved both, and they are one decision viewed from two sides — a section exists so that what matched can be shown, and a count is only honest about what the section will show.

**Instead of.** Showing the library-wide count with a note. Rejected: the note is the thing nobody reads.

**Reversal.** Yes, of the counting behaviour shipped with the standalone-quote work earlier in the same release.

<sub>1.5.0 — `internal/httpapi/search_handler.go`</sub>

### Typo correction runs only on zero hits, over zero-storage vocab views

**Decided.** When the exact pass returns zero hits across every requested scope and the query is correctable — at least one token of 3 runes or more, at most 8 tokens, at most 64 runes — the handler harvests indexed terms from per-index `fts5vocab` views and corrects each token by bounded Levenshtein in Go, then re-runs the same `MATCH` once. Three properties I insisted on. It runs only on zero hits, so a search that worked is never second-guessed. The vocab views (migration `0016`) are zero-storage — they read each FTS index's own term dictionary, so there is nothing new that can corrupt, and `store.Recover()` skips them via the `%_fts_%` name pattern. And a vocab read that fails even after the one-shot index repair logs `TIP-SRCH-004` and degrades to the plain empty result: search never 500s because fuzzy broke. I approved it on that last condition specifically.

**Instead of.** A stored spelling dictionary, or correcting on every query. The first is a table that can corrupt; the second is a search that overrules you.

<sub>0.6.9 — `docs/PLAN.md` · `internal/httpapi/search_handler.go`</sub>

### The last token is corrected in prefix mode with no upper length bound

**Decided.** `Window` returns the indexed-term length range worth harvesting, and for the final token — when `lastIsPrefix` — it returns `hi == 0`, the no-upper-bound sentinel. This is a typeahead box, so the last token is a word still being typed, and it is scored in prefix-distance mode: "shawsq" has to reach "shawshank". Capping the harvest length would silently drop exactly those targets, which is the correction most worth making. The lower bound still holds, because matching a much shorter term needs deletions beyond the budget, and the handler pairs `hi == 0` with a popularity `LIMIT` so an unbounded length range cannot harvest the entire vocabulary. I approved the asymmetry — bounded below, unbounded above — once the `LIMIT` was in place to pay for it.

**Instead of.** A generous fixed cap, which is the same bug with a longer fuse.

<sub>0.6.9 — `internal/search/correct.go`</sub>

### Corrected tokens flow back through `PrefixQuery`, and `corrected` is scoped

**Decided.** Two invariants, both about not leaking. Corrected tokens are re-escaped through `PrefixQuery` on the way back, so the raw-input-never-reaches-`MATCH` rule of 7.4 survives the fuzzy path — there is a test whose only job is that (`TestCorrectOutputIsMatchSafe`). And although the vocabulary is index-wide rather than user-scoped, the re-run stays `user_id`-filtered and the response's `corrected` field is set **only** when this user actually received rows. Without that, "did you mean *Bhagavad*?" would report the existence of another user's book. I approved the index-wide harvest on the condition of the scoped report; the two are not separable.

**Instead of.** Per-user vocab views, which fts5vocab cannot express, or filtering the harvest in Go, which would mean reading every user's terms anyway.

<sub>0.6.9 — `internal/search/correct.go` · `docs/PLAN.md`</sub>

### Structured facets parse the raw query only, never the fuzzy re-run

**Decided.** The decade facet (`1990s`, `90s`, `90's`) and the date-added facet (`2026-07-14`, `14 July 2026`) parse the raw query and are guarded on whether it *parsed* as one, not on whether it *found rows*. A date or a decade is not a typo. "80s" with nothing from the 1980s must stay empty and must never be "corrected" into "90s" — the user asked a precise question and got a precise, empty answer. The Stats activity calendar links straight into the date facet with the ISO form, so this path also has to be exactly literal. My call, and the comment in the handler says so at the point where it would be easy to get wrong.

**Instead of.** Letting a zero-hit decade fall through to the fuzzy pass like any other query.

<sub>0.9.1 (facets), 0.6.9 (fuzzy interaction) — `internal/httpapi/search_handler.go`</sub>

### Tag and genre facets carry the user scope on both halves

**Decided.** For each matching tag the handler runs two queries: a count, and a page of the quotes wearing it. Both carry `user_id`. For book annotations and film dialogues the scope arrives through the parent join; for standalone quotes it is on the row itself, because since `0026` an utterance has no parent. The comment in the code gives the reason bluntly: a tag id is guessable, and the count alone would report how many quotes a stranger filed under it. A count is a disclosure. I approved this and I would treat a missing scope on either half as a security defect rather than a bug.

**Instead of.** Scoping only the page and trusting the count as harmless.

<sub>1.5.0 — `internal/httpapi/search_handler.go`</sub>

### Edition grouping in book search is strict on purpose

**Decided.** Printings of the same book — identical title *and* author — fold into one row, with the editions one tap behind a chevron. The match folds only case, diacritics and punctuation, so *Dune* and *Dune: Book One* stay apart. That strictness costs me some genuine duplicates that stay unfolded, and I accepted the cost knowingly: fusing distinct works is the unrecoverable direction. An unfolded pair is a cosmetic annoyance the reader can see and fix; a fused pair hides a book behind another book's chevron and looks correct. I approved the conservative rule.

**Instead of.** Fuzzy title matching, which is what the metadata candidate ranker does — but that surfaces a *choice* to a human, and this does not.

<sub>1.0.0</sub>

### Corrupt-index recovery escalated three times before it worked

**Decided.** This is the most instructive sequence in the repo, so it is recorded in full. 0.4.6 added the startup FTS integrity check and rebuilt a corrupt index by dropping and recreating it, on the correct observation — stated in that release's own notes — that a bare `rebuild` cannot fix page-level corruption because it re-reads the same bad pages. 0.4.7 found that a badly-corrupt index makes even `DROP TABLE` raise `database disk image is malformed`, and added `Recover`: copy every intact base table into a fresh file, let the triggers repopulate, never read the corrupt pages. That should have been the end of it. It was not, because the *runtime* path — the one a live search hits — had been left running a bare `rebuild`, the version 0.4.6 had already documented as insufficient. Every search 500'd until a restart. 0.6.4 finally pointed the runtime path at the same drop-and-recreate the startup path used. My mistake was fixing one caller and not auditing the others, and it is the reason the repair primitives now live in one file with one lock.

**Instead of.** None worth the name; each step was a correction of the last.

**Reversal.** Twice over, and the second reversal was of a gap I had left, not of a decision I had taken. That is worse.

<sub>0.4.6 → 0.4.7 → 0.6.4</sub>

### `ftsQuery` repairs in-request, and refuses to escalate on the hot path

**Decided.** `ftsQuery` runs the `MATCH`, and on failure calls `Store.RepairIndex` — DROP the triggers and the virtual table, recreate both from DDL read out of `sqlite_master`, then `'rebuild'` — and retries once. Search recovers within the same request. What it deliberately does *not* do is escalate to `Recover()`, even though that is the strictly more powerful repair, because `Recover` swaps `s.DB` and would race in-flight request goroutines on the hot path. The rare case where even `DROP` fails is left to `RepairFTS` → `Recover` on the next (now-clean) restart, or to the admin "Rebuild search index" action. Repairs serialise on `repairMu`, so two concurrent searches hitting the same corrupt index cannot race on the DROP. I approved the deliberate ceiling; a self-heal that can swap the database out from under a live request is not a self-heal.

**Instead of.** Escalating in-request, which is the tempting completeness.

<sub>0.6.4 — `internal/store/repair.go` · `internal/httpapi/search_handler.go`</sub>

### A searched quote wears its colour, falling back to the border

**Decided.** Colour stopped being decoration in 1.7.1, when the six slots became categories you name. Every surface carried it — the Library, a work's page, the export, the share card — and search did not, on an odd seam: standalone quotes were built later and built right, so they carried their colour, while every book annotation and every film line came back with none. A library sorted into six named categories looked uncategorised the moment it was searched. The quieter half is worse: the share sheet opened from a result reads the colour off the row, so sharing a quote you found by *searching* dropped its category line while sharing the same quote from its book kept it. Result rows now wear the same left bar the card they stand for wears, and a row whose colour is unrecognised falls back to the plain border rather than to slot 1 — because slot 1 is a category somebody may have named, and painting an unknown row with it would assert a choice nobody made. I approved the fallback direction explicitly; it is the same rule that keeps slot 1 from being treated as a deliberate category anywhere else.

**Instead of.** Defaulting an unknown colour to slot 1, which is what an ordinary `??` would have done.

**Reversal.** Yes, of an omission carried since 1.7.1.

<sub>1.7.5</sub>

### Search facet grammar lives entirely on the client; the wire format stays typed

**Decided.** `field:value` is a typing affordance that lifts a token into a chip; the client sends structured parameters (`?q=…&tag=stoicism&tag=death&colour=doubt`). The server never parses the syntax. A grammar the client parses for chips and the server re-parses for SQL is a grammar that drifts, and the drift shows up as a query that renders one way and matches another. Keeping it client-side means a malformed facet is impossible to send rather than merely rejected, and it makes the URL the honest record — every chip is a query parameter, so a search is bookmarkable, shareable, and reusable by a saved view. My call, and I stand by it.

**Instead of.** A shared query grammar parsed on both sides; rejected on the named drift risk.

<sub>1.10.0 — `internal/httpapi/search_facets.go` · `web/frontend/src/facets.js` · `web/frontend/src/SearchPage.jsx`</sub>

### AND or OR is a property of the facet, not a global rule

**Decided.** A quote has one colour. `colour:doubt colour:joy` under an all-AND rule means "has two colours", which nothing does, so that query returns nothing forever and looks broken. Under per-facet rules it means "either", which is what you would say out loud. Meanwhile `tag:stoicism tag:death` *must* be an intersection, because narrowing by two tags is a real question in a quote library and OR would widen it. One rule cannot serve both, so the rule is a property of the facet: multi-valued facets (`tag`, `genre`) get one `EXISTS` per value, ANDed; single-valued ones (`colour`, `shelf`, `series`, `year`) get one `IN (…)`, OR within it. I approved the per-facet rule over a global one, and over exposing the choice to the user, which would be a toggle nobody wants to think about.

**Instead of.** A global AND/OR, or a user-facing switch.

<sub>1.10.0 — `internal/httpapi/search_facets.go` · `web/frontend/src/facets.js` · `web/frontend/src/SearchPage.jsx`</sub>

### Facet values never reach a `MATCH`, and an unknown facet is a 400

**Decided.** The facets are ordinary SQL predicates on ordinary columns; only the free-text `q` reaches FTS, and it reaches it the way it does today (7.4). That keeps the escaping surface exactly one function wide. Separately, an unknown facet name is a 400 rather than a silent ignore, because a typo'd facet that is quietly dropped returns a *wider* result set that looks like a correct answer — the failure mode where the user cannot tell they were not answered. `fuzzyCorrect` keeps its zero-hit behaviour and corrects free text only: a facet value came from a list the user was shown, so correcting it would be second-guessing a choice rather than a typo. All three are mine, and all three are the same instinct — never widen silently.

**Instead of.** Ignoring unknown facets for forward compatibility.

<sub>1.10.0 — `internal/httpapi/search_facets.go` · `web/frontend/src/facets.js` · `web/frontend/src/SearchPage.jsx`</sub>

### Search vocabulary is one cached call, returning colours as key and name

**Decided.** `GET /search/vocabulary` returns tags, genres, series, authors, speakers, actors, directors, colours and shelves in one call, fetched on first focus of the search box and held for the session. A personal library's vocabulary is small: this is one request, not one per keystroke, and the dropdown is instant with no flicker behind the typing. Narrowing is prefix-match first, then `editDistance` as a fallback, so an exact prefix never loses to a fuzzy match on a different word. Colours come back as **key and name** — `{"key":"blue","name":"doubt"}` — because 1.7.1 made them user-named: the chip must read `colour:doubt` and the query must send `blue`. A facet that showed the storage token would be showing the user something they deliberately renamed. Per-user isolation applies as everywhere: the vocabulary is `WHERE user_id = ?`, and a name that is not yours is not offered. I approved the whole endpoint, and the key/name pair is the part I would not let slide.

**Instead of.** A per-keystroke suggest endpoint, or returning colours as bare keys.

<sub>1.10.0 — `internal/httpapi/search_facets.go` · `web/frontend/src/facets.js` · `web/frontend/src/SearchPage.jsx`</sub>

### Context-aware search made visible and removable, with a right-click globe

**Decided.** The context-aware half is already built and already deliberate — `searchScoped` in the shell scopes the top bar's search to whatever you were looking at, and the drawer's search clears the scope. What is missing is that nothing on screen says which one you got. So board filters and work pages become removable chips: on the Library filtered to *reading* the search opens with `shelf:reading` already up; on a work's page, `book:The Dispossessed`. Every seeded chip is removable, so narrowing is free and widening is one click. On desktop the top search is always context-aware and **right-click on the icon toggles global**, with global wearing a small globe in the search circle. That toggle has no on-screen affordance, and its discoverability is a known cost I accepted deliberately: it goes in `help.jsx` and the UI glossary, which is where this app documents its other invisible gestures. There is one cross-plan dependency I want on the record — `Tooltip` calls `onContextMenu => preventDefault()` on every control it wraps, including the search icon, so the suppression needs an opt-out that the context menu plan also needs; whichever ships first should add it.

**Instead of.** A visible global/local switch, which spends permanent chrome on a rare action.

**Reversal.** None; this makes existing behaviour legible rather than changing it.

<sub>1.10.0 — `internal/httpapi/search_facets.go` · `web/frontend/src/facets.js` · `web/frontend/src/SearchPage.jsx`</sub>

### Filter sheets are rewired onto the facet state rather than replaced

**Decided.** The Library and Catalogue filter sheets keep their checkboxes, and setting one writes a chip. Sheet and bar become two editors of one state, so they cannot disagree. This is the largest single piece of work in the release and the only one that touches screens outside search, and it is worth it for one reason: with facets able to express everything a sheet can, leaving them separate would mean two ways to say *tagged stoicism* that do not know about each other. The nine `useState`s per board collapse into the facet state and `onReset` becomes clearing it. It gets its own commit, last, after the facets are proven — it is where a regression would actually land. I approved both the scope and the ordering.

**Instead of.** Deleting the sheets in favour of chips, or leaving them independent.

<sub>1.10.0 — `internal/httpapi/search_facets.go` · `web/frontend/src/facets.js` · `web/frontend/src/SearchPage.jsx`</sub>

### Four things the facet plan had wrong, found by building it

**Decided.** Recorded as one entry rather than folded silently into the six above, because a plan corrected without trace reads as a plan that was right.

**`wishlist` has no column and cannot have one.** The plan listed it beside `favourite` and `note` as a "boolean predicate", which reads as an equality on a column. 0024 gave it none on purpose — a work with no quotes in it *is* the wishlist, so it needs no storage and can never drift out of step with the count it is derived from. The facet is a count-zero predicate.

**The filter sheets were not where the plan said, and there were not nine `useState`s each.** Both boards render `WorkListScaffold`, which owns the sheet, the desktop row and the sheet's own open/close state; the boards pass value/setter pairs down. The counts are nine and **ten** — the Catalogue has `mediaType` too — and each board has a second filter surface on its detail page that the plan never mentions.

**Part 4's `scope:` chip was not built, and the reason it was proposed is not true.** The plan said `searchScope` "just had nowhere to show itself". It has somewhere: the scope row above the results has shown the active scope as a highlighted chip since the screen was built, and *All* is one click away. A second control saying the same thing in the same row of the same screen is not more legible, it is two things to keep in step. The *seeding* Part 4 describes — arriving already narrowed to where you came from — is built and is the half that was worth having.

**The grammar needed a way out of itself, which the plan does not mention at all.** Thirteen ordinary English words become operators the moment `field:` is a syntax: `note:`, `series:` and `year:` are things a reader writes in a note. Without an escape those phrases are unsearchable, and unsearchable *silently* — the box opens a dropdown and the words never reach the query. A backslash before the colon is the way out.

**Three smaller ones.** A board's `tagged` and `noted` cannot seed `tag:` and `note:` — the board's are properties of the **work**, derived from its children, and the facets are properties of the **quote**, so sending one as the other empties the section and a search from a filtered board comes back with nothing. `q` had to stop being required, which the plan does not mention and which its own Part 1 makes unavoidable: lifting the token out of the box is what leaves the box empty. And `Tooltip`'s right-click line turned out to be load-bearing once rather than twice — it stops the platform menu, and `useCardMenu`'s own guard is what stops the card menu.

**Approved.** Mine, all four, written after building rather than while planning — which is the only moment any of them could have been known.

<sub>1.10.0 · recorded 1.14.2 — `web/frontend/src/facets.js` · `web/frontend/src/works.jsx` · `internal/httpapi/search_facets.go`</sub>

### What a board filter means to a search is decided before the filter ships

**Decided.** A board publishes its filters to the search box as a seed, so adding a filter is also a promise about what pressing Search will do. Every filter therefore has to answer that question before it ships, and there are three legitimate answers: seed it unchanged; drop it at the boundary (`BOARD_ONLY_FACETS`, for `tagged`, `noted` and `media`, which the server has no facet for); or change what the filter is built on so the two agree.

**Why.** The Catalogue's actor filter is what made the rule explicit. Two sources were available and they are not the same set — the cast a metadata fetch wrote, and the credits on the lines actually saved — and they diverge for exactly the films that have been fetched and not quoted, which in a library that imports covers before highlights is most of them. `actor:` in search reads the line credits. A board built on the cast would therefore have filtered to one set of films and seeded a search that answered with another: a filter whose meaning changes on the way to the search box, silently, and in the direction of *more* results, which reads as the search being broken rather than as the filter being wrong. So the board reads what the facet reads.

The third answer is the one worth naming, because it is the one nobody reaches for. `tagged` and `noted` are dropped because no honest mapping exists; the actor filter was not dropped — the filter was rebuilt so a mapping did.

**Instead of.** Sourcing the filter from `movies.cast_json`, which is richer, already fetched, and answers a different question.

<sub>1.14.2 — `internal/httpapi/movie_handlers.go` · `web/frontend/src/facets.js` · `web/frontend/src/Movies.jsx`</sub>

### "More like this" from the existing term dictionaries ships first

**Decided.** Semantic search via `sqlite-vec` would cost a dependency and an indexing pass. There is an 80% version that costs neither: take a quote's highest-value terms from the `*_fts_vocab` views that already exist for typo correction and run them as one `OR` match. It ships before the embedding model, because it may well be enough — and if it is, the dependency never gets added. I approved sequencing it this way on the general rule this project runs on: build the version that uses what is already there, then find out whether the expensive version is still wanted.

**Instead of.** Going straight to embeddings.

<sub>planned — [search precision](roadmap.html#search-precision) — `docs/roadmap.html`</sub>

### Semantic search and `sqlite-vec` deferred indefinitely, as a decision

**Decided.** PLAN §9 lists semantic search under *Deferred*, and §4 closes with the sentence I want kept: semantic search remains deferred — `sqlite-vec` later, if ever. That is recorded as a decision rather than left as an omission, because the two read identically from outside and only one of them is honest. The costs are a dependency, an indexing pass over every quote, and a model — on a box budgeted at 20–40 MB RSS and effectively zero idle CPU. I made this call and it is the one I am least likely to revisit; 7.25 exists precisely so that the question can be answered without it.

**Instead of.** Shipping it; not writing it down.

<sub>deferred from 0.1.0 — `docs/PLAN.md` · `docs/roadmap.html`</sub>

### A feature nobody can find has not shipped

**Decided.** The facet grammar shipped in 1.10.0 complete on every layer — parser, chips, vocabulary endpoint, SQL, URL round-trip — and 1.16.0 shipped a **Filters panel** beside the scope chips that does nothing new except make it visible. Nothing about the engine changed.

**Why.** The report was three words: *"I do not see search facets yet"*, then *"these should have landed before"*. Both were true at once, and that pairing is the whole finding. The only affordance the feature ever had was one placeholder string — `Search, or type tag: author: colour:…` — which is on screen until you type a single character and then gone. Using facets required having read that line, remembered it, inferred that the trailing `…` meant more fields than the three named, and guessed which. On a phone it sat over a keyboard that had just covered half the screen, with no tab key to complete with. So Tippani had a faceted search only its author could operate, and the correct description of that is not "shipped".

Two further things made it worse and are recorded because they are the same mistake in a second place. `docs/roadmap.html` §3 still listed **"Field operators"** as a coming feature fifteen releases after it shipped, and **"Highlight the matched words"** likewise — so a reader who could not find facets in the interface and went to the roadmap to check was told, twice, that they did not exist. §1 was carrying three more (the manifest surfaces, the app-icon badge, the rotating login epigraph). All five came out in 1.16.0. That is thirteen shipped items culled across two releases, all of them in the hand-written backlog, which `scripts/roadmap-data.mjs --check` cannot see — it validates only the generated sections.

**The rule the panel is built on.** It adds chips; it does not add a second grammar. Picking a value calls the same `makeChip`/`addChip` the dropdown calls, so a chip built by pressing is indistinguishable from one built by typing. `facets.js` opens by explaining why the syntax lives on one side only — *"a grammar the client parses for chips and the server re-parses for SQL is a grammar that drifts, and the drift does not announce itself"* — and a panel assembling its own query object would reintroduce exactly that, one file apart instead of one process apart.

**Instead of.** Counts beside each value, deferred at the time — see the next entry, which is where that got revisited and where the deferral turned out to be right about the principle and wrong about the price.

<sub>1.16.0 — `web/frontend/src/SearchPage.jsx` · `web/frontend/src/facets.js`</sub>

### The combining rule decides how a facet is counted, and getting it uniform makes one of the two lie

**Decided.** Every facet value carries a count of the hits it would give under the current search. An **AND** field (tag, genre) is counted *with* its own chips applied; an **OR** field (colour, shelf, series, year, every credit, the work ids) is counted *without* them.

**Why.** `combine` has said since 1.10.0 that a second tag intersects and a second author unions, and that is exactly the question a count has to answer: *what happens if I press this*. Pressing a second tag narrows, so the number beside it must be the intersection. Pressing a second author widens, so the number beside it must be what allowing that author **as well** would give.

Count them the same way and one of the two is a lie, in a direction that looks like a bug either way. Under an all-with rule every unpicked colour reads 0 for ever — the panel looks broken at precisely the moment it is working correctly. Under an all-without rule a second tag advertises a number nothing will ever show you.

**What the deferral got right and wrong.** The 1.16.0 note said counts were not worth *fifteen queries per value per field*, and that counting the library rather than the result is worse than nothing. The second half still holds and is the reason this is computed per query. The first half was a bad estimate of a design I had not worked out: it is one `GROUP BY` per field per applicable kind — about thirty in total, over indexed columns of a personal library — on its own route, so the panel pays for them and the 200 ms-debounced typeahead does not.

**A zero is reported rather than omitted**, and the pill greys and stays pressable. A value that vanishes when you narrow leaves a reader wondering whether they mis-remembered their own library; a grey one says *not under this question*, which is both the answer and a pointer at the chip to remove. What is omitted is anything that is not a value at all: an empty credit column is not an author called `""`, and `year 0` is "no year recorded".

**A joined credit's count lands on each name**, so the sum across the map exceeds the number of rows. That is correct rather than a rounding error — a book credited to two people is one hit under each, and pressing either finds it.

**Instead of.** Folding the counts into `/search` (thirty GROUP BYs behind every keystroke); or sharing one table of field-applicability with `where()` — the counter keeps its own and a test walks both, because a shared table that has to be read two different ways is how the last three drifts in this file started.

<sub>1.16.0 — `internal/httpapi/search_facet_counts.go`</sub>

### `book:` and `movie:` became grammar, reversing "there is no vocabulary of titles"

**Decided.** Both fields carried `typed: false`, keeping them out of the grammar entirely on the reasoning that *"there is no vocabulary of titles to offer, so typing `movie:blade runner` could only ever open a dropdown with nothing in it"*. 1.16.0 removed the flag, added `books` and `movies` to `/search/vocabulary` as id/title pairs, and made both fields typeable like the rest.

**Why I was wrong.** A personal library *is* a list of its own titles. The list is no longer than the author list the endpoint was already sending, and it costs one query each. The old reasoning described a query nobody had written, not a fact about libraries — and `book:` is the single most obvious thing in the box to reach for, which made it the one field that answered by doing nothing.

The id is still what goes on the wire, and that is why these are their own fields rather than a title search: two editions, a translation and the film of the book can all carry one name, and only an id says which you meant. So they join the colour slots as `{key, name}` vocabularies — chip shows one thing, wire carries another.

**The cost, stated rather than discovered.** `the book: of the new sun` now reads as a facet. That is the same trade thirteen ordinary English words already made in 1.10.0, and it has the same way out: `book\:` searches for the words. The escape exists precisely so a word can become an operator without becoming unsearchable.

**Also.** The dropdown now shows five options at a time with a `More (n)` row, rather than a flat eight. Five is what fits above a phone keyboard; a menu over hundreds of titles that you can fall down is not a menu.

<sub>1.16.0 — `web/frontend/src/facets.js` · `internal/httpapi/vocabulary_handler.go`</sub>

### A character is not a person, and gets a section rather than a face

**Decided.** Searching a character's name lands in a **Characters** section — the name, a count, and their lines — and `character:` is a fifth credit facet. The name is a plain chip and a button; there is no portrait.

**Why.** `dialogues_fts` has indexed `character` since 0003, so character search worked all along. What was missing was anywhere for a match to *land*: `ftsCols: "quote character"` put it under the film it came from, so "everything Tyrion says" meant reading six posters and assembling the answer yourself. `actor` has never behaved that way — it is not in the dialogue query's columns at all, so an actor search has always produced an Actors section and an empty Dialogues one. The asymmetry was not a decision; it was the absence of the section.

So `character` moved out of the dialogue columns into its own query. **Dialogues answers "these words matched"; Characters answers "this speaker matched".** A query hitting both still gets both. `import_search_test.go` used to assert the opposite — *"a character query stays a dialogue hit"* — and that assertion inverted, with the comment rewritten from a rule into a record of why it used to be true.

No portrait, and that is the decision rather than an omission. Every other credit section here resolves to a `people` row with a photograph. A character resolves to nobody. Hanging the actor's face there would answer a question nobody asked and be wrong the moment a part is recast or shared — and the review loop had already settled the same point for its *"who said this?"* card: name only.

Games needed nothing: a game is a `movies` row (0040), so its lines are `dialogues` and the whole feature covers them by construction. A regression test says so anyway, because a future `AND media_type <> 'game'` would drop them silently.

**Instead of.** A `people` row per character, with portraits and a console — a different feature at a different price, and one the owner has already ruled against at the interface.

<sub>1.16.0 — `internal/httpapi/search_handler.go` · `internal/httpapi/search_facets.go` · `web/frontend/src/SearchPage.jsx`</sub>

## 8. The Review Loop

Spaced repetition is an exponential forgetting curve evaluated in SQL at query time, chosen so that due-ness needs no stored due date and no background sweep. Almost every subsequent decision here is a reversal, including the two that removed a feature and brought it back.

### Recall is computed at query time from a stored half-life

**Decided.** Recall probability is `p = 2^(-elapsed_days / stability)`, with `stability` the memory half-life in days. A card is due when `elapsed >= stability`, so both due-ness and most-forgotten-first ordering reduce to plain `julianday()` arithmetic. `dueSQL` is written once and spliced into both the deck and the badge.

**Why.** No math functions, no stored due date, no background job, nothing ticking — which is what §8's CPU budget demands on a box sharing a hundred other services. Statuses are derived at read time and never stored, so an edit cannot leave a stale one behind. `dueSQL` exists as a single string because spelling it twice is how the deck and the badge come to disagree about how many cards are left.

**Instead of.** A stored `due_at` column plus a sweep — rejected; it is a cache of an expression that costs nothing to evaluate.

**Approved.** Mine, and I approved it as the founding constraint of the whole feature rather than an implementation detail.

<sub>0.4.0 — `internal/httpapi/review_handlers.go` · `docs/PLAN.md`</sub>

### Review state lives in its own table

**Decided.** Migration 0013 put the schedule in `annotation_reviews`, one row per annotation, created lazily on the first answer; rows without one are the unseen pool.

**Why.** So that editing a quote, toggling its heart, or re-importing it never disturbs the schedule. Review state also never enters a dedupe hash and is invisible to FTS, for the same reason.

**Approved.** My call; I approved the separate table over three columns on `annotations`.

<sub>0.4.0 — `docs/PLAN.md` · `CHANGELOG.md`</sub>

### annotation_reviews became a polymorphic item_reviews

**Decided.** Migration 0015 replaces it with `item_reviews`, keyed `(kind, item_id)` — `book`, `screen`, later `utterance`. Every existing book half-life is carried forward verbatim.

**Why.** Films and shows became first-class review material, and a table cannot hold a real foreign key to two parents. `ON DELETE CASCADE` is replaced by one `AFTER DELETE` trigger per parent. 0026 spells out why the third trigger is not cosmetic: `id` is a plain `INTEGER PRIMARY KEY`, so SQLite reuses a rowid once the highest row is deleted, and an orphaned schedule row would be silently adopted by the next quote created — arriving carrying a stranger's stability, review count and lapse history.

**Approved.** Mine, and I approved carrying the schedule forward rather than starting everyone over, which was the cheaper migration.

<sub>0.5.0 — `internal/store/migrations/0015_review_rework.sql` · `internal/store/migrations/0026_utterances.sql`</sub>

### quiz_results was replaced by quiz_sessions, and the old score history dropped

**Decided.** 0015 replaces 0014's `quiz_results` with `quiz_sessions` — one row per reviewer-local day per mode. The previous multiple-choice score history is not carried over.

**Why.** `quiz_results` modelled the old MCQ round and cannot express the daily-versus-practice split. Migrating it would have meant inventing a mode for every historical row. The schedule itself — the part that matters — is fully preserved.

**Instead of.** Mapping every old row to `mode='daily'` — rejected as fabricating history.

**Approved.** I approved the drop, and made it say so in the release notes rather than letting people discover an empty chart.

<sub>0.5.0 — `internal/store/migrations/0015_review_rework.sql` · `CHANGELOG.md`</sub>

### Configurable srGrow / srShrink half-life multipliers

**Decided.** 0.4.3 exposed the growth factor (1.5–4×) and the lapse-keep factor (0.1–0.6×) as two Settings sliders, alongside a 365-day cap and a late-recall bonus.

**Why.** The update rule was a multiplication either way, so making the two constants adjustable looked free, and I did not want to assert one schedule over everyone's memory.

**Reversal.** Retired eleven releases later. What I got wrong is that two sliders over a rule nobody can evaluate is not a choice, it is homework — a reader has no way to tell whether 2.5× is better than 3× for them, and the app could not tell them either.

**Approved.** Mine at the time, and mine when I took it away.

<sub>0.4.3 — `CHANGELOG.md`</sub>

### A fixed 7 → 30 → 100 ladder replaced the tunable rule

**Decided.** A correct recall climbs to the smallest rung strictly above the card's current half-life; a card's first-ever success starts at 7 whatever created its row; a single lapse falls straight back to 7 from any height; 100 is the ceiling. Migration 0019 clamps stored values above 100 down to it and lets off-ladder values climb onto the nearest rung at their next answer. Both preferences retire, dropped on read.

**Why.** Three intervals a person can hold in their head beat two multipliers nobody can evaluate. The rungs *are* the review intervals, because a card is due when `elapsed >= stability`.

**Reversal.** Yes — of 0.4.3, entirely.

**Approved.** My call and I stand by it; the ladder is the version I can explain in one sentence to somebody using the app.

<sub>0.9.5 — `internal/store/migrations/0019_review_ladder.sql` · `internal/httpapi/review_handlers.go` · `CHANGELOG.md`</sub>

### The half-life floor rose from 1 day to 7, with a grace week for a new quote

**Decided.** `reviewMinStability` is 7 days — the ladder's first rung, the floor applied to stored stabilities in the due-ness SQL, and the unseen-card default. `reviewNewItemDays` gives a quote its first week reading "remembered" and not yet due, from `created_at`. A recorded lapse still wins over the grace week.

**Why.** A one-day floor asks you about a quote you wrote down yesterday, which is not a memory test. Having just written something down counts as knowing it. The floor is applied in the queries rather than by rewriting rows, because a stored stability can predate a floor raise.

**Approved.** I approved both numbers, and specifically the exception that a lapse beats the grace — otherwise a wrong answer would be silently forgiven for a week.

<sub>0.8.6 — `internal/httpapi/review_handlers.go` · `CHANGELOG.md`</sub>

### A recorded lapse is decisive

**Decided.** A card whose most recent answer was "forgot" reads as probably forgotten however recently it was reviewed, until the next successful recall.

**Why.** The forgetting curve assumes the last review was a *successful* recall — `p = 1` at elapsed zero. A wrong answer also resets `last_reviewed_at` to now, so without this any fresh answer, right or wrong, read as fully remembered on the tally and on every status dot. The failed attempt is the fact, not the timestamp it left behind.

**Approved.** Mine, and I approved it as a correction to the model rather than a display fix, because the deck ordering reads the same value.

<sub>0.6.2 — `internal/httpapi/review_handlers.go` · `CHANGELOG.md`</sub>

### Repetition statuses renamed to describe recall, and derived live

**Decided.** Soon / later / someday became remembered / forgetting / probably forgotten, with a fourth for unseen, computed at read time from recall probability and never stored.

**Why.** The old names described the raw half-life bucket, which is a fact about the schedule. The new ones answer the question the reader is actually asking, which is whether they can recall the quote now.

**Approved.** My call, approved with the derivation kept at read time so a rename could never leave a stored value behind meaning the old thing.

<sub>0.5.0 — `internal/httpapi/review_handlers.go` · `CHANGELOG.md`</sub>

### Daily Quiz and Practice are two modes with different contracts

**Decided.** Daily Quiz is the authoritative scheduler: due cards only, no skip, every answer recorded, always moves the half-life, permanent per-day history and streak. Practice is unlimited, skippable, covers the whole in-scope pool, and by default does not move the schedule — `srPracticeCounts` opts in — with its own resettable score.

**Why.** One surface trying to be both is a surface where you cannot tell whether answering costs you anything. Separating them means Practice can be used freely without consequences, which is the only way it gets used.

**Approved.** Mine, and I approved the default being off: opting *into* consequences is the safe direction.

<sub>0.5.0 — `internal/httpapi/review_handlers.go` · `CHANGELOG.md`</sub>

### Multiple choice was removed for self-graded recall, then restored

**Decided.** 0.5.0 removed the MCQ round entirely — its distractor machinery and the `srQuizLen` / `srQuizScope` preferences went with it — on the reasoning that honest self-graded recall is the point of spaced repetition. 0.6.1 restored multiple choice for both modes and both directions.

**Why.** The reveal was awkward in practice, and badly so in the "which quote is from this work?" direction, where self-grading asks you to judge whether what you half-remembered counts. Restoring it named the old reasoning rather than pretending the removal had not happened; the schedule, the scores and the status dots are untouched, only the interaction changed.

**Reversal.** Fully. What I got wrong was treating a principle about retrieval practice as a principle about interface, and throwing away working distractor code on the strength of it.

**Approved.** Both decisions are mine and I approved both; the second one is the one I would defend.

<sub>Removed 0.5.0, restored 0.6.1 — `CHANGELOG.md`</sub>

### Distractors are chosen to be plausible, and the rule differs by medium

**Decided.** `distractorScore` prefers the same medium strongly. Within books, the same author dominates and shared genres break ties. Within films and shows, shared genres dominate and a shared actor breaks ties — never the director. A standalone quote follows the book rule with its speaker in the author's place. Cross-medium candidates score only on weak genre overlap.

**Why.** A random wrong answer is a question about nothing. Two books by one author are each other's hardest wrong answer, and two speeches by one person are so for the same reason. The director is excluded deliberately: a director is not what a viewer remembers a line by, so it produces a distractor that looks plausible to the schema and not to the reader. A standalone quote gets the author rule because there are no genres to break the tie with.

**Approved.** The per-medium rule is mine and I approved it in that exact form, director included.

<sub>0.6.1 — `internal/httpapi/review_handlers.go` · `CHANGELOG.md`</sub>

### Quiz options are sent whole and clamped on the client

**Decided.** Quote options used to be cut to 140 runes server-side with an ellipsis. They are now sent in full; the client clamps them.

**Why.** 140 runes is about three lines on a phone, so on any quote longer than a sentence the reader was asked to choose between four passages whose endings they could not read, and no amount of tapping would show them. Clipping was the server deciding a layout question, and deciding it destructively. It had a second cost: two quotes sharing a 140-rune opening were folded together as duplicates by `choicesFrom`, quietly leaving a card with fewer choices than it should have had.

**Reversal.** Of my own server-side truncation.

**Approved.** Mine, and I approved moving the decision to the only place that knows how much room there is.

<sub>1.5.2 — `internal/httpapi/review_handlers.go` · `CHANGELOG.md`</sub>

### The quiz option's expander is its own button

**Decided.** Each option's "show the rest of it" control is a separate button beside the option, not a tap on the option itself.

**Why.** Choosing an option answers the question. There is one shot per card and the grade posts immediately, so an expand gesture sharing that hit area would eventually grade a card because somebody wanted to finish reading it.

**Approved.** My call, approved as part of the same change — sending the whole quote without this would have traded one defect for a worse one.

<sub>1.5.2 — `CHANGELOG.md`</sub>

### The Daily Quiz seeds every shuffle

**Decided.** `seededRand` folds the local-day seed with the card identity into one stable per-card seed, so distractor choice *and* order are identical for every client viewing the same day's card. Practice passes 0 and uses the global RNG.

**Why.** Re-randomising on each request changed the wrong options between browsers and left only the right answer stable — which is a way of telling you the answer. The same seed is why a refresh returns the same deck rather than a new one.

**Approved.** Mine; I approved seeding the whole option set rather than only the card order, which was the version that leaked.

<sub>1.x — `internal/httpapi/review_handlers.go`</sub>

### The deck served the same few books for weeks

**Decided.** Diagnosed as two independent causes and fixed as two.

**Why.** The bounded fetch was a **rowid prefix, not a sample**: both ordering keys tied across huge blocks of rows — for an unseen card the overdue ratio is `NULL`, so every unseen card tied — and SQLite breaks ties in scan order. The importer writes book by book, so annotation ids are contiguous per book and `LIMIT 40` returned forty rows from one book. Separately, unseen cards could not reach the deck **at all** while a backlog existed, because one query ordered seen-before-unseen let the due bucket fill the whole fetch. Either fault alone would have looked like the other.

**Approved.** I approved treating the report as two bugs after the first fix did not move the symptom, which is the part worth recording.

<sub>1.0.0 — `CHANGELOG.md`</sub>

### Deck ordering hashes the id, the buckets are fetched separately, and spreadByWork rotates

**Decided.** Every ordering ends in `shuffleKeySQL` — `(id * 2654435761 + kindSalt + seed) % 100003` — the due and unseen buckets are fetched by separate queries, and `spreadByWork` re-orders the merged list by rotating through one queue per work, taking each work's best-ranked remaining card in turn.

**Why.** The hash breaks the tie that made the fetch a prefix. Separate fetches stop one bucket starving the other. The rotation stops one book owning a deck, and its trade-off is deliberate and stated: a work with 400 quotes and a work with 2 get one slot per rotation each, so a large book is covered more slowly than its share of the library — which is the point, since the complaint being fixed is a big import monopolising every deck. Queue order is first appearance, so the most-overdue work still leads.

**Approved.** Mine, and I approved the unfair-to-large-works trade rather than weighting by size.

<sub>1.0.0 — `internal/httpapi/review_handlers.go`</sub>

### Every third Daily slot is reserved for a never-seen card

**Decided.** `reviewUnseenShare = 3` — at the default quota of 8, two unseen a day. Either bucket yields its slots when empty. Practice deliberately does not inherit the reservation.

**Why.** It is a policy trade-off, not a derivation, and the arithmetic is written down: a brand-new card takes the 7-day rung on its first correct recall, so it returns at +7 and again at +37 before reaching 100 — two returns per admission, plus N/100 a day of maintenance once a library matures. Holding intake to a third keeps that inside a default quota for a few hundred cards; past that the quota is the reader's lever. Deferring a due card does not make the schedule lie: the header promises a due *state*, the seen bucket stays ordered most-overdue-first, and a backlog degrades into honest FIFO by overdue-ness. Practice has no schedule to honour, so reserving slots there would make an already-reviewed card several times *more* likely to come up than an unreviewed one.

**Approved.** I approved the ratio and the reasoning behind refusing it to Practice, which is the half people would expect to be symmetric.

<sub>1.0.0 — `internal/httpapi/review_handlers.go` · `CHANGELOG.md`</sub>

### reviewSource descriptors put the five queries that must agree in one place

**Decided.** A `reviewSource` struct names each kind's table, parent, parent key and its own eligibility rule, and builds `from()`, `ownerCol()`, `reviewJoin()`, `where()` and `bucketClause()` from it.

**Why.** Five queries have to agree on what is reviewable — the two deck buckets, the badge count, the status tally and the Stats half-life — and until standalone quotes arrived they agreed by being copies of each other, which held only because annotations and dialogues have the same shape. Standalone quotes have neither a parent table to take the user scope from nor the same eligibility rule. Copies would have diverged the first time one was updated and another forgotten, and the symptom is a badge promising cards the deck will not serve.

**Approved.** Mine, and I approved the refactor before the feature rather than after the first divergence.

<sub>1.5.0 — `internal/httpapi/review_handlers.go`</sub>

### A standalone quote's card is sourced from the occasion, falling back to the speaker

**Decided.** Every card asks where the quote is from. For the other two kinds that is a title read off a parent row; for an utterance it is the occasion — the speech, the broadcast, the letter — falling back to the speaker when the occasion went unrecorded.

**Why.** A standalone quote has no parent to take a title from, and "where is this from" is the whole question. Two speeches by one person are each other's hardest wrong answer, the way two books by one author are.

**Reversal.** The standalone-quote design predicted the review deck would "apply unchanged". It did not, and that turned out to be the most interesting part of the feature. The roadmap keeps the wrong prediction and the correction side by side, because a roadmap that only keeps the predictions that came true is not worth reading.

**Approved.** Mine, and I approved leaving the bad prediction visible rather than editing it out — which was the easy option and the one I refused.

<sub>1.5.0 — `docs/roadmap.html` · `internal/httpapi/review_handlers.go` · `CHANGELOG.md`</sub>

### A quote with neither speaker nor occasion is kept but never enters the deck

**Decided.** `utteranceSource()` carries an eligibility clause of its own: `AND (COALESCE(x.occasion,'') <> '' OR COALESCE(x.speaker,'') <> '')`.

**Why.** A proverb is perfectly fine to keep, and there is nothing to recall but the words already in front of you. It makes utterances the first kind whose reviewable pool is smaller than its table, which is exactly why the five queries had to be made to agree.

**Approved.** Mine — keeping it and excluding it were one decision and I approved them together.

<sub>1.5.0 — `internal/httpapi/review_handlers.go` · `docs/roadmap.html`</sub>

### Review scope was an exclusive three-way Toggle whose "Both" named three media

**Decided.** Settings offered *Books*, *Films & shows*, and a third option labelled **Both**, which silently meant all three.

**Why.** It began as a two-way switch when there were two media, and the third arrived without the control being revisited.

**Reversal.** The word undercounted what it did, and because the three were exclusive, "books and quotes but not films" was unsayable: narrowing away one medium cost you another you had not mentioned, and anyone who had once picked *Books* had no route back to including quotes except by also taking film dialogue. The deck itself had been drawing all three the whole time and the server had accepted a `quotes` scope all along — so the bug report ("quotes should be included in the daily quiz") described a control, not a deck.

**Approved.** The original control was mine and so was the mistake of not revisiting it when the third medium landed.

<sub>Broken from 1.5.0, fixed in 1.7.0 — `CHANGELOG.md` · `AI.md`</sub>

### Review scope became three independent choices in one comma-separated string

**Decided.** `srReviewScope` holds a comma-separated list; `scopeFlags` parses `books`, `movies`/`screen` and `quotes`, with `both`/`all` short- circuiting to everything. The single-word values keep working because they are what every existing account has stored, and legacy `movies` is honoured as the screen scope. The last one on will not turn off.

**Why.** Eight combinations, one column, no migration. `both` predates the third medium and means everything, because the alternative was leaving standalone quotes out of every existing reader's deck until they found a setting — which reads as the feature being broken. An empty scope is a deck with nothing in it, which looks exactly like a deck you have finished, so the UI refuses to let you get there.

**Instead of.** A boolean column per medium — rejected; a migration for a preference.

**Approved.** My call, and I approved honouring the legacy values in place rather than rewriting stored preferences.

<sub>1.7.0 — `internal/httpapi/review_handlers.go` · `CHANGELOG.md`</sub>

### An unparseable or unknown scope means everything, never nothing

**Decided.** `scopeFlags` returns all three media when nothing recognisable parsed. `srScopeValid` separately *rejects* a list containing an unknown token rather than quietly dropping it. `parseScope` on the client mirrors the server's table.

**Why.** A deck that serves no cards because a preference failed to parse is indistinguishable from a deck you have finished, and it would be silent. On the write side the opposite rule applies: a scope that silently becomes a different scope is how somebody ends up wondering why their films stopped appearing. Two copies of a table is a drift risk, so the client's is asserted against the same rules, including this one.

**Approved.** Mine, and I approved the asymmetry between reading and writing deliberately — they are failing in different directions.

<sub>1.7.0 — `internal/httpapi/review_handlers.go` · `web/frontend/test/pure/review-scope.test.js` · `CHANGELOG.md`</sub>

### "Seeing" a quote can reinforce it, opt-in and marginal

**Decided.** `srSeen` lets practising a quote (a non-skip answer), sharing it or favouriting it lengthen its half-life marginally. Off by default at 1.0×. Merely appearing in the Daily Quiz explicitly does not count.

**Why.** Encountering a quote is weak evidence you still hold it, and weak evidence deserves a weak effect. The Daily Quiz is excluded because its got/forgot already drives the schedule in full, and counting the same encounter twice would compound. The bump uses `max()` so a "seen"-lengthened half-life is never shortened by a later success.

**Approved.** I approved this off by default; a schedule that moves for reasons you did not intend is worse than one that moves too little.

<sub>0.6.2 — `internal/httpapi/review_handlers.go` · `CHANGELOG.md`</sub>

### A Daily re-answer on the same local day is an idempotent echo

**Decided.** If the mode is `daily` and the card was already touched today, the handler replies with the current state and writes nothing.

**Why.** The deck already excludes cards answered today, so a well-behaved client never re-answers one — but a stale second device or a retried POST can, and re-applying growth would compound the half-life and double-count the tally. Answering with the real state rather than an error means a retry succeeds, which is what a retry is for.

**Approved.** Mine, approved as an echo rather than a 409, because a client that cannot tell a duplicate from a failure drops the answer.

<sub>1.x — `internal/httpapi/review_handlers.go`</sub>

### itemAgeDays and ownsItem switch exhaustively

**Decided.** Both switch on the review kind with no default arm that reaches a table. `itemAgeDays` returns "very old" plus an error for an unknown kind; `ownsItem` answers "no".

**Why.** Both used to fall through to `annotations`, so a mistyped kind would have silently aged somebody's annotation by that id instead of failing — and `ownsItem` is the only thing standing between a review write and someone else's row. This is the same defaulting fault that, in the orphan sweep, would have deleted people: a switch written for exactly three kinds, correct only for that reason.

**Approved.** My call after the sweep bug, and I approved auditing the other switches rather than fixing the one that had bitten.

<sub>1.5.0 — `internal/httpapi/review_handlers.go` · `CHANGELOG.md`</sub>

### The reviewer's local day comes from a client-sent UTC offset

**Decided.** `tzOffset` takes the client's current offset in minutes, east positive, bounded to −720…840; `reviewDay` derives the local date, the per-day shuffle seed and the SQLite datetime modifier from it.

**Why.** The client sends its current offset on every request, so DST is its problem rather than a table the server has to keep. One value drives the day boundary, the seed and the stored-timestamp shift, so they cannot disagree about when "today" started.

**Instead of.** Storing an IANA zone per user — rejected; a zone database to carry and a value that goes stale when somebody travels.

**Approved.** Mine, and I approved pushing the awkward half to the side that already knows the answer.

<sub>0.4.0 — `internal/httpapi/review_handlers.go`</sub>

### A failed grade save keeps the reveal and always lets the reader advance

**Decided.** `json()` resolves to `{ok:false}` on a transport-level rejection instead of throwing; a non-2xx keeps the reveal on screen, shows an inline error saying the grade did not count, and Next always advances.

**Why.** An escaping rejection — an offline blip, a Wi-Fi-to-cellular handover, a server restart mid-request — skipped every line after the `await`, including the one re-enabling the control, so the quiz stalled with no way forward. Worse, a non-2xx *removed* the Next button from the DOM rather than disabling it. Losing one grade is a small cost; being unable to finish the session is not.

**Approved.** Mine, and I approved fixing `json()` for the whole app rather than the quiz alone — it unsticks in-flight flags everywhere.

<sub>1.0.0 — `CHANGELOG.md`</sub>

### Practice state persists per user, not per browser

**Decided.** The active deck, position and tally survive a reload, stored against the account.

**Why.** A refresh should drop you back on the same card rather than at the start. Per-browser storage would mean a shared browser shows one account's deck to the next person to sign in, which is a leak of what somebody is reading.

**Approved.** My call; I approved the per-user key specifically because the per-browser one was the obvious implementation.

<sub>0.9.2 — `CHANGELOG.md`</sub>

### The fixed ladder stays the default; adaptive intervals would ship beside it

**Decided.** Adaptive, FSRS-style intervals are on the roadmap as an opt-in sitting beside the ladder, not as a replacement for it.

**Why.** `item_reviews.stability` is already a half-life in days, so scaling it multiplicatively on a result is a handful of lines. The ladder stays the default and stays honest about what it is — but a lapse currently drops you to 7 from any rung, and that is the one place the loop is harsher than the science asks. Anki's move to FSRS made that argument mainstream.

**Approved.** Mine, and I approved it as opt-in on the same reasoning that retired the sliders: a default nobody has to understand.

<sub>1.15.0 — `internal/httpapi/review_handlers.go` · `internal/httpapi/review_adaptive_test.go`</sub>

### Cloze review computes the masked span at request time — no schema, no storage

**Decided.** The blanked phrase is chosen from the quote text at request time (longest run of non-stopwords, seeded by the quote id so it is stable per card).

**Why.** Follows the same "compute it in the query" discipline the forgetting curve already uses, so a new card type costs no table. Grading is a fuzzy match and the edit distance for it already exists in `internal/search/levenshtein.go` for the typo-tolerant search pass. It is the most natural way to test a *quote* as opposed to a fact, nobody in this space does it, and standalone quotes made it much stronger, because they are almost all famous lines.

**Instead of.** Storing masked spans per card — rejected as unnecessary schema.

**Approved.** Mine, and I approved the seeded-per-card rule so a reader is not asked a different blank each time they meet the same line.

<sub>1.15.0 — `internal/httpapi/cloze.go` · `internal/httpapi/cloze_test.go`</sub>

### Achievements are off by default, computed at query time, one streak

**Decided.** Milestones are derived from data already in the library at query time — no counters table, no background jobs, nothing ticking — off by default, private, nothing social, shown as a dismissible shelf. Exactly one streak exists, on the review, and a missed day spends a built-in grace rather than zeroing the count.

**Why.** Achievements mostly mark distance travelled, and distance travelled is already stored. The one streak earns its keep on the review because that is the loop turning up matters for, and it is built the forgiving way the loop already works — mirroring the rule that a lapse is shortened, never hard reset. It is never dressed up as a loss: "You broke your streak!" banners are exactly what I will not do. Streaks stop at the review; nothing else in the app grows one.

**Approved.** Mine, and I approved the restraint as the feature — the version worth building is the one that is easy to leave switched off.

<sub>Not shipped</sub>

### A card's difficulty is a property of the library, and nothing in the deck knew it

**Decided.** The diagnosis the next four entries answer. The deck asks one question — which work is this line from, or its mirror — and turns one knob, `distractorScore`, which is written to make the wrong answers as confusable as it can. Where that knob lands is decided by the shape of the library rather than by anything about the reader.

**Why it is expensive rather than merely irritating.** `workRef` has no `series` field and `distractorScore` never mentions one, so a volume in a series is the worst case the scoring can produce: same medium, same author, same genres, and the siblings outrank every other candidate. The card offers four books whose titles differ by a subtitle, and the reader is asked to separate things that are genuinely inseparable — a line in volume three could as easily have been in volume four. A show is a level worse: same series, same cast, and an `episodeRef` means the question can be *which episode*.

A standalone film fails the other way. Nothing scores highly, the distractors share no genre and no cast, and the title alone gives it away — while the option chip for a screen work shows its dialogue actor, so on a line you half-remember the actor names the film for you.

**And the schedule cannot tell.** This section already records that *a recorded lapse is decisive* and that the ladder is fixed at 7 → 30 → 100. So an unanswerable series card **resets the half-life of a line the reader knew perfectly well**, and a free film card **advances one to a hundred days** on a question that tested nothing. Every decision in this section is about *when* to ask. None was about whether the question was worth asking, which is the gap.

**Approved.** The reader's report — "the recall the book thing is very hard for serieses. and very easy when they are not serieses (especially so for movies)" — and my reading of the two halves as one defect.

<sub>Not shipped</sub>

### The question's grain follows the series, and that is not a preference

**Decided.** `workRef` gains `series` and `seriesIndex` (both tables already carry the columns). A card whose work belongs to a series asks about the **series**, with the siblings collapsed into one option; a show asks which show, never which episode. The volume and the episode move to the reveal. It ships silently, with no setting.

**Why no setting.** A switch between a fair question and an unfair one is not a preference, and offering it would be asking the reader to own a defect. What is worth choosing is which *kinds* of question to be asked — see the next entry.

**The collapse has to reach `choicesFrom`,** which dedupes by string. Two sibling volumes are two distinct titles and survive it, so a "four-choice" card in a five-volume series is really a one-in-four guess between the same book. Collapsing by series key is what makes the option count honest.

**Instead of.** A second "which volume?" step once the series is right — it is the same defect asked politely. Dropping series volumes from the deck — the line is worth remembering; only the question about it was wrong.

**Approved.** The reader's, in the form "a toggle, but for types of questions. not for fair and unfair."

<sub>Not shipped</sub>

### Six question facets, and which apply is a property of the kind

**Decided.** The deck grows from two facets to six: **source** (which work), **quote** (which line), **cloze** (fill the blank), **speaker** (who said this), **author** (who wrote this), **when** (roughly which decade). Which are available is decided by the kind and by the row, never by the reader.

| facet | book | screen | standalone quote |
|---|:--:|:--:|:--:|
| source · quote · cloze | ✓ | ✓ | ✓ |
| speaker | — | ✓ character | ✓ speaker |
| author | ✓ | — | — |
| when | ✓ published | ✓ release | ✓ occasion date |

**Why.** Today's two facets are the same question in mirror image, which is why the film case has no hard version and the series case has no fair one. **Speaker is the facet the screen deck was missing**: the plausible distractors are the other characters of the same film, so the pool is dense by construction and needs no cross-library similarity search at all.

**Two of the six have difficulty that does not depend on the library's shape** — cloze, whose difficulty comes from the line, and *when*, whose difficulty is how far apart the offered decades are, a number the deck chooses rather than inherits. Those two are what a sparse or lopsided library falls back on, which is the answer to the film case. The decade machinery *when* needs landed in 1.13.2.

**Author is the weakest of the six** and is not defaulted on: a reader usually knows the author from the shelf.

**This is why the character-chip feature and this one are one piece of work.** That feature builds the character → actor mapping per film; this one needs exactly that mapping to ask *who said this*. Planned apart, each would build half of it.

**Approved.** The reader's, in the form "add new facets to the quiz as well."

<sub>1.15.0, four of the six — `internal/httpapi/review_handlers.go` (`directionsFor`)</sub>

### Question types are a preference, and the filter belongs in reviewSource

**Decided.** `reviewQuestions`, a comma-separated string of enabled facets, taking the same shape as `reviewScope` and the same failure rule: **an unparseable or unknown value means everything, never nothing.** The eligibility predicate for each enabled facet is OR-ed into `reviewSource`'s `where()`.

**Why it cannot live in the card builder.** `reviewSource` exists because five queries have to agree on what is reviewable, and the recorded symptom of their disagreeing is *a badge promising cards the deck will not serve*. Question types re-introduce exactly that risk, because **not every facet can be asked of every card**: cloze needs a quote long enough to blank a span out of, speaker needs a character, *when* needs a year. So "is there an enabled question this card can support" is a sixth condition on eligibility and belongs beside the utterance clause.

`source` and `quote` are satisfiable by every row, which is what keeps the deck from emptying — and is the reason to make one of them unswitchable in the UI rather than to write a fallback that silently ignores the setting.

**Approved.** The reader's, in the form "yes, a toggle. but for types of questions."

<sub>Not shipped</sub>

### Cloze is forgiving with typos and strict with synonyms, and the threshold follows word length

**Decided.** The blank is graded after normalisation, by Levenshtein distance banded on the length of the answer word: **0 edits up to 4 characters, 1 for 5–7, 2 for 8 and over.** Multi-word blanks are graded token by token, in order, all must pass. No thesaurus, no stemmer, no inflection matching.

**The trap, which sets the numbers.** Edit distance does not know the difference between a typo and a different word. "cat" → "cot" is one edit; "bad" → "sad" is one edit. A tolerance generous enough to feel kind on a long word will, on a short one, silently accept **a word the reader actually chose** — the synonym failure arriving through the back door wearing typo's coat. So the threshold is not a generosity setting: it is derived from how far you can travel before landing on another real word, and that distance is a function of length.

**Normalisation is not forgiveness.** Case, surrounding punctuation, curly against straight apostrophes, en dash against hyphen, collapsed whitespace. None of those is the reader being wrong.

**Refused explicitly:** synonyms (the blank is a span of a *quote*; a word that means the same thing is not the word that was written, and accepting it lets the reader pass without recalling the line), stems and inflections ("walked" for "walking" changes what the line says), and word order or count.

**Token by token rather than whole-string,** because a whole-string budget earned by long neighbours will hide a wholly missing short word.

**Nearly free to build:** `internal/search/levenshtein.go` already exists for the typo-tolerant search pass, and the rest of this rule is the *absence* of features. **The banding lives with the caller, not inside the shared function.** `editDistance` was just consolidated into `web/frontend/src/text.js` precisely because two copies of Levenshtein stay correct only until somebody tunes one of them — and a length-banded threshold *is* tuning. Search wants to be generous because a near miss there costs a wasted glance; cloze wants to be strict because a near miss there is a false pass. Same distance function, two callers, two thresholds, neither written into the shared code. The one addition worth making is showing the difference marked on the reveal, so a reader who typed "recieve" can see that is what happened — and so can one whose synonym was refused, or the rule reads as arbitrary rather than strict.

**Approved.** The reader's, in the form "fill in the blanks questions must be forgiving with typos. but not with synonyms."

<sub>1.15.0 — `internal/httpapi/cloze.go` · `internal/httpapi/cloze_test.go`</sub>

### Measured difficulty feeds the schedule, beside the fixed ladder

**Decided.** The deck counts its own **plausible** distractors per card — candidates scoring above the same-medium floor — and that number reaches the grader. A correct answer on a card the deck knows was easy does not earn the full step up the ladder; **a lapse on a card the deck knows was unfair is not decisive.**

**Why the defensive half ships first.** It is the one that stops damage. Until the series grain lands, every series card is an unfair card, and each one is resetting the half-life of a line that was known.

**It does not become a column.** This section's founding constraint is that recall is computed at query time from a stored half-life, with no sweep and no cached derivation. Difficulty is a property of the pool at the moment of asking, so it is computed then, like everything else here.

**Not self-reported.** Self-graded recall was removed and restored once already; a second judgement per card spends the reader's attention on calibrating the app rather than on the line.

**This section already reserves the shape** — *the fixed ladder stays the default; adaptive intervals would ship beside it*. This is that, with a difficulty signal that is measured rather than guessed.

**Approved.** The reader's, in the form "Difficulty feeds the schedule - yes."

<sub>Not shipped</sub>

### Skipping the quiz is a fact about a quote, and a work's toggle is a bulk edit

**Decided.** `reviewSource.where()` reads the QUOTE's `review_excluded` and nothing else. A work's toggle writes that column onto every quote it holds, and the work wears its own mark only when all of them are skipped.

**Reversal.** 0033 put the flag on both and ANDed them in the deck, which made the child's flag lie. The report: *"Take a highlight that is excluded both on its own account and by its book. The selection bar reads the own flag, so it offers Add to quiz; pressing it clears the quote's own column and toasts 'back in the quiz' — but the book still excludes it, so the deck still won't serve it and the mark stays put."*

**Why the toast was the worst part.** It reported an outcome that did not happen, about a change that did. Nothing on screen resolved the contradiction, because the mark read both flags and the button read one — so the app was simultaneously right and wrong about the same quote.

**Instead of** making the button read both flags and clear both, which was the smaller change. That would let one press of *Add to quiz* on a single highlight put forty others back into the deck as a side effect — a bulk write behind a single-item control.

**Affordable because the rule has exactly one choke point.** The comment there already said that a rule added to four of the five callers is "a deck that will not serve a card the badge is still counting"; removing a term is the same argument.

**Approved.** The reader's, and the resolution is theirs too: *"hide from quiz/spaced repetition should be an annotation level thing. and user can simply turn them on / off in bulk when they change the setting in work level. and work level icon will be shown when all annotations in it are skipped."*

### The debt of a write-not-a-filter is that every create path owes it

**Decided.** Every path that puts a quote under a work seeds the quote's `review_excluded` from the work's. Three of them: `POST /annotations` and `POST /dialogues` do it with a correlated subquery, the importer does it with one read per batch through `workExclusion`, and a merge does it as a one-way write onto the source rows before they move.

**Why this is the entry above's bill, not a new rule.** Making the quote's own column the only gate was right — it stopped the deck refusing a card whose visible mark said it was in play. But the moment the parent's flag stopped being read at query time, "exclude this book" stopped covering anything by itself and became a fact that has to be *written* onto every quote that ever joins the book. That is a debt paid at each create site, and a debt paid at each site is a debt one site forgets. The importer forgot it: one column missing from one `INSERT`, and the same absence in the film importer beside it.

**The failure is the one this feature exists to prevent.** You exclude a reference manual *because* highlights keep arriving from it — so the single book most likely to be imported into again is the book whose exclusion silently stopped holding. The reader's report was *"skip quiz is not helping. i can see questions from skipped books in my daily quiz"*, which is what a filter that holds on one write path and not the other looks like from outside.

**Merging travels one way.** Excluding propagates into an excluded target; including never propagates out of an included one. A quote carries its own answer — somebody may have put one line back in the quiz inside a manual they otherwise skip — and a merge is not the moment to erase it. Written onto the source rows *before* the re-point, because that is exactly the set that is moving; the target's own quotes are none of the operation's business.

**Instead of.** Restoring the parent term in `where()`, which is what the deck used to do and what the entry above removed for a reason that has not changed. And instead of a trigger: an `AFTER INSERT` on annotations would cover every path forever, at the cost of making a column's value depend on a rule that is invisible at all three call sites — the repo already carries five hand-written cascade triggers and every one of them is a documented hazard.

**Approved.** Mine for the sweep, the reader's for the report. The two merge cases are asserted in both directions, and each new test was watched failing first.

<sub>2.0.1 — `internal/httpapi/import_handlers.go` · `internal/httpapi/import_movies.go` · `internal/httpapi/metadata_bulk.go`</sub>

<sub>1.15.0 — `internal/httpapi/review_handlers.go` · `internal/httpapi/bulk_handlers.go` · `web/frontend/src/ui.jsx`</sub>

### And the debt is owed backwards as well: a migration, not just a create path

**Decided.** `0046_review_exclusion_backfill.sql` writes `review_excluded = 1` onto every quote of every work that already carries it. One direction: an excluded work stamps its children, an included work clears nothing.

**Why the two entries above did not finish the job.** Both are about paths that run *from now on* — the toggle, the three create sites. Neither looked at the rows that were already there. Under 0033 a work's children never needed the flag, because the deck ANDed the parent's; the moment 1.15.0 stopped reading it, every book anybody had ever skipped quietly put its highlights back into the deck. The report, third of its kind: *"Homo Deus is skipped from the daily quiz. So is Sapiens. Yet both are coming in quizzes. Only one quote has the skip mark, which I manually added."*

**Why nobody would have found it by looking.** The work keeps its own flag, so the tile keeps its mark, the edit form keeps its state, and every screen goes on agreeing that the book is skipped. The only surface that disagrees is the deck, which is the one surface that never explains why it chose a card. And it is not historical: a restore of any backup taken before 1.15.0 lands the same state on a current build.

**What it costs, stated rather than discovered.** Excluding a work and then putting one quote of it back is a reachable state this section deliberately supports — and in the data it is indistinguishable from a stale row, both being a work at 1 with a child at 0. So that child is re-excluded. The conservative rule that suggests itself, *skip any work that already has an excluded child*, would have left the reported library broken, because that library is precisely a skipped book with one hand-skipped quote in it. A re-excluded card is one press and a visible mark away from fixed; a book that goes on being asked about is the bug.

**Instead of** a repair pass in Go beside `BackfillDialogueHashes`, which is where a rule that cannot be expressed in SQL goes. This one is two `UPDATE`s.

**Approved.** The reader's, from the report.

<sub>2.1.3 — `internal/store/migrations/0046_review_exclusion_backfill.sql` · `internal/store/migrate_review_backfill_test.go`</sub>

### One ordered table of question types, and a flip card that cannot fail

**Decided.** `directionsFor(kind)` is the single per-kind list of question types — source, quote, flip, cloze, and speaker for screen quotes — and `buildQuestion` returns a card unconditionally rather than a `(card, ok)` pair. When no direction can be built, the card falls back to the **flip card**: show the quote, reveal the source, grade yourself.

**Why one table.** Seven implementation specs were written against the tree, one per feature, each blind to the others. Every one of them independently rewrote `dailyDirection`'s two-way toggle into a differently-shaped three-way, and the three rewrites were mutually exclusive. A table makes per-kind applicability — speaker is screen-only, a book has no cast — a property of data rather than a special case in a branch.

**Why the signature cannot fail.** `buildQuestion` used to drop a card it could not build a question for, and `dailyRemaining` counted it anyway. The badge and the deck disagreed for any library with one work in it: "3 due", nothing served. **Its test asserted the empty deck as correct.** The flip card fixes this at the root, because it is the one type that works for every quote — there is nothing to fail at.

**Instead of** adding a fifth reason for a card to vanish. A quiz that silently serves fewer cards than it counts is a quiz nobody can trust the count of.

**Approved.** Mine, on the reconciler's finding.

<sub>1.15.0 — `internal/httpapi/review_handlers.go` · `web/frontend/src/review.jsx` · `web/frontend/test/dom/quiz-runner.test.jsx`</sub>

### The client keys a flip card on the ABSENCE of options, not on the direction string

**Decided.** `isFlipCard(card)` is true when the card has no options and no cloze blank — never `card.direction === 'flip'`.

**Why.** It makes an unknown direction from a newer server degrade to the one card type that always works, instead of rendering as a multiple choice with nothing to choose. A card with options is a question this client knows how to grade; a card without them is not, whatever it calls itself.

**Approved.** Mine.

<sub>1.15.0 — `web/frontend/src/review.jsx`</sub>

### Three answer leaks, two of them live in the shipped app before this release

**Decided.** Fixed, each with a test that fails when the guard is removed:

1. **`Home.jsx` rendered the attribution side for every direction that was not `source`.** The line was `isSource ? <QuoteBlock/> : <SourceLines/>`, and `SourceLines` prints the actor as a face chip and the character in its meta line. With two directions that was the same thing; the moment a *speaker* card existed it would have shown the right actor directly above the four options.
2. **`attachMCQ` fell through to the quote branch for any unrecognised direction.** It tested `if direction == source` and everything else took the other branch, so a card labelled `cloze` or `speaker` would have come back carrying quote options with the correct quote among them. It is an explicit switch now, whose default refuses.
3. **Selecting a wrong option painted it red before Submit.** `chosen && !isAnswer` was safe only while a chosen option was necessarily a graded one; the confirm step put a real interval between the two, and without `answered &&` the styling told you the answer while you could still change it.

**Why they are logged together.** None was visible from inside the feature that would have exposed it. The first two were found by a specification pass reconciling seven independent specs, not by any test, and both had been in the tree for releases behind a two-direction vocabulary that happened not to reach them.

**Approved.** Mine.

<sub>1.15.0 — `web/frontend/src/review.jsx` · `internal/httpapi/review_handlers.go`</sub>

### The daily deck's "seeded" options were never seeded

**Decided.** `quizPools` sorts its work list after building it from a map, and the quote sampler orders by a hash of the id when a seed is present instead of `ORDER BY RANDOM()`.

**Why.** The deck's whole contract is that today's cards are the same cards, in the same order, with the same choices, on every device. The comment saying so had been there for releases. The pool underneath came from Go map iteration — deliberately randomised — and a SQL `RANDOM()`, so the same card offered different wrong answers on a phone and a laptop, and nothing anywhere reported it.

**Instead of** trusting the comment. This is the second time in this section a stated invariant turned out to be enforced by nothing.

**Approved.** Mine.

<sub>1.15.0 — `internal/httpapi/review_handlers.go` · `internal/httpapi/review_seed_test.go`</sub>

### A confirm step replaced undo, because the roadmap asked for the wrong thing

**Decided.** `srSubmit`, off by default: a tap SELECTS an option and a Submit button commits it. Until you press it, tapping another option changes your mind and nothing has left the browser.

**Why, and the reversal.** The roadmap line asked for "undo the last answer", which needs the previous half-life stored — a column this section is built on not having. The reader restated the actual want as *"optional submit button instead so answers can be changed after clicking. this will protect against misclicks"*, which is the same problem solved before it happens rather than after.

**Not offered on flip or cloze cards.** Typing an answer and pressing Check is already a submit step; revealing a card and then saying whether you had it is already two acts. A confirmation on either is asking twice.

**The plan said "this is client only" and was wrong.** The preference needs a field in the prefs struct and a branch in the merge, or the PUT is accepted and silently discarded by `loadPrefs`' typed unmarshal and the toggle reverts at the next login. What is genuinely client-only is the answer endpoint.

**Approved.** The reader's, in the form quoted above.

<sub>1.15.0 — `internal/httpapi/auth_handlers.go` · `web/frontend/src/review.jsx`</sub>

### A card forgotten five times is offered a way out, and never taken out automatically

**Decided.** `lapse_count` was stored since 0015 and read by nothing. At five lapses the card says so **after** it has been answered, and offers "Set it aside" beside "Keep asking". Neither suspends nor shortens anything by itself.

**Why an offer.** A card that vanished because a counter reached five would be the app making a decision nobody asked it to make, and a half-life quietly altered behind the reader is the schedule lying about itself.

**Why after the answer, and why the flag comes back on the grade.** The answer that MAKES a card a leech also pushes it a week out of the deck, so waiting for the flag to arrive on a future card would surface the offer a week after the frustration that earned it.

**Approved.** The reader's, as "leech handling".

<sub>1.15.0 — `internal/httpapi/review_handlers.go` · `web/frontend/src/review.jsx`</sub>

### A cloze card is offered only where the stopword list means something

**Decided.** `clozeReadable` gates cloze on the text being at least three-quarters Latin script. Everything else gets one of the other directions, which are all script-agnostic.

**Reversal.** The plan said a quote in another script "simply will not produce a good span". It produces a *confident* one: an English stopword list matches zero Devanagari or Cyrillic or Han tokens, so every token reads as a content word and the selector blanks a phrase out of text it understands nothing about. Far from producing no span, it produces one with nothing to say against it.

**The limit is written in the code rather than in the plan**, so whoever adds a second stopword list knows exactly what to change.

**Approved.** Mine, on the specification pass.

<sub>1.15.0 — `internal/httpapi/cloze.go` · `internal/httpapi/cloze_test.go`</sub>

### The cloze mask is derived from (kind, id) and never from the day

**Decided.** `clozeSpan` takes no day seed. The same card blanks the same words on every device, on every day, in Daily and in Practice alike.

**Why.** The grading endpoint has to recompute the span the card was built with. A mask that moved with the date would grade tomorrow's answer against today's blank, and nothing would report it — the reader would simply be marked wrong for the right words.

**And the answer never travels.** Unlike an MCQ, whose `answer` is an index that means nothing without the options, a cloze answer IS the words being recalled. The card carries the masked text and no answer; the words come back in the reply to the attempt.

**Approved.** Mine.

<sub>1.15.0 — `internal/httpapi/cloze.go`</sub>

### "Who said this" draws its distractors from the film's own cast, and never fetches

**Decided.** The options are ACTORS, not characters, at the reader's request. Distractors come from the same film's stored `cast_json` first — the people who were actually in it — and widen to the pool only when that is not enough.

**Why the film's own cast.** It is the difference between a question that is hard because you have to remember and one that is easy because three of the four names are obviously from other decades. It also costs nothing: the cast is already stored, so there is no request at quiz time, which this app does not do anyway.

**Approved.** The reader's, in the form "for movies/shows, who said this (options will have actor cards, not the character cards)".

<sub>1.15.0 — `internal/httpapi/speaker.go` · `internal/httpapi/speaker_test.go`</sub>

### A theme narrows Practice only, and the clause is kept out of the shared eligibility string

**Decided.** `reviewTheme` is threaded through the three candidate queries as its own clause. It is **not** added to `reviewSource.where()`, and `handleDailyQuiz` passes `reviewTheme{}` **by name** with a comment saying why.

**Why not in `where()`.** Five queries splice that string and two of them are Daily's own: `dailyRemaining`, which decides the badge, and `reviewStates`, which draws the "where you stand" row. A theme there would narrow both — so opening a themed round would change the number of cards the app said were due today, in the same commit whose stated constraint is that Daily is not themeable.

**Why Daily is not themeable at all.** The daily deck IS the schedule. Filtering it would leave the cards that are actually due unasked while the streak still counted the day as cleared, which quietly turns the one authoritative surface into a second practice mode.

**A theme about something a kind cannot have drops that kind entirely** rather than leaving it unfiltered. "Quiz me on this book" over film lines must return no film lines — not all of them, which is what an ignored clause does.

**The buttons are contextual rather than central.** There is no "pick a theme" screen: you are already looking at the book, the tag, the person or the colour when you want to be asked about it. A picker would mean choosing a book from a list of books one screen after leaving the list of books.

**Approved.** The reader's, as "themed review".

<sub>1.15.0 — `internal/httpapi/review_theme.go` · `web/frontend/src/review.jsx` · `web/frontend/src/works.jsx` · `web/frontend/src/StatsPage.jsx`</sub>

### In-card actions open only after the card is graded

**Decided.** Edit, ♥ and re-tag live in one panel on the review card, and the panel is unreachable until the card has been answered.

**Why the gate is the feature.** An edit form carries the quote, the title and the credit: on a "which book?" card that IS the answer, and on a cloze card it is the masked words in full. A pencil beside an unanswered question is a way to read the answer without answering it. With the confirm step on there is a real interval between choosing and committing, and the gate holds across it.

**It also disposes of two bugs that lived between features.** The specification pass found that folding an edited row back onto a card would un-mask a cloze card, and would write a film title into the answer slot of a speaker card whose options are actor names. Both were about revealing something early; once nothing folds back before the grade, what remains is one short rule — the note always, the quote unless the card is a cloze one, and the options never, because they were the question.

**The whole row goes back, because the PUT is full-state.** The payload is the row with the edited fields over it rather than a hand-built object that has to remember `board_id` on a standalone quote and the sticker's coordinates on all three. A field forgotten there is a field an edit to the words silently blanks.

**Approved.** The reader's, as the roadmap line.

<sub>1.15.0 — `web/frontend/src/review.jsx` · `internal/httpapi/quote.go` (`idFilter`)</sub>

### QuizRunner had no tests at all, and six features rewrote it

**Decided.** Tests landed *before* the state machine was split, not after.

**Why it is worth an entry.** The only thing that rendered `QuizRunner` was a smoke test that mounts every screen with all requests refused, so nothing ever reached an active deck. The submit-off path — the one every current reader is on — had never been asserted by anything, and six of the seven features in this release rewrite that component. Two of the three answer leaks above are in code that path runs.

**And a test that passed against its own bug.** The first version of the submit-step leak test checked for the words "not quite", which are gated separately, rather than for the option styling. It passed with the guard removed. Every guard in this release was verified by reverting it and watching the test fail.

**Approved.** Mine.

<sub>1.15.0 — `web/frontend/test/dom/quiz-runner.test.jsx` · `web/frontend/test/dom/card-tools.test.jsx`</sub>

### The reader chooses the deck's repertoire, and three rules stop them breaking it

**Decided.** Which question types each deck may ask is now a per-user preference, per deck, behind an **In-depth controls** pop-up. The card itself keeps only the two settings somebody changes and then stops thinking about — deck size and what it covers.

**Why.** Until 1.16.0 the repertoire was a constant: `directionsForMode` returned one table for everybody, and the only thing a reader could say about the review loop was how many cards and which medium. That is a strange place to draw the line in the one part of this app with no equivalent elsewhere. Somebody who cannot bear multiple choice, or who wants the daily deck to be nothing but fill-in-the-blank, had no way to say so.

**Stored as a string, like the language marks, and for the identical reason.** `preferences` is a flat comparable struct — `ui_test.go` declares a mirror and compares two values with `!=` — and a struct holding a map or a slice is not comparable in Go. So `srQuestions` is a small JSON document, normalised on read *and* on write.

**The three rules are the feature, and all three fail silently without them.**

1. *An unknown direction is dropped, not rejected*, so a backup taken on a newer build restores onto an older one.
2. *The daily deck cannot be made self-scoring.* 1.15.3 took the flip card out of the daily deck deliberately — one self-marked card in five does not make the deck slightly softer, it makes the score mean something else — and handing over the repertoire would have handed that decision back by accident. `flip` is dropped from `daily` on the way in, wherever the preference came from.
3. *No deck can be configured into nothing* — and the sharp half of this is why it is not simply a non-empty test. `speaker` applies only to a line of dialogue, because a book has no cast. A deck holding only *"who said this?"* is not empty and is empty for every book and every standalone quote in the library. So a deck must keep at least one direction that applies to **every** kind, or it reverts to its defaults.

**The client mirrors the rules, which is a duplication this repo normally refuses.** `facets.js` opens by refusing exactly this shape. The reasoning differs here: the server *must* normalise, because a preference can arrive by PUT, by restore, or from somebody editing their own database; and the client must *also* know, or a switch that would empty a deck is accepted, sent, silently corrected, and flips back under the reader's finger explaining nothing. So the offending toggle is **disabled with its reason on screen**, and a test reads the Go source to check the two tables still say the same thing.

**Back to defaults** sends `srQuestions: ""` — and because empty is a real value here, that field takes the pointer as presence rather than the `!= ""` shorthand the older string fields use. It resets every review preference on the panel, not only the questions: a reset that left three switches behind would be the least trustworthy button there.

**Instead of.** Leaving the repertoire a constant; or letting the interface be the only thing enforcing the rules.

<sub>1.16.0 — `internal/httpapi/review_questions.go` · `web/frontend/src/quiz.js` · `web/frontend/src/Settings.jsx`</sub>

### The numbers behind the schedule are bounded, not free

**Decided.** The multipliers, the difficulty weighting, the multi-word cloze threshold and the ladder's three rungs are per-user preferences. Every one is clamped, and out-of-range falls back to the **default** rather than to the nearest bound.

**Why the clamps rather than free numbers.** These multiply a half-life on every answer, so a bad one does not produce a wrong screen — it produces a schedule that is quietly useless and stays that way. A grow of 0.5 shortens a card on every *correct* answer, so a quote you know perfectly is asked more and more often for ever. A shrink of 1.5 lengthens it on every failure. Neither errors, neither looks broken, and both would take weeks to notice. So grow is `> 1` and shrink is `< 1` by construction, each range closing exactly where the number would start meaning its opposite.

Falling back to the default rather than the nearest bound is the smaller of two wrongs: somebody who typed 0.5 into "correct answer multiplier" meant something, and silently handing them 1.1 answers a question they did not ask. The default is at least a number whose behaviour is written down.

**The ladder is the one the interface refuses rather than corrects.** It has to ascend and has to stay inside the bounds the due-ness SQL floors and caps against — a rung outside them is a card that is due for ever or never. The server reverts one that does not, silently, because there is nowhere to report it from; so the panel says why and does not send the PUT. A test asserts the sliders' own bounds against the Go clamps, because a slider offering a value the server throws away is a control that moves and does nothing.

**Instead of.** Leaving them constants — which made the review loop the one part of this app whose behaviour was an opinion the reader could not disagree with.

<sub>1.16.0 — `internal/httpapi/review_tuning.go` · `web/frontend/src/quiz.js`</sub>

### The anthology theme worked for two releases and nothing could ask for it

**Decided.** The review engine has parsed `?anthology=` since migration 0043: it is the sixth theme, the first that names a *row* rather than a value, and the first whose `clause()` is a join — `x.id IN (SELECT e.item_id FROM anthology_entries e WHERE e.anthology_id = ? AND e.kind = ?)` — excluding no kind, so a mixed anthology of book highlights and film lines practises as one deck, and `handlePractice` refuses somebody else's anthology with a 404 before the clause is ever built. What shipped in 2.1.2 is the two halves that were missing: `anthology` in the key list `themeQuery` loops over, and a **Practise** button on the anthology page.

**Why this is an entry about reachability rather than about a theme.** Both halves were absent and either one alone was enough to sink it. `themeQuery` copied `['book', 'movie', 'tag', 'color', 'person']` out of the theme object, so even a caller that set `anthology` had the parameter silently dropped on the way out; and no screen set it, because no screen had a control. The handler was correct the whole time and the Go tests passed the whole time — they build their own query strings and therefore never touch `themeQuery` — and the roadmap and the plan document both counted the theme as built, because the backend was. **A feature the reader cannot reach is not shipped**, and the specific shape of this failure is that no test on either side of the language boundary could see it: the Go suite exercised the endpoint the app was not calling, and the JS suite did not know the parameter existed.

**So the regression test crosses the boundary.** `theme-reachable.test.js` reads `internal/httpapi/review_theme.go` from a Vitest file, slices out the body of `parseReviewTheme` — only that function, because `reviewTheme`'s fields and the SQL underneath mention the same words and matching those would prove nothing about what the endpoint *reads* — collects every `q.Get("…")` in it and asserts the set equals `themeKeys`. It then asserts `themeQuery` actually writes each key, because a key listed and not written is the same unreachable feature with a passing list, and that `anthologies.jsx` contains both the `practise({ anthology: …})` call and `{practiceDialog}`, because a parameter that works with nothing setting it is no better than one that does not work. The test guards itself first: if `parseReviewTheme` is renamed or rewritten past what the regex can read, the opening assertion fails loudly rather than quietly measuring nothing. It is the same shape as the CSS/JS agreement checks in `palette.test.jsx`, and the same justification — the drift being measured is between two languages, so a test written in either one alone is blind to it.

**`themeKeys` is exported and read twice, which is the structural half of the fix.** The list builds the query string and it also builds `ThemedPracticeDialog`'s effect dependencies, spread as `[round, ...themeKeys.map((k) => theme?.[k])]` rather than six names typed out. A seventh theme added to one and forgotten in the other is not a missing feature but a wrong one: the round would open on the previous theme's cards, which looks like a caching bug and is a dependency list. The array's length is a module constant, which is React's only requirement of a dependency list, and the lint rule is suppressed on that line deliberately.

**Where the button goes, and when it is off.** Practise sits before Edit in the anthology page header, because reading an anthology back is what you do *with* one and editing is what you do *to* one; it is disabled while the anthology is empty, since a round over nothing is the single case the dialog can only answer with "nothing here". The dialog comes from `usePractice`, a hook rather than anything global, so the round unmounts with the page — a round left running behind a screen the reader has navigated away from would go on posting grades against a schedule they believed they had stopped touching, and that is a data consequence rather than a cosmetic one.

**Instead of.** A theme picker screen, which the earlier themed-review decision already rejected on the grounds that you are always already looking at the thing you want to be asked about — an anthology most of all, since you got there by opening it.

**Approved.** Mine, as a defect rather than a design: nothing about the theme changed, only what could reach it, and the honest version of the record is that the log and the roadmap both called it built for two releases on the strength of a passing server test.

<sub>2.1.2 — `internal/httpapi/review_theme.go` · `web/frontend/src/review.jsx` · `web/frontend/src/anthologies.jsx` · `web/frontend/test/pure/theme-reachable.test.js`</sub>

## 9. Import and the Staging Queue

Imports used to parse and write in one shot, which meant a misdetected file was reported after it had already reached search and the review deck. Everything now lands in separate staging tables where nothing is irreversible, and every parser reads structure rather than English.

### Every importer parsed and wrote in one shot, reporting added/skipped/enriched after the fact

**Decided.** This is the state 1.2.0 replaced, recorded because it is the problem the rest of the section is the answer to.

**Why.** By the time the results screen said what had happened, the quotes were already in `annotations` / `dialogues`, already indexed for search, already in the review deck, and the only undo was hand-deleting them. The 1.1.1 bug where a film's own export re-imported as a *book* is exactly the class of mistake that should be caught before the write, not reported after it.

**Reversal.** Reversed in 1.2.0. What I got wrong originally was treating the results screen as a report when the user needs it to be a decision point.

**Approved.** The original design was mine and so was overturning it; I approved the rewrite once a real misdetection made the cost concrete rather than theoretical.

<sub>1.2.0 (reversal) — `CHANGELOG.md` · `internal/store/migrations/0023_import_staging.sql`</sub>

### Imports land in separate staging tables rather than behind a pending flag, so no existing read can leak an unapproved quote

**Decided.** Migration 0023 adds `import_batches`, `staged_works` and `staged_quotes`, deliberately outside the live tables. Ownership is by parentage — `staged_quotes` → `staged_works` → `import_batches`, which carries the `user_id` — mirroring `annotations` → `books`, with no `user_id` on the child tables to drift out of step.

**Why.** A `pending` flag on `annotations` would have had to be threaded through every existing read as `WHERE pending = 0` — dozens of queries, each one a place to forget it and leak an unapproved quote into a list, a search hit or a quiz card. Separate tables make the *default* safe: no existing query can see staged rows because no existing query names these tables.

**Instead of.** The `pending` flag — rejected on exactly that failure mode.

**Approved.** Mine, and this is the decision the whole section rests on. I approved paying for three new tables to buy a default that cannot be forgotten.

<sub>1.2.0 — `internal/store/migrations/0023_import_staging.sql` · `CHANGELOG.md`</sub>

### Staged rows get no FTS tables, no triggers and no review rows, and tags stay denormalised text

**Decided.** The staging tables carry no FTS5 index and no FTS triggers, no `item_reviews` rows, and tags as comma-joined text in `staged_quotes.tags` rather than join rows against `tags`.

**Why.** All three are consequences of the previous decision and all three are intended. Staged text is not searchable and cannot be pulled into a quiz. Repetition state begins at approval, not at import. And a tag that exists only inside an unapproved import does not appear in the user's tag vocabulary — approval is what turns it into a real join row. Having no FTS triggers also keeps these tables clear of the external-content hazard 0022 recorded, where a trigger that writes the row it fired on corrupts an FTS index.

**Approved.** I approved each consequence explicitly in the migration comment, because "we forgot the triggers" and "we deliberately have no triggers" look identical from the schema alone.

<sub>1.2.0 — `internal/store/migrations/0023_import_staging.sql`</sub>

### Import counters moved from the import call to the approval call, because nothing is written at import time any more

**Decided.** The seven import endpoints answer with a batch id and a staged count. `added` / `skipped` / `enriched` come back from `POST /import/staged/approve`, which is where the writing happens.

**Why.** The counters describe writes, and at import time there are none. A parser's own counters stay on the import reply, though — the Kindle clippings importer still says "1 bookmark skipped, no text to import" at the moment you upload the file, which is the only point at which that is actionable.

**Approved.** My call, and the split between "what the parser saw" and "what the library did" is the part I approved deliberately: they answer different questions at different moments.

<sub>1.2.0 — `CHANGELOG.md` · `internal/httpapi/import_handlers.go`</sub>

### The staged destination preview is recomputed on every read, never stored, because the library moves while quotes wait

**Decided.** Every group heading in the queue says where its quotes are going — an existing title they will join, or a new one that will be created — and that preview is computed by `listStagedWorks` on each read. `previewStagedTarget` runs the same resolution approval will run, writing nothing.

**Why.** The queue holds quotes indefinitely, across sessions. A book added yesterday should change the answer for a batch staged last week, and a stored preview would go stale silently and be believed.

**Instead of.** Storing the resolved target at import — rejected; it is a cached answer to a question whose inputs keep changing.

**Approved.** Mine, and I approved the read-only split of `findImportBook` specifically so the preview and the real resolution cannot diverge.

<sub>1.2.0 — `internal/httpapi/import_staging.go` · `CHANGELOG.md`</sub>

### A staged quote carries both locator sets plus as-imported snapshots, so a cross-kind retarget is reversible

**Decided.** `staged_quotes` holds `chapter` / `location` (book) *and* `character` / `actor` / `timestamp` (film) on every row, plus `location_orig` and `timestamp_orig`. Approval reads whichever set the destination kind uses.

**Why.** Retargeting a batch across kinds is the repair for a misdetected file, and moving book highlights onto a show must not destroy the chapter and location on the way, in case the move is itself the mistake. The `_orig` columns are the as-imported snapshot: bulk location formulae rewrite the live column, and `reset` restores the snapshot, so a formula applied by mistake is recoverable rather than permanent.

**Instead of.** Clearing the unused locator set on retarget — rejected; it makes the repair one-way.

**Approved.** I signed this off on the principle that nothing in a holding area should be irreversible, which is the whole reason the holding area exists.

<sub>1.2.0 — `internal/store/migrations/0023_import_staging.sql`</sub>

### A staged work with no quotes is still approved, or a whole-library round-trip would drop the unquoted shelf

**Decided.** `resolveStagedSelection` resolves works separately from quotes rather than deriving them, and `loadStagedForApproval` takes works from the selection's own work list. Approving a work with no quotes still creates its library row.

**Why.** A book or film exported with no quotes at all re-imports as exactly that, and the pre-1.2.0 importer still created its row. Deriving works from quotes would mean a whole-library export could not round-trip: every unquoted work on your shelf would vanish on the way back in. The one exception is an explicit id list, which names quotes — so its works are exactly the works those quotes sit under, because naming a quote must never drag its quoteless siblings in.

**Instead of.** Deriving works from the selected quotes — rejected on the round-trip.

**Approved.** My call, and the asymmetry between an id selector and a work/batch/all selector is one I approved deliberately rather than smoothing over.

<sub>1.2.0 — `internal/httpapi/import_staging.go` · `CHANGELOG.md`</sub>

### A duplicate within one file enriches instead of disappearing, keeping the approved count equal to the shown count

**Decided.** `stageQuotes` uses `INSERT OR IGNORE` against `UNIQUE (staged_work_id, dedupe_hash)`; on a collision it calls `enrichStagedQuote` rather than moving on.

**Why.** The live importer enriched in that case rather than discarding, so staging must too — otherwise the second copy's locators, note, colour and tags are lost silently, before anyone can see them. The unique constraint mirrors `annotations`' `UNIQUE (book_id, dedupe_hash)`, so a file's internal duplicates collapse exactly as they used to and the count a user sees in the queue is the count they will approve. It is deliberately *not* unique across batches: importing the same file twice gives two batches, and discarding one is the answer.

**Approved.** I approved this because the queue's whole value is that what you see is what you get, and a silent drop between staging and approval would break that.

<sub>1.2.0 — `internal/httpapi/import_staging.go` · `internal/store/migrations/0023_import_staging.sql`</sub>

### Duplicate enrichment is monotone in the safe direction: fill empty, upgrade colour off yellow, favourite only upward, tags union

**Decided.** `enrichStagedQuote` fills note, date and both locator sets only where they are absent, upgrades `color` only when the stored value is the yellow default and the incoming one is not, takes `MAX(favorite, ?)`, and unions tags case-insensitively. Existing values always win, so the first copy in the file is the one whose edits survive. The `_orig` snapshots follow their live column, so a locator arriving only on the second copy is still resettable.

**Why.** Every rule moves in one direction only, so enrichment can never lose information no matter how many copies a file carries. Yellow is the unset default rather than a chosen category, which is what makes "upgrade off yellow" a fill rather than an overwrite. A note-only first copy followed by a quoted duplicate keeps the quote too, because the hash is over quote-or-note and both are the same passage.

**Instead of.** Last-writer-wins — rejected; it makes the outcome depend on file order.

**Approved.** Mine, and I approved the monotonicity as the property to hold rather than the individual rules — it is what makes the whole thing reasonable about without tracing every path.

<sub>1.2.0 — `internal/httpapi/import_staging.go`</sub>

### Approval converts staged rows back into the importers' own intermediate shape and replays the existing persist path

**Decided.** Approval rebuilds `importer.Annotation` / `importer.Dialogue` from the staged rows and runs the existing write path, rather than writing from staging directly.

**Why.** Dedupe, duplicate enrichment and the ISBN → ASIN → title/author resolution then behave exactly as they did when the importers wrote straight through. There is one implementation of those rules, not two. It needed one refactor and no behaviour change: the target-resolving half of the old `importOneBook` / `importOneMovie` is now separate from the loop that writes the quotes, so the loop can also be handed a target the *user* picked when they retarget a misdetected file.

**Instead of.** A second write path reading staging directly — rejected; two implementations of dedupe is two implementations that will disagree.

**Approved.** My call. Round-tripping through the intermediate shape looks wasteful and I approved it anyway, because the alternative is a duplicate rule set nobody will keep in step.

<sub>1.2.0 — `internal/httpapi/import_staging.go` · `CHANGELOG.md`</sub>

### All four staged endpoints share one selector shape, and a foreign selection matches nothing and answers 404

**Decided.** `GET /import/staged`, `POST /import/staged/bulk`, `POST /import/staged/approve` and `DELETE /import/staged` take the same `{ids | work_ids | batch_id | all}` selector. Any one is enough; combining them narrows. Explicit id lists cap at 5000.

**Why.** `all` exists so "approve everything" does not have to ship thousands of ids through a 64 KiB body. Every query joins through `import_batches.user_id`, so another user's ids simply do not match — a foreign selection reads as an empty one and answers 404, never 403, per the house rule that one account cannot learn another's row ids exist.

**Approved.** I approved one selector across four verbs rather than four bespoke bodies, and approved 404-not-403 as the uniform answer for anything that is not yours.

<sub>1.2.0 — `internal/httpapi/import_staging.go` · `CHANGELOG.md`</sub>

### Selections chunk their bound ids — 32766 is a real ceiling, and the fullest queue was the one that could not be emptied

**Decided.** `sqlIDChunk = 900`, and `chunkIDs` splits every `IN (...)` list. Every caller runs inside one transaction, so a chunked statement is still all-or-nothing.

**Why.** SQLite's compiled parameter limit is 32766, and a *resolved* selection is not bounded by the 5000 cap — that guards only the explicit ids a client sends, while `all` and `batch_id` expand server-side to the whole queue. The queue is designed to hold quotes indefinitely, so one 5 MB Kindle export can put tens of thousands in it. Without chunking, "Approve all" answers 500 exactly when there is most to approve, and the queue cannot even be discarded.

**Instead of.** Capping the resolved selection too — rejected; that caps the feature rather than the statement.

**Approved.** Mine, and the shape of the bug is what I approved recording: the failure lands precisely on the largest imports, which are the ones the staging queue exists for.

<sub>1.2.0 — `internal/httpapi/import_staging.go`</sub>

### Staged tag edits can remove as well as add, and the reason the live endpoint still cannot is structural

**Decided.** `POST /import/staged/bulk` takes `add_tags` and `remove_tags`. `POST /annotations/bulk` still only unions.

**Why.** Staged tags are denormalised text on the row, so a removal is a set operation on that string — no join rows, no vocabulary entry created for a tag nobody approved. The live endpoint's one additive helper is all it has, and the full-state alternative would need every row's current tag set, which the request does not carry. So the asymmetry is not an oversight; it is what the two storage shapes each make cheap.

**Approved.** I approved shipping the asymmetry with the reason written at the top of the file, rather than either holding the staged feature back or rushing a full-state bulk endpoint to match.

<sub>1.2.0 — `internal/httpapi/import_staged_bulk.go` · `CHANGELOG.md`</sub>

### Location bulk edits are formulae over the numeric runs inside free text, with a separate clock path and a clamp

**Decided.** Add, subtract, multiply, divide, set and reset over a selection. Locators stay free text — `p.142`, `610-612`, `42%`, `1234` — and a transform rewrites the numbers inside the string, leaving everything around them alone. A value containing a time pattern converts to seconds, shifts, and re-renders with the component count and zero-padding it arrived with. Results clamp at zero; division rounds to the precision the input showed.

**Why.** Editing locations in bulk needs more than a text box: a Kindle export numbers by *location* rather than page and the conversion is a division, and a PDF's page numbers run a few ahead of the print edition's. `p.142` minus 5 is `p.137`, and a range moves at both ends because both ends are numbers. Digit-by-digit arithmetic on a clock would be wrong — `01:02:03` plus a minute is `01:03:03`, not `61:62:63`. Detection is by *value*, not by which field was picked, because a staged row carries both locator sets and an audiobook "location" of `2:15:00` deserves the same treatment as a film timestamp.

**Instead of.** Matching a chapter:verse locator as a clock — deliberately not done; `2:255` is not a time, and half-matching it would be worse than not matching it at all.

**Approved.** My call, and I approved detection-by-value over detection-by-field after noticing the audiobook case, which the field-based version would have got wrong every time.

<sub>1.2.0 — `internal/httpapi/locformula.go` · `CHANGELOG.md`</sub>

### Bulk staged edits apply in a fixed order — assignments, tags, formula, retarget — and an assignment re-bases the reset snapshot

**Decided.** `handleBulkStaged` applies plain column assignments first, then tags, then the formula, then the retarget, in one transaction. Assigning `location` or `timestamp` writes the `_orig` snapshot as well.

**Why.** A request carrying both a `location` and a `formula` re-bases the snapshot first and then shifts from the value just set, which is the reading a user would predict from the form they filled in. And the value you just typed is what `reset` should return to, not the one the file happened to carry. Season and episode get no `_orig` pair, because no formula renumbers episodes and there is therefore nothing to restore.

**Instead of.** Applying whatever arrives in whatever order — rejected; the combination of an assignment and a formula is exactly where an unspecified order produces a surprising result.

**Approved.** I approved fixing the order and writing it into the comment rather than leaving it implicit in the code's sequence, which is the same thing until someone reorders two blocks.

<sub>1.2.0 — `internal/httpapi/import_staged_bulk.go`</sub>

### Standalone quotes stage under one synthetic `staged_work` of kind 'quotes'; a nullable parent would have disabled dedupe

**Decided.** A batch of work-less quotes gets one synthetic `staged_works` row of kind `'quotes'` to hang from. Grouping, dedupe, partial approval and discard then work untouched, and the approve path branches on the kind it already reads.

**Why.** `staged_quotes.staged_work_id` is `NOT NULL REFERENCES staged_works(id)`, so a quote belonging to no book and no film could not be staged at all — which meant standalone quotes could be exported and never taken back, exactly the gap 1.1.1 closed for the catalogue. Making the column nullable is worse than it looks: SQLite cannot drop a NOT NULL, so it means a full rebuild, and it breaks the very dedupe it is trying to preserve — `UNIQUE (staged_work_id, dedupe_hash)` stops collapsing anything once the first column is NULL, because SQLite treats NULLs as distinct in a UNIQUE, so a file with the same line twice would stage twice.

**Instead of.** A parallel `staged_utterances` table — rejected; it duplicates the whole staging pipeline for a second shape that wants identical behaviour.

**Approved.** Mine, and I approved naming 0023's foresight rather than silently spending it: that migration's own comment already said the `kind` vocabulary was app-validated because a CHECK cannot evolve, which is why a third kind cost nothing here.

<sub>post-1.3.0 — `internal/store/migrations/0028_staged_utterances.sql`</sub>

### Imported dialogue anchors onto a pre-existing same-title film, and the anchor is previewed before approval

**Decided.** Imported film and show dialogue attaches to the best pre-existing same-title row rather than spawning a poster-less duplicate. `anchorScore` ranks candidates: an exact release-year match dominates, then a curated poster, then existing dialogues, then recency. The decision happens at approval, but is previewed on the staging reply and in the queue.

**Why.** A page's title rarely matches a curated title on the year alone — IMDb's release year and TMDB's often differ by one — so year-strict matching would create duplicates of things you already have. The preview exists because the library may have changed while the quotes waited, so "this will attach to your existing Casablanca (1942)" can be seen and corrected before anything is written, and an ambiguous match (more than one same-title film) is flagged as such.

**Instead of.** Matching on title and year together — rejected on the off-by-one.

**Approved.** I signed this off in response to a user request, and approved moving the resolution to approval time once staging existed, since the answer is only correct at the moment it is acted on.

<sub>1.2.0 — `internal/httpapi/import_movies.go`</sub>

### Book identity falls through ISBN → ASIN → title+author, read-only, with identifiers backfilled fill-empty-only

**Decided.** `findImportBook` tries normalised ISBN, then ASIN, then `lower(title)` + `lower(author)`, skipping any key it does not have, and writes nothing. `upsertImportBook` wraps it and backfills the matched row's missing identifiers, author, series and series index with `UPDATE OR IGNORE ... COALESCE(col, ?)`.

**Why.** The same book arrives with an ISBN from one tool and bare title/author from another, and both must land in one row for cross-source quote dedupe to work. Backfilling the cheap key on a match means the *next* import, which may carry only one identifier and a differently-formatted title, still matches. `OR IGNORE` skips rather than fails if another row already owns that ISBN or ASIN, since both carry partial unique indexes per user. Fill-empty-only throughout, so existing data always wins.

**Approved.** My call, and the read-only split is the part I approved deliberately — it is what lets the staging queue ask "where would this land?" using the identical resolution that will actually run.

<sub>pre-1.0, split read-only in 1.2.0 — `internal/httpapi/import_handlers.go`</sub>

### Markdown import auto-detects two shapes from the first line, and every field is optional

**Decided.** `Markdown()` looks at the first non-blank line: `---` is the Tippani frontmatter format, `# ` is a Readest "Highlights & Annotations" export, anything else is a clear error. A UTF-8 BOM and CRLF are tolerated. The handler peeks first to route between the quote, catalogue and book parsers.

**Why.** Two shapes, one decisive character each, decided before any parsing. Book boundaries in a multi-book file are the frontmatter `---` delimiters, and Tippani exports never emit a bare `---` in the body, so the open/close pairs alone locate each book.

**Reversal.** One detection rule was wrong and I fixed it: format auto-detection keyed off `director:` / `creator:` and the character/actor/timestamp bindings, all of which are optional, so a film with no director and no bound lines fell through to the book path. `collection:` is decisive now, since only the catalogue export writes it. What I got wrong was resting detection entirely on content that is allowed to be absent.

**Approved.** Mine, and the correction is mine; I approved moving detection onto a key the exporter always writes rather than one the data might happen to carry.

<sub>1.0.1 (correction) — `internal/importer/markdown.go` · `internal/httpapi/import_handlers.go` · `CHANGELOG.md`</sub>

### The Kindle clippings importer was deferred behind a registered 501, then shipped labelled experimental

**Decided.** The route existed and answered `501` from the moment the other importers shipped. It was implemented in 1.0.0 and the card says *experimental* on its face.

**Why.** A registered route answering 501 says "this is planned and not built", which is a better answer than a 404 that says "you are wrong about the URL". Shipping it labelled rather than silently is the honest version, because Amazon never documented the format and localises the whole metadata line, so a device set to a language I could not verify will do worse.

**Approved.** I approved both the deferral and the label. Shipping an unverifiable parser with no warning would have been the thing I would want to take back.

<sub>1.0.0 — `CHANGELOG.md`</sub>

### The clippings parser reads structure, never English keywords, and language words may only promote a highlight to a note

**Decided.** Everything deciding what a record *is* comes from structure: the `==========` separator, the leading `- `, the `|` field splits, digit runs, and whether the body is empty. Language keywords are only ever an enhancement — they can promote a highlight to a note, never rescue a block the structure rejected. Keywords are matched `\b`-delimited and only in the metadata line's first field.

**Why.** The format is undocumented and varies by device generation, firmware and — the part that hurts — the Kindle's UI language. Word-bounding and field-confining the keywords is not fussiness: `loc` otherwise matches "clock", `nota` matches "notary", `page` matches "pageant", and a chapter titled *NOTES ON THE CLOCK TOWER* would turn a highlight into a note and swallow the chapter. A missing language costs a less precise field, which is the safe failure — the text is still imported.

**Instead of.** Locales that could not be verified were left out rather than guessed at.

**Approved.** Mine, and the rule I approved is the ordering: structure decides, language only refines. It is what keeps an unknown locale from losing a quote.

<sub>1.0.0 — `internal/importer/kindle_clippings.go`</sub>

### The Kindle author string is kept verbatim, because a joined credit and a reversed name are indistinguishable

**Decided.** The author is the *last* parenthesised group on the title line, and whatever it says is what the book gets. A group that reads as a printing detail rather than a person — a year, "(Unabridged)", "(Book 3)" — is left on the title.

**Why.** Kindle writes both "(Marshall, Michael)" and "(Margaret Hunt, Wilhelm Grimm, Jacob Grimm)", and the two are indistinguishable without guessing. Re-ordering the first would mangle the second, and splitting on " and " / " y " would turn José Ortega y Gasset into two people. Taking the last group is what lets "Dracula (Penguin Classics) (Bram Stoker)" keep its own brackets.

**Instead of.** Normalising "Last, First" — rejected on the ambiguity.

**Approved.** I approved doing nothing here, which is a decision as much as any transform is: the cost of a wrong guess is a corrupted credit, and the cost of no guess is a credit that reads slightly oddly.

<sub>1.0.0 — `internal/importer/kindle_clippings.go`</sub>

### A Kindle note merges onto a highlight only at a shared non-empty position, and a re-emitted record keeps the longer copy

**Decided.** `mergeClipNote` requires both the previous annotation of the same book *and* a non-empty position the two agree on. Without a position to key on, the note stays a note-only annotation. `dropClipDuplicate` handles Kindle re-emitting a whole record when a highlight is extended in place: at the same position with one text a prefix of the other, the longer wins, and any note already merged onto the copy being replaced is carried over.

**Why.** Kindle emits a note as its own record immediately after the highlight it annotates, but some devices carry no position — and attaching a note to whatever happened to come before it is worse than leaving it standing alone. Prefix matching at a shared position is what distinguishes "the same highlight, extended" from "two highlights that start alike".

**Instead of.** Merging on adjacency alone — rejected; it is right most of the time and silently wrong the rest.

**Approved.** My call. Both rules refuse to act on weak evidence, and I approved that bias throughout this parser: skipped and counted back to you beats guessed at.

<sub>1.0.0 — `internal/importer/kindle_clippings.go`</sub>

### Upload safety: cap the body before parsing, sniff the content, never trust the declared Content-Type

**Decided.** `readUpload` wraps the body in `http.MaxBytesReader(w, r.Body, maxImportBody)` — 5 MB — before `r.FormFile` is called. Routing between the quote, catalogue and book parsers is done by inspecting the bytes (`MarkdownKind`, `LooksLikeMovieMarkdown`), never by the declared type.

**Why.** Capping after parsing is not capping. And the declared content type on a multipart upload is whatever the client says it is, so routing on it means a mislabelled file takes the wrong parser — which, before staging existed, meant writing the wrong rows.

**Approved.** I approved the cap-before-parse ordering explicitly, because the natural way to write the handler puts it the other way round.

<sub>pre-1.0 — `internal/httpapi/import_handlers.go`</sub>

### Uploaded filenames are base-named and truncated, never rejected, because the name is displayed and never used as a path

**Decided.** The uploaded filename is reduced to its base name via `filepath.Base(filepath.ToSlash(...))`, blanked if it degenerates to `.` or a separator, and truncated to 128 runes. A long or odd name never fails the upload.

**Why.** The name is kept because the staging queue groups and filters by the file a batch came from, so "the Kindle export" and "the Goodreads page" stay distinguishable in one pending list. It is displayed and never touches the filesystem — nothing here writes a file — but stripping the directories keeps a hostile name from *rendering* as one. Truncating rather than rejecting is the right trade: a long name is not a reason to refuse someone's highlights.

**Instead of.** Rejecting names over the limit — rejected; the name is decoration and the quotes are the payload.

**Approved.** Mine, and I approved the "displayed, never a path" framing being written down, since it is what justifies sanitising lightly rather than defensively.

<sub>1.2.0 — `internal/httpapi/import_handlers.go`</sub>

### An import never 400s over its media type or a bad date — the queue is where a wrong guess gets corrected

**Decided.** `importMediaType` folds anything that is not "show" into "movie", unlike `normalizeMediaType`, which validates a client's field and rejects a bad value. On the shelf side, a status the server does not recognise is dropped, an invalid position is cleared, and a date that would fail validation is dropped while the read itself is kept.

**Why.** A parsed file *guesses*; a client *asserts*. A hand-edited file should not fail an import over one bad word, and the staging queue is a review screen — the wrong guess is meant to be corrected there, by a person looking at it, rather than bounced at the door with the other four hundred quotes in the file.

**Instead of.** Strict validation on the import path — rejected; it fails a whole file over one line.

**Approved.** I approved the asymmetry between the two normalisers, and approved the comment on `importMediaType` that names it, because two functions doing nearly the same thing differently is otherwise read as a bug.

<sub>1.2.0 — `internal/httpapi/import_movies.go` · `internal/httpapi/shelf.go`</sub>

### `noted_at` and `source` are create-only, allowlisted, and bounded against clock skew

**Decided.** Both are accepted on create only — "a capture's origin doesn't change when you fix a typo in it". `source` is allowlisted to `manual` and `ocr`; importers set their own source strings server-side and are not on that list. `noted_at` accepts four layouts and is refused if it sits more than 24 hours ahead of the server clock.

**Why.** A capture made on Tuesday and flushed on Friday used to be dated Friday, with the real date unrecoverable — that is why the field exists. The allowlist exists because `source` is displayed and filtered on, so a client must not be able to invent provenance, and only a real import may claim to be one. The skew tolerance has to cover the timezone range, because a phone in UTC+14 sending local time is legitimately most of a day ahead; beyond that a date is a typo or a broken clock, and accepting it would park the quote at the end of every sort forever.

**Approved.** My call on all three constraints. The 24-hour window is the one I thought hardest about, and I approved it as a deliberate over-tolerance rather than a tight bound.

<sub>1.1.0 — `internal/httpapi/capture_fields.go` · `internal/httpapi/quote.go` · `CHANGELOG.md`</sub>

### Unverified importers ship only when someone can confirm them, or ship labelled experimental

**Decided.** Kobo (`KoboReader.sqlite`) stays on the backlog rather than shipping, because I have no device here to test a real file against. The Grimmory sync source is marked unverified until I can test it against a real box. The Kindle clippings importer shipped labelled *experimental*.

**Why.** An importer that has never met a real file is a guess wearing the clothes of a feature. There are two honest ways out — do not ship it, or ship it saying so — and which one applies depends on whether the format degrades gracefully. Kindle clippings does: an unknown locale costs a less precise field, never a lost quote. A misparsed SQLite schema does not.

**Approved.** Mine, and I approved holding Kobo back specifically because it is the most-requested of the three, which is the case where the temptation to ship on a guess is highest.

<sub>ongoing — `docs/roadmap.html` · `CHANGELOG.md`</sub>

### Text cleanup belongs server-side and shared, not inside the OCR client

**Decided.** De-hyphenating across line breaks, dropping page numbers and running heads, and normalising the quote marks and ligatures that get mangled in transit belong in [data hygiene](roadmap.html#data-hygiene), server-side and shared — not in the Android client where the Android section first listed them.

**Why.** Every import source produces some of it, not just OCR, and the typographic-folding normaliser already exists for the dedupe hash. Putting it in the app would mean one source got the cleanup and the other seven did not.

**Reversal.** The work is listed in the [Android app](roadmap.html#android) section as OCR post-processing and I moved its home rather than its description. What I got wrong first time was locating a shared problem inside the feature that happened to surface it.

**Approved.** I approved the move and approved leaving the cross-reference in both sections, so neither reads as though the other forgot.

<sub>not built (recorded on the backlog) — `docs/roadmap.html`</sub>

### The photo taken for OCR is worth keeping, attached to the quote

**Decided.** One nullable path column on the image pipeline that already stores covers, posters, portraits and stickers.

**Why.** The correction screen already holds the photo beside the text, and keeping it "keeps the evidence next to the transcription for the next time you doubt a line".

**Instead of.** Discarding the photo after transcription — rejected.

**Approved.** Mine, and I approved it on the cost: the pipeline already exists, so the whole feature is one column and a path.

<sub>?</sub>

## 10. What Leaves the App: Exports, Round-Trips and the Shared Image

An export whose own re-import loses or duplicates data is not an export, so round-trip fidelity is treated as a testable property rather than a hope. The share image is the other artefact that leaves the machine, and it is governed by what a recipient can and cannot be expected to understand.

### Export is one renderer behind three endpoints

**Decided.** `GET /books/{id}/export`, `GET /movies/{id}/export` and `GET /export` (a zip of `books/<title>.md` + `movies/<title>.md`) all render through the same code. Frontmatter carries the work's metadata; the body writes `- key: value` lines for **non-default** metadata only. Filenames sanitise `[/\:*?"<>|]` to `-` and collisions get a ` (2)` suffix, capped at 120 runes, falling back to `untitled`.

**Why.** Three renderers would drift, and drift in an exporter is invisible until someone re-imports a file written by the wrong one. Writing only non-default values keeps the file readable as a document rather than as a database dump — a file only mentions colour when a colour was chosen — and it is why the default colour is omitted everywhere. The filename rules exist because the zip has to extract on Windows as well as on the machine that made it. I approved the one-renderer shape before the second endpoint existed.

<sub>`docs/PLAN.md` · `internal/httpapi/export_handlers.go`</sub>

### Both exports must round-trip: re-importing either is a dedupe no-op

**Decided.** A stated property, asserted by tests: a library's own export, re-imported and approved, changes nothing. A book export is valid §5b(a) input; a catalogue export is read by the movie-markdown importer.

**Why.** An export that its own importer cannot read is a backup you find out is worthless at the worst moment, and one that duplicates on re-import is worse than one that fails, because it fails quietly. Making it a property rather than a habit is what catches the omissions — every field added to a work since has had to answer "does it survive the trip", and three of them did not. When import staging landed, the round-trip tests were kept asserting exactly what they asserted before, through an import-then-approve helper, rather than being relaxed to fit the new flow. Mine, and it is the single most useful invariant in the repository.

<sub>`docs/PLAN.md` · `internal/httpapi/export_test.go`</sub>

### Series and collections were silently lost on round-trip

**Decided.** Both renderers emit a `Name #1.5` value — books as `series:`, films and shows as `collection:` — and both parsers read it back, fill-empty-only.

**Why.** The frontmatter carried title, author, year and genres and never the series, so a library rebuilt from its own export silently lost every series and collection it had. Silently is the word that matters: nothing failed, the books all came back, and the structure did not. Fill-empty-only on the way in means a value already on the row wins, so re-importing an old export cannot undo a series you have since corrected. There was a second, unplanned benefit: `collection:` is written only by the catalogue export, so it became a decisive routing signal for a film with no director. I approved fixing both renderers and both parsers in one change, because half of it would have produced files that only round-trip one way.

<sub>`internal/httpapi/export_handlers.go`</sub>

### "A default needn't be stated" cost round-trip fidelity: a film's own export re-imported as a book

**Decided.** Reversed. `type:` was written for shows only, on the reasoning that "movie" is the default and a default needn't be stated. **Why I was wrong.** `POST /import/markdown` takes one endpoint for both kinds and decides which by inspecting the file, and that decision rested entirely on *optional* content: `director:` / `creator:` / `collection:` in the frontmatter, or `character:` / `actor:` / `timestamp:` on a line. A film with none of them — no director recorded, no collection, its lines unattributed — carried nothing that said "film", so it fell through to the book importer and came back as a **book with annotations**, silently, with the dialogue fields dropped. The general error is worth naming: a default is a fine thing to omit from a form, and a terrible thing to omit from a file whose reader has to work out what it is. Colour could not be pressed into service as a substitute signal either, because migration 0021 put it on both kinds. Files exported before the fix are not retroactively repaired; they have to be re-exported or hand-edited. This was my reasoning and my mistake.

<sub>`internal/httpapi/export_handlers.go`</sub>

### `type:` is the decisive import signal, with the heuristics kept for hand-written files

**Decided.** The catalogue export always writes `type: movie` or `type: show`; the quotes export always writes `type: quotes` and nothing else; the book export deliberately writes no `type:` at all, so its absence is the book signal. The old heuristics still run.

**Why.** Six characters of frontmatter is a cheap price for a file that cannot be misread, and having exactly one line decide the routing means routing no longer depends on which optional fields happen to be filled in. The book export stays silent rather than gaining `type: book`, because the three-way discrimination is already complete once the other two announce themselves, and a book export is the one people are most likely to hand-write. The heuristics are kept for exactly those hand-written files and for exports written before the line became unconditional. I approved leaving the book exporter alone, which is the part of this that looks like an inconsistency and is not.

<sub>`internal/httpapi/export_handlers.go` · `internal/httpapi/export_quotes.go`</sub>

### A show's `season: 0` is written explicitly, and combined forms are accepted on read

**Decided.** `season` and `episode` are written as plain numbers, one per key, and `- season: 0` is written like any other value. On read, either key also accepts `S2E5`, `s02e05` or `2x05` and fills both from it; `- ep:` is an accepted alias.

**Why.** Season 0 is a real season — it is where a series keeps its specials and pilots — so the columns are nullable and *unset* is `null`, never `0`. A 0-means-unset integer would have made "the specials strand" and "nobody recorded an episode" the same fact, and would have dropped `S0E1` on every export. Reading the combined forms is a concession to how people actually write, not to how the exporter writes: the file the app produces is unambiguous, and the file a person types is the one that needs the tolerance. Mine.

<sub>`docs/PLAN.md`</sub>

### Status, progress, position and the read log round-trip, fill-empty-only

**Decided.** `status`, `progress`, `page: 96/214`, `season: 2/3`, `episode: 6/10` and `reads: 2019-03-04 — 2019-04-01; 2021 — 2021-02 (abandoned); 2026-07 —` all export and re-import, and every one of them is fill-empty-only on the way back.

**Why.** Reading state is the part of a library that is most annoying to reconstruct by hand and was the last part the export did not carry. Fill-empty-only is the whole safety story: re-importing an old export must not un-mark what you are reading now, and must not duplicate a history that is already there. It is the same rule the series fix uses and the same rule the bulk metadata refetch uses, which is why it is worth naming once rather than three times. I approved it alongside the rule that `PUT /books|movies/{id}/status` is the only path that changes any of them — an ordinary Edit-form save must never be able to rewrite reading history.

<sub>`internal/httpapi/export_handlers.go`</sub>

### A quotes export groups by occasion and puts unattributed quotes first

**Decided.** `POST /export/quotes` writes `## <occasion>` headings and emits the occasion-less quotes *before* any heading.

**Why.** A quotes file groups by occasion the way a book export groups by chapter, and the parser attributes a quote to the heading above it. So an unattributed proverb written after a heading would come back belonging to a speech it was never part of — the ordering is not tidiness, it is correctness given how the reader works. The occasion is not repeated as a binding on each quote, for the same reason the book export does not repeat the chapter. My call.

<sub>`internal/httpapi/export_quotes.go`</sub>

### `date` is when you saved it and `occasion_date` is when it was said

**Decided.** Two keys, never folded together. `date` matches the book export's key and carries `noted_at`, truncated to `YYYY-MM-DD`. `occasion_date` carries the partial date the quote was spoken — `YYYY`, `YYYY-MM` or `YYYY-MM-DD`.

**Why.** They are two different facts and a single `date` key would silently merge them, producing a file in which a 1944 broadcast is dated to the afternoon you typed it in. Keeping the saved-date key spelled the same across all three exports is what lets one parser read all three. The partial form is preserved rather than normalised, because a text with a contested date has a contested date and saying so is more honest than inventing a day. I approved the two keys knowing it makes the file slightly noisier.

<sub>`internal/httpapi/export_quotes.go` · `internal/httpapi/export_handlers.go`</sub>

### "Export all" was renamed, because all three screens export the filtered view

**Decided.** The button no longer says *Export all* and the help no longer says "the whole library".

**Why.** All three list screens post the filtered view, and the confirmation dialog has always said "N in view" — so the button and the help were the last survivors of a whole-collection export they had already replaced. A control that describes an older version of itself is worse than an unlabelled one, because it is believed. Mine, and it is a one-word fix recorded here because the failure mode — copy outliving behaviour — is the one I keep having to catch.

### Quote-card images render entirely in the browser

**Decided.** The share image is drawn on a `<canvas>` on the device. No server round-trip, no external font or image fetch, and the photograph of whoever said it never leaves the machine.

**Why.** The alternative is a rendering endpoint, which means the server needs a font stack, an image pipeline and a queue, and it means every quote you share passes through it. On a NAS with a zero-idle CPU budget that is the wrong place for it, and on a self-hosted personal library it is the wrong shape for it. It also keeps the CSP at `default-src 'self'` — a canvas that fetched a web font would need that relaxed for everyone. The panel text says so plainly to the reader rather than leaving it as an implementation detail. My call.

<sub>`web/frontend/src/share.jsx` · `web/frontend/src/quoteImage.js`</sub>

### The image's credit is the mark plus "made with", and the mark is drawn rather than loaded

**Decided.** The footer of a shared card carries, bottom-left, in `--faint`: the Tippani mark, the words "made with", the wordmark and the Bengali wordmark. The mark is **canvas geometry** — the bubble, its tail, the two ৭ glyphs and the punch-card column, in `mark.svg`'s own 256 coordinates — not an `<img src="/mark.svg">`.

**Why.** A picture of a quote is the one artefact this app makes that leaves it, and by the third re-post nothing travels with it except what was painted in. "tippani" alone named the app to somebody who already knew it, and to everybody else it read as a signature under words that belong to whoever said them; "made with" is what makes it a credit rather than a claim.

Drawn rather than loaded because `mark.svg` is a *fetch*, and it would make the one part of the card that says where the picture came from the one part that needs a network round-trip to be correct. The portraits can afford that — they arrive and the card redraws — and a wordmark cannot: the PNG exported in the first half-second is the copy that goes out. Same-origin and untainted was never the problem; being late was. The gradients, ink hairline and displacement filter in the real file are left out, because none of them is legible at 20px and each would be a second definition of the logo to keep in step.

The mark keeps the brand's red — lifted to `#D8613D` on a dark card — rather than taking `theme.accent` like every other coloured thing on the canvas. A blue tippani logo is not the tippani logo, and since the accent is the natural thing to reach for here, that is what the test asserts.

**Instead of** louder branding: a corner badge, a bottom bar, the mark at 40px. Rejected on the same reasoning that put it bottom-left in `--faint` to begin with — branding somebody is about to post is branding they will crop.

**Approved.** Mine. I asked for the logo and for it to stay unobtrusive, and picked the corner.

<sub>1.7.9 — `web/frontend/src/quoteImage.js` · `web/frontend/src/help.jsx` · `web/frontend/test/dom/quote-image-brand.test.jsx` · `CHANGELOG.md`</sub>

### The credit is one baseline and one optical centre, with no per-run nudges

**Decided.** All three words of the footer credit — "made with", the wordmark, the Bengali wordmark — are drawn on ONE baseline, at their three different sizes. The mark, which has no baseline, is centred on the **cap-height band** of those words: `base - FOOT_CAP` to `base`, where `FOOT_CAP` is 0.7em of the 14px face.

**Why.** 1.7.9 shipped the line with three slightly different alignments — the mark hung off the baseline (so it floated, because the caps it sits beside only reach 0.7em) and the Bengali was lifted a pixel for no stated reason. A shared baseline is how mixed sizes are set on a line; the pixel of lift is what made it stop looking like a line.

Centring the mark on the em box would have been the other plausible reading and is wrong here: an em box includes descender space this line never uses, so it pushes anything beside the words visibly high — which is the bug, arrived at from the other direction.

**Instead of** eyeballing each element until the rendering looked right. That is how the first version was built, and it is why the test now asserts the three baselines are **equal** rather than "within a pixel or two": an approximate assertion is an invitation to re-add the fudge.

**Approved.** Mine — I reported the misalignment.

<sub>1.7.10 — `web/frontend/src/quoteImage.js` · `web/frontend/test/dom/quote-image-brand.test.jsx` · `CHANGELOG.md`</sub>

### The share sheet opens on the picture, and its two window actions live together

**Decided.** `Image` is first in the format row and is the initial state. The dialog's header carries the picture's share action as a glyph immediately left of the ×; the footer's worded `Close` and the panel's `Download PNG` / `Share / save PNG` primary are both gone. Copying — text or image — stays a worded button.

**Why.** The order was right when this dialog was the only way to get anything out of a quote. 1.7.9 put copy on the card, so pasting text is now one tap that never opens this window, and what is left is the thing the window is actually for: the picture is the only output that needs a skin, a portrait and a colour decided first, and the only one nothing else can produce.

The buttons follow from the same reading. Handing the picture over and leaving are the only two things anybody does to this window, so they sit as a pair in the corner; a second, worded way out in the footer was one door too many out of one room. It also retired a label that named itself two ways by breakpoint ("Share / save PNG" against "Download PNG"), which is the fault §13 already logged once.

Copy keeps its words because copying is not sharing: it goes nowhere, it needs somewhere to paste, and the ✓ in its label is the whole feedback.

**Instead of** making the header glyph share whatever the active format is, text included. Rejected as a guess: "share this text" has no meaning on a desktop without a share sheet, and the text panel already has the correct verb on a button.

`QuoteImagePanel` publishes its share action through a ref rather than surrendering the canvas upward. The render pipeline — theme, portrait, colour, font loading, redraw-on-event — belongs to the panel, and moving any of it to satisfy a button's position would be the tail wagging the dog.

**Approved.** Mine, and I asked for both halves.

<sub>1.7.10 — `web/frontend/src/share.jsx` · `web/frontend/src/help.jsx` · `web/frontend/test/dom/share-dialog.test.jsx` · `CHANGELOG.md`</sub>

### One class of client forced a server route: Android WebView has no Web Share, and a blob URL is revoked mid-save

**Decided.** Try `navigator.share` first. On mobile without it, POST the PNG to `/share/image` and navigate to the returned URL. The last-resort blob anchor revokes its object URL after 60 seconds, not immediately.

**Why.** Android WebView wrappers never implement Web Share, and a plain-HTTP origin strips it, so the "no server" rule had to bend for exactly one class of client — and the bend is a staged file with a short-lived token rather than a rendering service. The bridge in those wrappers mangles both the filename (the blob UUID) and the bytes (base64 truncation), while a real URL with `Content-Disposition` survives the DownloadManager boundary intact. The 60-second revoke is the other half: browsers save blob URLs asynchronously, mobile especially, and revoking immediately truncates the download into a corrupt file — a bug that looks like a broken image rather than a broken timer. An `AbortError` from the share sheet is a user closing it, not a failure, so it returns rather than falling through. I approved the exception with the token rules in §2 attached to it.

<sub>`web/frontend/src/share.jsx` · `internal/httpapi/share_handlers.go`</sub>

### Copy falls back to a legacy path, because a plain-HTTP LAN instance has no async Clipboard API

**Decided.** `copyText` uses `navigator.clipboard` where it exists and `execCommand` where it does not. Image copy is gated on `ClipboardItem` and `navigator.clipboard.write` both being present, and the button is hidden rather than inert when they are not.

**Why.** `navigator.clipboard` is undefined on insecure origins, and a self-hosted instance on a LAN over plain HTTP is an insecure origin — which is the *default* deployment this app documents. The old path silently no-opped there, so "copy does nothing" was a real bug report from the most ordinary setup there is. Hiding the image-copy button rather than disabling it follows the same rule the portrait toggle uses: a control that cannot do its job is not a control. Mine.

<sub>`web/frontend/src/share.jsx`</sub>

### The share-image skin is chosen independently of the app theme and remembered per device

**Decided.** `tippani:shareImageTheme` persists the picture's skin, defaulting to whatever the app is currently showing so the first share matches what you were just looking at. Changing it never changes the app.

**Why.** The card you post and the app you read in are two different rooms. The one you read in is an identity preference; the one you post is an export preference, like the view toggles, so it belongs on the device rather than on the account. The default is the live skin because that is the least surprising first answer, not because the two are linked. I approved the per-device storage for all three picture options — skin, portrait mode and colour — as one class.

<sub>`web/frontend/src/share.jsx`</sub>

### The backdrop replaces the portrait chip, and the control names both states

**Decided.** Reversed twice, and worth both. The card originally drew both the 34px credit chip and the full-height backdrop. The backdrop now replaces the chip, and the toggle reads Chip/Backdrop rather than Off/Backdrop. **Why I was wrong.** Drawing both was reasoned as "the backdrop is atmosphere and the disc beside the name is the identification". That does not survive contact with an actual card: a 34px crop of the same photograph beside a full-height version of the same photograph reads as a mistake, not as a second piece of information. The layout reclaimed space too — the attribution line stopped indenting past a cluster that was no longer there. The second correction followed from the first: once the backdrop replaces the chip, "Off" was a lie, because turning it off never removed the person from the card, it changed how they appeared. The control is also hidden entirely when nobody credited has a saved photo, since a toggle that cannot change the picture is a question with one answer. My call each time.

<sub>`web/frontend/src/share.jsx`</sub>

### Every word on a backdrop card carries a zero-offset halo in the drawn skin's own surface colour

**Decided.** Text on a backdrop card is haloed, with **no** offset, in the surface colour of the skin being drawn.

**Why.** A photograph is not a background colour: it has its own lights and darks, and ink that reads cleanly on paper vanishes into a shoulder or an eye — not all of it, which would at least be obvious, but a word here and a word there, in the one artefact this app produces that somebody else reads. Zero offset makes it a glow around each letter rather than a drop shadow beneath it, because the text is meant to be *on* the card, not floating above a picture. The colour comes from the skin being drawn rather than the one on screen, since the picture's skin is chosen separately and frequently is not the app's — reading the live theme here would have been correct only by coincidence. Approved by me, and the "drawn, not displayed" detail is the part that is easy to get wrong twice.

<sub>`web/frontend/test/dom/quote-image-halo.test.jsx`</sub>

### The portrait tint is a duotone applied before the fade mask, with the blend mode read back

**Decided.** The quote's colour is applied to the portrait as a duotone — the blend keeps the photograph's luma and takes the highlight colour's hue — while the buffer is still opaque, and the fade mask is applied after. The canvas's `globalCompositeOperation` is read back after assignment, with a `source-atop` wash standing in when `color` did not take.

**Why.** Order first: tinting after the mask leaves the colour surviving as a coloured rectangle where the face used to be, so the fade has to come second for the colour to fade out *with* the face. Read-back second: `color` is a CSS blend mode, not a Porter-Duff operator, and a canvas that does not implement it ignores the assignment **in silence**, leaving whatever was set before — which is `source-over`, and painting a quote colour source-over is a flat slab across somebody's face. The property is therefore read rather than trusted. The test drops `color` from what its canvas accepts and asserts the fallback happens, because "it works in my browser" is the exact shape of claim that guard exists to stop anyone making. Both facts are asserted rather than assumed, and a mutation that swaps the order fails the suite. I signed this off after the mutation run, not before.

<sub>`web/frontend/test/dom/quote-image-portrait.test.jsx`</sub>

### The share image's colour tint defaulted on, as information about the quote

**Decided.** When the tint shipped it was one switch for both card kinds — on a plain card the colour is the stripe beside the words, on a backdrop card it is the hue of the portrait — and it defaulted on.

**Why.** The reasoning was that it is one decision, not two, because "do I want this quote's colour in the picture" is the same question either way; and that the colour is information about the quote, so including it is the fuller artefact. It is never both at once — a stripe next to a portrait already wearing the colour is the same thing said twice, the second time louder. The one-switch half was right and survives. I approved the default, and see below.

### The tint defaults off, and the storage key was retired to make that true

**Decided.** Reversed. `tippani:shareImageTint` defaults to `false`, and the key is a new one. **Why I was wrong.** A colour category is a private filing decision — what *kind* of note this is to me — and the picture goes to someone who has no idea the scheme exists. To them a blue stripe or a blue face is a design choice the card is making, and a fairly loud one. The colour is worth offering and worth remembering; it is not worth assuming. The second half is the part I would have missed: `usePersistedState` writes on *mount*, so the old default had already been stamped into local storage by the first render of the panel on every device that ever opened it — flipping the literal alone would have changed the default for nobody. Retiring the key discards a value almost nobody chose, and the switch is one click away for anyone who did. Mine both times, and the second was the better call.

<sub>`web/frontend/src/share.jsx`</sub>

### The share image picks which credit line wears portraits by a positive test

**Decided.** `facesOnAttribution` checks membership of `ATTRIBUTION_CREDITS = {'author', 'speaker'}`, as a named function rather than a condition inside the draw call.

**Why.** The draw call used to ask `facesFor !== 'actor'`, so any new credit kind landed on the attribution line by falling through a negative test. That was right for a standalone quote's speaker by luck and would have been silently wrong for whatever came next. The positive form also states the rule instead of implying it: a credit is on the attribution line when it *is* the attribution — a book's author, a quote's speaker — whereas a film's attribution is its title, so the actor hangs off the meta line. This is the same class of defect as the orphan sweep's defaulting arm and `personCreditSQL`'s two switches, and I approved fixing it the same way: make the missing case visible instead of survivable.

<sub>`web/frontend/src/quoteImage.js`</sub>

### `categoryHex` is the one place a real hex value is still required

**Decided.** Every surface resolves a colour through `categoryVar` — `var(--hl-N)` — except the share canvas, which calls `categoryHex`.

**Why.** A custom property updates itself when a category is recoloured; a copied hex does not, so the app-wide rule is that nobody copies. `ctx.fillStyle` parses neither `var()` nor `color-mix()`, so the canvas physically cannot read the property every other surface reads. Isolating that to one exported function with a comment saying it is the *one* place is what stops a second call site quietly appearing. Mine, and naming the exception is the whole of the decision.

<sub>`web/frontend/src/theme.js` · `web/frontend/src/share.jsx`</sub>

### Location and Noted start unchecked in the share dialog

**Decided.** `SHARE_OFF_BY_DEFAULT = {location, noted}`; everything else defaults on.

**Why.** The page/timestamp and the date you saved it are the two least-wanted parts in a shared quote — factual noise for most readers — while remaining one tick away per share. I approved this on the same reasoning as the tint default: the recipient is the audience, and anything that is a note to myself starts off.

**Instead of.** Everything on by default (noisy).

<sub>`web/frontend/src/share.jsx` · `share.jsx`</sub>

### The Markdown preview avoids ES2018 regex lookbehind

**Decided.** The italic-but-not-inside-snake_case rule consumes the boundary character as group 1 and re-emits it as text, rather than using a leading lookbehind.

**Why.** Older Android WebViews and Safari lack ES2018 lookbehind, and Vite lowers the literal to a runtime `new RegExp(...)` that then *throws* there — blanking the whole app, not degrading the preview. This is the failure that motivated the ErrorBoundary as well, and it is worth recording as a rule rather than a fix: the share dialog is reached from a phone more than from anything else, so it is the worst place in the app to use a recent language feature. My call.

<sub>`web/frontend/src/share.jsx`</sub>

### Anthologies are the missing output of a commonplace book

**Decided.** The roadmap's [anthologies](roadmap.html#anthologies) section: a named, ordered list of quotes drawn from anywhere in the library, carrying prose of its own — an introduction, and commentary between the entries. Exported as one Markdown file, and via [interop](roadmap.html#interop) as EPUB.

**Why.** Everything in Tippani today points inward: you file a passage, you find it again, you get asked about it. An anthology is what you make *from* the collection — a sequence you arranged, on a theme you chose, with the connective tissue that explains why these twelve passages belong next to each other. It is explicitly not a tag with a nicer hat: the two things a tag cannot do are hold an order and hold your writing, and those are the whole point. Letterboxd's lists are the closest proven form; the nearest thing in the annotation world is Zotero's extract-annotations-into-a-note, which is the most-used feature it has. It also reuses what exists — the bulk-select bar on three screens for composing, and the themed-deck [review loop](roadmap.html#review-loop). Mine, and it is the one planned feature I would call load-bearing for what the app is *for*.

<sub>`docs/roadmap.html`</sub>

### An anthology decides what its own passages show, and the choice lives on the row

**Decided.** Migration 0045 puts six switches on the `anthologies` row — `hide_credit`, `hide_source`, `hide_commentary`, `hide_colour`, `show_locator`, `show_date`, each `INTEGER NOT NULL DEFAULT 0` — read everywhere through one `anthologyFieldCols` constant, carried in Go as an embedded `anthologyFields`, written by `POST /anthologies` as well as by the PUT, and honoured by the reading view and by the Markdown export alike. They are not in the preferences blob and they are not export query parameters.

**Why on the row.** A collection of film lines wants its actors named, a book of proverbs wants nothing but the words and no dates, and a single global preference cannot say both — that inability is most of the reason to want the feature at all. On the row the choices are part of the document rather than part of the reader or of the request: they ride the same SELECT the title rides, an account backup copies them because a backup is a whole-database `VACUUM INTO`, and an older archive restored into a newer schema reads them as zero, which is precisely "show what you always showed". Nothing outside the anthology had to learn anything — the commit is the migration, the handlers, the export renderer, the screen, the strings and the tests, and the backup, restore, import and bin paths are untouched. An export parameter would have meant the same anthology producing different files depending on who asked for it, which no export in this app has ever done.

**Four `hide_` and two `show_`, because every default has to be the zero value.** Neither the locator nor the date had ever been rendered in an anthology — not on the screen, not in the file — so for those two *showing* is the opt-in, while for the four things that were always visible hiding is. It is the same asymmetry and the same argument as `hideLibrary` against `showAnthologies` in the prefs struct: a non-zero default is a setting that reads as changed the moment it is read, and on a column it is the difference between an upgraded database and a fresh one. The consequence is about files that already left the building: an untouched anthology exports byte for byte as it did before 0045, so an export taken last month still diffs clean against one taken today, and the first test in `anthology_fields_test.go` asserts exactly that rather than anything about the switches themselves. Read the six as the switches asked for and not as a closed set — a seventh is a column, a name in `anthologyFieldCols` and a row in `FIELD_SWITCHES`, not a new code path.

**The screen and the file are one document.** The same six flags drive `AnthologyEntry` and `renderAnthologyExport`, so a hidden credit is absent from both. An export that quietly differs from the screen is the kind of surprise you only discover in a file you have already sent somebody, which is the one failure this feature could plausibly have shipped with and the reason the flags were never allowed to be an export-time argument.

**The export suppresses a binding by not calling `writeBinding`.** `writeQuoteBlock` and `writeBinding` are shared with the other three export formats — a quote has to read identically in an anthology and in a quotes file — so the flags act as a filter *inside* the callback the shared renderer already invokes, and the whole of "hide the credit" is one `if` around one call. Copying the renderer so this format could own its version is how four export formats would begin to disagree about what a quote looks like, one small fix at a time; that is a cost paid slowly and never noticed, which is why it is written into the file's header rather than left as taste.

**`anthologyHeading` takes the flags too, because it was the leak.** The heading is built from the entry's source and its credit and is also an entry delimiter, so a reader who switched the credit off would still have found it printed in the largest type on the page. It takes `anthologyFields` and drops each part accordingly, and with both off every heading falls back to the entry's position — which is what that fallback always existed for, the proverb with no occasion and no speaker, and which is exactly right here: somebody who turned the attribution off asked for a document of passages.

**The locator is assembled per kind in SQL, one column per arm of the existing UNION.** Each kind's "where in the work" is made of different columns — chapter number, chapter name and page for a book highlight; season, episode and timestamp for a screen line; place and medium for a standalone quote — and a UNION needs one column, so the concatenation happens in the query. The book arm reuses the `<number> · <name>` shape that `chapterHeading` writes in Go and `chapterLabel` writes in JS, which makes a **third** copy of one format, and that is a real cost stated rather than hidden. It is still cheaper than the two alternatives: merging three result sets in Go, when the ORDER runs across the kinds and an anthology's third entry is routinely a film line between two highlights, or shipping the parts and letting the reading view and the export each invent a join. The locator and the date are sent on every entry regardless of the switches, because a reading view that had to refetch the whole anthology to honour a toggle would be a slower and stranger thing than one field of unused JSON.

**A mistake worth recording.** The date first came back as the column, and a test caught it before anybody saw it: `noted_at` stores a datetime, so the card and the file would have read `2026-03-04 00:00:00` — a timestamp on a passage saved in the afternoon, presented as though the minute mattered. It is `DATE(COALESCE(NULLIF(TRIM(COALESCE(noted_at,'')), ''), created_at))` per arm now, which is also the noted-at-wins rule On this day settled on: `created_at` on an imported row is the day of the import, the same day for thousands of rows, and tells a reader nothing.

**On the form the switches read positively.** `FIELD_SWITCHES` lists the six in reading order and each `Toggle` offers Hide / Show — the same pair the Settings Features card uses — so nobody has to work out what "hide, off" means; the inversion between the label and the stored column lives in two named one-line functions, `shown` and `stored`, and nowhere else. The submit body carries all six every time, because the PUT is full-state, and this is the same trap already sprung elsewhere in this app: sending a renamed title alone would zero all six, which does not read as a client bug but as a setting reverting by itself.

**Instead of.** A global preference in `preferences`; per-request export parameters; a second copy of the quote renderer owned by this format.

**Approved.** Mine, and the shape came from my own answer — asked which fields should be switchable I said everything, which is why the mechanism is a filter the renderer consults rather than four special cases with the four named fields hard-coded into them.

<sub>2.1.2 — `internal/store/migrations/0045_anthology_fields.sql` · `internal/httpapi/anthology_handlers.go` · `internal/httpapi/export_anthology.go` · `web/frontend/src/anthologies.jsx` · `internal/httpapi/anthology_fields_test.go`</sub>

## 11. Backup, Restore and Recovery

Backup is a nightly `VACUUM INTO` snapshot with no streaming daemon, and restore runs in-process specifically so the container never needs the host's Docker socket. The archive format's two encryption designs and the two recovery-key designs that died under review are the most instructive entries here.

### A nightly `VACUUM INTO` snapshot from the box's own cron

**Decided.** The documented backup is `sqlite3 data/tippani.db "VACUUM INTO 'backup.db'"` from cron, off-peak — a short burst producing a transactionally consistent, compacted snapshot with no `-wal` or `-shm` sidecars, taken under one read transaction so concurrent writers are unaffected. The primary downside is stated rather than hidden: daily granularity. Litestream, which streams the WAL continuously and would give near-zero RPO, was rejected for constant background CPU on a box that cannot spare it. The in-app `POST /admin/backup` uses the same `VacuumInto` primitive. I approved the trade — a day of granularity against a permanent background process — and the README states it plainly rather than selling it.

**Instead of.** Litestream or an equivalent WAL-streaming daemon.

<sub>from 0.1.0 — `docs/PLAN.md` · `README.md` · `internal/store/backup.go`</sub>

### Restore replaces the data directory in-process

**Decided.** Restore extracts to a staging directory, validates, then closes the live database, moves every non-control top-level entry aside, moves the restored entries in, and reopens — migrate, integrity-check, FTS self-heal — all inside the running process. No Docker socket, no container recreation. The extraction carries hostile-archive guards: a 200,000-entry cap, an 8 GiB decompression-bomb cap, rejection of backslashes and colons in names, `path.Clean` plus an absolute prefix check against the staging root, and rejection of every entry type that is not a regular file or a directory, because a Tippani backup never contains a symlink or a device node. Exactly one `.pre-restore-<ts>` safety generation is kept; older ones are dropped after a successful swap. If the swap fails it rolls back, and if the *rollback* fails it exits 1 with the previous data's location in the log, for a clean boot. I approved the in-process design specifically to keep the socket out of the restore path.

**Instead of.** A restore that recreates the container, which would make the Docker socket a requirement rather than an opt-in.

<sub>0.8.2 and earlier — `internal/httpapi/backup_handlers.go`</sub>

### Restore accepts an uploaded archive, and a foreign schema only if older

**Decided.** Restore previously only re-applied the single archive this server kept in `<data>/backups`, so a backup downloaded from a *different* Tippani box could not be restored — which is not what "restore" should mean, and makes moving to a new machine an SSH job. It now accepts an uploaded file through the same hardened pipeline, on both the admin route and the first-run onboarding route. A foreign archive is accepted only when its `schema_version` is not newer than this build's `MaxMigrationVersion`; older schemas migrate forward automatically. That gate is what makes another server's database safe to accept, and it is the same forward-only rule as 3.11 applied at a different boundary. I approved the upload path and the gate together.

**Instead of.** Refusing foreign archives entirely, which would have left "move to a new box" as a manual file copy.

**Reversal.** Yes, of the kept-archive-only restriction.

<sub>0.8.3 — `internal/httpapi/backup_handlers.go` · `internal/store/backup.go`</sub>

### Restore is reachable during onboarding without a typed confirmation

**Decided.** `POST /auth/restore` and `POST /auth/restore/upload` self-guard exactly like `/auth/signup`: they work only while the users table is empty, so they need no session — and no typed confirmation, because there is nothing yet to lose. The users-empty check at the top is a fast rejection, not the real guard: a slow multi-GB extraction could otherwise finish long after a legitimate signup landed and swap that new admin away. The real guard is a closure re-checked under `backupMu` immediately before the swap, paired with `handleSignup` taking `backupMu` around its INSERT, so a signup cannot commit while a restore holds the lock. Both routes are rate-limited, because restore is expensive and unauthenticated. I approved dropping the confirmation only once the atomic guard existed.

**Instead of.** Requiring a typed confirmation on a box with no data, which is ceremony for its own sake.

<sub>0.8.3 — `internal/httpapi/backup_handlers.go`</sub>

### AES-256-GCM in framed chunks, and no fixed key in the binary

**Decided.** A backup archive is everything: every user's library, the password hashes, the metadata API keys. It left the server as a plain tar.gz until 1.4.1, which is fine while it sits in `<DataDir>/backups` and not fine the moment it is downloaded to a laptop, synced to a cloud drive, or mailed to yourself — which is exactly what a backup is for. So it is sealed: AES-256-GCM over 1 MiB plaintext frames, chosen so the per-frame 21 bytes of overhead is noise against a multi-hundred-megabyte archive while encrypting one frame never needs more than a couple of megabytes live, which matters inside the ~25 MB idle-RSS budget. A single fixed key compiled into the binary was considered and rejected: this is an MIT-licensed repository, so that constant would be public, and "encrypted with a published key" is a claim that reads as protection while providing none. I rejected the fixed key on purpose and I want the rejection on the record, because it is the shortcut this feature invites.

**Instead of.** A compiled-in key; leaving archives plain.

**Reversal.** None, though the key derivation was rewritten within the hour (11.7).

<sub>1.4.1 (sealed), 1.4.2 (v2) — `internal/httpapi/backup_crypto.go`</sub>

### The account password is verified before the archive is written

**Decided.** `POST /admin/backup` checks the supplied password against the stored hash before anything is written — not for authorization, since the session already covers that, but because a typo would otherwise produce a perfectly valid archive that nothing can ever open, and you would not find out until the day you needed it. A backup whose failure surfaces only at restore is worse than no backup, because it has already displaced the habit of taking one. I approved this the moment the failure mode was named.

**Instead of.** Sealing with whatever was typed and letting restore find out.

<sub>1.4.1 — `internal/httpapi/backup_handlers.go`</sub>

### Archive v1 keyed on `<username>#<password>`, and lasted about an hour

**Decided.** V1 derived the archive key straight from `"<username>#<password>"`, and it had two faults. Changing your password orphaned every archive made before the change — the archive is a file, and its key was a string you had stopped using. And the secret was ambiguous: the comment asserting that `#` could not appear in an account name was simply false, because `normalizeUsername` rejects only empty, over-long, whitespace and control characters, so `accountSecret("a#b","cd")` and `accountSecret("a","b#cd")` derived the same key. Harmless in practice — no v1 archive was ever made outside this repository's tests — and entirely my error, including the false comment. One correction to a claim v1 made that v2 should not repeat: a *rename* never orphaned an archive, because the account name is written into the header at seal time and the restore path defaults to it. What a rename broke was the dialog's label, which called your own archive somebody else's.

**Instead of.** A delimiter that genuinely cannot occur, which is a narrower fix to the second fault and no fix at all to the first.

**Reversal.** Reversed wholesale by 11.8, one release later.

<sub>1.4.1, superseded in 1.4.2 — `internal/httpapi/backup_crypto.go`</sub>

### Format v2 derives the key from the password alone, wrapped twice

**Decided.** V2 generates a random per-archive key and seals it twice. `keyWrap` is that key under `Argon2id(secret, per-archive salt)`, where the secret is your password (mode 1) or a passphrase you chose (mode 2) — portable, travelling with the file and opening it on any Tippani, on any machine, with no database, which is what makes a backup a backup. `recWrap` is the same key under this instance's recovery key. The username is not an input at all, which closes the ambiguity, and the password-change orphaning is closed by the recovery wrap rather than by weakening the cipher. Argon2id runs at the OWASP floor — m=19 MiB, t=2, p=1 — deliberately rather than something showier, because this runs on NAS boxes whose unit sets `GOMEMLIMIT` to 64 MiB and a 64 MiB scratch buffer would thrash the collector during the one operation you least want to be fragile. All three parameters are fixed rather than stored, because `p` in particular changes the output and a portable archive cannot let it vary by machine. What this does not do is stated too: it is not a signature, and anyone who can read the data directory holds both the recovery key and the database it protects. I approved v2 and its honest limits in the same review.

**Instead of.** Re-wrapping every archive on a password change, which requires reaching archives that have already left the box.

<sub>1.4.2 — `internal/httpapi/backup_crypto.go`</sub>

### v1 archives are refused by version, not read

**Decided.** The v1 reader was deleted rather than kept. v1 shipped for about an hour and no archive of it exists outside this repository's tests, and keeping a reader would mean keeping the ambiguous `<username>#<password>` secret alive in the codebase — one of the two things v2 exists to remove. So a v1 header is recognised and refused *by name*, which is a clear message rather than a corruption error. Note the asymmetry I did keep: pre-1.4.1 plain gzip archives still restore, because an operator who dropped one into `<data>/backups` for the first-run path must not be stranded by a server upgrade. Refusing v1 while accepting plaintext looks inconsistent until you notice that only one of them requires living code that knows a bad secret. I approved that asymmetry deliberately.

**Instead of.** Keeping a read-only v1 path "just in case".

<sub>1.4.2 — `internal/httpapi/backup_crypto.go` · `internal/httpapi/backup_handlers.go`</sub>

### The instance recovery key is a file, after two designs that destroyed it

**Decided.** 32 random bytes in `<DataDir>/.recovery-key`, written 0600 via temp file and rename so a crash mid-write cannot leave a half-written key that would seal an unopenable archive, and never rotated, because rotating would orphan every archive already sealed under the old bytes. Two earlier designs were wrong in the same instructive way. A `users.recovery_wrap` column: a restore replaces the users table wholesale, so restoring *any* archive — or a factory reset, or deleting the account — silently destroyed the key, with the only surviving copy in `.pre-restore-<ts>`, which the next restore deletes. Two of the most ordinary operations there are, in order, and no error at any point. Wrapping it under a password: re-wrapping needs both plaintexts, which the HTTP password-change handler has and `tippani user passwd` — the only forgot-my-password route on a self-hosted box — does not, so the documented recovery path destroyed the recovery key at exactly the moment it was needed. I approved both designs before review killed them, and this entry exists because both were plausible.

**Instead of.** The two above.

**Reversal.** Twice, before shipping.

<sub>1.4.2 — `internal/httpapi/backup_recovery.go`</sub>

### The recovery key is never archived, never moved, never logged

**Decided.** `controlEntry()` lists `.recovery-key`, and that one line buys both halves of what it needs. `writeBackupArchive` skips control entries, so the key never travels inside the archive it opens — an archive carrying its own key is not an encrypted archive. `moveTopLevel` skips them too, so a restore swaps the whole data directory around it and the key survives. A factory reset deletes the database and leaves the key, which is deliberate: "I reset to clear a corrupt database, now let me restore last night's archive" is the scenario a recovery key exists for. It is never logged and never returned by any endpoint; the only thing the API says about it is a boolean — whether an archive can be recovered on this box. It is not itself encrypted, because anyone who can read it can read the database beside it, and the envelope exists to defend the archive once it *leaves*. I approved every one of those exclusions individually.

**Instead of.** Encrypting the key at rest, which protects nothing on this threat model and adds a second thing to lose.

<sub>1.4.2 — `internal/httpapi/backup_recovery.go` · `internal/httpapi/backup_handlers.go`</sub>

### A passphrase archive gets no recovery wrap

**Decided.** Choosing a passphrase is choosing not to tie the archive to this instance or to any login, so a passphrase archive carries no `recWrap`, and its `ident` field is empty — a passphrase archive has nothing to name and should not hint at the key. That leaves exactly one way to lose an archive permanently now that a password change no longer orphans anything: forget the passphrase. There is no recovery path and deliberately no hint stored, and the UI says so at the moment of choosing rather than in documentation. Passphrases are bounded at 10–20 printable ASCII characters for the same reason the password rules are: this has to be re-typed, on a different keyboard, possibly a year later, with an archive that will not open if it comes out even one byte different. I approved the mode and the warning together; the mode without the warning would have been a trap.

**Instead of.** Recovery-wrapping passphrase archives too, which would contradict what choosing a passphrase means.

<sub>1.4.2 — `internal/httpapi/backup_crypto.go`</sub>

### The recovery restore path requires the caller's own current password

**Decided.** `RecoveryOK` is the entitlement to use this instance's recovery key, and it is deliberately *not* inferred inside `openArchive`. The recovery key opens any archive this box made without the era password, which is the point — and it means the key alone must never be sufficient, or a stolen session cookie could overwrite the whole instance with no credential at all. It could, briefly: the first draft of this handed the recovery path to anyone who asked, and the round-trip test caught a restore succeeding with an empty body. On the admin routes the entitlement is earned by `passwordIsCallers` — the session says who you are, this says you are present and meant it, discharging the role the typed `RESTORE` played in 1.4.1 with something that cannot be guessed from the shape of the dialog. An empty password never qualifies. On the onboarding routes it is free, and has to be: there are no users, so there is no password to verify against and nothing a hijacked session could take. I approved the first draft and the test caught me.

**Instead of.** Inferring the entitlement from an admin session alone, which is what the first draft did.

**Reversal.** Yes, before release, on a test failure.

<sub>1.4.2 — `internal/httpapi/backup_handlers.go`</sub>

### Wrong password and damaged archive are reported as different failures

**Decided.** `errBadKey` is returned from exactly one place — opening a wrap — and covers "wrong password", "wrong passphrase" and "this box's recovery key does not fit" identically, so nothing distinguishes a valid account from an invalid one to whoever is guessing. It must never cover a *frame* failure. In v1 it did, and the inference was sound there, because the derived key's first and only test was frame zero. In v2 the credential is proven the moment a wrap opens, so a frame that fails afterwards means the body was altered or truncated — and reporting that as "wrong password" tells an operator whose archive has been damaged to go and doubt their memory instead. `badKeyMessage` walks the same line from the other side: it never distinguishes "no such account" from "wrong password", but it does say which *kind* of secret is wanted and whether this box can recover the archive on its own, because someone being asked for the wrong kind of thing has no way to work that out from "does not open this backup". My call, and the distinction only became available because v2 changed where the credential is proven.

**Instead of.** One undifferentiated error, which is the safe-looking default and is actively misleading here.

**Reversal.** None; v1's behaviour was correct for v1.

<sub>1.4.2 — `internal/httpapi/backup_crypto.go` · `internal/httpapi/backup_handlers.go`</sub>

### Every nonce is twelve fresh random bytes; frame nonces XOR

**Decided.** Both wraps carry their own random nonce, and that is not decoration: `recWrap`'s key is the instance recovery key, reused across every archive the box ever writes — the first key in this format that is *not* per-archive. Two archives sealed under one key at one nonce leak their plaintexts' XOR and, worse, leak GHASH's authentication subkey, which makes the wrap forgeable; and since the whole header is the frames' AAD, a forgeable wrap is a chosen-archive-key attack on the body. So nothing may derive a wrap nonce from the frame nonce, or from a counter, or from nothing. Frame nonces *are* derived, and by XOR rather than by writing the counter into the low bytes, so all twelve bytes stay archive-specific — with the low eight overwritten, two archives would share the first four bytes of every nonce. I approved both rules and the comment that explains why they are different rules.

**Instead of.** A counter nonce everywhere, which is standard practice and wrong for the one key that is not per-archive.

<sub>1.4.2 — `internal/httpapi/backup_crypto.go`</sub>

### Truncation is caught by the absence of a final frame

**Decided.** Each frame carries a `final` byte, and the frames' additional data is the whole header plus the frame's counter and its final flag. Re-ordering frames breaks the counter, splicing frames from another archive breaks the salt binding, editing the header — swapping the account label, stripping `recWrap` to force a password prompt — breaks every frame, and flipping a final flag breaks that frame. A stream that ends without a frame marked final is an error, not a short read. That is the failure mode that matters most here, because a backup silently missing its tail looks like a backup: right name, plausible size, opens far enough to look fine. `writeBackupArchive` checks every `Close` in order, and `enc.Close()` is the one that matters most, because it writes the final frame. I approved the design around that single sentence.

**Instead of.** A trailing length or checksum, which is another thing a truncation can remove.

<sub>1.4.2 — `internal/httpapi/backup_crypto.go` · `internal/httpapi/backup_handlers.go`</sub>

### The v2 header keeps the v1 prefix byte-identical and appends

**Decided.** Bytes 0 through the ident — magic, version, mode, 16-byte salt, 12-byte nonce, ident length, ident — are byte-identical to v1 on purpose, because `web/frontend/src/secret.js` parses this header in the browser by fixed offset to decide which credential to ask for. Appending the new fields rather than inserting them keeps one parser correct for both versions, and the browser gates on the version byte besides. The parsed header keeps `Prefix` and `Raw` as the exact bytes read, because they are additional data for the wraps and the frames and must be byte-identical to what was sealed — re-serialising would risk a difference that is invisible here and fatal a year from now. My call, and the one-parser constraint is what shaped the layout rather than tidiness.

**Instead of.** A cleaner v2 layout with a second browser parser.

<sub>1.4.2 — `internal/httpapi/backup_crypto.go`</sub>

### Sealed archives are `.tpbk`; a typed `RESTORE` guards only unsealed ones

**Decided.** Calling a sealed archive `.tar.gz` would be a lie that costs someone an afternoon: `gunzip` refuses it and the error says nothing about why. `.tpbk` says what it is. Pre-1.4.1 archives keep their name and keep restoring. The typed `RESTORE` confirmation is now required only for an unsealed archive — the one case that has no key to stand for intent. For a sealed one, supplying the credential its header names *is* the deliberate act, and stacking a typed word on top of it is ceremony that trains people to type the word without reading the sentence above it. I approved dropping the confirmation exactly where a credential replaced it, and nowhere else.

**Instead of.** Requiring the typed word on every restore.

**Reversal.** Yes, of 1.4.1's blanket confirmation.

<sub>1.4.1 — `internal/httpapi/backup_handlers.go`</sub>

### Both keys are tried against one parsed header, never a re-parse

**Decided.** `openArchive` parses the header once and tries the portable wrap and then the recovery wrap against that same parsed structure, so a failed first attempt cannot leave the reader mid-header. An earlier draft re-ran the whole parse per attempt, which reported a perfectly good archive as "not a valid tar.gz" whenever the first key was wrong — the worst possible message, because it tells an operator holding an intact backup that their backup is broken. Everything here happens before anything live is touched, so a wrong credential is a 401 with the current data untouched. I approved the re-parse first and it was wrong; the single-parse version is the fix.

**Instead of.** The re-parse, which is the obvious structure and the one I wrote.

**Reversal.** Yes, before release.

<sub>1.4.2 — `internal/httpapi/backup_handlers.go`</sub>

### The archive layers tar → gzip → envelope

**Decided.** The archive compresses before it is encrypted. The other order would compress ciphertext, which does not compress — ciphertext is indistinguishable from random to a compressor, so you pay the CPU and get nothing back, on a NAS that has none to spare. It is a one-line ordering decision with a one-line reason, and I am recording it because the wrong order is easy to write and produces a working archive that is simply twice the size. My call.

**Instead of.** Encrypt-then-compress.

<sub>1.4.1 — `internal/httpapi/backup_handlers.go`</sub>

### Restore and upload clear the HTTP deadlines; the safety copy uses `MkdirTemp`

**Decided.** Extract, validate, swap and reopen can outlive the server's 60-second `WriteTimeout` on a large library, and a multi-gigabyte upload outlives the 30-second `ReadTimeout`, so both paths clear the relevant deadlines via `http.NewResponseController` — otherwise the work completes and the final JSON never reaches the client, which reads as a failed restore that actually succeeded. Separately, the `.pre-restore-<ts>` safety directory is created with `os.MkdirTemp` rather than a second-precision name. Second precision alone collides when two restores land in the same second — restore, then restore a different upload — and `os.Mkdir` would fail; worse, the name would alias this generation onto the previous one, so a rollback could grab the wrong directory. `MkdirTemp` guarantees a fresh name and the timestamp still makes it human-sortable. I approved both after reasoning about what the wrong outcome would look like, which in the second case is a rollback restoring the wrong data.

**Instead of.** Raising the global timeouts, which weakens every other route.

**Reversal.** The `MkdirTemp` change reversed an earlier fixed-name scheme.

<sub>1.4.1 — `internal/httpapi/backup_handlers.go`</sub>

### Two restore blocks with two confirmations became one control

**Decided.** Restoring the archive kept on the server and restoring a file from another server were two blocks with two warning paragraphs and two typed confirmations, for one operation whose only real variable is where the file is. It is one control with a source picker now, and — the part that matters — it resolves what the chosen archive is *keyed with* before prompting, so a passphrase-sealed archive is never met with a password field. `backupMetaAt` reads the header and reports `key` as `none`, `account` (with the account name) or `passphrase` so the UI can ask for the right thing first. The backup warnings became one line each, in the dialog you are standing in when they apply, rather than three red paragraphs above the buttons: the consequences have not been softened, only moved to where a warning is actually read. I approved the consolidation and the resolve-before-prompt ordering.

**Instead of.** Keeping the two blocks and prompting for both credentials.

**Reversal.** Yes, of the two-block layout.

<sub>1.4.1 — `internal/httpapi/backup_handlers.go`</sub>

### `rebindDB` repoints every auth store after an in-process swap

**Decided.** Restore closes the live database and reopens a different file. The session store was rebound as part of that; anything else holding the old `*sql.DB` kept it, so a restored box answered a valid credential with an inexplicable 401. The rebinding is now one function that covers every store — sessions and device tokens — called on the success path and on the rollback path both, and `Recover` and `Reset` carry the same warning in their doc comments because they swap the handle the same way. I approved centralising it rather than adding the missing line, because the class of bug is "someone added a store and did not know", and a single function is the only shape that makes the next one obvious.

**Instead of.** Rebinding each store at each call site.

**Reversal.** Yes, of the partial rebinding shipped in 1.0.x.

<sub>1.1.0 — `internal/httpapi/server.go` · `internal/httpapi/backup_handlers.go`</sub>

### Factory reset deletes the database file, not its rows

**Decided.** `Reset` closes the handle, removes `-wal`, `-shm` and then the main file, reopens and re-migrates an empty schema. Deletion is by *file* and not row by row, for a specific reason: a corrupt FTS index can block `DELETE` and `DROP`, because the sync triggers touch the bad index — and the whole point of a factory reset is a guaranteed-clean slate for someone whose database is already broken. A reset that can fail because the thing you are resetting is damaged is not a reset. `removeWithRetry` tolerates Windows briefly holding the handle after `Close`, and a failure to delete reopens the existing database so the server is not left handle-less. Everything goes — users, sessions, settings, preferences, all library content — so the app returns to first-run onboarding, and the warning says so. I approved the file-level deletion on the corrupt-index argument.

**Instead of.** `DELETE FROM` per table, which is the tidy answer and fails in exactly the case that matters.

<sub>0.4.6 — `internal/store/repair.go`</sub>

## 12. Shell, Navigation and Entry Points

The navigation shape is the single most re-litigated decision in the project, moving from bottom tabs to a drawer and back to both. The through-line is that a control belongs to the shell once, not to every screen that needs it.

### Mobile-first PWA shell with a bottom navigation bar

**Decided.** A comprehensive responsive redesign: a bottom navigation bar on small screens with the tabs moved down from the top, detail sheets for Library and Movies, and viewport-aware column counts.

**Why.** The app is built for a phone first, and tabs at the top of a phone screen are the furthest point from the thumb.

**Approved.** Mine, and I approved the whole pass as one release.

<sub>0.3.1 — `CHANGELOG.md`</sub>

### The bottom bar was removed outright in favour of the hamburger drawer

**Decided.** 0.4.0 moved primary navigation from the bottom tab bar into a ☰ drawer carrying nav, counts, account and log out, with a slim sticky top bar. The Settings "Start page" toggle was retired at the same time.

**Why.** Five tabs would not fit a 320px viewport, and the drawer holds an unbounded list. The start-page setting went because Home became the landing view and the drawer made every destination one gesture away.

**Reversal.** Partly wrong. Removing the bar took the four screens people actually use out of thumb reach to solve a problem only the fifth tab had.

**Approved.** Mine at the time.

<sub>0.4.0 — `CHANGELOG.md`</sub>

### The bottom bar returned as a four-icon float

**Decided.** Four thumb-reachable icons — Search, Home, Library, Catalogue — hovering clear of the bottom edge so the Android gesture pill keeps its own strip. It slides away as you read down the page and returns on the way back up. Reduced motion opts out of hiding entirely rather than snapping.

**Why.** An addition, not a replacement: the ☰ drawer still owns the utility tabs, ＋ Add and the account rows, so the bar carries only what a thumb reaches for constantly and the drawer carries everything. Reduced motion opts out of the *hiding*, not into a jump cut, because the accessible answer to an animation is stillness, not the same movement without frames.

**Reversal.** Of 0.4.0's removal.

**Approved.** My call, and I approved it as an addition specifically so the drawer would not have to shrink to justify it.

<sub>1.0.0 — `CHANGELOG.md`</sub>

### The phone bottom bar dropped Search and gained Quotes

**Decided.** Search left the four-icon bar; the Quotes tab took its place.

**Why.** The mobile top bar has carried ＋ · Search · ? · avatar since 1.4.1, so the bar held three content screens and a duplicate while the fourth content screen had nowhere to live. A control that exists in the shell on every screen does not need a second seat.

**Approved.** Mine, and I approved it as a consequence of 1.4.1 rather than a fresh judgement.

<sub>1.5.0 — `CHANGELOG.md`</sub>

### One "＋ Add" surface, consolidated over several releases

**Decided.** 0.4.3 made a single Add surface — book · film · import in one modal — replacing the standalone Import tab, and every entry point was folded into it afterwards: the mobile top-bar ＋ (0.6.8), a Capture quote segment (0.8.7), Capture becoming a tab that swaps in place with the Home capture tile removed (0.9.1), and the drawer's Capture row retired (0.9.3).

**Why.** One obvious way to add anything. An old `/import` link opens the same surface on the Import section rather than a second screen.

**Reversal.** 0.9.1 re-fragmented it while consolidating it: a ❝ capture pill was added beside ＋ Add in both top bars. 0.9.2 removed it one release later — it duplicated the Add surface's own Capture tab, which is the exact thing the consolidation existed to stop.

**Approved.** Mine throughout, including the pill I added and then took back out.

<sub>0.4.3 through 0.9.3 — `CHANGELOG.md`</sub>

### The Add surface knows where you are; the drawer's Add is the context-free twin

**Decided.** ＋ from the shell adds a book on Library, a film or show on the Catalogue, and a quote against whichever work you have open — with that work already filled in. The drawer's Add opens with nothing pre-filled. Search behaves the same way: scoped from the top bar, cleared from the drawer.

**Why.** You pressed ＋ on a book's page, so asking which book is asking a question you already answered. The context-free twin exists so there is always a way out of a scope you did not choose.

**Approved.** My call, and I approved shipping both rather than picking one — the pair is the decision.

<sub>1.4.1 — `CHANGELOG.md`</sub>

### Eleven page "?" buttons and a "＋" on every list became one shell set

**Decided.** ＋ Add · Search · ? · avatar, in that order, in the top bar, on a phone and on a desktop alike. Help became context-aware, resolved from the route; the eleven per-page `?` buttons went.

**Why.** 1.4.0 was right about what was needed and wrong about where it goes. A `?` drawn in eleven page headers is a property of eleven pages instead of one thing in one place, and on a phone it competed for the single row a page title also needs. A `＋` in the Library header sat inches from the top bar's own `＋`, and the book pages had a third add form of their own.

**Reversal.** Of 1.4.0, one release later.

**Approved.** Mine both times; I approved the correction as soon as the phone layout made the duplication obvious.

<sub>1.4.1 — `CHANGELOG.md`</sub>

### Detail screens reach help through the ⋯ menu

**Decided.** The two work-detail screens carry help as a row in their `⋯` menu rather than as a fifth control in the bar. The full-screen Profile page carries its own.

**Why.** That phone bar already holds a back arrow, a filter, a ＋ and a ⋯, and a fifth 44px control would have left a book title about eighty pixels to live in. The exceptions exist because the shell bar is not on screen there at all.

**Approved.** I approved the exception explicitly rather than letting it be an omission — a rule with an undocumented hole is a rule nobody can apply.

<sub>1.4.0 — `CHANGELOG.md`</sub>

### The nav collapses to icons by measuring real overflow, not a breakpoint

**Decided.** When a smaller desktop window would clip the labelled tabs behind the ＋ Add button, the nav collapses to icons and expands back once there is room — measured off the actual overflow.

**Why.** A breakpoint guesses; the content is what determines whether the labels fit, and it changes with the tab list. The measurement only fires because `.topbar-nav-group` holds its natural width with `flex: none` — before that, a tight window squeezed the toggles and sheared labels mid-glyph without ever tripping the collapse, so the mechanism existed and could not be reached.

**Approved.** Mine, and I approved the `flex: none` as part of the same decision — the measurement is worthless without it.

<sub>0.6.7, corrected in 0.6.9 — `CHANGELOG.md`</sub>

### The configurable desktop nav was shipped and then retired

**Decided.** 0.4.3 added a Settings › Interface toggle putting Tags and Metadata either on the navbar or behind a ⋯ More menu, stored as `navUtilities`. 0.6.7 retired the toggle and the preference: those two always sit in the top bar's utility group, and the mobile drawer moved Tags into its bottom utility group to match.

**Why.** Two supported layouts is two layouts to test, to explain in the help registry, and to keep the collapse measurement honest against. The value it bought was one row of horizontal space on a narrow desktop, which the overflow collapse now handles by itself.

**Reversal.** Of my own setting. What I got wrong is that "make it configurable" was a way of not deciding.

**Approved.** Mine both times, and I approved the removal as a simplification rather than a regression.

<sub>Added 0.4.3, retired 0.6.7 — `CHANGELOG.md`</sub>

### A reader can hide a whole section, and hiding takes away doors rather than data

**Decided.** Settings → Features switches the Library, the Catalogue and Quotes on and off per account. Switching one off removes its DOORS — its row in all four nav lists, its count tile on Home, the ＋'s offer of that kind, its scope chips on Search, and its row in the shortcut sheet — and changes nothing else. `parsePath` and `statePath` are not feature-aware, so the route still resolves, a bookmark still opens, a quote still links to the book it came from, the keyboard sequence still works, and the review deck still draws on the section. One section always has to stay: the switch is disabled with its reason in words, the server refuses the set with a 400, and `loadPrefs` corrects it on read.

**Why.** Not everybody keeps films, and not everybody keeps a quote that belongs to no book. A tab for something you have never used is a permanent invitation to an empty screen, and until now the strip, the drawer and the phone bar were the same eight destinations for everybody. The distinction that makes this safe is between a DOOR and a CONTENT LINK: a door is a control whose whole purpose is "go to this section", and a content link is the thread from a thing to its source. Muting the second would strand four thousand highlights to spare somebody a tab, so a favourite on Home still opens its book with the Library hidden — what it loses is the tile that only ever said "go to the Library".

**Instead of.** Two things. Deleting or disabling anything, which would make the switch a decision about the reader's library rather than about their screen — the promise "turn it back on and everything is where you left it" is the entire feature and it is only credible because the URL is untouched. And a fifth hand-maintained list of which rows are hidden: routes.js already carries four lists of the same tab keys and says out loud that the shape "only stays correct if something checks it", so there is one `visibleTabs` filter every consumer calls, and the test asserts the absence across all four lists at once rather than as four cases.

**Not a reversal of the retired `navUtilities` toggle above**, and the difference is worth stating because the objection recorded there is the right one to raise. That setting chose *where* two tabs lived, which is two layouts of the same app — two things to test, to describe, and to keep the collapse measurement honest against — in exchange for one row of horizontal space. This chooses *whether a section is yours at all*. It is the same layout with fewer destinations in it, the cost is one filter rather than a second arrangement, and what it buys is not space but not being shown a section you have never used. The sentence that entry ends on still holds: making something configurable is not a way of not deciding, and the decision here is that the sections themselves stay exactly as they are.

**Deliberately not gated by this: the review scope chips.** They name what the DECK draws from rather than where you can go, so hiding the Catalogue does not stop you being asked about a film line you saved. Narrowing somebody's schedule from a cosmetic switch would be the opposite of what this promises.

**Approved.** The owner's, asked for as an optional feature "not everyone needs"; the door/link split and the last-section rule are mine.

<sub>1.16.x — `web/frontend/src/routes.js` · `web/frontend/src/App.jsx` · `web/frontend/src/Settings.jsx` · `internal/httpapi/auth_handlers.go`</sub>

### Four hand-maintained navigation lists moved into routes.js

**Decided.** The desktop strip's content and utility halves, the phone's bottom bar and the drawer now live in `routes.js` beside the routing table, and are asserted against each other: every content tab reachable from the drawer and the bottom bar, no tab named twice, content and utility disjoint, every nav tab surviving `statePath → parsePath`, and every collapsing row carrying a hover label of five words or fewer.

**Why.** 1.5.0 updated three of the four. On a phone the Quotes tab existed, routed, held data and sat in the bottom bar, while the drawer — whose whole job is to list everything — did not mention it. Invisible on a desktop, which is where the screen was built.

**Approved.** My call after the bug, and I approved the cross-assertions rather than only moving the lists together.

<sub>1.5.1 — `CHANGELOG.md`</sub>

### Home is the landing view, and the stored start-page preference is ignored

**Decided.** Home is `/` on desktop and mobile, reached any time by tapping the logo. The 0.3.x `home` start-page key is retired; stale stored values and older clients still sending one are silently ignored.

**Why.** The Home screen replaced the landing-tab choice outright, so there is nothing left for the preference to select. Ignoring rather than rejecting means an older client does not start failing its preference writes.

**Approved.** Mine, and I approved the silent ignore over a validation error.

<sub>0.4.0 — `CHANGELOG.md` · `docs/PLAN.md`</sub>

### Home is one narrow reading column at every size, and capture is not on it

**Decided.** Date and greeting, the Daily Quiz card, the Practice card, two stat tiles and the most recent favourites, in one narrow column on every screen size. Quote capture is not here; it is the Capture tab of the ＋ Add surface.

**Why.** The ritual should read the same on a phone and a desktop — a wide Home would be a different screen at the same URL. Capture left because it belongs to the one Add surface, not because Home had no room for it.

**Approved.** My call, and I approved the single column as a deliberate refusal of the space rather than an unfinished layout.

<sub>0.4.0, capture removed 0.9.1 — `web/frontend/src/Home.jsx` · `CHANGELOG.md`</sub>

### Scroll memory holds exactly the last two list pages, LRU

**Decided.** Opening a detail or hopping tabs and coming back restores the list's scroll position. The memory holds the last two list pages, LRU; everything else starts fresh at the top.

**Why.** Two is what the actual gesture needs — you leave a list, look at one thing, come back. An unbounded memory restores a position from a session you no longer remember having, which reads as the page being broken.

**Approved.** Mine, and I approved the specific number rather than "keep them all".

<sub>0.6.8 — `CHANGELOG.md`</sub>

### Profile became one screen and the avatar chip opens it directly

**Decided.** The chip's dropdown — Profile, User management, Log out — is gone. The chip opens Profile, and everything the menu offered is a section of it, including the admin user list.

**Why.** "My account" was a menu of screens rather than a screen, and the drawer repeated the same three rows underneath it.

**Reversal.** Finished a release later than it looked. 1.5.2 found the phone drawer's avatar was a decorative `aria-hidden` span with a separate Profile row further up — so the phone had two account entries and the one that looked most like the account was inert. The footer renders the same `AccountChip` the bars use now.

**Approved.** Mine, and I approved the second half as a completion of the first rather than a new fix.

<sub>1.4.1, completed 1.5.2 — `CHANGELOG.md`</sub>

### Switching accounts is laid out as the sibling of the log-out beside it

**Decided.** The two ways out of an account share one row and one plan. The form names the account you are leaving, uses real labels rather than placeholders, and puts the reason a button is grey beside the button.

**Why.** They were built to different plans — a heading over a full-width button here, a right-aligned button there — for one kind of action. The account being left is the one fact the form is about and it was nowhere on it. The disabled reason lived only in a `title` attribute, which a touch screen has no way to show, so on a phone the button was grey and silent.

**Approved.** My call, and I approved the `title`-only pattern being treated as a bug wherever else it appears.

<sub>1.7.2 — `CHANGELOG.md`</sub>

### Preferences are a partial merge, not a full-state write

**Decided.** `PUT /auth/me/preferences` merges. Every caller goes through one shared full-state helper where a full-state PUT is genuinely needed.

**Why.** Each setting has to save without disturbing the others. The cost of getting it wrong is on record: the post-import review panel kept its *own* copy of the full-state PUT helper, and that copy omitted the three sticker fields the shared one carries for exactly this reason — so filling in a page number sent nulls for the sticker and its seal position and destroyed both. A duplicated full-state helper is a data-loss bug waiting for the next field.

**Approved.** Mine, and I approved deleting the duplicate rather than adding the three fields to it.

<sub>0.4.3, duplicate removed 1.1.1 — `CHANGELOG.md`</sub>

### A preference written from outside the preferences handler has to be a field in its struct

**Decided.** `defaultBoardId` is a field on the Go `prefs` struct — carried out by `loadPrefs` and written back by the marshal — even though nothing may set it over the wire and no client is offered a way to. Anything else that lands in that blob from outside `handleUpdatePreferences` follows the same rule.

**Why.** The handler ends in `json.Marshal(cur)` over the struct and one full-row `UPDATE`, so a key that is not a field there is a key the read drops and the write never restores. `defaultBoardId` is written by 0036's backfill and by `setDefaultBoard`, both with SQL `json_set`, and it was not a field — so every unrelated preferences save deleted it. Clicking an accent swatch unset the reader's default board; `defaultBoardID` then fell back to `ORDER BY pos, id LIMIT 1` and repointed, so the shelf they had chosen became their *first* shelf and the next quote captured outside a board was filed on the wrong one. The tolerance is what hid it: a dangling pointer would have shown up as an error, and a silently corrected one shows up as somebody else's filing mistake. 0036's own backfill produces the shape that reveals it, seeding Others at `pos` 2 with Proverbs at 0.

**Instead of.** Preserving unknown keys by merging the new set into the stored blob rather than marshalling the struct over it. That would have covered this key and every future one — but the struct's stated contract is that retired keys are *dropped* on read and on the next PUT (the pre-0.4 `home`, the pre-0.7 `navUtilities`, the pre-ladder `srGrow`/`srShrink`), and a merge keeps every retired key alive in storage forever. One field is the narrower fix and it leaves that contract intact.

**Approved.** Mine.

<sub>1.16.x — `internal/httpapi/auth_handlers.go` · `internal/httpapi/board_test.go`</sub>

### Viewport preferences are device-local; identity preferences ride the account

**Decided.** Button-label density and the two cover-size sliders live in `localStorage`, as do the share image's skin, backdrop and colour switches. Theme, accent, aesthetic and the review settings live in `users.preferences`.

**Why.** How much room a row has is a property of the monitor, not of the reader. A share-image skin is a property of the picture you are making on this device. Everything that is a statement about *you* follows you to the next browser.

**Approved.** My call, and I approved the split as a rule rather than deciding it per control.

<sub>1.6.0 — `CHANGELOG.md`</sub>

### The at-scale Metadata console is desktop-only, and the phone says so

**Decided.** On phones the Metadata tab is a maintenance screen — fetch covers and metadata, scan for duplicates, speaker remap, people fetch-missing — with the coverage tiles collapsed to plain text lines and no browsable list. The filterable console stays desktop-only, and the mobile header carries an info dot saying where the full console lives.

**Why.** A filterable table over a whole library is a desktop artefact, and shrinking it produces something that is neither. The info dot exists because a feature that is absent without explanation reads as missing rather than as elsewhere.

**Approved.** Mine, and I approved the note more than the omission.

<sub>0.4.4 — `CHANGELOG.md`</sub>

### The guided tour ships its own public-domain sample content

**Decided.** A *Pride and Prejudice* quote and a *Casablanca* line are built in as tour content. The tour never asks for your files.

**Why.** A tour that needs your library cannot run on first launch, which is the only moment it is for. Public domain because the samples ship in the binary. The admin steps show and ask for the TMDB / TheTVDB / Google Books keys with instructions on where each comes from, and the highlighted Metadata card stays usable so they can be pasted mid-tour.

**Approved.** I approved the sample content and the licence constraint on it together.

<sub>0.9.0 — `CHANGELOG.md`</sub>

### Dead code that duplicates a live screen is deleted, not left

**Decided.** `Settings.jsx` carried an unused second users list, with the same add and the same delete and none of the rules; it went. So did the avatar upload control the retired chip menu used and the `.user-menu-panel` rules positioning it.

**Why.** Dead code that duplicates a live screen reads as the implementation. The next person to change the rules — or the next model asked to — finds two candidates and no way to tell which one ships.

**Approved.** Mine, and I approved deletion as the standing answer rather than a comment marking it dead.

<sub>1.7.2, and 1.4.1 before it — `CHANGELOG.md`</sub>

### Serendipity is not the review loop, and must not touch its schedule

**Decided.** Shuffle and On this day live on Home and write nothing. `GET /shuffle` picks the KIND at random first and then a row within it; On this day matches on month-day, prefers `noted_at` over `created_at`, and excludes the current year.

**Why the kind comes first.** Drawing uniformly across every quote is honest about the proportions and useless as a way of rediscovering the smaller shelves: a library of four thousand highlights and forty film lines shows a film line once in a hundred shuffles. Kinds with nothing in them are dropped before the draw, so a library with no films is not a third of the way to showing nothing.

**Why nothing is written.** These draw the same quote card the deck does, and the `srSeen` multiplier exists precisely to lengthen a half-life when a quote is *seen*. Wiring that here would inflate a schedule through a surface meant for enjoying the library rather than working at it, in favour of whatever the random number generator liked, with nothing anywhere to report it. The test shuffles eleven times and counts the review rows either side.

**`noted_at` over `created_at`**, which the roadmap named both of without deciding. On an imported row `created_at` is the day of the *import* — the same day for thousands of quotes — and means nothing to a reader.

**Instead of.** Their own routes, which the plan specified and which is recorded there as a departure: a route bookmarks, and a card you press buys the same pleasure for none of the routing surface.

<sub>1.16.0 — `internal/httpapi/serendipity_handlers.go` · `web/frontend/src/Home.jsx`</sub>

### Eight planned items dropped, and the three findings worth keeping from them

**Decided.** After 1.16.0, roadmap §§1–3 (Quick wins, The review loop deepened, Search precision) are gone. Their remaining eight items are not being built, and three now-empty sections came out with them. `docs/plans/quick-wins.md`, `review-loop-cards.md` and `search-precision.md` were folded here and deleted, because the plans directory promises *this is not built yet* and a plan for something nobody intends to build fails that promise exactly as a shipped one does.

**Why the sections went rather than staying empty.** A heading that names a theme and lists nothing is a worse document than no heading: it reads as an oversight rather than a decision. Removing them renumbered everything below, and the §number is the disposable half of the pair by design — the id is durable and the number is positional — so the rail, the body and sixteen in-prose cross-references were rewritten off the ids.

**The three findings that outlived their plans**, each of which came out of a *What already exists* pass and each of which contradicts something the roadmap asserted:

1. **The recall sparkline could not have been built as described.** §2 promised "query-time work against columns that already exist" and the entry said the sparkline was "drawn from `item_reviews`". That table is `PRIMARY KEY (kind, item_id)` — one row per quote, every column a scalar. A sparkline is a series. It needs a review LOG: a new table, a retention policy for the first unbounded-growth table in the schema, a delete trigger per parent (0026's header explains why a missed one lets a reused rowid inherit a stranger's history), and a place in backup and restore. Pricing that as an afternoon is how it stayed unbuilt while looking cheap.

2. **Saved views was not a `(name, url)` row.** §1 claimed "the filter state is already serialised into the URL in full". It is not: `App.jsx` pushes the path only, and every filter, scope, chip, view mode and grouping lives in `localStorage` behind `usePersistedState`. The real first half was putting the filter state on the URL — worth doing on its own, and not a quick win.

3. **`locSortVal` is not reusable.** §3's neighbouring-highlights entry cited it as though it were; it runs in the browser, in `Library.jsx`, over a page of rows already fetched. Deciding two highlights are adjacent means ordering the whole book, which is server work — so it needs the same locator parser in Go, and one shared table of cases testing both, or the two disagree silently.

**What this says about the roadmap as a document.** Across 1.15.3 and 1.16.0, nineteen items left it: eleven because they had shipped and nobody removed them, and eight because they were dropped. Three of its assertions about the code turned out to be false, and all three were found by writing a plan against the tree rather than against the roadmap. `scripts/roadmap-data.mjs --check` cannot catch any of this — it validates the *generated* sections against `docs/data/*.json` and never reads the hand-written backlog, which is where every one of those items lived.

**Instead of.** Leaving them listed. A roadmap that names work nobody intends to do is the same failure as one that names work already finished: in both cases the page stops answering the only question it is for.

<sub>1.16.0 — `docs/roadmap.html` · `docs/plans/`</sub>

### A shortcut is not real until the button that shares its job says so

**Decided.** One table (`keys.js`) binds every key to an ACTION id, and `Tooltip` takes a `shortcut` prop that reads from it — so `<Tooltip label="Search" shortcut="search">` renders "Search · /". Bind a key and the control starts announcing it; change the key and the control changes with it.

**Why the registry rather than handlers per screen.** There was no global registry at all, which for a text app with a large library was the biggest single desktop gap. The alternative — a keydown handler on each screen — fails twice: a shortcut that works on one screen and silently does nothing on the next is worse than none, and bindings enforced in a dozen places will disagree with each other. There is one window listener, and it knows which key means which action and nothing about what an action does.

**Typing is never a shortcut**, and that single rule decides whether the feature is usable or infuriating. `n` is "capture a quote" and also the fourteenth letter of a note somebody is writing, so a key pressed inside an editable target is just a letter — and "editable" has to include `contenteditable`, not only `input`/`textarea`, or a rich-text field would eat its own content.

**Invariants the table is tested against:** no id twice, no key bound to two actions (which is a coin toss dressed as a feature), and no single key that is also the first key of a sequence — pressing it would have to fire immediately or wait to find out, and both are wrong. `?` and `/` are kept distinct because one is Shift-ed and the other is not; folding Shift in would open the help sheet when somebody meant to search.

**The review keys are the exception and belong to the card.** A grade only means something to the card in front of you, so `QuizRunner` owns `1`, `2` and `Space`, gated on the same conditions the buttons are — the key and the button can never disagree about whether a card is answerable.

**Instead of.** A key legend in the help sheet only, which is where shortcuts go to be forgotten.

**A binding's identity includes its CONTEXT.** A quiz shows one of three kinds of question and they want different answers, so `ctx` is part of what makes a binding unique: `1` is the first MCQ answer and `Forgot` on a flip card, and the two never share a screen. Binding `1` globally to "Forgot" would mean pressing it on a four-option question graded the card instead of answering it — a keystroke that silently marks the reader wrong. A context key may not shadow a global one, which is tested, because a global is live everywhere and the two would both fire.

**Practice asks for Shift and the Daily Quiz does not**, which is the one place this app deliberately makes a gesture harder. The decks show the same card with the same buttons and are not the same act: the daily deck IS the schedule and its grades are permanent. A reader running through Practice with the daily keys in their fingers should not be able to move a schedule by reflex, so the LOWER-stakes mode is the one that costs an extra finger — and a key with the wrong modifier does nothing rather than doing the right thing anyway, because a guard that can be ignored is not a guard. `eventCombo` reads `event.code` for digits so `Shift-1` is not `!` on one layout and something else on the next; it reads `key` for letters, because `code` names a physical position and would give a Dvorak reader the wrong action.

**The legends are generated, and nothing is listed that does not work.** `?` opens a sheet built from `groupedShortcuts()`, the drawer prints each destination's key on its own row, and the quiz's buttons carry theirs — all from the one table, because a legend maintained by hand is wrong by the second release. The first draft of that table also bound a command palette, `j`/`k`, `f`, `e` and `u` with no handler behind any of them; since the sheet and the tooltips both read it, an entry is a promise printed on a button, and those five would have been promises the app does not keep. A test now fails if an unwired action is added.

<sub>1.16.x — `web/frontend/src/keys.js` · `web/frontend/src/ui.jsx`</sub>

### A replace is previewed because its damage is the only kind you cannot see

**Decided.** Find-and-replace over a selection is two endpoints — `/replace/preview` writes nothing, `/replace/apply` writes everything — and takes literal text with optional case-matching and whole-word, never a regular expression.

**Why the split rather than a flag.** Every other bulk action in this app leaves evidence: a wrong tag is a tag you can see and remove, a wrong colour is a colour. A wrong replace has rewritten the words, and the words are the thing the app exists to keep. So the preview returns the before and after of every row it would touch, and the decision is made against what will happen rather than against a pattern somebody believes they understand. Two routes also mean a caller cannot reach the destructive one by getting a boolean wrong.

**No regular expressions**, and that is a decision rather than an unfinished feature: `.*` is one keystroke away from `.` and would empty every quote in the selection. Literal text covers the actual post-import complaints — a doubled space, a stray running head, a mangled quote mark — and cannot express "delete everything". Whole-word is implemented without a pattern for the same reason.

**An empty `find` is refused outright.** It matches at every position, so it would thread the replacement through every character of every quote in the selection — the most destructive thing the endpoint could be asked to do, and the easiest to ask for by accident by leaving a box blank.

**Unlike the bulk field editor, the quote's own words ARE replaceable here**, and the preview is what makes the difference legitimate: bulk-setting a quote replaces forty different sentences with one, while replacing "teh" with "the" leaves forty different sentences forty different sentences.

<sub>1.16.x — `internal/httpapi/replace_handlers.go`</sub>

## 13. Controls, Labels, Icons and Help

Two mechanisms for explaining a control both widened the page and neither worked on touch, so tooltips, info dots and per-screen help were rebuilt as one system with a five-word ceiling. The rule that came out of it is that a glyph is something you must already have learned.

### A pure-CSS hover bubble and a viewport-pinned long-press pill — two mechanisms, both of which widened the page

**Decided.** This is the state 1.4.1 replaced. Hover was an absolutely-positioned CSS bubble inside the tooltip wrapper; touch was a pill pinned to the top of the screen, centred with `left:50%` + `translateX(-50%)`.

**Why.** Both were wrong in the same way — neither could be kept inside the viewport. An `opacity:0` bubble still has a border box, so one hanging off a control near the right edge widened the page's scrollable area; the pill's centring cannot be clamped at all, so a label wider than the viewport hung off both edges. Between them, Library and Settings could be panned sideways into blank space on a phone, and iOS drags `position:fixed` overlays along with that pan. The pill was also detached from its control, so it answered "what is this?" without saying which "this" — and several 44px glyphs sit within a thumb's width of each other in these bars.

**Reversal.** Reversed in 1.4.1. What I got wrong was solving the same problem twice, badly, in two technologies, and then not testing either at a screen edge.

**Approved.** Both were my designs and the demolition was my call; I approved replacing them together rather than patching the pill, because the fault was shared.

<sub>1.4.1 (reversal) — `web/frontend/src/ui.jsx` · `CHANGELOG.md`</sub>

### One tooltip implementation: measured, clamped, anchored to its control, serving hover, keyboard focus and long press

**Decided.** One `HintBubble`, placed in script, anchored to the control's bounding box, clamped on both axes, with a `max-width: min(260px, calc(100vw - 16px))`. Hover, keyboard focus and long press all open the same bubble; only what opens and closes it differs.

**Why.** It is always wholly on screen and always attributable. One implementation means one set of clamping rules, so a fix on one input style is a fix on all of them. Placement needs the bubble's real size, which needs a paint, so the first frame renders hidden and `useLayoutEffect` measures and places it before the browser shows anything.

**Instead of.** CSS placement — impossible by construction: to know it is off screen a popup has to measure the viewport, and an absolutely-positioned element is placed against its offset parent, which knows nothing about where on the screen it ended up.

**Approved.** My call, and I approved moving placement into JS knowing it is the less fashionable answer; CSS anchor positioning would do it natively and is not yet safe to rely on.

<sub>1.4.1 — `web/frontend/src/ui.jsx` · `web/frontend/src/index.css`</sub>

### A closed tooltip must leave layout entirely, and nothing in the app is allowed to widen the page

**Decided.** A closed tooltip renders nothing — the bubble is portal-rendered only while a hint is showing, and `.tp-tip-wrap` owns only the inline box around the control. As a backstop, `html` carries `overflow-x: hidden` followed by `overflow-x: clip`.

**Why.** An invisible element with a border box is still layout. Nothing in this app relies on page-level horizontal scroll — wide tables and nav strips scroll inside their own contained wrappers — so `clip` is correct rather than merely defensive: it removes the horizontal scroll region outright, which mobile browsers honour more reliably than `hidden`.

**Approved.** I approved the belt-and-braces version. The structural fix is the one that matters, and the CSS backstop is there because this class of bug is invisible until someone drags a page sideways.

<sub>1.4.1 — `web/frontend/src/index.css` · `web/frontend/src/ui.jsx`</sub>

### Touch tooltips are a 500ms long press, and a fired press swallows the click behind it

**Decided.** `LONG_PRESS_MS = 500`, with `LONG_PRESS_SLOP = 10` px of drift allowed. A fired press calls `preventDefault` and `stopPropagation` on the click that follows. `onContextMenu` is suppressed on the wrapper.

**Why.** 500ms is the platform long-press convention, and the margin matters more than it looks: because a fired press swallows the click, a merely slow tap that crosses the threshold silently does nothing, and 500ms keeps that out of ordinary tapping. Swallowing the click is not optional — holding a Delete button to find out what it does must never also delete the thing, which is what Material does too. A drag is a scroll, not a question, so the timer is released the moment the finger leaves the control, or every flick down a list would flash a label. The box is read at *fire* time rather than press time, because the hold lasts half a second and a list can still be settling under the finger. Long-pressing on Android would otherwise raise the text-selection handles over the label just shown.

**Approved.** Mine, and the slow-tap cost is the trade I approved explicitly: it is a real regression for a small number of taps, bought against a class of accidental destruction.

<sub>1.4.1 — `web/frontend/src/ui.jsx`</sub>

### Keyboard focus opens a label only via `:focus-visible`, so a tap does not double up with the long-press path

**Decided.** `onFocus` opens the bubble only when `e.target.matches(':focus-visible')` is true, inside a `try` that degrades to silence on an engine without it.

**Why.** A tap also focuses. Without the check, a touch user gets the label from the long press *and* from the focus, and matching `:focus-visible` is what separates keyboard from pointer without guessing at the input device. On an engine that does not support it, staying quiet is the safe failure — a missing label is better than a stuck one.

**Instead of.** Sniffing the input device — rejected; `:focus-visible` is the browser's own answer to the same question and is better informed than any heuristic of mine.

**Approved.** I approved the silent fallback rather than defaulting to "show it anyway", on the principle that an unexplained control beats a control explaining itself at the wrong moment.

<sub>1.4.1 — `web/frontend/src/ui.jsx`</sub>

### The hint slot is its own slot with token-based closes, because a label and a toast can legitimately coexist

**Decided.** Hints have their own module-level sink, separate from `toast()`. Every open returns a token and every close names one; a stale close is ignored.

**Why.** Holding a button, reading its label, tapping it and getting its confirmation is an ordinary sequence, and both can legitimately be on screen at once — they must not fight over one message. The token exists because moving a mouse between two adjacent controls interleaves the second control's enter with the first's leave, and a blind close would race the new label off the screen. Returning the same state object rather than a copy when a close is stale lets React bail out of the re-render, which matters because closes arrive in pairs (`pointerleave`, then `blur`).

**Instead of.** A `variant` on the toast — rejected on the coexistence case.

**Approved.** My call. The token is three lines and it removes a whole class of flicker I would otherwise have chased with timeouts.

<sub>1.4.1 — `web/frontend/src/ui.jsx`</sub>

### Every label and confirmation is five words or fewer, with 1.2s and 1.5s dwell times that only work because the copy is short

**Decided.** `HINT_MS = 1200` for a control's own label on touch; `TOAST_MS = 1500` for a mutation confirmation, slightly longer because it is news. Every message in the app is five words or fewer, enforced at the call sites.

**Why.** The timers are only defensible because the copy is. A toast is not a document: five words is one glance, and a pill still sitting there several seconds after the glance reads as something you are expected to act on. The rule cuts the other way too — a bubble that needs a paragraph is an info dot, which is exactly what an info dot's own hover label now says instead of putting its whole paragraph in a bubble.

**Instead of.** Longer dwell times — rejected; the fix for "I could not read it" is shorter copy, not a slower toast.

**Approved.** Mine, and I approved the two constants and the word limit as one decision, because either alone is wrong.

<sub>1.4.1 — `web/frontend/src/ui.jsx` · `CHANGELOG.md`</sub>

### Standing explanatory prose moved into info dots, repeatedly, across four releases — label and state stay, explanation moves

**Decided.** The rule is a three-way split: a **label** (what this control is) and its **state** (what is true right now) stay on the page; an **explanation** (why it exists, what the trade-off is) moves into an info dot. Applied in 0.6.9 (Settings help), 1.4.0 (Settings' Devices, Metadata sources, Onboarding and Multi-author credits; the Metadata console's duplicates, speaker remap and mobile actions; Profile's maintenance tools; the Practice card; the tour's step copy), and again in 1.7.2 (each share format's syntax reference; the colour-categories microcopy).

**Why.** Tippani explained itself in standing prose — Settings card copy, drawer subtexts, microcopy under every control. It is good writing and there is a lot of it, and on a 390px screen it meant scrolling past the explanation to reach the single control each card exists for. On the tour specifically, six steps were a scrolling paragraph and the paragraph was the part people skipped.

**Approved.** Mine each time. Recording it as four passes rather than one is the honest version: I did not find the rule and apply it, I applied it to the worst screen and then kept finding more.

<sub>0.6.9 → 1.7.2 — `CHANGELOG.md`</sub>

### The help panel's copy had no budget, so it grew one reasonable sentence at a time

**Decided.** An entry is `{ term, icon?, what, how?, more?, asset? }`. `what` is one front-loaded sentence and `how` is up to three verb-first lines; both are **visible and capped by a test**. `more` is folded behind a `<details>` and is **deliberately not capped**. The panel gained a rail of screen sections with anchors, opening on the screen you pressed `?` from.

**The measurement, because "too much fluff" needed a number.** 157 entries, 49,738 characters, about 8,000 words. The median entry was 233 characters — perfectly fine — and the tail was not: 40 over 400, 8 over 800, the worst 1,911 characters and fifteen sentences. And the longest entries were the SHELL ones, which every screen's panel appends, so **the copy a reader met most often was the copy that read least.** After: 19,732 visible characters, mean 125, longest 200, with 28,831 characters folded rather than deleted.

**Why nothing noticed.** No test failed, no gate fired, and every individual addition was defensible — the entry on selecting several things is fifteen true sentences. Prose has no compiler, so the only instrument that works is a budget, and the budget has to be on what is VISIBLE rather than on what is written. Capping `more` would have turned "collapse it" into "delete it" by the back door.

**Front-loading is the whole formatting decision.** People scan rather than read, and the F-pattern NN/g documented is a warning about that rather than a layout to design for — so the first phrase of an entry is the answer, and anything that is not the answer is one click away instead of in front of it.

**The reader is not a beginner**, which the register test enforces: *simply*, *just*, *you can*, *in order to* and *press and hold* are refused in the visible half. Four of those are always deletable and the fifth explains how to operate a touch screen to somebody holding one.

**The split was mechanical and the rewrites were not.** 86 entries had their tail folded by a script that moves sentences and never edits one — the copy was already front-loaded, so the first sentence was already the answer. Only 8 needed writing by hand: three whose first sentence was itself over budget, and five carrying a banned word. Doing it the other way round — rewriting 157 entries from scratch — would have lost detail nobody was asking to lose.

**Assets, ranked by how they go stale.** A live-rendered control is first choice because it is not a picture of the app, it IS the app: the swatch row in the colour entries reads `var(--hl-N)`, so a reader who renamed or recoloured their categories sees theirs. A schematic SVG is second, because it states a relationship — the import queue is a gate — and a restyle cannot make a relationship wrong. Gesture clips are third and abstract for the same reason. **A screenshot is last and there are none**, because real pixels are the one class that silently shows last year's interface, which `AI.md` names as this repo's worst failure mode.

**Instead of.** A Help screen at its own route (help stops being beside the control), a task rail (the panel loses the one thing it knows for free — what screen you are on), a search box (it answers only when you already know the word for what you cannot find), and cutting the reasoning to the bone.

**Reversal.** Supplements the entry above rather than overturning it. Moving explanation off the page into a dot was right; what it did not come with was a limit on how long the explanation could then get.

**Approved.** The owner's, who asked for formatting and assets rather than only brevity — "the user should be able to easily scan the page to know where he needs to go, gets there with a click or a short scroll, and understands everything at a glance" — and who added, after the first pass, that the reader "is not a complete idiot".

<sub>2.0.1 — `web/frontend/src/help.jsx` · `web/frontend/src/ui.jsx` · `web/frontend/src/gestures.jsx` · `web/frontend/test/pure/help-budget.test.js`</sub>

### A gesture is drawn, and the drawing is abstract so it cannot go stale

**Decided.** `gestures.jsx` holds eleven clips as inline animated SVG. `IMPLEMENTED` is the two the app binds — the 500ms long press and the drawer's leftward swipe — and a test fails if the interface references any other.

**Why not a GIF**, which is what was asked for and what this is visually indistinguishable from: 1–2 KB instead of 10–30 and it lives in a diff; one file rather than one per theme, because every stroke is `currentColor`; and **it can stop.** A playing GIF ignores `prefers-reduced-motion` entirely. Go's `image/gif` would have produced real GIFs with no new dependency and was declined on those three grounds.

**The still frame is set explicitly, not left to `animation: none`.** The travel keyframe starts *and* ends at `opacity: 0`, so simply stopping it would have rendered every swipe invisible. With motion off each clip holds the pose that states the gesture: the ring at full size, the tip at the END of its trail beside the dashed line it travelled.

**Why the art is abstract** — a disc for the fingertip, a trail for the travel, a ring for the wait — rather than a screenshot with a hand over it: an abstract clip is not tied to the interface, so a restyle cannot make it wrong and one clip serves every context that gesture ever appears in. That is what lets this be a fixed library rather than a maintenance surface.

**Nine clips are unreachable on purpose.** There is no pinch handler anywhere and swipe-to-open is deliberately absent, because the left screen edge belongs to the OS back gesture. The nine exist so a newly bound gesture is a one-line reference rather than a new asset pipeline — and a test reads the tree, not this paragraph, so the day a pinch lands it fails and asks for the clip to be promoted.

**Approved.** The owner's, including the argument for it: an abstract gesture clip "never gets stale, and can be reused in different contexts". The eleven-not-two call is theirs too.

<sub>2.0.1 — `web/frontend/src/gestures.jsx` · `web/frontend/src/index.css`</sub>

### An info dot opens an anchored popover on a pointer and a centred card on a phone, and carries no hover label of its own

**Decided.** On a pointer, hover opens it and moving away closes it; a *click* pins it until clicked again, Escape, or a click outside. On touch, tap toggles and every touch-opened popover behaves as pinned. On a pointer it is anchored to the dot with a caret; on a phone it is a compact centred card. The dot carries no tooltip.

**Why.** An explanation should cost a glance, not a click and a dismissal — but text you want to re-read or copy must not evaporate when the mouse drifts, hence the pin. Anchoring matters on a pointer because several dots often sit within a few pixels of each other, so "which one was that" is a real question; on a phone a 40px anchor on a 360px screen gives no useful direction and the finger is already covering it. The dot had a tooltip — "About ISBN" — and on a phone that was two mechanisms answering the same question: hold the dot to be told it explains the ISBN, tap it to be told what an ISBN is. The first is a label for a control whose entire content is a label.

**Instead of.** A full-screen sheet for one sentence — rejected; that shape is right for a screen's whole glossary and absurd for a sentence.

**Reversal.** The tooltip on the dot was mine, and removing it was mine. What I got wrong was applying the "every glyph-only control needs a label" sweep to the one control that is nothing but a label.

**Approved.** I approved the removal after watching it confuse people, which is the only reason I noticed the category error.

<sub>1.4.2 — `web/frontend/src/ui.jsx` · `CHANGELOG.md`</sub>

### Hover affordances do not exist on touch, which is the counterweight to every info-dot compaction

**Decided.** Two things had to be built before "move it into an info dot" was honest on a phone at all: the info dot had to work without hover, and the tooltip had to work without a pointer. Both were, and the second turned into a sweep — 69 controls that had only an `aria-label` or a native `title=` now say what they are.

**Why.** An info dot was a hover bubble, and there is no hover on a phone, which quietly made the whole decluttering strategy a non-answer on the device this app is built for. Moving prose behind an affordance nobody can reach is not compaction, it is deletion.

**Approved.** My call, and I approved building the two mechanisms *first* rather than shipping the compaction and fixing the affordances after — which was the tempting order, and would have left the phone worse for a release.

<sub>1.4.0 — `CHANGELOG.md`</sub>

### Per-screen help lives in one registry keyed by screen, and describes the shell that is actually on screen

**Decided.** A `?` in the top bar opens the current screen's own glossary — every control named, with what it does. The copy lives in one registry, `web/frontend/src/help.jsx`, keyed by screen, rather than beside each component. Each screen's list appends the shell's controls, and there are **two** shell lists: `SHELL_COMMON` plus `SHELL_TOUCH` (the ☰ drawer, the floating bottom bar, the long press) or `SHELL_POINTER` (the tab strip, hover labels), picked by the same breakpoint the components render against.

**Why.** One file rather than scattered copy means a control explained in one place cannot contradict itself in another, and adding a control while forgetting its help is a visible gap. The two shell lists exist because the two shells are not the same shell — describing the drawer to someone who cannot see one is worse than saying nothing, because they go looking for it.

**Instead of.** Help beside each component — rejected; it is how the same control acquires two explanations.

**Reversal.** 1.4.0 put a `?` in eleven page headers, and 1.4.1 moved it into the top bar and made it resolve from the route. What I got wrong was making a property of eleven pages out of one thing that belongs in one place — and on a phone it was competing for the single row a page title also needs. Two exceptions remain, both because the shell bar is not on screen there: the work-detail screens keep it in their `⋯` menu, and the full-screen Profile page carries its own.

**Approved.** Mine both times; I approved the move once the phone made the row contention obvious.

<sub>1.4.0, relocated 1.4.1 — `web/frontend/src/help.jsx` · `CHANGELOG.md`</sub>

### Settings → Reference was removed; the per-screen `?` replaces the glossary link and the roadmap link moved to Updates

**Decided.** The Reference card's two link-outs were the UI glossary and the roadmap. The card is gone from Settings and from the demo.

**Why.** The per-screen `?` does what the glossary link was for, and better: help that sits beside the control, cannot 404, and cannot lag the code by a release. The roadmap link survives in the Updates card, where "what version am I on" and "what is coming" are the same question asked twice. The glossary itself is still published and still linked from the README and the roadmap — it was the *link from Settings* that stopped earning its place, not the document.

**Approved.** I approved deleting a card I had built two releases earlier, once the thing that replaced it was demonstrably better rather than merely newer.

<sub>1.4.0 — `CHANGELOG.md` · `web/frontend/src/Settings.jsx`</sub>

### Button labels are a device-local setting with auto/on/off, and collapsed words are clipped so they stay in the accessibility tree

**Decided.** A button carrying an `icon` renders `.btn-icon` + `.btn-label`, and `html[data-labels="off"]` clips the label span. The preference is `auto` | `on` | `off`, stored in `localStorage` under `tippani:labels`; `auto` resolves against the 768px mobile breakpoint. `theme.js` resolves auto→on/off and writes the concrete value, so `index.css` needs one clip rule rather than one plus a duplicate inside a media query.

**Why.** The words are clipped rather than `display:none`d, so they stay in the accessibility tree — an icon-only row still reads as "Share, Edit, Delete" to a screen reader instead of three unnamed buttons, and no `aria-label` has to be bolted on and then kept in sync with the visible text. The override works in both directions because both are real: a dense desktop user wants the row back, and someone who has not learned the glyphs yet wants the words on a phone more than they want the space. It belongs to the screen rather than to the account — how much room a row has is a property of the monitor, not the reader — and it is deliberately not folded into `applyTheme`, because Settings' Appearance card re-sends every theme field on any change and a label preference riding along would be wiped by an unrelated accent click.

**Instead of.** Storing it as a user preference on the server — rejected on the monitor argument.

**Approved.** Mine, and I approved resolving `auto` in JS rather than CSS specifically to avoid a duplicated clip recipe, which is the kind of thing that gets edited in one place only.

<sub>1.6.0 — `web/frontend/src/theme.js` · `web/frontend/src/index.css` · `web/frontend/src/ui.jsx` · `CHANGELOG.md`</sub>

### `keepLabel`: primary submits and destructive confirms never collapse, and `has-btn-icon` marks only buttons whose words may disappear

**Decided.** `keepLabel` opts a button out of the collapse and renders `.btn-label-fixed`, which has no clip rule at all. Crucially, `has-btn-icon` is set only when a button has an icon **and** is not `keepLabel`.

**Why.** A glyph is a thing you learn, and neither "save this" nor "delete this permanently" is something a person should have to have learned already. A `keepLabel` button may still take an icon — the glyph helps you find it, the words say what it does. The `has-btn-icon` condition is the subtle half: that class is what squares the button to 44px under `data-labels="off"`, so a `keepLabel` button carrying it would be crushed to icon width with its words still inside.

**Approved.** My call, and I approved the note about which condition sets `has-btn-icon` being written into the component, because "has an icon" and "may lose its words" read as the same predicate and are not.

<sub>1.6.0 — `web/frontend/src/ui.jsx` · `web/frontend/src/index.css`</sub>

### A repeated action is a glyph; a one-off keeps its words — ending 'share edit delete' on desktop and 'del' in a table

**Decided.** An action appearing once per row or once per card becomes a glyph. An action appearing once on a screen keeps its words, and primary submits and destructive confirms keep them at every width.

**Why.** A repeated action is something you learn on the first hover and never read again. The tells that this was inconsistent rather than considered: `QuoteActions` drew icons on a phone and the words *share edit delete* on a desktop — the only place in the app where one control named its actions differently depending on the width of the window — and the tables drew the same three actions again as *share edit **del***, one action with two names, four files apart, because somebody once needed the column narrower. The Metadata console's rows read *Close · Close · Open* whenever both panels were open, which names neither thing being closed; they are latched glyphs now, saying it where a toggle should.

**Approved.** Mine, and `del` is the detail I approved recording, because it is the smallest possible evidence that nobody was applying a rule.

**Reversal.** The rule stands; the fix described here did not go far enough. Making both breakpoints draw *glyphs* left them drawing glyphs in different **places** — three inline on a desktop, one ⋯ on a phone. 1.7.9 collapsed that too: see "A card's row is ♥ · copy · share · colour, then a ⋯ holding edit and delete" in §14.

<sub>1.6.0 — `CHANGELOG.md`</sub>

### One glyph per meaning at one stroke weight, with the nav's private icon set deleted and duplicates caught by geometry comparison

**Decided.** One icon set, one stroke weight (1.85). Four icons in the set turned out to be other icons and were redrawn.

**Why.** The duplicates were found by comparing the drawings, not the names. `IconShare` and `IconUpload` were both a tray with an arrow in it, differing by about a pixel and a half of arrow — and they appear in the same rows, since a quote card offers share and the tag manager offers upload. `IconExport` and `IconMetadata` were the same three strokes at coordinates half a unit apart, sitting two buttons apart on the Metadata console, one pulling data in and one pushing it out. Meanwhile the nav carried its own copy of the set at 2.0 instead of 1.85, so the app drew a magnifier, an open book and a tray-download twice each — and the Library tab was the identical open book the "currently reading" cover badge wears, on screens that show both at once. Share is the node graph now, which is the universally-learned mark and shares no geometry with a tray; Metadata is an arrow landing *inside* a record card, because the arrow now has somewhere to arrive; Library is spines on a shelf.

**Reversal.** Reversed. The nav's private set was mine and it was a straightforward duplication I never went back to consolidate.

**Approved.** My call to delete it and redraw the four, and I approved the geometry test as the standard: the one thing a glyph has to do is be told apart at 24px without reading a label.

<sub>1.6.0 — `CHANGELOG.md` · `web/frontend/src/ui.jsx`</sub>

### The icon vocabulary was drawn from a counted button inventory, not from the plan's guess of twenty-six

**Decided.** Every glyph in the set has at least one call site in the sweep that introduced it. The list was built by counting what the tree actually had.

**Why.** The plan for the release guessed at twenty-six icons; the tree held nineteen distinct `GhostButton` labels in total, most of them one-off. Counting first is why the list is short — a vocabulary drawn from a wishlist is a set of glyphs with no meanings attached, which is worse than words.

**Reversal.** The guess was mine and it was wrong by roughly a third. What I got wrong was estimating the surface instead of measuring it, on a codebase sitting right there.

**Approved.** I approved throwing the estimate away and working from the inventory, and approved recording the discrepancy rather than quietly shipping nineteen.

<sub>1.6.0 — `web/frontend/src/ui.jsx`</sub>

### Two icon-button sizes only, and `IconButton` renders its own tooltip from its `ariaLabel` rather than being wrapped at forty call sites

**Decided.** 44px (`IconButton`, the standard) and 34px (`.field-icon-btn`, for controls inside a form row). `IconButton` wraps itself in a `Tooltip` whose label defaults to its own `ariaLabel`; pass `tooltip` to differ, or `tooltip={null}` for the rare button whose label is already visible beside it.

**Why.** A button with no words has to say what it is on every device, and threading a wrapper through forty call sites is how half of them end up without one. `ariaLabel` and the tooltip should say the same thing anyway, so defaulting one to the other removes a pair of strings that can drift. The `danger` prop exists for the same class of reason: Library and Movies were each reaching past the component with an inline style to recolour the delete button, and since `style` arrives in `...rest` and lands after the component's own, a caller doing that had to restate all four sizing properties or lose the 44px box — `style` is merged now, so a partial override is a partial override.

**Instead of.** Wrapping at the call sites — rejected on the drift argument, with the evidence being that it had already happened.

**Approved.** Mine, and I approved defaulting the tooltip to the aria-label rather than requiring both, because a required duplicate string is a duplicate string that goes stale.

<sub>1.4.0 — `web/frontend/src/ui.jsx` · `CHANGELOG.md`</sub>

### Tab-strip tooltips are driven from inside the `Toggle`, because a wrapper would reset every `offsetLeft` the thumb is positioned from

**Decided.** A third element in a `Toggle` option tuple is its hover label, opened by calling `showHint` directly from the option button's `onPointerEnter` rather than by wrapping each button in a `<Tooltip>`.

**Why.** The sliding thumb is positioned from each option's `offsetLeft`, and `.tp-tip-wrap` is `position: relative` — so a wrapper would reset every offset to roughly 0 and park the thumb under the first tab forever. Since 1.4.1 the bubble is script-driven, so it can be asked for directly with no DOM at all, which is what makes the exception cheap rather than a second implementation. Clicking also closes the label, because it describes where you were about to go and would otherwise hang over the screen you have arrived at.

**Instead of.** Wrapping the options — tried in effect, and it breaks the thumb.

**Approved.** My call, and the script-driven bubble is what earned the approval: an exception that costs one call is acceptable where an exception that costs a parallel mechanism is not.

<sub>1.4.1 — `web/frontend/src/ui.jsx`</sub>

### Five ways to dismiss a window became two: a × over content, a back arrow out of a full-screen sheet

**Decided.** A window over the screen closes with a ×. A full-screen sheet, which *is* the screen, goes back with an arrow.

**Why.** There were five: a literal multiplication sign at font-size 24 in three modals, a hand-rolled cross at a different stroke weight in the lightbox, a *Close* ghost button in four dialog headers, a *Done* ghost button in the share dialog's footer doing the identical job as the *Close* in its own header, and a back arrow in the mobile sheet. Nothing was wrong with any one of them. What was wrong was that dismissing a window meant finding whichever one *this* window used.

**Reversal.** All five were mine, accumulated one dialog at a time. What I got wrong was never asking, while adding the fourth, what the first three did.

**Approved.** I approved the consolidation and the two-way rule, and approved recording that no individual instance was a mistake — the defect was the set, which is why nothing flagged it.

<sub>1.6.0 — `CHANGELOG.md`</sub>

### Word buttons become glyphs only where the glyph is unambiguous

**Decided.** Export, the cover controls, lookup matches, the duplicate scan, the bulk bar's Clear, the filter sheet's Reset and the tour's Back become glyphs; buttons whose visible words are their label are deliberately left alone.

**Why.** A tooltip repeating a word is noise. The rule is stated as a boundary rather than a blanket conversion, which is what stops the sweep from continuing into controls where it costs comprehension.

**Approved.** Mine, and I approved stating it as a boundary in the changelog itself — a sweep with no stated stopping point is a sweep that keeps going.

<sub>1.4.0 — `CHANGELOG.md`</sub>

### One colour per meaning: correct is green, not the accent, and identity never rides on colour alone

**Decided.** A correct quiz answer shows `--ok` green rather than the terracotta accent. Where two series share a plot, they are separated by lightness as well as hue — quotes take `--accent`, works take `--soft`.

**Why.** The accent read the same as the red for a wrong pick, so the one distinction the control existed to make was the one it could not make. And `--soft` was chosen over the old `--line` fill because it separates from the accent by lightness as well as hue, so it survives being printed, dimmed, or seen by an eye that does not sort red from green — `--line` is the hairline colour and all but vanished against the card. The legend swatch and the plot inherit one colour from the stack, so they are the same rule and cannot drift apart.

**Reversal.** The quiz colours were mine and wrong; using the brand accent for "correct" is the obvious thing to reach for and it collides with the error colour.

**Approved.** I approved both fixes, and approved the general rule they imply: a colour that carries meaning has to be told apart from the colour next to it by something more than hue.

<sub>0.4.2, reinforced later — `CHANGELOG.md` · `web/frontend/src/index.css`</sub>

### Metadata source marks are 16px category glyphs, not brand logos or text pills

**Decided.** `SOURCE_META` maps a slug to a name and a hand-drawn glyph; the real supplier name rides the tooltip and the aria-label.

**Why.** The row used to show a 'GOOGLE BOOKS' text pill, which on a phone cost ~90px of a ~256px row and truncated the title to nothing. Category glyphs match the hand-drawn stroke set and need no licensing, and nothing is lost to a pointer or a screen reader because the name is in the label.

**Instead of.** Brand logos (licensing, and off-style). Text pills (the reversed decision).

**Approved.** My call, and I approved the slugs mirroring the Go side exactly — `google` | `openlibrary` | `amazon` for books, `tmdb` | `tvdb` for films — so the mapping has one spelling across the wire.

<sub>1.0.0 — `web/frontend/src/ui.jsx` · `CHANGELOG.md`</sub>

### Colour pickers and breakdowns read the reader's own category names, not the storage colour word

**Decided.** `categoryName(token)` returns the reader's name for a slot if they gave one, else the built-in name for that slot, else the colour word. Slot 1 returns "Uncategorised" rather than "Yellow". Every picker, tooltip, aria-label and breakdown resolves through it.

**Why.** "Pick blue" is a description of a highlighter, and the whole point of naming a category is that the picker then asks the question you actually have. Slot 1 is the unset default that a quote lands on when nobody chose, so calling it "Yellow" invites you to read it as one deliberate category among the others, which it is not — saying it is the absence of a choice is the honest answer. What is *stored* never changes: the value in the database and in every Markdown export stays the colour word, so the naming is a display layer and nothing more. A hidden slot is dropped from the choices but never from a quote already wearing it — hiding is about tidying a picker you have stopped using, and a quote silently changing colour because of a preference would be the app editing your library.

**Approved.** Mine, and the slot-1 rule is the one I approved most deliberately: it is the difference between a default and a category.

<sub>post-1.4.0 — `web/frontend/src/theme.js` · `web/frontend/src/ui.jsx` · `README.md`</sub>

### Save stays greyed until it would work, and says which field is missing

**Decided.** Applied everywhere — capture form, both manual-entry forms, both quote forms, the bulk-edit bar, the speaker remap, add user, change password, the login screen.

**Why.** A greyed control that will not say why is worse than one that is not there: it signals that something is possible while withholding what.

**Approved.** Mine, and I approved applying it to the full list in one pass rather than to whichever form prompted it, because the value is in the consistency.

<sub>1.4.1 — `CHANGELOG.md`</sub>

### Greetings use fixed-date festivals only, resolved on the device, with no user-extension escape hatch

**Decided.** A date earns a place only if it falls on the same Gregorian month and day every year forever, or can be computed exactly from a stated rule (Easter's computus; "the fourth Thursday in November"). Nothing lunar, lunisolar, moon-sighted or decreed annually — no Diwali, Holi, Eid, Lunar New Year, Vesak or Rosh Hashanah. Everything resolves from the device's own clock, date and IANA zone; nothing is asked of the server and there is no network call.

**Why.** Moving festivals differ by year and several differ by country within the same year, so a table of them written from memory would be confidently wrong, and a wrong festival greeting is worse than no greeting. The list was then adversarially re-checked, which turned up: days anchored to a living monarch move on succession (the Netherlands' King's Day has been 31 Aug, 30 Apr and 27 Apr; Thailand's moved from 5 Dec to 28 Jul), England's St George's Day is transferred around Easter and no IANA zone can express "England" anyway, and Africa/Addis_Ababa is a tzdb *Link* to Africa/Nairobi so a canonicalising platform reports Ethiopian devices as Kenyan — Ethiopia is absent rather than mislabelled. Fixed national days that commemorate the dead carry a "Marking …" line instead of "Happy", and Taiwan's 228 and Rizal Day were dropped entirely for the same reason.

**Instead of.** A user-extensible list — refused explicitly. An empty "add your own dates here" is an invitation to break the rule later.

**Approved.** My call throughout, and refusing the escape hatch is the part I approved hardest: it is the polite-looking option that quietly makes the rule optional.

<sub>post-1.4.0 — `web/frontend/src/greetings.js`</sub>

### An actionable toast lives longer, and there is only ever one action

**Decided.** `toast(msg, {label, onClick})` renders one action beside the message and extends the pill's life from 1.5s to 6s. There is no two-action form.

**Why.** 1.5 seconds is one glance, which is right for news and useless for an offer: an Undo nobody can reach is decoration. Six is about how long it takes to read "deleted · Undo", decide, and move a hand — and the offer does not really expire when the pill goes, because the bin holds the thing for thirty days. The pill is the shortcut, not the safety net.

One action, because a toast is a glance and a choice is a dialog. Two buttons in a pill that vanishes is a decision under a timer.

`.toast` keeps `pointer-events: none` — it floats over the bottom of the screen where a tap belongs to the page underneath — so the action turns them back on for its own box only. That is the smallest hole that can be cut in it, and it is the kind of thing only a human tapping the button would find, so it is asserted against the stylesheet.

**Instead of** a persistent snackbar with a dismiss, which is a second thing to close, and instead of no shortcut at all: Settings → The bin is two screens away from the mistake.

**Approved.** Mine.

<sub>1.8.0 — `web/frontend/src/ui.jsx` · `web/frontend/src/undo.jsx` · `web/frontend/src/index.css` · `web/frontend/test/dom/undo-toast.test.jsx`</sub>

### Two icon sizes, two rules: 44px can be named, 34px cannot

**Decided.** `FieldIconButton` is a component in `ui.jsx` and all 46 hand-written `field-icon-btn` sites move onto it. It has **no `label` prop**, deliberately. `IconButton` gains `ok` alongside `danger`. A test asserts exactly one `<button>` in the SPA wears the class, and names the single non-button that does. This closes the "213 raw `<button>` elements" gap 1.13.0 recorded as not done.

**What the audit actually found.** 216 raw `<button>` elements, and they are not 216 decisions:

| | count | what it is |
|---|---:|---|
| already render words | 125 | text buttons — their name is always on screen; the preference has nothing to do |
| the 34px field icon button | 46 | ONE control, hand-written 46 times across 13 files |
| surfaces you click | ~41 | chart cells, colour swatches, covers, chips, the drawer scrim, nav glyphs, a token's ✕ |
| nameless by design | 4 | ✕ and ⋯, settled in 1.13.1 |

The middle row is the whole finding. The other three are correct as they stand and are not deferred work: a text button's words are its name and cannot be hidden; a swatch, a cover and a chart cell are surfaces rather than named controls, and giving them words would be inventing labels for things nobody calls by name.

**And the 46 were not sloppy, which is the part worth recording.** The audit went looking for drift. All 46 carried an `aria-label`, all 46 were wrapped in a `Tooltip`, four variants were spelled consistently, and exactly ONE site had diverged — `Home.jsx` was missing `tactile`, so one button in the app did not press when you pushed it. Copy-paste held for 46 uses across 13 files, which is a better result than the count suggests and is not an argument for leaving it alone.

**A CLASS STRING CANNOT MAKE A DECISION.** That is the reason, and it is not about drift. `IconButton` gained an opt-in `label` in 1.13.0 so the 44px family could honour Button labels. The 34px family could not opt into anything, because there was no place to put the opting. Forty-six controls sat outside a preference that claims to govern the app — not by a decision, but by never having been asked. The question could not even be *raised* against a string.

**Asked, the answer is that this size is nameless.** 34px exists precisely because it sits in a row that has already spent its width: a text input with a ✓ and a ✕ after it, a cover's control cluster, a card action row that already wraps at six colour dots. A word beside the glyph is the one thing there is no room for — it is *why* the second size exists. Adding labels here would collapse the distinction between the two families rather than complete it, and the row would break at the first one.

So: **44px can be named and opts in with `label`; 34px is nameless by construction, and its name lives in the tooltip and the accessible name, both of which the component now guarantees rather than each caller remembering.** The no-label test is the rule rather than a description of the markup, so adding a label to this size later is an argument somebody has to make.

**Two adjacent findings, fixed by arriving.** The drifted `tactile` is supplied by the component. And `IconButton` had a `danger` and no `ok`, so the Add sheet's ✓ wore `.field-icon-btn-ok` — the *other* family's colour class — to go green. One family reaching into another's stylesheet for a colour is exactly how two families stop being distinguishable, which is the complaint that started this work; `.tp-btn-ok` exists now.

**The measure of what the primitive absorbed** is that three files lose their `Tooltip` import outright. The wrapper was being threaded through by hand at every one of those sites, and "threading a wrapper through forty call sites is how half of them end up without one" was already written in `IconButton`'s own comment — about a risk that had not yet materialised here.

**Instead of.** Labelling the 46 (the rows break, and it would answer a question nobody asked with the wrong answer). Adding a `size` prop to `IconButton` (one component with two contradictory rules about naming, which is where the confusion would move to). Leaving it as a string and adding a lint rule (a rule can enforce a spelling; it cannot hold a decision).

**Approved.** The reader's, in the form "named in the commit: 213 raw `<button>` elements — a decision per call site, not a sweep. start at once."

<sub>1.14.0 — `web/frontend/src/ui.jsx` · `web/frontend/src/index.css` · `web/frontend/test/dom/field-icon-button.test.jsx` · `docs/ui-glossary.html`</sub>

### The Onboarding card lists nothing; a section picker replays one step, and the index comes from the unfiltered list

**Decided.** Settings → Onboarding is two buttons. **Replay the tour** (or Resume, or Start) starts at step 0 or at the parked step, and now wears a flag glyph with `keepLabel`, because that button carries the step count when it is a Resume. **Refresh one section** opens a picker of every named step, with its blurb, and choosing one starts the tour there.

**Why the list went.** The card had tried twice to be a table of contents. It began as a dozen two-line rows, which pushed the start button off a phone screen; the blurbs went behind info dots, which left a dozen names each trailing a dot. Either shape is a list you cannot press, sitting above the one button that does anything, answering "is this covered?" — and nobody opens Settings → Onboarding to ask that. They open it having forgotten how one screen works, and the old card had no answer for them short of sitting through the whole tour again.

**So the same list becomes the picker.** Same source — `tourFeatures`, so it still cannot drift from the tour it describes — and the blurbs come back as blurbs, because a dialog has the room the card did not. The difference is that a name now *does* something.

**`tourFeatures` carries `at`, and that is the load-bearing part.** The tour is started by index, and `tourFeatures` is `tourSteps` FILTERED: `welcome` and `done` have no name and drop out, and two more steps drop out for a non-admin. So the nth feature is not the nth step, and the gap widens down the list. The failure that would cause is the quiet kind — every index is a valid step, so a picker built on the filtered list opens a real screen with real copy, just not the one asked for, and nothing errors. `at` is taken before the filter and asserted against `tourSteps` at both admin levels.

**Instead of** a per-screen "show me this again" button on every screen. That is a control on twelve screens to serve a need that arises on one visit in fifty, and the tour already knows how to navigate itself.

**Approved.** The owner's: "Onboarding does not need the list of pages with infodots. all it needs is a replay button (already there, needs a glyph), and another button (with glyph) to open a popup where the user can specify the section for which they want the refresher."

<sub>1.15.2 — `web/frontend/src/Settings.jsx` · `web/frontend/src/tour.jsx` · `web/frontend/test/dom/onboarding-card.test.jsx` · `web/frontend/test/pure/tour-sections.test.js`</sub>

### A setting names the reader's own screens, not the media on them

**Decided.** The Review covers chips read **Library**, **Catalogue** and **Quotes** — the names on the nav strip — where they read Books, Films & shows and Quotes. The stored keys (`books`, `movies`, `quotes`) are untouched.

**Why.** Two of the three named the medium instead of the board, and the nav strip is two inches away saying something else. A setting that renames the reader's own screens makes them do the translation, on a screen whose whole job is to be unambiguous. "Films & shows" had also gone quietly wrong in 1.15.1: the Catalogue holds games now, and a game's lines have always joined the deck through that chip, so the label was undercounting what turning it off would do.

**The keys stay because they are a wire format.** `srReviewScope` is parsed on both sides — `parseScope` here and `scopeFlags` on the server, with the agreement asserted from both ends — and renaming a stored token would empty the deck of every account that had ever narrowed it. A label is not a key, and this is the release where that stopped being obvious.

**Approved.** The owner's, against a screenshot of the chip row.

<sub>1.15.2 — `web/frontend/src/Settings.jsx` · `web/frontend/test/pure/review-scope.test.js`</sub>

### A screen asking the registry the wrong question is silent in every direction

**Decided.** Home's favourite tiles map their own kind to the registry's kind through a table (`actionKind`) instead of passing it through. A book favourite reports itself as an `annotation`, which is what it is.

**Why — and this one took two attempts, which is the point of writing it down.** `FavouriteTile` called `actionsFor(f.kind, …)`, and a favourite of kind `book` is a highlight *out of* a book. `book` is what the registry calls the book itself, and copy and share are gated on precisely that distinction — `available: !isWork && !!ctx.copy`, because a work has no words of its own to put on a clipboard. So every book favourite came back with an empty action row.

Nothing anywhere reported it. The tile rendered correctly, the handlers were wired and correct, and `QuoteTools` returns `null` for an empty list — which looks exactly like a row nobody has added yet. That is what let it survive being fixed: 1.15.3 moved the tools row onto the collapsed tile, on the reasoning that copy and share should not cost a tap on the one board that exists to hold the lines you liked most. The row was genuinely added. It still drew nothing, and the report came back a release later in the same words.

Library and Catalogue never met it because they pass `'annotation'` and `'dialogue'` as literals. Home was the only screen deriving the kind, and the only one that could get it wrong.

**The test is registry-level and source-level, not render-level**, because the defect was in what the screen *asked* rather than in what it drew. A render test would have needed the exact tile, the exact hover state and the exact CSS, and would have proved less: it reads Home's table, asserts no entry names a work kind, and asserts the call site uses the table. Reverting either half fails it.

**Instead of.** A ternary at the call site, which is what was there — `f.kind === 'screen' ? 'dialogue' : f.kind` — and which handled the one case somebody had thought about while passing the other two straight through.

<sub>1.16.0 — `web/frontend/src/Home.jsx` · `web/frontend/test/pure/favourite-tools.test.js`</sub>

### There is no source language: the code holds keys, and English is a file like any other

**Decided.** The frontend resolves every migrated string through `web/frontend/src/i18n.js` as a key and nothing else — `t('library.filters.genre.placeholder')`, `t(key, {count})` for a plural family, `tNodes(key, {app: <b>tippani</b>})` where a sentence has to carry a node. There is no second argument holding English, no literal beside the key, and no `dangerouslySetInnerHTML` for a value that might contain markup. The copy lives in `internal/i18n/en.txt` and `internal/i18n/bn.txt`, same format, same parser, same key list in the same order in both files — a diff of the two extracted key lists is empty. 2.1.0 shipped the mechanism and 2,446 English keys against a one-line `bn.txt`; 2.1.1 filled every one of them; the anthology work has since taken both files to 2,456. Both are compiled into the binary and both into the bundle. A third language is a file an operator drops in and no code at all.

**Why the English had to leave the call site.** A fallback argument is a second source of truth that nothing keeps in step, and it is the one that gets read: a reviewer stops looking at the catalogue the moment the sentence is visible in the JSX, and the key stops being the name of anything. Worse, it fixes the *shape* of every other language as a patch chasing English — English is what the code says, so English is what is current, and Bengali is forever a diff against it. A key-only call site makes the two files peers by construction rather than by discipline.

**The cost of that is paid in key names, which is why they are long.** The English is no longer at the call site, so the key is what a maintainer reads, and a key nobody can read is a call site nobody can read. `en.txt` carries 1,305 comment lines of context for the translator on top of that — 686 keys have one on the line directly above them and 2,206 sit inside a block a comment introduces. `docs/plans/multilingual.md` says "1,299 of the 2,446 carry one" and that number is a count of comment lines, not of keys; it is exactly the sort of figure that gets quoted onward as though it were the other thing, so it is corrected here rather than left standing.

**Both built-ins ship in the box, and neither is the other's floor by accident.** `Builtins = []string{"en", "bn"}` in Go and `BUILTIN_CODES = ['en', 'bn']` in JS are an inventory, not a precedence. Two named `//go:embed` directives rather than `//go:embed *.txt`, which would have mirrored `seed_stickers.go` and `store/migrate.go` and is wrong here on purpose: a glob means dropping `fr.txt` beside the package silently compiles a third language in, and a third built-in is a deliberate edit. `buildChain` ends every chain at *every* built-in it has not already reached, in that order, so Bengali's floor is English and English's floor is Bengali. `FULL_KEY_SET` — what "100%" is measured against — is the **union** of the two rather than English's set, because measuring `bn` against `en` would make English the source language by arithmetic and would also hide the opposite mistake, a key added to `bn.txt` and forgotten in `en.txt` leaving English at a silent 100%.

**Any other language is config-only, and that is what forces the preference open.** `data/Locales/xx.txt`, where the file name *is* the code. Nothing creates the directory. Because the set of languages is whatever is on disk, the locale preference cannot be an enum: `NormalizeCode` validates **shape only** — lower-case letters, digits and hyphens, sixteen characters — exactly as `normalizeFontToken` validates a face token, and the server has no business refusing a code because it has not heard of the language. `isInstalled` answers against `installedLocales()`, and because a stored code may name a file the operator has since deleted, `localePref` and `localeActive` are two functions with two answers and the picker says so out loud (`{code} is not installed — showing {name}.`). The shape check pays a second dividend nobody designed for: a code can never be `..`, a separator or a drive letter, so a file name cannot become a path.

**`data/Locales` overrides the compiled copies per key, including `en.txt`.** `tableFor` is the data-dir file spread over the built-in, so any single word in the app is the owner's to change without a rebuild, and correcting one English string does not mean forking a 4,000-line file. The override path privileges nobody either — `bn.txt` in the data directory works on identical terms, and `locale-resolve.test.js` asserts the Bengali case rather than only the English one, because the interesting claim is the symmetry. `internal/i18n`'s `Overrides` caches on a signature of every entry's name, size and mtime and **not** behind a `sync.Once` the way `internal/changelog` does: that source is embedded and cannot change, these files are edited under a running server, and "drop it in and it appears" is not a promise a permanent cache can keep. `GET /locales` serves only the overrides, so the ordinary instance gets `{"builtin":["en","bn"],"files":{}}` and a complete interface without it; the route is public because the login and first-run screens render before a session exists, and the bound worth having is on size (512 KiB a file, 64 files) rather than on access.

**An empty value means absent, not empty, and this is the rule the whole format rests on.** `some.key =` is not the empty string — it is a line nobody has filled in. It lands in `File.Empty`, never in `Keys`, the resolver walks past it to the next language in the chain, and it does not count towards coverage. Without it, `node scripts/locale-template.mjs --out data/Locales/fr.txt` — which lists every key with the English and Bengali above it as comments — would blank the entire interface the moment it was dropped in unfilled, which is the one failure a stranger's first attempt must not produce. `locale-resolve.test.js` drops the full generated template in and asserts 0%, not a blank screen.

**Coverage is shown and never enforced; one test fails if the number is wrong.** Demanding completeness is demanding no contributions, so no test may go red because a language is partial — a 0% file still appears in the picker. But `coveragePercent` is floored, clamps to 99 short of complete, and returns 100 only when every key is present, because 199/200 rounded up to "finished" tells a reader something false about the app and a lying percentage is worse than none. An empty key set is 100 rather than a division by zero, which is the honest answer when there is nothing to cover. The pseudo-locale is the same rule turned into an instrument: `qps` is generated *from* the key set, so it is a language in the picker with an honest 100%, its chain falls through to nothing on purpose, and any plain unaccented sentence on screen under it is an English literal still sitting in the JSX. That number has still never been read, which is the honest measure of the migration; `en.txt`'s own header names the eight screens and nine Settings cards it did not reach rather than leaving them to be discovered.

**`_name`, `_fallback` and `_dir` are reserved, and never rendered.** `_name` is how a language labels itself, so a file that forgot the line shows its bare code — which is the accurate report. `_fallback` lets a language name its neighbour before a built-in (Bhojpuri → Hindi → the box), and **the cycle guard is that the chain is a `Set`, not a depth counter**: `_fallback = b` in `a.txt` and `_fallback = a` in `b.txt` is a mistake two people make separately and it must cost nothing. A `_fallback` naming a language nobody has installed is ignored rather than fatal. `_dir = rtl` sets `documentElement.dir`, and both the README and `localeDir` say plainly that this flips text direction and **the layout has not been audited for RTL** — icons, edges and the film-strip sprockets are all positioned assuming left to right. It is offered because a right-to-left language with no `dir` at all is unreadable, not because the app is ready for one.

**Why the bytes live in `internal/i18n/` and not in the frontend tree, which is where the plan first put them.** `//go:embed` cannot escape its own package directory. `internal/changelog` exists entirely to work around that limit and pays for it with a duplicated `CHANGELOG.md` and a drift test that fails when the two differ — and both built-ins *must* be embedded, or a wrecked config directory leaves the app with no text. Vite has no such limit: `?raw` resolves any path in the repository. So the constraint runs one way only and the file goes where the constrained side can see it; the frontend reaches across the tree boundary and the Dockerfile's frontend stage copies `internal/i18n/*.txt` for the same reason. One file, two consumers, nothing to drift and no drift test to write.

**Two parsers of one format, pinned to a hand-written answer neither of them generates.** `Parse` in Go and `parseLocale` in JS apply the same eight rules in the same order — BOM dropped once, CRLF and lone CR normalised, first `=` splits, both halves trimmed, a mangled line recorded and skipped, duplicate keys last-wins in both directions. They agree because `internal/i18n/testdata/agree.txt` and `agree.json` are one fixture and one expectation that *both* suites compare against, so either parser drifting turns its own suite red instead of the two of them quietly settling on something new; `.gitattributes` marks the fixture `-text` so its CR and CRLF endings survive a checkout, and the Go test fails loudly if they have been eaten. `trimSet` is spelled out as `" \t\n\r\v\f"` because Go's `TrimSpace` and JS's `String.trim` disagree about what whitespace is, and NBSP is deliberately excluded from both — French punctuation needs one before a colon and trimming it would silently correct somebody's language.

**The sentence-break budget in `help-budget.test.js` is per language, because a sentence boundary is.** English counts `[.?!]\s+[A-Z“]`, which is what makes "e.g. this" and "TMDB id." cost nothing. Bengali has no case, so that pattern finds nothing in a Bengali paragraph and only the 160-character cap was catching anything; its rule is `।\s+\S`, **the danda alone and not `?` or `!`**, and that is a decision rather than laziness. Bengali borrows both marks from Latin punctuation, and this app's help copy *names* those two as keys — `common.help.keyboard.what` opens with "? চাপলে", the `?` being the key you press — so counting them read one sentence about a question mark as two. A compiled-in language with no rule of its own is now a test failure rather than a silent exemption, so a third built-in makes somebody answer the question instead of inheriting English's answer.

**The translation found exactly one real defect, and it is the whole argument for doing the work.** The stats activity calendar labelled its x axis with `monthName(m).slice(0, 3)`. Three UTF-16 code units is "three letters" only in English: এপ্রিল cut at three gives এপ্, a hasant left dangling with no consonant to join, and অক্টোবর gives অক্. Ten of the twelve months survived the cut, so nothing looked wrong and no screenshot would have shown it. The fix was not a smarter cut — where a word may be shortened is a fact about the language, not about the string — so the axis takes `MONTH_KEYS` from `ui.jsx`, the twelve `common.month.*.label` abbreviations the date picker was already drawing, and the two can no longer disagree. `translated-not-sliced.test.js` scrapes the source, because the rule lives there rather than in a render; it also holds each built-in's twelve to six graphemes and refuses a value ending on a virama. Its own first draft banned a trailing vowel sign too and failed on correct data — জানু, এপ্রি and অক্টো are how Bengali actually abbreviates — so the rule is "not cut mid-conjunct", not "must end in a consonant".

**Instead of.** A conventional translation library: `t('Save')` or `t('save', 'Save')`, English in the source, a `messages/` tree of catalogues per language, and plural machinery for grammars this app does not have. Rejected on the source-language point above, and on the second one that follows from it — a library's completeness gate refuses a partial file, which is a refusal of contributions. Also rejected: `navigator.language` as the default, which would make the language a property of the machine so two readers of one account see different words and every test has to pin it; a first-run picker is a question asked once instead of a guess made forever.

**Reversal.** Reverses four rejected drafts, none of which reached a release — the reversal is of a design, and the cost was four restarted implementations rather than a shipped mistake. The shape being replaced, held constant across all four, was: **wire in a conventional i18n library, leave the English literals at the call sites as the source strings, and add other languages as catch-up patches against them.** The owner's corrections came in this order, each one arriving after an implementation had started: *"do not make it work like random apps, the translation needs to be bespoke — it is supposed to be at least bilingual from inception"*; then *"the translation should be editable, for others to translate it in their languages"*; then, decisively, *"i say translate, but i mean trilingual, and quadrilingual, etc. ask me questions first! always"*. The first killed English-as-source, the second produced `data/Locales` and the per-key override, and the third is why the preference is validated against what exists rather than against a list of two. What was got wrong was the order of operations: the design fork was answered by guessing four times instead of by one question round, which is the only reason this cost what it did.

**Approved.** The owner's, in the three corrections above, and the fourth instruction — *ask me questions first* — is the part with the longest reach: it is now a standing rule, not a note about this feature.

<sub>2.1.0 → 2.1.1 (reversal) — `internal/i18n/i18n.go` · `internal/i18n/en.txt` · `internal/i18n/bn.txt` · `internal/i18n/README.md` · `web/frontend/src/i18n.js` · `web/frontend/src/locale.jsx` · `internal/httpapi/locale_handlers.go` · `scripts/locale-template.mjs` · `web/frontend/test/pure/locale-resolve.test.js` · `web/frontend/test/pure/help-budget.test.js` · `web/frontend/test/pure/translated-not-sliced.test.js` · `docs/plans/multilingual.md`</sub>

## 14. Boards, Cards, Charts and Popups

A popup that places itself in CSS is correct exactly once, and a board that re-packs while you read moves everything you were not looking at — both were fixed by one primitive rather than nine local patches. Charts are here too, because most chart decisions turned out to be about what a number means.

### Popups placed themselves in CSS, and a card-lifting z-index rule existed to work around it

**Decided.** Reversed. Every dropdown, menu and suggestion list used `position: absolute; top: calc(100% + 4px)`, and a separate rule raised a whole card above its neighbours whenever a menu was open inside it. **Why it was wrong.** `top: calc(100% + N)` is right exactly once — when there is room below the trigger. Open a Select near the bottom of a phone screen and the panel rendered below the fold, so choosing an option meant scrolling the page to reach options that were supposed to be in front of you. A menu you have to go looking for is a menu that has failed. The z-index rule is the tell: it dragged the card's cover, its quote and its shadow up along with the menu, because an absolutely-positioned menu cannot escape its own card. A workaround that has to move four things to reveal one is a workaround for a structural mistake. Both were mine, and the second is the evidence I should have read years earlier.

<sub>`web/frontend/test/pure/popup-offsets.test.js`</sub>

### The desktop ⋯ menu portalled to `<body>` — the origin of the standing rule

**Decided.** The nav's overflow menu portals to `<body>` and positions against its button.

**Why.** It rendered inside the horizontally-scrolling top-bar nav, whose overflow clipped the dropdown so it appeared *behind* the page. The fix was local and correct, and it is the first time the two ingredients of the eventual rule appear together: escape the ancestor, and place against the trigger rather than against whatever happens to contain it. It stayed a one-off for a long time, which is the part worth recording — the general rule was available here and I read it as a bug about one menu. I approved the local fix; the generalisation took several releases.

<sub>`web/frontend/src/ui.jsx`</sub>

### Every popup is portalled and viewport-positioned by one measured primitive

**Decided.** `placeAnchored` (pure arithmetic) and `useAnchoredPosition` (the DOM half) place every dropdown in the app. No popup class may set an offset at all, and a test asserts it.

**Why.** CSS cannot do this, and not for want of a cleverer rule: to know it is off the screen a popup has to measure the **viewport**, and an absolutely-positioned element is placed against its offset parent, which knows nothing about where on the page it ended up. Anchor positioning would do it natively and is not yet safe to rely on. So placement moved into JS, and with it into a portal — a card that sets `container-type` or `transform` is a containing block *and* a stacking context, and a popup inside one cannot escape however it is positioned. The arithmetic is a separate pure function because jsdom applies no layout and reports every rectangle as zeros: a test driving this through the DOM would assert that nothing fits inside nothing. The invariant is now the strong form — not "these two composed classes do not contradict each other" but "no popup class places itself at all" — and writing a `top` back fails three tests by name. It applies to the selects, the multi-selects, the tag and work suggestion lists, the ⋯ menus, the shelf chip, the calendar and the import format picker at once. My call, and one primitive rather than nine local patches is the whole argument.

<sub>`web/frontend/src/ui.jsx` · `web/frontend/test/pure/popup-offsets.test.js`</sub>

### Flip only when the preferred side cannot fit and the other is roomier; always cap

**Decided.** `POPUP_MARGIN = 8`, `POPUP_GAP = 4`, `minHeight = 120`. `down = fits || roomier`. `maxHeight` is always the room actually available. Measurement uses `scrollHeight`, never `offsetHeight`.

**Why.** "Flip whenever it does not fit" thrashes the popup between sides when neither fits, which is the common case for a long list on a phone — and then the cap, not the side, is what makes it usable. The cap is the half that matters most: flipping alone still leaves a forty-option list taller than the window, so the list has to scroll *itself*. `scrollHeight` is load-bearing rather than stylistic — once a cap has been applied the element's own height *is* the capped one, so re-measuring `offsetHeight` on the next scroll event ratchets the popup smaller every time. Below `minHeight`, flipping beats a scrollable sliver. Approved by me, with the whole decision expressed as arithmetic so it can be tested rather than looked at.

<sub>`web/frontend/src/ui.jsx`</sub>

### `useDismiss` takes a list of refs, because portalling changed what counts as "outside"

**Decided.** `useDismiss(open, close, [ref, popRef], {event})` — a list, not a wrapper element. The event is configurable, defaulting to `mousedown`.

**Why.** A popup rendered into `<body>` is no longer inside the wrapper, so the familiar `wrapper.contains(e.target)` reports every click *on the popup* as an outside click and the menu closes on the way to choosing from it. Every migrated call site hit this, which is precisely why the check lives in one place. The event choice is real rather than cosmetic: `pointerdown` lands before focus moves and `mousedown` after, and `TokenInput`'s blur handler commits typed text, so swapping them changes the order those two run in — the same portal trap shows up there as "picking 'fantasy' after typing 'fant' enters `fant`". Mine.

<sub>`web/frontend/src/ui.jsx`</sub>

### The colour picker was fixed once locally, then that implementation was deleted the same day

**Decided.** A bespoke measured placement was written for the collapsed colour picker, and the app-wide primitive landed later the same day and removed it. **Why this is here.** The local fix was correct and it was wasted work, and the reason is worth keeping: I fixed the instance I was looking at instead of asking why the instance was broken. The answer — every popup in the app places itself in CSS — was one grep away and had been true for the whole life of the project. The general rule that comes out of it is the same one `personCreditSQL`, the orphan sweep and `facesOnAttribution` produced from the server side: when a bug is a class, fixing the member is the expensive way to find out. My call to write it, and my call to delete it hours later.

### Two classes on one popup solved for a negative height and shipped a 3px sliver

**Decided.** Reversed. The collapsed colour list rendered as `className="cs-menu token-menu"` — `.token-menu` for the popover look, `.cs-menu` for placement. **Why I was wrong.** Reusing `.token-menu` for the border, shadow and entrance animation was the right instinct. What I missed is that `.token-menu` also *places* itself, because it was written for a dropdown hanging under a text input: `top: calc(100% + 4px)`. `.cs-menu` set `bottom` to open upwards and never cleared the `top`. Nothing conflicts in the way CSS usually conflicts, which is why it survived review — neither declaration loses. For a box with `height: auto`, `top` and `bottom` both set is not a tie to be broken: CSS solves for the *height*, and against a 44px anchor that came out near −60px. What reached the screen was the border, twice, with nothing between. It was unusable for a whole release, and all six existing tests over that picker passed the entire time, because they test behaviour and this was layout. Both offsets have to be cleared, which is now enforced as "no popup sets an offset at all".

<sub>`web/frontend/test/pure/popup-offsets.test.js`</sub>

### A container query, not a media query or a ResizeObserver, chooses the collapsed colour picker

**Decided.** `.hand-card` and `.film-frame` declare `container-type: inline-size; container-name: card`, and `@container card (max-width: 330px)` swaps the six dots for the collapsed control.

**Why.** What matters is how wide the *card* is, and a phone in a single column and a five-column desktop board can hand the same control the same 260px — so a media query answers a question nobody asked. A ResizeObserver would get the right answer by measuring, at the cost of a JS observer per card on a board of a hundred. `.cl-grid` had already established container queries here as the fix for exactly this mismatch. There is a consequence the collapsed-picker fix had to absorb: a container is a stacking context, so even at the correct height the list would have slid *under* the card beside it the moment it passed the card's edge — a menu is not part of the card it belongs to. Mine.

<sub>`web/frontend/src/index.css`</sub>

### The collapsed picker is a named list, so the narrow layout shows more than the wide one

**Decided.** Below the threshold the control becomes the current colour with a chevron, opening a list of category **names**.

**Why.** The stylesheet described this a release before it happened: the rule sizing the control on a quote card reads "♥ + FOUR blobs + ⋯ must fit a ~250px column", and 1.7.1 made the categories six. Packing them closer buys one release. But since the categories carry names the reader chose, six unlabelled blobs squeezed to fit are six things nobody can tell apart — so the collapsed form is better than the cramped row would have been anyway, and the narrow layout ends up showing strictly more information than the wide one. The trigger deliberately carries no selection ring: the ring exists to pick one dot out of six, and the trigger *is* the one dot, so a ring there says "this one" to a row of one. I approved the inversion rather than treating it as a compromise.

<sub>`web/frontend/src/index.css`</sub>

### The masonry re-packed under the reader; column assignment now latches on the rising edge of an expand

**Decided.** `Masonry` measures real card heights, holds the assignment in `assignRef`, and latches it (`frozenRef`) on the **rising edge** of `lockOrder` — the first expand of a settled board. A structural signature `n|cols|seed|pinnedCount|keyHash` re-opens free packing when the card set, its identities, the column count, the seed or the pinned prefix changes.

**Why.** A height-packed masonry places tallest-first onto the currently-shortest column, so expanding one card re-sorted every other card — everything you were not looking at moved. Freezing on the rising edge specifically, and never on a pass where a structural change just re-opened packing, is what stops the columns being frozen *around* the currently-expanded tall card. The key hash folds card identities into the signature, so swapping the set for a same-size one — a filter that happens to keep the count — still re-opens packing rather than reusing a stale assignment. Heights are rounded for the ordering only, so sub-pixel measurement noise cannot reorder a tallest-first sort while tops still flow from exact pixels. My call, and the rising-edge detail is the one that took two attempts.

<sub>`web/frontend/src/ui.jsx`</sub>

### Quote boards deal in source order with a seeded 3–5 line clamp

**Decided.** Quote boards pass `order="source"` — newest first, pinned prefix on top — and each card's clamp height comes from `clampSequence` seeded off the work's id, with no three adjacent cards the same.

**Why.** Height-packing a board of quotes bands it: all the long ones end up together and the board reads as two populations rather than one collection. Source order is also the order the reader expects — a quote added a minute ago should be where a quote added a minute ago goes. The variety then has to come from somewhere else, so it comes from the clamp: 3 to 5 lines, seeded off the book so a given book always lays out the same way across reloads, and the no-three-in-a-row rule reads along the same source order the board is laid out in. One seed drives both the masonry jitter and the clamp, so the two cannot drift. Approved by me; it is the opposite trade from the Catalogue and correct for the opposite reason.

<sub>`web/frontend/src/Library.jsx` · `web/frontend/src/ui.jsx`</sub>

### Column ladders are paired with `--container-max`

**Decided.** `BOARD_COLUMNS = [[1900,5],[1600,4],[1280,3],[640,2]]` and `QUOTE_COLUMNS = [[1900,5],[1600,4],[1280,3],[860,2]]`, with `--container-max` stepping 1180 → 1320 → 1500 → 1760px. The stylesheet comment says the two tables have to be read together.

**Why.** A board of cards wants *more columns* on a wider screen, not wider cards — a quote card at 1600px across is a worse card. So the container cap steps rather than growing continuously, and each step is matched by a rung in the ladder. The two ladders differ in exactly one rung: quotes hold two columns down to 860px rather than 640px, because a quote wrapped to 300px is a column of syllables, whereas a cover at 300px is a cover. Below 1400px nothing changes — 1180px was chosen for a laptop and is still right on one. Mine, and pairing them explicitly is what stops one moving without the other.

<sub>`web/frontend/src/ui.jsx` · `web/frontend/src/index.css`</sub>

### Settings abandons the masonry for a written-down column layout

**Decided.** `SETTINGS_CARDS` is the canonical list and `SETTINGS_LAYOUT` fixes which column each card sits in at 1, 2 and 3 columns. A test asserts the three agree, and a card not named in a layout does not render at all.

**Why.** Two of these cards change height *after* they load: Updates grows when a check finds a release, Backup grows when an archive exists. Under tallest-first packing the page rearranges itself under you, and the worst case is the one that sounds safe — a phone, where there is only one column and the columns therefore cannot change. The tallest-first *order* still can: you tap "check for updates", the answer arrives, the card grows, and it is re-sorted somewhere else on the page while you are reading it, so you have to go and find the thing you just asked for. A board of quotes has no natural order, so packing by height costs nothing and buys a tidy board. A settings page has a natural order and seven cards, and the order is worth more than the packing. Colours sitting directly under Metadata in every layout is a rule rather than an arrangement — both are about what a quote is *labelled* with — so reading down one column reads as one subject. Failing loudly when a card is missing from a layout beats a card appearing somewhere unpredictable. My call.

<sub>`web/frontend/src/Settings.jsx` · `web/frontend/test/pure/settings-layout.test.js`</sub>

### Quote cards use progressive disclosure — only ♥ at rest — with opacity rather than display

**Decided.** `.card-actions` and `.card-colors` are `opacity: 0` and `pointer-events: none` at rest, revealed on `:hover` or `:focus-within`, pinned by `.is-visible` where a card stands alone. Phones use the ⋯ overflow and never see the rule.

**Why.** A resting board should show quotes, not a control panel per quote — a hundred cards each wearing share, edit, delete and six colour dots is a screen of buttons with some text in it. Opacity rather than `display: none` is the load-bearing choice: the cluster keeps its layout box, so revealing it never changes the card's height and therefore never re-packs the masonry under the pointer. Keyboard users tabbing into the hidden buttons trip `:focus-within`, which reveals and re-enables them, so the disclosure is not an accessibility trap. Mine.

The class is `.card-tools` since 1.7.9, holds copy and share, and is revealed on a phone too — see the entry below.

<sub>`web/frontend/src/index.css`</sub>

### A card's row is ♥ · copy · share · colour, then a ⋯ holding edit and delete

**Decided.** Every quote card — a book annotation, a film dialogue, a Home favourite tile — lays out the same row: the favourite ♥, then `QuoteTools` (copy, share), then the colour quick-pick, then `QuoteActions`, which is now a ⋯ overflow containing edit and delete **at every width**. The table views' action cell carries the same four, laid flat. `.card-tools` (was `.card-actions`) is hover-gated on a pointer and standing on a phone, like `.card-colors` beside it.

**Why.** Copy did not exist, and share was one line inside the ⋯. Both are the wrong way round. A menu is the right home for an action you take rarely and think about first, and the wrong home for the thing a commonplace book is *for*: getting a line you kept into a message. Before this, that was open the share sheet → pick a format → press copy → close, four acts to paste one sentence.

Edit and delete going the other way is the same argument read backwards. They change or destroy what somebody wrote down, so they should not be reachable by a sweep of the pointer — and they were the two that most wanted to stop being drawn differently per breakpoint.

`copyQuote` reads its field ticks from `shareDefaults`, the same function the dialog opens with, so a copied quote carries its author and holds back the page number exactly as the sheet would. It writes **plaintext**, not the sheet's WhatsApp default: somebody who opened the sheet is choosing where the quote is going, and somebody who tapped a glyph on a card is not, so asterisks would land as asterisks everywhere but one app.

**Instead of** adding copy to the ⋯ alongside share, which is the smaller diff and keeps the resting card at ♥ plus one glyph. Rejected because it puts the app's two most repeated actions behind the affordance meant for its two rarest, which is the thing that was already wrong.

**Reversal.** This replaces the desktop half of the decision above it, and the branch the entry in §13 describes.

> **`QuoteActions` draws share · edit · delete inline on desktop and folds the same three behind a ⋯ on a phone.** A card's actions are hidden until the card is hovered; a phone has no hover, so the three become one overflow glyph.

The glyph-not-words half of that was right and stands. The two-layouts half was defended in §13 as *fixing* an inconsistency — the same control naming its actions differently by window width — and it left the weaker version of the same fault in place: the same control *placing* its actions differently by window width. One row now, at every width.

**Approved.** Mine. I asked for the row in this order.

<sub>1.7.9 — `web/frontend/src/ui.jsx` · `web/frontend/src/index.css` · `web/frontend/src/Library.jsx` · `web/frontend/src/Movies.jsx` · `web/frontend/src/Home.jsx` · `web/frontend/src/share.jsx` · `web/frontend/test/dom/card-actions.test.jsx` · `CHANGELOG.md`</sub>

### A favourite tile's row is the card row, and its open button is the nav's own glyph

**Decided.** The expanded favourite tile lays out ♥ · copy · share · colour · ⋯, the same order as Library's `ActionRow` and Movies' `Frame`. Its "open" control leads the row as a glyph drawn by `NavIcon` — the Library's for a highlight, the Catalogue's for a film line, Quotes' for a standalone quote — with the destination per kind in `FAV_KINDS.openIcon`.

**Why.** Two faults, both from the tile being written separately from the cards it copies. The order was ♥ · colour · copy · share for one release, so a reader who learned the row on a book's page had to re-learn it on Home. And the open control was the words "Open book →" in a `tp-btn-primary` — the loudest control on the tile, spent on the least surprising thing you can do with it, in a row whose other five controls are all glyphs.

Drawing it with `NavIcon` rather than picking an icon per kind is the part worth recording: the tile now cannot disagree with the tab strip about what the Library looks like, which is the same argument the icon-set rules make one screen over.

**Reversal.** A standalone quote used to have no open button at all.

> **A standalone quote has nothing to open, so the button is absent rather than present and inert.** It IS the whole record: no work to fetch, no parent page to land on, so `quoteFav` carries neither `workId` nor `openLabel`.

That was true about a parent record and false about a destination. The quote lives on the Quotes screen, and going there from a Home tile is worth a glyph. It still carries no `workId`, because there is still no work — the test says those two halves separately now, so the surviving half cannot be deleted along with the retired one.

**Approved.** Mine; I named the three glyphs.

<sub>1.7.10 — `web/frontend/src/Home.jsx` · `web/frontend/src/App.jsx` · `web/frontend/test/pure/home-favourites.test.js` · `CHANGELOG.md`</sub>

### Quotes expand on click, and overflow is measured rather than guessed

**Decided.** The "show more / show less" buttons are gone; clicking the text expands it. `ExpandableDescription` sets `overflows` from `el.scrollHeight > el.clientHeight + 2`, re-checked by a `ResizeObserver`, and the click target only becomes a button when it can actually toggle.

**Why.** A character-count heuristic is wrong at every width, in both directions: it shows a chevron on a short quote in a wide column and hides one on a long quote in a narrow one. Measuring answers the question that is actually being asked — does this box clip its content — and the observer keeps the answer true through a resize or a column change. Making the whole text the target rather than a separate button is what let the button go; `role`, `tabIndex` and handlers are attached only when there is something to toggle, so a card with nothing hidden is not announced as a control. I approved removing the buttons on the strength of the measurement, not before it.

<sub>`web/frontend/src/ui.jsx`</sub>

### One card primitive for books and films, with `.film-frame` finally given its material

**Decided.** Books and films render through the same card component, and `.film-frame` gained the texture tile, the dither and an answer to the aesthetic toggle.

**Why.** `.film-frame` was the only card primitive in the app with no material at all — and its own CSS comment had promised the material for three releases, which is the sharpest possible evidence that a comment is not an implementation. Film posters were not cards either: a bare bordered span with the card's shadow bolted on, while a book cover sat in a hand-card, on two boards built from the same component and one tap apart. Two boards from one component that look like two apps is the failure the whole material system exists to prevent. Mine, and the three-release-old comment is the part I keep quoting to myself.

<sub>`web/frontend/src/index.css`</sub>

### A dialogue's frame is a property of the strip, not of the dialogue

**Decided.** `useFrameBase()` picks `11 + floor(random()*28)` once per mount, and each frame renders `${base + i}A` from its position in the strip.

**Why.** The frame code is set dressing on a filmstrip — it says "this is the seventeenth frame of this reel", which is a fact about the strip and the position, not about the line of dialogue. Storing it per dialogue would make it survive re-ordering and filtering, so a filtered strip would show frames 12, 19, 27 and read as damaged film. Regenerating per mount also means it is honest about being decoration. My call, and it is the smallest decision in this section that would have been irreversible if I had put it in the schema.

<sub>`web/frontend/src/ui.jsx` · `web/frontend/src/Movies.jsx`</sub>

### One grain scale per material role, not per call site

**Decided.** Five named custom properties — `--grain-accent: 130px`, `--grain-shell: 320px`, `--grain-shell-sm: 185px`, `--grain-scene: 420px`, `--grain-card: 300px` — and every texture tile names the role it fills.

**Why.** That is how the numbers drifted: an accent-filled control was 150px as a primary button, 130px as a toggle thumb and 120px as an active filter chip — three sizes of the same fabric on three controls that sit in the same row and are meant to read as one family. At those sizes the grain is coarser on the button than on the chip beside it, which is exactly the kind of difference nobody can name and everybody can see. The three shell values are deliberately *not* one number: the tile is a picture of a real surface, so a full-viewport backdrop and a 999px pill want genuinely different scales or the pill shows one blurry plank. What they get instead is a name each, so the next surface picks a role rather than a number. Approved by me; the point is not the values, it is that a call site can no longer invent one.

<sub>`web/frontend/src/index.css`</sub>

### `prefers-contrast: more` and `prefers-reduced-transparency` strip every decorative layer

**Decided.** Both queries drop the page grain, the scenic backdrop, the card tiles, the dither, the shell tiles and the accent grain to zero. Nothing structural moves — borders, lifts, colours and layout are untouched. `prefers-reduced-motion` neutralises every transition and animation *and* opts out of behaviour: `usePlayful` returns without picking an animation at all.

**Why.** The grain overlay is a fixed layer at 5.5% opacity multiplying over every glyph, every quote and every input on the screen. It is the whole point of the design, and for a reader who has asked their operating system for more contrast it is 5.5% of noise standing between them and the text. Neither query was honoured anywhere in the file. What is left after the sweep is the same app with the noise taken off, not a different one — which is the test I applied to decide what counts as decorative. Reduced motion had to go further than a transition reset because the playful animation carousel is a *behaviour*: suppressing the transition on something that was never going to be transitioned is not honouring the request. It arrived one section early because it costs one rule, and the alternative was shipping a release that added six more textured surfaces with no way to turn any of them off. Mine.

<sub>`web/frontend/src/index.css` · `web/frontend/src/ui.jsx`</sub>

### Never rasterise text on a rotated or half-pixel layer

**Decided.** The import cards' paste-on wobble (±0.7°) moves to a chrome-only underlay with the text stack unrotated, and tooltip bubbles centre by flex layout instead of `translateX(-50%)`.

**Why.** "Whole import cards were tilted (±0.7°), rasterizing every glyph on a rotated layer, and the tooltip bubble was centered with `translateX(-50%)` onto half-pixels." Both produce soft text for the same reason — glyphs stop landing on the pixel grid. The rule that comes out of it: decorative transforms belong on a chrome layer beneath the text, and centring should be done by layout so glyphs stay pixel-snapped. I approved it as a standing rule rather than two fixes, which is why it reads as one entry.

### The measured genre chip strip was abandoned for a single dropdown

**Decided.** Reversed. Genre was a strip of chips sized by measuring each chip's text width against the row's leftover space, with the overflow behind "More…". It is one dropdown now, with `All` as its first option. **Why I was wrong.** The row holds a dozen other controls whose widths change with the data, so the measurement was right only until something else moved — and the failure was a chip clipped mid-word against "More…", which reads as a rendering bug rather than as a layout running out of room. The phone case was worse and should have been the tell: inside the filter sheet the measurement always collapsed to zero, so the strip was a lone `All` chip above a dropdown holding every genre. Every genre is now one tap away instead of some being one and the rest two, and it matches how series, sort, group and shelf already read beside it. The general lesson is the same one Settings taught: measuring is the right tool when the question is about content, and the wrong tool when the answer has to be stable.

### Native `<select>` is replaced by an on-brand Select with a draggable thumb

**Decided.** A house `Select` with the same textured thumb the toggle uses. The thumb drags — the same interaction, rotated vertical — and on a list long enough to scroll it stays mouse-only.

**Why.** A native select is the one control that cannot be skinned, so a page of house controls with three OS dropdowns in it reads as unfinished. The thumb drag was an inconsistency worth closing: the toggle's selected-option pill has always been grab-and-slide, and the dropdown rendered the identical thumb but only ever moved it by hover or arrow keys — the same picture behaving two ways. Mouse-only on a scrolling list is a genuine limitation rather than a shortcut: `touch-action` cannot serve both the thumb and the scroller, and if one has to lose it is the thumb, since the list is still fully usable by tapping. I approved shipping it with that gap stated rather than fighting it.

<sub>`web/frontend/src/ui.jsx`</sub>

### `ColorSwatches` is a roving-tabindex radio group where selection does not follow focus

**Decided.** One tab stop for the whole group; arrows move focus without committing; Enter or Space picks. Each dot is a transparent hit box around the 20px circle so touch targets can reach 44px without changing how the dot looks. A hidden slot is dropped from the choices but never from a quote already wearing it.

**Why.** Selection-follows-focus is the usual ARIA radio-group behaviour and it is wrong here: the card quick-pick writes on change, so arrowing across six categories would fire a PUT per keystroke. The same split is what `Select` uses, so the two controls do not teach different keyboard habits. The picker draws the reader's *names* rather than the colour words, because "Pick blue" describes a highlighter and the whole point of naming a category is that the picker then asks the question you actually have. And hiding a slot is about tidying a picker you have stopped using — a quote silently changing colour because of that would be the app editing your library to match a preference. My call on all three.

<sub>`web/frontend/src/ui.jsx`</sub>

### Edit forms open in a portalled `FormModal`, a full-screen sheet on phones

**Decided.** `FormModal` portals to `<body>`, renders a `MobileSheet` on phones and a scrim card on desktop, and takes a ref-counted body scroll lock.

**Why.** The portal is not cosmetic: a `.hand-card` is `isolation: isolate`, so an in-tree modal opened from a masonry tile is trapped inside that tile's stacking context and later tiles paint over it. The scroll lock uses `overflow: hidden` rather than the `position: fixed` trick because every overlay here owns its own scroll container, so hiding body overflow removes the bleed-through without the scroll-position save/restore dance and its jump-to-top failure mode. Ref-counting matters because overlays stack — a share dialog over a form sheet — and an unlock from the inner one would free the page under the outer one. Full-screen on a phone because this is the app's densest form and a 90%-width card inside a scrolling scrim wasted both edges. Mine, with `position: fixed` documented as the upgrade path if iOS rubber-banding is ever reported.

<sub>`web/frontend/src/ui.jsx`</sub>

### A form sheet does not dismiss on a scrim tap, and its Save ✓ lives in the title bar

**Decided.** `dismissOnScrim` defaults to true and is turned **off** for forms. `actions` puts a form's Save glyph in the sheet's title bar, and the ✓ is absent until a form registers through `useFormHost`.

**Why.** A filter sheet loses nothing to a stray tap beside the card; a half-written quote loses everything. That asymmetry is the entire rule, and it is expressed as a prop with a default rather than as two components. Save belongs in the title bar because it is pinned and reachable without scrolling past six fields, where a footer button on a long form is somewhere the thumb has to hunt for. The ✓ being *absent* rather than inert is the subtler half: `WorkDetails` saves each field on its own and the staged-quote editor commits through its own buttons, so a header ✓ on either would be a control that looks like it saves and does nothing — worse than no control. The disabled state carries the reason, which keeps it inside the five-word label rule. Approved by me.

<sub>`web/frontend/src/ui.jsx`</sub>

### Details replaced the whole-record Edit form

**Decided.** A work's Details panel is a list of `InlineField`s — read at rest, pencil to edit, ✓ to save that field. Each field writes on its own, and a failed write keeps the editor open with what you typed still in it.

**Why.** A full-state PUT of a whole record is a large blast radius for changing a page number, and it makes every save an all-or-nothing act. Per-field saving also removes the "did I remember to press Save" question entirely. Returning whether the write landed is the part that had to be got right: discarding the editor on failure throws away the text the user just typed and gives them nothing to retry with, which is the worst possible response to a network blip. Mine, and it is why `FormModal` had to learn that some forms have no header ✓.

<sub>`web/frontend/src/WorkDetails.jsx` · `web/frontend/src/index.css`</sub>

### Scroll chaining was fixed by a stylesheet invariant rather than a case

**Decided.** A test walks every rule block in `index.css` and requires that anything matching `overflow(-x|-y)?: auto|scroll` also carries `overscroll-behavior(-x|-y)?: contain|none`. Eleven full-viewport overlays additionally freeze the page.

**Why.** A wheel or a swipe that runs past the end of a popup carries on into the page behind it. Nothing throws and nothing looks broken while it happens — the page you cannot see moves under the dialog you are reading, and it is still moved when you close it, so you come back somewhere you never navigated to. Nine scroll containers were affected and only two declared the property, which makes it a bug of *omission* — and the failure mode is not "someone wrote the wrong value", it is "someone adds `overflow-y: auto` next year and never thinks about chaining at all". Only a sweep catches that. The second half was worse than the report: CSS containment only governs a scroll that *started* inside the overlay, so eleven full-viewport overlays needed the body lock as well. My call to write the invariant rather than eleven fixes, and it is the pattern the popup-offsets test later copied.

<sub>`web/frontend/test/pure/scroll-containment.test.js`</sub>

### An `ErrorBoundary` shows the real error instead of a white screen

**Decided.** One boundary around the whole screen and one per tab, showing the actual message plus a reload escape hatch, with the component stack logged to the console.

**Why.** There was no boundary at all, so one thrown component blanked everything — and the concrete case was an engine that lacked a JS feature a page used, which is the ES2018 lookbehind bug from §10 seen from the other side. On a phone, a white screen is an unreportable bug: the person who hit it has nothing to tell me. Showing the real message makes it diagnosable from a screenshot, and `label` scopes it to the tab so "the Quotes screen" is part of the report. I approved showing the raw error rather than a friendly one, because a friendly message on a self-hosted app you run yourself is a message that helps nobody.

<sub>`web/frontend/src/ui.jsx` · `web/frontend/src/App.jsx`</sub>

### Overlapping list requests are dropped by a sequence guard; freshly-added quotes pin to the top

**Decided.** Each list loader increments `reqSeq` and discards its response if the counter has moved on. Newly-added quotes form a pinned prefix of the displayed rows until the next sort or refresh.

**Why.** Changing a filter twice quickly issues two requests, and there is no guarantee they return in order — so the slower, older answer can land last and paint a list that matches neither filter. A monotonic counter is the smallest correct fix and needs no cancellation support. Pinning is the other half of the same concern: when a quote is added under a sort that would file it in the middle of a hundred others, the immediate feedback has to be that it exists, so it stays glued to the top until you sort. `pinToTop` is the single source of truth for all three views, so the board, the table and the count cannot disagree. Mine.

<sub>`web/frontend/src/Movies.jsx` · `web/frontend/src/Library.jsx`</sub>

### Tiles run a one-open-at-a-time accordion, and the board collapses before any set change

**Decided.** The parent owns `expandedId`; expanding one collapses the rest; `expandedId` is cleared before a filter change, a refetch, a delete, or a column-count crossing, and cleared if the open card leaves the set.

**Why.** Locking the masonry column order while one card is open is what keeps the board from reshuffling under the reader, but a dangling `expandedId` keeps `lockOrder` stuck true and defeats the rising-edge freeze on the next expand. Collapsing first means the board re-packs and re-freezes off collapsed heights rather than around one still-expanded card. I approved the parent owning the state precisely because the clearing rules are about events the card cannot see.

**Instead of.** Per-card independent expansion (multiple tall cards fight the packing).

<sub>`web/frontend/src/Library.jsx` · `Library.jsx` · `Movies.jsx`</sub>

### The Lightbox pushes a history entry, and portals past its filtered ancestor

**Decided.** Opening pushes `{tpLightbox: true}`; `popstate` closes it; an explicit close consumes the entry it pushed. It renders through a portal to `<body>`.

**Generalised in 2.1.3** — this is now `useBackToClose`, and every overlay in the app asks for it: `FormModal`, `MobileSheet`, the drawer, the account overlay. The entry carries `tpOverlay` and forwards the route depth below rather than replacing the state object, which the Lightbox's own marker did not. See the next entry but one.

**Why.** On Android the back gesture is how a full-screen thing is dismissed, and without a history entry it leaves the page instead — losing the reader's place in a board they had scrolled. Consuming the entry on an explicit close is the part that is easy to omit: without it, the page's own Back stops working for one press after every lightbox you opened and closed normally. The portal is required for a different reason: the detail hero has a `filter`/`will-change` ancestor, which makes `position: fixed` anchor to *it* rather than to the viewport, so a plain render traps a full-screen overlay inside the cover's box. Mine, and it is the same containing-block trap the popup primitive exists for.

<sub>`web/frontend/src/ui.jsx`</sub>

### The in-app Back arrow is the browser's Back, and history.js is where that is decided

**Decided.** `history.js` owns the session history: every pushed entry carries a `tpDepth` one greater than the entry it came from, the entry the reader ARRIVED on carries 0, and `navigateBack(fallback)` delegates to `window.history.back()` when the depth is above 0 and otherwise **replaces** the address in place. The five in-app back arrows — a work detail's, a quote board's, an anthology's, the Bin's, and the phone's detail bar — call `goBack(tab)`, which is that function plus a state update for the replace case only.

**The bug.** Every one of those arrows called `go(tab, null)`, and `go` pushes. So the stack read shelf → book → shelf, and the phone's Back returned to the book. The report: *"if i use the back button on the top of the screen from a work details page of any page, it is not treated as back, but as a link. when i go back using the phone controls, it goes back to the work details page instead of going back yet further."* Two controls with one name doing opposite things to one stack, and the address bar could not show it — `/library` either way.

**Why a depth and not a flag.** The arrow has to tell apart two situations that look identical from where it is pressed: the book was opened from the shelf, so Back is the browser's Back; or the reader arrived on the book directly — a shared link, a bookmark, a reload, the PWA reopening where it left off — where `history.back()` leaves the app entirely. A count answers both and needs nothing else remembered.

**Why in `history.state` rather than a ref.** It has to survive a reload, and the session's entries do. A ref would read 0 after F5 on a detail page and the arrow would stop being Back on the one path a reader triggers most easily.

**Why a module.** Nothing in the suite mounts `App` — its size is the reason, and `features-nav.test.js` reads it as *source* for the same reason. Splitting the history decision out of the component makes it testable against jsdom's real session history; what cannot be tested that way is which prop each arrow is wired to, so that is asserted from the source, and the pattern it forbids is `onClose={() => go('x', null)}` — the shape that reads most naturally when adding the next screen.

**Approved.** The reader's, with the general rule stated in the same message: *"the back action needs to be global, no matter in which menu. back buttons and software back actions (in desktop browser or phone gestures/buttons) should be in sync."* The overlay half of that is `useBackToClose`, two entries above.

<sub>2.1.3 — `web/frontend/src/history.js` · `web/frontend/src/App.jsx` · `web/frontend/src/ui.jsx`</sub>

### Home favourites shuffle on every load, and had never asked for standalone quotes

**Decided.** The favourites section reshuffles per page load, and `loadFavs` now requests all three kinds.

**Why.** Shuffling is the point of the section: it exists to resurface things, and a stable order means you see the same six favourites forever and stop looking. The bug is the more interesting half — Home fetched two lists and merged two lists, and had done since before the third kind of quote existed, with the comment above the loader still saying "both media". Nothing failed: hearting a standalone quote worked, the heart stayed on, the Quotes screen filtered by it, and the quote simply never appeared in the section that exists to resurface exactly that. That is a bug you can only find by owning one and going to look, which is why the test asserts the *sources* — the loader has to ask for all three kinds and the kind table has to know what to do with each — rather than what the tile renders. A render test asserts what a component does with the data it was given, and this component was never given the data. My call to test it that way.

<sub>`web/frontend/test/pure/home-favourites.test.js`</sub>

### A credited person is always a doorway, and everything named on Stats clicks through

**Decided.** Every credited name — on a card, in a group heading, in a Stats breakdown, on a superlative tile, on an activity-calendar dot — opens the person or the search that explains it.

**Why.** A name that is only text is a dead end on a screen whose entire job is "what have I collected", and the reader's next question after seeing a name at the top of a leaderboard is always the same one. Activity dots click through to that day's additions via the date facet; breakdown rows carry cover, poster or portrait art so the row is recognisable before it is read. The gap this closed was specific: the share *image* had drawn speaker portraits since 1.5.0 because `speaker` became a people kind in that release, so a speaker you had enriched showed their portrait in the picture you exported and stayed inert text on the card you exported it from. I approved making it a rule rather than a per-screen decision.

### Stats counted book highlights as "Quotes" while the nav's Quotes tab meant something else

**Decided.** Reversed. The counts row called book annotations "Quotes". **Why it was wrong.** The nav has a Quotes tab meaning the standalone kind, so a tile borrowed a screen's name without counting what that screen counts — while the kind it was named after had no tile at all. A label that is correct in isolation and wrong against the tab strip two inches away is worse than a clumsy one, because the reader reconciles them and gets a false answer. This is the copy-outliving-behaviour failure again, and it is the third time in this document. Mine.

### Stats counts all three kinds of quote, and the colours card finally counts dialogues

**Decided.** Totals, favourites, busiest month, activity calendar, tag leaderboard, recall states and the colour breakdown all count annotations, dialogues and utterances.

**Why.** The server had counted standalone quotes from the day they arrived — in the totals, the colours, the tags, the calendar, the recall states, and in two whole breakdown kinds of their own — computed and sent on every request and rendered by nothing. The header said "50 saved" when 57 were. Separately and for longer, the card headed "Highlight colours" counted only book annotations, though dialogues have worn a colour since migration 0021, so two thirds of the coloured things in the library were invisible to the card that exists to count them. Both are the same defect: a screen that was correct when it was written and never revisited when a kind was added. I approved fixing them together and adding a test that names the three kinds.

<sub>`web/frontend/test/dom/stats-quotes.test.jsx`</sub>

### Four role-shaped people breakdowns became one row per person

**Decided.** Authors, directors, actors and speakers as four separate breakdowns became a single **People** breakdown, one row per person whatever the role.

**Why.** The breakdowns asked "who" four times and got four half-answers. Somebody with books here and films here was two rows in two sections, each carrying part of their work, and no section could answer "who do I actually quote". Migration 0027 had already stopped keeping a person once per job — this is the UI catching up to storage that had been right for several releases, which is its own small lesson about how long a schema change takes to reach the screen. Mine.

<sub>`internal/store/migrations/0027_people_one_row.sql`</sub>

### The Occasions breakdown was added because the server already computed it, and removed

**Decided.** Reversed. `Speakers` and `Occasions` breakdowns were computed server-side from 1.5.0; the UI rendered Occasions from 1.7.2; it was removed in 1.7.4. **Why I was wrong.** It was added because the server had been computing it and nothing rendered it — which is an argument about the *gap*, not about the value. That is the whole mistake, and it is worth keeping because "the data is already there" is a persuasive-sounding reason that answers no question a reader has. An occasion is a locator, and a leaderboard of rallies answers nothing the speaker list does not answer better. The count survives where it belongs, as a speaker's works. Mine, both the addition and the removal.

### Superlatives that needed no new query, with ties broken towards the earlier answer

**Decided.** Four more superlatives — the person you quote most, the person you heart most, the decade you return to, who you remember best against who keeps slipping away — with deterministic tie-breaking towards the earlier candidate.

**Why.** The last two needed no new query at all: they had been computed and sent on every request since the recall work landed and nothing had ever drawn them. That is the acceptable version of the argument the Occasions breakdown failed — the difference is that these answer a question a reader actually asks, and the free query is a reason to build them *now* rather than a reason to build them at all. Ties resolve towards the earlier answer so the card does not flicker between two equal candidates on successive loads; a superlative that changes when nothing changed is not a fact. I approved these on the question first and the cost second, which is the order I got wrong on Occasions.

### The timeline dates a quote by its work, draws empty buckets, and lets the reader pick the scale

**Decided.** A quote sits at its work's year. Decade, century or year is selectable. Empty stretches are drawn.

**Why.** Every book and film has carried a year since the first migration and nothing answered "when are the things I read *from*" — the activity calendar answers when I saved them, which is a different question. Dating a quote by its work is what makes a line copied out of the Analects last week belong at 479 BCE. The scale is selectable because a library spanning two and a half millennia and a shelf of films want different bucket sizes and neither is a sensible default for the other. Drawing the empty stretches is the part that is a decision rather than a rendering detail: two bars side by side read as two adjacent periods rather than as two thousand years apart, so omitting the gaps would make the chart lie about the shape of the library. My call.

<sub>`web/frontend/test/pure/timeline-buckets.test.js`</sub>

### The timeline's stacked bar became a dot plot

**Decided.** Reversed. It was one stacked bar per bucket — works at the foot, quotes on top, the pair summing to the bar's height. Each series now gets its own column of dots rising from the same floor, sharing one scale, with `TIMELINE_MAX_DOTS = 12` and `dotUnit` rounding up so anything at all draws at least one dot. **Why I was wrong.** Only the bottom segment of a stack starts from a common baseline, so the quote counts — the series you actually came for — each began at a different height and could not be compared across buckets by eye. Worse, the two series were being *added together*, which they should never have been: a work and a quote are not two of the same thing, and "3" on that axis meant nothing in particular. A dot plot fixes both, and makes the unit explicit in a way a continuous bar does not — the count is something you can read off by counting, with the legend stating what one dot is worth when the library outgrows one each. Both series share one scale, because two scales in one frame is two charts wearing a disguise. Rounding up matters: a decade holding a single book must not render as an empty column, since empty is the mark this chart reserves for holding nothing. Mine, and stacking was the kind of default I should have questioned before drawing it.

<sub>`web/frontend/src/StatsPage.jsx` · `web/frontend/test/pure/timeline-dots.test.js`</sub>

### The activity calendar reports accuracy alongside volume, and says "no answers"

**Decided.** `dayTitle` reports `N answers · M% correct` for the Quiz and Practice streams, `N saved` for Saves, and `no answers` for a day with a zero count.

**Why.** The Saves stream counts things you kept and the count *is* the fact. The two review streams count answers, where the count alone is the less interesting half: a day of twelve answers all wrong shades exactly like a day of twelve all right, because the fill is volume. So the ratio has to travel with the tally. "No answers" rather than "0% correct" is the sharper decision: `got` is absent on any day the server sent no row for — a quiet day, or a practice history that has been reset — and "0% correct" is a claim about a session that did not happen. A chart that invents a score for a day you did not use it is a chart that is lying quietly. My call.

<sub>`web/frontend/src/StatsPage.jsx` · `web/frontend/test/pure/calendar-day-title.test.js`</sub>

### The Quotes screen was a flat list on the premise that a parentless quote has nothing to group by

**Decided.** Reversed. Standalone quotes shipped as a flat list, on the reasoning that the other two screens group by their parent work and this kind has no parent. **Why I was wrong.** It is the same error the standalone-quote review-deck prediction made: I reasoned from what this kind *lacks* instead of from what it has. What a book gives you is a **title**, and this kind has four things of that sort — who said it, through what medium, where, and when. None is a parent row, and all four are piles worth making. The premise was true and the conclusion did not follow from it. Mine.

<sub>`web/frontend/src/Quotes.jsx`</sub>

### Quotes renders on the shared list scaffold and groups by speaker, medium, place and date

**Decided.** `WorkListScaffold` plus `groupWorks`, with `GROUP_OPTIONS` of speaker, medium, place and decade, and named residual buckets — "No speaker", "No medium", "No place".

**Why.** The three list screens had drifted into looking like three different apps while doing the same job, so Quotes gets the same filter row, counts, empty and no-match states, export confirmation and full-screen phone filter sheet. The residual bucket matters more here than on its neighbours, because a proverb has no speaker, no medium and no date and lands in the catch-all of every one of them — so the label says what is *missing* rather than "None". The speaker dimension translates to `groupWorks`' `author` rather than falling through to the generic facet branch, which reads the raw column: without the translation, a line credited to two speakers filed under the joined string as though that were a person. Extracting `groupUtterances` from the component is what lets that agreement — between the page, the card and the share image — be a test rather than a reading. Filtering also moved client-side to match both neighbours, closing a bug they cannot have: the speaker dropdown was built from the rows on screen, which the server had already filtered. Approved by me.

<sub>`web/frontend/src/Quotes.jsx` · `web/frontend/test/pure/quotes-grouping.test.js`</sub>

### One action registry feeds both the context menu and the bulk bar

**Decided.** `actionsFor(kind, item, ctx)` and `bulkActionsFor(kind, items, ctx)` in one module, built as commit 1 — before either feature — changing no behaviour. `QuoteActions` renders the registry instead of its hardcoded three; `SearchBulkForm` renders the bulk list.

**Why.** A context menu asks "what can I do to *this*"; multiselect asks "what can I do to *these*". Built separately, the app ends up with two answers to the same question — a menu that offers Delete beside a bar that does not — and the divergence is invisible until somebody notices one of them is missing something. Today an action's definition is spread across whatever renders it: `QuoteActions` knows Share/Edit/Delete, a work's delete lives in `WorkDetails`, the shelf move lives in `Library`, and nothing knows the *set* — which is exactly why there is no context menu and why the bulk form offers tags-and-fields rather than "the things you can do to a quote". If the screens look identical after commit 1, the registry is right. My call, and building the shared thing first is the part I have to keep re-deciding.

<sub>1.10.0 · works 1.11.1 — `web/frontend/src/actions.jsx` · `web/frontend/src/selection.jsx` · `web/frontend/src/SelectionBar.jsx` · `web/frontend/src/ui.jsx`</sub>

### An action that cannot be done in bulk is marked `single: true`

**Decided.** Every action appears in both lists or is explicitly flagged, and a test asserts it.

**Why.** An action that can be done to one thing and not to forty is a real category — Edit is exactly that — so the registry marks it rather than omitting it. Absence is what drift looks like; a flag is what a decision looks like. The two are indistinguishable in a list, which is the entire reason for the flag. Mine, and it is the same principle as `orphanRefQuery` returning `""` instead of falling through: make the missing case visible.

<sub>1.10.0 · works 1.11.1 — `web/frontend/src/actions.jsx` · `web/frontend/src/selection.jsx` · `web/frontend/src/SelectionBar.jsx` · `web/frontend/src/ui.jsx`</sub>

### Long-press is already taken by tooltips, which constrains where the menu can be bound

**Decided.** The context menu's long-press goes on the **card body**; `Tooltip`'s label long-press stays on **controls**. Any long-press whose target closes on `.tp-tip-wrap, button, a, input` is ignored.

**Why.** `Tooltip` opens its label after `LONG_PRESS_MS = 500` on touch, because a phone has no hover and the glyph-only buttons introduced in 1.5.0 would otherwise be unlabelled. A card contains those buttons, so "long-press opens a menu" and "long-press shows a label" are live on the same square inch. They coexist only because of what each is attached to, and writing that down before building the menu is what stops the menu being built first and the conflict discovered on a phone. I approved binding the *new* gesture around the existing one rather than reworking tooltips, because the tooltip is the accessibility affordance and the menu is the convenience.

<sub>1.10.0 · works 1.11.1 — `web/frontend/src/actions.jsx` · `web/frontend/src/selection.jsx` · `web/frontend/src/SelectionBar.jsx` · `web/frontend/src/ui.jsx`</sub>

### Right-click yields to the browser when text is selected

**Decided.** A non-collapsed selection inside the target means the browser's own menu wins — no `preventDefault`.

**Why.** This is a note-keeping app. Selecting a passage and right-clicking it to copy, search or look it up is not an edge case here, it is a core motion, and replacing that menu with an app menu takes away the thing the app is for. It also composes with the gesture ground rules, which forbid `user-select: none` on quote text for the same reason. My call, and it is the one place I am happy to lose a gesture entirely.

<sub>1.10.0 · works 1.11.1 — `web/frontend/src/actions.jsx` · `web/frontend/src/selection.jsx` · `web/frontend/src/SelectionBar.jsx` · `web/frontend/src/ui.jsx`</sub>

### A selection clears when the filter changes, spans one kind, and never persists

**Decided.** Changing any filter clears the selection. Selecting in a second section clears the first, and the bar names the kind. There is no persistence — the selection dies with the screen.

**Why.** A selection that survives a filter change is a set of rows you can no longer see, and the next bulk action applies to things that are not on screen. Cross-kind selection is forbidden because the bulk endpoints are per-kind and the available actions differ, so a mixed selection would offer the intersection and quietly do nothing to half of it. No persistence because a selection is a sentence you are in the middle of, not a state worth restoring — restoring one across a reload means the next bulk action is applied to a set the reader assembled yesterday. Approved by me as three rules that are really one: a selection is only ever what is currently visible and currently one thing.

<sub>1.10.0 · works 1.11.1 — `web/frontend/src/actions.jsx` · `web/frontend/src/selection.jsx` · `web/frontend/src/SelectionBar.jsx` · `web/frontend/src/ui.jsx`</sub>

### Bulk delete is never reachable from a gesture, ships last and alone, and needs the bin first

**Decided.** Select → toolbar Delete → typed confirmation. Never a swipe, never a long-press, never adjacent to Select or Edit in the menu; below a separator and danger-styled. It is the final commit of the plan, and it depends on the bin.

**Why.** Every other action in the registry is recoverable or trivially redone; this one deletes forty rows. Three deliberate frictions: it cannot be reached by a gesture that could be made by accident, it is separated from the actions people press constantly, and it costs a typed confirmation. Shipping it last and alone means the commit that introduces it changes nothing else, so it can be reverted on its own. Requiring the bin first is the load-bearing dependency — bulk delete is only sane because every in-scope delete is recoverable for 30 days. My call, and the ordering is the part I would defend hardest.

<sub>1.10.0 · works 1.11.1 — `web/frontend/src/actions.jsx` · `web/frontend/src/selection.jsx` · `web/frontend/src/SelectionBar.jsx` · `web/frontend/src/ui.jsx`</sub>

### Two things the context-menu plan had wrong, and one it could not have known

**Decided.** Recorded here for the same reason section 7 records the facet plan's misses: a plan corrected without trace reads as a plan that was right.

**Home favourites were declared out of scope, and are in it.** The plan excluded search results and Home's favourites because "their rows vary in kind, so the menu would have to pick a registry per row". True of search, where a result list mixes books, films and three kinds of quote. Not true of Home, where the row carries its own kind and picking the registry is one expression — `f.kind === 'screen' ? 'dialogue' : f.kind`. The exclusion was one argument applied to two surfaces that only look alike, and the cheaper of the two has had the menu since.

**One registry served one half of the app for three releases.** The plan's first commit built `actionsFor` and `bulkActionsFor` together, before either feature, so that a menu and a bar could not answer the same question differently — and that is exactly what happened anyway, in the direction nothing was watching. 1.11.1 gave the bulk list a work branch; the item list stayed quote-only. The selection bar could fill a book's gaps, skip it in the quiz, edit it and delete it with one thing selected, and the cover that one was selected from offered nothing at all. Every test in the file walked item → bulk. None walked bulk → item, so the asymmetry the registry exists to prevent was invisible to the tests written to prevent it.

The lesson is not "write more tests". It is that a symmetry check has a direction, and one written from the surface that currently has more actions will keep passing as the other surface falls behind.

**And the thing it could not have known.** `WorkCard` carried a comment explaining that it had no menu because a work's actions live elsewhere and "a menu that opened on a gesture and offered nothing would teach the gesture and then refuse it". That reasoning is sound and the conclusion was wrong, because the premise had quietly stopped being true — the actions existed, on the other list. A comment justifying an absence is worth re-reading whenever the thing it describes gains a neighbour.

**Approved.** Mine, written after building the last of it at 1.14.2.

<sub>1.10.0 · works 1.11.1 · completed 1.14.2 — `web/frontend/src/actions.jsx` · `web/frontend/src/works.jsx` · `web/frontend/src/Home.jsx`</sub>

### Gesture ground rules come before any gesture, and swipe-between-tabs is rejected permanently

**Decided.** Seven constraints written down before the first new gesture: nothing starts within ~32px of a screen edge or in the home-indicator strip; prove direction before capturing (10px on the dominant axis, dominant by ~1.5×); `touch-action: none` only on the element that owns a gesture and never on a scrolling ancestor; `user-select: none` on card chrome but never on quote text; every gesture additive; one Settings toggle turns them all off; `navigator.vibrate(10)` on commit. Swiping between the four bottom-nav tabs is rejected outright and recorded so I do not revisit it.

**Why.** A web app that fights the operating system for a swipe loses, so the constraints have to exist before the list of gestures rather than as corrections to it. Every gesture being additive is simultaneously the accessibility requirement and the answer to how anyone discovers a gesture at all — the ⋯ overflow, the ♥ and the filter sheet all stay exactly as they are. The permanent rejection is the entry that earns its place: a screen-width horizontal gesture fights the back gesture at both edges and any horizontally scrollable content in between, and the bottom bar is already one tap away. Recording a *no* is worth as much as recording a yes, because without it I will have the same good-sounding idea again next year. Two more are held back until the bin lands, because a mis-swipe must be recoverable. Mine.

<sub>`docs/roadmap.html`</sub>

### One action registry, rendered by every surface

**Decided.** `actions.jsx` holds `actionsFor(kind, item, ctx)` and `bulkActionsFor(kind, items, ctx)`. The card row, the ⋯ overflow and the context menu all render from the first; the search screen's bulk form renders from the second. An action carries its own placement (`row` or `overflow`), and one that does not generalise to a selection is marked `single`.

**Why.** An action's definition used to live in whatever rendered it. Nothing knew the SET, so nothing could offer the set anywhere else — which is why there was no context menu, and why the bulk form offered tags-and-fields rather than "the things you can do to a quote". The moment there are two surfaces, two definitions diverge: a menu offering Delete beside a bar that does not looks completely normal on both, and nobody notices until somebody asks why they cannot do to forty what they just did to one.

`single` rather than omission is the load-bearing detail. Edit genuinely does not generalise — editing forty quotes is a bulk field change with its own form, not this action forty times — and stating that with a flag makes it a decision. Absence would make it indistinguishable from drift, which is the thing this file exists to prevent.

**Instead of** building the context menu with its own list and reconciling later. Reconciling later means noticing later.

**Approved.** Mine, and I approved the ordering: the registry first, changing no behaviour, before anything read from it.

<sub>1.9.0 — `web/frontend/src/actions.jsx` · `web/frontend/test/dom/actions-registry.test.jsx` · `CHANGELOG.md`</sub>

### The card menu's long press is on the card BODY, because Tooltip already owns the control

**Decided.** `useCardMenu` binds right-click, long-press and Shift+F10 to a card, and IGNORES any event whose target is inside `.tp-tip-wrap, button, a, input, textarea, select, label`. A press on a control gets that control's tooltip label; a press on the card gets the menu.

**Why.** Long-press was already taken. Tooltip opens a label after 500ms on touch because a phone has no hover and the glyph-only buttons of 1.5.0 would otherwise be unlabelled — and a card CONTAINS those buttons. Bound to the whole card, every press on a glyph would race a tooltip against a menu, and the winner would depend on event order, which is the kind of bug that reproduces on one device and not the next.

Three smaller ones came with it. A press that moves past `LONG_PRESS_SLOP` is a scroll (the existing constant, not a second one). The trailing click is eaten with the mechanism Tooltip already uses, or letting go opens the quote behind the menu you just asked for. And iOS raises its own callout over text, so `-webkit-touch-callout: none` — but NOT `user-select`, because selecting part of a quote by hand is a thing people do here.

**Instead of** long-press-to-select and right-click-for-menu, which is what a file manager does. The menu is the more general gesture and it contains the selection entry, so it wins the collision.

**Approved.** Mine.

<sub>1.9.0 — `web/frontend/src/ui.jsx` · `web/frontend/src/index.css` · `web/frontend/test/dom/card-menu.test.jsx`</sub>

### A text selection inside a card gives the browser's menu right of way

**Decided.** `onContextMenu` checks for a non-collapsed selection whose anchor is inside this card and, if there is one, does NOT `preventDefault` — so the platform menu opens instead of ours.

**Why.** Somebody who has dragged across a quote and right-clicked wants Copy. They also have Look Up, Translate, Search With and Speak, none of which this app reimplements. Replacing that with a four-item menu in a note-keeping app is a straight downgrade at the exact moment the reader is doing the thing the app is for.

Scoped to a selection INSIDE the card, because a selection in another card or in the search box is not this card's business and would suppress the menu everywhere.

**Approved.** Mine, and this is the one I would defend hardest in the whole feature.

<sub>1.9.0 — `web/frontend/src/ui.jsx` · `web/frontend/test/dom/card-menu.test.jsx`</sub>

### `POST /quotes/bulk` is not a mirror of the other two

**Decided.** The bulk quote kinds are a table of `{table, parentCol, parentTable}`, and the ownership query follows the shape: a child row is filtered through its parent, a standalone quote by `user_id` on the row. All three accept `color`; the two WORK endpoints do not, because a work has no colour.

**Why.** The existing helper took a kind and swapped three names, which reads as parameterised — and both kinds it served were child rows. `utterances` is not one. Swapping the strings would have produced `WHERE user_id IN (SELECT id FROM utterances WHERE user_id = ?)`-shaped nonsense: a filter matching nothing, which is a bulk action that reports success and changes nothing at all.

Both directions are tested because both fail silently and oppositely: matching nothing is a no-op with a confirmation, matching everything is somebody else's library.

**Approved.** Mine, and I approved the table over the string swap specifically because the swap is the version that looks fine in review.

<sub>1.9.0 — `internal/httpapi/bulk_handlers.go` · `internal/httpapi/bulk_quotes_test.go` · `internal/httpapi/capabilities_handler.go`</sub>

### A selection drops what leaves the screen, rather than clearing or persisting

**Decided.** `useSelection(orderedIds)` holds picked ids against the board's own visible list. When that list changes it removes ids that are no longer in it, keeps the rest, and clears the kind when nothing is left. One kind at a time — picking a second kind replaces the selection. Nothing is persisted across a reload.

**Why.** The bar says "12 selected" and then acts on twelve things, so the number has to be one it can act on. Select thirty quotes, change the colour filter, and the ids that left the screen are things nobody can check any more — the bin makes acting on them recoverable, it does not make it honest.

Clearing the WHOLE selection on any list change is the blunter rule and it is wrong for the commonest case: a board refetching itself after a patch, where every id is still there. Every bulk action reloads, so that rule would wipe the selection each action just used, and bulk editing would be impossible.

One kind, because search shows books and quotes in one view and a selection spanning both has no coherent action — you cannot set a series on a quote.

**Instead of** persisting a selection. Resuming one after a reload is a way to act on a library that changed while you were away.

**Approved.** Mine.

<sub>1.10.0 — `web/frontend/src/selection.jsx` · `web/frontend/test/dom/selection.test.jsx`</sub>

### Select is the first item in the card's own menu

**Decided.** Three ways in: the checkbox in a card's corner, Ctrl/Cmd-click anywhere on it, and `Select` at the top of the context menu. Once a selection exists a plain click toggles instead of opening.

**Why.** The menu entry is what makes the context menu and multiselect one feature rather than two: the gesture that asks "what can I do to this" is also how you start doing it to several. It is also the only entry point that works identically on a phone, where long-press-to-select would collide with long-press-for-menu — and the menu wins that collision, because it is the more general gesture and it contains the selection entry anyway.

The click changing meaning is the risky part, and it is legible rather than modal-by-stealth: the bar is up, the cards wear checkboxes and an accent ring. Clicking the last one off leaves the mode, so it needs no Cancel.

**Instead of** a Select-mode toggle in the toolbar as the primary door. It is a mode you have to find and then leave; the checkbox and Ctrl-click are things you already know.

**Approved.** Mine.

<sub>1.10.0 — `web/frontend/src/Library.jsx` · `web/frontend/src/index.css` · `web/frontend/test/dom/selection-cards.test.jsx`</sub>

### A deleted selection is ONE bin entry, behind a phrase counting what will go

**Decided.** Bulk delete writes a single `trash` row of kind `selection` (migration 0032) holding every row from every item. It requires a typed phrase — "delete 3 quotes" — checked on the server, and the count in that phrase is the count of items the caller actually OWNS.

**Why.** Forty-one entries for one act would be a wall of rows in the bin for a single decision, and undoing it would mean forty-one restores that can each half-fail. One entry makes it one Undo, and the restore needed no new code: it walks the payload's tables in foreign-key order, and a payload holding forty annotations is the same shape as one holding a single annotation.

The phrase counts the OWNED items because otherwise a selection containing one id that is not yours would refuse every phrase a reader could possibly type, with no way to find out why. That is the kind of dead end that reads as a broken feature.

A typed confirmation for something the bin makes recoverable looks like belt and braces. It is not: this is the only path in the app that removes many things at once, the friction is the point, and it is unreachable by any gesture.

**Instead of** rebuilding nothing and packing selections into the existing `book`/`quote` kinds, which would have meant a bin row that lies about what it holds. The rebuild is safe here specifically because `trash` is a leaf: nothing references it, and its only foreign key points out at `users`.

**Approved.** Mine, and I approved shipping it only after the bin.

<sub>1.10.0 — `internal/store/migrations/0032_trash_selection.sql` · `internal/httpapi/trash.go` · `internal/httpapi/bulk_handlers.go` · `internal/httpapi/bulk_delete_test.go` · `web/frontend/src/SelectionBar.jsx`</sub>

### A long press means three different things, decided by where it lands

**Decided.** REVERSED from 1.10.0. On a control it is still Tooltip's label. On `.card-text` — the quote and the note — it does nothing at all, so the platform's own text-selection handles come up. Anywhere else on a card it SELECTS that card. Right-click and Shift+F10 keep the menu; a surface with no selection to enter keeps the menu on the press too.

**Why.** 1.10.0 decided "long-press always means menu, with no exceptions" and put touch's way into a selection in a toolbar toggle. Both halves were wrong, and both are only visible under a thumb.

The menu on the press, plus `-webkit-touch-callout: none` on the card, meant a finger could not select half a sentence out of a quote. In an app whose entire purpose is keeping other people's sentences, spending the one gesture a phone has for reaching into text on a menu that already has a ⋯ button two inches away is the wrong trade — and I could not see it from a desktop, where dragging across the words has always worked.

And long-press-to-select is what every photo grid, file manager and mail app on both platforms already does. A toolbar toggle is a mode you have to be told about; the press is a gesture people arrive already knowing.

The region is MARKED rather than inferred. "Is this a text node" is not a question a pointer event can answer, and the two failure directions are not symmetric: too permissive gives you a card you cannot select, too strict gives you a quote you cannot copy out of. `.card-text` is set by `ExpandableText`, `FlowQuote` and `HandNote` rather than by each card, because those three ARE the prose everywhere they appear — a card that forgot the class would be a quote nobody could copy from, with nothing visibly wrong.

A cover tile carries no `.card-text` at all: a poster is a picture, and the title under it is a label rather than prose.

**Instead of.** Keeping the menu on the press and adding a Select toggle to each board's toolbar (the 1.10.0 decision — two mechanisms, one of them undiscoverable). Suppressing the callout everywhere and offering our own Copy in the card menu (reimplementing Look Up, Translate and Search With, badly, forever).

**Approved.** Reversed on the reader's report from a phone. I approved marking the region over sniffing it, and recorded the reversal here rather than editing the 1.10.0 entry.

<sub>1.11.1 — `web/frontend/src/ui.jsx` · `web/frontend/src/flow.jsx` · `web/frontend/src/index.css` · `web/frontend/test/dom/card-menu.test.jsx`</sub>

### Work cards select too, and the bar serves both kinds off one registry

**Decided.** REVERSED from the multiselect plan, which left work-card selection out. Library and Catalogue tiles select by long press, Ctrl/Cmd-click or the tickmark, and the same `SelectionBar` serves both kinds: quotes get colour, tags, one seal, favourite, the quiz toggle and delete; works get fill-the-gaps, a shelf, set-fields, the quiz toggle and delete.

**Why.** The plan's reason for leaving works out was that their bulk endpoints already had a home on the search screen. True, and beside the point: the boards where somebody actually looks at forty books are these two, and the search screen is where you go when you know what you are looking for.

One bar rather than two, because the two selections having almost nothing in common is exactly the argument FOR the registry rather than against it. A colour category is a note about a quote and a work has never had one; a shelf is a fact about a work and a quote has none. Two components would have looked right on both screens and drifted within a release.

**Two bugs this surfaced, both invisible to inspection and both caught by a test.** `useCardMenu` treated the whole tile as a control: a work tile IS a `<button>`, so `closest('button')` matched the card itself and the gesture did nothing at all on either board — quote cards are `div`s and never showed it. And the bar passed a bare `true` where the registry calls a function, as a presence flag for the actions whose control the bar draws itself; that held until something called `run` on one, which the new shelf dropdown did.

**Instead of.** A second bar for works (drift). Selection on the search screen (rows vary in kind there, so one selection would span two registries).

**Approved.** Mine, on the reader's request for the two boards.

<sub>1.11.1 — `web/frontend/src/works.jsx` · `web/frontend/src/SelectionBar.jsx` · `web/frontend/src/actions.jsx` · `web/frontend/test/dom/selection-works.test.jsx`</sub>

### Keeping something out of the quiz is a column on the row, not a flag on the schedule

**Decided.** Migration 0033 adds `review_excluded` to `books`, `movies`, `annotations`, `dialogues` and `utterances`. The rule lives in `reviewSource.where()`, the one string every deck query splices. The API says `review: true|false` — what the reader wants — and inverts it once, at the write.

**Why.** `item_reviews` is where a scheduling fact looks like it belongs, and it is a trap: that table has NO ROW for a quote never reviewed, so excluding an unseen one means inserting a bare row — and four separate queries read "a row exists" as "this card has been seen". Excluding a quote and putting it back would silently promote it from never-seen to seen-and-overdue: a lie about the reader's own history, told by a preference they set for an unrelated reason. There is a test whose whole job is to assert that a round trip changes nothing.

A column on the row also travels for free everywhere a quote already travels — the bin snapshots with `SELECT *`, the account backup does the same, the export carries the row — so three features support it without knowing it exists.

**The flag is on the WORKS too**, because "this book is not for quizzing" is a fact about the book rather than about the forty highlights it has today: exclude a reference manual and the highlight added to it tomorrow is excluded as well, which is what somebody who excluded a manual meant. The deck already joins each child quote to its parent for ownership, so the parent's flag costs one term and no new join.

`where()` is the choke point on purpose. FIVE queries splice it — three candidate fetches, the cards-left count, the status breakdown — and a rule reaching four of them is a badge counting a card the deck will never serve, which reads as the quiz being broken rather than as a filter being inconsistent.

**Instead of.** A flag on `item_reviews` (invents review history). A separate `review_exclusions` table (a fourth polymorphic table with no foreign keys, three more delete triggers, and additions to the bin and the account snapshot — all to store one bit).

**Approved.** Mine. This is the roadmap's "suspend a quote from rotation", built when the selection bar gave it somewhere to live.

<sub>1.11.1 — `internal/store/migrations/0033_review_exclusion.sql` · `internal/httpapi/review_handlers.go` · `internal/httpapi/bulk_handlers.go` · `internal/httpapi/review_exclusion_test.go`</sub>

### Fill the gaps writes only what is empty, which is what lets it skip the preview

**Decided.** `POST /metadata/fill` runs the re-verify fetch, keeps only the diffs whose STORED side is empty, and applies them through the re-verify writer. The predicate decides by TYPE — empty string, zero, empty slice, nil — not by field name.

**Why.** Re-verify asks "what changed?", shows every difference and waits for a human to tick the ones they believe. That is right, because a provider disagreeing with your library is not automatically the provider being correct — and it is completely unusable over forty books, where nobody will adjudicate two hundred diffs to recover a missing publication year.

Writing only into emptiness is what makes the operation safe without a preview: a description you wrote is never touched, and a title is `NOT NULL` and therefore never missing, so it can never be rewritten. That safety is the whole reason this can be one button in a selection bar rather than a console with a diff table in it.

Deciding by type rather than by field name means a field added to re-verify tomorrow gets the right treatment here without anybody remembering this file exists — and an unrecognised type answers "not missing", so the failure direction is "declined to fill" rather than "overwrote something".

**Instead of.** A "fetch metadata for all" that applies everything (would silently overwrite hand-corrections, which is the one thing this app must never do). Extending re-verify with an "apply all" button (same overwrite, one click further away).

**Approved.** Mine, and I approved the empty-only rule as the load-bearing part rather than the batching.

<sub>1.11.1 — `internal/httpapi/metadata_fill.go` · `internal/httpapi/bulk_works_test.go`</sub>

### Home's favourites reorder once per visit, not once per reload

**Decided.** One seed drawn when Home mounts, spent through `shuffleSeeded`, which ranks each favourite from that seed and its OWN KEY rather than by walking the list. The clamp heights are seeded off the same draw.

**Why.** The wall reordering is deliberate — it is a re-surfacing wall, not a feed — but it reordered on every LOAD, and every in-place edit reloads it. Recolouring one quote redealt the whole wall: the four tiles on screen became four different tiles and the card just acted on was gone, which reads as the app losing the change rather than saving it.

A per-item rank rather than Fisher–Yates because that is the property that survives the list changing: drop one member from a walk-the-list shuffle and the permutation is entirely different, so un-hearting one tile would still redeal everything. Ranked independently, a removed card leaves a gap and everything else stays where the reader last saw it.

**Instead of.** Shuffling once and caching the array (moves the problem to the next remount, and cannot place a newly-hearted quote). Not shuffling at all (loses the feature).

**Approved.** Mine, on the reader's report.

<sub>1.11.1 — `web/frontend/src/ui.jsx` · `web/frontend/src/Home.jsx` · `web/frontend/test/pure/seeded-shuffle.test.js`</sub>

### The selection bar is three glyphs and an overflow, and which three is a decision in the registry

**Decided.** Every bulk action now carries `where: ROW | OVERFLOW` and an `icon`, the same two fields the item list has carried since the card grew a ⋯. Three stand in the row — for quotes the colour, the ♥ and the quiz toggle; for works fill-the-gaps, the shelf and the quiz toggle — and everything else folds behind a ⋯, Delete included. A test asserts the row holds exactly three.

**Why.** The bar shipped with four word-buttons and left 1.11.1 with eleven controls: colour dots, a tag field, a tag button, Seal, Favourite, a shelf dropdown, Fill gaps, Skip in quiz, Delete, Deselect all, ✕. Every one was added for a good reason, and none of them is the one that broke it — because nothing broke. It became, on a phone where the bar is pinned under the header at a fixed height, a strip wider than the phone, one release at a time. There was no error, no failing test and no screenshot; the only signal was a reader saying it looked crowded.

WHICH THREE lives in `actions.jsx` rather than in the component that draws them, for the same reason the action list itself does: the bar would otherwise be a second place with an opinion about what matters, and the two would drift the first time somebody added an action to one of them. The exactly-three assertion is what makes the strip's width a rule rather than a habit — a fourth fits on a desktop and pushes the count off the screen on a phone, silently.

The three that fold away were not picked for being unimportant. Each needs something MORE from you before it can run: tags need a keyboard, the seal needs a picture chosen, Delete needs a phrase typed. The tag field standing open in the row was the widest control in the strip and was open on every selection whether or not anybody meant to type into it — on a phone, one stray tap from a keyboard.

**The quiz toggle's picture flips with its label**, and that stopped being optional the moment the words came off. "Skip in quiz" / "Add to quiz" was doing two jobs — naming the action and reporting which way round the selection is — and a single fixed glyph keeps the first and silently drops the second. The button still works, which is why it would have survived review. It is the only reason the icon set holds two drawings that are nearly the same picture on purpose.

**Edit joins the bar at exactly one, and Set fields at two upwards.** They are mirror images and are never offered together: over one work the work's own form is strictly better, over several there is no single form to open. Edit stays `single: true` on the item side — this is not editing a selection, it is editing the one thing in it. It is dropped rather than greyed at two, because a disabled item in a menu is a thing to wonder about.

**The card's own ⋯ is untouched.** Removing it was on the table and was rejected by the reader: multiselect is an added way in, not a replacement, and a card that lost its overflow would have left Edit unreachable on a phone — the long press there selects, and there is no right-click to fall back on.

**Instead of.** Smaller buttons or a scrolling strip (postpones the same problem and makes the count scroll away). A second bar for phones (two components, one of them only ever seen by the author on a resize).

**Approved.** Mine on the shape, the reader's on which three and on keeping the card's ⋯.

<sub>1.12.0 — `web/frontend/src/actions.jsx` · `web/frontend/src/SelectionBar.jsx` · `web/frontend/src/ui.jsx` · `web/frontend/test/dom/selection-bar.test.jsx`</sub>

### The wishlist folder is a door to the chip, not a place things live

**Decided.** An optional tile at the front of the Library's flat board, folding every book with zero quotes into one cover — a collage of the first four. Opening it switches to the `wishlist` chip that has existed since 0024. Persisted, off by default, flat board only, and not selectable.

**Why.** The wishlist is derived and stays derived (see the entry above): a work with zero annotations *is* the wishlist, no column, no bookkeeping. That decision solved *browsing* them and did nothing about the real complaint, which is that they are IN THE WAY. Forty unopened covers scattered through a grid of books you have read is forty tiles of noise between the ones you are looking for, and the chip only helps when the wishlist is what you came for.

So the folder holds nothing. It is a rendering of a filter — open it and you are in the chip. That is what keeps 0024's property intact: a folder with its own membership would be exactly the second source of truth the derived wishlist was chosen to avoid, and it would drift the first time somebody quoted a book while the folder was on screen.

**Not selectable**, and this is the part that would have been wrong the other way. A tick in its corner would have to mean "select the twelve behind it" — a different act from every other tick on the board, over rows the bar cannot count because they are not on screen. The bar's whole invariant is that its count is a count it can act on.

**Flat board only.** Inside the wishlist chip there is nothing to fold away from; grouped by author or series, a "Wishlist" folder would appear inside each bucket meaning "the unquoted ones by Borges", which is a different thing from the folder on the flat board and looks identical.

**Persisted, and Reset leaves it alone.** It is not a question about this visit — it is how you want your board drawn, the same class as the cover size. Off by default because a grid that silently rearranged itself on upgrade is a library that looks like it lost books.

**Instead of.** A real `wishlist` collection with membership (the second source of truth 0024 refused). Hiding the unquoted outright (loses them). Folding on the Catalogue too — not asked for, and the film side's board has different pressure on it.

**Approved.** The reader chose the derived version over an explicit one, having been shown both.

<sub>1.12.0 — `web/frontend/src/works.jsx` · `web/frontend/src/Library.jsx` · `web/frontend/src/index.css` · `web/frontend/test/dom/wishlist-folder.test.jsx`</sub>

### A long empty stretch of the timeline keeps its width and earns it

**Decided.** A run of six or more empty buckets folds into ONE element occupying exactly the width the columns it replaces would have had. Inside it: year markers, never closer than ten buckets and never more than five of them, and one unattributed line about the fact that nothing in all of that is on your shelf — chosen as the longest from a length-sorted set that fits the width.

**Why.** Drawing the empty buckets was already the right call: it is what makes 380 BCE and 1600 CE read as two millennia apart rather than as two adjacent bars. What it did not do was make the emptiness worth its width. A library holding *Meditations* and then a shelf of 2020 paperbacks draws about a hundred and eighty identical blank columns, and a hundred and eighty blank columns is not a silence you read — it is a stretch of nothing you scroll past looking for the next dot, and it teaches you to stop reading the axis.

**THE WIDTH IS THE LOAD-BEARING PART.** Folding the run to a fixed band was the obvious alternative and is the one thing that must not happen: two millennia and two centuries would then draw the same, which is precisely the failure the empty buckets were introduced to prevent. So this compresses the DRAWING and never the scale, and `gapWidth(span) === span × 34 − 4` is asserted rather than eyeballed.

**Where the gaps fall is derived, not stored.** `timelineSegments` is a pure function of the bucket list, so switching decades to centuries turns a hundred and eighty empties into eighteen — under the threshold at that scale, drawn as plain columns again, with no rule written for it. Below six the blanks read perfectly well as blanks, and a caption squeezed into four columns is worse than the four columns.

**The lines are unattributed and written for the app.** An app whose entire subject is quoting people accurately must not be the one place in it inventing an attribution, and there is no field in a chart to record a real source in even if one existed. A test refuses any line shaped like a byline. They are chosen by fit and seeded off the gap itself, so a gap keeps its line across re-renders and three wide gaps on one chart do not print the same sentence three times.

**Markers ride inside the emptiness, on the plot area**, not on the tick row. On the tick row they would read as the labels of the columns either side, which is the one thing a marker in here must not do. They stay off both ends for the same reason.

**Instead of.** Collapsing long gaps to a fixed band (breaks the scale). A logarithmic axis (breaks it differently, and silently). Dropping the empties (the 0024 decision, already rejected).

**Approved.** The reader chose "keep the width, fill it" over collapsing, having been shown both.

<sub>1.12.0 — `web/frontend/src/StatsPage.jsx` · `web/frontend/src/index.css` · `web/frontend/test/pure/timeline-gaps.test.js`</sub>

### The Quotes page splits three ways, on one tab rather than three

**Decided.** Migration 0035 gives a standalone quote a `category` (proverb · speech · other), a `language` and an optional `translation`. The Quotes page becomes three boards behind a segmented control, keeping its single nav tab and its `/quotes` URL. `api_revision` 5, features `quote-categories` and `proverb-starters`.

**Why.** 0026 built one table for "a line from a speech, a letter, an interview, a song, a proverb, something a friend said" and one board to show them in. That is right for one kind of thing and wrong for three: a proverb has no speaker, no occasion, no date and no place, so it lands in the residual bucket of every grouping the screen offers, and a shelf of proverbs sits mixed into a shelf of speeches with nothing to tell them apart.

**One tab, not three, and the phone decided it.** Three top-level tabs was the first plan, and `routes.test.js` asserts `BOTTOM_TABS` equals `CONTENT_TABS` — an invariant that exists because 1.5.0 shipped Quotes missing from the drawer. So three boards as tabs necessarily means six glyphs in the phone's bottom bar, about 52px each at 360px. The reader rejected it in those terms. A segmented control inside the page costs no nav surface, no new URLs and no routing, and every bookmark, the drawer, the ＋ and the PWA shortcut keep working.

**The default is `other`, and that is a migration decision rather than a UI one.** It is the column default 0035 chose over guessing from `medium`, so the board opens showing an existing library exactly what it showed before the split. Promoting anything whose medium says "speech" would reclassify somebody's library on upgrade, silently, with no way to see what it moved.

**None of the three folds into the dedupe hash.** The occasion is part of what a quote IS — the same words on two occasions are two quotes, which is 0026's own inversion of the usual rule — while the category is where you decided to file it. A line moved from Others to Proverbs is one saved line under a different heading. The cost settles it either way: the hash is a SHA computed in Go, so folding category in would stale every hash on disk and need a Migrate-time backfill over `utterances` and `staged_quotes` plus four call-site changes, one of them the rehash that runs after a speaker rename.

**`translation` is indexed; `category` and `language` are not.** Somebody searching a shelf of Bengali proverbs types the English, because the English is the half they can type. The other two are filter values rather than prose — indexing them would let a search for "proverb" return every proverb, above the quote actually about proverbs.

**`?category=` is validated and `?language=` is not**, which reads like an inconsistency and is the point: the three categories are a closed set, so asking for a fourth is a client bug an empty board would hide, whereas the set of languages is the reader's and an unknown one is legitimately empty.

**The silent-loss site, found before it shipped.** `utteranceState` builds a full-state PUT and feeds the ♥, the colour dots and the selection bar. Without the three new fields in it, recolouring a Bengali proverb would have cleared its category, its language and its English, with a successful save and no error — the identical trap 1.12.0 records catching `translator` on `bookState`. Four tests hold that object shut, asserted field by field.

**Instead of.** Three nav tabs (above). A free-text "kind" field (unfilterable, unsplittable). Reusing `medium` (it answers a different question, and a proverb has no medium).

**Approved.** The reader's, including the correction from three tabs to one page after being shown what six bottom-bar buttons would cost.

<sub>1.13.0 — `internal/store/migrations/0035_quote_categories.sql` · `internal/httpapi/utterance_handlers.go` · `internal/httpapi/seed_proverbs.go` · `web/frontend/src/Quotes.jsx` · `web/frontend/test/pure/remap-labels.test.js`</sub>

### Starter proverbs are opt-in, per language, and that is the whole design

**Decided.** Thirty curated proverbs ship in the binary — ten Bengali, ten Hindi, ten English — behind `GET`/`POST /quotes/starters`. They are written only when asked for, one language at a time, from an offer that appears on an empty Proverbs board.

**Why the restraint is the feature.** Every other seeder here — `seedDefaultStickers`, the starter tags — has a boot hook, a backfill for existing accounts and a settings flag marking the one-shot done. This has none of the three, deliberately. A starter sticker is a TOOL: five marks to put beside a line, and handing them to everyone costs nothing because nobody's library is a library of stickers. A proverb is CONTENT. Putting thirty lines somebody never chose into a collection they have kept for a year is not a friendly default, it is the app writing in their book — and the Bengali board then opens onto a shelf that is entirely mine and none of theirs.

**Idempotent through the ordinary dedupe hash, not a flag.** They are plain `utterances` rows, so asking twice adds nothing and the count says "already there" rather than implying a second copy. The consequence is written down rather than left to be discovered: a starter proverb you deleted comes back if you ask for that language again, which is the honest behaviour for a button that says "add the Bengali ten" and is only ever reachable by asking.

**Every seeded line is unattributed, and that is enforced.** A proverb with an author is somebody's aphorism, and the review deck reads exactly that absence — no speaker and no occasion — to keep these out of the quiz, where there would be nothing to recall but the words on the card. A test refuses any curated line shaped like a byline, and another refuses a set that is not ten distinct non-empty lines with an English translation on everything not already English.

**The offer is served, not hardcoded.** The count on the button and the set that actually lands would otherwise be two lists to keep in step, and the one that drifts is the one nobody tests.

**Instead of.** Seeding on signup (content nobody chose). Seeding all three languages at once (asking for Bengali is not asking for Hindi). Shipping them as a Markdown file to import (an import is staged, reviewed and approved — three steps for a button).

**Approved.** The reader chose opt-in per language over both a signup seed and a single all-languages button.

<sub>1.13.0 — `internal/httpapi/seed_proverbs.go` · `internal/httpapi/seed_proverbs_test.go` · `web/frontend/src/Quotes.jsx`</sub>

### One control family, so "Button labels" governs the whole app

**Decided.** `IconButton` and `MoreMenu` take an optional `label` and render the same `.btn-icon` + `.btn-label` pair `Button` does. The selection bar's actions carry their words, and its count became a button whose glyph is the number and whose label is "Deselect all".

**Why.** The setting claimed to govern the app and governed a minority. Controls split into two families and membership was accidental: `Button`, `StickerButton`, `FilmButton` and `FilterChip` emit the span the stylesheet clips; `IconButton`, `MoreMenu`, `CloseButton` and an icon-less `GhostButton` emit no span at all, so there was nothing for Show to reveal and nothing for Hide to clip. Counted: 31 of ~123 primitive uses honoured the preference, 78 could not, and 213 raw `<button>` elements bypass every primitive — 44 of them inside `ui.jsx`. The selection bar was built entirely from the family that cannot, which is the row with the least room and the one where the preference matters most.

**No new CSS was needed, and that is the sign the seam was already right.** `.btn-label` is deliberately not scoped to `.tp-btn` — that is what lets another control opt in — and `.tp-btn.has-btn-icon` squares back to the same 44px `IconButton` uses unlabelled, so a labelled row lines up with an unlabelled one. The label is opt-in, so all 25 existing uses are byte-identical.

**The count is the control.** A sentence saying "12 books selected" beside a worded `Deselect all` was one idea drawn twice, on the bar least able to afford either. Merging them also separated the two that were adjacent: `Deselect all` and `✕` side by side read as the same control twice, and the one that ends the mode is the one you reach for by accident.

**Zero is spoken rather than shown.** The badge reads `0`, dimmed and disabled, and its accessible name is "no books selected". The older rule — that a zero in a count reads as something having gone wrong — still holds for a bare number in prose, but the reason has to live where it survives the words being clipped.

**The test pins the mechanism, not the appearance.** Whether a word is visible is CSS and a preference, neither of which jsdom can see, so the assertion is that the word is in the span the stylesheet clips, on a button carrying the class that squares it. The `⋯` is asserted to have no label: "More" beside three dots is the same thing said twice.

**Not done here.** The remaining ~75 non-participating controls and the 213 raw `<button>` elements. Named as a known gap rather than left implied.

**Approved.** The reader chose one family over fixing the selection bar alone, having been shown the count.

<sub>1.13.0 — `web/frontend/src/ui.jsx` · `web/frontend/src/SelectionBar.jsx` · `web/frontend/test/dom/selection-bar.test.jsx`</sub>

### Info dots are what the control does plus one consequence, and it is enforced

**Decided.** An info dot's copy is capped at 240 characters and three sentences per branch, checked by `test/pure/infodot-copy.test.js`. Seventeen were rewritten; the longest went from 988 characters to 281.

**Why.** The five-word rule works — of 162 tooltip labels only five exceed it, each by one word — but it has an unbounded consequence nobody had noticed: longer copy was told to go and live in an info dot, and nothing ever constrained an info dot. They grew to 400, 700, nearly a thousand characters, and what filled them was consistently RATIONALE rather than instruction. One spent 680 characters on a switch whose behaviour takes 90.

**That reasoning already has a home — this file.** `docs/PLAN.md` exists to hold it at whatever length it needs. A popover attached to a control is not that place: it is read once, standing up, while the reader is deciding whether to press the thing.

**Mechanical, like the icon-geometry check, because "is this line necessary" is a judgement that quietly stops being made once nothing checks it.** Measured per BRANCH so a ternary whose book and film cases differ is not penalised for doing the right thing, and the suite asserts it found more than 25 dots — an extraction that silently matched nothing would turn the whole file into a no-op reporting success. It caught one of the rewrites at four sentences.

**Instead of.** Tightening the prose without removing any line (the padding IS the rationale, so it would not have fixed the feel). One sentence, hard stop (a few genuinely load-bearing warnings, like the password doubling as the backup key, would have had to move to the help screen rather than vanish).

**Approved.** The reader's, in the form "every line must pass a rigour test — is it absolutely necessary for the understanding?"

<sub>1.13.0 — `web/frontend/test/pure/infodot-copy.test.js` · `web/frontend/src/share.jsx` · `web/frontend/src/Account.jsx` · `web/frontend/src/Settings.jsx`</sub>

### A book has three credits, and the other two are people rather than strings

**Decided.** Migration 0034 adds `translator` and `editor` to `books` (and to `staged_works`). Both are `people` kinds alongside author, actor, director and speaker, so they carry portraits, bios, links, renames and the orphan sweep. They appear on the book's own page, role-labelled `tr.` and `ed.`, and on no other screen. `api_revision` 4, feature `book-credits`.

**Why.** A book has carried exactly one credit since 0001, and for a library built around reading in translation that is the wrong number: the Garnett Dostoevsky and the Pevear Dostoevsky are different books to read and were identical books to this schema. An anthology's editor is the same gap facing the other way — the person who chose what is in it is often the reason you own it.

**Two columns, not a `book_credits` join table.** The textbook shape was rejected because `author` would stay where it is — forty query sites read `books.author`, and the FTS index is built on it — so the result is one credit in a column and two in a table: two mechanisms for one idea, and the join table is the one that rots, being the one nothing else reads. A third role would change the argument; two does not carry it.

**Where they DON'T appear is the requirement, not an omission.** Not on the Library board (a tile has room for one credit); not on a quote's chips (a quote belongs to whoever wrote it); not as stats categories. The list endpoint does not even serialise them, so the board cannot draw them by accident, and a test asserts their absence — putting them there later has to be a decision made against a failing test.

**Four silent-loss sites, and the last one nearly shipped.**

1. The full-state PUT. `bookState()` on the client feeds the ♥ on the detail header; a field missing from it is a field cleared by favouriting a book.
2. `handlePeopleNames` was `q := <books.author>` followed by overrides — the exact default-plus-overrides shape `orphanRefQuery`'s own twenty-line header warns about, still live in a third function nobody had swept. Asking for translators would have answered with every AUTHOR in the library, tallied, named as translators, and offered for renaming.
3. `resolvePersonPortrait` falls through to the Open Library path, disambiguated by `authorBookTitles` — books whose AUTHOR matches the name. A translator gets an empty title list and resolves undisambiguated, which looks exactly like the provider having no record of them. It takes a column now.
4. **`staged_works`.** The reasoning against it was nearly convincing: no third-party importer carries a translator, so the column could only ever move an empty string. What that skips is that Tippani's OWN export is an importer's source and EVERY import is staged — so the field survived the export, survived the parse, and was dropped on the way into the queue. Export a library, import it back, lose every translator, with a successful import and matching counts saying nothing happened.

**Deliberately NOT in `books_fts`.** Adding a column to an FTS5 external-content table is a DROP and CREATE of the virtual table, its three triggers and its vocab shadow plus a full reindex — and `store.Recover()` and `rebuildFTSTable` both find FTS objects by name pattern, so a rebuild has to land exactly on the old names or it breaks a repair path nobody exercises until they need it. Real risk for scope nobody asked for. Translators are `people`, so the People console finds them.

**Also not filled by re-verify or fill-the-gaps.** No provider reliably carries a translator, so what is there is what you typed.

**Instead of.** A `book_credits` join table (above). A generic "contributors" free-text field (unsearchable, un-renameable, not people).

**Approved.** The reader's, in their own words, including the rule about where the chips may and may not appear.

<sub>1.12.0 — `internal/store/migrations/0034_book_credits.sql` · `internal/httpapi/people_handlers.go` · `internal/httpapi/portrait_handlers.go` · `internal/httpapi/import_staging.go` · `internal/httpapi/book_credits_test.go`</sub>

### The changelog ships inside the binary rather than being fetched

**Decided.** `internal/changelog` embeds a copy of `CHANGELOG.md`, parses it into releases → sections → entries, and `GET /changelog` serves it. A dialog on the Updates card shows it newest first, with the running build marked. Entries stay as markdown and the client renders the three inline spans by hand.

**Why.** The request was "fetch it from git", and the shipped artifact cannot: the image is `distroless/static` with one binary in it, no git and no shell, `.git` and the docs are outside the build context, and the CSP has no `connect-src` so the browser cannot call GitHub either. The two real sources are the embedded file and GitHub's HTTP API.

Embedded wins on the thing this app is actually for. The promise is stated in three places and is load-bearing — "zero background jobs", "nothing external is required to run", and §193's "Tippani never contacts the network on its own", whose own justification is that it is the honest reading of self-hosted. A changelog that is blank on a LAN-only NAS, behind a firewall, or after the update check has spent the hour's 60 unauthenticated GitHub requests is blank in exactly the situation the product optimises for. And a changelog is a fact about the binary you are RUNNING, not about the internet: the embedded copy answers that exactly, forever, offline. Notes for a version you have not installed are a different question, and the card already answers it with a link — which stays.

**The copy is the cost, and the drift test is the price paid for it.** `//go:embed` cannot reach outside its package and there is no Go package at the repo root, so the canonical file cannot be embedded from `internal/changelog`. Two copies of anything is a drift surface and this repo already lost that fight once with `web/dist`. So the alarm shipped in the same commit as the copy: a test reads `../../CHANGELOG.md` and fails with the fix in its message, `make changelog` does the copy, and the release checklist gained a step.

**Parsed in Go, rendered in React.** The structure — where a release starts, which section a bullet is in, and crucially which continuation paragraphs belong to which bullet — is done server-side, because a naive line-splitter flattens or drops those paragraphs and the failure is silent. The inline spans are done client-side in thirty lines, because there is no markdown dependency in this frontend and no `dangerouslySetInnerHTML` anywhere in it, and adding either for a dialog opened twice a month is a poor trade. Anything the renderer does not know is shown verbatim: for a changelog that is honest, you just see the asterisks.

**Not admin-gated**, though the button is on the admin-only Updates card. Release history is published on the internet; gating the endpoint would stop a second user on the same instance ever being shown what changed.

**Instead of.** Proxying GitHub's `/releases` (elegant — `release.yml` already puts each version's section in the release body, so it arrives pre-split — but empty offline, and it widens a claim the docs make). Shelling out to git (impossible in the image). A markdown library in the frontend (a dependency and an HTML-injection surface for one dialog).

**Approved.** The reader chose embedded, having been shown that "from git" is not literally possible in the shipped artifact and what each real source costs.

<sub>1.12.0 — `internal/changelog/changelog.go` · `internal/httpapi/changelog_handlers.go` · `web/frontend/src/Settings.jsx` · `web/frontend/test/dom/changelog-dialog.test.jsx`</sub>

### A timeline label is a year, and a year has to be readable and honest about its scale

**Decided.** The column ticks move off `--font-mono` to `--font-ui` at 10.5/500, the tick row grows 46 → 58px with `.tl-row` growing by the same 12 so the plot keeps its 110px, `slashed-zero` is removed from the gap markers, and `bucketLabel(start, size)` replaces `decadeLabel` everywhere the scale is not a decade. `test/pure/timeline-metrics.test.js` holds the stylesheet against `StatsPage.jsx`.

**Why.** 1.13.0 was asked to fix "8 and 0 look exactly the same" on this chart. It changed the year markers *inside* a folded gap, wrote a long comment about why the mono face was wrong for them, and left the ticks under every column — the labels anyone actually reads, one per bucket — at mono 9px. The report came back unchanged, correctly. Fixing an instance of a problem and describing it as the class is the failure worth naming here: the comment I wrote made the remaining case harder to find, because it read as though the work was done.

**The ticks were the worse of the two cases all along.** `writing-mode: vertical-rl` turns every glyph on its side, so a digit is read by outline alone, which is what survives least at 9px. Plex Mono also draws its own 0 with a slash. That slash is the typeface's zero rather than a setting, so no `font-variant-numeric` can lift it — changing the face is the only fix that exists.

**And the release made the gap markers worse.** It set `font-variant-numeric: slashed-zero` there as a free enhancement: inert if the `@fontsource` subset had dropped the `zero` feature, clearer if it kept it. It kept it, so a face chosen *because* its 0 and 8 differ by outline had a stroke put back through the 0. The general lesson, since it cost a release: a typographic setting whose effect you cannot see is not free. It is an untested change carrying a comment about why it needs no test.

**The height was a clip nobody had reported.** 46px never fitted "480s BCE" at any readable size, so the oldest label in a library was the one being cut off. `.tl-row` grows in step because the plot's height is the remainder — 172 − 58 − 4 = 110px, which is what `TIMELINE_MAX_DOTS` = 12 at a 9px pitch means. Raise one number alone and the twelfth dot is clipped, which looks exactly like a column that had eleven.

**Four numbers now agree by test rather than by comment.** The column pitch a folded gap is measured in (`TL_COL_PX` against `.tl-col`'s min-width — a gap drawn at the wrong width still draws, and the chart starts lying about time with nothing looking broken), the room the dots need, the two tick heights that are one row, and the year labels' face and size. Every one of them fails silently.

**Approved.** The reader's, in the form "the timeline font is not fixed. 8 and 0 are still identical. i think that is because you are using a font that uses a slanted slash for 0" — which named the slash I had added.

<sub>1.13.2 — `web/frontend/src/index.css` · `web/frontend/src/StatsPage.jsx` · `web/frontend/test/pure/timeline-metrics.test.js`</sub>

### A decade is a door; a year and a century are deliberately not

**Decided.** A decade tick with something under it is a button opening that decade's works in Search, as is the "Most quoted decade" superlative. `bucketQuery(start, size)` returns the query or `null`, and it returns `null` at year and century scale. The chart asks with a zero-padded year (`0050s`); `parseDecade` learns BCE.

**Why.** Every other number on the Stats page opens the rows behind it — a breakdown row, a day on the activity calendar, seven of the eight superlatives. The chart answering "when is my library FROM" answered it and stopped, and the eighth tile named a decade and did nothing with it, though the server has understood `1990s` since the decade facet shipped. Nothing on the page ever asked it.

**The refusals are the design.** A bare year cannot go through the query box at all: `1984` is a book people own, and teaching search to read four digits as a span would take that search away to pay for this click — the search is worth more. A century is worse than unsupported, because `1900s` *parses*, as the decade: a column covering a hundred years would return ten of them and look like a complete answer. **A control that returns a confident wrong answer is worse than one that is not there**, because nothing on the wrong page says so. So the door exists exactly where the server can answer the column that was clicked.

**The shorthand would have misfiled the oldest thing in a library.** `90s` means the 1990s to the server, rightly, for somebody typing it. That makes the label unsafe to send: a column for the 50s CE — which a library holding a gospel really has — would have opened a shelf of mid-century paperbacks. The query is zero-padded because four digits cannot be a shorthand, and the facet still reports itself as `50s` because the server labels the range rather than echoing the query. The label is for reading and the query is for the server, and for a short year they are deliberately different strings.

**The parser learns BCE because the chart writes it.** A form the app produces itself and cannot read is a control that leads nowhere, and the one column it would have failed on is the one holding the oldest thing on the shelf. Nothing is titled "380s BCE", so no search is lost. The era also suppresses the two-digit shorthand on its own, since "80s BCE" cannot also mean the 1980s.

**Instead of.** Making every tick clickable (the century case would have been wrong, not empty). Adding a `year:` query syntax (a vocabulary to learn, for one click). Generalising the facet to any span (the bare-year collision survives it).

**Approved.** The reader's, in the form "and clicking on a decade should search for it as well."

<sub>1.13.2 — `web/frontend/src/StatsPage.jsx` · `internal/httpapi/search_handler.go` · `internal/httpapi/search_decade_test.go` · `web/frontend/test/dom/stats-timeline-link.test.jsx`</sub>

## 15. Appearance as Material: Skins, Texture, Type and Colour

The look is not decoration sitting on top of the app; it is a set of decisions with
tests, escape hatches and a migration behind them. This section exists because a
completeness pass over the other sixteen found that the most-argued family in the
project — what the thing is made of — had no home in any of them, which is how a
decision quietly becomes a preference.

### Two aesthetics × light/dark × four accents, and no more axes than that

**Decided.** `paper` and `film`, each in light and dark, with the accent chosen from
exactly four: terracotta, ochre, olive, slate. Everything else is derived. `theme.js`
holds each palette as literal tokens and writes them onto `<html>` as data attributes and
CSS custom properties.

**Why.** Two aesthetics are two arguments about what a commonplace book *is* — a paper
one and a film one — and they earn their keep because the app holds two kinds of thing.
Light and dark is not a preference, it is a room. The accent is the only free choice,
kept to four because a free colour picker produces a shelf of near-identical blues, and
because every accent has to work as a fill, a hairline, a focus ring and text on both
surfaces in both aesthetics.

**Instead of.** A free hex accent, which I turned down for the reason above; and one
aesthetic with a density toggle, which would have been cheaper and would have made the
film side a smaller paper side rather than its own thing.

**Approved.** Mine, from the UI instruction sheet onwards, and the four-value cap is the
part I would defend hardest.

<sub>pre-1.0 — `web/frontend/src/theme.js` · `web/frontend/src/index.css`</sub>

### The textures are real tiles, blended — not gradients pretending

**Decided.** Six grayscale WebP tiles — paper, wood, metal, glass, fabric, rubber — are
blended into cards, buttons, thumbs and the shell. The accent controls carry grain: leather
(`fabric.webp`) on paper, rubber (`rubber.webp`) on film.

**Why.** A CSS gradient reads as a gradient at any size; a real tile reads as a surface.
The cost is six small files and one blend mode, which is affordable on a page that is
already sending fonts, and nothing about it touches the server.

**Instead of.** Procedural noise via SVG `feTurbulence`, which is what the app mark uses.
Rejected for surfaces because it is recomputed per element per repaint, and this app is
budgeted on the assumption that the *client* can spend what the NAS cannot — but not
without limit.

**Approved.** Mine. It is the single most visible decision in the app and the one people
notice first.

<sub>pre-1.0 — `web/frontend/src/textures/` · `web/frontend/src/index.css`</sub>

### Every decorative layer drops to zero on `prefers-contrast` or `prefers-reduced-transparency`

**Decided.** Under either media query the page grain, the scenic backdrop, the card
tiles, the dither, the shell tiles and the accent grain all go to zero. Nothing structural
moves: borders, lifts, colours and layout are untouched. `accent-texture.test.jsx` reads
the stylesheet and fails when a textured surface has no entry in that block.

**Why.** `.grain-overlay` is a fixed layer at `z-index: 60` — it multiplies over every
glyph and every input on the screen. At 5.5% opacity that is the whole point of the design
for most readers and 5.5% of noise standing between the text and someone who has asked
their operating system for more contrast. Those two media queries are the two ways a
person says so, and neither was honoured anywhere in the file.

**Reversal.** Of an omission rather than a decision, and the trigger matters: this landed
in 1.6.0 rather than with the accessibility work it belongs to, because 1.6.0 added six
more textured surfaces and shipping those with no way off was not defensible. What is
left — raising ink and hairline contrast to WCAG AA, and an in-app switch for a reader
whose OS is not set that way — is on the roadmap under
[access &amp; reading comfort](roadmap.html#access).

**Approved.** Mine, and I approved pulling it forward rather than letting the release ship
without it.

<sub>1.6.0 — `web/frontend/src/index.css` · `web/frontend/test/dom/accent-texture.test.jsx`</sub>

### Five self-hosted families in semantic roles, and a Bengali one that is not decoration

**Decided.** Newsreader, Hanken Grotesk, IBM Plex Mono, Caveat and Noto Serif Bengali,
all self-hosted through `@fontsource` and imported in `main.jsx`, each bound to a role
rather than to a screen.

**Why.** Self-hosted because the app's CSP is `default-src 'self'` and a font CDN is an
outbound request on every load — which fails both the no-phoning-home rule and the
offline case. Roles rather than screens because a font chosen per screen drifts; a font
chosen per meaning cannot. The Bengali face is there because the app is named টিপ্পনী and
a wordmark that falls back to tofu is worse than not having one.

**Instead of.** A system font stack, which costs nothing and would have made the two
aesthetics indistinguishable — the type is half of what separates them.

<sub>pre-1.0 — `web/frontend/src/main.jsx` · `internal/httpapi/server.go`</sub>

### `font-src` allows `data:`, and the reason is a silent failure

**Decided.** The CSP is `default-src 'self'` with `font-src 'self' data:` carved out.

**Why.** Vite inlines `@fontsource` subset files under about 4 KB as base64 `data:` URIs.
Without the carve-out `default-src` blocks them and those glyphs fall back to a system
face **silently** — no console error a user would see, no broken layout, just slightly
wrong letters. A `data:` font is inert: parsed, never executed, the same reasoning that
already applied to `data:` images.

**Approved.** Mine, and I widened the policy rather than fighting the bundler, because
the alternative was a rule that looked stricter and shipped worse type.

<sub>`internal/httpapi/server.go`</sub>

### The colour-category palette is curated, and deliberately disjoint from the accents

**Decided.** A category colour is picked from a fixed list of sixteen named swatches, not
a free hex field. The list avoids not just the four accent values but the whole
ochre / terracotta / olive / slate neighbourhood. `palette.test.jsx` holds it there.

**Why.** The point of a category colour is that several of them are distinguishable at a
glance, and that survives about as long as the first two near-identical blues. Keeping
them clear of the accent range means a category can never be misread as the app's own
accent — a same-hue collision on a filter chip is exactly where that goes wrong.

**Instead of.** A free hex field, which is what every app that has this feature offers,
and which is the reason their palettes look the way they do. And a mere exact-value
exclusion, which would have passed review and failed in use, because "not the same hex"
is not "tells apart".

**Approved.** Mine, and I approved pinning it with a test rather than a comment, since
"these look different enough" is the kind of judgement that stops being true when someone
adds a sixteenth swatch.

<sub>1.7.0 — `web/frontend/src/theme.js` · `web/frontend/test/dom/palette.test.jsx`</sub>

### A category name is capped at fifteen runes, counted in runes, and lowering it is not retroactive

**Decided.** Fifteen. The cap lives in `theme.js` as `CAT_NAME_MAX` and is enforced again
server-side, and it is counted in runes rather than UTF-16 units.

**Why.** Fifteen is not a round number — it is what fits the Stats page's colour label
column without wrapping, which is the narrowest place a category name is drawn. Deriving
the cap from the narrowest consumer means the two cannot drift. Runes because a
UTF-16 count truncates a Bengali or emoji name mid-character.

**Reversal.** It was twenty-four first, and the reduction came from looking at the Stats
column rather than from a principle. **Lowering a cap is not retroactive**: names already
stored at more than fifteen keep their length, because silently truncating data a user
typed is worse than an inconsistent column. New and edited names take the new cap.

**Approved.** Mine, on being shown the wrapped labels.

<sub>1.7.7 — `web/frontend/src/theme.js` · `internal/httpapi/auth_handlers.go`</sub>

### Theme, colours and label density are applied before the first paint

**Decided.** `main.jsx` runs `applyTheme`, `applyColors` and `applyLabels` before
`render`, not inside a `useEffect`.

**Why.** Anything applied after mount is a frame of the wrong thing. On a phone that
frame is fully labelled buttons snapping to glyphs, and on a dark-theme device it is a
flash of paper-light — both of which read as a bug rather than as a load.

**Approved.** Mine, and the ordering in that file is load-bearing enough to be commented
as such.

<sub>`web/frontend/src/main.jsx`</sub>

### Every label is five words or fewer, and longer copy goes behind an info dot

**Decided.** A house rule with a test: `button-labels.test.jsx` and `labels.test.jsx`
check it, and a bubble that needs a paragraph is an info dot instead.

**Why.** The label bubble is measured and placed in script, anchored to its control and
clamped on both axes — a long one is a layout problem before it is a reading problem. But
the real reason is editorial: a control whose name needs a sentence is usually a control
that is doing two things, and the word limit surfaces that rather than papering over it.

**Approved.** Mine, and I enforce it on my own copy first — several rewrites in 1.7.x
were nothing but this rule applied to text that had accumulated.

<sub>1.4.1 — `web/frontend/test/dom/button-labels.test.jsx` · `web/frontend/src/ui.jsx`</sub>

### Six type ROLES, three faces each, and every one bundled

**Decided.** Settings → Type lists the six jobs type does here — quotes, interface, labels, notes, Bengali, Devanagari — each with the built-in and two alternates, and each row **shown doing its own job** rather than setting a specimen sentence.

**Why roles rather than fonts.** A role is what the font is FOR, so swapping one is a line in `fonts.js` and not a search for every place a family name was written down. It is also the only way the picker can say anything useful: a list that sets "the quick brown fox" in every face answers no question anybody has, and it cannot show the Bengali row at all, whose whole point is a script no specimen sentence contains.

**Bundled, not fetched, and the cost is stated.** This app never contacts the network on its own, and a type picker that loaded Google Fonts would be the first thing in it that did — on a screen about how your own words look. `web/dist` goes from 3.4 MB to 7.2 MB. What grows is the image on disk, not what a browser downloads: `@fontsource` splits every face by `unicode-range`, so a subset is fetched only when a codepoint in its range is drawn. All eighteen families are OFL-1.1.

**An unrecognised token falls back to the built-in, never to nothing.** A preference that fails to resolve must not leave the app with no font: that is indistinguishable from a broken stylesheet, and it is silent.

**Approved.** The reader's, in the form "build a settings where users can customise every font used in the app".

<sub>1.15.0 — `web/frontend/src/fonts.js` · `web/frontend/src/Settings.jsx` · `web/frontend/src/main.jsx`</sub>

### The Bengali face changed on the reader's judgement, and the old one stayed on the list

**Decided.** Bengali is Noto Serif Bengali and Devanagari is Noto Serif Devanagari. Tiro Bangla and Tiro Devanagari Hindi are both still offered.

**Reversal.** An earlier release had replaced Noto Serif Bengali *with* Tiro Bangla, for a stated reason I still think is a reasonable one — "a text face with real Bengali letterforms rather than a pan-script fallback". The person who reads Bengali in this app called it horrible, which is the only evidence that counts about type somebody has to read every day. Devanagari moved the same way on the same reader's milder version of the same note.

**Reversing a choice is not deleting it.** Both previous faces are on the list they were removed from being the default of, which is what a picker is for.

**Approved.** The reader's, in the form "change the bengali font. it is horrible. Hindi font can be improved as well, but it is not as bad."

<sub>1.15.0 — `web/frontend/src/index.css` · `web/frontend/src/fonts.js`</sub>

### The Indic faces live inside the Latin stacks, so changing one rebuilds three

**Decided.** `--font-display`, `--font-ui` and `--font-hand` each name the Latin face first and then the Bengali and Devanagari faces. Stacks are composed in `stackFor` from the WHOLE choice, not per role.

**Why after the Latin face and not before.** No Latin codepoint ever reaches the Bengali face and no Bengali codepoint stops at the Latin one, so one stack serves both and neither pays for the other. Listed *before*, the Indic faces' own Latin subsets would win and the app would change typeface.

**The consequence, which is the non-obvious part:** picking a new Bengali face has to rebuild the display, ui and hand stacks too. A per-role substitution would leave a Bengali quote inside a book card rendering in the old face while the Bengali row of the picker showed the new one.

**Approved.** Mine.

<sub>1.15.0 — `web/frontend/src/fonts.js` · `web/frontend/test/dom/fonts.test.jsx`</sub>

### The style modifiers are companion custom properties, and OFF is `inherit`

**Decided.** Bold, italic, small caps, all caps and lining figures are per role, applied through five companion properties (`--font-display-weight` and so on) set beside every `font-family: var(--font-X)` — 69 rules in `index.css` and 63 inline styles.

**Why not at `:root`.** These are inherited properties. Set once at the root they would land on everything, and a modifier meant for the label face would restyle the quotes.

**Why `inherit` rather than `normal` for off.** A heading already set to 600 must not be flattened to 400 by a role nobody has touched. "Off" has to mean *whatever this element would have been*, which is exactly what an untouched preference should mean.

**Where an element already sets its own weight or italic, the companion is dropped** rather than left to fight it — 89 such sites, found by walking each object literal and rule block rather than by eye.

**"Monospace" was asked for and is not here.** Whether a face is monospaced is a property of how it was drawn; no CSS makes a proportional face monospaced, so a switch by that name could only lie. `font-variant-numeric: tabular-nums` is the real thing behind the request and ships as "Lining figures". Small caps and all caps are absent from the Bengali and Devanagari rows, which have no case at all.

**Reversal (1.15.2).** The screen no longer says any of that. The clause this entry used to carry was:

> **"Monospace" was asked for and is not here, and the picker says so.**

It said so in a paragraph under the Labels row's style chips, shown to every reader who opened that row, forever, because one reader once asked for a control. That is an answer with no question attached: the paragraph names a switch that is not on the screen, so the only way to understand it is to have wanted the switch. Explaining an absence to the person who never noticed it is how a settings panel turns into a transcript of its own arguments. The reasoning belongs where reasoning goes — this entry, and the comment over `FONT_STYLES` in `fonts.js` — and "Lining figures" still ships, still named after what it does.

**Approved.** The reader's for the list, mine for the two substitutions; the owner's for dropping the on-screen explanation.

<sub>1.15.0, revised 1.15.2 — `web/frontend/src/index.css` · `web/frontend/src/fonts.js` · `web/frontend/src/Settings.jsx`</sub>

### An uploaded font is stored and never parsed, and the script check runs in the browser

**Decided.** `POST /fonts` checks the first four bytes against the six font-container magics and writes the rest verbatim. The script check — does this face actually draw Bengali? — runs client-side, **by measuring text**, and is a warning rather than a refusal.

**Why the server never parses it.** Font parsers are a famously bad attack surface, the dependency budget here is three direct Go modules, and the only thing that needs to read this file is the browser that asked for it, which has a hardened parser and is going to run it whatever this package concludes. The file is served with `nosniff`, and only to its owner.

**Format by magic bytes, not by extension.** A `.woff2` that is really a ZIP is exactly the case an extension test misses, and the browser would refuse it later with nothing on screen to say why.

**Why measurement rather than parsing.** Reading the `cmap` table means a font parser; woff2 is Brotli-compressed, so in the browser it would mean shipping a decompressor as well — for a check whose answer is advisory either way. Instead: set a string of the target script in the candidate and in a control that certainly lacks it, and compare widths. A face without the script substitutes the same fallback the control does and measures identically.

**A warning, not a refusal.** It can be fooled both ways — a font with three Bengali glyphs passes — and refusing somebody's own font on the strength of a metrics heuristic is worse than telling them what looks wrong. Where it cannot measure at all it answers *undecidable* and says nothing: "I could not check" must never render as "your font is wrong".

**Deleting a font a preference still names rewrites nothing.** An unresolvable token falls back to the built-in, which is the rule that already covers a typo, an older client and a newer one.

**Approved.** The reader's, in the form "user can upload a new font to replace them. a verifier will verify if the language / script is the same".

<sub>1.15.0 — `internal/httpapi/font_handlers.go` · `internal/store/migrations/0039_user_fonts.sql` · `web/frontend/src/fonts.js`</sub>

### The share image resolves the same faces, because canvas cannot read a custom property

**Decided.** `quoteImage.js` builds its font shorthands from `fontChoice`, rebuilt inside `ensureFonts()` — the one thing every draw already awaits.

**Why it is worth an entry.** It is the easiest consumer to forget. A type swap that only rewrote the stylesheet would leave every exported card in the old face, which is the same class of bug as a filter that changes one screen: correct everywhere you look and wrong where you do not.

**What follows the preference is the FAMILY, not the weights.** The card is a drawn composition — its quote is italic and its footer is 600 because the card is designed that way, not because the display role is. Applying "all caps" from Settings to a share image would restyle a picture somebody is about to send to somebody else.

**Approved.** Mine.

<sub>1.15.0 — `web/frontend/src/quoteImage.js`</sub>

### A proverb wears its language where every other quote wears a face

**Decided.** A standalone quote with a language and no speaker leads its meta line with a **language mark** — the reader's own if they set one, else a letter from that language's script, else nothing at all.

**Flags are offered and not assumed.** The ask was "use flags for languages", and the tray offers twenty-four of them first. What the app does not ship is a *mapping*. A flag is a country and a language is not: Bengali is spoken either side of a border, Hindi has no flag of its own, and Spanish, Portuguese, Arabic and English have a dozen each with nothing to choose between them. A default here would be this app telling somebody which country owns their mother tongue. A test asserts no starter language arrives wearing a flag, because a table like that is exactly what somebody fills in later out of tidiness.

**Instead of** leaving the slot empty, which is what it was. Every other quote card begins with somebody's portrait; a proverb — which is close to *the* kind with nobody to credit — began with nothing.

**Stored as JSON in a string**, for the reason `creditSeparators` is a token string: prefs is a flat comparable struct compared with `!=` in `ui_test.go`, so a map field would not compile. Names fold on the way in, keys sort so the blob is stable, and an empty mark is dropped rather than stored — the absence IS the default.

**Approved.** The reader's, in the form "use flags for languages (replacement for people chips for proverbs). let the user change them if needed as well." The second half is the mechanism rather than an escape hatch.

<sub>1.15.0 — `web/frontend/src/languages.jsx` · `internal/httpapi/language_marks.go`</sub>

### Type and Language marks are pop-ups off the Appearance card, not cards in the settings grid

**Decided.** Settings holds eight cards, and Type and Language marks are not among them. Both are buttons at the foot of the Appearance card — a glyph and its words — opening a `FormModal` each. The panels are otherwise unchanged: they lose the `Card` frame and the `SectionTitle`, which the dialog carries, and their heading blurbs come out from behind info dots into a lead paragraph, because a dialog has the room a 300px column did not.

**Why.** Both are long, and both are settled once. Type is six roles, each with a live specimen, a face picker, an upload control and a row of style chips; Language marks is a row per language with a tray of two dozen flags behind every one. That was two columns of the settings page permanently unrolled, and a settings page is read at a glance — the cost is paid by every visit for a choice made on one of them.

**Why Appearance and not somewhere else.** Both answer the same question that card answers: what the app looks like. Language marks used to sit under Metadata and Colours on the argument that all three are about what a quote is *labelled with*; that argument survives for Colours, which is a vocabulary, and gives out for marks, which is a glyph. What a proverb *wears* is appearance.

**Instead of** collapsing them in place, as accordions on their own cards. Rejected because it keeps the card, the heading and the row of chrome and buys only the height — and a settings page of eight collapsed cards is a page with nothing on it.

**Instead of** leaving them and shortening the panels. There is nothing in either to cut: the specimen *is* the type picker, and every language in the list is one somebody may want to mark.

**Approved.** The owner's, in the form "the language marks and Type sections should be two buttons (glyphed) under appearance section that opens their own pop ups".

<sub>1.15.2 — `web/frontend/src/Settings.jsx` · `web/frontend/src/ui.jsx` · `web/frontend/test/dom/appearance-panels.test.jsx`</sub>

### A component used in JSX and never imported is caught by reading every capitalised tag, not every `Icon*`

**Decided.** `icon-imports.test.js` reads every `.jsx` screen for a capitalised JSX tag that appears in no import and no local declaration. It resolves named, default and namespace imports, top-level declarations, and a component taken as a renamed prop with a default (`{ form: Form = AnnotationForm }`), and it is handed the broken shape directly so a clean tree cannot pass it for the wrong reason.

**Why it was widened.** It was scoped to `Icon*` when it was written, on the stated grounds that glyphs are the ones passed as props and buried in branches and that "the narrow rule is one nobody has to argue with". Then Settings' language-mark tray shipped `<Field>` with no import: same branch shape, same silence, same `ReferenceError` on the one click the card exists for — and the test watched it go past because the missing name did not begin with `Icon`. A test that names a class of bug and then catches one spelling of it is not catching the class.

**A rename with no default is deliberately not matched.** `key: Value = default` is legal only in a destructuring pattern, never in an object literal, so requiring the `=` is what keeps this from quietly blessing `{ icon: IconFoo }` written without an import. A bare rename would be reported as missing — which is the right direction to fail: loud, one file named, one line to fix here.

**Instead of** adding ESLint. There is no lint step in this project and adding one for a single rule is a dependency, a config and a CI job to keep the rule that a twenty-line test already keeps.

**Approved.** Mine, prompted by the crash.

<sub>1.15.2 — `web/frontend/test/pure/icon-imports.test.js` · `web/frontend/src/Settings.jsx`</sub>

## 16. Serving and Running It: HTTP Surface, Logging, TLS and Updates

The HTTP surface is stdlib routing with compression and paging added without changing any existing behaviour, and every operational failure is expected to be diagnosable from `docker logs` alone. Update and TLS features are opt-in, with the trade-offs stated rather than sold.

### The JSON API mounts under `/api`, and `/healthz` stays out of the log

**Decided.** One mux owns every JSON and covers route, mounted under `/api` with `http.StripPrefix` so the SPA router owns the root path space and a client-side route can never collide with an API route. `/healthz` stays at the root for ops, unauthenticated, because a container healthcheck and a monitoring probe should not have to know about a prefix. The request log writes one line per request to stdout so it is visible in `docker logs`, and skips `/healthz` — a probe every 30 seconds would otherwise be the only thing in the log, which is the same as having no log. I approved both the mount point and the exclusion.

**Instead of.** Serving the API at the root and reserving path prefixes for the SPA, which makes every new route a potential collision.

<sub>1.0.0 — `internal/httpapi/server.go` · `docs/PLAN.md`</sub>

### Response gzip from `compress/gzip`, decided at `WriteHeader`

**Decided.** Quote text compresses roughly eight to one, and the list endpoints a client mirrors return a lot of it. On a LAN this is invisible; over Tailscale or a phone's cellular connection it is the difference between a library sync that feels instant and one that does not. Standard library only — no new dependency. Three details are the decision. Compression is opt-in per request via `Accept-Encoding` and skipped for content that is already compressed — JPEG and PNG covers, sealed archives — where a second pass burns CPU at both ends and can make the payload larger. The decision is deferred to `WriteHeader`, when the handler has set `Content-Type` and the status is known, rather than guessed from the route. And when it compresses it deletes `Content-Length`, because the handler's value describes the uncompressed body. `Vary: Accept-Encoding` is set always, not only when compressing, so a cache cannot serve a compressed response to a client that did not ask. I approved all four.

**Instead of.** A compression middleware dependency, or compressing by route.

<sub>1.1.0 — `internal/httpapi/gzip.go`</sub>

### Pagination is opt-in `limit`/`offset`, so the web UI is unchanged

**Decided.** `/books` and `/movies` previously had no limit at all and shipped the whole library on every call; `/annotations` and `/dialogues` capped at 500 with no way to reach anything past it. Both now accept `limit` and `offset` — and sending neither still returns everything. That is the whole design: an installed client gets paging, the web UI is not touched, and the migration risk is zero because there is no behaviour change to migrate. I approved the opt-in shape over a default page size specifically because a default would have silently truncated every existing caller, including the SPA.

**Instead of.** A default page size, which is the more usual API design and would have been a breaking change dressed as an improvement.

<sub>1.1.0 — `internal/httpapi/capabilities_handler.go`</sub>

### An unauthenticated `/api/capabilities` handshake

**Decided.** The SPA ships inside the binary, so it is always exactly as new as the server and never needed a handshake. An installed Android APK does not: it and the server on a NAS update on entirely separate schedules, so sooner or later one is older than the other, and without somewhere to ask, the app discovers that as an unexplained 404 halfway through saving a capture. `GET /api/capabilities` returns the running version, an integer `apiRevision`, a named feature list and `minClientRevision`. It is unauthenticated and cheap because the app needs it before it holds a token — during pairing, and on resume. The revision is deliberately one integer rather than a version per route: a client only ever needs "is this server new enough for me". Feature names are stable once published, because an old app keeps looking for the string it was built against. I approved the handshake and the single-integer shape together.

**Instead of.** Per-route versioning, or probing for 404s.

<sub>1.1.0 — `internal/httpapi/capabilities_handler.go`</sub>

### Separate body-size caps per surface

**Decided.** There is no global body cap, because the surfaces genuinely differ: `maxAuthBody` is 4 KiB, which is plenty for credentials; `maxCRUDBody` covers quote writes; `maxUploadBytes` is 12 MiB for a cover's multipart envelope, leaving headroom around a 10 MB image that `metadata.StoreImage` re-caps after decoding; `maxRestoreUpload` is 2 GiB with a 413 beyond, and `maxRestoreBytes` is an 8 GiB decompression-bomb guard on what the archive expands to. A single generous cap would mean the login endpoint accepts a gigabyte. The restore paths additionally clear the HTTP deadlines (11.21), which is the one place a cap and a timeout have to be reasoned about together. My call, and I would rather have six named constants than one.

**Instead of.** One global `MaxBytesReader` in middleware.

<sub>from 1.0.0 — `internal/httpapi/auth_handlers.go` · `internal/httpapi/covers_handler.go` · `internal/httpapi/backup_handlers.go`</sub>

### Stored images have random, never-reused names

**Decided.** Covers, posters, avatars and stickers are stored under 16 lowercase hex characters plus an extension sniffed from the decoded image, in `<DataDir>/MediaCover`. Because a name is random and never reused, `/covers` can set `Cache-Control: public, max-age=31536000, immutable` — there is no invalidation problem, because a changed image is a different name. The handler serves only names matching `^[0-9a-f]{16}\.(jpg|png|webp|gif|svg)$`, so there is no path traversal and nothing is served that we did not store ourselves; anything else is a JSON 404 rather than `ServeFile`'s plain text. Uploaded SVG stickers additionally get `Content-Security-Policy: default-src 'none'; …; sandbox` and an explicit `Content-Type`, so even a direct navigation cannot execute embedded script — upload rejects `<script>` too, but this is the authoritative barrier. I approved the naming scheme for the caching and kept it for the validation.

**Instead of.** Content-hash names (same caching, but a hash tells you the file's content is already known to someone) or original filenames.

<sub>from 0.3.0 — `internal/httpapi/covers_handler.go`</sub>

### Structured error codes `TIP-<SUBSYS>-NNN`, append-only, on both streams

**Decided.** Every handled error carries a stable, greppable code of the form `TIP-<SUBSYS>-<NNN>`. Three rules make it worth having. Every code must have an entry in `olog.Registry` *and* a row in `docs/troubleshoot.md`, and `TestCodesDocumented` fails the build if the two ever drift — documentation that can go stale is documentation that will. Codes are append-only within a subsystem, never renumbered or reused, so a code in an old log always means the same thing. And lines go to both stdout and stderr, so `docker logs` shows them regardless of how the stream is captured. The whole scheme exists to serve one requirement: an operator with nothing but `docker logs` should be able to diagnose any failure this app knows how to have. I approved it, and the build-time test is the part that makes it real.

**Instead of.** Free-text error messages, which are ungreppable and undocumentable.

<sub>0.6.4 onward — `internal/olog/codes.go` · `docs/troubleshoot.md`</sub>

### A list-row scan error is logged loudly and never shortens a list

**Decided.** A row that fails to scan — a sign of SELECT/struct drift — used to be quietly skipped with a 200, which means a list silently gets shorter and nothing says so. There is now a per-subsystem code for exactly that class (`TIP-ANNO-001`, `TIP-BOOK-001`, and a dozen more), one per subsystem with list loops, so "mysteriously empty list" bugs surface immediately. The other half of the same release fixed the client-side version: if any of the three requests behind the Favourites grid returned an unexpected non-JSON response — an HTML page from a reverse proxy, or an expired session — the whole section vanished instead of degrading. Both are the same rule from opposite ends: a partial failure must not render as a smaller, plausible success. I approved the code family and the guard.

**Instead of.** Failing the whole request on a bad row, which turns a cosmetic drift into an outage.

**Reversal.** Yes, of the silent-skip behaviour.

<sub>0.6.4 — `internal/olog/codes.go`</sub>

### Startup runs `quick_check` and an FTS integrity check on every boot

**Decided.** On boot, `CheckIntegrity` runs SQLite's own `PRAGMA quick_check` over the whole file and `RepairFTS` runs an FTS `integrity-check` against each index, reconstructing any that come back broken. Both log to stdout and stderr, and real corruption is alerted loudly — `TIP-STORE-002` with up to twenty problem lines and a count of the rest — so it cannot be missed in the container logs. Neither is fatal: a failure at both repair levels is logged and the server still starts, with search on that scope erroring until Profile → Reset all data. Running this every boot on a NAS is a cost I accepted knowingly; `quick_check` is the cheap variant, and a corrupt database discovered at boot is a corrupt database discovered before it is written to. My call.

**Instead of.** Checking on demand only, which means checking after you already suspect something.

<sub>0.4.6 — `cmd/tippani/main.go` · `internal/store/repair.go`</sub>

### Outbound tracing redacts query-param secrets

**Decided.** Every outbound provider call logs at trace level — `[trace] [meta] GET … -> 200 (N bytes)` — and the URL passes through `redactURL` first, which replaces the `api_key` and `key` query parameters with `***`. Those are the TMDB v3 key and the Google Books key, which travel in the query string. The v4 TMDB token and the TVDB JWT travel in the `Authorization` header and so are structurally absent from a trace — not redacted, absent, which is the stronger property and the reason I prefer header auth where a provider offers both. `redactURL` is best-effort: an unparseable URL is returned as-is, and a URL with nothing to hide is returned byte-for-byte rather than round-tripped through the query encoder. Tracing itself is a no-op unless `TIPPANI_LOG_LEVEL=debug`. I approved the redaction and the no-op gate together, because a trace that is expensive is a trace nobody turns on.

**Instead of.** Logging the URL whole at debug level, on the theory that debug logs are private. They end up in bug reports.

<sub>0.6.4 — `internal/metadata/metadata.go` · `internal/olog/olog.go`</sub>

### The container healthcheck is the binary probing its own loopback port

**Decided.** `HEALTHCHECK … CMD ["/tippani", "healthcheck"]`, in exec form, because the runtime image is `gcr.io/distroless/static-debian12:nonroot` and there is no shell and no `curl` to invoke. Rather than add either — which would mean giving up distroless and its attack surface — the binary carries a subcommand that probes its own loopback port and exits with the right status. It adapts automatically when native TLS is on. I approved paying for the subcommand to keep the base image, and I would make that trade again: a healthcheck is a few lines of Go and a shell in the image is permanent.

**Instead of.** A debian-slim runtime with `curl`, or dropping the healthcheck.

<sub>from 0.3.0</sub>

### Native TLS from a PEM pair, hot-reloaded, with an explicit refusal on ACME

**Decided.** `TIPPANI_TLS_CERT` and `TIPPANI_TLS_KEY` point at a PEM pair and Tippani serves TLS itself, with no reverse-proxy container required; both must be set together or the boot fails. The pair is re-read per TLS handshake, gated on a cheap size-plus-mtime stamp — two `Stat`s per connection, nothing per request — so external renewal tooling can rotate the files in place and the next handshake serves the new pair with no restart. A failed re-load keeps serving the previous pair and logs `TIP-HTTP-001` rather than dropping TLS, because a renewer that writes cert and key non-atomically parses as a mismatched pair for a moment, and the retry fires again when the second file lands. The stamps are adopted even on failure so a broken file warns once rather than once per handshake. Certificates come from wherever the operator already gets them — a home CA, `tailscale cert`, an acme.sh or certbot renewal on the host — and Tippani deliberately does not speak ACME: a renewal loop is a background job with a third-party dependency, and this app ships with zero of those. I approved the refusal as firmly as the feature.

**Instead of.** `autocert`, which would add a dependency, a background renewal loop and an outbound obligation.

<sub>0.9.4 — `cmd/tippani/tls.go` · `README.md`</sub>

### One-click update through the mounted Docker socket, opt-in

**Decided.** When the Docker socket is mounted — a documented, deliberate security trade-off — Settings → Updates offers *Update & restart now* to an admin behind a typed `UPDATE` confirm: it pulls the new image, recreates the container with a one-shot Watchtower, then waits for the app to come back and reloads. It works when you track a moving tag. Crucially the no-socket path is not a degraded mode: it shows the exact command to run by hand, and the troubleshooting doc says the guided manual command always works. That is what makes the socket genuinely optional rather than nominally optional. I approved the feature only on that condition.

**Instead of.** Requiring the socket, or shipping no update path at all.

<sub>0.6.0 — `README.md`</sub>

### `TIPPANI_DOCKER_HOST` adds a socket-proxy route, honestly documented

**Decided.** Setting `TIPPANI_DOCKER_HOST=tcp://dockerproxy:2375` points the update path at a docker-socket-proxy with `CONTAINERS=1 IMAGES=1 POST=1`, on an `internal: true` network, so no socket file is ever mounted into the Tippani container and no `group_add` is needed. The README then refuses to oversell it, and that paragraph is the decision: the update flow must be allowed to create and start containers, and that permission is host-root-equivalent in the wrong hands, because a container can be created with the host filesystem mounted. The proxy still helps — no socket file in the app container, exec/volumes/secrets/swarm endpoints blocked, API reachable only from inside the stack — but it is a hardened version of the same opt-in trade-off, not a removal of it. I approved shipping the route with that warning attached, and I would rather lose the feature than soften the warning.

**Instead of.** Documenting the proxy as "secure", which is what most projects do and what I will not.

<sub>0.9.4 — `README.md` · `internal/updater/docker.go`</sub>

### The update helper joins all of the target's networks

**Decided.** In proxy mode there is no socket file to bind into the one-shot Watchtower, so the helper gets `DOCKER_HOST` pointed at the same proxy — and must sit on a network from which the proxy's address resolves. It is attached to *all* of the target's networks, not a guessed one: Tippani can only reach the proxy because they already share a network, so every network the target is on is a candidate, and joining all of them is the only choice correct regardless of which one carries the proxy or how the names happen to sort. An earlier version joined the first-alphabetical network, which silently missed the proxy in the documented topology — the proxy on an isolated `*-internal` net while the target also sits on `*_default`, which sorts first. That was mine, and the failure taught the general lesson: sorting is not selection. The helper deliberately does not share the target's network *namespace*, because Watchtower restarts the target and would yank a shared namespace out from under the helper mid-swap.

**Instead of.** A configurable network name, which is another thing to get wrong in a compose file.

**Reversal.** Yes, of the first-alphabetical pick.

<sub>0.9.4 — `internal/updater/docker.go`</sub>

### The update check is strictly on demand, and the version is stamped in

**Decided.** Tippani never contacts GitHub on its own; the check is a click, hitting `GET /repos/{repo}/releases/latest` with an 8-second timeout, and a non-200 — rate limit, no releases yet, offline — is surfaced as an error the caller reports without failing the whole request. The running version is stamped into the binary at build time via `-ldflags -X tippani/internal/buildinfo.Version`, logged at startup, printed by `tippani version`, and surfaced in Settings, so "what version am I on" never depends on a label or a tag being correct. The comparison is a lenient semver parse that returns `ok=false` for non-semver strings like `dev` or a short sha, so a local build is never told it is out of date. My call: no polling, and the version is a property of the binary rather than of its packaging.

**Instead of.** A periodic background check, which is a poller and a phone-home in one.

<sub>0.6.0 — `internal/updater/updater.go`</sub>

### The manual update command became one idempotent line

**Decided.** The command shown in Settings → Updates was `docker compose pull && docker compose up -d`, and it is now `docker compose up -d --pull always --force-recreate` — one step that always re-pulls the tag and always recreates the container. The two-step form depended on `up -d` deciding a recreate was warranted, which is a judgement about the compose config rather than about the image, so it could complete without doing the thing the operator ran it for. One line that is unconditional is better than two that are conditional, especially in a copy-paste box. I approved the change; the reasoning recorded at the time is exactly the clause "one step that always re-pulls the tag and recreates the container", and I am not going to dress it up further.

**Instead of.** The two-step form, or `docker compose pull && up -d --force-recreate`, which is still two steps.

**Reversal.** Yes, of the 0.6.0 command.

<sub>0.6.2 — `README.md`</sub>

### The self-updater speaks raw Engine API, and leans on a one-shot Watchtower

**Decided.** `internal/updater/docker.go` is a minimal Engine-API client covering only what a self-update needs: ping, identify self, pull, run a one-shot updater. The heavy Docker SDK is deliberately avoided — the app stays CGO-free and dependency-light, and this speaks a handful of documented HTTP endpoints over two transports, the mounted unix socket or plain TCP to a socket proxy. For the swap itself it runs `containrrr/watchtower --run-once --cleanup <target>` rather than hand-rolling a container replacement, because Watchtower copies the existing config so the data volume, ports, env and restart policy survive the recreate. Hand-rolling that is where a self-update strands a deployment. The helper is short-lived and auto-removed, and the image is overridable via `TIPPANI_UPDATER_IMAGE` so it can be pinned to a digest. I approved both halves: write the small client, borrow the dangerous part from something that already does it correctly.

**Instead of.** The Docker SDK (a large dependency for four calls), or a hand-rolled recreate (the config-loss risk).

<sub>0.6.0 — `internal/updater/updater.go` · `internal/updater/docker.go`</sub>

### `TIPPANI_DOCKER_HOST` rather than the conventional `DOCKER_HOST`

**Decided.** The endpoint variable is deliberately its own name rather than the conventional `DOCKER_HOST`, so an unrelated variable in the operator's stack can never silently redirect Tippani's updates. `DOCKER_HOST` is a widely-set variable with a broad blast radius, and the failure it would cause here — pulling and recreating against a different engine than intended — is not one I want reachable by an environment inherited from a compose file someone else wrote. The conventional name is still used in exactly one place, as the value handed *to* the Watchtower helper, which is the one context where it means what the convention says it means. My call, and the cost is one line of README.

**Instead of.** Honouring `DOCKER_HOST`, which is what an operator would expect and is exactly why it is unsafe here.

<sub>0.9.4 — `internal/updater/docker.go` · `README.md`</sub>

### The Homepage widget is tiered cheapest-first, with the PR gated upstream

**Decided.** The dashboard widget is planned in three tiers, cheapest first. Tier one documents what already works: the unauthenticated `/healthz` means any dashboard can ping Tippani today, so a "Dashboards" page with a ready-to-paste `services.yaml` snippet and the optional `homepage.*` compose labels costs nothing and lands first. Tier two is Homepage's `customapi` widget, which renders live counts with zero upstream code — but its requests come from the Homepage *server* with no session cookie, so it rides on the per-user API tokens and needs a slim read-only stats surface accepting `Authorization: Bearer`. That is the real deliverable. Tier three is a native first-party widget, a PR into `gethomepage/homepage`, and it is gated on upstream rules rather than on my readiness: the widget must target a feature-request discussion with at least 20 up-votes, and widgets for projects under about a year old get declined. So the discussion opens early to accumulate votes and the PR waits for 2027, consuming the exact endpoint tier two already built. I approved the tiering, and the honest part is tier three's gate — the schedule belongs to someone else's project, and pretending otherwise would put a deliverable on the roadmap that I cannot deliver.

**Instead of.** Going straight to the native widget, which would be submitted into a decline.

<sub>planned — [homepage widget](roadmap.html#homepage-widget) — `docs/roadmap.html`</sub>

## 17. Verification, Release Engineering and Provenance

This code was written almost entirely by AI, which fails differently: it compiles, reads well, and can still be wrong, so plausibility counts for nothing and only execution does. The decisions here are about what gets checked, what the checks cannot cover, and how the project's own documents are kept from drifting.

### Importers are verified against real exports, and the fixtures are synthetic

**Decided.** Every importer has a committed synthetic fixture — `hardcover_ synth.htm`, `goodreads_synth.htm`, `imdb_synth.htm`, `amazon_notebook_synth. htm`, `markdown_readest_synth.md` — plus a second test that opens the real third-party export and calls `t.Skip` when it is absent, with the reason stated: gitignored, owner privacy. "Verified against a real export" is tracked in §11's confidence table as its own class, distinct from design inference.

**Why.** A real export is somebody's library and cannot be committed, but a parser written against a guessed shape is a guess. Keeping both means CI has something deterministic to run and my own machine still runs the file the format was learned from. §11 marks the difference so a reader can tell which claims were checked against reality — Bookcision's `authors` field is recorded as a string with a nullable `note` because a real export said so, while the FTS latency figure is marked design inference.

**Approved.** Mine, and I approved the skip-when-absent shape rather than weakening the tests to the synthetic fixture alone.

<sub>0.x onward — `internal/importer/testdata/` · `internal/importer/bookcision_test.go` · `docs/PLAN.md`</sub>

### A test must not assert against the wall clock, or against being the newest migration

**Decided.** `TestDailyQuizTimezone` now asserts the local-day shift deterministically. A migration-replay test steps forward from an older schema rather than deleting its own `schema_version` row.

**Why.** Two distinct traps, both recorded with the symptom. The timezone test "asserted a cross-midnight case off the wall clock and could fail depending on the hour CI ran (it broke 0.6.0's CI at 03:45 UTC though the code was fine)" — a red build with correct code is worse than no test. The migration test "silently stopped replaying once any newer migration existed, because `Migrate()` resumes from the highest recorded version" — a green build with no coverage, the worse of the two failures.

**Approved.** Both fixes are mine, and I approved recording the symptoms rather than only the corrections.

<sub>0.6.1 / 1.1.0</sub>

### Round-trip tests keep asserting what they asserted before

**Decided.** When 1.2.0 put a staging stage between parse and write, the export → re-import round-trip tests went on asserting exactly what they had asserted, through an import-then-approve helper.

**Why.** The property under test is "a library's own export re-imported is a dedupe no-op", and that property did not change. Rewriting the assertions to match the new pipeline would have meant losing the only evidence that the pipeline preserved it. What did change is stated: re-importing the same file twice now gives two batches rather than one silent no-op write, and approving both adds the quotes once.

**Approved.** My call, and I approved the helper specifically so the assertions could stay untouched.

<sub>1.2.0 — `CHANGELOG.md`</sub>

### A passing test you have not seen fail is a decoration

**Decided.** An audit found six tests in the tree asserting nothing, and every claim in that release was then checked by breaking the code on purpose, watching the test go red, and putting it back.

**Why.** The worst of the six was a share-format test where swapping the character and the actor inside the payload left all twenty-one tests green — for a file whose entire subject is that a wrong attribution is a misquote. They were four `toContain` calls. AI-written tests can be confidently wrong about their own coverage, and a green suite is exactly the shape of evidence that stops anyone looking.

**Approved.** Mine, and I approved the break-it-first procedure as the standing rule rather than a one-off audit.

<sub>1.5.0 — `CHANGELOG.md` · `AI.md`</sub>

### A test whose invalid input silently becomes valid asserts nothing

**Decided.** Three tests used `green` as their example of an invalid colour. When 0029 made green valid they were rewritten to use a value that never will be.

**Why.** All three would have gone on passing while testing nothing. An invalid-input test is a claim about the boundary, so its input has to stay on the wrong side of it — and nothing in the type system says so.

**Approved.** My call during the same release that widened the set; I approved hunting for the class rather than fixing the one that surfaced.

<sub>1.7.1 — `CHANGELOG.md`</sub>

### Mutation testing is the gate for a new rule, and a surviving mutant is the finding

**Decided.** New rules ship with a mutation run: sixteen against migration 0029, eleven against the category rules, fifty-one across 1.7.2, and the downgrade guard disabled to confirm its test goes red. The tag ranking was replayed against the real tag list including the pair that collided.

**Why.** The value is entirely in the survivors. Removing 0029's FTS index rebuild changed nothing, which looked like proof the line was unnecessary — an external-content FTS5 index keeps its own entries, so dropping and recreating the content table does not clear them. But it was UNTESTED, not unnecessary: what the rebuild actually repairs is an index that had ALREADY drifted, which is now what the test asserts. In 1.7.2, deleting a middle width step passed every assertion because they only checked that the staircase starts low and ends high; the "last read" comparator's two unread-goes-last guards turned out to be unreachable, and an unreachable branch that looks like the rule is worse than no branch; and a server-side date filter could not be observed through the API at all, since a map miss and a stored empty string serialise to the same JSON. In 1.7.0, the "first slot cannot be hidden" rule was enforced in two places, so breaking either left the other covering for it — a rule guarded twice is a rule where neither guard can be shown to work.

**Instead of.** Coverage as the gate (would have reported all of the above as covered).

**Approved.** Mine, and I approved it as a gate rather than an occasional exercise.

<sub>1.7.0 — `CHANGELOG.md`</sub>

### Assertions about a destructive migration are about values, not counts

**Decided.** `six_colours_test.go` opens a store at the pre-0029 schema, seeds every table the migration touches plus every child and side table it could lose, and asserts values across the rebuild. Its header states the rule: "EVERY ASSERTION HERE IS ABOUT VALUES, not counts."

**Why.** A cascade that ate the tag joins leaves a table that is empty rather than wrong, and a test counting rows before and after would pass on a database where every tag had been stripped from every quote. The precedent is named: 0018's own `dialogue_tags` restore had no assertion at all.

**Approved.** My call, and I approved starting from a populated pre-migration schema rather than a fresh one, which is what makes the loss observable.

<sub>1.7.1 — `internal/store/six_colours_test.go`</sub>

### Schema shape is captured from SQLite itself, via PRAGMA

**Decided.** `TestSchemaShape` reads columns with types, nullability, defaults and primary-key position; CHECK expressions; indexes with their key columns; and foreign keys with their referential actions — all from `PRAGMA table_info` / `index_list` / `index_info` / `foreign_key_list` plus the `CREATE TABLE` text in `sqlite_master`, never from a hand-maintained mirror.

**Why.** Every other migration test in the package is behavioural: it INSERTs a row and checks whether a CHECK or a UNIQUE fires. That only ever catches the rules somebody remembered to write an INSERT for. A rebuild that quietly drops a column default, widens a CHECK by one value or forgets an index is invisible to it — the INSERT still succeeds, the test still passes, and the damage shows up months later as a column full of NULLs or a table scan on the review deck. Reading from SQLite means the capture cannot drift the way a duplicated schema constant would.

**Approved.** Mine, and I approved the PRAGMA source specifically over a checked-in expected schema.

<sub>1.7.x — `internal/store/schema_test.go`</sub>

### A gate that only reads its own output cannot fail

**Decided.** `scripts/glossary-css.mjs` now refuses to write into an HTML comment rather than doing it silently.

**Why.** The UI glossary's opening comment named the `<style>` tag in its own prose and never closed, and HTML comments do not nest — so the first comment-close in the file was the one ending the *next* comment, and the entire inlined stylesheet was commented out. The generator finds its block by searching for the tag, and the first match was the mention inside the comment, so since 1.4.0 — the release added to stop this file rotting — it had been refreshing 140KB of stylesheet *inside a comment* on every run. `--check` passed the whole time, because the bytes it compares are exactly the bytes it wrote. Every sample rendered unstyled, which is the one thing the page exists not to do.

**Approved.** My call, and I approved the refusal over a smarter search — a generator that can write somewhere wrong should stop, not aim better.

<sub>1.5.2 — `CHANGELOG.md` · `AI.md`</sub>

### Doc tests read the source, not the docs

**Decided.** `help.test.jsx` asserts that every screen a nav list can reach has a help entry and that a control the app labels is a control the help names — reading the *source* for those labels rather than the help file.

**Why.** A doc test that only reads the docs agrees with itself forever. It found three real gaps on its first run: the whole Quotes filter row, the Catalogue's group-by, and an "Export all" button that had stopped meaning "all" when the list screens started exporting the filtered view. All three had been read past repeatedly.

**Approved.** Mine, and I approved the source-reading version after the glossary generator had already demonstrated the self-agreeing failure.

<sub>1.6.0 — `CHANGELOG.md` · `AI.md` · `web/frontend/test/pure/help.test.jsx`</sub>

### A bug of omission needs a stylesheet invariant sweep, not a case

**Decided.** The scroll-chaining fix is one CSS property, and the test is an invariant over the stylesheet — every scroll container declares `overscroll-behavior` — with a named exemption list and a guard that the sweep still matches something. The popup-placement fix inverted the same shape: it no longer checks that two composed rules avoid contradicting each other, it checks that no popup places itself at all.

**Why.** The defect was not a wrong value anywhere; it was that nobody had thought about scroll chaining, so a case fixes the popup that was reported and nothing else. Widening the sweep from vertical to sideways immediately found one nobody had reported — the top navigation, where running off the end is the browser's back gesture, so a nav that navigates away. The floor on what the extractor matches exists because a sweep whose extractor broke reports a clean stylesheet by looking at nothing.

**Approved.** My call, and I approved the exemption list being explicit so a future exemption is a decision rather than a silent miss.

<sub>1.7.2, extended 1.7.6 — `CHANGELOG.md` · `AI.md`</sub>

### Changing a default changes nothing if the default was ever written down

**Decided.** Turning the share image's colour switch off by default also retired its storage key.

**Why.** The one-character version — flip `true` to `false` — is correct, reviews clean, and alters the behaviour of no device that has ever opened the panel: the hook behind it persists on *mount*, so the old default had already been stamped into local storage by the first render, and a stored value beats a default every time. The obvious test passes too. Clear the storage, render, assert the switch reads Off — green, for a change nobody would experience. The test that means anything seeds the *retired* key with the *old* value and asserts the switch still reads Off, which is the only version that can tell a default from a decision somebody made.

**Approved.** Mine, and I approved the key retirement as part of the change rather than a follow-up.

<sub>1.7.2 — `CHANGELOG.md` · `AI.md`</sub>

### Placement arithmetic is a pure exported function

**Decided.** The popup flip / clamp / cap arithmetic is a pure function tested on its own, not through the DOM.

**Why.** Jsdom applies no layout and reports every rectangle as zeros, so a test driving the placement through the DOM would be asserting that nothing fits inside nothing. The same blindness is why all six existing tests over the collapsed colour picker passed while it was broken — the elements were present, correct and accessible, in a box with no height.

**Approved.** My call, and I approved extracting the arithmetic specifically so it could be tested at all.

<sub>1.7.6 — `CHANGELOG.md` · `web/frontend/test/pure/anchored-popup.test.js`</sub>

### Frontend tests assert paint calls and canvas output, not configuration or markup

**Decided.** Share-image rendering is tested through a recording context, with one recorder per canvas sharing one ordered log, and assertions phrased as "the halo was in force at the moment each word was painted".

**Why.** `ctx` state is a single mutable register, so a shadow set before the portrait and cleared before the text is indistinguishable from one never set at all unless you look at the paint calls themselves. Each offscreen buffer is traced back to the photo that went into it, because the card builds each portrait in its own buffer and a single recorder cannot tell "the photo went into its buffer" from "the photo was stamped on the card" — which is the entire distinction — and two portraits of the same face land in exactly the same two places, so geometry alone would pass. Similarly, the colour-default test asserts against the canvas rather than the toggle's markup, because a control reading Off while the drawing code carries on tinting is a state desync, not a labelling slip. Nothing here throws: "a backdrop drawn for the wrong person, on the wrong side, at the wrong depth, or when nobody asked for one is a stranger's face across somebody's words in a picture they are about to post."

**Instead of.** Asserting configuration or DOM state — passes for the failures that matter.

**Approved.** Mine, and I approved the recorder as the house pattern for anything drawn rather than rendered.

<sub>1.6.0</sub>

### A frontend test suite arrived as dev-only Vitest in two projects

**Decided.** Vitest, dev-only — the three runtime npm packages are unchanged — with two projects: `pure` in node for functions that take values and return values, `dom` in jsdom for components actually under test. The two hand-rolled check scripts, `greetings-check.mjs` and `archive-header-check.mjs`, folded into it.

**Why.** Jsdom is paid for only where a component is under test; the rest stays fast enough that you run it without thinking. Both projects go through Vite and have to: `api.js` reads `import.meta.env` at module scope and `ui.jsx` imports `api.js`, so almost the whole tree is unloadable by `node --test` — which is exactly why the two bespoke scripts could only ever cover `greetings.js` and `secret.js`, the only modules with no imports at all. TZ and locale are pinned because five places format dates through `toLocaleDateString` with an undefined locale.

**Approved.** My call, and I approved absorbing the scripts rather than keeping three runners.

<sub>1.5.0 — `web/frontend/vitest.config.js` · `CHANGELOG.md`</sub>

### Test file paths come from vitest.config.js, not from cwd

**Decided.** The config exports `TIPPANI_SRC` as an absolute path for the handful of tests that read a source file rather than import it — the CSS/JS agreement checks in `palette.test.jsx` and `button-labels.test.jsx`.

**Why.** They cannot work it out themselves. Under jsdom `import.meta.url` is an http URL, so `readFileSync` rejects it; and `process.cwd()` is whatever directory vitest was launched from, which is `web/frontend` for `npm test` and the repo root for `npx vitest --root web/frontend`. Both are real invocations, and the second one is how the divergence was found. The config is the only place that knows for certain, and it runs in Node where `import.meta.url` is a `file:` URL.

**Approved.** Mine, and I approved putting the answer in the one file that has it rather than making each test guess.

<sub>1.6.x — `web/frontend/vitest.config.js`</sub>

### The demo fetch shim is tested against the handlers it imitates

**Decided.** `install.js` exports its `route` function and its response shapes are asserted; its catch-all warns on any path it does not know instead of answering `200 {}`.

**Why.** It answers the API with dummy data so the Pages demo runs with no server, and nothing checked it against the handlers it imitates. `GET /auth/devices` and `/admin/backup` had no case and fell through to the catch-all, so the Devices card read a list field that was not there and threw, taking the whole Settings page down. Its backup response returned `created_at` where the server returns `created`, so the demo rendered "Invalid Date" for as long as that card existed. Nobody's data is at risk from a shim, which is exactly why it drifts: a fake that is close but not identical fails in the one place no test looks. The cover is partial — it asserts what the newest screen reads, not every route — so the risk is reduced rather than closed.

**Approved.** My call, and I approved saying plainly in `AI.md` that the cover is partial.

<sub>1.3.1 and 1.5.0 — `CHANGELOG.md` · `AI.md`</sub>

### The greeting tables are checked by exhaustive permutation

**Decided.** 129,210 greetings, across every region, every day of a year and every hour bucket, with two assertions written from bugs that had already happened.

**Why.** Every way those tables break is silent: a greeting rendering `{name}` literally, a "Happy" on a day of mourning, a country resolving to its neighbour's time zone. None of it throws and none of it fails a build. The two named cases are the reason the exhaustive form was chosen rather than a sample — `America/Bahia_Banderas` (Mexico) `startsWith` `America/Bahia` (Brazil), so an ordered prefix scan handed Mexican devices Brazilian national days; and `Africa/Addis_Ababa` is a tzdb *Link* to `Africa/Nairobi`, so Ethiopia has no identifier of its own and is absent rather than mislabelled.

**Approved.** Mine, and I approved the absent-rather-than-mislabelled rule as the answer wherever the tzdb cannot distinguish two countries.

<sub>1.4.0 — `CHANGELOG.md` · `AI.md` · `web/frontend/test/pure/greetings.test.js`</sub>

### The archive header is parsed in two languages and checked against itself

**Decided.** The check builds headers from the shared constants and asserts the browser parser reads them back, including that it *refuses* a version it does not know rather than guessing.

**Why.** `secret.js` parses that binary header in the browser, by fixed byte offsets into a format defined in Go, and at the time this app had no frontend test runner — so nothing would have noticed the day the two disagreed. It earned itself immediately by failing on its first run, on a bug written minutes earlier: the read window covered a maximal account name but stopped short of the field after it, so an archive's recoverability read as absent for exactly the accounts with long names. That is the shape of every bug in this class — it does not throw, it does not look wrong, and it is only ever wrong for inputs nobody happened to try.

**Approved.** My call, and I approved the refuse-unknown-version assertion as part of it, which is the half that protects a future format.

<sub>1.4.2, moved into Vitest at 1.5.0 — `CHANGELOG.md` · `AI.md` · `web/frontend/test/pure/archive-header.test.js`</sub>

### CI checks the committed web/dist and runs the race detector

**Decided.** `git diff --exit-code -- web/dist` after the frontend build, and `go test -race`.

**Why.** `web/dist` is a committed artifact embedded with `go:embed`, so a forgotten `make frontend` left the binary serving the old UI with nothing to say so — a rule that existed only as prose in the contributing notes. And `-race` had never once run, in a repo that had two tests written specifically to exercise it.

**Approved.** Mine, and I approved both as gates rather than as reminders; a rule only a human enforces is a rule that has already been forgotten.

<sub>1.5.0 — `CHANGELOG.md`</sub>

### Both CI jobs had been red on every push for eight releases

**Decided.** Two unrelated fixes: raise the per-package test timeout under `-race`, and add a `.gitattributes`.

**Why.** Neither was a real defect. The Go job was hitting the default ten-minute per-package timeout under `-race` and printing a goroutine dump that reads exactly like a deadlock; nothing was hanging. The frontend job was line endings, and the chain is worth recording because every link looks harmless: the committed `web/dist/index.html` held CRLF, CI builds LF, so the guard that proves the shipped UI matches its source failed on every line of a file whose content was correct. Normalisation should have prevented it — except the file contained a lone carriage return, from an autocrlf double conversion, and git reads a lone CR as evidence of a binary file. So it classified the file as binary, which switched normalisation off, which meant the CRLF could never be cleaned up by the mechanism meant to clean it up.

**Reversal.** The lesson is about the eight releases, not the two bugs: a job that is red for reasons nobody believes is a job nobody reads.

**Approved.** Mine, and I approved treating the survival time as the finding.

<sub>1.7.4 — `CHANGELOG.md`</sub>

### -race is split: five locking tests per push, the whole suite nightly

**Decided.** The five locking tests run raced on every push in about two minutes; the whole-suite sweep runs nightly. Plain tests run on every push as before. The job asserts that each named test actually ran.

**Why.** The 1.7.4 sweep passed with forty-three seconds of headroom — 29:17 against a thirty-minute timeout raised for it one commit earlier. The cost is specific to this app: `-race` needs cgo, and the usual assumption that the C library underneath is opaque to the detector is backwards here, because the SQLite driver is pure Go. The detector instruments the entire database engine, in a suite whose premise is that there are no mocks and every test drives a real database file. Raising the number again buys one release and makes every push wait half an hour, and a job that slow is a job people stop reading — which is how the previous breakage survived eight releases. The run assertion exists because a filter that matches nothing still exits 0, and `ok (0 tests)` reads exactly like `ok`, a false green that had already cost an afternoon.

**Approved.** My call, and I approved the split over another timeout raise.

<sub>1.7.5 — `CHANGELOG.md`</sub>

### A composite map key uses an escape, never a literal NUL byte

**Decided.** `CoverPicker.jsx` joins its composite map key with `\u0000` rather than a literal NUL.

**Why.** Ripgrep classified the file as binary and omitted it from every repo-wide search; git classified it as binary too, storing it with CRLF while every other text file in the repo is LF, and giving "Binary files differ" instead of a line diff — so no blame, no merge, and only a choice between two whole copies. The built bundle is unchanged byte for byte, which is what makes it invisible.

**Approved.** Mine, and I approved it as a rule about source files rather than a fix to one.

<sub>1.5.1 — `CHANGELOG.md`</sub>

### .gitattributes names the text types explicitly

**Decided.** The file lists the text types rather than relying on git's auto-detection.

**Why.** Auto-detection is precisely what failed: a lone CR made git call a correct text file binary, which switched normalisation off for the one file that needed it.

**Approved.** My call, and I approved the explicit list over trusting the heuristic a second time.

<sub>1.7.4 — `CHANGELOG.md` · `.gitattributes`</sub>

### Releases are cut automatically from the matching CHANGELOG section

**Decided.** `release.yml` cuts a GitHub Release from the matching CHANGELOG section on every `v*` tag, and is runnable by hand to backfill.

**Why.** The release notes already exist and are already the thing I write carefully. Copying them by hand is a step that gets skipped, and a Release whose body disagrees with the CHANGELOG is worse than no Release.

**Approved.** Mine, and I approved the CHANGELOG being the source rather than a separate notes field.

<sub>0.4.3 — `CHANGELOG.md` · `.github/workflows/release.yml`</sub>

### ":latest" and "X.Y" are claimed by rank, not by arrival

**Decided.** Both moving tags are computed from the tag list, so an old tag rebuilt at any time can move nothing. `X.Y.Z` stays ungated and always publishes.

**Why.** The tag was claimed by whichever build finished last, which is the newest release only by coincidence: that ordering is build completion, not version. On 9 August an orphaned `v1.3.0` tag went up alongside `v1.7.2`, both fired the image workflow, `v1.3.0` built about two minutes slower on a colder cache — and `:latest` came to mean 1.3.0. Anyone tracking it was silently moved back four minor versions, onto a binary with no standalone quotes in it at all. The same accident had a second unfired barrel: `X.Y` was ungated too. `X.Y.Z` stays ungated because an immutable per-release tag is what recovery is done with — it is what was still correct while `latest` was wrong.

**Approved.** Mine, and I approved gating both moving tags rather than the one that had fired.

<sub>1.7.3 — `CHANGELOG.md`</sub>

### The documented release command pushes one named tag

**Decided.** The instruction names the tag and pushes one thing.

**Why.** `git push origin main --tags` sends the whole local tag list, and `--follow-tags` sends every annotated tag reachable from the commit, which is all of them. Either will publish a tag made weeks ago and forgotten, firing its entire pipeline beside the one that was meant. That is how `v1.3.0` — created 4 August, never pushed — shipped on 9 August.

**Approved.** My call; the documented command was mine and so was the tag sitting in my local repository.

<sub>1.7.3 — `CHANGELOG.md`</sub>

### Departures from the plan are recorded in the plan

**Decided.** `synchronous=FULL` and the four-connection pool are recorded in PLAN §8 as deliberate departures, with the reasoning, rather than leaving the plan and the code disagreeing in silence.

**Why.** The silent gap produced the concurrency misdiagnosis. The recorded cause of the concurrent-write 500 was the pool — "PLAN §8 specified a single writer connection, `store.Open` allows four, so serialise them behind a mutex" — and both the cause and the fix were wrong. The real fault was the lock order: almost every write here reads before it writes, and under `DEFERRED` locking that makes `BEGIN` take a read lock the first INSERT must upgrade, which SQLite fails instantly rather than waiting on, so the 5000ms `busy_timeout` was never consulted. It was caught by making the test fail on purpose and reading the error code — `517`, `SQLITE_BUSY_SNAPSHOT`, which names the upgrade — not by re-reading an explanation that had been sitting there being fluent for months.

**Approved.** Mine, and I approved recording the wrong diagnosis alongside the right one.

<sub>1.3.2 — `CHANGELOG.md` · `docs/PLAN.md` · `AI.md`</sub>

### docs/PLAN.md stays; ROADMAP.md and MILESTONE-3.md go

**Decided.** `ROADMAP.md` was replaced by `docs/roadmap.html`, `docs/MILESTONE-3.md` was removed as a one-off build record referenced from nowhere, and `docs/PLAN.md` stays.

**Why.** PLAN.md is cited from roughly 148 places in the code as the record of *why*, and deleting it would orphan all of them. Release history is not duplicated in the roadmap, since the changelog and the releases page already hold it.

**Approved.** My call on all three, and I approved keeping the one with inbound citations rather than the one that read best.

<sub>1.3.1 — `CHANGELOG.md`</sub>

### Docs live as self-contained static HTML with no script

**Decided.** The roadmap and the UI glossary are single self-contained files published beside the demo. The cards, the contents rail and its groups are `<details>` elements, deep-linking into a collapsed card is CSS, and the page icon is an inlined data URI so the page renders identically straight off disk.

**Why.** A doc that needs a build or a network to read is a doc that stops being readable at exactly the moment you need it. The rail was sticky-inside-a-grid first and wrong: a sticky element is constrained by its containing block, engines take that to be the nearest block container rather than the grid area, and at the bottom of the page it slid down over the footer with the two drawing on top of each other. Fixed positioning takes it out of flow and the question cannot arise.

**Approved.** Mine, and I approved the no-script constraint as the reason the rail had to be solved rather than scripted.

<sub>1.3.1 and 1.3.2 — `CHANGELOG.md`</sub>

### The roadmap has no curated list — labels decide the page

**Decided.** Known bugs, accepted requests and Later / maybe are generated from the issue tracker. `bug` + `accepted` for a bug, `enhancement` + `accepted` for a request, `enhancement` + `considered` for something parked. Applying a label needs Triage.

**Why.** There is no curated list left in the repo to drift out of step: I cannot add an entry without agreeing to it in public, and I cannot forget to remove one, because closing the issue removes it. Promotion out of Later / maybe is a label edit on the same issue, keeping the same thread of argument. The Triage gate matters because the roadmap is a public page — an ungated pipeline would put a stranger's title and body on it within a minute. Issue text is escaped, fenced blocks dropped, only paragraphs, lists and `code` spans emitted — but no amount of escaping makes a wrong report right, and that judgement is not something to automate. Prose stays mine where it matters: per-issue `overrides` in the data files replace whatever the form produced, and automation cannot touch them.

**Approved.** Mine, and I approved acceptance being a human step on purpose.

<sub>1.3.2 — `CHANGELOG.md` · `AI.md`</sub>

### Closing the issue is what takes an item off the roadmap, and something checks that now

**Decided.** Culling a section from `docs/roadmap.html` and closing its issue are one job, done in one pass. `node scripts/roadmap-tracker.mjs --audit` reconciles the page against the tracker and exits non-zero on either direction of drift: an **orphan** is open, labelled for the page and no longer on it; a **ghost** is closed and still listed. It reads the page and the tracker, writes nothing at all, and prints the `gh issue close` line instead of running it.

**Why.** The entry above claims "I cannot forget to remove one, because closing the issue removes it". That was true of the *generated* regions and false of the hand-written backlog, which is where the numbered sections live. Removing one is an ordinary edit to prose, and nothing anywhere noticed that an issue number went with it. Four of them — §§1–3 (Quick wins, The review loop deepened, Search precision) and §18 (Verbose, structured logs) — sat open with no section on the page across two releases, while the tracker is the surface anyone outside this repo actually subscribes to. `roadmap-data.mjs --check` cannot catch it, for the same reason it could not catch the nineteen culled items: it validates the generated regions against `docs/data/*.json` and never reads the backlog.

**Why the disposition stays manual.** The audit finds the drift; it does not settle it. Whether an item shipped or was dropped is the whole content of the answer, and GitHub offers two coarse reasons for it — `completed` on something half delivered overstates, `not planned` on the same thing reads as a refusal to whoever asked for it. So the script prints the command and the comment is written by hand: what shipped, what was dropped and why, and whether somebody saying "I still want this" would reopen it. A script that closed issues by itself would turn a public no into a silent one.

**Instead of.** A fifth CI gate. It needs a live tracker read, so it would put a contributor's pull request at the mercy of what is happening on the issue tracker and go red for maintainer bookkeeping that has nothing to do with their diff. It is a step in the cull, not a property of the tree — which is also why it lives in `roadmap-tracker.mjs`, the script that already holds the `gh` dependency, rather than becoming a fourth roadmap script.

**Approved.** The owner's, who asked whether the roadmap culls had been closing the issues behind them — they had not — and for the closing to become part of the pass rather than something I remembered.

<sub>1.16.x — `scripts/roadmap-tracker.mjs` · `DEVELOPMENT.md`</sub>

### Every roadmap write is guarded and keeps a backup

**Decided.** Each write keeps the previous page in `docs/roadmap.backup.html` and is refused outright if the render loses a marker, unbalances `<details>` or shrinks the page implausibly. `tracker.json` only re-stamps its timestamp when the tracker state actually moved.

**Why.** A bad run should be a failed job, not a broken published page. The timestamp rule exists because any issue event at all — a comment, a label edit — rewrote the file and the bot committed: two label edits produced three commits whose entire content was a new timestamp.

**Approved.** My call, and I approved the shrink heuristic even though it is crude — an implausibly short page is the failure that would otherwise ship.

<sub>1.3.2 — `CHANGELOG.md`</sub>

### Issue-form labels are recovered from the form's field headings

**Decided.** The workflow reads the form's own field headings to work out which template was used, and only ever adds a label.

**Why.** An issue form's `labels:` block is applied with the *author's* permissions, and labelling needs Triage — so `labels: ["bug"]` did nothing for exactly the people the pipeline exists for, and an outside report would never have reached the page. The field headings are better evidence than the title prefix, which is a prefill the reporter can edit away. Add-only, so a label removed on purpose stays removed.

**Approved.** Mine, and I approved the add-only rule as the part that keeps my own triage decisions from being undone by a re-run.

<sub>1.3.2 — `CHANGELOG.md`</sub>

### A plan lives in docs/plans/ until it ships, then folds into this document and retires

**Decided.** `docs/plans/` holds one file per feature that is **designed and not yet built**. The moment it ships, its decisions are folded into this log — with a pass recording where the plan was wrong — and the plan file is deleted. The directory is therefore always a list of what is coming, never an archive. `docs/PLAN.md` is the opposite: only work already released.

**Why.** They are different documents doing different jobs, and the separation was right. What was missing was the second half of it — an exit. A plan for a feature that shipped six releases ago is a design document sitting in a directory whose whole promise is "this is not built yet", and it goes stale in the one way that cannot be detected: every sentence in it was true when written, and some of them are still true, and nothing marks which. That is precisely the failure that turned this file from a design document into a log. Leaving the plans in place reintroduced it one directory over.

There is a second cost, and it is the one that made this concrete. Decisions taken at plan time are logged here with the plan file as their source. Twenty-five grey lines cited one of the three. **Fourteen still read *planned*** for features that had been running for months — a reader skimming the log would take a built feature for a proposal, which is the same class of wrong as an overturned decision left standing — and **six named no release at all**, which is the same fault with the evidence missing.

**Instead of.** Keeping the shipped plans as historical design records. Rejected on the argument above: git already holds them, and a file in a *forward* directory is read as forward whatever a header says.

**Reversal.** Supplements the original decision rather than overturning it. The separation stands; what changes is that it now has a direction and an end. The earlier entry read: *"Forward build plans for unreleased features — `trash-and-undo.md` (1.8.0), `context-menu-and-multiselect.md` (1.9.0), `search-facets.md` (1.10.0) — live under `docs/plans/`. `docs/PLAN.md` stays where it is."* All three shipped; all three were folded in and deleted at 1.14.2, which is when the rule got its missing half.

**Approved.** Mine. The separation I approved before the first plan was written; the retirement I approved after three had shipped and none had left.

<sub>1.7.x · retired at 1.14.2 — `docs/PLAN.md` · `DEVELOPMENT.md`; the three plans are in git</sub>

### Verification against the tree changed the plans before any code was written

**Decided.** Each plan opens with a "What already exists" table verified against a named commit — `09f8a5b` (v1.7.3) — and records what verification changed.

**Why.** Verification moved real claims. The trash plan's earlier draft budgeted work for reindexing after a restore; the FTS triggers already cover insert and delete, so the index follows the rows and the worry was unfounded — worth stating precisely because 1.7.1 genuinely was bitten by an external-content index. It also found that `id INTEGER PRIMARY KEY` is a rowid alias on all five tables, so SQLite *does* reuse a freed id when the deleted row held the highest — which is the common case, since you delete the thing you just added — and that turned "restore the original id" from a one-line decision into an open question with three costed answers. The search plan found the context-aware half already built and already deliberate; what was missing was that nothing on screen said which scope you got.

**Approved.** Mine, and I approved planning against the tree rather than against my memory of it.

<sub>1.7.x — retired into this document at 1.14.2; the plans are in git</sub>

### Every decision in the three feature plans is a settled answer, and the unsettled one says so

**Decided.** Each plan carries a Decisions table of question-and-answer pairs marked "All vetted", with the cost named where a decision cost something. The one point still open — what "ids reserved" actually costs — is written up as an open question with three options and a recommendation, and the rest of the plan is written to be independent of the answer.

**Why.** A plan whose decisions are implicit is a plan that gets relitigated mid-build, at the worst possible moment. Naming the single unsettled point is what lets the other forty be treated as closed.

**Approved.** Mine — every row in those tables is a decision I took and approved, and the open question is flagged precisely because I have not.

<sub>1.7.x — retired into this document at 1.14.2; the plans are in git</sub>

### AI review is worth more than AI code, and it is the same model

**Decided.** 1.4.2's design went to three adversarial reviewers before a line was written — one asked to attack the cryptography, one disaster recovery, one the Go implementation.

**Why.** Between them they killed the design. The recovery key was to live in a column of the `users` table; a restore replaces that table wholesale, so restoring any archive, resetting the instance, or deleting the account would have destroyed the key silently, with the only surviving copy in a directory the next restore deletes. Two of the most ordinary operations there are, in order, no error at any point. The same reviews disproved a claim I had already published in the 1.4.1 release notes — that renaming an account orphaned its archives — by pointing at the two lines that make it false. The fix for both was to make the design smaller. What changed was not intelligence but *stance*: "find what is wrong with this" is a different question from "build this", and it is the one that was not being asked.

**Approved.** My call to run the reviews and my call to accept their verdict; I approved scrapping two designs before the third.

<sub>1.4.2 — `AI.md` · `CHANGELOG.md`</sub>

### What is checked is published alongside what it does not cover

**Decided.** `AI.md` states what runs — the Go tests over real HTTP handlers against a real SQLite database, the frontend suite, the CI gates — and then lists, at greater length, what that honestly does not cover.

**Why.** "AI-assisted" describes everything from a tab-completed variable name to a wholly generated codebase, and a bare list of passing checks reads as a guarantee. The counter-list is the more useful half: passing tests are not proof, confident documentation is not verified documentation, consistency is not something you can review for, a bug report is a report of a symptom, and a confident diagnosis is worth no more than confident code. Counts are given with the command that produces them, because a number in a file like that one is stale the moment it is written.

**Approved.** Mine, and I approved the second list being longer than the first.

<sub>1.4.2 onward — `AI.md`</sub>

### The AI audit trail is the git history itself

**Decided.** Nearly every commit carries a `Co-Authored-By:` trailer naming the model that worked on it, the counts are published with the commands that reproduce them, and the four trailerless commits are accounted for one by one.

**Why.** A claim about provenance that cannot be checked is a claim. One trailerless commit adds attribution URLs to the README and was typed by hand; the other three are `github-actions[bot]` regenerating the roadmap's known-bugs block from the tracker, which is machine-written but not AI-written — and that distinction is the point of the file: a script that renders JSON into HTML is not a model making choices. The agent configuration under `.claude/` is gitignored, so what is published is the output, not the toolchain.

**Approved.** My call, and I approved naming the four exceptions individually rather than rounding the number.

<sub>1.4.2 onward — `AI.md`</sub>

### Attribution is a stated requirement, not a courtesy

**Decided.** README names Google Books, Open Library, Amazon, TMDB and TheTVDB as sources, states explicitly that the product uses the TMDB and TheTVDB APIs but is not endorsed or certified by either, and credits `pretext`, the CC0 Textures packs, and Bookcision and Readest as read import formats.

**Why.** Named as part of the AI-provenance position: what was borrowed is credited by name, and design influences are named where they apply — the Radarr-style status bar, the `*arr`-style cover folder — "so an idea taken from elsewhere is attributed rather than passed off". Closing invitation: "If you spot something in here that belongs to someone else and is not credited, that is a bug worth an issue."

**Instead of.** Omitting the not-endorsed language — required by the API terms and stated anyway.

**Approved.** Mine, and I approved treating an uncredited borrowing as a bug class rather than an oversight.

<sub>? — `README.md` · `AI.md`</sub>

### DEVELOPMENT.md exists for people who would rather fork than file

**Decided.** Building and running it, the two rules the code enforces that are easy to break, how migrations and the `_txlock=immediate` pragma constrain a new transaction, the pull-request conventions, and a list of every string that still says my name.

**Why.** MIT means somebody may well want their own thing rather than a patch to mine, and the name list is the difference between a fork that takes an afternoon and one that takes a week of grepping.

**Approved.** My call, and I approved the name list specifically — it is the part that assumes somebody will leave.

<sub>1.3.2 — `CHANGELOG.md` · `DEVELOPMENT.md`</sub>

### The site root is a real HTML landing page; the demo moved down to /demo/

**Decided.** The published site's canonical URL is a written landing page. The demo is one click away at `/demo/` and still rebuilds on every UI change.

**Why.** Tippani did not come up in a search for its own name, and the reason was not subtle: there was nothing to return. The canonical URL served the demo — an empty div until JavaScript runs, titled `tippani`, with no description, no social preview, no sitemap and no robots.txt. A crawler found a single lowercase word competing with the Hindi and Bengali word the project is named after, and no text at all. It had been the other way round, which put the least readable page in the repository at the most important URL.

**Approved.** Mine, and I approved demoting the demo rather than bolting metadata onto it.

<sub>1.7.6 — `CHANGELOG.md` · `docs/landing.html`</sub>

### The app's index.html gets no og:url and no canonical

**Decided.** The app's own `index.html` carries a title, a description and Open Graph tags, but deliberately no `og:url` and no canonical link. `og:image` is absolute because a relative one is dropped.

**Why.** That same file is embedded in the binary and served by every self-hosted instance, so a hardcoded URL would tell a crawler that somebody's private library *is* the public demo. Omitted, a crawler uses the URL it actually fetched, which is right in both cases. The image has no such choice, and the worst case there is a private instance borrowing the public screenshot for its preview.

**Approved.** My call, and I approved the asymmetry between the two tags rather than treating them as one setting.

<sub>1.7.6 — `web/frontend/index.html`</sub>

### Every local link on the published site is checked before deploy

**Decided.** `scripts/site-links.mjs` walks the assembled `_site`, resolves every href/src and CSS `url()`, and fails the deploy on any unresolved local link. It also refuses to pass if it finds fewer than ten links.

**Why.** The site is assembled by copying, not by a build that understands links, so every failure mode is silent and identically shaped: a copy step that stops running, a screenshot renamed on one side of a move, a relative path written for the old layout. Moving the demo made the last one live — `href="roadmap.html"` from inside the demo used to be correct and now points at /demo/roadmap.html, a 404 reached only by clicking the ribbon. The ten-link floor exists because a sweep whose extractor broke reports a clean site by looking at nothing.

**Instead of.** Trusting the copy steps (the status quo, which hid three classes of breakage). A build system that understands links (larger change than the site warrants).

**Approved.** Mine, and I approved the floor as the part that keeps the sweep honest about itself.

<sub>1.7.6 — `scripts/site-links.mjs` · `.github/workflows/pages.yml` · `CHANGELOG.md`</sub>

### The demo's install manifest is rewritten in place, and the app's copy is left alone

**Decided.** A post-copy step rewrites `_site/demo/manifest.json` to relative `start_url`, `scope` and icon paths. The app's own manifest is untouched.

**Why.** The manifest's root-absolute paths are correct for the self-hosted app and wrong for a site served from a sub-path — they pointed at the domain root and 404'd, and had done since the manifest was added. Vite's `--base` rewrites `index.html` only, never a copied public asset, so nothing caught it. For the app it was never wrong, so the fix belongs to the published copy rather than the source.

**Instead of.** Making the source manifest relative (would be wrong for the self-hosted app, which is the primary consumer).

**Approved.** My call, and I approved fixing the copy rather than the source on the grounds of who the primary consumer is.

<sub>1.7.6 — `.github/workflows/pages.yml` · `CHANGELOG.md`</sub>

### Every screen is mounted by a test, because extracting the logic left the screen unexecuted

**Decided.** `test/dom/screens-mount.test.jsx` renders all thirteen screens and asserts none throws. The list is checked against the `data-screen-label` attributes in `App.jsx`, so a screen App can route to and this file does not name is a failure. `Login` and `Onboarding` are exported from `App.jsx` for it. The api is mocked to REFUSE every request.

**Why.** 1.13.0 shipped a Quotes screen that threw on sight — `board` was read in three dependency arrays written above its own `const`, and a dependency array is not a closure, so it was evaluated inside its own temporal dead zone. Every render, every library, empty or full, replaced by the error boundary. It survived a release, a point release, and two servers.

**The reason no test caught it is the part worth keeping.** Ten tests covered that file and every one of them imported a FUNCTION out of it — `groupUtterances`, `utteranceState`, `utteranceMeta`, `utteranceYear`. Extracting logic from a component so it can be tested without rendering a screen is right, and it is precisely what left the screen itself never once executed. **A page can be wholly broken while every extracted piece of it is green**, and the greener the pure tests are, the more convincing the illusion. So the coverage this adds is not depth, it is the one assertion those ten could not make.

**Shallow on purpose.** It claims only that a screen can be put on a page. The screens with behaviour worth pinning have their own files; a smoke test that starts asserting content becomes a second, worse copy of them and rots.

**Refusing every request rather than returning empty collections.** A failed load needs no invented payload shapes, so this file cannot quietly become the place where thirteen response formats are guessed at and left to drift. It also exercises the state every screen must survive and nobody tests by hand: the server said no. A first-render throw happens before any fetch settles, so the mock's answer is irrelevant to catching the class of bug that prompted it.

**Driven by the source rather than by a list.** The same shape as the FTS-sweep completeness test: a table maintained beside a file is a table that rots, so `App.jsx`'s own screen labels are the authority and adding a screen without covering it fails.

**Verified by reverting the fix** — the quotes case fails with `Cannot access 'board' before initialization` and passes with it. A regression test never watched to fail is a test of nothing.

**Approved.** The reader's, in the form of the report: "quote screen now shows: can't access lexical declaration 'Se' before initialisation", later confirmed on a second server with quotes already in it.

<sub>1.13.2 — `web/frontend/test/dom/screens-mount.test.jsx` · `web/frontend/src/Quotes.jsx` · `web/frontend/src/App.jsx`</sub>
