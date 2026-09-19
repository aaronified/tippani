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
// AND AN INDEX ON A PHONE, which is what the pack draws and what this got wrong
// for a while. Five tabs on a 390px screen show two and a half, so a scrolling
// strip is the wrong control — that much was right. The answer written here was a
// Select, and the owner's objection to it is the correct one: "why should i suffer
// a dropdown when you were told to build a list of options in the screen as
// shortcuts?" A dropdown hides every section behind a press and shows one word; the
// pack draws a list of tall rows, each naming its section, carrying its own count
// and wearing a chevron, and pressing one opens that section with a way back.
// A list of shortcuts IS the navigation; a field is a control you have to operate
// before navigation begins.
//
// SO THIS COMPONENT OWNS THE WHOLE FRAME NOW, not just the tabs. The drill-down
// needs to know whether a section has been entered, and both screens had the same
// four lines of frame around the same two elements — `meta-frame`, the rail, then
// `meta-body` around whatever the section draws. Keeping the drill state in each
// caller would have been that shape retyped, and the repo's directive is that a
// control drawn on two screens lives in one function both call. The body arrives
// as children; on a desk it sits beside the tabs exactly as before.
//
// IT RESOLVES ONE LOCALE KEY, AND ONLY BECAUSE THE KEY IS NOBODY'S SCREEN. Every
// label, every count and the phone note's two halves arrive from the caller,
// because Metadata's sections and Settings' sections have nothing to say to each
// other and a shared control carrying one screen's words could not serve the
// second. The exception is the back button's aria string, which is
// `common.panel.back.aria` — the app's own phrase for leaving any panel, already
// resolved this way in a dozen places. Threading it in from both callers would be
// the same string typed twice to honour a rule about not typing things twice.
import React, { useEffect, useRef, useState } from 'react'

import { IconArrow, InfoDot, Scroller, useIsMobileScreen, useScreenBar } from './ui.jsx'
import { t } from './i18n.js'

