# ADR-0800: The six-item queue, and why two of its items had shipped nothing by 11 September

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

The owner left a queue and went out: *"1. complete metadata 2. complete import review 3.
complete the quote card pending work 4. complete the checks (stray marks) 5. do the
anthology work (as per plan) 6. do the language work — do not stop till all is done."*
Items 1 to 4 landed. **Items 5 and 6 had shipped nothing, and nothing in this repository
said so**, which is the defect this entry exists to close: a work-rater reading the tree
found two of six asks with no trace and could not tell deferral from oversight. Neither
is acceptable silently; only one of them is acceptable at all.

**Item 5 has a plan and item 6 does not, and that asymmetry is the whole of why they read
differently.** `docs/plans/anthology-update.md` is a live file and `docs/plans/README.md`
lists it, so the anthology work has always been visible as *not built yet* — the
directory's own rule is that a file there describes something unbuilt. The language work
came straight out of the queue above with no planning pass behind it, so there is no file
for `README.md` to list and the only record of it is the session task list, which is not
in the repository. That is the real gap, and this paragraph is the fix: what item 6
consists of is an ISO 639 module (codes, names, script glyphs), a language combobox on the
quote and work fields, retiring `STARTER_LANGUAGES` so the glyph comes from the autonym,
a refusal to remove a language still in use, a one-time upgrade folding existing free-text
languages onto codes, per-language fonts tagged on the quote text, and — last, because it
depends on all of the above — the language-marks card on the metadata sources screen.

**A PLAN FILE FOR IT IS NOT THIS SESSION'S TO WRITE.** `CLAUDE.md` is explicit that a
separate planning agent designs features and that this session *"does not invent the queue
and does not reorder it"*. Writing `docs/plans/language-model.md` here would be inventing
one — so item 6 is named in the log, where naming a fact is not the same as designing a
feature, and the design stays where it belongs.

### Item 5 is being built in two landings, not the plan's eight steps

The plan's order is eight steps and its step 1 is *"the field registry, replacing the six
booleans without changing what they do"*. **That step must not land on its own.** A
registry over six fields read by one renderer is not simpler than the six `if`s it
replaces, and it cannot even be a clean loop: the Markdown order interleaves two
non-switchable bindings (`note` between date and colour, `favorite` last) and colour
carries its own `!= "yellow"` condition, so a faithful "changes nothing" registry is two
loops with a fixed middle — more code saying the same thing. It pays for itself at thirty
fields from four sources, which is the plan's step 2.

Building the seam first with nothing reading it is the pattern this repository has already
recorded as a defect: `attributionOf` in `web/frontend/src/attribution.js`, a band-3 seam
built, never wired, and carrying a comment that overstates what it can do. So the registry
and the work join are ONE commit, and the person and cast joins — which the plan itself
calls *"the genuinely new joins"* — are the next. That is not a reordering of the plan's
steps; it is recognising that its step 1 has no caller until its step 2.

### The plan's "settle it on paper first" question, answered: no

The plan asks for a notion of *once per group* beside *per entry*, and says to settle it
before any column is added: *"an author's bio under thirty quotes from one book is one bio,
thirty times."*

**The registry must not carry that flag, because the document has no groups.**
`renderAnthologyExport` is a flat `for i, e := range entries` with one `## ` heading per
entry, and `entriesFor` orders by `position, kind, item_id` — a hand-ordered sequence with
nothing marking where one work's passages end. So "once per group" is a property of the
DOCUMENT, not of a field, and putting it in the registry means the registry silently
inventing grouping by `work_id` — which changes the file's shape rather than its fields.
The caution is right and the fix is a different feature: **section an anthology by work**,
after which "print this on the section header" becomes a natural third placement with
something real to attach to. Worth putting to the owner as its own ask.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
