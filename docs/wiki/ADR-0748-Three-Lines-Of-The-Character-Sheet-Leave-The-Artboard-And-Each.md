# ADR-0748: Three lines of the character sheet leave the artboard, and each is a measurement

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** Unreleased

*The owner's standing rule is that nothing deviates from the prototype unless it is
expounded upon in detail. `character-popup.dc.html` is the artboard for this screen and
three of its declarations are now reversed in `index.css`. This is the detail. It is
written here because CLAUDE.md names `docs/wiki/Design-decisions.md` as where a design departure goes, and
the three had landed with the argument only in a CSS comment — which is the right place
for the reader of that rule and the wrong place for anyone asking what the app owes the
pack.*

**The counts row stops centring itself** — `justify-content:center;gap:9px;`
(`character-popup.dc.html:688`), where `.cs-count` is now `flex-start`. The artboard draws two
equal boxes side by side, each centring its own `[glyph][number][caption]` group. Equal
boxes with unequal contents centre to unequal offsets: "11 QUOTES" and "1 SCENE" put their
glyphs at two different x, their numbers at two more, and their captions at two more
again. The prototype's own fixture hides it, because the artboard's two numbers happen to
be the same width. On a real library they are not, and the owner read it off their phone
as "the quotes and scene counts are a little misaligned" — which is precisely what
centring two different sentences in two identical boxes produces. **Instead of** nudging
one box's padding, which fixes one pair of numbers and breaks the next: anchor both groups
to the start, where a shared left edge is a property of the layout rather than of the
data.

**The figure takes a three-character column** — `line-height:1;color:var(--ink);flex:none`
(`:692-693`), where `.cs-count-fig` keeps `flex: none` and adds `min-width: 3ch; text-align: right`. Start-
anchoring alone only moves the problem one element along: the glyphs line up and then a
`1` and an `11` push their captions to two different offsets. A right-aligned column three
characters wide is the units place holding still, which is what makes the two captions a
column rather than two coincidences. Three and not two, because two aligns 1 against 11
and then 100 pushes the caption along again, and three is where a character's quote count
actually stops on a real library; past that the column grows and the boxes disagree once
more. The **rejected alternative** is a column wide enough for a number nobody has, which
buys permanence with row width the names need. `ch` and not px, because the figure is
display type and grows with the type dials — the repo's own rule about boxes that hold
text.

**A row's value can shrink** — `;flex:none;white-space:nowrap` (`:496`), where
`.cs-row-meta` is now `flex: 0 1 auto; min-width: 0; max-width: 58%`. `flex: none` on the
value takes its full width out of the row before the label gets any, so a long value
squeezes the label's scroller until the label itself clips — "In this work" arriving as
"In this wor". The artboard is right for the artboard: its values are short. The app's are
whatever the reader typed. The ceiling is the other half — a value that CAN shrink will
still take the row if nothing stops it — and it is a share of the container rather than a
px for the same type-dial reason as above. `white-space: nowrap` is not reinstated because
`.name-scroll` now supplies the overflow and the fade, which is the repo's answer to a
name too long for its box and is not something the pack had to solve.

**What holds these three to their arguments.** `counts-align.test.js` asks the
declarations directly: that `.cs-count` does not centre, that the figure's column is at
least three and measured in `ch` or `em`, and that `.cs-row-meta` declares a `flex` that
can shrink over a `min-width` of zero. It asserts the RULE and not the value, so a future
hand may widen the column or move the ceiling; what it may not do is quietly restore
`flex: none` and put the label back in the state the owner reported — which is what
happened once already, when the guard nearest the site was checking a class name and
noticed nothing.

<sub>Unreleased — `web/frontend/src/index.css` · `web/frontend/test/pure/counts-align.test.js`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
