# ADR-0653: A native control is only better while the browsers agree about it

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** 2.2.3

**Decided.** The character box is a built dropdown (`CastCombo`) rather than a `<datalist>`. This reverses 2.2.1's decision, which was argued in this document.

**The original argument still reads correctly** and two thirds of it are still true: the browser's own list filters as you type, does not steal a phone's keyboard, and cannot refuse free text. What it missed is that `<datalist>` specifies almost nothing about PRESENTATION. Desktop Chrome opens it only after a keystroke; Safari draws a scrolling menu of everything; Android renders a strip above the keyboard that looks like autocorrect. For a memory aid, "there is a list here" being discoverable IS the value — the box you open in order to be reminded of a name cannot require you to remember it first.

**The chapter fields keep the datalist**, because none of that applies to a number you were about to type anyway. Reversing a decision for the case that broke it, rather than everywhere it was made, is the smaller change and the honest one.

**The actor is in the row.** A film's cast is twenty pairs and the half you remember is as often the actor's, so a list of characters alone is one you have to translate before you can use it.

<sub>2.2.3 — `web/frontend/src/suggest.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
