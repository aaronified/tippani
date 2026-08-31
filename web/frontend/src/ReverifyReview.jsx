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
import { t } from './i18n.js'

import {
  CloseButton,
  EmptyState,
  ErrorText,
  GhostButton,
  HandCard,
  MobileSheet,
  MonoLabel,
  NameScroll,
  ProgressBar,
  sourceName,
  Tooltip,
  useBodyScrollLock,
  useIsMobileScreen,
} from './ui.jsx'

const CHUNK = 10 // items per preview call (server caps at 15)
const IMAGE_FIELDS = new Set(['cover', 'poster', 'portrait'])
// FIELD_KEYS — the server's field token, to the shared key that names it for a
// reader. A table rather than a key built from the token, because the two
// genuinely differ: published_year and release_year are both "Year", series_index
// is "Series #", and a token with no row should fall through to something legible
// rather than resolve to a missing key.
//
// The nine that had no word anywhere in the app before this — cast, portrait,
// bio, born, died, links, identity and the two ids — were added to common.field.*
// rather than keyed here, because a field's name is the same field's name
// wherever it is drawn.
const FIELD_KEYS = {
  title: 'common.field.title.label',
  author: 'common.field.author.label',
  description: 'common.field.description.label',
  published_year: 'common.field.year.label',
  release_year: 'common.field.year.label',
  series: 'common.field.series.label',
  series_index: 'common.field.series-no.label',
  isbn: 'common.field.isbn.label',
  genres: 'common.field.genres.label',
  cover: 'common.field.cover.label',
  poster: 'common.field.poster.label',
  director: 'common.field.director.label',
  cast: 'common.field.cast.label',
  portrait: 'common.field.portrait.label',
  bio: 'common.field.bio.label',
  born: 'common.field.born.label',
  died: 'common.field.died.label',
  links: 'common.field.links.label',
  identity: 'common.field.identity.label',
  tmdb_id: 'common.field.tmdb-id.label',
  tvdb_id: 'common.field.tvdb-id.label',
}

// fieldName — the reader's word for a diff row. The fallback is the old
// behaviour, kept for a field a newer server knows about and this build does not.
const fieldName = (field) =>
  FIELD_KEYS[field] ? t(FIELD_KEYS[field]) : String(field).replace(/_/g, ' ')

// STATUS_KEYS — why an item had nothing checked, or could not be.
const STATUS_KEYS = {
  unpinned: 'reverify.status.unpinned',
  fetch_failed: 'reverify.status.fetch-failed',
  not_found: 'reverify.status.not-found',
}

// kindLabel — the chip beside an item's name. A work is named by its media kind,
// a person by the role they were credited in, and both vocabularies already
// exist elsewhere in the app.
const kindLabel = (item) =>
  item.type === 'person'
    ? t(`common.field.${item.kind}.label`)
    : t(`vocab.kind.${item.type}.label`)

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
      <span className="block" style={{ fontSize: 'var(--type-ui-12)' }}>
        {value.slice(0, 6).map((m, i) => (
          <NameScroll key={i} className="block">{m.character || '—'} · {m.actor || '—'}</NameScroll>
        ))}
        {value.length > 6 && (
          <span className="microcopy">{t('reverify.value.more', { n: value.length - 6 })}</span>
        )}
      </span>
    )
  }
  // Long text (descriptions, link lists) clamps; the full value is in `title`.
  return (
    <span
      title={String(value)}
      style={{
        display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical',
        overflow: 'hidden', fontSize: 'var(--type-ui-13)', lineHeight: 1.45, overflowWrap: 'anywhere', whiteSpace: 'pre-line',
      }}
    >
      {String(value)}
    </span>
  )
}

