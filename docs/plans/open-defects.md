# The open defect register

Every flaw found in this work, whoever found it, with its evidence and its state. It
grows; nothing is removed from it. An item leaves only by moving to **FIXED** with the
commit that fixed it named, or to **NOT A DEFECT** with the reason.

**Why this file exists.** The owner asked for it after the third round of reports in which
things I had called done were not done. A list held in a conversation is a list that gets
re-litigated from memory; a list in the repository can be checked against the code.

**How to read the Source column.** `owner` is a report from the owner, usually with a
screenshot. `rater` is the independent work-rating subagent. `probe` is
`scripts/screenshots/controls.mjs` or a sibling. `self` is something I found while
working — which is the column to be most suspicious of, because it is the one where I
grade myself.

Last updated: 2026-09-05 (A1 fixed, C1 fixed).

---

## A. The character and people screens

The owner's words, on seeing the built screen beside the prototype: "it's like looking at
a gucci knockoff bought with 5 usd. the prototype has polish. your implementation has zero
polish." Everything in this section is that report, itemised.

| # | Defect | Source | State |
|---|---|---|---|
| A1 | **Two header bars.** The panel's own head draws the title, and `ScreenHead` draws the title, cover and crumb again below it. The pack has ONE header row: cover with the medium glyph laid over it, title above crumb, ✕, and a `border-bottom` divider (`character-popup.dc.html:33-43`). | owner | **FIXED** — `ScreenHead` publishes to the panel's head through `usePanelHead` and draws nothing; `one-header.test.jsx` counts the bars and the printings of the name, and three of its seven cases fail against the stacked arrangement |
| A2 | **The sheet is flat.** The pack separates its blocks; the app runs them together. The header's `border-bottom` is one instance, and the owner reports "other subtle things" beyond it. | owner | **FIXED** — one missing `min-width: 0`. `ScreenBody` is a flex item whose default `min-width: auto` refused to shrink below its content, so a 1248px works strip sized it, it sized the grid above (column `1260px`), and every row was dragged out with it. Measured at 390px before: body scrollWidth **1266** against clientWidth **364**, strip reporting `scrollWidth === clientWidth`. After: **364 === 364**, strip `sw 2364 / cw 340 / data-scroll-x="end"`. `make controls` now measures sideways scroll on every screen and every panel a press opens |
| A3 | **The picture verbs are not the pack's.** It specifies `Fetch` · `Upload` · `Paste URL` as three named buttons plus `Set for the identity` outlined red and dashed on a local scope only (`character-popup.dc.html:1257-1280`). The app draws one small tile and "use this one". Recorded in `codebase-audit.md` §4.1 as a deviation and then not acted on. | owner | OPEN |
| A4 | **FIXED.** The face chip could not reassign the performer. The pack splits the credit row: the face opens the person picker (`mode:'person'`, line 522), the name opens their record (line 529). `identityLocal.jsx:115` wires `onPick` to `onOpen`, so both go to the record — and `en.txt:6397` promises "Change who this is", which is a shipped tooltip that lies. | owner, rater | **FIXED** — see `credit-row.test.jsx`, 4 of whose 8 cases fail against the row as it shipped |
| A5 | **FIXED.** A credit with no `actor_id` had two silent no-ops. Neither button is `disabled` and neither does anything. The pack's own copy for that state is "Nobody named on this credit yet". | rater | **FIXED** — see `credit-row.test.jsx`, 4 of whose 8 cases fail against the row as it shipped |
| A6 | **The performer's face is missing on the local sheet** although the same person's face draws on the quote card. | owner | OPEN |
| A7 | **The character's picture shows on the global card and not on the local one**, for the same character. | owner | OPEN |
| A8 | **The global card lists quotes; the prototype has no such list** on either the character or the person global screen. | owner | OPEN |
| A9 | **"Open the global reco…" is clipped.** A row's label is cut off mid-word, which the standing rule forbids outright: "Never truncate a name." | owner | **FIXED** — one missing `min-width: 0`. `ScreenBody` is a flex item whose default `min-width: auto` refused to shrink below its content, so a 1248px works strip sized it, it sized the grid above (column `1260px`), and every row was dragged out with it. Measured at 390px before: body scrollWidth **1266** against clientWidth **364**, strip reporting `scrollWidth === clientWidth`. After: **364 === 364**, strip `sw 2364 / cw 340 / data-scroll-x="end"`. `make controls` now measures sideways scroll on every screen and every panel a press opens |
| A10 | **FIXED.** Emoji stood in for the app's glyphs on the credit row. `identityLocal.jsx` passes `noteIcon: '✎'`, `removeIcon: '✕'`, `caret: '▾'` — literal characters. CLAUDE.md: "A screen's glyphs are the app's own, never an emoji." | self | **FIXED** — see `credit-row.test.jsx`, 4 of whose 8 cases fail against the row as it shipped |
| A11 | **FIXED.** The credit row showed the note or the language, never both. `identityLocal.jsx:107`; the pack joins them (`[o.lang, o.note].filter(Boolean).join(' · ')`, line 518). | rater | **FIXED** — see `credit-row.test.jsx`, 4 of whose 8 cases fail against the row as it shipped |
| A12 | **Both global sheets still reach their fields with `focusField`** rather than the pack's picker (`identity.jsx:752, 767, 1390-1400`). The picker exists and is used only by the local sheet. | rater | OPEN |
| A13 | **The picker's `choose` mode is unbuilt.** The pack has four modes — person, choose, note, and the language variant. Three exist. | rater | OPEN |

