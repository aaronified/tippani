import { useCallback, useEffect, useRef, useState } from 'react'
import { json } from './api.js'
import { t } from './i18n.js'
import { Card, GhostButton, IconRefresh, IconStop, InfoDot, MonoLabel } from './ui.jsx'
import { actionsFor } from './actions.jsx'
import {
  FoundFileRow,
  LoadFailed,
  QUICK_MS,
  SourceFileRow,
  canTakeSource,
  goTo,
  sourceFail,
  sourceSubject,
  useSourceActions,
  useSourceDoor,
  useSourcesChanged,
} from './sources.jsx'
import { useLibraryScan } from './libraryScan.js'

// Metadata > Source files: every work that has quotes, and the file its quotes came from.
//
// This is the base for source files; a work's own panel shows the same rows for one work,
// and Checks > Found files is where scan findings are reviewed in bulk. At the top are the
// library folders, the Scan that walks them (the same hook Checks uses, so both show the
// same progress and the same failures), and how many works have a file.
//
// A SHOW'S FILES ARE PER EPISODE, so a show lists each episode's file under it.
// `scanOnArrival` is the phone's Scan shortcut: one scan of every folder, once.

const FILTERS = ['all', 'none', 'has', 'found']

// The works that can take a file and have quotes to give context to.
function worksOf(lib) {
  const out = []
  for (const b of lib?.books || []) {
    if (b.annotation_count > 0) out.push({ kind: 'book', item: { id: b.id, title: b.title }, quotes: b.annotation_count })
  }
  for (const m of lib?.movies || []) {
    const item = { id: m.id, title: m.title, media_type: m.media_type }
    if (m.dialogue_count > 0 && canTakeSource('movie', item)) out.push({ kind: 'movie', item, quotes: m.dialogue_count })
  }
  return out
}

export default function SourceFilesConsole({ lib, onOpenBook, onOpenMovie, scanOnArrival = false, onArrived }) {
  const scan = useLibraryScan()
  const [files, setFiles] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [tick, setTick] = useState(0)
  const [filter, setFilter] = useState('all')
  const reload = useCallback(() => setTick((n) => n + 1), [])
  useSourcesChanged(reload)
  const acts = useSourceActions(reload)
  const door = useSourceDoor(reload)

  useEffect(() => {
    let live = true
    json('GET', '/sources/all', undefined, { timeoutMs: QUICK_MS }).then((r) => {
      if (!live) return
      if (r.ok) setFiles(r.data?.sources || [])
      setLoadError(r.ok ? '' : t('files.error.load', { why: sourceFail(r) }))
    })
    return () => {
      live = false
    }
  }, [tick])

  // THE SHORTCUT'S SCAN, ONCE, when the folder list is known: with no folders the scan
  // says so itself (useLibraryScan), and a reload of the page does not scan again because
  // the address has already lost its ?scan=1.
  const arrived = useRef(false)
  useEffect(() => {
    if (!scanOnArrival || arrived.current || scan.mounts === null) return
    arrived.current = true
    scan.scan()
    onArrived?.()
  }, [scanOnArrival, scan.mounts]) // eslint-disable-line react-hooks/exhaustive-deps

  const works = worksOf(lib).map((w) => {
    const subject = sourceSubject(w.kind)
    return {
      ...w,
      files: (files || []).filter((s) => s.subject === subject && s.subject_id === w.item.id),
      found: (scan.found || []).filter((c) => c.subject === subject && c.work_id === w.item.id),
    }
  })
  const withFile = works.filter((w) => w.files.length > 0).length
  const shown = works.filter((w) =>
    filter === 'none' ? w.files.length === 0 : filter === 'has' ? w.files.length > 0 : filter === 'found' ? w.found.length > 0 : true,
  )
  const mounts = scan.mounts || []
  const sum = scan.sum

  return (
    <div className="flex flex-col gap-6" data-screen-label="source-files">
      <Card>
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <MonoLabel>{t('files.folders.title')}</MonoLabel>
            <InfoDot title={t('files.folders.title')} text={t('files.folders.info')} />
            <span className="flex-1" />
            {scan.scanning && (
              <GhostButton type="button" icon={<IconStop />} keepLabel className="tp-btn-danger" aria-label={t('found.stop.aria')} onClick={scan.stop}>
                <span>{t('found.stop')}</span>
              </GhostButton>
            )}
            {mounts.length > 0 && (
              <GhostButton type="button" disabled={scan.scanning || scan.starting} onClick={scan.scan}>
                <IconRefresh />
                <span>{scan.scanning ? t('found.scanning') : t('found.scan')}</span>
              </GhostButton>
            )}
          </div>
          {scan.mounts !== null && mounts.length === 0 && !scan.loadError && <p className="microcopy">{t('files.folders.none')}</p>}
          {mounts.length > 0 && <p>{mounts.map((m) => m.label).join(' · ')}</p>}
          {scan.found && (
            <p className="microcopy">{t('found.counts', { files: sum('scanned'), found: sum('found'), unclaimed: sum('unclaimed') })}</p>
          )}
          {scan.loadError && <LoadFailed text={scan.loadError} onRetry={scan.mounts?.length ? scan.reload : scan.retry} />}
          {scan.badLines.map((line) => (
            <p key={line} className="microcopy" role="alert" style={{ color: 'var(--error)' }}>{line}</p>
          ))}
          <p className="microcopy flex flex-wrap gap-3">
            <button type="button" className="tp-link" onClick={() => goTo('/settings/server')}>
              {t('files.folders.settings')}
            </button>
            <button type="button" className="tp-link" onClick={() => goTo('/checks')}>
              {t('files.folders.checks')}
            </button>
          </p>
        </div>
      </Card>

      {loadError && <LoadFailed text={loadError} onRetry={reload} />}
      {files && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="microcopy">{t('files.counts', { with: withFile, without: works.length - withFile })}</span>
            <span className="flex-1" />
            <div className="flex flex-wrap gap-2" role="group" aria-label={t('files.filter.aria')}>
              {FILTERS.map((f) => (
                <button
                  key={f}
                  type="button"
                  className={`tp-filter-chip${filter === f ? ' active' : ''}`}
                  aria-pressed={filter === f}
                  onClick={() => setFilter(f)}
                >
                  {t(`files.filter.${f}`)}
                </button>
              ))}
            </div>
          </div>
          {shown.length === 0 && <p className="microcopy">{t('files.empty')}</p>}
          {shown.map((w) => (
            <WorkFiles
              key={`${w.kind}:${w.item.id}`}
              w={w}
              acts={acts}
              scan={scan}
              onAdd={() => door.add(w.kind, w.item)}
              onOpen={() => (w.kind === 'book' ? onOpenBook : onOpenMovie)?.(w.item.id)}
            />
          ))}
        </>
      )}
      {door.node}
      {acts.confirmDialog}
    </div>
  )
}

