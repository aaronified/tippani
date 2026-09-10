// AddSurface — the single "＋ Add" surface (§7 declutter, One "＋ Add").
//
// ONE PANEL, TWO STATES: a chooser grouped the way the owner grouped it — a work,
// a quote, many at once — and then the form for the thing picked, with Back in the
// header. That replaced three tabs whose own comment described them as tabs "the
// user rotates freely between", and nobody rotates: you know what you are adding
// before you press the plus, so a segmented control across three things of wildly
// different weights spent the top of every opening asking a question already
// answered.
//
// NOBODY IS ASKED TWICE. A work's own plus opens the highlight or dialogue form
// with that work filled in; a proverb board's plus opens the proverb form; a
// duplicate opens on the kind it copies. The chooser appears only when nothing
// else has answered — a bare plus on the Quotes screen, or a plain board.
//
// WHICH FIELDS A FORM DRAWS IS DATA, not markup: addFields.js holds what each of
// the eleven forms shows, hides behind "Show all fields", and hard-drops. A POST
// here is full-state, so a hard-dropped field must be ABSENT from the body rather
// than empty in it — otherwise a locator that arrived by import is cleared by a
// reader who never saw a box for it. `showsField` is that gate, in one place.
//
// The Library and Catalogue "Add" buttons, the shell's top-bar "＋ Add" / ❝ pills
// and the drawer rows all open this very surface, so there's one obvious way to
// add anything.
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { json, errText } from './api.js'
import { CastCombo, OfferChip, SuggestCombo, useTagNames, useWorkSuggestions } from './suggest.jsx'
import { t } from './i18n.js'
import { BoardForm, useBoards } from './boards.jsx'
import { QUOTE_KIND_DOORS, doorForBoard, fieldsFor, showsField, splitPair } from './addFields.js'
import { chapterPatch } from './text.js'
import { StickerPicker, useStickers } from './stickers.jsx'
import { CandidateRow, groupEditions } from './CoverPicker.jsx'
import { ManualTab, isIsbn } from './Library.jsx'
import { ManualMovie, sourceRef, candSourceID, DuplicateConfirm, countOrNull } from './Movies.jsx'
import ImportPage from './ImportPage.jsx'
import { PageHelp } from './help.jsx'
import {
  useEscape,
  ColorSwatches,
  Field,
  TokenInput,
  EmptyState,
  ErrorText,
  filterChipClass,
  GhostButton,
  HandCard,
  IconButton,
  IconBack,
  IconCheck,
  IconClose,
  MobileSheet,
  MonoLabel,
  NameScroll,
  Select,
  PartialDateField,
  isPartialDate,
  parsePartialDate,
  partialDateValue,
  Toggle,
  toast,
  usePersistedState,
  useIsMobileScreen,
  useBodyScrollLock,
  useAnchoredPosition,
  useDismiss,
  useBackToClose,
  SCRIM_CENTERED,
  backdropClose,
} from './ui.jsx'

// One card, four kinds. "Film", "Show" and "Game" all map to the movies flow
// (they differ only by media_type); "Book" uses the books flow. Manual entry is
// no longer a sibling mode — it's the "Add manually" escape hatch under the
// results, which opens the right hand-entry popup for the chosen kind.
// Exported so the popup's kind maps can be tested against this list rather than
// spot-checked: a fifth kind added here and forgotten in ManualPopup saves as a
// film and says nothing (see test/dom/add-manual-kind.test.jsx).
// A [key, label] pair whose LABEL resolves when it is read: the pair shape the
// callers destructure is unchanged, and nothing resolves at module scope, before
// a locale has been applied.
function labelPair(key, labelKey) {
  const row = [key, '']
  Object.defineProperty(row, 1, { get: () => t(labelKey), enumerable: true, configurable: true })
  return row
}

export const KINDS = [
  labelPair('book', 'vocab.kind.book.label'),
  labelPair('film', 'vocab.kind.movie.label'),
  labelPair('show', 'vocab.kind.show.label'),
  labelPair('game', 'vocab.kind.game.label'),
]

// Which SECTION each kind is filed in, so the ＋ offers what the reader has left
// switched on (Settings → Features). A book belongs to the Library; a film, a show
// and a game all belong to the Catalogue, which is why hiding one section takes
// one chip away and hiding the other takes three.
//
// The chooser is gated and the FORMS are not. Hiding is cosmetic: nothing is
// disabled, nothing is deleted, and a reader standing on a hidden section's list
// by URL still gets its ＋. What goes is the invitation to start something in a
// section they have put away.
const KIND_SECTION = { book: 'library', film: 'movies', show: 'movies', game: 'movies' }

