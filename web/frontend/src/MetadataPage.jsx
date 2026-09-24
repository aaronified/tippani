import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useStuck } from './stuck.js'
import { CATEGORY_SLOTS, categoryHidden, categoryName, categoryVar } from './theme.js'
import { languageMarksState } from './languages.jsx'
import { cachedVocabulary, primeSearchVocabulary } from './vocabulary.js'
import { coverImgURL, errText, json } from './api.js'
import TagsPage from './TagsPage.jsx'
import { t } from './i18n.js'
import { BookLookupPicker, MovieLookupPicker } from './CoverPicker.jsx'
import { bookState, EditBook } from './Library.jsx'
import { EditMovie } from './Movies.jsx'
import { BulkBar, EmptyState, ErrorText, FieldIconButton, GhostButton, HandCard, Card, SectionTitle, IconBooks, IconButton, IconChecks, IconDelete, IconEdit, IconKey, IconLanguages, IconMerge, IconMetadata, IconOpen, IconPerson, IconFetch, IconSearch, IconUsers, InfoDot, MonoLabel, NameInput, NameScroll, normName, MobileSheet, ProgressBar, IconQuote, IconReel, Scroller, Select, splitCommas, toast, Tooltip, PanelHost, usePanelStack, useConfirm, useIsMobileScreen, usePersistedState, useScreenBar, useScreenSearch, IconArrow, IconHighlight, Lightbox, IconRoleActor, IconRoleAuthor, IconRoleDirector, IconRolePublisher, IconRoleSpeaker, IconRoleStudio, IconRoleTranslator, IconNavCatalogue, IconNavMasks, IconNavSources, IconNavTags, IconNavUsers, IconNavWorks, IconNavQuotes, IconNavLibrary, Tally } from './ui.jsx'
import { personImgURL, ProviderChips, mergeLinks, parseCreditSeps, parseLinks, splitCredits } from './people.jsx'
import { characterPanel, MergeSheet, personPanel } from './identity.jsx'
import { ColourCategoriesCard } from './Settings.jsx'
import { CardHead } from './prefRow.jsx'
import { LanguageMarksSettings, MetadataSources } from './MetadataSources.jsx'
import { Face } from './characterRows.jsx'
import { RecordRow, RowArt } from './recordRow.jsx'
import { SectionRail } from './sectionRail.jsx'
import { ReverifyFlow } from './ReverifyReview.jsx'
import { CreditPills, IssuePills, RowCounts, WorkPills } from './issuePills.jsx'
import { workDetailsPanel } from './WorkDetails.jsx'
import { nearDupGroups } from './nearDupes.js'

// Metadata tab — a management console: coverage stats up top, then filterable
// books / films-shows lists with multi-select bulk actions (fill actors, delete,
// fetch missing covers) plus per-row review-each look-up, and a per-title speaker
// remap tool. The point of the tab is doing metadata at scale, not one at a time.
// ---- THE SECTIONS -----------------------------------------------------------
//
// This screen was one long scroll with six consoles stacked on it: a stats strip,
// the catalogue, duplicates, people, characters and a speaker remap. Reaching the
// character list meant scrolling past four other consoles, nothing on screen said
// how many there were, and the phone answered the whole problem by showing almost
// none of it. The owner's ruling: "each type of metadata would deserve their own
// in depth page/section."
//
// A RAIL, NOT A TAB STRIP, and the difference is the count on each row. The
// question this screen answers is "what still needs work", and a tab that says
// only "People" makes a reader open it to find out whether it is worth opening.
// Every row carries its number, so the screen answers before it is entered.
//
// IT IS THE SAME ROWS ON A PHONE. The old phone screen was a different
// screen — three maintenance buttons, two one-line summaries and no browsable
// record at all — so "can I fix this from my phone" answered "some of it, and you
// cannot see which". The rail becomes a scrolling row of the same four, under the
// app's own edge fade; what changes inside a section is how much of a table a
// 390px column can hold, and the app's table wrapper already scrolls.
//
// THE ORDER IS THE ORDER OF THE QUESTION. "What still needs work" first, because
// that is why anybody opens this screen; then the three kinds of record; then
// where they come from. Sources sits last because it is a setting rather than a
// thing to work on — it was a card on the Settings page, two clicks from every
// record it configures, and a reader looking at a work filtered by "no source"
// had to leave the console to fix the reason.
// THE ICON IS THE ELEMENT, NOT THE COMPONENT. An element in a constant is an
// ordinary object and React is content to render the same one repeatedly. A
// component held in a loop variable and then rendered by that variable's name
// reads to icon-imports.test.js as a component nothing imports — and that sweep
// catches real omissions, so the cheaper move is to stop looking like one.
// EVERY DOOR'S GLYPH IS THE APP'S OWN, and four of the five changed when the owner
// went through them: "give icons to all the sections, from the icon sources, do not
// make them up yourself. Tag has the icon. People: filled in people icon. Character
// will get the drama mask icon, filled in. Sources and works: you decide."
//
// People and Characters BOTH DREW A HEAD before this — IconUsers and IconPerson, two
// doors side by side distinguished only by their words. People takes the filled
// IconNavUsers; Characters takes the drama mask, which is the one glyph in the set
// that says "a part somebody plays" rather than "a person".
//
// Works and Sources were mine to pick. Works is `shapes` (see IconNavWorks for why a
// mixture of books and films has no glyph and what was chosen instead); Sources is the
// key, because that section is where the API keys are kept and a key is what a reader
// goes there holding.
// What each section's info dot says. Derived from the id rather than kept as a
// fourth column, for the reason `sectionInfoKey` gives in Settings.jsx: a column
// that is the same expression for every row is a rule, not data — and a rule typed
// eight times is eight chances to typo one into a key that resolves to nothing.
const metadataSectionInfoKey = (id) => `metadata.section.${id}.info.body`

// An address for a section that was folded into another.
const SECTION_ALIASES = { tags: 'categories' }

const METADATA_SECTIONS = [
  ['works', 'metadata.section.works.label', <IconNavWorks />],
  ['people', 'metadata.section.people.label', <IconNavUsers />],
  ['characters', 'metadata.section.characters.label', <IconNavMasks />],
  // LANGUAGES IS A SECTION, AND THE v3 PACK DOES NOT DRAW ONE. That is the pack
  // being wrong rather than this being an invention: its own Settings prototype
  // says the quote faces are "read from the metadata language table, which is the
  // only place a quote's language is defined; Settings links there rather than
  // keeping a second list" — so it removed the door and never built the room. The
  // table was a FormModal behind a button inside Sources, which is not somewhere
  // another screen can send a reader.
  ['languages', 'metadata.section.languages.label', <IconLanguages />],
  // CATEGORIES: THE COLOURS AND THE TAGS, ONE SECTION. The owner: "merge the tags
  // and the colours metadata pages into one". Both are labels a reader makes and
  // files quotes under — a colour says what KIND of note a quote is, a tag what it
  // is ABOUT — and stickers ride with the tags as they always have. Tags had been a
  // section of its own since it left the nav ("tags should be a section within
  // metadata"); colour categories came over from Settings. The id stays
  // `categories`, so the colours' address still works and /metadata/tags is an
  // alias of it (SECTION_ALIASES).
  ['categories', 'metadata.section.categories.label', <IconNavTags />],
  ['sources', 'metadata.section.sources.label', <IconNavSources />],
]

// SectionRail — the doors, each wearing its own number.
//
// A count of `null` prints nothing rather than a zero: "0 characters" and "not
// loaded yet" are different facts and a zero that turns into 41 a moment later is
// the more misleading of the two. The overview's number is the only one that is a
// count of PROBLEMS rather than of records, so it is the only one that goes red.
//
// The section rail is `sectionRail.jsx` now, and it is shared with Settings — the
// v3 pack draws both screens the same way, and the repo's directive is that a
// control on two screens lives in one function both call. What used to be this
// function's body is that module; what stays here is the section table it is
// handed and this screen's own words for it.


