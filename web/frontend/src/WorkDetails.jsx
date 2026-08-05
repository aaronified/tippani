// WorkDetails — the panel that replaced the "Edit" button on every work page
// (books, films and shows alike).
//
// Why it exists: the detail hero used to print ISBN / ASIN / TMDB / TVDB ids in
// its credit line — five words of catalogue plumbing above the thing you came to
// read — and the only way to change any field was a modal that made you re-save
// the whole record. Both problems have the same fix: one place that shows every
// stored field, where each field edits and saves on its own.
//
// Three surfaces, in one sheet, mobile-first (a full-screen MobileSheet on a
// phone, a centred dialog on desktop):
//
//   'fields'  the resting view — cover controls, then every field as an
//             InlineField (read at rest, pencil to edit, ✓ to save that field).
//   'lookup'  the metadata picker, exactly as it always looked.
//   'merge'   NEW: after a match is chosen, old and new side by side, one
//             toggle per field, so adopting a match is a choice per field
//             instead of an all-or-nothing overwrite.
//
// The merge screen defaults to checking only the fields you have nothing in.
// That is the non-destructive direction: filling a blank is never a loss, and
// overwriting an author you typed by hand is, so the second one asks first.
import { useEffect, useMemo, useState } from 'react'
import { coverImgURL, errText, json } from './api.js'
import { BookLookupPicker, CoverControls, CoverPreview, MovieLookupPicker, hiResPoster } from './CoverPicker.jsx'
import {
  ErrorText,
  FormModal,
  GhostButton,
  IconBack,
  IconCheck,
  IconClose,
  IconDelete,
  IconMetadata,
  InfoDot,
  InlineField,
  MonoLabel,
  Placeholder,
  StickerButton,
  TokenInput,
  Tooltip,
  titleCaseGenre,
  toast,
} from './ui.jsx'

// ---- field specs -----------------------------------------------------------
// One row per stored field. `kind` picks the editor and the coercion on save:
//   text (default) · long (textarea) · year · number · tokens · readonly
// `hint` is the InfoDot beside the label — where the ISBN/ASIN/TMDB explanation
// went when it came off the hero.

const BOOK_FIELDS = [
  { key: 'title', label: 'Title' },
  { key: 'author', label: 'Author', hint: 'Multiple authors can share one line — Settings decides which separators split them into distinct people.' },
  { key: 'published_year', label: 'Year', kind: 'year' },
  { key: 'series', label: 'Series', hint: 'The series or franchise this book belongs to. Books group by it in the Library, and sort by the number below.' },
  { key: 'series_index', label: 'Series #', kind: 'number' },
  {
    key: 'isbn',
    label: 'ISBN',
    hint: 'The 13-digit book identifier. Tippani only uses it to look the book up — a better cover, description or series come from a match on it. Nothing needs it to work.',
  },
  {
    key: 'asin',
    label: 'ASIN',
    hint: 'Amazon’s own identifier, on the product page of anything you bought or read on a Kindle. A cover can be fetched from it with no key or cookie at all.',
  },
  { key: 'genres', label: 'Genres', kind: 'tokens' },
  { key: 'description', label: 'Description', kind: 'long' },
]

const MOVIE_FIELDS = [
  { key: 'title', label: 'Title' },
  { key: 'media_type', label: 'Type', kind: 'mediaType', hint: 'A show’s dialogue carries a season and episode; a film’s does not. Changing this does not move any lines you have already saved.' },
  { key: 'director', label: 'Director', labelShow: 'Creator' },
  { key: 'release_year', label: 'Year', kind: 'year' },
  { key: 'series', label: 'Collection', hint: 'The franchise this title belongs to — the film side of a book’s series.' },
  { key: 'series_index', label: 'Collection #', kind: 'number' },
  {
    key: 'tmdb_id',
    label: 'TMDB id',
    kind: 'readonly',
    hint: 'The Movie Database’s id for this title. It is set by picking a match under “Fetch metadata”, not typed, because it is what a re-sync pulls from.',
    href: (it) => `https://www.themoviedb.org/${(it.media_type || 'movie') === 'show' ? 'tv' : 'movie'}/${it.tmdb_id}`,
  },
  {
    key: 'tvdb_id',
    label: 'TheTVDB id',
    kind: 'readonly',
    hint: 'TheTVDB’s id, set the same way. Optional — it usually has better coverage for long-running shows.',
    // The dereferrer resolves a bare numeric id to the right series/movie page.
    href: (it) => `https://thetvdb.com/dereferrer/${(it.media_type || 'movie') === 'show' ? 'series' : 'movie'}/${it.tvdb_id}`,
  },
  { key: 'genres', label: 'Genres', kind: 'tokens' },
  { key: 'description', label: 'Description', kind: 'long' },
]

