import { useEffect, useMemo, useRef, useState } from 'react'
import { categoryName, categoryVar } from './theme.js'
import { json, errText } from './api.js'
import { WorkPicker, workFromBook, workFromMovie } from './AddSurface.jsx'
import { chapterLabel, episodeLabel } from './text.js'
import {
  ANNOTATION_HEX,
  BulkBar,
  ColorSwatches,
  ConfirmDialog,
  EmptyState,
  ErrorText,
  Field,
  FieldIconButton,
  FormModal,
  GhostButton,
  HandCard,
  Hearts,
  IconEdit,
  IconMoveTo,
  IconRuler,
  InfoDot,
  MonoLabel,
  PageHeader,
  Select,
  splitCommas,
  TagChip,
  TokenInput,
  Tooltip,
  useIsMobileScreen,
} from './ui.jsx'

// Pending import — the staging queue (ROADMAP 1.2.0). A bulk import no longer
// enters the library on arrival: it lands here and waits, indefinitely, until it
// is okayed. This is one queue for everything staged from every file, grouped by
// the work each quote will attach to, with the batch (source + filename) as a
// filter, checkbox multi-select over the rows, and a per-row editor for one-offs.
//
// Every mutation is one POST to /import/staged/bulk over the selection, so the
// screen never walks rows one request at a time.

const OPS = [
  ['add', 'add'],
  ['subtract', 'subtract'],
  ['multiply', 'multiply'],
  ['divide', 'divide'],
  ['set', 'set to'],
  ['reset', 'reset'],
]

// The tag beside a group's heading. `quotes` is the synthetic group a batch of
// standalone quotes hangs from (§24, migration 0028) — it is not a work, so it
// has no target to join and nothing to retarget onto.
const KIND_TAG = { book: 'BOOK', movie: 'FILM', show: 'SHOW', quotes: 'QUOTES' }

