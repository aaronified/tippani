# ADR-0705: OPEN — a growing rail, or the icon rail, once the type is turned up

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** Unreleased

- **The state.** `--rail` now grows with the dial without a ceiling, so at 200% on a
  1180px window the rail is about 471px — roughly 40% of the screen. That is the honest
  reading of "a box that holds text is not a px", and it is also a choice that was taken
  while it was the only way to stop the labels being cut.
- **The other answer** is to keep the wide rail bounded and let it fall back to the 68px
  icon-only rail once the words no longer fit — the app already has that mode and that
  breakpoint, so at a large dial the reader would get glyphs and their page back instead
  of a third of the window spent on nine words.
- **Which is right is a look decision** about what a reader who has doubled their type
  size actually wants, and it was not put to the owner. Both satisfy the standing rule;
  only one of them is currently built.

<sub>Unreleased — open · `web/frontend/src/index.css` (`--rail`)</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
