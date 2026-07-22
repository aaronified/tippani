// AddSurface — the single "＋ Add" surface (§7 declutter, One "＋ Add"). One
// modal with three tabs the user rotates freely between: "Look up / add" — a
// single card that looks up (or lets you hand-enter) a Book, Film, or Show —
// "Capture quote" — the quote/note capture form against any work — and
// "Import files", the drag-drop source cards. The Library and Catalogue "Add"
// buttons, the shell's top-bar "＋ Add" / ❝ pills and the drawer rows all open
// this very surface, so there's one obvious way to add anything.
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { json, errText } from './api.js'
import { ManualTab, isIsbn, sourceLabel } from './Library.jsx'
import { ManualMovie, sourceRef, candSource, DuplicateConfirm } from './Movies.jsx'
import ImportPage from './ImportPage.jsx'
import { ColorSwatches, EmptyState, ErrorText, GhostButton, HandCard, MonoLabel, Placeholder, Toggle, toast } from './ui.jsx'

// One card, three kinds. "Film" and "Show" both map to the movies flow (they
// differ only by media_type); "Book" uses the books flow. Manual entry is no
// longer a sibling mode — it's the "Add manually" escape hatch under the results,
// which opens the right hand-entry popup for the chosen kind.
const KINDS = [['book', 'Book'], ['film', 'Film'], ['show', 'Show']]

// workFromBook / workFromMovie normalise a freshly-created record into the lean
// {kind,id,title,sub,tag} shape the capture picker (and WorkPicker) speak, so an
// add made through the look-up card can immediately become the capture target.
export function workFromBook(b) {
  return { kind: 'book', id: b.id, title: b.title, sub: b.author || '', tag: 'BOOK' }
}
export function workFromMovie(m) {
  return { kind: 'screen', id: m.id, title: m.title, sub: m.release_year ? String(m.release_year) : '', tag: m.media_type === 'show' ? 'SHOW' : 'FILM' }
}

// AddLookup — the canonical "look up / add a Book, Film or Show" card: a kind
// toggle, a search that queries the metadata sources, a candidate list that
// creates the work (with cover + genres + source pinning) on pick, and an "add
// manually" escape hatch that's visible from the start (press it to skip the
// lookup entirely) and steps forward when a lookup fails or finds nothing.
// Used standalone inside AddSurface AND embedded in the capture form.
// `onAdded(what)` fires after any add; `onCreated(work)` additionally hands
// back the normalised work so an embedder can target it. `initialQuery` seeds
// (and, for books, auto-runs) the search; `hideManual` drops the manual
// affordances where the host offers its own.
export function AddLookup({ initialKind = 'book', onAdded, onCreated, initialQuery = '', hideManual = false }) {
  const [kind, setKind] = useState(initialKind === 'film' || initialKind === 'show' ? initialKind : 'book')
  const [q, setQ] = useState(initialQuery || '')
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

  // finish routes every successful add (look-up or manual) through one place:
  // hand the normalised work to an embedder (capture targets it) then report the
  // add up to the host.
  function finish(what, rec) {
    if (rec && onCreated) onCreated(what === 'book' ? workFromBook(rec) : workFromMovie(rec))
    onAdded?.(what)
  }

  // Auto-run the search when opened with a seeded query — but only for books,
  // whose look-up needs no key (a keyless film/show search 503s straight into
  // the manual popup, which is jarring on open).
  useEffect(() => {
    if (initialQuery && initialQuery.trim() && kind === 'book') doSearch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function doSearch() {
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
    if (r.ok) finish('book', r.data)
    else setError(errText(r, 'could not add book')) // 409 duplicate lands here
  }

  // Movie add mirrors the old LookupMovie: a same-name title already in the
  // library comes back as 409 + needs_confirm so the user chooses enrich vs. add
  // separate (same-name films are legitimate).
  async function addMovie(c, confirmNew = false) {
    setError('')
    const r = await json('POST', '/movies', { ...sourceRef(c, mediaType), confirm_new: confirmNew })
    if (r.ok) return finish('film', r.data)
    if (r.status === 409 && r.data?.needs_confirm) return setConfirm({ cand: c, existing: r.data.existing || [] })
    setError(errText(r, 'could not add title'))
  }

  async function enrichMovie(existingId, c) {
    setBusy(true)
    setError('')
    const r = await json('PUT', `/movies/${existingId}`, sourceRef(c, mediaType))
    setBusy(false)
    if (r.ok) return finish('film', r.data)
    setError(errText(r, 'could not enrich that title'))
  }

  const placeholder = isBook ? 'ISBN or title' : mediaType === 'show' ? 'Show title' : 'Film title'
  // The lookup let the user down (failed, or found nothing) — step the manual
  // path forward as a real button, not just the microcopy link below.
  const lookupFailed = !confirm && (!!error || (candidates && candidates.length === 0))

  return (
    <div className="space-y-3">
      <Toggle ariaLabel="What to add" value={kind} onChange={switchKind} options={KINDS} />
      <form onSubmit={(e) => { e.preventDefault(); doSearch() }} className="flex flex-wrap gap-2">
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

      {/* Lookup failed or came back empty → a real "Add manually" button so the
          hand-entry path is one obvious press away (not only the link below). */}
      {!hideManual && lookupFailed && (
        <GhostButton onClick={() => setManual(true)}>＋ Add manually instead</GhostButton>
      )}

      {!hideManual && (
        <button type="button" className="tp-link block" onClick={() => setManual(true)}>
          ＋ Skip the lookup — add manually
        </button>
      )}

      {manual && <ManualPopup kind={kind} year={year} onClose={() => setManual(false)} onAdded={finish} />}
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
          <ManualTab onAdded={(rec) => { onAdded('book', rec); onClose() }} />
        ) : (
          <ManualMovie
            mediaType={mt}
            setMediaType={setMt}
            title={title}
            setTitle={setTitle}
            onAdded={(rec) => { onAdded('film', rec); onClose() }}
          />
        )}
      </HandCard>
    </div>,
    document.body,
  )
}

