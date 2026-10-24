# ADR-0232: A character is not a person, and gets a section rather than a face

Source of truth: this wiki page.

- **Area:** [§7 Search and the Full-Text Index](ADR-Index.md#area-7)
- **Status:** Accepted
- **Version:** 1.16.0

**Decided.** Searching a character's name lands in a **Characters** section — the name, a count, and their lines — and `character:` is a fifth credit facet. The name is a plain chip and a button; there is no portrait.

**Why.** `dialogues_fts` has indexed `character` since 0003, so character search worked all along. What was missing was anywhere for a match to *land*: `ftsCols: "quote character"` put it under the film it came from, so "everything Tyrion says" meant reading six posters and assembling the answer yourself. `actor` has never behaved that way — it is not in the dialogue query's columns at all, so an actor search has always produced an Actors section and an empty Dialogues one. The asymmetry was not a decision; it was the absence of the section.

So `character` moved out of the dialogue columns into its own query. **Dialogues answers "these words matched"; Characters answers "this speaker matched".** A query hitting both still gets both. `import_search_test.go` used to assert the opposite — *"a character query stays a dialogue hit"* — and that assertion inverted, with the comment rewritten from a rule into a record of why it used to be true.

No portrait, and that is the decision rather than an omission. Every other credit section here resolves to a `people` row with a photograph. A character resolves to nobody. Hanging the actor's face there would answer a question nobody asked and be wrong the moment a part is recast or shared — and the review loop had already settled the same point for its *"who said this?"* card: name only.

Games needed nothing: a game is a `movies` row (0040), so its lines are `dialogues` and the whole feature covers them by construction. A regression test says so anyway, because a future `AND media_type <> 'game'` would drop them silently.

**Instead of.** A `people` row per character, with portraits and a console — a different feature at a different price, and one the owner has already ruled against at the interface.

<sub>1.16.0 — `internal/httpapi/search_handler.go` · `internal/httpapi/search_facets.go` · `web/frontend/src/SearchPage.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
