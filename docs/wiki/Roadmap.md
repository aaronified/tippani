# Roadmap

Source of truth: this wiki page.

What is built, what is next and what is only being thought about. Each backlog section is tracked by an
[issue](https://github.com/aaronified/tippani/issues); the detail of what is designed but not built is in the
[plans](Plans-Index.md), and every decision that shaped what is here is an [ADR](ADR-Index.md). What has shipped is in the
[changelog](https://github.com/aaronified/tippani/blob/main/CHANGELOG.md). A plan is done when it is built: it is then folded
into an ADR and its page is deleted.

## Built

Up to 3.4.1, see the changelog. In brief:

- A self-hosted home for book highlights, film and show dialogue, and quotes from anywhere else, in one static Go binary with
  the app embedded. Import from Kindle, Readest, Bookcision, Hardcover, Goodreads and IMDb; export and round-trip as Markdown.
- A spaced-repetition review loop with a daily deck, themed rounds and a recall log; anthologies that fill themselves and
  export as a book; boards, cards and share images with a person's signature.
- People, credits and metadata from TMDB, TheTVDB, IGDB, Google Books, Open Library and Amazon, with the supplier of every
  field recorded and a picker to choose another.
- Jobs and logs on the server: fetches, imports and backups run as queued jobs that survive closing the tab.
- Backup, restore and a bin that can take a delete back; eight material sets, per-surface materials, type dials and a
  Bengali interface.
- An author with a sparse Open Library record gets a portrait and a Wikipedia link through Wikidata, found via one of their
  books ([#7](https://github.com/aaronified/tippani/issues/7), closed; [ADR-0154](ADR-0154-Wikidata-Was-Dropped-As-A-Metadata-Source-Then-Re-Admitted-For.md)).

## Built in 3.4.0

The files a work's quotes came from, which the app used to refuse to hold:

- **A work keeps its source file**: a subtitle track for a film or episode, an ebook or text for a book or an essay, lyrics for
  a song. It is never rendered and never served back; what leaves the server is extracted text. Added from the work's card and
  panel, or by dropping it on the import screen, which asks which work. ([ADR-0904](ADR-0904-Decisions-Are-Records-One-Page-Each.md)
  records how decisions are kept now; the source-file decisions are in the ADRs from ADR-0905.)
- **Context**: the lines or paragraphs around a quote, stored when the file is added, so "In context" opens instantly and works
  with the file gone. It stops at a chapter edge and a long silence.
- **A mounted library**: the administrator mounts the folders the library already lives in, read-only; a scan proposes which
  file belongs to which work (by a folder's id or an ebook's ISBN, or by name) and nothing is attached until you accept.
- **Times from subtitles**: proposed for film lines, shown with the file's own words, accepted singly or together when the
  match is exact.
- **Context size rules**: how much shows around a quote follows the quote, then its work or board, then your own setting, then the
  default, and the panel says which. A rule can only lower what is wider than it, never widen
  ([ADR-0914](ADR-0914-Context-Size-Is-A-Cascade-That-Only-Clamps-Down.md)).
- **Corrections from the file**: Checks proposes the file's own wording where it differs from a saved quote, in named buckets,
  applied per bucket or per row and never written until accepted
  ([ADR-0915](ADR-0915-Corrections-Come-From-The-File-As-Proposals.md)).
- **Book locations**: for a book with an attached EPUB, Checks proposes the chapter and a percent-through of that file, never a page
  or a Kindle location ([ADR-0916](ADR-0916-A-Books-Location-Is-A-Percent-Of-This-File.md)).
- **The book's own EPUB as a metadata source**: fills gaps, and can be chosen for any field at any time.
- **The prune**: keep what was read from a file and delete the file; **the bin covers it all**, including the file.
- No text shadow anywhere: a label and its icon read the same
  ([ADR-0911](ADR-0911-No-Shadow-On-Text.md)). The documentation moved into the wiki
  ([ADR-0912](ADR-0912-Documentation-Lives-In-The-Wiki.md)), and the frontend test suite was cut to the tests that name behaviour
  ([ADR-0913](ADR-0913-A-Test-Names-Behaviour-Or-Is-Lint.md)).

## Built in 3.4.1

- One press of Scan walks a whole library folder as a resumable job, in slices that do not block other jobs, with progress,
  findings and seen files kept in the database. See [ADR-0917](ADR-0917-A-Library-Scan-Is-One-Press-And-A-Job.md).

## Next week (from 26 October 2026)

Updated on 31 October so the work can be picked up from this page alone, with no chat to read. Work it in this order. Each
item is its own commit.

**Where things stand.** The latest release is **3.4.2**. `main` holds nine commits after it that are **pushed on 31 October but not in
any release**: the found-file row fix (`2c316041`) and, on top of it, #58, #62 (leading article, AZW3), #60, #59, MOBI/AZW3 and
PDF reading, and multi-language matching. The owner said not to release yet, so nothing was tagged or bumped. The last
commit is the `web/dist` rebuild. Go tests pass apart from the Windows-only failures listed under "Facts that save time" and
four in `cmd/tippani` and one in `updater` that say "not supported by windows" or fail on a path separator (not re-run on the
old commit). Frontend tests (483) and both wiki checks pass.

**Done this week** (each has an ADR):

- [#58](https://github.com/aaronified/tippani/issues/58): a highlight keeps its own location and the file proposes the chapter
  ([ADR-0919](ADR-0919-A-Highlight-Keeps-Its-Own-Location-And-The-File-Proposes-The-Chapter.md)).
- AZW3, MOBI, AZW and PDF are source files; a leading article is ignored when matching titles
  ([ADR-0918](ADR-0918-Kindle-Files-And-PDFs-Are-Source-Files-Read-By-Their-Text-Alone.md), part of
  [#62](https://github.com/aaronified/tippani/issues/62)).
- Quotes match in Bengali, Hindi, Thai, Japanese, Chinese, Russian, Arabic and accented text
  ([ADR-0920](ADR-0920-A-Quote-Is-Matched-In-The-Script-It-Was-Written-In.md)).
- [#60](https://github.com/aaronified/tippani/issues/60) (quote card action row is one line on a phone) and
  [#59](https://github.com/aaronified/tippani/issues/59) (edit form context block starts folded), written by an agent
  ([ADR-0921](ADR-0921-A-Quote-Card-s-Row-Is-One-Line-On-A-Phone.md),
  [ADR-0922](ADR-0922-The-Context-Block-On-A-Quote-Form-Starts-Folded.md)). **Neither was checked in a browser at phone width**,
  and `make controls` and `make typescale` were not run.

**What is left, in order:**

1. **Finish the UI review** ([#57](https://github.com/aaronified/tippani/issues/57)). #60 and #59 were checked on a phone and
   hold, and six layout faults were fixed ([ADR-0923](ADR-0923-The-First-UI-Review-Pass-Is-Measured-On-A-Phone-Screen-By-Screen.md)).
   Still to do: run the Firefox harnesses (`typescale`, `metadata-layout`, `frame-scroll`, `panel-depth`) on Zen with
   `MOZ_NO_REMOTE=1`; record `controls-baseline.json` again on a run that matches CI (its glyph-with-words ceiling of 9 fails on
   3.4.2 as well as now, with 14); find out why `controls.mjs`'s desktop pass dies with "detached Frame" under Edge; and capture
   what the pass skipped: a work's source section, an episode's file, the Add surface.
2. **Release.** 3.5.0 is cut by the `release` workflow, which makes the tag, the changelog section and the image build from a
   version typed into it ([ADR-0924](ADR-0924-The-Release-Workflow-Cuts-The-Version-From-The-Unreleased-Changelog.md),
   [Releasing](Releasing.md)). Its first real run is its test. Two commit bodies (`2a989130`, `242013bb`) name ADR-0918 and
   ADR-0919 where the pages are now 0921 and 0922.
3. **Rest of [#62](https://github.com/aaronified/tippani/issues/62):** the Source files row does not say why a work has no
   file. Chak De! India and Battlestar Galactica S04E20 have no subtitle file to find.
4. **Read quotes aloud** ([Plan: read aloud](Plan-Read-Aloud.md), issue
   [#12](https://github.com/aaronified/tippani/issues/12)): the browser's own speech, no service. Nothing blocks it. The plan
   was verified against `75e55ae` (28 September), so re-verify it first, as its first task says.
5. **Anthology enhancements** ([Plan: anthology enhancements](Plan-Anthology-Enhancements.md)): in progress as separate pull requests. Done: removed entries with a way back (0088), sections and grouping (0089), drag and Move to… (the owner chose, 1 November 2026, to give the anthologies their own drag and let Episodes reuse it: it is `reorder.js`). Left: front matter, reading mode, print polish, work identity in the Markdown, the import re-link by identifier, and the group headers in the export. The plan's ticks say which.

**Questions for the owner**, kept until asked:

1. Should there be an opt-in to replace a Kindle location with the file's percent? It is no longer offered.
2. Should Kindle chapters come from the file's real contents index (INDX) instead of the nearest heading?
3. Scanned PDFs have no text layer and are refused. Add OCR, or leave them refused?
4. The #59 folded heading reads "In context" (an existing label), not the issue's "Context from <file>". Change it?
5. Should the "why this work has no file" text be added to the Source files row (#62)?

**Leftover housekeeping.** Two agent worktrees remain under `.claude/worktrees` (`agent-a5e3796460a78da5c`,
`agent-a69f8257601ac30aa`) with their branches. A stash, `WIP on (no branch): 5f7832c Mobile UX fixes...`, pre-dates this work
and was left alone.

**Email automation.** The report address `tippanidev@gmail.com` exists. It is for the bug-report flow in
[the Android app plan](Plan-Android-App.md) (feature 4): the app opens the reader's mail app addressed to it, and a GitHub
workflow reads the inbox and files issues. Use it when that work starts. The owner still has to turn on 2-step verification and
IMAP, make an app password and add it as a repository secret; no password goes in the repository.

**Also open, not scheduled.** [#56](https://github.com/aaronified/tippani/issues/56): the dashboard widget should show library
scan items (files found, scans running). The [Android app](Plan-Android-App.md) plan
([#61](https://github.com/aaronified/tippani/issues/61)) is proposed and not queued; it waits for the owner's answers on its
open questions.

**Facts that save time**

- The library scan is one job per folder, run in 60-second slices that queue the next slice. A stalled database write answers
  a 503 "busy" (`TIP-JOBS-004`). A stuck request writes all goroutine stacks to the container log.
- Local runs on Windows have known failures that are not bugs here: four `scratch-sweep` rules tests, three `store` migrate
  tests and two `httpapi` tests (`TestAFailedFactoryResetLeavesSignInWorking`,
  `TestARowShowsTheNewestOfASuppliersTwoAreas`) fail on Windows temp-directory behaviour. CI on Linux is the check for Go.
- CI has shown load-related flakes: the Wikidata signature journey (it calls the real internet) and one Stop timing test.
  Journeys do not retry on purpose; a journey that fails twice is a bug.
- `web/dist` is rebuilt (`make frontend`) as its own last commit before a push; the generated glossary is `npm run glossary`.

## Known bugs

These are the open [bug issues](https://github.com/aaronified/tippani/issues?q=is%3Aopen+label%3Abug).

- [#14](https://github.com/aaronified/tippani/issues/14): catalogue exports written by 1.1.0 or earlier can re-import as books.
  1.1.1 made the export always write `type: movie` or `type: show`, which routes a file back to the right importer; older files
  carry nothing identifying them, and a detector cannot infer what the file never recorded. Re-export it, or add a `type:`
  line by hand. It stays listed rather than pretending to be fixable.
- [#46](https://github.com/aaronified/tippani/issues/46): Profile at 175% text scrolls 5 px sideways on a phone, and its
  avatars are drawn as rounded squares.
- [#49](https://github.com/aaronified/tippani/issues/49): under CPU throttling the film-line journey's second case lands on
  Sign in, as if the session cookie were dropped.
- [#53](https://github.com/aaronified/tippani/issues/53): CI on main goes red on time budgets: httpapi near its 20-minute
  `go test` timeout, and a journey case at 60 seconds.
- [#54](https://github.com/aaronified/tippani/issues/54): the works filter journey's "complete" guard cannot fail for a
  predicate that forgets a gap.
- [#55](https://github.com/aaronified/tippani/issues/55): Metadata → Works puts the "all" pill last of fifteen, where the
  design pack puts it first.
- [#58](https://github.com/aaronified/tippani/issues/58): the Locators section does not propose chapters or locations from the
  attached EPUBs.
- [#60](https://github.com/aaronified/tippani/issues/60): on a phone the quote's bottom action bar uses two rows.
- [#62](https://github.com/aaronified/tippani/issues/62): some works get no file from the scan: a leading "The" in a title,
  AZW3-only books, and works with no subtitle file.

## Still to build from the source-file work

What is left of [Plan: work source files](Plan-Work-Source-Files.md) and [Plan: locators from files](Plan-Locators-From-Files.md):
a bulk-editor screen for the per-quote context span fields (the endpoint exists), corrections for ambiguous matches, an undo for an
accepted correction, a per-file "skip the mark buckets" and a note about the file itself, and book locations from an EPUB's page list of
publisher pages (MOBI, AZW3 and PDF are built: [ADR-0918](ADR-0918-Kindle-Files-And-PDFs-Are-Source-Files-Read-By-Their-Text-Alone.md)).

## The backlog

Everything still ahead, in priority order, in three bands. Nothing that has shipped is listed here — that lives in the [changelog](https://github.com/aaronified/tippani/blob/main/CHANGELOG.md), and a roadmap that doubles as a trophy cabinet stops answering the only question it is for.

**The § number is a position and nothing else.** It moves whenever the order does. The stable reference is the issue that tracks the section, and that is what the § heading links to. Cite the issue; the position is just where I would reach next.

### Next

What I would pick up now. Short, mostly cheap, and each one either removes a daily friction or is the thing this app can be distinctly better at.

### §1 Account, continued — sign-in and tokens ([#17](https://github.com/aaronified/tippani/issues/17))

All local — no email round-trips anywhere in this section, which is the constraint that decides most of its shape.

- **Sign in through the reverse proxy you already run** — **OIDC**, and the cheaper half first, **forward-auth**: trust a configured identity header when `TRUSTED_PROXY` is set, which is the same trust boundary the login rate limiter already reasons about for `X-Forwarded-For`. Anyone fronting their box with Authelia, Authentik or Tinyauth wants their whole estate behind one sign-in, and it is the most-asked thing on this list. Local passwords stay, and stay the default.
- **Stronger sign-in (opt-in)** — **passkeys (WebAuthn)** and **TOTP 2FA** layered over today's password + hashed-token sessions, for boxes reachable past the LAN. Off unless you turn it on; the password stays the fallback.
- **Scope the API tokens, and add webhooks.** Device tokens exist; what they have no notion of is *scope* — a token that may read stats but not write quotes, which is what an Obsidian sync or the dashboard widget actually wants. Outbound **webhooks** on events are the other half.
- **List and revoke browser sessions individually.** Paired devices can each be unpaired by name, but browser sessions can only be dropped all at once by changing your password — so "sign out that other laptop" currently means signing out everything.

### §2 Mobile & PWA — offline first, then gestures ([#22](https://github.com/aaronified/tippani/issues/22))

Tippani installs as a PWA and then behaves like a browser tab with a nicer frame, because there is **no service worker at all**. That is the real reason it doesn't feel native — more than any missing gesture — and it is the first thing here.

Cache the shell and recently-viewed data, queue writes while offline, flush on reconnect. A queue flush *is* a burst of concurrent writes, so it needs a retry path that distinguishes "the box is busy" from "the box refused", and the write path underneath it now behaves well enough to write one against.

#### Gesture ground rules

Today the only gestures are scrolling, the drawer's swipe-to-close, and dragging a control thumb or a sticker. Adding more is worthwhile, but a web app that fights the operating system for a swipe loses, so the constraints come first and apply to every gesture below.

- **Nothing starts at a screen edge.** Ignore any gesture whose first touch lands within ~32 px of the left or right edge — that belongs to the iOS back-swipe and the Android back-gesture — or in the bottom home-indicator strip. No code measures this today, so it gets written rather than reused.
- **Prove direction before capturing** — 10 px on the dominant axis, dominant by about 1.5× — so a gesture can never steal a scroll.
- `touch-action: manipulation` on card chrome to drop the double-tap-zoom delay; `touch-action: none` only on the element that owns a gesture, never on a scrolling ancestor.
- **Every gesture is additive.** The ⋯ overflow, the ♥ button and the filter sheet all stay exactly as they are. That is both the accessibility requirement and the answer to how anyone discovers a gesture in the first place.
- One Settings toggle turns card gestures off wholesale. `prefers-reduced-motion` is already honoured; the toggle is not.
- `navigator.vibrate(10)` on commit — Android only, iOS Safari has nothing — which is most of what makes a gesture feel deliberate rather than accidental.

#### The set, in build order

1. **Double-tap a quote card** to toggle ♥. Understood everywhere, and it gets the same heart-bloom the button does.
2. **Pull down at the top of a list** to refresh. Standalone display mode suppresses the browser's own pull-to-refresh, so this is mine to implement, with progressive feedback and `overscroll-behavior-y: contain`.
3. **Long-press a card away from its text** for the ⋯ menu as a sheet — today it selects the card, or anchors a menu.
4. **Swipe up or down on a review card** for *got it* / *forgot*. The best fit in the whole list: vertical, so it cannot collide with either platform's back gesture — the Anki-mobile pattern rotated onto the safe axis — and a review card isn't a scroll container, so there is nothing to conflict with. A tap still reveals, and the buttons stay.
5. **Swipe down to dismiss a bottom sheet.** `MobileSheet` already exists, the gesture lives entirely inside it, and every native sheet works this way.
6. **Pinch the Library or Catalogue grid** for cover size and density — the direct-manipulation form of the Settings sliders that already exist, snapping to the same discrete sizes.
7. **Pinch and double-tap inside the cover Lightbox** to zoom and pan. The one place native zoom semantics are the right answer, so implement them rather than suppressing them.
8. **Double-tap the top bar** to scroll to top, riding the scroll memory that is already there.
9. **Long-press ＋ Add** for a quick-action sheet, so the same actions the installed app icon already offers on a long-press are reachable from inside the app.
10. **Two-finger tap to undo** — genuinely unclaimed on both platforms, and it pairs with the delete-undo toast that already exists.
11. **Long-press a colour swatch** to make it the default for new captures.
12. **Drag to reorder** anthology entries and staged-import groupings; the sticker drag already proves the primitive.

Two more are unblocked now that **trash & undo (§1)** has landed and a mis-swipe is recoverable: **horizontal swipe inside a card's own bounds** for share/edit/delete, Gmail-style, rubber-banding back below threshold and never deleting on the swipe alone; and **horizontal swipe on a work-detail hero** for previous/next work in the current filtered order, which is the riskiest of the set for being screen-width and horizontal, so it stays on the hero and never the whole page.

One is rejected outright, recorded so I don't revisit it: **swiping between the four bottom-nav tabs**. It is a screen-width horizontal gesture that fights the back gesture at both edges and any horizontally scrollable content in between, and the bottom bar is already one tap away.

Discoverability rides the existing spotlight: a short gesture chapter in the tour. The help panel already draws the two gestures that exist — the long press and the drawer's leftward swipe — so a gesture added here arrives with a clip waiting for it.

### After that

Wanted, argued for, and not blocking anything above. Roughly ordered, but the boundary between one of these and the band above is a week of my attention rather than a decision.

### §3 Capture from anywhere (share-target + bookmarklet) ([#19](https://github.com/aaronified/tippani/issues/19))

Low-cost ways to get text in without a file:

- **PWA share-target** — Tippani already installs as a PWA, so register it as a share target: "Share → Tippani" from any app (a reading app, a browser, your phone's own text selection **or its built-in OCR**) drops straight into quick capture. This is also how a photographed page gets in — the phone recognises the text, you share it.
- **Bookmarklet** — one click that POSTs the current page's **raw HTML** to Tippani, parsed server-side by reusing the existing Hardcover / Goodreads / IMDb HTML importers. Deliberately minimal: just the page, no Bookcision-style JSON layer to install or keep working.
- **Paste a pile** — one textarea, blank-line separated, becomes N staged quotes on one work. The "just let me dump what I typed in Notes" path that every parser-based importer misses.

### §4 Anthologies — ordered, curated collections of quotes ([#18](https://github.com/aaronified/tippani/issues/18))

A named, ordered list of quotes drawn from anywhere in the library, carrying prose of its own: an introduction, and my commentary between the entries. It is not a tag with a nicer hat — the two things a tag cannot do are **hold an order** and **hold your writing**, and those are the whole point.

This is the missing *output* of a commonplace book. Everything in Tippani today points inward: you file a passage, you find it again, you get asked about it. An anthology is what you make *from* the collection — a sequence you arranged, on a theme you chose, with the connective tissue that explains why these twelve passages belong next to each other. Letterboxd's lists are the closest proven form; the nearest thing in the annotation world is Zotero's extract-annotations-into-a-note, which is the most-used feature it has.

**Most of this shipped.** The API landed in 2.0.0, the screen in 2.1.0, and 2.1.2 added the themed round and per-anthology field visibility — six switches deciding what each passage shows, governing the reading view and the Markdown alike, so a collection of film lines can name its actors and a book of proverbs can carry nothing but the words. Composing works from any selection, the per-entry commentary is there, and the Markdown export round-trips.

**And the rest shipped by 3.0.0** ([#18](https://github.com/aaronified/tippani/issues/18), closed): EPUB export, a small book of your own quotes, built with the standard library's `archive/zip`. What comes next is its own card below, [Anthologies you can arrange and print](#anthology-enhancements).

### §5 Help & density — one registry, four consumers ([#23](https://github.com/aaronified/tippani/issues/23))

The registry, `web/frontend/src/help.jsx`, keys the help copy by screen; the words live in the locale files. The tour and most info dots resolve out of that same file under namespaces of their own, and the glossary is hand-written English — so the same control is still described more than once. Making it a *single* source is what is left, and it only gets more expensive.

**The panel's own shape shipped in 2.0.1** and is not what remains here: an entry is now one front-loaded sentence with the rest folded behind a *more*, capped by a test, with a rail of screen sections, live swatches and drawn gestures. That work made this section *cheaper* rather than smaller — an info dot needs one short sentence, and there is now one short sentence to read.

- **The info dots should read from it.** The panel does; the dots still carry their copy inline, which is precisely the drift this section exists to end.
- **[The UI glossary](UI-Glossary.md) should be generated from it** — `glossary-css.mjs` already feeds it the built CSS and gates that in CI. The copy is the half still written by hand, and the likeliest to go quietly stale.
- **The tour should read it too.** Step copy and panel copy overlap today and neither knows about the other; the same change has already had to be made twice by hand, which is the argument.
- **Deep links** — `/library?help=filters`. Not "add a key": the shell parses a *pathname* and pushes a *path*, with no `URLSearchParams` anywhere, so whoever builds this builds the app's first query-string state.
- **The completeness test.** Tests already pin every screen to an entry and every entry to copy; the third clause — every dot resolves to a key — is unwritten, and the 33 English literals still sitting in eight files are why.

### §6 Access & reading comfort ([#32](https://github.com/aaronified/tippani/issues/32))

**Most of this has shipped.** The contrast work is done in both halves: ink and hairline contrast raised to WCAG AA across all four looks, and a switch in Settings for a reader who cannot or will not set it at the operating-system level — resolving to the same state as `prefers-contrast: more` rather than competing with it. The quote text gained the two axes that were fixed, **line height** and **measure**, beside the size dial that was already there; line length is the largest readability lever there is in a body of prose, and the paper and film looks are deliberately generous with it — right for reading a card, and exactly what somebody with low vision needs to be able to narrow. And the quote box no longer offers only serifs: **OpenDyslexic** is bundled and named in Settings → Type, for the quote text and for the interface both.

- **A named, focusable equivalent for every gesture** added in §2. The rule is settled, and each of the four gestures listed under §2’s ground rules now satisfies it: scrolling is the platform’s own and answers a keyboard already, the drawer closes from a button as well as a swipe, a control thumb is a real `<input type="range">` and answers the arrow keys, and the seal on a quote — the last thing here that could only be dragged, and a position *kept* with the quote rather than a flourish — answers them now too. What is left is holding each gesture §2 adds to the same rule as it lands.

### §7 Data hygiene ([#28](https://github.com/aaronified/tippani/issues/28))

The after-import jobs the bulk editor and staging miss.

- **A shared text-cleanup pass** — de-hyphenate across line breaks, drop page numbers and running heads, normalise the quote marks and ligatures that get mangled in transit. §20 lists all of this as OCR post-processing, but it belongs **server-side and shared**, because the free-text sources and OCR both produce it, and the dedupe hash's typographic fold is a map worth borrowing.
- **Per-batch import rollback.** Approval deletes the staged rows and the `import_batches` row too, and nothing it writes carries a batch id — so this needs a provenance record, not just an endpoint.

### §8 More import sources ([#21](https://github.com/aaronified/tippani/issues/21))

Kobo (`KoboReader.sqlite`), Apple Books, a **Readwise** export, and read-later apps (Instapaper · Pocket · Matter), all folded into the same idempotent, cross-source dedupe. Kobo is unwritten rather than unverified: no parser exists yet, and I have no device here to test one against. The Kindle `My Clippings.txt` parser already reads eight locales by structure rather than by English, so it needs the same thing — real files from those Kindles.

Three more, added after a look at what the neighbours read:

- **KOReader annotations** (`.sdr/metadata.*.lua`). To be clear about which half of KOReader this is: Tippani reads the **annotations**, not the books. Grimmory, Kavita and Calibre-Web all sync KOReader progress, which means the e-ink crowd is already the overlapping audience — and they are the people who highlight most.
- **A generic CSV / JSON importer with column mapping** — pick the file, map its columns onto quote fields, preview, stage. This is the future-proof answer to every source there will never be a bespoke parser for, and staging is what makes it safe enough to offer.
- **Subtitle files** (`.srt` / `.vtt`) — drop one, pick the lines worth keeping, and they stage as dialogues with the timestamps *already correct*. The film-side equivalent of a Kindle export, and the one thing the movie-quote sites prove people actually want to do.

### §9 Choose your metadata sources ([#39](https://github.com/aaronified/tippani/issues/39))

Today a lookup fans out to whatever happens to be configured, in an order baked into the code, and you find out what it consulted by reading the result. I want the sources to be **mine to pick** — per lookup, and as a saved default.

- **A source picker on every metadata fetch.** Checkboxes for the sources that apply to what is being looked up, remembered per kind: books on Google Books, Open Library and Amazon, films and shows on TMDB and TheTVDB, games on IGDB and Wikidata, people on Open Library and TMDB. "Just Open Library" is also the honest answer to a source wrong about a particular book.
- **A source with no key should read as inactive where you are asking.** Settings already says the state out loud — a chip for whether film lookups have a key at all, another for whether the last book lookup worked. What is still open is the same truth in the *lookup*: a source that cannot answer should be greyed out in the picker, with a link to the card that takes a key, rather than dropped silently from the fan-out.
- **It matters most for people.** Looking up Subhas Chandra Bose should query Wikidata rather than the film database a speaker is sent to today — which means writing a Wikidata person client, not ticking a box over one that exists. An actor already goes to TMDB alone.
- Pairs with the re-verify flow that already exists: once you can choose sources, "re-check this show against TheTVDB only" becomes a sensible thing to ask for.

### §10 Collections & tag shelves ([#26](https://github.com/aaronified/tippani/issues/26))

Extend tagging **to books** — tags live on every quote kind but on no work — then a view that groups them by tag, which Search previews for quotes today. Curated, named groupings ("Best of 2026", "to reread") as first-class collections: a third way to group these rows, after boards and anthologies.

A note on the word: this section used to be called *Collections & shelves*, but "shelf" now means where you stand with a work — reading, paused, completed — so what this section builds is **tag shelves**, and the plain word belongs to the other feature.

Tag hygiene belongs here too, because the vocabulary is load-bearing already:

- **Merge tags**, which every managed vocabulary needs by its second year. The usage counts skip `utterance_tags`, so a tag worn only by standalone quotes reads zero uses — fix that first, then re-point three join tables.
- **Nested tags** — `theme/grief`, displayed hierarchically. Deliberately a display convention over the existing `name` column rather than a parent id, so there is no schema change and no migration to regret.
- **An optional mood and pace starter vocabulary.** The thing StoryGraph is loved for is, underneath, a well-chosen tag set; offering one as a suggestion on the Tags page costs a list of strings and no new field.

### §11 Fields users will name ([#29](https://github.com/aaronified/tippani/issues/29))

Unglamorous, low-risk, and the sort of thing that turns up as an issue rather than a feature request.

- **Book fields** — format (paper · ebook · audio), language, publisher, subtitle. Format and language are the two that get filtered on. Page count is deliberately **not** on this list: it is already stored as the progress bar's denominator, and a second metadata-sourced page count would give the app two numbers that can disagree. If it is ever wanted as canonical metadata it should *feed* that one, not sit beside it.
- **Film and show fields** — runtime, original title, country, language, certification. Four ride along in the TMDB responses already fetched; certification needs one more appendix. They are what a country or language breakdown needs.
- **A per-season episode map** from TMDB or TheTVDB. The shelf stores a season total and the *current* season's episode count, because that is what a viewer knows off the top of their head; a real map means progress through a long run stops needing you to supply each season's length by hand.
- **"Attributed to" on a quote** — for a book quoting someone else. An epigraph is currently credited to the book's author, silently, which quietly corrupts both the author breakdown and the author multiple-choice distractors.
- **A locator-kind hint** per book: whether its locators are print pages, Kindle locations or percentages. The staging location formulae already show that people care about locator arithmetic.
- **A spoiler flag**, blurred until tapped. Standard wherever reviews are public, and it matters as soon as anything is shared.

### §12 Desktop keyboard ([#30](https://github.com/aaronified/tippani/issues/30))

The shortcut registry shipped, legends on the buttons and all. What is left of the desktop gap is the layout itself.

- **An optional denser layout** — one toggle, not a redesign. The paper and film aesthetics are rightly generous for reading and expensive for triage.

### Further out

Real, wanted, and waiting on something — a dependency above, hardware I don't have, a date that hasn't arrived, or simply a bigger appetite than I have this year. Nothing here is a maybe; the maybes are further down under [Later / maybe](#later).

### §13 Serendipity & looking back ([#27](https://github.com/aaronified/tippani/issues/27))

- **Ambient mode** — full screen, one quote at a time, slowly cycling, in whichever skin is current. The paper and film aesthetics are the nicest thing about the app and are currently only ever seen at card size. This is also the version that earns its keep on a display wired to the NAS.
- **Year in review** — the numbers are already computed for the Stats page; what is missing is the sequence that walks you through them and the single image worth sharing at the end. Drawn from **quotes, tags, people and the review loop only** — deliberately not from the read log, even though "books finished this year" is now sitting right there. See the note under [Considered and set aside](#aside); this is the first place anyone would reach for it.

Shuffle and *on this day* were the cheap half of this section and shipped in 1.16.0.

### §14 Achievements — quiet milestones, and one gentle streak ([#31](https://github.com/aaronified/tippani/issues/31))

A deliberately restrained take. Achievements mostly mark *distance travelled* — reading and collection milestones drawn from data **already in the library** and computed at query time: no counters table, no background jobs, no cron, nothing ticking. **Off by default**, private, nothing social and nothing that phones home; shown as a modest, dismissible shelf on Home or Profile. Candidate milestones, all derivable from what is already stored: your first hundred highlights; a whole book carried through the forgetting curve; ten authors on the shelf; a passage recalled correctly five times; a series completed; a film quoted from every act.

The **one** place a streak earns its keep is the spaced-repetition review, and one already counts the days you cleared the due deck, on Home and in the drawer. What this section changes is the miss: the count drops to zero, where it should spend a built-in grace instead and **never** be dressed up as a loss. "You broke your streak!" banners are exactly what I won't do. Streaks stop at the review; nothing else in the app grows one.

It waits on appetite alone now: the review loop its one streak rides on has landed, and being off by default makes it easy to wait for.

### §15 Interop — feeds, formats, a CLI ([#24](https://github.com/aaronified/tippani/issues/24))

The way a self-hosted app wins "works with everything" is not by writing thirty integrations; it is by speaking two or three formats other tools already read.

- **A feed of recent highlights** — RSS, Atom or JSON, token-scoped, riding the scoped tokens of §1. One endpoint reaches Obsidian, FreshRSS, Home Assistant, e-ink dashboards and a terminal widget, which is a better return than any single bespoke integration.
- **A random-quote endpoint in SVG** — the JSON form is `GET /shuffle`, which a device token reaches. SVG rather than PNG: its text is string concatenation, and the dashboards that would display it render SVG natively.
- **CSV and JSON export.** Markdown and the zip serve Obsidian well; CSV is what a spreadsheet needs and JSON is what a script needs, and both are small next to the export builders already written.
- **EPUB export of your own highlights** — a small readable book of your own quotes, to put back on the e-reader they came off. `archive/zip` is already imported for the library export, and an EPUB is a zip with three XML files. Nothing else in this category does it.
- **A print stylesheet**, for the paper version of the same idea.
- **BibTeX / CSL-JSON** per work — nearly free, since ISBN, author and year are already stored, and the one thing an academic user asks for first.
- **`tippani quote` and `tippani export`** as CLI subcommands, alongside the existing `serve` / `user` / `healthcheck`. A `fortune` for your own library.
- **Export presets** — a named, saved combination of fields, template and filter, so the monthly dump into Obsidian is one command rather than six choices.
- **More quote-image templates.** `quoteImage.js` renders one layout in four skins; centred-serif, film-still, index-card and minimal, plus story, square and wide aspect presets. The one part of sharing an export cannot do, since a picture is not a file format anyone else reads. The one worth building first is a **portrait layout**: the author's, actor's or speaker's photo bled down the left and **faded into the quote text** on the right — the shape that actually reads on Instagram and Facebook, where a centred serif card does not. The portraits are already fetched, disambiguated and stored locally, so the art is on disk and nothing new needs downloading; the work is the gradient mask, a legible text well over it, and a sensible fallback when a person has no photo. Square and story crops matter most here, since that is where it would be posted.

### §16 Homepage dashboard widget ([#25](https://github.com/aaronified/tippani/issues/25))

A widget for [Homepage](https://gethomepage.dev) (and similar self-hosted dashboards), so Tippani shows up as a live tile on your NAS dashboard. `GET /stats` already answers a device token with the totals and the latest **quiz score**, unscoped and far from small; today's **pending spaced-repetition** count only the review loop knows. Opt-in; nothing exposed without a token.

**Tier 2 and most of tier 1 shipped in 3.0.0** ([#25](https://github.com/aaronified/tippani/issues/25), closed): Profile → Dashboard widget makes a read-only key, `GET /api/widget` answers four numbers (works, quotes, forgotten, mastered) for that reader's own library, and the README has the `services.yaml` to paste. Tier 1 landed as that README section rather than a docs page, and without the optional `homepage.*` compose labels. What is left is those labels and tier 3.

The three tiers, as planned:

1. **Document what already works** — Tippani's unauthenticated `/healthz` means any dashboard can ping it today, so a "Dashboards" docs page with a ready-to-paste `services.yaml` snippet and the optional `homepage.*` compose labels costs nothing and lands first.
2. **Custom-API widget** — Homepage's `customapi` widget can render live counts with **zero upstream code**, but its requests come from the Homepage *server* with no session cookie, so this tier rides on the scoped API tokens of §1: a slim read-only stats surface accepting `Authorization: Bearer`, plus a documented field mapping. This is the real deliverable.
3. **Native first-party widget (later)** — a PR into gethomepage/homepage. Gated upstream: the widget must target a feature-request discussion with **≥20 up-votes**, and widgets for projects under about a year old get declined — so the discussion gets opened early to accumulate votes, and the PR waits for 2027. It consumes the exact endpoint tier 2 already built.

### §17 Ops ([#33](https://github.com/aaronified/tippani/issues/33))

- **A `/metrics` endpoint** (Prometheus), behind a token and off by default. This audience runs Grafana, and the numbers are already computed for Stats.
- **Off-box backup without a scheduler.** Uploading to rclone, WebDAV or S3 on a schedule means a timer in the app and a dependency, both of which are refused elsewhere in this document for good reasons. The version that fits is to ship the *primitive* — a documented one-line `curl` against the existing backup endpoint, plus a `tippani backup --out` subcommand — and let the box's own cron do the scheduling it is already running. The archive is encrypted before it leaves the process, so a copy sitting in someone else's bucket is not a copy of your library.
- **A `tippani open-backup` subcommand.** The archive is sealed (AES-256-GCM, Argon2id off the password you typed, or a passphrase you set), which is right for a file that holds every password hash on the instance and wrong for the moment you want to look inside one without restoring it. A subcommand that takes the credential and writes the plain `.tar.gz` to stdout keeps that door open without keeping the archive open — and it belongs to the binary rather than the API, because it needs no server running. Until it exists the format is documented in `internal/httpapi/backup_crypto.go`, in enough detail to write the fifty lines yourself.
- **A keypair per user, so revoking an admin revokes their access to the archives.** Today an archive carries its key wrapped under the instance recovery key, so any password on the box opens any archive the box made — which is right, and got there by being simple rather than by design. A keypair per user would let a backup add a wrap for every admin, including ones whose password it has never seen, and let revoking an admin drop just their wrap. That is the shape to reach for if the recovery key ever needs to be per-user again; it is deliberately not the shape now, because the published contract for this format is "fifty lines you could write yourself".
- **An operator-held recovery code.** Forgetting your password still loses the archives you carried off the box — the recovery key covers the box, and the password covers the file, and there is nothing behind either. A code printed once at first backup, wrapping the archive key a third time, would cover it. It means one more secret for an operator to lose, a print-once flow, and a CLI enrol command, which is a release rather than a paragraph.
- **A read-only mode flag.** The Pages demo already simulates one client-side; a server flag would let someone share a live instance without risk.
- **A per-user storage cap**, for anyone hosting for family. Images are the only unbounded growth path in the data directory.

### §18 Out in the world — directories & icon CDNs ([#36](https://github.com/aaronified/tippani/issues/36))

Getting Tippani discoverable where self-hosters actually browse. No code here — outreach and asset prep, in dependency order:

**Icon CDNs first**, since dashboards and directories pull art from them:
  - [dashboardicons.com](https://dashboardicons.com) — open submissions via the site's form or a GitHub issue. Needs a clean `tippani.svg` in kebab-case; they generate the raster sizes. The mark uses an `feTurbulence` edge-roughen filter that some raster pipelines drop, so a **flattened submission variant** gets prepared first — flattening displaced geometry, not a noise layer.
  - [selfh.st/icons](https://selfh.st/icons) — no external PRs accepted; icons are *requested* via GitHub Discussions and added by the maintainers. This is also where the selfh.st/apps directory sources its art, so it goes in before or alongside the listing request.

- 
- [selfh.st/apps](https://selfh.st/apps) — a one-person curated directory with no submission repo: reach out by email with the repo, a one-liner, a demo link and the icon. Being picked up by the *This Week in Self-Hosted* newsletter's "New Software" section is the usual front door.
- [awesome-selfhosted](https://github.com/awesome-selfhosted/awesome-selfhosted) — the biggest list, syndicated by many others, but it **rejects projects younger than 4 months**, counted from the first release (2026-07-03), so this waits until November 2026.

### §19 Grimmory sync (self-hosted, direct MariaDB) ([#35](https://github.com/aaronified/tippani/issues/35))

A pull source for anyone already running **Grimmory** self-hosted: point Tippani at that instance's MariaDB database and sync straight from its tables, with no export file in the loop. It reads book covers, edition metadata and annotations directly from Grimmory's schema and folds them into the same idempotent, cross-source dedupe as the file importers, so a re-sync never doubles a passage. Covers come across too, which needs read access to Grimmory's cover store — so the plan assumes both services sit in the **same compose file**: Tippani is handed the Grimmory DSN plus the relevant media path, wired through the environment. Read-only and opt-in — nothing runs without a configured DSN. A first pass is a one-shot pull, with a scheduled re-sync as the follow-up. Unverified until I can test it against a real Grimmory box.

### §20 Android app — capture by camera, with on-device OCR ([#37](https://github.com/aaronified/tippani/issues/37))

A native Android client, Flutter so the source stays portable, in `mobile/`. Not a wrapper around the PWA: the point is the one thing a web page on a phone cannot do well, which is **photograph a page of a physical book and turn it into a highlight**. Recognition runs **on the device** (ML Kit), so the server gains no dependency, no CPU cost and no upload path — the reason server-side OCR was set aside doesn't apply to it.

The work that isn't the OCR call itself — which is thirty lines — is what makes it worth having: reflowing recognised lines into paragraphs from their bounding boxes, **de-hyphenating across line breaks**, dropping running heads and page numbers, normalising the quote marks and ligatures OCR mangles, and then a correction screen with the photo beside the text. A local mirror keeps browsing and the Daily Quiz working with no server, and captures queue offline and flush when the box is reachable.

Two notes on where the work belongs. The text cleanup above should live **server-side and shared** rather than in the app, because every import source produces some of it; that is §7. And the photo the correction screen already holds beside the text is worth **keeping, attached to the quote**: one nullable path column on an image pipeline that already stores covers, posters, portraits and stickers, and it keeps the evidence next to the transcription for the next time you doubt a line.

The server half of this is done — device tokens and pairing, list paging, gzip, the capabilities handshake (a revision behind anthologies and locales), `noted_at` on create so a queued capture keeps its real date, and duplicate `409`s that make a retried flush idempotent. What remains is the app, and it is the largest single item on this page.

The feature list, what is reused from the other apps, the signing and release set-up and the open questions are in [the plan](Plan-Android-App.md).

**Android only.** Flutter compiles for iOS and the Dart here stays platform-agnostic, but building and signing for iOS needs a Mac, and I don't have one — so no `ios/` directory ships rather than an unbuildable one rotting in the tree. A fork with a Mac adds it with `flutter create --platforms=ios .` and a signing config; the README says Android and does not imply otherwise.

---

## From your requests

Things somebody asked for that I have said **yes** to. [Ask for something](https://github.com/aaronified/tippani/issues/new?template=feature_request.yml) and it goes on the tracker; it arrives here when I accept it, and leaves when the issue closes — shipped, or thought better of. Everything open is [visible on the tracker](https://github.com/aaronified/tippani/labels/enhancement) whether or not it ever gets this far, so a request is never quietly buried.

Accepting is one label on one issue and nothing else, which is the strongest thing I can say about this list: **it is not a list I curate.** I cannot add an entry without agreeing to it on the tracker in public, and I cannot forget to remove one, because closing the issue removes it. A hand-kept list of promises drifts from the promises actually made. This one has no way to.

### Atrium, the glass material set

`atrium` is the eighth material set and the only one still a placeholder — four flat tiles reserving a slot for something translucent and lit from behind, built to Apple's own Liquid Glass guidance: a functional layer for the rail, the top bar and sheets, never the cards a board scrolls past, with a real edge that bends light rather than a faked rim.

Getting there starts by fixing a live defect the design pass found: choosing Atrium today saves nothing, because the server does not yet know the name. From there, the glass itself — a blur that actually turns off under reduced transparency, an accent that stays a light rather than a colour, and a performance budget measured on a real board before a line of CSS ships, not assumed after.

### Episode names, and up to three orderings

A series episode has never had anywhere to hold a **name** — only the season and episode numbers it airs under. This gives it one, plus up to three orders to view it by: broadcast, a published DVD or streaming order, and a hand-built custom one — because some shows, *Firefly* among them, were never watched in the order they aired.

Names and the alternate order can be fetched from the same providers the library already trusts, never automatically and never overwriting a name typed by hand. Reordering gets a real drag control, built once and shared with the anthology entry list, with a keyboard route from the outset rather than added later. It split off the entry-form work that discovered the gap, which has shipped (3.0.0).



### Change one surface yourself

A material set dresses four surfaces at once — the desk, the furniture, the page and the binding. This is the other half: keep the set you like and swap just one of them, out of the twenty-seven tiles the app ships. What you leave alone stays the set's own material.

Half of it is already in the app and none of it is reachable: a saved look carries per-surface tiles, and a theme file exported from another install can contain them. The missing piece is the picker.

### Change one surface yourself, per slot

A material set dresses four surfaces at once — the ground, the furniture, a card and a cover. Choosing one is a single decision, which is the point of the sets, but it leaves no way to say *this set, with a different card*.

**The machinery already exists** and is reachable by nothing: a per-slot override is stored, resolved and drawn correctly, with no control anywhere that writes one. What is missing is the row — twenty-seven tiles, one slot at a time.

### An Admin section that never reads your library

Settings › Server becomes Admin: the users on the server with their sign-on state, single sign-on set up in the app, maintenance, and a temporary password issued from a user's row. (Admin-set passwords are already temporary as of 3.0.0.)

Everything personal stays on Profile — your own API keys, notifications and sign-on link — and nothing in Admin opens another reader's quotes.

### Anthologies you can arrange and print

Drag entries into order, add your own section headings, or group by work, person or character. Removed entries stay removed, and a cover, epigraph and dedication open the book.

A continuous reading mode, better printing, and a PDF whose text you can still select.

### Quotes read aloud, in the browser only

[#12](https://github.com/aaronified/tippani/issues/12)

Reading a quote aloud, using the browser's own `SpeechSynthesis`. It costs the server nothing, needs no key, and works offline once §5's service worker exists — which is the entire reason this can be accepted while server-side speech stays refused. Those are not the same feature wearing different clothes: one is a model and an audio pipeline on a box that cannot spare either, and the other is an API the browser already ships.

Accepted rather than parked because the line it sat next to turned out to be drawn in the right place already — see "OCR, and speech, on the server" under Considered and set aside. Not built yet; the owner widened the plan ([Plan: read aloud](Plan-Read-Aloud.md)) from the review card to every quote card and a quote's detail, whole anthologies and boards read in order, each quote in its own language with a voice the reader picks per language, and no control at all where the device has no voices. No stored audio, no transcription, no server route.

---

## Later / maybe (being considered)

Not ruled out, not next. Nothing gets promoted out of here without a reason — and promotion is now a visible act rather than a private one: everything below carries the [`considered`](https://github.com/aaronified/tippani/labels/considered) label, and moving it to `accepted` is what lifts it into [From your requests](#requests) above. Same issue, same number, same thread of argument — so if you want to change my mind about one of these, there is somewhere to do it.

- **AI summaries (opt-in)** A passive digest: batch recent highlights and summarise them with an **OpenAI-compatible** model — local or remote, your endpoint, your key. Grouped by book, tag or whole library; weekly or on-demand. Off unless configured, generated async, and — true to the frugality goal — **no cron dependency**. The digest has to be worth opening in the app on its own before any question of pushing it arises, which is why delivery is the separate entry below and neither one waits on the other. [#2](https://github.com/aaronified/tippani/issues/2)
- **Notifications (opt-in)** Would start with NTFY, likely routed through a multi-service notifier such as [Shoutrrr](https://containrrr.dev/shoutrrr/) so one config reaches any backend — the **email digest fallback** below is that same slot with a different transport. Non-negotiable, whatever I pick: **high / urgent priority must carry through** — a resurfaced highlight is a gentle nudge, but "lookup is failing" should be able to shout, and that case alone justifies this even if no summary ever gets generated. This sat in the numbered backlog until I moved it here deliberately, because anything that pushes needs something that wakes up on its own. The cheap end of the ask needs none of it: the app-icon badge already shipped and shows a due-card count with no server work and nothing scheduled. [#3](https://github.com/aaronified/tippani/issues/3)
- **Anki export / import** — bridge the daily review to and from Anki decks (`.apkg`), a natural pairing for the spaced-repetition audience. Still being scoped; I need to learn the format first. [#4](https://github.com/aaronified/tippani/issues/4)
- **Backlinks & freeform notes** — manually-maintained links between related highlights, Zettelkasten-style, and standalone notes not tied to any book. Kept deliberately manual; no auto-suggested "related" magic. [#5](https://github.com/aaronified/tippani/issues/5)
- **Shared / household libraries** — collaborative or shared-view libraries across the users on one box. [#6](https://github.com/aaronified/tippani/issues/6)
- **Email digest fallback** (SMTP) — the same delivery slot as the notifier above, for people who would rather not run one. [#8](https://github.com/aaronified/tippani/issues/8)
- **Semantic search** (`sqlite-vec`) — a dependency, an indexing pass and a model, on a box budgeted at 20–40 MB RSS. Deferred indefinitely rather than left unsaid: the two read the same from outside and only one of them is honest. [#9](https://github.com/aaronified/tippani/issues/9)
- **Summary export** to Markdown / Obsidian. [#10](https://github.com/aaronified/tippani/issues/10)
- **Reviving a rating** The 1–5 stars were retired **on purpose** in 0.4.3 and ♥ is the cleaner signal, so this is recorded as a reversal to weigh rather than as planned work — but half-stars are the single most-cited feature of the trackers people arrive from, and the columns are still there, inert, from before the drop. If it ever comes back it should be per-user and opt-in, so the default library looks exactly as it does now. [#11](https://github.com/aaronified/tippani/issues/11)
- **A voice note on a quote** — record, store, play back, with no transcription, which would be a dependency. For the reaction you can't type while reading. [#13](https://github.com/aaronified/tippani/issues/13)

## Considered and set aside

### OCR — and speech — *on the server*

Building OCR into the Go binary isn't worth the weight, and that hasn't changed: it would be a dependency, a CPU cost, and an upload path, all on a box chosen for being small. What *has* changed is that I wrote this as though the server were the only place it could live. On-device OCR in a native app costs the server nothing at all, so the feature moved to §20 rather than staying refused, and the share-target route (§3) is still the no-app answer and still planned.

**Server-side text-to-speech** is refused on identical grounds and belongs in the same entry: a model or a paid API, CPU I don't have, and audio to store or stream. The same escape applies — the browser already has a speech engine, so reading a card aloud is a client feature or it is nothing.

### A built-in reader, OPDS, and file sync to a Kobo or Kindle

Tippani is a home for what you *marked*, not for what you own. Grimmory, Kavita, Calibre-Web and Audiobookshelf all do the shelf properly, one of them is already a planned sync source (§19), and competing with them would mean carrying a format zoo, a streaming path and a storage story for no gain.

The line moved in 3.4.0, and it moved in writing: a work may now keep **the file its quotes came from** (a subtitle track, an ebook), because that is the only way to show a quote in context or to find where it sits. What did not move is the part that was always the boundary: **serving.** The app never renders such a file, never hands it back, never offers a reader, an OPDS catalogue or a sync to a device; what leaves the server is extracted text. And reading **annotations** out of KOReader or Kobo is very much wanted and is in §8.

### Social features

Following, feeds, public profiles, discovery, and ActivityPub-style federation of the Bookwyrm kind. Per-user isolation here is a security property, not a layout choice: a foreign row answers 404 precisely so that nothing leaks between accounts on one box, and a social graph works against the reason for self-hosting in the first place. Letterboxd and Bookwyrm own that layer and are welcome to it.

Sharing something deliberately is a different matter, and it is already handled: the share sheet does a single quote, and the export does a work, a filtered set or the whole library as Markdown you can put anywhere. A hosted read-only page was on this list for a while until I noticed it was mostly a worse version of an export — the same content, plus a public surface to secure and a link to remember to revoke.

### The shelf and the read log as a data source for anything else

The shelf gives the app a status per work, a progress figure, a position in pages or seasons, and a read log carrying start and finish dates. All of it is **your input, shown back to you for your own convenience, and nothing else consumes it.**

Named concretely, because these are the exact temptations and they are all plausible: no read-log series in the Stats activity calendar; no "books finished this year" in the year in review (§13); no reading-pace or completion charts; no progress- or completion-based achievements in §14; and no shelf status feeding the review deck's scheduling. Recorded here so the boundary stays a decision instead of being rediscovered later as an opportunity.

