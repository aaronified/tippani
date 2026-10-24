import { useCallback, useEffect, useRef, useState } from 'react'
import { json } from './api.js'
import { t } from './i18n.js'
import { Card, GhostButton, IconArrow, IconButton, IconCheck, IconClose, IconRefresh, IconStop, InfoDot, SectionHead, toast } from './ui.jsx'
import { announceJobs, isLive, pressStop } from './jobs.js'
import { invalidateContext } from './sources.jsx'

// Files found in a mounted library, a section of Checks.
//
// The operator mounts the folders the library already lives in, read-only. One press of Scan
// starts a background job per folder that walks the whole folder, however large. Nothing is
// copied and nothing is attached on its own: findings are listed as "this file for this work",
// exact where an identifier matched and for a look where only a name did, and the reader accepts
// or refuses. A refusal is remembered.
//
// The server stores findings as it goes, so they appear here while the scan runs and are still
// here after a restart. This screen polls the scan's progress and reads the list again when the
// number found changes. No press, no scan, and the section draws nothing for a box with no
// folders mounted.

const POLL_MS = 1500

// One proposal per work across folders. Exact beats review; otherwise the first stays.
function oneEach(list) {
  const seen = new Map()
  for (const c of list) {
    const key = `${c.subject}:${c.work_id}:${c.episode || ''}`
    const cur = seen.get(key)
    if (!cur || (cur.bucket !== 'exact' && c.bucket === 'exact')) seen.set(key, c)
  }
  return [...seen.values()]
}

