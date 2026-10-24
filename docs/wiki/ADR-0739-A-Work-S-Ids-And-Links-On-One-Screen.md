# ADR-0739: A work's ids and links on one screen

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** Unreleased

*The owner, of Work details › Links: "the edit and add opens separate screens. They can be
merged into one. And also add has a middleman screen with nothing, that can be skipped."*

**Decided.** The section's pencil and the ＋ at the end of its pill row open one panel:
every id the medium has (filled or not, as the ids dialog had them), the stored links each
with its ✕, then the pages the record can already address and the paste box. The ids dialog
and the separate paste panel are gone, and so is the list's empty state, which was the
middleman: with the box on the same screen an empty list draws nothing.

- **STILL ONE REQUEST.** The dialog existed for the pack's "Ids saved — every one in a
  single request". The panel's one ✓ sends the edited ids and a pasted link in one PUT, and
  its badge counts both. A ✕ on a link still saves at once.
- **THE ✓ IS GREYED WHEN IT WOULD WRITE NOTHING**, with the reason: nothing changed yet,
  an address that is not one yet, or one already on the record. It is greyed while a save
  is on its way too, and a save that fails says so on the screen, as the ids dialog did.
- **EACH DOOR LANDS WHERE ITS VERB IS.** The pencil edits ids, so the screen it opens
  puts the cursor in the first id; the ＋ adds a link, so its screen puts it in the box.
- **THIS PASS AMENDS THE ENTRY ABOVE ON §1.12.** That entry put the paste box on its own
  panel because a panel may carry one header verb. The owner's ruling removes the need: with
  the box in the body there is no header verb to spend. §1.11 still holds: a derived page
  is a whole decision, so a pick appends and closes the panel, and so does the ✓.

<sub>Unreleased — `web/frontend/src/WorkDetails.jsx` · `workLinks.jsx` ·
`internal/i18n/{en,bn}.txt` · `test/dom/work-links.test.jsx` ·
`test/dom/link-suggest.test.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