// fullState mirrors bookState / movieState on the pages: PUT is full-state, so a
// one-field save has to carry every other field through untouched. Shelf status,
// progress and the read log are deliberately absent from both — they belong to
// PUT /:kind/:id/status, so editing a field here can never rewrite a history.
function fullState(kind, it) {
  if (kind === 'book') {
    return {
      title: it.title,
      author: it.author || '',
      isbn: it.isbn || '',
      asin: it.asin || '',
      description: it.description || '',
      published_year: it.published_year || 0,
      genres: it.genres || [],
      series: it.series || '',
      series_index: it.series_index || 0,
      favorite: !!it.favorite,
    }
  }
  return {
    title: it.title,
    director: it.director || '',
    release_year: it.release_year || 0,
    description: it.description || '',
    genres: it.genres || [],
    media_type: it.media_type || 'movie',
    series: it.series || '',
    series_index: it.series_index || 0,
    favorite: !!it.favorite,
  }
}

// coerce turns an editor's draft into what the API stores for that field kind.
function coerce(spec, draft) {
  if (spec.kind === 'tokens') return Array.isArray(draft) ? draft : []
  if (spec.kind === 'year') {
    const n = Number(String(draft).trim())
    return Number.isInteger(n) && n > 0 ? n : 0
  }
  if (spec.kind === 'number') return Number(String(draft).trim()) || 0
  return String(draft ?? '').trim()
}

// resting turns a stored value into what InlineField edits and shows.
function resting(spec, it) {
  const v = it?.[spec.key]
  if (spec.kind === 'tokens') return v || []
  if (spec.kind === 'year' || spec.kind === 'number') return v ? String(v) : ''
  return v == null ? '' : String(v)
}

// blank — "this field holds nothing". Kind-aware, because the numeric fields
// spell nothing as 0, not as "": a book with no year stores published_year 0,
// and a plain string test would call that filled. Getting this wrong both ways
// at once is what made it worth its own function — an unset year would refuse to
// pre-tick, and a match that also has no year would propose "0" as a change.
function blank(v, kind) {
  if (Array.isArray(v)) return v.length === 0
  if (kind === 'year' || kind === 'number') return !Number(v)
  return String(v ?? '').trim() === ''
}

