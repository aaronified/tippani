# ADR-0002: Hard runtime caps: GOMAXPROCS=1, GOMEMLIMIT=64MiB, GOGC=200 — defensive towards the neighbours, not the app

Source of truth: this wiki page.

- **Area:** [§1 The Target Host, the Budgets, and the Scope They Fix](ADR-Index.md#area-1)
- **Status:** Accepted
- **Version:** pre-1.0

**Decided.** The shipped systemd unit sets all three as environment variables; the compose file carries them commented out with a pointer to PLAN §8, and the README repeats them under "Runtime tuning for a shared NAS".

**Why.** `GOMAXPROCS=1` hard-caps the app at one core so an import or a search burst cannot starve the hundred services beside it. `GOGC=200` trades a little RSS for fewer GC cycles, which is the right way round when the scarce thing is CPU. The README's own idle figure is about 30 MB RSS (measured for 3.0.4; it said ~25 MB until then), so a 64 MiB limit is still a ceiling rather than a squeeze.

**Instead of.** `GOMAXPROCS=2` is named in the plan as the looser option. Argon2id for password hashing was rejected on the same budget — its ~64 MB per hash is exactly wrong on a RAM-shared box.

**Approved.** My call, and I stand by it: the numbers are conservative on purpose because the cost of being wrong lands on someone else's services, not mine.

<sub>pre-1.0 — `deploy/tippani.service` · `docker-compose.yml` · `README.md` · `docs/wiki/Design-decisions.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
