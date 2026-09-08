import { useEffect, useRef, useState } from 'react'

// A LOADER THAT ONLY APPEARS WHEN SOMETHING IS ACTUALLY LATE.
//
// The owner's ask: "use some loading animation if there is an image and it is not
// loaded (no loader if there is no image)." The second clause is the hard half —
// a mark that appears the instant a box is empty appears on every fast load too,
// and a strobe on a local network is worse than the wait it describes.
//
// TWO NUMBERS, AND THEY ARE DIFFERENT QUESTIONS.
//
//   DELAY — how late is late. Below it nothing is drawn at all, so a picture that
//   arrives promptly is never described as slow. This is what stops the flash.
//
//   HOLD — once said, how long it must be said for. Without it an image that
//   lands at 160ms shows a mark for 10ms, which reads as a glitch rather than as
//   information. The hold makes the mark a statement instead of a flicker.
//
// WHY NOT THE APP'S OTHER TWO TIMINGS. A hover label waits 400ms (HOVER_TIP_MS)
// because a pointer crossing a control is not a request; search debounces 200ms
// because a keystroke is not a query. Neither is this: the request has already
// been made and the only question is whether to admit it is outstanding, which
// wants the shortest delay a reader will not perceive as a blink.
export const IMG_WAIT_DELAY_MS = 150
export const IMG_WAIT_HOLD_MS = 300

// useSlowArrival(pending) — "should a waiting mark be on screen right now".
//
// IT IS NOT `pending`. It lags it going up by DELAY and coming down by HOLD, and
// the whole value of the hook is those two lags being in one place: a component
// that inlined them would get the delay right and forget the hold, which is the
// half nobody notices until a fast connection makes everything blink.
//
// MOTION IS NOT THIS FUNCTION'S BUSINESS. What the mark looks like, and what it
// looks like for a reader who has asked for less movement, is the stylesheet's —
// index.css kills every animation under `prefers-reduced-motion: reduce`, so a
// mark built as an animated gradient becomes a still one with nothing here to
// arrange. The rule that matters is the repo's own: disable every animation and
// the content is still there.
export function useSlowArrival(pending) {
  const [shown, setShown] = useState(false)
  // WHEN it went up, so the hold can be measured from the right instant. A hold
  // measured from when `pending` fell would extend every mark by the full HOLD
  // however long it had already been up.
  const since = useRef(0)
  useEffect(() => {
    if (pending) {
      if (shown) return undefined
      const id = setTimeout(() => { since.current = Date.now(); setShown(true) }, IMG_WAIT_DELAY_MS)
      // CLEARED ON THE WAY OUT, which is the no-flash case itself: an image that
      // arrives inside the delay unmounts this timer before it ever fires.
      return () => clearTimeout(id)
    }
    if (!shown) return undefined
    const left = IMG_WAIT_HOLD_MS - (Date.now() - since.current)
    if (left <= 0) {
      setShown(false)
      return undefined
    }
    const id = setTimeout(() => setShown(false), left)
    return () => clearTimeout(id)
  }, [pending, shown])
  return shown
}
