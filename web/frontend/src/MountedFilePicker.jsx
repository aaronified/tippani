import { useEffect, useState } from 'react'
import { json } from './api.js'
import { t } from './i18n.js'
import { Field, FormModal, GhostButton, IconArrow, IconBack, IconSourceFile, toast } from './ui.jsx'
import { QUICK_MS, invalidateContext, sourceFail, sourceSubject } from './sources.jsx'

// Attach a file BY HAND from the folders the administrator mounted (Settings > Server).
//
// The scan proposes the files it can pair with a work and nothing else; a file it could not pair
// (a name it does not know, a folder it cannot read an id from) stays unattached for ever. This is
// the other door: the reader knows which file belongs to this work, so they walk the mounted
// folder and say so. The server lists one folder at a time and names every path relative to the
// mount, and the attach goes through the same checks as a scan's proposal.
//
// A SHOW'S FILE IS FOR ONE EPISODE, so a show asks which before any file is chosen.

const sizeOf = (n) => (n >= 1 << 20 ? `${(n / (1 << 20)).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)

export default function MountedFilePicker({ kind, item, mounts, onClose, onDone }) {
  const show = kind === 'movie' && item.media_type === 'show'
  const [mount, setMount] = useState(mounts.length === 1 ? mounts[0].id : '')
  const [path, setPath] = useState('')
  const [list, setList] = useState(null)
  const [failed, setFailed] = useState(false)
  const [episode, setEpisode] = useState('')
  const [asked, setAsked] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!mount) return undefined
    let live = true
    setList(null)
    setFailed(false)
    json('GET', `/sources/browse?mount=${encodeURIComponent(mount)}&path=${encodeURIComponent(path)}`, undefined, { timeoutMs: QUICK_MS }).then((r) => {
      if (!live) return
      if (r.ok) setList(r.data)
      else setFailed(true)
    })
    return () => {
      live = false
    }
  }, [mount, path])

  async function choose(entry) {
    if (show && !episode.trim()) {
      setAsked(true)
      return
    }
    setBusy(true)
    const body = { mount, rel: entry.rel, subject: sourceSubject(kind), id: item.id }
    if (show) body.episode = episode.trim()
    const r = await json('POST', '/sources/attach-mounted', body, { timeoutMs: QUICK_MS })
    setBusy(false)
    if (!r.ok) {
      toast(sourceFail(r))
      return
    }
    const c = r.data?.context
    const total = c ? c.matched + c.ambiguous + c.unmatched + c.skipped : 0
    toast(total > 0 ? t('common.source.placed', { name: entry.name, found: c.matched + c.skipped, total }) : t('common.source.added', { name: entry.name }))
    invalidateContext()
    onDone?.()
    onClose()
  }

  const label = mounts.find((m) => m.id === mount)?.label || ''
  return (
    <FormModal open onClose={onClose} title={t('files.pick.title', { title: item.title })} maxWidth={520} dirty={episode.trim() ? 1 : 0}>
      <div className="flex flex-col gap-3" data-testid="mounted-picker">
        {show && (
          <Field
            label={t('common.source.episode.label')}
            value={episode}
            placeholder="s01e04"
            onChange={(e) => setEpisode(e.target.value)}
          />
        )}
        {asked && show && !episode.trim() && (
          <p className="microcopy" role="alert" style={{ color: 'var(--error)' }}>{t('files.pick.need-episode')}</p>
        )}
        {!mount && (
          <ul className="mount-list">
            {mounts.map((m) => (
              <li key={m.id}>
                <button type="button" className="mount-row" onClick={() => setMount(m.id)}>
                  <span className="min-w-0 flex-1">{m.label}</span>
                  <IconArrow size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
        {mount && (
          <>
            <p className="microcopy min-w-0" style={{ overflowWrap: 'anywhere' }}>
              {[label, path].filter(Boolean).join(' / ')}
            </p>
            {(path || mounts.length > 1) && (
              <div>
                <GhostButton
                  type="button"
                  icon={<IconBack />}
                  keepLabel
                  onClick={() => (path ? setPath(list?.parent || '') : setMount(''))}
                >
                  {t('files.pick.up')}
                </GhostButton>
              </div>
            )}
            {failed && <p className="microcopy" role="alert">{t('files.pick.failed')}</p>}
            {list && list.entries.length === 0 && <p className="microcopy">{t('files.pick.empty')}</p>}
            {list && (
              <ul className="mount-list">
                {list.entries.map((e) => (
                  <li key={e.rel}>
                    <button
                      type="button"
                      className="mount-row"
                      disabled={busy}
                      onClick={() => (e.dir ? setPath(e.rel) : choose(e))}
                    >
                      {e.dir ? null : <IconSourceFile size={16} />}
                      <span className="min-w-0 flex-1" style={{ overflowWrap: 'anywhere' }}>{e.name}</span>
                      {e.dir ? <IconArrow size={14} /> : <span className="microcopy">{sizeOf(e.size)}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {list?.truncated && <p className="microcopy">{t('files.pick.truncated')}</p>}
          </>
        )}
      </div>
    </FormModal>
  )
}
