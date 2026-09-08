# Prefetch, and a loader that only appears when something is coming

**The owner's request, verbatim:**

> i think the issue there was an artefact of choppy internet. can we have some prefetch on
> the client? unless we get the images we can do prefetch pretty cheap. and use some loading
> animation if there is an image and it is not loaded (no loader if there is no image).
>
> also a loader can be introduced for any page that is not yet fetched. on pressing back, the
> loader will go away, and the fetch will go to background job (the page opening is cancelled
> in that case).
>
> discuss.

## THE CORRECTION THIS FILE EXISTS FOR

I first put two of the repo's own written decisions to the owner as things they would have to
overrule. **Both quotes were real and the scope I attached to them was not.** Read in their
own context, neither one is about this request at all.

| What I quoted | What it actually governs |
|---|---|
| `docs/PLAN.md` — "**Decided.** No background fetching, ever." | Its section is titled *"Metadata is fetched on demand only, and the one bulk path is admin-triggered and cursor-chunked"*, and its **Why** is §8's idle-CPU budget "on a NAS sharing a box with a hundred other services", where "a background enricher is a poller by another name". It is about the SERVER fetching third-party metadata on a schedule. |
| "This app makes no network request the reader did not ask for" | Both places it appears are about **third parties**: a type picker that would phone a font CDN (`docs/ui-glossary.html`) and a links panel that would phone ten providers for their favicons (`book-detail-wide.dc.html`). Neither is about the app asking its own server for the reader's own rows. |
| `App.jsx` — "There is no loading state… this app has never shown a spinner for a screen" | It sits on the `lazy()` route-chunk declarations, above a `Suspense fallback={null}`, and its own next sentence is about the chunk: "the screen still announces itself immediately and only its body arrives a beat later". It is about CODE, not data and not images. |

**So neither half of the request needs a ruling, and the loader half needs none most
clearly of all.** A loader for an image that exists and has not arrived collides with
nothing anybody has written down.

**And the precedent runs the owner's way rather than against it.** `warmScreens` in
`App.jsx` already prefetches route chunks on idle — the paragraph directly above the
house rule says so — and `usePortraitFill` (`credits.jsx`) already fires up to twenty
unrequested `POST /people/portrait` for a screen the reader is merely looking at, and
`PLAN.md` blesses fetching the search vocabulary on first focus. The rule as landed has
always meant *no outbound third-party call, and no poller*; it has never meant *no
same-origin request without a press*.

**What is still worth writing down** is the boundary, so the next reader inherits a line
rather than this paragraph:

> Prefetch is permitted for the reader's OWN data from their OWN server, on an expressed
> intent — a `pointerdown` on a row, or a row entering the viewport of a list already being
> scrolled. It is forbidden on a timer, on idle across a whole library, or to any third
> party.

That keeps intact the thing "ever" was protecting, which is §8's idle-CPU budget. It belongs
in `docs/PLAN.md` beside the decision it narrows — amended in place, because the entry a
future reader will quote back is the one that is already there.

## WHAT THE DESIGN PACK SAYS ABOUT WAITING

**This section has been wrong three times, in three different directions, and the third
time was in the paragraph correcting the second.** The sequence is worth keeping, because
the shape of the error is the same every time — an answer summarised instead of read:

1. *"Nothing."* — the sweep was run and its result read off the `.md` and `.dc.html` files
   without opening any of the four `.js` files in `docs/design/prototypes/`.
2. *"It says exactly what the owner asked for."* — `imageslot.js` was then opened at its
   stylesheet and its comments, and those do describe a spinner and a
   `prefers-reduced-motion` fallback and a "placeholder (no spinner)" rule. What was not
   read is the line that decides WHEN.
3. **What it actually says**, from `imageslot.js`:

```js
// First fill (prev empty) keeps the existing placeholder-until-load behavior — no spinner.
if (prev || this._hidShowing) this.setAttribute('data-swapping', '');
```

`:host([data-swapping]) .loading{display:flex}` is the only rule that shows the ring. So the
pack's rule is:

