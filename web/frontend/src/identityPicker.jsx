// ONE SHEET FOR EVERY FIELD AN IDENTITY SCREEN CAN CHANGE — the pack's `openPicker`.
//
// WHAT IT REPLACES, and why that was a defect rather than a variation. The three
// identity sheets — a person's global record, a character's global record, and a
// character's casting in ONE work — each carried a block of plain inputs with a
// single "Save" button under it. On the local sheet the block sat inside a
// `<details className="cs-local-fields">`, and that class matches nothing in the
// stylesheet: it drew as the browser's own disclosure triangle in the middle of a
// designed panel.
//
// Two rules say no to that, and they agree.
//
//   THE PACK. `docs/design/prototypes/character-popup.dc.html` has no such block.
//   Every editable thing on those screens is a ROW that states its value, and
//   pressing the row opens `openPicker` — one sheet in several modes, because (its
//   own words) both "answer one question about one credit, and two dialogs for
//   that would drift apart".
//
//   THE STANDING PAIR (CLAUDE.md). "Every editable field and every form wears the
//   pair", and the tick takes the accent fill and a count badge "the moment the
//   substance differs from what is stored". A `GhostButton` reading "Save" is
//   neither half of that pair: it cannot go red, it carries no count, and the
//   panel's own ✓ — which `PanelHost` draws from whatever its content registers —
//   stayed absent on all three sheets, because nothing registered.
//
// THE ROWS BECOME DOORS AND THE DOORS OPEN THIS. Routing through `FormModal` is
// the whole point: it already draws the pair, already counts, already asks before
// discarding, and already turns its ✕ red. Drawing a second one here would be the
// same divergence in a new place.
//
// WHY ONE COMPONENT AND NOT ONE PER FIELD. Nine rows across three sheets ask the
// same question in the same shape — here is a value, type a different one — and
// two of them ask for two values at once (a performer and the language that makes
// the credit a dub). A `fields` array covers both without a mode enum, and a
// tenth row costs a line at the call site rather than a component.
import { useMemo, useState } from 'react'

import { t } from './i18n.js'
import { personImgURL, usePeople } from './credits.jsx'
import { Silhouette } from './silhouette.jsx'
import { Face } from './characterRows.jsx'
import { FormModal, MonoLabel, NameScroll, useFormHost } from './ui.jsx'

const STACK = { display: 'grid', gap: 'var(--row)' }

