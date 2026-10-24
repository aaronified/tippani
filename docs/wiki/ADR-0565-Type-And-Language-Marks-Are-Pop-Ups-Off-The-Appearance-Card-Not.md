# ADR-0565: Type and Language marks are pop-ups off the Appearance card, not cards in the settings grid

Source of truth: this wiki page.

- **Area:** [§15 Appearance as Material: Skins, Texture, Type and Colour](ADR-Index.md#area-15)
- **Status:** Accepted
- **Version:** 1.15.2

**Decided.** Settings holds eight cards, and Type and Language marks are not among them. Both are buttons at the foot of the Appearance card — a glyph and its words — opening a `FormModal` each. The panels are otherwise unchanged: they lose the `Card` frame and the `SectionTitle`, which the dialog carries, and their heading blurbs come out from behind info dots into a lead paragraph, because a dialog has the room a 300px column did not.

**Why.** Both are long, and both are settled once. Type is six roles, each with a live specimen, a face picker, an upload control and a row of style chips; Language marks is a row per language with a tray of two dozen flags behind every one. That was two columns of the settings page permanently unrolled, and a settings page is read at a glance — the cost is paid by every visit for a choice made on one of them.

**Why Appearance and not somewhere else.** Both answer the same question that card answers: what the app looks like. Language marks used to sit under Metadata and Colours on the argument that all three are about what a quote is *labelled with*; that argument survives for Colours, which is a vocabulary, and gives out for marks, which is a glyph. What a proverb *wears* is appearance.

**Instead of** collapsing them in place, as accordions on their own cards. Rejected because it keeps the card, the heading and the row of chrome and buys only the height — and a settings page of eight collapsed cards is a page with nothing on it.

**Instead of** leaving them and shortening the panels. There is nothing in either to cut: the specimen *is* the type picker, and every language in the list is one somebody may want to mark.

**Approved.** The owner's, in the form "the language marks and Type sections should be two buttons (glyphed) under appearance section that opens their own pop ups".

<sub>1.15.2 — `web/frontend/src/Settings.jsx` · `web/frontend/src/ui.jsx` · `web/frontend/test/dom/appearance-panels.test.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
