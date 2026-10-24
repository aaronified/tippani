# ADR-0806: An anthology has four doors instead of one, and a work's door means its passages

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

The owner's three asks, one release: the add form "is too long", the fill-from-a-search
rule "cannot be accessed from the anthology add menu and also not visible in the search
menu (both routes should be there)", and works and annotations should offer "a popup with
a combobox to search existing anthologies, or create new ones from the same combobox".

**The picker had to change before any of the other two were worth building.** The old
dialog drew a `Select` — a closed list — so with no anthologies it rendered an error
naming the Anthologies screen and the Settings switch that reveals it. That is a dead end
wearing a signpost: the reader leaves, makes one, and comes back having lost the selection
that brought them there. `SuggestCombo` already existed for exactly this shape and says so
in its own header — *"it is free text with suggestions, not a picker… nothing is ever
restricted to the pool"* — so the name typed IS the create path. Every new door depends on
that, because a door onto a dead end is worse than no door.

**A work cannot be an anthology entry, so its menu had to mean something else.**
`quoteOwned` accepts `book`, `screen` and `utterance` and returns false for anything else;
an anthology of covers is not a thing, and the registry said so. Three readings were put to
the owner — gather its passages now, set a rule that follows it, or both — and **both** was
chosen: the work's door hands the picker `book=<id>` as a rule, which fills immediately and,
with *Keep it fed* on, keeps taking what is highlighted later. One control, both halves,
and no second mechanism.

**The rule from the search screen drops the scope, deliberately.** A rule cannot express
one: `parseSearchFacets` treats `scope` as reserved and skips it, and `anthologyMatches`
then runs all three kinds regardless. So a rule built off a books-only view would store a
wire value that says one thing and does another. `scope: 'all'` is written explicitly, which
also keeps 0075's own claim true — that a rule is readable and pasteable into the search bar.

**And the rule is never in the body of a create or an update.** Neither route carries one
and the fill endpoint needs an id that does not exist until the create responds, so the
form collects `{rule, auto}` and hands them to its caller as a second argument. Every door
then goes through `gatherInto`, which is one function because the repo's directive says a
control drawn on two screens has one behaviour — and here there are four surfaces and three
moving parts each, which is the arithmetic that directive exists for.

### Where this turned out to be wrong twice

**A nested `FormModal` wears the right chrome and did NOT dismiss correctly, and reading
the code found only the first half.** The plan was to convert the form to a panel so the
groups could open as in-panel subsheets, because `FormModal`'s own header describes an
escalation defect — *"if the actor/char page is a popup, why is the sub entry of add links a
separate screen altogether?"*. On chrome the reading holds: `sheet = mobile && !surface`, so
a dialog opened from inside another wears its parent's clothes at both widths — a card on a
scrim over a card on a scrim, a sheet over a sheet. The escalation was popup→screen and this
is screen→screen, so the panel conversion would have been a visible change nobody asked for.

**But "nesting was already safe" was the wrong conclusion, and it was drawn from the wrong
hook.** `useEscape` does keep a stack and run only the top. `useBackToClose` kept none: every
open overlay added its own `popstate` listener. Worse, an overlay that closes by any other
means — ✓, ✕, Escape — hands its history marker back in its cleanup, and that `history.back()`
raises a pop indistinguishable from the reader's own. So pressing ✓ on a group's popup closed
the popup AND the form under it, discarding the title already typed. Nothing errored, no
jsdom test saw it (jsdom delivers that pop on a later turn), and the first browser journey
over the finished form found it in one press.

So `useBackToClose` is now a stack like `useEscape`'s, plus a count of the pops that are our
own unwind rather than a gesture — without the second half the parent simply answers the pop
instead, because the child has already left the stack. `making-an-anthology.journey.mjs` is
the guard: reverting either half fails it on the form that is no longer there. The lesson is
narrower than "check the other hook": **two hooks answering two gestures for the same stack
of surfaces will not stay in agreement unless something makes them**, and only one of them
had been asked to.

**And `export … from` does not create a local binding.** The picker, the list hook and the
request moved to `anthologyGather.jsx` because `anthologies.jsx` imports `SearchBox` from
`SearchPage.jsx`, and the search screen needed the picker — reaching back would have closed
a cycle. Re-exporting them from `anthologies.jsx` for its two existing importers left the
file's own calls unbound: a pass-through is not an import, so `useAnthologies` and
`gatherInto` were `ReferenceError` at render with nothing in the module graph looking wrong.
Both are now imported and re-exported on separate lines.

**And the card the highlight menu was written on is not only a highlight's.** `Library`'s
`AnnotationCard` is drawn by Quotes for standalone utterances and by the search modal for
whatever the hit is, so naming the kind in its menu — `ANTHOLOGY_KIND.annotation` — sent an
utterance's id up as `book`. `quoteOwned` then resolved it against the ANNOTATIONS table,
where a row of the reader's own shared that id, so gathering a standalone quote silently put
a DIFFERENT passage into the anthology and the toast said "1 gathered". A wrong answer that
cannot fail is worse than an error; the kind now comes from `selectKind`, which is what the
card was drawn as, and the search modal passes it rather than taking the default.

**The work-card menu's rule was "no writes" and is not.** `work-card-menu.test.jsx` asserted
that a board which cannot reload offers nothing that writes. *Add to anthology* writes, and
belongs there anyway: the hazard the callback guards is a control that is *"present and
silently ineffective"*, which is a write whose result **this tile would have to redraw**. A
gather writes somewhere else entirely. The test now states that rule and names the five
writes that do qualify — the same refinement the file already made once, for Practise.

<small>Unreleased — `web/frontend/src/anthologyGather.jsx`, `anthologies.jsx`,
`SearchPage.jsx`, `actions.jsx`, `Library.jsx`, `Movies.jsx`, `works.jsx`, `Home.jsx`,
`SelectionBar.jsx`, `index.css`</small>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
