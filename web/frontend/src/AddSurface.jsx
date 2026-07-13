// AddSurface — the single "＋ Add" surface (§7 declutter, One "＋ Add"). One
// modal that carries every way to bring something in: look-up / manual entry for
// a Book, the same for a Film / Show, and the file Import that used to be its own
// permanent tab. The Library and Catalogue "Add" buttons and the shell's top-bar
// "＋ Add" all open this very surface, so there's one obvious way to add anything.
import { useEffect, useState } from 'react'
import { json } from './api.js'
import { LookupTab, ManualTab } from './Library.jsx'
import { LookupMovie, ManualMovie, MediaTypeToggle } from './Movies.jsx'
import ImportPage from './ImportPage.jsx'
import { ErrorText, GhostButton, HandCard, Toggle } from './ui.jsx'

// BookSection — look-up / manual entry for a book (the old Add-book modal body).
function BookSection({ onAdded }) {
  const [mode, setMode] = useState('lookup')
  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Toggle ariaLabel="Add mode" value={mode} onChange={setMode} options={[['lookup', 'Look up'], ['manual', 'Manual']]} />
      </div>
      {mode === 'lookup' ? <LookupTab onAdded={onAdded} /> : <ManualTab onAdded={onAdded} />}
    </div>
  )
}

// FilmSection — look-up / manual entry for a movie or show (the old Add-title
// modal body). Media type + title lift here so switching Look up ↔ Manual keeps
// them; a missing TMDB key falls back to Manual (status-aware).
function FilmSection({ onAdded }) {
  const [status, setStatus] = useState(null) // GET /metadata/status
  const [mode, setMode] = useState('lookup')
  const [lookupError, setLookupError] = useState('') // a runtime 503, shown above Manual
  const [mediaType, setMediaType] = useState('movie')
  const [title, setTitle] = useState('')
  const noKey = status?.tmdb?.source === 'none'

  useEffect(() => {
    json('GET', '/metadata/status').then((r) => { if (r.ok) setStatus(r.data) })
  }, [])
  // No key configured → lookup 503s; drop to Manual (which always works).
  useEffect(() => {
    if (noKey) setMode('manual')
  }, [noKey])

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Toggle ariaLabel="Add mode" value={mode} onChange={setMode} options={[['lookup', 'Look up'], ['manual', 'Manual']]} />
        <MediaTypeToggle value={mediaType} onChange={setMediaType} />
      </div>
      {noKey && (
        <p className="tp-error mb-3" style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
          no TMDB key configured — lookup returns 503. Add one in Settings (or set TIPPANI_TMDB_API_KEY);
          manual entry always works.
        </p>
      )}
      {mode === 'lookup' ? (
        <LookupMovie
          mediaType={mediaType}
          setMediaType={setMediaType}
          title={title}
          setTitle={setTitle}
          onAdded={onAdded}
          onUnavailable={(msg) => {
            setLookupError(msg)
            setMode('manual')
          }}
        />
      ) : (
        <>
          <ErrorText>{lookupError}</ErrorText>
          <ManualMovie mediaType={mediaType} setMediaType={setMediaType} title={title} setTitle={setTitle} onAdded={onAdded} />
        </>
      )}
    </div>
  )
}

// AddSurface renders when `open`. `initialSection` picks the tab it opens on
// ("book" from the Library, "film" from the Catalogue, "import" from a stray
// /import link); the user can switch freely once it's open. `onAdded(what)` is
// called after a book/film is added (what = 'book' | 'film'); the import flow
// reports inline and leaves the surface open. `onOpenMovie`, when supplied, lets
// an IMDb import jump straight to the new title (closing the surface first).
export default function AddSurface({ open, initialSection = 'book', onClose, onAdded, onOpenMovie }) {
  const [section, setSection] = useState(initialSection)

  useEffect(() => {
    if (open) setSection(initialSection)
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
            ariaLabel="What to add"
            value={section}
            onChange={setSection}
            options={[['book', 'Book'], ['film', 'Film / Show'], ['import', 'Import']]}
          />
        </div>
        {section === 'book' && <BookSection onAdded={() => onAdded?.('book')} />}
        {section === 'film' && <FilmSection onAdded={() => onAdded?.('film')} />}
        {section === 'import' && (
          <ImportPage
            embedded
            onOpenMovie={onOpenMovie ? (id) => { onClose(); onOpenMovie(id) } : undefined}
          />
        )}
      </HandCard>
    </div>
  )
}
