# ADR-0364: The share sheet opens on the picture, and its two window actions live together

Source of truth: this wiki page.

- **Area:** [§10 What Leaves the App: Exports, Round-Trips and the Shared Image](ADR-Index.md#area-10)
- **Status:** Accepted
- **Version:** 1.7.10

**Decided.** `Image` is first in the format row and is the initial state. The dialog's header carries the picture's share action as a glyph immediately left of the ×; the footer's worded `Close` and the panel's `Download PNG` / `Share / save PNG` primary are both gone. Copying — text or image — stays a worded button.

**Why.** The order was right when this dialog was the only way to get anything out of a quote. 1.7.9 put copy on the card, so pasting text is now one tap that never opens this window, and what is left is the thing the window is actually for: the picture is the only output that needs a skin, a portrait and a colour decided first, and the only one nothing else can produce.

The buttons follow from the same reading. Handing the picture over and leaving are the only two things anybody does to this window, so they sit as a pair in the corner; a second, worded way out in the footer was one door too many out of one room. It also retired a label that named itself two ways by breakpoint ("Share / save PNG" against "Download PNG"), which is the fault §13 already logged once.

Copy keeps its words because copying is not sharing: it goes nowhere, it needs somewhere to paste, and the ✓ in its label is the whole feedback.

**Instead of** making the header glyph share whatever the active format is, text included. Rejected as a guess: "share this text" has no meaning on a desktop without a share sheet, and the text panel already has the correct verb on a button.

`QuoteImagePanel` publishes its share action through a ref rather than surrendering the canvas upward. The render pipeline — theme, portrait, colour, font loading, redraw-on-event — belongs to the panel, and moving any of it to satisfy a button's position would be the tail wagging the dog.

**Approved.** Mine, and I asked for both halves.

<sub>1.7.10 — `web/frontend/src/share.jsx` · `web/frontend/src/help.jsx` · `web/frontend/test/dom/share-dialog.test.jsx` · `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
