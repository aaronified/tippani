// What a work already knows about itself, for the boxes you type a locator into.
//
// THE COMPLAINT THIS EXISTS FOR: the film page's edit form has offered a line's
// character from the work's cast since the cast was a blob of provider JSON, and
// the ＋ Add surface — the form you actually capture a quote in — offered nothing.
// Same field, same work, same list sitting in the database, and one of the two
// screens asked you to remember it. A book was worse: it had no character box at
// all, and its chapter fields had no memory of the chapter names you had typed
// into them forty highlights ago.
//
// ONE HOOK, BECAUSE IT IS ONE QUESTION. "What does this work already know" has two
// answers — its cast (work_cast, 0048) and the chapters its own highlights name
// (`GET /books/{id}/chapters`) — and every form that asks one usually wants the
// other. Keeping them in one hook keeps the fetching in one place, which is what
// makes the rule below enforceable.
//
// IT FETCHES ONLY WHEN THERE IS A WORK, AND ONLY ONCE PER WORK. The capture surface
// mounts with no target, and a form that fired two requests at mount for a work
// nobody had chosen yet would be two requests per opening of the ＋ menu. The
// effect is keyed on `kind:id`, so choosing a work fetches, changing it fetches
// again, and typing in the box does not.
//
// A REFUSAL IS AN EMPTY LIST, NEVER AN ERROR ON SCREEN. These are suggestions: the
// field works perfectly well without them, and a red line above a capture form
// because a dropdown could not be filled would be a worse form than one with no
// dropdown. The server logs the failure with its code (TIP-CAST-001,
// TIP-BOOK-004); the reader types the name.
import { useEffect, useMemo, useState } from 'react'
import { json } from './api.js'

// EMPTY is the answer for "no work chosen", shared so callers can destructure
// without guarding, and frozen so a caller cannot leave a name in it for the next
// one — these are module-level defaults, not state.
const EMPTY = Object.freeze({ characters: [], cast: [], chapters: [], loading: false })

export function useWorkSuggestions(target) {
  const kind = target?.kind === 'screen' || target?.type === 'movie' ? 'movies' : 'books'
  const id = target?.id ?? null
  const key = id == null ? '' : `${kind}:${id}`
  const [state, setState] = useState(EMPTY)

  useEffect(() => {
    if (!key) {
      setState(EMPTY)
      return undefined
    }
    let stale = false
    setState((s) => ({ ...s, loading: true }))
    // The cast for both kinds — a book's rows are characters with nobody beside
    // them, which is exactly the shape the character box wants — and the chapter
    // list for a book only, because a film has no chapters to offer.
    const wants = [json('GET', `/${kind}/${id}/cast`)]
    if (kind === 'books') wants.push(json('GET', `/books/${id}/chapters`))
    Promise.all(wants).then(([rc, rch]) => {
      if (stale) return
      const cast = (rc?.ok && rc.data?.cast) || []
      setState({
        cast,
        // Deduped, in the order the server sent them (provider billing order, then
        // the reader's own additions), because that order is more useful than
        // alphabetical: the lead is the character most lines belong to.
        characters: [...new Set(cast.map((c) => c.character).filter(Boolean))],
        chapters: (rch?.ok && rch.data?.chapters) || [],
        loading: false,
      })
    })
    return () => {
      stale = true
    }
  }, [key, kind, id])

  // actorFor answers "who plays them", case-insensitively, for the preview the
  // film form draws under the character box. Built here rather than in the form so
  // the two forms that want it cannot fold names two different ways.
  const actorFor = useMemo(() => {
    const m = new Map()
    for (const c of state.cast) {
      if (c.character) m.set(c.character.trim().toLowerCase(), (c.actor || '').trim())
    }
    return (name) => m.get(String(name || '').trim().toLowerCase()) || ''
  }, [state.cast])

  // chapterNoFor is the other half of the pair: the number the reader typed beside
  // this chapter NAME last time, or '' when they never did.
  //
  // THE NAME IS THE KEY AND NOT THE NUMBER, deliberately. Filling the name from a
  // number would be guessing at what somebody meant by "42"; filling the number
  // from a name is repeating what they themselves typed against those exact words.
  const chapterNoFor = useMemo(() => {
    const m = new Map()
    for (const ch of state.chapters) {
      const name = (ch.name || '').trim().toLowerCase()
      if (name && ch.no && !m.has(name)) m.set(name, ch.no)
    }
    return (name) => m.get(String(name || '').trim().toLowerCase()) || ''
  }, [state.chapters])

  // The names and the numbers as plain lists, for the two datalists. Numbers are
  // strings because that is what an input holds, and a trailing `.0` on a whole
  // number would be a suggestion nobody typed.
  const chapterNames = useMemo(
    () => [...new Set(state.chapters.map((c) => (c.name || '').trim()).filter(Boolean))],
    [state.chapters],
  )
  const chapterNumbers = useMemo(
    () => [...new Set(state.chapters.filter((c) => c.no).map((c) => String(c.no)))],
    [state.chapters],
  )

  return { ...state, actorFor, chapterNoFor, chapterNames, chapterNumbers }
}

// Datalist — a native suggestion list for a plain input.
//
// NATIVE, AND THAT IS THE WHOLE POINT. A hand-built dropdown here would be a
// fourth one in this app, and this is the only role where the browser's own is
// strictly better: it filters as you type, it does not steal the keyboard on a
// phone, and it never prevents you typing something that is not on the list —
// which matters, because every one of these fields is free text and the list is a
// memory aid rather than a vocabulary.
//
// Rendered as nothing when there is nothing to offer, so an input's `list=` can
// point at an id that is simply absent; a datalist with no options is the same as
// no datalist to every browser, but an EMPTY one still renders an empty popup in
// some, which reads as a broken control.
export function Datalist({ id, options }) {
  if (!options || options.length === 0) return null
  return (
    <datalist id={id}>
      {options.map((o) => (
        <option key={o} value={o} />
      ))}
    </datalist>
  )
}
