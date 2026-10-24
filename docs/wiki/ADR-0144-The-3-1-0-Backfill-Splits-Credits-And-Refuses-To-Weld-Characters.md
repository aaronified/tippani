# ADR-0144: The 3.1.0 backfill splits credits and refuses to weld characters

Source of truth: this wiki page.

- **Area:** [§6 People, Credits and Metadata Providers](ADR-Index.md#area-6)
- **Status:** Accepted
- **Version:** `internal/store/onetime_3_1_0_person_identity.go`

**Decided.** The one-time pass splits existing credit strings with `metadata.SplitCredits` under **each account's own** separator preference, and creates a character record **per work** rather than resolving by name.

**Why.** Both halves follow one rule the repo had already written down, in `board_handlers.go`: *a wrongly-split name is visible and a wrongly-merged one hides a whole person.* A wrong split puts two rows on a screen where they can be merged back. Resolving characters by name would silently weld every "Narrator", "Mother" and "The Doctor" into one record spanning forty unrelated works, and nothing on any screen would say so. Eight Harry Potter films therefore come out as eight Harry Potters, visible in the character list and mergeable in one act.

**Instead of** a SQL backfill, which cannot split at all, and instead of the global separator set, which would decide for a reader whether `&` means two people.

<sub>`internal/store/onetime_3_1_0_person_identity.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
