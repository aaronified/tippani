# The system as the repo actually defines it

Extracted from `docs/ui-glossary.html` (which inlines the *built* stylesheet, so these
are the shipped values), plus `theme.js`, `fonts.js`, `routes.js`, `ui.jsx`, `help.jsx`.
Everything below overrides my earlier guesses.

## Where I was wrong

| I did | The repo does |
| --- | --- |
| Buttons as 99px pills | `.tp-btn` — **radius 9px**, min-height 44px, 1.4px border, 9px/18px padding, 14.5px, gap 8px |
| Cards at uniform 20px radius | `.hand-card` — **asymmetric hand-drawn radius**, 4 variants, 1.6px `--ink-border` |
| Pale tinted category chips | `.tag-chip` — mono 11.5px/500, padding 3px 10px, background **is** the category colour, text `#221c16` |
| Invented dark greys | `theme.js` palettes: paper-dark `soft #B3A48C`, `faint #9A8C74`, `line #453B2D` |
| One layout reflowing | Desktop `.topbar` is replaced **wholesale** by `.mobile-bottom-nav` at ≤768px — two shells |
| Play triangle for Catalogue | `IconReel` — circle, hub, four satellite holes |
| One `mark.svg` | `mark.svg` #B4482D / `mark-dark.svg` #D8613D |
| Hover-only shortcut hints | README: shortcuts are **printed on the buttons that share their job** |

## Tokens (theme.js — verbatim)

Single skin, two modes. Accents: terracotta `#B4482D`, ochre `#C8992B`, olive `#3F7D5A`, slate `#2F6D8F`.
`--accent-dark` = `color-mix(in oklab, accent, white 20%)`; `--accent-ui` = dark ? that : accent.

**paper-light** bg `#F4EDDE` · raised `#FBF6EA` · card `#FFFEF9` · card-top `#FFFFFC` · card-bottom `#FCF8ED` ·
topbar `#F3EBDB`→`#EDE3D1` · ink `#221C16` · soft `#6A5F50` · faint `#8A7C68` · line `#E4DAC7` ·
ink-border `rgba(41,38,29,.6)` · amber `#BE8A4E` · error `#A93B26` · ok `#3E8E5A` · strip `#E9E1CC`

**paper-dark** bg `#262019` · raised `#2A231C` · card `#2F2820` · card-top `#352D23` · card-bottom `#2C251E` ·
topbar `#2B241C`→`#241E17` · ink `#EFE6D4` · soft `#B3A48C` · faint `#9A8C74` · line `#453B2D` ·
ink-border `rgba(239,230,212,.4)` · amber `#D6A25C` · error `#C96B5B` · ok `#5FB47E`

Categories (append-only tokens, never reorder): `yellow blue pink orange green purple`
→ `#E5C355 #7FA6C9 #D98CA6 #DF9A5B #7CB342 #8A7BC8`. Slot 1 is *the default, not a category* —
it cannot be named or hidden.

## Ink — which shade each thing wears

The palette above says what the colours *are*; this says what they are *for*. It is
written down because it was the one thing the tokens did not settle, and the drift
showed: the dock's glyphs sat at `--ink` while the tabs beside them sat at `--soft`,
so one bar carried two blacks.

**A GLYPH AT REST IS `--soft`, EVERYWHERE.** `.mobile-topbar-btn` and
`.mobile-bottom-nav-btn` both do this, and both go to `--ink` on hover or press.
`--ink` at rest belongs to **text**, not to icons. Anything that breaks the rule —
a card's tool row at `--faint`, a dock key at `--ink` — reads as a second black.

| Role | Token | light | dark |
| --- | --- | --- | --- |
| Body, a person's name, a row label, a work title | `--ink` | `#221C16` | `#EFE6D4` |
| **Every glyph at rest**; a chip's label; secondary prose | `--soft` | `#6A5F50` | `#B3A48C` |
| `.mono-label`, a locator, a drawer badge, a role line | `--faint` | `#8A7C68` | `#9A8C74` |
| A glyph hovered or pressed | `--ink` | — | — |
| A chapter heading, a link, a MORE, the ＋ Add row | `--accent-ui` | accent | accent + white 20% |
| Anything on a lit row, key, tab or chip | `--on-accent` | `#FBF6EA` | `#1A1510` |
| A tag's label | literal `#221c16` **in both modes** — the pill *is* a light category colour | | |
| A shelf bar | its `SHELF_META` colour, never the accent | | |
| A destructive verb, its rule and its tag | `--error` | `#A93B26` | `#C96B5B` |
| A confirmation tick | `--ok` | `#3E8E5A` | `#5FB47E` |

