# ADR-0355: A show's season: 0 is written explicitly, and combined forms are accepted on read

Source of truth: this wiki page.

- **Area:** [§10 What Leaves the App: Exports, Round-Trips and the Shared Image](ADR-Index.md#area-10)
- **Status:** Accepted
- **Version:** `docs/wiki/Design-decisions.md`

**Decided.** `season` and `episode` are written as plain numbers, one per key, and `- season: 0` is written like any other value. On read, either key also accepts `S2E5`, `s02e05` or `2x05` and fills both from it; `- ep:` is an accepted alias.

**Why.** Season 0 is a real season — it is where a series keeps its specials and pilots — so the columns are nullable and *unset* is `null`, never `0`. A 0-means-unset integer would have made "the specials strand" and "nobody recorded an episode" the same fact, and would have dropped `S0E1` on every export. Reading the combined forms is a concession to how people actually write, not to how the exporter writes: the file the app produces is unambiguous, and the file a person types is the one that needs the tolerance. Mine.

<sub>`docs/wiki/Design-decisions.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
