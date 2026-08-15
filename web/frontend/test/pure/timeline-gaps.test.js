// The long empty stretches in the stats timeline.
//
// The gaps were already the point: the chart draws every empty bucket so that
// 380 BCE and 1600 CE read as two millennia apart rather than as two adjacent
// bars. What it did not do was make them worth the width — a library holding
// Meditations and then a shelf of 2020 paperbacks draws about a hundred and
// eighty identical blank columns, which is not a silence you read but a stretch
// of nothing you scroll past.
//
// So the run folds into one element that keeps EXACTLY the width the columns it
// replaces would have had. That last part is what these tests are mostly about:
// fold it to a fixed band and the chart starts lying about time, which is the
// failure the empty buckets were introduced to prevent.

import { describe, expect, it } from 'vitest'
import {
  bucketTimeline,
  gapLine,
  gapLines,
  gapMarkers,
  makeGapPicker,
  TIMELINE_GAP_BANDS,
  gapWidth,
  TIMELINE_GAP_LINES,
  TIMELINE_GAP_MIN,
  TIMELINE_MARKER_MAX,
  TIMELINE_MARKER_MIN,
  timelineSegments,
} from '../../src/StatsPage.jsx'

// A library with Meditations and then a modern shelf: the case the whole feature
// is for.
const MEDITATIONS = [
  { year: 180, works: 1, quotes: 9 },
  { year: 2019, works: 4, quotes: 30 },
  { year: 2020, works: 6, quotes: 51 },
]

const decades = (rows) => bucketTimeline(rows, 10)
const gaps = (segs) => segs.filter((s) => s.type === 'gap')

describe('folding a run of empty buckets', () => {
  it('leaves a chart with no gaps entirely alone', () => {
    const segs = timelineSegments(decades([{ year: 2019, works: 1, quotes: 2 }, { year: 2020, works: 1, quotes: 3 }]))
    expect(segs.every((s) => s.type === 'bucket')).toBe(true)
    expect(segs).toHaveLength(2)
  })

  it('folds one long run and keeps the buckets either side', () => {
    const segs = timelineSegments(decades(MEDITATIONS))
    expect(segs[0].type).toBe('bucket')
    expect(segs[0].bucket.start).toBe(180)
    expect(segs[1].type).toBe('gap')
    expect(segs[segs.length - 1].type).toBe('bucket')
    expect(gaps(segs)).toHaveLength(1)
  })

  it('stands in for every bucket it swallowed, and says which years', () => {
    const [gap] = gaps(timelineSegments(decades(MEDITATIONS)))
    // 190s through 2010s inclusive: the 2010s bucket holds 2019, so the run ends
    // at the 2000s.
    expect(gap.start).toBe(190)
    expect(gap.end).toBe(2000)
    expect(gap.span).toBe((2000 - 190) / 10 + 1)
  })

  it('does NOT fold a short run — some blanks already read as some blanks', () => {
    // Four empty decades. A caption squeezed into four columns is worse than the
    // four columns.
    const segs = timelineSegments(decades([
      { year: 1970, works: 1, quotes: 1 },
      { year: 2020, works: 1, quotes: 1 },
    ]))
    expect(gaps(segs)).toHaveLength(0)
    expect(segs.filter((s) => s.type === 'bucket')).toHaveLength(6)
  })

  it('folds at exactly the threshold and not one below it', () => {
    const runOf = (n) => {
      const rows = [{ year: 1000, works: 1, quotes: 1 }, { year: 1000 + (n + 1) * 10, works: 1, quotes: 1 }]
      return gaps(timelineSegments(decades(rows)))
    }
    expect(runOf(TIMELINE_GAP_MIN - 1)).toHaveLength(0)
    expect(runOf(TIMELINE_GAP_MIN)).toHaveLength(1)
    expect(runOf(TIMELINE_GAP_MIN)[0].span).toBe(TIMELINE_GAP_MIN)
  })

  it('folds every run, not just the first', () => {
    const segs = timelineSegments(decades([
      { year: 100, works: 1, quotes: 1 },
      { year: 1000, works: 1, quotes: 1 },
      { year: 2020, works: 1, quotes: 1 },
    ]))
    expect(gaps(segs)).toHaveLength(2)
  })

  it('never folds a bucket that holds anything, however little', () => {
    // dotCount rounds up so a decade with one book draws a dot; folding it away
    // would delete a data point rather than a blank.
    const segs = timelineSegments(decades([
      { year: 100, works: 1, quotes: 1 },
      { year: 600, works: 0, quotes: 1 },
      { year: 2020, works: 1, quotes: 1 },
    ]))
    const kept = segs.filter((s) => s.type === 'bucket').map((s) => s.bucket.start)
    expect(kept).toContain(600)
  })

  it('unfolds by itself at a coarser scale, with no rule for it', () => {
    // The same library at centuries: 180 CE to 2020 is nineteen buckets, of which
    // eighteen are empty — still a gap. At a scale where the run drops under the
    // threshold it draws as plain columns again, because where the gaps fall is a
    // property of the data and the scale rather than a stored decision.
    const short = [{ year: 1900, works: 1, quotes: 1 }, { year: 2020, works: 1, quotes: 1 }]
    expect(gaps(timelineSegments(bucketTimeline(short, 10)))).toHaveLength(1)
    expect(gaps(timelineSegments(bucketTimeline(short, 100)))).toHaveLength(0)
  })
})

