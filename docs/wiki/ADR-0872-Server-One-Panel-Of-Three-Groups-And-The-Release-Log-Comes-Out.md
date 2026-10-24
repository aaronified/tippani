# ADR-0872: Server: one panel of three groups, and the release log comes out from behind its door

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

**SERVER WAS THE LAST SECTION DRAWN AS TWO TILES.** Updates and Backup were separate `Card`s,
each with its own border and its own `SectionTitle`, where every other section in Settings is
one card of numbered groups — and where the pack draws this one the same way: Updates, Backup,
and "What changed" at the foot (`settings-restructured.dc.html:2749`, `:2754`, `:2760`). Two
bordered boxes for one subject is exactly the "tabbed vs single tile" call the owner's rule
hands to the prototype.

Measured after, one card at both widths: on a desk Updates and Backup pair at 457px each and
"What changed" spans 954; on a phone all three stack at 316. Neither width scrolls sideways
and neither has an element crossing the viewport.

**THE RELEASE LOG IS ON THE SCREEN NOW.** It was behind a button called "Changelog" that
opened a dialog. The pack gives it a group, and the standing rule says why: *what is genuinely
rare goes behind a door; what is merely detailed goes lower on the same screen.* "What is in
the version I am running" is the question a reader on the Server screen is already asking,
with room underneath to answer it. `ChangelogDialog` became `ChangelogList`; the `PromptFrame`
and the button are gone.

**AND UNFOLDING IT EXPOSED A CRASH THAT THE DOOR HAD BEEN HIDING.** The body guarded `!data`
— a response that had not arrived — but not a response that arrived shaped differently, so
`{}` fell through to `data.releases.map` and threw. Behind a door that was survivable: nothing
rendered until somebody pressed the button, and a reader who never pressed it never met it.
On the screen it renders on every visit to Server, so an old build, a proxy or a changelog
that failed to parse would take the whole section down. It says there is nothing to show
instead. **A door is not only a place to hide a control; it is a place where a bug can wait.**

**ONE CARD KEY, THREE SEARCH PREFIXES.** The settings search reads a card's words out of its
own i18n prefix, one per card — so merging two cards into one tile would have made typing
"backup" hide the panel that holds it, which is the silent disappearance
`test/rules/settings-search-prefix.test.js` exists to catch. `settingsMatches` takes a prefix
or a list now, and the scanner reads both spellings; its "the scan found nothing" floor moved
from 4 cards to 3, because merging two into one is what happened rather than a parse failing.

**`trashDays` WAS THE ONLY THING SERVER CLAIMED TO OWN, AND IT IS NOT SERVER'S.** It is set on
the Bin (`BinPage.jsx:310`), which is where a reader changes how long the bin keeps things. As
the sole entry in `SECTION_PREFS.server` it put a "1 changed" on a tab for something not on
that screen, and Reset section would have reached across and silently reset the Bin's
retention — the same objection recorded one screen earlier against a panel's reset touching
rows outside it, pointing the other way. It is excused in `UNCOUNTED_PREFS` rather than moved,
because no Settings section owns it: the screen that does is not one of these five. Server now
owns no user preference at all, which is correct — what it holds are ACTS (check, back up,
restore) and one setting the server keeps itself (the release channel).

**THE NIGHTLY BACKUP TOGGLE IS NOT BUILT, AND THE NOTE SAYS WHY** (`docs/plans/nightly-backup.md`).
It is the one row of the pack's Backup group missing, and it is a feature rather than a
layout: nothing of it exists server-side, it needs a ticker — which this repo's invariants
forbid without a design discussion first — and the sub-line the pack draws ("Last one 04:00 ·
41 MB") is a second feature again, since a toggle that ran the job but could not say when it
last ran would be a promise with no receipt. **No roadmap card was added for it**, on the
roadmap sweep's own rule that an entry is a promise published on a public page and a sweep
that is unsure says so instead.

*Unreleased — `web/frontend/src/Settings.jsx`, `docs/plans/nightly-backup.md`,
`web/frontend/test/rules/settings-search-prefix.test.js`,
`web/frontend/test/dom/changelog-dialog.test.jsx`,
`web/frontend/test/dom/backup-download.test.jsx`,
`internal/i18n/en.txt`, `internal/i18n/bn.txt`.*

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
