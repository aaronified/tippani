# ADR-0541: Starter proverbs are opt-in, per language, and that is the whole design

Source of truth: this wiki page.

- **Area:** [§14 Boards, Cards, Charts and Popups](ADR-Index.md#area-14)
- **Status:** Accepted
- **Version:** 1.13.0

**Decided.** Thirty curated proverbs ship in the binary — ten Bengali, ten Hindi, ten English — behind `GET`/`POST /quotes/starters`. They are written only when asked for, one language at a time, from an offer that appears on an empty Proverbs board.

**Why the restraint is the feature.** Every other seeder here — `seedDefaultStickers`, the starter tags — has a boot hook, a backfill for existing accounts and a settings flag marking the one-shot done. This has none of the three, deliberately. A starter sticker is a TOOL: five marks to put beside a line, and handing them to everyone costs nothing because nobody's library is a library of stickers. A proverb is CONTENT. Putting thirty lines somebody never chose into a collection they have kept for a year is not a friendly default, it is the app writing in their book — and the Bengali board then opens onto a shelf that is entirely mine and none of theirs.

**Idempotent through the ordinary dedupe hash, not a flag.** They are plain `utterances` rows, so asking twice adds nothing and the count says "already there" rather than implying a second copy. The consequence is written down rather than left to be discovered: a starter proverb you deleted comes back if you ask for that language again, which is the honest behaviour for a button that says "add the Bengali ten" and is only ever reachable by asking.

**Every seeded line is unattributed, and that is enforced.** A proverb with an author is somebody's aphorism, and the review deck reads exactly that absence — no speaker and no occasion — to keep these out of the quiz, where there would be nothing to recall but the words on the card. A test refuses any curated line shaped like a byline, and another refuses a set that is not ten distinct non-empty lines with an English translation on everything not already English.

**The offer is served, not hardcoded.** The count on the button and the set that actually lands would otherwise be two lists to keep in step, and the one that drifts is the one nobody tests.

**Instead of.** Seeding on signup (content nobody chose). Seeding all three languages at once (asking for Bengali is not asking for Hindi). Shipping them as a Markdown file to import (an import is staged, reviewed and approved — three steps for a button).

**Approved.** The reader chose opt-in per language over both a signup seed and a single all-languages button.

<sub>1.13.0 — `internal/httpapi/seed_proverbs.go` · `internal/httpapi/seed_proverbs_test.go` · `web/frontend/src/Quotes.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
