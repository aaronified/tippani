# ADR-0286: A work option is shown by its picture and a person by their chip, and nothing shows both

Source of truth: this wiki page.

- **Area:** [§8 The Review Loop](ADR-Index.md#area-8)
- **Status:** Accepted
- **Version:** v3.0.0

**Decided.** A multiple-choice option that names a WORK carries that work's cover or poster and no face. An option that IS a person carries their portrait chip. The slot is reserved whether or not a given work has art, so four options align. The attribution block on a card that reveals its source shows the same art beside the title.

**Why the old rule was a category error.** `workRef.person()` credited each work option with a person — a book's author, a screen work's *first dialogue actor*, falling back to its director. So a film title was offered with the photograph and name of one of its actors under it, on the one card whose job is to ask which of four things this is, while the film's own poster — drawn on every other screen in the app — was the one thing on the card with no picture. The reader's report names it exactly: *"the movie quiz where actor name and chip is accompanied with movie"*.

**The cost, stated.** A book option no longer shows its author, and a speech has no art at all, so an utterance option is now its title alone. That is accepted rather than overlooked: the title of a speech already *is* its attribution (`utteranceAttribution` falls back to the speaker's name), and a per-option fallback to a face would reinstate the same confusion for exactly the works whose covers are missing.

**Approved.** The reader's, in the form "for all work options, they should be accompanied with their posters. All people with their chips. Simple rule."

<sub>v3.0.0 — `internal/httpapi/review_handlers.go` · `web/frontend/src/review.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
