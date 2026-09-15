// Anthologies — quotes gathered into a reading order, with the reader's own words
// between them.
//
// WHAT THIS IS NOT. It is not a board and it is not a tag. A board says where a
// standalone quote is FILED and a quote sits on exactly one; a tag says what a
// quote is ABOUT and cuts across everything. An anthology is a THIRD relationship
// and the only one of the three that is a piece of writing: the same line may
// appear in five of them, the order inside one is chosen rather than derived, and
// each entry carries a paragraph of the reader's own prose introducing it. Books,
// film dialogue and standalone quotes go in side by side, because the point is the
// argument being assembled and not which shelf each sentence came off.
//
// THE SCREEN IS TWO LEVELS, exactly like Quotes: /anthologies lists them the way
// /quotes lists boards, and /anthologies/{id} is the one you are reading. It is
// modelled on boards.jsx deliberately — same tile grid, same one-form-for-create-
// and-edit, same delete dialog that says what is actually lost — because a second
// vocabulary for the same shape is how two screens start drifting apart.
//
// THE DOORS IN ARE ELSEWHERE, AND THERE ARE FOUR OF THEM NOW. Nothing on this
// screen adds an entry, because the server has no route that would: POST
// /anthologies/{id}/entries takes (kind, item_id) pairs the reader has to have
// picked somewhere the passages are. So composing happens where they are — the
// selection bar, a work's menu, an annotation's menu, and the search screen — all
// four through `gatherInto` in anthologyGather.jsx, which is one function for the
// reason the repo's own directive gives. This screen is where the gathering is
// read, ordered and written about.
//
// THE SELECTION BAR WAS THE ONLY ONE FOR A LONG TIME and this header said so. It
// meant that gathering was something you could only do having first made a
// selection — so a reader looking at one passage they wanted to keep had to select
// it, find the ⋯, and pick from a list of anthologies that had to already exist.
//
// WHAT THE SERVER OWNS, and this file must not second-guess:
//   - the ORDER. Entries arrive sorted by position and are rendered in the order
//     they arrive, never re-sorted here. A move posts (kind, item_id, after) and
//     the server computes the number, which it may do by renumbering the whole
//     anthology — so a move is followed by a re-read rather than by patching a
//     position locally.
//   - the DEDUPE. Adding a quote already in the anthology is a silent skip, not an
//     error, so the dialog reports `added` and `skipped` from the response instead
//     of assuming every item landed.
//   - the LIMITS below.

import { useCallback, useEffect, useState } from 'react'
import { DEMO, apiURL, errText, json } from './api.js'
import { t, tNodes } from './i18n.js'
import { quoteKindLabel } from './quoteKind.js'
import { languageClass } from './fonts.js'
import { categoryVar } from './theme.js'
import { usePractice } from './review.jsx'
// THE SEARCH SCREEN'S OWN BOX, imported rather than rebuilt. See RuleDialog below:
// a second way to ask one question is how two screens get to disagree about what
// an author is.
import { SearchBox } from './SearchPage.jsx'
import { addChip, facetField, facetParams, makeChip, readSearchBox } from './facets.js'
// THE BOX THAT OFFERS WHAT YOU HAVE. The fill-from sheet picks a tag, an author or
// a shelf out of the same vocabulary the search dropdown uses.
import { SuggestCombo } from './suggest.jsx'
import { cachedVocabulary, primeSearchVocabulary } from './vocabulary.js'
import {
  Card,
  ConfirmDialog,
  ErrorText,
  Field,
  FormModal,
  GhostButton,
  IconBack,
  IconChevron,
  IconDelete,
  IconEdit,
  IconExport,
  IconPlus,
  useScreenBar,
  IconQuiz, IconPractise, IconPrint, IconReading, IconSearch,
  MonoLabel,
  MoreMenu,
  PageHeader,
  toast,
  Toggle,
  useFormHost,
} from './ui.jsx'

// The server's limits, mirrored so a field can stop you at the boundary instead of
// letting you type past it and answering with a 400. THE SERVER IS THE AUTHORITY —
// see anthologyTitleMax / anthologyIntroMax / anthologyNoteMax — and these are
// maxLength attributes only, never a second validation rule.
const TITLE_MAX = 120
const INTRO_MAX = 20000
const NOTE_MAX = 8000

// An entry has no id of its own: (kind, item_id) IS its identity, which is why the
// remove route puts both in the path. One helper so the four places that compare
// entries cannot disagree about what "the same entry" means.
const entryRef = (e) => ({ kind: e.kind, item_id: e.item_id })
const sameEntry = (a, b) => a.kind === b.kind && a.item_id === b.item_id

// ANTHOLOGY_KIND, the list hook, the request and the picker all live in
// anthologyGather.jsx now — see that file's header for why (this module imports
// SearchBox from SearchPage.jsx, and the search screen needs the picker, which
// would close that edge into a cycle).
//
// IMPORTED AS WELL AS RE-EXPORTED, and the two lines are not redundant: `export
// … from` sets up a pass-through and creates NO local binding, so this file's own
// calls to `useAnthologies` would be a ReferenceError at render with nothing in
// the module graph looking wrong.
export { ANTHOLOGY_KIND, AddToAnthologyDialog, workRule, worksRule } from './anthologyGather.jsx'
import { gatherInto, useAnthologies } from './anthologyGather.jsx'
export { gatherInto, useAnthologies }

// exportHref is a plain URL rather than a helper call, because this export is the
// one that is a GET: downloadPost in api.js posts a body of ids, and there is no
// body here — the anthology already knows what is in it. A real href also means
// middle-click and "save link as" work on it.
const exportHref = (id) => apiURL(`/anthologies/${id}/export`)
// The same document in the container an e-reader opens. A SEPARATE PATH and not a
// `?format=` on the one above: these are two files with two media types and two
// extensions, and what a browser does with a download is decided by the response.
const epubHref = (id) => apiURL(`/anthologies/${id}/export.epub`)

// ── THE RULE (0075). A way to FILL an anthology from a search, and not a way for
// one to BE a search — see the migration for the argument, which is that a live
// query anthology can hold neither an order nor your writing.
//
// BUILT FROM THE SEARCH BAR THE READER ALREADY KNOWS, literally: `SearchBox` is
// the component the Search screen draws, with the same chips, the same field menu
// and the same vocabulary. A second way to ask one question is how the two get to
// disagree about what an author is — and this repo's directive is that a control
// drawn on two screens has one behaviour living in one function.
//
// THE RULE ON THE WIRE IS THE SEARCH'S OWN QUERY STRING, assembled here by the
// same `facetParams` the search URL is built from, so a rule can be read by a
// person and pasted into the search bar to see exactly what it will take.
const ruleQuery = (chips, freeText) => {
  const params = new URLSearchParams()
  for (const [field, value] of facetParams(chips)) params.append(field, value)
  const q = String(freeText || '').trim()
  if (q) params.set('q', q)
  return params.toString()
}

// ruleChips reads a stored rule back into the box. The reverse of ruleQuery, and
// the reason the two are next to each other: a rule that cannot be re-opened is a
// rule the reader can only replace.
const ruleChips = (rule) => {
  const out = { chips: [], q: '' }
  if (!rule) return out
  for (const [field, value] of new URLSearchParams(rule)) {
    if (field === 'q') out.q = value
    else if (facetField(field)) out.chips = addChip(out.chips, makeChip(field, { value, label: value }))
  }
  return out
}

// FIELD_SWITCHES — everything an entry can show, in reading order rather than in
// column order, because this is a list somebody reads top to bottom.
//
// Each row names the THING and the toggle says whether it is shown, so the label
// never has to be negated: a switch reading "Who said it — off" is legible in a way
// "Hide who said it — on" is not. The `hide` flag is where the stored column is
// inverted, and it is the only place that inversion lives.
//
// The first six are 0045's columns — hide_* where the thing is shown today and
// show_* where it is not, so that every default is the zero value. That asymmetry
// stops here: the form deals only in "shown".
//
// `work: true` MARKS THE SECOND HOME. 0074 put everything after the six in one
// `fields` object rather than a column each, so a row's flag is read out of
// `initial.fields` and posted back inside `fields`. The key is the registry's own,
// which is also the export's binding and the reading view's lookup — one spelling
// from the switch to the file.
//
// THIS LIST AND THE GO REGISTRY ARE TWO TABLES SAYING ONE THING, which is a real
// cost and the one the repo already pays for `addFields.js`. It is paid the same
// way: `anthology-registry.test.js` reads anthology_registry.go and fails when
// either list names a field the other does not.
const FIELD_SWITCHES = [
  { key: 'hide_credit', hide: true, label: 'anthologies.form.fields.credit.label', eg: 'anthologies.eg.hide-credit' },
  { key: 'hide_source', hide: true, label: 'anthologies.form.fields.source.label', eg: 'anthologies.eg.hide-source' },
  { key: 'show_locator', hide: false, label: 'anthologies.form.fields.locator.label', eg: 'anthologies.eg.show-locator' },
  { key: 'show_date', hide: false, label: 'anthologies.form.fields.date.label', eg: 'anthologies.eg.show-date' },
  { key: 'hide_commentary', hide: true, label: 'anthologies.form.fields.commentary.label', eg: 'anthologies.eg.hide-commentary' },
  { key: 'hide_colour', hide: true, label: 'anthologies.form.fields.colour.label', eg: 'anthologies.eg.hide-colour' },
]

