// Force-fetch & re-verify (ROADMAP §2) — the review-before-apply flow. Takes a
// selection ({book_ids, movie_ids, people}), has the server check it against
// the live sources as a `reverify` job (nothing written, real progress from the
// job), then presents every changed field as a stored-vs-fresh row with an
// approve checkbox. "Apply approved" is a `reverify-apply` job carrying exactly
// the approved values and, per field, the stored value the reader saw. Pure
// fills (stored empty) default to approved; anything that would overwrite
// defaults to unticked — reviewing is the point. One component serves both form
// factors: a MobileSheet on phones, a centered scrollable overlay on desktop.
import { useEffect, useRef, useState } from 'react'
import { coverImgURL } from './api.js'
import { t } from './i18n.js'
import { isLive, jobStateLabel, jobTitle, jobWaitingText, limitJob, readJobResult, startJob, stopJob, useJob } from './jobs.js'

import {
  ariaLabelText,
  CloseButton,
  EmptyState,
  ErrorText,
  GhostButton,
  HandCard,
  ExpandableDescription,
  MobileSheet,
  MonoLabel,
  NameScroll,
  ProgressBar,
  ProviderMark,
  sourceName,
  Tooltip,
  useBodyScrollLock,
  useIsMobileScreen,
  useBackToClose,
  SCRIM,
  backdropClose,
  IconChevron,
  toast,
  useConfirm,
} from './ui.jsx'

const IMAGE_FIELDS = new Set(['cover', 'poster', 'portrait'])
// FIELD_KEYS — the server's field token, to the shared key that names it for a
// reader. A table rather than a key built from the token, because the two
// genuinely differ: published_year and release_year are both "Year", series_index
// is "Series #", and a token with no row should fall through to something legible
// rather than resolve to a missing key.
//
// The nine that had no word anywhere in the app before this — cast, portrait,
// bio, born, died, links, identity and the two ids — were added to common.field.*
// rather than keyed here, because a field's name is the same field's name
// wherever it is drawn.
const FIELD_KEYS = {
  title: 'common.field.title.label',
  author: 'common.field.author.label',
  description: 'common.field.description.label',
  published_year: 'common.field.year.label',
  release_year: 'common.field.year.label',
  series: 'common.field.series.label',
  series_index: 'common.field.series-no.label',
  isbn: 'common.field.isbn.label',
  genres: 'common.field.genres.label',
  cover: 'common.field.cover.label',
  poster: 'common.field.poster.label',
  director: 'common.field.director.label',
  cast: 'common.field.cast.label',
  portrait: 'common.field.portrait.label',
  bio: 'common.field.bio.label',
  born: 'common.field.born.label',
  died: 'common.field.died.label',
  links: 'common.field.links.label',
  identity: 'common.field.identity.label',
  tmdb_id: 'common.field.tmdb-id.label',
  tvdb_id: 'common.field.tvdb-id.label',
}

// fieldName — the reader's word for a diff row. The fallback is the old
// behaviour, kept for a field a newer server knows about and this build does not.
const fieldName = (field) =>
  FIELD_KEYS[field] ? t(FIELD_KEYS[field]) : String(field).replace(/_/g, ' ')

// STATUS_KEYS — why an item had nothing checked, or could not be.
const STATUS_KEYS = {
  unpinned: 'reverify.status.unpinned',
  fetch_failed: 'reverify.status.fetch-failed',
  not_found: 'reverify.status.not-found',
}

// kindLabel — the chip beside an item's name. A work is named by its media kind,
// a person by the role they were credited in, and both vocabularies already
// exist elsewhere in the app.
const kindLabel = (item) =>
  item.type === 'person'
    ? t(`common.field.${item.kind}.label`)
    : t(`vocab.kind.${item.type}.label`)

// itemKey identifies one previewed item across the approval state maps.
const itemKey = (it) => (it.type === 'person' ? `person:${it.kind}:${it.name}` : `${it.type}:${it.id}`)

// emptyStored — a "pure fill": approving it can't lose anything, so it
// defaults to ticked; overwrites default to unticked.
function emptyStored(v) {
  if (v == null || v === '' || v === 0) return true
  return Array.isArray(v) && v.length === 0
}

