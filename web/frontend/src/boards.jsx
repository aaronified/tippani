// Boards (0036) — the shelves /quotes lists, and the top level of that screen
// the way books are the top level of the Library.
//
// WHY THIS FILE EXISTS AT ALL. 1.13.0 shipped the three kinds of quote as a
// segmented control handed to WorkListScaffold's `leading` slot. That slot is a
// FILTER slot: on a phone it renders inside the Filters sheet, so the boards were
// invisible on the device this app is designed for first, and it is gated on
// `hasItems` — the CURRENT board being non-empty — so opening an empty board
// removed the control that got you there, with the choice persisted so a reload
// did not rescue you. A filter narrows what you see within a container; the board
// decides which container you are in. This is that correction.

import { useCallback, useEffect, useState } from 'react'
import { coverImgURL, errText, json, uploadWithProgress } from './api.js'
import { categoryVar } from './theme.js'
import {
  Card,
  ConfirmDialog,
  ErrorText,
  Field,
  FieldIconButton,
  FormModal,
  GhostButton,
  IconDelete,
  IconEdit,
  IconPlus,
  IconQuote,
  IconUpload,
  MonoLabel,
  MoreMenu,
  PageHeader,
  Select,
  Toggle,
  toast,
} from './ui.jsx'

// The six the whole app names in Settings, so a board sits in the same palette
// as a quote's colour rather than inventing a second vocabulary of its own.
const BOARD_COLORS = ['yellow', 'blue', 'pink', 'orange', 'green', 'purple']

// ALL_BOARD is the pinned entry, and it is deliberately NOT a board: it has no
// row, cannot be renamed, hidden or deleted, and its id is a word rather than a
// number so the route reads /quotes/all. A collection has to stay browsable as a
// whole, which is the one thing a two-level screen would otherwise take away.
export const ALL_BOARD = 'all'

// useBoards is the shelf list plus its reload, in one place, because five things
// need it — the list screen, a board's own page, the capture form's board picker,
// the move-on-delete picker and the selection bar's "move to board".
export function useBoards() {
  const [boards, setBoards] = useState(null)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState('')
  const reload = useCallback(async () => {
    const r = await json('GET', '/boards')
    if (!r.ok) return setError(errText(r))
    setBoards(r.data.boards || [])
    setTotal(r.data.total || 0)
    setError('')
  }, [])
  useEffect(() => {
    reload()
  }, [reload])
  return { boards, total, error, reload }
}

// BoardForm — new board, and editing one. Name, colour, description, picture.
//
// The picture is uploaded rather than fetched: no supplier has a photograph of a
// shelf somebody invented, so an empty one is an honest blank rather than a
// failed lookup.
export function BoardForm({ initial, onSubmit, onCancel, submitLabel = 'Save' }) {
  const [name, setName] = useState(initial?.name || '')
  const [description, setDescription] = useState(initial?.description || '')
  const [color, setColor] = useState(initial?.color || 'yellow')
  const [imagePath, setImagePath] = useState(initial?.image_path || '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function pickImage(e) {
    const file = e.target.files?.[0]
    if (!file || !initial?.id) return
    setBusy(true)
    const form = new FormData()
    form.append('file', file)
    const r = await uploadWithProgress(`/boards/${initial.id}/cover`, form)
    setBusy(false)
    if (!r.ok) return setError(errText(r, 'could not upload that'))
    setImagePath(r.data?.image_path || r.data?.path || imagePath)
    toast('picture saved')
  }

  async function submit(e) {
    e.preventDefault()
    if (!name.trim()) return setError('Give the board a name')
    setBusy(true)
    const msg = await onSubmit({ name: name.trim(), description, color, image_path: imagePath })
    setBusy(false)
    if (msg) setError(msg)
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Name" value={name} placeholder="Proverbs" onChange={(e) => setName(e.target.value)} />
      <div>
        <MonoLabel className="mb-1.5 block">colour</MonoLabel>
        <div className="flex flex-wrap items-center gap-2">
          {BOARD_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={c}
              aria-pressed={color === c}
              onClick={() => setColor(c)}
              className={'board-swatch' + (color === c ? ' is-on' : '')}
              style={{ background: categoryVar(c) }}
            />
          ))}
        </div>
      </div>
      {/* A textarea rather than a Field: Field renders an <input>, and a board's
          description is a sentence or two about what it is for. */}
      <label className="tp-field">
        <MonoLabel>What it is for</MonoLabel>
        <textarea
          className="tp-input"
          rows={2}
          value={description}
          placeholder="Handed down, not attributed."
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
      {/* Only once the board exists: the upload posts to /boards/{id}/cover, so
          there has to be an id to post to. A new board gets its picture on the
          next open, which is one tap and needs no second endpoint. */}
      {initial?.id ? (
        <div className="flex items-center gap-3">
          {imagePath ? (
            <img src={coverImgURL(imagePath)} alt="" className="board-form-img" />
          ) : (
            <span className="board-form-img is-empty" aria-hidden="true" />
          )}
          <label className="tp-btn tp-btn-ghost tactile" style={{ cursor: 'pointer' }}>
            <IconUpload />
            <span className="btn-label">Picture</span>
            <input type="file" accept="image/*" className="hidden" onChange={pickImage} disabled={busy} />
          </label>
          {imagePath && (
            <GhostButton type="button" onClick={() => setImagePath('')}>
              Remove
            </GhostButton>
          )}
        </div>
      ) : null}
      <ErrorText>{error}</ErrorText>
      <div className="flex items-center justify-end gap-2">
        <GhostButton type="button" onClick={onCancel}>
          Cancel
        </GhostButton>
        <button type="submit" className="tp-btn tp-btn-primary tactile" disabled={busy}>
          {busy ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  )
}

