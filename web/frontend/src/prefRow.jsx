// A ROW THAT SETS ONE PREFERENCE, and the other half of the pair `recordRow.jsx`
// began. A record row stands for a thing in your library; this stands for a
// decision about the app.
//
// WHY IT EXISTS. Settings was one scrolling grid of cards, and every card wrote
// its own version of the same row — a label, sometimes an explanation, sometimes
// an info dot, and a control at the end. They drifted: some put the label in a
// `MonoLabel` and some in a `<span>`, some stacked the control under the label on
// a phone and some let it wrap, and the gap between label and control was written
// four different ways. None of that is a decision anybody made; it is what happens
// when a shape is retyped.
//
// WHAT A ROW IS. `label` names the preference. `sub` says what the choice means
// where the label cannot — and only where it cannot: the standing rule is that a
// row says a thing once, so "This work only" under "In this work" is prose and
// earns nothing. `info` is for the paragraph that would bury the row if it were
// printed under it. `changed` marks a row the reader has moved off its default,
// which is what makes a section able to say how many of its rows they have
// touched.
//
// IT RESOLVES NO LOCALE KEY OF ITS OWN, for the reason `characterRows.jsx` and
// `recordRow.jsx` do not: a row drawn on every settings section cannot carry one
// section's words.
//
// AND IT DRAWS NO CONTROL. The control is the caller's, passed as a child, so this
// row never becomes a registry of every kind of input the app has — which is the
// shape the prototype's row took and the reason it had fourteen branches in it.
// A Toggle, a Select, a Slider, a row of chips or a button all sit here the same
// way, and the repo's own components stay the only ones that draw anything.
import React from 'react'

import { ariaLabelText, InfoDot, MonoLabel } from './ui.jsx'
import { useMasonry } from './masonry.js'

// `said` IS A THIRD LINE IN THE LABEL'S OWN COLUMN, under the sub-line — a type
// specimen, and so far nothing else. It is not `children`: children sit outside
// the label column, at the row's full width, which is where a wall of style chips
// belongs and where a single line of type reads as a stray paragraph three lines
// below the row it describes.
// `lead` IS A SLOT BEFORE THE NAME, and so far only a drag grip lives in it. It is
// not part of `control`: a control is what the row DOES, and sits at the far end
// where every row's control sits; a lead is what you take hold OF, and a sorter at
// the right-hand edge is a sorter nobody finds. The owner asked for it there —
// "a drag bar ... to the left of each section".
export function PrefRow({ label, sub = null, said = null, info = null, infoTitle = null, changed = false, lead = null, control = null, children = null, rowProps = null }) {
  // The label is the row's identity. It is what the reader calls the row and what
  // is unique within a section, and it means a row does not have to be handed a
  // key that exists only so it can be counted.
  useSaysChanged(label, changed)
  return (
    <div className="pref-row" {...(rowProps || {})}>
      {lead}
      <div className="pref-row-said">
        {/* INLINE FLOW, NOT A FLEX ROW. As a flex row the info dot was a flex ITEM,
            so a label that wrapped to two lines sent the dot to a third on its
            own — a lone "i" under a sentence, which reads as a typo. In normal
            flow it follows the last word the way a footnote mark does. */}
        <span className="pref-row-name">
          {/* THE ROW'S OWN NAME, IN THE INTERFACE FACE AND NOT IN MONO. It was a
              MonoLabel — 11px, uppercase, faint — which is the same drawing a
              GROUP title wears, so a section read as one flat run of small grey
              capitals with no telling a heading from the row under it. The pack
              sets a row label in the UI face at semibold and keeps mono for the
              group head above it (settings-restructured.dc.html:174 against :144),
              which is what gives the screen two levels instead of none. */}
          <span className="pref-row-label">{label}</span>
          {/* A DOT ONLY WHERE THERE IS SOMETHING TO SAY. An info dot on every row
              is a row of dots, and a reader stops pressing any of them. */}
          {info && <InfoDot title={infoTitle || label} text={info} />}
          {/* CHANGED IS A MARK, NOT A WORD. A row that said "changed" would be
              saying it in the space its own explanation needs, and on a section
              where half the rows have been touched it would be a column of the
              same word. The section's own count is where the number belongs. */}
          {changed && <span className="pref-row-dot" aria-hidden="true" />}
        </span>
        {sub && <p className="cs-row-sub">{sub}</p>}
        {said}
      </div>
      {control && <div className="pref-row-control">{control}</div>}
      {children}
    </div>
  )
}

