import { useEffect, useMemo, useRef, useState } from 'react'
import { categoryName, categoryVar } from './theme.js'
import { json, errText } from './api.js'
import { t, tNodes } from './i18n.js'
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

// OPS — the six things a location formula can do, as STORED TOKENS ONLY. The
// words sat beside them here until the i18n pass: a table of copy at module scope
// freezes the language at import time, which is the bug three other tables in
// this app shipped. So opLabel builds the words during render instead, and
// opOptions is called from the Select rather than hoisted out of it.
const OPS = ['add', 'subtract', 'multiply', 'divide', 'set', 'reset']
const opLabel = (op) => t(`staging.formula.op.${op}.label`)
const opOptions = () => OPS.map((op) => [op, opLabel(op)])

// The tag beside a group's heading. `quotes` is the synthetic group a batch of
// standalone quotes hangs from (§24, migration 0028) — it is not a work, so it
// has no target to join and nothing to retarget onto.
// HOLDS KEYS, RESOLVED WHERE IT IS DRAWN, for the reason OPS does. Three of the
// four are the badges a favourite tile already draws, so they are the shared
// common.badge.*; only the plural QUOTES belongs to this screen.
const KIND_TAG = {
  book: 'common.badge.book',
  movie: 'common.badge.film',
  show: 'common.badge.show',
  quotes: 'staging.badge.quotes',
}
const kindTag = (kind) => t(KIND_TAG[kind] || 'common.badge.book')

