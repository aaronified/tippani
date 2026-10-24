# ADR-0466: Six default portraits, picked by a hash of the name

Source of truth: this wiki page.

- **Area:** [§13 Controls, Labels, Icons and Help](ADR-Index.md#area-13)
- **Status:** Accepted
- **Version:** 3.1.0

**Decided.** `silhouette.jsx` holds six head-and-shoulders masks and `silhouetteIndex(name)` — an FNV-1a over the trimmed, lower-cased name, modulo six. Every site that draws a face with no photograph behind it uses them: the person chip, the People table, the cast row's picture button, a character's head, and the round `MediaBlock`.

**Why.** One silhouette for everybody made a list of ninety people read as one person repeated, and the face is the fastest thing in a row to recognise. Six is enough to break the repetition without pretending to identify anybody.

**Hashed, not random and not stored.** The same person must wear the same face on a chip, in the table, on their record and on a share image; a face that changes between two screens is a face nobody can learn. A stored column would be a fact to migrate, to merge and to get wrong — and it would survive a merge that folded two records into one, which is exactly when the face should follow the surviving name.

**The name, never the credit-as.** A translator credited as "A. Das" on one book and "Arani Das" on another is one person, and a face that changed between the two would say they were two. `person-instructions.md` draws the same line for the same reason.

**Not `normName`, which was the obvious thing to hash and the trap.** The app's own name fold strips everything outside `[a-z0-9]`, so every Bengali name in the library folds to the empty string — hashing it would put a bilingual library's entire Bengali half on one face while the English half looked correct. The hash runs over code points of the raw lower-cased name; there is a test that names Bengali specifically, because this is a defect that a monolingual test suite cannot see.

**Masks, not `<img>`.** Inline paths filled with `currentColor`, so they take the theme in both modes, scale with the box, and can never be mistaken for a photograph somebody uploaded — which a grey JPEG of a silhouette eventually is.

**An empty cast picture changed shape because of this.** It was a grey plate under a full-bleed picture icon, which said "press me" and said nothing about what the row was. It now wears its silhouette, and the verb takes the same bottom strip a filled row shows on hover, kept always on — the affordance is still permanent, and the box has stopped being blank.

**Instead of.** Six SVG files under `assets/`, as the pack proposed — five extra requests on a list of ninety, a colour that cannot follow the theme without inlining them anyway, and a build step to keep them in the bundle. Initials on a coloured disc — that is a different idea, not a silhouette: it reads as a chosen avatar, and the app would be asserting a monogram for a person whose name is not Latin. More than six — a reader has to be able to tell two of them apart at 15px, and by nine the differences are interior detail, which a silhouette does not have.

<sub>3.1.0 — `web/frontend/src/silhouette.jsx` · `web/frontend/src/people.jsx` · `web/frontend/src/cast.jsx` · `web/frontend/src/identity.jsx` · `web/frontend/src/MetadataPage.jsx` · `web/frontend/src/ui.jsx` · `web/frontend/src/index.css` · `web/frontend/test/pure/silhouette.test.js` · `web/frontend/test/dom/silhouette-faces.test.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
