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
| `chipRows` read its handler from `speaker.onOpen`, a key **Home did not set** — the Library's card and the film frame both spread it on, so one contract was kept in two places and Home kept neither | The stacked character chip, the first one a reader presses, was dead on the favourites wall and live on the other two — which is why it read as "some pills work and some don't" rather than as one broken component. *An earlier version of this row claimed no caller set it; that was wrong in scope and is corrected here rather than dropped.* |
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

### 1.1a REVERTED — a second fold beside the one already running, and a commit message that was wrong about why

`0d84411`'s subject line says a cast pill opens, and its body says why: "three of the four
writers of that table never set it", so "a fetched cast drew a name, a face and a performer
under it and did nothing at all when touched." **That reason was false.** All four writers
of `work_cast` already called `store.LinkCastRow` immediately after their INSERT, and
`LinkCastRow` fills `character_id` whenever it is NULL — `git show 0d84411^` has the calls
at `cast.go:577`, `cast_from_quotes.go:165`, `cast_handlers.go` (the add path) and
`character_works.go`. The column was being set on every route before that commit touched
anything.

So the `store.CharacterForCast` call the commit added to three of them was a **second
implementation of the same fold, one line before the first one runs** — the plainest kind
of duplication, and the kind this section exists to name. It is reverted:
`TestEveryRouteThatCreatesACastRowMakesItADoor`, `TestOneWorkFoldsANameAndTwoWorksDoNot`
and the whole of `./internal/httpapi` and `./internal/store` pass without it.

**HOW THE MISTAKE SURVIVED A MUTATION TEST**, which is the part worth keeping. Neutering
`CharacterForCast` to return `0` did make the property test fail, and that was read as
proof the route needed it. It is not: an INSERT writing `character_id = 0` leaves
`cid.Valid` **true** in `LinkCastRow`, so the repair is skipped and the row stays dead. The
mutation was detecting damage the addition itself made possible. The honest experiment is
to remove the addition and re-run — which passes — and then to neuter the mechanism that
is actually load-bearing:

```
=== LinkCastRow's character branch neutered ===
--- FAIL: TestEveryRouteThatCreatesACastRowMakesItADoor
    a cast row added by hand to a film has no character record — its chip opens nothing
    a cast row added by hand to a book has no character record
    a cast row adopted from a quote line has no character record — its chip opens nothing
    cast row 1 ("Rick Blaine") is drawn as a door and opens nothing
    cast row 3 ("Ilsa Lund") is drawn as a door and opens nothing
--- FAIL: TestOneWorkFoldsANameAndTwoWorksDoNot
    a cast row has no character record: 0 / 0
```

A mutation that only breaks code the change added proves the change tests itself. Mutate
the mechanism, not the patch.

The six fields of 0063 that the same commit added to that INSERT are a real fix and stay:
a POST carrying `credit_lang` was validated, answered 201 and silently dropped, and
`credit_lang` is the only thing that makes a credit a dub.

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

`test/dom/panel-opens-panel.test.jsx` pins that `open()` **replaces** rather than
deepens, and says in its header that it does not guard the race that motivated it — those
three cases pass against the broken implementation, because jsdom dispatches `popstate` on
a schedule that does not lose to a frame callback.

### 2.1a A retraction that was itself wrong, kept as the record

`scripts/screenshots/panel-depth.mjs` was described as the guard for the panel race.
One run of it against the broken `requestAnimationFrame` version came back `ok`, and that
single observation was generalised into "it does not discriminate" and written into four
places — the probe's header, the jsdom test's header, `DEVELOPMENT.md` and this document.

**Five controlled runs then failed five times**, with the embed verified by asset hash:
`FAIL … left NOTHING open (depth 0)`, exit 1. Against the fix, `ok … depth 1`. So the
probe **is** the guard, the retraction was false, and it came within one commit of
demoting a working check in four places at once.

The anomaly was almost certainly a seeding gap in that one attempt — a probe whose subject
must be seeded will press whatever chip it can find, and reach a different surface. The
lesson is plain enough to write down: **a single pass is not evidence of a negative**, and
a fixture-dependent probe is only trustworthy with its seed and its embed both verified.