// kindNoun — the singular word for what approving a group would create. Drawn
// from the shared unit.* table, so a book is called here what it is called in
// every other count in the app.
const kindNoun = (work) =>
  work.kind === 'book'
    ? t('unit.book', { count: 1 })
    : work.kind === 'show'
      ? t('unit.show', { count: 1 })
      : t('unit.film', { count: 1 })

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
    if (!r.ok) return setErr(errText(r, t('error.load.import-queue')))
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
    if (!r.ok) return setErr(errText(r, t('error.apply.edit')))
    setFlash(note || t('staging.flash.updated', { n: r.data.updated }))
    await load()
  }

  async function approve(ids) {
    if (busy) return
    setBusy(true)
    setErr('')
    const r = await json('POST', '/import/staged/approve', ids ? { ids } : { all: true })
    setBusy(false)
    if (!r.ok) return setErr(errText(r, t('error.approve.generic')))
    const { added = 0, skipped = 0, enriched = 0 } = r.data
    // Three fragments joined HERE rather than one value with an optional tail:
    // the locale parser trims a value, so a file cannot carry the leading
    // separator a third fragment would need.
    setFlash(
      [
        t('staging.flash.approved.added', { n: added }),
        t('staging.flash.approved.skipped', { n: skipped }),
        enriched > 0 && t('staging.flash.approved.enriched', { n: enriched }),
      ]
        .filter(Boolean)
        .join(' · '),
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
    if (!r.ok) return setErr(errText(r, t('error.discard.generic')))
    setFlash(t('staging.flash.discarded', { n: r.data.discarded }))
    clearSel()
    await load()
  }

  if (!queue) {
    return (
      <section className="space-y-5">
        <PageHeader title={t('staging.title')} counts={t('staging.state.loading')} />
        <ErrorText>{err}</ErrorText>
      </section>
    )
  }

  // A batch can hold works but no quotes (a book exported with none), and that
  // still needs approving or discarding — so the queue is empty only when both are.
  if (queue.pending === 0 && works.length === 0) {
    return (
      <section className="space-y-5">
        <PageHeader title={t('staging.title')} counts={t('staging.state.empty-counts')} />
        <EmptyState>{t('staging.state.empty')}</EmptyState>
      </section>
    )
  }

  // Built here, during the render that draws the Select, and not hoisted: the
  // words in an options list are copy, and copy resolved once at import time is
  // copy in whatever language was current then.
  const batchOptions = [
    ['all', t('staging.filter.all-files.label', { n: queue.pending })],
    ...batches.map((b) => [
      String(b.id),
      t('staging.filter.batch.label', { name: b.filename || b.source, n: b.quotes }),
    ]),
  ]

  const pageActions = (
    <>
      <MonoLabel style={{ color: 'var(--faint)' }}>{flash}</MonoLabel>
      <GhostButton
        disabled={busy}
        onClick={() =>
          setConfirm({
            title: t('staging.discard-all.confirm.title'),
            body: t('staging.discard-all.confirm.body', { n: queue.pending }),
            label: t('staging.discard-all.label'),
            run: () => discard(null),
          })
        }
      >
        {t('staging.discard-all.label')}
      </GhostButton>
      <button className="tp-btn tp-btn-primary" disabled={busy} onClick={() => approve(null)}>
        {/* Two keys rather than a number glued onto a label, so no language has
            to assemble the phrase out of a word and a fragment. */}
        {queue.pending > 0
          ? t('staging.approve-all.count.label', { n: queue.pending })
          : t('staging.approve-all.label')}
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
          title={t('staging.title')}
          counts={
            /* Two real plural families where the English grew its own -s in
               JavaScript. A count now picks whichever form its language has. */
            queue.pending > 0
              ? t('staging.counts.quotes', { count: queue.pending, n: queue.pending })
              : t('staging.counts.works', { count: works.length, n: works.length })
          }
          right={mobile ? null : pageActions}
        />
      </div>
      {mobile && <div className="flex flex-wrap items-center gap-2">{pageActions}</div>}

      <div className="filter-row">
        <label className="flex items-center gap-2">
          <MonoLabel>{t('staging.filter.file.label')}</MonoLabel>
          <Select ariaLabel={t('staging.filter.batch.aria')} value={batch} onChange={setBatch} options={batchOptions} width={mobile ? undefined : 260} />
        </label>
        <label className="flex items-center gap-2" style={{ marginLeft: 'auto' }}>
          <input
            type="checkbox"
            checked={allShownSelected}
            onChange={() => setSel(allShownSelected ? new Set() : new Set(shownIds))}
          />
          <span className="microcopy">{t('staging.select-all.label', { n: shownIds.length })}</span>
        </label>
      </div>

      <BulkBar n={n} onClear={clearSel}>
        {/* The toast names the CATEGORY, not the token. It said "colour → blue"
            while every card on the screen said "Fact", which reads as a
            different operation than the one you asked for. */}
        <ColorSwatches
          value=""
          ariaLabel={t('staging.bulk.colour.aria')}
          onChange={(c) => apply({ color: c }, t('staging.flash.colour', { name: categoryName(c) }))}
        />
        <GhostButton disabled={busy} onClick={() => apply({ favorite: true }, t('staging.flash.favourited'))}>
          {t('staging.bulk.favourite.label')}
        </GhostButton>
        <Tooltip label={t('staging.bulk.unfavourite.tip')}>
          <GhostButton disabled={busy} onClick={() => apply({ favorite: false }, t('staging.flash.unfavourited'))}>
            {t('staging.bulk.unfavourite.label')}
          </GhostButton>
        </Tooltip>
        <GhostButton icon={<IconEdit />} onClick={() => setPanel(panel === 'fields' ? '' : 'fields')}>{t('staging.bulk.fields.label')}</GhostButton>
        <GhostButton icon={<IconMoveTo />} onClick={() => setPanel(panel === 'move' ? '' : 'move')}>{t('staging.bulk.move.label')}</GhostButton>
        <GhostButton icon={<IconRuler />} onClick={() => setPanel(panel === 'formula' ? '' : 'formula')}>{t('staging.bulk.locations.label')}</GhostButton>
        <button className="tp-btn tp-btn-primary" disabled={busy} onClick={() => approve(selectedIds)}>
          {t('staging.bulk.approve.label', { n })}
        </button>
        <GhostButton
          disabled={busy}
          onClick={() =>
            setConfirm({
              // A real plural family; the title used to build its own -s.
              title: t('staging.discard.confirm.title', { count: n, n }),
              body: t('staging.discard.confirm.body'),
              label: t('staging.discard.label'),
              run: () => discard(selectedIds),
            })
          }
        >
          {t('staging.discard.label')}
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
        {groups.length === 0 && <EmptyState>{t('staging.state.empty-file')}</EmptyState>}
      </div>

      <FormModal open={!!editing} onClose={() => setEditing(null)} title={t('staging.form.title')}>
        {editing && (
          <StagedQuoteForm
            quote={editing}
            onCancel={() => setEditing(null)}
            onSaved={async (fields) => {
              const r = await json('POST', '/import/staged/bulk', { ids: [editing.id], ...fields })
              if (!r.ok) return errText(r, t('error.save.generic'))
              setEditing(null)
              setFlash(t('staging.flash.saved'))
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
  // The destination's own words. Two keys rather than one with an optional
  // parenthetical, so no language has to build the bracket itself.
  const targetName = work.target_title || work.title
  const targetLabel = work.target_year
    ? t('staging.group.target.year.label', { title: targetName, year: work.target_year })
    : targetName
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Tooltip label={t('staging.group.select.tip')} side="bottom">
          <input
            type="checkbox"
            checked={allOn}
            onChange={onToggleGroup}
            aria-label={t('staging.group.select.aria', { title: work.title })}
          />
        </Tooltip>
        <h3 className="display-title truncate" style={{ fontSize: 19 }}>
          {work.title}
        </h3>
        <MonoLabel style={{ color: isBook || isStandalone ? 'var(--accent-ui)' : 'var(--amber)' }}>
          {kindTag(work.kind)}
        </MonoLabel>
        <MonoLabel style={{ color: 'var(--accent-ui)' }}>
          {/* The shared count idiom and the shared noun, so this reads the same
              way as every other quote count in the app. */}
          {t('common.count.phrase', { n: items.length, noun: t('unit.quote', { count: items.length }) })}
        </MonoLabel>
        <span className="h-px flex-1" style={{ background: 'var(--line)' }} />
      </div>
      <p className="microcopy mb-3">
        {isStandalone ? (
          t('staging.group.standalone.prose')
        ) : work.target_id ? (
          <>
            {/* The destination is a BUTTON, so the sentence carries a {target}
                hole and tNodes drops the node into it. Markup never goes into a
                locale value. */}
            {tNodes('staging.group.joins.prose', {
              target: (
                <button key="target" type="button" className="tp-link" onClick={openTarget}>
                  {targetLabel}
                </button>
              ),
            })}
            {work.pinned && <span style={{ color: 'var(--accent-ui)' }}> · {t('staging.group.pinned.label')}</span>}
          </>
        ) : (
          t('staging.group.new.prose', { kind: kindNoun(work) })
        )}
        {work.ambiguous && (
          <span style={{ color: 'var(--amber)' }}>
            {' '}
            {/* n is at least 2 by construction — a work is only ambiguous when a
                second title shares its name — so this needs no plural family. */}
            {t('staging.group.ambiguous.warning', { n: work.alternatives + 1 })}
          </span>
        )}
      </p>
      {items.length === 0 ? (
        <p className="microcopy" style={{ color: 'var(--faint)' }}>
          {/* An empty work still creates the book or film; an empty quotes
              group creates nothing, because there is nothing but the quotes. */}
          {isStandalone
            ? t('staging.group.empty.standalone')
            : t('staging.group.empty.work', { kind: kindNoun(work) })}
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
      <Tooltip label={t('staging.row.select.tip')}>
        <input type="checkbox" checked={selected} onChange={onToggle} aria-label={t('staging.row.select.aria')} style={{ marginTop: 3 }} />
      </Tooltip>
      <div className="min-w-0 flex-1">
        <p
          className="whitespace-pre-wrap"
          style={{ fontFamily: 'var(--font-display)', fontWeight: 'var(--font-display-weight)', fontVariantCaps: 'var(--font-display-caps)', textTransform: 'var(--font-display-case)', fontVariantNumeric: 'var(--font-display-figures)', fontStyle: 'italic', fontSize: 15.5, lineHeight: 1.5 }}
        >
          {quote.quote || quote.note}
        </p>
        {quote.quote && quote.note && (
          <p className="microcopy mt-1">{t('staging.row.note.label', { note: quote.note })}</p>
        )}
        {(bits.length > 0 || quote.tags?.length > 0 || quote.favorite) && (
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {bits.map((b, i) => (
              <MonoLabel key={i} style={{ color: 'var(--faint)' }}>
                {b}
              </MonoLabel>
            ))}
            {moved && (
              <MonoLabel style={{ color: 'var(--accent-ui)' }} title={t('staging.row.shifted.tip')}>
                {t('staging.row.shifted.label')}
              </MonoLabel>
            )}
            {quote.favorite && <span style={{ color: 'var(--accent)' }}>♥</span>}
            {(quote.tags || []).map((tag) => (
              <TagChip key={tag}>{tag}</TagChip>
            ))}
          </div>
        )}
      </div>
      <FieldIconButton
        icon={<IconEdit />}
        ariaLabel={t('common.action.edit.label')}
        onClick={onEdit}
        tooltip={t('common.action.edit.row.tip', { noun: t('unit.quote', { count: 1 }) })}
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
  // HOLDS KEYS, not words. Every one of the eight is the shared label the rest
  // of the app already draws for that column, so the bulk editor and the add
  // form cannot disagree about what a field is called.
  const FIELDS = [
    ['chapter_no', 'common.field.chapter-no.label'],
    ['chapter', 'common.field.chapter-name.label'],
    ['location', 'common.field.location.label'],
    ['character', 'common.field.character.label'],
    ['actor', 'common.field.actor.label'],
    ['season', 'common.field.season.label'],
    ['episode', 'common.field.episode.label'],
    ['timestamp', 'common.field.timestamp.label'],
  ]
  function submit() {
    const body = {}
    for (const [key] of FIELDS) if (on[key]) body[key] = (val[key] || '').trim()
    if (addTags.length) body.add_tags = addTags
    if (removeTags.length) body.remove_tags = removeTags
    if (Object.keys(body).length === 0) return
    onApply(body, t('staging.flash.edited', { n }))
  }
  return (
    <Panel title={t('staging.fields.panel.title', { n })}>
      {FIELDS.map(([key, labelKey]) => (
        <label key={key} className="flex flex-wrap items-center gap-2">
          <input type="checkbox" checked={!!on[key]} onChange={(e) => setOn({ ...on, [key]: e.target.checked })} />
          <span className="microcopy" style={{ minWidth: 76 }}>
            {t(labelKey)}
          </span>
          <input
            className="tp-input w-auto flex-1"
            /* One frame with the field's own name dropped into it, LOWER-CASED BY
               THE CALLER — the arrangement the bin's kind filter already uses, and
               the reason the field label stays a single source of truth rather
               than being written out eight more times. */
            placeholder={t('staging.fields.set.placeholder', { field: t(labelKey).toLowerCase() })}
            disabled={!on[key]}
            value={val[key] || ''}
            onChange={(e) => setVal({ ...val, [key]: e.target.value })}
          />
        </label>
      ))}
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="tp-field">
          <MonoLabel>{t('common.action.add-tags.label')}</MonoLabel>
          <TokenInput
            value={addTags}
            onChange={setAddTags}
            placeholder={t('common.field.tags.placeholder')}
            ariaLabel={t('staging.fields.add-tags.aria')}
          />
        </label>
        <label className="tp-field">
          <MonoLabel>
            {t('staging.fields.remove-tags.label')} <InfoDot text={t('staging.fields.remove-tags.info')} />
          </MonoLabel>
          <TokenInput
            value={removeTags}
            onChange={setRemoveTags}
            placeholder={t('staging.fields.remove-tags.placeholder')}
            ariaLabel={t('staging.fields.remove-tags.aria')}
          />
        </label>
      </div>
      <button className="tp-btn tp-btn-primary" disabled={busy} onClick={submit}>
        {t('staging.fields.apply.label', { n })}
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
  // Built during render, like batchOptions and for the same reason.
  const groupOptions = [
    ['', t('staging.move.group.placeholder')],
    // A standalone-quote group is left out: retargeting means "send these to a
    // different work", and these are quotes with no work by definition.
    ...works
      .filter((w) => w.kind !== 'quotes')
      .map((w) => [
        String(w.id),
        t('staging.move.group.option', { title: w.title, badge: kindTag(w.kind), n: w.quotes }),
      ]),
  ]
  return (
    <Panel title={t('staging.move.panel.title', { n })}>
      <div>
        <MonoLabel className="block">
          {t('staging.move.library.label')}{' '}
          <InfoDot text={t('staging.move.library.info')} />
        </MonoLabel>
        <WorkPicker works={libWorks} value={picked} onChange={setPicked} />
        <button
          className="tp-btn tp-btn-primary mt-2"
          disabled={busy || !picked}
          onClick={() =>
            onApply(
              { retarget: { kind: picked.kind === 'book' ? 'book' : 'movie', id: picked.id } },
              t('staging.flash.moved', { n, title: picked.title }),
            )
          }
        >
          {/* Two keys rather than a fallback noun spliced into one, so neither
              language has to build "Move to" plus a word out of two fragments. */}
          {picked ? t('staging.move.button.label', { title: picked.title }) : t('staging.move.button.none.label')}
        </button>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="tp-field" style={{ flex: 1, minWidth: 220 }}>
          <MonoLabel>{t('staging.move.merge.label')}</MonoLabel>
          <Select ariaLabel={t('staging.move.group.aria')} value={group} onChange={setGroup} options={groupOptions} />
        </label>
        <button
          className="tp-btn tp-btn-primary"
          disabled={busy || !group}
          onClick={() => onApply({ retarget: { staged_work_id: Number(group) } }, t('staging.flash.merged', { n }))}
        >
          {t('staging.move.merge.button.label')}
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
  function submit() {
    const formula = { field, op }
    if (needsValue) {
      const v = Number(value)
      if (!Number.isFinite(v) || (op === 'divide' && v === 0)) return
      formula.value = v
    }
    if (op === 'set') formula.text = text.trim()
    onApply({ formula }, t('staging.flash.formula', { op: opLabel(op), n }))
  }
  return (
    <Panel title={t('staging.formula.panel.title', { n })}>
      <div className="flex flex-wrap items-end gap-2">
        <label className="tp-field">
          <MonoLabel>{t('staging.formula.field.label')}</MonoLabel>
          <Select
            ariaLabel={t('staging.formula.field.aria')}
            value={field}
            onChange={setField}
            options={[
              // Resolved here, during render, and from the shared field labels:
              // these are the same two words the rows above the panel print.
              ['location', t('common.field.location.label')],
              ['timestamp', t('common.field.timestamp.label')],
            ]}
          />
        </label>
        <label className="tp-field">
          {/* The visible label and the aria label are the same word, so they are
              one key — two would be two chances to disagree. */}
          <MonoLabel>{t('staging.formula.op.label')}</MonoLabel>
          <Select ariaLabel={t('staging.formula.op.label')} value={op} onChange={setOp} options={opOptions()} />
        </label>
        {needsValue && (
          <div style={{ maxWidth: 110 }}>
            <Field
              label={t('staging.formula.by.label')}
              type="number"
              step="any"
              placeholder={t('staging.formula.by.placeholder')}
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>
        )}
        {op === 'set' && (
          <div style={{ maxWidth: 160 }}>
            <Field
              label={t('staging.formula.to.label')}
              placeholder={t('staging.formula.to.placeholder')}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
        )}
        <button className="tp-btn tp-btn-primary" disabled={busy} onClick={submit}>
          {t('common.action.apply.label')}
        </button>
      </div>
      {/* Four worked examples and the reset operation's own name are NODES, drawn
          in bold: a locale value never carries markup, so the sentence has five
          holes and this call site fills them. HH:MM:SS is a picture of a time
          format rather than words, and stays as it is in every language. */}
      <p className="microcopy">
        {/* Each node is KEYED, as every other multi-node tNodes site is: the
            resolved value is split into an ARRAY, so an unkeyed element in it is
            a React list-key warning on every render of this panel. */}
        {tNodes('staging.formula.prose', {
          from: <b key="from">{t('staging.formula.example.page-from')}</b>,
          to: <b key="to">{t('staging.formula.example.page-to')}</b>,
          range: <b key="range">{t('staging.formula.example.range')}</b>,
          clock: <b key="clock">{t('staging.formula.example.clock')}</b>,
          reset: <b key="reset">{t('staging.formula.example.reset')}</b>,
        })}
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
    // `tag`, not `t`: this file imports the resolver under that name now.
    const gone = (quote.tags || []).filter((tag) => !tags.some((x) => x.toLowerCase() === tag.toLowerCase()))
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
        {t('staging.form.quoted', { text: quote.quote || quote.note })}
      </p>
      <p className="microcopy">{t('staging.form.locators.prose')}</p>
      {/* Every label here is the shared one; only the eight example values are
          this screen's own. Philip Marlowe and Elliott Gould are proper nouns,
          and 01:02:03 is a picture of a time format. */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('common.field.chapter-no.label')} inputMode="decimal" placeholder={t('staging.form.chapter-no.placeholder')} value={f.chapter_no} onChange={upd('chapter_no')} />
        <Field label={t('common.field.chapter-name.label')} placeholder={t('staging.form.chapter.placeholder')} value={f.chapter} onChange={upd('chapter')} />
        <Field label={t('common.field.location.label')} placeholder={t('staging.form.location.placeholder')} value={f.location} onChange={upd('location')} />
        <Field label={t('common.field.character.label')} nameCase placeholder={t('staging.form.character.placeholder')} value={f.character} onChange={upd('character')} />
        <Field label={t('common.field.actor.label')} nameCase placeholder={t('staging.form.actor.placeholder')} value={f.actor} onChange={upd('actor')} />
        <Field label={t('common.field.season.label')} placeholder={t('staging.form.season.placeholder')} value={f.season} onChange={upd('season')} />
        <Field label={t('common.field.episode.label')} placeholder={t('staging.form.episode.placeholder')} value={f.episode} onChange={upd('episode')} />
        <Field label={t('common.field.timestamp.label')} placeholder={t('staging.form.timestamp.placeholder')} value={f.timestamp} onChange={upd('timestamp')} />
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <label className="tp-field">
          <MonoLabel>{t('common.field.colour.label')}</MonoLabel>
          <ColorSwatches value={f.color} onChange={(c) => setF({ ...f, color: c })} />
        </label>
        <label className="tp-field">
          <MonoLabel>{t('common.field.favourite.label')}</MonoLabel>
          <Hearts value={f.favorite} onChange={(v) => setF({ ...f, favorite: v })} />
        </label>
      </div>
      <label className="tp-field">
        <MonoLabel>{t('common.field.tags.label')}</MonoLabel>
        {/* `tok`, not `t` — see the rename in submit(). */}
        <TokenInput
          value={tags}
          onChange={setTags}
          placeholder={t('common.field.tags.placeholder')}
          ariaLabel={t('common.field.tags.label')}
          transform={(tok) => splitCommas(tok)[0] || tok}
        />
      </label>
      <ErrorText>{err}</ErrorText>
      <div className="flex flex-wrap items-center gap-2">
        <button className="tp-btn tp-btn-primary" disabled={busy} onClick={submit}>
          {t('common.action.save.label')}
        </button>
        <GhostButton onClick={onCancel} disabled={busy}>
          {t('common.action.cancel.label')}
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
      <MonoLabel style={{ color: 'var(--accent-ui)' }}>{t('staging.card.label')}</MonoLabel>
      <p className="text-sm" style={{ color: 'var(--soft)' }}>
        {/* One plural family replaced three JavaScript ternaries — the
            quote/quotes, the is/are and the it/them the English needed. */}
        {t('staging.card.body', { count: pending, n: pending })}
      </p>
      <button className="tp-btn tp-btn-primary ml-auto" onClick={onOpen}>
        {t('staging.card.review.label', { n: pending })}
      </button>
    </HandCard>
  )
}
