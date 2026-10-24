# UI glossary

Source of truth: this wiki page.

What each part of the interface is called and what it does, so a conversation about it (or a bug report) can name the thing.
It is generated from the glossary catalogue, `web/frontend/scripts/glossary/catalogue.js`, by `npm run glossary`, and a test fails
when a component has no entry, so a rename or a new control updates this page or fails the build. Each entry names the file
that defines it.

218 entries in 22 sections.

## Shell

The frame around every logged-in screen (`App.jsx` · `Shell`): a sticky **topbar** on desktop, replaced wholesale by the fixed **bottom-nav** at ≤768px (see **Mobile shell** below).

### topbar

*Defined in:* .topbar / .topbar-inner — index.css · App.jsx Shell

Desktop shell bar, left→right: the **brand** (the 28px `/mark.svg` image mark — `/mark-dark.svg` when the theme resolves dark — sized to match the nav icons, + **wordmark**), the **nav-toggle** tab strip, then the four shell controls in a fixed order: **＋ Add · Search · ? · the avatar chip**. The first three read the current route — Add opens on a book on Library and on a quote against whatever work you have open, Search lands scoped to the list you came from, ? opens that screen's help — which is why they can be one control each instead of one per page. The phone bar carries the same four in the same order. Sticky on scroll. At ≤768px the topbar is `display:none` and `.mobile-topbar` takes over.

### nav-toggle

*Defined in:* .nav-toggle.tp-toggle — index.css · NavToggle — App.jsx

The primary nav *is* one **Toggle** — a thumb slides under the active tab. Its thumb is textured to stand apart from filter toggles: **wood** (paper) / **metal** (film), with the active label riding light. Primary tabs are Library · Catalogue · Search · Tags · Import; Metadata / Settings live in the user-chip menu. Tab icons are 28px; at ≤768px the `.tab-label` spans hide, leaving icon-only tabs. It renders twice — once in the topbar, once in the bottom-nav — with CSS showing only one at a time.

### user-chip

*Defined in:* .user-chip — index.css

Top-right account button — a **squircle** (rounded-corner square, `border-radius:32%`; more geometric in film), not a circle. Clips an uploaded avatar; otherwise shows the initial. It opens **Profile** directly. It opened a dropdown until 1.4.1 — Profile, User management, Log out — and the drawer repeated the same three rows, so "my account" was a menu of screens rather than a screen; all of it is a section of Profile now, and the chip is one tap.

### Profile · sections (was user-menu)

*Defined in:* Profile — Account.jsx · AccountOverlay — App.jsx · `.menu-item` — index.css

