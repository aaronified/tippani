import { useEffect, useMemo, useRef, useState } from 'react'
import { json, errText } from './api.js'
import { t, tNodes } from './i18n.js'
import { BookLookupPicker, MovieLookupPicker } from './CoverPicker.jsx'
import { bookState, EditBook } from './Library.jsx'
import { EditMovie } from './Movies.jsx'
import { BulkBar, EmptyState, ErrorText, FieldIconButton, GhostButton, HandCard, IconButton, IconCheck, IconDelete, IconEdit, IconMerge, IconMetadata, IconMore, IconOpen, IconRefresh, IconSearch, IconUsers, InfoDot, MonoLabel, NameInput, NameScroll, normName, PageHeader, ProgressBar, Scroller, splitCommas, Tooltip, PanelHost, usePanelStack, useConfirm, useIsMobileScreen, useScreenBar } from './ui.jsx'
import { PersonModal, PersonName, ProviderChips, mergeLinks, parseCreditSeps, parseLinks, splitCredits } from './people.jsx'
import { characterPanel } from './identity.jsx'
import { ReverifyFlow } from './ReverifyReview.jsx'
import { editDistance } from './text.js'

// Metadata tab — a management console: coverage stats up top, then filterable
// books / films-shows lists with multi-select bulk actions (fill actors, delete,
// fetch missing covers) plus per-row review-each look-up, and a per-title speaker
// remap tool. The point of the tab is doing metadata at scale, not one at a time.
export default function MetadataPage({ user, onOpenBook, onOpenMovie, onSearch }) {
  const [lib, setLib] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState('')
  // Force-fetch & re-verify (ROADMAP §2): {book_ids, movie_ids, people} or null.
  const [reverify, setReverify] = useState(null)

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
    actions: () => (user?.is_admin
      ? [
          { id: 'h-do', heading: t('common.mono.actions.label') },
          { id: 'fetch', icon: <IconMetadata />, label: t('metadata.fetch.label'), onClick: () => fetchMissingCovers(false) },
        ]
      : []),
  })
  return (
    <section className="space-y-6">
      <div className={mobile ? 'mobile-sticky-bar' : ''}>
        {/* The tab's own name for the title, not a second copy of the word. */}
        <PageHeader
          title={t('nav.tab.metadata.label')}
          counts={mobile ? t('metadata.counts.mobile') : t('metadata.counts.desktop')}
          right={
            <>
              {mobile ? (
                <InfoDot
                  side="bottom"
                  title={t('metadata.mobile.info.title')}
                  text={t('metadata.mobile.info.body')}
                />
              ) : (
                user?.is_admin && (
                  <IconButton
                    icon={<IconMetadata />}
                    label={t('metadata.fetch.label')}
            ariaLabel={t('metadata.fetch.aria')}
                    tooltip={t('metadata.fetch.tip')}
                    tipSide="bottom"
                    onClick={() => fetchMissingCovers(false)}
                    disabled={busy}
                  />
                )
              )}
            </>
          }
      />
      </div>
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
      {!lib ? (
        <EmptyState>{t('common.state.loading')}</EmptyState>
      ) : mobile ? (
        // Mobile (§5): a maintenance screen, not the at-scale console. Just the
        // handful of one-tap actions; the big filterable lists are desktop-only,
        // and the coverage tiles collapse into plain text lines at the bottom.
        <>
          {user?.is_admin && (
            <MobileAction
              title={t('metadata.mobile.fetch.title')}
              desc={t('metadata.mobile.fetch.desc')}
              actionLabel={t('metadata.fetch.label')}
              icon={<IconMetadata />}
              busy={busy}
              onClick={() => fetchMissingCovers(true)}
            />
          )}
          <MobileAction
            title={t('metadata.mobile.reverify.title')}
            desc={t('metadata.mobile.reverify.desc')}
            actionLabel={t('metadata.reverify.label')}
            icon={<IconCheck />}
            busy={!!reverify}
            onClick={() =>
              setReverify({
                book_ids: lib.books.filter((b) => b.has_ids).map((b) => b.id),
                movie_ids: lib.movies.filter((m) => m.has_source).map((m) => m.id),
                people: [],
              })
            }
          />
          <DuplicatesPanel onDone={load} onFlash={setFlash} />
          <SpeakerRemap movies={lib.movies.filter((m) => m.dialogue_count > 0)} onDone={load} user={user} />
          <PeopleConsole onFlash={setFlash} compact />
          {/* The same one-line summary the people console gives on a phone: a
              browsable table is not what a 390px column is for, and the count is
              the part that says whether the screen is worth opening later. */}
          <CharactersConsole compact />
          <StatsLines stats={stats} />
        </>
      ) : (
        <>
          {/* The type parameter is named `ty`, not the single letter it was: this
              file imports the resolver now, and a parameter of that one letter
              shadows it silently and legally. locale-shadow.test.js fails the
              build over it — including over a comment that spells the shape out,
              which is why this one does not. */}
          <StatsStrip stats={stats} onPick={(ty, f) => { setCatType(ty); setCatFilter(f) }} />
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
          <DuplicatesPanel onDone={load} onFlash={setFlash} />
          <PeopleConsole onFlash={setFlash} onReverify={(people) => setReverify({ people })} onSearch={onSearch} />
          {/* Beside the people list and never inside it — see CharactersConsole. */}
          <CharactersConsole />
          <SpeakerRemap movies={lib.movies.filter((m) => m.dialogue_count > 0)} onDone={load} user={user} />
        </>
      )}
      {reverify && (
        <ReverifyFlow
          selection={reverify}
          onClose={() => setReverify(null)}
          onFlash={setFlash}
          onDone={load}
        />
      )}
    </section>
  )
}