export function WorkDetails({ open, onClose, kind, item, onChanged, onDelete }) {
  const path = kind === 'book' ? 'books' : 'movies'
  const isShow = kind === 'movie' && (item?.media_type || 'movie') === 'show'
  const specs = kind === 'book' ? BOOK_FIELDS : MOVIE_FIELDS
  const [view, setView] = useState('fields') // fields | lookup | merge
  const [merge, setMerge] = useState(null) // { rows, candidate }
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [genreSuggestions, setGenreSuggestions] = useState([])

  useEffect(() => {
    if (!open) return
    json('GET', '/genres').then((r) => { if (r.ok) setGenreSuggestions(r.data.genres || []) })
  }, [open])
  // Re-opening the panel always lands on the field list, never on a half-done
  // merge from last time.
  useEffect(() => {
    if (open) { setView('fields'); setMerge(null); setError('') }
  }, [open])

  if (!item) return null

  // save PUTs the whole record with `patch` applied. One field or ten — the
  // merge screen uses the same call, so there is one write path to reason about.
  async function save(patch, label) {
    setBusy(label || 'save')
    setError('')
    const r = await json('PUT', `/${path}/${item.id}`, { ...fullState(kind, item), ...patch })
    setBusy('')
    if (!r.ok) {
      setError(errText(r, 'could not save'))
      return false
    }
    onChanged?.(r.data)
    return true
  }

  // Returns whether the write landed, so InlineField keeps the editor (and what
  // was typed) open when it did not.
  async function saveField(spec, draft) {
    const next = coerce(spec, draft)
    if (spec.key === 'title' && !String(next).trim()) {
      setError('a title is required')
      return false
    }
    const ok = await save({ [spec.key]: next })
    if (ok) toast(`${spec.label.toLowerCase()} saved`)
    return ok
  }

  // ---- adopting a match ----------------------------------------------------
  // Building the merge rows is the whole difference from the old behaviour: the
  // candidate is not applied, it is *proposed*, field by field.
  function proposeBook(c) {
    const cand = {
      title: c.title || '',
      author: c.author || '',
      isbn: c.isbn13 || '',
      published_year: c.published_year || 0,
      series: c.series || '',
      series_index: c.series_index || 0,
      genres: c.genres || [],
      description: c.description || '',
    }
    return buildRows(cand, c.cover_url || '')
  }

  function proposeMovie(c) {
    const cand = {
      title: c.title || '',
      release_year: c.release_year || 0,
      description: c.overview || '',
      media_type: c.media_type || item.media_type || 'movie',
    }
    return buildRows(cand, c.poster_url || '')
  }

  // buildRows keeps only the fields the match actually has something to say
  // about AND that differ from what is stored. A row that would change nothing
  // is noise on a phone screen.
  function buildRows(cand, artUrl) {
    const rows = []
    for (const spec of specs) {
      if (spec.kind === 'readonly') continue
      if (!(spec.key in cand)) continue
      const next = cand[spec.key]
      if (blank(next, spec.kind)) continue
      const current = item[spec.key]
      const same = Array.isArray(next)
        ? JSON.stringify([...next].sort()) === JSON.stringify([...(current || [])].sort())
        : String(next ?? '') === String(current ?? '')
      if (same) continue
      rows.push({
        key: spec.key,
        label: spec.key === 'director' && isShow ? spec.labelShow : spec.label,
        spec,
        current,
        next,
        // Fill a blank without asking twice; never pre-tick an overwrite.
        take: blank(current, spec.kind),
      })
    }
    const currentArt = item.cover_path || item.poster_path
    if (artUrl) {
      rows.push({
        key: '__cover',
        label: kind === 'book' ? 'Cover' : 'Poster',
        art: true,
        current: currentArt ? coverImgURL(currentArt) : '',
        next: artUrl,
        take: !currentArt,
      })
    }
    return rows
  }

  async function applyMerge(rows) {
    const chosen = rows.filter((r) => r.take)
    if (!chosen.length) {
      setView('fields')
      return
    }
    const patch = {}
    for (const r of chosen) {
      // A movie candidate's poster_url is the w342 picker thumbnail. Store the
      // original instead, the same upgrade the cover search does — otherwise
      // taking a poster here quietly saves a worse image than the search would.
      if (r.key === '__cover') patch[kind === 'book' ? 'cover_url' : 'poster_url'] = kind === 'book' ? r.next : hiResPoster(r.next)
      else patch[r.key] = r.next
    }
    if (await save(patch, 'merge')) {
      toast(`${chosen.length} ${chosen.length === 1 ? 'field' : 'fields'} updated`)
      setMerge(null)
      setView('fields')
    }
  }

  // resync is the film side's all-in option: the server re-pulls poster, cast,
  // genres and details from the chosen supplier. Cast in particular exists
  // nowhere in a search result, so field-picking alone cannot produce it.
  async function resync(c) {
    setBusy('resync')
    setError('')
    const r = await json('PUT', `/movies/${item.id}`, {
      source: c.source || 'tmdb',
      source_id: c.source === 'tvdb' ? c.source_id : String(c.tmdb_id || c.source_id),
      media_type: c.media_type || item.media_type || 'movie',
    })
    setBusy('')
    if (!r.ok) return setError(errText(r, 'could not sync from the source'))
    onChanged?.(r.data)
    toast('re-synced from the source')
    setMerge(null)
    setView('fields')
  }

  const title = view === 'merge' ? 'Choose what to keep' : view === 'lookup' ? 'Fetch metadata' : 'Details'

  return (
    <FormModal open={open} onClose={onClose} title={title} maxWidth={620}>
      <ErrorText>{error}</ErrorText>

      {view === 'fields' && (
        <FieldList
          kind={kind}
          item={item}
          specs={specs}
          isShow={isShow}
          busy={busy}
          genreSuggestions={genreSuggestions}
          onSaveField={saveField}
          onCover={(patch) => save(patch, 'cover')}
          onChanged={onChanged}
          onFetch={() => setView('lookup')}
          onDelete={onDelete}
        />
      )}

      {view === 'lookup' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Tooltip label="Back to the fields">
              <button type="button" className="field-icon-btn tactile" aria-label="Back to the fields" onClick={() => setView('fields')}>
                <IconBack />
              </button>
            </Tooltip>
            <MonoLabel>pick the closest match</MonoLabel>
            <InfoDot
              title="Fetch metadata"
              text="Nothing is applied yet. Choosing a match opens a comparison of what you have against what it offers, and you tick the fields worth taking."
            />
          </div>
          {kind === 'book' ? (
            <BookLookupPicker
              auto
              isbn={item.isbn}
              title={item.title}
              author={item.author}
              asin={item.asin}
              onPick={(c) => { setMerge({ rows: proposeBook(c), candidate: c }); setView('merge') }}
            />
          ) : (
            <MovieLookupPicker
              auto
              title={item.title}
              year={item.release_year}
              mediaType={item.media_type || 'movie'}
              onPick={(c) => { setMerge({ rows: proposeMovie(c), candidate: c }); setView('merge') }}
            />
          )}
        </div>
      )}

      {view === 'merge' && merge && (
        <MergeScreen
          kind={kind}
          rows={merge.rows}
          candidate={merge.candidate}
          busy={busy}
          onBack={() => setView('lookup')}
          onApply={applyMerge}
          onResync={kind === 'movie' ? () => resync(merge.candidate) : null}
        />
      )}
    </FormModal>
  )
}

