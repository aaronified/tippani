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
import { useState } from 'react'

import { t } from './i18n.js'
import { FormModal, MonoLabel, useFormHost } from './ui.jsx'

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
      <PickerForm
        spec={spec}
        draft={draft}
        onDraft={setDraft}
        blocked={blocked}
        onSubmit={() => onSave(draft)}
      />
    </FormModal>
  )
}
