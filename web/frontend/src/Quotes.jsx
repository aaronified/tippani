// Standalone quotes (ROADMAP §24): a line from a speech, a letter, an
// interview, a song, or something a friend said. The third kind of quote, and
// the first with no work behind it.
//
// What it does NOT have: title, author, chapter, page, character, actor,
// timestamp. What it has instead is the occasion — who said it, on what
// occasion, when, where, and through what medium. The occasion is also the
// locator, and unlike every other locator in this app it DISCRIMINATES: the
// same words said on two occasions are two quotes, so editing the occasion
// changes what the quote is.
//
// The card itself is AnnotationCard with a different `meta` line and a
// different `form`. See its comment for why a bespoke wrapper would have been
// wrong.

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { json, errText, downloadPost } from './api.js'
import { AnnotationCard, fmtDate } from './Library.jsx'
import { CreditFaces, DEFAULT_CREDIT_SEPS, PersonModal, PersonName, parseCreditSeps, splitCredits, usePeople } from './people.jsx'
import { ShareDialog, quoteShare } from './share.jsx'
import { StickerPicker, useStickers } from './stickers.jsx'
import {
  ColorSwatches,
  EmptyState,
  ErrorText,
  Field,
  filterChipClass,
  GhostButton,
  Masonry,
  MonoLabel,
  PageHeader,
  PartialDateField,
  Placeholder,
  Select,
  TokenInput,
  Tooltip,
  formatPartialDate,
  isPartialDate,
  useColumnsAt,
  usePersistedState,
} from './ui.jsx'

const PRIMARY = 'tp-btn tp-btn-primary' // aesthetic-aware primary (§6)

// utteranceState is the full-state PUT body for one quote — the mirror of
// annotationState and dialogueState. Every PUT in this app is full-state, so a
// field missing here is a field silently cleared the next time anyone
// favourites or drags a sticker.
//
// `??` rather than `||` on the sticker fields: 0 is a legal coordinate and the
// top-left corner would otherwise reset to unplaced.
export function utteranceState(u) {
  return {
    quote: u.quote || '',
    note: u.note || '',
    color: u.color || 'yellow',
    tags: u.tags || [],
    favorite: !!u.favorite,
    speaker: u.speaker || '',
    occasion: u.occasion || '',
    occasion_date: u.occasion_date || '',
    place: u.place || '',
    medium: u.medium || '',
    sticker_id: u.sticker_id ?? null,
    sticker_x: u.sticker_x ?? null,
    sticker_y: u.sticker_y ?? null,
  }
}

// SPEAKER_LINK styles the speaker's name to inherit the meta line's mono voice
// rather than arriving as a blue link in the middle of it — the same trick the
// film pages use for PLAYED BY.
const SPEAKER_LINK = {
  font: 'inherit',
  color: 'inherit',
  background: 'none',
  border: 'none',
  padding: 0,
  cursor: 'pointer',
  textDecoration: 'underline',
  textUnderlineOffset: 2,
}