// ---- the resting view ------------------------------------------------------

function FieldList({ kind, item, specs, isShow, busy, genreSuggestions, onSaveField, onCover, onChanged, onFetch, onDelete }) {
  const artPath = kind === 'book' ? item.cover_path : item.poster_path
  return (
    <div className="space-y-3">
      {/* Artwork keeps its own icon row (upload · paste URL · search) — the same
          control CoverControls has always been, but wired to save immediately
          rather than stage a change for a Save button that no longer exists. */}
      <CoverControls
        kind={kind === 'book' ? 'books' : 'movies'}
        id={item.id}
        currentPath={artPath || ''}
        asin={item.asin}
        coverUrl=""
        clearCover={false}
        onSetUrl={(u) => onCover(kind === 'book' ? { cover_url: u } : { poster_url: u })}
        onClear={(reset) => { if (reset !== true) onCover({ clear_cover: true }) }}
        onUploaded={(rec) => onChanged?.(rec)}
        search={kind === 'book'
          ? { isbn: item.isbn, title: item.title, author: item.author, asin: item.asin }
          : { title: item.title, year: item.release_year, mediaType: item.media_type || 'movie' }}
      />

      <div className="flex flex-wrap items-center gap-2">
        <GhostButton type="button" onClick={onFetch} disabled={!!busy}>
          <IconMetadata />
          <span>Fetch metadata</span>
        </GhostButton>
        <InfoDot
          title="Fetch metadata"
          text={kind === 'book'
            ? 'Searches Google Books, Open Library and Amazon for this book, then lets you compare each field against what you already have and take only what you want.'
            : 'Searches TMDB and TheTVDB, then compares each field with what you have. From there you can take single fields, or re-sync everything — poster, cast, genres and details — from that source.'}
        />
        <span className="flex-1" />
        {onDelete && (
          <Tooltip label={`Delete this ${kind === 'book' ? 'book' : 'title'}`}>
            <button
              type="button"
              className="field-icon-btn field-icon-btn-danger tactile"
              aria-label={`Delete this ${kind === 'book' ? 'book' : 'title'}`}
              onClick={onDelete}
            >
              <IconDelete />
            </button>
          </Tooltip>
        )}
      </div>

      <div>
        {specs.map((spec) => {
          const label = spec.key === 'director' && isShow ? spec.labelShow : spec.label
          const value = resting(spec, item)
          if (spec.kind === 'readonly') {
            // A supplier id is a link to the record it names, not a number to
            // retype — it is written only by picking a match.
            return (
              <InlineField
                key={spec.key}
                label={label}
                value={value}
                hint={spec.hint}
                placeholder="set by fetching metadata"
                disabled
                display={spec.href && value ? (
                  <Tooltip label={`Open this record on ${label.replace(/ id$/, '')}`}>
                    <a href={spec.href(item)} target="_blank" rel="noopener noreferrer" className="tp-link">
                      #{value} ↗
                    </a>
                  </Tooltip>
                ) : undefined}
              />
            )
          }
          if (spec.kind === 'tokens') {
            return (
              <InlineField
                key={spec.key}
                label={label}
                value={value}
                display={value.join(' · ')}
                hint={spec.hint}
                busy={!!busy}
                onSave={(d) => onSaveField(spec, d)}
                input={({ value: v, onChange }) => (
                  <TokenInput value={v} onChange={onChange} suggestions={genreSuggestions} placeholder="add a genre…" ariaLabel={label} transform={titleCaseGenre} />
                )}
              />
            )
          }
          if (spec.kind === 'mediaType') {
            return (
              <InlineField
                key={spec.key}
                label={label}
                value={value}
                display={value === 'show' ? 'Show' : 'Film'}
                hint={spec.hint}
                busy={!!busy}
                onSave={(d) => onSaveField(spec, d)}
                input={({ value: v, onChange }) => (
                  <div className="flex gap-2">
                    {[['movie', 'Film'], ['show', 'Show']].map(([k, l]) => (
                      <button
                        key={k}
                        type="button"
                        className={'tp-filter-chip' + (v === k ? ' active' : '')}
                        aria-pressed={v === k}
                        onClick={() => onChange(k)}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                )}
              />
            )
          }
          return (
            <InlineField
              key={spec.key}
              label={label}
              value={value}
              hint={spec.hint}
              busy={!!busy}
              multiline={spec.kind === 'long'}
              inputMode={spec.kind === 'year' ? 'numeric' : spec.kind === 'number' ? 'decimal' : undefined}
              maxLength={spec.kind === 'year' ? 4 : undefined}
              onSave={(d) => onSaveField(spec, d)}
            />
          )
        })}
      </div>
    </div>
  )
}

// ---- the merge screen ------------------------------------------------------

// MergeScreen is the answer to "it fetched metadata and clobbered my author":
// every field the match would change, yours on the left and theirs on the right,
// with a toggle you own. Stacked rather than columned, because the phone is the
// first target and two 150px columns of prose are unreadable there.
function MergeScreen({ kind, rows, candidate, busy, onBack, onApply, onResync }) {
  const [state, setState] = useState(rows)
  useEffect(() => setState(rows), [rows])
  const chosen = useMemo(() => state.filter((r) => r.take).length, [state])
  const setAll = (take) => setState((s) => s.map((r) => ({ ...r, take })))
  const toggle = (key) => setState((s) => s.map((r) => (r.key === key ? { ...r, take: !r.take } : r)))

  const sourceLabel = kind === 'book'
    ? (candidate?.source || '').toUpperCase()
    : `${(candidate?.source || 'tmdb').toUpperCase()} #${candidate?.source === 'tvdb' ? candidate?.source_id : candidate?.tmdb_id || candidate?.source_id}`

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Tooltip label="Back to the matches">
          <button type="button" className="field-icon-btn tactile" aria-label="Back to the matches" onClick={onBack}>
            <IconBack />
          </button>
        </Tooltip>
        <MonoLabel>{sourceLabel}</MonoLabel>
        <InfoDot
          title="Choose what to keep"
          text="Fields you have nothing in are ticked for you — filling a blank costs nothing. Anything already filled starts unticked, so a match can never quietly overwrite something you typed."
        />
        <span className="flex-1" />
        <Tooltip label="Take everything">
          <button type="button" className="field-icon-btn tactile" aria-label="Take every field" onClick={() => setAll(true)}>
            <IconCheck />
          </button>
        </Tooltip>
        <Tooltip label="Take nothing">
          <button type="button" className="field-icon-btn tactile" aria-label="Take no fields" onClick={() => setAll(false)}>
            <IconClose />
          </button>
        </Tooltip>
      </div>

      {state.length === 0 && (
        <p className="microcopy">this match agrees with everything you already have — nothing to change.</p>
      )}

      <div className="merge-list">
        {state.map((r) => (
          <Tooltip key={r.key} label="Take this field from the match">
            <button
              type="button"
              className={'merge-row' + (r.take ? ' is-taken' : '')}
              aria-pressed={r.take}
              onClick={() => toggle(r.key)}
            >
              <span className="merge-check" aria-hidden="true">{r.take ? <IconCheck /> : null}</span>
              <span className="min-w-0 flex-1">
                <span className="merge-label">{r.label}</span>
                {r.art ? (
                  <span className="merge-art">
                    <span className="merge-art-side">
                      <MonoLabel>yours</MonoLabel>
                      {r.current ? <CoverPreview url={r.current} label="" className="w-16" /> : <Placeholder kind="NONE" className="w-16" />}
                    </span>
                    <span className="merge-art-side">
                      <MonoLabel style={{ color: 'var(--accent-ui)' }}>theirs</MonoLabel>
                      <CoverPreview url={r.next} label="" className="w-16" />
                    </span>
                  </span>
                ) : (
                  <>
                    {/* blank(), not a truthiness test: an unset year is 0, and
                        "0" is not what "you have nothing here" looks like. */}
                    <span className="merge-old">
                      {blank(r.current, r.spec?.kind) ? 'nothing yet' : fmtVal(r.current)}
                    </span>
                    <span className="merge-new">{fmtVal(r.next)}</span>
                  </>
                )}
              </span>
            </button>
          </Tooltip>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <StickerButton type="button" disabled={!!busy || chosen === 0} onClick={() => onApply(state)}>
          {busy === 'merge' ? 'Applying…' : `Take ${chosen} ${chosen === 1 ? 'field' : 'fields'}`}
        </StickerButton>
        {onResync && (
          <>
            <GhostButton type="button" disabled={!!busy} onClick={onResync}>
              {busy === 'resync' ? 'Re-syncing…' : 'Re-sync everything'}
            </GhostButton>
            <InfoDot
              title="Re-sync everything"
              text="Pulls the whole record from this source — poster, cast, genres, director and details — replacing what is stored. The cast is the reason to reach for it: a search result does not carry one, so ticking fields above can never fill it."
            />
          </>
        )}
      </div>
    </div>
  )
}

// fmtVal renders a stored value for the comparison rows: an array joins, a
// number prints, a blank stays blank. Long descriptions are clamped by CSS
// rather than truncated here, so the full text is still selectable.
function fmtVal(v) {
  if (Array.isArray(v)) return v.join(' · ')
  if (v == null) return ''
  return String(v)
}
