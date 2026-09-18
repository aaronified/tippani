# The design pack

The prototypes and handoff documents this app is being built to, kept **in the repo**
rather than in a chat attachment — they were re-sent three times across sessions because
an upload does not survive a reset and a fresh clone has never had one. Anything the
owner sends that a future session will need to read belongs here.

`docs/wiki/Design-decisions.md` says why the app is built the way it is. This directory is the other
half: what it is being built *towards*, in the designer's own words.

## Prototypes

Self-contained HTML. Open one in a browser — every component is pressable, and the
`.dc.html` files carry their own data, so nothing has to be running.

| File | What it shows |
| --- | --- |
| `prototypes/book-detail-wide.dc.html` | Desk: the book detail, Metadata, Stats, Settings |
| `prototypes/book-detail.dc.html` | The same on a phone |
| `prototypes/character-popup.dc.html` | The five character/people scopes (task 16) |
| `prototypes/ui-glossary.dc.html` | Every component and material, pressable |
| `prototypes/work-details-popup.dc.html` | The work's own details panel |
| `prototypes/settings-restructured.dc.html` | Settings as five sectioned screens in a two-pane shell — the theme overhaul, the section sort, the texture dials, the true-glass lens |
| `prototypes/metadata.dc.html` | Metadata as six consoles with no overview screen — every issue count a door into the rows that have it |

**WHAT THE TWO v3 PROTOTYPES GET WRONG, checked against the code rather than assumed,
because building them as drawn would lose working features:**

- **No Languages section in Metadata** — and the Settings prototype depends on one, in its
  own words: *"Read from the metadata language table, which is the only place a quote's
  language is defined; Settings links there rather than keeping a second list."* Today that
  list is a `FormModal` behind a button in `MetadataSources.jsx`. The design removed the
  door without building the room, so the port adds the section.
- **No long press on the dock's Back key**, although the Settings prototype's own release
  notes claim *"a long press now means three things, decided by what is under your thumb."*
  Its Back is a plain `history.back()`. The repo's is press-only too, so this is an
  addition rather than a restoration, and the three meanings still have to be decided.
- **The two prototypes disagree about the category palette.** Settings offers sixteen
  swatches, matching `CATEGORY_PALETTE` in `theme.js` hex for hex; Metadata offers eight,
  renamed (*Straw* for *Sun*). Sixteen is the repo's, and `palette.test.jsx` holds it there.
- **Counts in the prose do not match the screens.** Settings' release notes say *"seven
  named sections"* and it draws five; Metadata's help says *"four lists"* and it draws six.
- **`texturesbundle.js` is prototype scaffolding, not a shipping path.** A `.dc.html`
  cannot reference a file tree, so it inlines all 28 tiles as base64 and converts each to a
  Blob at runtime. The app serves them as `--tile-*` `url()` so the bundler emits cacheable
  files; porting the bundle would be a 1.9 MB regression.

**Not here:** `Icon Candidates.dc.html`, named by `handoff/handoff.md` as the glyph
proposal. It has not been sent; ask before working from memory on icons.

## Handoff documents

Read `handoff/handoff.md` first — it is written as the single source, and the rest are
its companions.

| File | Covers |
| --- | --- |
| `handoff/handoff.md` | Every design decision, and what differs from the committed app |
| `handoff/design-system.md` | Tokens, type, components as the repo defines them |
| `handoff/material-instructions.md` | The eight material families, the light model |
| `handoff/person-instructions.md` | Person identity — one record, many credits |
| `handoff/field-model.md` | Corrections the spec made to the first phone prototype |
| `handoff/CLAUDE-from-design.md` | The design side's standing rules |

`handoff/CLAUDE-from-design.md` is the DESIGNER's file, kept under its own name so it
cannot be confused with the repo's own `CLAUDE.md` at the root. Where the two disagree,
the root file is what binds the code; this one says what the screens are meant to be.

## Resources

`resources/providers.js`, `phosphor.js`, `icons.js` — the prototypes' own tables and
glyphs, and the reference for anything drawn from them.

**Values come from the app, not from these.** `handoff.md` is explicit: the source of
truth for a value is `docs/ui-glossary.html`, `theme.js`, `fonts.js`, `ui.jsx` — never
memory, and never a hand-drawn lookalike, because the icon test strips coordinates and
fails near-duplicates.
