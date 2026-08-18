# Help and density — roadmap §5

**Status:** designed, not built. Redesigned 2026-08-18 after the owner read the
help panel and said the copy was "way too much fluff and there is no formatting to
guide the users to what is most important".

Roadmap section [`#help-density`](../roadmap.html#help-density), issue #23.

The section's own argument still holds — one registry, four consumers, nothing
holding them together — but it was the *second* problem. The first is that the
registry's copy cannot be read. **157 entries, 49,738 characters, about 8,000
words.** The median entry is 233 characters, which is fine; the tail is not: 40
entries over 400, 8 over 800, and the worst is 1,911 characters and fifteen
sentences. Worse, the longest entries are the SHELL ones, which `helpFor` appends
to every screen — so the copy a reader sees most often is the copy that reads
least.

And `what` is a single string, so there is nothing to format: no lead, no bullets,
no emphasis, no asset. **The shape is what prevents the hierarchy**, which is why
the format change now leads and the consolidation follows it.

---

## What already exists

Verified against `fb0271f`; still true at `42635f6`.

| Piece | Where | State |
| :-- | :-- | :-- |
| The registry | `web/frontend/src/help.jsx` | **Built**, keyed by screen. |
| Screens reading it | `ScreenHelpSheet`, `PageHelp` | **Built** — four call sites, not one. |
| The completeness test | `web/frontend/test/pure/help.test.jsx` | **Partly built.** |
| Info dots | `InfoDot text="…"` at ~15 call sites, 10 in Settings | **Not** reading the registry. |
| The glossary | `docs/ui-glossary.html`, 540 KB, hand-maintained | **Not** generated. |
| The tour | `tour.jsx` `TOUR_STEPS` | **Not** reading the registry. |
| Deep links (`?help=key`) | — | **Missing**, and the routing does not support it. |
| Live component samples | `docs/ui-glossary.html` | **Built, and the precedent this borrows**: real `.tp-input`, real colour dots, rendered inline rather than screenshotted. |

Two claims from the roadmap did not survive verification and are unchanged by the
redesign:

1. **"the help panel is the only thing that reads it"** — four components do.
2. **"deep links, which the URL routing already supports"** is false. `routes.js`
   parses a pathname and `App.jsx` pushes a path; there is no `URLSearchParams` in
   the shell. Deep links are the first user of query-string state.

---

## The shape

Decided with the owner, 2026-08-18. Four answers, and each one closed off work as
well as opening it.

### 1. The entry gains structure

```js
{ term, key, icon,
  what: 'one front-loaded sentence',        // always visible, capped
  how:  ['verb-first line', 'verb-first line'],   // ≤3, capped
  more: 'the reasoning, the caveats',       // collapsed behind "more"
  asset: <LiveControl/> | <Diagram/> | <Gesture kind="long-press"/> | <Shot src/>,
}
```

`what` and `how` are the visible part and carry a hard budget enforced by a test,
so the tail cannot grow back. **`more` is collapsed, not deleted** — the reasoning
this project writes down stays reachable for the reader who wants it and out of the
way of the reader who does not.

Front-loading is the one research finding that decides the copy: users scan rather
than read, and the F-pattern NN/g documented is a *warning* about that, not a
layout to aim at. So the first phrase of every entry is the answer.

**The reader is not a beginner.** Copy says what a control does in Tippani, in the
fewest specific words; it never explains how to operate a touch screen or a mouse.
"Long press → the card's menu" and not "press and hold your finger for half a
second to open a menu".

### 2. Four kinds of asset, in order of preference

| Kind | When | Why it is first choice or last |
| :-- | :-- | :-- |
| **Live-rendered control** | Anything the app can mount: the ＋, the swatches, the selection bar | **Cannot go stale — it IS the app.** No binary, correct in both themes for free. `ui-glossary.html` proves the pattern. |
| **Inline SVG diagram** | Flows a screenshot cannot show: import → queue → library, where a quote comes from | Schematic, so a restyle cannot invalidate it. Theme-aware via `currentColor`, ~1 KB, diffable. |
| **Gesture clip (animated SVG)** | The two gestures the app has | Abstract — a finger and a trail, not a screenshot — so it **never goes stale and is reusable in any context**. Inline SVG rather than `.gif` because it is 1–2 KB, theme-aware, diffable, and honours `prefers-reduced-motion` in the file, which a playing GIF cannot do at all. |
| **Cropped screenshot** | Last resort: when the answer is about *position or layout*, or as the backdrop for SVG arrows pointing at buttons | **Kept to a minimum and cropped to just the part being discussed.** Real pixels are the one asset class that silently shows last year's interface, which `AI.md` names as this repo's worst failure mode. |

**The gesture library is all eleven clips, and only two are referenced.** Long
press and swipe-left are what `App.jsx` and `ui.jsx` actually implement — there is
no pinch handler anywhere, and swipe-to-open is deliberately absent because the
left screen edge belongs to the OS back gesture. The other nine exist as data for
when a gesture arrives; a test fails if the interface references one nothing is
bound to, which is the rule `keys.js` already enforces on the shortcut sheet after
five unbound keys were caught there before shipping.

### 3. The panel becomes navigable

The `?` sheet stays the only home — **no new route.** It grows:

- a **screen rail** down one side (a row of pills on a phone), listing the screens,
  opening on the one you pressed `?` from;
- **anchors**, so a topic is one click or one short scroll away;
- **pills and highlights** in the copy: key caps, control chips, field names,
  colour swatches — a small fixed vocabulary, not free-form markup.

The organisation stays **by screen**, deliberately. Re-filing 157 entries by task
was the alternative and it costs the sheet its contextual contract: `helpFor` knows
what screen you are on, and that is the one thing a help panel knows for free.

### 4. Then the consolidation, which the new shape makes cheap

`what` being one capped sentence is exactly what an info dot needs, so step 2 of
the original plan stops being a rewrite and becomes a lookup.

1. **Keys that are not screens** — `help(screen, key)`, the contract everything
   later depends on. The key reads as a control's name, never a position.
2. **The info dots read it** — `<InfoDot help="library.filters">`, `text` kept only
   for genuinely local copy. Settings is where this pays: ten dots on one screen,
   several restating panel copy in different words.
3. **The glossary is generated** — `scripts/glossary.mjs --check`, comparing the
   document against the **registry**, never against a previous generation of
   itself. `glossary-css.mjs` regenerated 140 KB of stylesheet *inside an HTML
   comment* for two releases and `--check` passed throughout, because the bytes it
   compared were the bytes it had written.
4. **The tour reads it** — `TOUR_STEPS` keeps its order, anchors and resume point;
   only its copy comes from the registry. The roadmap's strongest argument: the
   same change has already been made twice by hand.
5. **Deep links last** — `?help=<key>`, the first query-string state in the app,
   and worth least: it links to help, and the four steps above make help correct.

---

## Deliberately not built

**A full Help screen at its own route.** Considered and declined: help stops being
beside the control, which is the thing contextual help is for.

**A task rail** (Capturing / Organising / Reviewing). Declined for the reason in §3.

**Real `.gif` files.** Go's `image/gif` in the standard library would have made them
with no new dependency, and it was declined anyway: a GIF has a baked palette, so a
themed app needs two of every clip, and a playing GIF ignores reduced motion.

**Video of any kind**, and **gesture clips for the nine gestures the app ignores**
appearing in the interface. A reader who tries a gesture that does nothing is worse
off than one who was told nothing.

**A help search.** Fifteen screens is a document you read, not one you query, and
the app's search box already means something else.

**Merging the tour into the registry outright.** A tour is ordered and has a resume
point; a registry is a dictionary. Only the copy is shared.

---

## Verification

| Test | Asserts |
| :-- | :-- |
| `help-budget.test.js` | `what` is one sentence under its cap; each `how` line under its cap; at most three. The tail cannot grow back. |
| `help.test.jsx` (extend) | Every `InfoDot` in the source resolves to a registry key. Every registry entry is reachable — no orphan keys. |
| `gestures.test.jsx` | Every gesture the interface references is one the app implements, and every clip renders a static pose under `prefers-reduced-motion`. |
| `scripts/glossary.mjs --check` | The generated glossary matches the REGISTRY, not a previous generation of itself. |
| `tour` test | Every step's copy comes from the registry; no step carries its own string. |
| routing | `?help=key` survives a reload and the back button. |