describe('the gap keeps the width it stands in for', () => {
  it('is as wide as the columns it replaced, to the pixel', () => {
    // THE INVARIANT. Two millennia and two centuries must not draw the same.
    for (const span of [6, 12, 40, 183]) {
      expect(gapWidth(span)).toBe(span * 34 - 4)
    }
  })

  it('is monotonic in the span, so a longer silence is always a wider one', () => {
    const widths = [6, 7, 20, 100, 183].map(gapWidth)
    for (let i = 1; i < widths.length; i++) expect(widths[i]).toBeGreaterThan(widths[i - 1])
  })
})

describe('the year markers inside a gap', () => {
  const gapOf = (span, start = 200) => ({ span, start, end: start + (span - 1) * 10 })

  it('are never closer together than the minimum', () => {
    for (const span of [20, 37, 60, 183, 400]) {
      const marks = gapMarkers(gapOf(span), 10)
      for (let i = 1; i < marks.length; i++) {
        expect(marks[i].offset - marks[i - 1].offset).toBeGreaterThanOrEqual(TIMELINE_MARKER_MIN)
      }
    }
  })

  it('never crowd the gap, however long it is', () => {
    for (const span of [20, 60, 183, 1000]) {
      expect(gapMarkers(gapOf(span), 10).length).toBeLessThanOrEqual(TIMELINE_MARKER_MAX)
    }
  })

  it('stay off both ends, where they would read as the neighbouring column’s label', () => {
    const span = 183
    for (const m of gapMarkers(gapOf(span), 10)) {
      expect(m.offset).toBeGreaterThan(0)
      expect(m.offset).toBeLessThan(span - 1)
    }
  })

  it('carry the real year for their position, at whatever scale', () => {
    const marks = gapMarkers(gapOf(183, 190), 10)
    for (const m of marks) expect(m.start).toBe(190 + m.offset * 10)
    // And at centuries the same offsets mean centuries.
    const cent = gapMarkers({ span: 19, start: 200, end: 2000 }, 100)
    for (const m of cent) expect(m.start).toBe(200 + m.offset * 100)
  })

  it('gives a short gap none at all rather than one crammed in', () => {
    expect(gapMarkers(gapOf(TIMELINE_GAP_MIN), 10)).toEqual([])
    expect(gapMarkers(gapOf(TIMELINE_MARKER_MIN * 2 - 1), 10)).toEqual([])
  })

  it('answers an absent gap with nothing rather than throwing', () => {
    expect(gapMarkers(null, 10)).toEqual([])
  })
})

