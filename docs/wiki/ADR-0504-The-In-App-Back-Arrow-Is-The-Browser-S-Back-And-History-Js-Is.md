# ADR-0504: The in-app Back arrow is the browser's Back, and history.js is where that is decided

Source of truth: this wiki page.

- **Area:** [§14 Boards, Cards, Charts and Popups](ADR-Index.md#area-14)
- **Status:** Accepted
- **Version:** 2.1.3

**Decided.** `history.js` owns the session history: every pushed entry carries a `tpDepth` one greater than the entry it came from, the entry the reader ARRIVED on carries 0, and `navigateBack(fallback)` delegates to `window.history.back()` when the depth is above 0 and otherwise **replaces** the address in place. The five in-app back arrows — a work detail's, a quote board's, an anthology's, the Bin's, and the phone's detail bar — call `goBack(tab)`, which is that function plus a state update for the replace case only.

**The bug.** Every one of those arrows called `go(tab, null)`, and `go` pushes. So the stack read shelf → book → shelf, and the phone's Back returned to the book. The report: *"if i use the back button on the top of the screen from a work details page of any page, it is not treated as back, but as a link. when i go back using the phone controls, it goes back to the work details page instead of going back yet further."* Two controls with one name doing opposite things to one stack, and the address bar could not show it — `/library` either way.

**Why a depth and not a flag.** The arrow has to tell apart two situations that look identical from where it is pressed: the book was opened from the shelf, so Back is the browser's Back; or the reader arrived on the book directly — a shared link, a bookmark, a reload, the PWA reopening where it left off — where `history.back()` leaves the app entirely. A count answers both and needs nothing else remembered.

**Why in `history.state` rather than a ref.** It has to survive a reload, and the session's entries do. A ref would read 0 after F5 on a detail page and the arrow would stop being Back on the one path a reader triggers most easily.

**Why a module.** Nothing in the suite mounts `App` — its size is the reason, and `features-nav.test.js` reads it as *source* for the same reason. Splitting the history decision out of the component makes it testable against jsdom's real session history; what cannot be tested that way is which prop each arrow is wired to, so that is asserted from the source, and the pattern it forbids is `onClose={() => go('x', null)}` — the shape that reads most naturally when adding the next screen.

**Approved.** The reader's, with the general rule stated in the same message: *"the back action needs to be global, no matter in which menu. back buttons and software back actions (in desktop browser or phone gestures/buttons) should be in sync."* The overlay half of that is `useBackToClose`, two entries above.

<sub>2.1.3 — `web/frontend/src/history.js` · `web/frontend/src/App.jsx` · `web/frontend/src/ui.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
