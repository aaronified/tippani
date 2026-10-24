# ADR-0197: A character's page is the destination, and a work is taken off it only after its quotes are dealt with

Source of truth: this wiki page.

- **Area:** [§6 People, Credits and Metadata Providers](ADR-Index.md#area-6)
- **Status:** Accepted
- **Version:** 3.1.0

**Decided.** `identity.jsx` renders a character as a head — the record's own face, its aliases, its appearance count — over one card per work, each wearing that work's cover with the picture that work holds of the character on it. Each card edits the billed name, the performer and the per-work description; the three acts are *replace this work's picture*, *promote it to the record's own face*, and *remove the work*. `DELETE /characters/{id}/works/{castID}` answers **409** while quotes on that work name the character, and the dialog it raises offers to rename them all to somebody else or to clear the speaker.

**Why.** The brief: this is the complete character metadata destination. Before it, a character was a name in a cast row on one work's panel — there was no screen that could answer "which works is this character in, and which of them has a picture of them", and the merge that folds two Woland records into one had nowhere to be offered from.

**A removal that silently orphaned quotes was the failure to avoid.** Taking a character off a work leaves every quote on that work still printing their name, pointing at a cast row that is now a tombstone. Refusing is not enough on its own — it makes the reader hunt the quotes down by hand — so the refusal comes with the two acts that resolve it, and both run in one transaction with the removal.

**A quote is claimed by the cast row it is LINKED to, not by every quote whose text folds to the same key.** `quotesNaming` reads `speaker_cast_id` and falls back to the fold only for a quote that has no live link. Without that, removing *Woland/Basilashvili* from a film offered to rewrite the quotes belonging to *Woland/Gaft* on the same film, because both fold to the same character key — a data-loss bug behind a confirmation dialog that read as if it knew what it was doing.

**Nothing is promoted automatically.** A character with no face of their own says so and points at the works that hold one. Eight Harry Potters are eight records until the reader decides otherwise, and auto-picking the first still would put a face on that decision.

**Instead of.** A flat table of appearances — the cover is what makes a card recognisable, and this is a screen for recognising. Cascading the removal to the quotes — a delete that also edits text the reader did not ask about is the shape of change nobody can undo.

**Approved.** The owner's brief, including the ruling that a cast row and a quote's speaker are one thing in the backend.

<sub>3.1.0 — `web/frontend/src/identity.jsx` · `internal/httpapi/character_works.go` · `internal/store/quote_cast.go` · `internal/httpapi/character_works_test.go` · `web/frontend/test/dom/character-destination.test.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
