// useCardNumbers — number the cards of one section by where they stand.
//
// Every card head (`CardHead` in prefRow.jsx) carries an empty `.card-num`. This
// fills each with "1 · ", "2 · " in document order, which is reading order —
// masonry keeps row order, so the first card is still the first one read — and
// empties them all when the section holds only one card, where a lone "1 ·"
// counts nothing.
//
// WHY FROM THE DOM AND NOT FROM PROPS. A section's cards come from several
// components, some of which render nothing until a fetch lands (a duplicates card
// with nothing to show, a Sources card with no sources yet), and the typed
// `index` this replaces went wrong exactly that way — "4 ·" on a screen of three.
// Counting what is actually on the screen cannot disagree with the screen.
//
// THE NUMBER IS TEXT, not a CSS counter: generated content is not in `innerText`,
// so a reader copying a heading, or a journey asking what the screen says, would
// get a number the eye sees and nothing else does.
import { useLayoutEffect } from 'react'

export function numberCards(root) {
  const nums = [...root.querySelectorAll('.card-num')]
  const counted = nums.length > 1
  nums.forEach((el, i) => {
    const want = counted ? `${i + 1} · ` : ''
    if (el.textContent !== want) el.textContent = want
  })
}

export function useCardNumbers(ref) {
  useLayoutEffect(() => {
    const root = ref.current
    if (!root) return undefined
    numberCards(root)
    if (typeof MutationObserver === 'undefined') return undefined
    let frame = 0
    // A card arriving after its fetch re-numbers the ones around it. The writes
    // above are themselves mutations, so the observer sees them once and finds
    // nothing to change.
    const mo = new MutationObserver(() => {
      if (frame) return
      frame = requestAnimationFrame(() => { frame = 0; numberCards(root) })
    })
    mo.observe(root, { childList: true, subtree: true })
    return () => { mo.disconnect(); if (frame) cancelAnimationFrame(frame) }
  })
}
