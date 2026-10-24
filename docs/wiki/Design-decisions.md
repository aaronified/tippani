# Design decisions

Source of truth: this wiki page.

Every design decision made in this project is an [architecture decision record](ADR-Index.md), one page each: the reasoning that
produced it, the alternative turned down and, where it applies, the part that was wrong and what changed the mind. They used to
live in one long log. That log is now split into the pages the index lists, and this page keeps what the log gave the rest of the
repository: the area numbers that code and pages cite (`Design-decisions.md §4`) and the owner's approval statement.

## Approval

Everything recorded here was approved by the owner. One person builds this, so there is no committee to hide a decision behind: a
thing is in the repository because the owner looked at it and said yes. Where a decision carries its own **Approved** line it is
because there is more to say: that it was signed off on a summary rather than on the code, or that a claim of the owner's own was
corrected. Where it has none, this statement is the whole of it. Where the owner said yes on thin reasoning, by default or by
silence, the record says so: "approved by silence" is a real approval and a weaker one.

A decision made while 3.1.0 was being built and put to the owner afterwards waited for a ruling; the ruling is recorded on the
decision's page.

## What a decision record is not

It does not say how to build or test the app ([Developing](Developing.md), [Testing](Testing.md)), what is coming
([Roadmap](Roadmap.md)) or what a piece of the interface is called ([UI glossary](UI-Glossary.md)). It records **why**, and only why.
A decision not to build something is recorded too, so that a deferral is not mistaken for an omission.

A feature's design is a [plan](Plans-Index.md) while it is unbuilt. The moment it ships it is folded into an ADR, with a pass on
what the plan got wrong, and the plan page is deleted.

## How to write one

A new decision is a new page, `ADR-NNNN-Title.md`, numbered after the last one, with an **Area** and a **Status** line, added to
the [index](ADR-Index.md). A page is never renumbered. A decision that is reversed gets a new ADR that says what it replaces, and
the old page's status says it was superseded.

## The areas

- **§1. The Target Host, the Budgets, and the Scope They Fix**: 14 decisions, [listed in the index](ADR-Index.md#area-1)
- **§2. Ownership, Authentication and Exposure**: 18 decisions, [listed in the index](ADR-Index.md#area-2)
- **§3. The SQLite Contract: Durability, Locking, Migrations and Deletion**: 32 decisions, [listed in the index](ADR-Index.md#area-3)
- **§4. What a Quote Is**: 38 decisions, [listed in the index](ADR-Index.md#area-4)
- **§5. Works, Shelves and Reading History**: 27 decisions, [listed in the index](ADR-Index.md#area-5)
- **§6. People, Credits and Metadata Providers**: 70 decisions, [listed in the index](ADR-Index.md#area-6)
- **§7. Search and the Full-Text Index**: 35 decisions, [listed in the index](ADR-Index.md#area-7)
- **§8. The Review Loop**: 85 decisions, [listed in the index](ADR-Index.md#area-8)
- **§9. Import and the Staging Queue**: 30 decisions, [listed in the index](ADR-Index.md#area-9)
- **§10. What Leaves the App: Exports, Round-Trips and the Shared Image**: 29 decisions, [listed in the index](ADR-Index.md#area-10)
- **§11. Backup, Restore and Recovery**: 24 decisions, [listed in the index](ADR-Index.md#area-11)
- **§12. Shell, Navigation and Entry Points**: 27 decisions, [listed in the index](ADR-Index.md#area-12)
- **§13. Controls, Labels, Icons and Help**: 40 decisions, [listed in the index](ADR-Index.md#area-13)
- **§14. Boards, Cards, Charts and Popups**: 79 decisions, [listed in the index](ADR-Index.md#area-14)
- **§15. Appearance as Material: Skins, Texture, Type and Colour**: 18 decisions, [listed in the index](ADR-Index.md#area-15)
- **§16. Serving and Running It: HTTP Surface, Logging, TLS and Updates**: 22 decisions, [listed in the index](ADR-Index.md#area-16)
- **§17. Verification, Release Engineering and Provenance**: 177 decisions, [listed in the index](ADR-Index.md#area-17)
- **§18. Jobs and Logs**: 21 decisions, [listed in the index](ADR-Index.md#area-18)
- **Later decisions**: 117, in the order they were made, [listed in the index](ADR-Index.md#later-decisions)

See also: [ADR Index](ADR-Index.md) · [Home](Home.md)