| Case | The pack |
|---|---|
| An image REPLACING one already on screen | spinner, degraded to a static two-tone ring under `prefers-reduced-motion` |
| An image arriving into an EMPTY slot — a cover on a page you have just opened | **placeholder, and deliberately no spinner** |
| No image at all | placeholder |

**The owner's request departs from that on the case that matters most.** "Some loading
animation if there is an image and it is not loaded" describes a first fill — a cover on a
work page you have just arrived at — and the pack withholds the spinner there on purpose.
What the two agree on is the third row, "no loader if there is no image", and the
reduced-motion degradation.

**So this is the standard's own situation rather than an obstacle to it.** *"I don't want a
single line deviating from the prototype unless it is expounded upon in detail."* The
request deviates, knowingly or not, and what it needs is the expounding — which is the
owner's to accept or refuse, not mine to assume either way. The case for departing, stated
so it can be argued with:

- The pack's slot is an EDITOR's control — you are picking a portrait and watching it swap,
  and on the first fill there is nothing to hide, so a spinner over an empty box adds noise
  to a state that is already legible.
- A cover on a work page is not that. There the empty placeholder is indistinguishable from
  *this work has no cover*, which is a real and common state in this library — so the reader
  cannot tell "coming" from "there isn't one", which is precisely the distinction the
  owner's sentence is drawing and the pack's `.ph` rule insists on elsewhere.

If the owner accepts that, the departure is one sentence in `docs/PLAN.md` and the loader is
the pack's, with its trigger widened to a first fill. If they do not, the pack's behaviour
is already correct and there is nothing to build for the image half at all.

The pack also rules on the loader's DRAWING, and this part is not in dispute: the `.ph`
hatch and the silhouette mean **missing content**, and `CLAUDE-from-design.md` says they are
not interchangeable with anything else — so *we never had a picture* and *your picture is
coming* must stay two pictures.

## WHAT ACTUALLY CONSTRAINS THIS

Four things, all found in the tree rather than assumed.

| Constraint | Where | What it forces |
|---|---|---|
| Every animation is killed with `!important` | `index.css`, in `@layer base`, and important declarations reverse layer order so it beats anything added later | A CSS-animated spinner is a **motionless arc** for a reduced-motion reader. **The pack already answered this** — `imageslot.js` makes the ring two-tone so the static state still reads as working — and the app's own `.progress-indeterminate` degrades to a static bar at 55% opacity. Either way the loader's rest state must be legible with motion off, and motion is the flourish. `entrance-rule.test.jsx` would NOT catch a failure here — it mounts one `.reveal` div — so the enforcement has to be widened in the same change or the rule ships as a comment. |
| Signing out does not reload the document | `App.jsx`'s Log out is `setUser(null)` | Any cache is keyed by reader and enrolled with `registerSessionCache`. **Already built** — `sessionCaches.js`, after `GET /search/vocabulary` was found being kept for the whole tab with nothing clearing it. |
| Waiting is already spelled about seven ways | `.tp-empty` does double duty as *empty* and *loading* at five sites; two independent progress bars; a bare `…` in `stickers.jsx` | An eighth spelling is the rule's failure mode, not its exception. One component and one hook, exported from `ui.jsx`, used by every screen and every image site — the loading verb lives in one function the way `openCharacterDoor` does. `screen-audit.md`'s open theme #2 is this exact observation, so it gets answered rather than added to. |
| Never truncate a name | `CLAUDE.md`, with the remaining sites in `typescale-baseline.json`, "a number that may fall and never rise" | A skeleton row reserves **height only**, never a name's width — a fixed-width slot for a name it does not have yet is the site that will ellipsise that name when it arrives, and it would raise a ratchet that is only allowed to fall. A bare bar or dot holds no text, so the px rule does not bind it; a caption or a text-shaped skeleton line does, and then it is `max(<px floor>, <em>)` and verified with `make typescale`. |

## WHAT NOBODY HAS MEASURED

These are not caveats; two of them decide the shape, and neither has a number.