// WORK_SWITCHES — what the book or the film the passage came out of knows (0074).
//
// A SECOND LIST AND NOT SIX MORE ROWS, because they are a different question. The
// six above are parts of the DOCUMENT — whether it prints attributions, whether it
// carries your marginalia. These are fields of the WORK, they are all off by
// default, and they take the app's own field names (common.field.*) rather than
// the six's hand-written prose, because "Publisher" is already what every other
// screen calls it.
//
// AUTHOR AND DIRECTOR ARE TWO ROWS. They are the same idea and a single switch
// would have to pick one of the two words, so an anthology of films would offer
// "Author". A mixed anthology turns both on and each entry shows the one it has.
const WORK_SWITCHES = [
  { key: 'author', work: true, label: 'common.field.author.label', eg: 'anthologies.eg.author' },
  { key: 'director', work: true, label: 'common.field.director.label', eg: 'anthologies.eg.director' },
  { key: 'translator', work: true, label: 'common.field.translator.label', eg: 'anthologies.eg.translator' },
  { key: 'editor', work: true, label: 'common.field.editor.label', eg: 'anthologies.eg.editor' },
  { key: 'publisher', work: true, label: 'common.field.publisher.label', eg: 'anthologies.eg.publisher' },
  { key: 'year', work: true, label: 'common.field.year.label', eg: 'anthologies.eg.year' },
  { key: 'series', work: true, label: 'common.field.series.label', eg: 'anthologies.eg.series' },
  { key: 'subtitle', work: true, label: 'common.field.subtitle.label', eg: 'anthologies.eg.subtitle' },
  { key: 'isbn', work: true, label: 'common.field.isbn.label', eg: 'anthologies.eg.isbn' },
  { key: 'pages', work: true, label: 'common.field.pages.label', eg: 'anthologies.eg.pages' },
  { key: 'media_type', work: true, label: 'common.field.media-type.label', eg: 'anthologies.eg.media-type' },
]

// PERSON_SWITCHES — the life behind the name (0074). Whoever is answerable for the
// passage: a book's author, a film line's actor, a standalone quote's speaker.
//
// THE ONLY GROUP ALL THREE KINDS CAN SHOW. Everything in WORK_SWITCHES needs a
// parent work and a standalone quote has none, so this is the first thing a proverb
// or a speech can print beyond its own attribution.
//
// A MISS IS THE ORDINARY STATE. `people` matches by exact name and a row exists
// only where somebody looked the name up, so most entries show nothing here. The
// line is simply absent for them — see personLine.
const PERSON_SWITCHES = [
  { key: 'bio', work: true, label: 'common.field.bio.label', eg: 'anthologies.eg.bio' },
  { key: 'born', work: true, label: 'common.field.born.label', eg: 'anthologies.eg.born' },
  { key: 'died', work: true, label: 'common.field.died.label', eg: 'anthologies.eg.died' },
  { key: 'links', work: true, label: 'common.field.links.label', eg: 'anthologies.eg.links' },
  // THE TWO PICTURES, and they are the only fields on this form that are not text.
  // They draw the file the app already serves at /covers/; the EPUB carries the
  // bytes; the Markdown writes neither, because a path is meaningless outside this
  // install. `character_portrait` is the face of whoever is NAMED on the line — a
  // standalone quote has no character column at all (0026), so it is absent there.
  { key: 'portrait', work: true, label: 'common.field.portrait.label', eg: 'anthologies.eg.portrait' },
  { key: 'character_portrait', work: true, label: 'common.field.cast.label', eg: 'anthologies.eg.character-portrait' },
]

// `work: true` ON A PERSON ROW READS ODD AND IS RIGHT: the flag means "stored in
// the `fields` object", not "read off the work". Everything added after 0045 lives
// there whatever it reads from, and giving the two questions one flag each would be
// a second thing to keep true for a distinction the form never makes.
const ALL_SWITCHES = [...FIELD_SWITCHES, ...WORK_SWITCHES, ...PERSON_SWITCHES]

// SWITCH_GROUPS — the three lists as a registry, because the form no longer draws
// them and something has to say what the three doors open onto.
//
// TWENTY-THREE SWITCHES WERE THE WHOLE FORM. Title and introduction sat above six,
// then eleven, then six more, and the two fields a new anthology actually needs
// were a scroll away from the button that saves them. The owner's words are "the
// anthology addition settings is too long"; the fix is not a shorter list but a
// form that asks its two questions and offers the rest behind a door each.
//
// THE HEADINGS WERE ALREADY THE GROUPS. 0074's form drew these same three titles
// with their own hints — the split is not invented here, it is the one the form
// already made visually, now made structural. So a reader who knew where to look
// still looks in the same place, and the keys below are the ones already shipped.
const SWITCH_GROUPS = [
  { key: 'passage', rows: FIELD_SWITCHES, label: 'anthologies.form.fields.label', hint: 'anthologies.form.fields.hint' },
  { key: 'work', rows: WORK_SWITCHES, label: 'anthologies.form.fields.work.label', hint: 'anthologies.form.fields.work.hint' },
  { key: 'person', rows: PERSON_SWITCHES, label: 'anthologies.form.fields.person.label', hint: 'anthologies.form.fields.person.hint' },
]

// shown / stored — the two directions of that inversion, named so a reader of this
// file can see there is exactly one of each. A work row has no inversion to do:
// every one of them is off at zero, which is what keeps a default export unchanged.
const shown = (row, flags) => (row.hide ? !flags[row.key] : !!flags[row.key])
const stored = (row, isShown) => (row.hide ? !isShown : isShown)

// seeded reads a row's current value out of the anthology, from whichever of the
// two homes it lives in. One function, so the split is stated once.
const seeded = (row, a) => (row.work ? !!a?.fields?.[row.key] : !!a?.[row.key])

// splitFlags turns the form's one flat map back into the shape the PUT takes: the
// six at the top level where their columns are, the rest inside `fields`.
const splitFlags = (flags) => {
  const body = {}
  const fields = {}
  for (const row of FIELD_SWITCHES) body[row.key] = !!flags[row.key]
  for (const row of [...WORK_SWITCHES, ...PERSON_SWITCHES]) if (flags[row.key]) fields[row.key] = true
  body.fields = fields
  return body
}

// workLine is what an entry prints from its work: the switched-on fields it
// actually has, in the list's own order, joined the way every other meta line on
// this screen is. An entry with no work — a standalone quote — has nothing here,
// and so does one whose work knows none of the chosen fields.
const workLine = (entry, fields = {}) =>
  WORK_SWITCHES.filter((row) => fields?.[row.key] && entry.work?.[row.key])
    .map((row) => entry.work[row.key])
    .join(' · ')

// personLine is the same rule over the `people` row. A SEPARATE LINE and not more
// values on the work line, because they answer different questions — one is about
// the book, the other about whoever wrote it — and a bio is a sentence rather than
// a field, so running it in after "Parnassus Press · 1968" would read as one long
// caption with a paragraph buried in it.
// PORTRAIT_KEYS are the rows personLine must NOT join into its sentence: a filename
// read out beside a biography is the screen printing its own bookkeeping.
const PORTRAIT_KEYS = new Set(['portrait', 'character_portrait'])

const personLine = (entry, fields = {}) =>
  PERSON_SWITCHES.filter((row) => !PORTRAIT_KEYS.has(row.key) && fields?.[row.key] && entry.person?.[row.key])
    .map((row) => entry.person[row.key])
    .join(' · ')

// portraitsOf is the two faces an entry can show, in the order they are read: the
// character named on the line first, then whoever is answerable for it. Each is a
// file under /covers/, and each is absent for most entries — a picture exists only
// where somebody was looked up AND one was downloaded.
const portraitsOf = (entry, fields = {}) =>
  [
    fields?.character_portrait && entry.cast?.character_portrait,
    fields?.portrait && entry.person?.portrait,
  ].filter(Boolean)

// RuleDialog — choose the search that fills this anthology, see what it would take,
// and take it.
//
// THE PREVIEW IS THE FILL, ROLLED BACK. `POST …/fill {preview:true}` runs the real
// write inside a transaction it abandons, so the number on this screen is the
// number the button will produce rather than a second opinion about it. A preview
// that counted differently would show the reader one answer and give them another.
//
// IT PREVIEWS ON PRESS AND NOT ON EVERY KEYSTROKE. The preview is a search over the
// whole library plus an ownership check per candidate; running it as somebody types
// would put that behind every letter. So the reader asks, which also makes the
// number something they requested rather than something that flickers.
//
// AND THE NUMBER GOES STALE THE MOMENT THE RULE CHANGES, which is why it is cleared
// on any edit: a count left on screen under a rule that no longer produced it is
// the screen lying quietly.
// useRuleBox — the box, its vocabulary and the query it comes to.
//
// TWO SURFACES ASK FOR A RULE NOW: this file's RuleDialog, on an anthology that
// already exists, and the create form's own door, on one that does not. The repo's
// directive is that a control drawn on two screens has one behaviour living in one
// function "not in a line each, which is how one of them goes on being right while
// the other quietly stops" — and the half that would drift here is the least
// visible: `readSearchBox` strips a half-typed facet before the query is built, so
// a second copy that forgot it would store `tag:sto` as free text and quietly
// match nothing.
function useRuleBox(initialRule) {
  const seed = ruleChips(initialRule)
  const [chips, setChips] = useState(seed.chips)
  const [q, setQ] = useState(seed.q)
  const [vocabulary, setVocabulary] = useState(() => cachedVocabulary() || {})
  useEffect(() => { primeSearchVocabulary().then(setVocabulary).catch(() => {}) }, [])
  const { draft, options, freeText } = readSearchBox(q, vocabulary)
  return { chips, setChips, q, setQ, draft, options, rule: ruleQuery(chips, freeText) }
}

