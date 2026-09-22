// ONE DOOR TO A PERSON, FOR EVERY CREDIT IN THE APP.
//
// THE STATE THIS REPLACES, and it is the whole of a report: "the people pages
// seem to have no existence at all". Two surfaces name a person —
//
//   `personPanel` (identity.jsx) is the design pack's. It is reached BY ID and it
//   is the screen: every spelling of the name, how it files, when they were born
//   or the company founded, the links, and every work they are credited on.
//
//   `PersonModal` (people.jsx) predated it. It was reached by kind + name, and it
//   was the only surface that could CREATE a `people` row for a credited name
//   nobody had saved yet — it fetched a portrait and a bio on open and wrote the
//   row. It is deleted; see the paragraph below that says what replaced each half.
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
// record. A NAME WITHOUT ONE GETS ONE — `POST /people/ensure` files the row and
// the role and hands back the id, and the press lands on the pack's screen like
// every other.
//
// THAT LAST SENTENCE USED TO SAY "opens the thing that can make it", and the thing
// was the retired modal. It was not a fallback in practice, it was the FIRST
// screen every manually entered credit reached: a name typed onto a quote is text
// in `utterances.speaker`, and nothing in the app filed a person for it — the
// three writers that record a role are all triggered by an explicit person write.
// So the pack's screen was unreachable for exactly the credits a reader had
// entered by hand, which is most of them in a library nobody has run a fetch over.
// Reported as "the people screen that shows up is the old one … i am assuming
// because the people had no kind", and that is the whole of it: no row, or a row
// filed under another role, and `GET /people?kind=` filters by a join.
//
// AND THE LEGACY MODAL IS NOW GONE, which is the second half of that change and
// the reason this function no longer takes a setter. It survived one release as a
// fallback for two cases, and neither turned out to be a case: every one of the
// seven screens that calls this mounts a `PanelHost`, so `!stack` was unreachable,
// and the other branch was an `ensure` that failed — a server the app could not
// reach, answered by opening a 640-line surface whose own first act is to fetch
// from that server. A fallback that needs the thing that just failed is not a
// fallback; it is a second way to show the same error, in a shape nobody has
// looked at since the panel replaced it. The press says what went wrong instead.
//
// WHAT WENT WITH IT, said out loud because one of them was load-bearing and this
// is where a reader will come looking: `PersonModal` carried the app's only
// `DELETE /people/{id}`, so retiring it took the only way to delete one person by
// hand. That verb is now on the People console's row, beside the character
// console's — see `PersonRow` in MetadataPage.jsx. Its editing did NOT need
// replacing: the pack's panel already writes every field it did, through
// `PUT /people/id/{id}`.
//
// WHY THE IMPORT IS DYNAMIC. `identity.jsx` imports `Movies.jsx` (for
// `movieState`) and `cast.jsx`, so a static import of it here would close a cycle
// for five of the screens that need this — Movies, Quotes, SearchPage, Library and
// cast.jsx itself. A dynamic import has no static edge at all, so this module
// stays a leaf and every screen can use it. The chunk is the one the panel is
// about to render anyway.
import { createContext, useCallback, useContext, useEffect, useRef } from 'react'
import { errText, json } from './api.js'
import { t } from './i18n.js'
import { toast } from './ui.jsx'

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

// usePersonOpener — hand it the screen's panel stack, get back the one handler
// every `onOpenPerson` should be given.
//
// `stack` may be null on a screen that has no panel host yet. There is nowhere to
// open a panel into then, so the press says so rather than throwing over the
// screen — a credit that cannot be opened is a smaller fault than a blank page,
// and all seven of the app's callers mount a `PanelHost`, so this is the shape of
// an eighth caller's first day rather than anything a reader meets.
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
export function usePersonOpener(stack, explicitOpenWork = null) {
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
  const latest = useRef({ stack, onOpenWork })
  useEffect(() => { latest.current = { stack, onOpenWork } })
  return useCallback(async (p) => {
    const { stack: s, onOpenWork: openWork } = latest.current
    const name = p?.name
    // NO STACK, NO PANEL. See the header: an eighth caller that forgot its
    // `PanelHost` hears about it here rather than in a stack trace.
    if (!s || !name) return toast(t('error.open.person'))
    let id = p?.person?.id
    if (!id) {
      // THE ROW THE CREDIT NEVER HAD. Written on the press, which is a write on a
      // read gesture and is said out loud in handleEnsurePerson — the modal this
      // replaces did the same and fetched a portrait besides.
      const r = await json('POST', '/people/ensure', { kind: p?.kind, name })
      // THE SERVER'S OWN WORDS WHERE IT GAVE ANY. `ensure` refuses a kind it does
      // not know and a blank name by name, and those are the two answers a caller
      // can actually act on — a generic line here would hide the one useful thing
      // in the response.
      if (!r.ok) return toast(errText(r, t('error.open.person')))
      id = r.data?.id
    }
    if (!id) return toast(t('error.open.person'))
    const { personPanel } = await import('./identity.jsx')
    s.open(personPanel(s, { id, name, onOpenWork: openWork }))
  }, [])
}
