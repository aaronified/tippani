// works.jsx — shared building blocks for "works" (books + films/shows), the two
// halves of the catalogue that render in parallel across the Library, Movies,
// Search and Metadata screens. Kept in their own module so both sides compose
// the same pieces instead of re-deriving them (and to avoid a ui ↔ people
// import cycle — this layer is free to import from both).
import { coverImgURL } from './api.js'
import { CreditFaces, splitCredits } from './people.jsx'
import { ExpandableDescription, FavBadge, HandCard, Hearts, IconBack, MonoLabel, Placeholder, seriesLabel } from './ui.jsx'

// decadeOf floors a year to its decade using the full 4-digit year, so old
// works land in the right century (1850 → 1850s, distinct from 1950s).
export function decadeOf(year) {
  if (!year) return null
  return Math.floor(year / 10) * 10
}

// groupWorks buckets an (already filtered + sorted) list into labelled groups
// for a "group by" view — the one bucketing used by both the Library group-by
// and the Search grouped results. Order: series/credit alphabetical, decade
// newest first, genre by size; the catch-all bucket (no series/credit/year/
// genre) always sinks to the end. A work with several credits or genres appears
// in each. Members keep the incoming order unless `sortMembers` reorders them.
//
// `dim` is 'series' | 'author' | 'decade' | 'genre' ('author' means the primary
// credit — authors for books, directors/creators for films). Accessors keep the
// util blind to the two data shapes:
//   credit(item)  → the credit string           (default '')
//   year(item)    → a 4-digit year              (default null)
//   genres(item)  → string[]                    (default [])
//   series(item)  → the series name             (default item.series)
// Options: splitCredit (split the credit into co-credits, books), seps (the
// separator set for that split), creditResidual (label for the no-credit
// bucket), sortMembers(members, dim) → members.
export function groupWorks(list, dim, opts = {}) {
  const {
    credit = () => '',
    year = () => null,
    genres = () => [],
    series = (it) => it.series,
    splitCredit = false,
    seps,
    creditResidual = 'Unknown',
    sortMembers,
  } = opts
  const map = new Map()
  const add = (key, label, it, o = {}) => {
    let g = map.get(key)
    if (!g) {
      g = { key, label, items: [], residual: !!o.residual, order: o.order }
      map.set(key, g)
    }
    g.items.push(it)
  }
  for (const it of list) {
    if (dim === 'series') {
      const s = series(it)
      if (s) add(s, s, it)
      else add('~none', 'No series', it, { residual: true })
    } else if (dim === 'author') {
      const c = credit(it)
      const names = splitCredit ? splitCredits(c, seps) : c ? [c] : []
      if (names.length) names.forEach((n) => add(n, n, it))
      else add('~none', creditResidual, it, { residual: true })
    } else if (dim === 'decade') {
      const d = decadeOf(year(it))
      if (d != null) add(String(d), `${d}s`, it, { order: d })
      else add('~none', 'Unknown year', it, { residual: true })
    } else if (dim === 'genre') {
      const gs = genres(it)
      if (gs.length) gs.forEach((g) => add(g, g, it))
      else add('~none', 'No genre', it, { residual: true })
    }
  }
  const out = [...map.values()]
  out.sort((a, b) => {
    if (a.residual !== b.residual) return a.residual ? 1 : -1
    if (dim === 'decade') return (b.order ?? 0) - (a.order ?? 0)
    if (dim === 'genre') return b.items.length - a.items.length || a.label.localeCompare(b.label)
    return a.label.localeCompare(b.label)
  })
  if (sortMembers) for (const g of out) if (!g.residual) g.items = sortMembers(g.items, dim)
  return out
}

