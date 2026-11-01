// DRAGGING A ROW INTO PLACE, BY POINTER RATHER THAN BY THE DRAG-AND-DROP API.
//
// WHY NOT HTML5 DnD. `draggable` plus `dragstart`/`dragover` is the obvious
// answer and it does not work on a touch screen at all — no mobile browser fires
// those events from a finger. On this screen the grip is the PHONE's only sorter
// (the up/down buttons are a desk affordance), so an implementation a finger
// cannot drive would have left the phone with no way to reorder anything.
// Pointer events are one API for mouse, pen and touch, which is what they were
// added for.
//
// WHAT IT DOES NOT DO. It does not animate and does not build a drag image.
//
// IT SCROLLS WHEN THE POINTER HOLDS NEAR THE EDGE (anthologies, 3.5.x). A list of four to six
// rows fits on any screen, and this note used to say a longer one would need the edge-scroll and
// should say so when it arrived. An anthology of two hundred passages is that list: the scroller
// is the nearest scrolling ancestor of the list (or the window), nudged on every animation frame
// while the pointer is within an edge band, so a held pointer keeps scrolling and a still one at
// the middle does not.
//
// THE KEYBOARD IS NOT THIS FILE'S JOB. A grip is a pointer affordance, and a
// keyboard reader gets the up/down buttons — which is why those stay on the desk
// and why the grip carries `aria-hidden` on its glyph but a real label on its
// button.
import { useCallback, useEffect, useRef, useState } from 'react'

const EDGE = 64 // px from the top or bottom of the scroller that starts it
const STEP = 16 // px per frame

// The nearest ancestor that scrolls vertically, or null for the window.
function scrollParent(el) {
  for (let n = el?.parentElement; n; n = n.parentElement) {
    const oy = getComputedStyle(n).overflowY
    if ((oy === 'auto' || oy === 'scroll') && n.scrollHeight > n.clientHeight) return n
  }
  return null
}

export function useRowReorder(onMove) {
  // The list element, so the rows can be measured. A ref rather than a query, so
  // two lists on one screen cannot pick up each other's rows.
  const listRef = useRef(null)
  const from = useRef(-1)
  const lastY = useRef(0)
  const frame = useRef(0)
  const [dragging, setDragging] = useState(-1)
  const [over, setOver] = useState(-1)

  // WHICH ROW IS UNDER THE POINTER, by measuring rather than by hit-testing. A
  // hit test returns whatever is painted at that point, which during a drag is
  // the row being carried; the midpoints of the row rectangles answer the
  // question actually being asked — which slot would this land in.
  const slotAt = useCallback((clientY) => {
    const list = listRef.current
    if (!list) return -1
    const rows = [...list.querySelectorAll('[data-row-index]')]
    for (const el of rows) {
      const r = el.getBoundingClientRect()
      if (clientY < r.top + r.height / 2) return Number(el.dataset.rowIndex)
    }
    return rows.length - 1
  }, [])

  // One frame of edge scrolling, then the next while a drag is still going.
  const tick = useCallback(() => {
    if (from.current < 0) return
    const sp = scrollParent(listRef.current)
    const top = sp ? sp.getBoundingClientRect().top : 0
    const bottom = sp ? sp.getBoundingClientRect().bottom : window.innerHeight
    const y = lastY.current
    const dy = y < top + EDGE ? -STEP : y > bottom - EDGE ? STEP : 0
    if (dy) (sp || window).scrollBy(0, dy)
    frame.current = requestAnimationFrame(tick)
  }, [])
  useEffect(() => () => cancelAnimationFrame(frame.current), [])

  const onPointerDown = useCallback((i) => (e) => {
    // Primary button only; a right-click on a grip is a context menu, not a drag.
    if (e.button != null && e.button !== 0) return
    e.preventDefault()
    from.current = i
    lastY.current = e.clientY
    cancelAnimationFrame(frame.current)
    if (typeof requestAnimationFrame === 'function') frame.current = requestAnimationFrame(tick)
    setDragging(i)
    setOver(i)
    // CAPTURE, so the drag survives the pointer leaving the grip — which it does
    // immediately, because the row moves out from under it.
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* not captured; the move handler still fires */ }
  }, [tick])

  const onPointerMove = useCallback((e) => {
    if (from.current < 0) return
    lastY.current = e.clientY
    const to = slotAt(e.clientY)
    if (to >= 0) setOver(to)
  }, [slotAt])

  const end = useCallback(() => {
    const a = from.current
    from.current = -1
    cancelAnimationFrame(frame.current)
    setDragging(-1)
    const b = over
    setOver(-1)
    if (a >= 0 && b >= 0 && a !== b) onMove(a, b)
  }, [over, onMove])

  return {
    listRef,
    dragging,
    over,
    // Spread onto the grip button.
    gripProps: (i) => ({
      onPointerDown: onPointerDown(i),
      onPointerMove,
      onPointerUp: end,
      onPointerCancel: end,
      'data-dragging': dragging === i ? '1' : undefined,
    }),
    // Spread onto the row.
    rowProps: (i) => ({
      'data-row-index': i,
      'data-dragging': dragging === i ? '1' : undefined,
      'data-drop': dragging >= 0 && over === i && dragging !== i ? '1' : undefined,
    }),
  }
}