export default function MetadataPage({ user, onOpenBook, onOpenMovie, onSearch, onPreferences, section: routed = null, onSection = null, onRedirectSection = null }) {
  const [lib, setLib] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState('')
  // Force-fetch & re-verify (ROADMAP §2): {book_ids, movie_ids, people} or null.
  const [reverify, setReverify] = useState(null)

  // WHAT THE READER CAME TO DO, CARRIED IN WITH THEM.
  //
  // The phone's index rows carry their section's headline verb, and two of those
  // verbs cannot be run from the index: a duplicate scan renders a list of groups
  // to merge, and a people fetch renders a progress bar over rows the console has
  // filtered. Lifting either BUTTON alone onto the index would give a press that
  // does its work somewhere the reader cannot see, which is worse than the extra
  // press it saves.
  //
  // SO THE VERB IS A DOOR THAT ARRIVES RUNNING. Pressing it walks into the section
  // and starts the act there, where its results, its errors and its confirms
  // already live. One press instead of two, and nothing moved.
  //
  // IT IS CONSUMED ON ARRIVAL rather than held: a section that kept its intent
  // would re-scan every time the reader walked back into it, which is a control
  // that cannot be un-pressed.
  const [intent, setIntent] = useState(null)

  async function load() {
    const r = await json('GET', '/metadata/library')
    if (r.ok) setLib(r.data)
    else setError(errText(r))
  }
  useEffect(() => {
    load()
  }, [])

  // Fetch missing covers/posters for the whole library (Open Library by ISBN,
  // Amazon by ASIN, cached posters — no key needed). Admin-only endpoint.
  // The endpoint is chunked ({cursor} → {next_cursor, done, total, remaining}),
  // so this loops chunk by chunk and drives a real progress bar.
  const [progress, setProgress] = useState(null) // {done, total} while running
  // missingOnly = fill empty covers/posters + details only, never upgrade stored
  // low-res art — the "no replacement" mode the stripped-down mobile screen uses.
  async function fetchMissingCovers(missingOnly = false) {
    setBusy(true)
    setError('')
    setFlash('')
    // Seed progress before the first request so the bar paints immediately, even
    // when the whole library fits in one chunk (React would otherwise batch the
    // set-then-clear into a single render and the bar would never show). total 0
    // => indeterminate stripe until the first chunk reports the real total.
    setProgress({ done: 0, total: 0 })
    const sum = { fetched: 0, enriched: 0, failed: 0, skipped: 0 }
    try {
      let cursor = ''
      let total = 0
      for (;;) {
        const body = {}
        if (cursor) body.cursor = cursor
        if (missingOnly) body.missing_only = true
        const r = await json('POST', '/covers/refetch', body)
        if (!r.ok) return setError(errText(r, t('error.refetch.covers')))
        sum.fetched += r.data.fetched
        sum.enriched += r.data.enriched || 0
        sum.failed += r.data.failed
        sum.skipped += r.data.skipped || 0
        total = total || r.data.total
        setProgress({ done: total - r.data.remaining, total })
        if (r.data.done) break
        cursor = r.data.next_cursor
      }
      // Spell out skipped/failed so a partial run reads as intentional ("11
      // already had the best available") rather than a silent nothing-happened.
      // Real plural families where the English hedged with a parenthesised -s: a
      // locale file carries a plural category per language, and "cover(s)" works
      // in none of them.
      const parts = [
        t('metadata.fetch.flash.covers', { count: sum.fetched, n: sum.fetched }),
        t('metadata.fetch.flash.details', { count: sum.enriched, n: sum.enriched }),
      ]
      if (sum.skipped) parts.push(t('metadata.fetch.flash.skipped', { n: sum.skipped }))
      if (sum.failed) parts.push(t('metadata.fetch.flash.failed', { n: sum.failed }))
      if (!sum.fetched && !sum.enriched && !sum.skipped && !sum.failed) parts.length = 0
      setFlash(parts.length ? parts.join(' · ') : t('metadata.fetch.flash.uptodate'))
      load()
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  // Unified catalogue console: a type (all/book/movie/show) that drives which
  // filters the second dropdown offers, plus the chosen filter.
  const [catType, setCatType] = useState('all')
  const [catFilter, setCatFilter] = useState('flagged')

  // PICKING A GAP IS ONE VERB, AND IT WAS WRITTEN THREE TIMES. The desktop tiles,
  // the phone's issue rows and now the phone's coverage numbers all mean the same
  // thing — show me exactly the records with this problem — and each had its own
  // copy of "set the type, set the filter, go to the section". Three copies is how
  // one of them goes on being right while another quietly stops: the phone's
  // numbers were the copy that did not exist at all, and nothing said so.
  const pickGap = (type, filter, section = 'works') => {
    if (type) setCatType(type)
    if (filter) setCatFilter(filter)
    setSection(section)
  }
  const mobile = useIsMobileScreen()

  const stats = useMemo(() => {
    const b = lib?.books || []
    const m = lib?.movies || []
    const d = lib?.dialogue_stats || { total: 0, missing_actor: 0 }
    const count = (list, pred) => list.filter(pred).length
    return {
      books: {
        total: b.length,
        no_cover: count(b, (x) => !x.has_cover),
        low_res: count(b, (x) => x.low_res_cover),
        no_author: count(b, (x) => !x.has_author),
        no_series: count(b, (x) => !x.has_series),
        no_year: count(b, (x) => !x.has_year),
        no_genre: count(b, (x) => !x.has_genre),
        no_source: count(b, (x) => !x.has_ids),
      },
      movies: {
        total: m.length,
        no_poster: count(m, (x) => !x.has_poster),
        low_res: count(m, (x) => x.low_res_poster),
        no_cast: count(m, (x) => !x.has_cast),
        no_director: count(m, (x) => !x.has_director),
        no_year: count(m, (x) => !x.has_year),
        no_genre: count(m, (x) => !x.has_genre),
        no_source: count(m, (x) => !x.has_source),
      },
      dialogues: d,
    }
  }, [lib])

  // ADMIN-ONLY, AND ABSENT RATHER THAN GREYED for the same reason everywhere else
  // in this menu: a menu row cannot be disabled, so a reader who cannot run this
  // does not see it. The desktop header draws the same button; on a phone it has
  // never been reachable at all, and the ⋯ is where it now is.
  useScreenBar({
    // The count that the page header carries on a desk. On a phone the header
    // does not draw, so it goes where the screen's name already is.
    sub: mobile ? t('metadata.counts.mobile') : null,
    actions: () => (user?.is_admin
      ? [
          { id: 'h-do', heading: t('common.mono.actions.label') },
          { id: 'fetch', icon: <IconMetadata />, label: t('metadata.fetch.label'), onClick: () => fetchMissingCovers(false) },
        ]
      : []),
    // ── THE PHONE'S TWO SEATS, and they are the two halves of this page's job:
    // find out what is wrong, and fill in what is missing.
    //
    // FETCH IS ADMIN-ONLY AND ISSUES IS NOT. Reading what is incomplete is a
    // question anybody with the page open may ask; going out to five providers
    // and writing the answers back is not.
    keys: mobile ? [
      { id: 'issues', label: t('metadata.issues.title'), icon: <IconChecks size={24} />, onClick: () => setIssuesOpen(true) },
      ...(user?.is_admin ? [{
        id: 'fetch',
        label: t('metadata.fetch.label'),
        icon: <IconMetadata />,
        disabled: busy,
        onClick: () => fetchMissingCovers(true),
      }] : [
        // A READER WHO IS NOT AN ADMIN HAS ONE VERB HERE, and the seat beside it
        // was a blank — the exact hole the shell's default fills on screens that
        // publish nothing at all. A screen that publishes SOME keys opts out of
        // that default wholesale, so the second seat has to be asked for by name.
        { id: 'nav' },
      ]),
    ] : null,
  })
  const [issuesOpen, setIssuesOpen] = useState(false)
  // Persisted per device, like every other view preference in this app: which
  // metadata you were last working on is a fact about this screen at this desk,
  // not about the account.
  // THE SECTION IS THE ADDRESS, AND THE LAST ONE IS REMEMBERED. Two facts, and
  // they used to be one: the section lived only in localStorage, so it pushed no
  // history — the dock's Back key walked out of the whole screen and the page grew
  // its own second back arrow to make up for it, which is the second header the
  // owner reported. It is a route now (`/metadata/<section>`), so Back walks out of a
  // section into the index and a section can be linked to.
  //
  // THE REMEMBERED ONE IS WHAT A BARE ADDRESS RESOLVES TO, not a replacement for
  // the address: "somewhere you come back to, usually for the thing you were last
  // looking at" is still true, and landing on Overview every time is the scroll the rail
  // was supposed to have removed. So the address wins where there is one, the
  // memory answers where there is not, and every change writes both.
  //
  // AND A SECTION THAT NO LONGER EXISTS FALLS BACK rather than rendering nothing —
  // which is now true of a typed URL as well as of a stored key. localStorage
  // outlives a release and so does a bookmark; the failure mode of an unguarded
  // switch is a blank page with a rail that highlights no row.
  //
  // OVERVIEW IS GONE, AND WORKS IS WHERE A BARE ADDRESS FALLS BACK TO. The owner:
  // "remove the overview screen completely. We are not going to miss it. All
  // options are available on other screens." Its numbers are the Works issue pills,
  // its Fetch is the header's, and library-wide Re-verify is Works' select-all.
  const [remembered, remember] = usePersistedState('tippani:metasection', 'works')
  const known = (id) => METADATA_SECTIONS.some(([k]) => k === id)
  // A SECTION FOLDED INTO ANOTHER LANDS ON THE ONE THAT HOLDS IT: Tags is part of
  // Categories now, so an old /metadata/tags goes there rather than to Works.
  const aliased = (id) => SECTION_ALIASES[id] || id
  const sect = known(aliased(routed)) ? aliased(routed) : known(aliased(remembered)) ? aliased(remembered) : 'works'
  // AN ADDRESS FOR A SECTION THAT NO LONGER EXISTS IS REPLACED, not pushed over —
  // a bookmarked /metadata/overview lands on the section it resolves to, and Back
  // from there leaves Metadata instead of walking into a dead address.
  useEffect(() => {
    if (routed && !known(routed) && onRedirectSection) onRedirectSection(sect)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routed])
  const setSection = (id) => { remember(id); if (onSection) onSection(id) }
  // Walk into a section with something to do on arrival — see `intent` above.
  const enter = (id, why = null) => { setIntent(why); setSection(id) }

  // THE CHARACTER LIST IS THE PAGE'S, NOT THE CONSOLE'S, because the rail has to
  // print its size before the section is entered — and a list fetched twice is a
  // list that can disagree with the number beside its own door.
  const [chars, setChars] = useState(null)
  const loadChars = useCallback(async () => {
    const r = await json('GET', '/characters')
    if (r.ok) setChars(r.data.characters)
  }, [])
  // AND THE PEOPLE LIST FOR THE SAME REASON. The rail says how many records there
  // are, which is a different question from how many rows the console is showing
  // — that one is filtered by role and by the search box, and it says so itself.
  const [people, setPeople] = useState(null)
  const loadPeople = useCallback(async () => {
    const r = await json('GET', '/people/records')
    if (r.ok) setPeople(r.data.people || [])
  }, [])
  useEffect(() => {
    loadChars()
    loadPeople()
  }, [loadChars, loadPeople])

  const railCounts = {
    // ── A BADGE COUNTS WHAT IS WRONG, NOT WHAT IS THERE ──
    //
    // The owner, of the 189 on the Characters door: "The 189 badge on the top bar
    // means nothing. It should show count characters with issues." It meant
    // nothing because it was the size of the library, and the size of the library
    // is not news — it is the same number tomorrow, it never goes down when you
    // work, and a reader who wants it is one press from a list that says it.
    //
    // A NUMBER ON A DOOR IS A REASON TO OPEN IT. Every other badge in this app
    // says "there is something here for you"; these three said "this exists". So
    // all three count RECORDS WITH SOMETHING WRONG, off the same tables the pills
    // behind each door are counted from — which is what makes the badge and the
    // pills add up, and why they cannot drift apart.
    //
    // RECORDS, NOT FINDINGS. A film with no poster and no year is one film to go
    // and look at.
    works: lib ? worksWithIssues(lib) : null,
    people: people ? withAnyIssue(PERSON_ISSUES, people) : null,
    characters: chars ? withAnyIssue(CHARACTER_ISSUES, chars) : null,
    // The sources row carries no number. Every other door counts records or gaps;
    // this one is a set of settings, and "5 keys" answers a question nobody has.
    sources: null,
    // NOR DOES CATEGORIES, whose tags are fetched by the screen behind the door —
    // counting them here would be a second fetch of the same list and two numbers
    // that can disagree, the trap the character and people counts are lifted to avoid.
    categories: null,
  }
  // Built here rather than inside the sheet: the sheet is mounted only while open,
  // and the count belongs to the page whether or not anybody is looking at it.
  const issues = libraryIssues({ stats, people, chars })

  // WHAT EACH DOOR CARRIES ON THE PHONE'S INDEX — and it was a name, an arrow and
  // for two of them a button wearing only its glyph. The owner: "the metadata phone
  // index page looks like shit", beside a Settings index whose every card carries
  // the controls a reader comes for. The standing rule is the same one: use the
  // space, and put in front what is used most.
  //
  // SO EACH DOOR SAYS WHAT IS BEHIND IT. The three consoles show their open issues
  // as pills, and a pill is a door straight to the console filtered to that issue —
  // the numbers the issues sheet counts, where the reader was already looking. The
  // verbs keep their words (Scan, Fetch, Prune). Languages shows the languages in
  // their marks; Categories shows the colours by name. Sources has no summary that
  // does not need its own fetch, so it stays a door.
  // ONE PILL PER NAME. Books and films both have a "no source" gap, and two pills
  // reading "no source 22" side by side are two doors a reader cannot tell apart;
  // merged, the count is both and the door is Works across every type.
  const doorPills = (section) => {
    const byLabel = new Map()
    for (const i of issues.filter((x) => x.go.section === section)) {
      const got = byLabel.get(i.label)
      if (!got) byLabel.set(i.label, i)
      else byLabel.set(i.label, { ...got, n: got.n + i.n, go: { ...got.go, type: 'all' } })
    }
    return [...byLabel.values()]
  }
  // The library's languages, from the session cache and then fresh — the index is
  // often the first screen that asks, so reading the cache alone drew nothing.
  const [vocabLanguages, setVocabLanguages] = useState(() => cachedVocabulary()?.languages || [])
  useEffect(() => {
    if (!mobile) return
    primeSearchVocabulary().then((v) => setVocabLanguages(v?.languages || [])).catch(() => {})
  }, [mobile])
  const doorLanguages = mobile ? languageMarksState(vocabLanguages) : []
  const sectionActions = mobile ? {
    works: (
      <div className="section-index-body">
        <IssueDoors rows={doorPills('works')} onPick={pickGap} />
        <div className="section-index-verbs">
          <GhostButton icon={<IconSearch />} keepLabel onClick={() => enter('works', 'scan')}>
            {t('metadata.duplicates.scan.label')}
          </GhostButton>
        </div>
      </div>
    ),
    people: (
      <div className="section-index-body">
        <IssueDoors rows={doorPills('people')} onPick={pickGap} />
        <div className="section-index-verbs">
          <GhostButton icon={<IconMetadata />} keepLabel onClick={() => enter('people', 'fetch')}>
            {t('metadata.people.fetch.label')}
          </GhostButton>
          {/* THE SAME COMPONENT THE CONSOLE DRAWS, not a copy of its press — and it
              returns null when there is nothing to prune. */}
          <PruneButton onDone={() => { load(); loadPeople(); loadChars() }} onFlash={setFlash} />
        </div>
      </div>
    ),
    characters: doorPills('characters').length > 0 ? (
      <div className="section-index-body"><IssueDoors rows={doorPills('characters')} onPick={pickGap} /></div>
    ) : null,
    languages: doorLanguages.length > 0 ? (
      <div className="section-index-body">
        {/* A PREVIEW, NOT A ROW OF DOORS: every chip would open the same section,
            so they are drawn as what is there and the door is the row's arrow. */}
        <Scroller axis="x" className="issue-pills section-index-pills">
          {doorLanguages.map((row) => (
            <span key={row.key} className="section-index-preview">
              <span className="section-index-lang-mark" aria-hidden="true">{row.resolved || [...row.name][0]}</span>
              {row.name}
            </span>
          ))}
        </Scroller>
      </div>
    ) : null,
    categories: (
      <div className="section-index-body">
        <Scroller axis="x" className="issue-pills section-index-pills">
          {CATEGORY_SLOTS.filter((c) => !categoryHidden(c)).map((c) => (
            <span key={c} className="section-index-preview">
              <span className="section-index-swatch" style={{ background: categoryVar(c) }} aria-hidden="true" />
              {categoryName(c)}
            </span>
          ))}
        </Scroller>
      </div>
    ),
  } : {}
  return (
    <section className="space-y-6">
      {/* NO HEADER ROW AT ALL. The phone lost it first, for restating the shell
          bar; on a desk it survived as a row holding nothing but Fetch, which put
          Metadata's tabs a button's height lower than Settings' — the owner: "the
          space between the topbar and the tabs is not uniform… this seems to be
          the effect of the stray fetch button. that can be in the tab row itself."
          Fetch rides at the tab row's far end now, where Settings keeps Reset. */}
      <ErrorText>{error}</ErrorText>
      {busy && progress && (
        <ProgressBar
          value={progress.done}
          max={progress.total}
          label={progress.total > 0
            ? t('metadata.fetch.progress', { done: progress.done, total: progress.total })
            : t('metadata.fetch.progress.start')}
        />
      )}
      {flash && (
        <p className="microcopy" style={{ color: 'var(--accent-ui)' }}>
          {flash}
        </p>
      )}
      {/* THE RAIL SITS INSIDE THE FRAME, not above it, so that on a desk it is the
          left column of a two-column screen and on a phone it is the row across
          the top. One element, two arrangements, and the section it selects is
          beside it rather than a scroll below it. */}
      <SectionRail
          sections={METADATA_SECTIONS.map(([id, label, icon]) => ({
            id,
            label: t(label),
            icon,
            // WHAT THIS SECTION IS, and it is the dot the consoles below used to
            // draw for themselves. Settings' rail has carried one per section
            // since it was built; this one carried a single page-level dot, so
            // every console answered "what am I looking at" a second time under a
            // tab that had already named it.
            info: t(metadataSectionInfoKey(id)),
            count: railCounts[id],
            // WHAT THE NUMBER COUNTS, for everything that cannot see it is red.
            countWord: t('metadata.rail.count.word'),
            // EVERY NUMBER ON THIS RAIL IS A COUNT OF PROBLEMS NOW, so every one
            // of them warns when it is not zero. It used to be only Overview's,
            // because the other three counted records — see railCounts for why
            // that stopped.
            warn: railCounts[id] > 0,
            actions: sectionActions[id] || null,
          }))}
          value={sect}
          // CONTROLLED ONLY WHERE THERE IS AN ADDRESS TO CONTROL IT WITH. Passing
          // `!!routed` unconditionally pinned the rail shut on every mount that has
          // no navigator — a test, a screen rendered on its own — because `false`
          // is a controlled value and `undefined` is the ask to keep your own.
          // Nine suites' worth of the phone flow reported the index where a section
          // should have been, which is exactly what a reader would have got.
          open={onSection ? !!routed : undefined}
          onChange={setSection}
          ariaLabel={t('metadata.section.aria')}
          // THE TABS STAY ON SCREEN over the three long lists, above their stuck
          // toolbar, so a reader 400 rows down can still change section.
          stickyRail={sect === 'works' || sect === 'people' || sect === 'characters'}
          aside={user?.is_admin ? {
            action: (
              <IconButton
                icon={<IconMetadata />}
                label={t('metadata.fetch.label')}
                ariaLabel={t('metadata.fetch.aria')}
                tooltip={t('metadata.fetch.tip')}
                tipSide="bottom"
                onClick={() => fetchMissingCovers(false)}
                disabled={busy}
              />
            ),
          } : null}
          /* NO PAGE-LEVEL DOT, and Settings' identical rail never had one. The
             index carried a dot saying "this is the trimmed-down maintenance
             view — open Tippani on a desktop for the full metadata console",
             which was two wrongs at once: every row below it already carries its
             own dot naming what that section is, and the sentence stopped being
             true when the v3 work put the whole console on the phone. A dot that
             answers a question the rows have answered is the noise the one-dot-
             per-section rule was made to remove; one that answers it wrongly is
             worse than noise. */
        >
          <div className="meta-stack">
          {!lib ? (
            <EmptyState>{t('common.state.loading')}</EmptyState>
          ) : sect === 'works' ? (
            <>
              {/* DUPLICATES FIRST, AND THAT IS WHERE THE OWNER PUT IT: "should be
                  on top". It sat under the catalogue — below a list that is
                  hundreds of rows on a real library — so the one control on this
                  screen that FINDS something you did not know about was the one
                  you had to scroll past everything to reach. A list you browse
                  can wait; a problem you did not know you had cannot announce
                  itself from the bottom of a scroll. */}
              <DuplicatesPanel
                onDone={load}
                onFlash={setFlash}
                arriveScanning={intent === 'scan'}
                onArrived={() => setIntent(null)}
              />
              <CatalogueConsole
                books={lib.books}
                movies={lib.movies}
                type={catType}
                setType={setCatType}
                filter={catFilter}
                setFilter={setCatFilter}
                onOpenBook={onOpenBook}
                onOpenMovie={onOpenMovie}
                onDone={load}
                onFlash={setFlash}
                onReverify={(selection) => setReverify(selection)}
              />
            </>
          ) : sect === 'categories' ? (
            // THE TAGS SCREEN WITH THE COLOURS AS ITS FIRST CARD, packed as
            // masonry like every other section's cards.
            <TagsPage embedded lead={<ColourCategoriesCard prefs={user.preferences} onSaved={onPreferences} />} />
          ) : sect === 'languages' ? (
            // THE PANEL ITSELF, not a door to it. It was a FormModal behind a
            // button on Sources; Settings now points at this section for what a
            // quote's language is, and a pointer to a pop-up inside a different
            // section is not an address.
            <Card className="lang-card">
              {/* THE SECTION IS THE HEADING — see CharactersConsole. The tab says
                  "Languages" and carries the dot; this said "Language marks"
                  underneath it with a second one. */}
              <LanguageMarksSettings prefs={user.preferences} onSaved={onPreferences} />
            </Card>
          ) : sect === 'sources' ? (
            <MetadataSources user={user} onPreferences={onPreferences} />
          ) : sect === 'people' ? (
            <PeopleConsole
              records={people}
              onReload={loadPeople}
              onFlash={setFlash}
              onReverify={(who) => setReverify({ people: who })}
              onSearch={onSearch}
              /* ONE DOOR FOR BOTH MEDIA, because a work pill carries its own kind
                 and the page already holds a way to open each. Threading the pair
                 down would make every row below re-derive which one to call. */
              onOpenWork={(w) => (w.kind === 'movie' ? onOpenMovie : onOpenBook)?.(w.id)}
              arriveFetching={intent === 'fetch'}
              onArrived={() => setIntent(null)}
            />
          ) : (
            <>
              {/* THE REMAP IS CHARACTER WORK AND IT GOES FIRST. It takes the speaker
                  names a film's lines carry and points them at that film's cast,
                  which is the one place in the app where a quote's speaker becomes
                  a character — so it is what MAKES the rows underneath it, and it
                  was sitting below them where a reader with forty characters had to
                  scroll past all forty to find the tool that fixes them. The
                  owner's standing rule, and the reason this moved: "Use the space
                  available. Think like the user. Whatever will be used more needs
                  to be up front." */}
              <SpeakerRemap movies={lib.movies.filter((m) => m.dialogue_count > 0)} onDone={load} user={user} />
              {/* Beside the people list and never inside it — see CharactersConsole. */}
              <CharactersConsole rows={chars} onReload={loadChars} onOpenWork={(w) => (w.kind === 'movie' ? onOpenMovie : onOpenBook)?.(w.id)} />
            </>
          )}
          </div>
      </SectionRail>
      {/* THE ISSUE SHEET, opened from the dock. Rows rather than tiles, because a
          390px screen fits one column and a tile wall wants three — and every row
          is a door, which is the half the phone's coverage lines never had. */}
      {mobile && issuesOpen && (
        <MobileSheet open onClose={() => setIssuesOpen(false)} title={t('metadata.issues.title')}>
          {issues.length === 0 ? (
            <p className="microcopy">{t('metadata.issues.none')}</p>
          ) : (
            <div style={{ display: 'grid', gap: 'var(--row)' }}>
              {issues.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  className="meta-issue-row"
                  onClick={() => {
                    pickGap(row.go.type, row.go.filter, row.go.section)
                    setIssuesOpen(false)
                  }}
                >
                  <span className="meta-issue-label">{row.label}</span>
                  <span className="meta-issue-count">{row.n}</span>
                </button>
              ))}
            </div>
          )}
        </MobileSheet>
      )}
      {reverify && (
        <ReverifyFlow
          selection={reverify}
          fillsOnly={!!reverify.fills_only}
          onClose={() => setReverify(null)}
          onFlash={setFlash}
          onDone={load}
        />
      )}
    </section>
  )
}

// GAP_KEYS — the server's gap token, to the word this screen calls it. ONE table
// for the coverage tiles, both filter dropdowns and the per-row chips, because a
// gap is called the same thing in all three places and three tables would be
// three chances to drift.
//
// IT HOLDS KEYS, RESOLVED WHERE THEY ARE DRAWN. A table of WORDS built at module
// scope freezes the language at import time, which is the bug three other tables
// in this app shipped — see BinPage's TRASH_LABELS and keys.js's
// groupedShortcuts.
//
// The two low-res rows are the long form a ROW says ("low-res cover") beside the
// bare "low-res" a tile and a filter say. None of these is a field NAME — each is
// a whole phrase about a missing field — so common.field.* is not their home.
const GAP_KEYS = {
  flagged: 'metadata.gap.flagged.label',
  all: 'metadata.gap.all.label',
  no_cover: 'metadata.gap.no-cover.label',
  no_poster: 'metadata.gap.no-poster.label',
  low_res: 'metadata.gap.low-res.label',
  low_res_cover: 'metadata.gap.low-res-cover.label',
  low_res_poster: 'metadata.gap.low-res-poster.label',
  no_author: 'metadata.gap.no-author.label',
  no_series: 'metadata.gap.no-series.label',
  no_year: 'metadata.gap.no-year.label',
  no_genre: 'metadata.gap.no-genre.label',
  no_source: 'metadata.gap.no-source.label',
  no_cast: 'metadata.gap.no-cast.label',
  no_director: 'metadata.gap.no-director.label',
  no_actor: 'metadata.gap.no-actor.label',
  // THE PACK'S TWO REMAINING ISSUES, and both cross the shelves rather than
  // belonging to one. "No people" is a book with no author and a film with no
  // cast — one question, two columns — and a filter that could only be offered
  // per type would be the thing the works console exists NOT to be: a view of
  // the library through its shelves rather than through what is missing.
  no_people: 'metadata.gap.no-people.label',
  no_synopsis: 'metadata.gap.no-synopsis.label',
  // NOT A GAP AT ALL, and it sits here because the filter list is a list of gap
  // tokens and this is the one entry that is the absence of them. A reader who
  // has just worked a filter down to nothing wants to see what they finished.
  ok: 'metadata.gap.ok.label',
}
const gapLabel = (token) => t(GAP_KEYS[token])

// The gaps each half of the library can have, in the order they are drawn. The
// tiles, the filter dropdown and the coverage lines all walk these, and the token
// doubles as the name of its count on the stats object.
const BOOK_GAPS = ['no_cover', 'low_res', 'no_author', 'no_series', 'no_year', 'no_genre', 'no_source']
const MOVIE_GAPS = ['no_poster', 'low_res', 'no_cast', 'no_director', 'no_year', 'no_genre', 'no_source']

// ── EVERYTHING THAT NEEDS WORK, IN ONE LIST.
//
// THE PHONE GETS THE LIST AS ROWS, and every row is a door. It covers the
// catalogue AND the people and character records, which are exactly the kind of
// thing nobody goes looking for.
//
// ONLY WHAT IS ACTUALLY WRONG. A row reading "0" is a row that teaches a reader
// to stop reading the list, and a sheet of fourteen zeroes says nothing at all —
// so an empty sheet says so in one sentence instead.
function libraryIssues({ stats, people, chars }) {
  const out = []
  const add = (id, label, n, go) => { if (n > 0) out.push({ id, label, n, go }) }
  if (stats) {
    for (const g of BOOK_GAPS) add(`b-${g}`, gapLabel(g), stats.books[g], { section: 'works', type: 'book', filter: g })
    for (const g of MOVIE_GAPS) add(`m-${g}`, gapLabel(g), stats.movies[g], { section: 'works', type: 'movie', filter: g })
    // A LINE WITH NO ACTOR IS FIXED IN THE CHARACTER SECTION, by the remap — the
    // works console has no filter that can find it, because it is a property of a
    // quote rather than of the film it came from.
    add('d-actor', gapLabel('no_actor'), stats.dialogues.missing_actor, { section: 'characters' })
  }
  if (people) {
    // The same test the people console runs on its own rows: no provider link, or
    // no stored portrait. Counted here so the number is visible before the section
    // is entered, which is the whole reason this list exists.
    const thin = people.filter((p) => Object.keys(parseLinks(p.links).known).length === 0 || !p.image_path)
    add('p-thin', t('metadata.issue.people-thin.label'), thin.length, { section: 'people' })
    const names = [...new Set(people.map((p) => p.name))]
    add('p-dup', t('metadata.issue.people-dup.label'), nearDupGroups(names).length, { section: 'people' })
  }
  if (chars) {
    add('c-dup', t('metadata.issue.chars-dup.label'), nearDupGroups([...new Set(chars.map((c) => c.name))]).length, { section: 'characters' })
  }
  return out
}

