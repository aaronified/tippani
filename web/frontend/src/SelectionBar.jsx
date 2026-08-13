import { useState } from 'react'
import { json, errText } from './api.js'
import { BULK_TAGS, bulkActionsFor, isWorkKind } from './actions.jsx'
import { StickerPicker, useStickers } from './stickers.jsx'
import {
  ColorSwatches,
  ConfirmDialog,
  FormModal,
  GhostButton,
  MonoLabel,
  Select,
  TokenInput,
  toast,
} from './ui.jsx'

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
//
// ONE BAR, TWO VERY DIFFERENT SELECTIONS (1.11.1). A selection of quotes and a
// selection of works share almost nothing — a book has no colour and no tag of its
// own, a quote has no shelf and nothing to look up — and the registry is what
// keeps that from becoming two components that drift. Which actions appear is
// decided by which callbacks this file passes for the kind in hand, and nothing
// here branches on the kind twice.

// KIND_ROUTES maps a selection's kind to its endpoints and to the word a reader
// types. The bulk vocabulary and the URLs differ by one word — a standalone quote
// is `/quotes`, a film is a "title" — and this is the one place that has to know.
const KIND_ROUTES = {
  annotation: { bulk: '/annotations/bulk', del: '/annotations/bulk/delete', noun: ['highlight', 'highlights'] },
  dialogue: { bulk: '/dialogues/bulk', del: '/dialogues/bulk/delete', noun: ['film line', 'film lines'] },
  quote: { bulk: '/quotes/bulk', del: '/quotes/bulk/delete', noun: ['quote', 'quotes'] },
  // A work carries its quotes into the bin with it, which is why the phrase and
  // the dialog say so rather than just naming a count.
  book: { bulk: '/books/bulk', del: '/books/bulk/delete', status: '/books/bulk/status', noun: ['book', 'books'] },
  movie: { bulk: '/movies/bulk', del: '/movies/bulk/delete', status: '/movies/bulk/status', noun: ['title', 'titles'] },
}

// deletePhrase has to match the server's, exactly, because the server is where it
// is checked. Duplicated on purpose rather than fetched: a client that cannot
// compose the phrase cannot show it, and showing it is the whole affordance.
export function deletePhrase(kind, n) {
  const pair = KIND_ROUTES[kind]?.noun || ['item', 'items']
  return `delete ${n} ${n === 1 ? pair[0] : pair[1]}`
}

// SHELF_CHOICES are the shelf states a selection can be moved to, per side. A book
// reads and a film watches — the server refuses the other side's word, so offering
// it would be a control that only ever errors.
const SHELF_CHOICES = (kind) => [
  ['', 'Clear'],
  [kind === 'movie' ? 'watching' : 'reading', kind === 'movie' ? 'Watching' : 'Reading'],
  ['paused', 'Paused'],
  ['abandoned', 'Abandoned'],
  ['completed', 'Completed'],
]

// FILL_CHUNK matches the server's per-call cap. A selection larger than this is
// sent as sequential batches, which is what bounds provider load — the same shape
// the re-verify console already uses.
const FILL_CHUNK = 15

