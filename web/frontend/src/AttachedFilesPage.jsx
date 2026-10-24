import { useCallback, useEffect, useState } from 'react'
import { json } from './api.js'
import { t } from './i18n.js'
import { Card, GhostButton, InfoDot, SectionHead, toast, useConfirm } from './ui.jsx'
import { LoadFailed, QUICK_MS, READ_MS, invalidateContext, sourceFail } from './sources.jsx'

// The files attached to your works, and the prune — a section of Checks.
//
// A file is scaffolding: it earns its space while quotes are still arriving, and once they stop
// it is 1.4 MB holding 50 KB of usefulness. A prune keeps what was read from it (the context of
// every quote, which the panel opens from stored rows) and throws the bytes away. What it gives
// up is one thing, said once before it is pressed: nothing NEW can be derived until the file is
// added again. It is recoverable, not reversible from inside the app.
//
// THE LIST IS SORTED BY WHAT A PRUNE FREES, with when a quote was last added to the work beside
// it, because that is the column that makes the decision: a work nobody has added to in six
// months is the one to prune. That is the reader's judgement and this does not apply it for them.
// NOTHING PRUNES ON ITS OWN, and a mounted file is not here at all: its bytes are not ours.
//
// It draws nothing for a reader with no uploaded file.

const size = (n) => (n >= 1 << 20 ? `${(n / (1 << 20)).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)

export default function AttachedFilesPage({ embedded = false }) {
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState(false)
  const [loadError, setLoadError] = useState('')
  const { ask, confirmDialog } = useConfirm()

  const load = useCallback(async () => {
    const r = await json('GET', '/sources/stack', undefined, { timeoutMs: QUICK_MS })
    setData(r.ok ? r.data : { sources: [], frees: 0 })
    setLoadError(r.ok ? '' : t('attached.error.load', { why: sourceFail(r) }))
  }, [])
  useEffect(() => {
    load()
  }, [load])

  async function prune(row) {
    // The confirmation names the WORK, never "this file": the press may come from a list of many,
    // and what is thrown away is a file serving a whole work.
    const yes = await ask(t('attached.confirm.title', { title: row.title }), {
      body: t('attached.confirm.body', {
        name: row.name,
        size: size(row.bytes),
        kept: row.with_context,
        none: row.without_context,
      }),
      confirmLabel: t('attached.confirm.button'),
      danger: true,
    })
    if (!yes) return
    setBusy(true)
    const r = await json('POST', `/sources/${row.id}/prune`, undefined, { timeoutMs: READ_MS })
    setBusy(false)
    if (r.ok) {
      toast(t('attached.done', { title: row.title }))
      invalidateContext()
      load()
    } else toast(sourceFail(r))
  }

  if (loadError) return <LoadFailed text={loadError} onRetry={load} />
  if (!data || data.sources.length === 0) return confirmDialog
  return (
    <>
      {embedded && <hr className="tp-rule" />}
      <section className="flex flex-col gap-6" data-screen-label="attached-files">
        <SectionHead
          embedded={embedded}
          title={t('attached.title')}
          counts={t('attached.counts', { n: data.sources.length, frees: size(data.frees) })}
          right={<InfoDot title={t('attached.info.title')} text={t('attached.info.body')} />}
        />
        <Card>
          <div className="flex flex-col gap-4">
            {data.sources.map((s) => (
              <div key={s.id} className="flex flex-wrap items-start gap-3" data-testid="attached-row">
                <div className="min-w-0 flex-1 flex flex-col gap-1">
                  <p>
                    <b>{s.title}</b>
                    {s.episode ? ` · ${s.episode.toUpperCase()}` : ''}
                  </p>
                  <p className="microcopy" style={{ color: 'var(--soft)' }}>{s.name}</p>
                  <p className="microcopy">
                    {t('attached.row', {
                      size: size(s.bytes),
                      kept: size(s.kept_bytes),
                      quotes: s.with_context,
                    })}
                    {s.last_quote_at ? ` · ${t('attached.last', { when: s.last_quote_at.slice(0, 10) })}` : ''}
                  </p>
                </div>
                <GhostButton type="button" disabled={busy} onClick={() => prune(s)}>
                  <span>{t('attached.prune')}</span>
                </GhostButton>
              </div>
            ))}
          </div>
        </Card>
      </section>
      {confirmDialog}
    </>
  )
}
