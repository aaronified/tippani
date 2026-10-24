# ADR-0802: An anthology fills itself by asking, and the plan's own two sentences could not both ship

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

`docs/plans/anthology-update.md`'s "Keep it fed" says two things one clause apart:

> `rule_auto` means: **the next time the anthology is opened**, run the fill and
> append anything new. … `rule_run_at` is what the screen shows: "12 new since
> Tuesday", with the count as a control the reader presses **rather than a change
> that happened while they were not looking**.

Those are two designs, not one. The first appends on open; the second says the
reader presses. **The second shipped**, and the first is refused for two reasons
that were not visible when the plan was written.

**Appending on open is a write on a read.** Opening an anthology is
`GET /anthologies/{id}`. Making that insert rows makes it non-idempotent: a
prefetch, a back button or a second tab performs it again. `INSERT OR IGNORE` keeps
that harmless, which is precisely what makes it easy to miss — it is a write nobody
asked for, on a path nobody thinks of as a write, and the next person to add caching
in front of that endpoint would be caching a mutation.

**And it is the thing the next clause warns about.** An anthology that grew by twelve
entries because you looked at it is a change that happened while you were not
looking, however welcome the twelve are. The plan is right in its second sentence and
the first is a shorthand for it.

So the screen asks what a fill *would* take — the preview added in step 6, which is
the real fill inside a transaction it abandons, so no new endpoint and no second
count — and draws the number as a control. `Add 12 waiting` is the whole interface:
the count IS the button, because the only thing to do with twelve waiting quotes is
take them, and a label that merely announced would need a button beside it saying
what it already says.

**A failed check is silent.** It is a question the reader did not ask, so an error
banner over an anthology that opened perfectly well would be the screen reporting its
own housekeeping as their problem.

**And the switch's own words had to change with it.** It shipped in `f59cdeb1` saying
"Run this again when you open the anthology, and add anything new", which promises
exactly the design being refused here. It now says what it does: *"Count what is
waiting when you open this, and offer it. Nothing is added until you say so."*

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
