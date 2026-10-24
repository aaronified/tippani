import { useCallback, useEffect, useState } from 'react'
import { json } from './api.js'
import { t } from './i18n.js'
import { Field, GhostButton, IconClose, IconPlus, Toggle, toast } from './ui.jsx'
import { PrefGroup, PrefRow } from './prefRow.jsx'

// The administrator's half of a mounted library, and the backup's one source-file setting.
//
// A LIBRARY FOLDER IS A PROPERTY OF THE BOX, not of a reader: the operator mounts the folders
// their books and films already live in, read-only (`:ro` is THEIR guarantee, and the app never
// writes there either), and every reader's scan then sees the same folders. What a scan
// PROPOSES is per reader. The path shown here is the one inside the container, and it is shown
// to an administrator only; a reader is offered a folder by its label.
//
// THE FOLDER LIST IS SAVED AS A WHOLE, validated by the server (it must be a readable folder),
// so a typo is refused here with the reason and never stored.

// An id is a slug of what the operator called it, since nothing else needs it to be stable.
const slug = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32) || 'library'

export default function LibraryFoldersGroup() {
  const [mounts, setMounts] = useState(null)
  const [path, setPath] = useState('')
  const [label, setLabel] = useState('')
  const [busy, setBusy] = useState(false)
  const [withSources, setWithSources] = useState(false)
  // What a tidy would remove, and what is missing: counts only, nothing touched until pressed.
  const [tidy, setTidy] = useState(null)

  const load = useCallback(async () => {
    const [m, b, o] = await Promise.all([json('GET', '/admin/mounts'), json('GET', '/admin/backup/sources'), json('GET', '/admin/maintenance/sources')])
    setMounts(m.ok ? m.data.mounts || [] : [])
    if (b.ok) setWithSources(!!b.data.include)
    if (o.ok) setTidy(o.data)
  }, [])
  useEffect(() => {
    load()
  }, [load])

  async function save(next) {
    setBusy(true)
    const r = await json('PUT', '/admin/mounts', { mounts: next.map(({ id, label: l, path: p }) => ({ id, label: l, path: p })) })
    setBusy(false)
    if (!r.ok) {
      toast(r.data?.error || t('common.source.error'))
      return false
    }
    setMounts(r.data.mounts || [])
    return true
  }

  async function add() {
    const p = path.trim()
    if (!p) return
    const l = label.trim() || p.split('/').filter(Boolean).pop() || p
    let id = slug(l)
    const taken = new Set((mounts || []).map((m) => m.id))
    for (let n = 2; taken.has(id); n++) id = `${slug(l).slice(0, 28)}-${n}`
    if (await save([...(mounts || []), { id, label: l, path: p }])) {
      setPath('')
      setLabel('')
    }
  }

  async function sweep() {
    setBusy(true)
    const r = await json('POST', '/admin/maintenance/sources/sweep')
    setBusy(false)
    if (r.ok) {
      toast(t('settings.library.tidy.done', { n: r.data.removed, count: r.data.removed }))
      load()
    } else toast(r.data?.error || t('common.source.error'))
  }

  async function setBackup(include) {
    const r = await json('PUT', '/admin/backup/sources', { include })
    if (r.ok) setWithSources(!!r.data.include)
    else toast(r.data?.error || t('common.source.error'))
  }

  if (mounts === null) return null
  return (
    <PrefGroup title={t('settings.library.title')}>
      <PrefRow
        label={t('settings.library.folders.label')}
        info={t('settings.library.folders.info')}
        said={
          mounts.length === 0 ? (
            <p className="microcopy">{t('settings.library.folders.none')}</p>
          ) : (
            <ul className="flex flex-col gap-1" data-testid="library-folders">
              {mounts.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center gap-2">
                  <span>
                    <b>{m.label}</b> <span className="microcopy">{m.path}</span>
                  </span>
                  {!m.ok && <span className="microcopy" style={{ color: 'var(--error)' }}>{m.error}</span>}
                  <GhostButton
                    type="button"
                    disabled={busy}
                    aria-label={t('settings.library.folders.remove.aria', { label: m.label })}
                    onClick={() => save(mounts.filter((x) => x.id !== m.id))}
                  >
                    <IconClose />
                  </GhostButton>
                </li>
              ))}
            </ul>
          )
        }
      />
      <PrefRow label={t('settings.library.add.label')}>
        <div className="flex flex-wrap items-end gap-2">
          <Field
            label={t('settings.library.add.path')}
            value={path}
            placeholder="/library/books"
            onChange={(e) => setPath(e.target.value)}
          />
          <Field label={t('settings.library.add.name')} value={label} onChange={(e) => setLabel(e.target.value)} />
          <GhostButton type="button" disabled={busy || !path.trim()} onClick={add}>
            <IconPlus />
            <span>{t('settings.library.add.button')}</span>
          </GhostButton>
        </div>
      </PrefRow>
      <PrefRow
        label={t('settings.library.backup.label')}
        sub={t('settings.library.backup.sub')}
        control={
          <Toggle
            value={withSources ? 'on' : 'off'}
            onChange={(v) => setBackup(v === 'on')}
            ariaLabel={t('settings.library.backup.label')}
            options={[
              ['off', t('common.toggle.off.label')],
              ['on', t('common.toggle.on.label')],
            ]}
          />
        }
      />
      {tidy && (tidy.orphan_files > 0 || tidy.missing_files > 0) && (
        <PrefRow
          label={t('settings.library.tidy.label')}
          info={t('settings.library.tidy.info')}
          said={
            <>
              {tidy.orphan_files > 0 && (
                <p className="microcopy">{t('settings.library.tidy.orphans', { n: tidy.orphan_files, count: tidy.orphan_files })}</p>
              )}
              {tidy.missing_files > 0 && (
                <p className="microcopy">{t('settings.library.tidy.missing', { n: tidy.missing_files, count: tidy.missing_files })}</p>
              )}
            </>
          }
          control={
            tidy.orphan_files > 0 ? (
              <GhostButton type="button" disabled={busy} onClick={sweep}>
                <span>{t('settings.library.tidy.button')}</span>
              </GhostButton>
            ) : null
          }
        />
      )}
    </PrefGroup>
  )
}
