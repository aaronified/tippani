import { useEffect, useRef, useState } from 'react'
import { CAT_NAME_MAX, categoryName, categoryVar } from './theme.js'
import { coverImgURL, json } from './api.js'
import { PersonPortrait, usePeople } from './people.jsx'
import { ANNOTATION_COLORS, ANNOTATION_HEX, Card, fmtHalfLife, MonoLabel, PageHeader, STATUS_META, toast, Toggle, Tooltip, useIsMobileScreen, usePersistedState } from './ui.jsx'

// StatsPage (§ insights) — a dedicated library-analytics screen, the richer
// successor to the old Settings "Library stats" card and the intended basis for
// achievements. All numbers come from one GET /stats call (a handful of
// aggregate queries). Charts stay inside the app's visual system: the activity
// calendar is single-hue sequential (accent mixed over the line colour, GitHub
// style), recall uses the reserved status palette (--ok/--amber/--error) and
// every status count carries its text label so identity is never colour alone.
// Everything named is a doorway: activity dots, breakdown rows, superlative
// tiles and top tags all click through to the Search page (`onSearch`).

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

// The four colour categories, named and coloured the way the reader named and
// coloured them — a breakdown headed "Blue" when every card in the app says
// "Fact" is a breakdown of something else. Both come from theme.js rather than
// from a copy here, and the swatch is the custom property rather than a hex, so
// a recolour repaints this without a reload.
const hlRows = () => ANNOTATION_COLORS.map((c) => [c, categoryName(c), categoryVar(c)])

// formatMonth turns "YYYY-MM" into "Month YYYY".
function formatMonth(ym) {
  if (!ym) return ''
  const [y, m] = ym.split('-')
  const name = MONTHS[Number(m) - 1]
  return name ? `${name} ${y}` : ym
}

function SectionHead({ label, right }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <MonoLabel>{label}</MonoLabel>
      {right}
    </div>
  )
}

// StatTile — a hero number in mono over a mono label, on a raised chip. `dot`
// pairs the number with a status colour; the label still names it.
function StatTile({ n, label, heart, dot }) {
  return (
    <div style={{ background: 'var(--raised)', border: '1px solid var(--line)', borderRadius: 10, padding: '14px 16px', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, fontFamily: 'var(--font-mono)', fontSize: 26, fontWeight: 500, lineHeight: 1, color: 'var(--ink)' }}>
        {dot && <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 999, flex: '0 0 auto', background: dot.filled ? dot.color : 'transparent', border: `1.5px solid ${dot.color}` }} />}
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{n ?? 0}</span>
        {heart && <span style={{ color: 'var(--accent-ui)', fontSize: 13, lineHeight: 1 }}>♥</span>}
      </div>
      <MonoLabel className="mt-2 block">{label}</MonoLabel>
    </div>
  )
}

function Overview({ s }) {
  // ONE WORD, ONE MEANING. This row called book highlights "Quotes" while the
  // nav has a Quotes tab that means the standalone kind — so the tile named
  // after a screen counted a different thing from the screen, and the kind it
  // WAS named after had no tile at all. Annotations is what the API, the
  // database and the README call the book kind, and Quotes is now what the tab
  // means by it.
  const tiles = [
    ['Books', s.books],
    ['Annotations', s.annotations],
    ['Films', s.movies],
    ['Dialogues', s.dialogues],
    ['Quotes', s.quotes],
    ['Genres', s.genres],
    ['Tags', s.tags],
  ]
  return (
    <Card>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(118px, 1fr))', gap: 12 }}>
        {tiles.map(([label, n]) => <StatTile key={label} n={n} label={label} />)}
        <StatTile n={s.favorites} label="Favourites" heart />
      </div>
    </Card>
  )
}

// ---- activity calendar (GitHub style) ----

const DOT = 9 // dot diameter
const GAP = 3 // gap between dots; a week column is DOT+GAP wide

const localISO = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// calFill — sequential single hue: the accent mixed over the line colour in
// four steps by count (magnitude only; zero days stay on the line colour).
const CAL_STEPS = [35, 55, 78, 100]
function calFill(count, max) {
  if (!count) return 'var(--line)'
  const level = Math.min(4, Math.max(1, Math.ceil((4 * count) / Math.max(1, max))))
  return `color-mix(in srgb, var(--accent-ui) ${CAL_STEPS[level - 1]}%, var(--line))`
}

// useCalendarWeeks measures the calendar's own width and returns how many week
// columns to draw: on a phone a fixed year (scrolls); on desktop as many weeks
// as fill the width so the calendar spans the whole card (more than 12 months
// on a wide screen). Bounded so a huge monitor can't ask for absurd history.
const MIN_WEEKS = 53 // ~12 months (the phone view, and the desktop floor)
const MAX_WEEKS = 130 // ~2.5 years — the desktop ceiling
function useCalendarWeeks(ref, mobile) {
  const [weeks, setWeeks] = useState(MIN_WEEKS)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      if (mobile) { setWeeks(MIN_WEEKS); return }
      const n = Math.floor((el.clientWidth + GAP) / (DOT + GAP))
      setWeeks(Math.max(MIN_WEEKS, Math.min(MAX_WEEKS, n)))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref, mobile])
  return weeks
}

