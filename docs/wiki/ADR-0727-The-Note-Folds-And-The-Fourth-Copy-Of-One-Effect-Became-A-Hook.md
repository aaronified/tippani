# ADR-0727: The note folds, and the fourth copy of one effect became a hook

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** Unreleased

- **The pack's rule, verbatim:** "A NOTE ALWAYS FOLDS AT TWO LINES. It is a margin
  remark, not a second quote — if it needs more room than the thing it annotates, it is
  an annotation of its own." Unfolded it printed whole in 19px hand type and was
  routinely taller than the quote it sat under, which inverts the card.
- **One caller genuinely differs and takes `lines={0}`.** On a quiz card the note IS the
  thing being read — the answer's own margin rather than a remark beside something you
  are looking at — so it takes no clamp and offers no control. `0` is a real answer here
  rather than a missing one, and the hook says so.
- **`useClamped` exists because this would have been the third identical effect.**
  `ExpandableText` and `ExpandableDescription` each held their own `overflows` state,
  read `scrollHeight > clientHeight + 2` on their own ref, and built the same
  `-webkit-box` object. That `+ 2` is a sub-pixel fudge and it appeared twice; a third
  copy is where it becomes 2, 2 and 3.
- **`watch` is passed rather than inferred, and that is the one subtle part.** A
  ResizeObserver watches the BORDER box, which for a clamped element is pinned at N
  lines — so content changing from two words to two paragraphs never fires it. The
  observer covers the box getting narrower; `watch` covers the text getting longer.
  Callers whose children are nodes pass those nodes and re-measure per render, which is
  cheap on the surfaces that do it; callers with a string pass the string, which is the
  path that runs two hundred times on a board.
- **The clamp is on the `<p>` and the control on a wrapper**, which is the shape the
  other three clamped blocks already take: a `-webkit-box` cannot hold a chevron beside
  its own text without the chevron counting as one of the lines.

<sub>Unreleased — `web/frontend/src/ui.jsx` · `review.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
