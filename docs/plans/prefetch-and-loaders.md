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

Nothing. `docs/design/` was swept for *loading, spinner, skeleton, shimmer, placeholder,
prefetch, instant, wait, progress, pending* and has no rule about how the app behaves while
it waits for data or an image. That is the answer rather than a gap in the search: the
owner's standard is "not a single line deviating from the prototype unless it is expounded
upon in detail", and a screen the pack does not draw is a screen this file has to argue for
rather than inherit.

The pack does rule on one adjacent thing, and it constrains the loader's DRAWING: the `.ph`
hatch and the silhouette mean **missing content**, and `CLAUDE-from-design.md` says they are
not interchangeable with anything else. So *we never had a picture* and *your picture is
coming* must not end up as one picture — which is the same distinction the owner drew
unprompted with "no loader if there is no image".

## WHAT ACTUALLY CONSTRAINS THIS

Four things, all found in the tree rather than assumed.

| Constraint | Where | What it forces |
|---|---|---|
| Every animation is killed with `!important` | `index.css`, in `@layer base`, and important declarations reverse layer order so it beats anything added later | A CSS-animated spinner is a **motionless arc** for a reduced-motion reader. Copy `.progress-indeterminate`, which already degrades to a static bar at 55% opacity: the loader's rest state must be legible with motion off, and motion is the flourish on top. `entrance-rule.test.jsx` would NOT catch this — it mounts one `.reveal` div — so the enforcement has to be widened in the same change or the rule ships as a comment. |
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

**1. Stop the door blocking its own first paint.** `openCharacterDoor` awaits
`GET /characters/{id}` before drawing anything, with no timeout — the count decides whether
the global row appears, so a hung socket means a press that draws nothing at all. This is the
"chore" the owner felt, amplified by a slow link rather than caused by it. Needs no cache and
no prefetch.

**2. `pointerdown` prefetch on the character chip.** The smallest thing that attacks the
same complaint: the request is merely already in flight, never stored, so it needs neither an
invalidation table nor user-keying. Measure (2) above while doing it.

**3. The image loader.** Needs no ruling. Reserve the box first (an unreserved loader causes
the layout shift it was meant to soften — and it is the same box question as the owner's
earlier "how do we tackle images that are not 2:3"), delay ~150 ms before showing, hold ~300 ms
once shown so it cannot strobe on a fast local network, and degrade to a static mark with
motion off.

**4. The page loader**, last, because (4) above says the plumbing is the work and the loader
is the garnish. "Back cancels the opening, not the fetch" is the right instinct and cheap:
don't abort, let it settle into the cache. It needs a bound so a hung socket cannot leak
(`api.js`'s `timeoutMs` exists for exactly that case), a cap on concurrent fills, and
invalidation on write — which is the riskiest part of the whole request, because 72 mutating
calls touch the records these panels show and they do not map onto the GETs they stale by URL
prefix: `GET /characters/{id}` is assembled across `characters`, `work_cast`, `annotations`
and `dialogues`, so `PUT /cast/{id}` and `PUT /annotations/{id}` both stale it while sharing
no path segment with it. A prefix-invalidating cache misses precisely the writes readers make
most.

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

So the roadmap sweep should leave this alone until the boundary sentence above is in
`docs/PLAN.md`. At that point the sentence is the promise and the card can name it.
