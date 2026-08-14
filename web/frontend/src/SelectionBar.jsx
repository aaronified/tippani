import { useEffect, useState } from 'react'
import { json, errText } from './api.js'
import { atOverflow, atRow, bulkActionsFor, isWorkKind } from './actions.jsx'
import { StickerPicker, useStickers } from './stickers.jsx'
import {
  ColorSwatches,
  ConfirmDialog,
  FieldIconButton,
  FormModal,
  GhostButton,
  IconButton,
  IconClose,
  MonoLabel,
  MoreMenu,
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
//
// A ROW OF GLYPHS, NOT A ROW OF WORDS (1.12.0). It was one ghost button per
// action, and it grew one button per release: colour dots, a tag field, a tag
// button, Seal, Favourite, a shelf dropdown, Fill gaps, Skip in quiz, Delete,
// Deselect all, ✕. Eleven controls across a strip that on a phone is pinned under
// the header at a fixed height, most of them carrying a word wide enough to wrap
// it. Three glyphs stand in the row now and everything else folds behind a ⋯.
//
// WHICH three is decided in actions.jsx, not here (`where: ROW | OVERFLOW`), for
// the same reason the action list itself is: this component would otherwise be the
// second place with an opinion about what matters, and the two would drift the
// first time somebody added an action to one of them.
//
// The three that fold out have one thing in common — each needs something MORE
// from you before it can run. Tags need a keyboard, the seal needs a picture
// chosen, Delete needs a phrase typed. Standing open in the row, the tag field was
// the widest control in it and was open on every selection whether or not anybody
// meant to type into it.

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

export function SelectionBar({ selection, rows = [], onDone, tagSuggestions = [], onEdit }) {
  const [busy, setBusy] = useState(false)
  const [asking, setAsking] = useState(false)
  const [typed, setTyped] = useState('')
  const [sealing, setSealing] = useState(false)
  const [tagging, setTagging] = useState(false)
  const { kind, ids, count } = selection
  // The mode, not the count — see useSelection. Deselecting the last card used to
  // tear the bar off the screen, so re-picking meant finding the long press again.
  const open = selection.open ?? count > 0

  // ESCAPE LEAVES THE MODE, because a mode you can only leave by finding a button
  // is a mode. Skipped while any of this bar's own dialogs is up: there Escape
  // belongs to the dialog, and dismissing the selection underneath it would answer
  // a question nobody asked.
  const inDialog = asking || sealing || tagging
  useEffect(() => {
    if (!open || inDialog) return
    const k = (e) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      selection.dismiss?.()
    }
    document.addEventListener('keydown', k)
    return () => document.removeEventListener('keydown', k)
  }, [open, inDialog, selection])

  if (!open || !kind || !KIND_ROUTES[kind]) return null
  const routes = KIND_ROUTES[kind]
  const isWork = isWorkKind(kind)
  // Nothing picked, mode still running. Every action is disabled and says so by
  // being disabled — an enabled Delete over zero rows is a button whose only
  // possible outcome is an error from the server.
  const none = count === 0

  // Whether the selection is ALREADY out of the quiz, which is what decides the
  // word (and now the glyph) on the button. Every-not-some on purpose: over a
  // mixed selection the button should do the thing that changes something, and
  // "skip these" changes something unless they are all skipped already.
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
    // Both. `edit` is filtered to a selection of exactly one by the registry, so
    // there is no count test here — and a screen with no inline form for one row
    // simply does not pass onEdit, which is how the action stays absent rather
    // than dead.
    edit: onEdit ? (id) => onEdit(id) : undefined,
    excluded: allExcluded,
    setReview: (_, wasExcluded) =>
      post(routes.bulk, { review: wasExcluded }, wasExcluded ? 'back in the quiz' : `skipping ${count}`),
    remove: () => confirmedDelete(),
  })
  const byID = Object.fromEntries(acts.map((a) => [a.id, a]))

  const applyTags = (names) => {
    setTagging(false)
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

  // ASK, rather than run, for the three that need something more from you first.
  // Everything else in the overflow runs on the press — the menu is not a place
  // where every item opens a second window.
  const ASKS = {
    'add-tags': () => setTagging(true),
    sticker: () => setSealing(true),
    delete: () => setAsking(true),
  }
  const overflow = atOverflow(acts).map((a) => ({
    ...a,
    onClick: ASKS[a.id] || (() => a.run()),
  }))

  return (
    <div className="selection-bar">
      {/* THE COUNT IS THE CONTROL. It was a MonoLabel reading "3 books selected"
          beside a worded `Deselect all` at the far end — two items for one idea, on
          the bar that has least room for either. The number now sits in the glyph
          slot of a real button, so it wears the same round 44px border as every
          other control in the row and clearing the picks is the obvious thing to
          tap.

          `label` is what makes it follow the Button labels preference: the words
          stand beside the number on a desktop and clip away on a phone, leaving the
          badge. That is the same mechanism every other control here now uses rather
          than a second rule about widths.

          It empties the selection and leaves the bar standing — "these three are the
          wrong three" costs one tap. The ✕ at the other end ends the mode and takes
          every tick with it. Two jobs, two controls.

          The accessible name carries the count as well as the action, because with
          the words clipped the badge alone would announce as "Deselect all" and drop
          the one fact it is drawn to show. Zero is still spoken as "no books
          selected": a bare 0 in a count reads as something having gone wrong. */}
      <IconButton
        icon={<span className="selection-count">{count}</span>}
        label="Deselect all"
        ariaLabel={none
          ? `no ${routes.noun[1]} selected`
          : `Deselect all, ${count} ${count === 1 ? routes.noun[0] : routes.noun[1]} selected`}
        tooltip={none
          ? `no ${routes.noun[1]} selected`
          : `${count} ${count === 1 ? routes.noun[0] : routes.noun[1]} selected`}
        disabled={busy || none}
        onClick={() => selection.deselectAll?.()}
      />

      {/* The three that stand in the row, in the order the registry lists them.
          Two of them are not plain buttons — colour opens six dots and the shelf
          opens five states — so those two are named here and everything else is a
          glyph that just runs. A third special case would be the sign that this
          should be a lookup rather than two ifs. */}
      {atRow(acts).map((a) => {
        if (a.id === 'colour') {
          return (
            <span key={a.id} className="shrink-0" aria-disabled={none || undefined}>
              <ColorSwatches
                mini
                disabled={none || busy}
                value=""
                onChange={(c) => a.run(c)}
                ariaLabel={`Recolour the ${count} selected`}
              />
            </span>
          )
        }
        if (a.id === 'shelf') {
          return (
            <MoreMenu
              key={a.id}
              icon={a.icon}
              label={a.label}
              ariaLabel={`Move the ${count} selected to a shelf`}
              tooltip="Move to a shelf"
              disabled={none || busy}
              items={SHELF_CHOICES(kind).map(([value, label]) => ({
                id: value || 'clear',
                label,
                onClick: () => a.run(value),
              }))}
            />
          )
        }
        return (
          <IconButton
            key={a.id}
            icon={a.icon}
            // `label` PUTS THE WORDS BACK, under the preference rather than
            // unconditionally. This bar was built from glyph-only controls, so
            // `Button labels: Show` had no name to reveal and `Hide` had none to
            // clip — the one row in the app that ignored the setting in both
            // directions. The registry already carries the word for each action;
            // it just was not being rendered.
            label={a.label}
            // Still the tooltip and the accessible name, which is what keeps the
            // flipping quiz toggle readable once the words are clipped: a hover or
            // a long press says which way round the selection currently is.
            ariaLabel={a.label}
            tooltip={a.id === 'fill' && busy ? 'Fetching…' : a.label}
            disabled={none || busy}
            onClick={() => a.run()}
          />
        )
      })}

      {/* Everything else. Danger styling rides through from the registry, so
          Delete is red in here without this component knowing which one it is. */}
      {overflow.length > 0 && (
        <MoreMenu
          items={overflow}
          ariaLabel={`More for the ${count} selected`}
          tooltip="More actions"
          disabled={none || busy}
        />
      )}

      {/* `✕` ENDS THE MODE: the bar goes, and every tick on the board goes with it.
          That pairing is the only rule that can be held in the head — the marks are
          up while the bar is up — and it is what stopped a dot being left lit on the
          card you long-pressed.

          Its partner is the count badge at the far left, which empties the picks and
          leaves the bar standing. The two used to sit next to each other down here,
          which was the worse arrangement: `Deselect all` and `✕` side by side look
          like the same control twice, and the one that ends the mode is the one you
          reach for by accident. Now the destructive-to-the-mode one is alone at this
          end, and clearing the picks lives on the thing that shows how many there
          are. */}
      <FieldIconButton
        icon={<IconClose />}
        ariaLabel="Dismiss the selection"
        onClick={() => selection.dismiss?.()}
        wrapClassName="ml-auto"
      />

      {/* Each mounted only while it is open, which is what keeps the sticker list
          from being fetched the moment somebody selects one quote. A sticky bar
          that appears on every selection must not do work for a dialog nobody
          opened. */}
      {tagging && (
        <TagsDialog count={count} busy={busy} suggestions={tagSuggestions} onApply={applyTags} onClose={() => setTagging(false)} />
      )}
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

// TagsDialog asks which tags. It was a text field standing open in the bar, which
// made the widest control in the strip the one nobody had asked for yet — and on a
// phone an always-present text field is a keyboard one stray tap away.
//
// Its own component for the same reason SealDialog is: the state belongs to the
// question, not to the bar, so closing it cannot leave half a tag behind.
function TagsDialog({ count, busy, suggestions, onApply, onClose }) {
  const [tags, setTags] = useState([])
  const names = tags.map((t) => t.trim()).filter(Boolean)
  return (
    <FormModal open onClose={onClose} title={`Tag ${count}`}>
      <div className="space-y-3">
        <p className="microcopy">Every tag here is ADDED to all {count}. Nothing already on them is removed.</p>
        <TokenInput
          value={tags}
          onChange={setTags}
          suggestions={suggestions}
          placeholder="add tags"
          ariaLabel="Tags to add to the selection"
        />
        <GhostButton onClick={() => onApply(names)} disabled={busy || names.length === 0}>
          Add tags
        </GhostButton>
      </div>
    </FormModal>
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