export function ValueCell({ field, value, fresh }) {
  if (value == null || value === '' || (Array.isArray(value) && value.length === 0)) {
    return <span className="microcopy">—</span>
  }
  if (IMAGE_FIELDS.has(field)) {
    // Stored images are local files; fresh ones are provider URLs (all on the
    // CSP img-src allowlist).
    return (
      <img
        src={fresh ? value : coverImgURL(value)}
        alt=""
        loading="lazy"
        style={{ width: 68, aspectRatio: '2 / 3', objectFit: 'cover', borderRadius: 6, border: '1px solid var(--ink-border)' }}
      />
    )
  }
  if (field === 'genres') {
    return (
      <span className="flex flex-wrap gap-1">
        {value.map((g) => <span key={g} className="tp-chip">{g}</span>)}
      </span>
    )
  }
  if (field === 'cast') {
    return (
      <span className="block" style={{ fontSize: 'var(--type-ui-12)' }}>
        {value.slice(0, 6).map((m, i) => (
          <NameScroll key={i} className="block">{m.character || '—'} · {m.actor || '—'}</NameScroll>
        ))}
        {value.length > 6 && (
          <span className="microcopy">{t('reverify.value.more', { n: value.length - 6 })}</span>
        )}
      </span>
    )
  }
  // LONG TEXT FOLDS, AND THE FOLD OPENS. It clamped to four lines and put the
  // whole string in `title` — which is a hover, and a hover is not a way out on a
  // phone: a reader comparing what is stored against what a supplier says could
  // not see the rest of either. `ExpandableDescription` is the app's fold and
  // draws its chevron only when something is actually hidden, so a short value is
  // unchanged. `clamp-has-a-way-out.test.js` is the guard that named this one.
  return (
    <ExpandableDescription
      text={String(value)}
      lines={4}
      style={{ color: 'var(--ink)', fontSize: 'var(--type-ui-13)', lineHeight: 1.45, overflowWrap: 'anywhere', whiteSpace: 'pre-line' }}
    />
  )
}