There is no account dropdown any more. The avatar chip opened one until 1.4.1 — a username header, avatar upload, Profile, User management, Log out — and the drawer carried the same rows again, which made the chip a menu standing between you and a screen whose parts the menu was listing. Everything is now a *section* of Profile, in the order you would ask it: photo and display name, then which account you are in (**switch account** — that account's password every time, being an admin does not let you in without one — and **log out**), then your password, then, for an admin, the user list and the recovery tools. **AccountOverlay** frames it: a centred pop-up on a pointer device, a full-screen page on a phone (which is the one screen still carrying its own "?", because it covers the shell bar). `.menu-item` survives, shared by **MoreMenu** and the date picker. (Rows shown here stand in for the sections.)

### NavIcon set (was TabIcon, 1.6.0)

*Defined in:* NavIcon — ui.jsx (keyed by the tab keys in routes.js: home · library · movies · quotes · search · tags · import · metadata · stats · settings · profile · users)

One glyph per nav tab, and now one *set*: it lived in `App.jsx` with its own stroke settings, which is how the app came to draw a magnifier, an open book and a tray-download twice each — once in the nav at stroke-width 2.0 and once in the shared set at 1.85 — and to draw the **Library** tab as the same open book the "currently reading" cover badge wears, on screens that show both at once. Library is spines on a shelf now; every other nav glyph is an exported `Icon*` from the shared vocabulary, at the shared weight. Stroke is `currentColor` so the active-tab tint flows through. An unknown tab key returns `null` on purpose — a tab added to a nav list and not to the switch should render a bare label, not crash the shell — which is why `icons.test.jsx` asserts every key in all four lists has one.

### tabs / tab

*Defined in:* .tabs / .tab / .tab.active / .tab-label — index.css

Secondary tab-strip styling: a row of quiet `.tab` buttons where the **active** one wears a hand-drawn accent pill (paper) or an accent tint + glow (film). The `.tab-label` span is also what NavToggle wraps its labels in — hiding it at ≤768px is how the primary nav goes icon-only.

### DetailFrame (3.2.0)

*Defined in:* DetailFrame — ui.jsx · .tp-detail / .tp-detail-hero / .tp-detail-stream — index.css

The work detail's two columns, and the app's only screen that does **not** scroll the window: the shell locks the document (`html[data-scroll='screen']`, published by `useScreenOwnsScroll`) so the hero can stay put while the quotes move. The hero column is `--hero-w` wide — 300px, 340 from 1440 — and appears only from 1180px; below that its content folds into the stream, because a 300px column beside nothing is a margin. Both columns are edge-faded scrollers, and `--detail-pad` is at least the fade's own 1.6em so a cover's drop-shadow is not clipped by the mask. The stream caps at 880px for measure, which is what makes the page's `--container-max` unnecessary here.

### demo-ribbon

*Defined in:* .demo-ribbon — index.css · App.jsx (VITE_DEMO)

Slim sticky accent banner shown only on the read-only GitHub Pages demo build — declares the dummy, read-only nature and links to the real repo. Sits above the shell (z-index 60).

## Mobile shell (≤768px)

The phone chrome: nav moves to a fixed bottom bar, pages grow sticky top bars, filters move into full-screen sheets, and every hit target grows to 44px. All of it is gated on one media query. (Demos below are forced visible/static — in the app these pieces only render on a narrow viewport.)

### dock

*Defined in:* .mobile-dock / .brand — index.css · App.jsx Shell

The mobile shell bar, fixed to the bottom of the screen: brand mark + icon-only **nav-toggle** + **user-chip** (whose menu opens *upward* here). It replaces the topbar entirely on phones and owns `env(safe-area-inset-bottom)`. (Shown static and forced visible — it only displays at ≤768px.)

### mobile-sticky-bar

*Defined in:* .mobile-sticky-bar — index.css · Library.jsx / Movies.jsx

Sticky, solid-backed strip at the very top of a mobile page — it hosts the **page-header** (list pages) or the **mobile-detail-bar** (detail pages) so scrolled-under content can't show through, and owns `env(safe-area-inset-top)` for the notch. The container drops its own top padding so this bar sits flush with the screen edge.

### Panel

*Defined in:* usePanelStack / PanelHost — ui.jsx · .tp-panel / -scrim / -head / -slot / -title / -back / -body — index.css

**One surface for anything that opens another surface.** A work detail could reach about thirty of them across seven different physical kinds — a centred dialog, a bottom sheet, a confirm, three bare-scrim overlays, anchored popovers, inline blocks and two raw `window.confirm()` calls — and a reader met three of those on one screen. A panel is a list of rows that may push another list of rows; that is one shape, so it has one implementation. 
 
**The header is three slots**: two equal flexible sides each reserving the 44px a key needs, with the title between them. The title is therefore centred on the *box* rather than on the space left over, so it does not shift as you walk the stack — and everything in the head shares one 44px line box, because a back key and a title sitting a few pixels apart vertically is the tell of a header assembled from parts. 
 
**The head casts, unconditionally.** A 1px rule alone made the body look like it passed *through* the header rather than under it, and a shadow that arrives on scroll is a layer changing depth while you read. 
 
**The back key names where it goes**, not "Back" — walking a stack of five is otherwise five presses of a key that never says what it will show you. Capped in `ch`, because it holds text. 
 
**No ✕ on a nested panel.** Its two exits are answer and back: a ✕ there closed the whole stack and discarded the half-filled surface underneath, which is a destructive key wearing a dismiss key’s clothes. The slot still reserves its 44px so the title does not move. 
 
**History is the stack’s only mutator**, and that is the whole design. Every push writes its depth into `history.state`; every close — ✕, the ← key, the scrim, Escape, a row that answers its question — goes back through `history.back()`. So the phone’s Back gesture and the header’s own key are one code path and cannot disagree, and a panel dismissed by ✓ can never leave an entry behind for Back to re-open. The depth is read from the popped state rather than decremented, because a browser coalesces a multi-step `go(-n)` into *one* popstate — a handler that popped one level would strand the rest of the stack open with no entries left. 
 
**A held device puts its surfaces at the edge the hand is at**, so below 1180px the panel hugs the bottom exactly as the phone’s sheets do — stopping short of the edge, where the system’s own gesture strip lives. 
 
**A panel can host a form, and draws the ✓ that commits it.** A form in this app never draws its own save key: `useFormHost` registers the form with whatever chrome is above it, wears that chrome's `formId` on its ``, and reports a *reason* it is not ready yet; the chrome draws one `type="submit" form=…` key bound to that id, greyed with the reason as its tooltip. Until 3.2.0 the only chrome that did this was **FormModal**, so a form moved onto the panel stack lost its save key silently — nothing thrown, nothing logged, and the `` simply had no id. A panel with no form in it still draws nothing: a list of rows has nothing to commit and must not offer to. The reset when you walk the stack happens *during render* rather than in an effect — a child's effects run before its parent's, so an effect keyed on the depth fires straight after the form registers and undoes it.

### SectionHead

*Defined in:* SectionHead — ui.jsx

A page header, or the same words one level down. **Checks** is one screen made of two pages that were screens of their own, and each still has to work at both ranks: on its own URL it *is* the page and takes an ``; inside Checks it is a section under that page’s `` and takes an ``. A page with two ``s is not a style problem — it is a document with two titles, and a screen reader reads it as two documents. One component rather than a conditional at each call site, so the two pages cannot disagree about what "embedded" changes the first time one of them grows a fourth header.

### MobileSheet

*Defined in:* MobileSheet — ui.jsx · .mobile-sheet / -card / -header / -close / -title / -spacer / -body / -footer — index.css

The full-screen mobile sheet: sticky header (back arrow + title + an optional **actions** slot), a scrollable **mobile-sheet-body** where callers compose the controls (selects are forced full-width so the sheet reads as a form), and an optional pinned **mobile-sheet-footer**. Opened from the filter IconButton on Library / Catalogue / detail pages, and — since 1.4.1 — by the ＋ Add surface and the backup prompts, which is what the **actions** slot is for: a form's Save belongs in the title bar, where a thumb can reach it without scrolling past six fields, not at the foot of the scroll. It replaces the spacer that balances the close button, so a sheet with no actions still centres its title. A form also passes `dismissOnScrim={false}`: a filter sheet loses nothing to a stray tap beside the card and a half-written quote loses everything. Never rendered on desktop. (Shown static at a fixed height — the real sheet covers the viewport.)

### SheetFooter

*Defined in:* SheetFooter — ui.jsx

The standard filter-sheet exit row: ghost **Reset** · live result-count **microcopy** · primary **Done**. Keeps every sheet's exits consistent instead of relying on the back arrow alone.

### MoreMenu

*Defined in:* MoreMenu — ui.jsx · .more-menu / .menu-item — index.css

The "⋯" overflow dropdown for actions that don't fit a mobile bar: an **IconButton** trigger opening a `hand-card hc-r2` panel of **menu-item**s; `danger` items are tinted `var(--error)`. Closes on outside click or item pick. (Shown open, inline.)

### ScreenMenu

*Defined in:* ActionMenu — ui.jsx · ScreenMenu / useScreenBar / buildScreenActions — App.jsx, ui.jsx · .menu-head / .menu-tick — index.css

The **⋯ at the right of both top bars**, holding everything the screen you are looking at can do. 
 
**A menu bar, not an overflow.** It lists the whole set — including controls also drawn on the page: which view you are in, which sort is running, what the filters are. An overflow menu holds the leftovers, which makes it a different shape on every screen and empty on several; a menu bar is one place a reader can always look, and it is the same shape on all twelve. The cost is deliberate duplication of the visible controls, and it buys the only thing that makes a menu worth opening — you can find something in it without already knowing it is there. 
 
**The items are built when it opens.** `useScreenBar({ actions })` takes a *builder*, not a list, and the builder is never published through the subscription the sub-line and the dock keys use. A menu bar’s rows carry state, and a published list would be stamped by its ids — the ids do not move when the sort does, nothing re-publishes, and the menu goes on ticking the view you left. The shell holds a pointer to the current builder and calls it at the moment the ⋯ opens, so nothing can be one render behind. 
 
**Every builder on screen, not one.** Checks composes the staging queue and the stray-marks list, both `embedded` and both entitled to publish, so the registry is a Set and the menu concatenates in mount order. A single slot would have let whichever rendered last win silently, and the other half of the page would simply have looked like it had no actions. 
 
**Three kinds of row.** A **heading** carries no role and takes no focus, so the arrow keys skip it for free. A **choice** is a `menuitemradio` with `aria-checked` and a ✓ at the far end — a plain menuitem with a tick drawn on it is a decoration a screen reader never mentions. A **verb** is a plain menuitem, tinted `var(--error)` when it destroys something. The keyboard handler reads `[role^=menuitem]`, because a selector naming only `menuitem` steps over exactly the rows that are a choice. 
 
**It wears the ? button’s skin on a desktop** and the phone bar’s on a phone — one component, each bar dressing it. Caught by looking at a render: the first cut gave it the `.help-btn` ring, a hairline in `--line`, and a bare glyph between two solid accent controls reads as something bolted on afterwards whatever it does. **Help is the shell’s own row**, appended after whatever the screen published, because it is never the screen’s to offer and several screens publish nothing at all. (Shown open, inline.)

### IconButton

*Defined in:* IconButton — ui.jsx

A 44×44 circular ghost tactile button wrapping a line icon — the atom of every mobile bar (back, filter, add, ⋯). The **larger of the app’s two icon sizes, and the one that can be named:** pass `label` and it renders the same icon + `.btn-label` pair a worded button does, so it honours **Button labels** in both directions. `danger` and `ok` tint it; `ok` exists because its absence was being worked around — the Add sheet’s ✓ wore the 34px family’s colour class to go green, and one family borrowing another’s stylesheet is how two families stop being two.

### FieldIconButton

*Defined in:* FieldIconButton — ui.jsx · .field-icon-btn

The **other** icon size: 34px on desktop, 42px on a phone where the touch minimum wins. It lives inside a row that has already spent its width — a text input with a ✓ and a ✕ after it, a card’s action row, the cover controls — and it carries the edit/save/cancel trio, the table row actions, every `CloseButton` and the quote tools. Variants: `ok`, `danger`, `boxed` (a resting outline, for the cover cluster that has no field row around it to be the affordance) and two latches, `active` and `busy`, which are classes rather than hover states because a latch has to survive the pointer leaving. 
 
**It was a class string until 1.14.0** — `field-icon-btn tactile`, hand-written at 46 call sites across 13 files, the only primitive in the app that was never a component. The copy-paste had held well: all 46 carried an `aria-label`, all 46 were wrapped in a `Tooltip`, and exactly one had drifted (a Home button was missing `tactile`, so it did not press when you pushed it). **The drift is not why it became this.** A class string cannot make a decision — `IconButton` gained an opt-in `label` so the 44px family could honour **Button labels**, and this family could not opt into anything because there was nowhere to put the opting. Forty-six buttons sat outside a preference that claims to govern the app, not by a decision but by never having been asked. 
 
**Asked, the answer is that this size is nameless, and there is deliberately no `label` prop.** 34px exists precisely *because* there is no room for a word beside the glyph; adding one would collapse the distinction between the two families rather than complete it. So the app has two sizes and two rules — 44px can be named and opts in, 34px is nameless and puts its name in the tooltip and the accessible name, both of which the component guarantees. A test asserts exactly one `` in the SPA wears the class, so the 47th hand-written copy is not a paste away. The one non-button that wears it is named too: a file picker has to be a `` around an ``, so it borrows the look on purpose.

### icon set

*Defined in:* ui.jsx — one `iconStroke` spec (24px, currentColor, stroke-width 1.85, round caps, aria-hidden). IconGrid / IconList / IconTable reuse ViewIcon at 15px, the one deliberate second size class.

The whole vocabulary, drawn from the button inventory rather than a wishlist — this release added the second row above, and every one of them has a call site. 
 
**IconArrow and IconWarning are the newest two, and they arrived by deletion.** Forty-three places in this app drew a glyph by TYPING it — `♥`, `▲`, `→`, `✓`, `⚠`, `↗` — which is the platform’s drawing rather than the app’s: it changes with the reader’s font, sits off the baseline every other glyph shares, and is the one picture this page cannot document. Every one of them now draws an `Icon*`, and the two shapes the set had no answer for became these. `IconArrow` takes a `dir` because four rows point four ways and four drawings of one idea is three too many. 
 
**Two pairs were redrawn because they were the same picture.** `IconShare` and `IconUpload` were both a tray with an arrow in it, differing by about a pixel and a half of arrow, and appear in the same rows — a quote card offers share, the tag manager offers upload. Share is the node graph now and shares no geometry with a tray. `IconExport` and `IconMetadata` were the same three strokes at coordinates half a unit apart, sitting two buttons apart on the Metadata console, one pulling data in and one pushing it out; Metadata is an arrow landing *inside* a record card now, because that is what fetching metadata does. `IconChevron` was promoted out of `CoverPicker.jsx`, where it had been the only glyph in the app defined outside `ui.jsx`. 
 
None of that was visible in a screenshot of any one screen, so `test/dom/icons.test.jsx` asserts it instead: every exported glyph is compared with every other, both exactly and with all coordinates stripped, and identical geometry fails the suite. 
 
**One glyph per meaning is not the whole job — a glyph also has to look the same SIZE as the set.** `IconQuote` was a bare pair of quotation marks spanning 13×10 of the 24 grid, beside an `IconBooks` spanning 17×15 and an `IconReel` spanning 17×17. Nothing about it looked broken; it looked small, which is a complaint nobody can act on until it is measured. It is a square speech bubble with the marks inside now, filling the box like its neighbours — and the bubble is not only packaging, since a line somebody said is exactly what the three screens it fronts have in common. The marks stay *filled* inside a *stroked* bubble: outlined quote marks read as the digits "66", which is why they were filled to begin with. The same test file now measures each nav glyph's footprint and fails when one drifts out of the set's range.

### touch-target pass

*Defined in:* index.css — @media (max-width: 768px)

At ≤768px every interactive control is grown to a **44px minimum hit size**: toggle options, select triggers, menu items, the user-chip, filter chips (incl. `.filter-chip-mobile`), ghost buttons, inputs, and hearts/stars — which keep the 44px hit *height* but narrow to 34px inside cards so a heart + five stars + links still fit a ~310px card column. Bottom-nav tabs squeeze their padding so five icon tabs + brand + chip fit a 320px screen.

### useIsMobileScreen / MOBILE_SCREEN_QUERY

*Defined in:* ui.jsx — isMobileScreen() · useIsMobileScreen() · MOBILE_SCREEN_QUERY

The one switch behind all mobile rendering: `MOBILE_SCREEN_QUERY = "(max-width: 768px)"`, exposed as a live hook (`useIsMobileScreen`) and a one-shot check (`isMobileScreen`). It deliberately follows the browser's *layout viewport*, not the device — "desktop site" mode on a phone gets the desktop UI. Every JSX-level mobile decision (sticky bars, sheets, icon buttons) gates on it, matching the CSS breakpoint exactly.

## Type

The recurring text roles.

### page-header

*Defined in:* PageHeader — ui.jsx

Screen title (Newsreader) + **mono-label** counts + optional right-side actions. The Library page is headed "Books", the Catalogue "Movies & Shows". On mobile it's wrapped in a **mobile-sticky-bar** and its desktop action buttons become IconButtons + a MoreMenu. What it deliberately does *not* carry any more: a ＋ Add or a "?". Both were shell controls drawn a second time per page — the header's ＋ sat inches from the top bar's own ＋ — so 1.4.1 left the header only what is genuinely local to the list, its filters and its export.

### Type panel (1.15.2)

*Defined in:* TypeSettings — Settings.jsx · fonts.js · --font-display / -ui / -mono / -hand / -bengali / -devanagari

**Six type ROLES, three faces each, and every row shown doing its own job.** A role is what the font is *for* — quotes, interface, labels, notes, Bengali, Devanagari — so swapping one is a line in `fonts.js` rather than a search for every place a family name was written down. Each row sets its *own* text, which is the whole design of the screen: a type list that puts “the quick brown fox” in every face answers no question anybody has, and it cannot show the Bengali row at all, whose entire point is a script no specimen sentence contains. 
 
**The Indic faces live inside the Latin stacks**, listed after the Latin face. No Latin codepoint ever reaches the Bengali face and no Bengali codepoint stops at the Latin one, so one stack serves both and neither pays for the other — listed *before*, their own Latin subsets would win and the app would change typeface. The non-obvious consequence: picking a new Bengali face rebuilds the display, ui and hand stacks too, so stacks are composed from the whole choice rather than per role. 
 
**The style modifiers are companion custom properties** — `--font-display-weight` and four more — set beside every `font-family: var(--font-X)`, 69 rules and 63 inline styles, so a modifier lands where its role is used and nowhere else. Set once at `:root` they would inherit into everything. **Off is `inherit`, not `normal`**: a heading already at 600 must not be flattened to 400 by a role nobody touched. Where an element already sets its own weight or italic the companion is dropped rather than left to fight it. 
 
**It is a pop-up off Appearance, not a card** (1.15.2). Six roles, each with a specimen, a face picker and a row of style chips, is the tallest thing the settings page has, and it stood open in a column beside cards you read at a glance — for a choice most readers make once. The button and its letterform glyph sit under the theme presets. Language marks became a pop-up in the same pass and for the same reason, and moved to the Metadata card in 2.1.3, so this is the only door Appearance carries. 
 
**There is no “monospace” switch, and the screen no longer says so either.** It was asked for; whether a face is monospaced is how it was drawn, and no CSS makes a proportional face monospaced — so a control by that name could only lie, and the face picker directly above it is the real answer. The paragraph that explained this to every reader who opened the Labels row went in 1.15.2: it answered a question nobody on that screen had asked, and the reasoning now lives in `fonts.js` beside the style table it is about. `font-variant-numeric: tabular-nums` ships as **Lining figures**, which is the true thing behind the request. Small caps and all caps are absent from the Bengali and Devanagari rows, which have no case at all. 
 
**Bundled, never fetched.** Eighteen families, all OFL-1.1. This app makes no network request the reader did not ask for, and a type picker that phoned a font CDN would have been the first exception — on a screen about how your own words look. Your own font can be uploaded beside them: stored on your own server, never parsed there, sniffed by magic bytes rather than by extension, and measured against the row’s script afterwards. That check is a **warning and not a refusal** — it can be fooled either way, and refusing somebody’s own font on a metrics heuristic is worse than telling them what looks wrong.

### mono-label

*Defined in:* MonoLabel — ui.jsx · .mono-label

Uppercase mono micro-label — counts, chapter/location lines, field labels.

### kicker

*Defined in:* Kicker — ui.jsx · .kicker

Small lead-in line above a heading.

### microcopy

*Defined in:* .microcopy — index.css

Small lowercase mono aside — form hints, sheet result counts, login-card footnotes, "loading…" lines.

### bengali

*Defined in:* .bengali — index.css (Noto Serif Bengali)

The Bengali display role — amber Noto Serif Bengali. Carries the টিপ্পনী subtitle on the login card.

## Cards

The paper/film surface everything sits on (`HandCard` — ui.jsx). `variant` 0–3 picks an uneven radius; `colorBar` adds the left highlight bar.

### hand-card

*Defined in:* .hand-card (variant 0)

### hand-card · hc-r1

*Defined in:* variant 1

### hand-card · hc-r2

*Defined in:* variant 2

### hand-card · hc-r3

*Defined in:* variant 3

### color-bar

*Defined in:* HandCard colorBar — the 4 highlight colours (yellow / blue / pink / orange)

## Quote block

The annotation card on a book's detail page — a `hand-card` with a `color-bar` holding the quote, meta, note, tags, marks and an optional **sticker seal** the text flows around. The list offers tiles / list / table views via the **ViewToggle**, and adding starts from the dashed **add-annotation tile** at the top (or the sticky-bar ＋ on mobile). (Dialogues use the film-strip form below; a standalone quote uses the same card with a different meta line — see the tile after this one.)

### quote block (annotation card)

*Defined in:* Library.jsx annotation list · HandCard + QUOTE_STYLE + HandNote + TagChip

Anatomy: **quote** (display italic, flowing around an optional **sticker seal** — see FlowQuote), **chapter/location** mono line, **hand-note**, **tag-chips**, and the action row — ♥, **copy**, **share**, the colour quick-pick, then a ⋯ overflow holding edit and delete (see Marks & Buttons). Inline editing swaps the card body via **EditReveal**.

### board (1.14.0)

*Defined in:* boards.jsx · BoardList / BoardTile / BoardForm · migrations 0036, 0037

**/quotes lists boards the way /library lists books**, and you open one to read what is on it. A board carries a name, one of the six category colours as a spine down its left edge, a description and an uploaded picture — nothing *fetches* that picture, because no supplier has a photograph of a shelf somebody invented, so an empty one is the app’s own quote mark rather than a broken image. 
 
**This replaces the segmented control 1.13.0 shipped, and the reason is worth keeping.** That control was handed to `WorkListScaffold`’s `leading` slot — a *filter* slot. On a phone it renders inside the **Filters sheet**, so the three boards were invisible on the device this app is designed for first; and the whole row is gated on `hasItems`, meaning the *current* board is non-empty, so opening an empty board **removed the control that got you there**, with the choice persisted so a reload did not rescue you. A filter narrows what you see within a container; a board decides which container you are in. Naming that difference is the entire fix. 
 
**They are the reader’s, and the code knows none of their names.** Proverbs, Speeches and Others are seeded from the old three-value column and are ordinary from that moment — renamable, deletable, hidable. Where a fallback is genuinely needed (the ＋ pressed outside a board, an import naming none) it is the **default board**, a preference pointing at a *row*, so renaming cannot break it. 
 
**Deleting asks where the quotes go** and refuses until told; an empty board goes without a question. That gives the no-orphans guarantee through a rule about the *operation* rather than by making one board permanent, and the database backs it with `ON DELETE RESTRICT` so a forgotten move is an error rather than a lost quote. The one thing it cannot do is delete your last board while quotes are on it. **Hiding** is explicit and never inferred from emptiness — a board you have just made is empty, and vanishing at that moment is the same trap this entry exists to undo — and it loses nothing, because a hidden board’s quotes are still under **All quotes**, which is pinned, is not a board, and cannot be renamed, hidden or deleted. 
 
**The three are OFFERED now, not only seeded (1.14.2).** 0036 seeds from quotes the reader already had — rightly, since nobody should open the app to three empty shelves they never asked for — but a reader with no standalone quotes got no boards at all and no way to ask for the three the rest of the app talks about. Reported as “I still cannot access the seeded boards”: nothing was broken, the offer had never been built. It sits on the **Add board** form, where somebody has already said they want a shelf, and it *fills the form in* rather than creating anything — the name stays yours to change before you press Create, which matters because a second board of the same name is a 409 and an editable field beats an error. They stay on offer rather than disappearing once “added”, because the app cannot tell a Proverbs board you renamed to Grandmother from one you never made; the name box is the honest guard either way. 
 
**And a board knows what it HOLDS, which is not what it is called.** `kind` is `plain` or `proverb`, set by the reader on a toggle rather than inferred from the name — rename a proverb board to Grandmother and it is still one; call a plain board Proverbs and nothing changes about it. Both of those are the correct answer, and they are why 0037 added a column instead of a name match, which would have broken exactly the reader 0036 promised not to break. A proverb board asks for its **languages** at creation (multi-select, and the box beside them takes any language, not just the three the starters ship in), because the list is what turns the quote form’s Language box from free text somebody has to spell consistently into a short list. Stored on the board rather than derived from its quotes: deriving would be free and never stale, but it can only describe a board that already has quotes, and the board is empty at the moment the question is asked. Those languages are also what the optional **per-language sections** group by — a grouping rather than folders, since a folder is a place a quote lives and a proverb already lives on the board. `speech` is deliberately not a kind: a speech quote uses the same fields every other quote does, so it would be a label with no behaviour behind it. 
 
**An opened board is a detail page, and on a phone it now looks like one (1.14.2).** It drew its way back as a button in a `
` above the scaffold, with a comment explaining that `WorkListScaffold` had no back slot. On a desktop that is right — a book’s page does the same, with room to spare. On a phone it was an *entire row* spent on one back arrow, with the board’s name, its count and its filters in the row beneath, while a book’s page has always put all four in a single **MobileDetailBar**. The fix is the missing slot rather than a stylesheet tweak: the scaffold takes an `onBack`, and when it has one on a phone it draws that same bar — so a board and a book are now the same page shape, with Filters under the thumb. (The seat beside it was Export until 2.3.0 and is now the way to the other boards; Export is in the screen’s own ⋯.) The sections a board can be grouped into were already the shared **GroupHeading** every other screen uses, so per-language sections behave exactly as grouping by author or decade does.

### quote block (standalone quote) (1.5.0)

*Defined in:* Quotes.jsx · AnnotationCard with `meta` + `form` · utteranceMeta + UtteranceForm

The same card as an annotation, and deliberately so: `.card-actions` and `.card-colors` only reveal under `.hand-card:hover`, and `.hand-card::before` is what carries the material — a bespoke wrapper would look right and lose the aesthetic toggle. What differs is the **meta line**: where a book shows `CH. 3 · P.142` this shows the **occasion** — speaker · occasion · when · place · kind · language, each dropped when empty (0053 replaced the free-text medium with a fixed kind; a card falls back to the old text while no kind is set). A quote with none of them (a proverb) shows no meta line at all.

### Speaker credit (1.6.0)

*Defined in:* utteranceMeta — Quotes.jsx · CreditFaces + PersonName — people.jsx · SPEAKER_LINK

The speaker half of the meta line, and a **credit** rather than a string: `splitCredits` divides it on your own separators, **CreditFaces** draws the overlapping portraits of everyone named, and each name is a **PersonName** opening that person's **Person panel**. Styled through `SPEAKER_LINK` — `font:inherit;color:inherit` plus an underline — so it keeps the mono voice of the line it sits in instead of arriving as a blue link mid-sentence, the same trick the film pages use for `PLAYED BY`. **Why it is worth a tile:** `speaker` became a people kind in 1.5.0 and the share *image* drew these faces from that release on, so a speaker you had enriched showed their portrait in the picture you exported and stayed inert text on the card you exported it from. The card, the group heading and the image now split the credit by the same rule, which is the whole point of splitting it in one function.

### hand-note

*Defined in:* HandNote — ui.jsx · .hand-note

The reader's own note — Caveat + accent tick (paper), Newsreader italic (film).

### add-annotation tile

*Defined in:* Library.jsx annotation section (collapsed add form)

The dashed tile that *leads* the annotation list, so starting a note never means scrolling past it — clicking swaps it for the inline `AnnotationForm` in a hand-card, auto-scrolled into view. On mobile the sticky-bar ＋ IconButton opens the same form.

### FlowQuote

*Defined in:* FlowQuote — flow.jsx · .flow-line / .flow-sticker — index.css

Quote text that wraps line-by-line around an attached sticker seal: per-line widths are computed against the seal's circle, each line rendered as a nowrap `.flow-line`. The seal is **draggable** — release persists its centre (width-normalised x/y) on the annotation. Falls back to plain text under reduced-motion or with no sticker. (Static mock shown; the app computes real line breaks.)

### sticker pieces

*Defined in:* StickerImg / StickerPicker / NewStickerCard / StickerList — stickers.jsx · .sticker-strip / .sticker-opt(.is-sel) / .sticker-none / .sticker-add / .sticker-swatch / .sticker-img — index.css

The sticker-seal system: **StickerImg** renders an uploaded transparent PNG/SVG with a lifted drop-shadow; **StickerPicker** (shown) is the add/edit-form strip — a "none" option, the user's stickers on checkerboard tiles (selection = accent ring), and a dashed upload tile. The Tags page manages the library via **NewStickerCard** + **StickerList**, whose previews sit on a `.sticker-swatch` checkerboard.

### Portrait backdrop (1.6.0 · tinted 1.6.1 · haloed 1.7.2 · sides + line-up 2.2.3)

*Defined in:* drawQuoteCard / fadedPortrait — quoteImage.js · portrait + colour toggles in ShareDialog · `tippani:sharePortrait` / `tippani:shareImageTint`

The credited person, bled in from the card’s edge, tinted with the quote’s own highlight colour, and faded out before the words start. **One name enters from the left; two take a side each with the quote between them** — which is the shape a conversation has, and the reason the second face goes right rather than beside the first. **Three or more line up along the bottom instead** (2.2.3), one cell each, abutting, fading upward into the paper — a team shot. That is not an option offered: &ldquo;backdrop&rdquo; already answers how these people should appear, and how many of them there are is a fact about the quote rather than a second question, so a control offering the two-sided layout for five faces would be offering a worse picture on purpose. A card has two edges, and until 2.2.3 the third face was dropped without a word. The **Sides** toggle reverses the order — exchanging two, moving a single portrait to the other edge, reversing the row — because which way round a conversation reads is a judgement about the line and not something the card can know. Reversing the LIST rather than flipping the sides is what lets one flag cover all three layouts. (Demo shows the gradients only; the real card carries the photos.) 
 
The fade is a real **alpha mask** — `destination-out` on an offscreen canvas — rather than the card colour painted over the photo. The card’s face is a vertical gradient, so a flat overlay would leave a seam exactly where the fade ends, which is the one place a viewer is already looking. 
 
**The tint is a duotone**, not a wash: the `color` blend keeps the photograph’s luma and takes the quote colour’s hue, so the face stays a face. That is a CSS blend mode rather than a Porter-Duff operator, and a canvas that does not implement it *ignores the assignment silently* — leaving `source-over`, which paints a flat slab of colour across the person. So the property is read back and a `source-atop` wash is used instead when it did not take. Order carries the rest: the tint goes on while the buffer is still opaque, so it colours the photo; the mask goes on after, so the colour fades out with the face rather than surviving as a coloured rectangle. 
 
**The colour appears once or not at all, and starts at not at all.** A single switch governs both card kinds — on a plain card the quote colour is the stripe beside the words, on a backdrop card it is the hue of the portrait, and never both, because a stripe next to a portrait already wearing the colour is the same thing said twice, the second time louder. It is **off by default** since 1.7.2: a colour category is a private filing decision — what kind of note this is *to me* — and the person receiving the picture has no idea the scheme exists, so to them a blue stripe or a blue face is a design choice the card is making, and a fairly loud one. Changing that default meant **retiring the storage key**, because `usePersistedState` writes on mount: the old default had been stamped into local storage by the first render of the panel on every device that ever opened it, so flipping the literal alone would have changed the default for nobody. 
 
**Every word on a backdrop card carries a halo** of the card’s own surface colour — a shadow with no offset, so it is a glow around each letter rather than a drop shadow beneath it, which would say “this text is floating above a picture” when the text is meant to be *on* the card. A photograph is not a background colour: it has its own lights and darks, and ink that reads cleanly on paper vanishes into a shoulder or an eye — not all of it, which would at least be obvious, but a word here and a word there. The card colour is the right halo in both modes without a branch (dark ink gets a pale surround, pale ink a dark one), and it is taken from the *skin being drawn* rather than the one on screen, because the picture’s skin is picked separately and frequently is not the app’s. It is drawn only where there is an image; on a plain card it would be a blur pass spent compositing the paper onto the paper. 
 
It rides the same `faces` array as the small credit discs, and therefore the same Author / Actor / Speaker tick: unticking the credit takes the backdrop with it, so a card can never credit nobody while wearing that nobody’s face. **With a backdrop the discs step aside entirely** — 1.6.0 drew both, and a 34px crop of the same photograph beside a full-height version of it reads as a mistake rather than as identification. The attribution line reclaims the indent it was leaving for a cluster that is no longer there. The toggle hides itself when no one credited has a saved photo — a control that cannot change the picture is a question with one answer. Like the skin picker beside it, the choice is device-local: an export preference, not an identity one.

### Face (actor or character) (2.3.0)

*Defined in:* QuoteImagePanel — share.jsx · `share.faces` / `share.characterFaces` from bookShare + movieShare · `tippani:shareFaceKind`

Whose photograph the quote card draws: the performer, or the part they played. These have been two stored pictures for as long as a cast row has had one — an actor is global (`people.image_path`) and a character belongs to one work (`work_cast.character_image_path`) — and the card could only ever draw the first. **For a line whose whole point is who said it, the performer is often the wrong one**: V delivers the speech, and Hugo Weaving is a man in a photograph not wearing the mask. The control is **hidden, not greyed, unless the work has a saved picture for both**, which is the same rule the Portrait toggle follows and for the same reason — a toggle that cannot change the picture is a question with one answer. Book quotes get it too, and that is the half of this nobody could see: the server has been sending a book annotation’s character pictures for as long as they have existed, and no book surface ever read them. The swap happens once, in the panel, so `faces` keeps meaning the actor’s everywhere else and the drawing code learned nothing new. Device-local, like the skin and the backdrop beside it.

### Signature slot (3.3.0)

*Defined in:* SignatureSlot / SignatureInk — signature.jsx · .sig-slot / .sig-verbs / .sig-ink / .sig-stage — index.css · person record, identityGlobal.jsx

A person's signature, under their portrait on the record (a company has none). **Upload signature** and **Fetch from Wikidata** both open one window that shows the signature *cleaned* — ink on a clear ground, drawn in the text colour so it reads on every theme — with an **Ink strength** slider that cleans the same file again on release and the standing ✓/✕ pair; only ✓ saves. **Remove signature** takes it off, and the person’s Fetch will not put it back.

### Signature (on the card) (3.3.0)

*Defined in:* drawSignature — quoteImage.js · signature switch in ShareDialog · `share.signature` from bookShare + movieShare + quoteShare · `tippani:shareSignature`

The credited person's signature, in the picture's bottom right corner, in the footer row beside the Tippani mark, no taller than that row and in the card’s own ink. Off by default, remembered on the device, and not offered when nobody credited has one or while the card shows the character, who signed nothing. It rides its credit’s checkbox, so unchecking the author drops it.

### ShareDialog (prose behind dots 1.7.2)

*Defined in:* ShareDialog + SHARE_FORMATS — share.jsx · .share-source / .share-preview / .share-hint / .share-code / .share-link / .share-format-scroll — index.css

Per-annotation share/export dialog: a format Toggle (WhatsApp · Plain · Markdown · Reddit · Image — a native select on mobile), include-field checkboxes, an editable mono **share-source** pane, and a simulated **share-preview** pane that renders the source the way the target app would. Copy goes through the clipboard API. 
 
**The explanations live behind info dots.** Each format's syntax **logic** line and its mono **share-hint** sample used to stand permanently above the quote; they are reference material — read once, while you are deciding, and then known — and four lines of it pushed the thing being shared below the fold on a phone. The dot is *titled with the chosen format*, so it announces as “More information: WhatsApp” and re-reads as the selection changes: an anonymous `i` beside a control whose meaning it depends on is a dot you must open to learn whether it was worth opening. Image has no syntax to describe, so its dot answers the other question — what this thing is — and the skin picker's “doesn't change the app” caveat became a dot rather than a grey aside.

### ann-table

*Defined in:* .ann-table / .ann-table-wrap / .col-quote / .col-mono / .col-center / .col-actions — index.css

The table view of annotations (and the manager tables): mono uppercase headers, hover-tinted rows, per-role column classes. `.ann-table-wrap` is **the one sanctioned horizontal scroller** — everything else must wrap rather than widen the page. Rows being edited (`.editing-row`) drop the hover tint. Headers sort via **SortableTh** (Controls).

## Tags

One managed vocabulary shared by books and movies — five **styles** × four **colours** (`TagChip` — ui.jsx, `.tag-chip.tc-*.ts-*`).

### ts-sticker

### ts-banner

### ts-flyout

### ts-tape

### ts-reel

### tag colours · tc-yellow / tc-blue / tc-pink / tc-orange

## Marks

The hand-inked user marks — deliberately tilted, never machine-perfect (ui.jsx `randWobble`).

### Hearts (favourite)

*Defined in:* Hearts — ui.jsx · leads the action row on both card kinds

Favourite toggle. Hearts for favourites — never stars. 
 
On a saved quote it is the **card’s resting mark**, and it sits at the head of the action row along the foot of the card, ahead of the colour dots and the ⋯ cluster. A film or show dialogue puts it in the same place as a book annotation: the two are the same object with different credits, and a control that moved between them would be two controls to learn. Everything else in that row hides until the card is hovered; the ♥ never does.

### LanguageMark (1.15.0)

*Defined in:* LanguageMark / markFor — languages.jsx · utteranceMeta — Quotes.jsx · `languageMarks` preference

**What a proverb wears where every other quote wears a face.** Every quote card leads its meta line with somebody’s portrait — a book’s author, a film line’s actor, a quote’s speaker. A proverb has nobody to credit; that is close to the definition. So the line began with nothing at all, and what a proverb *does* have is a language. The mark is drawn as the same disc a portrait draws, in the raised surface rather than a photograph, because it stands in for a face rather than being one. 
 
**Flags are offered and not assumed, and that is the whole design.** The ask was “use flags for languages”, and the tray offers two dozen of them, first. What the app does not ship is a *mapping*. A flag is a country and a language is not: Bengali is spoken either side of a border, Hindi has no flag of its own, and Spanish, Portuguese, Arabic and English have a dozen each with nothing to choose between them — so a default here would be this app telling somebody which country owns their mother tongue. A test asserts no starter language arrives wearing one, because a table like that is exactly what gets filled in later out of tidiness. 
 
The built-in is a letter from that language’s own script, the same list a proverb board’s cover draws from. A language nobody listed gets **no mark at all** rather than a guessed one — being confidently wrong about somebody’s language is worse than being blank — and setting one in **Settings → Metadata sources → Language marks** is how it gets a mark. It has been a pop-up rather than a card of its own since 1.15.2, and it hung off *Appearance* until 2.1.3, on the argument that what a proverb wears is a matter of appearance. It hangs off Metadata now, because the mark is what a quote with nobody to credit says it *is* — the same question the rest of that card answers. Where it is drawn is appearance; what it says is a fact about the quote. Only where there is no face to show: a quote that *has* a speaker gets the speaker, because a person outranks a language for the one slot going, and the language is still named a few words along.

### The language table (v3)

*Defined in:* IconTextOrder — ui.jsx · TextOrderPicker — textOrderField.jsx · LanguageMarksSettings / ISO6393Search — MetadataSources.jsx · iso6393.js

**One row per language, and it stays one row.** Metadata › Languages lists every language the reader's quotes are in. Each row is the language's mark (a round tile, like the face it stands in for), its name, its **ISO 639-3 code** — the three-letter registry of every language, so Ancient Greek is `grc` and not `el` — and how much of a quote's original shows. 
 
That last choice is **four icons**: a solid bar is the quotation as written, an outlined bar its translation, the top one shown first. The default at the top is the only place the four are also worded, and it carries a key to the two bars; every row draws them as icons, so a row that has its own setting shows it in the accent and says *own setting* beside the name. 
 
Adding a language **searches the registry** — 7,800-odd codes, loaded only when the search opens — and anything the registry lacks is still added as typed. Pressing a row's mark or name opens **one editor for every language**: its name, its code, and one grid of equal square cells for its mark.

### The plural tick and cross (v3)

*Defined in:* IconCheckAll / IconCloseAll — ui.jsx · the metadata merge screen's header pair, a board's Select row

**One picture may not hold two jobs.** Everywhere in this app a single **IconCheck** commits — it is the confirming half of the tick-and-cross every form wears, and its arming is what says something has changed; a single **IconClose** is the way out. Over a LIST of rows to choose between, the same two drawings meant “tick all of them” and “untick all of them”: presses that write nothing and leave the reader still at the decision. 
 
The report was the owner's, over the metadata merge screen: “replace the single tick at the top with double tick. the single tick feels like ‘ok’ and not ‘multi-select’.” The cross beside it goes with it — a double tick next to a single ✕ reads as “select all / cancel”, which moves the confusion one control along instead of ending it. 
 
Drawn as two whole marks with daylight between them rather than as the overlapping *done_all* of the icon sets, whose second mark is a bare diagonal that reads as a slash at this size. Shown here in the order they must never be confused in: confirm, take-all, close, take-none.

### Source files and context

*Defined in:* IconSourceFile — ui.jsx · SourceFilesConsole — SourceFilesConsole.jsx · SourceSection / QuoteContext / ContextBody — sources.jsx · useLibraryScan — libraryScan.js

**The file a work’s quotes came from, and the lines around a quote in it.** IconSourceFile, a page with a folded corner, marks **Metadata › Source files**: every work with quotes, its file (name, kind, uploaded or in a library folder), how many of its quotes have context, and the library folders with their Scan. A work’s details panel shows the same rows for one work, and the quote edit form shows the stored context under the quote, with the quote marked. Every failed request is said where its answer would have been, with a way to try again.

## Buttons & inputs

Playful buttons play a random micro-animation on click (ui.jsx `PlayfulButton`).

### btn-sticker

*Defined in:* StickerButton — ui.jsx

### btn-film

*Defined in:* FilmButton — ui.jsx

### tp-btn-ghost

*Defined in:* GhostButton — ui.jsx

### tp-btn-primary

*Defined in:* aesthetic-aware primary

### tp-field / tp-input

*Defined in:* Field — ui.jsx

### year field

*Defined in:* YearField — ui.jsx

A year, its estimate flag, and the phrase carrying both. It does NOT strip to digits — `c. 1500`, `380 BCE` and `c. 380 BCE` are all typable, and `parseYearInput` reads them at save. The tick is DERIVED from the phrase rather than stored beside it, so the two cannot disagree; typing the marker lights it, pressing it writes the marker. Disabled with no year, because `c.` alone reads back as nothing. An unparseable phrase takes a red edge instead of saving as no year.

### partial date field

*Defined in:* PartialDateField — ui.jsx

A date that may be a year, a year and month, or a full day (`YYYY` | `YYYY-MM` | `YYYY-MM-DD`), with a calendar button beside it. Where a caller passes the estimate flag — the two quote surfaces do — the tick is drawn as part of the field, and a `c.`, `ca`, `circa` or `~` typed in front is read BEFORE the box strips non-digits, which is where it used to be silently deleted.

### size slider

*Defined in:* SizeSlider — Settings.jsx · useCoverSize — ui.jsx

Plain range sliders on the Settings page — there are two: **Library cover size** and **Catalogue poster size** — each setting its grid's cell min-width, persisted per screen in localStorage (mobile defaults smaller).

### tp-link / tp-link-danger

*Defined in:* .tp-link / .tp-link-danger — index.css

The small underlined text-action — edit/share/delete on cards, "refetch links", table row actions. The **danger** variant is tinted `var(--error)`.

### tp-chip / tp-chip-btn

*Defined in:* Chips — ui.jsx · .tp-chip / .tp-chip-btn — index.css

The quiet mono pill for read-only facts (genres on a detail page, "saved" key pills); amber-tinted rectangles in film. **tp-chip-btn** is the actionable variant — same pill, accent text + hover lift — used for the provider link chips in the Metadata People console and for the role controls in the user list. 
 
**Make admin** and **Step down** are the same control on different rows, and the pair is the whole rule: granting is something you do to others, revoking is something you do to yourself. An admin row that is not yours carries neither — nor a delete, since removing the account would be the same act with that person's library attached. The button is *absent* rather than disabled: a greyed control still says "this is mine to do, just not now", which is the opposite of what is true here.

### TokenInput

*Defined in:* TokenInput — ui.jsx · .token-field / .token-pill / .token-x / .token-entry / .token-menu / .token-opt(.hi) — index.css

The tags/genres field: existing values as removable **token-pill**s, typing filters suggestions into a dropdown. Enter/comma adds (one paste can add several, comma-split), Backspace on an empty field removes the last, arrows + Enter drive the highlight. (Menu shown inline; it really floats below the field.)

### ErrorText · tp-error

*Defined in:* ErrorText — ui.jsx · .tp-error — index.css

The inline form/API error line, `var(--error)`. Renders nothing when empty, so it can sit permanently in a form.

### EmptyState · tp-empty

*Defined in:* EmptyState — ui.jsx · .tp-empty — index.css

Centred mono empty/loading message for any list. Film gives it a dashed amber frame.

### EditReveal

*Defined in:* EditReveal — ui.jsx

A height-animating wrapper: when a card swaps between its read view and the inline edit form, the wrapper morphs to the new height so content below *glides* instead of snapping. Overflow is only clamped during the transition — a sticker spilling into the gutter isn't clipped at rest. Used by annotation cards.

### edit-fade / editing-row

*Defined in:* .edit-fade / .ann-table .editing-row — index.css

The lighter edit-entrance for non-annotation editors (book/title forms): the replacing card fades + rises in (`edit-fade`, one-shot on mount — reload to replay). In table view an `.editing-row` drops the hover tint while its form is open.

### ann-form container query · cl-grid

*Defined in:* .ann-form (container-type: inline-size) / .cl-grid — index.css

The annotation form renders inside variable-width masonry tiles, so a viewport breakpoint is wrong — instead the form is a **CSS container** and the Chapter #/Chapter name row goes two-column only when the *tile itself* is ≥400px (`@container`). The repo's only container query. Resize this card to see it split/stack.

## Controls

The unified tactile controls (`ui.jsx`). One **Toggle** and one **Select** share a single sliding **accent thumb**; filter chips wear the same accent material when active. Native `title=` and `confirm()` are replaced by an on-brand **Tooltip** and **ConfirmDialog**. Since 1.4.0 the Tooltip also answers on touch: a 500ms long press puts its label in a **hint toast** at the top of the screen (see Help & density), so a glyph-only control is never unexplained on a phone.

### Toggle · tp-toggle

*Defined in:* Toggle — ui.jsx · .tp-toggle / .tp-toggle-opt.is-on / .tp-toggle-thumb

The one segmented control. A single **accent thumb** slides under the active option (draggable; its width is measured in JS to fit any labels). Filter/settings toggles carry leather (paper) / rubber (film) grain; the active label rides light over a `--sel-scrim` ground.

### CheckBox · tp-checkbox (v3)

*Defined in:* CheckBox — ui.jsx · .tp-checkbox

A box you tick, where a **Toggle** would be two words wide. The Toggle is the better control wherever there is room for it — it spells both states out, &ldquo;Hide&rdquo; and &ldquo;Show&rdquo;, instead of leaving you to infer what an empty box means. On a 390px phone those two words plus the row’s own name and its sorter do not fit a line, so the row wrapped and the list of sections ran twice the height of the screen. This is the same decision in a quarter of the width. 
 
**It is a real checkbox.** `appearance: none` on an `input[type=checkbox]` gives up the platform’s drawing — which is the one thing here that has to match the app, being a different size and colour on every OS — and keeps the keyboard, the label association and the announced role. The tick is drawn by a rotated `::before` rather than a glyph, so it scales with the box rather than with a font the reader may have changed.

### Select · tp-select (closed)

*Defined in:* Select — ui.jsx · .tp-select-trigger / .tp-select-chev

On-brand dropdown replacing native ``. Tactile trigger; the chevron flips when the panel opens.

### Select · tp-select (open)

*Defined in:* .tp-select-panel / .tp-select-opt.is-hi / .tp-select-thumb

The panel dips open and carries Toggle's sliding accent thumb (now vertical); hover or the arrow keys move the highlight. (Shown flowing inline; the real panel floats absolutely below the trigger.)

### tp-filter-chip / .active

*Defined in:* .tp-filter-chip — index.css · Library / Catalogue filter row + MobileSheet filters

Genre & facet filters — above the grid on desktop; on mobile the same chips live inside a **MobileSheet** (with a SheetFooter's Reset · count · Done), opened from a filter IconButton. The **active** chip wears the toggle thumb's accent fill + leather (paper) / rubber (film) grain over `--sel-scrim`, so a chosen filter reads as the same material as the toggles.

### chip switches

*Defined in:* ChipSwitches — ui.jsx · Settings.jsx (quiz questions, Features, review scope) · .tp-filter-chip — index.css

A row of INDEPENDENT on/off buttons, where a column of Yes/No toggles used to stand (1.17.0). A lit chip is on and `aria-pressed` carries it. Behind the in-depth quiz panel's question types, the Features card's four sections, and the review-scope chips those two borrowed the shape from. 
 
**Why not one toggle each.** A segmented Yes/No answers one question with two mutually exclusive answers; &ldquo;which of these seven does the deck ask?&rdquo; is one question with seven independent answers. Nine of them filled the quiz pop-up top to bottom, and the answer you want — the ones that are lit — had to be read a row at a time. 
 
**Each chip names its two axes.** Its tooltip ends with the CLASS of question (which work, which quote, who is behind it, the words themselves) and the FORM of the answer (pick one of four, type it back, mark yourself), because two chips can be the same question asked differently — &ldquo;Fill in the blank&rdquo; and &ldquo;Fill in the blank — with choices&rdquo; are one class and two forms — and a flat row cannot show that. 
 
**A locked chip refuses, and is not `disabled`.** Both callers have a last-one-standing rule: the deck must keep one question it can ask, the app must keep one content section. `disabled` eats the pointer events a tooltip opens on, so the chip stays live, says `aria-disabled` and swallows its own click — and the caller prints the reason IN WORDS under the row, because a reader who cannot turn something off is owed the reason on the screen rather than in a bubble they have to know to ask for.

### Tooltip · hint bubble

*Defined in:* Tooltip / HintBubble — ui.jsx · `.hint-bubble` / `.tp-tip-wrap`

The inverse-chip label bubble that replaces native `title=`. **One** bubble serves every input style — hover or keyboard focus on a pointer device, a 500ms press-and-hold on touch — and only what opens and closes it differs: the pointer leaving closes a hovered label, while a held one closes itself after 1.2s, because there is no "leave" on a finger that has already lifted. Shown forced-open here, above its control. 
 
**A hovered label needed two more closes (1.14.1).** `pointerleave` is the whole answer only while the thing under the pointer stays there — press a colour swatch and the picker re-renders, a panel opens over the control, the row reflows, and the leave event that was going to close it never arrives. The label then sits over the screen indefinitely, obscuring the control it was read to explain. So a **click closes it**, because you hovered to learn what the control does and then pressed it, and the click is the one moment we know for certain the pointer was there; and a **three-second backstop** catches the case where neither event comes, which is long enough to read a five-word label several times over. Both apply to hover alone: a keyboard reader has not asked for their label to vanish mid-sentence, and that bubble is closed by `blur`, which unlike `pointerleave` always arrives. The backstop gets its own timer ref rather than sharing the long-press one — a single ref for two unrelated schedules is how a hover cancels a press. 
 
Until 1.4.1 these were two mechanisms: a pure-CSS bubble absolutely positioned inside the wrapper for hover, and a pill pinned to the top of the screen for touch. Both failed the same way — neither could be kept inside the viewport. An opacity-0 CSS bubble still has a border box, so one hanging off a control near the right edge widened the page's scrollable area; the touch pill was centred with `left:50%` + `translateX(-50%)`, which cannot be clamped at all. Between them, Library and Settings could be panned sideways into blank space on a phone. The pill was also detached from its control, which answers "what is this?" without saying *which* "this" — and several 44px glyphs sit within a thumb's width of each other in these bars. The replacement is measured and placed in script: anchored to the control, flipped to whichever side has room, clamped on both axes. A fired long-press also **swallows the click behind it**, exactly as Material does, so holding Delete to find out what it does never deletes anything.

### InfoDot · info-dot

*Defined in:* InfoDot — ui.jsx · `.info-dot`

A small circled "i" that keeps dense help off the page until it is asked for. It carries **no tooltip** — see the full entry further down for why that was a mistake and what opens it now.

### ConfirmDialog

*Defined in:* ConfirmDialog / useConfirm — ui.jsx

Replaces native `confirm()`: a **hand-card** modal (title + optional body + Cancel / confirm buttons) over a dark scrim. Escape or a backdrop click cancels. (Card shown here; the real dialog centres over a full-screen overlay.) 
 
**Reach it through `useConfirm`.** It returns `{ ask, confirmDialog }` — render the dialog anywhere in the tree and the call site keeps the one line it had: `if (!(await ask(question))) return`. Thirteen destructive actions were still asking with the browser’s own `confirm()`, which is untranslated chrome in an app that ships in two languages — and **does not exist in jsdom at all**, so every one of those deletes returned early in every test that reached it and had never actually run in the suite.

### Save in the dialog header

*Defined in:* FormModal + FormHostContext / useFormHost — ui.jsx · ManualPopup — AddSurface.jsx

A dialog’s two answers are **yes and no**, and they sit together as ✓ and ✕ in the top right rather than one in the header and one at the foot of the form. The pattern replaced a primary *text* button ("Add book", "Save") at the end of a scrolling form — where the long variant pushed the commit off the screen while the way out stayed pinned in view, which is the wrong one to keep. 
 
**It is the standard, not a one-off.** Every `FormModal` carries it — Edit quote, Edit dialogue, Edit tag, Edit staged quote — arranged through a context rather than a prop, so the pattern arrived without a single call site changing. A form inside a dialog finds its host with `useFormHost`, wears the id the host gives it, tells the host why it cannot be saved yet, and drops its own footer buttons. The same form rendered *inline* — the search modal’s editor, the capture surface — finds no host and keeps its footer, because there is no header there to borrow. 
 
**The ✓ has to be earned.** Not every dialog holds a form: the work-details panel saves each field on its own. A ✓ there would look like it saves and do nothing, so the button is absent until a form registers rather than present and inert. 
 
**And the Details panel has now earned one (1.14.2).** Self-saving rows are the right answer for changing *one* line — the modal they replaced made you re-save a whole record for it — and they cost six presses for six lines. So a master ✓ appears in the header, through the very slot above, while every per-row pencil and ✓ stays exactly where it was. It is **disabled until a row actually changes**: an open row you have not typed in is not unsaved work, and a ✓ that wrote the record back unchanged would be worse than no ✓ at all. **It sends ONE request carrying every edited field**, which is the entire correctness argument rather than an optimisation — each row PUTs the *full record* with its own field changed, so looping the rows means N full-state writes over the top of each other: in parallel the last reply wins, and in sequence each one still reads the record as it stood before the previous reply landed. Either way five of six edits vanish behind five toasts saying they were saved. Rows close only once the server agrees, like a single row does, so a refused save leaves what you typed on the screen. The rows also gained an **accessible name** on the editor itself while this was built: the label beside the pencil is a heading for the whole row rather than a `` for the box, so a screen reader landing in the editor had announced nothing at all. 
 
**The form is still a form.** The ✓ is a real `type="submit"` wired back by the HTML `form=` attribute, so `onSubmit` is unchanged and **Enter in any field still saves** — that attribute is what makes it the form’s *default button*, and a form with several text inputs and no default button does nothing at all on Enter. It greys out with the form’s own reason on it (a tooltip, so inside the five-word rule), because a header button cannot validate a form it does not contain.

### ViewToggle

*Defined in:* ViewToggle + ViewIcon — ui.jsx · .view-toggle-row / .vt-opt — index.css

The shared **Tiles / List / Table** switch — Library annotations and Catalogue dialogues offer the same three views through this one Toggle, its glyphs drawn by `ViewIcon` (also reused as IconGrid/IconList/IconTable).

### GenreFilter

*Defined in:* GenreFilter — ui.jsx

The shared genre picker (Library + Catalogue): **one Select** over every genre, with "All genres" as its first option. 
 
It was a strip of tactile chips — "All" plus as many genres as genuinely fit — sized by measuring each chip's rendered text width on a canvas against the row's leftover space, with the true overflow in a "More…" dropdown. 1.4.2 gave up on that measurement rather than tuning it a third time. The row it measured against holds a dozen other controls whose widths change as the data does (a long series name, a two-digit count), so the answer was right only until something else on the row moved — and the failure was ugly in a specific way: a chip clipped mid-word against "More…", which reads as a rendering bug rather than a fitted layout. Chips also ordered genres by frequency, so which ones were reachable without opening a dropdown changed as the library grew. A select has none of those failure modes, costs one tap for *any* genre instead of one for some and two for the rest, and is already how series, sort, group and shelf read on the same row — and how genre itself has read in the mobile filter sheet since 1.4.0. This is the desktop row catching up with it.

### ColorSwatches

*Defined in:* ColorSwatches — ui.jsx · .color-dot / .dot-* — index.css · categoryName / categoryHidden — theme.js

The six **colour categories** as a radio group — the one control every capture form, filter row and card shares. The **active** dot gains full opacity and an accent outline ring. 
 
**The ring is only drawn where there is something to tell it apart from.** It marks one dot out of six; on the collapsed picker, where the trigger *is* the chosen dot and the only dot on screen, it was saying "this one" to a row of one, so it is suppressed there and kept in the open list. The full opacity stays either way — that is what makes the chosen colour read as chosen rather than as offered. 
 
**It draws the reader’s names, not the colour words.** "Pick blue" describes a highlighter; the whole point of naming a category is that the picker then asks the question you actually have. An unnamed slot falls back to its colour word, so a fresh account reads exactly as it always did. 
 
**A hidden category is dropped from the CHOICES but never from a quote that already wears it** — the current value is added back into the list for exactly that reason. Hiding is about tidying a picker you have stopped using; a quote silently changing colour because of it would be the app editing your library to match a preference you were not thinking about it with.

### Features (1.16.x)

*Defined in:* FeaturesCard — Settings.jsx · SECTIONS / visibleSections / visibleTabs — routes.js · hideLibrary / hideCatalogue / hideQuotes / showAnthologies prefs

Which sections of the app a reader wants to see: the **Library**, the **Catalogue**, **Quotes** — and, since 2.0.0, **Anthologies**, which is the first row that starts *off* and is switched on by readers who compose rather than off by readers who do not. Not everybody keeps films, and a tab for something you have never used is a permanent invitation to an empty screen — until now the strip, the drawer and the phone bar were the same eight destinations for everybody. 
 
**Hiding is cosmetic, and the URL is what makes that checkable.** What goes is the DOORS: the four nav lists, the count tile on Home, the `＋`’s offer of that kind, the scope chips on Search, and the row in the shortcut sheet. Nothing else moves — the route still resolves, a bookmark still opens, the review deck still draws on the section, and every row stays exactly where it is. Turn it back on and everything is where you left it, which is a promise rather than a hope precisely because `parsePath` and `statePath` are not feature-aware and a test says so. 
 
**A content link is not a door**, and that is the line this feature is drawn on. A favourite on Home still opens the book it came from with the Library hidden; what it loses is the tile whose only job was “go to the Library”. Muting the thread from a thing to its source would strand four thousand highlights to spare somebody a tab. 
 
**One section has to stay, and it has to be one of the three.** Anthologies does not count towards it: an anthology holds quotes that live in the other three, so it is a way of reading them rather than a place to keep anything, and an app showing only Anthologies would still have no list to stand in. The client rule and the server’s 400 are both three-way for that reason, and they have to agree exactly — the card saves optimistically, so a client that allowed a set the server refuses would move the switch and revert on the next reload with nothing on screen saying why. An app with none has no list to stand in and no `＋` that offers anything — a broken screen rather than a preference, and the one state a reader could not click their way out of. The last standing switch is disabled with the reason in words beside it rather than in a `title` a phone cannot show, the server refuses the same set with a 400, and the read path corrects it — because a restored archive is where such a set would otherwise arrive from. 
 
**Every switch reads Show / Hide, and the stored key is spelled whichever way makes `false` that row’s default.** The rule is the zero value, not the word: `hideLibrary` / `hideCatalogue` / `hideQuotes` for the three that are on until somebody says otherwise, `showAnthologies` for the one that is off until somebody asks. A key defaulting to *true* would have to be added to the four whole-struct literals the Go suite compares with `!=`, and an older client sending a partial set would read as asking for that section to change. The polarity travels on the row itself (`off: true` in `SECTIONS`) rather than in a second list of the inverted ones, so `visibleSections` and the card’s writer each branch on it once. 
 
**Review scope is deliberately not gated by this.** Those chips name what the DECK draws from rather than where you can go, so hiding the Catalogue does not stop you being asked about a film line you saved — silently narrowing the schedule would be the opposite of cosmetic.

### Colour categories (1.7.0 · six since 1.7.1)

*Defined in:* ColourCategoriesCard — Settings.jsx · applyColors / categoryName / categoryHex / CATEGORY_PALETTE — theme.js · `--hl-1..4` · catName/catColor/catHidden prefs

A quote’s colour is the top of the hierarchy — tags say what it is *about*, the colour says what *kind* of note it is — and until 1.7.0 the four were called yellow, blue, pink and orange, which describes a highlighter rather than a thought. There are **six** since 1.7.1, arriving as **Fact**, **Disagreed**, **Inspirational**, **Funny** and **Meta** beside the unnameable default — all of them yours to rename. 
 
**The stored token never moves.** `yellow|blue|pink|orange` remains the value in every table, in every Markdown export and in the import rule that reads a missing colour as yellow. Everything here is presentation, which is why a rename cannot break a round trip — and why the Go suite has a test whose entire job is to prove a Markdown export is byte-identical before and after one. 
 
**The first slot is not a category.** The column default is yellow and an import with no colour writes yellow too, so a yellow quote may be yellow because somebody chose it or because nobody chose anything, and nothing can tell those apart. Naming it would silently relabel every unmarked quote ever imported, so the field is not offered, the server refuses it, and the read path scrubs it back out — because a restored archive or a hand-edited row is where such a value would come from, and the client is where it would be seen. Its *colour* is presentation and stays editable. 
 
**The palette is disjoint from the theme accents**, and not merely by avoiding the four exact hexes: the whole ochre / terracotta / olive / slate neighbourhood is left alone, so a category can never be mistaken for the app’s own accent. A test measures the RGB distance rather than trusting the eye, because "these look different enough" quietly stops being true when somebody adds a sixteenth swatch. 
 
**Adding one is a migration, never an edit.** `color` carries a `CHECK (color IN (…))` on *five* live tables — annotations, dialogues, utterances, staged_quotes and tags — and SQLite cannot alter a CHECK. Going from four to six in 1.7.1 therefore meant rebuilding all five, four of them foreign-key parents whose children cascade, three of them backing external-content FTS5 indexes with live sync triggers. `tags` is the one migration 0018 explicitly refused to touch, warning that the rebuild would take the join rows with it; it could not be left out, because `tags.color` is validated by the same allowlist the quote colours use, so widening one and not the other turns a green tag into a 500 on a valid request. 
 
The join rows are parked and restored rather than protected by a pragma — `PRAGMA foreign_keys` is a no-op inside a transaction and every migration runs in one. Sixteen mutations hold the rebuild in place, and one of them earned its keep by *surviving*: removing the FTS index rebuild changed nothing, because an external-content index keeps its own entries. That is the signal a line is either unnecessary or untested, and it was the latter — what it actually repairs is an index that had *already* drifted, which is what the test asserts now.

### SortableTh / useSort

*Defined in:* SortableTh + useSort — ui.jsx · .ann-table th.sortable — index.css

A clickable `` carrying the active sort's ▲/▼ arrow and `aria-sort`; **useSort** holds the {col, dir} state and sorts rows via per-column value functions. Shared by the table views and the tag/sticker manager tables.

### ExpandableText / ExpandableDescription

*Defined in:* ExpandableText / ExpandableDescription — ui.jsx · .clamp-more / .tp-link — index.css

Inline clamp with a WhatsApp-style coloured **show more / show less** toggle that appears only when the text actually overflows (a ResizeObserver re-checks as tiles resize). **ExpandableDescription** is the 3-line detail-hero variant using a `tp-link` toggle so the poster beside it keeps a stable height.

### HighlightSpan · hl

*Defined in:* HighlightSpan — ui.jsx · .hl — index.css

The search-match highlight — a `` with an accent-tinted, unevenly-rounded wash, used to mark hits in Search results.

### FavBadge

*Defined in:* FavBadge — ui.jsx

The non-interactive ♥ overlay on a favourited cover/poster corner — the tile itself is the clickable element, so this can't be a button. Hand-tilted (randWobble) and drop-shadowed to read over any artwork. Cousin of the interactive **Hearts** mark (see Marks).

### ReviewDot · IconRecall (3.1.0)

*Defined in:* ReviewDot / IconRecall / reviewStatus / RecallPanel / reviewKindOf — ui.jsx · .status-mark / .recall-* — index.css · GET /review/card · migrations 0064–0066

**How well a quote is held, drawn as a ring and how much of it is left.** Four states, mirroring `recallStatus()` on the server: *remembered* (a full ring with a centre dot), *forgetting* (the ring open at the top), *probably forgotten* (a quarter left, and a cross) and *not tested* (a broken outline — a card the Daily Quiz has never asked about). Hover names the state and gives the one number that matters at that moment: how long it keeps if it is holding, or that it is already owed a look if it is not. 
 
**It used to be a 9px disc, and that was the defect.** A disc that small has no shape, so its four states were told apart by hue alone — the one channel a reader may not have, and one this card already spends two controls away on the six quote colours. It also had nowhere to stand: a mark with no shape cannot join a row of glyphs, so it sat on a line of its own, which on a card with no credits is an empty row with a dot in it. It is the FIRST glyph of the card's action row now, on the owner's ruling — leading because it is the card's state rather than something you can do to the card, the same position a shelf chip takes on a work. 
 
**The colour stays and no longer carries the meaning alone.** Green, amber, red and grey agree with the drawing; the drawing is what says it. 
 
**And it is a control: pressing it opens the quote's recall history.** The owner's ask — *“when i click on the spaced repetition icon in the quote cards, it should show a popup for the halflife status, and recall history … like the infodots (this is not an infodot, btw, so will not be restricted by the budget)”*. So it wears the **InfoDot**'s popover — anchored beside the mark on a desktop, a centred sheet on a phone — and none of its copy answers to the help budget, because what it prints is this quote's own record rather than prose about a screen. The panel names the state, the half-life, when the quiz comes back to it, the review and lapse counts, and then one row per answer: the date, what you said, and the half-life that answer produced. 
 
**An answer that moved nothing says so instead of showing a number it did not earn.** Practice moves no schedule unless you have asked it to, and a skip never does — so a card you have practised twenty times can sit on the same seven days, and a history that drew those answers like the real ones would report a working scheduler as a fault. Those rows print *no change* where the half-life goes, and one sentence under the list says why. The log records it (`item_recalls.counted`, migration 0066) rather than deriving it, because whether an answer counted depended on a setting you can change tomorrow. 
 
**The verb lives in the mark, not in the screens.** This mark is drawn on four — a shelf, a film page, the Quotes board and a search result — and the repo's directive is that a control drawn by one component has one behaviour in one function. It takes no handler from any caller and works out which kind of quote it is standing on from the row itself (`reviewKindOf`: a highlight carries its book, a film line its film, and a standalone quote has neither, which *is* its kind). It asks the server on every open rather than reading the card underneath it, because the Daily Quiz moves the schedule without the list hearing about it, and a panel whose whole subject is *when did I last remember this* may not be the one surface showing yesterday's answer.

### QuizSkipMark (1.14.2)

*Defined in:* QuizSkipMark / skipReason — ui.jsx · .quiz-skip-mark — index.css · migration 0033

**The struck flash card, on any row the Daily Quiz will not draw.** It is `IconQuizSkip` — the same glyph the *Skip in quiz* button wears in the selection bar and the card menu — so the mark on a card is a picture of the act that put it there. Drawn on the CREDIT line, beside the words that locate the quote, while the **recall mark** it qualifies leads the card’s action row. The two answer one question between them: the mark says how the recall stands, this says nothing is going to ask. Without it the mark on an excluded quote reads *due now* about a card the deck will never serve. They were side by side while the recall mark was a 9px disc; it is a glyph now, and a glyph belongs with the other glyphs — what stays here is the one of the pair that is a FACT about the quote rather than something you can do to it. 
 
**One flag decides, and the second only explains.** 0033 put the column on the quote *and* on the work, and had the deck drop a child whose parent was excluded — so a highlight could be barred by a flag that was not on it, and the control clearing the quote's own column reported *back in the quiz* about a card the deck went on refusing. The deck reads the quote's own column and nothing else now; excluding a work writes that column across its quotes and seeds the ones added later, so a skipped book still reaches its highlights, as a write you can see on the card rather than as a term in a query. The mark follows `review_excluded` alone — put one highlight of a skipped book back and it wears nothing, because the quiz genuinely will ask. The work's flag still picks the wording: *Skipped with its book* (or film, or show) rather than *Not in the quiz*, because that names where the decision was made, which is where undoing it for the whole book lives — and warns that the next highlight saved there starts excluded. 
 
**It appears on all four surfaces at once** — a book's highlights, a film's lines, a work tile, and every search hit — which needed the API to carry the parent's flag on the child rows and `review_excluded` on all five search hit shapes. That parent flag is ONE name, `work_review_excluded`, shared by both quote kinds, and the server's parity test is what decided it: spelled `book_review_excluded` beside `movie_review_excluded` it read exactly like `book_title` beside `movie_title` and would have passed review as one, but every card would then read `book_x || movie_x` — and dropping one of the two is a mark that is right on books and silently absent on films. Search had been the one place a quote arrived without its *colour*, for the identical reason, and a mark that showed on every board and not in results would have been that bug again with a different field: invisible on any one screen, because each screen is internally consistent. 
 
**The `quiet` variant drops the tooltip and the focus stop**, for the two places the mark sits inside a `` — the work tile and the search hit. A focusable element nested in a button is invalid HTML and browsers disagree about which control a tap belongs to; and `Tooltip` binds its own long-press, which would have swallowed the tile's long-press-to-select on precisely the corner the mark occupies. The `aria-label` stays either way and folds into the button's name. On the tile it sits in the count row rather than over the artwork: three overlays already compete for those corners, and keeping the cover unobscured is why the shelf state is a bar and not a badge.

### ProgressBar

*Defined in:* ProgressBar — ui.jsx · .progress-track / .progress-fill — index.css

Determinate progress for long jobs (covers refetch, bulk people-link fetch): a recessed track, an accent fill, and a mono caption — visible movement instead of a dead "busy button".

### filter-chip-mobile

*Defined in:* .filter-chip-mobile — index.css (≤768px rules)

The touch-sized filter-chip variant used inside mobile sheets — same look, but the touch-target pass guarantees it 44px hit height on phones. (Renders as a normal chip at desktop width.)

### Filter row (WorkListScaffold)

*Defined in:* WorkListScaffold — works.jsx · leading / trailing / leadingMobile / trailingMobile · MobileSheet on ≤768px

One row, three screens. Library, Catalogue and Quotes render through the same scaffold, which owns the header, the counts, the ⬇ export, the empty and no-match states, the reset, and this row — so the three *are* the same screen with different data rather than three screens that resemble each other. A section appears when its setter is supplied and not otherwise: pass `setStates` and the shelf chips render, omit it and the row closes up, which is how Quotes (no shelf, no genre, no series) sits on the same scaffold without a wall of `null`s. Screen-specific controls arrive through **leading** and **trailing**, each with a mobile twin, because the desktop row is inline and the phone's is a labelled stack inside a **MobileSheet** with a live result count. **Filtering is client-side on all three** — Quotes moved off its server-side `?speaker=` to get here, and gained the fix that comes with it: the speaker list is built from every row, so choosing a speaker no longer collapses the list of speakers to the one you chose. 
 
**The credit select, and what a filter has to decide before it ships (1.14.2).** The Catalogue narrows by **actor** now, through a generic `creditNames`/`credit`/`setCredit` trio rather than an actor-shaped one, because the Library will want the identical control for authors and only the noun differs. The interesting half is not the dropdown. The rule this board follows is that *no filter ships without deciding what it means to a search* — the board publishes its chips as a search seed, so a filter is also a promise about what pressing Search will do. Two answers were available and they are not the same set. `movies.cast_json` holds the whole fetched cast; `dialogues.actor` holds the credit on each line you saved. The list row derives `actors` from the LINES, and that is forced rather than chosen: `actor:` in search reads `d.actor`, so a board built on the cast would filter to one set of films and seed a search that answered with another — a filter whose meaning changes on the way to the search box, silently, in the direction of MORE results, which reads as the search being broken. **It is deliberately not in `BOARD_ONLY_FACETS`**, unlike *tagged* and *noted*. The facet is dialogue-only server-side, so the Movies section of the results comes back empty — and that is the right answer rather than a compromise, because the client groups dialogue hits under their films, so a search seeded from a Catalogue filtered to one actor lands on the same films with the lines that put them there. Dropping the chip at the boundary would have thrown that away and searched the whole catalogue.

### GroupHeading

*Defined in:* GroupHeading — works.jsx · groupWorks / groupUtterances · PersonPortrait — people.jsx

The divider above each section of a grouped list: an optional **PersonPortrait**, the label, a count in accent mono, and a rule filling the rest. Given `onOpenPerson` the label becomes a button opening that person's panel — so an author heading in the Library and a speaker heading on Quotes are the same doorway the name on the card is. The buckets come from `groupWorks`, which splits a credit dimension into the people it names (a book by two authors appears under both) and files everything else under a residual bucket. Quotes names its own residuals — **No speaker**, **No kind**, **No place** — because a proverb has none of the four and a bucket called "None" would not say which.

### Group and sort (a board of quotes)

*Defined in:* AnnotationBoard / groupAnnotations / sortAnnotations / GroupSortField — Library.jsx · GroupHeading — works.jsx · ActionMenu / IconSortAsc / IconSortDesc — ui.jsx

A book's board can be put in order and cut into sections — **by chapter, by category, by tag, by date added** — and the grouping and the order are one decision made twice, so they are one control: "by chapter, in reading order" is a single thought and was three things to press. **The grouping is the field; the order is the row at the end of its menu**, stating the current order as its value so one press away is still one glance away. That row does not close the menu, because the column and the direction are two questions answered in one visit — and the two direction rows wear the bars that grow and shrink, so the picture IS the order rather than an arrow a reader has to remember the meaning of. 
 
**The order applies to every view.** It used to be the table's alone — clickable column headers — so the two card views, which is where a reader actually reads, had no order to choose at all and three hundred highlights sat in whatever order they were saved. 
 
**Each dimension is ordered by what it is, not by its name.** Chapters run in reading order (the number when there is one, then the named ones alphabetically), categories run in the order the swatches are drawn, days run newest first, and tags run by how many quotes wear them — which is why this is not `groupWorks`: that one orders buckets by label, which is right for a shelf of authors and wrong for all four of these. Missing values sink rather than float, always: a quote with no location is not "location zero". 
 
**Grouping is orthogonal to the view.** A section holds whichever view was chosen — list, tiles or table — because a control that worked in one view and silently did nothing in another would be worse than no control. Sections are windowed as well as their contents: a hundred small groups is still the whole book mounted.

### The board's settings, behind ⋯

*Defined in:* useScreenBar / buildScreenActions / ActionMenu — ui.jsx · quoteBody / TEXT_VIEWS / VIEW_KINDS — Library.jsx · begin — selection.jsx

A book's board publishes a SECTION into the screen's ⋯ rather than drawing a second overflow menu an inch under the shell's. Three groups: **View** (tiles, list, table), **Quote text** (both, quote only, translation only) and **Select quotes**. 
 
**The view left the header.** It was the widest control in the row and the one changed least often — you pick a view and read for an hour — so it costs a menu row instead of a third of the toolbar. **List came back with it**: the board always rendered three views and the toggle only ever offered two, so it was a setting a reader could hold and not choose. 
 
**Quote text is the one that is new.** A translated quote is two texts and the board always drew both. Asked for the translation alone, a quote that has none shows its own words — `quoteBody` prefers rather than obeys, because a setting that empties every untranslated card reads as a bug that has eaten the library. The table honours it too, which is the one view where the translation was never drawn at all. 
 
**Select quotes is the door that can be found by looking.** The other two ways into the mode — a long press, a Ctrl-click — are gestures a reader must already know. It starts the mode with nothing picked and then hides itself, since a row offering to start what is running is a dead control.

### The phone dock's menu keys (Home)

*Defined in:* DockMenu / HOME_TOOLS — App.jsx · IconSections / IconTools — ui.jsx · SECTIONS / visibleSections — routes.js

**The shell's own two seats, and they are the default everywhere** rather than Home's alone. The dock seats five and three never move, so the last two belong to the screen — and a screen with nothing of its own to offer used to publish nothing and get two blanks. These two are what is useful from anywhere: **the boards** this reader keeps things in (Library, Catalogue, Quotes, Anthologies, filtered by Settings → Features), and **the tools** about them (Settings, Stats, Metadata). The ☰ has held both lists all along; the point is that the drawer is at the top of a phone and the thumb is at the bottom. 
 
**Both glyphs are outlines, and the rail's for the same destinations are not.** The fill rule's exception is "the glyph names a PLACE rather than a job", and a key opening a list of four places is a control — the place is the row you press inside it. 
 
**The first key collapses.** With one section switched on there is nothing to choose between, so it becomes that section's own door wearing that section's own (filled) rail glyph, and no menu opens. 
 
**A screen may ask for the boards seat by name.** A board publishes its own filter in the first seat and `{ id: 'nav' }` in the second, which the shell swaps for the boards key above — only the shell knows which sections are switched on and only the shell can change tab, so the screen names the seat rather than building it. That is how the Library, the Catalogue and the Quotes page keep their filter and still get the way out; it is also what fills the second seat on Metadata, where a reader who is not an admin has one verb and used to have a blank beside it.

### Links — a work's, and a person's

*Defined in:* WorkLinks — workLinks.jsx · parseLinks / PROVIDERS — people.jsx · ProviderMark — ui.jsx · IconGlobe — ui.jsx

One row per link: the site's own **mark**, its name over the address, and a ✕. **The list is what is ADDED, not what exists.** There is no fixed roster with "not linked" beside half of it — a panel made mostly of absences decides for the reader which sites their record may have, and it is wrong about it: a novel with a film adaptation legitimately wants a TMDB page, and a game novelisation wants IGDB. 
 
**The globe is not a failure state.** "A web page" is a legitimate kind of link — a review, an author's own site, a scan somebody hosted — so an address matching nothing known is kept whole and wears **IconGlobe**. A dashed box or an error colour would tell the reader they had done something wrong by linking to the open web, and it is also why there is no WorldCat slot: an obscure catalogue is not a special case, it is just a URL. 
 
**The reading is shown before the link is added.** A key and a URL are one fact written twice, so the paste box says *"Reads as IMDb — www.imdb.com"* under what you typed: a field that silently transforms your input is a field you check afterwards every time. A scheme-less address is completed rather than refused, because copying out of a browser's bar drops it about half the time. 
 
**On a work, one screen holds the ids, the links and the paste box.** The section's pencil and the `+` at the end of its row both open it: every id the medium has, filled or not, then the stored links, then the box. Its one ✓ saves the edited ids and a pasted link in a single request and counts both; it is greyed while it would write nothing. A work with no links lands straight on the box, with no empty list in between. 
 
**And the box leads with the pages this record can already address.** A record pinned to TheTVDB *has* a TheTVDB page — the id is sitting in the row — so making the reader copy that address out of a browser is the app declining to do arithmetic it can do. One press appends it, wearing that site's mark, with the whole address shown first. It is derived from the record's own ids rather than being a roster of the twelve marks with "not linked" beside eight of them, which is the absence-list this panel exists to avoid; a site the record cannot address is simply not in the list, and once linked a site drops out rather than drawing as ticked. **AND AN ID CAN STAND IN FOR AN ADDRESS.** A reader holding a person's IMDb id still had to know the page is `/name//` and not `/person/` or `/people/` before they could paste anything — three words for one idea, and the app has known all three since it started fetching portraits. So the add surface also takes the id: pick the provider, type the id, and the address is written and shown before it is kept. Every pattern is copied from `internal/metadata/people.go` rather than derived, so a link typed by hand and a link fetched from TMDB are the same string. **The list offered is the record's own:** an ASIN goes to the author page and never to `/dp/`, because an ASIN names a product and would file a book under the person; and a studio or a publisher is offered IGDB's company space instead of the four person ones, because nobody has an IMDb `/name/` page for Electronic Arts. 
 
**Some sites are absent for reasons, not oversights:** Letterboxd and IGDB address records by *slug* while the row stores a number, a work carries no Wikipedia or Wikidata id at all, and an Amazon marketplace guessed as `.com` is a real page for a different edition — wrong in the way that looks right. The paste box below is unchanged and is still the way in for all of them. 
 
**The marks are masks, vendored, never hotlinked** — see `providerMarks.js`. Twelve brand hues in one panel would be the loudest thing on a screen made of paper, and a links panel that phones a dozen companies to draw itself is exactly the request this app promises not to make.

### BigField

*Defined in:* BigField — ui.jsx · beside InlineField

A Details row whose editor is a **sheet** rather than the row itself. Four fields keep one, and the handoff names each one's reason so that nobody adds a fifth by feel: a **description** is prose and editing it under a 44px label means reading it through a letterbox; **genres** are a token input with a filter list of their own; a **cover** is a grid of pictures with no text to type; **people** are not a value at all but a list of rows with roles, faces and actions of their own. 
 
**The affordance is one affordance.** This is **InlineField**'s resting row to the pixel — same label, same provenance tag, same pencil in the same place — and only what the pencil *opens* differs. The reader is not being asked to learn which rows are cheap; the size of the thing decides where it opens and says nothing about it beforehand. 
 
At rest it prints what is behind the door: the description itself, the genres joined, or the work's credited names followed by how many characters it has — the **names** and not a count, because "6 people" is a number you have to open the panel to understand.

### Slider (a handful of ordered stops)

*Defined in:* Slider — ui.jsx · Settings type dials · Metadata text order

A stepped range that **commits when the reader lets go**, not as the thumb passes. A native `range` fires a change for every step it crosses, so writing through on change means one save per step and a preference that briefly held four values on the way to the one that was wanted — which is why this is a component rather than a bare input. 
 
**The readout is the point of the stops.** It shows the value formatted through a locale key by default ("175%", "21 days"), and a `readout` given by the caller replaces it — for stops whose meaning is a *word* rather than a number. The Metadata screen's per-language rows are that case: four states saying how much of the original a card shows. 
 
**It lived in `Settings.jsx` and now lives here**, because a second screen needed it. A control drawn on two screens is one function both call, not a line each — which is the repo's directive and the reason the two would otherwise have drifted the first time either changed. 
 
**A slider only where the stops are an axis.** **SizeDial** beside it deliberately is *not* one: six scaling factors in a column of stacked labelled rows are wider than the label they belong to, so that setting is a **Select**. These four are ordered — each shows strictly more of the original than the last — and they get a column of their own in a table, where a master slider above them can push every row into line.

### Tally (a count and what it counts)

*Defined in:* Tally — ui.jsx · .tally / .tally-n / .tally-word / .tally-icon — index.css

A number with the glyph of the thing it counts. **Two shapes, one component.** Where there is room — a section subtitle, a subheader — the word stays and the glyph joins it (`showWord`), and that is where a reader *learns* that this drawing means a work and that one means a skip. Where the row is tight — a card caption, a console row already carrying a tick box, a cover, three action glyphs and a chip row — the glyph stands in for the word. The second only reads because the first taught it, which is why they are one component and not two. 
 
**The word is always in the name, drawn or not.** A glyph alone is a picture to a screen reader and nothing at all; `showWord` decides whether the noun is painted, never whether it is said. The whole tally carries one `aria-label` of "27 skipped", because the figure and its noun are one fact — met as two, they arrive either side of a fraction’s slash. 
 
**Red is for a count that is the problem**, not for emphasis: `tone="warn"` takes the danger colour on the figure *and* its glyph, since a red number beside a grey drawing says the number is the warning and the noun is neutral. A count of things the reader owns is never red. 
 
**A count whose noun has no drawing keeps its word**, and `a-count-wears-its-glyph.test.js` is the list of which those are and why — a measure in "characters" that means letters, a confirm dialog’s sentence, an `` that can only hold text.

### SectionTitle

*Defined in:* SectionTitle — ui.jsx

A card's heading: the name on the left at `--type-ui-17`, an optional **InfoDot** beside it, and a **right** slot for whatever the card acts on itself — a toggle, a count, a button. **The dot goes through the heading rather than beside it**, so the paragraph a card used to spend three lines on is one glyph on the line the reader is already looking at, and the card's first content is content. 
 
It lived in `Settings.jsx` and eight cards used it. The ninth — metadata sources — moved to its own screen, and a component two screens import is a shared component: importing it back out of Settings would have pulled that whole route's chunk into another one to draw an ``.

### Scroller (the edge fade)

*Defined in:* Scroller / useEdgeScroll — ui.jsx · [data-scroll-x] / [data-scroll-v] — index.css

A box that fades at whichever end still has content, and the fade is the **only** signal that a row scrolls — there is no arrow, no scrollbar and no counter. A button at the fade is the other affordance and a different promise: it opens the full set in a sheet. So a row may scroll, or open, or both, and a reader can tell which without trying. 
 
**It is measured rather than painted.** The hook writes `data-scroll-x` (or `-v`) as `start`, `end` or `both`, and removes it when nothing overflows — a gradient left permanently on would promise content to a row that has none, and one fade that lies makes every other fade in the app a maybe. A ResizeObserver on the box and its children, re-seated by a MutationObserver when the child list changes, is what keeps it true; all of it coalesces into one frame and is silent when nothing moves. 
 
**Sideways is 26px and downward is 1.6em**, and that asymmetry is the type rule in miniature: a sideways fade has to clear a thumb, which is the same size at every setting, while a downward one has to land on the last line, which is not. 
 
**Press-and-drag comes with it.** `overflow` alone is a touch-only affordance — a plain mouse has no sideways gesture — so the box also follows a press, with a drag past 3px swallowing the click that ends it, so pulling a row along never opens what you let go on. The listeners sit on the box and use pointer capture rather than on the document: nothing in the app listens at rest. *(This demo sets the attribute by hand so the fade is visible standing still; in the app the hook computes it.)*

## People

Authors and actors are clickable everywhere (`people.jsx`). Clicking a name opens a **redirect link menu** of that person's external reference pages — IMDb · TMDB · TheTVDB · Wikipedia · Open Library — auto-fetched on first open; bio/photo details sit behind a secondary view. The Metadata tab's **People console** manages the links in bulk.

### PersonName

*Defined in:* PersonName — people.jsx (default class .tp-link)

Renders an author/actor name as a link that opens that person's **Person panel**. It hands its caller the RECORD as well as the name — `{kind, name, person}` — because the panel is reached by id; where the chip has no record, `POST /people/ensure` files one and the press lands on the same screen. The click stops propagation so it works inside clickable cards.

### PersonPortrait

*Defined in:* PersonPortrait — people.jsx

The small round portrait (default 30px, ink-bordered, object-fit cover) beside a group-by heading or the modal title — renders nothing when the person has no saved image. (Placeholder circle shown.)

### tp-link-icon

*Defined in:* .tp-link-icon — index.css

A `tp-link` that carries a glyph. Two things it settles, neither of which a call site can: the icon set is drawn at 24px against 12.5px link type, so the svg is sized here in `em` and rides whatever size the link is set to; and **the underline moves onto the words**. Text decoration cannot be cancelled by a descendant, so a rule drawn under the glyph as well reads as a strikethrough across the whole control — which is why this pattern wraps its label in a `span`.

### Person panel

*Defined in:* personPanel — identity.jsx · usePersonOpener — personOpen.jsx · GET /people/{id}

The design pack's person screen, and what a credited name opens whenever the library HAS a record for it: every spelling the name files under, how it sorts, when they were born or the company was founded, the reference pages, and every work they are credited on. It is a **Panel** (see Shell), reached BY ID, and it is now the ONLY surface a credited name opens. 
 
**There is no second person screen.** `usePersonOpener` is the single router every `onOpenPerson` is given: a name with a record opens the record, and a name without one GETS one — `POST /people/ensure` files the row and its role and hands back the id. An older modal, reached by kind + name, used to take that second case; it is deleted, and a press that cannot be served now says so rather than opening anything. That routing existed in exactly one screen until 3.1.0: eighteen other call sites handed the credit their raw modal setter, so this screen was not missing but unreachable from all but two places, which looks the same from the outside.

### ProviderChips

*Defined in:* ProviderChips — people.jsx (tp-chip tp-chip-btn anchors)

The compact inline form of the same link set — one small `tp-chip tp-chip-btn` anchor per recognised provider. Shows a "—" microcopy when nothing is saved. With `marks` it draws each supplier's **ProviderMark** instead of its name, which is what the People console's row uses: eight suppliers spelled out was most of a row spent on a vocabulary the marks already say, and the word survives as the mark's accessible name and its tooltip. There is no Links column any more — the row's second content line is where they sit.

### PeopleConsole

*Defined in:* PeopleConsole — MetadataPage.jsx (Metadata tab)

Every author/actor referenced in the library, as **RecordRow**s — one per RECORD, not per spelling — with a role filter-chip switch, an issue-pill row, search, and bulk **Fetch missing** + **Re-verify saved** ghost buttons driving a **ProgressBar**. A row carries the portrait — pressing it opens the photograph full screen in a **Lightbox**, which is the one thing a picture can do that a panel cannot — the name as the door to the person's **Person panel**, then two content lines: the work and quote counts with the person's ROLES as glyphs beside them, and the suppliers as **ProviderMark**s with the works as pills bearing each work's cover or poster. Its tail is a fetch and a DELETE — and the delete is drawn only where the server would allow it, because `DELETE /people/{id}` refuses a record a work still credits; the row is sent the credit count and gates on that, so the glyph is never a press that 409s under a confirm promising the bin. The row action takes **one** glyph across both its words: `fetch` and `refetch` are the same act — go and get this person's photo and links — and the label flips only because the row already has some, so two drawings would claim the acts differ. Bulk fetch wears **IconMetadata**, the same arrow-landing-in-a-record the covers console uses, and Re-verify wears **IconFetch**, matching the works bulk bar — both go and ask a provider, which is what that glyph now means and what IconRefresh used to mean alongside two other things. This metadata is what the **Person panel** behind every clickable name draws; actor lookups need a TMDB key (Settings). Rows stay listed even when no longer referenced so stale metadata remains manageable.

### People · cast-row (2.2.3 · search + the panel tick 2.2.5 · both names lead somewhere 2.3.0)

*Defined in:* CastSection / CastRow — cast.jsx · .cast-list / .cast-row / .cast-face / .cast-names / .cast-character > button — index.css

**The screen three migrations of plumbing had been waiting for.** 0048 built `work_cast` and six routes to edit it and said in its own header that the screen was deliberately pending; 0049 and 0050 added the character image and somewhere to keep it, and `POST /cast/{id}/image` was written so &ldquo;a client may call this for every chip it is about to draw&rdquo;. No client ever did — so a library could hold a full cast with a TheTVDB art URL on every row and show the reader neither. Opening this panel is what finally asks: it fetches the character pictures that have a provider URL and no file yet, **one at a time and capped at twelve**, because twenty rows would mean twenty outbound connections from a self-hosted box the moment somebody opened a panel. 
 
**Two pictures of two different things, and they are not merged.** The character’s picture is the role in costume and belongs to the cast row; the actor’s is a headshot and belongs to the PERSON, shared by every work they are in. One control for both would be convenient and would make a global edit look local — changing Viola Davis’s photograph changes it on every film she is in — so the row shows both and the actor’s name opens their own panel for theirs. A row with no character art falls back to the headshot, which is what TheTVDB’s own site does. 
 
The face is **square-ish rather than round**, unlike every other portrait in the app, and that is the point: a round chip is a person, and half of these are a costume. Removing a row asks first, inline rather than in a dialog — a deleted provider row leaves a tombstone so a refetch declines to bring it back, which makes it less recoverable than it looks. 
 
**Setting a picture offers a search** (2.2.5), the way the person editor already did: there is no keyless portrait API, so a picture is a URL you paste, and asking somebody to go and find one without helping them look is the difference between a field and a chore. Searched by the ROLE and the work — &ldquo;Amanda Waller Suicide Squad&rdquo; finds the character in costume, where the actor’s name would find the actor, whose photo belongs on their own page. 
 
**A row that is open and typed into is saved by the panel’s &check;** (2.2.5). It cannot join the merged field patch — it writes through its own endpoint — so it registers a `save` with the same registry instead. Without that, correcting a character name and pressing the tick closed the panel and threw the name away, under a control that had just said it saved. **Both names are controls, and each leads to its own record.** Until 2.3.0 only the actor was a link, so both names led to the actor: the character was flat text and the only route to its picture was working out that the small round face to its left was a button. 2.3.0 made the character name open this row’s picture editor; it now opens **the character’s own page**, scoped to this work, which is what a reader pressing a character’s name is actually asking for. The picture editor has not moved — it is what the face beside it opens, which is where it always was. A row nothing has linked to a `characters` record yet keeps the picture editor on its name, because a link to a page that does not exist is worse than the affordance it replaces. 
 
**And the row says where it came from**, the way every field above the list does: `work_cast.origin` in four states, of which the middle one is the reason it is four and not three. A `provider` row is the supplier’s, untouched. A `corrected` row is the supplier’s and then edited by you — it keeps the *supplier’s* mark, because that is still where it came from and a refetch still owns its billing and its ids, and its label says you corrected it. A `reader` row is yours, in the accent. `removed` is a tombstone and is never in the list.

### CastCombo (2.2.3, was a <datalist> in 2.2.1)

*Defined in:* CastCombo — suggest.jsx · .cast-opt / .cast-opt-name / .cast-opt-other — index.css (over .token-menu)

The character box with the work’s own cast under it: **opens on focus**, filters on a substring as you type, arrow keys and Enter, and never refuses a name the cast has never heard of. **Ten rows on a desktop, five on a phone**, where the panel is drawn over the form it belongs to and a list of twenty covers the box being typed into. 
 
**A reversal, and worth reading as one.** It was a native `` on the argument that the browser’s own list is strictly better here — it filters, it does not steal a phone’s keyboard, it cannot refuse free text. Two thirds of that is still true. What the argument missed is that `` specifies almost nothing about presentation: desktop Chrome opens it only after a keystroke, so a reader who had typed nothing saw nothing and had no way to learn the list existed. For a memory aid that is the whole of its value — the box you open in order to be reminded of a name cannot require you to remember it first. The chapter fields keep the datalist, because none of that applies to a number you were about to type anyway. 
 
**The actor is in the row.** A film’s cast is twenty pairs of names and the half you remember is as often the actor’s, so a list of characters alone is one you have to translate before you can use it: typing &ldquo;robbie&rdquo; finds Harley Quinn. A book’s cast has no second column and the rows are one name wide. Enter only picks when a row is highlighted — swallowing it unconditionally would make the dropdown a trap on the control most likely to be the last thing typed before Save.

## Materials & physics

Tactile faces come from real texture tiles (grayscale, blended behind content) and the switches don't just *look* different — they *move* differently. Switch the **Aesthetic**/**Theme** above to see each surface change.

### card grain — paper / metal

*Defined in:* .hand-card::before, .film-frame::before — paper.webp (paper) · metal.webp (film) · `--grain-card`

Every card carries paper fibre (paper) or brushed metal (film), plus a fine `::after` dither that breaks up 8-bit banding in the low-contrast gradient. 
 
**.film-frame joined in 1.6.0**, and the absence was conspicuous: it was the only card primitive in the app with no tile, no dither and no answer to the aesthetic toggle, which is why the Catalogue was the one board whose cards wore nothing. Its own CSS comment had promised the material for three releases. Film posters were not cards at all — a bare bordered span with the card's shadow bolted on — and are hand-cards now, like the book covers they sit one tap away from.

### accent grain — leather / rubber

*Defined in:* ::before — fabric.webp (paper) · rubber.webp (film) · `--grain-accent`

Accent buttons, toggle/select thumbs and active filter chips share this leather (paper) / rubber (film) grain. The nav thumb overrides it with **wood** / **metal** to keep the shell distinct. 
 
**One scale, since 1.6.0.** The same fabric was tiled at 150px on a primary button, 130px on a toggle thumb and 120px on an active filter chip — three grains of one material on three controls that share a filter row and are meant to read as one family. `.btn-sticker` also stopped being the one accent control that ignored the aesthetic: it wore leather, an ink border and a −0.5° tilt under BOTH skins, so Settings, Profile, the work-detail pages and the tour showed tilted leather while every other screen showed level rubber — from one component.

### material tokens

*Defined in:* index.css custom properties

`--sel-scrim` — dark scrim over textured accent surfaces (.12 light / .2 dark) so the light active label reads.
 `--thumb-ease` / `--thumb-dur` — the slide: firm settle on paper, springy overshoot on film, rigid + quick for the nav.
 `--press-a` / `--press-a-dark` / `--press-r` — the press-bloom on `.tactile` / `.tp-btn` (radius + alpha of the depress ring); the nav sets these to 0 for no give.
 
 
**1.6.0 — tile scales, by role rather than by number.**
 `--grain-accent` (130px) fabric/rubber on any accent-filled control · `--grain-card` (300px) paper/metal on a card face · `--grain-shell` (320px) wood/metal on a shell panel · `--grain-shell-sm` (185px) the same tile on a bar · `--grain-scene` (420px) the backdrop. The three shell values stay different on purpose — the tile is a picture of a real surface, so a full-viewport backdrop and a 999px pill want genuinely different scales or the pill shows one blurry plank — but they have names, so the next surface picks a role instead of a number.
 
 
**And the inks.** `--on-accent` / `--on-accent-dark` — what rides ON an accent fill; the two hexes were restated verbatim in fifteen rules, fifteen answers to one question that agreed by coincidence. `--hl-1..4` — the four highlight colours, which existed in *four* places (this stylesheet, `ui.jsx`, StagingPage and StatsPage). Two remain and a test asserts they agree: a canvas cannot read a custom property, so the share image needs a real hex, and drift there means the blue you see and the blue you *share* are different blues. `.tp-scrim` / `--on-scrim` — the modal dim, previously written inline at ten call sites across nine files.

### sheen (was three utilities, 1.6.0)

*Defined in:* .sheen-raised — index.css, shared with .tp-select-panel and .token-menu

The "nothing flat" rule: a raised surface gets a vertical gradient rather than a single fill. 
 
It shipped as three utilities under the heading "every filled surface gets a vertical gradient", of which **one had a single call site and two had none at all**. A promise with no implementation is worse than no promise — it reads as a rule the next surface should follow, while every raised surface in the app was flat. The one that was used now also dresses the select panel and the token menu, which were flat `--raised` fills sitting on top of textured cards; the card and accent variants are deleted, because the card face is `.hand-card`'s own gradient and the accent face is the `::before` tile over the accent fill, and neither ever wanted a utility class.

### shell material (1.6.0)

*Defined in:* .topbar / .mobile-topbar / .mobile-sticky-bar / .mobile-sheet-header / .mobile-sheet-footer / .drawer / .mobile-dock — `::before`, wood.webp (paper) · metal.webp (film)

The shell is a different substance from the things sitting on it — wood under paper, brushed metal under film, the same tile `.nav-toggle`'s thumb wears. 
 
This rule used to name two surfaces, and its comment claimed they "were the only bare surfaces left in the app". They were not. The bar the drawer slides out *from* had nothing, and neither did the phone's top bar, the sticky page bar, or a mobile sheet's header and footer — so on a phone the drawer was wood and the surface it emerged from was plastic. Six surfaces, one substance. The prerequisite is a stacking context, since the tile is a `z-index:-1` pseudo-element: the two sheet surfaces were the only shell chrome that was `position: static`, and are relative now.

### the escape hatch (1.6.0)

*Defined in:* @media (prefers-contrast: more), (prefers-reduced-transparency: reduce) — index.css

There was none. Every texture here is a blended overlay, and `.grain-overlay` is a fixed layer at `z-index: 60` — *above* everything, multiplying over every glyph, every quote and every input on the screen. It is 5.5% opacity and it is the whole point of the design; for a reader who has asked their operating system for more contrast it is 5.5% of noise standing between them and the text, and neither of the two ways a person says so was honoured anywhere in the file. 
 
Both now drop every decorative layer to zero: the page grain, the scenic backdrop, the card tiles, the dither, the shell tiles and the accent grain. Nothing structural moves — borders, lifts, colours and layout are untouched — so what is left is the same app with the noise taken off, not a different one. This is the [access & reading comfort](Roadmap.md) section's high-contrast item arriving early, and it arrives with this release rather than that one because the alternative was shipping six more textured surfaces with no way to turn any of them off.

### preset-callout

*Defined in:* .preset-callout / .tex-paper / .tex-film / .dark-combo — index.css · Settings presets

The Settings preset cards preview their combo with **real texture grain**: paper fibre (`tex-paper`) or brushed metal (`tex-film`) tiled behind the callout; `dark-combo` flips the blend to screen for dark pairings. Its tile size derives from `--grain-card` and its dark opacity now matches `.hand-card`'s — a preview of a card was previewing it at a different grain strength, which is exactly enough to be invisible alone and wrong side by side.

### tab-panel entrance / reveal

*Defined in:* .tab-panel / .reveal(.is-in) — index.css · useReveal — ui.jsx

The two page motions: every tab switch replays a quick **roll-down** (fade + slight drop, keyed on the active tab), and sections carrying `.reveal` + the `useReveal` ref fade-rise in as they scroll into view. Both are **disabled on mobile** — ancestor transforms un-stick the sticky bars — and under reduced-motion.

## Media

Covers (books) and posters (movies) share one local store and one placeholder.

### placeholder (.ph)

*Defined in:* Placeholder — ui.jsx · kind="COVER" | "POSTER"

Shown at 2:3 when no image is stored.

### WorkCard (was poster-card)

*Defined in:* WorkCard — works.jsx · one component for both boards

A grid cell on either board: artwork in a **hand-card**, then title, credit and quote count. The status bar rides *inside* the card, directly under the artwork, so it reads as part of the card rather than a stripe floating below it — and the artwork stays completely unobscured, which is the whole point of a bar over a badge. 
 
Until 1.6.0 only a book cover got the card. A film poster sat in a bare bordered span with the card’s shadow bolted on, so the Library’s board wore the app’s material and the Catalogue’s wore a rectangle — on two screens built from this same component and reachable from each other in one tap. This tile was also named `poster-card` after a class that does not exist anywhere in the source, which is its own small lesson about hand-written documentation. 
 
**It has a context menu since 1.14.2, and the reason it did not is worth keeping.** The comment here read “no context menu — a work’s actions live in its detail header and in the selection bar, and a menu that opened on a gesture and offered nothing would teach the gesture and then refuse it”. Sound reasoning about a state nobody had noticed: what was empty was `actionsFor`, which stayed quote-only after `bulkActionsFor` grew a work branch in 1.11.1. So the bar could *Fill gaps*, skip in the quiz, edit and delete a book with exactly ONE thing selected, and the tile that one was selected from could do none of them — the precise asymmetry the registry exists to make impossible, invisible for three releases because every test walked item → bulk and never the other way. There is a test in both directions now. 
 
The menu leads with **Select**, the same as a quote card’s, so the gesture that asks “what can I do to this” is also how you start doing it to several. Everything under it runs through `useBulkOps` — the same hook the bar calls, with one id instead of forty — because two implementations of “skip this in the quiz” is how a card and a bar come to disagree about an act whose result the card then draws. **Delete asks once and does not ask you to type**, unlike the bar: the bar’s phrase guards a number you can misread over one shared Undo, and here the subject is the cover you just right-clicked. The dialog names how many quotes travel with it, because a cover gives no hint that twelve are attached. **Favourite is absent, and that is a constraint rather than a choice** — a work’s ♥ is a field of the full-state PUT, and a board holds the LIST row, which carries no description, no ISBN and none of the other credits; setting it from a tile would send the short row back as the whole book.

### cover-tile / cover-lift

*Defined in:* .cover-tile / .cover-lift — index.css · Library & Catalogue grids

Covers and posters lift on hover/focus — a spring translate + scale with a deepening drop-shadow (`.cover-tile:hover .cover-lift`). **Hover this tile** to see it.

### Cover

*Defined in:* Cover — ui.jsx · .cover-wrap / .book-detail-hero — index.css

The book cover image (locally served — remote images are never hotlinked), or the striped placeholder: a small list thumb, a `large` variant, and a `hero` variant that fills its sized wrapper at 2:3 for the detail header. On mobile the `.book-detail-hero` stacks — the `.cover-wrap` centres at 140px above the text.

### MediaBlock (3.2.0)

*Defined in:* MediaBlock — ui.jsx · .tp-media / .tp-media-pic / .tp-media-dims / .tp-media-verbs — index.css

A picture is not a field. **Cover** and **Photograph** used to be rows reading `none · ✎` that opened a grid the row could not preview; this is one object instead — the picture at a usable size, **its real pixel size stated underneath**, and the verbs that change it in a 2×2 grid at 36px, so it reads as one thing rather than a thumbnail that happens to sit near a toolbar. 
 
**The size is measured, not asked for.** It is `naturalWidth`/`naturalHeight` of the bytes the browser loaded, which are the stored file's because `/covers/{name}` is a plain `http.ServeFile` — the day that route learns a `?w=` variant, this line becomes a confident lie about the exact number a reader uses to decide whether to replace their cover. 
 
**The ink is a promise Fetch can keep.** Below the floor the line goes `--error`, and the floor is `COVER_MIN_W` — the same 500px the server's `lowResCoverWidth` uses to decide whether a refetch replaces stored art, and the same test Metadata's *low-res* gap counts. The design pack proposed 400×600; a height half would have inked a 600×500 cover red with nothing on the server willing to change it. `cover-floor.test.js` reads both sides so the two cannot drift. 
 
**Three states, one of them red.** No picture is `0×0 px` and inked — it is not usable either. A picture still loading, or one the page is forbidden to draw (a pasted URL from a host `img-src 'self'` excludes), states *nothing*: it has a perfectly good size this page cannot read, and zero would be a plain lie about it. 
 
**Shape carries the kind.** A portrait is round and judged on its shorter side (a round crop keeps that one); a cover is the rectangle and judged on width. A missing face is a silhouette, a missing cover is the `.ph` hatch, and they are not interchangeable. Only the rectangle has a caller in the app today — the portrait half lands with the person panel, so this page is where it is seen at all.

## Film pieces (film aesthetic only)

The dialogue list and the login card are built as a strip of film (switch the aesthetic to **Film** to see them best).

### film-strip

*Defined in:* .film-strip — index.css · Movies.jsx Dialogues, App.jsx Login

Container made of: **sprockets** (the perforation row), **edge-row** (the "TIPPANI · SAFETY FILM" margin), and the **frame-code** (the amber mono code, regenerated per mount).

### sprockets

*Defined in:* Sprockets — ui.jsx · .sprockets

The perforation holes. (This is "the sprocket".)

### edge-row / frame-code

*Defined in:* EdgeRow / FrameCode — ui.jsx

### film-frame

*Defined in:* .film-frame — index.css · Movies.jsx dialogue cards

One dialogue/quote card *inside* the strip — distinct from the **film-strip** container above. Sheened and lifted so the strip reads as stacked frames, not flat rectangles; long tokens wrap (`overflow-wrap:anywhere`) instead of widening the page. Unlike the strip it renders in both aesthetics — and since 1.6.0 it renders *differently* in each, with the card material, the dither and an aesthetic of its own: contact-sheet card stock under paper, a lit panel with the amber hairline under film. See **card grain** above. 
 
**Why a dialogue is sometimes this and sometimes a hand-card.** The frame belongs to the STRIP, not to the dialogue: on a film’s own page the lines are laid out as a strip with sprockets and edge codes, and a frame is what sits in a strip. In a mixed list — Home’s favourites, which interleaves book highlights and film lines in one column — there is no strip, and a dialogue is a quote like any other, so it wears the card its neighbours wear. That read as drift for three releases for a simple reason: until this one the difference was “a textured card” versus “an untextured rectangle”. It is now “a torn-edged card” versus “a square lit panel”, which is a difference you can mean.

## Backdrop

Two full-viewport decorative layers behind/above every screen (App.jsx).

### scene-bg

*Defined in:* .scene-bg — index.css (z-index −1)

The scenic backdrop: book-spines on shelves (paper) / film strips in a studio (film). Pure CSS gradients — no external image.

### grain-overlay

*Defined in:* .grain-overlay — index.css (top layer)

A faint paper/film grain over everything, including the auth screens.

## Shelf (1.3.0)

Where a work stands with you. Drawn **under** the cover, never over it — the artwork stays whole, which is the entire reason it is a bar and not another badge on the poster.

### StatusBar

*Defined in:* StatusBar — ui.jsx · SHELF_META / SHELF_BLUE (inline styles, no class)

A 5px strip beneath the artwork. **In flight** (reading / watching) it is a real progress bar filled to your position, with the unfilled track the same blue at 22% — so a barely-started book still reads as *reading* rather than as an empty slot. Every settled state is solid: there is no partial *completed*. **Blue** in flight · **amber** held · **red** given up on · **green** finished. `--accent` is deliberately not used for *reading* — it sits a few degrees from `--error`, and a bar you have to squint at to tell *reading* from *abandoned* is no bar at all. `radius` matches the artwork above (8 for posters, 0 for a book's own clipped card).

### ShelfProgress

*Defined in:* ShelfProgress / positionLabel — works.jsx

The track under a work's state chip on its detail, in the units the thing is actually made of. A show reads **E06/10 · S02/03**, a book **p. 128 of 320**, and a film — which has neither — falls back to the bare percentage. Both halves of a pair are zero-padded to the same width, two digits minimum, widening together past 99 (**E006/456 · S011/123**), so a column of these cannot rag. The percentage is not printed alongside a unit label: the label is more precise, and the bar is drawn from that percentage anyway.

### State chip · read count

*Defined in:* works.jsx — beside the hearts on a work detail

The state chip opens the rest of the lifecycle; **completed** is settled, and the only move out of it is starting again. Clearing back to untracked stays available everywhere, because a mis-tap should not be permanent. The **×3** chip opens the read log — one row per read, so a reread is history rather than an overwrite, and only *finished* attempts count. The log is **editable**: add a read that happened before you kept the library, correct a date, delete a mistake. The read still *open* is the one exception — it says **set above**, because it is what keeps the status and the log agreeing with each other, and finishing or abandoning it is already one tap away in the chip.

### HeroCounts (1.11.2)

*Defined in:* HeroCounts / countQuotes / minusQuote — works.jsx · .hero-counts — index.css

What a work is holding, said at the top of its own page — under the credit line, in the hero, on books and titles alike. The board below has always printed a count in its toolbar, and that toolbar is the wrong place to learn it from: on a phone it is inside the filter sheet, and on a desktop it is past the description. So &ldquo;how much have I got out of this book&rdquo; was a scroll away on the page whose entire subject is the answer. 
 
**The zero rules are the design.** The total always shows, because a zero total *is* the wishlist state and saying &ldquo;no quotes yet&rdquo; out loud beats an empty gap where a number goes. The other three vanish at zero — &ldquo;0 favourites · 0 noted · 0 tagged&rdquo; is a row of failures to report with nothing in it to act on. And `null` prints nothing at all rather than zeroes: a hero that flashes &ldquo;no quotes yet&rdquo; before the quotes land tells you the book is empty, briefly and wrongly, on every visit. 
 
**Counted off the UNFILTERED set**, which is why both call sites only recompute on an unfiltered load — the same rule the toolbar's own total has always followed. A colour filter must not be able to make a book look emptier than it is. The consequence is stated rather than discovered: a mutation made while a filter is on holds the last unfiltered values until the filter clears, and because this line and the toolbar's read the *same* state they are stale together and can never disagree with each other. Two counts on one screen quietly contradicting each other is the worse bug. `minusQuote` covers the one path that cannot wait for a reload — a single delete, which the board already decrements optimistically — and it subtracts what *that* row contributed rather than blanket-decrementing, so the breakdown cannot drift a little at a time. 
 
**Amber on the film side, by prop rather than by a page class** (`tone`): there is no page class to inherit, the Catalogue's credit line sets amber inline, and a terracotta total under an amber credit reads as two unrelated systems on one card.

### Wishlist folder (1.12.0)

*Defined in:* WishlistFolder — works.jsx · .wish-collage / .wish-cell / .wish-folder-tag — index.css

A library that keeps quotes accumulates books it has nothing from yet: a shelf photographed at a friend's house, an import that brought the titles and not the highlights, everything bought and not started. The triplet above already let you *browse* them. What was missing was a way to get them **out of the way** — forty unopened covers scattered through a grid of books you have actually read is forty tiles of noise between the ones you are looking for, and a chip only helps when the wishlist is what you came for. 
 
**It is a DOOR, not a place.** Opening it is the `wishlist` chip that already exists. Nothing moves, nothing is stored, and there is no membership that could disagree with the count printed on a cover — which is the same reason the wishlist has no column: a second source of truth for something already computable. A book leaves the folder by itself the moment you save a quote from it. 
 
**Drawn as a WorkCard is drawn**, at the same width and the same 2/3 aspect, because a folder wearing a different material reads as a control that wandered into the Library rather than as one of its tiles. The collage adapts to how many covers there are (one spans the box, two split it, three make an L): a 2×2 holding one cover and three blanks reads as a broken image rather than as a wishlist with one thing on it. A cover-less book gets an empty cell rather than the &ldquo;COVER&rdquo; placeholder — that placeholder carries its own word, and four of them inside one tile is the word printed four times at quarter size. 
 
**Not selectable.** A tick in its corner would have to mean &ldquo;select the twelve behind it&rdquo;, which is a different act from every other tick on the board and one the bar has no way to report a count for. **Ungrouped Library only**: inside the wishlist chip there is nothing to fold away from, and a Wishlist folder inside the bucket for one author would mean something different in every group it appeared in. **Off until you turn it on**, and then it stays on — a grid that silently rearranged itself on upgrade is a library that looks like it lost books.

### What changed (1.12.0)

*Defined in:* ChangelogList / inlineMarkdown — Settings.jsx · .cl-* — index.css · internal/changelog

**Out of the binary, not off the internet.** The Updates card has always linked to GitHub's releases page, and that link stays — it answers &ldquo;what is in a version I have not installed&rdquo;. This answers the other question, &ldquo;what is in the one I am running&rdquo;, and answers it with no network at all. On the hardware this app is built for — a NAS on a LAN, behind Tailscale, sometimes genuinely offline — that is the difference between a log and an empty one. It is also the only version of this feature that keeps the promise stated in three places: *nothing external is required to run*. 
 
**The running build is marked**, which is the one thing the GitHub link cannot tell you. A build made outside a release says so in a line at the foot rather than silently marking nothing. 
 
**It sits on the Server screen, not behind a door.** It was a dialog opened by a button called &ldquo;Changelog&rdquo; until v3, when the design pack gave it a group of its own at the foot of Server — the standing rule being that what is genuinely rare goes behind a door and what is merely detailed goes lower on the same screen. **Two releases stand at rest** and the rest are behind &ldquo;Read the whole log&rdquo;, which is also what stopped the list scrolling inside itself: as a dialog body it carried `max-height: 62vh; overflow-y: auto`, and on a page that is a bare nested scroller with no fade and no way out. 
 
**Only the newest is open.** Seventy releases expanded is a scroll bar with no landmarks in it, and the one people came for is at the top. The whole heading row is the fold's click target — a chevron alone is a 16px target on a 640px row — and the bullet is drawn by `::before` rather than `list-style`, so a two-paragraph entry keeps one mark at the top instead of a marker floating beside its middle. 
 
**Thirty lines of renderer, and it must not grow.** There is no markdown dependency in this frontend and no `dangerouslySetInnerHTML` anywhere in it. `inlineMarkdown` handles the three forms the file actually uses — bold, code, links — and shows anything else verbatim, which for a changelog is an honest failure: you see the asterisks. Links are refused unless they are http(s), by rule rather than by trust, because the rule costs a line. The multi-paragraph structure is preserved by the SERVER parser, since a naive line-splitter flattens a bullet's continuation paragraphs into it or drops them — silently, so the log just quietly says less than the file does.

### Translator & editor credits (1.12.0)

*Defined in:* PersonCredit — people.jsx · the book detail credit line — Library.jsx · migration 0034

A book carried exactly one credit from 0001 to 0034, and for a library built around reading in translation that is the wrong number: the Garnett Dostoevsky and the Pevear Dostoevsky are different books to read and were identical books to the schema. Both new credits are **real people** — the same portraits, lives, links, pages, renames and orphan sweep an author gets — and since 0027 one human can be an author on one book and a translator on another without becoming two records with two bios. 
 
**ROLE-LABELLED, unlike the author.** On a book's own page an unlabelled name reads as the author, so a bare second face would say the book has two of them. `tr.` and `ed.` in the mono voice, small, ahead of the faces. 
 
**WHERE THEY DO NOT APPEAR IS THE DESIGN.** Not in the Library — a tile has room for one credit and the cover is the tile's subject. Not on a quote's chips, because a quote is attributed to whoever wrote it. Not as their own categories in the stats. The list endpoint does not even *serialise* them, so the Library cannot draw them by accident, and a test asserts that absence: putting them on a tile later has to be a decision somebody makes against a failing test rather than a convenience nobody notices. 
 
**Nothing fetches them.** No provider reliably carries a translator, so neither re-verify nor fill-the-gaps will ever write one — what is there is what you typed. They are also deliberately outside the search index; adding a column to an FTS5 external-content table means dropping and rebuilding the virtual table, its three triggers and its vocab shadow, which is a real risk taken for scope nobody asked for. The People console finds them instead.

### Studio & publisher (1.17.0)

*Defined in:* the game credit line — Movies.jsx · `publisher` in MOVIE_FIELDS — WorkDetails.jsx · migration 0042

A game has two company credits and until 0042 it had one field, so the two facts took turns in it. Both suppliers wrote the developer where they could and *fell back to the publisher* where they could not — on the reasoning that a blank studio is worse than a slightly wrong one, which was true of a single column and stopped being true the moment there were two. The report that ended it was exact: *Mass Effect Legendary Edition* read **STUDIO Electronic Arts**. EA published it; BioWare made it. 
 
**The studio is who MADE it and the publisher is who PUT IT OUT**, and there is no longer any fallback between them. A game whose record names only a publisher shows a publisher and an empty studio, which is what the source actually said — the same principle 0041 applied to provenance, where a stale source line was worse than none because it is the interface asserting a fact in the present tense and being wrong about it. 
 
**They are drawn the same now, and that is a later decision.** Both are `people` rows — kind `studio` and kind `publisher` — both wear a logo where a film shows a director's face, and both chips open the company's own page: its founding, its links, and every work it is credited on. The publisher **used to be plain mono text** after the studio, and this entry used to explain why: it had no row, no logo and no page, and 0037's bar is that a new person kind must carry BEHAVIOUR rather than a label. 0042 named the condition for changing its mind — "if a publisher ever gets a logo and a page, it can become a kind then" — and it now has both, resolved by the same IGDB `/companies` lookup a studio uses, because that endpoint does not distinguish them: one company record, and which of the two it was on this game is a fact about the credit. `PUB.` survives as the label beside the chip. 
 
**Where the tie-break lives.** IGDB's `involved_companies` is a set of flag pairs in no meaningful order, and a label that owns the studio it published through is routinely entered as developer *and* publisher — which is how "the first row flagged developer" resolved to EA while BioWare sat further down the same array flagged developer alone. The company with the **narrower claim** wins. It narrows an answer and never blanks one: a studio that publishes its own game is named in both fields, because both are true of it. Wikidata's P178/P123 get the same rule, and its logo is read off the entity the *name* came from — otherwise the icon and the credit beside it would describe two different companies. 
 
**Nothing was backfilled, and it could not be.** Every game stored before 0042 holds either its developer or its publisher in one column and nothing records which; guessing would write the same wrong fact into a second column and give it the authority of having been migrated. A re-fetch under *Fetch metadata* is the remedy — the publisher is deliberately overwritten by a re-sync rather than preserved the way a hand-typed IMDb id is — and both fields are editable by hand, in the Details panel, the Add form and across a selection in the bulk editor. **Films and shows do not show it**, though the column is open to a distributor or a network if either is ever wanted — which is why the publisher's own queries carry no `media_type` filter where the studio's must: `movies.director` holds two facts split by medium and `movies.publisher` holds one; and it is outside the search index, because a fourth column on `movies_fts` means the drop-and-rebuild dance 0029 is the record of, bought for a field with one reader.

### Wishlist triplet

*Defined in:* works.jsx — the filter row, its own section in the mobile sheet

A work with **zero** quotes *is* the wishlist — derived, so there is no column, no bookkeeping, and it clears itself the moment you add a quote. The triplet browses just the unopened shelf, or hides it to leave only what you have actually marked up.

### Years, before and after the era

*Defined in:* ui.jsx — formatYear / parseYearInput, on every work

A negative year is written, not signed: `-380` reads as **380 BCE**, because a minus sign in front of a year reads as a countdown. CE is left unmarked — saying "1954 CE" about a novel is pedantry, and the era is worth naming only when it is the unusual one. The field also *reads* what it writes, so **380 BC**, **-380**, **c. 380 BCE** and **circa 380 BCE** all arrive at the same year. **c.** is an estimate and display-only: a text written over a century does not have a publication date, it has a contested guess, and marking it never moves the work on a shelf or a chart.

### Timeline

*Defined in:* StatsPage.jsx — a band under the superlatives · `.tl-dots` / `.tl-dot` — index.css

When the library’s works are *from*, as opposed to when they were saved — the activity calendar already answers the second. A quote sits at its work’s year, so a line copied out of the Analects last week belongs at 479 BCE. Readable as **decades**, **centuries** or **years**, because a shelf spanning two millennia and a shelf of films want different bucket sizes and neither is the right default for the other. The **empty** buckets are drawn deliberately: two columns side by side would read as two adjacent periods rather than two thousand years apart. Columns keep a minimum width and the band scrolls, so a narrow screen shows fewer of them rather than thinner ones. 
 
**A dot plot, not a stacked bar.** Each bucket draws two columns of dots from the same floor — **quotes** in the accent, **works** in the muted ink — and the two are never added together. Stacking them had put the quote counts, which are what the chart is read for, each starting at a different height, so no two buckets could be compared by eye; and the summed height it produced was a number about nothing, because a work and a quote are not two of the same thing. A **standalone quote is a quote and not a work**, so it raises one column and not the other. Both series share **one scale**, and a legend states what one dot is worth once a library is large enough that a dot has to stand for more than one. 
 
**The tick is a door, at decade scale only.** A decade with something in it opens that decade’s works in Search — the same click-through the activity calendar’s days and the breakdown rows have. Years and centuries stay plain text, and that asymmetry is the point: the search reads a decade exactly, a bare year cannot go through the query box at all (“1984” is a book somebody owns), and a century *would* be answered — wrongly, as its first ten years, and with nothing on the page to say so. A control that returns a confident wrong answer is worse than one that is not there. The labels are set in the UI face rather than the mono one for the same kind of reason: these are years, and a 0 that could be an 8 moves a landmark by centuries.

### Collapsed colour picker

*Defined in:* ColorMenu — ui.jsx · on a quote card, when the card is narrow

Six colour categories plus a heart plus the actions do not fit one line on a narrow card, so below a threshold the six dots become the current one with a chevron, opening a list. The list is the point rather than a consolation: the categories carry **names you chose**, and six unlabelled blobs squeezed to fit are six things nobody can tell apart — so the narrow layout shows more than the wide one, not less. Decided by the width of the *card*, not the window, since a phone in one column and a five-column desktop board can hand the control the same space. 
 
**No selection ring on the trigger.** The ring exists to pick one dot out of six, and here there is one dot — the chosen colour, alone. It stays on the dots *inside* the open list, which is the case it was drawn for.

### Partial dates

*Defined in:* works.jsx — read log, and a person's Born / Died

Every level is a legal stopping point: pick a year and you have a year, carry on for a month, carry on again for the day. Stored as text and compared as text, because `YYYY`, `YYYY-MM` and `YYYY-MM-DD` sort correctly against each other lexically. "I read it in 2019" is a real answer, and padding it to January 1st invents a precision nobody has.

### Episode locator (1.3.0)

*Defined in:* dialogues.season / dialogues.episode — migration 0025

A film is one runtime, so a timestamp locates a line completely. A show is not: `01:12:40` says nothing without the episode it is 01:12:40 *of*. Shows only, and **null** is the only "unset" — **season 0 is a real season**, the specials strand, so S0E1 has to be storable and distinguishable from "no episode recorded". A season with no episode is fine; an episode with no season is refused, because it cannot be ordered against a numbered season. Sort order is season, episode, timestamp, id — with specials first and un-episoded lines last. Two occurrences of a recurring line in different episodes are **two quotes**, not one, since the occasion is part of what identifies a line.

## Pending imports (1.2.0)

Every import parses into a holding area and stays there — indefinitely, across sessions, books and films mixed together — until it is explicitly approved.

### Destination heading

*Defined in:* StagingPage.jsx — one group per work the quotes will attach to

Each heading says **where its quotes are going** — an existing title, or a new one — so a wrong guess is visible before anything is written. Recomputed on every read, because the library moves while quotes wait in the queue.

### Location formulae

*Defined in:* StagingPage.jsx · locformula.go

Arithmetic over the numeric runs inside free text, which is what a Kindle location-to-page division or a PDF page offset actually needs. `p.142` minus 5 is `p.137`; a range moves at both ends; leading zeros and thousands separators survive; clock values convert through seconds and come back with their original padding. Detection is by **value**, not by field. Formulae chain, and **reset** restores every row's as-imported snapshot — so one applied by mistake is undone rather than lived with.

### BulkBar

*Defined in:* BulkBar — ui.jsx · shared by Search, Metadata and Staging

One selection strip, three screens. In staging it does two things the live endpoints cannot: tags come **off** as well as on, and the work can be **retargeted across kinds** — book and film interchangeable — because a staged row carries both locator sets, so the move never destroys the ones the destination won't use.

### Pending badge

*Defined in:* App.jsx — the ＋ Add pill, the drawer, and a card on Home

A count on the ＋ Add pill, so a half-finished import is not forgotten. Staged quotes carry no FTS triggers and no review rows, so an unapproved import never turns up in search, never gets pulled into a quiz, and its tags never join your vocabulary.

## Help & density (1.4.0)

The app used to explain itself in standing prose — Settings card copy, drawer subtexts, microcopy under controls. Good writing, and a lot of it, and it is why some screens read dense. The rule now: a **label** (what this control is) and **state** (what is true right now) stay on the page; an **explanation** (why it exists, what the trade-off is) moves into an info dot. And every screen carries a **?** that lists its own controls.

### FilterChip · search scopes (1.11.2)

*Defined in:* FilterChip — ui.jsx · SCOPES — SearchPage.jsx · .tp-filter-chip.has-btn-icon — index.css

Six controls above a search box, which on a 320px phone is six words that do not fit. Both rows above are the same markup under the two values of `html[data-labels="off"]` — see **Button labels** for the mechanism, which this reuses rather than restating. 
 
**Books, Movies and Quotes borrow their own tabs' glyphs**, so a scope looks like the screen it searches. The two quote kinds with no tab to borrow from are the release's two new drawings: **IconHighlight**, a page with a marker's nib — deliberately not a page with three lines of text, which is IconDetails and means a record card — and **IconDialogue**, two bubbles, told apart from IconQuote by the *count* rather than by any detail: one bubble carrying filled quote marks is a quotation, two bubbles are an exchange. The scope row is the one place both are on screen at once, and there they are the two things they look like. 
 
**All keeps its word** at every width (`keepLabel`, and therefore no `has-btn-icon`, or it would be crushed to a glyph's width with its words still inside). It is the default scope and the way back from a narrowed search — not something to have had to learn a glyph for. A collapsible chip also carries its own **Tooltip**: with the words clipped, the bubble is the only label left, and a phone is exactly where the clipping happens.

### Button labels (1.6.0 · filter chips 1.11.2)

*Defined in:* html[data-labels] &#183; theme.js (applyLabels / labelsPref) &#183; .btn-label / .btn-label-fixed / .has-btn-icon &#8212; index.css &#183; LabelDensity &#8212; Settings.jsx

A button given an `icon` prop renders a **.btn-icon** glyph and wraps its words in **.btn-label**, and one CSS rule under `html[data-labels="off"]` clips that span &#8212; so a whole row collapses to glyphs with no JavaScript at any call site. 
 
**Clipped, not display:none.** The words stay in the accessibility tree, so an icon-only row still reads as "Edit fields, Move to" rather than two unnamed buttons, and no `aria-label` has to be bolted on and then kept in sync with visible text that might change. Every glyph also still names itself on hover, on focus, and on a 500ms long press. 
 
**What is allowed to collapse.** Only a button that opts in. `keepLabel` is the opt-out and works by having *no rule at all* &#8212; primary submits and destructive confirms take it, because a glyph is something you have to have learned already and "delete everything on this server" is not a thing to find out by trying. Note which condition sets `has-btn-icon`, the class that squares a collapsed button to 44px: it is `icon && !keepLabel`, marking a button whose words *can* disappear rather than one that merely has a glyph. Set on the wrong condition &#8212; as it was, briefly &#8212; a keepLabel button carrying an icon is crushed to icon width with its words still rendered inside it. 
 
**The setting** sits in Appearance beside the two cover-size sliders and, like them, is device-local rather than per-account: how much room a row of buttons has is a property of the screen you are looking at, not of the reader. Auto resolves against the same 768px breakpoint the CSS uses &#8212; words on a desktop, glyphs on a phone &#8212; and the override works in both directions, because both are real. 
 
**Filter chips answer the same question (1.11.2).** **FilterChip** renders the identical two spans, so the one clip rule already serves it &#8212; which is exactly why `html[data-labels="off"] .btn-label` is *not* scoped to `.tp-btn`. A chip row that collapsed on its own measured width, or behind a media query of its own, would look identical the day it landed and disagree with every button in the app the day either was touched. All a chip needs of its own is the shape: 34px rather than a button's 44, because a chip is 34 at rest and squaring it taller would make the search screen's scope row stand higher than the controls beside it &#8212; and 44 inside the phone block, where the chips are already at thumb size and a 34×44 glyph is not a square. **keepLabel** works on a chip as it does on a button, and search's **All** takes it: the default scope and the way back from a narrowed search is not something to have had to learn a glyph for.

### InfoDot

*Defined in:* InfoDot — ui.jsx · `.info-dot`

A 16px circled *i* carrying the paragraph that used to sit under the control. It is a real ``, not a hoverable span: on a phone there is no hover, which quietly made "move it into an info dot" a non-answer on the device this app is built for. A transparent `::after` grows the tap target to 30px without moving any neighbouring text, and the click `preventDefault`s — these sit inside rows and labels that are themselves clickable, and asking for help must never also trigger the thing behind it. Second chip shows the open state. 
 
**How it opens, since 1.4.2.** On a pointer device, **hovering** opens it and moving away closes it: an explanation should cost a glance, not a click and then a dismissal. A **click pins** it, and a pinned popover stays until it is clicked again, because text you want to re-read or select must not evaporate when the mouse drifts. Reaching across the 12px gap into the card keeps it open — there is a 140ms grace period the card itself cancels, or the thing you were reaching for would close as you reached. On touch, a tap toggles, and every touch-opened popover behaves as pinned, since a tap is the only thing it has. An unpinned popover gets no click-catcher behind it, so a hover-opened card never swallows a click aimed at the page underneath. 
 
**And it carries no tooltip.** It had one until 1.4.2 — the dot's hover label read "About ISBN" — which on a phone was two mechanisms answering the same question: hold the dot to be told it explains the ISBN, tap it to be told what an ISBN is. The first is a label for a control whose entire content is a label. It only confused people.

### InfoPopover

*Defined in:* InfoPopover — ui.jsx · `.info-pop` / `.info-pop-anchored` / `.info-pop-centred`

What an info dot opens, and deliberately **not** the full-screen help sheet — that is right for a screen's whole glossary and absurd for one sentence. On a pointer device it is **anchored** to the dot: below it, flipped above when the bottom of the window is nearer, clamped inside the viewport, with a caret at the dot's own centre (`--caret-x`) because several dots often sit within a few pixels of each other and "which one was that" is a real question. On a phone it is a **compact centred card** over a scrim — a 40px anchor on a 360px screen gives no useful direction, and the finger is already covering it. Repositions on scroll in any ancestor, not just the window, since these live inside scrollable cards and sheets.

### Help button

*Defined in:* HelpButton / PageHelp — ui.jsx + help.jsx · `.help-btn`

A 44px "?" in the **top bar**, matching `IconButton` and `.tp-btn`'s minimum so it never reads as the odd control in a row. It opens the help panel for whichever screen you are on, resolved from the route (see `helpScreen` in App.jsx). It was drawn per screen until 1.4.1 — eleven call sites, in each page's own header — which made it a property of eleven pages instead of one thing in one place, and on a phone it competed for the single row a page title also needs. Two exceptions remain, both because the shell bar is not there: the **work-detail** screens put it in their ⋯ menu (that phone bar already carries a back arrow, a filter, a ＋ and a ⋯ , and a fifth 44px control would leave a book title about eighty pixels to live in), and the full-screen **Profile** page carries its own. In the phone bars it drops its ring and lets the glyph carry the affordance.

### Help panel

*Defined in:* HelpList / HelpSheet — ui.jsx · `.help-list` / `.help-row` / `.help-row-icon`; copy in help.jsx

One row per control: the screen's own glyph, the control's name, and what it does. The copy lives in **one registry keyed by screen** (`help.jsx`) rather than beside each component, so a control explained in one place cannot contradict itself in another — and each screen's list has the shell's own controls (☰ · ＋ · Search · the bottom bar · the avatar chip) appended, so the phone bars are explained wherever you happen to ask. Full-screen on a phone, a centred dialog on desktop: unlike a single-sentence info dot, a twelve-row list earns the whole viewport.

### InlineField

*Defined in:* InlineField — ui.jsx · `.inline-field` / `.inline-field-value` / `.field-icon-btn`

Read at rest, edit in place. Every field that used to live in a modal behind an *Edit* button and save with a *Save* one: the value reads as plain text with a pencil beside it, the pencil swaps in an input with ✓ / ✕ discs, and ✓ saves **that one field**. A blank shows its placeholder in italic `--faint` rather than an empty row. Two details that matter: **Enter does not save when the editor is a token list** (Enter is how you add a genre, and committing on it would close the row on your first tag), and a **failed save keeps the editor open with your text intact** — closing first is snappier and throws away what you typed the moment the request fails. Discs are 34px on desktop, 42px on a phone. Rows holding a **name or a title** (`nameCase`) capitalise the first letter of each word *as you type*, so the row saves the string you can see — and only ever promote, never lower-casing what you typed, so "McEwan" and "eBay" survive where the genre rule would return "Mcewan" and "Ebay". Re-case a word by hand and the field stops correcting you for the rest of that edit, which is what keeps "bell hooks" typeable. A row can also read as something other than its stored value: the **TMDB / TheTVDB id** rows show a link to the record they name rather than a bare number, while still editing as one — they spent a release read-only, on the reasoning that an id is written by picking a match, until it became clear a title search cannot tell two films of the same name apart and typing the id is the only way to say which you meant. The **IMDb id** joined them in 1.14.2 and is the odd one of the three: nothing is FETCHED with it, because IMDb has no public API. It is stored as `tt0111161` rather than as a number — the leading zeros are part of it, so a numeric column would give back a URL that 404s — and it accepts a pasted URL, because copying an address bar is how anybody actually gets one. A TMDB fetch fills it in from the `external_ids` appendix that rides along on the call the credits already needed, so it costs no extra request; a re-sync that finds none leaves a hand-typed one alone, since a supplier is the authority on what it knows and never on what it does not.

### Metadata merge (Details → Fetch metadata)

*Defined in:* MergeScreen — WorkDetails.jsx · `.merge-row` / `.merge-check` / `.merge-old` / `.merge-new`

The answer to "it fetched metadata and clobbered my author". A chosen match is no longer *applied*, it is **proposed**: every field it would change, yours and theirs, with a toggle you own. Fields you have nothing in are **ticked for you** — filling a blank is never a loss; anything already filled starts **unticked**, because overwriting what you typed is, so it asks first. Rows that would change nothing are not shown at all. Stacked rather than columned: the phone is the first target and two ~150px columns of prose turn a description into a ribbon. The old value strikes through only *while* its row is taken — that is the moment it is actually about to be replaced.

### ReadingBadge (redrawn 1.4.0)

*Defined in:* ReadingBadge — ui.jsx · `.reading-badge`

The open book / play triangle on a work you are part-way through. It used to be a bare blue glyph carrying a dark blur halo, which is the trick that fails at exactly the size it mattered: a halo is a soft gradient, so at the ~18px a phone cover gives it, it ate the thin strokes it existed to protect and the mark read as a smudge on anything but plain artwork. Now it is an **opaque disc** in the shelf blue with a white glyph and a hard rim — contrast from an edge that does not scale away, legible over busy art and pale art alike, and consistent with every other coloured chip instead of being the one thing with a glow. The rim flips light in dark mode, or a dark edge vanishes against a dark cover. 22px, growing to 24px on phones where covers shrink and this is the only in-progress signal.

### Greeting

*Defined in:* greetings.js — the Home header

Was `Good ${morning|afternoon|evening}`: three strings for 365 days. Now a pool chosen from what the **device** knows — its clock (six buckets, because "Good evening" at 23:50 and at 17:05 are the same sentence for very different moments), its date, and its IANA time zone. All local: no locale asked of the server, nothing sent anywhere, no network call. A date earns a place only if it is the **same Gregorian month and day every year** or computable from an exact rule (Easter's computus; "the fourth Thursday in November") — so no Diwali, Eid or Lunar New Year, which move yearly and differ by country in the same year. National days beat international ones on a shared date (25 December is Quaid-e-Azam Day in Pakistan), and commemorations say **Marking …**, never *Happy*.

### Textured nav surfaces

*Defined in:* `.drawer::before` / `.mobile-dock::before` — index.css

The two nav surfaces a phone actually touches — the ☰ drawer and the floating bottom bar — were the last bare ones in the app: every card, button, toggle thumb and select thumb already wears a tile, and these two read as plastic beside them. They take the **shell** material (wood on paper, brushed metal on film), the same tile the nav toggle's thumb wears, not the card material — the shell is a different substance from the things sitting on it. Same recipe as `.hand-card`: `isolation:isolate` plus a `z-index:-1` `::before`, so the grain sits above the surface's own background and below its content, and the blend flips to `screen` in dark mode where multiplying a grey tile just makes mud.

## Selecting several (1.10.0 · works and the long press 1.11.1 · the mode 1.11.2)

One selection mechanism over five kinds of thing, entered three ways, acting through one registry. The tick and the ring are the whole of the visible mode — there is no button to get *into* it. There is now one to get out of, and it had to exist: the mode outlives the picks, so emptying the selection no longer tears the bar off the screen.

### PickMark · is-picked

*Defined in:* PickMark — ui.jsx · .card-pick / .card-pick-mark / .is-picked / .is-selecting — index.css

A drawn tick over a **real, visually-hidden checkbox** — role, checked state, label and tab order all kept, because a div with an onClick would look identical and announce nothing. One drawing for every board: a quote card, a book cover and a film poster are three very different rectangles, and a selection that looked like a checkbox on one and something else on another would be two affordances for one idea. 
 
**When it shows.** On hover on a pointer, like the colour dots and the copy/share pair, and standing on *every* card of a board with a selection running (`.is-selecting`) — the cards you have *not* picked are half the answer to &ldquo;what am I about to act on&rdquo;. It no longer stands permanently on a phone, which it used to: there was nothing to select with then, and a hollow circle on every cover for a mode nobody had entered is a lot of furniture for an affordance the long press now provides. 
 
**And on a touch screen the mode is the only thing that reveals it (1.11.2).** The hover and `:focus-within` reveals are gated behind `(hover: hover)`, because a tap leaves focus on the card it landed on — so a phone was keeping the dot lit on the card that had been long-pressed after everything was deselected, until a reload, which is the only thing that drops the focus. Nothing was selected and one card said it was. `.is-selecting` now tracks the *mode* rather than the count, which makes the pairing the rule: the ticks are up while the bar is up, and dismissing puts every one of them away together. 
 
**An accent RING rather than a fill** for the picked card: a quote card already carries a colour bar that means something else entirely, and tinting the paper would fight it — on the film aesthetic it would fight the frame. The ring is what you see from across the board; the tick is what you read up close.

### SelectionBar (glyphs 1.12.0)

*Defined in:* SelectionBar.jsx · bulkActionsFor — actions.jsx · .selection-bar — index.css

**Sticky, and that is the feature rather than a flourish:** selecting forty things and scrolling to check one of them must not lose the controls. The count is the only thing on screen saying how many are picked, and it is a count the bar can act on — the selection drops ids that leave the visible list, so the bar goes with them rather than reporting a number about nothing. 
 
**One bar, two very different selections.** A quote gets colour, tags, one seal across the lot, favourite, the quiz toggle and delete; a book, film or show gets fill-the-gaps, a shelf, set-fields, the quiz toggle and delete. A colour category is a note about a *quote* and a work has never had one; a shelf is a fact about a *work* and a quote has none. Which appear is decided by which callbacks the bar passes for the kind in hand, from the same registry the card menu reads — a bar offering something the menu does not looks completely normal on both screens, and the divergence only surfaces when somebody wonders why they cannot do to forty what they just did to one. 
 
**Delete is last, danger-styled, and the only one that asks.** It is unreachable by gesture: select, press Delete, then type what it will do. Over works the dialog says plainly that the quotes go with them. 
 
**The mode outlives the picks (1.11.2), and the two controls at the right-hand end are that distinction.** The bar used to render on `count > 0`, so taking the last card off tore it off the screen mid-task — &ldquo;these four are the wrong four&rdquo; cost a fresh long press to undo. It now renders on the *mode*: **Deselect all** empties the selection and leaves the bar standing, reading *no books selected* with every action disabled, and the **×** ends the mode and takes every tick on the board with it. Escape does the same, so the way out is not something you have to find. Zero is *spoken* in words rather than shown as a bare `0` — the badge reads `0`, dimmed and disabled, and its accessible name is *no books selected*, so the reason is carried where it can still be heard once the words are clipped; the actions are disabled rather than hidden, because a row that changes shape at zero is a row you have to re-read. The kind is *kept* at zero too — drop it and an empty selection of books would render the quote actions, since `isWorkKind(null)` is false. 
 
**A row of glyphs, and only three of them (1.12.0).** It shipped with four word-buttons and left 1.11.1 with eleven controls — colour dots, a tag field, a tag button, Seal, Favourite, a shelf dropdown, Fill gaps, Skip in quiz, Delete, Deselect all, ×. Every one was added for a good reason and none of them is the one that broke it, because nothing broke: it simply became, on a phone, a strip wider than the phone, one release at a time. Three stand in the row now — for quotes the colour, the &hearts; and the quiz toggle; for works fill-the-gaps, the shelf and the quiz toggle — and the rest fold behind a `&ctdot;`. 
 
**Which three is decided in `actions.jsx`** (`where: ROW | OVERFLOW`), not here, and a test asserts the count is exactly three: a fourth fits on a desktop and pushes the count off the screen on a phone, silently. The three that fold away have one thing in common — each needs something MORE from you before it can run. Tags need a keyboard, the seal needs a picture chosen, Delete needs a phrase typed. Standing open in the row, the tag field was the widest control in the strip and was open on every selection whether or not anybody meant to type into it; it asks in a dialog now. 
 
**The quiz toggle's PICTURE flips with its label**, which stopped being optional the moment the words came off. That label was doing two jobs — naming the action and reporting which way round the selection is — and a fixed glyph keeps the first and silently drops the second. It is the one place the icon set holds two drawings that are nearly the same picture on purpose. 
 
**Edit appears at exactly one**, in the `&ctdot;`, opening the same form the card's own `&ctdot;` opens. Pick a second and it is gone rather than greyed. **Set fields is its mirror** — two upwards only — so a selection never shows two ways to change the same fields, and neither is ever a dead control. **THE COUNT IS THE CONTROL (1.13.0), and the bar finally obeys Button labels.** It was built entirely from glyph-only primitives — `IconButton` and `MoreMenu`, neither of which rendered a `.btn-label` span — so *Show* had no name to reveal and *Hide* had none to clip. The one row in the app that ignored the preference in both directions, on the surface with the least room, where it matters most. Nothing failed: it looked right on a desktop, which is where it was built. Both primitives now take an optional `label` and render the same two spans `Button` does, so the existing collapse rule does all of it. 
 
The count moved into the glyph slot of that button: the number wears the same round 44px border as every control beside it, and clearing the picks is the obvious thing to tap. *Deselect all* is its word, standing on a desktop and clipping to the badge on a phone. That merged two items into one — a sentence saying how many and a worded button undoing it were one idea drawn twice — and it moved the pair apart: *Deselect all* and **×** side by side read as the same control twice, and the one that ends the mode is the one you reach for by accident. The badge is mono and tabular so it does not change width between 3 and 8, because a control that resizes as you tick things is a control that moves under your thumb. The `&ctdot;` stays nameless on purpose: *More* beside three dots is the same thing said twice.

### What a long press means (revised 1.11.1 · the highlight 1.11.2)

*Defined in:* useCardMenu — ui.jsx · .card-text / .card-menu-host — index.css

The plan this came from said &ldquo;long-press always means menu, with no exceptions&rdquo;, and put touch's way into a selection in a toolbar toggle. Both halves were wrong, and both only show up under a thumb. The menu on the press, plus `-webkit-touch-callout: none` on the card, meant a finger could not select half a sentence out of a quote — in a note-keeping app, which is the one gesture a phone has for reaching into text. And long-press-to-select is what every photo grid, file manager and mail app already does; a toolbar toggle is a thing you have to be told about. 
 
So the press splits by **where it lands**. `.card-text` marks the quote and the note — set by ExpandableText, FlowQuote and HandNote rather than by each card, because those *are* the prose everywhere they appear, and a card that forgot the class would be a quote nobody could copy from with no visible sign of it. A cover tile carries no `.card-text` at all: a poster is a picture, so every press that is not on a control belongs to the card. 
 
Right-click and Shift+F10 keep the menu, so nothing was lost — it gave up one of three triggers, and the two it keeps are the two a pointer and a keyboard use. A surface with no selection to enter (Home's favourites, the search modal) keeps the menu on the press too. 
 
**And it must not highlight anything on the way (1.11.2).** The same 500ms hold means two things to two systems and both are right: to this hook it is the gesture, to the browser it is the start of a text selection. So a press on a card's whitespace fired correctly *and* came up with a stray word shaded under the menu — nothing broken, and it looked broken. Two mechanisms fix it because they fail on opposite hardware: the stylesheet takes `user-select` off the card body behind `(hover: none) and (pointer: coarse)`, so the highlight is never drawn on a phone or tablet, and the hook drops any live range at the instant the press fires, which covers a hybrid laptop (it answers `hover: hover`, so the CSS never applies) and any browser that latches a word before the timer. Gated on the **pointer** rather than the width on purpose: a tablet at 900px has the gesture and a narrow desktop window does not, and the answer must not change when somebody drags a window. The clear runs only after a press has *fired* — never on a tap, never after a drag, and never on the quote, where no timer is armed at all — because eating a selection somebody made deliberately is the worse bug. 
 
**The page holds still, and the card says it is the one (1.14.2).** Both of those follow from the same fact: the menu is placed once, in script, at the *point the press landed* rather than being anchored to the card. That placement is right — it is what puts the list under the pointer and keeps it inside the viewport — and two consequences came with it that nobody decided. The page scrolled out from under an open menu, which on a desktop happened constantly because the wheel is under the same hand that just right-clicked: the menu stays pinned where it was while every card slides away, so it ends up hanging over some other card with its actions still belonging to one now off screen. So the body scroll is **locked** while a card menu is open, through the same refcounted lock every dialog uses. Locked rather than re-anchored on scroll, because a menu that chases its card is one you can drag around the screen with the wheel and it still leaves you acting on something you cannot see. And a context menu **names no target** — it is a floating list beside the pointer — so over a grid of near-identical covers, *Delete* was pressed on faith. The card now wears `.is-menu-target`: the **same accent ring a selected card wears**, because the two are the same statement (this is the card being acted on) and a second look for one idea is a second thing to learn. An outline rather than a border so nothing reflows, and not transitioned — the menu opens instantly, and a ring that fades in over 180ms arrives after the decision it exists to inform.

### Set fields · tp-warn (registry 1.16.0 · wired 2.2.3)

*Defined in:* SetFieldsDialog — SelectionBar.jsx · BULK_WORK_FIELDS / overwriteWarning — bulkOps.jsx · .tp-warn — index.css

One field, one value, across a whole selection of works — the series on five books in one press. 
 
**The whole feature was one argument wide.** The action has been in the registry since 1.16.0 with its label, its glyph and its single/bulk rule; the per-kind field tables and the overwrite warning were written beside it; and `/books/bulk` has taken every field a work has for as long. The bar simply never passed the callback, and the action reads `available: … && !!ctx.setFields` — so the menu item was absent, nothing errored and nothing logged. The registry test asserts the action EXISTS and the bar’s tests assert what the bar SHOWS, so neither could see it. 
 
**One field at a time, not a form of all of them.** A form of every field with a &ldquo;leave alone&rdquo; state per row is a form where &ldquo;I did not touch this&rdquo; and &ldquo;I meant to clear this&rdquo; look identical across forty rows. One named field and one value is a sentence you can read back before pressing it, and pressing it twice is how you set two. 
 
**The warning counts only what would be DESTROYED.** Filling a blank is not a loss, so a field that is empty across the whole selection says nothing at all; a field with values says how many rows and how many *distinct* answers are about to become one, because &ldquo;overwrites 12&rdquo; and &ldquo;overwrites 12 different answers&rdquo; are different sizes of mistake. `.tp-warn` takes the accent rather than the error red: nothing has gone wrong, this is what the button would do. Empty is a clear and stays offered — a bulk editor that can set a series but never unset one sends you back to forty forms for the mistake it just helped you make. It is offered over SEVERAL and never over one, where the work’s own form is strictly better. 
 
**A field whose column has no empty offers no blank** (2.2.5). `media_type` is NOT NULL and the server reads a blank as *Film*, so &ldquo;(none)&rdquo; under the words &ldquo;Empty clears the field&rdquo; converted every selected show and game into a film — the loudest possible edit made by the quietest possible control, under a sentence that was false. Such a field now offers no blank, promises no clear, and will not apply until a real value is picked. The overwrite warning is not an answer to that on its own: a reader who has just been told the field will be *cleared* reads it as the cost of clearing.

## The bin (1.8.0 · a page of its own 1.11.2)

Every delete is recoverable for thirty days. The row is really deleted — a JSON snapshot of its whole subtree is parked instead — so nothing else in the app has to know the bin exists. Since 1.11.2 it is a page at `/bin` rather than a card in Settings, reachable from the Settings tile and from nowhere else.

### bin row

*Defined in:* BinPage.jsx (BinTile — Settings.jsx) · .trash-list / .trash-row / .trash-label / .trash-expand / .trash-kind / .trash-contents — index.css

One row per DELETED THING, not per deleted row: a book and its forty quotes are one entry, restored whole. Anatomy: the kind as a mono label (doubling as the disclosure control where there is something inside), the title, and the two acts pinned right — **put it back** and **remove for good**. Under it, when it went, how many quotes travel with it, and whether a cover is being kept. Expanding lists the held quotes read-only, each keeping its own colour bar, straight from the snapshot the delete already wrote. **The two buttons do not hide until hover**, unlike every other repeated row in the app: this is the screen you open because something has already gone wrong, and a control you have to find by pointing at it is one you hunt for while wondering whether the feature exists. 
 
**Why it is a page now (1.11.2).** It was a card in a three-column grid, and a card is a control panel: a label, a control, done. This is a LIST of unbounded length whose rows expand, and in a ~300px grid column beside Devices and Updates it had to say what an entry was, when it went, what travelled with it, and when it is due to go for good — so it said three of those and dropped the fourth. The page carries all four, adds the kind's own glyph beside the mono label, and gains kind-filter chips once there is more than one kind to tell apart (the same FilterChip the search scopes use, so they lose their words to the same preference). 
 
**It is in no tab list, on purpose.** Nothing about the bin is a place you go; it is a place you are sent — by the tile in Settings, or by an Undo that expired before you noticed it. A ninth entry in the strip for &ldquo;things you have deleted&rdquo; would be a standing invitation to browse your deletions beside Library and Stats. But `/bin` is a real route, so it bookmarks and survives a refresh, which is what a page buys over a modal. `routes.test.js` asserts that asymmetry in the direction that could silently stop being true: `bin` is in ROUTE_TABS and in none of the four nav lists. 
 
**Still read-only, and the due date is still a DATE.** The server's `snapshotContents` flattens a payload to the quotes a reader would recognise rather than shipping every column of every row, and a page instead of a card is not a reason to hand over a database dump because somebody clicked a chevron. The expiry is printed as a date rather than a countdown because the purge clock runs on server time and only while the server is up: an instance switched off for a week has not spent a week of anybody's thirty days, so &ldquo;gone in 3 days&rdquo; would be a promise nothing here can keep.

## Stray marks (2.2.0 · answerable 2.2.1)

What a page left in a quote that nobody typed. A page at `/cleanup`, reachable from the Settings tile and from nowhere else — the bin's shape exactly, and for the bin's reason. Eight rules are run over every quote, note and translation on every visit; nothing about a finding is stored, and the only thing written down is a &ldquo;no&rdquo;.

### stray-mark row

*Defined in:* CleanupPage.jsx (CleanupTile — Settings.jsx) · cleanup.go / cleanup_fix.go / cleanup_apply_handlers.go · .cleanup-list / .cleanup-row / .cleanup-finds / .cleanup-snippet / .cleanup-after / .cleanup-arrow / .cleanup-answers / .cleanup-kind / .cleanup-work — index.css

One row per QUOTE, and inside it one line per FINDING — which is one rule on one field, with a count rather than one line per match: a page's worth of double spaces in a long quote is one decision. Anatomy: the kind and where the quote lives, then per finding the rule's name, which text it was in, **the snippet with the find marked in guillemets**, **what it would become**, and the two answers. 
 
**The marker is the evidence.** Half of these rules find something with no appearance at all — a non-breaking space, a zero-width space, a soft hyphen — so a snippet that only showed the text would say nothing; the guillemets are what make &ldquo;there is something here&rdquo; visible. The CSS keeps whitespace rather than collapsing it, which is what makes two spaces look like two, and the arrow line is set in the same face for the same reason: the difference between the two lines has to be the only difference. 
 
**Accept and Ignore, one finding at a time (2.2.1).** Accept rewrites that field by that rule and nothing else — the server applies the rule itself, so a client cannot hand this page a string to store. Ignore takes the finding off the list, leaves the words untouched, and is *remembered*: it is keyed on a fold of the exact spans the rule matched, so accepting a different finding on the same quote does not revive it, while editing those very words does. There is deliberately no accept-all: a press that rewrites five hundred fields with their diffs scrolled past is the control this page's own design note argues against. 
 
**Two buckets, one scan.** *To answer* and *Ignored (n)* are two partitions of one server-side walk, so the counts cannot disagree; the Ignored bucket offers *Offer it again* and no Accept, because a finding you have refused is not one you are being asked about. A rule with no SAFE rewrite shows its finding with no Accept at all: `reference-mark` and `pronunciation` are in that state on purpose, because a letter followed by digits is a footnote index in `conscience12` and a name in `Apollo11`, and two slashes with text between them are a fraction or a URL as often as they are IPA. 
 
**In no tab list, and no badge anywhere.** A standing count beside Library and Stats saying how much may be wrong with your library would make a permanent accusation out of an import somebody did once. The tile in Settings says it instead, in a place you came to on purpose.

## Saying which field you meant (1.14.0)

A colon in the search box turns the words before it into a *field*. The syntax lives entirely on the client — the server has never heard of a colon — because a grammar both halves parse is a grammar that drifts, and the drift shows up as a query that renders one way and matches another.

### The facet dropdown & chips

*Defined in:* SearchBox — SearchPage.jsx · facets.js · GET /search/vocabulary · .token-menu / .token-pill — index.css

**It is the dropdown you already know.** Same anchored portal, same `.token-menu` skin, same arrows-and-Enter as the tag fields on every edit form — and choosing a value **lifts the token out of the box into a chip**, exactly as TokenInput lifts a typed tag into a pill. The only new idea on the screen is the colon. 
 
**The vocabulary is one request, on first focus, held for the session.** A personal library's is a few hundred names: too small to be worth a round trip per keystroke, and filtering it in the browser never flickers behind the typing. A vocabulary that will not load is an empty dropdown rather than a broken box — the grammar still parses and the chips still work, you are just not offered the values. 
 
**The draft runs to the end of the string**, not to the next space, and that is the one parsing decision worth arguing with. Splitting on whitespace is the obvious way to find &ldquo;the token being typed&rdquo; and it makes `author:Le Guin` unreachable: the space after *Le* ends the token and the draft stays `author:Le` forever. Since choosing a value lifts the whole thing out immediately, a draft that runs to the end costs nothing. 
 
**It ranks rather than filters.** A prefix — of the whole value or of any word in it — beats a substring, which beats a typo correction. A flat &ldquo;prefix or within budget&rdquo; test would return both in vocabulary order and let the fuzzy match win by accident of sorting: `deth` would offer *death* above *dethrone*, when you can always type one more letter to reach the former and cannot type your way out of a list that reordered itself. 
 
**A chip shows a word and sends another when they differ.** The six colour slots are user-named, so the chip reads `colour:doubt` and the wire carries `colour=blue`; narrowing runs on the name, so typing `blu` finds nothing — the storage word is not what is on screen, so it is not what is searched. `book:` does the same with a title and an id. 
 
**A search made only of chips is a whole search.** Picking a value empties the box, so the ordinary shape of a chip-built query is no free text and one parameter — which is why `q` stopped being required. With neither, it is still refused: that is not a search, it is a request for the whole library. 
 
**And the grammar has a way out of itself.** Thirteen ordinary English words became operators the moment this shipped — `note:`, `series:` and `year:` are things a reader writes in a note, and &ldquo;author: unknown&rdquo; is a phrase somebody could well be searching their own library for. A backslash before the colon (`note\:`) keeps them plain: no dropdown, and the words are searched exactly as they read, because the backslash comes back off on the way to the server. Only the colon of a known field is affected — a backslash anywhere else is a character the reader typed and means to find. Without it those phrases would be unsearchable, and unsearchable *silently*: the box would open a dropdown and the words would never reach the query.

### Why the rule depends on the field

*Defined in:* searchFacets.where — internal/httpapi/search_facets.go

A quote has ONE colour. `colour:doubt colour:joy` under an all-AND rule means &ldquo;has two colours&rdquo;, which nothing does — so that query returns nothing forever and reads as *broken* rather than as *empty*. Under an OR rule it means &ldquo;either&rdquo;, which is what you would say out loud. 
 
Meanwhile `tag:stoicism tag:death` **must** intersect: narrowing by a second tag is a real question in a quote library, and OR would widen it — the opposite of what pressing a second chip is for. One rule cannot serve both, so the rule is a property of the facet. 
 
**Credits are in the OR family even though they look like tags**, because a book has one author line. `author:Gaiman author:Le Guin` under AND would be the colour failure again — nothing is by both. A co-written book still turns up for `author:Gaiman` alone, because the match is a substring of the joined credit rather than an equality. 
 
**A facet a row cannot answer EMPTIES that section rather than being ignored.** `colour:doubt` asks for doubt-coloured things and a book is not one, so the Books section comes back with nothing. Ignoring it instead would put the whole library under a heading claiming the results are doubt-coloured: every row real, nothing raised, an answer to a question nobody asked. For the same reason an unknown field name is *refused* — a dropped facet returns a wider set that looks exactly like a correct answer. 
 
**No facet value ever reaches the full-text index.** Facets are ordinary parameter-bound predicates on ordinary columns; only the free text reaches FTS, exactly as it did before.

### Context, and the globe that turns it off

*Defined in:* searchScoped / openSearch — App.jsx · publishSearchSeed — facets.js · IconSearchGlobe — ui.jsx

**A search started from a shelf searches the shelf.** The top bar's Search has landed scoped to where you were since 1.4.1; what it could never carry was the FILTERS. The board knew it was showing you *reading, Fantasy, Earthsea* and the search it opened knew none of it. It arrives as chips now — and from a work's own page, as that work. 
 
**Every seeded chip is removable, which is the whole bargain:** narrowing is free because widening is one click. 
 
**The filter sheet and the chips are one state.** The Library's nine filter states and the Catalogue's ten are one chip list each, so *Reset* is emptying a list rather than enumerating nine setters, and a filter cannot be added to a board without deciding what it means to a search. Three of them stop at the boundary: a board's *tagged* and *has notes* are properties of the WORK derived from its children, while `tag:` and `note:` are properties of the quote — sending one as the other would empty the books section and a search from a filtered board would come back with nothing. 
 
**The globe is for readers whose every search is a search of everything.** Right-clicking the search button toggles it and it stays toggled. In the lens rather than beside it, because the thing being said is not &ldquo;there is a mode&rdquo; but &ldquo;this glass is looking at everything&rdquo; — an equator and one meridian, since at 28px a third line is a smudge and the silhouette has to stay the search icon's. 
 
**Right-click only, with no on-screen affordance, and that cost is accepted.** A visible switch would be a permanent control in the busiest row of the app answering a question most readers never ask. The globe is the feedback: once it is on, the button says so every time you look at it. The phone's bar follows the preference and cannot change it — there is no right-click there and long-press is already the tooltip's — so the one place that can flip it is the one place the gesture exists. 
 
**Tooltip had to grow an opt-out for this**, since it wraps every control in the app and swallows right-clicks whole. The opt-out ADDS to the suppression rather than skipping it: `preventDefault` still runs, propagation is stopped for the opted-in control, and the handler is called last, once the event is safe.

## Icons

Every glyph the interface draws, and the one rule that decides whether it is drawn or solid.

### the wireframe default

*Defined in:* iconStroke — ui.jsx · fill none · 1.85 · the 24 grid

**The app is drawn, and stays drawn.** Every glyph spreads `iconStroke`: no fill, a 1.85 stroke, round caps, on a 24 box. Swapping the whole set to a filled pack would double the ink on every screen to fix a problem the app does not have. A **key** — tick, plus, close, chevron, three dots — is a pen mark with nothing inside to fill; a **letterform** — translate, the question mark — becomes a blob at 19px. Neither qualifies for the exception below, and `icons-fill.test.jsx` fails a glyph that fills without naming its reason.

### filled — the exception, and its four reasons

*Defined in:* iconFill — ui.jsx · Phosphor Icons, MIT · 19 glyphs

A fill has to argue for itself, and only four arguments count. **1 — it is the ON state of a pair** (the favourite; the three shelf marks). **2 — the glyph names a PLACE rather than a job**, which is the whole rail: solid says &ldquo;somewhere to go&rdquo; before the word beside it is read, the same thing the shell says one step later when the active row wears an accent fill. **3 — the subject is a silhouette in life**, where an outline at 19px turns the shape into a ring; the mortarboard is the case, and a face and a film reel were both rejected because each already sits inside something that supplies the ring. **4 — the fill carries information**, as the palette’s wells hold the category colours. 
 
**Each fill carries its own viewBox.** Phosphor draws every glyph to its own margins, so straight from the pack the film reel occupies 0.59 of its box and `users` 0.98 — thirteen tabs at thirteen sizes. Each is cropped to its own ink and sized so the long side is 0.82 of the box: uniform scaling, nothing stretched, the drawing still the pack’s.

### IconHeartOn

*Defined in:* IconHeartOn — ui.jsx · rule 1 · the ON state of a pair

The favourite, set. Phosphor `heart`. review.jsx flips this against IconHeart; before it, the label changed and the picture did not.

### IconHome

*Defined in:* IconHome — ui.jsx · rule 2 · names a place, not a job

The Home tab. Phosphor `house`. Nothing outside the rail drew it, so the tab’s own glyph became the filled one rather than gaining a twin.

### FieldSourceTag

*Defined in:* FieldSourceTag / ProviderMark — ui.jsx · .field-src / .src-mark — index.css · field_sources[] on GET /books/:id and /movies/:id · work_cast.origin on GET /{books,movies}/:id/cast

**Who wrote this field**, on the field's own row. A record is assembled — the ISBN came from the scan, the page count from Google Books because Open Library had the wrong edition, the description you wrote — and one *Source:* line for eleven fields cannot say that. It also makes Refetch an all-or-nothing gamble, which is why people stop pressing it. 
 
**Three states, genuinely different.** A supplier's mark means that supplier wrote it. The accent word means **you** did — `manual`, which the database treats as a real answer. **Nothing at all** means the field has no row, which is "we do not know" and is not the same as "nobody has touched it". 
 
**The mark is a CSS mask, never an ``.** Every mark is an opaque black shape painted over a `background-color`, so it wears the row's ink — `--faint` here — instead of arriving in its own brand colour. A dozen brand hues in one panel would be the loudest thing on a screen made of paper, and one file serves both themes. They are vendored, never hotlinked: a panel that phones a dozen companies to draw itself is exactly the outbound request this app promises not to make. Origins and licences: `docs/wiki/Provider-marks.md`. 
 
**Typing over a value re-sources that field to you**, in the same save (`PUT /books/:id`, `PUT /movies/:id`). Without it the tag lies the first time anybody corrects anything. 
 
**The cast list wears it too, and there it has a fourth state.** The credit fields carried their supplier from 0054 and the list drawn directly beneath them carried nothing, while `work_cast.origin` had held the answer since 0048 and no screen had read the column. A row can be `corrected` — seeded by a supplier and then edited by you — which is neither of the two above it: it keeps the supplier’s mark, because a refetch still owns its billing and its ids, and a `note` on the tag says you corrected it. That note reaches the tooltip and the screen reader rather than the row itself: a cast list is twenty rows deep and a word repeated on each is a word nobody reads. 
 
**And on twelve fields it is a BUTTON.** Pressing it opens what every source has for that one field — the value on the record at the top, then a row per supplier wearing its own mark — and taking one rewrites that field and nothing else. Re-verify cannot answer this and never could: it reports what has *changed*, and a description tagged TMDB has by definition not changed from TMDB, so the field you pressed is the one field its table is empty for. **Three kinds of field keep the plain label**, because a door onto an empty room is worse than a label: a supplier id (TheTVDB’s opinion of a TMDB id is not an alternative anybody can weigh), a picture, and a cast — the last two are panels rather than rows. A pressable tag wears a hairline ring at rest rather than on hover, since a touchscreen never hovers, and it greys while the panel’s master save is collecting: two writers on one record.

### IconChecks

*Defined in:* IconChecks — ui.jsx · rule 2 · names a place, not a job

The rail's **Checks** row. Phosphor `note-pencil` — a page being marked up, which is what that screen is: imports waiting to be okayed and quotes with something odd left in them. A tick would have promised the app had already decided, and a tray would have said only that things had arrived.

### IconBin

*Defined in:* IconBin — ui.jsx · rule 2 · names a place, not a job

The rail's **Bin** row. Phosphor `trash`, filled — and **IconDelete stays an outline beside it**, which is the whole point of the pair: one is a place things wait, the other is the verb on every row that can destroy something. Drawn alike, a row's delete button would read as a door.

### IconNavLibrary

*Defined in:* IconNavLibrary — ui.jsx · rule 2 · names a place, not a job

The Library tab. Phosphor `books`. IconBooks keeps the outline for the shelf and the search result.

### IconNavCatalogue

*Defined in:* IconNavCatalogue — ui.jsx · rule 2 · names a place, not a job

The Catalogue tab. Phosphor `film-reel`. IconReel keeps the outline where a film is the subject rather than the destination.

### IconNavQuotes

*Defined in:* IconNavQuotes — ui.jsx · rule 2 · names a place, not a job

The Quotes tab. Phosphor `quotes`. IconQuote keeps the outline for the five places a quote is the thing being acted on.

### IconNavAnthologies

*Defined in:* IconNavAnthologies — ui.jsx · rule 2 · names a place, not a job

The Anthologies tab. Phosphor `stack`. Stacked sheets: a gathering of lines that live somewhere else.

### IconNavTags

*Defined in:* IconNavTags — ui.jsx · rule 2 · names a place, not a job

The **Tags** section of the metadata console — it was a tab of its own until Tags moved in there. Phosphor `tag`. IconTag stays the label drawn on a card; this is the door to the list of every one of them.

### IconNavWorks

*Defined in:* IconNavWorks — ui.jsx · rule 2 · names a place, not a job

The **Works** section of the metadata console. Phosphor `shapes`, filled — a triangle, a circle and a square together. **There is no glyph for “a mixture of books and films”**: all 3,060 names in phosphor-icons/core were read, and the library has `books`, it has `film-reel`, and it has nothing that is both. IconBooks and IconReel are also already spent on the Library and the Catalogue, so borrowing either would tell a reader this section holds one kind when it holds two. `shapes` is abstract and leans on the word beside it; that is the cost, and it is smaller than naming one medium on a door that covers both.

### IconNavUsers

*Defined in:* IconNavUsers — ui.jsx · rule 2 · names a place, not a job

The **People** section of the metadata console, and user management. Phosphor `users`, filled. IconUsers keeps the outline for its non-nav callers.

### IconNavMasks

*Defined in:* IconNavMasks — ui.jsx · rule 2 · names a place, not a job

The **Characters** section of the metadata console. Phosphor `mask-happy`, filled. **It replaces a second drawing of a head:** People and Characters sat side by side in that rail wearing IconUsers and IconPerson, so the only thing telling two doors apart was the word under them. A mask is the one glyph in the set that says *a part somebody plays* rather than *a person*, which is exactly the difference between those two lists.

### IconRecords

*Defined in:* IconRecords — ui.jsx · rule 2 · names a place, not a job

The Metadata tab. Phosphor `article`. Nav-only, so the drawing was replaced rather than twinned.

### IconStats

*Defined in:* IconStats — ui.jsx · rule 2 · names a place, not a job

The Stats tab. Phosphor `chart-bar`. Nav-only, so the drawing was replaced rather than twinned.

### IconShareWhatsApp

*Defined in:* IconShareWhatsApp — ui.jsx · the share sheet's format row

WhatsApp, as a share destination. One of five marks the owner drew for the share sheet — two services and three file shapes, in one frame so no option reads as a different kind of choice. A 1088 box filled rather than the app's 24 stroked: the paths are as authored, because renormalising somebody's curve to fit a house viewBox is how a drawing quietly changes shape. Only `fill: currentColor` matters for theming, and it has it.

### IconShareReddit

*Defined in:* IconShareReddit — ui.jsx · the share sheet's format row

Reddit, as a share destination. See IconShareWhatsApp for why these five share a frame and a geometry the rest of the set does not.

### IconSharePlain

*Defined in:* IconSharePlain — ui.jsx · the share sheet's format row

Plain text — the format, not a destination. A speech bubble inside a bubble: what you get is the words and nothing else.

### IconShareImage

*Defined in:* IconShareImage — ui.jsx · the share sheet's format row

The quote rendered to a PNG. The only one of the five that produces a picture rather than text, which is why the frame holds a landscape and a sun.

### IconShareMarkdown

*Defined in:* IconShareMarkdown — ui.jsx · the share sheet's format row

Markdown. Three ruled lines in the same frame the plain-text and image marks use — the format that keeps its formatting, drawn as text that has structure.

### IconFetch

*Defined in:* IconFetch — ui.jsx · the owner's own drawing · every control that asks a provider

Go and ask the sources. Arrows coming down into a stem — data arriving from somewhere else, which is the one thing every caller has in common: test a metadata source, look a person up, refetch a portrait, re-verify a shelf of works. **This and the two below replaced one glyph doing three jobs.** IconRefresh sat on fetching, resetting and installing a release alike, and the owner named it: "it is not just this row that uses refresh as fetch. all popups use that for fetch. even the update uses a refresh icon." Three questions with one picture between them means the picture answers none of them. Same 1088 filled frame as the share marks and for the same reason — see IconShareWhatsApp.

### IconReset

*Defined in:* IconReset — ui.jsx · the owner's own drawing · eighteen callers

Put it back the way it was: a field before a lookup overwrote it, a filter sheet to its defaults, an item out of the bin, a whole Settings section. **This was IconRevert** and drew a hooked arrow; the name followed the drawing when the owner sent this one, because the app had two words for one act. Not to be confused with IconRestore — that is the backup box opened upward, which replaces the whole instance and logs everyone out.

### IconUpdate

*Defined in:* IconUpdate — ui.jsx · the owner's own drawing · Settings · Server

Install a release, and nothing else. A square being swapped for another — the app replacing itself. It is deliberately the narrowest of the three verbs: it appears twice in the whole app, and the reason it is not IconFetch is that checking for a release and fetching a portrait are not the same promise.

### IconJobs

*Defined in:* IconJobs — ui.jsx · Tabler `list` with `player-play` as its first bullet · Settings › Jobs

The queue. A list whose first bullet is a play mark and whose others are dots: one job runs, the rest wait their turn in the order they were started — which is the whole rule of the queue, said before the word beside it is read. It is the Jobs section's glyph in the rail and on the phone's index, and the glyph a count of running or waiting jobs wears. A stack of layers was the other candidate and lost, because layers say "several at once", which is exactly what the queue refuses to do.

### IconStop

*Defined in:* IconStop — ui.jsx · Tabler `player-stop` · Settings › Jobs

Stop a job. The rounded square every media control uses, unchanged from the pack. A job stops at once, leaves the item in hand untouched and is kept with its log, so this is not IconClose: nothing a Stop press touches is thrown away. It is drawn red, with its words kept, on Stop all and on a running job's row.

### IconRerun

*Defined in:* IconRerun — ui.jsx · Tabler `repeat` · Settings › Jobs

Run a finished job again. Two arrows chasing each other round a loop — the one "again" arrow that is not a circle. IconRefresh, IconReset and IconUpdate each turn round a centre and each means something narrower; a fourth circle meaning a fourth thing is the confusion the split of those three was made to end.

### IconRoleAuthor

*Defined in:* IconRoleAuthor — ui.jsx · Phosphor `pen-nib` · the people console's role chips

Author. **Eight roles wore four drawings until the owner chose this set.** An author wore the shelf of books that also means the Library tab, a director wore the reel that also means the catalogue, and studio and publisher wore the *same* company mark — so the one column whose job is telling roles apart was answering three of them with one picture, and the words underneath were doing all the work. The owner picked each: "author: fountain pen".

### IconRoleDirector

*Defined in:* IconRoleDirector — ui.jsx · Phosphor `film-slate` · the people console's role chips

Director — "the director cut board". Not IconReel, which is the catalogue's own glyph: a director and a shelf of films drawn alike on a screen showing both is the confusion this set exists to end.

### IconRolePublisher

*Defined in:* IconRolePublisher — ui.jsx · Tabler `news` · the people console's role chips

Publisher, and **it is a substitute** rather than the drawing asked for. The owner wanted a typewriter; no pack surveyed has one at this weight, so this is the thing a publisher puts out rather than the thing they type on. It replaces the company mark publisher used to share with studio, which is the confusion that mattered.

### IconRoleSpeaker

*Defined in:* IconRoleSpeaker — ui.jsx · Tabler `microphone-2` · the people console's role chips

Speaker — whoever a quote is attributed to when the work is a talk rather than a book or a film. "speaker: mic".

### IconRoleActor

*Defined in:* IconRoleActor — ui.jsx · the owner's own drawing, traced · the people console's role chips

Actor — the theatre masks. **Sent as a picture and traced to vector here**, so the fill IS the line: that is what tracing a line drawing produces, and stroking it instead would mean redrawing somebody else's picture. Verified against the source at 0.988 overlap rather than by eye, after a first pass came back as a solid block — the tracer reads zero as ink, and one path per contour leaves every hole filled in.

### IconRoleTranslator

*Defined in:* IconRoleTranslator — ui.jsx · the owner's own drawing, traced · the people console's role chips

Translator — a letterform from one script, a letterform from another, and the arrows turning between them: "the same glyph, but with two arrows (look it up)", then "the arrows need to be closer". Traced like the actor masks, at 0.990 overlap with the source.

### IconRoleStudio

*Defined in:* IconRoleStudio — ui.jsx · the owner's own drawing, traced · the people console's role chips

Studio — a studio light, and **the one of the three that is stroked rather than filled**: "studio light needs to be no fill". It is also the app's one glyph at a stroke weight other than 1.85, because a trace produces an outline of the ink and at 1.85 the head closes up; at 1.1 it still reads at 20px, where filled it collapses into a blob below 32.

### IconSliders

*Defined in:* IconSliders — ui.jsx · rule 2 · names a place, not a job

The Settings tab. Phosphor `gear`. Nav-only, so the drawing was replaced rather than twinned.

### IconNavSearch

*Defined in:* IconNavSearch — ui.jsx · rule 2 · names a place, not a job

Search as a destination. Phosphor `magnifying-glass`. IconSearch has thirteen other callers where it is the verb, and every one stays drawn.

### IconImport

*Defined in:* IconImport — ui.jsx · rule 2 · names a place, not a job

The Import tab. Phosphor `tray-arrow-down`. Nav-only, so the drawing was replaced rather than twinned.

### IconNavProfile

*Defined in:* IconNavProfile — ui.jsx · rule 2 · names a place, not a job

The account. Phosphor `identification-card`. A card with a face on it, rather than the bare head IconPerson draws for a credit.

### IconNavUsers

*Defined in:* IconNavUsers — ui.jsx · rule 2 · names a place, not a job

User management. Phosphor `users`. The widest glyph in the pack — 0.98 of its box before the crop, 0.82 after.

### IconPractise

*Defined in:* IconPractise — ui.jsx · rule 3 · a silhouette in life

Practise. Phosphor `graduation-cap`. Nine call sites read practise and drew the quiz card, so the place you go to study and the card you are asked looked identical.

### IconPalette

*Defined in:* IconPalette — ui.jsx · rule 4 · the fill carries information

The colour category. Phosphor `palette`. Replaces the ink drop: rule 4 is about a fill that holds the six category colours, and an outline has nowhere to put them.

### IconReading

*Defined in:* IconReading — ui.jsx · rule 1 · the ON state of a pair

A book underway. Phosphor `book-open-user`. A shelf mark is the ON state of a work.

### IconReadAgain

*Defined in:* IconReadAgain — ui.jsx · rule 1 · the OFF state, and the verb

An open book with **no fill**, for the shelf-move VERB. Fill is a state and stroke is an act, which is the line this set draws everywhere else — `IconReading` is solid because it marks what a work *is* (the shelf chip, the help entry beside it). "Read it again" is something you *do*, and it was borrowing the state mark, so a menu of five stroke verbs carried one solid glyph that read as a badge rather than a button.

### IconWatching

*Defined in:* IconWatching — ui.jsx · rule 1 · the ON state of a pair

A film or show underway. Phosphor `monitor-play`. A shelf mark is the ON state of a work.

### IconPlaying

*Defined in:* IconPlaying — ui.jsx · rule 1 · the ON state of a pair

A game underway. Phosphor `game-controller`. New. ReadingBadge computed isGame for its aria-label and then drew the film glyph.

See also: [Developing](Developing.md) · [Home](Home.md)
