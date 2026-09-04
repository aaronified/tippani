# The codebase audit — duplications, latent defects, what the tests do not guard, and where the screens depart from the pack

Not a feature. This is the same shape as `screen-audit.md`: the **found-and-unfixed**
half of an adversarial pass, written down because that is the one artefact which
otherwise leaves no trace in the tree. A fixed defect leaves a commit, a test and a
changelog entry; an unfixed one leaves nothing. It retires the way everything here
does — when the list is empty, delete the file.

Commissioned by the owner after a session in which **five user-visible defects all
turned out to be the same mistake wearing different faces**: a contract honoured at
one call site and not at its siblings. That pattern is the audit's organising idea,
so it is worth stating first.

## The shape that keeps costing releases

Every one of these shipped green, compiled, and passed the suite:

| What was wrong | What a reader saw |
| --- | --- |
| `chipRows` read its handler from `speaker.onOpen`, a key **no production caller sets** — all three pass `onOpenCharacter` instead | The stacked character chip, the first one a reader presses, was dead on Home, the Library's book cards and the film frame |
| `PersonName` handed back `{kind, name}` after `PersonChip` began handing back `{kind, name, person}` | Every credit drawn as a `PersonCredit` opened the legacy modal, so the pack's person screen looked absent rather than unreachable |
| The person router existed in **one** screen's own closure; eighteen other call sites passed `setPerson` raw | Same as above, from twelve more places |
| `usePicturePicker` returns a pair; the character sheet rendered only the trigger | The portrait toggled a block that was not on the page |
| `movies.cast_role` was written by a handler and served by no response | "Voiced by" wrote the column, the sheet reloaded, and the control sprang back to "Played by" |

None is a hard bug. Each is **a contract with one honest end**. The audit below is
sorted by how likely a finding is to become another one of these, not by size.

---

## 1. Duplications

Ranked by risk of a future bug. Nothing here has been acted on.

| # | Pattern | Where | Drifted? |
| --- | --- | --- | --- |
| 1 | **Create-time duplicate guard exists for films and not for books** | `internal/httpapi/movie_handlers.go:414-542` (`createMovieFromSource`, `similarMoviesForSource`) vs `internal/httpapi/book_handlers.go:257-382` | **Yes — user-visible** |
| 2 | Movie has two single-column manual-override updates with no book counterpart | `movie_handlers.go:1022` (`fandom_wiki`), `:1039` (`cast_role`) vs `book_handlers.go:634, 654, 740` | Possibly intentional |
| 3 | Per-source provenance list reimplemented per work kind | `bookFieldsFrom` `book_handlers.go:781-808` vs `movieFieldsFrom` `movie_handlers.go:1253-1272` | Not yet |
| 4 | Parallel quote handlers: dialogue vs annotation | `dialogue_handlers.go` (812 lines) vs `annotation_handlers.go` (535) | Needs a proper diff |
| 5 | The same fold in two languages | `store.CastKey` `internal/store/cast.go:35` vs `creditKey` `web/frontend/src/people.jsx:566` | **No — already fenced** |

### 1.1 The one to act on first

**A book added by title alone gets no duplicate warning; the identical act on a film
does.** `createMovieFromSource` calls `similarMoviesForSource` (`movie_handlers.go:542-564`)
before inserting and returns `409 needs_confirm` with the look-alikes, so the client can
offer "enrich the one you have" instead of making a second row. `handleCreateBook` has no
analogue anywhere in the file: its only duplicate protection is the `(user_id, isbn)` /
`(user_id, asin)` unique index surfaced as a 409 at `book_handlers.go:344-348`, which
cannot fire for a book entered without either — which is most hand-entered books.

This is exactly the shape in the table above: one call site got a feature, its sibling
did not, and the difference is silent. Cost is a real feature rather than a refactor —
a `similarBooksByTitle` helper plus a `needs_confirm` arm the add-book flow does not
currently expect.

### 1.2 Worth confirming, not fixing

