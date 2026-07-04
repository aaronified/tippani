import { useState } from 'react'
import { json, upload, errText } from './api.js'
import {
  ErrorText,
  Field,
  GhostButton,
  HandCard,
  MonoLabel,
  PageHeader,
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
    desc: 'Frontmatter or Readest export — shape auto-detected.',
    accept: '.md,.markdown,.txt',
  },
  {
    kind: 'bookcision',
    ext: '.json',
    title: 'Bookcision',
    desc: 'Kindle highlights, exported from the browser.',
    accept: '.json',
  },
  {
    kind: 'hardcover-html',
    ext: '.html',
    title: 'Hardcover',
    desc: 'A saved reading-journal page.',
    accept: '.htm,.html',
  },
]

export default function ImportPage() {
  const [results, setResults] = useState(null) // per-file rows, in batch order
  const [summary, setSummary] = useState('')
  const [queue, setQueue] = useState(null) // review pass: [{bookId, ann}]
  const [busy, setBusy] = useState(false)
  const ref = useReveal()

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
    // books this batch touched.
    const q = []
    for (const bookId of [...new Set(ok.map((r) => r.book_id))]) {
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
      <PageHeader title="Import" counts="bring the highlights home" />
      <div ref={ref} className="reveal grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {SOURCES.map((s, i) => (
          <SourceCard key={s.kind} {...s} variant={i} busy={busy} onFiles={(fs) => runBatch(s.kind, fs)} />
        ))}
        <DisabledCard />
      </div>
      {results && <BatchResults results={results} summary={summary} />}
      {queue && <ReviewPanel queue={queue} onDone={() => setQueue(null)} />}
    </section>
  )
}

// ExtBadge is the small mono file-extension chip on each source card.
function ExtBadge({ muted, children }) {
  return (
    <span
      className="mono-label self-start"
      style={{
        color: muted ? 'var(--faint)' : 'var(--accent-ui)',
        border: `1.2px solid ${muted ? 'var(--line)' : 'color-mix(in srgb, var(--accent) 45%, transparent)'}`,
        borderRadius: 7,
        padding: '3px 8px',
      }}
    >
      {children}
    </span>
  )
}

// SourceCard accepts multi-select via the hidden input and drag-drop of many
// files anywhere on the card.
function SourceCard({ variant, ext, title, desc, accept, busy, onFiles }) {
  const [over, setOver] = useState(false)
  return (
    <HandCard
      variant={variant}
      className="flex flex-col gap-3 p-5"
      style={over ? { borderColor: 'var(--accent-ui)' } : undefined}
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
      <ExtBadge>{ext}</ExtBadge>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="text-sm" style={{ color: 'var(--soft)' }}>
        {desc}
      </p>
      <label
        className="tp-btn tp-btn-ghost mt-auto"
        style={busy ? { opacity: 0.55, cursor: 'default' } : { cursor: 'pointer' }}
      >
        Choose files — or drop many
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
function BatchResults({ results, summary }) {
  return (
    <div className="hand-card hc-r2 space-y-1.5 p-4" style={{ borderLeft: '4px solid var(--accent)' }}>
      {summary && (
        <p className="microcopy" style={{ color: 'var(--ink)' }}>
          {summary}
        </p>
      )}
      {results.map((r, i) => (
        <p key={i} className="microcopy">
          {r.name} →{' '}
          {r.pending ? (
            '…'
          ) : r.ok ? (
            `${r.added} added · ${r.skipped} skipped` + (r.enriched ? ` · ${r.enriched} enriched` : '')
          ) : (
            <span style={{ color: 'var(--error)' }}>{r.error}</span>
          )}
        </p>
      ))}
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
