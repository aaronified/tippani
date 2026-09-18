// TRUE GLASS: a pane that BENDS what is behind it, rather than frosting it.
//
// WHY THIS IS OFF BY DEFAULT, AND WHY THAT IS NOT TIMIDITY. A blur plus a white
// wash is frosting; glass refracts, most at the rim and not at all through the
// middle. Doing that honestly means a displacement map per surface, applied as a
// `backdrop-filter` — and a backdrop-filter is re-evaluated whenever anything
// behind it changes, which on a scrolling page is every frame.
//
// THE MEASUREMENT THAT SET THE DEFAULT is already in this repository, in
// `ui.jsx`'s sheet-drag note: a single `blur(10px)` on the sheet scrim blew the
// frame budget on a phone, the browser coalesced and dropped the pointer stream,
// and the drag stopped tracking the finger — reported as "almost impossible,
// extremely flaky". That was ONE blur. What is below is a filter graph of a dozen
// primitives per surface. So it is a control the reader turns on, on a machine
// where it is worth it, and the app is complete without it.
//
// A REST STATE MAY NOT DEPEND ON ANYTHING FIRING, which is the repo's standing
// rule and the reason this module can be as lazy as it is. With the lens off — or
// on but not yet applied, or applied and then failed — every pane is still the
// glass the app has always drawn: a veil, a specular sweep and a blur, from
// `glassProps` in theme.js. Nothing here holds an appearance hostage.
//
// AND IT IS SWITCHED OFF FOR A READER WHO ASKED FOR LESS. `prefers-reduced-motion`
// is about vestibular load, and a lens that warps the page as it scrolls under it
// is exactly that. The preference is not overridden — it is honoured over the
// reader's own toggle, because the toggle was set once and the accessibility
// preference is a standing instruction.

// A MAP CHROMIUM WILL ACTUALLY READ, and the first attempt was not one. Blink
// drops any `backdrop-filter` whose chain contains `feImage`, so a canvas normal
// map — the obvious way to do this — bends nothing while the blur in the same
// list still runs. That failure looks exactly like frosting, which is the thing
// this exists to not be.
//
// So the field is built from primitives that survive inside a backdrop: the
// backdrop's own alpha is a solid rectangle over the pane, and blurring it then
// differencing two offset copies gives a SIGNED ramp — zero through the middle,
// swinging hard at each edge — one per axis, packed into R and G.
function filterMarkup({ bevel, scale, spread, gain, blur, clarity }) {
  const sd = Math.max(1.5, bevel / 2).toFixed(2)
  const d = Math.max(1, bevel / 2).toFixed(2)
  const k = (0.5 * gain).toFixed(3)
  const disp = (input, out, sc) =>
    `<feDisplacementMap in="${input}" in2="map" scale="${sc.toFixed(2)}" ` +
    `xChannelSelector="R" yChannelSelector="G"${out ? ` result="${out}"` : ''}/>`
  const chan = (input, out, row) =>
    `<feColorMatrix in="${input}" result="${out}" type="matrix" values="${row}"/>`
  return (
    `<feGaussianBlur in="SourceAlpha" stdDeviation="${sd}" result="a"/>` +
    `<feOffset in="a" dx="-${d}" dy="0" result="axl"/>` +
    `<feOffset in="a" dx="${d}" dy="0" result="axr"/>` +
    `<feComposite in="axl" in2="axr" operator="arithmetic" k1="0" k2="${k}" k3="-${k}" k4="0.5" result="mxRaw"/>` +
    `<feOffset in="a" dx="0" dy="-${d}" result="ayt"/>` +
    `<feOffset in="a" dx="0" dy="${d}" result="ayb"/>` +
    `<feComposite in="ayt" in2="ayb" operator="arithmetic" k1="0" k2="${k}" k3="-${k}" k4="0.5" result="myRaw"/>` +
    chan('mxRaw', 'mx', '0 0 0 1 0  0 0 0 0 0  0 0 0 0 0.5  0 0 0 0 1') +
    chan('myRaw', 'my', '0 0 0 0 0  0 0 0 1 0  0 0 0 0 0.5  0 0 0 0 1') +
    '<feComposite in="mx" in2="my" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="map"/>' +
    (spread
      // Dispersion: the same bend at three slightly different strengths, one per
      // channel, so the rim carries the faint rainbow a real lens has. Only where
      // a rainbow is a hairline — see the cap in `lensFor`.
      ? disp('SourceGraphic', 'dr', scale * (1 + spread)) +
        disp('SourceGraphic', 'dg', scale) +
        disp('SourceGraphic', 'db', scale * (1 - spread)) +
        chan('dr', 'cr', '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0') +
        chan('dg', 'cg', '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0') +
        chan('db', 'cb', '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0') +
        '<feBlend in="cr" in2="cg" mode="screen" result="crg"/>' +
        '<feBlend in="crg" in2="cb" mode="screen" result="crgb"/>'
      : disp('SourceGraphic', 'bent', scale)) +
    // BEND FIRST, THEN BLUR. Displacing after a blur throws the bend away;
    // blurring after it is what makes a warped rim read as thickness. Both live
    // inside the chain so `backdrop-filter` can be a bare url() — Blink drops the
    // reference when it sits in a list beside filter functions, which is the other
    // way this silently becomes frosting.
    `<feGaussianBlur in="${spread ? 'crgb' : 'bent'}" stdDeviation="${(blur / 2).toFixed(2)}" result="soft"/>` +
    // CLARITY IS THE LAST STEP, and it is how much of the backdrop's own colour
    // survives the pane. Real glass is not colour-neutral — it returns what is
    // behind it slightly richer at the rim and slightly washed through the body —
    // and a blur alone flattens that, which is one of the several ways a lens ends
    // up reading as frost. 0 leaves the backdrop exactly as it was; the factory 48
    // lands at the 1.8 this was hardcoded to before the dial reached it.
    `<feColorMatrix in="soft" type="saturate" values="${(1 + clarity / 60).toFixed(2)}"/>`
  )
}

