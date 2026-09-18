// A ROW THAT STANDS FOR A RECORD, and the one function every list in the app
// calls to draw one.
//
// WHY IT EXISTS. The v3 prototypes draw six metadata consoles, and every one of
// them is the same row: a mark, a name, a sub-line, some chips, and two or three
// things you can do to it. The repo had already written that row four times —
// BookRow, MovieRow, the person row and the character row — each with its own
// copy of the cover slot, the gap chips and the action cluster, which is how the
// person console ended up with a portrait that opens an editor while the
// character console's portrait opens nothing. The directive this answers is the
// repo's own: two things that look the same behave the same, and the verb lives
// in ONE function both screens call.
//
// AND IT IS NOT METADATA'S. Settings and Metadata are the first two screens
// remade to the v3 pack; the rest of the app follows, and almost all of that rest
// is lists. So this row was designed against LIBRARY rather than against the
// console that needed it first, because a row shaped around the metadata tables
// would have had to be pulled apart again on the third screen.
//
// IT RESOLVES NO LOCALE KEY OF ITS OWN, which is `characterRows.jsx`'s rule and
// applies here for a sharper reason: a first draft of this file defaulted the
// cover's alt text and the checkbox's tooltip to `metadata.row.*`, and a module
// every screen draws from cannot carry one screen's words. Every string arrives
// from the caller.
//
// WHAT A CALLER MAY HAND IT. A mark, a name, at most one sub-line, chips,
// actions, a selection box, and its own expansion. That list is the grammar, and
// the rules underneath it are the standing UI rules rather than this file's
// inventions:
//
//   - THE NAME IS NEVER TRUNCATED. It scrolls under an edge fade (NameScroll) or
//     it wraps. A shortened name and a short name look alike, and the row exists
//     to show the name.
//   - A ROW SAYS A THING ONCE. `sub` has to carry something the name does not.
//     The absence of a thing is not worth a sentence.
//
// NOTHING IS DEFINED HERE THAT NOTHING CALLS. An earlier draft shipped a swatch
// mark, a per-row font override and a count-that-is-a-door, all three unreachable
// and two of them with CSS and a decision-log entry describing them as in force.
// They belong with the consoles that need them — the colour categories and the
// tags sections — and they arrive with those callers.
import React from 'react'
import { FieldIconButton, NameScroll, Tooltip } from './ui.jsx'

// A work's cover. THE EMPTY SLOT KEEPS ITS SPACE AND WEARS A MARK: on a console
// whose job is "what is missing", a missing picture is the finding rather than a
// shrug, and a collapsed slot would hide the thing the row is in the list for.
// `alt` is required, because only the caller knows whether the gap is a cover, a
// poster or a portrait.
export function RowArt({ src, alt }) {
  return src
    ? <img className="meta-row-art" src={src} alt="" loading="lazy" />
    : <span className="meta-row-art is-empty" role="img" aria-label={alt} />
}

export function RecordRow({
  mark = null,
  name,
  sub = null,
  chips = [],
  chipsEmpty = null,
  actions = [],
  // { checked, onChange, tip } — `tip` is the caller's words for the box, since
  // this module has none of its own.
  select = null,
  children = null,
}) {
  return (
    <div style={{ borderTop: '1px solid var(--line)', padding: '10px 0' }}>
      <div className="flex flex-wrap items-center gap-3">
        {select && (
          <Tooltip label={select.tip} side="top">
            <input type="checkbox" checked={select.checked} onChange={select.onChange} />
          </Tooltip>
        )}
        {mark}
        <div className="min-w-0 flex-1">
          <NameScroll as="p"><b>{name}</b></NameScroll>
          {/* `.cs-row-sub`, WHICH THE REPO ALREADY HAD, and the first draft did not use.
              It was `.microcopy` — the mono label face at `--type-mono-11`, tracked and
              in `var(--faint)` — so moving the author off the name line ALSO turned it
              into a label and dimmed it, when the old single line had rendered it in body
              type at `var(--soft)`. That is a worse row than the one this replaced, and it
              breaks the standing instruction to reach for the element the repo already has:
              `characterRows.jsx` renders its own sub-line with exactly this class. */}
          {sub && <p className="cs-row-sub">{sub}</p>}
          <RowChips chips={chips} empty={chipsEmpty} />
        </div>
        {actions.length > 0 && (
          <span className="flex items-center gap-1">
            {actions.map((a) => (
              <FieldIconButton
                key={a.key}
                icon={a.icon}
                ariaLabel={a.ariaLabel}
                tooltip={a.tooltip || a.ariaLabel}
                active={!!a.active}
                danger={!!a.danger}
                onClick={a.onClick}
                // A LATCHED GLYPH HAS TO SAY SO, AND THIS LINE IS A REPAIR. The
                // hand-rolled clusters this replaced passed `aria-pressed`
                // through FieldIconButton's `...rest`; the first draft of this
                // component enumerated the props it forwarded and silently
                // dropped it, so both toggles on every book and film row went on
                // drawing their latched state and stopped announcing it. An
                // action says `pressed: true|false` to be a toggle; an action
                // that omits it is a plain button and gets no attribute, because
                // `aria-pressed="false"` on a one-shot verb is its own defect.
                {...(a.pressed === undefined ? {} : { 'aria-pressed': a.pressed })}
              />
            ))}
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

// The chips a row wears. A warn chip is a missing field; a plain one is a fact
// about the record. `empty` is what the row says when it has none — "complete" on
// a works console — and nothing when the caller has nothing worth saying, because
// a row that announces its own emptiness is the say-it-once rule broken sideways.
function RowChips({ chips, empty }) {
  if (!chips.length) {
    return empty ? <span className="microcopy" style={{ color: 'var(--accent-ui)' }}>{empty}</span> : null
  }
  return (
    <span className="flex flex-wrap gap-1.5">
      {chips.map((c) => {
        const warn = typeof c === 'string' ? false : !!c.warn
        const label = typeof c === 'string' ? c : c.label
        return (
          <span
            key={label}
            className="tp-chip"
            style={warn ? { color: 'var(--error)', borderColor: 'color-mix(in srgb, var(--error) 40%, var(--line))' } : undefined}
          >
            {label}
          </span>
        )
      })}
    </span>
  )
}
