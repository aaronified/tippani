import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { coverImgURL, json, errText } from './api.js'
import {
  addChip,
  chipText,
  FACET_FIELDS,
  FACET_MENU_PAGE,
  facetOptions,
  liftFacet,
  makeChip,
  narrowFacetOptions,
  readSearchBox,
  removeChipAt,
  sameChip,
  searchQueryString,
} from './facets.js'
import { t, tNodes } from './i18n.js'
import { quoteKindMeta } from './quoteKind.js'
import { AnnotationCard, annotationState, annDate, fmtDate } from './Library.jsx'
import { Frame, dialogueState } from './Movies.jsx'
import { UtteranceForm, utteranceMeta, utteranceState } from './Quotes.jsx'
import { ShareDialog, bookShare, copyQuote, movieShare, quoteShare } from './share.jsx'
import { deleteWithUndo } from './undo.jsx'
import { BULK_FIELDS, BULK_TAGS, bulkActionsFor } from './actions.jsx'
import { CharacterFaces, CreditFaces, PersonCredit, PersonModal, PersonPortrait, parseCreditSeps, splitCredits, usePeople } from './people.jsx'
import { groupWorks } from './works.jsx'
import { useStickers } from './stickers.jsx'
import { categoryVar } from './theme.js'
import { chapterLabel, episodeLabel } from './text.js'
import {
  BulkBar,
  CloseButton,
  EmptyState,
  ErrorText,
  FilterChip,
  formatPartialDate,
  FormModal,
  GhostButton,
  HandCard,
  HandNote,
  HighlightSpan,
  IconBooks,
  IconClose,
  IconDialogue,
  IconFilter,
  IconHighlight,
  IconOpen,
  IconQuote,
  IconReel,
  IconSearch,
  Masonry,
  MonoLabel,
  Placeholder,
  QuizSkipMark,
  Select,
  skipReason,
  SortableTh,
  splitCommas,
  Tooltip,
  useAnchoredPosition,
  useColumnsAt,
  useDismiss,
  useIsMobileScreen,
  usePersistedState,
  useSort,
  ViewToggle,
  useBodyScrollLock,
} from './ui.jsx'

// ---- the vocabulary, fetched once and held for the session ------------------
//
// ONE REQUEST, NOT ONE PER KEYSTROKE. A personal library's vocabulary is a few
// hundred names — small enough to filter in the browser and far too small to be
// worth a round trip behind every character typed into a box that is already a
// typeahead over the whole library.
//
// The cache is at MODULE scope rather than in the hook, so leaving Search and
// coming back does not re-fetch, and the two places that will want this (the
// box, and the filter sheets) share one copy. `pending` deduplicates the case
// that actually happens: two components focusing in the same tick.
let vocabCache = null
let vocabPending = null

export function primeSearchVocabulary() {
  if (vocabCache) return Promise.resolve(vocabCache)
  if (!vocabPending) {
    vocabPending = json('GET', '/search/vocabulary').then((r) => {
      vocabPending = null
      // A vocabulary that would not load is an empty dropdown, never a broken
      // search box: the grammar still parses and the chips still work, you just
      // do not get offered the values.
      if (r.ok && r.data) vocabCache = r.data
      return vocabCache || {}
    })
  }
  return vocabPending
}

// useSearchVocabulary fetches on FIRST FOCUS rather than on mount, so opening
// the Search screen to read your last results costs nothing.
function useSearchVocabulary() {
  const [vocab, setVocab] = useState(vocabCache || {})
  const asked = useRef(false)
  const load = () => {
    if (asked.current) return
    asked.current = true
    primeSearchVocabulary().then(setVocab)
  }
  return [vocab, load]
}

// SCOPES — where to look, and what each one looks like.
//
// EVERY CHIP CARRIES A GLYPH EXCEPT `All`, which carries `keepLabel` instead. On a
// phone this row is six controls above a search box on a 320px screen, and six
// words do not fit — so the chips lose their words to the same preference every
// other button in the app answers (Settings → Appearance → Button labels, auto by
// screen width). `All` is the default and the way back, and a glyph is a thing you
// have to have learned already; three characters are cheaper than that.
//
// Books and Movies borrow the Library and Catalogue tabs' own glyphs, so the scope
// looks like the screen it searches. Quotes borrows the Quotes tab's. The two
// quote kinds that have no tab — a book's annotation, a film's line — are the two
// new drawings: a page with a marker's nib, and two bubbles.
const SCOPES = [
  ['all', t('search.scope.all.label'), null, true],
  ['books', t('search.scope.books.label'), <IconBooks />],
  ['annotations', t('search.scope.annotations.label'), <IconHighlight />],
  ['movies', t('search.scope.movies.label'), <IconReel />],
  ['dialogues', t('search.scope.dialogues.label'), <IconDialogue />],
  ['quotes', t('search.scope.quotes.label'), <IconQuote />],
]

// Which SECTION each chip searches, so the row answers the same Features switches
// the nav strip does (Settings → Features). A section holds two chips wherever the
// work and its quotes are separate kinds: hiding the Library takes Books AND
// Annotations, because a highlight is a thing inside a book.
//
// `all` maps to nothing and never goes: it is the default and the way back, and
// with a section hidden it is also the honest answer — searching everything still
// FINDS rows in that section, because hiding removes doors and not data. What it
// no longer offers is a chip inviting the reader to narrow to a screen they have
// switched off.
const SCOPE_SECTION = {
  books: 'library',
  annotations: 'library',
  movies: 'movies',
  dialogues: 'movies',
  quotes: 'quotes',
}

