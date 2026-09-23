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
//   - THE NAME CLIPS, ON ONE LINE, WITH AN ELLIPSIS. It used to scroll under an
//     edge fade on the standing rule that a name is never truncated — and the
//     owner scoped that rule out of maintenance on 21 September, which is all
//     this component ever is. The clip has to be HONEST, which is the half of
//     the rule that did not move: `overflow: hidden` and a real
//     `text-overflow: ellipsis`, never a name cut off mid-letter with nothing
//     saying so. See `.record-row-name` and
//     `test/rules/no-truncated-names.test.js`.
//   - A ROW SAYS A THING ONCE. `sub` has to carry something the name does not.
//     The absence of a thing is not worth a sentence.
//
// NOTHING IS DEFINED HERE THAT NOTHING CALLS. An earlier draft shipped a swatch
// mark, a per-row font override and a count-that-is-a-door, all three unreachable
// and two of them with CSS and a decision-log entry describing them as in force.
// A rater found it, and the rule since is that a prop arrives WITH the console
// that needs it — which is what `count` and `onOpen` below are: the character
// console counts the works a character appears in and opens its record from the
// name, and both landed the day that console moved onto this row.
import React from 'react'
import { FieldIconButton, Tooltip } from './ui.jsx'

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
  // THE NAME IS THE DOOR WHERE THERE IS ONE. A list of forty characters is forty
  // names that look alike, and the fastest way into one is the word itself —
  // which the character console learned the hard way: its name was plain text and
  // the only way to the record was a pencil at the far right of the row, so a
  // screen that existed was reported as missing. Without `onOpen` the name stays
  // text, because a button that goes nowhere is worse than a word.
  onOpen = null,
  sub = null,
  chips = [],
  chipsEmpty = null,
  // A COUNT OF PROBLEMS IS THE ONLY RED ONE. A library of 900 books is not a
  // warning; a character in no work is. `countTone: 'warn'` says which this is.
  count = null,
  countTone = 'plain',
  countTip = '',
  // A COUNT OF PROBLEMS IS A DOOR, and a count of records is not always one. The
  // people console's works count goes to a search for that person; the character
  // console's works count goes nowhere, because a character in no work has
  // nothing to search for. So the number is a button only where the caller gave
  // it somewhere to go — never a button that does nothing, which teaches the
  // reader that the numbers here are not pressable and costs the real doors their
  // discoverability.
  onCount = null,
  actions = [],
  // { checked, onChange, tip, label } — the caller's words for the box, since this
  // module has none of its own. `tip` is what a pointer sees and `label` is the
  // box's NAME: a tooltip is not one, and a row of unnamed checkboxes is what a
  // screen reader got here until the capture probe could not tell them apart.
  select = null,
  // A RULE SEPARATES ROWS; IT DOES NOT OPEN A LIST. The works console draws its
  // rows under a header that already closes with one, so every row there wears a
  // top rule; a bare list does not want one above its first.
  first = false,
  children = null,
}) {
  return (
    <div className="record-row" style={{ borderTop: first ? 'none' : '1px solid var(--line)', padding: 'calc(var(--meta-gap, 16px) * 0.6) 0' }}>
      <div className="flex flex-wrap items-center gap-3">
        {select && (
          <Tooltip label={select.tip} side="top">
            <input type="checkbox" aria-label={select.label} checked={select.checked} onChange={select.onChange} />
          </Tooltip>
        )}
        {mark}
        <div className="min-w-0 flex-1">
          {/* A CLIP, NOT A SIDEWAYS SCROLLER, AND THE OWNER RULED ON IT. This was a
              `NameScroll`, so a long title faded out under an edge mask and had to be
              dragged to be read — which is what "The Witcher 3: Wild H" was in the
              screenshot that prompted the ruling: not a truncation, a scroller. The
              owner, 21 September: "The work name truncation is fine. Delete that
              fucking rule. It is not okay when the work is the main concern. It is
              fine when it is used for maintenance."

              THIS COMPONENT IS ONLY EVER MAINTENANCE — every one of its nine callers
              is a metadata console — so the ruling covers the whole of it rather than
              a site at a time. A reader here came to fix a row they already know, and
              every one of these names is printed in full on the shelf it came from.
              Dragging two hundred of them sideways to confirm what they are is the
              cost the edge mask was charging for a certainty nobody needed. */}
          <p className="record-row-name">
            {onOpen ? <button type="button" className="tp-link" onClick={onOpen}><b>{name}</b></button> : <b>{name}</b>}
          </p>
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
        {count != null && count !== '' && (
          <Tooltip label={countTip}>
            {onCount
              ? <button type="button" className="tp-link mono-label" onClick={onCount}>{count}</button>
              : <span className="mono-label" style={{ color: countTone === 'warn' ? 'var(--error)' : 'var(--soft)' }}>{count}</span>}
          </Tooltip>
        )}
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
        // A ROLE CHIP CARRIES ITS DRAWING, and the WORD STAYS. This is the roomy
        // half of the count rule — a chip has room, so the glyph follows the text
        // and the association is learnable; the tight half, glyph alone, is for
        // rows already carrying buttons and several facts. A chip with no glyph
        // (an issue flag, a spelling) simply passes none and draws as it always did.
        const icon = typeof c === 'string' ? null : c.icon
        return (
          <span
            key={label}
            className="tp-chip"
            style={warn ? { color: 'var(--error)', borderColor: 'color-mix(in srgb, var(--error) 40%, var(--line))' } : undefined}
          >
            {label}
            {icon}
          </span>
        )
      })}
    </span>
  )
}
