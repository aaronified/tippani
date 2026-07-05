// v3 sticker layer: a quote that flows around a round "sticker" pinned to its
// top-right corner, using @chenglou/pretext for per-line measurement.
//
// pretext isn't shape-aware — it measures/breaks text for a width WE give it.
// So we drive the shape: for each line we compute how much width the circular
// sticker leaves free at that line's height, hand pretext that width, and it
// tells us exactly what text fits. The result is real, selectable DOM text
// (one <div> per line) that hugs the sticker's curve — not canvas.
//
// pretext is loaded via dynamic import(), so it's a separate chunk fetched only
// when a flowed quote actually renders (keeps it out of the main bundle). Until
// it loads — and under prefers-reduced-motion, or with no sticker — we render a
// plain paragraph with the sticker floated (the browser's rectangular wrap).
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ANNOTATION_HEX } from './ui.jsx'

// usePrefersReducedMotion — flowed layout is a motion/enhancement; respect the
// OS setting and fall back to plain text when it's on.
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

// widthAt returns the text width free at a line whose top is `top`, given a
// circle (top-right sticker). Text runs from the left, so it must stop before
// the circle's left edge at that line's nearest vertical band, minus a gap.
function widthAt(top, lh, W, c, gap) {
  const bandTop = top
  const bandBottom = top + lh
  let dy = 0
  if (c.cy < bandTop) dy = bandTop - c.cy
  else if (c.cy > bandBottom) dy = c.cy - bandBottom
  if (dy >= c.r) return W // this line clears the sticker entirely
  const half = Math.sqrt(c.r * c.r - dy * dy)
  return c.cx - half - gap
}

function computeLines(mod, text, font, lh, W, circle, gap) {
  const prepared = mod.prepareWithSegments(text, font)
  let cursor = { segmentIndex: 0, graphemeIndex: 0 }
  const lines = []
  let y = 0
  for (let guard = 0; guard < 600; guard++) {
    const w = Math.max(40, widthAt(y, lh, W, circle, gap))
    const line = mod.layoutNextLine(prepared, cursor, w)
    if (!line) break
    // No-progress guard: if a too-narrow line can't advance the cursor, stop
    // rather than spin forever.
    if (line.end.segmentIndex === cursor.segmentIndex && line.end.graphemeIndex === cursor.graphemeIndex) break
    lines.push({ text: line.text, w })
    cursor = line.end
    y += lh
  }
  return lines
}

// StickerTag — a round wax-seal sticker carrying the tag name, tinted by the
// tag's colour. Sits in the quote's top-right corner; the text flows around it.
export function StickerTag({ name, color = 'yellow' }) {
  return (
    <span className="sticker-seal" style={{ '--seal': ANNOTATION_HEX[color] || color }} aria-hidden="true">
      <span className="sticker-seal-label">{name}</span>
    </span>
  )
}

// FlowQuote flows `text` around a round sticker. `sticker` is the node to pin;
// `stickerKey` is a stable identity for the layout effect (the node itself
// changes each render). `quoteStyle` sets the font the text is measured/painted
// in. radius is the sticker radius in px.
export function FlowQuote({ text, sticker, stickerKey = '', quoteStyle, radius = 42, gap = 12, className = '' }) {
  const ref = useRef(null)
  const [state, setState] = useState(null) // { lines, lh, r } | null (=> fallback)
  const reduce = usePrefersReducedMotion()
  const hasSticker = !!sticker

  useLayoutEffect(() => {
    const el = ref.current
    if (!el || reduce || !hasSticker || !text) {
      setState(null)
      return
    }
    let cancelled = false
    let mod = null
    let ro = null
    async function relayout() {
      if (!mod) mod = await import('@chenglou/pretext')
      if (cancelled) return
      const W = el.clientWidth
      if (!W) return
      const r = Math.min(radius, Math.floor(W / 3)) // never eat more than a third
      const circle = { cx: W - r, cy: r, r }
      const { font, lh } = fontOf(el)
      const lines = computeLines(mod, text, font, lh, W, circle, gap)
      if (!cancelled) setState({ lines, lh, r })
    }
    relayout().catch(() => { if (!cancelled) setState(null) }) // any failure → plain fallback
    ro = new ResizeObserver(() => { relayout().catch(() => {}) })
    ro.observe(el)
    // Web fonts change metrics — re-flow once they're ready.
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (!cancelled) relayout().catch(() => {}) })
    return () => { cancelled = true; if (ro) ro.disconnect() }
  }, [text, stickerKey, hasSticker, reduce, radius, gap])

  const size = state ? state.r * 2 : radius * 2
  return (
    <div ref={ref} className={`flow ${className}`} style={{ position: 'relative', ...quoteStyle }}>
      {state ? (
        <>
          <span className="flow-sticker" style={{ position: 'absolute', top: 0, right: 0, width: size, height: size }}>
            {sticker}
          </span>
          <div style={{ height: state.lines.length * state.lh }}>
            {state.lines.map((ln, i) => (
              <div key={i} className="flow-line" style={{ width: Math.max(0, ln.w), height: state.lh, lineHeight: `${state.lh}px` }}>
                {ln.text || ' '}
              </div>
            ))}
          </div>
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
