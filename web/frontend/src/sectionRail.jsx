// THE RAIL A SECTIONED SCREEN IS NAVIGATED BY, and the one function both
// screens call.
//
// WHY IT LEFT MetadataPage.jsx. The v3 pack draws Settings and Metadata the same
// way — a row of named sections across the top of a desk, a field on a phone —
// and the repo's standing directive is that a control drawn by one component on
// two screens has ONE behaviour, living in one function both screens call, not in
// a line each. Metadata had the only copy; Settings was about to grow a second,
// and a second copy is how one of them goes on being right while the other
// quietly stops.
//
// TABS ON TOP ON EVERY WIDTH ABOVE A PHONE, which is Metadata's own reasoning and
// holds for Settings too: a left column spends 13.5rem of a desk on five words,
// and what sits under it wants every pixel of width it can get.
//
// AND A FIELD ON A PHONE, not a scrolling strip. Five tabs on a 390px screen show
// two and a half, so the section you are not in sits behind a gesture with no
// arrow — the edge-fade rule working exactly as designed and still being the wrong
// control for this. A field states the section you are in and opens the whole
// list, in the width of one row.
//
// IT RESOLVES NO LOCALE KEY OF ITS OWN. Every label, every aria string and the
// phone note's two halves arrive from the caller, because Metadata's sections and
// Settings' sections have nothing to say to each other and a shared control that
// carried one screen's words could not serve the second.
import React from 'react'

import { InfoDot, Scroller, Select, useIsMobileScreen } from './ui.jsx'

// `sections` — [{ id, label, icon, count, warn }]. `count` of null prints
// nothing, which is not the same fact as a zero: "0 characters" and "not loaded
// yet" are different, and a zero that turns into 41 a moment later is the more
// misleading of the two.
//
// `warn` marks a count that is a count of PROBLEMS. It is the only one that goes
// red, because a library of 900 books is not a warning.
export function SectionRail({ sections, value, onChange, ariaLabel, mobileInfo = null }) {
  const mobile = useIsMobileScreen()

  if (mobile) {
    const label = (s) => (s.count == null ? s.label : `${s.label} · ${s.count}`)
    // The dot rides with the field rather than sitting in a header, because on a
    // phone the header is gone and this note is about the phone's own
    // arrangement — one row, the control and the explanation of it.
    return (
      <div className="flex items-center gap-2">
        <span className="grow min-w-0">
          <Select
            ariaLabel={ariaLabel}
            value={value}
            onChange={onChange}
            options={sections.map((s) => [s.id, label(s), s.hint || s.label])}
          />
        </span>
        {mobileInfo && <InfoDot side="bottom" title={mobileInfo.title} text={mobileInfo.text} />}
      </div>
    )
  }

  return (
    <Scroller axis="x" className="meta-rail" role="tablist" aria-label={ariaLabel}>
      {sections.map((s) => {
        const on = value === s.id
        return (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={on}
            className={`meta-rail-item${on ? ' is-on' : ''}`}
            onClick={() => onChange(s.id)}
          >
            <span className="meta-rail-icon" aria-hidden="true">{s.icon}</span>
            <span className="meta-rail-label">{s.label}</span>
            {s.count != null && (
              <span className={`meta-rail-count${s.warn ? ' is-warn' : ''}`}>{s.count}</span>
            )}
          </button>
        )
      })}
    </Scroller>
  )
}
