import { useEffect, useMemo, useState } from 'react'
import { json, errText } from './api.js'
import {
  ColorSwatches,
  EmptyState,
  ErrorText,
  GhostButton,
  HandCard,
  MonoLabel,
  PageHeader,
  SortableTh,
  TAG_STYLES,
  TagChip,
  useIsMobileScreen,
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

  return (
    <section className="space-y-5">
      <div className={mobile ? 'mobile-sticky-bar' : ''}>
        <PageHeader
          title="Tags"
          counts={tags ? `${tags.length} tag${tags.length === 1 ? '' : 's'} · shared by books & films` : undefined}
        />
      </div>
      <ErrorText>{error}</ErrorText>
      {/* Add-cards lead the page: side by side on desktop, stacked on a phone. */}
      <div className="grid gap-4 md:grid-cols-2">
        <NewTagCard onCreated={load} />
        <NewStickerCard onUploaded={reload} />
      </div>
      {tags && tags.length === 0 && (
        <EmptyState>no tags yet — create one above, or tag an annotation</EmptyState>
      )}
      {tags && tags.length > 0 && (
        <>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {top.map((t, i) => (
              <CompactTagCard key={t.id} tag={t} index={i} onChanged={load} />
            ))}
          </div>
          {tags.length > 5 && (
            <GhostButton type="button" onClick={() => setShowTable((v) => !v)}>
              {showTable ? 'Hide table' : `More tags (${tags.length - 5})…`}
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

function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

async function deleteTag(tag, onChanged, setError) {
  const uses = tag.annotations + tag.dialogues
  const detach = uses > 0 ? ` It will be detached from ${plural(uses, 'item')} — they keep working, just untagged.` : ''
  if (!confirm(`Delete tag "${tag.name}"?${detach}`)) return
  const r = await json('DELETE', `/tags/${tag.id}`)
  if (r.ok) onChanged()
  else setError(errText(r, 'could not delete tag'))
}

// CompactTagCard — the small top-row card: chip + counts + edit/delete, or the
// inline edit form. Deliberately lighter than the old full card so ~5 fit a row.
function CompactTagCard({ tag, index, onChanged }) {
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState('')
  const uses = tag.annotations + tag.dialogues

  return (
    <HandCard variant={index % 4} className="flex flex-col gap-2 p-3">
      {editing ? (
        <TagForm
          initial={tag}
          submitLabel="Save"
          onCancel={() => setEditing(false)}
          onSubmit={async (fields) => {
            const r = await json('PUT', `/tags/${tag.id}`, fields)
            if (!r.ok) return errText(r, 'could not save tag')
            setEditing(false)
            onChanged()
            return null
          }}
        />
      ) : (
        <>
          <TagChip color={tag.color} style={tag.style}>
            {tag.name} · {uses}
          </TagChip>
          <ErrorText>{error}</ErrorText>
          <div className="mt-auto flex gap-3 pt-0.5">
            <button className="tp-link" onClick={() => setEditing(true)}>
              edit
            </button>
            <button className="tp-link tp-link-danger" onClick={() => deleteTag(tag, onChanged, setError)}>
              delete
            </button>
          </div>
        </>
      )}
    </HandCard>
  )
}

// TagTable — the full, sortable vocabulary (behind "more"). Scrolls inside its
// own box so a huge tag list can't bury the sticker manager below it.
function TagTable({ tags, onChanged }) {
  const { sort, toggle, apply } = useSort('uses', 'desc')
  const [editingId, setEditingId] = useState(null)
  const [error, setError] = useState('')
  const rows = apply(tags, {
    name: (t) => t.name.toLowerCase(),
    style: (t) => t.style,
    uses: (t) => t.annotations + t.dialogues,
  })
  return (
    <>
      <ErrorText>{error}</ErrorText>
      <div className="ann-table-wrap" style={{ maxHeight: 420, overflowY: 'auto' }}>
        <table className="ann-table">
          <thead>
            <tr>
              <SortableTh col="name" label="Tag" sort={sort} onSort={toggle} />
              <SortableTh col="style" label="Style" sort={sort} onSort={toggle} />
              <SortableTh col="uses" label="Uses" sort={sort} onSort={toggle} />
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) =>
              editingId === t.id ? (
                <tr key={t.id} className="editing-row">
                  <td colSpan={4}>
                    <TagForm
                      initial={t}
                      submitLabel="Save"
                      onCancel={() => setEditingId(null)}
                      onSubmit={async (fields) => {
                        const r = await json('PUT', `/tags/${t.id}`, fields)
                        if (!r.ok) return errText(r, 'could not save tag')
                        setEditingId(null)
                        onChanged()
                        return null
                      }}
                    />
                  </td>
                </tr>
              ) : (
                <tr key={t.id}>
                  <td><TagChip color={t.color} style={t.style}>{t.name}</TagChip></td>
                  <td className="col-mono">{t.style}</td>
                  <td className="col-mono">{t.annotations + t.dialogues}</td>
                  <td className="col-actions">
                    <button className="tp-link" onClick={() => setEditingId(t.id)}>edit</button>
                    <button className="tp-link tp-link-danger" onClick={() => deleteTag(t, onChanged, setError)}>del</button>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}

// NewTagCard — dashed "＋ New tag" card (mockup 24) around the shared form.
function NewTagCard({ onCreated }) {
  return (
    <section className="p-5" style={{ border: '1.6px dashed var(--ink-border)', borderRadius: 14 }}>
      <p className="mb-3 font-semibold" style={{ color: 'var(--accent-ui)' }}>
        ＋ New tag
      </p>
      <TagForm
        submitLabel="Create tag"
        onSubmit={async (fields) => {
          const r = await json('POST', '/tags', fields)
          if (!r.ok) return errText(r, 'could not create tag') // 409 duplicate lands here
          onCreated()
          return null
        }}
      />
    </section>
  )
}

// TagForm serves both create (no initial) and inline edit. onSubmit gets
// {name, color, style} and returns an error string or null.
function TagForm({ initial, submitLabel, onSubmit, onCancel }) {
  const [name, setName] = useState(initial?.name || '')
  const [color, setColor] = useState(initial?.color || 'yellow')
  const [style, setStyle] = useState(initial?.style || 'sticker')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (!name.trim()) return setError('name is required')
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
    <form onSubmit={submit} className="space-y-3">
      <input
        className="tp-input"
        placeholder="name…"
        maxLength={64}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <div className="flex items-center gap-3">
        <MonoLabel>Colour</MonoLabel>
        <ColorSwatches value={color} onChange={setColor} />
      </div>
      <div className="space-y-1.5">
        <MonoLabel>Style</MonoLabel>
        <StylePicker color={color} value={style} onChange={setStyle} />
      </div>
      <ErrorText>{error}</ErrorText>
      <div className="flex flex-wrap gap-2">
        <button className="tp-btn tp-btn-primary" disabled={busy}>
          {submitLabel}
        </button>
        {onCancel && (
          <GhostButton type="button" onClick={onCancel} disabled={busy}>
            Cancel
          </GhostButton>
        )}
      </div>
    </form>
  )
}

// StylePicker — the five styles as live chip previews in the chosen colour
// (§6); selection ring is a border so the focus outline stays intact (§11).
function StylePicker({ color, value, onChange }) {
  return (
    <div className="flex flex-wrap items-center gap-1" role="radiogroup" aria-label="Tag style">
      {TAG_STYLES.map((s) => (
        <button
          key={s}
          type="button"
          role="radio"
          aria-checked={value === s}
          title={s}
          onClick={() => onChange(s)}
          style={{
            background: 'none',
            padding: 7,
            border: `2px solid ${value === s ? 'var(--accent-ui)' : 'transparent'}`,
            borderRadius: 10,
          }}
        >
          <TagChip color={color} style={s}>
            {s}
          </TagChip>
        </button>
      ))}
    </div>
  )
}
