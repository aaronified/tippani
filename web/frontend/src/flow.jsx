// v3 sticker layer: a quote that flows around a round "sticker" the reader can
// drag anywhere inside the block, using @chenglou/pretext for per-line measuring.
//
// pretext isn't shape-aware — it measures/breaks text for a width WE give it. So
// we drive the shape: for each line we compute the free horizontal segment(s) the
// circular seal leaves at that line's height (one segment if the seal hugs an
// edge, two if it sits mid-block), hand pretext each width, and it tells us what
// fits. The result is real, selectable DOM text hugging the seal's curve.
//
// The seal's centre is stored width-normalised (sticker_x/y as a fraction of the
// block width) so the coordinate is stable no matter how the text reflows around
// it. NULL ⇒ top-right corner (the pre-drag default). pretext is a dynamic
// import() (its own chunk); until it loads — and under prefers-reduced-motion, or
// with no seal — we fall back to a plain paragraph with the seal floated.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ANNOTATION_HEX } from './ui.jsx'

// usePrefersReducedMotion — flowed layout is an enhancement; respect the OS
// setting and fall back to plain text (with a floated seal) when it's on.
function usePrefersReducedMotion() {
  const [reduce, setReduce] = useState(
    () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  useEffect(() => {
    const m = matchMedia('(prefers-reduced-motion: reduce)')
    const fn = () => setReduce(m.matches)
    m.addEventListener('change', fn)
    return () => m.removeEventListener('change', fn)
  }, [])
  return reduce
}

// fontOf reads the element's rendered font into a canvas font-shorthand string
// (so pretext measures with the exact face the DOM paints) plus its line height.
function fontOf(el) {
  const cs = getComputedStyle(el)
  const size = parseFloat(cs.fontSize) || 16
  let lh = parseFloat(cs.lineHeight)
  if (!lh || Number.isNaN(lh)) lh = size * 1.5
  return { font: `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`, lh }
}

// segmentsAt returns the free horizontal segment(s) on the line band [top,top+lh]
// given a circle anywhere in the block. Text runs left→right, so a seal hugging
// the right leaves one left segment, hugging the left leaves one right segment,
// and sitting mid-block leaves two (text wraps down both sides). Bands that clear
// the circle get the full width; bands the circle fully spans get none.
function segmentsAt(top, lh, W, c, gap, minW) {
  const bandTop = top
  const bandBottom = top + lh
  let dy = 0
  if (c.cy < bandTop) dy = bandTop - c.cy
  else if (c.cy > bandBottom) dy = c.cy - bandBottom
  if (dy >= c.r) return [{ x: 0, w: W }] // this line clears the seal entirely
  const half = Math.sqrt(c.r * c.r - dy * dy)
  const cl = c.cx - half - gap // left edge of the blocked zone
  const cr = c.cx + half + gap // right edge of the blocked zone
  const segs = []
  if (cl >= minW) segs.push({ x: 0, w: cl })
  if (W - cr >= minW) segs.push({ x: cr, w: W - cr })
  return segs
}

function computeLines(mod, text, font, lh, W, circle, gap) {
  const minW = 34
  const prepared = mod.prepareWithSegments(text, font)
  let cursor = { segmentIndex: 0, graphemeIndex: 0 }
  const lines = []
  let y = 0
  for (let guard = 0; guard < 800; guard++) {
    const segs = segmentsAt(y, lh, W, circle, gap, minW)
    if (segs.length === 0) {
      // The seal spans the whole width at this band. Emit a blank spacer only if
      // text still remains (probe without consuming the cursor) — otherwise we'd
      // pad endless empty lines beneath a finished quote.
      const probe = mod.layoutNextLine(prepared, cursor, W)
      const more = probe && !(probe.end.segmentIndex === cursor.segmentIndex && probe.end.graphemeIndex === cursor.graphemeIndex)
      if (!more) break
      lines.push({ segs: [] })
      y += lh
      continue
    }
    const lineSegs = []
    let advanced = false
    for (const s of segs) {
      const line = mod.layoutNextLine(prepared, cursor, Math.max(minW, s.w))
      if (!line) break
      // No-progress guard: a too-narrow segment that can't advance the cursor.
      if (line.end.segmentIndex === cursor.segmentIndex && line.end.graphemeIndex === cursor.graphemeIndex) break
      lineSegs.push({ text: line.text, x: s.x, w: s.w })
      cursor = line.end
      advanced = true
    }
    if (!advanced) break
    lines.push({ segs: lineSegs })
    y += lh
  }
  return lines
}

// StickerTag — a round wax-seal sticker carrying the tag name, tinted by the
// tag's colour. The quote's text flows around it; it can be dragged (see below).
export function StickerTag({ name, color = 'yellow' }) {
  return (
    <span className="sticker-seal" style={{ '--seal': ANNOTATION_HEX[color] || color }} aria-hidden="true">
      <span className="sticker-seal-label">{name}</span>
    </span>
  )
}

// FlowQuote flows `text` around a round sticker. `sticker` is the node to pin;
// `stickerKey` is a stable identity for the layout effect. `pos` is the seal's
// saved centre { x, y } in width-normalised units (null ⇒ top-right default).
// `onMove(x, y)` — when provided the seal is draggable and this fires on release
// so the caller can persist the new position. radius is the seal radius in px.
export function FlowQuote({ text, sticker, stickerKey = '', quoteStyle, radius = 42, gap = 12, maxLines = 0, pos = null, onMove, className = '' }) {
  const ref = useRef(null)
  const [state, setState] = useState(null) // { lines, lh, r, W, cx, cy } | null (=> fallback)
  const [open, setOpen] = useState(false) // show-more expansion (when maxLines set)
  const reduce = usePrefersReducedMotion()
  const hasSticker = !!sticker

  // Refs the (stable) drag handlers read, so a mid-drag reflow re-render never
  // swaps the listener identity out from under add/removeEventListener.
  const posRef = useRef(pos)              // seal centre {x,y} width-normalised, or null=default
  const relayoutRef = useRef(null)        // imperative re-flow (set by the layout effect)
  const stateRef = useRef(state)
  const dragRef = useRef(null)
  const onMoveRef = useRef(onMove)
  stateRef.current = state
  onMoveRef.current = onMove

  // A different annotation (new text/seal) collapses the clamp and resets pos.
  useEffect(() => { setOpen(false); posRef.current = pos }, [text, stickerKey]) // eslint-disable-line react-hooks/exhaustive-deps
  // A pos change from outside (e.g. after a save round-trips) resyncs when idle.
  useEffect(() => {
    if (!dragRef.current) { posRef.current = pos; relayoutRef.current && relayoutRef.current() }
  }, [pos && pos.x, pos && pos.y]) // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    const el = ref.current
    if (!el || reduce || !hasSticker || !text) {
      setState(null)
      return
    }
    let cancelled = false
    let mod = null
    async function relayout() {
      if (!mod) mod = await import('@chenglou/pretext')
      if (cancelled) return
      const W = el.clientWidth
      if (!W) return
      const r = Math.min(radius, Math.floor(W / 3)) // never eat more than a third
      const { font, lh } = fontOf(el)
      // The text's natural (unobstructed) height bounds how far down the seal may
      // sit — otherwise a low seal on a short quote floats off the bottom of the
      // card. At least 2r so the seal always fits.
      const naturalH = Math.max(computeLines(mod, text, font, lh, W, { cx: 0, cy: 0, r: 0 }, gap).length * lh, r * 2)
      const p = posRef.current
      let cx = p && typeof p.x === 'number' ? p.x * W : W - r // default: top-right
      let cy = p && typeof p.y === 'number' ? p.y * W : r
      cx = Math.max(r, Math.min(W - r, cx))
      cy = Math.max(r, Math.min(naturalH - r, cy))
      const lines = computeLines(mod, text, font, lh, W, { cx, cy, r }, gap)
      if (!cancelled) setState({ lines, lh, r, W, cx, cy, naturalH })
    }
    relayoutRef.current = () => relayout().catch(() => {})
    relayout().catch(() => { if (!cancelled) setState(null) }) // any failure → plain fallback
    const ro = new ResizeObserver(() => relayout().catch(() => {}))
    ro.observe(el)
    // Web fonts change metrics — re-flow once they're ready.
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (!cancelled) relayout().catch(() => {}) })
    return () => { cancelled = true; ro.disconnect(); relayoutRef.current = null }
  }, [text, stickerKey, hasSticker, reduce, radius, gap])

  // ---- drag (stable identities via refs) ----
  const onSealMove = useCallback((e) => {
    const d = dragRef.current
    if (!d) return
    let cx = e.clientX - d.left - d.grabDx
    let cy = e.clientY - d.top - d.grabDy
    cx = Math.max(d.r, Math.min(d.W - d.r, cx))
    cy = Math.max(d.r, Math.min(Math.max(d.r, d.naturalH - d.r), cy))
    posRef.current = { x: cx / d.W, y: cy / d.W }
    if (relayoutRef.current) relayoutRef.current()
  }, [])
  const onSealUp = useCallback(() => {
    window.removeEventListener('pointermove', onSealMove)
    window.removeEventListener('pointerup', onSealUp)
    const el = ref.current
    if (el) el.dataset.dragging = '0'
    const wasDragging = !!dragRef.current
    dragRef.current = null
    if (wasDragging && onMoveRef.current && posRef.current) onMoveRef.current(posRef.current.x, posRef.current.y)
  }, [onSealMove])
  const onSealDown = useCallback((e) => {
    const st = stateRef.current
    if (!onMoveRef.current || !st) return
    e.preventDefault()
    e.stopPropagation() // don't let the card treat this as a click/navigation
    const el = ref.current
    const rect = el.getBoundingClientRect()
    dragRef.current = {
      left: rect.left, top: rect.top, W: st.W, r: st.r, naturalH: st.naturalH,
      grabDx: e.clientX - rect.left - st.cx, // keep the grabbed point under the cursor
      grabDy: e.clientY - rect.top - st.cy,
    }
    el.dataset.dragging = '1'
    window.addEventListener('pointermove', onSealMove)
    window.addEventListener('pointerup', onSealUp)
  }, [onSealMove, onSealUp])
  useEffect(() => () => { // safety: drop listeners if we unmount mid-drag
    window.removeEventListener('pointermove', onSealMove)
    window.removeEventListener('pointerup', onSealUp)
  }, [onSealMove, onSealUp])

  const size = state ? state.r * 2 : radius * 2
  const allLines = state ? state.lines : []
  const clamped = maxLines > 0 && !open && allLines.length > maxLines
  const shown = clamped ? allLines.slice(0, maxLines) : allLines
  const canToggle = !!state && maxLines > 0 && (allLines.length > maxLines || open)
  const draggable = !!onMove
  return (
    <div ref={ref} className={`flow ${className}`} style={{ position: 'relative', ...quoteStyle }}>
      {state ? (
        <>
          <span
            className="flow-sticker"
            onPointerDown={draggable ? onSealDown : undefined}
            style={{
              position: 'absolute',
              left: state.cx - state.r,
              top: state.cy - state.r,
              width: size,
              height: size,
              zIndex: 2,
              cursor: draggable ? 'grab' : 'default',
              touchAction: draggable ? 'none' : undefined,
            }}
            title={draggable ? 'Drag to reposition' : undefined}
          >
            {sticker}
          </span>
          <div style={{ height: Math.max(shown.length * state.lh, state.cy + state.r) }}>
            {shown.map((ln, i) => (
              <div key={i} style={{ position: 'relative', height: state.lh }}>
                {ln.segs.map((s, j) => (
                  <span
                    key={j}
                    className="flow-line"
                    style={{ position: 'absolute', left: Math.max(0, s.x), top: 0, width: Math.max(0, s.w), height: state.lh, lineHeight: `${state.lh}px` }}
                  >
                    {s.text || ' '}
                  </span>
                ))}
              </div>
            ))}
          </div>
          {canToggle && (
            <span
              role="button"
              tabIndex={0}
              className="show-toggle"
              onClick={() => setOpen((o) => !o)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setOpen((o) => !o)
                }
              }}
            >
              {open ? 'show less' : 'show more'}
            </span>
          )}
        </>
      ) : (
        <p className="flow-fallback" style={{ margin: 0 }}>
          {sticker && (
            <span className="flow-sticker" style={{ float: 'right', width: size, height: size, marginLeft: gap, marginBottom: 4 }}>
              {sticker}
            </span>
          )}
          {text}
        </p>
      )}
    </div>
  )
}
