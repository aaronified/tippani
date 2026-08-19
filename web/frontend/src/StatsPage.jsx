import { useEffect, useRef, useState } from 'react'
import { CAT_NAME_MAX, categoryName, categoryVar } from './theme.js'
import { usePractice } from './review.jsx'
import { coverImgURL, json } from './api.js'
import { t, tNodes } from './i18n.js'
import { PersonPortrait, usePeople } from './people.jsx'
import { ANNOTATION_COLORS, ANNOTATION_HEX, Card, FieldIconButton, fmtHalfLife, IconQuiz, MonoLabel, mulberry32, PageHeader, STATUS_META, toast, Toggle, Tooltip, useIsMobileScreen, usePersistedState } from './ui.jsx'

// StatsPage (§ insights) — a dedicated library-analytics screen, the richer
// successor to the old Settings "Library stats" card and the intended basis for
// achievements. All numbers come from one GET /stats call (a handful of
// aggregate queries). Charts stay inside the app's visual system: the activity
// calendar is single-hue sequential (accent mixed over the line colour, GitHub
// style), recall uses the reserved status palette (--ok/--amber/--error) and
// every status count carries its text label so identity is never colour alone.
// Everything named is a doorway: activity dots, breakdown rows, superlative
// tiles and top tags all click through to the Search page (`onSearch`).

// A FUNCTION, so the names resolve at render time. The calendar's x axis takes
// the first three characters of whichever name comes back.
const monthName = (i) => t(`vocab.month.${i + 1}.label`)

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
  const name = monthName(Number(m) - 1)
  return name ? t('stats.month.label', { name, n: y }) : ym
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
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, fontFamily: 'var(--font-mono)', fontStyle: 'var(--font-mono-style)', fontVariantCaps: 'var(--font-mono-caps)', textTransform: 'var(--font-mono-case)', fontVariantNumeric: 'var(--font-mono-figures)', fontSize: 26, fontWeight: 500, lineHeight: 1, color: 'var(--ink)' }}>
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
    [t('stats.overview.books.label'), s.books],
    [t('stats.overview.annotations.label'), s.annotations],
    [t('stats.overview.movies.label'), s.movies],
    [t('stats.overview.dialogues.label'), s.dialogues],
    [t('stats.overview.quotes.label'), s.quotes],
    [t('stats.overview.genres.label'), s.genres],
    [t('stats.overview.tags.label'), s.tags],
  ]
  return (
    <Card>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(118px, 1fr))', gap: 12 }}>
        {tiles.map(([label, n]) => <StatTile key={label} n={n} label={label} />)}
        <StatTile n={s.favorites} label={t('stats.overview.favourites.label')} heart />
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

// dayTitle — what a calendar cell says on hover.
//
// The Saves stream counts things you kept, and the count IS the fact. The two
// review streams count ANSWERS, where the count alone is the less interesting
// half: a day of twelve answers all wrong shades exactly like a day of twelve
// all right, because the fill is volume. So Quiz and Practice days report the
// ratio the server now sends alongside the tally.
//
// `got` is absent on any day the server sent no row for — a quiet day, or the
// whole of a practice history that has been reset (handlePracticeReset deletes
// the rows). Those days say "no answers" rather than "0% correct", which is a
// claim about a session that did not happen.
export function dayTitle(dateLabel, day, noun, accuracy) {
  if (!accuracy) return t('stats.activity.day.saves.tip', { date: dateLabel, n: day.count, count: day.count, noun })
  if (!day.count) return t('stats.activity.day.none.tip', { date: dateLabel })
  const answers = t('stats.activity.day.answers', { count: day.count, n: day.count })
  if (day.got == null) return t('stats.activity.day.tally.tip', { date: dateLabel, answers })
  return t('stats.activity.day.accuracy.tip', {
    date: dateLabel,
    answers,
    percent: Math.round((100 * day.got) / day.count),
  })
}

