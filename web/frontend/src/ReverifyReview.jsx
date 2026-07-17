// Force-fetch & re-verify (ROADMAP §2) — the review-before-apply flow. Takes a
// selection ({book_ids, movie_ids, people}), previews it against the live
// sources in small sequential chunks (POST /metadata/reverify — nothing
// written, real progress), then presents every changed field as a stored-vs-
// fresh row with an approve checkbox. "Apply approved" resends exactly the
// approved values (POST /metadata/reverify/apply). Pure fills (stored empty)
// default to approved; anything that would overwrite defaults to unticked —
// reviewing is the point. One component serves both form factors: a MobileSheet
// on phones, a centered scrollable overlay on desktop.
import { useEffect, useRef, useState } from 'react'
import { coverImgURL, errText, json } from './api.js'
import {
  EmptyState,
  ErrorText,
  GhostButton,
  HandCard,
  MobileSheet,
  MonoLabel,
  ProgressBar,
  useIsMobileScreen,
} from './ui.jsx'

const CHUNK = 10 // items per preview call (server caps at 15)
const IMAGE_FIELDS = new Set(['cover', 'poster', 'portrait'])

// itemKey identifies one previewed item across the approval state maps.
const itemKey = (it) => (it.type === 'person' ? `person:${it.kind}:${it.name}` : `${it.type}:${it.id}`)

// emptyStored — a "pure fill": approving it can't lose anything, so it
// defaults to ticked; overwrites default to unticked.
function emptyStored(v) {
  if (v == null || v === '' || v === 0) return true
  return Array.isArray(v) && v.length === 0
}

function ValueCell({ field, value, fresh }) {
  if (value == null || value === '' || (Array.isArray(value) && value.length === 0)) {
    return <span className="microcopy">—</span>
  }
  if (IMAGE_FIELDS.has(field)) {
    // Stored images are local files; fresh ones are provider URLs (all on the
    // CSP img-src allowlist).
    return (
      <img
        src={fresh ? value : coverImgURL(value)}
        alt=""
        loading="lazy"
        style={{ width: 68, aspectRatio: '2 / 3', objectFit: 'cover', borderRadius: 6, border: '1px solid var(--ink-border)' }}
      />
    )
  }
  if (field === 'genres') {
    return (
      <span className="flex flex-wrap gap-1">
        {value.map((g) => <span key={g} className="tp-chip">{g}</span>)}
      </span>
    )
  }
  if (field === 'cast') {
    return (
      <span className="block" style={{ fontSize: 12 }}>
        {value.slice(0, 6).map((m, i) => (
          <span key={i} className="block truncate">{m.character || '—'} · {m.actor || '—'}</span>
        ))}
        {value.length > 6 && <span className="microcopy">+{value.length - 6} more</span>}
      </span>
    )
  }
  // Long text (descriptions, link lists) clamps; the full value is in `title`.
  return (
    <span
      title={String(value)}
      style={{
        display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical',
        overflow: 'hidden', fontSize: 13, lineHeight: 1.45, overflowWrap: 'anywhere', whiteSpace: 'pre-line',
      }}
    >
      {String(value)}
    </span>
  )
}

function FieldDiffRow({ diff, approved, onToggle }) {
  return (
    <div className="flex items-start gap-3 py-2" style={{ borderTop: '1px solid var(--line)' }}>
      <label className="flex items-center gap-2" style={{ cursor: 'pointer', flex: 'none', paddingTop: 2 }}>
        <input type="checkbox" checked={approved} onChange={onToggle} />
        <MonoLabel style={{ width: 92 }}>{diff.field.replace(/_/g, ' ')}</MonoLabel>
      </label>
      <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
        <div className="min-w-0">
          <MonoLabel className="mb-1 block" style={{ fontSize: 9, color: 'var(--faint)' }}>STORED</MonoLabel>
          <ValueCell field={diff.field} value={diff.stored} />
        </div>
        <div className="min-w-0">
          <MonoLabel className="mb-1 block" style={{ fontSize: 9, color: 'var(--accent-ui)' }}>FRESH</MonoLabel>
          <ValueCell field={diff.field} value={diff.fresh} fresh />
        </div>
      </div>
    </div>
  )
}

