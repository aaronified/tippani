// IS THIS BOX CUT OFF IN A WAY THE TYPE DIAL BROKE — asked without a browser.
//
// WHY THIS IS ITS OWN FILE. The predicate lived inside `typescale.mjs`'s `PROBE`
// string, which only exists inside `page.evaluate`, so the only way to ask whether
// it was right was to boot a server, restore a library and walk thirteen screens.
// It was wrong for half an hour and a rater found it by reading:
//
//     if (CLAMPED(cs)) continue        // ← skips the element ENTIRELY
//
// A `-webkit-line-clamp` box is exempt because it holds N LINES at every type
// size, so the dial cannot break it downwards — what changes at 175% is how many
// words fit on those lines, which is the clamp working. That argument says nothing
// about WIDTH. Skipping the element took every clamped box out of the horizontal
// ratchet too, and a clamped box whose content is cut off sideways is cut off for
// the ordinary reason: a px box that stopped holding its text.
//
// THE SAME FUNCTION RUNS IN THE PAGE. `typescale.mjs` stringifies this into its
// probe rather than keeping a second copy — a copy is what let the two disagree.
//
// THE OTHER TWO EXEMPTIONS, which predate this file and are why it takes
// `overflowX`/`overflowY` rather than a boolean: an `overflow: auto` box that
// outruns its size is a SCROLLER, and by now it wears a fade saying so; an
// `overflow: visible` box that outruns its size spills rather than clips, which is
// ugly and not lost. Only `hidden` and `clip` take the text away for good.

export function clipOf(m) {
  const cuts = (v) => v === 'hidden' || v === 'clip'
  const n = m.lineClamp
  const clamped = !!n && n !== 'none' && n !== '0'
  return {
    wide: m.scrollWidth > m.clientWidth + 1 && cuts(m.overflowX),
    // THE VERTICAL CLIP ONLY IS EXEMPT. See the argument above.
    tall: m.scrollHeight > m.clientHeight + 1 && cuts(m.overflowY) && !clamped,
  }
}
