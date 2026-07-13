import { useState } from 'react'
import { json, upload, errText } from './api.js'
import {
  ErrorText,
  Field,
  GhostButton,
  HandCard,
  InfoDot,
  MonoLabel,
  PageHeader,
  useIsMobileScreen,
  useReveal,
} from './ui.jsx'

// Import page (§8.8, mockups 17–19): four source cards with bulk multi-select
// and drag-drop, one request per file to the existing endpoints, per-file
// result rows + a batch summary, then the post-import review pass (PLAN §5b).

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
]

// `embedded` renders without the page header / sticky bar, for the unified Add
// surface (§7 One "＋ Add") where the surface supplies its own title + chooser.
export default function ImportPage({ onOpenMovie, embedded = false }) {
  const [results, setResults] = useState(null) // per-file rows, in batch order
  const [summary, setSummary] = useState('')
  const [queue, setQueue] = useState(null) // review pass: [{bookId, ann}]
  const [busy, setBusy] = useState(false)
  const ref = useReveal()
  const mobile = useIsMobileScreen()

  // One request per file (§10 bulk contract); rows fill in as the loop runs.
  async function runBatch(kind, files) {
    if (busy || files.length === 0) return
    setBusy(true)
    setSummary('')
    setQueue(null)
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
    const t = ok.reduce(
      (t, r) => ({
        added: t.added + r.added,
        skipped: t.skipped + r.skipped,
        enriched: t.enriched + (r.enriched || 0),
      }),
      { added: 0, skipped: 0, enriched: 0 },
    )
    setSummary(
      `${files.length} file${files.length === 1 ? '' : 's'} → ${t.added} added · ${t.skipped} skipped` +
        (t.enriched ? ` · ${t.enriched} enriched` : ''),
    )
    // Review pass: collect annotations missing chapter/location across the
    // books this batch touched. Movie/show imports (IMDb → dialogues) return no
    // book_id, so the filter naturally skips them.
    const q = []
    // A markdown file may import many books (multi-book export), so prefer the
    // book_ids array; fall back to the single book_id for other sources.
    const touched = ok.flatMap((r) => r.book_ids || (r.book_id ? [r.book_id] : []))
    for (const bookId of [...new Set(touched.filter(Boolean))]) {
      const a = await json('GET', `/annotations?book_id=${bookId}`)
      if (!a.ok) continue
      for (const ann of a.data.annotations) {
        if (!ann.chapter || !ann.location) q.push({ bookId, ann })
      }
    }
    if (q.length > 0) setQueue(q)
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
          keeps the wide 4-up wall. */}
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
        <DisabledCard />
      </div>
      {results && <BatchResults results={results} summary={summary} onOpenMovie={onOpenMovie} />}
      {queue && <ReviewPanel queue={queue} onDone={() => setQueue(null)} />}
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

// SourceCard accepts single or bulk file selection via the hidden input, and
// drag-drop of one or many files anywhere on the card (a bonus, not the point).
function SourceCard({ variant, ext, title, desc, steps, accept, busy, onFiles, color }) {
  const [over, setOver] = useState(false)
  const tilt = variant % 2 ? 0.7 : -0.7 // paste-on wobble (§ playful, within ±2.2°)
  return (
    <HandCard
      variant={variant}
      colorBar={color}
      className="flex flex-col gap-3 p-5"
      style={{ rotate: `${tilt}deg`, ...(over ? { borderColor: color, background: `color-mix(in srgb, ${color} 8%, var(--card))` } : null) }}
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
      <ExtBadge color={color}>{ext}</ExtBadge>
      <div className="flex items-center gap-1.5">
        <h3 className="text-base font-semibold">{title}</h3>
        {steps && steps.length > 0 && (
          <InfoDot text={steps.map((s, i) => `${i + 1}. ${s}`).join('  ')} side="bottom" />
        )}
      </div>
      <p className="text-sm" style={{ color: 'var(--soft)' }}>
        {desc}
      </p>
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
    </HandCard>
  )
}

// DisabledCard is the deferred My Clippings source (endpoint returns 501).
function DisabledCard() {
  return (
    <div
      className="flex flex-col gap-3 p-5"
      style={{ border: '1.6px dashed var(--line)', borderRadius: 14, color: 'var(--faint)' }}
      aria-disabled="true"
    >
      <ExtBadge muted>.txt</ExtBadge>
      <h3 className="text-base font-semibold" style={{ color: 'var(--soft)' }}>
        My Clippings
      </h3>
      <p className="text-sm">Kindle-device file — deferred for now.</p>
      <p className="microcopy mt-auto text-center">returns 501 — deferred</p>
    </div>
  )
}

// BatchResults — accent-barred card: summary line + one mono row per file.
// Book imports show added/skipped/enriched + a look-alike hint; movie/show
// imports (IMDb → dialogues) show where the dialogues landed and, when the
// import anchored to an existing title or was ambiguous, a review notice.
function BatchResults({ results, summary, onOpenMovie }) {
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
              `${r.added} added · ${r.skipped} skipped` + (r.enriched ? ` · ${r.enriched} enriched` : '')
            ) : (
              <span style={{ color: 'var(--error)' }}>{r.error}</span>
            )}
          </p>
          {r.ok && r.possible_duplicates && r.possible_duplicates.length > 0 && (
            <p className="microcopy" style={{ color: 'var(--amber, var(--accent-ui))' }}>
              ⚠ looks like a book you already have:{' '}
              {r.possible_duplicates.map((d) => d.title).join(', ')} — open either book to merge or keep them separate
            </p>
          )}
          {r.ok && r.movie_id && <MovieImportNotice row={r} onOpenMovie={onOpenMovie} />}
        </div>
      ))}
    </div>
  )
}

