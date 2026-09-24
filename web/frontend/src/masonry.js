// useMasonry — pack a two-column grid of cards the way masonry does, keeping
// reading order across the row.
//
// THE OWNER: "Use masonry packing on desktop, not grid." A grid row is as tall as
// its tallest card, so a four-row card beside a twelve-row one leaves a column of
// empty paper exactly where the eye goes next. CSS columns would pack them, but
// they read DOWN each column — Settings numbers its cards, and 1, 2, 3 stacked on
// the left with 4, 5 on the right reads out of order. So the grid stays and each
// card is given a row span equal to its own height in small row units; the
// browser's ordinary auto-placement then drops every card, in order, into the
// first place it fits, which is the shortest column.
//
// A WIDE CARD STILL SPANS BOTH COLUMNS (`is-wide` in the stylesheet) and lands
// below the taller column, which is the only place a full-width card can go.
//
// NOTHING HAPPENS UNTIL THE GRID HAS TWO COLUMNS, so a phone keeps its single
// column and a browser without ResizeObserver keeps the plain grid — the rest
// state never depends on this running.
import { useLayoutEffect, useRef } from 'react'

// One row unit, in px. Small enough that rounding a card's height up to it is
// invisible; the gap between cards is carried by the span, not by row-gap.
const UNIT = 4

export function useMasonry() {
  const ref = useRef(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return undefined
    let frame = 0
    const layout = () => {
      frame = 0
      const cs = getComputedStyle(el)
      const cols = cs.gridTemplateColumns.split(' ').filter(Boolean).length
      const kids = [...el.children]
      if (cols < 2) {
        el.classList.remove('is-masonry')
        for (const k of kids) k.style.gridRowEnd = ''
        return
      }
      el.classList.add('is-masonry')
      const gap = parseFloat(cs.columnGap) || 0
      for (const k of kids) {
        // offsetHeight, not the painted rect: an entrance animation scales a card while
        // it arrives, and a span measured mid-scale is short and the next card overlaps.
        const h = k.offsetHeight
        k.style.gridRowEnd = `span ${Math.max(1, Math.ceil((h + gap) / UNIT))}`
      }
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(layout) }
    const ro = new ResizeObserver(schedule)
    const watch = () => {
      ro.disconnect()
      ro.observe(el)
      for (const k of el.children) ro.observe(k)
    }
    watch()
    // A card added or removed (a search narrowing Settings) re-packs the rest.
    const mo = new MutationObserver(() => { watch(); schedule() })
    mo.observe(el, { childList: true })
    layout()
    return () => { ro.disconnect(); mo.disconnect(); if (frame) cancelAnimationFrame(frame) }
  }, [])
  return ref
}
