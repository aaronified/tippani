# Roadmap

Where Tippani is headed — rough order, not promises. The ethos holds throughout:
a frugal, self-hosted home for your highlights first; everything ambitious is
**optional and off unless you turn it on**, nothing phones home, and it all runs
from one small binary on your own box.

Have a request or a strong opinion on ordering? Open an issue.

## Recently shipped

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

### 2 · Spaced repetition — a daily review
Resurface your **own** highlights on a gentle decay curve. A "Daily Review" card
on the home page shows a handful of quotes due for recall; *Got it* / *Forgot* /
*Skip* nudge each one's schedule. ~2–3 minutes a day, no configuration, no
gamification.

- Per-annotation mastery (`SOON` / `LATER` / `SOMEDAY`) + a recall probability that decays in SQL.
- `GET /annotations/daily-review` for the day's candidates; `POST /annotations/{id}/review` to record *got it* / *forgot*.
- Handles empty pools and timezone-aware "daily".

### 3 · AI summaries + notifications (opt-in)
A passive digest: batch your recent highlights, summarise them with an
**OpenAI-compatible** model (local or remote — your endpoint, your key), and
optionally push the result via **NTFY**. Grouped by book, tag, or whole library;
weekly or on-demand. Off unless configured, generated async (fire-and-forget, no
realtime calls), and — true to the frugality goal — **no cron dependency** (an
in-app scheduler or an optional systemd timer).

- Env: `TIPPANI_OPENAI_ENDPOINT` / `_KEY` / `_MODEL`, optional `TIPPANI_NTFY_URL`, cadence + grouping.
- A "Summaries" page listing recent digests, each linking back to its source.

## Later / maybe

- Email digest fallback (SMTP)
- API-token auth for external triggers
- Semantic search (`sqlite-vec`)
- Shared / household libraries
- Summary export to Markdown / Obsidian
