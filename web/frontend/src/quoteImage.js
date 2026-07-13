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
  return { quote, attribution, meta, tags, note, colorHex: colorHex || null }
}

// Line heights + tag metrics, shared by the measure and draw phases.
const QLH = 38, ALH = 23, MLH = 19, NLH = 28
const TAG_H = 24, TAG_PADX = 10, TAG_GAP = 7
const FOOTER_H = 34 // hairline + wordmark block

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

  if (model.quote) {
    const lines = flowRuns(ctx, [{ text: `“${model.quote}”`, font: FONTS.quote }], innerW)
    push({ kind: 'text', lines, lh: QLH, color: theme.ink, gap: 0, height: lines.length * QLH })
  }
  if (model.attribution.length) {
    const runs = []
    model.attribution.forEach((p, i) => {
      runs.push({ text: i === 0 ? '— ' : ', ', font: FONTS.attrPlain })
      const font = p.emphasis === 'bold' ? FONTS.attrBold : p.emphasis === 'italic' ? FONTS.attrItalic : FONTS.attrPlain
      runs.push({ text: p.text, font })
    })
    const lines = flowRuns(ctx, runs, innerW)
    push({ kind: 'text', lines, lh: ALH, color: theme.soft, gap: 14, height: lines.length * ALH })
  }
  const metaText = model.meta.join('  ·  ').toUpperCase()
  if (metaText) {
    ctx.letterSpacing = '1px'
    const lines = flowRuns(ctx, [{ text: metaText, font: FONTS.meta }], innerW)
    ctx.letterSpacing = '0px'
    push({ kind: 'text', lines, lh: MLH, color: film ? theme.amber : theme.soft, ls: '1px', gap: 6, height: lines.length * MLH })
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

  // colour edge (book annotation colour)
  if (hasBar) {
    ctx.fillStyle = model.colorHex
    roundRectPath(ctx, cardX + CP - 2, M + sprocket + CP, 6, cardH - sprocket * 2 - CP * 2, 3)
    ctx.fill()
  }

  // walk the blocks
  let top = M + sprocket + CP
  blocks.forEach((b, i) => {
    if (i) top += b.gap
    if (b.kind === 'text') {
      drawTextBlock(ctx, b.lines, innerX, top, b.lh, b.color, b.ls)
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
