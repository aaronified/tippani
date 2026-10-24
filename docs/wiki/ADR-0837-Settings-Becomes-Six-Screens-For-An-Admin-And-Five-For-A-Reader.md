# ADR-0837: Settings becomes six screens for an admin and five for a reader, and the rail it is navigated by is Metadata's

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

**Decided.** Settings is six sections for an admin and five for a reader, who has no
Server — Theme, Language and font, Review, Sections, Server, and from 3.1.0 Jobs (§18),
which every reader has rather than an admin alone, because everybody's fills and lookups
are jobs — behind `sectionRail.jsx`, which Metadata draws too. `SETTINGS_SECTIONS` names
them and `SECTION_CARDS` says which cards each one holds; a section none of whose cards is
built for the reader looking is not drawn. The heading said "five screens" until Jobs
arrived.

**Why.** The page had grown to where the only way to find a preference was to scroll
past every other one, and the v3 pack's answer is named sections. The old grid had a
whole apparatus for this — `SETTINGS_LAYOUT`, a per-column-count table, and a paragraph
of measured card heights defending the balance — which is a lot of machinery for
deciding which of nine cards a reader scrolls past first.

**THE RAIL LEFT MetadataPage.jsx RATHER THAN BEING COPIED**, and that is the part worth
recording. Metadata had the only sectioned screen and therefore the only rail; Settings
was about to grow a second, and the repo's standing directive is that a control drawn on
two screens lives in one function both call. It resolves no locale key of its own, for
the reason `characterRows.jsx` does not: Metadata's sections and Settings' sections have
nothing to say to each other, and a shared control carrying one screen's words could not
serve the other.

**THE CARDS ARE NOT REWRITTEN TO GET HERE.** Every control keeps working exactly as it
did; what changed is which screen it is on. Decomposing a card into the pack's row
grammar is worth doing and is worth doing one section at a time with the page working in
between — five cards and a shell rewritten in one step is a change nobody can bisect.

**Instead of** keeping the grid and adding anchors or a jump list, which is the smaller
change. Turned down because it treats the symptom: a jump list is a second index of the
page to keep in step with the page, and the reader still lands in a scroll.

**TYPE MOVED OUT FROM UNDER APPEARANCE**, to sit with the interface language. It was
filed under how the app LOOKS because the single scroll had nowhere else to put it; what
the interface is WRITTEN IN is its own section now, and the fonts belong to it. A dom
case asserted the old arrangement in as many words and now asserts the new one.

**AND TEN TEST FILES LEARNED TO NAVIGATE.** They mounted the screen and looked straight
for a card; the card is now a press away, exactly as it is for a reader. One helper
(`test/dom/helpers/settingsSection.jsx`) presses the tab — or, at phone width, opens the
field and picks the option, because the rail is genuinely two controls. It presses rather
than writing the remembered section directly: a test that seeded the stored key would go
on passing with the rail entirely broken.

**Approved** on the plan, as the first half of remaking Settings to the pack.

*Unreleased — `web/frontend/src/sectionRail.jsx`, `web/frontend/src/Settings.jsx`,
`web/frontend/src/MetadataPage.jsx`,
`web/frontend/test/journeys/finding-a-setting.journey.mjs`.*

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