// RuleFields — what both surfaces draw: the search screen's own box, the warning
// about what the credit facets do not reach, and the switch that keeps it fed.
function RuleFields({ box, auto, setAuto, onEdit }) {
  const edit = (fn) => (...args) => { onEdit?.(); fn(...args) }
  return (
    <>
      <SearchBox
        q={box.q}
        setQ={edit(box.setQ)}
        chips={box.chips}
        setChips={edit(box.setChips)}
        draft={box.draft}
        options={box.options}
      />
      {/* WHAT THE CREDIT FACETS DO NOT REACH, said on the screen rather than left
          to be discovered. `author`, `actor`, `character` and `speaker` match the
          quote's or the work's own column and not the cast table (0048), so an
          anthology OF AN ACTOR misses the lines where they are only in the film's
          cast. A reader building exactly that will notice; this is the only place
          that can tell them first. */}
      <p className="microcopy opacity-80">{t('anthologies.rule.credits.note')}</p>
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0">
          <MonoLabel>{t('anthologies.rule.auto.label')}</MonoLabel>
          <p className="microcopy mt-0.5">{t('anthologies.rule.auto.hint')}</p>
        </span>
        <Toggle
          ariaLabel={t('anthologies.rule.auto.label')}
          value={auto ? 'on' : 'off'}
          onChange={(v) => setAuto(v === 'on')}
          options={[['off', t('common.toggle.off.label')], ['on', t('common.toggle.on.label')]]}
        />
      </div>
    </>
  )
}

// ── FILLING AN ANTHOLOGY FROM SOMETHING YOU ALREADY HAVE.
//
// WHAT THIS REPLACES, AND WHY. The form used to carry a door onto the search box —
// the same one RuleDialog draws — and the owner's verdict was "the fill from a search
// in the add anthology popup feels bad, drop it". It is right, and the reason is that
// a search bar is a place to ASK A QUESTION, which is the wrong posture for a form
// where you are DECLARING WHAT A THING IS. Nobody making an anthology of Seneca wants
// to compose `author=Seneca`; they want to point at Seneca.
//
// SO THE SOURCES ARE NAMED, and each one is a thing the reader already has: a book, a
// tag, an author, a colour, a shelf, their favourites, a stretch of time, or the whole
// library. The owner's list, and the "etc." resolved to the facets the search grammar
// already indexes — so every source below is a rule the fill honours EXACTLY, rather
// than a promise this screen makes and the server interprets differently.
//
// A BOARD IS NOT IN THE LIST AND THAT IS NOT AN OVERSIGHT. There is no `board` facet:
// boards hold standalone quotes only, so `board=X` would have to decide what it means
// for highlights and film lines — every one of them, or none — and that is a change to
// the shared search grammar rather than to this form. It is worth doing and it is not
// this.
//
// `vocab` NAMES THE LIST TO OFFER, from /search/vocabulary, which is the same list the
// search box's own dropdown uses. `pairs` marks the two that send an id and show a
// name, because two editions and the film of the book can share a title and only an id
// says which was meant.
const FILL_SOURCES = [
  { key: 'all', label: 'anthologies.fill.all.label' },
  { key: 'book', label: 'anthologies.fill.book.label', field: 'book', vocab: 'books', pairs: true },
  { key: 'movie', label: 'anthologies.fill.movie.label', field: 'movie', vocab: 'movies', pairs: true },
  { key: 'tag', label: 'anthologies.fill.tag.label', field: 'tag', vocab: 'tags' },
  { key: 'author', label: 'anthologies.fill.author.label', field: 'author', vocab: 'authors' },
  { key: 'colour', label: 'anthologies.fill.colour.label', field: 'colour', vocab: 'colours', pairs: true },
  { key: 'shelf', label: 'anthologies.fill.shelf.label', field: 'shelf', vocab: 'shelves' },
  { key: 'favourite', label: 'anthologies.fill.favourite.label' },
  { key: 'dates', label: 'anthologies.fill.dates.label' },
]

const fillSource = (key) => FILL_SOURCES.find((s) => s.key === key) || null

// fillRule — the source and its value as the query string the fill takes.
//
// ONE FUNCTION, SO THE SUMMARY AND THE REQUEST CANNOT DISAGREE. The row on the form
// says what will be taken and this says what is sent; building the string in two
// places is how a form comes to promise one thing and do another.
export function fillRule({ source, value, from, to }) {
  const p = new URLSearchParams()
  p.set('scope', 'all')
  const spec = fillSource(source)
  if (!spec) return ''
  if (spec.key === 'favourite') p.set('favourite', 'yes')
  else if (spec.key === 'dates') {
    if (!from && !to) return ''
    if (from) p.set('added_from', from)
    if (to) p.set('added_to', to)
  } else if (spec.field) {
    if (!value) return ''
    p.set(spec.field, value)
  }
  return p.toString()
}

// fillSummary — the choice in the reader's words, for the row on the form.
//
// NOT THE RULE STRING. `q=narwhal&tag=stoicism` is honest and it is a wire format;
// the form's job is to say "everything tagged Stoicism" back to somebody who chose
// Stoicism. The rule is still what goes to the server, and `fillRule` is still the
// only thing that builds it — this is the same answer said the other way.
export function fillSummary({ source, value, text, from, to } = {}) {
  const spec = fillSource(source)
  if (!spec) return ''
  if (spec.key === 'dates') {
    if (from && to) return t('anthologies.fill.dates.both', { from, to })
    return t(from ? 'anthologies.fill.dates.from' : 'anthologies.fill.dates.to', { date: from || to })
  }
  if (!spec.field) return t(spec.label)
  // The NAME they chose, not the id it resolved to — `book=4` is the wire value and
  // "A book: 4" is not a sentence about anything.
  return t('anthologies.fill.of', { what: t(spec.label), value: text || value })
}

// FillFromDialog — pick a source, then what of it.
//
// ONE POPUP AND NOT TWO. Choosing "a tag" and then being sent to a second sheet to
// choose WHICH tag is the escalation this repo already argues against; the list of
// values appears under the chosen source instead, in the same box, and the ✓ commits
// both at once.
function FillFromDialog({ initial, backTo, onApply, onClose }) {
  const [source, setSource] = useState(initial?.source || '')
  const [value, setValue] = useState(initial?.value || '')
  // WHAT THEY TYPED, KEPT SEPARATELY FROM WHAT IT RESOLVED TO.
  //
  // The first cut derived the box's contents from `value` alone, so a keystroke that
  // did not yet match a known title set `value` to '' and the box emptied itself
  // under the reader's hands — and it did that reliably for the first word of every
  // title, because a vocabulary arrives over the network and the box is typeable
  // before it lands. A picker that eats what you type is worse than one with no
  // suggestions at all.
  const [text, setText] = useState(initial?.text || '')
  const [from, setFrom] = useState(initial?.from || '')
  const [to, setTo] = useState(initial?.to || '')
  const [auto, setAuto] = useState(!!initial?.auto)
  const [vocabulary, setVocabulary] = useState(() => cachedVocabulary() || {})
  useEffect(() => { primeSearchVocabulary().then(setVocabulary).catch(() => {}) }, [])
  const spec = fillSource(source)
  const rule = fillRule({ source, value, from, to })
  const changed = rule !== (initial?.rule || '') || !!auto !== !!initial?.auto ? 1 : 0
  return (
    <FormModal
      open
      onClose={onClose}
      title={t('anthologies.fill.title')}
      maxWidth={460}
      dirty={changed}
      backTo={backTo}
    >
      <FillFromForm
        spec={spec}
        source={source}
        setSource={(k) => { setSource(k); setValue(''); setText('') }}
        value={value}
        setValue={setValue}
        text={text}
        setText={setText}
        from={from}
        setFrom={setFrom}
        to={to}
        setTo={setTo}
        auto={auto}
        setAuto={setAuto}
        vocabulary={vocabulary}
        rule={rule}
        onApply={() => onApply({ source, value, text, from, to, auto, rule })}
      />
    </FormModal>
  )
}

