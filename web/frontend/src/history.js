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
  window.history.replaceState({ ...window.history.state, tpDepth: historyDepth(), tpSeq: historySeq() }, '', path)
}

// pushRoute is a navigation: a tap on a cover, a tab, a link. One entry deeper.
// A path that is already the address is not a navigation and pushes nothing —
// otherwise Back would land on the screen it started from and look broken.
export function pushRoute(path) {
  if (path === window.location.pathname) return false
  // The abandoned forward rows are dropped by `stampPush`, which every push goes
  // through — a route's, a panel's and an overlay's alike.
  window.history.pushState(stampPush({ tpDepth: historyDepth() + 1 }), '', path)
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
    window.history.replaceState({ tpDepth: 0, tpSeq: historySeq() }, '', fallbackPath)
  }
  return false
}

// popIsOverlay — was the pop that just arrived a panel or an overlay closing,
// rather than the reader navigating?
//
// `showing` is the path the app currently believes it is on (`statePath(tab,
// detail)`); the answer is read against the address the pop landed on.
//
// WHY THE PATH IS THE ONLY HONEST SIGNAL. A panel pushes its history entry with
// pushState's url argument omitted (`usePanelStack.push`), so opening one does not
// change the address, and closing one is a plain `history.back()`. That pop is
// indistinguishable from a real Back by everything EXCEPT the address:
//
//   NOT THE POPPED STATE. A popstate carries the DESTINATION entry's state, and
//   the destination of a single-panel dismissal is the entry the panel was pushed
//   FROM — which has no panel depth on it at all. That is why `usePanelStack`
//   keeps its own depth ref rather than reading the popped state, and it is why
//   checking for a panel marker here cannot work for the depth-1 case, which is
//   the only case that matters.
//
//   THE PATH, because `pushRoute` above refuses to push a path equal to the
//   current address. The app therefore never creates two adjacent entries with one
//   path, so a pop that leaves the address unchanged cannot be a screen the reader
//   navigated to. It is an overlay — a panel, or any `useBackToClose` surface.
//
// WHAT IT IS FOR: a route handler that treats such a pop as a navigation re-derives
// the same route, hands React a fresh detail object, and re-runs whatever depends
// on the detail's identity. In this app that is the scroll memory, and it threw the
// reader to the top of the page every time they closed a panel on it.
export function popIsOverlay(showing) {
  return showing === window.location.pathname
}

// ---- the trail: which screens are behind this one, and how far back ----
//
// WHAT IT IS FOR. Holding the phone dock's Back key offers the last few screens
// rather than one press each. Picking one does not fake a jump: it hands the
// browser a `go(-k)`, so the device's own Back walks on from there and the two
// stay the one act this file exists to keep them.
//
// WHY THE APP HAS TO KEEP ITS OWN LIST. The History API cannot be read. There is
// no way to ask the browser what is behind the current entry, and no way to
// delete or reorder entries — both are anti-spoofing rules, not omissions. The
// one thing it does offer is `go(-k)`, which rewinds the REAL stack. So a list
// of previous screens is possible exactly as far as the app can work k out for
// itself, and that is what the trail is.
//
// AND k IS NOT A DIFFERENCE OF tpDepth. Panels and overlays push entries too —
// `usePanelStack.push` and `useBackToClose`, both in ui.jsx — and both carry the
// route's tpDepth forward UNCHANGED, because their entry is not a screen. Two
// route entries three apart in the stack can therefore read one apart in depth,
// and a jump computed from depth would land on a panel's entry: the address
// would not change, the app would see an overlay pop, and the reader's press
// would do nothing at all.
//
// SO EVERY ENTRY THE APP PUSHES CARRIES tpSeq, one more than the entry it was
// pushed from, panels and overlays included. The distance between two entries is
// then the difference of their serials, exactly, and the trail only has to
// remember which serials were screens. A pushState anywhere in this app that
// skips `stampPush` silently breaks that arithmetic — which is why there are only
// three push sites and `test/rules/history-seq.test.js` counts them.
//
// WHAT IT CANNOT DO, said rather than hidden: the entries above the one you pick
// become FORWARD entries. Nothing can delete them, so the device's Forward key
// still reaches them. That is the browser's rule and not a shortcut taken here.

