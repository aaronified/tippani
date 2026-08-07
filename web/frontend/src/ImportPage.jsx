import { useEffect, useRef, useState } from 'react'
import { upload, errText } from './api.js'
import {
  GhostButton,
  HandCard,
  InfoDot,
  MonoLabel,
  PageHeader,
  useIsMobileScreen,
  useReveal,
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

const SOURCES = [
  {
    kind: 'markdown',
    ext: '.md',
    title: 'Markdown',
    desc: 'Tippani book or catalogue exports, or a Readest export — auto-detected.',
    accept: '.md,.markdown,.txt',
    steps: [
      'Re-import a Tippani export (books or the catalogue), a Readest export, or your own frontmatter + quotes.',
      'A single .md may hold many books or titles — each is imported. Drop the file(s) here.',
    ],
  },
  {
    kind: 'bookcision',
    ext: '.json',
    title: 'Bookcision',
    desc: 'Kindle highlights via the Bookcision bookmarklet.',
    accept: '.json',
    steps: [
      'On read.amazon.com/notebook, open the book’s Notes & Highlights.',
      'Run the Bookcision bookmarklet, then Download → JSON, and drop it here.',
      'Prefer to skip the bookmarklet? Use the Kindle notebook card to import the saved page directly (keeps colours).',
    ],
  },
  {
    kind: 'hardcover-html',
    ext: '.html',
    title: 'Hardcover',
    desc: 'Your reading-journal page for one book.',
    accept: '.htm,.html',
    steps: [
      'Open your journal page, e.g. hardcover.app/books/<book>/journals/@you',
      'Save it as a web page, HTML only (Ctrl+S / ⌘S).',
      'Drop the saved .html here.',
    ],
  },
  {
    kind: 'goodreads-html',
    ext: '.html',
    title: 'Goodreads',
    desc: "A book's public Quotes page — quote tags come across too.",
    accept: '.htm,.html',
    steps: [
      'Open the book’s Quotes page, e.g. goodreads.com/work/quotes/<id>-<book>',
      'Save it as a web page, HTML only (Ctrl+S / ⌘S).',
      'Drop the saved .html here.',
    ],
  },
  {
    kind: 'imdb-quotes',
    ext: '.html',
    title: 'IMDb quotes',
    desc: 'A movie or show’s Quotes page → dialogues (into Movies & Shows).',
    accept: '.htm,.html',
    steps: [
      'Open the title’s Quotes page, e.g. imdb.com/title/tt0434409/quotes',
      'Save it as a web page, HTML only (Ctrl+S / ⌘S).',
      'Drop the saved .html here.',
    ],
  },
  {
    kind: 'kindle-notebook',
    ext: '.html',
    title: 'Kindle notebook',
    desc: 'Your Kindle Notes & Highlights page — colours + locations come across.',
    accept: '.htm,.html',
    steps: [
      'Open read.amazon.com/notebook and pick the book.',
      'Save it as a web page, HTML only (Ctrl+S / ⌘S).',
      'Drop the saved .html here.',
    ],
  },
  {
    kind: 'kindle-clippings',
    ext: '.txt',
    title: 'My Clippings',
    desc: 'The Kindle device’s own file — every book at once, highlights and notes.',
    accept: '.txt',
    experimental: 'Kindle never documented this format and localises it, so a device in another language (or an unusual firmware) can produce records this misreads. Nothing is guessed at: whatever can’t be read is skipped and counted back to you.',
    steps: [
      'Plug the Kindle in by USB.',
      'Copy documents/My Clippings.txt off the device.',
      'Drop it here — every book in the file lands at once.',
    ],
  },
]

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
        : { name: files[i].name, ok: false, error: errText(r, 'import failed') }
      setResults([...rows])
    }
    const ok = rows.filter((r) => r.ok)
    const total = ok.reduce((n, r) => n + (r.staged || 0), 0)
    setStaged(total)
    setSummary(
      `${files.length} file${files.length === 1 ? '' : 's'} → ${total} quote${total === 1 ? '' : 's'} staged` +
        ' · nothing has entered your library yet',
    )
    onStaged?.()
    setBusy(false)
  }

  return (
    <section className="space-y-5">
      {!embedded && (
        <div className={mobile ? 'mobile-sticky-bar' : ''}>
          <PageHeader title="Import" counts="bring the highlights home" />
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
              {...s}
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
        Why upload the saved page, not paste a URL?
      </summary>
      <p className="mt-2" style={{ fontSize: 13, lineHeight: 1.55 }}>
        Fetching the page from a URL in your browser is blocked by cross-origin rules (CORS) — sites like Amazon,
        IMDb and Goodreads don’t allow it, which is exactly why a bookmarklet such as Bookcision has to run{' '}
        <i>on their page</i>. Fetching server-side would dodge CORS but needs your logged-in session for private
        pages (Kindle), and scraping from a server trips anti-bot defences and site terms — fragile and easy to
        break silently. Saving the page in your own signed-in browser and uploading it is the robust path that
        keeps working, so that’s what we do.
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
  useEffect(() => {
    if (!open) return
    const onDoc = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('touchstart', onDoc)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('touchstart', onDoc)
    }
  }, [open])
  const selIdx = SOURCES.findIndex((s) => s.kind === sel)
  const selected = SOURCES[selIdx]
  const color = CARD_COLORS[selIdx % CARD_COLORS.length]
  const q = query.trim().toLowerCase()
  const hits = q
    ? SOURCES.filter((s) => `${s.title} ${s.desc} ${s.ext}`.toLowerCase().includes(q))
    : SOURCES
  return (
    <div className="flex flex-col gap-3">
      <div className="relative" ref={boxRef}>
        <input
          type="text"
          className="tp-input"
          role="combobox"
          aria-expanded={open}
          aria-label="Import format"
          placeholder="Search formats…"
          value={open ? query : selected.title}
          onFocus={() => { setQuery(''); setOpen(true) }}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
        />
        {open && (
          <div className="tp-select-panel" role="listbox" style={{ width: '100%' }}>
            {hits.length === 0 && <p className="microcopy px-3 py-2">no format matches</p>}
            {hits.map((s) => (
              <button
                key={s.kind}
                type="button"
                role="option"
                aria-selected={s.kind === sel}
                className="tp-select-opt tactile"
                onClick={() => { setSel(s.kind); setQuery(''); setOpen(false) }}
              >
                {s.title} <span className="mono-label" style={{ color: 'var(--faint)', marginLeft: 6 }}>{s.ext}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <HandCard variant={selIdx} colorBar={color} className="flex flex-col gap-3 p-5">
        <ExtBadge color={color}>{selected.ext}</ExtBadge>
        <h3 className="text-base font-semibold">{selected.title}</h3>
        <p className="text-sm" style={{ color: 'var(--soft)' }}>{selected.desc}</p>
        <ol
          className="text-sm"
          style={{ color: 'var(--soft)', listStyle: 'decimal', paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}
        >
          {selected.steps.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
        <label
          className="tp-btn tp-btn-primary w-full"
          style={busy ? { opacity: 0.55, cursor: 'default' } : { cursor: 'pointer' }}
        >
          Import — pick file(s)
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
function SourceCard({ variant, ext, title, desc, steps, accept, busy, onFiles, color, experimental }) {
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
        <h3 className="text-base font-semibold">{title}</h3>
        {steps && steps.length > 0 && (
          <InfoDot text={steps.map((s, i) => `${i + 1}. ${s}`).join('  ')} />
        )}
        {/* An honest label, not decoration: the caveat itself is one tap away
            rather than buried in the steps. */}
        {experimental && (
          <span className="tp-chip shrink-0" style={{ color: 'var(--amber)', fontSize: 9.5 }}>experimental</span>
        )}
      </div>
      <p className="text-sm" style={{ color: 'var(--soft)' }}>
        {desc}
      </p>
      {experimental && (
        <p className="microcopy" style={{ color: 'var(--amber, var(--accent-ui))' }}>⚠ {experimental}</p>
      )}
      <div className="mt-auto">
        <label
          className="tp-btn tp-btn-ghost w-full"
          style={busy ? { opacity: 0.55, cursor: 'default' } : { cursor: 'pointer' }}
        >
          Choose file — one or many
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
        <p className="microcopy mt-1.5 text-center">or drag &amp; drop here</p>
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
              `${r.staged} quote${r.staged === 1 ? '' : 's'} staged`
            ) : (
              <span style={{ color: 'var(--error)' }}>{r.error}</span>
            )}
          </p>
          {r.ok && <ClippingsNotice row={r} />}
          {r.ok && (r.works || []).map((w) => <StagedWorkNotice key={w.id} work={w} />)}
          {r.ok && r.possible_duplicates && r.possible_duplicates.length > 0 && (
            <p className="microcopy" style={{ color: 'var(--amber, var(--accent-ui))' }}>
              ⚠ looks like a book you already have:{' '}
              {r.possible_duplicates.map((d) => d.title).join(', ')} — retarget the staged quotes onto it in the queue,
              or approve them as a separate book
            </p>
          )}
        </div>
      ))}
      {staged > 0 && onReviewImport && (
        <button className="tp-btn tp-btn-primary mt-1.5" onClick={onReviewImport}>
          Review {staged} staged quote{staged === 1 ? '' : 's'}
        </button>
      )}
      {staged > 0 && !onReviewImport && (
        <p className="microcopy" style={{ color: 'var(--accent-ui)' }}>
          open Pending import to review and approve them
        </p>
      )}
    </div>
  )
}

// StagedWorkNotice says where one parsed work will land — a new row, or a title
// already in the library — and flags an ambiguous match. This is the check the
// 1.1.1 routing bug wanted: it happens before the write, not after it.
function StagedWorkNotice({ work }) {
  const kindWord = work.kind === 'book' ? 'book' : work.kind === 'show' ? 'show' : 'film'
  return (
    <div className="microcopy" style={{ color: 'var(--soft)' }}>
      <span>
        {work.title} ({work.staged}) →{' '}
        {work.target_id
          ? `joins your existing “${work.target_title || work.title}”${work.target_year ? ` (${work.target_year})` : ''}`
          : `a new ${kindWord}`}
      </span>
      {work.ambiguous && (
        <p style={{ color: 'var(--amber, var(--accent-ui))' }}>
          ⚠ you have {work.alternatives + 1} titles named “{work.title}” — the queue shows which one it picked, and lets
          you move it
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
      Imports land in <b>Pending import</b> first and stay there until you okay them — nothing enters your library, your
      search or your review deck on arrival. Review a whole file at once there: fix chapters and locations in bulk, move
      quotes to the right book or film, then approve or discard.
    </p>
  )
}

// ClippingsNotice reports what a My Clippings.txt import dropped. A best-effort
// parser that quietly returns fewer quotes than the file held is worse than one
// that says so, so every skipped record is accounted for on screen.
function ClippingsNotice({ row }) {
  const parts = []
  if (row.bookmarks_skipped) parts.push(`${row.bookmarks_skipped} bookmark${row.bookmarks_skipped === 1 ? '' : 's'} skipped (no text to import)`)
  if (row.notes_merged) parts.push(`${row.notes_merged} note${row.notes_merged === 1 ? '' : 's'} attached to their highlight`)
  if (row.near_duplicates) parts.push(`${row.near_duplicates} re-saved highlight${row.near_duplicates === 1 ? '' : 's'} collapsed`)
  if (row.blocks_malformed) parts.push(`${row.blocks_malformed} record${row.blocks_malformed === 1 ? '' : 's'} couldn’t be read`)
  if (parts.length === 0) return null
  return (
    <p className="microcopy" style={{ color: row.blocks_malformed ? 'var(--amber, var(--accent-ui))' : 'var(--soft)' }}>
      {row.blocks_malformed ? '⚠ ' : ''}
      {parts.join(' · ')}
    </p>
  )
}
