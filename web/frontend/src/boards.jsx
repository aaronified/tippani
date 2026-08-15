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
  IconEye,
  IconEyeOff,
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

// BOARD_STARTERS (0037) — the three 1.14.0 seeded, offered where somebody has
// already said they want a new shelf.
//
// WHY THIS EXISTS. 0036 seeds boards from quotes the reader ALREADY had, which is
// right — nobody should open the app to three empty shelves they never asked for
// — but it left a reader with no standalone quotes unable to reach Proverbs or
// Speeches at all, ever. That was reported as "I still cannot access the seeded
// boards". The offer was simply never built.
//
// IT IS A FORM FILLER, NOT A CREATE BUTTON. Pressing one writes a name, a colour
// and a kind into the fields and stops there, so the name is still yours to change
// before you press Create — which matters because a second board called Proverbs
// is refused with a 409, and being handed an editable field beats being handed an
// error. That is also why these stay on offer rather than disappearing once
// "added": the app cannot tell a Proverbs board you renamed to Grandmother from
// one you never made, and the name box is the honest guard either way.
const BOARD_STARTERS = [
  {
    key: 'proverbs',
    name: 'Proverbs',
    color: 'green',
    kind: 'proverb',
    description: 'Handed down, not attributed.',
  },
  { key: 'speeches', name: 'Speeches', color: 'blue', kind: 'plain', description: 'Said aloud, to a room.' },
  { key: 'others', name: 'Others', color: 'yellow', kind: 'plain', description: 'Everything else worth keeping.' },
]

// The languages the starter proverbs come in, offered as a head start on the
// picker. NOT a closed list: the field beside them takes any language, because a
// reader's proverbs are not limited to the three this app happens to ship.
const STARTER_LANGUAGES = ['Bengali', 'Hindi', 'English']

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

// MoveToBoardDialog — "which board do these go on?", for one quote or for forty.
//
// WHY IT FETCHES ITS OWN BOARDS. The same reason SealDialog fetches its own
// stickers: the selection bar is on the Library and the Catalogue too, and
// mounting this inside it would fetch every reader's board list on screens that
// have no boards at all. It opens, it asks, it is gone.
//
// IT IS THE ONE DIALOG BOTH SURFACES USE. A card's ⋯ and the selection bar post
// to the same endpoint with one id or with forty — /quotes/bulk does not care —
// so giving them separate pickers would be two lists of the same boards drifting
// apart, which is the failure actions.jsx exists to prevent.
//
// No "no board" option. Every quote is filed on exactly one board; the way to
// have fewer boards is to delete one, and its quotes move to the default.
export function MoveToBoardDialog({ count, busy, currentBoardID = null, onApply, onClose }) {
  const { boards } = useBoards()
  const list = boards || []
  // Preselect nothing when the selection spans boards (or is on none we know) —
  // a picker that opens already reading "Speeches" over a mixed selection is
  // reporting a fact that is not true.
  const [pick, setPick] = useState(currentBoardID == null ? '' : String(currentBoardID))
  const target = pick === '' ? null : Number(pick)
  return (
    <FormModal open onClose={onClose} title={count === 1 ? 'Move this quote' : `Move ${count} quotes`}>
      <div className="space-y-3">
        <p className="microcopy">
          {count === 1
            ? 'Which board it is filed on. Nothing else about the quote changes.'
            : `All ${count} move to one board. Nothing else about them changes.`}
        </p>
        {list.length === 0 ? (
          <ErrorText>There is nowhere to move them — make a board first.</ErrorText>
        ) : (
          <Select
            label="Board"
            value={pick}
            onChange={setPick}
            options={list.map((b) => [String(b.id), b.name])}
            placeholder="choose a board"
          />
        )}
        <GhostButton
          onClick={() => onApply(target)}
          // Moving them to the board they are already on is a request that changes
          // nothing and still writes updated_at across the selection.
          disabled={busy || target == null || target === currentBoardID}
        >
          Move
        </GhostButton>
      </div>
    </FormModal>
  )
}

