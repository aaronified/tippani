import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DEMO, coverImgURL, json, errText, downloadPost } from './api.js'
import AddSurface from './AddSurface.jsx'
import { CoverControls, BookLookupPicker } from './CoverPicker.jsx'
import { FlowQuote } from './flow.jsx'
import { StickerImg, StickerPicker, useStickers } from './stickers.jsx'
import { ShareDialog, bookShare } from './share.jsx'
import { CreditFaces, PersonCredit, PersonModal, PersonPortrait, parseCreditSeps, splitCredits, usePeople } from './people.jsx'
import { groupWorks } from './works.jsx'
import {
  ColorSwatches,
  ConfirmDialog,
  Cover,
  EmptyState,
  ErrorText,
  FavBadge,
  Field,
  FormModal,
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
  Masonry,
  MobileSheet,
  MoreMenu,
  MonoLabel,
  mulberry32,
  clampSequence,
  PageHeader,
  Placeholder,
  QuoteActions,
  ReviewDot,
  Select,
  SheetFooter,
  TagChip,
  titleCaseGenre,
  TokenInput,
  ViewToggle,
  bySeries,
  filterChipClass,
  seriesLabel,
  splitCommas,
  useColumnsAt,
  useCoverSize,
  useIsMobileScreen,
  usePersistedState,
  useReveal,
} from './ui.jsx'

const PRIMARY = 'tp-btn tp-btn-primary' // aesthetic-aware primary (§6)
const QUOTE_STYLE = { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 16.5, lineHeight: 1.55 }

// Library is the books tab (§8.3): cover grid + add-book modal, or a single
// book's detail view (§8.5). Import flows live on the Import page now.
export default function Library({ openId, onOpen, onClose, onOpenMovie, creditSeparators }) {
  if (openId) return <BookDetail id={openId} onClose={onClose} creditSeparators={creditSeparators} />
  return <BookList onOpen={onOpen} onOpenMovie={onOpenMovie} creditSeparators={creditSeparators} />
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
function BookGrid({ books, coverSize, onOpen, authorMap = {}, seps }) {
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
            <div className="flex items-center gap-1.5">
              {/* Author face(s): a portrait per credited author, co-authors
                  overlapping with the first on top (CreditFaces). */}
              <CreditFaces names={splitCredits(b.author, seps)} map={authorMap} size={24} ring="var(--bg)" />
              <p className="min-w-0 truncate text-[13px]" style={{ color: 'var(--soft)' }}>
                {[b.author, b.published_year || null].filter(Boolean).join(' · ')}
              </p>
            </div>
            {b.series && (
              <p className="truncate text-[12px]" style={{ color: 'var(--faint)', fontStyle: 'italic' }}>
                {seriesLabel(b)}
              </p>
            )}
            <div className="mt-0.5 flex items-center gap-2">
              <MonoLabel style={{ color: 'var(--accent-ui)' }}>{plural(b.annotation_count, 'quote')}</MonoLabel>            </div>
          </button>
        </li>
      ))}
    </ul>
  )
}

// ---- book list (§8.3, mockups 06–07) ----