Hover and press are *derived*, never typed: `color-mix(in oklab, var(--ink), transparent 90%)`
and `… 82%` for a neutral control, `color-mix(in oklab, var(--accent-ui), white 8%)` /
`… black 10%` for an accent one. Each control exposes its own `--rh` / `--ra` / `--rc`,
so one hover rule in the markup serves rows that do not share a colour.

## Type — which face each thing wears

Four roles, one face per script inside each (`bengali` and `devanagari` are retired: a
role is a job, and each job names one face per script). Stacks put the Indic face
**after** the Latin one so no codepoint crosses over. 18 families ship bundled
(`@fontsource`, all OFL-1.1) — the app makes no network request the reader did not ask
for, so a font CDN is not an option in production. Modifier companions per role:
`-weight -style -caps -case -figures`, off value `inherit`.

| Role | Faces | Where it lands |
| --- | --- | --- |
| `display` | Newsreader · Literata · Source Serif 4 — `--font-display`, declared even where one serif fills both it and `quote`: a role with no token silently inherits the UI sans | `.display-title` 600 / `-.01em`; a work title 23px/1.15; the wordmark 19px / `-.02em` |
| `quote` | Literata · Newsreader · Source Serif 4 | the reader's own text — 16.5px/1.5 at `--ink`; a description 14–15px/1.5–1.68 |
| `ui` | **Atkinson Hyperlegible Next** (default) · Hanken Grotesk · Public Sans | a row label 14.5/600; a name 13.5/600; prose 13.5/1.6; a sub 12.5/1.45 |
| `mono` | IBM Plex Mono | `.mono-label` 11px/500 `.14em` uppercase `--faint`; a badge 10px `.1em`; a role line 9px; a tag 11.5px/500 |
| `hand` | Caveat · Atma | the margin note only, `rotate(-.6deg)` |

Sizes are px because they are the *setting*; every box that holds text is measured in
`em`/`ch` so a reader turning the type up reflows nothing.

## The bottom bar is always contextual

**The dock holds what the screen in front of you can DO, and nothing else — on every
screen, with no second face and no permanent member.** It is the strip a thumb reaches
without moving, which is the most expensive real estate in the app, and it may not be
spent on anything a reader is not doing right now.

**The five destinations were evicted for exactly this.** A destination is nav, and nav
belongs in the one surface that lists all of it — the ☰ drawer. A switcher face turned
the most reachable strip on the phone into a decision made once an hour, sitting on top
of the four things being done constantly.

**Back is contextual too, and that is the distinction the bar turns on.** It is not a
fixture: a list screen has nowhere to go up to and shows no back key, while a screen
you are *inside* offers one, exactly as a screen with a stream offers a filter. A book
is inside the library, so a work page carries it.

**Back is not a verb, so it does not stand in the row of verbs.** It sits before a
1px `--line` hairline, 24px tall — back leaves, the keys after it act, and grouping
them would make "go" and "do" one row. The hairline is the boundary rather than a
second colour, because every glyph in a bar is one ink (see *Ink*).

So a work page shows ← │ filter · ＋ · practise · ⋯, and the next screen's set is
different. The test is not "is this useful everywhere" — that is the shell bar's test,
at the top of the screen. It is "does THIS screen offer it".

## Entrances — a rest state may not depend on anything firing

A panel's resting appearance must be a **style**, never frame 0 of a timeline. Two
shapes fail this and both shipped here before being caught: a `@keyframes` entrance
(hidden state in the `from` frame, `fill-mode: none`) and a `requestAnimationFrame`
flip of a mounted flag. A hidden document runs **no** animation frames, so either one
leaves the drawer 296px off the side of the phone and the ☰ reading as a dead button.

So: **keep the element mounted and drive it from its own state.** Open is a style,
closed is a style, and the transition is only what happens in between — if it never
runs, the thing you tapped is simply there. `visibility` goes with the opacity, so a
closed panel is out of the tab order and out of the accessibility tree too.

**The test:** disable every animation and transition on the page, then tap the control.
If what you tapped is not visible, the entrance is holding the rest state hostage.

## Components (built CSS)

