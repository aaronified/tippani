# ADR-0368: The backdrop replaces the portrait chip, and the control names both states

Source of truth: this wiki page.

- **Area:** [§10 What Leaves the App: Exports, Round-Trips and the Shared Image](ADR-Index.md#area-10)
- **Status:** Accepted
- **Version:** `web/frontend/src/share.jsx`

**Decided.** Reversed twice, and worth both. The card originally drew both the 34px credit chip and the full-height backdrop. The backdrop now replaces the chip, and the toggle reads Chip/Backdrop rather than Off/Backdrop. **Why I was wrong.** Drawing both was reasoned as "the backdrop is atmosphere and the disc beside the name is the identification". That does not survive contact with an actual card: a 34px crop of the same photograph beside a full-height version of the same photograph reads as a mistake, not as a second piece of information. The layout reclaimed space too — the attribution line stopped indenting past a cluster that was no longer there. The second correction followed from the first: once the backdrop replaces the chip, "Off" was a lie, because turning it off never removed the person from the card, it changed how they appeared. The control is also hidden entirely when nobody credited has a saved photo, since a toggle that cannot change the picture is a question with one answer. My call each time.

<sub>`web/frontend/src/share.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