### 2.2 Tautology sections inside good files — ALL SIX ACTED ON

| Where | The assertion | Why it is hollow |
| --- | --- | --- |
| `test/pure/keys.test.js:226-289` | `/<Kbd keys=\{shortcutFor\(DRAWER_SHORTCUTS\[row\[0\]\]\)\}/` and similar | All pass if `Kbd` renders `null`; all fail if the map callback renames `row`. **Test instead:** the key cap a control actually shows — `dom/mobile-no-keys.test.jsx` already mounts the drawer |
| `test/pure/features-nav.test.js:302-321` | a 240-character proximity window between two strings; `onOpenBook={openBook}` verbatim | Breaks on renaming a local. A `&&` instead of a ternary is equally correct and fails. **Test instead:** which doors are on screen with a section hidden |
| `test/pure/hero-rhythm.test.js:110-113` | `compact` must sit **alone on its own line** within 900 chars of `<ShelfControl` | `compact={true}` is identical to React and fails. Passes if the prop is ignored |
| `test/pure/translated-not-sliced.test.js:39,45` | `toContain('MONTH_KEYS')` | Passes on a comment mentioning the name. The rest of the file is a real guard |
| `dom/filter-chip.test.jsx:133`, `dom/selection-cards.test.jsx:180`, `dom/surface-readability.test.jsx:210`, `dom/accent-texture.test.jsx:419` | exact byte-level CSS formatting, one including a newline | The *value* is what matters. Three of these four files already own a cascade resolver — route the assertion through it and check the resolved value |

**What replaced each one**, and every replacement is a render or a resolved value
rather than a second regex:

| Was | Now |
| --- | --- |
| `keys.test.js`'s four source matches | `dom/key-legends.test.jsx` mounts the real drawer, the real quiz and the real sheet and reads the caps off them. It found a live gap the regexes had passed over: the drawer's account row reaches the profile with `g p` and printed no key at all |
| `features-nav.test.js`'s 240-character window | The `<ShortcutSheet` element is cut out and looked at, so an `omit` further down the file cannot satisfy it and a new prop cannot break it. `dom/hidden-section.test.jsx` owns the consequence — what a hidden section takes off the drawer and off the sheet |
| `hero-rhythm.test.js`'s `compact` alone on its own line | Any spelling of the prop is accepted and only a WIDTH CONDITION is refused; `dom/work-tile-marks.test.jsx` renders both forms and looks for the track, which is what `compact` means |
| `translated-not-sliced.test.js`'s `toContain('MONTH_KEYS')` | `dom/month-axis.test.jsx` renders the calendar **in Bengali** and checks no label is a cut of a month name. In English a cut and the shared table both produce "Jan", so an English render proves nothing — the first draft of it passed with the slice put back |
| the four byte-level CSS matches | `test/css-cascade.js`, the resolver lifted out of `accent-texture.test.jsx` so all four can reach one copy. Each now asks for a resolved VALUE |

Two things came out of doing it that reading had not shown:

- **The audit was wrong that "three of these four files already own a cascade
  resolver."** Exactly one did. The other three were matching bytes because there
  was nothing else to reach for.
- **The resolver answered with an ANCESTOR's declaration.** `competes(sel, target)`
  reduced the candidate to its rightmost compound and then compared it against
  `simples(target)` — the whole target, ancestors included — so asking for
  `.drawer-item.active .review-dot`'s background got `.drawer-item.active`'s fill.
  Every target it had been asked about until now was a single compound, where the
  two readings coincide, so nothing showed it. Fixed with the target reduced the
  same way as the candidate.

`test/pure/tokens.test.js:34-42` is borderline and listed for completeness: `css.includes(token.proof)`
is literally "assert a line exists", but its job is keeping the generated glossary honest
and `:48-55` closes the loop. Worth knowing what it does *not* guard: `min-height: 44px`
in the stylesheet says nothing about whether a tappable element wears the class. That is
a harness measurement — `getBoundingClientRect()` over every `button` and `[role=button]`
on each captured screen — and belongs beside `make typescale`.

