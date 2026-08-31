// Anthologies — quotes gathered into a reading order, with the reader's own words
// between them.
//
// WHAT THIS IS NOT. It is not a board and it is not a tag. A board says where a
// standalone quote is FILED and a quote sits on exactly one; a tag says what a
// quote is ABOUT and cuts across everything. An anthology is a THIRD relationship
// and the only one of the three that is a piece of writing: the same line may
// appear in five of them, the order inside one is chosen rather than derived, and
// each entry carries a paragraph of the reader's own prose introducing it. Books,
// film dialogue and standalone quotes go in side by side, because the point is the
// argument being assembled and not which shelf each sentence came off.
//
// THE SCREEN IS TWO LEVELS, exactly like Quotes: /anthologies lists them the way
// /quotes lists boards, and /anthologies/{id} is the one you are reading. It is
// modelled on boards.jsx deliberately — same tile grid, same one-form-for-create-
// and-edit, same delete dialog that says what is actually lost — because a second
// vocabulary for the same shape is how two screens start drifting apart.
//
// THE ONE DOOR IN IS THE SELECTION BAR. Nothing on this screen adds an entry,
// because the server has no route that would: POST /anthologies/{id}/entries takes
// (kind, item_id) pairs the reader has to have picked somewhere the quotes are. So
// composing is a bulk action over a selection — see AddToAnthologyDialog at the
// foot of this file and the `anthology` entry in actions.jsx — and this screen is
// where the gathering is read, ordered and written about.
//
// WHAT THE SERVER OWNS, and this file must not second-guess:
//   - the ORDER. Entries arrive sorted by position and are rendered in the order
//     they arrive, never re-sorted here. A move posts (kind, item_id, after) and
//     the server computes the number, which it may do by renumbering the whole
//     anthology — so a move is followed by a re-read rather than by patching a
//     position locally.
//   - the DEDUPE. Adding a quote already in the anthology is a silent skip, not an
//     error, so the dialog reports `added` and `skipped` from the response instead
//     of assuming every item landed.
//   - the LIMITS below.

import { useCallback, useEffect, useState } from 'react'
import { DEMO, apiURL, errText, json } from './api.js'
import { t, tNodes } from './i18n.js'
import { quoteKindLabel } from './quoteKind.js'
import { categoryVar } from './theme.js'
import { usePractice } from './review.jsx'
import {
  Card,
  ConfirmDialog,
  ErrorText,
  Field,
  FormModal,
  GhostButton,
  IconAnthology,
  IconBack,
  IconChevron,
  IconDelete,
  IconEdit,
  IconExport,
  IconPlus,
  IconQuiz, IconPractise,
  MonoLabel,
  MoreMenu,
  PageHeader,
  Select,
  toast,
  Toggle,
} from './ui.jsx'

// The server's limits, mirrored so a field can stop you at the boundary instead of
// letting you type past it and answering with a 400. THE SERVER IS THE AUTHORITY —
// see anthologyTitleMax / anthologyIntroMax / anthologyNoteMax — and these are
// maxLength attributes only, never a second validation rule.
const TITLE_MAX = 120
const INTRO_MAX = 20000
const NOTE_MAX = 8000

// An entry has no id of its own: (kind, item_id) IS its identity, which is why the
// remove route puts both in the path. One helper so the four places that compare
// entries cannot disagree about what "the same entry" means.
const entryRef = (e) => ({ kind: e.kind, item_id: e.item_id })
const sameEntry = (a, b) => a.kind === b.kind && a.item_id === b.item_id

// ANTHOLOGY_KIND maps a SELECTION's kind to the entry vocabulary. Two vocabularies
// for the same three things, and both are load-bearing: the selection bar speaks
// annotation / dialogue / quote (the tables), the anthology routes speak book /
// screen / utterance (the item_reviews vocabulary). Exported so the bar can ask
// whether a selection is gatherable at all rather than guessing.
export const ANTHOLOGY_KIND = { annotation: 'book', dialogue: 'screen', quote: 'utterance' }