// ActivityCalendar — a GitHub-style heatmap: one dot per day, one column per
// week (Sunday-first), month names along the x axis. On desktop it fills the
// card width (many months); on a phone it holds a year and scrolls, opened at
// the most recent week. When `onSearch` is given, a day WITH activity is a
// button that opens that day on the Search page (Saves only); otherwise days
// are plain dots with a tooltip.
function ActivityCalendar({ data, noun = 'saved', onSearch }) {
  const scroller = useRef(null)
  const mobile = useIsMobileScreen()
  const weekCount = useCalendarWeeks(scroller, mobile)

  const counts = new Map((data || []).map((d) => [d.date, d.count]))
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const start = new Date(today)
  start.setDate(start.getDate() - start.getDay() - (weekCount - 1) * 7) // the Sunday weekCount-1 weeks back

  const weeks = []
  const monthLabels = []
  let prevMonth = -1
  let lastLabelAt = -99 // no label yet
  let max = 0
  for (const ws = new Date(start); ws <= today; ws.setDate(ws.getDate() + 7)) {
    const days = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(ws)
      d.setDate(d.getDate() + i)
      if (d > today) {
        days.push(null) // future pad of the current week
        continue
      }
      const count = counts.get(localISO(d)) || 0
      max = Math.max(max, count)
      days.push({ count, date: new Date(d) })
    }
    const m = ws.getMonth()
    const wi = weeks.length
    let label = ''
    // The leftmost column is a partial month — let it YIELD so the first FULL
    // month (e.g. August) gets the label instead of being crowded out. A label
    // then needs ~3 columns of clearance from the previous one.
    if (m !== prevMonth && wi > 0 && wi - lastLabelAt >= 3) {
      label = MONTHS[m].slice(0, 3)
      lastLabelAt = wi
    }
    monthLabels.push(label)
    prevMonth = m
    weeks.push(days)
  }

  // Scroll today into view (right edge) — only matters when the grid overflows
  // (the phone year view); a full-width desktop grid doesn't scroll.
  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [data, weekCount])

  return (
    <>
      <div ref={scroller} style={{ overflowX: 'auto', paddingBottom: 4 }}>
        <div style={{ minWidth: weeks.length * (DOT + GAP) - GAP }}>
          <div style={{ display: 'flex', gap: GAP }}>
            {weeks.map((days, wi) => (
              <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: GAP }}>
                {days.map((d, di) => {
                  if (d === null) return <span key={di} style={{ width: DOT, height: DOT }} aria-hidden="true" />
                  const label = `${d.date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}: ${d.count} ${noun}`
                  const dot = { width: DOT, height: DOT, borderRadius: 999, background: calFill(d.count, max), flex: '0 0 auto' }
                  // A day with activity is a doorway only when onSearch is given
                  // (Saves → that day's additions); quiet days stay plain dots.
                  return onSearch && d.count > 0 ? (
                    <button
                      key={di}
                      type="button"
                      className="cal-dot"
                      title={`${label} — view in search`}
                      aria-label={`${label} — view in search`}
                      onClick={() => onSearch(localISO(d.date))}
                      style={dot}
                    />
                  ) : (
                    <span key={di} title={label} style={dot} />
                  )
                })}
              </div>
            ))}
          </div>
          {/* x axis: month names only, pinned to the week their 1st falls in */}
          <div style={{ display: 'flex', gap: GAP, marginTop: 6 }}>
            {monthLabels.map((label, i) => (
              <span key={i} className="mono-label" style={{ width: DOT, flex: '0 0 auto', fontSize: 9, color: 'var(--faint)', overflow: 'visible', whiteSpace: 'nowrap' }}>
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-end gap-1.5">
        <span className="mono-label" style={{ fontSize: 9, color: 'var(--faint)' }}>less</span>
        {[0, 1, 2, 3, 4].map((lv) => (
          <span key={lv} aria-hidden="true" style={{ width: DOT, height: DOT, borderRadius: 999, background: lv === 0 ? 'var(--line)' : `color-mix(in srgb, var(--accent-ui) ${CAL_STEPS[lv - 1]}%, var(--line))` }} />
        ))}
        <span className="mono-label" style={{ fontSize: 9, color: 'var(--faint)' }}>more</span>
      </div>
    </>
  )
}

// ActivityCard — the calendar with a Saves · Quiz · Practice switch above it, so
// the same heatmap shows what you've added, what the Daily Quiz has surfaced,
// and what you've practised. Practice history is resettable here, mirroring the
// Home practice-card reset (DELETE /review/practice).
const ACTIVITY_STREAMS = [
  { key: 'saves', label: 'Saves', noun: 'saved', clickable: true },
  { key: 'quiz', label: 'Quiz', noun: 'reviewed', clickable: false },
  { key: 'practice', label: 'Practice', noun: 'practised', clickable: false },
]
function ActivityCard({ saves, quiz, practice, onSearch, onResetPractice }) {
  const [stream, setStream] = useState('saves')
  const meta = ACTIVITY_STREAMS.find((s) => s.key === stream) || ACTIVITY_STREAMS[0]
  const series = stream === 'quiz' ? quiz : stream === 'practice' ? practice : saves
  const total = (series || []).reduce((n, d) => n + d.count, 0)
  const hasPractice = (practice || []).length > 0
  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <MonoLabel>Activity · {total} {meta.noun}</MonoLabel>
        <div className="flex items-center gap-3">
          {stream === 'practice' && hasPractice && onResetPractice && (
            <button type="button" className="tp-link" onClick={onResetPractice}>reset practice</button>
          )}
          <Toggle ariaLabel="Activity stream" value={stream} onChange={setStream} options={ACTIVITY_STREAMS.map((s) => [s.key, s.label])} />
        </div>
      </div>
      <ActivityCalendar data={series} noun={meta.noun} onSearch={meta.clickable ? onSearch : undefined} />
    </Card>
  )
}