### 2.3 The coverage hole — CLOSED

`test/pure/scroll-containment.test.js` swept `index.css` only. **Nine `overflow-y-auto`
Tailwind classes across seven files** — `ui.jsx` (2), `AddSurface.jsx` (2), `share.jsx`,
`people.jsx`, `Settings.jsx`, `SearchPage.jsx`, `ReverifyReview.jsx` — were scroll
containers the sweep could not see, so none was checked for `overscroll-behavior`. The
file's own header says the failure mode is "someone adds `overflow-y: auto` next year and
never thinks about chaining", which is precisely what a `className` does.

**FIXED.** The sweep now reads every `.jsx` in `src/` for a `className` carrying an
overflow utility and requires each to carry something that CONTAINS the scroll — either
the utility (`overscroll-contain`) or a class the stylesheet gives an
`overscroll-behavior`, resolved from the same parse. All nine pass today, every one of
them through `.tp-scrim`; resolving it rather than allowing `.tp-scrim` by name is what
keeps that honest — drop the property from that class and the sweep goes red. Verified by
adding one unguarded `overflow-y-auto` to a component: the sweep named the file and the
line.

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

### 3.5 FIXED — `onCreditNote` edited the wrong cast row

`identity.jsx` discards the credit it is handed: `identityLocal.jsx:169` passes
`onNote: (a) => onCreditNote?.(a)` and `creditRows` binds it per credit, but
`char-crednote` is bound to `form.here_note ?? here.credit_note` and saved by
`saveAppearance(here, …)` — always `here`, the row the panel was opened on.

**Failure:** a character with two credits on one film — an on-screen performer and a dub,
the case 0063 exists for — pressing the **dub's** ✎ edited the **performer's** note. It was
invisible while 3.1 made the field unreachable, so fixing 3.1 is what made it live.

The note is now the only field on that form which belongs to a **credit** rather than to
the casting the sheet is about: `noteCredit` holds whichever pencil was pressed, the box is
labelled for that performer, and the save goes to that row rather than riding along with
`here`'s part and age. Verified in Chromium against a character billed twice on one film —
pressing the dub's ✎ labels the box "Note on Ranjit Sinha's credit" and loads the dub's own
note.

### 3.5b FIXED — the cast POST validated six fields and wrote none

`cast_handlers.go`'s INSERT named `description` and nothing else, and its revive branch
built its `set` from `req.Description` alone — while `castEdit` declares all six of 0063's
fields and `validate` checks and caps all six. So a POST carrying `credit_lang` was
validated, answered **201**, and dropped it. `handleUpdateCast` walks `creditFields()` and
writes them; the add path never learned to.

**It was live in a control that shipped an hour before it was found.** "Add a dubbing
credit" sends `credit_lang`, and that field is the *only* thing that makes a credit a dub —
`creditsFor` on the client splits on it — so a language typed there vanished and the row
came back filed under the original cast.

**Why the suite missed it.** `TestTheSixCreditFieldsRoundTrip` POSTs `{character, actor}`
only, then asserts the six survive a **PUT**. Its own header names the risk — "six columns,
one validator loop, one set-builder" — and there are **two** set-builders. Both now append
from `creditFields()` so a seventh field cannot reach the validator and miss a writer, and
`TestTheSixCreditFieldsSurviveTheADDPathToo` fails on all six without the fix.

### 3.5c FIXED — the ⋯ opened an EMPTY card on six of twelve screens

Found by `make controls`, which presses every control on every screen and asks whether
anything changed. Nothing here was invisible to a reader; it was invisible to every kind
of check this repo had.

`ScreenMenu` builds its rows when it opens: whatever the screen published through
`useScreenBar`, plus a Help row when `withHelp`. The desktop bar passes `withHelp={false}`
because it draws its own ? two controls away, and the reasoning for that is sound while
the screen has published something. But Home, Quotes, Search, People, Stats and Settings
publish NOTHING on a desktop — their `useScreenBar` rows are `mobile &&` gated, or they
set only `sub` — so on half the app the ⋯ opened a floating card with no rows in it at
all. The component's own comment had already reached the right conclusion and the code did
not follow it: "a menu claiming to be complete that omitted it would be wrong on the
several screens where the screen itself publishes nothing at all."