// ── THE ISSUES A CONSOLE CAN FILTER TO ───────────────────────────────────────
//
// THE OWNER'S ASK, and its list: "The issue filters should be in work, people,
// and character screens… Relevant issues for people: no links, no works, no
// quotes, no photos. Characters: no works, no quotes, no images (only for
// characters who has catalogue works, i.e. movies / shows / games)."
//
// A TABLE RATHER THAN A CHAIN OF `if`s, and it is one table per console because
// the three consoles' issues have nothing in common but their shape. Each entry
// is [token, locale key, predicate]; `issueOptions` turns a table and a list of
// rows into the pills, and `issueTest` turns a chosen token back into the
// predicate. One definition per issue, read by the filter, by the pill's count
// and by the rail's badge — which is what stops the badge and the pill under it
// disagreeing about how many people have no photograph.
//
// WHY NOT ONE TABLE FOR ALL THREE. The works console's issues are gap tokens
// with their own per-shelf predicates (`bookPasses`, `moviePasses`) and an
// ordering the pack fixes; folding them in here would mean a table whose entries
// mean different things by row. `issueOptions` is shared instead — the counting
// is the part that was worth writing once.

// A PERSON'S FOUR. `no_works` and `no_quotes` are the two halves of "nothing in
// the library points at this record", which is exactly what Prune sweeps — so a
// reader can see the prune's candidates before pressing it.
const PERSON_ISSUES = [
  ['no_links', 'metadata.issue.no-links.label', (p) => Object.keys(parseLinks(p.links).known).length === 0],
  ['no_photo', 'metadata.issue.no-photo.label', (p) => !p.image_path],
  ['no_works', 'metadata.issue.no-works.label', (p) => !(p.works > 0)],
  ['no_quotes', 'metadata.issue.no-quotes.label', (p) => !(p.quotes > 0)],
]

// A CHARACTER'S THREE, and the third is gated. A character in a NOVEL has no
// picture to be missing — a book's cast rows carry no faces — so counting those
// as an issue would put every literary character in the library behind a filter
// named for a problem they cannot have. `kind === 'movie'` is the catalogue side
// (films, shows and games all live in `movies`), which is the owner's own
// qualification: "only for characters who has catalogue works".
const CHARACTER_ISSUES = [
  ['no_works', 'metadata.issue.no-works.label', (c) => !(c.works > 0)],
  ['no_quotes', 'metadata.issue.no-quotes.label', (c) => !(c.quotes > 0)],
  ['no_face', 'metadata.issue.no-face.label',
    (c) => (c.works_in || []).some((w) => w.kind === 'movie' && !w.has_face)],
]

// worksWithIssues — how many works have anything wrong, for the Works door's
// badge. `flagged` is the console's own broadest test and the pack's first
// filter, so this is the count of the list a reader lands on when they open the
// door: the badge names the list, rather than naming a number the screen does not
// draw anywhere.
function worksWithIssues(lib) {
  return (lib.books || []).filter((b) => bookPasses(b, 'flagged')).length +
    (lib.movies || []).filter((m) => moviePasses(m, 'flagged')).length
}

// issueOptions — the pills, counted over the rows the OTHER filters have already
// left. Counting over the whole list would print 11 on a pill that lands on 3
// rows, which is a number that teaches the reader to stop trusting the numbers.
function issueOptions(defs, rows) {
  return [
    { key: '', label: t('metadata.issue.all.label'), n: rows.length },
    ...defs.map(([key, label, test]) => ({ key, label: t(label), n: rows.filter(test).length })),
  ]
}
const issueTest = (defs, key) => {
  const d = defs.find(([k]) => k === key)
  return d ? d[2] : () => true
}
// HOW MANY RECORDS HAVE ANYTHING WRONG, which is what a door's badge should say.
// A record with three problems is one record to go and look at, so the badge
// counts rows and not findings — the pills behind the door split it up.
const withAnyIssue = (defs, rows) => (rows || []).filter((r) => defs.some(([, , test]) => test(r))).length


// ConsoleToolbar — the filter row, the issue pills and the bulk bar of a console,
// stuck under the tab row while the list scrolls under it.
//
// A CARD WHILE IT IS STUCK, NOTHING AT REST. At rest the toolbar sits on the page
// like any other row; stuck, it is the lower half of one card whose upper half is
// the stuck tab row — the owner: "it should not hide the tabs. and the sticky
// panel should look like a card, not the angular rectangle it is now."
function ConsoleToolbar({ children }) {
  const ref = useRef(null)
  const stuck = useStuck(ref)
  return <div ref={ref} className={'console-toolbar' + (stuck ? ' is-stuck' : '')}>{children}</div>
}

// IssueDoors — a console's open issues as pills on the phone's index, each a door
// into that console filtered to the issue. At module level so the index does not
// remount it on every render.
function IssueDoors({ rows, onPick }) {
  if (rows.length === 0) return null
  return (
    <Scroller axis="x" className="issue-pills section-index-pills">
      {rows.map((row) => (
        <button
          key={row.id}
          type="button"
          className="tp-filter-chip issue-pill tactile"
          onClick={() => onPick(row.go.type, row.go.filter, row.go.section)}
        >
          <span className="issue-pill-label">{row.label}</span>
          <span className="issue-pill-count">{row.n}</span>
        </button>
      ))}
    </Scroller>
  )
}

// runPooled runs fn over items with a small concurrency cap (SQLite is a single
// writer), each call caught so one failure can't reject the batch. Returns the
// results in order ({ok:false} for a thrown request).
async function runPooled(items, limit, fn) {
  const out = []
  let i = 0
  async function worker() {
    while (i < items.length) {
      const idx = i++
      out[idx] = await fn(items[idx]).catch(() => ({ ok: false }))
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return out
}

// ---- catalogue console (books + films + shows, merged) ----

// The type selector drives which filters the second dropdown offers. "all types"
// gets the filters common to books and films; a specific type gets that kind's
// full set. Keep the shared keys (flagged/low_res/no_year/no_genre/no_source)
// spelled the same across both so an "all types" filter applies to either kind.
// The type selector holds the STORED VALUE and the KEY that names it; the words
// are built by typeOptions() during render, for the reason GAP_KEYS gives above.
// Three of the four rows are the app's own countable nouns, so this screen needs
// a word of its own only for "all types".
const CATALOGUE_TYPES = [
  ['all', 'metadata.catalogue.type.all.label'],
  ['book', 'unit.book.other'],
  ['movie', 'unit.film.other'],
  ['show', 'unit.show.other'],
]
const typeOptions = () => CATALOGUE_TYPES.map(([v, key]) => [v, t(key)])

// The filter dropdowns are lists of GAP TOKENS, named by GAP_KEYS above and
// paired with their words at render.
// `no_people` and `no_synopsis` are on all three lists, and `ok` closes each of
// them: the pack's own order runs from the broadest issue to the narrowest and
// ends on Complete (`metadata.dc.html:851`).
const BOOK_FILTERS = ['flagged', ...BOOK_GAPS, 'no_people', 'no_synopsis', 'ok', 'all']
const MOVIE_FILTERS = ['flagged', ...MOVIE_GAPS, 'no_people', 'no_synopsis', 'ok', 'all']
const ALL_FILTERS = ['flagged', 'low_res', 'no_year', 'no_genre', 'no_source', 'no_people', 'no_synopsis', 'ok', 'all']
function filtersForType(type) {
  if (type === 'book') return BOOK_FILTERS
  if (type === 'movie' || type === 'show') return MOVIE_FILTERS
  return ALL_FILTERS
}
const filterOptions = (type) => filtersForType(type).map((v) => [v, gapLabel(v)])
const catKey = (kind, id) => `${kind}:${id}`
// `ok` IS "EVERY OTHER FILTER WOULD REJECT IT", not a predicate of its own, and
// that is the only definition that cannot drift. A hand-written "complete" test
// is a second list of what completeness means, and the day a gap is added it
// becomes the stale one — a work missing the new field would go on being called
// complete, which is the one answer this filter must never give wrongly.
const completeBy = (gaps, passes) => (x) => !gaps.some((g) => passes(x, g))

function bookPasses(b, filter) {
  const p = {
    flagged: (b) => !b.has_cover || !b.has_ids, no_cover: (b) => !b.has_cover,
    low_res: (b) => b.low_res_cover, no_author: (b) => !b.has_author,
    no_series: (b) => !b.has_series, no_year: (b) => !b.has_year,
    no_genre: (b) => !b.has_genre, no_source: (b) => !b.has_ids,
    // A BOOK'S PEOPLE ARE ITS AUTHOR. The pack draws one "No people" over the
    // whole library; each shelf answers it with the credit it actually has.
    no_people: (b) => !b.has_author,
    no_synopsis: (b) => !b.has_description,
    ok: completeBy(BOOK_GAPS.concat('no_people', 'no_synopsis'), bookPasses),
  }[filter]
  return p ? p(b) : true
}
function moviePasses(m, filter) {
  const p = {
    flagged: (m) => !m.has_poster || !m.has_cast || !m.has_source, no_poster: (m) => !m.has_poster,
    low_res: (m) => m.low_res_poster, no_cast: (m) => !m.has_cast,
    no_director: (m) => !m.has_director, no_year: (m) => !m.has_year,
    no_genre: (m) => !m.has_genre, no_source: (m) => !m.has_source,
    // A FILM'S PEOPLE ARE ITS CAST, not its director — the pack's own fixture
    // flags a Ray film with a director and no cast as `nopeople`
    // (`metadata.dc.html:464`). A film credited to nobody on screen is the row
    // worth reaching; one with no director is `no_director`, beside it.
    no_people: (m) => !m.has_cast,
    no_synopsis: (m) => !m.has_description,
    ok: completeBy(MOVIE_GAPS.concat('no_people', 'no_synopsis'), moviePasses),
  }[filter]
  return p ? p(m) : true
}

// CatalogueConsole — one section (styled like the People console: no card,
// its own scroll box) listing books, films and shows together. The first
// dropdown picks the type and reshapes the second (filter) dropdown; rows render
// as BookRow / MovieRow by kind, and the bulk bar splits the (kind-namespaced)
// selection back into per-kind actions.
// ConsoleFilterRow — the row of filters at the head of Works, People and
// Characters. One component because it is one row: three consoles drew it from
// three copies of the same markup, and the owner's rule is that things which look
// the same behave the same.
//
// IT FIXES THREE ANNOTATIONS AT ONE SITE, which is how the copies gave themselves
// away. Each console drew a `SHOWN` count and then pushed its controls right with
// `ml-auto` inside a wrapping flex. At phone width the wrapper wraps to its own
// line and KEEPS the auto margin — so the controls sit shoved to the right with a
// gap on the left ("why gap?", circled on Characters and true on Works), and
// People's five controls spill onto a second line where the owner asked for one.
//
// ONE LINE, AND IT SCROLLS UNDER A FADE WHERE IT HAS TO. That is this repo's
// standing answer to a row too long for its screen — "an edge fade means it
// scrolls; a button at the fade opens the full set" — and the fade is measured, so
// a row that fits wears none. Wrapping was the alternative and it is what the
// owner asked to be rid of: a filter bar three lines tall above a dense table is
// the shape that drove these controls behind a dropdown in the first place.
//
// THE COUNT IS A `Tally` NOW, NOT A MONO LABEL, and that is the owner's second
// pass on it: "It looks bad. Design it better then, so that it integrates with
// the visual style." They were right twice over. "3 SHOWN" in grey uppercase
// mono was this app's drawing for a count BEFORE it had one — the standing rule
// since is that a count wears the glyph of what it counts, and every other count
// in the app had moved while this one sat in the old face.
//
// THE ROOMY FORM, WITH THE WORD, and the rule's own test is why. Its tight form
// is for "rows with buttons and lots of info", where the glyph stands in for the
// noun because there is no room for both. There IS room here: this sits at the
// END of a row that SCROLLS rather than compresses, so nothing is competing for
// the space, and the roomy form is where a reader learns what the drawing means.
// `3 works`, `177 people`, `189 characters` — the noun says which console you are
// on without the row having to repeat its own name.
//
// IT GOES AFTER THE CONTROLS rather than before them. As a lead it was a label
// the eye had to get past to reach the first control; it is an OUTCOME of the
// filters, not a heading for them.
function ConsoleFilterRow({ count = null, icon = null, word = null, children }) {
  // THE COUNT LEAVES THE ROW ON A PHONE, AND ONLY ON A PHONE. The owner asked for
  // "one line for the filter row" and 390px does not hold one: measured on People,
  // the controls and the count together run 60px past the edge even after the
  // verbs have collapsed to glyphs and the duplicate search box has gone. Something
  // has to leave, and the count is the only thing on the row that is not a control
  // — it is the OUTCOME of the filters rather than one of them, so it reads just as
  // well on the line below, and this way nothing is hidden behind a scroll.
  //
  // On a desk it stays where it was: there is room, and a figure at the end of the
  // row it belongs to is where a reader looks for it.
  const mobile = useIsMobileScreen()
  const tally = count != null && (
    <span className="console-filters-count">
      <Tally n={count} icon={icon} word={word} showWord />
      {' '}
      {t('metadata.shown.word')}
    </span>
  )
  if (mobile) {
    return (
      <>
        <Scroller axis="x" className="console-filters">{children}</Scroller>
        {tally != null && <div className="console-filters-count-row">{tally}</div>}
      </>
    )
  }
  return (
    <Scroller axis="x" className="console-filters">
      {children}
      {count != null && (
        <span className="console-filters-count">
          {/* "3 works shown", NOT "3 works". The bare noun is wrong twice on a
              filtered console: it reads as a claim about the LIBRARY — three works
              in total — when it is a claim about what the filters left, and it is
              not even unique on the page, which is how a journey reading it landed
              on someone else's number. The trailing word is what makes it an
              outcome, and it is the same word the string has always carried. */}
          <Tally n={count} icon={icon} word={word} showWord />
          {' '}
          {t('metadata.shown.word')}
        </span>
      )}
    </Scroller>
  )
}

function CatalogueConsole({ books, movies, type, setType, filter, setFilter, onOpenBook, onOpenMovie, onDone, onFlash, onReverify }) {
  const { ask, confirmDialog } = useConfirm()
  const [q, setQ] = useState('')
  // THE SHELL'S FIELD DRIVES THIS ONE. The owner named this screen: "in metadata, it
  // will search in metadata". The box below is still drawn and still works — it is
  // this console's own and a reader who is looking at the console will use the
  // nearest field — but they are now ONE piece of state, so the two cannot disagree
  // about what is being filtered. Publishing the same setter is what makes that
  // true, rather than a second `q` kept in step by hand.
  useScreenSearch({ key: 'metadata-works', label: t('shell.search.where.works'), onQuery: setQ })
  const [lookupKey, setLookupKey] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [editing, setEditing] = useState(false) // book bulk-edit form open
  const [sel, setSel] = useState(() => new Set()) // "book:id" / "movie:id" keys

  // Guard against a filter that isn't valid for the current type (e.g. after a
  // type switch) so the pills and the predicates always agree.
  const filterOpts = filterOptions(type)
  const filterVal = filterOpts.some(([v]) => v === filter) ? filter : 'flagged'

  // THE TYPE AND THE SEARCH, WITHOUT THE GAP FILTER. It is what the pills count
  // over — see CharactersConsole — and `shown` is this narrowed by the chosen
  // pill. Splitting the one loop in two is what let the counts exist at all: the
  // old single pass had the gap test inside it, so there was no list to count
  // against.
  const base = useMemo(() => {
    const s = q.trim().toLowerCase()
    const out = []
    if (type === 'all' || type === 'book') {
      for (const b of books) {
        if (s && !(b.title.toLowerCase().includes(s) || (b.author || '').toLowerCase().includes(s))) continue
        out.push({ kind: 'book', item: b })
      }
    }
    if (type === 'all' || type === 'movie' || type === 'show') {
      for (const m of movies) {
        const mt = m.media_type || 'movie'
        if (type === 'movie' && mt !== 'movie') continue
        if (type === 'show' && mt !== 'show') continue
        if (s && !m.title.toLowerCase().includes(s)) continue
        out.push({ kind: 'movie', item: m })
      }
    }
    return out
  }, [books, movies, type, q])
  // ONE PREDICATE FOR BOTH SHELVES, keyed on the row's own kind. The pills and
  // the list read it, so a pill's count is by construction the size of the list
  // pressing it produces.
  const gapPasses = useCallback(
    (x, f) => (x.kind === 'book' ? bookPasses(x.item, f) : moviePasses(x.item, f)),
    [],
  )
  const shown = useMemo(() => base.filter((x) => gapPasses(x, filterVal)), [base, filterVal, gapPasses])
  // EVERY GAP THE TYPE OFFERS, COUNTED. `filterOpts` is already the pack's own
  // order — broadest issue first, "complete" and "all" last — so the pills are it
  // with a number on each.
  const gapPills = useMemo(
    () => filterOpts.map(([v, label]) => ({ key: v, label, n: base.filter((x) => gapPasses(x, v)).length })),
    [filterOpts, base, gapPasses],
  )

  const keys = shown.map((x) => catKey(x.kind, x.item.id))
  const selectedKeys = keys.filter((k) => sel.has(k))
  const selBookIds = selectedKeys.filter((k) => k.startsWith('book:')).map((k) => Number(k.slice(5)))
  const selMovieIds = selectedKeys.filter((k) => k.startsWith('movie:')).map((k) => Number(k.slice(6)))
  const selMoviesWithCast = shown.filter((x) => x.kind === 'movie' && sel.has(catKey('movie', x.item.id)) && x.item.has_cast).length
  const allChecked = keys.length > 0 && keys.every((k) => sel.has(k))

  useEffect(() => {
    setSel((s) => new Set([...s].filter((k) => keys.includes(k))))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, filterVal, q])

  const toggle = (k) => setSel((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n })
  const clearSel = () => setSel(new Set())

  async function del() {
    const total = selectedKeys.length
    // A real plural family in place of the "item(s)" hedge.
    if (!(await ask(t('metadata.delete.confirm', { count: total, n: total }), { danger: true, reversible: true }))) return
    setBusy(true)
    setErr('')
    try {
      const rs = await runPooled(selectedKeys, 4, (k) => {
        const [kind, id] = k.split(':')
        return json('DELETE', `/${kind === 'book' ? 'books' : 'movies'}/${id}`)
      })
      const fail = rs.filter((r) => !r.ok).length
      const gone = total - fail
      onFlash(
        t('metadata.delete.flash', { count: gone, n: gone }) +
          (fail ? t('metadata.bulk.failed.suffix', { n: fail }) : ''),
      )
    } finally {
      setBusy(false)
      clearSel()
      onDone()
    }
  }

  // bulkEdit is books-only (POST /books/bulk); the button only shows when books
  // are in the selection.
  async function bulkEdit(fields) {
    setBusy(true)
    setErr('')
    const r = await json('POST', '/books/bulk', { ids: selBookIds, ...fields })
    setBusy(false)
    // The app's own word for a bulk action that did not land, rather than a
    // second near-identical error string of this screen's own.
    if (!r.ok) return setErr(errText(r, t('error.bulk.failed')))
    onFlash(t('metadata.bulk.flash', { count: r.data.updated, n: r.data.updated }))
    setEditing(false)
    clearSel()
    onDone()
  }

  async function fillActors() {
    setBusy(true)
    setErr('')
    try {
      const rs = await runPooled(selMovieIds, 4, (id) => json('POST', `/movies/${id}/remap-speakers`, { mappings: [], refill: true }))
      const filled = rs.reduce((n, r) => n + (r.ok ? r.data.refilled || 0 : 0), 0)
      const fail = rs.filter((r) => !r.ok).length
      // Two hedged plurals in one sentence became two real ones, composed from
      // the shared count idiom instead of an English -s.
      onFlash(
        t('metadata.actors.flash', {
          actors: t('common.count.phrase', { n: filled, noun: t('unit.actor', { count: filled }) }),
          titles: t('common.count.phrase', {
            n: selMovieIds.length,
            noun: t('unit.title', { count: selMovieIds.length }),
          }),
        }) + (fail ? t('metadata.bulk.failed.suffix', { n: fail }) : ''),
      )
    } finally {
      setBusy(false)
      clearSel()
      onDone()
    }
  }

  return (
    <section className="space-y-3">
      {confirmDialog}
      {/* THE SECTION IS THE HEADING — see CharactersConsole. This one said
          "Catalogue" under a tab saying "Works", which is worse than a repeat: two
          words for one thing, and the reader has to work out that they are one. */}
      {/* THE COUNT STAYS HERE FOR NOW, MOVED RATHER THAN DROPPED, and the reason
          is worth the line. The owner marked "3 SHOWN" irrelevant on this console
          and they are right about what it looks like — a list of three visible
          rows telling you there are three. But it is also the instrument a journey
          uses to check that a pill promising 40 rows lands on 40, which is a real
          defect class and one the pills' own numbers cannot check themselves.
          Deleting it quietly would trade a guard for a line of text. Asked. */}
      {/* THE TOOLBAR STICKS, because the list under it is the whole library now
          rather than a thirty-row box — a filter you have to scroll four hundred
          rows back up to reach is a filter nobody changes. */}
      <ConsoleToolbar>
      <ConsoleFilterRow
        count={shown.length}
        icon={<IconNavWorks />}
        word={t('unit.work', { count: shown.length })}
      >
        <Select
          ariaLabel={t('common.field.media-type.label')}
          value={type}
          onChange={(v) => { setType(v); setFilter('flagged') }}
          options={typeOptions()}
        />
        <input className="tp-input w-auto" placeholder={t('metadata.search.placeholder')} value={q} onChange={(e) => setQ(e.target.value)} />
      </ConsoleFilterRow>
      {/* THE GAP FILTER, AS PILLS. The owner on this console: "Works: well covered
          already. But pills." It was a combo box — eleven gaps behind one press,
          none of them carrying a number, so finding out how many films had no
          poster meant choosing it and reading the count above. Pressed open,
          scrolled, chosen, read, and opened again for the next one.

          THE SAME ELEVEN, IN THE SAME ORDER, each with the size of the list it
          would give. The shape of what is missing is now readable without a
          press, which is what this whole section is for. */}
      <IssuePills
        value={filterVal}
        onChange={setFilter}
        options={gapPills}
        ariaLabel={t('metadata.catalogue.filter.aria')}
      />
      {shown.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 microcopy" style={{ cursor: 'pointer' }}>
              <input type="checkbox" checked={allChecked} onChange={() => setSel(allChecked ? new Set() : new Set(keys))} /> {t('metadata.select-all.label')}
            </label>
          </div>
          <BulkBar n={selectedKeys.length} onClear={clearSel}>
            {selBookIds.length > 0 && (
              <GhostButton icon={<IconEdit />} disabled={busy} onClick={() => setEditing((v) => !v)}>
                {editing ? t('metadata.bulk.close.label') : t('metadata.bulk.open.label')}
              </GhostButton>
            )}
            {selMovieIds.length > 0 && (
              <GhostButton
                disabled={busy || selMoviesWithCast === 0}
                title={selMoviesWithCast === 0 ? t('metadata.actors.fill.disabled.tip') : undefined}
                onClick={fillActors}
                icon={<IconUsers />}
              >
                {t('metadata.actors.fill.label')}
              </GhostButton>
            )}
            {/* THE PACK'S TWO BULK ACTS, in its own order: fetch what is empty,
                then re-verify what is filled (`metadata.dc.html:852`). They are one
                flow and its default — the review already ticks exactly the empty
                fields — so the first is the second with every overwrite dropped
                before the reader is asked, rather than a second code path over the
                same writes. */}
            <GhostButton icon={<IconMetadata />} disabled={busy} onClick={() => onReverify({ book_ids: selBookIds, movie_ids: selMovieIds, fills_only: true })}>
              {t('metadata.fills.open.label')}
            </GhostButton>
            <GhostButton icon={<IconFetch />} disabled={busy} onClick={() => onReverify({ book_ids: selBookIds, movie_ids: selMovieIds })}>
              {t('metadata.reverify.open.label')}
            </GhostButton>
            <GhostButton icon={<IconDelete />} keepLabel disabled={busy} style={{ color: 'var(--error)' }} onClick={del}>
              {t('common.action.delete.label')}
            </GhostButton>
          </BulkBar>
        </>
      )}
      </ConsoleToolbar>
      {shown.length === 0 ? (
        <p className="microcopy">{t('metadata.catalogue.nomatch')}</p>
      ) : (
        <>
          {editing && selBookIds.length > 0 && <BulkEditForm n={selBookIds.length} busy={busy} onApply={bulkEdit} />}
          <ErrorText>{err}</ErrorText>
{/* NOT A SCROLLER ANY MORE, IN EITHER AXIS. The vertical box went when the
              page took over the scroll (see ConsoleToolbar); the horizontal axis
              went before that, because one seventeen-word title set the
              scroller's content width and pushed a 1280 desk to 1479. A record
              row's name scrolls inside its own box (NameScroll). `min-width: 0`
              is still needed: a flex child defaults to its content's minimum. */}
          <div className="ann-table-wrap" style={{ minWidth: 0 }}>
            {shown.map((x) =>
              x.kind === 'book' ? (
                <BookRow
                  key={catKey('book', x.item.id)}
                  book={x.item}
                  checked={sel.has(catKey('book', x.item.id))}
                  onCheck={() => toggle(catKey('book', x.item.id))}
                  open={lookupKey === catKey('book', x.item.id)}
                  onToggleLookup={() => setLookupKey((k) => (k === catKey('book', x.item.id) ? null : catKey('book', x.item.id)))}
                  onOpen={onOpenBook}
                  onDone={() => { setLookupKey(null); onDone() }}
                />
              ) : (
                <MovieRow
                  key={catKey('movie', x.item.id)}
                  movie={x.item}
                  checked={sel.has(catKey('movie', x.item.id))}
                  onCheck={() => toggle(catKey('movie', x.item.id))}
                  open={lookupKey === catKey('movie', x.item.id)}
                  onToggleLookup={() => setLookupKey((k) => (k === catKey('movie', x.item.id) ? null : catKey('movie', x.item.id)))}
                  onOpen={onOpenMovie}
                  onDone={() => { setLookupKey(null); onDone() }}
                />
              ),
            )}
          </div>
        </>
      )}
    </section>
  )
}

// InlineEdit fetches a book/movie detail and renders its full editor inline in a
// console row, so metadata can be corrected without leaving the page. kind is
// "books" | "movies".
function InlineEdit({ kind, id, onDone, onCancel }) {
  const [row, setRow] = useState(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    json('GET', `/${kind}/${id}`).then((r) => (r.ok ? setRow(r.data) : setErr(errText(r))))
  }, [kind, id])
  if (err) return <ErrorText>{err}</ErrorText>
  if (!row) return <p className="microcopy mt-3">{t('common.state.loading')}</p>
  return (
    <div className="mt-3">
      {kind === 'books'
        ? <EditBook book={row} onSaved={onDone} onCancel={onCancel} />
        : <EditMovie movie={row} onSaved={onDone} onCancel={onCancel} />}
    </div>
  )
}

