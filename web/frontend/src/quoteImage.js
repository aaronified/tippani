// Quote-card images (ROADMAP §10). Render a highlight as a shareable PNG,
// styled in the current paper/film skin, entirely in the browser — no server, no
// library. A <canvas> is drawn by hand (the 2D API) so the output is a clean
// raster with no tainted-canvas or CSP concerns (everything is drawn locally;
// no external images are loaded). The same field-picking the text formats use
// drives what appears, so the image is just another "format" in the share sheet.

const DPR = 2 // draw at 2× for crisp text on any display
const W = 640 // logical card width (px); height is computed from the content

// The five faces the app already bundles (@fontsource). Named so canvas can ask
// for them; we await document.fonts before drawing so they're not substituted.
const FONTS = {
  quote: 'italic 400 27px "Newsreader", Georgia, serif',
  attrBold: '600 15px "Newsreader", Georgia, serif',
  attrItalic: 'italic 400 15px "Newsreader", Georgia, serif',
  attrPlain: '400 15px "Newsreader", Georgia, serif',
  meta: '500 11.5px "IBM Plex Mono", ui-monospace, monospace',
  note: '400 22px "Caveat", cursive',
  tag: '600 11px "IBM Plex Mono", ui-monospace, monospace',
  foot: '600 14px "Newsreader", Georgia, serif',
  bengali: '400 12px "Noto Serif Bengali", serif',
}

