# ADR-0467: No label over the portrait, and a label over the cover

Source of truth: this wiki page.

- **Area:** [§13 Controls, Labels, Icons and Help](ADR-Index.md#area-13)
- **Status:** Accepted
- **Version:** 3.1.0

**Decided.** The picture block on a person's record draws the face and its verbs with no `MonoLabel` above them; a work's cover keeps its label.

**Why.** Handoff §1.4. A round face with four picture verbs, under a panel already titled with the person's name, is not ambiguous — the word "portrait" over it is the interface explaining a picture of a face. A cover is different: it sits among eleven other named fields, and a picture with no label in a column of labelled rows reads as belonging to the row above it.

<sub>3.1.0 — `web/frontend/src/identity.jsx` · `internal/i18n/en.txt` · `internal/i18n/bn.txt`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
