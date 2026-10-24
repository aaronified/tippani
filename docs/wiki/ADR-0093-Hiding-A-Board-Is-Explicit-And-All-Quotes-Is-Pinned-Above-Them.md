# ADR-0093: Hiding a board is explicit, and All quotes is pinned above them

Source of truth: this wiki page.

- **Area:** [§4 What a Quote Is](ADR-Index.md#area-4)
- **Status:** Accepted
- **Version:** Not shipped

**Decided.** A board is hidden only when the reader hides it, and a filter shows the hidden ones again. Emptiness never hides anything. The board list also carries one pinned **All quotes** entry, which opens every quote regardless of board; it is not a board, and cannot be renamed, hidden or deleted.

**Why not "empty means hidden".** A board you have just made is empty. The automatic rule would make it disappear at the moment of creation, which is the same class of trap as the one this whole section is undoing — a control vanishing exactly when it is needed. Explicit hiding also matches how a colour category is hidden in Settings, so the app has one idea of what hiding means.

**Hiding never loses anything**, because a hidden board's quotes are still in All quotes. That is what makes hiding safe enough to be a one-tap action instead of a confirm.

**Approved.** The reader's: "Hide boards that user is not using. but keep a filter that enables them at will", and "Yes — an All quotes entry".

<sub>Not shipped</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
