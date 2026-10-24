# ADR-0842: Colour categories leave Settings, and the layout table leaves with them

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

**Decided.** `ColourCategoriesCard` is a section of the Metadata console. `SETTINGS_CARDS`
no longer names it, and `SETTINGS_LAYOUT` and `settingsColumns` are deleted.

**Why the card moved.** A colour category is what KIND of note a quote is. That is a fact
about the library, in exactly the way a tag, a language or a person is — and all three of
those are on Metadata. It was in Settings because Settings was where everything went. The
v3 pack files it with the rest of what the library is made of, and the card itself is
unchanged: only its address.

**AND THE LAYOUT TABLE WAS DEAD THE MOMENT SETTINGS BECAME SECTIONS.** `SETTINGS_LAYOUT`
answered "which of nine cards does a reader scroll past first" with a per-column-count
table and a paragraph of measured card heights defending the balance. Five named sections,
each drawing its own cards in one column, leaves no packing to decide. Removing the
colours entry is what exposed it — the three-column layout came up with two columns and
its own test caught it, which is the test doing its job on the way out.

**Deleted rather than left unregistered**, which is the opposite of the call made for the
Devices card. Devices is coming back; this is not. A table nothing reads, kept "in case",
is the dead-code-documented-as-in-force defect a rater already caught once in this
session.

**THE TEST THAT GUARDED IT NOW GUARDS THE THING THAT REPLACED IT.** The old suite held the
layout in agreement with the card list. The new one asks whether every registered card is
placed on some section and whether every section has something to draw — because a card
registered but placed nowhere is a control nobody can find, and it fails silently: the
section that would have drawn it simply draws one fewer.

*Unreleased — `web/frontend/src/Settings.jsx`, `web/frontend/src/MetadataPage.jsx`,
`web/frontend/test/pure/settings-layout.test.js`,
`web/frontend/test/journeys/naming-a-colour.journey.mjs`.*

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
