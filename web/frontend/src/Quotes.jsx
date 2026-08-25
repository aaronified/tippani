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
import { LanguageMark } from './languages.jsx'
import { json, errText, downloadPost } from './api.js'
import { t } from './i18n.js'
import { QUOTE_KINDS, quoteKindLabel, quoteKindMeta, quoteKindOptions } from './quoteKind.js'
import { AnnotationCard, fmtDate } from './Library.jsx'
import { CreditFaces, DEFAULT_CREDIT_SEPS, PersonModal, PersonName, parseCreditSeps, splitCredits, usePeople } from './people.jsx'
import { ShareDialog, copyQuote, quoteShare } from './share.jsx'
import { deleteWithUndo } from './undo.jsx'
import { useSelection } from './selection.jsx'
import { SelectionBar } from './SelectionBar.jsx'
import { StickerPicker, useStickers } from './stickers.jsx'
import { ALL_BOARD, BoardList, MoveToBoardDialog, useBoards } from './boards.jsx'
import { GroupHeading, WorkListScaffold, groupWorks, patchMovesTheRow } from './works.jsx'
import {
  ColorSwatches,
  ConfirmDialog,
  ErrorText,
  Field,
  GhostButton,
  IconBack,
  Masonry,
  MonoLabel,
  PartialDateField,
  Placeholder,
  Select,
  Toggle,
  TokenInput,
  formatPartialDate,
  isPartialDate,
  QUOTE_COLUMNS,
  useColumnsAt,
  useFormHost,
  useIsMobileScreen,
  usePersistedState,
  toast,
} from './ui.jsx'

const PRIMARY = 'tp-btn tp-btn-primary' // aesthetic-aware primary (§6)

// utteranceState is the full-state PUT body for one quote — the mirror of
// annotationState and dialogueState. Every PUT in this app is full-state, so a
// field missing here is a field silently cleared the next time anyone
// favourites or drags a sticker.
//
// `??` rather than `||` on the sticker fields: 0 is a legal coordinate and the
// top-left corner would otherwise reset to unplaced.
// StarterProverbs — the offer on an empty Proverbs board.
//
// Nothing arrives unasked: the server has no boot hook and no backfill for these,
// deliberately, because a proverb is CONTENT and seeding content nobody chose is the
// app writing in their collection. So this is the only way in, it names the language
// before you commit, and it appears only on a board that is actually empty.
//
// The counts come from the server rather than being hardcoded here, so the number on
// the button and the set that lands cannot drift apart.
function StarterProverbs({ onDone, boardID }) {
  const [offers, setOffers] = useState(null)
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')

  useEffect(() => {
    json('GET', '/quotes/starters').then((r) => setOffers(r.ok ? r.data.languages || [] : []))
  }, [])

  async function take(language) {
    setBusy(language)
    setMsg('')
    const r = await json('POST', '/quotes/starters', { language, board_id: boardID ?? null })
    setBusy('')
    if (!r.ok) return setMsg(errText(r, t('error.add.starters')))
    // `skipped` is the honest half: asking twice reports nothing added rather than
    // implying it wrote a second copy.
    setMsg(
      r.data.added > 0
        ? t('quotes.starter.added.label', { n: r.data.added, count: r.data.added })
        : t('quotes.starter.already.label'),
    )
    await onDone()
  }

  if (!offers || offers.length === 0) return null
  return (
    <div className="starter-proverbs">
      <MonoLabel className="block">{t('quotes.starter.title')}</MonoLabel>
      <p className="microcopy" style={{ margin: '4px 0 10px' }}>
        {t('quotes.starter.body')}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {offers.map((o) => (
          <GhostButton
            key={o.language}
            type="button"
            disabled={!!busy}
            onClick={() => take(o.language)}
          >
            {busy === o.language
              ? t('quotes.starter.take.busy')
              : t('quotes.starter.take.label', { n: o.count, count: o.count, name: o.language })}
          </GhostButton>
        ))}
        {msg && <MonoLabel style={{ color: 'var(--soft)' }}>{msg}</MonoLabel>}
      </div>
    </div>
  )
}

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
    // SUPERSEDED BY `kind` (0053) and still carried. The interface no longer offers
    // a box for it, the column keeps every value it holds, and this object is
    // full-state — so dropping it here would clear it on the next ♥, which is the
    // opposite of keeping it.
    medium: u.medium || '',
    // 0053, AND THE FOURTH TIME THIS TRAP HAS BEEN SPRUNG IN THIS ONE OBJECT. See
    // the note below: a field missing from here is a field CLEARED by every
    // full-state PUT, which includes recolouring a card.
    kind: u.kind || '',
    // 0035, AND THIS IS A SILENT-LOSS SITE. Every PUT here is full-state, so a field
    // missing from this object is a field CLEARED by the request. The ♥ on a card,
    // the colour dots and the selection bar all save through it — so omitting these
    // three would mean recolouring a Bengali proverb quietly threw away its
    // category, its language and its English. 0034 records the same trap catching
    // `translator` on bookState.
    category: u.category || 'other',
    language: u.language || '',
    translation: u.translation || '',
    // 0036, AND THE SAME SILENT-LOSS SITE AS THE THREE ABOVE. A PUT with no
    // board_id does not leave the quote where it is — it MOVES it to the default
    // board, because every PUT here is full-state. The ♥, the colour dots and the
    // selection bar all save through this object.
    board_id: u.board_id || null,
    // 0047's five, AND THE THIRD TIME THIS TRAP HAS BEEN SPRUNG in this one object.
    // A letter's recipient, a proverb's region, an essay's title and page and the
    // date's "around" flag all arrive from an import and were all cleared by the
    // next ♥, colour dot or bulk action on the card — because a field missing here
    // is a field this full-state PUT empties. The two comments above say exactly
    // this about the fields that were forgotten before them.
    region: u.region || '',
    recipient: u.recipient || '',
    work_title: u.work_title || '',
    locator: u.locator || '',
    occasion_circa: !!u.occasion_circa,
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
  // 0035. The language joins the strip because for a PROVERB it is often the only
  // locator there is — no speaker, no occasion, no date, no place — so without it a
  // Bengali proverb's meta line is empty and the card says nothing about itself.
  // 0053. The KIND's word where `medium`'s raw text used to be — and falling back
  // to that text when no kind is set, so a value the one-time pass could not read
  // stays on the card as work to do rather than vanishing in the release that
  // replaced the field.
  const rest = [u.occasion, formatPartialDate(u.occasion_date), u.place, quoteKindMeta(u), u.language].filter(Boolean)
  // The string forms feed the share image and the group headings, where a second
  // line has nowhere to go. They stay one line; only the rich form below grows.
  if (omitSpeaker) return rest.join(' · ')
  if (!onOpenPerson) return [u.speaker, ...rest].filter(Boolean).join(' · ')

  const names = u.speaker ? splitCredits(u.speaker, seps || DEFAULT_CREDIT_SEPS) : []
  if (names.length === 0 && rest.length === 0) return ''
  return (
    <>
      {/* THE MARK STANDS IN FOR THE FACE. A proverb is the one kind of quote with
          nobody to credit — no speaker, no occasion, no date — so this line used
          to begin with nothing at all while every other quote in the app begins
          with somebody's portrait. Its language takes that slot: the reader's own
          mark if they set one, else a letter from the script.

          Only when there is no face to show. A quote that HAS a speaker gets the
          speaker, because a person outranks a language for the one slot going —
          and the language is still named a few words along, in `rest`. */}
      {names.length === 0 && u.language && (
        <LanguageMark languages={[u.language]} size={20} ring="var(--card)" className="mr-1.5" />
      )}
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
      {/* THE TRANSLATION USED TO BE DRAWN HERE, as a block span smuggled inside the
          meta label — the cheapest way to get a second line without touching the
          card three screens share. 0051 moved it onto the card itself
          (ui.jsx's TranslationLine), because the other two kinds now have the field
          too and one line drawn in three places is three places to draw it
          differently. It also fixed the search modal, which asks this function for
          its STRING form and therefore never showed a translation at all. */}
    </>
  )
}

