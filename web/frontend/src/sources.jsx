import { useCallback, useEffect, useRef, useState } from 'react'
import { FormModal, Field, GhostButton, IconDelete, toast, useFilePick } from './ui.jsx'
import { json, putUpload } from './api.js'
import { t } from './i18n.js'

// The file a work's quotes came from — the doors' shared behaviour.
//
// The work card's menu and the work's own panel both offer "add a source file", and
// they are ONE verb here: a control drawn by one component on two screens has one
// behaviour, and it lives in a function both call (CLAUDE.md, "Two things that look
// the same behave the same"). The registry (actions.jsx) says whether a surface
// offers it; this says what pressing it does.
//
// THE PICKER HAS NO `accept`. The format comes from the bytes on the server, and a
// subtitle saved as `.ass.txt` — which is how the owner's own file arrived — is
// greyed out in the operating system's dialog by any extension list.

// The media word the server's /sources routes use for a kind of work. The app says
// `movie` for the catalogue's rows; the server says `screen`, as item_reviews does.
export const sourceSubject = (kind) => (kind === 'book' ? 'book' : 'screen')

// A GAME HAS NO EQUIVALENT (the owner's), so it is absent rather than disabled.
// A show needs an episode, because a subtitle covers one.
export const canTakeSource = (kind, item) => kind === 'book' || (kind === 'movie' && item?.media_type !== 'game')
export const needsEpisode = (kind, item) => kind === 'movie' && item?.media_type === 'show'

// useSourceDoor returns `add(kind, item)` and the node to render beside it. The
// episode question is a dialog of its own so the file picker, which a browser only
// opens from a press, is still reached by that same press for a film or a book.
export function useSourceDoor(onDone) {
  const target = useRef(null) // { kind, item, ep } the open picker is for
  const [asking, setAsking] = useState(null) // { kind, item } awaiting an episode
  const [episode, setEpisode] = useState('')

  const send = useCallback(
    async (kind, item, file, ep) => {
      const fields = { subject: sourceSubject(kind), subject_id: String(item.id) }
      if (ep) fields.episode = ep
      const r = await putUpload('/sources', file, fields)
      if (!r.ok) {
        toast(r.data?.error || t('common.source.error'))
        return
      }
      toast(t('common.source.added', { name: r.data?.name || file.name }))
      onDone?.(r.data)
    },
    [onDone],
  )

  // THE SHARED INPUT (ui.jsx useFilePick), with no `accept`: it clears itself
  // before the handler runs, which is what lets the same file be chosen twice.
  const picker = useFilePick({
    ariaLabel: t('common.source.pick.aria'),
    onFiles: (file) => {
      const to = target.current
      if (to) send(to.kind, to.item, file, to.ep)
    },
  })
  const pick = (kind, item, ep) => {
    target.current = { kind, item, ep: ep || '' }
    // Inside the press that asked, or a browser refuses to open the dialog.
    picker.open()
  }

  const add = useCallback((kind, item) => {
    if (needsEpisode(kind, item)) {
      setEpisode('')
      setAsking({ kind, item })
      return
    }
    pick(kind, item, '')
  }, [])

  const node = (
    <>
      {picker.input}
      {asking && (
        <FormModal open onClose={() => setAsking(null)} title={t('common.source.episode.title')} maxWidth={420}>
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault()
              const ep = episode.trim()
              if (!ep) return
              const { kind, item } = asking
              setAsking(null)
              pick(kind, item, ep)
            }}
          >
            <Field
              label={t('common.source.episode.label')}
              value={episode}
              placeholder="s01e04"
              autoFocus
              onChange={(e) => setEpisode(e.target.value)}
            />
            <GhostButton type="submit" disabled={!episode.trim()}>
              <span>{t('common.source.episode.choose')}</span>
            </GhostButton>
          </form>
        </FormModal>
      )}
    </>
  )
  return { add, node }
}

// SourceLine is what a work's panel says about the file it holds: its name, its
// size, and the way to take it away. Nothing shows when there is none — the absence
// of a thing is not worth a sentence — and the add verb is the registry's, rendered
// by the caller beside it.
export function SourceLine({ kind, item, version, onRemoved }) {
  const [rows, setRows] = useState([])
  useEffect(() => {
    if (!canTakeSource(kind, item) || needsEpisode(kind, item)) return undefined
    let live = true
    json('GET', `/sources?subject=${sourceSubject(kind)}&subject_id=${item.id}`).then((r) => {
      if (live && r.ok) setRows(r.data?.sources || [])
    })
    return () => {
      live = false
    }
  }, [kind, item?.id, item?.media_type, version])
  if (rows.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="source-line">
      {rows.map((s) => (
        <span key={s.id} className="flex items-center gap-2">
          <span>{t('common.source.holds', { name: s.name, size: sizeOf(s.bytes) })}</span>
          <GhostButton
            type="button"
            aria-label={t('common.source.remove.aria', { name: s.name })}
            onClick={async () => {
              const r = await json('DELETE', `/sources/${s.id}`)
              if (r.ok) {
                setRows((cur) => cur.filter((x) => x.id !== s.id))
                onRemoved?.()
                toast(t('common.source.removed'))
              } else toast(r.data?.error || t('common.source.error'))
            }}
          >
            <IconDelete />
          </GhostButton>
        </span>
      ))}
    </div>
  )
}

const sizeOf = (n) => (n >= 1 << 20 ? `${(n / (1 << 20)).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)
