import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { upload, errText } from './api.js'
import { t, tNodes } from './i18n.js'
import {
  GhostButton,
  HandCard,
  InfoDot,
  MonoLabel,
  PageHeader,
  useIsMobileScreen,
  useReveal,
  useAnchoredPosition,
  useDismiss,
} from './ui.jsx'

// Import page (§8.8, mockups 17–19): source cards with bulk multi-select and
// drag-drop, one request per file to the existing endpoints, and per-file result
// rows.
//
// Since 1.2.0 an import writes nothing into the library: it parses into the
// staging queue and answers a batch id and a staged count. So the results here
// report what was *staged* and hand over to the pending-import screen, which is
// where quotes are reviewed and approved in bulk.
//
// The old post-import review pass — walk the rows missing chapter or location and
// fill them in one at a time — is retired. The queue supersedes it and does the
// same job over a selection instead of a row at a time.

// SOURCES holds KEYS and the mechanical facts. Every word a reader sees —
// the format's name, its one-line description, its numbered steps and the
// clippings caveat — is a key resolved where it is drawn, so the wall is in the
// reader's language and not in the language it was written in.
//
// `steps` is a COUNT rather than a list of strings: the keys are
// import.source.<kind>.step.1 … .N, so the table says how many there are and the
// file says what they are. A list of keys here would be the same fact written
// twice, and locale-complete would only check one of them.
const SOURCES = [
  { kind: 'markdown', ext: '.md', accept: '.md,.markdown,.txt', steps: 2 },
  { kind: 'bookcision', ext: '.json', accept: '.json', steps: 3 },
  { kind: 'hardcover-html', ext: '.html', accept: '.htm,.html', steps: 3 },
  { kind: 'goodreads-html', ext: '.html', accept: '.htm,.html', steps: 3 },
  { kind: 'imdb-quotes', ext: '.html', accept: '.htm,.html', steps: 3 },
  { kind: 'kindle-notebook', ext: '.html', accept: '.htm,.html', steps: 3 },
  { kind: 'kindle-clippings', ext: '.txt', accept: '.txt', steps: 3, caveat: true },
]

// The reader's words for one source, resolved at render.
const sourceTitle = (kind) => t(`import.source.${kind}.title`)
const sourceDesc = (kind) => t(`import.source.${kind}.desc`)
const sourceSteps = (src) =>
  Array.from({ length: src.steps }, (_, i) => t(`import.source.${src.kind}.step.${i + 1}`))
const sourceCaveat = (src) => (src.caveat ? t(`import.source.${src.kind}.caveat`) : '')

// `embedded` renders without the page header / sticky bar, for the unified Add
// surface (§7 One "＋ Add") where the surface supplies its own title + chooser.
export default function ImportPage({ onReviewImport, onStaged, embedded = false }) {
  const [results, setResults] = useState(null) // per-file rows, in batch order
  const [summary, setSummary] = useState('')
  const [staged, setStaged] = useState(0) // this run's total, for the hand-over
  const [busy, setBusy] = useState(false)
  const ref = useReveal()
  const mobile = useIsMobileScreen()

  // One request per file (§10 bulk contract); rows fill in as the loop runs.
  async function runBatch(kind, files) {
    if (busy || files.length === 0) return
    setBusy(true)
    setSummary('')
    setStaged(0)
    const rows = files.map((f) => ({ name: f.name, pending: true }))
    setResults([...rows])
    for (let i = 0; i < files.length; i++) {
      const r = await upload(`/import/${kind}`, files[i])
      rows[i] = r.ok
        ? { name: files[i].name, ok: true, ...r.data }
        : { name: files[i].name, ok: false, error: errText(r, t('error.import.failed')) }
      setResults([...rows])
    }
    const ok = rows.filter((r) => r.ok)
    const total = ok.reduce((n, r) => n + (r.staged || 0), 0)
    setStaged(total)
    setSummary(
      t('import.summary.arrow', {
        files: t('import.summary.files', { count: files.length, n: files.length }),
        quotes: t('import.summary.quotes', { count: total, n: total }),
      }),
    )
    onStaged?.()
    setBusy(false)
  }

  return (
    <section className="space-y-5">
      {!embedded && (
        <div className={mobile ? 'mobile-sticky-bar' : ''}>
          <PageHeader title={t('import.title')} counts={t('import.counts')} />
        </div>
      )}
      {/* Embedded in the narrow Add surface (max-w-2xl), 4 columns crammed the
          cards and overflowed the buttons — cap at 2 there; the standalone page
          keeps the wide 4-up wall. Phones swap the wall for a searchable
          format picker: one detail card beats a six-card scroll. */}
      {mobile ? (
        <MobileImportPicker busy={busy} onFiles={runBatch} />
      ) : (
        <div ref={ref} className={'reveal grid gap-3 sm:grid-cols-2' + (embedded ? '' : ' lg:grid-cols-4')}>
          {SOURCES.map((s, i) => (
            <SourceCard
              key={s.kind}
              src={s}
              variant={i}
              color={CARD_COLORS[i % CARD_COLORS.length]}
              busy={busy}
              onFiles={(fs) => runBatch(s.kind, fs)}
            />
          ))}
        </div>
      )}
      {results && (
        <BatchResults results={results} summary={summary} staged={staged} onReviewImport={onReviewImport} />
      )}
      <NothingLandsYetNote />
      <SaveDontPasteNote />
    </section>
  )
}

