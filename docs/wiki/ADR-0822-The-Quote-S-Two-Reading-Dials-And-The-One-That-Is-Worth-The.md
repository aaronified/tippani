# ADR-0822: The quote's two reading dials, and the one that is worth the feature

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

`access.md`'s §6, second item. The plan called for three axes and there were two: SIZE
already shipped — four per-role dials plus a renormalising global, ten steps, six factors,
every product an integer pixel, with `typescale.test.js` failing on a hardcoded font-size
anywhere in the app. LEADING and MEASURE genuinely did not exist.

**MEASURE IS THE ONE THE PLAN DEFENDS AND IT IS RIGHT TO.** Line length is the largest
readability lever in a body of prose and the axis almost nothing offers; this app's paper
and film looks are deliberately generous with width, which is correct for a card holding
one line and wrong for a page of Proust. A reader with low vision turning the type up gets
a longer line at a bigger size, which is the wrong direction on both counts, and until now
there was nothing to do about it.

**THE UNITS ARE THE DESIGN, NOT A DETAIL.**

| Dial | Stored as | Written as | Why |
|---|---|---|---|
| leading | hundredths, `155` | `--quote-leading: 1.55` | prefs is a flat integer struct and a line-height is a ratio |
| measure | `ch`, `66` | `--quote-measure: 66ch` | the 45–75 rule is stated in characters, and the repo forbids a px box that holds text |

`ch` is also why the measure belongs in `QUOTE_TEXT` rather than on a wrapper: it is
counted in the characters of the element's OWN face, and the wrapper is set in the
interface face at another size.

**0 IS "NOT CHOSEN" IN BOTH, AND THAT IS THE PROMISE THAT MATTERED MOST.** Every existing
account stores the struct's zero value, so a dial whose unset state drew anything new
would restyle every library in the world on upgrade. Leading's 0 renders at 1.55, which is
what the stylesheet already carried; measure's 0 is `max-width: none`, which is what every
screen already did. `quote-dials.test.js` asserts it from both ends — the token JS writes
AND the value sitting on `:root` for the moment before JS has written anything — because a
page that flashed one leading and settled on another would be this change shipping a
visible bug to everybody who changed nothing.

**ONE ASYMMETRY, DELIBERATE.** The server's leading list carries a sixth value, 0, that the
picker never offers: "not chosen" and "Normal" draw the same page, and a list with both in
it asks the reader to tell apart two identical options. Measure's two lists are identical,
because there 0 is "full width" — a real answer somebody picks on purpose. Both halves are
asserted rather than tolerated, in `quote-dials.test.js` and in
`TestTheQuoteDialsAgreeWithTheClient`.

**THE LEADING IS NAMED AND THE MEASURE IS COUNTED.** "1.55" is a ratio between a line box
and a font size and is nothing a reader holds in their head; "66 characters" is the thing
the rule is stated in and the thing visible on the page. So one control shows five names
and the other shows the number — which half of each is legible decided it, not symmetry.

**WHERE THE PLAN WAS WRONG, for the record `docs/plans/README.md` asks for.** Four places:

1. **It said `theme.js` writes them** — "They ride the existing mechanism exactly: `theme.js`
   writes `--quote-size` / `--quote-leading` / `--quote-measure`". They ride `type.js`, which is where
   the other type dials live — and deliberately NOT `typeTokens`, which `typescale.test.js`
   asserts holds one token per step per role and NOTHING ELSE. Folding two more in would
   have broken that guard or, worse, loosened it; they are written beside it by the same
   applier, which keeps both promises.
2. **It named a `--quote-size` token**, in the same sentence. There is none and none is needed:
   size already travels as `--type-display-*` through the four per-role dials, which is the
   same discovery that made this two controls instead of three.
3. **It called all three unbuilt.** Size had shipped some releases earlier, and the public
   roadmap said otherwise until `684c73dc`.
4. **It said nothing about the element the measure lands on**, and that is where the change
   actually went wrong: `max-width` has no effect on a non-replaced inline element, so for
   one commit the dial reached every quote surface except the five search slots, silently,
   because the leading went on working. See the guard note below.

**THE MEASURE HAS TO LAND ON A BLOCK, AND A RATER FOUND THAT IT DID NOT.** `MatchWindow`
drew its text in a bare `<span>` (`SearchPage.jsx`), so five search slots took the leading
and ignored the width — while the CHANGELOG promised it worked "in a search result". The
fix is one line in the one function all five call; the guard is the part worth keeping:
`quote-dials-reach-the-page.test.jsx` now RENDERS each shape a quote is drawn in and asks
whether the element carrying the measure is one a browser would apply it to. Asserting that
`QUOTE_TEXT` carries a `maxWidth` could never have seen it — the object was right and the
element could not obey it. Replaced elements (the capture `<textarea>`) are exempted, and
that exemption is real rather than a loophole: `max-width` applies to them at any display.

**THE CAPTURE BOX DECLINES THE MEASURE, AND THAT IS THE OTHER DECISION.** A `<textarea>` is
a REPLACED element, so `max-width` reaches it whatever its display computes to — which means
the reading measure would narrow the box a reader TYPES a quote into: 45ch inside a 620px
modal, beside a title field and a language box that stay full width. A form field narrower
than its neighbours reads as broken, and the dial is a READING preference; the words under
it now promise as much ("the box you type a quote INTO is not narrowed — only the quote as
you read it"). It keeps the face, the weight, the style and the leading, because seeing your
words in the type they will be read in is the point of setting them there. It is the ONLY
override of `QUOTE_TEXT` anywhere, `quote-type.test.js` knows it by name, and a second guard
beside it fails if the override ever disappears — an allowance for something that has gone
is what lets the next thing through unnoticed.

**THE PRINTED ANTHOLOGY KEEPS THE MEASURE, AND THAT IS A DECISION.** `@media print`
deliberately releases `.anthology-read`'s own `max-width` — paper has its own margins — but
`.anthology-quote` goes on reading `var(--quote-measure)`, so a reader who sets 45ch gets a
narrow column on A4. That is the intended behaviour: the two caps answer different
questions, one a screen layout and the other a reading preference, and silently dropping
somebody's readability setting on the one output they hold in their hands is the worse
failure. Recorded because it reads as a side effect and is not one.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
