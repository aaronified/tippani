# ADR-0282: Question types are a preference, and the filter belongs in reviewSource

Source of truth: this wiki page.

- **Area:** [§8 The Review Loop](ADR-Index.md#area-8)
- **Status:** Accepted
- **Version:** Not shipped

**Decided.** `reviewQuestions`, a comma-separated string of enabled facets, taking the same shape as `reviewScope` and the same failure rule: **an unparseable or unknown value means everything, never nothing.** The eligibility predicate for each enabled facet is OR-ed into `reviewSource`'s `where()`.

**Why it cannot live in the card builder.** `reviewSource` exists because five queries have to agree on what is reviewable, and the recorded symptom of their disagreeing is *a badge promising cards the deck will not serve*. Question types re-introduce exactly that risk, because **not every facet can be asked of every card**: cloze needs a quote long enough to blank a span out of, speaker needs a character, *when* needs a year. So "is there an enabled question this card can support" is a sixth condition on eligibility and belongs beside the utterance clause.

`source` and `quote` are satisfiable by every row, which is what keeps the deck from emptying — and is the reason to make one of them unswitchable in the UI rather than to write a fallback that silently ignores the setting.

**Approved.** The reader's, in the form "yes, a toggle. but for types of questions."

<sub>Not shipped</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