// The host lives on document.body, OUTSIDE React's tree, because React can empty
// a <defs> it owns during reconciliation — and then every inline url(#…) dangles
// and computes to `none`, which is the flat slab, while the code believes it is
// finished.
let defs = null
let seq = 0

function ensureDefs() {
  if (defs && defs.isConnected) return defs
  let svg = document.querySelector('body > svg[data-tp-lens]')
  if (!svg) {
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('data-tp-lens', '')
    svg.setAttribute('aria-hidden', 'true')
    svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none'
    svg.appendChild(document.createElementNS('http://www.w3.org/2000/svg', 'defs'))
    document.body.appendChild(svg)
  }
  defs = svg.querySelector('defs')
  return defs
}

// A CONTROL IS NOT A SLAB, and this is where that is enforced. The rim of a 38px
// key is two pixels wide; give it a panel's displacement and the ground behind it
// turns to rainbow confetti. So the field stays narrow, the strength is capped
// against the SHORT side, and the dispersion runs only on panels.
export function lensFor(el, dials) {
  const host = ensureDefs()
  if (!host) return null
  const rect = el.getBoundingClientRect()
  const w = Math.round(rect.width)
  const h = Math.round(rect.height)
  if (!w || !h) return null
  const kind = el.getAttribute('data-glass')
  const panel = kind === 'bar' || kind === 'dock' || kind === 'rail'
  const soft = kind === 'card'
  const cs = getComputedStyle(el)
  const raw = parseFloat(cs.borderTopLeftRadius) || 0
  const r = Math.max(4, Math.min(raw, Math.min(w, h) / 2))
  const bevel = Math.max(5, Math.min(Math.min(w, h) * 0.32, Math.max(r * 1.2, 14)) * (dials.bevel / 100))
  const cap = Math.min(w, h) * (panel ? 0.5 : soft ? 0.3 : 0.18)
  const scale = Math.min(dials.refract * (panel ? 1 : soft ? 0.6 : 0.45), cap)
  const spread = panel ? 0.05 * (dials.fringe / 100) : 0
  const blur = Math.round((soft ? 38 : panel ? 24 : 16) * (dials.blur / 100))

  const id = 'tp-lens-' + ++seq
  const f = document.createElementNS('http://www.w3.org/2000/svg', 'filter')
  f.setAttribute('id', id)
  f.setAttribute('x', '0')
  f.setAttribute('y', '0')
  f.setAttribute('width', '100%')
  f.setAttribute('height', '100%')
  f.setAttribute('color-interpolation-filters', 'sRGB')
  f.innerHTML = filterMarkup({ bevel, scale, spread, gain: dials.gain / 100, blur, clarity: dials.clarity })
  host.appendChild(f)
  // THE STAMP NAMES EVERY DIAL THE FIELD IS BUILT FROM. `clarity` was missing from
  // it while it was missing from the filter too — so a pane whose only changed dial
  // was clarity would have been skipped as unchanged even once the filter read it.
  return { id, stamp: `${w}:${h}:${dials.refract}:${dials.bevel}:${dials.fringe}:${dials.blur}:${dials.gain}:${dials.clarity}` }
}

// GLASS_DIALS — the five that only mean anything with the lens, and the reason
// they live here rather than beside the four in theme.js. The owner's ruling when
// the cost of the lens was put to them: "build it, minus the glass dials. the
// glass-dials should be built along with the true glass toggle." So they arrive
// with the thing they configure, and a build with the toggle off has no controls
// for a renderer that is not running.
export const GLASS_DIALS = { clarity: 48, refract: 72, bevel: 100, fringe: 100, gain: 100, blur: 210 }

