import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

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
export function useSelection(orderedIds = []) {
  const [kind, setKind] = useState(null)
  const [ids, setIds] = useState(() => new Set())
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

  useEffect(() => {
    if (ids.size === 0 && kind !== null) setKind(null)
  }, [ids, kind])

  const clear = useCallback(() => {
    setIds(new Set())
    setKind(null)
    anchor.current = null
  }, [])

  // toggle picks or unpicks one id. `itemKind` names what is being selected, and a
  // different kind replaces the selection rather than joining it.
  const toggle = useCallback(
    (id, itemKind) => {
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

  const selectAll = useCallback(
    (itemKind) => {
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
    active: ids.size > 0,
    isSelected: (id) => ids.has(id),
    toggle,
    extendTo,
    selectAll,
    clear,
  }
}

// selectionClick reads a click's modifiers and says what it means.
//
// A plain click keeps opening the thing UNTIL a selection exists; once one does, a
// plain click toggles. The mode is visible — the bar is up and the cards wear
// checkboxes — so the change of meaning is not a surprise, and clicking the last
// item off leaves it again.
//
// Ctrl/Cmd-click always selects, which is the gesture every file manager has
// taught, and Shift extends.
export function selectionClick(e, { active }) {
  if (e.shiftKey) return 'extend'
  if (e.metaKey || e.ctrlKey) return 'toggle'
  return active ? 'toggle' : 'open'
}