function ReverifyItemCard({ item, open, onToggleOpen, approvals, onToggleField, onSetAll }) {
  const key = itemKey(item)
  const approvedCount = item.diffs.filter((d) => approvals[`${key}|${d.field}`]).length
  const kindChip = item.type === 'person' ? item.kind : item.type
  return (
    <HandCard className="px-4 py-3">
      <button
        type="button"
        className="flex w-full items-center gap-2 text-left"
        style={{ background: 'none', border: 'none', padding: 0 }}
        onClick={onToggleOpen}
        aria-expanded={open}
      >
        <span className="min-w-0 truncate font-semibold" style={{ fontFamily: 'var(--font-display)', fontSize: 15.5 }}>
          {item.title || item.name}
        </span>
        <MonoLabel style={{ fontSize: 9.5, flex: 'none' }}>{kindChip}{item.source ? ` · ${item.source}` : ''}</MonoLabel>
        <MonoLabel className="ml-auto" style={{ fontSize: 10, color: 'var(--accent-ui)', flex: 'none' }}>
          {approvedCount}/{item.diffs.length} approved {open ? '▾' : '▸'}
        </MonoLabel>
      </button>
      {open && (
        <div className="mt-2">
          <div className="mb-1 flex justify-end gap-3">
            <button type="button" className="tp-link" style={{ fontSize: 11 }} onClick={() => onSetAll(item, true)}>approve all</button>
            <button type="button" className="tp-link" style={{ fontSize: 11 }} onClick={() => onSetAll(item, false)}>none</button>
          </div>
          {item.diffs.map((d) => (
            <FieldDiffRow
              key={d.field}
              diff={d}
              approved={!!approvals[`${key}|${d.field}`]}
              onToggle={() => onToggleField(item, d.field)}
            />
          ))}
        </div>
      )}
    </HandCard>
  )
}

