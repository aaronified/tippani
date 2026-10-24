# ADR-0827: Entry helpers: what the plan got wrong, and the one item it could not have worked

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

`docs/plans/entry-helpers.md`'s own summary was "one endpoint, two UI primitives,
four surfaces, and a keyboard route". Most of it had already shipped under other
names. This pass verified every row at its own line rather than trusting the plan's
inventory — which the plan itself warns about, having been wrong twice before.

**THE ENDPOINT WAS NEVER BUILT AND DID NOT NEED TO BE.** The plan specified
`GET /works/{kind}/{id}/entry-vocabulary` returning chapters, episodes, characters
and timestamps as paired rows. What shipped reuses three endpoints that already
existed — `/{kind}/{id}/cast`, `/books/{id}/chapters`, `/movies/{id}/packs` — behind
`useWorkSuggestions`. One request fewer than the plan's own design, because the cast
endpoint was there anyway.

**AND "cast ∪ YOUR PRIOR VALUES" WAS ALREADY TRUE, by a mechanism the plan did not
foresee.** It proposed joining the provider's cast with the characters you had typed.
`handleListCast` calls `adoptQuoteCharacters`, so every character a work's own lines
name IS one of its cast rows — the union happens in the database on read, and a
hand-typed character is offered on the next line without anything joining two lists.

**ONE OF THE PLAN'S TWO CITED "no cast" HOSTS NO LONGER EXISTS.** It named
`Home.jsx:491` and `SearchPage.jsx:1107` as rendering `DialogueForm` with no cast.
Home still does — that gap was real and is fixed — but the search screen no longer
renders that form at all.

**THE STAGED FORM'S HARDCODED ENGLISH LABELS ARE GONE**, fixed earlier by the import
review work rather than by this plan.

**AND THE KEYBOARD ROUTE COULD NOT WORK AS THE PLAN DESIGNED IT.** It is built, and
it is built somewhere else.

The plan settled on **Alt+1–9** on every offer chip, registered in `keys.js` with a
`ctx: 'offer'`, and argued the case at length: bare digits cannot work because the
fields these chips sit beside are numeric inputs and the chip appears BECAUSE you are
typing in one, so `1` has to type `1`. That argument is right.

What it never read is `keys.js:297` — **the global dispatcher returns on any typing
target**. An offer chip exists precisely when the caret is in a field, so a binding
routed through that dispatcher can never fire for it, with Alt or without. The plan
quoted `keys.js:57-72` (why `ctx` exists) and reasoned only about which KEY to bind,
never about whether the registry could deliver it. `keys.js:299` is a second, smaller
obstacle — Alt is passed to the browser deliberately — and that one is a narrowing
rather than a wall.

So the route is LOCAL, and the owner chose that over dropping it. `OfferChip` owns a
`keydown` listener whose lifetime IS the binding's scope — the chip is rendered only
while there is an offer, so there is no "is a chip showing" flag to keep in step with
whether a chip is showing. `keys.js` keeps the half it is good at: the binding's id,
its label, its place in the shortcuts sheet, and the key the chip prints through
`Tooltip`'s `shortcut` prop. The repo's rule is that a shortcut is spelled out on the
control that shares its job, and that rule is the registry's, not the dispatcher's.
`prettyKey` gained an `alt` word — ⌥ on a Mac, Alt elsewhere, the same
one-binding-two-labels case it already handles for `mod`.

**ONE BINDING, NOT NINE, AND THE DIFFERENCE IS A FEATURE THAT WAS NEVER BUILT.** The
plan's nine were for its ambiguous case: a chapter name recorded against two numbers,
offered as `3 · 4`. `chapterPatch` does not do that. It takes the FIRST match with the
pool ordered commonest-first, and returns `{ field, value }` or null — "never both, by
construction", its own words. At most one chip is ever on screen, so eight of the nine
would have been rows in the shortcuts sheet for routes that could never fire. The day
a chip set genuinely holds several, `offer-accept` becomes a numbered group.

**AND THE TWO RETROFITS THE PLAN NAMED ARE NOT DONE**, for the same reason: the search
facet chips and the cover candidates are chip SETS of more than one, so they need the
numbered group that the single-offer case does not justify. They are a separate piece
of work and are not claimed here.

**A MUTATION CAUGHT A VACUOUS TEST OF MINE, and it is worth recording which.** The
"a bare 1 still types a 1" case first asserted a value typed AFTER the key press —
but `fireEvent.change` sets a box outright, so it overwrote an offer the bare key had
wrongly taken and passed either way. Firing the handler without checking `altKey`
walked straight past it. It asserts the box is UNCHANGED and the chip still mounted
now, which is the actual claim.

**WHAT THIS PASS BUILT**, all of it with mutations run against it: the favourites
editor's dialogue form fetches its own cast when no host supplies one; a standalone
quote's speaker and occasion draw on the library's own lists, one of which
(`occasions`) had to be written on the server first; both bulk panels — the live one
and the staged one — offer those lists where a field has one; and `useVocabulary` is
the single verb all of them use, extracted from `LanguageCombo`, which held the only
copy.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