function BookList({ onOpen, onOpenMovie, creditSeparators }) {
  const [books, setBooks] = useState(null)
  const [genre, setGenre] = useState('') // '' = All
  const [series, setSeries] = useState('') // '' = all series
  const [fav, setFav] = useState(false)
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
    if (sort === 'recent') return list // server order (created_at DESC)
    list = [...list]
    if (sort === 'title') list.sort((a, b) => a.title.localeCompare(b.title))
    else if (sort === 'author') list.sort((a, b) => (a.author || '').localeCompare(b.author || ''))
    else if (sort === 'series') list.sort(bySeries)
    return list
  }, [books, genre, series, fav, sort])

  const creditSeps = useMemo(() => parseCreditSeps(creditSeparators), [creditSeparators])
  const grouped = useMemo(
    () =>
      groupBy === 'none'
        ? null
        : groupWorks(shown, groupBy, {
            credit: (b) => b.author,
            splitCredit: true,
            creditResidual: 'Unknown author',
            year: (b) => b.published_year,
            genres: bookGenres,
            series: (b) => b.series,
            seps: creditSeps,
            sortMembers: (items, dim) => (dim === 'series' ? [...items].sort(bySeries) : items),
          }),
    [shown, groupBy, creditSeps],
  )

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
                options={[['recent', 'Recent'], ['title', 'Title'], ['author', 'Author'], ['series', 'Series']]}
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
              onReset={() => { setGenre(''); setFav(false); setSeries(''); setGroupBy('none'); setSort('recent') }}
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
                options={[['recent', 'Recent'], ['title', 'Title'], ['author', 'Author'], ['series', 'Series']]}
              />
            </div>
          </div>
        </MobileSheet>
      )}

      {books && books.length === 0 && (
        <EmptyState>no books yet — add one, or bring highlights in from ＋ Add › Import</EmptyState>
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
                    count={g.items.length}
                    person={isAuthor ? authors.map[g.label] : null}
                    onOpenPerson={isAuthor ? () => setPerson({ kind: 'author', name: g.label }) : undefined}
                  />
                  <BookGrid books={g.items} coverSize={coverSize} onOpen={onOpen} authorMap={authors.map} seps={creditSeps} />
                </section>
              )
            })}
          </div>
        ) : (
          <BookGrid books={shown} coverSize={coverSize} onOpen={onOpen} authorMap={authors.map} seps={creditSeps} />
        ))}

      <AddSurface
        open={adding}
        initialSection="book"
        onClose={() => setAdding(false)}
        onAdded={() => {
          setAdding(false)
          load()
        }}
        onOpenMovie={onOpenMovie}
      />
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

// ---- add-book forms (§8.4, mockups 10–11) — now hosted by AddSurface (§7) ----

// isIsbn detects a 10- or 13-digit ISBN (hyphens/spaces allowed, trailing X ok).
export function isIsbn(s) {
  const t = s.replace(/[-\s]/g, '')
  return /^(\d{9}[\dXx]|\d{13})$/.test(t)
}

export function sourceLabel(source) {
  if (source === 'google') return 'GOOGLE BOOKS'
  if (source === 'openlibrary') return 'OPEN LIBRARY'
  return (source || '').toUpperCase()
}