1. **The threshold.** `PLAN.md` timed the server in-process — `GET /books` at 0.75 ms, `GET /annotations` at 5.8 ms — and concluded the server was never the wait. Nobody has timed a round trip from the owner's phone over the transport the complaint came from. Without one number there is no defensible answer to *how long may a wait go unannounced*, and a loader that appears at 0 ms is a flash on every fast load. The pack's only nearby numbers are a 400 ms tooltip delay and a 200 ms search debounce, both chosen for other reasons.
2. **What expresses intent on a touch device.** Every defect in this repo comes from the owner's phone, where there is no hover. `pointerdown` gives an 80–150 ms head start for free and costs nothing speculative; a row entering a moving viewport costs one request per row scrolled past. This is the hinge, and it is the thing to measure first.
3. **Whether "cheap" is true.** The premise is right in principle — these payloads are JSON of a few KB against covers of hundreds. Nobody has measured the BYTES of a detail payload for a real work, and a 1,500-highlight book is the case that matters. `PLAN.md` records that payload, not query time, is what decides whether the mobile client feels instant; the same arithmetic has never been done for a prefetch.
4. **Whether "a page not yet fetched" is a state the app can see.** Server data lives in per-component `useState` with no shared store; the five contexts all carry form or navigation plumbing. A shell-level loader has to know a child's fetch is in flight and there is no channel for that. The plumbing is probably larger than the loader.
5. **iOS Safari, for either half.** Unmeasured here, and it is the device every report comes from.

## THE ORDER TO BUILD IN

**1. Stop the door blocking its own first paint.** **BUILT** — see `docs/PLAN.md`, *"No
prefetch, and a door that draws before its own count answers"*. `openCharacterDoor` awaited
`GET /characters/{id}` before drawing anything, with no timeout — the count decides whether
the global row appears, so a hung socket means a press that draws nothing at all. This is the
"chore" the owner felt, amplified by a slow link rather than caused by it. Needs no cache and
no prefetch.

**AND THE BUILD FOUND A SPLIT THIS STEP DOES NOT NAME.** "Stop blocking" is two cases, not
one. Where the press already has two live rows — the character's own and a linked performer's
— the answer is a chooser whatever the count says, so the panel opens at once and the row
merges in late. Where the performer is absent or unlinked, the count decides between OPENING
the character and ASKING between two, which are different presses; that path cannot be drawn
before the answer and is bounded rather than unblocked. A plan that had said only "draw
first" would have produced a chooser with one row, which this door deliberately avoids.

**AND THE LATE ROW HAS TO LAND IN THE MIDDLE.** The owner's order is "the work-character,
global-character ... or the people", so appending — the obvious thing once the panel is
already drawn — puts the identity after the performer. `choosePanel` merges by key order.

**2 IS RULED OUT, NOT DEFERRED.** The owner's answer to the gesture question was *"Neither —
just unblock the door"*. Step 2 below is kept for its FINDING, which outlives the decision:
"the reader's own data from their own server" is not a sufficient test for what may be
prefetched, because this codebase has a GET that writes.

**2. `pointerdown` prefetch — and NOT on the character chip, which is the endpoint the
first draft of this file recommended.**

`GET /characters/{id}` **writes.** `identity_handlers.go` → `fillLineFaces` →
`loadCharacterImages` → `adoptQuoteCharacters`, which opens a transaction and runs
`INSERT INTO work_cast` for up to `adoptWorkCap` (12) works per read — adopting characters
that a work's own quotes name but its cast list does not. That is deliberate and useful on a
deliberate press. **On a `pointerdown` it means a finger resting on a chip creates rows.**

So the recommendation is narrower than it was: prefetch only a request proven to be a pure
read, and the way to know is to have looked rather than to have assumed a GET is one. Two
routes forward, and the first is cheaper:

- **Prefetch nothing; stop the door blocking instead.** Step 1 already removes the wait the
  owner actually felt, and it needs no new request at all.
- **Or give the panel a read-only door** — the adoption moved to where a reader asks for it
  — and prefetch that. That is a server change and a decision about when adoption should
  happen, which is larger than the complaint that prompted it.

The general lesson for the boundary sentence above: *"the reader's own data from their own
server"* is not sufficient. It has to be **a read that is only a read**, and this codebase
has at least one GET that is not.

