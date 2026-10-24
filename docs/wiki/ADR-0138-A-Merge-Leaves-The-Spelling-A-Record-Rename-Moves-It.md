# ADR-0138: A merge leaves the spelling; a record rename moves it

Source of truth: this wiki page.

- **Area:** [§6 People, Credits and Metadata Providers](ADR-Index.md#area-6)
- **Status:** Accepted

**Decided.** `MergePeople` re-points every quote id to the survivor and records them for undo, and never touches the printed name. `handleUpdatePersonByID` does the opposite: renaming the record rewrites `actor` / `speaker` on every quote linked to it.

**Why.** They are different claims. A merge says *these two records are one person*, which is silent about how any work spells it — the faithful-column promise. A rename says *this person's name is spelt this way*, which is a statement about the spelling, and leaving the old one printed would have a record answering to a name none of its quotes carries. That state is not merely untidy: `personAnswersTo` would return false for every one of those quotes, so the next unrelated edit to any of them would resolve the old spelling into a **brand-new record** — splitting one person into two, one quote at a time, from a write the reader made about something else.

**A rename by name is still a rename.** `POST /people/rename` goes on rewriting strings, because correcting a misspelling everywhere is what it is for. What changed is that the duplicate card no longer uses it: two spellings of one person are a merge.

**Ordering that is load-bearing:** `SyncAllQuotePeople` runs at the *end* of `handleRenamePerson`, after its delete loop. The foreign key is `SET NULL`, so re-deriving beside `SyncAllCredits` — three statements earlier, the obvious place — would have those deletes wipe the links it had just made, with nothing raised.

<sub>`internal/store/quote_person.go` · `internal/store/identity.go` · `internal/httpapi/people_handlers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