`withHelp` is now a preference rather than a veto: false while the screen published
something, ignored when it published nothing. An empty menu is worse than the same door
twice.

**Why no existing check could have seen it.** Every screen rendered, the button opened, the
menu appeared, and the defect was the ABSENCE of rows in a box one line tall. A screenshot
review would have to notice a small empty card; a unit test would have to know to ask.
`controls.mjs` asks of everything, which is the only reason this surfaced.

### 3.6 OPEN — `LinkCastRow` leaves a stale `actor_id` when a performer is cleared

`internal/store/identity.go:614-626` guards the re-link with `if !aid.Valid && actor != ""`
and writes the scanned `aid` back regardless. Clearing a credit's performer via
`PUT /cast/{id}` leaves `actor_id` pointing at the person while `actor` is `''`, so the row
draws "Not named yet" while `/whos-in-it` (`whos_in_it.go:218`) still lists that person.
`character_works.go:288` does undo the link on removal and is the model.

### 3.7 PART-FIXED — the `open()` window, minus the timer that could not help

The 250 ms `setTimeout(land, 250)` behind the popstate listener is **deleted**. It was dead
on both branches: `land` pushes only onto an EMPTY stack, so the one case the timer named —
no pop arrived, stack still `n` deep — is the case where it abandons, and when the pop did
arrive the listener had already settled it. Not harmlessly dead, either: its firing was the
one path by which a stack emptied by something else, a ✕ pressed inside the window, could be
handed back the panel the reader had just dismissed. Its comment claimed "a late push onto
an empty stack is exactly what was wanted anyway", which describes a case the code cannot
reach. `go(-n)` cannot fail to move here in any event — reaching that branch means `push`
wrote `n` entries.

The listener and its cancellation stay: unmount cancels, a second `open()` cancels the
first, and the functional setter refuses a pop that did not empty the stack. What remains: `usePersonOpener`
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
| **What a row press does** | opens a small titled picker over the sheet — `openPicker` at lines 522, 529, 1032, 1047, 1077, with titles like "Add a performer to this film" | opens `FieldPicker`, a titled sheet carrying that field alone | **FIXED** — was a `<details>` form at the FOOT of the sheet, 600–1000px down, focusing a bare input |
| Portrait verbs | `Fetch` · `Upload` · `Paste URL` as three named buttons, then `Set for the identity` outlined red and dashed | all four, on this sheet and on both global cards; the fourth behind the pack's own confirmation | **FIXED** — and `Upload` had no backend anywhere in the app, so three routes were built for it. One measurement departs: the prototype's inline `min-height:38px` against the pack's own design system, which states 44 twice (`handoff/design-system.md:11`, `:180`). The floor wins and the code says why |
| Picture size | `1280 × 720 px` above the verbs, inked `--error` under the floor | measured off the file itself, inked under 400 × 400 | **FIXED** — `PortraitBlock`, and the number is a measurement rather than the constant string two callers used to pass |
| Header | glyph + name + `in Deathly Hallows – Part 2 · film` + ✕ on one header line | one line: the cover with the medium glyph over it, name above crumb, ✕ | **FIXED** — `ScreenHead` publishes upward through `usePanelHead` and draws nothing itself; `one-header.test.jsx` counts the bars |
| Qualifier chip (`CHAR-FILM`) | present | absent | **Justified** — PLAN.md's eight rulings, #4: "Drop it — the crumb and the cover-with-glyph already say the scope" |
| Credit row | a portrait that opens the person picker, a name that opens their record, `[lang, note].join(' · ')` beneath, a ✎ and a ✕ | was: both controls opening the record, `note \|\| lang` so a dub with a note stopped naming its language, three literal characters for the glyphs, and two silent no-ops on a credit with nobody in it | **WAS WRONG HERE, NOW FIXED** — this row read **Match** on the strength of one detail (the sub-line renders) while three others were broken. The reading looked at what the row DREW and not at what its controls DID, which is the whole difference between a screenshot and a press. `credit-row.test.jsx`, 4 of whose 8 cases fail against the row as it shipped |
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

