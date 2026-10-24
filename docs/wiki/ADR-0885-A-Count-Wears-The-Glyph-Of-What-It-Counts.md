# ADR-0885: A count wears the glyph of what it counts

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

The owner's rule, given when the sweep asked how far "everywhere" reached: *"when there
is enough space (like in section subtitle or subheaders), the glyph will follow the text
so the association is clear. where there is small space, like rows with buttons and lots
of info, they will serve as a visual indicator of the nouns, just like they do for the
verbs."*

**TWO SHAPES AND ONE COMPONENT, because the second only works if the first has run.** A
subheader reading "42 skipped ⏭ in 2 works 📚" is where a reader learns which drawing
means what; a row reading "27 ⏭ / 28 ❝" spends what the subheader taught. Written as two
components they would drift, and the day one changed its glyph the other would go on
teaching the old one. `Tally` (ui.jsx) is both, and `showWord` is the only difference.

**THE WORD IS ALWAYS IN THE NAME, DRAWN OR NOT**, which is the lesson the section rail
paid for one commit earlier: a glyph alone is a picture to a screen reader and nothing at
all. `showWord` decides whether the noun is PAINTED, never whether it is said.

**AN `sr-only` WORD WAS THE FIRST ATTEMPT AND IT WAS WRONG TWICE.** Off-screen text is
still `textContent`, which is what this repo's tests and the journey tier's view of a
screen read — `settings-changed.test.jsx` went red on `"Review1 changed"` within the hour.
And the same mistake has a second face: a flex `gap` puts air between two BOXES and
nothing between two strings, and flex items are blockified, so "6 skipped" reached
`innerText` as `"6\nskipped"` and a journey asking whether the screen said it was told no
over a screen that plainly did. `.tally` is `display: inline` and the space between the
figure and its noun is a real space in the markup. What a reader copies is the text.

**RED IS FOR A COUNT THAT IS THE PROBLEM**, and it takes the figure AND the glyph. A red
number beside a grey drawing says the number is the warning and the noun is neutral, which
is not what a skipped count means.

**WHERE THE GLYPH DID NOT GO, AND WHY.** `a-count-wears-its-glyph.test.js` is the list,
and a new standalone count of a drawn noun has to join one column or the other. The
reasons that recur: a count inside a SENTENCE (a confirm dialog's body, a flash) would be
a rebus; an `<option>` can only hold text; a breadcrumb assembled by joining strings has
nowhere to put an element; and "{n} characters" on the type screen means LETTERS, where
the person glyph would say the opposite of the truth.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