// ActivityCalendar — a GitHub-style heatmap: one dot per day, one column per
// week (Sunday-first), month names along the x axis. On desktop it fills the
// card width (many months); on a phone it holds a year and scrolls, opened at
// the most recent week. When `onSearch` is given, a day WITH activity is a
// button that opens that day on the Search page (Saves only); otherwise days
// are plain dots with a tooltip.
//
// `accuracy` switches the hover line to the answers-and-accuracy form — see
// dayTitle. It is a property of the STREAM, not of the data, which is why it
// arrives as a flag rather than being sniffed from whether `got` is present:
// a Quiz day with nothing on it must still describe itself as a quiz day.
function ActivityCalendar({ data, noun = 'saved', onSearch, accuracy = false }) {
  const scroller = useRef(null)
  const mobile = useIsMobileScreen()
  const weekCount = useCalendarWeeks(scroller, mobile)

  const byDate = new Map((data || []).map((d) => [d.date, d]))
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
      const rec = byDate.get(localISO(d))
      const count = rec?.count || 0
      max = Math.max(max, count)
      days.push({ count, got: rec?.got, date: new Date(d) })
    }
    const m = ws.getMonth()
    const wi = weeks.length
    let label = ''
    // The leftmost column is a partial month — let it YIELD so the first FULL
    // month (e.g. August) gets the label instead of being crowded out. A label
    // then needs ~3 columns of clearance from the previous one.
    if (m !== prevMonth && wi > 0 && wi - lastLabelAt >= 3) {
      label = monthName(m).slice(0, 3)
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
                  const label = dayTitle(
                    d.date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }),
                    d,
                    noun,
                    accuracy,
                  )
                  const dot = { width: DOT, height: DOT, borderRadius: 999, background: calFill(d.count, max), flex: '0 0 auto' }
                  // A day with activity is a doorway only when onSearch is given
                  // (Saves → that day's additions); quiet days stay plain dots.
                  return onSearch && d.count > 0 ? (
                    <button
                      key={di}
                      type="button"
                      className="cal-dot"
                      title={t('stats.activity.day.search.tip', { label })}
                      aria-label={t('stats.activity.day.search.tip', { label })}
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
        <span className="mono-label" style={{ fontSize: 9, color: 'var(--faint)' }}>{t('stats.activity.legend.less.label')}</span>
        {[0, 1, 2, 3, 4].map((lv) => (
          <span key={lv} aria-hidden="true" style={{ width: DOT, height: DOT, borderRadius: 999, background: lv === 0 ? 'var(--line)' : `color-mix(in srgb, var(--accent-ui) ${CAL_STEPS[lv - 1]}%, var(--line))` }} />
        ))}
        <span className="mono-label" style={{ fontSize: 9, color: 'var(--faint)' }}>{t('stats.activity.legend.more.label')}</span>
      </div>
    </>
  )
}

