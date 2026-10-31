import { t } from './i18n.js'
import { Card, GhostButton, IconArrow, IconButton, IconCheck, IconClose, InfoDot, SectionHead } from './ui.jsx'
import { LoadFailed, goTo } from './sources.jsx'
import { useLibraryScan } from './libraryScan.js'

// What the last library scan left to decide, a section of Checks.
//
// The scan itself lives on Metadata > Source files, with the folders and the coverage. This
// section shows what came out of it: files found for works, to accept or refuse (exact where
// an identifier matched, by name where only a name did), a scan that failed or was cut short,
// and how many files matched no work. A refusal is remembered. While a scan runs it says so in
// one line. When there is nothing to decide it draws nothing.
//
// The reads, the polling and the presses are useLibraryScan's (libraryScan.js), shared with
// Metadata > Source files.

export default function FoundFilesPage({ embedded = false }) {
  const { mounts, found, scanning, busy, loadError, badLines, sum, attach, refuse, retry, reload } = useLibraryScan()
  if (!mounts) return null
  // No folders and nothing failed: the section draws nothing, as before.
  if (mounts.length === 0) return loadError ? <LoadFailed text={loadError} onRetry={retry} /> : null
  const groups = [
    ['exact', (found || []).filter((c) => c.bucket === 'exact')],
    ['review', (found || []).filter((c) => c.bucket === 'review')],
  ].filter(([, list]) => list.length > 0)
  const unclaimed = scanning ? 0 : sum('unclaimed')
  // ONLY WHAT THE SCAN LEFT TO DECIDE. The scan itself, the folders and the coverage are
  // Metadata > Source files; this section draws nothing when there is nothing to decide.
  if (!scanning && !loadError && groups.length === 0 && badLines.length === 0 && unclaimed === 0) return null
  const toFiles = (
    <button type="button" className="tp-link" onClick={() => goTo('/metadata/files')}>
      {t('found.to.metadata')}
    </button>
  )

  return (
    <>
      {embedded && <hr className="tp-rule" />}
      <section className="flex flex-col gap-6" data-screen-label="found-files">
        <SectionHead
          embedded={embedded}
          title={t('found.title')}
          counts={groups.length ? t('found.waiting', { n: (found || []).length, count: (found || []).length }) : ''}
          right={<InfoDot title={t('found.info.title')} text={t('found.info.body')} />}
        />
        {loadError && <LoadFailed text={loadError} onRetry={reload} />}
        {scanning && (
          <p className="microcopy">
            {t('found.running', { files: sum('scanned'), found: sum('found') })} {toFiles}
          </p>
        )}
        {badLines.map((line) => (
          <p key={line} className="microcopy" role="alert" style={{ color: 'var(--error)' }}>{line}</p>
        ))}
        {unclaimed > 0 && (
          <p className="microcopy">
            {t('found.unclaimed', { n: unclaimed, count: unclaimed })} {toFiles}
          </p>
        )}
        {!scanning && unclaimed === 0 && <p className="microcopy">{toFiles}</p>}
        {groups.length > 0 && (
          <Card>
            <div className="flex flex-col gap-6">
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
                    <div key={c.token} className="flex flex-col gap-2" data-testid="found-row">
                      <div className="min-w-0 flex flex-col gap-1">
                        <p>
                          <b>{c.title}</b>
                          {c.episode ? ` · ${c.episode.toUpperCase()}` : ''}
                          <span className="import-arrow"><IconArrow size={12} /></span>{' '}
                          <span className="microcopy">{t(`found.kind.${c.format}`)}</span>
                        </p>
                        <p className="microcopy" style={{ color: 'var(--soft)', overflowWrap: 'anywhere' }}>{c.rel}</p>
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
