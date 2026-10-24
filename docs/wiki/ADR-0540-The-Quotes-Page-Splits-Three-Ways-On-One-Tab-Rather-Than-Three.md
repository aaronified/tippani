# ADR-0540: The Quotes page splits three ways, on one tab rather than three

Source of truth: this wiki page.

- **Area:** [§14 Boards, Cards, Charts and Popups](ADR-Index.md#area-14)
- **Status:** Accepted
- **Version:** 1.13.0

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

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