// The picker's own input, rather than identity.jsx's `Field`: this one needs no
// `inputId` (nothing focuses into it — the sheet IS the focus) and it has to be
// able to draw a textarea for a note.
function PickerField({ label, value, rows, placeholder, onChange, autoFocus }) {
  return (
    <label className="tp-field">
      <MonoLabel>{label}</MonoLabel>
      {rows > 0 ? (
        <textarea
          className="tp-input"
          rows={rows}
          value={value}
          placeholder={placeholder || undefined}
          autoFocus={autoFocus}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          className="tp-input"
          value={value}
          placeholder={placeholder || undefined}
          autoFocus={autoFocus}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  )
}

// ---- the person mode ---------------------------------------------------------
//
// "EVERYONE THE APP ALREADY KNOWS", which is the pack's own caption for this list
// and the reason it is not a text box. `character-popup.dc.html` draws a
// search-or-type field over a list of people with their faces on it, and its
// fixture is chosen to make the point: "Two have photographs and four do not,
// which is the normal state of a library — the picker has to look right with a
// row of silhouettes."
//
// WHAT A PLAIN BOX COSTS, and it is not tidiness. Typing "Humphrey Bogart" a
// second time, one letter different, makes a SECOND person: `ResolvePerson` folds
// on the name, so "H. Bogart" and "Humphrey Bogart" are two records, two portrait
// fetches and two pages, and the reader finds out when a face they filled in is
// missing from a credit they were sure they had filled in. Offering the list is
// what makes the common answer — somebody already in the library — a press
// instead of a spelling test.
//
// A NAME THE APP DOES NOT KNOW IS A NORMAL ANSWER, in the pack's words, "not an
// error state — most casts arrive one unknown person at a time". So the typed
// name stays live under the list as its own row rather than being refused.
const fold = (x) => String(x || '').trim().toLowerCase()

function PersonRow({ person, name, meta, onPick }) {
  const src = person?.image_path ? personImgURL(person.image_path) : ''
  return (
    <button type="button" className="cs-pick-row tactile" onClick={onPick}>
      <span className="cs-pick-face">
        {src
          ? <img src={src} alt="" loading="lazy" />
          : <Silhouette name={name} />}
      </span>
      <span className="cs-pick-label">
        <span className="cs-pick-name">{name}</span>
        {meta ? <span className="cs-pick-meta">{meta}</span> : null}
      </span>
    </button>
  )
}

// PersonPickerBody — the child, for the reason every form in this file is one.
function PersonPickerBody({ spec, draft, onDraft, blocked, onSubmit }) {
  const host = useFormHost(blocked)
  const { map } = usePeople(spec.personKind || 'actor')
  const typed = draft.actor ?? ''
  const q = fold(typed)
  // A SUBSTRING MATCH, NOT A PREFIX, which is the rule `CastCombo` already
  // follows in this app: "quinn" finds "Harley Quinn", the half of a name people
  // actually remember. Capped, because a list of four hundred is not a list.
  const hits = useMemo(() => {
    const all = Object.values(map || {})
    return all
      .filter((p) => !q || fold(p.name).includes(q))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 8)
  }, [map, q])
  // Exactly what it says: no row here IS this name. The pack's `pickerCanAdd`.
  const isNew = !!q && !Object.values(map || {}).some((p) => fold(p.name) === q)
  return (
    <form
      id={host?.formId}
      style={STACK}
      onSubmit={(e) => { e.preventDefault(); if (!blocked) onSubmit() }}
    >
      {spec.hint ? <p className="microcopy" style={{ color: 'var(--soft)' }}>{spec.hint}</p> : null}
      <PickerField
        label={spec.personLabel || t('identity.picker.person.label')}
        value={typed}
        placeholder={t('identity.picker.person.placeholder')}
        autoFocus
        onChange={(v) => onDraft({ ...draft, actor: v })}
      />
      {hits.length ? (
        <div className="cs-pick-list">
          {hits.map((p) => (
            <PersonRow
              key={p.id}
              person={p}
              name={p.name}
              meta={(p.kinds || []).join(' · ')}
              onPick={() => onDraft({ ...draft, actor: p.name })}
            />
          ))}
        </div>
      ) : null}
      {isNew ? (
        <p className="microcopy" style={{ color: 'var(--faint)' }}>
          {t('identity.picker.person.new', { name: typed.trim() })}
        </p>
      ) : null}
      {/* THE LANGUAGE IS WHAT MAKES IT A DUB, so it rides on the same sheet the
          pack puts it on rather than being a second dialog: `credit_lang` is the
          only thing `creditsFor` splits on. The chips are a shortcut and not a
          closed set — the box under them takes anything, because a library is
          not limited to five languages and a picker that pretends otherwise is
          worse than no picker. */}
      {spec.langs ? (
        <>
          <MonoLabel>{t('identity.credit.add.dub.lang.label')}</MonoLabel>
          <div className="cs-pills">
            {spec.langs.map((l) => (
              <button
                key={l}
                type="button"
                className={'tp-chip tp-chip-btn' + (fold(draft.lang) === fold(l) ? ' active' : '')}
                aria-pressed={fold(draft.lang) === fold(l)}
                onClick={() => onDraft({ ...draft, lang: fold(draft.lang) === fold(l) ? '' : l })}
              >
                {l}
              </button>
            ))}
          </div>
          <PickerField
            label={t('identity.picker.lang.other')}
            value={draft.lang ?? ''}
            onChange={(v) => onDraft({ ...draft, lang: v })}
          />
        </>
      ) : null}
    </form>
  )
}

// THE FORM IS A CHILD OF THE MODAL, and it has to be — the same trap
// `ProviderLinkForm` carries a paragraph about, and the one CLAUDE.md lists under
// Gotchas. `useFormHost` reads the context `FormModal` puts around its CHILDREN,
// so calling it in the component that RENDERS the modal joins whatever surface is
// further out, and a modal with nothing registered draws no ✓ at all.
function PickerForm({ spec, draft, onDraft, blocked, onSubmit }) {
  const host = useFormHost(blocked)
  return (
    <form
      id={host?.formId}
      style={STACK}
      onSubmit={(e) => {
        e.preventDefault()
        if (!blocked) onSubmit()
      }}
    >
      {spec.hint ? (
        <p className="microcopy" style={{ color: 'var(--soft)' }}>{spec.hint}</p>
      ) : null}
      {spec.fields.map((f, i) => (
        <PickerField
          key={f.key}
          label={f.label}
          value={draft[f.key] ?? ''}
          rows={f.rows || 0}
          placeholder={f.placeholder}
          autoFocus={i === 0}
          onChange={(v) => onDraft({ ...draft, [f.key]: v })}
        />
      ))}
    </form>
  )
}

// FieldPicker — hand it a spec, get the pack's sheet with the app's pair on it.
//
// MOUNT IT KEYED ON THE SPEC (`key={picker.id}`) rather than seeding the draft in
// an effect. An effect runs after the first paint, so for one frame the draft is
// empty, every field reads as changed, and the tick flashes armed with a count of
// everything — a control that looks armed when nothing has changed is precisely
// what the standing rule exists to stop. A new spec is a new instance, and the
// initialiser below is then simply correct.
// ---- the choose mode ---------------------------------------------------------
//
// A LIST OF THINGS THE PRESS COULD MEAN, and the reader says which.
//
// THE PACK'S FOURTH MODE, and the one that was not built. It uses it for two
// jobs, and both are the same shape: a question with more than one right answer,
// asked instead of guessed.
//
//   A TILE THAT IS AMBIGUOUS. "A WORK CAN HOLD MORE THAN ONE OF HIS ROLES, so a
//   tile on a performer's strip cannot assume what you meant by tapping it: two
//   characters in one film, or the film itself. When there is a choice, it asks;
//   when there is only one thing behind the tile, it just opens it."
//   (`character-popup.dc.html:754-758`.) Guessing here is not a small error — it
//   opens the wrong record and the reader edits it.
//
//   AND A REACH THE READER CANNOT SEE. "'Delete' here would reach into three works
//   at once and quietly strip a name off each — the one edit on this screen whose
//   damage you could not see before it happened. So the verb states the reach and
//   then hands back the list: each work is unlinked by its own tap… Slower on
//   purpose, and the slowness is the safety." (line 957.)
//
// NOT A FORM, WHICH IS WHY IT IS NOT `FieldPicker`. Nothing is typed and nothing
// is committed: every row IS its own commit, so there is no draft to hold, no
// count to arm a tick with, and no ✓ at all. Drawing one would be a control with
// nothing to confirm — the defect this file has spent the session removing.
//
// THE SHEET STAYS OPEN AFTER A ROW THAT DOES NOT LEAVE, because the removal case
// is a list you work through: unlink one work, the row goes, three become two.
// `stay` is the option's own answer to that; a door closes, a removal does not.
export function ChoosePicker({ spec, busy = false, onClose }) {
  const options = spec.options || []
  return (
    <FormModal open onClose={onClose} title={spec.title} maxWidth={460}>
      <div style={{ display: 'grid', gap: 8 }}>
        {spec.hint ? <p className="microcopy">{spec.hint}</p> : null}
        {options.map((o, i) => (
          <button
            key={o.key || `${o.label}-${i}`}
            type="button"
            className={'cs-choose tactile' + (o.danger ? ' is-danger' : '')}
            disabled={busy || !o.onPick}
            // A ROW WITH NOTHING BEHIND IT SAYS SO. The pack's own list carries
            // one — "Delete the identity · Available once no work is linked" —
            // and a row that presses and does nothing is the thing `make
            // controls` exists to find.
            aria-disabled={o.onPick ? undefined : 'true'}
            title={o.title || undefined}
            onClick={() => {
              if (!o.onPick) return
              o.onPick()
              if (!o.stay) onClose()
            }}
          >
            {o.face !== undefined ? <Face src={o.face} name={o.label} className="cs-choose-face" /> : null}
            {o.icon ? <span className="cs-choose-icon">{o.icon}</span> : null}
            <span className="cs-choose-body">
              <NameScroll className="cs-choose-label">{o.label}</NameScroll>
              {o.sub ? <span className="cs-choose-sub">{o.sub}</span> : null}
            </span>
            {o.meta ? <span className="cs-choose-meta">{o.meta}</span> : null}
          </button>
        ))}
      </div>
    </FormModal>
  )
}

export function FieldPicker({ spec, busy = false, onClose, onSave }) {
  const [draft, setDraft] = useState(() => {
    const d = {}
    for (const f of spec.fields) d[f.key] = f.value ?? ''
    return d
  })
  // THE COUNT IS FIELDS, NOT KEYSTROKES, and it counts what this press will
  // CHANGE — a field typed back to what it already said is not a change, and
  // neither is opening the sheet. Trimmed on both sides so trailing whitespace
  // does not arm a tick that will write nothing anybody can see.
  const changed = spec.fields.filter(
    (f) => String(draft[f.key] ?? '').trim() !== String(f.value ?? '').trim(),
  ).length
  const missing = spec.fields.some(
    (f) => f.required && !String(draft[f.key] ?? '').trim(),
  )
  const blocked = busy
    ? t('common.action.save.busy')
    : missing
      ? (spec.blocked || t('identity.picker.blocked'))
      : ''
  return (
    <FormModal
      open
      onClose={onClose}
      title={spec.title}
      maxWidth={460}
      // THE STANDING PAIR, stated at the one call site that draws it for all nine
      // rows: the tick lights and counts once the substance differs, and the cross
      // is red because it is the discarding half.
      dirty={changed}
      closeDanger
      saveTip={spec.saveTip}
    >
      {spec.personKind ? (
        <PersonPickerBody
          spec={spec}
          draft={draft}
          onDraft={setDraft}
          blocked={blocked}
          onSubmit={() => onSave(draft)}
        />
      ) : (
        <PickerForm
          spec={spec}
          draft={draft}
          onDraft={setDraft}
          blocked={blocked}
          onSubmit={() => onSave(draft)}
        />
      )}
    </FormModal>
  )
}
