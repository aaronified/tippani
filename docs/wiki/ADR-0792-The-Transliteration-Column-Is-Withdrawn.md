# ADR-0792: The transliteration column is withdrawn

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted, then changed or withdrawn: the entry says how

**Both directions are the owner's, and the first one is quoted here because they asked
where it came from.** 0069 was written to this, verbatim: *"All quote shall get one, but
will only be shown for scripts that are not the same as the chosen language. User may want
to store bengali transliteration everywhere."* Then, in the add-surface pass: *"translit. we
will drop everywhere (not sure where i gave you any guideline on that). it can be in notes
if user wants it."* And on the column: *"drop it. it doesnt have any data anywhere now. no
need to keep the data either."*

So migration 0072 drops it from all four tables and rebuilds the three FTS indexes without
it. The section above, which argues for the field, is left standing rather than edited —
this log records decisions, and a decision that was made and unmade is two entries.

### Why the column and not only the box

A field with no way to fill it is worse than no field. It goes on being exported, imported,
staged, bulk-edited and tokenized, and the next person to read the schema has to work out
from the *absence of a form* whether the app forgot to draw one. 0069 spent an FTS rebuild
on three tables to make this searchable; keeping that index to tokenize a column nothing
can write is paying the cost with the feature removed.

**The concept survives where the owner put it:** *"it can be in notes if user wants it."* A
note is uncapped, searchable, and already on every kind — so the romanisation in the
owner's own example (`অতি সন্ন্যাসীতে গাজন নষ্ট (Ati sannyasite gajon nosto)`) still has
somewhere to live, and it is somewhere the reader chose rather than a box the app insisted
on.

### What went with it, and what deliberately did not

Gone: the shared `Transliteration` on `quoteReq`/`quoteRow`, the column on four tables, its
place in all three FTS indexes and their nine triggers, the `transliteration:` export
binding on three formats and the three frontmatter aliases that read it, the staged column
and its enrichment arm, the box on all three edit forms, the second line on the card, the
`.quote-roman` rule, the `roman` prop on `TranslationLine`, `quoteTexts`'s third key, and
the two locale keys in both languages.

**`scriptOf` and `wantsTransliteration` went too**, and that is worth stating because they
were the interesting part: a pure function reading the *leading strong character* rather
than taking a majority vote, so a romanisation in brackets inside the same string could not
tip it. With no caller they are dead code, and dead code with a good comment on it is the
kind that survives three more releases. The reasoning is recorded here instead — if a
script-aware decision is ever needed again, the design is in this paragraph and the
implementation is one function.

**The ORDER of migration 0072 is not incidental.** `ALTER TABLE ... DROP COLUMN` refuses a
column named by a trigger, and the FTS triggers name this one on every INSERT, DELETE and
UPDATE. So the indexes and triggers come down first, then the columns, then the indexes go
back. Written the obvious way round it fails on the first `ALTER` with an error about a
trigger, which reads like a corrupted database and is a statement in the wrong place.

**0069 is not edited.** Shipped migrations are forward-only, so the pair adds in one file
and removes in another — which is how the schema records that a decision was made and then
unmade. The owner's own plan for the pile: *"after we release v3, we will drop all
migrations after a month or so, to keep the file lean."* That is when the pair collapses.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