// SaveDontPasteNote records why imports are save-the-page-and-upload rather than
// "paste a URL and we'll fetch it" (a natural question). Collapsed by default —
// an expand action for those interested — so it doesn't clutter the page.
function SaveDontPasteNote() {
  return (
    <details
      className="px-4 py-3"
      style={{ border: '1px dashed var(--line)', borderRadius: 12, color: 'var(--soft)' }}
    >
      <summary className="mono-label cursor-pointer" style={{ listStyle: 'revert' }}>
        {t('import.why-upload.summary')}
      </summary>
      <p className="mt-2" style={{ fontSize: 13, lineHeight: 1.55 }}>
        {tNodes('import.why-upload.body', {
          emphasis: <i>{t('import.why-upload.emphasis')}</i>,
        })}
      </p>
    </details>
  )
}

// Each import tile carries its own colour theme (a mix across the wall) — the
// annotation quartet plus the two cooler accents. Tinted ext badge + left bar +
// a slight paste-on tilt give the cards a hand-placed, "pasted note" feel.
const CARD_COLORS = ['#E5C355', '#7FA6C9', '#D98CA6', '#DF9A5B', '#3F7D5A', '#2F6D8F']

// ExtBadge is the small mono file-extension chip on each source card, tinted to
// the tile's colour (or muted for the disabled card).
function ExtBadge({ muted, color, children }) {
  const c = muted ? 'var(--faint)' : color || 'var(--accent-ui)'
  const base = color || 'var(--accent)'
  return (
    <span
      className="mono-label self-start"
      style={{
        color: c,
        border: `1.2px solid ${muted ? 'var(--line)' : `color-mix(in srgb, ${base} 55%, transparent)`}`,
        background: muted ? 'transparent' : `color-mix(in srgb, ${base} 13%, transparent)`,
        borderRadius: 7,
        padding: '3px 8px',
      }}
    >
      {children}
    </span>
  )
}

