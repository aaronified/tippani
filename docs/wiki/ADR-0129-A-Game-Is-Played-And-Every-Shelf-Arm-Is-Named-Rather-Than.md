# ADR-0129: A game is played, and every shelf arm is named rather than defaulted

Source of truth: this wiki page.

- **Area:** [§5 Works, Shelves and Reading History](ADR-Index.md#area-5)
- **Status:** Accepted
- **Version:** 0040

**Decided.** `StatusPlaying` joins the status vocabulary; `activeStatus` and `normalizeStatus` take the media type as well as the kind; `shelfCap` gains a `game` arm of **3**; and its bare `default:` is gone, replaced by named arms plus a warned fallback (`TIP-SHELF-001`).

**Why.** `shelfCap` ended in `default: return 2`, so a game would have inherited the film cap on the strength of a fallthrough rather than a decision. Three is the decision: more than a film, because a long game sits unfinished for months and two would nag constantly; fewer than a book, because you cannot really be playing five at once.

The subtler one was `bulkSetStatus`, which validates **one** status word for a whole selection. A catalogue selection can hold films and games together, so the choices were to refuse mixed selections — which this file's own comment already rejects for the completed-work case, on the grounds that a bulk action must not fail on a property of its least convenient member — or to write the literal word through, which stamps `watching` onto a game. Neither. The word is validated against the *set* of active words for the kind and resolved **per row** against that row's own `media_type`.

**Approved.** My call.

<sub>0040 — `internal/httpapi/shelf.go`, `internal/httpapi/bulk_handlers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