// The body, SEPARATE so `useFormHost` registers with THIS dialog — the gotcha
// identityPicker.jsx states and every sheet in this file obeys.
function FillFromForm({ spec, source, setSource, value, setValue, text, setText, from, setFrom, to, setTo, auto, setAuto, vocabulary, rule, onApply }) {
  const blocked = source && !rule ? t('anthologies.fill.blocked') : ''
  const host = useFormHost(blocked)
  // A pair list comes back as {key, name}; everything else as bare strings. The combo
  // shows the name and the form keeps the key, which is what `book=4` needs.
  const rows = spec?.vocab ? (vocabulary[spec.vocab] || []) : []
  const options = rows.map((r) => (spec.pairs ? { name: r.name, key: r.key } : { name: r }))
  return (
    <form
      id={host?.formId}
      className="space-y-3"
      onSubmit={(e) => { e.preventDefault(); if (!blocked) onApply() }}
    >
      <p className="microcopy">{t('anthologies.fill.body')}</p>
      <div className="flex flex-wrap gap-2">
        {FILL_SOURCES.map((s) => (
          <button
            key={s.key}
            type="button"
            className={'tp-filter-chip tactile' + (source === s.key ? ' active' : '')}
            aria-pressed={source === s.key}
            onClick={() => setSource(source === s.key ? '' : s.key)}
          >
            {t(s.label)}
          </button>
        ))}
      </div>
      {/* WHICH ONE, under the chip that asked. Absent for the sources that need no
          value — "everything" and "my favourites" are already complete questions. */}
      {spec?.vocab && (
        <SuggestCombo
          label={t(spec.label)}
          value={text}
          onChange={(v) => {
            setText(v)
            // A NAME RESOLVES TO AN ID WHERE THERE IS ONE TO RESOLVE TO. Two editions
            // and the film of the book can share a title, so `book=` wants the id —
            // but the reader types a name, and until it matches one there is nothing
            // to send. The tick stays blocked in that state rather than the box
            // rewriting what they typed.
            const hit = options.find((o) => String(o.name).toLowerCase() === v.trim().toLowerCase())
            setValue(spec.pairs ? (hit ? String(hit.key) : '') : v.trim())
          }}
          placeholder={t('anthologies.fill.pick.placeholder')}
          options={options.map((o) => ({ name: o.name }))}
        />
      )}
      {spec?.key === 'dates' && (
        <div className="grid grid-cols-2 gap-2">
          <Field label={t('anthologies.fill.from.label')} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Field label={t('anthologies.fill.to.label')} type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      )}
      {/* KEEP IT FED, on every one of these. The owner: "all auto/search based
          anthologies should allow auto-expand as new quotes/annotations come in." An
          anthology of a tag is a standing question, so the offer to keep answering it
          belongs beside the question rather than somewhere else. */}
      {source && (
        <div className="flex items-center justify-between gap-3">
          <span className="min-w-0">
            <MonoLabel>{t('anthologies.rule.auto.label')}</MonoLabel>
            <p className="microcopy mt-0.5">{t('anthologies.rule.auto.hint')}</p>
          </span>
          <Toggle
            ariaLabel={t('anthologies.rule.auto.label')}
            value={auto ? 'on' : 'off'}
            onChange={(v) => setAuto(v === 'on')}
            options={[['off', t('common.toggle.off.label')], ['on', t('common.toggle.on.label')]]}
          />
        </div>
      )}
      <p className="microcopy opacity-80">{t('anthologies.rule.credits.note')}</p>
    </form>
  )
}


function RuleDialog({ anthology, onClose, onFilled }) {
  const box = useRuleBox(anthology.rule)
  const [auto, setAuto] = useState(!!anthology.rule_auto)
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const { rule } = box
  const clearPreview = () => { setPreview(null); setError('') }

  async function run(isPreview) {
    if (!rule) return setError(t('anthologies.rule.empty'))
    setBusy(true)
    const res = await json('POST', `/anthologies/${anthology.id}/fill`, { rule, auto, preview: isPreview })
    setBusy(false)
    if (!res.ok) return setError(errText(res))
    if (isPreview) return setPreview(res.data)
    onFilled(res.data)
  }

  return (
    <FormModal open title={t('anthologies.rule.title')} onClose={onClose}>
      <div className="space-y-3">
        <p className="microcopy">{t('anthologies.rule.body')}</p>
        {/* A count left on screen under a rule that no longer produced it is a lie,
            so every edit to the box clears it — which is what `onEdit` is for. */}
        <RuleFields box={box} auto={auto} setAuto={setAuto} onEdit={clearPreview} />
        {/* THE THREE NUMBERS, and each answers a question the others do not:
            how many the rule finds, how many of those are new here, and how many
            were already in the anthology. "found 3, adds 0" and "found 3, adds 0,
            all three are already here" are the same first number and completely
            different news. */}
        {preview && (
          <p className="microcopy">
            {t('anthologies.rule.preview', {
              matched: preview.matched,
              added: preview.added,
              skipped: preview.skipped,
            })}
            {preview.capped ? ' ' + t('anthologies.rule.capped') : ''}
          </p>
        )}
        <ErrorText>{error}</ErrorText>
        <div className="flex items-center justify-end gap-2">
          <GhostButton type="button" onClick={onClose}>{t('common.action.cancel.label')}</GhostButton>
          <GhostButton type="button" icon={<IconSearch />} onClick={() => run(true)} disabled={busy || !rule}>
            {t('anthologies.rule.preview.action')}
          </GhostButton>
          <button type="button" className="tp-btn tp-btn-primary tactile" onClick={() => run(false)} disabled={busy || !rule}>
            {busy ? t('common.action.save.busy') : t('anthologies.rule.fill.action')}
          </button>
        </div>
      </div>
    </FormModal>
  )
}

// FieldSwitch is one row of either list. ONE COMPONENT AND NOT TWO COPIES: the
// repo's directive is that a control drawn on two surfaces has one behaviour living
// in one function, and a second copy here is how the work rows would quietly stop
// honouring the hide/show inversion that the six still needed.
// A CHIP THAT SHOWS WHAT IT WOULD PRINT, rather than a Hide/Show pair.
//
// The owner: "do not use the hide show buttons, instead use text buttons with the
// labels. each label should also hold an example (e.g. the who said it button
// should show the people pill / character pill)."
//
// TWO THINGS WERE WRONG WITH THE PAIR AND THE EXAMPLE FIXES BOTH. A row read "Who
// said it — Hide | Show", so the reader answered a question about a FIELD NAME with
// no idea what turning it on would put on the page: "Who said it" could be a name, a
// name and a role, or a name and dates. And the pair spends a whole row saying a
// thing a pressed state says for nothing.
//
// SO THE CHIP IS THE ANSWER AND THE STATE AT ONCE. It carries the label and a sample
// of the line it draws, and being ON is the accent fill `.tp-filter-chip.active`
// already means everywhere else in this app — the genre bar, the search scope. A
// fourth way of saying on would be a new thing to learn for no new meaning.
function FieldSwitch({ row, flags, setFlags }) {
  const on = shown(row, flags)
  return (
    <button
      type="button"
      className={'tp-filter-chip tp-show-chip tactile' + (on ? ' active' : '')}
      // `aria-pressed` AND NOT A CHECKBOX ROLE: this is a control that stays put and
      // changes what the document prints, which is what pressed means. A screen
      // reader then announces the label, the sample, and whether it is on.
      aria-pressed={on}
      onClick={() => setFlags((f) => ({ ...f, [row.key]: stored(row, !on) }))}
    >
      <span className="tp-show-chip-label">{t(row.label)}</span>
      <span className="tp-show-chip-eg">{t(row.eg)}</span>
    </button>
  )
}

// countShown — how many of a group's rows are on, which is what its door says.
//
// A ROW SAYS A THING ONCE, so the door carries a COUNT and not a restatement of
// its own label. "4 of 6" is the fact the reader cannot get from the heading, and
// it is the one that decides whether they need to open the door at all.
const countShown = (rows, flags) => rows.filter((row) => shown(row, flags)).length

// SwitchGroupDialog — one group of switches, behind its own door.
//
// IT HOLDS A DRAFT AND COMMITS ON THE TICK, rather than writing into the form's
// flags as each switch moves. Two reasons, and the second is the standing rule:
// a reader who opens "From the book or film", flips four things and thinks better
// of it needs a way back that undoes them — and the app's answer to that question
// everywhere else is the ✓/✕ pair, where the cross is the discarding half. A
// popup that wrote through would leave the cross meaning nothing.
//
// `dirty` IS THE COUNT OF CHANGED ROWS, which is what arms the tick and fills its
// badge. Not the count of rows that are ON: the badge answers "how many fields
// will this press change", and those are different numbers the moment a reader
// turns something off.
// A BACK KEY AND NOT A ✕ (`backTo`). This opened from the anthology form and returns
// to it; a ✕ over a half-filled form reads as "discard the lot", which is not what
// the press does. `closeDanger` went with it — the red belonged to the cross, and
// there is no cross here now.
function SwitchGroupDialog({ group, flags, backTo, onApply, onClose }) {
  const [draft, setDraft] = useState(flags)
  const changed = group.rows.filter((row) => shown(row, draft) !== shown(row, flags)).length
  return (
    <FormModal
      open
      onClose={onClose}
      title={t(group.label)}
      maxWidth={460}
      dirty={changed}
      backTo={backTo}
    >
      <SwitchGroupForm group={group} draft={draft} setDraft={setDraft} onApply={() => onApply(draft)} />
    </FormModal>
  )
}

// The body, SEPARATE because `useFormHost` reads the context `FormModal` puts
// around its CHILDREN — called in the component that renders the modal it would
// register with whatever surface is further out, and this dialog would draw no ✓
// at all. The gotcha is stated in identityPicker.jsx and is the same one here.
function SwitchGroupForm({ group, draft, setDraft, onApply }) {
  const host = useFormHost('')
  return (
    <form
      id={host?.formId}
      className="space-y-2.5"
      onSubmit={(e) => {
        e.preventDefault()
        onApply()
      }}
    >
      <p className="microcopy mb-2">{t(group.hint)}</p>
      {group.rows.map((row) => (
        <FieldSwitch key={row.key} row={row} flags={draft} setFlags={setDraft} />
      ))}
    </form>
  )
}

// GroupDoor — the row that opens one group, stating what is on behind it.
function GroupDoor({ group, flags, onOpen }) {
  return (
    <button type="button" className="tp-group-door tactile" onClick={onOpen}>
      <span className="min-w-0">
        <MonoLabel>{t(group.label)}</MonoLabel>
        <p className="microcopy mt-0.5">
          {t('anthologies.form.fields.count', { shown: countShown(group.rows, flags), total: group.rows.length })}
        </p>
      </span>
      <IconChevron />
    </button>
  )
}