**FIXED.** `web/frontend/src/identityPicker.jsx` is the pack's sheet, and the local
sheet's eight rows open it: Credited as, Part, First appears, Age here, the sheet's note,
a credit's note, and the two add-a-performer rows. The `<details>` is gone, and with it the
reason `focusField` had to learn to open a closed disclosure.

Three things came out of building it that reading had not shown:

- **`cs-local-fields` matched nothing.** No rule for it exists in `index.css` or in the
  built stylesheet, so the fold drew as the browser's own disclosure triangle in the
  middle of a designed panel. That is most of what "the page only resembles the
  prototype" was pointing at.
- **The pack merges two rows this app splits.** Its own words, at
  `character-popup.dc.html:595`: "'Called here' and 'Also called here' were two rows
  editing one fact… Splitting them made the canonical name look like a different KIND of
  thing from its aliases, when it is only the first of them." So the local sheet's name
  row is now ONE multi-line value whose first line prints; `character` and the `·`-joined
  `aliases` are still the two columns underneath, which is a merge in the sheet and not
  in the schema. The GLOBAL alias list keeps its chips, because `split` is a verb per
  spelling and a line in a box cannot carry one — a departure the file already argues.
- **A "Save" button is not half of a pair.** The two GLOBAL sheets carried the same
  block, and there the fix is smaller and different: the fields become a `<form>` that
  joins the panel's head through `useFormHost`. `GlobalFields` in `identity.jsx` carries
  the argument for why that has to be a component rather than a hook call at the top of
  the body.

  **And a claim made here, in `docs/PLAN.md` and in `a94e141`'s message was false when it
  was written.** All three said the ✓ `PanelHost` draws "arms with a count" and that its
  ✕ is red. It did neither: a bare `IconButton`, no `tp-tick-slot`, no `is-armed`, no
  count badge, no `var(--error)` — those live in `FormModal` and nowhere else. So the
  work that moved three sheets onto the panel's pair moved them onto half a pair, on the
  surface where most of this app's editing happens. Built now, out of the count
  `PanelHost` was already publishing to its own unsaved question, so only the drawing was
  ever missing. `test/dom/panel-tick-pair.test.jsx` renders a panel and looks at its head;
  four of its five cases fail against the version that shipped an hour before it.

  The lesson is the one §2.2 keeps restating: `tick-pair.test.js` scans for callers that
  PASS a `dirty` prop, so a surface that takes the count and draws nothing with it passes
  every case it has. A test that reads source cannot see an absence in a render.

**FIXED since**: the pack's picker is a search-or-type field offering people the app
already knows (`pickerPeople`, `PEOPLE` at line 921) and this one was a plain box.
`identityPicker.jsx`'s `PersonPickerBody` is that field — search over `usePeople(kind)`,
faces or silhouettes, an "is new" row, the language chips — and `person-picker.test.jsx`
fails all eight of its cases against the box it replaced.

What is NOT done here, and is the honest remainder: the picker's `choose` mode. The pack
has four (`person`, `choose`, `note`, and the language variant) and three are built.

### 4.2 Not yet compared

`char-global`, `char-book`, `char-game`, `people-global`, and `book-detail.dc.html` /
`book-detail-wide.dc.html`. The Match Picker and Fetch Results HAVE now been held against
their artboards in `work-details-popup.dc.html` and match. The pair of probes is in place;
the remaining comparisons are not done, and the register carries this as **E3**.

---

## How to retire this file

Per `README.md`'s rule: when the list is empty, delete it. Sections 1 and 3 empty by
being fixed or by the owner ruling them intentional; section 2 empties as each hollow
assertion is replaced by the observable named beside it; section 4 empties as each
deviation is either built to the prototype or given its reason in PLAN.md, which is where
a departure the owner has ruled on belongs.
