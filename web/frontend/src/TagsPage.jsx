import { forwardRef, useEffect, useMemo, useRef, useState } from 'react'
import { json, errText } from './api.js'
import { t } from './i18n.js'
import { usePractice } from './review.jsx'
import {
  ColorSwatches,
  EmptyState,
  ErrorText,
  FormModal,
  GhostButton,
  HandCard,
  IconPlus,
  MonoLabel,
  PageHeader,
  Scroller,
  SortableTh,
  TableActions,
  TAG_STYLES,
  TagChip,
  useConfirm,
  useFormHost,
  useIsMobileScreen,
  useScreenBar,
  useSort,
} from './ui.jsx'
import { NewStickerCard, StickerList, useStickers } from './stickers.jsx'

// Tags page (§8.10, mockups 23–24): the per-user tag vocabulary manager —
// each tag shown as a sample chip in its own style × colour with usage
// counts, inline edit/delete, plus a New-tag card with live style previews.

export default function TagsPage() {
  const [tags, setTags] = useState(null)
  const [error, setError] = useState('')
  const [showTable, setShowTable] = useState(false)
  const mobile = useIsMobileScreen()
  const { stickers, reload } = useStickers()

  async function load() {
    const r = await json('GET', '/tags')
    if (r.ok) setTags(r.data.tags)
    else setError(errText(r))
  }
  useEffect(() => {
    load()
  }, [])

  // Most-used first, so the quick top-5 row surfaces the tags that matter; the
  // long tail lives in the sortable table behind "more".
  const byUses = useMemo(
    () => (tags ? [...tags].sort((a, b) => b.annotations + b.dialogues - (a.annotations + a.dialogues) || a.name.localeCompare(b.name)) : []),
    [tags],
  )
  const top = byUses.slice(0, 5)

  // Tags has no header controls at all — the "＋ New tag" card is a card in the
  // grid, which is right where it is and unreachable from anywhere else. The ⋯
  // gives it a name and a keyboard route, which is the whole argument for a menu
  // bar over an overflow: the row exists because the screen can do the thing, not
  // because there was nowhere else to put the button.
  const newTagRef = useRef(null)
  useScreenBar({
    actions: () => [
      { id: 'h-do', heading: t('common.mono.actions.label') },
      { id: 'new', icon: <IconPlus />, label: t('tags.new.title'), onClick: () => {
        const card = newTagRef.current
        if (!card) return
        card.scrollIntoView({ block: 'center', behavior: 'smooth' })
        card.querySelector('input, textarea')?.focus()
      } },
    ],
  })
  return (
    <section className="space-y-5">
      <div className={mobile ? 'mobile-sticky-bar' : ''}>
        <PageHeader
          title={t('nav.tab.tags.label')}
          counts={tags
            ? t('tags.header.counts', { count: tags.length, n: tags.length, noun: t('unit.tag', { count: tags.length }) })
            : undefined}
        />
      </div>
      <ErrorText>{error}</ErrorText>
      {/* Add-cards lead the page: side by side on desktop, stacked on a phone. */}
      <div className="grid gap-4 md:grid-cols-2">
        <NewTagCard ref={newTagRef} onCreated={load} />
        <NewStickerCard onUploaded={reload} />
      </div>
      {tags && tags.length === 0 && (
        <EmptyState>{t('tags.board.empty')}</EmptyState>
      )}
      {tags && tags.length > 0 && (
        <>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {top.map((row, i) => (
              <CompactTagCard key={row.id} tag={row} index={i} onChanged={load} />
            ))}
          </div>
          {tags.length > 5 && (
            <GhostButton type="button" onClick={() => setShowTable((v) => !v)}>
              {showTable
                ? t('tags.table.hide.label')
                : t('tags.table.more.label', { n: tags.length - 5, count: tags.length - 5 })}
            </GhostButton>
          )}
          {showTable && <TagTable tags={byUses} onChanged={load} />}
        </>
      )}

      <hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: '1.5rem 0 0.25rem' }} />
      <StickerList stickers={stickers} onChanged={reload} />
    </section>
  )
}

