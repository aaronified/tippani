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
import { GroupHeading, WorkListScaffold, groupWorks } from './works.jsx'
import {
  ColorSwatches,
  ConfirmDialog,
  ErrorText,
  Field,
  GhostButton,
  Masonry,
  MonoLabel,
  PartialDateField,
  Placeholder,
  Select,
  TokenInput,
  formatPartialDate,
  isPartialDate,
  QUOTE_COLUMNS,
  useColumnsAt,
  useIsMobileScreen,
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

// utteranceYear reads the year out of a partial occasion date for the decade
// grouping. occasion_date is a STRING and may be 'YYYY', 'YYYY-MM' or
// 'YYYY-MM-DD' (§3f), so the year is its first four characters — never
// new Date(), which turns '1944' into a January morning nobody recorded.
export function utteranceYear(u) {
  const y = Number((u.occasion_date || '').slice(0, 4))
  return Number.isInteger(y) && y > 0 ? y : null
}

// GROUP_OPTIONS — what a shelf of quotes with no works can still be sorted into
// piles by. The residual bucket matters more here than on the other two screens:
// a proverb has no speaker, no medium and no date, so it lands in the catch-all
// of every one of these, which is why the label says what is missing.
const GROUP_OPTIONS = [
  ['none', 'Quotes'],
  ['speaker', 'Speaker'],
  ['medium', 'Medium'],
  ['place', 'Place'],
  ['decade', 'Decade'],
]
const GROUP_RESIDUAL = { medium: 'No medium', place: 'No place' }

// groupUtterances buckets quotes for the group-by view. Extracted from the
// component so the four dimensions can be checked without rendering a screen —
// and because the speaker dimension is the one place this page has to agree
// with the card and the share image about who is credited, which is a claim
// worth a test rather than a reading.
export function groupUtterances(list, dim, seps) {
  // 'speaker' is this page's name for the dimension groupWorks calls 'author':
  // the credit, split into the people it names. Without the translation it fell
  // through to the generic facet branch, which reads the raw column — so a line
  // credited to two speakers filed under the joined string as though that were
  // a person, and the residual bucket read "None" instead of "No speaker".
  const workDim = dim === 'speaker' ? 'author' : dim
  return groupWorks(list, workDim, {
    credit: (u) => u.speaker,
    splitCredit: true,
    creditResidual: 'No speaker',
    year: utteranceYear,
    // medium and place are literal column names, so the accessor is the dim.
    facet: (u, d) => u[d],
    facetResidual: (d) => GROUP_RESIDUAL[d] || 'None',
    seps,
  })
}

const SORT_OPTIONS = [
  ['recent', 'Recent'],
  ['speaker', 'Speaker'],
  ['occasion', 'Occasion'],
  ['said', 'When said'],
]

// QuotesPage renders on the same scaffold as the Library and the Catalogue,
// because it is the same kind of screen and the three had drifted into looking
// like three different apps.
//
// It was built as a flat list on the reasoning that a standalone quote has no
// parent, so there is nothing to group by. That was wrong in the same way §24's
// review-deck prediction was wrong: what a book gives you is a TITLE, and this
// kind has four things of that sort — who said it, through what medium, where,
// and when. None is a parent row, and all four are piles worth making.
//
// Filtering is client-side, like both neighbours. It used to be server-side
// (?color= ?favorite= ?tag= ?speaker=), and that had a bug the other two cannot
// have: the speaker dropdown was built from the rows on screen, which the server
// had already filtered by speaker — so choosing one collapsed the list of
// speakers to that one, and there was no way to switch to another without
// clearing first. The endpoint still accepts those parameters; this screen just
// asks for everything and narrows it here, so the filter options describe the
// whole collection rather than the current view of it.
export default function QuotesPage({ creditSeparators }) {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [shareFor, setShareFor] = useState(null)
  const [expanded, setExpanded] = useState(null)
  const [exporting, setExporting] = useState(false)
  const [tags, setTags] = useState([])
  const [color, setColor] = usePersistedState('tippani:quotes:color', '')
  const [favOnly, setFavOnly] = usePersistedState('tippani:quotes:fav', false)
  const [tagged, setTagged] = usePersistedState('tippani:quotes:tagged', false)
  const [noted, setNoted] = usePersistedState('tippani:quotes:noted', false)
  const [tag, setTag] = usePersistedState('tippani:quotes:tag', '')
  const [speaker, setSpeaker] = usePersistedState('tippani:quotes:speaker', '')
  const [medium, setMedium] = usePersistedState('tippani:quotes:medium', '')
  const [sort, setSort] = usePersistedState('tippani:quotes:sort', 'recent')
  const [groupBy, setGroupBy] = usePersistedState('tippani:quotes:group', 'none')
  const { stickers, reload: reloadStickers } = useStickers()
  // Speaker portraits for the card's credit line, the group headings AND the
  // share image — the same enrichment authors and actors get, now that
  // `speaker` is a people kind. reload matters: saving a portrait in the panel
  // has to repaint the chip behind it, the way Library reloads its authors.
  const { map: speakerMap, reload: reloadSpeakers } = usePeople('speaker')
  const [person, setPerson] = useState(null) // { kind, name } open in the metadata panel
  const seps = useMemo(() => parseCreditSeps(creditSeparators), [creditSeparators])
  const mobile = useIsMobileScreen()
  const columns = useColumnsAt(QUOTE_COLUMNS)

  const load = useCallback(async () => {
    const r = await json('GET', '/quotes')
    // The response key is `utterances` — the table, not the route. 0026 records
    // why the two differ.
    if (r.ok) {
      setRows(r.data.utterances || [])
      setError('')
    } else {
      setError(errText(r))
    }
  }, [])

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

  // Filter options come from what is actually saved rather than from the People
  // console or a fixed vocabulary: an unenriched speaker is still a speaker, and
  // `medium` is a free-text field, so the only honest list is the one in use.
  // Built from every row, never from the filtered view — see the note above.
  const speakers = useMemo(() => {
    const seen = new Set()
    for (const u of rows || []) for (const n of splitCredits(u.speaker || '', seps)) seen.add(n)
    return [...seen].sort((a, b) => a.localeCompare(b))
  }, [rows, seps])
  const mediums = useMemo(() => {
    const seen = new Set()
    for (const u of rows || []) if (u.medium) seen.add(u.medium)
    return [...seen].sort((a, b) => a.localeCompare(b))
  }, [rows])

  const shown = useMemo(() => {
    let list = rows || []
    if (color) list = list.filter((u) => u.color === color)
    if (favOnly) list = list.filter((u) => u.favorite)
    if (tagged) list = list.filter((u) => (u.tags || []).length > 0)
    if (noted) list = list.filter((u) => !!(u.note || '').trim())
    if (tag) list = list.filter((u) => (u.tags || []).includes(tag))
    // Matched against the SPLIT credit, so picking one of two co-speakers finds
    // the lines they said together — the same rule the card and the share image
    // use to decide who is credited.
    if (speaker) list = list.filter((u) => splitCredits(u.speaker || '', seps).includes(speaker))
    if (medium) list = list.filter((u) => u.medium === medium)
    if (sort === 'recent') return list
    list = [...list]
    if (sort === 'speaker') list.sort((a, b) => (a.speaker || '').localeCompare(b.speaker || ''))
    else if (sort === 'occasion') list.sort((a, b) => (a.occasion || '').localeCompare(b.occasion || ''))
    // Partial dates sort correctly as strings BECAUSE they are zero-padded and
    // big-endian: '1944' < '1944-08' < '1945'. Undated sinks rather than leading.
    else if (sort === 'said') list.sort((a, b) => (a.occasion_date || '\uffff').localeCompare(b.occasion_date || '\uffff'))
    return list
  }, [rows, color, favOnly, tagged, noted, tag, speaker, medium, sort, seps])

  const grouped = useMemo(
    () => (groupBy === 'none' ? null : groupUtterances(shown, groupBy, seps)),
    [shown, groupBy, seps],
  )

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
      seps,
    })

  const card = (u, i) => (
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
  )

  // The colour swatch doubles as its own off switch: there is no "no colour" to
  // pick, so tapping the chosen one clears it.
  const colourFilter = (
    <ColorSwatches value={color} onChange={(c) => setColor(c === color ? '' : c)} ariaLabel="Filter by category" />
  )
  const selects = [
    tags.length > 0 && ['tag', 'Filter by tag', tag, setTag, [['', 'all tags'], ...tags.map((t) => [t.name, t.name])]],
    speakers.length > 0 && ['speaker', 'Filter by speaker', speaker, setSpeaker, [['', 'all speakers'], ...speakers.map((n) => [n, n])]],
    mediums.length > 0 && ['medium', 'Filter by medium', medium, setMedium, [['', 'all media'], ...mediums.map((m) => [m, m])]],
  ].filter(Boolean)

  const groupSelect = (
    <Select ariaLabel="Group by" value={groupBy} onChange={setGroupBy} options={GROUP_OPTIONS} />
  )

  return (
    <WorkListScaffold
      mobile={mobile}
      title="Quotes"
      counts={rows ? `${rows.length} quote${rows.length === 1 ? '' : 's'} · from no book and no film` : ''}
      error={error}
      onExport={() => setExporting(true)}
      loaded={rows != null}
      hasItems={!!(rows && rows.length > 0)}
      shownCount={shown.length}
      emptyText="nothing here yet — the ＋ in the top bar saves a line from anywhere"
      noMatchText="no quotes match these filters"
      noun="quote"
      fav={favOnly}
      setFav={setFavOnly}
      tagged={tagged}
      setTagged={setTagged}
      noted={noted}
      setNoted={setNoted}
      sort={sort}
      setSort={setSort}
      sortOptions={SORT_OPTIONS}
      leading={colourFilter}
      leadingMobile={
        <div>
          <MonoLabel className="mb-2 block">colour</MonoLabel>
          {colourFilter}
        </div>
      }
      trailing={
        <>
          {selects.map(([key, label, value, onChange, options]) => (
            <Select key={key} ariaLabel={label} value={value} onChange={onChange} options={options} />
          ))}
          <label className="flex items-center gap-2">
            <MonoLabel>group</MonoLabel>
            {groupSelect}
          </label>
        </>
      }
      trailingMobile={
        <>
          {selects.map(([key, label, value, onChange, options]) => (
            <div key={key}>
              <MonoLabel className="mb-2 block">{key}</MonoLabel>
              <Select ariaLabel={label} value={value} onChange={onChange} options={options} />
            </div>
          ))}
          <div>
            <MonoLabel className="mb-2 block">group</MonoLabel>
            {groupSelect}
          </div>
        </>
      }
      onReset={() => {
        setColor('')
        setFavOnly(false)
        setTagged(false)
        setNoted(false)
        setTag('')
        setSpeaker('')
        setMedium('')
        setSort('recent')
        setGroupBy('none')
      }}
      exportDialog={
        <ConfirmDialog
          open={exporting}
          title="Export quotes"
          body={<>{shown.length} quote{shown.length === 1 ? '' : 's'} in view will be exported as a single Markdown file (re-importable into Tippani).</>}
          confirmLabel="Export"
          onCancel={() => setExporting(false)}
          onConfirm={async () => {
            setExporting(false)
            await downloadPost('/export/quotes', { ids: shown.map((u) => u.id) }, 'tippani-quotes.md')
          }}
        />
      }
      extraModals={
        <>
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
        </>
      }
    >
      {!rows ? (
        <Placeholder />
      ) : grouped ? (
        <div className="space-y-10">
          {grouped.map((g) => {
            // A speaker heading gets their portrait and opens their panel — the
            // same chip an author heading gets in the Library.
            const isSpeaker = groupBy === 'speaker' && !g.residual
            return (
              <section key={g.key}>
                <GroupHeading
                  label={g.label}
                  count={g.items.length}
                  noun="quote"
                  person={isSpeaker ? speakerMap[g.label] : null}
                  onOpenPerson={isSpeaker ? () => setPerson({ kind: 'speaker', name: g.label }) : undefined}
                />
                <Masonry columns={columns}>{g.items.map(card)}</Masonry>
              </section>
            )
          })}
        </div>
      ) : (
        <Masonry columns={columns}>{shown.map(card)}</Masonry>
      )}
    </WorkListScaffold>
  )
}