export function glassDialsFor(tweaks = {}) {
  const own = tweaks.glass || {}
  const clamp = (v, d, max) => (typeof v === 'number' && v >= 0 && v <= max ? v : d)
  return {
    clarity: clamp(own.clarity, GLASS_DIALS.clarity, 100),
    refract: clamp(own.refract, GLASS_DIALS.refract, 200),
    bevel: clamp(own.bevel, GLASS_DIALS.bevel, 200),
    fringe: clamp(own.fringe, GLASS_DIALS.fringe, 200),
    gain: clamp(own.gain, GLASS_DIALS.gain, 200),
    blur: clamp(own.blur, GLASS_DIALS.blur, 400),
  }
}

// WHETHER THE LENS RUNS AT ALL, and the reader's toggle is only one of the three
// answers. `prefers-reduced-motion` wins over it: a lens that warps the page as it
// scrolls underneath is vestibular load, and the toggle was set once while the
// accessibility preference is a standing instruction. A browser with no
// `backdrop-filter` gets nothing, because the filter would be a cost with no
// picture.
export function lensAllowed(on) {
  if (!on) return false
  if (typeof window === 'undefined' || !window.matchMedia) return false
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false
  if (!window.CSS || !CSS.supports) return false
  return CSS.supports('backdrop-filter', 'blur(1px)') || CSS.supports('-webkit-backdrop-filter', 'blur(1px)')
}

let observer = null
let scheduled = 0

// dressGlass — measure every glass surface, give it its own lens, and tell it what
// to blur. Idempotent and stamped, so a surface whose size and dials have not
// changed is skipped rather than re-filtered.
export function dressGlass(dials) {
  if (!ensureDefs()) return 0
  let dressed = 0
  for (const el of document.querySelectorAll('[data-glass]:not([data-glass=""])')) {
    const rect = el.getBoundingClientRect()
    if (!rect.width || !rect.height) continue
    const made = lensFor(el, dials)
    if (!made) continue
    // "Dressed" is keyed on the filter NODE existing, never on the string: see
    // the note on `defs` above for how a live-looking id ends up dangling.
    if (el.__tpLensStamp === made.stamp && el.__tpLensId && document.getElementById(el.__tpLensId)) {
      const old = document.getElementById(made.id)
      if (old) old.remove()
      seq -= 1
      continue
    }
    const previous = el.__tpLensId && document.getElementById(el.__tpLensId)
    if (previous) previous.remove()
    el.__tpLensStamp = made.stamp
    el.__tpLensId = made.id
    const value = `url(#${made.id})`
    el.style.backdropFilter = value
    el.style.webkitBackdropFilter = value
    dressed += 1
  }
  return dressed
}

// undressGlass — put every pane back to the stylesheet's own glass and throw the
// filters away. This is what the toggle going off has to do, and it has to be
// complete: a leftover url(#…) whose filter has been removed computes to `none`,
// which is a pane with no blur at all rather than the glass the app ships.
export function undressGlass() {
  for (const el of document.querySelectorAll('[data-glass]:not([data-glass=""])')) {
    if (!el.__tpLensId) continue
    el.style.removeProperty('backdrop-filter')
    el.style.removeProperty('-webkit-backdrop-filter')
    delete el.__tpLensId
    delete el.__tpLensStamp
  }
  if (defs && defs.isConnected) defs.textContent = ''
}

// applyGlass — the one entry point the app calls. Off is the cheap path and does
// no work beyond undressing whatever was there.
export function applyGlass(on, tweaks = {}) {
  if (observer) { observer.disconnect(); observer = null }
  if (scheduled) { cancelAnimationFrame(scheduled); scheduled = 0 }
  if (!lensAllowed(on)) {
    undressGlass()
    document.documentElement.removeAttribute('data-glass-lens')
    return false
  }
  document.documentElement.dataset.glassLens = 'on'
  const dials = glassDialsFor(tweaks)
  const pass = () => { scheduled = 0; dressGlass(dials) }
  // ONE FRAME LATER, NOT NOW. A surface can measure 0×0 at the moment a render
  // finishes, and a lens built against that is a filter for a pane that is not
  // there yet. One rAF is enough for layout; anything beyond that is the
  // forty-try ladder the prototype needed because it had no rest state to fall
  // back to — this one does, so a surface missed on this pass simply keeps the
  // stylesheet's glass until the next resize.
  scheduled = requestAnimationFrame(pass)
  observer = new ResizeObserver(() => {
    if (scheduled) return
    scheduled = requestAnimationFrame(pass)
  })
  observer.observe(document.body)
  return true
}