// MobileImportPicker — the phone-sized import chooser (§ mobile): a searchable
// dropdown over SOURCES, the picked format's detail card with its how-to steps
// inline (the info-dot tooltip barely works on touch), and one Import button.
// Markdown is the default pick.
function MobileImportPicker({ busy, onFiles }) {
  const [sel, setSel] = useState('markdown')
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const boxRef = useRef(null)
  const { popRef, style } = useAnchoredPosition(open, boxRef, { matchWidth: true, minHeight: 140 })
  useDismiss(open, () => setOpen(false), [boxRef, popRef], { event: ['mousedown', 'touchstart'] })
  const selIdx = SOURCES.findIndex((s) => s.kind === sel)
  const selected = SOURCES[selIdx]
  const color = CARD_COLORS[selIdx % CARD_COLORS.length]
  const q = query.trim().toLowerCase()
  // Searched over the RESOLVED words, so typing in the reader's own language
  // finds the format they can see.
  const hits = q
    ? SOURCES.filter((s) =>
        `${sourceTitle(s.kind)} ${sourceDesc(s.kind)} ${s.ext}`.toLowerCase().includes(q),
      )
    : SOURCES
  return (
    <div className="flex flex-col gap-3">
      <div className="relative" ref={boxRef}>
        <input
          type="text"
          className="tp-input"
          role="combobox"
          aria-expanded={open}
          aria-label={t('import.format.aria')}
          placeholder={t('import.format.search.placeholder')}
          value={open ? query : sourceTitle(selected.kind)}
          onFocus={() => { setQuery(''); setOpen(true) }}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
        />
        {open && createPortal(
          <div ref={popRef} className="tp-select-panel" role="listbox" style={style}>
            {hits.length === 0 && <p className="microcopy px-3 py-2">{t('import.format.none')}</p>}
            {hits.map((s) => (
              <button
                key={s.kind}
                type="button"
                role="option"
                aria-selected={s.kind === sel}
                className="tp-select-opt tactile"
                onClick={() => { setSel(s.kind); setQuery(''); setOpen(false) }}
              >
                {sourceTitle(s.kind)}{' '}
                <span className="mono-label" style={{ color: 'var(--faint)', marginLeft: 6 }}>{s.ext}</span>
              </button>
            ))}
          </div>,
          document.body,
        )}
      </div>
      <HandCard variant={selIdx} colorBar={color} className="flex flex-col gap-3 p-5">
        <ExtBadge color={color}>{selected.ext}</ExtBadge>
        <h3 className="text-base font-semibold">{sourceTitle(selected.kind)}</h3>
        <p className="text-sm" style={{ color: 'var(--soft)' }}>{sourceDesc(selected.kind)}</p>
        <ol
          className="text-sm"
          style={{ color: 'var(--soft)', listStyle: 'decimal', paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}
        >
          {sourceSteps(selected).map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
        <label
          className="tp-btn tp-btn-primary w-full"
          style={busy ? { opacity: 0.55, cursor: 'default' } : { cursor: 'pointer' }}
        >
          {t('import.pick.label')}
          <input
            type="file"
            multiple
            accept={selected.accept}
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              const fs = [...e.target.files]
              e.target.value = ''
              if (fs.length > 0) onFiles(selected.kind, fs)
            }}
          />
        </label>
      </HandCard>
    </div>
  )
}

// SourceCard accepts single or bulk file selection via the hidden input, and
// drag-drop of one or many files anywhere on the card (a bonus, not the point).
// The paste-on wobble lives on a chrome-only HandCard underlay: rotating the
// text itself rasterized every glyph on a 0.7° layer and blurred it (§ the
// import wall was the only place whole text cards were tilted).
function SourceCard({ variant, src, busy, onFiles, color }) {
  const { ext, accept } = src
  const steps = sourceSteps(src)
  const caveat = sourceCaveat(src)
  const [over, setOver] = useState(false)
  const tilt = variant % 2 ? 0.7 : -0.7 // paste-on wobble (§ playful, within ±2.2°)
  return (
    <div
      className="relative"
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        onFiles([...e.dataTransfer.files])
      }}
    >
      <HandCard
        variant={variant}
        colorBar={color}
        className="absolute inset-0"
        style={{ rotate: `${tilt}deg`, ...(over ? { borderColor: color, background: `color-mix(in srgb, ${color} 8%, var(--card))` } : null) }}
        aria-hidden="true"
      />
      <div className="relative flex h-full flex-col gap-3 p-5">
      <ExtBadge color={color}>{ext}</ExtBadge>
      <div className="flex items-center gap-1.5">
        <h3 className="text-base font-semibold">{sourceTitle(src.kind)}</h3>
        {steps.length > 0 && (
          <InfoDot text={steps.map((step, i) => `${i + 1}. ${step}`).join('  ')} />
        )}
        {/* An honest label, not decoration: the caveat itself is one tap away
            rather than buried in the steps. */}
        {caveat && (
          <span className="tp-chip shrink-0" style={{ color: 'var(--amber)', fontSize: 9.5 }}>
            {t('import.experimental.label')}
          </span>
        )}
      </div>
      <p className="text-sm" style={{ color: 'var(--soft)' }}>
        {sourceDesc(src.kind)}
      </p>
      {caveat && (
        <p className="microcopy" style={{ color: 'var(--amber, var(--accent-ui))' }}>⚠ {caveat}</p>
      )}
      <div className="mt-auto">
        <label
          className="tp-btn tp-btn-ghost w-full"
          style={busy ? { opacity: 0.55, cursor: 'default' } : { cursor: 'pointer' }}
        >
          {t('import.choose.label')}
          <input
            type="file"
            multiple
            accept={accept}
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              const fs = [...e.target.files]
              e.target.value = ''
              if (fs.length > 0) onFiles(fs)
            }}
          />
        </label>
        <p className="microcopy mt-1.5 text-center">{t('import.drop.hint')}</p>
      </div>
      </div>
    </div>
  )
}