// THE QUESTION IS ASKED BY THE CALLER'S DIALOG, passed in — see the twin in
// stickers.jsx. This is not a component and cannot hold one.
async function deleteTag(tag, ask, onChanged, setError) {
  const uses = tag.annotations + tag.dialogues
  // Two whole sentences rather than one plus an appended clause — see the same
  // pair in stickers.jsx for why the reassurance is not glued on at the end.
  const question = uses > 0
    ? t('tags.delete.confirm.body-used', { count: uses, n: uses, name: tag.name, noun: t('unit.item', { count: uses }) })
    : t('tags.delete.confirm.body', { name: tag.name })
  // A tag is deleted outright — it does not go to the bin — so the question says
  // so, and its verb is drawn as the destructive one. See ConfirmDialog.
  if (!(await ask(question, { danger: true, reversible: false }))) return
  const r = await json('DELETE', `/tags/${tag.id}`)
  if (r.ok) onChanged()
  else setError(errText(r, t('error.delete.tag')))
}

// CompactTagCard — the small top-row card: chip + counts + edit/delete, or the
// inline edit form. Deliberately lighter than the old full card so ~5 fit a row.
function CompactTagCard({ tag, index, onChanged }) {
  const { ask, confirmDialog } = useConfirm()
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState('')
  const { practise, practiceDialog } = usePractice()
  const uses = tag.annotations + tag.dialogues

  return (
    <HandCard variant={index % 4} className="flex flex-col gap-2 p-3">
      <FormModal open={editing} onClose={() => setEditing(false)} title={t('tags.form.edit.title')} maxWidth={460}>
        <TagForm
          initial={tag}
          submitLabel={t('common.action.save.label')}
          onCancel={() => setEditing(false)}
          onSubmit={async (fields) => {
            const r = await json('PUT', `/tags/${tag.id}`, fields)
            if (!r.ok) return errText(r, t('error.save.tag'))
            setEditing(false)
            onChanged()
            return null
          }}
        />
      </FormModal>
      <TagChip color={tag.color} style={tag.style}>
        {t('tags.card.chip.label', { name: tag.name, n: uses })}
      </TagChip>
      <ErrorText>{error}</ErrorText>
      <div className="mt-auto flex gap-3 pt-0.5">
        {/* Only where there is something to ask about. A tag attached to nothing
            would open a round with no cards in it, and an empty dialog is a
            worse answer than an absent control. */}
        {uses > 0 && (
          <button className="tp-link" onClick={() => practise({ tag: tag.name, label: tag.name })}>
            {t('common.link.practise.label')}
          </button>
        )}
        <button className="tp-link" onClick={() => setEditing(true)}>
          {t('common.link.edit.label')}
        </button>
        <button className="tp-link tp-link-danger" onClick={() => deleteTag(tag, ask, onChanged, setError)}>
          {t('common.link.delete.label')}
        </button>
      </div>
      {practiceDialog}
      {confirmDialog}
    </HandCard>
  )
}

