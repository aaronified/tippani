import { useEffect, useRef, useState } from 'react'
import { json, upload, errText } from './api.js'
import {
  inputClass,
  buttonClass,
  ghostButtonClass,
  cardClass,
  linkButtonClass,
  deleteButtonClass,
  colorDotClass,
  splitCommas,
  filterChipClass,
  ErrorText,
  EmptyState,
  Chips,
  Cover,
  ColorSwatches,
  FavoriteStar,
  RatingStars,
  MinRatingSelect,
} from './ui.jsx'

// Library is the books tab: list + add/import, or a single book's detail view.
// After an import that left annotations without chapter/location, the list
// opens the book with a review pass active (PLAN §5b).
export default function Library({ openId, onOpen, onClose }) {
  const [review, setReview] = useState(null) // {bookId, msg} — pending post-import review
  if (openId) {
    return (
      <BookDetail
        id={openId}
        onClose={onClose}
        review={review && review.bookId === openId ? review : null}
        onReviewDone={() => setReview(null)}
      />
    )
  }
  return (
    <BookList
      onOpen={onOpen}
      onReview={(bookId, msg) => {
        setReview({ bookId, msg })
        onOpen(bookId)
      }}
    />
  )
}

// FileButton is a styled label wrapping a hidden file input.
function FileButton({ label, accept, onFile }) {
  return (
    <label className={ghostButtonClass + ' cursor-pointer'}>
      {label}
      <input
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          if (e.target.files[0]) onFile(e.target.files[0])
          e.target.value = ''
        }}
      />
    </label>
  )
}