export function kindsFor(sections) {
  return KINDS.filter(([kind]) => sections?.[KIND_SECTION[kind]] !== false)
}

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
export function AddLookup({ initialKind = 'book', onAdded, onCreated, initialQuery = '', hideManual = false, sections, lockKind = false }) {
  const kinds = kindsFor(sections)
  const [kind, setKind] = useState(() => {
    const want = initialKind === 'film' || initialKind === 'show' || initialKind === 'game' ? initialKind : 'book'
    // The default is 'book', and the Library is exactly what a reader may have
    // switched off — so a toggle opening on a segment it does not draw would show
    // no selection and search the wrong kind on the first Enter. Fall to the first
    // kind actually on offer; there is always one, because the last content
    // section cannot be hidden.
    return kinds.some(([k]) => k === want) ? want : (kinds[0]?.[0] || 'book')
  })
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
    setError(errText(r, t('error.lookup.failed')))
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
    else setError(errText(r, t('error.add.book'))) // 409 duplicate lands here
  }

  // Movie add mirrors the old LookupMovie: a same-name title already in the
  // library comes back as 409 + needs_confirm so the user chooses enrich vs. add
  // separate (same-name films are legitimate).
  async function addMovie(c, confirmNew = false) {
    setError('')
    const r = await json('POST', '/movies', { ...sourceRef(c, mediaType), confirm_new: confirmNew })
    if (r.ok) return finish('film', r.data)
    if (r.status === 409 && r.data?.needs_confirm) return setConfirm({ cand: c, existing: r.data.existing || [] })
    setError(errText(r, t('error.add.title')))
  }

  async function enrichMovie(existingId, c) {
    setBusy(true)
    setError('')
    const r = await json('PUT', `/movies/${existingId}`, sourceRef(c, mediaType))
    setBusy(false)
    if (r.ok) return finish('film', r.data)
    setError(errText(r, t('error.enrich.title')))
  }

  const placeholder = t(
    isBook
      ? 'capture.lookup.book.placeholder'
      : mediaType === 'show'
        ? 'capture.lookup.show.placeholder'
        : mediaType === 'game'
          ? 'capture.lookup.game.placeholder'
          : 'capture.lookup.film.placeholder',
  )
  // The lookup let the user down (failed, or found nothing) — step the manual
  // path forward as a real button, not just the microcopy link below.
  const lookupFailed = !confirm && (!!error || (candidates && candidates.length === 0))

  return (
    <div className="space-y-3">
      {/* One kind left is not a choice — the Catalogue alone still needs its
          Film / Show / Game toggle, but a lone "Book" segment is a label
          pretending to be a control. */}
      {/* THE KIND TOGGLE IS GONE WHEN THE CHOOSER HAS ALREADY ANSWERED. `lockKind`
          is set by every door that names a kind — Book, Film, Show, Game — and by
          the inline create inside a quote form, where the door decided which kind
          of work the quote needs. Drawing it anyway would be the question asked
          twice, which is field-model §1's argument about the Kind chips applied
          one surface over.
          It stays for a caller that opens the card cold, which is what the
          embedded lookup used to be and what a future entry point may be. */}
      {!lockKind && kinds.length > 1 && <Toggle ariaLabel={t('capture.lookup.kind.aria')} value={kind} onChange={switchKind} options={kinds} />}
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
          placeholder={t('capture.lookup.year.placeholder')}
          aria-label={t('capture.lookup.year.aria')}
          inputMode="numeric"
          maxLength={4}
          value={year}
          onChange={(e) => setYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
        />
        <button className="tp-btn tp-btn-primary shrink-0" disabled={busy}>
          {t(busy ? 'capture.lookup.search.busy' : 'capture.lookup.search.label')}
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
          {t(kind === 'game' ? 'capture.lookup.nokey.game' : 'capture.lookup.nokey.film')}
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

      {!confirm && candidates && candidates.length === 0 && <EmptyState>{t('capture.lookup.empty')}</EmptyState>}
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
                              sub={[c.published_year || null, c.isbn13].filter(Boolean).join(' · ') || t('capture.lookup.edition.none.label')}
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
        <GhostButton onClick={() => setManual(true)}>{t('capture.lookup.manual.button.label')}</GhostButton>
      )}

      {!hideManual && (
        <button type="button" className="tp-link block" onClick={() => setManual(true)}>
          {t('capture.lookup.manual.link.label')}
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
  // ITS OWN BACK ENTRY — see PersonModal. A surface that pushes none is dismissed
  // by the press that was meant for it AND by whatever is underneath, because the
  // panel stack and the screen both keep entries and this one kept nothing.
  useBackToClose(true, onClose)

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
  // ONE OWNER FOR ESCAPE — see useEscape in ui.jsx.
  useEscape(true, onClose)
  const heading = t(
    kind === 'book'
      ? 'capture.manual.book.title'
      : kind === 'show'
        ? 'capture.manual.show.title'
        : kind === 'game'
          ? 'capture.manual.game.title'
          : 'capture.manual.film.title',
  )
  const canSave = !busy && !!title.trim()
  return createPortal(
    <div
      // Above the ordinary z-50: this one opens FROM a dialog.
      className={SCRIM_CENTERED}
      style={{ zIndex: 60 }}
      role="dialog"
      aria-modal="true"
      aria-label={heading}
      onMouseDown={backdropClose(onClose)}
    >
      <HandCard variant={1} className="w-full max-w-lg px-6 py-6">
        <div className="mb-4 flex items-center gap-2">
          <h3 className="display-title flex-1 text-lg">{heading}</h3>
          <IconButton
            icon={<IconCheck />}
            type="submit"
            form={MANUAL_FORM_ID}
            ariaLabel={t('common.action.save.label')}
            tooltip={t(canSave ? 'common.action.save.label' : 'error.validate.title-required')}
            disabled={!canSave}
          />
          <IconButton icon={<IconClose />} ariaLabel={t('common.action.close.label')} tooltip={t('capture.close.tip')} onClick={onClose} />
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
  const title = w.title.toLowerCase()
  if (title.startsWith(q)) return 0
  return title.includes(q) ? 1 : 2
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
        <span className="font-semibold" style={{ fontFamily: 'var(--font-display)', fontWeight: 'var(--font-display-weight)', fontStyle: 'var(--font-display-style)', fontVariantCaps: 'var(--font-display-caps)', textTransform: 'var(--font-display-case)', fontVariantNumeric: 'var(--font-display-figures)', fontSize: 'var(--type-display-17)' }}>{value.title}</span>
        {value.sub && <span className="microcopy">{value.sub}</span>}
        <span className="mono-label" style={{ fontSize: 'var(--type-display-9)', color: value.kind === 'book' ? 'var(--accent-ui)' : 'var(--amber)' }}>
          {value.tag}
        </span>
        <button type="button" className="tp-link ml-auto" onClick={() => onChange(null)}>{t('capture.picker.change.label')}</button>
      </div>
    )
  }
  return (
    <div className="token-input" ref={boxRef}>
      <input
        className="tp-input"
        placeholder={t('capture.picker.placeholder')}
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
                  <NameScroll>
                    {w.title}
                    {w.sub && <span style={{ color: 'var(--soft)' }}> · {w.sub}</span>}
                  </NameScroll>
                  <span className="mono-label" style={{ flex: 'none', fontSize: 'var(--type-ui-9)', color: w.kind === 'book' ? 'var(--accent-ui)' : 'var(--amber)' }}>
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
              {text.trim()
                ? t('capture.picker.create.label', { title: `“${text.trim()}”` })
                : t('capture.picker.create.blank.label')}
            </button>
          </li>
        </ul>,
        document.body,
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// THE CHOOSER, AND THE FORMS BEHIND IT
//
// THE OWNER'S BRIEF: "redesign from ground up. forget what is there right now.
// think of how it should be. we need to add various types of works, and also need
// to add various types of quotes. and then there is bulk imports. all these things
// need to be in the add surface that is visually similar to the rest of the app."
//
// WHAT WAS THERE, AND WHY IT WENT. Three tabs — a look-up card, one capture form,
// a wall of import instructions — that the reader "rotates freely between". Nobody
// rotates. You know what you are adding before you press ＋, so a segmented
// control across three things of wildly different weights spends the top of every
// opening asking a question you have already answered. And the middle tab was ONE
// form for nine kinds of quote, which is why it had a heading reading "What the
// kind carries" over four boxes that mostly do not apply — its own comment said
// the reason was that "the kind lives on the BOARD and this surface has not asked
// for one yet", and that stopped being true when the board control landed.
//
// WHAT IT IS NOW: one panel, two states. A CHOOSER, grouped the way the owner
// grouped it in their own sentence — a work, a quote, many at once — and then the
// one form for the thing you picked, with Back in the header. That is the app's
// own panel-stack chrome rather than a new idiom, and it is what makes "each
// surface needs to only show their specific fields" possible at all: the kind is
// known before the form draws, so the form can be honest about what it wants.
//
// NOBODY IS ASKED TWICE. A work's own ＋ opens the quote form with that work
// filled in; a proverb board's ＋ opens the proverb form (doorForBoard); the
// chooser appears only when nothing else has answered.
// ═══════════════════════════════════════════════════════════════════════════════

// Which endpoint each door writes to, and which shape it sends. One table rather
// than a chain of conditionals in the save handler, because "where does this door
// POST" is a fact about the door and reading it off a nested ternary is how the
// game path came to send a timestamp for a release.
// A SITTING is a run of captures made minutes apart — six quotes off one page of
// one book — and without this each one costs a full re-entry: pick the work, pick
// the colour, retype the tags.
//
// COLOUR AND TAGS carry with no expiry: neither can mis-file anything, and the
// worst case is a tag you remove, which is visible on the card. THE WORK carries
// for thirty minutes and no longer. That is deliberately in tension with "no
// default target when the surface was opened cold" — a silently pre-filled work
// invites mis-filed quotes — and the window is how both survive: within half an
// hour you are still holding the same book and the picker SHOWS what it chose, so
// it is not silent. Tomorrow you are not, and a stale target would file tomorrow's
// quote under yesterday's book with no signal at all.
const SITTING_KEY = 'tippani:lastCapture'
const SITTING_MS = 30 * 60 * 1000

// asTags takes either shape a seed can arrive in. The token input needs an array;
// the previous release's capture card kept its tags in a comma box and wrote the
// string it held — into localStorage for a sitting, and through `duplicateSeed`
// for a duplicate. `duplicateSeed` now hands back the array, but a sitting written
// by that release is still on disk in somebody's browser, so the tolerance has to
// live where both producers meet. Reading only the array dropped them silently,
// which is the one thing a sitting exists not to do.
const asTags = (v) => (Array.isArray(v) ? v : String(v || '').split(',').map((x) => x.trim()).filter(Boolean))

const DOOR_POST = { annotation: '/annotations', dialogue: '/dialogues' }

// The four doors the look-up card serves — a work you search a provider for. The
// board door is not one of them: a board is made rather than looked up.
const WORK_LOOKUP = ['book', 'film', 'show', 'game']

// The doors that write an `utterances` row. Their door key IS the value stored in
// `kind` (0053) — see addFields.js for why that is a departure from the design
// pack and why the schema forced it.
const STANDALONE = new Set(QUOTE_KIND_DOORS)

// A DOOR'S WORD COMES FROM THE APP'S OWN VOCABULARY, not from a key per door.
// `vocab.kind.*` and `vocab.quote-kind.*` already name every one of these things
// on the cards, in the board grouping, in the bulk editor and in the share
// payload — so a `add.door.speech.label` would be the word "Speech" written a
// second time, free to drift from the first. Four doors have no vocabulary entry
// because they are not kinds of quote, and they get one key each.
const DOOR_LABEL = (door) =>
  door === 'book' ? t('vocab.kind.book.label')
  : door === 'film' ? t('vocab.kind.movie.label')
  : door === 'show' ? t('vocab.kind.show.label')
  : door === 'game' ? t('vocab.kind.game.label')
  : QUOTE_KIND_DOORS.includes(door) ? t(`vocab.quote-kind.${door}.label`)
  : t(`add.door.${door}.label`)

// AND THE PANEL'S TITLE IS THAT SAME WORD. Not "Add a speech": you reached this
// panel by pressing ＋ and then Speech, so a title restating both is the design
// pack's "a row says a thing once" broken at the top of the screen — and it is
// fifteen more strings to translate for no fact the reader does not have.
const DOOR_TITLE = (door) => DOOR_LABEL(door)

// THREE FIELDS WEAR A DIFFERENT WORD PER KIND, and these maps are why there are
// three small tables rather than eighteen keys of the form
// `add.field.speaker.${door}.label`. Most doors share a word: a speech has a
// SPEAKER and everything written has a WRITER, so two keys cover six doors. A
// templated key per door would be fifteen strings to translate, most of them
// identical, and a missing one is a runtime "no string for" rather than a build
// error — which is exactly the failure a shared table cannot have.
//
// The fallback is the first entry, so a door added to `addFields.js` without a
// word here draws the generic label rather than nothing.
const SPEAKER_LABEL = { speech: 'said', letter: 'wrote', essay: 'wrote', poem: 'wrote', song: 'wrote', other: 'said' }
const LOCATOR_LABEL = { essay: 'page', poem: 'stanza', song: 'stanza', other: 'page' }
// A SONG'S IS THE OWNER'S OWN WORDING — "song work label: Book / Movie / Album" —
// because a song reaches a reader through any of the three, and `Album` alone
// would be wrong for a film song while `Source` would be wrong for all of them.
const WORK_TITLE_LABEL = { speech: 'source', letter: 'source', essay: 'title', poem: 'collection', song: 'album', other: 'source' }

// ---- the chooser ------------------------------------------------------------

// AddChooser — "what are you adding?", in the owner's own three groups.
//
// A BUTTON AND NOT A FILTER CHIP, though a chip row is what this looks like. The
// app's `tp-filter-chip` means "narrow the list to this" and wears an on-state; a
// door means "go here" and has no state to be in. Reusing the chip would put two
// different jobs behind one drawing, which `docs/ui-glossary.html` could then only
// document once.
//
// THE WORK ROW IS GATED BY `sections` and the quote row is not, which is the same
// asymmetry the old kind chooser had and for the same reason: hiding a section
// stops the app INVITING you into something you put away, and a quote is not filed
// in a section you can hide. `board` rides with the works because it is a
// container you make before you file into it.
export function AddChooser({ sections, onPick }) {
  const works = [...kindsFor(sections).map(([k]) => k), 'board']
  const quotes = ['annotation', 'dialogue', ...QUOTE_KIND_DOORS]
  const group = (labelKey, doors) => (
    <div className="tp-field" key={labelKey}>
      <MonoLabel>{t(labelKey)}</MonoLabel>
      <div className="flex flex-wrap gap-2">
        {doors.map((d) => (
          <button key={d} type="button" className="tp-btn tactile" onClick={() => onPick(d)}>
            {DOOR_LABEL(d)}
          </button>
        ))}
      </div>
    </div>
  )
  return (
    <div className="flex flex-col gap-4">
      <p className="microcopy">{t('add.chooser.prose')}</p>
      {works.length > 0 && group('add.group.work.label', works)}
      {group('add.group.quote.label', quotes)}
      {group('add.group.files.label', ['import'])}
    </div>
  )
}

// ---- the one quote form -----------------------------------------------------

// QuoteForm draws whatever `fieldsFor(door)` says and sends only what it drew.
//
// ONE COMPONENT FOR NINE DOORS, not nine components. The nine differ in WHICH
// boxes they show and in nothing else — same validation shape, same save verb,
// same sitting memory, same disclosure — so nine copies would be nine places for
// the ✓ to stop arming. What varies is data, and it lives in addFields.js where a
// test can read it without mounting anything.
//
// AND IT SENDS ONLY WHAT IT DREW, which is the half that is easy to get wrong. A
// POST here is full-state; a field the door hard-dropped must be absent from the
// body rather than sent empty, or a value that arrived by import would be cleared
// by a reader who never saw a box for it. `showsField` is the gate, in one place.
export function QuoteForm({ door, initialTarget, initialBoard, initialFields, onSaved, onWorkCreated, onSaveState }) {
  useBodyScrollLock(true)
  const [works, setWorks] = useState(null)
  const [creating, setCreating] = useState(null)
  const [showAll, setShowAll] = useState(false)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [sitting, setSitting] = usePersistedState(SITTING_KEY, null)
  const { boards } = useBoards()
  const tagPool = useTagNames()
  const { stickers, reload: reloadStickers } = useStickers()

  // Read once, at mount: a capture writes this on the way out, and re-reading it
  // mid-edit would change the form under somebody's hands.
  const [seed] = useState(() => {
    if (!sitting || typeof sitting !== 'object') return { color: 'yellow', tags: [], targetKey: null }
    const fresh = typeof sitting.at === 'number' && Date.now() - sitting.at < SITTING_MS
    return {
      color: sitting.color || 'yellow',
      // BOTH SHAPES, AND THE STRING IS THE OLD ONE. The card this form replaces
      // kept its tags in a comma-separated box and wrote the string it held, so a
      // reader who upgrades mid-sitting has `"grief, craft"` in localStorage and
      // this form takes an array. Reading only the array would drop them — a
      // silent loss of the one thing a sitting exists to carry, on exactly the
      // release that introduced the improvement.
      //
      // No migration and no version stamp: the value is a browser convenience
      // with a thirty-minute window on its interesting half, so accepting both
      // spellings for a release is cheaper than writing something that has to
      // run. The split matches what the old box did on save.
      tags: asTags(sitting.tags),
      targetKey: fresh ? sitting.targetKey || null : null,
    }
  })

  const [draft, setDraft] = useState(() => ({
    target: null,
    quote: '', note: '', translation: '', language: '',
    chapter: '', chapter_no: '', location: '', character: '',
    timestamp: '', timestamp_end: '', season: '', episode: '', episode_name: '',
    act: '', quest: '', dlc: '',
    speaker: '', occasion: '', when: '', circa: false, place: '',
    region: '', recipient: '', work_title: '', locator: '', source_author: '',
    board: initialBoard ?? null,
    tags: seed.tags, color: seed.color, sticker_id: null,
    // A DUPLICATE ARRIVES SEEDED, applied last so it beats the sitting: the reader
    // is copying a particular quote, not continuing a session. At initialisation
    // rather than in an effect, because an effect lands a frame after the first
    // paint — a form you can start typing into and then watch overwrite itself.
    ...(initialFields || {}),
    // AFTER the spread, so a seed's own tags go through the normaliser too — a
    // duplicate made by this release hands an array and one made by the last
    // hands a string, and neither may reach the token input unconverted.
    ...(initialFields ? { tags: asTags(initialFields.tags) } : {}),
  }))
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }))

  const needsWork = door === 'annotation' || door === 'dialogue'
  const mediaType = door === 'dialogue' ? draft.target?.media_type || 'movie' : undefined
  const { main, more } = fieldsFor(door, { mediaType })

  // What this work already knows about itself — its cast, its chapters, its packs.
  const suggest = useWorkSuggestions(needsWork ? draft.target : null)

  // THE CHAPTER PAIRING'S OFFER, AND WHY IT IS STATE HERE RATHER THAN INSIDE THE
  // BOX. `chapterPatch` answers about the OTHER box, so the component that holds
  // both values is the only one that can ask — and the chip has to survive the
  // commit that produced it, which a value living inside one box would not.
  //
  // One slot, not one per field: the two boxes are one pairing and only one of them
  // can be the counterpart at a time. `offer.field` says which box it belongs
  // under, so a chip cannot appear beside the box that caused it.
  const [offer, setOffer] = useState(null)
  const pair = (which, typed) => {
    const { patch, offer: next } = chapterPatch(which, typed, which === 'name' ? draft.chapter_no : draft.chapter, suggest.chapters)
    set(patch)
    setOffer(next)
  }
  const impliedActor = door === 'dialogue' ? suggest.actorFor(draft.character) : ''

  useEffect(() => {
    if (!needsWork) return undefined
    let stale = false
    Promise.all([json('GET', '/books'), json('GET', '/movies')]).then(([rb, rm]) => {
      if (stale) return
      const list = []
      if (rb.ok && rb.data) for (const b of rb.data.books || []) list.push(workFromBook(b))
      if (rm.ok && rm.data) for (const m of rm.data.movies || []) list.push(workFromMovie(m))
      // ONLY THE KIND THIS DOOR ASKED FOR. The old picker offered every book and
      // every film at once and worked out afterwards which form to draw; the door
      // has already said, so offering the other kind would be offering a choice
      // that silently changes which endpoint Save hits.
      const want = door === 'annotation' ? 'book' : 'screen'
      const mine = list.filter((w) => w.kind === want)
      setWorks(mine)
      if (initialTarget) {
        const hit = mine.find((w) => w.id === initialTarget.id)
        if (hit) setDraft((d) => ({ ...d, target: hit }))
      } else if (seed.targetKey) {
        const hit = mine.find((w) => `${w.kind}:${w.id}` === seed.targetKey)
        if (hit) setDraft((d) => (d.target ? d : { ...d, target: hit }))
      }
    })
    return () => { stale = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [door, initialTarget?.type, initialTarget?.id])

  // ---- what must be filled, in one place ------------------------------------
  //
  // The same predicate greys out Save and refuses the submit, so the button can
  // never be pressable in a state the handler would reject — and `why` is what its
  // tooltip says instead of leaving a dead control unexplained.
  const missing = needsWork && !draft.target
    ? t('error.validate.target-required')
    : !draft.quote.trim()
      // A book highlight may be a bare note ABOUT a page; nothing else can be,
      // because there is no page for it to be about.
      ? (door === 'annotation' && draft.note.trim() ? '' : t(door === 'annotation' ? 'error.validate.quote-or-note' : 'error.validate.quote-words'))
      : draft.when && !isPartialDate(draft.when, { historical: true })
        ? t('error.validate.date')
        : door === 'dialogue' && mediaType === 'show' && countOrNull(draft.episode) != null && countOrNull(draft.season) == null
          ? t('error.validate.season-required')
          : ''

  async function save() {
    if (missing) return setErr(missing.toLowerCase())
    setBusy(true)
    setErr('')
    const only = (key, value) => (showsField(door, key, { mediaType }) ? { [key]: value } : {})
    const txt = (key) => only(key, String(draft[key] ?? '').trim())
    const body = {
      quote: draft.quote.trim(),
      note: draft.note.trim(),
      color: draft.color,
      tags: draft.tags,
      ...only('sticker_id', draft.sticker_id),
      ...txt('translation'),
      ...txt('language'),
      ...(needsWork
        ? door === 'annotation'
          ? {
              book_id: draft.target.id,
              ...txt('chapter'),
              ...only('chapter_no', Number(String(draft.chapter_no).trim()) || 0),
              ...txt('location'),
              ...txt('character'),
            }
          : {
              movie_id: draft.target.id,
              ...txt('character'),
              ...txt('timestamp'),
              ...txt('timestamp_end'),
              ...txt('act'),
              ...txt('quest'),
              ...txt('dlc'),
              ...txt('episode_name'),
              // Blank means "not recorded" and 0 is a real season, so '' has to
              // become null rather than 0.
              ...only('season', countOrNull(draft.season)),
              ...only('episode', countOrNull(draft.episode)),
            }
        : {
            // The door IS the kind (0053), so this is not read off a control.
            kind: door,
            board_id: draft.board,
            ...txt('speaker'),
            ...txt('occasion'),
            ...txt('place'),
            ...txt('region'),
            ...txt('recipient'),
            ...txt('work_title'),
            ...txt('locator'),
            ...txt('source_author'),
            // THE CANONICAL FORM, NOT THE TYPED PHRASE. The box holds what the
            // reader wrote ('399 BCE'); the column holds '-0399', because it is
            // sorted and grouped as text. Rewriting the box mid-keystroke would
            // make the era unspellable — you cannot type B, C, E into a field that
            // reformats after each one. See UtteranceForm.
            ...(showsField(door, 'when', { mediaType })
              ? {
                  occasion_date: partialDateValue(parsePartialDate(draft.when, { historical: true })),
                  occasion_circa: draft.circa,
                }
              : {}),
          }),
    }
    const r = await json('POST', DOOR_POST[door] || '/quotes', body)
    setBusy(false)
    if (!r.ok) return setErr(errText(r))
    // ONE TOAST PER RECORD WRITTEN, not per door. Nine doors write an
    // `utterances` row and the confirmation a reader wants is "saved", not the
    // name of the door they just came through — which they can still see.
    toast(t(door === 'annotation' ? 'capture.toast.annotation' : door === 'dialogue' ? 'capture.toast.dialogue' : 'capture.toast.quote'))
    // What the next capture in this sitting starts from. THE QUOTE IS DELIBERATELY
    // NOT HERE: the words are the one thing never the same twice, and a form that
    // came back holding the last quote is a form somebody saves twice by accident.
    setSitting({
      at: Date.now(),
      color: draft.color,
      tags: draft.tags,
      targetKey: draft.target ? `${draft.target.kind}:${draft.target.id}` : null,
    })
    onSaved?.(door)
  }

  // Publish Save upward so the host can put it in its title bar. `draft` is in the
  // deps because `save` closes over it — without it the bar would keep calling a
  // stale save with the first keystroke's draft.
  useEffect(() => {
    onSaveState?.({ canSave: !missing && !busy, busy, why: missing, save })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missing, busy, draft])

  function targetCreated(work) {
    setWorks((list) => [work, ...(list || [])])
    set({ target: work })
    setCreating(null)
    onWorkCreated?.()
  }

  // ---- one renderer per field key -------------------------------------------
  //
  // A SWITCH AND NOT A COMPONENT PER FIELD, because every arm is two lines and a
  // component per arm would be twenty files whose only content is which label goes
  // with which control. The keys are addFields.js's; a key it offers and this does
  // not draw is caught by `add-surface.test.jsx`, which walks every door.
  const listID = `add-${door}-${draft.target?.id || 0}`
  function field(key) {
    switch (key) {
      case 'quote':
        return (
          <label className="tp-field" key={key}>
            <MonoLabel>{t('common.field.quote.label')}</MonoLabel>
            <textarea
              className="tp-input"
              // VERSE KEEPS ITS SHAPE, and that is 0068's whole point: "its line
              // breaks are its text". Four rows for prose, seven for a poem, so
              // the breaks are visible as you type rather than after you save.
              rows={door === 'poem' || door === 'song' ? 7 : 4}
              placeholder={t('capture.form.quote.placeholder')}
              style={{ fontFamily: 'var(--font-display)', fontWeight: 'var(--font-display-weight)', fontStyle: 'italic', fontSize: 'var(--type-display-17)', lineHeight: 1.55 }}
              value={draft.quote}
              onChange={(e) => set({ quote: e.target.value })}
            />
          </label>
        )
      case 'note':
        return (
          <label className="tp-field" key={key}>
            <MonoLabel>{t('common.field.note.label')}</MonoLabel>
            <textarea className="tp-input" rows={2} placeholder={t('capture.form.note.placeholder')} value={draft.note} onChange={(e) => set({ note: e.target.value })} />
          </label>
        )
      case 'translation':
        return (
          <label className="tp-field" key={key}>
            <MonoLabel>{t('common.field.translation.label')}</MonoLabel>
            <textarea className="tp-input" rows={2} placeholder={t('common.field.translation.placeholder')} value={draft.translation} onChange={(e) => set({ translation: e.target.value })} />
          </label>
        )
      case 'board':
        // Drawn even with one board, unlike the old card which hid the control
        // when there was nothing to choose between: this is where the quote LANDS,
        // and a quote in the wrong place with nothing on screen having said so is
        // the defect 3ba63af5 fixed. Pre-filled when the ＋ was pressed on a
        // board — you answered by standing there.
        return (
          <label className="tp-field" key={key}>
            <MonoLabel>{t('common.field.board.label')}</MonoLabel>
            <Select
              ariaLabel={t('common.field.board.label')}
              value={draft.board == null ? '' : String(draft.board)}
              onChange={(v) => set({ board: v === '' ? null : Number(v) })}
              options={[['', t('capture.board.default.label')], ...(boards || []).map((b) => [String(b.id), b.name])]}
            />
          </label>
        )
      case 'character':
        return (
          <div key={key}>
            <CastCombo
              label={t('common.field.character.label')}
              placeholder={t(door === 'annotation' ? 'book.quote.form.character.placeholder' : 'common.field.character.placeholder')}
              value={draft.character}
              onChange={(v) => set({ character: v })}
              cast={suggest.cast}
            />
            {/* Who plays them, from the cast — read-only, because the server
                derives the stored actor. Seeing it is how you know the name
                matched a real row rather than being kept as loose text. */}
            {impliedActor && <span className="microcopy">{t('capture.form.played-by.prose', { name: impliedActor })}</span>}
          </div>
        )
      // BOTH CHAPTER BOXES PAIR, AND ONLY ON COMMIT. `onChange` keeps the text in
      // step with the keyboard and touches nothing else; `onCommit` — a picked
      // suggestion, Enter, or focus leaving the box — is where the pairing runs.
      // The owner found why: "if i am at chapter 15, the chapter name is assigned
      // at typing 1 and then no rewrites". A rule that reads the box mid-word is
      // answering a question about a number the reader has not finished giving.
      case 'chapter':
        return (
          <div key={key} className="flex flex-col gap-1.5">
            <SuggestCombo
              label={t('common.field.chapter-name.label')}
              placeholder={t('capture.form.chapter-name.placeholder')}
              value={draft.chapter}
              options={suggest.chapterNames.map((n) => ({ name: n }))}
              onChange={(name) => { setOffer(null); set({ chapter: name }) }}
              onCommit={(name) => pair('name', name)}
            />
            {offer?.field === 'chapter_no' && (
              <OfferChip
                label={t('common.field.chapter-no.offer', { no: offer.value })}
                onAccept={() => { set({ chapter_no: offer.value }); setOffer(null) }}
              />
            )}
          </div>
        )
      case 'chapter_no':
        return (
          <div key={key} className="flex flex-col gap-1.5">
            <SuggestCombo
              label={t('common.field.chapter-no.label')}
              placeholder={t('capture.form.chapter-no.placeholder')}
              value={String(draft.chapter_no)}
              options={suggest.chapterNumbers.map((n) => ({ name: String(n) }))}
              nameCase={false}
              inputMode="decimal"
              onChange={(v) => { setOffer(null); set({ chapter_no: String(v).replace(/[^\d.]/g, '').slice(0, 7) }) }}
              onCommit={(v) => pair('no', String(v).replace(/[^\d.]/g, '').slice(0, 7))}
            />
            {offer?.field === 'chapter' && (
              <OfferChip
                label={t('common.field.chapter-name.offer', { name: offer.value })}
                onAccept={() => { set({ chapter: offer.value }); setOffer(null) }}
              />
            )}
          </div>
        )
      case 'location':
        return <Field key={key} label={t('common.field.location.label')} placeholder={t('capture.form.location.placeholder')} value={draft.location} onChange={(e) => set({ location: e.target.value })} />
      case 'timestamp':
        return <Field key={key} label={t('common.field.timestamp.label')} placeholder={t('capture.form.timestamp.placeholder')} value={draft.timestamp} onChange={(e) => set({ timestamp: e.target.value })} />
      case 'timestamp_end':
        return <Field key={key} label={t('common.field.timestamp-end.label')} placeholder={t('add.form.timestamp-end.placeholder')} value={draft.timestamp_end} onChange={(e) => set({ timestamp_end: e.target.value })} />
      case 'season':
        return <Field key={key} label={t('common.field.season.label')} type="number" min="0" max="999" placeholder={t('capture.form.season.placeholder')} value={draft.season} onChange={(e) => set({ season: e.target.value })} />
      case 'episode':
        return <Field key={key} label={t('common.field.episode.label')} type="number" min="0" max="9999" placeholder={t('capture.form.episode.placeholder')} value={draft.episode} onChange={(e) => set({ episode: e.target.value })} />
      case 'episode_name':
        return <Field key={key} label={t('common.field.episode-name.label')} nameCase placeholder={t('capture.form.episode-name.placeholder')} value={draft.episode_name} onChange={(e) => set({ episode_name: e.target.value })} />
      case 'act':
        return <Field key={key} label={t('common.field.act.label')} placeholder={t('capture.form.act.placeholder')} value={draft.act} onChange={(e) => set({ act: e.target.value })} />
      case 'quest':
        return <Field key={key} label={t('common.field.quest.label')} nameCase placeholder={t('capture.form.quest.placeholder')} value={draft.quest} onChange={(e) => set({ quest: e.target.value })} />
      case 'dlc':
        // The owner asked for this one as a combobox by name, and the pool is this
        // game's own packs (GET /movies/{id}/packs) for the reason the chapter
        // boxes read this book's own chapters: "Blood and Wine" belongs to one game.
        return (
          <SuggestCombo
            key={key}
            label={t('common.field.dlc.label')}
            placeholder={t('add.form.dlc.placeholder')}
            value={draft.dlc}
            options={suggest.packs.map((p) => ({ name: p }))}
            onChange={(v) => set({ dlc: v })}
          />
        )
      case 'speaker':
        // THE SAME COLUMN, THREE WORDS FOR IT. A speech has a speaker; a letter,
        // an essay and a poem have a writer. One label per door rather than one
        // label for all of them, because "Speaker" over a poem's author is the
        // interface guessing that somebody said it aloud.
        return <Field key={key} label={t(`add.field.speaker.${SPEAKER_LABEL[door] || 'said'}.label`)} nameCase placeholder={t('common.field.speaker.placeholder')} value={draft.speaker} onChange={(e) => set({ speaker: e.target.value })} />
      case 'occasion':
        return <Field key={key} label={t('common.field.occasion.label')} placeholder={t('common.field.occasion.placeholder')} value={draft.occasion} onChange={(e) => set({ occasion: e.target.value })} />
      case 'when':
        return (
          <PartialDateField
            key={key}
            label={t('quotes.form.when.label')}
            value={draft.when}
            onChange={(v) => set({ when: v })}
            historical
            circa={draft.circa}
            onCirca={(v) => set({ circa: v })}
            circaLabel={t('quotes.form.circa.label')}
          />
        )
      case 'place':
        return <Field key={key} label={t('common.field.place.label')} nameCase placeholder={t('common.field.place.placeholder')} value={draft.place} onChange={(e) => set({ place: e.target.value })} />
      case 'region':
        return <Field key={key} label={t('common.field.region.label')} nameCase placeholder={t('quotes.form.region.placeholder')} value={draft.region} onChange={(e) => set({ region: e.target.value })} />
      case 'recipient':
        return <Field key={key} label={t('add.field.recipient.label')} nameCase placeholder={t('quotes.form.recipient.placeholder')} value={draft.recipient} onChange={(e) => set({ recipient: e.target.value })} />
      case 'work_title':
        return <Field key={key} label={t(`add.field.work-title.${WORK_TITLE_LABEL[door] || 'source'}.label`)} nameCase placeholder={t('quotes.form.work-title.placeholder')} value={draft.work_title} onChange={(e) => set({ work_title: e.target.value })} />
      case 'locator':
        return <Field key={key} label={t(`add.field.locator.${LOCATOR_LABEL[door] || 'page'}.label`)} placeholder={t('quotes.form.locator.placeholder')} value={draft.locator} onChange={(e) => set({ locator: e.target.value })} />
      case 'source_author':
        return <Field key={key} label={t('common.field.source-author.label')} nameCase placeholder={t('add.form.source-author.placeholder')} value={draft.source_author} onChange={(e) => set({ source_author: e.target.value })} />
      case 'language':
        return <Field key={key} label={t('common.field.language.label')} nameCase placeholder={t('common.field.language.placeholder')} value={draft.language} onChange={(e) => set({ language: e.target.value })} />
      case 'tags':
        // A TOKEN INPUT, not the comma-separated box the old card used. The edit
        // forms have had this since tags existed; the capture form asked you to
        // type your own separators and offered no memory of a tag you already use,
        // which is how one library ends up with `essay` and `essays`.
        return (
          <div className="tp-field" key={key}>
            <MonoLabel>{t('common.field.tags.label')}</MonoLabel>
            <TokenInput value={draft.tags} onChange={(v) => set({ tags: v })} suggestions={tagPool} placeholder={t('common.field.tags.placeholder')} ariaLabel={t('common.field.tags.label')} />
          </div>
        )
      case 'color':
        return (
          <div className="flex items-center gap-3" key={key}>
            <MonoLabel>{t('common.mono.colour.label')}</MonoLabel>
            <ColorSwatches value={draft.color} onChange={(c) => set({ color: c })} />
          </div>
        )
      case 'sticker':
        return (
          <div className="tp-field" key={key}>
            <MonoLabel>{t('common.field.sticker.label')}</MonoLabel>
            <StickerPicker value={draft.sticker_id} onChange={(v) => set({ sticker_id: v })} stickers={stickers} reload={reloadStickers} />
          </div>
        )
      default:
        return null
    }
  }

  // A pair draws as one row of two. `splitPair` is addFields.js's, so the layout
  // is a property of the table rather than of this switch — the owner asked for
  // one of these by name ("location and chapter no. will share one line") and the
  // rest follow the same rule.
  const row = (key) => {
    const parts = splitPair(key)
    if (parts.length === 1) return field(key)
    return (
      <div className="grid grid-cols-2 gap-3" key={key}>
        {parts.map((p) => field(p))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3.5">
      {initialFields && (
        <p className="microcopy" style={{ color: 'var(--accent-ui)' }}>{t('capture.form.duplicate.prose')}</p>
      )}
      {needsWork && (
        <div className="tp-field">
          <MonoLabel>{t(`add.door.${door}.target.label`)}</MonoLabel>
          <WorkPicker
            works={works}
            value={draft.target}
            onChange={(w) => { set({ target: w }); if (w) setCreating(null) }}
            onCreate={(title) => { setErr(''); setCreating({ title }) }}
          />
        </div>
      )}
      {creating && !draft.target && (
        <div className="space-y-2.5" style={{ border: '1.4px dashed var(--ink-border)', borderRadius: 10, padding: '10px 12px' }}>
          <div className="flex items-center justify-between gap-2">
            <MonoLabel>{t('capture.form.create.label')}</MonoLabel>
            <button type="button" className="tp-link" onClick={() => setCreating(null)}>{t('capture.form.create.cancel.label')}</button>
          </div>
          {/* DELIBERATELY UNGATED by `sections`, unlike the chooser: this is reached
              only after the reader has said the work they are quoting is not in
              their library, so it is a step inside a form rather than a door into a
              section they put away. */}
          <AddLookup initialKind={door === 'annotation' ? 'book' : 'film'} initialQuery={creating.title} onCreated={targetCreated} lockKind />
        </div>
      )}
      {main.map(row)}
      {/* THE SOFT DROP. The owner's shape: "soft drop (behind a show all buttons
          button) all fields which are not frequently used." A disclosure and not a
          second panel, because these are the same form — a panel would make
          reaching a rare field a navigation rather than a glance. */}
      {more.length > 0 && (
        <>
          <button type="button" className="tp-link self-start" aria-expanded={showAll} onClick={() => setShowAll((v) => !v)}>
            {t(showAll ? 'add.form.show-all.hide.label' : 'add.form.show-all.label')}
          </button>
          {showAll && <div className="flex flex-col gap-3.5">{more.map(row)}</div>}
        </>
      )}
      <ErrorText>{err}</ErrorText>
      {/* No Save row down here: it is a ✓ in the surface's title bar, which on a
          phone is pinned and reachable without scrolling past the fields. What
          stays is the reason it is greyed, where the fields are. */}
      {missing && <p className="microcopy" style={{ color: 'var(--faint)' }}>{t('capture.form.missing.hint', { reason: missing })}</p>}
    </div>
  )
}

// ---- the board door ---------------------------------------------------------

// BoardDoor wraps `boards.jsx`'s own create form rather than drawing a second
// one. It already asks the three questions a board is made of — a name, a colour,
// and the kind, with the language list appearing for a proverb board — and it
// already knows the names in use, which is what stops two boards called the same
// thing. A copy here would be a second opinion about what a board is.
function BoardDoor({ onSaved, onSaveState }) {
  const { boards, reload } = useBoards()
  const [err, setErr] = useState('')
  // The header ✓ needs a verb to call, and BoardForm publishes none — it owns its
  // own submit button. So this door reports no save state and lets the form's own
  // footer draw the pair, which is the same arrangement the form uses everywhere
  // else it is hosted inline.
  useEffect(() => { onSaveState?.(null) }, [onSaveState])
  return (
    <>
      <BoardForm
        existingNames={(boards || []).map((b) => b.name)}
        submitLabel={t('add.door.board.save.label')}
        onSubmit={async (fields) => {
          const r = await json('POST', '/boards', fields)
          if (!r.ok) { setErr(errText(r)); return errText(r) }
          reload?.()
          onSaved?.('board')
          return null
        }}
      />
      <ErrorText>{err}</ErrorText>
    </>
  )
}

// ---- the surface ------------------------------------------------------------

// AddSurface renders when `open`. Its prop contract is unchanged from the
// three-tab version it replaces, deliberately: `App.jsx` decides WHERE a ＋ was
// pressed and this decides what to do about it, and moving that boundary would
// have made a shell change out of a form change.
//
// `initialSection` is still the five values `routes.js` produces — 'book',
// 'film', 'quote', 'standalone', 'import' — and `doorFor` below maps them onto
// doors. Anything it cannot answer opens the chooser, which is the honest
// behaviour: the surface asks rather than guessing which of nine kinds you meant.
export default function AddSurface({
  open,
  initialSection = 'book',
  initialTarget = null,
  initialBoard = null,
  initialFields = null,
  onClose,
  onAdded,
  onOpenMovie,
  onCaptured,
  onWorkCreated,
  pendingImport = 0,
  onReviewImport,
  onStaged,
  sections,
}) {
  const { boards } = useBoards()
  // WHAT THE READER PICKED, kept apart from what the ＋ already answered — and the
  // first cut of this held one `door` state written by an effect, which had a bug
  // worth recording: the effect depended on the boards list, so the moment
  // `/boards` came back it re-ran and reset the door to whatever the ＋ implied,
  // wiping the door the reader had just pressed. A chooser that empties itself a
  // few hundred milliseconds after you answer it.
  //
  // Two values compose instead of one being overwritten: `picked` is the reader's
  // and only a press or Back changes it; `openingDoor` is derived, so it can
  // recompute freely as data arrives without touching the answer.
  const [picked, setPicked] = useState(null)
  const [saveState, setSaveState] = useState(null)
  const mobile = useIsMobileScreen()

  // WHICH DOOR A ＋ OPENS, and the whole design is that nobody is asked twice.
  //
  // A work's own ＋ knows the work, so it knows whether the quote is a highlight
  // or a screen line. A proverb board's ＋ knows the kind (doorForBoard — 0037
  // gives a board two kinds and one of them has behaviour behind it). A duplicate
  // arrives with a draft and must land on the form that draft came from. What is
  // left over is a bare ＋ on the Quotes screen or a plain board, where the kind
  // genuinely is not known by anything — and there the chooser asks.
  const doorFor = () => {
    if (initialSection === 'import') return 'import'
    if (initialSection === 'film') return 'film'
    if (initialSection === 'book') return 'book'
    if (initialTarget) return initialTarget.type === 'movie' ? 'dialogue' : 'annotation'
    if (initialBoard != null) {
      const board = (boards || []).find((b) => b.id === initialBoard)
      const answered = doorForBoard(board)
      if (answered) return answered
    }
    // A duplicate carries the kind of the quote it copies, so it never needs the
    // chooser: the fields are already full and the form has to match them.
    if (initialFields?.kind && QUOTE_KIND_DOORS.includes(initialFields.kind)) return initialFields.kind
    return null
  }

  // DERIVED, NOT STORED. It answers "did the ＋ already say what this is", and it
  // may change as `/boards` lands — which is exactly why it must not be the thing
  // the reader's press writes to.
  const openingDoor = useMemo(doorFor, [initialSection, initialTarget?.type, initialTarget?.id, initialBoard, initialFields?.kind, boards])
  const door = picked ?? openingDoor

  // A CLOSED SURFACE FORGETS. Reopening from somewhere else must not land on the
  // door the last press chose — and the previous session's Save goes with it,
  // because the closure it holds captured that session's draft and a ✓ tapped
  // before the fresh form republishes would save the wrong thing.
  useEffect(() => {
    if (open) return
    setPicked(null)
    setSaveState(null)
  }, [open])

  // A door with nothing to save must not leave the previous door's Save in the bar.
  useEffect(() => { if (!door || door === 'import' || WORK_LOOKUP.includes(door)) setSaveState(null) }, [door])

  // ONE OWNER FOR ESCAPE — see useEscape in ui.jsx.
  useEscape(open, onClose)
  // ITS OWN BACK ENTRY, desktop-only for the reason FormModal gives: the mobile
  // branch is a MobileSheet, which takes the entry for itself, and two markers for
  // one dialog is two presses to close it.
  useBackToClose(open && !mobile, onClose)

  if (!open) return null

  // THE TITLE NAMES WHAT SAVE WILL WRITE, and on a duplicate that is the one thing
  // that must never be ambiguous: every box is full of another quote's words, and
  // "Add a proverb" over that reads like editing the thing you copied.
  const title = initialFields
    ? t('capture.title.duplicate')
    : door
      ? DOOR_TITLE(door)
      : t('add.chooser.title')

  const saveBtn = saveState && (
    <IconButton
      icon={<IconCheck />}
      ariaLabel={t('common.action.save.label')}
      tooltip={saveState.busy ? t('common.action.save.busy') : saveState.canSave ? t('common.action.save.label') : saveState.why || t('capture.save.blocked.tip')}
      ok
      disabled={!saveState.canSave || saveState.busy}
      onClick={() => saveState.save()}
    />
  )
  // BACK RATHER THAN CLOSE, once a door is open — the app's own panel-stack
  // chrome, and the reason the chooser is a state of this surface rather than a
  // screen: changing your mind about what you are adding should cost one press
  // and should not throw away the surface.
  //
  // IT IS ABSENT WHEN THE DOOR WAS NOT CHOSEN HERE. A ＋ pressed on a book opens
  // the highlight form directly, and a Back from there would walk the reader into
  // a chooser they never saw — which reads as the app having lost its place. The
  // test for it is whether `doorFor()` had an answer.
  const backBtn = door && openingDoor == null && (
    <IconButton icon={<IconBack />} ariaLabel={t('add.back.label')} tooltip={t('add.back.tip')} onClick={() => { setPicked(null); setSaveState(null) }} />
  )
  const closeBtn = (
    <IconButton icon={<IconClose />} ariaLabel={t('common.action.close.label')} tooltip={t('capture.close.tip')} onClick={onClose} />
  )

  const body = !door ? (
    <AddChooser sections={sections} onPick={setPicked} />
  ) : door === 'import' ? (
    <>
      {/* An import still waiting in the queue must be visible from the one place
          you would start another one. */}
      {pendingImport > 0 && onReviewImport && (
        <button type="button" className="tp-btn tp-btn-primary w-full" style={{ marginBottom: 12 }} onClick={onReviewImport}>
          {t('capture.import.pending', { count: pendingImport, n: pendingImport })}
        </button>
      )}
      <ImportPage embedded onReviewImport={onReviewImport} onStaged={onStaged} />
    </>
  ) : door === 'board' ? (
    <BoardDoor onSaved={(what) => { onAdded?.(what); onClose?.() }} onSaveState={setSaveState} />
  ) : WORK_LOOKUP.includes(door) ? (
    <AddLookup
      initialKind={door}
      lockKind
      sections={sections}
      onAdded={(what) => onAdded?.(what)}
      onCreated={onOpenMovie && door !== 'book' ? undefined : undefined}
    />
  ) : (
    <QuoteForm
      door={door}
      initialTarget={initialTarget}
      initialBoard={initialBoard}
      initialFields={initialFields}
      onSaved={() => onCaptured?.()}
      onWorkCreated={onWorkCreated}
      onSaveState={setSaveState}
    />
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
            {backBtn}
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
    <div className={SCRIM_CENTERED} role="dialog" aria-modal="true" aria-label={t('capture.dialog.aria')} onMouseDown={backdropClose(onClose)}>
      <HandCard variant={2} className="w-full max-w-2xl px-6 py-6">
        {/* THE HEADER IS THE PANEL STACK'S, not this surface's own invention: a
            leading slot, the title, and the verbs. Back sits leading because that
            is where every other panel in the app puts it. */}
        <div className="mb-4 flex items-center gap-2">
          {backBtn}
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
