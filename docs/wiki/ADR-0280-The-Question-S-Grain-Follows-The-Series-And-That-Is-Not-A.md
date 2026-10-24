# ADR-0280: The question's grain follows the series, and that is not a preference

Source of truth: this wiki page.

- **Area:** [§8 The Review Loop](ADR-Index.md#area-8)
- **Status:** Accepted
- **Version:** Not shipped

**Decided.** `workRef` gains `series` and `seriesIndex` (both tables already carry the columns). A card whose work belongs to a series asks about the **series**, with the siblings collapsed into one option; a show asks which show, never which episode. The volume and the episode move to the reveal. It ships silently, with no setting.

**Why no setting.** A switch between a fair question and an unfair one is not a preference, and offering it would be asking the reader to own a defect. What is worth choosing is which *kinds* of question to be asked — see the next entry.

**The collapse has to reach `choicesFrom`,** which dedupes by string. Two sibling volumes are two distinct titles and survive it, so a "four-choice" card in a five-volume series is really a one-in-four guess between the same book. Collapsing by series key is what makes the option count honest.

**Instead of.** A second "which volume?" step once the series is right — it is the same defect asked politely. Dropping series volumes from the deck — the line is worth remembering; only the question about it was wrong.

**Approved.** The reader's, in the form "a toggle, but for types of questions. not for fair and unfair."

<sub>Not shipped</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