// A GROUP IS A HEADING AND ITS ROWS. The pack numbers them — "1 · Light and dark"
// — and the number is drawn from position rather than typed, because a hand-typed
// ordinal is the thing that goes wrong when a group is inserted.
// `sub` IS A LINE UNDER THE HEADING, and `aside` is a word at the far end of it.
// They are not interchangeable: an aside is a fact you glance at (which material
// set is on, how many themes are saved), a sub is a sentence about the whole
// group. "this device only" started as an aside and read as a fragment floating
// at the right-hand edge — the owner: "They should read 'this device only' and be
// placed as subtext below the subsection header."
export function PrefGroup({ title, index = null, sub = null, aside = null, info = null, wide = false, rowsRef = null, children }) {
  return (
    // NAMED, so it is a landmark rather than an anonymous box. The heading below
    // is a MonoLabel and not an <h*> — it is a label for a group of rows, not a
    // step in the document's outline — so nothing else gives this section a name,
    // and a screen reader listing regions would have found a run of unlabelled
    // ones. It is also what lets a test say "the switch in THIS group", which
    // matters here: several cards name their controls after the same four
    // screens.
    <section className={'pref-group' + (wide ? ' is-wide' : '')} aria-label={ariaLabelText(title)}>
      <div className="pref-group-head">
        <span className="flex flex-wrap items-baseline gap-1.5">
          <MonoLabel>{index == null ? title : `${index} · ${title}`}</MonoLabel>
          {info && <InfoDot title={title} text={info} />}
        </span>
        {/* THE ASIDE IS A FACT ABOUT THE GROUP, not a second heading: which
            material set is on, how many themes are saved. It sits at the far end
            so the headings still line up down the left. */}
        {aside && <span className="microcopy">{aside}</span>}
      </div>
      {sub && <p className="pref-group-sub">{sub}</p>}
      <div className="pref-group-rows" ref={rowsRef}>{children}</div>
    </section>
  )
}

// TWO COLUMNS ON A DESK, ONE ON A PHONE — the pack's own shape for a section
// (settings-restructured.dc.html draws Interface and Your own fonts side by side
// and spans the font list under both). It is a wrapper rather than a class on the
// card because the card does not know how many groups it is about to be handed,
// and `wide` is the group's own say: a group of full-measure rows — a face list, a
// run of sliders — is unreadable in half a card, which is the reason the pack
// marks that one `wide: true`.
//
// WHY A SECTION NEEDED IT AT ALL. Language and font drew one narrow column down
// the left of a 1280px card and left the other half empty: "use the space
// available" is the standing rule, and a screen that uses 45% of its width is the
// case it was written for.
//
// PACKED AS MASONRY, NOT A GRID — the owner's "use masonry packing on desktop" —
// so a short card beside a long one no longer leaves the long one's height of
// empty paper under it. See masonry.js for why it keeps reading order.
export function PrefColumns({ children }) {
  const ref = useMasonry()
  return <div className="pref-columns" ref={ref}>{children}</div>
}

// changedCount — how many of a section's rows the reader has moved off default.
// Exported and pure, because it is the one part of this that is arithmetic rather
// than a screen: given a list of flags it is a number, and that is checkable
// without mounting anything.
export function changedCount(rows) {
  return rows.filter(Boolean).length
}

// ── HOW MANY OF A SECTION'S ROWS YOU HAVE MOVED, and why it is counted here
// rather than tabulated somewhere.
//
// THE PACK PUTS A NUMBER ON EVERY SECTION — "3 changed", or "all default" — on the
// tab, in the section's own header and totalled on the phone's index. The obvious
// way to produce it is a table of every preference each section owns with its
// default beside it. That table is a SECOND copy of facts the cards already state
// as `p.srDaily || 8`, and the day one of them moves the badge starts saying a
// number that is wrong. A badge that is wrong is worse than no badge: it sends a
// reader looking for a change nobody made.
//
// SO A ROW COUNTS ITSELF. `PrefRow` already takes `changed`, the section that
// draws a row is by definition the section it belongs to, and this collects what
// was actually rendered. There is no membership list to disagree with the screen,
// because the screen is the list.
//
// AN UNREGISTERED ROW COUNTS AS UNCHANGED, which is the one weakness and is worth
// stating plainly: a row that never passes `changed` can never be counted, so the
// number is a floor rather than a total. It is a floor that only ever grows as
// rows are wired, and it is never a claim about a row that does not exist.
const SectionChanged = React.createContext(null)

export function ChangedScope({ onCount, children }) {
  // A ref rather than state: rows register during render, and setting state from a
  // child's render is the loop React warns about. The count is published after the
  // commit, when every row that was going to register has.
  const seen = React.useRef(new Map())
  seen.current = new Map()
  const api = React.useMemo(() => ({
    say: (id, changed) => { seen.current.set(id, !!changed) },
  }), [])
  React.useEffect(() => {
    onCount([...seen.current.values()].filter(Boolean).length)
  })
  return <SectionChanged.Provider value={api}>{children}</SectionChanged.Provider>
}

// useSaysChanged — a row tells its section whether it has been moved. Outside a
// scope it is a no-op, so a row drawn anywhere else is not an error.
function useSaysChanged(id, changed) {
  const scope = React.useContext(SectionChanged)
  if (scope) scope.say(id, changed)
}
