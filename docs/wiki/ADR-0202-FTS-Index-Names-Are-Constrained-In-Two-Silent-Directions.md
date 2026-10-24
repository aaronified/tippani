# ADR-0202: FTS index names are constrained in two silent directions

Source of truth: this wiki page.

- **Area:** [§7 Search and the Full-Text Index](ADR-Index.md#area-7)
- **Status:** Accepted
- **Version:** 1.5.0 (recorded), applies from 0001

**Decided.** Both constraints break silently, which is why they are written into the migration that most recently had to obey them. First, `store.Recover()` copies base tables while the sync triggers are live, excluding anything matching `'%\_fts'` or `'%\_fts\_%'`; a name outside that pattern gets copied into a live FTS index and reports as `database disk image is malformed` on the next insert. Second, `rebuildFTSTable` finds an index's triggers with `sql LIKE '%<name>%'`, so an FTS name that contains or is contained by another one cross-wires two repairs. The 0026 migration states the check it performed: `utterances_fts` is neither a substring of nor a superstring of `books_fts`, `annotations_fts`, `movies_fts` or `dialogues_fts`. I approved recording the check in the migration rather than in a style guide, because the person naming the next index is looking at a migration.

**Instead of.** An explicit list of index names in `Recover`, replacing the pattern. That trades a naming rule for a registration rule, and a forgotten registration is just as silent.

<sub>1.5.0 (recorded), applies from 0001 — `internal/store/migrations/0026_utterances.sql` · `internal/store/repair.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
