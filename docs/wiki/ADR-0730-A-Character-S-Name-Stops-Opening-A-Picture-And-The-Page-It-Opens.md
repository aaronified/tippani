# ADR-0730: A character's name stops opening a picture, and the page it opens knows which work

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** Unreleased

*The owner's ask: "the character should open the character screen (for the work). the work
and book level character screens should have similar structure, but it must be visually
distinct to drive home the difference. use short infodots and subtext to clarify this."*

- **This supersedes "Both names are controls, and each leads to its own picture" (2.3.0).**
  That entry was right that the character name should not lead to the actor, and it picked
  the wrong destination: the picture editor. It was defensible while a character was flat
  text with a still attached — 0056 had given it a record, but nothing had given the record
  a door. A reader pressing a character's name is asking who the character is.
- **The picture editor has not moved**, which is what makes the change cheap: it is what
  the face beside the name opens, and that was always the more obvious of the two doors.
  A row whose `character_id` is null keeps the picture editor on its name, because a link
  to a page that does not exist is worse than the affordance it replaces.
- **The page is scoped by where you came from.** A character record is library-wide and
  the page drew it that way — one grid of every appearance, in query order. From the
  metadata console that is right. From a film's cast list it is not: the reader has
  already said which work they mean and the card they want is one of eight. So the
  appearance they arrived through is lifted out and given the first scope. LIFTED, not
  copied: a card in two sections invites the reader to edit the wrong one, and the two
  edit the same row.
- **Three grains, said twice over.** The sentence under each heading has always said what
  saving there CHANGES; a dot now says what the section IS — one row in one work's cast,
  one record across however many works, the record itself. A reader who has not yet
  worked out that a character exists twice cannot read the blast-radius sentence
  correctly, so the dot has to come first.
- **An inked edge rather than a card**, and only on the narrow scope. A card would make
  the first section a different KIND of thing from the two below it, and it is not — it
  is the same panel at a finer grain. Marking only the narrowest means the ink reads as
  "narrow" rather than "important".
- **REJECTED: building the panel inside `cast.jsx`.** `identity.jsx` imports the picture
  hook out of `cast.jsx`, so the import would close a cycle; the caller holds the stack
  anyway, so `CastSection` takes a function of the row.

- **AND THE SCOPE IS KEYED ON THE CAST ROW, NOT THE WORK** — corrected after the first
  version shipped with the weaker key. `idx_work_cast_pair` is unique on
  `(kind, work_id, character_key, actor_key)`, so one work may bill one character twice:
  the young Vito and the old Vito are two rows on one film, both linked to one record.
  Looking the appearance up by `(kind, work_id)` returns the first, so pressing the
  second row lifted its sibling and then counted the row you actually pressed among "the
  others". The lookup takes `castId` first and falls back to the work, which is not dead
  code — a caller may know the work and not the row, and where a work bills a character
  once the two agree.
- **The wiring between the two halves had no test, which is how it got in.** One group of
  cases rendered the cast list with a stub opener; another rendered the panel from a
  descriptor written by hand. `workPeoplePanel` turns the first into the second, and
  dropping `castId` there broke neither. There is now a case that presses the name in the
  cast list, takes the descriptor the stack was actually pushed, and renders that.

<sub>Unreleased — `web/frontend/src/cast.jsx` · `identity.jsx` · `WorkDetails.jsx` ·
`index.css` · `internal/i18n/{en,bn}.txt` · `test/dom/character-from-work.test.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
