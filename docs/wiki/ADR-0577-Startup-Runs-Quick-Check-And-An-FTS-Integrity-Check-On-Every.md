# ADR-0577: Startup runs quick check and an FTS integrity check on every boot

Source of truth: this wiki page.

- **Area:** [§16 Serving and Running It: HTTP Surface, Logging, TLS and Updates](ADR-Index.md#area-16)
- **Status:** Accepted
- **Version:** 0.4.6

**Decided.** On boot, `CheckIntegrity` runs SQLite's own `PRAGMA quick_check` over the whole file and `RepairFTS` runs an FTS `integrity-check` against each index, reconstructing any that come back broken. Both log to stdout and stderr, and real corruption is alerted loudly — `TIP-STORE-002` with up to twenty problem lines and a count of the rest — so it cannot be missed in the container logs. Neither is fatal: a failure at both repair levels is logged and the server still starts, with search on that scope erroring until Profile → Reset all data. Running this every boot on a NAS is a cost I accepted knowingly; `quick_check` is the cheap variant, and a corrupt database discovered at boot is a corrupt database discovered before it is written to. My call.

**Instead of.** Checking on demand only, which means checking after you already suspect something.

<sub>0.4.6 — `cmd/tippani/main.go` · `internal/store/repair.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
