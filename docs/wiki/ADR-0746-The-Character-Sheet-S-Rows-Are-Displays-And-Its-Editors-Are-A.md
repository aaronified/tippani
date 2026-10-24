# ADR-0746: The character sheet's rows are displays and its editors are a form, which the pack does not do

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** Unreleased

*Recorded because the owner's instruction is that no line may deviate from the prototype
without being expounded upon, and this is the largest deviation in the app.*

- **The pack has no editor form.** `character-popup.dc.html` gives every row an
  `openPicker` — a small titled overlay carrying that one field ("Add a performer to this
  film", "Add a dubbing credit"). The app instead appends a `<details>` block at the foot
  of the sheet, so pressing a row scrolls 600–1000px away from what was pressed and lands
  the caret in an unlabelled box.
- **`identity.jsx`'s own comment defended this as the pack's shape** — "the pack's screens
  print a saved value as a row and let you press it; the editor is one field further
  down". The first half is true and the second is not: there is no such field anywhere in
  the prototype. The claim went unchecked because the prototypes could not be rendered in
  the build environment at all until `scripts/screenshots/proto.mjs`.
- **Built.** `identityPicker.jsx` is the pack's sheet and the local sheet's eight rows
  open it. The `<details>` is gone, and with it the reason `focusField` had to learn to
  open a collapsed disclosure — the two global scopes still call it, so the walk stays.
  Three findings came out of building it that reading had not produced:
  - **`cs-local-fields` matched no rule.** Not in `index.css`, not in the built
    stylesheet. The fold drew as the browser's own disclosure triangle inside a designed
    panel, which is most of what "the page only resembles the prototype" was.
  - **The pack merges a row this app splits, and says why.** At
    `character-popup.dc.html:595`: "'Called here' and 'Also called here' were two rows
    editing one fact… Splitting them made the canonical name look like a different KIND
    of thing from its aliases, when it is only the first of them." The local sheet's name
    row is now one multi-line value whose FIRST LINE PRINTS; `character` and the
    `·`-joined `aliases` remain two columns, so the merge is in the sheet and not the
    schema. **Departure kept:** the GLOBAL alias list stays a chip row, because `split`
    is a verb per spelling and a line in a text box cannot carry one.
  - **A "Save" button is not half of the standing pair**, and all three identity sheets
    had one. The globals' fix is different from the local one's and smaller: their fields
    become a `<form>` joining the panel head through `useFormHost`. **The first version of
    this said the ✓ `PanelHost` "already draws" arms with a count and that its ✕ is red,
    and neither was true**: that head drew a bare `IconButton` with no `tp-tick-slot`, no
    `is-armed` and no count badge, and its ✕ had no `var(--error)` — all of which existed
    only in `FormModal`. Half the standing rule was missing from the surface where most of
    this app's editing happens, and asserting it in three places did not put it there. It
    is built now, with the count `PanelHost` was already publishing to its own unsaved
    question, and `test/dom/panel-tick-pair.test.jsx` renders a panel and looks at the
    head — four of its five cases fail against the version that shipped an hour earlier.
    Why the form must
    be a component rather than a hook call at the top of the body is argued at
    `GlobalFields` — `useFormHost` cannot say "there is no form here", so a hook at the
    top of a body rendering three scopes draws a ✓ on all three and two of them submit
    nothing.
- **Still deviating, and named rather than quietly dropped.** The pack's picker is a
  search-or-type field offering people the app already knows (`pickerPeople`, its `PEOPLE`
  list at line 921); this one is a plain box, so adding a performer means typing the name.
  The four smaller deviations — the portrait's three named verbs, the pixel size above
  them, the header's one-line arrangement — are unchanged. All of it is in
  `docs/plans/codebase-audit.md` §4.1.

<sub>Unreleased — `web/frontend/src/identityPicker.jsx` · `identity.jsx` ·
`identityLocal.jsx` · `docs/design/prototypes/character-popup.dc.html`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
