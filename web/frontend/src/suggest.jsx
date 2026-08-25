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
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { json } from './api.js'
import { MonoLabel, useAnchoredPosition, useDismiss, useIsMobileScreen } from './ui.jsx'

// EMPTY is the answer for "no work chosen", shared so callers can destructure
// without guarding, and frozen so a caller cannot leave a name in it for the next
// one — these are module-level defaults, not state.
const EMPTY = Object.freeze({ cast: [], chapters: [], loading: false })

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
      // `cast` WHOLE, not a list of names. It was both for one release: the
      // deduped `characters` array existed for the datalist, and CastCombo — which
      // replaced it — needs the actor beside each part, so it takes the rows and
      // dedupes them itself. A second shape nothing reads is a second shape to keep
      // in step.
      setState({
        cast,
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

// Datalist — a native suggestion list for a plain input. The CHAPTER fields, and
// only those: the character and actor boxes moved to CastCombo below.
//
// NATIVE, AND STILL RIGHT HERE. The argument was that the browser's own list is
// strictly better in this role — it filters as you type, it does not steal the
// keyboard on a phone, and it never prevents you typing something that is not on
// the list. The part that did not survive contact with the character box is
// DISCOVERABILITY: desktop Chrome opens a datalist only after a keystroke, so a
// reader who had typed nothing saw nothing. That is fatal for a list of a work's
// cast, which is the thing you open the box in order to be reminded of, and it
// costs nothing for a chapter number you are about to type anyway.
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

// ---- the cast combobox ------------------------------------------------------
//
// CastCombo is the character (or actor) box with the work's own cast hanging
// under it: a text input that drops a list, filters as you type, and never stops
// you typing a name the list has never heard of.
//
// IT REPLACES A <datalist>, WHICH IS A DECISION REVERSED. The argument for the
// native list was that the browser's own is strictly better in this one role —
// it filters, it does not steal a phone's keyboard, and it cannot refuse free
// text. Two of those are still true and the first one is what went wrong: what
// the browser actually does with a datalist is a per-browser matter. On desktop
// Chrome it opens only after a keystroke, so a reader who had typed nothing saw
// nothing and had no way to learn the list existed; Safari draws it as a
// scrolling menu of everything; on Android it is a strip above the keyboard that
// looks like autocorrect. "There is a dropdown here" was not discoverable, which
// for a memory aid is the whole of its value.
//
// So it opens on FOCUS, shows what the work knows, and says who plays each part.
//
// TEN ON A DESKTOP, FIVE ON A PHONE, which is the cap the owner asked for and is
// not arbitrary either way round: a phone's dropdown is drawn over the form it
// belongs to, and a list of twenty covers the box you are typing into.
//
// THE ACTOR IS IN THE ROW, not only in the preview under the box. A film's cast
// is twenty rows of two names and the one you remember is often the actor's —
// "the one Alan Rickman played" — so a list of characters alone is a list you
// have to translate before you can use it. It is free text, so nothing stops the
// reader typing the actor's name into the character box; the row is what makes
// that unnecessary rather than what prevents it.
const COMBO_MAX_DESKTOP = 10
const COMBO_MAX_MOBILE = 5

// fold is the same accent-and-case fold the rest of the app matches names with,
// kept local because this file must not import text.js's pure module for one
// two-line function that has a different job here (substring, not distance).
const fold = (v) => String(v || '').toLowerCase().trim()

export function CastCombo({
  label,
  value,
  onChange,
  placeholder,
  // [{ character, actor }] — the work's cast in billing order, straight from the
  // hook. `field` says which of the two names this box holds, which decides both
  // what is matched and what is shown as the second line.
  cast = [],
  field = 'character',
  nameCase = true,
  inputRef,
  ariaLabel,
}) {
  const [open, setOpen] = useState(false)
  const [hi, setHi] = useState(-1)
  const inputID = useId()
  const boxRef = useRef(null)
  const ownRef = useRef(null)
  const listID = useId()
  const ref = inputRef || ownRef
  const mobile = useIsMobileScreen()
  const cap = mobile ? COMBO_MAX_MOBILE : COMBO_MAX_DESKTOP

  // The rows, deduped on the name this box holds and in the order they arrived
  // (billing order, then the reader's own additions) — the lead is the character
  // most lines belong to, which beats alphabetical for a list of ten.
  const rows = useMemo(() => {
    const seen = new Set()
    const out = []
    for (const c of cast) {
      const name = (c?.[field] || '').trim()
      if (!name || seen.has(fold(name))) continue
      seen.add(fold(name))
      out.push({ name, other: (c?.[field === 'character' ? 'actor' : 'character'] || '').trim() })
    }
    return out
  }, [cast, field])

  // A SUBSTRING MATCH, NOT A PREFIX. "quinn" finds "Harley Quinn", which is the
  // half of the name people actually remember. An exact hit is dropped: a list
  // whose only row is what is already in the box is a panel over the form saying
  // nothing.
  const q = fold(value)
  const matches = useMemo(
    () => rows.filter((r) => (!q || fold(r.name).includes(q) || fold(r.other).includes(q)) && fold(r.name) !== q).slice(0, cap),
    [rows, q, cap],
  )

  const menuOpen = open && matches.length > 0
  const { popRef, style } = useAnchoredPosition(menuOpen, boxRef, { matchWidth: true, minHeight: 120 })
  useDismiss(menuOpen, () => setOpen(false), [boxRef, popRef], { event: 'pointerdown' })

  const pick = (name) => {
    onChange(name)
    setOpen(false)
    setHi(-1)
  }

  const onKey = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setHi((h) => Math.min(h + 1, matches.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHi((h) => Math.max(h - 1, -1))
    } else if (e.key === 'Enter' && menuOpen && hi >= 0) {
      // Only with a row HIGHLIGHTED. Enter in a form field submits the form, and
      // swallowing that unconditionally would make the dropdown a trap on the one
      // control most likely to be the last thing typed.
      e.preventDefault()
      pick(matches[hi].name)
    } else if (e.key === 'Escape' && menuOpen) {
      // Stopped here rather than allowed to bubble: the dialog this box sits in
      // closes on Escape, and losing the whole form to a dismissed dropdown is
      // the sort of thing you only do once before you stop using the dropdown.
      e.stopPropagation()
      setOpen(false)
    }
  }

  return (
    <div className="tp-field" ref={boxRef}>
      {label && <MonoLabel htmlFor={inputID}>{label}</MonoLabel>}
      <input
        ref={ref}
        id={inputID}
        className="tp-input"
        role="combobox"
        // The per-word offer a phone's keyboard makes on any name box here —
        // see ui.jsx's "name casing". Nothing rewrites what is typed.
        autoCapitalize={nameCase ? 'words' : undefined}
        aria-expanded={menuOpen}
        aria-autocomplete="list"
        // The rest of the combobox contract. Focus never leaves the input — the
        // arrow keys move a class — so without these a screen reader is told the
        // list exists and never told which row is current.
        aria-controls={menuOpen ? listID : undefined}
        aria-activedescendant={menuOpen && hi >= 0 ? `${listID}-${hi}` : undefined}
        aria-label={ariaLabel || label}
        autoComplete="off"
        placeholder={placeholder}
        value={value || ''}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
          setHi(-1)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKey}
        onBlur={(e) => {
          // The menu is portalled, so it is not a descendant of boxRef — asking
          // only boxRef makes every option click look like focus leaving the
          // control, and closes the menu before the click can land.
          if (boxRef.current?.contains(e.relatedTarget)) return
          if (popRef.current?.contains(e.relatedTarget)) return
          setOpen(false)
        }}
      />
      {/* THE POINTER LETTING GO IS AS MUCH AN ANSWER AS THE POINTER ARRIVING.
          Without this, moving the mouse across the panel on the way to the ✓ left a
          row highlighted, and Enter then replaced what had been typed with whatever
          the pointer last crossed. */}
      {menuOpen && createPortal(
        <ul
          ref={popRef}
          className="token-menu"
          style={style}
          role="listbox"
          id={listID}
          onMouseLeave={() => setHi(-1)}
        >
          {matches.map((r, i) => (
            <li key={r.name} role="presentation">
              <button
                type="button"
                id={`${listID}-${i}`}
                role="option"
                aria-selected={i === hi}
                className={'token-opt cast-opt' + (i === hi ? ' hi' : '')}
                onMouseEnter={() => setHi(i)}
                onClick={() => pick(r.name)}
              >
                <span className="cast-opt-name">{r.name}</span>
                {r.other && <span className="cast-opt-other">{r.other}</span>}
              </button>
            </li>
          ))}
        </ul>,
        document.body,
      )}
    </div>
  )
}