// WorkPicker — the capture-target picker: type to filter across every book and
// film/show in the library (rows carry a BOOK / FILM / SHOW tag), with a pinned
// last row that quick-creates a new work from the typed title. Keyboard nav +
// outside-click close follow TokenInput; the dropdown reuses its .token-menu
// skin. A picked work renders as a chip with a "change" link.
function WorkPicker({ works, value, onChange, onCreate }) {
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [hi, setHi] = useState(0)
  const boxRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const close = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])

  const q = text.trim().toLowerCase()
  const matches = (works || [])
    .filter((w) => !q || w.title.toLowerCase().includes(q) || (w.sub || '').toLowerCase().includes(q))
    .slice(0, 8)
  const rows = matches.length + 1 // + the pinned create row

  const pick = (w) => {
    onChange(w)
    setText('')
    setOpen(false)
  }
  const create = () => {
    onCreate(text.trim())
    setText('')
    setOpen(false)
  }
  function onKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) setOpen(true)
      else setHi((h) => Math.min(h + 1, rows - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHi((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      // Never let Enter submit an enclosing form/footer — it picks the row.
      e.preventDefault()
      if (!open) return
      if (hi < matches.length) pick(matches[hi])
      else create()
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  if (value) {
    return (
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <span className="font-semibold" style={{ fontFamily: 'var(--font-display)', fontSize: 16 }}>{value.title}</span>
        {value.sub && <span className="microcopy">{value.sub}</span>}
        <span className="mono-label" style={{ fontSize: 9.5, color: value.kind === 'book' ? 'var(--accent-ui)' : 'var(--amber)' }}>
          {value.tag}
        </span>
        <button type="button" className="tp-link ml-auto" onClick={() => onChange(null)}>change</button>
      </div>
    )
  }
  return (
    <div className="token-input" ref={boxRef}>
      <input
        className="tp-input"
        placeholder="search your books, films & shows…"
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setOpen(true)
          setHi(0)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {open && (
        <ul className="token-menu" style={{ width: '100%' }} role="listbox">
          {matches.map((w, i) => (
            <li key={`${w.kind}:${w.id}`}>
              <button
                type="button"
                className={'token-opt' + (hi === i ? ' hi' : '')}
                onClick={() => pick(w)}
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="truncate">
                    {w.title}
                    {w.sub && <span style={{ color: 'var(--soft)' }}> · {w.sub}</span>}
                  </span>
                  <span className="mono-label" style={{ flex: 'none', fontSize: 9.5, color: w.kind === 'book' ? 'var(--accent-ui)' : 'var(--amber)' }}>
                    {w.tag}
                  </span>
                </span>
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              className={'token-opt' + (hi === matches.length ? ' hi' : '')}
              style={{ color: 'var(--accent-ui)', fontWeight: 600 }}
              onClick={create}
            >
              ＋ Add {text.trim() ? `“${text.trim()}”` : 'a new work'} — book, film or show
            </button>
          </li>
        </ul>
      )}
    </div>
  )
}

// CaptureQuote — the "Capture quote" tab body: jot a quote or note against any
// book, film or show without leaving where you are — or quick-create the work
// inline via the embedded look-up card when it isn't in the library yet. Tags
// are comma-separated names — unknown ones are auto-created server-side.
// `onCaptured` fires after a successful save; `onWorkCreated` after an inline
// work add (the shell refreshes its counts).
export function CaptureQuote({ onCaptured, onWorkCreated }) {
  const [works, setWorks] = useState(null) // [{kind:'book'|'screen', id, title, sub, tag}]
  const [creating, setCreating] = useState(null) // null | {title} — inline new-work lookup
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  // No default target — a search-first picker with a silently pre-filled
  // work invites mis-filed quotes; picking is one keystroke away.
  const [draft, setDraft] = useState({ target: null, quote: '', note: '', chapter: '', location: '', character: '', timestamp: '', tags: '', color: 'yellow' })

  useEffect(() => {
    Promise.all([json('GET', '/books'), json('GET', '/movies')]).then(([rb, rm]) => {
      const list = []
      if (rb.ok && rb.data) {
        for (const b of rb.data.books || []) {
          list.push({ kind: 'book', id: b.id, title: b.title, sub: b.author || '', tag: 'BOOK' })
        }
      }
      if (rm.ok && rm.data) {
        for (const m of rm.data.movies || []) {
          list.push({
            kind: 'screen',
            id: m.id,
            title: m.title,
            sub: m.release_year ? String(m.release_year) : '',
            tag: m.media_type === 'show' ? 'SHOW' : 'FILM',
          })
        }
      }
      setWorks(list)
    })
  }, [])

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }))
  const isScreen = draft.target?.kind === 'screen'

  // targetCreated adopts a freshly-added work (from the look-up card) as the
  // capture target and slots it into the picker list. The shell's stat tiles
  // count works, so refresh them now rather than only on save.
  function targetCreated(work) {
    setWorks((list) => [work, ...(list || [])])
    set({ target: work })
    setCreating(null)
    onWorkCreated?.()
  }

  async function save() {
    const t = draft.target
    if (!t) return setErr('pick a book, film or show — or add one')
    if (isScreen && !draft.quote.trim()) return setErr('a dialogue needs the quote itself')
    if (!isScreen && !draft.quote.trim() && !draft.note.trim()) return setErr('quote or note is required')
    setBusy(true)
    setErr('')
    const tags = draft.tags.split(',').map((s) => s.trim()).filter(Boolean)
    // The body is built per-kind: dialogues have character/timestamp and no
    // colour/chapter/location (the server auto-fills actor from the cast).
    const r = isScreen
      ? await json('POST', '/dialogues', {
          movie_id: t.id,
          quote: draft.quote.trim(),
          note: draft.note.trim(),
          character: draft.character.trim(),
          timestamp: draft.timestamp.trim(),
          tags,
        })
      : await json('POST', '/annotations', {
          book_id: t.id,
          quote: draft.quote.trim(),
          note: draft.note.trim(),
          chapter: draft.chapter.trim(),
          location: draft.location.trim(),
          color: draft.color,
          tags,
        })
    setBusy(false)
    if (!r.ok) return setErr(errText(r))
    toast(isScreen ? 'dialogue captured' : 'annotation captured')
    onCaptured?.()
  }

  return (
    <div className="flex flex-col gap-3.5">
      <label className="tp-field">
        <MonoLabel>Book · Film · Show</MonoLabel>
        <WorkPicker
          works={works}
          value={draft.target}
          onChange={(w) => {
            set({ target: w })
            // Picking a work supersedes a half-typed inline create — clearing
            // it here keeps the stale form from resurfacing on "change".
            if (w) setCreating(null)
          }}
          onCreate={(title) => {
            setErr('')
            setCreating({ title })
          }}
        />
      </label>
      {creating && !draft.target && (
        <div className="space-y-2.5" style={{ border: '1.4px dashed var(--ink-border)', borderRadius: 10, padding: '10px 12px' }}>
          <div className="flex items-center justify-between gap-2">
            <MonoLabel>Add a new book, film or show</MonoLabel>
            <button type="button" className="tp-link" onClick={() => setCreating(null)}>cancel</button>
          </div>
          {/* The app's canonical look-up / add card, embedded: search a source to
              auto-fill cover + year + genres, or add by hand. On add it becomes
              the capture target. */}
          <AddLookup initialQuery={creating.title} onCreated={targetCreated} />
        </div>
      )}
      <label className="tp-field">
        <MonoLabel>Quote</MonoLabel>
        <textarea
          className="tp-input"
          rows={4}
          placeholder="the line worth keeping…"
          style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 16, lineHeight: 1.55 }}
          value={draft.quote}
          onChange={(e) => set({ quote: e.target.value })}
        />
      </label>
      <label className="tp-field">
        <MonoLabel>Note</MonoLabel>
        <textarea
          className="tp-input"
          rows={2}
          placeholder="your margin note (renders handwritten)"
          value={draft.note}
          onChange={(e) => set({ note: e.target.value })}
        />
      </label>
      {isScreen ? (
        <div className="grid grid-cols-2 gap-3">
          <label className="tp-field">
            <MonoLabel>Character</MonoLabel>
            <input className="tp-input" placeholder="who says it" value={draft.character} onChange={(e) => set({ character: e.target.value })} />
          </label>
          <label className="tp-field">
            <MonoLabel>Timestamp</MonoLabel>
            <input className="tp-input" placeholder="e.g. 01:12:40" value={draft.timestamp} onChange={(e) => set({ timestamp: e.target.value })} />
          </label>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <label className="tp-field">
            <MonoLabel>Chapter</MonoLabel>
            <input className="tp-input" placeholder="e.g. 3" value={draft.chapter} onChange={(e) => set({ chapter: e.target.value })} />
          </label>
          <label className="tp-field">
            <MonoLabel>Location</MonoLabel>
            <input className="tp-input" placeholder="e.g. 142" value={draft.location} onChange={(e) => set({ location: e.target.value })} />
          </label>
        </div>
      )}
      <label className="tp-field">
        <MonoLabel>Tags · comma separated</MonoLabel>
        <input
          className="tp-input"
          style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}
          placeholder="memory, craft"
          value={draft.tags}
          onChange={(e) => set({ tags: e.target.value })}
        />
      </label>
      {!isScreen && (
        <div className="flex items-center gap-3">
          <MonoLabel>colour</MonoLabel>
          <ColorSwatches value={draft.color} onChange={(c) => set({ color: c })} />
        </div>
      )}
      <ErrorText>{err}</ErrorText>
      <div className="flex">
        <button type="button" className="tp-btn tp-btn-primary tactile ml-auto" style={{ minWidth: 120 }} disabled={busy} onClick={save}>
          Save
        </button>
      </div>
    </div>
  )
}

