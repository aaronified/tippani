# ADR-0696: A person and a character are reached by id, and the name endpoints stay

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** Unreleased

- **Decided** — `internal/store/identity.go` and `internal/httpapi/identity_handlers.go`
  add the id-keyed half: `GET/PUT /people/id/{id}`, aliases on both tables, character
  CRUD, and `PUT /cast/{id}/link` for the pairing. The existing name-keyed `/people`
  endpoints are untouched.
- **Why both.** The Metadata console asks a question about NAMES — its list is built
  from the credit columns and a saved row is folded in where one matches — and
  re-pointing those endpoints at ids would answer a different question than the screen
  is asking. The panel asks about a RECORD. Two questions, two endpoints.
- **`/people/id/{id}` rather than `/people/{id}`**, because `DELETE /people/{id}` already
  means something and Go's mux would route the pair to siblings that disagree about what
  the segment is. A segment naming the key is cheaper than renaming a route the client
  already calls.
- **Every update field is a pointer**, so absent and empty are different. A panel that
  edits one field sends one field; a struct of plain strings would clear the rest, which
  is the shape of bug that eats a bio nobody was editing.
- **A rename through the record recomposes only the works it is on** — the handler knows
  which link rows point at it. Rename-by-NAME still re-derives the whole account, and for
  the opposite reason: its id list does not say which table each came from.
- **An alias collision is a 409 and a sentence, not a 500.** The store refuses three
  things — empty, no such record, a spelling somebody holds outright — and all three are
  facts about the reader's library they can act on.
- **`work_cast` spans books as well as films**, which the first draft of both cast reads
  got wrong by joining `movies` alone: every book character was invisible to the character
  page while looking exactly like a character in no works. Caught by the test that seeds
  one character into a novel and its adaptation.
- **Aliases sort alphabetically, not by insertion**, because 0056 declared both alias
  tables `WITHOUT ROWID` and there is no insertion order to sort by.
- **Deleting a character undoes the pairing, not the cast.** `character_id` is
  `ON DELETE SET NULL`, so every work still lists the character by the name printed on
  it. "These are not one character after all" must not take a work's cast list with it.

<sub>Unreleased — `internal/store/identity.go` · `internal/httpapi/identity_handlers.go` · `internal/store/migrations/0057_character_links.sql`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
