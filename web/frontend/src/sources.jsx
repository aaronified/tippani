import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { FormModal, Field, GhostButton, IconCheck, IconChevron, IconClose, IconDelete, InfoDot, MonoLabel, Slider, toast, useConfirm, useFilePick } from './ui.jsx'
import { json, putUpload } from './api.js'
import { registerSessionCache } from './sessionCaches.js'
import { t } from './i18n.js'
import { isLive } from './jobs.js'
import { pushRoute } from './history.js'

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

// HOW LONG A SOURCE REQUEST MAY TAKE before the screen says the server did not answer.
// A quick one (a read, a scan start, a refusal) answers at once; one that reads a file
// (attach, rescan, prune) can take a while over a large ebook.
export const QUICK_MS = 15000
export const READ_MS = 120000

// sourceFail — what went wrong with a source request, in words: no answer at all (a
// timeout or a dropped connection), or the server's own reason. `noAnswer` lets a press
// say which request went unanswered.
export function sourceFail(r, noAnswer = 'common.source.noanswer') {
  if (!r || !r.status) return t(noAnswer)
  return r.data?.error ? t('common.source.failed', { error: r.data.error }) : t('common.source.failed.generic')
}

// failToast — a press that failed, said with a way to press it again. The action keeps the
// toast up long enough to be read (a plain toast is one glance).
export function failToast(msg, retry) {
  if (retry) toast(msg, { label: t('common.source.retry'), onClick: retry })
  else toast(msg)
}

// LoadFailed — a read that failed, said where its answer would have been, with a retry.
export function LoadFailed({ text, onRetry }) {
  return (
    <p className="microcopy" role="alert">
      <span style={{ color: 'var(--error)' }}>{text}</span>{' '}
      <button type="button" className="tp-link" onClick={onRetry}>
        {t('common.source.retry')}
      </button>
    </p>
  )
}

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
        toast(sourceFail(r))
        return
      }
      // The file was kept but could not be cut into context: said, not swallowed.
      if (r.data?.context_error) {
        toast(t('common.source.failed', { error: r.data.context_error }))
        invalidateContext()
        onDone?.(r.data)
        return
      }
      // What reading the file found, said plainly: the quotes it could not place are
      // not a failure, and a reader who sees "3 of 5" knows to look at the other two.
      const c = r.data?.context
      const total = c ? c.matched + c.ambiguous + c.unmatched + c.skipped : 0
      toast(
        c && total > 0
          ? t('common.source.placed', { name: r.data?.name || file.name, found: c.matched + c.skipped, total })
          : t('common.source.added', { name: r.data?.name || file.name }),
      )
      invalidateContext()
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

// useSourceActions — what can be done to one attached file: rescan it, prune it (an
// uploaded one), remove it. Shared by a work's panel and Metadata > Source files, so the
// two screens press the same thing. `onChanged` runs after any of them worked.
export function useSourceActions(onChanged) {
  const [busy, setBusy] = useState(false)
  const { ask, confirmDialog } = useConfirm()
  const changed = () => {
    invalidateContext()
    onChanged?.()
  }
  const remove = async (s) => {
    setBusy(true)
    const r = await json('DELETE', `/sources/${s.id}`, undefined, { timeoutMs: QUICK_MS })
    setBusy(false)
    if (!r.ok) return failToast(sourceFail(r), () => remove(s))
    toast(t('common.source.removed'))
    changed()
  }
  const rescan = async (s) => {
    setBusy(true)
    const r = await json('POST', `/sources/${s.id}/rescan`, undefined, { timeoutMs: READ_MS })
    setBusy(false)
    if (!r.ok) return failToast(sourceFail(r), () => rescan(s))
    const c = r.data?.context || {}
    const n = (c.matched || 0) + (c.skipped || 0)
    toast(t('common.source.rescanned', { n, count: n }))
    changed()
  }
  // The same preview and confirmation as Checks > Attached files.
  const prune = async (s) => {
    setBusy(true)
    const p = await json('GET', `/sources/${s.id}/prune`, undefined, { timeoutMs: QUICK_MS })
    setBusy(false)
    if (!p.ok) return failToast(sourceFail(p), () => prune(s))
    const row = p.data
    const yes = await ask(t('attached.confirm.title', { title: row.title }), {
      body: t('attached.confirm.body', { name: row.name, size: sizeOf(row.bytes), kept: row.with_context, none: row.without_context }),
      confirmLabel: t('attached.confirm.button'),
      danger: true,
    })
    if (!yes) return
    setBusy(true)
    const r = await json('POST', `/sources/${s.id}/prune`, undefined, { timeoutMs: READ_MS })
    setBusy(false)
    if (!r.ok) return failToast(sourceFail(r), () => prune(s))
    toast(t('attached.done', { title: row.title }))
    changed()
  }
  return { busy, setBusy, remove, rescan, prune, changed, confirmDialog }
}

