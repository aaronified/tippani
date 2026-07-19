import { useEffect, useState } from 'react'
import { json } from './api.js'
import { Card, MonoLabel, PageHeader, useIsMobileScreen } from './ui.jsx'

// StatsPage (§ insights) — a dedicated library-analytics screen, the richer
// successor to the old Settings "Library stats" card and the intended basis for
// achievements. All numbers come from one GET /stats call (a handful of
// aggregate queries). Charts stay inside the app's visual system: single-hue
// sequential bars in the accent (one series each, so the section title names
// them — no legend), and the highlight-colour breakdown in the four real
// highlight colours, each paired with a label + count so identity is never
// carried by colour alone.

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

// The four fixed annotation highlight colours (index.css .dot-*), reused here so
// the breakdown reads as the same palette the quotes themselves wear.
const HL = [
  ['yellow', 'Yellow', '#E5C355'],
  ['blue', 'Blue', '#7FA6C9'],
  ['pink', 'Pink', '#D98CA6'],
  ['orange', 'Orange', '#DF9A5B'],
]

// formatMonth turns "YYYY-MM" into "Month YYYY"; shortMonth into "Feb".
function formatMonth(ym) {
  if (!ym) return ''
  const [y, m] = ym.split('-')
  const name = MONTHS[Number(m) - 1]
  return name ? `${name} ${y}` : ym
}
function shortMonth(ym) {
  if (!ym) return ''
  const m = MONTHS[Number(ym.split('-')[1]) - 1]
  return m ? m.slice(0, 3) : ym
}

function SectionHead({ label, right }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <MonoLabel>{label}</MonoLabel>
      {right}
    </div>
  )
}

// StatTile — a hero number in mono over a mono label, on a raised chip.
function StatTile({ n, label, heart }) {
  return (
    <div style={{ background: 'var(--raised)', border: '1px solid var(--line)', borderRadius: 10, padding: '14px 16px', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, fontFamily: 'var(--font-mono)', fontSize: 26, fontWeight: 500, lineHeight: 1, color: 'var(--ink)' }}>
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
    ['Authors', s.authors],
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

// ActivityBars — one accent bar per month for the last twelve, height by count
// (change-over-time, single series). Exact values on hover; month initials below.
function ActivityBars({ data }) {
  if (!data || data.length === 0) return null
  const max = Math.max(1, ...data.map((d) => d.count))
  const total = data.reduce((a, d) => a + d.count, 0)
  const cols = `repeat(${data.length}, 1fr)`
  return (
    <Card>
      <SectionHead label="Activity · last 12 months" right={<span className="mono-label">{total} saved</span>} />
      <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 5, alignItems: 'end', height: 128 }}>
        {data.map((d) => {
          const h = d.count === 0 ? 3 : Math.round(10 + 108 * (d.count / max))
          return (
            <div key={d.month} style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', height: '100%' }} title={`${formatMonth(d.month)}: ${d.count} saved`}>
              <div style={{ width: '100%', maxWidth: 24, height: h, borderRadius: '4px 4px 2px 2px', background: d.count ? 'var(--accent-ui)' : 'var(--line)' }} />
            </div>
          )
        })}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 5, marginTop: 7 }}>
        {data.map((d) => (
          <span key={d.month} className="mono-label" style={{ fontSize: 9, textAlign: 'center', color: 'var(--faint)' }}>{shortMonth(d.month).charAt(0)}</span>
        ))}
      </div>
    </Card>
  )
}

// HBar — one labelled horizontal magnitude bar (shared by colours + ratings).
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

function Ratings({ ratings }) {
  const dist = ratings?.dist || [0, 0, 0, 0, 0]
  const total = ratings?.rated || 0
  const max = Math.max(1, ...dist)
  return (
    <Card>
      <SectionHead label="Ratings" right={total ? <span className="mono-label">avg {Number(ratings.avg).toFixed(1)} · {total} rated</span> : null} />
      {total === 0 ? (
        <p className="tp-empty" style={{ padding: '16px 0' }}>no ratings yet</p>
      ) : (
        <div className="space-y-2">
          {[5, 4, 3, 2, 1].map((star) => (
            <HBar
              key={star}
              label={`${star}★`}
              labelWidth={26}
              n={dist[star - 1]}
              max={max}
              fill="var(--amber)"
            />
          ))}
        </div>
      )}
    </Card>
  )
}

// TopList — a ranked leaderboard (identity + magnitude): name, value, accent bar.
function TopList({ label, rows }) {
  const max = Math.max(1, ...(rows || []).map((r) => r.count))
  return (
    <Card>
      <SectionHead label={label} />
      {!rows || rows.length === 0 ? (
        <p className="tp-empty" style={{ padding: '16px 0' }}>nothing yet</p>
      ) : (
        <div className="space-y-3">
          {rows.map((r, i) => (
            <div key={r.name + i} title={`${r.name}: ${r.count}`}>
              <div className="flex items-baseline justify-between gap-2">
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                <span className="mono-label" style={{ flex: '0 0 auto', color: 'var(--accent-ui)' }}>{r.count}</span>
              </div>
              <div style={{ height: 6, background: 'var(--line)', borderRadius: 999, overflow: 'hidden', marginTop: 3 }}>
                <div style={{ height: '100%', width: `${Math.round((100 * r.count) / max)}%`, background: 'var(--accent-ui)', borderRadius: 999 }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

function StatRow({ label, title, count, amber }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <MonoLabel>{label}</MonoLabel>
      <span className="text-right" style={{ fontSize: 14 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>{title || '—'}</span>
        {count != null && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: amber ? 'var(--amber)' : 'var(--accent-ui)' }}>
            {'  ·  '}{count}
          </span>
        )}
      </span>
    </div>
  )
}

function Highlights({ s }) {
  const since = s.first_saved ? new Date(s.first_saved + 'T00:00:00').toLocaleDateString(undefined, { dateStyle: 'medium' }) : null
  return (
    <Card>
      <SectionHead label="Highlights" />
      <div>
        <StatRow label="Most annotated" title={s.most_annotated?.title} count={s.most_annotated?.count} />
        <StatRow label="Most quoted film" title={s.most_quoted?.title} count={s.most_quoted?.count} />
        <StatRow label="Busiest month" title={s.busiest_month ? formatMonth(s.busiest_month.month) : null} count={s.busiest_month ? `${s.busiest_month.count} saved` : null} amber />
        <StatRow label="Collecting since" title={since} />
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
          <ActivityBars data={s.monthly_activity} />
          <div style={twoCol}>
            <Colors colors={s.colors} />
            <Ratings ratings={s.ratings} />
          </div>
          <div style={twoCol}>
            <TopList label="Top authors" rows={s.top_authors} />
            <TopList label="Top tags" rows={s.top_tags} />
          </div>
          <Highlights s={s} />
        </div>
      )}
    </section>
  )
}
