# ADR-0641: A quote's chip is the character's face, and the search section decides which face

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** 2.2.0

**Decided.** A dialogue's chip draws the character's stored picture, falling back to the actor's headshot when the role has none. On Search the choice is made by the SECTION: the Actors section draws the actor, every other section draws the character.

**Why the section and not the query.** The search response has been grouped by what matched since the sectioned-search work — `actors` holds the hits where the actor column matched, `characters` where the character did, and the work groups where the words did. So "show the actor when I searched an actor" needed no new server field and no guessing from the query text: the section a row is rendered in already IS the answer. The client passes one `face` prop down and the server withholds nothing.

**The server resolves the picture, not the client.** A quote names its character as text; the picture hangs off a `work_cast` row found by `store.CastKey(name)` — a fold SQLite cannot perform, because its `lower()` has no Unicode tables (0048 says so in capitals). And Search and Home show lines from many works at once, so a client-side lookup would be a request per work AND a second implementation of a fold that has to agree exactly with the Go one. So rows arrive with `character_images` attached, one query per page.

**A list per row, not a path.** A line can name more than one character, entered like tags, so the server splits on the reader's own separators and returns `{name, path}` pairs — the split and the fold have to agree, and both live in Go. The name comes off the LINE rather than the cast row: the fold is for matching and must not leak into what the reader sees.

**Absent rather than empty when there is no picture**, so the client can tell "this role has no art" from "this line names no character" — one falls back to the actor and the other draws nothing.

**One pass at the end of the search handler, and the cost is stated.** Six places produce dialogue hits and the sections are assembled independently by design; threading the lookup through all six would be six chances to forget it, on a field whose absence looks exactly like a role with no art. The pass walks a named list of slices instead — which means a section added later is uncovered until its slice is named there, and the compiler cannot help because the miss is an empty field rather than a type error. The test walks the three sections that matter.

**Verified by removing the pass**, which fails on all three sections at once, and by folding with `strings.ToLower` instead of `CastKey`, which fails only on the curly-apostrophe row — the direction matters, because a curly cast row is folded to straight on write and so matches a straight line even under a plain lowercase.

**Left as the actor deliberately:** the dialogue form's "played by" preview, which exists to answer who plays the chosen character; and a standalone quote's speaker, who is a person rather than a role.

<sub>2.2.0 — `internal/httpapi/cast_images.go` · `internal/httpapi/search_character_images.go` · `web/frontend/src/people.jsx` · `web/frontend/src/SearchPage.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
