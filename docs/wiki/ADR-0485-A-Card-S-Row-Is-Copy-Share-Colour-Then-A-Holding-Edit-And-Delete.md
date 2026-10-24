# ADR-0485: A card's row is ♥ · copy · share · colour, then a ⋯ holding edit and delete

Source of truth: this wiki page.

- **Area:** [§14 Boards, Cards, Charts and Popups](ADR-Index.md#area-14)
- **Status:** Accepted
- **Version:** 1.7.9

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

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