// useAnthologies is the list plus its reload, in one place, because three things
// need it: the list screen, the add-to dialog on the selection bar, and the
// reading view's way back to a fresh count.
//
// `rows` starts null and becomes an array, so the empty state can be gated on
// "loaded AND empty" rather than flashing "nothing here yet" while the request is
// still out.
export function useAnthologies() {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const reload = useCallback(async () => {
    const r = await json('GET', '/anthologies')
    if (!r.ok) return setError(errText(r, t('error.load.anthologies')))
    setRows(r.data.anthologies || [])
    setError('')
  }, [])
  useEffect(() => {
    reload()
  }, [reload])
  return { rows, error, reload }
}

// exportHref is a plain URL rather than a helper call, because this export is the
// one that is a GET: downloadPost in api.js posts a body of ids, and there is no
// body here — the anthology already knows what is in it. A real href also means
// middle-click and "save link as" work on it.
const exportHref = (id) => apiURL(`/anthologies/${id}/export`)

// FIELD_SWITCHES — the six, in reading order rather than in column order, because
// this is a list somebody reads top to bottom.
//
// Each row names the THING and the toggle says whether it is shown, so the label
// never has to be negated: a switch reading "Who said it — off" is legible in a way
// "Hide who said it — on" is not. The `hide` flag is where the stored column is
// inverted, and it is the only place that inversion lives.
//
// The columns are hide_* where the thing is shown today and show_* where it is not
// (0045), so that every default is the zero value. That asymmetry stops here: the
// form deals only in "shown".
const FIELD_SWITCHES = [
  { key: 'hide_credit', hide: true, label: 'anthologies.form.fields.credit.label' },
  { key: 'hide_source', hide: true, label: 'anthologies.form.fields.source.label' },
  { key: 'show_locator', hide: false, label: 'anthologies.form.fields.locator.label' },
  { key: 'show_date', hide: false, label: 'anthologies.form.fields.date.label' },
  { key: 'hide_commentary', hide: true, label: 'anthologies.form.fields.commentary.label' },
  { key: 'hide_colour', hide: true, label: 'anthologies.form.fields.colour.label' },
]

// shown / stored — the two directions of that inversion, named so a reader of this
// file can see there is exactly one of each.
const shown = (row, flags) => (row.hide ? !flags[row.key] : !!flags[row.key])
const stored = (row, isShown) => (row.hide ? !isShown : isShown)