// The serial of the current entry. Zero for an entry we never pushed — a first
// load, or a shared link — which is the same answer `historyDepth` gives, and
// for the same reason: nothing of ours is behind it.
export const historySeq = () => Number(window.history.state?.tpSeq) || 0

// stampPush — the state object for an entry ABOUT TO BE PUSHED. Called as an
// argument to pushState, so it reads the serial of the entry being pushed FROM.
//
// AND IT TRIMS, WHICH IS WHY IT IS NOT CALLED `stampSeq` ANY MORE. A push
// destroys every forward entry, so any row the trail holds at or above the new
// serial is pointing at an entry the browser has just dropped — the next entry to
// take that serial is a different screen, or no screen at all.
//
// THE TRIM BELONGS TO EVERY PUSH, NOT TO `pushRoute`, AND THAT WAS THE FIRST CUT'S
// BUG. A panel opened after a Back takes the abandoned serial without recording
// anything, so the stale row sat BELOW the next route's serial where no trim on
// `pushRoute` could reach it and no `noteRoute` would ever overwrite it. The menu
// then offered "Quotes" for an entry that had become somebody's panel: pressing it
// lands on the address that panel opened over, which is a row that goes to the
// wrong screen — the one failure mode worse than a row that goes nowhere.
//
// A WRITE FROM AN ARGUMENT EXPRESSION, said out loud because it is unusual. It
// runs before the pushState it is an argument to, which is exactly when the
// forward entries are still there to be counted, and putting it here is what keeps
// one verb in one function rather than a copy at each of the three push sites.
export function stampPush(state) {
  const next = historySeq() + 1
  trimTrail(next)
  return { ...state, tpSeq: next }
}

// sessionStorage, not a module variable, because tpSeq survives a reload and a
// module variable does not — and a trail that forgets what the serials mean is
// worse than none: every row would point at the wrong screen. Per tab, which is
// the same scope the session history itself has.
const TRAIL_KEY = 'tippani:trail'
// A few more than the five we show, so a jump back leaves rows behind it.
const TRAIL_MAX = 24

function readTrail() {
  try {
    const a = JSON.parse(window.sessionStorage.getItem(TRAIL_KEY) || '[]')
    return Array.isArray(a) ? a : []
  } catch {
    return [] // private mode, or storage the reader has blocked
  }
}

function writeTrail(a) {
  try {
    window.sessionStorage.setItem(TRAIL_KEY, JSON.stringify(a))
  } catch {
    // A trail is a convenience. Losing it must not cost the navigation it rides on.
  }
}

// trimTrail — drop everything from `from` upwards. Called by `stampPush` alone,
// because a push is the only act that destroys forward entries: a popstate
// travels among entries that all still exist, and a trail trimmed on every
// arrival would forget the screens a Forward press can still reach.
function trimTrail(from) {
  writeTrail(readTrail().filter((e) => e.seq < from))
}

// noteRoute — this entry is a screen, and here is what it is called.
//
// UPSERT BY SERIAL, AND IT IS CALLED MORE THAN ONCE PER ARRIVAL ON PURPOSE. A
// detail screen's name arrives after the screen does (`useCrumb` publishes it
// once the work has loaded), so the first call records "Library" and the second
// records the book. Keying on the serial is what lets the second correct the
// first instead of adding a row.
//
// THE TAB IS STORED, NOT THE LABEL. A label resolved here would be frozen in the
// language it was written in, and switching to Bengali would leave the list
// speaking English — the exact defect the top bar's context pill shipped with.
export function noteRoute(tab, detail, title) {
  const seq = historySeq()
  const a = readTrail().filter((e) => e.seq !== seq)
  a.push({ seq, tab, kind: detail?.type || null, title: title || null })
  a.sort((x, y) => x.seq - y.seq)
  writeTrail(a.slice(-TRAIL_MAX))
}

// recentRoutes — the screens BEHIND this one, nearest first.
//
// Strictly behind: the screen you are on is not somewhere to go back to, and a
// row that lands you where you already are is the dead control `make controls`
// exists to find.
export function recentRoutes(n = 5) {
  const seq = historySeq()
  return readTrail().filter((e) => e.seq < seq).slice(-n).reverse()
}

// jumpBack — the whole point of the serial. Returns false rather than guessing
// when the row is not actually behind us, which a stale trail can claim.
export function jumpBack(seq) {
  const k = historySeq() - Number(seq)
  if (!(k > 0)) return false
  window.history.go(-k)
  return true
}