- `.hand-card` — `border-radius:15px 9px 14px 10px/9px 15px 10px 14px`; variants `.hc-r1/r2/r3`
  rotate that figure. `border:1.6px solid var(--ink-border)`, `box-shadow:var(--lift), inset 0 1px #ffffffbf, inset 0 -1px #29261d0d`,
  background a vertical gradient of `--card` mixed ±(white 6% / black 4%).
- `.tp-btn` — `min-height:44px; border-radius:9px; border:1.4px solid transparent; padding:9px 18px; font-size:14.5px; gap:8px`.
  `.tp-btn-ghost` adds `border-color:var(--ink-border)` + `linear-gradient(180deg,var(--card-top),transparent)`.
- `.tp-chip` — mono, `color:var(--soft)`, `background:var(--raised)`, `1px solid var(--line)`,
  `border-radius:999px`, min-height 40px, padding 6px 12px. **Chips are the pills, buttons are not.**
- `.tp-toggle` — `background:var(--card)`, `1.4px solid var(--line)`, `border-radius:11px`, padding 4px,
  `inset 0 2px 4px #29261d24, inset 0 -1px #ffffff80`; thumb radius 8px filled `--accent`, draggable.
- `.tag-chip` — `--tc:var(--hl-N)`, mono 11.5px/500, padding 3px 10px, text `#221c16`.
- `.mono-label` — mono, `letter-spacing:.14em`, uppercase, `var(--faint)`, 11px/500.
- `.display-title` — `var(--font-display)`, weight 600, `letter-spacing:-.01em`, `var(--ink)`.
- `.page-header` — flex, wrap, `justify-content:space-between`, `align-items:baseline`, gap 16, margin `26px 0 18px`; `.ph-left` holds h1 + `.mono-label`.
- `.mobile-sheet` — fixed full-viewport, `background:var(--bg)`; header has close · title · spacer.
- `.mobile-topbar` — sticky, min-height 52, `padding-top:max(4px, safe-area)`, the topbar gradient,
  1px `--line` bottom, wood/metal `::before`. Holds **☰ · brand → Home · ＋ · Search · `.user-chip`**.
  `.mobile-topbar-btn` is 44×44, no fill, `--soft` → `--ink` on hover.
- `.user-chip` — a **squircle**, `border-radius:32%` (22% in film), 38px, 1.4px `--ink-border`,
  the accent gradient, `--on-accent` initial at 15px/600. Clips an uploaded avatar. One tap → Profile.
- `.drawer` — fixed left, `width:290px; max-width:82%`, the topbar gradient + shell texture,
  `box-shadow:8px 0 30px -8px #0006`, in on `translateX(-102%)` over .28s. Header (mark + wordmark +
  tagline) · `.drawer-add` · `.drawer-item` rows (46px, 9px radius, gap 11, 14.5/600 `--ink`) ·
  `.drawer-divider` · footer (chip + name + role + Log out) · version → changelog.
  `.drawer-item.active` wears the accent fill **with the selection material over it**.
- `.mobile-bottom-nav` — floating, 62px, the topbar gradient reversed; `.mobile-bottom-nav-btn`
  is 56×48 at `--soft`, `--ink` on hover, and `.active` carries three cues (fill, pill, dot).
- Marks are hand-inked and deliberately tilted (`randWobble`); `PlayfulButton` fires a random
  micro-animation on click. Shelf is a bar drawn **under** the cover, never over it.

## Nav contract (routes.js)

- `CONTENT_TABS` home · library · movies · quotes · anthologies
- `UTILITY_TABS` tags · metadata · stats · settings
- `DRAWER_TABS` search · home · library · movies · quotes · anthologies · — · tags · metadata · stats · settings
- `BOTTOM_TABS` home · library · movies · quotes · anthologies
- `bin` is a route, deliberately **not** a nav tab.

## Help (help.jsx)

Already contextual: 167 rows, one per control, sectioned per screen, opened at your screen, with a rail
of all screens and the shell's controls appended — `SHELL_TOUCH` for phones, `SHELL_POINTER` for pointers.
**The IA does not need redesigning; only its visual treatment does.**
`book-detail` documents: details · counts · hearts · state-chip · add-annotation · colour-category ·
copy · share · export · more-menu. `movie-detail` adds studio · publisher · voice-cast · cast.
Phone work pages put help in the `⋯` because the bar already holds back · filter · ＋ · ⋯.

## Constraints to honour