// FieldDiffRow — what is stored, beside what each supplier says.
//
// IT USED TO BE TWO COLUMNS: stored, and "fresh". That shape encoded the old
// model, where a record took every field from ONE supplier chosen for the whole
// row — so there was only ever one fresh value and a checkbox was enough to say
// yes to it. With a work asked of every supplier it is pinned to, one field can
// have two answers that disagree, and the reader is choosing a SOURCE as much as
// a value.
//
// SO EACH SUPPLIER GETS ITS OWN CELL and picking one takes the field. The
// checkbox stays for the single-answer case — most fields, most of the time —
// and picking a cell ticks it, because requiring both would make the common
// gesture two gestures for no meaning.
//
// The cells are the same component in the same grid whatever the kind of work.
// A book's suppliers and a film's are different names in the same layout, which
// is the point: there is one reviewer and it does not know what it is reviewing.
function FieldDiffRow({ diff, picked, onToggle, onChoose }) {
  const alts = diff.alts || []
  const choosing = alts.length > 1
  return (
    <div className="flex items-start gap-3 py-2" style={{ borderTop: '1px solid var(--line)' }}>
      <label className="flex items-center gap-2" style={{ cursor: 'pointer', flex: 'none', paddingTop: 2 }}>
        <Tooltip label={t('reverify.field.approve.tip')} side="top">
          <input type="checkbox" checked={!!picked} onChange={onToggle} />
        </Tooltip>
        <MonoLabel style={{ width: 92 }}>{fieldName(diff.field)}</MonoLabel>
      </label>
      <div
        className="grid min-w-0 flex-1 gap-2"
        style={{ gridTemplateColumns: `repeat(${choosing ? alts.length + 1 : 2}, minmax(0, 1fr))` }}
      >
        <div className="min-w-0">
          <MonoLabel className="mb-1 block" style={{ fontSize: 'var(--type-ui-9)', color: 'var(--faint)' }}>
            {t('reverify.column.stored')}
          </MonoLabel>
          <ValueCell field={diff.field} value={diff.stored} />
          {/* A REVIEW OPENED LATER, FROM A FINISHED JOB, reads the stored value
              as it is NOW, and the server marks a field somebody changed after
              the check. It is never ticked for the reader, and this says why. */}
          {diff.changed && <p className="microcopy mt-1">{t('reverify.column.changed')}</p>}
        </div>
        {choosing ? (
          alts.map((a) => {
            const on = picked === a.source
            return (
              <button
                key={a.source}
                type="button"
                onClick={() => onChoose(a.source)}
                aria-pressed={on}
                className="min-w-0 text-left"
                style={{
                  background: 'none', padding: '2px 6px', cursor: 'pointer',
                  border: `1px solid ${on ? 'var(--accent)' : 'transparent'}`,
                  borderRadius: 6,
                }}
              >
                {/* THE SUPPLIER'S OWN MARK, not only its name. The reader is
                    scanning a grid of four columns for "which of these did Google
                    write", and a mark is recognised without being read — which is
                    the argument docs/wiki/Provider-marks.md makes for carrying them at
                    all, and this is the densest place in the app it applies to. */}
                <MonoLabel className="mb-1 flex items-center gap-1" style={{ fontSize: 'var(--type-ui-9)', color: on ? 'var(--accent-ui)' : 'var(--faint)' }}>
                  <ProviderMark source={a.source} size={13} />
                  {sourceName(a.source)}
                </MonoLabel>
                <ValueCell field={diff.field} value={a.value} fresh={on} />
              </button>
            )
          })
        ) : (
          <div className="min-w-0">
            <MonoLabel className="mb-1 block" style={{ fontSize: 'var(--type-ui-9)', color: 'var(--accent-ui)' }}>
              {t('reverify.column.fresh')}
            </MonoLabel>
            <ValueCell field={diff.field} value={diff.fresh} fresh />
          </div>
        )}
      </div>
    </div>
  )
}

function ReverifyItemCard({ item, open, onToggleOpen, approvals, onToggleField, onChooseSource, onSetAll }) {
  const key = itemKey(item)
  const approvedCount = item.diffs.filter((d) => approvals[`${key}|${d.field}`]).length
  const kindChip = kindLabel(item)
  return (
    <HandCard className="px-4 py-3">
      <Tooltip label={t('reverify.item.open.tip')} side="top" className="w-full">
        <button
          type="button"
          className="flex w-full items-center gap-2 text-left"
          style={{ background: 'none', border: 'none', padding: 0 }}
          onClick={onToggleOpen}
          aria-expanded={open}
        >
          <NameScroll className="min-w-0 font-semibold" style={{ fontFamily: 'var(--font-quote-base)', fontWeight: 'var(--font-quote-base-weight)', fontStyle: 'var(--font-quote-base-style)', fontVariantCaps: 'var(--font-quote-base-caps)', textTransform: 'var(--font-quote-base-case)', fontVariantNumeric: 'var(--font-quote-base-figures)', fontSize: 'var(--type-display-15)' }}>
            {item.title || item.name}
          </NameScroll>
          <MonoLabel style={{ fontSize: 'var(--type-display-9)', flex: 'none' }}>{kindChip}{item.source ? ` · ${item.source}` : ''}</MonoLabel>
          <MonoLabel className="ml-auto" style={{ fontSize: 'var(--type-ui-11)', color: 'var(--accent-ui)', flex: 'none' }}>
            {t('reverify.item.approved', { n: approvedCount, total: item.diffs.length })}{' '}
            <IconChevron open={open} size={13} />
          </MonoLabel>
        </button>
      </Tooltip>
      {open && (
        <div className="mt-2">
          <div className="mb-1 flex justify-end gap-3">
            <button type="button" className="tp-link" style={{ fontSize: 'var(--type-ui-11)' }} onClick={() => onSetAll(item, true)}>
              {t('reverify.item.approve-all')}
            </button>
            <button type="button" className="tp-link" style={{ fontSize: 'var(--type-ui-11)' }} onClick={() => onSetAll(item, false)}>
              {t('reverify.item.approve-none')}
            </button>
          </div>
          {item.diffs.map((d) => (
            <FieldDiffRow
              key={d.field}
              diff={d}
              picked={approvals[`${key}|${d.field}`]}
              onToggle={() => onToggleField(item, d.field)}
              onChoose={(src) => onChooseSource(item, d.field, src)}
            />
          ))}
        </div>
      )}
    </HandCard>
  )
}