// BoardForm — new board, and editing one. Name, colour, description, picture.
//
// The picture is uploaded rather than fetched: no supplier has a photograph of a
// shelf somebody invented, so an empty one is an honest blank rather than a
// failed lookup.
export function BoardForm({ initial, onSubmit, onCancel, submitLabel = 'Save', existingNames = [] }) {
  const [name, setName] = useState(initial?.name || '')
  const [description, setDescription] = useState(initial?.description || '')
  const [color, setColor] = useState(initial?.color || 'yellow')
  const [imagePath, setImagePath] = useState(initial?.image_path || '')
  const [kind, setKind] = useState(initial?.kind || 'plain')
  const [languages, setLanguages] = useState(initial?.languages || [])
  const [newLanguage, setNewLanguage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // Checked here as well as by the server's 409, because the two answer different
  // questions. The server's is the one that is CORRECT — it sees every board,
  // including any made in another tab a moment ago — and this one is the one that
  // is KIND, since being told before pressing Create beats being told after.
  const taken = new Set(existingNames.map((n) => n.trim().toLowerCase()))
  const clash = name.trim() !== '' && name.trim().toLowerCase() !== (initial?.name || '').toLowerCase()
    && taken.has(name.trim().toLowerCase())

  function useStarter(s) {
    setName(s.name)
    setColor(s.color)
    setKind(s.kind)
    // Only if the box is still empty: a starter fills a form in, and overwriting
    // a sentence somebody has already typed is not filling in.
    setDescription((d) => (d.trim() ? d : s.description))
  }

  function toggleLanguage(l) {
    setLanguages((ls) => (ls.some((x) => x.toLowerCase() === l.toLowerCase())
      ? ls.filter((x) => x.toLowerCase() !== l.toLowerCase())
      : [...ls, l]))
  }

  function addLanguage() {
    const l = newLanguage.trim()
    if (!l) return
    if (!languages.some((x) => x.toLowerCase() === l.toLowerCase())) setLanguages([...languages, l])
    setNewLanguage('')
  }

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
    const msg = await onSubmit({
      name: name.trim(),
      description,
      color,
      image_path: imagePath,
      kind,
      // Sent on every board rather than only on a proverb one, so the field is
      // never absent from a full-state PUT. The server drops the list from a
      // plain board itself.
      languages,
    })
    setBusy(false)
    if (msg) setError(msg)
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {/* Offered on a NEW board only. On an edit the board already is something,
          and a row of chips that would silently rewrite its name and colour is a
          trap rather than a shortcut. */}
      {!initial?.id && (
        <div>
          <MonoLabel className="mb-1.5 block">start from</MonoLabel>
          <div className="flex flex-wrap items-center gap-2">
            {BOARD_STARTERS.map((s) => (
              <GhostButton key={s.key} type="button" onClick={() => useStarter(s)}>
                {s.name}
                {taken.has(s.name.toLowerCase()) ? ' ✓' : ''}
              </GhostButton>
            ))}
          </div>
          <p className="microcopy mt-1.5">Fills the form in. Change any of it before you create.</p>
        </div>
      )}
      <Field label="Name" value={name} placeholder="Proverbs" onChange={(e) => setName(e.target.value)} />
      {clash && <p className="microcopy">You already have a board called that.</p>}
      {/* WHAT THE BOARD HOLDS, which is not the same question as what it is
          called. A proverb board puts the language and the English translation
          first on the quote form; on a board of speeches those two are noise.
          Rename a proverb board to anything at all and it stays one. */}
      <div>
        <MonoLabel className="mb-1.5 block">what it holds</MonoLabel>
        <Toggle
          ariaLabel="What it holds"
          value={kind}
          onChange={setKind}
          options={[
            ['plain', 'Quotes'],
            ['proverb', 'Proverbs'],
          ]}
        />
      </div>
      {kind === 'proverb' && (
        <div>
          <MonoLabel className="mb-1.5 block">languages</MonoLabel>
          <div className="flex flex-wrap items-center gap-2">
            {[...new Set([...STARTER_LANGUAGES, ...languages])].map((l) => {
              const on = languages.some((x) => x.toLowerCase() === l.toLowerCase())
              return (
                <button
                  key={l}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleLanguage(l)}
                  className={'tp-filter-chip tactile' + (on ? ' active' : '')}
                >
                  {l}
                </button>
              )
            })}
          </div>
          <div className="flex items-end gap-2 mt-2">
            <Field
              label="Another language"
              value={newLanguage}
              placeholder="Tamil, Yoruba…"
              onChange={(e) => setNewLanguage(e.target.value)}
              onKeyDown={(e) => {
                // Enter adds the language rather than submitting the form, which
                // is what a lone text input inside a <form> would otherwise do —
                // creating the board on the keystroke meant to fill a field in.
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addLanguage()
                }
              }}
            />
            <GhostButton type="button" onClick={addLanguage}>
              Add
            </GhostButton>
          </div>
          <p className="microcopy mt-1.5">Offered on the quote form, and what the language sections group by.</p>
        </div>
      )}
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
            // The glyph shows the ACTION, not the state: this is a menu item,
            // where the words say what pressing it does. Settings' twin is a
            // toggle showing where a category currently stands, so its eye is the
            // other way round — different widget, different rule.
            {
              icon: board.hidden ? <IconEye /> : <IconEyeOff />,
              label: board.hidden ? 'Show' : 'Hide',
              onClick: () => onToggleHidden(board),
            },
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
    //
    // KIND AND LANGUAGES ARE HERE FOR THAT REASON and for no other. This is the
    // fourth time the same trap has been laid — 0034's translator, 0035's
    // category, 0036's board_id, and now these — and it is always a writer that
    // was correct on the day it was written and became lossy when a column was
    // added beside it. Hiding a proverb board would quietly make it a plain one.
    const r = await json('PUT', `/boards/${b.id}`, {
      name: b.name,
      description: b.description,
      color: b.color,
      image_path: b.image_path,
      hidden: !b.hidden,
      kind: b.kind,
      languages: b.languages,
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
          {/* The screen a reader with no standalone quotes actually lands on,
              and until 1.14.2 it named neither Proverbs nor Speeches — so the
              three boards the rest of the app talks about were unreachable from
              the one place somebody would look for them. */}
          <p className="microcopy">
            No boards yet. <b>New board</b> offers the three to start from — Proverbs, Speeches and Others — and takes
            any name you like instead. The ＋ in the top bar saves a quote and makes the first one for you.
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
            existingNames={(boards || []).map((b) => b.name)}
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
