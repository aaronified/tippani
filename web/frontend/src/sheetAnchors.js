// WHERE A DRAGGED SHEET LANDS.
//
// THE OWNER'S RULING, over a screenshot of a bottom sheet with a grab handle:
// "the whole thing is responsive to drag, and has predefined anchors" — natural
// height, then 76%, then 94%, and a pull down from the smallest dismisses.
//
// 76 AND 94 ARE THE PACK'S OWN TWO NUMBERS. `book-detail.dc.html:4207-4208`
// ceilings a mobile sheet at `max-height:calc(${sheet && sheet.form ? '94%' :
// '76%'}` — a list keeps a quarter of the page visible so you can see what you
// are choosing FOR, and a form takes almost everything because its context is its
// own fields. The artboard picks by KIND. This app has one panel that is a list
// and a form at once — a character sheet is a column of displays with an editor
// behind every row — so it could never pick, and anchors mean it does not have
// to: it opens at whichever it needs and the reader moves it.
//
// WHY THIS IS ITS OWN FILE, with no React in it. Everything below is arithmetic
// on numbers, and it is the part that decides what the gesture MEANS: which
// height a release lands on, and when a release is a dismissal instead. A drag
// cannot be measured in jsdom and can only be watched in a browser, so the rule
// lives where a test can state it directly and the hook is left with nothing but
// wiring.
//
// PROJECTION RATHER THAN A THRESHOLD, which is the difference between a sheet
// that feels thrown and one that feels dragged. A release is judged on where the
// sheet WOULD be a moment later at its current speed, not on where it is — so a
// short fast flick reaches the next anchor and a long slow drag that stops short
// falls back to the one it came from. `PROJECT_MS` is that moment.

// The pack's two, as fractions of the viewport.
export const SHEET_STOPS = [0.76, 0.94]

// How far ahead a release is projected. 120ms is about the length of a flick and
// is short enough that a deliberate slow drag is judged on where it actually is.
export const PROJECT_MS = 120

// The fastest a release is allowed to be READ as, in px per ms.
//
// VELOCITY IS A QUOTIENT AND ITS DENOMINATOR IS THE PLATFORM'S. `dy / dt` between
// two pointer samples is a fine estimate at the ~16ms a frame gives, and nonsense
// when the two arrive in the same tick: a 40px pull sampled 0.1ms apart reads as
// 400px/ms, which projects a fifth of a mile and dismisses a sheet the reader was
// nudging. That is not a flick, it is a division.
//
// 4px/ms is 64px a frame — faster than a thumb travels and already enough to
// cross every anchor — so clamping here cannot cost a real gesture its meaning,
// and it makes the projection depend on the drag rather than on the sample rate.
export const MAX_FLICK = 4

// A pull below the smallest anchor by this much of it is a dismissal. Two fifths
// rather than half: by the time a sheet is half gone the reader has already
// decided, and asking for the other half is asking them to prove it.
export const DISMISS_FRACTION = 0.4

// anchorsFor — the heights this sheet may settle at, in px, smallest first.
//
// `natural` is what the content wants. It joins the list only when it is smaller
// than the pack's first stop, because a sheet that opens taller than 76% and
// calls that its natural height has no smaller stop to come back to. Duplicates
// fold: a sheet whose content is exactly 76% has two anchors, not three.
export function anchorsFor({ viewport, natural = 0 }) {
  if (!(viewport > 0)) return []
  const stops = SHEET_STOPS.map((f) => Math.round(viewport * f))
  const out = natural > 0 && natural < stops[0] ? [Math.round(natural), ...stops] : stops
  return [...new Set(out)].sort((a, b) => a - b)
}

// landing — what a release means: a height to settle at, or a dismissal.
//
// `height` is the sheet's height at the moment of release, `velocity` is px per
// ms and POSITIVE WHEN THE SHEET IS SHRINKING (the finger moving down), which is
// the direction a dismissal is in.
export function landing({ height, velocity = 0, anchors }) {
  if (!anchors || anchors.length === 0) return { dismiss: false, height }
  const v = Math.max(-MAX_FLICK, Math.min(MAX_FLICK, Number(velocity) || 0))
  const projected = height - v * PROJECT_MS
  const smallest = anchors[0]
  // A DISMISSAL IS A PULL DOWN FROM THE SMALLEST, AND THE READER HAS TO HAVE GONE
  // THERE. `height < smallest` is the half that was missing, and its absence was
  // the owner's report: "if i expand a popup from natural to 74%/96%, i cannot
  // take it back to natural. it closes."
  //
  // The projection is 120ms of travel at up to 4px/ms, so an ORDINARY thumb going
  // down at 2px/ms projects 240px below where it actually let go. Judging the
  // dismissal on that number meant a release at the smallest anchor — the one
  // position the reader was deliberately aiming for — read as a departure. The
  // projection's job is to choose WHICH ANCHOR a release was heading for; it may
  // not invent a departure from a height the reader is holding.
  //
  // Below the smallest is different, and that is where the projection is allowed
  // to finish the journey: the reader is already travelling through the sheet's
  // own exit, and asking them to drag every last pixel of it is asking them to
  // prove a decision they have made.
  if (height < smallest && projected < smallest - smallest * DISMISS_FRACTION) return { dismiss: true }
  // The nearest anchor to where it is going. `reduce` rather than a sort so a tie
  // keeps the SMALLER anchor: a sheet exactly between two stops settles down
  // rather than up, which is the direction the reader was already heading if they
  // let go without reaching.
  const to = anchors.reduce((best, a) => (
    Math.abs(a - projected) < Math.abs(best - projected) ? a : best
  ), anchors[0])
  return { dismiss: false, height: to }
}

// clampDrag — how tall the sheet is allowed to be mid-drag.
//
// It may not grow past its largest anchor: there is nothing above the top of the
// screen to reveal, and a sheet that stretches past it springs back with a jolt
// that reads as a fault. Downward it is free, because that is the dismissal and
// the reader has to be able to see it leaving.
export function clampDrag({ height, anchors }) {
  if (!anchors || anchors.length === 0) return Math.max(0, height)
  return Math.max(0, Math.min(height, anchors[anchors.length - 1]))
}
