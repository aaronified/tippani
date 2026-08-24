import { useEffect, useState } from 'react'
import { atOverflow, atRow, bulkActionsFor, isWorkKind } from './actions.jsx'
import { ANTHOLOGY_KIND, AddToAnthologyDialog } from './anthologies.jsx'
import { errText, json } from './api.js'
import { t, tNodes } from './i18n.js'
import { MoveToBoardDialog } from './boards.jsx'
import { KIND_ROUTES, bulkFieldsFor, deletePhrase, overwriteWarning, useBulkOps } from './bulkOps.jsx'
import { StickerPicker, useStickers } from './stickers.jsx'
import { capKeyFor } from './works.jsx'
import {
  ColorSwatches,
  ConfirmDialog,
  FieldIconButton,
  Field,
  FormModal,
  GhostButton,
  IconButton,
  IconClose,
  MonoLabel,
  MoreMenu,
  Select,
  TokenInput,
  shelfLabel,
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

// KIND_ROUTES and deletePhrase moved to bulkOps.jsx in 1.14.2, with the four
// callbacks that used to be local variables in this component — a work's own
// card menu needs exactly the same operations for one row, and a second copy of
// them would be a card that could skip a book in the quiz slightly differently
// from the bar that selected it. Re-exported here because this is where every
// caller already imports it from.
export { deletePhrase }

// SHELF_CHOICES are the shelf states a selection can be moved to, worded for the
// rows in hand. A book reads, a film watches and a game plays.
//
// THE IN-PROGRESS WORD IS ASKED OF THE ROWS, not of the board. The Catalogue
// deals films, shows and games out of one movies table, so keying it off `kind`
// alone offered "Watching" over a selection of games — and offered no "Playing"
// at all. `items` are the SELECTED rows and capKeyFor answers per row, which is
// the same call the tiles and the transitions menu under them make (moveLabel).
//
// MIXED SELECTIONS ARE THE HONEST CASE, and there is no one word for them: every,
// not some, so a pick holding a film and a game keeps the film word. A screen that
// passes no rows lands there too rather than guessing, which is a word that is
// merely broad on a game and never wrong on a film.
//
// THE VALUE WAS NEVER THE PROBLEM. This comment used to claim the server refuses
// the other side's word, which stopped being true when games arrived:
// normalizeBulkStatus accepts either catalogue word and resolveActiveStatus then
// translates it PER ROW against that row's own media_type (internal/httpapi/
// shelf.go) — the only thing that can be right over a mixed selection. So no
// choice here can error, and the word is the whole of what was wrong.
//
// The other three states need none of this: paused, abandoned and completed are
// one word for every medium (see SHELF_META), which is why they go through
// shelfLabel with the rest rather than through a per-side key of their own.
const SHELF_CHOICES = (kind, items = []) => {
  const allGames = items.length > 0 && items.every((it) => capKeyFor(kind, it) === 'game')
  const active = allGames ? 'playing' : kind === 'movie' ? 'watching' : 'reading'
  return [
    ['', t('common.selection.shelf.clear.label')],
    [active, shelfLabel(active, kind)],
    ['paused', shelfLabel('paused', kind)],
    ['abandoned', shelfLabel('abandoned', kind)],
    ['completed', shelfLabel('completed', kind)],
  ]
}

export function SelectionBar({ selection, rows = [], onDone, tagSuggestions = [], onEdit }) {
  const [asking, setAsking] = useState(false)
  const [typed, setTyped] = useState('')
  const [sealing, setSealing] = useState(false)
  const [tagging, setTagging] = useState(false)
  const [moving, setMoving] = useState(false)
  const [gathering, setGathering] = useState(false)
  const [editingFields, setEditingFields] = useState(false)
  const { kind, ids, count } = selection
  // The mode, not the count — see useSelection. Deselecting the last card used to
  // tear the bar off the screen, so re-picking meant finding the long press again.
  const open = selection.open ?? count > 0
  // The same hook a work's card menu calls with one id. Above the early return,
  // because hooks cannot be conditional.
  const ops = useBulkOps({ kind, ids, onDone })
  const busy = ops.busy

  // ESCAPE LEAVES THE MODE, because a mode you can only leave by finding a button
  // is a mode. Skipped while any of this bar's own dialogs is up: there Escape
  // belongs to the dialog, and dismissing the selection underneath it would answer
  // a question nobody asked.
  const inDialog = asking || sealing || tagging || moving || gathering || editingFields
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
  // The counted noun, in the form the number in front of it needs. `routes.noun`
  // is still the ENGLISH pair, and is used only for the phrase the server checks.
  const noun = (n) => t(routes.unit, { count: n })
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
    setColour: !isWork ? (_, c) => ops.post({ color: c }, t('common.selection.toast.recoloured', { n: count, count })) : undefined,
    addTags: !isWork ? (_, names) => ops.post({ add_tags: names }, t('common.selection.toast.tagged', { n: count, count })) : undefined,
    setSticker: !isWork
      ? // 0 is the server's clear, and it has to be sent as a number rather than as
        // an absent field — see bulkTagReq, where a pointer is what keeps "no
        // sticker" apart from "not saying".
        (_, seal) =>
          ops.post(
            { sticker_id: seal == null ? 0 : seal },
            seal == null
              ? t('common.selection.toast.seals-removed')
              : t('common.selection.toast.sealed', { n: count, count }),
          )
      : undefined,
    favourite: !isWork ? () => ops.post({ favorite: true }, t('common.selection.toast.favourited', { n: count, count })) : undefined,
    // Standalone quotes only: an annotation belongs to its book and a dialogue to
    // its film, and neither has a board. The registry reads the callback's
    // presence, so naming the kind here is what keeps the action off those two.
    setBoard: kind === 'quote' ? (_, boardID) => ops.post({ board_id: boardID }, t('common.selection.toast.moved', { n: count, count })) : undefined,
    // NOT THROUGH ops.post, which posts to `/{kind}/bulk`: gathering writes to the
    // ANTHOLOGY's own route and changes nothing about the quotes, so there is no
    // undo to register and no row to refresh. Offered for the three kinds of quote,
    // which is what ANTHOLOGY_KIND answers.
    addToAnthology: ANTHOLOGY_KIND[kind] ? (_, anthologyID) => gather(anthologyID) : undefined,
    // Works.
    fillGaps: isWork ? ops.fillGaps : undefined,
    // ONE FIELD ACROSS THE WHOLE SELECTION — the series on five books, the
    // director on nine films. The registry has carried this action since 1.16.0
    // and the server has taken the fields for as long; the bar never passed the
    // callback, so the menu item was `available: … && !!ctx.setFields` and
    // therefore never appeared. Nothing errored and nothing logged. The whole
    // feature was one argument wide.
    //
    // A TARGETED PATCH, not a full-state write: /{kind}/bulk touches only the
    // keys present, which is what makes "set the series and leave everything
    // else" possible over a selection at all.
    setFields: (_, patch) => ops.post(patch, t('common.selection.toast.fields-set', { n: count, count })),
    setShelf: isWork ? (_, status) => ops.setShelf(status, t('common.selection.toast.moved', { n: count, count })) : undefined,
    // Both. `edit` is filtered to a selection of exactly one by the registry, so
    // there is no count test here — and a screen with no inline form for one row
    // simply does not pass onEdit, which is how the action stays absent rather
    // than dead.
    edit: onEdit ? (id) => onEdit(id) : undefined,
    excluded: allExcluded,
    setReview: (_, wasExcluded) =>
      ops.post(
        { review: wasExcluded },
        wasExcluded
          ? t('common.selection.toast.back-in-quiz')
          : t('common.selection.toast.skipping', { n: count, count }),
      ),
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

  const applyBoard = (boardID) => {
    setMoving(false)
    byID.board.run(boardID)
  }

  const applyAnthology = (anthologyID) => {
    setGathering(false)
    byID.anthology.run(anthologyID)
  }

  const applyFields = (patch) => {
    setEditingFields(false)
    byID['set-fields'].run(patch)
  }

  // A DUPLICATE IS A SKIP, NOT AN ERROR — the server ignores a quote already in the
  // anthology — so the toast reports what the response says rather than assuming the
  // whole selection landed. Saying "5 added" over a selection where two were already
  // there is the kind of small lie that makes somebody stop trusting the count.
  async function gather(anthologyID) {
    const items = ids.map((itemID) => ({ kind: ANTHOLOGY_KIND[kind], item_id: itemID }))
    const r = await json('POST', `/anthologies/${anthologyID}/entries`, { items })
    if (!r.ok) return toast(errText(r, t('error.add.generic')))
    const added = r.data?.added ?? 0
    const skipped = r.data?.skipped ?? 0
    // Two whole sentences rather than one plus an optional clause: the clause
    // does not necessarily come last in another language.
    toast(
      skipped
        ? t('common.selection.toast.gathered-some', { n: added, count: added, skipped })
        : t('common.selection.toast.gathered', { n: added, count: added }),
    )
  }

  // The typed phrase is this component's; the request and its Undo are the
  // hook's, so a work's card menu deletes through exactly the same call and
  // lands in exactly the same one-entry bin (0032).
  async function confirmedDelete() {
    setAsking(false)
    setTyped('')
    await ops.remove()
  }

  // ASK, rather than run, for the three that need something more from you first.
  // Everything else in the overflow runs on the press — the menu is not a place
  // where every item opens a second window.
  const ASKS = {
    'add-tags': () => setTagging(true),
    sticker: () => setSealing(true),
    board: () => setMoving(true),
    anthology: () => setGathering(true),
    'set-fields': () => setEditingFields(true),
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
        label={t('common.selection.deselect-all.label')}
        ariaLabel={none
          ? t('common.selection.none.aria', { noun: noun(0) })
          : t('common.selection.count.aria', { n: count, count, noun: noun(count) })}
        tooltip={none
          ? t('common.selection.none.aria', { noun: noun(0) })
          : t('common.selection.count.tip', { n: count, count, noun: noun(count) })}
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
                ariaLabel={t('common.selection.colour.aria', { n: count, count })}
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
              ariaLabel={t('common.selection.shelf.aria', { n: count, count })}
              tooltip={t('common.selection.shelf.tip')}
              disabled={none || busy}
              items={SHELF_CHOICES(kind, picked).map(([value, label]) => ({
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
            tooltip={a.id === 'fill' && busy ? t('common.action.fetch.busy') : a.label}
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
          ariaLabel={t('common.selection.more.aria', { n: count, count })}
          tooltip={t('common.selection.more.tip')}
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
        ariaLabel={t('common.selection.dismiss.aria')}
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
      {moving && (
        <MoveToBoardDialog count={count} busy={busy} onApply={applyBoard} onClose={() => setMoving(false)} />
      )}
      {gathering && (
        <AddToAnthologyDialog count={count} busy={busy} onApply={applyAnthology} onClose={() => setGathering(false)} />
      )}
      {editingFields && (
        <SetFieldsDialog
          kind={kind}
          count={count}
          rows={picked}
          busy={busy}
          onApply={applyFields}
          onClose={() => setEditingFields(false)}
        />
      )}

      <ConfirmDialog
        open={asking}
        title={t('common.selection.delete.confirm.title', { n: count, count, noun: noun(count) })}
        body={
          <div className="space-y-2">
            <p className="microcopy">
              {tNodes(
                isWork
                  ? 'common.selection.delete.confirm.body.work'
                  : 'common.selection.delete.confirm.body.quote',
                { phrase: <b key="phrase">{phrase}</b> },
              )}
            </p>
            <input
              className="tp-input"
              autoFocus
              value={typed}
              placeholder={phrase}
              aria-label={t('common.selection.delete.confirm.phrase.aria')}
              onChange={(e) => setTyped(e.target.value)}
            />
          </div>
        }
        confirmLabel={t('common.selection.delete.confirm.action.label')}
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
  const names = tags.map((tag) => tag.trim()).filter(Boolean)
  return (
    <FormModal open onClose={onClose} title={t('common.selection.tags.title', { n: count, count })}>
      <div className="space-y-3">
        <p className="microcopy">{t('common.selection.tags.body', { n: count, count })}</p>
        <TokenInput
          value={tags}
          onChange={setTags}
          suggestions={suggestions}
          placeholder={t('common.selection.tags.placeholder')}
          ariaLabel={t('common.selection.tags.input.aria')}
        />
        <GhostButton onClick={() => onApply(names)} disabled={busy || names.length === 0}>
          {t('common.action.add-tags.label')}
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
    <FormModal open onClose={onClose} title={t('common.selection.seal.title', { n: count, count })}>
      <div className="space-y-3">
        <p className="microcopy">{t('common.selection.seal.body')}</p>
        <StickerPicker value={seal} onChange={setSeal} stickers={stickers} reload={reload} />
        <GhostButton onClick={() => onApply(seal)} disabled={busy}>
          {t('common.action.apply.label')}
        </GhostButton>
      </div>
    </FormModal>
  )
}

// SetFieldsDialog — one field, one value, the whole selection.
//
// WHY ONE FIELD AT A TIME rather than a form of them all. A form of every field
// with a "leave alone" state per row is a form where the difference between "I
// did not touch this" and "I meant to clear this" is invisible, over forty rows
// at once. One named field and one value is a sentence you can read back before
// you press it — and pressing it twice is how you set two.
//
// THE WARNING COUNTS ONLY WHAT WOULD BE DESTROYED. Filling a blank is not a loss,
// so a field that is empty across the whole selection says nothing at all; a
// field with values says how many rows and how many DISTINCT answers are about to
// become one, because "overwrites 12" and "overwrites 12 different answers" are
// different sizes of mistake. That is overwriteWarning's rule, and it is the same
// non-destructive default the Details merge screen uses when it pre-ticks only
// the fields you have nothing in.
//
// EMPTY IS A CLEAR, and it is allowed — for the fields that HAVE an empty.
// /{kind}/bulk documents "" as the clear, the warning above is exactly the guard
// that makes it safe to offer, and a bulk edit that could set a series but never
// unset one would send you back to forty forms for the mistake it just helped you
// make.
//
// `required` IS THE EXCEPTION AND IT IS NOT A NICETY. media_type is NOT NULL and
// the server maps "" onto 'movie', so a blank answer there does not clear
// anything — it converts every selected show and game into a film, under a hint
// reading "Empty clears the field". The loudest possible edit made by the
// quietest possible control, and a warning is not enough of an answer to it: the
// blank is not offered, and Apply is dead until a real value is picked.
function SetFieldsDialog({ kind, count, rows, busy, onApply, onClose }) {
  const fields = bulkFieldsFor(kind)
  const [key, setKey] = useState(fields[0]?.key || '')
  const [value, setValue] = useState('')
  const spec = fields.find((f) => f.key === key)
  // A field whose column has no empty (see `required` in bulkOps.jsx). Two things
  // follow from it and both matter: the blank option is absent, and the hint that
  // promises a clear is absent with it.
  const clearable = !spec?.required
  const blank = !String(value).trim()
  // Recomputed per field, from the SELECTED rows the bar already holds — no
  // second fetch, and it changes the moment the field does.
  const warn = spec ? overwriteWarning(rows, key) : null

  // A number field sends a number, because the server's field is one: `"3"` in a
  // *float64 is a 400, and Number('') is 0, which is how both a year and a
  // series index spell "unset".
  // TRIMMED, like every single-record form. "The Hainish Cycle " stored across a
  // whole selection is a value that looks right, sorts right, and never matches
  // the one you type next time.
  const send = () => onApply({ [key]: spec?.number ? Number(value) || 0 : String(value).trim() })

  return (
    <FormModal open onClose={onClose} title={t('common.selection.edit.title', { n: count, count })}>
      <div className="space-y-3">
        <p className="microcopy">{t('common.selection.edit.body', { n: count, count })}</p>
        <div className="flex flex-wrap items-center gap-2">
          <MonoLabel>{t('common.selection.edit.field.label')}</MonoLabel>
          <Select
            ariaLabel={t('common.selection.edit.field.aria')}
            value={key}
            onChange={(v) => {
              setKey(v)
              setValue('') // a value typed for one field is not a value for the next
            }}
            options={fields.map((f) => [f.key, f.label])}
          />
        </div>
        {/* The value editor follows the field: a fixed vocabulary gets a Select, a
            description gets a box with room in it, everything else is a line. */}
        {spec?.options ? (
          <div className="flex flex-wrap items-center gap-2">
            <MonoLabel>{spec.label}</MonoLabel>
            <Select
              ariaLabel={t('common.selection.edit.value.aria')}
              value={value}
              onChange={setValue}
              options={clearable
                ? [['', t('common.selection.edit.value.none.label')], ...spec.options]
                : spec.options}
            />
          </div>
        ) : spec?.long ? (
          <label className="tp-field">
            <MonoLabel>{spec.label}</MonoLabel>
            <textarea
              className="tp-input"
              rows="4"
              aria-label={t('common.selection.edit.value.aria')}
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </label>
        ) : (
          <Field
            label={spec?.label || ''}
            // The same as-you-type capitalisation the single-record forms use for
            // these fields, so a series set over five books is spelled the way it
            // would have been spelled in one of them — and the same SPLIT, because a
            // series is a title and an author is a person (see ui.jsx's SMALL_WORDS).
            nameCase={!spec?.number && !spec?.title}
            titleCase={!!spec?.title}
            inputMode={spec?.number ? 'numeric' : undefined}
            value={value}
            autoFocus
            onChange={(e) => setValue(e.target.value)}
          />
        )}
        {warn && <p className="tp-warn">{warn.text}</p>}
        {clearable && blank && <p className="microcopy">{t('common.selection.edit.clear.hint')}</p>}
        <GhostButton onClick={send} disabled={busy || !spec || (!clearable && blank)}>
          {t('common.action.apply.label')}
        </GhostButton>
      </div>
    </FormModal>
  )
}