`fandom_wiki` and `cast_role` are films-only by nature, so #2 is probably correct — but
it should be *decided* rather than left as an asymmetry nobody has looked at. #5 is the
model to copy, not a debt: `people.jsx:566-573` says in capitals that the JS fold **is
not** `store.CastKey` and must not pretend to be, and narrows its own claim to the one
comparison it makes. #4 needs `validate()` (`annotation_handlers.go:34` vs
`dialogue_handlers.go:169`) and the favourite filter (`annotation_handlers.go:71` vs the
dialogue list handler at `:575`) diffed before it can be costed.

---

## 2. What the tests do not guard

Every frontend test file and a structural pass over all 239 Go test files, against one
rubric:

- **(A)** If the feature broke but the source line stayed, would this test fail?
- **(B)** If the code were refactored to an equivalent implementation, would it fail?

| Verdict | Meaning | Frontend (of the 49 that read source) | Go |
| --- | --- | --- | --- |
| **GUARD** | Behavioural. A=yes, B=no. | 26 | essentially all of 1465 test funcs |
| **PROXY** | Reads source as a stand-in for something the runner genuinely cannot see | 9 | 0 |
| **INVENTORY** | A set must be complete or consistent | 13 | 4 |
| **TAUTOLOGY** | Asserts a line exists. Passes when broken, fails on a rename. | **1** | **0** |

The other 185 frontend files read no source: 79 use `vi.mock`, 77 of those mocking only
`src/api.js` — the network boundary — and **no file mocks the module under test**. No
test was found asserting a value it had itself supplied.

**This is a healthy suite.** The single tautology was written during this session, and
its replacement is described below. What follows are the smaller offenders inside
otherwise-strong files, and one genuine coverage hole.

### 2.1 Fixed in this pass

`test/pure/hero-title-control.test.js` — **deleted**. Four assertions, all "index.css
still contains this string", including a literal `margin-block: calc(...)` regex. The
proxy defence fails for a reason worth recording: not because the ink gap is invisible
to jsdom (it is) but because **the harness that can measure it exists and was used to
find the bug in the first place**. A proxy earns its place when nothing can see the
behaviour; here something could and the check went somewhere weaker.

Replaced by `scripts/screenshots/hero-control.mjs` (`make`-able via
`run-hero-control.sh`), which opens book details at 390px and fails when the heart is
more than 2px off the title's optical centre, or when the title's row is taller than its
own line box. Against the shipped CSS it reports 10.0px and a 44px row for a 25.3px
line; against the fix, four passes. It fails on the broken code, which the deleted file
never did.

`test/dom/panel-opens-panel.test.jsx` is the companion honest case: it pins that
`open()` **replaces** rather than deepens, and its header states plainly that it does
**not** guard the race that motivated it — those three cases pass against the broken
implementation, because jsdom dispatches `popstate` on a schedule that does not lose to
a frame callback. The race is guarded by `scripts/screenshots/panel-depth.mjs` instead.

### 2.2 Tautology sections inside good files — not acted on

| Where | The assertion | Why it is hollow |
| --- | --- | --- |
| `test/pure/keys.test.js:226-289` | `/<Kbd keys=\{shortcutFor\(DRAWER_SHORTCUTS\[row\[0\]\]\)\}/` and similar | All pass if `Kbd` renders `null`; all fail if the map callback renames `row`. **Test instead:** the key cap a control actually shows — `dom/mobile-no-keys.test.jsx` already mounts the drawer |
| `test/pure/features-nav.test.js:302-321` | a 240-character proximity window between two strings; `onOpenBook={openBook}` verbatim | Breaks on renaming a local. A `&&` instead of a ternary is equally correct and fails. **Test instead:** which doors are on screen with a section hidden |
| `test/pure/hero-rhythm.test.js:110-113` | `compact` must sit **alone on its own line** within 900 chars of `<ShelfControl` | `compact={true}` is identical to React and fails. Passes if the prop is ignored |
| `test/pure/translated-not-sliced.test.js:39,45` | `toContain('MONTH_KEYS')` | Passes on a comment mentioning the name. The rest of the file is a real guard |
| `dom/filter-chip.test.jsx:133`, `dom/selection-cards.test.jsx:180`, `dom/surface-readability.test.jsx:210`, `dom/accent-texture.test.jsx:419` | exact byte-level CSS formatting, one including a newline | The *value* is what matters. Three of these four files already own a cascade resolver — route the assertion through it and check the resolved value |