// WorkCard — one catalogue tile for a book or a film/show: cover/poster (2:3)
// with the favourite badge, title, a credit face-chip + line, an optional
// series line, and a count. `kind` ('book' | 'movie') selects the book's
// hand-drawn card frame + "quotes" vs the film's plain poster + "dialogues".
// The book grid (Library) and poster grid (Movies) both deal these; each keeps
// its own <ul>/grid wrapper and gap, sharing only the tile.
export function WorkCard({ kind, item, index = 0, onOpen, people = {}, seps }) {
  const isBook = kind === 'book'
  const isShow = !isBook && (item.media_type || 'movie') === 'show'
  const credit = isBook ? item.author : item.director
  const coverPath = isBook ? item.cover_path : item.poster_path
  const year = isBook ? item.published_year : item.release_year
  const count = isBook ? item.annotation_count || 0 : item.dialogue_count || 0
  const image = coverPath ? (
    <img
      src={coverImgURL(coverPath)}
      alt={`${isBook ? 'Cover' : 'Poster'} of ${item.title}`}
      className="block aspect-[2/3] w-full object-cover"
      style={isBook ? undefined : { border: '1px solid var(--line)', borderRadius: 8 }}
    />
  ) : (
    <Placeholder kind={isBook ? 'COVER' : 'POSTER'} className={isBook ? 'w-full rounded-none border-0' : 'w-full'} />
  )
  return (
    <button type="button" onClick={() => onOpen(item.id)} className="cover-tile block w-full text-left" title={item.title}>
      {isBook ? (
        <HandCard variant={index % 4} className="relative overflow-hidden cover-lift">
          {image}
          {item.favorite && <FavBadge />}
        </HandCard>
      ) : (
        <div className="relative cover-lift">
          {image}
          {isShow && (
            <span
              className="tp-chip absolute left-1.5 top-1.5"
              style={{ fontSize: 9.5, background: 'rgba(21,16,12,.72)', color: '#fff', borderColor: 'transparent' }}
            >
              SERIES
            </span>
          )}
          {item.favorite && <FavBadge />}
        </div>
      )}
      <p className="mt-2.5 truncate" style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15.5, color: 'var(--ink)' }}>
        {item.title}
      </p>
      <div className="flex items-center gap-1.5">
        {/* Credit face(s): authors / directors, co-credits overlapping (first on top). */}
        <CreditFaces names={splitCredits(credit, seps)} map={people} size={24} ring="var(--bg)" />
        <p className="min-w-0 truncate text-[13px]" style={{ color: 'var(--soft)' }}>
          {[credit, year || null].filter(Boolean).join(' · ') || ' '}
        </p>
      </div>
      {item.series && (
        <p className="truncate text-[12px]" style={{ color: 'var(--faint)', fontStyle: 'italic' }}>
          {seriesLabel(item)}
        </p>
      )}
      <div className="mt-0.5 flex items-center gap-2">
        {isBook ? (
          <MonoLabel style={{ color: 'var(--accent-ui)' }}>{`${count} quote${count === 1 ? '' : 's'}`}</MonoLabel>
        ) : (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--amber)' }}>
            {count} dialogue{count === 1 ? '' : 's'}
          </span>
        )}
      </div>
    </button>
  )
}

// MobileDetailBar — the sticky top bar on a book/film detail on mobile: a round
// back button, the title + a meta subtitle, and a caller-supplied actions
// cluster (filter / add / overflow — these differ per detail). Shared so the
// bar structure lives in one place.
export function MobileDetailBar({ onClose, title, meta, actions }) {
  return (
    <div className="mobile-sticky-bar">
      <div className="mobile-detail-bar">
        <button
          type="button"
          className="tp-btn tp-btn-ghost tactile flex items-center justify-center rounded-full"
          style={{ width: 44, height: 44, padding: 0, flexShrink: 0 }}
          onClick={onClose}
          aria-label="Back"
        >
          <IconBack />
        </button>
        <div className="min-w-0 flex-1">
          <div className="mobile-detail-title">{title}</div>
          {meta && <div className="mobile-detail-meta">{meta}</div>}
        </div>
        <div className="mobile-detail-actions">{actions}</div>
      </div>
    </div>
  )
}

// WorkHero — the desktop detail hero shared by books and films: cover/poster
// column (drop-shadowed), an info column (title · meta slot · favourite hearts ·
// genre chips · description), and an actions column. Returns the three columns
// as a fragment so the caller owns the flex container (a plain div for books, a
// Reveal for films). Divergent bits are slots: `cover` (Cover vs Poster), `meta`
// (the mono/amber credit line), `actions` (Export/Edit/Delete).
export function WorkHero({
  cover,
  shadow = 'drop-shadow(0 12px 22px rgba(0,0,0,.4))',
  title,
  titleSize = 28,
  titleStyle,
  meta,
  favorite,
  onFavorite,
  genres = [],
  description,
  actions,
}) {
  return (
    <>
      <div className="w-36 shrink-0 sm:w-44" style={{ filter: shadow }}>
        {cover}
      </div>
      <div className="min-w-0 flex-1 space-y-2.5" style={{ minWidth: 220 }}>
        <h1 className="display-title" style={{ fontSize: titleSize, ...titleStyle }}>
          {title}
        </h1>
        {meta}
        <div className="flex flex-wrap items-center gap-3">
          <Hearts value={!!favorite} onChange={onFavorite} />
        </div>
        {genres.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {genres.map((g) => (
              <span key={g} className="tp-chip">
                {g}
              </span>
            ))}
          </div>
        )}
        <div className="max-w-prose pt-1">
          <ExpandableDescription text={description} />
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>
    </>
  )
}