// UtteranceForm follows the house form contract: {initial, onSubmit, onCancel,
// submitLabel, tagSuggestions, stickers, reloadStickers}, onSubmit resolving to
// an error string or null.
export function UtteranceForm({ initial, onSubmit, onCancel, submitLabel, tagSuggestions = [], stickers = [], reloadStickers, boards = [], defaultBoard = null }) {
  const [quote, setQuote] = useState(initial?.quote || '')
  const [note, setNote] = useState(initial?.note || '')
  const [speaker, setSpeaker] = useState(initial?.speaker || '')
  const [occasion, setOccasion] = useState(initial?.occasion || '')
  const [occasionDate, setOccasionDate] = useState(initial?.occasion_date || '')
  const [place, setPlace] = useState(initial?.place || '')
  // 0053. What kind of thing this is, from a fixed list. `medium` is still on the
  // record and still sent (see the payload below); it just has no box any more.
  const [kind, setKind] = useState(initial?.kind || '')
  // 0035. Which board this belongs on, and — for a line not in the reader's own
  // language — what it says. Editable by hand because nothing else sets them: the
  // starter proverbs arrive categorised, and anything you type arrives as 'other'.
  const [category, setCategory] = useState(initial?.category || 'other')
  // Where it is FILED (0036). Defaults to the board being looked at, which is
  // what makes capture inside a board file into that board — the same thing
  // capture inside a book does.
  const [boardID, setBoardID] = useState(initial?.board_id ?? defaultBoard ?? null)
  const [language, setLanguage] = useState(initial?.language || '')
  // 0047's five, which this form has never offered — and which it therefore CLEARED
  // on every save, because a PUT here is full-state and an absent field is an empty
  // one. An imported letter's recipient survived exactly until somebody opened the
  // quote to fix a typo.
  //
  // They are drawn together, under a heading, rather than spread through the form:
  // each belongs to a KIND of quote — a proverb's region, a letter's recipient, an
  // essay's title and page — and the kind lives on the board (see the note on
  // utteranceReq), so this form cannot know which one applies. What it can do is
  // group them and let the reader fill the one that means something.
  const [region, setRegion] = useState(initial?.region || '')
  const [recipient, setRecipient] = useState(initial?.recipient || '')
  const [workTitle, setWorkTitle] = useState(initial?.work_title || '')
  const [locator, setLocator] = useState(initial?.locator || '')
  const [circa, setCirca] = useState(!!initial?.occasion_circa)
  const [translation, setTranslation] = useState(initial?.translation || '')
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
    ? t('error.validate.quote-required')
    : occasionDate && !isPartialDate(occasionDate)
      ? t('error.validate.date')
      : ''
  // Joins the dialog's header ✓ when there is one — see FormHostContext.
  const host = useFormHost(busy ? t('common.action.save.busy') : missing)

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
      // Carried, not offered: the box is gone and the value is not.
      medium: initial?.medium || '',
      kind,
      category,
      board_id: boardID,
      language: language.trim(),
      translation: translation.trim(),
      // 0047's five. Sent because this PUT is full-state: omitting one is not
      // "leave it alone", it is "empty it".
      region: region.trim(),
      recipient: recipient.trim(),
      work_title: workTitle.trim(),
      locator: locator.trim(),
      occasion_circa: circa,
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
    <form id={host?.formId} onSubmit={submit} className="ann-form space-y-3">
      <label className="block">
        <MonoLabel className="mb-1.5 block">{t('common.field.quote.label')}</MonoLabel>
        <textarea className="tp-input" rows="3" value={quote} onChange={(e) => setQuote(e.target.value)} />
      </label>
      <label className="block">
        <MonoLabel className="mb-1.5 block">{t('common.field.note.label')}</MonoLabel>
        <textarea className="tp-input" rows="2" value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <div className="cl-grid">
        <Field
          label={t('common.field.speaker.label')}
          nameCase
          placeholder={t('common.field.speaker.placeholder')}
          value={speaker}
          onChange={(e) => setSpeaker(e.target.value)}
        />
        <Field
          label={t('common.field.occasion.label')}
          placeholder={t('common.field.occasion.placeholder')}
          value={occasion}
          onChange={(e) => setOccasion(e.target.value)}
        />
      </div>
      <div className="cl-grid">
        {/* A year alone is a complete answer, so this is a partial date rather
            than a date picker — see the field's own note. */}
        <PartialDateField label={t('quotes.form.when.label')} value={occasionDate} onChange={setOccasionDate} />
        <Field
          label={t('common.field.place.label')}
          placeholder={t('common.field.place.placeholder')}
          value={place}
          onChange={(e) => setPlace(e.target.value)}
        />
      </div>
      <label className="block">
        <MonoLabel className="mb-1 block">{t('quotes.form.kind.label')}</MonoLabel>
        {/* 0053, AND IT IS WHAT THE FREE-TEXT "MEDIUM" BOX WAS REACHING FOR. Five
            words, chosen, rather than anything typed — because the board below
            GROUPS by this, and grouping on a hand-typed field gives one shelf per
            spelling. "(not set)" is a real answer and the default: 'other' is a
            decision, and a default pretending to be one is a lie the card then
            reports as a fact. */}
        <Select
          ariaLabel={t('quotes.form.kind.label')}
          value={kind}
          onChange={setKind}
          options={quoteKindOptions()}
        />
      </label>
      <label className="block">
        <MonoLabel className="mb-1 block">{t('common.field.board.label')}</MonoLabel>
        {/* THE BOARD, WHICH IS WHERE IT IS FILED and not what it is — and until
            0053 this control was labelled "Kind", with a comment saying it was not
            one. Now that there is a real kind beside it, it takes its own name. It
            is the one field that has to be on this form, because a PUT without it
            moves the quote. */}
        {boards.length > 0 && (
          <Select
            ariaLabel={t('common.field.board.label')}
            value={boardID == null ? '' : String(boardID)}
            onChange={(v) => setBoardID(v === '' ? null : Number(v))}
            options={boards.map((b) => [String(b.id), b.name])}
          />
        )}
      </label>
      <Field
        label={t('common.field.language.label')}
        placeholder={t('common.field.language.placeholder')}
        value={language}
        onChange={(e) => setLanguage(e.target.value)}
      />
      {/* WHAT THE KIND CARRIES (0047). Region pairs with the language above it — a
          Bengali proverb from Sylhet is not one from Kolkata. Recipient is what makes
          a letter a letter. Source title and page are an essay's two, named
          generically because a poem and an article would want the same pair.

          All four together, under one heading, because the kind lives on the BOARD
          and not on the quote: this form is used from a board, from Home's inline
          edit and from the search modal, and only the first of those knows which
          kind is being edited. A heading and four optional boxes is honest about
          that; four boxes appearing and disappearing under a Select would not be. */}
      <div>
        <MonoLabel className="mb-1.5 block">{t('quotes.form.carries.label')}</MonoLabel>
        <div className="cl-grid">
          <Field
            label={t('common.field.region.label')}
            placeholder={t('quotes.form.region.placeholder')}
            value={region}
            onChange={(e) => setRegion(e.target.value)}
          />
          <Field
            label={t('common.field.recipient.label')}
            nameCase
            placeholder={t('quotes.form.recipient.placeholder')}
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
          />
        </div>
        <div className="cl-grid mt-3">
          <Field
            // A source title is a title: "the wheel of time" and not a person.
            nameCase
            label={t('common.field.work-title.label')}
            placeholder={t('quotes.form.work-title.placeholder')}
            value={workTitle}
            onChange={(e) => setWorkTitle(e.target.value)}
          />
          <Field
            label={t('common.field.locator.label')}
            placeholder={t('quotes.form.locator.placeholder')}
            value={locator}
            onChange={(e) => setLocator(e.target.value)}
          />
        </div>
        {/* THE DATE'S OWN PRECISION, and it sits here rather than beside the date
            because it is the only one of the five that qualifies another field —
            "around 1890". A plain checkbox with no cross-field rule: ticking it
            before typing the year is not a mistake worth refusing (see
            utteranceReq.OccasionCirca). */}
        <label className="mt-3 flex items-center gap-2">
          <input type="checkbox" checked={circa} onChange={(e) => setCirca(e.target.checked)} />
          <span className="microcopy">{t('quotes.form.circa.label')}</span>
        </label>
      </div>
      {/* A TEXTAREA SINCE 0051, where it was a one-line box before. It holds the
          same prose the quote above it does — uncapped at the server — and the two
          other kinds' forms now offer the same control for the same field. */}
      <label className="block">
        <MonoLabel className="mb-1.5 block">{t('common.field.translation.label')}</MonoLabel>
        <textarea className="tp-input" rows="2" placeholder={t('common.field.translation.placeholder')}
                  value={translation} onChange={(e) => setTranslation(e.target.value)} />
      </label>
      <label className="block">
        <MonoLabel className="mb-1.5 block">{t('common.field.tags.label')}</MonoLabel>
        <TokenInput
          value={tags}
          onChange={setTags}
          suggestions={tagSuggestions}
          placeholder={t('common.field.tags.placeholder')}
          ariaLabel={t('common.field.tags.label')}
        />
      </label>
      <div className="block">
        <MonoLabel className="mb-1.5 block">{t('common.field.sticker.label')}</MonoLabel>
        <StickerPicker value={stickerId} onChange={setStickerId} stickers={stickers} reload={reloadStickers} />
      </div>
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <MonoLabel>{t('common.mono.colour.label')}</MonoLabel>
        <ColorSwatches value={color} onChange={setColor} />
        {/* Hosted in a dialog, yes and no live together in its header. Inline
            there is no header, so the footer stays. See FormHostContext. */}
        {!host && (
          <div className="ml-auto flex gap-2">
            {onCancel && (
              <GhostButton type="button" onClick={onCancel}>
                {t('common.action.cancel.label')}
              </GhostButton>
            )}
            <button className={PRIMARY} disabled={busy || !!missing} title={missing || undefined}>
              {submitLabel}
            </button>
          </div>
        )}
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
const groupOptions = () => [
  ['none', t('quotes.group.none.label')],
  ['speaker', t('quotes.group.speaker.label')],
  ['kind', t('quotes.group.kind.label')],
  ['place', t('quotes.group.place.label')],
  ['decade', t('quotes.group.decade.label')],
]
// The catch-all heading per dimension, as KEYS — resolved at grouping time.
const GROUP_RESIDUAL = {
  kind: 'quotes.group.residual.kind.label',
  place: 'quotes.group.residual.place.label',
  language: 'quotes.group.residual.language.label',
}

// The per-language sections on a proverb board (0037) — what the request called
// subfolders, and it is a GROUPING rather than a folder for a reason worth
// stating: a folder is a place a quote lives, and a proverb already lives on the
// board. Grouping is the same shelf read in language order, so it can be turned
// on and off without moving anything, and every other view of the board still
// shows all of it.
//
// Offered on a proverb board ONLY. Language is the field that carries a proverb;
// on a board of speeches it is empty on every row, which would be a section
// called "No language" holding the entire board.
export function groupOptionsFor(board) {
  if (board?.kind !== 'proverb') return groupOptions()
  return [...groupOptions(), ['language', t('quotes.group.language.label')]]
}

// THE THREE-CATEGORY CONTROL IS GONE, and its two tables went with it (2.2.0).
//
// `CATEGORY_OPTIONS` and `CATEGORY_NOUN` described the three boards from 0035 —
// Proverbs, Speeches, Others — as a control this page drew. 0037 replaced that
// with the BOARD's own `kind`, which is why `utterance.category` still exists on
// the row and nothing reads these two tables: zero importers of the exported one,
// zero readers of the private one.
//
// They are DELETED rather than translated, and that is the point worth recording.
// Both held hardcoded English — the only untranslated copy left on this screen —
// so the obvious fix was a locale token each. Tokens for a control nobody renders
// are orphan keys, which locale-complete.test.js fails the build over, and it was
// written after 37 of them had to be deleted. Dead English is deleted; live
// English gets a token. The live one in this release is the share image's proverb
// legend (`share.field.proverb.legend`).

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
    creditResidual: t('quotes.group.residual.speaker.label'),
    year: utteranceYear,
    // place is a literal column name, so the accessor is the dim. `kind` is a
    // column too but its VALUE is a machine word, so it groups by the label — a
    // shelf heading reading "speech" in a Bengali interface would be the one
    // untranslated string on the screen.
    facet: (u, d) => (d === 'kind' ? quoteKindLabel(u.kind) : u[d]),
    facetResidual: (d) => t(GROUP_RESIDUAL[d] || 'quotes.group.residual.none.label'),
    seps,
  })
}