// AnthologyForm — new anthology, and editing one. Title, introduction, and what
// each passage shows. The ENTRIES are not in the PUT (the server's own comment says
// so), so this form cannot accidentally clear them.
//
// UNLIKE A BOARD, A DUPLICATE TITLE IS FINE. Two anthologies called "On grief" are
// two anthologies; the server returns no 409 here, so there is no name-clash
// warning to write.
export function AnthologyForm({ initial, onSubmit, onCancel, submitLabel = t('common.action.save.label') }) {
  const [title, setTitle] = useState(initial?.title || '')
  const [intro, setIntro] = useState(initial?.intro || '')
  // The six as STORED, seeded from the row so an edit opens on what is set. A new
  // anthology starts at all-zero, which is "show everything except the locator and
  // the date" — exactly what an anthology looked like before 0045.
  const [flags, setFlags] = useState(() => {
    const out = {}
    for (const row of FIELD_SWITCHES) out[row.key] = !!initial?.[row.key]
    return out
  })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (!title.trim()) return setError(t('error.validate.anthology-title-required'))
    setBusy(true)
    // EVERY FIELD, ALWAYS. The PUT is full-state — the fifth time this trap has
    // been laid in this app, see boards.jsx — so sending a renamed title without
    // the introduction beside it would silently delete the introduction, and
    // sending it without the six switches would silently reset all six.
    const msg = await onSubmit({ title: title.trim(), intro, ...flags })
    setBusy(false)
    if (msg) setError(msg)
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field
        label={t('common.field.title.label')}
        value={title}
        maxLength={TITLE_MAX}
        placeholder={t('anthologies.form.title.placeholder')}
        onChange={(e) => setTitle(e.target.value)}
      />
      {/* A textarea rather than a Field: Field renders an <input>, and this is the
          paragraph that says what the gathering is for. The blank line between
          paragraphs survives — the server trims the edges only. */}
      <label className="tp-field">
        <MonoLabel>{t('anthologies.form.intro.label')}</MonoLabel>
        <textarea
          className="tp-input"
          rows={5}
          value={intro}
          maxLength={INTRO_MAX}
          placeholder={t('anthologies.form.intro.placeholder')}
          onChange={(e) => setIntro(e.target.value)}
        />
      </label>
      {/* WHAT EACH PASSAGE SHOWS — and therefore what the export writes. On the
          form rather than on a menu behind the reading view, because it is a
          property of the anthology in the same way its title is: you decide what
          kind of document this is when you make it. */}
      <div className="tp-field">
        <MonoLabel>{t('anthologies.form.fields.label')}</MonoLabel>
        <p className="microcopy mt-0.5 mb-2">{t('anthologies.form.fields.hint')}</p>
        {/* The same Hide / Show pair the Features card uses, for the same reason:
            these read POSITIVELY whatever the stored column is spelled, so a reader
            never has to work out what "hide, off" means. */}
        <div className="space-y-2.5">
          {FIELD_SWITCHES.map((row) => (
            <div key={row.key} className="flex items-center justify-between gap-3">
              <MonoLabel>{t(row.label)}</MonoLabel>
              <Toggle
                ariaLabel={t(row.label)}
                value={shown(row, flags) ? 'on' : 'off'}
                onChange={(v) => setFlags((f) => ({ ...f, [row.key]: stored(row, v === 'on') }))}
                options={[['off', t('common.action.hide.label')], ['on', t('common.action.show.label')]]}
              />
            </div>
          ))}
        </div>
      </div>
      <ErrorText>{error}</ErrorText>
      <div className="flex items-center justify-end gap-2">
        <GhostButton type="button" onClick={onCancel}>
          {t('common.action.cancel.label')}
        </GhostButton>
        <button type="submit" className="tp-btn tp-btn-primary tactile" disabled={busy}>
          {busy ? t('common.action.save.busy') : submitLabel}
        </button>
      </div>
    </form>
  )
}

// EntryNoteDialog — the reader's commentary on one entry, which alongside the order
// is the whole point of the feature.
//
// Its own endpoint and its own dialog because saving one paragraph must not resend
// the other twenty-nine. An empty note is a real value: clearing the box is how you
// take the commentary off again.
function EntryNoteDialog({ entry, onSave, onCancel }) {
  const [note, setNote] = useState(entry.note || '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function save() {
    setBusy(true)
    const msg = await onSave(entry, note)
    setBusy(false)
    if (msg) setError(msg)
  }

  return (
    <FormModal open title={t('anthologies.entry.note.title')} onClose={onCancel}>
      <div className="space-y-3">
        <p className="microcopy">{t('anthologies.entry.note.body')}</p>
        <label className="tp-field">
          <MonoLabel>{t('common.field.note.label')}</MonoLabel>
          <textarea
            className="tp-input"
            rows={5}
            value={note}
            maxLength={NOTE_MAX}
            placeholder={t('anthologies.entry.note.placeholder')}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        <ErrorText>{error}</ErrorText>
        <div className="flex items-center justify-end gap-2">
          <GhostButton type="button" onClick={onCancel}>
            {t('common.action.cancel.label')}
          </GhostButton>
          <button type="button" className="tp-btn tp-btn-primary tactile" disabled={busy} onClick={save}>
            {t(busy ? 'common.action.save.busy' : 'common.action.save.label')}
          </button>
        </div>
      </div>
    </FormModal>
  )
}

