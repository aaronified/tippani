// AddSurface — the single "＋ Add" surface (§7 declutter, One "＋ Add"). One
// modal with three tabs the user rotates freely between: "Look up / add" — a
// single card that looks up (or lets you hand-enter) a Book, Film, or Show —
// "Capture quote" — the quote/note capture form against any work — and
// "Import files", the drag-drop source cards. The Library and Catalogue "Add"
// buttons, the shell's top-bar "＋ Add" / ❝ pills and the drawer rows all open
// this very surface, so there's one obvious way to add anything.
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { json, errText } from './api.js'
import { CandidateRow, groupEditions } from './CoverPicker.jsx'
import { ManualTab, isIsbn } from './Library.jsx'
import { ManualMovie, sourceRef, candSourceID, DuplicateConfirm, countOrNull } from './Movies.jsx'
import ImportPage from './ImportPage.jsx'
import { PageHelp } from './help.jsx'
import {
  ColorSwatches,
  EmptyState,
  ErrorText,
  filterChipClass,
  GhostButton,
  HandCard,
  IconButton,
  IconCheck,
  IconClose,
  MobileSheet,
  MonoLabel,
  PartialDateField,
  isPartialDate,
  Toggle,
  toast,
  usePersistedState,
  useIsMobileScreen,
  useBodyScrollLock,
  useAnchoredPosition,
  useDismiss,
} from './ui.jsx'

// One card, four kinds. "Film", "Show" and "Game" all map to the movies flow
// (they differ only by media_type); "Book" uses the books flow. Manual entry is
// no longer a sibling mode — it's the "Add manually" escape hatch under the
// results, which opens the right hand-entry popup for the chosen kind.
// Exported so the popup's kind maps can be tested against this list rather than
// spot-checked: a fifth kind added here and forgotten in ManualPopup saves as a
// film and says nothing (see test/dom/add-manual-kind.test.jsx).
export const KINDS = [['book', 'Book'], ['film', 'Film'], ['show', 'Show'], ['game', 'Game']]

// workFromBook / workFromMovie normalise a freshly-created record into the lean
// {kind,id,title,sub,tag} shape the capture picker (and WorkPicker) speak, so an
// add made through the look-up card can immediately become the capture target.
export function workFromBook(b) {
  return { kind: 'book', id: b.id, title: b.title, sub: b.author || '', tag: 'BOOK' }
}
export function workFromMovie(m) {
  // media_type rides along beside the display tag: capture needs the fact (a show
  // gains season/episode fields), not the label. Narrowed to the vocabulary
  // rather than passed through, because a row with no media_type is a film — but
  // a game must survive as a game or it captures as one and files as the other.
  const mt = m.media_type === 'show' ? 'show' : m.media_type === 'game' ? 'game' : 'movie'
  return { kind: 'screen', id: m.id, title: m.title, sub: m.release_year ? String(m.release_year) : '', media_type: mt, tag: mt === 'show' ? 'SHOW' : mt === 'game' ? 'GAME' : 'FILM' }
}