// SourceFileRow — one attached file: name, kind, size, where it lives, how many of the
// work's quotes it gave context to, and its verbs.
export function SourceFileRow({ s, withContext = null, quotes = 0, acts }) {
  return (
    <div className="flex flex-wrap items-start gap-3" data-testid="source-line">
      <div className="min-w-0 flex-1 flex flex-col gap-1">
        <p>
          <b>{s.name}</b>
          {s.episode ? ` · ${s.episode.toUpperCase()}` : ''}
        </p>
        <p className="microcopy">
          {[t(`common.source.kind.${KIND_OF[s.format] || 'text'}`), s.state === 'pruned' ? '' : sizeOf(s.bytes), t(`common.source.where.${s.state}`)]
            .filter(Boolean)
            .join(' · ')}
        </p>
        {withContext != null && quotes > 0 && (
          <p className="microcopy">{t('common.source.context', { n: withContext, total: quotes, count: quotes })}</p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {(s.state === 'file' || s.state === 'mounted') && (
          <GhostButton type="button" disabled={acts.busy} onClick={() => acts.rescan(s)}>
            <span>{t('common.source.rescan')}</span>
          </GhostButton>
        )}
        {s.origin === 'upload' && s.state === 'file' && (
          <GhostButton type="button" disabled={acts.busy} onClick={() => acts.prune(s)}>
            <span>{t('attached.prune')}</span>
          </GhostButton>
        )}
        <GhostButton type="button" disabled={acts.busy} aria-label={t('common.source.remove.aria', { name: s.name })} onClick={() => acts.remove(s)}>
          <IconDelete />
        </GhostButton>
      </div>
    </div>
  )
}

// FoundFileRow — a file a library scan found for a work that nobody has attached yet,
// with Attach and Not this one.
export function FoundFileRow({ c, folder, busy, onAttach, onRefuse }) {
  return (
    <div className="flex flex-col gap-2" data-testid="source-found">
      <p className="min-w-0">
        {t('common.source.found', { folder })}
        {c.episode ? ` · ${c.episode.toUpperCase()}` : ''}
      </p>
      {/* The path is long and has no spaces, so it wraps anywhere on its own full-width line. */}
      <p className="microcopy min-w-0" style={{ overflowWrap: 'anywhere' }}>{c.rel}</p>
      <div className="flex flex-wrap items-center gap-2">
        <GhostButton type="button" disabled={busy} onClick={onAttach}>
          <IconCheck />
          <span>{t('common.source.found.attach')}</span>
        </GhostButton>
        <GhostButton type="button" disabled={busy} onClick={onRefuse}>
          <IconClose />
          <span>{t('common.source.found.refuse')}</span>
        </GhostButton>
      </div>
    </div>
  )
}

// SourceSection is what a work's panel says about the file it holds, through the two
// rows above, and under that a file the last library scan found for this work. `addAct`
// is the registry's add verb, drawn here as Add or Replace. `quotes` is the work's quote
// count. Metadata > Source files is the same for the whole library, and this links there.
//
// A SHOW HAS NO FILE OF ITS OWN: a subtitle covers one episode, so a show's panel gets the
// add verb and the found files, and its episode files are listed on Metadata > Source files.
export function SourceSection({ kind, item, quotes = 0, version, addAct, onChanged }) {
  const [rows, setRows] = useState([])
  const [withContext, setWithContext] = useState(null)
  const [tick, setTick] = useState(0)
  const [loadError, setLoadError] = useState('')
  const subject = sourceSubject(kind)
  const perEpisode = needsEpisode(kind, item)
  const able = canTakeSource(kind, item)
  const found = useFoundFor(able ? subject : '', item?.id)
  const acts = useSourceActions(onChanged)
  useSourcesChanged(useCallback(() => setTick((n) => n + 1), []))
  useEffect(() => {
    if (!able || perEpisode) return undefined
    let live = true
    json('GET', `/sources?subject=${subject}&subject_id=${item.id}`, undefined, { timeoutMs: QUICK_MS }).then((r) => {
      if (!live) return
      if (r.ok) setRows(r.data?.sources || [])
      setLoadError(r.ok ? '' : sourceFail(r))
    })
    contextList(subject, item.id).then((ids) => live && setWithContext(ids.size))
    return () => {
      live = false
    }
  }, [able, perEpisode, subject, item?.id, version, tick])
  if (!able) return null

  const held = rows.length > 0
  return (
    <section className="flex flex-col gap-3" aria-label={t('common.source.section.title')}>
      <div className="flex flex-wrap items-center gap-2">
        <MonoLabel>{t('common.source.section.title')}</MonoLabel>
        {addAct && (
          <GhostButton type="button" onClick={addAct.run} title={addAct.tooltip}>
            {addAct.icon}
            <span>{held ? t('common.source.replace') : addAct.label}</span>
          </GhostButton>
        )}
      </div>
      {loadError && <LoadFailed text={loadError} onRetry={() => setTick((n) => n + 1)} />}
      {rows.map((s) => (
        <SourceFileRow key={s.id} s={s} withContext={withContext} quotes={quotes} acts={acts} />
      ))}
      {found.list.map((c) => (
        <FoundFileRow
          key={c.token}
          c={c}
          folder={found.folder(c.mount)}
          busy={acts.busy}
          onAttach={async () => {
            acts.setBusy(true)
            const ok = await found.attach(c)
            acts.setBusy(false)
            if (ok) acts.changed()
          }}
          onRefuse={() => found.refuse(c)}
        />
      ))}
      {found.error && <LoadFailed text={found.error} onRetry={found.retry} />}
      {found.scanning && (
        <p className="microcopy">
          {t('common.source.scanning')}{' '}
          <button type="button" className="tp-link" onClick={() => goTo('/settings/jobs')}>
            {t('common.source.scanning.jobs')}
          </button>
        </p>
      )}
      <p className="microcopy">
        <button type="button" className="tp-link" onClick={() => goTo('/metadata/files')}>
          {t('common.source.to.metadata')}
        </button>
      </p>
      {held && <ContextRule scope={kind === 'book' ? 'book' : 'movie'} id={item.id} />}
      {acts.confirmDialog}
    </section>
  )
}

const KIND_OF = { srt: 'subtitle', vtt: 'subtitle', ass: 'subtitle', epub: 'epub', mobi: 'mobi', pdf: 'pdf', txt: 'text', lrc: 'lyrics' }

const sizeOf = (n) => (n >= 1 << 20 ? `${(n / (1 << 20)).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)

// ---- what the last library scan found -----------------------------------------------

// THE FINDINGS OF EVERY FOLDER, read once and shared by every work panel opened after.
// GET /sources/found answers per folder for all works, so a panel filters it to its own
// work. Forgotten when a file is attached or removed, and on sign-out.
let foundRead = null
registerSessionCache(() => {
  foundRead = null
})

// forgetFound — Checks scanned or refused something, so the next panel reads again.
export function forgetFound() {
  foundRead = null
}

function readFound() {
  if (!foundRead) {
    // A read that failed keeps its reason and is not cached, so the next ask tries again.
    foundRead = json('GET', '/sources/mounts', undefined, { timeoutMs: QUICK_MS }).then(async (m) => {
      const mounts = m.ok ? m.data?.mounts || [] : []
      const out = { mounts, candidates: [], scans: {}, error: m.ok ? '' : sourceFail(m) }
      for (const f of mounts) {
        const r = await json('GET', `/sources/found?mount_id=${encodeURIComponent(f.id)}`, undefined, { timeoutMs: QUICK_MS })
        if (!r.ok) {
          out.error = sourceFail(r)
          continue
        }
        out.scans[f.id] = r.data?.scan || null
        out.candidates = out.candidates.concat(r.data?.candidates || [])
      }
      if (out.error) foundRead = null
      return out
    })
  }
  return foundRead
}

const SCAN_POLL_MS = 3000

// useFoundFor — the findings for one work, whether any folder is being scanned, and the
// two answers. While a scan runs it asks again now and then, so the line goes and new
// findings arrive without reopening the panel.
function useFoundFor(subject, workId) {
  const [data, setData] = useState(null)
  const [gone, setGone] = useState(() => new Set())
  const [tick, setTick] = useState(0)
  useSourcesChanged(useCallback(() => setTick((n) => n + 1), []))
  useEffect(() => {
    if (!subject || !workId) return undefined
    let live = true
    readFound().then((d) => live && setData(d))
    return () => {
      live = false
    }
  }, [subject, workId, tick])
  const scanning = !!data && Object.values(data.scans).some(isLive)
  useEffect(() => {
    if (!scanning) return undefined
    const timer = setTimeout(() => {
      foundRead = null
      setTick((n) => n + 1)
    }, SCAN_POLL_MS)
    return () => clearTimeout(timer)
  }, [scanning, data])
  const list = (data?.candidates || []).filter((c) => c.subject === subject && c.work_id === workId && !gone.has(c.token))
  const drop = (c) => setGone((s) => new Set(s).add(c.token))
  return {
    list,
    scanning,
    error: data?.error ? t('common.source.found.error', { error: data.error }) : '',
    retry: () => {
      foundRead = null
      setTick((n) => n + 1)
    },
    folder: (id) => data?.mounts.find((m) => m.id === id)?.label || id,
    async attach(c) {
      const r = await json('POST', '/sources/attach-found', { bucket: c.bucket, tokens: [c.token] }, { timeoutMs: READ_MS })
      if (!r.ok) {
        toast(sourceFail(r))
        return false
      }
      if (!(r.data?.done || []).includes(c.token)) {
        toast(t('found.failed', { n: 1, count: 1 }))
        return false
      }
      const k = r.data.context || {}
      const placed = (k.matched || 0) + (k.skipped || 0)
      toast(t('found.attached', { n: 1, count: 1, found: placed, total: placed + (k.ambiguous || 0) + (k.unmatched || 0) }))
      drop(c)
      foundRead = null
      return true
    },
    async refuse(c) {
      const r = await json('POST', '/sources/ignore-found', { tokens: [c.token] }, { timeoutMs: QUICK_MS })
      if (r.ok) {
        drop(c)
        foundRead = null
      } else toast(sourceFail(r))
    },
  }
}

// goTo — a screen of the app by its address, from somewhere that has no route handler of
// its own (a panel). The shell's popstate handler reads the new address, as it does for
// Back, so this is the same path a typed link takes.
export function goTo(path) {
  if (pushRoute(path)) window.dispatchEvent(new window.PopStateEvent('popstate', { state: window.history.state }))
}

// ---- what a quote's file says around it --------------------------------------------

// WHICH QUOTES HAVE CONTEXT, asked once per work and kept. A card asks "does this
// quote have context" so the action can be absent where it would show nothing (the
// registry's rule: absent, not disabled) — and a board of fifty cards must not make
// fifty requests to find out. One list per (subject, work), shared by every card on
// it, forgotten whenever a file is added, replaced or removed.
const contextLists = new Map() // work key -> a promise of the set of quote ids
const contextListeners = new Set()
// SIGNING OUT DOES NOT RELOAD THE PAGE, so the next account on this browser would be
// served the last one's list of quotes with context. Registered, so it is emptied.
registerSessionCache(() => contextLists.clear())

export function invalidateContext() {
  contextLists.clear()
  foundRead = null
  contextListeners.forEach((f) => f())
  sourceListeners.forEach((f) => f())
}

// useSourcesChanged runs `fn` whenever a file is added, replaced or removed anywhere, so a
// section that proposes things from stored files (the times on Checks) can reload.
const sourceListeners = new Set()
export function useSourcesChanged(fn) {
  useEffect(() => {
    sourceListeners.add(fn)
    return () => sourceListeners.delete(fn)
  }, [fn])
}

function contextList(subject, workId) {
  const key = `${subject}:${workId ?? ''}`
  if (!contextLists.has(key)) {
    const q = subject === 'utterance' ? 'subject=utterance' : `subject=${subject}&subject_id=${workId}`
    contextLists.set(
      key,
      json('GET', `/sources/context-ids?${q}`, undefined, { timeoutMs: QUICK_MS }).then((r) => {
        // A failed read is not kept: the card has no door this time and asks again next time.
        if (!r.ok) contextLists.delete(key)
        return new Set(r.ok ? r.data?.ids || [] : [])
      }),
    )
  }
  return contextLists.get(key)
}

// useHasContext: does quote `itemId` of work `workId` have stored context? `subject`
// is the SOURCE's word (book, screen, utterance). False until the list arrives.
export function useHasContext(subject, workId, itemId) {
  const [has, setHas] = useState(false)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const f = () => setTick((n) => n + 1)
    contextListeners.add(f)
    return () => contextListeners.delete(f)
  }, [])
  useEffect(() => {
    if (!subject || (subject !== 'utterance' && !workId)) return undefined
    let live = true
    contextList(subject, workId).then((ids) => live && setHas(ids.has(itemId)))
    return () => {
      live = false
    }
  }, [subject, workId, itemId, tick])
  return has
}

// The quote kinds, in the server's words for the context route.
export const contextKind = (selectKind) => (selectKind === 'quote' ? 'utterance' : selectKind === 'dialogue' ? 'dialogue' : 'annotation')
export const contextSubject = (kind) => (kind === 'utterance' ? 'utterance' : kind === 'dialogue' ? 'screen' : 'book')

// ContextDialog — the quote in place, with what came before and after, the quote itself
// marked. It reads ONE stored row (GET /quotes/{kind}/{id}/context), which is why it
// opens instantly and works with the file gone. "Show more" widens the window for this
// look only, up to what is stored, and is forgotten on close: the settings are for what
// should stick, and a one-off question should not fiddle with them.
export function ContextDialog({ kind, id, onClose }) {
  return (
    <FormModal open onClose={onClose} title={t('context.title')} maxWidth={640}>
      <ContextBody kind={kind} id={id} />
    </FormModal>
  )
}

// useInContext — the card side of the door: the registry's `inContext` callback (absent
// when the quote has no stored context) and the dialog it opens. `kind` is the context
// route's word: annotation, dialogue or utterance.
export function useInContext(kind, workId, id) {
  const has = useHasContext(contextSubject(kind), workId, id)
  const [open, setOpen] = useState(false)
  return {
    open: has ? () => setOpen(true) : undefined,
    node: open ? <ContextDialog kind={kind} id={id} onClose={() => setOpen(false)} /> : null,
  }
}

// ContextBody — what the dialog shows, as a block the edit form holds too. `origin` is
// the file's name. `onMissing` is called when the quote has no stored context; without
// it, that is shown as an error, which is what the dialog wants.
// `collapsed` hides the lines but keeps them loaded, so the form can fetch once and the
// reader opens them without a wait. A failure to load stays showing either way: it is one
// line with a Try again, and hiding it would hide that anything went wrong.
export function ContextBody({ kind, id, origin = '', onMissing, onFound, onError, collapsed = false }) {
  const [ctx, setCtx] = useState(null)
  const [error, setError] = useState('')
  const [more, setMore] = useState(null) // { before, after } or null for the default
  const [tick, setTick] = useState(0)
  const [adjusting, setAdjusting] = useState(false)
  useEffect(() => {
    let live = true
    const q = more ? `?before=${more.before}&after=${more.after}` : ''
    setError('')
    json('GET', `/quotes/${kind}/${id}/context${q}`, undefined, { timeoutMs: QUICK_MS }).then((r) => {
      if (!live) return
      if (r.ok && r.data?.span) {
        setCtx(r.data)
        onFound?.()
      } else if ((r.ok || r.status === 404) && onMissing) onMissing()
      else {
        // A 404 here is the dialog's: the quote has no context, which is the server's sentence.
        setError(r.status === 404 ? t('context.none') : t('context.error.load', { why: sourceFail(r) }))
        onError?.()
      }
    })
    return () => {
      live = false
    }
  }, [kind, id, more, tick]) // eslint-disable-line react-hooks/exhaustive-deps
  // The quote's own adjustment, one half or both; "" puts a half back to inherited. The panel
  // then asks again, so what it shows is what the cascade now says.
  const adjust = async (body) => {
    const r = await json('POST', '/quotes/context-span', { kind, ids: [id], ...body }, { timeoutMs: QUICK_MS })
    if (!r.ok) {
      toast(sourceFail(r))
      return
    }
    setMore(null)
    setTick((n) => n + 1)
  }
  const unit = ctx?.unit === 'cue' ? 'cue' : 'paragraph'
  const canWiden = ctx && (ctx.span.before < ctx.stored.before || ctx.span.after < ctx.stored.after)
  const step = unit === 'cue' ? 5 : 2
  const split = (s) => (s ? s.split(unit === 'cue' ? '\n' : '\n\n') : [])
  return (
    <>
      {error && <LoadFailed text={error} onRetry={() => setTick((n) => n + 1)} />}
      {ctx && (
        <div hidden={collapsed}><div className="flex flex-col gap-3" data-testid="context-panel">
          {ctx.bound_before && <p className="microcopy">{t(unit === 'cue' ? 'context.bound.before.cue' : 'context.bound.before.paragraph')}</p>}
          {split(ctx.before).map((p, i) => (
            <p key={`b${i}`} style={{ color: 'var(--soft)' }}>{p}</p>
          ))}
          <blockquote className="context-body" style={{ borderInlineStart: '3px solid var(--accent)', paddingInlineStart: '0.75em' }}>
            {split(ctx.body).map((p, i) => (
              <Fragment key={`m${i}`}>
                {i > 0 && <br />}
                {p}
              </Fragment>
            ))}
          </blockquote>
          {ctx.start && <p className="microcopy">{t('context.at', { time: ctx.start })}</p>}
          {split(ctx.after).map((p, i) => (
            <p key={`a${i}`} style={{ color: 'var(--soft)' }}>{p}</p>
          ))}
          {ctx.bound_after && <p className="microcopy">{t(unit === 'cue' ? 'context.bound.after.cue' : 'context.bound.after.paragraph')}</p>}
          {/* SAYS WHERE THE NUMBER CAME FROM, ONCE. The default needs no attribution. */}
          <p className="microcopy">
            {t(WINDOW_FROM[ctx.from] || 'context.window', { before: ctx.span.before, after: ctx.span.after })}
          </p>
          {origin && <p className="microcopy">{t('context.origin', { name: origin })}</p>}
          {canWiden && (
            <GhostButton
              type="button"
              onClick={() =>
                setMore({
                  before: Math.min(ctx.stored.before, ctx.span.before + step),
                  after: Math.min(ctx.stored.after, ctx.span.after + step),
                })
              }
            >
              <span>{t('context.more')}</span>
            </GhostButton>
          )}
          <GhostButton type="button" onClick={() => setAdjusting((v) => !v)}>
            <span>{t('context.adjust.open')}</span>
          </GhostButton>
          {adjusting && (
            <div className="flex flex-col gap-3" data-testid="context-adjust">
              <Slider
                label={t('context.adjust.before.label')}
                min={0}
                max={RULE_MAX}
                step={1}
                value={ctx.span.before}
                onCommit={(v) => v !== ctx.span.before && adjust({ before: String(v) })}
              />
              <Slider
                label={t('context.adjust.after.label')}
                min={0}
                max={RULE_MAX}
                step={1}
                value={ctx.span.after}
                onCommit={(v) => v !== ctx.span.after && adjust({ after: String(v) })}
              />
              {ctx.from === 'quote' && (
                <GhostButton type="button" onClick={() => adjust({ before: '', after: '' })}>
                  <span>{t('context.adjust.reset')}</span>
                </GhostButton>
              )}
            </div>
          )}
        </div></div>
      )}
    </>
  )
}

// QuoteContext — the stored context of one quote, as its own block on the edit form.
// It names the file it came from. A quote with no context gets one line saying so, but
// only when the work has a file: with no file there is nothing to explain.
// `subject` and `workId` say whose file to ask about (book, screen with its episode, or
// utterance with the quote's own id).
export function QuoteContext({ kind, id, subject, workId, episode = '' }) {
  const [file, setFile] = useState(null)
  const [state, setState] = useState('') // '' loading, 'found', 'missing', 'error'
  // COLLAPSED UNTIL ASKED FOR (#59). The edit form is for the quote's own fields, and the
  // lines around it are a reference; open by default they pushed the fields down a phone.
  const [open, setOpen] = useState(false)
  useEffect(() => {
    setFile(null)
    if (!id || !workId) return undefined
    let live = true
    const ep = episode ? `&episode=${encodeURIComponent(episode)}` : ''
    json('GET', `/sources?subject=${subject}&subject_id=${workId}${ep}`, undefined, { timeoutMs: QUICK_MS }).then((r) => {
      if (live && r.ok) setFile((r.data?.sources || [])[0] || null)
    })
    return () => {
      live = false
    }
  }, [subject, workId, episode, id])
  if (!id) return null
  const shown = state === 'found' || state === 'error' || (state === 'missing' && file)
  return (
    <section className="flex flex-col gap-2" aria-label={t('context.title')} hidden={!shown}>
      {state === 'found' ? (
        <button type="button" className="tp-link self-start inline-flex items-center gap-1" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          <MonoLabel className="block">{t('context.title')}</MonoLabel>
          <IconChevron open={open} size={16} />
        </button>
      ) : (
        shown && <MonoLabel className="block">{t('context.title')}</MonoLabel>
      )}
      {state === 'missing' ? (
        file && <p className="microcopy">{t('context.missing', { name: file.name })}</p>
      ) : (
        <ContextBody
          kind={kind}
          id={id}
          origin={file?.name || ''}
          collapsed={!open}
          onFound={() => setState('found')}
          onMissing={() => setState('missing')}
          onError={() => setState('error')}
        />
      )}
    </section>
  )
}

// The episode key a show's line is filed under, as the server spells it (s01e04).
export const episodeKey = (row) =>
  row?.season != null && row?.episode != null && row.season !== '' && row.episode !== ''
    ? `s${String(row.season).padStart(2, '0')}e${String(row.episode).padStart(2, '0')}`
    : ''

const RULE_MAX = 15
const WINDOW_FROM = {
  quote: 'context.window.from.quote',
  work: 'context.window.from.work',
  board: 'context.window.from.board',
  global: 'context.window.from.global',
}

// RuleSlider — one half of a rule. The leftmost stop is NOT 0: it is "inherited", because
// NULL and 0 are different facts (0 is "nothing, deliberately") and a control that offered
// only numbers could not say "nobody has said". `value` is null for inherited.
export function RuleSlider({ label, value, onCommit }) {
  const [live, setLive] = useState(null)
  const shown = live ?? (value == null ? -1 : value)
  return (
    <Slider
      label={label}
      min={-1}
      max={RULE_MAX}
      step={1}
      value={value == null ? -1 : value}
      readout={shown < 0 ? t('context.rule.inherit') : String(shown)}
      onLive={setLive}
      onCommit={(v) => {
        setLive(null)
        onCommit(v < 0 ? null : v)
      }}
    />
  )
}

// ContextRule — a work's or a board's own rule for how much context its quotes show, with
// a way back to inherited. CHANGING IT ASKS what to do with the quotes already here, and
// the answers are a clamp (narrow the ones that show more, never widen) or a clear (drop
// their own adjustments, the only way a raise reaches them) — or leave them be. `scope` is
// book | movie | board.
export function ContextRule({ scope, id }) {
  const [rule, setRule] = useState(null)
  const [asking, setAsking] = useState(null) // the rule awaiting an answer
  const [error, setError] = useState('')
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let live = true
    json('GET', `/context-rules/${scope}/${id}`, undefined, { timeoutMs: QUICK_MS }).then((r) => {
      if (!live) return
      if (r.ok) setRule({ before: r.data?.before ?? null, after: r.data?.after ?? null })
      setError(r.ok ? '' : t('context.rule.error', { why: sourceFail(r) }))
    })
    return () => {
      live = false
    }
  }, [scope, id, tick])
  if (error) return <LoadFailed text={error} onRetry={() => setTick((n) => n + 1)} />
  if (!rule) return null
  const noun = scope === 'board' ? 'board' : 'work'
  const apply = async (enforce) => {
    const next = asking
    setAsking(null)
    const r = await json('PUT', `/context-rules/${scope}/${id}`, { ...next, enforce }, { timeoutMs: QUICK_MS })
    if (r.ok) {
      setRule(next)
      invalidateContext()
    } else toast(sourceFail(r))
  }
  const change = (half, v) => {
    if (v === rule[half]) return
    setAsking({ ...rule, [half]: v })
  }
  return (
    <div className="flex flex-col gap-3" data-testid="context-rule">
      <div className="flex items-center gap-2">
        <MonoLabel>{t('context.rule.title')}</MonoLabel>
        <InfoDot title={t('context.rule.title')} text={t(noun === 'board' ? 'context.rule.board.info' : 'context.rule.work.info')} />
      </div>
      <RuleSlider label={t('context.rule.before.label')} value={rule.before} onCommit={(v) => change('before', v)} />
      <RuleSlider label={t('context.rule.after.label')} value={rule.after} onCommit={(v) => change('after', v)} />
      {(rule.before != null || rule.after != null) && (
        <GhostButton type="button" onClick={() => setAsking({ before: null, after: null })}>
          <span>{t('context.rule.reset')}</span>
        </GhostButton>
      )}
      {asking && (
        <FormModal open onClose={() => setAsking(null)} title={t('context.rule.ask.title')} maxWidth={460}>
          <div className="flex flex-col gap-3">
            <p className="microcopy">{t('context.rule.ask.body')}</p>
            <GhostButton type="button" onClick={() => apply('clamp')}>
              <span>{t('context.rule.ask.clamp')}</span>
            </GhostButton>
            <GhostButton type="button" onClick={() => apply('')}>
              <span>{t('context.rule.ask.leave')}</span>
            </GhostButton>
            <GhostButton type="button" onClick={() => apply('clear')}>
              <span>{t(noun === 'board' ? 'context.rule.ask.clear.board' : 'context.rule.ask.clear.work')}</span>
            </GhostButton>
            <GhostButton type="button" onClick={() => setAsking(null)}>
              <span>{t('context.rule.ask.cancel')}</span>
            </GhostButton>
          </div>
        </FormModal>
      )}
    </div>
  )
}