// DeleteBoardDialog — the rule that lets every board stay ordinary.
//
// A board with quotes on it cannot simply go: it asks where they move to and
// refuses until told. That is what gives the no-orphans guarantee without making
// one board permanent, and the database backs it with ON DELETE RESTRICT, so a
// bug here fails loudly rather than losing somebody's filing.
export function DeleteBoardDialog({ board, boards, onDone, onCancel }) {
  const others = (boards || []).filter((b) => b.id !== board.id)
  const [moveTo, setMoveTo] = useState(others[0]?.id ? String(others[0].id) : '')
  const [error, setError] = useState('')
  const holds = board.quotes > 0

  // The one operation the app cannot offer: nowhere to put them. Said plainly
  // rather than shown as a disabled button with no reason.
  if (holds && others.length === 0) {
    return (
      <ConfirmDialog
        open
        title={`Delete ${board.name}?`}
        confirmLabel="Delete"
        confirmDisabled
        onCancel={onCancel}
        body={
          <p>
            This is your only board and it holds {board.quotes} {board.quotes === 1 ? 'quote' : 'quotes'}. Make another
            board first — the quotes have to go somewhere.
          </p>
        }
      />
    )
  }

  async function run() {
    const body = holds ? { move_to: Number(moveTo) } : {}
    const r = await json('DELETE', `/boards/${board.id}`, body)
    if (!r.ok) return setError(errText(r, 'could not delete that board'))
    toast('board deleted')
    await onDone()
  }

  return (
    <ConfirmDialog
      open
      title={`Delete ${board.name}?`}
      confirmLabel="Delete"
      onConfirm={run}
      onCancel={onCancel}
      body={
        <div className="space-y-3">
          {holds ? (
            <>
              <p>
                {board.quotes} {board.quotes === 1 ? 'quote is' : 'quotes are'} filed here. They move to another board
                rather than being deleted.
              </p>
              <Select
                ariaLabel="Move the quotes to"
                value={moveTo}
                onChange={setMoveTo}
                options={others.map((b) => [String(b.id), b.name])}
              />
            </>
          ) : (
            <p>Nothing is filed here, so nothing is lost.</p>
          )}
          <ErrorText>{error}</ErrorText>
        </div>
      }
    />
  )
}

// BoardTile — one shelf. The count is the point of the tile: it is what tells you
// where anything is without opening it, and it is what makes an empty board
// visibly empty rather than a shelf you find out about by walking to it.
function BoardTile({ board, onOpen, onEdit, onDelete, onToggleHidden }) {
  return (
    <div className={'board-tile' + (board.hidden ? ' is-hidden-board' : '')} style={{ '--board-color': categoryVar(board.color) }}>
      <button type="button" className="board-tile-face" onClick={() => onOpen(board.id)}>
        {board.image_path ? (
          <img src={coverImgURL(board.image_path)} alt="" className="board-tile-img" />
        ) : (
          <span className="board-tile-img is-empty" aria-hidden="true">
            <IconQuote />
          </span>
        )}
        <span className="board-tile-name">{board.name}</span>
        <span className="board-tile-count">
          {board.quotes} {board.quotes === 1 ? 'quote' : 'quotes'}
        </span>
      </button>
      <span className="board-tile-tools">
        <MoreMenu
          items={[
            { icon: <IconEdit />, label: 'Edit', onClick: () => onEdit(board) },
            { label: board.hidden ? 'Show' : 'Hide', onClick: () => onToggleHidden(board) },
            { icon: <IconDelete />, label: 'Delete', danger: true, onClick: () => onDelete(board) },
          ]}
        />
      </span>
    </div>
  )
}