// MobileAction — a compact action card for the stripped-down mobile Metadata
// screen (§5): a title, a one-line what-it-does, and a single run button.
function MobileAction({ title, desc, actionLabel, icon, busy, onClick, disabled }) {
  // The fallback word is resolved HERE rather than defaulted in the signature: a
  // default parameter is the one remaining place a word would sit in the source.
  const label = actionLabel || t('metadata.mobile.run.label')
  return (
    <HandCard className="flex items-center gap-3 p-4">
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <h2 style={H2}>{title}</h2>
        {desc && <InfoDot title={title} text={desc} />}
      </div>
      <IconButton
          icon={busy ? <IconMore /> : icon || <IconMetadata />}
          ariaLabel={label}
          className="shrink-0"
          disabled={busy || disabled}
          onClick={onClick}
        tooltip={label}
      />
    </HandCard>
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
  total: 'metadata.coverage.total.label',
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
}
const gapLabel = (token) => t(GAP_KEYS[token])

// The gaps each half of the library can have, in the order they are drawn. The
// tiles, the filter dropdown and the coverage lines all walk these, and the token
// doubles as the name of its count on the stats object.
const BOOK_GAPS = ['no_cover', 'low_res', 'no_author', 'no_series', 'no_year', 'no_genre', 'no_source']
const MOVIE_GAPS = ['no_poster', 'low_res', 'no_cast', 'no_director', 'no_year', 'no_genre', 'no_source']

// StatsLines — the coverage tiles as plain text lines (§5, mobile): one line per
// group listing only the non-zero gaps, so "what still needs work" reads at a
// glance without the tap-to-filter tiles the mobile screen has no lists to feed.
function StatsLines({ stats }) {
  // tNodes, not a value with a <b> in it: markup never goes in a locale string,
  // so the sentence carries {group} and {gaps} and the call site hands over the
  // bold node.
  const line = (group, total, gaps) => {
    const parts = gaps
      .filter(([, n]) => n > 0)
      .map(([label, n]) => t('common.count.phrase', { n, noun: label }))
    return (
      <p className="microcopy" style={{ color: 'var(--soft)' }}>
        {tNodes('metadata.coverage.line', {
          group: (
            <b style={{ color: 'var(--ink)' }}>
              {t('metadata.coverage.group.count', { group, n: total })}
            </b>
          ),
          gaps: parts.length ? parts.join(' · ') : t('metadata.coverage.complete'),
        })}
      </p>
    )
  }
  const b = stats.books
  const m = stats.movies
  return (
    <div className="space-y-1.5 pt-1">
      <MonoLabel className="block">{t('metadata.coverage.title')}</MonoLabel>
      {line(t('metadata.coverage.group.books'), b.total, BOOK_GAPS.map((g) => [gapLabel(g), b[g]]))}
      {line(t('metadata.coverage.group.movies'), m.total, MOVIE_GAPS.map((g) => [gapLabel(g), m[g]]))}
      {line(t('metadata.coverage.group.dialogues'), stats.dialogues.total, [
        [gapLabel('no_actor'), stats.dialogues.missing_actor],
      ])}
    </div>
  )
}

const H2 = { fontFamily: 'var(--font-ui)', fontStyle: 'var(--font-ui-style)', fontVariantCaps: 'var(--font-ui-caps)', textTransform: 'var(--font-ui-case)', fontVariantNumeric: 'var(--font-ui-figures)', fontSize: 'var(--type-ui-17)', fontWeight: 600 }

// Stat is a coverage tile. When onClick is set it's a filter button: clicking a
// "missing X" tile filters the console below to exactly those rows.
function Stat({ n, label, warn, onClick }) {
  const bad = warn && n > 0
  const clickable = !!onClick && (n > 0 || !warn)
  return (
    <Tooltip label={clickable ? t('metadata.coverage.tile.tip', { label }) : null} side="bottom">
      <button
        type="button"
        onClick={clickable ? onClick : undefined}
        disabled={!clickable}
        style={{
          textAlign: 'left',
          background: 'var(--raised)',
          border: `1px solid ${bad ? 'color-mix(in srgb, var(--error) 40%, var(--line))' : 'var(--line)'}`,
          borderRadius: 9,
          padding: '8px 13px',
          minWidth: 74,
          cursor: clickable ? 'pointer' : 'default',
        }}
      >
        <div style={{ fontFamily: 'var(--font-mono)', fontStyle: 'var(--font-mono-style)', fontVariantCaps: 'var(--font-mono-caps)', textTransform: 'var(--font-mono-case)', fontVariantNumeric: 'var(--font-mono-figures)', fontSize: 'var(--type-mono-19)', fontWeight: 500, lineHeight: 1, color: bad ? 'var(--error)' : 'var(--ink)' }}>
          {n}
        </div>
        <div className="mono-label" style={{ marginTop: 4, color: bad ? 'var(--error)' : undefined }}>
          {label}
        </div>
      </button>
    </Tooltip>
  )
}

function StatsStrip({ stats, onPick }) {
  const group = (label, tiles) => (
    <div>
      <MonoLabel className="mb-2 block">{label}</MonoLabel>
      <div className="flex flex-wrap gap-2">{tiles}</div>
    </div>
  )
  const b = stats.books
  const m = stats.movies
  return (
    <HandCard className="p-5">
      <div className="flex flex-wrap gap-x-8 gap-y-4">
        {group(t('metadata.coverage.group.books'), [
          <Stat key="total" n={b.total} label={gapLabel('total')} onClick={() => onPick('book', 'all')} />,
          ...BOOK_GAPS.map((g) => (
            <Stat key={g} n={b[g]} label={gapLabel(g)} warn onClick={() => onPick('book', g)} />
          )),
        ])}
        {group(t('metadata.coverage.group.movies'), [
          <Stat key="total" n={m.total} label={gapLabel('total')} onClick={() => onPick('movie', 'all')} />,
          ...MOVIE_GAPS.map((g) => (
            <Stat key={g} n={m[g]} label={gapLabel(g)} warn onClick={() => onPick('movie', g)} />
          )),
        ])}
        {group(t('metadata.coverage.group.dialogues'), [
          <Stat key="total" n={stats.dialogues.total} label={gapLabel('total')} />,
          <Stat key="no_actor" n={stats.dialogues.missing_actor} label={gapLabel('no_actor')} warn />,
        ])}
      </div>
    </HandCard>
  )
}

function GapChips({ gaps }) {
  if (gaps.length === 0) return <span className="microcopy" style={{ color: 'var(--accent-ui)' }}>{t('metadata.row.complete')}</span>
  return (
    <span className="flex flex-wrap gap-1.5">
      {gaps.map((g) => (
        <span
          key={g}
          className="tp-chip"
          style={{ color: 'var(--error)', borderColor: 'color-mix(in srgb, var(--error) 40%, var(--line))' }}
        >
          {g}
        </span>
      ))}
    </span>
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
const BOOK_FILTERS = ['flagged', ...BOOK_GAPS, 'all']
const MOVIE_FILTERS = ['flagged', ...MOVIE_GAPS, 'all']
const ALL_FILTERS = ['flagged', 'low_res', 'no_year', 'no_genre', 'no_source', 'all']
function filtersForType(type) {
  if (type === 'book') return BOOK_FILTERS
  if (type === 'movie' || type === 'show') return MOVIE_FILTERS
  return ALL_FILTERS
}
const filterOptions = (type) => filtersForType(type).map((v) => [v, gapLabel(v)])
const catKey = (kind, id) => `${kind}:${id}`
function bookPasses(b, filter) {
  const p = {
    flagged: (b) => !b.has_cover || !b.has_ids, no_cover: (b) => !b.has_cover,
    low_res: (b) => b.low_res_cover, no_author: (b) => !b.has_author,
    no_series: (b) => !b.has_series, no_year: (b) => !b.has_year,
    no_genre: (b) => !b.has_genre, no_source: (b) => !b.has_ids,
  }[filter]
  return p ? p(b) : true
}
function moviePasses(m, filter) {
  const p = {
    flagged: (m) => !m.has_poster || !m.has_cast || !m.has_source, no_poster: (m) => !m.has_poster,
    low_res: (m) => m.low_res_poster, no_cast: (m) => !m.has_cast,
    no_director: (m) => !m.has_director, no_year: (m) => !m.has_year,
    no_genre: (m) => !m.has_genre, no_source: (m) => !m.has_source,
  }[filter]
  return p ? p(m) : true
}

// CatalogueConsole — one section (styled like the People console: no card,
// its own scroll box) listing books, films and shows together. The first
// dropdown picks the type and reshapes the second (filter) dropdown; rows render
// as BookRow / MovieRow by kind, and the bulk bar splits the (kind-namespaced)
// selection back into per-kind actions.
function CatalogueConsole({ books, movies, type, setType, filter, setFilter, onOpenBook, onOpenMovie, onDone, onFlash, onReverify }) {
  const { ask, confirmDialog } = useConfirm()
  const [q, setQ] = useState('')
  const [lookupKey, setLookupKey] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [editing, setEditing] = useState(false) // book bulk-edit form open
  const [sel, setSel] = useState(() => new Set()) // "book:id" / "movie:id" keys

  // Guard against a filter that isn't valid for the current type (e.g. after a
  // type switch) so the <select> and predicates always agree.
  const filterOpts = filterOptions(type)
  const filterVal = filterOpts.some(([v]) => v === filter) ? filter : 'flagged'

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase()
    const out = []
    if (type === 'all' || type === 'book') {
      for (const b of books) {
        if (!bookPasses(b, filterVal)) continue
        if (s && !(b.title.toLowerCase().includes(s) || (b.author || '').toLowerCase().includes(s))) continue
        out.push({ kind: 'book', item: b })
      }
    }
    if (type === 'all' || type === 'movie' || type === 'show') {
      for (const m of movies) {
        const mt = m.media_type || 'movie'
        if (type === 'movie' && mt !== 'movie') continue
        if (type === 'show' && mt !== 'show') continue
        if (!moviePasses(m, filterVal)) continue
        if (s && !m.title.toLowerCase().includes(s)) continue
        out.push({ kind: 'movie', item: m })
      }
    }
    return out
  }, [books, movies, type, filterVal, q])

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
    if (!(await ask(t('metadata.delete.confirm', { count: total, n: total })))) return
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
      <div className="flex flex-wrap items-center gap-2">
        <h2 style={H2}>{t('metadata.catalogue.title')}</h2>
        <MonoLabel>{t('metadata.shown.count', { n: shown.length })}</MonoLabel>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <select className="tp-input w-auto" title={t('common.field.media-type.label')} value={type} onChange={(e) => { setType(e.target.value); setFilter('flagged') }}>
            {typeOptions().map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <Tooltip label={t('metadata.catalogue.filter.tip')} side="top">
            <select className="tp-input w-auto" value={filterVal} onChange={(e) => setFilter(e.target.value)}>
              {filterOpts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Tooltip>
          <input className="tp-input w-auto" placeholder={t('metadata.search.placeholder')} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      {shown.length === 0 ? (
        <p className="microcopy">{t('metadata.catalogue.nomatch')}</p>
      ) : (
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
            <GhostButton icon={<IconRefresh />} disabled={busy} onClick={() => onReverify({ book_ids: selBookIds, movie_ids: selMovieIds })}>
              {t('metadata.reverify.open.label')}
            </GhostButton>
            <GhostButton icon={<IconDelete />} keepLabel disabled={busy} style={{ color: 'var(--error)' }} onClick={del}>
              {t('common.action.delete.label')}
            </GhostButton>
          </BulkBar>
          {editing && selBookIds.length > 0 && <BulkEditForm n={selBookIds.length} busy={busy} onApply={bulkEdit} />}
          <ErrorText>{err}</ErrorText>
          <Scroller className="ann-table-wrap" axis="both" style={{ maxHeight: 'min(30em, 60vh)', overflowY: 'auto' }}>
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
          </Scroller>
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
function ConsoleRowActions({ editing, onEdit, lookingUp, onLookup, onOpen, noun }) {
  return (
    <span className="flex items-center gap-1">
      <FieldIconButton
        icon={<IconEdit />}
        ariaLabel={editing ? t('metadata.row.edit.close.label') : t('common.action.edit.label')}
        aria-pressed={editing}
        onClick={onEdit}
        tooltip={editing ? t('metadata.row.edit.close.label') : t('common.action.edit.row.tip', { noun })}
        active={editing}
      />
      <FieldIconButton
        icon={<IconSearch />}
        ariaLabel={lookingUp ? t('metadata.row.lookup.close.label') : t('metadata.row.lookup.label')}
        aria-pressed={lookingUp}
        onClick={onLookup}
        tooltip={lookingUp ? t('metadata.row.lookup.close.label') : t('metadata.row.lookup.tip')}
        active={lookingUp}
      />
      {onOpen && (
        <FieldIconButton
          icon={<IconOpen />}
          ariaLabel={t('metadata.row.open.aria')}
          onClick={onOpen}
          tooltip={t('metadata.row.open.tip', { noun })}
        />
      )}
    </span>
  )
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

  return (
    <div style={{ borderTop: '1px solid var(--line)', padding: '10px 0' }}>
      <div className="flex flex-wrap items-center gap-3">
        <Tooltip label={t('metadata.row.select.tip', { noun })} side="top">
          <input type="checkbox" checked={checked} onChange={onCheck} />
        </Tooltip>
        <div className="min-w-0 flex-1">
          <NameScroll as="p">
            <b>{book.title}</b>
            {book.author && <span style={{ color: 'var(--soft)' }}> · {book.author}</span>}
            <span className="microcopy"> · {t('common.count.phrase', { n: book.annotation_count, noun: t('unit.quote', { count: book.annotation_count }) })}</span>
          </NameScroll>
          <GapChips gaps={gaps} />
        </div>
        <ConsoleRowActions
          editing={editing}
          onEdit={() => setEditing((v) => !v)}
          lookingUp={open}
          onLookup={onToggleLookup}
          onOpen={onOpen && (() => onOpen(book.id))}
          noun={noun}
        />
      </div>
      {editing && <InlineEdit kind="books" id={book.id} onDone={() => { setEditing(false); onDone() }} onCancel={() => setEditing(false)} />}
      {open && (
        <div className="mt-3">
          <BookLookupPicker title={book.title} isbn={book.isbn} asin={book.asin} onPick={apply} />
          <ErrorText>{err}</ErrorText>
        </div>
      )}
    </div>
  )
}

function MovieRow({ movie, checked, onCheck, open, onToggleLookup, onOpen, onDone }) {
  const [err, setErr] = useState('')
  const [editing, setEditing] = useState(false)
  const noun = t('unit.title', { count: 1 })
  const gaps = [!movie.has_poster && gapLabel('no_poster'), movie.low_res_poster && gapLabel('low_res_poster'), !movie.has_cast && gapLabel('no_cast'), !movie.has_source && gapLabel('no_source')].filter(Boolean)

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
    <div style={{ borderTop: '1px solid var(--line)', padding: '10px 0' }}>
      <div className="flex flex-wrap items-center gap-3">
        <Tooltip label={t('metadata.row.select.tip', { noun })} side="top">
          <input type="checkbox" checked={checked} onChange={onCheck} />
        </Tooltip>
        <div className="min-w-0 flex-1">
          <NameScroll as="p">
            <b>{movie.title}</b>
            {movie.release_year ? <span style={{ color: 'var(--soft)' }}> · {movie.release_year}</span> : null}
            {/* metadata.count.dialogues rather than the shared unit.dialogue: that
                noun now reads "film line", and this row has always counted
                "dialogues". Migrating keys is not the place to change a word. */}
            {movie.dialogue_count > 0 && (
              <span className="microcopy"> · {t('metadata.count.dialogues', { count: movie.dialogue_count, n: movie.dialogue_count })}</span>
            )}
          </NameScroll>
          <GapChips gaps={gaps} />
        </div>
        <ConsoleRowActions
          editing={editing}
          onEdit={() => setEditing((v) => !v)}
          lookingUp={open}
          onLookup={onToggleLookup}
          onOpen={onOpen && (() => onOpen(movie.id))}
          noun={noun}
        />
      </div>
      {editing && <InlineEdit kind="movies" id={movie.id} onDone={() => { setEditing(false); onDone() }} onCancel={() => setEditing(false)} />}
      {open && (
        <div className="mt-3">
          <MovieLookupPicker title={movie.title} year={movie.release_year} mediaType={movie.media_type || 'movie'} tmdbId={movie.tmdb_id} tvdbId={movie.tvdb_id} onPick={resync} />
          <ErrorText>{err}</ErrorText>
        </div>
      )}
    </div>
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
function DuplicatesPanel({ onDone, onFlash }) {
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

  async function merge(into, from) {
    // "book(s)" became a plural family, and the second half of the sentence has
    // to agree with it — hence a whole message per form, not a shared tail.
    if (!(await ask(t('metadata.duplicates.merge.confirm', { count: from.length, n: from.length })))) return
    setBusy(true)
    setErr('')
    const r = await json('POST', '/books/merge', { into, from })
    setBusy(false)
    if (!r.ok) return setErr(errText(r, t('error.merge.failed')))
    onFlash(t('metadata.duplicates.merge.flash', { count: r.data.merged, n: r.data.merged }))
    scan()
    onDone()
  }

  return (
    <HandCard className="space-y-3 p-5">
      {confirmDialog}
      <div className="flex flex-wrap items-center gap-2">
        <h2 style={H2}>{t('metadata.duplicates.title')}</h2>
        <InfoDot title={t('metadata.duplicates.title')} text={t('metadata.duplicates.info.body')} />
        {/* Was a JavaScript ternary picking between "group" and "groups", which is
            a plural rule written in the one place that cannot hold it. */}
        {groups && <MonoLabel>{t('metadata.duplicates.groups', { count: groups.length, n: groups.length })}</MonoLabel>}
        <IconButton
            icon={<IconSearch />}
            ariaLabel={open ? t('metadata.duplicates.rescan.aria') : t('metadata.duplicates.scan.label')}
            disabled={busy}
            onClick={scan}
          tooltip={open ? t('metadata.duplicates.rescan.tip') : t('metadata.duplicates.scan.label')} wrapClassName="ml-auto"
        />
      </div>
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
          onClick={() => onMerge(keep, group.filter((b) => b.id !== keep).map((b) => b.id))}
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

function SpeakerRemap({ movies, onDone, user }) {
  const [movieId, setMovieId] = useState('')
  const [cast, setCast] = useState([])
  const [labels, setLabels] = useState([])
  const [maps, setMaps] = useState({})
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')

  async function loadMovie(id) {
    setErr('')
    setMsg('')
    setMaps({})
    if (!id) {
      setCast([])
      setLabels([])
      return
    }
    const [mr, dr] = await Promise.all([json('GET', `/movies/${id}`), json('GET', `/dialogues?movie_id=${id}`)])
    setCast((mr.ok && mr.data.cast) || [])
    if (dr.ok) {
      setLabels(remapLabels(dr.data.dialogues, parseCreditSeps(user?.preferences?.creditSeparators)))
    }
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
    <HandCard className="space-y-3 p-5">
      <div className="flex items-center gap-1.5">
        <h2 style={H2}>{t('metadata.speakers.title')}</h2>
        <InfoDot title={t('metadata.speakers.title')} text={t('metadata.speakers.info.body')} />
      </div>
      <select className="tp-input w-auto" value={movieId} onChange={(e) => setMovieId(e.target.value)}>
        <option value="">{t('metadata.speakers.pick.placeholder')}</option>
        {movies.map((m) => (
          <option key={m.id} value={m.id}>
            {m.title}
            {m.release_year ? ` ${t('metadata.speakers.option.year', { year: m.release_year })}` : ''}
            {' · '}
            {t('metadata.count.dialogues', { count: m.dialogue_count, n: m.dialogue_count })}
          </option>
        ))}
      </select>

      {movieId && cast.length === 0 && (
        <p className="microcopy" style={{ color: 'var(--amber, var(--accent-ui))' }}>
          {t('metadata.speakers.nocast')}
        </p>
      )}
      {movieId && labels.length === 0 && <p className="microcopy">{t('metadata.speakers.nolabels')}</p>}
      {movieId && labels.length > 0 && (
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
          <ErrorText>{err}</ErrorText>
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
      <span className="microcopy">→</span>
      <select
        className="tp-input w-auto"
        value={sel}
        onChange={(e) => {
          const v = e.target.value
          if (v === '') onChange(undefined)
          else if (v === 'custom') onChange({ character: label.name, actor: '', custom: true })
          else {
            const i = Number(v.slice(5))
            onChange({ character: cast[i].character, actor: cast[i].actor })
          }
        }}
      >
        <option value="">{t('metadata.remap.keep.label')}</option>
        {cast.map((c, i) => {
          const character = c.character || t('metadata.remap.nocharacter.label')
          return (
            <option key={i} value={`cast:${i}`}>
              {c.actor ? t('metadata.remap.cast.option', { character, actor: c.actor }) : character}
            </option>
          )
        })}
        <option value="custom">{t('metadata.remap.custom.label')}</option>
      </select>
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

// ---- characters console ----

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
export function CharactersConsole({ compact = false }) {
  const [rows, setRows] = useState(null)
  const [q, setQ] = useState('')
  const [err, setErr] = useState('')
  // THE PANEL, NOT A FORM OF THIS SCREEN'S OWN. A character record is the same
  // thing whether you reach it from here or from a work's cast, and the app now
  // has one surface for a record — the three scopes, the aliases, and the
  // performer on each appearance. A second edit form here would have been the
  // second place those distinctions are drawn, and the first place they drift.
  const stack = usePanelStack()

  async function load() {
    const r = await json('GET', '/characters')
    if (r.ok) setRows(r.data.characters)
    else setErr(errText(r))
  }
  useEffect(() => {
    load()
  }, [])

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase()
    return (rows || []).filter((c) => !s || c.name.toLowerCase().includes(s))
  }, [rows, q])
  const unpaired = (rows || []).filter((c) => c.works === 0).length

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 style={H2}>{t('metadata.characters.title')}</h2>
        <InfoDot text={t('metadata.characters.info.body')} />
        {!compact && <MonoLabel>{t('metadata.shown.count', { n: shown.length })}</MonoLabel>}
        {!compact && (
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <input
              className="tp-input w-auto"
              placeholder={t('metadata.search.placeholder')}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        )}
      </div>
      <ErrorText>{err}</ErrorText>
      {compact ? (
        <p className="microcopy" style={{ color: 'var(--soft)' }}>
          {!rows
            ? t('common.state.loading')
            : t('metadata.characters.compact', { count: (rows || []).length, n: (rows || []).length, unpaired })}
        </p>
      ) : !rows ? (
        <EmptyState>{t('common.state.loading')}</EmptyState>
      ) : shown.length === 0 ? (
        <EmptyState>{t('metadata.characters.empty')}</EmptyState>
      ) : (
        <Scroller className="ann-table-wrap" axis="both" style={{ maxHeight: 'min(28em, 60vh)', overflowY: 'auto' }}>
          <table className="ann-table">
            <thead>
              <tr>
                <th>{t('common.field.name.label')}</th>
                <th>{t('metadata.characters.column.works')}</th>
                <th>{t('metadata.characters.column.sort')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {shown.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  {/* A count of zero is stated rather than left blank: blank reads
                      as "not loaded" and this is the row the list exists to surface. */}
                  <td className="mono-label" style={{ color: c.works === 0 ? 'var(--error)' : 'var(--soft)' }}>
                    {c.works}
                  </td>
                  <td className="microcopy" style={{ color: 'var(--soft)' }}>{c.sort_name || '—'}</td>
                  <td>
                    <Tooltip label={t('common.action.edit.label')}>
                      <FieldIconButton
                        icon={<IconEdit />}
                        ariaLabel={t('common.action.edit.label')}
                        onClick={() => stack.open(characterPanel(stack, { id: c.id, name: c.name }))}
                      />
                    </Tooltip>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Scroller>
      )}
      {/* The counts on this list follow whatever the panel changed, so it reloads
          when the stack empties rather than on every save inside it. */}
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

// nearDupGroups clusters names that look like the same person: equal once
// normalised, or within a small edit distance (capped as a fraction of length so
// short distinct names — "Poe" vs "Roe" — aren't flagged). Returns groups of 2+.
function nearDupGroups(names) {
  const norm = names.map(normName)
  const parent = names.map((_, i) => i)
  const find = (x) => {
    while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x] }
    return x
  }
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const a = norm[i], b = norm[j]
      if (!a || !b) continue
      const same = a === b || (() => { const d = editDistance(a, b); return d > 0 && d <= 2 && d / Math.max(a.length, b.length) <= 0.25 })()
      if (same) parent[find(i)] = find(j)
    }
  }
  const groups = {}
  names.forEach((n, i) => { const r = find(i); (groups[r] = groups[r] || []).push(n) })
  return Object.values(groups).filter((g) => g.length >= 2)
}

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
function DupCard({ group, kind, rowsByName, onMerged }) {
  const def = [...group].sort((a, b) =>
    (rowsByName[b]?.has_image ? 1 : 0) - (rowsByName[a]?.has_image ? 1 : 0) || b.length - a.length)[0]
  const [keep, setKeep] = useState(def)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function merge() {
    setBusy(true)
    setErr('')
    const keepID = rowsByName[keep]?.person_id
    for (const n of group) {
      if (n === keep) continue
      const dropID = rowsByName[n]?.person_id
      // A SPELLING WITH NO RECORD FALLS BACK TO THE RENAME, rather than being
      // skipped in silence. Every credited name has had a record since the
      // identity model landed, so this is the pre-upgrade library and the odd row
      // the server could not resolve — and for those the old behaviour is still
      // the only one available.
      const r = keepID && dropID && keepID !== dropID
        ? await json('POST', '/people/merge', { keep_id: keepID, drop_id: dropID })
        : await json('POST', '/people/rename', { kind, from: n, to: keep })
      if (!r.ok) { setBusy(false); return setErr(errText(r, t('error.merge.failed'))) }
    }
    setBusy(false)
    onMerged()
  }

  return (
    <HandCard variant={2} style={{ padding: '12px 14px' }}>
      <MonoLabel>{t('metadata.people.dup.title')}</MonoLabel>
      <div className="mt-1.5 flex flex-col gap-1">
        {group.map((n) => (
          <label key={n} className="flex items-center gap-2" style={{ cursor: 'pointer' }}>
            <input type="radio" name={`dup-${kind}-${group.join('|')}`} checked={keep === n} onChange={() => setKeep(n)} />
            <span>{n}</span>
            {rowsByName[n]?.has_image && <span className="mono-label" style={{ color: 'var(--soft)' }}>· {t('metadata.people.photo.label')}</span>}
          </label>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-3">
        {/* Same glyph and the same keepLabel as the book merge above: one act,
            two consoles, and it rewrites names across the library either way. */}
        <GhostButton type="button" icon={<IconMerge />} keepLabel disabled={busy} onClick={merge}>
          {busy ? t('metadata.people.merge.busy') : t('metadata.people.merge.label', { name: keep })}
        </GhostButton>
        <ErrorText>{err}</ErrorText>
      </div>
    </HandCard>
  )
}

// PEOPLE_KINDS — the five toggles, as [stored kind, the key that names it]. Keys
// again, resolved at the chip that draws one, for the reason GAP_KEYS gives.
const PEOPLE_KINDS = [
  ['author', 'metadata.people.kind.author.label'],
  ['actor', 'metadata.people.kind.actor.label'],
  ['director', 'metadata.people.kind.director.label'],
  ['studio', 'metadata.people.kind.studio.label'],
  ['speaker', 'metadata.people.kind.speaker.label'],
]

// The countable noun each kind is counted in, for the mobile one-liner — shared
// nouns, because a director is a director wherever the app counts them. STUDIO IS
// NEW: the inline map this replaces had four rows, so the studio chip read
// "5 undefineds still need photos or links".
const PEOPLE_NOUNS = {
  author: 'unit.author',
  actor: 'unit.actor',
  director: 'unit.director',
  studio: 'unit.studio',
  speaker: 'unit.speaker',
}

// What an empty list says, per kind. Same missing fifth row as above: a studio
// list with nothing in it used to draw an empty state with nothing in it.
const PEOPLE_EMPTY = {
  author: 'metadata.people.empty.author',
  actor: 'metadata.people.empty.actor',
  director: 'metadata.people.empty.director',
  studio: 'metadata.people.empty.studio',
  speaker: 'metadata.people.empty.speaker',
}

// PeopleConsole — every author/actor referenced in the library, with their
// external reference pages (IMDb · TMDB · TheTVDB · Wikipedia · Open Library).
// This metadata backs the person popup that opens when a name is clicked
// anywhere in the app — including right here (each row's name opens it).
// Links are fetched per row or in bulk for the ones still missing; rows stay
// listed even when no longer referenced so stale metadata remains manageable.
export function PeopleConsole({ onFlash, compact = false, onReverify, onSearch }) {
  const [kind, setKind] = useState('author')
  const [rows, setRows] = useState(null)
  const [q, setQ] = useState('')
  const [busyName, setBusyName] = useState('')
  const [bulk, setBulk] = useState(null) // {done, total} while bulk-fetching
  const [err, setErr] = useState('')
  // {kind, name} captured at click time, so flipping the Authors/Actors toggle
  // while the modal is open can't re-key it.
  const [person, setPerson] = useState(null)

  async function load(k = kind) {
    const r = await json('GET', `/people/names?kind=${k}`)
    if (r.ok) setRows(r.data.people)
    else setErr(errText(r))
  }
  useEffect(() => {
    setRows(null)
    setErr('')
    load(kind)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind])

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase()
    return (rows || []).filter((p) => !s || p.name.toLowerCase().includes(s))
  }, [rows, q])
  // A row still needs work if it has no provider links OR no stored photo.
  const noLinks = (p) => Object.keys(parseLinks(p.links).known).length === 0
  const missing = shown.filter((p) => noLinks(p) || !p.has_image)
  // Near-duplicate clusters (typos / transliterations of one person) to offer a
  // one-click merge — computed over the full list, not the search filter.
  // A GROUP WHOSE SPELLINGS ALREADY POINT AT ONE RECORD IS NOT A DUPLICATE, and
  // dropping it here is what makes the card honest after a merge. A merge leaves
  // every work printing what it printed — that is the promise — so "Bob Peck" and
  // "Robert Peck" both stay in this list afterwards, look exactly as alike as they
  // did, and the card would offer to merge them again for ever. person_id is what
  // says they are already the same person.
  const dupGroups = useMemo(() => {
    const byName = Object.fromEntries((rows || []).map((p) => [p.name, p]))
    return nearDupGroups((rows || []).map((p) => p.name)).filter((g) => {
      const ids = new Set(g.map((n) => byName[n]?.person_id).filter(Boolean))
      // Fewer than two distinct records means there is nothing left to merge.
      // An unresolved spelling (no id at all) keeps the group, because a name the
      // server could not resolve is exactly the one worth looking at.
      return ids.size !== 1 || g.some((n) => !byName[n]?.person_id)
    })
  }, [rows])
  const rowsByName = useMemo(() => Object.fromEntries((rows || []).map((p) => [p.name, p])), [rows])

  // fetchOne resolves the RIGHT person (book/credits disambiguation), fetches
  // their portrait and pins the identity via POST /people/portrait, then merges
  // the identity-resolved links into the row (bio/born untouched). Returns an
  // error string or null, like the form handlers do. This is what makes the
  // console pick the correct namesake — the old /people/lookup ranked by work
  // count and grabbed the wrong "David Reich".
  async function fetchOne(p) {
    const r = await json('POST', '/people/portrait', { kind, name: p.name })
    if (!r.ok) return errText(r)
    const cur = r.data.person && r.data.person.id ? r.data.person : null
    // Prefer the links the portrait resolved from the same identity; fall back to
    // a plain lookup (e.g. actors, or an author with no confident match).
    let linksMap = r.data.links && Object.keys(r.data.links).length ? r.data.links : null
    if (!linksMap) {
      const l = await json('POST', '/people/lookup', { kind, name: p.name })
      if (l.ok) linksMap = l.data.links
    }
    const merged = mergeLinks(cur?.links ?? p.links, linksMap)
    // The portrait may have stored an image even when there are no links — only
    // the link save is conditional; a clean run still counts as success.
    if (merged && merged !== (cur?.links ?? p.links ?? '')) {
      const s = await json('PUT', '/people', {
        kind,
        name: p.name,
        bio: cur?.bio || '',
        born: cur?.born || '',
        links: merged,
        source: cur?.source || 'portrait',
        source_id: cur?.source_id || '',
      })
      if (!s.ok) return errText(s)
    }
    return null
  }

  async function fetchRow(p) {
    setBusyName(p.name)
    setErr('')
    const e = await fetchOne(p)
    setBusyName('')
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
      t('metadata.people.fetch.flash', { ok: missing.length - failed, failed }) +
        (firstErr ? ` ${t('metadata.people.fetch.flash.reason', { error: firstErr })}` : ''),
    )
    load()
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 style={H2}>{t('metadata.people.title')}</h2>
        {/* §4: the verbose "what this fetches" copy now lives in a tooltip. */}
        <InfoDot text={t('metadata.people.info.body')} />
        {!compact && <MonoLabel>{t('metadata.shown.count', { n: shown.length })}</MonoLabel>}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {/* Studios are their own row, not folded in with directors, because the
              two share movies.director and are told apart only by media_type —
              listing them together would offer a studio for renaming as a
              director, which rewrites the wrong half of the catalogue. */}
          {PEOPLE_KINDS.map(([k, label]) => (
            <button key={k} className={'tp-filter-chip' + (kind === k ? ' active' : '')} onClick={() => setKind(k)}>
              {t(label)}
            </button>
          ))}
          {!compact && <input className="tp-input w-auto" placeholder={t('metadata.search.placeholder')} value={q} onChange={(e) => setQ(e.target.value)} />}
          {/* IconMetadata, the same arrow-landing-in-a-record the covers console
              uses: this fills fields on rows that already exist, which is what
              that drawing says and what tells it apart from IconExport. */}
          <GhostButton icon={<IconMetadata />} disabled={!!bulk || missing.length === 0} onClick={fetchMissing}>
            {missing.length > 0
              ? t('metadata.people.fetch.count.label', { n: missing.length })
              : t('metadata.people.fetch.label')}
          </GhostButton>
          {!compact && onReverify && (
            /* IconRefresh, matching the re-verify button on the works bulk bar
               above — the same act against a different kind of row. */
            <GhostButton
              icon={<IconRefresh />}
              disabled={!!bulk || !(rows || []).some((p) => p.saved)}
              title={t('metadata.people.reverify.tip')}
              onClick={() => onReverify((rows || []).filter((p) => p.saved).map((p) => ({ kind, name: p.name })))}
            >
              {t('metadata.people.reverify.label')}
            </GhostButton>
          )}
        </div>
      </div>
      <ErrorText>{err}</ErrorText>
      {bulk && <ProgressBar value={bulk.done} max={bulk.total} label={t('metadata.people.fetch.progress', { done: bulk.done, total: bulk.total })} />}
      {/* Mobile (§5): no browsable list — just how many still need work. */}
      {compact ? (
        <p className="microcopy" style={{ color: 'var(--soft)' }}>
          {!rows
            ? t('common.state.loading')
            : t('metadata.people.compact', {
                count: missing.length,
                n: missing.length,
                noun: t(PEOPLE_NOUNS[kind], { count: missing.length }),
              })}
        </p>
      ) : (
        <>
          {dupGroups.length > 0 && (
            <div className="space-y-2">
              <MonoLabel>{t('metadata.people.dups.count', { n: dupGroups.length })}</MonoLabel>
              {dupGroups.map((g, i) => (
                <DupCard key={i} group={g} kind={kind} rowsByName={rowsByName} onMerged={() => load()} />
              ))}
            </div>
          )}
          {!rows ? (
            <EmptyState>{t('common.state.loading')}</EmptyState>
          ) : shown.length === 0 ? (
            <EmptyState>{t(PEOPLE_EMPTY[kind])}</EmptyState>
          ) : (
            <Scroller className="ann-table-wrap" axis="both" style={{ maxHeight: 'min(28em, 60vh)', overflowY: 'auto' }}>
              <table className="ann-table">
                <thead>
                  <tr>
                    <th>{t('common.field.name.label')}</th>
                    <th>
                      {t(kind === 'author'
                        ? 'metadata.people.column.books'
                        : kind === 'speaker'
                          ? 'metadata.people.column.quotes'
                          : 'metadata.people.column.titles')}
                    </th>
                    <th>{t('common.field.links.label')}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((p) => (
                    <tr key={p.name}>
                      <td>
                        <PersonName kind={kind} name={p.name} onOpen={setPerson} />
                        {p.has_image && (
                          <span className="mono-label" style={{ marginLeft: 6, color: 'var(--soft)' }} title={t('metadata.people.photo.tip')}>· {t('metadata.people.photo.label')}</span>
                        )}
                      </td>
                      <td>
                        {/* Work count → search, which matches authors on book
                            hits and actors on dialogue hits. Saved-but-no-
                            longer-referenced rows count 0 — nothing to find. */}
                        {p.count > 0 ? (
                          <Tooltip label={t('metadata.people.search.tip', { name: p.name })} side="top">
                            <button
                              className="tp-link"
                              onClick={() => onSearch?.(p.name)}
                            >
                              {p.count}
                            </button>
                          </Tooltip>
                        ) : (
                          <span className="microcopy">0</span>
                        )}
                      </td>
                      <td><ProviderChips links={p.links} /></td>
                      <td className="col-actions">
                        {/* ONE glyph for both words. `fetch` and `refetch` are the
                            same act — go and get this person's photo and links —
                            and the label flips only because the row already has
                            some. Two drawings for that would say the acts differ. */}
                        <button
                          className="tp-link tp-link-icon"
                          disabled={busyName === p.name || !!bulk}
                          onClick={() => fetchRow(p)}
                        >
                          <IconRefresh />
                          <span>
                            {busyName === p.name
                              ? t('metadata.people.row.fetch.busy')
                              : (Object.keys(parseLinks(p.links).known).length > 0 || p.has_image)
                                ? t('metadata.people.row.refetch.label')
                                : t('metadata.people.row.fetch.label')}
                          </span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Scroller>
          )}
        </>
      )}
      {/* onSaved must reload: a rename/delete/photo/link change from inside the
          modal changes this console's rows. */}
      {person && (
        <PersonModal
          kind={person.kind}
          name={person.name}
          onClose={() => setPerson(null)}
          onSaved={() => load()}
        />
      )}
    </section>
  )
}