// RowActions — edit · look up · open, once per row, on both console lists.
//
// Three words per row across a list that routinely runs to hundreds of rows,
// and two of them were `Close` half the time: the edit and look-up buttons are
// toggles, so a row with both panels open read "Close · Close · Open", which
// says nothing about what either one closes. A latched glyph says it in the one
// place a toggle should — its own state — via .field-icon-btn.is-active, the
// same latch the cover controls use. The tooltip still carries the words, and
// they still change with the state, so the answer is one hover away instead of
// occupying the row forever.
// `noun` arrives ALREADY RESOLVED — the reader's word for the row, taken from the
// app's own countable nouns — because two of the frames it lands in are shared
// sentences ("Edit this {noun}") that must not care which screen called them.
// A LIST OF ACTIONS, NOT A COMPONENT THAT DRAWS THEM. RecordRow owns the
// cluster's spacing and its glyph button, so what a console hands over is which
// three verbs this row has — which is also what lets the works console and the
// people console differ by one entry instead of by a component each.
// THE NAME OF THE ROW IS IN EVERY ONE OF THESE NAMES, and the tooltips are
// unchanged. A glyph beside a title reads as "look up THAT title" to an eye and
// as "Look up" to everything else, so a console of forty-four works was
// forty-four identical buttons three times over — nothing said which. The capture
// probe is what found it: it presses by accessible name and refuses an ambiguous
// one, so it could not reach the works look-up at all and said why. A tooltip is
// hover-only and is not a name.
function consoleRowActions({ editing, onEdit, lookingUp, onLookup, onOpen, noun, name }) {
  return [
    {
      key: 'edit',
      icon: <IconEdit />,
      ariaLabel: editing ? t('metadata.row.edit.close.aria', { name }) : t('metadata.row.edit.aria', { name }),
      tooltip: editing ? t('metadata.row.edit.close.label') : t('common.action.edit.row.tip', { noun }),
      active: editing,
      pressed: editing,
      onClick: onEdit,
    },
    {
      key: 'lookup',
      icon: <IconSearch />,
      ariaLabel: lookingUp ? t('metadata.row.lookup.close.aria', { name }) : t('metadata.row.lookup.aria', { name }),
      tooltip: lookingUp ? t('metadata.row.lookup.close.label') : t('metadata.row.lookup.tip'),
      active: lookingUp,
      pressed: lookingUp,
      onClick: onLookup,
    },
    onOpen && {
      key: 'open',
      icon: <IconOpen />,
      ariaLabel: t('metadata.row.open.aria', { name }),
      tooltip: t('metadata.row.open.tip', { noun }),
      onClick: onOpen,
    },
  ].filter(Boolean)
}

// Exported for metadata-apply.test.jsx. `apply` is the most destructive request
// the app makes — it rewrites a whole book from a search result — and reaching it
// through the page means stubbing the console's own fetches to say nothing about
// the one call under test.

export function BookRow({ book, checked, onCheck, open, onToggleLookup, onOpen, onDone }) {
  const [err, setErr] = useState('')
  const [editing, setEditing] = useState(false)
  const noun = t('unit.book', { count: 1 })
  // The gap chips, drawn from the one table the tiles and the filters also use.
  const gaps = [
    !book.has_cover && gapLabel('no_cover'),
    book.low_res_cover && gapLabel('low_res_cover'),
    !book.has_author && gapLabel('no_author'),
    !book.has_series && gapLabel('no_series'),
    !book.has_year && gapLabel('no_year'),
    !book.has_genre && gapLabel('no_genre'),
    !book.has_ids && gapLabel('no_source'),
    !book.has_description && gapLabel('no_synopsis'),
  ].filter(Boolean)

  async function apply(c) {
    setErr('')
    const cur = await json('GET', `/books/${book.id}`)
    if (!cur.ok) return setErr(errText(cur))
    const b = cur.data
    // Base metadata (incl. source link so the "no source" gap clears). No cover
    // here — a flaky candidate cover URL must not discard the metadata merge.
    // THE BOOK FIRST, THE CANDIDATE ON TOP, and this is the site where getting it
    // wrong cost the most. The list below names what a match can IMPROVE; what it
    // is silent about it used to CLEAR, because PUT is full-state — so applying a
    // match wiped the translator, the editor, both languages and the circa flag.
    //
    // The translator is the one that could not be undone. store.SetCredits
    // DELETEs every work_person row for a role before re-inserting from the names
    // it is given, and an absent translator is zero names — so the link went, and
    // `credit_as` went with it. That column is how a work prints a name
    // DIFFERENTLY from the person's own record, so re-typing the translator
    // afterwards gives you a fresh link with no per-work spelling: the deliberate
    // one is gone for good. `b` is a GET /books/:id detail, so it carries every
    // one of these.
    const base = {
      ...bookState(b),
      title: c.title || b.title,
      author: c.author || b.author || '',
      isbn: c.isbn13 || b.isbn || '',
      description: c.description || b.description || '',
      published_year: c.published_year || b.published_year || 0,
      // take genres/series from the candidate when it has them (the whole point
      // of applying a match), else keep the book's existing values
      genres: (c.genres && c.genres.length ? c.genres : b.genres) || [],
      series: c.series || b.series || '',
      series_index: c.series_index || b.series_index || 0,
      source: c.source || undefined,
      source_id: c.source_id || undefined,
    }
    const r = await json('PUT', `/books/${book.id}`, base)
    if (!r.ok) return setErr(errText(r))
    // Cover as a separate PUT: if it fails, the metadata above is already saved.
    if (c.cover_url) await json('PUT', `/books/${book.id}`, { ...base, cover_url: c.cover_url })
    onDone()
  }

  // THE AUTHOR AND THE COUNT LEFT THE NAME LINE FOR THE SUB-LINE, which is the
  // v3 pack's arrangement and the reason the name can be trusted to scroll: a
  // name line carrying " · Tagore · 12 quotes" is a name line whose overflow is
  // mostly not the name, so the fade lands in the wrong place and the reader
  // drags past the punctuation to reach the title they were looking for.
  return (
    <RecordRow
      mark={<RowArt src={book.cover_path ? coverImgURL(book.cover_path) : null} alt={t('metadata.row.nocover.aria')} />}
      name={book.title}
      /* THE COUNT WEARS ITS GLYPH, and the row's other fact keeps its words. This
         is the tight case — a tick box, a cover, three action glyphs and a chip
         row are already on it — and the people console beside it has drawn its
         counts this way since RowCounts was built, so the two consoles now say
         one number one way. */
      sub={<>
        {book.author && <span>{book.author}</span>}
        {book.author && <span aria-hidden="true"> · </span>}
        <Tally n={book.annotation_count} word={t('unit.quote', { count: book.annotation_count })} icon={<IconNavQuotes />} />
      </>}
      chips={gaps.map((g) => ({ label: g, warn: true }))}
      chipsEmpty={t('metadata.row.complete')}
      select={{ checked, onChange: onCheck, tip: t('metadata.row.select.tip', { noun }), label: t('metadata.row.select.aria', { name: book.title }) }}
      actions={consoleRowActions({ editing, onEdit: () => setEditing((v) => !v), lookingUp: open, onLookup: onToggleLookup, onOpen: onOpen && (() => onOpen(book.id)), noun, name: book.title })}
    >
      {editing && <InlineEdit kind="books" id={book.id} onDone={() => { setEditing(false); onDone() }} onCancel={() => setEditing(false)} />}
      {open && (
        <div className="mt-3">
          <BookLookupPicker title={book.title} isbn={book.isbn} asin={book.asin} onPick={apply} />
          <ErrorText>{err}</ErrorText>
        </div>
      )}
    </RecordRow>
  )
}

function MovieRow({ movie, checked, onCheck, open, onToggleLookup, onOpen, onDone }) {
  const [err, setErr] = useState('')
  const [editing, setEditing] = useState(false)
  const noun = t('unit.title', { count: 1 })
  // EVERY GAP THE FILTER CAN SELECT ON, which this list was four short of. The
  // dropdown has always offered no_director, no_year and no_genre over films, and
  // the rows it returned carried no chip saying why — so a film filtered to "No
  // year" drew `chipsEmpty`, which is the word "Complete". A row that answers the
  // filter with its own contradiction is worse than one that answers nothing.
  const gaps = [
    !movie.has_poster && gapLabel('no_poster'),
    movie.low_res_poster && gapLabel('low_res_poster'),
    !movie.has_cast && gapLabel('no_cast'),
    !movie.has_director && gapLabel('no_director'),
    !movie.has_year && gapLabel('no_year'),
    !movie.has_genre && gapLabel('no_genre'),
    !movie.has_source && gapLabel('no_source'),
    !movie.has_description && gapLabel('no_synopsis'),
  ].filter(Boolean)

  async function resync(c) {
    setErr('')
    const r = await json('PUT', `/movies/${movie.id}`, {
      source: c.source || 'tmdb',
      source_id: c.source === 'tvdb' ? c.source_id : String(c.tmdb_id || c.source_id),
      media_type: c.media_type || movie.media_type || 'movie',
    })
    if (r.ok) onDone()
    else setErr(errText(r))
  }

  return (
    <RecordRow
      mark={<RowArt src={movie.poster_path ? coverImgURL(movie.poster_path) : null} alt={t('metadata.row.noposter.aria')} />}
      name={movie.title}
      // metadata.count.dialogues rather than the shared unit.dialogue: that noun
      // now reads "film line", and this row has always counted "dialogues".
      // Migrating keys is not the place to change a word.
      sub={<>
        {movie.release_year ? <span>{movie.release_year}</span> : null}
        {movie.release_year && movie.dialogue_count > 0 ? <span aria-hidden="true"> · </span> : null}
        {movie.dialogue_count > 0 && (
          <Tally
            n={movie.dialogue_count}
            word={t('metadata.count.dialogues', { count: movie.dialogue_count, n: movie.dialogue_count })}
            icon={<IconNavQuotes />}
          />
        )}
      </>}
      chips={gaps.map((g) => ({ label: g, warn: true }))}
      chipsEmpty={t('metadata.row.complete')}
      select={{ checked, onChange: onCheck, tip: t('metadata.row.select.tip', { noun }), label: t('metadata.row.select.aria', { name: movie.title }) }}
      actions={consoleRowActions({ editing, onEdit: () => setEditing((v) => !v), lookingUp: open, onLookup: onToggleLookup, onOpen: onOpen && (() => onOpen(movie.id)), noun, name: movie.title })}
    >
      {editing && <InlineEdit kind="movies" id={movie.id} onDone={() => { setEditing(false); onDone() }} onCancel={() => setEditing(false)} />}
      {open && (
        <div className="mt-3">
          <MovieLookupPicker title={movie.title} year={movie.release_year} mediaType={movie.media_type || 'movie'} tmdbId={movie.tmdb_id} tvdbId={movie.tvdb_id} onPick={resync} />
          <ErrorText>{err}</ErrorText>
        </div>
      )}
    </RecordRow>
  )
}

