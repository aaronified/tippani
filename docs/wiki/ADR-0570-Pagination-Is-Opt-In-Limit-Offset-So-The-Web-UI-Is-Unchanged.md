# ADR-0570: Pagination is opt-in limit/offset, so the web UI is unchanged

Source of truth: this wiki page.

- **Area:** [§16 Serving and Running It: HTTP Surface, Logging, TLS and Updates](ADR-Index.md#area-16)
- **Status:** Accepted
- **Version:** 1.1.0

**Decided.** `/books` and `/movies` previously had no limit at all and shipped the whole library on every call; `/annotations` and `/dialogues` capped at 500 with no way to reach anything past it. Both now accept `limit` and `offset` — and sending neither still returns everything. That is the whole design: an installed client gets paging, the web UI is not touched, and the migration risk is zero because there is no behaviour change to migrate. I approved the opt-in shape over a default page size specifically because a default would have silently truncated every existing caller, including the SPA.

**Instead of.** A default page size, which is the more usual API design and would have been a breaking change dressed as an improvement.

<sub>1.1.0 — `internal/httpapi/capabilities_handler.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
