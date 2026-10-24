# ADR-0679: A fill has to argue for itself, and only four arguments count

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** Unreleased

**Decided.** The app is drawn at 1.85 and stays drawn. Nineteen glyphs are solid, each
because it can name one of four reasons, and `icons-fill.test.jsx` fails any that cannot.

**THE RULE MATTERS BECAUSE THE DEFAULT WAS AN ACCIDENT.** Every glyph used `iconStroke`
because the one beside it did, not because anything refused a fill — and the moment a pack
of 82 filled icons is on hand, "the app is wireframe" stops being a description of the set
and becomes a rule somebody has to keep. Rules like that last exactly as long as the person
who wrote them is the one adding glyphs. So the exceptions are declared, with their reason,
and the test names the offender rather than a reviewer having to.

**THE FOUR.** It is the ON state of a pair (the favourite, the three shelf marks). It names
a PLACE rather than a job, which is the whole rail. Its subject is a silhouette in life,
where an outline at 19px turns the shape into a ring — the mortarboard, and the face and the
film reel were both **rejected** because each already sits inside something supplying the
ring. Or the fill carries information, as the palette's wells hold the category colours.

#### The pack was not the problem; the boxes were

**PHOSPHOR DRAWS EACH GLYPH TO ITS OWN MARGINS.** Dropped into a rail straight from the
pack, the film reel occupied **0.59** of its box and `users` **0.98** — thirteen tabs at
thirteen sizes, which is the exact defect `icons.test.jsx` was written for after Quotes
shipped smaller than the two tabs beside it. Each fill therefore carries a viewBox cropped
to its own ink and sized so the **long side is 0.82** of the box. That is uniform scaling:
nothing is stretched, the drawing is still the pack's, and the test holds the 0.82 for the
whole rail rather than naming five glyphs by hand the way it used to.

**AND THE OLD TEST HAD ALREADY GONE STALE WITHOUT FAILING.** It measured a hardcoded list —
`IconQuote`, `IconBooks`, `IconReel`, `IconHome`, `IconStats` — which stopped being the nav
set the moment three of them kept their outline for verb duty. It now measures through
`NavIcon`, so it cannot go on checking the wrong five and passing.

#### Eight twins, five replacements, and why the split is not arbitrary

A glyph that is also a verb somewhere else **must not** wear the fill that means a place:
`IconSearch` has thirteen non-nav callers, `IconQuote` five, `IconUsers` five. Those eight
gained an `IconNav*` twin. The other five — Home, Metadata, Import, Stats, Settings — had
**no caller outside the switch**, so their own drawing became the filled one. Creating
thirteen twins would have left five exports with no caller, which this document has already
had to name as a defect twice.

#### What the fill work found

**A GAME ANNOUNCED ITSELF AS A GAME AND DREW A FILM.** `ReadingBadge` computes `isGame` for
its aria-label and then branched `isBook ? reading : watching`, so the one medium with its
own word had no picture of its own. Fixed by the glyph that was being added anyway.

**PRACTISE AND THE QUIZ CARD WERE ONE PICTURE.** Nine call sites read `practise` and drew
`IconQuiz`. The mortarboard separates the entry point from the card, which is what
`icons.js` predicted it would do.

**THE FAVOURITE'S STATE LIVED IN ITS LABEL.** `review.jsx` flipped between the on and off
words while drawing one heart.

#### What was discarded, and one rule bent

**The seal was dropped from the fill set** at the owner's call. **The palette was taken**
though the repo had a recorded reason for the ink drop — "the control it opens is six
coloured dots and the glyph should promise the same thing it delivers" — because rule 4 is
explicitly about that glyph and the draft replaces v3.

**AND RULE 1 IS KNOWINGLY BENT.** It says both halves of a pair must be the same drawing to
the decimal, and `icons.js` warns that "an outline and a fill from different hands do not
line up". The shelf marks pair a two-page spread with Phosphor's book-and-person and a play
triangle with its monitor, which are different pictures rather than one changing state. The
owner's ruling was that the fills take priority; it is recorded here because the next person
to see a glyph change shape on a state change should find the reason rather than a bug.

<sub>Unreleased — `web/frontend/src/ui.jsx` · `web/frontend/test/dom/icons-fill.test.jsx` · `web/frontend/test/dom/icons.test.jsx` · `web/frontend/scripts/glossary/catalogue.js` · Phosphor Icons (MIT)</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
