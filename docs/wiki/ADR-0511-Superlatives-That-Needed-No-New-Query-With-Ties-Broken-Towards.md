# ADR-0511: Superlatives that needed no new query, with ties broken towards the earlier answer

Source of truth: this wiki page.

- **Area:** [§14 Boards, Cards, Charts and Popups](ADR-Index.md#area-14)
- **Status:** Accepted

**Decided.** Four more superlatives — the person you quote most, the person you heart most, the decade you return to, who you remember best against who keeps slipping away — with deterministic tie-breaking towards the earlier candidate.

**Why.** The last two needed no new query at all: they had been computed and sent on every request since the recall work landed and nothing had ever drawn them. That is the acceptable version of the argument the Occasions breakdown failed — the difference is that these answer a question a reader actually asks, and the free query is a reason to build them *now* rather than a reason to build them at all. Ties resolve towards the earlier answer so the card does not flicker between two equal candidates on successive loads; a superlative that changes when nothing changed is not a fact. I approved these on the question first and the cost second, which is the order I got wrong on Occasions.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