// DeleteAnthologyDialog — and it says what is actually lost, because this one is
// unusual twice over.
//
// IT DOES NOT GO TO THE BIN. Every other delete in this app answers with a trash id
// and an Undo; this is a hard delete, so the dialog is the only chance to stop. And
// what goes is the reader's OWN WRITING — the introduction and every entry's
// commentary — while the quotes themselves are untouched, because an anthology never
// owned them. Saying both halves is the difference between a confirm somebody can
// answer and a confirm they have to guess at.
export function DeleteAnthologyDialog({ anthology, onDone, onCancel }) {
  const [error, setError] = useState('')

  async function run() {
    const r = await json('DELETE', `/anthologies/${anthology.id}`)
    if (!r.ok) return setError(errText(r, t('error.delete.anthology')))
    toast(t('anthologies.toast.deleted'))
    await onDone()
  }

  return (
    <ConfirmDialog
      open
      title={t('anthologies.delete.confirm.title', { title: anthology.title })}
      confirmLabel={t('common.action.delete.label')}
      onConfirm={run}
      onCancel={onCancel}
      body={
        <div className="space-y-2">
          <p>
            {t('anthologies.delete.confirm.body', {
              count: anthology.entries,
              n: anthology.entries,
              noun: t('unit.entry', { count: anthology.entries }),
            })}
          </p>
          <p className="microcopy">{t('anthologies.delete.confirm.note')}</p>
          <ErrorText>{error}</ErrorText>
        </div>
      }
    />
  )
}

// AnthologyTile — one gathering. The count is the point of the tile, as it is on a
// board: it is what says which of these is a finished piece and which is a title
// somebody wrote down and never filled.
function AnthologyTile({ row, onOpen, onEdit, onDelete }) {
  return (
    <div className="board-tile">
      <button type="button" className="board-tile-face" onClick={() => onOpen(row.id)}>
        <span className="board-tile-name">{row.title}</span>
        <span className="board-tile-count">
          {t('common.count.phrase', { n: row.entries, noun: t('unit.entry', { count: row.entries }) })}
        </span>
        {row.intro && <span className="microcopy anthology-tile-intro">{row.intro}</span>}
      </button>
      <span className="board-tile-tools">
        <MoreMenu
          items={[
            { id: 'edit', icon: <IconEdit />, label: t('common.action.edit.label'), onClick: () => onEdit(row) },
            // Absent rather than dead in the read-only demo, which has no server to
            // stream a file from.
            ...(DEMO
              ? []
              : [
                  {
                    id: 'export',
                    icon: <IconExport />,
                    label: t('common.action.export.label'),
                    onClick: () => {
                      window.location.href = exportHref(row.id)
                    },
                  },
                ]),
            { id: 'delete', icon: <IconDelete />, label: t('common.action.delete.label'), danger: true, onClick: () => onDelete(row) },
          ]}
        />
      </span>
    </div>
  )
}