// ensureFonts resolves once the faces used by the card are loaded, so the first
// paint isn't a fallback serif. Best-effort: never rejects (a blocked load just
// falls back visually), and returns immediately where the Font Loading API is
// missing.
export function ensureFonts() {
  if (typeof document === 'undefined' || !document.fonts || !document.fonts.load) {
    return Promise.resolve()
  }
  const faces = [
    'italic 27px "Newsreader"', '600 15px "Newsreader"', 'italic 15px "Newsreader"', '600 14px "Newsreader"',
    '500 12px "IBM Plex Mono"', '600 11px "IBM Plex Mono"',
    '22px "Caveat"', '12px "Noto Serif Bengali"',
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
  const aesthetic = root && root.dataset.aesthetic === 'film' ? 'film' : 'paper'
  return {
    aesthetic,
    dark: root ? root.dataset.theme === 'dark' : false,
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
function hexToRgba(hex, a) {
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

// flowRuns lays a sequence of {text, font} runs onto lines that fit maxWidth,
// keeping each run's font (so bold author + italic title can share a line and
// still wrap). Returns lines, each an array of {text, font, w} segments. Widths
// are measured off ctx.font — unaffected by the canvas transform — so they stay
// valid after the canvas is resized between the measure and draw phases.
function flowRuns(ctx, runs, maxWidth) {
  const tokens = []
  for (const run of runs) {
    for (const piece of String(run.text).split(/(\s+)/)) {
      if (piece === '') continue
      tokens.push({ text: piece, font: run.font, space: /^\s+$/.test(piece) })
    }
  }
  const lines = []
  let line = []
  let lineW = 0
  for (const t of tokens) {
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

// buildModel turns the share payload + the chosen fields into the drawable
// blocks — mirroring buildShareText's selection so the image shows exactly what
// the text formats would. colorHex (books) draws the annotation-colour edge.
export function buildModel(share, selected, colorHex) {
  const quote = selected.quote && share.quote ? share.quote : ''
  const attribution = (share.attribution || [])
    .filter((a) => selected[a.id] && a.value)
    .map((a) => ({ text: a.value, emphasis: a.emphasis }))
  const meta = (share.meta || [])
    .filter((m) => selected[m.id] && m.value)
    .map((m) => (m.prefix || '') + m.value)
  const tags = selected.tags && share.tags ? share.tags : []
  const note = selected.note && share.note ? share.note : ''
  // Credit faces (author / actor portraits) ride with their credit toggle:
  // `facesFor` names the field ('author' | 'actor') whose checkbox gates them,
  // so unchecking Author/Actor drops the faces too. Each face is {name, url}.
  const showFaces = !share.facesFor || selected[share.facesFor]
  const faces = showFaces ? share.faces || [] : []
  // facesFor names the credit the faces hang inline beside: 'author' → the
  // attribution line (— Author, Title), 'actor' → the meta line (played by …).
  return { quote, attribution, meta, tags, note, faces, facesFor: share.facesFor || null, colorHex: colorHex || null }
}

// Line heights + tag metrics, shared by the measure and draw phases.
const QLH = 38, ALH = 23, MLH = 19, NLH = 28
const TAG_H = 24, TAG_PADX = 10, TAG_GAP = 7
const FOOTER_H = 34 // hairline + wordmark block
const FACE_SIZE = 34, FACE_MAX = 5 // credit portraits: disc size + how many fit

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
  const film = theme.aesthetic === 'film'
  const M = 22 // outer mat around the card
  const CP = 34 // padding inside the card
  const cardX = M
  const cardW = W - M * 2
  const hasBar = !!model.colorHex && !film
  const innerX = cardX + CP + (hasBar ? 8 : 0)
  const innerW = cardW - CP * 2 - (hasBar ? 8 : 0)
  const sprocket = film ? 16 : 0 // room for a sprocket row top + bottom

  // ---- measure phase: build an ordered list of blocks ----
  const blocks = []
  const push = (b) => { if (b.height > 0) blocks.push(b) }

  let quoteH = 0 // the quote block's height — the colour edge spans only this
  if (model.quote) {
    const lines = flowRuns(ctx, [{ text: `“${model.quote}”`, font: FONTS.quote }], innerW)
    quoteH = lines.length * QLH
    push({ kind: 'text', lines, lh: QLH, color: theme.ink, gap: 0, height: quoteH })
  }
  // Credit faces hang inline to the LEFT of the name they belong to (the
  // attribution line for an author, the meta line for an actor): the block that
  // carries them indents its text past the overlapping disc cluster and grows to
  // at least the disc height, so the faces sit on the same line as the name.
  const faces = model.faces && model.faces.length ? model.faces.slice(0, FACE_MAX) : []
  const facesW = faces.length ? FACE_SIZE + (faces.length - 1) * (FACE_SIZE - Math.round(FACE_SIZE * 0.34)) : 0
  const authorFaces = faces.length && model.facesFor !== 'actor' ? faces : null
  const actorFaces = faces.length && model.facesFor === 'actor' ? faces : null
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
    push({ kind: 'text', lines, lh: MLH, color: film ? theme.amber : theme.soft, ls: '1px', gap: 6, textH, lead, leadFaces: actorFaces, height: Math.max(textH, lead ? FACE_SIZE : 0) })
  }
  if (model.note) {
    const lines = flowRuns(ctx, [{ text: model.note, font: FONTS.note }], innerW - 12)
    push({ kind: 'note', lines, lh: NLH, color: theme.ink, gap: 20, height: lines.length * NLH })
  }
  if (model.tags.length) {
    const rows = []
    let row = []
    let rowW = 0
    for (const t of model.tags) {
      ctx.font = FONTS.tag
      const w = ctx.measureText(t).width + TAG_PADX * 2
      if (row.length && rowW + w > innerW) { rows.push(row); row = []; rowW = 0 }
      row.push({ text: t, w })
      rowW += w + TAG_GAP
    }
    if (row.length) rows.push(row)
    push({ kind: 'tags', rows, gap: 18, height: rows.length * (TAG_H + TAG_GAP) - TAG_GAP })
  }

  let contentH = 0
  blocks.forEach((b, i) => { contentH += (i ? b.gap : 0) + b.height })
  const cardH = sprocket * 2 + CP * 2 + contentH + 20 + FOOTER_H
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
  const radius = film ? 8 : 14
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.28)'
  ctx.shadowBlur = 26
  ctx.shadowOffsetY = 12
  roundRectPath(ctx, cardX, M, cardW, cardH, radius)
  ctx.fillStyle = grad
  ctx.fill()
  ctx.restore()
  roundRectPath(ctx, cardX, M, cardW, cardH, radius)
  ctx.lineWidth = 1.5
  ctx.strokeStyle = film ? hexToRgba(theme.amber, 0.5) : theme.inkBorder
  ctx.stroke()

  // film sprocket rows (echo the strip)
  if (film) {
    ctx.fillStyle = hexToRgba(theme.ink, 0.14)
    const holeW = 14, holeH = 9, gap = 12
    const count = Math.max(1, Math.floor((cardW - 24) / (holeW + gap)))
    const startX = cardX + (cardW - (count * (holeW + gap) - gap)) / 2
    for (const rowY of [M + 8, M + cardH - 8 - holeH]) {
      for (let i = 0; i < count; i++) {
        roundRectPath(ctx, startX + i * (holeW + gap), rowY, holeW, holeH, 2)
        ctx.fill()
      }
    }
  }

  // colour edge (book annotation colour) — spans the QUOTE only, not the whole
  // card, so the attribution/meta/footer below it sit clear of the bar.
  if (hasBar && quoteH > 0) {
    ctx.fillStyle = model.colorHex
    roundRectPath(ctx, cardX + CP - 2, M + sprocket + CP, 6, quoteH, 3)
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

  // walk the blocks
  let top = M + sprocket + CP
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

  // footer: hairline + wordmark, pinned to the bottom of the card
  const footTop = M + cardH - CP - FOOTER_H + 10
  ctx.strokeStyle = hexToRgba(theme.ink, film ? 0.18 : 0.12)
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(innerX, footTop)
  ctx.lineTo(innerX + innerW, footTop)
  ctx.stroke()
  ctx.fillStyle = theme.faint
  ctx.textBaseline = 'alphabetic'
  ctx.font = FONTS.foot
  ctx.fillText('tippani', innerX, footTop + 20)
  const wm = ctx.measureText('tippani').width
  ctx.font = FONTS.bengali
  ctx.fillText('টিপ্পনী', innerX + wm + 8, footTop + 19)
}
