# ADR-0453: One colour per meaning: correct is green, not the accent, and identity never rides on colour alone

Source of truth: this wiki page.

- **Area:** [§13 Controls, Labels, Icons and Help](ADR-Index.md#area-13)
- **Status:** Accepted
- **Version:** 0.4.2, reinforced later

**Decided.** A correct quiz answer shows `--ok` green rather than the terracotta accent. Where two series share a plot, they are separated by lightness as well as hue — quotes take `--accent`, works take `--soft`.

**Why.** The accent read the same as the red for a wrong pick, so the one distinction the control existed to make was the one it could not make. And `--soft` was chosen over the old `--line` fill because it separates from the accent by lightness as well as hue, so it survives being printed, dimmed, or seen by an eye that does not sort red from green — `--line` is the hairline colour and all but vanished against the card. The legend swatch and the plot inherit one colour from the stack, so they are the same rule and cannot drift apart.

**Reversal.** The quiz colours were mine and wrong; using the brand accent for "correct" is the obvious thing to reach for and it collides with the error colour.

**Approved.** I approved both fixes, and approved the general rule they imply: a colour that carries meaning has to be told apart from the colour next to it by something more than hue.

<sub>0.4.2, reinforced later — `CHANGELOG.md` · `web/frontend/src/index.css`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