describe('the line in the gap', () => {
  it('never returns one too long for the space', () => {
    for (const span of [6, 8, 12, 20, 60, 183]) {
      const w = gapWidth(span)
      const line = gapLine({ start: 300, span }, w)
      if (!line) continue
      // Two lines of caption, minus the padding — the same room the picker used.
      expect(line.length * 6.1).toBeLessThanOrEqual((w - 24) * 2)
    }
  })

  it('says nothing at all when nothing fits, rather than clipping a sentence', () => {
    expect(gapLine({ start: 300, span: 6 }, 40)).toBe('')
  })

  it('gives a wide gap more words than a narrow one', () => {
    const narrow = gapLine({ start: 300, span: 8 }, gapWidth(8))
    const wide = gapLine({ start: 300, span: 183 }, gapWidth(183))
    expect(wide.length).toBeGreaterThan(narrow.length)
  })

  it('is stable for a given gap, so re-rendering does not reshuffle the chart', () => {
    const gap = { start: 190, span: 183 }
    const first = gapLine(gap, gapWidth(183))
    for (let i = 0; i < 20; i++) expect(gapLine(gap, gapWidth(183))).toBe(first)
  })

  it('does not say the same thing in every gap on one chart', () => {
    // Three wide gaps printing one sentence three times is worse than three
    // blanks. Seeded off the gap itself, so they differ without being random.
    const w = gapWidth(120)
    const said = new Set([
      gapLine({ start: 190, span: 120 }, w),
      gapLine({ start: 900, span: 120 }, w),
      gapLine({ start: 1400, span: 120 }, w),
    ])
    expect(said.size).toBeGreaterThan(1)
  })

  it('draws from a set sorted by length, so the fit test is a prefix test', () => {
    const lens = TIMELINE_GAP_LINES.map((l) => l.length)
    expect([...lens].sort((a, b) => a - b)).toEqual(lens)
    expect(TIMELINE_GAP_LINES.length).toBeGreaterThanOrEqual(10)
  })

  it('attributes none of them to anybody', () => {
    // An app whose entire subject is quoting people accurately must not be the one
    // place inventing an attribution — and there is no field here to record a real
    // source in even if one existed.
    // An em-dash mid-sentence is punctuation; an em-dash followed by a
    // capitalised name is a byline, and that shape is what is refused.
    for (const l of TIMELINE_GAP_LINES) {
      expect(l).not.toMatch(/[—–-]\s*[A-Z]/)
      expect(l).not.toMatch(/\bby [A-Z]/)
    }
  })
})

