# ADR-0100: Stray marks lists what a page left in a quote, and never fixes any of it

Source of truth: this wiki page.

- **Area:** [§4 What a Quote Is](ADR-Index.md#area-4)
- **Status:** Accepted
- **Version:** 2.2.0

**Decided.** `GET /cleanup` reads every highlight, film line and standalone quote in one pass — the words, the note, and a standalone quote's translation — runs eight rules over each, and answers with the match, its field, a count, and a snippet with the find marked in guillemets. **There is no companion `POST`, no "fix all", and no per-row fix.** Settings → Stray marks draws that list and its only controls are a rule filter and a door to the work the quote lives in.

**Why.** Every one of the eight rules has a false positive that is somebody's real writing. A sentence may genuinely end in a numeral; a quote may genuinely contain a bracketed aside; a language may genuinely need a character another one calls invisible — the zero-width joiner is load-bearing in both scripts this app ships in, which is why it is deliberately absent from the invisible-character class while the five that arrive from a page and never from a keyboard are in it. An automatic pass would edit the reader's own words on the strength of a guess, silently, in a library whose entire premise is that the words are theirs. So the app's job ends at showing them where to look, and the same reasoning keeps names out of the scan: a character, an actor or a speaker is short and usually picked from autofill, and `R2-D2` is indistinguishable from a footnote index to a rule that has to catch `conscience12`.

**Instead of** a fix button behind a confirmation, which was the first shape considered and is worse than it sounds — a confirmation on a list of five hundred finds is a confirmation nobody reads, and the one find in it that was real writing is gone without a diff. And instead of paging: the answer is a worklist somebody works through, a paged worklist reshuffles as they edit it, so the findings are capped at five hundred and the reply says plainly when it stopped early. A silently truncated list is indistinguishable from a clean library.

**The shape follows the bin.** A page with one door — the tile in Settings — a URL so it bookmarks and survives a refresh, and no entry in any tab list. A settings card is a control panel; this is a list of unbounded length whose rows carry a snippet, which is the fact a 300px grid column truncates and the only fact worth having. `routes.test.js` now asserts the no-tab-but-routed shape as a loop over both pages rather than once for the bin, because the second such page is exactly where a rule written for one stops being enforced.

**Approved.** Mine.

<sub>2.2.0 — `internal/httpapi/cleanup.go` · `internal/httpapi/cleanup_handlers.go` · `web/frontend/src/CleanupPage.jsx` · `web/frontend/src/Settings.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
