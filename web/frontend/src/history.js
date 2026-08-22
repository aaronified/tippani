// The session history, and the one rule about it: the app's own Back and the
// browser's are the same act.
//
// THE BUG THIS FILE WAS CUT OUT FOR, as reported: "on phone, if i use the back
// button on the top of the screen from a work details page of any page, it is not
// treated as back, but as a link. when i go back using the phone controls, it goes
// back to the work details page instead of going back yet further."
//
// Exactly what it was. Every in-app back arrow called the same `go()` a tap on a
// cover calls, and `go` PUSHES — so pressing Back on a book left the stack reading
// shelf → book → shelf, and the phone's Back walked into the book again. Two
// controls with one name, doing opposite things to one stack.
//
// WHY THIS IS A MODULE AND NOT FOUR LINES IN App.jsx. App holds the state these
// functions steer — which tab, which detail — and none of that is needed to decide
// the history question, which is: is there an entry of OURS behind this one. Split
// out, that decision is testable without mounting the shell (nothing mounts App;
// its size is why), and the rule lives somewhere a person can read it whole.
//
// THE DEPTH. Every entry we push carries `tpDepth`, one more than the entry it was
// pushed from, and the entry the reader ARRIVED on carries 0. That number is the
// only way to tell apart two situations that look identical to the arrow being
// pressed:
//
//   Opened from inside the app — the shelf is behind this book, so Back means the
//   browser's Back, and taking it keeps the two in step for every press after.
//
//   Arrived here directly — a shared link, a bookmark, a reload, the PWA
//   reopening where it left off. Nothing of ours is behind it, and history.back()
//   would leave the app: to whatever page they were on before, or to a blank tab.
//
// It lives in `history.state` rather than in a ref or a module variable because it
// has to survive a reload. The session's entries do; a ref does not, so after F5
// on a detail page a ref-based depth would read 0 and the arrow would stop being
// Back — on the one path where the reader can most easily tell.

// tpDepth of the current entry. Read defensively: an overlay that pushes a marker
// of its own and forgets to carry the number forward costs one press rather than
// an exit from the app.
export const historyDepth = () => Number(window.history.state?.tpDepth) || 0

// canGoBack answers whether the browser's Back stays inside the app.
export const canGoBack = () => historyDepth() > 0

// seedRoute is called once at boot. It writes the depth onto whatever entry the
// reader landed on, and corrects the address if they typed a path that resolves
// to a canonical one somewhere else.
//
// ALWAYS WRITTEN, even when the address already matches — which is the usual case.
// The point of the call is the number, not the address. A first load carries no
// state at all and reads as 0; a reload of an entry we pushed carries the number
// we gave it and keeps it.
export function seedRoute(path) {
  window.history.replaceState({ ...window.history.state, tpDepth: historyDepth() }, '', path)
}

// pushRoute is a navigation: a tap on a cover, a tab, a link. One entry deeper.
// A path that is already the address is not a navigation and pushes nothing —
// otherwise Back would land on the screen it started from and look broken.
export function pushRoute(path) {
  if (path === window.location.pathname) return false
  window.history.pushState({ tpDepth: historyDepth() + 1 }, '', path)
  return true
}

// navigateBack is the in-app Back arrow.
//
// Returns TRUE when it handed the press to the browser, in which case the caller
// does nothing else: the popstate handler restores the tab and the detail from the
// path, so the arrow and the gesture run the same code and cannot drift.
//
// Returns FALSE when there was nothing of ours behind this entry. The address is
// rewritten in place — REPLACED, never pushed — and the caller sets its own state,
// because no popstate is coming. Replacing is what makes the second press
// sensible: somebody who opened a shared link to a book and pressed Back should be
// left looking at the shelf, not at a stack with the book still in it.
export function navigateBack(fallbackPath) {
  if (canGoBack()) {
    window.history.back()
    return true
  }
  if (fallbackPath !== window.location.pathname) {
    window.history.replaceState({ tpDepth: 0 }, '', fallbackPath)
  }
  return false
}