`test/pure/tokens.test.js:34-42` is borderline and listed for completeness: `css.includes(token.proof)`
is literally "assert a line exists", but its job is keeping the generated glossary honest
and `:48-55` closes the loop. Worth knowing what it does *not* guard: `min-height: 44px`
in the stylesheet says nothing about whether a tappable element wears the class. That is
a harness measurement — `getBoundingClientRect()` over every `button` and `[role=button]`
on each captured screen — and belongs beside `make typescale`.

### 2.3 The coverage hole

`test/pure/scroll-containment.test.js` sweeps `index.css` only. **Nine `overflow-y-auto`
Tailwind classes across seven files** — `ui.jsx` (2), `AddSurface.jsx` (2), `share.jsx`,
`people.jsx`, `Settings.jsx`, `SearchPage.jsx`, `ReverifyReview.jsx` — are scroll
containers the sweep cannot see, so none is checked for `overscroll-behavior`. The file's
own header says the failure mode is "someone adds `overflow-y: auto` next year and never
thinks about chaining", which is precisely what a `className` does.
`scroller-boxes.test.js` already reads JSX attributes and could lend its extraction.

### 2.4 Two patterns to copy

- `internal/store/schema_test.go:16-40` refuses a hand-maintained schema mirror and
  captures shape from SQLite's own `PRAGMA` instead.
- `internal/store/hash_wire_test.go:1-33` names this rule exactly. Its sibling
  `hash_backfill_test.go` computes `want` **with the function under test**, so it cannot
  see an encoding change; `hash_wire_test.go` pins three sha256 literals computed with
  `sha256sum` instead. That pairing is the answer to "a test that cannot fail".

---

## 3. Latent defects

The sweep looked for the class in the table at the top: code that compiles, passes, and
does nothing. Four findings were confirmed and **fixed in this pass** — they were the
substance of the owner's "half the buttons do not work" — and they are recorded here for
the reasoning rather than as open work. Everything under 3.5 onward is **open**.

### 3.1 FIXED — six rows focused fields inside a collapsed `<details>`

`identity.jsx:1066` opened `<details className="cs-local-fields">` with no `open`
attribute, and `grep cs-local-fields index.css` returns nothing — the class has no rules,
so nothing forced it open. `focusField` (`identity.jsx:120`) did
`getElementById(id)` → found the node → `scrollIntoView` → `.focus()`, and **both are
no-ops on an element a closed disclosure is not rendering**: per spec a focusable area
must be "being rendered", and Chromium's auto-expanding covers find-in-page and fragment
navigation, not programmatic focus.

So "Credited as", Part, First appears, Age here and both Note rows did nothing on a panel
whose entire shape is *the row states the value, press it to change it*. Six rows reading
as unbuilt from one missing attribute. Scoped exactly to the local sheets: `char-global`
(`:1229`) and the person sheet (`:707`) put their fields in a plain `<div>`, which is why
`onSort` and `onBorn` there always worked.

`focusField` now opens every closed `<details>` ancestor before scrolling. Verified by
pressing all 22 controls in Chromium: focus lands on `#char-called`, `#char-part`,
`#char-first`, `#char-age` and `#char-crednote` respectively.

**A wrong diagnosis worth recording.** An earlier pass concluded this was a *harness*
artefact, on the evidence that no element on the page could take focus in headless
Chromium — including buttons in the rail. That control experiment was real but the
inference was wrong: focus works in that browser, and the disclosure was the cause all
along. A negative control that fails for its own reasons is not a control.

### 3.2 FIXED — two rows pressed a DOM id that existed nowhere

`identity.jsx:1154-1155` both called `focusField('char-addcredit')`, and
`grep -rn char-addcredit web/frontend/src/` returned **only those two lines**. There was
no add-credit editor in the local scope at all, so "Add another performer" and "Add a
dubbing credit" were pressable, focusable, and inert.

Built rather than re-pointed: the sheet now carries a performer box (`char-addcredit`), a
language box (`char-adddub`) and an `addCredit` writer that POSTs a **new cast row** —
because a work can bill one character twice and 0063 re-cut `idx_work_cast_pair` for
exactly that. `credit_lang` decides which heading it lands under, which is why the dub
control is a language field and not a second name field.

