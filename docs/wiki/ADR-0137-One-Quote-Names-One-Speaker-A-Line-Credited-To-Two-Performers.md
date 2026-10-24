# ADR-0137: One quote names one speaker; a line credited to two performers links to neither

Source of truth: this wiki page.

- **Area:** [§6 People, Credits and Metadata Providers](ADR-Index.md#area-6)
- **Status:** Accepted
- **Version:** `internal/store/quote_person.go`

**Decided.** `SyncQuotePerson` splits the printed name with the account's own separators and links only when it yields exactly one component. A joined actor leaves the row unlinked rather than pointing at the first name in it.

**Why.** `autofillActor` genuinely writes joined actors: a line naming two characters is credited to both their performers, comma-joined. There is no honest single answer to "who said this", and taking the first would put a two-hander into one performer's panel while hiding it from the other's. 0056 had already decided a quote points at one speaker when it gave both tables a single `speaker_cast_id`, so this is that decision applied to the second column rather than a new one. The split is `metadata.SplitCredits` rather than a comma test, so a performer billed "Davis, Jr." stays one person under an account that has the comma separator on.

**The gap, named:** those lines are missing from the performer's panel. The rename's string surgery still reaches them — it rewrites a name as a *component* inside a joined credit, which is exactly what that handler is built for — so nothing the app could otherwise do is lost.

<sub>`internal/store/quote_person.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
