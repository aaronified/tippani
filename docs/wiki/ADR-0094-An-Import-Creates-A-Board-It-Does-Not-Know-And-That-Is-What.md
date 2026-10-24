# ADR-0094: An import creates a board it does not know, and that is what makes an old export round-trip

Source of truth: this wiki page.

- **Area:** [§4 What a Quote Is](ADR-Index.md#area-4)
- **Status:** Accepted
- **Version:** Not shipped

**Decided.** `board: Kennedy` in a Markdown import creates a Kennedy board and files the quote there. A quote with no board key goes to the default board. The old `category` / `kind` / `type` keys are accepted as aliases and their values are treated as board names.

**Why, given the current rule is the opposite.** Today an unknown category is a 400 with the offending value named, and that was right when the set was three values the server defined. Once boards are the reader's own, an unknown name is not an error — it is a board they have not made yet, and refusing the file would mean hand-making every board before importing. It also means **a file exported from an older version imports cleanly**, because `category: proverb` simply finds or creates a board called proverb.

**The cost, stated.** A typo creates a board. That is visible in the list and fixable by renaming or deleting it, which is a far cheaper failure than a refused import — the same reasoning 1.13.1 used for credit suffixes, where a wrongly-split name is visible and a wrongly-merged one hides a whole person.

**Approved.** The reader's, in the form "Create the board."

<sub>Not shipped</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