// BoardList — /quotes itself.
//
// Hidden boards are FETCHED and folded rather than filtered away by the server:
// hiding is a view the reader can switch off, and a list that had to be
// re-requested to show them would make the toggle feel like a different screen.
export function BoardList({ boards, total, reload, onOpen }) {
  const [showHidden, setShowHidden] = useState(false)
  const [editing, setEditing] = useState(null) // board | 'new'
  const [deleting, setDeleting] = useState(null)
  const [error, setError] = useState('')

  const visible = (boards || []).filter((b) => showHidden || !b.hidden)
  const hiddenCount = (boards || []).filter((b) => b.hidden).length

  async function save(fields) {
    const isNew = editing === 'new'
    const r = await json(isNew ? 'POST' : 'PUT', isNew ? '/boards' : `/boards/${editing.id}`, fields)
    if (!r.ok) return errText(r, 'could not save that board')
    setEditing(null)
    await reload()
    return null
  }

  async function toggleHidden(b) {
    // Full-state PUT, like every other in this app: the whole board goes back or
    // the fields left out are cleared.
    const r = await json('PUT', `/boards/${b.id}`, {
      name: b.name,
      description: b.description,
      color: b.color,
      image_path: b.image_path,
      hidden: !b.hidden,
    })
    if (!r.ok) return setError(errText(r))
    await reload()
  }

  return (
    <section>
      <PageHeader
        title="Quotes"
        counts={`${(boards || []).length} ${(boards || []).length === 1 ? 'board' : 'boards'}`}
        right={
          <span className="flex items-center gap-2">
            {hiddenCount > 0 && (
            <Toggle
              ariaLabel="Hidden boards"
              value={showHidden ? 'on' : 'off'}
              onChange={(v) => setShowHidden(v === 'on')}
              options={[
                ['off', 'In use'],
                ['on', `All ${(boards || []).length}`],
              ]}
            />
            )}
            <GhostButton icon={<IconPlus />} onClick={() => setEditing('new')}>
              New board
            </GhostButton>
          </span>
        }
      />
      <ErrorText>{error}</ErrorText>

      <div className="board-grid">
        {/* Pinned, and first: a collection has to stay browsable as a whole. It
            is not a board — no menu, nothing to rename — which is why it is
            drawn here rather than folded into the list. */}
        <button type="button" className="board-tile board-tile-all" onClick={() => onOpen(ALL_BOARD)}>
          <span className="board-tile-name">All quotes</span>
          <span className="board-tile-count">
            {total} {total === 1 ? 'quote' : 'quotes'}
          </span>
        </button>
        {visible.map((b) => (
          <BoardTile
            key={b.id}
            board={b}
            onOpen={onOpen}
            onEdit={setEditing}
            onDelete={setDeleting}
            onToggleHidden={toggleHidden}
          />
        ))}
      </div>

      {boards != null && boards.length === 0 && (
        <Card className="mt-4">
          <p className="microcopy">
            No boards yet. The ＋ in the top bar saves a quote and makes the first one, or start a board here and file
            into it.
          </p>
        </Card>
      )}

      {editing && (
        <FormModal open title={editing === 'new' ? 'New board' : 'Edit board'} onClose={() => setEditing(null)}>
          <BoardForm
            initial={editing === 'new' ? null : editing}
            onSubmit={save}
            onCancel={() => setEditing(null)}
            submitLabel={editing === 'new' ? 'Create' : 'Save'}
          />
        </FormModal>
      )}
      {deleting && (
        <DeleteBoardDialog
          board={deleting}
          boards={boards}
          onCancel={() => setDeleting(null)}
          onDone={async () => {
            setDeleting(null)
            await reload()
          }}
        />
      )}
    </section>
  )
}