// ActivityCard — the calendar with a Saves · Quiz · Practice switch above it, so
// the same heatmap shows what you've added, what the Daily Quiz has surfaced,
// and what you've practised. Practice history is resettable here, mirroring the
// Home practice-card reset (DELETE /review/practice).
// `accuracy` marks the two streams whose days are ANSWERS rather than saves, and
// so carry a right/wrong split worth reporting on hover (see dayTitle).
//
// `empty` is what the stream says when it holds nothing. Practice is the only one
// the reader can empty on purpose, and a reset used to leave a full grid of grey
// dots and no word about why — which reads as a chart that failed to load rather
// than as the reset having worked.
const activityStreams = () => [
  { key: 'saves', label: t('stats.activity.saves.label'), noun: t('stats.activity.saves.noun'), clickable: true, accuracy: false, empty: t('stats.activity.saves.empty') },
  { key: 'quiz', label: t('stats.activity.quiz.label'), noun: t('stats.activity.quiz.noun'), clickable: false, accuracy: true, empty: t('stats.activity.quiz.empty') },
  { key: 'practice', label: t('stats.activity.practice.label'), noun: t('stats.activity.practice.noun'), clickable: false, accuracy: true, empty: t('stats.activity.practice.empty') },
]
function ActivityCard({ saves, quiz, practice, onSearch, onResetPractice }) {
  const [stream, setStream] = useState('saves')
  const streams = activityStreams()
  const meta = streams.find((s) => s.key === stream) || streams[0]
  const series = stream === 'quiz' ? quiz : stream === 'practice' ? practice : saves
  const total = (series || []).reduce((n, d) => n + d.count, 0)
  const hasPractice = (practice || []).length > 0
  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <MonoLabel>{t('stats.activity.title', { n: total, noun: meta.noun })}</MonoLabel>
        <div className="flex items-center gap-3">
          {stream === 'practice' && hasPractice && onResetPractice && (
            <button type="button" className="tp-link" onClick={onResetPractice}>{t('stats.activity.practice.reset.label')}</button>
          )}
          <Toggle ariaLabel={t('stats.activity.stream.aria')} value={stream} onChange={setStream} options={streams.map((s) => [s.key, s.label])} />
        </div>
      </div>
      {total === 0 ? (
        <p className="tp-empty" style={{ padding: '16px 0' }}>{meta.empty}</p>
      ) : (
        <ActivityCalendar data={series} noun={meta.noun} accuracy={meta.accuracy} onSearch={meta.clickable ? onSearch : undefined} />
      )}
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
      <SectionHead
        label={t('stats.memory.title')}
        right={<span className="mono-label">{t('stats.memory.rotation.label', { done: recall.reviewed, total: st.total })}</span>}
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(148px, 1fr))', gap: 12 }}>
        {tiles.map(([key, n]) => (
          <StatTile key={key} n={n} label={t(STATUS_META[key].label)} dot={STATUS_META[key]} />
        ))}
        {recall.reviewed > 0 && <StatTile n={fmtHalfLife(recall.avg_half_life)} label={t('stats.memory.half-life.label')} />}
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
  { key: 'authors', get label() { return t('stats.breakdown.authors.label') }, works: true, person: 'author' },
  { key: 'books', get label() { return t('stats.breakdown.books.label') }, works: false, art: true },
  { key: 'series', get label() { return t('stats.breakdown.series.label') }, works: true },
  { key: 'films', get label() { return t('stats.breakdown.films.label') }, works: false, art: true },
  { key: 'shows', get label() { return t('stats.breakdown.shows.label') }, works: false, art: true },
  { key: 'directors', get label() { return t('stats.breakdown.directors.label') }, works: true, person: 'director' },
  { key: 'actors', get label() { return t('stats.breakdown.actors.label') }, works: true, person: 'actor' },
  // A speaker spans occasions the way an author spans books, so `works` is on.
  // The portrait comes from the People console like every other person kind.
  { key: 'speakers', get label() { return t('stats.breakdown.speakers.label') }, works: true, person: 'speaker' },
  // Everyone, whatever they were credited as. 0027 made a person's NAME their
  // identity and their roles a set, exactly because a speaker is so often
  // already an author — but the breakdowns still asked the question four times,
  // so somebody with a book and a film was two half-people in two sections.
  // This is the section that answers "who do I quote", which is the question
  // the other four are each a fragment of.
  { key: 'people', get label() { return t('stats.breakdown.people.label') }, works: true, person: 'any' },
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
  const statusText = ([key, n]) => t('stats.breakdown.status.label', { n, name: t(STATUS_META[key].label).toLowerCase() })
  const barTip = segs.map(statusText).join(' · ')
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
          <Tooltip label={t('stats.breakdown.name.tip')} side="bottom" className="min-w-0">
            <button
              type="button"
              className="truncate text-left"
              style={{ fontFamily: 'var(--font-display)', fontStyle: 'var(--font-display-style)', fontVariantCaps: 'var(--font-display-caps)', textTransform: 'var(--font-display-case)', fontVariantNumeric: 'var(--font-display-figures)', fontWeight: 600, fontSize: 14, background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit' }}
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
          {showWorks ? t('stats.breakdown.works', { count: r.works, n: r.works }) : ''}
          {showWorks && segs.length > 0 ? ' · ' : ''}
          {segs.map(statusText).join(' · ')}
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
        <MonoLabel>{t('stats.breakdown.title', { n: k.count })}</MonoLabel>
        <select
          className="tp-input"
          aria-label={t('stats.breakdown.kind.aria')}
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          style={{ maxWidth: 140, paddingTop: 5, paddingBottom: 5, fontSize: 13 }}
        >
          {BREAKDOWN_KINDS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
        </select>
      </div>
      {(k.most_remembered || k.most_forgotten) && (
        <p className="microcopy mb-3" style={{ lineHeight: 1.6 }}>
          {k.most_remembered &&
            tNodes('stats.breakdown.best.label', {
              name: <strong key="name">{k.most_remembered.name}</strong>,
              n: k.most_remembered.remembered,
            })}
          {k.most_remembered && k.most_forgotten && <br />}
          {k.most_forgotten &&
            tNodes('stats.breakdown.worst.label', {
              name: <strong key="name">{k.most_forgotten.name}</strong>,
              n: k.most_forgotten.probably_forgotten,
            })}
        </p>
      )}
      {!k.top || k.top.length === 0 ? (
        <p className="tp-empty" style={{ padding: '16px 0' }}>{t('stats.list.empty')}</p>
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
function HBar({ swatch, label, labelWidth, n, max, fill, onPractise }) {
  return (
    <div className="flex items-center gap-2" title={t('stats.bar.tip', { name: label, n })}>
      {swatch}
      {/* The bar is a magnitude, not a control — so the doorway is a separate
          button at the end of the row rather than the row itself. A chart you
          can accidentally start a quiz round by brushing against is a chart
          nobody trusts to hold still. */}
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
      {onPractise && (
        <FieldIconButton
          icon={<IconQuiz />}
          ariaLabel={t('stats.bar.practise.aria', { name: label })}
          onClick={onPractise}
          tooltip={t('stats.bar.practise.tip', { name: label })}
        />
      )}
    </div>
  )
}

function Colors({ colors }) {
  const rows = hlRows()
  // THE FOURTH THEME, and the one with no page of its own. A book has a tile, a
  // tag has a card, a person has a panel; a colour category is only ever a
  // filter chip — except here, where it is a named row with a count beside it.
  // So this is where "quiz me on the ones I marked Disagreed" belongs.
  const { practise, practiceDialog } = usePractice()
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
      <SectionHead
        label={t('stats.colours.title')}
        right={<span className="mono-label">{t('stats.colours.counts.label', { n: total })}</span>}
      />
      {total === 0 ? (
        <p className="tp-empty" style={{ padding: '16px 0' }}>{t('stats.colours.empty')}</p>
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
              onPractise={(colors?.[k] || 0) > 0 ? () => practise({ color: k, label }) : undefined}
              swatch={<span style={{ width: 12, height: 12, borderRadius: 999, background: fill, border: '1px solid rgba(41,38,29,.35)', flex: '0 0 auto' }} />}
            />
          ))}
        </div>
      )}
      {practiceDialog}
    </Card>
  )
}

// LeaderList — ranked rows (rank · name · value · accent bar) used by Top
// tags: ~5 rows tall, the rest scrolls (the server sends up to 50). Names
// click through to Search.
function LeaderList({ rows, onSearch }) {
  if (!rows || rows.length === 0) return <p className="tp-empty" style={{ padding: '16px 0' }}>{t('stats.list.empty')}</p>
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
              <Tooltip label={t('stats.tag.tip')} side="bottom" className="min-w-0">
                <button
                  type="button"
                  className="truncate text-left"
                  style={{ fontFamily: 'var(--font-display)', fontStyle: 'var(--font-display-style)', fontVariantCaps: 'var(--font-display-caps)', textTransform: 'var(--font-display-case)', fontVariantNumeric: 'var(--font-display-figures)', fontWeight: 600, fontSize: 14, background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit' }}
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
  return t(start < 0 ? 'common.year.decade.bce.label' : 'common.year.decade.label', { year: Math.abs(start) })
}

// yearLabel writes a single year: "1994", "380 BCE".
export function yearLabel(start) {
  return t(start < 0 ? 'common.year.bce.label' : 'common.year.ce.label', { year: Math.abs(start) })
}

// bucketLabel names a timeline bucket AT ITS OWN SCALE, which is the part the
// chart had wrong. decadeLabel was labelling all three scales, so switching to
// Years drew a tick reading "1994s" under every column — a decade that does not
// exist, on the axis whose whole job is to say when.
//
// Centuries keep the decade's form ("1900s" for 1900–1999). It is conventional
// English for a century, the scale selector sits directly above the chart saying
// "Centuries", and the tooltip on every column gives the span in full. What it is
// NOT is precise enough to hand to a search — see bucketQuery.
export function bucketLabel(start, size) {
  return size === 1 ? yearLabel(start) : decadeLabel(start)
}

// bucketQuery is the search this bucket can be clicked through to, or null when
// there is no honest one. The chart offers the click exactly where this answers.
//
// Only a decade has one. The reason is worth writing down, because "make them all
// clickable" is the obvious wrong answer:
//
//   - A DECADE is exact. The server has understood "1990s" since the decade facet
//     shipped, and it answers with the works published or released in those ten
//     years — precisely the column that was clicked.
//   - A YEAR cannot go through the query box. "1984" is a book people own, and
//     teaching search to read a bare four-digit number as a year would take that
//     search away to give this click. The click is worth less than the search.
//   - A CENTURY would be answered WRONG rather than not at all: "1900s" parses as
//     the decade, so clicking a column covering 1900–1999 would return the ten
//     years 1900–1909 and look like a complete answer. A wrong result is worse
//     than a dead control, because nothing tells you it is wrong.
export function bucketQuery(start, size) {
  if (size !== 10) return null
  // BCE keeps the spoken form: the era in the query is what stops the server
  // reading "80s" as a shorthand, so "80s BCE" is already unambiguous.
  if (start < 0) return decadeLabel(start)
  // ZERO-PADDED, and this is the whole reason the query is not just the label.
  // "90s" is shorthand for the 1990s to anyone typing it, and the server honours
  // that — so a column for the 50s CE, which a library holding a gospel really
  // has, would link to the 1950s and return a page of confident, wrong results.
  // Four digits cannot be a shorthand. The facet still reports itself as "50s",
  // because the server labels the range rather than echoing the query.
  return `${String(start).padStart(4, '0')}s`
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
  { key: 'decade', get label() { return t('stats.timeline.decade.label') }, size: 10 },
  { key: 'century', get label() { return t('stats.timeline.century.label') }, size: 100 },
  { key: 'year', get label() { return t('stats.timeline.year.label') }, size: 1 },
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

// ---- the long empty stretches ---------------------------------------------
//
// The gaps were already the point: 0024's chart draws every empty bucket so that
// 380 BCE and 1600 CE read as two millennia apart rather than as two adjacent
// bars. What it did not do was make them WORTH the width. A library holding
// Meditations and then a shelf of 2020 paperbacks draws about a hundred and
// eighty identical blank columns, and a hundred and eighty blank columns is not a
// silence you read — it is a stretch of nothing you scroll past looking for the
// next dot, and it teaches you to skip the axis.
//
// So an empty run long enough to bother with becomes ONE element, keeping exactly
// the width the columns it replaces would have had (the gap stays as wide as it
// was long — that rule is the whole reason empties are drawn), and carrying two
// things a blank cannot: the years going by, and a line about the fact that
// nothing in all of that is on your shelf.
//
// TIMELINE_GAP_MIN is the shortest run worth folding. Below it the blanks read
// perfectly well as blanks, and a caption in a four-column gap would be a caption
// squeezed into a space too small for it — which is worse than the space.
export const TIMELINE_GAP_MIN = 6
// The closest two year markers may ever be, in buckets. "Occasional" is the
// requirement: a marker every ten decades in a gap of a hundred and eighty is
// eighteen labels, which is an axis, not a signpost.
export const TIMELINE_MARKER_MIN = 10
// And how many a gap may carry however long it is. Past four or five the markers
// stop being landmarks and start being the thing you are reading.
export const TIMELINE_MARKER_MAX = 5

// timelineSegments folds the runs of empty buckets, returning what to DRAW:
// either a bucket (one column) or a gap standing in for `span` of them.
//
// It is a pure function over the bucket list on purpose. Where the gaps fall is a
// property of the library at a given scale — switch decades to centuries and a
// hundred and eighty empties become eighteen, which is under the threshold and
// draws as plain columns again. That is the correct behaviour and it is worth
// being able to assert without rendering a chart.
export function timelineSegments(buckets, minGap = TIMELINE_GAP_MIN) {
  const out = []
  let run = []
  const flush = () => {
    if (run.length === 0) return
    // A short run is not a gap. It is some empty columns, and it already reads
    // like some empty columns.
    if (run.length < minGap) out.push(...run.map((b) => ({ type: 'bucket', bucket: b })))
    else out.push({ type: 'gap', span: run.length, start: run[0].start, end: run[run.length - 1].start })
    run = []
  }
  for (const b of buckets || []) {
    if ((b.works || 0) === 0 && (b.quotes || 0) === 0) run.push(b)
    else {
      flush()
      out.push({ type: 'bucket', bucket: b })
    }
  }
  flush()
  return out
}

// gapMarkers picks the years to label inside a gap: never closer together than
// TIMELINE_MARKER_MIN buckets, never more than TIMELINE_MARKER_MAX of them, and
// never on the very first or last bucket of the run — a marker hard against the
// column beside it reads as that column's own label, which is the one thing a
// marker in here must not do.
export function gapMarkers(gap, size, { minStep = TIMELINE_MARKER_MIN, max = TIMELINE_MARKER_MAX } = {}) {
  if (!gap || gap.span < minStep * 2) return []
  // Enough steps to stay under `max`, and at least the minimum. Both bounds bind
  // at different gap lengths, which is why it is a max of the two rather than one
  // rule with the other as a comment.
  const step = Math.max(minStep, Math.ceil(gap.span / (max + 1)))
  const out = []
  for (let i = step; i < gap.span - 1; i += step) {
    out.push({ offset: i, start: gap.start + i * size })
  }
  return out
}

// The lines. Sorted by length because that is how they are chosen: the widest one
// that fits, so a two-century gap gets a sentence and a sixty-year one gets three
// words rather than an ellipsis.
//
// UNATTRIBUTED, and written for the app rather than borrowed. A chart that put a
// famous name under a witticism in an app whose entire subject is quoting people
// accurately would be the one place in it inventing an attribution — and there is
// no field here to record a source in even if it were real.
// THE CAPTIONS, IN LENGTH BANDS OF THREE OR MORE.
//
// A caption is chosen by how much room the slot has, so the pool has to be deep at
// every WIDTH rather than deep overall. It was twelve lines sorted by length, which
// looks like plenty until you notice the picker takes the longest few that fit: a
// chart of narrow gaps had two candidates to choose between and printed the same
// sentence beside itself, and the widest band had four while the middle had two.
//
// Four bands, four lines each, so every width has real variety — and the picker
// below draws WITHOUT REPLACEMENT, so a band is exhausted before anything repeats.
// A FUNCTION rather than a table, so the four bands are read at render time. The
// pool is indexed prose, exactly as greetings.js is: the number in the key IS the
// line's identity, and another language may write its own rather than translate.
export const timelineGapBands = () => [1, 2, 3, 4].map((band) => [1, 2, 3, 4].map((i) => t(`stats.timeline.gap.${band}.${i}`)))

// Flattened and sorted, for the callers that only want "the lines" — the width
// test and anything measuring the pool.
export const timelineGapLines = () => timelineGapBands().flat().sort((a, b) => a.length - b.length)

// GAP_CHAR_PX — how wide a character of the caption runs at its size, near enough.
// Measuring would mean a ResizeObserver per gap for a decision that only has to be
// right enough to keep a sentence off two lines, and the chart's whole width story
// is CSS for exactly that reason.
const GAP_CHAR_PX = 6.1

// gapLine picks a line for a gap: the longest that fits the width, chosen from the
// seed so that the same gap keeps the same line across re-renders and two gaps on
// one chart do not say the same thing. Returns '' when nothing fits, and the gap
// draws as bare width — which is honest, and better than a clipped sentence.
// makeGapPicker — one draw-without-replacement bag per length band, for one
// render of one chart.
//
// THE RULE IS "NO REPEAT UNTIL THE BAND IS USED UP". Choosing at random each time
// is not that: with four lines in a band, an independent draw repeats within three
// picks about half the time, which on a chart of several gaps reads as the app
// having one joke. So each band is shuffled once and consumed in order, and only
// refilled when it runs out.
//
// The bag lives for a render rather than for the app, because the alternative is
// state that makes the same chart draw differently on a re-render for no reason
// the reader can see. Seeded, so it does not.
export function makeGapPicker(seed = 1, bands = timelineGapBands()) {
  const rng = mulberry32(seed >>> 0)
  const bags = bands.map(() => [])
  const refill = (i) => {
    const deck = bands[i].slice()
    // Fisher-Yates against the seeded rng, so the order is stable per chart.
    for (let j = deck.length - 1; j > 0; j--) {
      const k = Math.floor(rng() * (j + 1))
      ;[deck[j], deck[k]] = [deck[k], deck[j]]
    }
    bags[i] = deck
  }
  return {
    // The widest band whose lines all fit the room, so a slot gets the longest
    // copy it can hold rather than the longest single line that happens to fit.
    pick(room, avoid) {
      for (let i = bands.length - 1; i >= 0; i--) {
        if (bands[i].some((l) => l.length * GAP_CHAR_PX > room)) continue
        if (bags[i].length === 0) refill(i)
        let out = bags[i].pop()
        // Only inside one gap: two slots side by side saying the same thing is
        // the one repeat that is unmistakable.
        if (avoid && avoid.has(out) && bags[i].length > 0) {
          const alt = bags[i].pop()
          bags[i].unshift(out)
          out = alt
        }
        return out || ''
      }
      return ''
    },
  }
}

export function gapLine(gap, widthPx, lines = timelineGapLines()) {
  // Two lines of caption, minus the padding either side. Two rather than one
  // because a gap wide enough for a sentence is usually not wide enough for it in
  // a single run, and a caption is allowed to wrap where a year label is not.
  const room = Math.max(0, (widthPx - 24) * 2)
  const fits = lines.filter((l) => l.length * GAP_CHAR_PX <= room)
  if (fits.length === 0) return ''
  // Among the longest few rather than always the single longest, so a chart with
  // three wide gaps does not print the same sentence three times.
  const band = fits.slice(Math.max(0, fits.length - 3))
  const rng = mulberry32((gap.start >>> 0) ^ (gap.span * 2654435761))
  return band[Math.floor(rng() * band.length) % band.length]
}

// GAP_LINE_MAX_PX — how wide one caption is allowed to run before a second one is
// the better answer.
//
// ONE LINE CANNOT COVER AN ARBITRARILY WIDE GAP. A two-millennium stretch is over a
// thousand pixels of emptiness, and the longest line here is about 120 characters —
// so the caption sat as a small island in the middle with a great deal of nothing
// either side, which reads as a rendering failure rather than as a silence. The gap
// keeps its true width on purpose (that is the whole point of not collapsing it), so
// the copy has to scale to the width instead.
//
// 360px is roughly a comfortable measure for a line of this size — about ten columns
// of the chart. Past that a reader is tracking a sentence across a distance that a
// second sentence would fill better.
const GAP_LINE_MAX_PX = 360
// Three at most. A gap carrying four captions is a paragraph in a chart, and the
// markers still have to be readable between them.
const GAP_LINE_SLOTS_MAX = 3

// gapLines picks one caption per slot for a gap, left to right.
//
// Distinct from each other, because the same sentence printed twice inside one gap
// is worse than one sentence with space around it. Seeded from the gap the way
// gapLine is, so a gap keeps its set across re-renders, and each slot is sized to
// its own share of the width rather than to the whole — a narrow slot gets three
// words where a wide one gets a sentence.
//
// Returns [] when nothing fits even once, and the gap draws as bare width. That is
// honest, and better than a clipped sentence.
export function gapLines(gap, widthPx, bag = makeGapPicker(gap?.start ?? 1)) {
  const slots = Math.max(1, Math.min(GAP_LINE_SLOTS_MAX, Math.floor(widthPx / GAP_LINE_MAX_PX)))
  if (slots === 1) {
    const one = bag.pick(Math.max(0, (widthPx - 24) * 2))
    return one ? [one] : []
  }
  const share = widthPx / slots
  const room = Math.max(0, (share - 24) * 2)
  const out = []
  const used = new Set()
  for (let i = 0; i < slots; i++) {
    const pick = bag.pick(room, used)
    if (!pick) break
    used.add(pick)
    out.push(pick)
  }
  return out
}

// TL_COL_PX / TL_GAP_PX mirror .tl-col's min-width and .tl-row's gap. Duplicated
// from the stylesheet on purpose and named so the duplication is findable: a gap
// standing in for N columns has to be as wide as N columns, and CSS cannot do that
// arithmetic without knowing N, which only JS knows.
// Exported so timeline-metrics.test.js can hold them against the stylesheet.
// Duplication that nothing checks is duplication that drifts, and the drift here
// is silent: the gap keeps being drawn, just at the wrong width, and the chart
// starts lying about time without anything looking broken.
export const TL_COL_PX = 30
export const TL_GAP_PX = 4
export const gapWidth = (span) => span * (TL_COL_PX + TL_GAP_PX) - TL_GAP_PX

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

// Exported for the same reason as TL_COL_PX: the number is only true if the CSS
// gives .tl-plot enough room for that many dots, and nothing but a test can say so.
export const TIMELINE_MAX_DOTS = 12

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
function TimelineCard({ timeline, onSearch }) {
  const [scale, setScale] = usePersistedState('tippani:stats:timelineScale', 'decade')
  const meta = TIMELINE_SCALES.find((x) => x.key === scale) || TIMELINE_SCALES[0]
  const buckets = bucketTimeline(timeline, meta.size)
  const unit = dotUnit(buckets)
  const segments = timelineSegments(buckets)
  // ONE BAG FOR THE WHOLE CHART. Per-gap bags would let two gaps draw the same
  // line, which is the repeat a reader actually notices. Seeded from the scale so
  // a re-render redraws the same chart rather than reshuffling under the pointer.
  const bag = makeGapPicker(buckets.length * 2654435761 + meta.size)
  if (!timeline || timeline.length === 0) {
    return (
      <Card>
        <SectionHead label={t('stats.timeline.title')} />
        <p style={{ color: 'var(--soft)', fontSize: 13 }}>
          Nothing here yet — a book or film needs a year on it to have a place in time.
        </p>
      </Card>
    )
  }
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-3">
        <MonoLabel>{t('stats.timeline.counts.title', { n: buckets.length })}</MonoLabel>
        <select className="tp-input" aria-label={t('stats.timeline.scale.aria')} value={scale} onChange={(e) => setScale(e.target.value)} style={{ width: 'auto' }}>
          {TIMELINE_SCALES.map((x) => (
            <option key={x.key} value={x.key}>{x.label}</option>
          ))}
        </select>
      </div>
      <div className="tl-scroll">
        <div className="tl-row">
          {segments.map((seg) =>
            seg.type === 'gap' ? (
              <TimelineGap key={`gap${seg.start}`} gap={seg} size={meta.size} bag={bag} />
            ) : (
              (() => {
                const b = seg.bucket
                const total = b.works + b.quotes
                const label = bucketLabel(b.start, meta.size)
                const reading = t('stats.timeline.column.tip', { label, a: b.works, b: b.quotes })
                // The tick is the doorway, and only when there is something to
                // walk through to: a bucket with an exact search (bucketQuery) and
                // something in it. An empty column has nothing to show and would
                // send you to a page reading "no results" — which is a true answer
                // to a question nobody asked.
                const query = total > 0 ? bucketQuery(b.start, meta.size) : null
                const tick = query && onSearch ? (
                  <button
                    type="button"
                    className="tl-tick tl-tick-link"
                    title={`${label} — view in search`}
                    aria-label={`${label} — view in search`}
                    onClick={() => onSearch(query)}
                  >
                    {label}
                  </button>
                ) : (
                  <div className="tl-tick">{total ? label : ''}</div>
                )
                return (
                  <Tooltip key={b.start} label={reading} side="top">
                    {/* Two columns from one floor. An empty bucket draws no dots
                        at all, which is what a gap in time looks like — and it
                        keeps its width, so the gap is as wide as it was long. */}
                    <div className="tl-col" aria-label={reading}>
                      <div className="tl-plot">
                        <DotStack n={dotCount(b.quotes, unit)} kind="quotes" />
                        <DotStack n={dotCount(b.works, unit)} kind="works" />
                      </div>
                      {tick}
                    </div>
                  </Tooltip>
                )
              })()
            ),
          )}
        </div>
      </div>
      {/* Two series, so a legend is not optional — identity must never be
          carried by colour alone. The unit line only appears when a dot is worth
          more than one thing; on a small library every dot is one thing and
          saying so would be noise. */}
      <div className="mt-2 flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
        <TimelineKey kind="quotes" label={t('stats.timeline.key.quotes.label')} />
        <TimelineKey kind="works" label={t('stats.timeline.key.works.label')} />
        {unit > 1 && (
          <span className="mono-label" style={{ fontSize: 9, color: 'var(--faint)' }}>1 dot ≈ {unit}</span>
        )}
      </div>
    </Card>
  )
}

// TimelineGap — a run of empty buckets, standing in for all of them at exactly
// the width they would have had.
//
// The width is the load-bearing part. Fold the run to a fixed band and the chart
// starts lying about time — two millennia and two centuries would draw the same,
// which is the failure the empty buckets were introduced to prevent. So this is a
// COMPRESSION OF THE DRAWING, not of the scale.
//
// What it adds is what a blank could not carry: the years going past, so the eye
// has something to measure the distance against, and one line about the fact that
// nothing in all of it is on your shelf.
function TimelineGap({ gap, size, bag }) {
  const width = gapWidth(gap.span)
  const markers = gapMarkers(gap, size)
  const lines = gapLines(gap, width, bag)
  const from = bucketLabel(gap.start, size)
  const to = bucketLabel(gap.end, size)
  const reading = t('stats.timeline.gap.aria', { a: from, b: to })
  return (
    <div className="tl-gap" style={{ width }} aria-label={reading}>
      {/* The markers ride on the plot area rather than on the tick row, so they
          read as landmarks INSIDE the emptiness rather than as an axis under it —
          which is what would make them look like the labels of the columns
          either side. */}
      <div className="tl-gap-plot">
        {markers.map((m) => (
          <span key={m.offset} className="tl-gap-mark" style={{ left: `${(m.offset / gap.span) * 100}%` }}>
            {bucketLabel(m.start, size)}
          </span>
        ))}
        {/* One caption per slot, spread across the emptiness. A single line cannot
            cover a two-millennium gap — it sits as a small island with a great deal
            of nothing either side, which reads as a rendering failure rather than as
            a silence. The gap keeps its true width by design, so the copy scales to
            the width instead of the width shrinking to the copy. */}
        {lines.length > 0 && (
          <div className="tl-gap-lines">
            {lines.map((l) => (
              <p key={l} className="tl-gap-line">{l}</p>
            ))}
          </div>
        )}
      </div>
      <div className="tl-tick tl-gap-tick">{t('stats.timeline.gap.tick.label', { a: from, b: to })}</div>
    </div>
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
              <Tooltip label={t('stats.super.title.tip')} side="top" className="min-w-0">
                <button
                  type="button"
                  className="truncate text-left"
                  style={{ fontFamily: 'var(--font-display)', fontStyle: 'var(--font-display-style)', fontVariantCaps: 'var(--font-display-caps)', textTransform: 'var(--font-display-case)', fontVariantNumeric: 'var(--font-display-figures)', fontWeight: 600, fontSize: 15, lineHeight: 1.3, background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit' }}
                  onClick={onOpen}
                >
                  {title}
                </button>
              </Tooltip>
            ) : (
              <span
                title={title || undefined}
                style={{ fontFamily: 'var(--font-display)', fontStyle: 'var(--font-display-style)', fontVariantCaps: 'var(--font-display-caps)', textTransform: 'var(--font-display-case)', fontVariantNumeric: 'var(--font-display-figures)', fontWeight: 600, fontSize: 15, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {title || '—'}
              </span>
            )}
            {count != null && (
              <span style={{ flex: '0 0 auto', fontFamily: 'var(--font-mono)', fontWeight: 'var(--font-mono-weight)', fontStyle: 'var(--font-mono-style)', fontVariantCaps: 'var(--font-mono-caps)', textTransform: 'var(--font-mono-case)', fontVariantNumeric: 'var(--font-mono-figures)', fontSize: 12, color: amber ? 'var(--amber)' : 'var(--accent-ui)' }}>
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
      <SectionHead label={t('stats.super.title')} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
        <SuperTile label={t('stats.super.most-annotated.label')} title={s.most_annotated?.title} count={s.most_annotated?.count} cover={s.most_annotated?.cover_path} onOpen={open(s.most_annotated?.title)} />
        <SuperTile label={t('stats.super.most-quoted-work.label')} title={s.most_quoted?.title} count={s.most_quoted?.count} cover={s.most_quoted?.cover_path} onOpen={open(s.most_quoted?.title)} />
        <SuperTile label={t('stats.super.most-quoted-person.label')} title={topPerson?.name} count={topPerson?.quotes} person={face(topPerson?.name)} onOpen={open(topPerson?.name)} />
        <SuperTile label={t('stats.super.most-favourited-person.label')} title={s.favourite_person?.title} count={s.favourite_person?.count} person={face(s.favourite_person?.title)} onOpen={open(s.favourite_person?.title)} />
        {/* The one superlative that never opened, though the server has answered
            "1990s" since the decade facet shipped. Every other tile here is a
            doorway; this one named a decade and did nothing with it.
            It searches bucketQuery rather than its own label, for the shorthand
            reason written there — the tile shows "50s" and asks for "0050s". */}
        <SuperTile label={t('stats.super.most-quoted-decade.label')} title={decade?.label} count={decade ? t('stats.super.quotes.label', { n: decade.quotes }) : null} amber onOpen={decade && onSearch ? () => onSearch(bucketQuery(decade.start, 10)) : undefined} />
        <SuperTile label={t('stats.super.busiest-month.label')} title={s.busiest_month ? formatMonth(s.busiest_month.month) : null} count={s.busiest_month ? t('stats.super.saved.label', { n: s.busiest_month.count }) : null} amber />
        <SuperTile label={t('stats.super.best-remembered.label')} title={remembered?.name} count={remembered ? t('stats.super.of.label', { done: remembered.remembered, total: remembered.quotes }) : null} person={face(remembered?.name)} onOpen={open(remembered?.name)} />
        <SuperTile label={t('stats.super.most-forgotten.label')} title={forgotten?.name} count={forgotten ? t('stats.super.of.label', { done: forgotten.probably_forgotten, total: forgotten.quotes }) : null} person={face(forgotten?.name)} onOpen={open(forgotten?.name)} />
        <SuperTile label={t('stats.super.since.label')} title={since} />
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
    if (r.ok) { toast(t('stats.toast.practice-reset')); loadStats() }
    else toast(t('error.reset.practice'))
  }
  const twoCol = { display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: 24 }
  return (
    <section className="space-y-6">
      <div className={mobile ? 'mobile-sticky-bar' : ''}>
        <PageHeader
          title={t('nav.tab.stats.label')}
          counts={s ? t('stats.header.counts', { n: (s.annotations || 0) + (s.dialogues || 0) + (s.quotes || 0) }) : ''}
        />
      </div>
      {!s ? (
        <Card><p className="tp-empty" style={{ padding: '32px 0' }}>{t('common.action.load.busy')}</p></Card>
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
          <TimelineCard timeline={s.timeline} onSearch={onSearch} />
          <div style={twoCol}>
            <BreakdownCard breakdown={s.breakdown} personMaps={personMaps} onSearch={onSearch} />
            <div className="space-y-6">
              <Colors colors={s.colors} />
              <TopList label={t('stats.top-tags.title')} rows={s.top_tags} onSearch={onSearch} />
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
