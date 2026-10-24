# ADR-0831: The omnibar reaches two screens, and the other sixteen are not pretending

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

The ask was plain: "the searchbar should say the context it will search on. in
metadata, it will search in metadata, in settings it will search within settings as
well. it should behave like an omnibar." Asked which way round it should go, the
owner settled it: screen first, library on demand, **all screens**, with the context
spelled out in the helper text as well as worn as a pill.

**WHAT SHIPPED IS TWO SCREENS.** Settings and the metadata console — the two the
owner named — search themselves. Every other screen keeps the library context the bar
has always had. That is a narrowing of what was asked for, and it is written here
rather than left in a commit body because a commit body is read once by whoever wrote
it.

**WHY, AND IT IS NOT EFFORT.** A screen can only be searched if it has something to
narrow. Settings had nothing and now has a filter of its own; the metadata console
already had a box, and the work was to make the bar and that box one piece of state
rather than two that drift. The remaining screens — Tags, the Bin, Anthologies,
Checks, Cleanup, the import queue — have **no filter at all**. Publishing a context
from them would draw a pill naming a place, spell that place out in the helper text,
and then do nothing when the reader typed. A field that claims to narrow and does not
is worse than a field that honestly says it searches the library: the first teaches a
reader that the control is broken, the second teaches them where it goes.

**THE SIX STRINGS WERE WRITTEN AND THEN DELETED**, which is the part worth recording.
`shell.search.where.tags`, `.bin`, `.anthologies`, `.checks`, `.cleanup` and
`.staging` all existed for an afternoon. `locale-complete.test.js` failed them as dead
copy — nothing rendered them — and it was right twice over: they were dead, and they
would have capped every translator below 100% for a feature that did not exist. A
half-built feature that leaves its copy behind is how a locale file comes to describe
an app that is not there.

**WHAT FINISHING IT LOOKS LIKE**, so the next person does not have to re-derive it:
each of those six is a list screen, so each needs a client-side filter over rows it
has already loaded, and then one `useScreenSearch({ key, label, onQuery })` call
pointed at that filter. The mechanism is done and takes one line per screen; the
filters are the work. Checks, Cleanup and the import queue are the awkward three,
because each composes two lists and would have to decide whether one field narrows
both.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