// utteranceMeta is the small line under the quote, standing where a book's
// "CH. 4 · P.112" stands. Speaker first, because it is the thing you look for.
//
// The date is rendered by formatPartialDate, NEVER by the shelf's fmtDate: a
// partial date is a string, and `new Date('1944')` is a valid Date that would
// print as a January morning nobody recorded.
//
// Given `onOpenPerson` it returns a NODE rather than a string: the speaker
// becomes a clickable credit with their portrait, which is what a book's author
// and a dialogue's actor have always been. The share IMAGE has drawn speaker
// faces since 1.5.0 — `speaker` became a people kind in the same release — so
// until now a speaker you had enriched showed their portrait when you exported
// the quote and stayed inert text on the card you exported it from.
//
// The name is split with splitCredits for the same reason the share image
// splits it: a speaker is a credit and can name two people, and the card and
// the image have to agree about who is credited.
//
// `omitSpeaker` drops the speaker from the line for a surface that has already
// credited them above it — the search popup puts a portrait chip in its header,
// so including the name here named the same person twice on one card, and
// passing the rich version would have drawn their face twice as well.
//
// Returns '' when there is nothing to say, and that is load-bearing rather than
// tidy. AnnotationCard renders this as `{metaLine && <MonoLabel>}`, and a JSX
// element is ALWAYS truthy — so a proverb (no speaker, no occasion, nothing)
// would otherwise get an empty label and the spacing that comes with it.
export function utteranceMeta(u, { people, seps, onOpenPerson, omitSpeaker } = {}) {
  const rest = [u.occasion, formatPartialDate(u.occasion_date), u.place, u.medium].filter(Boolean)
  if (omitSpeaker) return rest.join(' · ')
  if (!onOpenPerson) return [u.speaker, ...rest].filter(Boolean).join(' · ')

  const names = u.speaker ? splitCredits(u.speaker, seps || DEFAULT_CREDIT_SEPS) : []
  if (names.length === 0 && rest.length === 0) return ''
  return (
    <>
      {names.length > 0 && (
        <>
          <CreditFaces names={names} map={people} size={20} ring="var(--card)" className="mr-1.5 align-middle" />
          {names.map((n, i) => (
            <Fragment key={n}>
              {i > 0 && ', '}
              <PersonName kind="speaker" name={n} onOpen={onOpenPerson} className="" style={SPEAKER_LINK} />
            </Fragment>
          ))}
        </>
      )}
      {names.length > 0 && rest.length > 0 && ' · '}
      {rest.join(' · ')}
    </>
  )
}

