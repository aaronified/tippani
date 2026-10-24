# ADR-0142: The people review list is keyed on records; /people/names keeps its own question

Source of truth: this wiki page.

- **Area:** [§6 People, Credits and Metadata Providers](ADR-Index.md#area-6)
- **Status:** Accepted
- **Version:** `internal/httpapi/identity_handlers.go`

**Decided.** `GET /people/records` returns one row per `people` row, with works and quotes counted per record and every other spelling it answers to. `GET /people/names` is not retired.

**Why.** They answer two questions and the review screen was asking the wrong one. `/people/names` answers *which names does my library print*: it groups the credit columns, splits them, and a record's id rides along. That is right for a re-verify sweep and wrong for a review list, where one record with three aliases becomes three rows and a record no work prints does not appear at all. The character list beside it has been record-keyed since it was built, and two lists under one heading keyed differently is the thing a reader notices first. A merged Bulgakov reads 12 works and 128 quotes on one row where the spelling list showed four rows of a quarter each.

**The record's PORTRAIT, BIO AND PROVIDER LOOKUP are still keyed `(kind, name)`, and that is 2b-2's work rather than an oversight.** `POST /people/lookup`, `POST /people/portrait` and `PUT /people` all address a person by their displayed name; `PUT /people/id/{id}` deliberately takes only the identity fields. Porting those three to the record is half of the answer given when the panel was chosen to replace the modal, and the id-keyed routes are **not** in this commit — building a portrait endpoint with no caller would repeat exactly what 0059 was criticised for, shipping a write-only surface and describing it as done. They land with the panel that calls them, and until they do a portrait saved from the modal is still saved by name, with the ambiguity that implies now that two records may genuinely share one.

**A record's roles are DERIVED from its links, not read from `person_kinds`.** 0027's table is written by the enrichment upsert — `PUT /people`, the modal that saves a bio and a portrait under a `(kind, name)` — and **not** by the credit path 0056 introduced. So a record created by adding a book is filed under no role at all, which is most records in any library, and reading the table here would have drawn an empty roles cell on nearly every row. 0056's own note asked for exactly this check — *"`person_kinds` becomes derivable from the credit rows; check before keeping it"* — and this is it coming back derived: `work_person.role`, plus `actor` from a cast pairing or a linked film line, plus `speaker` from a linked standalone quote. The table is left in place rather than dropped, because the `kind=` endpoints are a namespace for saved enrichment and still mean what they meant.

**`credit_as` is folded in with the aliases, though the schema keeps them apart.** An alias says *this spelling finds this record*; a `credit_as` says *this cover prints it this way*. Both are spellings of the person that a reader will meet, and a list asking "is this one person or several" wants them on one line.

<sub>`internal/httpapi/identity_handlers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