// BulkEditForm applies a correction to the whole selection at once (the "select
// the wrong ones, replace with the right value" flow). Only the fields you fill
// are sent — an empty field is left untouched (an empty author/series clears it,
// which is why those are opt-in checkboxes, not blank = clear).
function BulkEditForm({ n, busy, onApply }) {
  const [setAuthor, setSetAuthor] = useState(false)
  const [author, setAuthor2] = useState('')
  const [setSeries, setSetSeries] = useState(false)
  const [series, setSeries2] = useState('')
  const [seriesIndex, setSeriesIndex] = useState('')
  const [addGenres, setAddGenres] = useState('')

  function apply() {
    const fields = {}
    if (setAuthor) fields.author = author.trim()
    if (setSeries) {
      fields.series = series.trim()
      if (seriesIndex.trim()) fields.series_index = Number(seriesIndex) || 0
    }
    const genres = splitCommas(addGenres)
    if (genres.length) fields.add_genres = genres
    if (Object.keys(fields).length === 0) return
    onApply(fields)
  }

  return (
    <div className="space-y-2.5 rounded-xl p-3" style={{ border: '1px solid var(--line)', background: 'var(--raised)' }}>
      <MonoLabel className="block">{t('metadata.bulk.title', { n })}</MonoLabel>
      <label className="flex flex-wrap items-center gap-2">
        <input type="checkbox" checked={setAuthor} onChange={(e) => setSetAuthor(e.target.checked)} />
        {/* The FIELD'S OWN NAME, from the shared table: a field is called the same
            thing here as it is on the form that edits one row of it. */}
        <span className="microcopy" style={{ minWidth: 54 }}>{t('common.field.author.label')}</span>
        <input className="tp-input w-auto flex-1" placeholder={t('metadata.bulk.author.placeholder')} value={author} disabled={!setAuthor} onChange={(e) => setAuthor2(e.target.value)} />
      </label>
      <label className="flex flex-wrap items-center gap-2">
        <input type="checkbox" checked={setSeries} onChange={(e) => setSetSeries(e.target.checked)} />
        <span className="microcopy" style={{ minWidth: 54 }}>{t('common.field.series.label')}</span>
        <input className="tp-input w-auto flex-1" placeholder={t('metadata.bulk.series.placeholder')} value={series} disabled={!setSeries} onChange={(e) => setSeries2(e.target.value)} />
        {/* "#" is a symbol rather than a word, so it is the same in every language
            — keyed all the same, so the slot has exactly one owner. */}
        <input className="tp-input w-16 shrink-0" placeholder={t('metadata.bulk.series-no.placeholder')} inputMode="decimal" value={seriesIndex} disabled={!setSeries} onChange={(e) => setSeriesIndex(e.target.value)} />
      </label>
      <label className="flex flex-wrap items-center gap-2">
        <span className="microcopy" style={{ minWidth: 72, marginLeft: 22 }}>{t('metadata.bulk.genres.label')}</span>
        <input className="tp-input w-auto flex-1" placeholder={t('metadata.bulk.genres.placeholder')} value={addGenres} onChange={(e) => setAddGenres(e.target.value)} />
      </label>
      <button className="tp-btn tp-btn-primary" disabled={busy} onClick={apply}>
        {t('metadata.bulk.apply.label', { n })}
      </button>
    </div>
  )
}

// ---- duplicate detection + merge ----

// DuplicatesPanel loads fuzzy-title duplicate groups and lets you merge each
// group into a chosen keeper (annotations move over, dupes drop, sources delete).
function DuplicatesPanel({ onDone, onFlash, arriveScanning = false, onArrived = null }) {
  const { ask, confirmDialog } = useConfirm()
  const [groups, setGroups] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [open, setOpen] = useState(false)

  async function scan() {
    setBusy(true)
    setErr('')
    const r = await json('GET', '/metadata/duplicates')
    setBusy(false)
    setOpen(true)
    if (r.ok) setGroups(r.data.groups)
    else setErr(errText(r, t('error.scan.duplicates')))
  }

  // ARRIVED WITH A SCAN ALREADY ASKED FOR, from the phone index's Works verb.
  // The intent is cleared FIRST and on the page that owns it, so walking back
  // into this section later is an ordinary arrival rather than a second scan —
  // an effect that re-fires on every entry is a control the reader cannot
  // un-press. `scanning` is a ref rather than state because clearing the intent
  // re-renders this component, and a guard held in state would not have been
  // written yet when the effect ran again.
  const scanning = useRef(false)
  useEffect(() => {
    if (!arriveScanning || scanning.current) return
    scanning.current = true
    onArrived?.()
    scan()
  }, [arriveScanning])

  // `kind` IS THE GROUP'S, NOT A GUESS. The scan covers every work now, so a
  // group is books or screen works and the two merge through different endpoints
  // — different child table, different genre join, different orphan sweep. The
  // row says which it is and this passes it on; deriving it here from anything
  // else would be this screen having an opinion about which table a record came
  // from, which is the server's to state and did, in `kind`.
  async function merge(into, from, kind) {
    // "book(s)" became a plural family, and the second half of the sentence has
    // to agree with it — hence a whole message per form, not a shared tail.
    if (!(await ask(t('metadata.duplicates.merge.confirm', { count: from.length, n: from.length })))) return
    setBusy(true)
    setErr('')
    const r = await json('POST', kind === 'movie' ? '/movies/merge' : '/books/merge', { into, from })
    setBusy(false)
    if (!r.ok) return setErr(errText(r, t('error.merge.failed')))
    onFlash(t('metadata.duplicates.merge.flash', { count: r.data.merged, n: r.data.merged }))
    scan()
    onDone()
  }

  return (
    <HandCard className="pref-group space-y-3">
      {confirmDialog}
      {/* Was a JavaScript ternary picking between "group" and "groups", which is
          a plural rule written in the one place that cannot hold it. */}
      <CardHead
        title={t('metadata.duplicates.title')}
        info={t('metadata.duplicates.info.body')}
        aside={groups ? t('metadata.duplicates.groups', { count: groups.length, n: groups.length }) : null}
      >
        <IconButton
          icon={<IconSearch />}
          ariaLabel={open ? t('metadata.duplicates.rescan.aria') : t('metadata.duplicates.scan.label')}
          disabled={busy}
          onClick={scan}
          tooltip={open ? t('metadata.duplicates.rescan.tip') : t('metadata.duplicates.scan.label')}
        />
      </CardHead>
      <ErrorText>{err}</ErrorText>
      {open && groups && groups.length === 0 && <p className="microcopy">{t('metadata.duplicates.none')}</p>}
      {groups && groups.length > 0 && (
        <div className="space-y-3">
          {groups.map((g, i) => (
            <DuplicateGroup key={i} group={g} busy={busy} onMerge={merge} />
          ))}
        </div>
      )}
    </HandCard>
  )
}

function DuplicateGroup({ group, busy, onMerge }) {
  // Default keeper = the copy with the most annotations (least to lose).
  const [keep, setKeep] = useState(() => group.reduce((a, b) => (b.annotation_count > a.annotation_count ? b : a), group[0]).id)
  return (
    <div className="rounded-xl p-3" style={{ border: '1px solid var(--line)' }}>
      <div className="space-y-1.5">
        {group.map((b) => (
          <label key={b.id} className="flex flex-wrap items-center gap-2">
            <input type="radio" name={`keep-${group[0].id}`} checked={keep === b.id} onChange={() => setKeep(b.id)} />
            <NameScroll className="min-w-0 flex-1 text-sm">
              <b>{b.title}</b>
              {b.author && <span style={{ color: 'var(--soft)' }}> · {b.author}</span>}
              {b.year ? <span className="microcopy"> · {b.year}</span> : null}
              <span className="microcopy"> · {t('common.count.phrase', { n: b.annotation_count, noun: t('unit.quote', { count: b.annotation_count }) })}</span>
            </NameScroll>
            {keep === b.id && <span className="tp-chip shrink-0" style={{ color: 'var(--accent-ui)' }}>{t('metadata.duplicates.keep.label')}</span>}
          </label>
        ))}
      </div>
      <div className="mt-2">
        <GhostButton
          icon={<IconMerge />}
          keepLabel
          disabled={busy}
          onClick={() => onMerge(keep, group.filter((b) => b.id !== keep).map((b) => b.id), group[0].kind)}
        >
          {t('metadata.duplicates.merge.label')}
        </GhostButton>
      </div>
    </div>
  )
}

// ---- per-title speaker remap ----