// AddSurface renders when `open`. `initialSection` picks the tab/kind it opens
// on ("book" / "film" → the look-up card on that kind, "quote" → the capture
// form, "import" → the file import tab); the user can rotate freely once it's
// open — Capture quote swaps the bottom of THIS surface, exactly like Import
// files, never a separate popup. `onAdded(what)` fires after a book/film/show
// is added (what = 'book' | 'film'); `onCaptured` after a quote/note is saved
// from the capture tab; the import flow reports inline and leaves the surface
// open. `onOpenMovie`, when supplied, lets an IMDb import jump straight to the
// new title (closing the surface first). `onWorkCreated` reports an inline
// work add from the capture tab (the shell refreshes its counts).
export default function AddSurface({ open, initialSection = 'book', onClose, onAdded, onOpenMovie, onCaptured, onWorkCreated }) {
  const tabFor = (s) => (s === 'import' ? 'import' : s === 'quote' ? 'quote' : 'add')
  const [tab, setTab] = useState(tabFor(initialSection))

  useEffect(() => {
    if (open) setTab(tabFor(initialSection))
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
            ariaLabel="Add, capture or import"
            value={tab}
            onChange={setTab}
            options={[
              ['add', 'Look up / add'],
              ['quote', 'Capture quote'],
              ['import', 'Import files'],
            ]}
          />
        </div>
        {tab === 'add' && (
          <AddLookup
            initialKind={initialSection === 'film' ? 'film' : 'book'}
            onAdded={(what) => onAdded?.(what)}
          />
        )}
        {tab === 'quote' && (
          <CaptureQuote onCaptured={onCaptured} onWorkCreated={onWorkCreated} />
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
