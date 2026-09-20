// HOW MANY SPECIMEN COVERS FIT THE ROOM THERE IS.
//
// A FUNCTION RATHER THAN A LINE INSIDE THE COMPONENT, because this is the one
// part of the cover-size specimen that is arithmetic rather than a screen: given
// a width, a cell size and a gap it is a number, and a number is checkable
// without mounting anything or measuring a browser.
//
// WHAT IT IS FOR. The specimen under each size slider drew exactly three covers,
// always, at up to 240px each — `works.slice(0, 3)` sitting directly under a
// comment that promised "as many as fit, never a scroll". On a phone the third
// did not overflow, because the row wraps; it dropped to a second line. So the
// specimen's SHAPE changed as the reader dragged the slider, on the one control
// whose entire job is showing them a shape.
//
// NEVER FEWER THAN ONE. A specimen of nothing says nothing, and one cover fits
// any width this app supports — so when the room is unknown (before the first
// measurement) or absurdly small, one is the honest floor rather than zero.
export function coversThatFit(room, size, gap, max) {
  if (!(room > 0) || !(size > 0)) return 1
  // n cells cost n*size + (n-1)*gap, so the largest n is floor((room+gap)/(size+gap)).
  const n = Math.floor((room + gap) / (size + gap))
  return Math.min(max, Math.max(1, n))
}
