# ADR-0697: The person panel is three scopes, and each one says its blast radius

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** Unreleased

- **Decided** — `web/frontend/src/identity.jsx`. Three sections: **on this work**
  (`work_person.credit_as`, via `PUT /credits`), **across the library** (what the record
  is in, and the aliases that find it), **the record** (via `PUT /people/id/{id}`). The
  character page is the same shape with two of the three, because a character has no
  work-level credit — its per-work truth is the cast row's picture and description.
- **Why the sentences are not decoration.** The design pack's own words: without the line
  saying *on this work only*, a reader will believe they just renamed the author on 31
  other books. So each section carries its scope in prose above its fields, and the two
  writes go to two different endpoints. A test drives the work-scope Save and asserts
  `/people/id/{id}` was NOT called — verified to bite by wiring them together.
- **Absent, not disabled, where a scope does not apply.** Opened from a list there is no
  work to be on, so that section is not drawn. A greyed "on this work" over no work is a
  control whose only possible outcome is confusion.
- **These are the panel stack's first users.** `usePanelStack` landed with the shell and
  nothing had consumed it. The idiom is set here: a panel is a plain `{title, render}`
  descriptor, and a factory takes the stack so a panel can push its sibling — the person
  pushes the character, the character pushes the performer, and Back is the browser's.
- **A book character's row draws no performer slot.** The pack is explicit: a slot invites
  a value and there is nothing true to put in it.
- **Two defects came out of the first render**, both of the same kind — a component used
  at the wrong scale. `EmptyState` inside a panel section is a page-sized hole where a
  list should be; `IconDelete` inside an alias chip is a 22px trash can beside the word it
  removes. Both are now a line of microcopy and an × at the chip's own size.

<sub>Unreleased — `web/frontend/src/identity.jsx` · `internal/store/identity.go` (SetCreditAs) · `internal/httpapi/identity_handlers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