// TagTable — the full, sortable vocabulary (behind "more"). Scrolls inside its
// own box so a huge tag list can't bury the sticker manager below it.
function TagTable({ tags, onChanged }) {
  const { ask, confirmDialog } = useConfirm()
  const { sort, toggle, apply } = useSort('uses', 'desc')
  const [editingId, setEditingId] = useState(null)
  const [error, setError] = useState('')
  const { practise, practiceDialog } = usePractice()
  const rows = apply(tags, {
    name: (row) => row.name.toLowerCase(),
    style: (row) => row.style,
    uses: (row) => row.annotations + row.dialogues,
  })
  const editingRow = rows.find((row) => row.id === editingId)
  return (
    <>
      <ErrorText>{error}</ErrorText>
      <Scroller className="ann-table-wrap" axis="both" style={{ maxHeight: 'min(28em, 60vh)', overflowY: 'auto' }}>
        <table className="ann-table">
          <thead>
            <tr>
              <SortableTh col="name" label={t('common.field.tag.label')} sort={sort} onSort={toggle} />
              <SortableTh col="style" label={t('common.field.style.label')} sort={sort} onSort={toggle} />
              <SortableTh col="uses" label={t('tags.table.uses.label')} sort={sort} onSort={toggle} />
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td><TagChip color={row.color} style={row.style}>{row.name}</TagChip></td>
                <td className="col-mono">{row.style}</td>
                <td className="col-mono">{row.annotations + row.dialogues}</td>
                <td className="col-actions">
                  <TableActions
                    noun={t('unit.tag.one')}
                    onPractise={
                      row.annotations + row.dialogues > 0
                        ? () => practise({ tag: row.name, label: row.name })
                        : undefined
                    }
                    onEdit={() => setEditingId(row.id)}
                    onDelete={() => deleteTag(row, ask, onChanged, setError)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Scroller>
      <FormModal open={!!editingRow} onClose={() => setEditingId(null)} title={t('tags.form.edit.title')} maxWidth={460}>
        {editingRow && (
          <TagForm
            initial={editingRow}
            submitLabel={t('common.action.save.label')}
            onCancel={() => setEditingId(null)}
            onSubmit={async (fields) => {
              const r = await json('PUT', `/tags/${editingRow.id}`, fields)
              if (!r.ok) return errText(r, t('error.save.tag'))
              setEditingId(null)
              onChanged()
              return null
            }}
          />
        )}
      </FormModal>
      {practiceDialog}
      {/* The table's confirm lives here and not on a row: a row is a <tr>, and a
          dialog is not a table cell. */}
      {confirmDialog}
    </>
  )
}

// NewTagCard — dashed "＋ New tag" card (mockup 24) around the shared form.
//
// IT TAKES A REF so the ⋯ can send you to it. The card is a card in the grid and
// that is the right place for it, but a menu row that claims the screen can make
// a tag has to actually land somewhere — so the row scrolls this into view and
// puts the cursor in its first field, which is what pressing the card does.
const NewTagCard = forwardRef(function NewTagCard({ onCreated }, ref) {
  return (
    <section ref={ref} className="p-5" style={{ border: '1.6px dashed var(--ink-border)', borderRadius: 14 }}>
      <p className="mb-3 font-semibold" style={{ color: 'var(--accent-ui)' }}>
        {t('tags.new.title')}
      </p>
      <TagForm
        submitLabel={t('tags.new.submit.label')}
        onSubmit={async (fields) => {
          const r = await json('POST', '/tags', fields)
          if (!r.ok) return errText(r, t('error.create.tag')) // 409 duplicate lands here
          onCreated()
          return null
        }}
      />
    </section>
  )
})

// TagForm serves both create (no initial) and inline edit. onSubmit gets
// {name, color, style} and returns an error string or null.
function TagForm({ initial, submitLabel, onSubmit, onCancel }) {
  const [name, setName] = useState(initial?.name || '')
  const [color, setColor] = useState(initial?.color || 'yellow')
  const [style, setStyle] = useState(initial?.style || 'sticker')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // Joins the dialog's header ✓ when there is one — see FormHostContext.
  const host = useFormHost(busy ? t('common.action.save.busy') : name.trim() ? '' : t('error.validate.name-required'))

  async function submit(e) {
    e.preventDefault()
    if (!name.trim()) return setError(t('error.validate.name-blank'))
    setBusy(true)
    setError('')
    const err = await onSubmit({ name: name.trim(), color, style })
    setBusy(false)
    if (err) return setError(err)
    if (!initial) {
      setName('')
      setColor('yellow')
      setStyle('sticker')
    }
  }

  return (
    <form id={host?.formId} onSubmit={submit} className="space-y-3">
      <input
        className="tp-input"
        placeholder={t('common.field.name.placeholder')}
        maxLength={64}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <div className="flex items-center gap-3">
        <MonoLabel>{t('common.field.colour.label')}</MonoLabel>
        <ColorSwatches value={color} onChange={setColor} />
      </div>
      <div className="space-y-1.5">
        <MonoLabel>{t('common.field.style.label')}</MonoLabel>
        <StylePicker color={color} value={style} onChange={setStyle} />
      </div>
      <ErrorText>{error}</ErrorText>
      {/* Hosted in a dialog, yes and no live together in its header. The create
          form on this page is inline and keeps its own. See FormHostContext. */}
      {!host && (
        <div className="flex flex-wrap gap-2">
          <button className="tp-btn tp-btn-primary" disabled={busy}>
            {submitLabel}
          </button>
          {onCancel && (
            <GhostButton type="button" onClick={onCancel} disabled={busy}>
              {t('common.action.cancel.label')}
            </GhostButton>
          )}
        </div>
      )}
    </form>
  )
}

// StylePicker — the five styles as live chip previews in the chosen colour
// (§6); selection ring is a border so the focus outline stays intact (§11).
function StylePicker({ color, value, onChange }) {
  return (
    <div className="flex flex-wrap items-center gap-1" role="radiogroup" aria-label={t('tags.form.style.aria')}>
      {TAG_STYLES.map((s) => (
        <button
          key={s}
          type="button"
          role="radio"
          aria-checked={value === s}
          title={t(`vocab.tag-style.${s}.label`)}
          onClick={() => onChange(s)}
          style={{
            background: 'none',
            padding: 7,
            border: `2px solid ${value === s ? 'var(--accent-ui)' : 'transparent'}`,
            borderRadius: 10,
          }}
        >
          <TagChip color={color} style={s}>
            {t(`vocab.tag-style.${s}.label`)}
          </TagChip>
        </button>
      ))}
    </div>
  )
}
