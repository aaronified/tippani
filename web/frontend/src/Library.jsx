import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DEMO, json, errText, downloadPost } from './api.js'
import { CoverControls, BookLookupPicker } from './CoverPicker.jsx'
import { FlowQuote } from './flow.jsx'
import { ScreenHelpSheet } from './help.jsx'
import { WorkDetails } from './WorkDetails.jsx'
import { StickerImg, StickerPicker, useStickers } from './stickers.jsx'
import { ShareDialog, bookShare } from './share.jsx'
import { PersonCredit, PersonModal, PersonPortrait, parseCreditSeps, splitCredits, usePeople } from './people.jsx'
import {
  ACTIVE_STATUS,
  GroupHeading,
  InProgressCapDialog,
  MobileDetailBar,
  SHELF_CAPS,
  ShelfControl,
  ShelfDateDialog,
  WorkCard,
  WorkHero,
  WorkListScaffold,
  groupWorks,
  isActive,
  moveLabel,
  pinInProgress,
  statusFilter,
  wishFilter,
} from './works.jsx'
import {
  bySeries,
  clampSequence,
  ColorSwatches,
  ConfirmDialog,
  Cover,
  EmptyState,
  ErrorText,
  ExpandableText,
  Field,
  filterChipClass,
  FormModal,
  GenreFilter,
  GhostButton,
  HandCard,
  HandNote,
  Hearts,
  IconButton,
  IconDelete,
  IconDetails,
  IconExport,
  IconFilter,
  IconHelp,
  IconPlus,
  IconReading,
  Masonry,
  MobileSheet,
  MonoLabel,
  MoreMenu,
  mulberry32,
  PageHeader,
  QuoteActions,
  ReviewDot,
  Select,
  seriesLabel,
  SheetFooter,
  splitCommas,
  TableActions,
  TagChip,
  titleCaseGenre,
  todayPartial,
  TokenInput,
  Tooltip,
  useColumnsAt,
  useCoverSize,
  useIsMobileScreen,
  usePersistedState,
  useReveal,
  ViewToggle,
} from './ui.jsx'

const PRIMARY = 'tp-btn tp-btn-primary' // aesthetic-aware primary (§6)
const QUOTE_STYLE = { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 16.5, lineHeight: 1.55 }

// Library is the books tab (§8.3): the cover grid, or a single book's detail
// view (§8.5). Adding anything — a book, a highlight, an import — belongs to the
// shell's one ＋ Add surface (`onAdd`), which since 1.4.1 knows it is on this
// page and opens on the right thing; `dataNonce` is how anything saved there
// tells whichever list it changed — the book grid or a book's quotes — to refetch.
export default function Library({ openId, onOpen, onClose, onOpenMovie, creditSeparators, onAdd, dataNonce }) {
  if (openId) {
    return (
      <BookDetail
        id={openId}
        onClose={onClose}
        creditSeparators={creditSeparators}
        onAdd={onAdd}
        dataNonce={dataNonce}
      />
    )
  }
  return <BookList onOpen={onOpen} onOpenMovie={onOpenMovie} creditSeparators={creditSeparators} dataNonce={dataNonce} />
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
// detail-header ♥ so a single-field change carries every other field intact.
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
    // status / progress / reads are deliberately absent: they belong to
    // PUT /books/:id/status, so an ordinary save can never rewrite the shelf or
    // the read log (see bookDetail in book_handlers.go).
  }
}

// setBookStatus moves one book to a shelf state. Its own endpoint, because the
// transition and the read log have to move together. Returns an error string.
async function setBookStatus(id, body) {
  const r = await json('PUT', `/books/${id}/status`, body)
  return r.ok ? '' : errText(r, 'could not save')
}

