# ADR-0852: A specimen is the part that cannot be a name

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

**THE SECTION FOR CHOOSING A FACE SHOWED NO FACES.** Language and font drew a language
picker and a button; all four faces the interface is set in were behind that button, and
the pack draws them on the section with a specimen apiece. So "what is this app set in"
was one press away and "what would it look like if I changed it" was a press inside that
press. The owner's ruling was to bring the faces out and leave the rest behind the door.

**IT PICKS NOTHING ITSELF, AND THAT IS THE POINT OF THE SPLIT.** Pressing a specimen opens
the Type panel, where a face is chosen along with everything that goes with choosing one —
the style modifiers, the script check, the per-language scope, the uploads. Two places that
both assign a face would be two writers for one preference, and this repository has spent
enough commits pulling those apart. What comes out is the seeing; what stays in is the
choosing.

**THE ROWS ARE `fontStateFor`'s**, the same pure exported function the panel uses, which
already returns each role with the face chosen and the stack that role would draw with. The
specimen here is therefore the same specimen the panel shows rather than a second opinion
about what the type looks like.

**ONLY THE FOUR THE INTERFACE WEARS.** The role table also holds Bengali and Devanagari,
which are what a QUOTE in those scripts is set in rather than anything the interface has
on — they belong to the panel's scope picker and would read here as two more UI faces. The
filter is `!r.script`, which is the table's own distinction rather than a list of four
names repeated here.

*Unreleased — `web/frontend/src/Settings.jsx`,
`web/frontend/test/dom/language-faces.test.jsx`.*

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
