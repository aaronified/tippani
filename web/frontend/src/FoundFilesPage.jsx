import { useCallback, useEffect, useRef, useState } from 'react'
import { json } from './api.js'
import { t } from './i18n.js'
import { Card, GhostButton, IconArrow, IconButton, IconCheck, IconClose, IconRefresh, InfoDot, SectionHead, toast } from './ui.jsx'
import { invalidateContext } from './sources.jsx'

// Files found in a mounted library — a section of Checks.
//
// The operator mounts the folders the library already lives in, read-only, and the reader
// presses Scan. Nothing is copied and nothing is attached on its own: what the scan finds is
// listed as "this file for this work", exact where an identifier matched (a folder's id, an
// EPUB's ISBN) and for a look where only a name did, and the reader accepts or refuses.
// A refusal is remembered. THE SCAN IS NEVER AUTOMATIC: no press, no scan, and the section
// draws nothing for a box with no folders mounted.
//
// A LARGE LIBRARY IS A FEW REQUESTS, not one long wait or a background job: the server walks
// a bounded number of files and answers `truncated` with a cursor, and this loops on it,
// saying how far it has got. A silent truncation would read as a clean library.

const MAX_PASSES = 60

export default function FoundFilesPage({ embedded = false }) {
  const [mounts, setMounts] = useState(null)
  const [found, setFound] = useState(null) // null: not scanned yet
  const [scanned, setScanned] = useState(0)
  const [unclaimed, setUnclaimed] = useState(0)
  const [scanning, setScanning] = useState(false)
  const [busy, setBusy] = useState(false)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    json('GET', '/sources/mounts').then((r) => alive.current && setMounts(r.ok ? r.data.mounts || [] : []))
    return () => {
      alive.current = false
    }
  }, [])

  const scan = useCallback(async () => {
    setScanning(true)
    setFound([])
    setScanned(0)
    setUnclaimed(0)
    let all = []
    let files = 0
    let lost = 0
    for (const m of mounts || []) {
      let cursor = ''
      for (let pass = 0; pass < MAX_PASSES && alive.current; pass++) {
        const r = await json('POST', '/sources/scan', { mount_id: m.id, cursor })
        if (!r.ok) {
          toast(r.data?.error || t('common.source.error'))
          break
        }
        all = all.concat(r.data.candidates || [])
        files += r.data.scanned || 0
        lost += r.data.unclaimed || 0
        if (alive.current) {
          setFound(all)
          setScanned(files)
          setUnclaimed(lost)
        }
        if (!r.data.truncated) break
        cursor = r.data.cursor
      }
    }
    if (alive.current) setScanning(false)
  }, [mounts])

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
    // The attached ones are done; the rest stay. Times proposed from the new files are
    // now waiting in the section below, and every card may now have context.
    const done = new Set(list.map((c) => c.token))
    setFound((cur) => (cur || []).filter((c) => !done.has(c.token) || attached === 0))
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
          counts={found ? t('found.counts', { files: scanned, found: found.length, unclaimed }) : ''}
          right={
            <>
              <InfoDot title={t('found.info.title')} text={t('found.info.body')} />
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
