# ADR-0140: A character merge is the person merge with three things a character does not have

Source of truth: this wiki page.

- **Area:** [§6 People, Credits and Metadata Providers](ADR-Index.md#area-6)
- **Status:** Accepted

**Decided.** `store.MergeCharacters` / `UndoCharacterMerge` / `SplitCharacterAlias` are written out in parallel with their person twins rather than shared through an interface, and migration 0060 gives the bin a `character-merge` kind with its own branch in `handleRestoreTrash` beside `person-merge`.

**Why it is shorter, item by item, so the difference cannot be read as a shortcut.** A character has no credits: nothing composes a derived column out of `characters` — `work_cast.character` holds the printed name in its own row — so there is no `credit_as` to carry through, no recompose afterwards, and no cache that can drift from the links. **There is no collapse step**, and its absence is deliberate: the person half collapses a work that now credits one person twice in one role because the recomposed column would print the name twice on a cover, whereas a film billing Woland once as "Woland" and once as "the professor" is two cast rows and both are true. And no quote points at a character — `speaker_cast_id` was never written — so nothing answers to `MergeUndo.Screen` and `Utterance`.

**What it keeps** is the rule that makes a merge safe to offer at all: `work_cast.character` is never touched, so a work goes on billing what it billed, and the dropped record's own name becomes an alias of the survivor so the next cast import resolves rather than manufacturing the record again.

**Instead of** leaving characters merge-less, which is what shipped in 3.1.0 and which left the backfill's central promise unkept: it creates one character record *per work* deliberately, so that eight Harry Potters are visible **and mergeable** rather than forty Narrators silently welding into one. The visible half shipped and the weldable half did not.

**One shared helper, and why it is not a copy.** `rowAsMap` and `insertRow` take the table name, guarded by an `identityTables` allow-list because both interpolate it. The parallel-copy rule exists so two *meanings* cannot drift apart, and a row copier has no meaning to drift — one copy of it is the version that cannot disagree with itself.

<sub>`internal/store/migrations/0060_trash_character_merge.sql` · `internal/store/identity.go` · `internal/httpapi/identity_handlers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