// FieldDiffRow — what is stored, beside what each supplier says.
//
// IT USED TO BE TWO COLUMNS: stored, and "fresh". That shape encoded the old
// model, where a record took every field from ONE supplier chosen for the whole
// row — so there was only ever one fresh value and a checkbox was enough to say
// yes to it. With a work asked of every supplier it is pinned to, one field can
// have two answers that disagree, and the reader is choosing a SOURCE as much as
// a value.
//
// SO EACH SUPPLIER GETS ITS OWN CELL and picking one takes the field. The
// checkbox stays for the single-answer case — most fields, most of the time —
// and picking a cell ticks it, because requiring both would make the common
// gesture two gestures for no meaning.
//
// The cells are the same component in the same grid whatever the kind of work.
// A book's suppliers and a film's are different names in the same layout, which
// is the point: there is one reviewer and it does not know what it is reviewing.
function FieldDiffRow({ diff, picked, onToggle, onChoose }) {
  const alts = diff.alts || []
  const choosing = alts.length > 1
  return (
    <div className="flex items-start gap-3 py-2" style={{ borderTop: '1px solid var(--line)' }}>
      <label className="flex items-center gap-2" style={{ cursor: 'pointer', flex: 'none', paddingTop: 2 }}>
        <Tooltip label={t('reverify.field.approve.tip')} side="top">
          <input type="checkbox" checked={!!picked} onChange={onToggle} />
        </Tooltip>
        <MonoLabel style={{ width: 92 }}>{fieldName(diff.field)}</MonoLabel>
      </label>
      <div
        className="grid min-w-0 flex-1 gap-2"
        style={{ gridTemplateColumns: `repeat(${choosing ? alts.length + 1 : 2}, minmax(0, 1fr))` }}
      >
        <div className="min-w-0">
          <MonoLabel className="mb-1 block" style={{ fontSize: 'var(--type-ui-9)', color: 'var(--faint)' }}>
            {t('reverify.column.stored')}
          </MonoLabel>
          <ValueCell field={diff.field} value={diff.stored} />
        </div>
        {choosing ? (
          alts.map((a) => {
            const on = picked === a.source
            return (
              <button
                key={a.source}
                type="button"
                onClick={() => onChoose(a.source)}
                aria-pressed={on}
                className="min-w-0 text-left"
                style={{
                  background: 'none', padding: '2px 6px', cursor: 'pointer',
                  border: `1px solid ${on ? 'var(--accent)' : 'transparent'}`,
                  borderRadius: 6,
                }}
              >
                <MonoLabel className="mb-1 block" style={{ fontSize: 'var(--type-ui-9)', color: on ? 'var(--accent-ui)' : 'var(--faint)' }}>
                  {sourceName(a.source)}
                </MonoLabel>
                <ValueCell field={diff.field} value={a.value} fresh={on} />
              </button>
            )
          })
        ) : (
          <div className="min-w-0">
            <MonoLabel className="mb-1 block" style={{ fontSize: 'var(--type-ui-9)', color: 'var(--accent-ui)' }}>
              {t('reverify.column.fresh')}
            </MonoLabel>
            <ValueCell field={diff.field} value={diff.fresh} fresh />
          </div>
        )}
      </div>
    </div>
  )
}

function ReverifyItemCard({ item, open, onToggleOpen, approvals, onToggleField, onChooseSource, onSetAll }) {
  const key = itemKey(item)
  const approvedCount = item.diffs.filter((d) => approvals[`${key}|${d.field}`]).length
  const kindChip = kindLabel(item)
  return (
    <HandCard className="px-4 py-3">
      <Tooltip label={t('reverify.item.open.tip')} side="top" className="w-full">
        <button
          type="button"
          className="flex w-full items-center gap-2 text-left"
          style={{ background: 'none', border: 'none', padding: 0 }}
          onClick={onToggleOpen}
          aria-expanded={open}
        >
          <NameScroll className="min-w-0 font-semibold" style={{ fontFamily: 'var(--font-display)', fontWeight: 'var(--font-display-weight)', fontStyle: 'var(--font-display-style)', fontVariantCaps: 'var(--font-display-caps)', textTransform: 'var(--font-display-case)', fontVariantNumeric: 'var(--font-display-figures)', fontSize: 'var(--type-display-15)' }}>
            {item.title || item.name}
          </NameScroll>
          <MonoLabel style={{ fontSize: 'var(--type-display-9)', flex: 'none' }}>{kindChip}{item.source ? ` · ${item.source}` : ''}</MonoLabel>
          <MonoLabel className="ml-auto" style={{ fontSize: 'var(--type-ui-11)', color: 'var(--accent-ui)', flex: 'none' }}>
            {t('reverify.item.approved', { n: approvedCount, total: item.diffs.length })}{' '}
            {open ? '▾' : '▸'}
          </MonoLabel>
        </button>
      </Tooltip>
      {open && (
        <div className="mt-2">
          <div className="mb-1 flex justify-end gap-3">
            <button type="button" className="tp-link" style={{ fontSize: 'var(--type-ui-11)' }} onClick={() => onSetAll(item, true)}>
              {t('reverify.item.approve-all')}
            </button>
            <button type="button" className="tp-link" style={{ fontSize: 'var(--type-ui-11)' }} onClick={() => onSetAll(item, false)}>
              {t('reverify.item.approve-none')}
            </button>
          </div>
          {item.diffs.map((d) => (
            <FieldDiffRow
              key={d.field}
              diff={d}
              picked={approvals[`${key}|${d.field}`]}
              onToggle={() => onToggleField(item, d.field)}
              onChoose={(src) => onChooseSource(item, d.field, src)}
            />
          ))}
        </div>
      )}
    </HandCard>
  )
}

