# ADR-0754: No prefetch, and a door that draws before its own count answers

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** Unreleased

**Decided.** The owner asked for client-side prefetch on a choppy connection. The ruling
after the measurement was put to them: **neither gesture** — not a `pointerdown` on a row,
not a row entering a moving viewport — and the wait removed instead.

**Why that is not merely "not yet".** `docs/plans/prefetch-and-loaders.md` establishes that
this repo's "no background fetching, ever" (§6's words until 3.1.0 made them "nothing
fetches on a schedule, ever") is about the SERVER fetching third-party metadata on a
schedule, and that same-origin requests without a press are already ordinary here —
`warmScreens` prefetches route chunks on idle, a work page asks for up to twenty portraits
nobody requested (`usePortraitFill` then, one `cast/art` request since 3.1.0), and the
search vocabulary loads on first focus. So nothing written down forbade this. What killed it is narrower and worse: **`GET /characters/{id}`
WRITES.** `fillLineFaces` → `loadCharacterImages` → `adoptQuoteCharacters` opens a
transaction and inserts up to twelve `work_cast` rows, adopting characters a work's quotes
name but its cast list does not. Deliberate on a deliberate press; on a `pointerdown` it
means a finger resting on a chip creates rows.

**So the boundary sentence that plan proposed is rejected as written.** "The reader's own
data from their own server, on an expressed intent" is not a sufficient test, because it
passes for a GET that mutates. The test is **a read that is only a read**, and knowing which
those are means having looked rather than having assumed a GET is one. Nobody has built that
list, which is the real reason there is no prefetch.

**What shipped instead is subtraction.** `openCharacterDoor` awaited `GET /characters/{id}`
before drawing anything, because the count of works decides whether the identity row appears.
`fetch` has no timeout, and a socket accepted and never answered leaves the promise pending —
so a press drew NOTHING AT ALL, with nothing on screen saying it had landed. The count now
only ADDS a row: wherever the press already has two answers the panel opens at once and the
identity drops into place when the count lands, spliced by key order rather than appended
because the row order is the owner's ruling. `choosePanel` grew `more` and `order` for it.

**One path still waits, and that is not an oversight.** With no live performer the count
decides between OPENING the character and ASKING between two — different presses, neither
drawable before the answer. It is bounded at 8s instead, and a timeout arrives as
`{ok:false}` rather than a rejection because `send` catches the abort, so it lands on the
same branch a failed request already took: the identity is left out.

**Rejected: a read-only door for the panel** — moving the adoption to where a reader asks
for it — which is a server change and a decision about when adoption should happen, both
larger than the complaint that prompted any of this.

**AND THE IMAGE LOADER, which is the other half of the same request** — "use some
loading animation if there is an image and it is not loaded (no loader if there is no
image)". The second clause is the hard one, and not for the reason it looks like: an empty
box is easy, but a mark keyed on "no pixels yet" appears on every FAST load too, so a local
network turns a shelf into a flicker. So the timing is the feature. `useSlowArrival`
(`imageWait.js`) lags a pending state by 150 ms going up — below which nothing is drawn at
all — and by 300 ms coming down, so a picture landing just after the mark appears does not
blink it out. Both numbers in one place, because a component inlining them gets the delay
right and forgets the hold, which is the half nobody notices until a fast connection makes
everything twitch.

**THE MARK IS A CLASS ON THE `img`, NOT AN ELEMENT.** An `<img>` paints its own background
until its pixels land and then covers it, so the mark needs no wrapper, changes no layout,
and cannot be forgotten by a caller — the box is already reserved by whatever sizes the
picture. A loader that reserves its own box is how a loader causes the shift it was added
to soften. And it is an animated gradient, so the existing
`prefers-reduced-motion` rule freezes it into a still tint with nothing new to arrange:
disable every animation and the mark is still there, which is this repo's rule.

**IT IS NOT `.ph`, AND `Sprockets` IS NOT A LOADER.** Two things in the tree look like
candidates and neither is. `.ph` stands in for artwork there is NONE of and says so in
words — the opposite claim to "there is one and it is late", and a reader who cannot tell
them apart waits for something that is never coming. `Sprockets` is the film skin's
sprocket holes.

**AND IT IS GATED ON `loading`, WHICH IS WHERE THIS GOT INTERESTING.** `Cover` sets no
`loading` attribute on either branch, so every cover is eager by the HTML default — the
browser is fetching it now, and a mark is honest. `Face` defaults to LAZY and is drawn
ninety to a screen: a lazy picture below the fold has not been requested, so a mark over it
would describe a wait nobody is having and animate ninety of them against §8's idle-CPU
budget. Its one eager caller is `PortraitBlock`, which is also the only place a face is big
enough for the mark to be information rather than a twitch. The lazy ones keep the reserved
box they already had.

**Not done, and named rather than implied:** the eleven direct `<img>` tags that go through
neither shared component, and step 4's back-cancellation, which needs a shared cache and an
invalidation table nobody has built — the panels already say `common.state.loading` while
their record is in flight, so what step 4 adds is the CACHE, not the loader.

<sub>Unreleased — `web/frontend/src/identity.jsx` · `web/frontend/src/imageWait.js` · `web/frontend/test/dom/speaker-destinations.test.jsx` · `web/frontend/test/dom/image-wait.test.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
