# Roadmap

Where Tippani is headed — rough order, not promises. The ethos holds throughout:
a frugal, self-hosted home for your highlights first; everything ambitious is
**optional and off unless you turn it on**, nothing phones home, and it all runs
from one small binary on your own box.

Have a request or a strong opinion on ordering? Open an issue.

## Recently shipped

**v0.4 line (July 2026)**

- **Automatic portraits, right-person-first** — author and actor photos are
  fetched on demand from your own catalogue: an actor from the film's stored
  cast (identity + headshot captured when the movie was added, so no extra API
  call), an author via Open Library **disambiguated by the books they wrote** so
  a same-name namesake is no longer picked, with a Wikidata photo fallback. The
  resolved identity is pinned so it never re-drifts; the manual photo field still
  overrides.
- **Spaced repetition — a daily review** — a Daily Review card on the Home
  screen resurfaces your own highlights on the **Ebbinghaus forgetting curve**:
  each annotation carries a memory half-life and its recall probability
  (`2^(−days ÷ half-life)`) decays in SQL at query time, so a card comes due
  right as you'd forget it — no jobs, no cron, nothing ticking. Answers move the
  half-life the **SM-2 / expanding-retrieval** way — *Got it* stretches the
  interval, *Forgot* is a lapse (shortened, not reset), *Skip* benches the card
  for the local day — the active-recall loop the memory research keeps
  confirming. ~2–3 minutes a day, capped at 8 cards, timezone-aware, zero
  configuration; a dot on the logo (and the drawer's Home row) marks a pending
  deck. Paired with a **recall quiz** that builds multiple-choice rounds from
  your own library, every answer counting as a revision.
- **Home screen + drawer shell** — the logo now taps to a Home screen (daily
  review, quick capture, stat tiles, recent favourites) on desktop and mobile;
  on phones a hamburger **drawer** owns primary nav (the bottom tab bar is
  retired) with a slim top bar: ☰ · logo → Home · ＋ quick capture · search ·
  avatar. The old start-page setting is gone — Home is the start page.
- **PWA install** — web app manifest + icons, `viewport-fit=cover` with
  safe-area insets on every bar and sheet, theme-colour meta; add-to-home-screen
  installs a standalone app.

**v0.3.1 and after (July 2026)**

- **Mobile overhaul** — bottom navigation bar, sticky page bars, full-screen
  filter sheets with a Reset · count · Done footer, detail overflow menus,
  44px touch targets, and no horizontal scroll; five tabs fit a 320px phone.
- **People link out** — clicking any author/actor name opens a redirect menu of
  their IMDb · TMDB · TheTVDB · Wikipedia · Open Library pages, auto-resolved
  on first open; a People console under Metadata manages the links for the
  whole library, with bulk fetch.
- **Hi-res covers** — TMDB originals, full-size Amazon scans, hi-res Google
  Books renders; OpenLibrary and TheTVDB art (previously failing silently)
  now fetches correctly.
- **Chunked metadata refetch** — "fetch missing covers & metadata" runs in
  cursor chunks with a real progress bar and survives proxy timeouts.
- **Import in the primary nav**, on desktop and in the mobile bottom bar.

**v0.3.0**

- **Quote sharing** to Rich Markdown · WhatsApp · plain text (Twitter/X) · Reddit, with a live per-format preview.
- **Author & actor metadata** — bio · photo · links, viewed/edited by clicking a name, with portraits in group-by headings.
- **Search overhaul** — open a quote in place (share/edit/delete), remembered last search, group-by, and bulk tag/edit on selected results.
- **Library group-by** — series · author · decade · genre.
- Uploaded **stickers**, a read-only **demo**, real per-view **URLs**, and the tactile **paper/film redesign**.

## Planned

### 1 · Kindle `My Clippings.txt` import
The one importer still stubbed (its endpoint deliberately answers `501`). Parse
the raw `My Clippings.txt` straight off a Kindle — the locale header line, the
`==========` separators, the BOM, the clipping-limit sentinel — and fold it into
the same idempotent, cross-source dedupe as the Markdown / Bookcision /
Hardcover / Goodreads paths, so the same passage never doubles up.

### 2 · Force-fetch & re-verify metadata (review before apply)
A deliberate "re-check everything" pass over a **selection** of books, movies,
shows, authors and actors: re-run each item's lookup against the live sources,
diff the fresh values (covers/posters, descriptions, cast, portraits, links,
identity ids) against what's stored, and present the differences for the user to
**approve field-by-field** — nothing is written until they confirm. Builds on the
now-pinned identity ids (`movies.tmdb_id`, `people.source_id`, book ids) so a
re-verify targets the same entity rather than re-guessing by name, and reuses the
chunked-refetch plumbing. The companion to the on-demand automatic portraits
already shipped — same resolution, but user-gated and bulk.

### 3 · AI summaries + notifications (opt-in)
A passive digest: batch your recent highlights, summarise them with an
**OpenAI-compatible** model (local or remote — your endpoint, your key), and
optionally push the result. Grouped by book, tag, or whole library; weekly or
on-demand. Off unless configured, generated async (fire-and-forget, no realtime
calls), and — true to the frugality goal — **no cron dependency** (an in-app
scheduler or an optional systemd timer).

Notifications start with **NTFY**, but we're likely to route through a
multi-service notifier — **[Shoutrrr](https://containrrr.dev/shoutrrr/)** or
similar — so one config reaches any backend (ntfy · Gotify · Telegram · Discord ·
email · …). Non-negotiable, whatever we pick: **high / urgent priority must carry
through** — a resurfaced highlight is a gentle nudge, but "lookup is failing"
should be able to shout. Exact backend still to be decided.

- Config: OpenAI endpoint / key / model, the notifier URL(s), cadence + grouping.
- A "Summaries" page listing recent digests, each linking back to its source.

### 4 · Homepage dashboard widget
A widget for **[Homepage](https://gethomepage.dev)** (and similar self-hosted
dashboards): a small, read-only, token-scoped stats endpoint surfacing today's
**pending spaced-repetition** count, your latest **quiz score**, and
**book / annotation / movie** totals — so Tippani shows up as a live tile on your
NAS dashboard. Opt-in; nothing exposed without a token.

## Later / maybe

- Richer author portraits — resolve the author's Wikidata entry via the *book* (work → author) so a
  photo appears even when the Open Library record is sparse (no photo, no wikidata link). The
  disambiguation already picks the right person; this widens photo coverage.
- Email digest fallback (SMTP)
- API-token auth for external triggers
- Semantic search (`sqlite-vec`)
- Shared / household libraries
- Summary export to Markdown / Obsidian