- `prefers-contrast: more` / `prefers-reduced-transparency: reduce` drop **every** texture and move nothing else.
- 44px touch targets; no horizontal scrolling on phone.
- Icon set is test-guarded: every exported glyph is compared with every other, exactly and with
  coordinates stripped — a near-duplicate fails CI. Use `ui.jsx` glyphs, never a lookalike.
- Textures are CC0 grayscale tiles blended behind content; six ship (paper, wood, metal, glass, fabric, rubber).
- Stickers: quote text reflows around a pinned seal via `pretext` (`FlowQuote`).

## Overflow — the edge-fade rule (design principle, carry into the code)

1. **An edge fade means the row scrolls.** `edgeMask` fades the last 26px to
   transparent. That is the entire signal — no arrows, no scrollbar, no counter.
2. **A button at the fade opens the full set in a popup.** It is not part of the
   scroll; it opens a sheet holding everything, including what is already visible.

A row may scroll, or open, or both, and the reader can tell which without trying.

**Never collapse a list to fit.** If it does not fit it scrolls under the fade; if
scrolling would be a chore it also gets the button. Truncating a name or dropping a
credit for want of width is not an option.

**The button is a control, not a member of the row** — `.tp-btn`'s 9px corner and
44px floor, so it cannot read as another pill. Round = a person or a value;
9px = something that acts.

**A COUNT IS NOT AN AFFORDANCE WHEN THE ROW SCROLLS.** The button earns its place
only when it opens something the swipe cannot reach — another KIND of thing (the
credit row's `+3 more` holds translators and editors, not more authors). A "+2"
beside a scrolling row of speakers answers a question the fade has already answered,
and implies two are being withheld when the row in fact holds them all.

Applies to: the credit row, the genre row, the tag row on a quote card, the
category picker, and any future row that can outrun its width.

---

## Touch as a setting — a build instruction, not a design in this file

**Not yet designed here.** There is no settings screen in these prototypes, so this
section is the spec to hand to Claude Code, not something to read off a mockup.

### The setting

`touch: boolean`, user-facing, **default true**, in Settings under Input. Persisted
per device, not per account — the same account meets a laptop and a tablet, and a
preference about fingers belongs to the thing being touched.

**It is a setting because it cannot be a measurement.** `@media (pointer: coarse)`
and `(hover: hover)` both answer wrongly on the machines that matter most: a
touchscreen laptop reports coarse and hovers fine, an iPad with a trackpad attached
reports either depending on the moment, and a desktop with a drawing tablet reports
coarse while never once being touched. Sniffing produces a UI that changes shape
when a mouse is plugged in. Ask, default to the safer answer, and let the reader
correct it.

**Default true is not a coin toss.** A 44px target costs a mouse nothing but a
little space; a 32px target costs a fingertip the tap. The failure modes are not
symmetrical, so the default protects the expensive one.

### What it may change

**Clutter and density. Never capability, never layout.**

- **A tool may go quiet, never absent.** With `touch: false`, per-item tools
  (a card's favourite · share · colour · ⋯) render at `opacity: 0` and surface on
  `:hover` of the card or `:focus-within`. They keep their box, so the row does
  **not** reflow when they appear — a page of twelve quotes stops being a page of
  forty-eight glyphs, and nothing moves under the pointer.
- **Focus reveals what hover reveals.** A keyboard has no pointer. Any hover-gated
  control must also appear on `:focus-within`, or it is unreachable without a mouse.
- **Hit targets may tighten to 36px** on controls that are not the primary action
  of their row. 44px stays the floor for anything destructive, anything in a bar,
  and anything on a card face.
- **Shortcut legends print only when `touch: false`** — a mono chip inside the
  button, space reserved either way so toggling the setting never reflows a toolbar.

### What it may never change

- **Which actions exist.** No verb appears in one setting and not the other. If a
  thing can be done with a mouse it can be done with a thumb, by the same route.
- **Where anything lives.** No control moves between a bar, a menu and a card face.
  A reader who learns the app with touch on must not have to relearn it.
- **The long press.** Hold-to-copy on a card is the commonest gesture in the app and
  is not conditional. It stays with `touch: false` too, because a touchscreen laptop
  set to `false` is still a touchscreen.
- **Selection.** Entering it, the pick boxes, and the SelectionBar are identical in
  both settings. Selection is already a mode; a mode that also changes shape by
  setting is two variables where the screen can only afford one.

### The test

Toggle the setting on a page of twelve quotes. Nothing may move by a pixel; the only
difference is what is inked. Then tab through the page with `touch: false` — every
control the pointer can reach must come into view under focus.