// AnthologyList — /anthologies itself.
function AnthologyList({ rows, reload, onOpen }) {
  const [editing, setEditing] = useState(null) // row | 'new'
  const [deleting, setDeleting] = useState(null)
  const [error, setError] = useState('')

  // One function for create and edit, switched on `editing`, exactly as the board
  // list does it. It returns an error STRING rather than throwing, because the form
  // renders the message beside its own fields.
  async function save(fields) {
    const isNew = editing === 'new'
    const r = await json(isNew ? 'POST' : 'PUT', isNew ? '/anthologies' : `/anthologies/${editing.id}`, fields)
    if (!r.ok) return errText(r, t('error.save.anthology'))
    setEditing(null)
    await reload()
    return null
  }

  const count = (rows || []).length
  return (
    <section>
      <PageHeader
        title={t('nav.tab.anthologies.label')}
        counts={t('common.count.phrase', { n: count, noun: t('unit.anthology', { count }) })}
        right={
          <GhostButton icon={<IconPlus />} onClick={() => setEditing('new')}>
            {t('anthologies.list.new.label')}
          </GhostButton>
        }
      />
      <ErrorText>{error}</ErrorText>

      <div className="board-grid">
        {(rows || []).map((row) => (
          <AnthologyTile key={row.id} row={row} onOpen={onOpen} onEdit={setEditing} onDelete={setDeleting} />
        ))}
      </div>

      {rows != null && rows.length === 0 && (
        <Card className="mt-4">
          {/* The empty state names the way IN rather than reporting that the list
              is empty. Nothing on this screen can add an entry, so somebody who
              made an anthology here and stopped would be looking for a control
              that is on a different screen by design. */}
          <p className="microcopy">
            {tNodes('anthologies.list.empty', {
              em1: <b key="em1">{t('anthologies.list.new.label')}</b>,
              em2: <b key="em2">{t('common.action.anthology.label')}</b>,
            })}
          </p>
        </Card>
      )}

      {editing && (
        <FormModal
          open
          title={t(editing === 'new' ? 'anthologies.form.new.title' : 'anthologies.form.edit.title')}
          onClose={() => setEditing(null)}
        >
          <AnthologyForm
            initial={editing === 'new' ? null : editing}
            onSubmit={save}
            onCancel={() => setEditing(null)}
            submitLabel={t(editing === 'new' ? 'common.action.create.label' : 'common.action.save.label')}
          />
        </FormModal>
      )}
      {deleting && (
        <DeleteAnthologyDialog
          anthology={deleting}
          onCancel={() => setDeleting(null)}
          onDone={async () => {
            setDeleting(null)
            setError('')
            await reload()
          }}
        />
      )}
    </section>
  )
}

// AnthologyEntry — one passage, as it reads.
//
// The reader's note comes FIRST and the quote second, which is the shape of the
// export and the shape of every anthology ever printed: the editor introduces the
// ---------------------------------------------------------------------------
// locatorOf is the entry's "where", with a standalone quote's KIND on the end of
// it.
//
// The server sends the locator already joined — it is built from whichever kind
// the entry happens to be — and sends the quote's kind separately as a MACHINE
// value, because the word for it belongs to the screen and exists in two
// languages. So the joining of those two happens here, and only here.
//
// A quote with no kind has its old free-text `medium` inside the locator already
// (the server puts it there instead), which is the same fallback quoteKindMeta
// gives the cards: a value the 0053 upgrade could not read stays visible as work
// to do rather than disappearing with the field that held it.
function locatorOf(entry) {
  return [entry.locator, quoteKindLabel(entry.quote_kind)].filter(Boolean).join(' · ')
}
// ---------------------------------------------------------------------------

