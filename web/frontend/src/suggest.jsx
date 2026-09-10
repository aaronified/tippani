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
const EMPTY = Object.freeze({ cast: [], chapters: [], packs: [], loading: false })

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
    // them, which is exactly the shape the character box wants — and then the
    // locator pool for whichever medium has one: chapters for a book, packs for a
    // game (0071). A film has neither, and asks for neither: this is the second
    // and third request on opening a form, so a fetch for a list that is always
    // empty is a fetch that costs a round trip to say nothing.
    //
    // GAMES ARE `movies` ROWS, so `kind` cannot tell a game from a film here and
    // the pack list is asked for on both. `/movies/{id}/packs` answers [] for a
    // film by construction — no film line carries a pack, because the writer
    // clears it — so the alternative would be plumbing media_type into this hook
    // to save one empty reply.
    const wants = [json('GET', `/${kind}/${id}/cast`)]
    wants.push(kind === 'books' ? json('GET', `/books/${id}/chapters`) : json('GET', `/movies/${id}/packs`))
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
        // Names only, because a pack is a name and nothing else — see the
        // endpoint's own note on why it returns a flat list where the chapter
        // endpoint returns pairs.
        packs: ((rch?.ok && rch.data?.packs) || []).map((p) => p.name).filter(Boolean),
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

  // THE CHAPTER PAIRING MOVED OUT, to `chapterPatch` in text.js. This hook used to
  // own one direction of it — name fills number — and the owner reversed the
  // emphasis: "chapter name from number is more useful." Both directions now run,
  // and the rule lives in an import-free module so the add form and the edit form
  // call one function instead of keeping a line each. What stays here is the DATA
  // both of them read: `state.chapters`, straight from the endpoint, pairs intact.

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

  return { ...state, actorFor, chapterNames, chapterNumbers }
}

// THE NATIVE DATALIST IS GONE, and the owner is why: "tag, character, chapter
// name, and number will be comboboxes based on the available items."
//
// It served the two chapter boxes and nothing else, and the argument for it was
// real — the browser's own list filters as you type, does not steal the keyboard on
// a phone, and never prevents you typing something off the list. What killed it is
// DISCOVERABILITY, which the cast box had already proved: desktop Chrome opens a
// datalist only after a keystroke, so a reader who had typed nothing saw nothing.
// That is fatal for a list you open the box in order to be reminded of, and a
// chapter name is exactly that — you know the number, the name is what you would
// have to flip back to find.
//
// Deleted rather than left exported: the last two callers are `SuggestCombo` now,
// and an unused primitive is a second answer to a question this file already
// answers once.

const COMBO_MAX_DESKTOP = 10
const COMBO_MAX_MOBILE = 5

// fold is the same accent-and-case fold the rest of the app matches names with,
// kept local because this file must not import text.js's pure module for one
// two-line function that has a different job here (substring, not distance).
const fold = (v) => String(v || '').toLowerCase().trim()

// SuggestCombo — a single-value box with a filtered list of your own prior
// values. THE GENERAL FORM OF WHAT CastCombo ALREADY WAS.
//
// `docs/plans/entry-helpers.md` specifies this as `SuggestInput` and lists what
// it needs: filter-and-rank, a cap, a portalled `role="listbox"`,
// arrow/Enter/Escape, and "the blur-commit that checks both the box and the
// popover, without which clicking a suggestion reads as 'focus left the field'
// and commits the half-typed text instead". Every one of those is in the body
// below and has been since the cast box shipped — so this is a generalisation
// rather than a new component, because the alternative was a second copy of the
// one part that is genuinely hard to get right.
//
// `options` is [{ name, other }] — `other` being the second line a row can carry,
// which for the cast is the actor and for a chapter or a pack is nothing.
//
// IT IS FREE TEXT WITH SUGGESTIONS, NOT A PICKER, and that is load-bearing: every
// field this serves is optional free text at the API, so a chapter you have never
// recorded has to be typeable or the helper becomes a cage. Nothing is ever
// restricted to the pool.
export function SuggestCombo({ label, value, onChange, onCommit, placeholder, options = [], nameCase = true, inputRef, ariaLabel, inputMode }) {
  return <Combo label={label} value={value} onChange={onChange} onCommit={onCommit} placeholder={placeholder} rows={options} nameCase={nameCase} inputRef={inputRef} ariaLabel={ariaLabel} inputMode={inputMode} />
}