export default function FoundFilesPage({ embedded = false }) {
  const [mounts, setMounts] = useState(null)
  const [found, setFound] = useState(null) // null: nothing scanned yet
  const [scans, setScans] = useState({}) // folder id -> the scan's status
  const [busy, setBusy] = useState(false)
  const alive = useRef(true)
  const loadedCount = useRef({}) // folder id -> findings the list was last read with

  // Read every folder's findings and status.
  const load = useCallback(async (list) => {
    let all = []
    const next = {}
    for (const m of list) {
      const r = await json('GET', `/sources/found?mount_id=${encodeURIComponent(m.id)}`)
      if (!r.ok) continue
      next[m.id] = r.data.scan
      loadedCount.current[m.id] = r.data.scan?.found || 0
      all = all.concat(r.data.candidates || [])
    }
    if (!alive.current) return
    setScans(next)
    const any = Object.values(next).some((st) => st && st.state !== 'none')
    setFound(any || all.length ? oneEach(all) : null)
  }, [])

  useEffect(() => {
    alive.current = true
    json('GET', '/sources/mounts').then((r) => {
      if (!alive.current) return
      const list = r.ok ? r.data.mounts || [] : []
      setMounts(list)
      if (list.length) load(list)
    })
    return () => {
      alive.current = false
    }
  }, [load])

  const scanning = Object.values(scans).some(isLive)

  // While a scan runs, poll its progress. The list is read again when the count of findings
  // moves, and once more when the scan ends.
  useEffect(() => {
    if (!scanning || !mounts) return undefined
    const timer = setTimeout(async () => {
      let reload = false
      const next = { ...scans }
      for (const m of mounts) {
        if (!isLive(scans[m.id])) continue
        const r = await json('GET', `/sources/found?mount_id=${encodeURIComponent(m.id)}&status=1`)
        if (!r.ok) continue
        next[m.id] = r.data.scan
        if (!isLive(r.data.scan) || r.data.scan.found !== loadedCount.current[m.id]) reload = true
      }
      if (!alive.current) return
      if (reload) await load(mounts)
      else setScans(next)
    }, POLL_MS)
    return () => clearTimeout(timer)
  }, [scanning, scans, mounts, load])

  async function scan() {
    for (const m of mounts || []) {
      const r = await json('POST', '/sources/scan', { mount_id: m.id })
      if (!r.ok) toast(r.data?.error || t('common.source.error'))
    }
    announceJobs()
    if (alive.current) await load(mounts || [])
  }

  async function stop() {
    for (const st of Object.values(scans)) {
      if (isLive(st) && st.job_id) await pressStop(st.job_id)
    }
  }

  async function attach(bucket, list) {
    setBusy(true)
    const r = await json('POST', '/sources/attach-found', { bucket, tokens: list.map((c) => c.token) })
    setBusy(false)
    if (!r.ok) {
      toast(r.data?.error || t('common.source.error'))
      return
    }
    const { attached = 0, skipped = 0, failed = 0, context = {} } = r.data
    const placed = (context.matched || 0) + (context.skipped || 0)
    const total = placed + (context.ambiguous || 0) + (context.unmatched || 0)
    const parts = []
    if (attached) parts.push(t('found.attached', { n: attached, count: attached, found: placed, total }))
    if (failed) parts.push(t('found.failed', { n: failed, count: failed }))
    if (skipped) parts.push(t('found.skipped', { n: skipped, count: skipped }))
    if (parts.length) toast(parts.join(' · '))
    // ONLY THE ONES THAT ATTACHED GO. The server names them; the rest stay, to be retried or
    // refused, rather than vanishing with a count. Times proposed from the new files are now
    // waiting in the section below, and every card may now have context.
    const done = new Set(r.data.done || [])
    setFound((cur) => (cur || []).filter((c) => !done.has(c.token)))
    invalidateContext()
  }

  async function refuse(list) {
    setBusy(true)
    const r = await json('POST', '/sources/ignore-found', { tokens: list.map((c) => c.token) })
    setBusy(false)
    if (r.ok) {
      const gone = new Set(list.map((c) => c.token))
      setFound((cur) => (cur || []).filter((c) => !gone.has(c.token)))
    }
  }

  if (!mounts || mounts.length === 0) return null
  const sum = (key) => Object.values(scans).reduce((n, st) => n + (st?.[key] || 0), 0)
  const groups = [
    ['exact', (found || []).filter((c) => c.bucket === 'exact')],
    ['review', (found || []).filter((c) => c.bucket === 'review')],
  ].filter(([, list]) => list.length > 0)

  return (
    <>
      {embedded && <hr className="tp-rule" />}
      <section className="flex flex-col gap-6" data-screen-label="found-files">
        <SectionHead
          embedded={embedded}
          title={t('found.title')}
          counts={found ? t('found.counts', { files: sum('scanned'), found: sum('found'), unclaimed: sum('unclaimed') }) : ''}
          right={
            <>
              <InfoDot title={t('found.info.title')} text={t('found.info.body')} />
              {scanning && (
                <GhostButton type="button" icon={<IconStop />} keepLabel className="tp-btn-danger" aria-label={t('found.stop.aria')} onClick={stop}>
                  <span>{t('found.stop')}</span>
                </GhostButton>
              )}
              <GhostButton type="button" disabled={scanning} onClick={scan}>
                <IconRefresh />
                <span>{scanning ? t('found.scanning') : found ? t('found.rescan') : t('found.scan')}</span>
              </GhostButton>
            </>
          }
        />
        {found && (
          <Card>
            <div className="flex flex-col gap-6">
              {groups.length === 0 && !scanning && <p className="microcopy">{t('found.nothing')}</p>}
              {groups.map(([bucket, list]) => (
                <div key={bucket} className="flex flex-col gap-3" data-testid={`found-${bucket}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="mono-label">{t(`found.${bucket}.title`)}</h3>
                    <span className="microcopy">{t(`found.${bucket}.note`)}</span>
                    {bucket === 'exact' && (
                      <span className="ml-auto">
                        <GhostButton type="button" disabled={busy} onClick={() => attach('exact', list)}>
                          <IconCheck />
                          <span>{t('found.accept.all', { n: list.length })}</span>
                        </GhostButton>
                      </span>
                    )}
                  </div>
                  {list.map((c) => (
                    <div key={c.token} className="flex flex-wrap items-start gap-3" data-testid="found-row">
                      <div className="min-w-0 flex-1 flex flex-col gap-1">
                        <p>
                          <b>{c.title}</b>
                          {c.episode ? ` · ${c.episode.toUpperCase()}` : ''}
                          <span className="import-arrow"><IconArrow size={12} /></span>
                          <span className="microcopy">{t(`found.kind.${c.format}`)}</span>
                        </p>
                        <p className="microcopy" style={{ color: 'var(--soft)' }}>{c.rel}</p>
                        <p className="microcopy">{t(`found.how.${c.how}`)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <IconButton
                          icon={<IconCheck />}
                          ariaLabel={t('found.accept.aria', { title: c.title })}
                          tooltip={t('found.accept.tip')}
                          disabled={busy}
                          onClick={() => attach(c.bucket, [c])}
                        />
                        <IconButton
                          icon={<IconClose />}
                          ariaLabel={t('found.ignore.aria', { title: c.title })}
                          tooltip={t('found.ignore.tip')}
                          danger
                          disabled={busy}
                          onClick={() => refuse([c])}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </Card>
        )}
      </section>
    </>
  )
}
