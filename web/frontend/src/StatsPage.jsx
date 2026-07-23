import { useEffect, useRef, useState } from 'react'
import { coverImgURL, json } from './api.js'
import { PersonPortrait, usePeople } from './people.jsx'
import { Card, MonoLabel, PageHeader, STATUS_META, Toggle, fmtHalfLife, toast, useIsMobileScreen } from './ui.jsx'

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

// The four fixed annotation highlight colours (index.css .dot-*), reused here so
// the breakdown reads as the same palette the quotes themselves wear.
const HL = [
  ['yellow', 'Yellow', '#E5C355'],
  ['blue', 'Blue', '#7FA6C9'],
  ['pink', 'Pink', '#D98CA6'],
  ['orange', 'Orange', '#DF9A5B'],
]

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
  const tiles = [
    ['Books', s.books],
    ['Quotes', s.annotations],
    ['Films', s.movies],
    ['Dialogues', s.dialogues],
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
    <div className="flex gap-2" title={`#${rank} ${r.name}: ${r.quotes} quotes`}>
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
          <button
            type="button"
            className="truncate text-left"
            title={`search “${r.name}”`}
            style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14, background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit' }}
            onClick={() => onSearch?.(r.name)}
          >
            {r.name}
          </button>
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
      <span className="mono-label" style={{ width: labelWidth, flex: '0 0 auto' }}>{label}</span>
      <div style={{ flex: 1, height: 8, background: 'var(--line)', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.round((100 * n) / max)}%`, background: fill, borderRadius: 999 }} />
      </div>
      <span className="mono-label" style={{ width: 30, flex: '0 0 auto', textAlign: 'right' }}>{n}</span>
    </div>
  )
}

function Colors({ colors }) {
  const total = HL.reduce((a, [k]) => a + (colors?.[k] || 0), 0)
  const max = Math.max(1, ...HL.map(([k]) => colors?.[k] || 0))
  return (
    <Card>
      <SectionHead label="Highlight colours" right={<span className="mono-label">{total} quotes</span>} />
      {total === 0 ? (
        <p className="tp-empty" style={{ padding: '16px 0' }}>no highlights yet</p>
      ) : (
        <div className="space-y-2">
          {HL.map(([k, label, hex]) => (
            <HBar
              key={k}
              label={label}
              labelWidth={52}
              n={colors?.[k] || 0}
              max={max}
              fill={hex}
              swatch={<span style={{ width: 12, height: 12, borderRadius: 999, background: hex, border: '1px solid rgba(41,38,29,.35)', flex: '0 0 auto' }} />}
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
        <div key={r.name + i} className="flex gap-2" title={`#${i + 1} ${r.name}: ${r.count}`}>
          <span className="mono-label" style={{ flex: '0 0 auto', width: 20, textAlign: 'right', paddingTop: 2, color: 'var(--faint)' }}>
            {i + 1}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <button
                type="button"
                className="truncate text-left"
                title={`search “${r.name}”`}
                style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14, background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit' }}
                onClick={() => onSearch?.(r.name)}
              >
                {r.name}
              </button>
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

// SuperTile — a superlative as a compact tile (the same raised-chip tiling the
// Overview and Memory grids use): cover thumb · truncated headline · accent
// count · label. With `onOpen` the headline is a doorway (→ Search).
function SuperTile({ label, title, count, amber, cover, onOpen }) {
  return (
    <div style={{ background: 'var(--raised)', border: '1px solid var(--line)', borderRadius: 10, padding: '12px 14px', minWidth: 0 }}>
      <div className="flex items-center gap-2.5" style={{ minWidth: 0 }}>
        {cover && (
          <img
            src={coverImgURL(cover)}
            alt=""
            style={{ width: 26, height: 39, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--ink-border)', flex: '0 0 auto' }}
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5" style={{ minWidth: 0 }}>
            {title && onOpen ? (
              <button
                type="button"
                className="truncate text-left"
                title={`search “${title}”`}
                style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15, lineHeight: 1.3, background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit' }}
                onClick={onOpen}
              >
                {title}
              </button>
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

function Superlatives({ s, onSearch }) {
  const since = s.first_saved ? new Date(s.first_saved + 'T00:00:00').toLocaleDateString(undefined, { dateStyle: 'medium' }) : null
  const open = (title) => (title && onSearch ? () => onSearch(title) : undefined)
  return (
    <Card>
      <SectionHead label="Superlatives" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
        <SuperTile label="Most annotated" title={s.most_annotated?.title} count={s.most_annotated?.count} cover={s.most_annotated?.cover_path} onOpen={open(s.most_annotated?.title)} />
        <SuperTile label="Most quoted film" title={s.most_quoted?.title} count={s.most_quoted?.count} cover={s.most_quoted?.cover_path} onOpen={open(s.most_quoted?.title)} />
        <SuperTile label="Busiest month" title={s.busiest_month ? formatMonth(s.busiest_month.month) : null} count={s.busiest_month ? `${s.busiest_month.count} saved` : null} amber />
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
  const personMaps = { author: authors.map, director: directors.map, actor: actors.map }
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
        <PageHeader title="Stats" counts={s ? `${(s.annotations || 0) + (s.dialogues || 0)} saved` : ''} />
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
          <Superlatives s={s} onSearch={onSearch} />
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
