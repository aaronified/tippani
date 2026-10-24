# ADR-0446: A repeated action is a glyph; a one-off keeps its words — ending 'share edit delete' on desktop and 'del' in a table

Source of truth: this wiki page.

- **Area:** [§13 Controls, Labels, Icons and Help](ADR-Index.md#area-13)
- **Status:** Accepted
- **Version:** 1.6.0

**Decided.** An action appearing once per row or once per card becomes a glyph. An action appearing once on a screen keeps its words, and primary submits and destructive confirms keep them at every width.

**Why.** A repeated action is something you learn on the first hover and never read again. The tells that this was inconsistent rather than considered: `QuoteActions` drew icons on a phone and the words *share edit delete* on a desktop — the only place in the app where one control named its actions differently depending on the width of the window — and the tables drew the same three actions again as *share edit **del***, one action with two names, four files apart, because somebody once needed the column narrower. The Metadata console's rows read *Close · Close · Open* whenever both panels were open, which names neither thing being closed; they are latched glyphs now, saying it where a toggle should.

**Approved.** Mine, and `del` is the detail I approved recording, because it is the smallest possible evidence that nobody was applying a rule.

**Reversal.** The rule stands; the fix described here did not go far enough. Making both breakpoints draw *glyphs* left them drawing glyphs in different **places** — three inline on a desktop, one ⋯ on a phone. 1.7.9 collapsed that too: see "A card's row is ♥ · copy · share · colour, then a ⋯ holding edit and delete" in §14.

<sub>1.6.0 — `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
