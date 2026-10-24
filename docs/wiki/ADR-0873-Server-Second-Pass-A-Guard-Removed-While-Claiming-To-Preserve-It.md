# ADR-0873: Server, second pass: a guard removed while claiming to preserve it

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

**THE WORST FINDING WAS A GUARD I TOOK AWAY IN THE ACT OF SAYING I HAD KEPT IT.** Merging
Updates and Backup into one tile meant a card could declare several search prefixes, so the
scanner's regex was widened from `'[^']+'` to `(\[[^\]]*\]|'[^']+')`. That accepts `server:
[]` — a card declaring no searchable words at all now counted as prefixed, which is exactly
the silent disappearance the scanner exists to catch. The commit body said the change
"preserves" search. It did not.

**AND THE JOURNEY WAS NOT A BACKSTOP EITHER, FOR A REASON WORTH KEEPING.**
`the-bar-searches-where-you-are.journey.mjs` typed "backup" and asserted `see('Backup')`.
When nothing matches, Settings says so in a sentence that QUOTES what was typed — *Nothing in
Settings matches "backup"* — and `see` folds case, so the word is on screen whether the card
was found or lost. Deleting the Backup prefix entirely left that journey green. It asserts
`see('Back up now')` now: a control only the card itself draws. **An assertion on a word the
reader typed can be satisfied by the app repeating it back.**

Three repairs, because one would not have done: the scanner requires a list to hold at least
one quoted root; `test/pure/settings-search.test.js` asserts that each of Server's three roots
actually resolves — a claim about the TABLE is not a claim that the table WORKS, and dropping
any single root leaves the other two answering; and the journey names a control.

**THE RELEASE LOG WAS A NESTED SCROLLER FOR ONE COMMIT.** `.cl-list` carried `max-height:
62vh; overflow-y: auto`, which was right while it was a dialog body — the scroller WAS the
dialog. On the Server screen that became a bare nested scroller inside a page that already
scrolls: measured at 523px holding a hundred entries inside an 844px phone, with no fade to
say it scrolls and no way to reach the whole set, and the `.mobile-sheet` escape that used to
unbind it no longer applied. That is the standing rule twice — *an edge fade means it scrolls;
a button at the fade opens the full set*, and *never bare `overflow`, which gives no signal*.

The repair is the pack's own shape rather than a fade: **two releases at rest and the rest
behind "Read the whole log"** (its Server tour says so in words — "The last two releases, with
the rest behind Show more" — and it draws the button at `settings-restructured.dc.html:614`).
A bounded list needs no scroller of its own, so the max-height is gone and the page scrolls,
which is what every other long thing here does.

**THE LESSON ABOUT UNFOLDING A DOOR, NOW TWICE OVER.** The previous pass found that the
changelog's crash had been waiting behind its door. This one found that its scroll behaviour
had been, too. A door does not only hide a control: it hides everything the control's
container was allowed to assume.

**AND A CLAIM IN THE PLAN FILE WAS WRONG ABOUT ITS OWN COMMAND.**
`docs/plans/nightly-backup.md` said `grep -rni nightly internal/ --include='*.go'` returns
nothing. It returns matches — a release tagged `nightly` in the updater's tests, and CI's own
nightly sweep in `codes_test.go`. The conclusion held (no non-test source mentions it) and the
evidence cited for it did not. The file now shows the filtered command and names what the
unfiltered one finds, because a document whose command does not reproduce its number teaches
the next reader not to run the commands.

**Smaller:** the glossary still called this "Changelog dialog" and cited the deleted
`ChangelogDialog` — an interface rename that this repo requires the glossary to ship with, and
`glossary:check` passed throughout because it diffs the page against the catalogue rather than
against the app. Both locale files still headed the block "THE CHANGELOG DIALOG". And the
comment claiming `data-tour` had moved to the group was wrong: it is on the rows, which is
where the halo belongs, so the comment was corrected rather than the code.

*Unreleased — `web/frontend/src/Settings.jsx`, `web/frontend/src/index.css`,
`web/frontend/scripts/glossary/catalogue.js`,
`web/frontend/test/rules/settings-search-prefix.test.js`,
`web/frontend/test/pure/settings-search.test.js`,
`web/frontend/test/dom/changelog-dialog.test.jsx`,
`web/frontend/test/journeys/the-bar-searches-where-you-are.journey.mjs`,
`docs/plans/nightly-backup.md`, `internal/i18n/en.txt`, `internal/i18n/bn.txt`.*

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
