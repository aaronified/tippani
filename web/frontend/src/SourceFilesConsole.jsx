import { useCallback, useEffect, useState } from 'react'
import { json } from './api.js'
import { t } from './i18n.js'
import { Card, Cover, GhostButton, IconChecks, IconRefresh, IconSourceFile, IconStop, InfoDot, MonoLabel, Tally, Tooltip } from './ui.jsx'
import MountedFilePicker from './MountedFilePicker.jsx'
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

const FILTERS = ['all', 'none', 'has', 'found']

// The works that can take a file and have quotes to give context to.
function worksOf(lib) {
  const out = []
  for (const b of lib?.books || []) {
    if (b.annotation_count > 0) out.push({ kind: 'book', item: { id: b.id, title: b.title }, quotes: b.annotation_count, cover: b.cover_path || '' })
  }
  for (const m of lib?.movies || []) {
    const item = { id: m.id, title: m.title, media_type: m.media_type }
    if (m.dialogue_count > 0 && canTakeSource('movie', item)) out.push({ kind: 'movie', item, quotes: m.dialogue_count, cover: m.poster_path || '' })
  }
  return out
}

export default function SourceFilesConsole({ lib, onOpenBook, onOpenMovie }) {
  const scan = useLibraryScan()
  const [files, setFiles] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [tick, setTick] = useState(0)
  const [filter, setFilter] = useState('all')
  const reload = useCallback(() => setTick((n) => n + 1), [])
  useSourcesChanged(reload)
  const acts = useSourceActions(reload)
  const door = useSourceDoor(reload)
  const [picking, setPicking] = useState(null) // the work a file is being chosen for, from a mounted folder

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
          {/* TWO COLUMNS ON A WIDE SCREEN, for the works only: the folders card above and the counts
              row stay full width. */}
          <div className="source-works">
            {shown.map((w) => (
              <WorkFiles
                key={`${w.kind}:${w.item.id}`}
                w={w}
                acts={acts}
                scan={scan}
                onAdd={() => door.add(w.kind, w.item)}
                onPick={mounts.length > 0 ? () => setPicking(w) : null}
                onOpen={() => (w.kind === 'book' ? onOpenBook : onOpenMovie)?.(w.item.id)}
              />
            ))}
          </div>
        </>
      )}
      {picking && <MountedFilePicker kind={picking.kind} item={picking.item} mounts={mounts} onClose={() => setPicking(null)} onDone={reload} />}
      {door.node}
      {acts.confirmDialog}
    </div>
  )
}

// One work: its name, its files (or that it has none), what a scan found for it, and the
// add verb from the registry, drawn as Add or Replace.
function WorkFiles({ w, acts, scan, onAdd, onPick, onOpen }) {
  const add = actionsFor(w.kind, w.item, { addSource: onAdd }).find((a) => a.id === 'sourceAdd')
  const held = w.files.length > 0
  const show = w.item.media_type === 'show'
  const kindWord = t(w.kind === 'book' ? 'files.kind.book' : w.item.media_type === 'show' ? 'files.kind.show' : 'files.kind.film')
  // A work that has a file takes no second one by hand (Replace is the way); a show takes one per episode.
  const canPick = onPick && (show || !held)
  return (
    <Card>
      <div className="flex gap-3" data-testid="source-work">
        {/* THE POSTER IS THE WAY INTO THE WORK, as it is on Stray marks. */}
        <Tooltip label={t('cleanup.row.open.tip')} side="top">
          <button type="button" className="cleanup-poster" aria-label={t('cleanup.row.open.aria', { label: w.item.title })} onClick={onOpen}>
            <Cover path={w.cover} title={w.item.title} />
          </button>
        </Tooltip>
        <div className="min-w-0 flex-1 flex flex-col gap-3">
        {/* NOT WRAPPED: the buttons stay on the right of the card, beside the name, at every width. */}
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <button type="button" className="tp-link min-w-0" onClick={onOpen}>
              <b>{w.item.title}</b>
            </button>{' '}
            <span className="microcopy">{kindWord}</span>
          </div>
          <div className="flex flex-none flex-wrap items-center justify-end gap-2">
            {canPick && (
              <GhostButton type="button" onClick={onPick}>
                <IconSourceFile />
                <span>{t('files.attach.folder')}</span>
              </GhostButton>
            )}
            {add && (
              <GhostButton type="button" onClick={add.run} title={add.tooltip}>
                {add.icon}
                <span>{held && w.item.media_type !== 'show' ? t('common.source.replace') : add.label}</span>
              </GhostButton>
            )}
          </div>
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
      </div>
    </Card>
  )
}

// ScanShortcuts — the two shortcuts a phone's index draws for the library folders, on
// Metadata > Source files and on Settings > Server: Scan (the same scan as the section's
// own button, with its progress and any failure) and Found files (Checks, with how many
// findings wait there). Nothing is drawn while no folder is set up.
export function ScanShortcuts() {
  const scan = useLibraryScan()
  if (!scan.mounts || scan.mounts.length === 0) return null
  const waiting = (scan.found || []).length
  return (
    <>
      <div className="section-index-verbs">
        <GhostButton icon={<IconRefresh />} keepLabel disabled={scan.scanning || scan.starting} onClick={scan.scan}>
          {scan.scanning ? t('found.scanning') : t('found.scan')}
        </GhostButton>
        <GhostButton icon={<IconChecks />} keepLabel onClick={() => goTo('/checks')}>
          {t('files.found.label')}
          {waiting > 0 && <Tally n={waiting} icon={<IconSourceFile />} word={t('files.found.word')} />}
        </GhostButton>
      </div>
      {scan.scanning && (
        <p className="microcopy">{t('found.counts', { files: scan.sum('scanned'), found: scan.sum('found'), unclaimed: scan.sum('unclaimed') })}</p>
      )}
      {scan.loadError && <LoadFailed text={scan.loadError} onRetry={scan.reload} />}
      {scan.badLines.map((line) => (
        <p key={line} className="microcopy" role="alert" style={{ color: 'var(--error)' }}>{line}</p>
      ))}
    </>
  )
}
