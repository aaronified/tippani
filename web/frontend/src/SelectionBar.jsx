import { useState } from 'react'
import { json, errText } from './api.js'
import { BULK_TAGS, bulkActionsFor } from './actions.jsx'
import { ColorSwatches, ConfirmDialog, GhostButton, MonoLabel, TokenInput, toast } from './ui.jsx'

// The bar a selection puts up, and the actions it offers.
//
// IT READS THE SAME REGISTRY THE CARD MENU DOES (actions.jsx), which is the whole
// reason the registry exists: a bar offering something the menu does not — or the
// other way round — looks completely normal on both screens, and the divergence
// only surfaces when somebody wonders why they cannot do to forty what they just
// did to one.
//
// STICKY, because selecting forty things and scrolling to check one of them should
// not lose the controls. And the count it shows is a count it can act on: the
// selection clears the ids that leave the visible list (see useSelection), so the
// bar goes with them rather than reporting a number about nothing.

// KIND_ROUTES maps a selection's kind to its endpoints. The bulk vocabulary and the
// URLs differ by one word — a standalone quote is `/quotes` — and this is the one
// place that has to know.
const KIND_ROUTES = {
  annotation: { bulk: '/annotations/bulk', del: '/annotations/bulk/delete', noun: ['highlight', 'highlights'] },
  dialogue: { bulk: '/dialogues/bulk', del: '/dialogues/bulk/delete', noun: ['film line', 'film lines'] },
  quote: { bulk: '/quotes/bulk', del: '/quotes/bulk/delete', noun: ['quote', 'quotes'] },
}

// deletePhrase has to match the server's, exactly, because the server is where it
// is checked. Duplicated on purpose rather than fetched: a client that cannot
// compose the phrase cannot show it, and showing it is the whole affordance.
export function deletePhrase(kind, n) {
  const pair = KIND_ROUTES[kind]?.noun || ['item', 'items']
  return `delete ${n} ${n === 1 ? pair[0] : pair[1]}`
}

export function SelectionBar({ selection, onDone, tagSuggestions = [] }) {
  const [tags, setTags] = useState([])
  const [busy, setBusy] = useState(false)
  const [asking, setAsking] = useState(false)
  const [typed, setTyped] = useState('')
  const { kind, ids, count } = selection

  if (!count || !kind || !KIND_ROUTES[kind]) return null
  const routes = KIND_ROUTES[kind]

  // The registry says what a selection of this kind can do; the bar renders the
  // input each action asks for. Colour is not in the registry's list because it is
  // not an action with a form — it IS a form, six swatches wide, and a menu item
  // called "Set colour" that then asks which one is one tap too many for the thing
  // people select forty quotes to do.
  const acts = bulkActionsFor(kind, ids, { addTags: true })
  const canTag = acts.some((a) => a.form === BULK_TAGS)

  async function post(path, body, said) {
    setBusy(true)
    const r = await json('POST', path, { ids, ...body })
    setBusy(false)
    if (!r.ok) return toast(errText(r, 'could not apply'))
    toast(said)
    onDone?.()
  }

  const apply = () => {
    const names = tags.map((t) => t.trim()).filter(Boolean)
    if (!names.length) return toast('type a tag first')
    setTags([])
    post(routes.bulk, { add_tags: names }, `tagged ${count}`)
  }

  const recolour = (c) => post(routes.bulk, { color: c }, `recoloured ${count}`)
  const favourite = () => post(routes.bulk, { favorite: true }, `favourited ${count}`)

  const phrase = deletePhrase(kind, count)
  const remove = async () => {
    setAsking(false)
    setBusy(true)
    const r = await json('POST', routes.del, { ids, confirm: phrase })
    setBusy(false)
    setTyped('')
    if (!r.ok) return toast(errText(r, 'could not delete'))
    const trashID = r.data?.trash_id
    // The same offer a single delete makes, over the whole selection — one bin
    // entry, one Undo (see migration 0032).
    toast(
      `deleted ${count}`,
      trashID
        ? {
            label: 'Undo',
            onClick: async () => {
              const u = await json('POST', `/trash/${trashID}/restore`)
              toast(u.ok ? 'restored' : errText(u, 'could not undo'))
              onDone?.()
            },
          }
        : undefined,
    )
    onDone?.()
  }

  return (
    <div className="selection-bar">
      <MonoLabel style={{ color: 'var(--accent-ui)' }}>
        {count} {count === 1 ? KIND_ROUTES[kind].noun[0] : KIND_ROUTES[kind].noun[1]} selected
      </MonoLabel>

      {/* Colour first: it is the single most plausible reason to select forty
          quotes, and it needs no typing. */}
      <span className="shrink-0">
        <ColorSwatches
          collapsible
          value=""
          onChange={recolour}
          ariaLabel={`Recolour the ${count} selected`}
        />
      </span>

      {canTag && (
        <span className="selection-tags">
          <TokenInput
            value={tags}
            onChange={setTags}
            suggestions={tagSuggestions}
            placeholder="add tags"
            ariaLabel="Tags to add to the selection"
          />
        </span>
      )}
      {canTag && (
        <GhostButton onClick={apply} disabled={busy || tags.length === 0}>
          Add tags
        </GhostButton>
      )}
      <GhostButton onClick={favourite} disabled={busy}>
        Favourite
      </GhostButton>

      {/* Delete is last, danger-styled, and never adjacent to the controls that
          merely change a field. It is also the only one that asks. */}
      <GhostButton className="tp-btn-danger" onClick={() => setAsking(true)} disabled={busy}>
        Delete
      </GhostButton>

      <GhostButton className="ml-auto" onClick={selection.clear}>
        Clear
      </GhostButton>

      <ConfirmDialog
        open={asking}
        title={`Delete ${count} ${count === 1 ? routes.noun[0] : routes.noun[1]}?`}
        body={
          <div className="space-y-2">
            <p className="microcopy">
              They go to the bin and can be put back — one entry for the whole selection, with an Undo
              in the toast. Type <b>{phrase}</b> to confirm.
            </p>
            <input
              className="tp-input"
              autoFocus
              value={typed}
              placeholder={phrase}
              aria-label="Type the confirmation phrase"
              onChange={(e) => setTyped(e.target.value)}
            />
          </div>
        }
        confirmLabel="Delete them"
        confirmDisabled={typed.trim().toLowerCase() !== phrase}
        onConfirm={remove}
        onCancel={() => {
          setAsking(false)
          setTyped('')
        }}
      />
    </div>
  )
}