// SearchBox — the free-text field, the facet dropdown, and the chips beneath.
//
// THE BOX HOLDS FREE TEXT. Typing a known field name and a colon opens the
// value dropdown; choosing a value LIFTS THE TOKEN OUT OF THE BOX INTO A CHIP,
// exactly as TokenInput already lifts a typed tag into a pill. So `field:value`
// is a typing affordance, not a wire format — the chips are what get sent, one
// query parameter each.
//
// The dropdown is the only new interaction on this screen, and it is deliberately
// the one readers already know: same anchored portal, same `.token-menu` skin,
// same arrow-keys-and-Enter as the tag fields on every edit form.
export function SearchBox({ q, setQ, chips, setChips, mobile, draft, options, onFirstFocus }) {
  const [open, setOpen] = useState(false)
  const [hi, setHi] = useState(0)
  // How many of the ranked options are on show. FACET_MENU_PAGE at a time, and
  // it RESETS whenever the question changes — paging to twenty titles and then
  // typing a letter must not leave twenty of a different list on screen.
  const [shown, setShown] = useState(FACET_MENU_PAGE)
  const draftKey = draft ? `${draft.field}:${draft.value}` : ''
  useEffect(() => { setShown(FACET_MENU_PAGE) }, [draftKey])
  const boxRef = useRef(null)
  const inputRef = useRef(null)

  // The draft and its options are computed by the PAGE and handed down, not
  // worked out here. They used to be local, and the page recomputed the draft
  // separately to decide what to search — two answers to one question, which
  // diverged exactly where it mattered: a draft with no options to offer opened
  // no menu here while still being stripped out of the query there, so typing
  // `book: a novel` searched for nothing at all and the screen said "type to
  // search" over a box that visibly had text in it.
  //
  // The menu opens only when there is something to offer, and the positioning
  // hook has to agree with that or it measures an element never rendered.
  const menuOpen = open && !!draft && options.length > 0
  const { popRef, style } = useAnchoredPosition(menuOpen, boxRef, { matchWidth: true, minHeight: 120 })
  useDismiss(menuOpen, () => setOpen(false), [boxRef, popRef], { event: 'pointerdown' })

  const pick = (opt) => {
    setChips((cs) => addChip(cs, makeChip(draft.field, opt)))
    setQ(liftFacet(q, draft))
    setHi(0)
    setOpen(false)
    inputRef.current?.focus()
  }

  // The visible page, and the keyboard is bounded by IT rather than by the whole
  // ranked list — arrowing past the last visible row would otherwise highlight
  // something nobody can see. Instead it reveals the next page, which is the
  // same gesture as pressing More and one the hands already know.
  const page = options.slice(0, shown)
  const hasMore = options.length > shown
  const more = () => setShown((n) => n + FACET_MENU_PAGE)

  const onKey = (e) => {
    if (menuOpen && (e.key === 'Enter' || e.key === 'Tab')) {
      e.preventDefault()
      pick(page[hi] || page[0])
    } else if (menuOpen && e.key === 'ArrowDown') {
      e.preventDefault()
      if (hi === page.length - 1 && hasMore) more()
      setHi((h) => Math.min(h + 1, (hasMore ? page.length : page.length - 1)))
    } else if (menuOpen && e.key === 'ArrowUp') {
      e.preventDefault()
      setHi((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Escape') {
      setOpen(false)
    } else if (e.key === 'Backspace' && !q && chips.length) {
      // The TokenInput gesture, because this is the same gesture: backspace on
      // an empty field takes back the last thing you added.
      setChips((cs) => removeChipAt(cs, cs.length - 1))
    }
  }

  return (
    <div className="space-y-3">
      <div ref={boxRef}>
        <input
          ref={inputRef}
          className="tp-input"
          // lineHeight:1 tightens the display serif's tall line box so the UA
          // centres the glyphs in the field instead of seating them high.
          style={
            mobile
              ? { fontFamily: 'var(--font-display)', fontWeight: 'var(--font-display-weight)', fontStyle: 'var(--font-display-style)', fontVariantCaps: 'var(--font-display-caps)', textTransform: 'var(--font-display-case)', fontVariantNumeric: 'var(--font-display-figures)', fontSize: 'var(--type-display-19)', lineHeight: 1, padding: '10px 14px', width: '100%' }
              : { fontFamily: 'var(--font-display)', fontWeight: 'var(--font-display-weight)', fontStyle: 'var(--font-display-style)', fontVariantCaps: 'var(--font-display-caps)', textTransform: 'var(--font-display-case)', fontVariantNumeric: 'var(--font-display-figures)', fontSize: 'var(--type-display-19)', lineHeight: 1, padding: '14px 18px', width: '100%' }
          }
          placeholder={t('search.box.placeholder')}
          value={q}
          autoFocus
          autoComplete="off"
          aria-label={t('search.box.aria')}
          onChange={(e) => {
            setQ(e.target.value)
            setOpen(true)
            setHi(0)
          }}
          onFocus={() => {
            setOpen(true)
            onFirstFocus?.()
          }}
          onKeyDown={onKey}
        />
      </div>
      {menuOpen && createPortal(
        <ul ref={popRef} className="token-menu" style={style}>
          {page.map((o, i) => (
            <li key={`${draft.field}:${o.value}`}>
              <button
                type="button"
                className={'token-opt' + (i === hi ? ' hi' : '')}
                onMouseEnter={() => setHi(i)}
                onClick={() => pick(o)}
              >
                {draft.field}:{o.label}
              </button>
            </li>
          ))}
          {hasMore && (
            <li>
              {/* onMouseDown, not onClick. The dismiss handler listens on
                  pointerdown, so a click here would close the menu out from
                  under the button before its own handler ran — the menu would
                  simply vanish on the one press that is supposed to grow it. */}
              <button
                type="button"
                className="token-opt token-more"
                onMouseDown={(e) => { e.preventDefault(); more() }}
              >
                {t('search.box.more.label', { n: options.length - shown })}
              </button>
            </li>
          )}
        </ul>,
        document.body,
      )}
      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2" data-testid="facet-chips">
          {chips.map((c, i) => (
            <span key={`${c.field}:${c.value}`} className="token-pill">
              {chipText(c)}
              <Tooltip label={t('search.chip.remove.tip', { field: c.field })}>
                <button
                  type="button"
                  className="token-x"
                  onClick={() => setChips((cs) => removeChipAt(cs, i))}
                  aria-label={t('search.chip.remove.aria', { name: chipText(c) })}
                >
                  ×
                </button>
              </Tooltip>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ---- the Filters panel ------------------------------------------------------
//
// THE FACETS SHIPPED IN 1.10.0. A WAY TO FIND THEM DID NOT, and that is the
// whole of this component.
//
// Everything else was already there — the grammar, the dropdown, the chips, the
// vocabulary endpoint, the SQL. The only thing on screen that said so was one
// placeholder string, `Search, or type tag: author: colour:…`, which is visible
// until you type a single character and then gone. Using facets required having
// read that line, remembered it, inferred that the trailing `…` meant there were
// more fields than the three named, and guessed which. On a phone it sat over a
// keyboard that had just covered half the screen, with no tab key to complete
// with. So the honest description of the feature was: a faceted search only its
// author could operate.
//
// IT ADDS CHIPS. IT DOES NOT ADD A SECOND GRAMMAR. Every value here goes through
// the same addFacet the typed dropdown uses, so a chip built by pressing is
// indistinguishable from a chip built by typing — same wire value, same URL
// parameter, same persistence. A panel that assembled its own query object is
// precisely the drift facets.js exists to prevent.
//
// THE FIELD LIST IS FACET_FIELDS, not a copy of it. `book` and `movie` carry
// `typed: false` because there is no vocabulary of titles to offer; they stay
// out of the panel through that same flag rather than through a second decision
// that could drift from the first. Adding a field to the grammar adds it here.
function FacetPanel({ vocabulary, chips, querystring, onAdd, onRemove, onClear, onClose }) {
  // The counts, fetched when the panel opens and again whenever the narrowing
  // moves. Their own endpoint, because they are about thirty GROUP BYs and are
  // wanted exactly here — behind /search they would ride every keystroke of a
  // debounced typeahead.
  //
  // `null` until they arrive, and that is not the same as zero: a value with no
  // number yet renders plain, a value counted at zero renders greyed. Treating
  // the two alike would grey the entire panel for the moment before the fetch
  // lands, which is the frame the reader is looking at.
  const [counts, setCounts] = useState(null)
  useEffect(() => {
    let stale = false
    json('GET', `/search/facets?${querystring}`).then((r) => {
      if (!stale && r.ok) setCounts(r.data)
    })
    return () => { stale = true }
  }, [querystring])
  // A field with hundreds of values (authors, in any real library) is not a
  // control until it can be narrowed, so each group carries its own filter box.
  // narrowFacetOptions is the SAME ranking the typed dropdown uses — an exact
  // prefix never losing to a fuzzy match on another word — so the two surfaces
  // offer the same thing in the same order.
  const [filters, setFilters] = useState({})
  const fields = FACET_FIELDS.filter((f) => f.typed !== false)
  return (
    <div className="space-y-4">
      <p className="microcopy">
        {/* The three field names are GRAMMAR the box parses, not copy — they stay
            as they are, and the sentence around them moves. */}
        {tNodes('search.filters.type.hint', {
          em1: <code key="em1">tag:</code>,
          em2: <code key="em2">author:</code>,
          em3: <code key="em3">character:</code>,
        })}
      </p>
      {fields.map((f) => {
        const typed = filters[f.name] || ''
        const all = facetOptions(f.name, vocabulary, typed)
        // Ranked and capped when filtering; a plain slice otherwise, so a short
        // list shows whole and a long one shows its head rather than nothing.
        const shown = typed ? narrowFacetOptions(all, typed, 12) : all.slice(0, 12)
        if (all.length === 0) return null
        return (
          <div key={f.name} className="space-y-1.5">
            <div className="flex items-baseline gap-2">
              <MonoLabel>{f.name}</MonoLabel>
              {/* The combining rule, written down rather than discovered. Two
                  tags narrow; two authors widen. facets.js has carried `combine`
                  since 1.10.0 as "the copy the help screen quotes" — this is
                  that copy finally having somewhere to be read. */}
              <span className="microcopy">
                {t(
                  f.exclusive
                    ? 'search.filters.combine.exclusive'
                    : f.combine === 'and'
                      ? 'search.filters.combine.and'
                      : 'search.filters.combine.or',
                )}
              </span>
            </div>
            {all.length > 12 && (
              <input
                className="tp-input"
                style={{ fontSize: 'var(--type-ui-13)', padding: '5px 9px' }}
                placeholder={t('search.filters.narrow.placeholder', { field: f.name })}
                value={typed}
                aria-label={t('search.filters.narrow.aria', { field: f.name })}
                onChange={(e) => setFilters((m) => ({ ...m, [f.name]: e.target.value }))}
              />
            )}
            <div className="flex flex-wrap gap-1.5">
              {shown.map((o) => {
                const chip = makeChip(f.name, o)
                const on = chips.some((c) => sameChip(c, chip))
                // The count is keyed by the WIRE value for the fields whose
                // label differs from it — a renamed colour, a work's id — and
                // by the label everywhere else, because that is what the server
                // grouped by. Looking up both is one line and removes the whole
                // class of "the number is on the wrong pill".
                const n = counts ? (counts[f.name]?.[o.value] ?? counts[f.name]?.[o.label] ?? 0) : null
                const dead = n === 0 && !on
                return (
                  <button
                    key={o.value}
                    type="button"
                    className={'facet-pill' + (on ? ' on' : '') + (dead ? ' none' : '')}
                    aria-pressed={on}
                    // Greyed, not hidden, and still pressable. A value that
                    // disappears when you narrow leaves you wondering whether
                    // you mis-remembered your own library; a grey one says "not
                    // under this question", which is the answer and points at
                    // the chip to take off.
                    title={dead ? t('search.filters.dead.tip') : undefined}
                    onClick={() => (on ? onRemove(chip) : onAdd(f.name, o.value, o.label))}
                  >
                    {o.label}
                    {n !== null && <span className="facet-n">{n}</span>}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
      <div className="flex justify-between gap-2 pt-1">
        <GhostButton icon={<IconClose />} disabled={chips.length === 0} onClick={onClear}>
          {t('search.filters.clear.label')}
        </GhostButton>
        <GhostButton onClick={onClose}>{t('common.action.done.label')}</GhostButton>
      </div>
    </div>
  )
}

// SearchPage (§8.9, § sectioned search): one big Newsreader box + scope chips.
// Results come back from the server faceted by WHAT matched and render as one
// section per facet (only the non-empty ones): Books · Movies · Authors ·
// Directors · Actors · Annotations · Dialogues · Notes · Tags · Genres — plus
// "Added on …" for a date query (the Stats calendar links here) and "Decade"
// for a "1990s" query. Work hits are grouped cards headed by the cover /
// poster; quote hits sit under their parent work. 200 ms debounce with a
// stale-guard; GET /search?q=&scope=.
export default function SearchPage({ onOpenBook, onOpenMovie, creditSeparators, sections }) {
  // Persisted so leaving Search (into a book/film, another tab) and coming back
  // restores the last query, scope, and view instead of resetting to empty.
  const [q, setQ] = usePersistedState('tippani:search:q', '')
  const [rawScope, setScope] = usePersistedState('tippani:search:scope', 'all')
  // A SCOPE PERSISTS AND A SECTION CAN BE SWITCHED OFF UNDER IT. The top bar's
  // context-aware Search writes this key before this screen mounts, so somebody
  // who was last searching films and has since hidden the Catalogue would arrive
  // narrowed to a chip that is no longer in the row — a filter they can see the
  // effect of and not the cause. Derived rather than rewritten, so turning the
  // section back on restores the scope they actually chose.
  const scope = SCOPE_SECTION[rawScope] && sections?.[SCOPE_SECTION[rawScope]] === false ? 'all' : rawScope
  const scopes = SCOPES.filter(([value]) => !SCOPE_SECTION[value] || sections?.[SCOPE_SECTION[value]] !== false)
  // The active facets, persisted alongside the query and the scope — leaving
  // Search and coming back restores the whole question, not two thirds of it.
  const [chips, setChips] = usePersistedState('tippani:search:chips', [])
  // ONE WAY IN FOR EVERY CHIP ON THIS SCREEN. The typed grammar, the Filters
  // panel and the press-to-narrow names on a card all arrive here and all go
  // through makeChip/addChip.
  //
  // facets.js opens by saying why the syntax lives on one side only: "a grammar
  // the client parses for chips and the server re-parses for SQL is a grammar
  // that drifts, and the drift does not announce itself". A second place that
  // assembled its own chip would reintroduce exactly that — one file apart
  // instead of one process apart, and just as silent.
  const addFacet = (field, value, label) =>
    setChips((cs) => addChip(cs, makeChip(field, { value, label: label ?? value })))
  const [vocabulary, loadVocabulary] = useSearchVocabulary()
  const [results, setResults] = useState(null)
  const [error, setError] = useState('')
  const [view, setView] = usePersistedState('tippani:searchview', 'tiles') // tiles | list | table
  const [group, setGroup] = usePersistedState('tippani:search:group', 'none') // none|series|author|decade|genre (tiles/list)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [nonce, setNonce] = useState(0) // bump to re-run the search after a bulk action
  const reload = () => setNonce((n) => n + 1)
  const [quote, setQuote] = useState(null) // { kind, hit } — a single quote opened from a result
  const authors = usePeople('author') // name→metadata for author portraits/chips
  const directors = usePeople('director') // name→metadata for director/creator chips
  const actors = usePeople('actor') // name→metadata for actor chips on dialogue hits
  const speakers = usePeople('speaker') // name→metadata for speaker chips on quote hits
  const [person, setPerson] = useState(null) // { kind, name } open in the metadata panel
  const mobile = useIsMobileScreen()
  const creditSeps = useMemo(() => parseCreditSeps(creditSeparators), [creditSeparators])

  // A facet being TYPED is not a facet yet: while the dropdown is open on
  // `tag:sto`, those characters are a half-written instruction, not a search
  // term. Sending them as free text would flash the results for "tag sto"
  // under an open menu — so a LIVE draft is stripped before the query is built,
  // and reappears the moment the field name stops matching.
  //
  // LIVE MEANS "HAS SOMETHING TO OFFER", and that qualifier is the whole of a
  // bug this did not have when it shipped. Stripping on the draft alone throws
  // the words away whenever no dropdown can appear — `tag:zzzz`, or any field at
  // all while the vocabulary is still loading or failed to. The reader gets an
  // empty screen saying "type to search" over a box they have visibly typed
  // into, with no completion to pick and no way out but backspace.
  //
  // One computation — readSearchBox — for both the menu and the query, so the
  // thing that decides what to search and the thing that decides what to offer
  // cannot disagree. (It also takes the escaping backslash back off: `note\:` is
  // a request to search for the words "note:", so that is what goes in.)
  const { draft, options: draftOptions, freeText } = readSearchBox(q, vocabulary)
  // One string, so the debounce depends on the whole question rather than on
  // three separate pieces of it — and an array of chips cannot be a dep.
  const querystring = searchQueryString({ q: freeText, scope, chips })
  const nothingAsked = !freeText.trim() && chips.length === 0

  useEffect(() => {
    if (nothingAsked) {
      setResults(null)
      setError('')
      return
    }
    let stale = false
    const timer = setTimeout(async () => {
      const r = await json('GET', `/search?${querystring}`)
      if (stale) return
      if (r.ok) {
        setResults(r.data)
        setError('')
      } else {
        setError(errText(r, t('error.search.failed')))
      }
    }, 200)
    return () => {
      stale = true
      clearTimeout(timer)
    }
  }, [querystring, nothingAsked, nonce])

  // Highlight the words the results actually came from: the server-corrected
  // query on a fuzzy (zero-hit) pass, else the raw input (PLAN §4).
  const terms = queryTerms(results?.corrected || freeText)
  // One group list per facet section. groupBooks/groupMovies fold quote hits
  // under their parent work; the work-only facets pass empty child lists.
  const r = results || {}
  const bookGroups = results ? groupBooks({ books: r.books, annotations: [] }) : []
  const movieGroups = results ? groupMovies({ movies: r.movies, dialogues: [] }) : []
  const annGroups = results ? groupBooks({ books: [], annotations: r.annotations }) : []
  const dlgGroups = results ? groupMovies({ movies: [], dialogues: r.dialogues }) : []
  const noteAnnGroups = results ? groupBooks({ books: [], annotations: r.notes?.annotations || [] }) : []
  const noteDlgGroups = results ? groupMovies({ movies: [], dialogues: r.notes?.dialogues || [] }) : []
  // Every section that can render has to be counted here, or a result made
  // ENTIRELY of that section reports "nothing found" over its own hits — which
  // is what a quotes-only library would have seen.
  const total = results
    ? [r.books, r.annotations, r.movies, r.dialogues, r.quotes,
       r.authors, r.directors, r.actors, r.characters, r.speakers,
       r.notes?.annotations, r.notes?.dialogues, r.notes?.quotes, r.tags, r.genres]
        .reduce((n, a) => n + (a?.length || 0), 0) +
      (r.decade ? 1 : 0) + (r.date_added ? 1 : 0)
    : 0
  const empty = results && total === 0

  // The two card renderers every section shares (a group in, a keyed card out).
  const renderBook = (g) => (
    <WorkResult key={`b${g.id}`} kind="book" g={g} view={view} terms={terms} onOpen={onOpenBook} onOpenQuote={setQuote} onOpenPerson={setPerson} people={authors.map} creditSeps={creditSeps} />
  )
  // WHICH FACE A DIALOGUE HIT WEARS, decided by the SECTION it is in (2.2.0).
  //
  // The search response already answers this: `actors` holds the hits where the
  // ACTOR column matched, `characters` the ones where the character did, and the
  // work groups the ones where the words did. So a reader who searched a name gets
  // the face they asked about — the actor under Actors, the character everywhere
  // else — and nothing has to guess from the query text.
  //
  // Defaults to the character, because that is who speaks a line. The actor is
  // still named on the credit line beside it either way.
  const renderMovie = (g, face = 'character') => (
    <WorkResult key={`m${g.id}`} kind="movie" g={g} view={view} terms={terms} onOpen={onOpenMovie} onOpenQuote={setQuote} onOpenPerson={setPerson} people={directors.map} actorMap={actors.map} creditSeps={creditSeps} onFacet={addFacet} face={face} />
  )
  const renderMovieActorFace = (g) => renderMovie(g, 'actor')

  return (
    <section className="space-y-5">
      {/* Search has no PageHeader — the box IS the header. Nothing rides beside
          it any more either: the screen's "?" moved to the shell bar in 1.4.1, so
          the box gets the whole width it always wanted. */}
      {mobile ? (
        <div className="mobile-sticky-bar">
          <SearchBox
            q={q} setQ={setQ} chips={chips} setChips={setChips}
            mobile draft={draft} options={draftOptions} onFirstFocus={loadVocabulary}
          />
        </div>
      ) : (
        <SearchBox
          q={q} setQ={setQ} chips={chips} setChips={setChips}
          draft={draft} options={draftOptions} onFirstFocus={loadVocabulary}
        />
      )}

      <div className="flex flex-wrap items-center gap-2">
        {scopes.map(([value, label, icon, keepLabel]) => (
          <FilterChip
            key={value}
            active={scope === value}
            icon={icon}
            keepLabel={keepLabel}
            label={label}
            tooltip={value === 'all' ? t('search.scope.all.tip') : t('search.scope.only.tip', { name: label.toLowerCase() })}
            onClick={() => setScope(value)}
          />
        ))}
        {/* The door to the facets. It sits in the scope row because that row
            already answers "what am I searching"; narrowing is the same
            question asked more precisely.

            Opening it warms the vocabulary the way focusing the box does, so the
            panel is never empty on first open — which is the state it would
            otherwise be in exactly once per session, for the reader who has
            never seen it before. */}
        <FilterChip
          active={chips.length > 0}
          icon={<IconFilter />}
          keepLabel
          label={chips.length > 0 ? t('search.filters.count.label', { n: chips.length }) : t('search.filters.label')}
          tooltip={t('search.filters.tip')}
          onClick={() => {
            loadVocabulary()
            setFiltersOpen(true)
          }}
        />
        {results && !empty && (
          <span className="ml-auto flex items-center gap-3 view-toggle-row">
            {view !== 'table' && (
              <label className="flex items-center gap-2">
                <MonoLabel>{t('common.mono.group.label')}</MonoLabel>
                <Select
                  ariaLabel={t('common.filters.group.aria')}
                  value={group}
                  onChange={setGroup}
                  options={[
                    ['none', t('search.group.none.label')],
                    ['series', t('search.group.series.label')],
                    ['author', t('search.group.author.label')],
                    ['decade', t('search.group.decade.label')],
                    ['genre', t('search.group.genre.label')],
                  ]}
                />
              </label>
            )}
            <ViewToggle value={view} onChange={setView} />
          </span>
        )}
      </div>

      <ErrorText>{error}</ErrorText>

      {!results && !error && (
        <EmptyState>{t('search.results.empty.prompt')}</EmptyState>
      )}
      {empty && (
        <div className="flex flex-col items-center gap-4 py-10">
          {/* Name the whole question, not the half of it that was typed: with
              chips up, "no results for “”" would be reporting an empty search
              over a narrowing the reader can see on screen. */}
          <p className="tp-empty" style={{ padding: 0 }}>
            {t(scope === 'all' ? 'search.results.none' : 'search.results.none.scope', {
              query: [freeText.trim(), ...chips.map(chipText)].filter(Boolean).join(' '),
              name: scope,
            })}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <GhostButton icon={<IconClose />} onClick={() => { setQ(''); setChips([]) }}>{t('search.results.clear.label')}</GhostButton>
            {chips.length > 0 && (
              <GhostButton icon={<IconClose />} onClick={() => setChips([])}>{t('search.results.drop-filters.label')}</GhostButton>
            )}
            {scope !== 'all' && <GhostButton icon={<IconSearch />} onClick={() => setScope('all')}>{t('search.results.everything.label')}</GhostButton>}
          </div>
        </div>
      )}
      {/* Silent typo correction (PLAN §4): the server ran the fuzzy pass because
          the exact query had no hits. Tell the reader which query these came from. */}
      {!empty && results?.corrected && (
        <p className="microcopy">
          {t('search.results.corrected', { query: results.corrected })}
        </p>
      )}

      {/* One section per facet, only when it has hits. The structured facets
          (date, decade) and the credit / notes / tag / genre facets have no
          flat-table form, so they render as cards in EVERY view — only the plain
          Books / Movies / Annotations / Dialogues switch to sortable tables in
          table view (tiles/list keep the grouped media cards). This keeps a
          facet-only result (e.g. a date or author query) from rendering a blank
          screen under the table view. */}
      {results && !empty && (
        <>
          {results?.date_added && (
            <DateSection d={results.date_added} view={view} terms={terms} renderBook={renderBook} renderMovie={renderMovie} onOpenQuote={setQuote} speakerMap={speakers.map} creditSeps={creditSeps} />
          )}
          {results?.decade && (
            <section className="space-y-3">
              <MonoLabel className="block">
                {t('search.section.decade.title', {
                  name: results.decade.label,
                  n: (results.decade.books?.length || 0) + (results.decade.movies?.length || 0),
                })}
              </MonoLabel>
              <Board view={view}>
                {[
                  ...groupBooks({ books: results.decade.books || [], annotations: [] }).map(renderBook),
                  ...groupMovies({ movies: results.decade.movies || [], dialogues: [] }).map(renderMovie),
                ]}
              </Board>
            </section>
          )}
          {view === 'table' ? (
            <SearchTables results={results} terms={terms} onOpenBook={onOpenBook} onOpenMovie={onOpenMovie} reload={reload} />
          ) : (
            <>
              {bookGroups.length > 0 && (
                <ResultSection
                  label={t('search.section.books.title')}
                  groups={bookGroups}
                  group={group}
                  view={view}
                  isMovie={false}
                  people={authors.map}
                  onOpenPerson={setPerson}
                  creditSeps={creditSeps}
                  renderItem={renderBook}
                />
              )}
              {movieGroups.length > 0 && (
                <ResultSection
                  label={t('search.section.movies.title')}
                  groups={movieGroups}
                  group={group}
                  view={view}
                  isMovie
                  people={directors.map}
                  onOpenPerson={setPerson}
                  renderItem={renderMovie}
                />
              )}
              {annGroups.length > 0 && (
                <ResultSection
                  label={t('search.section.annotations.title')}
                  groups={annGroups}
                  group={group}
                  view={view}
                  isMovie={false}
                  people={authors.map}
                  onOpenPerson={setPerson}
                  creditSeps={creditSeps}
                  renderItem={renderBook}
                  count={r.annotations?.length || 0}
                />
              )}
              {dlgGroups.length > 0 && (
                <ResultSection
                  label={t('search.section.dialogues.title')}
                  groups={dlgGroups}
                  group={group}
                  view={view}
                  isMovie
                  people={directors.map}
                  onOpenPerson={setPerson}
                  renderItem={renderMovie}
                  count={r.dialogues?.length || 0}
                />
              )}
            </>
          )}
          {results?.authors?.length > 0 && (
            <PeopleSection
              label={t('search.section.authors.title')}
              kind="author"
              entries={results.authors.map((a) => ({ name: a.name, count: a.books.length, groups: groupBooks({ books: a.books, annotations: [] }) }))}
              people={authors.map}
              onOpenPerson={setPerson}
              view={view}
              render={renderBook}
            />
          )}
          {results?.directors?.length > 0 && (
            <PeopleSection
              label={t('search.section.directors.title')}
              kind="director"
              entries={results.directors.map((d) => ({ name: d.name, count: d.movies.length, groups: groupMovies({ movies: d.movies, dialogues: [] }) }))}
              people={directors.map}
              onOpenPerson={setPerson}
              view={view}
              render={renderMovie}
            />
          )}
          {results?.actors?.length > 0 && (
            <PeopleSection
              label={t('search.section.actors.title')}
              kind="actor"
              entries={results.actors.map((a) => ({ name: a.name, count: a.dialogues.length, groups: groupMovies({ movies: [], dialogues: a.dialogues }) }))}
              people={actors.map}
              onOpenPerson={setPerson}
              view={view}
              render={renderMovieActorFace}
            />
          )}
          {/* Characters — who said it, in a film, a show or a game.

              A section of its own for the same reason Actors is: searching a
              name is asking about the speaker, not about the words. Before this
              existed a character match arrived as a bare line under a film
              cover, so finding "everything Tyrion says" meant reading six
              posters and assembling the answer yourself.

              The NAME is a plain chip and a button rather than a portrait: a
              character is not a row in the People console, so there is no page for
              a portrait to open. Their picture does appear on the LINES below,
              where a quote's own chip is now the character's face (0050) — the
              claim that there is nobody to photograph stopped being true when
              TheTVDB's per-role art arrived. */}
          {results?.characters?.length > 0 && (
            <section className="space-y-4">
              <MonoLabel className="block">
                {t('search.section.heading', { name: t('search.section.characters.title'), n: results.characters.length })}
              </MonoLabel>
              {results.characters.map((ch) => (
                <div key={ch.name} className="space-y-2">
                  <div className="flex items-center gap-3">
                    <Tooltip label={t('search.character.all.tip', { name: ch.name })}>
                      <button type="button" className="tp-chip facet-mini" onClick={() => addFacet('character', ch.name)}>
                        {ch.name}
                      </button>
                    </Tooltip>
                    <MonoLabel style={{ color: 'var(--accent-ui)' }}>{ch.dialogues.length}</MonoLabel>
                    <span className="h-px flex-1" style={{ background: 'var(--line)' }} />
                  </div>
                  <Board view={view}>
                    {groupMovies({ movies: [], dialogues: ch.dialogues }).map(renderMovie)}
                  </Board>
                </div>
              ))}
            </section>
          )}
          {/* Standalone quotes (§24). Their own section rather than folded into
              Annotations, because they are not from a book: matching one is a
              different answer to a different question. */}
          {results?.quotes?.length > 0 && (
            <section className="space-y-3">
              <MonoLabel className="block">
                {t('search.section.heading', { name: t('search.section.quotes.title'), n: results.quotes.length })}
              </MonoLabel>
              <div className="space-y-2">
                {results.quotes.map((h) => (
                  <QuoteHit key={`u${h.id}`} h={h} terms={terms} onOpen={setQuote} people={speakers.map} seps={creditSeps} />
                ))}
              </div>
            </section>
          )}
          {/* Searching a person's name is asking about the person, so speakers
              get the treatment authors and actors get. */}
          {results?.speakers?.length > 0 && (
            <section className="space-y-4">
              <MonoLabel className="block">
                {t('search.section.heading', { name: t('search.section.speakers.title'), n: results.speakers.length })}
              </MonoLabel>
              {results.speakers.map((sp) => (
                <div key={sp.name} className="space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="tp-chip">{sp.name}</span>
                    <MonoLabel style={{ color: 'var(--accent-ui)' }}>{sp.quotes.length}</MonoLabel>
                    <span className="h-px flex-1" style={{ background: 'var(--line)' }} />
                  </div>
                  <div className="space-y-2">
                    {sp.quotes.map((h) => (
                      <QuoteHit key={`u${h.id}`} h={h} terms={terms} onOpen={setQuote} people={speakers.map} seps={creditSeps} />
                    ))}
                  </div>
                </div>
              ))}
            </section>
          )}
          {(noteAnnGroups.length > 0 || noteDlgGroups.length > 0 || r.notes?.quotes?.length > 0) && (
            <section className="space-y-3">
              <MonoLabel className="block">
                {t('search.section.heading', {
                  name: t('search.section.notes.title'),
                  n: (r.notes?.annotations?.length || 0) + (r.notes?.dialogues?.length || 0) + (r.notes?.quotes?.length || 0),
                })}
              </MonoLabel>
              <Board view={view}>{[...noteAnnGroups.map(renderBook), ...noteDlgGroups.map(renderMovie)]}</Board>
              {r.notes?.quotes?.length > 0 && (
                <div className="space-y-2">
                  {r.notes.quotes.map((h) => (
                    <QuoteHit key={`u${h.id}`} h={h} terms={terms} onOpen={setQuote} people={speakers.map} seps={creditSeps} />
                  ))}
                </div>
              )}
            </section>
          )}
          {results?.tags?.length > 0 && (
            <TagSection tags={results.tags} terms={terms} onOpenQuote={setQuote} speakerMap={speakers.map} creditSeps={creditSeps} />
          )}
          {results?.genres?.length > 0 && (
            <GenreSection genres={results.genres} view={view} renderBook={renderBook} renderMovie={renderMovie} />
          )}
        </>
      )}

      {filtersOpen && (
        <FormModal title={t('search.filters.title')} onClose={() => setFiltersOpen(false)}>
          <FacetPanel
            vocabulary={vocabulary}
            chips={chips}
            querystring={querystring}
            onAdd={addFacet}
            onRemove={(chip) => setChips((cs) => cs.filter((c) => !sameChip(c, chip)))}
            onClear={() => setChips([])}
            onClose={() => setFiltersOpen(false)}
          />
        </FormModal>
      )}

      {quote && (
        <QuoteModal
          kind={quote.kind}
          hit={quote.hit}
          authorMap={authors.map}
          speakerMap={speakers.map}
          actorMap={actors.map}
          seps={creditSeps}
          onOpenBook={onOpenBook}
          onOpenMovie={onOpenMovie}
          onOpenPerson={setPerson}
          onClose={() => setQuote(null)}
          onChanged={reload}
        />
      )}
      {person && (
        <PersonModal
          kind={person.kind}
          name={person.name}
          onClose={() => setPerson(null)}
          onSaved={() => {
            authors.reload()
            directors.reload()
            actors.reload()
          }}
        />
      )}
    </section>
  )
}

// QuoteModal — opening a single annotation / dialogue from a search result. It
// loads the full row (search hits are lean) + its parent (for share
// attribution) + tags, then renders the SAME AnnotationCard / Frame used on the
// detail pages, so share / edit / delete behave identically. Edits and deletes
// re-run the search via onChanged.
function QuoteModal({ kind, hit, authorMap = {}, actorMap = {}, speakerMap = {}, seps, onOpenBook, onOpenMovie, onOpenPerson, onClose, onChanged }) {
   // The page behind an overlay does not move. Without this a wheel or a swipe
  // running past the end of the dialog scrolls the page you cannot see, which is
  // still scrolled when you close this. Ref-counted, so a dialog opened from
  // inside a sheet does not unlock the sheet on its way out.
  useBodyScrollLock(true)
 const isBook = kind === 'book'
  // A standalone quote (§24) has NO PARENT, which is the whole difference here:
  // no parent fetch, no "Open book" button, and the list it is found in is not
  // scoped to a work. There is no GET /quotes/{id} either, so the row is picked
  // out of the account's list — and the response key is `utterances`, the table
  // name, not `quotes`, the route.
  const isQuote = kind === 'utterance'
  const parentId = isBook ? hit.book_id : hit.movie_id
  const childPath = isQuote ? '/quotes' : isBook ? `/annotations?book_id=${parentId}` : `/dialogues?movie_id=${parentId}`
  const childKey = isQuote ? 'utterances' : isBook ? 'annotations' : 'dialogues'
  const itemPath = isQuote ? '/quotes' : isBook ? '/annotations' : '/dialogues'
  const parentPath = isBook ? `/books/${parentId}` : `/movies/${parentId}`
  const stateFn = isQuote ? utteranceState : isBook ? annotationState : dialogueState

  const [row, setRow] = useState(null)
  const [parent, setParent] = useState(null)
  const [tags, setTags] = useState([])
  const [editing, setEditing] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [error, setError] = useState('')
  const [gone, setGone] = useState(false)
  const { stickers, reload: reloadStickers } = useStickers()

  async function loadRow() {
    const r = await json('GET', childPath)
    if (!r.ok) return setError(errText(r))
    const found = (r.data[childKey] || []).find((x) => x.id === hit.id)
    if (!found) return setGone(true)
    setRow(found)
  }
  useEffect(() => {
    loadRow()
    // No parent to fetch for a standalone quote — asking for /books/undefined
    // would be a 404 the modal then has to ignore.
    if (!isQuote) json('GET', parentPath).then((r) => { if (r.ok) setParent(r.data) })
    json('GET', '/tags').then((r) => { if (r.ok) setTags(r.data.tags) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hit.id, kind])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !shareOpen) onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, shareOpen])

  const tagMap = useMemo(() => Object.fromEntries(tags.map((row) => [row.name, row])), [tags])
  const stickerMap = useMemo(() => Object.fromEntries(stickers.map((s) => [s.id, s])), [stickers])

  async function save(id, fields) {
    const r = await json('PUT', `${itemPath}/${id}`, fields)
    if (!r.ok) return errText(r, t('error.save.generic'))
    setEditing(false)
    await loadRow()
    onChanged && onChanged()
    return null
  }
  // Resolves false on failure so an optimistic caller (AnnotationCard's colour
  // quick-pick) can roll its preview back — matches Library's patch.
  async function patch(x, fields) {
    const r = await json('PUT', `${itemPath}/${x.id}`, { ...stateFn(x), ...fields })
    if (!r.ok) {
      setError(errText(r, t('error.save.generic')))
      return false
    }
    setError('')
    await loadRow()
    onChanged && onChanged()
    return true
  }
  async function remove(x) {
    if (
      !confirm(
        t(
          isQuote
            ? 'home.favourites.delete.quote.confirm'
            : isBook
              ? 'home.favourites.delete.annotation.confirm'
              : 'home.favourites.delete.dialogue.confirm',
        ),
      )
    )
      return
    // The modal closes on success, so the Undo refreshes the RESULTS behind it
    // rather than this view — which is where the row would reappear.
    const r = await deleteWithUndo(`${itemPath}/${x.id}`, { reload: onChanged })
    if (r.ok) { onChanged && onChanged(); onClose() }
    else setError(errText(r))
  }

  // The header line. A standalone quote's "title" is the occasion it was said
  // on — the nearest thing it has to a work.
  const title = isQuote
    ? row?.occasion || hit.occasion || t('search.hit.title.fallback')
    : isBook
      ? parent?.title || hit.book_title
      : parent?.title || hit.movie_title
  // The credited people for the header chip row: a book's author(s) (split), a
  // dialogue's actor, a quote's speaker. Portraits come from the people maps —
  // the "image chips" the detail pages show but the search popup was missing.
  const creditKind = isQuote ? 'speaker' : isBook ? 'author' : 'actor'
  const creditMap = isBook ? authorMap : isQuote ? speakerMap : actorMap
  const creditNames = splitCredits(isQuote ? row?.speaker || hit.speaker : isBook ? parent?.author : row?.actor, seps)
  const sharePayload = () =>
    isQuote
      ? quoteShare({ quote: row.quote, translation: row.translation, note: row.note,
          category: row.category, language: row.language, speaker: row.speaker, occasion: row.occasion, when: formatPartialDate(row.occasion_date), place: row.place, medium: quoteKindMeta(row), date: fmtDate(annDate(row)), tags: row.tags, color: row.color, people: speakerMap, seps })
      : isBook
        ? bookShare({ quote: row.quote, note: row.note, translation: row.translation, author: parent?.author, title, published: parent?.published_year, chapter: chapterLabel(row), location: row.location, character: row.character, date: fmtDate(annDate(row)), tags: row.tags, color: row.color, people: authorMap, seps })
        : movieShare({ quote: row.quote, note: row.note, translation: row.translation, title, year: parent?.release_year, character: row.character, actor: row.actor, timestamp: row.timestamp, episode: episodeLabel(row), tags: row.tags, color: row.color, tmdbId: parent?.tmdb_id, tvdbId: parent?.tvdb_id, people: actorMap, seps })

  return (
    <div
      className="tp-scrim fixed inset-0 z-50 overflow-y-auto px-4 py-10"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div role="dialog" aria-modal="true" aria-label={t('search.hit.title.fallback')} className="mx-auto w-full max-w-2xl">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0" style={{ maxWidth: '60%' }}>
            <MonoLabel className="block truncate">{title || t('search.hit.title.fallback')}</MonoLabel>
            {/* Author / actor portrait chips (split) — click one to open the
                person panel, same as the detail pages. */}
            {creditNames.length > 0 && (
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                {creditNames.map((n) => (
                  <PersonCredit key={n} kind={creditKind} name={n} person={creditMap[n]} size={22} onOpen={onOpenPerson} nameStyle={{ fontSize: 'var(--type-ui-13)' }} />
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            {/* Nothing to open: a standalone quote is the whole record. */}
            {!isQuote && (
              <GhostButton icon={<IconOpen />} keepLabel onClick={() => (isBook ? onOpenBook(parentId) : onOpenMovie(parentId))}>
                {t(isBook ? 'search.hit.open.book.label' : 'search.hit.open.film.label')}
              </GhostButton>
            )}
            <CloseButton onClick={onClose} />
          </div>
        </div>
        <ErrorText>{error}</ErrorText>
        {gone ? (
          <HandCard className="p-5"><EmptyState>{t('search.hit.gone')}</EmptyState></HandCard>
        ) : !row ? (
          <HandCard className="p-5"><p className="microcopy">{t('common.action.load.busy')}</p></HandCard>
        ) : isBook || isQuote ? (
          <AnnotationCard
            a={row}
            meta={isQuote ? utteranceMeta(row, { omitSpeaker: true }) : undefined}
            form={isQuote ? UtteranceForm : undefined}
            variant={0}
            tagMap={tagMap}
            stickerMap={stickerMap}
            stickers={stickers}
            reloadStickers={reloadStickers}
            editing={editing}
            setEditingId={(id) => setEditing(id != null)}
            save={save}
            patch={patch}
            remove={remove}
            onCopy={() => copyQuote(sharePayload())}
            onShare={() => setShareOpen(true)}
            quoteLines={40}
            tagSuggestions={Object.keys(tagMap)}
            actionsAlwaysVisible
            editInline
          />
        ) : (
          <Frame
            d={row}
            tagMap={tagMap}
            stickerMap={stickerMap}
            stickers={stickers}
            reloadStickers={reloadStickers}
            editing={editing}
            show={(parent?.media_type || row?.movie_media_type) === 'show'}
            onEdit={() => setEditing(true)}
            onCancelEdit={() => setEditing(false)}
            onSave={(fields) => save(row.id, fields)}
            onPatch={(fields) => patch(row, fields)}
            onDelete={() => remove(row)}
            onCopy={() => copyQuote(sharePayload())}
            onShare={() => setShareOpen(true)}
            quoteLines={40}
            actionsAlwaysVisible
            editInline
          />
        )}
      </div>
      {shareOpen && row && <ShareDialog share={sharePayload()} seen={{ kind: isQuote ? 'utterance' : isBook ? 'book' : 'screen', id: row.id }} onClose={() => setShareOpen(false)} />}
    </div>
  )
}

// SearchTables — the table view: one sortable, flat table per result kind that
// has hits. Rows open their parent book/movie; rows can also be selected for a
// bulk action (tag annotations/dialogues, field-correct books/movies). Sorting
// is table-only.
function SearchTables({ results, terms, onOpenBook, onOpenMovie, reload }) {
  const r = results
  return (
    <div className="space-y-6">
      {r.books?.length > 0 && (
        <ResultTable
          label={t('search.section.heading', { name: t('search.section.books.title'), n: r.books.length })}
          rows={r.books}
          terms={terms}
          onOpen={(row) => onOpenBook(row.id)}
          bulk={{ endpoint: '/books/bulk', kind: 'book-fields' }}
          reload={reload}
          cols={[
            { key: 'title', label: t('common.field.title.label'), val: (b) => b.title, highlight: true, main: true },
            { key: 'author', label: t('common.field.author.label'), val: (b) => b.author || '', mono: true },
            { key: 'genres', label: t('common.field.genres.label'), val: (b) => (b.genres || []).join(', '), mono: true, sort: false },
          ]}
        />
      )}
      {r.annotations?.length > 0 && (
        <ResultTable
          label={t('search.section.heading', { name: t('search.section.annotations.title'), n: r.annotations.length })}
          rows={r.annotations}
          terms={terms}
          onOpen={(row) => onOpenBook(row.book_id)}
          bulk={{ endpoint: '/annotations/bulk', kind: 'tag' }}
          reload={reload}
          cols={[
            { key: 'quote', label: t('common.field.quote.label'), val: (a) => a.quote || a.note || '', highlight: true, main: true },
            { key: 'book', label: t('share.field.work.book.label'), val: (a) => a.book_title || '', mono: true },
          ]}
        />
      )}
      {r.movies?.length > 0 && (
        <ResultTable
          label={t('search.section.heading', { name: t('search.section.movies.title'), n: r.movies.length })}
          rows={r.movies}
          terms={terms}
          onOpen={(row) => onOpenMovie(row.id)}
          bulk={{ endpoint: '/movies/bulk', kind: 'movie-fields' }}
          reload={reload}
          cols={[
            { key: 'title', label: t('common.field.title.label'), val: (m) => m.title, highlight: true, main: true },
            { key: 'director', label: t('common.field.director.label'), val: (m) => m.director || '', mono: true },
            { key: 'year', label: t('common.field.year.label'), val: (m) => m.release_year || 0, mono: true },
          ]}
        />
      )}
      {r.dialogues?.length > 0 && (
        <ResultTable
          label={t('search.section.heading', { name: t('search.section.dialogues.title'), n: r.dialogues.length })}
          rows={r.dialogues}
          terms={terms}
          onOpen={(row) => onOpenMovie(row.movie_id)}
          bulk={{ endpoint: '/dialogues/bulk', kind: 'tag' }}
          reload={reload}
          cols={[
            { key: 'quote', label: t('common.field.quote.label'), val: (d) => d.quote || '', highlight: true, main: true },
            { key: 'character', label: t('common.field.character.label'), val: (d) => d.character || '', mono: true },
            // Results mix films and shows, so the Episode column earns its width
            // only when something in this result set actually has one.
            ...(r.dialogues.some((d) => d.season != null)
              ? [{ key: 'episode', label: t('common.field.episode.label'), val: (d) => episodeLabel(d), mono: true }]
              : []),
            { key: 'timestamp', label: t('share.field.time.label'), val: (d) => d.timestamp || '', mono: true },
            { key: 'movie', label: t('vocab.kind.movie.label'), val: (d) => d.movie_title || '', mono: true },
          ]}
        />
      )}
    </div>
  )
}

function ResultTable({ label, rows, cols, terms, onOpen, bulk, reload }) {
  const { sort, toggle, apply } = useSort(cols[0].key, 'asc')
  const [sel, setSel] = useState(() => new Set())
  const valueFns = Object.fromEntries(cols.filter((c) => c.sort !== false).map((c) => [c.key, (row) => {
    const v = c.val(row)
    return typeof v === 'string' ? v.toLowerCase() : v
  }]))
  const sorted = apply(rows, valueFns)
  const ids = rows.map((row) => row.id)
  const allSel = ids.length > 0 && ids.every((id) => sel.has(id))
  const toggleId = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleAll = () => setSel(() => (allSel ? new Set() : new Set(ids)))
  const selectedIds = ids.filter((id) => sel.has(id))

  return (
    <section className="space-y-2">
      <MonoLabel className="block">{label}</MonoLabel>
      {bulk && selectedIds.length > 0 && (
        <SearchBulkForm
          n={selectedIds.length}
          ids={selectedIds}
          bulk={bulk}
          onClear={() => setSel(new Set())}
          onDone={() => { setSel(new Set()); reload && reload() }}
        />
      )}
      <div className="ann-table-wrap">
        <table className="ann-table">
          <thead>
            <tr>
              {bulk && (
                <th style={{ width: 34 }}>
                  <Tooltip label={t('search.table.select-all.tip')} side="bottom">
                    <input type="checkbox" checked={allSel} onChange={toggleAll} aria-label={t('search.table.select-all.aria')} />
                  </Tooltip>
                </th>
              )}
              {cols.map((c) =>
                c.sort === false ? (
                  <th key={c.key}>{c.label}</th>
                ) : (
                  <SortableTh key={c.key} col={c.key} label={c.label} sort={sort} onSort={toggle} />
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr key={row.id}>
                {bulk && (
                  <td className="col-center" onClick={(e) => e.stopPropagation()}>
                    <Tooltip label={t('search.table.select-row.tip')} side="bottom">
                      <input type="checkbox" checked={sel.has(row.id)} onChange={() => toggleId(row.id)} aria-label={t('search.table.select-row.aria')} />
                    </Tooltip>
                  </td>
                )}
                {cols.map((c) => (
                  <td key={c.key} className={c.main ? 'col-quote' : 'col-mono'} style={{ cursor: 'pointer' }} onClick={() => onOpen(row)}>
                    {c.highlight ? <Highlight text={String(c.val(row))} terms={terms} /> : c.val(row) || '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

// SearchBulkForm — the action controls for a table's current selection, hosted
// inside the shared BulkBar strip. Tag kinds add tags; field kinds set
// author/director + series + genres. Posts to the kind's bulk endpoint, then
// clears + reloads the search.
function SearchBulkForm({ n, ids, bulk, onClear, onDone }) {
  const [text, setText] = useState('') // tags (tag kind) or genres (field kind)
  const [series, setSeries] = useState('')
  const [nameField, setNameField] = useState('') // author or director
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const isTag = bulk.kind === 'tag'
  const isBook = bulk.kind === 'book-fields'
  // WHICH INPUTS TO SHOW COMES FROM THE REGISTRY (actions.jsx), not from this
  // component's own reading of `bulk.kind`. Both lists — what you can do to one
  // quote and what you can do to a selection — now come from the same file, which
  // is the point: a card menu and a bulk bar that each decide for themselves are
  // two answers to one question, and they diverge the first time one of them gains
  // an action.
  //
  // The single Apply that posts one body is unchanged, deliberately: this commit is
  // meant to move the DEFINITIONS, not the behaviour.
  const forms = new Set(
    bulkActionsFor(isTag ? 'annotation' : isBook ? 'book' : 'movie', ids, {
      addTags: true,
      setFields: true,
    }).map((a) => a.form),
  )
  const canSetFields = forms.has(BULK_FIELDS)
  const canAddTags = forms.has(BULK_TAGS)

  // Nothing typed is the must-fill case here — a bulk action over N rows that
  // sets nothing is a no-op with a confirmation, which is worse than a greyed
  // button. Same predicate as the guards inside apply().
  const nothingSet = isTag
    ? splitCommas(text).length === 0
    : !nameField.trim() && !series.trim() && splitCommas(text).length === 0

  async function apply() {
    const body = { ids }
    if (isTag) {
      const tags = splitCommas(text)
      if (!tags.length) return setErr(t('error.validate.tag-required'))
      body.add_tags = tags
    } else {
      const genres = splitCommas(text)
      if (nameField.trim()) body[isBook ? 'author' : 'director'] = nameField.trim()
      if (series.trim()) body.series = series.trim()
      if (genres.length) body.add_genres = genres
      if (!body.author && !body.director && !body.series && !body.add_genres) return setErr(t('error.validate.field-required'))
    }
    setBusy(true)
    setErr('')
    const r = await json('POST', bulk.endpoint, body)
    setBusy(false)
    if (!r.ok) return setErr(errText(r, t('error.bulk.failed')))
    onDone()
  }

  return (
    <BulkBar n={n} onClear={onClear}>
      {canSetFields && (
        <input className="tp-input w-auto" style={{ minWidth: 130 }} placeholder={t(isBook ? 'search.bulk.author.placeholder' : 'search.bulk.director.placeholder')} value={nameField} onChange={(e) => setNameField(e.target.value)} />
      )}
      {canSetFields && (
        <input className="tp-input w-auto" style={{ minWidth: 110 }} placeholder={t('search.bulk.series.placeholder')} value={series} onChange={(e) => setSeries(e.target.value)} />
      )}
      {canAddTags && <input
        className="tp-input w-auto"
        style={{ minWidth: 150 }}
        placeholder={t(isTag ? 'search.bulk.tags.placeholder' : 'search.bulk.genres.placeholder')}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); apply() } }}
      />}
      <button
        className="tp-btn tp-btn-primary"
        disabled={busy || nothingSet}
        title={nothingSet ? t(isTag ? 'search.bulk.tags.blocked.tip' : 'search.bulk.fields.blocked.tip') : undefined}
        onClick={apply}
      >
        Apply to {n}
      </button>
      {err && <span className="microcopy" style={{ color: 'var(--error)' }}>{err}</span>}
    </BulkBar>
  )
}

// MediaGroup: one book / movie as a card. TOP ROW — cover/poster on the left,
// then the work title with the author/director credit line (+ face chip) beside
// it, and a single clipped row of genre chips below (cut off at the card edge,
// not wrapped). Its matching children (annotations / dialogues) sit BELOW that
// header, spanning the FULL card width — the quote cards, not indented under the
// cover.
function MediaGroup({ kind, item, cover, title, mediaTag, credits, genres = [], terms, onOpen, children }) {
  const hasChildren = Array.isArray(children) ? children.some(Boolean) : Boolean(children)
  return (
    <HandCard className="p-4">
      <div className="flex gap-4">
        <Tooltip label={t('search.hit.work.tip')} className="shrink-0">
          <button type="button" onClick={onOpen} aria-label={t('search.hit.work.aria', { title })} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
            {cover ? (
              <img
                src={coverImgURL(cover)}
                alt=""
                className="block w-16 object-cover"
                style={{ aspectRatio: '2 / 3', borderRadius: 6, border: '1px solid var(--ink-border)' }}
              />
            ) : (
              <Placeholder kind={kind} className="w-16" />
            )}
          </button>
        </Tooltip>
        <div className="min-w-0 flex-1">
          {/* Only the title opens the parent — the credit chips below are their
              own click targets (open the person), so they sit OUTSIDE this button. */}
          <button
            type="button"
            onClick={onOpen}
            className="block w-full text-left"
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
          >
            <p className="display-title text-[16.5px] leading-snug">
              <Highlight text={title} terms={terms} />
              {mediaTag && (
                <span className="mono-label" style={{ marginLeft: 8, fontSize: 'var(--type-ui-9)', color: 'var(--amber)', verticalAlign: 'middle' }}>
                  {mediaTag}
                </span>
              )}
              {/* Beside the title, in the same run as the FILM/SHOW tag: this is
                  the work's OWN mark, and the rows below carry their own. `quiet`
                  because the title is a button.

                  Guarded rather than left to QuizSkipMark's own null, because the
                  wrapper carries the gap — an empty span with a margin on it is
                  8px of nothing after every unmarked title. */}
              {skipReason(item) && (
                <span style={{ marginLeft: 8, verticalAlign: 'middle' }}>
                  <QuizSkipMark item={item} quiet />
                </span>
              )}
            </p>
          </button>
          {credits}
          {genres.length > 0 && (
            // One line, clipped at the card boundary (a soft fade marks the cut)
            // rather than wrapping to many rows.
            <div
              className="mt-1.5 flex gap-1.5"
              style={{
                flexWrap: 'nowrap',
                overflow: 'hidden',
                WebkitMaskImage: 'linear-gradient(to right, #000 82%, transparent)',
                maskImage: 'linear-gradient(to right, #000 82%, transparent)',
              }}
            >
              {genres.map((gn) => (
                <span key={gn} className="tp-chip" style={{ flex: 'none' }}>
                  {gn}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      {hasChildren && <div className="mt-3 space-y-2">{children}</div>}
    </HandCard>
  )
}

// ChildHit: an annotation / dialogue row inside a group, its own click target.
// ChildHit — one matching quote under a result heading, on every search
// surface: a book's annotations, a film's dialogues, a tag's quotes, a date's.
//
// `color` draws the same 4px left bar HandCard's `colorBar` draws, because a
// quote is the same object wherever it is listed and search was the one place
// that forgot. Via categoryVar rather than a copied hex, so renaming or
// recolouring a category repaints these rows immediately instead of on the next
// full reload — the same reason HandCard resolves it that way.
//
// No colour falls back to the border, not to slot 1: `--hl-1` is a real
// category somebody may have named, and painting an unknown row with it would
// be asserting a category that was never chosen.
//
// THE QUIZ MARK IS DRAWN HERE AND NOT AT THE FIVE CALL SITES, for the reason
// the colour bar is: five places rendering a quote is five places to add the
// next thing a quote says about itself, and the colour arrived late precisely
// because search had its own idea of what a quote row was. Passing `hit` costs
// each caller one prop; forgetting it at one of the five is a mark that is on a
// book's results and off a tag's, which nobody would ever notice.
function ChildHit({ color, hit, parent = '', onClick, children }) {
  const why = skipReason(hit, parent)
  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full text-left"
      style={{
        position: 'relative',
        background: 'var(--raised)',
        border: '1px solid var(--line)',
        borderLeft: `4px solid ${categoryVar(color) || 'var(--line)'}`,
        borderRadius: 8,
        // The mark gets a lane of its own rather than overprinting the words:
        // a search hit is windowed around the match, so the text runs to the
        // right edge by construction and there is no slack to borrow.
        padding: why ? '8px 30px 8px 12px' : '8px 12px',
        cursor: 'pointer',
      }}
    >
      {why && (
        <span className="absolute right-2 top-2">
          <QuizSkipMark item={hit} parent={parent} quiet />
        </span>
      )}
      {children}
    </button>
  )
}

// WorkResult: one grouped search card for a book or a film — the shared
// MediaGroup (cover/poster + title + split credit chips) plus its matching child
// hits (a book's annotations, a film's dialogues). `kind` is 'book' | 'movie'.
// Clicking a child opens the quote modal; the cover/title opens the parent; a
// credit chip opens that person. `people` is the credit map for the chips
// (authors / directors), `actorMap` the per-dialogue actor chips.
function WorkResult({ kind, g, view, terms, onOpen, onOpenQuote, onOpenPerson, people = {}, actorMap = {}, creditSeps, onFacet, face = 'character' }) {
  const isBook = kind === 'book'
  // Joined credits split into individual, clickable people (ROADMAP §11), the
  // same treatment the detail pages and group-by headings use.
  const creditNames = splitCredits(isBook ? g.author : g.director, creditSeps)
  const creditKind = isBook ? 'author' : 'director'
  const mediaTag = isBook ? null : t(g.media_type === 'show' ? 'common.badge.show' : 'common.badge.film')
  const credits = (creditNames.length > 0 || (!isBook && g.release_year)) ? (
    <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
      {creditNames.map((n) => (
        <PersonCredit
          key={n}
          kind={creditKind}
          name={n}
          person={people[n]}
          size={20}
          onOpen={onOpenPerson}
          nameStyle={{ fontSize: 'var(--type-ui-13)' }}
        />
      ))}
      {!isBook && g.release_year ? <MonoLabel style={{ fontSize: 'var(--type-ui-11)' }}>{g.release_year}</MonoLabel> : null}
    </div>
  ) : null
  return (
    <div className={view === 'tiles' ? 'mb-3 break-inside-avoid' : ''}>
      <MediaGroup
        kind={t(isBook ? 'common.badge.cover' : 'common.badge.poster')}
        item={g}
        cover={isBook ? g.cover_path : g.poster_path}
        title={g.title}
        terms={terms}
        mediaTag={mediaTag}
        credits={credits}
        genres={g.genres || []}
        onOpen={() => onOpen(g.id)}
      >
        {(isBook ? g.annotations : g.dialogues).map((h) =>
          isBook ? (
            <ChildHit key={h.id} color={h.color} hit={h} parent="book" onClick={() => onOpenQuote({ kind: 'book', hit: h })}>
              {h.quote && (
                <MatchWindow text={h.quote} terms={terms} style={{ fontFamily: 'var(--font-display)', fontWeight: 'var(--font-display-weight)', fontVariantCaps: 'var(--font-display-caps)', textTransform: 'var(--font-display-case)', fontVariantNumeric: 'var(--font-display-figures)', fontStyle: 'italic', fontSize: 'var(--type-display-15)', lineHeight: 1.5 }} />
              )}
              {h.note && (
                <HandNote>
                  <Highlight text={h.note} terms={terms} />
                </HandNote>
              )}
            </ChildHit>
          ) : (
            <ChildHit key={h.id} color={h.color} hit={h} parent={g.media_type === 'show' ? 'show' : 'film'} onClick={() => onOpenQuote({ kind: 'movie', hit: h })}>
              <MatchWindow text={h.quote} terms={terms} style={{ fontFamily: 'var(--font-display)', fontWeight: 'var(--font-display-weight)', fontStyle: 'var(--font-display-style)', fontVariantCaps: 'var(--font-display-caps)', textTransform: 'var(--font-display-case)', fontVariantNumeric: 'var(--font-display-figures)', fontSize: 'var(--type-display-15)', lineHeight: 1.5 }} />
              {/* The margin note (highlighted — this is what a Notes hit matched on). */}
              {h.note && (
                <HandNote>
                  <Highlight text={h.note} terms={terms} />
                </HandNote>
              )}
              <span className="mt-1 flex items-center gap-1.5">
                {/* THE FACE THE SECTION ASKED FOR. Under Actors it is the actor,
                    because searching a name is asking about that person; anywhere
                    else it is the character, because a character speaks the line.
                    Falls back to the actor when the role has no stored picture,
                    which is most roles. */}
                {face === 'character' && h.character_images?.length ? (
                  <CharacterFaces images={h.character_images} size={22} ring="var(--raised)" />
                ) : (
                  <CreditFaces names={splitCredits(h.actor, creditSeps)} map={actorMap} size={22} ring="var(--raised)" />
                )}
                <MonoLabel className="block min-w-0 truncate">
                  {/* The character is a BUTTON. Pressing it narrows the whole
                      search to that speaker, which is what turns "I found the
                      line" into "I found who says it". stopPropagation because
                      the row underneath opens this one line, and both gestures
                      are wanted.

                      Split on the credit separators like every other credit, so
                      a two-hander gives two names and two chips — the same split
                      the vocabulary and the grouping use, or pressing one would
                      send a joined name that matches nothing. */}
                  <CharacterCredits names={splitCredits(h.character, creditSeps)} terms={terms} onFacet={onFacet} />
                  {h.character && h.actor ? ' · ' : ''}
                  {h.actor && <Highlight text={h.actor} terms={terms} />}
                  {episodeLabel(h) ? `  ·  ${episodeLabel(h)}` : ''}
                  {h.timestamp ? `  ·  ${h.timestamp}` : ''}
                </MonoLabel>
              </span>
            </ChildHit>
          ),
        )}
      </MediaGroup>
    </div>
  )
}


// CharacterCredits renders the speaker(s) of a line as press-to-narrow names.
//
// NO PORTRAIT, and it is the one credit in this file that gets none. Authors,
// directors, actors and speakers all resolve to a `people` row with a
// photograph; a character resolves to nobody, because there is nobody. Hanging
// the actor's face here would answer a question that was not asked and get it
// wrong the moment a part is recast or shared.
//
// Falls back to plain text when there is no `onFacet` — the same markup this
// used to be — so a caller that cannot narrow still renders the name.
function CharacterCredits({ names, terms, onFacet }) {
  if (!names.length) return null
  return names.map((name, i) => (
    <span key={name}>
      {i > 0 ? ' · ' : ''}
      {onFacet ? (
        <button
          type="button"
          className="facet-mini"
          title={t('search.character.all.tip', { name })}
          onClick={(e) => {
            e.stopPropagation()
            onFacet('character', name)
          }}
        >
          <Highlight text={name} terms={terms} />
        </button>
      ) : (
        <Highlight text={name} terms={terms} />
      )}
    </span>
  ))
}

// ResultSection renders one kind's groups — flat when group === 'none', else
// bucketed into labelled sub-sections. renderItem(g) returns a keyed card.
// For book author buckets, the heading shows the author portrait (people map)
// and opens the metadata panel on click.
function ResultSection({ label, groups, group, view, isMovie, renderItem, people, onOpenPerson, creditSeps, count }) {
  // The header count defaults to the number of work groups (Books/Movies, where
  // one group == one work), but a caller can override it with the hit count —
  // Annotations/Dialogues fold many quote hits under one parent work, so their
  // count is the number of quotes, matching the table view.
  const n = count ?? groups.length
  // Results stay in bm25 relevance order (Masonry order="source" — no height
  // sort, no jitter), but tiles pack the shared greedy way every other board
  // does: each card lands on the SHORTEST column, so the last hit can't leave
  // one column hanging long. list is a plain vertical stack.
  const tileCols = useColumnsAt([[1600, 4], [1180, 3], [768, 2]])
  const pack = (items) =>
    view === 'tiles' ? (
      <Masonry columns={tileCols} gap={12} order="source">{items.map(renderItem)}</Masonry>
    ) : (
      <div className="space-y-3">{items.map(renderItem)}</div>
    )
  if (group === 'none') {
    return (
      <section className="space-y-3">
        <MonoLabel className="block">{t('search.section.heading', { name: label, n })}</MonoLabel>
        {pack(groups)}
      </section>
    )
  }
  return (
    <section className="space-y-4">
      <MonoLabel className="block">{t('search.section.heading', { name: label, n })}</MonoLabel>
      {groupWorks(groups, group, {
        credit: (g) => (isMovie ? g.director : g.author),
        splitCredit: !isMovie,
        creditResidual: t(isMovie ? 'search.group.residual.director.label' : 'search.group.residual.author.label'),
        year: (g) => (isMovie ? g.release_year : g.published_year),
        genres: (g) => g.genres || [],
        series: (g) => g.series,
        seps: creditSeps,
      }).map((b) => {
        // The "by author" dimension maps to the director for movies (see the
        // groupWorks call above), so the same heading opens the People panel: an
        // author for books, a director for movies. Residual buckets ("Unknown …")
        // stay plain text.
        const isPersonGroup = group === 'author' && !b.residual
        const personKind = isMovie ? 'director' : 'author'
        const portrait = isPersonGroup && people ? people[b.label] : null
        return (
          <div key={b.key} className="space-y-2">
            <div className="flex items-center gap-3">
              {portrait && <PersonPortrait person={portrait} size={28} />}
              {isPersonGroup && onOpenPerson ? (
                <Tooltip label="Open this person's details" side="bottom" className="min-w-0">
                  <button
                    type="button"
                    className="display-title truncate"
                    style={{ fontSize: 'var(--type-ui-17)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}
                    onClick={() => onOpenPerson({ kind: personKind, name: b.label })}
                  >
                    {b.label}
                  </button>
                </Tooltip>
              ) : (
                <h3 className="display-title truncate" style={{ fontSize: 'var(--type-ui-17)' }}>{b.label}</h3>
              )}
              <MonoLabel style={{ color: 'var(--accent-ui)' }}>{b.items.length}</MonoLabel>
              <span className="h-px flex-1" style={{ background: 'var(--line)' }} />
            </div>
            {pack(b.items)}
          </div>
        )
      })}
    </section>
  )
}

// Board — the shared packing for the facet sections: source-order masonry in
// tiles view (same greedy shortest-column fill every other board uses), a
// vertical stack in list view.
function Board({ view, children }) {
  const cols = useColumnsAt([[1600, 4], [1180, 3], [768, 2]])
  return view === 'tiles' ? (
    <Masonry columns={cols} gap={12} order="source">{children}</Masonry>
  ) : (
    <div className="space-y-3">{children}</div>
  )
}

// PeopleSection — one facet section per credit kind (Authors · Directors ·
// Actors): each matched person renders a portrait + name heading (opens the
// People panel) over the works / dialogues carrying the credit.
function PeopleSection({ label, kind, entries, people, onOpenPerson, view, render }) {
  return (
    <section className="space-y-4">
      <MonoLabel className="block">{t('search.section.heading', { name: label, n: entries.length })}</MonoLabel>
      {entries.map((e) => (
        <div key={e.name} className="space-y-2">
          <div className="flex items-center gap-3">
            {people?.[e.name] && <PersonPortrait person={people[e.name]} size={28} />}
            <Tooltip label="Open this person's details" side="bottom" className="min-w-0">
              <button
                type="button"
                className="display-title truncate"
                style={{ fontSize: 'var(--type-ui-17)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}
                onClick={() => onOpenPerson({ kind, name: e.name })}
              >
                {e.name}
              </button>
            </Tooltip>
            <MonoLabel style={{ color: 'var(--accent-ui)' }}>{e.count}</MonoLabel>
            <span className="h-px flex-1" style={{ background: 'var(--line)' }} />
          </div>
          <Board view={view}>{e.groups.map(render)}</Board>
        </div>
      ))}
    </section>
  )
}

// QuoteHit — one standalone-quote result (§24). It is its own renderer because
// a quote of this kind has no parent to name underneath it: where an annotation
// shows "Book · Author", this shows the occasion it was said on.
//
// The key prefix is `u` because `a`/`d`/`b`/`m` are taken and the kinds share
// one children array — two hits with the same numeric id from different tables
// would otherwise collide and React would drop one.
// No `parent` on the hit below: a standalone quote has none, so the only quiz
// mark it can wear is its own.
function QuoteHit({ h, terms, onOpen, people = {}, seps }) {
  return (
    <ChildHit key={`u${h.id}`} color={h.color} hit={h} onClick={() => onOpen({ kind: 'utterance', hit: h })}>
      {(h.quote || h.note) && (
        <MatchWindow
          text={h.quote || h.note}
          terms={terms}
          style={{ fontFamily: 'var(--font-display)', fontWeight: 'var(--font-display-weight)', fontVariantCaps: 'var(--font-display-caps)', textTransform: 'var(--font-display-case)', fontVariantNumeric: 'var(--font-display-figures)', fontStyle: 'italic', fontSize: 'var(--type-display-15)', lineHeight: 1.5 }}
        />
      )}
      <span className="mt-1 flex items-center gap-1.5">
        {/* Speaker face(s), split the way a dialogue hit splits its actors. A
            FACE and not a PersonName: the whole row is already a click target
            that opens the quote, and nesting a second one inside it means a
            near-miss opens the wrong thing. The panel is one tap further in. */}
        <CreditFaces names={splitCredits(h.speaker, seps)} map={people} size={22} ring="var(--raised)" />
        <MonoLabel className="block min-w-0 truncate">
          {[h.speaker, h.occasion].filter(Boolean).join(' · ')}
        </MonoLabel>
      </span>
    </ChildHit>
  )
}

// TagSection — matched tags, each a chip heading over the quotes wearing it
// (annotations, dialogues and standalone quotes mixed); a child opens the quote
// modal.
function TagSection({ tags, terms, onOpenQuote, speakerMap, creditSeps }) {
  return (
    <section className="space-y-4">
      <MonoLabel className="block">
        {t('search.section.heading', { name: t('search.section.tags.title'), n: tags.length })}
      </MonoLabel>
      {tags.map((tag) => (
        <div key={tag.name} className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="tp-chip">{tag.name}</span>
            <MonoLabel style={{ color: 'var(--accent-ui)' }}>{tag.count}</MonoLabel>
            <span className="h-px flex-1" style={{ background: 'var(--line)' }} />
          </div>
          <div className="space-y-2">
            {(tag.annotations || []).map((h) => (
              <ChildHit key={`a${h.id}`} color={h.color} hit={h} parent="book" onClick={() => onOpenQuote({ kind: 'book', hit: h })}>
                {(h.quote || h.note) && (
                  <MatchWindow text={h.quote || h.note} terms={terms} style={{ fontFamily: 'var(--font-display)', fontWeight: 'var(--font-display-weight)', fontVariantCaps: 'var(--font-display-caps)', textTransform: 'var(--font-display-case)', fontVariantNumeric: 'var(--font-display-figures)', fontStyle: 'italic', fontSize: 'var(--type-display-15)', lineHeight: 1.5 }} />
                )}
                <MonoLabel className="mt-1 block min-w-0 truncate">
                  {[h.book_title, h.book_author].filter(Boolean).join(' · ')}
                </MonoLabel>
              </ChildHit>
            ))}
            {(tag.dialogues || []).map((h) => (
              <ChildHit key={`d${h.id}`} color={h.color} hit={h} parent={h.movie_media_type === 'show' ? 'show' : 'film'} onClick={() => onOpenQuote({ kind: 'movie', hit: h })}>
                <MatchWindow text={h.quote} terms={terms} style={{ fontFamily: 'var(--font-display)', fontWeight: 'var(--font-display-weight)', fontStyle: 'var(--font-display-style)', fontVariantCaps: 'var(--font-display-caps)', textTransform: 'var(--font-display-case)', fontVariantNumeric: 'var(--font-display-figures)', fontSize: 'var(--type-display-15)', lineHeight: 1.5 }} />
                <MonoLabel className="mt-1 block min-w-0 truncate">
                  {[h.movie_title, h.character].filter(Boolean).join(' · ')}
                </MonoLabel>
              </ChildHit>
            ))}
            {/* The count above has included these since the backend learned the
                third kind, so leaving them out rendered "grief · 3" over a box
                holding one row. */}
            {(tag.quotes || []).map((h) => (
              <QuoteHit key={`u${h.id}`} h={h} terms={terms} onOpen={onOpenQuote} people={speakerMap} seps={creditSeps} />
            ))}
          </div>
        </div>
      ))}
    </section>
  )
}

// GenreSection — matched genres, each a chip heading over the works shelved
// under it (books + films/shows).
function GenreSection({ genres, view, renderBook, renderMovie }) {
  return (
    <section className="space-y-4">
      <MonoLabel className="block">
        {t('search.section.heading', { name: t('search.section.genres.title'), n: genres.length })}
      </MonoLabel>
      {genres.map((g) => (
        <div key={g.name} className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="tp-chip">{g.name}</span>
            <MonoLabel style={{ color: 'var(--accent-ui)' }}>{(g.books?.length || 0) + (g.movies?.length || 0)}</MonoLabel>
            <span className="h-px flex-1" style={{ background: 'var(--line)' }} />
          </div>
          <Board view={view}>
            {[
              ...groupBooks({ books: g.books || [], annotations: [] }).map(renderBook),
              ...groupMovies({ movies: g.movies || [], dialogues: [] }).map(renderMovie),
            ]}
          </Board>
        </div>
      ))}
    </section>
  )
}

// DateSection — everything added on one day (the Stats calendar's dot target):
// the works shelved that day, then the quotes captured that day under their
// parent works.
function DateSection({ d, view, terms, renderBook, renderMovie, onOpenQuote, speakerMap, creditSeps }) {
  const pretty = new Date(d.date + 'T00:00:00').toLocaleDateString(undefined, { dateStyle: 'long' })
  const works = [
    ...groupBooks({ books: d.books || [], annotations: [] }).map(renderBook),
    ...groupMovies({ movies: d.movies || [], dialogues: [] }).map(renderMovie),
  ]
  const quotes = [
    ...groupBooks({ books: [], annotations: d.annotations || [] }).map(renderBook),
    ...groupMovies({ movies: [], dialogues: d.dialogues || [] }).map(renderMovie),
  ]
  const n =
    (d.books?.length || 0) +
    (d.movies?.length || 0) +
    (d.annotations?.length || 0) +
    (d.dialogues?.length || 0) +
    (d.quotes?.length || 0)
  // Standalone quotes cannot go through groupBooks/groupMovies — those bucket
  // hits under a parent work, and this kind has none. They render as their own
  // flat block below the work cards.
  const standalone = d.quotes || []
  return (
    <section className="space-y-3">
      <MonoLabel className="block">{t('search.section.date.title', { date: pretty, n })}</MonoLabel>
      {works.length > 0 && <Board view={view}>{works}</Board>}
      {quotes.length > 0 && <Board view={view}>{quotes}</Board>}
      {standalone.length > 0 && (
        <div className="space-y-2">
          {standalone.map((h) => (
            <QuoteHit key={`u${h.id}`} h={h} terms={terms} onOpen={onOpenQuote} people={speakerMap} seps={creditSeps} />
          ))}
        </div>
      )}
    </section>
  )
}

// groupBooks merges matched books and matched annotations into per-book groups,
// preserving bm25 order (matched books first, then annotation-only books).
function groupBooks(r) {
  const order = []
  const byId = new Map()
  const ensure = (id, seed) => {
    let g = byId.get(id)
    if (!g) {
      g = { id, title: '', author: '', cover_path: '', genres: [], published_year: 0, series: '', series_index: 0, review_excluded: false, annotations: [], ...seed }
      byId.set(id, g)
      order.push(g)
    }
    return g
  }
  for (const b of r.books || []) {
    ensure(b.id, { title: b.title, author: b.author, cover_path: b.cover_path, genres: b.genres, published_year: b.published_year, series: b.series, series_index: b.series_index, review_excluded: b.review_excluded })
  }
  for (const a of r.annotations || []) {
    // Parent-book fields on the annotation hit so an annotation-only group still
    // buckets by author/decade/series/genre — and, since 1.14.2, so an
    // annotation-only group can still draw the book's quiz mark. A group seeded
    // from a book hit already has it and `ensure` keeps the first seed; both
    // sources read the same column, so they cannot disagree.
    const g = ensure(a.book_id, { title: a.book_title, cover_path: a.book_cover_path, author: a.book_author, genres: a.book_genres, published_year: a.book_published_year, series: a.book_series, review_excluded: a.work_review_excluded })
    g.annotations.push(a)
  }
  return order
}

// groupMovies mirrors groupBooks for movies + dialogues.
function groupMovies(r) {
  const order = []
  const byId = new Map()
  const ensure = (id, seed) => {
    let g = byId.get(id)
    if (!g) {
      g = { id, title: '', director: '', release_year: 0, poster_path: '', genres: [], series: '', series_index: 0, media_type: 'movie', review_excluded: false, dialogues: [], ...seed }
      byId.set(id, g)
      order.push(g)
    }
    return g
  }
  for (const m of r.movies || []) {
    ensure(m.id, { title: m.title, director: m.director, release_year: m.release_year, poster_path: m.poster_path, genres: m.genres, series: m.series, series_index: m.series_index, media_type: m.media_type, review_excluded: m.review_excluded })
  }
  for (const d of r.dialogues || []) {
    const g = ensure(d.movie_id, { title: d.movie_title, poster_path: d.movie_poster_path, director: d.movie_director, release_year: d.movie_release_year, genres: d.movie_genres, series: d.movie_series, media_type: d.movie_media_type, review_excluded: d.work_review_excluded })
    g.dialogues.push(d)
  }
  return order
}

// A quote longer than this gets windowed around the match; shorter ones show
// whole. PAD is roughly a card line of characters each side of the term, so the
// window reads as "a line above and below" the match.
const WINDOW_MAX = 200
const WINDOW_PAD = 75

// escapeTerms builds the shared match pattern (also used by Highlight).
function termPattern(terms, flags) {
  return new RegExp('(' + terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', flags)
}

// MatchWindow shows a long quote as a context window: the run of text around
// the first matched term (about a line either side, snapped to word bounds),
// with a chevron above when text is hidden before the window and below when
// hidden after — a compact "there's more, open to read it" cue. Short quotes,
// or quotes with no visible match, render whole (opening the modal shows all).
function MatchWindow({ text, terms, style }) {
  const s = String(text || '')
  // Honour the quote's own line breaks / paragraphs (matching the detail cards).
  const qStyle = { whiteSpace: 'pre-wrap', ...style }
  const inner = <span style={qStyle}><Highlight text={s} terms={terms} /></span>
  if (!terms.length || s.length <= WINDOW_MAX) return inner
  const m = termPattern(terms, 'i').exec(s)
  if (!m) return inner
  const mi = m.index
  const me = mi + m[0].length
  let start = Math.max(0, mi - WINDOW_PAD)
  let end = Math.min(s.length, me + WINDOW_PAD)
  // Snap the cut points to word boundaries so the window never slices a word.
  if (start > 0) {
    const sp = s.indexOf(' ', start)
    if (sp !== -1 && sp < mi) start = sp + 1
  }
  if (end < s.length) {
    const sp = s.lastIndexOf(' ', end)
    if (sp !== -1 && sp > me) end = sp
  }
  const before = start > 0
  const after = end < s.length
  const chev = (dir) => (
    <span aria-hidden="true" style={{ display: 'block', textAlign: 'center', lineHeight: 1, fontSize: 'var(--type-ui-11)', color: 'var(--faint)' }}>
      {dir === 'up' ? '⌃' : '⌄'}
    </span>
  )
  return (
    <span style={{ display: 'block' }}>
      {before && chev('up')}
      <span style={qStyle}><Highlight text={s.slice(start, end)} terms={terms} /></span>
      {after && chev('down')}
    </span>
  )
}

// Highlight wraps query terms in the §6 accent highlight span. Pure text
// splitting — no HTML injection. Case-insensitive; FTS accent-folding
// (Bronte→Brontë) is server-side only, so accented matches render unhighlighted.
function Highlight({ text, terms }) {
  if (!text || terms.length === 0) return text || null
  const parts = String(text).split(termPattern(terms, 'gi'))
  return parts.map((part, i) => (i % 2 === 1 ? <HighlightSpan key={i}>{part}</HighlightSpan> : part))
}

// queryTerms splits the search input into highlightable tokens.
function queryTerms(q) {
  return q.trim().split(/\s+/).filter(Boolean)
}