| A14 | **The author's works strip would not scroll and wore no edge fade** (owner). Same root cause as A2/A9 — it stretched rather than scrolled. | owner | **FIXED** — see A2 |
| A15 | **An author's work tiles wore the author's face** as a broken-image disc in each cover's corner. `creditTiles` passed the person's `portrait` and the chip renders through `coverImgURL`, which builds a WORK's address. `AppearanceStrip`'s own comment forbids the chip there at all. | owner | **FIXED** in `c7c179f` |
| A16 | **Pressing a work tile re-opened the same person page** with a back arrow. `onOpenWork` pushed `personPanel` with a `work` that `identityScope` drops on purpose. | owner | **FIXED** in `c7c179f` — a work opener is threaded, and a tile with no door says so |
| A17 | **`/people` is not a route.** It falls through to Home, so `controls.mjs` probed Home twice under two names and reported "People" as a screen with its own findings. | self | **FIXED** — the probe now fails on a route that resolves elsewhere |

## B. The quote card

| # | Defect | Source | State |
|---|---|---|---|
| B1 | **The speaker's name is printed twice** — once in the chip with their portrait, once in the attribution line. `Home.jsx:471` builds `source: [speaker, occasion]` while the comment three lines below it says "No speaker in `meta` — the expanded tile chips them." The intent was applied to one field and not the other. | owner | **FIXED — `Home.jsx` collapsed line is the OCCASION alone; the comment three lines above it already said so and the value it read did not** |
| B2 | **The attribution overlaps the chip**, clipping it to "Albert Ein…". | owner | **FIXED — the chip row wraps and the occasion takes the next row (`basis-full`); they were flex siblings competing for one line** |
| B3 | **The occasion belongs on its own line**, above or below the chip row, the way a note or a translation sits. | owner | **FIXED — same change; the occasion sits under the chips, where the owner asked for it** |
| B4 | **The Quotes screen's cards have no chip at all**, where the same quote in Home's favourites has one. Two screens render one fact two ways. | owner | **FIXED — `AnnotationCard` gains the chip ladder Home has carried since its tiles were written; `speaker-chip-ladder.test.jsx`, 3 of whose 4 cases fail without it** |

## C. Things that are dead or missing

| # | Defect | Source | State |
|---|---|---|---|
| C1 | **FIXED in `961dd8c`.** A character chip was dead until somebody opened that work's cast list. ROOT CAUSE, and it is behind every "the pills don't open" report. `adoptQuoteCharacters` gives a quoted character the cast row that carries `character_id`, and the press is gated on that id — but the function has exactly ONE caller, `cast_handlers.go:244`, the cast-list read. Nothing calls it when a quote is saved, and nothing calls it when Quotes or Home draw their chips. Measured against the running app: "Charles Foster Kane" served `{"name":…,"path":""}` with no id; after one GET of that film's cast it served `{"name":…,"cast_id":9,"character_id":6}`. It is not about the actor — that row has one. | owner, self | OPEN |
| C2 | **No metadata source icons** in the Details panel or the metadata fetch sections. | owner | OPEN |
| C3 | **`Quotes.jsx:965` passes `onOpenPerson: setPerson`**, bypassing the person router added in `e4e02b2`, which that screen uses at line 1188 only. | rater | **FIXED — `Quotes.jsx:965` routes through `openPerson`, which the same file already used 200 lines below** |

## D. Checks that do not check

