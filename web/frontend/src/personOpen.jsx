// ONE DOOR TO A PERSON, FOR EVERY CREDIT IN THE APP.
//
// THE STATE THIS REPLACES, and it is the whole of a report: "the people pages
// seem to have no existence at all". Two surfaces name a person —
//
//   `personPanel` (identity.jsx) is the design pack's. It is reached BY ID and it
//   is the screen: every spelling of the name, how it files, when they were born
//   or the company founded, the links, and every work they are credited on.
//
//   `PersonModal` (people.jsx) predates it. It is reached by kind + name, and it
//   is the only surface that can CREATE a `people` row for a credited name
//   nobody has saved yet — it fetches a portrait and a bio on open and writes
//   the row.
//
// — and the routing between them existed in exactly ONE place, Home's own
// `openPerson`. Every other screen passed its raw `setPerson` straight to the
// credit: a film's PLAYED BY line, a book's author, all twelve credit sites on
// Search, the Library's author groups, the cast panel, and the work-detail credit
// chips. Eighteen call sites, every one of them opening the older panel whatever
// the person's record said. So the pack's screen was not missing; it was
// unreachable from all but two places, which looks identical from the outside.
//
// THE ID DECIDES, and that is the only rule here. A name with a record opens the
// record. A name without one opens the thing that can make it — and once it has,
// the next press lands on the pack's screen. Nothing to choose and nothing lost.
//
// WHY THE IMPORT IS DYNAMIC. `identity.jsx` imports `Movies.jsx` (for
// `movieState`) and `cast.jsx`, so a static import of it here would close a cycle
// for five of the screens that need this — Movies, Quotes, SearchPage, Library and
// cast.jsx itself. A dynamic import has no static edge at all, so this module
// stays a leaf and every screen can use it. The chunk is the one the panel is
// about to render anyway.
import { createContext, useCallback, useContext, useEffect, useRef } from 'react'

// THE SHELL'S DOOR TO A WORK, PROVIDED ONCE INSTEAD OF THREADED SEVEN TIMES.
//
// It began as a third argument to `usePersonOpener` and a prop on two panels, and
// in that shape NOT ONE of the app's seven callers passed it. So every work tile
// on every person and character panel drew itself `aria-disabled` with a tooltip
// saying it could not be opened — in an app whose shell can open any of them, and
// whose register recorded the door as landed. A capability that has to be
// re-threaded at each call site is a capability that is absent at most of them,
// and absent-by-omission looks exactly like absent-on-purpose from the outside:
// the tile says the same thing either way.
//
// Only the shell can navigate — `pushRoute` moves the URL and the shell reads its
// tab from its own state, so a panel calling it changes the address bar and
// nothing else — so the shell PROVIDES the door once, and anything under it reads
// it. An explicit prop still wins where one is given, which is how a test hands
// in its own door and how a screen could deliberately point a panel elsewhere.
const OpenWorkContext = createContext(null)

// WorkDoor — wrap the app once. `open(kind, id)` takes the panel's own vocabulary
// ('book' | 'movie'), not the shell's two separate functions.
export function WorkDoor({ open, children }) {
  return <OpenWorkContext.Provider value={open || null}>{children}</OpenWorkContext.Provider>
}

// useWorkDoor — the door a panel should use: its own prop where it was given one,
// otherwise the shell's. Null outside a WorkDoor and with no prop, which is the
// honest answer for a panel rendered bare in a test — the tile then says it
// cannot be opened, which is true.
export function useWorkDoor(explicit = null) {
  const provided = useContext(OpenWorkContext)
  return explicit || provided || null
}

