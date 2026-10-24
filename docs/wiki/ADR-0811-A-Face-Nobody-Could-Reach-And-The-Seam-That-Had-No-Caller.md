# ADR-0811: A face nobody could reach, and the seam that had no caller

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

`fonts.js` has carried a Bengali and a Devanagari role since the type dials shipped
— three faces each, a reader's choice stored, five CSS custom properties per role
written out on every render. Two elements in the whole app wore them, and both are
the wordmark. A Bengali highlight drew in the Latin text face.

`iso639.js` even exported the lookup for it. **`scriptOf` was exported, tested, and
called from nowhere in the app** — the same shape as `attributionOf` (#143), and the
same reason it is a defect rather than a spare part: a seam with no caller is
untested against the thing it was built for, so it is wrong in ways only its first
caller finds out.

**IT WAS WRONG IN EXACTLY THAT WAY.** Its own comment said "the values are fonts.js's
FONT_ROLES keys where the app has a face for the script", and `scriptOf('Italian')`
is `'latin'` — no role, no stylesheet rule. A caller trusting that sentence would
have put `class="latin"` on a card and watched nothing happen: correct-looking code,
no error, no effect. `scriptFace` in fonts.js is the guard, derived from the roles
that carry a `script` so the two cannot drift; `scriptOf` now says only what a
language is WRITTEN in, which is a fact about the language.

**THE TAG BELONGS TO THE QUOTE, NOT TO THE SLOT**, and that is why it rides on
`quoteTexts` rather than on a render site. A quote's language is stored; the
translation's is not. Under "translations first" the original is the SECOND line, so
a card computing "which class goes on the big type" for itself would put the Bengali
face on the English. Every caller already asks that function which text leads; asking
it for the face too is one answer instead of two.

**AND `.bengali` COULD NOT BE USED AS IT STOOD.** It carried `color: var(--amber)`,
which was harmless while the wordmark was its only caller and would have turned a
Bengali library amber from end to end. A class named for a script says which letters
to draw text in; it does not get to say what colour the text is. Both wordmarks ask
for the amber themselves now.

Scope, stated rather than assumed: the three places the SPA draws a quote — the book
card, the film frame, the table cell. Print inherits it, being the same DOM. The
share image is a canvas and picks its faces by a different mechanism; the EPUB is
written server-side. Neither is tagged and neither is claimed to be.

One more comment expired and was corrected with it: `Movies.jsx` said `dialogues`
had "a `translation` column but no `language` one (0051)", which 0071 ended — and
the line under it had been reading `d.language` ever since, which is the structural
change doing exactly what it was built for.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