export default function StagingPage({ onPending, onOpenBook, onOpenMovie, onApproved }) {
  const [queue, setQueue] = useState(null) // {pending, batches, works, quotes}
  const [batch, setBatch] = useState('all')
  const [sel, setSel] = useState(() => new Set())
  const [editing, setEditing] = useState(null) // one staged quote
  const [confirm, setConfirm] = useState(null) // {title, body, label, run}
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState('')
  const [panel, setPanel] = useState('') // '' | 'fields' | 'move' | 'formula'
  const mobile = useIsMobileScreen()
  const reqSeq = useRef(0)

  async function load() {
    const seq = ++reqSeq.current
    const r = await json('GET', '/import/staged')
    if (seq !== reqSeq.current) return // a newer load already answered
    if (!r.ok) return setErr(errText(r, 'could not read the import queue'))
    setErr('')
    setQueue(r.data)
    onPending?.(r.data.pending || 0)
    // Drop ids that are no longer staged (approved or discarded elsewhere).
    const live = new Set((r.data.quotes || []).map((q) => q.id))
    setSel((s) => new Set([...s].filter((id) => live.has(id))))
    // Approving or discarding a whole file takes its batch with it. A filter left
    // pointing at a batch that no longer exists would hide every remaining row
    // while the control itself read "Select…", so fall back to All files.
    setBatch((b) => (b !== 'all' && !(r.data.batches || []).some((x) => String(x.id) === String(b)) ? 'all' : b))
  }
  useEffect(() => {
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const batches = queue?.batches || []
  const works = queue?.works || []
  const quotes = queue?.quotes || []

  // A batch filter, not a batch view: the queue stays one list, and the filter
  // narrows it to the file you are working through.
  const shownQuotes = useMemo(
    () => (batch === 'all' ? quotes : quotes.filter((q) => String(q.batch_id) === String(batch))),
    [quotes, batch],
  )
  // Grouped by target work, in queue order, so a group heading can say where its
  // quotes are going. Driven from the works list rather than from the quotes, so a
  // work staged with NO quotes still shows: an export writes every work, quoted or
  // not, and approving that group is what re-creates the book or film.
  const groups = useMemo(() => {
    const byWork = new Map()
    for (const q of shownQuotes) {
      if (!byWork.has(q.staged_work_id)) byWork.set(q.staged_work_id, [])
      byWork.get(q.staged_work_id).push(q)
    }
    return works
      .filter((w) => (batch === 'all' || String(w.batch_id) === String(batch)) &&
                     (byWork.has(w.id) || w.quotes === 0))
      .map((w) => ({ work: w, items: byWork.get(w.id) || [] }))
  }, [shownQuotes, works, batch])

  const shownIds = shownQuotes.map((q) => q.id)
  const selectedIds = shownIds.filter((id) => sel.has(id))
  const n = selectedIds.length
  const allShownSelected = shownIds.length > 0 && selectedIds.length === shownIds.length

  const toggleId = (id) =>
    setSel((s) => {
      const next = new Set(s)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  const toggleGroup = (items) =>
    setSel((s) => {
      const next = new Set(s)
      const on = items.every((q) => next.has(q.id))
      for (const q of items) (on ? next.delete : next.add).call(next, q.id)
      return next
    })
  const clearSel = () => setSel(new Set())

  // One POST for the whole selection; every action funnels through here so the
  // busy flag, the error line and the reload are written once.
  async function apply(body, note) {
    if (busy) return
    setBusy(true)
    setErr('')
    const r = await json('POST', '/import/staged/bulk', { ids: selectedIds, ...body })
    setBusy(false)
    if (!r.ok) return setErr(errText(r, 'could not apply the edit'))
    setFlash(note || `updated ${r.data.updated}`)
    await load()
  }

  async function approve(ids) {
    if (busy) return
    setBusy(true)
    setErr('')
    const r = await json('POST', '/import/staged/approve', ids ? { ids } : { all: true })
    setBusy(false)
    if (!r.ok) return setErr(errText(r, 'could not approve'))
    const { added = 0, skipped = 0, enriched = 0 } = r.data
    setFlash(
      `${added} added · ${skipped} skipped` + (enriched ? ` · ${enriched} enriched` : ''),
    )
    clearSel()
    await load()
    onApproved?.(r.data)
  }

  async function discard(ids) {
    if (busy) return
    setBusy(true)
    setErr('')
    const r = await json('DELETE', '/import/staged', ids ? { ids } : { all: true })
    setBusy(false)
    if (!r.ok) return setErr(errText(r, 'could not discard'))
    setFlash(`discarded ${r.data.discarded}`)
    clearSel()
    await load()
  }

  if (!queue) {
    return (
      <section className="space-y-5">
        <PageHeader title="Pending import" counts="reading the queue…" />
        <ErrorText>{err}</ErrorText>
      </section>
    )
  }

  // A batch can hold works but no quotes (a book exported with none), and that
  // still needs approving or discarding — so the queue is empty only when both are.
  if (queue.pending === 0 && works.length === 0) {
    return (
      <section className="space-y-5">
        <PageHeader title="Pending import" counts="nothing waiting" />
        <EmptyState>
          nothing staged — an import lands here first, and stays until you okay it
        </EmptyState>
      </section>
    )
  }

  const batchOptions = [
    ['all', `All files (${queue.pending})`],
    ...batches.map((b) => [String(b.id), `${b.filename || b.source} · ${b.quotes}`]),
  ]

  const pageActions = (
    <>
      <MonoLabel style={{ color: 'var(--faint)' }}>{flash}</MonoLabel>
      <GhostButton
        disabled={busy}
        onClick={() =>
          setConfirm({
            title: 'Discard everything staged?',
            body: `All ${queue.pending} staged quotes go, from every file. Nothing in your library is touched.`,
            label: 'Discard all',
            run: () => discard(null),
          })
        }
      >
        Discard all
      </GhostButton>
      <button className="tp-btn tp-btn-primary" disabled={busy} onClick={() => approve(null)}>
        Approve all{queue.pending > 0 ? ` ${queue.pending}` : ''}
      </button>
    </>
  )

  return (
    <section className="space-y-5">
      {/* The two page-level actions ride in the header on desktop; on a phone
          they get their own row, because a 390px sticky bar cannot hold a title
          and two buttons without the buttons sitting on the title. */}
      <div className={mobile ? 'mobile-sticky-bar' : ''}>
        <PageHeader
          title="Pending import"
          counts={
            queue.pending > 0
              ? `${queue.pending} quote${queue.pending === 1 ? '' : 's'} waiting`
              : `${works.length} work${works.length === 1 ? '' : 's'} waiting, no quotes`
          }
          right={mobile ? null : pageActions}
        />
      </div>
      {mobile && <div className="flex flex-wrap items-center gap-2">{pageActions}</div>}

      <div className="filter-row">
        <label className="flex items-center gap-2">
          <MonoLabel>File</MonoLabel>
          <Select ariaLabel="Import batch" value={batch} onChange={setBatch} options={batchOptions} width={mobile ? undefined : 260} />
        </label>
        <label className="flex items-center gap-2" style={{ marginLeft: 'auto' }}>
          <input
            type="checkbox"
            checked={allShownSelected}
            onChange={() => setSel(allShownSelected ? new Set() : new Set(shownIds))}
          />
          <span className="microcopy">select all {shownIds.length}</span>
        </label>
      </div>

      <BulkBar n={n} onClear={clearSel}>
        {/* The toast names the CATEGORY, not the token. It said "colour → blue"
            while every card on the screen said "Fact", which reads as a
            different operation than the one you asked for. */}
        <ColorSwatches value="" ariaLabel="Set category" onChange={(c) => apply({ color: c }, `→ ${categoryName(c)}`)} />
        <GhostButton disabled={busy} onClick={() => apply({ favorite: true }, 'favourited')}>
          ♥ favourite
        </GhostButton>
        <Tooltip label="Remove the favourite mark">
          <GhostButton disabled={busy} onClick={() => apply({ favorite: false }, 'unfavourited')}>
            un-♥
          </GhostButton>
        </Tooltip>
        <GhostButton icon={<IconEdit />} onClick={() => setPanel(panel === 'fields' ? '' : 'fields')}>Edit fields…</GhostButton>
        <GhostButton icon={<IconMoveTo />} onClick={() => setPanel(panel === 'move' ? '' : 'move')}>Move to…</GhostButton>
        <GhostButton icon={<IconRuler />} onClick={() => setPanel(panel === 'formula' ? '' : 'formula')}>Locations…</GhostButton>
        <button className="tp-btn tp-btn-primary" disabled={busy} onClick={() => approve(selectedIds)}>
          Approve {n}
        </button>
        <GhostButton
          disabled={busy}
          onClick={() =>
            setConfirm({
              title: `Discard ${n} staged quote${n === 1 ? '' : 's'}?`,
              body: 'They leave the queue without ever entering your library.',
              label: 'Discard',
              run: () => discard(selectedIds),
            })
          }
        >
          Discard
        </GhostButton>
      </BulkBar>

      {n > 0 && panel === 'fields' && <FieldsPanel n={n} busy={busy} onApply={apply} />}
      {n > 0 && panel === 'move' && (
        <MovePanel n={n} busy={busy} works={works} onApply={apply} />
      )}
      {n > 0 && panel === 'formula' && <FormulaPanel n={n} busy={busy} onApply={apply} />}

      <ErrorText>{err}</ErrorText>

      <div className="space-y-8">
        {groups.map(({ work, items }) => (
          <StagedGroup
            key={work.id}
            work={work}
            items={items}
            sel={sel}
            onToggle={toggleId}
            onToggleGroup={() => toggleGroup(items)}
            onEdit={setEditing}
            onOpenBook={onOpenBook}
            onOpenMovie={onOpenMovie}
          />
        ))}
        {groups.length === 0 && <EmptyState>no staged quotes in that file</EmptyState>}
      </div>

      <FormModal open={!!editing} onClose={() => setEditing(null)} title="Edit staged quote">
        {editing && (
          <StagedQuoteForm
            quote={editing}
            onCancel={() => setEditing(null)}
            onSaved={async (fields) => {
              const r = await json('POST', '/import/staged/bulk', { ids: [editing.id], ...fields })
              if (!r.ok) return errText(r, 'could not save')
              setEditing(null)
              setFlash('saved')
              await load()
              return null
            }}
          />
        )}
      </FormModal>

      {confirm && (
        <ConfirmDialog
          open
          title={confirm.title}
          body={confirm.body}
          confirmLabel={confirm.label}
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            const run = confirm.run
            setConfirm(null)
            run()
          }}
        />
      )}
    </section>
  )
}

// StagedGroup — one target work and its staged quotes. The heading is the
// contract: it names where these quotes will go if approved, so a misdetected
// file is visible before the write rather than after it.
function StagedGroup({ work, items, sel, onToggle, onToggleGroup, onEdit, onOpenBook, onOpenMovie }) {
  const allOn = items.length > 0 && items.every((q) => sel.has(q.id))
  const isBook = work.kind === 'book'
  // A standalone-quote group has no destination work — it is the queue's way of
  // holding quotes that belong to nothing. Everything below that talks about
  // "which book this joins" is therefore skipped rather than answered vaguely.
  const isStandalone = work.kind === 'quotes'
  const openTarget = () => {
    if (!work.target_id) return
    isBook ? onOpenBook?.(work.target_id) : onOpenMovie?.(work.target_id)
  }
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Tooltip label="Select this whole group" side="bottom">
          <input
            type="checkbox"
            checked={allOn}
            onChange={onToggleGroup}
            aria-label={`Select every staged quote for ${work.title}`}
          />
        </Tooltip>
        <h3 className="display-title truncate" style={{ fontSize: 19 }}>
          {work.title}
        </h3>
        <MonoLabel style={{ color: isBook || isStandalone ? 'var(--accent-ui)' : 'var(--amber)' }}>
          {KIND_TAG[work.kind] || 'BOOK'}
        </MonoLabel>
        <MonoLabel style={{ color: 'var(--accent-ui)' }}>
          {items.length} quote{items.length === 1 ? '' : 's'}
        </MonoLabel>
        <span className="h-px flex-1" style={{ background: 'var(--line)' }} />
      </div>
      <p className="microcopy mb-3">
        {isStandalone ? (
          <>→ will be saved as quotes of their own, from no book and no film</>
        ) : work.target_id ? (
          <>
            → joins your existing{' '}
            <button type="button" className="tp-link" onClick={openTarget}>
              {work.target_title || work.title}
              {work.target_year ? ` (${work.target_year})` : ''}
            </button>
            {work.pinned && <span style={{ color: 'var(--accent-ui)' }}> · you chose this</span>}
          </>
        ) : (
          <>→ will be added as a new {isBook ? 'book' : work.kind === 'show' ? 'show' : 'film'}</>
        )}
        {work.ambiguous && (
          <span style={{ color: 'var(--amber)' }}>
            {' '}
            ⚠ you have {work.alternatives + 1} titles with this name — check it went to the right one
          </span>
        )}
      </p>
      {items.length === 0 ? (
        <p className="microcopy" style={{ color: 'var(--faint)' }}>
          {/* An empty work still creates the book or film; an empty quotes
              group creates nothing, because there is nothing but the quotes. */}
          {isStandalone
            ? 'no quotes left in this group'
            : `no quotes — approving adds the ${isBook ? 'book' : work.kind === 'show' ? 'show' : 'film'} itself`}
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((q) => (
            <li key={q.id}>
              <StagedRow quote={q} selected={sel.has(q.id)} onToggle={() => onToggle(q.id)} onEdit={() => onEdit(q)} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// StagedRow — one staged quote: the text, its locators, and the edit affordance.
// Styled as the "row inside a work card" the search results already use.
function StagedRow({ quote, selected, onToggle, onEdit }) {
  // Every kind's locator on one line — a staged row shows whichever it has.
  // The three sets are disjoint by construction (a book quote has no speaker, a
  // standalone quote has no chapter), so no branch is needed to keep them apart.
  const bits = [
    chapterLabel(quote),
    quote.location,
    quote.character,
    quote.actor,
    episodeLabel(quote),
    quote.timestamp,
    quote.speaker,
    quote.occasion,
    quote.occasion_date,
    quote.place,
    quote.medium,
    quote.noted_at ? quote.noted_at.slice(0, 10) : '',
  ].filter(Boolean)
  const moved =
    (quote.location && quote.location_orig && quote.location !== quote.location_orig) ||
    (quote.timestamp && quote.timestamp_orig && quote.timestamp !== quote.timestamp_orig)
  return (
    <div
      className="flex items-start gap-3 p-3"
      style={{
        background: selected ? 'color-mix(in srgb, var(--accent) 7%, var(--raised))' : 'var(--raised)',
        border: `1px solid ${selected ? 'color-mix(in srgb, var(--accent) 35%, var(--line))' : 'var(--line)'}`,
        borderRadius: 8,
        borderLeft: `4px solid ${categoryVar(quote.color) || 'var(--line)'}`,
      }}
    >
      <Tooltip label="Select this quote">
        <input type="checkbox" checked={selected} onChange={onToggle} aria-label="Select this staged quote" style={{ marginTop: 3 }} />
      </Tooltip>
      <div className="min-w-0 flex-1">
        <p
          className="whitespace-pre-wrap"
          style={{ fontFamily: 'var(--font-display)', fontWeight: 'var(--font-display-weight)', fontVariantCaps: 'var(--font-display-caps)', textTransform: 'var(--font-display-case)', fontVariantNumeric: 'var(--font-display-figures)', fontStyle: 'italic', fontSize: 15.5, lineHeight: 1.5 }}
        >
          {quote.quote || quote.note}
        </p>
        {quote.quote && quote.note && <p className="microcopy mt-1">note: {quote.note}</p>}
        {(bits.length > 0 || quote.tags?.length > 0 || quote.favorite) && (
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {bits.map((b, i) => (
              <MonoLabel key={i} style={{ color: 'var(--faint)' }}>
                {b}
              </MonoLabel>
            ))}
            {moved && (
              <MonoLabel style={{ color: 'var(--accent-ui)' }} title="a location formula moved this; reset restores it">
                shifted
              </MonoLabel>
            )}
            {quote.favorite && <span style={{ color: 'var(--accent)' }}>♥</span>}
            {(quote.tags || []).map((t) => (
              <TagChip key={t}>{t}</TagChip>
            ))}
          </div>
        )}
      </div>
      <FieldIconButton
        icon={<IconEdit />}
        ariaLabel="Edit"
        onClick={onEdit}
        tooltip="Edit this quote"
        className="shrink-0"
      />
    </div>
  )
}


// FieldsPanel — the opt-in-checkbox bulk editor, following the Metadata console:
// a blank box is ambiguous between "leave it" and "clear it", so the tick is what
// says "act on this field" and an empty value then genuinely clears it.
function FieldsPanel({ n, busy, onApply }) {
  const [on, setOn] = useState({})
  const [val, setVal] = useState({})
  const [addTags, setAddTags] = useState([])
  const [removeTags, setRemoveTags] = useState([])
  const FIELDS = [
    ['chapter_no', 'Chapter #'],
    ['chapter', 'Chapter name'],
    ['location', 'Location'],
    ['character', 'Character'],
    ['actor', 'Actor'],
    ['season', 'Season'],
    ['episode', 'Episode'],
    ['timestamp', 'Timestamp'],
  ]
  function submit() {
    const body = {}
    for (const [key] of FIELDS) if (on[key]) body[key] = (val[key] || '').trim()
    if (addTags.length) body.add_tags = addTags
    if (removeTags.length) body.remove_tags = removeTags
    if (Object.keys(body).length === 0) return
    onApply(body, `edited ${n}`)
  }
  return (
    <Panel title={`Edit ${n} selected`}>
      {FIELDS.map(([key, label]) => (
        <label key={key} className="flex flex-wrap items-center gap-2">
          <input type="checkbox" checked={!!on[key]} onChange={(e) => setOn({ ...on, [key]: e.target.checked })} />
          <span className="microcopy" style={{ minWidth: 76 }}>
            {label}
          </span>
          <input
            className="tp-input w-auto flex-1"
            placeholder={`set ${label.toLowerCase()} (blank = clear)`}
            disabled={!on[key]}
            value={val[key] || ''}
            onChange={(e) => setVal({ ...val, [key]: e.target.value })}
          />
        </label>
      ))}
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="tp-field">
          <MonoLabel>Add tags</MonoLabel>
          <TokenInput value={addTags} onChange={setAddTags} placeholder="add a tag…" ariaLabel="Tags to add" />
        </label>
        <label className="tp-field">
          <MonoLabel>
            Remove tags <InfoDot text="The live bulk endpoint can only add tags. A staged tag is plain text until approval, so here it comes off again." />
          </MonoLabel>
          <TokenInput value={removeTags} onChange={setRemoveTags} placeholder="remove a tag…" ariaLabel="Tags to remove" />
        </label>
      </div>
      <button className="tp-btn tp-btn-primary" disabled={busy} onClick={submit}>
        Apply to {n}
      </button>
    </Panel>
  )
}

// MovePanel — retargeting. Book and film are interchangeable here on purpose:
// moving a batch onto the other kind is the repair for a misdetected file, and a
// staged row keeps both locator sets so the move is reversible.
function MovePanel({ n, busy, works, onApply }) {
  const [libWorks, setLibWorks] = useState([])
  const [picked, setPicked] = useState(null)
  const [group, setGroup] = useState('')
  useEffect(() => {
    Promise.all([json('GET', '/books'), json('GET', '/movies')]).then(([b, m]) => {
      const list = []
      if (b.ok) list.push(...(b.data.books || []).map(workFromBook))
      if (m.ok) list.push(...(m.data.movies || []).map(workFromMovie))
      setLibWorks(list)
    })
  }, [])
  const groupOptions = [
    ['', 'pick a group…'],
    // A standalone-quote group is left out: retargeting means "send these to a
    // different work", and these are quotes with no work by definition.
    ...works
      .filter((w) => w.kind !== 'quotes')
      .map((w) => [String(w.id), `${w.title} · ${KIND_TAG[w.kind] || 'BOOK'} (${w.quotes})`]),
  ]
  return (
    <Panel title={`Move ${n} selected`}>
      <div>
        <MonoLabel className="block">
          Onto a work in your library{' '}
          <InfoDot text="Across kinds too — book highlights can move onto a film, and back. Approval reads whichever locators the destination uses." />
        </MonoLabel>
        <WorkPicker works={libWorks} value={picked} onChange={setPicked} />
        <button
          className="tp-btn tp-btn-primary mt-2"
          disabled={busy || !picked}
          onClick={() =>
            onApply(
              { retarget: { kind: picked.kind === 'book' ? 'book' : 'movie', id: picked.id } },
              `moved ${n} to ${picked.title}`,
            )
          }
        >
          Move to {picked ? picked.title : 'a work'}
        </button>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="tp-field" style={{ flex: 1, minWidth: 220 }}>
          <MonoLabel>Or merge into another group in this queue</MonoLabel>
          <Select ariaLabel="Staged group" value={group} onChange={setGroup} options={groupOptions} />
        </label>
        <button
          className="tp-btn tp-btn-primary"
          disabled={busy || !group}
          onClick={() => onApply({ retarget: { staged_work_id: Number(group) } }, `merged ${n}`)}
        >
          Merge
        </button>
      </div>
    </Panel>
  )
}

// FormulaPanel — the reason bulk location editing needs more than a text box: a
// Kindle export numbers by location rather than page (a division), and a PDF runs
// a few pages ahead of the print edition (a subtraction).
function FormulaPanel({ n, busy, onApply }) {
  const [field, setField] = useState('location')
  const [op, setOp] = useState('subtract')
  const [value, setValue] = useState('')
  const [text, setText] = useState('')
  const needsValue = ['add', 'subtract', 'multiply', 'divide'].includes(op)
  const label = OPS.find(([k]) => k === op)?.[1] || op
  function submit() {
    const formula = { field, op }
    if (needsValue) {
      const v = Number(value)
      if (!Number.isFinite(v) || (op === 'divide' && v === 0)) return
      formula.value = v
    }
    if (op === 'set') formula.text = text.trim()
    onApply({ formula }, `${label} applied to ${n}`)
  }
  return (
    <Panel title={`Shift locations on ${n} selected`}>
      <div className="flex flex-wrap items-end gap-2">
        <label className="tp-field">
          <MonoLabel>Field</MonoLabel>
          <Select
            ariaLabel="Locator field"
            value={field}
            onChange={setField}
            options={[
              ['location', 'Location'],
              ['timestamp', 'Timestamp'],
            ]}
          />
        </label>
        <label className="tp-field">
          <MonoLabel>Operation</MonoLabel>
          <Select ariaLabel="Operation" value={op} onChange={setOp} options={OPS} />
        </label>
        {needsValue && (
          <div style={{ maxWidth: 110 }}>
            <Field
              label="By"
              type="number"
              step="any"
              placeholder="5"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>
        )}
        {op === 'set' && (
          <div style={{ maxWidth: 160 }}>
            <Field label="To" placeholder="p.1" value={text} onChange={(e) => setText(e.target.value)} />
          </div>
        )}
        <button className="tp-btn tp-btn-primary" disabled={busy} onClick={submit}>
          Apply
        </button>
      </div>
      <p className="microcopy">
        Numbers inside the text move and everything around them stays: <b>p.142</b> minus 5 is <b>p.137</b>, and a range
        like <b>610-612</b> moves at both ends. Timestamps convert to seconds, shift, and come back as{' '}
        <b>HH:MM:SS</b>. Results stop at zero and division rounds. <b>Reset</b> restores every row's as-imported value,
        so a formula applied by mistake is undone rather than lived with.
      </p>
    </Panel>
  )
}

// Panel — the inset form the BulkBar's buttons reveal, matching the Metadata
// console's bulk-edit box.
function Panel({ title, children }) {
  return (
    <div
      className="space-y-2.5 rounded-xl p-3"
      style={{ border: '1px solid var(--line)', background: 'var(--raised)' }}
    >
      <MonoLabel className="block">{title}</MonoLabel>
      {children}
    </div>
  )
}

// StagedQueueForm — the per-row editor for one-offs. It posts the same bulk
// endpoint with a single id, so there is one set of validation rules; the quote's
// own text is not editable here, because a staged row is a record of what the file
// said. Fix wording after approval, in the normal edit form.
function StagedQuoteForm({ quote, onSaved, onCancel }) {
  const [f, setF] = useState({
    chapter: quote.chapter || '',
    // Kept as a string for the same reason season is: '' clears it, and the
    // endpoint takes a decimal as text so absent and cleared stay distinguishable.
    chapter_no: quote.chapter_no ? String(quote.chapter_no) : '',
    location: quote.location || '',
    character: quote.character || '',
    actor: quote.actor || '',
    // Counts stay strings: '' is unset and '0' is season 0 (specials), and the
    // endpoint takes them as text for exactly that reason.
    season: quote.season ?? '',
    episode: quote.episode ?? '',
    timestamp: quote.timestamp || '',
    color: quote.color || 'yellow',
    favorite: !!quote.favorite,
  })
  const [tags, setTags] = useState(quote.tags || [])
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const upd = (k) => (e) => setF({ ...f, [k]: e.target.value })

  async function submit() {
    setBusy(true)
    setErr('')
    const gone = (quote.tags || []).filter((t) => !tags.some((x) => x.toLowerCase() === t.toLowerCase()))
    // Send only the fields that actually changed. location and timestamp matter
    // most: assigning either re-bases its as-imported snapshot server-side (so
    // `reset` returns to what you typed), and re-sending an untouched value would
    // quietly destroy the snapshot a location formula relies on for its undo.
    const body = { add_tags: tags, remove_tags: gone }
    for (const [k, was] of [
      ['chapter', quote.chapter || ''],
      ['chapter_no', quote.chapter_no ? String(quote.chapter_no) : ''],
      ['location', quote.location || ''],
      ['character', quote.character || ''],
      ['actor', quote.actor || ''],
      ['season', String(quote.season ?? '')],
      ['episode', String(quote.episode ?? '')],
      ['timestamp', quote.timestamp || ''],
    ]) {
      if (f[k] !== was) body[k] = f[k]
    }
    if (f.color !== (quote.color || 'yellow')) body.color = f.color
    if (f.favorite !== !!quote.favorite) body.favorite = f.favorite
    const msg = await onSaved(body)
    setBusy(false)
    if (msg) setErr(msg)
  }

  return (
    <div className="space-y-4">
      <p
        className="whitespace-pre-wrap"
        style={{ fontFamily: 'var(--font-display)', fontWeight: 'var(--font-display-weight)', fontVariantCaps: 'var(--font-display-caps)', textTransform: 'var(--font-display-case)', fontVariantNumeric: 'var(--font-display-figures)', fontStyle: 'italic', fontSize: 16 }}
      >
        “{quote.quote || quote.note}”
      </p>
      <p className="microcopy">
        Both locator sets are here because a staged quote carries both: approval reads whichever the destination uses,
        so moving this onto a film — or back onto a book — never loses the other half.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Chapter #" inputMode="decimal" placeholder="7" value={f.chapter_no} onChange={upd('chapter_no')} />
        <Field label="Chapter name" placeholder="optional" value={f.chapter} onChange={upd('chapter')} />
        <Field label="Location" placeholder="p.142" value={f.location} onChange={upd('location')} />
        <Field label="Character" nameCase placeholder="Philip Marlowe" value={f.character} onChange={upd('character')} />
        <Field label="Actor" nameCase placeholder="Elliott Gould" value={f.actor} onChange={upd('actor')} />
        <Field label="Season" placeholder="2 (shows only)" value={f.season} onChange={upd('season')} />
        <Field label="Episode" placeholder="5 (needs a season)" value={f.episode} onChange={upd('episode')} />
        <Field label="Timestamp" placeholder="01:02:03" value={f.timestamp} onChange={upd('timestamp')} />
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <label className="tp-field">
          <MonoLabel>Colour</MonoLabel>
          <ColorSwatches value={f.color} onChange={(c) => setF({ ...f, color: c })} />
        </label>
        <label className="tp-field">
          <MonoLabel>Favourite</MonoLabel>
          <Hearts value={f.favorite} onChange={(v) => setF({ ...f, favorite: v })} />
        </label>
      </div>
      <label className="tp-field">
        <MonoLabel>Tags</MonoLabel>
        <TokenInput value={tags} onChange={setTags} placeholder="add a tag…" ariaLabel="Tags" transform={(t) => splitCommas(t)[0] || t} />
      </label>
      <ErrorText>{err}</ErrorText>
      <div className="flex flex-wrap items-center gap-2">
        <button className="tp-btn tp-btn-primary" disabled={busy} onClick={submit}>
          Save
        </button>
        <GhostButton onClick={onCancel} disabled={busy}>
          Cancel
        </GhostButton>
      </div>
    </div>
  )
}

// PendingImportCard — the Home-screen nudge. A half-finished import must not be
// forgettable, so the count surfaces outside the Add surface too.
export function PendingImportCard({ pending, onOpen }) {
  if (!pending) return null
  return (
    <HandCard variant={1} colorBar="var(--accent-ui)" className="flex flex-wrap items-center gap-3 p-4">
      <MonoLabel style={{ color: 'var(--accent-ui)' }}>pending import</MonoLabel>
      <p className="text-sm" style={{ color: 'var(--soft)' }}>
        {pending} imported quote{pending === 1 ? '' : 's'} {pending === 1 ? 'is' : 'are'} waiting for you to okay{' '}
        {pending === 1 ? 'it' : 'them'} — nothing has entered your library yet.
      </p>
      <button className="tp-btn tp-btn-primary ml-auto" onClick={onOpen}>
        Review {pending}
      </button>
    </HandCard>
  )
}
