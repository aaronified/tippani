import { useEffect, useMemo, useRef, useState } from 'react'
import { DEMO, coverImgURL, json, errText, downloadPost } from './api.js'
import { CoverControls, BookLookupPicker } from './CoverPicker.jsx'
import { FlowQuote } from './flow.jsx'
import { StickerImg, StickerPicker, useStickers } from './stickers.jsx'
import { ShareDialog, bookShare } from './share.jsx'
import { PersonModal, PersonName, PersonPortrait, usePeople } from './people.jsx'
import {
  ColorSwatches,
  ConfirmDialog,
  Cover,
  EmptyState,
  ErrorText,
  FavBadge,
  Field,
  GenreFilter,
  GhostButton,
  ExpandableDescription,
  ExpandableText,
  HandCard,
  HandNote,
  Hearts,
  IconBack,
  IconButton,
  IconDelete,
  IconEdit,
  IconExport,
  IconFilter,
  IconPlus,
  MobileSheet,
  MoreMenu,
  MinRatingSelect,
  MonoLabel,
  PageHeader,
  Placeholder,
  Select,
  SheetFooter,
  TagChip,
  TiltStars,
  titleCaseGenre,
  Toggle,
  TokenInput,
  EditReveal,
  ViewToggle,
  bySeries,
  filterChipClass,
  seriesLabel,
  splitCommas,
  useCoverSize,
  useIsMobileScreen,
  usePersistedState,
  useReveal,
} from './ui.jsx'

const PRIMARY = 'tp-btn tp-btn-primary' // aesthetic-aware primary (§6)
const QUOTE_STYLE = { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 16.5, lineHeight: 1.55 }

// Library is the books tab (§8.3): cover grid + add-book modal, or a single
// book's detail view (§8.5). Import flows live on the Import page now.
export default function Library({ openId, onOpen, onClose }) {
  if (openId) return <BookDetail id={openId} onClose={onClose} />
  return <BookList onOpen={onOpen} />
}

function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

