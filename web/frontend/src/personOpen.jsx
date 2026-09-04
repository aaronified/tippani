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
import { useCallback } from 'react'

// usePersonOpener — hand it the screen's panel stack and its legacy-modal setter,
// get back the one handler every `onOpenPerson` should be given.
//
// `stack` may be null on a screen that has no panel host yet: the opener then
// always falls to the legacy modal rather than throwing, which is the behaviour
// that screen already had. It is not the goal — a screen that draws credits
// should mount a `PanelHost` — but a missing stack must not be a dead press.
export function usePersonOpener(stack, openLegacy) {
  return useCallback(
    (p) => {
      const id = p?.person?.id
      if (!id || !stack) {
        openLegacy({ kind: p?.kind, name: p?.name })
        return
      }
      import('./identity.jsx').then(({ personPanel }) => {
        stack.open(personPanel(stack, { id, name: p.name }))
      })
    },
    [stack, openLegacy],
  )
}