// ---- memory (the forgetting curve across the library) ----

// MemoryCard — where the whole library stands on the forgetting curve: one
// tile per recall status (the same dot colours the quotes wear), plus how many
// quotes are in the review rotation and their average half-life.
function MemoryCard({ recall }) {
  const st = recall?.states || {}
  if (!st.total) return null
  const tiles = [
    ['remembered', st.remembered],
    ['forgetting', st.forgetting],
    ['probably-forgotten', st.probably_forgotten],
    ['unseen', st.unseen],
  ]
  return (
    <Card>
      <SectionHead label="Memory" right={<span className="mono-label">{recall.reviewed} of {st.total} in rotation</span>} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(148px, 1fr))', gap: 12 }}>
        {tiles.map(([key, n]) => (
          <StatTile key={key} n={n} label={STATUS_META[key].label} dot={STATUS_META[key]} />
        ))}
        {recall.reviewed > 0 && <StatTile n={fmtHalfLife(recall.avg_half_life)} label="Avg half-life" />}
      </div>
    </Card>
  )
}

// ---- per-kind recall breakdown ----

// The kinds the Breakdown dropdown switches between. `works` marks the kinds
// where an entity spans several works (an author's books, a series' volumes) —
// single-work kinds (a book is one work) skip the redundant count. `art` kinds
// carry a cover/poster thumb (rows send cover_path); `person` kinds wear the
// People-console portrait chip for that credit kind.
const BREAKDOWN_KINDS = [
  { key: 'authors', label: 'Authors', works: true, person: 'author' },
  { key: 'books', label: 'Books', works: false, art: true },
  { key: 'series', label: 'Series', works: true },
  { key: 'films', label: 'Films', works: false, art: true },
  { key: 'shows', label: 'Shows', works: false, art: true },
  { key: 'directors', label: 'Directors', works: true, person: 'director' },
  { key: 'actors', label: 'Actors', works: true, person: 'actor' },
  // A speaker spans occasions the way an author spans books, so `works` is on.
  // The portrait comes from the People console like every other person kind.
  { key: 'speakers', label: 'Speakers', works: true, person: 'speaker' },
  // Everyone, whatever they were credited as. 0027 made a person's NAME their
  // identity and their roles a set, exactly because a speaker is so often
  // already an author — but the breakdowns still asked the question four times,
  // so somebody with a book and a film was two half-people in two sections.
  // This is the section that answers "who do I quote", which is the question
  // the other four are each a fragment of.
  { key: 'people', label: 'People', works: true, person: 'any' },
]

// The status segments of a breakdown row, in curve order.
const ROW_SEGS = [
  ['remembered', (r) => r.remembered],
  ['forgetting', (r) => r.forgetting],
  ['probably-forgotten', (r) => r.probably_forgotten],
  ['unseen', (r) => r.unseen],
]

