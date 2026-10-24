# ADR-0750: The phone sheet grows a handle and predefined anchors, where the pack has neither

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** Unreleased

**Decided.** A panel at phone width is a sheet the reader can drag: a grab bar above its
head, three heights it may rest at — its content's own, then the pack's 76% and 94% of the
viewport — and a pull down from the smallest one closes it, through the same guarded exit
as the ✕ and Escape. Tapping the scrim closes it too, as it always did.

**The owner asked for it in those words**, over a screenshot of a bottom sheet with a grab
handle: *"see your own design for the popup. this is ideal. the small bar on top ensures
that this is intuitively draggable. the whole thing is responsive to drag, and has
predefined anchors. can you do this for the popups in the app?"* Asked where the anchors
should be, they chose natural → 76% → 94% and added *"But clicking or tapping outside
dismisses as well."*; asked what may be grabbed, *"Handle, header, and body at its top."*

**This is a departure and it is worth naming as one.** `book-detail.dc.html` draws no
handle and binds no drag — its mobile sheet is a fixed ceiling and a ✕. So the app is
taking a shape from somewhere else, which the repo's own standard ("i don't want a single
line deviating from the prototype unless it is expounded upon in detail") requires an
argument for. The argument is the entry above: the pack picks its ceiling BY KIND, this
app has one panel that is every kind at once, and the choice the artboard makes at design
time is one only the reader can make here. Anchors are that choice handed over.

**What replaced what.** `useSwipeDown` watched for a 90px downward touch and then
dismissed. That is a threshold, not a drag: the sheet stood still until it vanished, so
nothing on screen ever said the gesture existed or that it was working, and the only two
outcomes were "still here" and "gone". `useSheetDrag` moves the sheet under the finger.

**Height, not a transform.** A sheet that slides is a sheet leaving; a sheet being resized
has to reflow, because the reader is dragging to SEE MORE and a translated sheet shows the
same rows further up the screen. So the drag writes `--tp-sheet-h` and the stylesheet
reads it, with `auto` as the fallback so a sheet the drag has not touched is sized by its
content rather than jumping on first paint.

**And the body's own scroll is not stolen.** A drag that starts in the body while it is
scrolled is the reader reading; only at `scrollTop <= 0` is there nothing above to reveal
and a downward pull can only be a dismissal. The handle needs no such test and no slop to
START a drag — it has nothing else to be.

**But a press is not a drag, and reading it as one cost the handle its other half.** The
bar is a button: it takes a tab stop, answers the arrow keys, and a plain press steps to
the next anchor and back round to the smallest, because a mouse has no way to discover a
gesture and a reader who taps where the app drew something pressable is owed an answer.
That press did nothing at all for as long as it existed. Being live from the first
`pointerdown` — the sentence above — meant the RELEASE also read as a completed drag, so
it settled at the anchor the sheet was already on and swallowed the click that follows a
pointer sequence, which is a guard that exists so a drag does not step the sheet a second
time past where the reader just put it. The guard was right; what it read was wrong. A
release is a drag only if the pointer travelled the same four pixels that make a touch in
the body a drag rather than a tap on a row — so the handle needs no slop to begin one and
the same slop to have made one.

**And then the mark stopped being the target at all.** The owner, over the finished
gesture: *"the bar is too small to drag. the whole header bar should act as the bar. the
bar is there just to make it intuitive."* 36 by 4 is a mark; the strip around it barely
cleared the 44px floor and was the only thing a thumb could grab. The header drags now —
67px of it — and the keys inside it keep their press by the rule the paragraph above
already states. `touch-action: pan-x` rather than `none`, because the title and the crumb
scroll SIDEWAYS under their fade, which is this app's standing answer to a long name;
taking every gesture would freeze the one thing it does instead of truncating.

