import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { t } from './i18n.js'

// A selection is a sentence you are in the middle of saying.
//
// useSelection holds which items are picked on one board, and the rules that keep
// the number it reports honest.
//
// ONE KIND AT A TIME. A view can show books and quotes together (search does), and
// a selection spanning both has no coherent action — you cannot set a series on a
// quote. Selecting in a second section clears the first, and the bar says which
// kind it is holding.
//
// IT CLEARS WHEN THE VISIBLE LIST CHANGES UNDER IT. Select thirty quotes, switch
// the colour filter, and the selection holds ids that are no longer on screen; act
// on it and you have acted on things you could not check. The bin makes that
// recoverable now — it does not make it honest.
//
// NOTHING IS PERSISTED. Resuming a selection after a reload is a way to act on a
// library that changed while you were away.
//
// ---- THE MODE OUTLIVES THE PICKS (1.11.2) -----------------------------------
//
// `open` is selection MODE, and it is deliberately not the same question as "is
// anything picked". Until now it was: the bar rendered on `count > 0`, so
// deselecting the last card tore the bar off the screen mid-task.
//
// That is wrong in a way you only feel by using it. Long-press a book, look at
// what the bar offers, decide those are the wrong four books and tap them off —
// and the controls vanish, so re-picking means finding the long press again. The
// mode is a mode: you leave it when you say so, not when the count happens to
// touch zero on the way to a different four.
//
// It also left a mark behind. The dot on the card you long-pressed stayed lit
// until a reload, because on a touch screen the tile keeps :focus-within after
// the tap and that is one of the things the stylesheet reveals a mark for. With
// `open` driving `.is-selecting` and the hover/focus reveal now gated behind
// `(hover: hover)`, dismissing the mode is what puts every mark away — which is
// the only rule a person can hold: the ticks are up while the bar is up.
//
// So: `dismiss()` closes the mode and empties it, `deselectAll()` empties it and
// leaves it open, and `count === 0` while open is a real, reachable state that
// the bar has to render — with its actions disabled, because acting on nothing
// is not something to offer.
export function useSelection(orderedIds = []) {
  const [kind, setKind] = useState(null)
  const [ids, setIds] = useState(() => new Set())
  const [open, setOpen] = useState(false)
  // The last id toggled, which is what Shift extends FROM. Kept in a ref rather
  // than state: it changes on every toggle and nothing renders differently for it.
  const anchor = useRef(null)

  // `orderedIds` is the board's own `shown` array — the visible list, in the order
  // it is on screen. Joining it is how the effect below notices a change: a new
  // array identity every render would clear the selection on every keystroke.
  const key = orderedIds.join(',')
  const visible = useMemo(() => orderedIds, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Drop anything no longer visible. Clearing the WHOLE selection would be the
    // blunter rule and it is wrong for the commonest case — a board reloading
    // itself after a patch, where every id is still there.
    setIds((prev) => {
      if (prev.size === 0) return prev
      const live = new Set(visible)
      let changed = false
      const next = new Set()
      for (const id of prev) {
        if (live.has(id)) next.add(id)
        else changed = true
      }
      return changed ? next : prev
    })
  }, [visible])

  // NOTE what is NOT here any more: an effect nulling `kind` the moment the
  // selection emptied. It existed so that after deselecting everything you could
  // start a fresh selection of a different kind — but `toggle` has always handled
  // a kind mismatch explicitly, by replacing the selection, so the effect was
  // never what made that work. Keeping the kind is what lets the bar hold its
  // shape at zero: without it, an empty selection of books would render the
  // quote actions, because `isWorkKind(null)` is false.

  // dismiss ends the mode: nothing picked, no kind, no marks anywhere. The one
  // way out, and the only thing that puts the ticks away.
  const dismiss = useCallback(() => {
    setIds(new Set())
    setKind(null)
    setOpen(false)
    anchor.current = null
  }, [])

  // deselectAll empties the selection and STAYS in the mode. The bar holds, with
  // its actions disabled, so picking a different four is picking a different four
  // rather than starting again from the gesture.
  const deselectAll = useCallback(() => {
    setIds(new Set())
    anchor.current = null
  }, [])

  // toggle picks or unpicks one id. `itemKind` names what is being selected, and a
  // different kind replaces the selection rather than joining it.
  const toggle = useCallback(
    (id, itemKind) => {
      setOpen(true)
      setKind((k) => {
        if (k && itemKind && k !== itemKind) {
          setIds(new Set([id]))
          anchor.current = id
          return itemKind
        }
        setIds((prev) => {
          const next = new Set(prev)
          if (next.has(id)) next.delete(id)
          else next.add(id)
          return next
        })
        anchor.current = id
        return k || itemKind || null
      })
    },
    [],
  )

  // extendTo selects every id from the last toggled one to this one, over the
  // VISIBLE order — not the DOM, and not the unfiltered list. Shift-clicking with
  // nothing selected yet is just a click.
  const extendTo = useCallback(
    (id, itemKind) => {
      const from = anchor.current
      if (from == null || from === id) return toggle(id, itemKind)
      const a = visible.indexOf(from)
      const b = visible.indexOf(id)
      if (a < 0 || b < 0) return toggle(id, itemKind)
      const [lo, hi] = a < b ? [a, b] : [b, a]
      setOpen(true)
      setKind(itemKind || null)
      setIds((prev) => {
        const next = new Set(prev)
        for (let i = lo; i <= hi; i++) next.add(visible[i])
        return next
      })
      anchor.current = id
    },
    [visible, toggle],
  )

  // begin enters the mode with NOTHING PICKED — the menu's door in, beside the
  // long-press and the Ctrl-click. It exists because the other two doors both
  // require a card: a reader who wants to start picking has to guess a gesture on
  // a row, and a menu row that says "Select quotes" is the one way in that can be
  // FOUND rather than known. Nothing is picked because the reader has not picked
  // anything — the bar stands at zero, which is exactly the state `open` was split
  // from `count > 0` to make expressible.
  const begin = useCallback((itemKind) => {
    setOpen(true)
    setKind((k) => k || itemKind || null)
  }, [])

  const selectAll = useCallback(
    (itemKind) => {
      setOpen(true)
      setKind(itemKind || null)
      setIds(new Set(visible))
    },
    [visible],
  )

  return {
    kind,
    selected: ids,
    ids: [...ids],
    count: ids.size,
    // How many are on screen, and whether the selection already holds all of
    // them. Both exist for the menu's Select all / Deselect all pair: an item
    // that offers to select everything when everything is already selected is a
    // dead control, and this board has a stated position on those.
    total: visible.length,
    allSelected: visible.length > 0 && ids.size >= visible.length,
    // `open` is the mode; `active` is the same question and is what every board
    // already reads for `.is-selecting`, so it is an alias rather than a second
    // concept. It used to mean `count > 0`, which is why the marks came and went
    // with the count instead of with the bar.
    open,
    active: open,
    // Whether anything is actually picked, which is what an ACTION has to ask.
    // The two were one boolean until the mode outlived the picks, and every place
    // that reads the wrong one of them is a bug you can see: `active` on a button
    // offers to recolour nothing, `open` on a mark hides the ticks mid-task.
    any: ids.size > 0,
    isSelected: (id) => ids.has(id),
    toggle,
    extendTo,
    begin,
    selectAll,
    deselectAll,
    dismiss,
    // `clear` is what the boards call after a bulk action lands, and it should end
    // the mode: the thing you selected forty books to do is done. Kept under its
    // old name because that is what those call sites mean by it.
    clear: dismiss,
  }
}

