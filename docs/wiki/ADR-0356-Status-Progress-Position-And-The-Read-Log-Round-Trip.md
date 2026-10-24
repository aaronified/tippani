# ADR-0356: Status, progress, position and the read log round-trip, fill-empty-only

Source of truth: this wiki page.

- **Area:** [§10 What Leaves the App: Exports, Round-Trips and the Shared Image](ADR-Index.md#area-10)
- **Status:** Accepted
- **Version:** `internal/httpapi/export_handlers.go`

**Decided.** `status`, `progress`, `page: 96/214`, `season: 2/3`, `episode: 6/10` and `reads: 2019-03-04 — 2019-04-01; 2021 — 2021-02 (abandoned); 2026-07 —` all export and re-import, and every one of them is fill-empty-only on the way back.

**Why.** Reading state is the part of a library that is most annoying to reconstruct by hand and was the last part the export did not carry. Fill-empty-only is the whole safety story: re-importing an old export must not un-mark what you are reading now, and must not duplicate a history that is already there. It is the same rule the series fix uses and the same rule the bulk metadata refetch uses, which is why it is worth naming once rather than three times. I approved it alongside the rule that `PUT /books|movies/{id}/status` is the only path that changes any of them — an ordinary Edit-form save must never be able to rewrite reading history.

<sub>`internal/httpapi/export_handlers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
