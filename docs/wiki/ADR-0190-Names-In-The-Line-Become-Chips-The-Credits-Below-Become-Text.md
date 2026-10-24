# ADR-0190: Names in the line become chips; the credits below become text

Source of truth: this wiki page.

- **Area:** [§6 People, Credits and Metadata Providers](ADR-Index.md#area-6)
- **Status:** Accepted
- **Version:** Not shipped

**Decided.** A film or show line has its character names found in the quote text and drawn as chips in place. The block beneath, which currently shows actor portrait chips, becomes a plain **character — actor** list. The person keeps their ordinary people chip everywhere else; this changes only how a film's own page reads.

**Why.** The portraits below the line were answering a question the reader did not have. What they want while reading a line is *who is speaking*, which belongs in the line, and the mapping is a footnote — so the picture and the text were the wrong way round. Putting the chip on the name in the text also makes the line self-describing when it is shared or exported out of context.

**The matching is over the alias set** from the entry above, longest-first so "William Rookwood" is matched before "William", and case-insensitively at word boundaries so a character called Will is not found inside "willing".

**Approved.** The reader's, in the form "whose names will be highlighted in the card itself with their people chips. the bottom area where the actor chips sit now, will only name the character-actor mapping, not their image chips."

<sub>Not shipped</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
