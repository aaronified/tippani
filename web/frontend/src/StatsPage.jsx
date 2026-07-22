import { useEffect, useRef, useState } from 'react'
import { json } from './api.js'
import { Card, MonoLabel, PageHeader, STATUS_META, fmtHalfLife, useIsMobileScreen } from './ui.jsx'

// StatsPage (§ insights) — a dedicated library-analytics screen, the richer
// successor to the old Settings "Library stats" card and the intended basis for
// achievements. All numbers come from one GET /stats call (a handful of
// aggregate queries). Charts stay inside the app's visual system: the activity
// calendar is single-hue sequential (accent mixed over the line colour, GitHub
// style), recall uses the reserved status palette (--ok/--amber/--error) and
// every status count carries its text label so identity is never colour alone.

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

// ActivityCalendar — a year of saves, GitHub style: one dot per day, one
// column per week (Sunday-first), only the months labelled along the x axis.
// Scrolls horizontally on narrow screens, opened at the most recent week.
function ActivityCalendar({ data }) {
  const scroller = useRef(null)
  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollLeft = el.scrollWidth // today lives at the right edge
  }, [data])

  const counts = new Map((data || []).map((d) => [d.date, d.count]))
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const start = new Date(today)
  start.setDate(start.getDate() - start.getDay() - 52 * 7) // the Sunday 52 full weeks back

  const weeks = []
  const monthLabels = []
  let prevMonth = -1
  let lastLabelAt = -9 // a label needs ~3 columns of room; the leading partial month yields
  let total = 0
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
      total += count
      max = Math.max(max, count)
      days.push({ count, date: new Date(d) })
    }
    const m = ws.getMonth()
    let label = ''
    if (m !== prevMonth && weeks.length - lastLabelAt >= 3) {
      label = MONTHS[m].slice(0, 3)
      lastLabelAt = weeks.length
    }
    monthLabels.push(label)
    prevMonth = m
    weeks.push(days)
  }

  return (
    <Card>
      <SectionHead label="Activity · last 12 months" right={<span className="mono-label">{total} saved</span>} />
      <div ref={scroller} style={{ overflowX: 'auto', paddingBottom: 4 }}>
        <div style={{ width: weeks.length * (DOT + GAP) - GAP }}>
          <div style={{ display: 'flex', gap: GAP }}>
            {weeks.map((days, wi) => (
              <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: GAP }}>
                {days.map((d, di) =>
                  d === null ? (
                    <span key={di} style={{ width: DOT, height: DOT }} aria-hidden="true" />
                  ) : (
                    <span
                      key={di}
                      title={`${d.date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}: ${d.count} saved`}
                      style={{ width: DOT, height: DOT, borderRadius: 999, background: calFill(d.count, max), flex: '0 0 auto' }}
                    />
                  ),
                )}
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
// single-work kinds (a book is one work) skip the redundant count.
const BREAKDOWN_KINDS = [
  { key: 'authors', label: 'Authors', works: true },
  { key: 'books', label: 'Books', works: false },
  { key: 'series', label: 'Series', works: true },
  { key: 'films', label: 'Films', works: false },
  { key: 'shows', label: 'Shows', works: false },
  { key: 'directors', label: 'Directors', works: true },
  { key: 'actors', label: 'Actors', works: true },
]

// The status segments of a breakdown row, in curve order.
const ROW_SEGS = [
  ['remembered', (r) => r.remembered],
  ['forgetting', (r) => r.forgetting],
  ['probably-forgotten', (r) => r.probably_forgotten],
  ['unseen', (r) => r.unseen],
]

// BreakdownRow — rank · name · quote count, a stacked status bar (proportions),
// and a mono sub-line spelling every non-zero status out (never colour alone).
function BreakdownRow({ r, rank, showWorks }) {
  const segs = ROW_SEGS.map(([key, of]) => [key, of(r)]).filter(([, n]) => n > 0)
  const barTip = segs.map(([key, n]) => `${n} ${STATUS_META[key].label.toLowerCase()}`).join(' · ')
  return (
    <div className="flex gap-2" title={`#${rank} ${r.name}: ${r.quotes} quotes`}>
      <span className="mono-label" style={{ flex: '0 0 auto', width: 20, textAlign: 'right', paddingTop: 2, color: 'var(--faint)' }}>
        {rank}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
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
// Joined credits ("Gaiman & Pratchett") are split server-side (§11).
function BreakdownCard({ breakdown }) {
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
          {k.top.map((r, i) => <BreakdownRow key={r.name + i} r={r} rank={i + 1} showWorks={meta.works} />)}
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
// tags: ~5 rows tall, the rest scrolls (the server sends up to 50).
function LeaderList({ rows }) {
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
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
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
function TopList({ label, rows }) {
  return (
    <Card>
      <SectionHead label={label} />
      <LeaderList rows={rows} />
    </Card>
  )
}

// SuperTile — a superlative as a compact tile (the same raised-chip tiling the
// Overview and Memory grids use): truncated headline · accent count · label.
function SuperTile({ label, title, count, amber }) {
  return (
    <div style={{ background: 'var(--raised)', border: '1px solid var(--line)', borderRadius: 10, padding: '12px 14px', minWidth: 0 }}>
      <div className="flex items-baseline gap-1.5" style={{ minWidth: 0 }}>
        <span
          title={title || undefined}
          style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {title || '—'}
        </span>
        {count != null && (
          <span style={{ flex: '0 0 auto', fontFamily: 'var(--font-mono)', fontSize: 12, color: amber ? 'var(--amber)' : 'var(--accent-ui)' }}>
            {count}
          </span>
        )}
      </div>
      <MonoLabel className="mt-1.5 block">{label}</MonoLabel>
    </div>
  )
}

function Superlatives({ s }) {
  const since = s.first_saved ? new Date(s.first_saved + 'T00:00:00').toLocaleDateString(undefined, { dateStyle: 'medium' }) : null
  return (
    <Card>
      <SectionHead label="Superlatives" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
        <SuperTile label="Most annotated" title={s.most_annotated?.title} count={s.most_annotated?.count} />
        <SuperTile label="Most quoted film" title={s.most_quoted?.title} count={s.most_quoted?.count} />
        <SuperTile label="Busiest month" title={s.busiest_month ? formatMonth(s.busiest_month.month) : null} count={s.busiest_month ? `${s.busiest_month.count} saved` : null} amber />
        <SuperTile label="Collecting since" title={since} />
      </div>
    </Card>
  )
}

export default function StatsPage() {
  const [s, setS] = useState(null)
  const mobile = useIsMobileScreen()
  useEffect(() => {
    json('GET', '/stats').then((r) => {
      if (r.ok) setS(r.data)
    })
  }, [])
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
          <ActivityCalendar data={s.daily_activity} />
          <MemoryCard recall={s.recall} />
          {/* Superlatives as one row of tiles (they used to pad out half a
              column beside the tall Breakdown); Colours + Top tags stack in
              the Breakdown's second column instead. */}
          <Superlatives s={s} />
          <div style={twoCol}>
            <BreakdownCard breakdown={s.breakdown} />
            <div className="space-y-6">
              <Colors colors={s.colors} />
              <TopList label="Top tags" rows={s.top_tags} />
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