// `fillsOnly` IS THE PACK'S "FETCH EMPTY FIELDS", and it is a filter on this flow
// rather than a second one.
//
// The pack draws two bulk acts over the works console: fetch what is empty, and
// re-verify what is filled (`metadata.dc.html:852`). The second is this flow
// exactly. The first is this flow with everything that would OVERWRITE dropped —
// the seed below already ticks precisely the empty-stored rows, so the two acts
// were already one act and its default, with no way to ask for only the default.
// A separate unattended endpoint was the alternative, and it would have been a
// second trust boundary over the same writes: the reader would have no way to see
// what a hundred works were about to be given.
//
// WHAT IT DOES NOT DO is apply without asking. A bulk act that writes to a
// hundred records on one press is the thing the review step exists to prevent,
// and the pack's own list of the works is what a reader wants to see first.
//
// THE CHECK IS A JOB ON THE SERVER (3.1.0), and so is the apply. The check used
// to be a loop of POST /metadata/reverify calls from this dialog, which lived and
// died with it: close the dialog, lock the phone, and a check of four hundred
// works stopped wherever it was. Now the dialog starts a `reverify` job and draws
// it, and the job outlives the dialog.
//
// SO CLOSING AND CANCELLING ARE TWO DIFFERENT PRESSES NOW, and each says which it
// is. ✕, Back and the scrim CLOSE: the job goes on, and a toast says where it
// will be (Settings › Jobs, where a finished check has a Review press). Cancel,
// while the check runs, STOPS it — after the item in hand — and asks first,
// because a press that used to mean "never mind" now ends somebody's work.
//
// `jobId` IS A CHECK THAT ALREADY RAN, OR IS STILL RUNNING, ON THE SERVER.
// Settings › Jobs' Review sends the reader here with its job in the address
// (/metadata/reverify/{job}). There is nothing to start: the flow watches the job
// and opens on its findings (GET /jobs/{id}/result) with the stored values as
// they are NOW; a field the server marks `changed` — somebody edited it after the
// check — is never ticked for the reader, even when it is empty, because the
// check's answer was about a value that is gone. The same is true of a check this
// dialog started, which is read back the same way when it ends.
//
// THE APPLY CARRIES `expect`, per field, the stored value the reader was shown.
// A field somebody changed between the review and the press is skipped by the
// server with a note rather than overwritten, and `from_job` ties the apply to
// the check, which is how Past jobs knows the check has been decided.
//
// `routed` SAYS THE ADDRESS OPENED IT, so the address is already the history
// entry a Back leaves: the flow pushes no marker of its own, and `onClose` is
// the shell's Back. With a marker as well, one Back would close the flow and
// leave the reader on an address that opens it again. A routed flow toasts
// nothing on close: the reader came from Settings › Jobs and is going back there.
export function ReverifyFlow({ selection = null, fillsOnly: fillsOnlyProp = false, jobId = null, routed = false, onClose, onFlash, onDone }) {
  const mobile = useIsMobileScreen()
  const [items, setItems] = useState([]) // previewed items, all statuses
  // starting: the check is being asked for; checking: it runs (or waits); loading:
  // a finished check's findings are on their way.
  const [phase, setPhase] = useState(jobId ? 'loading' : 'starting') // starting | checking | loading | failed | review | applying | done
  const [approvals, setApprovals] = useState({}) // "key|field" -> source slug
  const [openItem, setOpenItem] = useState(null) // itemKey expanded
  const [results, setResults] = useState(null) // apply results
  const [err, setErr] = useState('')
  const [checkId, setCheckId] = useState(jobId)
  // `{kept, total}` when the selection was over what one check holds — see the
  // start below.
  const [capped, setCapped] = useState(null)
  const [applyId, setApplyId] = useState(null)
  const check = useJob(checkId)
  const applied = useJob(applyId)
  const checkJob = check.job && check.job.id === checkId ? check.job : null
  const applyJob = applied.job && applied.job.id === applyId ? applied.job : null
  // A job's own `fills_only`: the surface is headed by the act that started it,
  // whichever screen that was.
  const fillsOnly = fillsOnlyProp || !!checkJob?.params?.fills_only
  const { ask, confirmDialog } = useConfirm()
  const alive = useRef(true)
  const readFindings = useRef(false)
  useEffect(() => {
    alive.current = true
    return () => { alive.current = false }
  }, [])

  // CLOSING KEEPS THE JOB, and says where it is — see the header.
  function close() {
    if (!routed && (phase === 'starting' || phase === 'checking' || phase === 'applying')) toast(t('reverify.kept.running'))
    else if (!routed && phase === 'review') toast(t('reverify.kept.review'))
    onClose?.()
  }

  // ITS OWN BACK ENTRY — see PersonModal. A surface that pushes none is dismissed
  // by the press that was meant for it AND by whatever is underneath, because the
  // panel stack and the screen both keep entries and this one kept nothing.
  useBackToClose(!routed, close)

   // The page behind an overlay does not move. Without this a wheel or a swipe
  // running past the end of the dialog scrolls the page you cannot see, which is
  // still scrolled when you close this. Ref-counted, so a dialog opened from
  // inside a sheet does not unlock the sheet on its way out.
  useBodyScrollLock(true)

  // Seeds the approvals: a pure fill (nothing stored) is ticked, an overwrite is
  // not — and nothing the server says changed since the check is ticked at all.
  function review(all) {
    const seed = {}
    for (const it of all) {
      for (const d of it.diffs || []) {
        seed[`${itemKey(it)}|${d.field}`] = emptyStored(d.stored) && !d.changed ? defaultSourceFor(it, d) : undefined
      }
    }
    setItems(all)
    setApprovals(seed)
    const changed = all.filter((it) => it.status === 'ok' && (it.diffs || []).length > 0)
    if (changed.length === 1) setOpenItem(itemKey(changed[0]))
    setPhase('review')
  }

  // A SELECTION: ask for the check. The server narrows a "fetch empty fields"
  // check to the fills itself, so the findings arrive already filtered. A second
  // dialog over the same selection while the first check runs gets the server's
  // "already running" with that job's id, and watches it.
  //
  // ONE CHECK HOLDS 500 ITEMS, and a bigger selection — every person the People
  // console shows, a Select all over the works — is checked up to that and SAYS
  // so, above everything else, before anything is checked. The server refuses a
  // bigger job whole, and a refusal after the press is news the screen had before
  // it. Not split into several checks: a check ends in one review the reader
  // decides as a whole, and several would be several reviews.
  useEffect(() => {
    if (jobId || !selection) return
    ;(async () => {
      const { params, kept, total } = limitJob('reverify', {
        book_ids: selection.book_ids || [],
        movie_ids: selection.movie_ids || [],
        people: selection.people || [],
        fills_only: !!fillsOnlyProp,
      })
      if (kept < total) setCapped({ kept, total })
      const r = await startJob('reverify', params)
      if (!alive.current) return
      const id = r.ok ? r.job?.id : r.jobId
      if (!id) {
        setErr(r.error)
        setPhase('failed')
        return
      }
      setCheckId(id)
      setPhase((p) => (p === 'starting' ? 'checking' : p))
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // THE CHECK, AS THE SERVER TELLS IT. Live: its progress. Succeeded: its
  // findings, read once. Anything else: why there is nothing to review.
  useEffect(() => {
    if (!checkJob) return
    if (isLive(checkJob)) {
      setPhase((p) => (p === 'starting' || p === 'loading' ? 'checking' : p))
      return
    }
    if (readFindings.current) return
    readFindings.current = true
    if (checkJob.state === 'failed') {
      setErr(checkJob.error || t('error.reverify.preview'))
      setPhase('failed')
      return
    }
    if (checkJob.state !== 'succeeded') {
      // Stopped from Settings › Jobs, or cut short by a restart: a check that did
      // not reach the end has no findings to review.
      setErr(`${jobTitle(checkJob)} · ${jobStateLabel(checkJob.state)}`)
      setPhase('failed')
      return
    }
    setPhase('loading')
    readJobResult(checkJob.id).then((found) => {
      if (!alive.current) return
      if (!found.ok || found.kind !== 'reverify' || !Array.isArray(found.result)) {
        setErr(found.ok ? t('error.reverify.preview') : found.error)
        setPhase('failed')
        return
      }
      review(found.result.map((it) => ({ ...it, diffs: it.diffs || [] })))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkJob?.id, checkJob?.state])

  // A JOB THAT CANNOT BE READ AT ALL — past its thirty days, or not this
  // reader's — is the error alone; there is no "everything is up to date" to say
  // about findings nobody can see.
  useEffect(() => {
    if (checkJob || !check.error || (phase !== 'loading' && phase !== 'checking')) return
    setErr(check.error)
    setPhase('failed')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [check.error])

  const changed = items.filter((it) => it.status === 'ok' && (it.diffs || []).length > 0)
  const clean = items.filter((it) => it.status === 'ok' && (it.diffs || []).length === 0).length
  const skipped = items.filter((it) => it.status === 'unpinned').length
  const failedCount = items.filter((it) => it.status === 'fetch_failed' || it.status === 'not_found').length
  const approvedTotal = changed.reduce(
    (n, it) => n + it.diffs.filter((d) => approvals[`${itemKey(it)}|${d.field}`]).length, 0)

  // AN APPROVAL IS NOW A CHOICE OF SOURCE, not a yes/no.
  //
  // A work pinned to two suppliers is asked of both, so a field can carry what
  // each of them said and the reader can take the description from one and the
  // year from another. The state therefore holds WHICH source was picked rather
  // than whether the row was ticked: `undefined` is untaken, and a supplier slug
  // is taken-from-that-supplier.
  //
  // A field with no alternatives still works exactly as before — ticking it
  // stores the preferred source's slug, which is the same value it always sent,
  // now merely labelled.
  function toggleField(item, field) {
    const k = `${itemKey(item)}|${field}`
    const d = item.diffs.find((x) => x.field === field)
    setApprovals((a) => ({ ...a, [k]: a[k] ? undefined : defaultSourceFor(item, d) }))
  }
  function chooseSource(item, field, source) {
    const k = `${itemKey(item)}|${field}`
    // PICKING A SOURCE TAKES THE FIELD. Requiring a tick as well would make the
    // common gesture two gestures, and there is no meaning to "I choose TheTVDB's
    // description but do not want it".
    setApprovals((a) => ({ ...a, [k]: a[k] === source ? undefined : source }))
  }
  function setAllFields(item, on) {
    setApprovals((a) => {
      const next = { ...a }
      for (const d of item.diffs) {
        next[`${itemKey(item)}|${d.field}`] = on ? defaultSourceFor(item, d) : undefined
      }
      return next
    })
  }

  async function apply() {
    const payload = changed
      .map((it) => {
        const set = {}
        const sources = {}
        // WHAT THE READER WAS SHOWN AS STORED, per field — the server compares it
        // with what is stored when the apply runs, and skips a field somebody
        // changed in between rather than overwrite a value nobody reviewed. An
        // absent value is sent as null: JSON drops an undefined, and a dropped
        // key would be a field applied with no check at all.
        const expect = {}
        for (const d of it.diffs) {
          const picked = approvals[`${itemKey(it)}|${d.field}`]
          if (!picked) continue
          // The value that BELONGS to the chosen source. Falling back to `fresh`
          // covers the ordinary single-source field, where fresh is by definition
          // the preferred supplier's answer.
          const alt = (d.alts || []).find((a) => a.source === picked)
          set[d.field] = alt ? alt.value : d.fresh
          sources[d.field] = picked
          expect[d.field] = d.stored === undefined ? null : d.stored
        }
        if (Object.keys(set).length === 0) return null
        return it.type === 'person'
          ? { type: 'person', kind: it.kind, name: it.name, set, expect }
          : { type: it.type, id: it.id, set, sources, source: it.source, expect }
      })
      .filter(Boolean)
    if (payload.length === 0) return
    setPhase('applying')
    setErr('')
    const r = await startJob('reverify-apply', { items: payload, from_job: checkId })
    if (!alive.current) return
    const id = r.ok ? r.job?.id : r.jobId
    if (!id) {
      setErr(r.error)
      setPhase('review')
      return
    }
    setApplyId(id)
  }

  // THE APPLY, AS THE SERVER TELLS IT. Its results are the job's result — one
  // line per item, the same lines the synchronous apply answered with. A stopped
  // or interrupted apply still shows the items it reached, under a line saying
  // it did not reach the end.
  useEffect(() => {
    if (!applyJob || isLive(applyJob)) return
    if (applyJob.state === 'failed') {
      setErr(applyJob.error || t('error.reverify.apply'))
      setPhase('review')
      return
    }
    readJobResult(applyJob.id).then((found) => {
      if (!alive.current) return
      const all = found.ok && Array.isArray(found.result) ? found.result : null
      if (!all) {
        setErr(found.ok ? t('error.reverify.apply') : found.error)
        setPhase('review')
        return
      }
      if (applyJob.state !== 'succeeded') setErr(`${jobTitle(applyJob)} · ${jobStateLabel(applyJob.state)}`)
      setResults(all)
      setPhase('done')
      const okCount = all.filter((x) => x.ok).length
      const failCount = all.length - okCount
      const notes = all.filter((x) => x.note).length
      // Joined here for the same reason as the summary line below.
      onFlash?.(
        [
          t('reverify.flash', { count: okCount, n: okCount }),
          failCount && t('reverify.flash.failed', { n: failCount }),
          notes && t('reverify.flash.skipped', { count: notes, n: notes }),
        ]
          .filter(Boolean)
          .join(' · '),
      )
      onDone?.()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyJob?.id, applyJob?.state])

  // CANCEL WHILE CHECKING IS STOP, and it asks — see the header. Anywhere else it
  // is the same as closing.
  async function cancel() {
    if (phase !== 'checking' || !checkId) return close()
    const yes = await ask(t('reverify.stop.confirm.title'), {
      body: t('reverify.stop.confirm.body'),
      confirmLabel: t('reverify.stop.confirm.verb'),
      danger: true,
    })
    if (!yes) return
    const r = await stopJob(checkId)
    if (!r.ok) return toast(r.error)
    onClose?.()
  }

  const running = checkJob && checkJob.state === 'running' ? checkJob : null
  const body = (
    <div className="space-y-3">
      {capped && phase !== 'failed' && phase !== 'done' && (
        <p className="microcopy">{t('reverify.capped', capped)}</p>
      )}
      {phase === 'loading' && <p className="microcopy">{t('common.state.loading')}</p>}
      {(phase === 'starting' || phase === 'checking') && (
        <>
          <p className="microcopy">{t('reverify.checking.prose')}</p>
          {/* The job's own count, read from the server. A check still in the queue
              says where it stands rather than drawing a bar that is not moving. */}
          <ProgressBar
            value={running?.done || 0}
            max={running?.total || 0}
            label={checkJob?.state === 'queued'
              ? jobWaitingText(checkJob)
              : t('reverify.checking.progress', { done: running?.done || 0, total: running?.total || checkJob?.total || 0 })}
          />
          {!routed && <p className="microcopy">{t('reverify.checking.away')}</p>}
        </>
      )}
      {phase !== 'starting' && phase !== 'checking' && phase !== 'loading' && phase !== 'failed' && (
        <MonoLabel className="block" style={{ fontSize: 'var(--type-ui-11)' }}>
          {/* THE SEPARATOR IS JOINED HERE, NOT CARRIED IN THE VALUE. These three
              read as one middot-joined line, and the first draft put the " · "
              at the head of each tail value — where parseLocale trims it off,
              silently, so the line came out as "9 up to date· 2 skipped". A
              locale value cannot hold leading punctuation; the code owns it. */}
          {[
            t('reverify.summary', { checked: items.length, changed: changed.length, clean }),
            skipped > 0 && t('reverify.summary.skipped', { n: skipped }),
            failedCount > 0 && t('reverify.summary.failed', { n: failedCount }),
          ]
            .filter(Boolean)
            .join(' · ')}
        </MonoLabel>
      )}
      <ErrorText>{err}</ErrorText>
      {(phase === 'review' || phase === 'applying') && changed.length === 0 && (
        <EmptyState>{t('reverify.clean')}</EmptyState>
      )}
      {(phase === 'review' || phase === 'applying') &&
        changed.map((it) => (
          <ReverifyItemCard
            key={itemKey(it)}
            item={it}
            open={openItem === itemKey(it)}
            onToggleOpen={() => setOpenItem((k) => (k === itemKey(it) ? null : itemKey(it)))}
            approvals={approvals}
            onToggleField={toggleField}
            onChooseSource={chooseSource}
            onSetAll={setAllFields}
          />
        ))}
      {(phase === 'review' || phase === 'applying') &&
        items.filter((it) => it.status === 'fetch_failed' || it.status === 'unpinned' || it.status === 'not_found')
          .map((it) => (
            <p key={itemKey(it)} className="microcopy">
              {it.title || it.name}:{' '}
              {it.error || (STATUS_KEYS[it.status] ? t(STATUS_KEYS[it.status]) : it.status)}
            </p>
          ))}
      {phase === 'done' && results && (
        <div className="space-y-1">
          {results.map((x, i) => (
            <p key={i} className="microcopy" style={x.ok ? undefined : { color: 'var(--error)' }}>
              {x.type} {x.id || x.name}:{' '}
              {x.ok
                ? x.note
                  ? t('reverify.result.applied-note', { note: x.note })
                  : t('reverify.result.applied')
                : x.error}
            </p>
          ))}
        </div>
      )}
    </div>
  )

  const footer = (
    <div className="flex w-full items-center gap-3">
      {phase === 'done' ? (
        <button type="button" className="tp-btn tp-btn-primary tactile ml-auto" onClick={onClose}>
          {t('common.action.close.label')}
        </button>
      ) : (
        <>
          <GhostButton onClick={cancel}>{t('common.action.cancel.label')}</GhostButton>
          <button
            type="button"
            className="tp-btn tp-btn-primary tactile ml-auto"
            disabled={phase !== 'review' || approvedTotal === 0}
            onClick={apply}
          >
            {phase === 'applying'
              ? t('reverify.apply.busy')
              : t('reverify.apply.label', { count: approvedTotal, n: approvedTotal })}
          </button>
        </>
      )}
    </div>
  )

  // THE SURFACE SAYS WHICH ACT OPENED IT. Landing in a sheet headed "Re-verify"
  // after pressing "Fetch empty fields" is the surface contradicting the button,
  // and a reader cannot tell whether the overwrites are hidden or absent.
  const title = fillsOnly ? t('reverify.title.fills') : t('reverify.title')

  if (mobile) {
    return (
      <>
        {confirmDialog}
        <MobileSheet open onClose={close} title={title} footer={footer}>
          {body}
        </MobileSheet>
      </>
    )
  }
  return (
    <div
      className={SCRIM}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabelText(title)}
      onMouseDown={backdropClose(close)}
    >
      {confirmDialog}
      <HandCard variant={1} className="mx-auto w-full max-w-3xl px-6 py-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="display-title text-xl">{title}</h2>
          <CloseButton onClick={close} />
        </div>
        {body}
        <div className="mt-4" style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
          {footer}
        </div>
      </HandCard>
    </div>
  )
}

// defaultSourceFor — the supplier a plain tick takes a field from: the first
// that answered for it, else the item's own preferred source.
function defaultSourceFor(item, diff) {
  return diff?.alts?.[0]?.source || item.source || ''
}
