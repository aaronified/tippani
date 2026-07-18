// works.jsx — shared building blocks for "works" (books + films/shows), the two
// halves of the catalogue that render in parallel across the Library, Movies,
// Search and Metadata screens. Kept in their own module so both sides compose
// the same pieces instead of re-deriving them (and to avoid a ui ↔ people
// import cycle — this layer is free to import from both).
import { splitCredits } from './people.jsx'

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
