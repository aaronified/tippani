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
import { CardHead } from './prefRow.jsx'
import { nearDupGroups } from './nearDupes.js'
import { useMasonry } from './masonry.js'

// Tags page (§8.10, mockups 23–24): the per-user tag vocabulary manager —
// each tag shown as a sample chip in its own style × colour with usage
// counts, inline edit/delete, plus a New-tag card with live style previews.

// `embedded` IS WHAT A SCREEN GIVES UP WHEN IT BECOMES A SECTION, and it is the flag
// ChecksPage and StagingPage already take for the same reason: the page header and,
// on a phone, the sticky bar that carries it. Both belong to a SCREEN. Inside the
// metadata console this page is one section of one, so drawing them put two page
// headers on the screen — "Metadata" and then "Tags" — and a second sticky row
// directly under the console's own, which is precisely what that console's header
// note says it removed.
//
// IT SHIPPED AS A PROP THIS COMPONENT DID NOT TAKE. `<TagsPage embedded />` is quiet
// in React: an unknown prop on a function component is simply ignored, so the call
// site read as correct and the screen went on drawing its own chrome. The counts
// belong to the header, so they go with it — and the rail beside the section is where
// a section's size is stated, which is the arrangement every other door already uses.
export default function TagsPage({ embedded = false, lead = null }) {
  const [tags, setTags] = useState(null)
  const [error, setError] = useState('')
  const [showTable, setShowTable] = useState(false)
  const mobile = useIsMobileScreen()
  const { stickers, reload } = useStickers()
  const packed = useMasonry()

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

  // ── THE TAGS THAT LOOK LIKE EACH OTHER, which is what this console leads with.
  //
  // THE PACK'S OWN WORDS for why the two vocabularies share a screen: "they are
  // both things you make and then have to keep tidy, which is why this console
  // leads with the tags that look like each other."
  //
  // A VOCABULARY GROWS DUPLICATES BY BEING TYPED. "translation" and "on
  // translation" are one idea under two names, and nothing on this screen said
  // so — the table sorted by name put them adjacent and left the reader to
  // notice. Worse, the only verb for the one they did not want was DELETE, which
  // throws away which quotes carried it.
  //
  // THE SAME DETECTOR THE PEOPLE CONSOLE USES, from `nearDupes.js`, because "are
  // these two the same thing spelled twice" is one question and the repo's
  // directive is that it lives in one function both callers use. Clusters, not
  // pairs: three near-identical tags are ONE duplicate to resolve, and offering
  // them as two merges lets somebody do one and leave it half-tidied.
  const dupGroups = useMemo(() => {
    const byName = {}
    for (const row of tags || []) byName[row.name] = row
    return nearDupGroups(Object.keys(byName))
      .map((names) => names.map((n) => byName[n]).filter(Boolean))
      .filter((g) => g.length >= 2)
  }, [tags])
  // WHICH ROWS ARE IN ANY CLUSTER, so a row can ask in constant time rather than
  // the page re-clustering per row.
  const dupIds = useMemo(() => new Set(dupGroups.flat().map((row) => row.id)), [dupGroups])

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
      {!embedded && (
        <div className={mobile ? 'mobile-sticky-bar' : ''}>
          <PageHeader
            title={t('nav.tab.tags.label')}
            counts={tags
              ? t('tags.header.counts', { count: tags.length, n: tags.length, noun: t('unit.tag', { count: tags.length }) })
              : undefined}
          />
        </div>
      )}
      <ErrorText>{error}</ErrorText>
      {/* THE DUPLICATES LEAD, because they are the only thing on this screen that
          is WRONG rather than merely present. Silent at zero: a line reading "0
          tags look like duplicates" is a line that trains the reader to stop
          reading this spot, and the finished state is the common one. */}
      {dupGroups.length > 0 && (
        <DuplicateTags groups={dupGroups} onMerged={load} />
      )}
      {/* ── TWO VOCABULARIES, SIDE BY SIDE. The pack marks this section `twoUp`
          and the reason is comparison: a tag is a word you file by and a sticker
          is a mark you put ON a quote, they are the two things you make yourself,
          and a reader tidying up wants both in view. They were stacked under a
          horizontal rule, which put the stickers below the fold of a tag list
          that has no ceiling. `auto-fit` at the pack's own 340px minimum, so a
          phone gets one column without a media query deciding for it. */}
      {/* INSIDE METADATA IT IS ONE SECTION WITH THE COLOURS — "Categories", the
          owner's merge of the two pages: the colour categories (`lead`), the tags
          and the stickers are three kinds of label a reader makes, so they are
          three cards packed the way every other section's cards are. */}
      <div className={embedded ? 'meta-columns categories-grid' : 'tag-vocabularies'} ref={embedded ? packed : undefined}>
        {/* EACH OF THE THREE KINDS IS NAMED, THE SAME WAY. Stickers always had
            its heading; merged onto one page, colours and tags without theirs were
            two unnamed blocks beside a named one. */}
        {lead}
        <section className={embedded ? 'hand-card pref-group space-y-4' : 'space-y-4'} aria-label={t('nav.tab.tags.label')}>
          {embedded && <CardHead title={t('nav.tab.tags.label')} />}
          <NewTagCard ref={newTagRef} onCreated={load} />
          {tags && tags.length === 0 && (
            <EmptyState>{t('tags.board.empty')}</EmptyState>
          )}
          {tags && tags.length > 0 && (
            <>
              {/* TWO COLUMNS ON A PHONE, NOT ONE. The owner: "Tags: two columns
                  for tags, four for stickers on the phone." A tag card is a word
                  and a use count — the narrowest card in the app — and one per
                  line turned a vocabulary of twenty into twenty screens of
                  scrolling with two thirds of every line empty. `sm:grid-cols-2`
                  was doing nothing a phone could see, because it only began at
                  640px where there was already room for two. */}
              <div className="grid grid-cols-2 gap-3">
                {top.map((row, i) => (
                  <CompactTagCard key={row.id} tag={row} index={i} dupe={dupIds.has(row.id)} onChanged={load} />
                ))}
              </div>
              {tags.length > 5 && (
                <GhostButton type="button" onClick={() => setShowTable((v) => !v)}>
                  {showTable
                    ? t('tags.table.hide.label')
                    : t('tags.table.more.label', { n: tags.length - 5, count: tags.length - 5 })}
                </GhostButton>
              )}
              {showTable && <TagTable tags={byUses} dupIds={dupIds} onChanged={load} />}
            </>
          )}
        </section>
        <section className={embedded ? 'hand-card pref-group space-y-4' : 'space-y-4'} aria-label={t('tags.sticker.section.title')}>
          <CardHead title={t('tags.sticker.section.title')} />
          <NewStickerCard onUploaded={reload} />
          <StickerList stickers={stickers} onChanged={reload} />
        </section>
      </div>
    </section>
  )
}