### 3.3 FIXED — the character sheet rendered a picker's trigger without its editor

`usePicturePicker` returns `{faceButton, pictureEditor}`; `identity.jsx:1040` rendered
only the button, so pressing the portrait toggled a block that was not on the page. The
person sheet destructures both (`:502`), which is why the same picker worked there.

### 3.4 FIXED — `movies.cast_role` was written and served by nothing

The client's `leadingRole` (`identityScope.js:104`) reads `work.cast_role` first and the
medium second, but `work` is an object each caller builds by hand and none carried one. So
"Voiced by" wrote the column, the sheet reloaded, and the control sprang back. `CastRole`
now rides on `store.CastOf` (`internal/store/identity.go`) and `identityLocal.jsx` reads
the **served** appearance row rather than the caller's object.

### 3.5 OPEN — `onCreditNote` edits the wrong cast row

`identity.jsx` discards the credit it is handed: `identityLocal.jsx:169` passes
`onNote: (a) => onCreditNote?.(a)` and `creditRows` binds it per credit, but
`char-crednote` is bound to `form.here_note ?? here.credit_note` and saved by
`saveAppearance(here, …)` — always `here`, the row the panel was opened on.

**Failure:** a character with two credits on one film — an on-screen performer and a dub,
the case 0063 exists for — pressing the **dub's** ✎ edits the **performer's** note. This
was invisible while 3.1 made the field unreachable; **fixing 3.1 makes it live.** It is the
highest-priority item in this document.

### 3.6 OPEN — `LinkCastRow` leaves a stale `actor_id` when a performer is cleared

`internal/store/identity.go:614-626` guards the re-link with `if !aid.Valid && actor != ""`
and writes the scanned `aid` back regardless. Clearing a credit's performer via
`PUT /cast/{id}` leaves `actor_id` pointing at the person while `actor` is `''`, so the row
draws "Not named yet" while `/whos-in-it` (`whos_in_it.go:218`) still lists that person.
`character_works.go:288` does undo the link on removal and is the model.

### 3.7 OPEN — the new `open()`'s 250 ms window is narrow but not closed

The listener and timer are cancelled on unmount and a second `open()` cancels the first,
and the functional setter refuses a pop that did not empty the stack — so an unmount, a
double-tap and a foreign Back are all handled. What remains: `usePersonOpener`
(`personOpen.jsx`) routes seven screens' credit chips through `stack.open()` inside a
dynamic `import().then()`, an **unbounded** async delay before the `go(-n)` with no
pending state on the control. On a cold chunk fetch the press has no feedback.

### 3.8 OPEN — columns and fields with only one end wired

| Where | What |
| --- | --- |
| `internal/store/migrations/0056_person_identity.sql:133` | `characters.image_url` has no writer and no reader — the `cast_role` shape with neither half |
| `App.jsx:938` | reads `user.display_name`, which `handleMe` does not serve. Always falls through |
| `identity.jsx:545-553` | the person form omits `bio`, though `PersonGlobal` prints it and the server accepts it. Now that every credit routes to `personPanel`, the only bio editor is reachable solely via the People console's portrait button |
| `WorkDetails.jsx` | builds `` `Open on ${label…}` `` — hardcoded English and an English-only regex. Unreachable today, since every spec with an `href` also has `ids: true` |
| `identity.jsx:986` | `useCharacterPicture` is passed no `actor`, so the third rung of the face ladder (character image → record image → **performer headshot**) never fires on the local sheet |

### 3.9 OPEN — the layout of the restored picture editor

`identity.jsx` puts `pictureEditor` in `localPortraitActions`, which `PortraitBlock`
renders inside `.cs-face-actions` inside `.cs-portrait-side` — beside a `max(96px, 7.4em)`
face. `.cast-row-url { flex: 1 1 100% }` wraps it to its own line but confined to the side
column, so the search link, input and Apply share roughly (container − 96px − 16px), less
at 175% on the type dial. The person sheet puts the same node full-width at the foot of
its grid. Needs a render at 320px to judge.

### Checks that came back clean