// UtteranceForm follows the house form contract: {initial, onSubmit, onCancel,
// submitLabel, tagSuggestions, stickers, reloadStickers}, onSubmit resolving to
// an error string or null.
export function UtteranceForm({ initial, onSubmit, onCancel, submitLabel, tagSuggestions = [], stickers = [], reloadStickers }) {
  const [quote, setQuote] = useState(initial?.quote || '')
  const [note, setNote] = useState(initial?.note || '')
  const [speaker, setSpeaker] = useState(initial?.speaker || '')
  const [occasion, setOccasion] = useState(initial?.occasion || '')
  const [occasionDate, setOccasionDate] = useState(initial?.occasion_date || '')
  const [place, setPlace] = useState(initial?.place || '')
  const [medium, setMedium] = useState(initial?.medium || '')
  const [color, setColor] = useState(initial?.color || 'yellow')
  const [tags, setTags] = useState(initial?.tags || [])
  const [stickerId, setStickerId] = useState(initial?.sticker_id ?? null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // The must-fill rule, stated once so the guard and the greyed-out button read
  // the same value. A quote with no words is not a quote — unlike an
  // annotation, which may legally be a bare note about a page, because there is
  // no page here to be about.
  const missing = !quote.trim()
    ? 'Write the quote'
    : occasionDate && !isPartialDate(occasionDate)
      ? 'Check the date'
      : ''

  async function submit(e) {
    e.preventDefault()
    if (missing) return setError(missing.toLowerCase())
    setBusy(true)
    setError('')
    const err = await onSubmit({
      quote: quote.trim(),
      note: note.trim(),
      speaker: speaker.trim(),
      occasion: occasion.trim(),
      occasion_date: occasionDate.trim(),
      place: place.trim(),
      medium: medium.trim(),
      color,
      tags,
      // favorite is edited on the card, not here — but PUT is full-state, so
      // carry the existing value through.
      favorite: !!initial?.favorite,
      sticker_id: stickerId,
      sticker_x: initial?.sticker_x ?? null,
      sticker_y: initial?.sticker_y ?? null,
    })
    setBusy(false)
    if (err) return setError(err)
    if (!initial) {
      // A fresh capture keeps the OCCASION, the colour and the tags, and clears
      // only the words — the same stickiness DialogueForm keeps for season and
      // episode. You copy several lines out of one speech in a sitting.
      setQuote('')
      setNote('')
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
        <Field label="Speaker" placeholder="who said it" value={speaker} onChange={(e) => setSpeaker(e.target.value)} />
        <Field label="Occasion" placeholder="a speech, a letter…" value={occasion} onChange={(e) => setOccasion(e.target.value)} />
      </div>
      <div className="cl-grid">
        {/* A year alone is a complete answer, so this is a partial date rather
            than a date picker — see the field's own note. */}
        <PartialDateField label="When" value={occasionDate} onChange={setOccasionDate} />
        <Field label="Place" placeholder="where" value={place} onChange={(e) => setPlace(e.target.value)} />
      </div>
      <Field label="Medium" placeholder="radio, speech, letter…" value={medium} onChange={(e) => setMedium(e.target.value)} />
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

// ---- the screen ---------------------------------------------------------

// QuotesPage is a FLAT list, and that is the whole design. Library and
// Catalogue group quotes under the work they came from; there is no work here,
// so there is nothing to group by — and inventing one (by speaker, say) would
// bury every proverb, which has no speaker at all. Filters do the narrowing
// instead: the server already answers ?color= ?favorite= ?tag= ?speaker=.
export default function QuotesPage({ creditSeparators }) {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [shareFor, setShareFor] = useState(null)
  const [expanded, setExpanded] = useState(null)
  const [tags, setTags] = useState([])
  const [color, setColor] = usePersistedState('tippani:quotes:color', '')
  const [favOnly, setFavOnly] = usePersistedState('tippani:quotes:fav', false)
  const [tag, setTag] = usePersistedState('tippani:quotes:tag', '')
  const [speaker, setSpeaker] = usePersistedState('tippani:quotes:speaker', '')
  const { stickers, reload: reloadStickers } = useStickers()
  // Speaker portraits for the card's credit line AND the share image — the same
  // enrichment authors and actors get, now that `speaker` is a people kind.
  // reload matters: saving a portrait in the panel has to repaint the chip
  // behind it, the way Library reloads its authors.
  const { map: speakerMap, reload: reloadSpeakers } = usePeople('speaker')
  const [person, setPerson] = useState(null) // { kind, name } open in the metadata panel
  const seps = useMemo(() => parseCreditSeps(creditSeparators), [creditSeparators])
  const columns = useColumnsAt([[1280, 3], [860, 2]])

  const load = useCallback(async () => {
    const qs = new URLSearchParams()
    if (color) qs.set('color', color)
    if (favOnly) qs.set('favorite', '1')
    if (tag) qs.set('tag', tag)
    if (speaker) qs.set('speaker', speaker)
    const r = await json('GET', '/quotes' + (qs.toString() ? `?${qs}` : ''))
    // The response key is `utterances` — the table, not the route. 0026 records
    // why the two differ.
    if (r.ok) {
      setRows(r.data.utterances || [])
      setError('')
    } else {
      setError(errText(r))
    }
  }, [color, favOnly, tag, speaker])

  useEffect(() => {
    load()
  }, [load])
  useEffect(() => {
    json('GET', '/tags').then((r) => {
      if (r.ok) setTags(r.data.tags)
    })
  }, [])

  const tagMap = useMemo(() => Object.fromEntries(tags.map((t) => [t.name, t])), [tags])
  const stickerMap = useMemo(() => Object.fromEntries(stickers.map((s) => [s.id, s])), [stickers])
  // Speakers offered as a filter come from what is actually saved rather than
  // from the People console: an unenriched speaker is still a speaker, and
  // filtering by one you can see is the point.
  const speakers = useMemo(() => {
    const seen = new Set()
    for (const u of rows || []) if (u.speaker) seen.add(u.speaker)
    return [...seen].sort((a, b) => a.localeCompare(b))
  }, [rows])

  async function save(id, fields) {
    const r = await json('PUT', `/quotes/${id}`, fields)
    if (!r.ok) return errText(r, 'could not save')
    setEditingId(null)
    await load()
    return null
  }
  // Resolves false on failure so AnnotationCard's optimistic colour pick can
  // roll its preview back — the same contract Library's patch keeps.
  async function patch(u, fields) {
    const r = await json('PUT', `/quotes/${u.id}`, { ...utteranceState(u), ...fields })
    if (!r.ok) {
      setError(errText(r, 'could not save'))
      return false
    }
    setError('')
    await load()
    return true
  }
  async function remove(u) {
    if (!confirm('Delete this quote?')) return
    const r = await json('DELETE', `/quotes/${u.id}`)
    if (r.ok) load()
    else setError(errText(r))
  }

  const sharePayload = (u) =>
    quoteShare({
      quote: u.quote,
      note: u.note,
      speaker: u.speaker,
      occasion: u.occasion,
      when: formatPartialDate(u.occasion_date),
      place: u.place,
      medium: u.medium,
      date: fmtDate(u.noted_at || u.created_at),
      tags: u.tags,
      color: u.color,
      people: speakerMap,
    })

  const filtered = !!(color || favOnly || tag || speaker)
  return (
    <section className="space-y-5">
      <PageHeader
        title="Quotes"
        counts={rows ? `${rows.length} quote${rows.length === 1 ? '' : 's'} · from no book and no film` : undefined}
        right={
          rows && rows.length > 0 ? (
            <Tooltip label="Export these quotes" side="bottom">
              <GhostButton
                onClick={() => downloadPost('/export/quotes', { ids: rows.map((u) => u.id) }, 'tippani-quotes.md')}
              >
                Export
              </GhostButton>
            </Tooltip>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={filterChipClass(favOnly)}
          aria-pressed={favOnly}
          onClick={() => setFavOnly(!favOnly)}
        >
          ♥ favourites
        </button>
        {/* Tapping the picked colour clears it — there is no "no colour" to
            pick, so the swatch has to double as its own off switch. */}
        <ColorSwatches value={color} onChange={(c) => setColor(c === color ? '' : c)} ariaLabel="Filter by colour" />
        {tags.length > 0 && (
          <Select
            ariaLabel="Filter by tag"
            value={tag}
            onChange={setTag}
            options={[['', 'All tags'], ...tags.map((t) => [t.name, t.name])]}
          />
        )}
        {speakers.length > 0 && (
          <Select
            ariaLabel="Filter by speaker"
            value={speaker}
            onChange={setSpeaker}
            options={[['', 'All speakers'], ...speakers.map((n) => [n, n])]}
          />
        )}
        {filtered && (
          <GhostButton
            onClick={() => {
              setColor('')
              setFavOnly(false)
              setTag('')
              setSpeaker('')
            }}
          >
            Clear
          </GhostButton>
        )}
      </div>

      <ErrorText>{error}</ErrorText>

      {!rows ? (
        <Placeholder />
      ) : rows.length === 0 ? (
        <EmptyState>
          {filtered ? 'no quotes match those filters' : 'nothing here yet — ＋ Add saves a line from anywhere'}
        </EmptyState>
      ) : (
        <Masonry columns={columns}>
          {rows.map((u, i) => (
            <AnnotationCard
              key={u.id}
              a={u}
              variant={i}
              meta={utteranceMeta(u, { people: speakerMap, seps, onOpenPerson: setPerson })}
              form={UtteranceForm}
              tagMap={tagMap}
              stickerMap={stickerMap}
              stickers={stickers}
              reloadStickers={reloadStickers}
              editing={editingId === u.id}
              setEditingId={setEditingId}
              save={save}
              patch={patch}
              remove={remove}
              onShare={() => setShareFor(u)}
              tagSuggestions={Object.keys(tagMap)}
              expanded={expanded === u.id}
              onToggleExpand={() => setExpanded(expanded === u.id ? null : u.id)}
            />
          ))}
        </Masonry>
      )}

      {shareFor && (
        <ShareDialog
          share={sharePayload(shareFor)}
          seen={{ kind: 'utterance', id: shareFor.id }}
          onClose={() => setShareFor(null)}
        />
      )}

      {person && (
        <PersonModal
          kind={person.kind}
          name={person.name}
          onClose={() => setPerson(null)}
          onSaved={reloadSpeakers}
        />
      )}
    </section>
  )
}
