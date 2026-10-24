# ADR-0908: The bin covers everything a delete takes

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

Deleting a work parks its source file (in `Sources/.trash`) and its stored context in the bin snapshot with it, and Undo brings
them all back. Emptying the bin removes the parked file for good. The account bin covers sources too. The owner's statement:
"bin shall cover everything".

**Rejected.** A bin that restores rows and not files: an undo that quietly loses the context is worse than no undo.

See also: [ADR index](ADR-Index.md) · [Home](Home.md)
