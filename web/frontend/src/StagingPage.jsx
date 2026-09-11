import { useEffect, useMemo, useRef, useState } from 'react'
import { categoryName, categoryVar } from './theme.js'
import { json, errText } from './api.js'
import { t, tNodes } from './i18n.js'
import { quoteKindMeta } from './quoteKind.js'
import { WorkPicker, workFromBook, workFromMovie } from './AddSurface.jsx'
import { chapterLabel, episodeLabel } from './text.js'
import { CastCombo, SuggestCombo, useWorkSuggestions } from './suggest.jsx'
import { fieldKeys, QUOTE_KIND_DOORS } from './addFields.js'
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
  NameScroll,
  parsePartialDate,
  partialDateInputValue,
  partialDateValue,
  PartialDateField,
  SectionHead,
  Select,
  splitCommas,
  TagChip,
  TokenInput,
  Tooltip,
  useIsMobileScreen,
  IconHeartOn,
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

export default function StagingPage({ onPending, onOpenBook, onOpenMovie, onApproved, embedded = false }) {
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
        <SectionHead embedded={embedded} title={t('staging.title')} counts={t('staging.state.loading')} />
        <ErrorText>{err}</ErrorText>
      </section>
    )
  }

  // A batch can hold works but no quotes (a book exported with none), and that
  // still needs approving or discarding — so the queue is empty only when both are.
  if (queue.pending === 0 && works.length === 0) {
    return (
      <section className="space-y-5">
        <SectionHead embedded={embedded} title={t('staging.title')} counts={t('staging.state.empty-counts')} />
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
      <div className={mobile && !embedded ? 'mobile-sticky-bar' : ''}>
        <SectionHead
          embedded={embedded}
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
            // THE LIBRARY WORK THIS ROW WILL LAND ON, so the editor can offer what
            // that work already holds — its cast, its chapters, its packs.
            //
            // LOOKED UP HERE RATHER THAN THREADED THROUGH THE GROUP AND THE ROW.
            // `works` is already in scope and a staged quote already names its
            // staged work; passing it down two components that would do nothing but
            // forward it is the shape of prop that goes missing the day one of them
            // is edited.
            //
            // `target_id` IS THE WHOLE CONDITION and it is often zero: a staged work
            // that matched nothing in the library is a NEW work, and a new work has
            // no cast and no chapters to suggest from. The editor is handed null and
            // draws plain boxes, which is correct rather than degraded — there is
            // nothing to offer, and offering another work's chapters would be worse
            // than offering none.
            work={works.find((w) => w.id === editing.staged_work_id) || null}
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
        <h3 className="display-title" style={{ fontSize: 'var(--type-ui-19)' }}>
          <NameScroll>{work.title}</NameScroll>
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
    // 0053. The KIND's word, falling back to the old free-text medium the way
    // every card does — a staged letter or essay showed nothing on this line,
    // because the queue carries the kind and this row still read the field it
    // replaced.
    quoteKindMeta(quote),
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
          style={{ fontFamily: 'var(--font-display)', fontWeight: 'var(--font-display-weight)', fontVariantCaps: 'var(--font-display-caps)', textTransform: 'var(--font-display-case)', fontVariantNumeric: 'var(--font-display-figures)', fontStyle: 'italic', fontSize: 'var(--type-display-15)', lineHeight: 1.5 }}
        >
          {quote.quote || quote.note}
        </p>
        {/* WHAT IT SAYS, before what somebody thought about it — the order every
            card in the app draws the pair in. Shown here because the queue is where
            approval is decided and a translation is part of what is arriving; it is
            NOT editable in the row editor below, for the reason stated there: a
            staged row is a record of what the file said, and a translation is the
            quote's own text rather than a locator. */}
        {quote.translation && (
          <p className="microcopy mt-1">{t('staging.row.translation.label', { text: quote.translation })}</p>
        )}
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
            {quote.favorite && <span style={{ color: 'var(--accent)', display: 'inline-flex' }}><IconHeartOn size={13} /></span>}
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
  // FROM WRITABLE_FIELDS, so this panel and the row editor cannot disagree about
  // what a staged row has. They did for a release — eight here against twenty-one
  // there — and the list that fell behind was this one, which is the one a reader
  // reaches for when a whole file got a field wrong.
  //
  // NOT GATED BY KIND, unlike the row editor, and that is the difference between the
  // two controls rather than an oversight. A selection spans groups: a reader can
  // tick a book's rows and a film's together, so there is no one door to ask. The
  // checkbox beside each field is what makes that safe — nothing is written unless
  // it is ticked, so a field that means nothing to a row is simply never ticked.
  //
  // MINUS THE DATE. `when` is a canonical date and a circa flag travelling together
  // behind a date control; a checkbox and a free-text box cannot say "about 399
  // BCE", and a bulk panel that took the phrase would store it unparsed.
  const FIELDS = WRITABLE_FIELDS.filter(([key]) => key !== 'when')
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
      {FIELDS.map(([key, labelKey, opts]) => (
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
               than being written out however many fields there are. */
            placeholder={t('staging.fields.set.placeholder', { field: t(labelKey).toLowerCase() })}
            /* THE SAME KEYBOARD THE ROW EDITOR ASKS FOR. A raw <input> here rather
               than Field, because the checkbox and the box are one row — so the hint
               is set by hand from the table's own mark instead of being inherited,
               and a name asks for capitals whichever control a reader reached for. */
            autoCapitalize={opts?.name ? 'words' : undefined}
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

// WHICH BOXES A STAGED ROW GETS, and it is the SAME table the add surface reads.
//
// THE FIRST VERSION OF THIS INVENTED TWO LISTS AND WAS WRONG TWICE. It branched on
// "is this a standalone row", so a BOOK row was drawn a timestamp, a season, an act
// and a DLC — the owner's own example of a hard drop ("timestamp of a book"). And
// it argued that the queue could not ask `fieldKeys` because it did not know the
// medium. It does: `stagedWorkRow.Kind` is `importMediaType()`'s output
// (import_staging.go:336, import_movies.go:79-85), so a staged show says "show" and
// a staged game says "game". The claim was false and a whole field list rested on
// it.
//
// SO THERE ARE THREE DOORS, and addFields.js answers all three — the one table the
// add form, the edit forms and their tests already read, which is this repo's rule
// about a control drawn on two screens having one definition.
function stagedDoor(work, quote) {
  // 'quotes' is the queue's group for lines that belong to no book and no film;
  // which KIND of line is the quote's own (0053), and that is a door name.
  //
  // CHECKED AGAINST THE DOOR LIST, not trusted. An unknown kind makes `fieldsFor`
  // answer `{ main: [], more: [] }` — so the editor would draw ZERO locator boxes
  // and offer nothing but colour, favourite and tags, which reads as a broken form
  // rather than as an unrecognised value. `other` is the right fallback because it
  // hard-drops nothing: it is the door for a line whose kind nobody has decided.
  //
  // `importQuoteKind` (import_quotes.go:135-151) 400s a kind outside the seven, so
  // the only way in is a restored archive written by something else — which is
  // exactly the case that must not lose the reader their boxes.
  if (work?.kind === 'quotes') {
    return QUOTE_KIND_DOORS.includes(quote.kind) ? quote.kind : 'other'
  }
  return work?.kind === 'book' ? 'annotation' : 'dialogue'
}

// A screen row's medium, for the one door whose fields depend on it. A staged work
// is 'movie', 'show' or 'game' and nothing else — importMediaType folds everything
// unknown onto 'movie', so this cannot fall through to a door that does not exist.
function stagedMedia(work) {
  return work?.kind === 'show' ? 'show' : work?.kind === 'game' ? 'game' : 'movie'
}

// WHAT THIS FORM CAN ACTUALLY WRITE, which is not everything the table lists. The
// endpoint takes the locators and the language; `quote`, `note` and `translation`
// are the TEXT and stay unwritable here, because a staged row is a record of what
// the file said. `tags`, `color` and `board` are drawn by this form's own controls
// below, and `sticker` has no column in the queue at all.
//
// AND `noted_at` IS PRINTED ON THE ROW AND DELIBERATELY NOT HERE, which is worth
// saying because every other printed field on that line became writable. It is when
// the reader MADE the note, not where the line is from — a fact about the file's
// own timestamps rather than a locator an importer can guess wrong. Correcting it
// would be rewriting history rather than fixing a misread.
//
// AN INTERSECTION RATHER THAN A SECOND LIST: the table decides which fields a kind
// HAS and the order they read in, and this decides which of them the queue can
// repair. A key that appears in neither is simply not drawn, which is the state a
// field is in before somebody wires it.
// ONE TABLE, READ BY BOTH EDITORS. Key, the shared label, and whether the box holds
// a NAME — in the order the bulk panel lists them.
//
// `{ name: true }` IS A KEYBOARD HINT AND NOTHING ELSE: it becomes
// `autoCapitalize="words"`, which is right on a person, a title or a place and wrong
// on a page reference, a clock reading or an occasion ("the funeral of his brother"
// is not improved by capitals). The row editor said it per box and the bulk panel
// said it nowhere, so one field asked the keyboard for two different things
// depending on which control a reader reached for. `name-casing.test.js` holds the
// canonical list of which fields are names; this marks the same ones. The row editor filters the add-surface table against these keys
// and draws each with its own control; the bulk panel draws every one with a
// checkbox. They were two hand-written lists for a release and drifted at once: the
// row editor gained thirteen fields and the bulk panel kept its original eight, so
// the language an import most often lacks — the field most likely to be uniformly
// wrong across a whole file, which is exactly the bulk case — could be set on one
// row and not on four hundred.
export const WRITABLE_FIELDS = [
  ['chapter_no', 'common.field.chapter-no.label'],
  ['chapter', 'common.field.chapter-name.label', { name: true }],
  ['location', 'common.field.location.label'],
  ['character', 'common.field.character.label', { name: true }],
  ['actor', 'common.field.actor.label', { name: true }],
  ['season', 'common.field.season.label'],
  ['episode', 'common.field.episode.label'],
  ['episode_name', 'common.field.episode-name.label', { name: true }],
  ['timestamp', 'common.field.timestamp.label'],
  ['timestamp_end', 'common.field.timestamp-end.label'],
  ['act', 'common.field.act.label'],
  ['quest', 'common.field.quest.label', { name: true }],
  ['dlc', 'common.field.dlc.label', { name: true }],
  ['speaker', 'common.field.speaker.label', { name: true }],
  ['occasion', 'common.field.occasion.label'],
  // 'when' IS THE ONE THE BULK PANEL SKIPS, and its own note below says why: it is
  // a pair (a canonical date and a circa flag) drawn by a date control, not a text
  // box, so a checkbox and a free-text input cannot express it.
  ['when', 'quotes.form.when.label'],
  ['place', 'common.field.place.label', { name: true }],
  ['region', 'common.field.region.label', { name: true }],
  ['recipient', 'common.field.recipient.label', { name: true }],
  ['work_title', 'common.field.work-title.label', { name: true }],
  ['locator', 'common.field.locator.label'],
  ['source_author', 'common.field.source-author.label', { name: true }],
  ['language', 'common.field.language.label', { name: true }],
]
const WRITABLE = new Set(WRITABLE_FIELDS.map(([k]) => k))

// AND ONE FIELD THE QUEUE HAS THAT THE ADD FORM DOES NOT, which is not an oversight
// in either. No door lists `actor`, because a person capturing a line types the
// character and the server fills the performer in from the cast. A FILE can state
// one outright — and `autofillActor` (dialogue_handlers.go:262) returns it unchanged
// when it is non-empty, so a parser's wrong actor survives approval untouched. Drop
// the box and that is a repair the queue cannot make.
//
// Beside `character`, because they are the two halves of one question and the cast
// popover under each reads the other way round.
function stagedLocatorKeys(work, quote) {
  const keys = fieldKeys(stagedDoor(work, quote), { mediaType: stagedMedia(work) }).filter((k) => WRITABLE.has(k))
  const at = keys.indexOf('character')
  if (at < 0 || stagedDoor(work, quote) !== 'dialogue') return keys
  return [...keys.slice(0, at + 1), 'actor', ...keys.slice(at + 1)]
}

// What the row already holds, as the box will hold it — ONE function, read by the
// seed and by the diff. Two spellings of this is how a form comes to re-send a
// field nobody touched.
//
// EVERYTHING IS A STRING, including the two counts. '' is unset and '0' is season
// 0, where a series keeps its specials, and the endpoint takes both as text for
// exactly that reason (see stagedBulkReq).
function stagedInitial(quote, key) {
  // 0044 stores a decimal; '' clears it, so absent and cleared stay apart.
  if (key === 'chapter_no') return quote.chapter_no ? String(quote.chapter_no) : ''
  if (key === 'season' || key === 'episode') return String(quote[key] ?? '')
  // THE BOX HOLDS THE PHRASE, THE COLUMN HOLDS THE CANONICAL FORM. '-0399' is what
  // sorts and groups; '399 BCE' is what a person types and reads. The add form
  // converts on the way out and Quotes.jsx:295 converts on the way in — this is
  // that same inverse, and writing it any other way makes the era unspellable.
  if (key === 'when') return partialDateInputValue(quote.occasion_date || '')
  return quote[key] || ''
}

// StagedQueueForm — the per-row editor for one-offs. It posts the same bulk
// endpoint with a single id, so there is one set of validation rules; the quote's
// own text is not editable here, because a staged row is a record of what the file
// said. Fix wording after approval, in the normal edit form.
function StagedQuoteForm({ quote, work, onSaved, onCancel }) {
  // WHAT THE DESTINATION ALREADY KNOWS, through the hook the add and edit forms
  // both use. The owner's point on this screen: it is the one place a value is most
  // likely to be a near-miss of one that already exists — an importer writes "Ch. 4"
  // where the library says "Chapter 4", and "Kim Kitsuragi" where a cast row says
  // "Kim Kitsuragi ". A queue with no suggestions is the queue asking the reader to
  // remember what they typed last month.
  //
  // NULL UNTIL THE ROW HAS A DESTINATION, which `useWorkSuggestions` handles by
  // fetching nothing — see the `key` guard in the hook. A staged work bound for a
  // NEW library record legitimately has nothing behind it.
  //
  // BY `kind === 'book'`, NOT BY `kind === 'movie'`. A staged work's kind is one of
  // book, movie, show, game and quotes — so testing for 'movie' sent every SHOW and
  // every GAME down the books branch, which fetched `/books/<a movie id>/cast` and
  // `/books/<id>/chapters`. A game's DLC box could then never suggest a pack, and if
  // a book happened to hold that id the row offered another work's chapters — which
  // this file's own note calls worse than offering none.
  const suggest = useWorkSuggestions(
    work?.target_id ? { kind: work.kind === 'book' ? 'book' : 'screen', id: work.target_id } : null,
  )
  // WHICH BOXES THIS ROW GETS — three doors, answered by addFields.js. See
  // stagedDoor and WRITABLE.
  const keys = stagedLocatorKeys(work, quote)
  const [f, setF] = useState(() => ({
    ...Object.fromEntries(keys.map((k) => [k, stagedInitial(quote, k)])),
    // The circa flag rides beside the date rather than in `keys`: it is not a field
    // of its own, it is the second half of one. See the pair's note in submit().
    circa: !!quote.occasion_circa,
    color: quote.color || 'yellow',
    favorite: !!quote.favorite,
  }))
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
    // FROM THE SAME LIST THE SEED CAME FROM, which is the whole reason that list
    // exists. This was two hand-written arrays that had to stay in step, and they
    // had already drifted: the seed put `season` in as a NUMBER and the diff
    // compared it against a string, so every row with a season re-sent its season
    // on every save — the exact thing the paragraph above forbids, in the code
    // written to obey it.
    for (const k of keys) {
      if (k === 'when') continue // a pair, handled below
      if (f[k] !== stagedInitial(quote, k)) body[k] = f[k]
    }
    // THE DATE AND ITS CIRCA GO TOGETHER OR NEITHER GOES. They are one fact — a
    // date sent without its flag is a date stated more precisely than the reader
    // meant — so a change to either sends both, and the phrase is converted to the
    // canonical form on the way out exactly as the add surface does.
    if (keys.includes('when')) {
      const movedDate = f.when !== stagedInitial(quote, 'when')
      if (movedDate || f.circa !== !!quote.occasion_circa) {
        body.occasion_date = partialDateValue(parsePartialDate(f.when, { historical: true }))
        body.occasion_circa = f.circa
      }
    }
    if (f.color !== (quote.color || 'yellow')) body.color = f.color
    if (f.favorite !== !!quote.favorite) body.favorite = f.favorite
    const msg = await onSaved(body)
    setBusy(false)
    if (msg) setErr(msg)
  }

  // ONE BOX PER FIELD KEY, in the order the table gives, and the same switch shape
  // the add surface uses for the identical job. Two hand-written groups lived here
  // and both were wrong: a book row drew a timestamp and a season, and a standalone
  // row drew no place to put its own locators at all.
  //
  // Every label is the shared one, and so is most of the example text: a placeholder
  // is an example of the FIELD rather than of the screen, so a game's act reads
  // "e.g. Act II" wherever it is asked for. Duplicating them into two locales to win
  // a key prefix is the worse trade. What IS this screen's own are the examples
  // written for it — Philip Marlowe and Elliott Gould are proper nouns, and 01:02:03
  // is a picture of a time format.
  //
  // FOUR BOXES OFFER THE LIBRARY'S OWN ANSWERS and the rest stay plain, which is not
  // a partial job: a location, a season, an episode number and a timestamp have no
  // pool to draw on — they are positions, not names, and a list of other people's
  // page numbers is noise. And every one of them stays FREE TEXT WITH SUGGESTIONS
  // rather than becoming a picker, because each is optional free text at the API and
  // a chapter the library has never seen has to stay typeable.
  function box(key) {
    switch (key) {
      case 'chapter_no':
        return <Field key={key} label={t('common.field.chapter-no.label')} inputMode="decimal" placeholder={t('staging.form.chapter-no.placeholder')} value={f.chapter_no} onChange={upd('chapter_no')} />
      case 'chapter':
        return (
          <SuggestCombo
            key={key}
            label={t('common.field.chapter-name.label')}
            placeholder={t('staging.form.chapter.placeholder')}
            value={f.chapter}
            onChange={(v) => setF((d) => ({ ...d, chapter: v }))}
            options={suggest.chapterNames.map((name) => ({ name }))}
          />
        )
      case 'location':
        return <Field key={key} label={t('common.field.location.label')} placeholder={t('staging.form.location.placeholder')} value={f.location} onChange={upd('location')} />
      case 'character':
        return (
          <CastCombo
            key={key}
            label={t('common.field.character.label')}
            placeholder={t('staging.form.character.placeholder')}
            value={f.character}
            onChange={(v) => setF((d) => ({ ...d, character: v }))}
            cast={suggest.cast}
          />
        )
      // THE ACTOR BOX TAKES THE SAME CAST, the other way round — `field` decides
      // which of a row's two names this box is for and which becomes the second line
      // under it. Typing "robbie" shows Margot Robbie with Harley Quinn beneath,
      // which is how a reader knows the name matched a real row.
      case 'actor':
        return (
          <CastCombo
            key={key}
            label={t('common.field.actor.label')}
            field="actor"
            placeholder={t('staging.form.actor.placeholder')}
            value={f.actor}
            onChange={(v) => setF((d) => ({ ...d, actor: v }))}
            cast={suggest.cast}
          />
        )
      case 'season':
        return <Field key={key} label={t('common.field.season.label')} placeholder={t('staging.form.season.placeholder')} value={f.season} onChange={upd('season')} />
      case 'episode':
        return <Field key={key} label={t('common.field.episode.label')} placeholder={t('staging.form.episode.placeholder')} value={f.episode} onChange={upd('episode')} />
      case 'episode_name':
        return <Field key={key} label={t('common.field.episode-name.label')} nameCase placeholder={t('capture.form.episode-name.placeholder')} value={f.episode_name} onChange={upd('episode_name')} />
      case 'timestamp':
        return <Field key={key} label={t('common.field.timestamp.label')} placeholder={t('staging.form.timestamp.placeholder')} value={f.timestamp} onChange={upd('timestamp')} />
      // 0070 closes a range.
      case 'timestamp_end':
        return <Field key={key} label={t('common.field.timestamp-end.label')} placeholder={t('add.form.timestamp-end.placeholder')} value={f.timestamp_end} onChange={upd('timestamp_end')} />
      case 'act':
        return <Field key={key} label={t('common.field.act.label')} placeholder={t('capture.form.act.placeholder')} value={f.act} onChange={upd('act')} />
      case 'quest':
        return <Field key={key} label={t('common.field.quest.label')} nameCase placeholder={t('capture.form.quest.placeholder')} value={f.quest} onChange={upd('quest')} />
      // 0071 says which pack a game's line came in.
      case 'dlc':
        return (
          <SuggestCombo
            key={key}
            label={t('common.field.dlc.label')}
            placeholder={t('add.form.dlc.placeholder')}
            value={f.dlc}
            onChange={(v) => setF((d) => ({ ...d, dlc: v }))}
            options={suggest.packs.map((name) => ({ name }))}
          />
        )
      case 'speaker':
        return <Field key={key} label={t('common.field.speaker.label')} nameCase placeholder={t('common.field.speaker.placeholder')} value={f.speaker} onChange={upd('speaker')} />
      case 'occasion':
        return <Field key={key} label={t('common.field.occasion.label')} placeholder={t('common.field.occasion.placeholder')} value={f.occasion} onChange={upd('occasion')} />
      // THE DATE IS A PAIR, and the control is the add surface's own: the box holds
      // the phrase a person typed and the column holds '-0399', so the two halves
      // travel together and the era stays spellable.
      case 'when':
        return (
          <PartialDateField
            key={key}
            label={t('quotes.form.when.label')}
            value={f.when}
            onChange={(v) => setF((d) => ({ ...d, when: v }))}
            historical
            circa={f.circa}
            onCirca={(v) => setF((d) => ({ ...d, circa: v }))}
            circaLabel={t('quotes.form.circa.label')}
          />
        )
      case 'place':
        return <Field key={key} label={t('common.field.place.label')} nameCase placeholder={t('common.field.place.placeholder')} value={f.place} onChange={upd('place')} />
      case 'region':
        return <Field key={key} label={t('common.field.region.label')} nameCase placeholder={t('quotes.form.region.placeholder')} value={f.region} onChange={upd('region')} />
      case 'recipient':
        return <Field key={key} label={t('common.field.recipient.label')} nameCase placeholder={t('quotes.form.recipient.placeholder')} value={f.recipient} onChange={upd('recipient')} />
      // WHAT THE LINE CAME OUT OF (0070). A speech reaches a reader through
      // somebody's text, and the person who wrote that text is neither the speaker
      // nor anyone else on the row.
      case 'work_title':
        return <Field key={key} label={t('common.field.work-title.label')} nameCase placeholder={t('quotes.form.work-title.placeholder')} value={f.work_title} onChange={upd('work_title')} />
      case 'locator':
        return <Field key={key} label={t('common.field.locator.label')} placeholder={t('quotes.form.locator.placeholder')} value={f.locator} onChange={upd('locator')} />
      case 'source_author':
        return <Field key={key} label={t('common.field.source-author.label')} nameCase placeholder={t('add.form.source-author.placeholder')} value={f.source_author} onChange={upd('source_author')} />
      // On every door, and an import is where it is most often missing: a clippings
      // export of a Bengali novel arrives with none at all.
      case 'language':
        return <Field key={key} label={t('common.field.language.label')} nameCase placeholder={t('common.field.language.placeholder')} value={f.language} onChange={upd('language')} />
      default:
        // A key WRITABLE admits and this switch does not draw. Unreachable while the
        // two agree, and silent rather than thrown because a form that crashes on an
        // unknown field is worse than one missing a box.
        return null
    }
  }

  return (
    <div className="space-y-4">
      <p
        className="whitespace-pre-wrap"
        style={{ fontFamily: 'var(--font-display)', fontWeight: 'var(--font-display-weight)', fontVariantCaps: 'var(--font-display-caps)', textTransform: 'var(--font-display-case)', fontVariantNumeric: 'var(--font-display-figures)', fontStyle: 'italic', fontSize: 'var(--type-display-17)' }}
      >
        {t('staging.form.quoted', { text: quote.quote || quote.note })}
      </p>
      <p className="microcopy">{t('staging.form.locators.prose')}</p>
      <div className="grid gap-3 sm:grid-cols-2">{keys.map(box)}</div>
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
