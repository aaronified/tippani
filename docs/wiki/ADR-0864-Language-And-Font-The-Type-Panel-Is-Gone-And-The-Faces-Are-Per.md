# ADR-0864: Language and font: the type panel is gone, and the faces are per language

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

**THE DOOR COST FOUR PRESSES ON THE SCREEN WHOSE SUBJECT IT WAS.** Every typeface the app
uses lived behind a button called Type. The section itself drew four specimens that PICKED
NOTHING — pressing one opened a modal, where a reader expanded a role, opened a list, and
chose. Four presses to change a face, three to upload one, four to delete one. The pack
(`settings-restructured.dc.html:2635-2668`) draws all of it on the section: your own faces
as pills in group 2, the faces the interface is set in as rows with a picker apiece in
group 3, and no door anywhere.

**WHAT THE PANEL HAD THAT THE PACK DOES NOT DRAW WAS KEPT.** The per-language scope, the
per-role size dials, the style modifiers and the script check have nowhere in the pack
because the pack never had them. They sit on the rows they belong to. Only the modifiers
are behind anything — one press, on the row itself — because five chips across six rows is
thirty chips on a screen whose job is showing four typefaces.

**A QUOTE'S FACE IS A QUESTION ABOUT ITS LANGUAGE, AND THE SCRIPT ROWS WERE THE FIRST
ATTEMPT AT IT.** The owner: *"a user like me, who grew up with Asterix, may want different
languages shown in different fonts. To me, German should always have serif, while english
is sans serif… And this is only for the quotes themselves. All else go by the ui fonts
section."* One face per SCRIPT cannot tell German from Swedish — both Latin — and cannot
tell a quote from a button. So Bengali and Devanagari stopped being rows: *"the bengali and
devnagari doesn't need to be anywhere, right? because they will get added in metadata and
show up in the language wise font picker anyway."* The ROLES stay in `fonts.js`, because
they are still the tail of every stack and a Bengali letter in a Latin-faced label has to
land on something. What went is a control for a question with no good answer.

**AND IT IS ONE WRITER NOW, WHICH IT WAS NOT.** `fontsByLanguage` had a picker on
Metadata's language rows AND a per-script picker under Settings, so "what does my German
look like" was answered where nobody looking at fonts would find it, and "what does Bengali
look like" was answered twice, differently. The languages are defined on Metadata, because
that is where a language IS defined; every face for them is chosen in Settings, because
that is where every other face is chosen. The panel reads that table and sends a reader
back to the table itself — not to Metadata's front page, which is eight sections and a
direction rather than a door.

**ONE DOOR TO METADATA, NOT TWO, AND THIS IS A DEPARTURE FROM THE PACK.** The pack draws
`metaDoor` on this section — "What your library is made of", opening Metadata whole
(`settings-restructured.dc.html:2643`) — and the quote-face panel now carries a door of its
own to the language TABLE. Both shipped for one commit, which is two doors to one screen on
a screen whose session had been asked not to repeat itself. The owner's words decide which
survives: *"this sheet needs a window to the metadata languages section, not entire
metadata. And that gate should be in the language fonts section, don't you think?"* The
general one is the weaker of the pair twice over — Metadata is a destination in the
navigation already, which a row cannot say better, and it lands a reader on an overview
rather than on the table they wanted. A rating found the pair; the pack is departed from on
purpose, which is why it is written down here rather than left to be rediscovered as an
omission.

**THE ROW LABEL LEFT MONO, AND THAT IS WHY THE SCREEN LOOKED FLAT.** `PrefRow` drew its
label in `.mono-label` — 11px, uppercase, faint — which is the same drawing a GROUP title
wears. A section was one run of small grey capitals with nothing saying which line was the
heading; the pack sets a row name in the interface face at semibold (`:174`) and keeps mono
for the head above it (`:144`). Two levels instead of none, on every settings section at
once.

**AND THE SECTION GREW ITS SECOND COLUMN.** It drew one narrow column down the left of a
1280px card and left the other half empty. `PrefColumns` is the pack's shape — Interface
and Your own fonts side by side, the face list spanning under both — at the same 1024px
the shell already grows its rail. A group says whether it is `wide`: a face list squeezed
into half a card is a specimen nobody can judge, and three short accessibility rows across
a whole card put every control an arm's length from its own label.

*Unreleased — `web/frontend/src/Settings.jsx`, `web/frontend/src/prefRow.jsx`,
`web/frontend/src/locale.jsx`, `web/frontend/src/MetadataSources.jsx`,
`web/frontend/src/index.css`, `internal/i18n/en.txt`, `internal/i18n/bn.txt`.*

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