// AnthologyForm — new anthology, and editing one. Title, introduction, and what
// each passage shows. The ENTRIES are not in the PUT (the server's own comment says
// so), so this form cannot accidentally clear them.
//
// UNLIKE A BOARD, A DUPLICATE TITLE IS FINE. Two anthologies called "On grief" are
// two anthologies; the server returns no 409 here, so there is no name-clash
// warning to write.
export function AnthologyForm({ initial, onSubmit, onCancel, submitLabel = t('common.action.save.label') }) {
  const [title, setTitle] = useState(initial?.title || '')
  const [intro, setIntro] = useState(initial?.intro || '')
  // The six as STORED, seeded from the row so an edit opens on what is set. A new
  // anthology starts at all-zero, which is "show everything except the locator and
  // the date" — exactly what an anthology looked like before 0045.
  // ONE FLAT MAP IN THE FORM, two homes in the row. A switch is a switch while
  // somebody is pressing it; where it is stored is splitFlags' problem and nothing
  // in the rendering below has to know.
  const [flags, setFlags] = useState(() => {
    const out = {}
    for (const row of ALL_SWITCHES) out[row.key] = seeded(row, initial)
    return out
  })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  // Which group's door is open, or null. The dialog it opens is rendered OUTSIDE
  // the form below — see the fragment at the return.
  const [group, setGroup] = useState(null)
  // THE RULE, ON THE FORM AT LAST. Filling from a search has existed since 0075 and
  // could only be reached from an anthology that already existed — so the answer to
  // "make me an anthology of everything tagged stoicism" was: make an empty one,
  // open it, find the ⋯, and fill it. The owner's report is that it "cannot be
  // accessed from the anthology add menu". It is a door on this form now, beside
  // the other three.
  //
  // ON THE NEW-ANTHOLOGY FORM ONLY, AND BOTH REASONS ARE DEFECTS THE OTHER WAY
  // ROUND COST. An existing anthology already has this door in its own ⋯ —
  // `RuleDialog`, which can also preview what a rule WOULD take because it has an
  // id to ask about — so drawing it here as well is two doors to one act, which
  // this repo names as a bug in its own right.
  //
  // And the edit surface seeds `rule` from the row, so a form that carried it would
  // hand a non-empty rule back on every save: renaming an anthology would re-run its
  // fill. `INSERT OR IGNORE` makes that harmless, which is exactly what makes it bad
  // — a write nobody asked for, on a path nobody thinks of as one, reporting "0
  // added, 47 already here" to somebody who changed a title. It is the hazard 0075's
  // own migration comment argues against, one surface along.
  const isNew = !initial
  // `fill` is the WHOLE answer — which source, which value, and whether to keep
  // taking more — because the row has to say it back in words and the submit has to
  // send it as a rule. Holding only the rule string would mean parsing it back to
  // draw the row, which is the second grammar 0075 refused for the same reason.
  const [fill, setFill] = useState(null)
  const [ruling, setRuling] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (!title.trim()) return setError(t('error.validate.anthology-title-required'))
    setBusy(true)
    // EVERY FIELD, ALWAYS. The PUT is full-state — the fifth time this trap has
    // been laid in this app, see boards.jsx — so sending a renamed title without
    // the introduction beside it would silently delete the introduction, and
    // sending it without the switches would silently reset every one of them.
    // `fields` is sent even when empty for exactly that reason: an omitted object
    // and an empty one are the same wire value here, and the empty one is honest.
    // THE RULE IS NOT IN THE BODY, because the routes do not take it: POST and PUT
    // /anthologies carry title, intro and the visibility columns only, and a rule is
    // always POST /anthologies/{id}/fill afterwards. It goes as a second argument so
    // the caller — which is the one that knows the id, and on a create only learns it
    // from the response — can run the fill once the anthology exists.
    const msg = await onSubmit({ title: title.trim(), intro, ...splitFlags(flags) }, { rule: fill?.rule || '', auto: !!fill?.auto })
    setBusy(false)
    if (msg) setError(msg)
  }

  // THE DIALOG IS A SIBLING OF THE FORM, AND THAT IS NOT A TIDINESS PREFERENCE.
  // `FormModal` portals to document.body, so the group's own <form> is nowhere
  // near this one in the DOM — but React propagates events along the REACT tree,
  // portals included, so a submit raised inside the dialog would bubble into
  // `submit` below and save the whole anthology the moment somebody pressed a
  // group's ✓. A sibling cannot bubble into it.
  return (
    <>
    <form onSubmit={submit} className="space-y-4">
      <Field
        label={t('common.field.title.label')}
        nameCase
        value={title}
        maxLength={TITLE_MAX}
        placeholder={t('anthologies.form.title.placeholder')}
        onChange={(e) => setTitle(e.target.value)}
      />
      {/* A textarea rather than a Field: Field renders an <input>, and this is the
          paragraph that says what the gathering is for. The blank line between
          paragraphs survives — the server trims the edges only. */}
      <label className="tp-field">
        <MonoLabel>{t('anthologies.form.intro.label')}</MonoLabel>
        <textarea
          className="tp-input"
          rows={5}
          value={intro}
          maxLength={INTRO_MAX}
          placeholder={t('anthologies.form.intro.placeholder')}
          onChange={(e) => setIntro(e.target.value)}
        />
      </label>
      {/* WHAT EACH PASSAGE SHOWS — and therefore what the export writes. BEHIND A
          DOOR EACH, which is the only thing 0074's arrangement got wrong: the
          three headings were already the right three questions, but drawn open
          they put twenty-three switches between the title box and the button that
          saves it. They are still a property of the anthology in the way its
          title is; they are simply not the thing you answer first. */}
      {/* WHERE IT FILLS FROM — under the introduction and above what it shows, which
          is the owner's own placement. It is the right one: the first two boxes say
          what this anthology IS, this says what goes in it, and the three below say
          how each passage is printed. That is the order somebody actually decides in.

          The same door shape as the three below it, because "a question wears the
          same chrome as its answer" and a reader who has learnt that a row here opens
          a popup should not meet a different control for the newest question. */}
      {isNew && (
        <button type="button" className="tp-group-door tactile" onClick={() => setRuling(true)}>
          <span className="min-w-0">
            <MonoLabel>{t('anthologies.fill.title')}</MonoLabel>
            <p className="microcopy mt-0.5">
              {fill?.rule
                ? t(fill.auto ? 'anthologies.fill.set.auto' : 'anthologies.fill.set', { what: fillSummary(fill) })
                : t('anthologies.fill.none')}
            </p>
          </span>
          <IconChevron />
        </button>
      )}
      {SWITCH_GROUPS.map((g) => (
        <GroupDoor key={g.key} group={g} flags={flags} onOpen={() => setGroup(g)} />
      ))}
      <ErrorText>{error}</ErrorText>
      <div className="flex items-center justify-end gap-2">
        <GhostButton type="button" onClick={onCancel}>
          {t('common.action.cancel.label')}
        </GhostButton>
        <button type="submit" className="tp-btn tp-btn-primary tactile" disabled={busy}>
          {busy ? t('common.action.save.busy') : submitLabel}
        </button>
      </div>
    </form>
    {group && (
      // KEYED ON THE GROUP so a second door opens a fresh draft rather than
      // re-seeding one in an effect — identityPicker's reasoning, and the same
      // symptom if it is skipped: for one frame the draft is the previous group's
      // and the tick flashes armed with a count of everything.
      <SwitchGroupDialog
        key={group.key}
        group={group}
        flags={flags}
        backTo={t(isNew ? 'anthologies.form.new.title' : 'anthologies.form.edit.title')}
        onApply={(next) => { setFlags(next); setGroup(null) }}
        onClose={() => setGroup(null)}
      />
    )}
    {ruling && (
      <FillFromDialog
        initial={fill}
        backTo={t('anthologies.form.new.title')}
        onApply={(next) => { setFill(next.rule ? next : null); setRuling(false) }}
        onClose={() => setRuling(false)}
      />
    )}
    </>
  )
}

// EntryNoteDialog — the reader's commentary on one entry, which alongside the order
// is the whole point of the feature.
//
// Its own endpoint and its own dialog because saving one paragraph must not resend
// the other twenty-nine. An empty note is a real value: clearing the box is how you
// take the commentary off again.
function EntryNoteDialog({ entry, onSave, onCancel }) {
  const [note, setNote] = useState(entry.note || '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function save() {
    setBusy(true)
    const msg = await onSave(entry, note)
    setBusy(false)
    if (msg) setError(msg)
  }

  return (
    <FormModal open title={t('anthologies.entry.note.title')} onClose={onCancel}>
      <div className="space-y-3">
        <p className="microcopy">{t('anthologies.entry.note.body')}</p>
        <label className="tp-field">
          <MonoLabel>{t('common.field.note.label')}</MonoLabel>
          <textarea
            className="tp-input"
            rows={5}
            value={note}
            maxLength={NOTE_MAX}
            placeholder={t('anthologies.entry.note.placeholder')}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        <ErrorText>{error}</ErrorText>
        <div className="flex items-center justify-end gap-2">
          <GhostButton type="button" onClick={onCancel}>
            {t('common.action.cancel.label')}
          </GhostButton>
          <button type="button" className="tp-btn tp-btn-primary tactile" disabled={busy} onClick={save}>
            {t(busy ? 'common.action.save.busy' : 'common.action.save.label')}
          </button>
        </div>
      </div>
    </FormModal>
  )
}