export function SelectionBar({ selection, rows = [], onDone, tagSuggestions = [] }) {
  const [tags, setTags] = useState([])
  const [busy, setBusy] = useState(false)
  const [asking, setAsking] = useState(false)
  const [typed, setTyped] = useState('')
  const [sealing, setSealing] = useState(false)
  const { kind, ids, count } = selection

  if (!count || !kind || !KIND_ROUTES[kind]) return null
  const routes = KIND_ROUTES[kind]
  const isWork = isWorkKind(kind)

  // Whether the selection is ALREADY out of the quiz, which is what decides the
  // word on the button. Every-not-some on purpose: over a mixed selection the
  // button should do the thing that changes something, and "skip these" changes
  // something unless they are all skipped already.
  const picked = rows.filter((r) => selection.isSelected(r.id))
  const allExcluded = picked.length > 0 && picked.every((r) => r.review_excluded)

  async function post(path, body, said) {
    setBusy(true)
    const r = await json('POST', path, { ids, ...body })
    setBusy(false)
    if (!r.ok) return toast(errText(r, 'could not apply'))
    toast(said)
    onDone?.()
  }

  // fillGaps sends the selection in batches the server will accept and reports one
  // total. A per-batch toast for a selection of forty would be three toasts saying
  // three different numbers about one action.
  async function fillGaps() {
    setBusy(true)
    const key = kind === 'book' ? 'book_ids' : 'movie_ids'
    let fields = 0
    let failed = 0
    for (let i = 0; i < ids.length; i += FILL_CHUNK) {
      const r = await json('POST', '/metadata/fill', { [key]: ids.slice(i, i + FILL_CHUNK) })
      if (!r.ok) {
        setBusy(false)
        return toast(errText(r, 'could not fill'))
      }
      // The FIELD count is what the toast reports, not the work count: "filled 3
      // books" over a selection of forty reads as a failure, while "filled 7
      // fields" is what actually happened and is unambiguously a win.
      fields += r.data?.fields || 0
      failed += r.data?.failed || 0
    }
    setBusy(false)
    // "Nothing was missing" is the good case and has to read like one, or people
    // learn to distrust the button.
    toast(fields === 0 ? (failed ? 'nothing could be fetched' : 'nothing was missing') : `filled ${fields} fields`)
    onDone?.()
  }

  const phrase = deletePhrase(kind, count)

  // EVERY CALLBACK HERE IS A REAL FUNCTION, and the bar invokes actions only
  // through `run`. Passing a bare `true` as a presence flag for the ones whose
  // control the bar draws itself (tags, the seal, the delete confirm) worked right
  // up until something called `run` on one of them — which is exactly what
  // happened to the shelf dropdown: the action appeared, the control rendered, and
  // choosing a shelf threw. A flag that is only ever read as a boolean is a
  // function waiting to be called.
  const acts = bulkActionsFor(kind, ids, {
    // Quotes.
    setColour: !isWork ? (_, c) => post(routes.bulk, { color: c }, `recoloured ${count}`) : undefined,
    addTags: !isWork ? (_, names) => post(routes.bulk, { add_tags: names }, `tagged ${count}`) : undefined,
    setSticker: !isWork
      ? // 0 is the server's clear, and it has to be sent as a number rather than as
        // an absent field — see bulkTagReq, where a pointer is what keeps "no
        // sticker" apart from "not saying".
        (_, seal) =>
          post(routes.bulk, { sticker_id: seal == null ? 0 : seal }, seal == null ? 'seals removed' : `sealed ${count}`)
      : undefined,
    favourite: !isWork ? () => post(routes.bulk, { favorite: true }, `favourited ${count}`) : undefined,
    // Works.
    fillGaps: isWork ? fillGaps : undefined,
    setShelf: isWork ? (_, status) => post(routes.status, { status }, `moved ${count}`) : undefined,
    // Both.
    excluded: allExcluded,
    setReview: (_, wasExcluded) =>
      post(routes.bulk, { review: wasExcluded }, wasExcluded ? 'back in the quiz' : `skipping ${count}`),
    remove: () => confirmedDelete(),
  })
  const byID = Object.fromEntries(acts.map((a) => [a.id, a]))
  const canTag = acts.some((a) => a.form === BULK_TAGS)

  const applyTags = () => {
    const names = tags.map((t) => t.trim()).filter(Boolean)
    if (!names.length) return toast('type a tag first')
    setTags([])
    byID['add-tags'].run(names)
  }

  const applySeal = (seal) => {
    setSealing(false)
    byID.sticker.run(seal)
  }

  async function confirmedDelete() {
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
        {count} {count === 1 ? routes.noun[0] : routes.noun[1]} selected
      </MonoLabel>

      {byID.colour && (
        <span className="shrink-0">
          <ColorSwatches
            collapsible
            value=""
            onChange={(c) => byID.colour.run(c)}
            ariaLabel={`Recolour the ${count} selected`}
          />
        </span>
      )}

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
        <GhostButton onClick={applyTags} disabled={busy || tags.length === 0}>
          Add tags
        </GhostButton>
      )}

      {byID.sticker && (
        <GhostButton onClick={() => setSealing(true)} disabled={busy}>
          {byID.sticker.label}
        </GhostButton>
      )}
      {byID.favourite && (
        <GhostButton onClick={() => byID.favourite.run()} disabled={busy}>
          {byID.favourite.label}
        </GhostButton>
      )}

      {byID.shelf && (
        <label className="flex items-center gap-2">
          <MonoLabel>shelf</MonoLabel>
          <Select
            ariaLabel={`Move the ${count} selected to a shelf`}
            // null matches no option, so the trigger reads "move to…" rather than
            // naming whichever state happens to be first. It is a fire-and-forget
            // control like the colour swatches beside it, not a field with a value:
            // the selection has forty shelf states and this has one label.
            value={null}
            placeholder="move to…"
            options={SHELF_CHOICES(kind)}
            onChange={(v) => byID.shelf.run(v)}
          />
        </label>
      )}
      {byID.fill && (
        <GhostButton onClick={() => byID.fill.run()} disabled={busy}>
          {busy ? 'Fetching…' : byID.fill.label}
        </GhostButton>
      )}

      {byID.review && (
        <GhostButton onClick={() => byID.review.run()} disabled={busy}>
          {byID.review.label}
        </GhostButton>
      )}

      {/* Delete is last, danger-styled, and never adjacent to the controls that
          merely change a field. It is also the only one that asks. */}
      {byID.delete && (
        <GhostButton className="tp-btn-danger" onClick={() => setAsking(true)} disabled={busy}>
          {byID.delete.label}
        </GhostButton>
      )}

      <GhostButton className="ml-auto" onClick={selection.clear}>
        Clear
      </GhostButton>

      {/* Mounted only while it is open, which is what keeps the sticker list from
          being fetched the moment somebody selects one quote. A sticky bar that
          appears on every selection must not do work for a dialog nobody opened. */}
      {sealing && <SealDialog count={count} busy={busy} onApply={applySeal} onClose={() => setSealing(false)} />}

      <ConfirmDialog
        open={asking}
        title={`Delete ${count} ${count === 1 ? routes.noun[0] : routes.noun[1]}?`}
        body={
          <div className="space-y-2">
            <p className="microcopy">
              {isWork
                ? 'They go to the bin with every quote saved from them — one entry for the whole selection, put back together or not at all. '
                : 'They go to the bin and can be put back — one entry for the whole selection, with an Undo in the toast. '}
              Type <b>{phrase}</b> to confirm.
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
        onConfirm={() => byID.delete.run()}
        onCancel={() => {
          setAsking(false)
          setTyped('')
        }}
      />
    </div>
  )
}

// SealDialog asks which sticker, and exists as its own component for one reason:
// useStickers fetches, and mounting it inside the bar would fetch the whole sticker
// strip every time anybody selected a single quote.
function SealDialog({ count, busy, onApply, onClose }) {
  const [seal, setSeal] = useState(null)
  const { stickers, reload } = useStickers()
  return (
    <FormModal open onClose={onClose} title={`Seal ${count}`}>
      <div className="space-y-3">
        <p className="microcopy">
          One sticker across the whole selection. “none” takes the seal off every one of them.
        </p>
        <StickerPicker value={seal} onChange={setSeal} stickers={stickers} reload={reload} />
        <GhostButton onClick={() => onApply(seal)} disabled={busy}>
          Apply
        </GhostButton>
      </div>
    </FormModal>
  )
}
