import { t } from './i18n.js'
import { Card, GhostButton, IconArrow, IconButton, IconCheck, IconClose, IconRefresh, IconStop, InfoDot, SectionHead } from './ui.jsx'
import { LoadFailed, goTo } from './sources.jsx'
import { useLibraryScan } from './libraryScan.js'

// Files found in a mounted library, a section of Checks.
//
// The operator mounts the folders the library already lives in, read-only. One press of Scan
// starts a background job per folder that walks the whole folder, however large. Nothing is
// copied and nothing is attached on its own: findings are listed as "this file for this work",
// exact where an identifier matched and for a look where only a name did, and the reader accepts
// or refuses. A refusal is remembered.
//
// The reads, the polling and the presses are useLibraryScan's (libraryScan.js), shared with
// Metadata > Source files. No press, no scan, and the section draws nothing for a box with no
// folders mounted.

export default function FoundFilesPage({ embedded = false }) {
  const { mounts, found, scans, scanning, starting, busy, loadError, badLines, sum, scan, stop, attach, refuse, retry, reload } = useLibraryScan()
  if (!mounts) return null
  // No folders and nothing failed: the section draws nothing, as before.
  if (mounts.length === 0) return loadError ? <LoadFailed text={loadError} onRetry={retry} /> : null
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
              <GhostButton type="button" disabled={scanning || starting} onClick={scan}>
                <IconRefresh />
                <span>{scanning ? t('found.scanning') : found ? t('found.rescan') : t('found.scan')}</span>
              </GhostButton>
            </>
          }
        />
        {loadError && <LoadFailed text={loadError} onRetry={reload} />}
        <p className="microcopy">
          <button type="button" className="tp-link" onClick={() => goTo('/metadata/files')}>
            {t('found.to.metadata')}
          </button>
        </p>
        {badLines.map((line) => (
          <p key={line} className="microcopy" role="alert" style={{ color: 'var(--error)' }}>{line}</p>
        ))}
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
