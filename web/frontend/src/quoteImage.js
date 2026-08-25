import { fontChoice } from './fonts.js'
import { t } from './i18n.js'

// Quote-card images (ROADMAP §10). Render a highlight as a shareable PNG,
// styled in the current light/dark palette, entirely in the browser — no server, no
// library. A <canvas> is drawn by hand (the 2D API) so the output is a clean
// raster with no tainted-canvas or CSP concerns (everything is drawn locally;
// no external images are loaded). The same field-picking the text formats use
// drives what appears, so the image is just another "format" in the share sheet.

const DPR = 2 // draw at 2× for crisp text on any display
const W = 640 // logical card width (px); height is computed from the content

// The faces this card draws with, built from the reader's own type settings.
//
// THIS IS THE SECOND CONSUMER OF THE TYPE PREFERENCES, and the easiest one to
// forget: canvas cannot read a CSS custom property, so a font swap that only
// rewrote the stylesheet would leave every share image in the old type — the
// same class of bug as a filter that changes one screen. `fontChoice` is the
// same resolver Settings and the stylesheet use.
//
// WHAT FOLLOWS THE PREFERENCE IS THE FAMILY, not the weights and italics. The
// card is a drawn composition: its quote is italic and its footer is 600 because
// the card is designed that way, not because the display ROLE is. Applying "all
// caps" from Settings to a share image would restyle a picture somebody is about
// to send to somebody else.
//
// The Indic faces sit inside each stack after the Latin one, exactly as they do
// in index.css — canvas resolves a font list the same way CSS does, so a Bengali
// quote draws in the Bengali face rather than in a system fallback.
let FONTS = buildFonts()

function buildFonts() {
  const fam = (role) => fontChoice(role).family
  const disp = fam('display')
  const mono = fam('mono')
  const hand = fam('hand')
  const bn = fam('bengali')
  const dv = fam('devanagari')
  const serif = `"${disp}", "${bn}", "${dv}", Georgia, serif`
  const code = `"${mono}", ui-monospace, monospace`
  return {
    quote: `italic 400 27px ${serif}`,
    // The translation: the quote's face, upright and two sizes down. Upright
    // because the italic is what marks the ORIGINAL as the quotation, and two
    // lines of italic in a row stop distinguishing anything. The Bengali and
    // Devanagari families are in `serif` already, so a Bengali proverb and its
    // English translation are set by the same stack in either direction — which
    // is the whole point of a translation pair rendering as one card.
    translation: `400 21px ${serif}`,
    attrBold: `600 15px ${serif}`,
    attrItalic: `italic 400 15px ${serif}`,
    attrPlain: `400 15px ${serif}`,
    meta: `500 11.5px ${code}`,
    note: `400 22px "${hand}", "${bn}", "${dv}", cursive`,
    tag: `600 11px ${code}`,
    foot: `600 14px ${serif}`,
    credit: `500 11px ${code}`,
    bengali: `400 12px "${bn}", serif`,
  }
}

// ensureFonts resolves once the faces used by the card are loaded, so the first
// paint isn't a fallback serif. Best-effort: never rejects (a blocked load just
// falls back visually), and returns immediately where the Font Loading API is
// missing.
export function ensureFonts() {
  if (typeof document === 'undefined' || !document.fonts || !document.fonts.load) {
    return Promise.resolve()
  }
  // Rebuilt HERE, on every call, because this is the one thing every draw
  // awaits — so a face changed in Settings is in the next image without the
  // module having to be told about it.
  FONTS = buildFonts()
  const fam = (role) => fontChoice(role).family
  const faces = [
    `italic 27px "${fam('display')}"`, `600 15px "${fam('display')}"`,
    `italic 15px "${fam('display')}"`, `600 14px "${fam('display')}"`,
    `500 12px "${fam('mono')}"`, `600 11px "${fam('mono')}"`, `500 11px "${fam('mono')}"`,
    `22px "${fam('hand')}"`, `12px "${fam('bengali')}"`, `12px "${fam('devanagari')}"`,
  ]
  return Promise.all(faces.map((f) => document.fonts.load(f).catch(() => {}))).then(() => {})
}

// readTheme snapshots the canvas-safe colours off <html> (theme.js writes them
// as inline custom properties). --accent is the raw hex (unlike --accent-ui,
// which theme.js may set to a color-mix() that canvas can't parse).
export function readTheme() {
  const root = typeof document !== 'undefined' ? document.documentElement : null
  const cs = root ? getComputedStyle(root) : null
  const v = (name, fallback) => {
    const raw = cs ? cs.getPropertyValue(name).trim() : ''
    return raw || fallback
  }
  return {
    dark: root ? root.dataset.theme === 'dark' : false,
    materialSet: root ? root.dataset.matSet || '' : '',
    bg: v('--bg', '#F4EDDE'),
    cardTop: v('--card-top', '#FFFFFC'),
    cardBottom: v('--card-bottom', '#FCF8ED'),
    ink: v('--ink', '#221C16'),
    soft: v('--soft', '#6A5F50'),
    faint: v('--faint', '#8A7C68'),
    line: v('--line', '#E4DAC7'),
    amber: v('--amber', '#BE8A4E'),
    accent: v('--accent', '#B4482D'),
    inkBorder: v('--ink-border', 'rgba(41,38,29,.6)'),
  }
}

