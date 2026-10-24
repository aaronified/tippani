# ADR-0092: Deleting a board asks where its quotes go, which is why no board has to be permanent

Source of truth: this wiki page.

- **Area:** [§4 What a Quote Is](ADR-Index.md#area-4)
- **Status:** Accepted
- **Version:** Not shipped

**Decided.** Deleting a board that holds quotes offers the other boards and moves them; it cannot proceed until one is chosen. A board with nothing on it deletes freely. The consequence is accepted deliberately: **you cannot delete your last board while any quote exists**, because there would be nowhere for its quotes to go.

**Why this rather than a permanent Others.** A permanent bucket is a name in the code, and the entry above exists to keep names out of the code. This achieves the same guarantee — no quote is ever orphaned — through a rule about the *operation* instead of a rule about one privileged row.

**Instead of.** Deleting the quotes with the board, the way deleting a book takes its annotations: a book genuinely contains its annotations, whereas a board is a place a reader filed something, and unfiling should not destroy it. Allowing board-less quotes with an Unfiled tile: it makes `board_id` nullable, and every count, filter and query then carries a null case forever to serve a state the reader can always avoid.

**Approved.** The reader's, in the form "Ask where they go, and refuse until told."

<sub>Not shipped</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