The owner's standard, stated once and binding: "you need to check the feature/specification
/repo guideline with the test… a test writer shouldn't even know about the fix."

| # | Defect | Source | State |
|---|---|---|---|
| D1 | **`person-router.test.jsx`'s inventory regex matches JSX attribute form only**, so it passes green over C3 — the exact defect it was written to prevent. | rater | **FIXED — the inventory now matches the options-object form as well as the JSX attribute; widened FIRST, and it caught C3 live before the fix landed** |
| D2 | **`make controls` fails at phone width** — 2 controls that do nothing and 20 under the 44px touch floor. Every number I reported (44 → 19 → 1 → 0) was the DESKTOP pass; I never ran the phone one and did not say so. | rater | OPEN |
| D3 | **`audit-panel.mjs` always exits 0 and resolves controls by position** — the two faults `panel-depth.mjs`, `hero-control.mjs` and `controls.mjs` were each hardened against. It is the only probe that covers the character panel. | rater | OPEN |
| D4 | **`controls.mjs` exempts `is-on`** while quoting the CLAUDE.md line that says `is-on` is *not* a chip's on-state. `.to-top.is-on` is therefore never pressed. | rater | OPEN |
| D5 | **26 of 28 `FormModal` callers pass no `dirty`**, so their tick never arms and never counts. Ratcheted in `tick-pair.test.js`; the sweep itself is deferred by the owner (see `FormModal`'s header). | self | KNOWN DEBT |
| D6 | **`changelog-dialog.test.jsx` failed once in a loaded full run** and passes in isolation and beside its neighbours. Unexplained; "flake" is not a root cause. | self | OPEN |

## E. Duplication and documents

| # | Defect | Source | State |
|---|---|---|---|
| E1 | **`ui.jsx:4093-4105` duplicates `4202-4214` verbatim** and is absent from the duplication audit that was supposed to find exactly this. | rater | OPEN |
| E2 | **`codebase-audit.md` §4.1 records the credit row as "Match"** when three of its details deviate (A4, A5, A11). | rater | OPEN |
| E3 | **§4.2's artboards are still uncompared** — `char-global`, `char-book`, `char-game`, `people-global`, and `book-detail*.dc.html`. The Match Picker and Fetch Results have now been compared and match. | rater, self | OPEN |
| E4 | **§2.2 and §2.3's tautology sections remain unfixed**, which was half of the owner's sixth instruction. | rater | OPEN |
| E5 | **The ✕ rule contradicts itself.** `PanelHost` reds it only when `dirty > 0`; `identityPicker.jsx` passes `closeDanger` unconditionally; CLAUDE.md states it flatly. One of the three has to give. | rater | OPEN |

---

## Fixed, with the commit that did it

| # | Defect | Fixed in |
|---|---|---|
| F1 | The ⋯ menu opened an empty card on six of twelve screens | `a94e141` |
| F2 | The character sheet's rows scrolled to a fold instead of opening an editor | `a94e141` |
| F3 | "Called here" and "Also called here" were two rows editing one fact | `a94e141` |
| F4 | Three identity sheets committed with a body "Save" button, not the standing pair | `a94e141`, `ecd65d4` |
| F5 | `PanelHost`'s tick never armed and never counted; its ✕ was never red | `ecd65d4` |
| F6 | Every card's ⋯ lacked `aria-haspopup` and `aria-expanded` | `ecd65d4` |
| F7 | The rail brand and the root crumb could not say "you are already here" | `d0304f4` |
| F8 | "Add another performer" was a text box, not the library's people | `c6b1ae3` |
| F9 | A claim made in three documents that `PanelHost` already drew the armed tick | `ecd65d4` (corrected in both docs) |
| F10 | `0d84411`'s claim that three cast writers never set `character_id` | `a94e141` (reverted, corrected in the audit) |

## Withdrawn claims

Kept because the pattern matters more than any one of them.

- **"Dead controls went 44 → 19 → 1 → 0."** Desktop only. The phone pass was never run. See D2.
- **"Three of the four writers of `work_cast` never set `character_id`."** All four already
  called `LinkCastRow`. The mutation that seemed to prove otherwise was detecting damage
  the fix itself made possible.
- **"44px is stated in CLAUDE.md."** It is not; CLAUDE.md contains no "44". The number is
  the design pack's.
- **"`--type-ui-14` exists."** It is not on the scale, and `typescale.test.js` names it as
  its example typo. I had grepped for the token's USE and read my own new line back.