// BatchResults — accent-barred card: a summary line, one mono row per file, and
// the hand-over to the pending queue. Rows report what was STAGED and where each
// work will land if approved; the added/skipped/enriched counters now belong to
// the approval, so they are reported there.
function BatchResults({ results, summary, staged, onReviewImport }) {
  return (
    <div className="hand-card hc-r2 space-y-1.5 p-4" style={{ borderLeft: '4px solid var(--accent)' }}>
      {summary && (
        <p className="microcopy" style={{ color: 'var(--ink)' }}>
          {summary}
        </p>
      )}
      {results.map((r, i) => (
        <div key={i}>
          <p className="microcopy">
            {r.name} →{' '}
            {r.pending ? (
              '…'
            ) : r.ok ? (
              t('import.row.staged', { count: r.staged, n: r.staged })
            ) : (
              <span style={{ color: 'var(--error)' }}>{r.error}</span>
            )}
          </p>
          {r.ok && <ClippingsNotice row={r} />}
          {r.ok && (r.works || []).map((w) => <StagedWorkNotice key={w.id} work={w} />)}
          {r.ok && r.possible_duplicates && r.possible_duplicates.length > 0 && (
            <p className="microcopy" style={{ color: 'var(--amber, var(--accent-ui))' }}>
              {t('import.row.duplicate', {
                titles: r.possible_duplicates.map((d) => d.title).join(', '),
              })}
            </p>
          )}
        </div>
      ))}
      {staged > 0 && onReviewImport && (
        <button className="tp-btn tp-btn-primary mt-1.5" onClick={onReviewImport}>
          {t('import.review', { count: staged, n: staged })}
        </button>
      )}
      {staged > 0 && !onReviewImport && (
        <p className="microcopy" style={{ color: 'var(--accent-ui)' }}>
          {t('import.review.absent')}
        </p>
      )}
    </div>
  )
}

// StagedWorkNotice says where one parsed work will land — a new row, or a title
// already in the library — and flags an ambiguous match. This is the check the
// 1.1.1 routing bug wanted: it happens before the write, not after it.
function StagedWorkNotice({ work }) {
  // The three media the parser can report, each named by the app's shared noun.
  const kindWord = t(work.kind === 'book' ? 'unit.book' : work.kind === 'show' ? 'unit.show' : 'unit.film', {
    count: 1,
  })
  return (
    <div className="microcopy" style={{ color: 'var(--soft)' }}>
      <span>
        {work.title} ({work.staged}) →{' '}
        {work.target_id
          ? work.target_year
            ? t('import.work.joins-year', {
                title: work.target_title || work.title,
                year: work.target_year,
              })
            : t('import.work.joins', { title: work.target_title || work.title })
          : t('import.work.new', { kind: kindWord })}
      </span>
      {work.ambiguous && (
        <p style={{ color: 'var(--amber, var(--accent-ui))' }}>
          {t('import.work.ambiguous', { n: work.alternatives + 1, title: work.title })}
        </p>
      )}
    </div>
  )
}

// NothingLandsYetNote states the contract of the screen once, in place, so the
// absence of "12 added" is understood rather than read as a failure.
function NothingLandsYetNote() {
  return (
    <p
      className="microcopy px-4 py-3"
      style={{ border: '1px dashed var(--line)', borderRadius: 12, color: 'var(--soft)' }}
    >
      {tNodes('import.nothing-lands.body', { queue: <b>{t('staging.title')}</b> })}
    </p>
  )
}

// ClippingsNotice reports what a My Clippings.txt import dropped. A best-effort
// parser that quietly returns fewer quotes than the file held is worse than one
// that says so, so every skipped record is accounted for on screen.
function ClippingsNotice({ row }) {
  const parts = []
  const say = (key, n) => t(key, { count: n, n })
  if (row.bookmarks_skipped) parts.push(say('import.clippings.bookmarks', row.bookmarks_skipped))
  if (row.notes_merged) parts.push(say('import.clippings.notes', row.notes_merged))
  if (row.near_duplicates) parts.push(say('import.clippings.duplicates', row.near_duplicates))
  if (row.blocks_malformed) parts.push(say('import.clippings.malformed', row.blocks_malformed))
  if (parts.length === 0) return null
  return (
    <p className="microcopy" style={{ color: row.blocks_malformed ? 'var(--amber, var(--accent-ui))' : 'var(--soft)' }}>
      {row.blocks_malformed ? '⚠ ' : ''}
      {parts.join(' · ')}
    </p>
  )
}