// DeleteAnthologyDialog — and it says what is actually lost, because this one is
// unusual twice over.
//
// IT DOES NOT GO TO THE BIN. Every other delete in this app answers with a trash id
// and an Undo; this is a hard delete, so the dialog is the only chance to stop. And
// what goes is the reader's OWN WRITING — the introduction and every entry's
// commentary — while the quotes themselves are untouched, because an anthology never
// owned them. Saying both halves is the difference between a confirm somebody can
// answer and a confirm they have to guess at.
export function DeleteAnthologyDialog({ anthology, onDone, onCancel }) {
  const [error, setError] = useState('')

  async function run() {
    const r = await json('DELETE', `/anthologies/${anthology.id}`)
    if (!r.ok) return setError(errText(r, t('error.delete.anthology')))
    toast(t('anthologies.toast.deleted'))
    await onDone()
  }

  return (
    <ConfirmDialog
      open
      title={t('anthologies.delete.confirm.title', { title: anthology.title })}
      confirmLabel={t('common.action.delete.label')}
      onConfirm={run}
      onCancel={onCancel}
      body={
        <div className="space-y-2">
          <p>
            {t('anthologies.delete.confirm.body', {
              count: anthology.entries,
              n: anthology.entries,
              noun: t('unit.entry', { count: anthology.entries }),
            })}
          </p>
          <p className="microcopy">{t('anthologies.delete.confirm.note')}</p>
          <ErrorText>{error}</ErrorText>
        </div>
      }
    />
  )
}

// AnthologyTile — one gathering. The count is the point of the tile, as it is on a
// board: it is what says which of these is a finished piece and which is a title
// somebody wrote down and never filled.
function AnthologyTile({ row, onOpen, onEdit, onDelete }) {
  return (
    <div className="board-tile">
      <button type="button" className="board-tile-face" onClick={() => onOpen(row.id)}>
        <span className="board-tile-name">{row.title}</span>
        <span className="board-tile-count">
          {t('common.count.phrase', { n: row.entries, noun: t('unit.entry', { count: row.entries }) })}
        </span>
        {row.intro && <span className="microcopy anthology-tile-intro">{row.intro}</span>}
      </button>
      <span className="board-tile-tools">
        <MoreMenu
          items={[
            { id: 'edit', icon: <IconEdit />, label: t('common.action.edit.label'), onClick: () => onEdit(row) },
            // Absent rather than dead in the read-only demo, which has no server to
            // stream a file from.
            ...(DEMO
              ? []
              : [
                  {
                    id: 'export',
                    icon: <IconExport />,
                    label: t('common.action.export.label'),
                    onClick: () => {
                      window.location.href = exportHref(row.id)
                    },
                  },
                ]),
            { id: 'delete', icon: <IconDelete />, label: t('common.action.delete.label'), danger: true, onClick: () => onDelete(row) },
          ]}
        />
      </span>
    </div>
  )
}

// AnthologyList — /anthologies itself.
function AnthologyList({ rows, reload, onOpen }) {
  const [editing, setEditing] = useState(null) // row | 'new'
  const [deleting, setDeleting] = useState(null)
  const [error, setError] = useState('')

  // One function for create and edit, switched on `editing`, exactly as the board
  // list does it. It returns an error STRING rather than throwing, because the form
  // renders the message beside its own fields.
  async function save(fields, { rule = '', auto = false } = {}) {
    const isNew = editing === 'new'
    const r = await json(isNew ? 'POST' : 'PUT', isNew ? '/anthologies' : `/anthologies/${editing.id}`, fields)
    if (!r.ok) return errText(r, t('error.save.anthology'))
    // THE FILL IS A SECOND CALL AND CAN ONLY BE ONE: neither route carries a rule,
    // and on a create the id does not exist until this response. `gatherInto` is
    // the same function the other three doors use — on an anthology that now
    // certainly exists, so it never takes the create branch here.
    //
    // `isNew` GATES IT AS WELL AS `rule`, which is belt and braces on purpose: the
    // form only draws the rule door when creating, so an edit hands back `''` — but
    // a future caller that passed one would otherwise re-fill on every rename, and
    // that failure is silent (`INSERT OR IGNORE` skips, the toast says "0 added").
    const id = isNew ? r.data?.id : editing.id
    if (isNew && rule && id) {
      const filled = await gatherInto({ id }, { rule, auto })
      if (!filled.ok) return filled.error
      toast(t('anthologies.rule.filled', { added: filled.added, skipped: filled.skipped }))
    }
    setEditing(null)
    await reload()
    return null
  }

  const count = (rows || []).length
  // The list has exactly one thing you can do to it, and the ⋯ says so rather
  // than being empty on this screen and full on the next one.
  useScreenBar({
    actions: () => [
      { id: 'h-do', heading: t('common.mono.actions.label') },
      { id: 'new', icon: <IconPlus />, label: t('anthologies.list.new.label'), onClick: () => setEditing('new') },
    ],
  })
  return (
    <section>
      <PageHeader
        title={t('nav.tab.anthologies.label')}
        counts={t('common.count.phrase', { n: count, noun: t('unit.anthology', { count }) })}
        right={
          <GhostButton icon={<IconPlus />} onClick={() => setEditing('new')}>
            {t('anthologies.list.new.label')}
          </GhostButton>
        }
      />
      <ErrorText>{error}</ErrorText>

      <div className="board-grid">
        {(rows || []).map((row) => (
          <AnthologyTile key={row.id} row={row} onOpen={onOpen} onEdit={setEditing} onDelete={setDeleting} />
        ))}
      </div>

      {rows != null && rows.length === 0 && (
        <Card className="mt-4">
          {/* The empty state names the way IN rather than reporting that the list
              is empty. Nothing on this screen can add an entry, so somebody who
              made an anthology here and stopped would be looking for a control
              that is on a different screen by design. */}
          <p className="microcopy">
            {tNodes('anthologies.list.empty', {
              em1: <b key="em1">{t('anthologies.list.new.label')}</b>,
              em2: <b key="em2">{t('common.action.anthology.label')}</b>,
            })}
          </p>
        </Card>
      )}

      {editing && (
        <FormModal
          open
          title={t(editing === 'new' ? 'anthologies.form.new.title' : 'anthologies.form.edit.title')}
          onClose={() => setEditing(null)}
        >
          <AnthologyForm
            initial={editing === 'new' ? null : editing}
            onSubmit={save}
            onCancel={() => setEditing(null)}
            submitLabel={t(editing === 'new' ? 'common.action.create.label' : 'common.action.save.label')}
          />
        </FormModal>
      )}
      {deleting && (
        <DeleteAnthologyDialog
          anthology={deleting}
          onCancel={() => setDeleting(null)}
          onDone={async () => {
            setDeleting(null)
            setError('')
            await reload()
          }}
        />
      )}
    </section>
  )
}

// AnthologyEntry — one passage, as it reads.
//
// The reader's note comes FIRST and the quote second, which is the shape of the
// export and the shape of every anthology ever printed: the editor introduces the
// ---------------------------------------------------------------------------
// locatorOf is the entry's "where", with a standalone quote's KIND on the end of
// it.
//
// The server sends the locator already joined — it is built from whichever kind
// the entry happens to be — and sends the quote's kind separately as a MACHINE
// value, because the word for it belongs to the screen and exists in two
// languages. So the joining of those two happens here, and only here.
//
// A quote with no kind has its old free-text `medium` inside the locator already
// (the server puts it there instead), which is the same fallback quoteKindMeta
// gives the cards: a value the 0053 upgrade could not read stays visible as work
// to do rather than disappearing with the field that held it.
function locatorOf(entry) {
  return [entry.locator, quoteKindLabel(entry.quote_kind)].filter(Boolean).join(' · ')
}
// ---------------------------------------------------------------------------