const sortOptions = () => [
  ['recent', t('quotes.sort.recent.label')],
  ['speaker', t('quotes.sort.speaker.label')],
  ['occasion', t('quotes.sort.occasion.label')],
  ['said', t('quotes.sort.said.label')],
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
export default function QuotesPage({ creditSeparators, openId = null, onOpen, onClose }) {
  const { boards, total, reload: reloadBoards } = useBoards()
  // TWO LEVELS, like the Library. No board open means the shelf list; a board
  // open means that board's quotes. The board is NOT a filter — see boards.jsx
  // for what treating it as one cost.
  if (openId == null) {
    return <BoardList boards={boards} total={total} reload={reloadBoards} onOpen={onOpen} />
  }
  return (
    <BoardQuotes
      key={String(openId)}
      boardId={openId}
      boards={boards}
      reloadBoards={reloadBoards}
      creditSeparators={creditSeparators}
      onClose={onClose}
    />
  )
}

function BoardQuotes({ boardId, boards, reloadBoards, creditSeparators, onClose }) {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [shareFor, setShareFor] = useState(null)
  // The quote whose board is being changed from its own ⋯ menu. The selection bar
  // asks the same question of a whole selection with the same dialog.
  const [movingQuote, setMovingQuote] = useState(null)
  const [expanded, setExpanded] = useState(null)
  const [exporting, setExporting] = useState(false)
  const [tags, setTags] = useState([])
  const [color, setColor] = usePersistedState('tippani:quotes:color', '')
  const [favOnly, setFavOnly] = usePersistedState('tippani:quotes:fav', false)
  const [tagged, setTagged] = usePersistedState('tippani:quotes:tagged', false)
  const [noted, setNoted] = usePersistedState('tippani:quotes:noted', false)
  const [tag, setTag] = usePersistedState('tippani:quotes:tag', '')
  const [speaker, setSpeaker] = usePersistedState('tippani:quotes:speaker', '')
  // 0053. A NEW KEY rather than the old `…:medium`, and that discards whatever
  // free text was last filtered on — which is the right outcome: the old value is
  // not a legal kind, so keeping it would restore a filter that matches nothing.
  const [kind, setKind] = usePersistedState('tippani:quotes:kind', '')
  // THE BOARD, not a filter — one of the three, always exactly one.
  //
  // It defaults to 'other', which is what every quote already in a library IS: 0035
  // set that column default rather than guessing a category from `medium`, so this
  // default shows an existing library precisely what it showed before the split.
  // Persisted, so the board you work in is the one you come back to.
  // No persisted category any more: which board you are on is the URL, so a
  // reload lands where the address says rather than where a filter last was.
  const isAll = boardId === ALL_BOARD
  const openBoard = (boards || []).find((b) => String(b.id) === String(boardId)) || null
  const [language, setLanguage] = usePersistedState('tippani:quotes:language', '')
  const [sort, setSort] = usePersistedState('tippani:quotes:sort', 'recent')
  // 0053. A READER WHO WAS GROUPING BY MEDIUM WENT ON GROUPING BY IT. The filter
  // was given a new key when the field changed (see `kind` above) and this one was
  // not — so the stored 'medium' still resolved against a column that still
  // exists, the board went on making a shelf per spelling, and the control beside
  // it showed its placeholder because 'medium' is no longer one of its options.
  //
  // Read through a rename rather than re-keyed, because unlike the filter the
  // stored value has an exact successor: somebody who chose to group by what a
  // quote IS still wants that.
  const [rawGroupBy, setGroupBy] = usePersistedState('tippani:quotes:group', 'none')
  const groupBy = rawGroupBy === 'medium' ? 'kind' : rawGroupBy
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

  const tagMap = useMemo(() => Object.fromEntries(tags.map((row) => [row.name, row])), [tags])
  const stickerMap = useMemo(() => Object.fromEntries(stickers.map((s) => [s.id, s])), [stickers])

  // THE BOARD PARTITIONS FIRST, and every list derived from it follows — the
  // speaker and medium options, the language options, the counts, the empty state.
  // Deriving them from `rows` instead would offer a filter for a speaker who is not
  // on this board and then show nothing when you picked them.
  //
  // AND IT HAS TO BE DECLARED FIRST, physically, above its readers. A dependency
  // array is not a closure: `useMemo(fn, [board])` builds that array the moment the
  // line runs, so a `const board` further down the body is read inside its own
  // temporal dead zone and the whole screen throws ReferenceError on its first
  // render. 1.13.0 shipped exactly that — this memo was added below the three that
  // consume it, which reads fine and is fatal. The body is ordered by data flow for
  // that reason, not for tidiness.
  const board = useMemo(
    () => (isAll ? rows || [] : (rows || []).filter((u) => String(u.board_id) === String(boardId))),
    [rows, isAll, boardId],
  )

  // Filter options come from what is actually saved rather than from the People
  // console or a fixed vocabulary: an unenriched speaker is still a speaker, and
  // `medium` is a free-text field, so the only honest list is the one in use.
  // Built from every row on the board, never from the filtered view.
  const speakers = useMemo(() => {
    const seen = new Set()
    for (const u of board) for (const n of splitCredits(u.speaker || '', seps)) seen.add(n)
    return [...seen].sort((a, b) => a.localeCompare(b))
  }, [board, seps])
  // 0053. From the FIXED list, narrowed to what this board actually holds — not
  // from the values in use, which is what `medium` needed because it was free text.
  // In the list's own order rather than alphabetically: it is a vocabulary, and its
  // order is a decision (see quoteKind.js).
  const kinds = useMemo(() => {
    const seen = new Set(board.map((u) => u.kind).filter(Boolean))
    return QUOTE_KINDS.filter((k) => seen.has(k))
  }, [board])
  // Free text in 0035, so the only honest list is the one in use — the same rule
  // `mediums` follows. Offered only when the board actually holds more than one.
  const languages = useMemo(() => {
    const seen = new Set()
    for (const u of board) if (u.language) seen.add(u.language)
    return [...seen].sort((a, b) => a.localeCompare(b))
  }, [board])

  const shown = useMemo(() => {
    let list = board
    if (color) list = list.filter((u) => u.color === color)
    if (favOnly) list = list.filter((u) => u.favorite)
    if (tagged) list = list.filter((u) => (u.tags || []).length > 0)
    if (noted) list = list.filter((u) => !!(u.note || '').trim())
    if (tag) list = list.filter((u) => (u.tags || []).includes(tag))
    // Matched against the SPLIT credit, so picking one of two co-speakers finds
    // the lines they said together — the same rule the card and the share image
    // use to decide who is credited.
    if (speaker) list = list.filter((u) => splitCredits(u.speaker || '', seps).includes(speaker))
    if (kind) list = list.filter((u) => u.kind === kind)
    if (language) list = list.filter((u) => u.language === language)
    if (sort === 'recent') return list
    list = [...list]
    if (sort === 'speaker') list.sort((a, b) => (a.speaker || '').localeCompare(b.speaker || ''))
    else if (sort === 'occasion') list.sort((a, b) => (a.occasion || '').localeCompare(b.occasion || ''))
    // Partial dates sort correctly as strings BECAUSE they are zero-padded and
    // big-endian: '1944' < '1944-08' < '1945'. Undated sinks rather than leading.
    else if (sort === 'said') list.sort((a, b) => (a.occasion_date || '\uffff').localeCompare(b.occasion_date || '\uffff'))
    return list
  }, [board, color, favOnly, tagged, noted, tag, speaker, kind, language, sort, seps])

  // groupBy is persisted across boards, so a grouping only one KIND of board
  // offers has to be checked against the board you are actually on rather than
  // trusted. Group a proverb board by language, walk to a board of speeches, and
  // without this the Select shows a value it does not list while the page draws
  // one section called "No language" holding everything — a persisted choice
  // following the reader somewhere it does not apply, which is the exact trap
  // 1.14.0 exists to undo. Falls back to ungrouped for the render and leaves the
  // stored value alone, so walking back finds the sections still on.
  const groupable = groupOptionsFor(openBoard).some(([v]) => v === groupBy) ? groupBy : 'none'

  const grouped = useMemo(
    () => (groupable === 'none' ? null : groupUtterances(shown, groupable, seps)),
    [shown, groupable, seps],
  )

  async function save(id, fields) {
    const r = await json('PUT', `/quotes/${id}`, fields)
    if (!r.ok) return errText(r, t('error.save.generic'))
    setEditingId(null)
    await load()
    return null
  }
  // Resolves false on failure so AnnotationCard's optimistic colour pick can
  // roll its preview back — the same contract Library's patch keeps.
  // Takes the reply rather than asking again — see the note on Library's `patch`,
  // which is the same control on the other board and had the same cost. The
  // filters here are client-side EXCEPT the board, which a patch cannot change
  // (moving a quote between boards goes through the selection bar), so the only
  // field that can move a row out of view is the one the colour filter reads.
  async function patch(u, fields) {
    const r = await json('PUT', `/quotes/${u.id}`, { ...utteranceState(u), ...fields })
    if (!r.ok) {
      setError(errText(r, t('error.save.generic')))
      return false
    }
    setError('')
    // The shared rule, not a fourth copy of it: this board's other filters are
    // client-side, so the colour is the only one the server applies — which the
    // helper expresses by being told which filters are in force rather than
    // guessing.
    if (patchMovesTheRow(fields, { color })) await load()
    else setRows((cur) => (cur || []).map((x) => (x.id === u.id ? { ...x, ...r.data } : x)))
    return true
  }
  async function remove(u) {
    if (!confirm(t('quotes.delete.confirm'))) return
    const r = await deleteWithUndo(`/quotes/${u.id}`, { reload: load })
    if (r.ok) load()
    else setError(errText(r))
  }

  const sharePayload = (u) =>
    quoteShare({
      quote: u.quote,
      translation: u.translation,
      note: u.note,
      category: u.category,
      language: u.language,
      speaker: u.speaker,
      occasion: u.occasion,
      when: formatPartialDate(u.occasion_date),
      place: u.place,
      // The kind's WORD, not its machine value, and falling back to the old
      // free-text medium the same way the card's meta line does — a share is a
      // picture somebody else reads.
      medium: quoteKindMeta(u),
      date: fmtDate(u.noted_at || u.created_at),
      tags: u.tags,
      color: u.color,
      people: speakerMap,
      seps,
    })

  // The selection is over `shown` — the visible, filtered, sorted list — so a
  // filter change drops the ids that left the screen rather than leaving the bar
  // reporting a number about rows nobody can see (see useSelection).
  const selection = useSelection(shown.map((u) => u.id))
  const afterBulk = () => {
    selection.clear()
    load()
  }

  // Memoised: an inline arrow here would be a NEW component type on every
  // render, so React would unmount and remount the form between keystrokes and
  // the field would lose focus mid-word.
  const QuoteForm = useMemo(
    () => (p) => <UtteranceForm {...p} boards={boards || []} defaultBoard={isAll ? null : Number(boardId)} />,
    [boards, isAll, boardId],
  )

  const card = (u, i) => (
    <AnnotationCard
      key={u.id}
      selection={selection}
      selectKind="quote"
      a={u}
      variant={i}
      meta={utteranceMeta(u, { people: speakerMap, seps, onOpenPerson: setPerson })}
      form={QuoteForm}
      tagMap={tagMap}
      stickerMap={stickerMap}
      stickers={stickers}
      reloadStickers={reloadStickers}
      editing={editingId === u.id}
      setEditingId={setEditingId}
      save={save}
      patch={patch}
      remove={remove}
      onMoveBoard={() => setMovingQuote(u)}
      onCopy={() => copyQuote(sharePayload(u))}
      onShare={() => setShareFor(u)}
      tagSuggestions={Object.keys(tagMap)}
      expanded={expanded === u.id}
      onToggleExpand={() => setExpanded(expanded === u.id ? null : u.id)}
    />
  )

  // The colour swatch doubles as its own off switch: there is no "no colour" to
  // pick, so tapping the chosen one clears it.
  const colourFilter = (
    <ColorSwatches value={color} onChange={(c) => setColor(c === color ? '' : c)} ariaLabel={t('quotes.filters.colour.aria')} />
  )
  // A Toggle rather than a Select: three boards is a segmented control, and the one
  // you are on should be readable without opening anything. Changing board clears
  // the filters that belong to the board you are leaving — a speaker who is only on
  // Speeches would otherwise follow you to Proverbs and show an empty shelf that
  // looks like a bug.

  const selects = [
    tags.length > 0 && ['tag', t('common.filters.tag.aria'), tag, setTag, [['', t('common.filters.tag.all.label')], ...tags.map((row) => [row.name, row.name])]],
    speakers.length > 0 && ['speaker', t('quotes.filters.speaker.aria'), speaker, setSpeaker, [['', t('quotes.filters.speaker.all.label')], ...speakers.map((n) => [n, n])]],
    kinds.length > 0 && ['kind', t('quotes.filters.kind.aria'), kind, setKind, [['', t('quotes.filters.kind.all.label')], ...kinds.map((k) => [k, quoteKindLabel(k)])]],
    languages.length > 1 && ['language', t('quotes.filters.language.aria'), language, setLanguage, [['', t('quotes.filters.language.all.label')], ...languages.map((l) => [l, l])]],
  ].filter(Boolean)

  const groupSelect = (
    <Select ariaLabel={t('common.filters.group.aria')} value={groupable} onChange={setGroupBy} options={groupOptionsFor(openBoard)} />
  )

  // Above the scaffold rather than inside it: the grid slot does not render when a
  // board is empty, and an empty Proverbs board is exactly when this has to show.
  // Offered on any empty board rather than on a board called Proverbs: nothing
  // in the code may know a board's name (0036), and an empty shelf is the only
  // signal available for "there is nothing here to start from".
  const starters = !isAll && rows != null && board.length === 0
    ? <StarterProverbs onDone={load} boardID={Number(boardId)} />
    : null

  return (
    <>
      {/* The way back to the shelves, on DESKTOP only — a work's detail page
          draws its own the same way, above the header with room to spare.
          On a phone this was an entire row spent on a single back arrow, with
          the title, the count and the filters in the row beneath it, while a
          book's page has always put all four together. The scaffold takes the
          arrow inside its sticky bar now (1.14.2), so this must not also draw
          one or there would be two ways back stacked on each other. */}
      {!mobile && (
        <div className="mb-3">
          <GhostButton icon={<IconBack />} onClick={onClose}>
            {t('quotes.board.back.label')}
          </GhostButton>
        </div>
      )}
      {starters}
      <WorkListScaffold
      mobile={mobile}
      onBack={onClose}
      title={isAll ? t('quotes.board.all.label') : openBoard?.name || t('nav.tab.quotes.label')}
      counts={rows
        ? t(openBoard?.description ? 'quotes.board.counts-described' : 'quotes.board.counts', {
            n: board.length,
            noun: t('unit.quote', { count: board.length }),
            description: openBoard?.description,
          })
        : ''}
      error={error}
      onExport={() => setExporting(true)}
      loaded={rows != null}
      hasItems={!!(rows && board.length > 0)}
      shownCount={shown.length}
      emptyText={t('quotes.board.empty')}
      noMatchText={t('quotes.board.nomatch')}
      noun={t('unit.quote.one')}
      nounPlural={t('unit.quote.other')}
      fav={favOnly}
      setFav={setFavOnly}
      tagged={tagged}
      setTagged={setTagged}
      noted={noted}
      setNoted={setNoted}
      sort={sort}
      setSort={setSort}
      sortOptions={sortOptions()}
      leading={colourFilter}
      leadingMobile={
        <div>
          <MonoLabel className="mb-2 block">{t('common.mono.colour.label')}</MonoLabel>
          {colourFilter}
        </div>
      }
      trailing={
        <>
          {selects.map(([key, label, value, onChange, options]) => (
            <Select key={key} ariaLabel={label} value={value} onChange={onChange} options={options} />
          ))}
          <label className="flex items-center gap-2">
            <MonoLabel>{t('common.mono.group.label')}</MonoLabel>
            {groupSelect}
          </label>
        </>
      }
      trailingMobile={
        <>
          {selects.map(([key, label, value, onChange, options]) => (
            <div key={key}>
              <MonoLabel className="mb-2 block">{t(`common.mono.${key}.label`)}</MonoLabel>
              <Select ariaLabel={label} value={value} onChange={onChange} options={options} />
            </div>
          ))}
          <div>
            <MonoLabel className="mb-2 block">{t('common.mono.group.label')}</MonoLabel>
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
          title={t('quotes.export.confirm.title')}
          body={t('quotes.export.confirm.body', { count: shown.length, n: shown.length })}
          confirmLabel={t('common.action.export.label')}
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
      {selection.open && (
        <SelectionBar selection={selection} rows={shown} onDone={afterBulk} tagSuggestions={Object.keys(tagMap)} onEdit={setEditingId} />
      )}
      {/* One quote, from its own ⋯. Posted through the BULK endpoint with a single
          id — the same call the bar makes with forty — so there is no second path
          to keep in step, which is the rule deletes already follow. */}
      {movingQuote && (
        <MoveToBoardDialog
          count={1}
          currentBoardID={movingQuote.board_id ?? null}
          onApply={async (target) => {
            const u = movingQuote
            setMovingQuote(null)
            const r = await json('POST', '/quotes/bulk', { ids: [u.id], board_id: target })
            if (!r.ok) return toast(errText(r, t('error.move.generic')))
            toast(t('quotes.toast.moved'))
            await load()
          }}
          onClose={() => setMovingQuote(null)}
        />
      )}
      {!rows ? (
        <Placeholder />
      ) : grouped ? (
        <div className="space-y-10">
          {grouped.map((g) => {
            // A speaker heading gets their portrait and opens their panel — the
            // same chip an author heading gets in the Library.
            const isSpeaker = groupable === 'speaker' && !g.residual
            return (
              <section key={g.key}>
                <GroupHeading
                  label={g.label}
                  count={g.items.length}
                  noun={t('unit.quote.one')}
                  nounPlural={t('unit.quote.other')}
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
    </>
  )
}
