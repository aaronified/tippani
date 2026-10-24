# ADR-0461: A setting names the reader's own screens, not the media on them

Source of truth: this wiki page.

- **Area:** [§13 Controls, Labels, Icons and Help](ADR-Index.md#area-13)
- **Status:** Accepted
- **Version:** 1.15.2

**Decided.** The Review covers chips read **Library**, **Catalogue** and **Quotes** — the names on the nav strip — where they read Books, Films & shows and Quotes. The stored keys (`books`, `movies`, `quotes`) are untouched.

**Why.** Two of the three named the medium instead of the board, and the nav strip is two inches away saying something else. A setting that renames the reader's own screens makes them do the translation, on a screen whose whole job is to be unambiguous. "Films & shows" had also gone quietly wrong in 1.15.1: the Catalogue holds games now, and a game's lines have always joined the deck through that chip, so the label was undercounting what turning it off would do.

**The keys stay because they are a wire format.** `srReviewScope` is parsed on both sides — `parseScope` here and `scopeFlags` on the server, with the agreement asserted from both ends — and renaming a stored token would empty the deck of every account that had ever narrowed it. A label is not a key, and this is the release where that stopped being obvious.

**Approved.** The owner's, against a screenshot of the chip row.

<sub>1.15.2 — `web/frontend/src/Settings.jsx` · `web/frontend/test/pure/review-scope.test.js`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
