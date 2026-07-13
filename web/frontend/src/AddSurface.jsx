// AddSurface — the single "＋ Add" surface (§7 declutter, One "＋ Add"). One
// modal with two tabs: "Look up / add" — a single card that looks up (or lets
// you hand-enter) a Book, Film, or Show — and "Import files", the drag-drop
// source cards. The Library and Catalogue "Add" buttons and the shell's top-bar
// "＋ Add" all open this very surface, so there's one obvious way to add anything.
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { json, errText } from './api.js'
import { ManualTab, isIsbn, sourceLabel } from './Library.jsx'
import { ManualMovie, sourceRef, candSource, DuplicateConfirm } from './Movies.jsx'
import ImportPage from './ImportPage.jsx'
import { EmptyState, ErrorText, GhostButton, HandCard, Placeholder, Toggle } from './ui.jsx'

// One card, three kinds. "Film" and "Show" both map to the movies flow (they
// differ only by media_type); "Book" uses the books flow. Manual entry is no
// longer a sibling mode — it's the "Add manually" escape hatch under the results,
// which opens the right hand-entry popup for the chosen kind.
const KINDS = [['book', 'Book'], ['film', 'Film'], ['show', 'Show']]

function AddLookup({ initialKind = 'book', onAdded }) {
  const [kind, setKind] = useState(initialKind === 'film' || initialKind === 'show' ? initialKind : 'book')
  const [q, setQ] = useState('')
  const [year, setYear] = useState('')
  const [candidates, setCandidates] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirm, setConfirm] = useState(null) // movie same-name confirm {cand, existing}
  const [manual, setManual] = useState(false) // manual-entry popup open
  const [noKey, setNoKey] = useState(false) // TMDB/TVDB missing → film/show lookup 503s
  const isBook = kind === 'book'
  const mediaType = kind === 'show' ? 'show' : 'movie'

  // A missing movie key makes film/show lookup 503; surface it so "Add manually"
  // reads as the obvious path (book lookup needs no key).
  useEffect(() => {
    json('GET', '/metadata/status').then((r) => {
      if (r.ok && r.data?.tmdb?.source === 'none') setNoKey(true)
    })
  }, [])

  function switchKind(k) {
    setKind(k)
    setCandidates(null)
    setError('')
    setConfirm(null)
  }

  async function search(e) {
    e.preventDefault()
    const v = q.trim()
    if (!v) return
    setBusy(true)
    setError('')
    setConfirm(null)
    setCandidates(null)
    let r
    if (isBook) {
      // Book lookup keys off ISBN or title (year isn't a lookup parameter — for a
      // book the year is a publication year you set on the manual form).
      r = await json('POST', '/books/lookup', isIsbn(v) ? { isbn: v } : { title: v })
    } else {
      const body = { title: v, media_type: mediaType }
      if (year.trim()) body.year = Number(year)
      r = await json('POST', '/movies/lookup', body)
    }
    setBusy(false)
    if (r.ok) return setCandidates(r.data.candidates)
    // No key → lookup 503s; steer to manual (which always works) instead of a
    // scary error.
    if (!isBook && r.status === 503) return setManual(true)
    setError(errText(r, 'lookup failed'))
  }

  async function addBook(c) {
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
    if (r.ok) onAdded('book')
    else setError(errText(r, 'could not add book')) // 409 duplicate lands here
  }

  // Movie add mirrors the old LookupMovie: a same-name title already in the
  // library comes back as 409 + needs_confirm so the user chooses enrich vs. add
  // separate (same-name films are legitimate).
  async function addMovie(c, confirmNew = false) {
    setError('')
    const r = await json('POST', '/movies', { ...sourceRef(c, mediaType), confirm_new: confirmNew })
    if (r.ok) return onAdded('film')
    if (r.status === 409 && r.data?.needs_confirm) return setConfirm({ cand: c, existing: r.data.existing || [] })
    setError(errText(r, 'could not add title'))
  }

  async function enrichMovie(existingId, c) {
    setBusy(true)
    setError('')
    const r = await json('PUT', `/movies/${existingId}`, sourceRef(c, mediaType))
    setBusy(false)
    if (r.ok) return onAdded('film')
    setError(errText(r, 'could not enrich that title'))
  }

  const placeholder = isBook ? 'ISBN or title' : mediaType === 'show' ? 'Show title' : 'Film title'

  return (
    <div className="space-y-3">
      <Toggle ariaLabel="What to add" value={kind} onChange={switchKind} options={KINDS} />
      <form onSubmit={search} className="flex flex-wrap gap-2">
        <input
          className="tp-input min-w-0 flex-1"
          style={{ minWidth: 180 }}
          aria-label={placeholder}
          placeholder={placeholder}
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {/* Optional year — refines film/show lookup; for a book it's the
            publication year, carried into the manual form. */}
        <input
          className="tp-input w-20 shrink-0"
          placeholder="Year"
          aria-label="Year (optional)"
          inputMode="numeric"
          maxLength={4}
          value={year}
          onChange={(e) => setYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
        />
        <button className="tp-btn tp-btn-primary shrink-0" disabled={busy}>
          {busy ? 'Searching…' : 'Search'}
        </button>
      </form>

      {!isBook && noKey && (
        <p className="microcopy" style={{ color: 'var(--soft)' }}>
          no movie-lookup key configured — “Add manually” below always works.
        </p>
      )}
      <ErrorText>{error}</ErrorText>

      {confirm && (
        <DuplicateConfirm
          confirm={confirm}
          busy={busy}
          onEnrich={(id) => enrichMovie(id, confirm.cand)}
          onAddSeparate={() => addMovie(confirm.cand, true)}
          onCancel={() => setConfirm(null)}
        />
      )}

      {!confirm && candidates && candidates.length === 0 && <EmptyState>no matches found</EmptyState>}
      {!confirm && candidates && candidates.length > 0 && (
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
                  {isBook
                    ? [c.author, c.published_year || null, c.isbn13].filter(Boolean).join(' · ')
                    : [c.release_year || null].filter(Boolean).join(' · ')}
                </p>
              </div>
              <span className="tp-chip shrink-0">{isBook ? sourceLabel(c.source) : candSource(c)}</span>
              <GhostButton className="shrink-0" onClick={() => (isBook ? addBook(c) : addMovie(c))}>
                Add
              </GhostButton>
            </li>
          ))}
        </ul>
      )}

      <button type="button" className="tp-link" onClick={() => setManual(true)}>
        ＋ Can’t find it? Add manually
      </button>

      {manual && <ManualPopup kind={kind} year={year} onClose={() => setManual(false)} onAdded={onAdded} />}
    </div>
  )
}