// One work: its name, its files (or that it has none), what a scan found for it, and the
// add verb from the registry, drawn as Add or Replace.
function WorkFiles({ w, acts, scan, onAdd, onOpen }) {
  const add = actionsFor(w.kind, w.item, { addSource: onAdd }).find((a) => a.id === 'sourceAdd')
  const held = w.files.length > 0
  const show = w.item.media_type === 'show'
  const kindWord = t(w.kind === 'book' ? 'files.kind.book' : w.item.media_type === 'show' ? 'files.kind.show' : 'files.kind.film')
  return (
    <Card>
      <div className="flex flex-col gap-3" data-testid="source-work">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="tp-link min-w-0" onClick={onOpen}>
            <b>{w.item.title}</b>
          </button>
          <span className="microcopy">{kindWord}</span>
          <span className="flex-1" />
          {add && (
            <GhostButton type="button" onClick={add.run} title={add.tooltip}>
              {add.icon}
              <span>{held && w.item.media_type !== 'show' ? t('common.source.replace') : add.label}</span>
            </GhostButton>
          )}
        </div>
        {!held && <p className="microcopy">{t('files.missing', { count: w.quotes, n: w.quotes })}</p>}
        {/* A show's quotes span its episodes, so its count is over all its files. */}
        {held && show && (
          <p className="microcopy">{t('common.source.context', { n: w.files.reduce((n, s) => n + (s.with_context || 0), 0), total: w.quotes, count: w.quotes })}</p>
        )}
        {w.files.map((s) => (
          <SourceFileRow key={s.id} s={s} withContext={s.with_context} quotes={show ? 0 : w.quotes} acts={acts} />
        ))}
        {w.found.map((c) => (
          <FoundFileRow
            key={c.token}
            c={c}
            folder={(scan.mounts || []).find((m) => m.id === c.mount)?.label || c.mount}
            busy={acts.busy || scan.busy}
            onAttach={() => scan.attach(c.bucket, [c])}
            onRefuse={() => scan.refuse([c])}
          />
        ))}
      </div>
    </Card>
  )
}
