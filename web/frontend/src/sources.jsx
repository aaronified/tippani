import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { FormModal, Field, GhostButton, IconDelete, InfoDot, MonoLabel, Slider, toast, useFilePick } from './ui.jsx'
import { json, putUpload } from './api.js'
import { registerSessionCache } from './sessionCaches.js'
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
    <>
    <div className="flex flex-wrap items-center gap-2" data-testid="source-line">
      {rows.map((s) => (
        <span key={s.id} className="flex items-center gap-2">
          <span>
            {s.state === 'pruned'
              ? t('common.source.holds.pruned', { name: s.name })
              : t('common.source.holds', { name: s.name, size: sizeOf(s.bytes) })}
          </span>
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
    <ContextRule scope={kind === 'book' ? 'book' : 'movie'} id={item.id} />
    </>
  )
}

const sizeOf = (n) => (n >= 1 << 20 ? `${(n / (1 << 20)).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)

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
      json('GET', `/sources/context-ids?${q}`).then((r) => new Set(r.ok ? r.data?.ids || [] : [])),
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
  const [ctx, setCtx] = useState(null)
  const [error, setError] = useState('')
  const [more, setMore] = useState(null) // { before, after } or null for the default
  const [tick, setTick] = useState(0)
  const [adjusting, setAdjusting] = useState(false)
  useEffect(() => {
    let live = true
    const q = more ? `?before=${more.before}&after=${more.after}` : ''
    json('GET', `/quotes/${kind}/${id}/context${q}`).then((r) => {
      if (!live) return
      if (r.ok) setCtx(r.data)
      else setError(r.data?.error || t('common.source.error'))
    })
    return () => {
      live = false
    }
  }, [kind, id, more, tick])
  // The quote's own adjustment, one half or both; "" puts a half back to inherited. The panel
  // then asks again, so what it shows is what the cascade now says.
  const adjust = async (body) => {
    const r = await json('POST', '/quotes/context-span', { kind, ids: [id], ...body })
    if (!r.ok) {
      toast(r.data?.error || t('common.source.error'))
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
    <FormModal open onClose={onClose} title={t('context.title')} maxWidth={640}>
      {error && <p className="microcopy" style={{ color: 'var(--error)' }}>{error}</p>}
      {ctx && (
        <div className="flex flex-col gap-3" data-testid="context-panel">
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
        </div>
      )}
    </FormModal>
  )
}

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
  useEffect(() => {
    let live = true
    json('GET', `/context-rules/${scope}/${id}`).then((r) => {
      if (live && r.ok) setRule({ before: r.data?.before ?? null, after: r.data?.after ?? null })
    })
    return () => {
      live = false
    }
  }, [scope, id])
  if (!rule) return null
  const noun = scope === 'board' ? 'board' : 'work'
  const apply = async (enforce) => {
    const next = asking
    setAsking(null)
    const r = await json('PUT', `/context-rules/${scope}/${id}`, { ...next, enforce })
    if (r.ok) {
      setRule(next)
      invalidateContext()
    } else toast(r.data?.error || t('common.source.error'))
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