// remapLabels turns a movie's dialogue rows into the remappable speaker labels.
//
// AN ENSEMBLE IS NOT A REMAPPABLE LABEL. A line spoken by two characters is stored
// as one string, "V, Evey", and offering that whole string as a row asked you to map
// an ensemble onto a single cast member — which is not a thing. It contributes its
// INDIVIDUALS instead, "V" and "Evey".
//
// The count is the number of LINES the name appears in, so it matches what applying
// the mapping will touch. A line reading "V, V" therefore counts once for V, not
// twice — hence the Set.
//
// splitCredits is the app's own splitter on the reader's own separator preference,
// the same pair that turns "Gaiman & Pratchett" into two people. A second splitter
// here would be a second thing to keep in step with the server, which rewrites
// exactly these components through metadata.ReplaceCredit.
//
// Exported and pure so the rule can be tested without mounting a screen that fetches
// two endpoints on mount — it was previously inline in that fetch, which is why
// nothing checked it.
export function remapLabels(dialogues, seps) {
  const counts = {}
  for (const d of dialogues || []) {
    const names = new Set(
      splitCredits((d.character || '').trim(), seps)
        .map((n) => n.trim())
        .filter(Boolean),
    )
    for (const n of names) counts[n] = (counts[n] || 0) + 1
  }
  return Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    // Commonest first, then alphabetical, so the order is stable rather than
    // whatever the object happened to enumerate.
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

// Exported for its test, like remapLabels above it. The alternative is reaching
// this panel through MetadataPage — which means an admin user, a tab, and a
// catalogue load — and a test that spends four steps arriving is a test of the
// route rather than of the panel.
export function SpeakerRemap({ movies, onDone, user }) {
  const [movieId, setMovieId] = useState('')
  const [cast, setCast] = useState([])
  const [labels, setLabels] = useState([])
  const [maps, setMaps] = useState({})
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  // THE SCREEN USED TO ANSWER BEFORE IT HAD ASKED. Picking a film set `movieId`
  // and then awaited two requests, and for that whole round trip `cast` and
  // `labels` were still the arrays they had been — so on the FIRST pick both were
  // empty and the panel showed "this film has no cast" and "no speaker labels"
  // about a film it had not read a byte of, in amber, and then took them back.
  // On a SECOND pick it was worse than wrong: the previous film's labels stayed
  // under the new film's name, offering rows to remap that the selected film does
  // not contain.
  const [loading, setLoading] = useState(false)
  // A request that is no longer the answer to the question on screen. Switching
  // films twice quickly leaves two flights racing, and without this the slower —
  // the FIRST — wins, painting film A's cast under film B.
  const flight = useRef(0)

  async function loadMovie(id) {
    const mine = ++flight.current
    setErr('')
    setMsg('')
    setMaps({})
    setCast([])
    setLabels([])
    if (!id) {
      setLoading(false)
      return
    }
    setLoading(true)
    const [mr, dr] = await Promise.all([json('GET', `/movies/${id}`), json('GET', `/dialogues?movie_id=${id}`)])
    if (mine !== flight.current) return
    setLoading(false)
    // A FAILED READ IS NOT AN EMPTY CAST. `(mr.ok && mr.data.cast) || []` turned
    // any failure into the amber line below, which tells the reader to go and fill
    // in a cast that may already be there.
    if (!mr.ok || !dr.ok) return setErr(errText(mr.ok ? dr : mr, t('error.load.cast')))
    setCast(mr.data.cast || [])
    setLabels(remapLabels(dr.data.dialogues, parseCreditSeps(user?.preferences?.creditSeparators)))
  }
  useEffect(() => {
    loadMovie(movieId)
  }, [movieId])

  // A remap with nothing mapped is the must-fill case here, so "Apply remap"
  // greys out until at least one row is chosen (see the button below). Refilling
  // actors from the cast needs no mapping at all, hence the `refill` exemption.
  const mapped = Object.values(maps).filter(Boolean).length

  async function apply(refill = false) {
    setBusy(true)
    setErr('')
    setMsg('')
    const mappings = Object.entries(maps)
      .filter(([, v]) => v)
      .map(([from, v]) => ({ from, character: v.character, actor: v.actor || '' }))
    if (!refill && mappings.length === 0) {
      setBusy(false)
      // The button is named ONCE, in its own key, and quoted into the sentence.
      return setErr(t('error.validate.mapping-required', { action: t('metadata.actors.fill.label') }))
    }
    const r = await json('POST', `/movies/${movieId}/remap-speakers`, { mappings, refill })
    setBusy(false)
    if (!r.ok) return setErr(errText(r))
    setMsg(
      t('metadata.speakers.remapped.flash', { n: r.data.remapped }) +
        (r.data.refilled
          ? t('metadata.speakers.refilled.flash', { count: r.data.refilled, n: r.data.refilled })
          : ''),
    )
    loadMovie(movieId)
    onDone()
  }

  return (
    <HandCard className="pref-group space-y-3">
      <CardHead title={t('metadata.speakers.title')} info={t('metadata.speakers.info.body')} />
      <Select
        value={movieId}
        onChange={setMovieId}
        ariaLabel={t('metadata.speakers.title')}
        placeholder={t('metadata.speakers.pick.placeholder')}
        filter
        options={movies.map((m) => [
          String(m.id),
          `${m.title}${m.release_year ? ` ${t('metadata.speakers.option.year', { year: m.release_year })}` : ''}`
            + ` · ${t('metadata.count.dialogues', { count: m.dialogue_count, n: m.dialogue_count })}`,
        ])}
      />

      {/* AT PANEL LEVEL, and it used to sit inside the `labels.length > 0` block
          below — so the one failure that leaves no labels, a failed read, was the
          one failure that could not be reported. An error slot reachable only on
          success is not an error slot. It serves the apply errors too: this card
          is four rows tall and there is nowhere in it that is far away. */}
      <ErrorText>{err}</ErrorText>
      {movieId && loading && <p className="microcopy">{t('metadata.speakers.loading')}</p>}
      {movieId && !loading && !err && cast.length === 0 && (
        <p className="microcopy" style={{ color: 'var(--amber, var(--accent-ui))' }}>
          {t('metadata.speakers.nocast')}
        </p>
      )}
      {movieId && !loading && !err && labels.length === 0 && <p className="microcopy">{t('metadata.speakers.nolabels')}</p>}
      {movieId && !loading && labels.length > 0 && (
        <>
          <MonoLabel className="block">{t('metadata.speakers.map.label')}</MonoLabel>
          <div>
            {labels.map((l) => (
              <RemapRow key={l.name} label={l} cast={cast} value={maps[l.name]} onChange={(v) => setMaps((m) => ({ ...m, [l.name]: v }))} />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="tp-btn tp-btn-primary"
              disabled={busy || mapped === 0}
              title={mapped === 0 ? t('metadata.speakers.apply.disabled.tip') : undefined}
              onClick={() => apply(false)}
            >
              {t('metadata.speakers.apply.label')}
            </button>
            <GhostButton icon={<IconUsers />} disabled={busy} onClick={() => apply(true)}>
              {t('metadata.actors.fill.label')}
            </GhostButton>
            {msg && (
              <span className="microcopy" style={{ color: 'var(--accent-ui)' }}>
                {msg}
              </span>
            )}
          </div>
        </>
      )}
    </HandCard>
  )
}

function RemapRow({ label, cast, value, onChange }) {
  const idx = value && !value.custom ? cast.findIndex((c) => c.character === value.character && c.actor === value.actor) : -1
  const sel = value?.custom ? 'custom' : idx >= 0 ? `cast:${idx}` : ''
  return (
    <div className="flex flex-wrap items-center gap-2 py-2" style={{ borderTop: '1px solid var(--line)' }}>
      <NameScroll className="min-w-0 flex-1">
        <span style={{ fontWeight: 600 }}>{label.name}</span>
        <span className="microcopy"> · {label.count}</span>
      </NameScroll>
      <span className="microcopy" aria-hidden="true"><IconArrow size={13} /></span>
      <Select
        value={sel}
        ariaLabel={t('metadata.remap.row.aria', { name: label.name })}
        onChange={(v) => {
          if (v === '') onChange(undefined)
          else if (v === 'custom') onChange({ character: label.name, actor: '', custom: true })
          else {
            const i = Number(v.slice(5))
            onChange({ character: cast[i].character, actor: cast[i].actor })
          }
        }}
        options={[
          ['', t('metadata.remap.keep.label')],
          ...cast.map((c, i) => {
            const character = c.character || t('metadata.remap.nocharacter.label')
            return [`cast:${i}`, c.actor ? t('metadata.remap.cast.option', { character, actor: c.actor }) : character]
          }),
          ['custom', t('metadata.remap.custom.label')],
        ]}
      />
      {value?.custom && (
        <>
          <NameInput
            className="tp-input w-auto"
            style={{ maxWidth: 150 }}
            placeholder={t('common.field.character.label')}
            value={value.character}
            onChange={(e) => onChange({ ...value, character: e.target.value })}
          />
          <NameInput
            className="tp-input w-auto"
            style={{ maxWidth: 150 }}
            placeholder={t('common.field.actor.label')}
            value={value.actor}
            onChange={(e) => onChange({ ...value, actor: e.target.value })}
          />
        </>
      )}
    </div>
  )
}

// PruneButton — clear every saved record nothing points at.
//
// TWO CONSOLES, ONE BUTTON, because the sweep is one endpoint: a person with no
// credits and a character with no cast rows are the same problem, and a reader
// standing in either list wants the same thing done. Rendering it in both places
// rather than picking one means neither list is the wrong place to look.
//
// IT COUNTS BEFORE IT OFFERS. A button that says "Prune" and then reports nothing
// to do is a button that teaches you not to press it, so this draws nothing at all
// at zero — and when it draws, it says how many, which is also what the confirm
// has to say to be answerable.
//
// The confirm names the two kinds separately. "23 records" is a number a reader
// cannot check; "4 people and 19 characters" is one they can recognise, and the
// characters are usually the surprise — the per-work backfill makes eight Harry
// Potters and seven of them end up pointing at nothing.
// THE CONFIRM NAMES THEM, and for two days it did not. The owner: "The prune
// doesn't show whom I am going to prune." `GET /people/orphans` has always
// returned the ROWS — its own handler says why, "a confirm that says 'remove 23
// records' without naming one is a dialog a reader cannot answer" — and this
// button read `.length` off both lists and threw the names away. The server was
// right and the client was asking the reader to trust it.
//
// A DELETE CANNOT BE ANSWERED FROM A NUMBER. "23 records" is not a question
// anybody can say yes to: the reader's actual question is whether the one person
// they care about is in there, and only the list answers it.
function PruneButton({ onDone, onFlash }) {
  const [orphans, setOrphans] = useState(null)
  const [busy, setBusy] = useState(false)
  const { ask, confirmDialog } = useConfirm()
  const load = useCallback(async () => {
    const r = await json('GET', '/people/orphans')
    if (r.ok) setOrphans({ people: r.data.people || [], characters: r.data.characters || [] })
  }, [])
  useEffect(() => { load() }, [load])
  const total = orphans ? orphans.people.length + orphans.characters.length : 0
  if (total === 0) return null
  // EVERY NAME, IN A BOX THAT SCROLLS. Not the first five and a "…and 18 more":
  // the eighteen are exactly the ones the reader has not checked, and a list that
  // hides them answers the question for the easy cases only. The box is capped in
  // `em` so a prune of two is two lines and a prune of two hundred is still a
  // dialog.
  const nameList = (rows, heading) => rows.length > 0 && (
    <div className="prune-group">
      <MonoLabel>{heading}</MonoLabel>
      <Scroller axis="v" className="prune-names">
        {rows.map((o) => <span key={o.id} className="tp-chip">{o.name}</span>)}
      </Scroller>
    </div>
  )
  const run = async () => {
    const ok = await ask(t('metadata.prune.confirm.title', { n: total }), {
      body: (
        <>
          <p>{t('metadata.prune.confirm.body')}</p>
          {nameList(orphans.people, t('metadata.prune.confirm.people', { count: orphans.people.length, n: orphans.people.length }))}
          {nameList(orphans.characters, t('metadata.prune.confirm.characters', { count: orphans.characters.length, n: orphans.characters.length }))}
        </>
      ),
      confirmLabel: t('metadata.prune.confirm.cta'),
    })
    if (!ok) return
    setBusy(true)
    const r = await json('POST', '/people/prune')
    setBusy(false)
    if (!r.ok) return toast(errText(r, t('error.prune')))
    const n = (r.data.people || 0) + (r.data.characters || 0)
    toast(t('metadata.prune.toast', { count: n, n }))
    // The count and the list both go stale in one act, so both are re-read.
    load()
    onFlash?.('')
    onDone?.()
  }
  return (
    <>
      {/* GLYPH ONLY, AND ITS COUNT IS IN THE NAME. The People console's filter row
          did not fit on one line — measured, it overflowed 283px at 390 and 399px
          at 1280, so a third of it sat off-screen behind a sideways scroll. The
          owner asked for both halves of the repair in one sentence: "one line for
          the filter row, and long-press names a glyph button." The words come off
          so the row fits; the hold puts them back, count and all. */}
      <IconButton
        icon={<IconDelete />}
        /* THE FIGURE STAYS DRAWN; ONLY THE WORD COMES OFF. That is the count rule
           as written: on a row already carrying buttons and several facts, the
           glyph stands in for the noun and the number remains ordinary text a
           reader can read, copy and find. A first cut put the whole label in the
           accessible name and three cases went red for the right reason — the
           button had stopped saying how many it would take. */
        label={total > 0 ? String(total) : ''}
        keepLabel
        disabled={busy}
        className="tp-btn-danger"
        ariaLabel={t('metadata.prune.count.label', { n: total })}
        tooltip={t('metadata.prune.tip')}
        onClick={run}
      />
      {confirmDialog}
    </>
  )
}

// ---- characters console ----

// workRefKey — the value a work filter is keyed by. Not the title: a novel and its
// film share one, and so do two editions of the same book.
const workRefKey = (w) => `${w.kind}:${w.id}`

// HOW MANY WORK PILLS A ROW DRAWS. The server caps a PERSON's refs at six for the
// same reason and the character list is uncapped, so the cap is applied here too
// rather than trusting the wire: a character in forty films would otherwise draw
// forty pills into a strip a reader has to drag past. The count beside the icon is
// what says there are more, and the record's own screen lists them all.
const MAX_ROW_WORK_PILLS = 6

// CharacterRow — one character, and the question the console exists to answer.
//
// WHAT THE ROW SAYS NOW THAT IT DID NOT. It stated the character's name, its sort
// name and how many works it turned up in — three facts, one of them a spelling
// nobody reads a list for. The pack's row states something else entirely
// (`metadata.dc.html:715-723`): how many of those appearances have a FACE. That is
// the point of the whole table. A character wears a different face in every work —
// the picture lives on the cast row, not on the character — so "three works, one of
// them with a face" is the finding, and until `has_face` landed on the API the
// client could not have drawn it.
//
// THE COUNT IS THE GAP, NOT THE TOTAL, and it prints only when there is one. A
// library of forty characters is forty rows saying "3"; the same forty saying "2"
// in red on nine of them is a list you can work down. The total moved into the
// sub-line, which is where the pack puts it, and a row says a thing once.
//
// AND THE SORT NAME IS GONE FROM THE ROW. It is on the record's own screen, one
// press away under the name, and it was taking the line the faces needed. A
// spelling used for ordering is not what a reader scans a list of people for.
//
// THE SILHOUETTE IS THE PACK'S. The row passed `fallback={null}`, so a character
// with no picture drew an empty gap in a column of faces — `silhouette(faces > 0)`
// is the pack's own, and `Face`'s default already is one. Six of them, hashed off
// the name, so a list does not read as one person repeated.
//
// TWO VERBS, NOT THE PACK'S THREE. It draws choose-faces, merge and delete; the
// name and the portrait already open the record, and choosing a face per work is
// what that record's appearance grid IS — so a third door to it would be the
// redundancy the repo directive names. Merge and delete are the two acts the LIST
// can do that the list could not reach, and both are the pack's.
//
// ── AND THEN THE OWNER READ IT ON A PHONE, and the row above is what they were
// reading. Three reports, all of them about this row:
//
// "The characters show work, but not quotes." A character IS the thing that says
// lines, so a row about one that counts everything except what they said is a row
// missing its subject. `quotes` is served now and sits beside the works count.
//
// "the red 1 in the character row seems to only be taking up space without giving
// any addl info" — and it was right. The number was `works - faced`, an
// appearance with no picture chosen, painted in the danger colour at the far right
// of every row. It could not be pressed, the sub-line beside it already said
// "1 of 3 with a face chosen", and a colour the app reserves for destruction was
// being spent on a missing thumbnail. It is a pill in the filter row now, where a
// reader can ask for exactly those rows instead of scanning for red.
//
// "The subtitle should be like this: x <work_icon>•y <quote_icon> - <work names
// like pills, with edgemask and sidescroll>" — verbatim, and `RowCounts` draws
// exactly that. What it replaces is "3 works · 1 of 3 with a face chosen": a
// sentence about a sub-count, written the long way round, where the shape of the
// answer was wanted.
// THE MEDIA A CHARACTER TURNS UP IN, as glyphs, one per distinct medium. The
// owner, asked what a character's row should carry where a person's carries
// roles: "medium and performers (full list of chip with clickable pills,
// edgemasked)."
//
// `kind` IS THE MEDIUM AND `media_type` IS THE SHAPE OF IT. A row's appearances
// are books or movies, and a movie row may be a film, a show or a game — which is
// a distinction the catalogue already draws and the reason a clapper board is not
// enough on its own. A character in two films draws ONE clapper; a character in a
// novel and its adaptation draws two glyphs, which is the fact worth seeing.
//
// AND A SHOW IS NOT A FILM, which the first cut said on every row that had one.
// `media_type` is 'movie' | 'show' (migration 0006) with 'game' layered on top, and
// the table read only the 'game' branch — so a character in a television series drew
// a clapper board labelled "film", in an app whose catalogue has said "show" since
// 0006 and whose `unit.show` string was already written. A medium glyph that names
// the wrong medium is worse than no glyph: the reader has no reason to doubt it.
const CHARACTER_MEDIA = {
  book: [IconBooks, 'unit.book'],
  movie: [IconReel, 'unit.film'],
  show: [IconReel, 'unit.show'],
  game: [IconNavCatalogue, 'unit.game'],
}
// THE SAME DRAWING FOR A FILM AND A SHOW, DELIBERATELY, and only the word differs.
// There is one clapper board in the set and inventing a second glyph here would be
// a picture nobody has seen standing for a distinction the word already makes — the
// app's rule is that a screen's glyphs are its own. Both keys stay because the map
// carries the NOUN as well, and the noun is the half that was wrong.
//
// SO THE ROW GROUPS BY THE DRAWING, NOT BY THE KEY, and that is the other half.
// A character in a film AND a show would otherwise draw two identical clappers
// side by side, told apart only by a tooltip nobody has hovered — which is this
// repo's own "a lookalike next to the real glyph is two pictures of one thing",
// and reads as a rendering fault rather than as a fact. One clapper, and its name
// lists what it stands for here: "films and shows" where the row has both, "show"
// where it has only the one. The count rule's own logic — the glyph is the
// picture, the noun is what it is a picture OF — so a drawing that covers two
// nouns says two nouns.
const characterMedia = (worksIn) => {
  const byGlyph = new Map()
  for (const w of worksIn || []) {
    const key = w.kind === 'movie' && CHARACTER_MEDIA[w.media_type] ? w.media_type : w.kind
    const entry = CHARACTER_MEDIA[key]
    if (!entry) continue
    const [Glyph, word] = entry
    const got = byGlyph.get(Glyph)
    if (!got) byGlyph.set(Glyph, [key, [word]])
    else if (!got[1].includes(word)) got[1].push(word)
  }
  return [...byGlyph.entries()].map(([Glyph, [key, words]]) => [key, [Glyph, words]])
}

function CharacterRow({ c, first, onOpen, onMerge, onDelete, onWork = null, onPerson = null }) {
  const works = c.works || 0
  const media = characterMedia(c.works_in)
  // A PERFORMER AND THE WORK THEY PLAYED THE PART IN ARE ONE CHIP — the owner:
  // "performer and work shall be in the same chip, as they are interdependent."
  // Two strips, one of people and one of works, could not say who played the part
  // in which film. Every performer on an appearance is listed (a work can bill a
  // role and its voice), each a door to the person; a book has none, and its chip
  // is the plain work.
  const items = (c.works_in || []).slice(0, MAX_ROW_WORK_PILLS).map((w) => {
    const actors = (w.actors || []).filter((a) => a.id && a.name)
    return {
      work: w,
      lead: actors.length > 0 && actors.map((a) => (
        <button key={a.id} type="button" className="credit-pill-person tactile" onClick={() => onPerson?.(a)}>{a.name}</button>
      )),
    }
  })
  return (
    <RecordRow
      first={first}
      className="record-row-lg"
      /* THE SAME PORTRAIT AS A PERSON'S — the owner: "character images in the
         character page are still small, they should be the same size as the images
         in the people page." Same box, same full-row height, same circle; a
         character's face opens nothing, so it is a plain span in that box. */
      mark={
        <span className="person-face-btn is-static">
          <Face src={c.image_path} url={coverImgURL} name={c.name || ''} className="person-face-inner" />
        </span>
      }
      name={c.name}
      onOpen={onOpen}
      /* ZERO AND ZERO IS STILL THE ANSWER, so the counts draw whatever they are:
         "0 works, 0 quotes" is the finding on a character nobody points at, and
         it is the finding the filter row's own pills are counting. */
      head={<>
        <RowCounts
          works={works}
          quotes={c.quotes || 0}
          worksLabel={t('metadata.row.works.label')}
          quotesLabel={t('metadata.row.quotes.label')}
        />
        {media.length > 0 && (
          <span className="row-role-marks">
            {media.map(([key, [Glyph, words]]) => {
              // ` · ` IS THIS FILE'S OWN SEPARATOR for a list inside one label —
              // the spellings sub-line and the fetch flash both use it — so a
              // mark covering two media reads the way every other list here does.
              const label = words.map((w) => t(w, { count: 1 })).join(' · ')
              return (
                <Tooltip key={key} label={label}>
                  <span className="row-role-mark" role="img" aria-label={label}>
                    <Glyph size={15} />
                  </span>
                </Tooltip>
              )
            })}
          </span>
        )}
      </>}
      sub={<CreditPills items={items} onOpen={onWork} />}
      actions={[
        {
          key: 'merge',
          icon: <IconMerge />,
          ariaLabel: t('metadata.characters.action.merge.aria', { name: c.name }),
          onClick: onMerge,
        },
        {
          key: 'delete',
          icon: <IconDelete />,
          danger: true,
          ariaLabel: t('metadata.characters.action.delete.aria', { name: c.name }),
          onClick: onDelete,
        },
      ]}
    />
  )
}

// CharactersConsole — every character record in the library, with how many works
// each is linked to.
//
// IT IS ITS OWN LIST BESIDE THE PEOPLE ONE, not a sixth chip inside it. The two
// tables answer different questions and 0056 kept them apart for that reason: a
// picker for who wrote a book must never offer Woland, and a picker for who says a
// line must never offer Bulgakov. Folding characters into the kind toggle would put
// them one click from every rename that rewrites a credit column.
//
// WHAT THIS SCREEN IS FOR. The backfill creates a character record PER WORK rather
// than resolving by name — eight Harry Potter films become eight Harry Potters —
// because a wrongly-merged character hides a whole person and a wrongly-split one
// is visible and mergeable. This list is where it becomes visible. Until the merge
// endpoint lands it reviews and edits; it does not yet weld.
//
// "0 WORKS" IS THE ROW WORTH READING. A character linked to nothing is either one
// the reader made and has not paired yet, or one whose last cast row went — and
// both are things only this list can show, because a character with no works
// appears on no work's page by definition.
export function CharactersConsole({ rows = null, onReload = null, onOpenWork = null }) {
  const mobile = useIsMobileScreen()
  const [own, setOwn] = useState(null)
  const [q, setQ] = useState('')
  // The section a reader is IN is what the shell's field asks about — see
  // CatalogueConsole for the argument. Three consoles, one context each, and only
  // the one on screen is published.
  useScreenSearch({ key: 'metadata-characters', label: t('shell.search.where.characters'), onQuery: setQ })
  // WHICH WORK, and it is the question this list could not answer.
  //
  // The backfill makes a character record PER WORK — eight films of one series
  // are eight Harrys — so the list a reader actually wants is "everybody in this
  // one film", and the only control here was a name box. Searching "Harry" gave
  // them all eight and no way to tell which was which.
  //
  // '' is every work; '~none' is the rows worth reading — a character linked to
  // nothing, which appears on no work's page by definition and can therefore be
  // found nowhere else at all.
  const [work, setWork] = useState('')
  // WHICH ISSUE, as a row of pills above the list. See PERSON_ISSUES for the
  // argument; '' is every row.
  const [issue, setIssue] = useState('')
  const [err, setErr] = useState('')
  // MERGE AND DELETE FROM THE LIST, which is the pack's row and is also where the
  // work is. The backfill makes a character record PER WORK, so de-duplicating is
  // eight rows at a time — and both verbs lived only behind the record's own
  // screen, which meant opening each of the eight to fold it into the first.
  //
  // THE SAME SHEET THE RECORD OPENS, not a second one. `MergeSheet` is the search
  // that identity.jsx's screens already use, and a merge started here has to mean
  // exactly what a merge started there means — the repo's two-things-that-look-the
  // -same rule, applied to the one act on this screen that cannot be undone.
  const [merging, setMerging] = useState(null)
  const { ask, confirmDialog } = useConfirm()
  // THE PANEL, NOT A FORM OF THIS SCREEN'S OWN. A character record is the same
  // thing whether you reach it from here or from a work's cast, and the app now
  // has one surface for a record — the three scopes, the aliases, and the
  // performer on each appearance. A second edit form here would have been the
  // second place those distinctions are drawn, and the first place they drift.
  const stack = usePanelStack()

  // THE LIST CAN BE HANDED IN OR FETCHED, and which one happens is decided by the
  // caller rather than by a flag. The metadata page holds it because the rail
  // prints its size; anywhere else the console is on its own and fetches. Two
  // fetches of one list is two numbers that can disagree, which is the failure
  // this shape exists to make impossible rather than merely unlikely.
  const owned = !onReload
  const load = useCallback(async () => {
    if (!owned) return onReload()
    const r = await json('GET', '/characters')
    if (r.ok) setOwn(r.data.characters)
    else setErr(errText(r))
  }, [owned, onReload])
  useEffect(() => {
    if (owned) load()
  }, [owned, load])
  const list = owned ? own : rows

  // DELETE GOES TO THE BIN, which is what makes a row-level delete offerable at
  // all: `binRecord` writes the record's snapshot before the row goes, so the
  // confirm can promise the reader a way back rather than asking them to be sure.
  const remove = async (c) => {
    if (!(await ask(t('metadata.characters.delete.confirm.title', { name: c.name }), {
      body: t('metadata.characters.delete.confirm.body'),
      confirmLabel: t('common.action.delete.label'),
      danger: true,
      reversible: true,
    }))) return
    const r = await json('DELETE', `/characters/${c.id}`)
    if (!r.ok) return setErr(errText(r))
    toast(t('metadata.characters.delete.done', { name: c.name }))
    load()
  }

  // THE PILLS COUNT WHAT THE OTHER FILTERS LEFT, so `base` stops one step short
  // of the issue filter and `shown` applies it. A pill counted over the whole
  // library would say 40 and land on 3 the moment a work is chosen.
  const base = useMemo(() => {
    const s = q.trim().toLowerCase()
    return (list || [])
      .filter((c) => !s || c.name.toLowerCase().includes(s))
      .filter((c) => !work || (c.works_in || []).some((w) => workRefKey(w) === work))
  }, [list, q, work])
  const shown = useMemo(() => base.filter(issueTest(CHARACTER_ISSUES, issue)), [base, issue])

  // THE WORKS THAT ACTUALLY HAVE CHARACTERS, built from the list itself rather
  // than from the library. A dropdown of nine hundred books, of which eleven have
  // a cast, is a dropdown a reader scrolls past the answer in — and this console
  // is also mounted on its own, where there is no library list to read.
  //
  // Titles collide (two editions, a film and its novel), so the value is the
  // kind and the id and only the WORDS are the title.
  const workOptions = useMemo(() => {
    const seen = new Map()
    for (const c of list || []) {
      for (const w of c.works_in || []) {
        const k = workRefKey(w)
        if (!seen.has(k)) seen.set(k, w.title)
      }
    }
    const rowsOut = [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]))
    // NO "IN NO WORK" ROW ANY MORE. It was this dropdown's odd one out — every
    // other row names a work and that one named the absence of every work — and
    // it is a pill in the issue row now, beside the other two absences and
    // carrying its own count, which a dropdown row could never do.
    return [['', t('metadata.characters.work.all.label')], ...rowsOut]
  }, [list])

  return (
    <section className="space-y-3">
      {/* NO HEADING AND NO DOT: THE SECTION IS BOTH. This console drew
          "Characters" with an info dot directly under a rail that had just drawn
          "Characters" with an info dot — two headings saying one word, two dots,
          nothing between them. The owner: "In a lot of places, you have two levels
          of headers, each with their own infodots. Consolidate as much as
          possible." The dot's words moved up to the section, which is where the
          reader's question ("what is this screen") is asked. What stays on this
          line is what the SECTION cannot say: how many rows the filters left. */}
      <ConsoleToolbar>
      <ConsoleFilterRow
        count={shown.length}
        icon={<IconNavMasks />}
        word={t('unit.character', { count: shown.length })}
      >
          <Select
            ariaLabel={t('metadata.characters.work.aria')}
            value={work}
            onChange={setWork}
            filter={workOptions.length > 12}
            filterPlaceholder={t('metadata.characters.work.filter.placeholder')}
            options={workOptions}
          />
          <input
            className="tp-input w-auto"
            style={mobile ? { minWidth: 0, flex: '1 1 8em' } : undefined}
            placeholder={t('metadata.search.placeholder')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {/* The same button as the people console's, and the same sweep — a
              character in no work is the other half of what it clears. */}
          <PruneButton onDone={load} />
      </ConsoleFilterRow>
      {/* THE ISSUE PILLS, AND THE SENTENCE THEY REPLACED. Under the line above,
          this screen printed "189 characters, 0 in no work" — and the line above
          it already said "189 SHOWN". The owner: "189 characters is written
          twice." It was, and the second copy was carrying one extra fact in
          prose. That fact is a pill now, with two more beside it, and every one
          of them is pressable — which the sentence never was. */}
      {list && (
        <IssuePills
          value={issue}
          onChange={setIssue}
          options={issueOptions(CHARACTER_ISSUES, base)}
          ariaLabel={t('metadata.issue.aria')}
        />
      )}
      </ConsoleToolbar>
      <ErrorText>{err}</ErrorText>
      {!list ? (
        <EmptyState>{t('common.state.loading')}</EmptyState>
      ) : shown.length === 0 ? (
        <EmptyState>{t('metadata.characters.empty')}</EmptyState>
      ) : (
        /* See CatalogueConsole: the page scrolls, not this list. */
        <div className="ann-table-wrap" style={{ minWidth: 0 }}>
          {/* A LIST OF RECORDS, NOT A TABLE. It was `ann-table` with four columns —
              name, works, sort name, a pencil — and the columns were doing less
              work than they cost: two of them held one value each and the fourth
              held a button. The v3 pack draws every console as rows, and the row
              is `recordRow.jsx`, which the works console already uses. That is
              also what closes the defect the decision log names: the person
              console's portrait opened an editor while this one's opened nothing,
              because they were two hand-rolled rows rather than one function. */}
          <div>
            {shown.map((c, i) => (
              <CharacterRow
                key={c.id}
                c={c}
                first={i === 0}
                onOpen={() => stack.open(characterPanel(stack, { id: c.id, name: c.name }))}
                onMerge={() => setMerging(c)}
                onDelete={() => remove(c)}
                /* THE SAME TWO DOORS THE PERSON ROW OPENS, which is the point of
                   the pair being one shape: a work pill goes to that work's
                   details, a performer pill goes to that person's record. */
                onWork={(w) => stack.open(workDetailsPanel(stack, {
                  kind: w.kind,
                  item: { id: w.id, title: w.title },
                  onGoToWork: onOpenWork ? () => onOpenWork(w) : null,
                }))}
                onPerson={(a) => stack.open(personPanel(stack, { id: a.id, name: a.name }))}
              />
            ))}
          </div>
        </div>
      )}
      {/* The counts on this list follow whatever the panel changed, so it reloads
          when the stack empties rather than on every save inside it. */}
      {merging ? (
        <MergeSheet
          into={merging}
          table="characters"
          onClose={() => setMerging(null)}
          onMerged={() => { setMerging(null); load() }}
          onError={setErr}
        />
      ) : null}
      {confirmDialog}
      <PanelHost stack={stack} />
      <PanelReload stack={stack} onEmpty={load} />
    </section>
  )
}

// PanelReload — reload the list when the panel stack empties.
//
// A COMPONENT RATHER THAN AN EFFECT IN THE CONSOLE, so the dependency is the
// stack's depth and nothing else. Reloading on every save inside the panel would
// re-sort the table under a reader who is still editing; reloading when they come
// back out is when the list is next looked at.
function PanelReload({ stack, onEmpty }) {
  const depth = stack.stack.length
  const was = useRef(0)
  useEffect(() => {
    if (was.current > 0 && depth === 0) onEmpty()
    was.current = depth
  }, [depth, onEmpty])
  return null
}

// ---- people console ----

// nearDupGroups MOVED TO `nearDupes.js` when the tags console needed the same
// answer about a vocabulary that this one needs about records. See that file: a
// thing two screens do lives in one function both call. It clusters names that
// look like one name spelled twice — equal once normalised, or within a small
// edit distance capped as a fraction of length so "Poe" and "Roe" stay two
// people.

// DupCard offers to merge one near-duplicate cluster: pick the record to keep,
// and every other in the group is MERGED into it (POST /people/merge).
//
// IT USED TO RENAME (POST /people/rename), and the difference is what the reader
// sees on their shelves afterwards. A rename rewrites the spelling on every work
// in the library: pick "Ursula K. Le Guin" and forty covers that print "Ursula
// LeGuin" stop saying so. A merge says the two records are one person and leaves
// every work printing exactly what it printed — the same promise a book's cover
// gets — while the person panel gathers all of it under one record.
//
// AND IT IS UNDOABLE. A merge parks a reversal in the bin; a rename is a
// rewrite of four hundred strings with nothing to press. That is the stronger
// reason of the two.
//
// THE RENAME ENDPOINT STAYS AND IS STILL RIGHT for what it is for — correcting a
// misspelling everywhere, which is a statement about the spelling rather than
// about identity. The person panel is where a reader asks for that.
function DupCard({ group, onMerged }) {
  // The likeliest keeper: the one with a portrait, then the one carrying more of
  // the library. A reader can override it — that is what the radios are for — and
  // the default matters because most of these are accepted as offered.
  const def = [...group].sort((a, b) =>
    (b.image_path ? 1 : 0) - (a.image_path ? 1 : 0) || (b.works || 0) - (a.works || 0) || b.name.length - a.name.length)[0]
  const [keep, setKeep] = useState(def.id)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const keeper = group.find((p) => p.id === keep) || def

  // ONE ENDPOINT NOW, WHERE THERE WERE TWO. The card used to fall back to
  // POST /people/rename for a spelling with no record behind it, because the list
  // was keyed by printed name and a pre-upgrade library could hold one the server
  // had not resolved. This list is keyed by record, so every row in a group IS a
  // record and there is nothing left for the fallback to catch — a rename here
  // would have rewritten a name across the library where a merge folds two
  // records and leaves every cover printing what it prints.
  async function merge() {
    setBusy(true)
    setErr('')
    for (const p of group) {
      if (p.id === keep) continue
      const r = await json('POST', '/people/merge', { keep_id: keep, drop_id: p.id })
      if (!r.ok) { setBusy(false); return setErr(errText(r, t('error.merge.failed'))) }
    }
    setBusy(false)
    onMerged()
  }

  return (
    <HandCard variant={2} style={{ padding: '12px 14px' }}>
      <MonoLabel>{t('metadata.people.dup.title')}</MonoLabel>
      <div className="mt-1.5 flex flex-col gap-1">
        {group.map((p) => (
          <label key={p.id} className="flex items-center gap-2" style={{ cursor: 'pointer' }}>
            <input type="radio" name={`dup-${group.map((x) => x.id).join('-')}`} checked={keep === p.id} onChange={() => setKeep(p.id)} />
            <Face src={p.image_path} url={personImgURL} fallback={null} name={p.name || ''} className="person-dup-face" />
            <span>{p.name}</span>
            {/* HOW MUCH HANGS OFF EACH, because that is what the choice is about:
                folding the record with 12 books into the one with none loses
                nothing, and the reader cannot tell which is which from the name. */}
            <span className="mono-label" style={{ color: 'var(--soft)' }}>
              {'· '}
              <Tally n={p.works || 0} word={t('unit.work', { count: p.works || 0 })} icon={<IconNavLibrary />} />
            </span>
          </label>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-3">
        {/* Same glyph and the same keepLabel as the book merge above: one act,
            two consoles. */}
        <GhostButton type="button" icon={<IconMerge />} keepLabel disabled={busy} onClick={merge}>
          {busy ? t('metadata.people.merge.busy') : t('metadata.people.merge.label', { name: keeper.name })}
        </GhostButton>
        <ErrorText>{err}</ErrorText>
      </div>
    </HandCard>
  )
}

// PEOPLE_ROLES — the chips, as [stored role, the key that names it]. Keys rather
// than words, because the words are resolved at render — see GAP_KEYS.
//
// ALL LEADS, and it is not decoration. A record's roles are DERIVED from its
// credits, so a record the reader made by hand, or one whose last credit was
// deleted, belongs to no role at all — and those are exactly the rows a review
// list exists to surface. Defaulting to Authors hid them.
//
// Studios are their own chip, not folded in with directors, because the two share
// movies.director and are told apart only by media_type — listing them together
// would offer a studio for renaming as a director, which rewrites the wrong half
// of the catalogue.
//
// PUBLISHERS ARE THEIR OWN CHIP FOR THE OPPOSITE REASON: movies.publisher is a
// column of its own, so there is nothing to tell apart. It is a separate row
// because it is a separate question — who made this, and who put it out — and a
// game credits both.
const PEOPLE_ROLES = [
  ['all', 'metadata.people.kind.all.label'],
  ['author', 'metadata.people.kind.author.label'],
  ['actor', 'metadata.people.kind.actor.label'],
  ['director', 'metadata.people.kind.director.label'],
  ['studio', 'metadata.people.kind.studio.label'],
  ['publisher', 'metadata.people.kind.publisher.label'],
  ['speaker', 'metadata.people.kind.speaker.label'],
]

// THE ROLE AS A GLYPH, because the words are three of the longest in this app's
// vocabulary. "author · translator · editor" wraps to three lines in a narrow
// column, which is what made a list of people look raggedly spaced — some rows one
// line tall and some three.
//
// THE GLYPH STANDS ALONE HERE, WHICH IS THE TIGHT HALF OF THE COUNT RULE. This
// comment said the opposite for two commits — that the word is printed beside the
// drawing and so needs no tooltip, and that the glyph-only form "is not built yet"
// — while `PersonRow` below rendered precisely the glyph-only form, wrapped in a
// `Tooltip` and carrying the role word as its `aria-label`. Every clause of it was
// false about the only site that uses this map.
//
// The row earns the tight half: it already carries two counts, a row of provider
// marks and a strip of work pills, which is the rule's own test for where the word
// goes. The owner said where the legend lives instead — "The icon will be explained
// in the person popup" — so a reader meets the drawing beside its word on the
// panel, and meets it alone on the row once they have.
//
// THE NOUN IS NEVER DROPPED, ONLY UNDRAWN. It is the mark's accessible name and its
// tooltip, which is the half of the count rule that does not move: a glyph alone is
// a picture to a screen reader and nothing at all.
//
// One rendering, both viewports. A cell drawn as words on a desk and as glyphs on
// a phone is two cells to keep in step, and the desk wants the width just as much.
const PEOPLE_ROLE_ICON = {
  // EIGHT ROLES, EIGHT DRAWINGS, and it was four drawings for eight roles until the
  // owner chose this set themselves. An author wore the shelf of books that also
  // means the Library tab, a director wore the reel that also means the catalogue,
  // and studio and publisher wore the SAME company mark — so the one column whose
  // job is telling roles apart was answering three of them with one picture. The
  // words underneath were doing all the work, which is what a glyph column is for
  // not doing. Each glyph's provenance is on its export in ui.jsx.
  author: IconRoleAuthor, // a fountain pen
  actor: IconRoleActor, // the theatre masks
  director: IconRoleDirector, // a clapper board
  studio: IconRoleStudio, // a studio light
  publisher: IconRolePublisher, // a newspaper — what they put out
  speaker: IconRoleSpeaker, // a microphone
  translator: IconRoleTranslator, // two scripts and the arrows between them
  editor: IconHighlight, // the app's own marker, which the owner kept
}

// The countable noun a role is named by, one per row. Shared nouns, because a
// director is a director wherever the app counts them.
const PEOPLE_ROLE_NOUN = {
  author: 'unit.author',
  actor: 'unit.actor',
  director: 'unit.director',
  studio: 'unit.studio',
  publisher: 'unit.publisher',
  speaker: 'unit.speaker',
  translator: 'unit.translator',
  editor: 'unit.editor',
}

// What an empty list says, per kind. Same missing fifth row as above: a studio
// list with nothing in it used to draw an empty state with nothing in it.
const PEOPLE_EMPTY = {
  author: 'metadata.people.empty.author',
  actor: 'metadata.people.empty.actor',
  director: 'metadata.people.empty.director',
  studio: 'metadata.people.empty.studio',
  publisher: 'metadata.people.empty.publisher',
  speaker: 'metadata.people.empty.speaker',
}

// PeopleConsole — every person RECORD in the library, with the works and the
// quotes hanging off each.
//
// KEYED BY RECORD, WHICH IT WAS NOT. It listed `/people/names`: one row per
// printed spelling, filtered to one role. That answers "which names does my
// library print", which is the right question for a re-verify sweep and the wrong
// one for a review list — Bulgakov spelled four ways was four rows of a quarter
// each, and a record no work prints was not in the list at all. The list beside it
// has been record-keyed since characters got a table, and two lists under one
// heading keyed differently is the thing a reader notices first.
//
// SO THE COUNTS ARE NOW TRUE. `works` is credits plus cast appearances and
// `quotes` is the two link columns, both per record — a merged Bulgakov reads 12
// and 128 here where the spelling list showed four rows of three books each.
//
// AND THE NAME OPENS THE RECORD. It used to open the enrichment modal, which edits
// a bio and a portrait under a (kind, name) pair; the record panel — the credits,
// the roles this person has played, the spellings that find them, the merge and
// the split — was not reachable from this screen at all. It is the name's
// destination now, and the modal keeps the portrait, reached from the row's own
// face.
export function PeopleConsole({ onFlash, onReverify, onSearch, onOpenWork = null, records = null, onReload = null, arriveFetching = false, onArrived = null }) {
  const mobile = useIsMobileScreen()
  const [role, setRole] = useState('all')
  // WHICH ISSUE — see PERSON_ISSUES. '' is every row.
  const [issue, setIssue] = useState('')
  const [own, setOwn] = useState(null)
  const [q, setQ] = useState('')
  useScreenSearch({ key: 'metadata-people', label: t('shell.search.where.people'), onQuery: setQ })
  const [busyID, setBusyID] = useState(0)
  const [bulk, setBulk] = useState(null) // {done, total} while bulk-fetching
  const [err, setErr] = useState('')
  // {kind, name} captured at click time, for the portrait editor.
  const [face, setFace] = useState(null) // the portrait being shown full screen
  const stack = usePanelStack()
  const { ask, confirmDialog } = useConfirm()

  // HANDED IN OR FETCHED, decided by the caller — the same arrangement the
  // character console has and for the same reason: the metadata page prints this
  // list's size on the rail beside its door, and a list read twice is two numbers
  // that can disagree.
  const owned = !onReload
  const load = useCallback(async () => {
    if (!owned) return onReload()
    const r = await json('GET', '/people/records')
    if (r.ok) setOwn(r.data.people || [])
    else setErr(errText(r))
  }, [owned, onReload])
  useEffect(() => {
    if (owned) load()
  }, [owned, load])
  const rows = owned ? own : records

  // DELETE GOES TO THE BIN — the same promise the character console's row-level
  // delete makes, and for the same reason it can be offered at all:
  // `handleDeletePerson` calls `binRecord` before the row goes, so the confirm can
  // say there is a way back instead of asking the reader to be sure.
  //
  // AND IT IS ONLY OFFERED WHERE IT WOULD SUCCEED, which the character console did
  // not have to think about and this one does. `DELETE /characters/{id}` always
  // goes through; `DeletePersonRecord` REFUSES a record still credited on a work,
  // with a 409 naming the count. The first cut copied the character row verbatim,
  // so on a real library — mostly credited authors — the glyph was a dead press
  // ending in an error banner, under a confirm that had just promised the bin. The
  // row carries `credits` now, spelled by the server exactly as the refusal spells
  // it, and `canRemove` is that and nothing inferred.
  //
  // WHAT IT DOES NOT TAKE is worth the confirm's second sentence. A person is a
  // record ABOUT a credit, not the credit itself: the cast rows on their films
  // survive and keep naming them, and what is lost is the photo, the bio, the
  // dates and the links. A reader who reads "delete" as "unwrite them from twelve
  // works" will not press it, and one who presses it expecting that gets a
  // surprise the bin cannot undo the shape of.
  const remove = async (p) => {
    if (!(await ask(t('metadata.people.delete.confirm.title', { name: p.name }), {
      body: t('metadata.people.delete.confirm.body'),
      confirmLabel: t('common.action.delete.label'),
      danger: true,
      reversible: true,
    }))) return
    const r = await json('DELETE', `/people/${p.id}`)
    // THE 409 IS STILL HANDLED THOUGH THE GLYPH IS GATED, because the gate is a
    // number read when the list loaded: a credit added in another tab between the
    // load and the press makes a refusal the row could not have predicted. The
    // server's own words say how many works, which is the thing to act on.
    if (!r.ok) return setErr(errText(r))
    toast(t('metadata.people.delete.done', { name: p.name }))
    load()
  }

  const inRole = (p) => role === 'all' || (p.kinds || []).includes(role)
  // ROLE AND SEARCH FIRST, THE ISSUE PILL LAST — see CharactersConsole: the pills
  // count over `base`, so a pill's number is what pressing it will actually give.
  const base = useMemo(() => {
    const term = q.trim().toLowerCase()
    return (rows || []).filter(inRole).filter((p) => {
      if (!term) return true
      // THE SPELLINGS ARE SEARCHED TOO, which is the point of storing them: a
      // reader looking for "M. Bulgakov" is looking for the record that answers to
      // it, and a search that only reads the canonical name would tell them it is
      // not there.
      return p.name.toLowerCase().includes(term) || (p.spellings || []).some((sp) => sp.toLowerCase().includes(term))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, q, role])
  const shown = useMemo(() => base.filter(issueTest(PERSON_ISSUES, issue)), [base, issue])

  // WHAT THE BULK FETCH WOULD REACH: a row with no provider links OR no stored
  // portrait, which is exactly the two pills a fetch can do something about. Read
  // off PERSON_ISSUES rather than re-tested here, so the button and the pills
  // cannot come to disagree about what "still needs work" means.
  const fetchable = (p) => issueTest(PERSON_ISSUES, 'no_links')(p) || issueTest(PERSON_ISSUES, 'no_photo')(p)
  const missing = shown.filter(fetchable)

  // Near-duplicate clusters over RECORDS, not spellings. The old list computed
  // them over printed names, so two spellings of one record looked like two people
  // and the card offered to merge something into itself for ever; the guard that
  // dropped those groups is unnecessary now, because a record IS the identity the
  // comparison is about.
  const dupGroups = useMemo(() => {
    const byName = {}
    for (const p of rows || []) byName[p.name] = byName[p.name] || p
    const names = Object.keys(byName)
    return nearDupGroups(names)
      .map((g) => g.map((n) => byName[n]).filter(Boolean))
      .filter((g) => g.length >= 2)
  }, [rows])

  // fetchOne resolves the RIGHT person (book/credits disambiguation), fetches
  // their portrait and pins the identity via POST /people/portrait, then merges
  // the identity-resolved links into the row (bio/born untouched). Returns an
  // error string or null, like the form handlers do.
  //
  // IT STILL SPEAKS THE (kind, name) LANGUAGE, because the portrait ladder does:
  // an author is resolved from their books and an actor from a film's credits, and
  // the record's own roles are what say which. The first role is used, defaulting
  // to author for a record that carries none — which is most of them, since a role
  // is derived from a credit and an unreferenced record has no credit.
  async function fetchOne(p) {
    const kind = (p.kinds || [])[0] || 'author'
    const r = await json('POST', '/people/portrait', { kind, name: p.name })
    if (!r.ok) return errText(r)
    const cur = r.data.person && r.data.person.id ? r.data.person : null
    let linksMap = r.data.links && Object.keys(r.data.links).length ? r.data.links : null
    if (!linksMap) {
      const l = await json('POST', '/people/lookup', { kind, name: p.name })
      if (l.ok) linksMap = l.data.links
    }
    const merged = mergeLinks(cur?.links ?? p.links, linksMap)
    if (merged && merged !== (cur?.links ?? p.links ?? '')) {
      // THE RECORD, BY ID. The old console wrote through PUT /people, which upserts
      // by (kind, name) and lands on the LOWEST id where two records share a name —
      // so fetching links for the second of two namesakes wrote them onto the
      // first. The record endpoint cannot make that mistake.
      const save = await json('PUT', `/people/id/${p.id}`, { links: merged })
      if (!save.ok) return errText(save)
    }
    return null
  }

  async function fetchRow(p) {
    setBusyID(p.id)
    setErr('')
    const e = await fetchOne(p)
    setBusyID(0)
    if (e) setErr(t('metadata.people.row.error', { name: p.name, error: e }))
    load()
  }

  async function fetchMissing() {
    setErr('')
    setBulk({ done: 0, total: missing.length })
    let done = 0
    let failed = 0
    let firstErr = ''
    await runPooled(missing, 2, async (p) => {
      const e = await fetchOne(p)
      if (e) {
        failed++
        if (!firstErr) firstErr = e
      }
      done++
      setBulk({ done, total: missing.length })
    })
    setBulk(null)
    // The joining space is CODE, not the head of a value: the parser trims both
    // halves of a line, so a value that starts with a space loses it.
    onFlash(
      t('metadata.people.fetch.flash', { ok: done - failed, failed }) +
        (firstErr ? ' ' + t('metadata.people.fetch.flash.reason', { error: firstErr }) : ''),
    )
    load()
  }

  // ARRIVED WITH A FETCH ALREADY ASKED FOR, from the phone index's People verb.
  //
  // IT WAITS FOR THE ROWS. `missing` is derived from the rows this console has
  // loaded and filtered, so firing on mount would run over an empty list and
  // report "0 fetched" about a library full of gaps — the shape of bug where the
  // screen is right and the answer is wrong. `rows` is null until the read lands.
  //
  // AND IT CLEARS THE INTENT EVEN WHEN THERE IS NOTHING TO FETCH, because the
  // press was answered either way and a held intent would fire on the next visit.
  const fetching = useRef(false)
  useEffect(() => {
    if (!arriveFetching || fetching.current || !rows) return
    fetching.current = true
    onArrived?.()
    if (missing.length > 0) fetchMissing()
  }, [arriveFetching, rows, missing.length])

  return (
    <section className="space-y-3">
      {confirmDialog}
      {/* THE SECTION IS THE HEADING — see CharactersConsole. */}
      <ConsoleToolbar>
      <ConsoleFilterRow
        count={shown.length}
        icon={<IconNavUsers />}
        word={t('unit.person', { count: shown.length })}
      >
          {/* ALL FIRST, because a record's roles are DERIVED from its credits and a
              record with none — one the reader made, or one whose last credit went
              — belongs to no chip. Filtering to a role by default hid exactly the
              rows this list exists to surface. */}
          {/* SIX CHIPS WRAP TO THREE LINES AT 390px, above a table that is already
              the densest thing on the screen. A field states the role you are
              filtered to and opens the rest — the same call the section rail
              makes one level up, and for the same reason. */}
          {mobile ? (
            <Select
              ariaLabel={t('metadata.people.column.roles')}
              value={role}
              onChange={setRole}
              options={PEOPLE_ROLES.map(([k, label]) => [k, t(label)])}
            />
          ) : (
            PEOPLE_ROLES.map(([k, label]) => (
              <button key={k} className={'tp-filter-chip' + (role === k ? ' active' : '')} onClick={() => setRole(k)}>
                {t(label)}
              </button>
            ))
          )}
          {/* AND NOT ON A PHONE, WHERE IT IS THE SECOND COPY OF ITSELF. The shell's
              own field already drives this console's `q` — `useScreenSearch` above
              publishes the same setter — so on a screen with room for both, a
              reader uses whichever is nearer and they cannot disagree. On 390 there
              is no room for both: with the field in, the row still ran 221px past
              its edge after the verbs came off, and what was hidden was the verbs.
              A duplicate of a control one row up is the cheapest thing on the row
              to lose. */}
          {!mobile && (
            <input className="tp-input w-auto" placeholder={t('metadata.search.placeholder')} value={q} onChange={(e) => setQ(e.target.value)} />
          )}
          {/* IconMetadata, the same arrow-landing-in-a-record the covers console
              uses: this fills fields on rows that already exist, which is what
              that drawing says and what tells it apart from IconExport. */}
          <IconButton
            icon={<IconMetadata />}
            /* Same shape as Prune beside it: the number is drawn, the word is in
               the name a hold or a hover answers with. */
            label={missing.length > 0 ? String(missing.length) : ''}
            keepLabel
            disabled={!!bulk || missing.length === 0}
            onClick={fetchMissing}
            ariaLabel={missing.length > 0
              ? t('metadata.people.fetch.count.label', { n: missing.length })
              : t('metadata.people.fetch.label')}
          />
          {onReverify && (
            /* IconFetch, matching the re-verify button on the works bulk bar
               above — the same act against a different kind of row. */
            <IconButton
              icon={<IconFetch />}
              disabled={!!bulk || shown.length === 0}
              ariaLabel={t('metadata.people.reverify.label')}
              tooltip={t('metadata.people.reverify.tip')}
              onClick={() => onReverify(shown.map((p) => ({ kind: (p.kinds || [])[0] || 'author', name: p.name })))}
            />
          )}
          <PruneButton onDone={load} onFlash={onFlash} />
      </ConsoleFilterRow>
      {/* THE FOUR ISSUES, AS PILLS. The owner named them: "Relevant issues for
          people: no links, no works, no quotes, no photos."

          THEY REPLACE A SENTENCE THAT COULD NOT BE PRESSED. This line read "11
          people still need photos or links" — one number over two problems, with
          no way to reach either — and "all complete ✓" when there were none. Four
          counted pills say which of the two, say the other two nobody was
          counting, and each of them is a press. The finished state still reads:
          four zeroes in a row is a clearer "nothing to do" than a tick, because it
          says what was checked. */}
      {rows && (
        <IssuePills
          value={issue}
          onChange={setIssue}
          options={issueOptions(PERSON_ISSUES, base)}
          ariaLabel={t('metadata.issue.aria')}
        />
      )}
      </ConsoleToolbar>
      <ErrorText>{err}</ErrorText>
      {bulk && <ProgressBar value={bulk.done} max={bulk.total} label={t('metadata.people.fetch.progress', { done: bulk.done, total: bulk.total })} />}
      {dupGroups.length > 0 && (
        <div className="space-y-2">
          <MonoLabel>{t('metadata.people.dups.count', { n: dupGroups.length })}</MonoLabel>
          {dupGroups.map((g, i) => (
            <DupCard key={i} group={g} onMerged={load} />
          ))}
        </div>
      )}
      {!rows ? (
        <EmptyState>{t('common.state.loading')}</EmptyState>
      ) : shown.length === 0 ? (
        <EmptyState>{t(role === 'all' ? 'metadata.people.empty.all' : PEOPLE_EMPTY[role])}</EmptyState>
      ) : (
        /* NO INNER VERTICAL SCROLLER, ON ANY SCREEN. A 60vh box inside a page
           that also scrolls is two scrolls under one hand, and on a desk it left
           most of the window empty under a list cut off at row five. The page
           scrolls and the toolbar above sticks — see `.console-toolbar`. */
        <div className="ann-table-wrap" style={{ minWidth: 0 }}>
          {/* THE COLUMN HEADS WENT WITH THE COLUMNS. A row states what its numbers
              are through their tooltips now, which is what a list of records does
              and what let the roles and the links stop being two columns that a
              phone had to drop. */}
          <div>
            {shown.map((p, i) => (
              <PersonRow
                key={p.id}
                first={i === 0}
                p={p}
                busy={busyID === p.id || !!bulk}
                onOpen={() => stack.open(personPanel(stack, { id: p.id, name: p.name }))}
                /* THE PICTURE, FULL SCREEN — not a second surface for the record.
                   The owner: "Clicking on it now brings on the person modal. That
                   needs to be completely retired. Only the person popup. Image
                   chip will show the image in full screen." So the chip does the
                   one thing a picture can do that a panel cannot, and the NAME is
                   the door to the record, which is the row's own row 1. */
                onPortrait={p.image_path ? () => setFace({ src: personImgURL(p.image_path), title: p.name }) : null}
                onSearch={onSearch}
                onFetch={() => fetchRow(p)}
                onDelete={(p.credits || 0) === 0 ? () => remove(p) : null}
                /* A PILL OPENS THE WORK'S DETAILS, with a way out to the work
                   itself in the panel's top bar — the owner's spec for this row.
                   The seed is what the pill already carries; WorkDetails loads
                   the rest for itself, which is why a title and an id are enough. */
                onWork={(w) => stack.open(workDetailsPanel(stack, {
                  kind: w.kind,
                  item: { id: w.id, title: w.title },
                  onGoToWork: onOpenWork ? () => onOpenWork(w) : null,
                }))}
              />
            ))}
          </div>
        </div>
      )}
      <PanelHost stack={stack} />
      <PanelReload stack={stack} onEmpty={load} />
      {/* ── THE PICTURE, AND NOTHING ELSE ──────────────────────────────────────
          A `PersonModal` stood here, opened by the row's portrait, and the owner
          retired it: "your person modal just crops up randomly instead of the
          panel, always when the panel already exists." It edited a bio and a
          photo under a (kind, name) pair while the panel edits the RECORD, so two
          surfaces disagreed about what a person is — and the modal was the one
          that could not merge, split, or show a credit.

          What is left is the one thing the panel does not do: show the photograph
          at the size a photograph is worth looking at. */}
      {face && <Lightbox src={face.src} title={face.title} onClose={() => setFace(null)} />}
    </section>
  )
}

// PersonRow — one record.
//
// THE FACE IS THE PORTRAIT EDITOR, exactly as a cast row's face is that role's
// picture editor. It was a word — "· photo" — beside the name, which says a
// portrait exists and shows neither it nor a way to change it; a list of ninety
// names is where a face is worth most, because it is the fastest thing in a row
// to recognise.
function PersonRow({ p, busy, onOpen, onPortrait, onSearch, onFetch, onDelete, onWork = null, first = false }) {
  const face = p.image_path ? personImgURL(p.image_path) : ''
  // A ROLE AS ITS GLYPH, with its word as the name — the tight half of the count
  // rule, since a chip or a row line has no room for the word.
  const roleMark = (k) => {
    const word = t(PEOPLE_ROLE_NOUN[k] || 'unit.person', { count: 1 })
    const Glyph = PEOPLE_ROLE_ICON[k]
    return Glyph
      ? <Tooltip key={k} label={word}><span className="row-role-mark" role="img" aria-label={word}><Glyph size={15} /></span></Tooltip>
      : <span key={k} className="row-role-word">{word}</span>
  }
  const onWorks = new Set((p.works_in || []).flatMap((w) => w.roles || []))
  const looseRoles = (p.kinds || []).filter((k) => !onWorks.has(k))
  const fetched = Object.keys(parseLinks(p.links).known).length > 0 || !!p.image_path
  const fetchLabel = busy
    ? t('metadata.people.row.fetch.busy')
    : fetched
      ? t('metadata.people.row.refetch.label')
      : t('metadata.people.row.fetch.label')
  // THE TOOLTIP IS A WORD AND THE NAME IS A SENTENCE, for the reason the works
  // console's three glyphs were rewritten: "fetch" on every row of a list of
  // people is one word repeated, and nothing outside a hover knows which person
  // it belongs to.
  const fetchName = busy
    /* THE BUSY BRANCH KEEPS THE NAME TOO, and the first cut dropped it — which is
       the one moment the name matters MOST: several rows fetch at once, so a
       reader hearing "fetching…" three times is back where they started. */
    ? t('metadata.people.row.fetch.busy.aria', { name: p.name })
    : fetched
      ? t('metadata.people.row.refetch.aria', { name: p.name })
      : t('metadata.people.row.fetch.aria', { name: p.name })
  // A LIST OF RECORDS, NOT A TABLE — the same move the character console made, and
  // the one that closes the defect the decision log names. The two consoles had
  // hand-rolled rows, which is how this one's portrait came to open an editor
  // while that one's opened nothing: the same picture in the same position doing
  // two different things. One function draws both now, and a difference between
  // them has to be passed IN.
  //
  // WHAT THE ROLE MARKS AND THE PROVIDER CHIPS BECAME. They were two columns; they
  // are chips on the row, which is what the pack draws and what lets the row wrap
  // on a phone instead of dropping them. The quotes count went with the columns —
  // it is one number the person's own record already states, and the name is the
  // door to it.
  return (
    <RecordRow
      first={first}
      className="record-row-lg"
      mark={
        <button
          type="button"
          // NO `is-empty` FROM THE PATH. Nothing reads it any more: the plate and
          // the colour are keyed on the stand-in itself, because a picture that
          // failed to arrive is a row with no picture and a class set from the
          // stored path cannot know that.
          className="person-face-btn"
          aria-label={t('metadata.people.portrait.aria', { name: p.name })}
          onClick={onPortrait}
        >
          <Face src={face} name={p.name} url={(x) => x} className="person-face-inner" />
        </button>
      }
      name={p.name}
      onOpen={onOpen}
      /* THE OTHER SPELLINGS, UNDER THE NAME. This is what one record standing for
         four rows looks like, and without it the merged list reads as if three
         names went missing. */
      /* THE SAME SUB-LINE THE CHARACTER ROW DRAWS, and that is the point: two
         lists of records, one shape — "similar things should act similarly" is a
         repo directive, and it applies to what a row SAYS as hard as to what it
         does. Counts, then the works themselves as pills.

         THE WORKS COUNT CAME OUT OF THE FAR-RIGHT COLUMN to get here. It was a
         number at the end of the row whose only tooltip said "works"; beside the
         quotes count and under the titles it is counting, it needs no tooltip at
         all. The search it opened is still a press away — the pills go to the
         works themselves, which is the more direct version of the same trip.

         THE SPELLINGS KEEP THEIR OWN LINE below, because they are not a count and
         folding them into a row of numbers is how a row starts talking. */
      /* ── THE OWNER'S TWO CONTENT LINES ──────────────────────────────────────
         Their spec, verbatim: "Row1: name (path to the person popup). Row2: work
         and quote counts (as is) • role (e.g. author) icons. Row3: provider icons
         • work pills with cover/poster, edgemasked."

         The name is the row's own (row 1). These are rows 2 and 3, and the split
         is the point: the counts and the ROLES answer "what is this person to my
         library", the providers and the WORKS answer "where did they come from
         and where do they appear". They were one run before, so a reader looking
         for either read both.

         THE ROLE IS A GLYPH ALONE HERE, which is the tight half of the count rule
         — this line already carries two counts and a row of marks, and the word
         is what a hover or a hold gives back. The chip with its word beside it is
         gone from the row; the person's own panel is where the legend lives, and
         the owner said so: "The icon will be explained in the person popup". */
      head={<>
        <RowCounts
          works={p.works || 0}
          quotes={p.quotes || 0}
          worksLabel={t('metadata.row.works.label')}
          quotesLabel={t('metadata.row.quotes.label')}
          /* WHAT PRESSING IT DOES, beside what the number is — see RowCounts. */
          worksTip={p.works > 0 && onSearch ? t('metadata.people.search.tip', { name: p.name }) : ''}
          onWorks={p.works > 0 && onSearch ? () => onSearch(p.name) : null}
        />
        {/* A ROLE NO WORK CARRIES STAYS ON THE NAME LINE — a speaker's quotes, a
            role saved on the record with no credit behind it — so moving the
            glyphs into the work chips cannot drop one. */}
        {looseRoles.length > 0 && (
          <span className="row-role-marks">{looseRoles.map(roleMark)}</span>
        )}
        <ProviderChips links={p.links} marks />
        {/* THE OTHER SPELLINGS RIDE THE NAME'S LINE, so the row stays two lines on
            a desk ("two rows only in desktop") — they are about the name. */}
        {(p.spellings || []).length > 0 && (
          <span className="cs-row-sub">{t('metadata.people.also', { names: p.spellings.join(' · ') })}</span>
        )}
      </>}
      /* ONE STRIP: EACH WORK WITH WHAT THIS PERSON DID ON IT. The owner: "same
         thing for the role-type-icons and work chip in people screen" — the role
         and the work are one chip, because a row of role glyphs beside a row of
         works could not say which book was written and which translated. */
      sub={<>
        <CreditPills
          items={(p.works_in || []).slice(0, MAX_ROW_WORK_PILLS).map((w) => ({
            work: w,
            lead: (w.roles || []).length > 0 && <span className="row-role-marks">{w.roles.map(roleMark)}</span>,
          }))}
          onOpen={onWork}
        />
      </>}
      chips={[]}
      chipsEmpty={null}
      /* THE SAME TWO-VERB TAIL THE CHARACTER ROW HAS, and the delete half is here
         because retiring the old modal took the app's only way to delete a person
         with it. `DELETE /people/{id}` had exactly one caller in the whole app and
         it was inside `PersonModal`; every credit in the app now opens the pack's
         panel instead, which edits every field and deletes nothing. So a record
         the reader could remove last release became one they could only prune in
         bulk, and only if it had no credits left.

         "similar things should act similarly" decides where it goes rather than
         what it is: the character console draws merge and delete at the end of its
         row, this list is the same list of the other table, and a delete that
         lives on one and not the other is the pair of consoles disagreeing about
         what a record row is. */
      actions={[
        {
          key: 'fetch',
          icon: <IconFetch />,
          /* ONE glyph for both words. `fetch` and `refetch` are the same act — go and
             get this person's photo and links — and the label flips only because the
             row already has some. Two drawings would say the acts differ. */
          ariaLabel: fetchName,
          tooltip: fetchLabel,
          onClick: onFetch,
        },
        // NOT DRAWN WHERE IT CANNOT WORK. `onDelete` is null for a person the
        // server would refuse, and a control the app knows is a dead press is not
        // a control — see the console's `remove`. Disabled rather than absent was
        // the other option and is worse here: a greyed glyph on most of a list of
        // authors reads as the app being broken, and the reason it is grey is a
        // rule about credits that no tooltip on a 34px square can teach.
        ...(onDelete ? [{
          key: 'delete',
          icon: <IconDelete />,
          danger: true,
          ariaLabel: t('metadata.people.action.delete.aria', { name: p.name }),
          onClick: onDelete,
        }] : []),
      ]}
    />
  )
}
