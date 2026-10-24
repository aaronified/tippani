# ADR-0121: Years may be negative and estimated, and needed no schema change — 0 already meant 'not recorded'

Source of truth: this wiki page.

- **Area:** [§5 Works, Shelves and Reading History](ADR-Index.md#area-5)
- **Status:** Accepted
- **Version:** 1.7.4

**Decided.** The year floor moved from 1000 to −4000 and a negative year is BCE. Migration 0030 is four lines: two `published_circa` / `release_circa` flags. The year columns themselves were not touched.

**Why.** The old floor refused the Meditations, the Analects and the Gita outright, which is not a rounding error in an app for keeping quotes from things worth quoting. Almost nothing had to change: `books.published_year` and `movies.release_year` have been INTEGER since 0001 and 0003 with no CHECK — the 1000–3000 range lived in Go, in `validYear` — so −380 already stored and already sorted correctly, and 0 has always meant "no year recorded", which is exactly the convention the era needs since there is no year 0 between 1 BCE and 1 CE. Not one existing row changes meaning.

**Instead of.** A separate era column or a sentinel — neither was needed, and the migration comment records that as the reason it is four lines instead of a rebuild.

**Approved.** Mine, and I approved writing the "nothing had to change" reasoning into the migration, because a four-line migration for a headline feature otherwise looks like something was missed.

<sub>1.7.4 — `internal/store/migrations/0030_ancient_years.sql` · `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