// piece and then the piece speaks. The attribution sits under it, and where the
// quote has a parent work the credit is a doorway into it — a CONTENT LINK, so it
// is never gated on which sections are switched on.
function AnthologyEntry({ entry, fields = {}, first, last, onNote, onMove, onRemove, onOpenBook, onOpenMovie }) {
  const openWork =
    entry.work_id && entry.kind === 'book'
      ? onOpenBook
      : entry.work_id && entry.kind === 'screen'
        ? onOpenMovie
        : null
  return (
    <Card className="mt-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {!fields.hide_commentary && entry.note && <p className="anthology-prose">{entry.note}</p>}
          {/* THE COLOUR BAR IS A NOTE TO YOURSELF, not to a reader — which is why it
              is one of the six switches. Hidden, the bar takes the neutral rule the
              card would have had anyway rather than disappearing and leaving the
              passage unmarked. */}
          <blockquote
            className="anthology-quote"
            style={{ '--entry-color': fields.hide_colour ? 'var(--line)' : categoryVar(entry.color) }}
          >
            {entry.quote}
          </blockquote>
          {/* THE ATTRIBUTION LINE, and it can now be nothing at all. With the credit
              and the source both switched off there is no line rather than an empty
              one — a reader who turned both off asked for a document of passages, and
              a stray separator would be the feature failing visibly. */}
          {(!fields.hide_credit || !fields.hide_source) && (
            <p className="microcopy mt-1.5">
              {/* One key holds the whole line, separator and all, so another language
                  can put the source first or punctuate it differently. The two
                  single-value keys are what a half-hidden line uses, so the
                  separator never appears with nothing on one side of it. */}
              {fields.hide_source
                ? t('anthologies.entry.credit.label', { credit: entry.credit || t('anthologies.entry.unattributed.label') })
                : fields.hide_credit
                  ? tNodes('anthologies.entry.source.label', {
                    source: openWork ? (
                      <button key="source" type="button" className="tp-link" onClick={() => openWork(entry.work_id)}>
                        {entry.source}
                      </button>
                    ) : (
                      entry.source
                    ),
                  })
                  : tNodes(entry.source ? 'anthologies.entry.credit-source.label' : 'anthologies.entry.credit.label', {
                    credit: entry.credit || t('anthologies.entry.unattributed.label'),
                    source: openWork ? (
                      <button key="source" type="button" className="tp-link" onClick={() => openWork(entry.work_id)}>
                        {entry.source}
                      </button>
                    ) : (
                      entry.source
                    ),
                  })}
            </p>
          )}
          {/* Off by default, both of them: an anthology that has never been
              configured reads exactly as it did before these switches existed. */}
          {(fields.show_locator && locatorOf(entry)) || (fields.show_date && entry.date) ? (
            <p className="microcopy mt-1 opacity-80">
              {[fields.show_locator ? locatorOf(entry) : '', fields.show_date ? entry.date : '']
                .filter(Boolean)
                .join(' · ')}
            </p>
          ) : null}
          {/* The QUOTE's own note, which is a different thing from the entry's and
              can be non-empty at the same time: one is what the reader wrote when
              they saved the line, the other is what they wrote when they placed it
              here. Shown quietly, under the credit, so the two never read as one
              paragraph. */}
          {entry.quote_note && <p className="microcopy mt-1 opacity-80">{entry.quote_note}</p>}
        </div>
        <MoreMenu
          ariaLabel={t('anthologies.entry.more.aria')}
          items={[
            {
              id: 'note',
              icon: <IconEdit />,
              label: t(entry.note ? 'anthologies.entry.note.edit.label' : 'anthologies.entry.note.add.label'),
              onClick: () => onNote(entry),
            },
            // MOVE UP / MOVE DOWN, AND NO DRAG. The order is the feature, so it has
            // to be changeable — but a drag has no keyboard equivalent and a menu
            // item is reachable by tab, by arrow key and by a thumb. The item at an
            // end is OMITTED rather than greyed: a disabled row in a menu is a thing
            // to wonder about.
            ...(first ? [] : [{ id: 'up', icon: <IconChevron open />, label: t('common.action.move-up.label'), onClick: () => onMove(entry, 'up') }]),
            ...(last ? [] : [{ id: 'down', icon: <IconChevron />, label: t('common.action.move-down.label'), onClick: () => onMove(entry, 'down') }]),
            { id: 'remove', icon: <IconDelete />, label: t('common.action.remove.label'), danger: true, onClick: () => onRemove(entry) },
          ]}
        />
      </div>
    </Card>
  )
}

