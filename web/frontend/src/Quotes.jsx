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
import { LanguageCombo } from './suggest.jsx'
import { LanguageMark } from './languages.jsx'
import { json, errText, downloadPost } from './api.js'
import { t } from './i18n.js'
import { usePersonOpener } from './personOpen.jsx'
// THE ONE SOURCE FOR WHAT A KIND CARRIES, read here as well as by the add
// surface. See the note on `door` below for why this form drew everything.
import { QUOTE_KIND_DOORS, showsField } from './addFields.js'
import { QUOTE_KINDS, quoteKindLabel, quoteKindMeta, quoteKindOptions } from './quoteKind.js'
import { attributionParts } from './attribution.js'
import { AnnotationCard, fmtDate } from './Library.jsx'
import { TextOrderScope } from './textOrderHost.jsx'
import { CreditFaces, DEFAULT_CREDIT_SEPS, PersonModal, PersonName, parseCreditSeps, splitCredits, usePeople } from './people.jsx'
import { ShareDialog, copyQuote, quoteShare } from './share.jsx'
import { deleteWithUndo } from './undo.jsx'
import { useSelection } from './selection.jsx'
import { SelectionBar } from './SelectionBar.jsx'
import { StickerPicker, useStickers } from './stickers.jsx'
import { ALL_BOARD, BoardList, MoveToBoardDialog, useBoards } from './boards.jsx'
import { ANNOTATION_PAGE, GroupHeading, WorkListScaffold, groupWorks, patchMovesTheRow, useBoardWindow } from './works.jsx'
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
  parsePartialDate,
  partialDateValue,
  partialDateInputValue,
  QUOTE_COLUMNS,
  useConfirm,
  useColumnsAt,
  useFormHost,
  useIsMobileScreen,
  usePersistedState,
  toast,
  PanelHost,
  usePanelStack,
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
// THE SPEAKER IS NOT ON THIS LINE, and there is no option to put them back. The
// owner, on seeing the composed Einstein card: "the albert einstein is not needed
// on that row. as it would already have a chip of its own." They are right, and
// the code agreed with them before they said it — BOTH callers passed
// `omitSpeaker: true`, so the branch that printed the name, split the credit and
// drew the faces had no caller at all. It is deleted rather than left as a flag
// nobody sets: the card's bands are the person chip and THEN the attribution, and
// a line that could optionally repeat the chip is an option to break that.
//
// Returns '' when there is nothing to say, and that is load-bearing rather than
// tidy. AnnotationCard renders this as `{metaLine && <MonoLabel>}`, and a JSX
// element is ALWAYS truthy — so a proverb (no speaker, no occasion, nothing)
// would otherwise get an empty label and the spacing that comes with it.
export function utteranceMeta(u, { mark = false } = {}) {
  // A SENTENCE, NOT A CONCATENATION — and this line used to be the latter, which
  // is the whole of the report that changed it: "Quote cards need better
  // formatting (e.g. letter to carl seelig)." It joined whatever happened to be
  // non-empty, so nothing in it knew that "Letter" and "to Carl Seelig" are ONE
  // fact; the kind said its word again on its own, and four fields the form
  // collects appeared nowhere at all.
  //
  // `attributionParts` composes the kind's phrase and hands back only what the
  // phrase did not speak for. It is a pure module with its own table, because six
  // surfaces draw this line and a rule spread across six is six places for one to
  // disagree. The language leaves the strip with it: it is a PROVERB's whole
  // attribution now ("{language} proverb"), and on every other kind it was a
  // locator nobody reads.
  const { line: kindLine, rest: unspoken } = attributionParts(u, {
    date: formatPartialDate(u.occasion_date, u.occasion_circa),
  })
  const rest = [kindLine, ...unspoken].filter(Boolean)
  // The flat form feeds the search hit and the group headings, where a second line
  // has nowhere to go.
  if (!mark) return rest.join(' · ')

  // THE MARK STANDS IN FOR THE FACE, and it stands there even when the words
  // beside it name the language too.
  //
  // I TOOK IT OFF A FILED PROVERB AND THE OWNER PUT IT BACK: "the script mark
  // should be in the same row." My reason was the directive that a row says a
  // thing once — "Bengali proverb" with a Bengali disc in front of it looked like
  // the language twice. Theirs is better, and it is the one this file's own comment
  // already made: the disc is not a PRINTING of the language, it is the slot where
  // every other quote in the app carries a portrait. A proverb has nobody to
  // credit, so without it this line begins with nothing while every line beside it
  // begins with a face — the ragged edge the mark was introduced to remove. A glyph
  // holding a place and a word carrying a fact are not the same reading.
  const showMark = !!u.language
  if (!showMark && rest.length === 0) return ''
  return (
    <>
      {showMark && (
        <LanguageMark languages={[u.language]} size={20} ring="var(--card)" className="mr-1.5" />
      )}
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
  // partialDateInputValue, NOT the raw column: a BCE occasion is stored '-0399'
  // and a reader editing that would be shown the machine's spelling of their own
  // date. See the function's note.
  const [occasionDate, setOccasionDate] = useState(partialDateInputValue(initial?.occasion_date || ''))
  const [place, setPlace] = useState(initial?.place || '')
  // 0053. What kind of thing this is, from a fixed list. `medium` is still on the
  // record and still sent (see the payload below); it just has no box any more.
  const [kind, setKind] = useState(initial?.kind || '')
  // THE DOOR THIS ROW BELONGS TO, and the one source both surfaces read.
  //
  // THE OWNER: "while editing a proverb, i still see all the useless fields…
  // both edit and add should read field list from one source. standardise it."
  // `addFields.js` was imported by the add surface alone, so this form drew all
  // seventeen fields the table knows for every kind — a proverb has nine.
  //
  // `other` IS THE FALLBACK BECAUSE IT HARD-DROPS NOTHING. A row saved before
  // 0053 has no `kind`, and guessing one would hide a box that has a value in
  // it; `other` means "the reader could not say what this is", which is exactly
  // true of a row that never recorded one.
  //
  // AND THE REASON THIS FORM DREW EVERYTHING HAS EXPIRED. The note over the
  // five-field block below said the kind "lives on the BOARD and not on the
  // quote… only the first of those knows which kind is being edited" — true when
  // it was written, and 0053 made `kind` a column on the quote. The form has
  // known the kind ever since and went on asking as though it did not.
  const door = QUOTE_KIND_DOORS.includes(kind) ? kind : 'other'
  const shows = (key) => showsField(door, key)
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
  // 0070's, and the owner asked for it by name: "socrates' speeches are known from
  // plato's paraphrasing". The add surface has drawn it since the migration landed
  // and this form did not, so a full-state PUT cleared Plato off every speech the
  // moment anything else on it was edited.
  const [sourceAuthor, setSourceAuthor] = useState(initial?.source_author || '')
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
    : occasionDate && !isPartialDate(occasionDate, { historical: true })
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
      // NORMALISED HERE, not as it is typed. The box holds the phrase the reader
      // wrote ('399 BCE'); the column holds the canonical form ('-0399'), because
      // it is sorted and grouped as text. Rewriting the box mid-keystroke would
      // make the era unspellable — you cannot type B, C, E into a field that
      // reformats after each one.
      occasion_date: partialDateValue(parsePartialDate(occasionDate, { historical: true })),
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
      source_author: sourceAuthor.trim(),
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
      {/* THE PAIRS SURVIVE A HALF, which is why each box is gated rather than each
          row: a poem has `when` and no `place`, so the row that held both draws
          one. `cl-grid` lays out whatever it is given. */}
      {(shows('speaker') || shows('occasion')) && (
        <div className="cl-grid">
          {shows('speaker') && (
            <Field
              label={t('common.field.speaker.label')}
              nameCase
              placeholder={t('common.field.speaker.placeholder')}
              value={speaker}
              onChange={(e) => setSpeaker(e.target.value)}
            />
          )}
          {shows('occasion') && (
            <Field
              label={t('common.field.occasion.label')}
              placeholder={t('common.field.occasion.placeholder')}
              value={occasion}
              onChange={(e) => setOccasion(e.target.value)}
            />
          )}
        </div>
      )}
      {(shows('when') || shows('place')) && (
        <div className="cl-grid">
          {/* A year alone is a complete answer, so this is a partial date rather
              than a date picker — see the field's own note. */}
          {shows('when') && (
            <PartialDateField
              label={t('quotes.form.when.label')}
              value={occasionDate}
              onChange={setOccasionDate}
              historical
              circa={circa}
              onCirca={setCirca}
              circaLabel={t('quotes.form.circa.label')}
            />
          )}
          {shows('place') && (
            <Field
              label={t('common.field.place.label')}
              nameCase
              placeholder={t('common.field.place.placeholder')}
              value={place}
              onChange={(e) => setPlace(e.target.value)}
            />
          )}
        </div>
      )}
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
      {shows('language') && (
      <LanguageCombo
        label={t('common.field.language.label')}
        placeholder={t('common.field.language.placeholder')}
        value={language}
        onChange={setLanguage}
      />
      )}
      {/* WHAT THE KIND CARRIES (0047). Region pairs with the language above it — a
          Bengali proverb from Sylhet is not one from Kolkata. Recipient is what makes
          a letter a letter. Source title and page are an essay's two, named
          generically because a poem and an article would want the same pair.

          All four together, under one heading, because the kind lives on the BOARD
          and not on the quote: this form is used from a board, from Home's inline
          edit and from the search modal, and only the first of those knows which
          kind is being edited. A heading and four optional boxes is honest about
          that; four boxes appearing and disappearing under a Select would not be. */}
      {/* NO HEADING OVER THESE ANY MORE. It read "what the kind carries" over five
          boxes of which a given kind carries one or two — honest when the form
          could not know the kind, and a tautology now that it gates on it: a
          heading naming the fields under it says the same thing twice, which is
          the repo's own rule. The add surface dropped it for the same reason. */}
      <div>
        {(shows('region') || shows('recipient')) && (
        <div className="cl-grid">
          {shows('region') && (
          <Field
            label={t('common.field.region.label')}
            nameCase
            placeholder={t('quotes.form.region.placeholder')}
            value={region}
            onChange={(e) => setRegion(e.target.value)}
          />
          )}
          {shows('recipient') && (
          <Field
            label={t('common.field.recipient.label')}
            nameCase
            placeholder={t('quotes.form.recipient.placeholder')}
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
          />
          )}
        </div>
        )}
        {(shows('work_title') || shows('locator')) && (
        <div className="cl-grid mt-3">
          {shows('work_title') && (
          <Field
            // A source title is a title: "the wheel of time" and not a person.
            nameCase
            label={t('common.field.work-title.label')}
            placeholder={t('quotes.form.work-title.placeholder')}
            value={workTitle}
            onChange={(e) => setWorkTitle(e.target.value)}
          />
          )}
          {shows('locator') && (
          <Field
            label={t('common.field.locator.label')}
            placeholder={t('quotes.form.locator.placeholder')}
            value={locator}
            onChange={(e) => setLocator(e.target.value)}
          />
          )}
        </div>
        )}
        {/* THE PERSON THE WORDS REACH US THROUGH (0070), under the source they
            reach us in — which is where it belongs, because it is a fact about that
            source and not about the speaker. The owner's case for the field
            existing: "socrates' speeches are known from plato's paraphrasing".
            A fifth relation and not a reuse of one of the four already on this
            form: the speaker said it, the recipient was told it, an author writes a
            work, a character lives inside one. */}
        {shows('source_author') && (
        <div className="cl-grid mt-3">
          <Field
            label={t('common.field.source-author.label')}
            nameCase
            placeholder={t('add.form.source-author.placeholder')}
            value={sourceAuthor}
            onChange={(e) => setSourceAuthor(e.target.value)}
          />
        </div>
        )}
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
  const y = parsePartialDate(u.occasion_date || '', { historical: true })?.year || 0
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
// QuoteBoard — the wall of cards, bounded by what has been scrolled to.
//
// A Masonry mounts every child it is handed, and this screen handed it the whole
// filtered list: four hundred quotes was twenty-eight thousand DOM nodes and a
// thirty-six-thousand-pixel document before the reader had scrolled past three cards.
// That is the whole of this screen's stutter, and it is the one board that never got
// the window the Library and the catalogue were given — there is nothing different
// about quotes, they were simply missed.
//
// The same hook those two use, so there is one answer to "how does a board grow" and
// not three. Growing it is safe here because Masonry carries a placement across an
// append (see `carry` there): the cards already on screen keep their columns, and only
// the newly revealed tail is packed. Without that, every reveal would re-sort the board
// tallest-first and the card the reader was reading would jump to another column.
function QuoteBoard({ items, columns, card }) {
  const win = useBoardWindow(items.length, items, ANNOTATION_PAGE)
  return (
    <>
      <Masonry columns={columns}>{items.slice(0, win.count).map(card)}</Masonry>
      {/* aria-hidden and empty: a scroll position, not content. See the Library board. */}
      {win.more && <div ref={win.sentinel} aria-hidden="true" className="h-px" />}
    </>
  )
}

export default function QuotesPage({ creditSeparators, openId = null, onOpen, onClose }) {
  // `loadError` is destructured and passed on, which it was not: useBoards has
  // returned an error since it was written and the shelf list dropped it on the
  // floor, so a failed GET /boards left `boards` null for ever and the screen drew
  // a working-looking page with one tile on it.
  const { boards, total, error: loadError, reload: reloadBoards } = useBoards()
  // TWO LEVELS, like the Library. No board open means the shelf list; a board
  // open means that board's quotes. The board is NOT a filter — see boards.jsx
  // for what treating it as one cost.
  if (openId == null) {
    return <BoardList boards={boards} total={total} loadError={loadError} reload={reloadBoards} onOpen={onOpen} />
  }
  // THE BOARD'S OWN ANSWER TO "WHICH TEXT LEADS" (0073), stated once for every
  // card under it — the same line WorkDetail states for a book or a film, and the
  // owner's own ruling on why a BOARD is the container here: a standalone quote
  // has no work row, because `work_title` is a plain string on the quote and two
  // quotes can spell one work differently.
  //
  // READ OFF THE SHELF LIST rather than fetched again. `useBoards` already has
  // every board this account owns, so the open one is a find rather than a
  // request — and a second fetch would be a second answer that could disagree
  // with the tiles for as long as it was in flight.
  const open = (boards || []).find((b) => String(b.id) === String(openId))
  return (
    <TextOrderScope value={open?.text_order}>
      <BoardQuotes
        key={String(openId)}
        boardId={openId}
        boards={boards}
        reloadBoards={reloadBoards}
        creditSeparators={creditSeparators}
        onClose={onClose}
      />
    </TextOrderScope>
  )
}

function BoardQuotes({ boardId, boards, reloadBoards, creditSeparators, onClose }) {
  const { ask, confirmDialog } = useConfirm()
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
  // THE PERSON'S OWN SCREEN, REACHABLE FROM HERE AT LAST. A standalone quote's speaker
  // was handed `setPerson` straight, so it opened the older panel whatever the
  // person's record held — this screen had no panel host at all, which is why the
  // pack's person screen looked absent rather than unreachable. See
  // personOpen.jsx: the id decides which of the two surfaces answers.
  const personStack = usePanelStack()
  const openPerson = usePersonOpener(personStack, setPerson)
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
    // BY THE YEAR AS A NUMBER, not as text. '-0399' and '-0040' sort the wrong way
    // round as strings — 40 BCE reads as earlier than 399 BCE — because a minus
    // sign reverses the order it prefixes and a padded string cannot know that.
    // The month and day still compare as text, where the padding does the work.
    else if (sort === 'said') list.sort((a, b) => {
      const pa = parsePartialDate(a.occasion_date || '', { historical: true })
      const pb = parsePartialDate(b.occasion_date || '', { historical: true })
      if (!pa || !pb) return (pa ? 0 : 1) - (pb ? 0 : 1)
      if (pa.year !== pb.year) return pa.year - pb.year
      return (a.occasion_date || '').slice(-6).localeCompare((b.occasion_date || '').slice(-6))
    })
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
  // The GROUPS are windowed as well as the cards inside them, the same two-level
  // window the catalogue uses: grouping by speaker over a large board is otherwise
  // one heading and one Masonry per speaker, all mounted at once, which is the very
  // cost the card window just removed arriving one level up.
  const groupWin = useBoardWindow(grouped ? grouped.length : 0, grouped, 12)

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
    if (!(await ask(t('quotes.delete.confirm'), { danger: true, reversible: true }))) return
    const r = await deleteWithUndo(`/quotes/${u.id}`, { reload: load })
    if (r.ok) load()
    else setError(errText(r))
  }

  const sharePayload = (u) =>
    quoteShare({
      row: u,
      quote: u.quote,
      translation: u.translation,
      note: u.note,
      kind: u.kind,
      language: u.language,
      speaker: u.speaker,
      occasion: u.occasion,
      when: formatPartialDate(u.occasion_date, u.occasion_circa),
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
      // THE ROUTER, NOT THE MODAL SETTER: `openPerson`, which this file already
      // uses correctly on its speaker groups. The raw `setPerson` went straight
      // through here, so a speaker on a quote card opened the older by-name panel
      // however complete their record was. The id decides — see personOpen.jsx.
      // OMIT THE SPEAKER: this card's chip row draws them, with their portrait and
      // the door to their page on it, and the meta line was drawing the same name
      // and the same portrait again two millimetres below. The owner, of this
      // exact screen: "this ask has been botched as well." The card's own
      // `metaLine` has omitted the speaker whenever a chip draws it since the
      // ladder landed; this call site passes an explicit `meta` and so never
      // reached that branch.
      meta={utteranceMeta(u, { mark: true })}
      // The card's chip ladder needs the same two things the meta line does.
      people={speakerMap}
      seps={seps}
      onOpenPerson={openPerson}
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
      {confirmDialog}
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
        // KIND AND LANGUAGE, and this line used to read `setMedium('')` — a setter
        // that has not existed since 0053 renamed the column's meaning. Nothing
        // caught it: there is no ESLint in this project, the handler is only
        // reached by pressing Reset, and a ReferenceError inside an onClick takes
        // the press and not the page. So Reset half-worked, and the two filters it
        // failed to clear are `usePersistedState` — they survived a reload too.
        setKind('')
        setLanguage('')
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
          {/* THE HOST FOR THE PERSON'S OWN SCREEN, OUTSIDE the legacy modal's
              guard. Inside it the host mounts only while the OLD panel is open,
              so the new one opens into nothing — a dead press, which is the exact
              failure this whole change is about. */}
          <PanelHost stack={personStack} />
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
          {grouped.slice(0, groupWin.count).map((g) => {
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
                  onOpenPerson={isSpeaker ? () => openPerson({ kind: 'speaker', name: g.label, person: speakerMap[g.label] }) : undefined}
                />
                <QuoteBoard items={g.items} columns={columns} card={card} />
              </section>
            )
          })}
          {groupWin.more && <div ref={groupWin.sentinel} aria-hidden="true" className="h-px" />}
        </div>
      ) : (
        <QuoteBoard items={shown} columns={columns} card={card} />
      )}
    </WorkListScaffold>
    </>
  )
}
