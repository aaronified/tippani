# Help and density — roadmap §5

**Status:** designed, not built.

Roadmap section [`#help-density`](../roadmap.html#help-density), issue #23. One
registry, four consumers: the help panel, the info dots, the UI glossary and the
tour each describe the same controls, and nothing holds them together.

Its own argument is the right one: **this is the kind of work that only ever gets
more expensive.** Every release adds controls, and each one is another place the
four copies can disagree.

---

## What already exists

Verified against `fb0271f`.

| Piece | Where | State |
| :-- | :-- | :-- |
| The registry | `web/frontend/src/help.jsx` | **Built**, keyed by screen. |
| Screens reading it | `ScreenHelpSheet` (Library, Catalogue…), `PageHelp` (App, AddSurface) | **Built** — four call sites, not one. |
| The completeness test | `web/frontend/test/pure/help.test.jsx` | **Partly built.** See below — the roadmap lists this as missing and it is half done. |
| Info dots | `InfoDot text="…"` inline at ~15 call sites, 10 in Settings alone | **Not** reading the registry. |
| The glossary | `docs/ui-glossary.html`, 540 KB, hand-maintained | **Not** generated. `scripts/glossary-css.mjs` syncs only its stylesheet. |
| The tour | `tour.jsx` `TOUR_STEPS` | **Not** reading the registry; carries its own copy. |
| Deep links (`?help=filters`) | — | **Missing**, and the routing does **not** already support it. |

### What the verification pass changed

**Two claims did not survive.**

1. **"the help panel is the only thing that reads it"** — four components read it
   (`ScreenHelpSheet`, `PageHelp`, and the two screens' own sheets). That is not a
   correction that changes the work, but it does change the framing: the registry
   is already a shared source for *panels*. What has never read it is anything
   that is not a panel.

2. **"Deep links — `/library?help=filters`, which the URL routing already
   supports"** is false. `routes.js` parses a **pathname** and `App.jsx` pushes a
   **path**; there is no `URLSearchParams` anywhere in the shell. This is the same
   discovery the retired quick-wins plan made about saved views, and it is the same
   underlying gap: **Tippani does not put screen state on the URL.** So deep links
   are not "the routing already supports it, add a key" — they are the first user
   of query-string state, and whoever builds them builds that.

**And one item is further along than the roadmap says.** The "completeness test,
the same shape as the one keeping `docs/troubleshoot.md` in lockstep with
`internal/olog/codes.go`" already exists in part: `help.test.jsx` asserts every
reachable screen has an entry, that a *labelled control is a documented control*
by reading the screens' own source for those labels, that an unknown key returns
null rather than a half-built panel, and that the shell list matches the shell you
actually have. What it does **not** assert is the half that this section would
create: that every info dot resolves to a registry key, because today none of them
do.

---

## The shape

The order matters, because three of the four consumers are cheap only *after* the
registry can answer their question.

### 1. Give the registry keys that are not screens

Today an entry is `{screen: [{term, what, icon}]}`. A dot needs to name one
control, so each entry gains a stable `key`, and the lookup becomes
`help(screen, key)`. Nothing else changes — the panel keeps rendering the whole
list in order.

**The key is the contract**, and it is what every later step depends on. It should
read as a control's name (`filters`, `review-covers`, `credit-separators`), not as
a position.

### 2. The info dots read it

`<InfoDot text="…">` becomes `<InfoDot help="library.filters">`, with `text` kept
for the handful of dots that genuinely explain something local. Then the panel and
the dot cannot disagree, because there is one string.

**This is the step that pays for the rest**, and Settings is where it pays most:
ten inline dots on one screen, several of which restate copy the panel already
carries in different words.

### 3. The glossary is generated

A `scripts/glossary.mjs` with a `--check` mode, rendered from the registry the way
`roadmap-data.mjs` renders the roadmap's own regions.

**And it must not be a gate that reads its own output.** `glossary-css.mjs` did
exactly that: it regenerated 140 KB of stylesheet *inside an HTML comment* for two
releases and `--check` passed throughout, because the bytes it compared were the
bytes it had written. So the check has to compare the generated document against
the REGISTRY, not against a previous generation of itself.

### 4. The tour reads it

`TOUR_STEPS` keeps its order, its anchors and its lifecycle (the tour is a
sequence with state; the registry is a dictionary). Its *copy* comes from the
registry by key. The roadmap's argument for this is the strongest one it makes:
**the same change has already had to be made twice by hand.**

### 5. Deep links, last

`?help=<key>` opens the screen's panel scrolled to that entry. It comes last
because it is the only step that needs the URL work above, and because it is worth
least: it is a way to *link* to help, and the other four steps are what make help
correct.

---

## Deliberately not built

**Merging the tour into the registry outright.** A tour is ordered, has anchors,
and has a resume point; a registry is a dictionary. Folding one into the other
would make both worse. Only the copy is shared.

**A help search.** Fifteen screens with a dozen entries each is a document you
read, not one you query, and the app already has a search box that means something
else.

---

## Verification

| Test | Asserts |
| :-- | :-- |
| `help.test.jsx` (extend) | Every `InfoDot` in the source resolves to a registry key — the half the existing test cannot yet make, and the one this section exists for. |
| same | Every registry entry is reachable: no orphan keys nobody renders. |
| `scripts/glossary.mjs --check` | The generated glossary matches the REGISTRY, not a previous generation of itself. Written as a case that fails when the registry changes and the document does not. |
| `tour` test | Every step's copy comes from the registry, and no step carries a string of its own. |
| routing | `?help=key` survives a reload and a back-button, which is the first thing on the URL and therefore the first chance to get it wrong. |