// THE SHELL'S DOOR TO A SEARCH, PROVIDED ONCE FOR THE SAME REASON THE WORK DOOR IS.
//
// THE PACK MAKES A COUNT A DOOR: "the pack's local sheet makes both counts
// pressable — '37 quotes' lands on the search screen with this character and this
// work already up as chips, which is the question the number summarises." The
// panel takes that verb as `onSearch`, and it is passed by NOBODY: Home, the
// work-details cast row, both metadata call sites and the panels' own internal
// pushes all leave it out. So `openQuoteSearch` resolved to `undefined` on every
// route into the screen, and `PairRow` drew a live button with no handler — two
// controls on the character sheet that press and do nothing, found by pressing
// every control on a real library.
//
// THIS IS A17 AGAIN, WORD FOR WORD: "A capability that has to be re-threaded at
// each call site is a capability that is absent at most of them, and
// absent-by-omission looks exactly like absent-on-purpose from the outside." The
// work door was fixed by providing it once; the search door was left threaded,
// and it was absent everywhere within one release.
//
// THE SHAPE IS THE SHELL'S OWN `searchScoped(scope, chips)`. `annotations` and
// `dialogues` are real scopes (`SearchPage`'s SCOPES table), so the panel's call
// needs no translation — which is why this is a door and not an adapter.
const OpenSearchContext = createContext(null)

export function SearchDoor({ open, children }) {
  return <OpenSearchContext.Provider value={open || null}>{children}</OpenSearchContext.Provider>
}

// useSearchDoor — the search the panel should use: its own prop where one was
// given, otherwise the shell's. Null outside a SearchDoor and with no prop, which
// is the honest answer for a panel rendered bare in a test: the counts are then
// figures rather than doors, and they say so.
export function useSearchDoor(explicit = null) {
  const provided = useContext(OpenSearchContext)
  return explicit || provided || null
}

// usePersonOpener — hand it the screen's panel stack and its legacy-modal setter,
// get back the one handler every `onOpenPerson` should be given.
//
// `stack` may be null on a screen that has no panel host yet: the opener then
// always falls to the legacy modal rather than throwing, which is the behaviour
// that screen already had. It is not the goal — a screen that draws credits
// should mount a `PanelHost` — but a missing stack must not be a dead press.
// `onOpenWork(kind, id)` IS THE THIRD DOOR, and it now comes from `WorkDoor`
// above rather than from an argument each caller has to remember — see that
// header for what the argument shape actually cost. A person's screen lists the
// works they are credited on, and pressing one has to open THAT WORK, which a
// panel cannot do on its own: `pushRoute` moves the URL and the shell reads its
// tab and detail from its own state, so a panel calling it changes the address
// bar and nothing else. The third parameter survives as an override.
//
// WHAT IT REPLACES: `stack.push(personPanel(…, { work }))`. `identityScope` drops
// a work handed to a person on purpose — "A PERSON HANDED A WORK IS STILL THE
// PERSON" — so that press pushed a byte-identical copy of the screen you were
// already on, with a back arrow. The owner's report: "clicking on the work cover
// brings us to the same exact page, but now with a back breadcrumb".
export function usePersonOpener(stack, openLegacy, explicitOpenWork = null) {
  // Read here rather than at the seven call sites: see WorkDoor above for what
  // asking each of them to remember cost.
  const onOpenWork = useWorkDoor(explicitOpenWork)
  // WHY THE ARGUMENTS ARE READ THROUGH A REF and not listed as deps, which is
  // what this did first: `usePanelStack()` returns a FRESH OBJECT LITERAL every
  // render — `{ stack, top, open, push, back, close }` — so `[stack, openLegacy]`
  // differs on every render and the `useCallback` memoised nothing at all. It
  // only bought a comparison and the appearance of a stable handler.
  //
  // The distinction matters because this handler's whole job is to be handed
  // down: a film's PLAYED BY line, twelve credit sites on Search, the Library's
  // author groups. A caller is entitled to assume the `onOpenPerson` it received
  // is stable — `React.memo` on any chip that takes it depends on exactly that —
  // and a dep list that changes every render quietly withdraws the guarantee
  // while the code still reads as though it were given. The methods inside the
  // object are themselves stable; only the wrapper is new, so the ref costs
  // nothing and the handler becomes what it claims to be.
  const latest = useRef({ stack, openLegacy, onOpenWork })
  useEffect(() => { latest.current = { stack, openLegacy, onOpenWork } })
  return useCallback((p) => {
    const { stack: s, openLegacy: legacy, onOpenWork: openWork } = latest.current
    const id = p?.person?.id
    if (!id || !s) {
      legacy({ kind: p?.kind, name: p?.name })
      return
    }
    import('./identity.jsx').then(({ personPanel }) => {
      s.open(personPanel(s, { id, name: p.name, onOpenWork: openWork }))
    })
  }, [])
}