// CastCombo — SuggestCombo over a work's cast, which is where this component
// started. Kept as its own name because the mapping is real work: a cast row
// holds two names, `field` says which of them this box is for, and the OTHER one
// becomes the second line — so a reader typing "quinn" is shown "Harley Quinn"
// with "Margot Robbie" under it.
export function CastCombo({ label, value, onChange, onCommit, placeholder, cast = [], field = 'character', nameCase = true, inputRef, ariaLabel }) {
  const rows = useMemo(
    () => cast.map((c) => ({ name: (c?.[field] || '').trim(), other: (c?.[field === 'character' ? 'actor' : 'character'] || '').trim() })),
    [cast, field],
  )
  return <Combo label={label} value={value} onChange={onChange} onCommit={onCommit} placeholder={placeholder} rows={rows} nameCase={nameCase} inputRef={inputRef} ariaLabel={ariaLabel} />
}

// Combo is the body both of them share. Not exported: a caller reaching past the
// two named forms would be a third opinion about what a row is.
function Combo({
  label,
  value,
  onChange,
  // onCommit — THE EDIT IS FINISHED. Fired when a suggestion is picked, when
  // Enter takes a highlighted row, and when focus genuinely leaves the box;
  // never on a keystroke.
  //
  // THE OWNER FOUND WHY THIS HAS TO EXIST, by typing a two-digit chapter: "if i
  // am at chapter 15, the chapter name is assigned at typing 1 and then no
  // rewrites". Anything that reads the box's value and acts on the LIBRARY —
  // pairing a chapter number with its name, here — is answering a question about
  // a value the reader has not finished giving. At `1` the answer is chapter one,
  // and it is confidently wrong. Their own fix: "should it not be assigned when
  // the edit is complete (the typing cursor is moved)?"
  //
  // So the two callbacks have two jobs and neither does the other's. `onChange`
  // keeps the box's text in step with the keyboard, every keystroke, and must stay
  // cheap and local. `onCommit` is where a consequence goes.
  onCommit,
  placeholder,
  // [{ name, other }] in the order they arrived — billing order for a cast,
  // commonest-first for a chapter or a pack, which is what the endpoints return.
  rows: given = [],
  nameCase = true,
  inputRef,
  ariaLabel,
  // A numeric keypad for the one box here that holds a number. Passed through
  // rather than inferred: `nameCase` already says "this is a name" and a second
  // flag deriving the keypad from it would tie two unrelated facts together.
  inputMode,
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

  // Deduped on the name, in the order they arrived — the lead is the row most
  // lines belong to, which beats alphabetical for a list of ten. Blanks dropped:
  // a cast row with no actor and a chapter with no name both arrive legitimately
  // and neither is a suggestion.
  const rows = useMemo(() => {
    const seen = new Set()
    const out = []
    for (const r of given) {
      const name = String(r?.name || '').trim()
      if (!name || seen.has(fold(name))) continue
      seen.add(fold(name))
      out.push({ name, other: String(r?.other || '').trim() })
    }
    return out
  }, [given])

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

  // A PICK IS A COMMIT, and it is the one case where the two callbacks must fire
  // together: `onChange` puts the row's text in the box and `onCommit` lets the
  // caller act on it. Not `onChange` alone — the caller has no other signal that
  // the value is finished — and not `onCommit` alone, because the box is
  // controlled and would still show what was typed.
  const commit = (v) => onCommit?.(v)
  const pick = (name) => {
    onChange(name)
    commit(name)
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
    } else if (e.key === 'Enter') {
      // Enter with NO row highlighted is still the reader saying they are done —
      // it is how a form is submitted from the last field, and the pairing has to
      // have run before that. Not prevented: swallowing Enter here would make the
      // box a trap on the control most likely to be the last thing typed, which is
      // the argument the highlighted-row branch above already makes.
      commit(value || '')
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
        inputMode={inputMode}
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
          // control, and closes the menu before the click can land. The same two
          // checks gate the commit: a click on a row must not fire the blur
          // commit as well, or the half-typed text competes with the row that was
          // chosen — the case entry-helpers.md calls out by name.
          if (boxRef.current?.contains(e.relatedTarget)) return
          if (popRef.current?.contains(e.relatedTarget)) return
          setOpen(false)
          commit(value || '')
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

// OfferChip — what the app says when it knows an answer and will not write it.
//
// `docs/plans/entry-helpers.md` state 3: "counterpart non-empty and disagrees →
// write nothing. Show one inline chip — `Chapter 3?` — that fills on tap." The
// plan's reason is the failure it prevents, and it is worth restating because the
// chip looks like a nicety and is not: "you type 7, then pick a chapter name to
// save typing, and the 7 silently becomes 3. You would not notice until the quote
// was already filed under the wrong chapter, and nothing would record that the app
// had done it."
//
// BUT NEVER WRITING IS ONLY HALF AN ANSWER, and the owner found the other half by
// using it — "the chapter name is assigned at typing 1 and then no rewrites".
// Refusing to clobber protects what you typed; with no way to accept the pool's
// answer it also strands a value the app itself filled in a moment earlier. The
// chip is that way back, and it is one tap, and it writes only when tapped.
//
// ONE COMPONENT, so a second caller cannot invent a second behaviour — the plan's
// own reasoning, and this repo's directive that two things which look the same
// behave the same. A chip is a real button (`tp-chip-btn`, the class the shelf-cap
// and "Mark as read" rows already use) rather than a span with a handler, so it is
// reachable by Tab and announces itself.
//
// The Alt+1…9 route the plan specifies is NOT here yet: it wants nine ids in
// `keys.js` with a `ctx`, and `prettyKey` needs an `alt` word. That is a keyboard
// feature of its own and this is one chip; the pointer route is complete.
// ONE CONTROL AND NO SECOND ONE TO DISMISS IT. The plan says the chip "fills on
// tap and vanishes on dismiss or on the next keystroke in that field", and the
// keystroke is the whole of it: typing in the box the chip is about is already the
// reader saying they meant what they typed. A ✕ beside it would be a second
// control for a state that clears itself, and this app has a standing rule against
// a row that says a thing twice.
export function OfferChip({ label, onAccept }) {
  if (!label) return null
  return (
    <button type="button" className="tp-chip tp-chip-btn offer-chip" onClick={onAccept}>
      {label}
    </button>
  )
}

// useTagNames — the tag names in the library, for a token input's suggestions.
//
// ITS OWN SMALL HOOK, and deliberately not a fifth copy of the fetch the Library,
// Catalogue, Home and Quotes screens each keep. Those four read a richer shape —
// `tagMap`, with counts and colours, which they draw as chips and filter by — so
// they are not duplicates of this and are left alone. What a FORM needs is the
// names, and nothing else.
export function useTagNames() {
  const [tags, setTags] = useState([])
  useEffect(() => {
    let stale = false
    json('GET', '/tags').then((r) => {
      if (stale) return
      // A refusal is an empty list, never an error on screen — the rule this
      // module's header states for the cast and the chapters. Tag suggestions
      // are a convenience; the box takes anything typed.
      setTags(((r?.ok && r.data?.tags) || []).map((x) => x.name || x).filter(Boolean))
    })
    return () => { stale = true }
  }, [])
  return tags
}
