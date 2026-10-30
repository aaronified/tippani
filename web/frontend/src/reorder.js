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
// IT SCROLLS WHEN YOU HOLD A ROW AT THE EDGE of whatever scrolls the list (the nearest scrollable
// ancestor, or the page), because the Episodes dialog lists a show of hundreds of episodes and a
// list that cannot be dragged past its first screen cannot be sorted. The scroll runs on the
// frame clock while a drag is held, so keeping the pointer still at the edge keeps scrolling.
//
// AND THE KEYBOARD IS THIS FILE'S JOB NOW. Every grip answers Alt+ArrowUp and Alt+ArrowDown by moving
// its row one place, so a list that can be dragged can also be sorted without a pointer. The up/down
// buttons Settings draws stay where they are: they say what they do in words, and the grip is the
// affordance for a long move.
import { useCallback, useEffect, useRef, useState } from 'react'

// How near an edge (px) a held row starts the list scrolling, and how far each frame moves it.
const EDGE = 48
const STEP = 14

function scroller(el) {
  for (let n = el?.parentElement; n; n = n.parentElement) {
    const o = getComputedStyle(n).overflowY
    if ((o === 'auto' || o === 'scroll') && n.scrollHeight > n.clientHeight) return n
  }
  return null
}

export function useRowReorder(onMove) {
  // The list element, so the rows can be measured. A ref rather than a query, so
  // two lists on one screen cannot pick up each other's rows.
  const listRef = useRef(null)
  const from = useRef(-1)
  const [dragging, setDragging] = useState(-1)
  const [over, setOver] = useState(-1)
  const pointerY = useRef(0)
  const frame = useRef(0)

  // The edge-scroll loop: runs only while a row is held, and re-slots the drop target as the list moves.
  const tick = useCallback(() => {
    if (from.current < 0) return
    const box = scroller(listRef.current)
    const rect = box ? box.getBoundingClientRect() : { top: 0, bottom: window.innerHeight }
    const y = pointerY.current
    let dy = 0
    if (y < rect.top + EDGE) dy = -STEP
    else if (y > rect.bottom - EDGE) dy = STEP
    if (dy) {
      if (box) box.scrollBy(0, dy)
      else window.scrollBy(0, dy)
    }
    frame.current = requestAnimationFrame(tick)
  }, [])
  useEffect(() => () => cancelAnimationFrame(frame.current), [])

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

  const onPointerDown = useCallback((i) => (e) => {
    // Primary button only; a right-click on a grip is a context menu, not a drag.
    if (e.button != null && e.button !== 0) return
    e.preventDefault()
    from.current = i
    pointerY.current = e.clientY
    cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(tick)
    setDragging(i)
    setOver(i)
    // CAPTURE, so the drag survives the pointer leaving the grip — which it does
    // immediately, because the row moves out from under it.
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* not captured; the move handler still fires */ }
  }, [])

  const onPointerMove = useCallback((e) => {
    if (from.current < 0) return
    pointerY.current = e.clientY
    const to = slotAt(e.clientY)
    if (to >= 0) setOver(to)
  }, [slotAt])

  const end = useCallback(() => {
    cancelAnimationFrame(frame.current)
    const a = from.current
    from.current = -1
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
      // Alt+ArrowUp / Alt+ArrowDown: one place, for a reader with no pointer.
      onKeyDown: (e) => {
        if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return
        e.preventDefault()
        const rows = listRef.current?.querySelectorAll('[data-row-index]').length ?? 0
        const to = e.key === 'ArrowUp' ? i - 1 : i + 1
        if (to >= 0 && to < rows) onMove(i, to)
      },
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