// AnthologyPage — /anthologies/{id}, the thing being read.
function AnthologyPage({ id, onClose, onDeleted, onOpenBook, onOpenMovie }) {
  const [anthology, setAnthology] = useState(null)
  const [entries, setEntries] = useState(null)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [noting, setNoting] = useState(null)
  // A THEMED ROUND OVER THIS ANTHOLOGY. The engine has taken ?anthology= since
  // 0043 — it narrows the deck by a join on anthology_entries and excludes no
  // kind, so a mixed anthology practises as one deck — and for two releases there
  // was no way to ask for it: themeQuery never put the parameter in the URL and no
  // screen had the button. A feature the reader cannot reach is not shipped.
  const { practise, practiceDialog } = usePractice()

  const reload = useCallback(async () => {
    const r = await json('GET', `/anthologies/${id}`)
    if (!r.ok) return setError(errText(r, t('error.open.anthology')))
    setAnthology(r.data.anthology || null)
    // AS THE SERVER SENT THEM. The order is the anthology, it is computed from
    // stored positions, and re-sorting here would be this screen having a second
    // opinion about it.
    setEntries(r.data.entries || [])
    setError('')
  }, [id])
  useEffect(() => {
    reload()
  }, [reload])

  async function save(fields) {
    const r = await json('PUT', `/anthologies/${id}`, fields)
    if (!r.ok) return errText(r, t('error.save.anthology'))
    setEditing(false)
    await reload()
    return null
  }

  async function saveNote(entry, note) {
    const r = await json('PUT', `/anthologies/${id}/entries`, { ...entryRef(entry), note })
    if (!r.ok) return errText(r, t('error.save.note'))
    setNoting(null)
    await reload()
    return null
  }

  async function remove(entry) {
    const r = await json('DELETE', `/anthologies/${id}/entries/${entry.kind}/${entry.item_id}`)
    if (!r.ok) return setError(errText(r, t('error.remove.entry')))
    toast(t('anthologies.toast.entry-removed'))
    await reload()
  }

  // `after` is the entry the moved one should FOLLOW, and null means first. THE
  // SERVER COMPUTES THE POSITION — a client that sent one would be inventing a
  // number the server may renumber out from under it — so this sends neighbours and
  // re-reads the whole list afterwards.
  async function move(entry, dir) {
    const rows = entries || []
    const i = rows.findIndex((e) => sameEntry(e, entry))
    if (i < 0) return
    const after = dir === 'up' ? rows[i - 2] || null : rows[i + 1]
    if (dir === 'up' && i === 0) return
    if (dir === 'down' && !after) return
    const r = await json('POST', `/anthologies/${id}/order`, {
      ...entryRef(entry),
      after: after ? entryRef(after) : null,
    })
    if (!r.ok) return setError(errText(r, t('error.move.entry')))
    await reload()
  }

  const rows = entries || []
  return (
    <section className="anthology-read">
      {/* The way back, drawn unconditionally. A detail view takes the phone's top
          bar away, so this is the only way back on a phone and it cannot be a
          desktop-only nicety. */}
      <div className="mb-3">
        <GhostButton icon={<IconBack />} onClick={onClose}>
          {t('anthologies.read.back.label')}
        </GhostButton>
      </div>
      <PageHeader
        title={anthology?.title || t('anthologies.read.title.fallback')}
        counts={entries ? t('common.count.phrase', { n: rows.length, noun: t('unit.entry', { count: rows.length }) }) : ''}
        right={
          <span className="flex items-center gap-2">
            {/* Before Edit, because reading it back is what you do with an
                anthology and editing it is what you do to one. Disabled while it
                is empty: a round over nothing is the one case the dialog can only
                answer with "nothing here". */}
            <GhostButton
              icon={<IconPractise />}
              onClick={() => practise({ anthology: id, label: anthology?.title || t('anthologies.read.title.fallback') })}
              disabled={!anthology || rows.length === 0}
            >
              {t('common.action.practise.label')}
            </GhostButton>
            <GhostButton icon={<IconEdit />} onClick={() => setEditing(true)} disabled={!anthology}>
              {t('common.action.edit.label')}
            </GhostButton>
            {!DEMO && (
              <GhostButton
                icon={<IconExport />}
                onClick={() => {
                  window.location.href = exportHref(id)
                }}
              >
                {t('common.action.export.label')}
              </GhostButton>
            )}
            <GhostButton icon={<IconDelete />} onClick={() => setDeleting(true)} disabled={!anthology}>
              {t('common.action.delete.label')}
            </GhostButton>
          </span>
        }
      />
      <ErrorText>{error}</ErrorText>

      {anthology?.intro && (
        <Card className="mt-2">
          <p className="anthology-prose">{anthology.intro}</p>
        </Card>
      )}

      {rows.map((entry, i) => (
        <AnthologyEntry
          key={`${entry.kind}:${entry.item_id}`}
          entry={entry}
          fields={anthology || {}}
          first={i === 0}
          last={i === rows.length - 1}
          onNote={setNoting}
          onMove={move}
          onRemove={remove}
          onOpenBook={onOpenBook}
          onOpenMovie={onOpenMovie}
        />
      ))}

      {entries != null && rows.length === 0 && (
        <Card className="mt-3">
          <p className="microcopy">
            {tNodes('anthologies.read.empty', {
              em1: <b key="em1">{t('common.action.anthology.label')}</b>,
            })}
          </p>
        </Card>
      )}

      {editing && anthology && (
        <FormModal open title={t('anthologies.form.edit.title')} onClose={() => setEditing(false)}>
          <AnthologyForm
            initial={anthology}
            onSubmit={save}
            onCancel={() => setEditing(false)}
            submitLabel={t('common.action.save.label')}
          />
        </FormModal>
      )}
      {noting && <EntryNoteDialog entry={noting} onSave={saveNote} onCancel={() => setNoting(null)} />}
      {/* The round belongs to this page and unmounts with it — usePractice is a
          hook rather than a global for exactly that reason: a round left running
          behind a screen the reader navigated away from would keep posting grades
          against a schedule they thought they had stopped touching. */}
      {practiceDialog}
      {deleting && anthology && (
        <DeleteAnthologyDialog
          anthology={anthology}
          onCancel={() => setDeleting(false)}
          onDone={async () => {
            setDeleting(false)
            // The thing this page was is gone, so the page cannot stay: hand the
            // reader back to the list rather than leaving them on a 404.
            await onDeleted()
          }}
        />
      )}
    </section>
  )
}