// piece and then the piece speaks. The attribution sits under it, and where the
// quote has a parent work the credit is a doorway into it — a CONTENT LINK, so it
// is never gated on which sections are switched on.
function AnthologyEntry({ entry, fields = {}, first, last, onNote, onMove, onRemove, onOpenBook, onOpenMovie }) {
  const openWork =
    entry.work_id && entry.kind === 'book'
      ? onOpenBook
      : entry.work_id && entry.kind === 'screen'
        ? onOpenMovie
        : null
  return (
    <Card className="mt-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {!fields.hide_commentary && entry.note && <p className="anthology-prose">{entry.note}</p>}
          {/* THE COLOUR BAR IS A NOTE TO YOURSELF, not to a reader — which is why it
              is one of the six switches. Hidden, the bar takes the neutral rule the
              card would have had anyway rather than disappearing and leaving the
              passage unmarked. */}
          {/* THE ENTRY'S OWN LANGUAGE. An anthology is a page of quotes and this
              is one of them — the last surface in the app that was still drawing
              a reader's German in the display face. */}
          <blockquote
            className={`anthology-quote ${languageClass(entry.language)}`.trim()}
            style={{ '--entry-color': fields.hide_colour ? 'var(--line)' : categoryVar(entry.color) }}
          >
            {entry.quote}
          </blockquote>
          {/* THE ATTRIBUTION LINE, and it can now be nothing at all. With the credit
              and the source both switched off there is no line rather than an empty
              one — a reader who turned both off asked for a document of passages, and
              a stray separator would be the feature failing visibly. */}
          {(!fields.hide_credit || !fields.hide_source) && (
            <p className="microcopy mt-1.5">
              {/* One key holds the whole line, separator and all, so another language
                  can put the source first or punctuate it differently. The two
                  single-value keys are what a half-hidden line uses, so the
                  separator never appears with nothing on one side of it. */}
              {fields.hide_source
                ? t('anthologies.entry.credit.label', { credit: entry.credit || t('anthologies.entry.unattributed.label') })
                : fields.hide_credit
                  ? tNodes('anthologies.entry.source.label', {
                    source: openWork ? (
                      <button key="source" type="button" className="tp-link" onClick={() => openWork(entry.work_id)}>
                        {entry.source}
                      </button>
                    ) : (
                      entry.source
                    ),
                  })
                  : tNodes(entry.source ? 'anthologies.entry.credit-source.label' : 'anthologies.entry.credit.label', {
                    credit: entry.credit || t('anthologies.entry.unattributed.label'),
                    source: openWork ? (
                      <button key="source" type="button" className="tp-link" onClick={() => openWork(entry.work_id)}>
                        {entry.source}
                      </button>
                    ) : (
                      entry.source
                    ),
                  })}
            </p>
          )}
          {/* Off by default, both of them: an anthology that has never been
              configured reads exactly as it did before these switches existed. */}
          {(fields.show_locator && locatorOf(entry)) || (fields.show_date && entry.date) ? (
            <p className="microcopy mt-1 opacity-80">
              {[fields.show_locator ? locatorOf(entry) : '', fields.show_date ? entry.date : '']
                .filter(Boolean)
                .join(' · ')}
            </p>
          ) : null}
          {/* WHAT THE WORK KNOWS (0074), on its own line under the attribution.
              0045's rule is that what you SEE when you read an anthology is what you
              GET when you export it, so this line and the bindings the export writes
              are driven by the same list in the same order — WORK_SWITCHES. An entry
              whose work has none of the chosen fields draws no line at all rather
              than an empty one, which is the same rule the attribution above follows
              when both its halves are switched off. */}
          {workLine(entry, fields.fields) ? (
            <p className="microcopy mt-1 opacity-80">{workLine(entry, fields.fields)}</p>
          ) : null}
          {/* AND WHO IS ANSWERABLE FOR IT. Absent for most entries, because a
              `people` row exists only where somebody looked the name up — which is
              why this draws nothing rather than an empty line or a placeholder. */}
          {personLine(entry, fields.fields) ? (
            <p className="microcopy mt-1 opacity-80">{personLine(entry, fields.fields)}</p>
          ) : null}
          {/* THE FACES. `alt=""` and not a name: the name is already in the
              attribution line above, so a screen reader that announced it here
              would read it twice — the picture is decoration beside a credit that
              is already text. A fixed em height rather than px, because this box
              holds no text but sits in a column that scales. */}
          {portraitsOf(entry, fields.fields).map((file) => (
            <img
              key={file}
              src={apiURL(`/covers/${file}`)}
              alt=""
              className="mt-1.5 rounded-md object-cover"
              style={{ height: '4.5em', width: 'auto' }}
            />
          ))}
          {/* The QUOTE's own note, which is a different thing from the entry's and
              can be non-empty at the same time: one is what the reader wrote when
              they saved the line, the other is what they wrote when they placed it
              here. Shown quietly, under the credit, so the two never read as one
              paragraph. */}
          {entry.quote_note && <p className="microcopy mt-1 opacity-80">{entry.quote_note}</p>}
        </div>
        <MoreMenu
          ariaLabel={t('anthologies.entry.more.aria')}
          items={[
            {
              id: 'note',
              icon: <IconEdit />,
              label: t(entry.note ? 'anthologies.entry.note.edit.label' : 'anthologies.entry.note.add.label'),
              onClick: () => onNote(entry),
            },
            // MOVE UP / MOVE DOWN, AND NO DRAG. The order is the feature, so it has
            // to be changeable — but a drag has no keyboard equivalent and a menu
            // item is reachable by tab, by arrow key and by a thumb. The item at an
            // end is OMITTED rather than greyed: a disabled row in a menu is a thing
            // to wonder about.
            ...(first ? [] : [{ id: 'up', icon: <IconChevron open />, label: t('common.action.move-up.label'), onClick: () => onMove(entry, 'up') }]),
            ...(last ? [] : [{ id: 'down', icon: <IconChevron />, label: t('common.action.move-down.label'), onClick: () => onMove(entry, 'down') }]),
            { id: 'remove', icon: <IconDelete />, label: t('common.action.remove.label'), danger: true, onClick: () => onRemove(entry) },
          ]}
        />
      </div>
    </Card>
  )
}

