# ADR-0914: Context size is a cascade, and a rule only ever clamps down

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

How many lines or paragraphs show around a quote is decided by the first of these that has a value: the **quote's own override**,
then the **work's or board's rule**, then the **reader's global pair** (Settings, next to the quote dials), then the default. The
panel says once where the number came from ("2 before, 5 after · from this work"), so nobody has to guess why one quote shows more
than another. Migration 0085 holds the rules; `GET`/`PUT /context-rules/{book|movie|board}/{id}`, `/context-rules/global` and
`POST /quotes/context-span` are the doors.

**The boundary beats the rule.** A span never crosses a chapter edge or a long silence ([ADR-0906](ADR-0906-Context-Is-Read-Once-And-Stored.md)).
A quote at the start of a chapter has nothing before it whatever any rule says, so a rule cannot be asked to widen past it and
cannot be wrong about it.

**NULL means inherit, and 0 means nothing.** A field with no value follows the next level up; a field set to 0 shows no lines on
that side, deliberately. Collapsing the two would make "I want none" impossible to say, or "I have not chosen" impossible to tell
apart. A consequence, stated rather than hidden: a quote nobody adjusted follows a rule when the rule is raised, because it never
held a number of its own.

**Store wide, render narrow.** The stored span is as wide as the file allows ([ADR-0906](ADR-0906-Context-Is-Read-Once-And-Stored.md)),
and the cascade only decides how much of it to draw. Changing a rule therefore never reads a file and never loses anything:
narrowing is a render choice, and widening again costs nothing.

**A rule can only clamp, never expand.** Changing a work or board rule asks whether to apply it to the quotes already there, and
if yes it lowers every per-quote value that is wider than the rule and leaves the rest alone. It never raises one. A quote
that sits against a chapter start holds a small number because the file ran out, not because the reader chose it, and raising it
to match a rule would claim context the file does not have. A clamp is also safe to repeat and safe to get wrong, since the wide
text is still stored. There is a **clear per-quote adjustments** option, and **Reset to inherited** on a rule.

**Not built.** A bulk-editor screen for the span fields: the endpoint exists, nothing on screen reaches it for many quotes at
once.

**Rejected.** A rule that rewrites quotes to match it (the expansion above); re-reading the file whenever a rule changes (the
span is already stored); a single global number only (a long novel and a song want different windows).

See [Source files and context](Source-Files-And-Context.md).

See also: [ADR index](ADR-Index.md) · [Home](Home.md)