// AddToAnthologyDialog — the door, and it lives on the selection bar rather than
// here for the reason the header gives: only a screen holding quotes can name the
// (kind, item_id) pairs the add route wants.
//
// It reports `added` and `skipped` separately because a duplicate is a SKIP on the
// server, not an error. "3 added" over a selection of five where two were already
// there is the truth; "5 added" is what a client that assumed would have said.
export function AddToAnthologyDialog({ count, busy, onApply, onClose }) {
  const { rows, error } = useAnthologies()
  const list = rows || []
  const [pick, setPick] = useState('')
  const target = pick === '' ? null : Number(pick)
  return (
    <FormModal
      open
      onClose={onClose}
      title={t('common.anthology.add.title', { count, n: count })}
    >
      <div className="space-y-3">
        <p className="microcopy">{t('common.anthology.add.body', { count, n: count })}</p>
        {rows != null && list.length === 0 ? (
          // The switch is named as well as the screen, because this dialog is reachable
          // with the section turned OFF — the bulk action is an action, not a door, so it
          // stays — and naming only a screen the reader may have no tab for is a dead end.
          <ErrorText>{t('common.anthology.add.empty')}</ErrorText>
        ) : (
          <Select
            label={t('common.field.anthology.label')}
            value={pick}
            onChange={setPick}
            options={list.map((a) => [String(a.id), a.title])}
            placeholder={t('common.anthology.add.select.placeholder')}
          />
        )}
        <ErrorText>{error}</ErrorText>
        <GhostButton icon={<IconAnthology />} onClick={() => onApply(target)} disabled={busy || target == null}>
          {t('common.action.add.label')}
        </GhostButton>
      </div>
    </FormModal>
  )
}

// AnthologiesPage — the two levels, switched on the id in the URL. The detail view
// is keyed by id so opening a second anthology remounts rather than showing the
// first one's entries under the second one's title.
export default function AnthologiesPage({ openId = null, onOpen, onClose, onOpenBook, onOpenMovie }) {
  const { rows, error, reload } = useAnthologies()
  if (openId == null) {
    return (
      <>
        <ErrorText>{error}</ErrorText>
        <AnthologyList rows={rows} reload={reload} onOpen={onOpen} />
      </>
    )
  }
  return (
    <AnthologyPage
      key={String(openId)}
      id={openId}
      onClose={onClose}
      onDeleted={async () => {
        await reload()
        onClose?.()
      }}
      onOpenBook={onOpenBook}
      onOpenMovie={onOpenMovie}
    />
  )
}
