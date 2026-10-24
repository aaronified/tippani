# ADR-0308: A work-level character can be given another work, and the second credit IS the promotion

Source of truth: this wiki page.

- **Area:** [§8 The Review Loop](ADR-Index.md#area-8)
- **Status:** Accepted
- **Version:** 3.1.0

**Decided.** The work-level sheet grows one row — *"Also in another work"* — which opens the same work chooser the global sheet's works strip opens, through one named handler both sheets are handed. Choosing a work writes a second `work_cast` row for the same `character_id` via the existing `POST /characters/{id}/works`. Nothing else happens, and nothing else needs to.

**Why.** The owner's item 3: *"this character only exist in one work (for now)… there is no easy way to add him to another work from here. i will then need to add a separate character and then merge."* That route works and is three screens and an undo away from what they meant. The owner's framing — *"that will get added to the global-character (which should in turn enable global character for the character as well)"* — suggests two steps, and the data model has one: the global screen is not a flag but a consequence of the credit count, which `openCharacterDoor` tests at the press. So there is no promotion to write, and a test looking for one would be testing something that does not exist.

**Approved.** The owner's, on the one question the plan left them: *"Automatic. no point gating this. because the user can easily remove works as well."* The undo is the ✕ row at the foot of the same sheet — "Remove from this film · Other works keep the character" — so the door swings both ways from one screen.

**Instead of.** A second chooser on the local sheet — refused by the directive that a control drawn on two screens has one behaviour in one function; `CharacterBody` already renders both sheets AND holds the chooser, so the local sheet takes the same handler rather than a copy. And a confirmation step, which the recommendation had argued for on the ground that the record's shape is the one thing on that screen a reader cannot undo by pressing again — overruled, correctly, because the removal row already exists.

<sub>3.1.0 — `web/frontend/src/identityLocal.jsx` · `web/frontend/src/identity.jsx` · `web/frontend/test/dom/second-work.test.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
