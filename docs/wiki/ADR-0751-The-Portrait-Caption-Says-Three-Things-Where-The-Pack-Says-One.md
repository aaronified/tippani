# ADR-0751: The portrait caption says three things where the pack says one, and the pack says two floors

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted

*The owner's standing rule is that nothing deviates from the prototype unless it is
expounded upon in detail. `character-popup.dc.html:1248-1256` is the artboard for this
caption and the app now prints a different sentence under a different rule. This is the
detail. It is written here rather than only in a code comment because CLAUDE.md names this
file as where a design departure goes, and the departure was landed in a commit whose own
register section said the wording had been corrected — which is not the same as saying the
pack had been left behind.*

**What the pack draws.** One measurement and one fault, in one string:

```js
return w >= 400 && h >= 400
  ? `${w} × ${h} px`
  : `${w} × ${h} px · under 400 × 400, soft on a share card`
```

…with the whole line inked `var(--error)` under the floor (`:1255`). The companion
artboard for a work's proposed artwork says the same thing at a different floor —
`w >= 400 && h >= 600` (`work-details-popup.dc.html:883`), and its clause is `· soft on a
share card` with no numbers in it.

**What the app prints.** The size, always; then up to three notes, each earned:
`under 400px`, `low contrast`, and `{a}:{b}, cropped`. Three departures, and each is
answering a question the owner asked over a real screen — *"the character/actor cards do
not say the size of the image or whether they are low contrast (for the images). and how
do we tackle images that are not 2:3?"*

**The size fault and the contrast fault are two facts, so they are two clauses.** The
pack's one string is a size test wearing a sentence about contrast, and the repo shipped
it that way: `identity.portrait.soft` read "low contrast" and the code showed it when
`w < 400 || h < 400`. A 300×450 photograph was called washed out and an actually
washed-out 2000×3000 one said nothing. Making the pack's sentence true would have meant
either measuring contrast and calling it a size, or calling a small picture soft — and
the owner's question names them separately, which settles which of the two the reader
wants. **Rejected:** keeping the pack's single clause and simply making it honest, i.e.
`under 400 × 400`. That is the smaller departure and it drops the answer to half the
question.

**"Soft on a share card" is a consequence, and the caption states the cause.** The
pack's clause explains WHY a small picture matters, which is good writing for an artboard
seen once and worse for a line the reader meets on every person sheet: the share card is
one of several places the portrait is drawn, and the reader's action — find a bigger file
— does not depend on which. `under 400px` is shorter and is the repo's own house style
for a threshold. **Rejected:** carrying the full clause, which at 390px pushes the
caption to two lines beside a `max(96px, 7.4em)` face.

**One floor, not two.** The pack's two artboards disagree — 400×400 on a character's
portrait, 400×600 on a work's proposed artwork — and nothing in either says why. The app
takes 400 on both axes, which is the character artboard's rule and the weaker of the two;
a 400×600 floor would flag a 400×500 portrait that the character screen's own artboard
passes, and two floors for one kind of picture is the sort of thing that reads as a bug
on whichever screen the reader saw second. **This is the departure I am least sure of**
and it is the one to revisit if the owner wants the share card's aspect enforced: the
honest fix is then one floor in one constant, applied on both screens, not two numbers in
two prototypes.

**And the crop note is an addition, not a departure.** Neither artboard says anything
about a picture that is not 2:3, and `object-fit: cover` was cropping one silently. The
owner asked what to do about it; this says it, and the answer to FIXING it is the pack's
own (`imageslot.js`: *"cover starts the image filling the frame (overflow cropped)… the
crop persists alongside the image in the sidecar"*) and is not built. **The crop note
does not take the error ink**, which the pack's fault clause does: a flawless 2000×2000
studio portrait is not a bad picture, it is a picture the slot will frame, and painting
that line red warns about the one fact in it that is nobody's mistake while devaluing the
two that are.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