// DuplicateTags — one card per cluster of tags that look like one tag.
//
// THE PACK'S SHAPE, AND THE VERB IT ADDS. Until now the only thing a reader could
// do about "translation" and "on translation" was delete one, which throws away
// which quotes carried it. A merge keeps them: every quote under the loser gains
// the survivor, and what goes is one of two names for one idea.
//
// THE READER PICKS THE SURVIVOR, and the counts are why the choice is theirs.
// Neither "the one with more quotes" nor "the shorter name" is right often enough
// to decide for them — "on translation" may be the better word and the rarer one.
// So each name is a button carrying its own count, and pressing it is the choice.
//
// IT IS NOT UNDOABLE, AND THE CONFIRM SAYS SO rather than the code hoping nobody
// notices. See the handler in `taxonomy_handlers.go` for why this app's tag verbs
// are outright: deleting a tag already is, and a merge destroys strictly less.
function DuplicateTags({ groups, onMerged }) {
  const { ask, confirmDialog } = useConfirm()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const uses = (row) => row.annotations + row.dialogues

  async function merge(group, keep) {
    const losers = group.filter((row) => row.id !== keep.id)
    // THE QUESTION NAMES BOTH SIDES AND THE COST. "Merge 2 tags?" is a question
    // nobody can answer — what a reader needs is which name survives, which ones
    // go, and how many quotes move.
    const ok = await ask(t('tags.dupe.merge.confirm.title', { name: keep.name }), {
      body: t('tags.dupe.merge.confirm.body', {
        losers: losers.map((row) => row.name).join(', '),
        keep: keep.name,
        n: losers.reduce((sum, row) => sum + uses(row), 0),
        count: losers.reduce((sum, row) => sum + uses(row), 0),
      }),
      confirmLabel: t('tags.dupe.merge.cta'),
      danger: true,
      reversible: false,
    })
    if (!ok) return
    setBusy(true)
    const r = await json('POST', '/tags/merge', { keep_id: keep.id, drop_ids: losers.map((row) => row.id) })
    setBusy(false)
    if (!r.ok) return setError(errText(r, t('error.merge.tag')))
    setError('')
    onMerged()
  }

  return (
    <section className="space-y-2">
      <MonoLabel>{t('tags.dupe.count.label', { count: groups.length, n: groups.length })}</MonoLabel>
      <ErrorText>{error}</ErrorText>
      {groups.map((group) => (
        <div key={group.map((row) => row.id).join('-')} className="tag-dupe-card">
          <p className="cs-row-sub">{t('tags.dupe.pick.prose')}</p>
          {/* A SCROLLER, because a cluster has no ceiling and a name is never
              truncated — the standing rule. Three near-identical tags is the
              common case and four is not rare. */}
          <Scroller axis="x" className="tag-dupe-picks">
            {group.map((row) => (
              <button
                key={row.id}
                type="button"
                className="tp-chip tp-chip-btn tactile tag-dupe-pick"
                disabled={busy}
                onClick={() => merge(group, row)}
                aria-label={t('tags.dupe.keep.aria', { name: row.name, count: uses(row), n: uses(row) })}
              >
                <TagChip color={row.color} style={row.style}>{row.name}</TagChip>
                <span className="tag-dupe-uses">{uses(row)}</span>
              </button>
            ))}
          </Scroller>
        </div>
      ))}
      {confirmDialog}
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
function CompactTagCard({ tag, index, dupe = false, onChanged }) {
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
      {/* THE PACK'S OWN SUB-LINE, on the card as well as in the table. A reader
          who never presses "more" sees only these five, so a signal that lived
          only in the table would be invisible to exactly the person who has not
          gone looking. */}
      {dupe && <p className="tag-dupe-note">{t('tags.dupe.row.note')}</p>}
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
function TagTable({ tags, dupIds, onChanged }) {
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
                <td>
                  <TagChip color={row.color} style={row.style}>{row.name}</TagChip>
                  {/* THE PACK DRAWS IT UNDER THE NAME (metadata.dc.html:755) and
                      that is where it belongs: the finding is about THIS tag, and
                      a column of flags would be a column that is empty on most
                      rows. */}
                  {dupIds?.has(row.id) && <p className="tag-dupe-note">{t('tags.dupe.row.note')}</p>}
                </td>
                <td className="col-mono">{row.style}</td>
                {/* THE COUNT IN THE ERROR COLOUR ON A DUPLICATE — the pack's
                    `countFg`. It is the number that matters when merging: it says
                    how many quotes this name is holding, which is what a reader
                    weighs when choosing which of the two to keep. */}
                <td className="col-mono" style={dupIds?.has(row.id) ? { color: 'var(--error)' } : undefined}>
                  {row.annotations + row.dialogues}
                </td>
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
