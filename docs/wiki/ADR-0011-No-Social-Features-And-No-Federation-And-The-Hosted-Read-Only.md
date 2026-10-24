# ADR-0011: No social features and no federation — and the hosted read-only page was dropped after being on the list

Source of truth: this wiki page.

- **Area:** [§1 The Target Host, the Budgets, and the Scope They Fix](ADR-Index.md#area-1)
- **Status:** Accepted
- **Version:** pre-1.0

**Decided.** No following, feeds, public profiles, discovery or ActivityPub-style federation.

**Why.** Per-user isolation here is a security property rather than a layout choice — a foreign row answers 404 precisely so nothing leaks between accounts on one box — and a social graph works against the reason for self-hosting at all. Sharing something deliberately is already handled: the share sheet does one quote, the export does a work, a filtered set or the whole library as Markdown.

**Reversal.** A hosted read-only page sat on this list as a wanted thing for a while, and I dropped it. What I got wrong was thinking it was a different feature from the export. It is mostly a worse version of one — the same content, plus a public surface to secure and a link to remember to revoke.

**Approved.** Mine both times, and the reversal is the more useful half: I approved adding it, then approved removing it once I could say what it added over an export, which was nothing.

<sub>pre-1.0 — `docs/roadmap.html`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