// `sections` — [{ id, label, icon, count, warn }]. `count` of null prints
// nothing, which is not the same fact as a zero: "0 characters" and "not loaded
// yet" are different, and a zero that turns into 41 a moment later is the more
// misleading of the two.
//
// `warn` marks a count that is a count of PROBLEMS. It is the only one that goes
// red, because a library of 900 books is not a warning.
// `open` IS THE ADDRESS, AND IT REPLACED A FLAG. A phone shows the index or a
// section, and which one used to be `entered`, a boolean this component kept —
// with two effects to keep it honest: one to leave on a width change, one to enter
// when something other than the index chose a section. A section is a route now
// (`/settings/<id>`), so "am I in one" is a question the URL answers, both effects
// are gone with the state they guarded, and the dock's Back key leaves a section
// the same way it leaves anything else. That is what let the drill head go.
//
// CONTROLLED OR NOT, the ordinary React idiom rather than a special case: a caller
// that owns the address passes `open` and this follows it; a caller that does not —
// a test, a screen mounted on its own — passes nothing and this keeps the flag.
// Without the second half, mounting either screen outside the shell stranded a
// phone reader on the index with no way into a section, which is nine suites'
// worth of the phone flow and would have been a real defect the day anything else
// mounted one.
export function SectionRail({ sections, value, open = undefined, onChange, ariaLabel, mobileInfo = null, total = null, aside = null, children = null }) {
  const mobile = useIsMobileScreen()
  const chosen = sections.find((s) => s.id === value) || null
  const [entered, setEntered] = useState(false)
  const inSection = open === undefined ? entered : open

  // A SECTION CHOSEN FROM SOMEWHERE ELSE IS A SECTION YOU ARE IN, and this effect
  // came back after being deleted. The index is not the only way into one:
  // Metadata's issue sheet lands the reader on the console filtered to the gap they
  // pressed, and a search result opens the section that holds it. Where the caller
  // owns the address that is automatic — navigating IS entering — so this runs only
  // where it does not, and deleting it wholesale sent the issue sheet's press back
  // to the index it was pressed from.
  //
  // FIRST RENDER IS EXEMPT, because arriving at the screen is not choosing a
  // section and the index is where a phone starts.
  const seen = useRef(value)
  useEffect(() => {
    if (open !== undefined) return
    if (seen.current !== value) {
      seen.current = value
      if (mobile) setEntered(true)
    }
  }, [value, mobile, open])

  // WHERE YOU ARE, PUBLISHED UPWARD RATHER THAN DRAWN HERE. This component used to
  // draw a header bar of its own on a phone — a back arrow, the section's name, its
  // info dot and a pill — directly under a top bar that had already named the
  // screen. The owner: "There is already a back key in the bottom bar. The header
  // title can be in breadcrumbs." So the name goes to the bar that names the
  // screen, the dot goes with it, and the arrow is the dock's.
  useScreenBar({
    crumb: mobile && !inSection ? null : chosen ? {
      label: chosen.label,
      info: chosen.info ? { title: chosen.label, text: chosen.info } : null,
      badge: chosen.pill || null,
    } : null,
  })

  if (mobile && !inSection) {
    return (
      <div className="section-index">
        {/* THE TOTAL RIDES WITH THE INDEX, not with a section, because it is the
            one number that is about all of them. A screen with nothing counted
            passes null and wears none. */}
        {(total || mobileInfo) && (
          <div className="section-index-head">
            {total && <span className="section-index-total">{total}</span>}
            {mobileInfo && <InfoDot side="bottom" title={mobileInfo.title} text={mobileInfo.text} />}
          </div>
        )}
        {/* A NAVIGATION LANDMARK, AND THE ROWS STAY BUTTONS. This was a
            `role="list"` of `role="listitem"` buttons for one run of the journey
            tier, and the journey found it: an explicit role REPLACES the implicit
            one, so every row stopped being announced as pressable — the harness
            reported "nothing a person could press is named Review" over a screen
            with Review plainly on it. A list of the places you can go is a
            navigation, the rows are buttons, and both halves are then true. */}
        <nav aria-label={ariaLabel}>
          {sections.map((s) => (
            <button
              key={s.id}
              type="button"
              className="section-index-row"
              onClick={() => { onChange(s.id); setEntered(true) }}
            >
              <span className="section-index-icon" aria-hidden="true">{s.icon}</span>
              <span className="section-index-label">{s.label}</span>
              {s.count != null && (
                <span className={`meta-rail-count${s.warn ? ' is-warn' : ''}`}>{s.count}</span>
              )}
              <span className="section-index-chevron" aria-hidden="true"><IconArrow /></span>
            </button>
          ))}
        </nav>
      </div>
    )
  }

  // NO DRILL HEAD. Everything it drew is one row up: the name and the count are in
  // the top bar's crumb (above), the info dot travels with them, and Back is the
  // dock's. What is left is the section.
  if (mobile) {
    return (
      <div className="meta-frame">
        <div className="meta-body">{children}</div>
      </div>
    )
  }

  return (
    <div className="meta-frame">
      {/* THE TABS AND WHATEVER RIDES AT THE FAR END SHARE ONE ROW, and one bottom
          border, which is how the pack draws it
          (settings-restructured.dc.html:122-138): a flex row holding the tablist
          and, pushed to the right, the section's info dot and its Reset. They were
          a second full-width bar underneath for a while, repeating the count the
          tab already carried — "do not build redundant stuff". */}
      <div className="meta-rail-row">
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
              onClick={() => { onChange(s.id); setEntered(true) }}
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
      {aside && (
        <span className="meta-rail-aside">
          {aside.info && <InfoDot side="bottom" title={aside.info.title} text={aside.info.text} />}
          {aside.action}
        </span>
      )}
      </div>
      <div className="meta-body">{children}</div>
    </div>
  )
}