**3. The image loader.** **BUILT.** Needs no ruling. Reserve the box first (an unreserved loader causes
the layout shift it was meant to soften — and it is the same box question as the owner's
earlier "how do we tackle images that are not 2:3"), delay ~150 ms before showing, hold ~300 ms
once shown so it cannot strobe on a fast local network, and degrade to a static mark with
motion off.

**AND FOUR THINGS THIS STEP ASSUMED THAT ARE NOT SO.** (a) The box is ALREADY reserved
nearly everywhere — a width plus an `aspect-ratio` fully determines a box, and the face
classes carry a width and a height. (b) There is no loading mark to reuse: `.ph` stands in
for ABSENT artwork and says so in words, and `Sprockets` is the film skin's sprocket holes.
(c) "Degrade to a static mark with motion off" needs no code — the global
`prefers-reduced-motion` rule kills every animation with `!important`, so an animated
gradient freezes into a still tint by itself. (d) The step does not mention `loading`, and
it decides everything: `Cover` sets no attribute so every cover is eager and a mark is
honest, while `Face` is lazy by default and a mark on an unrequested off-screen picture
describes a wait nobody is having.

**4. The page loader** — and the loader half ALREADY EXISTS. Both identity panels draw
`common.state.loading` while their record is in flight (`identity.jsx`), and fifteen other
surfaces use the same string. So what remains here is not a loader: it is the CACHE that
"back cancels the opening, not the fetch" requires, because without one a fetch left to
settle settles into nothing. Last, because the plumbing is the work and the loader is the
garnish. "Back cancels the opening, not the fetch" is the right instinct and cheap:
don't abort, let it settle into the cache. It needs a bound so a hung socket cannot leak
(`api.js`'s `timeoutMs` exists for exactly that case), a cap on concurrent fills, and
invalidation on write — which is the riskiest part of the whole request, because the panel
payloads do not map onto the GETs they stale by URL prefix. `GET /characters/{id}` is
assembled across **nine** tables — `characters` and `character_alias`, `work_cast`,
`annotations` and `dialogues`, `books`/`movies`/`people` through the cast join and
`CharacterLines`, and `users` through `creditSeps` → `loadPrefs` — so `PUT /cast/{id}` and `PUT /annotations/{id}` both stale it while
sharing no path segment with it. A prefix-invalidating cache misses precisely the writes
readers make most.

**How many writes that is, with the command rather than a number.** An earlier draft of this
file said "72 mutating calls" with no method, in a section headed *found in the tree rather
than assumed*, which is the same fault as the rest of this page. The reproducible figures:

```bash
# every mutating request the SPA makes
grep -rhoE "json\('(POST|PUT|PATCH|DELETE)'" web/frontend/src | wc -l          # 163
# every mutating route the server registers
grep -rhoE '"(POST|PUT|PATCH|DELETE) /' internal/httpapi/server.go | wc -l      # 151
```

Which of those touch a panel's payload is the table the cache needs and nobody has built;
that is the work, and it is why step 4 is last.

## WHAT IS STILL THE OWNER'S

Only the boundary sentence above, and only because it should be written down rather than
because anything is blocked. Everything else here is a measurement or a build order.

## NOT ON THE ROADMAP, AND DELIBERATELY

`CLAUDE.md`'s plan-queue rule is that a plan with no roadmap entry gets one. **This one does
not, and the same rule says why: "Adding a plan to the roadmap is publishing a promise on a
public page, so a sweep that is unsure says so rather than inventing a card."** This file is
a discussion with a build order, not a committed feature — its first two steps need nothing
from anybody and its last two wait on measurements that have not been taken. A card reading
"prefetch and loaders" on a public page would promise the whole of it.

**And it is on the directory's own not-a-plan list rather than only argued here**, which is
the half a first draft of this note missed. `docs/plans/README.md` has a table for exactly
this — its preamble says the files on it are "named here rather than judged again each
night — a sweep that re-decides the same exclusions nightly will eventually decide one of
them differently" — and "a file that belongs on this list is added to it in the same change
that adds the file". Arguing the exclusion in this file alone would have left the sweep
finding it unlisted and raising it every run, which is the failure that table exists to
prevent.

The exclusion lifts when the boundary sentence above is in `docs/PLAN.md`. At that point the
sentence is the promise and the card can name it.