**And it reaches the desk panel too, which is a choice and not an oversight.** The header
is one component; giving it two heights by viewport would be exactly the drift the
"similar things should act similarly" directive exists to stop, and what is being removed
is room around a 44px key rather than anything the pack draws. A desk panel is a card in
the middle of the screen with the same head on it, and it gets the same 48px.

**Which is what let the bar get slim.** *"the header bar is too thick (vertically). make it
slimmer. by at least 30-40%."* The mark's strip existed to be hit, and nothing has to hit
it now, so it is 18px around a 4px mark; the bar itself is 49px around its 44px key
instead of 44px of key inside 16px of padding. 104px to 67px — 36%, measured in a browser
by `make sheet-drag`, which asks it as a rule rather than as a number: the bar may exceed
its tallest key by the padding a rule needs and no more. **The 44px floor under the KEY is
the pack's and is untouched.** The mark now falls under it, deliberately: it is a sign, its
target is the bar, and `make controls` records it in the touch-floor bucket where the
report is the review.

**The height is written once a frame, and the blur stands down while it moves.** *"the
animation is not just not-smooth. it introduces screen tears!!"* — and it was the app's
fault rather than the browser's. A pointer stream arrives finer than a frame, and each
write invalidated the sheet's layout AND the scrim's 10px backdrop blur, so the browser was
laying out and compositing several times inside one frame and presenting halves of two.
The write is coalesced into one per animation frame; the blur is suspended for the length
of the gesture, because nobody reads a blur while the thing in front of it is moving. The
wash stays, so the layers still read as layers.

**And a sheet follows its content until the reader places it.** *"this is a long popup, but
it has a very low starting position … it is inheriting the positioning of the picker …
when there is no picker (only one available option), it makes no sense."* A sub-surface
opens INSIDE this box by design — the entry at the top of this section is why — so the
element never changes, the drag effect never re-runs, and nothing re-measures. It
re-measures after every render now, and moves only from the anchor its content asked for:
a sheet dragged to 76% has been PUT there. The measurement changed with it, from
`scrollHeight` off the sheet — which the stylesheet's `max-height` has already capped, so a
long sheet measured as exactly the cap — to the chrome plus the body's own `scrollHeight`,
with the chrome SUMMED from the chrome rather than differenced from the sheet, because a
measurement that takes the sheet's current height as an input walks on every render.

**Instead of.** A fixed ceiling with no gesture, which is the entry above and what the
pack draws — rejected because it makes the app pick, for every panel, the number that the
artboard picks per kind. A drag that dismisses on a threshold with no movement, which is
what was there — rejected as a control that never says it exists. A sheet that slides
rather than resizes — rejected above.

**What holds it, in three layers, because a drag has three separable halves.**
`test/pure/sheet-anchors.test.js` states the arithmetic with no React in it: which anchor
a release lands on, and when a release is a dismissal. `test/dom/sheet-from-the-bottom.test.jsx`
states the wiring: which presses start a drag, that the sheet resizes rather than slides,
that leaving takes the guarded exit. Both of those have to FAKE a height, because jsdom
lays nothing out — so `make sheet-drag` runs the gesture in a real browser and fails if the
handle is under 44px, if the sheet rests between anchors, if a pull up does not grow it, if
a press on it does not move it, or if a pull off the bottom does not close it. With the
drag's own `pointerdown` listener removed, the probe prints two FAILs and exits 1.

**And each of those three layers had to be shown what a press is.** All three passed over
a bar that did nothing: the jsdom cases fired `click` alone, which is the third of a
press's three events and skips the two that make the rule hard; the browser probe only
dragged; and `make controls` pressed the bar and could not see the answer, because its
fingerprint carried no geometry and the bar's whole effect is a height. Three guards, one
blind spot each, and the same control invisible in all three — which is the argument for
having three rather than the argument against.

<sub>Unreleased — `web/frontend/src/ui.jsx` · `web/frontend/src/sheetAnchors.js` ·
`web/frontend/src/index.css` · `scripts/screenshots/sheet-drag.mjs`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
