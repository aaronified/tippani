# ADR-0640: A proverb's share carries both texts, and the drawing finally has a test

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** 2.2.0

**Decided.** `translation` is a toggleable share field, ticked by default, drawn directly under the quote in the quote's own family — upright where the original is italic, unquoted because the marks upstairs already opened and closed.

**Why with the quote and not with the note.** 0035 drew that line when it added the column: a note is a thought ABOUT the line and a translation is what the line SAYS. So it belongs above the credit, where the proverb card already puts it, and the image and the card cannot disagree about what a proverb is.

**Ticked by default, unlike the note and the page number.** Those are factual noise to a reader; a proverb without its translation is half the quote to anybody who cannot read the language. Untick it and the original stands alone, which is what somebody sharing to readers of that language wants.

**The draw path had no test at all — for any field.** `buildModel` was covered and `drawQuoteCard` was not, so a field could arrive in the model, pass every test in the file, and be absent from the picture. The exhaustive `toEqual` over the whole model existed because the portrait flag had already done exactly that once. This adds a recording canvas — a Proxy that answers whatever the drawing asks of a 2D context and records only `fillText` — so the claim "it is in the image" is now checkable. Verified by disabling the block: the assertion fails naming the missing translation.

**The recorded text is word-by-word**, because the flow engine draws each word separately, so the assertions compare with whitespace removed. A test that expected whole sentences would have failed against correct output.

<sub>2.2.0 — `web/frontend/src/share.jsx` · `web/frontend/src/quoteImage.js` · `web/frontend/test/pure/quote-image.test.js`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
