# ADR-0897: Categories, quote faces in the language table, two-line records, masonry, and a phone index that says something

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

**Tags and Colours are one section, "Categories".** The owner: *"merge the tags and the
colours metadata pages into one, named 'categories' or 'classifications' or whatever
seems suitable."* Categories, because it is the word the colours already had ("colour
categories") and because tags and stickers are the other two kinds of label a reader
makes. The section keeps the colours' id, so their address is unchanged, and
`SECTION_ALIASES` sends an old `/metadata/tags` there instead of letting it fall back to
Works. The three kinds are three cards under one heading style — Stickers always had a
heading, and two unnamed blocks beside a named one was the first inconsistency the merge
would otherwise have shipped.

**Quote faces live with the language, and Settings keeps a door.** *"the quote font
selection can be added to the metadata language screen. on phone, this will be part of
the popup, on desktop, we can add new columns to the existing list. default font
selection will be in the top area… in settings, the quote font card will only carry the
link."* The writer did not move: `useQuoteFaces`, `QuoteFaceSelect` and `QuoteFaceSample`
are exported from Settings.jsx, and the default row is `FontSections` in a
`quoteDefault` mode — the same `fontRow`, size dial, style chips and revert — so a face is
still written in one place. On a phone the face is a field of the one editor, staged like
the rest of its fields and counted in the tick's badge. The default row was renamed from
"Every language" to "All languages" in English, because it now sits directly under an
order default of that name; Bengali already used one word for both.

**A row's own setting is a dot.** *"own settings need not be spelled out. you can use
the dot."* The words are still said — as the dot's tooltip and in the row's radio group's
NAME ("Bengali, own setting") — because a dot alone is a picture to a screen reader. A
first cut put them in an `aria-description`, which a rating pointed out no journey could
reach: `said` reads names, so a description could be deleted with every test green. The
radios' own names stay "Bengali: quotation first", so the group says whether the row is
its own and each radio says what it picks.

**People and Characters: two lines on a desk, and a work shares its chip.** *"a single
row for name, count, and metadata icons. the second row can have the work names
(edgemasked…). two rows only in desktop, unlike mobile which has 3"*, and, asked where
the performers go: *"performer and work shall be in the same chip, as they are
interdependent. same thing for the role-type-icons and work chip in people screen."*
`RecordRow` gained a `head` slot beside the name (under it on a phone), and
`CreditPills` draws one chip per work with a lead: performer buttons for a character,
role glyphs for a person. The person half needed the server to say which role on which
work — `works_in[].roles`, merged per work so the six-work cap still counts works — and a
role no work carries (a speaker, a role saved on the record alone) stays on the name
line rather than disappearing, and so do a person's other spellings, which were a
third line until a rating counted it. Character portraits take the person portrait's box
(*"they should be the same size as the images in the people page"*).

**The tabs stick above the toolbar, and the two are one card.** *"it should not hide
the tabs. and the sticky panel should look like a card, not the angular rectangle it is
now."* On Works, People and Characters the tab row sticks under the top bar, SectionRail
publishes its height as `--rail-stuck-h`, and the toolbar parks under that. Stuck, the
tab row is the card's top and the toolbar its bottom, drawn with the card's own face, an
inset ring for its edge (so nothing moves by a border's width) and a 12px bleed. Both
ask `useStuck` — a scroll check, because the toolbar's offset is now measured at run time
and an IntersectionObserver's margin is fixed at mount.

**Masonry in reading order.** *"Use masonry packing on desktop, not grid."* Asked, the
owner chose row order over CSS columns, because Settings numbers its cards and columns
read 1-2-3 down the left. `useMasonry` sets each card's grid row span from its
`offsetHeight` — not its painted rect, which an entrance animation scales and which
produced overlapping cards on the first run — and auto-placement does the rest. Sources'
multicol moved onto the same hook so "masonry" means one packing on both screens.

**Uniform tabs.** Fetch moved from a header row of its own into the tab row's far end,
where Settings keeps Reset (*"that can be in the tab row itself"*). The far-end box has
no height and its contents rise out of its floor, so nothing in it can make the row
taller. A first cut used a −12px top margin, sized to the Fetch button. A rating called
that a number that fixes one button, and it was right: a taller control would have
reopened the gap. Every section's tab row now measures y=61–108 at 1440×900. The selected underline overhangs by the count badge's
padding on both sides (`--rail-count-pad`), except the right side of a counted tab, which
the badge already covers.

**The phone index says what is behind each door.** *"the metadata phone index page
looks like shit."* It was a name, an arrow and two glyph-only buttons stretched full
width. Each console's door now carries its open issues as pills — a pill is `pickGap`,
so it opens the console filtered to that issue, and a journey checks that it lands
filtered — the verbs keep their words, Languages shows the languages in their marks and
Categories its colours by name. Those two previews are plain text, not buttons: they
open nothing the door itself does not open, and a row of buttons that all do the same
thing as the card is four ways of saying one press. Sources stays a bare door: its only summary needs a fetch
of its own.

**The desk layout is measured, not described.** Tab height, underline overhang, portrait
size, lines per record and masonry holes are all positions and sizes, and a journey has
no verb for "as tall as". The first cut of this entry said so and stopped there. A rating
called that an untested claim, which it was. `make metadata-layout` measures all five at
1440×900 and fails on any disagreement. Each check was shown to go red under its own
mutation:
- the aside given its height back puts the Metadata tabs at 61–113 against Settings'
  61–108;
- the `:has(.meta-rail-count)` rule removed gives a counted tab's underline 7px on the
  left and 13px on the right;
- the character portrait taken off `person-face-btn` leaves no matching face;
- the head's extras wrapped onto their own line give three lines per record;
- `useMasonry` stopped before it sets spans leaves a 290px hole on Categories.

The lines check first counted the sub-line's children. It passed a mutation that wrapped
the chips, because the chips live in one scroller, so it now counts bands of painted ink.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