// hexToRgba turns an #RRGGBB (or #RGB) hex into an rgba() string canvas accepts.
// Exported for testing (test/pure/quote-image.test.js); nothing outside this
// module uses it.
export function hexToRgba(hex, a) {
  let h = String(hex).trim().replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  const n = parseInt(h, 16)
  if (Number.isNaN(n) || h.length !== 6) return `rgba(180,72,45,${a})`
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

function roundRectPath(ctx, x, y, w, h, r) {
  const rad = Math.max(0, Math.min(r, w / 2, h / 2))
  ctx.beginPath()
  ctx.moveTo(x + rad, y)
  ctx.arcTo(x + w, y, x + w, y + h, rad)
  ctx.arcTo(x + w, y + h, x, y + h, rad)
  ctx.arcTo(x, y + h, x, y, rad)
  ctx.arcTo(x, y, x + w, y, rad)
  ctx.closePath()
}

// ---- the mark ---------------------------------------------------------------
//
// The app's own logo, DRAWN rather than loaded. public/mark.svg is same-origin
// and an <img> would not taint the canvas, but it would make the one part of the
// card that says where the picture came from the one part that needs a network
// round-trip to be correct. The portraits can afford that — they arrive and the
// card redraws — and a wordmark cannot: a PNG exported in the first half-second
// would be the copy that goes out, with the brand missing from it.
//
// So it is geometry, in the SVG's own 256 viewBox coordinates: the speech bubble
// and its tail, the two ৭-shaped quote glyphs, and the punch-card column down
// the right edge. The gradients, the ink hairline and the displacement filter
// that roughens the real file are all left out — none of them is legible at
// 20px, and each would be a second definition of the logo to keep in step.
const MARK_RED = '#B4482D' // mark.svg
const MARK_RED_DARK = '#D8613D' // mark-dark.svg — lifted so it reads on a dark card
const MARK_CREAM = '#F4EDDE'

// drawMark paints the mark with its INK at (x, y) — not the SVG's canvas, which
// carries ~1.7px of padding at this size and would leave the logo hanging off
// the text column it is supposed to line up with. `size` still scales the 256
// box, so the drawn shape is a little under `size` on both axes.
//
// Deliberately built from the same primitives the rest of this file uses
// (roundRectPath, arc, a stroked line) rather than a Path2D or a transform, so
// it draws on any 2D context the card already draws on.
function drawMark(ctx, x, y, size, dark) {
  const k = size / 256
  const px = (v) => x + (v - 21.43) * k
  const py = (v) => y + (v - 23.37) * k
  ctx.save()
  ctx.fillStyle = dark ? MARK_RED_DARK : MARK_RED
  roundRectPath(ctx, px(21.43), py(23.37), 213.14 * k, 178.04 * k, 44.51 * k)
  ctx.fill()
  // The tail, which is what makes it a speech bubble rather than a rounded
  // rectangle. Drawn as its own triangle overlapping the body, so the two never
  // need a seam painted between them.
  ctx.beginPath()
  ctx.moveTo(px(84), py(190))
  ctx.lineTo(px(128), py(190))
  ctx.lineTo(px(78), py(229))
  ctx.closePath()
  ctx.fill()
  // The two quote glyphs: a bowl with a flick off its shoulder.
  ctx.fillStyle = MARK_CREAM
  ctx.strokeStyle = MARK_CREAM
  ctx.lineWidth = 13 * k
  ctx.lineCap = 'round'
  for (const cx of [72, 152]) {
    ctx.beginPath()
    ctx.arc(px(cx), py(128), 31 * k, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(px(cx + 13), py(104))
    ctx.lineTo(px(cx + 6), py(74))
    ctx.stroke()
  }
  // The punch-card column down the right edge.
  for (const ry of [45.39, 82.72, 120.05, 157.38]) {
    roundRectPath(ctx, px(197.24), py(ry), 22 * k, 22 * k, 6.8 * k)
    ctx.fill()
  }
  ctx.restore()
}

// flowRuns lays a sequence of {text, font} runs onto lines that fit maxWidth,
// keeping each run's font (so bold author + italic title can share a line and
// still wrap). Returns lines, each an array of {text, font, w} segments. Widths
// are measured off ctx.font — unaffected by the canvas transform — so they stay
// valid after the canvas is resized between the measure and draw phases.
// Exported for testing (test/pure/quote-image.test.js): it only ever touches
// ctx.font/ctx.measureText, so it can be driven by a fake ctx with no canvas.
export function flowRuns(ctx, runs, maxWidth) {
  const tokens = []
  for (const run of runs) {
    // Honour explicit newlines as HARD breaks (a quote's own paragraphs / speaker
    // turns): split on \n first, then whitespace-tokenise each segment. A `br`
    // token flushes the current line, so blank lines survive as paragraph gaps.
    const segments = String(run.text).split('\n')
    segments.forEach((segment, si) => {
      if (si > 0) tokens.push({ br: true })
      for (const piece of segment.split(/(\s+)/)) {
        if (piece === '') continue
        tokens.push({ text: piece, font: run.font, space: /^\s+$/.test(piece) })
      }
    })
  }
  const lines = []
  let line = []
  let lineW = 0
  for (const t of tokens) {
    if (t.br) { lines.push(line); line = []; lineW = 0; continue }
    ctx.font = t.font
    const w = ctx.measureText(t.text).width
    if (t.space) {
      if (lineW === 0) continue // no leading space on a fresh line
      line.push({ text: t.text, font: t.font, w })
      lineW += w
      continue
    }
    // A single token wider than the whole line (a long URL, a run-on) is broken
    // by character so it can never bleed past the card edge.
    if (w > maxWidth) {
      if (line.length) { lines.push(line); line = []; lineW = 0 }
      let s = t.text
      while (s.length) {
        let i = 1
        while (i < s.length && ctx.measureText(s.slice(0, i + 1)).width <= maxWidth) i++
        const chunk = s.slice(0, i)
        lines.push([{ text: chunk, font: t.font, w: ctx.measureText(chunk).width }])
        s = s.slice(i)
      }
      continue
    }
    if (lineW > 0 && lineW + w > maxWidth) {
      // drop a trailing space left on the line before wrapping
      while (line.length && line[line.length - 1].space === undefined && /^\s+$/.test(line[line.length - 1].text)) {
        lineW -= line.pop().w
      }
      lines.push(line)
      line = []
      lineW = 0
    }
    line.push({ text: t.text, font: t.font, w })
    lineW += w
  }
  if (line.length) lines.push(line)
  return lines
}

// ---- credit-face portraits ---------------------------------------------
// The author / actor faces drawn on the card mirror the app's overlapping
// face chips (first credited on top). Images are same-origin cover-route URLs
// (see coverImgURL), so drawing them never taints the canvas. They load lazily
// into a module cache; the share panel awaits loadFaceImages() then redraws, so
// the first paint may lack faces and the redraw fills them in without shifting
// the layout — the row's height is reserved whenever there are faces to show.
const faceCache = new Map() // url -> HTMLImageElement | null (null = failed)

// loadFaceImages resolves once every not-yet-cached url has loaded (or failed);
// best-effort and never rejects, so a blocked portrait just leaves a blank disc.
// One tile at a time, cached by URL, and deliberately a separate cache from the
// faces': a face is per-quote and a tile is per-material, so they turn over at
// completely different rates and sharing one map would evict the tile every time a
// different quote was shared.
const tileCache = new Map()

export function loadTileImage(url) {
  if (!url) return Promise.resolve(null)
  if (tileCache.has(url)) return Promise.resolve(tileCache.get(url))
  return new Promise((res) => {
    const img = new Image()
    img.onload = () => {
      tileCache.set(url, img)
      res(img)
    }
    img.onerror = () => {
      // A missing tile draws the card flat rather than not at all. The texture is
      // the least load-bearing thing on a quote card.
      tileCache.set(url, null)
      res(null)
    }
    img.src = url
  })
}

export function tileImage(url) {
  return url ? tileCache.get(url) || null : null
}

export function loadFaceImages(urls) {
  const missing = (urls || []).filter((u) => u && !faceCache.has(u))
  if (!missing.length) return Promise.resolve()
  return Promise.all(
    missing.map(
      (u) =>
        new Promise((res) => {
          const img = new Image()
          img.onload = () => {
            faceCache.set(u, img)
            res()
          }
          img.onerror = () => {
            faceCache.set(u, null)
            res()
          }
          img.src = u
        }),
    ),
  ).then(() => {})
}

// drawImageCover paints img into the dx,dy,dw,dh box with object-fit: cover
// (centre-cropped to fill), used inside a circular clip for each face.
function drawImageCover(ctx, img, dx, dy, dw, dh) {
  const ir = img.width / img.height
  const r = dw / dh
  let sw, sh, sx, sy
  if (ir > r) {
    sh = img.height
    sw = sh * r
    sx = (img.width - sw) / 2
    sy = 0
  } else {
    sw = img.width
    sh = sw / r
    sx = 0
    sy = (img.height - sh) / 2
  }
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh)
}

// ---- the portrait backdrop --------------------------------------------------
//
// The person whose words these are, bled in from the card's edge and faded out
// before the text starts. One credited name enters from the LEFT; two, and they
// take a side each with the words between them — which is the shape a
// conversation has, and the reason the second face goes right rather than beside
// the first. THREE OR MORE line up along the bottom instead (LINEUP_MAX below):
// a card has two edges, and the third person was being dropped.
//
// `model.swap` reverses the order, which is the reader's answer to "that is the
// wrong way round" — and there is no way for the card to know which way round is
// right, because it depends on the line.
//
// PORTRAIT_ALPHA is where legibility is decided, so it is a constant with a name
// rather than a number inside the gradient. At the outer edge the image is at
// this alpha; by PORTRAIT_FADE of its own width it is gone. The fade is applied
// as a real alpha mask (destination-out on an offscreen canvas) rather than by
// painting the card colour over the top — the card's face is a vertical
// gradient, so a flat overlay would leave a seam exactly where the fade ends,
// which is the one place a viewer is already looking.
const PORTRAIT_W = 0.46 // share of the card width one portrait may occupy
const PORTRAIT_ALPHA = 0.62 // strength at the outer edge
const PORTRAIT_FADE = 0.86 // fraction of the portrait's width the fade spans
const PORTRAIT_TINT = 0.55 // how far the quote's colour pulls the portrait's hue

// ---- more than two people ---------------------------------------------------
//
// A card has two edges, so the side-bleed layout has room for exactly two faces
// and silently dropped the third. Three or more is a real case — a scene between
// four characters, a panel, a band — and the answer is not a third edge: it is the
// team photograph. The faces line up along the BOTTOM of the card, one cell each,
// fading upward into the paper, and the words go on sitting where they sat.
//
// It is not an option the reader picks. "Backdrop" is already the answer to "how
// should these people appear"; how many of them there are is a fact about the
// quote, not a second question, and a control offering a two-sided layout for
// five faces would be offering a worse picture on purpose.
// The SAME cap the credit chips use (FACE_MAX below), rather than a number of its
// own. The two draw the same people two ways, so a picture that showed fewer of
// them than the chips would is the third-face bug again one layer up — and any
// number here is arbitrary, so it may as well be the one already chosen.
const LINEUP_MAX = 5
const LINEUP_H = 0.52 // share of the card height the band occupies

// ---- the halo under the words ----------------------------------------------
//
// A photograph is not a background colour. It has its own lights and darks, and
// the same ink that reads cleanly on paper vanishes into a shoulder or an eye —
// not all of it, which would at least be obvious, but a word here and a word
// there, which is worse in the one place the whole app is about reading a line
// exactly as it was written.
//
// So every word on a backdrop card carries a halo of the card's own surface
// colour: the type gets back, locally, the paper it was designed for. It is set
// as a shadow with NO OFFSET, which makes it a glow around each letter rather
// than a drop shadow beneath it — an offset shadow says "this text is floating
// above a picture", and the text is meant to be ON the card, not over it.
//
// The card colour is the right halo in both modes without a branch: in light
// mode dark ink gets a pale surround, in dark mode pale ink gets a dark one.
// Which is also why it is drawn only where there IS an image — on a plain card
// the paper is already exactly this colour, so it would cost a blur pass per
// line to composite something invisible.
const HALO_BLUR = 8
const HALO_ALPHA = 0.85

// setHalo turns the glow on or off for everything painted after it. Explicit
// both ways rather than leaning on save/restore: the halo has to be OFF for the
// rest of the card, and "off" being a thing this function says out loud is what
// lets a test ask when it was on.
function setHalo(ctx, theme, on) {
  ctx.shadowColor = on ? hexToRgba(theme.cardTop, HALO_ALPHA) : 'rgba(0,0,0,0)'
  ctx.shadowBlur = on ? HALO_BLUR : 0
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 0
}

// fadedPortrait renders one image into an offscreen canvas of (w × h), cropped
// to fill, optionally tinted, and erases it towards `dir` ('right' fades out
// rightwards, 'up' fades out upwards for the bottom line-up). Returns null when
// the image has not loaded — a missing portrait
// must draw NOTHING rather than a grey block, because the caller redraws when it
// arrives and a placeholder would flash on every share.
//
// ORDER MATTERS, twice. The tint goes on while the buffer is still fully
// opaque, so it colours the photo rather than the shape the fade will leave
// behind; and the mask goes on last, so the tint fades out with the face
// instead of surviving as a coloured rectangle after it.
function fadedPortrait(img, w, h, dir, tint) {
  if (!img || !w || !h) return null
  const off = document.createElement('canvas')
  off.width = Math.ceil(w)
  off.height = Math.ceil(h)
  const octx = off.getContext('2d')
  if (!octx) return null
  drawImageCover(octx, img, 0, 0, off.width, off.height)

  // The quote's own colour, carried into the portrait. `color` is the blend
  // that keeps the destination's LUMA and takes the source's hue — a duotone,
  // so the face stays a face — and it is a CSS blend mode rather than a
  // Porter-Duff operator, which not every canvas implements. Setting an
  // unsupported value is silently ignored, so this reads the property back
  // instead of hoping: without the check the fall-through is `source-over`,
  // which paints a flat slab of colour over the person.
  if (tint) {
    octx.globalCompositeOperation = 'color'
    const duotone = octx.globalCompositeOperation === 'color'
    if (!duotone) octx.globalCompositeOperation = 'source-atop'
    octx.globalAlpha = duotone ? PORTRAIT_TINT : PORTRAIT_TINT * 0.6
    octx.fillStyle = tint
    octx.fillRect(0, 0, off.width, off.height)
    octx.globalAlpha = 1
  }

  // destination-out with a gradient of alphas: an opaque stop erases what is
  // under it, a transparent one keeps it. The gradient runs from the card's
  // OUTER edge inwards, so the stops read in the direction the fade travels
  // whichever side the portrait is on.
  const g = dir === 'up'
    // Vertical, from the card's BOTTOM edge upwards — the same statement one axis
    // over, which is why it is a third value here rather than a second function.
    ? octx.createLinearGradient(0, off.height, 0, 0)
    : dir === 'right'
      ? octx.createLinearGradient(0, 0, off.width, 0)
      : octx.createLinearGradient(off.width, 0, 0, 0)
  g.addColorStop(0, 'rgba(0,0,0,0)')
  g.addColorStop(1 - PORTRAIT_FADE, 'rgba(0,0,0,0)')
  g.addColorStop(0.62, 'rgba(0,0,0,0.72)')
  g.addColorStop(1, 'rgba(0,0,0,1)')
  octx.globalCompositeOperation = 'destination-out'
  octx.fillStyle = g
  octx.fillRect(0, 0, off.width, off.height)
  return off
}

// buildModel turns the share payload + the chosen fields into the drawable
// blocks — mirroring buildShareText's selection so the image shows exactly what
// the text formats would.
//
// `colorHex` is the quote's highlight colour, and passing null is how the image
// says "no colour" — the caller decides, because the colour is an option on the
// image rather than a property of the quote. It reaches the card two ways and
// only ever one at a time: as the edge stripe beside the words on a plain card,
// or as the hue of the portrait on a backdrop card. See hasBar.
export function buildModel(share, selected, colorHex) {
  const quote = selected.quote && share.quote ? share.quote : ''
  const translation = selected.translation && share.translation ? share.translation : ''
  const attribution = (share.attribution || [])
    .filter((a) => selected[a.id] && a.value)
    .map((a) => ({ text: a.value, emphasis: a.emphasis }))
  const meta = (share.meta || [])
    .filter((m) => selected[m.id] && m.value)
    // `phrase` is the whole clause with a {value} hole — see share.jsx, where the
    // "played by …" credit stopped being a prefix glued onto a name.
    .map((m) => (m.phrase ? t(m.phrase, { value: m.value }) : m.value))
  const tags = selected.tags && share.tags ? share.tags : []
  const note = selected.note && share.note ? share.note : ''
  // Credit faces (author / actor portraits) ride with their credit toggle:
  // `facesFor` names the field ('author' | 'actor') whose checkbox gates them,
  // so unchecking Author/Actor drops the faces too. Each face is {name, url}.
  const showFaces = !share.facesFor || selected[share.facesFor]
  const faces = showFaces ? share.faces || [] : []
  // facesFor names the credit the faces hang inline beside: 'author' → the
  // attribution line (— Author, Title), 'actor' → the meta line (played by …).
  //
  // `portrait` asks for the same people again as a backdrop — see drawPortraits.
  // It rides the same `faces` array rather than a second source, so unchecking
  // the credit drops the backdrop with the discs. There is no portrait without
  // an attribution.
  return {
    quote, translation, attribution, meta, tags, note, faces,
    facesFor: share.facesFor || null,
    // WHICH SIDE THE FIRST PERSON TAKES. The first credited name has always
    // entered from the left, which is right until the picture is of a
    // conversation and the reader knows which way round it should read. One flag
    // rather than a per-face side: two sides and an order is one bit.
    //
    // It rides `faces` like `portrait` does, so it is meaningless — and false —
    // when there is nobody to swap.
    swap: !!share.swap && faces.length > 0,
    colorHex: colorHex || null,
    portrait: !!share.portrait && faces.length > 0,
  }
}

// Line heights + tag metrics, shared by the measure and draw phases.
const QLH = 38, ALH = 23, MLH = 19, NLH = 28
// The translation's line height. Between the quote's and the attribution's,
// because it is the quote said again rather than a credit about it.
const TLH = 28
const TAG_H = 24, TAG_PADX = 10, TAG_GAP = 7
const FOOTER_H = 34 // hairline + the mark/credit block
const MARK_SIZE = 20 // the logo's box in the footer
// The share of that box the drawn logo actually occupies vertically: the mark's
// ink runs from y=23.37 to y=229.3 of the SVG's 256 grid, and the rest is the
// file's own padding. Named because the footer LINES THE MARK UP against text and
// cannot do that against a box that is 20% air.
const MARK_INK = (229.3 - 23.37) / 256
// The cap height of FONTS.foot, as a share of its 14px. Newsreader's capitals
// reach about 0.7em, and the credit line is centred on that band rather than on
// the em box — an em box includes the descender space, so centring against it
// pushes anything beside the words visibly high.
const FOOT_CAP = 14 * 0.7
const FACE_SIZE = 34, FACE_MAX = 5 // credit portraits: disc size + how many fit

// facesOnAttribution says WHICH LINE a credit's portraits hang beside: the
// attribution ("— (o) Bose, Burma Radio broadcast") or the meta line
// ("Rick Blaine · played by (o) Humphrey Bogart").
//
// It is a named function rather than a condition inside the draw call because
// the draw call used to ask `facesFor !== 'actor'`, so any new credit kind
// landed on the attribution line by falling through a negative test. That was
// right for a standalone quote's speaker by luck, and would have been silently
// wrong for the next one. A credit is on the attribution line when it IS the
// attribution: a book's author, a quote's speaker. A film's is its title, so
// the actor hangs off the meta line instead.
const ATTRIBUTION_CREDITS = new Set(['author', 'speaker'])

export function facesOnAttribution(facesFor) {
  return ATTRIBUTION_CREDITS.has(facesFor || 'author')
}

// drawTextBlock paints wrapped `lines` inside a box whose top is `top`, seating
// each baseline within its line-height so text stays inside the block's height.
function drawTextBlock(ctx, lines, x, top, lh, color, letterSpacing) {
  if (letterSpacing) ctx.letterSpacing = letterSpacing
  ctx.fillStyle = color
  ctx.textBaseline = 'alphabetic'
  lines.forEach((line, i) => {
    let cx = x
    const baseline = top + lh * i + lh * 0.76
    for (const seg of line) {
      ctx.font = seg.font
      ctx.fillText(seg.text, cx, baseline)
      cx += seg.w
    }
  })
  if (letterSpacing) ctx.letterSpacing = '0px'
}

// drawQuoteCard renders `model` onto `canvas` in the given `theme`. Two phases:
// wrap + measure into an ordered block list to find the height, resize the
// canvas (which clears it), then walk the same list to paint — so the measured
// height and the drawn layout can't drift. Read the result via toBlob/toDataURL.
export function drawQuoteCard(canvas, model, theme) {
  const ctx = canvas.getContext('2d')
  // THERE IS NO FILM VARIANT ANY MORE, and this is the one place that loses drawing
  // rather than gaining tokens. The sprocket rows, the amber border and the tighter
  // corner were film the AESTHETIC — a whole alternative look — and 3.0.0 replaces
  // two aesthetics with seven material sets on one palette per mode. Drawing seven
  // sets on a canvas would mean loading a tile, building a pattern and compositing
  // an overlay pass per export, asynchronously, inside a synchronous draw; that is a
  // feature, not a port. So the picture follows the mode, which is what the picker
  // now offers, and the Film assembly set shows in the app rather than in the export.
  const M = 22 // outer mat around the card
  const CP = 34 // padding inside the card
  const cardX = M
  const cardW = W - M * 2
  // The colour edge and the portrait tint are the SAME statement made two ways,
  // so a card never makes it twice: with a backdrop the quote's colour is the
  // hue of the portrait, and a stripe beside it would be a second, louder copy
  // of a thing already said across half the card.
  const hasBar = !!model.colorHex && !model.portrait
  const innerX = cardX + CP + (hasBar ? 8 : 0)
  const innerW = cardW - CP * 2 - (hasBar ? 8 : 0)

  // ---- measure phase: build an ordered list of blocks ----
  const blocks = []
  const push = (b) => { if (b.height > 0) blocks.push(b) }

  let quoteH = 0 // the quote block's height — the colour edge spans only this
  if (model.quote) {
    const lines = flowRuns(ctx, [{ text: `“${model.quote}”`, font: FONTS.quote }], innerW)
    quoteH = lines.length * QLH
    push({ kind: 'text', lines, lh: QLH, color: theme.ink, gap: 0, height: quoteH })
  }
  // The translation, in the quote's own voice one size down: the same words in
  // another language are still the quote, so they are set as prose rather than
  // dropped into the mono meta strip. Unquoted, because the quotation marks
  // upstairs already opened and closed — a second pair reads as a second quote.
  //
  // ABOVE THE CREDIT AND BELOW THE QUOTE, which is where the proverb card puts
  // it, so the image and the card cannot disagree about what a proverb is.
  if (model.translation) {
    const lines = flowRuns(ctx, [{ text: model.translation, font: FONTS.translation }], innerW)
    push({ kind: 'text', lines, lh: TLH, color: theme.soft, gap: 12, height: lines.length * TLH })
  }
  // Credit faces hang inline to the LEFT of the name they belong to (the
  // attribution line for an author, the meta line for an actor): the block that
  // carries them indents its text past the overlapping disc cluster and grows to
  // at least the disc height, so the faces sit on the same line as the name.
  // No discs under a backdrop. The disc exists to put a face beside a name when
  // there is no other face on the card; with the portrait behind the words there
  // is one already, and a 34px crop of the same photograph next to a full-height
  // version of it reads as a mistake rather than as identification. The layout
  // reclaims the space too — the attribution line stops indenting past a cluster
  // that is not there.
  // THE CHIPS SWAP TOO, and this is the layout the request actually names. They
  // are an overlapping cluster drawn so the FIRST credited face sits on top, so
  // "swap" here means the same thing it means everywhere else — the other one
  // leads — rather than a side, which a cluster does not have.
  const faces = !model.portrait && model.faces?.length
    ? (model.swap ? [...model.faces].reverse() : model.faces).slice(0, FACE_MAX)
    : []
  const facesW = faces.length ? FACE_SIZE + (faces.length - 1) * (FACE_SIZE - Math.round(FACE_SIZE * 0.34)) : 0
  const onAttribution = facesOnAttribution(model.facesFor)
  const authorFaces = faces.length && onAttribution ? faces : null
  const actorFaces = faces.length && !onAttribution ? faces : null
  const FACE_GAP = 10
  if (model.attribution.length) {
    const runs = []
    model.attribution.forEach((p, i) => {
      runs.push({ text: i === 0 ? '— ' : ', ', font: FONTS.attrPlain })
      const font = p.emphasis === 'bold' ? FONTS.attrBold : p.emphasis === 'italic' ? FONTS.attrItalic : FONTS.attrPlain
      runs.push({ text: p.text, font })
    })
    // With author faces, the credit reads "— (o) Author, Title": the em-dash is
    // drawn first, the faces sit between it and the name, and the name text is
    // indented past both. Without faces the "— " stays part of the flowed runs.
    let pre = null
    let preW = 0
    let lead = 0
    let runsForFlow = runs
    if (authorFaces) {
      pre = '— '
      ctx.font = FONTS.attrPlain
      preW = ctx.measureText(pre).width
      lead = preW + facesW + FACE_GAP
      runsForFlow = runs.slice(1) // the leading "— " is drawn as `pre` instead
    }
    const lines = flowRuns(ctx, runsForFlow, innerW - lead)
    const textH = lines.length * ALH
    push({ kind: 'text', lines, lh: ALH, color: theme.soft, gap: 14, textH, lead, pre, preFont: FONTS.attrPlain, faceX: preW, leadFaces: authorFaces, height: Math.max(textH, authorFaces ? FACE_SIZE : 0) })
  }
  const metaText = model.meta.join('  ·  ').toUpperCase()
  if (metaText) {
    const lead = actorFaces ? facesW + FACE_GAP : 0
    ctx.letterSpacing = '1px'
    const lines = flowRuns(ctx, [{ text: metaText, font: FONTS.meta }], innerW - lead)
    ctx.letterSpacing = '0px'
    const textH = lines.length * MLH
    push({ kind: 'text', lines, lh: MLH, color: theme.soft, ls: '1px', gap: 6, textH, lead, leadFaces: actorFaces, height: Math.max(textH, lead ? FACE_SIZE : 0) })
  }
  if (model.note) {
    const lines = flowRuns(ctx, [{ text: model.note, font: FONTS.note }], innerW - 12)
    push({ kind: 'note', lines, lh: NLH, color: theme.ink, gap: 20, height: lines.length * NLH })
  }
  if (model.tags.length) {
    const rows = []
    let row = []
    let rowW = 0
    for (const tag of model.tags) {
      ctx.font = FONTS.tag
      const w = ctx.measureText(tag).width + TAG_PADX * 2
      if (row.length && rowW + w > innerW) { rows.push(row); row = []; rowW = 0 }
      row.push({ text: tag, w })
      rowW += w + TAG_GAP
    }
    if (row.length) rows.push(row)
    push({ kind: 'tags', rows, gap: 18, height: rows.length * (TAG_H + TAG_GAP) - TAG_GAP })
  }

  let contentH = 0
  blocks.forEach((b, i) => { contentH += (i ? b.gap : 0) + b.height })
  const cardH = CP * 2 + contentH + 20 + FOOTER_H
  const H = Math.ceil(cardH + M * 2)

  // ---- draw phase ----
  // The drawing buffer is DPR×; the display size is left to CSS (width:100% /
  // height:auto), so the buffer's intrinsic W:H ratio scales the preview to fit
  // while toBlob still exports at full resolution.
  canvas.width = W * DPR
  canvas.height = H * DPR
  ctx.scale(DPR, DPR)

  // mat
  ctx.fillStyle = theme.bg
  ctx.fillRect(0, 0, W, H)

  // card + border
  const grad = ctx.createLinearGradient(0, M, 0, cardH + M)
  grad.addColorStop(0, theme.cardTop)
  grad.addColorStop(1, theme.cardBottom)
  const radius = 14
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.28)'
  ctx.shadowBlur = 26
  ctx.shadowOffsetY = 12
  roundRectPath(ctx, cardX, M, cardW, cardH, radius)
  ctx.fillStyle = grad
  ctx.fill()
  ctx.restore()

  // ---- the material, on the canvas ----------------------------------------
  // THE PICTURE IS MADE OF WHAT THE APP IS MADE OF. This is the CSS operator
  // rebuilt with a pattern: the card colour is already down, then the coarse pass
  // at the material's own strength, then the fine pass composited `overlay` — the
  // same two scales and the same blend index.css uses, because a share that showed
  // a different material from the screen would be the artefact that leaves the app
  // disagreeing with the app.
  //
  // Inside the card's own clip, and BEFORE the border, so the grain stops at the
  // deckle edge and the border stays a crisp line over it rather than under grain.
  //
  // GUARDED ON createPattern, not on a browser check: the test harness stubs a
  // context with only the operations the card actually needs, and a card that
  // silently loses its texture in a headless run is a better failure than one that
  // throws. A tile that has not finished loading is the same case — the picture
  // draws flat and redraws when it arrives.
  const tile = theme.tile && theme.tile.img
  if (tile && typeof ctx.createPattern === 'function') {
    ctx.save()
    roundRectPath(ctx, cardX, M, cardW, cardH, radius)
    ctx.clip()
    for (const [px, blend] of [[theme.tile.coarse, 'source-over'], [theme.tile.fine, 'overlay']]) {
      const pat = ctx.createPattern(tile, 'repeat')
      if (!pat) break
      // The tile is drawn at its CSS background-size, not its pixel size, which is
      // the whole reason the two passes read as one material at two scales.
      const k = px / (tile.width || px)
      if (typeof pat.setTransform === 'function' && typeof DOMMatrix === 'function') {
        pat.setTransform(new DOMMatrix([k, 0, 0, k, 0, 0]))
      }
      ctx.globalAlpha = theme.tile.strength
      ctx.globalCompositeOperation = blend
      ctx.fillStyle = pat
      ctx.fillRect(cardX, M, cardW, cardH)
    }
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
    ctx.restore()
  }

  roundRectPath(ctx, cardX, M, cardW, cardH, radius)
  ctx.lineWidth = 1.5
  ctx.strokeStyle = theme.inkBorder
  ctx.stroke()

  // Portrait backdrop — after the card face and its border, before everything
  // else, so it sits behind the colour edge and every word.
  // Clipped to the card's own rounded path: the image bleeds to the card's edge,
  // not to the mat's.
  // ONE condition, read twice: it decides both that the photograph is painted
  // and that the words get their halo. Two separate tests of the same thing is
  // how a card ends up with a face behind unhaloed text, or a halo glowing on
  // bare paper — neither of which throws.
  const backdrop = !!model.portrait && !!model.faces?.length
  if (backdrop) {
    // REVERSING THE LIST IS RIGHT FOR THE LINE-UP AND WRONG FOR THE SIDES, which
    // is the correction here. `[A].reverse()` is `[A]`, so with ONE face — the
    // plain reading of "change the people chip from left to right" — the reversal
    // was a no-op and the portrait went on entering from the left while the toggle
    // claimed otherwise. The line-up genuinely wants the order reversed; the sides
    // want the SIDE each face is given, which is a different statement.
    const order = model.faces
    ctx.save()
    roundRectPath(ctx, cardX, M, cardW, cardH, radius)
    ctx.clip()
    ctx.globalAlpha = PORTRAIT_ALPHA
    if (order.length > 2) {
      // THE TEAM SHOT. One cell each along the bottom, every face fading upward
      // into the paper. The band is drawn full-bleed to the card's bottom edge
      // and the cells abut, because a gap between two people in a group
      // photograph reads as a missing person.
      // Here the reversal IS the operation: a row of five read right to left.
      const list = (model.swap ? [...order].reverse() : order).slice(0, LINEUP_MAX)
      const bh = Math.round(cardH * LINEUP_H)
      const by = M + cardH - bh
      // Ceil, and the last cell is stretched to the remainder: rounding each cell
      // independently leaves a hairline of card colour between two of them, and
      // that line lands in a different place at every card width.
      const cw = Math.ceil(cardW / list.length)
      list.forEach((face, i) => {
        const x = cardX + i * cw
        const w = i === list.length - 1 ? cardX + cardW - x : cw
        const painted = fadedPortrait(faceCache.get(face.url), w, bh, 'up', model.colorHex)
        if (painted) ctx.drawImage(painted, x, by, w, bh)
      })
    } else {
      const pw = Math.round(cardW * PORTRAIT_W)
      const ph = cardH
      // SIDES is the cap for the two-face layout. A card has two edges, so it
      // holds two entries, and the zip below stops when it runs out — rather than
      // a slice(0, 2) sitting above code that only ever indexed [0] and [1]
      // anyway, which is a cap that cannot be got wrong because it is not doing
      // anything. Three or more took the branch above.
      const SIDES = [
        { fade: 'right', x: cardX },
        { fade: 'left', x: cardX + cardW - pw },
      ]
      SIDES.forEach((side, i) => {
        // Iterated left-then-right whatever happens, so the draw order on the card
        // is stable; `swap` changes WHICH face each side gets. With one face and a
        // swap that leaves the left side empty and puts the portrait on the right,
        // which is the whole of what the control promises.
        const face = model.swap ? order[SIDES.length - 1 - i] : order[i]
        if (!face) return
        const painted = fadedPortrait(faceCache.get(face.url), pw, ph, side.fade, model.colorHex)
        if (painted) ctx.drawImage(painted, side.x, M, pw, ph)
      })
    }
    ctx.restore()
  }

  // colour edge (book annotation colour) — spans the QUOTE only, not the whole
  // card, so the attribution/meta/footer below it sit clear of the bar.
  if (hasBar && quoteH > 0) {
    ctx.fillStyle = model.colorHex
    roundRectPath(ctx, cardX + CP - 2, M + CP, 6, quoteH, 3)
    ctx.fill()
  }

  // drawFaces paints the overlapping portrait cluster with its top-left at
  // (x0, y0): right-to-left so the FIRST credited face lands on top (matching
  // the app's chips), each disc ringed in the surface colour to cut it out of
  // the one beneath, plus a faint ink hairline for definition.
  const drawFaces = (list, x0, y0) => {
    const fs = FACE_SIZE
    const overlap = Math.round(fs * 0.34)
    for (let j = list.length - 1; j >= 0; j--) {
      const x = x0 + j * (fs - overlap)
      const cx = x + fs / 2
      const cy = y0 + fs / 2
      const img = faceCache.get(list[j].url)
      ctx.save()
      ctx.beginPath()
      ctx.arc(cx, cy, fs / 2, 0, Math.PI * 2)
      ctx.closePath()
      ctx.clip()
      if (img) drawImageCover(ctx, img, x, y0, fs, fs)
      else {
        ctx.fillStyle = hexToRgba(theme.ink, 0.08)
        ctx.fillRect(x, y0, fs, fs)
      }
      ctx.restore()
      ctx.beginPath()
      ctx.arc(cx, cy, fs / 2, 0, Math.PI * 2)
      ctx.lineWidth = 3
      ctx.strokeStyle = theme.cardTop
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(cx, cy, fs / 2 - 0.5, 0, Math.PI * 2)
      ctx.lineWidth = 1
      ctx.strokeStyle = hexToRgba(theme.ink, 0.22)
      ctx.stroke()
    }
  }

  // walk the blocks — everything from here to the wordmark sits over whatever
  // the backdrop put down, so it all reads through the same halo. The tag pills
  // included: a translucent accent chip over a photograph is exactly as hard to
  // find as a word is.
  setHalo(ctx, theme, backdrop)
  let top = M + CP
  blocks.forEach((b, i) => {
    if (i) top += b.gap
    if (b.kind === 'text') {
      // A block carrying leadFaces hangs the disc cluster inline and centres its
      // (shorter) text against the disc height, so the name sits on the same line
      // as its face. `pre` (the "— " marker) is drawn first, the faces sit at
      // `faceX` after it, and the name text is indented past both.
      const textTop = top + (b.height - (b.textH ?? b.height)) / 2
      if (b.leadFaces) drawFaces(b.leadFaces, innerX + (b.faceX || 0), top + (b.height - FACE_SIZE) / 2)
      if (b.pre) {
        ctx.font = b.preFont
        ctx.fillStyle = b.color
        ctx.textBaseline = 'alphabetic'
        ctx.fillText(b.pre, innerX, textTop + b.lh * 0.76)
      }
      drawTextBlock(ctx, b.lines, innerX + (b.lead || 0), textTop, b.lh, b.color, b.ls)
    } else if (b.kind === 'note') {
      ctx.fillStyle = theme.accent
      ctx.fillRect(innerX, top + 4, 3, b.lh * 0.62)
      drawTextBlock(ctx, b.lines, innerX + 12, top, b.lh, b.color)
    } else if (b.kind === 'tags') {
      ctx.font = FONTS.tag
      ctx.textBaseline = 'middle'
      b.rows.forEach((row, ri) => {
        const rowTop = top + ri * (TAG_H + TAG_GAP)
        let x = innerX
        for (const pill of row) {
          roundRectPath(ctx, x, rowTop, pill.w, TAG_H, 7)
          ctx.fillStyle = hexToRgba(theme.accent, 0.12)
          ctx.fill()
          ctx.lineWidth = 1
          ctx.strokeStyle = hexToRgba(theme.accent, 0.4)
          ctx.stroke()
          ctx.fillStyle = theme.accent
          ctx.fillText(pill.text, x + TAG_PADX, rowTop + TAG_H / 2 + 1)
          x += pill.w + TAG_GAP
        }
      })
      ctx.textBaseline = 'alphabetic'
    }
    top += b.height
  })

  // The footer: a hairline, then the mark, "made with" and the wordmark, all
  // pinned to the bottom-left of the card.
  //
  // It used to be the word "tippani" and nothing else, which names the app to
  // somebody who already knows it and reads as a signature to everybody else.
  // The mark is what makes it attribution — a picture of a quote is exactly the
  // kind of thing that travels with its source cropped off — and "made with"
  // is what makes it a credit rather than a claim on the words above it, which
  // belong to whoever said them.
  //
  // Bottom-left, one line, in --faint: the same corner and the same volume the
  // wordmark already had. Louder branding on a card somebody is about to post
  // is branding they crop out.
  const footTop = M + cardH - CP - FOOTER_H + 10
  ctx.strokeStyle = hexToRgba(theme.ink, 0.12)
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(innerX, footTop)
  ctx.lineTo(innerX + innerW, footTop)
  ctx.stroke()
  // ONE BASELINE, AND ONE OPTICAL CENTRE. Every word on this line sits on `base`
  // — no per-run nudges, which is what left the two wordmarks and the mark each
  // a pixel or two off the sentence between them. The three faces are different
  // sizes (11px mono, 14px serif, 12px Bengali) and a shared baseline is exactly
  // how mixed sizes are set on one line; lifting one of them by a pixel is how
  // they stop looking like one line.
  //
  // The mark is the exception that proves it: a logo has no baseline, so it is
  // centred on the CAP-HEIGHT BAND of the words instead — the band from
  // base - FOOT_CAP to base. Centring it on the em box or hanging it off the
  // baseline both read as floating.
  const base = footTop + 21
  const markInk = MARK_SIZE * MARK_INK
  drawMark(ctx, innerX, base - FOOT_CAP / 2 - markInk / 2, MARK_SIZE, theme.dark)
  let fx = innerX + MARK_SIZE + 7
  ctx.fillStyle = theme.faint
  ctx.textBaseline = 'alphabetic'
  ctx.font = FONTS.credit
  // The wordmarks below it are the app's name and stay as they are in every
  // language; this is the only word on the footer line that is copy.
  const madeWith = t('share.image.footer.credit.label')
  ctx.fillText(madeWith, fx, base)
  fx += ctx.measureText(madeWith).width + 6
  ctx.font = FONTS.foot
  ctx.fillText('tippani', fx, base)
  fx += ctx.measureText('tippani').width + 8
  ctx.font = FONTS.bengali
  ctx.fillText('টিপ্পনী', fx, base)
  setHalo(ctx, theme, false)
}
