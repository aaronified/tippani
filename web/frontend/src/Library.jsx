import { useEffect, useMemo, useRef, useState } from 'react'
import { json, errText } from './api.js'
import { CoverControls, BookLookupPicker } from './CoverPicker.jsx'
import {
  ColorSwatches,
  Cover,
  EmptyState,
  ErrorText,
  FavBadge,
  Field,
  GhostButton,
  ExpandableDescription,
  HandCard,
  HandNote,
  Hearts,
  MinRatingSelect,
  MonoLabel,
  PageHeader,
  Placeholder,
  TagChip,
  TiltStars,
  bySeries,
  filterChipClass,
  seriesLabel,
  splitCommas,
  useCoverSize,
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
  const [n, setN] = useState(6)
  useEffect(() => {
    const calc = () => {
      const w = window.innerWidth
      setN(w < 480 ? 3 : w < 768 ? 4 : w < 1100 ? 6 : 9)
    }
    calc()
    window.addEventListener('resize', calc)
    return () => window.removeEventListener('resize', calc)
  }, [])
  return n
}

// ---- book list (§8.3, mockups 06–07) ----

function BookList({ onOpen }) {
  const [books, setBooks] = useState(null)
  const [genre, setGenre] = useState('') // '' = All
  const [series, setSeries] = useState('') // '' = all series
  const [fav, setFav] = useState(false)
  const [minRating, setMinRating] = useState('')
  const [sort, setSort] = useState('recent')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const [coverSize] = useCoverSize('tippani:size:books', 165) // set from Settings
  const reveal = useReveal()
  const chipBudget = useChipBudget()

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

  // Promote the busiest genres to chips; the tail (plus any active pick that
  // fell past the budget) lives in the "More…" dropdown so it stays reachable.
  const topGenres = genres.slice(0, chipBudget)
  const moreGenres = genres.slice(chipBudget)
  const activeInMore = genre && moreGenres.includes(genre)

  const quoteTotal = (books || []).reduce((n, b) => n + (b.annotation_count || 0), 0)

  return (
    <section ref={reveal} className="reveal">
      <PageHeader
        title="Library"
        counts={books ? `${plural(books.length, 'book')} · ${plural(quoteTotal, 'quote')}` : ''}
        right={
          <>
            <MonoLabel>lookup: ISBN or title</MonoLabel>
            <GhostButton onClick={() => (window.location.href = '/export')}>Export all</GhostButton>
            <button className={PRIMARY} onClick={() => setAdding(true)}>
              ＋ Add book
            </button>
          </>
        }
      />
      <ErrorText>{error}</ErrorText>

      {books && books.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-1.5">
          {genres.length > 0 && (
            <>
              <button className={filterChipClass(genre === '')} onClick={() => setGenre('')}>
                All
              </button>
              {topGenres.map((g) => (
                <button key={g} className={filterChipClass(genre === g)} onClick={() => setGenre(genre === g ? '' : g)}>
                  {g}
                </button>
              ))}
              {moreGenres.length > 0 && (
                <select
                  className={filterChipClass(activeInMore) + ' cursor-pointer'}
                  title="More genres"
                  value={activeInMore ? genre : ''}
                  onChange={(e) => setGenre(e.target.value)}
                >
                  <option value="">More…</option>
                  {moreGenres.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              )}
            </>
          )}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button onClick={() => setFav(!fav)} className={filterChipClass(fav)} title="Only favourites">
              ♥ favourites
            </button>
            <MinRatingSelect value={minRating} onChange={setMinRating} />
            {seriesNames.length > 0 && (
              <select
                className="tp-input w-auto"
                title="Filter by series"
                value={series}
                onChange={(e) => setSeries(e.target.value)}
              >
                <option value="">all series</option>
                {seriesNames.map((sname) => (
                  <option key={sname} value={sname}>
                    {sname}
                  </option>
                ))}
              </select>
            )}
            <label className="flex items-center gap-2">
              <MonoLabel>sort</MonoLabel>
              <select
                className="cursor-pointer"
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '8px 2px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  fontWeight: 500,
                  letterSpacing: '.06em',
                  textTransform: 'uppercase',
                  color: 'var(--faint)',
                }}
                title="Sort"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="recent">recent</option>
                <option value="title">title</option>
                <option value="author">author</option>
                <option value="rating">rating</option>
                <option value="series">series</option>
              </select>
            </label>
          </div>
        </div>
      )}

      {books && books.length === 0 && (
        <EmptyState>no books yet — add one, or bring highlights in from the Import tab</EmptyState>
      )}
      {books && books.length > 0 && shown.length === 0 && <EmptyState>no books match these filters</EmptyState>}
      {shown.length > 0 && (
        <ul className="grid gap-x-6 gap-y-9" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${coverSize}px, 1fr))` }}>
          {shown.map((b, i) => (
            <li key={b.id}>
              <button onClick={() => onOpen(b.id)} className="block w-full text-left" title={b.title}>
                <HandCard variant={i % 4} className="relative overflow-hidden">
                  {b.cover_path ? (
                    <img
                      src={`/covers/${b.cover_path}`}
                      alt={`Cover of ${b.title}`}
                      className="block aspect-[2/3] w-full object-cover"
                    />
                  ) : (
                    <Placeholder kind="COVER" className="w-full rounded-none border-0" />
                  )}
                  {b.favorite && <FavBadge />}
                </HandCard>
                <p
                  className="mt-2.5 truncate font-semibold"
                  style={{ fontFamily: 'var(--font-display)', fontSize: 15.5 }}
                >
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
      )}

      {adding && (
        <AddBookModal
          onClose={() => setAdding(false)}
          onAdded={() => {
            setAdding(false)
            load()
          }}
        />
      )}
    </section>
  )
}

// ---- add-book modal (§8.4, mockups 10–11) ----

// Segmented is the Look up | Manual tab switch in the modal header.
function Segmented({ value, onChange, options }) {
  return (
    <div
      className="inline-flex overflow-hidden"
      style={{ border: '1.4px solid var(--ink-border)', borderRadius: 10 }}
      role="tablist"
    >
      {options.map(([k, label]) => (
        <button
          key={k}
          type="button"
          role="tab"
          aria-selected={value === k}
          onClick={() => onChange(k)}
          className={'px-4 text-sm font-semibold ' + (value === k ? 'sheen-accent' : '')}
          style={{ minHeight: 40, border: 'none', ...(value === k ? {} : { color: 'var(--soft)', background: 'transparent' }) }}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

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
          <Segmented value={mode} onChange={setMode} options={[['lookup', 'Look up'], ['manual', 'Manual']]} />
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
        <Field label="Year" inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value)} />
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
  const reveal = useReveal()

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

  const metaLine =
    book &&
    [
      book.author,
      book.published_year || null,
      seriesLabel(book) || null,
      book.isbn && `ISBN ${book.isbn}`,
      book.asin && `ASIN ${book.asin}`,
    ]
      .filter(Boolean)
      .join(' · ')

  return (
    <section ref={reveal} className="reveal space-y-6 pt-4" data-screen-label="book-detail">
      <button
        className="mono-label"
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px 0' }}
        onClick={onClose}
      >
        ← Library
      </button>
      <ErrorText>{error}</ErrorText>
      {book &&
        (editing ? (
          <HandCard className="px-6 py-5">
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
              <Cover path={book.cover_path} title={book.title} hero />
            </div>
            <div className="min-w-0 flex-1 space-y-2.5" style={{ minWidth: 220 }}>
              <h1 className="display-title" style={{ fontSize: 28, lineHeight: 1.15 }}>
                {book.title}
              </h1>
              {metaLine && (
                <MonoLabel className="block" style={{ fontSize: 11.5 }}>
                  {metaLine}
                </MonoLabel>
              )}
              <div className="flex items-center gap-3">
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
              <GhostButton onClick={() => (window.location.href = `/books/${book.id}/export`)}>
                Export .md
              </GhostButton>
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
      {book && <Annotations bookId={book.id} />}
    </section>
  )
}

function EditBook({ book, onSaved, onCancel }) {
  const [title, setTitle] = useState(book.title || '')
  const [author, setAuthor] = useState(book.author || '')
  const [isbn, setIsbn] = useState(book.isbn || '')
  const [asin, setAsin] = useState(book.asin || '')
  const [year, setYear] = useState(book.published_year ? String(book.published_year) : '')
  const [genres, setGenres] = useState((book.genres || []).join(', '))
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

  // Adopt an API candidate: fill only the fields you haven't already filled
  // (add missing info, never clobber your edits), and queue its cover if you
  // don't already have one.
  const keep = (v, next) => (String(v).trim() ? v : next || v)
  function applyCandidate(c) {
    setTitle((v) => keep(v, c.title))
    setAuthor((v) => keep(v, c.author))
    setIsbn((v) => keep(v, c.isbn13))
    setYear((v) => keep(v, c.published_year ? String(c.published_year) : ''))
    setDescription((v) => keep(v, c.description))
    setGenres((v) => keep(v, c.genres && c.genres.length ? c.genres.join(', ') : ''))
    if (c.cover_url && !coverPath && !coverUrl) {
      setCoverUrl(c.cover_url)
      setClearCover(false)
    }
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
      genres: splitCommas(genres),
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
      />
      <BookLookupPicker isbn={isbn} title={title} asin={asin} onPick={applyCandidate} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Field label="Author" value={author} onChange={(e) => setAuthor(e.target.value)} />
        <Field label="ISBN" value={isbn} onChange={(e) => setIsbn(e.target.value)} />
        <Field label="ASIN" value={asin} onChange={(e) => setAsin(e.target.value)} />
        <Field label="Year" inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value)} />
      </div>
      <label className="block">
        <MonoLabel className="mb-1.5 block">Genres (comma-separated)</MonoLabel>
        <input className="tp-input" value={genres} onChange={(e) => setGenres(e.target.value)} />
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
function annotationState(a) {
  return {
    quote: a.quote || '',
    note: a.note || '',
    chapter: a.chapter || '',
    location: a.location || '',
    color: a.color || 'yellow',
    tags: a.tags || [],
    favorite: !!a.favorite,
    rating: a.rating || 0,
  }
}

// Annotations is the per-book annotation section: filter row, hand-drawn
// cards, and the dashed ＋ Add annotation tile (§8.5).
function Annotations({ bookId }) {
  const [items, setItems] = useState(null)
  const [tags, setTags] = useState([]) // tag objects: {id, name, color, style, …}
  const [color, setColor] = useState('') // filter, '' = all
  const [tag, setTag] = useState('') // filter by NAME, '' = all
  const [fav, setFav] = useState(false)
  const [minRating, setMinRating] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [addOpen, setAddOpen] = useState(false)
  const [total, setTotal] = useState(null) // unfiltered count for "N quotes · M shown"
  const [error, setError] = useState('')
  const reqSeq = useRef(0)

  const filtering = Boolean(color || tag || fav || minRating)
  // Chips take colour + style from the tag object (name-keyed map).
  const tagMap = useMemo(() => Object.fromEntries(tags.map((t) => [t.name, t])), [tags])

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

  const countsLabel = !items
    ? ''
    : filtering && total != null
      ? `${plural(total, 'quote')} · ${items.length} shown`
      : plural(items.length, 'quote')

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <MonoLabel>filter</MonoLabel>
        <ColorSwatches value={color} onChange={(c) => setColor(c === color ? '' : c)} />
        {tags.length > 0 && (
          <select
            className="tp-input w-auto"
            title="Filter by tag"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
          >
            <option value="">all tags</option>
            {tags.map((t) => (
              <option key={t.id} value={t.name}>
                {t.name}
              </option>
            ))}
          </select>
        )}
        <button onClick={() => setFav(!fav)} className={filterChipClass(fav)} title="Only favourites">
          ♥ favourites
        </button>
        <select
          className="tp-input w-auto"
          title="Minimum rating"
          value={minRating}
          onChange={(e) => setMinRating(e.target.value)}
        >
          <option value="">any rating</option>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              rating ≥ {n}
            </option>
          ))}
        </select>
        <span className="ml-auto">
          <MonoLabel>{countsLabel}</MonoLabel>
        </span>
      </div>

      <ErrorText>{error}</ErrorText>
      {items && items.length === 0 && (
        <EmptyState>
          {filtering ? 'no annotations match the filters' : 'no annotations yet — add your first below'}
        </EmptyState>
      )}
      {items && items.length > 0 && (
        <ul className="space-y-4">
          {items.map((a, i) => (
            <li key={a.id}>
              <HandCard variant={i % 4} colorBar={a.color} className="px-5 py-4">
                {editingId === a.id ? (
                  <AnnotationForm
                    initial={a}
                    onSubmit={(fields) => save(a.id, fields)}
                    onCancel={() => setEditingId(null)}
                    submitLabel="Save"
                  />
                ) : (
                  <div className="flex items-start gap-4">
                    <div className="min-w-0 flex-1 space-y-2">
                      {a.quote && (
                        <p className="whitespace-pre-wrap" style={QUOTE_STYLE}>
                          {a.quote}
                        </p>
                      )}
                      {(a.chapter || a.location) && (
                        <MonoLabel className="block">
                          {[a.chapter && `CH. ${a.chapter}`, a.location && `P.${a.location}`]
                            .filter(Boolean)
                            .join(' · ')}
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
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Hearts value={!!a.favorite} onChange={(v) => patch(a, { favorite: v })} />
                      <TiltStars value={a.rating || 0} onChange={(v) => patch(a, { rating: v })} />
                      <div className="mt-1 flex gap-2">
                        <button className="tp-link" onClick={() => setEditingId(a.id)}>
                          edit
                        </button>
                        <button className="tp-link tp-link-danger" onClick={() => remove(a)}>
                          delete
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </HandCard>
            </li>
          ))}
        </ul>
      )}

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
  )
}

// AnnotationForm serves both add (no initial) and inline edit (initial set).
// onSubmit receives the full field state and returns an error string or null.
function AnnotationForm({ initial, onSubmit, onCancel, submitLabel }) {
  const [quote, setQuote] = useState(initial?.quote || '')
  const [note, setNote] = useState(initial?.note || '')
  const [chapter, setChapter] = useState(initial?.chapter || '')
  const [location, setLocation] = useState(initial?.location || '')
  const [color, setColor] = useState(initial?.color || 'yellow')
  const [tags, setTags] = useState((initial?.tags || []).join(', '))
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
      tags: splitCommas(tags),
      // favorite/rating are edited on the card, not in the form — but PUT is
      // full-state, so carry the existing values through.
      favorite: !!initial?.favorite,
      rating: initial?.rating || 0,
    })
    setBusy(false)
    if (err) return setError(err)
    if (!initial) {
      setQuote('')
      setNote('')
      setChapter('')
      setLocation('')
      setColor('yellow')
      setTags('')
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block">
        <MonoLabel className="mb-1.5 block">Quote</MonoLabel>
        <textarea className="tp-input" rows="3" value={quote} onChange={(e) => setQuote(e.target.value)} />
      </label>
      <label className="block">
        <MonoLabel className="mb-1.5 block">Note</MonoLabel>
        <textarea className="tp-input" rows="2" value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Chapter" value={chapter} onChange={(e) => setChapter(e.target.value)} />
        <Field label="Location" placeholder="e.g. 1042" value={location} onChange={(e) => setLocation(e.target.value)} />
      </div>
      <label className="block">
        <MonoLabel className="mb-1.5 block">Tags (comma-separated)</MonoLabel>
        <input className="tp-input" value={tags} onChange={(e) => setTags(e.target.value)} />
      </label>
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