export function ReverifyFlow({ selection, onClose, onFlash, onDone }) {
   // The page behind an overlay does not move. Without this a wheel or a swipe
  // running past the end of the dialog scrolls the page you cannot see, which is
  // still scrolled when you close this. Ref-counted, so a dialog opened from
  // inside a sheet does not unlock the sheet on its way out.
  useBodyScrollLock(true)

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
            setErr(errText(r, t('error.reverify.preview')))
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
        setErr(t('error.reverify.interrupted'))
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

  // AN APPROVAL IS NOW A CHOICE OF SOURCE, not a yes/no.
  //
  // A work pinned to two suppliers is asked of both, so a field can carry what
  // each of them said and the reader can take the description from one and the
  // year from another. The state therefore holds WHICH source was picked rather
  // than whether the row was ticked: `undefined` is untaken, and a supplier slug
  // is taken-from-that-supplier.
  //
  // A field with no alternatives still works exactly as before — ticking it
  // stores the preferred source's slug, which is the same value it always sent,
  // now merely labelled.
  function defaultSourceFor(item, diff) {
    return diff.alts?.[0]?.source || item.source || ''
  }
  function toggleField(item, field) {
    const k = `${itemKey(item)}|${field}`
    const d = item.diffs.find((x) => x.field === field)
    setApprovals((a) => ({ ...a, [k]: a[k] ? undefined : defaultSourceFor(item, d) }))
  }
  function chooseSource(item, field, source) {
    const k = `${itemKey(item)}|${field}`
    // PICKING A SOURCE TAKES THE FIELD. Requiring a tick as well would make the
    // common gesture two gestures, and there is no meaning to "I choose TheTVDB's
    // description but do not want it".
    setApprovals((a) => ({ ...a, [k]: a[k] === source ? undefined : source }))
  }
  function setAllFields(item, on) {
    setApprovals((a) => {
      const next = { ...a }
      for (const d of item.diffs) {
        next[`${itemKey(item)}|${d.field}`] = on ? defaultSourceFor(item, d) : undefined
      }
      return next
    })
  }

  async function apply() {
    const payload = changed
      .map((it) => {
        const set = {}
        const sources = {}
        for (const d of it.diffs) {
          const picked = approvals[`${itemKey(it)}|${d.field}`]
          if (!picked) continue
          // The value that BELONGS to the chosen source. Falling back to `fresh`
          // covers the ordinary single-source field, where fresh is by definition
          // the preferred supplier's answer.
          const alt = (d.alts || []).find((a) => a.source === picked)
          set[d.field] = alt ? alt.value : d.fresh
          sources[d.field] = picked
        }
        if (Object.keys(set).length === 0) return null
        return it.type === 'person'
          ? { type: 'person', kind: it.kind, name: it.name, set }
          : { type: it.type, id: it.id, set, sources, source: it.source }
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
          setErr(errText(r, t('error.reverify.apply')))
          setPhase('review')
          return
        }
        all.push(...(r.data.results || []))
      }
    } catch {
      setErr(t('error.reverify.apply-interrupted'))
      setPhase('review')
      return
    }
    setResults(all)
    setPhase('done')
    const okCount = all.filter((x) => x.ok).length
    const failCount = all.length - okCount
    const notes = all.filter((x) => x.note).length
    // Joined here for the same reason as the summary line above.
    onFlash?.(
      [
        t('reverify.flash', { count: okCount, n: okCount }),
        failCount && t('reverify.flash.failed', { n: failCount }),
        notes && t('reverify.flash.skipped', { count: notes, n: notes }),
      ]
        .filter(Boolean)
        .join(' · '),
    )
    onDone?.()
  }

  const body = (
    <div className="space-y-3">
      {phase === 'checking' && (
        <>
          <p className="microcopy">{t('reverify.checking.prose')}</p>
          <ProgressBar
            value={progress.done}
            max={progress.total}
            label={t('reverify.checking.progress', { done: progress.done, total: progress.total })}
          />
        </>
      )}
      {phase !== 'checking' && (
        <MonoLabel className="block" style={{ fontSize: 'var(--type-ui-11)' }}>
          {/* THE SEPARATOR IS JOINED HERE, NOT CARRIED IN THE VALUE. These three
              read as one middot-joined line, and the first draft put the " · "
              at the head of each tail value — where parseLocale trims it off,
              silently, so the line came out as "9 up to date· 2 skipped". A
              locale value cannot hold leading punctuation; the code owns it. */}
          {[
            t('reverify.summary', { checked: items.length, changed: changed.length, clean }),
            skipped > 0 && t('reverify.summary.skipped', { n: skipped }),
            failedCount > 0 && t('reverify.summary.failed', { n: failedCount }),
          ]
            .filter(Boolean)
            .join(' · ')}
        </MonoLabel>
      )}
      <ErrorText>{err}</ErrorText>
      {(phase === 'review' || phase === 'applying') && changed.length === 0 && (
        <EmptyState>{t('reverify.clean')}</EmptyState>
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
            onChooseSource={chooseSource}
            onSetAll={setAllFields}
          />
        ))}
      {(phase === 'review' || phase === 'applying') &&
        items.filter((it) => it.status === 'fetch_failed' || it.status === 'unpinned' || it.status === 'not_found')
          .map((it) => (
            <p key={itemKey(it)} className="microcopy">
              {it.title || it.name}:{' '}
              {it.error || (STATUS_KEYS[it.status] ? t(STATUS_KEYS[it.status]) : it.status)}
            </p>
          ))}
      {phase === 'done' && results && (
        <div className="space-y-1">
          {results.map((x, i) => (
            <p key={i} className="microcopy" style={x.ok ? undefined : { color: 'var(--error)' }}>
              {x.type} {x.id || x.name}:{' '}
              {x.ok
                ? x.note
                  ? t('reverify.result.applied-note', { note: x.note })
                  : t('reverify.result.applied')
                : x.error}
            </p>
          ))}
        </div>
      )}
    </div>
  )

  const footer = (
    <div className="flex w-full items-center gap-3">
      {phase === 'done' ? (
        <button type="button" className="tp-btn tp-btn-primary tactile ml-auto" onClick={onClose}>
          {t('common.action.close.label')}
        </button>
      ) : (
        <>
          <GhostButton onClick={onClose}>{t('common.action.cancel.label')}</GhostButton>
          <button
            type="button"
            className="tp-btn tp-btn-primary tactile ml-auto"
            disabled={phase !== 'review' || approvedTotal === 0}
            onClick={apply}
          >
            {phase === 'applying'
              ? t('reverify.apply.busy')
              : t('reverify.apply.label', { count: approvedTotal, n: approvedTotal })}
          </button>
        </>
      )}
    </div>
  )

  if (mobile) {
    return (
      <MobileSheet open onClose={onClose} title={t('reverify.title')} footer={footer}>
        {body}
      </MobileSheet>
    )
  }
  return (
    <div
      className="tp-scrim fixed inset-0 z-50 overflow-y-auto px-4 py-10"
      role="dialog"
      aria-modal="true"
      aria-label={t('reverify.title')}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <HandCard variant={1} className="mx-auto w-full max-w-3xl px-6 py-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="display-title text-xl">{t('reverify.title')}</h2>
          <CloseButton onClick={onClose} />
        </div>
        {body}
        <div className="mt-4" style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
          {footer}
        </div>
      </HandCard>
    </div>
  )
}