// AddLookup — the canonical "look up / add a Book, Film, Show or Game" card: a kind
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
  const [kind, setKind] = useState(
    initialKind === 'film' || initialKind === 'show' || initialKind === 'game' ? initialKind : 'book',
  )
  const [q, setQ] = useState(initialQuery || '')
  const [year, setYear] = useState('')
  const [candidates, setCandidates] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirm, setConfirm] = useState(null) // movie same-name confirm {cand, existing}
  const [manual, setManual] = useState(false) // manual-entry popup open
  // Which supplier is unconfigured, PER KIND rather than as one flag: film/show
  // run on TMDB/TVDB and a game runs on IGDB, and they are configured
  // independently. A single boolean read off tmdb meant the common case — TMDB set,
  // IGDB not — showed no warning at all on Game, so the first thing a game
  // search did was 503 into the manual popup with nothing said beforehand.
  const [noKey, setNoKey] = useState({ movie: false, game: false })
  const [openGroup, setOpenGroup] = useState(-1) // index of the expanded edition group
  const isBook = kind === 'book'
  // 'film' is the UI word and 'movie' the stored one, so this maps rather than
  // passing the chip key through. A game is its own media type AND its own
  // supplier — the lookup routes to IGDB on the strength of this value.
  const mediaType = kind === 'show' ? 'show' : kind === 'game' ? 'game' : 'movie'

  // Book results fold same-title-same-author printings into one row (see
  // groupEditions); film/show results are one row per title already.
  const groups = useMemo(
    () => (candidates && isBook ? groupEditions(candidates) : null),
    [candidates, isBook],
  )

  // A missing lookup key makes film/show/game lookup 503; surface it so "Add
  // manually" reads as the obvious path (book lookup needs no key).
  useEffect(() => {
    json('GET', '/metadata/status').then((r) => {
      if (!r.ok) return
      setNoKey({ movie: r.data?.tmdb?.source === 'none', game: r.data?.igdb?.source === 'none' })
    })
  }, [])
  // The supplier behind the CURRENT chip — the only one whose absence this
  // search will hit.
  const kindHasNoKey = !isBook && (kind === 'game' ? noKey.game : noKey.movie)

  function switchKind(k) {
    setKind(k)
    setCandidates(null)
    setError('')
    setConfirm(null)
    setOpenGroup(-1)
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
    setOpenGroup(-1)
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
      // A candidate merged from both providers carries both ids; sending them
      // keeps the record re-verifiable against either supplier later.
      google_id: c.google_id || undefined,
      openlibrary_id: c.openlibrary_id || undefined,
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

  const placeholder = isBook
    ? 'ISBN or title'
    : mediaType === 'show'
      ? 'Show title'
      : mediaType === 'game'
        ? 'Game title'
        : 'Film title'
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

      {/* The hint NAMES THE SUPPLIER, because they are different keys and the
          generic wording sent people to the TMDB field to fix a games lookup.
          IGDB also needs a PAIR, which is the half people miss. */}
      {kindHasNoKey && (
        <p className="microcopy" style={{ color: 'var(--soft)' }}>
          {/* A GAME STILL SEARCHES WITHOUT A KEY (1.16.0), so this no longer says
              the lookup is off — it says what you are getting. Wikidata is the
              fallback and it is thinner: usually no cover art, and a one-line
              description where IGDB gives a paragraph. Saying "no key" and
              stopping would send somebody to Settings for a credential they may
              not need. */}
          {kind === 'game'
            ? 'no IGDB key — searching Wikidata instead, which rarely has cover art. A Twitch client id and secret in Settings gets the full record; “Add manually” always works.'
            : 'no movie-lookup key configured — “Add manually” below always works.'}
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
          {isBook
            ? groups.map((g, i) => {
                const open = openGroup === i
                const n = g.editions.length
                return (
                  <Fragment key={i}>
                    <CandidateRow
                      cover={g.cover_url}
                      title={g.rep.title}
                      // A group's printings disagree on year and ISBN, so the row
                      // carries only what they share; the rest is one tap away.
                      sub={
                        n > 1
                          ? g.rep.author
                          : [g.rep.author, g.rep.published_year || null, g.rep.isbn13].filter(Boolean).join(' · ')
                      }
                      source={g.rep.source}
                      count={n}
                      expanded={open}
                      onAdd={() => (n > 1 ? setOpenGroup(open ? -1 : i) : addBook(g.rep))}
                      busy={busy}
                    />
                    {open && (
                      <li>
                        <ul className="ml-6 space-y-2 border-l pl-3" style={{ borderColor: 'var(--line)' }}>
                          {g.editions.map((c, j) => (
                            <CandidateRow
                              key={j}
                              cover={c.cover_url}
                              title={c.title}
                              sub={[c.published_year || null, c.isbn13].filter(Boolean).join(' · ') || 'no edition details'}
                              source={c.source}
                              onAdd={() => addBook(c)}
                              busy={busy}
                            />
                          ))}
                        </ul>
                      </li>
                    )}
                  </Fragment>
                )
              })
            : candidates.map((c, i) => (
                <CandidateRow
                  key={i}
                  cover={c.poster_url}
                  title={c.title}
                  sub={[c.release_year || null].filter(Boolean).join(' · ')}
                  source={c.source}
                  sourceDetail={candSourceID(c)}
                  onAdd={() => addMovie(c)}
                  busy={busy}
                />
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
// sibling tab). Book → ManualTab; Film / Show / Game → ManualMovie (media type
// fixed by the kind that opened it).
//
// COMMIT LIVES IN THE HEADER, beside close. The form used to end in a primary
// text button ("Add book" / "Add movie"), which is the pattern the rest of the
// app has been leaving: a dialog's two answers are yes and no, they belong
// together, and putting one of them at the bottom of a scrolling form means the
// long variant (a film, with a description box) pushes it off the screen while
// the way out stays pinned in view. So ✓ and ✕ sit as a pair in the top right.
//
// The form is submitted from OUTSIDE itself, via the HTML `form=` attribute on
// the ✓. That keeps a real <form onSubmit>: the handler is unchanged and no click
// handler has to be kept in step with it.
//
// DO NOT "SIMPLIFY" THE ✓ INTO AN onClick. `type="submit"` + `form=` makes it the
// form's DEFAULT BUTTON — the first submit button whose form owner is that form —
// and the default button is the entire reason Enter in a field still saves.
// Neither of these forms has a submit control of its own any more, and a form with
// several text fields and no default button does nothing at all on Enter. The
// failure is silent: no error, no console warning, just a key that stopped
// working in a four-field and a six-field form.
//
// Both forms hand `title` and their in-flight state up here, because the header
// button has to know whether there is anything to save and whether a save is
// already running — see ManualTab in Library.jsx. (Disabling it also disables
// Enter, which is correct: there is nothing to save either way.)
const MANUAL_FORM_ID = 'manual-add-form'

function ManualPopup({ kind, onClose, onAdded }) {
   // The page behind an overlay does not move. Without this a wheel or a swipe
  // running past the end of the dialog scrolls the page you cannot see, which is
  // still scrolled when you close this. Ref-counted, so a dialog opened from
  // inside a sheet does not unlock the sheet on its way out.
  useBodyScrollLock(true)
  // THE KIND THAT OPENED THIS IS THE ANSWER, and it is the only answer: this
  // popup deliberately renders no MediaTypeToggle (see the header comment), so
  // whatever lands here is what gets saved. A kind missing from this map is not
  // a cosmetic slip — it silently files the work as the fallback, with no
  // control on screen to put it right. 'game' was missing, so every game reached
  // through "Add manually" was saved as a film.
  const [mt, setMt] = useState(kind === 'show' ? 'show' : kind === 'game' ? 'game' : 'movie')
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  const heading =
    kind === 'book'
      ? 'Add a book manually'
      : kind === 'show'
        ? 'Add a show manually'
        : kind === 'game'
          ? 'Add a game manually'
          : 'Add a film manually'
  const canSave = !busy && !!title.trim()
  return createPortal(
    <div
      className="tp-scrim fixed inset-0 flex items-start justify-center overflow-y-auto px-4 py-10"
      style={{ zIndex: 60 }}
      role="dialog"
      aria-modal="true"
      aria-label={heading}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <HandCard variant={1} className="w-full max-w-lg px-6 py-6">
        <div className="mb-4 flex items-center gap-2">
          <h3 className="display-title flex-1 text-lg">{heading}</h3>
          <IconButton
            icon={<IconCheck />}
            type="submit"
            form={MANUAL_FORM_ID}
            ariaLabel="Save"
            tooltip={canSave ? 'Save' : 'A title is required'}
            disabled={!canSave}
          />
          <IconButton icon={<IconClose />} ariaLabel="Close" tooltip="Close without saving" onClick={onClose} />
        </div>
        {kind === 'book' ? (
          <ManualTab
            formId={MANUAL_FORM_ID}
            title={title}
            setTitle={setTitle}
            onBusy={setBusy}
            onAdded={(rec) => { onAdded('book', rec); onClose() }}
          />
        ) : (
          <ManualMovie
            formId={MANUAL_FORM_ID}
            mediaType={mt}
            setMediaType={setMt}
            title={title}
            setTitle={setTitle}
            onBusy={setBusy}
            onAdded={(rec) => { onAdded('film', rec); onClose() }}
          />
        )}
      </HandCard>
    </div>,
    document.body,
  )
}

// How many works the picker lists before the pinned create row.
const WORK_PICKER_MAX = 8

// matchRank orders one kind's hits: a title prefix beats a title substring,
// which beats a hit that only landed in the subtitle (author / year).
function matchRank(w, q) {
  if (!q) return 0
  const t = w.title.toLowerCase()
  if (t.startsWith(q)) return 0
  return t.includes(q) ? 1 : 2
}

// WorkPicker — the capture-target picker: type to filter across every book and
// film/show in the library (rows carry a BOOK / FILM / SHOW tag), with a pinned
// last row that quick-creates a new work from the typed title. Keyboard nav +
// outside-click close follow TokenInput; the dropdown reuses its .token-menu
// skin. A picked work renders as a chip with a "change" link.
export function WorkPicker({ works, value, onChange, onCreate }) {
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [hi, setHi] = useState(0)
  const boxRef = useRef(null)

  // matchWidth: the list hangs under a full-width search field, which is what
  // the inline width:'100%' used to say — and which stops meaning the field
  // once the list is portalled to <body>.
  const { popRef, style } = useAnchoredPosition(open, boxRef, { matchWidth: true, minHeight: 140 })
  useDismiss(open, () => setOpen(false), [boxRef, popRef], { event: 'pointerdown' })

  const q = text.trim().toLowerCase()
  const hits = (works || []).filter(
    (w) => !q || w.title.toLowerCase().includes(q) || (w.sub || '').toLowerCase().includes(q),
  )
  // The list arrives books-first (the /books fetch is pushed before /movies), so
  // a plain slice of the first N hid every film and show behind the first N
  // books. Interleave the two kinds — best match first within each — so both are
  // always represented in the capped list.
  const books = hits.filter((w) => w.kind === 'book').sort((a, b) => matchRank(a, q) - matchRank(b, q))
  const screens = hits.filter((w) => w.kind !== 'book').sort((a, b) => matchRank(a, q) - matchRank(b, q))
  const matches = []
  for (let n = 0; matches.length < WORK_PICKER_MAX && (n < books.length || n < screens.length); n++) {
    for (const g of [books, screens]) {
      if (g[n] && matches.length < WORK_PICKER_MAX) matches.push(g[n])
    }
  }
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
        <span className="font-semibold" style={{ fontFamily: 'var(--font-display)', fontWeight: 'var(--font-display-weight)', fontStyle: 'var(--font-display-style)', fontVariantCaps: 'var(--font-display-caps)', textTransform: 'var(--font-display-case)', fontVariantNumeric: 'var(--font-display-figures)', fontSize: 16 }}>{value.title}</span>
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
      {open && createPortal(
        <ul ref={popRef} className="token-menu" style={style} role="listbox">
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
        </ul>,
        document.body,
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
// A SITTING is a run of captures made minutes apart — six quotes off one page of
// one book — and it used to cost six full re-entries: pick the work, pick the
// colour, retype the tags, every time.
//
// So a capture leaves a note of what it used, and the next one within the window
// starts from it. The window is the whole design:
//
//   COLOUR AND TAGS carry with no expiry. Neither can mis-file anything — the worst
//   case is a quote wearing a tag you have to remove, which is visible on the card.
//
//   THE WORK carries for THIRTY MINUTES and no longer. This is deliberately in
//   tension with the rule stated below — "no default target when the surface was
//   opened cold", because a silently pre-filled work invites mis-filed quotes — and
//   the window is how both survive. Within half an hour you are still holding the
//   same book, and the picker SHOWS the work it has chosen, so it is not silent.
//   Tomorrow you are not, and a stale target would file tomorrow's quote under
//   yesterday's book with no signal at all.
const SITTING_KEY = 'tippani:lastCapture'
const SITTING_MS = 30 * 60 * 1000

export function CaptureQuote({ initialTarget = null, initialStandalone = false, onCaptured, onWorkCreated, onSaveState }) {
  // The page behind an overlay does not move. Without this a wheel or a swipe
  // that runs past the end of the dialog scrolls the page you cannot see, and it
  // is still scrolled when you close this. Ref-counted, so a dialog opened from
  // inside a sheet does not unlock the sheet on its way out.
  useBodyScrollLock(true)
  const [works, setWorks] = useState(null) // [{kind:'book'|'screen', id, title, sub, tag}]
  const [creating, setCreating] = useState(null) // null | {title} — inline new-work lookup
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  // No default target when the surface was opened cold — a search-first picker
  // with a silently pre-filled work invites mis-filed quotes, and picking is one
  // keystroke away. `initialTarget` is the deliberate exception: you pressed ＋
  // on a particular book's own page, so that book IS the answer to "which work",
  // and asking again would be asking a question you already answered.
  const [sitting, setSitting] = usePersistedState(SITTING_KEY, null)
  // Read once, at mount: a capture writes this on the way out, and re-reading it
  // mid-edit would change the form under somebody's hands.
  const [seed] = useState(() => {
    if (!sitting || typeof sitting !== 'object') return { color: 'yellow', tags: '', targetKey: null }
    const fresh = typeof sitting.at === 'number' && Date.now() - sitting.at < SITTING_MS
    return {
      color: sitting.color || 'yellow',
      tags: sitting.tags || '',
      targetKey: fresh ? sitting.targetKey || null : null,
    }
  })
  const [draft, setDraft] = useState({ target: null, quote: '', note: '', chapter: '', location: '', character: '', timestamp: '', season: '', episode: '', tags: seed.tags, color: seed.color, speaker: '', occasion: '', occasionDate: '', place: '', medium: '' })
  // "This came from nothing" is a MODE rather than an entry in the work picker.
  // The picker is search-first, so a synthetic "no book or film" row would only
  // surface for someone who typed words matching it — which is nobody, since it
  // is the one option you cannot name. A chip beside the picker asks the
  // question outright instead. (§24)
  const [standalone, setStandalone] = useState(initialStandalone)
  useEffect(() => { setStandalone(initialStandalone) }, [initialStandalone])

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
          list.push(workFromMovie(m))
        }
      }
      setWorks(list)
      // The target arrives as {type, id} from the route; the picker speaks the
      // richer {kind, title, sub, tag} shape, and the list that just landed is
      // where that shape comes from. A target that is not in the list (deleted
      // in another tab) simply leaves the picker empty rather than half-filled.
      if (initialTarget) {
        const wantKind = initialTarget.type === 'movie' ? 'screen' : 'book'
        const hit = list.find((w) => w.kind === wantKind && w.id === initialTarget.id)
        if (hit) setDraft((d) => ({ ...d, target: hit }))
      } else if (seed.targetKey) {
        // The work from a sitting still in its window. Resolved against the list
        // that just landed, so a work deleted in the meantime simply leaves the
        // picker empty rather than half-filled with something that is gone.
        const hit = list.find((w) => `${w.kind}:${w.id}` === seed.targetKey)
        if (hit) setDraft((d) => (d.target ? d : { ...d, target: hit }))
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTarget?.type, initialTarget?.id])

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }))
  const isScreen = !standalone && draft.target?.kind === 'screen'
  // Only a series has episodes to locate a line in; a film has just its runtime.
  const isShow = isScreen && draft.target?.media_type === 'show'

  // targetCreated adopts a freshly-added work (from the look-up card) as the
  // capture target and slots it into the picker list. The shell's stat tiles
  // count works, so refresh them now rather than only on save.
  function targetCreated(work) {
    setWorks((list) => [work, ...(list || [])])
    set({ target: work })
    setCreating(null)
    onWorkCreated?.()
  }

  // ---- what "must-fill" means here, in one place -----------------------------
  // The same predicate greys out Save and refuses the submit, so the button can
  // never be pressable in a state the handler would reject — and `why` is what
  // its tooltip says instead of leaving a dead control unexplained.
  const missing = standalone
    ? !draft.quote.trim()
      // Unlike a book highlight, there is no page for a bare note to be about.
      ? 'A quote needs the words themselves'
      : draft.occasionDate && !isPartialDate(draft.occasionDate)
        ? 'Check the date'
        : ''
    : !draft.target
    ? 'Pick a book, film or show'
    : isScreen && !draft.quote.trim()
      ? 'A line needs the words themselves'
      : !isScreen && !draft.quote.trim() && !draft.note.trim()
        ? 'Write a quote or a note'
        : isShow && countOrNull(draft.episode) != null && countOrNull(draft.season) == null
          ? 'An episode needs its season'
          : ''

  async function save() {
    const t = draft.target
    if (missing) return setErr(missing.toLowerCase())
    setBusy(true)
    setErr('')
    const tags = draft.tags.split(',').map((s) => s.trim()).filter(Boolean)
    // The body differs only in how the quote points at its source: a dialogue
    // carries character/timestamp, an annotation chapter/location. Everything
    // else — quote, note, colour, tags — is shared (the server models this with
    // the quoteReq embedded struct). The server auto-fills actor from the cast.
    const r = standalone
      ? await json('POST', '/quotes', {
          quote: draft.quote.trim(),
          note: draft.note.trim(),
          speaker: draft.speaker.trim(),
          occasion: draft.occasion.trim(),
          occasion_date: draft.occasionDate.trim(),
          place: draft.place.trim(),
          medium: draft.medium.trim(),
          color: draft.color,
          tags,
        })
      : isScreen
      ? await json('POST', '/dialogues', {
          movie_id: t.id,
          quote: draft.quote.trim(),
          note: draft.note.trim(),
          character: draft.character.trim(),
          timestamp: draft.timestamp.trim(),
          // Blank means "not recorded", and 0 is a real season — so '' has to
          // become null rather than 0. Films send neither.
          season: isShow ? countOrNull(draft.season) : null,
          episode: isShow ? countOrNull(draft.episode) : null,
          color: draft.color,
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
    toast(standalone ? 'quote captured' : isScreen ? 'dialogue captured' : 'annotation captured')
    // What the next capture in this sitting starts from. The QUOTE is deliberately
    // not here: the words are the one thing that is never the same twice, and a
    // form that came back holding the last quote would be a form somebody saves
    // twice by accident.
    setSitting({
      at: Date.now(),
      color: draft.color,
      tags: draft.tags,
      targetKey: standalone || !t ? null : `${t.kind}:${t.id}`,
    })
    onCaptured?.()
  }

  // Publish Save upward so the host can put it in its title bar. `draft` is in
  // the deps because `save` closes over it — without it the bar would keep
  // calling a stale save with the first keystroke's draft. No loop: the host's
  // setState re-renders this, but the deps are unchanged, so this does not re-fire.
  useEffect(() => {
    onSaveState?.({ canSave: !missing && !busy, busy, why: missing, save })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missing, busy, draft])

  return (
    <div className="flex flex-col gap-3.5">
      <div className="tp-field">
        <div className="flex items-center justify-between gap-2">
          <MonoLabel>{standalone ? 'From somewhere else' : 'Book · Film · Show'}</MonoLabel>
          <button
            type="button"
            className={filterChipClass(standalone)}
            aria-pressed={standalone}
            onClick={() => {
              // Switching modes drops the other mode's answer rather than
              // keeping it hidden: a target still set behind a standalone save
              // is a quote filed against a book you thought you had cleared.
              setStandalone(!standalone)
              setCreating(null)
              setErr('')
              if (!standalone) set({ target: null })
            }}
          >
            no book or film
          </button>
        </div>
        {!standalone && (
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
        )}
      </div>
      {creating && !draft.target && !standalone && (
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
          style={{ fontFamily: 'var(--font-display)', fontWeight: 'var(--font-display-weight)', fontVariantCaps: 'var(--font-display-caps)', textTransform: 'var(--font-display-case)', fontVariantNumeric: 'var(--font-display-figures)', fontStyle: 'italic', fontSize: 16, lineHeight: 1.55 }}
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
      {standalone ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <label className="tp-field">
              <MonoLabel>Speaker</MonoLabel>
              <input className="tp-input" placeholder="who said it" value={draft.speaker} onChange={(e) => set({ speaker: e.target.value })} />
            </label>
            <label className="tp-field">
              <MonoLabel>Occasion</MonoLabel>
              <input className="tp-input" placeholder="a speech, a letter…" value={draft.occasion} onChange={(e) => set({ occasion: e.target.value })} />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {/* A year on its own is a complete answer here. */}
            <PartialDateField label="When" value={draft.occasionDate} onChange={(v) => set({ occasionDate: v })} />
            <label className="tp-field">
              <MonoLabel>Place</MonoLabel>
              <input className="tp-input" placeholder="where" value={draft.place} onChange={(e) => set({ place: e.target.value })} />
            </label>
          </div>
          <label className="tp-field">
            <MonoLabel>Medium</MonoLabel>
            <input className="tp-input" placeholder="radio, speech, letter…" value={draft.medium} onChange={(e) => set({ medium: e.target.value })} />
          </label>
        </>
      ) : isScreen ? (
        <>
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
        {isShow && (
          <div className="grid grid-cols-2 gap-3">
            <label className="tp-field">
              <MonoLabel>Season</MonoLabel>
              <input className="tp-input" type="number" min="0" max="999" placeholder="e.g. 2" value={draft.season} onChange={(e) => set({ season: e.target.value })} />
            </label>
            <label className="tp-field">
              <MonoLabel>Episode</MonoLabel>
              <input className="tp-input" type="number" min="0" max="9999" placeholder="e.g. 5" value={draft.episode} onChange={(e) => set({ episode: e.target.value })} />
            </label>
          </div>
        )}
        </>
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
          style={{ fontFamily: 'var(--font-mono)', fontWeight: 'var(--font-mono-weight)', fontStyle: 'var(--font-mono-style)', fontVariantCaps: 'var(--font-mono-caps)', textTransform: 'var(--font-mono-case)', fontVariantNumeric: 'var(--font-mono-figures)', fontSize: 13 }}
          placeholder="memory, craft"
          value={draft.tags}
          onChange={(e) => set({ tags: e.target.value })}
        />
      </label>
      <div className="flex items-center gap-3">
        <MonoLabel>colour</MonoLabel>
        <ColorSwatches value={draft.color} onChange={(c) => set({ color: c })} />
      </div>
      <ErrorText>{err}</ErrorText>
      {/* No Save row down here: it is a ✓ in the surface's title bar, which on a
          phone is pinned and reachable without scrolling past six fields to find
          it. What stays is the reason it is greyed, where the fields are. */}
      {missing && <p className="microcopy" style={{ color: 'var(--faint)' }}>{missing} to save.</p>}
    </div>
  )
}

// AddSurface renders when `open`. `initialSection` picks the tab/kind it opens
// on ("book" / "film" → the look-up card on that kind, "quote" → the capture
// form, "import" → the file import tab); the user can rotate freely once it's
// open — Capture quote swaps the bottom of THIS surface, exactly like Import
// files, never a separate popup. `initialTarget` ({type:'book'|'movie', id})
// pre-fills the capture target, which is how a work's own ＋ lands here: since
// 1.4.1 the book and film pages no longer carry an add form of their own, so
// "add a highlight to THIS book" is this surface with the book filled in.
// `onAdded(what)` fires after a book/film/show is added (what = 'book' |
// 'film'); `onCaptured` after a quote/note is saved from the capture tab; the
// import flow reports inline and leaves the surface open. `onOpenMovie`, when
// supplied, lets an IMDb import jump straight to the new title (closing the
// surface first). `onWorkCreated` reports an inline work add from the capture
// tab (the shell refreshes its counts).
//
// On a phone it is a full-screen sheet, not a card floating on a scrim: it is
// the app's densest form (a work picker, a quote, a note, six fields, tags and
// a colour), and a 90%-width card inside a scrolling scrim wasted both edges
// and put the Save button somewhere the thumb had to hunt for.
export default function AddSurface({
  open,
  initialSection = 'book',
  initialTarget = null,
  onClose,
  onAdded,
  onOpenMovie,
  onCaptured,
  onWorkCreated,
  pendingImport = 0,
  onReviewImport,
  onStaged,
}) {
  // 'standalone' is a capture too — it opens the same tab, in its own mode.
  const tabFor = (s) => (s === 'import' ? 'import' : s === 'quote' || s === 'standalone' ? 'quote' : 'add')
  const [tab, setTab] = useState(tabFor(initialSection))
  // The capture form's Save, lifted here so it can live in the title bar beside
  // Close (§ icons-in-title-bars). {canSave, busy, save} — null while the active
  // tab has nothing to save (look-up adds per row; import reports inline).
  const [saveState, setSaveState] = useState(null)
  const mobile = useIsMobileScreen()
  // Short labels on a phone (the three-segment slider can't fit the full words).
  const tabOptions = mobile
    ? [['add', 'Add'], ['quote', 'Capture'], ['import', 'Import']]
    : [['add', 'Look up / add'], ['quote', 'Capture quote'], ['import', 'Import files']]

  useEffect(() => {
    if (!open) return
    setTab(tabFor(initialSection))
    // Drop the previous session's Save with it. The closure it holds captured
    // that session's draft, and a ✓ tapped in the frame before the fresh form
    // republishes would have saved the wrong thing.
    setSaveState(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialSection])
  // A tab with no save action must not leave the previous tab's Save in the bar.
  useEffect(() => { if (tab !== 'quote') setSaveState(null) }, [tab])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const title = tab === 'quote' ? 'Capture' : tab === 'import' ? 'Import' : 'Add'
  // Save is a ✓ in the title bar and is disabled — visibly, not silently — until
  // every must-fill field is filled. The reason is in its tooltip, because a
  // greyed control that will not say why is worse than one that is not there.
  const saveBtn = saveState && (
    <IconButton
      icon={<IconCheck />}
      ariaLabel="Save"
      tooltip={saveState.busy ? 'Saving…' : saveState.canSave ? 'Save' : saveState.why || 'Fill the required fields'}
      ok
      disabled={!saveState.canSave || saveState.busy}
      onClick={() => saveState.save()}
    />
  )
  const closeBtn = (
    <IconButton icon={<IconClose />} ariaLabel="Close" tooltip="Close without saving" onClick={onClose} />
  )

  const body = (
    <>
      <div className="mb-5">
        <Toggle
          ariaLabel="Add, capture or import"
          value={tab}
          onChange={setTab}
          options={tabOptions}
        />
      </div>
      {tab === 'add' && (
        <AddLookup
          initialKind={initialSection === 'film' ? 'film' : 'book'}
          onAdded={(what) => onAdded?.(what)}
        />
      )}
      {tab === 'quote' && (
        <CaptureQuote
          initialTarget={initialTarget}
          initialStandalone={initialSection === 'standalone'}
          onCaptured={onCaptured}
          onWorkCreated={onWorkCreated}
          onSaveState={setSaveState}
        />
      )}
      {tab === 'import' && (
        <>
          {/* An import still waiting in the queue must be visible from the one
              place you would start another one. */}
          {pendingImport > 0 && onReviewImport && (
            <button
              type="button"
              className="tp-btn tp-btn-primary w-full"
              style={{ marginBottom: 12 }}
              onClick={onReviewImport}
            >
              {pendingImport} staged quote{pendingImport === 1 ? '' : 's'} waiting — review the queue
            </button>
          )}
          <ImportPage embedded onReviewImport={onReviewImport} onStaged={onStaged} />
        </>
      )}
    </>
  )

  if (mobile) {
    return createPortal(
      <MobileSheet
        open
        onClose={onClose}
        title={title}
        // A half-written quote must not be lost to a tap beside the card.
        dismissOnScrim={false}
        actions={
          <span className="flex shrink-0 items-center">
            <PageHelp screen="capture" />
            {saveBtn}
          </span>
        }
      >
        {body}
      </MobileSheet>,
      document.body,
    )
  }

  return (
    <div
      className="tp-scrim fixed inset-0 z-50 flex items-start justify-center overflow-y-auto px-4 py-10"
      role="dialog"
      aria-modal="true"
      aria-label="Add to your library"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <HandCard variant={2} className="w-full max-w-2xl px-6 py-6">
        <div className="mb-4 flex items-center gap-2">
          <h2 className="display-title flex-1 text-xl">{title}</h2>
          <PageHelp screen="capture" />
          {saveBtn}
          {closeBtn}
        </div>
        {body}
      </HandCard>
    </div>
  )
}