export function ReverifyFlow({ selection, onClose, onFlash, onDone }) {
  const mobile = useIsMobileScreen()
  const [items, setItems] = useState([]) // previewed items, all statuses
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [phase, setPhase] = useState('checking') // checking | review | applying | done
  const [approvals, setApprovals] = useState({}) // "key|field" -> bool
  const [openItem, setOpenItem] = useState(null) // itemKey expanded
  const [results, setResults] = useState(null) // apply results
  const [err, setErr] = useState('')
  const cancelled = useRef(false)

  // Preview: slice the selection into small sequential chunks — frugal to the
  // providers, short requests, and a progress bar that means something.
  useEffect(() => {
    cancelled.current = false
    const queue = [
      ...(selection.book_ids || []).map((id) => ({ type: 'book', id })),
      ...(selection.movie_ids || []).map((id) => ({ type: 'movie', id })),
      ...(selection.people || []).map((p) => ({ type: 'person', kind: p.kind, name: p.name })),
    ]
    setProgress({ done: 0, total: queue.length })
    ;(async () => {
      const all = []
      const seed = {}
      // The whole loop is guarded: a network-level fetch rejection (wifi drop,
      // server restart) must land in the error line, not wedge "checking".
      try {
        for (let i = 0; i < queue.length; i += CHUNK) {
          if (cancelled.current) return
          const chunk = queue.slice(i, i + CHUNK)
          const body = {
            book_ids: chunk.filter((c) => c.type === 'book').map((c) => c.id),
            movie_ids: chunk.filter((c) => c.type === 'movie').map((c) => c.id),
            people: chunk.filter((c) => c.type === 'person').map((c) => ({ kind: c.kind, name: c.name })),
          }
          const r = await json('POST', '/metadata/reverify', body)
          if (cancelled.current) return
          if (!r.ok || !r.data) {
            setErr(errText(r, 'preview failed'))
            break
          }
          for (const it of r.data.items || []) {
            all.push(it)
            for (const d of it.diffs || []) {
              seed[`${itemKey(it)}|${d.field}`] = emptyStored(d.stored)
            }
          }
          setProgress({ done: Math.min(i + CHUNK, queue.length), total: queue.length })
        }
      } catch {
        if (cancelled.current) return
        setErr('the check was interrupted — check your connection and reopen Re-verify')
      }
      setItems(all)
      setApprovals(seed)
      const changed = all.filter((it) => it.status === 'ok' && (it.diffs || []).length > 0)
      if (changed.length === 1) setOpenItem(itemKey(changed[0]))
      setPhase('review')
    })()
    return () => {
      cancelled.current = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const changed = items.filter((it) => it.status === 'ok' && (it.diffs || []).length > 0)
  const clean = items.filter((it) => it.status === 'ok' && (it.diffs || []).length === 0).length
  const skipped = items.filter((it) => it.status === 'unpinned').length
  const failedCount = items.filter((it) => it.status === 'fetch_failed' || it.status === 'not_found').length
  const approvedTotal = changed.reduce(
    (n, it) => n + it.diffs.filter((d) => approvals[`${itemKey(it)}|${d.field}`]).length, 0)

  function toggleField(item, field) {
    const k = `${itemKey(item)}|${field}`
    setApprovals((a) => ({ ...a, [k]: !a[k] }))
  }
  function setAllFields(item, on) {
    setApprovals((a) => {
      const next = { ...a }
      for (const d of item.diffs) next[`${itemKey(item)}|${d.field}`] = on
      return next
    })
  }

  async function apply() {
    const payload = changed
      .map((it) => {
        const set = {}
        for (const d of it.diffs) {
          if (approvals[`${itemKey(it)}|${d.field}`]) set[d.field] = d.fresh
        }
        if (Object.keys(set).length === 0) return null
        return it.type === 'person'
          ? { type: 'person', kind: it.kind, name: it.name, set }
          : { type: it.type, id: it.id, set }
      })
      .filter(Boolean)
    if (payload.length === 0) return
    setPhase('applying')
    setErr('')
    const all = []
    // Guarded like the preview loop: a rejected fetch mid-apply returns to
    // review (with whatever already applied reported) instead of a stuck
    // "Applying…" button.
    try {
      for (let i = 0; i < payload.length; i += CHUNK) {
        const r = await json('POST', '/metadata/reverify/apply', { items: payload.slice(i, i + CHUNK) })
        if (!r.ok || !r.data) {
          setErr(errText(r, 'apply failed'))
          setPhase('review')
          return
        }
        all.push(...(r.data.results || []))
      }
    } catch {
      setErr('apply was interrupted — check your connection and try again (already-applied items stay applied)')
      setPhase('review')
      return
    }
    setResults(all)
    setPhase('done')
    const okCount = all.filter((x) => x.ok).length
    const failCount = all.length - okCount
    const notes = all.filter((x) => x.note).length
    onFlash?.(
      `re-verify: ${okCount} item(s) updated${failCount ? ` · ${failCount} failed` : ''}${notes ? ` · ${notes} image(s) skipped` : ''}`,
    )
    onDone?.()
  }

  const body = (
    <div className="space-y-3">
      {phase === 'checking' && (
        <>
          <p className="microcopy">
            re-checking each item against its pinned source — nothing is written until you approve it.
          </p>
          <ProgressBar value={progress.done} max={progress.total} label={`checking · ${progress.done}/${progress.total}`} />
        </>
      )}
      {phase !== 'checking' && (
        <MonoLabel className="block" style={{ fontSize: 10.5 }}>
          {items.length} checked · {changed.length} with changes · {clean} up to date
          {skipped > 0 && ` · ${skipped} skipped (no pinned id)`}
          {failedCount > 0 && ` · ${failedCount} failed`}
        </MonoLabel>
      )}
      <ErrorText>{err}</ErrorText>
      {(phase === 'review' || phase === 'applying') && changed.length === 0 && (
        <EmptyState>everything checked is already up to date ✓</EmptyState>
      )}
      {(phase === 'review' || phase === 'applying') &&
        changed.map((it) => (
          <ReverifyItemCard
            key={itemKey(it)}
            item={it}
            open={openItem === itemKey(it)}
            onToggleOpen={() => setOpenItem((k) => (k === itemKey(it) ? null : itemKey(it)))}
            approvals={approvals}
            onToggleField={toggleField}
            onSetAll={setAllFields}
          />
        ))}
      {(phase === 'review' || phase === 'applying') &&
        items.filter((it) => it.status === 'fetch_failed' || it.status === 'unpinned' || it.status === 'not_found')
          .map((it) => (
            <p key={itemKey(it)} className="microcopy">
              {it.title || it.name}: {it.error || it.status}
            </p>
          ))}
      {phase === 'done' && results && (
        <div className="space-y-1">
          {results.map((x, i) => (
            <p key={i} className="microcopy" style={x.ok ? undefined : { color: 'var(--error)' }}>
              {x.type} {x.id || x.name}: {x.ok ? `applied${x.note ? ` (${x.note})` : ''}` : x.error}
            </p>
          ))}
        </div>
      )}
    </div>
  )

  const footer = (
    <div className="flex w-full items-center gap-3">
      {phase === 'done' ? (
        <button type="button" className="tp-btn tp-btn-primary tactile ml-auto" onClick={onClose}>Close</button>
      ) : (
        <>
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <button
            type="button"
            className="tp-btn tp-btn-primary tactile ml-auto"
            disabled={phase !== 'review' || approvedTotal === 0}
            onClick={apply}
          >
            {phase === 'applying' ? 'Applying…' : `Apply ${approvedTotal} approved change(s)`}
          </button>
        </>
      )}
    </div>
  )

  if (mobile) {
    return (
      <MobileSheet open onClose={onClose} title="Re-verify metadata" footer={footer}>
        {body}
      </MobileSheet>
    )
  }
  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto px-4 py-10"
      style={{ background: 'rgba(21,16,12,.55)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Re-verify metadata"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <HandCard variant={1} className="mx-auto w-full max-w-3xl px-6 py-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="display-title text-xl">Re-verify metadata</h2>
          <GhostButton onClick={onClose}>Close</GhostButton>
        </div>
        {body}
        <div className="mt-4" style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
          {footer}
        </div>
      </HandCard>
    </div>
  )
}