// MovieImportNotice explains where an IMDb import's dialogues landed: a new
// entry, or anchored onto an existing same-name title (flagging a year mismatch
// or an ambiguous match so the user can confirm). Links to the movie to review.
function MovieImportNotice({ row, onOpenMovie }) {
  const yearMismatch =
    row.anchored && row.year_imported && row.matched_year && row.year_imported !== row.matched_year
  return (
    <div className="microcopy" style={{ color: 'var(--soft)' }}>
      <span>
        {row.created
          ? `added a new title “${row.title}”`
          : `attached to your existing “${row.title}”${row.matched_year ? ` (${row.matched_year})` : ''}`}
      </span>
      {onOpenMovie && (
        <>
          {' — '}
          <button type="button" className="tp-link" onClick={() => onOpenMovie(row.movie_id)}>
            open{row.media_type === 'show' ? ' show' : ' movie'}
          </button>
        </>
      )}
      {yearMismatch && (
        <p style={{ color: 'var(--amber, var(--accent-ui))' }}>
          ⚠ the imported page said {row.year_imported} but your title is {row.matched_year} — confirm they’re the
          same title.
        </p>
      )}
      {row.ambiguous && (
        <p style={{ color: 'var(--amber, var(--accent-ui))' }}>
          ⚠ you have {row.alternatives + 1} titles named “{row.title}”; the dialogues went to the most likely one —
          open it to check.
        </p>
      )}
    </div>
  )
}

// annotationState builds the full PUT body from an annotation row — PUT is
// full-state, so every field must be carried even when only one changes.
function annotationState(a) {
  return {
    quote: a.quote || '',
    note: a.note || '',
    chapter: a.chapter || '',
    location: a.location || '',
    color: a.color || 'yellow',
    tags: a.tags || [],
    favorite: !!a.favorite,
    rating: a.rating || 0,
  }
}

// ReviewPanel walks the imported annotations missing chapter or location, one
// at a time (PLAN §5b): fill in the blanks, skip one, or skip all to close.
function ReviewPanel({ queue, onDone }) {
  const [idx, setIdx] = useState(0)
  const [chapter, setChapter] = useState(queue[0].ann.chapter || '')
  const [location, setLocation] = useState(queue[0].ann.location || '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const current = queue[idx]

  function goto(i) {
    if (i >= queue.length) return onDone()
    setIdx(i)
    setChapter(queue[i].ann.chapter || '')
    setLocation(queue[i].ann.location || '')
    setError('')
  }

  async function saveNext() {
    setBusy(true)
    setError('')
    // Re-fetch the annotation's current state before the full-state PUT so we
    // don't revert fields edited elsewhere while this panel was open (the
    // queue is a batch-time snapshot).
    const fresh = await json('GET', `/annotations?book_id=${current.bookId}`)
    const base = (fresh.ok && fresh.data.annotations.find((a) => a.id === current.ann.id)) || current.ann
    const r = await json('PUT', `/annotations/${current.ann.id}`, {
      ...annotationState(base),
      chapter: chapter.trim(),
      location: location.trim(),
    })
    setBusy(false)
    if (!r.ok) return setError(errText(r, 'could not save annotation'))
    goto(idx + 1)
  }

  return (
    <HandCard variant={3} className="space-y-4 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="text-base font-semibold">Review imported quotes</h3>
        <MonoLabel>
          {idx + 1} of {queue.length} missing chapter / location
        </MonoLabel>
      </div>
      <p
        className="whitespace-pre-wrap"
        style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 16.5 }}
      >
        “{current.ann.quote || current.ann.note}”
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Chapter"
          placeholder="The Turning Point"
          value={chapter}
          onChange={(e) => setChapter(e.target.value)}
        />
        <Field label="Location" placeholder="p.—" value={location} onChange={(e) => setLocation(e.target.value)} />
      </div>
      <ErrorText>{error}</ErrorText>
      <div className="flex flex-wrap items-center gap-2">
        <button className="tp-btn tp-btn-primary" onClick={saveNext} disabled={busy}>
          Save & next
        </button>
        <GhostButton onClick={() => goto(idx + 1)} disabled={busy}>
          Skip
        </GhostButton>
        <GhostButton onClick={onDone} disabled={busy}>
          Skip all
        </GhostButton>
      </div>
    </HandCard>
  )
}