// BookGrid is the cover-tile board, shared by the flat list and each group.
function BookGrid({ books, coverSize, onOpen, authorMap = {}, seps }) {
  return (
    <ul className="grid gap-x-6 gap-y-9" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${coverSize}px, 1fr))` }}>
      {books.map((b, i) => (
        <li key={b.id}>
          <WorkCard kind="book" item={b} index={i} onOpen={onOpen} people={authorMap} seps={seps} />
        </li>
      ))}
    </ul>
  )
}

// ---- book list (§8.3, mockups 06–07) ----

function BookList({ onOpen, onOpenMovie, creditSeparators, dataNonce }) {
  const [books, setBooks] = useState(null)
  const [genre, setGenre] = useState('') // '' = All
  const [series, setSeries] = useState('') // '' = all series
  const [fav, setFav] = useState(false)
  const [tagged, setTagged] = useState(false) // has at least one tagged quote
  const [noted, setNoted] = useState(false) // has at least one quote with a note
  const [wish, setWish] = useState('') // '' = all | 'wishlist' | 'annotated'
  const [states, setStates] = useState([]) // shelf states kept; [] = every state
  const [sort, setSort] = useState('recent')
  const [groupBy, setGroupBy] = useState('none') // none | series | author | decade | genre
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')
  const [coverSize] = useCoverSize('tippani:size:books', 165) // set from Settings
  const mobile = useIsMobileScreen()
  const authors = usePeople('author') // name→metadata, for author-group portraits
  const [person, setPerson] = useState(null) // { kind, name } open in the metadata panel

  async function load() {
    const r = await json('GET', '/books')
    if (r.ok) setBooks(r.data.books)
    else setError(errText(r))
  }
  useEffect(() => {
    load()
    // A book added through the shell's Add surface lands server-side without this
    // list knowing — and when the surface was opened FROM here, nothing remounts
    // on the way back, so there is no other moment to refetch at.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataNonce])

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
    if (tagged) list = list.filter((b) => (b.tagged_count || 0) > 0)
    if (noted) list = list.filter((b) => (b.noted_count || 0) > 0)
    list = statusFilter(list, states)
    list = wishFilter(list, wish, (b) => b.annotation_count || 0)
    // Default view = server order (created_at DESC) with what you're reading
    // floated to the top; an explicit sort takes over completely.
    if (sort === 'recent') return pinInProgress(list, 'book')
    list = [...list]
    if (sort === 'title') list.sort((a, b) => a.title.localeCompare(b.title))
    else if (sort === 'author') list.sort((a, b) => (a.author || '').localeCompare(b.author || ''))
    else if (sort === 'series') list.sort(bySeries)
    return list
  }, [books, genre, series, fav, tagged, noted, states, wish, sort])

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
    <WorkListScaffold
      mobile={mobile}
      title="Books"
      counts={books ? `${plural(books.length, 'book')} · ${plural(quoteTotal, 'quote')}` : ''}
      error={error}
      onExport={() => setExporting(true)}
      headerAside={<MonoLabel className="hidden sm:inline">lookup: ISBN or title</MonoLabel>}
      loaded={books != null}
      hasItems={!!(books && books.length > 0)}
      shownCount={shown.length}
      emptyText="no books yet — the ＋ in the top bar adds one, or imports a file of highlights"
      noMatchText="no books match these filters"
      genres={genres}
      genre={genre}
      setGenre={setGenre}
      fav={fav}
      setFav={setFav}
      tagged={tagged}
      setTagged={setTagged}
      noted={noted}
      setNoted={setNoted}
      wish={wish}
      setWish={setWish}
      states={states}
      setStates={setStates}
      kind="book"
      noun="book"
      seriesNames={seriesNames}
      series={series}
      setSeries={setSeries}
      sort={sort}
      setSort={setSort}
      sortOptions={[['recent', 'Recent'], ['title', 'Title'], ['author', 'Author'], ['series', 'Series']]}
      trailing={
        <label className="flex items-center gap-2">
          <MonoLabel>group</MonoLabel>
          <Select
            ariaLabel="Group by"
            value={groupBy}
            onChange={setGroupBy}
            options={[['none', 'Books'], ['series', 'Series'], ['author', 'Author'], ['decade', 'Decade'], ['genre', 'Genre']]}
          />
        </label>
      }
      trailingMobile={
        <div>
          <MonoLabel className="mb-2 block">group</MonoLabel>
          <Select
            ariaLabel="Group by"
            value={groupBy}
            onChange={setGroupBy}
            options={[['none', 'Books'], ['series', 'Series'], ['author', 'Author'], ['decade', 'Decade'], ['genre', 'Genre']]}
          />
        </div>
      }
      onReset={() => { setGenre(''); setFav(false); setTagged(false); setNoted(false); setWish(''); setStates([]); setSeries(''); setGroupBy('none'); setSort('recent') }}
      exportDialog={
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
      }
      extraModals={
        person && (
          <PersonModal kind={person.kind} name={person.name} onClose={() => setPerson(null)} onSaved={authors.reload} />
        )
      }
    >
      {grouped ? (
        <div className="space-y-10">
          {grouped.map((g) => {
            const isAuthor = groupBy === 'author' && !g.residual
            return (
              <section key={g.key}>
                <GroupHeading
                  label={g.label}
                  count={g.items.length}
                  noun="book"
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
      )}
    </WorkListScaffold>
  )
}

// ---- add-book forms (§8.4, mockups 10–11) — now hosted by AddSurface (§7) ----

// isIsbn detects a 10- or 13-digit ISBN (hyphens/spaces allowed, trailing X ok).
export function isIsbn(s) {
  const t = s.replace(/[-\s]/g, '')
  return /^(\d{9}[\dXx]|\d{13})$/.test(t)
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
    if (r.ok) onAdded(r.data) // hand back the created book (capture targets it)
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
      {/* Title is the one must-fill field, so the button stays greyed until it
          has one rather than accepting the press and answering with an error. */}
      <button className={PRIMARY} disabled={busy || !title.trim()}>
        Add book
      </button>
      {!title.trim() && <p className="microcopy" style={{ color: 'var(--faint)' }}>A title is required to save.</p>}
    </form>
  )
}

// ---- book detail (§8.5, mockups 08–09) ----

function BookDetail({ id, onClose, creditSeparators, onAdd, dataNonce }) {
  const [book, setBook] = useState(null)
  const [editing, setEditing] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false) // phone: help opens from the ⋯ menu
  const [error, setError] = useState('')
  const [person, setPerson] = useState(null) // author metadata panel
  const [mobileFilter, setMobileFilter] = useState(false)
  // Live unfiltered quote count, reported up by <Annotations>. It drives the
  // Wishlist tag, so adding this book's first quote retracts the tag on the spot
  // rather than at the next visit. null until the quotes land.
  const [quoteCount, setQuoteCount] = useState(null)
  // Shelf machinery. `pending` is a transition waiting on its date prompt;
  // `capPool` the books already reading, held while the cap dialog is open.
  const [pending, setPending] = useState(null) // { status, date }
  const [capPool, setCapPool] = useState(null)
  const [capBusyId, setCapBusyId] = useState(null)
  const [capError, setCapError] = useState('')
  const [shelfBusy, setShelfBusy] = useState(false)
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
    setQuoteCount(null)
    load()
  }, [id])

  // ---- shelf transitions -----------------------------------------------------
  // save is the one path to the status endpoint; every route below funnels here.
  async function save(status, date) {
    setShelfBusy(true)
    // Carry the current position through: a transition is about the status, and
    // the server derives progress from the position when one is set.
    const body = {
      status,
      progress: book?.progress || 0,
      pos_unit: book?.pos_unit || '',
      pos: book?.pos || 0,
      pos_total: book?.pos_total || 0,
    }
    if (status === ACTIVE_STATUS.book) body.started_at = date || ''
    else if (status === 'completed' || status === 'abandoned') body.finished_at = date || ''
    const r = await json('PUT', `/books/${id}/status`, body)
    setShelfBusy(false)
    if (r.ok) setBook(r.data)
    else setError(errText(r, 'could not save'))
  }

  // pick routes the state the user chose. Starting to read checks the soft cap
  // first, so the choice to run long is made in front of what is already on the
  // shelf; reading, completing and abandoning then ask for their date. Pausing
  // and clearing need neither — nothing about the log changes.
  async function pick(next) {
    if (!book) return
    if (next === ACTIVE_STATUS.book && book.status !== 'paused') {
      const r = await json('GET', '/books')
      if (!r.ok) return setError(errText(r))
      const pool = (r.data.books || []).filter((b) => isActive('book', b) && b.id !== book.id)
      if (pool.length >= SHELF_CAPS.book) {
        setCapError('')
        setCapPool(pool)
        return
      }
    }
    if (next === '' || next === 'paused') return save(next, '')
    setPending({ status: next, date: todayPartial() })
  }

  // Settling another book from inside the cap dialog: mark it read as of today
  // (the dialog says so, and its own page can correct the date), then carry on
  // into the transition that was blocked once the shelf has room.
  async function releaseReading(item) {
    setCapBusyId(item.id)
    const err = await setBookStatus(item.id, { status: 'completed', finished_at: todayPartial() })
    setCapBusyId(null)
    if (err) return setCapError(err)
    const left = capPool.filter((b) => b.id !== item.id)
    if (left.length < SHELF_CAPS.book) {
      setCapPool(null)
      setPending({ status: ACTIVE_STATUS.book, date: todayPartial() })
      return
    }
    setCapPool(left)
  }

  // Progress rides the status endpoint with the status unchanged rather than
  // needing a route of its own. `patch` is either { progress } or a page position
  // ({ pos_unit, pos, pos_total }) — the server derives the percentage from the
  // latter, so a physical book's page count is the authoritative number.
  async function saveProgress(patch) {
    setShelfBusy(true)
    const r = await json('PUT', `/books/${id}/status`, { status: book.status, ...patch })
    setShelfBusy(false)
    if (r.ok) setBook(r.data)
    else setError(errText(r, 'could not save'))
  }

  async function remove() {
    if (!confirm(`Delete "${book.title}" and all its annotations?`)) return
    const r = await json('DELETE', `/books/${id}`)
    if (r.ok) onClose()
    else setError(errText(r))
  }

  // patch PUTs the book's full current state with one field changed (♥ clicks
  // in the header), mirroring the annotation-card pattern.
  async function patch(fields) {
    const r = await json('PUT', `/books/${id}`, { ...bookState(book), ...fields })
    if (r.ok) setBook(r.data)
    else setError(errText(r, 'could not save'))
  }

  // Meta parts: each author is a clickable PersonName (opens the metadata
  // panel) — a joined multi-author credit renders one link per person (§11);
  // the rest are plain, interleaved with " · ".
  //
  // ISBN and ASIN deliberately do NOT appear here any more. They are catalogue
  // plumbing — nobody reads a book page to check its ISBN — and they cost the
  // credit line two segments above the quotes you came for. Both live in the
  // Details panel now, each with an InfoDot saying what it is for.
  const metaParts = book
    ? [
        ...splitCredits(book.author, parseCreditSeps(creditSeparators)).map((a) => (
          <PersonCredit key={`author-${a}`} kind="author" name={a} person={authorMap[a]} size={28} onOpen={setPerson} />
        )),
        book.published_year || null,
        seriesLabel(book) || null,
      ].filter(Boolean)
    : []

  const detailTitle = book ? (book.title || 'Untitled') : ''
  const detailAuthor = book && book.author ? book.author : ''

  return (
    <section ref={reveal} className="reveal space-y-6 md:pt-4" data-screen-label="book-detail">
      {mobile && (
        <MobileDetailBar
          onClose={onClose}
          title={detailTitle}
          meta={detailAuthor}
          actions={
            <>
              <IconButton icon={<IconFilter />} ariaLabel="Filter annotations" onClick={() => setMobileFilter(true)} />
              {/* The shell's one Add surface, opened on Capture with this book
                  already the target — not a second add form of its own. */}
              <IconButton icon={<IconPlus />} ariaLabel="Capture a quote" onClick={() => onAdd?.('quote', { type: 'book', id })} />
              <MoreMenu
                items={[
                  {
                    icon: <IconReading size={24} />,
                    label: moveLabel('book', book?.status || '', ACTIVE_STATUS.book),
                    onClick: () => pick(ACTIVE_STATUS.book),
                  },
                  ...(DEMO ? [] : [{ icon: <IconExport />, label: 'Export .md', onClick: () => { if (book) window.location.href = `/api/books/${book.id}/export` } }]),
                  { icon: <IconDetails />, label: 'Details', onClick: () => setEditing(true) },
                  { icon: <IconHelp size={24} />, label: 'What’s on this screen', onClick: () => setHelpOpen(true) },
                  { icon: <IconDelete />, label: 'Delete', onClick: remove, danger: true },
                ]}
              />
            </>
          }
        />
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
        <div>
          <WorkHero
            cover={<Cover path={book.cover_path} title={book.title} hero zoomable />}
            shadow="drop-shadow(0 12px 22px rgba(0,0,0,.34))"
            title={book.title}
            titleSize={28}
            titleStyle={{ lineHeight: 1.15 }}
            meta={
              metaParts.length > 0 && (
                // Flex row, vertically centred — the author portrait chips are
                // taller than the mono text, so a plain inline flow would seat the
                // text on the baseline and read low against the discs.
                <div className="mono-label" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', rowGap: 2, fontSize: 11.5 }}>
                  {metaParts.map((p, i) => (
                    <span key={i} style={{ display: 'inline-flex', alignItems: 'center' }}>
                      {i > 0 && <span aria-hidden="true" style={{ margin: '0 8px' }}>·</span>}
                      {p}
                    </span>
                  ))}
                </div>
              )
            }
            favorite={book.favorite}
            onFavorite={(v) => patch({ favorite: v })}
            // Shelf state, beside the hearts: the state chip (its popover holds
            // the transitions and, while reading, the progress field) and the ×N
            // read counter. A set status wins over the derived Wishlist tag.
            tags={
              <ShelfControl
                kind="book"
                item={book}
                status={book.status}
                progress={book.progress}
                pos={book}
                reads={book.reads}
                wishlist={quoteCount === 0}
                busy={shelfBusy}
                onSelect={pick}
                onProgress={saveProgress}
              />
            }
            genres={bookGenres(book)}
            description={book.description}
            // Desktop only: on mobile these same actions live in the sticky bar's
            // ⋯ overflow above, and a second standing row just duplicated them.
            // Desktop only: on mobile these same actions live in the sticky
            // bar's ⋯ overflow above. Everything but the shelf move is a glyph
            // now — the row used to be four wide word-buttons floated over the
            // description, which is the one thing on the page worth reading.
            actions={
              mobile ? null : (
                <>
                  {/* The one shelf action worth a standing button; the rest of
                      the lifecycle lives in the state chip's popover. */}
                  <GhostButton onClick={() => pick(ACTIVE_STATUS.book)} disabled={shelfBusy}>
                    {moveLabel('book', book.status || '', ACTIVE_STATUS.book)}
                  </GhostButton>
                  {!DEMO && (
                    <IconButton
                        icon={<IconExport />}
                        ariaLabel="Export as Markdown"
                        onClick={() => (window.location.href = `/api/books/${book.id}/export`)}
                      tooltip="Export as Markdown"
                    />
                  )}
                  <IconButton icon={<IconDetails />} ariaLabel="Details" onClick={() => setEditing(true)} tooltip="Details and metadata" />
                  <IconButton
                      icon={<IconDelete />}
                      ariaLabel="Delete this book"
                      onClick={remove}
                      danger
                    tooltip="Delete this book"
                  />
                </>
              )
            }
          />
        </div>
      )}
      {book && (
        <WorkDetails
          open={editing}
          onClose={() => setEditing(false)}
          kind="book"
          item={book}
          onChanged={setBook}
          onDelete={remove}
        />
      )}
      <InProgressCapDialog
        open={!!capPool}
        items={(capPool || []).map((b) => ({ id: b.id, title: b.title, meta: [b.author, b.published_year || null].filter(Boolean).join(' · ') }))}
        cap={SHELF_CAPS.book}
        noun="book"
        verb="reading"
        pastLabel="Mark as read"
        busyId={capBusyId}
        error={capError}
        onRelease={releaseReading}
        onCancel={() => setCapPool(null)}
        onProceed={() => { setCapPool(null); setPending({ status: ACTIVE_STATUS.book, date: todayPartial() }) }}
      />
      <ShelfDateDialog
        open={!!pending}
        title={pending ? moveLabel('book', book?.status || '', pending.status) : ''}
        label={pending?.status === ACTIVE_STATUS.book ? 'Started' : pending?.status === 'abandoned' ? 'Gave up' : 'Finished'}
        value={pending?.date || ''}
        onChange={(v) => setPending((p) => (p ? { ...p, date: v } : p))}
        onCancel={() => setPending(null)}
        onConfirm={() => { const p = pending; setPending(null); save(p.status, p.date) }}
      />
      {book && <Annotations bookId={book.id} book={book} authorMap={authorMap} seps={parseCreditSeps(creditSeparators)} onCount={setQuoteCount} mobileFilterOpen={mobileFilter} onMobileFilterOpen={setMobileFilter} onAdd={onAdd} dataNonce={dataNonce} />}
      {person && <PersonModal kind={person.kind} name={person.name} onClose={() => setPerson(null)} />}
      {/* Phone-only route into this screen's help: the sticky bar has no room
          for a "?", so the ⋯ menu opens the same panel the desktop button does. */}
      <ScreenHelpSheet screen="book-detail" open={helpOpen} onClose={() => setHelpOpen(false)} />
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
      // favorite is edited on the detail header, not here — but PUT is
      // full-state, so carry the current value through. (Shelf status and the
      // read log are not part of this body at all: PUT /books/:id cannot touch
      // them, so an ordinary save can never rewrite reading history.)
      favorite: !!book.favorite,
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
        {/* Greyed until the must-fill field has a value: an empty title would
            be refused by the handler anyway, so the button says so first. */}
        <button className={PRIMARY} disabled={busy || !title.trim()}>
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
    // carry the attached sticker + its seal position through every full-state
    // PUT so a favourite/drag patch never wipes them (nulls = no sticker /
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
function ActionRow({ a, color, onColor, patch, setEditingId, remove, onShare, actionsAlwaysVisible }) {
  // §7 declutter: the favourite ♥ is the card's resting mark; share/edit/delete
  // hide until the card is hovered (desktop) or behind a ⋯ overflow (mobile),
  // so the resting card sheds its standing button row (see QuoteActions). The
  // colour quick-pick rides the same hover gate on desktop; on a phone there is
  // no hover, so it stands between the ♥ and the ⋯ — one tap to recolour.
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 pt-1.5">
      <Hearts value={!!a.favorite} onChange={(v) => patch(a, { favorite: v })} />
      {/* shrink-0: the four blobs are one atomic control — the row wraps the ⋯
          cluster to a second line before it splits or squeezes them. */}
      <span className={'card-colors shrink-0' + (actionsAlwaysVisible ? ' is-visible' : '')}>
        <ColorSwatches value={color} onChange={onColor} ariaLabel="Colour category" />
      </span>
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
// AnnotationCard renders one saved quote. It is shared by three kinds, not one:
// a book annotation, and — since §24 — a standalone quote, which has no chapter,
// no page and no parent work but is otherwise the same object.
//
// The two things that differ are passed in rather than branched on:
//
//   meta   the small line under the quote. Defaults to CH./P./date.
//   form   the edit form. Defaults to AnnotationForm.
//
// EXTENDING THIS RATHER THAN WRITING A THIRD CARD IS DELIBERATE. `.card-actions`
// and `.card-colors` are revealed only under `.hand-card:hover/:focus-within`
// and `.film-frame:hover/:focus-within`, `.hand-card::before` is what carries
// the paper/metal material, and the mobile rules that narrow the heart and the
// colour dots are keyed to the same two selectors. A bespoke wrapper would look
// right on a desktop screenshot and silently lose the aesthetic toggle, the
// hover affordances and the 320px layout all at once.
export function AnnotationCard({ a, variant, tagMap, stickerMap = {}, stickers = [], reloadStickers, editing, setEditingId, save, patch, remove, onShare, quoteLines = 6, tagSuggestions = [], actionsAlwaysVisible = false, editInline = false, expanded, onToggleExpand, meta, form: Form = AnnotationForm }) {
  const sticker = a.sticker_id != null ? stickerMap[a.sticker_id] : null
  // Accordion mode (tiles board): the parent owns which quote is open, so one
  // expands at a time. Elsewhere (list, search modal) each card keeps its own.
  const accordion = typeof onToggleExpand === 'function'
  const d = fmtDate(annDate(a))
  // Optimistic colour. patch() refetches the whole list before the row comes
  // back changed, so the quick-pick paints the card's bar (and the picked dot)
  // itself the instant it's tapped. The preview clears as soon as the refetched
  // row carries the new colour, and rolls back if the PUT failed.
  const [pendingColor, setPendingColor] = useState(null)
  useEffect(() => { setPendingColor(null) }, [a.color])
  const color = pendingColor || a.color
  const pickColor = async (c) => {
    if (c === color) return // no clear: the server has no "no colour" (validColor)
    setPendingColor(c)
    if ((await patch(a, { color: c })) === false) setPendingColor(null)
  }
  // `meta` undefined falls back to the book locator; '' means "no line at all",
  // which is why the test is against undefined rather than falsiness.
  const metaLine =
    meta === undefined
      ? [a.chapter && `CH. ${a.chapter}`, a.location && `P.${a.location}`, d].filter(Boolean).join(' · ')
      : meta
  const editForm = (
    <Form initial={a} onSubmit={(fields) => save(a.id, fields)} onCancel={() => setEditingId(null)} submitLabel="Save" tagSuggestions={tagSuggestions} stickers={stickers} reloadStickers={reloadStickers} />
  )
  // editInline renders the form in place of the card body — used inside the
  // search QuoteModal, which is itself a pop-up (avoids stacking two overlays).
  // Everywhere else the edit opens in a FormModal, the house style.
  if (editInline && editing) {
    return (
      <HandCard variant={variant} colorBar={color} className="px-5 py-4">
        {editForm}
      </HandCard>
    )
  }
  return (
    <HandCard variant={variant} colorBar={color} className="px-5 py-4">
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
            {metaLine && <MonoLabel className="block">{metaLine}</MonoLabel>}
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
          <ActionRow a={a} color={color} onColor={pickColor} patch={patch} setEditingId={setEditingId} remove={remove} onShare={onShare} actionsAlwaysVisible={actionsAlwaysVisible} />
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
                <Tooltip label="Sort by this column" side="bottom">
                  {c.label}
                  {arrow(c.key)}
                </Tooltip>
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
                <TableActions
                  noun="quote"
                  onShare={onShare && (() => onShare(a))}
                  onEdit={() => setEditingId(a.id)}
                  onDelete={() => remove(a)}
                />
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

// Annotations is the per-book annotation section: filter row and hand-drawn
// cards (§8.5). Adding opens in the standard pop-up form (FormModal) — the
// sticky-bar ＋ on phones; the omnipresent top-bar ＋ Add elsewhere.
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

function Annotations({ bookId, book, authorMap = {}, seps, onCount, mobileFilterOpen, onMobileFilterOpen, onAdd, dataNonce }) {
  const [items, setItems] = useState(null)
  const [tags, setTags] = useState([]) // tag objects: {id, name, color, style, …}
  const [shareTarget, setShareTarget] = useState(null) // annotation being shared
  const [color, setColor] = useState('') // filter, '' = all
  const [tag, setTag] = useState('') // filter by NAME, '' = all
  const [fav, setFav] = useState(false)
  const [editingId, setEditingId] = useState(null)
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

  // A quote captured through the shell's Add surface lands server-side without
  // this list knowing, so the shell ticks dataNonce and the list refetches.
  // Skips the first render — the load() effect below already covers the mount.
  const firstNonce = useRef(true)
  useEffect(() => {
    if (firstNonce.current) { firstNonce.current = false; return }
    setExpandedId(null) // collapse before the longer set re-packs the board
    load()
    loadTags() // a capture can invent a tag
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataNonce])

  // Report the unfiltered quote count up to the detail: it is what decides the
  // Wishlist tag, and `total` is already kept live through adds and deletes, so
  // adding this book's first quote retracts the tag on the spot.
  useEffect(() => {
    if (total != null) onCount?.(total)
  }, [total])

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

  // patch PUTs a row's full current state with one field changed (♥ clicks, the
  // colour quick-pick, sticker drags). Resolves false when the save failed, so
  // an optimistic caller can roll its preview back.
  async function patch(a, fields) {
    const r = await json('PUT', `/annotations/${a.id}`, { ...annotationState(a), ...fields })
    if (!r.ok) {
      setError(errText(r, 'could not save annotation'))
      return false
    }
    setError('')
    load()
    return true
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
      tags: a.tags,
      color: a.color,
      people: authorMap,
      seps,
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
            {/* Both form factors now open the ONE Add surface, on Capture with
                this book as the target — the shell's ＋ knows which page it is
                on. This is the desktop route to it; the phone's is the ＋ in the
                detail bar above. */}
            <GhostButton onClick={() => onAdd?.('quote', { type: 'book', id: bookId })}>＋ Capture a quote</GhostButton>
          </span>
        </div>
      )}

      <ErrorText>{error}</ErrorText>

      {items && items.length === 0 && (
        <EmptyState>
          {filtering ? 'no annotations match the filters' : 'no annotations yet — the ＋ in the bar above captures your first'}
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

  // The must-fill rule, stated once: the guard below and the greyed-out button
  // read the same value, so the button is never pressable in a state the
  // handler would refuse.
  const missing = !quote.trim() && !note.trim() ? 'Write a quote or a note' : ''

  async function submit(e) {
    e.preventDefault()
    if (missing) return setError(missing.toLowerCase())
    setBusy(true)
    setError('')
    const err = await onSubmit({
      quote: quote.trim(),
      note: note.trim(),
      chapter: chapter.trim(),
      location: location.trim(),
      color,
      tags,
      // favorite is edited on the card, not in the form — but PUT is
      // full-state, so carry the existing value through.
      favorite: !!initial?.favorite,
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
          <button className={PRIMARY} disabled={busy || !!missing} title={missing || undefined}>
            {submitLabel}
          </button>
        </div>
      </div>
      <ErrorText>{error}</ErrorText>
    </form>
  )
}