// selectionClick reads a click's modifiers and says what it means.
//
// A plain click keeps opening the thing UNTIL the mode is entered; from then on a
// plain click toggles. The mode is visible — the bar is up and the cards wear
// checkboxes — so the change of meaning is not a surprise.
//
// `active` is now the MODE rather than `count > 0`, and that changes one thing
// here: clicking the last card off used to hand plain clicks back to opening, and
// now it does not. It cannot, and that is the point — the bar is still up, the
// ticks are still standing, and a click that opened a book while the board plainly
// said it was selecting would be the surprise. Dismiss (or Escape) is the way out.
//
// Ctrl/Cmd-click always selects, which is the gesture every file manager has
// taught, and Shift extends.
export function selectionClick(e, { active }) {
  if (e.shiftKey) return 'extend'
  if (e.metaKey || e.ctrlKey) return 'toggle'
  return active ? 'toggle' : 'open'
}

// selectionMenuItems — the select controls a card's own menu puts above the
// actions, for one card, in one place.
//
// WHY IT IS A FUNCTION AND NOT THREE COPIES. Select was built inline in
// Library, Movies and works, identically, three times. Adding Select all beside
// it would have been a fourth, fifth and sixth copy of a decision — and this
// repo already has a file whose entire reason for existing is that an action
// defined per-surface drifts per-surface (actions.jsx, and the book tile that
// offered nothing for three releases). One list, every surface renders it.
//
// SELECT ALL IS PAIRED WITH ITS UNDO rather than standing alone. With everything
// already picked, "Select all" does nothing — and a control that does nothing on
// a screen you reach it from teaches you to stop reading the menu. So it reads
// "Deselect all" at that point, which is never dead and is the thing you
// actually want next.
//
// It selects what is ON SCREEN, not what is in the library. That is the same
// promise the bar makes — the selection drops anything a filter takes away, so
// the number in the bar is always a number it can act on — and "all" meaning
// four hundred rows a filter is hiding would break it.
export function selectionMenuItems(selection, id, kind) {
  if (!selection) return []
  const items = [
    {
      id: 'select',
      label: t(selection.isSelected(id) ? 'common.selection.menu.deselect.label' : 'common.selection.menu.select.label'),
      onClick: () => selection.toggle(id, kind),
    },
  ]
  // Nothing to select all OF when the board holds one card — the item would
  // duplicate the one above it.
  if (selection.total > 1) {
    items.push(
      selection.allSelected
        ? { id: 'deselect-all', label: t('common.selection.menu.deselect-all.label'), onClick: () => selection.deselectAll() }
        : {
            id: 'select-all',
            label: t('common.selection.menu.select-all.label', { count: selection.total, n: selection.total }),
            onClick: () => selection.selectAll(kind),
          },
    )
  }
  return items
}
