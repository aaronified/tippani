# ADR-0828: Three loose ends, and two of them were about what a test cannot see

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

**THE TOGGLE ANSWERS THE ARROW KEYS (#205).** Found while checking my own prose: a
changelog line claimed "the pickers and toggles answer arrow keys", and a grep over
`Toggle`'s whole body found no `onKeyDown` at all. The sentence was corrected first
(465e4da2); this closes the gap it described. Manual activation, matching
`ColorSwatches` — and not only for consistency: AUTOMATIC activation would fire
`onChange` for every option arrowed THROUGH, and these toggles save, so crossing a
four-option strip would write three settings nobody chose.

**AND A GUARD I COULD NOT PROVE, SO I REMOVED IT.** The handler carried
`if (!step || disabled) return`. No mutation could kill the `disabled` half: a browser
refuses focus on a disabled `<button>`, and userEvent refuses to DISPATCH to one, so
there is no path to the check. jsdom's willingness to honour `.focus()` on a disabled
element made it look reachable for one round — that is jsdom deviating, not a case worth
guarding. Removed, with the `disabled` prop on the buttons left as the protection and
the test asserting THAT. This took three goes and each wrong answer is written into the
comment, because the next reader will have the same first instinct.

**THE CONTRAST GUARD COULD NOT SEE THE BIGGEST TEXTURE IN THE APP (#200).**
`accent-texture.test.jsx` derives its list of textured surfaces from rules whose own
`background-image` is a texture. `.grain-overlay` paints its noise through a
**`mask-image`** holding an feTurbulence SVG, over a flat background-colour — so the one
surface that covers the WHOLE SCREEN at z-index 60 was the one surface nothing asserted
was switched off. Drop it from the contrast block and every case passed, while a reader
who asked for more contrast kept a grain layer over the entire app.

`isTexture` already matched it (the predicate tests for `feTurbulence`), so this was not
a gap in what counts as a texture — it was a gap in WHERE THE WALK LOOKED, which is the
same shape as the bug that file's own header records. The walk reads `mask-image` and
`-webkit-mask-image` now, and dropping `.grain-overlay` fails it.

**AND WHAT A TEMPLATED KEY IS CHECKED FOR (#203).** `locale-complete` walks literal
`t('some.key')` call sites exactly, and reads as though it covers everything. It does
not: a key built as `` t(`stem.${name}`) `` is a PATTERN to the scan, and nothing knows
which values `name` takes — so a leaf deleted from a family the template reaches renders
a humanised stub and the suite stays green. That is not fixable in general and the file
now says so, pointing at the per-surface remedy (assert the RESOLVED WORDS against
en.txt, as `quote-dials-in-settings.test.jsx` does).

What IS derivable is the STEM: a template whose pattern matches no key at all is
pointing at a namespace that does not exist. Measured first — 55 templates, one matching
nothing, and that one (`how.${i}`) is a scanner artefact rather than a defect, so it is
named rather than pattern-excused. Misspelling a real stem now fails.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
