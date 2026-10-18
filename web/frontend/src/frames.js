// The frames a picture is shown in, and the arithmetic of putting one picture in
// one of them. No DOM here except `renderFrame`, which is handed its canvas.
//
// TWO FRAMES, because the app draws two shapes (CLAUDE.md, "A face is a circle and
// a work is a rectangle"): a person or a character is a circle, a cover or a poster
// is 2:3. The circle is stored as its SQUARE — CSS clips it to a circle wherever it
// is drawn — so the editor shows the square with the part the circle will cut away
// dimmed, and the picture saved is what every circle in the app will be cut from.
export const FRAMES = {
  face: { ratio: 1, round: true, width: 1000 },
  work: { ratio: 2 / 3, round: false, width: 800 },
  // A board's picture, drawn 3:2 on its tile and in its form (.board-tile-img).
  board: { ratio: 3 / 2, round: false, width: 900 },
}

// The share of the picture a frame of this ratio cannot show when the picture is
// scaled to cover it — the same question characterRows.croppedShare asks, for any
// frame. Two per cent is where it stops being worth opening an editor for.
export const FRAME_SLACK = 0.02

export function lostShare(w, h, ratio) {
  if (!w || !h) return 0
  const r = w / h
  return 1 - Math.min(r, ratio) / Math.max(r, ratio)
}

export function needsFrame(w, h, frame) {
  return lostShare(w, h, FRAMES[frame].ratio) > FRAME_SLACK
}

// A placement is the picture's width as a share of the frame's width (`size`) and
// where its centre sits, as shares of the frame's width and height (`x`, `y`) —
// resolution-free, so the small preview and the full-size save place it alike.
//
// `cover` is the smallest size with no gap in the frame; `contain` the largest with
// the whole picture inside it. Between them the picture floats inside the frame and
// the gap is filled; past `cover` it can only be panned.
export function sizes(iw, ih, ratio) {
  // Frame is 1 wide and 1/ratio tall. The picture at size s is s wide and s*ih/iw tall.
  const coverSize = Math.max(1, (1 / ratio) * (iw / ih))
  const containSize = Math.min(1, (1 / ratio) * (iw / ih))
  return { cover: coverSize, contain: containSize }
}

export function startPlacement(iw, ih, frame) {
  return { size: sizes(iw, ih, FRAMES[frame].ratio).cover, x: 0, y: 0 }
}

// Keep the picture from being dragged off the frame: where it is larger than the
// frame on an axis its edges stay outside the frame's, and where it is smaller its
// edges stay inside. Both are the same distance — half the difference.
export function clampPlacement(p, iw, ih, frame) {
  const { ratio } = FRAMES[frame]
  const { cover, contain } = sizes(iw, ih, ratio)
  const size = Math.min(Math.max(p.size, contain), cover * 4)
  const w = size
  const h = size * ih / iw
  const fh = 1 / ratio
  const lx = Math.abs(w - 1) / 2
  const ly = Math.abs(h - fh) / 2
  return {
    size,
    x: Math.min(Math.max(p.x, -lx), lx),
    y: Math.min(Math.max(p.y, -ly), ly),
  }
}

// The colour of the picture's own edges, for the gap. Two answers because a gap on
// the sides and a gap above and below usually want different colours — a sky over a
// sea — so the sides sample the left and right columns, the ends the top and bottom
// rows. Transparent pixels are not a colour and are skipped; nothing opaque at all
// answers null and the caller picks a neutral.
export function edgeColours(img) {
  const n = 32
  const c = document.createElement('canvas')
  c.width = n
  c.height = n
  const g = c.getContext('2d', { willReadFrequently: true })
  if (!g) return { sides: null, ends: null }
  g.drawImage(img, 0, 0, n, n)
  let data
  try {
    data = g.getImageData(0, 0, n, n).data
  } catch {
    return { sides: null, ends: null }
  }
  const mean = (cells) => {
    let r = 0, gr = 0, b = 0, k = 0
    for (const [x, y] of cells) {
      const i = (y * n + x) * 4
      if (data[i + 3] < 64) continue
      r += data[i]; gr += data[i + 1]; b += data[i + 2]; k++
    }
    return k ? [Math.round(r / k), Math.round(gr / k), Math.round(b / k)] : null
  }
  const sides = []
  const ends = []
  for (let i = 0; i < n; i++) {
    sides.push([0, i], [n - 1, i])
    ends.push([i, 0], [i, n - 1])
  }
  return { sides: mean(sides), ends: mean(ends) }
}

const NEUTRAL = [128, 128, 128]

// Which edge colour fills THIS placement's gap: the sides' when the picture is
// narrower than the frame, the ends' when it is shorter, their mean when both.
export function fillFor(p, iw, ih, frame, edges) {
  const { ratio } = FRAMES[frame]
  const gapX = p.size < 1 - 1e-6
  const gapY = p.size * ih / iw < 1 / ratio - 1e-6
  const pick = gapX && !gapY ? [edges.sides] : gapY && !gapX ? [edges.ends] : [edges.sides, edges.ends]
  const have = pick.filter(Boolean)
  if (!have.length) return NEUTRAL
  return [0, 1, 2].map((i) => Math.round(have.reduce((s, c) => s + c[i], 0) / have.length))
}

// Draw the framed picture at `width` pixels across. The same call makes the preview
// the reader drags and the file that is saved, so what they see is what is stored.
export function renderFrame(canvas, img, p, frame, width, edges) {
  const { ratio } = FRAMES[frame]
  const iw = img.naturalWidth
  const ih = img.naturalHeight
  const w = Math.round(width)
  const h = Math.round(width / ratio)
  canvas.width = w
  canvas.height = h
  const g = canvas.getContext('2d')
  if (!g) return
  const [r, gr, b] = fillFor(p, iw, ih, frame, edges)
  g.fillStyle = `rgb(${r}, ${gr}, ${b})`
  g.fillRect(0, 0, w, h)
  g.imageSmoothingQuality = 'high'
  const dw = p.size * w
  const dh = dw * ih / iw
  g.drawImage(img, w / 2 + p.x * w - dw / 2, h / 2 + p.y * w - dh / 2, dw, dh)
}