// AnthologyPage — /anthologies/{id}, the thing being read.
function AnthologyPage({ id, onClose, onDeleted, onOpenBook, onOpenMovie }) {
  const [anthology, setAnthology] = useState(null)
  const [entries, setEntries] = useState(null)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [noting, setNoting] = useState(null)
  const [ruling, setRuling] = useState(false)
  // KEEP IT FED (0075), and it is a COUNT rather than an ARRIVAL — see the effect
  // below for why the plan's own two sentences could not both ship.
  const [waiting, setWaiting] = useState(null)
  const [filling, setFilling] = useState(false)
  // A THEMED ROUND OVER THIS ANTHOLOGY. The engine has taken ?anthology= since
  // 0043 — it narrows the deck by a join on anthology_entries and excludes no
  // kind, so a mixed anthology practises as one deck — and for two releases there
  // was no way to ask for it: themeQuery never put the parameter in the URL and no
  // screen had the button. A feature the reader cannot reach is not shipped.
  const { practise, practiceDialog } = usePractice()

  const reload = useCallback(async () => {
    const r = await json('GET', `/anthologies/${id}`)
    if (!r.ok) return setError(errText(r, t('error.open.anthology')))
    setAnthology(r.data.anthology || null)
    // AS THE SERVER SENT THEM. The order is the anthology, it is computed from
    // stored positions, and re-sorting here would be this screen having a second
    // opinion about it.
    setEntries(r.data.entries || [])
    setError('')
  }, [id])
  useEffect(() => {
    reload()
  }, [reload])

  // "KEEP IT FED" ASKS ON OPEN AND CHANGES NOTHING, which is a departure from the
  // plan's first sentence and an obedience to its second.
  //
  // It reads "run the fill and append anything new", and then, one clause later,
  // "the count as a control the reader presses RATHER THAN a change that happened
  // while they were not looking". Those are two designs. This is the second, for
  // two reasons:
  //
  //   APPENDING ON OPEN IS A WRITE ON A READ. Opening an anthology is a GET, and
  //   making it insert rows makes it non-idempotent — a prefetch, a back button or
  //   a second tab performs it again. Harmless under INSERT OR IGNORE and still a
  //   write nobody asked for on a path nobody thinks of as a write.
  //
  //   AND IT IS EXACTLY THE THING THE NEXT CLAUSE WARNS ABOUT. An anthology that
  //   grew by twelve entries because you looked at it is a change that happened
  //   while you were not looking, however welcome the twelve are.
  //
  // So the screen asks what a fill WOULD take — the preview that already exists, no
  // new endpoint — and draws the number as a control. Nothing moves until it is
  // pressed.
  useEffect(() => {
    let live = true
    setWaiting(null)
    if (!anthology?.rule || !anthology?.rule_auto) return undefined
    json('POST', `/anthologies/${id}/fill`, { rule: anthology.rule, auto: true, preview: true })
      .then((r) => {
        // A FAILED CHECK IS SILENT. This is a background question the reader did
        // not ask; an error banner over an anthology that opened perfectly well
        // would be the screen reporting its own housekeeping as their problem.
        if (live && r.ok && r.data.added > 0) setWaiting(r.data)
      })
      .catch(() => {})
    return () => { live = false }
  }, [id, anthology?.rule, anthology?.rule_auto])

  // takeWaiting runs the fill the count was measured from. THE SAME RULE, because
  // the count came from a preview of that rule and pressing a number that then took
  // a different set would be the screen lying at the one moment it was specific.
  async function takeWaiting() {
    setFilling(true)
    const r = await json('POST', `/anthologies/${id}/fill`, { rule: anthology.rule, auto: true })
    setFilling(false)
    if (!r.ok) return setError(errText(r))
    setWaiting(null)
    toast(t('anthologies.rule.filled', { added: r.data.added, skipped: r.data.skipped }))
    await reload()
  }

  // NO RULE ARGUMENT HERE, and its absence is the point. This screen's form is the
  // EDIT one, which does not draw the rule door — an anthology that exists has that
  // door in this page's own ⋯, where it can also preview. A `{ rule }` parameter
  // here would be dead code that reads like a feature.
  async function save(fields) {
    const r = await json('PUT', `/anthologies/${id}`, fields)
    if (!r.ok) return errText(r, t('error.save.anthology'))
    setEditing(false)
    await reload()
    return null
  }

  async function saveNote(entry, note) {
    const r = await json('PUT', `/anthologies/${id}/entries`, { ...entryRef(entry), note })
    if (!r.ok) return errText(r, t('error.save.note'))
    setNoting(null)
    await reload()
    return null
  }

  async function remove(entry) {
    const r = await json('DELETE', `/anthologies/${id}/entries/${entry.kind}/${entry.item_id}`)
    if (!r.ok) return setError(errText(r, t('error.remove.entry')))
    toast(t('anthologies.toast.entry-removed'))
    await reload()
  }

  // `after` is the entry the moved one should FOLLOW, and null means first. THE
  // SERVER COMPUTES THE POSITION — a client that sent one would be inventing a
  // number the server may renumber out from under it — so this sends neighbours and
  // re-reads the whole list afterwards.
  async function move(entry, dir) {
    const rows = entries || []
    const i = rows.findIndex((e) => sameEntry(e, entry))
    if (i < 0) return
    const after = dir === 'up' ? rows[i - 2] || null : rows[i + 1]
    if (dir === 'up' && i === 0) return
    if (dir === 'down' && !after) return
    const r = await json('POST', `/anthologies/${id}/order`, {
      ...entryRef(entry),
      after: after ? entryRef(after) : null,
    })
    if (!r.ok) return setError(errText(r, t('error.move.entry')))
    await reload()
  }

  const rows = entries || []
  // THE SAME FOUR THE HEADER ROW DRAWS, and deliberately the same four rather
  // than a different set: the ⋯ is a menu bar, so it lists what the screen can do
  // whether or not the control is also on the page. Practise is disabled there by
  // being ABSENT here — a menu row cannot be greyed, and a round over an empty
  // anthology is the one case the dialog can only answer with "nothing here".
  useScreenBar({
    actions: () => [
      { id: 'h-do', heading: t('common.mono.actions.label') },
      ...(anthology && rows.length > 0
        ? [{ id: 'practise', icon: <IconPractise />, label: t('common.action.practise.label'), onClick: () => practise({ anthology: id, label: anthology?.title || t('anthologies.read.title.fallback') }) }]
        : []),
      ...(anthology ? [{ id: 'edit', icon: <IconEdit />, label: t('common.action.edit.label'), onClick: () => setEditing(true) }] : []),
      ...(DEMO ? [] : [{ id: 'export', icon: <IconExport />, label: t('common.action.export.label'), onClick: () => { window.location.href = exportHref(id) } }]),
      ...(DEMO ? [] : [{ id: 'epub', icon: <IconReading />, label: t('anthologies.action.epub.label'), onClick: () => { window.location.href = epubHref(id) } }]),
      // PRINT IS NOT IN THE SHARE FAMILY and is next to Export rather than in it.
      // Export hands over a file the server wrote; this opens the browser's own
      // print dialog, from which the reader chooses paper or a PDF. There is no
      // PDF endpoint by construction — see the print stylesheet's note — and
      // putting it in a menu of file formats without a word would imply one.
      ...(anthology ? [{ id: 'print', icon: <IconPrint />, label: t('common.action.print.label'), onClick: () => window.print() }] : []),
      // THE RULE LIVES IN THE MENU AND NOT IN THE HEADER ROW, which already has
      // five controls. It is also the one of them a reader touches once and then
      // rarely — a rule is set, not used — so it does not earn a permanent button
      // beside the four verbs that are used every time this screen is open.
      ...(anthology ? [{ id: 'rule', icon: <IconSearch />, label: t('anthologies.rule.title'), onClick: () => setRuling(true) }] : []),
      ...(anthology ? [{ id: 'delete', icon: <IconDelete />, label: t('common.action.delete.label'), onClick: () => setDeleting(true), danger: true }] : []),
    ],
  })
  return (
    <section className="anthology-read">
      {/* The way back, drawn unconditionally. A detail view takes the phone's top
          bar away, so this is the only way back on a phone and it cannot be a
          desktop-only nicety. */}
      {/* `.no-print` HERE AND ON THE HEADER'S BUTTONS, not on the header: the
          title and the count are the document's, and only the controls beside
          them are furniture. The shell cannot make that distinction — it does not
          know a Back button from a heading — which is why the class is applied by
          the screen that does. */}
      <div className="mb-3 no-print">
        <GhostButton icon={<IconBack />} onClick={onClose}>
          {t('anthologies.read.back.label')}
        </GhostButton>
      </div>
      <PageHeader
        title={anthology?.title || t('anthologies.read.title.fallback')}
        counts={entries ? t('common.count.phrase', { n: rows.length, noun: t('unit.entry', { count: rows.length }) }) : ''}
        right={
          <span className="flex items-center gap-2 no-print">
            {/* Before Edit, because reading it back is what you do with an
                anthology and editing it is what you do to one. Disabled while it
                is empty: a round over nothing is the one case the dialog can only
                answer with "nothing here". */}
            <GhostButton
              icon={<IconPractise />}
              onClick={() => practise({ anthology: id, label: anthology?.title || t('anthologies.read.title.fallback') })}
              disabled={!anthology || rows.length === 0}
            >
              {t('common.action.practise.label')}
            </GhostButton>
            <GhostButton icon={<IconEdit />} onClick={() => setEditing(true)} disabled={!anthology}>
              {t('common.action.edit.label')}
            </GhostButton>
            {/* THE RULE HAS A BUTTON NOW, AND THE ARGUMENT AGAINST ONE IS KEPT
                BECAUSE IT WAS REASONABLE. It said: the rule "lives in the menu and
                not in the header row, which already has five controls. It is also
                the one of them a reader touches once and then rarely — a rule is
                set, not used — so it does not earn a permanent button beside the
                four verbs that are used every time this screen is open."

                Every clause of that is true and the conclusion still failed, which
                is the useful part. The owner: "I cannot see any auto-anthology or
                export options. Where are those?" A control touched once has to be
                FOUND once, and a reader who has never set a rule has never seen the
                menu entry either — the only other sign of the feature is the "12
                new" line below, which draws only when a rule already exists and has
                already matched something. So the whole feature was invisible to
                exactly the reader it was for.

                Beside Edit because it is the same kind of verb: both change what
                this anthology IS rather than doing something with what it holds. */}
            <GhostButton icon={<IconSearch />} onClick={() => setRuling(true)} disabled={!anthology}>
              {t('anthologies.rule.title')}
            </GhostButton>
            {!DEMO && (
              <GhostButton
                icon={<IconExport />}
                onClick={() => {
                  window.location.href = exportHref(id)
                }}
              >
                {t('common.action.export.label')}
              </GhostButton>
            )}
            {/* A BOOK GLYPH AND NOT A SECOND DOWNWARD ARROW. Beside Export it would
                be two identical pictures for two different files; what distinguishes
                this one is not that it downloads but WHAT it hands you — something an
                e-reader opens. The label carries the format's name for the same
                reason: "Export" twice would be the screen saying one thing twice. */}
            {!DEMO && (
              <GhostButton
                icon={<IconReading />}
                onClick={() => {
                  window.location.href = epubHref(id)
                }}
              >
                {t('anthologies.action.epub.label')}
              </GhostButton>
            )}
            <GhostButton icon={<IconPrint />} onClick={() => window.print()} disabled={!anthology}>
              {t('common.action.print.label')}
            </GhostButton>
            <GhostButton icon={<IconDelete />} onClick={() => setDeleting(true)} disabled={!anthology}>
              {t('common.action.delete.label')}
            </GhostButton>
          </span>
        }
      />
      <ErrorText>{error}</ErrorText>

      {/* THE COUNT IS THE CONTROL. Not a banner with a button beside it: the number
          IS what you press, because the only thing to do with "12 new" is take them.
          `.no-print` because it is furniture — a printed anthology is the document,
          and an offer to change it is not part of the document. */}
      {waiting && (
        <div className="mt-2 no-print">
          <GhostButton icon={<IconPlus />} onClick={takeWaiting} disabled={filling}>
            {t('anthologies.rule.waiting', { n: waiting.added })}
          </GhostButton>
        </div>
      )}

      {anthology?.intro && (
        <Card className="mt-2">
          <p className="anthology-prose">{anthology.intro}</p>
        </Card>
      )}

      {rows.map((entry, i) => (
        <AnthologyEntry
          key={`${entry.kind}:${entry.item_id}`}
          entry={entry}
          fields={anthology || {}}
          first={i === 0}
          last={i === rows.length - 1}
          onNote={setNoting}
          onMove={move}
          onRemove={remove}
          onOpenBook={onOpenBook}
          onOpenMovie={onOpenMovie}
        />
      ))}

      {entries != null && rows.length === 0 && (
        <Card className="mt-3">
          <p className="microcopy">
            {tNodes('anthologies.read.empty', {
              em1: <b key="em1">{t('common.action.anthology.label')}</b>,
            })}
          </p>
        </Card>
      )}

      {editing && anthology && (
        <FormModal open title={t('anthologies.form.edit.title')} onClose={() => setEditing(false)}>
          <AnthologyForm
            initial={anthology}
            onSubmit={save}
            onCancel={() => setEditing(false)}
            submitLabel={t('common.action.save.label')}
          />
        </FormModal>
      )}
      {ruling && anthology && (
        <RuleDialog
          anthology={anthology}
          onClose={() => setRuling(false)}
          onFilled={(res) => {
            setRuling(false)
            // THE TOAST CARRIES THE NUMBERS because the screen behind it is about to
            // change by that much, and a reader who pressed Fill over an anthology
            // of two hundred cannot count what arrived.
            toast(t('anthologies.rule.filled', { added: res.added, skipped: res.skipped }))
            reload()
          }}
        />
      )}
      {noting && <EntryNoteDialog entry={noting} onSave={saveNote} onCancel={() => setNoting(null)} />}
      {/* The round belongs to this page and unmounts with it — usePractice is a
          hook rather than a global for exactly that reason: a round left running
          behind a screen the reader navigated away from would keep posting grades
          against a schedule they thought they had stopped touching. */}
      {practiceDialog}
      {deleting && anthology && (
        <DeleteAnthologyDialog
          anthology={anthology}
          onCancel={() => setDeleting(false)}
          onDone={async () => {
            setDeleting(false)
            // The thing this page was is gone, so the page cannot stay: hand the
            // reader back to the list rather than leaving them on a 404.
            await onDeleted()
          }}
        />
      )}
    </section>
  )
}

// AnthologiesPage — the two levels, switched on the id in the URL. The detail view
// is keyed by id so opening a second anthology remounts rather than showing the
// first one's entries under the second one's title.
export default function AnthologiesPage({ openId = null, onOpen, onClose, onOpenBook, onOpenMovie }) {
  const { rows, error, reload } = useAnthologies()
  if (openId == null) {
    return (
      <>
        <ErrorText>{error}</ErrorText>
        <AnthologyList rows={rows} reload={reload} onOpen={onOpen} />
      </>
    )
  }
  return (
    <AnthologyPage
      key={String(openId)}
      id={openId}
      onClose={onClose}
      onDeleted={async () => {
        await reload()
        onClose?.()
      }}
      onOpenBook={onOpenBook}
      onOpenMovie={onOpenMovie}
    />
  )
}