Worth recording so they are not re-run: **per-user isolation** (32 SQL sites touching the
identity tables traced, every one keyed on an already-ownership-checked id);
**partially-destructured hooks** (all four picker sites now render both halves);
**`usePanelStack` vs `PanelHost`** (all nine hosts mounted outside every conditional);
**full-state PUTs** (the server's unconditional column lists diffed against all four
client builders and every call site — no omission); **`omitempty` never populated** (one
hit, `auth_handlers.go:493 DefaultBoardID`, intentional); **one-time pass ordering** (the
four 3.1.0 passes' dependencies are deliberate; `backfillCast` seeding from existing links
is what makes it idempotent against `cast-records`); **dead DOM selectors** (every
`getElementById`/`aria-controls`/`htmlFor` literal resolves, `char-addcredit` excepted and
now fixed).

---

---

## 4. Fidelity to the design pack

The owner's words: *"i don't want a single line deviating from the prototype unless it is
expounded upon in detail."* This section is that list. It exists at all because
`scripts/screenshots/proto.mjs` can now render the prototypes offline — until it could,
every claim about fidelity was a reading of the source rather than a comparison of two
pictures.

### 4.1 The character sheet, `char-film`

Against `docs/design/prototypes/character-popup.dc.html`. **The first row is the one that
matters**; the rest are smaller and independent.

| Element | Prototype | App | Verdict |
| --- | --- | --- | --- |
| **What a row press does** | opens a small titled picker over the sheet — `openPicker` at lines 522, 529, 1032, 1047, 1077, with titles like "Add a performer to this film" | scrolls to a `<details>` form at the FOOT of the sheet, 600–1000px down, and focuses a bare input | **Deviation, architectural** |
| Portrait verbs | `Fetch` · `Upload` · `Paste URL` as three named buttons, then `Set for the identity` outlined red and dashed | one small tile button and `use this one` | **Deviation** |
| Picture size | `1280 × 720 px` above the verbs, inked `--error` under the floor | absent on this sheet | **Deviation** |
| Header | glyph + name + `in Deathly Hallows – Part 2 · film` + ✕ on one header line | centred name + ✕; the glyph, name and crumb in a separate boxed row beneath | **Deviation** |
| Qualifier chip (`CHAR-FILM`) | present | absent | **Justified** — PLAN.md's eight rulings, #4: "Drop it — the crumb and the cover-with-glyph already say the scope" |
| Credit row | name plus a sub-line — `age 17 · and the epilogue at 36` | name only | **Deviation.** `part` and `age_here` are stored per cast row and not drawn |
| Credited as · the Played by / Voiced by pair · Part / First appears / Age here · the Note row · the two count tiles · The identity · Open the global record · Remove | — | — | Match |

**Why the first row is the whole of the "polish" complaint.** The prototype's rows *are*
the editors: press one, a picker opens over the sheet carrying that field alone. The app's
rows are read-only displays and the editors are a form appended at the end, so pressing
"Part" throws the reader most of a screen away from what they pressed and leaves them in
an unlabelled box. `identity.jsx`'s own comment defends this as "this panel's own
established shape… the pack's screens print a saved value as a row and let you press it;
the editor is one field further down" — the second half of that sentence is a claim about
the pack that the pack does not support. There is no editor form anywhere in the
prototype.

Fixing it is a build, not a restyle: a picker overlay in the prototype's shape (its
`pickerInput`, a search-or-type field with a title) and eight rows rewired to it. The
`<details>` block then goes, and with it the reason `focusField` had to learn to open a
closed disclosure.

### 4.2 Not yet compared

`char-global`, `char-book`, `char-game` and `people-global` (the other four artboards in
the same prototype), the work-detail surfaces in `work-details-popup.dc.html` — including
the Match Picker and Fetch Results built this session but **not yet held against their
artboards** — and `book-detail.dc.html` / `book-detail-wide.dc.html`. The pair of probes
is in place; the comparisons are not done.

---

## How to retire this file

Per `README.md`'s rule: when the list is empty, delete it. Sections 1 and 3 empty by
being fixed or by the owner ruling them intentional; section 2 empties as each hollow
assertion is replaced by the observable named beside it; section 4 empties as each
deviation is either built to the prototype or given its reason in PLAN.md, which is where
a departure the owner has ruled on belongs.
