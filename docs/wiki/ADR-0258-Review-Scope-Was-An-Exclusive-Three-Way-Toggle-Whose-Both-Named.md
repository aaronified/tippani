# ADR-0258: Review scope was an exclusive three-way Toggle whose "Both" named three media

Source of truth: this wiki page.

- **Area:** [§8 The Review Loop](ADR-Index.md#area-8)
- **Status:** Accepted
- **Version:** Broken from 1.5.0, fixed in 1.7.0

**Decided.** Settings offered *Books*, *Films & shows*, and a third option labelled **Both**, which silently meant all three.

**Why.** It began as a two-way switch when there were two media, and the third arrived without the control being revisited.

**Reversal.** The word undercounted what it did, and because the three were exclusive, "books and quotes but not films" was unsayable: narrowing away one medium cost you another you had not mentioned, and anyone who had once picked *Books* had no route back to including quotes except by also taking film dialogue. The deck itself had been drawing all three the whole time and the server had accepted a `quotes` scope all along — so the bug report ("quotes should be included in the daily quiz") described a control, not a deck.

**Approved.** The original control was mine and so was the mistake of not revisiting it when the third medium landed.

<sub>Broken from 1.5.0, fixed in 1.7.0 — `CHANGELOG.md` · `How-this-was-written.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