// ---- one caption cannot cover an arbitrarily wide gap -----------------------
//
// The gap keeps the true width of the columns it replaces — that is the whole
// reason it is not collapsed to a neat band — so a two-millennium stretch is over
// a thousand pixels of emptiness. A single line there sat as a small island with a
// great deal of nothing either side, which reads as a rendering failure rather
// than as a silence. The copy scales to the width instead.
describe('filling a wide gap with more than one line', () => {
  const gap = (start, span) => ({ start, span, end: start + span - 1 })

  it('gives a narrow gap exactly one line, as before', () => {
    // Under one slot's worth of width, this must behave identically to gapLine —
    // the single-line case is the common one and is not what changed.
    const g = gap(1000, 8)
    const w = gapWidth(g.span)
    expect(w).toBeLessThan(360)
    expect(gapLines(g, w)).toEqual([gapLine(g, w)].filter(Boolean))
  })

  it('gives a wider gap more lines', () => {
    const narrow = gap(1000, 10)
    const wide = gap(1000, 60)
    expect(gapWidth(wide.span)).toBeGreaterThan(gapWidth(narrow.span))
    expect(gapLines(wide, gapWidth(wide.span)).length)
      .toBeGreaterThan(gapLines(narrow, gapWidth(narrow.span)).length)
  })

  it('never prints the same line twice inside one gap', () => {
    // The same sentence twice in one stretch is worse than one sentence with space
    // around it.
    for (const span of [30, 60, 90, 120, 200]) {
      const g = gap(500, span)
      const out = gapLines(g, gapWidth(span))
      expect(new Set(out).size, `span ${span}`).toBe(out.length)
    }
  })

  it('stops at three, so a gap never becomes a paragraph', () => {
    const g = gap(1, 2000)
    expect(gapLines(g, gapWidth(g.span)).length).toBeLessThanOrEqual(3)
  })

  it('keeps the same set across re-renders', () => {
    // Seeded off the gap, like gapLine: a chart that reshuffled its captions on
    // every render would make the page feel unstable for no information gained.
    const g = gap(742, 90)
    const w = gapWidth(g.span)
    expect(gapLines(g, w)).toEqual(gapLines(g, w))
  })

  it('gives two different gaps different sets', () => {
    const a = gapLines(gap(200, 90), gapWidth(90))
    const b = gapLines(gap(1500, 90), gapWidth(90))
    expect(a.length).toBeGreaterThan(0)
    expect(a).not.toEqual(b)
  })

  it('returns nothing rather than a clipped line when nothing fits', () => {
    expect(gapLines(gap(1000, 1), 10)).toEqual([])
  })

  it('sizes each line to its own share, not to the whole width', () => {
    // A slot is narrower than the gap, so the longest line that fits the GAP must
    // not be chosen for a SLOT. Every line returned has to fit the share it is
    // drawn in, or it clips.
    const g = gap(1000, 60)
    const w = gapWidth(g.span)
    const out = gapLines(g, w)
    const share = w / out.length
    for (const l of out) {
      expect(l.length * 6.1, l).toBeLessThanOrEqual((share - 24) * 2)
    }
  })
})

// ---- the caption pool, and drawing from it -------------------------------
//
// Twelve lines sorted by length looked like plenty until you noticed how they
// are chosen: by how much room the slot has. So the depth that matters is per
// WIDTH, and the middle band had two lines in it — a chart of similar gaps
// printed the same sentence beside itself and read as though the app had one
// joke.
describe('the gap captions', () => {
  it('offers at least three at every length', () => {
    for (const [i, band] of TIMELINE_GAP_BANDS.entries()) {
      expect(band.length, `band ${i} has only ${band.length}`).toBeGreaterThanOrEqual(3)
    }
  })

  it('keeps each band genuinely within one size, so a pick fits its slot', () => {
    // Bands must not overlap in length, or "the widest band that fits" picks a
    // band whose other members do not.
    const spans = TIMELINE_GAP_BANDS.map((b) => [Math.min(...b.map((l) => l.length)), Math.max(...b.map((l) => l.length))])
    for (let i = 1; i < spans.length; i++) {
      expect(spans[i][0], `band ${i} starts before band ${i - 1} ends`).toBeGreaterThan(spans[i - 1][1])
    }
  })

  it('has no duplicates', () => {
    const all = TIMELINE_GAP_BANDS.flat()
    expect(new Set(all).size).toBe(all.length)
  })
})

describe('the picker draws without replacement', () => {
  // THE RULE: no repeat until the band is used up. An independent random draw is
  // not that — with four lines it repeats within three picks about half the time,
  // which is exactly what a reader sees as "it keeps saying the same thing".
  it('exhausts a band before repeating anything in it', () => {
    const band = TIMELINE_GAP_BANDS[0]
    const room = Math.max(...band.map((l) => l.length)) * 6.1 + 1
    const bag = makeGapPicker(7)
    const first = Array.from({ length: band.length }, () => bag.pick(room))
    expect(new Set(first).size, `repeated inside one pass: ${first.join(' | ')}`).toBe(band.length)
    // And it refills rather than running dry.
    expect(band).toContain(bag.pick(room))
  })

  it('is stable for the same seed, so a re-render redraws the same chart', () => {
    const room = 400
    const a = Array.from({ length: 6 }, () => makeGapPicker(42).pick(room))
    expect(new Set(a).size).toBe(1)
  })

  it('gives nothing when nothing fits, rather than a clipped line', () => {
    expect(makeGapPicker(1).pick(10)).toBe('')
  })
})