// ManualPopup — the hand-entry form for the chosen kind, in a modal above the
// Add surface (§3.1: manual entry is a popup reached from the look-up card, not a
// sibling tab). Book → ManualTab; Film / Show → ManualMovie (media type fixed by
// the kind that opened it).
function ManualPopup({ kind, onClose, onAdded }) {
  const [mt, setMt] = useState(kind === 'show' ? 'show' : 'movie')
  const [title, setTitle] = useState('')
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  const heading = kind === 'book' ? 'Add a book manually' : kind === 'show' ? 'Add a show manually' : 'Add a film manually'
  return createPortal(
    <div
      className="fixed inset-0 flex items-start justify-center overflow-y-auto px-4 py-10"
      style={{ background: 'rgba(21,16,12,.55)', zIndex: 60 }}
      role="dialog"
      aria-modal="true"
      aria-label={heading}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <HandCard variant={1} className="w-full max-w-lg px-6 py-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="display-title text-lg">{heading}</h3>
          <GhostButton onClick={onClose}>Close</GhostButton>
        </div>
        {kind === 'book' ? (
          <ManualTab onAdded={() => { onAdded('book'); onClose() }} />
        ) : (
          <ManualMovie
            mediaType={mt}
            setMediaType={setMt}
            title={title}
            setTitle={setTitle}
            onAdded={() => { onAdded('film'); onClose() }}
          />
        )}
      </HandCard>
    </div>,
    document.body,
  )
}

// AddSurface renders when `open`. `initialSection` picks the tab/kind it opens
// on ("book" / "film" → the look-up card on that kind, "import" → the file
// import tab); the user can switch freely once it's open. `onAdded(what)` fires
// after a book/film/show is added (what = 'book' | 'film'); the import flow
// reports inline and leaves the surface open. `onOpenMovie`, when supplied, lets
// an IMDb import jump straight to the new title (closing the surface first).
export default function AddSurface({ open, initialSection = 'book', onClose, onAdded, onOpenMovie }) {
  const [tab, setTab] = useState(initialSection === 'import' ? 'import' : 'add')

  useEffect(() => {
    if (open) setTab(initialSection === 'import' ? 'import' : 'add')
  }, [open, initialSection])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto px-4 py-10"
      style={{ background: 'rgba(21,16,12,.55)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Add to your library"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <HandCard variant={2} className="w-full max-w-2xl px-6 py-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="display-title text-xl">Add</h2>
          <GhostButton onClick={onClose}>Close</GhostButton>
        </div>
        <div className="mb-5">
          <Toggle
            ariaLabel="Add or import"
            value={tab}
            onChange={setTab}
            options={[['add', 'Look up / add'], ['import', 'Import files']]}
          />
        </div>
        {tab === 'add' && (
          <AddLookup
            initialKind={initialSection === 'film' ? 'film' : 'book'}
            onAdded={(what) => onAdded?.(what)}
          />
        )}
        {tab === 'import' && (
          <ImportPage
            embedded
            onOpenMovie={onOpenMovie ? (id) => { onClose(); onOpenMovie(id) } : undefined}
          />
        )}
      </HandCard>
    </div>
  )
}