// Title-case every word: "science FICTION" → "Science Fiction".
function titleCase(s) {
  return s.replace(/\S+/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
}

// bookGenres normalises a book's genres for filtering/display: split any
// comma-joined value, trim, Title-Case, and dedupe — so casing and combined
// strings don't spawn duplicate chips ("fantasy" vs "Fantasy").
function bookGenres(b) {
  const out = []
  for (const raw of b.genres || [])
    for (const part of String(raw).split(',')) {
      const g = titleCase(part.trim())
      if (g && !out.includes(g)) out.push(g)
    }
  return out
}

// bookState is the full PUT body for a book (PUT is full-state) — used by the
// detail-header ♥/★ so a single-field change carries every other field intact.
function bookState(b) {
  return {
    title: b.title,
    author: b.author || '',
    isbn: b.isbn || '',
    asin: b.asin || '',
    description: b.description || '',
    published_year: b.published_year || 0,
    genres: b.genres || [],
    series: b.series || '',
    series_index: b.series_index || 0,
    favorite: !!b.favorite,
    rating: b.rating || 0,
  }
}

// How many genre quick-filter chips to show before the rest collapse into the
// "More…" dropdown — scaled to viewport width so the row never wraps hard.
function useChipBudget() {
  const mobile = useIsMobileScreen()
  const [n, setN] = useState(6)
  useEffect(() => {
    const calc = () => {
      const w = window.innerWidth
      setN(w < 480 ? 3 : mobile || w < 768 ? 4 : w < 1100 ? 6 : 9)
    }
    calc()
    window.addEventListener('resize', calc)
    return () => window.removeEventListener('resize', calc)
  }, [mobile])
  return n
}

// decadeOf floors a year to its decade using the full 4-digit year, so old
// books land in the right century (1850 → 1850s, distinct from 1950s).
function decadeOf(year) {
  if (!year) return null
  return Math.floor(year / 10) * 10
}

// groupBooks buckets the (already filtered + sorted) list into labelled groups
// for the "group by" view. Order: series/author alphabetical, decade newest
// first, genre by size; the catch-all bucket (no series/author/year/genre)
// always sinks to the end. A book with several genres appears in each. Members
// keep the incoming sort order, except series groups sort by index (the natural
// reading order within a series).
function groupBooks(list, mode) {
  const map = new Map()
  const add = (key, label, b, opts = {}) => {
    let g = map.get(key)
    if (!g) {
      g = { key, label, books: [], residual: !!opts.residual, order: opts.order }
      map.set(key, g)
    }
    g.books.push(b)
  }
  for (const b of list) {
    if (mode === 'series') {
      if (b.series) add(b.series, b.series, b)
      else add('~none', 'No series', b, { residual: true })
    } else if (mode === 'author') {
      if (b.author) add(b.author, b.author, b)
      else add('~none', 'Unknown author', b, { residual: true })
    } else if (mode === 'decade') {
      const d = decadeOf(b.published_year)
      if (d != null) add(String(d), `${d}s`, b, { order: d })
      else add('~none', 'Unknown year', b, { residual: true })
    } else if (mode === 'genre') {
      const gs = bookGenres(b)
      if (gs.length) gs.forEach((g) => add(g, g, b))
      else add('~none', 'No genre', b, { residual: true })
    }
  }
  const groups = [...map.values()]
  groups.sort((a, b) => {
    if (a.residual !== b.residual) return a.residual ? 1 : -1
    if (mode === 'decade') return (b.order ?? 0) - (a.order ?? 0)
    if (mode === 'genre') return b.books.length - a.books.length || a.label.localeCompare(b.label)
    return a.label.localeCompare(b.label)
  })
  if (mode === 'series') for (const g of groups) if (!g.residual) g.books = [...g.books].sort(bySeries)
  return groups
}

function GroupHeading({ label, count, person, onOpenPerson }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      {person && <PersonPortrait person={person} size={34} />}
      {onOpenPerson ? (
        <button
          type="button"
          className="display-title truncate"
          style={{ fontSize: 19, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}
          onClick={onOpenPerson}
          title={`${label} — details`}
        >
          {label}
        </button>
      ) : (
        <h3 className="display-title truncate" style={{ fontSize: 19 }}>
          {label}
        </h3>
      )}
      <MonoLabel style={{ color: 'var(--accent-ui)' }}>{plural(count, 'book')}</MonoLabel>
      <span className="h-px flex-1" style={{ background: 'var(--line)' }} />
    </div>
  )
}

// BookGrid is the cover-tile board, shared by the flat list and each group.
function BookGrid({ books, coverSize, onOpen }) {
  return (
    <ul className="grid gap-x-6 gap-y-9" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${coverSize}px, 1fr))` }}>
      {books.map((b, i) => (
        <li key={b.id}>
          <button onClick={() => onOpen(b.id)} className="cover-tile block w-full text-left" title={b.title}>
            <HandCard variant={i % 4} className="relative overflow-hidden cover-lift">
              {b.cover_path ? (
                <img
                  src={coverImgURL(b.cover_path)}
                  alt={`Cover of ${b.title}`}
                  className="block aspect-[2/3] w-full object-cover"
                />
              ) : (
                <Placeholder kind="COVER" className="w-full rounded-none border-0" />
              )}
              {b.favorite && <FavBadge />}
            </HandCard>
            <p className="mt-2.5 truncate font-semibold" style={{ fontFamily: 'var(--font-display)', fontSize: 15.5 }}>
              {b.title}
            </p>
            <p className="truncate text-[13px]" style={{ color: 'var(--soft)' }}>
              {[b.author, b.published_year || null].filter(Boolean).join(' · ')}
            </p>
            {b.series && (
              <p className="truncate text-[12px]" style={{ color: 'var(--faint)', fontStyle: 'italic' }}>
                {seriesLabel(b)}
              </p>
            )}
            <div className="mt-0.5 flex items-center gap-2">
              <MonoLabel style={{ color: 'var(--accent-ui)' }}>{plural(b.annotation_count, 'quote')}</MonoLabel>
              {b.rating > 0 && <TiltStars value={b.rating} />}
            </div>
          </button>
        </li>
      ))}
    </ul>
  )
}

// ---- book list (§8.3, mockups 06–07) ----

function BookList({ onOpen }) {
  const [books, setBooks] = useState(null)
  const [genre, setGenre] = useState('') // '' = All
  const [series, setSeries] = useState('') // '' = all series
  const [fav, setFav] = useState(false)
  const [minRating, setMinRating] = useState('')
  const [sort, setSort] = useState('recent')
  const [groupBy, setGroupBy] = useState('none') // none | series | author | decade | genre
  const [adding, setAdding] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')
  const [coverSize] = useCoverSize('tippani:size:books', 165) // set from Settings
  const chipBudget = useChipBudget()
  const mobile = useIsMobileScreen()
  const [mobileFilter, setMobileFilter] = useState(false)
  const authors = usePeople('author') // name→metadata, for author-group portraits
  const [person, setPerson] = useState(null) // { kind, name } open in the metadata panel

  async function load() {
    const r = await json('GET', '/books')
    if (r.ok) setBooks(r.data.books)
    else setError(errText(r))
  }
  useEffect(() => {
    load()
  }, [])

  // Genres, most-used first (chips promote the common ones), tie-broken
  // alphabetically. bookGenres normalises so "fantasy"/"Fantasy" and a
  // comma-joined "Fiction, Fantasy" all collapse to the same chips.
  const genres = useMemo(() => {
    const counts = new Map()
    for (const b of books || []) for (const g of bookGenres(b)) counts.set(g, (counts.get(g) || 0) + 1)
    return [...counts.keys()].sort((a, b) => counts.get(b) - counts.get(a) || a.localeCompare(b))
  }, [books])

  // Unique series names for the series filter dropdown.
  const seriesNames = useMemo(() => {
    const s = new Set()
    for (const b of books || []) if (b.series) s.add(b.series)
    return [...s].sort()
  }, [books])

  const shown = useMemo(() => {
    let list = books || []
    if (genre) list = list.filter((b) => bookGenres(b).includes(genre))
    if (series) list = list.filter((b) => (b.series || '') === series)
    if (fav) list = list.filter((b) => b.favorite)
    if (minRating) list = list.filter((b) => (b.rating || 0) >= Number(minRating))
    if (sort === 'recent') return list // server order (created_at DESC)
    list = [...list]
    if (sort === 'title') list.sort((a, b) => a.title.localeCompare(b.title))
    else if (sort === 'author') list.sort((a, b) => (a.author || '').localeCompare(b.author || ''))
    else if (sort === 'rating') list.sort((a, b) => (b.rating || 0) - (a.rating || 0))
    else if (sort === 'series') list.sort(bySeries)
    return list
  }, [books, genre, series, fav, minRating, sort])

  const grouped = useMemo(() => (groupBy === 'none' ? null : groupBooks(shown, groupBy)), [shown, groupBy])

  const quoteTotal = (books || []).reduce((n, b) => n + (b.annotation_count || 0), 0)

  return (
    <section>
      <div className={mobile ? 'mobile-sticky-bar' : ''}>
        <PageHeader
          title="Books"
          counts={books ? `${plural(books.length, 'book')} · ${plural(quoteTotal, 'quote')}` : ''}
          right={
            <>
              {mobile && (
                <div className="flex items-center gap-2">
                  <IconButton icon={<IconPlus />} ariaLabel="Add book" onClick={() => setAdding(true)} />
                  <IconButton icon={<IconFilter />} ariaLabel="Filters" onClick={() => setMobileFilter((o) => !o)} />
                  {!DEMO && <MoreMenu items={[{ icon: <IconExport />, label: 'Export all', onClick: () => setExporting(true) }]} />}
                </div>
              )}
              {!mobile && <MonoLabel className="hidden sm:inline">lookup: ISBN or title</MonoLabel>}
              {!mobile && !DEMO && <GhostButton onClick={() => setExporting(true)}>Export all</GhostButton>}
              {!mobile && <button className={PRIMARY} onClick={() => setAdding(true)}>
                ＋ Add book
              </button>}
            </>
          }
        />
      </div>
      <ErrorText>{error}</ErrorText>

      {books && books.length > 0 && !mobile && (
        <div className="filter-row mb-5">
          <GenreFilter genres={genres} value={genre} onChange={setGenre} budget={chipBudget} />
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <button onClick={() => setFav(!fav)} className={filterChipClass(fav)} title="Only favourites">
              ♥ favourites
            </button>
            <MinRatingSelect value={minRating} onChange={setMinRating} />
            {seriesNames.length > 0 && (
              <Select
                ariaLabel="Filter by series"
                value={series}
                onChange={setSeries}
                options={[['', 'all series'], ...seriesNames.map((s) => [s, s])]}
              />
            )}
            <label className="flex items-center gap-2">
              <MonoLabel>group</MonoLabel>
              <Select
                ariaLabel="Group by"
                value={groupBy}
                onChange={setGroupBy}
                options={[['none', 'Books'], ['series', 'Series'], ['author', 'Author'], ['decade', 'Decade'], ['genre', 'Genre']]}
              />
            </label>
            <label className="flex items-center gap-2">
              <MonoLabel>sort</MonoLabel>
              <Select
                ariaLabel="Sort"
                value={sort}
                onChange={setSort}
                options={[['recent', 'Recent'], ['title', 'Title'], ['author', 'Author'], ['rating', 'Rating'], ['series', 'Series']]}
              />
            </label>
          </div>
        </div>
      )}

      {mobile && (
        <MobileSheet
          open={mobileFilter}
          onClose={() => setMobileFilter(false)}
          title="Filters"
          footer={
            <SheetFooter
              count={books ? `${shown.length} shown` : ''}
              onReset={() => { setGenre(''); setFav(false); setMinRating(''); setSeries(''); setGroupBy('none'); setSort('recent') }}
              onDone={() => setMobileFilter(false)}
            />
          }
        >
          <div className="space-y-5">
            <div>
              <MonoLabel className="mb-2 block">genre</MonoLabel>
              <GenreFilter genres={genres} value={genre} onChange={setGenre} budget={chipBudget} />
            </div>
            <div>
              <MonoLabel className="mb-2 block">show only</MonoLabel>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => setFav(!fav)} className={filterChipClass(fav)} title="Only favourites">
                  ♥ favourites
                </button>
                <MinRatingSelect value={minRating} onChange={setMinRating} />
              </div>
            </div>
            {seriesNames.length > 0 && (
              <div>
                <MonoLabel className="mb-2 block">series</MonoLabel>
                <Select
                  ariaLabel="Filter by series"
                  value={series}
                  onChange={setSeries}
                  options={[['', 'all series'], ...seriesNames.map((s) => [s, s])]}
                />
              </div>
            )}
            <div>
              <MonoLabel className="mb-2 block">group</MonoLabel>
              <Select
                ariaLabel="Group by"
                value={groupBy}
                onChange={setGroupBy}
                options={[['none', 'Books'], ['series', 'Series'], ['author', 'Author'], ['decade', 'Decade'], ['genre', 'Genre']]}
              />
            </div>
            <div>
              <MonoLabel className="mb-2 block">sort</MonoLabel>
              <Select
                ariaLabel="Sort"
                value={sort}
                onChange={setSort}
                options={[['recent', 'Recent'], ['title', 'Title'], ['author', 'Author'], ['rating', 'Rating'], ['series', 'Series']]}
              />
            </div>
          </div>
        </MobileSheet>
      )}

      {books && books.length === 0 && (
        <EmptyState>no books yet — add one, or bring highlights in from the Import tab</EmptyState>
      )}
      {books && books.length > 0 && shown.length === 0 && <EmptyState>no books match these filters</EmptyState>}
      {shown.length > 0 &&
        (grouped ? (
          <div className="space-y-10">
            {grouped.map((g) => {
              const isAuthor = groupBy === 'author' && !g.residual
              return (
                <section key={g.key}>
                  <GroupHeading
                    label={g.label}
                    count={g.books.length}
                    person={isAuthor ? authors.map[g.label] : null}
                    onOpenPerson={isAuthor ? () => setPerson({ kind: 'author', name: g.label }) : undefined}
                  />
                  <BookGrid books={g.books} coverSize={coverSize} onOpen={onOpen} />
                </section>
              )
            })}
          </div>
        ) : (
          <BookGrid books={shown} coverSize={coverSize} onOpen={onOpen} />
        ))}

      {adding && (
        <AddBookModal
          onClose={() => setAdding(false)}
          onAdded={() => {
            setAdding(false)
            load()
          }}
        />
      )}
      {person && (
        <PersonModal kind={person.kind} name={person.name} onClose={() => setPerson(null)} onSaved={authors.reload} />
      )}
      <ConfirmDialog
        open={exporting}
        title="Export library"
        body={
          <>
            {plural(shown.length, 'book')} · {plural(shown.reduce((n, b) => n + (b.annotation_count || 0), 0), 'quote')} in view will
            be exported as a single Markdown file (re-importable into Tippani).
          </>
        }
        confirmLabel="Export"
        onCancel={() => setExporting(false)}
        onConfirm={async () => {
          setExporting(false)
          await downloadPost('/export/books', { ids: shown.map((b) => b.id) }, 'tippani-books.md')
        }}
      />
    </section>
  )
}

// ---- add-book modal (§8.4, mockups 10–11) ----

function AddBookModal({ onClose, onAdded }) {
  const [mode, setMode] = useState('lookup')

  useEffect(() => {
    const fn = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto px-4 py-12"
      style={{ background: 'rgba(21,16,12,.5)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Add book"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <HandCard variant={2} className="w-full max-w-xl px-7 py-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <h2 className="display-title text-xl">Add book</h2>
          <Toggle ariaLabel="Add mode" value={mode} onChange={setMode} options={[['lookup', 'Look up'], ['manual', 'Manual']]} />
        </div>
        {mode === 'lookup' ? <LookupTab onAdded={onAdded} /> : <ManualTab onAdded={onAdded} />}
      </HandCard>
    </div>
  )
}

// isIsbn detects a 10- or 13-digit ISBN (hyphens/spaces allowed, trailing X ok).
function isIsbn(s) {
  const t = s.replace(/[-\s]/g, '')
  return /^(\d{9}[\dXx]|\d{13})$/.test(t)
}

function sourceLabel(source) {
  if (source === 'google') return 'GOOGLE BOOKS'
  if (source === 'openlibrary') return 'OPEN LIBRARY'
  return (source || '').toUpperCase()
}

function LookupTab({ onAdded }) {
  const [q, setQ] = useState('')
  const [candidates, setCandidates] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [lookupDown, setLookupDown] = useState(false)

  // §2: surface the LOOKUP FAILING state inline when the last lookup failed.
  useEffect(() => {
    json('GET', '/metadata/status').then((r) => {
      if (r.ok && r.data.books_lookup && r.data.books_lookup.ok === false) setLookupDown(true)
    })
  }, [])

  async function search(e) {
    e.preventDefault()
    const v = q.trim()
    if (!v) return
    setBusy(true)
    setError('')
    setCandidates(null)
    const r = await json('POST', '/books/lookup', isIsbn(v) ? { isbn: v } : { title: v })
    setBusy(false)
    if (r.ok) setCandidates(r.data.candidates)
    else {
      setError(errText(r, 'lookup failed'))
      if (r.status >= 500) setLookupDown(true)
    }
  }

  async function add(c) {
    setError('')
    const r = await json('POST', '/books', {
      title: c.title,
      author: c.author || undefined,
      isbn: c.isbn13 || undefined,
      description: c.description || undefined,
      published_year: c.published_year || undefined,
      genres: c.genres || undefined,
      cover_url: c.cover_url || undefined,
      source: c.source,
      source_id: c.source_id,
    })
    if (r.ok) onAdded()
    else setError(errText(r, 'could not add book')) // 409 duplicate lands here
  }

  return (
    <div className="space-y-3">
      <form onSubmit={search} className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <input
            className="tp-input pr-28"
            aria-label="ISBN or title"
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <MonoLabel className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
            ISBN or title
          </MonoLabel>
        </div>
        <button className={PRIMARY + ' shrink-0'} disabled={busy}>
          {busy ? 'Searching…' : 'Search'}
        </button>
      </form>
      {lookupDown && (
        <p className="microcopy" style={{ color: 'var(--error)' }}>
          lookup failing right now? switch to Manual — title + author is enough
        </p>
      )}
      <ErrorText>{error}</ErrorText>
      {candidates && candidates.length === 0 && <EmptyState>no matches found</EmptyState>}
      {candidates && candidates.length > 0 && (
        <ul className="space-y-2.5">
          {candidates.map((c, i) => (
            <li
              key={i}
              className="sheen-raised flex items-center gap-3 rounded-xl px-3 py-2.5"
              style={{ border: '1px solid var(--line)' }}
            >
              <Placeholder kind="" className="w-9 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{c.title}</p>
                <p className="truncate text-xs" style={{ color: 'var(--soft)' }}>
                  {[c.author, c.published_year || null, c.isbn13].filter(Boolean).join(' · ')}
                </p>
              </div>
              <span className="tp-chip shrink-0">{sourceLabel(c.source)}</span>
              <button className={PRIMARY + ' shrink-0'} onClick={() => add(c)}>
                Add
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ManualTab({ onAdded }) {
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [year, setYear] = useState('')
  const [isbn, setIsbn] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (!title.trim()) return setError('title is required')
    let publishedYear
    if (year.trim()) {
      const y = Number(year)
      if (!Number.isInteger(y)) return setError('year must be a number')
      publishedYear = y
    }
    setBusy(true)
    setError('')
    const r = await json('POST', '/books', {
      title: title.trim(),
      author: author.trim() || undefined,
      isbn: isbn.trim() || undefined,
      published_year: publishedYear,
    })
    setBusy(false)
    if (r.ok) onAdded()
    else setError(errText(r, 'could not add book'))
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Field label="Title" value={title} autoFocus onChange={(e) => setTitle(e.target.value)} />
      <Field label="Author" value={author} onChange={(e) => setAuthor(e.target.value)} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Year" inputMode="numeric" value={year} maxLength={4} onChange={(e) => setYear(e.target.value.replace(/\D/g, '').slice(0, 4))} />
        <Field label="ISBN" value={isbn} onChange={(e) => setIsbn(e.target.value)} />
      </div>
      <ErrorText>{error}</ErrorText>
      <button className={PRIMARY} disabled={busy}>
        Add book
      </button>
    </form>
  )
}

// ---- book detail (§8.5, mockups 08–09) ----

function BookDetail({ id, onClose }) {
  const [book, setBook] = useState(null)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState('')
  const [person, setPerson] = useState(null) // author metadata panel
  const [mobileFilter, setMobileFilter] = useState(false)
  const [mobileAdd, setMobileAdd] = useState(false)
  const reveal = useReveal()
  const mobile = useIsMobileScreen()

  async function load() {
    const r = await json('GET', `/books/${id}`)
    if (r.ok) setBook(r.data)
    else setError(errText(r))
  }
  useEffect(() => {
    setBook(null)
    setEditing(false)
    load()
  }, [id])

  async function remove() {
    if (!confirm(`Delete "${book.title}" and all its annotations?`)) return
    const r = await json('DELETE', `/books/${id}`)
    if (r.ok) onClose()
    else setError(errText(r))
  }

  // patch PUTs the book's full current state with one field changed (♥/★ clicks
  // in the header), mirroring the annotation-card pattern.
  async function patch(fields) {
    const r = await json('PUT', `/books/${id}`, { ...bookState(book), ...fields })
    if (r.ok) setBook(r.data)
    else setError(errText(r, 'could not save'))
  }

  // Meta parts: the author is a clickable PersonName (opens the metadata panel);
  // the rest are plain, interleaved with " · ".
  const metaParts = book
    ? [
        book.author ? <PersonName key="author" kind="author" name={book.author} onOpen={setPerson} /> : null,
        book.published_year || null,
        seriesLabel(book) || null,
        book.isbn && `ISBN ${book.isbn}`,
        book.asin && `ASIN ${book.asin}`,
      ].filter(Boolean)
    : []

  const detailTitle = book ? (book.title || 'Untitled') : ''
  const detailAuthor = book && book.author ? book.author : ''

  return (
    <section ref={reveal} className="reveal space-y-6 md:pt-4" data-screen-label="book-detail">
      {mobile && (
        <div className="mobile-sticky-bar">
          <div className="mobile-detail-bar">
            <button type="button" className="tp-btn tp-btn-ghost tactile flex items-center justify-center rounded-full" style={{ width: 44, height: 44, padding: 0, flexShrink: 0 }} onClick={onClose} aria-label="Back">
              <IconBack />
            </button>
            <div className="min-w-0 flex-1">
              <div className="mobile-detail-title">{detailTitle}</div>
              {detailAuthor && <div className="mobile-detail-meta">{detailAuthor}</div>}
            </div>
            <div className="mobile-detail-actions">
              <IconButton icon={<IconFilter />} ariaLabel="Filter annotations" onClick={() => setMobileFilter(true)} />
              <IconButton icon={<IconPlus />} ariaLabel="Add annotation" onClick={() => setMobileAdd(true)} />
              <MoreMenu
                items={[
                  ...(DEMO ? [] : [{ icon: <IconExport />, label: 'Export .md', onClick: () => { if (book) window.location.href = `/api/books/${book.id}/export` } }]),
                  { icon: <IconEdit />, label: 'Edit', onClick: () => setEditing(true) },
                  { icon: <IconDelete />, label: 'Delete', onClick: remove, danger: true },
                ]}
              />
            </div>
          </div>
        </div>
      )}
      {!mobile && (
        <button
          className="mono-label"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px 0' }}
          onClick={onClose}
        >
          ← Library
        </button>
      )}
      <ErrorText>{error}</ErrorText>
      {book &&
        (editing ? (
          <HandCard className="edit-fade px-6 py-5">
            <EditBook
              book={book}
              onSaved={() => {
                setEditing(false)
                load()
              }}
              onCancel={() => setEditing(false)}
            />
          </HandCard>
        ) : (
          <div className="flex flex-wrap items-start gap-6">
            <div className="w-36 shrink-0 sm:w-44" style={{ filter: 'drop-shadow(0 12px 22px rgba(0,0,0,.34))' }}>
              <Cover path={book.cover_path} title={book.title} hero zoomable />
            </div>
            <div className="min-w-0 flex-1 space-y-2.5" style={{ minWidth: 220 }}>
              <h1 className="display-title" style={{ fontSize: 28, lineHeight: 1.15 }}>
                {book.title}
              </h1>
              {metaParts.length > 0 && (
                <MonoLabel className="block" style={{ fontSize: 11.5 }}>
                  {metaParts.map((p, i) => (
                    <span key={i}>
                      {i > 0 ? ' · ' : ''}
                      {p}
                    </span>
                  ))}
                </MonoLabel>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <Hearts value={!!book.favorite} onChange={(v) => patch({ favorite: v })} />
                <TiltStars value={book.rating || 0} onChange={(v) => patch({ rating: v })} />
              </div>
              {bookGenres(book).length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {bookGenres(book).map((g) => (
                    <span key={g} className="tp-chip">
                      {g}
                    </span>
                  ))}
                </div>
              )}
              <div className="max-w-prose pt-1">
                <ExpandableDescription text={book.description} />
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              {!DEMO && (
                <GhostButton onClick={() => (window.location.href = `/api/books/${book.id}/export`)}>
                  Export .md
                </GhostButton>
              )}
              <GhostButton onClick={() => setEditing(true)}>Edit</GhostButton>
              <GhostButton
                style={{ color: 'var(--error)', borderColor: 'color-mix(in srgb, var(--error) 55%, transparent)' }}
                onClick={remove}
              >
                Delete
              </GhostButton>
            </div>
          </div>
        ))}
      {book && <Annotations bookId={book.id} book={book} mobileFilterOpen={mobileFilter} onMobileFilterOpen={setMobileFilter} mobileAddOpen={mobileAdd} onMobileAddOpen={setMobileAdd} />}
      {person && <PersonModal kind={person.kind} name={person.name} onClose={() => setPerson(null)} />}
    </section>
  )
}

export function EditBook({ book, onSaved, onCancel }) {
  const [title, setTitle] = useState(book.title || '')
  const [author, setAuthor] = useState(book.author || '')
  const [isbn, setIsbn] = useState(book.isbn || '')
  const [asin, setAsin] = useState(book.asin || '')
  const [year, setYear] = useState(book.published_year ? String(book.published_year) : '')
  const [genres, setGenres] = useState(book.genres || [])
  const [genreSuggestions, setGenreSuggestions] = useState([])
  useEffect(() => {
    json('GET', '/genres').then((r) => { if (r.ok) setGenreSuggestions(r.data.genres || []) })
  }, [])
  const [series, setSeries] = useState(book.series || '')
  const [seriesIndex, setSeriesIndex] = useState(book.series_index ? String(book.series_index) : '')
  const [description, setDescription] = useState(book.description || '')
  // Cover: coverPath tracks the stored file (updated on immediate upload);
  // coverUrl / clearCover are the pending change carried in the Save PUT.
  const [coverPath, setCoverPath] = useState(book.cover_path || '')
  const [coverUrl, setCoverUrl] = useState('')
  const [clearCover, setClearCover] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // Adopt an API candidate. Two modes:
  //  - overwrite (explicit "Use" on a chosen match): take that match's value for
  //    every field it provides, replacing what's there — that's the whole point
  //    of browsing matches and picking a better one. Fields the match is silent
  //    about are left as-is (never blanked).
  //  - fill-only (one-click "Fetch metadata"): fill only the empty fields so it
  //    can't clobber edits you already made.
  const keep = (v, next) => (String(v).trim() ? v : next || v)
  function applyCandidate(c, overwrite = false) {
    const has = (x) => x != null && String(x).trim() !== ''
    const take = overwrite ? (v, next) => (has(next) ? next : v) : keep
    setTitle((v) => take(v, c.title))
    setAuthor((v) => take(v, c.author))
    setIsbn((v) => take(v, c.isbn13))
    setYear((v) => take(v, c.published_year ? String(c.published_year) : ''))
    setDescription((v) => take(v, c.description))
    setGenres((v) => (overwrite ? (c.genres && c.genres.length ? c.genres : v) : v.length ? v : c.genres || []))
    setSeries((v) => take(v, c.series))
    setSeriesIndex((v) => take(v, c.series_index ? String(c.series_index) : ''))
    if (c.cover_url && (overwrite || (!coverPath && !coverUrl))) {
      setCoverUrl(c.cover_url)
      setClearCover(false)
    }
  }

  // One-click metadata fetch (sits with the cover controls): look up by
  // title/ISBN/ASIN and auto-fill the empty fields from the best match,
  // preferring a candidate that carries series info. The candidate LIST is still
  // available below (BookLookupPicker) when you'd rather choose among matches.
  const [fetchingMeta, setFetchingMeta] = useState(false)
  async function fetchMeta() {
    const body = {}
    if (isbn.trim()) body.isbn = isbn.trim()
    if (title.trim()) body.title = title.trim()
    if (author.trim()) body.author = author.trim()
    if (asin.trim()) body.asin = asin.trim()
    if (!body.isbn && !body.title && !body.asin) return setError('enter a title, ISBN, or ASIN first')
    setFetchingMeta(true)
    setError('')
    const r = await json('POST', '/books/lookup', body)
    setFetchingMeta(false)
    if (!r.ok) return setError(errText(r, 'metadata lookup failed'))
    const cands = r.data.candidates || []
    if (cands.length === 0) return setError('no metadata match — try refining the title or ISBN')
    applyCandidate(cands.find((c) => c.series) || cands[0])
  }

  async function submit(e) {
    e.preventDefault()
    if (!title.trim()) return setError('title is required')
    // Guard a non-numeric year: Number('abc') is NaN, which serializes to JSON
    // null and would silently erase the stored year. Empty clears it on purpose.
    let publishedYear
    if (year.trim()) {
      const y = Number(year)
      if (!Number.isInteger(y)) return setError('year must be a number')
      publishedYear = y
    }
    setBusy(true)
    setError('')
    const r = await json('PUT', `/books/${book.id}`, {
      title: title.trim(),
      author: author.trim(),
      isbn: isbn.trim(),
      asin: asin.trim(),
      published_year: publishedYear,
      genres,
      series: series.trim(),
      series_index: Number(seriesIndex) || 0,
      description: description.trim(),
      // favorite/rating are edited on the detail header, not here — but PUT is
      // full-state, so carry the current values through.
      favorite: !!book.favorite,
      rating: book.rating || 0,
      cover_url: coverUrl || undefined,
      clear_cover: clearCover || undefined,
    })
    setBusy(false)
    if (r.ok) onSaved()
    else setError(errText(r, 'could not save'))
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <CoverControls
        kind="books"
        id={book.id}
        currentPath={coverPath}
        asin={asin}
        coverUrl={coverUrl}
        clearCover={clearCover}
        onSetUrl={(u) => {
          setCoverUrl(u)
          setClearCover(false)
        }}
        onClear={(reset) => {
          if (reset === true) {
            setCoverUrl('')
            setClearCover(false)
          } else {
            setClearCover(true)
            setCoverUrl('')
          }
        }}
        onUploaded={(rec) => setCoverPath(rec.cover_path || '')}
        onFetchMeta={fetchMeta}
        fetchingMeta={fetchingMeta}
        search={{ isbn, title, author, asin }}
      />
      <BookLookupPicker isbn={isbn} title={title} author={author} asin={asin} onPick={(c) => applyCandidate(c, true)} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Field label="Author" value={author} onChange={(e) => setAuthor(e.target.value)} />
        <Field label="ISBN" value={isbn} onChange={(e) => setIsbn(e.target.value)} />
        <Field label="ASIN" value={asin} onChange={(e) => setAsin(e.target.value)} />
        <Field label="Year" inputMode="numeric" value={year} maxLength={4} onChange={(e) => setYear(e.target.value.replace(/\D/g, '').slice(0, 4))} />
      </div>
      <label className="block">
        <MonoLabel className="mb-1.5 block">Genres</MonoLabel>
        <TokenInput value={genres} onChange={setGenres} suggestions={genreSuggestions} placeholder="add a genre…" ariaLabel="Genres" transform={titleCaseGenre} />
      </label>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <Field label="Series" placeholder="e.g. Discworld" value={series} onChange={(e) => setSeries(e.target.value)} />
        <Field
          label="Series #"
          inputMode="decimal"
          placeholder="e.g. 5"
          value={seriesIndex}
          onChange={(e) => setSeriesIndex(e.target.value)}
        />
      </div>
      <label className="block">
        <MonoLabel className="mb-1.5 block">Description</MonoLabel>
        <textarea className="tp-input" rows="4" value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <ErrorText>{error}</ErrorText>
      <div className="flex gap-2">
        <button className={PRIMARY} disabled={busy}>
          Save
        </button>
        <GhostButton type="button" onClick={onCancel}>
          Cancel
        </GhostButton>
      </div>
    </form>
  )
}

// annotationState builds the full PUT body from an annotation row — PUT is
// full-state, so every field must be carried even when only one changes.
export function annotationState(a) {
  return {
    quote: a.quote || '',
    note: a.note || '',
    chapter: a.chapter || '',
    location: a.location || '',
    color: a.color || 'yellow',
    tags: a.tags || [],
    favorite: !!a.favorite,
    rating: a.rating || 0,
    // carry the attached sticker + its seal position through every full-state
    // PUT so a favourite/rating/drag patch never wipes them (nulls = no sticker /
    // unplaced → top-right default)
    sticker_id: a.sticker_id ?? null,
    sticker_x: a.sticker_x ?? null,
    sticker_y: a.sticker_y ?? null,
  }
}

// ---- annotation views (v3): tiles (resizable board) · list · table ----

// annDate prefers the source/original date (noted_at, set on import or manual
// add) and falls back to the row's created_at.
export function annDate(a) {
  return a.noted_at || a.created_at || ''
}
export function fmtDate(s) {
  if (!s) return ''
  const d = new Date(String(s).replace(' ', 'T'))
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}
// locSortVal pulls the first number out of a location ("p.142" -> 142) so the
// table sorts locations numerically; missing locations sink to the bottom.
function locSortVal(a) {
  const m = String(a.location || '').match(/\d+/)
  return m ? parseInt(m[0], 10) : -1
}
function ActionRow({ a, patch, setEditingId, remove, onShare }) {
  // flex-wrap lets the links drop under the marks on narrow cards instead of
  // pushing the row (and the page) wider than the phone screen.
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 pt-2" style={{ borderTop: '1px solid var(--line)' }}>
      <Hearts value={!!a.favorite} onChange={(v) => patch(a, { favorite: v })} />
      <TiltStars value={a.rating || 0} onChange={(v) => patch(a, { rating: v })} />
      <span className="ml-auto flex gap-3">
        {onShare && <button className="tp-link" onClick={() => onShare(a)}>share</button>}
        <button className="tp-link" onClick={() => setEditingId(a.id)}>edit</button>
        <button className="tp-link tp-link-danger" onClick={() => remove(a)}>delete</button>
      </span>
    </div>
  )
}

// AnnotationCard is the shared card body for the tiles + list views. An attached
// uploaded sticker becomes the corner seal the quote flows around (pretext); the
// quote clamps to `quoteLines` with an inline show-more.
export function AnnotationCard({ a, variant, tagMap, stickerMap = {}, stickers = [], reloadStickers, editing, setEditingId, save, patch, remove, onShare, quoteLines = 6, tagSuggestions = [] }) {
  const sticker = a.sticker_id != null ? stickerMap[a.sticker_id] : null
  const d = fmtDate(annDate(a))
  return (
    <HandCard variant={variant} colorBar={a.color} className="px-5 py-4">
      <EditReveal open={editing}>
      {editing ? (
        <AnnotationForm initial={a} onSubmit={(fields) => save(a.id, fields)} onCancel={() => setEditingId(null)} submitLabel="Save" tagSuggestions={tagSuggestions} stickers={stickers} reloadStickers={reloadStickers} />
      ) : (
        <div className="space-y-2">
          {a.quote &&
            (sticker ? (
              <FlowQuote
                text={a.quote}
                quoteStyle={QUOTE_STYLE}
                stickerKey={`s${sticker.id}`}
                maxLines={quoteLines} /* collapsed → small corner badge; expanded →
                                         full positioned/draggable seal (see flow.jsx) */
                pos={a.sticker_x != null ? { x: a.sticker_x, y: a.sticker_y } : null}
                onMove={(x, y) => patch(a, { sticker_x: x, sticker_y: y })}
                sticker={<StickerImg sticker={sticker} />}
              />
            ) : (
              <ExpandableText text={a.quote} lines={quoteLines} style={QUOTE_STYLE} />
            ))}
          {(a.chapter || a.location || d) && (
            <MonoLabel className="block">
              {[a.chapter && `CH. ${a.chapter}`, a.location && `P.${a.location}`, d].filter(Boolean).join(' · ')}
            </MonoLabel>
          )}
          {a.note && <HandNote>{a.note}</HandNote>}
          {a.tags && a.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {a.tags.map((name) => {
                const t = tagMap[name]
                return (
                  <TagChip key={name} color={t?.color} style={t?.style}>
                    {name}
                  </TagChip>
                )
              })}
            </div>
          )}
          <ActionRow a={a} patch={patch} setEditingId={setEditingId} remove={remove} onShare={onShare} />
        </div>
      )}
      </EditReveal>
    </HandCard>
  )
}

const TABLE_COLS = [
  { key: 'quote', label: 'Quote' },
  { key: 'chapter', label: 'Chapter' },
  { key: 'location', label: 'Location' },
  { key: 'date', label: 'Date' },
  { key: 'rating', label: '★' },
  { key: 'favorite', label: '♥' },
]

function AnnotationTable({ rows, tagMap, stickers = [], reloadStickers, sort, onSort, editingId, setEditingId, save, remove, onShare }) {
  const arrow = (k) => (sort.col === k ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : '')
  return (
    <div className="ann-table-wrap">
      <table className="ann-table">
        <thead>
          <tr>
            {TABLE_COLS.map((c) => (
              <th key={c.key} className="sortable" onClick={() => onSort(c.key)} aria-sort={sort.col === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                {c.label}
                {arrow(c.key)}
              </th>
            ))}
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) =>
            editingId === a.id ? (
              <tr key={a.id} className="editing-row">
                <td colSpan={TABLE_COLS.length + 1}>
                  <AnnotationForm initial={a} onSubmit={(fields) => save(a.id, fields)} onCancel={() => setEditingId(null)} submitLabel="Save" tagSuggestions={Object.keys(tagMap)} stickers={stickers} reloadStickers={reloadStickers} />
                </td>
              </tr>
            ) : (
              <tr key={a.id}>
                <td className="col-quote">
                  <ExpandableText text={a.quote || a.note} lines={2} style={QUOTE_STYLE} />
                  {a.tags && a.tags.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {a.tags.map((name) => {
                        const t = tagMap[name]
                        return (
                          <TagChip key={name} color={t?.color} style={t?.style}>
                            {name}
                          </TagChip>
                        )
                      })}
                    </div>
                  )}
                </td>
                <td className="col-mono">{a.chapter || '—'}</td>
                <td className="col-mono">{a.location || '—'}</td>
                <td className="col-mono">{fmtDate(annDate(a)) || '—'}</td>
                <td className="col-center">{a.rating ? '★'.repeat(a.rating) : '—'}</td>
                <td className="col-center">{a.favorite ? '♥' : '—'}</td>
                <td className="col-actions">
                  {onShare && <button className="tp-link" onClick={() => onShare(a)}>share</button>}
                  <button className="tp-link" onClick={() => setEditingId(a.id)}>edit</button>
                  <button className="tp-link tp-link-danger" onClick={() => remove(a)}>del</button>
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  )
}

// Annotations is the per-book annotation section: filter row, hand-drawn
// cards, and the dashed ＋ Add annotation tile (§8.5).
function Annotations({ bookId, book, mobileFilterOpen, onMobileFilterOpen, mobileAddOpen, onMobileAddOpen }) {
  const [items, setItems] = useState(null)
  const [tags, setTags] = useState([]) // tag objects: {id, name, color, style, …}
  const [shareTarget, setShareTarget] = useState(null) // annotation being shared
  const [color, setColor] = useState('') // filter, '' = all
  const [tag, setTag] = useState('') // filter by NAME, '' = all
  const [fav, setFav] = useState(false)
  const [minRating, setMinRating] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [addOpen, setAddOpen] = useState(false)
  const [total, setTotal] = useState(null) // unfiltered count for "N quotes · M shown"
  const [error, setError] = useState('')
  const [view, setView] = usePersistedState('tippani:annview', 'tiles') // list | tiles | table
  const [sort, setSort] = useState({ col: 'default', dir: 'asc' }) // table only; default = server (recent)
  const reqSeq = useRef(0)
  const mobile = useIsMobileScreen()

  useEffect(() => {
    if (mobileAddOpen) { setAddOpen(true); onMobileAddOpen?.(false); }
  }, [mobileAddOpen])

  // The add form sits at the top of the section; when it opens while the list
  // is scrolled (the sticky-bar ＋ on mobile), bring it into view.
  const addRef = useRef(null)
  useEffect(() => {
    if (addOpen && addRef.current) addRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [addOpen])

  const { stickers, reload: reloadStickers } = useStickers()
  const filtering = Boolean(color || tag || fav || minRating)
  // Chips take colour + style from the tag object (name-keyed map).
  const tagMap = useMemo(() => Object.fromEntries(tags.map((t) => [t.name, t])), [tags])
  // Attached stickers resolve id → image for the card seal.
  const stickerMap = useMemo(() => Object.fromEntries(stickers.map((s) => [s.id, s])), [stickers])

  function toggleSort(col) {
    setSort((s) => (s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' }))
  }
  // Client-side sort for the table view only; list/tiles keep server (recent) order.
  const sortedRows = useMemo(() => {
    const arr = items ? [...items] : []
    if (view !== 'table' || sort.col === 'default') return arr
    const dir = sort.dir === 'asc' ? 1 : -1
    const val = (a) => {
      switch (sort.col) {
        case 'quote': return (a.quote || a.note || '').toLowerCase()
        case 'chapter': return (a.chapter || '').toLowerCase()
        case 'location': return locSortVal(a)
        case 'date': return annDate(a)
        case 'rating': return a.rating || 0
        case 'favorite': return a.favorite ? 1 : 0
        default: return 0
      }
    }
    arr.sort((a, b) => {
      const x = val(a), y = val(b)
      if (x < y) return -dir
      if (x > y) return dir
      return a.id - b.id
    })
    return arr
  }, [items, view, sort])

  async function loadTags() {
    const r = await json('GET', '/tags')
    if (r.ok) setTags(r.data.tags)
  }
  async function load() {
    // Sequence guard: rapid filter toggling fires overlapping requests, so only
    // the newest response is allowed to render (a slow earlier one is dropped).
    const seq = ++reqSeq.current
    const params = new URLSearchParams({ book_id: bookId })
    if (color) params.set('color', color)
    if (tag) params.set('tag', tag)
    if (fav) params.set('favorite', '1')
    if (minRating) params.set('min_rating', minRating)
    const r = await json('GET', `/annotations?${params}`)
    if (seq !== reqSeq.current) return
    if (r.ok) {
      setItems(r.data.annotations)
      if (!color && !tag && !fav && !minRating) setTotal(r.data.annotations.length)
    } else setError(errText(r))
  }
  useEffect(() => {
    load()
  }, [bookId, color, tag, fav, minRating])
  useEffect(() => {
    loadTags()
  }, [bookId])

  async function add(fields) {
    const r = await json('POST', '/annotations', { book_id: bookId, ...fields })
    if (!r.ok) return errText(r, 'could not add annotation')
    setTotal((t) => (t == null ? t : t + 1))
    load()
    loadTags()
    return null
  }

  async function save(id, fields) {
    const r = await json('PUT', `/annotations/${id}`, fields)
    if (!r.ok) return errText(r, 'could not save annotation')
    setEditingId(null)
    load()
    loadTags()
    return null
  }

  async function remove(a) {
    if (!confirm('Delete this annotation?')) return
    const r = await json('DELETE', `/annotations/${a.id}`)
    if (r.ok) {
      setTotal((t) => (t == null ? t : t - 1))
      load()
    } else setError(errText(r))
  }

  // patch PUTs a row's full current state with one field changed (♥/★ clicks).
  async function patch(a, fields) {
    const r = await json('PUT', `/annotations/${a.id}`, { ...annotationState(a), ...fields })
    if (!r.ok) return setError(errText(r, 'could not save annotation'))
    setError('')
    load()
  }

  // Build the normalised share payload from the chosen annotation + its book.
  const sharePayload = (a) =>
    bookShare({
      quote: a.quote,
      note: a.note,
      author: book?.author,
      title: book?.title,
      published: book?.published_year,
      chapter: a.chapter,
      location: a.location,
      date: fmtDate(annDate(a)),
      rating: a.rating,
      tags: a.tags,
    })

  const countsLabel = !items
    ? ''
    : filtering && total != null
      ? `${plural(total, 'quote')} · ${items.length} shown`
      : plural(items.length, 'quote')

  return (
    <div className="space-y-4">
      {mobile && (
        <MobileSheet
          open={mobileFilterOpen}
          onClose={() => onMobileFilterOpen?.(false)}
          title="Filter annotations"
          footer={
            <SheetFooter
              count={countsLabel}
              onReset={() => { setColor(''); setTag(''); setFav(false); setMinRating('') }}
              onDone={() => onMobileFilterOpen?.(false)}
            />
          }
        >
          <div className="space-y-5">
            <div>
              <MonoLabel className="mb-2 block">color</MonoLabel>
              <ColorSwatches value={color} onChange={(c) => setColor(c === color ? '' : c)} />
            </div>
            {tags.length > 0 && (
              <div>
                <MonoLabel className="mb-2 block">tag</MonoLabel>
                <Select
                  ariaLabel="Filter by tag"
                  value={tag}
                  onChange={setTag}
                  options={[['', 'all tags'], ...tags.map((t) => [t.name, t.name])]}
                />
              </div>
            )}
            <div>
              <MonoLabel className="mb-2 block">show only</MonoLabel>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => setFav(!fav)} className={filterChipClass(fav)} title="Only favourites">
                  ♥ favourites
                </button>
                <MinRatingSelect value={minRating} onChange={setMinRating} />
              </div>
            </div>
            <div>
              <MonoLabel className="mb-2 block">view</MonoLabel>
              <ViewToggle value={view} onChange={setView} />
            </div>
          </div>
        </MobileSheet>
      )}
      {!mobile && (
        <div className="flex flex-wrap items-center gap-3">
          <MonoLabel>filter</MonoLabel>
          <ColorSwatches value={color} onChange={(c) => setColor(c === color ? '' : c)} />
          {tags.length > 0 && (
            <Select
              ariaLabel="Filter by tag"
              value={tag}
              onChange={setTag}
              options={[['', 'all tags'], ...tags.map((t) => [t.name, t.name])]}
            />
          )}
          <button onClick={() => setFav(!fav)} className={filterChipClass(fav)} title="Only favourites">
            ♥ favourites
          </button>
          <MinRatingSelect value={minRating} onChange={setMinRating} />
          <span className="ml-auto flex items-center gap-3 view-toggle-row">
            <MonoLabel>{countsLabel}</MonoLabel>
            <ViewToggle value={view} onChange={setView} />
          </span>
        </div>
      )}

      <ErrorText>{error}</ErrorText>

      {/* Add-annotation leads the section (collapsed to a slim dashed tile) so
          starting a note never requires scrolling past the whole list. */}
      <div ref={addRef}>
        {addOpen ? (
          <HandCard variant={1} className="px-5 py-4">
            <AnnotationForm
              onSubmit={async (fields) => {
                const err = await add(fields)
                if (!err) setAddOpen(false)
                return err
              }}
              onCancel={() => setAddOpen(false)}
              submitLabel="Add annotation"
              tagSuggestions={Object.keys(tagMap)}
              stickers={stickers}
              reloadStickers={reloadStickers}
            />
          </HandCard>
        ) : (
          <button
            className="w-full text-center"
            style={{ border: '1.6px dashed var(--ink-border)', borderRadius: 12, padding: '16px 18px', background: 'transparent' }}
            onClick={() => setAddOpen(true)}
          >
            <span className="font-semibold" style={{ color: 'var(--accent-ui)' }}>
              ＋ Add annotation
            </span>
            <span className="microcopy ml-3">quote · note · colour · tags · chapter · location</span>
          </button>
        )}
      </div>

      {items && items.length === 0 && (
        <EmptyState>
          {filtering ? 'no annotations match the filters' : 'no annotations yet — add your first above'}
        </EmptyState>
      )}
      {items && items.length > 0 && view === 'table' && (
        <AnnotationTable
          rows={sortedRows}
          tagMap={tagMap}
          stickers={stickers}
          reloadStickers={reloadStickers}
          sort={sort}
          onSort={toggleSort}
          editingId={editingId}
          setEditingId={setEditingId}
          save={save}
          remove={remove}
          onShare={setShareTarget}
        />
      )}
      {items && items.length > 0 && view === 'list' && (
        <div className="space-y-4">
          {items.map((a, i) => (
            <AnnotationCard
              key={a.id}
              a={a}
              variant={i % 4}
              tagMap={tagMap}
              stickerMap={stickerMap}
              stickers={stickers}
              reloadStickers={reloadStickers}
              editing={editingId === a.id}
              setEditingId={setEditingId}
              save={save}
              patch={patch}
              remove={remove}
              onShare={setShareTarget}
              quoteLines={5}
              tagSuggestions={Object.keys(tagMap)}
            />
          ))}
        </div>
      )}
      {items && items.length > 0 && view === 'tiles' && (
        // Packed masonry board: equal-width columns that pack by height, so the
        // sticker quotes read as an uneven collage. Each card clamps to a
        // per-card 3–5 lines (deterministic from its id) before show-more, so
        // heights stay varied rather than uniform.
        <ul className="columns-1 gap-4 sm:columns-2 xl:columns-3">
          {items.map((a, i) => (
            <li key={a.id} className="mb-4 break-inside-avoid">
              <AnnotationCard
                a={a}
                variant={i % 4}
                tagMap={tagMap}
                stickerMap={stickerMap}
                stickers={stickers}
                reloadStickers={reloadStickers}
                editing={editingId === a.id}
                setEditingId={setEditingId}
                save={save}
                patch={patch}
                remove={remove}
                onShare={setShareTarget}
                quoteLines={3 + (a.id % 3)}
                tagSuggestions={Object.keys(tagMap)}
              />
            </li>
          ))}
        </ul>
      )}

      {shareTarget && <ShareDialog share={sharePayload(shareTarget)} onClose={() => setShareTarget(null)} />}
    </div>
  )
}

// AnnotationForm serves both add (no initial) and inline edit (initial set).
// onSubmit receives the full field state and returns an error string or null.
function AnnotationForm({ initial, onSubmit, onCancel, submitLabel, tagSuggestions = [], stickers = [], reloadStickers }) {
  const [quote, setQuote] = useState(initial?.quote || '')
  const [note, setNote] = useState(initial?.note || '')
  const [chapter, setChapter] = useState(initial?.chapter || '')
  const [location, setLocation] = useState(initial?.location || '')
  const [color, setColor] = useState(initial?.color || 'yellow')
  const [tags, setTags] = useState(initial?.tags || [])
  const [stickerId, setStickerId] = useState(initial?.sticker_id ?? null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (!quote.trim() && !note.trim()) return setError('quote or note is required')
    setBusy(true)
    setError('')
    const err = await onSubmit({
      quote: quote.trim(),
      note: note.trim(),
      chapter: chapter.trim(),
      location: location.trim(),
      color,
      tags,
      // favorite/rating are edited on the card, not in the form — but PUT is
      // full-state, so carry the existing values through.
      favorite: !!initial?.favorite,
      rating: initial?.rating || 0,
      // sticker: id is chosen here; position is dragged on the card, so carry
      // the existing coords through unchanged (full-state PUT).
      sticker_id: stickerId,
      sticker_x: initial?.sticker_x ?? null,
      sticker_y: initial?.sticker_y ?? null,
    })
    setBusy(false)
    if (err) return setError(err)
    if (!initial) {
      setQuote('')
      setNote('')
      setChapter('')
      setLocation('')
      setColor('yellow')
      setTags([])
      setStickerId(null)
    }
  }

  return (
    <form onSubmit={submit} className="ann-form space-y-3">
      <label className="block">
        <MonoLabel className="mb-1.5 block">Quote</MonoLabel>
        <textarea className="tp-input" rows="3" value={quote} onChange={(e) => setQuote(e.target.value)} />
      </label>
      <label className="block">
        <MonoLabel className="mb-1.5 block">Note</MonoLabel>
        <textarea className="tp-input" rows="2" value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <div className="cl-grid">
        <Field label="Chapter" value={chapter} onChange={(e) => setChapter(e.target.value)} />
        <Field label="Location" placeholder="e.g. 1042" value={location} onChange={(e) => setLocation(e.target.value)} />
      </div>
      <label className="block">
        <MonoLabel className="mb-1.5 block">Tags</MonoLabel>
        <TokenInput value={tags} onChange={setTags} suggestions={tagSuggestions} placeholder="add a tag…" ariaLabel="Tags" />
      </label>
      <div className="block">
        <MonoLabel className="mb-1.5 block">Sticker</MonoLabel>
        <StickerPicker value={stickerId} onChange={setStickerId} stickers={stickers} reload={reloadStickers} />
      </div>
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <MonoLabel>colour</MonoLabel>
        <ColorSwatches value={color} onChange={setColor} />
        <div className="ml-auto flex gap-2">
          {onCancel && (
            <GhostButton type="button" onClick={onCancel}>
              Cancel
            </GhostButton>
          )}
          <button className={PRIMARY} disabled={busy}>
            {submitLabel}
          </button>
        </div>
      </div>
      <ErrorText>{error}</ErrorText>
    </form>
  )
}
