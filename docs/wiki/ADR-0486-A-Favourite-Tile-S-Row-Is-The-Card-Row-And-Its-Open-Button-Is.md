# ADR-0486: A favourite tile's row is the card row, and its open button is the nav's own glyph

Source of truth: this wiki page.

- **Area:** [§14 Boards, Cards, Charts and Popups](ADR-Index.md#area-14)
- **Status:** Accepted
- **Version:** 1.7.10

**Decided.** The expanded favourite tile lays out ♥ · copy · share · colour · ⋯, the same order as Library's `ActionRow` and Movies' `Frame`. Its "open" control leads the row as a glyph drawn by `NavIcon` — the Library's for a highlight, the Catalogue's for a film line, Quotes' for a standalone quote — with the destination per kind in `FAV_KINDS.openIcon`.

**Why.** Two faults, both from the tile being written separately from the cards it copies. The order was ♥ · colour · copy · share for one release, so a reader who learned the row on a book's page had to re-learn it on Home. And the open control was the words "Open book →" in a `tp-btn-primary` — the loudest control on the tile, spent on the least surprising thing you can do with it, in a row whose other five controls are all glyphs.

Drawing it with `NavIcon` rather than picking an icon per kind is the part worth recording: the tile now cannot disagree with the tab strip about what the Library looks like, which is the same argument the icon-set rules make one screen over.

**Reversal.** A standalone quote used to have no open button at all.

> **A standalone quote has nothing to open, so the button is absent rather than present and inert.** It IS the whole record: no work to fetch, no parent page to land on, so `quoteFav` carries neither `workId` nor `openLabel`.

That was true about a parent record and false about a destination. The quote lives on the Quotes screen, and going there from a Home tile is worth a glyph. It still carries no `workId`, because there is still no work — the test says those two halves separately now, so the surviving half cannot be deleted along with the retired one.

**Approved.** Mine; I named the three glyphs.

<sub>1.7.10 — `web/frontend/src/Home.jsx` · `web/frontend/src/App.jsx` · `web/frontend/test/pure/home-favourites.test.js` · `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
