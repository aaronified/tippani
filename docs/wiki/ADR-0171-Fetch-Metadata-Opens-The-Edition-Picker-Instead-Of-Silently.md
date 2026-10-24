# ADR-0171: "Fetch metadata" opens the edition picker instead of silently applying a guess

Source of truth: this wiki page.

- **Area:** [§6 People, Credits and Metadata Providers](ADR-Index.md#area-6)
- **Status:** Accepted
- **Version:** `web/frontend/src/WorkDetails.jsx`

**Decided.** The button opens a candidate list; choosing a candidate opens a stored-versus-offered comparison; nothing is written until fields are ticked and applied. The info dot says so before you press it: "Nothing is applied yet."

**Why.** A one-shot fetch has to guess an edition, and editions differ in the fields people care about — the cover, the year, the description, the subtitle. A guess that lands is invisible; a guess that misses replaces something you typed. The picker costs one extra tap and converts an irreversible write into a choice. I approved the three-step shape (fields → lookup → merge) even though it is more screens than a button usually earns.

<sub>`web/frontend/src/WorkDetails.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
