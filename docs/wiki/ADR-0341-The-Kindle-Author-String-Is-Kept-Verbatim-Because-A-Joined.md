# ADR-0341: The Kindle author string is kept verbatim, because a joined credit and a reversed name are indistinguishable

Source of truth: this wiki page.

- **Area:** [§9 Import and the Staging Queue](ADR-Index.md#area-9)
- **Status:** Accepted, then changed or withdrawn: the entry says how
- **Version:** 1.0.0

**Decided.** The author is the *last* parenthesised group on the title line, and whatever it says is what the book gets. A group that reads as a printing detail rather than a person — a year, "(Unabridged)", "(Book 3)" — is left on the title.

**Why.** Kindle writes both "(Marshall, Michael)" and "(Margaret Hunt, Wilhelm Grimm, Jacob Grimm)", and the two are indistinguishable without guessing. Re-ordering the first would mangle the second, and splitting on " and " / " y " would turn José Ortega y Gasset into two people. Taking the last group is what lets "Dracula (Penguin Classics) (Bram Stoker)" keep its own brackets.

**Instead of.** Normalising "Last, First" — rejected on the ambiguity.

**Approved.** I approved doing nothing here, which is a decision as much as any transform is: the cost of a wrong guess is a corrupted credit, and the cost of no guess is a credit that reads slightly oddly.

<sub>1.0.0 — `internal/importer/kindle_clippings.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