// BreakdownRow — rank · art (cover thumb or portrait chip) · name · quote
// count, a stacked status bar (proportions), and a mono sub-line spelling
// every non-zero status out (never colour alone). The name is a doorway: it
// opens that entity on the Search page.
function BreakdownRow({ r, rank, showWorks, art, personMap, onSearch }) {
  const segs = ROW_SEGS.map(([key, of]) => [key, of(r)]).filter(([, n]) => n > 0)
  const barTip = segs.map(([key, n]) => `${n} ${STATUS_META[key].label.toLowerCase()}`).join(' · ')
  const portrait = personMap ? personMap[r.name] : null
  // Kinds that carry art (covers / portraits) always reserve a fixed-width art
  // column, image or not, so the name + status bar start at the same x and the
  // bar is the same width whether or not a given entity has an image.
  const showArtCol = art || !!personMap
  return (
    <div className="flex gap-2">
      <span className="mono-label" style={{ flex: '0 0 auto', width: 20, textAlign: 'right', paddingTop: 2, color: 'var(--faint)' }}>
        {rank}
      </span>
      {showArtCol && (
        <span style={{ flex: '0 0 auto', width: 24, display: 'flex', justifyContent: 'center', paddingTop: 1 }}>
          {art && r.cover_path ? (
            <img
              src={coverImgURL(r.cover_path)}
              alt=""
              style={{ width: 22, height: 33, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--ink-border)' }}
            />
          ) : portrait ? (
            <PersonPortrait person={portrait} size={24} />
          ) : null}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <Tooltip label="Search for this name" side="bottom" className="min-w-0">
            <button
              type="button"
              className="truncate text-left"
              style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14, background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit' }}
              onClick={() => onSearch?.(r.name)}
            >
              {r.name}
            </button>
          </Tooltip>
          <span className="mono-label" style={{ flex: '0 0 auto', color: 'var(--accent-ui)' }}>{r.quotes}</span>
        </div>
        {segs.length > 0 && (
          <div title={barTip} style={{ display: 'flex', gap: 2, height: 6, marginTop: 3 }}>
            {segs.map(([key, n]) => (
              <span key={key} style={{ flex: n, minWidth: 4, borderRadius: 999, background: STATUS_META[key].color }} />
            ))}
          </div>
        )}
        <p className="mono-label" style={{ marginTop: 3, fontSize: 9.5, color: 'var(--faint)' }}>
          {showWorks ? `${r.works} ${r.works === 1 ? 'work' : 'works'}` : ''}
          {showWorks && segs.length > 0 ? ' · ' : ''}
          {segs.map(([key, n]) => `${n} ${STATUS_META[key].label.toLowerCase()}`).join(' · ')}
        </p>
      </div>
    </div>
  )
}

// BreakdownCard — the People card grown up: a dropdown picks the dimension
// (authors · books · series · films · shows · directors · actors); each shows
// its work/quote counts and where those quotes sit on the forgetting curve,
// headlined by the best-remembered and most-forgotten entity of that kind.
// Joined credits ("Gaiman & Pratchett") are split server-side (§11). Rows wear
// cover thumbs / portrait chips and click through to Search.
function BreakdownCard({ breakdown, personMaps, onSearch }) {
  const [kind, setKind] = useState('authors')
  const meta = BREAKDOWN_KINDS.find((m) => m.key === kind) || BREAKDOWN_KINDS[0]
  const k = breakdown?.[kind] || { count: 0, top: [] }
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-3">
        <MonoLabel>Breakdown · {k.count}</MonoLabel>
        <select
          className="tp-input"
          aria-label="Breakdown kind"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          style={{ maxWidth: 140, paddingTop: 5, paddingBottom: 5, fontSize: 13 }}
        >
          {BREAKDOWN_KINDS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
        </select>
      </div>
      {(k.most_remembered || k.most_forgotten) && (
        <p className="microcopy mb-3" style={{ lineHeight: 1.6 }}>
          {k.most_remembered && <>best remembered: <strong>{k.most_remembered.name}</strong> · {k.most_remembered.remembered}</>}
          {k.most_remembered && k.most_forgotten && <br />}
          {k.most_forgotten && <>most forgotten: <strong>{k.most_forgotten.name}</strong> · {k.most_forgotten.probably_forgotten}</>}
        </p>
      )}
      {!k.top || k.top.length === 0 ? (
        <p className="tp-empty" style={{ padding: '16px 0' }}>nothing yet</p>
      ) : (
        // Ranked, and ~10 rows tall — the rest scrolls (the server sends up
        // to 50 per kind).
        <div className="space-y-3" style={{ maxHeight: 560, overflowY: 'auto', paddingRight: 6 }}>
          {k.top.map((r, i) => (
            <BreakdownRow
              key={r.name + i}
              r={r}
              rank={i + 1}
              showWorks={meta.works}
              art={meta.art}
              personMap={meta.person ? personMaps?.[meta.person] : null}
              onSearch={onSearch}
            />
          ))}
        </div>
      )}
    </Card>
  )
}

// HBar — one labelled horizontal magnitude bar (used by the colour breakdown).
function HBar({ swatch, label, labelWidth, n, max, fill }) {
  return (
    <div className="flex items-center gap-2" title={`${label}: ${n}`}>
      {swatch}
      {/* nowrap: the column is sized to the longest name below, but a name that
          overruns the cap must ELLIPSISE rather than wrap — a wrapped label
          pushes its own row taller than its neighbours and the bars stop
          lining up, which is the one thing a magnitude column has to do. The
          full name is on the row's title either way. */}
      <span className="mono-label" style={{ width: labelWidth, flex: '0 0 auto', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
      <div style={{ flex: 1, height: 8, background: 'var(--line)', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.round((100 * n) / max)}%`, background: fill, borderRadius: 999 }} />
      </div>
      <span className="mono-label" style={{ width: 30, flex: '0 0 auto', textAlign: 'right' }}>{n}</span>
    </div>
  )
}

function Colors({ colors }) {
  const rows = hlRows()
  const total = rows.reduce((a, [k]) => a + (colors?.[k] || 0), 0)
  const max = Math.max(1, ...rows.map(([k]) => colors?.[k] || 0))
  // The label column was a fixed 52px, which fitted "Yellow" and nothing a
  // reader would choose. It sizes to the longest name now — a breakdown that
  // truncates the categories it is breaking down is not a breakdown.
  //
  // 8.4px PER CHARACTER, not 7. `.mono-label` is 11px IBM Plex Mono in caps with
  // .14em tracking: the glyph advance is ~6.6px and the tracking adds ~1.5px on
  // top of every character. Charging 7px was under-measuring by a fifth, so the
  // column came out narrower than the words it was cut for and every name past
  // about eight letters wrapped — the "unnecessary" wrap, because the space to
  // avoid it was there and simply hadn't been asked for.
  //
  // The ceiling is CAT_NAME_MAX at that pitch rather than a number picked to look
  // right, so the widest name the app will accept is the widest column this can
  // ask for and no compliant name is ever cut. The ellipsis on the label survives
  // for one case only: a name stored under the old, longer cap, which displays
  // capped anyway (capCategoryName) and heals on its next save.
  const labelCap = Math.ceil(CAT_NAME_MAX * 8.4) + 6
  const labelWidth = Math.min(labelCap, Math.max(52, ...rows.map(([, label]) => Math.ceil(label.length * 8.4) + 6)))
  return (
    <Card>
      <SectionHead label="Colour categories" right={<span className="mono-label">{total} quotes</span>} />
      {total === 0 ? (
        <p className="tp-empty" style={{ padding: '16px 0' }}>no highlights yet</p>
      ) : (
        <div className="space-y-2">
          {rows.map(([k, label, fill]) => (
            <HBar
              key={k}
              label={label}
              labelWidth={labelWidth}
              n={colors?.[k] || 0}
              max={max}
              fill={fill}
              swatch={<span style={{ width: 12, height: 12, borderRadius: 999, background: fill, border: '1px solid rgba(41,38,29,.35)', flex: '0 0 auto' }} />}
            />
          ))}
        </div>
      )}
    </Card>
  )
}

// LeaderList — ranked rows (rank · name · value · accent bar) used by Top
// tags: ~5 rows tall, the rest scrolls (the server sends up to 50). Names
// click through to Search.
function LeaderList({ rows, onSearch }) {
  if (!rows || rows.length === 0) return <p className="tp-empty" style={{ padding: '16px 0' }}>nothing yet</p>
  const max = Math.max(1, ...rows.map((r) => r.count))
  return (
    <div className="space-y-3" style={{ maxHeight: 220, overflowY: 'auto', paddingRight: 6 }}>
      {rows.map((r, i) => (
        <div key={r.name + i} className="flex gap-2">
          <span className="mono-label" style={{ flex: '0 0 auto', width: 20, textAlign: 'right', paddingTop: 2, color: 'var(--faint)' }}>
            {i + 1}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <Tooltip label="Search for this tag" side="bottom" className="min-w-0">
                <button
                  type="button"
                  className="truncate text-left"
                  style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14, background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit' }}
                  onClick={() => onSearch?.(r.name)}
                >
                  {r.name}
                </button>
              </Tooltip>
              <span className="mono-label" style={{ flex: '0 0 auto', color: 'var(--accent-ui)' }}>{r.count}</span>
            </div>
            <div style={{ height: 6, background: 'var(--line)', borderRadius: 999, overflow: 'hidden', marginTop: 3 }}>
              <div style={{ height: '100%', width: `${Math.round((100 * r.count) / max)}%`, background: 'var(--accent-ui)', borderRadius: 999 }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// TopList — a labelled leaderboard card (Top tags).
function TopList({ label, rows, onSearch }) {
  return (
    <Card>
      <SectionHead label={label} />
      <LeaderList rows={rows} onSearch={onSearch} />
    </Card>
  )
}


// decadeStart floors a year to its decade, towards the past on both sides of the
// era boundary. Math.floor rather than a truncating divide, because truncation
// rounds -479 UP to -470 and would file the Analects in the wrong decade — the
// one classic sign error in date bucketing, and it only shows up on BCE data.
function decadeStart(year) {
  return Math.floor(year / 10) * 10
}

// decadeLabel writes a decade the way it is said: "1990s", "480s BCE". The
// number shown for a BCE decade is the START of it as spoken, which is the
// higher absolute value — the 480s BCE runs from 489 to 480.
export function decadeLabel(start) {
  return start < 0 ? `${-start}s BCE` : `${start}s`
}

// topDecade finds the decade holding the most quotes.
//
// Derived from the timeline rather than asked of the server, because the server
// deliberately sends per-YEAR buckets: which scale to read them at is a question
// about the library and the screen, and the same rows answer the decade tile and
// the chart without a second query.
//
// Ties break towards the EARLIER decade, so the tile is stable across reloads
// and, when it does have to choose, points at the older one — which in a library
// like this is the more interesting answer.
export function topDecade(timeline) {
  if (!Array.isArray(timeline) || timeline.length === 0) return null
  const byDecade = new Map()
  for (const b of timeline) {
    const start = decadeStart(b.year)
    byDecade.set(start, (byDecade.get(start) || 0) + (b.quotes || 0))
  }
  let best = null
  for (const [start, quotes] of [...byDecade].sort((a, b) => a[0] - b[0])) {
    if (quotes > 0 && (best === null || quotes > best.quotes)) {
      best = { start, quotes, label: decadeLabel(start) }
    }
  }
  return best
}


// ---- the timeline ---------------------------------------------------------
//
// When the library's works are FROM, as opposed to when they were saved. The
// activity calendar already answers the second question; nothing answered the
// first, despite every book and film having carried a year since 0001.
//
// The server sends one bucket per YEAR and this decides how to read them,
// because the right scale is a property of the library rather than of the data:
// 2,500 years wants centuries, a shelf of films wants years, and nothing
// sensible wants both at once.

export const TIMELINE_SCALES = [
  { key: 'decade', label: 'Decades', size: 10 },
  { key: 'century', label: 'Centuries', size: 100 },
  { key: 'year', label: 'Years', size: 1 },
]

// bucketTimeline groups the per-year rows at a scale, INCLUDING the empty
// buckets in between.
//
// The gaps are the point. A library with something from 380 BCE and nothing else
// until 1600 should show that as a long emptiness, not as two bars side by side
// — which is what dropping the empty buckets would draw, and it would read as
// two adjacent periods rather than two millennia apart.
export function bucketTimeline(timeline, size) {
  const rows = (Array.isArray(timeline) ? timeline : []).filter((b) => Number.isFinite(b?.year))
  if (rows.length === 0) return []
  const floor = (y) => Math.floor(y / size) * size
  const byStart = new Map()
  for (const b of rows) {
    const start = floor(b.year)
    const cur = byStart.get(start) || { start, works: 0, quotes: 0 }
    cur.works += b.works || 0
    cur.quotes += b.quotes || 0
    byStart.set(start, cur)
  }
  const first = floor(rows[0].year)
  const last = floor(rows[rows.length - 1].year)
  const out = []
  for (let start = first; start <= last; start += size) {
    out.push(byStart.get(start) || { start, works: 0, quotes: 0 })
  }
  return out
}

// ---- the timeline as a dot plot -------------------------------------------
//
// It was one stacked bar per bucket: works at the foot, quotes on top, the pair
// summing to the bar's height. Stacking is what made it hard to read. Only the
// bottom segment of a stack starts from a common baseline, so the quote counts
// — the series you actually came for — each began at a different height and
// could not be compared across buckets by eye. And the two series were being
// added together, which they should never have been: a work and a quote are not
// two of the same thing, and "3" on that axis meant nothing in particular.
//
// A dot plot fixes both. Each series gets its own column of dots rising from
// the same floor, so quotes are comparable with quotes and works with works,
// and nothing is summed. Dots also make the unit explicit in a way a continuous
// bar does not: the count is something you can read off by counting, and the
// legend states what one dot is worth when the library is too big for one each.
//
// TIMELINE_MAX_DOTS is how many dots the tallest column may reach — the height
// the CSS gives .tl-plot, divided by the dot pitch. Both series share ONE scale
// (the taller of the two peaks), because two scales in one frame is two charts
// wearing a disguise.

const TIMELINE_MAX_DOTS = 12

// dotUnit — how many items one dot stands for, so the tallest column lands on
// TIMELINE_MAX_DOTS. Always at least 1: fewer items than dots means one dot each,
// which is the case a dot plot is best at and must not be scaled away.
export function dotUnit(buckets, maxDots = TIMELINE_MAX_DOTS) {
  const peak = (buckets || []).reduce((m, b) => Math.max(m, b.works || 0, b.quotes || 0), 0)
  return Math.max(1, Math.ceil(peak / maxDots))
}

// dotCount — dots for a value at a given unit. ROUNDS UP, so anything at all
// draws at least one dot: a decade holding a single book must not render as an
// empty column, which is the mark this chart reserves for holding nothing.
export function dotCount(value, unit) {
  const n = value || 0
  if (n <= 0) return 0
  return Math.max(1, Math.ceil(n / Math.max(1, unit)))
}

// TimelineCard — a scrollable band of dot columns, one pair per bucket.
//
// WIDTH IS HANDLED BY CSS, not by measuring. Every column has a minimum width,
// the row scrolls sideways, and that is exactly "show as many as are legible and
// scroll the rest" without a ResizeObserver, without a re-render on resize, and
// without a number that has to be kept in step with a font size. A narrow phone
// simply shows fewer columns of the same size.
//
// overscroll-behavior-x is contained, following the 1.7.2 sweep: a sideways
// scroller that runs off its end otherwise hands the gesture to the browser's
// back navigation, which on a stats page means leaving it.
function TimelineCard({ timeline }) {
  const [scale, setScale] = usePersistedState('tippani:stats:timelineScale', 'decade')
  const meta = TIMELINE_SCALES.find((x) => x.key === scale) || TIMELINE_SCALES[0]
  const buckets = bucketTimeline(timeline, meta.size)
  const unit = dotUnit(buckets)
  if (!timeline || timeline.length === 0) {
    return (
      <Card>
        <SectionHead label="Timeline" />
        <p style={{ color: 'var(--soft)', fontSize: 13 }}>
          Nothing here yet — a book or film needs a year on it to have a place in time.
        </p>
      </Card>
    )
  }
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-3">
        <MonoLabel>Timeline · {buckets.length}</MonoLabel>
        <select className="tp-input" aria-label="Timeline scale" value={scale} onChange={(e) => setScale(e.target.value)} style={{ width: 'auto' }}>
          {TIMELINE_SCALES.map((x) => (
            <option key={x.key} value={x.key}>{x.label}</option>
          ))}
        </select>
      </div>
      <div className="tl-scroll">
        <div className="tl-row">
          {buckets.map((b) => {
            const total = b.works + b.quotes
            const reading = `${decadeLabel(b.start)}: ${b.works} works, ${b.quotes} quotes`
            return (
              <Tooltip key={b.start} label={reading} side="top">
                {/* Two columns from one floor. An empty bucket draws no dots at
                    all, which is what a gap in time looks like — and it keeps
                    its width, so the gap is as wide as it was long. */}
                <div className="tl-col" aria-label={reading}>
                  <div className="tl-plot">
                    <DotStack n={dotCount(b.quotes, unit)} kind="quotes" />
                    <DotStack n={dotCount(b.works, unit)} kind="works" />
                  </div>
                  <div className="tl-tick">{total ? decadeLabel(b.start) : ''}</div>
                </div>
              </Tooltip>
            )
          })}
        </div>
      </div>
      {/* Two series, so a legend is not optional — identity must never be
          carried by colour alone. The unit line only appears when a dot is worth
          more than one thing; on a small library every dot is one thing and
          saying so would be noise. */}
      <div className="mt-2 flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
        <TimelineKey kind="quotes" label="quotes" />
        <TimelineKey kind="works" label="works" />
        {unit > 1 && (
          <span className="mono-label" style={{ fontSize: 9, color: 'var(--faint)' }}>1 dot ≈ {unit}</span>
        )}
      </div>
    </Card>
  )
}

// DotStack — one series' column for one bucket, growing upward from the floor.
function DotStack({ n, kind }) {
  return (
    <span className={`tl-dots tl-dots-${kind}`} aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className="tl-dot" />
      ))}
    </span>
  )
}

// TimelineKey — one legend entry, the swatch drawn by the same rule as the dots.
function TimelineKey({ kind, label }) {
  return (
    <span className="mono-label inline-flex items-center gap-1.5" style={{ fontSize: 9 }}>
      <span className={`tl-dots tl-dots-${kind}`} aria-hidden="true">
        <span className="tl-dot" />
      </span>
      {label}
    </span>
  )
}

// SuperTile — a superlative as a compact tile (the same raised-chip tiling the
// Overview and Memory grids use): cover thumb · truncated headline · accent
// count · label. With `onOpen` the headline is a doorway (→ Search).
function SuperTile({ label, title, count, amber, cover, person, onOpen }) {
  return (
    <div style={{ background: 'var(--raised)', border: '1px solid var(--line)', borderRadius: 10, padding: '12px 14px', minWidth: 0 }}>
      <div className="flex items-center gap-2.5" style={{ minWidth: 0 }}>
        {cover ? (
          <img
            src={coverImgURL(cover)}
            alt=""
            style={{ width: 26, height: 39, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--ink-border)', flex: '0 0 auto' }}
          />
        ) : person ? (
          // A person's tile wears their face, the same portrait the breakdown
          // rows and the People console use. A name alone in a grid of covers
          // reads as the one tile whose art failed to load.
          <span style={{ flex: '0 0 auto' }}>
            <PersonPortrait person={person} size={30} />
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5" style={{ minWidth: 0 }}>
            {title && onOpen ? (
              <Tooltip label="Search for this title" side="top" className="min-w-0">
                <button
                  type="button"
                  className="truncate text-left"
                  style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15, lineHeight: 1.3, background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit' }}
                  onClick={onOpen}
                >
                  {title}
                </button>
              </Tooltip>
            ) : (
              <span
                title={title || undefined}
                style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {title || '—'}
              </span>
            )}
            {count != null && (
              <span style={{ flex: '0 0 auto', fontFamily: 'var(--font-mono)', fontSize: 12, color: amber ? 'var(--amber)' : 'var(--accent-ui)' }}>
                {count}
              </span>
            )}
          </div>
          <MonoLabel className="mt-1.5 block">{label}</MonoLabel>
        </div>
      </div>
    </div>
  )
}

function Superlatives({ s, personMaps, onSearch }) {
  const since = s.first_saved ? new Date(s.first_saved + 'T00:00:00').toLocaleDateString(undefined, { dateStyle: 'medium' }) : null
  const open = (title) => (title && onSearch ? () => onSearch(title) : undefined)
  // The third medium had no superlative beside the other two. It gets one from
  // the breakdown that was already on the page rather than a new query: `top` is
  // sorted most-quoted first, so the head of it IS the superlative, and a
  // standalone quote has no work to be the most-quoted THING — the speaker is
  // the closest thing it has to one.
  // Every people superlative reads the COMBINED breakdown, not one role's. The
  // most quoted person in a library that holds both books and films is very
  // often somebody who appears in both, and asking "most quoted speaker" could
  // only ever return the winner of one of the four sections.
  const people = s.breakdown?.people
  const topPerson = people?.top?.[0] || null
  const remembered = people?.most_remembered || null
  const forgotten = people?.most_forgotten || null
  const decade = topDecade(s.timeline)
  const face = (name) => (name ? personMaps?.any?.[name] : null)
  return (
    <Card>
      <SectionHead label="Superlatives" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
        <SuperTile label="Most annotated book" title={s.most_annotated?.title} count={s.most_annotated?.count} cover={s.most_annotated?.cover_path} onOpen={open(s.most_annotated?.title)} />
        <SuperTile label="Most quoted film/show" title={s.most_quoted?.title} count={s.most_quoted?.count} cover={s.most_quoted?.cover_path} onOpen={open(s.most_quoted?.title)} />
        <SuperTile label="Most quoted person" title={topPerson?.name} count={topPerson?.quotes} person={face(topPerson?.name)} onOpen={open(topPerson?.name)} />
        <SuperTile label="Most favourited person" title={s.favourite_person?.title} count={s.favourite_person?.count} person={face(s.favourite_person?.title)} onOpen={open(s.favourite_person?.title)} />
        <SuperTile label="Most quoted decade" title={decade?.label} count={decade ? `${decade.quotes} quotes` : null} amber />
        <SuperTile label="Busiest month" title={s.busiest_month ? formatMonth(s.busiest_month.month) : null} count={s.busiest_month ? `${s.busiest_month.count} saved` : null} amber />
        <SuperTile label="Best remembered" title={remembered?.name} count={remembered ? `${remembered.remembered} of ${remembered.quotes}` : null} person={face(remembered?.name)} onOpen={open(remembered?.name)} />
        <SuperTile label="Most forgotten" title={forgotten?.name} count={forgotten ? `${forgotten.probably_forgotten} of ${forgotten.quotes}` : null} person={face(forgotten?.name)} onOpen={open(forgotten?.name)} />
        <SuperTile label="Collecting since" title={since} />
      </div>
    </Card>
  )
}

export default function StatsPage({ onSearch }) {
  const [s, setS] = useState(null)
  const mobile = useIsMobileScreen()
  // People-console portraits for the person breakdown kinds' chips.
  const authors = usePeople('author')
  const directors = usePeople('director')
  const actors = usePeople('actor')
  const speakers = usePeople('speaker')
  // `any` is every portrait regardless of the role it was saved under. The
  // people endpoint requires a kind, but all four maps are already loaded here,
  // and 0027 made a person ONE row keyed by name — so the same human has the
  // same row whichever of the four you ask, and merging them costs no request.
  // Without this the combined People breakdown would show a portrait only for
  // the people who happen to be authors.
  const personMaps = {
    author: authors.map,
    director: directors.map,
    actor: actors.map,
    speaker: speakers.map,
    any: { ...speakers.map, ...actors.map, ...directors.map, ...authors.map },
  }
  const loadStats = () => json('GET', '/stats').then((r) => { if (r.ok) setS(r.data) })
  useEffect(() => { loadStats() }, [])
  async function resetPractice() {
    const r = await json('DELETE', '/review/practice')
    if (r.ok) { toast('practice history cleared'); loadStats() }
    else toast('could not reset practice')
  }
  const twoCol = { display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: 24 }
  return (
    <section className="space-y-6">
      <div className={mobile ? 'mobile-sticky-bar' : ''}>
        <PageHeader title="Stats" counts={s ? `${(s.annotations || 0) + (s.dialogues || 0) + (s.quotes || 0)} saved` : ''} />
      </div>
      {!s ? (
        <Card><p className="tp-empty" style={{ padding: '32px 0' }}>loading…</p></Card>
      ) : (
        <div className="space-y-6">
          <Overview s={s} />
          <ActivityCard
            saves={s.daily_activity}
            quiz={s.daily_quiz}
            practice={s.daily_practice}
            onSearch={onSearch}
            onResetPractice={resetPractice}
          />
          <MemoryCard recall={s.recall} />
          {/* Superlatives as one row of tiles (they used to pad out half a
              column beside the tall Breakdown); Colours + Top tags stack in
              the Breakdown's second column instead. */}
          <Superlatives s={s} personMaps={personMaps} onSearch={onSearch} />
          <TimelineCard timeline={s.timeline} />
          <div style={twoCol}>
            <BreakdownCard breakdown={s.breakdown} personMaps={personMaps} onSearch={onSearch} />
            <div className="space-y-6">
              <Colors colors={s.colors} />
              <TopList label="Top tags" rows={s.top_tags} onSearch={onSearch} />
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