function BookList({ onOpen, onReview }) {
  const [books, setBooks] = useState(null)
  const [adding, setAdding] = useState(false)
  const [importMsg, setImportMsg] = useState('')
  const [error, setError] = useState('')

  async function load() {
    const r = await json('GET', '/books')
    if (r.ok) setBooks(r.data.books)
    else setError(errText(r))
  }
  useEffect(() => {
    load()
  }, [])

  async function importFile(kind, file) {
    setImportMsg('Importing…')
    setError('')
    const r = await upload(`/import/${kind}`, file)
    if (!r.ok) {
      setImportMsg('')
      return setError(errText(r, 'import failed'))
    }
    const msg = `Import done — added ${r.data.added}, skipped ${r.data.skipped}.`
    setImportMsg(msg)
    load()
    // Post-import review pass (PLAN §5b): if any of the book's annotations lack
    // chapter or location, open the book with the review panel active.
    const a = await json('GET', `/annotations?book_id=${r.data.book_id}`)
    if (a.ok && a.data.annotations.some((x) => !x.chapter || !x.location)) {
      onReview(r.data.book_id, msg)
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold">Library</h2>
        <div className="ml-auto flex flex-wrap gap-2">
          <FileButton label="Import Markdown" accept=".md,.markdown,.txt" onFile={(f) => importFile('markdown', f)} />
          <FileButton label="Import Bookcision" accept=".json" onFile={(f) => importFile('bookcision', f)} />
          <FileButton label="Hardcover page" accept=".htm,.html" onFile={(f) => importFile('hardcover-html', f)} />
          <button className={ghostButtonClass} onClick={() => (window.location.href = '/export')}>
            Export all (.zip)
          </button>
          <button className={buttonClass} onClick={() => setAdding(!adding)}>
            {adding ? 'Close' : 'Add book'}
          </button>
        </div>
      </div>
      {importMsg && <p className="text-sm text-neutral-500 dark:text-neutral-400">{importMsg}</p>}
      <ErrorText>{error}</ErrorText>
      {adding && (
        <AddBook
          onAdded={() => {
            setAdding(false)
            load()
          }}
        />
      )}
      {books && books.length === 0 && (
        <EmptyState>No books yet — add one or import your highlights.</EmptyState>
      )}
      {books && books.length > 0 && (
        <ul className={cardClass + ' divide-y divide-neutral-200 dark:divide-neutral-800'}>
          {books.map((b) => (
            <li key={b.id}>
              <button
                onClick={() => onOpen(b.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
              >
                <Cover path={b.cover_path} title={b.title} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{b.title}</span>
                  <span className="block truncate text-xs text-neutral-500 dark:text-neutral-400">
                    {[b.author, b.published_year].filter(Boolean).join(' · ')}
                  </span>
                  <Chips items={b.genres} className="mt-1" />
                </span>
                <span className="shrink-0 text-xs text-neutral-400 dark:text-neutral-500">
                  {b.annotation_count} annotation{b.annotation_count === 1 ? '' : 's'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function AddBook({ onAdded }) {
  const [mode, setMode] = useState('lookup')
  const tabClass = (active) =>
    'rounded px-3 py-1.5 text-sm ' +
    (active
      ? 'bg-neutral-100 dark:bg-neutral-800 font-medium'
      : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100')

  return (
    <div className={cardClass + ' space-y-4 p-4'}>
      <div className="flex gap-1">
        <button className={tabClass(mode === 'lookup')} onClick={() => setMode('lookup')}>
          Lookup
        </button>
        <button className={tabClass(mode === 'manual')} onClick={() => setMode('manual')}>
          Manual
        </button>
      </div>
      {mode === 'lookup' ? <LookupBook onAdded={onAdded} /> : <ManualBook onAdded={onAdded} />}
    </div>
  )
}

// isIsbn detects a 10- or 13-digit ISBN (hyphens/spaces allowed, trailing X ok).
function isIsbn(s) {
  const t = s.replace(/[-\s]/g, '')
  return /^(\d{9}[\dXx]|\d{13})$/.test(t)
}

function LookupBook({ onAdded }) {
  const [q, setQ] = useState('')
  const [candidates, setCandidates] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

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
    else setError(errText(r, 'lookup failed'))
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
    else setError(errText(r, 'could not add book'))
  }

  return (
    <div className="space-y-3">
      <form onSubmit={search} className="flex gap-2">
        <input
          className={inputClass}
          placeholder="ISBN or title"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button className={buttonClass + ' shrink-0'} disabled={busy}>
          {busy ? 'Searching…' : 'Search'}
        </button>
      </form>
      <ErrorText>{error}</ErrorText>
      {candidates && candidates.length === 0 && (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">No matches found.</p>
      )}
      {candidates && candidates.length > 0 && (
        <ul className="divide-y divide-neutral-200 dark:divide-neutral-800 rounded border border-neutral-200 dark:border-neutral-800">
          {candidates.map((c, i) => (
            <li key={i} className="flex items-start gap-3 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {c.title}
                  <span className="ml-2 rounded-full bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 text-xs font-normal text-neutral-500 dark:text-neutral-400">
                    {c.source}
                  </span>
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {[c.author, c.published_year, c.isbn13].filter(Boolean).join(' · ')}
                </p>
                {c.description && (
                  <p className="mt-1 line-clamp-2 text-xs text-neutral-400 dark:text-neutral-500">{c.description}</p>
                )}
              </div>
              <button className={ghostButtonClass + ' shrink-0'} onClick={() => add(c)}>
                Add
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ManualBook({ onAdded }) {
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [isbn, setIsbn] = useState('')
  const [year, setYear] = useState('')
  const [genres, setGenres] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (!title.trim()) return setError('title is required')
    setBusy(true)
    setError('')
    const r = await json('POST', '/books', {
      title: title.trim(),
      author: author.trim() || undefined,
      isbn: isbn.trim() || undefined,
      published_year: year ? Number(year) : undefined,
      genres: splitCommas(genres),
      description: description.trim() || undefined,
    })
    setBusy(false)
    if (r.ok) onAdded()
    else setError(errText(r, 'could not add book'))
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        <input className={inputClass} placeholder="Title (required)" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input className={inputClass} placeholder="Author" value={author} onChange={(e) => setAuthor(e.target.value)} />
        <input className={inputClass} placeholder="ISBN" value={isbn} onChange={(e) => setIsbn(e.target.value)} />
        <input className={inputClass} placeholder="Year" inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value)} />
      </div>
      <input className={inputClass} placeholder="Genres (comma-separated)" value={genres} onChange={(e) => setGenres(e.target.value)} />
      <textarea className={inputClass} rows="3" placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
      <ErrorText>{error}</ErrorText>
      <button className={buttonClass} disabled={busy}>
        Add book
      </button>
    </form>
  )
}

function BookDetail({ id, onClose, review, onReviewDone }) {
  const [book, setBook] = useState(null)
  const [editing, setEditing] = useState(false)
  const [annRefresh, setAnnRefresh] = useState(0) // bumped when the review panel saves
  const [error, setError] = useState('')

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

  return (
    <section className="space-y-4">
      <button onClick={onClose} className={linkButtonClass}>
        ← Library
      </button>
      <ErrorText>{error}</ErrorText>
      {book && (
        <div className={cardClass + ' p-4'}>
          {editing ? (
            <EditBook
              book={book}
              onSaved={() => {
                setEditing(false)
                load()
              }}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <div className="flex items-start gap-4">
              <Cover path={book.cover_path} title={book.title} large />
              <div className="min-w-0 flex-1 space-y-1">
                <h2 className="text-lg font-semibold">{book.title}</h2>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  {[book.author, book.published_year].filter(Boolean).join(' · ')}
                </p>
                {(book.isbn || book.asin) && (
                  <p className="text-xs text-neutral-400 dark:text-neutral-500">
                    {[book.isbn && `ISBN ${book.isbn}`, book.asin && `ASIN ${book.asin}`]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                )}
                <Chips items={book.genres} className="pt-1" />
                {book.description && (
                  <p className="pt-2 text-sm text-neutral-600 dark:text-neutral-300 whitespace-pre-wrap">
                    {book.description}
                  </p>
                )}
                <div className="flex gap-3 pt-2">
                  <button className={linkButtonClass} onClick={() => setEditing(true)}>
                    edit
                  </button>
                  <button
                    className={linkButtonClass}
                    onClick={() => (window.location.href = `/books/${book.id}/export`)}
                  >
                    export .md
                  </button>
                  <button className={deleteButtonClass} onClick={remove}>
                    delete
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      {book && review && (
        <ReviewPanel
          bookId={book.id}
          msg={review.msg}
          onDone={onReviewDone}
          onSaved={() => setAnnRefresh((n) => n + 1)}
        />
      )}
      {book && <Annotations bookId={book.id} refresh={annRefresh} />}
    </section>
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

// ReviewPanel walks imported annotations missing chapter or location, one at a
// time (PLAN §5b): fill in the blanks, skip one, or skip all to close.
function ReviewPanel({ bookId, msg, onDone, onSaved }) {
  const [queue, setQueue] = useState(null) // annotations missing chapter or location
  const [idx, setIdx] = useState(0)
  const [chapter, setChapter] = useState('')
  const [location, setLocation] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    json('GET', `/annotations?book_id=${bookId}`).then((r) => {
      if (!r.ok) return onDone()
      const missing = r.data.annotations.filter((a) => !a.chapter || !a.location)
      if (missing.length === 0) return onDone()
      setQueue(missing)
      setChapter(missing[0].chapter || '')
      setLocation(missing[0].location || '')
    })
  }, [bookId])

  if (!queue) return null
  const current = queue[idx]

  function goto(i) {
    if (i >= queue.length) return onDone()
    setIdx(i)
    setChapter(queue[i].chapter || '')
    setLocation(queue[i].location || '')
    setError('')
  }

  async function saveNext() {
    setBusy(true)
    setError('')
    // Re-fetch the annotation's current state before the full-state PUT so we
    // don't revert favorite/rating/tags the user may have changed in the list
    // below while this panel was open (the queue is a mount-time snapshot).
    const fresh = await json('GET', `/annotations?book_id=${bookId}`)
    const base = (fresh.ok && fresh.data.annotations.find((a) => a.id === current.id)) || current
    const r = await json('PUT', `/annotations/${current.id}`, {
      ...annotationState(base),
      chapter: chapter.trim(),
      location: location.trim(),
    })
    setBusy(false)
    if (!r.ok) return setError(errText(r, 'could not save annotation'))
    onSaved()
    goto(idx + 1)
  }

  return (
    <div className={cardClass + ' space-y-3 p-4'}>
      <div>
        <h3 className="text-sm font-semibold">Review imported quotes</h3>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          {msg} {queue.length} imported quote{queue.length === 1 ? ' is' : 's are'} missing
          details — {idx + 1} of {queue.length}.
        </p>
      </div>
      <p className="rounded bg-neutral-100 dark:bg-neutral-800 p-3 text-sm whitespace-pre-wrap">
        {current.quote || current.note}
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          className={inputClass}
          placeholder="Chapter"
          value={chapter}
          onChange={(e) => setChapter(e.target.value)}
        />
        <input
          className={inputClass}
          placeholder="Location (e.g. 1042)"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
      </div>
      <ErrorText>{error}</ErrorText>
      <div className="flex flex-wrap gap-2">
        <button className={buttonClass} onClick={saveNext} disabled={busy}>
          Save & next
        </button>
        <button className={ghostButtonClass} onClick={() => goto(idx + 1)} disabled={busy}>
          Skip
        </button>
        <button className={ghostButtonClass} onClick={onDone} disabled={busy}>
          Skip all
        </button>
      </div>
    </div>
  )
}

function EditBook({ book, onSaved, onCancel }) {
  const [title, setTitle] = useState(book.title || '')
  const [author, setAuthor] = useState(book.author || '')
  const [isbn, setIsbn] = useState(book.isbn || '')
  const [year, setYear] = useState(book.published_year ? String(book.published_year) : '')
  const [genres, setGenres] = useState((book.genres || []).join(', '))
  const [description, setDescription] = useState(book.description || '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

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
      asin: book.asin || '', // not editable — preserve what the import set
      published_year: publishedYear,
      genres: splitCommas(genres),
      description: description.trim(),
    })
    setBusy(false)
    if (r.ok) onSaved()
    else setError(errText(r, 'could not save'))
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        <input className={inputClass} placeholder="Title (required)" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input className={inputClass} placeholder="Author" value={author} onChange={(e) => setAuthor(e.target.value)} />
        <input className={inputClass} placeholder="ISBN" value={isbn} onChange={(e) => setIsbn(e.target.value)} />
        <input className={inputClass} placeholder="Year" inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value)} />
      </div>
      <input className={inputClass} placeholder="Genres (comma-separated)" value={genres} onChange={(e) => setGenres(e.target.value)} />
      <textarea className={inputClass} rows="4" placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
      <ErrorText>{error}</ErrorText>
      <div className="flex gap-2">
        <button className={buttonClass} disabled={busy}>
          Save
        </button>
        <button type="button" className={ghostButtonClass} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}

// Annotations is the per-book annotation section: filters, add form, list.
// refresh is a counter bumped by the review panel to reload the list.
function Annotations({ bookId, refresh }) {
  const [items, setItems] = useState(null)
  const [tags, setTags] = useState([])
  const [color, setColor] = useState('') // filter, '' = all
  const [tag, setTag] = useState('') // filter, '' = all
  const [fav, setFav] = useState(false) // filter: favorites only
  const [minRating, setMinRating] = useState('') // filter, '' = any
  const [editingId, setEditingId] = useState(null)
  const [error, setError] = useState('')
  const reqSeq = useRef(0)

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
    if (r.ok) setItems(r.data.annotations)
    else setError(errText(r))
  }
  useEffect(() => {
    load()
  }, [bookId, color, tag, fav, minRating, refresh])
  useEffect(() => {
    loadTags()
  }, [bookId])

  async function add(fields) {
    const r = await json('POST', '/annotations', { book_id: bookId, ...fields })
    if (!r.ok) return errText(r, 'could not add annotation')
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
    if (r.ok) load()
    else setError(errText(r))
  }

  // patch PUTs a row's full current state with one field changed (star clicks).
  async function patch(a, fields) {
    const r = await json('PUT', `/annotations/${a.id}`, { ...annotationState(a), ...fields })
    if (!r.ok) return setError(errText(r, 'could not save annotation'))
    setError('')
    load()
  }

  const filtering = color || tag || fav || minRating

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          Annotations
        </h3>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button onClick={() => setColor('')} className={filterChipClass(color === '')}>
            All
          </button>
          <ColorSwatches value={color} onChange={(c) => setColor(c === color ? '' : c)} />
          <button
            onClick={() => setFav(!fav)}
            className={filterChipClass(fav)}
            title="Only favorites"
          >
            ★ Favorites
          </button>
          <MinRatingSelect value={minRating} onChange={setMinRating} />
          {tags.length > 0 && (
            <select
              className={inputClass + ' w-auto py-1'}
              value={tag}
              onChange={(e) => setTag(e.target.value)}
            >
              <option value="">All tags</option>
              {tags.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className={cardClass + ' p-4'}>
        <AnnotationForm onSubmit={add} submitLabel="Add annotation" />
      </div>

      <ErrorText>{error}</ErrorText>
      {items && items.length === 0 && (
        <EmptyState>
          {filtering ? 'No annotations match the filters.' : 'No annotations yet — add your first highlight above.'}
        </EmptyState>
      )}
      {items && items.length > 0 && (
        <ul className={cardClass + ' divide-y divide-neutral-200 dark:divide-neutral-800'}>
          {items.map((a) => (
            <li key={a.id} className="px-4 py-3">
              {editingId === a.id ? (
                <AnnotationForm
                  initial={a}
                  onSubmit={(fields) => save(a.id, fields)}
                  onCancel={() => setEditingId(null)}
                  submitLabel="Save"
                />
              ) : (
                <div className="flex items-start gap-2.5">
                  <span
                    className={'mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ' + (colorDotClass[a.color] || colorDotClass.yellow)}
                    title={a.color}
                  />
                  <div className="min-w-0 flex-1 space-y-1">
                    {a.quote && <p className="text-sm whitespace-pre-wrap">{a.quote}</p>}
                    {a.note && (
                      <p className="text-sm text-neutral-500 dark:text-neutral-400 whitespace-pre-wrap">{a.note}</p>
                    )}
                    {(a.chapter || a.location) && (
                      <p className="text-xs text-neutral-400 dark:text-neutral-500">
                        {[a.chapter, a.location].filter(Boolean).join(' · ')}
                      </p>
                    )}
                    <Chips items={a.tags} />
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <div className="flex items-center gap-2">
                      <FavoriteStar value={!!a.favorite} onChange={(v) => patch(a, { favorite: v })} />
                      <RatingStars value={a.rating || 0} onChange={(v) => patch(a, { rating: v })} />
                    </div>
                    <div className="flex gap-2">
                      <button className={linkButtonClass} onClick={() => setEditingId(a.id)}>
                        edit
                      </button>
                      <button className={deleteButtonClass} onClick={() => remove(a)}>
                        delete
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
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
      // favorite/rating are edited on the row, not in the form — but PUT is
      // full-state, so carry the existing values through.
      favorite: !!initial?.favorite,
      rating: initial?.rating || 0,
    })
    setBusy(false)
    if (err) return setError(err)
    if (!initial) {
      // add mode: clear for the next entry
      setQuote('')
      setNote('')
      setChapter('')
      setLocation('')
      setColor('yellow')
      setTags('')
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <textarea
        className={inputClass}
        rows="3"
        placeholder="Quote"
        value={quote}
        onChange={(e) => setQuote(e.target.value)}
      />
      <textarea
        className={inputClass}
        rows="2"
        placeholder="Note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="grid gap-2 sm:grid-cols-2">
        <input className={inputClass} placeholder="Chapter" value={chapter} onChange={(e) => setChapter(e.target.value)} />
        <input className={inputClass} placeholder="Location (e.g. 1042)" value={location} onChange={(e) => setLocation(e.target.value)} />
      </div>
      <input className={inputClass} placeholder="Tags (comma-separated)" value={tags} onChange={(e) => setTags(e.target.value)} />
      <div className="flex items-center gap-3 pt-1">
        <ColorSwatches value={color} onChange={setColor} />
        <div className="ml-auto flex gap-2">
          {onCancel && (
            <button type="button" className={ghostButtonClass} onClick={onCancel}>
              Cancel
            </button>
          )}
          <button className={buttonClass} disabled={busy}>
            {submitLabel}
          </button>
        </div>
      </div>
      <ErrorText>{error}</ErrorText>
    </form>
  )
}
