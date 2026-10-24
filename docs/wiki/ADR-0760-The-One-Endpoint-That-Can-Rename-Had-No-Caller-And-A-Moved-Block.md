# ADR-0760: The one endpoint that can rename had no caller, and a moved block left its scope

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** Unreleased

**THE OWNER: "i am unable to change the canonical name or add aliases (global character
screen)."** Both halves were true, and the second was the more misleading of the two: the
pencil DID do something — it toggled a chip row at the FOOT of the sheet, far below the row
that opened it — so the control read as dead while working exactly as written.

**AND `PUT /{characters|people}/{id}/names` HAS EXISTED SINCE 0056 WITH NO CALLER.** It
replaces the whole set and makes the first non-empty line the name that PRINTS —
`store.setNames`, whose own note says "the field's whole point is that the printing name may
have moved". Nothing in the app had ever called it. That is the third write path this session
has found with a server, a contract, a comment describing its use, and no UI (after
`movies.fandom_wiki` and `work_cast.aliases`), which is worth naming as a pattern rather than
a coincidence: an endpoint written alongside a screen that was then built to a different
sketch leaves no compile error and no failing test.

**A SECOND FLAVOUR OF THE SAME THING, one screen over:** `onRename` was passed to
`PersonGlobal` from `identity.jsx`, and `PersonGlobal` has never declared the prop. So the
person's sheet could not rename either, and nobody had reported it because the row gave no
sign it was meant to. Prop deleted; both sheets now open one field.

**THE CHIPS KEEP SPLIT AND GIVE UP THE REST.** "Give this spelling its own record" is a verb
per spelling and a textarea has nowhere to put it, so the chip row stays — no longer behind
the pencil, and drawn only when there IS a spelling to split. Its add box and its ✕ are gone,
because the names field owns adding and removing now and two editors for one fact is what the
local sheet's own "ONE EDITOR, NOT TWO" note was written about. `AliasRow` gates both on their
handlers, which is the pattern `onSplit` already used in that component.

**THE PAIR MOVES ABOVE THE LINKS SECTION** — the owner's placement, "just above links section,
for all popups" — on the three sheets that have one. A character inside one work has no links
of its own (a link is a fact about the record, not about one work), so the pair keeps its
place under the portrait there, which is the same relative position it holds on the others.

**AND MOVING IT BROKE 85 TESTS, WHICH IS THE PART WORTH RECORDING.** On the work's details the
links section is a CHILD COMPONENT (`WorkIds`), so anchoring "above the links section" on the
`SectionHead` INSIDE it moved the pair across a component boundary: it went on reading
`workQuotes` and `onSearch`, which are `FieldList`'s, and every test that mounts that sheet
died on `ReferenceError: workQuotes is not defined`. The screen would have looked identical
in a mockup and thrown on open. `no-free-names.test.js` is the guard that named it, and it is
the reason a JSX move is not a text move.

**WHAT I COULD NOT REPRODUCE, and the first diagnosis I withdrew.** The owner also reported
that the work chooser's "this character, as this work has them" row lands back on the global
sheet. My first test said it did — `global: true, local: false` — and that reading was WRONG:
the markers I chose were "Reaches every work", which `identityLocal.jsx:421` draws too, and
"Played by", which a BOOK never draws because `scope.performer` is `none` by design. Probed
properly, `here` resolves to the cast row and `scope.id` is `char-book` on one book and on
two. So the route is correct in jsdom and the defect is somewhere jsdom does not model. One
thing found while looking, recorded because it is a real divergence from a stated contract:
`choosePanel`'s own header says "every row here answers with `stack.open(...)`, which REPLACES
the top", and three rows use `stack.push` instead (identity.jsx's work chooser twice, and the
person sheet's role chooser). Not changed, because changing panel history on a hypothesis is
how the "pill still does not open" regression that comment describes happened.

<sub>Unreleased — `web/frontend/src/identity.jsx` · `identityGlobal.jsx` · `identityLocal.jsx`
· `WorkDetails.jsx` · `internal/i18n/en.txt` · `bn.txt` ·
`test/dom/record-names.test.jsx` (new) · `identity-panel.test.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