export function ManualTab({ onAdded }) {
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

function BookDetail({ id, onClose, creditSeparators }) {
  const [book, setBook] = useState(null)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState('')
  const [person, setPerson] = useState(null) // author metadata panel
  const [mobileFilter, setMobileFilter] = useState(false)
  const [mobileAdd, setMobileAdd] = useState(false)
  const { map: authorMap } = usePeople('author') // name→metadata, for author face icons
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

  // Meta parts: each author is a clickable PersonName (opens the metadata
  // panel) — a joined multi-author credit renders one link per person (§11);
  // the rest are plain, interleaved with " · ".
  const metaParts = book
    ? [
        ...splitCredits(book.author, parseCreditSeps(creditSeparators)).map((a) => (
          <PersonCredit key={`author-${a}`} kind="author" name={a} person={authorMap[a]} size={28} onOpen={setPerson} />
        )),
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
      {book && (
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
      )}
      {book && (
        <FormModal open={editing} onClose={() => setEditing(false)} title="Edit book">
          <EditBook
            book={book}
            onSaved={() => {
              setEditing(false)
              load()
            }}
            onCancel={() => setEditing(false)}
          />
        </FormModal>
      )}
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

  // §7: "Fetch metadata" no longer silently applies a guess — it opens the
  // edition picker (below) so you pick the right match, folding in what used to
  // be a separate "Browse other matches" button.
  const [pickerOpen, setPickerOpen] = useState(false)

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
        onFetchMeta={() => setPickerOpen((v) => !v)}
        fetchMetaOpen={pickerOpen}
        search={{ isbn, title, author, asin }}
      />
      {pickerOpen && (
        <BookLookupPicker
          auto
          isbn={isbn}
          title={title}
          author={author}
          asin={asin}
          onPick={(c) => {
            applyCandidate(c, true)
            setPickerOpen(false)
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}
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
function ActionRow({ a, patch, setEditingId, remove, onShare, actionsAlwaysVisible }) {
  // §7 declutter: the favourite ♥ is the card's resting mark; share/edit/delete
  // hide until the card is hovered (desktop) or behind a ⋯ overflow (mobile),
  // so the resting card sheds its standing button row (see QuoteActions).
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 pt-1.5">
      <Hearts value={!!a.favorite} onChange={(v) => patch(a, { favorite: v })} />
      <span className="ml-auto flex items-center">
        <QuoteActions
          onShare={onShare ? () => onShare(a) : undefined}
          onEdit={() => setEditingId(a.id)}
          onDelete={() => remove(a)}
          alwaysVisible={actionsAlwaysVisible}
        />
      </span>
    </div>
  )
}

// AnnotationCard is the shared card body for the tiles + list views. An attached
// uploaded sticker becomes the corner seal the quote flows around (pretext); the
// quote clamps to `quoteLines` with an inline show-more.
export function AnnotationCard({ a, variant, tagMap, stickerMap = {}, stickers = [], reloadStickers, editing, setEditingId, save, patch, remove, onShare, quoteLines = 6, tagSuggestions = [], actionsAlwaysVisible = false, editInline = false, expanded, onToggleExpand }) {
  const sticker = a.sticker_id != null ? stickerMap[a.sticker_id] : null
  // Accordion mode (tiles board): the parent owns which quote is open, so one
  // expands at a time. Elsewhere (list, search modal) each card keeps its own.
  const accordion = typeof onToggleExpand === 'function'
  const d = fmtDate(annDate(a))
  const editForm = (
    <AnnotationForm initial={a} onSubmit={(fields) => save(a.id, fields)} onCancel={() => setEditingId(null)} submitLabel="Save" tagSuggestions={tagSuggestions} stickers={stickers} reloadStickers={reloadStickers} />
  )
  // editInline renders the form in place of the card body — used inside the
  // search QuoteModal, which is itself a pop-up (avoids stacking two overlays).
  // Everywhere else the edit opens in a FormModal, the house style.
  if (editInline && editing) {
    return (
      <HandCard variant={variant} colorBar={a.color} className="px-5 py-4">
        {editForm}
      </HandCard>
    )
  }
  return (
    <HandCard variant={variant} colorBar={a.color} className="px-5 py-4">
      {!editInline && (
        <FormModal open={editing} onClose={() => setEditingId(null)} title="Edit quote">
          {editForm}
        </FormModal>
      )}
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
                open={accordion ? !!expanded : undefined}
                onToggle={accordion ? onToggleExpand : undefined}
              />
            ) : (
              <ExpandableText
                text={a.quote}
                lines={quoteLines}
                style={QUOTE_STYLE}
                open={accordion ? !!expanded : undefined}
                onToggle={accordion ? onToggleExpand : undefined}
              />
            ))}
          <div className="flex items-center gap-2">
            <ReviewDot item={a} />
            {(a.chapter || a.location || d) && (
              <MonoLabel className="block">
                {[a.chapter && `CH. ${a.chapter}`, a.location && `P.${a.location}`, d].filter(Boolean).join(' · ')}
              </MonoLabel>
            )}
          </div>
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
          <ActionRow a={a} patch={patch} setEditingId={setEditingId} remove={remove} onShare={onShare} actionsAlwaysVisible={actionsAlwaysVisible} />
        </div>
    </HandCard>
  )
}

const TABLE_COLS = [
  { key: 'quote', label: 'Quote' },
  { key: 'chapter', label: 'Chapter' },
  { key: 'location', label: 'Location' },
  { key: 'date', label: 'Date' },
  { key: 'favorite', label: '♥' },
]

function AnnotationTable({ rows, tagMap, stickers = [], reloadStickers, sort, onSort, editingId, setEditingId, save, remove, onShare }) {
  const arrow = (k) => (sort.col === k ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : '')
  const editingRow = rows.find((a) => a.id === editingId)
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
          {rows.map((a) => (
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
              <td className="col-center">{a.favorite ? '♥' : '—'}</td>
              <td className="col-actions">
                {onShare && <button className="tp-link" onClick={() => onShare(a)}>share</button>}
                <button className="tp-link" onClick={() => setEditingId(a.id)}>edit</button>
                <button className="tp-link tp-link-danger" onClick={() => remove(a)}>del</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <FormModal open={!!editingRow} onClose={() => setEditingId(null)} title="Edit quote">
        {editingRow && (
          <AnnotationForm initial={editingRow} onSubmit={(fields) => save(editingRow.id, fields)} onCancel={() => setEditingId(null)} submitLabel="Save" tagSuggestions={Object.keys(tagMap)} stickers={stickers} reloadStickers={reloadStickers} />
        )}
      </FormModal>
    </div>
  )
}

// Annotations is the per-book annotation section: filter row, hand-drawn
// cards, and the dashed ＋ Add annotation tile (§8.5).
// pinToTop floats just-added annotations to the front of whatever order the
// view is currently in, preserving pinnedIds' order (most-recent add first) and
// leaving the rest untouched. Ids that aren't present (filtered out, or a stale
// pin) are simply skipped. Returns the input unchanged when there's nothing to
// pin so identity is preserved for memo consumers.
function pinToTop(arr, pinnedIds) {
  if (!pinnedIds.length || !arr || !arr.length) return arr
  const pset = new Set(pinnedIds)
  const top = []
  for (const id of pinnedIds) {
    const found = arr.find((x) => x.id === id)
    if (found) top.push(found)
  }
  if (!top.length) return arr
  return [...top, ...arr.filter((x) => !pset.has(x.id))]
}

function Annotations({ bookId, book, mobileFilterOpen, onMobileFilterOpen, mobileAddOpen, onMobileAddOpen }) {
  const [items, setItems] = useState(null)
  const [tags, setTags] = useState([]) // tag objects: {id, name, color, style, …}
  const [shareTarget, setShareTarget] = useState(null) // annotation being shared
  const [color, setColor] = useState('') // filter, '' = all
  const [tag, setTag] = useState('') // filter by NAME, '' = all
  const [fav, setFav] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [addOpen, setAddOpen] = useState(false)
  const [total, setTotal] = useState(null) // unfiltered count for "N quotes · M shown"
  const [error, setError] = useState('')
  const [view, setView] = usePersistedState('tippani:annview', 'tiles') // list | tiles | table
  const [sort, setSort] = useState({ col: 'default', dir: 'asc' }) // table only; default = server (recent)
  // Ids of annotations added this session, most-recent first. They're floated to
  // the top of the pile (overriding the current order) so the user sees their
  // addition — until they sort, which clears the pin (see toggleSort).
  const [pinned, setPinned] = useState([])
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
  const filtering = Boolean(color || tag || fav)
  // Chips take colour + style from the tag object (name-keyed map).
  const tagMap = useMemo(() => Object.fromEntries(tags.map((t) => [t.name, t])), [tags])
  // Attached stickers resolve id → image for the card seal.
  const stickerMap = useMemo(() => Object.fromEntries(stickers.map((s) => [s.id, s])), [stickers])

  function toggleSort(col) {
    // Sorting is the user taking control of the order, so drop the just-added
    // pin and let the new sort decide where those items land.
    setPinned([])
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
  // What every view actually renders: the current order (server-recent for
  // list/tiles, the chosen column for table) with freshly-added items pinned on
  // top. sortedRows already returns a server-order copy of items for non-table
  // views, so this is the single source of truth for all three.
  const displayRows = useMemo(() => pinToTop(sortedRows, pinned), [sortedRows, pinned])
  // Tiles are a height-packed masonry (1/2/3 cols by width). Newly-added quotes
  // (the pinned prefix of displayRows) stay glued to the top of the board.
  const tileCols = useColumnsAt([[1280, 3], [640, 2]])
  const pinnedShown = useMemo(
    () => (!pinned.length || !items ? 0 : pinned.filter((id) => items.some((x) => x.id === id)).length),
    [pinned, items],
  )
  // One board seed drives both the masonry jitter and each card's clamp height,
  // so the two stay in step and a given book always lays out the same way.
  const boardSeed = book?.id || bookId || 1
  // Per-card clamp: uniform 3–5 lines with no three-adjacent the same, seeded off
  // the book so it's stable across reloads. The tiles board is laid out in source
  // order (newest first, new pins on top), so these clamp sizes land in that same
  // order — the no-3-in-a-row rule reads that way on the board too.
  const clampLines = useMemo(
    () => clampSequence(displayRows.length, mulberry32(boardSeed)),
    [displayRows.length, boardSeed],
  )
  // Tiles run a one-open-at-a-time accordion: expanding a quote collapses any
  // other, and the masonry order locks while one is open so columns don't jump.
  const [expandedId, setExpandedId] = useState(null)
  const toggleExpanded = useCallback((id) => setExpandedId((cur) => (cur === id ? null : id)), [])
  // Keep expandedId honest: if the open quote leaves the set (un-favourited or
  // edited out of the active filter via patch/save, which don't reset it), clear
  // it — a dangling id keeps the board's lockOrder stuck true and defeats the
  // masonry's rising-edge freeze on the next expand.
  useEffect(() => {
    if (expandedId != null && items && !items.some((x) => x.id === expandedId)) setExpandedId(null)
  }, [items, expandedId])
  // A column-count change (responsive breakpoint / rotation) re-opens masonry
  // packing; collapse any open quote at the cross so the board re-packs and
  // re-freezes off collapsed heights, not around the still-expanded card.
  useEffect(() => { setExpandedId(null) }, [tileCols])

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
    const r = await json('GET', `/annotations?${params}`)
    if (seq !== reqSeq.current) return
    if (r.ok) {
      setItems(r.data.annotations)
      if (!color && !tag && !fav) setTotal(r.data.annotations.length)
    } else setError(errText(r))
  }
  useEffect(() => {
    // A book switch or filter change swaps the tile set, so collapse any open
    // quote first: it keeps the masonry's column lock from being latched around
    // an expanded card while the set changes underneath it (see Masonry).
    setExpandedId(null)
    load()
  }, [bookId, color, tag, fav])
  useEffect(() => {
    loadTags()
  }, [bookId])

  async function add(fields) {
    const r = await json('POST', '/annotations', { book_id: bookId, ...fields })
    if (!r.ok) return errText(r, 'could not add annotation')
    const newId = r.data?.id
    setTotal((t) => (t == null ? t : t + 1))
    setExpandedId(null) // collapse before the pinned new quote reshapes the board
    // Pin the new quote to the top of the pile until the user next sorts.
    if (newId != null) setPinned((p) => [newId, ...p.filter((x) => x !== newId)])
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
      setExpandedId(null) // collapse before the shorter set re-packs
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
      color: a.color,
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
              onReset={() => { setColor(''); setTag(''); setFav(false) }}
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
          rows={displayRows}
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
          {displayRows.map((a, i) => (
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
        // Masonry board in SOURCE order (newest first; newly-added quotes ride on
        // top via the pinned prefix until refresh) — equal-width columns dealt onto
        // the shortest pile. Each card clamps to a seeded per-card 3–5 lines with no
        // three-in-a-row the same (clampLines); since the layout keeps source order,
        // those sizes vary the board without banding by height, and a quote shorter
        // than its clamp just shows in full. Clicking a quote expands it (chevron
        // affordance, no button); doing so collapses any other and locks the column
        // order so the board never reshuffles under the reader.
        <Masonry columns={tileCols} gap={16} seed={boardSeed} pinnedCount={pinnedShown} lockOrder={expandedId != null} order="source">
          {displayRows.map((a, i) => (
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
              quoteLines={clampLines[i]}
              tagSuggestions={Object.keys(tagMap)}
              expanded={expandedId === a.id}
              onToggleExpand={() => toggleExpanded(a.id)}
            />
          ))}
        </Masonry>
      )}

      {shareTarget && <ShareDialog share={sharePayload(shareTarget)} seen={{ kind: 'book', id: shareTarget.id }} onClose={() => setShareTarget(null)} />}
    </div>
  )
}

// AnnotationForm serves both add (no initial) and inline edit (initial set).
// onSubmit receives the full field state and returns an error string or null.
// Exported for Home's favourite-tile inline edit (same form, same contract).
export function AnnotationForm({ initial, onSubmit, onCancel, submitLabel, tagSuggestions = [], stickers = [], reloadStickers }) {
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
