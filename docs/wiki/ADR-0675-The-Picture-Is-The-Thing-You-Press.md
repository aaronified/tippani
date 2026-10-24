# ADR-0675: The picture is the thing you press

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** 2.2.8

**Decided.** The cast row's face is the control that sets the cast row's picture. The
People section opens with the work.

**Three reports, one surface**: "the cast character images are not working at all"; "i
cannot see any cast character"; "i cannot edit or see the character images anywhere". All
three were true, and none of them was a broken endpoint — every byte of the pipeline
worked. What was wrong was that nothing on screen said so.

**A COLLAPSED PANEL IS AN INVISIBLE FEATURE.** It was behind a button reading "People" for
a defensible reason (a film's twenty rows would dominate the Details panel) and the cost
was total: a list you have to know to ask for is a list nobody knows about.

**AN UNLABELLED REFRESH ARROW SAYS "FETCH AGAIN"**, and the thing it opened means "choose
a picture". Beside it, a role with no art drew a blank grey rectangle that reads as a
spacer. So the affordance moved onto the object it affects. Empty, the face carries a
picture mark permanently, because nothing else in the row says a picture is missing;
filled, the mark appears on hover and focus, because a permanent badge over twenty faces
is twenty badges.

**And the two provider fetches left**, at the owner's suggestion and for a reason that
generalises: a control belongs with the controls that mean the same thing. "Cast from
TheTVDB" and "Cast from IMDb" are metadata fetches, and they were living inside the editor
for the rows they overwrite while the button labelled "Fetch metadata" was two screens
away.

<sub>2.2.8 — `web/frontend/src/cast.jsx` · `web/frontend/src/WorkDetails.jsx` · `web/frontend/src/index.css`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
